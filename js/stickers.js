/* ===== 表情包库 (Stickers) ===== */

var currentStickerCategory = '';
var selectedStickerIds = [];

/* 渲染分组列表页 */
function renderWordCardStickers() {
  var container = document.getElementById('sticker-group-list');
  if (!container) return;
  selectedStickerIds = [];
  currentStickerCategory = '';

  Promise.all([
    Storage.getStickersAsync(),
    Storage.getStickerCategoriesAsync()
  ]).then(function(results) {
    var stickers = results[0];
    var categoryList = results[1];

    var groups = {}, cats = [];
    stickers.forEach(function(s) {
      var c = s.category || '默认分组';
      if (!groups[c]) { groups[c] = []; cats.push(c); }
      groups[c].push(s);
    });
    categoryList.forEach(function(c) {
      if (cats.indexOf(c) === -1) {
        cats.push(c);
        groups[c] = [];
      }
    });

    if (!cats.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">暂无表情包，点击右上角新增分组后上传吧</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < cats.length; i++) {
      var g = cats[i];
      var count = groups[g].length;
      var firstImg = '';
      for (var j = 0; j < groups[g].length; j++) {
        if (groups[g][j].data && groups[g][j].data.indexOf('data:image') === 0) {
          firstImg = '<img class="sticker-group-thumb" src="' + groups[g][j].data + '" alt="">';
          break;
        }
      }
      html += '<div class="group-item-wrapper">'
            + '<div class="discover-item" onclick="openStickerGroup(\'' + escapeHtml(g) + '\')">'
            + (firstImg ? firstImg : '<div class="discover-icon"><i class="fas fa-images"></i></div>')
            + '<div class="discover-info">'
            + '<div class="discover-title">' + escapeHtml(g) + '</div>'
            + '<div class="discover-desc">' + count + ' 张表情包</div>'
            + '</div>'
            + '<i class="fas fa-chevron-right discover-arrow"></i>'
            + '</div>'
            + '<div class="group-item-actions">'
            + '<button onclick="event.stopPropagation();renameStickerCategory(\'' + escapeAttr(g) + '\')" title="编辑分组名"><i class="fas fa-pen"></i></button>'
            + '<button class="danger" onclick="event.stopPropagation();deleteStickerCategory(\'' + escapeAttr(g) + '\')" title="删除分组"><i class="fas fa-trash-alt"></i></button>'
            + '</div></div>';
      if (i < cats.length - 1) html += '<div class="list-divider"></div>';
    }
    container.innerHTML = html;
  });
}

function openStickerGroup(category) {
  currentStickerCategory = category;
  Navigation.navigateTo('wordcard-stickers-group');
}

/* 渲染分组内容页（从 IndexedDB 读取） */
function renderWordCardStickersGroup() {
  var container = document.getElementById('sticker-grid-group');
  var titleEl = document.getElementById('sticker-group-title');
  if (!container) return;

  var group = currentStickerCategory || '';
  if (titleEl) titleEl.textContent = group;

  selectedStickerIds = [];
  updateStickerSelectionUI();

  Storage.getStickersAsync().then(function(stickers) {
    var filtered = stickers.filter(function(s) { return (s.category || '默认分组') === group; });
    if (!filtered.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">此分组暂无表情包</div>';
      return;
    }
    container.innerHTML = filtered.map(function(s) {
      var hasImg = s.data && s.data.indexOf('data:image') === 0;
      var blockedClass = s.blocked ? ' blocked' : '';
      if (hasImg) {
        return '<div class="sticker-item' + blockedClass + '" onclick="_toggleStickerSelected(' + s.id + ')" data-id="' + s.id + '"><img src="' + s.data + '" alt=""></div>';
      }
      return '<div class="sticker-item' + blockedClass + '" onclick="_toggleStickerSelected(' + s.id + ')" data-id="' + s.id + '"><i class="fas fa-image" style="font-size:32px;color:#ccc;"></i></div>';
    }).join('');
  });
}

function _toggleStickerSelected(id) {
  var pos = selectedStickerIds.indexOf(id);
  if (pos >= 0) { selectedStickerIds.splice(pos, 1); }
  else { selectedStickerIds.push(id); }
  var items = document.querySelectorAll('#sticker-grid-group .sticker-item');
  items.forEach(function(item) {
    var itemId = parseInt(item.getAttribute('data-id'));
    if (selectedStickerIds.indexOf(itemId) >= 0) { item.classList.add('selected'); }
    else { item.classList.remove('selected'); }
  });
  updateStickerSelectionUI();
}

