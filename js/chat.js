/* === 聊天功能 === */

// 对方主动拍一拍混入概率：普通自动回复链路中对方主动发送拍一拍的触发概率（22%）
// （区别于 PAT_AUTO_REPLY_MIX_PROBABILITY：那是「我发拍一拍后对方回拍」的概率，这里是「普通聊天中对方主动拍一拍」的概率）
var PAT_ACTIVE_MIX_PROBABILITY = 0.22;

/* === 消息分批渲染：解决消息过多时全量渲染卡顿 ===
   DISPLAYED_MSG_COUNT：聊天界面初始渲染的最近消息条数（与 ZY3 displayedMessageCount 一致）
   HISTORY_BATCH_SIZE：点击/滚动「加载更多历史」时每次追加的条数（与 ZY3 HISTORY_BATCH_SIZE 一致） */
var DISPLAYED_MSG_COUNT = 20;
var HISTORY_BATCH_SIZE = 20;
// 每个聊天当前已渲染的消息条数（按 chatId 记忆，切回聊天保留已加载进度）
var _displayedMsgCounts = {};
// 是否正在加载更多历史（防止重复触发）
var _isLoadingHistory = false;

function _getDisplayedCount(chatId) {
  var n = _displayedMsgCounts[chatId];
  if (!n || n < DISPLAYED_MSG_COUNT) n = DISPLAYED_MSG_COUNT;
  return n;
}

var _chatCurrentPartnerId = null;
var _chatProactiveTimer = null;
var _proactiveChatId = '';
var _proactiveNextTime = 0;

function openChatRoom(chatId) {
  // chatId 格式: partner_xxx
  if (!chatId || !chatId.startsWith('partner_')) return;
  var partnerId = chatId.replace('partner_', '');
  _chatCurrentPartnerId = partnerId;
  window._chatCurrentPartnerId = partnerId; // 供气泡商城指派读取（BubbleMaker）
  
  // 获取角色信息
  var partners = Storage.getPartnerProfiles();
  var partner = null;
  for (var i = 0; i < partners.length; i++) {
    if (partners[i].id === partnerId) { partner = partners[i]; break; }
  }
  if (!partner) return;
  
  // 确保聊天记录存在
  ensureChatExists(chatId, partner);
  
  // 设置标题
  var titleEl = document.getElementById('chat-room-title');
  if (titleEl) titleEl.textContent = partner.nickname;
  
  // 设置顶栏在线状态与情绪状态（内置随机展示，允许在角色编辑中自定义）
  setChatRoomStatus(partner);
  
  // 存储当前聊天 ID
  document.getElementById('page-chat-room').dataset.chatId = chatId;
  // 进入聊天页只让时间被检查（PartnerFreeWill 幂等：未到期不产生任何新内容）
  if (window.PartnerFreeWill && typeof PartnerFreeWill.checkAndAct === 'function') { try { PartnerFreeWill.checkAndAct(); } catch (e) {} }
  
  // 切换会话时重置语音模式（恢复文本输入栏）
  if (_voiceMode) toggleVoiceMode();
  // 切换会话时停止正在播放的语音
  stopVoicePlayback();
  
  // 渲染消息
  renderChatMessages(chatId);
  
  // 关闭面板
  closeStickerPanel();
  closePlusMenu();
  closeChatMenu();
  closeChatSearch();
  
  // 清空输入框
  var input = document.getElementById('chat-input');
  if (input) { input.value = ''; }
  onChatInputChange();
  
  // 切换聊天时清理引用与操作菜单
  cancelQuoteReply();
  closeMsgActionMenu();
  
  // 绑定返回按钮：仅返回上一页；主动发送为全站生效，不随离开聊天室停止（保证到点必发）
  var backBtn = document.querySelector('.chat-room-back');
  if (backBtn) {
    backBtn.onclick = function() {
      Navigation.goBack();
    };
  }

  // 绑定三点菜单按钮
  var actionBtn = document.querySelector('.chat-room-action');
  if (actionBtn) {
    actionBtn.onclick = function(e) {
      e.stopPropagation();
      toggleChatMenu();
    };
  }

  // 应用聊天背景（自定义图片：localStorage 存标记时从 IndexedDB 恢复，保证永久保存）
  var chatBgVal = Storage.getChatBgCustom(chatId);
  if (chatBgVal === '__idb__') {
    if (window.ChatBgDB) {
      ChatBgDB.get(chatId).then(function(img) {
        if (img && img.indexOf('data:') === 0) {
          applyChatBackground(img);
        } else {
          applyChatBackground('default');
          Storage.setChatBgCustom(chatId, 'default');
        }
      }).catch(function() {
        applyChatBackground('default');
        Storage.setChatBgCustom(chatId, 'default');
      });
    } else {
      applyChatBackground('default');
      Storage.setChatBgCustom(chatId, 'default');
    }
  } else {
    applyChatBackground(chatBgVal);
    // 若 localStorage 中背景仍是默认值，尝试从 IndexedDB 兜底恢复图片背景
    if (window.ChatBgDB && (chatBgVal === 'default' || !chatBgVal)) {
      ChatBgDB.get(chatId).then(function(img) {
        if (img && img.indexOf('data:') === 0) applyChatBackground(img);
      }).catch(function() {});
    }
  }
  
  // 恢复本聊天的贴表情（emoji 平铺背景）
  if (typeof window.renderEmojiStickerLayer === 'function') {
    renderEmojiStickerLayer(chatId);
  }
  
  // 启动主动发送（如果开启）
  if (Storage.getProactiveSend()) {
    startProactiveTimer(chatId);
  }
  
  // 启动"允许对方主动拨打"（如果开启）
  startSimulateCallTimer(chatId);
  
  // 恢复屏幕常亮开关状态（开启时自动重新获取唤醒锁）
  if (typeof window.restoreScreenAlwaysOn === 'function') {
    restoreScreenAlwaysOn();
  }
  
  // 导航到聊天室
  Navigation.navigateTo('chat-room');
  // 页面切换完成后滚动到最新消息（页面未显示时 scrollTop 无效，需延迟）
  setTimeout(scrollChatToBottom, 50);
  setTimeout(scrollChatToBottom, 300);
}

function ensureChatExists(chatId, partner) {
  var chats = Storage.getChats();
  var exists = false;
  for (var i = 0; i < chats.length; i++) {
    if (chats[i].id === chatId) { exists = true; break; }
  }
  if (!exists) {
    chats.push({
      id: chatId,
      name: partner.nickname,
      avatar: partner.avatar,
      avatarColor: partner.avatarColor,
      avatarImage: partner.avatarImage || '',
      avatarShape: partner.avatarShape || 'circle',
      lastMsg: '',
      lastTime: 0,
      unread: 0
    });
    Storage.setChats(chats);
  }
}

/* ==== 群聊功能 ==== */
function isGroupChatId(chatId) {
  return !!chatId && String(chatId).indexOf('group_') === 0;
}

function getGroupByChatId(chatId) {
  var groups = Storage.getGroupChats();
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].id === chatId) return groups[i];
  }
  return null;
}

function getGroupMembers(group) {
  var partners = Storage.getPartnerProfiles();
  var ids = (group && group.memberIds) || [];
  return partners.filter(function(p) { return ids.indexOf(p.id) !== -1; });
}

function _buildGroupAvatarHtml(group) {
  var members = getGroupMembers(group);
  // 自定义群头像：优先展示用户上传的群头像（形状跟随圆形/方形设置）
  if (group && group.avatarImage) {
    var shapeRadius = (group.avatarShape === 'square') ? '10px' : '50%';
    return '<div class="group-avatar-stack"><div class="ga-item ga-item-single" style="background:' + (group.avatarColor || '#A090B0') + ';background-image:url(' + group.avatarImage + ');background-size:cover;background-position:center;border-radius:' + shapeRadius + '"></div></div>';
  }
  var html = '<div class="group-avatar-stack">';
  var shown = members.slice(0, 2);
  if (members.length === 1) {
    // 单成员：头像居中撑满容器，与单聊头像视觉一致
    var m0 = members[0];
    var text0 = (m0.avatar || m0.nickname || '?').charAt(0);
    var color0 = m0.avatarColor || '#A090B0';
    if (m0.avatarImage) {
      html += '<div class="ga-item ga-item-single" style="background:' + color0 + ';background-image:url(' + m0.avatarImage + ');background-size:cover;background-position:center"></div>';
    } else {
      html += '<div class="ga-item ga-item-single" style="background:' + color0 + '">' + Core.escapeHtml(text0) + '</div>';
    }
  } else {
    shown.forEach(function(m) {
      var text = (m.avatar || m.nickname || '?').charAt(0);
      var color = m.avatarColor || '#A090B0';
      if (m.avatarImage) {
        html += '<div class="ga-item" style="background:' + color + ';background-image:url(' + m.avatarImage + ');background-size:cover;background-position:center"></div>';
      } else {
        html += '<div class="ga-item" style="background:' + color + '">' + Core.escapeHtml(text) + '</div>';
      }
    });
    if (members.length > 2) {
      html += '<div class="ga-more">+' + (members.length - 2) + '</div>';
    }
  }
  html += '</div>';
  return html;
}

function _buildGroupAvatarItemHtml(m) {
  var text = (m.avatar || m.nickname || '?').charAt(0);
  var color = m.avatarColor || '#A090B0';
  if (m.avatarImage) {
    return '<div class="gc-avatar" style="background:' + color + ';background-image:url(' + m.avatarImage + ');background-size:cover;background-position:center"></div>';
  }
  return '<div class="gc-avatar" style="background:' + color + '">' + Core.escapeHtml(text) + '</div>';
}

function _buildGroupName(members) {
  var names = members.map(function(m) { return m.nickname || '角色'; });
  var name = names.join('、');
  if (name.length > 12) name = name.slice(0, 11) + '…';
  return name;
}

function ensureGroupChatExists(group) {
  var chats = Storage.getChats();
  var exists = false;
  for (var i = 0; i < chats.length; i++) {
    if (chats[i].id === group.id) { exists = true; break; }
  }
  if (!exists) {
    chats.push({
      id: group.id,
      name: group.name,
      isGroup: true,
      memberIds: (group.memberIds || []).slice(),
      lastMsg: '',
      lastTime: 0,
      unread: 0
    });
    Storage.setChats(chats);
  }
}

function openGroupRoom(groupId) {
  if (!groupId || !isGroupChatId(groupId)) return;
  var group = getGroupByChatId(groupId);
  if (!group) return;
  
  // 确保聊天记录存在
  ensureGroupChatExists(group);
  
  // 设置标题
  var titleEl = document.getElementById('chat-room-title');
  if (titleEl) titleEl.textContent = group.name || '群聊';
  
  // 设置顶栏状态：群聊成员
  var statusEl = document.getElementById('chat-room-status');
  var members = getGroupMembers(group);
  if (statusEl) {
    statusEl.innerHTML = '<span class="chat-room-status-dot" style="background:#58C878"></span>'
      + '<span>群聊(' + members.length + '人)</span>';
  }
  
  // 存储当前聊天 ID
  document.getElementById('page-chat-room').dataset.chatId = groupId;
  // 进入聊天页只让时间被检查（PartnerFreeWill 幂等：未到期不产生任何新内容）
  if (window.PartnerFreeWill && typeof PartnerFreeWill.checkAndAct === 'function') { try { PartnerFreeWill.checkAndAct(); } catch (e) {} }
  
  // 切换会话时重置语音模式（恢复文本输入栏）
  if (_voiceMode) toggleVoiceMode();
  // 切换会话时停止正在播放的语音
  stopVoicePlayback();
  
  // 渲染消息
  renderChatMessages(groupId);
  
  // 关闭面板
  closeStickerPanel();
  closePlusMenu();
  closeChatMenu();
  closeChatSearch();
  
  // 清空输入框
  var input = document.getElementById('chat-input');
  if (input) { input.value = ''; }
  onChatInputChange();
  
  // 切换聊天时清理引用与操作菜单
  cancelQuoteReply();
  closeMsgActionMenu();
  
  // 绑定返回按钮
  var backBtn = document.querySelector('.chat-room-back');
  if (backBtn) {
    backBtn.onclick = function() {
      Navigation.goBack();
    };
  }
  
  // 绑定三点菜单按钮
  var actionBtn = document.querySelector('.chat-room-action');
  if (actionBtn) {
    actionBtn.onclick = function(e) {
      e.stopPropagation();
      toggleChatMenu();
    };
  }
  
  // 应用聊天背景
  var chatBgVal = Storage.getChatBgCustom(groupId);
  applyChatBackground(chatBgVal === '__idb__' ? 'default' : chatBgVal);
  
  // 启动主动发送（如果开启）
  if (Storage.getProactiveSend()) {
    startProactiveTimer(groupId);
  }
  
  // 群聊不模拟来电（来电只适用于单聊角色）
  stopSimulateCallTimer();
  
  // 导航到聊天室
  Navigation.navigateTo('chat-room');
  // 页面切换完成后滚动到最新消息（页面未显示时 scrollTop 无效，需延迟）
  setTimeout(scrollChatToBottom, 50);
  setTimeout(scrollChatToBottom, 300);
}

