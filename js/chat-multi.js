/* ============================================================
   拾心界 · 聊天消息多选功能（对标微信）
   - 多选模式：气泡菜单「多选」进入，勾选/取消/全选，批量删除/收藏/转发/退出
   - 转发：复制成独立新消息（新 id/time，type 按目标方向），各类型按调研报告 §七 处理
   - 对方偶尔转发：doAutoReply 低概率分支，从其它会话挑一条真实消息转发过来
   依赖全局：Storage / ChatMedia / RedPacketStorage / Core / updateLastMsg /
   _safeAppendMessage / _safeRenderChat / isGroupChatId / getGroupByChatId /
   getGroupMembers / renderChatMessages / doFavoriteMessage / _buildFavorite /
   Navigation / App 等（均为全局函数，跨文件可直接调用）
   ============================================================ */

/* ---------------- 多选模式状态 ---------------- */
var _multiSelectActive = false;
var _multiSelectChatId = '';
var _multiSelectIds = [];      // 已勾选消息 id（保持勾选顺序）

function isMultiSelectActive() { return _multiSelectActive; }

/* 多选模式下消息区单击委托（capture 阶段提前拦截）：
   在 capture 阶段用 stopPropagation 掐掉消息气泡自身的 click 链路（bindChatTapMenu 弹菜单 /
   redpacket 领取面板 / voice 播放 / 引用跳转），避免被内层 stopPropagation 拦截而漏绑 */
function _multiTapHandler(e) {
  if (!_multiSelectActive) return;
  handleMultiSelectTap(e);
}

function _multiChatIdNow() {
  var room = document.getElementById('page-chat-room');
  return (room && room.dataset.chatId) ? String(room.dataset.chatId) : '';
}

/* 进入多选模式（入口：消息气泡菜单「多选」） */
function enterMultiSelectMode() {
  var chatId = _multiChatIdNow();
  if (!chatId) return;
  // 关闭其它面板，避免冲突
  if (window.closeStickerPanel) { try { closeStickerPanel(); } catch (e) {} }
  if (window.closePlusMenu) { try { closePlusMenu(); } catch (e) {} }
  if (window.closeRedPacketPanel) { try { closeRedPacketPanel(); } catch (e) {} }
  if (window.closeMsgActionMenu) { try { closeMsgActionMenu(); } catch (e) {} }
  _multiSelectActive = true;
  _multiSelectChatId = chatId;
  _multiSelectIds = [];
  var container = document.getElementById('chat-messages');
  if (container) {
    container.classList.add('multi-select-mode');
    // capture 阶段拦截消息区点击（去重，防止重复绑定）
    if (!container.dataset.multiTapBound) {
      container.addEventListener('click', _multiTapHandler, true);
      container.dataset.multiTapBound = '1';
    }
  }
  // 输入区与多选操作条互斥：进入多选时真正隐藏输入区（exitMultiSelectMode 恢复）
  var inputZone = document.querySelector('.chat-input-zone');
  if (inputZone) { inputZone.style.display = 'none'; }
  var bar = document.getElementById('msg-multi-bar');
  if (bar) { bar.style.display = 'flex'; }
  var allBtn = document.getElementById('mmb-all');
  if (allBtn) allBtn.setAttribute('data-all', '0');
  var label = document.getElementById('mmb-all-label');
  if (label) label.textContent = '全选';
  _refreshMultiBar();
}

/* 退出多选模式（清理勾选态与操作条） */
function exitMultiSelectMode() {
  _multiSelectActive = false;
  _multiSelectChatId = '';
  _multiSelectIds = [];
  var container = document.getElementById('chat-messages');
  if (container) container.classList.remove('multi-select-mode');
  var bar = document.getElementById('msg-multi-bar');
  if (bar) bar.style.display = 'none';
  var inputZone = document.querySelector('.chat-input-zone');
  if (inputZone) { inputZone.style.display = ''; }
  var checked = document.querySelectorAll('.message-row.multi-checked');
  for (var i = 0; i < checked.length; i++) checked[i].classList.remove('multi-checked');
  var label = document.getElementById('mmb-all-label');
  if (label) label.textContent = '全选';
}

/* 刷新操作条：计数、按钮可用态、全选态 */
function _refreshMultiBar() {
  var count = _multiSelectIds.length;
  var countEl = document.getElementById('msg-multi-count');
  if (countEl) countEl.textContent = count;
  ['mmb-del', 'mmb-fav', 'mmb-fwd'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.classList.toggle('mmb-disabled', count === 0);
  });
}

