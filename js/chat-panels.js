/* === 表情包面板 === */

var _stickerPanelOpen = false;
var _stickerActiveCategory = 'all';
var _stickerCategories = [];
var _allStickers = [];
var _stickerCache = null;

/* === 面板高度与移动端输入法对齐 === */
var _chatPanelKeyboardH = 0;   // 最近一次检测到的移动端键盘高度（0=未知/桌面）

/* 通过 visualViewport 测量键盘高度（键盘弹出时 visualViewport.height 小于 innerHeight）
   阈值过滤：移动端地址栏/工具栏收起的 40~100px 视口变化不当作软键盘，
   避免面板被错误压扁成一行 */
function _measureKeyboardHeight() {
  try {
    var vv = window.visualViewport;
    var ih = window.innerHeight || document.documentElement.clientHeight;
    if (vv && vv.height && ih && vv.height > 0 && vv.height < ih) {
      var diff = Math.round(ih - vv.height);
      if (diff < 120 || diff / ih < 0.15) return 0;
      return Math.max(120, diff);
    }
  } catch (e) {}
  return 0;
}

/* 捕获并缓存键盘高度；键盘收起时归零并立即应用回退高度 */
function _captureKeyboardHeight() {
  var h = _measureKeyboardHeight();
  if (h > 0) {
    _chatPanelKeyboardH = h;
    _applyChatPanelHeight();
  } else if (_chatPanelKeyboardH > 0) {
    _chatPanelKeyboardH = 0;
    _applyChatPanelHeight();
  }
}

/* 将面板高度变量应用到页面（无键盘时回退 300px；下限 240px 保证图标至少两行，不被挤压） */
function _applyChatPanelHeight() {
  var h = _chatPanelKeyboardH || 300;
  if (h < 240) h = 240;
  try {
    document.documentElement.style.setProperty('--chat-panel-h', h + 'px');
  } catch (e) {}
}

/* 初始化：监听窗口/visualViewport 尺寸变化，键盘弹出/收起时跟随 */
function _initChatPanelKeyboardSync() {
  _applyChatPanelHeight();
  window.addEventListener('resize', function() {
    _captureKeyboardHeight();
  });
  try {
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener('resize', function() {
        _captureKeyboardHeight();
      });
    }
  } catch (e) {}
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initChatPanelKeyboardSync);
  } else {
    _initChatPanelKeyboardSync();
  }
}

function toggleStickerPanel() {
  if (_stickerPanelOpen) {
    closeStickerPanel();
  } else {
    openStickerPanel();
  }
}

function openStickerPanel() {
  var panel = document.getElementById('sticker-panel');
  var area = document.getElementById('chat-panel-area');
  if (!panel || !area) return;
  
  _stickerPanelOpen = true;
  
  // 点击菜单按钮只弹面板，不弹输入法
  var input = document.getElementById('chat-input');
  if (input) input.blur();
  
  // 关闭加号菜单
  closePlusMenu();
  
  // 展示面板区域 + 表情包面板
  area.classList.add('open-sticker');
  area.classList.remove('open-plus');
  panel.classList.add('active');
  
  // 加载表情包数据
  loadStickersForPanel();
  
  // 消息列表滚到底部
  scrollChatToBottom();
}

function closeStickerPanel() {
  _stickerPanelOpen = false;
  var panel = document.getElementById('sticker-panel');
  var area = document.getElementById('chat-panel-area');
  if (panel) panel.classList.remove('active');
  if (area) area.classList.remove('open-sticker');
}

function loadStickersForPanel() {
  // 有缓存直接读，避免 IndexedDB 异步查询
  if (_stickerCache) {
    _allStickers = _stickerCache;
    _stickerCategories = [];
    var catMap = {};
    _allStickers.forEach(function(s) {
      var cat = s.category || '未分类';
      if (!catMap[cat]) { catMap[cat] = true; _stickerCategories.push(cat); }
    });
    if (_stickerActiveCategory === 'all' || (_stickerActiveCategory !== 'emoji' && _stickerCategories.indexOf(_stickerActiveCategory) < 0)) {
      _stickerActiveCategory = 'emoji';
    }
    renderStickerTabs();
    renderStickerGrid();
    return;
  }
  // 异步加载 IndexedDB 中的表情包（首次加载后缓存）
  try {
    StickerDB.getAll().then(function(stickers) {
      _allStickers = stickers || [];
      _stickerCache = _allStickers;
      _stickerCategories = [];
      var catMap = {};
      _allStickers.forEach(function(s) {
        var cat = s.category || '未分类';
        if (!catMap[cat]) { catMap[cat] = true; _stickerCategories.push(cat); }
      });
      // 保留上次面板分类，仅在首次/无效分类时回退到 emoji
      if (_stickerActiveCategory === 'all' || (_stickerActiveCategory !== 'emoji' && _stickerCategories.indexOf(_stickerActiveCategory) < 0)) {
        _stickerActiveCategory = 'emoji';
      }
      renderStickerTabs();
      renderStickerGrid();
    }).catch(function() {
      renderStickerTabs();
      renderStickerGrid();
    });
  } catch(e) {
    renderStickerTabs();
    renderStickerGrid();
  }
}

