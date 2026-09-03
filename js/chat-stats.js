/* === emoji 表情发送 === */
/* emoji 点击后插入输入框，由用户点击发送按钮统一发送 */
function insertEmojiToInput(emojiChar) {
  var input = document.getElementById('chat-input');
  if (!input || !emojiChar) return;
  input.value = (input.value || '') + emojiChar;
  onChatInputChange();
  // 记录最近使用（去重、最新在前、最多10个），并刷新「最近使用」分区
  if (Storage.getRecentEmojis) {
    var recent = Storage.getRecentEmojis().filter(function(ch) { return ch !== emojiChar; });
    recent.unshift(emojiChar);
    if (recent.length > 10) recent = recent.slice(0, 10);
    Storage.setRecentEmojis(recent);
    var gridEl = document.getElementById('sticker-panel-grid');
    if (gridEl && _stickerActiveCategory === 'emoji') renderEmojiGrid(gridEl);
  }
}

/* 按字卡分组排序（emojiGroupOrder）+ 组内原有顺序返回稳定的 emoji 列表 */
function getEmojisSortedForChat(emojis) {
  var order = Storage.getEmojiGroupOrder ? Storage.getEmojiGroupOrder() : [];
  var groups = {}, cats = [];
  emojis.forEach(function(e) {
    var c = e.category || '未分类';
    if (!groups[c]) { groups[c] = []; cats.push(c); }
    groups[c].push(e);
  });
  var sortedCats = [];
  (order || []).forEach(function(c) {
    if (cats.indexOf(c) >= 0 && sortedCats.indexOf(c) < 0) { sortedCats.push(c); }
  });
  cats.forEach(function(c) {
    if (sortedCats.indexOf(c) < 0) { sortedCats.push(c); }
  });
  var result = [];
  sortedCats.forEach(function(c) { result = result.concat(groups[c]); });
  return result;
}

/* === 消息列表滚动到底部 === */
function scrollChatToBottom() {
  var container = document.getElementById('chat-messages');
  if (!container) return;
  var go = function() {
    if (container.id === 'chat-messages') container.scrollTop = container.scrollHeight;
  };
  go();
  // 多帧/多时点兜底：图片、表情、决策卡等异步撑高容器后仍能滚到真正的底部
  requestAnimationFrame(go);
  requestAnimationFrame(function() { requestAnimationFrame(go); });
  setTimeout(go, 80);
  setTimeout(go, 200);
  setTimeout(go, 500);
}

function chatPickImage() {
  closePlusMenu();
  document.getElementById('chat-image-input').click();
}

/* === 聊天消息区域点击空白收起面板 === */
function onChatMessagesClick(e) {
  // 只在点击到容器本身（非子元素）时收起面板
  if (e.target === document.getElementById('chat-messages')) {
    closeStickerPanel();
    closePlusMenu();
    closeRedPacketPanel();
    closeRedPacketClaimPanel();
  }
}

/* ============================================================
   三点菜单（聊天更多操作）
   ============================================================ */

function toggleChatMenu() {
  var overlay = document.getElementById('chat-menu-overlay');
  if (overlay) { closeChatMenu(); return; }
  openChatMenu();
}

function openChatMenu() {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var isPinned = Storage.isChatPinned(chatId);
  var isMuted = Storage.getChatMuted(chatId);
  var pinIcon = isPinned ? 'fa-thumbtack' : 'fa-thumbtack';
  var pinLabel = isPinned ? '取消置顶' : '置顶聊天';
  var muteLabel = isMuted ? '取消免打扰' : '消息免打扰';

  var groupMenuHtml = '';
  if (isGroupChatId(chatId)) {
    groupMenuHtml = '<div class="chat-menu-item" onclick="openGroupSettings()"><i class="fas fa-users-gear"></i>群聊设置</div>'
      + '<div class="chat-menu-item" onclick="openGroupAnnouncement()"><i class="fas fa-bullhorn"></i>群公告</div>';
  }
  var html = '<div class="chat-menu-overlay" id="chat-menu-overlay" onclick="closeChatMenu()">'
    + '<div class="chat-menu-panel" onclick="event.stopPropagation()">'
    + groupMenuHtml
    + '<div class="chat-menu-item" onclick="openCallHistoryPanel()"><i class="fas fa-phone-volume"></i>通话记录</div>'
    + '<div class="chat-menu-item" onclick="showUnclaimedRedPackets()"><i class="fas fa-gift"></i>未领取的红包</div>'
    + '<div class="chat-menu-item" onclick="openChatStats()"><i class="fas fa-chart-pie"></i>聊天统计</div>'
    + '<div class="chat-menu-item" onclick="toggleChatSearch()"><i class="fas fa-search"></i>查找聊天记录</div>'
    + '<div class="chat-menu-item" onclick="toggleChatMute(event)"><i class="fas fa-bell-slash"></i><span id="menu-mute-label">' + muteLabel + '</span><button class="menu-toggle' + (isMuted ? ' on' : '') + '" id="menu-mute-toggle"></button></div>'
    + '<div class="chat-menu-item" onclick="togglePinChat()"><i class="fas fa-thumbtack"></i><span id="menu-pin-label">' + pinLabel + '</span></div>'
    + '<div class="chat-menu-item" onclick="showChatBgPicker()"><i class="fas fa-palette"></i>设置聊天背景</div>'
    + '<div class="chat-menu-item" onclick="clearCurrentChatMessages()"><i class="fas fa-trash-alt"></i>清空聊天记录</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeChatMenu() {
  var overlay = document.getElementById('chat-menu-overlay');
  if (overlay) overlay.remove();
}

/* ============================================================
   聊天统计（三点菜单入口）
   ============================================================ */
function openChatStats() {
  closeChatMenu();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var html = _buildChatStatsHtml(chatId);
  if (!html) return;
  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeChatStats() {
  var overlay = document.getElementById('chat-stats-overlay');
  if (overlay) overlay.remove();
}


function _chatStatsTopFromFrag(frag) {
  if (!frag.trim()) return [];
  // 按句子分隔符切分：。！？!?；;… 以及换行，剔除过短片段
  var parts = frag.split(/[。！？!?；;\n…]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 2; });

  var freq = {};
  parts.forEach(function(s) {
    freq[s] = (freq[s] || 0) + 1;
  });
  var arr = [];
  for (var k in freq) arr.push({ text: k, count: freq[k] });
  arr.sort(function(a, b) { return b.count - a.count; });
  return arr.slice(0, 5);
}