/* 勾选/取消勾选某一行 */
function _toggleMultiRow(row) {
  if (!row) return;
  var mid = row.getAttribute('data-msg-id');
  if (!mid) return;
  var idx = _multiSelectIds.indexOf(mid);
  if (idx >= 0) {
    _multiSelectIds.splice(idx, 1);
    row.classList.remove('multi-checked');
  } else {
    row.classList.add('multi-checked');
    _multiSelectIds.push(mid);
  }
  _refreshMultiBar();
}

/* 多选模式下单击消息行：切toggle，拦截原气泡菜单 / 红包面板 / 语音播放 / 引用跳转 */
function handleMultiSelectTap(e) {
  var row = e.target && e.target.closest ? e.target.closest('.message-row') : null;
  if (row) {
    e.preventDefault();
    e.stopPropagation();
    _toggleMultiRow(row);
    return;
  }
  // 非消息行（聊天背景/间隙）点击：保持多选模式，不弹任何菜单
  e.preventDefault();
  e.stopPropagation();
}

/* 全选 / 取消全选 */
function toggleSelectAllMulti() {
  var allEntry = document.getElementById('mmb-all');
  if (!allEntry) return;
  var isAll = allEntry.getAttribute('data-all') === '1';
  var rows = document.querySelectorAll('#chat-messages .message-row');
  if (isAll) {
    // 取消全选
    _multiSelectIds = [];
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('multi-checked');
    allEntry.setAttribute('data-all', '0');
    if (document.getElementById('mmb-all-label')) document.getElementById('mmb-all-label').textContent = '全选';
  } else {
    // 全选（仅 .message-row，系统居中态消息无消息行天然不参与）
    _multiSelectIds = [];
    for (var j = 0; j < rows.length; j++) {
      var mid = rows[j].getAttribute('data-msg-id');
      if (!mid) continue;
      rows[j].classList.add('multi-checked');
      if (_multiSelectIds.indexOf(mid) < 0) _multiSelectIds.push(mid);
    }
    allEntry.setAttribute('data-all', '1');
    if (document.getElementById('mmb-all-label')) document.getElementById('mmb-all-label').textContent = '取消';
  }
  _refreshMultiBar();
}

/* ---------------- 类型判定 ---------------- */

/* 系统居中态消息（撤回/通话/公告/黑屋/拍一拍等）：不可收藏、不可转发、无多选勾选框 */
function _isSystemCenteredMsg(msg) {
  if (!msg) return true;
  if (msg.isRecall) return true;
  return !!(msg.isPat || msg.isBlackNotice || msg.isPunish || msg.isCall || msg.isMailNotice);
}

/* 是否可转发（离开系统态 + 有实质内容；语音仅支持带 audioData 的短录音） */
function _isForwardableMsg(msg) {
  if (!msg || _isSystemCenteredMsg(msg)) return false;
  var t = msg.msgType;
  if (t === 'text') return !!msg.text;
  if (t === 'sticker' || t === 'doodle' || t === 'image') return !!(msg.stickerData || msg.imageData);
  if (t === 'voice') return !!msg.audioData;
  if (t === 'redpacket' || t === 'gift' || t === 'decision') return true;
  if (t === 'forward') return !!(msg.forwardItems && msg.forwardItems.length);
  return false;
}

/* ---------------- 批量删除 ---------------- */

function multiDeleteSelected() {
  var ids = _multiSelectIds.slice();
  if (!ids.length) { Core.toast('请先勾选要删除的消息'); return; }
  showMultiConfirm(
    '删除 ' + ids.length + ' 条消息',
    '删除后不可恢复，确定删除勾选的 ' + ids.length + ' 条消息（含大图/大表情缓存）吗？',
    function() { _doMultiDelete(ids); }
  );
}