function invalidateStickerCache() {
  _stickerCache = null;
}

function renderStickerTabs() {
  var tabsEl = document.getElementById('sticker-panel-tabs');
  if (!tabsEl) return;
  
  var html = '<div class="sticker-panel-tab' + (_stickerActiveCategory === 'emoji' ? ' active' : '') + '" onclick="switchStickerCategory(\'emoji\')">emoji</div>';
  _stickerCategories.forEach(function(cat) {
    html += '<div class="sticker-panel-tab' + (_stickerActiveCategory === cat ? ' active' : '') + '" onclick="switchStickerCategory(\'' + Core.escapeHtml(cat) + '\')">' + Core.escapeHtml(cat) + '</div>';
  });
  tabsEl.innerHTML = html;
  
  // 滚动到激活的 tab
  setTimeout(function() {
    var activeTab = tabsEl.querySelector('.sticker-panel-tab.active');
    if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, 50);
}

function switchStickerCategory(cat) {
  _stickerActiveCategory = cat;
  renderStickerTabs();
  renderStickerGrid();
}

function renderStickerGrid() {
  var gridEl = document.getElementById('sticker-panel-grid');
  if (!gridEl) return;
  
  // 布局类：emoji 微信密集排列(10列)，表情包一排5个
  gridEl.classList.remove('emoji-layout', 'sticker-layout');
  
  // emoji 表情 tab：渲染 emoji 字符
  if (_stickerActiveCategory === 'emoji') {
    gridEl.classList.add('emoji-layout');
    renderEmojiGrid(gridEl);
    return;
  }
  
  gridEl.classList.add('sticker-layout');
  
  var filtered = _allStickers.filter(function(s) { return (s.category || '未分类') === _stickerActiveCategory; });
  
  if (!filtered.length) {
    gridEl.innerHTML = '<div class="sticker-panel-empty">暂无表情包<br>请前往「字卡-表情包库」添加</div>';
    return;
  }
  
  var html = '';
  filtered.forEach(function(s, idx) {
    html += '<div class="sticker-panel-item" onclick="sendStickerByIndex(' + idx + ')"><img src="' + s.data + '" loading="lazy" alt="表情"></div>';
  });
  gridEl.innerHTML = html;
}

/* 通过面板下标发送表情包（避免 onclick 内嵌超长 base64 导致点击失效） */
function sendStickerByIndex(idx) {
  var filtered = _allStickers.filter(function(s) { return (s.category || '未分类') === _stickerActiveCategory; });
  if (filtered[idx] && filtered[idx].data) {
    sendStickerMessage(filtered[idx].data);
  }
}

function renderEmojiGrid(gridEl) {
  var emojis = Storage.getEmojis();
  if (!emojis || !emojis.length) {
    gridEl.innerHTML = '<div class="sticker-panel-empty">暂无 emoji 表情<br>请前往「字卡-表情包库」添加</div>';
    return;
  }
  // 按「字卡分组排序 + 组内顺序」稳定渲染，避免删除 emoji 后聊天界面顺序变化
  var ordered = getEmojisSortedForChat(emojis);
  // 最近使用（过滤掉已删除的 emoji）
  var recent = (Storage.getRecentEmojis ? Storage.getRecentEmojis() : []).filter(function(ch) {
    return ordered.some(function(e) { return e.char === ch; });
  });
  
  var html = '';
  // 微信布局：最近使用分区（每行10个，最多1行）
  if (recent.length) {
    html += '<div class="emoji-section-title">最近使用</div>';
    html += '<div class="emoji-section-grid">';
    recent.forEach(function(ch) {
      html += '<div class="sticker-panel-item sticker-emoji-item" onclick="insertEmojiToInput(\'' + Core.escapeHtml(ch) + '\')"><span class="sticker-emoji-char">' + Core.escapeHtml(ch) + '</span></div>';
    });
    html += '</div>';
  }
  // 所有表情分区（每行10个，可滚动）
  html += '<div class="emoji-section-title">所有表情</div>';
  html += '<div class="emoji-section-grid">';
  ordered.forEach(function(e) {
    html += '<div class="sticker-panel-item sticker-emoji-item" onclick="insertEmojiToInput(\'' + Core.escapeHtml(e.char) + '\')"><span class="sticker-emoji-char">' + Core.escapeHtml(e.char) + '</span></div>';
  });
  html += '</div>';
  gridEl.innerHTML = html;
}

/* ============================================================
   通话功能（语音/视频通话模拟）
   ============================================================ */
var _callTimer = null;
var _callSeconds = 0;
var _callKind = 'voice';
var _callConnected = false;
var _incomingKind = 'voice';

/* 通话方式选择弹窗（界面上方居中） */
/* 群聊多人通话：当前通话成员列表（null 表示单聊） */
var _callGroupMembers = null;
var _callChatId = '';
function _getCurrentGroupName() {
  var chatId = _currentChatId();
  if (!chatId || !isGroupChatId(chatId)) return '';
  var group = getGroupByChatId(chatId);
  return group ? (group.name || '群聊') : '群聊';
}
function _buildCallGroupAvatarsHtml(members) {
  if (!members || !members.length) return '';
  var h = '<div class="call-active-group-avatars">';
  members.forEach(function(m) {
    var color = (m && m.avatarColor) || '#A090B0';
    var inner = '';
    if (m && m.avatarImage) {
      inner = '<div class="call-active-member-avatar" style="background:' + color + ';background-image:url(' + m.avatarImage + ');background-size:cover;background-position:center"></div>';
    } else {
      var ch = (m && (m.avatar || m.nickname)) ? String(m.avatar || m.nickname).charAt(0) : '?';
      inner = '<div class="call-active-member-avatar" style="background:linear-gradient(135deg,' + color + ',' + color + ')">' + Core.escapeHtml(ch) + '</div>';
    }
    h += '<div class="call-active-member-item">' + inner
      + '<div class="call-active-member-name">' + Core.escapeHtml((m && m.nickname) || '角色') + '</div>'
      + '</div>';
  });
  h += '</div>';
  return h;
}

function openCallPicker() {
  closePlusMenu();
  var chatId = _currentChatId();
  _callGroupMembers = null;
  _callChatId = chatId || '';
  var name = _getCurrentPartnerName();
  var subText = '选择通话方式';
  var voiceLabel = '语音通话';
  var videoLabel = '视频通话';
  if (chatId && isGroupChatId(chatId)) {
    var group = getGroupByChatId(chatId);
    if (group) {
      name = group.name || '群聊';
      _callGroupMembers = getGroupMembers(group);
      subText = '群聊多人通话（' + (_callGroupMembers ? _callGroupMembers.length : 0) + ' 人）';
      voiceLabel = '多人语音通话';
      videoLabel = '多人视频通话';
    }
  }
  var html = '<div class="call-overlay" id="call-picker-overlay" onclick="closeCallPicker()">'
    + '<div class="call-picker-panel" onclick="event.stopPropagation()">'
    + '<div class="call-picker-name">' + Core.escapeHtml(name) + '</div>'
    + '<div class="call-picker-sub">' + Core.escapeHtml(subText) + '</div>'
    + '<div class="call-picker-options">'
    + '<div class="call-picker-option" onclick="startCall(\'voice\')"><i class="fas fa-phone"></i><span>' + voiceLabel + '</span></div>'
    + '<div class="call-picker-option" onclick="startCall(\'video\')"><i class="fas fa-video"></i><span>' + videoLabel + '</span></div>'
    + '</div>'
    + '<div class="call-picker-cancel" onclick="closeCallPicker()">取消</div>'
    + '</div></div>';
  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeCallPicker() {
  var el = document.getElementById('call-picker-overlay');
  if (el) el.remove();
}

function _currentChatId() {
  return document.getElementById('page-chat-room').dataset.chatId;
}

/* 获取当前聊天对象完整资料（未进入聊天室时自动取第一个账号） */
function _getCurrentPartnerProfile() {
  var partners = Storage.getPartnerProfiles();
  var id = _chatCurrentPartnerId;
  if (!id && partners && partners.length) id = partners[0].id;
  for (var i = 0; i < partners.length; i++) {
    if (partners[i].id === id) return partners[i];
  }
  return null;
}

/* 构建通话头像（优先展示账号设置上传的头像，不叠加文字） */
function _buildCallAvatarHtml(profile, cls) {
  var c = cls || 'call-active-avatar';
  var color = (profile && profile.avatarColor) || '#A090B0';
  if (profile && profile.avatarImage) {
    return '<div class="' + c + '" style="background-color:' + color + ';background-image:url(' + profile.avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat"></div>';
  }
  return '<div class="' + c + '" style="background:linear-gradient(135deg, ' + color + ', ' + color + ')"></div>';
}

/* 创建通话中弹窗 */
function _openCallActivePanel(kind) {
  var isGroupCall = _callGroupMembers && _callGroupMembers.length > 0;
  var name = isGroupCall ? (_getCurrentGroupName() || '群聊') : _getCurrentPartnerName();
  var profile = _getCurrentPartnerProfile();
  var kindText = (kind === 'video' ? '视频' : '语音') + '通话';
  var bg = (Storage.getCallBg ? Storage.getCallBg() : 0) || 0;
  var bgImg = (Storage.getCallBgImage ? Storage.getCallBgImage() : '') || '';
  var customCls = bgImg ? ' call-bg-custom' : '';
  var darkCls = (bg >= 1 || bgImg) ? ' call-bg-dark' : '';
  var bgStyle = bgImg ? ' style="background-image:url(' + bgImg + ')"' : '';
  var centerHtml = isGroupCall
    ? _buildCallGroupAvatarsHtml(_callGroupMembers)
    : _buildCallAvatarHtml(profile);
  var html = '<div class="call-overlay" id="call-active-overlay">'
    + '<div class="call-active-panel call-bg-' + bg + customCls + darkCls + '" id="call-active-panel">'
    + '<div class="call-active-bg"' + bgStyle + '></div>'
    + '<div class="call-bg-btn" onclick="toggleCallBgPicker(event)" title="更换背景"><i class="fas fa-palette"></i></div>'
    + '<div class="call-min-btn" onclick="minimizeCall()" title="缩略为气泡"><i class="fas fa-minus"></i></div>'
    + '<div class="call-active-content">'
    + centerHtml
    + '<div class="call-active-name">' + Core.escapeHtml(name) + '</div>'
    + '<div class="call-active-status" id="call-active-status">' + kindText + ' · 正在呼叫...</div>'
    + '<div class="call-active-ring" id="call-active-ring"></div>'
    + '<div class="call-active-timer" id="call-active-timer" style="display:none">00:00</div>'
    + '<div class="call-actions">'
    + '<div class="call-btn call-btn-hangup" onclick="hangupCall()"><i class="fas fa-phone"></i></div>'
    + '</div>'
    + '</div>'
    + '</div></div>';
  // 挂载到当前活动页容器：聊天界面内 → 显示在聊天界面内；其它页面（来电接听）→ 显示在手机框架内
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  _getCallMountRoot().appendChild(tmp.firstChild);
}

/* 通话浮层挂载根节点：优先当前活动页（聊天界面），否则手机框架 #app */
function _getCallMountRoot() {
  var room = document.getElementById('page-chat-room');
  if (room && room.classList.contains('active')) return room;
  var app = document.getElementById('app');
  return app || document.body;
}

/* 发起通话 */
function startCall(kind) {
  closeCallPicker();
  _callKind = kind;
  _callConnected = false;
  _callSeconds = 0;

  var name = (_callGroupMembers && _callGroupMembers.length) ? (_getCurrentGroupName() || '群聊') : _getCurrentPartnerName();
  var kindText = (kind === 'video' ? '视频' : '语音') + '通话';
  _openCallActivePanel(kind);

  // 呼叫等待 2~3.5 秒后对方响应
  var waitMs = 2000 + Math.random() * 1500;
  setTimeout(function() {
    var overlay = document.getElementById('call-active-overlay');
    if (!overlay) return; // 呼叫阶段已挂断
    var r = Math.random();
    if (r < 0.30) {
      // 对方拒绝
      overlay.remove();
      var b1 = document.getElementById('call-mini-bubble'); if (b1) b1.remove();
      _addCallNotice(name + ' 拒绝了你的' + kindText, 'rejected');
      _saveCallRecord(name, kind, 'rejected', 0, 'out');
    } else if (r < 0.45) {
      // 对方未接听
      overlay.remove();
      var b2 = document.getElementById('call-mini-bubble'); if (b2) b2.remove();
      _addCallNotice(name + ' 未接听你的' + kindText, 'missed');
      _saveCallRecord(name, kind, 'missed', 0, 'out');
    } else {
      // 对方接听，开始计时（无时长上限，需手动挂断）
      _beginCallConnected(kind);
    }
  }, waitMs);
}

/* 通话接通：开始计时（无时长上限，由用户手动挂断） */
function _beginCallConnected(kind) {
  var overlay = document.getElementById('call-active-overlay');
  if (!overlay) return;
  _callConnected = true;
  _callSeconds = 0;
  var name = (_callGroupMembers && _callGroupMembers.length) ? (_getCurrentGroupName() || '群聊') : _getCurrentPartnerName();
  var kindText = (kind === 'video' ? '视频' : '语音') + '通话';
  var ringEl = document.getElementById('call-active-ring');
  var timerEl = document.getElementById('call-active-timer');
  var statusEl = document.getElementById('call-active-status');
  if (ringEl) ringEl.style.display = 'none';
  if (timerEl) timerEl.style.display = '';
  if (statusEl) statusEl.textContent = kindText + '中 · ' + name;
  updateCallTimer();
  _callTimer = setInterval(updateCallTimer, 1000);
}

/* 格式化通话时长：秒 -> HH:MM:SS（时/分/秒各两位补零） */
function formatCallDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
}

function updateCallTimer() {
  _callSeconds++;
  var el = document.getElementById('call-active-timer');
  if (el) {
    el.textContent = formatCallDuration(_callSeconds);
  }
  var miniTimer = document.getElementById('call-mini-timer');
  if (miniTimer) {
    miniTimer.textContent = formatCallDuration(_callSeconds);
  }
}

/* 挂断通话 */
function hangupCall() {
  var overlay = document.getElementById('call-active-overlay');
  if (overlay) overlay.remove();
  var bubble = document.getElementById('call-mini-bubble');
  if (bubble) bubble.remove();
  if (_callTimer) { clearInterval(_callTimer); _callTimer = null; }
  var duration = _callSeconds;
  var name = (_callGroupMembers && _callGroupMembers.length) ? (_getCurrentGroupName() || '群聊') : _getCurrentPartnerName();
  if (_callConnected && duration > 0) {
    var durText = formatCallDuration(duration);
    _addCallNotice(name + ' 通话时长 ' + durText, 'connected');
    _saveCallRecord(name, _callKind, 'connected', duration, 'out');
  }
  _callConnected = false;
  _callSeconds = 0;
  _callGroupMembers = null;
}

/* HTML 字符串转节点 */
function _htmlToNode(html) {
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.firstChild;
}

/* 背景选择面板 */
function toggleCallBgPicker(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  var panel = document.getElementById('call-active-panel');
  if (!panel) return;
  var old = document.getElementById('call-bg-picker');
  if (old) { old.remove(); return; }
  var current = (Storage.getCallBg ? Storage.getCallBg() : 0) || 0;
  var bgImg = (Storage.getCallBgImage ? Storage.getCallBgImage() : '') || '';
  var swatches = [
    { id: 0, cls: 'call-bg-0', label: '淡蓝' },
    { id: 1, cls: 'call-bg-1', label: '星夜' },
    { id: 2, cls: 'call-bg-2', label: '粉恋' },
    { id: 3, cls: 'call-bg-3', label: '暖阳' },
    { id: 4, cls: 'call-bg-4', label: '森林' },
    { id: 5, cls: 'call-bg-5', label: '极光' }
  ];
  var html = '<div class="call-bg-picker" id="call-bg-picker" onclick="event.stopPropagation()">';
  swatches.forEach(function(s) {
    html += '<div class="call-bg-swatch ' + s.cls + (s.id === current && !bgImg ? ' active' : '') + '" onclick="setCallBg(' + s.id + ')" title="' + s.label + '"></div>';
  });
  // 自定义图片：已上传时展示缩略图（点击清除），未上传时展示上传入口
  if (bgImg) {
    html += '<div class="call-bg-swatch active" style="background-image:url(' + bgImg + ')" onclick="clearCallBgImage()" title="清除自定义背景"></div>';
  }
  html += '<div class="call-bg-swatch upload" onclick="uploadCallBgImage()" title="上传自定义背景"><i class="fas fa-plus"></i></div>';
  html += '</div>';
  panel.appendChild(_htmlToNode(html));
}

/* 切换通话背景 */
function setCallBg(id) {
  id = parseInt(id, 10) || 0;
  if (Storage.getCallBg) Storage.setCallBg(id);
  if (Storage.setCallBgImage) Storage.setCallBgImage('');
  var panel = document.getElementById('call-active-panel');
  if (panel) {
    var bgEl = panel.querySelector('.call-active-bg');
    if (bgEl) bgEl.style.backgroundImage = '';
    panel.className = 'call-active-panel call-bg-' + id + (id >= 1 ? ' call-bg-dark' : '');
  }
  var picker = document.getElementById('call-bg-picker');
  if (picker) picker.remove();
}

/* 上传自定义通话背景（IndexedDB 持久化：无容量上限，永久保存跟随设备） */
function uploadCallBgImage() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      // 高清压缩（1920px、0.92 质量），存入 IndexedDB 无容量限制
      compressImageData(e.target.result, 1920, 0.92, false).then(function(compressed) {
        CallBgDB.set('image', compressed).then(function() {
          Storage.setCallBgImage(compressed);
          _applyCallBgImage(compressed);
          Core.toast('自定义通话背景已永久保存');
        }).catch(function() {
          // IndexedDB 不可用或失败时回退 localStorage
          var saved = Storage.setCallBgImage ? Storage.setCallBgImage(compressed) : false;
          _applyCallBgImage(compressed);
          if (saved === false) {
            Core.toast('存储空间不足，背景仅在本次会话生效');
          } else {
            Core.toast('自定义通话背景已设置');
          }
        });
      });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

/* 清除自定义通话背景 */
function clearCallBgImage() {
  if (Storage.setCallBgImage) Storage.setCallBgImage('');
  var panel = document.getElementById('call-active-panel');
  if (panel) {
    var bgEl = panel.querySelector('.call-active-bg');
    if (bgEl) bgEl.style.backgroundImage = '';
    var baseBg = (Storage.getCallBg ? Storage.getCallBg() : 0) || 0;
    panel.className = 'call-active-panel call-bg-' + baseBg + (baseBg >= 1 ? ' call-bg-dark' : '');
  }
  var picker = document.getElementById('call-bg-picker');
  if (picker) picker.remove();
  Core.toast('已恢复内置背景');
}

/* 应用自定义通话背景到弹窗（含来电弹窗同步） */
function _applyCallBgImage(dataUrl) {
  var panel = document.getElementById('call-active-panel');
  if (panel) {
    var bgEl = panel.querySelector('.call-active-bg');
    if (bgEl) bgEl.style.backgroundImage = 'url(' + dataUrl + ')';
    panel.className = 'call-active-panel call-bg-custom call-bg-dark';
  }
  var incoming = document.querySelector('#call-incoming-overlay .call-incoming-panel');
  if (incoming) {
    var inBg = incoming.querySelector('.call-active-bg');
    if (inBg) inBg.style.backgroundImage = 'url(' + dataUrl + ')';
    incoming.className = 'call-incoming-panel call-bg-custom call-bg-dark';
  }
  var picker = document.getElementById('call-bg-picker');
  if (picker) picker.remove();
}

/* 通话弹窗缩略为气泡 */
function minimizeCall() {
  var overlay = document.getElementById('call-active-overlay');
  if (!overlay) return;
  var panel = document.getElementById('call-active-panel');
  if (panel) panel.style.display = 'none';
  var old = document.getElementById('call-mini-bubble');
  if (old) old.remove();
  var profile = _getCurrentPartnerProfile();
  var mm = Math.floor(_callSeconds / 60), ss = _callSeconds % 60;
  var durText = (mm < 10 ? '0' + mm : mm) + ':' + (ss < 10 ? '0' + ss : ss);
  var miniAvatar = '';
  if (_callGroupMembers && _callGroupMembers.length) {
    // 多人通话：缩略气泡头像始终使用圆形群聊头像（不跟随方形设置，避免方形头像在缩略气泡中显示异常）
    var miniGroup = _callChatId ? getGroupByChatId(_callChatId) : null;
    if (miniGroup && miniGroup.avatarImage) {
      miniAvatar = '<div class="call-mini-avatar" style="background:' + (miniGroup.avatarColor || '#A090B0') + ';background-image:url(' + miniGroup.avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat;border-radius:50%"></div>';
    } else {
      miniAvatar = '<div class="call-mini-avatar" style="background:linear-gradient(135deg,#B8DCF0,#A090B0)"><i class="fas fa-users"></i></div>';
    }
  } else {
    miniAvatar = _buildCallAvatarHtml(profile, 'call-mini-avatar');
  }
  var html = '<div class="call-mini-bubble" id="call-mini-bubble" title="双击恢复通话弹窗" style="right:16px;bottom:110px">'
    + '<div class="call-mini-timer" id="call-mini-timer">' + durText + '</div>'
    + miniAvatar
    + '<div class="call-mini-hangup" onclick="event.stopPropagation();hangupCall()"><i class="fas fa-phone"></i></div>'
    + '</div>';
  // 挂载到与通话面板相同的容器，保证缩略气泡跟随在通话所在界面内
  var mountRoot = overlay.parentNode || document.body;
  mountRoot.appendChild(_htmlToNode(html));
  _initCallBubbleDrag();
}

/* 气泡恢复为完整弹窗 */
function restoreCall() {
  var bubble = document.getElementById('call-mini-bubble');
  if (bubble) bubble.remove();
  var overlay = document.getElementById('call-active-overlay');
  if (!overlay) return;
  var panel = document.getElementById('call-active-panel');
  if (panel) panel.style.display = '';
  updateCallTimer();
}

/* 气泡拖动（支持触屏与鼠标） */
function _initCallBubbleDrag() {
  var bubble = document.getElementById('call-mini-bubble');
  if (!bubble) return;
  // 以气泡所在容器（通话面板所在界面）为定位基准，气泡不会跑出界面
  var page = bubble.parentNode || document.getElementById('page-chat-room') || document.body;
  var startX = 0, startY = 0, origX = 0, origY = 0, dragging = false, moved = false;
  // 双击检测状态：最近一次抬起时间与坐标（区别于 click 事件，避免移动端时序丢失）
  var _lastUpTime = 0, _lastUpX = 0, _lastUpY = 0;
  function isHangupTarget(e) {
    return e.target && e.target.closest && e.target.closest('.call-mini-hangup');
  }
  function onDown(e) {
    // 挂断按钮不参与拖动，保证点击挂断正常响应
    if (isHangupTarget(e)) return;
    var t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    var rect = bubble.getBoundingClientRect();
    origX = rect.left; origY = rect.top;
    dragging = true; moved = false;
    bubble.style.transition = 'none';
    if (e.cancelable) e.preventDefault();
  }
  function onMove(e) {
    if (!dragging || !page) return;
    var t = e.touches ? e.touches[0] : e;
    var dx = t.clientX - startX, dy = t.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    var pr = page.getBoundingClientRect();
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    var x = Math.max(pr.left, Math.min(pr.right - bw, origX + dx));
    var y = Math.max(pr.top, Math.min(pr.bottom - bh, origY + dy));
    bubble.style.left = (x - pr.left) + 'px';
    bubble.style.top = (y - pr.top) + 'px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
    if (e.cancelable) e.preventDefault();
  }
  function handleTapUp(e) {
    if (isHangupTarget(e)) return;
    var t = e.changedTouches ? e.changedTouches[0] : e;
    var cx = t ? t.clientX : 0, cy = t ? t.clientY : 0;
    var now = Date.now();
    // 与上一次抬起时间间隔 < 350ms 且位移 < 12px 判定为双击 → 恢复完整弹窗
    if (now - _lastUpTime < 350 && Math.abs(cx - _lastUpX) < 12 && Math.abs(cy - _lastUpY) < 12) {
      _lastUpTime = 0;
      restoreCall();
      return;
    }
    _lastUpTime = now;
    _lastUpX = cx;
    _lastUpY = cy;
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    bubble.style.transition = '';
    var wasMoved = moved;
    moved = false;
    if (!wasMoved && !isHangupTarget(e)) {
      // 未拖动且非挂断按钮：视为一次点击，走双击检测（含头像区域）
      handleTapUp(e);
    }
    if (wasMoved && e.cancelable) e.preventDefault();
  }
  bubble.addEventListener('touchstart', onDown, { passive: false });
  bubble.addEventListener('touchmove', onMove, { passive: false });
  bubble.addEventListener('touchend', onUp);
  bubble.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* 关键词匹配通话类型 */
function _matchCallKeyword(text) {
  if (!text) return null;
  if (/视频通话|打视频|视频|facetime/i.test(text)) return 'video';
  if (/语音通话|打电话|打语音|语音|电话|来电/i.test(text)) return 'voice';
  return null;
}

/* 对方来电（关键词触发） */
function _triggerIncomingCall(kind) {
  if (document.getElementById('call-incoming-overlay')) return;
  if (document.getElementById('call-active-overlay')) return;
  // 来电前清理可能遮挡的浮层，确保来电弹窗正常弹出并保持展示，不会被其他面板盖住或误以为立即挂断
  ['chat-menu-overlay', 'redpacket-claim-overlay', 'redpacket-overlay', 'redpacket-list-overlay',
   'rp-action-overlay', 'rp-detail-overlay', 'chat-bg-overlay',
   'call-history-overlay', 'call-picker-overlay', 'edit-account-overlay', 'voice-send-overlay'
  ].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });
  _incomingKind = kind || 'voice';
  var name = _getCurrentPartnerName();
  var profile = _getCurrentPartnerProfile();
  var kindText = _incomingKind === 'video' ? '视频通话' : '语音通话';
  // 与主动拨打保持一致：应用用户当前设置的通话背景
  var bg = (Storage.getCallBg ? Storage.getCallBg() : 0) || 0;
  var bgImg = (Storage.getCallBgImage ? Storage.getCallBgImage() : '') || '';
  var customCls = bgImg ? ' call-bg-custom' : '';
  var darkCls = (bg >= 1 || bgImg) ? ' call-bg-dark' : '';
  var bgStyle = bgImg ? ' style="background-image:url(' + bgImg + ')"' : '';
  var html = '<div class="call-overlay" id="call-incoming-overlay">'
    + '<div class="call-incoming-panel call-bg-' + bg + customCls + darkCls + '">'
    + '<div class="call-active-bg"' + bgStyle + '></div>'
    + _buildCallAvatarHtml(profile, 'call-incoming-avatar')
    + '<div class="call-incoming-name">' + Core.escapeHtml(name) + '</div>'
    + '<div class="call-incoming-sub" id="call-incoming-sub">邀请你' + kindText + '…</div>'
    + '<div class="call-incoming-actions">'
    + '<div class="call-incoming-btn reject" onclick="rejectIncomingCall()" title="拒绝"><i class="fas fa-phone"></i></div>'
    + '<div class="call-incoming-btn accept" onclick="answerIncomingCall()" title="接听"><i class="fas fa-phone"></i></div>'
    + '</div>'
    + '</div></div>';
  // 全站任意页面均可弹出来电请求：挂载到手机框架内（覆盖当前页面，不超出手机界面）
  var mountRoot = document.getElementById('app') || document.body;
  mountRoot.appendChild(_htmlToNode(html));
  if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch(e) {} }
  // 随机 25~60 秒无人接听视为未接听（不限制固定时间）
  setTimeout(function() {
    var overlay = document.getElementById('call-incoming-overlay');
    if (!overlay) return;
    overlay.remove();
    _addCallNotice('未接听 ' + name + ' 的' + kindText, 'missed');
    _saveCallRecord(name, _incomingKind, 'missed', 0, 'in');
  }, 25000 + Math.random() * 35000);
}

