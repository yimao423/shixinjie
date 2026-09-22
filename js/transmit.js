/* ============================================================
 * transmit.js —— 次元镜界传讯（拾心界宿主页 · 重做版 2026-09-15）
 *
 * 功能（与旧版完全一致）：
 *  1. 聊天加号菜单「次元镜界」入口：单聊邀请对方 / 群聊邀请成员进入传讯模式
 *  2. 邀请 → 等待同意 → 进入全屏「镜界传讯」页（样式同聊天）
 *  3. 牌组设置弹窗：单牌组 + 牌阵（含随机 3-6）+ 正逆位
 *  4. 传讯流：我方发问 → 对方按镜界抽牌逻辑以图片消息回复（多牌横排，显牌名+正逆+牌阵位）
 *  5. 传讯期间外部世界静止：暂停主动发送 / 来电 / 对方自主行为，结束后恢复
 *  6. 结束后存「发现页 → 时空回响」，按 单人/群聊 分组 → 各轮入口 → 完整回看
 *
 * 健壮性设计（针对历史踩坑）：
 *  - iframe 就绪握手不依赖 load 事件：创建后立即轮询 ping（每次带超时、有最大重试
 *    上限），镜界侧 hook 一注册即可握手，与 CDN 是否挂起无关
 *  - 所有 postMessage RPC 带超时与错误回调，杜绝"点击无反应"类永久挂起
 *  - 镜界侧 hook 注册不受同步 CDN 阻塞（CDN 已 defer + 本侧立即 ping）
 *  - 进入传讯即冻结外部聊天自动行为，退出后按原开关恢复
 *
 * 通过隐藏 iframe 加载镜界，经 jingjie-transmit.js Hook 跨文档 RPC 抽牌。
 * ============================================================ */