function _doMultiDelete(ids) {
  var chatId = _multiSelectChatId || _multiChatIdNow();
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var remaining = [];
  var removed = [];
  messages.forEach(function(m) {
    if (ids.indexOf(String(m.id)) >= 0) removed.push(m);
    else remaining.push(m);
  });
  // 清理每条被删消息引用的 IndexedDB 大图/大表情
  removed.forEach(function(m) { if (window.ChatMedia && typeof ChatMedia.cleanupMsg === 'function') ChatMedia.cleanupMsg(m); });
  if (!removed.length) { Core.toast('没有可删除的消息'); return; }
  Storage.setMessages(chatId, remaining);
  renderChatMessages(chatId);
  var lastText = remaining.length ? (remaining[remaining.length - 1].text || '') : '';
  if (remaining.length) {
    updateLastMsg(chatId, lastText || '(无内容)');
  } else {
    // 全部删光：清空会话摘要
    var chats = Storage.getChats();
    for (var i = 0; i < chats.length; i++) {
      if (chats[i].id === chatId) { chats[i].lastMsg = ''; chats[i].lastTime = Date.now(); break; }
    }
    Storage.setChats(chats);
  }
  if (window.Navigation && Navigation._renderChatList) { try { Navigation._renderChatList(); } catch (e) {} }
  exitMultiSelectMode();
  Core.toast('已删除 ' + removed.length + ' 条消息');
}

/* ---------------- 批量收藏 ---------------- */

function multiFavoriteSelected() {
  var chatId = _multiSelectChatId || _multiChatIdNow();
  var ids = _multiSelectIds.slice();
  if (!ids.length) { Core.toast('请先勾选要收藏的消息'); return; }
  var messages = Storage.getMessages(chatId);
  var okCount = 0, skipCount = 0;
  ids.forEach(function(id) {
    var msg = null;
    for (var i = 0; i < messages.length; i++) { if (String(messages[i].id) === String(id)) { msg = messages[i]; break; } }
    if (!msg || _isSystemCenteredMsg(msg)) { skipCount++; return; }
    if (_batchFavoriteOne(msg, chatId)) okCount++;
    else skipCount++;   // 不可收藏或已在收藏中
  });
  exitMultiSelectMode();
  if (okCount) Core.toast('已收藏 ' + okCount + ' 条' + (skipCount ? '，跳过 ' + skipCount + ' 条' : ''));
  else Core.toast('选中的消息不可收藏或已在收藏中');
}

/* 单条收藏（批量专用，避免循环触发「已在收藏中」toast）：成功返回 true */
function _batchFavoriteOne(msg, chatId) {
  var fav = (typeof _buildFavorite === 'function') ? _buildFavorite(msg, chatId) : null;
  if (!fav) return false;
  var favorites = Storage.getFavorites();
  var exists = favorites.filter(function(f) { return String(f.id) === String(fav.id); })[0];
  if (exists) return false;
  favorites.unshift(fav);
  Storage.setFavorites(favorites);
  return true;
}

/* ---------------- 批量转发 ---------------- */

function multiForwardSelected() {
  var chatId = _multiSelectChatId || _multiChatIdNow();
  var ids = _multiSelectIds.slice();
  if (!ids.length) { Core.toast('请先勾选要转发的消息'); return; }
  showForwardTargetPicker(chatId, ids);
}

/* 转发目标选择器覆盖层 */
function showForwardTargetPicker(sourceChatId, ids) {
  // includeCurrent=true：把当前窗口也作为可选转发目标，唯一会话时不再提示“没有其它可转发”
  var list = _buildForwardTargets(sourceChatId, true);
  if (!list.length) { Core.toast('没有其它可转发的聊天'); return; }
  var msgs = Storage.getMessages(sourceChatId);
  var validIds = [];
  ids.forEach(function(id) {
    for (var i = 0; i < msgs.length; i++) {
      if (String(msgs[i].id) === String(id) && _isForwardableMsg(msgs[i])) { validIds.push(String(id)); break; }
    }
  });
  if (!validIds.length) { Core.toast('选中的消息均不可转发'); return; }
  var skipped = ids.length - validIds.length;

  var overlay = document.createElement('div');
  overlay.className = 'forward-target-overlay';
  overlay.id = 'forward-target-overlay';
  var html = '<div class="forward-target-panel">'
    + '<div class="forward-target-head"><span>选择聊天</span>'
    + '<span class="forward-target-count">已选 ' + validIds.length + ' 条' + (skipped ? '（跳过 ' + skipped + ' 条）' : '') + '</span>'
    + '<i class="fas fa-times forward-target-close"></i></div>'
    + '<div class="forward-target-body">';
  list.forEach(function(t) {
    html += '<div class="forward-target-item" data-chat="' + t.chatId + '">'
      + t.avatarHtml
      + '<div class="forward-target-info">'
      + '<div class="forward-target-name">' + Core.escapeHtml(t.name) + '</div>'
      + '<div class="forward-target-sub">' + Core.escapeHtml(t.sub || '') + '</div>'
      + '</div>'
      + '<i class="fas fa-chevron-right forward-target-arrow"></i>'
      + '</div>';
  });
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) { closeForwardTargetPicker(); return; }
    var closeBtn = e.target.closest('.forward-target-close');
    if (closeBtn) { closeForwardTargetPicker(); return; }
    var item = e.target.closest('.forward-target-item');
    if (item) {
      var target = item.getAttribute('data-chat');
      closeForwardTargetPicker();
      multiForwardConfirm(sourceChatId, target, validIds);
    }
  });
}