/* ==== 聊天列表顶栏：加号菜单 ==== */
function toggleChatListPlusMenu() {
  closeGlobalSearch();
  var menu = document.getElementById('chat-list-plus-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
function hideChatListPlusMenu() {
  var menu = document.getElementById('chat-list-plus-menu');
  if (menu) menu.style.display = 'none';
}
function goAddPartner() {
  Navigation.navigateTo('account-settings');
}

/* ==== 聊天列表顶栏：全局搜索 ==== */
var _globalSearchOpen = false;
function toggleGlobalSearch() {
  hideChatListPlusMenu();
  var panel = document.getElementById('global-search-panel');
  if (!panel) return;
  _globalSearchOpen = !_globalSearchOpen;
  panel.style.display = _globalSearchOpen ? 'block' : 'none';
  if (_globalSearchOpen) {
    var input = document.getElementById('global-search-input');
    if (input) { input.value = ''; input.focus(); }
    var results = document.getElementById('global-search-results');
    if (results) results.innerHTML = '<div class="global-search-empty">输入关键词，搜索所有聊天记录</div>';
  }
}
function closeGlobalSearch() {
  _globalSearchOpen = false;
  var panel = document.getElementById('global-search-panel');
  if (panel) panel.style.display = 'none';
  var input = document.getElementById('global-search-input');
  if (input) input.value = '';
  var results = document.getElementById('global-search-results');
  if (results) results.innerHTML = '';
}

function _msgSearchText(msg) {
  if (!msg) return '';
  if (msg.isCall) return msg.text || '';
  if (msg.isRecall) return msg.text || '';
  if (msg.msgType === 'sticker') return '[表情]';
  if (msg.msgType === 'image') return '[图片]';
  if (msg.msgType === 'redpacket') return '[红包] ' + (msg.greeting || '');
  if (msg.msgType === 'voice') return '[语音] ' + (msg.voiceText || '');
  return msg.text || '';
}

function doGlobalSearch() {
  var input = document.getElementById('global-search-input');
  var resultsEl = document.getElementById('global-search-results');
  if (!input || !resultsEl) return;
  var query = input.value.trim().toLowerCase();
  resultsEl.innerHTML = '';
  if (!query) {
    resultsEl.innerHTML = '<div class="global-search-empty">输入关键词，搜索所有聊天记录</div>';
    return;
  }
  
  var partners = Storage.getPartnerProfiles();
  var groupChats = Storage.getGroupChats();
  var total = 0;
  var html = '';
  
  function addChatGroup(chatId, displayName, isGroup) {
    var messages = Storage.getMessages(chatId);
    var hits = [];
    messages.forEach(function(msg) {
      var text = _msgSearchText(msg).toLowerCase();
      if (text.indexOf(query) !== -1) {
        hits.push(msg);
      }
    });
    if (!hits.length) return;
    total += hits.length;
    html += '<div class="gs-group">'
      + '<div class="gs-group-title"><i class="fas ' + (isGroup ? 'fa-users' : 'fa-comment-dots') + '"></i>' + Core.escapeHtml(displayName) + '<span class="gs-count">' + hits.length + '条</span></div>';
    hits.slice(-3).reverse().forEach(function(msg) {
      var isSelf = msg.type === 'self';
      var who = '我';
      if (!isSelf) {
        if (isGroup && msg.fromId) {
          var pp = null;
          for (var i = 0; i < partners.length; i++) { if (partners[i].id === msg.fromId) { pp = partners[i]; break; } }
          who = pp ? (pp.nickname || '角色') : '成员';
        } else {
          who = displayName;
        }
      }
      var textPreview = _msgSearchText(msg);
      var safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var hl = textPreview.replace(new RegExp('(' + safeQuery + ')', 'gi'), '<mark>$1</mark>');
      html += '<div class="gs-item" onclick="globalSearchOpenChat(\'' + chatId + '\',' + msg.id + ')">'
        + '<div class="gs-item-top"><span class="gs-from">' + Core.escapeHtml(who) + '</span><span>' + Core.formatTime(msg.time) + '</span></div>'
        + '<div class="gs-item-text">' + hl + '</div>'
        + '</div>';
    });
    html += '</div>';
  }
  
  // 单聊
  partners.forEach(function(p) {
    addChatGroup('partner_' + p.id, p.nickname, false);
  });
  // 群聊
  groupChats.forEach(function(g) {
    addChatGroup(g.id, g.name || '群聊', true);
  });
  
  if (!total) {
    resultsEl.innerHTML = '<div class="global-search-empty">未找到与「' + Core.escapeHtml(query) + '」相关的聊天记录</div>';
    return;
  }
  resultsEl.innerHTML = html;
}

function globalSearchOpenChat(chatId, msgId) {
  closeGlobalSearch();
  if (isGroupChatId(chatId)) {
    openGroupRoom(chatId);
  } else {
    openChatRoom(chatId);
  }
  // 定位到目标消息
  scrollToMessage(msgId);
}

/* 定位消息（渲染后滚动到指定消息并高亮） */
var _pendingScrollMsgId = null;
function scrollToMessage(msgId) {
  _pendingScrollMsgId = String(msgId);
}

/* ==== 创建群聊 ==== */
var _groupSelectedIds = [];
function showCreateGroupPanel() {
  var overlay = document.getElementById('group-create-overlay');
  var listEl = document.getElementById('group-create-list');
  if (!overlay || !listEl) return;
  _groupCreateAvatarImage = '';
  _groupCreateAvatarColor = '#B8DCF0';
  _groupCreateAvatarShape = 'circle';
  var nameInput = document.getElementById('group-create-name-input');
  if (nameInput) nameInput.value = '';
  var avEl = document.getElementById('group-create-avatar-preview');
  if (avEl) {
    avEl.style.backgroundImage = '';
    avEl.style.backgroundColor = _groupCreateAvatarColor;
    avEl.style.borderRadius = '50%';
    avEl.textContent = '群';
  }
  var shapeOpts = document.getElementById('group-create-shape-options');
  if (shapeOpts) {
    var items = shapeOpts.querySelectorAll('.group-shape-opt');
    for (var si = 0; si < items.length; si++) {
      items[si].classList.toggle('active', items[si].getAttribute('data-shape') === _groupCreateAvatarShape);
    }
  }
  var partners = Storage.getPartnerProfiles();
  _groupSelectedIds = [];
  if (partners.length < 2) {
    listEl.innerHTML = '<div class="group-create-empty">至少需要 2 个角色才能发起群聊，<br>请先通过「添加角色」创建更多角色</div>';
  } else {
    var html = '';
    partners.forEach(function(p) {
      html += '<div class="group-check-item" data-id="' + p.id + '" onclick="toggleGroupSelect(this)">'
        + _buildGroupAvatarItemHtml(p)
        + '<div class="gc-name">' + Core.escapeHtml(p.nickname || '角色') + '</div>'
        + '<div class="gc-check"><i class="fas fa-check"></i></div>'
        + '</div>';
    });
    listEl.innerHTML = html;
  }
  overlay.style.display = 'flex';
}

function toggleGroupSelect(el) {
  if (!el) return;
  var id = el.getAttribute('data-id');
  if (!id) return;
  var idx = _groupSelectedIds.indexOf(id);
  if (idx !== -1) {
    _groupSelectedIds.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    _groupSelectedIds.push(id);
    el.classList.add('selected');
  }
}

function hideCreateGroupPanel() {
  var overlay = document.getElementById('group-create-overlay');
  if (overlay) overlay.style.display = 'none';
  _groupSelectedIds = [];
}

/* 创建群聊：头像形状选择 */
function setGroupCreateShape(shape) {
  _groupCreateAvatarShape = (shape === 'square') ? 'square' : 'circle';
  var shapeOpts = document.getElementById('group-create-shape-options');
  if (shapeOpts) {
    var items = shapeOpts.querySelectorAll('.group-shape-opt');
    for (var si = 0; si < items.length; si++) {
      items[si].classList.toggle('active', items[si].getAttribute('data-shape') === _groupCreateAvatarShape);
    }
  }
  var avEl = document.getElementById('group-create-avatar-preview');
  if (avEl) avEl.style.borderRadius = (_groupCreateAvatarShape === 'square') ? '10px' : '50%';
}

function confirmCreateGroup() {
  if (_groupSelectedIds.length < 2) {
    Core.toast('请至少选择 2 个角色');
    return;
  }
  var partners = Storage.getPartnerProfiles();
  var members = partners.filter(function(p) { return _groupSelectedIds.indexOf(p.id) !== -1; });
  var groupId = 'group_' + Date.now();
  var memberIds = members.map(function(m) { return m.id; });
  var nameInput = document.getElementById('group-create-name-input');
  var customName = nameInput ? nameInput.value.trim() : '';
  var groupName = customName || _buildGroupName(members);
  var group = { id: groupId, name: groupName, memberIds: memberIds, createdAt: Date.now(), avatarImage: _groupCreateAvatarImage || '', avatarColor: _groupCreateAvatarColor || '#B8DCF0', avatarShape: _groupCreateAvatarShape || 'circle' };
  var groups = Storage.getGroupChats();
  groups.push(group);
  Storage.setGroupChats(groups);
  
  // 写入 chats 便于列表展示与更新
  var chats = Storage.getChats();
  chats.push({ id: groupId, name: groupName, isGroup: true, memberIds: memberIds.slice(), avatarImage: _groupCreateAvatarImage || '', avatarColor: _groupCreateAvatarColor || '#B8DCF0', avatarShape: _groupCreateAvatarShape || 'circle', lastMsg: '', lastTime: 0, unread: 0 });
  Storage.setChats(chats);
  
  hideCreateGroupPanel();
  Navigation._renderChatList();
  openGroupRoom(groupId);
  Core.toast('群聊已创建');
}

/* ==== 群聊设置（自定义群名/头像） ==== */
var _groupCreateAvatarImage = '';
var _groupCreateAvatarColor = '#B8DCF0';
var _groupCreateAvatarShape = 'circle';
var _groupEditAvatarImage = '';
var _groupEditAvatarColor = '#B8DCF0';
var _groupEditAvatarShape = 'circle';
var _groupEditingId = '';

function handleGroupCreateAvatar(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    compressImageData(e.target.result, 200, 0.85, true).then(function(compressed) {
      _groupCreateAvatarImage = compressed;
      var avEl = document.getElementById('group-create-avatar-preview');
      if (avEl) {
        avEl.style.backgroundImage = 'url(' + compressed + ')';
        avEl.style.backgroundSize = 'cover';
        avEl.style.backgroundPosition = 'center';
        avEl.textContent = '';
      }
    });
  };
  reader.readAsDataURL(file);
}

function openGroupSettings() {
  closeChatMenu();
  var chatId = _currentChatId();
  if (!isGroupChatId(chatId)) return;
  var group = getGroupByChatId(chatId);
  if (!group) return;
  _groupEditingId = group.id;
  _groupEditAvatarImage = group.avatarImage || '';
  _groupEditAvatarColor = group.avatarColor || '#B8DCF0';
  _groupEditAvatarShape = group.avatarShape || 'circle';
  var html = '<div class="group-setting-overlay" id="group-setting-overlay" onclick="if(event.target===this)closeGroupSettings()">'
    + '<div class="group-setting-panel">'
    + '<div class="group-setting-title"><i class="fas fa-users-gear"></i> 群聊设置</div>'
    + '<div class="group-create-info">'
    + '<div class="group-create-avatar" id="group-edit-avatar-preview" onclick="document.getElementById(\'group-edit-avatar-file\').click()">群</div>'
    + '<input type="file" id="group-edit-avatar-file" accept="image/*" style="display:none" onchange="handleGroupEditAvatar(this)">'
    + '<input type="text" class="group-create-name-input" id="group-edit-name-input" placeholder="输入群聊名称" maxlength="20" value="' + Core.escapeHtml(group.name || '') + '">'
    + '</div>'
    + '<div class="group-create-shape-row">'
    + '<span class="group-create-shape-label">头像形状</span>'
    + '<div class="group-shape-options" id="group-edit-shape-options">'
    + '<div class="group-shape-opt" data-shape="circle" onclick="setGroupEditShape(\'circle\')"><span class="shape-dot circle"></span>圆形</div>'
    + '<div class="group-shape-opt" data-shape="square" onclick="setGroupEditShape(\'square\')"><span class="shape-dot square"></span>方形</div>'
    + '</div>'
    + '</div>'
    + '<div class="group-create-sub" style="text-align:left;margin:0">群成员 ' + ((group.memberIds || []).length) + ' 人</div>'
    + '<div class="group-setting-actions">'
    + '<button class="glass-btn" onclick="closeGroupSettings()">取消</button>'
    + '<button class="glass-btn" onclick="saveGroupSettings()">保存</button>'
    + '<button class="glass-btn" style="color:#ff4757" onclick="deleteGroup()">删除群聊</button>'
    + '</div>'
    + '</div></div>';
  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
  _updateGroupEditAvatarPreview();
  // 同步形状选项高亮
  var shapeOpts = document.getElementById('group-edit-shape-options');
  if (shapeOpts) {
    var items = shapeOpts.querySelectorAll('.group-shape-opt');
    for (var si = 0; si < items.length; si++) {
      items[si].classList.toggle('active', items[si].getAttribute('data-shape') === _groupEditAvatarShape);
    }
  }
}

function handleGroupEditAvatar(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    compressImageData(e.target.result, 200, 0.85, true).then(function(compressed) {
      _groupEditAvatarImage = compressed;
      _updateGroupEditAvatarPreview();
    });
  };
  reader.readAsDataURL(file);
}

function _updateGroupEditAvatarPreview() {
  var avEl = document.getElementById('group-edit-avatar-preview');
  if (!avEl) return;
  var shapeRadius = (_groupEditAvatarShape === 'square') ? '10px' : '50%';
  avEl.style.borderRadius = shapeRadius;
  if (_groupEditAvatarImage) {
    avEl.style.backgroundImage = 'url(' + _groupEditAvatarImage + ')';
    avEl.style.backgroundSize = 'cover';
    avEl.style.backgroundPosition = 'center';
    avEl.textContent = '';
  } else {
    avEl.style.backgroundImage = '';
    avEl.style.backgroundColor = _groupEditAvatarColor;
    avEl.textContent = '群';
  }
}

/* 群聊头像形状选择（圆形/方形） */
function setGroupEditShape(shape) {
  _groupEditAvatarShape = (shape === 'square') ? 'square' : 'circle';
  var opts = document.getElementById('group-edit-shape-options');
  if (opts) {
    var items = opts.querySelectorAll('.group-shape-opt');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-shape') === _groupEditAvatarShape);
    }
  }
  _updateGroupEditAvatarPreview();
}

function closeGroupSettings() {
  var el = document.getElementById('group-setting-overlay');
  if (el) el.remove();
}

function saveGroupSettings() {
  var nameInput = document.getElementById('group-edit-name-input');
  var name = nameInput ? nameInput.value.trim() : '';
  if (!name) { Core.toast('请输入群聊名称'); return; }
  var groups = Storage.getGroupChats();
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].id === _groupEditingId) {
      groups[i].name = name;
      if (_groupEditAvatarImage) { groups[i].avatarImage = _groupEditAvatarImage; }
      groups[i].avatarColor = _groupEditAvatarColor || groups[i].avatarColor;
      groups[i].avatarShape = _groupEditAvatarShape || 'circle';
      break;
    }
  }
  Storage.setGroupChats(groups);
  // 同步聊天列表名称
  var chats = Storage.getChats();
  for (var ci = 0; ci < chats.length; ci++) {
    if (chats[ci].id === _groupEditingId) { chats[ci].name = name; break; }
  }
  Storage.setChats(chats);
  closeGroupSettings();
  var titleEl = document.getElementById('chat-room-title');
  if (titleEl) titleEl.textContent = name;
  Navigation._renderChatList();
  renderChatMessages(_groupEditingId);
  Core.toast('群聊信息已更新');
}

/* ==== 删除群聊 ==== */
function deleteGroup() {
  var chatId = _currentChatId();
  if (!isGroupChatId(chatId)) return;
  Core.confirm('删除群聊', '确定删除该群聊及所有聊天记录？此操作不可撤销。', function() {
    // 1. 从 groupChats 中删除
    var groups = Storage.getGroupChats();
    var idx = -1;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === chatId) { idx = i; break; }
    }
    if (idx >= 0) groups.splice(idx, 1);
    Storage.setGroupChats(groups);
    // 2. 从 chats 中删除
    var chats = Storage.getChats();
    var cidx = -1;
    for (var j = 0; j < chats.length; j++) {
      if (chats[j].id === chatId) { cidx = j; break; }
    }
    if (cidx >= 0) chats.splice(cidx, 1);
    Storage.setChats(chats);
    // 3. 清理聊天记录
    Storage.clearChatMessages(chatId);
    // 4. 关闭设置面板、返回聊天列表
    closeGroupSettings();
    Core.toast('群聊已删除');
    Navigation._renderChatList();
    Navigation.navigateTo('chat-list');
  });
}

/* ==== 群公告 ==== */
function openGroupAnnouncement() {
  closeChatMenu();
  var chatId = _currentChatId();
  if (!isGroupChatId(chatId)) return;
  var group = getGroupByChatId(chatId);
  if (!group) return;
  _groupEditingId = group.id;
  var html = '<div class="group-announce-overlay" id="group-announce-overlay" onclick="if(event.target===this)closeGroupAnnouncement()">'
    + '<div class="group-announce-panel">'
    + '<div class="group-announce-title"><i class="fas fa-bullhorn"></i> 群公告</div>'
    + '<div class="group-create-sub" style="margin:0">发布后将在聊天界面居中显示</div>'
    + '<textarea class="group-announce-textarea" id="group-announce-input" placeholder="输入群公告内容…" maxlength="200">' + Core.escapeHtml(group.announcement || '') + '</textarea>'
    + '<div class="group-announce-actions">'
    + '<button class="glass-btn" onclick="closeGroupAnnouncement()">取消</button>'
    + '<button class="glass-btn" onclick="publishGroupAnnouncement()">发布</button>'
    + '</div>'
    + '</div></div>';
  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeGroupAnnouncement() {
  var el = document.getElementById('group-announce-overlay');
  if (el) el.remove();
}

function publishGroupAnnouncement() {
  var input = document.getElementById('group-announce-input');
  var text = input ? input.value.trim() : '';
  if (!text) { Core.toast('公告内容不能为空'); return; }
  var groups = Storage.getGroupChats();
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].id === _groupEditingId) {
      groups[i].announcement = text;
      groups[i].announcementTime = Date.now();
      break;
    }
  }
  Storage.setGroupChats(groups);
  closeGroupAnnouncement();
  renderChatMessages(_groupEditingId);
  Core.toast('群公告已发布');
}

/* ==== 群聊自动回复 ==== */
function scheduleGroupAutoReply(chatId) {
  var group = getGroupByChatId(chatId);
  if (!group) return;
  var members = getGroupMembers(group);
  if (!members.length) return;
  // 随机 1~3 个成员先后回复，模拟群聊氛围
  var replyCount = Math.min(members.length, 1 + Math.floor(Math.random() * Math.min(3, members.length)));
  var shuffled = members.slice().sort(function() { return Math.random() - 0.5; });
  var chosen = shuffled.slice(0, replyCount);
  var minDelay = Storage.getReplyMinDelay();
  var maxDelay = Storage.getReplyMaxDelay();
  var delay = (minDelay + Math.random() * Math.max(0, maxDelay - minDelay)) * 1000;
  if (delay < 800) delay = 800 + Math.random() * 1500;
  chosen.forEach(function(member, idx) {
    setTimeout(function() {
      if (Storage.getTypingIndicator()) {
        showTypingIndicator(member.nickname || '成员');
        setTimeout(function() { doGroupAutoReply(chatId, member); }, 1400 + Math.random() * 2000);
      } else {
        doGroupAutoReply(chatId, member);
      }
    }, delay + idx * (1500 + Math.random() * 2500));
  });
}

