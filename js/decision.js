/* ============================================================
   帮我抉择 功能
   ============================================================ */
var DECISION_MAX_OPTIONS = 10;
var DECISION_MIN_OPTIONS = 2;

/* ---- 打开发布弹窗 ---- */
function openDecisionPanel() {
  closePlusMenu();
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var isGroup = isGroupChatId(chatId);
  var targetHtml = '';
  var targetIds = [];

  if (isGroup) {
    var g = getGroupByChatId(chatId);
    var members = g ? getGroupMembers(g) : [];
    if (!members.length) { Core.toast('群聊暂无成员'); return; }
    targetIds = members.map(function(m) { return m.id; });
    targetHtml = '<div class="decision-target-chip active" data-target="__ALL__"><i class="fas fa-users"></i>全员回答</div>';
    members.forEach(function(m) {
      var av = _decisionChipAvatarHtml(m);
      targetHtml += '<div class="decision-target-chip" data-target="' + m.id + '">' + av + Core.escapeHtml(m.nickname || '成员') + '</div>';
    });
  } else {
    var partners = Storage.getPartnerProfiles();
    var pid = _chatCurrentPartnerId;
    var partner = null;
    for (var i = 0; i < partners.length; i++) {
      if (partners[i].id === pid) { partner = partners[i]; break; }
    }
    if (!partner) { Core.toast('未找到聊天对象'); return; }
    targetIds = [pid];
    var pav = _decisionChipAvatarHtml(partner);
    targetHtml = '<div class="decision-target-chip active" data-target="' + pid + '">' + pav + Core.escapeHtml(partner.nickname || '对方') + '</div>';
  }

  var html =
    '<div class="decision-overlay" id="decision-overlay" onclick="closeDecisionPanel()">'
    + '<div class="decision-panel" onclick="event.stopPropagation()">'
    + '<div class="decision-title"><i class="fas fa-scale-balanced"></i>帮我抉择</div>'

    + '<div class="decision-field">'
    + '<label>问题</label>'
    + '<textarea class="decision-input" id="decision-question" placeholder="想让大家帮你决定什么？" maxlength="100"></textarea>'
    + '</div>'

    + '<div class="decision-field">'
    + '<label>答案选项（最多 10 条）</label>'
    + '<div class="decision-options-wrap" id="decision-options-wrap">'
    + _decisionOptionRowHtml(0, '')
    + _decisionOptionRowHtml(1, '')
    + '</div>'
    + '<button class="decision-add-option" id="decision-add-option" onclick="decisionAddOption()"><i class="fas fa-plus"></i> 添加答案</button>'
    + '<div class="decision-option-count" id="decision-option-count">2 / 10</div>'
    + '</div>'

    + '<div class="decision-field">'
    + '<label>' + (isGroup ? '让谁回答' : '回答对象') + '</label>'
    + '<div class="decision-target-list" id="decision-target-list">' + targetHtml + '</div>'
    + '</div>'

    + '<div class="decision-actions">'
    + '<button class="decision-btn decision-btn-cancel" onclick="closeDecisionPanel()">取消</button>'
    + '<button class="decision-btn decision-btn-send" id="decision-send-btn" onclick="publishDecision()">发布抉择</button>'
    + '</div>'

    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);

  var overlay = document.getElementById('decision-overlay');
  if (overlay) {
    // 仅拦截遮罩背景自身的触摸滚动（避免背景页面跟手滚动），
    // 放行 decision-panel 内部滚动，保证选项多时（最多10条）在移动端可正常滑动查看
    overlay.addEventListener('touchmove', function(e) {
      if (e.target === overlay) e.preventDefault();
    }, { passive: false });
  }
  bindDecisionTargetChips();
  // 打开弹窗时不自动弹出输入法，点击对应输入框时才弹出
}

function _decisionChipAvatarHtml(m) {
  var text = (m.avatar || m.nickname || '?').charAt(0);
  var color = m.avatarColor || '#A090B0';
  if (m.avatarImage) {
    return '<span class="chip-avatar" style="background:' + color + ';background-image:url(' + m.avatarImage + ');background-size:cover;background-position:center"></span>';
  }
  return '<span class="chip-avatar" style="background:' + color + '">' + Core.escapeHtml(text) + '</span>';
}