function closeForwardTargetPicker() {
  var ov = document.getElementById('forward-target-overlay');
  if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
}

/* 生成转发目标列表：单聊（已有会话）+ 群聊，排除当前聊天；
   includeCurrent=true 时把当前会话保留为第一个候选（支持“转发回当前窗口”） */
function _buildForwardTargets(excludeChatId, includeCurrent) {
  var items = [];
  var partners = [];
  try { partners = Storage.getPartnerProfiles ? (Storage.getPartnerProfiles() || []) : []; } catch (e) {}
  var chats = [];
  try { chats = Storage.getChats ? (Storage.getChats() || []) : []; } catch (e) {}
  var groups = [];
  try { groups = Storage.getGroupChats ? (Storage.getGroupChats() || []) : []; } catch (e) {}

  partners.forEach(function(p) {
    // 会话 chatId 必须与 Navigation._renderChatList 完全一致（列表统一用 'partner_' + p.id）：
    // 伙伴档案 id 可能本身带 'partner_' 前缀（addPartnerAccount 生成 'partner_<ts>'），
    // 此处不得再做前缀检测，否则会把 'partner_<ts>' 误当 chatId 少一层而投递到错误的 key。
    var chatId = 'partner_' + p.id;
    if (chatId === excludeChatId) return;
    // 与 Navigation._renderChatList 保持一致：会话列表对每个伙伴档案均展示，
    // 转发目标同样列出全部伙伴（不要求 chats 中已有记录——chats 条目仅在 openChatRoom
    // 时由 ensureChatExists 写入，若仅创建/添加过角色而未点开过该会话，会被旧逻辑漏列，
    // 导致“已有其它会话却提示没有可转发聊天”）。仅当真的没有任何其它会话时才提示空。
    var chat = null;
    for (var i = 0; i < chats.length; i++) { if (chats[i].id === chatId) { chat = chats[i]; break; } }
    var pname = p.nickname || p.name || '对方';
    items.push({
      chatId: chatId,
      name: pname,
      sub: (chat && chat.lastMsg) ? chat.lastMsg : '暂无消息',
      avatarHtml: _forwardPartnerAvatarHtml(p)
    });
  });
  groups.forEach(function(g) {
    var gid = g.id;
    if (!gid || gid === excludeChatId) return;
    items.push({
      chatId: gid,
      name: g.name || '群聊',
      sub: ((g.memberIds && g.memberIds.length) || 0) + ' 位成员',
      avatarHtml: _forwardGroupAvatarHtml(g)
    });
  });

  // 允许“转发回当前窗口”：includeCurrent=true 时把当前会话作为列表首项候选保留，
  // 其余会话仍按上方排除规则收缩（原排除条件不变，仅放开“当前窗口”这一目标）。
  if (includeCurrent && excludeChatId) {
    var selfItem = _buildCurrentTargetItem(excludeChatId);
    if (selfItem) items.unshift(selfItem);
  }
  return items;
}

/* 构造“当前对话”候选（转发回当前窗口）：单聊显示角色昵称，群聊显示群名，
   副标题统一标注「当前对话」，与列表同源读取头像，避免唯一会话时目标列表为空。
   返回 null 表示解析失败（不应出现，仅作兜底）。 */