function updateStickerSelectionUI() {
  var countEl = document.getElementById('sticker-selected-count');
  var btnCancel = document.getElementById('btn-sticker-cancel');
  var btnDelete = document.getElementById('btn-sticker-delete');
  var btnMove = document.getElementById('btn-sticker-move');
  var btnBlock = document.getElementById('btn-sticker-block');
  var hasSelection = selectedStickerIds.length > 0;

  if (countEl) {
    countEl.style.display = hasSelection ? '' : 'none';
    var strongEl = countEl.querySelector('strong');
    if (strongEl) strongEl.textContent = selectedStickerIds.length;
  }
  if (btnCancel) btnCancel.style.display = hasSelection ? '' : 'none';
  if (btnDelete) btnDelete.style.display = hasSelection ? '' : 'none';
  if (btnMove) btnMove.style.display = hasSelection ? '' : 'none';
  if (btnBlock) btnBlock.style.display = hasSelection ? '' : 'none';
}

function cancelStickerSelection() {
  selectedStickerIds = [];
  var items = document.querySelectorAll('#sticker-grid-group .sticker-item');
  items.forEach(function(item) { item.classList.remove('selected'); });
  updateStickerSelectionUI();
}

/* 屏蔽/取消屏蔽选中表情包 */
function toggleStickerBlock() {
  if (!selectedStickerIds.length) {
    Core.toast('请先选择表情包');
    return;
  }
  Storage.getStickersAsync().then(function(stickers) {
    /* 判断当前选中项中是否有未屏蔽的，有则执行屏蔽；否则全部取消屏蔽 */
    var anyUnblocked = false;
    stickers.forEach(function(s) {
      if (selectedStickerIds.indexOf(s.id) >= 0 && !s.blocked) anyUnblocked = true;
    });
    var newState = anyUnblocked;
    stickers.forEach(function(s) {
      if (selectedStickerIds.indexOf(s.id) >= 0) s.blocked = newState;
    });
    Storage.setStickersAsync(stickers).then(function() {
      var count = selectedStickerIds.length;
      selectedStickerIds = [];
      renderWordCardStickersGroup();
      Core.toast(newState ? '已屏蔽 ' + count + ' 张表情包' : '已取消屏蔽 ' + count + ' 张屏蔽');
    });
  });
}

/* 删除选中表情包（IndexedDB） */
function deleteSelectedStickers() {
  if (!selectedStickerIds.length) return;
  Core.dangerConfirm('删除表情包', '确定删除选中的 ' + selectedStickerIds.length + ' 张表情包吗？删除后不可恢复。', function() {
    var count = selectedStickerIds.length;
    StickerDB.deleteMany(selectedStickerIds).then(function() {
      selectedStickerIds = [];
      renderWordCardStickersGroup();
      Core.toast('已删除 ' + count + ' 张表情包');
    });
  });
}

function batchUploadStickers() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = function(e) {
    var files = e.target.files;
    if (!files || !files.length) {
      document.body.removeChild(input);
      return;
    }
    var group = currentStickerCategory || '默认分组';
    var newStickers = [];
    var loaded = 0;
    var total = files.length;

    function tryFinish() {
      loaded++;
      if (loaded >= total) {
        Storage.addStickersAsync(newStickers).then(function() {
          document.body.removeChild(input);
          renderWordCardStickersGroup();
          Core.toast('已添加 ' + newStickers.length + ' 张表情包到「' + group + '」');
        });
      }
    }

    for (var i = 0; i < files.length; i++) {
      (function(file) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          // 新增表情走新压缩链路（对标 ZY3）：GIF 动图原样保留不压缩，静态大图超阈值才压缩
          ChatMedia.compressSmart(ev.target.result, ChatMedia.OPT.stickerLib).then(function(compressed) {
            newStickers.push({ data: compressed, category: group, time: Date.now() });
            tryFinish();
          });
        };
        reader.onerror = function() { tryFinish(); };
        reader.readAsDataURL(file);
      })(files[i]);
    }
  };
  input.click();
}