function doGroupAutoReply(chatId, member) {
  hideTypingIndicator();
  if (!member) return;

  // 群聊红包：随机角色领取「我方发出」的未领红包（第一个成员领取后其余成员不再重复领）
  var groupRpClaimed = false;
  var claimCheckMsgs = Storage.getMessages(chatId);
  for (var ci = claimCheckMsgs.length - 1; ci >= 0; ci--) {
    var gRpMsg = claimCheckMsgs[ci];
    if (gRpMsg.msgType === 'redpacket' && gRpMsg.type === 'self' && !gRpMsg.claimed && !gRpMsg.returned) {
      var gAutoSaved = RedPacketStorage.load(chatId, gRpMsg.id) || {};
      gRpMsg.claimed = true;
      gRpMsg.amount = gRpMsg.totalAmount;
      gRpMsg.claimedBy = member.id;
      Storage.setMessages(chatId, claimCheckMsgs);
      gAutoSaved.id = gRpMsg.id;
      gAutoSaved.greeting = gRpMsg.greeting;
      gAutoSaved.rpType = gRpMsg.rpType;
      gAutoSaved.totalAmount = gRpMsg.totalAmount;
      gAutoSaved.count = gRpMsg.count;
      gAutoSaved.claimed = true;
      gAutoSaved.amount = gRpMsg.totalAmount;
      gAutoSaved.otherAmount = gRpMsg.totalAmount;
      gAutoSaved.otherClaimTime = Date.now();
      gAutoSaved.claimedBy = member.id;
      gAutoSaved.time = gRpMsg.time;
      RedPacketStorage.save(chatId, gRpMsg.id, gAutoSaved);
      _safeRenderChat(chatId);
      groupRpClaimed = true;
      break;
    }
  }

  // 拍一拍主动混入（群聊）：开关开启且概率命中时，该成员主动发送拍一拍（不再发普通文字回复）
  // （置于群聊红包领取循环之后、正常字卡/文字回复之前；_sendPatAutoReply 内部已支持群聊）
  if (Storage.getPatMixEnabled() && Math.random() < PAT_ACTIVE_MIX_PROBABILITY) {
    _sendPatAutoReply(chatId);
    return;
  }

  var cards = Storage.getCards();
  var emojis = Storage.getEmojis();
  var kaomojis = Storage.getKaomojis();
  var mainCards = cards.filter(function(c) { return c.category !== '格言'; });

  // 副字卡（群聊）：每个群成员仅可发送【自己专属】的副字卡
  // member.id 即对方角色 id（partner_xxx），只取该角色的副字卡，绝不混用别的角色的字卡
  var subPool = [];
  var gMemberId = (member && member.id) || '';
  if (gMemberId) {
    var allSubCards = Storage.getSubCards() || [];
    var blockedSub = Storage.getBlockedSubCards() || [];
    subPool = allSubCards.filter(function(c) {
      return c.partnerId === gMemberId && blockedSub.indexOf(c.id) < 0;
    });
  }
  // 字卡来源：该成员有专属副字卡时 50% 由其副字卡池生成（主字卡不参与当轮），否则用主字卡
  var replyPool;
  if (subPool.length > 0 && mainCards.length > 0) {
    replyPool = Math.random() < 0.5 ? subPool : mainCards;
  } else if (subPool.length > 0) {
    replyPool = subPool;
  } else {
    replyPool = mainCards;
  }
  var replyParts = [];
  if (replyPool.length > 0) {
    replyParts.push(replyPool[Math.floor(Math.random() * replyPool.length)].text);
  }
  if (emojis.length > 0 && Math.random() < 0.15) {
    replyParts.splice(Math.floor(Math.random() * (replyParts.length + 1)), 0, emojis[Math.floor(Math.random() * emojis.length)].char);
  }
  if (kaomojis.length > 0 && Math.random() < 0.2) {
    replyParts.splice(Math.floor(Math.random() * (replyParts.length + 1)), 0, kaomojis[Math.floor(Math.random() * kaomojis.length)].text);
  }
  // 无可用字卡/表情/颜文字时保持沉默（不再发『嗯嗯』兜底）；红包感谢语不依赖字卡，无需例外
  if (!groupRpClaimed && replyParts.length === 0) return;
  var reply = replyParts.join('');
  // 刚领取红包时，用感谢语替换普通回复（恋爱向）
  if (groupRpClaimed) {
    var thanks = ['谢谢宝贝，最爱你了～', '宝贝的红包，甜到心里啦！', '收到啦，亲亲抱抱～', '爱你哟，宝贝最好啦！', '宝贝破费啦，么么哒！', '有宝贝宠着，太幸福啦～'];
    reply = thanks[Math.floor(Math.random() * thanks.length)];
  }
  
  var msgs = Storage.getMessages(chatId);
  var newMsg = { id: Date.now(), type: 'other', fromId: member.id, text: reply, time: Date.now(), msgType: 'text' };
  newMsg.moodIntent = _pickMoodIntent();
  msgs.push(newMsg);
  Storage.setMessages(chatId, msgs);

  // 聊天特效：群聊成员发送字卡内容命中关键词同样触发（复用同一套关键词→特效映射）
  var fx = matchChatEffect(reply);
  if (fx) {
    setTimeout(function() { triggerChatEffect(fx); }, 350);
  }

  updateLastMsg(chatId, (member.nickname || '成员') + '：' + reply);
  _safeAppendMessage(chatId, newMsg);
  App.playSound('receive');
  showBackgroundPush((member.nickname || '成员') + '：' + reply);
}

/* 红包 icon（内联 SVG，替换原「開」字与「微信红包」标题） */
var RED_PACKET_ICON_SVG = '<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true" style="display:block">'
  + '<rect x="9" y="19" width="46" height="36" rx="6" fill="#E60012"/>'
  + '<rect x="9" y="19" width="46" height="11" rx="5.5" fill="#FF2D2D"/>'
  + '<path d="M9 25 Q32 38 55 25" stroke="#FFD34D" stroke-width="4" fill="none" stroke-linecap="round"/>'
  + '<circle cx="32" cy="24.5" r="6.5" fill="#FFD34D"/>'
  + '<text x="32" y="49" text-anchor="middle" font-size="13" font-weight="bold" fill="#FFD34D" font-family="Arial, sans-serif">¥</text>'
  + '</svg>';

/* 金色红包简笔画 icon（纯金色线条描边，用于红包气泡左侧、紧贴祝福语） */
var GOLD_RED_PACKET_ICON_SVG = '<svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true" style="display:block" fill="none" stroke="#F5C542" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="9" y="19" width="46" height="35" rx="7"/>'
  + '<path d="M9 25 Q32 39 55 25"/>'
  + '<text x="32" y="48" text-anchor="middle" font-size="15" font-weight="bold" fill="#F5C542" stroke="none" font-family="Arial, sans-serif">¥</text>'
  + '</svg>';

/* 金额显示格式化：小于 1 亿显示完整具体数字（整数尾 0 必须保留）；超过 1 亿显示 X亿+XXXX */
function formatRpAmountDisplay(n) {
  n = Number(n) || 0;
  // 超过 1 亿：X亿+XXXX（XXXX 为亿后万位部分，补零至 4 位；全为 0 时不显示 +）
  if (n >= 100000000) {
    var yi = Math.floor(n / 100000000);
    var rest = Math.floor((n % 100000000) / 10000);
    if (rest > 0) {
      var restStr = String(rest);
      while (restStr.length < 4) { restStr = '0' + restStr; }
      return yi + '亿+' + restStr;
    }
    return yi + '亿';
  }
  function trim(v) {
    v = Math.round(v * 100) / 100;
    var s = String(v);
    // 仅去掉小数部分末尾多余的 0；整数部分（如 10000）的 0 必须保留
    if (s.indexOf('.') >= 0) {
      s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s;
  }
  if (n >= 10000) return trim(n);
  return n.toFixed(2);
}

/* ============================================================
   消息操作菜单：撤回 / 收藏 / 引用 / 删除（点击消息气泡弹出）
   ============================================================ */
var _activeMsgMenu = null;
var _pendingQuote = null;

/* ============================================================
   顶栏在线状态 / 情绪状态（内置随机展示，允许在角色编辑中自定义）
   ============================================================ */
var CHAT_ONLINE_STATUSES = [
  { text: '在线', dot: '#58C878' },
  { text: '离线', dot: '#B0B0B0' },
  { text: '离开', dot: '#E0A84C' },
  { text: '忙碌', dot: '#E86858' },
  { text: '勿扰', dot: '#D068A0' },
  { text: '隐身', dot: '#A8A0C8' }
];
var CHAT_MOOD_STATUSES = [
  '开心', '想你', '元气满满', '安静', '温柔', '有点困', '发呆中',
  '傲娇', '小确幸', '期待见面', '心情不错', '专心摸鱼', '懒洋洋', '美滋滋'
];

/* 设置聊天室顶栏的在线状态与情绪状态：
   角色在「账号设置-编辑角色」里手动指定则显示指定值，否则从内置列表随机展示 */
function setChatRoomStatus(partner) {
  var statusEl = document.getElementById('chat-room-status');
  if (!statusEl) return;
  var onlineText = (partner && partner.onlineStatus) || '';
  var moodText = (partner && partner.moodStatus) || '';
  if (!onlineText) {
    onlineText = CHAT_ONLINE_STATUSES[Math.floor(Math.random() * CHAT_ONLINE_STATUSES.length)].text;
  }
  if (!moodText) {
    moodText = CHAT_MOOD_STATUSES[Math.floor(Math.random() * CHAT_MOOD_STATUSES.length)];
  }
  var dotColor = '#58C878';
  CHAT_ONLINE_STATUSES.forEach(function(s) { if (s.text === onlineText) dotColor = s.dot; });
  statusEl.innerHTML = '<span class="chat-room-status-dot" style="background:' + dotColor + '"></span>'
    + '<span>' + Core.escapeHtml(onlineText) + '</span>'
    + '<span class="chat-room-status-sep">·</span>'
    + '<span>' + Core.escapeHtml(moodText) + '</span>';
}

function bindChatTapMenu(container) {
  if (!container || container.dataset.tapBound) return;
  container.dataset.tapBound = '1';

  // 点击消息气泡弹出操作菜单（红包气泡走领取/退回面板，不在此列）
  container.addEventListener('click', function(e) {
    // 点击引用条：跳转到被引用的原始消息
    var qRef = e.target.closest ? e.target.closest('.msg-quote-ref') : null;
    if (qRef) {
      e.preventDefault();
      e.stopPropagation();
      scrollToQuoteMessage(qRef.getAttribute('data-quote-id'), qRef.textContent || '');
      return;
    }
    var el = e.target.closest ? e.target.closest('.message-bubble, .message-sticker-direct, .message-image, .decision-card') : null;
    if (!el) return;
    // 红包气泡有自己的领取/退回面板
    if (el.classList.contains('redpacket-bubble')) return;
    // 语音气泡点击为播放语音，不弹操作菜单
    if (el.classList.contains('voice-bubble')) return;
    var row = el.closest('.message-row');
    if (!row || !row.dataset.msgId) return;
    e.preventDefault();
    e.stopPropagation();
    showMsgActionMenu(row.dataset.msgId, el);
  });

  // 双击 图片/涂鸦/表情包 查看大图（单击已用于弹出操作菜单）
  // 引用图渲染时可能仍是占位图，取出 data-media-ref 后异步还原真图再放大；无引用则直接用当前 src
  container.addEventListener('dblclick', function(e) {
    var img = e.target.closest ? e.target.closest('.message-image, .message-sticker-direct') : null;
    if (!img || !img.src) return;
    e.stopPropagation();
    closeMsgActionMenu();
    var ref = img.getAttribute('data-media-ref');
    if (ref && window.ChatMedia && typeof ChatMedia.getData === 'function') {
      ChatMedia.getData(ref).then(function(src) {
        if (src) viewChatImage(src);
      }).catch(function() { viewChatImage(img.src); });
      return;
    }
    viewChatImage(img.src);
  });

  // 滚动时关闭菜单
  container.addEventListener('scroll', function() { closeMsgActionMenu(); }, { passive: true });
}

function showMsgActionMenu(msgId, anchorEl) {
  closeMsgActionMenu();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg) return;

  var rect = anchorEl.getBoundingClientRect();
  var menu = document.createElement('div');
  menu.className = 'msg-action-menu';
  menu.dataset.msgId = msgId;
  // 表情包不支持收藏，不显示收藏按键
  var favoriteItem = (msg.msgType === 'sticker')
    ? ''
    : '<div class="msg-action-item" data-act="favorite" title="收藏"><i class="fas fa-star"></i><span>收藏</span></div>';
  menu.innerHTML =
      '<div class="msg-action-item" data-act="recall" title="撤回"><i class="fas fa-rotate-left"></i><span>撤回</span></div>'
    + favoriteItem
    + '<div class="msg-action-item" data-act="quote" title="引用"><i class="fas fa-reply"></i><span>引用</span></div>'
    + '<div class="msg-action-item" data-act="delete" title="删除"><i class="fas fa-trash-can"></i><span>删除</span></div>';

  document.body.appendChild(menu);
  var mw = menu.offsetWidth;
  var mh = menu.offsetHeight;
  var left = rect.left + rect.width / 2 - mw / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - mw - 10));
  var top = rect.top - mh - 14;
  if (top < 12) {
    top = rect.bottom + 14;
    menu.classList.add('below');
  }
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  _activeMsgMenu = menu;

  menu.addEventListener('click', function(ev) {
    var item = ev.target.closest('.msg-action-item');
    if (!item || !_activeMsgMenu) return;
    var act = item.dataset.act;
    closeMsgActionMenu();
    if (act === 'recall') doRecallMessage(chatId, msgId);
    else if (act === 'favorite') doFavoriteMessage(chatId, msgId);
    else if (act === 'quote') doQuoteMessage(chatId, msgId);
    else if (act === 'delete') doDeleteMessage(chatId, msgId);
  });
}

function closeMsgActionMenu() {
  if (_activeMsgMenu) {
    _activeMsgMenu.remove();
    _activeMsgMenu = null;
  }
}

document.addEventListener('click', function() { closeMsgActionMenu(); });

function doRecallMessage(chatId, msgId) {
  var messages = Storage.getMessages(chatId);
  var idx = -1;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { idx = i; break; }
  }
  if (idx === -1) return;
  var recalled = messages[idx];
  if (recalled.isRecall) return;
  var isSelf = recalled.type === 'self';
  var partnerName = _getCurrentPartnerName();
  // 群聊：撤回发言人为具体成员
  if (!isSelf && isGroupChatId(chatId) && recalled.fromId) {
    var rg = getGroupByChatId(chatId);
    var rgm = rg ? getGroupMembers(rg) : [];
    for (var ri = 0; ri < rgm.length; ri++) {
      if (rgm[ri].id === recalled.fromId) { partnerName = rgm[ri].nickname || '成员'; break; }
    }
  }
  messages[idx] = {
    id: recalled.id,
    type: isSelf ? 'self' : 'other',
    fromId: recalled.fromId || '',
    text: isSelf ? '你撤回了一条消息' : (partnerName + '撤回了一条消息'),
    time: Date.now(),
    msgType: 'text',
    isRecall: true,
    blackRoom: !!recalled.blackRoom,
    recallName: isSelf ? '' : partnerName,
    recalledContent: _captureRecallContent(recalled)
  };
  Storage.setMessages(chatId, messages);
  renderChatMessages(chatId);
}

/* 心流状态：随机选取一个情绪含义标签（带情绪分类颜色），供对方角色回复气泡标注；不可用时返回 null */
function _pickMoodIntent() {
  try {
    if (window.MoodFlowApp && typeof window.MoodFlowApp.getRandomIntent === 'function') {
      // 心流状态：情绪标签按约一半概率添加，部分消息携带、部分不携带
      if (Math.random() < 0.55) return null;
      return window.MoodFlowApp.getRandomIntent();
    }
  } catch (e) {}
  return null;
}

/* 保存撤回前的消息内容（用于「显示撤回内容」开关） */
function _captureRecallContent(msg) {
  var c = { msgType: msg.msgType || 'text' };
  if (c.msgType === 'text') {
    c.text = msg.text || '';
    c.quote = msg.quote || null;
    c.moodIntent = msg.moodIntent || null;
  } else if (c.msgType === 'decision') {
    // 决策卡：完整保存问题、选项、作答结果，撤回后「显示撤回内容」可完整还原
    c.text = msg.text || '';
    c.decision = msg.decision ? JSON.parse(JSON.stringify(msg.decision)) : null;
  } else if (c.msgType === 'redpacket') {
    c.greeting = msg.greeting || '';
    c.claimed = !!msg.claimed;
    c.amount = msg.amount;
    c.rpType = msg.rpType;
    c.totalAmount = msg.totalAmount;
    c.count = msg.count;
  } else if (c.msgType === 'sticker') {
    c.stickerData = msg.stickerData || '';
  } else if (c.msgType === 'doodle') {
    c.stickerData = msg.stickerData || '';
  } else if (c.msgType === 'image') {
    c.imageData = msg.imageData || '';
  } else if (c.msgType === 'voice') {
    c.duration = msg.duration || 3;
    c.audioUrl = msg.audioUrl || '';
    c.audioData = msg.audioData || '';
    c.audioMime = msg.audioMime || '';
    c.voiceText = msg.voiceText || '';
  } else if (c.msgType === 'gift') {
    c.gift = msg.gift ? JSON.parse(JSON.stringify(msg.gift)) : null;
  }
  return c;
}

/* 获取当前聊天对象的角色名 */
function _getCurrentPartnerName() {
  if (!_chatCurrentPartnerId) return '对方';
  var partners = Storage.getPartnerProfiles();
  for (var i = 0; i < partners.length; i++) {
    if (partners[i].id === _chatCurrentPartnerId) return partners[i].nickname || '对方';
  }
  return '对方';
}

function doDeleteMessage(chatId, msgId) {
  var messages = Storage.getMessages(chatId).filter(function(m) {
    return String(m.id) !== String(msgId);
  });
  // 同步清理被删消息引用的 IndexedDB 大图（含撤回内容/引用内容中的引用）
  var removed = Storage.getMessages(chatId).filter(function(m) { return String(m.id) === String(msgId); })[0];
  if (removed) ChatMedia.cleanupMsg(removed);
  Storage.setMessages(chatId, messages);
  renderChatMessages(chatId);
  Core.toast('消息已删除');
}