function _buildCurrentTargetItem(chatId) {
  if (!chatId) return null;
  var chats = [];
  try { chats = Storage.getChats ? (Storage.getChats() || []) : []; } catch (e) {}
  // 群聊目标
  if (typeof isGroupChatId === 'function' && isGroupChatId(chatId)) {
    var groups = [];
    try { groups = Storage.getGroupChats ? (Storage.getGroupChats() || []) : []; } catch (e) {}
    for (var gi = 0; gi < groups.length; gi++) {
      if (groups[gi].id === chatId) {
        var g = groups[gi];
        return {
          chatId: chatId,
          name: g.name || '群聊',
          sub: '当前对话 · ' + ((g.memberIds && g.memberIds.length) || 0) + ' 位成员',
          avatarHtml: _forwardGroupAvatarHtml(g)
        };
      }
    }
    return { chatId: chatId, name: '群聊', sub: '当前对话', avatarHtml: _forwardGroupAvatarHtml({}) };
  }
  // 单聊目标：与 Navigation._renderChatList 同源（'partner_' + p.id）
  var partners = [];
  try { partners = Storage.getPartnerProfiles ? (Storage.getPartnerProfiles() || []) : []; } catch (e) {}
  for (var i = 0; i < partners.length; i++) {
    var p = partners[i];
    if (('partner_' + p.id) === chatId) {
      var chat = null;
      for (var ci = 0; ci < chats.length; ci++) { if (chats[ci].id === chatId) { chat = chats[ci]; break; } }
      var pname = p.nickname || p.name || '对方';
      var sub = '当前对话';
      if (chat && chat.lastMsg) sub += ' · ' + chat.lastMsg;
      return { chatId: chatId, name: pname, sub: sub, avatarHtml: _forwardPartnerAvatarHtml(p) };
    }
  }
  return null;
}

/* 单聊转发头像：与会话列表（Navigation._renderChatList）完全一致的渲染——
   avatarImage 优先铺图，否则渲染档案里的 avatar（Emoji/文字）或昵称首字；
   border-radius 跟随 avatarShape（square 方角 / 默认圆形），保证认知一致 */
function _forwardPartnerAvatarHtml(p) {
  var color = p.avatarColor || '#A090B0';
  var radius = (p.avatarShape === 'square') ? '8px' : '50%';
  if (p.avatarImage) {
    return '<div class="forward-target-avatar" style="background:' + color + ';background-image:url(' + p.avatarImage + ');background-size:cover;background-position:center;border-radius:' + radius + '"></div>';
  }
  var text = p.avatar || String(p.nickname || p.name || '?').charAt(0);
  return '<div class="forward-target-avatar" style="background:' + color + ';border-radius:' + radius + '">' + Core.escapeHtml(String(text).charAt(0)) + '</div>';
}

/* 群聊转发头像：直接复用聊天列表的 _buildGroupAvatarHtml（群头像图 / 成员堆叠），
   尺寸由 pages-multi.css 中 .forward-target-item .group-avatar-stack 缩放到 42px */
function _forwardGroupAvatarHtml(g) {
  if (typeof _buildGroupAvatarHtml === 'function') {
    return _buildGroupAvatarHtml(g);
  }
  var color = g.avatarColor || '#7A6FBE';
  if (g.avatarImage) {
    return '<div class="forward-target-avatar" style="background:' + color + ';background-image:url(' + g.avatarImage + ');background-size:cover;background-position:center"></div>';
  }
  return '<div class="forward-target-avatar" style="background:' + color + '"><i class="fas fa-users"></i></div>';
}

/* 确认并执行转发：把选中的 N 条消息合并成一条「转发卡片」（微信/QQ 式合并转发），
   投递到目标聊天。接收方看到的是 forward 卡片消息，点击卡片打开详情层查看原始内容。 */
function multiForwardConfirm(sourceChatId, targetChatId, ids) {
  var msgs = Storage.getMessages(sourceChatId);
  var counter = { seq: 0, skipped: 0 };
  var pendingBase = Date.now();
  // forwardItems 必须按被转发消息在源会话里的实际发生顺序排列（对标微信/QQ）：
  // 直接按源消息数组顺序过滤出选中的消息，保证顺序稳定、不受勾选顺序/newId 影响。
  // 源消息数组本身即按 time 升序追加，过滤后保持该相对顺序即「被转发消息实际发生顺序」。
  var orderedMsgs = msgs.filter(function(m) {
    for (var i = 0; i < ids.length; i++) {
      if (String(m.id) === String(ids[i]) || String(m.id) === String(ids[i].id)) return true;
    }
    return false;
  });
  Promise.all(orderedMsgs.map(function(msg) {
    if (!msg || !_isForwardableMsg(msg)) { counter.skipped++; return Promise.resolve(null); }
    var seq = counter.seq++;
    return _cloneForwardEntry(msg, pendingBase + seq, sourceChatId);
  })).then(function(results) {
    var entries = [];
    results.forEach(function(r) { if (r) entries.push(r); });
    if (!entries.length) { Core.toast('没有可转发的消息'); return; }
    var fromName = _resolveChatDisplayName(sourceChatId);
    var card = _buildForwardCard(entries, fromName, 'self', pendingBase, sourceChatId);
    var n = _commitForward(targetChatId, [card]);
    exitMultiSelectMode();
    Core.toast('已转发 ' + entries.length + ' 条消息');
  });
}