function _decisionOptionRowHtml(index, value) {
  return '<div class="decision-option-row">'
    + '<input type="text" class="decision-input decision-option-input" data-idx="' + index + '" maxlength="50" placeholder="答案 ' + (index + 1) + '" value="' + Core.escapeHtml(value) + '">'
    + (index >= 2 ? '<button class="decision-option-del" onclick="decisionRemoveOption(this)"><i class="fas fa-times"></i></button>' : '')
    + '</div>';
}

function decisionAddOption() {
  var wrap = document.getElementById('decision-options-wrap');
  if (!wrap) return;
  var rows = wrap.querySelectorAll('.decision-option-row');
  if (rows.length >= DECISION_MAX_OPTIONS) { Core.toast('最多设置 ' + DECISION_MAX_OPTIONS + ' 条答案'); return; }
  var newIdx = rows.length;
  var tmp = document.createElement('div');
  tmp.innerHTML = _decisionOptionRowHtml(newIdx, '');
  wrap.appendChild(tmp.firstChild);
  decisionUpdateOptionCount();
  // 添加选项时不自动弹出输入法，点击对应输入框时才弹出
}

function decisionRemoveOption(btn) {
  var wrap = document.getElementById('decision-options-wrap');
  if (!wrap) return;
  var rows = wrap.querySelectorAll('.decision-option-row');
  if (rows.length <= DECISION_MIN_OPTIONS) { Core.toast('至少保留 2 条答案'); return; }
  var row = btn.closest('.decision-option-row');
  if (row) row.remove();
  // 重新编号
  var inputs = wrap.querySelectorAll('.decision-option-input');
  inputs.forEach(function(inp, i) { inp.dataset.idx = i; inp.placeholder = '答案 ' + (i + 1); });
  decisionUpdateOptionCount();
}

function decisionUpdateOptionCount() {
  var wrap = document.getElementById('decision-options-wrap');
  var countEl = document.getElementById('decision-option-count');
  if (!wrap || !countEl) return;
  var n = wrap.querySelectorAll('.decision-option-row').length;
  countEl.textContent = n + ' / ' + DECISION_MAX_OPTIONS;
}

function bindDecisionTargetChips() {
  var list = document.getElementById('decision-target-list');
  if (!list) return;
  list.addEventListener('click', function(e) {
    var chip = e.target.closest ? e.target.closest('.decision-target-chip') : null;
    if (!chip) return;
    var chips = list.querySelectorAll('.decision-target-chip');
    chips.forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
  });
}

function closeDecisionPanel() {
  var overlay = document.getElementById('decision-overlay');
  if (overlay) overlay.remove();
}

/* ---- 发布抉择 ---- */
function publishDecision() {
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  if (!chatId) return;

  var question = (document.getElementById('decision-question') || {}).value || '';
  question = question.trim();
  if (!question) { Core.toast('请输入问题'); return; }

  var wrap = document.getElementById('decision-options-wrap');
  var inputs = wrap ? wrap.querySelectorAll('.decision-option-input') : [];
  var options = [];
  for (var i = 0; i < inputs.length; i++) {
    var v = (inputs[i].value || '').trim();
    if (v) options.push(v);
  }
  if (options.length < DECISION_MIN_OPTIONS) { Core.toast('至少填写 2 条答案'); return; }
  if (options.length > DECISION_MAX_OPTIONS) { Core.toast('最多 10 条答案'); return; }
  var dupCheck = {};
  var dup = false;
  options.forEach(function(o) { if (dupCheck[o]) dup = true; dupCheck[o] = 1; });
  if (dup) { Core.toast('答案不能重复'); return; }

  // 获取回答目标
  var activeChip = document.querySelector('#decision-target-list .decision-target-chip.active');
  var targetId = activeChip ? activeChip.dataset.target : '';
  if (!targetId) { Core.toast('请选择回答对象'); return; }

  var isGroup = isGroupChatId(chatId);
  var answers = [];  // {memberId, memberName, optionIdx}
  var pendingCount = 0;

  if (isGroup) {
    var g = getGroupByChatId(chatId);
    var members = g ? getGroupMembers(g) : [];
    if (targetId === '__ALL__') {
      members.forEach(function(m) { answers.push({ memberId: m.id, memberName: m.nickname || '成员' }); });
    } else {
      var found = null;
      for (var i = 0; i < members.length; i++) {
        if (members[i].id === targetId) { found = members[i]; break; }
      }
      if (!found) { Core.toast('目标成员不存在'); return; }
      answers.push({ memberId: found.id, memberName: found.nickname || '成员' });
    }
  } else {
    var pid = _chatCurrentPartnerId;
    var partners = Storage.getPartnerProfiles();
    var partner = null;
    for (var i = 0; i < partners.length; i++) {
      if (partners[i].id === pid) { partner = partners[i]; break; }
    }
    if (!partner) { Core.toast('未找到聊天对象'); return; }
    answers.push({ memberId: pid, memberName: partner.nickname || '对方' });
  }

  var msgId = Date.now();
  var msg = {
    id: msgId,
    type: 'self',
    text: '[抉择]' + question,
    time: Date.now(),
    msgType: 'decision',
    read: false,
    decision: {
      question: question,
      options: options,
      isGroup: isGroup,
      answers: answers,          // 待回答者列表（含已答状态）
      result: {},                // memberId -> optionIdx
      pending: true,
      publishedAt: Date.now()
    }
  };

  var messages = Storage.getMessages(chatId);
  messages.push(msg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, '[帮我抉择] ' + question);
  closeDecisionPanel();
  renderChatMessages(chatId);
  App.playSound('send');

  // 发布后 1~3 秒随机开始回答
  var delay = 1000 + Math.random() * 2000;
  setTimeout(function() { decisionRunAnswers(chatId, msgId); }, delay);
}