/* 构建结构化收藏对象：含消息类别、发送方、时间与内容数据 */
function _buildFavorite(msg, chatId) {
  var category = 'other';
  var label = '其他';
  var text = '';
  var stickerData = '';
  var imageData = '';
  var decisionData = null;
  var giftData = null;
  // 红包、表情包不支持收藏
  if (msg.msgType === 'redpacket' || msg.msgType === 'sticker') return null;
  if (msg.msgType === 'text') { category = 'text'; label = '文本'; text = msg.text || ''; }
  else if (msg.msgType === 'doodle') { category = 'doodle'; label = '涂鸦'; text = '[涂鸦]'; stickerData = msg.stickerData || ''; }
  else if (msg.msgType === 'image') { category = 'image'; label = '图片'; text = '[图片]'; imageData = msg.imageData || ''; }
  else if (msg.msgType === 'gift') {
    // 商城购物卡片收藏：保存完整商品数据供收藏页还原展示
    var g = msg.gift || {};
    category = 'gift'; label = '购物'; text = g.name || '神秘礼物';
    giftData = {
      productId: g.productId || '',
      name: g.name || '',
      price: g.price || 0,
      icon: g.icon || '🎁',
      category: g.category || '',
      greeting: g.greeting || ''
    };
  }
  else if (msg.isPat) { category = 'pat'; label = '拍一拍'; text = msg.text || ''; }
  else if (msg.isBlackNotice) { category = 'blacknotice'; label = '黑屋通知'; text = msg.text || ''; }
  else if (msg.msgType === 'decision') {
    category = 'decision'; label = '决策卡'; text = msg.text || '';
    // 保存完整决策数据（问题、选项、对方勾选结果），供收藏页还原展示
    decisionData = {
      question: (msg.decision && msg.decision.question) || '',
      options: (msg.decision && msg.decision.options) || [],
      result: (msg.decision && msg.decision.result) || {},
      answers: (msg.decision && msg.decision.answers) || []
    };
  }
  if (!text && !stickerData && !imageData) return null;
  // 发送方：单聊按我方/对方，群聊按发言人昵称
  var from = '对方';
  if (msg.type === 'self') {
    var myProfile = Storage.getMyProfile();
    from = (myProfile && (myProfile.name || myProfile.nickname)) || '我';
  } else if (isGroupChatId(chatId)) {
    var group = getGroupByChatId(chatId);
    var members = getGroupMembers(group);
    var fromP = msg.fromId ? members.filter(function(m) { return m.id === msg.fromId; })[0] : null;
    from = fromP ? (fromP.nickname || '成员') : '成员';
  } else {
    // 单聊对方：显示对方具体名字
    var partnerId = chatId.indexOf('partner_') === 0 ? chatId.substring('partner_'.length) : '';
    var partners = Storage.getPartnerProfiles();
    for (var pi = 0; pi < partners.length; pi++) {
      if (partners[pi].id === partnerId) { from = partners[pi].nickname || partners[pi].name || '对方'; break; }
    }
  }
  return {
    id: String(msg.id),
    category: category,
    label: label,
    text: text,
    from: from,
    time: msg.time || Date.now(),
    stickerData: stickerData,
    imageData: imageData,
    decisionData: decisionData,
    giftData: giftData
  };
}

function doFavoriteMessage(chatId, msgId) {
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg) return;
  var fav = _buildFavorite(msg, chatId);
  if (!fav) { Core.toast('该消息无法收藏'); return; }
  var favorites = Storage.getFavorites();
  var exists = favorites.filter(function(f) { return String(f.id) === String(fav.id); })[0];
  if (exists) { Core.toast('已在收藏中'); return; }
  favorites.unshift(fav);
  Storage.setFavorites(favorites);
  Core.toast('已收藏');
}

function doQuoteMessage(chatId, msgId) {
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg) return;
  var text = '';
  var stickerData = '';
  var imageData = '';
  if (msg.msgType === 'text') text = msg.text || '';
  else if (msg.msgType === 'decision') text = '[帮我抉择] ' + ((msg.decision && msg.decision.question) || '');
  else if (msg.msgType === 'redpacket') text = '[红包] ' + (msg.greeting || '');
  else if (msg.msgType === 'sticker') { text = '[表情]'; stickerData = msg.stickerData || ''; }
  else if (msg.msgType === 'doodle') { text = '[涂鸦]'; stickerData = msg.stickerData || ''; }
  else if (msg.msgType === 'image') { text = '[图片]'; imageData = msg.imageData || ''; }
  else if (msg.msgType === 'gift') {
    // 商城购物赠送卡片：引用时展示商品名与价格
    var gN = (msg.gift && msg.gift.name) || '礼物';
    var gP = (msg.gift && msg.gift.price) ? ' ¥' + msg.gift.price : '';
    text = '[商城] ' + gN + gP;
  }
  if (!text) return;
  // 记录被引用消息 ID 与表情/图片数据，便于渲染图片与点击跳转
  _pendingQuote = {
    text: text,
    from: msg.type === 'self' ? '我' : '对方',
    msgId: msg.id,
    stickerData: stickerData,
    imageData: imageData
  };
  var bar = document.getElementById('chat-quote-bar');
  var barText = document.getElementById('chat-quote-text');
  if (bar && barText) {
    barText.innerHTML = '<span class="chat-quote-label">' + Core.escapeHtml(_pendingQuote.from + '：') + '</span>' + _quoteContentHtml(_pendingQuote);
    bar.style.display = 'flex';
  }
  var input = document.getElementById('chat-input');
  if (input) input.focus();
}

/* 引用内容 HTML：表情包/图片直接渲染图片，其余渲染文本 */
function _quoteContentHtml(quote) {
  if (!quote) return '';
  if (quote.stickerData) {
    var stk = ChatMedia.imgSrcFor(quote.stickerData);
    return '<img src="' + stk.src + '"' + (stk.ref ? ' data-media-ref="' + stk.ref + '"' : '') + ' class="msg-quote-img" alt="表情">';
  }
  if (quote.imageData) {
    var img = ChatMedia.imgSrcFor(quote.imageData);
    return '<img src="' + img.src + '"' + (img.ref ? ' data-media-ref="' + img.ref + '"' : '') + ' class="msg-quote-img" alt="图片">';
  }
  return (quote.text || '');
}

/* 气泡正文文本 HTML（微信/QQ 式纯 CSS 自适应折行）：
   - 仅做安全转义 + 保留手动换行（\n → <br>），不做任何字符清理/硬断行；
   - 气泡宽度由内容文本撑开（短消息窄窄包裹），长消息在 CSS max-width
     （= 当前设备屏幕最大可承受宽度）处由浏览器自然折行；
   - 断行完全交给 CSS（word-break/overflow-wrap），与字号、页面缩放、移动端
     "调节字体大小"非等比放大彻底解耦，不再出现半截回车/提前分行。 */
function _bubbleTextHtml(text) {
  return Core.escapeHtml(String(text == null ? '' : text)).replace(/\n/g, '<br>');
}

/* 点击引用条：滚动定位到被引用消息并高亮闪烁 */
function scrollToQuoteMessage(msgId, quoteText) {
  var container = document.getElementById('chat-messages');
  if (!container) {
    if (Core && Core.toast) Core.toast('被引用的消息已不存在');
    return;
  }
  var rows = container.querySelectorAll('.message-row');
  var target = null;
  // 优先按消息 ID 精确匹配（遍历 DOM，避免选择器对特殊字符/类型不敏感导致误判）
  if (msgId) {
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].getAttribute('data-msg-id')) === String(msgId)) {
        target = rows[i];
        break;
      }
    }
  }
  // 历史/自动回复产生的引用可能未携带 ID：按引用文本回退查找最近一条文本一致的消息
  if (!target && quoteText) {
    var qText = String(quoteText).replace(/\s+/g, '');
    for (var j = rows.length - 1; j >= 0; j--) {
      var bubble = rows[j].querySelector('.message-bubble');
      if (!bubble) continue;
      var bubbleText = bubble.textContent || '';
      // 去掉气泡内引用块的文本，只比对消息本体
      var qr = bubble.querySelector('.msg-quote-ref');
      if (qr) bubbleText = bubbleText.replace(qr.textContent || '', '');
      if (bubbleText.replace(/\s+/g, '') === qText) {
        target = rows[j];
        break;
      }
    }
  }
  if (!target) {
    if (Core && Core.toast) Core.toast('被引用的消息已不存在');
    return;
  }
  if (target.scrollIntoView) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  target.classList.remove('msg-quote-highlight');
  // 等平滑滚动基本结束后再触发高亮动画，避免滚动途中强制重排导致气泡“消失再出现”
  setTimeout(function() {
    void target.offsetWidth;
    target.classList.add('msg-quote-highlight');
    setTimeout(function() {
      target.classList.remove('msg-quote-highlight');
    }, 1600);
  }, 420);
}

function cancelQuoteReply() {
  _pendingQuote = null;
  var bar = document.getElementById('chat-quote-bar');
  if (bar) bar.style.display = 'none';
}

function renderChatMessages(chatId, opts) {
  var container = document.getElementById('chat-messages');
  if (!container) return;

  var messages = Storage.getMessages(chatId);
  var myProfile = Storage.getMyProfile();
  var isGroup = isGroupChatId(chatId);
  var preserveScroll = !!(opts && opts.preserveScroll);
  // 标记本次渲染是否需在图片异步填充后重新滚动到底（发送决策卡等含图场景）
  var _needScrollToBottomAfterRefs = false;

  // 分批渲染：只渲染消息数组尾部最近 count 条（ZY3 同款策略 displayedMessageCount + HISTORY_BATCH_SIZE），
  // 消息再多也只构建一屏 DOM，彻底解决千条记录全量 innerHTML 替换导致的卡顿
  var count = _getDisplayedCount(chatId);
  var startIndex = Math.max(0, messages.length - count);
  var msgsToRender = messages.slice(startIndex);

  // 小黑屋名单（单聊与群聊通用；被关入的成员发消息会附带「已被打入冷宫」标签）
  var blackRoomIds = [];
  var _br = Storage.get('blackRoom_' + chatId, []);
  blackRoomIds = Array.isArray(_br) ? _br : [];
  // 最近一次黑屋开启时刻（标签仅出现在开启后发送的消息上）
  var blackEnabledAt = Storage.get('blackRoomEnabledAt_' + chatId, 0) || 0;

  // 获取当前聊天对象资料（用于渲染头像）
  var chatPartner = null;
  if (_chatCurrentPartnerId && !isGroup) {
    var allPartners = Storage.getPartnerProfiles();
    for (var pi = 0; pi < allPartners.length; pi++) {
      if (allPartners[pi].id === _chatCurrentPartnerId) { chatPartner = allPartners[pi]; break; }
    }
  }
  // 群聊成员映射（发言人头像/昵称）
  var groupPartnerMap = {};
  if (isGroup) {
    var groupObj = getGroupByChatId(chatId);
    var gMembers = groupObj ? getGroupMembers(groupObj) : [];
    gMembers.forEach(function(m) { groupPartnerMap[m.id] = m; });
  }
  var selfAvatarHtml = _buildMessageAvatar(myProfile);
  var otherAvatarHtml = _buildMessageAvatar(chatPartner);

  // sync persisted red packet state（仅对渲染窗口内的消息同步，避免消息多时反复读 localStorage 造成卡顿）
  // 同时进行黑屋消息级持久标记：命中名单则打上 blackRoom 标记，渲染完成后统一持久化
  var newBlackMarked = false;
  msgsToRender.forEach(function(msg) {
    if (_fixBlackRoomMark(msg, blackRoomIds, blackEnabledAt, isGroup)) newBlackMarked = true;
    if (msg.msgType === 'redpacket') {
      var saved = RedPacketStorage.load(chatId, msg.id);
      if (saved) {
        msg.claimed = saved.claimed;
        msg.returned = saved.returned;
        msg.amount = saved.amount;
        msg.selfAmount = saved.selfAmount || 0;
        msg.otherAmount = saved.otherAmount || 0;
        msg.totalAmount = saved.totalAmount || msg.totalAmount;
        msg.count = saved.count || msg.count;
        msg.rpType = saved.rpType || msg.rpType;
        msg.greeting = saved.greeting || msg.greeting;
      }
    }
  });

  // DocumentFragment 批量构建 DOM：减少重排/重绘，比字符串拼接 + innerHTML 整体替换更平滑
  var fragment = document.createDocumentFragment();
  var lastDate = '';
  // 分批渲染：以切片前一条消息的日期作为日期分割线基线，避免窗口首条误加/漏加分割线
  if (startIndex > 0) {
    lastDate = Core.formatDate(messages[startIndex - 1].time);
  }

  // 群聊公告：置顶居中气泡
  if (isGroup) {
    var gObj = getGroupByChatId(chatId);
    if (gObj && gObj.announcement) {
      var annDiv = document.createElement('div');
      annDiv.className = 'group-announcement-bubble';
      annDiv.innerHTML = '<div class="group-announcement-inner">'
        + '<div class="group-announcement-label"><i class="fas fa-bullhorn"></i> 群公告</div>'
        + '<div class="group-announcement-text">' + Core.escapeHtml(gObj.announcement) + '</div>'
        + (gObj.announcementTime ? '<div class="group-announcement-meta">发布于 ' + Core.formatTime(gObj.announcementTime) + '</div>' : '')
        + '</div>';
      fragment.appendChild(annDiv);
    }
  }

  // 顶部「加载更多历史」触发器：仅当还有更多未渲染的历史消息时显示（点击加载；滚动到顶也可触发）
  if (startIndex > 0) {
    var loader = document.createElement('div');
    loader.className = 'history-loader';
    loader.id = 'history-loader';
    loader.innerHTML = '<i class="fas fa-chevron-up"></i> 加载更多历史';
    loader.addEventListener('click', function() { loadMoreHistory(chatId); });
    fragment.appendChild(loader);
  }

  var todayDateStr = Core.formatDate(new Date());
  msgsToRender.forEach(function(msg) {
    var msgDate = Core.formatDate(msg.time);
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      // 日期分隔线：同日仅插入一次；当天分隔线同样稳定渲染，不随重建/刷新消失，也不重复
      var divider = document.createElement('div');
      divider.className = 'chat-date-divider';
      divider.textContent = msgDate;
      fragment.appendChild(divider);
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = _buildSingleMessageHtml(msg, {
      isSelf: msg.type === 'self',
      selfAvatarHtml: selfAvatarHtml,
      otherAvatarHtml: otherAvatarHtml,
      blackRoomIds: blackRoomIds,
      blackEnabledAt: blackEnabledAt,
      isGroup: isGroup,
      groupPartnerMap: groupPartnerMap
    });
    while (wrap.firstChild) fragment.appendChild(wrap.firstChild);
  });

  // 记录旧滚动位置（保留滚动场景：加载更多历史时保持锚点，不跳到底部）
  var oldScrollHeight = container.scrollHeight;
  var oldScrollTop = container.scrollTop;

  container.innerHTML = '';
  container.appendChild(fragment);

  if (preserveScroll) {
    // 顶部新增内容使 scrollHeight 增加：补偿滚动位置，保持当前视觉锚点
    container.scrollTop = oldScrollTop + (container.scrollHeight - oldScrollHeight);
  } else if (_pendingScrollMsgId) {
    // 定位到指定消息（全局搜索跳转）并高亮
    var targetRow = container.querySelector('.message-row[data-msg-id="' + _pendingScrollMsgId + '"]');
    if (targetRow) {
      var rect = targetRow.getBoundingClientRect();
      var cRect = container.getBoundingClientRect();
      container.scrollTop = container.scrollTop + (rect.top - cRect.top) - container.clientHeight / 2;
      targetRow.classList.add('msg-highlight');
      setTimeout(function() { targetRow.classList.remove('msg-highlight'); }, 2200);
    }
    _pendingScrollMsgId = null;
  } else {
    container.scrollTop = container.scrollHeight;
    _needScrollToBottomAfterRefs = true;
  }
  bindChatTapMenu(container);

  // 黑屋标记持久化：渲染期间有新命中的消息时写回存储，关闭黑屋后标签不丢失
  if (newBlackMarked) Storage.setMessages(chatId, messages);

  // 为尚未安排已读回执的自我消息补调度（含页面刷新后的恢复）
  reschedulePendingReads(chatId);

  // 绑定滚动加载更多历史（每个容器只绑一次）
  _installHistoryLoaderScroll();

  // 异步还原 IndexedDB 引用的大图/大表情（引用渲染为占位图后在此填充真实数据）
  ChatMedia.resolveDomRefs(container, function() {
    if (_needScrollToBottomAfterRefs) {
      container.scrollTop = container.scrollHeight;
      setTimeout(function() { container.scrollTop = container.scrollHeight; }, 0);
    }
  });
}

