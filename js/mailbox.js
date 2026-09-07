/* ==== mailbox.js ==== */
/* ===== 时空信箱：便签风格信件 + 双向通信 + 回信设置 ===== */

const MailboxApp = {
  _storeKey: 'timeMailbox_v1',
  _settingsKey: 'mailboxSettings_v1',
  _mailboxTab: 'write', // 信箱首页当前 Tab：write（寄出的信）/ inbox（时空来信）

  /* ---------- 基础读写 ---------- */
  _load() {
    return Storage.get(this._storeKey, null) || { letters: [], nextIncomingTime: 0 };
  },

  _save(data) {
    Storage.set(this._storeKey, data);
  },

  getSettings() {
    var s = Storage.get(this._settingsKey, null);
    if (s && s.cardCount) {
      // 兼容旧版本的小时字段，缺失时换算为秒
      return {
        incomingIntervalSec: s.incomingIntervalSec || (s.incomingIntervalHours || 24) * 3600,
        replyDelaySec: s.replyDelaySec || (s.replyDelayHours || 6) * 3600,
        cardCount: s.cardCount
      };
    }
    return { incomingIntervalSec: 24 * 3600, replyDelaySec: 6 * 3600, cardCount: 2 };
  },

  saveSettings(s) {
    // 清理旧版本的小时字段，避免残留
    delete s.incomingIntervalHours;
    delete s.replyDelayHours;
    Storage.set(this._settingsKey, s);
    // 性能优化第一批：设置变更后立即按新设置重算下一唤醒时刻
    if (this._mailboxTimer) this._scheduleTick();
  },

  /* ---------- 主字卡抽取 ---------- */
  // 从字卡模块（Storage.getCards）随机抽取 N 句主字卡
  // 与聊天中对方主动发送一致：仅取「主字卡」（过滤无文本项与「格言」分组）
  _pickCards(count) {
    var cards = Storage.getCards() || [];
    if (!Array.isArray(cards)) cards = [];
    var mainCards = cards.filter(function (c) { return c && c.text && c.category !== '格言'; });
    // 兜底：存储字卡为空/异常时回退到默认字卡，保证来信/回信正文不为空
    if (!mainCards.length) {
      mainCards = (window.DefaultData && DefaultData.cards || []).filter(function (c) { return c && c.text; });
    }
    if (!mainCards.length) return [];
    var shuffled = mainCards.slice().sort(function () { return Math.random() - 0.5; });
    var n = Math.max(1, Math.min(count || 1, shuffled.length));
    return shuffled.slice(0, n).map(function (c) { return { text: c.text, source: c.category || '' }; });
  },

  /* ---------- 时间调度（全局定时器触发 + 进入信箱时惰性触发兜底） ---------- */
  // 兼容修复：旧版本可能产生 content 为空的信，进入信箱时用其已附字卡补全正文
  _repairBlankContent(data) {
    var changed = false;
    data.letters.forEach(function (l) {
      if (l.content) return;
      var texts = (l.cards || []).map(function (c) { return c && c.text; }).filter(Boolean);
      if (texts.length) {
        l.content = texts.join('\n');
        changed = true;
      }
    });
    return changed;
  },

  // 处理到期信件（对方主动来信 + 我方寄出信的回信），返回是否发生变更
  _processPending() {
    var data = this._load();
    var settings = this.getSettings();
    var now = Date.now();
    var changed = this._repairBlankContent(data);

    // 1) 对方主动来信调度（按「对方主动写信时间」间隔）
    // 防护：nextIncomingTime 若明显超过「当前时间 + 当前间隔 3 倍」的未来值（如设置从大改小后残留的旧时间戳），
    // 重置为 0 立即触发，避免旧时间戳持续阻塞来信导致「设置 1 秒也收不到」。
    if (data.nextIncomingTime && data.nextIncomingTime > now + settings.incomingIntervalSec * 1000 * 3) {
      data.nextIncomingTime = 0;
      changed = true;
    }
    if (!data.nextIncomingTime) {
      data.nextIncomingTime = now; // 首次进入立即来一封，方便体验
    }
    var guard = 0;
    while (data.nextIncomingTime && data.nextIncomingTime <= now && guard < 20) {
      this._spawnIncoming(data, now, settings);
      data.nextIncomingTime = now + settings.incomingIntervalSec * 1000;
      guard++;
      changed = true;
    }

    // 2) 我方寄出信件的对方回信调度（按「对方回信时间」延迟）
    var self = this;
    data.letters.forEach(function (l) {
      if (l.direction === 'out' && l.status === 'waiting_reply' && !l.replyTime) {
        if (now >= l.sendTime + settings.replyDelaySec * 1000) {
          self._autoReply(data, l, now, settings);
          changed = true;
        }
      }
    });

    if (changed) this._save(data);
    return changed;
  },

  /* ---------- 全局定时调度（参照聊天「主动发送」定时器，setTimeout 链式，到点必发） ---------- */
  _mailboxTimer: null,

  // 应用启动时调用：无论停留在哪个页面都周期检查到期信件，保证「对方主动写信时间」按设置稳定生效
  startScheduler() {
    if (this._mailboxTimer) return;
    this._scheduleTick();
  },

  stopScheduler() {
    if (this._mailboxTimer) {
      clearTimeout(this._mailboxTimer);
      this._mailboxTimer = null;
    }
  },

  _scheduleTick() {
    var self = this;
    var delay = this._computeNextDelay();
    this._mailboxTimer = setTimeout(function () {
      // 先排下一轮，避免回调异常导致调度中断
      self._scheduleTick();
      try {
        var changed = self._processPending();
        if (changed && window.Navigation) {
          var page = Navigation.currentPage;
          if (page === 'mailbox') {
            // 正在信箱首页：刷新当前 Tab 列表
            self.renderMailbox();
          } else if (page === 'mailbox-detail') {
            // 正在详情页：刷新详情（信件可能刚被回信/生成）
            var id = window._mailboxDetailLetterId;
            if (id) self.renderMailboxDetail(id);
          }
        }
      } catch (e) {}
    }, delay);
  },

  // 性能优化第一批：睡到下一个"可能发生事件"的时刻（来信时间 / 最早待回信到期时间），clamp [100ms, 60s]
  _computeNextDelay() {
    var data = this._load();
    var s = this.getSettings();
    var now = Date.now();
    var next = Number(data.nextIncomingTime) || 0;
    var letters = data.letters || [];
    for (var i = 0; i < letters.length; i++) {
      var l = letters[i];
      if (l.status === 'waiting_reply') {
        var due = (Number(l.sendTime) || 0) + (s.replyDelaySec || 6 * 3600) * 1000;
        if (due > now && (next === 0 || due < next)) next = due;
      }
    }
    if (!next) return 30000;
    return Math.max(100, Math.min(next - now, 60000));
  },

  // 生成一封对方主动来信（内容 = 主字卡）
  _spawnIncoming(data, now, settings) {
    var cards = this._pickCards(settings.cardCount);
    var content = cards.map(function (c) { return c.text; }).join('\n');
    var letter = {
      id: 'ml_in_' + now + '_' + Math.floor(Math.random() * 10000),
      direction: 'in',
      status: 'waiting_reply',
      content: content || '悄悄寄来一句话：想你了～',
      cards: cards,
      sendTime: now,
      replyTime: null,
      replyContent: '',
      announceToChat: false
    };
    data.letters.unshift(letter);
  },

  // 对方自动回信（对我方寄出的信，内容 = 主字卡）
  _autoReply(data, letter, now, settings) {
    var cards = this._pickCards(settings.cardCount);
    var replyContent = cards.map(function (c) { return c.text; }).join('\n');
    letter.status = 'replied';
    letter.replyTime = now;
    letter.replyContent = replyContent || '悄悄回了一句：想你啦～';
  },

  /* ---------- 信箱渲染（寄出的信 / 时空来信 双 Tab） ---------- */
  renderMailbox() {
    this._processPending();
    var data = this._load();
    var container = document.getElementById('mailbox-list');
    if (!container) return;

    var tab = this._mailboxTab === 'inbox' ? 'inbox' : 'write';
    var tabBar = '<div class="mailbox-tabs" id="mailbox-tabs">'
      + '<div class="mailbox-tab' + (tab === 'write' ? ' is-active' : '') + '" id="mailbox-tab-write" onclick="switchMailboxTab(\'write\')"><i class="fas fa-paper-plane"></i>寄出的信</div>'
      + '<div class="mailbox-tab' + (tab === 'inbox' ? ' is-active' : '') + '" id="mailbox-tab-inbox" onclick="switchMailboxTab(\'inbox\')"><i class="fas fa-envelope-open-text"></i>时空来信</div>'
      + '</div>';

    var body = tab === 'write' ? this._buildWriteTabHtml(data) : this._buildInboxTabHtml(data);
    container.innerHTML = tabBar + '<div class="mailbox-body">' + body + '</div>';
  },

  switchMailboxTab(tab) {
    this._mailboxTab = (tab === 'inbox') ? 'inbox' : 'write';
    this.renderMailbox();
  },

  // 「寄出的信」Tab：我方寄出的所有信件列表（每行显示时间/摘要/回信状态，点击查看详情）
  _buildWriteTabHtml(data) {
    var outLetters = data.letters.filter(function (l) { return l.direction === 'out'; });
    var listHtml = '';
    var self = this;
    outLetters.forEach(function (l) {
      listHtml += self._buildOutLetterItem(l);
    });
    if (!listHtml) {
      listHtml = '<div class="mailbox-empty"><i class="fas fa-paper-plane"></i>还没有寄出的信，点右上角铅笔写一封吧</div>';
    }
    return '<div class="mailbox-section">'
      + '<div class="mailbox-section-title"><span class="sec-icon"><i class="fas fa-paper-plane"></i></span>寄出的信<span class="sec-count">' + outLetters.length + '</span></div>'
      + listHtml
      + '</div>';
  },

  // 「时空来信」Tab：收到的信列表（对方主动来信 + 我方寄出信收到的回信）
  _buildInboxTabHtml(data) {
    var inLetters = data.letters.filter(function (l) { return l.direction === 'in'; });
    var outReplied = data.letters.filter(function (l) {
      return l.direction === 'out' && l.status === 'replied' && l.replyContent;
    });
    var listHtml = '';
    var self = this;
    inLetters.forEach(function (l) {
      listHtml += self._buildIncomingItem(l);
    });
    outReplied.forEach(function (l) {
      listHtml += self._buildReplyItem(l);
    });
    if (!listHtml) {
      listHtml = '<div class="mailbox-empty"><i class="fas fa-envelope-open-text"></i>还没有来信，去写一封信吧</div>';
    }
    return '<div class="mailbox-section">'
      + '<div class="mailbox-section-title"><span class="sec-icon"><i class="fas fa-envelope-open-text"></i></span>收到的信<span class="sec-count">' + (inLetters.length + outReplied.length) + '</span></div>'
      + listHtml
      + '</div>';
  },

  // 我方寄出信列表项（点击查看详情）
  _buildOutLetterItem(l) {
    var footerHtml = '';
    if (l.status === 'replied' && l.replyContent) {
      footerHtml = '<div class="letter-note-footer">'
        + '<span class="letter-reply-badge"><i class="fas fa-reply"></i> 已收到回信</span>'
        + '<span class="letter-status is-done">' + Core.formatTime(l.replyTime) + '</span>'
        + '<button class="letter-delete-btn" onclick="event.stopPropagation();MailboxApp.confirmDeleteLetter(\'' + l.id + '\')" title="删除这封信"><i class="fas fa-trash-alt"></i></button>'
        + '</div>';
    } else {
      footerHtml = '<div class="letter-note-footer">'
        + '<span class="letter-status is-waiting"><i class="fas fa-hourglass-half"></i> 等待回信</span>'
        + '<span class="letter-go-detail"><i class="fas fa-chevron-right"></i></span>'
        + '<button class="letter-delete-btn" onclick="event.stopPropagation();MailboxApp.confirmDeleteLetter(\'' + l.id + '\')" title="删除这封信"><i class="fas fa-trash-alt"></i></button>'
        + '</div>';
    }
    return '<div class="letter-note is-out is-clickable" onclick="openMailboxDetail(\'' + l.id + '\')">'
      + '<div class="letter-note-header">'
      + '<span class="letter-role-tag"><i class="fas fa-paper-plane"></i> 我寄出的信</span>'
      + '<span class="letter-time">' + Core.formatTime(l.sendTime) + '</span>'
      + '</div>'
      + '<div class="letter-note-content letter-note-clamp">' + Core.escapeHtml(l.content) + '</div>'
      + footerHtml
      + '</div>';
  },

  // 对方主动来信列表项（点击查看详情；等待回信时可直接回信）
  _buildIncomingItem(l) {
    var footerHtml = '';
    if (l.status === 'replied' && l.replyContent) {
      footerHtml = '<div class="letter-note-footer">'
        + '<span class="letter-reply-badge"><i class="fas fa-reply"></i> 已回信</span>'
        + '<span class="letter-status is-done">' + Core.formatTime(l.replyTime) + '</span>'
        + '<button class="letter-delete-btn" onclick="event.stopPropagation();MailboxApp.confirmDeleteLetter(\'' + l.id + '\')" title="删除这封信"><i class="fas fa-trash-alt"></i></button>'
        + '</div>';
    } else {
      footerHtml = '<div class="letter-note-footer">'
        + '<span class="letter-status is-waiting"><i class="fas fa-hourglass-half"></i> 等待你的回信</span>'
        + '<button class="letter-reply-btn" onclick="event.stopPropagation();openReplyLetter(\'' + l.id + '\')"><i class="fas fa-reply"></i> 回信</button>'
        + '<button class="letter-delete-btn" onclick="event.stopPropagation();MailboxApp.confirmDeleteLetter(\'' + l.id + '\')" title="删除这封信"><i class="fas fa-trash-alt"></i></button>'
        + '</div>';
    }
    return '<div class="letter-note is-incoming is-clickable" onclick="openMailboxDetail(\'' + l.id + '\')">'
      + '<div class="letter-note-header">'
      + '<span class="letter-role-tag"><i class="fas fa-user"></i> TA 的来信</span>'
      + '<span class="letter-time">' + Core.formatTime(l.sendTime) + '</span>'
      + '</div>'
      + '<div class="letter-note-content letter-note-clamp">' + Core.escapeHtml(l.content) + '</div>'
      + footerHtml
      + '</div>';
  },

  // 我方寄出信收到的回信列表项（点击查看详情）
  _buildReplyItem(l) {
    var footerHtml = '<div class="letter-note-footer">'
      + '<span class="letter-status is-done"><i class="fas fa-check"></i> 回信已送达</span>'
      + '<button class="letter-delete-btn" onclick="event.stopPropagation();MailboxApp.confirmDeleteLetter(\'' + l.id + '\')" title="删除这封信"><i class="fas fa-trash-alt"></i></button>'
      + '</div>';
    return '<div class="letter-note is-reply is-clickable" onclick="openMailboxDetail(\'' + l.id + '\')">'
      + '<div class="letter-note-header">'
      + '<span class="letter-reply-badge"><i class="fas fa-reply"></i> 回信</span>'
      + '<span class="letter-time">' + Core.formatTime(l.replyTime) + '</span>'
      + '</div>'
      + '<div class="letter-note-content letter-note-clamp">' + Core.escapeHtml(l.replyContent) + '</div>'
      + '<div class="letter-quote-ref">原信：' + Core.escapeHtml((l.content || '').slice(0, 60)) + '</div>'
      + footerHtml
      + '</div>';
  },

  /* ---------- 信件详情 ---------- */
  openMailboxDetail(letterId) {
    window._mailboxDetailLetterId = letterId;
    this.renderMailboxDetail(letterId);
    Navigation.navigateTo('mailbox-detail');
  },

  renderMailboxDetail(letterId) {
    var data = this._load();
    var letter = null;
    data.letters.forEach(function (l) { if (l.id === letterId) letter = l; });
    var container = document.getElementById('mailbox-detail-container');
    if (!container) return;
    if (!letter) {
      container.innerHTML = '<div class="mailbox-empty"><i class="fas fa-envelope-open"></i>信件不存在或已被移除</div>';
      return;
    }
    container.innerHTML = '<div class="mailbox-detail-body">' + this._buildDetailHtml(letter) + '</div>';
  },

  _buildDetailHtml(l) {
    // 详情页只展示完整正文（正文已包含字卡文本），不再重复渲染字卡单条卡片列表
    var isOut = l.direction === 'out';
    var isReplied = l.status === 'replied' && l.replyContent;

    var roleTag = isOut
      ? '<span class="letter-role-tag"><i class="fas fa-paper-plane"></i> 我寄出的信</span>'
      : '<span class="letter-role-tag"><i class="fas fa-user"></i> TA 的来信</span>';

    var statusBadge = '';
    if (isOut && isReplied) {
      statusBadge = '<span class="letter-status is-done"><i class="fas fa-reply"></i> 已收到回信</span>';
    } else if (isOut) {
      statusBadge = '<span class="letter-status is-waiting"><i class="fas fa-hourglass-half"></i> 等待回信</span>';
    } else if (isReplied) {
      statusBadge = '<span class="letter-status is-done"><i class="fas fa-check"></i> 已回信</span>';
    } else {
      statusBadge = '<span class="letter-status is-waiting"><i class="fas fa-hourglass-half"></i> 等待你的回信</span>';
    }

    var html = '<div class="detail-letter' + (isOut ? ' is-out' : ' is-incoming') + '">'
      + '<div class="detail-letter-header">'
      + roleTag
      + '<span class="detail-status">' + statusBadge + '</span>'
      + '</div>'
      + '<div class="detail-time">' + Core.formatTime(l.sendTime) + '</div>'
      + '<div class="detail-letter-content">' + Core.escapeHtml(l.content) + '</div>'
      + '</div>';

    // 回信区块 / 回信操作
    if (isOut && isReplied) {
      html += '<div class="detail-reply-block">'
        + '<div class="detail-reply-title"><i class="fas fa-reply"></i> TA 的回信<span class="detail-time">' + Core.formatTime(l.replyTime) + '</span></div>'
        + '<div class="detail-reply-content">' + Core.escapeHtml(l.replyContent) + '</div>'
        + '</div>';
    } else if (!isOut && isReplied) {
      html += '<div class="detail-reply-block">'
        + '<div class="detail-reply-title"><i class="fas fa-reply"></i> 我的回信<span class="detail-time">' + Core.formatTime(l.replyTime) + '</span></div>'
        + '<div class="detail-reply-content">' + Core.escapeHtml(l.replyContent) + '</div>'
        + '</div>';
    } else if (!isOut && !isReplied) {
      // 对方来信未回：详情页仅保留回信操作；删除入口保留在外面的列表项垃圾桶按钮
      html += '<div class="detail-actions">'
        + '<button class="letter-send-btn" onclick="openReplyLetter(\'' + l.id + '\')"><i class="fas fa-reply"></i> 回信给 TA</button>'
        + '</div>';
    }
    // isOut && !isReplied（寄出等待回信）：详情页仅展示正文与状态，无额外操作

    return html;
  },

  /* ---------- 写信 ---------- */
  openWriteLetter() {
    // 我方写信不再附带主字卡，字卡仅用于对方主动写信/对方回信
    this._renderWritePage();
    Navigation.navigateTo('write-letter');
  },

  _renderWritePage() {
    var editor = document.getElementById('letter-editor-container');
    if (!editor) return;
    var partners = Storage.getPartnerProfiles() || [];
    var targetName = partners.length ? (partners[0].nickname || 'TA') : 'TA';
    editor.innerHTML = '<div class="letter-editor">'
      + '<div class="letter-editor-note"><textarea id="letter-content" placeholder="写给亲爱的' + Core.escapeHtml(targetName) + '：\n\n写下你想说的话..."></textarea></div>'
      + '<div class="letter-announce-option" onclick="document.getElementById(\'letter-announce-check\').click()">'
      + '<div class="a-icon"><i class="fas fa-bullhorn"></i></div>'
      + '<div class="a-text"><div class="a-title">发送至聊天公告</div><div class="a-desc">在单人聊天界面以公告形式通知 TA</div></div>'
      + '<input type="checkbox" id="letter-announce-check" onclick="event.stopPropagation()">'
      + '</div>'
      + '<button class="letter-send-btn" onclick="sendLetter()"><i class="fas fa-paper-plane"></i> 寄出这封信</button>'
      + '</div>';
  },

  sendLetter() {
    var textarea = document.getElementById('letter-content');
    if (!textarea || !textarea.value.trim()) {
      Core.toast('请先写下想说的话');
      return;
    }
    // 我方写信不附带主字卡，cards 置空以保持数据结构不变
    var cards = [];
    var announce = !!(document.getElementById('letter-announce-check') && document.getElementById('letter-announce-check').checked);

    var letter = {
      id: 'ml_out_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      direction: 'out',
      status: 'waiting_reply',
      content: textarea.value.trim(),
      cards: cards,
      sendTime: Date.now(),
      replyTime: null,
      replyContent: '',
      announceToChat: announce
    };

    var data = this._load();
    data.letters.unshift(letter);
    this._save(data);

    if (announce) {
      this._pushChatAnnounce(letter);
    }

    Core.toast('信件已寄出，等待 TA 的回信');
    setTimeout(function () { Navigation.goBack(); }, 600);
  },

  // 单人聊天公告通知：向第一个对方角色（partner_*）聊天写入 isMailNotice 系统消息
  _pushChatAnnounce(letter) {
    var partners = Storage.getPartnerProfiles() || [];
    if (!partners.length) return;
    var chatId = 'partner_' + partners[0].id;
    var messages = Storage.getMessages(chatId);
    if (!Array.isArray(messages)) messages = [];
    var announceText = '时空信箱：我寄出了一封新信《' + (letter.content || '').slice(0, 30) + '...》，快去看看吧';
    var msg = {
      id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      type: 'system',
      isMailNotice: true,
      text: announceText,
      fromId: 'system',
      time: Date.now()
    };
    messages.push(msg);
    Storage.setMessages(chatId, messages);
    if (typeof updateLastMsg === 'function') {
      updateLastMsg(chatId, announceText);
    }
    if (typeof _safeRenderChat === 'function') {
      _safeRenderChat(chatId);
    }
    if (window.Navigation && typeof Navigation._renderChatList === 'function') {
      try { Navigation._renderChatList(); } catch (e) {}
    }
  },

  /* ---------- 回信 ---------- */
  openReplyLetter(letterId) {
    var data = this._load();
    var letter = null;
    data.letters.forEach(function (l) { if (l.id === letterId) letter = l; });
    if (!letter) {
      Core.toast('信件不存在');
      return;
    }
    window._mailboxReplyTarget = letterId;
    var container = document.getElementById('reply-editor-container');
    if (!container) return;
    container.innerHTML = '<div class="reply-editor">'
      + '<div class="reply-target-note">'
      + '<div class="reply-target-title"><i class="fas fa-envelope"></i> 回复 TA 的来信</div>'
      + '<div class="reply-target-text">' + Core.escapeHtml(letter.content) + '</div>'
      + '</div>'
      + '<div class="letter-editor-note"><textarea id="reply-content" placeholder="写下你的回信..."></textarea></div>'
      + '<button class="letter-send-btn" onclick="sendReply()"><i class="fas fa-paper-plane"></i> 寄出回信</button>'
      + '</div>';
    Navigation.navigateTo('mailbox-reply');
  },

  sendReply() {
    var textarea = document.getElementById('reply-content');
    if (!textarea || !textarea.value.trim()) {
      Core.toast('请先写下回信内容');
      return;
    }
    var letterId = window._mailboxReplyTarget;
    var data = this._load();
    var letter = null;
    data.letters.forEach(function (l) { if (l.id === letterId) letter = l; });
    if (!letter) {
      Core.toast('信件不存在');
      return;
    }
    letter.status = 'replied';
    letter.replyTime = Date.now();
    letter.replyContent = textarea.value.trim();
    this._save(data);
    Core.toast('回信已寄出');
    setTimeout(function () {
      Navigation.goBack();
      MailboxApp.renderMailbox();
    }, 600);
  },

  /* ---------- 删除信件（寄出的信 / 收到的信通用） ---------- */
  confirmDeleteLetter(letterId, fromDetail) {
    var self = this;
    Core.confirm('删除信件', '确定删除这封信吗？删除后无法恢复。', function () {
      self.deleteLetter(letterId, !!fromDetail);
    });
  },

  deleteLetter(letterId, fromDetail) {
    var data = this._load();
    var before = data.letters.length;
    data.letters = data.letters.filter(function (l) { return l.id !== letterId; });
    if (data.letters.length === before) {
      Core.toast('信件不存在或已被删除');
      return;
    }
    this._save(data);
    Core.toast('信件已删除');
    if (fromDetail) {
      // 详情页删除：返回信箱首页并刷新列表
      Navigation.goBack();
      setTimeout(function () { MailboxApp.renderMailbox(); }, 80);
    } else {
      this.renderMailbox();
    }
  },

  /* ---------- 回信设置 ---------- */
  renderMailboxSettings() {
    var container = document.getElementById('mailbox-settings-body');
    if (!container) return;
    var s = this.getSettings();
    var incomingParts = this._mailboxSplit(s.incomingIntervalSec);
    var replyParts = this._mailboxSplit(s.replyDelaySec);
    container.innerHTML = '<div class="letter-settings-body">'

      + '<div class="letter-settings-card">'
      + this._inputRow('fa-envelope-open-text', '对方主动写信时间', 'TA 每隔多久主动寄来一封信', 'mb-incoming', incomingParts.num, incomingParts.unit)
      + this._inputRow('fa-reply', '对方回信时间', '寄出信后，TA 多久回复（超时即自动回信）', 'mb-reply', replyParts.num, replyParts.unit)
      + this._cardCountRow('fa-quote-left', '写信用几句字卡', '对方来信与回信中附上的主字卡句数', 'mb-cardcount', s.cardCount)
      + '</div>'

      + '<div class="letter-settings-note"><i class="fas fa-info-circle"></i> 设置保存后立即生效，下一封信与下一次回信按新时间规则送达。</div>'
      + '</div>';
  },

  // 数字输入 + 单位选择行（参照聊天「主动发送间隔」输入方式）
  _inputRow(icon, label, desc, prefix, num, unit) {
    return '<div class="letter-settings-row">'
      + '<div class="letter-settings-icon"><i class="fas ' + icon + '"></i></div>'
      + '<div class="letter-settings-info"><div class="letter-settings-label">' + label + '</div><div class="letter-settings-desc">' + desc + '</div></div>'
      + '<div class="pace-input-wrap">'
      + '<input type="number" id="' + prefix + '-num" min="1" max="99999" inputmode="numeric" value="' + num + '" onchange="MailboxApp.updateMailboxInput(\'' + prefix + '\')">'
      + '<select id="' + prefix + '-unit" class="pace-unit-select" onchange="MailboxApp.updateMailboxInput(\'' + prefix + '\')">'
      + '<option value="1"' + (unit === 1 ? ' selected' : '') + '>秒</option>'
      + '<option value="60"' + (unit === 60 ? ' selected' : '') + '>分钟</option>'
      + '<option value="3600"' + (unit === 3600 ? ' selected' : '') + '>小时</option>'
      + '</select>'
      + '</div>'
      + '</div>';
  },

  // 字卡句数：纯数字输入（无单位），保存立即生效
  _cardCountRow(icon, label, desc, prefix, value) {
    return '<div class="letter-settings-row">'
      + '<div class="letter-settings-icon"><i class="fas ' + icon + '"></i></div>'
      + '<div class="letter-settings-info"><div class="letter-settings-label">' + label + '</div><div class="letter-settings-desc">' + desc + '</div></div>'
      + '<div class="pace-input-wrap">'
      + '<input type="number" id="' + prefix + '-num" min="1" max="99" inputmode="numeric" value="' + value + '" onchange="MailboxApp.updateMailboxCardCount(\'' + prefix + '\')">'
      + '<span class="letter-cardcount-suffix">句</span>'
      + '</div>'
      + '</div>';
  },

  // 读取字卡句数并保存，非法输入回退显示当前值
  updateMailboxCardCount(prefix) {
    var numEl = document.getElementById(prefix + '-num');
    if (!numEl) return;
    var num = parseInt(numEl.value, 10);
    if (!num || isNaN(num) || num < 1) {
      Core.toast('请输入不小于 1 的数字');
      numEl.value = this.getSettings().cardCount;
      return;
    }
    var s = this.getSettings();
    s.cardCount = Math.max(1, num);
    this.saveSettings(s);
    Core.toast('回信设置已保存');
  },

  // 从数字输入 + 单位选择读取并保存（单位：秒）
  updateMailboxInput(prefix) {
    var numEl = document.getElementById(prefix + '-num');
    var unitEl = document.getElementById(prefix + '-unit');
    if (!numEl || !unitEl) return;
    var num = parseInt(numEl.value, 10);
    var unit = parseInt(unitEl.value, 10) || 1;
    if (!num || isNaN(num) || num < 1) {
      Core.toast('请输入不小于 1 的数字');
      var s0 = this.getSettings();
      var key0 = prefix === 'mb-incoming' ? 'incomingIntervalSec' : 'replyDelaySec';
      var parts0 = this._mailboxSplit(s0[key0]);
      numEl.value = parts0.num;
      unitEl.value = String(parts0.unit);
      return;
    }
    var key = prefix === 'mb-incoming' ? 'incomingIntervalSec' : 'replyDelaySec';
    var s = this.getSettings();
    s[key] = Math.max(1, num * unit);
    this.saveSettings(s);
    // 修改「对方主动写信时间」后重置来信调度时间戳为 0，让新间隔立即生效；
    // 否则持久化的旧未来时间戳（如 24h 后）会继续阻塞 while(nextIncomingTime<=now)，导致新间隔不生效。
    // 仅重置来信调度；回信调度按每封信的 sendTime 独立判断，不受影响。
    if (prefix === 'mb-incoming') {
      var data = this._load();
      data.nextIncomingTime = 0;
      this._save(data);
    }
    Core.toast('回信设置已保存');
  },

  // 辅助：秒 → 输入框数值与单位（优先按最大可整除单位展示）
  _mailboxSplit(sec) {
    sec = Math.max(1, Math.round(sec));
    if (sec % 3600 === 0) return { num: sec / 3600, unit: 3600 };
    if (sec % 60 === 0) return { num: sec / 60, unit: 60 };
    return { num: sec, unit: 1 };
  }
};

window.MailboxApp = MailboxApp;
window.renderMailbox = function () { MailboxApp.renderMailbox(); };
window.switchMailboxTab = function (tab) { MailboxApp.switchMailboxTab(tab); };
window.openWriteLetter = function () { MailboxApp.openWriteLetter(); };
window.sendLetter = function () { MailboxApp.sendLetter(); };
window.openReplyLetter = function (id) { MailboxApp.openReplyLetter(id); };
window.sendReply = function () { MailboxApp.sendReply(); };
window.openMailboxDetail = function (id) { MailboxApp.openMailboxDetail(id); };
window.renderMailboxSettings = function () { MailboxApp.renderMailboxSettings(); };
window.updateMailboxInput = function (prefix) { MailboxApp.updateMailboxInput(prefix); };
window.updateMailboxCardCount = function (prefix) { MailboxApp.updateMailboxCardCount(prefix); };

// 兜底启动：若 app.js 的启动分支因脚本加载顺序等原因未执行，此处自行启动全局调度。
// startScheduler 内部有 _mailboxTimer 防重，重复调用无副作用（幂等）。
if (window.MailboxApp && typeof MailboxApp.startScheduler === 'function') {
  MailboxApp.startScheduler();
}
