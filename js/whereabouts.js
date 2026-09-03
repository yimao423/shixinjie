/* === 行踪 ===
 * 字卡入口：分组列表页（对标主字卡）-> 分组内容页，设置地点 + 行动（如"在图书馆，安静看书"）
 * 发现页入口：行踪汇报（对方角色可主动调取行踪内容并汇报，条目按时间排列、纯文字显示）
 */

/* 读取对方角色（默认所有对方角色都可主动调取行踪并汇报） */
function _getWhereaboutPullRoles() {
  var out = [];
  try {
    var partners = Storage.getPartnerProfiles ? Storage.getPartnerProfiles() : [];
    for (var i = 0; i < partners.length; i++) {
      var p = partners[i];
      if (!p) continue;
      out.push({
        id: p.id,
        name: p.nickname || '对方',
        avatar: (p.avatar && String(p.avatar).trim()) ? p.avatar : ((p.nickname && p.nickname.charAt(0)) || 'TA'),
        color: p.avatarColor || '#C8B8E0',
        avatarImage: p.avatarImage || ''
      });
    }
  } catch (e) {
    console.error('[whereabouts] 读取对方角色失败', e);
  }
  return out;
}

/* 渲染行踪分组列表页（字卡入口，对标 renderWordCardMain） */
function renderWhereabouts() {
  var container = document.getElementById('whereabouts-list');
  if (!container) return;

  var groups = Storage.getWhereaboutGroups();
  if (!groups.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">'
      + '<div style="font-size:2rem;margin-bottom:8px"><i class="fas fa-map-marked-alt"></i></div>'
      + '暂无行踪分组，点击上方「添加分组」创建</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    html += '<div class="group-item-wrapper">'
      + '<div class="discover-item" onclick="openWhereaboutGroup(\'' + escapeAttr(g.name) + '\')">'
      + '<div class="discover-icon"><i class="fas fa-map-pin"></i></div>'
      + '<div class="discover-info">'
      + '<div class="discover-title">' + escapeHtml(g.name) + '</div>'
      + '<div class="discover-desc">' + g.count + ' 条行踪</div>'
      + '</div>'
      + '<i class="fas fa-chevron-right discover-arrow"></i>'
      + '</div>'
      + '<div class="group-item-actions">'
      + '<button onclick="event.stopPropagation();editWhereaboutGroupName(\'' + escapeAttr(g.name) + '\')" title="编辑分组名"><i class="fas fa-pen"></i></button>'
      + '<button class="danger" onclick="event.stopPropagation();deleteWhereaboutGroup(\'' + escapeAttr(g.name) + '\')" title="删除分组"><i class="fas fa-trash-alt"></i></button>'
      + '</div></div>';
    if (i < groups.length - 1) html += '<div class="list-divider"></div>';
  }
  container.innerHTML = html;
}

/* 打开行踪分组内容页 */
function openWhereaboutGroup(name) {
  window._whereaboutCurrentGroup = name;
  Navigation.navigateTo('whereabout-group');
}

/* 渲染行踪分组内容页（对标 renderWordCardMainGroup） */
function renderWhereaboutGroup() {
  var container = document.getElementById('whereabout-group-list');
  var titleEl = document.getElementById('whereabout-group-title');
  if (!container) return;

  var group = window._whereaboutCurrentGroup || '';
  if (titleEl) titleEl.textContent = group || '分组';

  var items = group ? Storage.getWhereaboutsByGroup(group) : [];
  if (!items.length) {
    container.innerHTML = '<div style="text-align:center;padding:48px 24px;color:var(--text-lighter);font-size:0.85rem">'
      + '<div style="font-size:2rem;margin-bottom:8px"><i class="fas fa-map-marked-alt"></i></div>'
      + '该分组暂无行踪，点击上方「添加行踪」按钮添加</div>';
    return;
  }

  var html = '';
  items.forEach(function(w) {
    html += '<div class="discover-item">'
      + '<div class="discover-icon"><i class="fas fa-map-pin"></i></div>'
      + '<div class="discover-info">'
      +   '<div class="discover-title">' + Core.escapeHtml(w.place || '未知地点') + '</div>'
      +   '<div class="discover-desc">' + Core.escapeHtml(w.action ? '在' + w.place + '，' + w.action : '在' + w.place) + '</div>'
      + '</div>'
      + '<button class="whereabout-delete-btn" onclick="deleteWhereabout(' + w.id + ')" title="删除"><i class="fas fa-trash-alt"></i></button>'
      + '</div>';
  });
  container.innerHTML = html;
}

