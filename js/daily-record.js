/* === 日常记录 === */

let dailyCalendarDate = new Date();

function renderDailyRecords() {
  const container = document.getElementById('daily-records-container');
  if (!container) return;
  
  const dateStr = Core.formatDate(dailyCalendarDate);
  const records = Storage.getRecordsByDate(dateStr);
  const calendarContainer = document.getElementById('daily-calendar');
  
  // 渲染日历
  if (calendarContainer) {
    calendarContainer.innerHTML = renderCalendar(dailyCalendarDate);
  }
  
  // 渲染记录
  let html = `
    <div style="padding:8px 16px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:0.9rem;font-weight:600;color:var(--text-dark)">${dateStr} 的记录</span>
      <button class="glass-btn" style="padding:6px 14px;font-size:0.8rem" onclick="addDailyRecord()">
        <i class="fas fa-plus"></i> 添加
      </button>
    </div>
  `;
  
  if (records.length === 0) {
    html += '<div style="text-align:center;padding:40px;color:var(--text-lighter);font-size:0.85rem">这一天还没有记录</div>';
  } else {
    records.forEach(r => {
      html += `
        <div class="daily-record">
          <div class="record-header">
            <span class="record-date">${Core.formatTime(r.createdAt)}</span>
            <div class="record-actions">
              <button onclick="editDailyRecord(${r.id})"><i class="fas fa-edit"></i></button>
              <button onclick="deleteDailyRecord(${r.id})"><i class="fas fa-trash-alt"></i></button>
            </div>
          </div>
          <div class="record-text">${r.text.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    });
  }
  
  container.innerHTML = html;
}

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = Core.formatDate(new Date());
  
  const recordsMap = {};
  Storage.getDailyRecords().forEach(r => { recordsMap[r.date] = true; });
  
  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const dayHeaders = ['日','一','二','三','四','五','六'];
  
  let html = `
    <div class="calendar-header">
      <span class="calendar-month">${year}年 ${monthNames[month]}</span>
      <div class="calendar-nav">
        <button onclick="changeCalendarMonth(-1)"><i class="fas fa-chevron-left"></i></button>
        <button onclick="changeCalendarMonth(1)"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
    <div class="calendar-grid">
  `;
  
  dayHeaders.forEach(d => {
    html += `<div class="calendar-day-header">${d}</div>`;
  });
  
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day other-month"></div>';
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
    const isToday = dateStr === today;
    const hasRecord = recordsMap[dateStr];
    let cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (hasRecord) cls += ' has-record';
    
    html += `<div class="${cls}" onclick="selectCalendarDate(${year},${month},${d})">${d}</div>`;
  }
  
  html += '</div>';
  return html;
}

function changeCalendarMonth(delta) {
  dailyCalendarDate.setMonth(dailyCalendarDate.getMonth() + delta);
  renderDailyRecords();
}

function selectCalendarDate(year, month, day) {
  dailyCalendarDate = new Date(year, month, day);
  renderDailyRecords();
}

function addDailyRecord() {
  Core.formModal('添加日常记录', [
    { label: '记录内容', placeholder: '请输入记录内容' }
  ], function(values) {
    var text = values[0];
    if (text) {
      var dateStr = Core.formatDate(dailyCalendarDate);
      Storage.addDailyRecord(dateStr, text);
      renderDailyRecords();
      Core.toast('记录已添加');
    }
  });
}

function editDailyRecord(id) {
  var records = Storage.getDailyRecords();
  var record = records.find(function(r) { return r.id === id; });
  if (!record) return;
  Core.formModal('编辑记录', [
    { label: '记录内容', placeholder: '请输入记录内容', value: record.text }
  ], function(values) {
    var text = values[0];
    if (text) {
      Storage.updateDailyRecord(id, text);
      renderDailyRecords();
      Core.toast('记录已更新');
    }
  });
}

function deleteDailyRecord(id) {
  Core.confirm('删除记录', '确定要删除这条记录吗？', () => {
    Storage.deleteDailyRecord(id);
    renderDailyRecords();
    Core.toast('记录已删除');
  });
}

