/* === 主动发送机制 === */

var _chatSimulateCallTimer = null;

/* 允许对方主动拨打：随机间隔触发视频/语音来电（全站任意页面均可弹出，不限制在聊天界面） */
function startSimulateCallTimer(chatId) {
  stopSimulateCallTimer();
  if (!Storage.getSimulateCall()) return;
  if (!chatId) {
    var room = document.getElementById('page-chat-room');
    if (room) chatId = room.dataset.chatId;
  }
  // 随机间隔 8~28 分钟触发（纯随机模式，降低出现概率）
  var delay = (8 + Math.random() * 20) * 60 * 1000;
  _chatSimulateCallTimer = setTimeout(function() {
    _chatSimulateCallTimer = null;
    // 已有来电或通话进行中，稍后重排
    if (document.getElementById('call-incoming-overlay') || document.getElementById('call-active-overlay')) {
      startSimulateCallTimer(chatId);
      return;
    }
    var kind = Math.random() < 0.4 ? 'video' : 'voice';
    _triggerIncomingCall(kind);
    startSimulateCallTimer(chatId);
  }, delay);
}

function stopSimulateCallTimer() {
  if (_chatSimulateCallTimer) {
    clearTimeout(_chatSimulateCallTimer);
    _chatSimulateCallTimer = null;
  }
}

function startProactiveTimer(chatId) {
  // 已在运行：仅更新目标聊天 ID，不重置计时（避免切换聊天室/重复进入导致发送时刻被无限顺延）
  if (_chatProactiveTimer) {
    if (chatId) _proactiveChatId = chatId;
    return;
  }
  var intervalSec = Storage.getProactiveSendInterval(); // 秒
  if (!intervalSec || intervalSec <= 0) intervalSec = 600;
  _proactiveChatId = chatId || '';
  _proactiveNextTime = Date.now() + intervalSec * 1000;
  _scheduleProactiveTick(intervalSec * 1000);
}

function _scheduleProactiveTick(delayMs) {
  _chatProactiveTimer = setTimeout(function() {
    _chatProactiveTimer = null;
    var intervalSec = Storage.getProactiveSendInterval();
    if (!intervalSec || intervalSec <= 0) intervalSec = 600;
    var now = Date.now();
    if (now >= _proactiveNextTime) {
      // 到期：立即发送并滚动到下一周期（若因页面节流/延迟错过，只补发一次，不连发轰炸）
      _proactiveNextTime = now + intervalSec * 1000;
      _doProactiveSend();
      _scheduleProactiveTick(intervalSec * 1000);
    } else {
      // 未到期（提前唤醒）：继续等待剩余时间，保证到点必发
      _scheduleProactiveTick(Math.min(intervalSec * 1000, _proactiveNextTime - now));
    }
  }, delayMs);
}

function _doProactiveSend() {
  // 全站生效：只要开启主动发送，无论是否在聊天界面都会继续发消息
  var cid = _proactiveChatId;
  var room = document.getElementById('page-chat-room');
  if (!cid && room) cid = room.dataset.chatId;
  if (!cid) {
    // 未进入聊天室时使用最近活跃的聊天（按 lastTime 取最新，而非数组末位）
    var chats = Storage.getChats();
    if (chats && chats.length > 0) {
      var best = chats[0];
      for (var i = 1; i < chats.length; i++) {
        if ((chats[i].lastTime || 0) > (best.lastTime || 0)) best = chats[i];
      }
      cid = best.id;
    }
  }
  if (!cid) return;
  // 群聊没有任何成员时，跳过本次发送（避免空转），定时器继续
  if (isGroupChatId(cid)) {
    var g = getGroupByChatId(cid);
    var gMembers = g ? getGroupMembers(g) : [];
    if (!gMembers.length) return;
  }
  // 对方主动从拾心商城赠送礼物（仅单聊）：小概率触发，给用户一个惊喜
  if (!isGroupChatId(cid) && window.ShopApp && typeof ShopApp.shouldPartnerGift === 'function' && ShopApp.shouldPartnerGift()) {
    if (Storage.getTypingIndicator()) {
      showTypingIndicator();
    }
    setTimeout(function() {
      hideTypingIndicator();
      if (typeof ShopApp.partnerInitiatedGift === 'function') ShopApp.partnerInitiatedGift(cid);
    }, 1400 + Math.random() * 1800);
    return;
  }
  // 先展示"正在输入"气泡（若开启且正在聊天界面），再发出消息
  if (Storage.getTypingIndicator()) {
    var tName = null;
    if (isGroupChatId(cid)) {
      var tg = getGroupByChatId(cid);
      var tgm = tg ? getGroupMembers(tg) : [];
      if (tgm.length) tName = tgm[Math.floor(Math.random() * tgm.length)].nickname;
    }
    showTypingIndicator(tName || undefined);
    setTimeout(function() { doAutoReply(cid); }, 1600 + Math.random() * 2000);
  } else {
    doAutoReply(cid);
  }
}