function addStickerGroup() {
  Core.formModal('新增表情包分组', [
    { label: '分组名称', placeholder: '如"搞笑表情"' }
  ], function(values) {
    var name = values[0];
    if (!name) return;
    Promise.all([
      Storage.getStickerCategoriesAsync(),
      Storage.getStickersAsync()
    ]).then(function(results) {
      var cats = results[0];
      var stickers = results[1];
      var existsInCats = cats.indexOf(name) !== -1;
      var existsInStickers = stickers.some(function(s) { return (s.category || '默认分组') === name; });
      if (existsInCats || existsInStickers) {
        Core.toast('分组「' + name + '」已存在');
        return;
      }
      Storage.addStickerCategoryAsync(name).then(function() {
        renderWordCardStickers();
        Core.toast('分组「' + name + '」已创建');
      });
    });
  });
}

function renameStickerCategory(oldName) {
  Core.formModal('修改分组名称', [
    { label: '新分组名称', placeholder: '请输入新名称', value: oldName }
  ], function(values) {
    var newName = values[0];
    if (!newName || newName === oldName) return;
    Storage.getStickersAsync().then(function(stickers) {
      stickers.forEach(function(s) {
        if ((s.category || '默认分组') === oldName) s.category = newName;
      });
      Storage.setStickersAsync(stickers).then(function() {
        Storage.getStickerCategoriesAsync().then(function(cats) {
          var idx = cats.indexOf(oldName);
          if (idx >= 0) cats[idx] = newName;
          return StickerDB.replaceCategories(cats);
        }).then(function() {
          if (currentStickerCategory === oldName) currentStickerCategory = newName;
          renderWordCardStickers();
          Core.toast('分组已重命名');
        });
      });
    });
  });
}

function deleteStickerCategory(catName) {
  Storage.getStickersAsync().then(function(stickers) {
    var filtered = stickers.filter(function(s) { return (s.category || '默认分组') === catName; });
    var count = filtered.length;
    Core.confirm('删除分组', '确定删除分组「' + catName + '」及其下 ' + count + ' 张表情包？此操作不可撤销。', function() {
      var remaining = stickers.filter(function(s) { return (s.category || '默认分组') !== catName; });
      Storage.setStickersAsync(remaining).then(function() {
        Storage.getStickerCategoriesAsync().then(function(cats) {
          var idx = cats.indexOf(catName);
          if (idx >= 0) { cats.splice(idx, 1); return StickerDB.replaceCategories(cats); }
        }).then(function() {
          if (currentStickerCategory === catName) currentStickerCategory = '';
          renderWordCardStickers();
          Core.toast('分组已删除');
        });
      });
    });
  });
}

function moveStickersToGroup() {
  if (!selectedStickerIds.length) {
    Core.toast('请先选择表情包');
    return;
  }
  Promise.all([
    Storage.getStickersAsync(),
    Storage.getStickerCategoriesAsync()
  ]).then(function(results) {
    var stickers = results[0];
    var categoryList = results[1];
    var groups = {};
    stickers.forEach(function(s) {
      var c = s.category || '默认分组';
      if (!groups[c]) groups[c] = true;
    });
    categoryList.forEach(function(c) {
      if (!groups[c]) groups[c] = true;
    });
    var groupNames = Object.keys(groups);
    var currentGroup = currentStickerCategory || '默认分组';
    var targetGroups = groupNames.filter(function(g) { return g !== currentGroup; });

    if (!targetGroups.length) {
      Core.toast('没有其他分组可移动');
      return;
    }

    _closeStickerMovePicker();

    var overlay = document.createElement('div');
    overlay.className = 'move-group-picker-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) _closeStickerMovePicker(); };

    var itemsHtml = '';
    for (var i = 0; i < targetGroups.length; i++) {
      var g = targetGroups[i];
      itemsHtml += '<div class="move-group-picker-item" onclick="_doMoveStickers(\'' + escapeAttr(g) + '\')">'
                 + '<i class="fas fa-folder move-group-picker-icon"></i>'
                 + '<span class="move-group-picker-name">' + escapeHtml(g) + '</span>'
                 + '</div>';
    }

    overlay.innerHTML = '<div class="move-group-picker-panel" onclick="event.stopPropagation()">'
                      + '<div class="move-group-picker-title">移动表情包到分组</div>'
                      + '<div class="move-group-picker-list">' + itemsHtml + '</div>'
                      + '</div>';

    document.body.appendChild(overlay);
    window._moveStickersTemp = stickers;
  });
}

function _doMoveStickers(target) {
  var stickers = window._moveStickersTemp;
  stickers.forEach(function(s) {
    if (selectedStickerIds.indexOf(s.id) !== -1) {
      s.category = target;
    }
  });
  var count = selectedStickerIds.length;
  Storage.setStickersAsync(stickers).then(function() {
    selectedStickerIds = [];
    _closeStickerMovePicker();
    renderWordCardStickersGroup();
    Core.toast('已移动 ' + count + ' 张表情包到「' + target + '」');
  });
  window._moveStickersTemp = null;
}