/* 新建行踪分组：输入分组名，创建空分组并跳进该分组页 */
function addWhereaboutGroup() {
  Core.formModal('新建行踪分组', [
    { label: '分组名称', placeholder: '请输入分组名称', value: '' }
  ], function(values) {
    var name = (values[0] || '').trim();
    if (!name) { Core.toast('分组名称不能为空'); return; }
    var groups = Storage.getWhereaboutGroups();
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].name === name) { Core.toast('分组「' + name + '」已存在'); return; }
    }
    // 空分组无需写入数据（分组由条目的 group 字段隐式定义），进入分组页后添加第一条即带上该分组
    openWhereaboutGroup(name);
    Core.toast('分组已创建');
  });
}

/* 重命名分组：同步该分组所有行踪的 group 字段 */
function editWhereaboutGroupName(oldName) {
  Core.formModal('修改分组名称', [
    { label: '新分组名称', placeholder: '请输入新名称', value: oldName }
  ], function(values) {
    var newName = (values[0] || '').trim();
    if (!newName || newName === oldName) return;
    var list = Storage.getWhereabouts();
    list.forEach(function(w) {
      var g = (w.group && String(w.group).trim()) ? w.group : '我的行踪';
      if (g === oldName) w.group = newName;
    });
    Storage.setWhereabouts(list);
    renderWhereabouts();
    if (window._whereaboutCurrentGroup === oldName) window._whereaboutCurrentGroup = newName;
    Core.toast('分组已重命名');
  });
}

/* 删除分组：确认后删除该分组下所有行踪 */
function deleteWhereaboutGroup(groupName) {
  Core.confirm('删除分组', '确定删除分组「' + groupName + '」及其下所有行踪？此操作不可撤销。', function() {
    var list = Storage.getWhereabouts();
    Storage.setWhereabouts(list.filter(function(w) {
      var g = (w.group && String(w.group).trim()) ? w.group : '我的行踪';
      return g !== groupName;
    }));
    if (window._whereaboutCurrentGroup === groupName) window._whereaboutCurrentGroup = '';
    renderWhereabouts();
    Core.toast('分组已删除');
  });
}

/* 常用行踪活动（供选用 / 参考） */
var WHEREABOUT_ACTIVITIES = ['看书','散步','喝咖啡','跑步','健身','看电影','逛书店','写东西','听音乐','画画','做饭','逛街','逛公园','发呆','上课','上班','旅行','骑行','游泳','打游戏','拍照','冥想'];

/* 添加行踪（地点 + 行动 + 分组，内置常用活动快速选择）
 * presetAction：可选参数，传入时自动预填「行动」输入框并高亮对应 chip */