function stopProactiveTimer() {
  if (_chatProactiveTimer) {
    clearTimeout(_chatProactiveTimer);
    _chatProactiveTimer = null;
  }
}

/* === 正在输入提示气泡 === */
// 正在输入符号切换（点击符号或输入自定义符号）
function chatSetTypingSymbol(sym, el, isCustom) {
  if (!sym) return;
  sym = String(sym).trim();
  if (!sym) return;
  Storage.setTypingSymbol(sym);
  renderTypingSymbolSelection();
  var input = document.getElementById('cs-typing-symbol-input');
  if (input) input.value = isCustom ? sym : '';
  Core.toast('正在输入符号已切换为 ' + sym);
}

/* 规范化文本符号：❤(U+2764)/♥(U+2665) 若未带变体选择符则追加 U+FE0E，强制文本呈现，避免被彩色 emoji 字体抢渲染 */
function _normTextSymbol(sym) {
  if (!sym) return sym;
  sym = String(sym);
  if ((sym === '❤' || sym === '♥') && sym.indexOf('\uFE0E') === -1 && sym.indexOf('\uFE0F') === -1) {
    return sym + '\uFE0E';
  }
  return sym;
}

// 渲染正在输入符号选中态（点击后高亮当前符号；自定义符号不在候选列表时回填输入框）
function renderTypingSymbolSelection() {
  var current = _normTextSymbol(Storage.getTypingSymbol() || '❤︎');
  var container = document.getElementById('cs-typing-symbol-options');
  if (container) {
    var options = container.querySelectorAll('.sound-option');
    for (var i = 0; i < options.length; i++) {
      if (options[i].getAttribute('data-sym') === current) {
        options[i].classList.add('active');
      } else {
        options[i].classList.remove('active');
      }
    }
  }
  var input = document.getElementById('cs-typing-symbol-input');
  if (input) {
    var matched = container ? container.querySelector('.sound-option[data-sym="' + current + '"]') : null;
    if (!matched) input.value = current;
  }
}

/* === 拍一拍符号（我方发送 / 对方发送分别自定义，默认爱心） === */
// type: 'self' 我方发送符号；'other' 对方发送符号
function chatSetPatSymbol(type, sym, el, isCustom) {
  if (!sym) return;
  sym = String(sym).trim();
  if (!sym) return;
  if (type === 'self') {
    Storage.setPatSelfSymbol(sym);
  } else {
    Storage.setPatOtherSymbol(sym);
  }
  renderPatSymbolSelection();
  var input = document.getElementById(type === 'self' ? 'cs-pat-self-symbol-input' : 'cs-pat-other-symbol-input');
  if (input) input.value = isCustom ? sym : '';
  Core.toast('拍一拍符号（' + (type === 'self' ? '我方' : '对方') + '）已切换为 ' + sym);
}

function renderPatSymbolSelection() {
  var currentSelf = _normTextSymbol(Storage.getPatSelfSymbol() || '♥︎');
  var currentOther = _normTextSymbol(Storage.getPatOtherSymbol() || '♥︎');
  var map = [
    { type: 'self', cur: currentSelf, containerId: 'cs-pat-self-symbol-options', inputId: 'cs-pat-self-symbol-input' },
    { type: 'other', cur: currentOther, containerId: 'cs-pat-other-symbol-options', inputId: 'cs-pat-other-symbol-input' }
  ];
  map.forEach(function(item) {
    var container = document.getElementById(item.containerId);
    if (container) {
      var options = container.querySelectorAll('.sound-option');
      for (var i = 0; i < options.length; i++) {
        if (options[i].getAttribute('data-sym') === item.cur) {
          options[i].classList.add('active');
        } else {
          options[i].classList.remove('active');
        }
      }
    }
    var input = document.getElementById(item.inputId);
    if (input) {
      var matched = container ? container.querySelector('.sound-option[data-sym="' + item.cur + '"]') : null;
      if (!matched) input.value = item.cur;
    }
  });
}