/* 常用语句：区分我方 / 对方（单聊用） */
function _chatStatsBuildWords(messages, isSelf) {
  var frag = '';
  messages.forEach(function(m) {
    // 只统计双方实际发送的文本消息（字卡），排除通话、红包、撤回等非字卡消息
    if (m.msgType !== 'text' || m.isCall || m.isRecall || m.isRedpacket || !m.text) return;
    if ((m.type === 'self') !== isSelf) return;
    frag += m.text + '\n';
  });
  return _chatStatsTopFromFrag(frag);
}

/* 常用语句：按角色区分（群聊用，fromId 为成员 id；'self' 表示我自己） */
function _chatStatsBuildWordsForMember(messages, fromId) {
  var frag = '';
  messages.forEach(function(m) {
    if (m.msgType !== 'text' || m.isCall || m.isRecall || m.isRedpacket || !m.text) return;
    if (fromId === 'self') {
      if (m.type !== 'self') return;
    } else {
      if (m.type !== 'other' || m.fromId !== fromId) return;
    }
    frag += m.text + '\n';
  });
  return _chatStatsTopFromFrag(frag);
}


var chatStatsCalendarDate = new Date();

/* 日历形式展示每日消息量（复用全局日历样式，有消息的日期显示条数徽标） */
function _chatStatsRenderCalendarHtml(messages, date) {
  var year = date.getFullYear();
  var month = date.getMonth();
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var todayStr = Core.formatDate(new Date());

  var dayMap = {};
  messages.forEach(function(m) {
    var t = m.time || 0;
    if (!t) return;
    var d = new Date(t);
    var key = d.getFullYear() + '-' + ((d.getMonth() + 1) < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
    dayMap[key] = (dayMap[key] || 0) + 1;
  });

  var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  var dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  var html = '<div class="chat-stats-calendar">'
    + '<div class="calendar-header">'
    + '<span class="calendar-month">' + year + '年 ' + monthNames[month] + '</span>'
    + '<div class="calendar-nav">'
    + '<button onclick="chatStatsChangeMonth(-1)"><i class="fas fa-chevron-left"></i></button>'
    + '<button onclick="chatStatsChangeMonth(1)"><i class="fas fa-chevron-right"></i></button>'
    + '</div></div>'
    + '<div class="calendar-grid">';
  dayHeaders.forEach(function(d) { html += '<div class="calendar-day-header">' + d + '</div>'; });
  for (var i = 0; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + ((month + 1) < 10 ? '0' : '') + (month + 1) + '-' + (d < 10 ? '0' : '') + d;
    var isToday = dateStr === todayStr;
    var cnt = dayMap[dateStr] || 0;
    var cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (cnt > 0) {
      var lvl = cnt <= 3 ? 1 : (cnt <= 6 ? 2 : (cnt <= 12 ? 3 : (cnt <= 25 ? 4 : 5)));
      cls += ' has-record chat-stats-cal-l' + lvl;
    }
    html += '<div class="' + cls + '" title="' + dateStr + (cnt > 0 ? ' 共 ' + cnt + ' 条消息' : '') + '">' + d;
    if (cnt > 0) html += '<span class="chat-stats-cal-count">' + cnt + '</span>';
    html += '</div>';
  }
  html += '</div>'
    + '<div class="chat-stats-cal-legend">'
    + '<span class="legend-label">少</span>'
    + '<span class="legend-cell l1"></span>'
    + '<span class="legend-cell l2"></span>'
    + '<span class="legend-cell l3"></span>'
    + '<span class="legend-cell l4"></span>'
    + '<span class="legend-cell l5"></span>'
    + '<span class="legend-label">多</span>'
    + '</div>'
    + '</div>';
  return html;
}

/* 聊天统计日历：切换月份 */
function chatStatsChangeMonth(delta) {
  chatStatsCalendarDate.setMonth(chatStatsCalendarDate.getMonth() + delta);
  var container = document.getElementById('chat-stats-calendar');
  if (!container) return;
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  var messages = chatId ? (Storage.getMessages(chatId) || []) : [];
  container.innerHTML = _chatStatsRenderCalendarHtml(messages, chatStatsCalendarDate);
}

function _buildChatStatsHtml(chatId) {
  var messages = Storage.getMessages(chatId);
  if (!messages || !messages.length) {
    return '<div class="chat-stats-overlay" id="chat-stats-overlay" onclick="closeChatStats()">'
      + '<div class="chat-stats-panel" onclick="event.stopPropagation()">'
      + '<div class="chat-stats-header"><div class="chat-stats-title"><i class="fas fa-chart-pie"></i>聊天统计</div><div class="chat-stats-close" onclick="closeChatStats()"><i class="fas fa-times"></i></div></div>'
      + '<div class="chat-stats-body"><div class="chat-stats-empty">还没有聊天记录～</div></div>'
      + '</div></div>';
  }

  // 1. 双方聊天条数（群聊另统计各角色消息条数）
  var myCount = 0, otherCount = 0;
  var memberMsgCount = {};
  if (isGroupChatId(chatId)) {
    var statGroup = getGroupByChatId(chatId);
    var statMembers = statGroup ? getGroupMembers(statGroup) : [];
    statMembers.forEach(function(sm) { memberMsgCount[sm.id] = 0; });
    messages.forEach(function(m) {
      if (m.type === 'self') myCount++;
      else if (m.fromId && memberMsgCount[m.fromId] !== undefined) memberMsgCount[m.fromId]++;
      else otherCount++;
    });
  } else {
    messages.forEach(function(m) {
      if (m.type === 'self') myCount++; else otherCount++;
    });
  }
  var total = messages.length;

  // 2. 常用语句（完整语句高频统计，区分我方发送与对方发送，Top 5）
  var myTopSent = _chatStatsBuildWords(messages, true);
  var otherTopSent = _chatStatsBuildWords(messages, false);

  var html = '';
  html += '<div class="chat-stats-overlay" id="chat-stats-overlay" onclick="closeChatStats()">'
    + '<div class="chat-stats-panel" onclick="event.stopPropagation()">'
    + '<div class="chat-stats-header">'
    + '<div class="chat-stats-title"><i class="fas fa-chart-pie"></i>聊天统计</div>'
    + '<div class="chat-stats-close" onclick="closeChatStats()"><i class="fas fa-times"></i></div>'
    + '</div>'
    + '<div class="chat-stats-body">';

  // 双方条数
  html += '<div class="chat-stats-section">'
    + '<div class="chat-stats-section-title">双方聊天条数</div>'
    + '<div class="chat-stats-count-grid">'
    + '<div class="chat-stats-count-card stat-me"><div class="chat-stats-count-num">' + myCount + '</div><div class="chat-stats-count-label">我发送</div></div>'
    + '<div class="chat-stats-count-card stat-other"><div class="chat-stats-count-num">' + otherCount + '</div><div class="chat-stats-count-label">对方发送</div></div>'
    + '<div class="chat-stats-count-card stat-total"><div class="chat-stats-count-num">' + total + '</div><div class="chat-stats-count-label">总消息数</div></div>'
    + '</div>'
    + '</div>';

  // 群聊：各角色消息条数
  if (isGroupChatId(chatId)) {
    var statGroup2 = getGroupByChatId(chatId);
    var statMembers2 = statGroup2 ? getGroupMembers(statGroup2) : [];
    var memberCards = '';
    statMembers2.forEach(function(sm) {
      var cnt = memberMsgCount[sm.id] || 0;
      var avInner = sm.avatarImage ? '' : Core.escapeHtml(String(sm.avatar || sm.nickname || '?').charAt(0));
      memberCards += '<div class="chat-stats-member-card">'
        + '<div class="chat-stats-member-avatar" style="background:' + (sm.avatarColor || '#A090B0') + (sm.avatarImage ? ';background-image:url(' + sm.avatarImage + ')' : '') + ';background-size:cover;background-position:center">'
        + avInner
        + '</div>'
        + '<div class="chat-stats-member-info">'
        + '<div class="chat-stats-member-name">' + Core.escapeHtml(sm.nickname || '角色') + '</div>'
        + '<div class="chat-stats-member-count">' + cnt + ' 条消息</div>'
        + '</div>'
        + '</div>';
    });
    html += '<div class="chat-stats-section"><div class="chat-stats-section-title">各角色消息条数</div>'
      + '<div class="chat-stats-member-grid">' + memberCards + '</div></div>';
  }

  // 常用语句（单聊：我方发送 / 对方发送 两组；群聊：按角色分别统计）
  function _sentListHtml(arr, emptyText) {
    if (!arr || arr.length === 0) return '<div class="chat-stats-empty">' + emptyText + '</div>';
    var h = '<div class="chat-stats-sent-list">';
    arr.forEach(function(s) {
      h += '<div class="chat-stats-sent-item">'
        + '<span class="chat-stats-sent-text">' + Core.escapeHtml(s.text) + '</span>'
        + '<span class="chat-stats-sent-count">' + s.count + ' 次</span>'
        + '</div>';
    });
    h += '</div>';
    return h;
  }
  if (isGroupChatId(chatId)) {
    var statGroup3 = getGroupByChatId(chatId);
    var statMembers3 = statGroup3 ? getGroupMembers(statGroup3) : [];
    var myGroupSent = _chatStatsBuildWords(messages, true);
    html += '<div class="chat-stats-section">'
      + '<div class="chat-stats-section-title">我的常用语句 Top ' + Math.min(myGroupSent.length, 5) + '</div>'
      + _sentListHtml(myGroupSent, '暂无文本消息')
      + '<div style="height:10px"></div>';
    statMembers3.forEach(function(sm) {
      var ms = _chatStatsBuildWordsForMember(messages, sm.id);
      html += '<div class="chat-stats-section-title">' + Core.escapeHtml(sm.nickname || '角色') + ' 的常用语句 Top ' + Math.min(ms.length, 5) + '</div>'
        + _sentListHtml(ms, '暂无文本消息')
        + '<div style="height:10px"></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="chat-stats-section">'
      + '<div class="chat-stats-section-title">我方常用语句 Top ' + Math.min(myTopSent.length, 5) + '</div>'
      + _sentListHtml(myTopSent, '暂无我方文本消息')
      + '<div style="height:10px"></div>'
      + '<div class="chat-stats-section-title">对方常用语句 Top ' + Math.min(otherTopSent.length, 5) + '</div>'
      + _sentListHtml(otherTopSent, '暂无对方文本消息')
      + '</div>';
  }

  // 每日聊天日历（日历形式展示每日消息量，支持月份切换）
  html += '<div class="chat-stats-section">'
    + '<div class="chat-stats-section-title">每日聊天日历</div>'
    + '<div id="chat-stats-calendar">' + _chatStatsRenderCalendarHtml(messages, chatStatsCalendarDate) + '</div>'
    + '</div>';

  html += '</div></div></div>';
  return html;
}

function toggleChatSearch() {
  closeChatMenu();
  var searchBar = document.getElementById('chat-search-bar');
  if (!searchBar) {
    // 动态创建搜索栏
    var chatRoom = document.getElementById('page-chat-room');
    var messages = document.getElementById('chat-messages');
    var searchHtml = '<div class="chat-search-bar" id="chat-search-bar">'
      + '<input type="text" id="chat-search-input" placeholder="搜索聊天记录" oninput="doChatSearch()">'
      + '<button class="chat-search-close" onclick="closeChatSearch()"><i class="fas fa-times"></i></button>'
      + '</div>';
    var tmp = document.createElement('div');
    tmp.innerHTML = searchHtml;
    chatRoom.insertBefore(tmp.firstChild, messages);
    searchBar = document.getElementById('chat-search-bar');
  }
  searchBar.classList.add('active');
  document.getElementById('chat-search-input').focus();
}

function closeChatSearch() {
  var searchBar = document.getElementById('chat-search-bar');
  if (searchBar) searchBar.classList.remove('active');
  var input = document.getElementById('chat-search-input');
  if (input) input.value = '';
  // 恢复所有消息可见
  var messages = document.getElementById('chat-messages');
  if (messages) {
    var rows = messages.querySelectorAll('.message-row, .chat-date-divider');
    rows.forEach(function(r) { r.style.display = ''; });
  }
}

function doChatSearch() {
  var input = document.getElementById('chat-search-input');
  var query = input ? input.value.trim().toLowerCase() : '';
  var messages = document.getElementById('chat-messages');
  if (!messages) return;

  var rows = messages.querySelectorAll('.message-row');
  var dividers = messages.querySelectorAll('.chat-date-divider');

  if (!query) {
    rows.forEach(function(r) { r.style.display = ''; });
    dividers.forEach(function(d) { d.style.display = ''; });
    return;
  }

  // 高亮和过滤
  var lastVisibleDate = null;
  rows.forEach(function(row) {
    var bubble = row.querySelector('.message-bubble');
    var img = row.querySelector('.message-image');
    var text = '';
    if (bubble) text = bubble.textContent.toLowerCase();
    if (text.indexOf(query) !== -1) {
      row.style.display = '';
      lastVisibleDate = row;
    } else {
      row.style.display = 'none';
    }
  });

  // 控制日期分隔线：相邻可见消息之间才显示
  var prevVisible = false;
  var allRows = messages.querySelectorAll('.message-row, .chat-date-divider');
  allRows.forEach(function(el) {
    if (el.classList.contains('chat-date-divider')) {
      el.style.display = prevVisible ? '' : 'none';
      prevVisible = false;
    } else {
      if (el.style.display !== 'none') prevVisible = true;
    }
  });
}

function toggleChatMute(e) {
  if (e) e.stopPropagation();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var isMuted = !Storage.getChatMuted(chatId);
  Storage.setChatMuted(chatId, isMuted);

  var label = document.getElementById('menu-mute-label');
  var toggle = document.getElementById('menu-mute-toggle');
  if (label) label.textContent = isMuted ? '取消免打扰' : '消息免打扰';
  if (toggle) {
    if (isMuted) toggle.classList.add('on');
    else toggle.classList.remove('on');
  }

  Core.toast(isMuted ? '已开启消息免打扰' : '已关闭消息免打扰');
}

function togglePinChat() {
  closeChatMenu();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var pinned = Storage.togglePinChat(chatId);
  Core.toast(pinned ? '已置顶聊天' : '已取消置顶');
}

function showChatBgPicker() {
  closeChatMenu();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var current = Storage.getChatBgCustom(chatId);
  var colors = [
    { name: '跟随主题', value: 'default', hex: 'var(--bg-gradient, #F8F4F8)' },
    { name: '暖粉', value: '#FFE4E1', hex: '#FFE4E1' },
    { name: '浅蓝', value: '#E3F2FD', hex: '#E3F2FD' },
    { name: '淡绿', value: '#E8F5E9', hex: '#E8F5E9' },
    { name: '奶油', value: '#FFF8E1', hex: '#FFF8E1' },
    { name: '薰衣草', value: '#F3E5F5', hex: '#F3E5F5' },
    { name: '深夜', value: '#1a1a2e', hex: '#1a1a2e' },
    { name: '墨绿', value: '#1b2a1b', hex: '#1b2a1b' }
  ];

  var swatchesHtml = '';
  colors.forEach(function(c) {
    var sel = (current === c.value) ? ' selected' : '';
    swatchesHtml += '<div class="chat-bg-swatch' + sel + '" style="background:' + c.hex + '" onclick="applyChatBg(\'' + c.value + '\')"></div>';
  });

  var html = '<div class="chat-bg-overlay" id="chat-bg-overlay" onclick="closeChatBgPicker()">'
    + '<div class="chat-bg-panel" onclick="event.stopPropagation()">'
    + '<div class="chat-bg-title">选择聊天背景</div>'
    + '<div class="chat-bg-options">' + swatchesHtml + '</div>'
    + '<div class="chat-bg-custom" onclick="pickCustomChatBg()"><i class="fas fa-image"></i>从相册选择</div>'
    + '<div class="chat-bg-close" onclick="closeChatBgPicker()">取消</div>'
    + '</div></div>';

  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var page = document.getElementById('page-chat-room');
  page.appendChild(tmp.firstChild);
}

function closeChatBgPicker() {
  var overlay = document.getElementById('chat-bg-overlay');
  if (overlay) overlay.remove();
}

function applyChatBg(value) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  Storage.setChatBgCustom(chatId, value);
  // 自定义图片背景：同步写入 IndexedDB 持久化（localStorage 可能因图片体积超限而丢失，IndexedDB 无容量限制，保证永久保存）
  if (value.indexOf('data:') === 0) {
    if (window.ChatBgDB) {
      ChatBgDB.set(chatId, value).then(function() {
        // IndexedDB 写入成功后，localStorage 存标记即可，避免大图撑爆配额
        Storage.setChatBgCustom(chatId, '__idb__');
      }).catch(function() {});
    }
  } else {
    if (window.ChatBgDB) ChatBgDB.del(chatId).catch(function() {});
  }
  applyChatBackground(value);
  closeChatBgPicker();

  var names = { 'default': '跟随主题', '#FFE4E1': '暖粉', '#E3F2FD': '浅蓝', '#E8F5E9': '淡绿', '#FFF8E1': '奶油', '#F3E5F5': '薰衣草', '#1a1a2e': '深夜', '#1b2a1b': '墨绿' };
  // 自定义图片是超长 base64，绝不能拼进 toast（否则会弹满屏代码），统一显示为「自定义图片」
  var label = names[value] || ((value && value.indexOf('data:') === 0) ? '自定义图片' : value);
  Core.toast('聊天背景已设为' + label);
}

function applyChatBackground(value) {
  var page = document.getElementById('page-chat-room');
  var messages = document.getElementById('chat-messages');
  var topbar = document.querySelector('.chat-room-topbar');
  var inputZone = document.querySelector('.chat-input-zone');
  var inputBar = document.querySelector('.chat-input-bar');

  if (!messages || !page) return;

  // 移除旧背景类和内联样式
  page.classList.remove('chat-room-bg-dark');
  if (topbar) topbar.classList.remove('chat-room-bg-dark');
  if (inputZone) inputZone.classList.remove('chat-room-bg-dark');
  if (inputBar) inputBar.classList.remove('chat-room-bg-dark');

  if (value === 'default') {
    page.style.background = '';
    messages.style.background = '';
    return;
  }

  // 预设颜色名映射
  var colorMap = {
    '#FFE4E1': '#FFE4E1', '#E3F2FD': '#E3F2FD', '#E8F5E9': '#E8F5E9',
    '#FFF8E1': '#FFF8E1', '#F3E5F5': '#F3E5F5', '#1a1a2e': '#1a1a2e', '#1b2a1b': '#1b2a1b'
  };

  var bgColor = colorMap[value] || value;
  var isImage = (value.indexOf('data:') === 0 || value.match(/\.(png|jpg|jpeg|gif|webp)/i));

  // 背景设到 #page-chat-room，让顶栏和输入栏的磨砂玻璃能透过看到
  if (isImage) {
    page.style.background = 'url(' + value + ') center/cover';
  } else {
    page.style.background = bgColor;
  }

  // 消息区保持透明以显示上层背景
  messages.style.background = 'transparent';

  // 深色背景时调整顶栏和输入栏为深色磨砂 + 亮色文字
  var darkBg = (value === '#1a1a2e' || value === '#1b2a1b');
  if (darkBg) {
    page.classList.add('chat-room-bg-dark');
    if (topbar) topbar.classList.add('chat-room-bg-dark');
    if (inputZone) inputZone.classList.add('chat-room-bg-dark');
    if (inputBar) inputBar.classList.add('chat-room-bg-dark');
  }
}

function pickCustomChatBg() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      // 压缩图片后再应用，减小存储体积，确保可持久化保存
      compressImageData(e.target.result, 1600, 0.9, false).then(function(compressed) {
        applyChatBg(compressed);
      }).catch(function() {
        applyChatBg(e.target.result);
      });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function clearCurrentChatMessages() {
  closeChatMenu();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  if (confirm('确定清空该聊天所有消息？此操作不可恢复。')) {
    Storage.clearChatMessages(chatId);
    // 更新聊天列表最后消息
    var chats = Storage.getChats();
    for (var i = 0; i < chats.length; i++) {
      if (chats[i].id === chatId) {
        chats[i].lastMsg = '';
        chats[i].lastTime = 0;
        break;
      }
    }
    Storage.setChats(chats);
    renderChatMessages(chatId);
    Core.toast('聊天记录已清空');
  }
}

function chatHandleImage(fileInput) {
  var file = fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    // 直传原图给新压缩+引用存储链路（sendImageMessage 内部做阈值判定压缩 1200px，避免双重压缩）
    sendImageMessage(e.target.result);
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
}

function chatHandleFile(fileInput) {
  var file = fileInput.files[0];
  if (!file) return;
  Core.toast('文件「' + file.name + '」已选择，文件发送功能开发中');
  fileInput.value = '';
}

/* ============================================================
   红包功能
   ============================================================ */

var RedPacketStorage = {
  _getKey: function(chatId, msgId) {
    return 'rp_' + chatId + '_' + msgId;
  },
  save: function(chatId, msgId, data) {
    try {
      localStorage.setItem(this._getKey(chatId, msgId), JSON.stringify(data));
    } catch(e) {}
    // 全局存储架构升级：同步写入 IndexedDB 持久化（localStorage 超限/清空后仍可恢复）
    if (window.AppKVDB) {
      var fullKey = 'mirror_' + this._getKey(chatId, msgId);
      AppKVDB.put({ key: fullKey, value: data, updatedAt: Date.now() }).catch(function() {});
    }
  },
  load: function(chatId, msgId) {
    try {
      var raw = localStorage.getItem(this._getKey(chatId, msgId));
      if (raw) return JSON.parse(raw);
    } catch(e) { return null; }
    // localStorage 无值：从 IndexedDB 兜底恢复（同步 API 兼容：恢复后写入 localStorage 供下次同步读）
    if (window.AppKVDB) {
      var fullKey = 'mirror_' + this._getKey(chatId, msgId);
      AppKVDB.get(fullKey).then(function(record) {
        if (!record || record.value === undefined) return;
        try { localStorage.setItem(fullKey.slice(7), JSON.stringify(record.value)); } catch(e2) {}
      }).catch(function() {});
    }
    return null;
  },
  loadAllChat: function(chatId) {
    var results = {};
    try {
      var prefix = 'rp_' + chatId + '_';
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) {
          var raw = localStorage.getItem(key);
          if (raw) {
            try { results[key] = JSON.parse(raw); } catch(e) {}
          }
        }
      }
    } catch(e) {}
    // 全局存储架构升级：localStorage 无任何红包记录时，从 IndexedDB 异步兜底恢复回写
    if (window.AppKVDB && Object.keys(results).length === 0) {
      var fullPrefix = 'mirror_rp_' + chatId + '_';
      AppKVDB.getAll().then(function(records) {
        if (!records || !records.length) return;
        records.forEach(function(record) {
          if (record.key && record.key.indexOf(fullPrefix) === 0 && record.value !== undefined) {
            try {
              var shortKey = record.key.slice(7);
              if (localStorage.getItem(shortKey) === null) {
                localStorage.setItem(shortKey, JSON.stringify(record.value));
              }
            } catch(e2) {}
          }
        });
      }).catch(function() {});
    }
    return results;
  }
};