(function () {
  'use strict';

  /* ================= 状态与常量 ================= */
  var K = 'mtx_';                                  // localStorage 前缀
  var session = null;                              // 当前传讯会话
  var questionActive = false;                      // 本题是否在等待回复
  var pendingCount = 0;                            // 本题抽牌张数
  var pendingPositions = [];                       // 本题牌阵位

  // iframe 握手：不依赖 load，创建即 ping；单次 ping 超时 + 最大重试次数
  var PING_TIMEOUT = 1500;                         // 单次 ping 超时（ms）
  var PING_MAX_TRIES = 50;                         // 最大重试次数（约 50~75s 兜底）
  var RPC_TIMEOUT = 8000;                          // 常规 RPC 超时（ms）
  var RPC_TIMEOUT_DRAW = 20000;                    // 抽牌 RPC 超时（ms，含图片渲染）

  var frame = null, frameReady = false;
  var pendingRpc = {};
  var rpcSeq = 0;
  var store = { decks: [], spreads: [] };          // 牌组 / 牌阵缓存（每次打开弹窗刷新）

  // 洗牌抽牌动画（发问成功后 → 对方回答牌面之前）
  var SHUFFLE_ANIM_MS = 4000;                      // 动画总时长（可配置，建议 3000~5000）
  var SHUFFLE_PHASE_MS = 1350;                     // 每个思考阶段推进间隔
  var SHUFFLE_TIMEOUT_MS = 6000;                   // 兜底：动画最多约 6s，强制进入出牌渲染
  var SHUFFLE_CARD_COUNT = 5;                      // 动画牌背张数
  var SHUFFLE_TEXTS = ['正在洗牌…', '凝神抽牌中…', '牌面缓缓浮现…'];

  var msgEl = null;                                // 当前消息容器（传讯页或回看容器）
  var echoView = null;                             // 回看定位 { kind, targetName }
  var echoSessionId = null;                        // 回看中的轮次 id
  var shuffleAnimRow = null;                       // 洗牌动画消息行（仅实时传讯页，不入库）
  var shuffleAnimTimers = null;                    // 动画定时器句柄（离开页面可清理）

  /* ================= 工具 ================= */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(t) {
    if (!t) return '';
    var d = new Date(t);
    return (d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtTimeFull(t) {
    if (!t) return '';
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' '
      + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function navigate(page) {
    if (typeof Navigation !== 'undefined' && Navigation.navigateTo) Navigation.navigateTo(page);
  }
  function goBack() {
    if (typeof Navigation !== 'undefined' && Navigation.goBack) Navigation.goBack();
  }
  function toast(msg) {
    if (typeof Core !== 'undefined' && Core.toast) Core.toast(msg);
  }

  function currentChatId() {
    var room = $('page-chat-room');
    return room && room.dataset ? room.dataset.chatId || '' : '';
  }
  function partnerNickname() {
    try {
      var chats = Storage.getChats() || [];
      var cid = currentChatId();
      for (var i = 0; i < chats.length; i++) {
        if (chats[i].id === cid) return chats[i].nickname || chats[i].name || '';
      }
    } catch (e) { /* 兜底下方默认值 */ }
    return '对方';
  }

  /* ================= 隐藏 iframe + RPC 桥接 ================= */

  /* 就绪握手：创建 iframe 后立即轮询 ping，不等待 load 事件。
     镜界头部 CDN 脚本虽已 defer，慢网下仍可能长时间挂起；只要镜界侧
     jingjie-transmit.js 一执行（监听器注册），ping 即返回，握手成功。 */
  function ensureFrame(cb) {
    if (frame && frameReady) { cb && cb(true); return; }
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'mtx-frame';
      frame.src = './镜界/index.html';
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'display:none;width:0;height:0;border:0;';
      document.body.appendChild(frame);
    }
    var tries = 0;
    var started = false;
    var startPing = function () {
      if (started) return;
      started = true;
      var ping = function () {
        tries++;
        if (tries > PING_MAX_TRIES) { cb && cb(false); return; }
        rpc('ping', {}, function (ok) {
          if (ok) { frameReady = true; refreshMetaSilent(); cb && cb(true); }
          else setTimeout(ping, 150);
        }, PING_TIMEOUT);
      };
      setTimeout(ping, 100);
    };
    startPing();
  }

  /* 通用 RPC：id 注册回调，超时自动清理（同 id 仅回调一次），杜绝挂起 */
  function rpc(op, payload, cb, timeout) {
    var id = 'r' + (++rpcSeq) + '_' + Date.now();
    pendingRpc[id] = cb;
    var timer = setTimeout(function () {
      if (!pendingRpc[id]) return;
      delete pendingRpc[id];
      cb && cb(false, null);
    }, timeout || RPC_TIMEOUT);
    try {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ mtx: { op: op, id: id, payload: payload || {} } }, '*');
      } else {
        clearTimeout(timer); delete pendingRpc[id]; cb && cb(false, null);
      }
    } catch (e) {
      clearTimeout(timer); delete pendingRpc[id]; cb && cb(false, null);
    }
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || !d.mtx) return;
    var cb = pendingRpc[d.mtx.id];
    if (!cb) return;
    delete pendingRpc[d.mtx.id];
    cb(d.mtx.ok, d.mtx.result);
  });

  /* 静默刷新缓存（握手成功后拉一次） */
  function refreshMetaSilent() {
    rpc('listDecks', {}, function (ok, decks) { if (ok) store.decks = decks || []; });
    rpc('listSpreads', {}, function (ok, spreads) { if (ok) store.spreads = spreads || []; });
  }
  /* 打开牌组弹窗前强制刷新，使镜界新增自定义牌组即时同步；失败保留旧缓存 */
  function refreshMeta(done) {
    var pending = 2;
    var finish = function () { pending--; if (pending <= 0) done && done(); };
    rpc('listDecks', {}, function (ok, decks) { if (ok) store.decks = decks || []; finish(); });
    rpc('listSpreads', {}, function (ok, spreads) { if (ok) store.spreads = spreads || []; finish(); });
  }
  function rpcDraw(deckId, count, reversed, positions, cb) {
    rpc('draw', { deckId: deckId, count: count, reversedEnabled: reversed, positions: positions || [] },
      function (ok, res) {
        cb && cb(ok ? (res || []) : null, ok ? null : res);
      }, RPC_TIMEOUT_DRAW);
  }

  /* ================= 外部世界静止（冻结 / 恢复） =================
   * 进入传讯后，外部聊天不得再有任何自动行为（自动回复 / 主动发送 / 模拟来电 /
   * 自主朋友圈收藏等）。采用「覆盖入口 + 停定时器 + 收浮层」三层冻结，
   * 恢复时先比对再还原（防止还原掉后续代码已替换的函数）。 */
  var paused = null;
  var GUARD_SRC = null; // 哨兵：任一守卫函数体统一以空函数覆盖

  function _guard() {}

  function pauseWorld() {
    if (paused) return;
    paused = { orig: {}, absent: [] };
    var targets = ['doAutoReply', 'doGroupAutoReply', 'scheduleAutoReply', '_sendDoodleAutoReply', '_doProactiveSend'];
    try {
      for (var i = 0; i < targets.length; i++) {
        if (typeof window[targets[i]] === 'function') {
          paused.orig[targets[i]] = window[targets[i]];
          window[targets[i]] = _guard;
        } else {
          // 原本不存在：记录待删除，恢复时移除守卫，避免残留空函数
          paused.absent.push(targets[i]);
          window[targets[i]] = _guard;
        }
      }
      if (typeof window.stopProactiveTimer === 'function') stopProactiveTimer();
      if (typeof window.stopSimulateCallTimer === 'function') stopSimulateCallTimer();
      if (window.PartnerFreeWill && typeof PartnerFreeWill.checkAndAct === 'function') {
        paused.orig.pfwCheck = PartnerFreeWill.checkAndAct;
        PartnerFreeWill.checkAndAct = function () { return 0; };
      } else {
        paused.absent.push('pfwCheck');
        if (window.PartnerFreeWill) PartnerFreeWill.checkAndAct = function () { return 0; };
      }
      // 收起可能残留的来电 / 通话浮层（含缩略气泡）：走正常挂断流程，同步保存通话记录
      hangupOngoingCall();
    } catch (e) { /* 冻结尽量不抛错 */ }
  }

  function resumeWorld() {
    if (!paused) return;
    try {
      var o = paused.orig;
      var absent = paused.absent || [];
      ['doAutoReply', 'doGroupAutoReply', 'scheduleAutoReply', '_sendDoodleAutoReply', '_doProactiveSend'].forEach(function (name) {
        if (o[name] && window[name] === _guard) {
          window[name] = o[name];
        } else if (absent.indexOf(name) !== -1 && window[name] === _guard) {
          // 原本不存在：移除守卫，避免残留空函数破坏外部聊天
          try { delete window[name]; } catch (e2) { window[name] = undefined; }
        }
      });
      if (o.pfwCheck && window.PartnerFreeWill && PartnerFreeWill.checkAndAct && PartnerFreeWill.checkAndAct.toString().indexOf('return 0') !== -1) {
        PartnerFreeWill.checkAndAct = o.pfwCheck;
      } else if (absent.indexOf('pfwCheck') !== -1 && window.PartnerFreeWill && PartnerFreeWill.checkAndAct) {
        try { delete PartnerFreeWill.checkAndAct; } catch (e2) { PartnerFreeWill.checkAndAct = undefined; }
      }
      // 按原开关恢复：内部各自检查 Storage 开关，未开启自动跳过
      if (typeof window.startSimulateCallTimer === 'function') startSimulateCallTimer();
      if (typeof window.startProactiveTimer === 'function' && Storage.getProactiveSend()) startProactiveTimer();
    } catch (e) { /* 恢复尽量不抛错 */ }
    paused = null;
  }

  /* ================= 遮罩（邀请 / 等待 / 牌组弹窗 / 确认） ================= */
  function openOverlay(innerHtml) {
    closeOverlay();
    var o = document.createElement('div');
    o.id = 'mtx-overlay';
    o.className = 'mtx-overlay';
    o.innerHTML = innerHtml;
    document.body.appendChild(o);
    return o;
  }
  function closeOverlay() {
    var o = $('mtx-overlay');
    if (o) o.remove();
  }

  /* ================= 传讯背景：与外部聊天共用同一套聊天背景 ================= */
  var MT_BG_COLORS = [
    { name: '跟随主题', value: 'default', hex: 'var(--bg-gradient, #F8F4F8)' },
    { name: '暖粉', value: '#FFE4E1', hex: '#FFE4E1' },
    { name: '浅蓝', value: '#E3F2FD', hex: '#E3F2FD' },
    { name: '淡绿', value: '#E8F5E9', hex: '#E8F5E9' },
    { name: '奶油', value: '#FFF8E1', hex: '#FFF8E1' },
    { name: '薰衣草', value: '#F3E5F5', hex: '#F3E5F5' },
    { name: '深夜', value: '#1a1a2e', hex: '#1a1a2e' },
    { name: '墨绿', value: '#1b2a1b', hex: '#1b2a1b' }
  ];
  var _mtBgMigrated = false;

  /* 旧版独立背景（mt_bg）一次性迁移并入当前聊天背景，保证既有设置不丢失 */
  function migrateLegacyMtBg(cid) {
    if (_mtBgMigrated || !cid) return;
    _mtBgMigrated = true;
    try {
      var legacy = localStorage.getItem('mt_bg') || '';
      if (legacy && legacy !== 'default') {
        var cur = Storage.getChatBgCustom(cid);
        if (!cur || cur === 'default') {
          Storage.setChatBgCustom(cid, legacy.indexOf('data:') === 0 ? '__idb__' : legacy);
          if (window.ChatBgDB && legacy.indexOf('data:') === 0) ChatBgDB.set(cid, legacy).catch(function () {});
        }
      }
      localStorage.removeItem('mt_bg');
    } catch (e) { /* 迁移失败忽略 */ }
  }
  function applyTransmitBg(value) {
    var page = $('page-transmit');
    var zone = page ? page.querySelector('.mtx-chat') : null;
    if (!zone) return;
    page.classList.remove('chat-room-bg-dark');
    if (!value || value === 'default') { zone.style.background = ''; return; }
    var dark = (value === '#1a1a2e' || value === '#1b2a1b');
    if (dark) page.classList.add('chat-room-bg-dark');
    if (value.indexOf('data:') === 0 || value.indexOf('http') === 0 || value.indexOf('/') === 0) {
      zone.style.background = 'url(' + value + ') center/cover no-repeat';
    } else {
      zone.style.background = value;
    }
  }
  /* 读取当前聊天会话背景并应用到传讯页（含 IndexedDB 图片恢复，与外部聊天一致） */
  function applyTransmitBgFromChat(cid) {
    if (!cid) { applyTransmitBg('default'); return; }
    migrateLegacyMtBg(cid);
    var v = Storage.getChatBgCustom(cid);
    if (v === '__idb__') {
      if (window.ChatBgDB) {
        ChatBgDB.get(cid).then(function (img) {
          applyTransmitBg(img && img.indexOf('data:') === 0 ? img : 'default');
        }).catch(function () { applyTransmitBg('default'); });
      } else { applyTransmitBg('default'); }
    } else {
      applyTransmitBg(v);
      // localStorage 仍是默认值时尝试从 IndexedDB 兜底恢复图片背景
      if (window.ChatBgDB && (v === 'default' || !v)) {
        ChatBgDB.get(cid).then(function (img) {
          if (img && img.indexOf('data:') === 0) applyTransmitBg(img);
        }).catch(function () {});
      }
    }
  }
  /* 与外部聊天 showChatBgPicker 同款面板（色板 + 相册 + 取消），渲染在传讯页内 */
  function openBgPicker() {
    var cid = currentChatId();
    if (!cid) { toast('未进入聊天会话，无法设置背景'); return; }
    var cur = Storage.getChatBgCustom(cid);
    var swatches = '';
    MT_BG_COLORS.forEach(function (c) {
      var sel = (cur === c.value) ? ' selected' : '';
      swatches += '<div class="chat-bg-swatch' + sel + '" style="background:' + c.hex
        + '" onclick="MTXApp.applyMtBg(\'' + c.value + '\')"></div>';
    });
    var html = '<div class="chat-bg-overlay" id="mt-bg-overlay" onclick="MTXApp.closeMtBgPicker()">'
      + '<div class="chat-bg-panel" onclick="event.stopPropagation()">'
      + '<div class="chat-bg-title">选择聊天背景</div>'
      + '<div class="chat-bg-options">' + swatches + '</div>'
      + '<div class="chat-bg-custom" onclick="MTXApp.pickMtCustomBg()"><i class="fas fa-image"></i>从相册选择</div>'
      + '<div class="chat-bg-close" onclick="MTXApp.closeMtBgPicker()">取消</div>'
      + '</div></div>';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    ($('page-transmit') || document.body).appendChild(tmp.firstChild);
  }
  function closeMtBgPicker() {
    var el = $('mt-bg-overlay');
    if (el) el.remove();
  }
  /* 与外部 applyChatBg 完全一致的存取逻辑：图片写 IndexedDB、localStorage 存标记 */
  function applyMtBg(value) {
    var cid = currentChatId();
    if (!cid) return;
    Storage.setChatBgCustom(cid, value);
    if (typeof value === 'string' && value.indexOf('data:') === 0) {
      if (window.ChatBgDB) {
        ChatBgDB.set(cid, value).then(function () { Storage.setChatBgCustom(cid, '__idb__'); }).catch(function () {});
      }
    } else {
      if (window.ChatBgDB) ChatBgDB.del(cid).catch(function () {});
    }
    applyTransmitBg(value);
    closeMtBgPicker();
    var names = { 'default': '跟随主题', '#FFE4E1': '暖粉', '#E3F2FD': '浅蓝', '#E8F5E9': '淡绿', '#FFF8E1': '奶油', '#F3E5F5': '薰衣草', '#1a1a2e': '深夜', '#1b2a1b': '墨绿' };
    var label = names[value] || ((value && value.indexOf('data:') === 0) ? '自定义图片' : value);
    toast('聊天背景已设为' + label);
  }
  function pickMtCustomBg() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var raw = e.target.result;
        if (typeof compressImageData === 'function') {
          compressImageData(raw, 1600, 0.9, false).then(function (comp) {
            applyMtBg(comp);
          }).catch(function () { applyMtBg(raw); });
        } else {
          applyMtBg(raw);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /* ============ 通话联动：开启次元镜界前自动挂断进行中的视频 / 语音通话 ============ */
  /* 返回是否发生了自动挂断。通话记录由 chat-panels.js 既有挂断 / 拒接流程统一落库：
     - 通话中（含缩略气泡）→ hangupCall()，落库 status=connected + 实际时长（direction=out）
     - 来电响铃中 → rejectIncomingCall()，落库 status=rejected（direction=in）
     - 仅「呼叫中未接通」沿用既有手动挂断语义：关浮层、不产生通话记录。 */
  function hangupOngoingCall() {
    var incoming = document.getElementById('call-incoming-overlay');
    var active = document.getElementById('call-active-overlay');
    var bubble = document.getElementById('call-mini-bubble');
    if (!incoming && !active && !bubble) return false;
    var hung = false;
    if (incoming && typeof rejectIncomingCall === 'function') {
      try { rejectIncomingCall(); hung = true; } catch (e) {}
    } else if (typeof hangupCall === 'function') {
      // 已接通但计时未满 1 秒时补 1 秒，保证时长记录可落库
      if (typeof _callConnected !== 'undefined' && _callConnected && !_callSeconds) {
        try { _callSeconds = 1; } catch (e) {}
      }
      try { hangupCall(); hung = true; } catch (e) {}
    }
    if (hung) toast('已自动挂断当前通话');
    return hung;
  }

  /* ================= 入口：聊天加号菜单点击 ================= */
  function entryInvite() {
    if (typeof closePlusMenu === 'function') { try { closePlusMenu(); } catch (e) {} }
    var cid = currentChatId();
    if (!cid) { alert('请先进入一个聊天'); return; }
    // 开启次元镜界：若正在进行通话，先自动挂断并保存通话记录
    hangupOngoingCall();
    // 点击后立即弹出邀请弹窗，不再等待镜界引擎握手（避免首次进入时长时间无响应）
    if (typeof isGroupChatId === 'function' && isGroupChatId(cid)) showInviteForGroup(cid);
    else showInviteForSingle(cid);
    // 后台预热镜界引擎；失败不影响邀请弹窗展示，确认邀请时会再次等待并就绪
    ensureFrame(function (ok) {
      if (!ok) { /* 确认邀请时由 openDeckModal 再次兜底握手 */ }
    });
  }

  function showInviteForSingle(cid) {
    var name = partnerNickname() || '对方';
    openOverlay(
      '<div class="mtx-modal">'
      + '<div class="mtx-modal-title">次元镜界 · 传讯</div>'
      + '<div class="mtx-modal-desc">邀请 <b>' + esc(name) + '</b> 进入次元镜界传讯模式。<br>TA会用你选定的牌组，回答你的每一个问题</div>'
      + '<div class="mtx-modal-actions">'
      + '<button class="mtx-btn ghost" onclick="MTXApp.closeOverlay()">取消</button>'
      + '<button class="mtx-btn primary" onclick="MTXApp.confirmInvite(\'' + esc(cid) + '\',\'single\')">发出邀请</button>'
      + '</div></div>'
    );
  }

  function showInviteForGroup(cid) {
    var members = [];
    try {
      var g = getGroupByChatId(cid);
      members = getGroupMembers(g) || [];
    } catch (e) { /* 下方兜底 */ }
    if (!members.length) { alert('该群暂无成员，无法传讯'); return; }
    var listHtml = members.map(function (m, i) {
      return '<div class="mtx-invite-member" data-id="' + esc(m.id) + '">'
        + '<span class="mtx-invite-idx">' + (i + 1) + '</span>'
        + '<span class="mtx-invite-name">' + esc(m.nickname || m.name || '成员') + '</span>'
        + '<span class="mtx-invite-tool">'
        + '<button class="mtx-mini-btn" onclick="MTXApp.moveInviteMember(this,-1)">▲</button>'
        + '<button class="mtx-mini-btn" onclick="MTXApp.moveInviteMember(this,1)">▼</button>'
        + '</span></div>';
    }).join('');
    openOverlay(
      '<div class="mtx-modal mtx-modal-wide">'
      + '<div class="mtx-modal-title">次元镜界 · 群聊传讯</div>'
      + '<div class="mtx-modal-desc">邀请全员进入传讯模式，按下方顺序轮流抽牌回复。</div>'
      + '<div class="mtx-invite-list" id="mtx-invite-list">' + listHtml + '</div>'
      + '<div class="mtx-modal-actions">'
      + '<button class="mtx-btn ghost" onclick="MTXApp.closeOverlay()">取消</button>'
      + '<button class="mtx-btn primary" onclick="MTXApp.confirmInvite(\'' + esc(cid) + '\',\'group\')">邀请全员进入</button>'
      + '</div></div>'
    );
  }

  function moveInviteMember(btn, dir) {
    var row = btn.parentElement.parentElement;
    var list = $('mtx-invite-list');
    if (!list) return;
    var rows = Array.prototype.slice.call(list.children).filter(function (el) { return el.classList.contains('mtx-invite-member'); });
    var idx = rows.indexOf(row);
    var j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    if (dir < 0) list.insertBefore(row, rows[j]);
    else list.insertBefore(rows[j], row);
    refreshInviteIdx(list);
  }
  function refreshInviteIdx(list) {
    var rows = list.querySelectorAll('.mtx-invite-member');
    for (var i = 0; i < rows.length; i++) rows[i].querySelector('.mtx-invite-idx').textContent = (i + 1);
  }

  function confirmInvite(cid, kind) {
    var members = [];
    if (kind === 'single') {
      var pid = cid.indexOf('partner_') === 0 ? cid.slice('partner_'.length) : cid;
      members = [{ id: pid, nickname: partnerNickname() || '对方' }];
    } else {
      var list = $('mtx-invite-list');
      var nameOf = {};
      var rows = list ? Array.prototype.slice.call(list.children).filter(function (el) { return el.classList.contains('mtx-invite-member'); }) : [];
      try {
        var g = getGroupByChatId(cid);
        var gms = getGroupMembers(g) || [];
        for (var i = 0; i < gms.length; i++) nameOf[gms[i].id] = gms[i].nickname || gms[i].name || '成员';
      } catch (e) { /* 保持默认昵称 */ }
      rows.forEach(function (r) {
        var id = r.getAttribute('data-id');
        members.push({ id: id, nickname: nameOf[id] || '成员' });
      });
    }
    if (!members.length) return;
    // 等待同意（模拟对方进入）
    var grey = kind === 'single';
    var waitHtml = '<div class="mtx-modal mtx-wait">'
      + '<div class="mtx-wait-spinner"></div>'
      + '<div class="mtx-wait-text">正在等待' + (grey ? '对方同意…' : '全员同意…') + '</div>'
      + '<div class="mtx-wait-sub">对方进入传讯界面后即可开始提问</div>'
      + '<button class="mtx-btn ghost" onclick="MTXApp.closeOverlay()">取消传讯</button>'
      + '</div>';
    openOverlay(waitHtml);
    var delay = grey ? randInt(1500, 2400) : randInt(2200, 3600);
    setTimeout(function () {
      if (!$('mtx-overlay')) return;
      startSession(cid, kind, members);
    }, delay);
  }

  /* ================= 进入传讯会话 ================= */
  function startSession(cid, kind, members) {
    var targetName = kind === 'single' ? (members[0] && members[0].nickname) || '对方' : '';
    if (kind === 'group') {
      try {
        var g = getGroupByChatId(cid);
        targetName = g ? (g.name || '群聊') : '群聊';
      } catch (e) { targetName = '群聊'; }
    }
    session = {
      id: 'mtx_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      kind: kind,
      chatId: cid,
      targetName: targetName,
      members: members,
      deckSetting: null,
      created: Date.now(),
      ended: 0,
      items: []
    };
    questionActive = false;
    pauseWorld();
    saveSession();
    startFlushTimer(); // 进行中会话每 4s 兜底落库
    closeOverlay();
    navigate('transmit');
    appendSystem('已进入镜界传讯，与 ' + targetName + ' 的世界已接通。传讯期间，此处之外的景象暂时静止。');
    resetInputState();
    setTimeout(function () { openDeckModal(); }, 350);
  }

  function resetInputState() {
    var inp = $('mtx-input');
    if (inp) {
      inp.disabled = false;
      inp.placeholder = session && session.deckSetting ? '向 TA 发问…' : '请先设置本次传讯牌组';
    }
    var sb = $('mtx-send-btn');
    if (sb) sb.style.display = '';
    questionActive = false;
  }

  /* ================= 持久化（双层：localStorage 同步镜像 + IndexedDB 权威兜底） =================
   * 历史 bug（GitHub 部署后移动端）：记录只直写 localStorage，手机端配额（约 5MB）被内联牌图
   * 占满后 setItem 抛错被静默吞掉 → 单个角色只存下最先的 4 轮、新增角色记录完全不落库。
   * 现方案（四道保险，确保「每轮都保存」）：
   *  1. 每个可落库动作（发问 / 每位成员出牌 / 牌组确认 / 每轮收尾 / 结束传讯）都立即 saveSession，
   *     且会话与索引同写，回看列表不会漏轮次；
   *  2. 写入统一走 Storage.set：localStorage 镜像 + AppKVDB(IndexedDB) 权威层（无 5MB 限制，
   *     配额告急自动腾挪），同时保留 legacy 键（mtx_session_* / mtx_index）兼容历史数据；
   *  3. 读取走 Storage.get，本地镜像缺失（清缓存 / 配额超限 / 换设备）时异步从 IndexedDB 兜底恢复；
   *  4. 进行中的会话每 4s 定时落库 + pagehide / visibilitychange / beforeunload 同步 flush，
   *     保证关闭浏览器窗口或切后台被强杀时，已进行的每一轮记录都已写入「时空回响」。
   */
  var SESSION_PREFIX = K + 'session_';
  var INDEX_KEY = K + 'index';
  var quotaToastShown = false;
  var flushTimer = null;

  function hasStore() {
    return typeof window.Storage !== 'undefined' && !!window.Storage && typeof Storage.set === 'function';
  }

  /* 同步读取：Storage（内存缓存/localStorage 镜像）优先，再兜底 legacy localStorage 键 */
  function readLocal(key) {
    var v = null;
    if (hasStore()) { try { v = Storage.get(key, null); } catch (e) { v = null; } }
    if (v == null) {
      try {
        var raw = localStorage.getItem(key);
        if (raw) v = JSON.parse(raw);
      } catch (e) { v = null; }
    }
    return v;
  }

  /* 双层写入：localStorage 同步镜像 + IndexedDB 权威层；localStorage 失败只告警不中断 */
  function writeLocal(key, value) {
    var lsOk = false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      lsOk = true;
    } catch (e) { lsOk = false; }
    if (hasStore()) { try { Storage.set(key, value); } catch (e) { /* IDB 写入失败不影响当前会话 */ } }
    if (!lsOk && !quotaToastShown) {
      quotaToastShown = true;
      toast('本地存储空间不足，镜界记录已转存至内置数据库保存');
    }
    return lsOk;
  }

  function removeLocal(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    if (hasStore() && typeof Storage.remove === 'function') { try { Storage.remove(key); } catch (e) {} }
  }

  function sessionKey(id) { return SESSION_PREFIX + id; }
  function countQ(s) {
    s = s || session;
    if (!s || !s.items) return 0;
    return s.items.filter(function (i) { return i.type === 'q'; }).length;
  }

  /* 读取会话：本地命中直接返回；本地缺失（清缓存/配额超限）时异步从 IndexedDB 兜底恢复 */
  function loadSession(id, onRestored) {
    var key = sessionKey(id);
    var s = readLocal(key);
    if (s) return s;
    if (hasStore() && typeof Storage.getAsync === 'function') {
      Storage.getAsync(key, null).then(function (v) {
        if (typeof onRestored === 'function') { try { onRestored(v || null); } catch (e) {} }
      }).catch(function () {
        if (typeof onRestored === 'function') { try { onRestored(null); } catch (e) {} }
      });
    } else if (typeof onRestored === 'function') {
      onRestored(null);
    }
    return null;
  }

  /* 读取索引：本地为空时异步从 IndexedDB 兜底恢复（onRestored 收到恢复后的索引） */
  function loadIndex(onRestored) {
    var idx = readLocal(INDEX_KEY);
    if (!Array.isArray(idx)) idx = [];
    if (!idx.length && hasStore() && typeof Storage.getAsync === 'function') {
      Storage.getAsync(INDEX_KEY, null).then(function (v) {
        if (Array.isArray(v) && v.length && typeof onRestored === 'function') { try { onRestored(v); } catch (e) {} }
      }).catch(function () {});
    }
    return idx;
  }

  function updateIndex(extra) {
    if (!session) return;
    var idx = loadIndex();
    var entry = {
      id: session.id, kind: session.kind, chatId: session.chatId,
      targetName: session.targetName, created: session.created,
      ended: session.ended, qCount: Math.max(0, countQ(session))
    };
    for (var k in extra) if (extra.hasOwnProperty(k)) entry[k] = extra[k];
    var found = false;
    for (var i = 0; i < idx.length; i++) {
      if (idx[i].id === session.id) { idx[i] = entry; found = true; break; }
    }
    if (!found) idx.push(entry);
    idx.sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
    writeLocal(INDEX_KEY, idx);
  }

  function saveSession() {
    if (!session) return;
    writeLocal(sessionKey(session.id), session);
    updateIndex(); // 会话与索引同步落库，避免只写会话导致回看列表缺轮次
  }

  /* ================= 落库兜底：定时保存 + 关窗/切后台同步 flush ================= */
  function startFlushTimer() {
    stopFlushTimer();
    flushTimer = setInterval(function () {
      // 手机端被系统回收/强杀时，靠这一定时兜底保住最近一轮
      if (session && session.items && session.items.length) saveSession();
    }, 4000);
  }
  function stopFlushTimer() {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  }
  function flushSession() {
    if (!session) return;
    try { saveSession(); } catch (e) {}
    if (hasStore() && typeof Storage.flush === 'function') { try { Storage.flush(); } catch (e) {} }
  }
  /* 关闭窗口 / 切后台 / 页面隐藏：立即把进行中的会话与索引写入本地 + IndexedDB */
  window.addEventListener('pagehide', flushSession);
  window.addEventListener('beforeunload', flushSession);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushSession();
  });
  /* 清理某轮会话引用的 ChatMedia 大图（IndexedDB），避免删除记录后媒体残留 */
  function cleanupSessionMedia(s) {
    if (!s || typeof ChatMedia === 'undefined' || !ChatMedia.isRef || !ChatMedia.refKey || !window.ChatImageDB) return;
    var keys = [];
    (s.items || []).forEach(function (item) {
      if (!item) return;
      if (typeof item.image === 'string' && ChatMedia.isRef(item.image)) keys.push(ChatMedia.refKey(item.image));
      if (item.cards && item.cards.length) {
        item.cards.forEach(function (c) {
          if (c && typeof c.image === 'string' && ChatMedia.isRef(c.image)) keys.push(ChatMedia.refKey(c.image));
        });
      }
    });
    var unique = {};
    keys.forEach(function (k) { unique[k] = true; });
    Object.keys(unique).forEach(function (k) {
      try { ChatImageDB.del(k).catch(function () {}); } catch (e) {}
    });
  }
  function deleteSession(id) {
    // 本地镜像 + IndexedDB 双向清除；本地无记录时异步取回后再清理其引用的大图
    var s = loadSession(id, function (restored) { if (restored) cleanupSessionMedia(restored); });
    cleanupSessionMedia(s);
    removeLocal(sessionKey(id));
    try {
      var idx = loadIndex().filter(function (e) { return e.id !== id; });
      writeLocal(INDEX_KEY, idx);
    } catch (e) {}
  }

  /* ================= 传讯页渲染 ================= */
  function onTransmitPage() {
    msgEl = $('mtx-messages');
    applyTransmitBgFromChat(currentChatId());
    if (session && session.items) renderAllItems();
    scrollBottom();
    resetInputState();
  }

  function scrollBottom() {
    var box = $('mtx-scroll');
    if (box) { try { box.scrollTop = box.scrollHeight; } catch (e) {} }
  }

  function appendSystem(text) {
    if (!msgEl) return;
    msgEl.insertAdjacentHTML('beforeend', '<div class="mt-x-row system"><div class="mt-system">' + esc(text) + '</div></div>');
    scrollBottom();
  }
  function removeLastSystem() {
    if (!msgEl) return;
    var rows = msgEl.querySelectorAll('.mt-x-row.system');
    if (rows.length) rows[rows.length - 1].remove();
  }

  /* 头像：优先复用全局 _buildMessageAvatar（含形状/头像图片），否则降级为字母块 */
  function _avatarHtml(profile, fallbackName) {
    if (profile && typeof _buildMessageAvatar === 'function') {
      try { return _buildMessageAvatar(profile); } catch (e) { /* 降级 */ }
    }
    var ch = String(fallbackName || (profile && profile.nickname) || '?').charAt(0);
    var color = profile && profile.avatarColor ? profile.avatarColor : '#A090B0';
    if (profile && profile.avatarImage) {
      return '<div class="message-avatar" style="background:' + color + ';background-image:url(' + profile.avatarImage + ');background-size:cover;background-position:center">' + esc(ch) + '</div>';
    }
    return '<div class="message-avatar" style="background:' + color + '">' + esc(ch) + '</div>';
  }
  function myAvatarHtml() {
    try { return _avatarHtml(Storage.getMyProfile(), '我'); } catch (e) { return _avatarHtml(null, '我'); }
  }
  function avatarForPartner(partnerId, fallbackName) {
    try {
      var partners = Storage.getPartnerProfiles() || [];
      var ids = [partnerId];
      if (partnerId && partnerId.indexOf('partner_') === 0) ids.push(partnerId.slice('partner_'.length));
      for (var i = 0; i < partners.length; i++) {
        for (var k = 0; k < ids.length; k++) {
          if (partners[i].id === ids[k]) return _avatarHtml(partners[i], fallbackName);
        }
      }
    } catch (e) { /* 兜底 */ }
    return _avatarHtml(null, fallbackName || 'TA');
  }
  function memberAvatarHtml(member) {
    if (!member) return _avatarHtml(null, 'TA');
    if (member.id === 'me') return myAvatarHtml();
    return avatarForPartner(member.id, member.nickname || 'TA');
  }

  /* 气泡商城：复用主聊天同一套指派逻辑（self→我方 / fromId→对方角色），无指派返回 null 走默认气泡。
     临时接管 _chatCurrentPartnerId 确保按传讯对象取指派，结束后恢复主聊天状态。 */
  function mtBubbleExtFor(isSelf, partnerId) {
    try {
      if (!window.BubbleMaker || typeof BubbleMaker.buildBubbleExt !== 'function') return null;
      var prev = window._chatCurrentPartnerId;
      if (!isSelf && partnerId) window._chatCurrentPartnerId = partnerId;
      var ext;
      try {
        ext = BubbleMaker.buildBubbleExt({ fromId: partnerId || '' }, isSelf);
      } finally {
        window._chatCurrentPartnerId = prev;
      }
      return ext;
    } catch (e) { return null; }
  }

  /* 我方消息：复用全局 .message-row.self / .message-bubble.self 气泡（含头部头像）；气泡商城指派 self 时应用指定样式 */
  function buildSelfBubble(rText, t) {
    var time = t || Date.now();
    var bubExt = mtBubbleExtFor(true, '');
    var bubCls = bubExt ? (bubExt.extraCls || '') : '';
    var bubDeco = bubExt ? (bubExt.deco || '') : '';
    return '<div class="message-row self" data-msg-id="' + time + '">'
      + myAvatarHtml()
      + '<div class="message-body">'
      + '<div class="message-bubble self' + bubCls + '">' + bubDeco + '<div class="bubble-text">' + esc(rText) + '</div></div>'
      + '<div class="message-meta"><div class="message-time">' + fmtTime(time) + '</div></div>'
      + '</div></div>';
  }
  function appendSelf(rText, t) {
    if (!msgEl) return;
    msgEl.insertAdjacentHTML('beforeend', buildSelfBubble(rText, t));
    scrollBottom();
  }

  /* 对方牌消息：复用全局 .message-row.other / .message-bubble.other 气泡。
     气泡内 .mt-cards 为横排卡带（flex + overflow-x auto），多牌时气泡内左右滑动查看。
     正/逆位标签显隐与传讯会话"开启正逆位"开关联动：
     优先取 hand.reversedEnabled（finishHand 落库时的开关快照，保证回看与实时一致），
     未携带时回退到当前会话 deckSetting.reversed；均无则保持默认显示。 */
  function buildHandBubbleHtml(hand) {
    var name = hand.nickname || 'TA';
    var q = hand.question || '';
    var showOrient = hand.reversedEnabled !== undefined
      ? !!hand.reversedEnabled
      : (session && session.deckSetting ? !!session.deckSetting.reversed : true);
    var cardsHtml = '';
    (hand.cards || []).forEach(function (c) {
      var src = { src: c.image, ref: '' };
      if (typeof ChatMedia !== 'undefined' && ChatMedia.imgSrcFor) src = ChatMedia.imgSrcFor(c.image);
      cardsHtml += '<div class="mt-card">'
        + '<div class="mt-card-img-wrap">'
        + '<img src="' + src.src + '"' + (src.ref ? ' data-media-ref="' + src.ref + '"' : '') + ' class="mt-card-img" alt="' + esc(c.name || '牌') + '"/>'
        + (showOrient ? '<span class="mt-card-orient' + (c.reversed ? ' rev' : ' up') + '">' + (c.reversed ? '逆位' : '正位') + '</span>' : '')
        + '</div></div>';
    });
    var time = hand.time || Date.now();
    var bubExt = mtBubbleExtFor(false, hand.fromId);
    var bubCls = bubExt ? (bubExt.extraCls || '') : '';
    var bubDeco = bubExt ? (bubExt.deco || '') : '';
    return '<div class="message-row other" data-msg-id="' + time + '">'
      + avatarForPartner(hand.fromId, name)
      + '<div class="message-body">'
      + '<div class="message-sender-name">' + esc(name) + ' · 镜界传讯</div>'
      + '<div class="message-bubble other' + bubCls + '">' + bubDeco + '<div class="bubble-text">'
      + (q ? '<div class="mt-msg-q">问 · ' + esc(q) + '</div>' : '')
      + '<div class="mt-cards">' + cardsHtml + '</div>'
      + '</div></div>'
      + '<div class="message-meta"><div class="message-time">' + fmtTime(time) + '</div></div>'
      + '</div></div>';
  }
  function renderHandBubble(hand) {
    return buildHandBubbleHtml(hand);
  }

  function resolveMediaIn(el, done) {
    if (el && typeof ChatMedia !== 'undefined' && ChatMedia.resolveDomRefs) {
      ChatMedia.resolveDomRefs(el, done || function () {});
    } else if (done) done();
  }
  function renderItemDom(item) {
    if (!msgEl) return;
    if (item.type === 'system') { appendSystem(item.text); return; }
    if (item.type === 'q') { appendSelf(item.text, item.time); return; }
    if (item.type === 'cards') {
      msgEl.insertAdjacentHTML('beforeend', renderHandBubble(item));
      resolveMediaIn(msgEl.lastElementChild, function () { scrollBottom(); });
    }
  }

  function renderAllItems() {
    if (!msgEl || !session) return;
    msgEl.innerHTML = '';
    (session.items || []).forEach(function (item) {
      if (item.type === 'system') appendSystem(item.text);
      else if (item.type === 'q') appendSelf(item.text, item.time);
      else if (item.type === 'cards') {
        msgEl.insertAdjacentHTML('beforeend', buildHandBubbleHtml(item));
        resolveMediaIn(msgEl.lastElementChild, function () { scrollBottom(); });
      }
    });
    scrollBottom();
  }

  /* ================= 牌组设置弹窗 ================= */
  function openDeckModal() {
    if (!$('mtx-overlay')) {
      ensureFrame(function (ok) {
        if (!ok) return;
        refreshMeta(function () { doOpenDeckModal(); });
      });
    } else {
      refreshMeta(function () { doOpenDeckModal(); });
    }
  }
  function doOpenDeckModal() {
    var prevMain = session && session.deckSetting ? session.deckSetting.mainDeckId : null;
    var decksHtml = !store.decks.length
      ? '<div class="mtx-empty">暂无可用牌组</div>'
      : store.decks.map(function (d) {
        return '<label class="mtx-deck-opt" data-id="' + esc(d.id) + '"><input type="radio" name="mtx-deck-main" value="' + esc(d.id) + '"'
          + (prevMain === d.id ? ' checked' : '') + '><span class="mtx-deck-name">' + esc(d.name) + '</span><span class="mtx-deck-en">' + esc(d.nameEn || '') + '</span></label>';
      }).join('');
    var spreadsHtml = '<label class="mtx-spread-opt" data-id="random"><input type="radio" name="mtx-spread" value="random" checked><span>随机 3-6 张</span></label>';
    if (store.spreads.length) {
      spreadsHtml += store.spreads.map(function (s) {
        var cc = s.positions && s.positions.length ? s.positions.length : (s.cardCount || 0);
        return '<label class="mtx-spread-opt" data-id="' + esc(s.id) + '"><input type="radio" name="mtx-spread" value="' + esc(s.id) + '"><span>' + esc(s.name) + '</span><span class="mtx-spread-count">' + (cc ? cc + ' 张' : '') + '</span></label>';
      }).join('');
    }
    openOverlay(
      '<div class="mtx-modal mtx-modal-wide mtx-deck-modal">'
      + '<div class="mtx-modal-title">设置本次传讯牌组</div>'
      + '<div class="mtx-field"><div class="mtx-field-label">选择牌组</div><div class="mtx-deck-grid" id="mtx-deck-main">' + decksHtml + '</div></div>'
      + '<div class="mtx-field"><div class="mtx-field-label">牌阵</div><div class="mtx-spread-grid" id="mtx-spread-grid">' + spreadsHtml + '</div></div>'
      + '<div class="mtx-field mtx-rev-field"><label class="mtx-rev"><input type="checkbox" id="mtx-reversed" checked><span>开启正逆位解读</span></label></div>'
      + '<div class="mtx-modal-actions">'
      + '<button class="mtx-btn ghost" onclick="MTXApp.closeOverlay()">取消</button>'
      + '<button class="mtx-btn primary" onclick="MTXApp.confirmDeck()">确认 · 开始传讯</button>'
      + '</div></div>'
    );
  }

  function deckLabel(id) {
    for (var i = 0; i < store.decks.length; i++) if (store.decks[i].id === id) return store.decks[i].name;
    return id;
  }

  function confirmDeck() {
    var mainSel = document.querySelector('#mtx-deck-main input:checked');
    if (!mainSel) { alert('请选择一个牌组'); return; }
    var mainDeckId = mainSel.value;
    var subDeckId = null;
    var spreadSel = document.querySelector('input[name="mtx-spread"]:checked');
    var spread = spreadSel ? { id: spreadSel.value, name: '' } : { id: 'random', name: '随机 3-6 张' };
    if (spread.id !== 'random') {
      for (var i = 0; i < store.spreads.length; i++) if (store.spreads[i].id === spread.id) spread = store.spreads[i];
    }
    var reversedBox = $('mtx-reversed');
    var reversed = !reversedBox || reversedBox.checked;
    if (!session) return;
    session.deckSetting = {
      mode: 'single',
      mainDeckId: mainDeckId, mainDeckName: deckLabel(mainDeckId),
      subDeckId: subDeckId, subDeckName: subDeckId ? deckLabel(subDeckId) : null,
      spreadId: spread.id, spreadName: spread.name,
      spreadCount: spread.positions ? spread.positions.length : (spread.cardCount || 0),
      positions: spread.positions || [],
      reversed: reversed
    };
    saveSession();
    closeOverlay();
    var settingText = '本次传讯牌组已确定：「' + session.deckSetting.mainDeckName + '」' + settingSpreadText() + (reversed ? '，含正逆位' : '');
    appendSystem(settingText);
    session.items.push({ type: 'system', text: settingText, time: Date.now() });
    saveSession();
    resetInputState();
    scrollBottom();
  }

  function settingSpreadText() {
    if (!session || !session.deckSetting) return '';
    var st = session.deckSetting;
    if (st.spreadId === 'random') return '，随机 3-6 张';
    return '，' + (st.spreadName || '') + ' 牌阵';
  }

  /* ================= 发送问题 ================= */
  /* ================= 洗牌抽牌动画 =================
   * 仅在「发问成功 → 对方回答牌面之前」的实时等待阶段播放；
   * 动画消息行不入 session.items / 不入库，时空回响回看直接渲染记录、不播放动画。
   * 动画有兜底：SHUFFLE_TIMEOUT_MS（约 6s）内强制进入出牌渲染，即使 draw RPC
   * 尚未返回也按原逻辑处理（answersInOrder 内部自带 RPC 超时，不会卡死）。 */
  function buildShuffleRowHtml() {
    var cards = '';
    for (var i = 0; i < SHUFFLE_CARD_COUNT; i++) cards += '<span class="mt-shuffle-card"></span>';
    var m = session && session.members && session.members[0] ? session.members[0] : null;
    var name = m && m.nickname ? m.nickname : 'TA';
    return '<div class="message-row other mt-shuffle-row">'
      + avatarForPartner(m ? m.id : 0, name)
      + '<div class="message-body">'
      + '<div class="message-sender-name">' + esc(name) + ' · 镜界传讯</div>'
      + '<div class="message-bubble other"><div class="mt-shuffle">'
      + '<div class="mt-shuffle-cards">' + cards + '</div>'
      + '<div class="mt-shuffle-text">' + esc(SHUFFLE_TEXTS[0]) + '</div>'
      + '</div></div></div></div>';
  }

  function appendShuffleAnim() {
    if (!msgEl) return null;
    var wrap = document.createElement('div');
    wrap.innerHTML = buildShuffleRowHtml();
    var row = wrap.firstElementChild;
    msgEl.appendChild(row);
    scrollBottom();
    return row;
  }

  function removeShuffleAnim(row) {
    if (row && row.parentNode) row.parentNode.removeChild(row);
    if (shuffleAnimRow === row) shuffleAnimRow = null;
    scrollBottom();
  }

  function setShuffleText(row, text) {
    var t = row && row.querySelector('.mt-shuffle-text');
    if (t) t.textContent = text;
  }

  function startShuffleAnim(done) {
    // 防御：清理上一轮残留
    if (shuffleAnimRow) removeShuffleAnim(shuffleAnimRow);
    if (shuffleAnimTimers) {
      shuffleAnimTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      shuffleAnimTimers = null;
    }
    var row = appendShuffleAnim();
    if (!row) {
      if (typeof done === 'function') { try { done(); } catch (e) { console.error('[mtx-shuffle]', e); } }
      return;
    }
    var finished = false;
    var timers = [];
    var finish = function () {
      if (finished) return;
      finished = true;
      timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      timers = [];
      shuffleAnimTimers = null;
      row.classList.add('mt-shuffle-done');
      setTimeout(function () { // 淡出后移除动画行并进入出牌渲染
        removeShuffleAnim(row);
        if (typeof done === 'function') { try { done(); } catch (e) { console.error('[mtx-shuffle]', e); } }
      }, 340);
    };
    // 阶段推进：洗牌 → 聚拢抽牌 → 亮出牌面，同步切换思考文案
    var phase = 0;
    var phaseTimer = setInterval(function () {
      phase++;
      if (phase === 1) { row.classList.add('phase-draw'); setShuffleText(row, SHUFFLE_TEXTS[1]); }
      else if (phase === 2) { row.classList.add('phase-reveal'); setShuffleText(row, SHUFFLE_TEXTS[2]); clearInterval(phaseTimer); }
    }, SHUFFLE_PHASE_MS);
    var mainTimer = setTimeout(finish, SHUFFLE_ANIM_MS);       // 动画自然结束
    var guardTimer = setTimeout(finish, SHUFFLE_TIMEOUT_MS);   // 兜底强制结束
    timers = [phaseTimer, mainTimer, guardTimer];
    shuffleAnimTimers = timers;
    shuffleAnimRow = row;
  }

  function sendText() {
    if (!session) return;
    var inp = $('mtx-input');
    var text = inp ? inp.value.trim() : '';
    if (!text) return;
    if (questionActive) return;
    if (!session.deckSetting) { appendSystem('请先设置本次传讯牌组。'); openDeckModal(); return; }
    questionActive = true;
    if (inp) inp.value = '';
    if (typeof onChatInputChange === 'function') { try { onChatInputChange(); } catch (e) {} }
    // 本题抽牌数
    var st = session.deckSetting;
    if (st.spreadId === 'random') {
      pendingCount = randInt(3, 6);
    } else if (st.spreadCount && st.spreadCount > 0) {
      pendingCount = st.spreadCount;
    } else {
      pendingCount = 3;
    }
    pendingPositions = (st.positions || []).slice(0, pendingCount);
    session.items.push({ type: 'q', text: text, time: Date.now() });
    saveSession();
    appendSelf(text);
    scrollBottom();
    setInputBusy();
    // 发问成功后先播放洗牌抽牌动画（思考过程展示），动画结束再进入逐位成员出牌渲染；
    // 动画本身有 SHUFFLE_TIMEOUT_MS 兜底，draw RPC 未返回也按原逻辑处理，不会卡死。
    startShuffleAnim(function () {
      answersInOrder(0, text);
    });
  }

  function setInputBusy() {
    var inp = $('mtx-input');
    if (inp) { inp.disabled = true; inp.placeholder = 'TA 正在传讯回复…'; }
    var sb = $('mtx-send-btn');
    if (sb) sb.style.display = 'none';
  }

  /* 按成员顺序逐位抽牌；一位完成后间隔片刻进入下一位 */
  function answersInOrder(idx, q) {
    if (!session) return;
    if (idx >= session.members.length) { afterAllReplies(q); return; }
    var m = session.members[idx];
    drawForMember(m, pendingCount, q, function (hand) {
      if (!hand) { // 抽牌失败：跳过该成员继续
        setTimeout(function () { answersInOrder(idx + 1, q); }, 300);
        return;
      }
      session.items.push(hand);
      saveSession();
      renderItemDom(hand);
      setTimeout(function () { answersInOrder(idx + 1, q); }, randInt(500, 900));
    });
  }

  function drawForMember(m, count, q, cb) {
    if (!session || !session.deckSetting) { cb(null); return; }
    var st = session.deckSetting;
    rpcDraw(st.mainDeckId, count, st.reversed, pendingPositions.slice(0, count), function (cards, err) {
      if (!cards) { cb(null); return; }
      finishHand(cards, m, q, cb);
    });
  }

  var mtxHandSeq = 0; // 每次落库的牌手牌唯一序号，保证多轮/多成员抽取的 IDB key 不互相覆盖
  /* 牌图强制转引用落库：ChatMedia.storeForMessage 只在超过 50KB 阈值时才转引用，小牌图会被
     内联进会话 JSON，几十张牌就把 localStorage 配额吃满（历史"只存 4 条"根因）。
     这里无条件把 base64 牌图写入 ChatImageDB，会话只保留轻量引用。 */
  function storeCardImage(data, key) {
    if (!data || String(data).indexOf('data:') !== 0) return Promise.resolve(data);
    if (typeof ChatImageDB === 'undefined' || typeof ChatMedia === 'undefined' || !ChatMedia.makeRef) return Promise.resolve(data);
    if (ChatMedia.isRef && ChatMedia.isRef(data)) return Promise.resolve(data);
    return new Promise(function (resolve) {
      ChatImageDB.set(key, data).then(function () {
        resolve(ChatMedia.makeRef(key));
      }).catch(function () {
        resolve(data); // IDB 不可用：回退内联，保证牌面不丢
      });
    });
  }
  function finishHand(cards, m, q, cb) {
    if (!cards || !cards.length) { cb(null); return; }
    var handSeq = ++mtxHandSeq;
    // 图片落库为引用，减小会话体积（保证 localStorage 不被内联图撑爆）
    var jobs = cards.map(function (c, i) {
      if (c && c.image) {
        return storeCardImage(c.image, 'mtx_' + session.id + '_' + handSeq + '_' + i).then(function (ref) { c.image = ref; return c; });
      }
      return Promise.resolve(c);
    });
    Promise.all(jobs).then(function (stored) {
      cb({
        type: 'cards', time: Date.now(),
        fromId: m.id, nickname: m.nickname || '成员',
        question: q,
        // 正逆位开关快照：随消息落库，回看渲染与实时传讯保持一致（开关关闭时不再渲染正/逆位标签）
        reversedEnabled: !!(session && session.deckSetting && session.deckSetting.reversed),
        deckSettingSnapshot: {
          mainDeckName: session.deckSetting.mainDeckName,
          subDeckName: session.deckSetting.subDeckName,
          mode: session.deckSetting.mode
        },
        cards: stored
      });
    });
  }

  function afterAllReplies(q) {
    questionActive = false;
    appendSystem('本题传讯结果已揭晓，你可以继续发问。');
    resetInputState();
    saveSession(); // 每轮（发问 + 全部成员出牌）结束即整体落库，确保轮次完整
  }

  /* ================= 结束传讯 ================= */
  function endTransmit() {
    if (!session) return;
    var name = session.targetName || '对方';
    openOverlay(
      '<div class="mtx-modal">'
      + '<div class="mtx-modal-title">结束本次传讯？</div>'
      + '<div class="mtx-modal-desc">本次与 ' + esc(name) + ' 的传讯记录将保存至发现页「时空回响」中，随时可以回看。</div>'
      + '<div class="mtx-modal-actions">'
      + '<button class="mtx-btn ghost" onclick="MTXApp.closeOverlay()">继续传讯</button>'
      + '<button class="mtx-btn primary" onclick="MTXApp.doEndTransmit()">结束并保存</button>'
      + '</div></div>'
    );
  }

  function doEndTransmit() {
    if (!session) return;
    session.ended = Date.now();
    session.items.push({ type: 'system', text: '传讯结束，本次对话已封存至「时空回响」。', time: Date.now() });
    saveSession(); // 会话 + 索引双写（localStorage 镜像 + IndexedDB 权威层）
    updateIndex({ ended: session.ended, qCount: countQ(session), done: 1 });
    if (hasStore() && typeof Storage.flush === 'function') { try { Storage.flush(); } catch (e) {} }
    stopFlushTimer();
    resumeWorld();
    session = null;
    questionActive = false;
    closeOverlay();
    goBack();
  }

  /* ================= 时空回响（三级回看） ================= */
  function openEchoPage() {
    var box = $('mtx-echo-sessions');
    if (!box) return;
    box.innerHTML = '';
    var paint = function (idx) {
      // 兜底：已结束的会话 + 已有轮次但未正常结束的会话（关窗/断线中断）一并展示，避免记录"凭空消失"
      var list = (idx || []).filter(function (e) { return e.ended || e.qCount > 0; });
      var single = [], group = [];
      list.forEach(function (e) { (e.kind === 'group' ? group : single).push(e); });
      var html = renderEchoSection('单聊传讯', single, 'single') + renderEchoSection('群聊传讯', group, 'group');
      if (!html) box.innerHTML = '<div class="mtx-empty-page">暂无传讯记录。<br>进入聊天加号菜单，发起一次「次元镜界」传讯吧。</div>';
      else box.innerHTML = html;
    };
    paint(loadIndex(paint)); // 索引本地为空时由 IndexedDB 兜底恢复后自动重渲染
  }

  function renderEchoSection(title, list, kind) {
    if (!list.length) return '';
    var seen = [];
    var items = '';
    list.forEach(function (e) {
      var key = kind + '|' + (e.targetName || '未知');
      if (seen.indexOf(key) !== -1) return;
      seen.push(key);
      var count = list.filter(function (x) { return (kind + '|' + x.targetName) === key; }).length;
      items += '<div class="mtx-echo-target" onclick="MTXApp.openEchoTarget(\'' + kind + '\',\'' + esc(e.targetName || '未知') + '\')">'
        + '<div class="mtx-echo-avatar">' + echoAvatarHtml(kind, e.targetName || '未知') + '</div>'
        + '<div class="mtx-echo-info">'
        + '<div class="mtx-echo-name">' + esc(e.targetName || '未知') + '</div>'
        + '<div class="mtx-echo-sub">' + count + ' 轮传讯 · 最近 ' + fmtTimeFull(e.created) + '</div>'
        + '</div><i class="fas fa-chevron-right mtx-echo-arrow"></i></div>';
    });
    return '<div class="mtx-echo-sec-title">' + title + '</div>' + items;
  }

  // 时空回响头像：按传讯对象名匹配角色资料，优先显示设置的头像；群聊固定「群」
  function findEchoPartnerByName(name) {
    if (!name) return null;
    var partners = [];
    try { partners = Storage.getPartnerProfiles() || []; } catch (e) {}
    for (var i = 0; i < partners.length; i++) {
      var p = partners[i];
      if (p && (p.nickname === name || p.name === name)) return p;
    }
    return null;
  }

  function echoAvatarHtml(kind, name) {
    if (kind === 'group') return '群';
    var p = findEchoPartnerByName(name);
    var colorStyle = (p && p.avatarColor) ? ' style="background:' + esc(p.avatarColor) + '"' : '';
    if (p && p.avatarImage) {
      return '<img src="' + esc(p.avatarImage) + '" alt="" onerror="this.style.display=\'none\'">';
    }
    var ch = (p && p.avatar) ? String(p.avatar).charAt(0) : String(name || '未').charAt(0);
    return '<span class="mtx-echo-avatar-text"' + colorStyle + '>' + esc(ch) + '</span>';
  }

  function openEchoTarget(kind, targetName) {
    echoView = { kind: kind, targetName: targetName };
    navigate('mt-echo-session-list');
  }

  function renderEchoSessionList() {
    var box = $('mtx-echo-session-list-items');
    if (!box) return;
    box.innerHTML = '';
    if (!echoView) { box.innerHTML = '<div class="mtx-empty-page">暂无记录</div>'; return; }
    var titleEl = $('mtx-echo-partner-title');
    if (titleEl) titleEl.textContent = echoView.kind === 'group' ? (echoView.targetName + ' · 群传讯') : (echoView.targetName + ' · 传讯');
    var paint = function (idx) {
      var list = (idx || []).filter(function (e) {
        return (e.ended || e.qCount > 0) && e.kind === echoView.kind && (e.targetName || '') === echoView.targetName;
      });
      if (!list.length) { box.innerHTML = '<div class="mtx-empty-page">暂无该对象的传讯轮次</div>'; return; }
      var html = '';
      list.forEach(function (e) {
        var s = loadSession(e.id);
        if (!s) {
          // 本地会话缺失（配额受限/清缓存）：异步从 IndexedDB 兜底恢复后重绘本列表
          loadSession(e.id, function (restored) {
            if (!restored) return;
            var latest = loadIndex();
            paint(latest.length ? latest : list);
          });
        }
        var qn = s ? s.items.filter(function (i) { return i.type === 'q'; }).length : (e.qCount || 0);
        var memberCount = s && s.members ? s.members.length : 0;
        html += '<div class="mtx-echo-sess" onclick="MTXApp.openEchoSession(\'' + esc(e.id) + '\')">'
          + '<div class="mtx-echo-sess-left"><i class="fas fa-hourglass-half"></i></div>'
          + '<div class="mtx-echo-sess-info">'
          + '<div class="mtx-echo-sess-title">第 ' + (e.created ? fmtTimeFull(e.created) : '') + ' 轮' + (e.ended ? '' : '「进行中」') + '</div>'
          + '<div class="mtx-echo-sess-sub">' + qn + ' 问 · ' + memberCount + ' 位参与者</div>'
          + '</div>'
          + '<button class="mtx-echo-sess-remove" onclick="event.stopPropagation();MTXApp.deleteEchoSession(\'' + esc(e.id) + '\')" title="删除本轮回响"><i class="fas fa-trash-alt"></i></button>'
          + '<i class="fas fa-chevron-right mtx-echo-arrow"></i></div>';
      });
      box.innerHTML = html;
    };
    paint(loadIndex(paint)); // 索引本地为空时由 IndexedDB 兜底恢复后自动重渲染
  }

  function openEchoSession(id) {
    echoSessionId = id;
    navigate('mt-echo-session');
  }

  function renderEchoSessionPage(s) {
    var play = $('mtx-echo-play');
    if (!play) return;
    play.innerHTML = '';
    if (!echoSessionId) { play.innerHTML = '<div class="mtx-empty-page">记录不存在</div>'; return; }
    var sid = echoSessionId;
    s = s || loadSession(sid);
    if (!s) {
      // 本地会话缺失（配额受限/清缓存）：先从 IndexedDB 兜底恢复，成功后再渲染
      play.innerHTML = '<div class="mtx-empty-page">正在读取记录…</div>';
      loadSession(sid, function (restored) {
        if (echoSessionId !== sid) return;
        if (!restored) { play.innerHTML = '<div class="mtx-empty-page">记录已被删除</div>'; return; }
        renderEchoSessionPage(restored);
      });
      return;
    }
    var titleEl = $('mtx-echo-session-title');
    if (titleEl) titleEl.textContent = '时空回响 · ' + (s.targetName || '');
    var oldMsgEl = msgEl;
    // 临时让渲染写入回看容器：复用消息构建函数需要 msgEl
    msgEl = play;
    (s.items || []).forEach(function (item) {
      if (item.type === 'system') {
        play.insertAdjacentHTML('beforeend', '<div class="mt-x-row system"><div class="mt-system">' + esc(item.text) + '</div></div>');
      } else if (item.type === 'q') {
        play.insertAdjacentHTML('beforeend', buildSelfBubble(item.text, item.time));
      } else if (item.type === 'cards') {
        play.insertAdjacentHTML('beforeend', buildHandBubbleHtml(item));
      }
    });
    resolveMediaIn(play, function () { try { play.scrollTop = play.scrollHeight; } catch (e) {} });
    msgEl = oldMsgEl;
  }

  /* ================= 时空回响删除（持久化清除 + 界面刷新，交互对齐「他的收藏」） ================= */
  function _currentPage() {
    return window.Navigation && Navigation.currentPage ? Navigation.currentPage : '';
  }

  /* 删除单轮时空回响记录：localStorage 索引/会话清除、ChatMedia 大图清理、界面同步刷新 */
  function deleteEchoSession(id) {
    if (!id) return;
    var idx = loadIndex();
    var hit = false;
    for (var i = 0; i < idx.length; i++) {
      if (String(idx[i].id) === String(id)) { hit = true; break; }
    }
    if (!hit) return;
    deleteSession(id);
    if (echoSessionId === id) echoSessionId = null;
    var p = _currentPage();
    if (p === 'mt-echo-session-list') renderEchoSessionList();
    else if (p === 'mt-echo-session') goBack();
    else openEchoPage();
    toast('已删除该轮时空回响');
  }

  /* 三级回看页：删除当前轮次并返回轮次列表 */
  function deleteCurrentEchoSession() {
    if (!echoSessionId) return;
    var s = loadSession(echoSessionId);
    if (!s) { toast('记录不存在'); return; }
    Core.dangerConfirm('删除本轮记录', '确定删除「' + (s.targetName || '未知') + '」这一轮时空回响吗？此操作不可恢复。', function () {
      deleteEchoSession(echoSessionId);
    });
  }

  /* 二级页：清空当前对象（单聊/群聊）的全部传讯轮次 */
  function clearEchoTarget() {
    if (!echoView) return;
    var idx = loadIndex().filter(function (e) {
      return (e.ended || e.qCount > 0) && e.kind === echoView.kind && (e.targetName || '') === echoView.targetName;
    });
    if (!idx.length) { toast('暂无该对象的传讯记录'); return; }
    var label = (echoView.kind === 'group' ? '群聊' : '单聊') + '「' + (echoView.targetName || '未知') + '」';
    Core.dangerConfirm('清空该对象回响', '确定清空 ' + label + ' 的 ' + idx.length + ' 轮时空回响吗？此操作不可恢复。', function () {
      idx.forEach(function (e) { deleteSession(e.id); });
      echoView = null;
      goBack();
    });
  }

  /* 一级页：清空全部时空回响记录 */
  function clearAllEchoes() {
    var idx = loadIndex().filter(function (e) { return e.ended || e.qCount > 0; });
    if (!idx.length) { toast('暂无时空回响记录'); return; }
    Core.dangerConfirm('清空时空回响', '确定清空全部 ' + idx.length + ' 轮时空回响吗？此操作不可恢复。', function () {
      idx.forEach(function (e) { deleteSession(e.id); });
      echoView = null;
      echoSessionId = null;
      var p = _currentPage();
      if (p === 'mt-echo-session-list' || p === 'mt-echo-session') goBack();
      else openEchoPage();
    });
  }

  /* ================= 对外暴露（供 HTML onclick / navigation.js 钩子调用） ================= */
  window.MTXApp = {
    entryInvite: entryInvite,
    hangupOngoingCall: hangupOngoingCall,
    confirmInvite: confirmInvite,
    moveInviteMember: moveInviteMember,
    closeOverlay: closeOverlay,
    confirmDeck: confirmDeck,
    onTransmitPage: onTransmitPage,
    sendText: sendText,
    endTransmit: endTransmit,
    doEndTransmit: doEndTransmit,
    openDeckModal: openDeckModal,
    onEchoPage: openEchoPage,
    openEchoTarget: openEchoTarget,
    openEchoSession: openEchoSession,
    onEchoSessionList: renderEchoSessionList,
    onEchoSessionPage: renderEchoSessionPage,
    deleteEchoSession: deleteEchoSession,
    deleteCurrentEchoSession: deleteCurrentEchoSession,
    clearEchoTarget: clearEchoTarget,
    clearAllEchoes: clearAllEchoes,
    setMtBg: applyMtBg,
    pickMtBg: function (i) { applyMtBg(i && i.getAttribute && i.getAttribute('data-v') || 'default'); },
    openBgPicker: openBgPicker,
    closeMtBgPicker: closeMtBgPicker,
    applyMtBg: applyMtBg,
    pickMtCustomBg: pickMtCustomBg
  };

  /* 兼容性全局（与旧版一致，供外部脚本 / 历史调用点使用） */
  window.MTX_BUILD_CARDS = function (hand) { return buildHandBubbleHtml(hand); };
  window.MTX_ACTIVE = true;
  window.MTX_OPEN = function () { return !!session; };
  window.transmitEntry = entryInvite;
  window.mtxInputKey = function (ev) {
    if (ev && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); MTXApp.sendText(); }
  };

  /* 页面渲染钩子：由 navigation.js 注册调用 */
  window.renderTransmit = function () { MTXApp.onTransmitPage(); };
  window.renderMtEcho = function () { MTXApp.onEchoPage(); };
  window.renderMtEchoSessionList = function () { MTXApp.onEchoSessionList(); };
  window.renderMtEchoSession = function () { MTXApp.onEchoSessionPage(); };

})();