function addWhereabout(presetAction) {
  var existing = document.querySelector('.form-modal-overlay');
  if (existing) existing.remove();

  var currentGroup = window._whereaboutCurrentGroup || '';
  var groups = Storage.getWhereaboutGroups();
  // 确保下拉中包含当前分组（新建的空分组未落库时也显示）
  var hasCurrent = false;
  for (var gi = 0; gi < groups.length; gi++) {
    if (groups[gi].name === currentGroup) { hasCurrent = true; break; }
  }
  if (currentGroup && !hasCurrent) groups.push({ name: currentGroup, count: 0 });

  var groupHtml = '';
  if (groups.length > 0) {
    groupHtml = '<div class="form-modal-field"><label>分组</label>'
      + '<select class="form-modal-input" id="wa-group-select">';
    for (var j = 0; j < groups.length; j++) {
      var sel = groups[j].name === currentGroup ? ' selected' : '';
      groupHtml += '<option value="' + escapeAttr(groups[j].name) + '"' + sel + '>' + escapeHtml(groups[j].name) + '</option>';
    }
    groupHtml += '<option value="__new__">＋ 新建分组…</option>'
      + '</select></div>'
      + '<div class="form-modal-field" id="wa-group-new-wrap" style="display:none"><label>新分组名称</label>'
      + '<input type="text" class="form-modal-input" id="wa-group-new-input" placeholder="输入新分组名称"></div>';
  } else {
    groupHtml = '<div class="form-modal-field"><label>新分组名称</label>'
      + '<input type="text" class="form-modal-input" id="wa-group-new-input" placeholder="输入分组名称"></div>';
  }

  var overlay = document.createElement('div');
  overlay.className = 'form-modal-overlay';
  overlay.innerHTML =
    '<div class="form-modal-panel">'
    + '<h3 class="form-modal-title">添加行踪</h3>'
    + '<div class="form-modal-field"><label>地点</label>'
    + '<input type="text" class="form-modal-input" id="whereabout-place-input" placeholder="如：图书馆"></div>'
    + '<div class="form-modal-field"><label>行动</label>'
    + '<input type="text" class="form-modal-input" id="whereabout-action-input" placeholder="如：安静看书"></div>'
    + groupHtml
    + '<div class="whereabout-activity-label">常用行踪活动</div>'
    + '<div class="whereabout-activity-chips">'
    + WHEREABOUT_ACTIVITIES.map(function(a) { return '<span class="whereabout-activity-chip" data-a="' + Core.escapeHtml(a) + '">' + Core.escapeHtml(a) + '</span>'; }).join('')
    + '</div>'
    + '<div class="form-modal-actions">'
    + '<button class="form-modal-cancel">取消</button>'
    + '<button class="form-modal-confirm">确认</button>'
    + '</div></div>';

  document.body.appendChild(overlay);

  var placeInput = overlay.querySelector('#whereabout-place-input');
  var actionInput = overlay.querySelector('#whereabout-action-input');
  var cancelBtn = overlay.querySelector('.form-modal-cancel');
  var confirmBtn = overlay.querySelector('.form-modal-confirm');
  var groupSelect = overlay.querySelector('#wa-group-select');
  var groupNewWrap = overlay.querySelector('#wa-group-new-wrap');

  /* 分组选择：选择「新建分组」时显示名称输入框 */
  if (groupSelect && groupNewWrap) {
    groupSelect.onchange = function() {
      groupNewWrap.style.display = groupSelect.value === '__new__' ? '' : 'none';
      if (groupSelect.value === '__new__') {
        var ni = overlay.querySelector('#wa-group-new-input');
        if (ni) ni.focus();
      }
    };
  }

  /* 点击常用活动：填入行动输入框 */
  overlay.querySelectorAll('.whereabout-activity-chip').forEach(function(chip) {
    chip.onclick = function() {
      actionInput.value = chip.getAttribute('data-a');
      overlay.querySelectorAll('.whereabout-activity-chip').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
    };
  });

  /* 预设行动：预填输入框并高亮对应 chip */
  if (presetAction) {
    actionInput.value = presetAction;
    overlay.querySelectorAll('.whereabout-activity-chip').forEach(function(c) {
      if (c.getAttribute('data-a') === presetAction) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  var cleanup = function() {
    overlay.classList.remove('active');
    setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 250);
  };

  cancelBtn.onclick = function() { cleanup(); };

  confirmBtn.onclick = function() {
    var place = (placeInput.value || '').trim();
    if (!place) { Core.toast('地点不能为空'); return; }
    var action = (actionInput.value || '').trim();
    var group = '我的行踪';
    if (groupSelect) {
      if (groupSelect.value === '__new__') {
        var newInput = overlay.querySelector('#wa-group-new-input');
        group = (newInput && newInput.value ? newInput.value.trim() : '') || '我的行踪';
      } else {
        group = groupSelect.value;
      }
    } else {
      var onlyInput = overlay.querySelector('#wa-group-new-input');
      if (onlyInput) group = onlyInput.value.trim() || '我的行踪';
    }
    Storage.addWhereabout(place, action, group);
    cleanup();
    renderWhereabouts();
    renderWhereaboutGroup();
    Core.toast('行踪已添加');
  };

  overlay.onclick = function(e) { if (e.target === overlay) cleanup(); };

  // 回车提交
  overlay.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { confirmBtn.click(); }
  });

  // 入场动画
  requestAnimationFrame(function() {
    overlay.classList.add('active');
    placeInput.focus();
  });

  return overlay;
}