function showRedPacketPanel() {
  closePlusMenu();

  var html = '<div class="redpacket-overlay" id="redpacket-overlay" onclick="closeRedPacketPanel()">'
    + '<div class="redpacket-panel" onclick="event.stopPropagation()">'
    + '<div class="redpacket-panel-title">🧧 发红包</div>'

    // 金额
    + '<div class="redpacket-field">'
    + '<label class="redpacket-label-text">红包金额</label>'
    + '<div class="redpacket-input-wrap"><span class="redpacket-currency">¥</span>'
    + '<input type="number" id="rp-amount" class="redpacket-input" placeholder="0.00" step="0.01" min="0.01">'
    + '</div></div>'

    // 祝福语
    + '<div class="redpacket-field">'
    + '<label class="redpacket-label-text">祝福语</label>'
    + '<div class="redpacket-input-wrap">'
    + '<input type="text" id="rp-greeting" class="redpacket-input" placeholder="恭喜发财，大吉大利" value="恭喜发财，大吉大利" maxlength="30">'
    + '</div></div>'

    // 发送按钮
    + '<button class="redpacket-send-btn" onclick="sendRedPacket()">塞钱进红包</button>'

    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeRedPacketPanel() {
  var overlay = document.getElementById('redpacket-overlay');
  if (overlay) overlay.remove();
}

function sendRedPacket() {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var type = 'normal';
  var amount = parseFloat(document.getElementById('rp-amount').value);
  var count = 1;
  var greeting = document.getElementById('rp-greeting').value.trim() || '恭喜发财，大吉大利';

  if (!amount || amount <= 0) {
    Core.toast('请输入有效金额');
    return;
  }

  var msgId = Date.now();
  var msg = {
    id: msgId,
    type: 'self',
    text: '[红包]' + greeting,
    time: Date.now(),
    msgType: 'redpacket',
    read: false,
    greeting: greeting,
    rpType: type,
    totalAmount: amount,
    count: count,
    claimed: false,
    amount: 0
  };

  RedPacketStorage.save(chatId, msgId, {
    id: msgId,
    greeting: greeting,
    rpType: type,
    totalAmount: amount,
    count: count,
    claimed: false,
    amount: 0,
    time: msg.time
  });

  var messages = Storage.getMessages(chatId);
  messages.push(msg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, '[红包]' + greeting);
  closeRedPacketPanel();
  renderChatMessages(chatId);
  App.playSound('send');

  // 允许对方角色领取我方发布的红包：发送后触发对方自动回复并领取
  scheduleAutoReply(chatId);
}

function showRedPacketAction(msgId) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg) {
    // 消息尚未从持久层恢复（异步窗口）：避免静默失败，引导用户稍后重试
    if (Core.toast) Core.toast('红包数据尚未加载完成，请稍后再试');
    return;
  }
  if (msg.claimed || msg.returned) return;
  closeRedPacketAction();

  var isSelf = msg.type === 'self';
  var isGrpChat = isGroupChatId(chatId);
  var canClaim = !isSelf;
  var claimBtn = canClaim
    ? '<div class="rp-action-btn primary" onclick="claimRedPacket(\'' + String(msgId) + '\')">领取</div>'
    : '<div class="rp-action-btn primary disabled">领取</div>';
  var html = '<div class="rp-action-overlay" id="rp-action-overlay" onclick="closeRedPacketAction()">'
    + '<div class="rp-action-panel" onclick="event.stopPropagation()">'
    + '<div class="rp-action-icon"><svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true" style="display:block" fill="none" stroke="#FFD34D" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="9" y="19" width="46" height="35" rx="7"/>'
    + '<path d="M9 25 Q32 39 55 25"/>'
    + '<text x="32" y="48" text-anchor="middle" font-size="15" font-weight="bold" fill="#FFD34D" stroke="none" font-family="Arial, sans-serif">¥</text>'
    + '</svg></div>'
    + '<div class="rp-action-greeting">' + Core.escapeHtml(msg.greeting || '恭喜发财，大吉大利') + '</div>'
    + '<div class="rp-action-amount"><span class="rp-action-yuan">¥</span>' + (msg.totalAmount || 0).toFixed(2) + '</div>'
    + '<div class="rp-action-tip">' + (canClaim ? '收到一个红包，请选择操作' : (isGrpChat ? '这是你发出的红包，将随机由群成员领取' : '这是你发出的红包，可退回')) + '</div>'
    + '<div class="rp-action-btns">'
    + claimBtn
    + '<div class="rp-action-btn ghost" onclick="returnRedPacket(\'' + String(msgId) + '\')">退回</div>'
    + '</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeRedPacketAction() {
  var overlay = document.getElementById('rp-action-overlay');
  if (overlay) overlay.remove();
}