/* 接听来电 */
function answerIncomingCall() {
  var overlay = document.getElementById('call-incoming-overlay');
  if (overlay) overlay.remove();
  _callKind = _incomingKind || 'voice';
  _callConnected = false;
  _callSeconds = 0;
  _openCallActivePanel(_callKind);
  _beginCallConnected(_callKind);
}

/* 拒绝来电 */
function rejectIncomingCall() {
  var overlay = document.getElementById('call-incoming-overlay');
  if (overlay) overlay.remove();
  var name = _getCurrentPartnerName();
  var kind = _incomingKind || 'voice';
  var kindText = kind === 'video' ? '视频通话' : '语音通话';
  _addCallNotice('你拒绝了 ' + name + ' 的' + kindText, 'rejected');
  _saveCallRecord(name, kind, 'rejected', 0, 'in');
}

/* 居中气泡通话提示（类似撤回气泡） */
function _addCallNotice(text, status) {
  var chatId = _currentChatId();
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  messages.push({
    id: Date.now(),
    type: 'system',
    text: text,
    time: Date.now(),
    msgType: 'call',
    isCall: true,
    callStatus: status || 'connected',
    callDuration: 0
  });
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, text);
  renderChatMessages(chatId);
}

/* 通话记录图标（内联 SVG，跟随状态色） */
var CALL_ICON_PHONE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:block" fill="currentColor">'
  + '<path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02z"/>'
  + '</svg>';