/* 删除行踪 */
function deleteWhereabout(id) {
  Core.confirm('删除行踪', '确定要删除这条行踪吗？', function() {
    Storage.deleteWhereabout(id);
    renderWhereabouts();
    renderWhereaboutGroup();
    Core.toast('行踪已删除');
  });
}

/* 渲染行踪汇报列表（发现页入口，按时间排列、纯文字显示） */
function renderWhereaboutReports() {
  var container = document.getElementById('whereabout-reports-list');
  if (!container) return;
  var reports = Storage.getWhereaboutReports();
  if (!reports.length) {
    container.innerHTML = '<div style="text-align:center;padding:48px 24px;color:var(--text-lighter);font-size:0.85rem">'
      + '<div style="font-size:2rem;margin-bottom:8px"><i class="fas fa-location-dot"></i></div>'
      + '还没有行踪汇报，点击右上角魔法棒让 TA 汇报行踪</div>';
  } else {
    var html = '';
    for (var i = 0; i < reports.length; i++) {
      var r = reports[i];
      html += '<div class="whereabout-report">'
        + '<div class="whereabout-report-head">'
        +   '<span class="whereabout-report-author" style="color:' + Core.escapeHtml(r.color || '#C8B8E0') + '">' + Core.escapeHtml(r.roleName || 'TA') + '</span>'
        +   '<span class="whereabout-report-ops">'
        +     '<span class="whereabout-report-time">' + (r.time ? Core.formatTime(r.time) : '') + '</span>'
        +     '<button class="whereabout-delete-btn whereabout-report-del" onclick="deleteWhereaboutReport(' + r.id + ')" title="删除汇报"><i class="fas fa-trash-alt"></i></button>'
        +   '</span>'
        + '</div>'
        + '<div class="whereabout-report-text">' + Core.escapeHtml(r.text) + '</div>'
        + '</div>';
    }
    html += '<div style="text-align:center;padding:16px;color:var(--text-lighter);font-size:0.75rem">—— 汇报按时间排列 ——</div>';
    container.innerHTML = html;
  }
  /* 对方角色主动调取行踪：满足条件时自动汇报一条（低频，避免打扰） */
  _maybeAutoReportByRole();
}

/* 自动汇报控制 key：记录最近一次全局定时自动汇报时间 */
function _autoReportKey() { return 'whereaboutAutoReportTime'; }

/* 页面进入触发的自动汇报：使用独立冷却 key，避免「进入汇报页」抢占全局定时器的间隔窗口，
   否则每次浏览页面都会把定时汇报的冷却重置为当前时间，导致按 intervalMin 的定时汇报长期失效 */
function _pageAutoReportKey() { return 'whereaboutPageAutoReportTime'; }

/* 内置默认行踪：本地行踪数据为空（localStorage 无数据或异常）时作为汇报数据源兜底 */
var DEFAULT_WHEREABOUTS = [
  { place: '图书馆', action: '安静看书' },
  { place: '咖啡店', action: '喝咖啡' },
  { place: '公园', action: '散步' },
  { place: '健身房', action: '锻炼身体' },
  { place: '书店', action: '逛书店' },
  { place: '电影院', action: '看电影' },
  { place: '海边', action: '看海发呆' },
  { place: '家里', action: '听音乐' }
];