/* 加载更多历史消息：增加渲染条数并重渲染，隐藏容器避免闪烁，保持锚点滚动位置（参考 ZY3 loadMoreHistory） */
function loadMoreHistory(chatId) {
  var container = document.getElementById('chat-messages');
  if (!container || !chatId) return;
  if (_isLoadingHistory) return;
  var messages = Storage.getMessages(chatId);
  var count = _getDisplayedCount(chatId);
  if (count >= messages.length) {
    var loaderNone = document.getElementById('history-loader');
    if (loaderNone) loaderNone.style.display = 'none';
    return;
  }
  _isLoadingHistory = true;
  var loader = document.getElementById('history-loader');
  if (loader) loader.style.display = 'flex';

  // 记录当前可见的第一条消息作为锚点（保持滚动位置）
  var rows = container.querySelectorAll('.message-row');
  var firstVisible = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].offsetTop + rows[i].offsetHeight >= container.scrollTop) {
      firstVisible = rows[i];
      break;
    }
  }
  var anchorId = firstVisible ? firstVisible.getAttribute('data-msg-id') : null;
  var anchorTop = firstVisible ? firstVisible.getBoundingClientRect().top : 0;

  // 隐藏容器：避免批量插入时产生滚动跳动/闪烁
  var prevVisibility = container.style.visibility;
  var prevOverflow = container.style.overflow;
  container.style.visibility = 'hidden';
  container.style.overflow = 'hidden';

  setTimeout(function() {
    _displayedMsgCounts[chatId] = Math.min(messages.length, count + HISTORY_BATCH_SIZE);
    renderChatMessages(chatId, { preserveScroll: true });
    requestAnimationFrame(function() {
      // 锚点微调：若锚点消息存在则补偿其位置变化（双保险，scrollHeight 补偿已覆盖大部分场景）
      if (anchorId) {
        var newAnchor = container.querySelector('.message-row[data-msg-id="' + anchorId + '"]');
        if (newAnchor) {
          var newTop = newAnchor.getBoundingClientRect().top;
          container.scrollTop += (newTop - anchorTop);
        }
      }
      requestAnimationFrame(function() {
        container.style.visibility = prevVisibility || '';
        container.style.overflow = prevOverflow || '';
        var loaderEl = document.getElementById('history-loader');
        var total = Storage.getMessages(chatId).length;
        if (loaderEl) loaderEl.style.display = (total > _getDisplayedCount(chatId)) ? 'flex' : 'none';
        _isLoadingHistory = false;
      });
    });
  }, 30);
}

/* 滚动到顶部附近时自动加载更多历史（与顶部点击触发器并存；每个容器仅绑定一次） */
function _installHistoryLoaderScroll() {
  var container = document.getElementById('chat-messages');
  if (!container || container._historyScrollBound) return;
  container._historyScrollBound = true;
  var _lastLoadAt = 0;
  container.addEventListener('scroll', function() {
    if (_isLoadingHistory) return;
    var now = Date.now();
    if (now - _lastLoadAt < 400) return; // 简单节流，防止滚动过程频繁触发
    var room = document.getElementById('page-chat-room');
    var curChatId = room ? room.dataset.chatId : '';
    if (!curChatId) return;
    if (container.scrollTop <= 60) {
      _lastLoadAt = now;
      loadMoreHistory(curChatId);
    }
  });
}

/* 构建单条消息 HTML（全量渲染 renderChatMessages 与增量追加 appendMessage 共用；不含日期分割线） */
/* 消息级黑屋持久标记：命中黑屋名单则给消息打上 blackRoom 标记并持久化；
   关闭黑屋后 blackRoomIds 清空，历史已标记消息仍保留「已被打入冷宫」标签 */
function _fixBlackRoomMark(msg, blackRoomIds, blackEnabledAt, isGroup) {
  if (!msg) return false;
  if (msg.blackRoom === true) return true;
  var hit = false;
  if (isGroup) {
    hit = !!(msg.fromId && blackRoomIds.indexOf(msg.fromId) !== -1 && msg.time >= blackEnabledAt);
  } else {
    hit = !!(blackRoomIds.length > 0 && msg.time >= blackEnabledAt);
  }
  if (hit) msg.blackRoom = true;
  return hit;
}

function _buildSingleMessageHtml(msg, opts) {
  if (!msg) return '';
  var isSelf = opts.isSelf;
  var isGroup = opts.isGroup;
  var blackRoomIds = opts.blackRoomIds || [];
  var blackEnabledAt = opts.blackEnabledAt || 0;
  var groupPartnerMap = opts.groupPartnerMap || {};
  var rowSelfAvatar = opts.selfAvatarHtml;
  var rowOtherAvatar = opts.otherAvatarHtml;
  var senderName = '';
  var senderStatusHtml = '';
  var rowGroupCls = '';
  if (isGroup && !isSelf) {
    rowGroupCls = ' in-group';
    var fromP = msg.fromId ? groupPartnerMap[msg.fromId] : null;
    if (fromP) {
      rowOtherAvatar = _buildMessageAvatar(fromP);
      senderName = fromP.nickname || '成员';
      senderStatusHtml = _groupMemberStatusHtml(fromP);
    } else {
      senderName = '成员';
    }
  }
  var html = '';
  if (msg.isPat) {
    // 拍一拍（居中气泡，粉红色系，方形圆角5，类似撤回/黑屋通知）
    var patSym = _patSymbolForMsg(msg);
    var patSymBase = String(patSym || '').replace(/\uFE0E/g, '');
    var patIconHtml = (patSymBase === '♥' && window.PAT_ICON_SVG)
      ? PAT_ICON_SVG
      : Core.escapeHtml(patSym);
    html += '<div class="message-pat">'
      + '<span class="pat-icon">' + patIconHtml + '</span>'
      + Core.escapeHtml(msg.text || '')
      + '<span class="pat-icon">' + patIconHtml + '</span>'
      + '</div>';
  } else if (msg.isBlackNotice) {
    // 黑屋通知（居中气泡，粉红色系，方形圆角5）
    var bnText = msg.text || '';
    var bnMatch = /^\[黑屋通知·([^\]]*)\]\s*/.exec(bnText);
    var bnTarget = bnMatch ? bnMatch[1] : '';
    var bnBody = bnMatch ? bnText.slice(bnMatch[0].length) : bnText;
    html += '<div class="message-black-notice">'
      + (bnTarget ? '<span class="black-notice-target">' + Core.escapeHtml(bnTarget) + '</span>：' : '')
      + Core.escapeHtml(bnBody)
      + '</div>';
  } else if (msg.isPunish) {
    // 惩罚通知（居中气泡，红色系，方形圆角5，类似撤回/黑屋通知）
    var pnText = msg.text || '';
    var pnMatch = /^\[惩罚·([^\]]*)\]\s*/.exec(pnText);
    var pnTarget = pnMatch ? pnMatch[1] : '';
    var pnBody = pnMatch ? pnText.slice(pnMatch[0].length) : pnText;
    html += '<div class="message-punish">'
      + '<span class="punish-icon">' + PUNISH_ICON_SVG + '</span>'
      + (pnTarget ? '<span class="punish-target">' + Core.escapeHtml(pnTarget) + '</span>：' : '')
      + Core.escapeHtml(pnBody)
      + '</div>';
  } else if (msg.isCall) {
    // 通话事件（居中气泡，类似撤回提示）；未接/拒接为粉红色，已接通为浅色默认样式
    var callCls = '';
    if (msg.callStatus === 'missed' || msg.callStatus === 'rejected') {
      callCls = ' call-warn';
    }
    html += '<div class="message-recall message-call' + callCls + '">' + Core.escapeHtml(msg.text || '') + '</div>';
  } else if (msg.isRecall) {
    // 撤回提示（居中气泡）
    var showRecallContent = Storage.getShowRecallContent();
    var recallText = (msg.text || (msg.type === 'self' ? '你撤回了一条消息' : ((msg.recallName || '对方') + '撤回了一条消息'))).replace(/【来自手机的消息】/g, '');
    var recallIsBlack = msg.blackRoom === true;
    if (!recallIsBlack && !isSelf) {
      if (isGroup) {
        recallIsBlack = !!(msg.fromId && blackRoomIds.indexOf(msg.fromId) !== -1 && msg.time >= blackEnabledAt);
      } else {
        recallIsBlack = !!(blackRoomIds.length > 0 && msg.time >= blackEnabledAt);
      }
    }
    if (showRecallContent && msg.recalledContent) {
      var recallSuffix = '';
      if (recallIsBlack) {
        recallSuffix = '<span class="msg-recall-tags">'
          + '<span class="msg-black-room-tag">已被打入冷宫</span>'
          + '<span class="msg-recalled-tag">已撤回</span>'
          + '</span>';
      } else {
        recallSuffix = '<span class="msg-recalled-tag">已撤回</span>';
      }
      html += _buildNormalMessageHtml(_rebuildRecalledMsg(msg), isSelf, rowSelfAvatar, rowOtherAvatar, recallSuffix, senderName, senderStatusHtml, rowGroupCls);
    }
    html += '<div class="message-recall recall-near">' + Core.escapeHtml(recallText) + '</div>';
  } else if (msg.isMailNotice) {
    // 时空信箱公告（居中气泡，小清新风格）
    var mnText = msg.text || '';
    html += '<div class="mail-announce">'
      + '<div class="mail-announce-bubble">'
      + '<span class="mail-announce-icon"><i class="fas fa-envelope-open-text"></i></span>'
      + '<span class="mail-announce-text">' + Core.escapeHtml(mnText) + '</span>'
      + '</div></div>';
  } else {
    // 被关入小黑屋的成员发消息，气泡后附带「已被打入冷宫」标签（群聊按 fromId，单聊非自己消息且名单非空）
    var blackSuffix = '';
    var senderBlack = msg.blackRoom === true;
    if (!senderBlack && !isSelf) {
      if (isGroup) {
        senderBlack = !!(msg.fromId && blackRoomIds.indexOf(msg.fromId) !== -1 && msg.time >= blackEnabledAt);
      } else {
        senderBlack = !!(blackRoomIds.length > 0 && msg.time >= blackEnabledAt);
      }
    }
    if (senderBlack) {
      blackSuffix = '<span class="msg-black-room-tag">已被打入冷宫</span>';
    }
    // 被 TA 悄悄收藏过：我方消息气泡下方回显「对方悄悄收藏了这条」标签（方形圆角5，持久标记随消息存储）
    if (isSelf && msg.hisFavorited) {
      blackSuffix += '<span class="msg-fav-tag">对方悄悄收藏了这条</span>';
    }
    html += _buildNormalMessageHtml(msg, isSelf, rowSelfAvatar, rowOtherAvatar, blackSuffix, senderName, senderStatusHtml, rowGroupCls);
  }
  return html;
}

/* 构建普通消息 HTML（文本/表情/图片/红包；suffixHtml 追加在气泡后面，senderName 为群聊发言人昵称） */
/* 群聊成员在线/情绪状态（角色自定义优先，未设置则随机并缓存） */
var _groupMemberStatusCache = {};
function _groupMemberStatusOf(member) {
  if (!member) return { online: '', mood: '' };
  var id = member.id;
  if (!_groupMemberStatusCache[id]) {
    var online = member.onlineStatus || CHAT_ONLINE_STATUSES[Math.floor(Math.random() * CHAT_ONLINE_STATUSES.length)].text;
    var mood = member.moodStatus || CHAT_MOOD_STATUSES[Math.floor(Math.random() * CHAT_MOOD_STATUSES.length)];
    _groupMemberStatusCache[id] = { online: online, mood: mood };
  }
  return _groupMemberStatusCache[id];
}
function _groupMemberStatusHtml(member) {
  var st = _groupMemberStatusOf(member);
  if (!st) return '';
  var parts = [];
  if (st.online) parts.push('<span class="group-sender-online">' + Core.escapeHtml(st.online) + '</span>');
  if (st.mood) parts.push('<span class="group-sender-mood">' + Core.escapeHtml(st.mood) + '</span>');
  if (!parts.length) return '';
  return '<span class="group-sender-status">' + parts.join('<span class="group-sender-sep">·</span>') + '</span>';
}

function _buildNormalMessageHtml(msg, isSelf, selfAvatarHtml, otherAvatarHtml, suffixHtml, senderName, senderStatusHtml, rowGroupCls) {
  var html = '';
  // 无指派气泡时走默认气泡样式；气泡商城指派/导入的气泡由下方 buildBubbleExt 应用扩展类
  var senderHtml = '';
  if (senderName) {
    senderHtml = '<div class="message-sender-name">' + Core.escapeHtml(senderName)
      + (senderStatusHtml || '') + '</div>';
  }
  if (msg.msgType === 'sticker') {
    var stkSrc = ChatMedia.imgSrcFor(msg.stickerData);
    html += '<div class="message-row sticker-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          + '<img src="' + stkSrc.src + '"' + (stkSrc.ref ? ' data-media-ref="' + stkSrc.ref + '"' : '') + ' class="message-sticker-direct" alt="表情">'
          + suffixHtml
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  } else if (msg.msgType === 'doodle') {
    var doodleSrc = ChatMedia.imgSrcFor(msg.stickerData);
    html += '<div class="message-row sticker-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          + '<img src="' + doodleSrc.src + '"' + (doodleSrc.ref ? ' data-media-ref="' + doodleSrc.ref + '"' : '') + ' class="message-sticker-direct" alt="涂鸦">'
          + suffixHtml
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  } else if (msg.msgType === 'image') {
    var imgSrc = ChatMedia.imgSrcFor(msg.imageData);
    html += '<div class="message-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          + '<img src="' + imgSrc.src + '"' + (imgSrc.ref ? ' data-media-ref="' + imgSrc.ref + '"' : '') + ' class="message-image" alt="图片">'
          + suffixHtml
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  } else if (msg.msgType === 'redpacket') {
    var isClaimed = msg.claimed;
    var isReturned = msg.returned;
    var bubbleCls = 'redpacket-bubble';
    if (isClaimed) bubbleCls += ' claimed';
    else if (isReturned) bubbleCls += ' returned';
    // 用单引号包裹参数：此前双引号内嵌 onclick 属性导致 HTML 解析提前截断，
    // onClick 变成 showRedPacketAction( 触发语法错误，红包无法点击领取
    var clickHandler = (isClaimed || isReturned) ? "showClaimedDetail('" + String(msg.id) + "')" : "showRedPacketAction('" + String(msg.id) + "')";
    var greetingText = msg.greeting || '恭喜发财，大吉大利';
    var gLen = greetingText.length;
    var gFont = gLen <= 6 ? '0.95rem' : (gLen <= 9 ? '0.88rem' : (gLen <= 13 ? '0.8rem' : (gLen <= 18 ? '0.72rem' : (gLen <= 24 ? '0.64rem' : (gLen <= 28 ? '0.56rem' : '0.5rem')))));
    var rpAmount = msg.totalAmount || msg.amount || 0;
    // 金额直接显示完整具体数字，不做单位缩写
    var amtText = '¥' + formatRpAmountDisplay(rpAmount);
    var amtFont = amtText.length > 9 ? '0.8rem' : (amtText.length > 7 ? '0.9rem' : '1.08rem');
    html += '<div class="message-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          + '<div class="' + bubbleCls + '" onclick="' + clickHandler + '">'
          + (isReturned ? '<div class="rp-status">已退回</div>' : '')
          + '<div class="rp-content">'
          + '<div class="rp-medallion">' + GOLD_RED_PACKET_ICON_SVG + '</div>'
          + '<div class="rp-texts">'
          + '<div class="rp-line-top">'
          + '<div class="rp-amount" style="font-size:' + amtFont + '">' + amtText + '</div>'
          + '</div>'
          + '<div class="rp-greeting" style="font-size:' + gFont + '">' + Core.escapeHtml(greetingText) + '</div>'
          + '</div>'
          + '</div>'
          + '</div>'
          + suffixHtml
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  } else if (msg.msgType === 'gift') {
    // 商城礼物卡片气泡：点击可跳转商城记录查看
    var gData = msg.gift || {};
    var gName = gData.name || '神秘礼物';
    var gIcon = gData.icon || '🎁';
    var gPrice = gData.price || 0;
    var gGreeting = gData.greeting || '';
    html += '<div class="message-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          + '<div class="message-bubble gift-bubble">'
          + '<div class="gift-card">'
          + '<div class="gift-card-head">'
          + '<span class="gift-card-icon">' + gIcon + '</span>'
          + '<span class="gift-card-name">' + Core.escapeHtml(gName) + '</span>'
          + '</div>'
          + (gGreeting ? '<div class="gift-card-greeting">' + Core.escapeHtml(gGreeting) + '</div>' : '')
          + '<div class="gift-card-foot">'
          + '<span class="gift-card-tag"><i class="fas fa-store"></i> 拾心商城</span>'
          + '<span class="gift-card-price">¥' + gPrice + '</span>'
          + '</div>'
          + '</div>'
          + '</div>'
          + suffixHtml
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  } else if (msg.msgType === 'voice') {
    var voiceDur = msg.duration || 3;
    var voiceSrc = msg.audioData || msg.audioUrl || '';
    var voiceText = msg.voiceText || '';
    html += '<div class="message-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          + '<div class="message-bubble voice-bubble" onclick="playVoiceMsg(this)" data-dur="' + voiceDur + '"' + (voiceSrc ? ' data-audio="' + voiceSrc + '"' : '') + '>'
          + '<i class="fas fa-volume-up voice-icon"></i>'
          + '<span class="voice-wave"><span></span><span></span><span></span><span></span><span></span></span>'
          + '<span class="voice-duration">' + voiceDur + '"</span>'
          + '</div>'
          + (voiceText
              ? '<span class="voice-trans-btn" onclick="toggleVoiceText(this)">转文字</span>'
                + '<div class="voice-text-box" style="display:none">' + Core.escapeHtml(voiceText) + '</div>'
              : '')
          // 语音气泡不附加黑屋冷宫标签（保留撤回标签）
          + (suffixHtml || '').replace(/<span class="msg-black-room-tag">[^<]*<\/span>/g, '')
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  } else {
    var quoteHtml = '';
    if (msg.quote && (msg.quote.text || msg.quote.stickerData || msg.quote.imageData)) {
      var qIdAttr = msg.quote.msgId ? ' data-quote-id="' + msg.quote.msgId + '"' : '';
      quoteHtml = '<span class="msg-quote-ref"' + qIdAttr + '>' + _quoteContentHtml(msg.quote) + '</span>';
    }
    // 气泡商城：应用指派/导入气泡的扩展类与装饰（无指派时 extraCls 为空串，走默认气泡样式）
    var bubExt = (window.BubbleMaker && typeof BubbleMaker.buildBubbleExt === 'function') ? BubbleMaker.buildBubbleExt(msg, isSelf) : null;
    var bubCls = bubExt ? (bubExt.extraCls || '') : '';
    var bubDeco = bubExt ? (bubExt.deco || '') : '';
    html += '<div class="message-row ' + (isSelf ? 'self' : 'other' + rowGroupCls) + '" data-msg-id="' + msg.id + '">'
          + (isSelf ? selfAvatarHtml : otherAvatarHtml)
          + '<div class="message-body">'
          + senderHtml
          // 心流状态：对方角色回复气泡随机标注情绪含义标签（带情绪分类颜色，增强表达）
          + '<div class="message-bubble' + bubCls + '">' + bubDeco + quoteHtml + '<div class="bubble-text">' + _bubbleTextHtml(msg.text) + '</div></div>'
          // 心流状态：情绪标签与撤回/黑屋标签横排一行（心流在左、撤回/黑屋在右）
          + '<div class="message-tags-row">' + _moodLabelHtml(msg) + suffixHtml + '</div>'
          + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
          + '</div>'
          + '</div>';
  }
  return html;
}