function returnRedPacket(msgId) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg || msg.claimed || msg.returned) return;

  msg.returned = true;
  Storage.setMessages(chatId, messages);

  var claimStored = RedPacketStorage.load(chatId, msgId) || {};
  claimStored.returned = true;
  claimStored.time = msg.time;
  RedPacketStorage.save(chatId, msgId, claimStored);

  closeRedPacketAction();
  if (Core.toast) Core.toast('已将红包退回');
  renderChatMessages(chatId);
}

function claimRedPacket(msgId) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg) {
    // 消息尚未从持久层恢复（异步窗口）：避免静默失败，引导用户稍后重试
    if (Core.toast) Core.toast('红包数据尚未加载完成，请稍后再试');
    return;
  }
  if (msg.claimed || msg.returned) return;

  // 红包仅接收方可领取
  if (msg.type === 'self') {
    Core.toast('红包仅接收方可领取');
    return;
  }

  var claimAmount = msg.totalAmount;

  // 领取成功后立即关闭领取/退回面板（避免弹窗残留不消失）
  closeRedPacketAction();

  msg.claimed = true;
  msg.amount = claimAmount;
  Storage.setMessages(chatId, messages);

  var claimStored = RedPacketStorage.load(chatId, msgId) || {};
  claimStored.id = msgId;
  claimStored.greeting = msg.greeting;
  claimStored.rpType = msg.rpType;
  claimStored.totalAmount = msg.totalAmount;
  claimStored.count = msg.count;
  claimStored.claimed = true;
  claimStored.amount = claimAmount;
  claimStored.selfAmount = claimAmount;
  claimStored.selfClaimTime = Date.now();
  claimStored.time = msg.time;
  RedPacketStorage.save(chatId, msgId, claimStored);

  _showClaimResult(msg.greeting, claimAmount);
  renderChatMessages(chatId);
}