/* 获取汇报数据源：优先本地行踪，空则回退内置默认行踪（保证总能汇报） */
function _getWhereaboutSource() {
  try {
    var list = Storage.getWhereabouts();
    if (list && list.length) return list;
  } catch (e) {
    console.error('[whereabouts] 读取本地行踪失败，使用默认数据', e);
  }
  return DEFAULT_WHEREABOUTS;
}

/* 自动汇报：汇报为空时 100% 立即汇报一条（跳过冷却与概率），保证对方回报可见；否则低频汇报 */
function _maybeAutoReportByRole() {
  try {
    // 用户主动删除汇报后不立即自动补一条
    if (window._skipAutoReport) return;
    if (!_getWhereaboutSource().length) return;
    var reports = Storage.getWhereaboutReports();
    if (!reports.length) {
      reportWhereaboutByRole(true);
      return;
    }
    var last = Storage.get(_pageAutoReportKey(), 0) || 0;
    if (Date.now() - last < 3 * 60 * 1000) return;
    var roles = _getWhereaboutPullRoles();
    if (!roles.length) return;
    if (Math.random() >= 0.5) return;
    Storage.set(_pageAutoReportKey(), Date.now());
    reportWhereaboutByRole(true);
  } catch (e) {
    console.error('[whereabouts] 自动汇报失败', e);
  }
}

/* 对方角色主动调取行踪内容并汇报（如"xxx到达了xxx"、"xxx在地点进行了xxx"） */
function reportWhereaboutByRole(silent) {
  var roles = _getWhereaboutPullRoles();
  if (!roles.length) {
    // 无对方角色时回退默认角色，保证点魔法棒总能汇报
    roles = [{ id: 'default', name: '对方', color: '#C8B8E0', avatarImage: '' }];
  }
  var whereabouts = _getWhereaboutSource();
  var role = roles[Math.floor(Math.random() * roles.length)];
  var wa = whereabouts[Math.floor(Math.random() * whereabouts.length)];
  var place = (wa.place || '').trim();
  if (!place) place = '某个地方';
  var action = (wa.action || '').trim();

  // 汇报文案：随机采用 到达 / 行动 模板
  var text = '';
  if (action) {
    var templates = [
      role.name + '到达了' + place,
      role.name + '在' + place + '，' + action,
      role.name + '在' + place + '进行了' + action
    ];
    text = templates[Math.floor(Math.random() * templates.length)];
  } else {
    text = Math.random() < 0.5
      ? role.name + '到达了' + place
      : role.name + '正在' + place;
  }

  Storage.addWhereaboutReport({
    roleId: role.id,
    roleName: role.name,
    color: role.color,
    text: text
  });
  if (!silent) Core.toast(role.name + ' 汇报了一条行踪');
  renderWhereaboutReports();
}

/* 删除单条行踪汇报 */
function deleteWhereaboutReport(id) {
  Core.confirm('删除汇报', '确定删除这条行踪汇报吗？', function() {
    Storage.deleteWhereaboutReport(id);
    window._skipAutoReport = true;
    renderWhereaboutReports();
    window._skipAutoReport = false;
    Core.toast('汇报已删除');
  });
}

/* ===== 导出到 window（供 HTML 内联 onclick 调用） ===== */
window.renderWhereabouts = renderWhereabouts;
window.renderWhereaboutGroup = renderWhereaboutGroup;
window.openWhereaboutGroup = openWhereaboutGroup;
window.addWhereaboutGroup = addWhereaboutGroup;
window.editWhereaboutGroupName = editWhereaboutGroupName;
window.deleteWhereaboutGroup = deleteWhereaboutGroup;
window.addWhereabout = addWhereabout;
window.deleteWhereabout = deleteWhereabout;
window.renderWhereaboutReports = renderWhereaboutReports;
window.deleteWhereaboutReport = deleteWhereaboutReport;
window.reportWhereaboutByRole = reportWhereaboutByRole;