function showTypingIndicator(name) {
  if (!Storage.getTypingIndicator()) return;
  var bubble = document.getElementById('chat-typing-bubble');
  if (!bubble) return;
  var textEl = document.getElementById('chat-typing-text');
  // 群聊：显示具体发言人正在输入
  var room = document.getElementById('page-chat-room');
  if (room && room.dataset.chatId && isGroupChatId(room.dataset.chatId)) {
    if (textEl) textEl.textContent = (name || '成员') + ' 正在输入…';
  } else {
    if (textEl) textEl.textContent = Storage.getTypingIndicatorText() || '对方正在输入…';
  }
  // 三点特效替换为用户自定义简笔画/实心符号
  var sym = _normTextSymbol(Storage.getTypingSymbol() || '❤︎');
  var dots = bubble.querySelectorAll('.typing-dots i');
  for (var i = 0; i < dots.length; i++) dots[i].textContent = sym;
  bubble.style.display = 'flex';
  if (room && room.dataset.chatId) {
    var container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

function hideTypingIndicator() {
  var bubble = document.getElementById('chat-typing-bubble');
  if (bubble) bubble.style.display = 'none';
}

/* === 已读回执调度 === */
var _readTimers = {};

function scheduleReadReceipt(chatId, msgId) {
  if (!Storage.getReadReceipt()) return;
  var key = chatId + '_' + msgId;
  if (_readTimers[key]) return;
  // 不要一发出就已是已读：等 3~10 秒再标记为已读（模拟对方真实阅读速度）
  var delay = (3 + Math.random() * 7) * 1000;
  _readTimers[key] = setTimeout(function() {
    _readTimers[key] = null;
    var messages = Storage.getMessages(chatId);
    var changed = false;
    for (var i = 0; i < messages.length; i++) {
      if (String(messages[i].id) === String(msgId) && messages[i].type === 'self' && !messages[i].read) {
        messages[i].read = true;
        changed = true;
        break;
      }
    }
    if (changed) {
      Storage.setMessages(chatId, messages);
      var room = document.getElementById('page-chat-room');
      if (room && room.dataset.chatId === chatId) updateMessageReadStatus(chatId, msgId);
    }
  }, delay);
}

function reschedulePendingReads(chatId) {
  if (!Storage.getReadReceipt()) return;
  var messages = Storage.getMessages(chatId);
  if (!messages) return;
  for (var i = 0; i < messages.length; i++) {
    if (messages[i].type === 'self' && !messages[i].read && !messages[i].isRecall && !messages[i].isCall) {
      scheduleReadReceipt(chatId, messages[i].id);
    }
  }
}

/* === 后台保活：静默音频永久循环播放 === */
var _keepAliveCtx = null;
var _keepAliveBuffer = null;
var _keepAliveSource = null;

function startKeepAliveAudio() {
  stopKeepAliveAudio();
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    _keepAliveCtx = new Ctx();
    var sampleRate = _keepAliveCtx.sampleRate;
    var len = Math.max(1, Math.floor(sampleRate * 0.25)); // 250ms 静音缓冲（性能优化第一批：原 1s）
    _keepAliveBuffer = _keepAliveCtx.createBuffer(1, len, sampleRate);
    // createBuffer 默认全 0 即为静音，无需显式写零循环（性能优化第一批）
    var source = _keepAliveCtx.createBufferSource();
    source.buffer = _keepAliveBuffer;
    source.loop = true;
    source.connect(_keepAliveCtx.destination);
    source.start();
    _keepAliveSource = source;
    // 浏览器自动播放限制：若上下文挂起，等待用户手势后恢复
    if (_keepAliveCtx.state === 'suspended') {
      var resumeHandler = function() {
        if (_keepAliveCtx && _keepAliveCtx.state === 'suspended') _keepAliveCtx.resume();
        document.removeEventListener('click', resumeHandler);
        document.removeEventListener('touchstart', resumeHandler);
      };
      document.addEventListener('click', resumeHandler);
      document.addEventListener('touchstart', resumeHandler);
    }
  } catch(e) {}
}

function stopKeepAliveAudio() {
  try {
    if (_keepAliveSource) {
      _keepAliveSource.stop();
      _keepAliveSource.disconnect && _keepAliveSource.disconnect();
      _keepAliveSource = null;
    }
    if (_keepAliveCtx) {
      _keepAliveCtx.close();
      _keepAliveCtx = null;
    }
  } catch(e) {}
  _keepAliveBuffer = null;
}

/* === 后台消息推送：切后台后通知栏弹窗 === */
function ensureNotifyPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBackgroundPush(text) {
  if (!Storage.getBackgroundPush()) return;
  // 站内任意页面顶部横幅提醒（仿手机通知栏，显示发送内容）
  showTopBanner(text || '新消息');
  // 系统通知栏弹窗：除「前台聊天室内」（消息已实时显示，避免重复打扰）外一律弹，
  // 覆盖切后台、最小化、失焦、锁屏等场景（macOS 锁屏时页面未必进入 hidden 状态）
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  var room = document.getElementById('page-chat-room');
  if (room && room.classList.contains('active') && document.visibilityState === 'visible') return;
  try {
    var partnerName = _getCurrentPartnerName();
    var n = new Notification('『' + partnerName + '』发来消息', {
      body: text || '新消息',
      tag: 'love-msg-' + Date.now()
    });
    n.onclick = function() {
      window.focus();
      n.close();
    };
  } catch(e) {}
}

/* 顶部横幅通知（仿手机通知栏：显示发送人、发送内容，点击跳转聊天室） */
var _bannerTimer = null;

function showTopBanner(text) {
  var app = document.getElementById('app');
  if (!app) return;
  // 聊天界面内消息已实时展示，不再弹横幅通知
  var room = document.getElementById('page-chat-room');
  if (room && room.classList.contains('active')) return;
  var old = document.getElementById('msg-top-banner');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; }
  var partnerName = _getCurrentPartnerName() || '对方';
  var content = String(text || '');
  if (content.length > 28) content = content.substring(0, 28) + '…';
  var banner = document.createElement('div');
  banner.id = 'msg-top-banner';
  banner.className = 'msg-banner';
  banner.innerHTML = '<div class="msg-banner-icon"><i class="fas fa-comment-dots"></i></div>'
    + '<div class="msg-banner-body">'
    + '<div class="msg-banner-title">『' + Core.escapeHtml(partnerName) + '』发来消息</div>'
    + '<div class="msg-banner-text">' + Core.escapeHtml(content) + '</div>'
    + '</div>'
    + '<div class="msg-banner-time">' + Core.formatTime(Date.now()) + '</div>';
  banner.onclick = function() {
    dismissTopBanner();
    if (window.Navigation) {
      try { Navigation.navigateTo('chat-room'); } catch(e) {}
    }
  };
  app.appendChild(banner);
  setTimeout(function() { banner.classList.add('show'); }, 20);
  _bannerTimer = setTimeout(dismissTopBanner, 4000);
}

function dismissTopBanner() {
  var banner = document.getElementById('msg-top-banner');
  if (banner) {
    banner.classList.remove('show');
    setTimeout(function() {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 300);
  }
  if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; }
}

/* === 继续发送：对方会继续发信息 === */
function continueSendMessage() {
  closePlusMenu();
  var room = document.getElementById('page-chat-room');
  var chatId = room ? room.dataset.chatId : null;
  if (!chatId) {
    var chats = Storage.getChats();
    if (chats && chats.length > 0) chatId = chats[chats.length - 1].id;
  }
  if (!chatId) {
    if (Core.toast) Core.toast('暂无聊天会话');
    return;
  }
  if (Storage.getTypingIndicator()) {
    showTypingIndicator();
  }
  setTimeout(function() {
    doAutoReply(chatId);
  }, 1200 + Math.random() * 1800);
  if (Core.toast) Core.toast('对方正在输入…');
}

// 微信式回车：Enter（无修饰键）发送；Shift/Alt/Command/Ctrl + Enter 换行（textarea 默认行为）
function onChatInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
}