function _showClaimResult(greeting, amount) {
  closeRedPacketClaimPanel();

  var html = '<div class="redpacket-overlay" id="redpacket-claim-overlay" onclick="closeRedPacketClaimPanel()">'
    + '<div class="redpacket-claim-panel" onclick="event.stopPropagation()">'
    + '<div class="claim-icon"><svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" style="display:block;margin:0 auto" fill="none" stroke="#F5C542" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="9" y="19" width="46" height="35" rx="7"/>'
    + '<path d="M9 25 Q32 39 55 25"/>'
    + '<text x="32" y="48" text-anchor="middle" font-size="15" font-weight="bold" fill="#F5C542" stroke="none" font-family="Arial, sans-serif">¥</text>'
    + '</svg></div>'
    + '<div class="claim-greeting">' + (greeting || '恭喜发财，大吉大利') + '</div>'
    + '<div class="claim-amount"><span class="claim-yuan">¥</span>' + amount.toFixed(2) + '</div>'
    + '<div class="claim-close-btn" onclick="closeRedPacketClaimPanel()">知道了</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeRedPacketClaimPanel() {
  var overlay = document.getElementById('redpacket-claim-overlay');
  if (overlay) overlay.remove();
}

function showClaimedDetail(msgId) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg || (!msg.claimed && !msg.returned)) return;

  // 获取发送方与双方资料（用于详情展示领取人名字与头像）
  // 无论红包是我方发出还是对方发来，都先解析当前聊天的「对方」角色资料：
  // 我方发出的红包被对方领取后，领取明细同样需要显示账号设置中对方角色的头像与昵称
  var myProfile = Storage.getMyProfile();
  var partner = null;
  var partners = Storage.getPartnerProfiles();
  var partnerId = chatId.replace(/^partner_/, '');
  for (var j = 0; j < partners.length; j++) {
    // 兼容 partner 的 id 可能带/不带 partner_ 前缀的历史数据
    if (partners[j].id === partnerId || partners[j].id === ('partner_' + partnerId) || partners[j].id === chatId) { partner = partners[j]; break; }
  }
  var senderName;
  if (msg.type === 'self') {
    senderName = (myProfile && (myProfile.name || myProfile.nickname)) || '我';
  } else {
    senderName = (partner && (partner.name || partner.nickname)) || '对方';
  }

  var rpTypeText = '红包';
  var timeStr = Core.formatTime ? Core.formatTime(msg.time) : new Date(msg.time).toLocaleString();
  // 领取金额从红包持久化状态恢复（消息对象自身不持久化 selfAmount/otherAmount，
  // 只有 RedPacketStorage 里记录了双方领取明细，缺失时退回消息上的兜底值）
  var savedDetail = RedPacketStorage.load(chatId, msgId) || {};
  var totalAmount = savedDetail.totalAmount || msg.totalAmount || 0;
  var selfAmount = savedDetail.selfAmount || 0;
  var otherAmount = savedDetail.otherAmount || 0;

  // 构建领取明细（领取人员直接绑定「账号设置」中的角色信息：
  //   对方发的红包我方领取 → 显示「我方」角色；我方发的红包对方领取 → 显示当前聊天对应的「对方」角色；
  //   设置了多个对方角色时，按当前聊天绑定的对方角色身份信息显示）
  var claimsHtml = '';
  var claimedTotal = 0;
  function _claimAvatarHtml(profile) {
    // 头像优先使用账号设置中的头像图片；未设置图片时显示首字文字（与聊天列表/消息头像一致）
    var text = (profile && (profile.avatar || profile.nickname || '')) || '';
    if (text.length > 1) text = text.charAt(0);
    var color = (profile && profile.avatarColor) || '#A090B0';
    var shape = (profile && profile.avatarShape === 'square') ? '8px' : '50%';
    var style = 'background:' + color + ';border-radius:' + shape;
    if (profile && profile.avatarImage) {
      style += ';background-image:url(' + profile.avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat';
      return '<div class="rp-detail-claim-avatar" style="' + style + '"></div>';
    }
    return '<div class="rp-detail-claim-avatar" style="' + style + '">' + Core.escapeHtml(text || '?') + '</div>';
  }
  if (selfAmount > 0) {
    // 我方领取：显示账号设置中「我方」角色上传的头像、昵称与领取时间
    var meName = (myProfile && (myProfile.nickname || myProfile.name)) || '你';
    var selfTime = savedDetail.selfClaimTime || msg.time;
    claimsHtml += '<div class="rp-detail-claim-row">' + _claimAvatarHtml(myProfile) + '<div class="rp-detail-claim-main"><span class="rp-detail-claim-who">' + Core.escapeHtml(meName) + '</span><span class="rp-detail-claim-time">' + (Core.formatTime ? Core.formatTime(selfTime) : new Date(selfTime).toLocaleString()) + '</span></div><span class="rp-detail-claim-amount">¥' + selfAmount.toFixed(2) + '</span></div>';
    claimedTotal += selfAmount;
  }
  if (otherAmount > 0) {
    // 对方领取：显示账号设置中当前聊天对应的「对方」角色上传的头像、昵称与领取时间（多个对方角色时按角色身份信息来）
    // 群聊：显示实际领取红包的群成员（按 claimedBy 匹配，缺失时取第一个成员）
    var claimer = partner;
    if (isGroupChatId(chatId)) {
      var grp = getGroupByChatId(chatId);
      var gm = grp ? getGroupMembers(grp) : [];
      var byId = savedDetail.claimedBy;
      var found = null;
      for (var mi = 0; mi < gm.length; mi++) {
        if (gm[mi].id === byId) { found = gm[mi]; break; }
      }
      claimer = found || gm[0] || null;
    }
    var otherName = (claimer && (claimer.nickname || claimer.name)) || '对方';
    var otherTime = savedDetail.otherClaimTime || msg.time;
    claimsHtml += '<div class="rp-detail-claim-row">' + _claimAvatarHtml(claimer) + '<div class="rp-detail-claim-main"><span class="rp-detail-claim-who">' + Core.escapeHtml(otherName) + '</span><span class="rp-detail-claim-time">' + (Core.formatTime ? Core.formatTime(otherTime) : new Date(otherTime).toLocaleString()) + '</span></div><span class="rp-detail-claim-amount">¥' + otherAmount.toFixed(2) + '</span></div>';
    claimedTotal += otherAmount;
  }

  closeClaimedDetail();

  // 状态：已退回 → 已退回；全部领取 → 已领取；部分领取 → 部分领取
  var claimedAll = claimedTotal >= totalAmount - 0.001;
  var statusText = msg.returned ? '已退回' : (claimedAll ? '已领取' : '部分领取');

  var html = '<div class="rp-detail-overlay" id="rp-detail-overlay" onclick="closeClaimedDetail()">'
    + '<div class="rp-detail-panel" onclick="event.stopPropagation()">'
    + '<div class="rp-detail-head">'
    + '<div class="rp-detail-open-icon">' + GOLD_RED_PACKET_ICON_SVG + '</div>'
    + '<div class="rp-detail-greeting">' + (msg.greeting || '恭喜发财，大吉大利') + '</div>'
    + '<div class="rp-detail-amount"><span class="rp-detail-yuan">¥</span>' + totalAmount.toFixed(2) + '</div>'
    + '<div class="rp-detail-status"><i class="fas fa-' + (msg.returned ? 'rotate-left' : 'check-circle') + '"></i>' + statusText + '</div>'
    + '</div>'
    + '<div class="rp-detail-info">'
    + '<div class="rp-detail-row"><span class="rp-detail-label">发送方</span><span class="rp-detail-value">' + Core.escapeHtml(senderName) + '</span></div>'
    + '<div class="rp-detail-row"><span class="rp-detail-label">发送时间</span><span class="rp-detail-value">' + timeStr + '</span></div>'
    + '</div>'
    + (claimsHtml ? '<div class="rp-detail-claims"><div class="rp-detail-claims-title">领取详情</div>' + claimsHtml + '</div>' : '')
    + '<div class="rp-detail-close" onclick="closeClaimedDetail()">知道了</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function closeClaimedDetail() {
  var overlay = document.getElementById('rp-detail-overlay');
  if (overlay) overlay.remove();
}