/* ============================================================
   行踪设置：对方行踪汇报开关 + 汇报间隔 + 每日汇报时间范围
   全局定时调度（参照时空信箱 startScheduler）：应用启动即启动，
   到点自动汇报，无需手动点魔法棒
   ============================================================ */
var WHEREABOUT_SETTINGS_KEY = 'whereaboutSettings';

/* 获取行踪设置（含默认值） */
function getWhereaboutSettings() {
  var def = { enabled: true, intervalMin: 30, startHour: 8, endHour: 22 };
  try {
    var s = Storage.get(WHEREABOUT_SETTINGS_KEY, null);
    if (!s) return def;
    var r = {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : def.enabled,
      intervalMin: parseInt(s.intervalMin, 10) || def.intervalMin,
      startHour: parseInt(s.startHour, 10),
      endHour: parseInt(s.endHour, 10)
    };
    if (isNaN(r.startHour) || r.startHour < 0 || r.startHour > 23) r.startHour = def.startHour;
    if (isNaN(r.endHour) || r.endHour < 0 || r.endHour > 23) r.endHour = def.endHour;
    return r;
  } catch (e) {
    return def;
  }
}

/* 保存行踪设置 */
function saveWhereaboutSettings(s) {
  Storage.set(WHEREABOUT_SETTINGS_KEY, s);
  // 修改设置后重置上次自动汇报时间，让新间隔立即生效（全局定时与页面链路分别重置）
  Storage.set(_autoReportKey(), 0);
  Storage.set(_pageAutoReportKey(), 0);
}

/* 渲染行踪设置页 */
function renderWhereaboutSettings() {
  var container = document.getElementById('whereabout-settings-body');
  if (!container) return;
  var s = getWhereaboutSettings();
  container.innerHTML = '<div class="letter-settings-body">'

    + '<div class="letter-settings-card">'
    + '<div class="letter-settings-row">'
    + '<div class="letter-settings-icon"><i class="fas fa-location-dot"></i></div>'
    + '<div class="letter-settings-info"><div class="letter-settings-label">对方行踪汇报</div><div class="letter-settings-desc">开启后 TA 会按时间自动在行踪汇报里报备行踪</div></div>'
    + '<label class="toggle-switch"><input type="checkbox" id="wa-settings-enabled"' + (s.enabled ? ' checked' : '') + ' onchange="updateWhereaboutEnabled(this)"><span class="toggle-slider"></span></label>'
    + '</div>'
    + '</div>'

    + '<div class="letter-settings-card">'
    + _whereaboutNumRow('fa-clock', '汇报间隔', '每隔多久汇报一次行踪', 'wa-settings-interval', s.intervalMin, '分钟')
    + _whereaboutNumRow('fa-sun', '每日汇报开始时间', '每天几点开始自动汇报', 'wa-settings-starthour', s.startHour, '点')
    + _whereaboutNumRow('fa-moon', '每日汇报结束时间', '每天几点停止自动汇报', 'wa-settings-endhour', s.endHour, '点')
    + '</div>'

    + '<div class="letter-settings-note"><i class="fas fa-info-circle"></i> 设置保存后立即生效，TA 会按你设定的节奏定期汇报行踪。</div>'
    + '</div>';
}

/* 数字输入行（无拉条，参照回信设置输入方式） */
function _whereaboutNumRow(icon, label, desc, prefix, value, suffix) {
  return '<div class="letter-settings-row">'
    + '<div class="letter-settings-icon"><i class="fas ' + icon + '"></i></div>'
    + '<div class="letter-settings-info"><div class="letter-settings-label">' + label + '</div><div class="letter-settings-desc">' + desc + '</div></div>'
    + '<div class="pace-input-wrap">'
    + '<input type="number" id="' + prefix + '-num" min="1" max="99999" inputmode="numeric" value="' + value + '" onchange="updateWhereaboutNum(\'' + prefix + '\')">'
    + '<span class="letter-cardcount-suffix">' + suffix + '</span>'
    + '</div>'
    + '</div>';
}