/* 心流状态：对方角色文本消息的气泡情绪含义标签 HTML（带情绪分类颜色）；无标注时返回空串 */
function _moodLabelHtml(msg) {
  try {
    if (!msg || msg.type !== 'other' || msg.isRecall) return '';
    if (!msg.moodIntent || !msg.moodIntent.text) return '';
    if (window.MoodFlowApp && typeof window.MoodFlowApp.intentHtml === 'function') {
      return window.MoodFlowApp.intentHtml(msg.moodIntent, msg.moodIntent.color);
    }
  } catch (e) {}
  return '';
}

/* 构建已读状态 HTML（仅我方发送的消息显示；图形 ✓/✓✓、文字 已读/未读、心形 ♡/❤） */
function _buildReadStatusHtml(msg) {
  if (!msg || msg.type !== 'self' || msg.isRecall || msg.isCall) return '';
  if (!Storage.getReadReceipt()) return '';
  var read = !!msg.read;
  var mode = Storage.getReadReceiptMode();
  if (mode === 'text') {
    return '<span class="msg-read-status msg-read-text ' + (read ? 'read' : 'unread') + '">' + (read ? '已读' : '未读') + '</span>';
  }
  return '<span class="msg-read-status msg-read-icon ' + (read ? 'read' : 'unread') + '">' + (read ? '<span class="tick">✓✓</span>' : '✓') + '</span>';
}

/* 已读回执局部更新：仅刷新单条消息的已读状态，不重建消息列表（性能优化第二批 P1-1） */
function updateMessageReadStatus(chatId, msgId) {
  var row = document.querySelector('#chat-messages .message-row[data-msg-id="' + msgId + '"]');
  if (!row) return;
  var statusEl = row.querySelector('.msg-read-status');
  if (!statusEl) return;
  var mode = Storage.getReadReceiptMode();
  if (mode === 'text') {
    statusEl.textContent = '已读';
    statusEl.className = 'msg-read-status msg-read-text read';
  } else {
    statusEl.innerHTML = '<span class="tick">✓✓</span>';
    statusEl.className = 'msg-read-status msg-read-icon read';
  }
}

/* 从撤回消息中重建原消息（用于「显示撤回内容」） */
function _rebuildRecalledMsg(msg) {
  var c = msg.recalledContent || {};
  return {
    id: msg.id,
    type: msg.type,
    fromId: msg.fromId || '',
    time: msg.time,
    msgType: c.msgType || 'text',
    text: c.text || '',
    quote: c.quote || null,
    moodIntent: c.moodIntent || null,
    decision: c.decision || null,
    greeting: c.greeting || '',
    claimed: !!c.claimed,
    amount: c.amount,
    rpType: c.rpType,
    totalAmount: c.totalAmount,
    count: c.count,
    stickerData: c.stickerData || '',
    imageData: c.imageData || '',
    duration: c.duration || 3,
    audioUrl: c.audioUrl || '',
    audioData: c.audioData || '',
    audioMime: c.audioMime || '',
    voiceText: c.voiceText || '',
    gift: c.gift || null
  };
}

/* 构建聊天消息头像 HTML */
function _buildMessageAvatar(profile) {
  if (!profile) return '';
  var text = profile.avatar || profile.nickname || '';
  if (text.length > 1) text = text.charAt(0);
  var color = profile.avatarColor || '#A090B0';
  var shape = (profile.avatarShape === 'square') ? '8px' : '50%';
  if (profile.avatarImage) {
    return '<div class="message-avatar" style="background:' + color + ';background-image:url(' + profile.avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat;border-radius:' + shape + '"></div>';
  }
  return '<div class="message-avatar" style="background:' + color + ';border-radius:' + shape + '">' + Core.escapeHtml(text || '?') + '</div>';
}

/* ============================================================
   语音消息：输入栏语音模式（点击录音，真实录入声音，最长 5 分钟）+ 语音气泡真实播放
   ============================================================ */
var _voiceMode = false;
var _voiceRecording = false;
var _voiceStartTime = 0;
var _voiceStream = null;
var _mediaRecorder = null;
var _voiceChunks = [];
var _voiceTimer = null;
var _voiceSeconds = 0;
var _voiceSpeechRec = null;
var _voiceSpeechText = '';
var _voiceBlob = null;
var _voiceMaxSeconds = 300; // 最长 5 分钟

function toggleVoiceMode() {
  _voiceMode = !_voiceMode;
  var input = document.getElementById('chat-input');
  var holdBtn = document.getElementById('chat-voice-hold');
  var voiceBtn = document.getElementById('chat-voice-btn');
  var emojiBtn = document.getElementById('chat-emoji-btn');
  var plusBtn = document.getElementById('chat-plus-btn');
  var sendBtn = document.getElementById('chat-send-btn');
  if (!input || !holdBtn || !voiceBtn) return;
  closePlusMenu();
  closeStickerPanel();
  if (_voiceMode) {
    input.style.display = 'none';
    holdBtn.style.display = 'flex';
    if (emojiBtn) emojiBtn.style.display = 'none';
    if (plusBtn) plusBtn.style.display = 'none';
    if (sendBtn) sendBtn.style.display = 'none';
    voiceBtn.classList.add('active');
  } else {
    if (_voiceRecording) stopRealVoiceRecord(true);
    input.style.display = '';
    holdBtn.style.display = 'none';
    holdBtn.textContent = '点击 说话';
    holdBtn.classList.remove('recording');
    if (emojiBtn) emojiBtn.style.display = '';
    if (plusBtn) plusBtn.style.display = '';
    if (sendBtn) sendBtn.style.display = (input.value && input.value.trim()) ? 'flex' : 'none';
    voiceBtn.classList.remove('active');
  }
}

/* 点击语音输入框（语音模式）：启动或结束录音 */
function onVoiceHoldClick() {
  if (_voiceRecording) {
    stopRealVoiceRecord(false);
  } else {
    startRealVoiceRecord();
  }
}

/* 开始真实录音（MediaRecorder + 麦克风，最长 5 分钟） */
function startRealVoiceRecord() {
  if (_voiceRecording) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (Core.toast) Core.toast('当前浏览器不支持录音');
    return;
  }
  var hold = document.getElementById('chat-voice-hold');
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    _voiceStream = stream;
    _voiceChunks = [];
    _voiceSpeechText = '';
    _voiceSeconds = 0;
    var mimeType = '';
    if (window.MediaRecorder) {
      var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      for (var i = 0; i < candidates.length; i++) {
        if (MediaRecorder.isTypeSupported(candidates[i])) { mimeType = candidates[i]; break; }
      }
    }
    try {
      _mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream);
    } catch (e) {
      _mediaRecorder = new MediaRecorder(stream);
    }
    _mediaRecorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) _voiceChunks.push(e.data);
    };
    _mediaRecorder.onstop = function() {
      var type = (_mediaRecorder && _mediaRecorder.mimeType) ? _mediaRecorder.mimeType : 'audio/webm';
      _voiceBlob = new Blob(_voiceChunks, { type: type });
      if (Core.toast) Core.toast('录音完成');
      showVoiceSendDialog();
    };
    _mediaRecorder.start(250);

    _voiceRecording = true;
    _voiceStartTime = Date.now();
    if (hold) {
      hold.classList.add('recording');
      hold.textContent = '录音中 0:00 · 点击结束';
    }
    startVoiceSpeechRec();
    _voiceTimer = setInterval(function() {
      _voiceSeconds++;
      var mm = String(Math.floor(_voiceSeconds / 60)).padStart(2, '0');
      var ss = String(_voiceSeconds % 60).padStart(2, '0');
      if (hold) hold.textContent = '录音中 ' + mm + ':' + ss + ' · 点击结束';
      if (_voiceSeconds >= _voiceMaxSeconds) {
        if (Core.toast) Core.toast('已达 5 分钟上限，自动结束录音');
        stopRealVoiceRecord(false);
      }
    }, 1000);
    if (Core.toast) Core.toast('正在录音，点击输入框结束（最长 5 分钟）');
  }).catch(function(err) {
    if (Core.toast) Core.toast('无法使用麦克风：' + (err && err.name ? err.name : '权限被拒绝'));
  });
}

/* 结束真实录音 */
function stopRealVoiceRecord(silent) {
  if (!_voiceRecording) return;
  _voiceRecording = false;
  if (_voiceTimer) { clearInterval(_voiceTimer); _voiceTimer = null; }
  stopVoiceSpeechRec();
  var hold = document.getElementById('chat-voice-hold');
  if (hold) {
    hold.classList.remove('recording');
    hold.textContent = '点击 说话';
  }
  try { if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop(); } catch (e) {}
  if (_voiceStream) {
    _voiceStream.getTracks().forEach(function(t) { t.stop(); });
    _voiceStream = null;
  }
}

/* 录音期间并行启动语音识别（用于「转文字发送」，Chrome 等支持） */
function startVoiceSpeechRec() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    _voiceSpeechRec = new SR();
    _voiceSpeechRec.lang = 'zh-CN';
    _voiceSpeechRec.continuous = true;
    _voiceSpeechRec.interimResults = false;
    _voiceSpeechRec.onresult = function(e) {
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          _voiceSpeechText += e.results[i][0].transcript;
        }
      }
    };
    _voiceSpeechRec.onerror = function() {};
    _voiceSpeechRec.start();
  } catch (e) { _voiceSpeechRec = null; }
}

function stopVoiceSpeechRec() {
  try { if (_voiceSpeechRec) _voiceSpeechRec.stop(); } catch (e) {}
  _voiceSpeechRec = null;
}

/* 录音完成弹窗：直接发送 / 转文字发送 / 取消 */
function showVoiceSendDialog() {
  closeVoiceSendDialog();
  var mm = String(Math.floor(_voiceSeconds / 60)).padStart(2, '0');
  var ss = String(_voiceSeconds % 60).padStart(2, '0');
  var html = '<div class="voice-send-overlay" id="voice-send-overlay" onclick="closeVoiceSendDialog()">'
    + '<div class="voice-send-panel" onclick="event.stopPropagation()">'
    + '<div class="voice-send-title">录音完成</div>'
    + '<div class="voice-send-dur">时长 ' + mm + ':' + ss + '，请选择发送方式</div>'
    + '<div class="voice-send-btns">'
    + '<button class="voice-send-btn send" onclick="voiceSendDirect()">直接发送</button>'
    + '<button class="voice-send-btn text" onclick="voiceSendText()">转文字发送</button>'
    + '<button class="voice-send-btn cancel" onclick="voiceSendCancel()">取消</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  var div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstChild);
}

function closeVoiceSendDialog() {
  var ov = document.getElementById('voice-send-overlay');
  if (ov) ov.remove();
}

/* 直接发送：把录音作为真实语音消息发送 */
function voiceSendDirect() {
  closeVoiceSendDialog();
  if (!_voiceBlob) return;
  var dur = Math.max(1, Math.round(_voiceSeconds));
  var url = URL.createObjectURL(_voiceBlob);
  // 短录音（<1.5MB）转 Base64 持久化，长录音仅保留会话内 blob URL
  var audioData = '';
  var voiceText = (_voiceSpeechText || '').trim();
  if (_voiceBlob.size < 1500000) {
    var reader = new FileReader();
    reader.onloadend = function() {
      audioData = reader.result || '';
      sendVoiceMessage(dur, url, audioData, _voiceBlob.type, voiceText);
    };
    reader.readAsDataURL(_voiceBlob);
    return;
  }
  sendVoiceMessage(dur, url, audioData, _voiceBlob.type, voiceText);
}

/* 转文字发送：优先使用录音期间识别的文本，发送文本消息 */
function voiceSendText() {
  closeVoiceSendDialog();
  var text = (_voiceSpeechText || '').trim();
  if (!text) {
    if (Core.toast) Core.toast('未能识别到文字（当前浏览器可能不支持语音转文字）');
    return;
  }
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var newMsg = { id: Date.now(), type: 'self', text: text, time: Date.now(), msgType: 'text', read: false };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, text);
  appendMessage(chatId, newMsg);
  if (App && App.playSound) App.playSound('send');
  scheduleAutoReply(chatId);
  if (Core.toast) Core.toast('已转文字发送');
}

/* 取消：丢弃录音 */
function voiceSendCancel() {
  closeVoiceSendDialog();
  _voiceBlob = null;
  if (Core.toast) Core.toast('已取消发送');
}

function sendVoiceMessage(duration, audioUrl, audioData, audioMime, voiceText) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var newMsg = {
    id: Date.now(),
    type: 'self',
    text: '[语音]',
    time: Date.now(),
    msgType: 'voice',
    read: false,
    duration: duration,
    audioUrl: audioUrl || '',
    audioData: audioData || '',
    audioMime: audioMime || '',
    voiceText: voiceText || ''
  };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, '[语音]');
  appendMessage(chatId, newMsg);
  if (App && App.playSound) App.playSound('send');
  scheduleAutoReply(chatId);
}

/* 全局语音播放器：同一时刻只允许一条语音播放，点击播放、再次点击暂停 */
var _voicePlayer = null;

/* 播放语音消息：有真实音频则用 Audio 播放，否则按旧逻辑模拟播放 */
function playVoiceMsg(el) {
  if (!el) return;
  // 再次点击正在播放的气泡：暂停播放
  if (_voicePlayer && _voicePlayer.el === el) {
    stopVoicePlayback();
    return;
  }
  // 切换播放：先停止当前正在播放的语音
  stopVoicePlayback();
  var audioSrc = el.getAttribute('data-audio');
  if (audioSrc) {
    var audio = new Audio(audioSrc);
    el.classList.add('playing');
    _voicePlayer = { audio: audio, el: el };
    audio.onended = function() { stopVoicePlayback(); };
    audio.onerror = function() { stopVoicePlayback(); };
    audio.play().catch(function() { stopVoicePlayback(); });
    return;
  }
  // 无真实音频：模拟播放，再次点击同样可停止
  var dur = parseFloat(el.getAttribute('data-dur')) || 3;
  el.classList.add('playing');
  _voicePlayer = {
    audio: null,
    el: el,
    timer: setTimeout(function() { stopVoicePlayback(); }, dur * 1000)
  };
}

/* 停止当前语音播放并清理播放状态 */
function stopVoicePlayback() {
  if (!_voicePlayer) return;
  var p = _voicePlayer;
  _voicePlayer = null;
  if (p.audio) { try { p.audio.pause(); p.audio = null; } catch (e) {} }
  if (p.timer) { clearTimeout(p.timer); p.timer = null; }
  if (p.el) { p.el.classList.remove('playing'); }
}

/* 语音转文字：展开/收起语音消息对应的识别文本 */
function toggleVoiceText(btn) {
  if (!btn) return;
  var box = btn.nextElementSibling;
  if (!box || !box.classList || !box.classList.contains('voice-text-box')) {
    if (Core && Core.toast) Core.toast('该语音暂无可转文字');
    return;
  }
  var hidden = box.style.display === 'none';
  box.style.display = hidden ? 'block' : 'none';
  btn.textContent = hidden ? '收起文字' : '转文字';
}