/* 确保转发目标在 chats 里已建立条目。
   单聊/群聊的 chats 条目仅在首次打开会话（ensureChatExists/ensureGroupChatExists）时写入；
   从未点开过的会话在 chats 中没有记录，直接调 updateLastMsg 会因找不到 chatId 而静默失效，
   导致转发的消息无法同步到会话列表摘要。这里在落库前先按目标类型补建条目。 */
function _ensureChatForTarget(targetChatId) {
  if (!targetChatId) return;
  var partners = [];
  try { partners = Storage.getPartnerProfiles ? (Storage.getPartnerProfiles() || []) : []; } catch (e) {}
  if (typeof isGroupChatId === 'function' && isGroupChatId(targetChatId)) {
    var groups = [];
    try { groups = Storage.getGroupChats ? (Storage.getGroupChats() || []) : []; } catch (e) {}
    for (var gi = 0; gi < groups.length; gi++) {
      if (groups[gi].id === targetChatId) {
        if (typeof ensureGroupChatExists === 'function') ensureGroupChatExists(groups[gi]);
        return;
      }
    }
    return;
  }
  var pid = String(targetChatId);
  if (pid.indexOf('partner_') === 0) pid = pid.slice('partner_'.length);
  for (var i = 0; i < partners.length; i++) {
    if (String(partners[i].id) === pid) {
      if (typeof ensureChatExists === 'function') ensureChatExists(targetChatId, partners[i]);
      return;
    }
  }
}

/* 转发副本落库：push + setMessages + updateLastMsg + 安全追加渲染 + 刷新会话列表 */
function _commitForward(targetChatId, copies) {
  if (!copies || !copies.length) return 0;
  _ensureChatForTarget(targetChatId);
  var msgs = Storage.getMessages(targetChatId);
  copies.forEach(function(cp) { msgs.push(cp); });
  Storage.setMessages(targetChatId, msgs);
  var lastText = copies[copies.length - 1].text || '[消息]';
  updateLastMsg(targetChatId, lastText);
  copies.forEach(function(cp) { if (typeof _safeAppendMessage === 'function') _safeAppendMessage(targetChatId, cp); });
  if (window.Navigation && Navigation._renderChatList) { try { Navigation._renderChatList(); } catch (e) {} }
  return copies.length;
}

/* 解析聊天显示名（转发来源提示用）：单聊返回对方昵称，群聊返回群名 */
function _resolveChatDisplayName(chatId) {
  if (!chatId) return '对方';
  try {
    if (typeof isGroupChatId === 'function' && isGroupChatId(chatId)) {
      var groups = Storage.getGroupChats ? (Storage.getGroupChats() || []) : [];
      for (var gi = 0; gi < groups.length; gi++) {
        if (groups[gi].id === chatId) return groups[gi].name || '群聊';
      }
      return '群聊';
    }
    var pid = String(chatId);
    if (pid.indexOf('partner_') === 0) pid = pid.slice('partner_'.length);
    var partners = Storage.getPartnerProfiles ? (Storage.getPartnerProfiles() || []) : [];
    for (var i = 0; i < partners.length; i++) {
      if (String(partners[i].id) === pid) return partners[i].nickname || partners[i].name || '对方';
    }
    return '对方';
  } catch (e) { return '对方'; }
}

/* 构建转发卡片消息：entries 为已克隆好的转发项数组（forwardItems），
   卡片本身是一条 type/msgType='forward' 的消息，接收方渲染为一张卡片。
   sourceChatId 记录来源聊天，供详情层按来源解析每条转发项的真实发送者（头像/昵称） */
function _buildForwardCard(entries, sourceName, direction, seqId, sourceChatId) {
  var nt = direction === 'self' ? 'self' : 'other';
  var fm = { name: sourceName || '对方' };
  if (sourceChatId) fm.chatId = sourceChatId;
  return {
    id: seqId || Date.now(),
    msgType: 'forward',
    type: nt,
    time: Date.now(),
    text: '[聊天记录]',
    forwardFrom: fm,
    forwardItems: (entries || []).filter(Boolean)
  };
}

