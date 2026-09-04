/* ===================================================
   智能导入引擎 (Smart Import Engine)
   统一处理格言、留言、颜文字、Emoji 的导入，
   支持自动识别内容类型、跨类型分发、字卡格式兼容。
   =================================================== */

/** 根据分组名推断内容类型 */
function _inferGroupType(groupName) {
  var n = (groupName || '').toLowerCase();
  if (/颜文字|kaomoji|颜文|ｶｵﾓｼﾞ/.test(n)) return 'kaomojis';
  if (/拍一拍|pat|拍拍/.test(n)) return 'pats';
  if (/emoji|表情符号|em[ｏo]ji/.test(n) && !/表情包|表情图/.test(n)) return 'emojis';
  if (/格言|quote|名言|金句/.test(n)) return 'quotes';
  if (/留言|daily|语录/.test(n)) return 'dailyQuotes';
  return '';
}

/** 判断字符串是否疑似颜文字 */
function _isKaomojiText(str) {
  if (!str || str.length < 2) return false;
  if (/[\(\)\[\]\{\}´`¨^°ω・ﾟ￣▽▼△▲☆★◕⊙●○◉◎◈◇◆□■▷▶◀◁→←↑↓↗↘↙↖╮╭╯╰]/.test(str)) return true;
  return str.length >= 3 && /[^\u4e00-\u9fff\w\s\d]/.test(str);
}

/** 判断字符串是否疑似 Emoji */
function _isEmojiText(str) {
  if (!str || str.length > 3) return false;
  return /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}♠♣♥♦]/u.test(str);
}

/** 单条内容分类器：根据内容和分组类型提示，归入对应结果 */
/**
 * @param {*} item - 待分类条目
 * @param {string} groupType - 分组类型提示 ('kaomojis','emojis','quotes','dailyQuotes','')
 * @param {object} result - 结果收集对象
 * @param {string} [category] - 可选：分组名称（用于 groups 结构）
 */
function _classifyItem(item, groupType, result, category) {
  if (!item) return;
  var s = function(v) { return v ? String(v).trim() : ''; };

  if (typeof item === 'string') {
    var t = s(item); if (!t) return;
    if (groupType === 'kaomojis') result.kaomojis.push({text: t, category: category || '未分类'});
    else if (groupType === 'pats') result.pats.push({text: t, category: category || '未分类'});
    else if (groupType === 'emojis') result.emojis.push({char: t, name: '', category: category || '未分类'});
    else if (groupType === 'quotes') result.quotes.push(t);
    else if (groupType === 'dailyQuotes') result.dailyQuotes.push(t);
    else if (_isKaomojiText(t)) result.kaomojis.push({text: t, category: '未分类'});
    else if (_isEmojiText(t)) result.emojis.push({char: t, name: '', category: '未分类'});
    else result.quotes.push(t);
    return;
  }

  var text = s(item.text), ch = s(item.char);

  // 拍一拍新格式 {a, b}：对方动作 + 我方动作
  if (groupType === 'pats' && (item.a !== undefined || item.b !== undefined)) {
    result.pats.push({ a: s(item.a), b: s(item.b), category: item.category || category || '未分类' });
    return;
  }

  if (text && ch) {
    if (_isKaomojiText(text) && !_isEmojiText(ch))
      result.kaomojis.push({text: text, category: item.category || category || '未分类'});
    else
      result.emojis.push({char: ch, name: s(item.name||''), category: item.category || category || '未分类'});
  } else if (text) {
    if (groupType === 'kaomojis' || _isKaomojiText(text))
      result.kaomojis.push({text: text, category: item.category || category || '未分类'});
    else if (groupType === 'pats')
      result.pats.push({text: text, category: item.category || category || '未分类'});
    else if (groupType === 'quotes')
      result.quotes.push(text);
    else if (groupType === 'dailyQuotes')
      result.dailyQuotes.push(text);
    else
      result.quotes.push(text);
  } else if (ch) {
    if (groupType === 'emojis' || _isEmojiText(ch))
      result.emojis.push({char: ch, name: s(item.name||''), category: item.category || category || '未分类'});
    else
      result.emojis.push({char: ch, name: s(item.name||''), category: item.category || category || '未分类'});
  }
}

/** 内容类型检测器：分析 JSON 数据，自动识别并分类到各功能区 */
function _detectContentTypes(data, typeHint) {
  var result = { quotes: [], dailyQuotes: [], kaomojis: [], emojis: [], pats: [] };
  var hasDetected = false;

  // 第1层：具名键（最强信号）
  var namedKeys = [
    { key: 'quotes',       dest: 'quotes' },
    { key: 'dailyQuotes',  dest: 'dailyQuotes' },
    { key: 'kaomojis',     dest: 'kaomojis' },
    { key: 'emojis',       dest: 'emojis' },
    { key: 'pats',         dest: 'pats' }
  ];
  namedKeys.forEach(function(nk) {
    if (data[nk.key] && Array.isArray(data[nk.key])) {
      data[nk.key].forEach(function(item) { _classifyItem(item, nk.dest, result); });
      hasDetected = true;
    }
  });

  // 第2层：groups 分组结构
  if (data.groups && typeof data.groups === 'object' && !Array.isArray(data.groups)) {
    Object.keys(data.groups).forEach(function(gname) {
      var items = data.groups[gname];
      if (!Array.isArray(items)) return;
      var gt = _inferGroupType(gname);
      items.forEach(function(item) { _classifyItem(item, gt || typeHint, result, gname); });
    });
    hasDetected = true;
  }

  // 第3层：纯平铺数组
  if (!hasDetected && Array.isArray(data)) {
    data.forEach(function(item) { _classifyItem(item, typeHint || '', result); });
    hasDetected = true;
  }

  // 第4层：字卡格式 JSON 中夹杂的颜文字/Emoji 提取
  var extractFrom = data.cards || data.customReplies;
  if (extractFrom && Array.isArray(extractFrom)) {
    extractFrom.forEach(function(card) {
      if (!card) return;
      if (typeof card === 'string') _classifyItem(card, '', result);
      else if (card.text) _classifyItem(card.text, '', result);
    });
  }

  // 第5层：customReplyGroups 分组结构 [{id, name, color, disabled, items:[]}]
  if (data.customReplyGroups && Array.isArray(data.customReplyGroups)) {
    data.customReplyGroups.forEach(function(group) {
      if (!group || !Array.isArray(group.items)) return;
      var groupName = group.name || '';
      group.items.forEach(function(item) {
        if (!item) return;
        if (typeof item === 'string') _classifyItem(item, '', result);
        else if (item.text) _classifyItem(item.text, '', result);
      });
    });
    hasDetected = true;
  }

  // 第6层：mochi 分组字典  {kaomoji:[[组,[条目]]], emoji:[[组,[条目]]], poke:[[组,[条目]]]}
  [['kaomoji', 'kaomojis'], ['emoji', 'emojis'], ['poke', 'pats']].forEach(function(pair) {
    var srcKey = pair[0], dest = pair[1];
    var arr = data[srcKey];
    if (arr && Array.isArray(arr) && arr.length && Array.isArray(arr[0])) {
      arr.forEach(function(group) {
        if (!Array.isArray(group)) return;
        var gname = (typeof group[0] === 'string' && String(group[0]).trim())
          ? String(group[0]).trim() : '未分类';
        var items = Array.isArray(group[1]) ? group[1] : [];
        items.forEach(function(item) { _classifyItem(item, dest, result, gname); });
      });
      hasDetected = true;
    }
  });

  return result;
}

/** 智能通用导入入口：自动识别 JSON 内容并分发到各功能区 */
function _universalImportInput() {
  var el = document.getElementById('_sx_input_universal_import');
  if (el) return el;
  el = document.createElement('input');
  el.type = 'file';
  el.id = '_sx_input_universal_import';
  el.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;opacity:0;';
  document.body.appendChild(el);
  return el;
}

function importUniversalJSON(typeHint) {
  var input = _universalImportInput();
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    Storage.readFileAsUTF8(file).then(function(ev) {
      try {
        var data = JSON.parse(ev.text);
        var typed = _detectContentTypes(data, typeHint);

        var stats = {};
        var hasAny = false;

        // 格言
        if (typed.quotes.length) {
          hasAny = true;
          var existing = Storage.getQuotes();
          var existingSet = {}; existing.forEach(function(q) { existingSet[q] = true; });
          var deduped = typed.quotes.filter(function(q) { return !existingSet[q]; });
          stats.quotes = { imported: deduped.length, skipped: typed.quotes.length - deduped.length };
          if (deduped.length) { Storage.setQuotes(existing.concat(deduped)); renderQuotes(); }
        }

        // 留言
        if (typed.dailyQuotes.length) {
          hasAny = true;
          var existing = Storage.getDailyQuotes();
          var existingSet = {}; existing.forEach(function(q) { existingSet[q] = true; });
          var deduped = typed.dailyQuotes.filter(function(q) { return !existingSet[q]; });
          stats.dailyQuotes = { imported: deduped.length, skipped: typed.dailyQuotes.length - deduped.length };
          if (deduped.length) { Storage.setDailyQuotes(existing.concat(deduped)); renderDailyQuotes(); }
        }

        // 颜文字
        if (typed.kaomojis.length) {
          hasAny = true;
          var existing = Storage.getKaomojis();
          var existingSet = {}; existing.forEach(function(k) { existingSet[k.text] = true; });
          var deduped = typed.kaomojis.filter(function(i) { return !existingSet[i.text]; });
          stats.kaomojis = { imported: deduped.length, skipped: typed.kaomojis.length - deduped.length };
          if (deduped.length) { Storage.setKaomojis(existing.concat(deduped)); renderWordCardKaomoji(); }
        }

        // Emoji
        if (typed.emojis.length) {
          hasAny = true;
          var existing = Storage.getEmojis();
          var existingSet = {}; existing.forEach(function(e) { existingSet[e.char] = true; });
          var deduped = typed.emojis.filter(function(i) { return !existingSet[i.char]; });
          stats.emojis = { imported: deduped.length, skipped: typed.emojis.length - deduped.length };
          if (deduped.length) { Storage.setEmojis(existing.concat(deduped)); renderWordCardEmoji(); }
        }

        // 拍一拍
        if (typed.pats.length) {
          hasAny = true;
          var existing = Storage.getPats();
          var existingSet = {}; existing.forEach(function(p) {
            var pp = _splitPatTemplate(p.text);
            var pa = (p.a !== undefined && p.a !== null) ? p.a : pp.a;
            var pb = (p.b !== undefined && p.b !== null) ? p.b : pp.b;
            existingSet[pa + '\u0001' + pb] = true;
          });
          var deduped = typed.pats.filter(function(i) {
            var key = (i.a !== undefined && i.a !== null ? i.a : '') + '\u0001' + (i.b !== undefined && i.b !== null ? i.b : '');
            return !existingSet[key];
          });
          stats.pats = { imported: deduped.length, skipped: typed.pats.length - deduped.length };
          if (deduped.length) { Storage.setPats(existing.concat(deduped)); renderWordCardPat(); }
        }

        if (!hasAny) { Core.toast('未识别到可导入的内容'); return; }

        var names = { quotes: '格言', dailyQuotes: '留言', kaomojis: '颜文字', emojis: 'Emoji', pats: '拍一拍' };
        var parts = [];
        ['quotes', 'dailyQuotes', 'kaomojis', 'emojis', 'pats'].forEach(function(t) {
          if (stats[t] && stats[t].imported > 0) {
            var part = names[t] + ' ' + stats[t].imported + ' 条';
            if (stats[t].skipped > 0) part += '(跳过' + stats[t].skipped + ')';
            parts.push(part);
          }
        });
        Core.toast('导入完成：' + parts.join('，'));
      } catch(err) { Core.toast('解析失败: ' + err.message); }
    }).catch(function(err) { Core.toast('读取文件失败: ' + (err && err.message || err)); });
  };
  input.value = '';
  input.click();
}

function importKaomojiJSON() { importUniversalJSON('kaomojis'); }
function exportKaomojiJSON() {
  var kaomojis = Storage.getKaomojis();
  if (!kaomojis.length) { Core.toast('暂无颜文字可导出'); return; }
  var groups = {};
  kaomojis.forEach(function(k) {
    var cat = k.category || '未分类';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ text: k.text });
  });
  var payload = { exportDate: new Date().toISOString(), type: 'kaomojis', groups: groups };
  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url;
  a.download = 'kaomojis_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  var groupCount = Object.keys(groups).length;
  Core.toast('已导出 ' + kaomojis.length + ' 条颜文字（' + groupCount + ' 个分组）');
}
function deduplicateKaomojis() {
  var kaomojis = Storage.getKaomojis();
  var seen = {}, deduped = [];
  kaomojis.forEach(function(k) { if (!seen[k.text]) { seen[k.text] = true; deduped.push(k); } });
  var removed = kaomojis.length - deduped.length;
  if (removed === 0) { Core.toast('未发现重复颜文字'); return; }
  Core.confirm('去重颜文字', '发现 ' + removed + ' 条重复，是否删除？', function() {
    Storage.setKaomojis(deduped);
    renderWordCardKaomoji();
    Core.toast('已删除 ' + removed + ' 条重复颜文字');
  });
}

// ===== Emoji =====
function renderWordCardEmoji() {
  var container = document.getElementById('emoji-group-list');
  if (!container) return;
  window._emojiSelectedIds = [];
  window._emojiCurrentGroup = '';

  var emojis = Storage.getEmojis();
  if (!emojis.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">暂无 Emoji</div>';
    return;
  }

  var groups = {}, cats = [];
  emojis.forEach(function(e) {
    var c = e.category || '未分类';
    if (!groups[c]) { groups[c] = []; cats.push(c); }
    groups[c].push(e);
  });

  // 按保存的分组排序渲染，删除 emoji 不会改变分组顺序
  var order = Storage.getEmojiGroupOrder ? Storage.getEmojiGroupOrder() : [];
  var sortedCats = [];
  (order || []).forEach(function(c) {
    if (cats.indexOf(c) >= 0 && sortedCats.indexOf(c) < 0) { sortedCats.push(c); }
  });
  cats.forEach(function(c) {
    if (sortedCats.indexOf(c) < 0) { sortedCats.push(c); }
  });
  cats = sortedCats;

  var html = '';
  for (var i = 0; i < cats.length; i++) {
    var g = cats[i];
    var count = groups[g].length;
    html += '<div class="group-item-wrapper">'
          + '<div class="discover-item" onclick="openEmojiGroup(\'' + escapeHtml(g) + '\')">'
          + '<div class="discover-icon"><i class="fas fa-face-smile"></i></div>'
          + '<div class="discover-info">'
          + '<div class="discover-title">' + escapeHtml(g) + '</div>'
          + '<div class="discover-desc">' + count + ' 个 Emoji</div>'
          + '</div>'
          + '<i class="fas fa-chevron-right discover-arrow"></i>'
          + '</div>'
          + '<div class="group-item-actions">'
          + '<button onclick="event.stopPropagation();moveEmojiGroup(\'' + escapeHtml(g) + '\', -1)" title="上移分组"><i class="fas fa-arrow-up"></i></button>'
          + '<button onclick="event.stopPropagation();moveEmojiGroup(\'' + escapeHtml(g) + '\', 1)" title="下移分组"><i class="fas fa-arrow-down"></i></button>'
          + '</div></div>';
    if (i < cats.length - 1) html += '<div class="list-divider"></div>';
  }
  container.innerHTML = html;
}

/* Emoji 分组排序：上移/下移，顺序持久化到 Storage，聊天面板同步生效 */
function moveEmojiGroup(name, dir) {
  var order = Storage.getEmojiGroupOrder ? Storage.getEmojiGroupOrder() : [];
  var emojis = Storage.getEmojis();
  var cats = [], found = {};
  emojis.forEach(function(e) {
    var c = e.category || '未分类';
    if (!found[c]) { found[c] = true; cats.push(c); }
  });
  var allCats = (order || []).filter(function(c) { return cats.indexOf(c) >= 0; });
  cats.forEach(function(c) { if (allCats.indexOf(c) < 0) { allCats.push(c); } });
  var pos = allCats.indexOf(name);
  var target = pos + dir;
  if (pos < 0 || target < 0 || target >= allCats.length) { Core.toast('已在最' + (dir < 0 ? '前' : '后') + '面'); return; }
  allCats.splice(pos, 1);
  allCats.splice(target, 0, name);
  Storage.setEmojiGroupOrder(allCats);
  renderWordCardEmoji();
  Core.toast('分组顺序已更新');
}

function openEmojiGroup(name) {
  window._emojiCurrentGroup = name;
  Navigation.navigateTo('wordcard-emoji-group');
}

function renderWordCardEmojiGroup() {
  var container = document.getElementById('emoji-grid-group');
  var titleEl = document.getElementById('emoji-group-title');
  if (!container) return;

  var group = window._emojiCurrentGroup || '';
  if (titleEl) titleEl.textContent = group;

  window._emojiSelectedIds = [];
  window._emojiSelectionMode = false;
  updateEmojiSelectionUI();

  var emojis = Storage.getEmojis().filter(function(e) { return (e.category || '未分类') === group; });
  container.innerHTML = emojis.map(function(e, i) {
    return '<div class="emoji-item" onclick="onEmojiClick(\'' + e.char.replace(/'/g, "\\'") + '\', ' + i + ')" title="' + (e.name || '') + '" data-index="' + i + '">' + e.char + '</div>';
  }).join('') || '<div style="padding:40px;text-align:center;color:var(--text-lighter)">此分组暂无 Emoji</div>';
}

function onEmojiClick(char, index) {
  if (window._emojiSelectionMode) {
    toggleEmojiSelection(index);
    return;
  }
  copyEmoji(char);
}

function toggleEmojiSelection(index) {
  var sel = window._emojiSelectedIds;
  var pos = sel.indexOf(index);
  if (pos >= 0) { sel.splice(pos, 1); }
  else { sel.push(index); }
  var items = document.querySelectorAll('#emoji-grid-group .emoji-item');
  items.forEach(function(item) {
    var idx = parseInt(item.getAttribute('data-index'));
    if (sel.indexOf(idx) >= 0) { item.classList.add('card-list-selected'); }
    else { item.classList.remove('card-list-selected'); }
  });
  updateEmojiSelectionUI();
}

function updateEmojiSelectionUI() {
  var btnDelete = document.getElementById('btn-delete-emojis');
  if (btnDelete) {
    btnDelete.style.display = (window._emojiSelectionMode && window._emojiSelectedIds.length > 0) ? '' : 'none';
  }
}

function selectEmojisInGroup() {
  window._emojiSelectionMode = !window._emojiSelectionMode;
  window._emojiSelectedIds = [];
  var items = document.querySelectorAll('#emoji-grid-group .emoji-item');
  items.forEach(function(item) { item.classList.remove('card-list-selected'); });
  updateEmojiSelectionUI();
  Core.toast(window._emojiSelectionMode ? '选择模式已开启，点击 Emoji 选择' : '选择模式已关闭');
}

function deleteSelectedEmojis() {
  var sel = window._emojiSelectedIds;
  if (!sel.length) return;
  Core.confirm('删除 Emoji', '确定删除选中的 ' + sel.length + ' 个 Emoji 吗？', function() {
    var group = window._emojiCurrentGroup || '';
    var allEmojis = Storage.getEmojis();
    // 直接在原数组上按「组内下标」过滤删除，保持其余 emoji 与分组顺序不变
    var selSet = {};
    sel.forEach(function(i) { selSet[i] = true; });
    var gi = 0;
    var newEmojis = allEmojis.filter(function(e) {
      if ((e.category || '未分类') === group) {
        var keep = !selSet[gi];
        gi++;
        return keep;
      }
      return true;
    });
    Storage.setEmojis(newEmojis);
    window._emojiSelectedIds = [];
    window._emojiSelectionMode = false;
    renderWordCardEmojiGroup();
    Core.toast('已删除 ' + sel.length + ' 个 Emoji');
  });
}

function addEmoji() {
  Core.formModal('添加 Emoji', [
    { label: 'Emoji 字符', placeholder: '可直接粘贴' },
    { label: '名称/描述', placeholder: '如"微笑"' },
    { label: '分组名', placeholder: '留空则为"未分类"' }
  ], function(values) {
    var char = values[0];
    if (!char) return;
    var name = values[1] || '';
    var category = values[2] || '未分类';
    var emojis = Storage.getEmojis();
    emojis.push({ char: char.trim(), name: name.trim(), category: category });
    Storage.setEmojis(emojis);
    renderWordCardEmoji();
    Core.toast('Emoji 已添加');
  });
}

function addEmojiToGroup() {
  var group = window._emojiCurrentGroup || '未分类';
  Core.formModal('添加 Emoji 到「' + group + '」', [
    { label: 'Emoji 字符', placeholder: '可直接粘贴' },
    { label: '名称/描述', placeholder: '如"微笑"' }
  ], function(values) {
    var char = values[0];
    if (!char) return;
    var name = values[1] || '';
    var emojis = Storage.getEmojis();
    emojis.push({ char: char.trim(), name: name.trim(), category: group });
    Storage.setEmojis(emojis);
    renderWordCardEmojiGroup();
    Core.toast('Emoji 已添加');
  });
}

function importEmojiJSON() { importUniversalJSON('emojis'); }
function exportEmojiJSON() {
  var emojis = Storage.getEmojis();
  if (!emojis.length) { Core.toast('暂无 Emoji 可导出'); return; }
  var groups = {};
  emojis.forEach(function(e) {
    var cat = e.category || '未分类';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ char: e.char, name: e.name || '' });
  });
  var payload = { exportDate: new Date().toISOString(), type: 'emojis', groups: groups };
  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url;
  a.download = 'emojis_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  var groupCount = Object.keys(groups).length;
  Core.toast('已导出 ' + emojis.length + ' 个 Emoji（' + groupCount + ' 个分组）');
}
function deduplicateEmojis() {
  var emojis = Storage.getEmojis();
  var seen = {}, deduped = [];
  emojis.forEach(function(e) { if (!seen[e.char]) { seen[e.char] = true; deduped.push(e); } });
  var removed = emojis.length - deduped.length;
  if (removed === 0) { Core.toast('未发现重复 Emoji'); return; }
  Core.confirm('去重 Emoji', '发现 ' + removed + ' 个重复，是否删除？', function() {
    Storage.setEmojis(deduped);
    renderWordCardEmoji();
    Core.toast('已删除 ' + removed + ' 个重复 Emoji');
  });
}