function onChatInputChange() {
  var input = document.getElementById('chat-input');
  var plusBtn = document.getElementById('chat-plus-btn');
  var sendBtn = document.getElementById('chat-send-btn');
  
  if (!input || !plusBtn || !sendBtn) return;

  // 多行输入高度自适应：随内容增高、封顶 120px，超出滚动
  if (input.tagName === 'TEXTAREA') {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  
  if (input.value.trim()) {
    plusBtn.style.display = 'none';
    sendBtn.style.display = 'flex';
  } else {
    plusBtn.style.display = 'flex';
    sendBtn.style.display = 'none';
  }
}

/* 点击输入栏输入文字时：仅弹出输入法，收起表情/加号面板，避免输入法与面板共现 */
function onChatInputFocus() {
  closeStickerPanel();
  closePlusMenu();
}

function sendMessage() {
  var input = document.getElementById('chat-input');
  if (!input || !input.value.trim()) return;
  
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  
  var text = input.value.trim();
  input.value = '';
  onChatInputChange();
  // 发送后保持输入框焦点，输入法不自动收起
  setTimeout(function() { input.focus(); }, 0);
  
  // 添加消息
  var messages = Storage.getMessages(chatId);
  var newMsg = { id: Date.now(), type: 'self', text: text, time: Date.now(), msgType: 'text', read: false };
  if (_pendingQuote) {
    newMsg.quote = {
      text: _pendingQuote.text,
      from: _pendingQuote.from,
      msgId: _pendingQuote.msgId || '',
      stickerData: _pendingQuote.stickerData || '',
      imageData: _pendingQuote.imageData || ''
    };
  }
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  
  // 发送后清除引用
  cancelQuoteReply();
  
  // 更新聊天列表
  updateLastMsg(chatId, text);
  
  // 增量追加单条消息（避免全量重建 DOM 卡顿）
  appendMessage(chatId, newMsg);
  App.playSound('send');

  // 聊天特效：发布包含关键词的消息时播放 emoji 特效
  var fx = matchChatEffect(text);
  if (fx) {
    setTimeout(function() { triggerChatEffect(fx); }, 350);
  }
  
  // 触发词：我方发送含"涂鸦"二字时，对方会发送涂鸦
  if (text.indexOf('涂鸦') !== -1) {
    setTimeout(function() { scheduleDoodleAutoReply(chatId); }, 600);
  } else if (text.indexOf('你发拍一拍') !== -1) {
    // 触发词：我方发送"你发拍一拍"时，对方会发送拍一拍
    setTimeout(function() { schedulePatAutoReply(chatId); }, 600);
  } else {
    // 自动回复（始终开启，由 pace settings 控制延迟）
    scheduleAutoReply(chatId);
  }
  
  // 关键词触发对方来电（如：打电话、打语音、打视频等）
  var callKind = _matchCallKeyword(text);
  if (callKind) {
    setTimeout(function() { _triggerIncomingCall(callKind); }, 1200 + Math.random() * 1500);
  }
}

function scheduleAutoReply(chatId) {
  // 群聊：走多成员自动回复
  if (isGroupChatId(chatId)) {
    scheduleGroupAutoReply(chatId);
    return;
  }
  var minDelay = Storage.getReplyMinDelay();  // 秒
  var maxDelay = Storage.getReplyMaxDelay();  // 秒
  var delay = (minDelay + Math.random() * Math.max(0, maxDelay - minDelay)) * 1000; // 转为毫秒
  // 下限：至少 0.5 秒
  if (delay < 500) delay = 500 + Math.random() * 1500;
  
  setTimeout(function() {
    // 对方发送前先显示"正在输入"气泡（若开启）
    if (Storage.getTypingIndicator()) {
      showTypingIndicator();
      setTimeout(function() {
        doAutoReply(chatId);
      }, 1600 + Math.random() * 2200);
    } else {
      doAutoReply(chatId);
    }
  }, delay);
}

function sendStickerMessage(stickerData) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId || !stickerData) return;
  
  // 阈值判定压缩（对标 ZY3）：GIF/小表情原样保留，超过阈值才压缩，避免表情包质量损失
  ChatMedia.compressSmart(stickerData, ChatMedia.OPT.sticker).then(function(compressed) {
    _doSendSticker(chatId, compressed);
  });
}

function _doSendSticker(chatId, stickerData) {
  var msgId = Date.now();
  var messages = Storage.getMessages(chatId);
  // 大体积表情 base64 存入 IndexedDB，消息只保留轻量引用（渲染时异步还原）
  ChatMedia.storeForMessage(stickerData, 'stk_' + msgId).then(function(finalData) {
    var newMsg = { id: msgId, type: 'self', text: '[表情]', time: msgId, msgType: 'sticker', read: false, stickerData: finalData };
    messages.push(newMsg);
    Storage.setMessages(chatId, messages);
    
    updateLastMsg(chatId, '[表情]');
    appendMessage(chatId, newMsg);
    App.playSound('send');
    // 发送表情后保持表情面板展开，方便连续发送
    
    scheduleAutoReply(chatId);
  });
}

/* 压缩图片数据（base64 dataURL），减小 localStorage 占用；失败或更小时原样返回 */
function compressImageData(data, maxSize, quality, keepAnim) {
  return new Promise(function(resolve) {
    if (!data || data.indexOf('data:') !== 0) { resolve(data); return; }
    var isGif = data.indexOf('data:image/gif') === 0;
    // GIF 动图：canvas 转 JPEG 会丢失动画且透明底变黑底，一律原样返回，不做压缩
    if (isGif) { resolve(data); return; }
    var img = new Image();
    img.onload = function() {
      try {
        var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var out = canvas.toDataURL('image/jpeg', quality);
        if (out && out.length < data.length) { resolve(out); return; }
      } catch (e) {}
      resolve(data);
    };
    img.onerror = function() { resolve(data); };
    img.src = data;
  });
}

function sendImageMessage(imageData) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId || !imageData) return;
  
  // 阈值判定压缩（对标 ZY3）：GIF/小图原样保留，超过阈值才压缩到 1200px，避免聊天图片质量损失
  ChatMedia.compressSmart(imageData, ChatMedia.OPT.image).then(function(compressed) {
    _doSendImage(chatId, compressed);
  });
}

function _doSendImage(chatId, imageData) {
  var msgId = Date.now();
  var messages = Storage.getMessages(chatId);
  // 大体积图片 base64 存入 IndexedDB，消息只保留轻量引用（渲染时异步还原）
  ChatMedia.storeForMessage(imageData, 'img_' + msgId).then(function(finalData) {
    var newMsg = { id: msgId, type: 'self', text: '[图片]', time: msgId, msgType: 'image', read: false, imageData: finalData };
    messages.push(newMsg);
    Storage.setMessages(chatId, messages);
    
    // 发送图片时清除引用
    cancelQuoteReply();
    
    updateLastMsg(chatId, '[图片]');
    appendMessage(chatId, newMsg);
    App.playSound('send');
    
    scheduleAutoReply(chatId);
  });
}

function updateLastMsg(chatId, text) {
  var chats = Storage.getChats();
  for (var i = 0; i < chats.length; i++) {
    if (chats[i].id === chatId) {
      chats[i].lastMsg = text;
      chats[i].lastTime = Date.now();
      Storage.setChats(chats);
      break;
    }
  }
}

// 安全渲染：仅当当前正处于该聊天室的聊天界面时才刷新消息列表，
// 避免全站主动发送/自动回复在其它界面或其它聊天室时误渲染错乱
function _safeRenderChat(chatId) {
  var room = document.getElementById('page-chat-room');
  if (!room || room.dataset.chatId === undefined) return;
  if (String(room.dataset.chatId) === String(chatId)) renderChatMessages(chatId);
}

/* 黑屋状态恢复后的重渲染兜底：
   黑屋名单/开启时刻走 localStorage + IndexedDB 双写镜像，刷新后若 localStorage 未命中，
   Storage.get 先返回默认值、再异步从 IndexedDB 恢复，恢复完成派发 mirror-storage-restored。
   若不重渲染，聊天里「已被打入冷宫」标签会表现为"刷新后消失、重开黑屋面板又出现"。
   此处监听恢复事件，命中黑屋相关键时重绘当前聊天。 */
function _isBlackRoomMirrorKey(key) {
  return key.indexOf('blackRoom_') === 0 || key.indexOf('blackRoomEnabledAt_') === 0;
}
function _onBlackRoomStorageRestored(e) {
  var key = e && e.detail ? e.detail.key : '';
  if (key && !_isBlackRoomMirrorKey(key)) return;
  var room = document.getElementById('page-chat-room');
  if (room && room.dataset.chatId) renderChatMessages(String(room.dataset.chatId));
}
window.addEventListener('mirror-storage-restored', _onBlackRoomStorageRestored);
// 启动时双向同步完成也可能回填黑屋键（localStorage 缺失/超限场景）
window.addEventListener('mirror-storage-synced', _onBlackRoomStorageRestored);

/* 增量追加单条消息：仅将新消息 DOM 追加到聊天列表末尾，避免全量重建。
   适用于发送消息 / 自动回复等「新增消息」场景；首开/切换聊天仍走 renderChatMessages 全量渲染。
   日期分割线按最后一条已渲染消息的日期判断。 */
function appendMessage(chatId, msg) {
  var container = document.getElementById('chat-messages');
  if (!container || !msg) return;
  var messages = Storage.getMessages(chatId);
  var myProfile = Storage.getMyProfile();
  var isGroup = isGroupChatId(chatId);

  // 小黑屋名单（单聊与群聊通用）
  var blackRoomIds = [];
  var _br = Storage.get('blackRoom_' + chatId, []);
  blackRoomIds = Array.isArray(_br) ? _br : [];
  // 最近一次黑屋开启时刻（标签仅出现在开启后发送的消息上）
  var blackEnabledAt = Storage.get('blackRoomEnabledAt_' + chatId, 0) || 0;

  // 获取当前聊天对象资料（用于渲染头像）
  var chatPartner = null;
  if (_chatCurrentPartnerId && !isGroup) {
    var allPartners = Storage.getPartnerProfiles();
    for (var pi = 0; pi < allPartners.length; pi++) {
      if (allPartners[pi].id === _chatCurrentPartnerId) { chatPartner = allPartners[pi]; break; }
    }
  }
  // 群聊成员映射（发言人头像/昵称）
  var groupPartnerMap = {};
  if (isGroup) {
    var groupObj = getGroupByChatId(chatId);
    var gMembers = groupObj ? getGroupMembers(groupObj) : [];
    gMembers.forEach(function(m) { groupPartnerMap[m.id] = m; });
  }
  var selfAvatarHtml = _buildMessageAvatar(myProfile);
  var otherAvatarHtml = _buildMessageAvatar(chatPartner);

  // 黑屋消息级持久标记：命中名单则给 msg 打上 blackRoom 标记并立即持久化，关闭黑屋后标签不丢失
  if (_fixBlackRoomMark(msg, blackRoomIds, blackEnabledAt, isGroup)) {
    Storage.setMessages(chatId, messages);
  }

  // 日期分割线：严格一天一次。先看容器里最后一条日期线是否已是同一天（是则不再插入），
  // 否则以最近一条普通消息行的时间为基准比较（居中气泡类消息不算基准，避免气泡后追加时重复插入）
  var html = '';
  var msgDate = Core.formatDate(msg.time);
  var allDividers = container.querySelectorAll('.chat-date-divider');
  var lastDividerDate = allDividers.length ? allDividers[allDividers.length - 1].textContent : '';
  if (lastDividerDate !== msgDate) {
    var prevTime = 0;
    var rows = container.querySelectorAll('.message-row');
    if (rows.length) {
      var lastId = String(rows[rows.length - 1].getAttribute('data-msg-id'));
      for (var i = messages.length - 2; i >= 0; i--) {
        if (String(messages[i].id) === lastId) { prevTime = messages[i].time || 0; break; }
      }
    }
    if (msgDate !== Core.formatDate(prevTime)) {
      html += '<div class="chat-date-divider">' + msgDate + '</div>';
    }
  }

  html += _buildSingleMessageHtml(msg, {
    isSelf: msg.type === 'self',
    selfAvatarHtml: selfAvatarHtml,
    otherAvatarHtml: otherAvatarHtml,
    blackRoomIds: blackRoomIds,
    blackEnabledAt: blackEnabledAt,
    isGroup: isGroup,
    groupPartnerMap: groupPartnerMap
  });

  container.insertAdjacentHTML('beforeend', html);
  // 先滚一次到底，图片异步填充撑高容器后再滚一次，避免新消息"卡半显示"
  container.scrollTop = container.scrollHeight;
  bindChatTapMenu(container);

  // 为新增的自我消息补调度已读回执（等价于全量渲染后的 reschedulePendingReads）
  if (msg.type === 'self' && !msg.read && !msg.isRecall && !msg.isCall) {
    scheduleReadReceipt(chatId, msg.id);
  }

  // 异步还原本条消息中 IndexedDB 引用的大图/大表情；完成后重新滚动到底
  ChatMedia.resolveDomRefs(container, function() {
    if (container.id === 'chat-messages') container.scrollTop = container.scrollHeight;
    // 图片 decode 后行高可能再变化，下一帧再兜底一次
    setTimeout(function() {
      if (container.id === 'chat-messages') container.scrollTop = container.scrollHeight;
    }, 0);
  });
}

// 安全增量追加：仅当当前正处于该聊天室的聊天界面时才追加单条消息
function _safeAppendMessage(chatId, msg) {
  var room = document.getElementById('page-chat-room');
  if (!room || room.dataset.chatId === undefined) return;
  if (String(room.dataset.chatId) === String(chatId)) appendMessage(chatId, msg);
}