/* 开关：对方行踪汇报 */
function updateWhereaboutEnabled(el) {
  var s = getWhereaboutSettings();
  s.enabled = !!el.checked;
  saveWhereaboutSettings(s);
  Core.toast(s.enabled ? '已开启对方行踪汇报' : '已关闭对方行踪汇报');
}

/* 数字输入：保存对应字段，非法输入回退显示当前值 */
function updateWhereaboutNum(prefix) {
  var numEl = document.getElementById(prefix + '-num');
  if (!numEl) return;
  var num = parseInt(numEl.value, 10);
  var s = getWhereaboutSettings();
  var key, min, max, label;
  if (prefix === 'wa-settings-interval') {
    key = 'intervalMin'; min = 1; max = 99999; label = '汇报间隔';
  } else if (prefix === 'wa-settings-starthour') {
    key = 'startHour'; min = 0; max = 23; label = '开始时间';
  } else {
    key = 'endHour'; min = 0; max = 23; label = '结束时间';
  }
  if (!num || isNaN(num) || num < min || num > max) {
    Core.toast('请输入 ' + min + '~' + max + ' 之间的数字');
    numEl.value = s[key];
    return;
  }
  s[key] = num;
  saveWhereaboutSettings(s);
  Core.toast('行踪设置已保存');
}

/* ============================================================
   全局定时调度：参照时空信箱 startScheduler，
   setTimeout 链式每秒 tick，到点自动汇报（不限于行踪汇报页）
   ============================================================ */
var _whereaboutTimer = null;

function startWhereaboutScheduler() {
  if (_whereaboutTimer) return;
  _whereaboutTickLoop();
}

function stopWhereaboutScheduler() {
  if (_whereaboutTimer) {
    clearTimeout(_whereaboutTimer);
    _whereaboutTimer = null;
  }
}

function _whereaboutTickLoop() {
  _whereaboutTimer = setTimeout(function () {
    // 先排下一轮，避免回调异常导致调度中断
    _whereaboutTickLoop();
    try {
      _whereaboutAutoReportIfDue();
    } catch (e) {}
  }, _whereaboutNextDelay());
}

/* 性能优化第一批：睡到下一个整点（最多 3600s），到点检查时间窗；整点粒度与现有小时判断一致 */
function _whereaboutNextDelay() {
  var now = new Date();
  return (60 - now.getSeconds()) * 1000 + 1;
}

/* 判定是否到点自动汇报 */
function _whereaboutAutoReportIfDue() {
  var s = getWhereaboutSettings();
  if (!s.enabled) return;
  var now = new Date();
  var hour = now.getHours();
  // 每日汇报时间范围：开始 <= 当前 < 结束（跨天场景按开始<=结束处理）
  if (s.startHour <= s.endHour) {
    if (hour < s.startHour || hour >= s.endHour) return;
  } else {
    if (hour < s.startHour && hour >= s.endHour) return;
  }
  var last = Storage.get(_autoReportKey(), 0) || 0;
  if (now.getTime() - last < s.intervalMin * 60 * 1000) return;
  if (!_getWhereaboutSource().length) return;
  Storage.set(_autoReportKey(), now.getTime());
  reportWhereaboutByRole(true);
}

/* ===== 导出行踪设置相关函数到 window ===== */
window.renderWhereaboutSettings = renderWhereaboutSettings;
window.updateWhereaboutEnabled = updateWhereaboutEnabled;
window.updateWhereaboutNum = updateWhereaboutNum;
window.startWhereaboutScheduler = startWhereaboutScheduler;
window.stopWhereaboutScheduler = stopWhereaboutScheduler;