/* 克隆单条消息为「转发项」（forwardItems 的元素）：复制成独立自包含副本。
   - sticker/doodle/image：用 ChatMedia 复制 IndexedDB 引用，生成 stk_/img_ 新副本，
     避免删除转发卡片时清理掉源消息引用的图；
   - voice 仅含 audioData；
   - redpacket / gift / decision：记录本身整体原样复制（保留领取态/作答现状）；
   - forward：递归克隆其内部转发项（二次/嵌套转发，媒体引用同样换取新副本）。
   返回 Promise<item|null> */
function _cloneForwardEntry(msg, seqId, sourceChatId) {
  var baseId = seqId || Date.now();
  var srcTime = (msg && msg.time) || Date.now();
  var t = (msg && msg.msgType) || 'text';
  // 记录发送者身份快照：isSelf=消息相对来源聊天是否为“我”发送；
  // fromId=群聊中对方发言人的成员 id（单聊为空），供详情层按身份取头像/昵称
  var sender = {
    isSelf: !!(msg && msg.type === 'self'),
    fromId: (msg && msg.type !== 'self' && msg.fromId) ? msg.fromId : ''
  };
  function clone(src) {
    try { return JSON.parse(JSON.stringify(src)); } catch (e) { return {}; }
  }
  function attachSender(o) { if (o && sender) o.sender = clone(sender); return o; }
  return new Promise(function(resolve) {
    if (t === 'forward') {
      var srcItems = (msg.forwardItems || []).slice();
      Promise.all(srcItems.map(function(it, i) { return _cloneForwardEntry(it, baseId + i + 1, sourceChatId); }))
        .then(function(newItems) {
          resolve(attachSender({
            msgType: 'forward',
            text: msg.text || '[聊天记录]',
            forwardFrom: (msg.forwardFrom) ? clone(msg.forwardFrom) : null,
            forwardItems: newItems.filter(Boolean),
            time: srcTime
          }));
        });
      return;
    }
    if (t === 'text') {
      var it = { msgType: 'text', text: msg.text || '', time: srcTime };
      if (msg.quote) it.quote = clone(msg.quote);
      if (msg.moodIntent) it.moodIntent = clone(msg.moodIntent);
      resolve(attachSender(it));
    } else if (t === 'sticker' || t === 'doodle') {
      var md = msg.stickerData || '';
      ChatMedia.getData(md).then(function(real) {
        return ChatMedia.storeForMessage(real, 'stk_' + baseId);
      }).then(function(newRef) {
        resolve(attachSender({ msgType: t, text: msg.text || '[表情]', stickerData: newRef || md, time: srcTime }));
      }).catch(function() {
        resolve(attachSender({ msgType: t, text: msg.text || '[表情]', stickerData: md, time: srcTime }));
      });
    } else if (t === 'image') {
      var imd = msg.imageData || '';
      ChatMedia.getData(imd).then(function(real) {
        return ChatMedia.storeForMessage(real, 'img_' + baseId);
      }).then(function(newRef) {
        resolve(attachSender({ msgType: 'image', text: msg.text || '[图片]', imageData: newRef || imd, time: srcTime }));
      }).catch(function() {
        resolve(attachSender({ msgType: 'image', text: msg.text || '[图片]', imageData: imd, time: srcTime }));
      });
    } else if (t === 'voice') {
      if (!msg.audioData) { resolve(null); return; }
      var vit = attachSender({ msgType: 'voice', text: msg.text || '[语音]', audioData: msg.audioData, time: srcTime });
      if (msg.audioMime) vit.audioMime = msg.audioMime;
      if (msg.duration) vit.duration = msg.duration;
      if (msg.voiceText) vit.voiceText = msg.voiceText;
      resolve(vit);
    } else if (t === 'redpacket') {
      // 原样复制整条红包记录（含领取态字段），不做状态重置
      var rit = attachSender({
        msgType: 'redpacket',
        greeting: msg.greeting || '恭喜发财',
        rpType: msg.rpType || 'normal',
        totalAmount: (msg.totalAmount != null) ? msg.totalAmount : 0,
        amount: (msg.amount != null) ? msg.amount : 0,
        count: (msg.count != null) ? msg.count : 1,
        claimed: !!msg.claimed,
        returned: !!msg.returned,
        text: msg.text || ('[红包]' + (msg.greeting || '恭喜发财')),
        time: srcTime
      });
      if (msg.selfAmount != null) rit.selfAmount = msg.selfAmount;
      if (msg.otherAmount != null) rit.otherAmount = msg.otherAmount;
      resolve(rit);
    } else if (t === 'gift') {
      resolve(attachSender({ msgType: 'gift', gift: clone(msg.gift || {}), text: msg.text || ('[商城] ' + ((msg.gift && msg.gift.name) || '礼物')), time: srcTime }));
    } else if (t === 'decision') {
      // 原样复制整张帮我抉择卡（保留 answers/result/pending 已答/待答现状），不重置
      var d = msg.decision || {};
      resolve(attachSender({
        msgType: 'decision',
        text: msg.text || '[帮我抉择]',
        decision: {
          question: d.question || '',
          options: clone(d.options || []),
          isGroup: !!d.isGroup,
          answers: clone(d.answers || []),
          result: clone(d.result || {}),
          pending: !!d.pending,
          publishedAt: (d.publishedAt != null) ? d.publishedAt : srcTime
        },
        time: srcTime
      }));
    } else {
      resolve(null);
    }
  });
}

