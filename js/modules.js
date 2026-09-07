/* ==== modules.js ==== */
/* ===== 拾心界 - 8大功能模块 ===== */

/* ===================================================
   2. 月经记录 (Period)
   =================================================== */
let periodViewDate = new Date();
let _periodFlow = 1;          // 记录弹窗当前选中流量
let _periodPain = 0;          // 记录弹窗当前选中疼痛强度
let _periodEditDate = '';     // 记录弹窗当前编辑日期
let _periodMarkToday = true;  // 记录弹窗"今天来月经"开关
let _periodConfirmCb = null;    // 记录卡片内嵌确认回调

/* 生理算法：严格按月经生理规则计算 */
const PeriodCalc = {
  // 日期解析（兼容 Date 与 'YYYY-MM-DD' 字符串）
  parse(s) {
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  },
  fmt(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
  },
  addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  },
  diffDays(a, b) {
    const da = a instanceof Date ? new Date(a.getFullYear(), a.getMonth(), a.getDate()) : this.parse(a);
    const db = b instanceof Date ? new Date(b.getFullYear(), b.getMonth(), b.getDate()) : this.parse(b);
    return Math.round((db - da) / 86400000);
  },

  // 周期设置（统一存储持久化，兼容旧 localStorage 键），经期默认 7 天
  getSettings() {
    try {
      const s = Storage.get('periodSettings', null);
      if (s && s.cycleLength) return s;
    } catch (e) {}
    // 兼容旧版直连 localStorage 键（迁移到统一存储）
    try {
      const old = JSON.parse(localStorage.getItem('periodSettings') || 'null');
      if (old && old.cycleLength) {
        Storage.set('periodSettings', old);
        localStorage.removeItem('periodSettings');
        return old;
      }
    } catch (e2) {}
    return { cycleLength: 28, periodLength: 7 };
  },
  saveSettings(s) { Storage.set('periodSettings', s); },

  // 平均周期 = 相邻经期起始日间隔均值
  calcAvgCycle() {
    const records = Storage.getPeriodRecords();
    const starts = records.map(r => this.parse(r.startDate)).sort((a, b) => a - b);
    if (starts.length < 2) return null;
    let sum = 0;
    for (let i = 1; i < starts.length; i++) sum += this.diffDays(starts[i - 1], starts[i]);
    return Math.round(sum / (starts.length - 1));
  },

  // 经期天数 = 最近一次记录 endDate - startDate + 1
  calcPeriodLength() {
    const records = Storage.getPeriodRecords();
    if (!records.length) return null;
    const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return this.diffDays(sorted[0].startDate, sorted[0].endDate) + 1;
  },

  // 预估排卵日 = 最近一次经期结束日 + 9 天
  // 排卵期规则：经期结束后第 4 天为排卵期第 1 天（结束日+4），排卵期共 6 天，第 6 天为排卵日（结束日+4+5 = 结束日+9）
  // 依赖最近一次经期记录（startDate/endDate），无记录时返回 null
  calcOvulationDay() {
    const records = Storage.getPeriodRecords();
    if (!records.length) return null;
    const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const lastEnd = this.parse(sorted[0].endDate);
    return this.addDays(lastEnd, 9);
  },

  // 预估下次月经首日 = 预估排卵日 + 黄体期固定 14 天（排卵日当天过后往后第 14 天）
  // 依赖 calcOvulationDay，无经期记录时返回 null
  predictNextPeriodStart() {
    const ov = this.calcOvulationDay();
    if (!ov) return null;
    return this.addDays(ov, 14);
  },

  // 排卵期 = 经期结束后第 4 天起共 6 天（结束日+4 ~ 结束日+9），第 6 天为排卵日
  calcOvulationWindow() {
    const ov = this.calcOvulationDay();
    if (!ov) return null;
    return { start: this.addDays(ov, -5), end: ov };
  },

  // 预测经期区间 = 预测起始日 + 经期天数
  predictPeriodRange() {
    const next = this.predictNextPeriodStart();
    if (!next) return null;
    const len = this.calcPeriodLength() || this.getSettings().periodLength;
    return { start: next, end: this.addDays(next, len - 1) };
  }
};

function renderPeriod() {
  const cal = document.getElementById('period-calendar');
  if (cal) cal.innerHTML = renderPeriodCalendar(periodViewDate);
  const legend = document.getElementById('period-legend');
  if (legend) legend.innerHTML = renderPeriodLegend();
  const overview = document.getElementById('period-overview');
  if (overview) overview.innerHTML = renderPeriodOverview();
  syncPeriodRecordCard();
}

function syncPeriodRecordCard() {
  // 进行中经期：常驻显示今天记录卡片；否则隐藏
  const card = document.getElementById('period-record-card');
  if (!card) return;
  const todayStr = PeriodCalc.fmt(new Date());
  const records = Storage.getPeriodRecords();
  const active = records.find(r => todayStr >= r.startDate && todayStr <= r.endDate);
  if (active) renderPeriodRecordCard(todayStr);
  else card.style.display = 'none';
}

function renderPeriodOverview() {
  const records = Storage.getPeriodRecords();
  const settings = PeriodCalc.getSettings();

  if (!records.length) {
    return `
      <div class="period-overview-card">
        <div class="period-overview-head">
          <span class="period-overview-title">经期与周期</span>
        </div>
        <div class="period-overview-row">
          <span class="period-overview-row-label">默认周期</span>
          <span class="period-overview-row-value">${settings.cycleLength}<small> 天</small></span>
        </div>
        <div class="period-overview-row">
          <span class="period-overview-row-label">默认经期</span>
          <span class="period-overview-row-value">${settings.periodLength}<small> 天</small></span>
        </div>
        <div class="period-overview-hint">记录 2 次经期后自动推算平均值</div>
      </div>`;
  }

  // 近 6 个月记录统计
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const recent = records.filter(r => PeriodCalc.parse(r.startDate) >= sixMonthsAgo);
  const pool = recent.length >= 2 ? recent : records;

  const starts = pool.map(r => PeriodCalc.parse(r.startDate)).sort((a, b) => a - b);
  let avgCycle = null;
  if (starts.length >= 2) {
    let sum = 0;
    for (let i = 1; i < starts.length; i++) sum += PeriodCalc.diffDays(starts[i - 1], starts[i]);
    avgCycle = Math.round(sum / (starts.length - 1));
  }
  const lens = pool.map(r => PeriodCalc.diffDays(r.startDate, r.endDate) + 1);
  const avgLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null;

  const len = avgLen || settings.periodLength;
  const nextStart = PeriodCalc.predictNextPeriodStart();
  const ovDay = PeriodCalc.calcOvulationDay();

  let nextRow = '';
  if (nextStart) {
    const diff = PeriodCalc.diffDays(now, nextStart);
    nextRow = `<div class="period-overview-row">
      <span class="period-overview-row-label">下次经期</span>
      <span class="period-overview-row-value">${diff > 0 ? diff + ' 天后' : (diff === 0 ? '今天' : '已开始')}</span>
    </div>`;
  }
  let ovRow = '';
  if (ovDay) {
    const ovDiff = PeriodCalc.diffDays(now, ovDay);
    ovRow = `<div class="period-overview-row">
      <span class="period-overview-row-label">排卵日</span>
      <span class="period-overview-row-value">${ovDiff > 0 ? ovDiff + ' 天后' : (ovDiff === 0 ? '今天' : PeriodCalc.fmt(ovDay))}</span>
    </div>`;
  }
  const overviewHint = avgCycle
    ? `基于 ${pool.length} 次记录统计 · 排卵期/预测经期按最近一次经期推算`
    : '基于最近一次经期推算排卵期与预测经期';

  return `
    <div class="period-overview-card">
      <div class="period-overview-head">
        <span class="period-overview-title">经期与周期</span>
      </div>
      ${nextRow}
      ${ovRow}
      <div class="period-overview-row">
        <span class="period-overview-row-label">近 6 个月平均经期</span>
        <span class="period-overview-row-value">${len}<small> 天</small></span>
      </div>
      <div class="period-overview-row">
        <span class="period-overview-row-label">近 6 个月平均周期</span>
        <span class="period-overview-row-value">${avgCycle ? avgCycle + '<small> 天</small>' : '<small>记录中</small>'}</span>
      </div>
      <div class="period-overview-hint">${overviewHint}</div>
    </div>`;
}

function renderPeriodLegend() {
  return `
    <div class="period-legend-title">图例</div>
    <div class="period-legend-items">
      <span class="period-legend-item"><span class="period-legend-dot dot-period"></span>经期</span>
      <span class="period-legend-item"><span class="period-legend-dot dot-predict"></span>预测经期</span>
      <span class="period-legend-item"><span class="period-legend-dot dot-ovulation-day"></span>排卵日</span>
      <span class="period-legend-item"><span class="period-legend-dot dot-ovulation-window"></span>排卵期</span>
      <span class="period-legend-item"><span class="period-legend-dot dot-today"></span>今天</span>
    </div>`;
}

function renderPeriodCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = Core.formatDate(new Date());
  const records = Storage.getPeriodRecords();

  // 已记录经期日期集合 + 每日期流量 / 疼痛（支持按天单独标记，未单独标记的天回退整期默认值）
  const periodDays = new Set();
  const periodFlowMap = {};
  const periodPainMap = {};
  records.forEach(r => {
    let d = PeriodCalc.parse(r.startDate);
    const end = PeriodCalc.parse(r.endDate);
    while (d <= end) {
      const ds = PeriodCalc.fmt(d);
      periodDays.add(ds);
      const day = (r.daily && r.daily[ds]) || {};
      // 仅单独标记过的天显示量/痛程度，未标记的天不回退整期默认值，避免整段统一显示
      if (day.flow != null) periodFlowMap[ds] = day.flow;
      if (day.pain != null) periodPainMap[ds] = day.pain;
      d = PeriodCalc.addDays(d, 1);
    }
  });

  // 预测经期区间
  const predictRange = PeriodCalc.predictPeriodRange();
  const predictDays = new Set();
  if (predictRange) {
    let d = predictRange.start;
    while (d <= predictRange.end) {
      predictDays.add(PeriodCalc.fmt(d));
      d = PeriodCalc.addDays(d, 1);
    }
  }

  // 排卵日 / 排卵期：按每条经期记录分别推算（历史月份同样附带显示）
  // 排卵日 = 经期结束日 + 9；排卵期 = 结束日 + 4 ~ 结束日 + 9 共 6 天（第 6 天为排卵日）
  const ovDayStrSet = new Set();
  const ovWinDays = new Set();
  records.forEach(r => {
    const end = PeriodCalc.parse(r.endDate);
    const ov = PeriodCalc.addDays(end, 9);
    ovDayStrSet.add(PeriodCalc.fmt(ov));
    let d = PeriodCalc.addDays(end, 4);
    while (d <= ov) {
      ovWinDays.add(PeriodCalc.fmt(d));
      d = PeriodCalc.addDays(d, 1);
    }
  });

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  let html = `<div class="period-cal-card">
    <div class="calendar-header">
      <span class="calendar-month">${year}年 ${monthNames[month]}</span>
      <div class="calendar-nav">
        <button onclick="changePeriodMonth(-1)"><i class="fas fa-chevron-left"></i></button>
        <button onclick="changePeriodMonth(1)"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
    <div class="calendar-grid">`;

  dayHeaders.forEach(d => { html += `<div class="calendar-day-header">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    let cls = 'calendar-day';
    if (dateStr === todayStr) cls += ' today';
    // 颜色标记优先级：经期 > 排卵日 > 排卵期 > 预测经期
    if (periodDays.has(dateStr)) cls += ' period-day';
    else if (ovDayStrSet.has(dateStr)) cls += ' ovulation-day';
    else if (ovWinDays.has(dateStr)) cls += ' ovulation-window';
    else if (predictDays.has(dateStr)) cls += ' period-predict';
    let badge = '';
    if (periodDays.has(dateStr)) {
      const flow = Math.max(0, Math.min(3, periodFlowMap[dateStr] || 0));
      const pain = Math.max(0, Math.min(3, periodPainMap[dateStr] || 0));
      let drops = '';
      for (let i = 0; i < flow; i++) drops += '<i class="fas fa-tint"></i>';
      let bolts = '';
      for (let i = 0; i < pain; i++) bolts += '<i class="fas fa-bolt"></i>';
      badge = '';
      if (flow > 0) badge += `<span class="period-drop-badge">${drops}</span>`;
      if (pain > 0) badge += `<span class="period-pain-badge">${bolts}</span>`;
    }
    html += `<div class="${cls}" onclick="recordPeriodDay('${dateStr}')">${d}${badge}</div>`;
  }
  html += '</div></div>';
  return html;
}

function changePeriodMonth(delta) {
  periodViewDate = new Date(periodViewDate.getFullYear(), periodViewDate.getMonth() + delta, 1);
  renderPeriod();
}

function dropOptions() {
  const labels = ['少量', '中量', '大量'];
  let h = '';
  for (let i = 1; i <= 3; i++) {
    h += `<div class="period-drop-opt" data-flow="${i}" onclick="selectPeriodFlow(${i})">
      <span class="period-drop-icon">${'<i class="fas fa-tint"></i>'.repeat(i)}</span>
      <span class="period-drop-text">${labels[i - 1]}</span>
    </div>`;
  }
  return h;
}

function painOptions() {
  const labels = ['无痛', '轻微', '明显', '剧烈'];
  let h = '';
  for (let i = 0; i <= 3; i++) {
    const icons = i === 0 ? '<i class="far fa-circle"></i>' : '<i class="fas fa-bolt"></i>'.repeat(i);
    h += `<div class="period-pain-opt" data-pain="${i}" onclick="selectPeriodPain(${i})">
      <span class="period-pain-icon">${icons}</span>
      <span class="period-pain-text">${labels[i]}</span>
    </div>`;
  }
  return h;
}

function recordPeriodDay(dateStr) {
  renderPeriodRecordCard(dateStr);
}

function renderPeriodRecordCard(dateStr) {
  const card = document.getElementById('period-record-card');
  if (!card) return;
  _periodEditDate = dateStr;
  _periodPain = 0;
  const records = Storage.getPeriodRecords();
  const existing = records.find(r => dateStr >= r.startDate && dateStr <= r.endDate);
  const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const last = sorted[0];

  let html = '';
  if (existing) {
    const dayData = (existing.daily && existing.daily[dateStr]) || {};
    _periodFlow = dayData.flow != null ? dayData.flow : (existing.flow || 1);
    _periodPain = dayData.pain != null ? dayData.pain : (existing.pain || 0);
    const daySymp = dayData.symptoms != null ? dayData.symptoms : (existing.symptoms || '');
    const hasDaily = !!(existing.daily && existing.daily[dateStr]);
    const dayNum = PeriodCalc.diffDays(existing.startDate, dateStr) + 1;
    html = `
      <div class="period-record-panel">
        <div class="period-record-title">经期第 ${dayNum} 天</div>
        <div class="period-record-date">${dateStr} · ${existing.startDate} 开始</div>
        ${dateStr === existing.startDate
          ? `<button class="period-cancel-btn" onclick="cancelPeriodRecord('${dateStr}')"><i class="fas fa-undo-alt"></i> 取消月经标注</button>`
          : `<button class="period-end-btn" onclick="endPeriodNow('${dateStr}')"><i class="fas fa-check-circle"></i> 结束经期（到 ${dateStr} 为止）</button>`}
        <div class="period-form-label">经期量 <span class="period-form-sub">点击水滴选择</span></div>
        <div class="period-drop-row">${dropOptions()}</div>
        <div class="period-form-label">疼痛强度 <span class="period-form-sub">点击闪电选择</span></div>
        <div class="period-pain-row">${painOptions()}</div>
        <div class="period-form-label">记录状态感受</div>
        <input type="text" id="period-feel-input" class="period-form-input" placeholder="如腹胀、腰酸、心情烦躁" maxlength="60" value="${Core.escapeHtml(daySymp)}">
        ${hasDaily
          ? `<div class="period-daily-tip">本日已单独标记，修改只影响 ${dateStr} 这一天</div>
        <button class="period-clear-daily-btn" onclick="clearPeriodDaily('${dateStr}')"><i class="fas fa-eraser"></i> 清除本日标记，恢复整期默认</button>`
          : `<div class="period-daily-tip">当前为整期默认，可单独标记这一天</div>`}
        <div class="period-record-actions">
          <button class="period-btn-cancel" onclick="closePeriodRecordPanel()">取消</button>
          <button class="period-btn-save" onclick="savePeriodRecord()">保存</button>
        </div>
      </div>`;
  } else {
    _periodFlow = last ? (last.flow || 1) : 1;
    _periodMarkToday = true;
    html = `
      <div class="period-record-panel">
        <div class="period-record-title">记录经期</div>
        <div class="period-record-date">${dateStr}</div>
        <div class="period-mark-row">
          <span class="period-mark-label">今天来月经了吗？</span>
          <div class="period-switch active" id="period-mark-switch" onclick="togglePeriodMark()"></div>
        </div>
        <div class="period-form-label">经期量 <span class="period-form-sub">点击水滴选择</span></div>
        <div class="period-drop-row">${dropOptions()}</div>
        <div class="period-form-label">疼痛强度 <span class="period-form-sub">点击闪电选择</span></div>
        <div class="period-pain-row">${painOptions()}</div>
        <div class="period-form-label">记录状态感受</div>
        <input type="text" id="period-feel-input" class="period-form-input" placeholder="如腹胀、腰酸、心情烦躁" maxlength="60">
        <div class="period-record-actions">
          <button class="period-btn-cancel" onclick="closePeriodRecordPanel()">取消</button>
          <button class="period-btn-save" onclick="savePeriodRecord()">保存</button>
        </div>
      </div>`;
  }
  card.innerHTML = html;
  card.style.display = 'block';
  selectPeriodFlow(_periodFlow);
  selectPeriodPain(_periodPain);
  updatePeriodMark();
}

function selectPeriodFlow(f) {
  _periodFlow = f;
  document.querySelectorAll('.period-drop-opt').forEach(el => {
    el.classList.toggle('active', +el.dataset.flow === f);
  });
}

function selectPeriodPain(p) {
  _periodPain = p;
  document.querySelectorAll('.period-pain-opt').forEach(el => {
    el.classList.toggle('active', +el.dataset.pain === p);
  });
}

function togglePeriodMark() {
  _periodMarkToday = !_periodMarkToday;
  updatePeriodMark();
}

function updatePeriodMark() {
  const sw = document.getElementById('period-mark-switch');
  if (sw) sw.classList.toggle('active', _periodMarkToday);
}

function savePeriodRecord() {
  const feelInput = document.getElementById('period-feel-input');
  const feel = (feelInput ? feelInput.value.trim() : '') || '无';
  const records = Storage.getPeriodRecords();
  const existing = records.find(r => _periodEditDate >= r.startDate && _periodEditDate <= r.endDate);

  if (existing) {
    existing.daily = existing.daily || {};
    existing.daily[_periodEditDate] = { flow: _periodFlow, pain: _periodPain, symptoms: feel };
    Storage.setPeriodRecords(records);
    closePeriodRecordPanel();
    renderPeriod();
    Core.toast('已保存该天记录');
    return;
  }

  if (!_periodMarkToday) {
    closePeriodRecordPanel();
    Core.toast('未标记为经期，未保存');
    return;
  }

  const len = PeriodCalc.getSettings().periodLength;
  const endDate = PeriodCalc.addDays(PeriodCalc.parse(_periodEditDate), len - 1);
  const dayOne = { flow: _periodFlow, pain: _periodPain, symptoms: feel };
  records.push({
    id: Date.now(),
    startDate: _periodEditDate,
    endDate: PeriodCalc.fmt(endDate),
    flow: _periodFlow,
    pain: _periodPain,
    symptoms: feel,
    daily: { [_periodEditDate]: dayOne }
  });
  Storage.setPeriodRecords(records);
  closePeriodRecordPanel();
  renderPeriod();
  Core.toast(`已标记经期（默认 ${len} 天）`);
}

// 清除某一天的单独标记，恢复为整期默认值
function clearPeriodDaily(dateStr) {
  const records = Storage.getPeriodRecords();
  const existing = records.find(r => dateStr >= r.startDate && dateStr <= r.endDate);
  if (!existing || !existing.daily || !existing.daily[dateStr]) {
    Core.toast('该天没有单独标记');
    return;
  }
  delete existing.daily[dateStr];
  if (!Object.keys(existing.daily).length) delete existing.daily;
  Storage.setPeriodRecords(records);
  renderPeriodRecordCard(dateStr);
  renderPeriod();
  Core.toast('已恢复整期默认');
}

function endPeriodNow(dateStr) {
  const target = dateStr || PeriodCalc.fmt(new Date());
  const records = Storage.getPeriodRecords();
  const existing = records.find(r => target >= r.startDate && target <= r.endDate);
  if (!existing) {
    Core.toast('该日期不在经期内');
    return;
  }
  renderConfirmCard(
    '结束经期',
    `确定将本次经期结束于 ${target} 吗？`,
    () => {
      existing.endDate = target;
      Storage.setPeriodRecords(records);
      closePeriodRecordPanel();
      renderPeriod();
      Core.toast('经期已结束');
    },
    false
  );
}

function cancelPeriodRecord(dateStr) {
  const records = Storage.getPeriodRecords();
  const existing = records.find(r => dateStr >= r.startDate && dateStr <= r.endDate);
  if (!existing) {
    Core.toast('该日期不在经期内');
    return;
  }
  renderConfirmCard(
    '取消月经标注',
    `确定取消 ${existing.startDate} 开始的经期标注吗？该天的经期量、疼痛与感受数据将被清除。`,
    () => {
      Storage.setPeriodRecords(records.filter(r => r.id !== existing.id));
      closePeriodRecordPanel();
      renderPeriod();
      Core.toast('已取消月经标注');
    },
    true
  );
}

function renderConfirmCard(title, text, onConfirm, danger) {
  const card = document.getElementById('period-record-card');
  if (!card) return;
  _periodConfirmCb = onConfirm;
  const btnCls = danger ? 'period-confirm-danger-btn' : 'period-confirm-ok-btn';
  card.innerHTML = `
    <div class="period-record-panel">
      <div class="period-record-title">${title}</div>
      <div class="period-confirm-box">
        <div class="period-confirm-text">${text}</div>
        <div class="period-confirm-actions">
          <button class="period-confirm-back-btn" onclick="closePeriodRecordPanel()">返回</button>
          <button class="${btnCls}" onclick="doPeriodConfirm()">确认</button>
        </div>
      </div>
    </div>`;
  card.style.display = 'block';
}

function doPeriodConfirm() {
  const cb = _periodConfirmCb;
  _periodConfirmCb = null;
  if (cb) cb();
}

function closePeriodRecordPanel() {
  _periodConfirmCb = null;
  const card = document.getElementById('period-record-card');
  if (card) card.style.display = 'none';
}

/* 经期前三天每日提醒：由账号设置的对方角色发来关心语录 */
const PeriodReminder = {
  quotes: [
    '生理期快到了，这几天记得早点睡，别着凉，暖宝宝我已经帮你记在备忘录里啦。',
    '宝，预测经期就在眼前了，红糖水、暖水袋都安排上，难受了就随时找我。',
    '再过两天就是你的生理期了，这阵子少吃生冷，我会一直陪着你。',
    '亲爱的，经期倒计时开始啦，这两天别逞强，重活都交给我。',
    '预测你的经期快到了，记得照顾好自己，晚上盖好被子，别踢被子啦。'
  ],
  check() {
    try {
      const records = Storage.getPeriodRecords();
      if (!records || !records.length) return;
      const next = PeriodCalc.predictNextPeriodStart();
      if (!next) return;
      const today = new Date();
      const todayStr = PeriodCalc.fmt(today);
      const diff = PeriodCalc.diffDays(today, next);
      if (diff < 1 || diff > 3) return;
      let lastReminder = Storage.get('periodReminderDate', '');
      // 兼容旧版直连 localStorage 键
      if (!lastReminder) {
        try {
          const oldReminder = localStorage.getItem('periodReminderDate');
          if (oldReminder) {
            lastReminder = oldReminder;
            Storage.set('periodReminderDate', oldReminder);
            localStorage.removeItem('periodReminderDate');
          }
        } catch (e) {}
      }
      if (lastReminder === todayStr) return;
      Storage.set('periodReminderDate', todayStr);
      const partners = Storage.getPartnerProfiles();
      const p = partners && partners.length ? partners[0] : { nickname: 'TA', avatarColor: '#F0A868' };
      const quote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
      this.show(p, quote, diff);
    } catch (e) {}
  },
  show(partner, quote, diff) {
    let overlay = document.getElementById('period-reminder-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'period-reminder-overlay';
      overlay.className = 'period-reminder-overlay';
      document.body.appendChild(overlay);
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const name = Core.escapeHtml(partner.nickname || 'TA');
    const initial = Core.escapeHtml((partner.nickname || 'TA').slice(0, 1));
    const avatar = partner.avatarImage
      ? `<div class="period-reminder-avatar"><img src="${partner.avatarImage}" alt=""></div>`
      : `<div class="period-reminder-avatar" style="background:${partner.avatarColor || '#F0A868'}">${initial}</div>`;
    overlay.innerHTML = `
      <div class="period-reminder-panel" onclick="event.stopPropagation()">
        <div class="period-reminder-head">
          ${avatar}
          <div>
            <div class="period-reminder-name">${name}</div>
            <div class="period-reminder-time">${hh}:${mm}</div>
          </div>
        </div>
        <div class="period-reminder-bubble">
          <div class="period-reminder-day-tag"><i class="fas fa-heart"></i> 经期前 ${diff} 天提醒</div>
          <div>${quote}</div>
        </div>
        <div class="period-reminder-actions">
          <button class="period-btn-cancel" onclick="closePeriodReminder()">知道了</button>
          <button class="period-btn-save" onclick="closePeriodReminder();Navigation.navigateTo('period')">去记录</button>
        </div>
      </div>`;
    overlay.style.display = 'flex';
    overlay.onclick = function() { closePeriodReminder(); };
  }
};

function closePeriodReminder() {
  const el = document.getElementById('period-reminder-overlay');
  if (el) el.style.display = 'none';
}

function checkPeriodReminder() {
  PeriodReminder.check();
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(checkPeriodReminder, 1200);
});

/* ===================================================
   3. 树洞 (Treehole)
   =================================================== */
function renderTreehole() {
  const container = document.getElementById('treehole-posts');
  if (!container) return;
  const posts = Storage.getTreeholePosts();
  let html = '';
  if (posts.length === 0) {
    html = '<div class="empty-state"><i class="fas fa-tree"></i><p>树洞空空如也，来说点什么吧</p></div>';
  } else {
    const sorted = [...posts].sort((a, b) => b.time - a.time);
    sorted.forEach(p => {
      html += `
        <div class="treehole-card glass-section">
          <div class="treehole-card-text">${p.text.replace(/\n/g, '<br>')}</div>
          <div class="treehole-card-footer">
            <span class="treehole-time">${Core.formatTime(p.time)}</span>
            <button class="treehole-like-btn" onclick="likeTreeholePost(${p.id})">
              <i class="far fa-heart"></i> <span>${p.likes || 0}</span>
            </button>
          </div>
        </div>`;
    });
  }
  container.innerHTML = html;
}

function postTreehole() {
  const input = document.getElementById('treehole-input');
  if (!input || !input.value.trim()) {
    Core.toast('请输入内容');
    return;
  }
  const posts = Storage.getTreeholePosts();
  posts.push({ id: Date.now(), text: input.value.trim(), time: Date.now(), likes: 0 });
  Storage.setTreeholePosts(posts);
  input.value = '';
  renderTreehole();
  Core.toast('已匿名发布');
}

function likeTreeholePost(id) {
  const posts = Storage.getTreeholePosts();
  const post = posts.find(p => p.id === id);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    Storage.setTreeholePosts(posts);
    renderTreehole();
  }
}

/* ===================================================
   4. 音乐 (Music)
   =================================================== */
const MusicPlayer = {
  currentIndex: 0,
  playlist: [
    { title: 'Cosmic Love', artist: 'Shixin', album: '拾心界', cover: '🌌', duration: '4:21' },
    { title: '晴天', artist: '周杰伦', album: '叶惠美', cover: '☀️', duration: '4:29' },
    { title: '平凡之路', artist: '朴树', album: '平凡之路', cover: '🛣️', duration: '5:02' },
    { title: '七里香', artist: '周杰伦', album: '七里香', cover: '🌸', duration: '4:57' },
    { title: '倔强', artist: '五月天', album: '神的孩子都在跳舞', cover: '🌟', duration: '4:23' },
    { title: '起风了', artist: '买辣椒也用券', album: '起风了', cover: '🍃', duration: '5:25' },
    { title: '夜曲', artist: '周杰伦', album: '十一月的萧邦', cover: '🌙', duration: '3:51' },
    { title: '光年之外', artist: '邓紫棋', album: '光年之外', cover: '✨', duration: '3:57' }
  ],
  isPlaying: false,

  /* ---- 播放引擎（Web Audio 合成轻柔背景音乐，无外部音频资源、离线可用） ---- */
  _audioCtx: null,
  _masterGain: null,
  _chordTimer: null,
  _progressTimer: null,
  _playElapsed: 0,     // 已累计播放秒数（暂停时保留）
  _playStartAt: 0,     // 本次开始播放时刻（时钟秒）
  _chordStep: 0,
  // C 大调经典和弦进行：C - G - Am - F（MIDI 音高）
  _chordProgression: [
    [60, 64, 67],
    [59, 62, 67],
    [57, 60, 64],
    [53, 57, 60]
  ],

  /* 统一时钟：优先 AudioContext（播放即走时），降级用 Date 模拟 */
  _clock() {
    return this._audioCtx ? this._audioCtx.currentTime : (Date.now() / 1000);
  },

  _durationSec() {
    const d = this.playlist[this.currentIndex].duration || '0:00';
    const p = String(d).split(':');
    return ((parseInt(p[0], 10) || 0) * 60) + (parseInt(p[1], 10) || 0);
  },

  _fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  },

  _ensureEngine() {
    if (!this._audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this._audioCtx = new AC();
        this._masterGain = this._audioCtx.createGain();
        this._masterGain.gain.value = 0.10;
        this._masterGain.connect(this._audioCtx.destination);
      } catch (e) {
        this._audioCtx = null;
        return false;
      }
    }
    if (this._audioCtx.state === 'suspended') {
      try { this._audioCtx.resume(); } catch (e) {}
    }
    return true;
  },

  /* 弹奏一个轻柔和弦（sine 叠加 + 淡入淡出包络） */
  _playChord() {
    if (!this._audioCtx || !this._masterGain) return;
    const notes = this._chordProgression[this._chordStep % this._chordProgression.length];
    this._chordStep++;
    const now = this._audioCtx.currentTime;
    notes.forEach((midi, idx) => {
      try {
        const osc = this._audioCtx.createOscillator();
        const gain = this._audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        const t0 = now + idx * 0.22;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.32, t0 + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t0);
        osc.stop(t0 + 2.0);
      } catch (e) {}
    });
  },

  _startEngineLoop() {
    this._playChord();
    this._chordTimer = setInterval(() => this._playChord(), 2000);
  },

  _stopEngineLoop() {
    if (this._chordTimer) { clearInterval(this._chordTimer); this._chordTimer = null; }
  },

  _getPosition() {
    const total = this._durationSec();
    let pos = this._playElapsed;
    if (this.isPlaying) {
      pos += this._clock() - this._playStartAt;
    }
    return Math.min(pos, total);
  },

  _startProgress() {
    this._updateProgress();
    this._progressTimer = setInterval(() => this._updateProgress(), 500);
  },

  _stopProgress() {
    if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null; }
  },

  _updateProgress() {
    const total = this._durationSec();
    const pos = this._getPosition();
    const fill = document.getElementById('music-progress-fill');
    if (fill) fill.style.width = (total > 0 ? (pos / total * 100) : 0) + '%';
    const curEl = document.getElementById('music-time-cur');
    if (curEl) curEl.textContent = this._fmtTime(pos);
    const durEl = document.getElementById('music-time-dur');
    if (durEl) durEl.textContent = this._fmtTime(total);
    // 播放结束自动切下一首
    if (this.isPlaying && total > 0 && pos >= total - 0.05) {
      this.next();
    }
  },

  _playCurrent() {
    if (!this._ensureEngine()) {
      // 音频引擎不可用（极老浏览器/隐私模式）：进度条仍用 Date 时钟模拟
    }
    this._playElapsed = 0;
    this._playStartAt = this._clock();
    this._startEngineLoop();
    this._startProgress();
  },

  _pauseCurrent() {
    this._playElapsed = this._getPosition();
    this._stopEngineLoop();
    this._stopProgress();
  },

  /* 点击进度条跳转 */
  seekFromEvent(ev) {
    const bar = ev.currentTarget;
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    const total = this._durationSec();
    this._playElapsed = ratio * total;
    this._playStartAt = this._clock();
    if (this.isPlaying) {
      this._stopEngineLoop();
      this._startEngineLoop();
      this._startProgress();
    } else {
      this._updateProgress();
    }
    this.render();
  },

  render() {
    const song = this.playlist[this.currentIndex];
    // 更新封面
    const cover = document.getElementById('music-cover-display');
    if (cover) cover.textContent = song.cover;
    // 更新信息
    const title = document.getElementById('music-title');
    const artist = document.getElementById('music-artist');
    if (title) title.textContent = song.title;
    if (artist) artist.textContent = song.artist + ' · ' + song.album;

    // 渲染播放列表（若存在列表容器）
    const listContainer = document.getElementById('music-playlist');
    if (listContainer) {
      let html = '';
      this.playlist.forEach((s, i) => {
        html += `<div class="music-list-item ${i === this.currentIndex ? 'active' : ''}" onclick="MusicPlayer.playIndex(${i})">
          <span class="music-list-cover">${s.cover}</span>
          <div class="music-list-info"><span class="music-list-title">${s.title}</span><span class="music-list-artist">${s.artist}</span></div>
          <span class="music-list-dur">${s.duration}</span>
        </div>`;
      });
      listContainer.innerHTML = html;
    }

    // 更新按钮
    const playBtn = document.getElementById('music-btn-play');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }

    // 更新进度条与时间（小组件 / 播放页通用）
    const total = this._durationSec();
    const pos = this._getPosition();
    const fill = document.getElementById('music-progress-fill');
    if (fill) fill.style.width = (total > 0 ? (pos / total * 100) : 0) + '%';
    const curEl = document.getElementById('music-time-cur');
    if (curEl) curEl.textContent = this._fmtTime(pos);
    const durEl = document.getElementById('music-time-dur');
    if (durEl) durEl.textContent = this._fmtTime(total);
  },

  togglePlay() {
    if (this.isPlaying) {
      this._pauseCurrent();
      this.isPlaying = false;
    } else {
      this._playCurrent();
      this.isPlaying = true;
    }
    this.render();
  },

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    if (this.isPlaying) {
      this._stopEngineLoop();
      this._stopProgress();
      this._playCurrent();
    } else {
      this._playElapsed = 0;
    }
    this.render();
  },

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    if (this.isPlaying) {
      this._stopEngineLoop();
      this._stopProgress();
      this._playCurrent();
    } else {
      this._playElapsed = 0;
    }
    this.render();
  },

  playIndex(i) {
    this.currentIndex = i;
    if (this.isPlaying) {
      this._stopEngineLoop();
      this._stopProgress();
      this._playCurrent();
    } else {
      this._playElapsed = 0;
    }
    this.render();
  }
};

function renderMusic() {
  MusicPlayer.render();
}

/* ===================================================
   5. 小说 (Novel)
   =================================================== */
const NovelApp = {
  novels: [
    {
      id: 'novel_1',
      title: '小王子',
      author: '安托万·德·圣-埃克苏佩里',
      cover: '🦊',
      desc: '一个关于爱与责任的永恒童话',
      chapters: [
        { title: '第一章', text: '当我还只有六岁的时候，在一本描写原始森林的名叫《真实的故事》的书中，看到了一副精彩的插画，画的是一条蟒蛇正在吞食一只大野兽。这就是那副画的摹本。\n\n这本书中写道："这些蟒蛇把它们的猎获物不加咀嚼地囫囵吞下，尔后就不能再动弹了；它们就在长长的六个月的睡眠中消化这些食物。"\n\n当时，我对丛林中的奇遇想得很多，于是，我也用彩色铅笔画出了我的第一副图画。我的第一号作品。' },
        { title: '第二章', text: '我就这样孤独地生活着，没有一个能真正谈得来的人，一直到六年前在撒哈拉沙漠上发生了那次故障。我的发动机里有个东西损坏了。当时由于我既没有带机械师也没有带旅客，我就试图独自完成这个困难的维修工作。这对我来说是个生与死的问题。我随身带的水只够饮用一星期。\n\n第一天晚上我就睡在这远离人间烟火的大沙漠上。我比大海中伏在小木排上的遇难者还要孤独得多。而在第二天拂晓，当一个奇怪的小声音叫醒我的时候，你们可以想象我当时是多么吃惊。这小小的声音说道："请你给我画一只羊，好吗？"' },
        { title: '第三章', text: '我费了好长时间才弄清楚他是从哪里来的。小王子向我提出了很多问题，可是，对我提出的问题，他好像压根没有听见似的。他无意中吐露的一些话逐渐使我搞清了他的来历。\n\n例如，当他第一次瞅见我的飞机时，他问我道："这是个什么玩艺？""这不是玩艺。它能飞。这是飞机。是我的飞机。"我当时很骄傲地告诉他我能飞。于是他惊奇地说道："怎么？你是从天上掉下来的？" "是的"。我谦逊地答道。' }
      ]
    }
  ],
  currentNovelId: null,
  currentChapter: 0,

  renderShelf() {
    const container = document.getElementById('novel-shelf');
    if (!container) return;
    let html = '';
    this.novels.forEach(n => {
      html += `<div class="novel-cover-item" onclick="NovelApp.openNovel('${n.id}')">
        <div class="novel-cover-img">${n.cover}</div>
        <div class="novel-cover-title">${n.title}</div>
        <div class="novel-cover-author">${n.author}</div>
      </div>`;
    });
    container.innerHTML = html;
  },

  openNovel(id) {
    this.currentNovelId = id;
    this.currentChapter = 0;
    this.renderReader(id);
    Navigation.navigateTo('novel-reader');
  },

  renderReader() {
    const novel = this.novels.find(n => n.id === this.currentNovelId);
    if (!novel) return;
    const ch = novel.chapters[this.currentChapter];

    const titleEl = document.getElementById('novel-reader-title');
    const contentEl = document.getElementById('novel-reader-content');
    const chapEl = document.getElementById('novel-reader-chapter');
    const prevBtn = document.getElementById('novel-btn-prev');
    const nextBtn = document.getElementById('novel-btn-next');

    if (titleEl) titleEl.textContent = novel.title;
    if (chapEl) chapEl.textContent = ch.title;
    if (contentEl) {
      contentEl.innerHTML = ch.text.replace(/\n/g, '<br><br>');
      contentEl.scrollTop = 0;
    }
    if (prevBtn) prevBtn.style.visibility = this.currentChapter > 0 ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = this.currentChapter < novel.chapters.length - 1 ? 'visible' : 'hidden';
  },

  nextChapter() {
    const novel = this.novels.find(n => n.id === this.currentNovelId);
    if (!novel || this.currentChapter >= novel.chapters.length - 1) return;
    this.currentChapter++;
    this.renderReader();
  },

  prevChapter() {
    if (this.currentChapter <= 0) return;
    this.currentChapter--;
    this.renderReader();
  }
};

function renderNovel() {
  NovelApp.renderShelf();
}

/* ===================================================
   6. 格言 (Quotes) — 首页显示 + 字卡页管理
   =================================================== */
function renderHomeQuote(el) {
  const quotes = Storage.getQuotes();
  if (quotes.length === 0) { el.textContent = ''; return; }
  const idx = Math.floor(Math.random() * quotes.length);
  el.textContent = '「' + quotes[idx] + '」';
}

function renderQuotes() {
  const container = document.getElementById('quotes-list');
  if (!container) return;
  const quotes = Storage.getQuotes();
  if (quotes.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-quote-right"></i><p>暂无格言，点击右下角添加</p></div>';
    return;
  }
  let html = '';
  quotes.forEach((q, i) => {
    html += `
      <div class="quote-item">
        <div class="quote-item-text">${Core.escapeHtml(q)}</div>
        <div class="quote-item-actions">
          <button onclick="editQuote(${i})" title="编辑"><i class="fas fa-pen"></i></button>
          <button class="danger" onclick="deleteQuote(${i})" title="删除"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function addQuote() {
  Core.formModal('添加格言', [
    { label: '格言内容', placeholder: '请输入格言' }
  ], function(values) {
    var text = values[0];
    if (!text) return;
    var quotes = Storage.getQuotes();
    quotes.push(text);
    Storage.setQuotes(quotes);
    renderQuotes();
    Core.toast('格言已添加');
  });
}

function editQuote(index) {
  var quotes = Storage.getQuotes();
  Core.formModal('编辑格言', [
    { label: '格言内容', placeholder: '请输入格言', value: quotes[index] }
  ], function(values) {
    var text = values[0];
    if (!text) return;
    quotes[index] = text;
    Storage.setQuotes(quotes);
    renderQuotes();
    Core.toast('格言已更新');
  });
}

function deleteQuote(index) {
  Core.confirm('删除格言', '确定删除这条格言吗？', () => {
    const quotes = Storage.getQuotes();
    quotes.splice(index, 1);
    Storage.setQuotes(quotes);
    renderQuotes();
    Core.toast('格言已删除');
  });
}

function importQuotesJSON() { importUniversalJSON('quotes'); }

function exportQuotesJSON() {
  var quotes = Storage.getQuotes();
  if (!quotes.length) { Core.toast('暂无格言可导出'); return; }
  var payload = { exportDate: new Date().toISOString(), type: 'quotes', total: quotes.length, quotes: quotes };
  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url;
  a.download = 'quotes_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  Core.toast('已导出 ' + quotes.length + ' 条格言');
}

function deduplicateQuotes() {
  var quotes = Storage.getQuotes();
  var seen = {}, deduped = [];
  quotes.forEach(function(q) { if (!seen[q]) { seen[q] = true; deduped.push(q); } });
  var removed = quotes.length - deduped.length;
  if (removed === 0) { Core.toast('未发现重复格言'); return; }
  Core.confirm('去重格言', '发现 ' + removed + ' 条重复，是否删除？', function() {
    Storage.setQuotes(deduped);
    renderQuotes();
    Core.toast('已删除 ' + removed + ' 条重复格言');
  });
}

/* ===================================================
   6.5 每日留言语录库 (Daily Quotes)
   =================================================== */
function renderDailyQuotes() {
  const container = document.getElementById('daily-quotes-list');
  if (!container) return;
  const quotes = Storage.getDailyQuotes();
  if (quotes.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><p>暂无每日留言语录，点击右下角添加</p></div>';
    return;
  }
  let html = '';
  quotes.forEach((q, i) => {
    html += `
      <div class="quote-item">
        <div class="quote-item-text">${Core.escapeHtml(q)}</div>
        <div class="quote-item-actions">
          <button onclick="editDailyQuote(${i})" title="编辑"><i class="fas fa-pen"></i></button>
          <button class="danger" onclick="deleteDailyQuote(${i})" title="删除"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function addDailyQuote() {
  Core.formModal('添加每日留言语录', [
    { label: '语录内容', placeholder: '请输入每日留言语录' }
  ], function(values) {
    var text = values[0];
    if (!text) return;
    var quotes = Storage.getDailyQuotes();
    quotes.push(text);
    Storage.setDailyQuotes(quotes);
    renderDailyQuotes();
    Core.toast('每日留言语录已添加');
  });
}

function editDailyQuote(index) {
  var quotes = Storage.getDailyQuotes();
  Core.formModal('编辑每日留言语录', [
    { label: '语录内容', placeholder: '请输入每日留言语录', value: quotes[index] }
  ], function(values) {
    var text = values[0];
    if (!text) return;
    quotes[index] = text;
    Storage.setDailyQuotes(quotes);
    renderDailyQuotes();
    Core.toast('每日留言语录已更新');
  });
}

function deleteDailyQuote(index) {
  Core.confirm('删除每日留言语录', '确定删除这条留言语录吗？', () => {
    const quotes = Storage.getDailyQuotes();
    quotes.splice(index, 1);
    Storage.setDailyQuotes(quotes);
    renderDailyQuotes();
    Core.toast('每日留言语录已删除');
  });
}

function importDailyQuotesJSON() { importUniversalJSON('dailyQuotes'); }
function exportDailyQuotesJSON() {
  var quotes = Storage.getDailyQuotes();
  if (!quotes.length) { Core.toast('暂无留言可导出'); return; }
  var payload = { exportDate: new Date().toISOString(), type: 'dailyQuotes', total: quotes.length, dailyQuotes: quotes };
  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url;
  a.download = 'daily_quotes_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  Core.toast('已导出 ' + quotes.length + ' 条留言');
}

function deduplicateDailyQuotes() {
  var quotes = Storage.getDailyQuotes();
  var seen = {}, deduped = [];
  quotes.forEach(function(q) { if (!seen[q]) { seen[q] = true; deduped.push(q); } });
  var removed = quotes.length - deduped.length;
  if (removed === 0) { Core.toast('未发现重复留言'); return; }
  Core.confirm('去重留言', '发现 ' + removed + ' 条重复，是否删除？', function() {
    Storage.setDailyQuotes(deduped);
    renderDailyQuotes();
    Core.toast('已删除 ' + removed + ' 条重复留言');
  });
}

/* ===================================================
   7. 记事本 (Notepad)
   =================================================== */
function renderNotepad() {
  const container = document.getElementById('notepad-list');
  if (!container) return;
  const notes = Storage.getNotes();
  let html = '';
  if (notes.length === 0) {
    html = '<div class="empty-state"><i class="fas fa-pen-to-square"></i><p>暂无笔记，点击右下角创建</p></div>';
  } else {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    sorted.forEach(n => {
      const preview = n.content.replace(/<[^>]*>/g, '').substring(0, 50);
      html += `
        <div class="notepad-item glass-section" onclick="openNote('${n.id}')">
          <div class="notepad-item-title">${n.title || '无标题'}</div>
          <div class="notepad-item-preview">${preview || '空内容'}</div>
          <div class="notepad-item-time">${Core.formatTime(n.updatedAt)}</div>
        </div>`;
    });
  }
  container.innerHTML = html;
}

function createNote() {
  const title = prompt('请输入笔记标题：', '新笔记');
  if (title === null) return;
  const notes = Storage.getNotes();
  const note = { id: Date.now().toString(), title: title.trim() || '无标题', content: '', updatedAt: Date.now() };
  notes.push(note);
  Storage.setNotes(notes);
  openNoteEditor(note.id);
}

function openNote(id) {
  const notes = Storage.getNotes();
  const note = notes.find(n => n.id === id);
  if (!note) return;
  Navigation.navigateTo('notepad-editor');
  setTimeout(() => {
    document.getElementById('note-editor-id').value = note.id;
    document.getElementById('note-editor-title').value = note.title;
    document.getElementById('note-editor-content').innerHTML = note.content;
  }, 100);
}

function openNoteEditor(id) {
  Navigation.navigateTo('notepad-editor');
  setTimeout(() => {
    document.getElementById('note-editor-id').value = id;
    const notes = Storage.getNotes();
    const note = notes.find(n => n.id === id);
    if (note) {
      document.getElementById('note-editor-title').value = note.title;
      document.getElementById('note-editor-content').innerHTML = note.content;
    }
  }, 100);
}

function saveNote() {
  const id = document.getElementById('note-editor-id').value;
  const title = document.getElementById('note-editor-title').value.trim();
  const content = document.getElementById('note-editor-content').innerHTML;
  const notes = Storage.getNotes();
  const note = notes.find(n => n.id === id);
  if (note) {
    note.title = title || '无标题';
    note.content = content;
    note.updatedAt = Date.now();
    Storage.setNotes(notes);
    Core.toast('笔记已保存');
    Navigation.goBack();
  }
}

function deleteNote(id) {
  Core.confirm('删除笔记', '确定删除这篇笔记吗？', () => {
    const notes = Storage.getNotes().filter(n => n.id !== id);
    Storage.setNotes(notes);
    Navigation.goBack();
    setTimeout(() => renderNotepad(), 200);
    Core.toast('笔记已删除');
  });
}

/* ===================================================
   8. 商城购物 (Shop)
   =================================================== */
const ShopApp = {
  categories: [
    { id: 'all', name: '全部', icon: 'fa-store' },
    { id: 'daily', name: '日用品', icon: 'fa-tint' },
    { id: 'cosmetic', name: '化妆品', icon: 'fa-wand-magic-sparkles' },
    { id: 'fashion', name: '服装首饰', icon: 'fa-star' },
    { id: 'book', name: '书籍', icon: 'fa-book-open' },
    { id: 'food', name: '外卖奶茶', icon: 'fa-bolt' },
    { id: 'card', name: '卡牌', icon: 'fa-id-card' },
    { id: 'weapon', name: '武器', icon: 'fa-skull-crossbones' },
    { id: 'toy', name: '周边', icon: 'fa-gift' }
  ],

  products: [
    // 日用品
    { id: 'd1', name: '云朵洗衣凝珠', price: 29, icon: '🫧', desc: '留香一整天的洗衣凝珠', category: 'daily' },
    { id: 'd2', name: '猫咪陶瓷马克杯', price: 36, icon: '🐱', desc: '猫咪造型治愈马克杯', category: 'daily' },
    { id: 'd3', name: '手作香薰蜡烛', price: 45, icon: '🕯️', desc: '天然大豆蜡手工制作', category: 'daily' },
    { id: 'd4', name: '星空投影灯', price: 89, icon: '🌌', desc: '房间秒变星空', category: 'daily' },
    // 化妆品
    { id: 'c1', name: '丝绒哑光口红', price: 128, icon: '💄', desc: '高级丝绒质地 上嘴温柔', category: 'cosmetic' },
    { id: 'c2', name: '玫瑰邂逅香水', price: 169, icon: '🌹', desc: '温柔玫瑰香调 留香持久', category: 'cosmetic' },
    { id: 'c3', name: '星辰亮片眼影盘', price: 99, icon: '✨', desc: '一抹星辰 闪耀一整天', category: 'cosmetic' },
    { id: 'c4', name: '樱花护手霜', price: 49, icon: '🧴', desc: '樱花香 滋润不粘腻', category: 'cosmetic' },
    // 服装首饰
    { id: 'f1', name: '心动小鹿项链', price: 158, icon: '📿', desc: '小鹿吊坠 锁骨显白', category: 'fashion' },
    { id: 'f2', name: '情侣手链', price: 129, icon: '💞', desc: '一对一条 戴出默契', category: 'fashion' },
    { id: 'f3', name: '纯棉白衬衫', price: 139, icon: '👔', desc: '柔软亲肤 简约百搭', category: 'fashion' },
    { id: 'f4', name: '温柔丝巾', price: 69, icon: '🧣', desc: '真丝触感 点睛之选', category: 'fashion' },
    // 书籍
    { id: 'b1', name: '《给你的情诗集》', price: 45, icon: '📖', desc: '把没说完的话写进诗里', category: 'book' },
    { id: 'b2', name: '《恋爱心理学》', price: 52, icon: '📕', desc: '读懂彼此的心', category: 'book' },
    { id: 'b3', name: '《晚安故事集》', price: 68, icon: '🌙', desc: '每晚一个甜甜的梦', category: 'book' },
    { id: 'b4', name: '《治愈系漫画》', price: 39, icon: '📚', desc: '看完心里软软的', category: 'book' },
    // 外卖奶茶
    { id: 'g1', name: '芋泥波波奶茶', price: 18, icon: '🧋', desc: '芋泥绵密 波波Q弹', category: 'food' },
    { id: 'g2', name: '黑糖珍珠奶茶', price: 16, icon: '🥤', desc: '黑糖挂壁 浓郁顺滑', category: 'food' },
    { id: 'g3', name: '草莓奶油蛋糕', price: 32, icon: '🍰', desc: '新鲜草莓 甜到心里', category: 'food' },
    { id: 'g4', name: '双人火锅套餐', price: 128, icon: '🍲', desc: '两个人的热气腾腾', category: 'food' },
    // 卡牌
    { id: 'k1', name: '心动表白卡牌礼盒', price: 66, icon: '🎴', desc: '拆开就是一整片心动', category: 'card' },
    { id: 'k2', name: '恋爱盲盒卡', price: 25, icon: '🎁', desc: '每一张都是小惊喜', category: 'card' },
    { id: 'k3', name: '星座塔罗牌', price: 58, icon: '🔮', desc: '占卜我们的缘分', category: 'card' },
    { id: 'k4', name: '限量金箔卡', price: 199, icon: '🃏', desc: '收藏级 只此一张', category: 'card' },
    // 武器
    { id: 'w1', name: '温柔暴击之刃', price: 299, icon: '⚔️', desc: '一刀直击小心脏', category: 'weapon' },
    { id: 'w2', name: '守护之盾', price: 259, icon: '🛡️', desc: '替你挡下所有不开心', category: 'weapon' },
    { id: 'w3', name: '星河法杖', price: 349, icon: '🪄', desc: '挥一挥就是满目星河', category: 'weapon' },
    { id: 'w4', name: '月光飞镖', price: 99, icon: '🗡️', desc: '例无虚发 直指心动', category: 'weapon' },
    // 周边
    { id: 't1', name: '心动玩偶', price: 88, icon: '🧸', desc: '抱在怀里不想撒手', category: 'toy' },
    { id: 't2', name: '云朵抱枕', price: 59, icon: '☁️', desc: '超柔软云朵造型', category: 'toy' },
    { id: 't3', name: '恋爱限定徽章', price: 35, icon: '🎖️', desc: '限定款 戴在胸口', category: 'toy' },
    { id: 't4', name: '星空明信片', price: 22, icon: '🌠', desc: '把想念写进星空', category: 'toy' }
  ],

  cart: [],
  records: [],
  currentCategory: 'all',

  init() {
    this.cart = Storage.getShopCart();
    this.records = Storage.get('shopRecords', []) || [];
  },

  /* ---------- 菜单栏模式：左侧竖向分类 + 右侧商品 ---------- */
  render() {
    const shell = document.getElementById('shop-shell');
    if (!shell) return;
    shell.innerHTML =
      '<div class="recipe-sidebar">' + this._sidebarHtml() + '</div>' +
      '<div class="recipe-main">' + this._productsHtml() + '</div>';
    this.updateCartBadge();
  },

  // 兼容旧入口（渲染链路仍可能调用）
  renderCategoryTabs() { this.render(); },
  renderProducts() { this.render(); },

  /* 侧边栏：全部 + 各分类（图标用主题色 FontAwesome，与网站UI一致）+ 购买记录入口 */
  _sidebarHtml() {
    let html = '';
    this.categories.forEach(c => {
      html += '<button class="recipe-sb-item' + (c.id === this.currentCategory ? ' active' : '') + '" onclick="ShopApp.switchCategory(\'' + c.id + '\')">' +
        '<i class="fas ' + c.icon + '"></i><span>' + c.name + '</span></button>';
    });
    html += '<div class="recipe-sidebar-sep"></div>';
    html += '<button class="recipe-sb-item shop-sb-records" onclick="ShopApp.showRecords()" title="购买记录">' +
      '<i class="fas fa-history"></i><span>购买记录</span></button>';
    return html;
  },

  /* 右侧商品区：列表头 + 商品网格 */
  _productsHtml() {
    const list = this._filteredProducts();
    const cat = this._catById(this.currentCategory);
    let head = '<div class="shop-list-head">' +
      '<span class="shop-list-title">' + (cat ? '<i class="fas ' + cat.icon + '"></i> ' + cat.name : '商品') + '</span>' +
      '<span class="shop-list-count">共 ' + list.length + ' 件</span></div>';
    if (!list.length) {
      return head + '<div class="empty-state"><i class="fas fa-store"></i><p>该分类暂无商品</p></div>';
    }
    let html = '<div class="shop-product-grid">';
    list.forEach(p => {
      const inCart = this.cart.some(c => c.id === p.id);
      html += '<div class="shop-product glass-section" onclick="ShopApp.openBuyPanel(\'' + p.id + '\')">';
      if (p.custom) {
        html += '<span class="shop-custom-badge">自制</span>' +
          '<button class="shop-product-remove" onclick="event.stopPropagation();ShopApp.removeCustomProduct(\'' + p.id + '\')" title="删除该商品"><i class="fas fa-times"></i></button>';
      }
      html += '<div class="shop-product-icon">' + p.icon + '</div>' +
        '<div class="shop-product-name">' + p.name + '</div>' +
        '<div class="shop-product-desc">' + p.desc + '</div>' +
        '<div class="shop-product-bottom">' +
          '<span class="shop-product-price">¥' + p.price + '</span>' +
          '<button class="shop-cart-btn ' + (inCart ? 'in-cart' : '') + '" onclick="event.stopPropagation();ShopApp.addToCart(\'' + p.id + '\')">' +
            '<i class="fas ' + (inCart ? 'fa-check' : 'fa-cart-plus') + '"></i></button>' +
        '</div></div>';
    });
    return head + html + '</div>';
  },

  _catById(id) {
    for (let i = 0; i < this.categories.length; i++) if (this.categories[i].id === id) return this.categories[i];
    return null;
  },

  _filteredProducts() {
    const all = this._allProducts();
    return this.currentCategory === 'all' ? all : all.filter(p => p.category === this.currentCategory);
  },

  switchCategory(catId) {
    this.currentCategory = catId;
    this.render();
  },

  /* ---------- 购物车 ---------- */
  addToCart(productId) {
    const product = this.getProduct(productId);
    if (!product) return;
    const existing = this.cart.find(c => c.id === productId);
    if (existing) {
      existing.qty++;
    } else {
      this.cart.push({ id: productId, name: product.name, price: product.price, icon: product.icon, qty: 1 });
    }
    Storage.setShopCart(this.cart);
    this.updateCartBadge();
    this.render();
    Core.toast('已加入购物车');
  },

  updateCartBadge() {
    const badge = document.getElementById('shop-cart-badge');
    if (badge) {
      const total = this.cart.reduce((s, c) => s + c.qty, 0);
      badge.textContent = total;
      badge.style.display = total > 0 ? 'inline' : 'none';
    }
  },

  renderCart() {
    const container = document.getElementById('shop-cart-list');
    const totalEl = document.getElementById('shop-cart-total');
    if (!container) return;
    if (this.cart.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-cart"></i><p>购物车是空的</p></div>';
      if (totalEl) totalEl.textContent = '¥0';
      return;
    }
    let html = '';
    let total = 0;
    this.cart.forEach((c, i) => {
      total += c.price * c.qty;
      html += `
        <div class="shop-cart-item">
          <span class="cart-item-icon">${c.icon}</span>
          <div class="cart-item-info"><span>${c.name}</span><span class="cart-item-price">¥${c.price} x ${c.qty}</span></div>
          <button onclick="ShopApp.removeFromCart(${i})" class="text-btn"><i class="fas fa-trash-alt"></i></button>
        </div>`;
    });
    container.innerHTML = html;
    if (totalEl) totalEl.textContent = '¥' + total;
    this.updateCartBadge();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    Storage.setShopCart(this.cart);
    this.renderCart();
    this.render();
  },

  checkout() {
    if (this.cart.length === 0) { Core.toast('购物车是空的'); return; }
    const total = this.cart.reduce((s, c) => s + c.price * c.qty, 0);
    this.cart.forEach(c => {
      this._addRecord({ productId: c.id, name: c.name, price: c.price, icon: c.icon, category: 'cart', action: 'self', target: 'me', label: '购物车结算' });
    });
    Core.toast('下单成功！总计 ¥' + total);
    this.cart = [];
    Storage.setShopCart(this.cart);
    Navigation.goBack();
    setTimeout(() => this.render(), 200);
  },

  /* ---------- 购买流程 ---------- */
  /* ---------- 自定义商品 ---------- */
  _loadCustomProducts() {
    const arr = Storage.get('shopCustom', []);
    return Array.isArray(arr) ? arr : [];
  },
  _saveCustomProducts(arr) {
    Storage.set('shopCustom', arr);
  },
  // 自定义商品排前，内置商品兜底
  _allProducts() {
    return this._loadCustomProducts().concat(this.products);
  },
  getProduct(productId) {
    const all = this._allProducts();
    for (let i = 0; i < all.length; i++) {
      if (all[i].id === productId) return all[i];
    }
    return null;
  },

  // 添加商品（复用 rc-modal 玻璃拟态表单）
  openAddProductModal() {
    if (!this._addOv) {
      this._addOv = document.createElement('div');
      this._addOv.className = 'shop-overlay';
      this._addOv.id = 'shop-add-overlay';
      document.body.appendChild(this._addOv);
    }
    let chipHtml = '';
    this.categories.forEach(c => {
      if (c.id === 'all') return;
      chipHtml += '<label class="rc-chip' + (c.id === 'daily' ? ' active' : '') + '" data-cat="' + c.id + '"><i class="fas ' + c.icon + '"></i> ' + c.name + '<input type="radio" name="shop-add-cat" value="' + c.id + '"' + (c.id === 'daily' ? ' checked' : '') + '></label>';
    });
    this._addOv.innerHTML = `
      <div class="glass-modal-panel">
        <div class="rc-modal">
          <div class="rc-modal-title"><i class="fas fa-plus"></i> 添加商品</div>
          <div class="rc-modal-sub">给自己加点想买的小东西</div>
          <div class="rc-field"><label class="rc-label">商品名<span class="rc-required">*</span></label><input class="rc-input" id="shop-add-name" placeholder="例如：手作巧克力"></div>
          <div class="rc-field"><label class="rc-label">分类<span class="rc-required">*</span></label><div class="rc-chip-group" id="shop-add-cats">${chipHtml}</div></div>
          <div class="rc-inline-row">
            <div class="rc-field"><label class="rc-label">图标 Emoji<span class="rc-required">*</span></label><input class="rc-input" id="shop-add-icon" maxlength="4" placeholder="🍫"></div>
            <div class="rc-field"><label class="rc-label">价格(¥)<span class="rc-required">*</span></label><input class="rc-input" id="shop-add-price" type="number" min="0" step="0.01" placeholder="0"></div>
          </div>
          <div class="rc-field"><label class="rc-label">描述</label><textarea class="rc-textarea" id="shop-add-desc" placeholder="一句话介绍它（选填）"></textarea></div>
          <div class="rc-modal-actions">
            <button class="glass-btn" onclick="ShopApp._closeAddProductModal()">取消</button>
            <button class="glass-btn primary" onclick="ShopApp.saveCustomProduct()">保存商品</button>
          </div>
        </div>
      </div>`;
    this._addOv.style.display = 'flex';
    setTimeout(() => this._addOv.classList.add('show'), 10);
    // 分类 chip 点击高亮
    const cats = this._addOv.querySelectorAll('.rc-chip');
    cats.forEach(ch => {
      ch.addEventListener('click', function() {
        cats.forEach(x => x.classList.remove('active'));
        ch.classList.add('active');
      });
    });
  },
  _closeAddProductModal() {
    const ov = this._addOv;
    if (!ov) return;
    ov.classList.remove('show');
    setTimeout(function() {
      ov.style.display = 'none';
      ov.innerHTML = '';
    }, 200);
  },
  saveCustomProduct() {
    const ov = this._addOv;
    const nameEl = ov && ov.querySelector('#shop-add-name');
    const iconEl = ov && ov.querySelector('#shop-add-icon');
    const priceEl = ov && ov.querySelector('#shop-add-price');
    const descEl = ov && ov.querySelector('#shop-add-desc');
    const catEl = ov && ov.querySelector('input[name="shop-add-cat"]:checked');
    if (!nameEl || !iconEl || !priceEl || !catEl) return;
    const name = (nameEl.value || '').trim();
    const icon = (iconEl.value || '').trim() || '🛍️';
    const price = parseFloat(priceEl.value);
    const desc = (descEl.value || '').trim();
    if (!name) { Core.toast('请填写商品名'); return; }
    if (isNaN(price) || price < 0) { Core.toast('请填写正确的价格'); return; }
    const p = {
      id: 'p' + Date.now(),
      name: name,
      price: Math.round(price * 100) / 100,
      icon: icon,
      desc: desc || 'TA 亲手添加的商品',
      category: catEl.value,
      custom: true
    };
    const arr = this._loadCustomProducts();
    arr.unshift(p);
    this._saveCustomProducts(arr);
    this._closeAddProductModal();
    Core.toast('已添加商品：' + name);
    this.currentCategory = p.category;
    this.render();
  },
  removeCustomProduct(productId) {
    const arr = this._loadCustomProducts();
    let idx = -1;
    for (let i = 0; i < arr.length; i++) if (arr[i].id === productId) { idx = i; break; }
    if (idx < 0) return;
    const name = arr[idx].name;
    const self = this;
    if (!window.confirm('确定删除自定义商品「' + name + '」吗？')) return;
    arr.splice(idx, 1);
    self._saveCustomProducts(arr);
    // 同步清理购物车中的该商品
    self.cart = self.cart.filter(c => c.id !== productId);
    Storage.setShopCart(self.cart);
    Core.toast('已删除商品：' + name);
    self.render();
  },

  // 解析购买/送礼目标单聊：优先当前聊天室，其次最近活跃的单聊
  resolveTargetChat() {
    const room = document.getElementById('page-chat-room');
    if (room && room.dataset.chatId && typeof isGroupChatId === 'function' && !isGroupChatId(room.dataset.chatId)) {
      return room.dataset.chatId;
    }
    const chats = Storage.getChats();
    if (!chats || !chats.length) return null;
    let best = null;
    for (let i = 0; i < chats.length; i++) {
      if (typeof isGroupChatId === 'function' && isGroupChatId(chats[i].id)) continue;
      if (!best || (chats[i].lastTime || 0) > (best.lastTime || 0)) best = chats[i];
    }
    return best ? best.id : null;
  },

  // 弹出购买方式选择弹窗
  openBuyPanel(productId) {
    const p = this.getProduct(productId);
    if (!p) return;
    const chatId = this.resolveTargetChat();
    if (!chatId) {
      Core.toast('先去聊天页添加一个角色吧');
      return;
    }
    const partnerName = this._partnerNameOf(chatId);
    const ov = document.createElement('div');
    ov.className = 'shop-overlay';
    ov.id = 'shop-buy-overlay';
    ov.innerHTML = `
      <div class="shop-modal shop-buy-panel" onclick="event.stopPropagation()">
        <div class="shop-modal-close" onclick="ShopApp.closeOverlay('shop-buy-overlay')"><i class="fas fa-times"></i></div>
        <div class="shop-buy-product">
          <div class="shop-buy-icon">${p.icon}</div>
          <div class="shop-buy-name">${p.name}</div>
          <div class="shop-buy-desc">${p.desc}</div>
          <div class="shop-buy-price">¥${p.price}</div>
        </div>
        <div class="shop-buy-title">选择购买方式</div>
        <div class="shop-buy-options">
          <div class="shop-buy-option" onclick="ShopApp.buyForSelf('${p.id}')">
            <div class="shop-buy-opt-icon">💳</div>
            <div class="shop-buy-opt-info"><span class="shop-buy-opt-name">自己付款</span><span class="shop-buy-opt-sub">下单归自己</span></div>
            <i class="fas fa-chevron-right shop-buy-opt-arrow"></i>
          </div>
          <div class="shop-buy-option" onclick="ShopApp.askPartnerPay('${p.id}')">
            <div class="shop-buy-opt-icon">🧾</div>
            <div class="shop-buy-opt-info"><span class="shop-buy-opt-name">让 ${Core.escapeHtml(partnerName)} 付款</span><span class="shop-buy-opt-sub">TA 请客，有概率犹豫哦</span></div>
            <i class="fas fa-chevron-right shop-buy-opt-arrow"></i>
          </div>
          <div class="shop-buy-option" onclick="ShopApp.giftToPartner('${p.id}')">
            <div class="shop-buy-opt-icon">🎁</div>
            <div class="shop-buy-opt-info"><span class="shop-buy-opt-name">送给 ${Core.escapeHtml(partnerName)}</span><span class="shop-buy-opt-sub">作为礼物送出</span></div>
            <i class="fas fa-chevron-right shop-buy-opt-arrow"></i>
          </div>
        </div>
        <button class="shop-buy-cancel" onclick="ShopApp.closeOverlay('shop-buy-overlay')">取消</button>
      </div>`;
    ov.onclick = function() { ShopApp.closeOverlay('shop-buy-overlay'); };
    document.body.appendChild(ov);
    setTimeout(() => ov.classList.add('show'), 10);
  },

  closeOverlay(id) {
    const ov = document.getElementById(id);
    if (ov) {
      ov.classList.remove('show');
      setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 250);
    }
  },

  /* 1) 自己付款购买 */
  buyForSelf(productId) {
    const p = this.getProduct(productId);
    if (!p) return;
    const chatId = this.resolveTargetChat();
    this.closeOverlay('shop-buy-overlay');
    if (!chatId) { Core.toast('购买失败：请先添加角色'); return; }
    this._addRecord({ productId: p.id, name: p.name, price: p.price, icon: p.icon, category: p.category, action: 'self', target: 'me', label: '自己购买' });
    const selfGreets = [
      '自己给自己一份小确幸～',
      '犒劳一下辛苦的自己',
      '喜欢的东西，就自己买给自己',
      '今天也要对自己好一点',
      '给自己的小奖励，安排上'
    ];
    const msg = this._buildGiftMsg(p, { isSelf: true, note: '我在拾心商城买下了「' + p.name + '」', greeting: selfGreets[Math.floor(Math.random() * selfGreets.length)] });
    this._pushGiftToChat(chatId, msg);
    Core.toast('购买成功！已记录到商城');
  },

  /* 2) 让对方付款（对方有概率同意/拒绝） */
  askPartnerPay(productId) {
    const p = this.getProduct(productId);
    if (!p) return;
    const chatId = this.resolveTargetChat();
    this.closeOverlay('shop-buy-overlay');
    if (!chatId) { Core.toast('对方不在哦，请先添加角色'); return; }
    const partnerName = this._partnerNameOf(chatId);
    if (Storage.getTypingIndicator()) showTypingIndicator();
    Core.toast(partnerName + ' 正在考虑中…');
    const agree = Math.random() < 0.75;
    setTimeout(() => {
      hideTypingIndicator();
      if (agree) {
        this._addRecord({ productId: p.id, name: p.name, price: p.price, icon: p.icon, category: p.category, action: 'partnerPay', target: 'me', label: '对方付款' });
        const payGreets = [
          '只要是你喜欢的，我都愿意买单～',
          '你喜欢就好，钱的事我来',
          '看上了就买，别跟我客气',
          '你开心最重要，拿去玩',
          '舍得为你花钱，才是真喜欢'
        ];
        const msg = this._buildGiftMsg(p, { isSelf: false, note: '我付款啦，给你买了「' + p.name + '」', greeting: payGreets[Math.floor(Math.random() * payGreets.length)] });
        this._pushGiftToChat(chatId, msg);
        Core.toast('对方已付款，礼物到手！');
      } else {
        const refuses = [
          '这次钱包有点紧，下次一定呀',
          '你挑的有点贵啦，换个便宜的嘛',
          '我倒是想，可这个月的奶茶基金还没攒够…'
        ];
        const text = refuses[Math.floor(Math.random() * refuses.length)];
        this._pushTextToChat(chatId, text);
        Core.toast('对方婉拒了这次付款');
      }
    }, 1200 + Math.random() * 1600);
  },

  /* 3) 送给对方 */
  giftToPartner(productId) {
    const p = this.getProduct(productId);
    if (!p) return;
    const chatId = this.resolveTargetChat();
    this.closeOverlay('shop-buy-overlay');
    if (!chatId) { Core.toast('对方不在哦，请先添加角色'); return; }
    this._addRecord({ productId: p.id, name: p.name, price: p.price, icon: p.icon, category: p.category, action: 'giftToPartner', target: 'partner', label: '送给对方' });
    const giftGreets = [
      '想把所有好的都给你',
      '看到它第一眼就想到你了',
      '最好的东西，永远留给你',
      '有你在，我啥都舍得',
      '一点小心意，不许拒绝呀',
      '逛商城的时候，满脑子都是你'
    ];
    const msg = this._buildGiftMsg(p, { isSelf: true, note: '我送你的「' + p.name + '」收到没？', greeting: giftGreets[Math.floor(Math.random() * giftGreets.length)] });
    this._pushGiftToChat(chatId, msg);
    Core.toast('礼物已送出！');
  },

  /* ---------- 对方主动赠送 ---------- */
  shouldPartnerGift() {
    // 小概率触发 + 距上次主动赠送至少 60 分钟，避免频繁购买
    if (Math.random() >= 0.05) return false;
    const last = Number(Storage.get('shopPartnerGiftAt', 0)) || 0;
    if (Date.now() - last < 60 * 60 * 1000) return false;
    return true;
  },

  partnerInitiatedGift(chatId) {
    if (!chatId) return;
    const all = this._allProducts();
    const p = all[Math.floor(Math.random() * all.length)];
    if (!p) return;
    this._addRecord({ productId: p.id, name: p.name, price: p.price, icon: p.icon, category: p.category, action: 'partnerInitiated', target: 'me', label: '对方主动赠送' });
    Storage.set('shopPartnerGiftAt', Date.now());
    const greetings = [
      '偷偷在商城看到这个，第一眼就想到你',
      '逛商城的时候觉得好适合你，就买了',
      '猜你喜欢这个，快夸我！',
      '给你也买了一份，不许拒绝'
    ];
    const msg = this._buildGiftMsg(p, {
      isSelf: false,
      note: '我刚在拾心商城给你买了「' + p.name + '」',
      greeting: greetings[Math.floor(Math.random() * greetings.length)]
    });
    this._pushGiftToChat(chatId, msg);
    Core.toast('对方送了你一份礼物');
  },

  /* ---------- 购买记录 ---------- */
  showRecords() {
    this.init();
    const ov = document.createElement('div');
    ov.className = 'shop-overlay';
    ov.id = 'shop-records-overlay';
    let listHtml = '';
    if (this.records.length) {
      this.records.forEach(r => {
        const cls = (r.action === 'partnerInitiated' || r.action === 'partnerPay') ? 'tag-green'
          : (r.action === 'giftToPartner' ? 'tag-pink' : 'tag-blue');
        const t = new Date(r.time);
        const timeStr = (t.getMonth() + 1) + '/' + t.getDate() + ' ' + this._pad(t.getHours()) + ':' + this._pad(t.getMinutes());
        listHtml += `
          <div class="shop-record-item">
            <span class="shop-record-icon">${r.icon || '🛍️'}</span>
            <div class="shop-record-info">
              <div class="shop-record-name">${r.name}</div>
              <div class="shop-record-sub"><span class="shop-record-tag ${cls}">${r.label || ''}</span><span class="shop-record-time">${timeStr}</span></div>
            </div>
            <span class="shop-record-price">¥${r.price}</span>
          </div>`;
      });
    } else {
      listHtml = '<div class="empty-state"><i class="fas fa-history"></i><p>还没有购买记录</p></div>';
    }
    ov.innerHTML = `
      <div class="shop-modal shop-record-panel" onclick="event.stopPropagation()">
        <div class="shop-record-head">
          <span class="shop-record-title"><i class="fas fa-history"></i> 购买记录</span>
          <button class="shop-record-clear" onclick="ShopApp.clearRecords()">清空</button>
        </div>
        <div class="shop-record-list">${listHtml}</div>
        <button class="shop-buy-cancel" onclick="ShopApp.closeOverlay('shop-records-overlay')">关闭</button>
      </div>`;
    ov.onclick = function() { ShopApp.closeOverlay('shop-records-overlay'); };
    document.body.appendChild(ov);
    setTimeout(() => ov.classList.add('show'), 10);
  },

  clearRecords() {
    this.records = [];
    Storage.set('shopRecords', []);
    this.showRecords();
  },

  /* ---------- 内部工具 ---------- */
  _partnerNameOf(chatId) {
    const partners = Storage.getPartnerProfiles();
    for (let i = 0; i < partners.length; i++) {
      if (partners[i].id === chatId) return partners[i].nickname || '对方';
    }
    return '对方';
  },

  _pad(n) { return n < 10 ? '0' + n : '' + n; },

  _addRecord(rec) {
    this.records.unshift(Object.assign({ id: Date.now() + Math.floor(Math.random() * 1000), time: Date.now() }, rec));
    if (this.records.length > 200) this.records = this.records.slice(0, 200);
    Storage.set('shopRecords', this.records);
    return this.records[0];
  },

  _buildGiftMsg(p, opts) {
    const id = Date.now();
    return {
      id: id,
      type: opts.isSelf ? 'self' : 'other',
      text: opts.note,
      time: id,
      msgType: 'gift',
      read: false,
      gift: {
        productId: p.id,
        name: p.name,
        price: p.price,
        icon: p.icon,
        category: p.category,
        greeting: opts.greeting || ''
      }
    };
  },

  // 把礼物消息写入聊天记录并即时通知（当前聊天室则实时渲染）
  _pushGiftToChat(chatId, msg) {
    if (!chatId) return;
    const msgs = Storage.getMessages(chatId);
    msgs.push(msg);
    Storage.setMessages(chatId, msgs);
    updateLastMsg(chatId, msg.text);
    _safeAppendMessage(chatId, msg);
    if (window.App && App.playSound) { try { App.playSound('receive'); } catch(e) {} }
    if (typeof showBackgroundPush === 'function') showBackgroundPush(msg.text);
  },

  // 普通文本消息（如对方拒绝付款）
  _pushTextToChat(chatId, text) {
    if (!chatId) return;
    const msgs = Storage.getMessages(chatId);
    const msg = { id: Date.now(), type: 'other', text: text, time: Date.now(), msgType: 'text' };
    msgs.push(msg);
    Storage.setMessages(chatId, msgs);
    updateLastMsg(chatId, text);
    _safeAppendMessage(chatId, msg);
    if (window.App && App.playSound) { try { App.playSound('receive'); } catch(e) {} }
    if (typeof showBackgroundPush === 'function') showBackgroundPush(text);
  }
};

function renderShop() {
  ShopApp.init();
  ShopApp.render();
  ShopApp.updateCartBadge();
}

function renderShopCart() {
  ShopApp.renderCart();
}

/* ===== 每日一言（daily-quotes）全局绑定 =====
   函数在本文件内定义，绑定放在文件末尾可避免 init.js 顶层引用未加载函数
   造成 ReferenceError、中断 renderWordCardStickers 等后续绑定。 */
window.renderDailyQuotes = renderDailyQuotes;
window.addDailyQuote = addDailyQuote;
window.editDailyQuote = editDailyQuote;
window.deleteDailyQuote = deleteDailyQuote;
window.importDailyQuotesJSON = importDailyQuotesJSON;
window.exportDailyQuotesJSON = exportDailyQuotesJSON;
window.deduplicateDailyQuotes = deduplicateDailyQuotes;