/* ---- 角色作答（每个答案概率均等，随机选择） ---- */
function decisionRunAnswers(chatId, msgId) {
  var messages = Storage.getMessages(chatId);
  var msg = null;
  for (var i = 0; i < messages.length; i++) {
    if (messages[i].id === msgId) { msg = messages[i]; break; }
  }
  if (!msg || !msg.decision) return;
  var d = msg.decision;
  if (!d.pending) return;

  // 找出尚未作答者
  var pendingAnswers = d.answers.filter(function(a) { return d.result[a.memberId] === undefined; });
  if (!pendingAnswers.length) { d.pending = false; Storage.setMessages(chatId, messages); _safeRenderChat(chatId); return; }

  // 每个回答者：1~3 秒内随机作答，概率均等
  var optionCount = d.options.length;
  pendingAnswers.forEach(function(a, idx) {
    setTimeout(function() {
      var cur = Storage.getMessages(chatId);
      var m = null;
      for (var i = 0; i < cur.length; i++) {
        if (cur[i].id === msgId) { m = cur[i]; break; }
      }
      if (!m || !m.decision || m.decision.result[a.memberId] !== undefined) return;
      var pickIdx = Math.floor(Math.random() * optionCount);
      m.decision.result[a.memberId] = pickIdx;
      var allAnswered = m.decision.answers.every(function(an) { return m.decision.result[an.memberId] !== undefined; });
      if (allAnswered) m.decision.pending = false;
      Storage.setMessages(chatId, cur);
      _safeRenderChat(chatId);
      App.playSound('receive');
      var memberName = a.memberName || '对方';
      showBackgroundPush(memberName + ' 选择了：' + m.decision.options[pickIdx]);
      updateLastMsg(chatId, '[' + m.decision.question + '] ' + memberName + ' 选择了 ' + m.decision.options[pickIdx]);
    }, 1000 + Math.random() * 2000 + idx * 900);
  });
}

/* ---- 页面加载时：恢复未完成的抉择作答（刷新/重进） ---- */
function decisionResumePending(chatId) {
  if (!chatId) return;
  var messages = Storage.getMessages(chatId);
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (m.msgType === 'decision' && m.decision && m.decision.pending) {
      var pendingAnswers = m.decision.answers.filter(function(a) { return m.decision.result[a.memberId] === undefined; });
      if (pendingAnswers.length) {
        var delay = 1000 + Math.random() * 2000;
        setTimeout(function() { decisionRunAnswers(chatId, m.id); }, delay);
      } else {
        m.decision.pending = false;
        Storage.setMessages(chatId, messages);
      }
    }
  }
}