var CALL_ICON_VIDEO_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:block" fill="currentColor">'
  + '<path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4.15 2.42a.5.5 0 0 0 .75-.43V8.51a.5.5 0 0 0-.75-.43L17 10.5z"/>'
  + '</svg>';

/* 保存通话记录 */
function _saveCallRecord(name, kind, status, duration, direction) {
  Storage.addCallRecord({
    id: Date.now(),
    name: name,
    kind: kind,
    status: status,
    duration: duration || 0,
    direction: direction || 'out',
    time: Date.now()
  });
}

/* 通话记录弹窗 */
function openCallHistoryPanel() {
  closePlusMenu();
  var records = Storage.getCallRecords();
  var itemsHtml = '';
  if (!records || records.length === 0) {
    itemsHtml = '<div class="call-history-empty">暂无通话记录</div>';
  } else {
    records.forEach(function(rec) {
      var isVideo = rec.kind === 'video';
      var dirPrefix = (rec.direction === 'in') ? '呼入' : '呼出';
      var statusText = '';
      var statusCls = '';
      var iconCls = '';
      if (rec.status === 'connected') {
        statusText = dirPrefix + ' · 通话时长 ' + formatCallDuration(rec.duration || 0);
        iconCls = 'icon-connected';
      } else if (rec.status === 'rejected') {
        statusText = dirPrefix + ' · 已拒绝 · ' + (isVideo ? '视频通话' : '语音通话');
        statusCls = 'rejected';
        iconCls = 'icon-rejected';
      } else {
        statusText = dirPrefix + ' · 未接听 · ' + (isVideo ? '视频通话' : '语音通话');
        statusCls = 'missed';
        iconCls = 'icon-missed';
      }
      var mainIcon = isVideo ? CALL_ICON_VIDEO_SVG : CALL_ICON_PHONE_SVG;
      itemsHtml += '<div class="call-history-item">'
        + '<div class="call-history-icon ' + iconCls + '">' + mainIcon + '</div>'
        + '<div class="call-history-info">'
        + '<div class="call-history-name">' + Core.escapeHtml(rec.name || '对方') + '</div>'
        + '<div class="call-history-status ' + statusCls + '">' + statusText + '</div>'
        + '</div>'
        + '<div class="call-history-time">' + Core.formatTime(rec.time) + '</div>'
        + '<div class="call-history-del" onclick="deleteCallRecord(' + rec.id + ')" title="删除记录"><i class="fas fa-trash-can"></i></div>'
        + '</div>';
    });
  }
  var html = '<div class="call-overlay" id="call-history-overlay" onclick="closeCallHistoryPanel()">'
    + '<div class="call-history-panel" onclick="event.stopPropagation()">'
    + '<div class="call-history-header">'
    + '<div class="call-history-title">通话记录</div>'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + (records && records.length ? '<div class="call-history-clear" onclick="clearCallRecordsAll()">清空</div>' : '')
    + '<div class="call-history-close" onclick="closeCallHistoryPanel()"><i class="fas fa-xmark"></i></div>'
    + '</div>'
    + '</div>'
    + '<div class="call-history-list">' + itemsHtml + '</div>'
    + '</div></div>';
  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeCallHistoryPanel() {
  var el = document.getElementById('call-history-overlay');
  if (el) el.remove();
}

/* 删除单条通话记录 */
function deleteCallRecord(id) {
  Storage.removeCallRecord(id);
  closeCallHistoryPanel();
  openCallHistoryPanel();
  Core.toast('记录已删除');
}

/* 清空全部通话记录 */
function clearCallRecordsAll() {
  Storage.clearCallRecords();
  closeCallHistoryPanel();
  openCallHistoryPanel();
  Core.toast('通话记录已清空');
}

