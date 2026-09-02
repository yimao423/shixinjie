/* ==== partner-freewill.js ==== */
/* ===== 拾心界 - 对方自主行为驱动器（PartnerFreeWill） =====
 * 让「他的收藏」与「朋友圈对方动态」脱离"跟随我方收藏动作 / 每次点进页面自动发一条"，
 * 改为由时间流逝自然驱动：惰性追赶（catch-up）模型，行为是否发生只看已流逝时间，与何时打开页面无关。
 *
 * - 每个行为独立维护 key（存 localStorage 镜像 + IndexedDB 权威）：partnerFree_<行为>_last_time / _next_time
 * - 下次时间 = 上次时间 + 随机间隔（默认节奏：他的收藏 45~90 分钟一条、朋友圈 35~60 分钟一条）
 * - checkAndAct()：到期则在距今周期内最多补 1~2 条（避免长时间未开站点后一次性补爆），并滚动推进 next_time
 * - 触发点只负责"让时间被检查"：start() 每 10 分钟定时；进入朋友圈页/发现页/聊天页时各自调一次（幂等，未到期不产生任何新内容）
 */

const PartnerFreeWill = {
  /* 行为节奏配置（分钟）：随机间隔下限/上限 + 惰性追赶补发上限 */
  _config: {
    hisFavorite: { min: 45, max: 90, catchUpMax: 2 },
    moments:     { min: 35, max: 60, catchUpMax: 2 }
  },
  _checkIntervalMs: 10 * 60 * 1000,   // 全局定时检查周期（10 分钟）
  _lastSayAt: 0,                      // 聊天留言冷却，避免补发集中时刷屏

  _randMs(min, max) {
    return Math.floor((min + (max - min) * Math.random()) * 60000);
  },
  _lastKey(name) { return 'partnerFree_' + name + '_last_time'; },
  _nextKey(name) { return 'partnerFree_' + name + '_next_time'; },

  /* 读取当前聊天 id（无有效聊天静默返回 null） */
  _currentChatId() {
    try {
      if (typeof _currentChatId === 'function') { var c = _currentChatId(); if (c) return String(c); }
    } catch (e) {}
    try {
      var el = document.getElementById('page-chat-room');
      if (el && el.dataset && el.dataset.chatId) return String(el.dataset.chatId);
    } catch (e) {}
    return null;
  },

  /* ---- 惰性追赶核心：行为是否发生只看已流逝时间，与何时进页面无关 ---- */
  _checkBehavior(name, actFn) {
    var cfg = this._config[name];
    if (!cfg) return 0;
    var now = Date.now();
    var lastKey = this._lastKey(name);
    var nextKey = this._nextKey(name);
    var last = Storage.get(lastKey, 0) || 0;
    var next = Storage.get(nextKey, 0) || 0;
    // 首次运行（尚无 next_time）：只初始化"未来某刻"，不产生任何内容（幂等，进页面不强制）
    if (!next) {
      next = now + this._randMs(cfg.min, cfg.max);
      Storage.set(lastKey, now);
      Storage.set(nextKey, next);
      return 0;
    }
    if (now < next) return 0; // 未到期：静默（进入页面只检查不强制）
    // 到期：按平均间隔折算"该发生几次"，但最多补 catchUpMax 条，避免长时间未开站点后补爆
    var avg = (cfg.min + cfg.max) / 2 * 60000;
    var owed = Math.floor((now - next) / avg) + 1;
    var count = Math.max(1, Math.min(owed, cfg.catchUpMax));
    // 幂等关键：无论本次是否成功产出，判定即消费并滚动推进下次时间，杜绝"进页面反复触发同一批"
    Storage.set(lastKey, now);
    Storage.set(nextKey, now + this._randMs(cfg.min, cfg.max));
    for (var i = 0; i < count; i++) {
      // 补发多条时按 6 秒错开时间戳，保持"陆续自然产生"的观感
      actFn(now - (count - 1 - i) * 6000);
    }
    return count;
  },

  /* 随机取一个对方角色名（无角色时回落「对方」） */
  _randomPartnerName() {
    try {
      var partners = Storage.getPartnerProfiles ? Storage.getPartnerProfiles() : [];
      if (partners && partners.length) {
        var r = partners[Math.floor(Math.random() * partners.length)];
        return (r && (r.nickname || r.name)) || '对方';
      }
    } catch (e) {}
    return '对方';
  },

  /* ---- 他的收藏：从站内可收藏功能类型内容池随机挑选，写入 hisFavorites ---- */
  _pickFavoriteSource() {
    var pool = [];
    // 字卡库（主字卡文本，格言分组不在"收藏"语义内，跳过）
    try {
      var cards = Storage.getCards ? Storage.getCards() : [];
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c && c.text && String(c.text).trim() && (!c.category || c.category !== '格言')) {
          pool.push({ category: 'text', label: '文本', text: String(c.text).trim() });
        }
      }
    } catch (e) {}
    // 拍一拍库（模板含「我方/对方」占位符，替换为真实昵称更自然）
    try {
      var pats = Storage.getPats ? Storage.getPats() : [];
      var myName = '我';
      try {
        var me = Storage.getMyProfile ? Storage.getMyProfile() : {};
        myName = (me && me.nickname) || '我';
      } catch (e) {}
      for (var j = 0; j < pats.length; j++) {
        var p = pats[j];
        if (p && p.text && String(p.text).trim()) {
          var patText = String(p.text)
            .replace(/"我方"/g, myName)
            .replace(/"对方"/g, this._randomPartnerName());
          pool.push({ category: 'pat', label: '拍一拍', text: patText });
        }
      }
    } catch (e) {}
    // 兜底语料：字卡/拍一拍为空时也能产生，避免内容池为空而静默
    if (!pool.length) {
      var FALLBACK = [
        '今天的风很轻，正好想起你～',
        '把这一刻收进心里，谁也不给',
        '喜欢不需要理由，收藏也一样',
        '路过了好多风景，最想存下你',
        '这一句，我先替你留着了'
      ];
      var fb = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      pool.push({ category: 'text', label: '文本', text: fb });
    }
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /* 对方自主收藏一条；可选低频（35%）在当前聊天中留言一条 */
  _actHisFavorite(ts) {
    try {
      if (typeof Storage === 'undefined' || !Storage.getHisFavorites) return;
      var src = this._pickFavoriteSource();
      var from = '对方';
      // 取当前对方角色名作为收藏来源，更自然
      try {
        var partners = Storage.getPartnerProfiles ? Storage.getPartnerProfiles() : [];
        if (partners && partners.length) {
          var r = partners[Math.floor(Math.random() * partners.length)];
          from = (r && (r.nickname || r.name)) || '对方';
        }
      } catch (e) {}
      var fav = {
        id: 'pf' + ts + Math.floor(Math.random() * 100),
        category: src.category,
        label: src.label,
        text: src.text,
        from: from,
        time: ts,
        isPartnerFree: true
      };
      // 与已有条目去重（同分类+同文本视为重复，避免追赶补发时堆满重复内容）
      var hisFavs = Storage.getHisFavorites();
      for (var i = 0; i < hisFavs.length; i++) {
        if (String(hisFavs[i].category) === src.category && String(hisFavs[i].text) === src.text) return;
      }
      hisFavs.unshift(fav);
      Storage.setHisFavorites(hisFavs);
      // 低频留言一条（走 _partnerSay 范式，无有效聊天静默跳过）
      if (Math.random() < 0.35) {
        var brief = String(src.text).length > 12 ? String(src.text).slice(0, 12) + '…' : String(src.text);
        this._partnerSay('我悄悄收藏了一条：' + brief);
      }
    } catch (e) {
      console.error('[PartnerFreeWill] 自主收藏失败', e);
    }
  },

  /* 对方自主发朋友圈：复用 MomentsApp.autoPostByRole（与工具栏手动按钮同一入口） */
  _actMoments(ts) {
    try {
      if (window.MomentsApp && typeof MomentsApp.autoPostByRole === 'function') {
        MomentsApp.autoPostByRole();
      }
    } catch (e) {
      console.error('[PartnerFreeWill] 自主发朋友圈失败', e);
    }
  },

  /* 聊天留言注入（范式参照 listen-together.js 的 _partnerSay：经 Storage.getMessages/setMessages
     落库 + _safeAppendMessage 追加 + updateLastMsg；无有效 chatId 时静默跳过） */
  _partnerSay(text) {
    var cid = this._currentChatId();
    if (!cid) return;
    var now = Date.now();
    if (now - this._lastSayAt < 15000) return; // 留言冷却，避免集中补发时刷屏
    this._lastSayAt = now;
    try {
      var msgs = Storage.getMessages(cid) || [];
      var newMsg = {
        id: Date.now() + Math.floor(Math.random() * 100),
        type: 'other',
        text: text,
        time: Date.now(),
        msgType: 'text'
      };
      msgs.push(newMsg);
      Storage.setMessages(cid, msgs);
      if (typeof updateLastMsg === 'function') updateLastMsg(cid, text);
      if (typeof _safeAppendMessage === 'function') _safeAppendMessage(cid, newMsg);
      else if (typeof appendMessage === 'function') appendMessage(cid, newMsg);
      if (typeof App !== 'undefined' && App.playSound) { try { App.playSound('receive'); } catch (e) {} }
    } catch (e) {}
  },

  /* 统一入口：检查所有行为是否到期（幂等，未到期不产生任何新内容） */
  checkAndAct() {
    if (typeof Storage === 'undefined') return 0;
    var total = 0;
    total += this._checkBehavior('hisFavorite', function(ts) { PartnerFreeWill._actHisFavorite(ts); });
    total += this._checkBehavior('moments', function(ts) { PartnerFreeWill._actMoments(ts); });
    return total;
  },

  /* 启动定时：应用初始化后每 10 分钟检查一次；回到前台时补检一次（均幂等） */
  start() {
    if (this._started) return;
    this._started = true;
    try { this.checkAndAct(); } catch (e) {}
    setInterval(function() {
      try { PartnerFreeWill.checkAndAct(); } catch (e) {}
    }, this._checkIntervalMs);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden) { try { PartnerFreeWill.checkAndAct(); } catch (e) {} }
      });
    }
  },

  /* 调试辅助：查看各行为时间 key 状态（验证时间机制数据 key 的正常维护） */
  peek() {
    var out = {};
    for (var name in this._config) {
      if (Object.prototype.hasOwnProperty.call(this._config, name)) {
        out[name] = {
          last: Storage.get(this._lastKey(name), 0) || 0,
          next: Storage.get(this._nextKey(name), 0) || 0,
          now: Date.now()
        };
      }
    }
    return out;
  }
};

window.PartnerFreeWill = PartnerFreeWill;
window.PartnerFreeAct = PartnerFreeWill;