/* ---- 渲染：抉择卡片 HTML ---- */
function _buildDecisionCardHtml(msg, isSelf, selfAvatarHtml, otherAvatarHtml, senderName, senderStatusHtml, isGroup) {
  var d = msg.decision || {};
  var options = d.options || [];
  var result = d.result || {};
  var answers = d.answers || [];

  // 统计每个选项被谁选择
  var optPickNames = {};
  options.forEach(function(o, idx) { optPickNames[idx] = []; });
  answers.forEach(function(a) {
    var idx = result[a.memberId];
    if (idx !== undefined && optPickNames[idx] !== undefined) optPickNames[idx].push(a.memberName || '对方');
  });

  var optHtml = '';
  options.forEach(function(o, idx) {
    var picked = optPickNames[idx].length > 0 ? ' picked' : '';
    var votes = optPickNames[idx].length > 0 ? optPickNames[idx].join('、') : '';
    optHtml += '<div class="decision-opt-item' + picked + '">'
      + '<span class="opt-tag">' + (idx + 1) + '</span>'
      + '<span class="opt-text">' + Core.escapeHtml(o) + '</span>'
      + (votes ? '<span class="opt-votes">' + Core.escapeHtml(votes) + '</span>' : '')
      + '</div>';
  });

  var pending = d.pending;
  var answeredCount = answers.filter(function(a) { return result[a.memberId] !== undefined; }).length;
  var statusHtml = pending
    ? '<span class="pulse-dot"></span>抉择中… ' + answeredCount + '/' + answers.length + ' 已选择'
    : '<i class="fas fa-check-circle"></i>抉择完成';

  var senderHtml = senderName
    ? '<div class="message-sender-name">' + Core.escapeHtml(senderName) + (senderStatusHtml || '') + '</div>'
    : '';

  return '<div class="message-row ' + (isSelf ? 'self' : 'other') + '" data-msg-id="' + msg.id + '">'
    + (isSelf ? selfAvatarHtml : otherAvatarHtml)
    + '<div class="message-body">'
    + senderHtml
    + '<div class="decision-card">'
    + '<div class="decision-card-head"><i class="fas fa-scale-balanced"></i>帮我抉择</div>'
    + '<div class="decision-card-question">' + Core.escapeHtml(d.question || '') + '</div>'
    + '<div class="decision-card-options">' + optHtml + '</div>'
    + '<div class="decision-card-status' + (pending ? '' : ' done') + '">' + statusHtml + '</div>'
    + '</div>'
    + '<div class="message-meta">' + _buildReadStatusHtml(msg) + '<div class="message-time">' + Core.formatTime(msg.time) + '</div></div>'
    + '</div>'
    + '</div>';
}

/* ---- 接入渲染循环：抉择消息分支 ---- */
var _origBuildNormalMessageHtml = _buildNormalMessageHtml;
_buildNormalMessageHtml = function(msg, isSelf, selfAvatarHtml, otherAvatarHtml, suffixHtml, senderName, senderStatusHtml, rowGroupCls) {
  if (msg.msgType === 'decision') {
    var isGrp = isGroupChatId(document.getElementById('page-chat-room').dataset.chatId || '');
    return _buildDecisionCardHtml(msg, isSelf, selfAvatarHtml, otherAvatarHtml, senderName, senderStatusHtml, isGrp);
  }
  return _origBuildNormalMessageHtml.apply(this, arguments);
};

/* ---- 接入自动回复：存在待回答抉择时不触发普通自动回复 ---- */
var _origScheduleAutoReply = scheduleAutoReply;
scheduleAutoReply = function(chatId) {
  var messages = Storage.getMessages(chatId);
  for (var i = messages.length - 1; i >= 0; i--) {
    var m = messages[i];
    if (m.msgType === 'decision' && m.decision && m.decision.pending) {
      // 等待抉择作答，跳过普通自动回复
      return;
    }
  }
  return _origScheduleAutoReply.apply(this, arguments);
};

/* ---- 接入打开聊天室：恢复未完成抉择 ---- */
var _origRenderChatMessages = renderChatMessages;
renderChatMessages = function(chatId) {
  var ret = _origRenderChatMessages.apply(this, arguments);
  if (chatId) {
    setTimeout(function() { decisionResumePending(chatId); }, 300);
  }
  return ret;
};
