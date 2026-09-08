/* ============================================================
   拾心界 · 一起记账（search/account.js）
   —— 加号菜单新功能：记账
   功能包含：
     ① 记一笔：收入 / 支出 + 金额 + 分类 + 备注 + 日期
     ② 流水：按日期分组展示，支持删除
     ③ 统计：本月支出 / 收入概览 + 分类占比
   数据本地持久化（localStorage）。
   记完一笔后，以聊天消息形式让「对方角色」随机点评该笔账单，
   机制参考 js/listen-together.js 的 _partnerSay 函数。

   依赖（站点现有接口）：
     _currentChatId / Storage.getMessages / Storage.setMessages /
     updateLastMsg / _safeAppendMessage / appendMessage / App.playSound / showBackgroundPush
   ============================================================ */

(function () {
  'use strict';

  var ACC = {
    KEY: 'shixin_acc_records_v1',
    records: [],
    type: 'exp',      // 'exp' | 'inc'
    cat: 'food',      // 当前选中分类 id
    view: 'add'       // 'add' | 'list' | 'stats'
  };

  /* ---------- 分类预设 ---------- */
  var CATS = {
    exp: [
      { id: 'food',  name: '餐饮', icon: 'fa-utensils' },
      { id: 'traffic', name: '交通', icon: 'fa-bus' },
      { id: 'shopping', name: '购物', icon: 'fa-cart-shopping' },
      { id: 'entertain', name: '娱乐', icon: 'fa-gamepad' },
      { id: 'medical', name: '医疗', icon: 'fa-heart-pulse' },
      { id: 'daily', name: '日用', icon: 'fa-basket-shopping' },
      { id: 'housing', name: '住房', icon: 'fa-house' },
      { id: 'comm', name: '通讯', icon: 'fa-mobile-screen' },
      { id: 'edu', name: '教育', icon: 'fa-graduation-cap' },
      { id: 'other', name: '其他', icon: 'fa-ellipsis' }
    ],
    inc: [
      { id: 'salary', name: '工资', icon: 'fa-sack-dollar' },
      { id: 'manage', name: '理财', icon: 'fa-chart-line' },
      { id: 'redpacket', name: '红包', icon: 'fa-gift' },
      { id: 'bonus', name: '奖金', icon: 'fa-trophy' },
      { id: 'other', name: '其他', icon: 'fa-coins' }
    ]
  };

  /* ---------- 通用工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function catInfo(type, cat) {
    var list = CATS[type] || [];
    for (var i = 0; i < list.length; i++) { if (list[i].id === cat) return list[i]; }
    return list[list.length - 1] || { id: 'other', name: '其他', icon: 'fa-ellipsis' };
  }
  function fmtMoney(n) {
    n = Number(n) || 0;
    return n.toFixed(2);
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function monthOf(dateStr) { return dateStr ? dateStr.slice(0, 7) : ''; }
  function curMonth() { return todayStr().slice(0, 7); }
  function weekLabel(dateStr) {
    if (!dateStr) return '';
    var p = dateStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    var today = todayStr();
    if (dateStr === today) return '今天';
    var y = new Date(); y.setDate(y.getDate() - 1);
    var ystr = y.getFullYear() + '-' + pad2(y.getMonth() + 1) + '-' + pad2(y.getDate());
    if (dateStr === ystr) return '昨天';
    return w;
  }

  /* ---------- 数据持久化 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(ACC.KEY);
      ACC.records = raw ? (JSON.parse(raw) || []) : [];
    } catch (e) { ACC.records = []; }
  }
  function save() {
    try { localStorage.setItem(ACC.KEY, JSON.stringify(ACC.records)); } catch (e) {}
  }

  /* ---------- 对外入口 ---------- */
  window.openAccountPanel = function () {
    var ov = $('account-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    if (typeof closePlusMenu === 'function') closePlusMenu();
    load();
    accSwitchTab('add');
    // 默认清空表单、选支出-餐饮
    ACC.type = 'exp'; ACC.cat = 'food';
    var amt = $('acc-amount');
    if (amt) amt.value = '';
    var note = $('acc-note');
    if (note) note.value = '';
    var dt = $('acc-date');
    if (dt) dt.value = todayStr();
    accRenderTypeToggle();
    accRenderCats();
    accRenderSummary();
    accRenderList();
    accRenderStats();
  };

  window.closeAccountPanel = function () {
    var ov = $('account-overlay');
    if (ov) ov.style.display = 'none';
  };

  /* ---------- Tab 切换 ---------- */
  window.accSwitchTab = function (tab) {
    ACC.view = tab;
    ['add', 'list', 'stats'].forEach(function (t) {
      var btn = $('acc-tab-' + t);
      if (btn) btn.classList.toggle('active', t === tab);
      var v = $('acc-view-' + t);
      if (v) v.classList.toggle('active', t === tab);
    });
    if (tab === 'add') { accRenderSummary(); accRenderCats(); }
    else if (tab === 'list') accRenderList();
    else if (tab === 'stats') accRenderStats();
  };

  /* ---------- 记一笔 ---------- */
  window.accSwitchType = function (type) {
    ACC.type = type;
    ACC.cat = (CATS[type] && CATS[type][0]) ? CATS[type][0].id : 'other';
    accRenderTypeToggle();
    accRenderCats();
  };

  window.accSelectCat = function (cat) { ACC.cat = cat; accRenderCats(); };

  function accRenderTypeToggle() {
    var t = ACC.type === 'exp' ? '支出' : '收入';
    var btnExp = $('acc-type-exp'), btnInc = $('acc-type-inc');
    if (btnExp) btnExp.classList.toggle('active', ACC.type === 'exp');
    if (btnInc) btnInc.classList.toggle('active', ACC.type === 'inc');
    var amtLabel = $('acc-rmb-sign');
    if (amtLabel) amtLabel.textContent = t;
    var saveBtn = $('acc-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-' + (ACC.type === 'exp' ? 'pen' : 'coins') + '"></i> 记下这笔' + t;
    }
    accRenderCats();
  }

  function accRenderCats() {
    var grid = $('acc-cat-grid');
    if (!grid) return;
    var list = CATS[ACC.type] || [];
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      html += '<div class="acc-cat-item' + (c.id === ACC.cat ? ' active' : '') + '" onclick="accSelectCat(\'' + c.id + '\')">' +
        '<div class="acc-cat-icon"><i class="fas ' + c.icon + '"></i></div>' +
        '<div class="acc-cat-name">' + esc(c.name) + '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
  }

  window.accSave = function () {
    var amtEl = $('acc-amount');
    var raw = amtEl ? amtEl.value : '';
    var amount = parseFloat(raw);
    if (!isFinite(amount) || amount <= 0) { amtEl && amtEl.focus(); amtEl && (amtEl.style.borderColor = 'var(--primary-dark)'); return; }
    var noteEl = $('acc-note');
    var dateEl = $('acc-date');
    var note = (noteEl ? noteEl.value : '').trim();
    var date = (dateEl && dateEl.value) ? dateEl.value : todayStr();
    var rec = {
      id: Date.now() + Math.floor(Math.random() * 100),
      type: ACC.type,
      amount: Math.round(amount * 100) / 100,
      cat: ACC.cat,
      note: note,
      date: date,
      time: Date.now()
    };
    ACC.records.push(rec);
    save();
    // 对方角色点评该笔账单
    accPartnerComment(rec);
    // 清空金额与备注，聚焦金额
    if (amtEl) amtEl.value = '';
    if (noteEl) noteEl.value = '';
    var dt = $('acc-date');
    if (dt) dt.value = todayStr();
    accRenderSummary();
    if (amtEl) amtEl.focus();
  };

  /* ---------- 对方角色点评账单 ---------- */
  var COMMENT_EXP_LARGE = [
    '哇，这单 %AMT% 有点狠呀，大手大脚的你～记账都记着呢！',
    '今天这 %AMT% 块钱，花得倒是爽快，某人要喝西北风啦！',
    '%AMT% 就这么出去了？败家子本王，不过……我喜欢你的阔气～',
    '这 %AMT% 花得值不值，你心里没点数嘛，反正我记你账上了！',
  ];
  var COMMENT_EXP_MID = [
    '这一单 %AMT% 花得还行，可以接受，继续保持～',
    '%AMT% 呀，说多不多说少不少，开心就好！',
    '这笔 %AMT% 我会好好给你把关的，别乱花钱哦～',
    '嗯，%AMT% 花得挺合理，这次就不说你了！',
  ];
  var COMMENT_EXP_SMALL = [
    '才 %AMT% 块，省到就是赚到，真有你的！',
    '这么点钱都要记账，会过日子第一名～',
    '%AMT% 这种小钱也精打细算，我爱了！',
    '勤俭持家小能手，%AMT% 花得真漂亮～',
  ];
  var COMMENT_INC_LARGE = [
    '进账 %AMT% ！恭喜发财，记得请我吃顿好的～',
    '%AMT% 到账，钱生钱的大佬就是你！',
    '啦～收到 %AMT% 进账，靠谱！',
    '这 %AMT% 真香，爱赚钱的可人儿最迷人～',
  ];
  var COMMENT_INC_SMALL = [
    '有小钱钱进账啦，%AMT% 也是肉～',
    '%AMT% 到手，积少成多，稳！',
    '赚到 %AMT% 啦，离咱们的小目标又近一步～',
    '收下这 %AMT% ，好日子在后头呢～',
  ];
  var COMMENT_FOOD = ['又去觅食了，下次记得带我这个吃货～', '吃的钱不能省，不过少吃点外卖呀～'];
  var COMMENT_SHOPPING = ['剁手警告！购物车是不是又清空了一波～', '买买买可还行，这东西值这个价嘛～'];
  var COMMENT_MEDICAL = ['要注意身体呀，健康最重要～', '身体是革命的本钱，照顾好自己～'];
  var COMMENT_SALARY = ['工资到账！本月的小金库又充实啦～', '发工资了呢，请客请客～'];
  var COMMENT_MANAGE = ['会理财！钱放在你手里我放心～', '理财有道，越来越有钱途～'];

  function moneyLabel(amount) {
    return (ACC.type === 'exp' ? '' : '+') + '¥' + fmtMoney(amount);
  }

  function accPickComment(rec) {
    var amt = rec.amount;
    var pool, catPool = null;
    if (rec.type === 'exp') {
      if (amt >= 500) pool = COMMENT_EXP_LARGE;
      else if (amt >= 100) pool = COMMENT_EXP_MID;
      else pool = COMMENT_EXP_SMALL;
      if (rec.cat === 'food') catPool = COMMENT_FOOD;
      else if (rec.cat === 'shopping') catPool = COMMENT_SHOPPING;
      else if (rec.cat === 'medical') catPool = COMMENT_MEDICAL;
    } else {
      if (amt >= 300) pool = COMMENT_INC_LARGE;
      else pool = COMMENT_INC_SMALL;
      if (rec.cat === 'salary') catPool = COMMENT_SALARY;
      else if (rec.cat === 'manage') catPool = COMMENT_MANAGE;
    }
    var txt;
    if (catPool && Math.random() < 0.7) txt = pick(catPool);
    else txt = pick(pool);
    var catN = catInfo(rec.type, rec.cat);
    txt = txt.replace(/%AMT%/g, moneyLabel(amt));
    var catLine = '（' + (rec.type === 'exp' ? '支出' : '收入') + ' · ' + catN.name + '）';
    return txt.replace(/%CAT%/g, catLine);
  }

  function accPartnerComment(rec) {
    var chatId;
    try { chatId = (typeof _currentChatId === 'function') ? String(_currentChatId()) : null; }
    catch (e) { chatId = null; }
    if (!chatId) return;
    try {
      var text = accPickComment(rec);
      var msgs = Storage.getMessages(chatId) || [];
      var newMsg = {
        id: Date.now() + Math.floor(Math.random() * 100),
        type: 'other',
        text: text,
        time: Date.now(),
        msgType: 'text'
      };
      msgs.push(newMsg);
      Storage.setMessages(chatId, msgs);
      if (typeof updateLastMsg === 'function') updateLastMsg(chatId, text);
      if (typeof _safeAppendMessage === 'function') _safeAppendMessage(chatId, newMsg);
      else if (typeof appendMessage === 'function') appendMessage(chatId, newMsg);
      if (typeof App !== 'undefined' && App.playSound) { try { App.playSound('receive'); } catch (e2) {} }
      if (typeof showBackgroundPush === 'function') { try { showBackgroundPush(text); } catch (e3) {} }
    } catch (e) { /* 点评失败不影响记账 */ }
  }

  /* ---------- 概览（本月支出 / 收入） ---------- */
  function accRenderSummary() {
    var expEl = $('acc-sum-exp'), incEl = $('acc-sum-inc');
    if (!expEl && !incEl) return;
    var cm = curMonth();
    var exp = 0, inc = 0;
    for (var i = 0; i < ACC.records.length; i++) {
      if (monthOf(ACC.records[i].date) !== cm) continue;
      if (ACC.records[i].type === 'exp') exp += ACC.records[i].amount;
      else inc += ACC.records[i].amount;
    }
    if (expEl) {
      expEl.innerHTML = fmtMoney(exp);
      var expDay = exp > 0 ? Math.round(exp * 100) / 100 : 0;
      expEl.nextElementSibling && (expEl.nextElementSibling.textContent = '本月支出 ' + fmtMoney(expDay));
    }
    if (incEl) {
      incEl.innerHTML = fmtMoney(inc);
      incEl.nextElementSibling && (incEl.nextElementSibling.textContent = '本月收入 ' + fmtMoney(inc));
    }
  }

  /* ---------- 流水列表（按日期分组） ---------- */
  function accRenderList() {
    var box = $('acc-view-list');
    if (!box) return;
    var recs = ACC.records.slice().sort(function (a, b) { return b.time - a.time; });
    if (!recs.length) {
      box.innerHTML = '<div class="acc-empty"><i class="fas fa-receipt"></i>还没有账单，先去记一笔吧～</div>';
      return;
    }
    // 按日期分组
    var groups = {};
    var order = [];
    for (var i = 0; i < recs.length; i++) {
      var d = recs[i].date || todayStr();
      if (!groups[d]) { groups[d] = []; order.push(d); }
      groups[d].push(recs[i]);
    }
    var html = '';
    for (var g = 0; g < order.length; g++) {
      var day = order[g];
      var dayRecs = groups[day];
      var dayExp = 0, dayInc = 0;
      for (var j = 0; j < dayRecs.length; j++) {
        if (dayRecs[j].type === 'exp') dayExp += dayRecs[j].amount;
        else dayInc += dayRecs[j].amount;
      }
      var totalParts = [];
      if (dayExp > 0) totalParts.push('支出 ¥' + fmtMoney(dayExp));
      if (dayInc > 0) totalParts.push('收入 ¥' + fmtMoney(dayInc));
      html += '<div class="acc-day-group">' +
        '<div class="acc-day-head">' +
        '<span class="acc-day-label">' + esc(day) + ' ' + esc(weekLabel(day)) + '</span>' +
        '<span class="acc-day-total">' + esc(totalParts.join('　')) + '</span>' +
        '</div>';
      for (var k = 0; k < dayRecs.length; k++) {
        var r = dayRecs[k];
        var ci = catInfo(r.type, r.cat);
        var amtClass = r.type === 'exp' ? 'exp' : 'inc';
        var amtText = (r.type === 'exp' ? '-¥' : '+¥') + fmtMoney(r.amount);
        html += '<div class="acc-item">' +
          '<div class="acc-item-icon"><i class="fas ' + ci.icon + '"></i></div>' +
          '<div class="acc-item-info">' +
          '<div class="acc-item-cat">' + esc(ci.name) + (r.note ? '　<span style="font-weight:400;color:var(--text-light)">' + esc(r.note) + '</span>' : '') + '</div>' +
          '<div class="acc-item-note"></div>' +
          '</div>' +
          '<div class="acc-item-amt ' + amtClass + '">' + amtText + '</div>' +
          '<button class="acc-item-del" onclick="accDeleteRecord(' + r.id + ')" title="删除"><i class="fas fa-trash-can"></i></button>' +
          '</div>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
  }

  window.accDeleteRecord = function (id) {
    var arr = [];
    for (var i = 0; i < ACC.records.length; i++) {
      if (String(ACC.records[i].id) !== String(id)) arr.push(ACC.records[i]);
    }
    if (arr.length === ACC.records.length) return;
    ACC.records = arr;
    save();
    accRenderList();
    accRenderSummary();
    accRenderStats();
  };

  /* ---------- 统计 ---------- */
  function accRenderStats() {
    var box = $('acc-view-stats');
    if (!box) return;
    var cm = curMonth();
    var exp = {}, inc = {}, expTotal = 0, incTotal = 0;
    var has = false;
    for (var i = 0; i < ACC.records.length; i++) {
      var r = ACC.records[i];
      if (monthOf(r.date) !== cm) continue;
      has = true;
      if (r.type === 'exp') { exp[r.cat] = (exp[r.cat] || 0) + r.amount; expTotal += r.amount; }
      else { inc[r.cat] = (inc[r.cat] || 0) + r.amount; incTotal += r.amount; }
    }
    var statExp = $('acc-stat-exp'), statInc = $('acc-stat-inc'), statBal = $('acc-stat-bal');
    if (statExp) statExp.textContent = '¥' + fmtMoney(expTotal);
    if (statInc) statInc.textContent = '¥' + fmtMoney(incTotal);
    if (statBal) statBal.textContent = '¥' + fmtMoney(incTotal - expTotal);

    // 统计卡头部（三张卡）
    var head = '<div class="acc-stats-cards">' +
      '<div class="acc-stat-box acc-out"><div class="acc-stat-label">本月支出</div><div class="acc-stat-val" id="acc-stat-exp-mod">¥' + fmtMoney(expTotal) + '</div></div>' +
      '<div class="acc-stat-box acc-in2"><div class="acc-stat-label">本月收入</div><div class="acc-stat-val" id="acc-stat-inc-mod">¥' + fmtMoney(incTotal) + '</div></div>' +
      '<div class="acc-stat-box acc-bal"><div class="acc-stat-label">结余</div><div class="acc-stat-val" id="acc-stat-bal-mod">' + (incTotal - expTotal >= 0 ? '' : '-') + '¥' + fmtMoney(Math.abs(incTotal - expTotal)) + '</div></div>' +
      '</div>';

    if (!has || (expTotal <= 0 && incTotal <= 0)) {
      box.innerHTML = head + '<div class="acc-empty"><i class="fas fa-chart-pie"></i>本月还没记过账，去记一笔吧～</div>';
      return;
    }
    var html = head;
    // 支出分类占比（条形图）
    if (expTotal > 0) {
      var keys = Object.keys(exp).sort(function (a, b) { return exp[b] - exp[a]; });
      html += '<div class="acc-pop-top"><i class="fas fa-fire"></i>本月支出最多的分类是「' + esc(catInfo('exp', keys[0]).name) + '」</div>';
      html += '<div class="acc-pie-title">支出分类占比</div>';
      for (var k = 0; k < keys.length; k++) {
        var cid = keys[k];
        var val = exp[cid];
        var pct = Math.round((val / expTotal) * 100);
        var ci = catInfo('exp', cid);
        html += '<div class="acc-bar-row">' +
          '<div class="acc-bar-info"><i class="fas ' + ci.icon + '"></i>' + esc(ci.name) + '</div>' +
          '<div class="acc-bar-track"><div class="acc-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="acc-bar-pct">' + pct + '%</div>' +
          '</div>';
      }
    }
    // 收入分类占比
    var incKeys = Object.keys(inc);
    if (incTotal > 0 && incKeys.length) {
      var incKeysSorted = incKeys.sort(function (a, b) { return inc[b] - inc[a]; });
      html += '<div class="acc-pie-title" style="margin-top:6px">收入分类占比</div>';
      for (var m = 0; m < incKeysSorted.length; m++) {
        var icid = incKeysSorted[m];
        var ival = inc[icid];
        var ipct = Math.round((ival / incTotal) * 100);
        var ici = catInfo('inc', icid);
        html += '<div class="acc-bar-row">' +
          '<div class="acc-bar-info"><i class="fas ' + ici.icon + '"></i>' + esc(ici.name) + '</div>' +
          '<div class="acc-bar-track"><div class="acc-bar-fill" style="width:' + ipct + '%;background:var(--accent, #D0C8E8)"></div></div>' +
          '<div class="acc-bar-pct">' + ipct + '%</div>' +
          '</div>';
      }
    }
    if (html === head) {
      html += '<div class="acc-empty"><i class="fas fa-chart-pie"></i>本月还没记过账，去记一笔吧～</div>';
    }
    box.innerHTML = html;
  }

})();