function _closeStickerMovePicker() {
  var el = document.querySelector('.move-group-picker-overlay');
  if (el) el.remove();
}

function deduplicateAllStickers() {
  Storage.getStickersAsync().then(function(allStickers) {
    if (!allStickers.length) { Core.toast('暂无表情包'); return; }
    var seen = {}, deduped = [];
    allStickers.forEach(function(s) {
      if (s.data && !seen[s.data]) { seen[s.data] = true; deduped.push(s); }
    });
    var removed = allStickers.length - deduped.length;
    if (removed === 0) { Core.toast('未发现重复表情包'); return; }
    Core.confirm('全局去重', '发现 ' + removed + ' 张重复表情包，是否删除？', function() {
      Storage.setStickersAsync(deduped).then(function() {
        renderWordCardStickers();
        Core.toast('已删除 ' + removed + ' 张重复表情包');
      });
    });
  });
}

function exportStickerGroupJSON(category) {
  Storage.getStickersAsync().then(function(stickers) {
    var filtered = stickers.filter(function(s) { return (s.category || '默认分组') === category; });
    if (!filtered.length) { Core.toast('该分组暂无表情包可导出'); return; }
    var payload = { exportDate: new Date().toISOString(), type: 'stickers', category: category, stickers: filtered };
    var data = JSON.stringify(payload, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url;
    a.download = 'stickers_' + category + '_' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); URL.revokeObjectURL(url);
    Core.toast('已导出 ' + filtered.length + ' 张表情包');
  });
}

function exportAllStickersJSON() {
  Storage.getStickersAsync().then(function(stickers) {
    if (!stickers.length) { Core.toast('暂无表情包可导出'); return; }
    var groups = {};
    stickers.forEach(function(s) {
      var cat = s.category || '默认分组';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    var payload = { exportDate: new Date().toISOString(), type: 'stickers', groups: groups };
    var data = JSON.stringify(payload, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url;
    a.download = 'stickers_all_' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); URL.revokeObjectURL(url);
    var groupCount = Object.keys(groups).length;
    Core.toast('已导出 ' + stickers.length + ' 张表情包（' + groupCount + ' 个分组）');
  });
}

function deduplicateStickerGroup(category) {
  Storage.getStickersAsync().then(function(allStickers) {
    var groupItems = [];
    var nonGroupItems = [];
    allStickers.forEach(function(s) {
      if ((s.category || '默认分组') === category) { groupItems.push(s); }
      else { nonGroupItems.push(s); }
    });
    var seen = {}, deduped = [];
    groupItems.forEach(function(s) {
      if (s.data && !seen[s.data]) { seen[s.data] = true; deduped.push(s); }
    });
    var removed = groupItems.length - deduped.length;
    if (removed === 0) { Core.toast('未发现重复表情包'); return; }
    Core.confirm('去重表情包', '在「' + category + '」中发现 ' + removed + ' 张重复，是否删除？', function() {
      var merged = nonGroupItems.concat(deduped);
      Storage.setStickersAsync(merged).then(function() {
        renderWordCardStickersGroup();
        Core.toast('已删除 ' + removed + ' 张重复表情包');
      });
    });
  });
}

function importStickersJSON() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) { document.body.removeChild(input); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (data.type !== 'stickers') { Core.toast('文件格式不正确，需要 sticker 导出文件'); document.body.removeChild(input); return; }
        var incoming = [];
        if (data.stickers) {
          incoming = data.stickers;
        } else if (data.groups) {
          Object.keys(data.groups).forEach(function(cat) {
            data.groups[cat].forEach(function(s) { incoming.push(s); });
          });
        }
        if (!incoming.length) { Core.toast('文件中没有表情包数据'); document.body.removeChild(input); return; }
        Storage.addStickersAsync(incoming).then(function() {
          if (currentStickerCategory) { renderWordCardStickersGroup(); }
          else { renderWordCardStickers(); }
          Core.toast('已导入 ' + incoming.length + ' 张表情包');
        });
      } catch (err) { Core.toast('文件解析失败：' + err.message); }
      document.body.removeChild(input);
    };
    reader.onerror = function() { document.body.removeChild(input); };
    reader.readAsText(file);
  };
  input.click();
}