function _buildUnclaimedListHtml() {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return '';

  var messages = Storage.getMessages(chatId);
  var unclaimed = [];
  for (var i = 0; i < messages.length; i++) {
    // 未领取红包统计：排除已退回红包与己方发送的红包
    if (messages[i].msgType === 'redpacket' && !messages[i].claimed && !messages[i].returned && messages[i].type !== 'self') {
      unclaimed.push(messages[i]);
    }
  }

  var itemsHtml = '';
  if (unclaimed.length === 0) {
    itemsHtml = '<div class="rp-list-empty">当前没有未领取的红包</div>';
  } else {
    unclaimed.forEach(function(rp) {
      itemsHtml += '<div class="rp-list-item" onclick="claimRedPacketFromList(' + rp.id + ')">'
        + '<div class="rp-list-icon">🧧</div>'
        + '<div class="rp-list-info">'
        + '<div class="rp-list-title">' + (rp.greeting || '恭喜发财，大吉大利') + '</div>'
        + '<div class="rp-list-time">' + Core.formatTime(rp.time) + '</div>'
        + '</div>'
        + '<div class="rp-list-type">红包</div>'
        + '</div>';
    });
  }

  return '<div class="redpacket-overlay" id="redpacket-list-overlay" onclick="closeRedPacketList()">'
    + '<div class="chat-bg-panel rp-list-panel" onclick="event.stopPropagation()">'
    + '<div class="chat-bg-title">未领取的红包</div>'
    + '<div class="rp-list-items">' + itemsHtml + '</div>'
    + '<div class="chat-bg-close" onclick="closeRedPacketList()">关闭</div>'
    + '</div></div>';
}