/* ---------------- 确认弹窗（多选删除用） ---------------- */

function showMultiConfirm(title, message, onOk) {
  closeMultiConfirm();
  var overlay = document.createElement('div');
  overlay.className = 'forward-target-overlay';
  overlay.id = 'multi-confirm-overlay';
  overlay.innerHTML = '<div class="forward-target-panel multi-confirm-panel">'
    + '<div class="forward-target-head"><span>' + Core.escapeHtml(title) + '</span>'
    + '<i class="fas fa-times forward-target-close"></i></div>'
    + '<div class="multi-confirm-body">' + Core.escapeHtml(message) + '</div>'
    + '<div class="multi-confirm-actions">'
    + '<button class="multi-confirm-btn multi-confirm-cancel">取消</button>'
    + '<button class="multi-confirm-btn multi-confirm-ok">确定</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay || e.target.closest('.multi-confirm-cancel') || e.target.closest('.forward-target-close')) {
      closeMultiConfirm();
      return;
    }
    if (e.target.closest('.multi-confirm-ok')) {
      closeMultiConfirm();
      if (typeof onOk === 'function') onOk();
    }
  });
}

function closeMultiConfirm() {
  var ov = document.getElementById('multi-confirm-overlay');
  if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
}

/* ---------------- 对方偶尔转发（低概率） ---------------- */

/* 从其它聊天挑一条真实非系统态消息；返回 {chatId, msg} 或 null */
function _pickPartnerForwardSource(excludeChatId) {
  var srcIds = [];
  var chats = [];
  try { chats = Storage.getChats ? (Storage.getChats() || []) : []; } catch (e) {}
  chats.forEach(function(c) {
    if (c.id && c.id.indexOf('partner_') === 0 && c.id !== excludeChatId) srcIds.push(c.id);
  });
  var groups = [];
  try { groups = Storage.getGroupChats ? (Storage.getGroupChats() || []) : []; } catch (e) {}
  groups.forEach(function(g) { if (g.id && g.id !== excludeChatId) srcIds.push(g.id); });
  var candidates = [];
  srcIds.forEach(function(sid) {
    var msgs = Storage.getMessages(sid) || [];
    msgs.forEach(function(m) { if (_isForwardableMsg(m)) candidates.push({ chatId: sid, msg: m }); });
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/* 对方转发分支（低概率触发）：同样以「转发卡片」形态投递，真正触发返回 true（无来源消息时返回 false，回落正常回复） */
function _partnerForwardTo(chatId) {
  if (window._multiSelectActive) return false;
  var pick = _pickPartnerForwardSource(chatId);
  if (!pick) return false;
  var fromName = _resolveChatDisplayName(pick.chatId);
  _cloneForwardEntry(pick.msg, Date.now(), pick.chatId).then(function(entry) {
    if (!entry) return;
    _ensureChatForTarget(chatId);
    var card = _buildForwardCard([entry], fromName, 'other', Date.now(), pick.chatId);
    var msgs = Storage.getMessages(chatId);
    msgs.push(card);
    Storage.setMessages(chatId, msgs);
    updateLastMsg(chatId, card.text || '[消息]');
    if (typeof _safeAppendMessage === 'function') _safeAppendMessage(chatId, card);
    if (window.App && typeof App.playSound === 'function') App.playSound('receive');
    if (typeof showBackgroundPush === 'function') showBackgroundPush('收到一条转发');
    if (window.Navigation && Navigation._renderChatList) { try { Navigation._renderChatList(); } catch (e) {} }
  });
  return true;
}