function doAutoReply(chatId) {
  hideTypingIndicator();
  // 群聊：随机一名成员发言
  if (isGroupChatId(chatId)) {
    var g = getGroupByChatId(chatId);
    var gMembers = g ? getGroupMembers(g) : [];
    if (gMembers.length) {
      var randomMember = gMembers[Math.floor(Math.random() * gMembers.length)];
      doGroupAutoReply(chatId, randomMember);
    }
    return;
  }
  // 涂鸦自主发送：10% 概率随机发送涂鸦图案
  if (Math.random() < 0.1) {
    _sendDoodleAutoReply(chatId);
    return;
  }
  var cards = Storage.getCards();           // {id, text, source, category}[]
  var emojis = Storage.getEmojis();         // {id, char, category}[]
  var kaomojis = Storage.getKaomojis();     // {id, text, category}[]
  
  var spellCard = Storage.getSpellCardSend();
  var emojiMixing = Storage.getEmojiMixing();
  var kaomojiMixing = Storage.getKaomojiMixing();
  var stickerMixing = Storage.getStickerMixing();
  var redpacketMixing = Storage.getRedPacketMixing();

  // 自动领取对方发来的未领红包
  var claimCheckMsgs = Storage.getMessages(chatId);
  for (var ci = claimCheckMsgs.length - 1; ci >= 0; ci--) {
    var rpMsg = claimCheckMsgs[ci];
    if (rpMsg.msgType === 'redpacket' && rpMsg.type === 'self') {
      var autoSaved = RedPacketStorage.load(chatId, rpMsg.id);
      var partnerCanClaim = !rpMsg.claimed && !rpMsg.returned;
      if (!partnerCanClaim) continue;
      var claimAmt = rpMsg.totalAmount;
      rpMsg.claimed = true;
      rpMsg.amount = claimAmt;
      Storage.setMessages(chatId, claimCheckMsgs);
      var autoStored = autoSaved || {};
      autoStored.id = rpMsg.id;
      autoStored.greeting = rpMsg.greeting;
      autoStored.rpType = rpMsg.rpType;
      autoStored.totalAmount = rpMsg.totalAmount;
      autoStored.count = rpMsg.count;
      autoStored.claimed = true;
      autoStored.amount = claimAmt;
      autoStored.otherAmount = claimAmt;
      autoStored.otherClaimTime = Date.now();
      autoStored.time = rpMsg.time;
      RedPacketStorage.save(chatId, rpMsg.id, autoStored);
      _safeRenderChat(chatId);
      break;
    }
  }

  // 拍一拍主动混入（单聊）：开关开启且概率命中时，对方主动发送拍一拍（不再发普通文字回复）
  // （位于涂鸦自主发送判断之后、红包混入之前；_sendPatAutoReply 定义于 chat-extra.js，跨文件可用）
  if (Storage.getPatMixEnabled() && Math.random() < PAT_ACTIVE_MIX_PROBABILITY) {
    _sendPatAutoReply(chatId);
    return;
  }

  // 红包混入
  if (redpacketMixing) {
    var useRedPacket = Math.random() < 0.10;  // 10% 总概率（含特殊金额，占红包内 20%）
    if (useRedPacket) {
      _sendRedPacketAutoReply(chatId);
      return;
    }
  }

  // 先处理 stickerMixing：独立决定是否发表情包消息
  if (stickerMixing) {
    var useSticker = Math.random() < 0.3; // 30% 概率发表情包
    if (useSticker) {
      _sendStickerAutoReply(chatId);
      return;
    }
  }

  // 语音字卡混入（5%）：位于表情包判断之后、主字卡基础回复之前。
  // 命中 5% 概率且语音字卡库非空时，对方发送一条语音消息（type:'other', msgType:'voice'）。
  // _maybeSendVoiceAutoReply 立即返回是否“接管本次回复”，音频经 SoundFileDB 异步取回后发送。
  if (Storage.getVoiceMixing() && _maybeSendVoiceAutoReply(chatId)) {
    return;
  }
  
  // 筛选主字卡（category 非"格言"即为主字卡）
  var mainCards = cards.filter(function(c) { return c.category !== '格言'; });

  // 副字卡：按当前聊天对方角色（chatId=partner_xxx → partnerId）取专属字卡池
  // 每个角色的副字卡仅该角色可发送，其他角色无法收到别的角色的副字卡
  var subPool = [];
  var currentPartnerId = chatId.indexOf('partner_') === 0 ? chatId.replace('partner_', '') : '';
  if (currentPartnerId) {
    var allSubCards = Storage.getSubCards() || [];
    var blockedSub = Storage.getBlockedSubCards() || [];
    subPool = allSubCards.filter(function(c) {
      return c.partnerId === currentPartnerId && blockedSub.indexOf(c.id) < 0;
    });
  }

  var replyParts = [];
  var cardTexts = [];  // 字卡文本：拼字卡开启时字卡之间用逗号连接

  // 来源选择：该角色有专属副字卡时，50% 概率整条回复由副字卡池生成（主字卡不参与）
  var replyPool;
  if (subPool.length > 0 && mainCards.length > 0) {
    replyPool = Math.random() < 0.5 ? subPool : mainCards;
  } else if (subPool.length > 0) {
    replyPool = subPool;
  } else {
    replyPool = mainCards;
  }

  // 基础：至少选 1 张来源字卡
  if (replyPool.length > 0) {
    var baseCard = replyPool[Math.floor(Math.random() * replyPool.length)];
    cardTexts.push(baseCard.text);

    if (spellCard && replyPool.length > 1) {
      var extraCount = 1 + Math.floor(Math.random() * 2); // 额外 1~2 张
      for (var i = 0; i < extraCount; i++) {
        var otherCard;
        var attempts = 0;
        do {
          otherCard = replyPool[Math.floor(Math.random() * replyPool.length)];
          attempts++;
        } while (otherCard.id === baseCard.id && replyPool.length > 1 && attempts < 20);
        cardTexts.push(otherCard.text);
      }
    }
  }
  
  // 拼字卡开启：字卡之间以逗号连接；未开启：直接无符号拼接
  if (cardTexts.length > 0) {
    replyParts.push(spellCard ? cardTexts.join('，') : cardTexts.join(''));
  }
  
  // 混入 emoji（15% 概率，在任意位置随机插入）
  if (emojiMixing && emojis.length > 0 && Math.random() < 0.15) {
    var emoji = emojis[Math.floor(Math.random() * emojis.length)];
    var pos = Math.floor(Math.random() * (replyParts.length + 1));
    replyParts.splice(pos, 0, emoji.char);
  }
  
  // 混入颜文字（20% 概率）
  if (kaomojiMixing && kaomojis.length > 0 && Math.random() < 0.20) {
    var kao = kaomojis[Math.floor(Math.random() * kaomojis.length)];
    var pos = Math.floor(Math.random() * (replyParts.length + 1));
    replyParts.splice(pos, 0, kao.text);
  }
  
  // 无可用字卡/表情/颜文字时保持沉默，不发送兜底『嗯嗯』
  if (replyParts.length === 0) return;
  var reply = replyParts.join('');
  
  var msgs = Storage.getMessages(chatId);
  var newMsg = { id: Date.now(), type: 'other', text: reply, time: Date.now(), msgType: 'text' };
  newMsg.moodIntent = _pickMoodIntent(); // 心流状态：随机标注情绪含义标签

  // 对方角色可主动引用消息：小概率引用最近一条我方文本消息
  var quoteTarget = null;
  for (var q = msgs.length - 1; q >= 0; q--) {
    if (msgs[q].type === 'self' && msgs[q].msgType === 'text' && !msgs[q].isRecall && msgs[q].text) {
      quoteTarget = msgs[q];
      break;
    }
  }
  if (quoteTarget && Math.random() < 0.18) {
    newMsg.quote = { text: quoteTarget.text, from: '我', msgId: quoteTarget.id };
  }
  msgs.push(newMsg);

  // 聊天特效：对方发送字卡内容命中关键词同样触发（复用同一套关键词→特效映射）
  var fx = matchChatEffect(reply);
  if (fx) {
    setTimeout(function() { triggerChatEffect(fx); }, 350);
  }

  // 对方角色可主动撤回：小概率在消息发出后延迟撤回（先正常显示，等一会儿再撤回）
  var willRecall = Math.random() < 0.10;
  if (willRecall) {
    var partnerName = _getCurrentPartnerName();
    var recallDelay = 2000 + Math.random() * 3000; // 2~5 秒后再撤回
    var sentMsgId = newMsg.id;
    updateLastMsg(chatId, reply);
    setTimeout(function() {
      var msgs2 = Storage.getMessages(chatId);
      for (var ri = msgs2.length - 1; ri >= 0; ri--) {
        if (String(msgs2[ri].id) === String(sentMsgId)) {
          var recallEntry = {
            id: sentMsgId,
            type: 'other',
            text: partnerName + '撤回了一条消息',
            time: Date.now(),
            msgType: 'text',
            isRecall: true,
            blackRoom: !!newMsg.blackRoom,
            recallName: partnerName,
            recalledContent: _captureRecallContent(newMsg)
          };
          msgs2[ri] = recallEntry;
          updateLastMsg(chatId, recallEntry.text);
          Storage.setMessages(chatId, msgs2);
          _safeRenderChat(chatId);
          App.playSound('receive');
          break;
        }
      }
    }, recallDelay);
  } else {
    updateLastMsg(chatId, reply);
  }
  Storage.setMessages(chatId, msgs);
  
  _safeAppendMessage(chatId, newMsg);
  App.playSound('receive');
  showBackgroundPush(reply);
}

// 语音字卡混入：在对方自动回复中随机发送一条语音字卡库里的音频消息。
// 命中返回 true（本次回复由此接管，音频异步发送）；未命中返回 false（继续走普通回复）。
// 概率固定为默认 20%（不再支持自定义调整）。
function _maybeSendVoiceAutoReply(chatId) {
  var mixProb = 0.2;
  if (Math.random() >= mixProb) return false;
  var vCards = Storage.getVoiceCards();
  if (!vCards || !vCards.length) return false;
  // 排除被屏蔽的语音
  var blocked = Storage.getBlockedVoiceCards();
  var pool = vCards.filter(function(c) { return blocked.indexOf(c.id) < 0; });
  if (!pool.length) return false;
  var pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick.audioKey) return false;

  SoundFileDB.get(pick.audioKey).then(function(dataURL) {
    // 降级兜底：音频取回失败/为空时不静默吞回复，改发一条普通文字字卡，避免对方沉默
    if (!dataURL) { _sendVoiceFallbackTextReply(chatId); return; }
    var msgs = Storage.getMessages(chatId);
    var msgId = Date.now();
    var display = '[语音] ' + (pick.name || '');
    var newMsg = {
      id: msgId,
      type: 'other',
      text: display,
      time: msgId,
      msgType: 'voice',
      duration: Math.max(1, Math.round(Number(pick.duration) || 3)),
      audioMime: pick.audioMime || 'audio/mpeg',
      audioData: dataURL,
      voiceText: pick.name || ''
    };
    msgs.push(newMsg);
    Storage.setMessages(chatId, msgs);
    updateLastMsg(chatId, display);
    _safeAppendMessage(chatId, newMsg);
    App.playSound('receive');
    showBackgroundPush(display);
  }).catch(function() {
    _sendVoiceFallbackTextReply(chatId);
  });
  return true;
}

// 语音混入兜底：音频异常时从主字卡片库随机挑一条文字回复，保证对方不沉默
function _sendVoiceFallbackTextReply(chatId) {
  var mainCards = Storage.getCards().filter(function(c) { return c.category !== '格言'; });
  if (!mainCards.length) return; // 无可用字卡时保持沉默（不再发『嗯嗯』兜底）
  var text = mainCards[Math.floor(Math.random() * mainCards.length)].text;
  var msgs = Storage.getMessages(chatId);
  var newMsg = { id: Date.now(), type: 'other', text: text, time: Date.now(), msgType: 'text' };
  newMsg.moodIntent = _pickMoodIntent();
  msgs.push(newMsg);
  Storage.setMessages(chatId, msgs);
  updateLastMsg(chatId, text);
  _safeAppendMessage(chatId, newMsg);
  App.playSound('receive');
  showBackgroundPush(text);
}

// 从表情包库随机选择一张表情包发送（仅用于自动回复）
function _sendStickerAutoReply(chatId) {
  StickerDB.getRandom().then(function(sticker) {
    if (sticker && sticker.data) {
      var msgs = Storage.getMessages(chatId);
      var msgId = Date.now();
      // 大表情存入 IndexedDB，消息只保留轻量引用（渲染时异步还原）
      ChatMedia.storeForMessage(sticker.data, 'stk_' + msgId).then(function(finalData) {
        var newMsg = { id: msgId, type: 'other', text: '[表情]', time: msgId, msgType: 'sticker', stickerData: finalData };
        msgs.push(newMsg);
        Storage.setMessages(chatId, msgs);
        updateLastMsg(chatId, '[表情]');
        _safeAppendMessage(chatId, newMsg);
        App.playSound('receive');
        showBackgroundPush('[表情]');
      });
    } else {
      // 表情包库为空时保持沉默，不再降级发送『嗯嗯』
    }
  }).catch(function() {
    // 表情包获取异常时保持沉默，不再降级发送『嗯嗯』
  });
}

/* 农历信息表（1900-2100），用于判断农历节日 */
var _lunarInfo = [
0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
0x0d520
];
function _lunarYearDays(y) { var i, sum = 348; for (i = 0x8000; i > 0x8; i >>= 1) sum += (_lunarInfo[y - 1900] & i) ? 1 : 0; return sum + _lunarLeapDays(y); }
function _lunarLeapMonth(y) { return _lunarInfo[y - 1900] & 0xf; }
function _lunarLeapDays(y) { return _lunarLeapMonth(y) ? ((_lunarInfo[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function _lunarMonthDays(y, m) { return (_lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
/* 公历转农历，返回 { month, day } */
function _solar2lunar(date) {
  var y = date.getFullYear();
  if (y < 1900 || y > 2100) return null;
  var offset = Math.floor((Date.UTC(y, date.getMonth(), date.getDate()) - Date.UTC(1900, 0, 31)) / 86400000);
  var temp = 0, lunarYear;
  for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) { temp = _lunarYearDays(lunarYear); offset -= temp; }
  if (offset < 0) { offset += temp; lunarYear--; }
  var leap = _lunarLeapMonth(lunarYear), isLeap = false, lunarMonth, lunarDay;
  for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
    if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) { --lunarMonth; isLeap = true; temp = _lunarLeapDays(lunarYear); }
    else { temp = _lunarMonthDays(lunarYear, lunarMonth); }
    if (isLeap && lunarMonth === (leap + 1)) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
    if (isLeap) { isLeap = false; } else { isLeap = true; --lunarMonth; }
  }
  if (offset < 0) { offset += temp; --lunarMonth; }
  lunarDay = offset + 1;
  return { month: lunarMonth, day: lunarDay };
}

/* 恋爱向红包祝福语（非节日默认，古风浪漫） */
var _loveGreetings = [
  '山有木兮木有枝，心悦君兮君已知',
  '愿我如星君如月，夜夜流光相皎洁',
  '晓看天色暮看云，行也思君，坐也思君',
  '一日不见，如三秋兮，聊寄此金以慰相思',
  '玲珑骰子安红豆，入骨相思知不知',
  '此情无计可消除，才下眉头，却上心头',
  '两情若是久长时，又岂在朝朝暮暮',
  '既见君子，云胡不喜，一点心意，赠予卿卿',
  '只愿君心似我心，定不负相思意',
  '青青子衿，悠悠我心，红封薄礼，聊表深情',
  '衣带渐宽终不悔，为伊消得人憔悴',
  '金风玉露一相逢，便胜却人间无数',
  '愿我如君之影，朝朝暮暮不相离',
  '以我之名，冠你之姓，此生此世，白首不离',
  '月上柳梢头，人约黄昏后，此金为证，共赴白头',
  '你是我心内的一首歌',
  '确认过眼神，我遇上对的人',
  '我的眼里只有你',
  '我愿意为你忘记我姓名',
  '想你时你在天边，想你时你在眼前',
  '你浅浅的微笑，就像乌梅子酱',
  '甜甜的恋爱，甜甜的红包',
  '余生请多指教，红包先敬上',
  '好想好想和你在一起',
  '爱你的心，比红包更红'
];

/* 红包祝福语：节日当天用节日祝福语，其余用恋爱向祝福语（古风版，节日名称用正式称谓） */
function _pickRedPacketGreeting() {
  var now = new Date();
  var m = now.getMonth() + 1, d = now.getDate();
  var solarKey = m + '-' + d;
  var solarFestivals = {
    '1-1': ['岁序更新，万象伊始，恭贺新禧', '新年伊始，万象更新，愿你岁岁安康'],
    '2-14': ['此日情人节，愿执子之手，与子偕老', '春风十里不如你，情人节里诉衷情'],
    '3-8': ['三八妇女节，巾帼不让须眉，愿你岁岁芳华', '妇女节至，愿你如花美眷，似水流年'],
    '4-1': ['人间四月芳菲始，此心昭昭非戏言', '四月风轻，此情真切，不作戏言'],
    '5-1': ['劳动节至，辛苦你了，且收薄礼慰辛劳', '五一佳节，劳有所得，愿你欢愉'],
    '5-20': ['五二零，吾爱卿，此情天地可鉴', '五二零，心心相印，此金为聘，白首不离'],
    '6-1': ['童心未泯，愿你永如少年时', '六一佳节，愿你笑靥如花，纯真常在'],
    '10-1': ['国庆良辰，与卿同庆，山河远阔共欢喜', '盛世华诞，与君同贺，愿家国两安'],
    '12-24': ['平安夜至，愿卿岁岁平安，喜乐无忧', '平安夜，愿灯火可亲，所念之人皆安好'],
    '12-25': ['圣诞良夜，愿你喜乐安康，心想事成', '圣诞佳节，愿此红封暖你冬夜']
  };
  if (solarFestivals[solarKey]) {
    var arr = solarFestivals[solarKey];
    return arr[Math.floor(Math.random() * arr.length)];
  }
  var lunar = _solar2lunar(now);
  if (lunar) {
    var lunarKey = lunar.month + '-' + lunar.day;
    var lunarFestivals = {
      '1-1': ['新春大吉，岁岁平安', '春节良辰，恭贺新禧，岁岁安康', '元日呈祥，愿卿岁岁欢愉'],
      '1-15': ['元宵佳节，花灯如昼，人月两圆', '上元良夜，甜糯在心，愿卿如意'],
      '5-5': ['端午安康，粽叶飘香，愿君顺遂', '端午时节，艾草青青，愿你平安喜乐'],
      '7-7': ['七夕良夜，鹊桥相会，愿有情人长相守', '七夕佳期，牛郎织女亦羡我们情深'],
      '8-15': ['中秋月圆，人月两团圆', '中秋佳节，桂子飘香，愿与卿共此良宵']
    };
    if (lunarFestivals[lunarKey]) {
      var arr2 = lunarFestivals[lunarKey];
      return arr2[Math.floor(Math.random() * arr2.length)];
    }
  }
  return _loveGreetings[Math.floor(Math.random() * _loveGreetings.length)];
}

/* 对方自动发送红包 */
function _sendRedPacketAutoReply(chatId) {
  var specialAmounts = [520, 1314, 188, 666, 888];
  var useSpecial = Math.random() < (0.05 / 0.25);  // 特殊金额占红包内 20%（行为不变）；总红包率 10% 下，特殊红包占总回复约 2%
  var amount, count, rpType;

  if (useSpecial) {
    amount = specialAmounts[Math.floor(Math.random() * specialAmounts.length)];
  } else {
    // 金额无上限：1 ~ 9999 元随机
    amount = parseFloat((Math.random() * 9999 + 1).toFixed(2));
  }
  rpType = 'normal';
  count = 1;

  var greeting = _pickRedPacketGreeting();
  var msgId = Date.now();
  var msg = {
    id: msgId,
    type: 'other',
    text: '[红包]' + greeting,
    time: Date.now(),
    msgType: 'redpacket',
    greeting: greeting,
    rpType: rpType,
    totalAmount: amount,
    count: count,
    claimed: false,
    amount: 0
  };

  RedPacketStorage.save(chatId, msgId, {
    id: msgId,
    greeting: greeting,
    rpType: rpType,
    totalAmount: amount,
    count: count,
    claimed: false,
    amount: 0,
    time: msg.time
  });

  var msgs = Storage.getMessages(chatId);
  msgs.push(msg);
  Storage.setMessages(chatId, msgs);
  updateLastMsg(chatId, '[红包]' + greeting);
  _safeAppendMessage(chatId, msg);
  App.playSound('receive');
  showBackgroundPush('[红包]' + greeting);
}