function _renderUnclaimedList() {
  closeRedPacketList();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var html = _buildUnclaimedListHtml();
  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);
}

function showUnclaimedRedPackets() {
  closeChatMenu();
  _renderUnclaimedList();
}

/* 从未领取列表领取红包：只要还有未领取红包，弹窗保持打开并刷新；全部领完才关闭并展示领取结果 */
function claimRedPacketFromList(msgId) {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (String(messages[i].id) === String(msgId)) { msg = messages[i]; break; }
  }
  if (!msg || msg.claimed || msg.returned) return;
  if (msg.type === 'self') {
    Core.toast('红包仅接收方可领取');
    return;
  }

  var claimAmount = msg.totalAmount;
  msg.claimed = true;
  msg.amount = claimAmount;
  Storage.setMessages(chatId, messages);

  var claimStored = RedPacketStorage.load(chatId, msgId) || {};
  claimStored.id = msgId;
  claimStored.greeting = msg.greeting;
  claimStored.rpType = msg.rpType;
  claimStored.totalAmount = msg.totalAmount;
  claimStored.count = msg.count;
  claimStored.claimed = true;
  claimStored.amount = claimAmount;
  claimStored.selfAmount = claimAmount;
  claimStored.selfClaimTime = Date.now();
  claimStored.time = msg.time;
  RedPacketStorage.save(chatId, msgId, claimStored);

  renderChatMessages(chatId);

  // 统计是否还有未领取红包
  var remaining = 0;
  for (var j = 0; j < messages.length; j++) {
    if (messages[j].msgType === 'redpacket' && !messages[j].claimed) remaining++;
  }

  if (remaining > 0) {
    _renderUnclaimedList();  // 还有未领取：列表保持打开并刷新
  } else {
    closeRedPacketList();    // 全部领完：关闭列表并展示领取结果
    _showClaimResult(msg.greeting || '恭喜发财，大吉大利', claimAmount);
  }
}

function closeRedPacketList() {
  var overlay = document.getElementById('redpacket-list-overlay');
  if (overlay) overlay.remove();
}

function viewChatImage(src) {
  // 大图查看
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.onclick = function() { document.body.removeChild(overlay); };
  var img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

