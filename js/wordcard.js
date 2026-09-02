/* === 字卡入口页（纯导航，无渲染逻辑） === */

function renderWordCards() {
  // 优先按当前导航页分发：index.html 中所有页面容器同时存在于 DOM，仅按 id 判断
  // 会永远命中分组列表容器，导致分组详情页点击进入/数据恢复后不刷新，甚至清空当前分组。
  var p = (window.Navigation && Navigation.currentPage) || '';
  if (window.renderWordCardMainGroup && (p === 'wordcard-main-group')) {
    renderWordCardMainGroup();
    return;
  }
  if (window.renderWordCardMain && (p === 'wordcard-main')) {
    renderWordCardMain();
    return;
  }
  if (window.renderWordCardVoiceGroup && (p === 'wordcard-voice-group')) {
    renderWordCardVoiceGroup();
    return;
  }
  if (window.renderWordCardVoice && (p === 'wordcard-voice')) {
    renderWordCardVoice();
    return;
  }
  // 兜底：无导航上下文时退化为按容器存在性判断（保持旧逻辑）
  var g = document.getElementById('wordcard-group-list');
  if (g) { renderWordCardMain(); return; }
  var c = document.getElementById('card-grid-group');
  if (c) { renderWordCardMainGroup(); }
}

function copyCardText(text) {
  navigator.clipboard.writeText(text).then(() => {
    Core.toast('已复制: ' + text);
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    Core.toast('已复制');
  });
}

function copyEmoji(char) {
  copyCardText(char);
}

function _cardImportInput() {
  var el = document.getElementById('_sx_input_card_import');
  if (el) return el;
  el = document.createElement('input');
  el.type = 'file';
  el.id = '_sx_input_card_import';
  el.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;opacity:0;';
  document.body.appendChild(el);
  return el;
}

function importCardsJSON() {
  var input = _cardImportInput();
  input.accept = '.json,.txt,.docx';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'json') {
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          var cards = [];
          // 格式1：简单数组 [{text, source?, category?}]
          if (Array.isArray(data)) {
            cards = data;
          }
          // 格式2：含 cards 字段 {cards: [...]}
          else if (data.cards && Array.isArray(data.cards)) {
            cards = data.cards;
          }
          // 格式3：按分组聚合 {groups: {"分组名": [{text, source}, ...]}}
          else if (data.groups && typeof data.groups === 'object') {
            Object.keys(data.groups).forEach(function(gname) {
              var items = data.groups[gname];
              if (Array.isArray(items)) {
                items.forEach(function(item) {
                  if (item && typeof item === 'string' && item.trim()) {
                    cards.push({ text: item.trim(), source: '导入', category: gname });
                  } else if (item && item.text && typeof item.text === 'string') {
                    cards.push({ text: item.text, source: item.source || '导入', category: gname });
                  }
                });
              }
            });
          }
          // 格式4：「880条整理分类版本」{customReplies, customReplyGroups, ...}
          else if (data.customReplies && data.customReplyGroups) {
            // 构建分组名到 items 的映射
            function _extractItemText(it) {
              if (it && typeof it === 'string') return it;
              if (it && typeof it === 'object') {
                var t = it.text || it.reply || it.content;
                if (t && typeof t === 'string') return t;
              }
              return '';
            }
            var groupMap = {};
            data.customReplyGroups.forEach(function(g) {
              if (g.items && g.items.length) {
                groupMap[g.name] = g.items;
              }
            });
            // 从 customReplies 导入，按分组归类
            var groupNames = Object.keys(groupMap);
            // 先处理有分组的
            groupNames.forEach(function(gname) {
              var items = groupMap[gname];
              items.forEach(function(text) {
                var t = _extractItemText(text);
                if (t) {
                  cards.push({ text: t, source: '导入', category: gname });
                }
              });
            });
            // 再处理 customReplies 中未被分组覆盖的
            if (Array.isArray(data.customReplies)) {
              var covered = {};
              groupNames.forEach(function(gname) {
                var items = groupMap[gname];
                items.forEach(function(text) {
                  var t = _extractItemText(text);
                  if (t) covered[t] = true;
                });
              });
              data.customReplies.forEach(function(text) {
                var t = _extractItemText(text);
                if (t && !covered[t]) {
                  cards.push({ text: t, source: '导入', category: '' });
                }
              });
            }
          } else {
            Core.toast('JSON 格式不支持：需要数组、{cards:[...]} 或含 customReplies/customReplyGroups 的对象');
            return;
          }

          doImport(cards);
        } catch (err) {
          Core.toast('JSON 解析失败: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'txt') {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var lines = ev.target.result.split(/[\r\n]+/).filter(function(l) { return l.trim(); });
        var cards = lines.map(function(text) {
          return { text: text, source: '导入', category: '' };
        });
        doImport(cards);
      };
      reader.readAsText(file);
    } else if (ext === 'docx') {
      // 对于 docx，需要调用后端解析；简化处理：用 FileReader 读为文本（前端无法直接解析 docx）
      // 这里通过 read_file 工具由后端解析，但前端环境受限；
      // 改为提示用户先用工具转换，或直接读取为 text（会包含二进制乱码）
      // 实际方案：告知用户 docx 格式需先转为 txt/json，此处做基础尝试
      Core.toast('DOCX 格式暂需手动转为 TXT 或 JSON 后导入，目前仅支持 JSON 和 TXT 格式');
      return;
    }

    function doImport(cards) {
      // 规范化：兼容纯字符串元素及 {text} / {reply} / {content} 等对象形态，保证各类 json 都能正确入库
      cards = (cards || []).map(function(c) {
        if (c && typeof c === 'string') return { text: c };
        if (c && typeof c === 'object') {
          var t = c.text || c.reply || c.content;
          return { text: t || '', source: c.source || '导入', category: c.category || c.group || '' };
        }
        return c;
      });
      var imported = cards.filter(function(c) {
        return c && c.text && typeof c.text === 'string' && c.text.trim();
      }).map(function(c, i) {
        return {
          id: 'import_' + Date.now() + '_' + i,
          text: c.text.trim(),
          source: c.source || '导入',
          category: c.category || ''
        };
      });

      if (imported.length === 0) {
        Core.toast('没有找到有效字卡数据');
        return;
      }

      // 全局去重：过滤已在字卡库中存在的相同内容
      var existing = Storage.getCards();
      var existingTexts = {};
      for (var i = 0; i < existing.length; i++) {
        existingTexts[existing[i].text] = true;
      }
      var deduplicated = imported.filter(function(c) {
        return !existingTexts[c.text];
      });
      var skipped = imported.length - deduplicated.length;

      if (deduplicated.length === 0) {
        Core.toast('导入的字卡内容均已存在，无需导入');
        return;
      }

      Storage.setCards(existing.concat(deduplicated));
      renderWordCards();
      // 若当前正在某分组详情页，同步刷新该分组卡片视图，避免「导入成功但当前页看不到新卡」
      if (window._wordCardCurrentGroup && window.renderWordCardMainGroup) {
        window.renderWordCardMainGroup(window._wordCardCurrentGroup);
      }
      var msg = '成功导入 ' + deduplicated.length + ' 张字卡';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 条重复';
      Core.toast(msg);
    }
  };
  input.value = '';
  input.click();
}

/* === 字卡子页面渲染函数 === */

// 格言
function renderWordCardQuotes() {
  if (window.renderQuotes) window.renderQuotes();
}

// ===== 主字卡 =====

window._wordCardCurrentGroup = '';
window._wordCardSelectedIds = [];
window._wordCardSelectionMode = false;

/* 获取所有分组及卡片数 */
function getWordCardGroups() {
  var cards = Storage.getCards();
  var groups = {};
  cards.forEach(function(c) {
    var cat = c.category || '未分类';
    if (!groups[cat]) groups[cat] = 0;
    groups[cat]++;
  });
  var list = [];
  for (var name in groups) {
    list.push({ name: name, count: groups[name] });
  }
  return list;
}

/* 入口页：分组列表 */
function renderWordCardMain() {
  var container = document.getElementById('wordcard-group-list');
  if (!container) return;

  window._wordCardSelectedIds = [];
  window._wordCardCurrentGroup = '';

  var groups = getWordCardGroups();
  if (!groups.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">暂无分组</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    var icon = getGroupIcon(g.name);
    html += '<div class="group-item-wrapper">'
          + '<div class="discover-item" onclick="openWordCardGroup(\'' + escapeAttr(g.name) + '\')">'
          + '<div class="discover-icon"><i class="' + icon + '"></i></div>'
          + '<div class="discover-info">'
          + '<div class="discover-title">' + escapeHtml(g.name) + '</div>'
          + '<div class="discover-desc">' + g.count + ' 张字卡</div>'
          + '</div>'
          + '<i class="fas fa-chevron-right discover-arrow"></i>'
          + '</div>'
          + '<div class="group-item-actions">'
          + '<button onclick="event.stopPropagation();editWordCardGroupName(\'' + escapeAttr(g.name) + '\')" title="编辑分组名"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="event.stopPropagation();deleteWordCardGroupItem(\'' + escapeAttr(g.name) + '\')" title="删除分组"><i class="fas fa-trash-alt"></i></button>'
          + '</div></div>';
    if (i < groups.length - 1) html += '<div class="list-divider"></div>';
  }
  container.innerHTML = html;
}

function getGroupIcon(name) {
  if (name === '诗词') return 'fas fa-feather-alt';
  if (name === '名言') return 'fas fa-quote-right';
  if (name === '自创') return 'fas fa-pen-fancy';
  if (name === '情话') return 'fas fa-heart';
  if (name === '歌词') return 'fas fa-music';
  return 'fas fa-folder';
}

/* 搜索字卡（主字卡入口页工具栏搜索框） */
function searchWordCards() {
  var input = document.getElementById('wordcard-search-input');
  var clearBtn = document.getElementById('wordcard-search-clear');
  var query = (input.value || '').trim().toLowerCase();

  clearBtn.style.display = query ? '' : 'none';

  if (!query) {
    renderWordCardMain();
    return;
  }

  var container = document.getElementById('wordcard-group-list');
  if (!container) return;

  var cards = Storage.getCards();
  var matched = cards.filter(function(c) { return (c.text || '').toLowerCase().indexOf(query) !== -1; });

  if (!matched.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter);font-size:0.8rem;">未找到包含 "' + escapeHtml(input.value) + '" 的字卡</div>';
    return;
  }

  // 按 category 分组
  var groupMap = {};
  matched.forEach(function(c) {
    var cat = c.category || '未分类';
    if (!groupMap[cat]) groupMap[cat] = [];
    groupMap[cat].push(c);
  });

  var groupNames = Object.keys(groupMap);
  var html = '';
  for (var i = 0; i < groupNames.length; i++) {
    var name = groupNames[i];
    var cardsInGroup = groupMap[name];
    var icon = getGroupIcon(name);
    html += '<div class="search-group-bar" onclick="toggleSearchGroup(this)">'
          + '<i class="' + icon + ' search-group-bar-icon"></i>'
          + '<div class="search-group-bar-info">'
          + '<div class="search-group-bar-title">' + escapeHtml(name) + '</div>'
          + '<div class="search-group-bar-count">' + cardsInGroup.length + ' 张匹配</div>'
          + '</div>'
          + '<i class="fas fa-chevron-down search-group-bar-arrow"></i>'
          + '</div>'
          + '<div class="search-group-cards">';
    cardsInGroup.forEach(function(c) {
      html += '<div class="search-card-item">'
            + '<div class="search-card-text">' + highlightMatch(escapeHtml(c.text), query) + '</div>'
            + '<div class="search-card-actions" onclick="event.stopPropagation()">'
            + '<button onclick="editSearchCard(\'' + escapeAttr(c.id) + '\')" title="编辑"><i class="fas fa-pen"></i></button>'
            + '<button class="danger" onclick="deleteSearchCardItem(\'' + escapeAttr(c.id) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
            + '</div>'
            + '</div>';
    });
    html += '</div>';
  }
  container.innerHTML = html;
}

/* 切换搜索分组展开/折叠 */
function toggleSearchGroup(bar) {
  bar.classList.toggle('expanded');
  var cards = bar.nextElementSibling;
  if (cards) cards.classList.toggle('expanded');
}

/* 搜索结果中编辑字卡 */
function editSearchCard(cardId) {
  var cards = Storage.getCards();
  var card = null;
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].id === cardId) { card = cards[i]; break; }
  }
  if (!card) return;
  Core.formModal('编辑字卡', [
    { label: '字卡内容', placeholder: '请输入字卡文字', value: card.text },
    { label: '来源（可选）', placeholder: '如"论语"', value: card.source || '' }
  ], function(values) {
    card.text = values[0].trim();
    card.source = values[1].trim();
    Storage.setCards(cards);
    searchWordCards();
    Core.toast('字卡已更新');
  });
}

/* 搜索结果中删除字卡 */
function deleteSearchCardItem(cardId) {
  Core.confirm('删除字卡', '确定删除这张字卡吗？', function() {
    var cards = Storage.getCards();
    Storage.setCards(cards.filter(function(c) { return c.id !== cardId; }));
    searchWordCards();
    Core.toast('字卡已删除');
  });
}

/* 清除搜索 */
function clearWordCardSearch() {
  var input = document.getElementById('wordcard-search-input');
  input.value = '';
  input.focus();
  searchWordCards();
}

/* 搜索关键词高亮 */
function highlightMatch(text, query) {
  var lower = text.toLowerCase();
  var idx = lower.indexOf(query);
  if (idx === -1) return text;
  var result = '';
  var last = 0;
  while (idx !== -1) {
    result += text.substring(last, idx) + '<mark class="search-highlight">' + text.substring(idx, idx + query.length) + '</mark>';
    last = idx + query.length;
    idx = lower.indexOf(query, last);
  }
  result += text.substring(last);
  return result;
}

function openWordCardGroup(name) {
  window._wordCardCurrentGroup = name;
  Navigation.navigateTo('wordcard-main-group');
}

/* 分组子页 */
function renderWordCardMainGroup() {
  var container = document.getElementById('card-grid-group');
  var titleEl = document.getElementById('wordcard-group-title');
  if (!container) return;

  var group = window._wordCardCurrentGroup || '';
  if (titleEl) titleEl.textContent = group;

  var cards = Storage.getCards().filter(function(c) { return (c.category || '未分类') === group; });
  container.innerHTML = renderCardList(cards);

  // sync select-all button visibility
  var btnSelectAll = document.getElementById('btn-select-all');
  if (btnSelectAll) {
    btnSelectAll.style.display = window._wordCardSelectionMode ? '' : 'none';
  }
  var btnBlockCards = document.getElementById('btn-block-cards');
  if (btnBlockCards) {
    btnBlockCards.style.display = window._wordCardSelectionMode ? '' : 'none';
  }
}

/* ===== 我的收藏页 ===== */
var FAVORITE_CATEGORIES = [
  { key: 'text', label: '文本', icon: 'fas fa-font' },
  { key: 'image', label: '图片', icon: 'fas fa-image' },
  { key: 'doodle', label: '涂鸦', icon: 'fas fa-pen-nib' },
  { key: 'gift', label: '购物', icon: 'fas fa-store' },
  { key: 'pat', label: '拍一拍', icon: 'fas fa-hand-pointer' },
  { key: 'blacknotice', label: '黑屋通知', icon: 'fas fa-bell-slash' },
  { key: 'decision', label: '决策卡', icon: 'fas fa-clipboard-check' },
  { key: 'other', label: '其他', icon: 'fas fa-folder' }
];

function renderFavorites() {
  var container = document.getElementById('favorites-list');
  if (!container) return;
  var favorites = Storage.getFavorites();
  if (!favorites.length) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-lighter)">'
      + '<i class="fas fa-star" style="font-size:2rem;opacity:0.4;display:block;margin-bottom:12px"></i>'
      + '还没有收藏任何消息<br>在聊天中长按消息即可收藏</div>';
    return;
  }
  var html = '';
  FAVORITE_CATEGORIES.forEach(function(cat) {
    var items = favorites.filter(function(f) { return f.category === cat.key; });
    if (!items.length) return;
    html += '<div class="favorites-group">'
      + '<div class="favorites-group-title"><i class="' + cat.icon + '"></i> ' + cat.label
      + '<span class="favorites-group-count">' + items.length + '</span></div>';
    items.forEach(function(fav) {
      html += _favoriteItemHtml(fav);
    });
    html += '</div>';
  });
  container.innerHTML = html;
  // 异步还原收藏中 IndexedDB 引用的大图/大表情（引用渲染为占位图后在此填充真实数据）
  ChatMedia.resolveDomRefs(container);
}

function _favoriteItemHtml(fav, readonly) {
  var contentHtml = '';
  if (fav.category === 'gift' && fav.giftData) {
    // 商城购物卡片收藏：还原商品名称、图标、价格与赠言
    var g = fav.giftData;
    contentHtml = '<div class="favorite-gift">'
      + '<div class="favorite-gift-head">'
      + '<span class="favorite-gift-icon">' + (g.icon || '🎁') + '</span>'
      + '<span class="favorite-gift-name">' + Core.escapeHtml(g.name || '神秘礼物') + '</span>'
      + '</div>'
      + (g.greeting ? '<div class="favorite-gift-greeting">' + Core.escapeHtml(g.greeting) + '</div>' : '')
      + '<div class="favorite-gift-foot">'
      + '<span class="favorite-gift-tag"><i class="fas fa-store"></i> 拾心商城</span>'
      + '<span class="favorite-gift-price">¥' + (g.price || 0) + '</span>'
      + '</div>'
      + '</div>';
  } else if (fav.category === 'decision' && fav.decisionData) {
    // 决策卡收藏：还原问题、选项与对方勾选答案
    var d = fav.decisionData;
    var optHtml = '';
    (d.options || []).forEach(function(o, idx) {
      var pickedNames = [];
      (d.answers || []).forEach(function(a) {
        if (d.result && d.result[a.memberId] === idx) pickedNames.push(a.memberName || '对方');
      });
      var picked = pickedNames.length ? ' picked' : '';
      var votes = pickedNames.length ? pickedNames.join('、') : '';
      optHtml += '<div class="favorite-decision-opt' + picked + '">'
        + '<span class="favorite-decision-tag">' + (idx + 1) + '</span>'
        + '<span class="favorite-decision-text">' + Core.escapeHtml(o) + '</span>'
        + (votes ? '<span class="favorite-decision-votes">' + Core.escapeHtml(votes) + '</span>' : '')
        + '</div>';
    });
    contentHtml = '<div class="favorite-decision">'
      + '<div class="favorite-decision-head"><i class="fas fa-scale-balanced"></i>帮我抉择</div>'
      + '<div class="favorite-decision-question">' + Core.escapeHtml(d.question || '') + '</div>'
      + '<div class="favorite-decision-options">' + optHtml + '</div>'
      + '</div>';
  } else if (fav.stickerData) {
    var favStk = ChatMedia.imgSrcFor(fav.stickerData);
    contentHtml = '<img src="' + favStk.src + '"' + (favStk.ref ? ' data-media-ref="' + favStk.ref + '"' : '') + ' class="favorite-img" alt="' + Core.escapeHtml(fav.label) + '">';
  } else if (fav.imageData) {
    var favImg = ChatMedia.imgSrcFor(fav.imageData);
    contentHtml = '<img src="' + favImg.src + '"' + (favImg.ref ? ' data-media-ref="' + favImg.ref + '"' : '') + ' class="favorite-img" alt="图片">';
  } else {
    contentHtml = '<div class="favorite-item-text">' + Core.escapeHtml(fav.text || '') + '</div>';
  }
  var timeText = fav.time ? Core.formatTime(fav.time) : '';
  return '<div class="favorite-item" data-fav-id="' + Core.escapeHtml(fav.id) + '">'
    + '<div class="favorite-item-body">'
    + contentHtml
    + '<div class="favorite-item-meta">'
    + '<span class="favorite-item-from"><i class="fas fa-user"></i> ' + Core.escapeHtml(fav.from || '对方') + '</span>'
    + (timeText ? '<span class="favorite-item-time">' + Core.escapeHtml(timeText) + '</span>' : '')
    + '</div>'
    + '</div>'
    + (readonly
        ? '<div class="favorite-item-actions his-fav-tag" title="对方收藏"><i class="fas fa-heart"></i></div>'
        : '<div class="favorite-item-actions">'
          + '<button class="favorite-item-remove" onclick="removeFavorite(\'' + escapeAttr(fav.id) + '\')" title="取消收藏"><i class="fas fa-star"></i></button>'
          + '</div>')
    + '</div>';
}

/* ===== 他的收藏页（对方角色自动收藏，复用同款分组渲染，只读无删除） ===== */
function renderHisFavorites() {
  var container = document.getElementById('his-favorites-list');
  if (!container) return;
  var favorites = Storage.getHisFavorites();
  if (!favorites.length) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-lighter)">'
      + '<i class="fas fa-heart" style="font-size:2rem;opacity:0.4;display:block;margin-bottom:12px"></i>'
      + 'TA 还没收藏过任何消息<br>对方会按自己的节奏悄悄收藏</div>';
    return;
  }
  var html = '';
  FAVORITE_CATEGORIES.forEach(function(cat) {
    var items = favorites.filter(function(f) { return f.category === cat.key; });
    if (!items.length) return;
    html += '<div class="favorites-group">'
      + '<div class="favorites-group-title"><i class="' + cat.icon + '"></i> ' + cat.label
      + '<span class="favorites-group-count">' + items.length + '</span></div>';
    items.forEach(function(fav) {
      html += _favoriteItemHtml(fav, true);
    });
    html += '</div>';
  });
  container.innerHTML = html;
  // 异步还原 IndexedDB 引用的大图/大表情
  if (typeof ChatMedia !== 'undefined' && ChatMedia.resolveDomRefs) { try { ChatMedia.resolveDomRefs(container); } catch (e) {} }
}

function removeFavorite(favId) {
  var favorites = Storage.getFavorites().filter(function(f) { return String(f.id) !== String(favId); });
  Storage.setFavorites(favorites);
  renderFavorites();
  Core.toast('已取消收藏');
}

function clearAllFavorites() {
  var favorites = Storage.getFavorites();
  if (!favorites.length) { Core.toast('暂无收藏'); return; }
  Core.dangerConfirm('清空收藏', '确定清空全部 ' + favorites.length + ' 条收藏吗？此操作不可恢复。', function() {
    Storage.setFavorites([]);
    renderFavorites();
    Core.toast('已清空全部收藏');
  });
}

/* 字卡竖排列表渲染（格言风格） */
function renderCardList(cards) {
  if (!cards.length) return '<div style="padding:40px;text-align:center;color:var(--text-lighter)">此分组暂无字卡</div>';
  var selMode = window._wordCardSelectionMode;
  var blocked = Storage.getBlockedCards();
  var html = '';
  cards.forEach(function(card) {
    var isBlocked = blocked.indexOf(card.id) >= 0;
    var selectedClass = window._wordCardSelectedIds.indexOf(card.id) >= 0 ? ' card-list-selected' : '';
    var blockedClass = isBlocked ? ' card-list-blocked' : '';
    var clickHandler = selMode
      ? 'toggleCardSelection(\'' + escapeAttr(card.id) + '\')'
      : 'copyCardText(\'' + escapeAttr(card.text) + '\')';
    html += '<div class="card-list-item' + selectedClass + blockedClass + '" data-card-id="' + escapeHtml(card.id) + '"'
          + ' onclick="' + clickHandler + '">'
          + '<div class="card-list-item-body">'
          + '<div class="card-list-item-text">' + escapeHtml(card.text) + '</div>'
          + '</div>'
          + '<div class="card-list-item-actions" onclick="event.stopPropagation()">'
          + '<button onclick="editWordCard(\'' + escapeAttr(card.id) + '\')" title="编辑"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="deleteWordCardItem(\'' + escapeAttr(card.id) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
          + '</div>'
          + '</div>';
  });
  return html;
}

/* --- 自定义玻璃拟态弹窗 --- */

function _showCardInputModal(options) {
  _closeCardInputModal();

  var title = options.title || '添加字卡';
  var showCategory = options.showCategory || false;
  var currentGroup = options.currentGroup || '';
  var callback = options.callback;
  var groups = getWordCardGroups().map(function(g) { return g.name; });

  var categoryHtml = '';
  if (showCategory) {
    if (groups.length > 1) {
      categoryHtml = '<div class="card-modal-row"><label class="card-modal-label">选择分组</label>'
        + '<select class="card-modal-select" id="ci-category">';
      for (var i = 0; i < groups.length; i++) {
        var sel = groups[i] === currentGroup ? ' selected' : '';
        categoryHtml += '<option value="' + escapeAttr(groups[i]) + '"' + sel + '>' + escapeHtml(groups[i]) + '</option>';
      }
      categoryHtml += '</select></div>';
    } else if (groups.length === 1) {
      categoryHtml = '<div class="card-modal-row"><label class="card-modal-label">分组</label>'
        + '<span class="card-modal-static">' + escapeHtml(groups[0]) + '</span></div>';
    }
    // groups.length === 0: show name input
    if (groups.length === 0) {
      categoryHtml = '<div class="card-modal-row"><label class="card-modal-label">新建分组</label>'
        + '<input class="card-modal-field" id="ci-category-input" placeholder="输入分组名称（默认：未分类）"></div>';
    }
  }

  var overlay = document.createElement('div');
  overlay.className = 'card-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) _closeCardInputModal(); };

  overlay.innerHTML =
    '<div class="card-modal-panel" onclick="event.stopPropagation()">'
    + '<div class="card-modal-title">' + escapeHtml(title) + '</div>'
    + '<div class="card-modal-row">'
    +   '<textarea class="card-modal-textarea" id="ci-text" placeholder="输入字卡内容..." rows="4"></textarea>'
    + '</div>'
    + categoryHtml
    + '<div class="card-modal-row card-modal-toggle-row">'
    +   '<span class="card-modal-toggle-label">回车键分条</span>'
    +   '<label class="card-modal-switch">'
    +     '<input type="checkbox" id="ci-split">'
    +     '<span class="card-modal-switch-slider"></span>'
    +   '</label>'
    + '</div>'
    + '<div class="card-modal-actions">'
    +   '<button class="card-modal-btn card-modal-btn-cancel" onclick="_closeCardInputModal()">取消</button>'
    +   '<button class="card-modal-btn card-modal-btn-confirm" id="ci-confirm">确认</button>'
    + '</div>'
    + '</div>';

  document.body.appendChild(overlay);

  setTimeout(function() {
    var ta = document.getElementById('ci-text');
    if (ta) ta.focus();
  }, 100);

  document.getElementById('ci-confirm').onclick = function() {
    var text = document.getElementById('ci-text').value.trim();
    if (!text) { Core.toast('请输入字卡内容'); return; }

    var split = document.getElementById('ci-split').checked;
    var texts = split ? text.split('\n').filter(function(t) { return t.trim(); }) : [text];
    var category = '';

    if (showCategory) {
      if (groups.length > 1) {
        category = document.getElementById('ci-category').value;
      } else if (groups.length === 1) {
        category = groups[0];
      } else {
        category = (document.getElementById('ci-category-input').value || '').trim() || '未分类';
      }
    } else {
      category = currentGroup;
    }

    _closeCardInputModal();
    callback(texts, category);
  };

  document.getElementById('ci-text').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !document.getElementById('ci-split').checked) {
      e.preventDefault();
      document.getElementById('ci-confirm').click();
    }
  });
}

function _closeCardInputModal() {
  var el = document.querySelector('.card-modal-overlay');
  if (el) el.remove();
}

function _showGroupInputModal(options) {
  _closeGroupInputModal();
  var callback = options.callback;

  var overlay = document.createElement('div');
  overlay.className = 'card-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) _closeGroupInputModal(); };

  overlay.innerHTML =
    '<div class="card-modal-panel" onclick="event.stopPropagation()">'
    + '<div class="card-modal-title">添加分组</div>'
    + '<div class="card-modal-row">'
    +   '<input class="card-modal-field" id="gi-name" placeholder="分组名称" autofocus>'
    + '</div>'
    + '<div class="card-modal-row">'
    +   '<textarea class="card-modal-textarea" id="gi-text" placeholder="输入第一张字卡内容..." rows="3"></textarea>'
    + '</div>'
    + '<div class="card-modal-row card-modal-toggle-row">'
    +   '<span class="card-modal-toggle-label">回车键分条</span>'
    +   '<label class="card-modal-switch">'
    +     '<input type="checkbox" id="gi-split">'
    +     '<span class="card-modal-switch-slider"></span>'
    +   '</label>'
    + '</div>'
    + '<div class="card-modal-actions">'
    +   '<button class="card-modal-btn card-modal-btn-cancel" onclick="_closeGroupInputModal()">取消</button>'
    +   '<button class="card-modal-btn card-modal-btn-confirm" id="gi-confirm">确认</button>'
    + '</div>'
    + '</div>';

  document.body.appendChild(overlay);

  setTimeout(function() {
    var inp = document.getElementById('gi-name');
    if (inp) inp.focus();
  }, 100);

  document.getElementById('gi-confirm').onclick = function() {
    var name = document.getElementById('gi-name').value.trim();
    if (!name) { Core.toast('请输入分组名称'); return; }
    var text = document.getElementById('gi-text').value.trim();
    if (!text) { Core.toast('请输入字卡内容'); return; }
    var split = document.getElementById('gi-split').checked;
    var texts = split ? text.split('\n').filter(function(t) { return t.trim(); }) : [text];

    _closeGroupInputModal();
    callback(name, texts);
  };
}

function _closeGroupInputModal() {
  var el = document.querySelector('.card-modal-overlay');
  if (el) el.remove();
}

/* --- 工具栏操作 --- */

function addWordCard() {
  _showCardInputModal({
    title: '添加字卡',
    showCategory: true,
    callback: function(texts, category) {
      var cards = Storage.getCards();
      var added = 0, skipped = 0;
      for (var i = 0; i < texts.length; i++) {
        if (_isCardTextDuplicate(texts[i])) { skipped++; continue; }
        cards.push({ id: 'c' + Date.now() + i, text: texts[i], source: '', category: category });
        added++;
      }
      Storage.setCards(cards);
      renderWordCardMain();
      var msg = '已添加 ' + added + ' 张字卡';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 条重复';
      Core.toast(msg);
    }
  });
}

function addWordCardGroup() {
  _showGroupInputModal({
    callback: function(groupName, texts) {
      var cards = Storage.getCards();
      var added = 0, skipped = 0;
      for (var i = 0; i < texts.length; i++) {
        if (_isCardTextDuplicate(texts[i])) { skipped++; continue; }
        cards.push({ id: 'c' + Date.now() + i, text: texts[i], source: '', category: groupName });
        added++;
      }
      Storage.setCards(cards);
      renderWordCardMain();
      var msg = '分组「' + groupName + '」已创建，已添加 ' + added + ' 张字卡';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 条重复';
      Core.toast(msg);
    }
  });
}

/* --- 格言风格 - 编辑/删除分组 --- */

function editWordCardGroupName(oldName) {
  Core.formModal('修改分组名称', [
    { label: '新分组名称', placeholder: '请输入新名称', value: oldName }
  ], function(values) {
    var newName = values[0];
    if (!newName || newName === oldName) return;
    var cards = Storage.getCards();
    cards.forEach(function(c) {
      if ((c.category || '未分类') === oldName) c.category = newName;
    });
    Storage.setCards(cards);
    renderWordCardMain();
    if (window._wordCardCurrentGroup === oldName) window._wordCardCurrentGroup = newName;
    Core.toast('分组已重命名');
  });
}

function deleteWordCardGroupItem(groupName) {
  Core.confirm('删除分组', '确定删除分组「' + groupName + '」及其下所有字卡？此操作不可撤销。', function() {
    var cards = Storage.getCards();
    Storage.setCards(cards.filter(function(c) { return (c.category || '未分类') !== groupName; }));
    renderWordCardMain();
    Core.toast('分组已删除');
  });
}

/* --- 格言风格 - 编辑/删除单张字卡 --- */

function editWordCard(cardId) {
  var cards = Storage.getCards();
  var card = null;
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].id === cardId) { card = cards[i]; break; }
  }
  if (!card) return;
  Core.formModal('编辑字卡', [
    { label: '字卡内容', placeholder: '请输入字卡文字', value: card.text },
    { label: '来源（可选）', placeholder: '如"论语"', value: card.source || '' }
  ], function(values) {
    card.text = values[0].trim();
    card.source = values[1].trim();
    Storage.setCards(cards);
    renderWordCardMainGroup();
    Core.toast('字卡已更新');
  });
}

function deleteWordCardItem(cardId) {
  Core.confirm('删除字卡', '确定删除这张字卡吗？', function() {
    var cards = Storage.getCards();
    Storage.setCards(cards.filter(function(c) { return c.id !== cardId; }));
    renderWordCardMainGroup();
    Core.toast('字卡已删除');
  });
}

/* --- 分组子页内选中与挪动 --- */

function selectWordCardsInGroup() {
  var group = window._wordCardCurrentGroup;
  if (!group) return;
  var cards = Storage.getCards().filter(function(c) { return (c.category || '未分类') === group; });
  if (!cards.length) { Core.toast('该分组暂无字卡'); return; }

  // 切换选择模式
  window._wordCardSelectionMode = !window._wordCardSelectionMode;
  if (!window._wordCardSelectionMode) {
    window._wordCardSelectedIds = [];
    renderWordCardMainGroup();
    Core.toast('已退出选择模式');
  } else {
    renderWordCardMainGroup();
    Core.toast('选择模式：点击字卡行切换选中，再次点击按钮确认完成');
  }
}

function selectAllInGroup() {
  var group = window._wordCardCurrentGroup;
  if (!group || !window._wordCardSelectionMode) return;
  var cards = Storage.getCards().filter(function(c) { return (c.category || '未分类') === group; });
  var allIds = cards.map(function(c) { return c.id; });
  // toggle: if all are selected, deselect; otherwise select all
  var allSelected = allIds.length > 0 && allIds.every(function(id) {
    return window._wordCardSelectedIds.indexOf(id) >= 0;
  });
  if (allSelected) {
    window._wordCardSelectedIds = [];
    Core.toast('已取消全选');
  } else {
    window._wordCardSelectedIds = allIds;
    Core.toast('已全选 ' + allIds.length + ' 张字卡');
  }
  renderWordCardMainGroup();
}

function blockSelectedCards() {
  var group = window._wordCardCurrentGroup;
  if (!group || !window._wordCardSelectionMode) return;
  var selectedIds = window._wordCardSelectedIds;
  if (!selectedIds.length) {
    Core.toast('请先选中字卡');
    return;
  }
  var blocked = Storage.getBlockedCards();
  // toggle: if all selected are already blocked, unblock; otherwise block
  var allBlocked = selectedIds.every(function(id) {
    return blocked.indexOf(id) >= 0;
  });
  if (allBlocked) {
    blocked = blocked.filter(function(id) { return selectedIds.indexOf(id) < 0; });
    Storage.setBlockedCards(blocked);
    Core.toast('已取消屏蔽 ' + selectedIds.length + ' 张字卡');
  } else {
    selectedIds.forEach(function(id) {
      if (blocked.indexOf(id) < 0) blocked.push(id);
    });
    Storage.setBlockedCards(blocked);
    Core.toast('已屏蔽 ' + selectedIds.length + ' 张字卡');
  }
  renderWordCardMainGroup();
}

function toggleCardSelection(cardId) {
  if (!window._wordCardSelectionMode) return;
  var idx = window._wordCardSelectedIds.indexOf(cardId);
  if (idx >= 0) {
    window._wordCardSelectedIds.splice(idx, 1);
  } else {
    window._wordCardSelectedIds.push(cardId);
  }
  renderWordCardMainGroup();
}

function moveSelectedCardsInGroup() {
  if (!window._wordCardSelectedIds.length) {
    Core.toast('请先选中字卡');
    return;
  }
  var groups = getWordCardGroups().map(function(g) { return g.name; });
  if (groups.length < 2) { Core.toast('至少需要两个分组才能挪动'); return; }
  var currentGroup = window._wordCardCurrentGroup;
  var otherGroups = groups.filter(function(g) { return g !== currentGroup; });

  // remove existing picker
  _closeMoveGroupPicker();

  var overlay = document.createElement('div');
  overlay.className = 'move-group-picker-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) _closeMoveGroupPicker(); };

  var itemsHtml = '';
  for (var i = 0; i < otherGroups.length; i++) {
    var g = otherGroups[i];
    var icon = getGroupIcon(g);
    itemsHtml += '<div class="move-group-picker-item" onclick="_doMoveCards(\'' + escapeAttr(g) + '\')">'
               + '<i class="' + icon + ' move-group-picker-icon"></i>'
               + '<span class="move-group-picker-name">' + escapeHtml(g) + '</span>'
               + '</div>';
  }

  overlay.innerHTML = '<div class="move-group-picker-panel" onclick="event.stopPropagation()">'
                    + '<div class="move-group-picker-title">挪动到分组</div>'
                    + '<div class="move-group-picker-list">' + itemsHtml + '</div>'
                    + '</div>';

  document.body.appendChild(overlay);
}

function _doMoveCards(target) {
  var cards = Storage.getCards();
  cards.forEach(function(c) {
    if (window._wordCardSelectedIds.indexOf(c.id) >= 0) c.category = target;
  });
  Storage.setCards(cards);
  var count = window._wordCardSelectedIds.length;
  window._wordCardSelectedIds = [];
  window._wordCardSelectionMode = false;
  _closeMoveGroupPicker();
  renderWordCardMainGroup();
  Core.toast('已移动 ' + count + ' 张字卡到「' + target + '」');
}

function _closeMoveGroupPicker() {
  var el = document.querySelector('.move-group-picker-overlay');
  if (el) el.remove();
}

/* --- 导出字卡 --- */

function exportCardsJSON() {
  var cards = Storage.getCards();
  if (!cards.length) { Core.toast('暂无字卡可导出'); return; }

  // 按分组聚合，每组内仅保留 text 和 source
  var groups = {};
  cards.forEach(function(c) {
    var cat = c.category || '未分组';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ text: c.text, source: c.source });
  });

  var payload = {
    exportDate: new Date().toISOString(),
    type: 'wordcards',
    groups: groups
  };

  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'wordcards_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);

  var groupCount = Object.keys(groups).length;
  Core.toast('已导出 ' + cards.length + ' 张字卡（' + groupCount + ' 个分组）');
}

/* --- 全局去重辅助 --- */

/**
 * 检查指定文本内容是否已在全局字卡中存在
 * @param {string} text    待检查的文本
 * @param {string} [excludeId] 编辑场景下排除自身 ID
 * @returns {boolean}
 */
function _isCardTextDuplicate(text, excludeId) {
  var cards = Storage.getCards();
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].text === text) {
      if (excludeId && cards[i].id === excludeId) continue;
      return true;
    }
  }
  return false;
}

/* --- 全分组去重 --- */

function deduplicateAllCards() {
  var cards = Storage.getCards();
  if (!cards.length) { Core.toast('暂无字卡，无需去重'); return; }
  Core.confirm('全分组去重', '将跨所有分组扫描，相同内容的字卡只保留最早的一条，其余删除。确定执行？', function() {
    var seen = {};
    var kept = [];
    var removed = 0;
    cards.forEach(function(c) {
      if (seen[c.text]) {
        removed++;
      } else {
        seen[c.text] = true;
        kept.push(c);
      }
    });
    Storage.setCards(kept);
    renderWordCardMain();
    var tips = [];
    if (removed === 0) {
      tips.push('没有发现重复字卡');
    } else {
      tips.push('已删除 ' + removed + ' 条重复字卡');
      tips.push('保留 ' + kept.length + ' 条字卡');
    }
    Core.toast(tips.join('，'));
  });
}

function addCardToGroup() {
  var group = window._wordCardCurrentGroup;
  if (!group) { alert('未选择分组'); return; }
  _showCardInputModal({
    title: '添加字卡',
    currentGroup: group,
    callback: function(texts, category) {
      var cards = Storage.getCards();
      var added = 0, skipped = 0;
      for (var i = 0; i < texts.length; i++) {
        if (_isCardTextDuplicate(texts[i])) { skipped++; continue; }
        cards.push({ id: 'c' + Date.now() + i, text: texts[i], source: '', category: category });
        added++;
      }
      Storage.setCards(cards);
      renderWordCardMainGroup();
      var msg = '已添加 ' + added + ' 张字卡';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 条重复';
      Core.toast(msg);
    }
  });
}

/* 辅助：转义 HTML */
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, "\\'");
}

// ===== 颜文字 =====
function renderWordCardKaomoji() {
  var container = document.getElementById('kaomoji-group-list');
  if (!container) return;
  window._kaomojiSelectedIds = [];
  window._kaomojiCurrentGroup = '';

  var kaomojis = Storage.getKaomojis();
  if (!kaomojis.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">暂无颜文字</div>';
    return;
  }

  var groups = {}, cats = [];
  kaomojis.forEach(function(k) {
    var c = k.category || '未分类';
    if (!groups[c]) { groups[c] = []; cats.push(c); }
    groups[c].push(k);
  });

  var html = '';
  for (var i = 0; i < cats.length; i++) {
    var g = cats[i];
    var count = groups[g].length;
    html += '<div class="group-item-wrapper">'
          + '<div class="discover-item" onclick="openKaomojiGroup(\'' + escapeAttr(g) + '\')">'
          + '<div class="discover-icon"><i class="fas fa-smile"></i></div>'
          + '<div class="discover-info">'
          + '<div class="discover-title">' + escapeHtml(g) + '</div>'
          + '<div class="discover-desc">' + count + ' 条颜文字</div>'
          + '</div>'
          + '<i class="fas fa-chevron-right discover-arrow"></i>'
          + '</div></div>';
    if (i < cats.length - 1) html += '<div class="list-divider"></div>';
  }
  container.innerHTML = html;
}

function openKaomojiGroup(name) {
  window._kaomojiCurrentGroup = name;
  Navigation.navigateTo('wordcard-kaomoji-group');
}

function renderWordCardKaomojiGroup() {
  var container = document.getElementById('kaomoji-grid-group');
  var titleEl = document.getElementById('kaomoji-group-title');
  if (!container) return;

  var group = window._kaomojiCurrentGroup || '';
  if (titleEl) titleEl.textContent = group;

  var kaomojis = Storage.getKaomojis().filter(function(k) { return (k.category || '未分类') === group; });
  if (!kaomojis.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">此分组暂无颜文字</div>';
    return;
  }

  var html = '';
  kaomojis.forEach(function(k) {
    var kid = k.id || '';
    html += '<div class="card-list-item" data-kaomoji-id="' + escapeHtml(kid) + '">'
          + '<div class="card-list-item-body" onclick="editKaomojiItem(\'' + escapeAttr(kid) + '\')">'
          + '<div class="card-list-item-text">' + escapeHtml(k.text) + '</div>'
          + '</div>'
          + '<div class="card-list-item-actions" onclick="event.stopPropagation()">'
          + '<button onclick="editKaomojiItem(\'' + escapeAttr(kid) + '\')" title="编辑"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="deleteKaomojiItem(\'' + escapeAttr(kid) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
          + '</div>'
          + '</div>';
  });
  container.innerHTML = html;
}

function editKaomojiItem(id) {
  var item = document.querySelector('#kaomoji-grid-group .card-list-item[data-kaomoji-id="' + id + '"]');
  if (!item) return;
  var body = item.querySelector('.card-list-item-body');
  if (!body || body.querySelector('input')) return;

  var group = window._kaomojiCurrentGroup || '';
  var kaomojis = Storage.getKaomojis().filter(function(k) { return (k.category || '未分类') === group; });
  var target = null;
  for (var i = 0; i < kaomojis.length; i++) {
    if (kaomojis[i].id === id) { target = kaomojis[i]; break; }
  }
  if (!target) return;

  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;width:100%">'
    + '<input id="kaomoji-edit-input" class="card-modal-input" value="' + escapeAttr(target.text) + '" autofocus>'
    + '<div style="display:flex;gap:6px">'
    + '<button class="toolbar-btn" onclick="saveKaomojiInline(\'' + escapeAttr(id) + '\')" style="font-size:0.75rem;padding:4px 12px"><i class="fas fa-check"></i> 保存</button>'
    + '<button class="toolbar-btn" onclick="renderWordCardKaomojiGroup()" style="font-size:0.75rem;padding:4px 12px"><i class="fas fa-times"></i> 取消</button>'
    + '</div></div>';

  var input = document.getElementById('kaomoji-edit-input');
  if (input) { input.focus(); input.select(); }
}

function saveKaomojiInline(id) {
  var input = document.getElementById('kaomoji-edit-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text) { Core.toast('内容不能为空'); return; }

  var all = Storage.getKaomojis();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) { all[i].text = text; break; }
  }
  Storage.setKaomojis(all);
  renderWordCardKaomojiGroup();
  Core.toast('颜文字已更新');
}

function deleteKaomojiItem(id) {
  Core.confirm('删除颜文字', '确定删除这条颜文字吗？', function() {
    var all = Storage.getKaomojis();
    Storage.setKaomojis(all.filter(function(k) { return k.id !== id; }));
    renderWordCardKaomojiGroup();
    Core.toast('颜文字已删除');
  });
}

function addKaomoji() {
  Core.formModal('添加颜文字', [
    { label: '颜文字内容', placeholder: '如 (◕‿◕)' },
    { label: '分组名', placeholder: '留空则为"未分类"' }
  ], function(values) {
    var text = values[0];
    if (!text) return;
    var category = values[1] || '未分类';
    var kaomojis = Storage.getKaomojis();
    kaomojis.push({ id: 'kao_' + Date.now(), text: text.trim(), category: category });
    Storage.setKaomojis(kaomojis);
    renderWordCardKaomoji();
    Core.toast('颜文字已添加');
  });
}

function addKaomojiToGroup() {
  var group = window._kaomojiCurrentGroup || '未分类';
  Core.formModal('添加颜文字到「' + group + '」', [
    { label: '颜文字内容', placeholder: '如 (◕‿◕)' }
  ], function(values) {
    var text = values[0];
    if (!text) return;
    var kaomojis = Storage.getKaomojis();
    kaomojis.push({ id: 'kao_' + Date.now(), text: text.trim(), category: group });
    Storage.setKaomojis(kaomojis);
    renderWordCardKaomojiGroup();
    Core.toast('颜文字已添加');
  });
}

/* ============================================================
   语音字卡模块（布局/工具栏与主字卡一致，音频二进制存 SoundFileDB）
   ============================================================ */
window._voiceCardCurrentGroup = '';
window._voiceCardSelectedIds = [];
window._voiceCardSelectionMode = false;

/* 获取所有语音分组及音频数量 */
function getVoiceCardGroups() {
  var cards = Storage.getVoiceCards();
  var groups = {};
  cards.forEach(function(c) {
    var cat = c.category || '未分类';
    if (!groups[cat]) groups[cat] = 0;
    groups[cat]++;
  });
  var list = [];
  for (var name in groups) {
    list.push({ name: name, count: groups[name] });
  }
  return list;
}

/* 语音字卡入口页：分组列表 */
function renderWordCardVoice() {
  var container = document.getElementById('wordcard-voice-group-list');
  if (!container) return;

  window._voiceCardSelectedIds = [];
  window._voiceCardCurrentGroup = '';

  var groups = getVoiceCardGroups();
  if (!groups.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">暂无语音字卡<br>点击工具栏「导入」添加 mp3 音频</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    html += '<div class="group-item-wrapper">'
          + '<div class="discover-item" onclick="openVoiceCardGroup(\'' + escapeAttr(g.name) + '\')">'
          + '<div class="discover-icon"><i class="fas fa-headphones"></i></div>'
          + '<div class="discover-info">'
          + '<div class="discover-title">' + escapeHtml(g.name) + '</div>'
          + '<div class="discover-desc">' + g.count + ' 条语音</div>'
          + '</div>'
          + '<i class="fas fa-chevron-right discover-arrow"></i>'
          + '</div>'
          + '<div class="group-item-actions">'
          + '<button onclick="event.stopPropagation();editVoiceCardGroupName(\'' + escapeAttr(g.name) + '\')" title="编辑分组名"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="event.stopPropagation();deleteVoiceCardGroupItem(\'' + escapeAttr(g.name) + '\')" title="删除分组"><i class="fas fa-trash-alt"></i></button>'
          + '</div></div>';
    if (i < groups.length - 1) html += '<div class="list-divider"></div>';
  }
  container.innerHTML = html;
}

function openVoiceCardGroup(name) {
  window._voiceCardCurrentGroup = name;
  Navigation.navigateTo('wordcard-voice-group');
}

/* 搜索语音字卡（按名称/文案/分组匹配） */
function searchVoiceCards() {
  var input = document.getElementById('wordcard-voice-search-input');
  if (!input) return;
  var clearBtn = document.getElementById('wordcard-voice-search-clear');
  var query = (input.value || '').trim().toLowerCase();

  if (clearBtn) clearBtn.style.display = query ? '' : 'none';

  if (!query) {
    renderWordCardVoice();
    return;
  }

  var container = document.getElementById('wordcard-voice-group-list');
  if (!container) return;

  var cards = Storage.getVoiceCards();
  var matched = cards.filter(function(c) {
    return ((c.name || '') + ' ' + (c.category || '')).toLowerCase().indexOf(query) !== -1;
  });

  if (!matched.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter);font-size:0.8rem;">未找到包含 "' + escapeHtml(input.value) + '" 的语音字卡</div>';
    return;
  }

  var groupMap = {};
  matched.forEach(function(c) {
    var cat = c.category || '未分类';
    if (!groupMap[cat]) groupMap[cat] = [];
    groupMap[cat].push(c);
  });

  var groupNames = Object.keys(groupMap);
  var html = '';
  for (var i = 0; i < groupNames.length; i++) {
    var name = groupNames[i];
    var cardsInGroup = groupMap[name];
    html += '<div class="search-group-bar" onclick="toggleSearchGroup(this)">'
          + '<i class="fas fa-headphones search-group-bar-icon"></i>'
          + '<div class="search-group-bar-info">'
          + '<div class="search-group-bar-title">' + escapeHtml(name) + '</div>'
          + '<div class="search-group-bar-count">' + cardsInGroup.length + ' 条匹配</div>'
          + '</div>'
          + '<i class="fas fa-chevron-down search-group-bar-arrow"></i>'
          + '</div>'
          + '<div class="search-group-cards">';
    cardsInGroup.forEach(function(c) {
      html += '<div class="search-card-item">'
            + '<div class="search-card-text">' + highlightMatch(escapeHtml(c.name || '未命名语音'), query) + '</div>'
            + '<div class="search-card-actions" onclick="event.stopPropagation()">'
            + '<button onclick="playVoiceCard(\'' + escapeAttr(c.id) + '\', this, true)" title="播放"><i class="fas fa-play"></i></button>'
            + '<button class="danger" onclick="deleteSearchVoiceCardItem(\'' + escapeAttr(c.id) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
            + '</div>'
            + '</div>';
    });
    html += '</div>';
  }
  container.innerHTML = html;
}

function clearVoiceCardSearch() {
  var input = document.getElementById('wordcard-voice-search-input');
  if (!input) return;
  input.value = '';
  input.focus();
  searchVoiceCards();
}

function deleteSearchVoiceCardItem(cardId) {
  Core.confirm('删除语音', '确定删除这条语音吗？', function() {
    var cards = Storage.getVoiceCards();
    var card = null;
    for (var i = 0; i < cards.length; i++) { if (cards[i].id === cardId) { card = cards[i]; break; } }
    if (card && card.audioKey) SoundFileDB.del(card.audioKey).catch(function() {});
    Storage.setVoiceCards(cards.filter(function(c) { return c.id !== cardId; }));
    searchVoiceCards();
    Core.toast('语音已删除');
  });
}

/* 分组子页 */
function renderWordCardVoiceGroup() {
  var container = document.getElementById('wordcard-voice-grid-group');
  var titleEl = document.getElementById('wordcard-voice-group-title');
  if (!container) return;

  var group = window._voiceCardCurrentGroup || '';
  if (titleEl) titleEl.textContent = group;

  var cards = Storage.getVoiceCards().filter(function(c) { return (c.category || '未分类') === group; });
  container.innerHTML = renderVoiceCardList(cards);

  var btnSelectAll = document.getElementById('voice-btn-select-all');
  if (btnSelectAll) btnSelectAll.style.display = window._voiceCardSelectionMode ? '' : 'none';
  var btnBlock = document.getElementById('voice-btn-block-cards');
  if (btnBlock) btnBlock.style.display = window._voiceCardSelectionMode ? '' : 'none';
}

/* 语音字卡竖排列表渲染 */
function renderVoiceCardList(cards) {
  if (!cards.length) return '<div style="padding:40px;text-align:center;color:var(--text-lighter)">此分组暂无语音字卡<br>点击「添加语音」导入 mp3</div>';
  var selMode = window._voiceCardSelectionMode;
  var blocked = Storage.getBlockedVoiceCards();
  var html = '';
  cards.forEach(function(card) {
    var isBlocked = blocked.indexOf(card.id) >= 0;
    var selectedClass = window._voiceCardSelectedIds.indexOf(card.id) >= 0 ? ' card-list-selected' : '';
    var blockedClass = isBlocked ? ' card-list-blocked' : '';
    var itemClick = selMode ? 'toggleVoiceCardSelection(\'' + escapeAttr(card.id) + '\')' : '';
    var dur = Math.max(1, Math.round(Number(card.duration) || 3));
    html += '<div class="card-list-item' + selectedClass + blockedClass + '" data-voice-card-id="' + escapeHtml(card.id) + '"'
          + (itemClick ? ' onclick="' + itemClick + '"' : '') + '>'
          + '<div class="voice-card-play" title="播放" onclick="event.stopPropagation();playVoiceCard(\'' + escapeAttr(card.id) + '\', this)"><i class="fas fa-play"></i></div>'
          + '<div class="card-list-item-body">'
          + '<div class="card-list-item-text">' + escapeHtml(card.name || '未命名语音') + '</div>'
          + (card.source ? '<div class="card-list-item-source">' + escapeHtml(card.source) + '</div>' : '')
          + '</div>'
          + '<div class="card-list-item-actions">'
          + '<span class="voice-card-duration">' + dur + '"</span>'
          + '<button onclick="event.stopPropagation();editVoiceCardName(\'' + escapeAttr(card.id) + '\')" title="编辑名称"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="event.stopPropagation();deleteVoiceCardItem(\'' + escapeAttr(card.id) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
          + '</div>'
          + '</div>';
  });
  return html;
}

/* 播放语音字卡：SoundFileDB 异步取回 dataURL 后播放 */
var _voiceCardPlayer = null;
function playVoiceCard(cardId, el) {
  if (!el) return;
  if (_voiceCardPlayer && _voiceCardPlayer.btnEl === el) {
    stopVoiceCardPlayback();
    return;
  }
  stopVoiceCardPlayback();

  var card = null;
  var cards = Storage.getVoiceCards();
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].id === cardId) { card = cards[i]; break; }
  }
  if (!card || !card.audioKey) { Core.toast('音频文件缺失'); return; }

  el.classList.add('playing');
  var icon = el.querySelector('i');
  if (icon) icon.className = 'fas fa-stop';

  SoundFileDB.get(card.audioKey).then(function(dataURL) {
    if (!dataURL) {
      el.classList.remove('playing');
      if (icon) icon.className = 'fas fa-play';
      Core.toast('音频文件缺失');
      return;
    }
    var audio = new Audio(dataURL);
    _voiceCardPlayer = { audio: audio, btnEl: el, query: false };
    audio.onended = function() { stopVoiceCardPlayback(); };
    audio.onerror = function() { stopVoiceCardPlayback(); Core.toast('播放失败'); };
    audio.play().catch(function() { stopVoiceCardPlayback(); });
  }).catch(function() {
    el.classList.remove('playing');
    if (icon) icon.className = 'fas fa-play';
  });
}

function stopVoiceCardPlayback() {
  if (!_voiceCardPlayer) return;
  var p = _voiceCardPlayer;
  _voiceCardPlayer = null;
  if (p.audio) { try { p.audio.pause(); p.audio = null; } catch (e) {} }
  if (p.btnEl && p.btnEl.querySelector) {
    p.btnEl.classList.remove('playing');
    var icon = p.btnEl.querySelector('i');
    if (icon) icon.className = 'fas fa-play';
  }
}

/* --- 语音字卡工具栏 --- */

/* 常驻单例文件输入：只创建一次、change 只绑定一次；不动态创建、不加 focus 兜底（避免卡死） */
var _voiceFileInput = null;
var _voiceImportLock = false;
var _pendingVoiceCategory = '';

function _getVoiceFileInput() {
  if (_voiceFileInput) return _voiceFileInput;
  var input = document.createElement('input');
  input.type = 'file';
  input.id = 'voice-card-file-input';
  input.accept = 'audio/*,.mp3,audio/mp3';
  input.multiple = true;
  input.style.display = 'none';
  input.addEventListener('change', _handleVoiceFilesChange);
  document.body.appendChild(input);
  _voiceFileInput = input;
  return input;
}

function importVoiceCards() {
  _pendingVoiceCategory = '';
  _getVoiceFileInput().click();
}

/* 添加分组：输入分组名后直接选择音频，导入到该分组 */
function addVoiceCardGroup() {
  Core.formModal('添加语音分组', [
    { label: '分组名称', placeholder: '请输入分组名称' }
  ], function(values) {
    var name = (values[0] || '').trim();
    if (!name) { Core.toast('请输入分组名称'); return; }
    _pendingVoiceCategory = name;
    _getVoiceFileInput().click();
  });
}

/* 分组详情页添加语音：导入到当前分组 */
function addVoiceCardToGroup() {
  var group = window._voiceCardCurrentGroup || '未分类';
  _pendingVoiceCategory = group;
  _getVoiceFileInput().click();
}

function _handleVoiceFilesChange() {
  var input = _voiceFileInput;
  if (!input || _voiceImportLock) return;
  var files = input.files ? Array.prototype.slice.call(input.files) : [];
  // change 后清空 input.value，允许重选同一文件
  input.value = '';
  if (!files.length) return;
  _voiceImportLock = true;

  var targetCategory = _pendingVoiceCategory || '';
  _pendingVoiceCategory = '';

  var added = 0, skipped = 0;
  var chain = files.reduce(function(p, file) {
    return p.then(function() {
      return _importVoiceFile(file, targetCategory).then(function(ok) {
        if (ok) added++; else skipped++;
      });
    });
  }, Promise.resolve());

  var self = this;
  chain.then(function() {
    _voiceImportLock = false;
    renderWordCards();
    // 若处于分组详情页，同步刷新该分组视图
    if (targetCategory && window._voiceCardCurrentGroup) renderWordCardVoiceGroup();
    var msg = '成功导入 ' + added + ' 条语音';
    if (skipped > 0) msg += '，跳过 ' + skipped + ' 条';
    Core.toast(msg);
  }).catch(function() {
    _voiceImportLock = false;
    Core.toast('导入失败');
  });
}

/* 读取单个音频文件：取时长 → FileReader 得 dataURL → SoundFileDB 永久存储 → 列表写元数据 */
function _importVoiceFile(file, category) {
  return new Promise(function(resolve) {
    if (!window.SoundFileDB) { resolve(false); return; }
    var settled = false;
    var duration = 0;
    var url = '';

    function finish(ok, dataURL, audioKey) {
      if (settled) { resolve(false); return; }
      settled = true;
      if (ok && dataURL && audioKey) resolve(true);
      else resolve(false);
    }

    // 先尝试解析时长（metadata）
    try {
      var probe = document.createElement('audio');
      probe.preload = 'metadata';
      url = URL.createObjectURL(file);
      probe.onloadedmetadata = function() {
        if (probe.duration && isFinite(probe.duration)) duration = Math.round(probe.duration);
        try { URL.revokeObjectURL(url); } catch (e) {}
        readData();
      };
      probe.onerror = function() {
        try { URL.revokeObjectURL(url); } catch (e) {}
        readData();
      };
      probe.src = url;
      // 兜底：metadata 迟迟不触发也继续读取
      setTimeout(function() {
        if (!settled) {
          try { URL.revokeObjectURL(url); } catch (e) {}
          if (!_probeDone) { _probeDone = true; readData(); }
        }
      }, 2500);
      var _probeDone = false;
    } catch (e) {
      readData();
    }

    function readData() {
      if (_probeDone) return;
      _probeDone = true;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var dataURL = ev.target.result || '';
        if (!dataURL) { finish(false); return; }
        var vcId = 'v' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        var audioKey = 'voice_' + vcId;
        SoundFileDB.set(audioKey, dataURL).then(function() {
          var voiceCards = Storage.getVoiceCards();
          var name = '';
          try { name = file.name.replace(/\.[^.]+$/, ''); } catch (e) {}
          voiceCards.push({
            id: vcId,
            name: name || '',
            category: category || '未分类',
            duration: duration || 3,
            audioMime: file.type || 'audio/mpeg',
            audioKey: audioKey,
            source: '导入'
          });
          Storage.setVoiceCards(voiceCards);
          finish(true, dataURL, audioKey);
        }).catch(function() {
          finish(false);
        });
      };
      reader.onerror = function() { finish(false); };
      try { reader.readAsDataURL(file); } catch (e) { finish(false); }
    }
  });
}

/* --- 编辑/删除语音 --- */
function editVoiceCardName(cardId) {
  var cards = Storage.getVoiceCards();
  var card = null;
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].id === cardId) { card = cards[i]; break; }
  }
  if (!card) return;
  Core.formModal('编辑语音', [
    { label: '名称/文案', placeholder: '语音名称或转写文案（可空）', value: card.name || '' }
  ], function(values) {
    if (!values[0]) return;
    card.name = values[0].trim();
    Storage.setVoiceCards(cards);
    renderWordCardVoiceGroup();
    Core.toast('已更新');
  });
}

function deleteVoiceCardItem(cardId) {
  Core.confirm('删除语音', '确定删除这条语音吗？', function() {
    var cards = Storage.getVoiceCards();
    var card = null;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].id === cardId) { card = cards[i]; break; }
    }
    if (card && card.audioKey) SoundFileDB.del(card.audioKey).catch(function() {});
    Storage.setVoiceCards(cards.filter(function(c) { return c.id !== cardId; }));
    renderWordCardVoiceGroup();
    Core.toast('语音已删除');
  });
}

function editVoiceCardGroupName(oldName) {
  Core.formModal('修改分组名称', [
    { label: '新分组名称', placeholder: '请输入新名称', value: oldName }
  ], function(values) {
    var newName = values[0];
    if (!newName || newName === oldName) return;
    var cards = Storage.getVoiceCards();
    cards.forEach(function(c) {
      if ((c.category || '未分类') === oldName) c.category = newName;
    });
    Storage.setVoiceCards(cards);
    renderWordCardVoice();
    if (window._voiceCardCurrentGroup === oldName) window._voiceCardCurrentGroup = newName;
    Core.toast('分组已重命名');
  });
}

function deleteVoiceCardGroupItem(groupName) {
  Core.confirm('删除分组', '确定删除分组「' + groupName + '」及其下所有语音？此操作不可撤销。', function() {
    var cards = Storage.getVoiceCards();
    var removed = cards.filter(function(c) { return (c.category || '未分类') === groupName; });
    removed.forEach(function(c) {
      if (c.audioKey) SoundFileDB.del(c.audioKey).catch(function() {});
    });
    Storage.setVoiceCards(cards.filter(function(c) { return (c.category || '未分类') !== groupName; }));
    renderWordCardVoice();
    Core.toast('分组已删除');
  });
}

/* --- 分组子页内选中与挪动 --- */
function selectVoiceCardsInGroup() {
  var group = window._voiceCardCurrentGroup;
  if (!group) return;
  var cards = Storage.getVoiceCards().filter(function(c) { return (c.category || '未分类') === group; });
  if (!cards.length) { Core.toast('该分组暂无语音'); return; }
  window._voiceCardSelectionMode = !window._voiceCardSelectionMode;
  if (!window._voiceCardSelectionMode) {
    window._voiceCardSelectedIds = [];
    renderWordCardVoiceGroup();
    Core.toast('已退出选择模式');
  } else {
    renderWordCardVoiceGroup();
    Core.toast('选择模式：点击语音行切换选中，再次点击按钮确认完成');
  }
}

function selectAllVoiceCardsInGroup() {
  var group = window._voiceCardCurrentGroup;
  if (!group || !window._voiceCardSelectionMode) return;
  var cards = Storage.getVoiceCards().filter(function(c) { return (c.category || '未分类') === group; });
  var allIds = cards.map(function(c) { return c.id; });
  var allSelected = allIds.length > 0 && allIds.every(function(id) {
    return window._voiceCardSelectedIds.indexOf(id) >= 0;
  });
  if (allSelected) {
    window._voiceCardSelectedIds = [];
    Core.toast('已取消全选');
  } else {
    window._voiceCardSelectedIds = allIds;
    Core.toast('已全选 ' + allIds.length + ' 条语音');
  }
  renderWordCardVoiceGroup();
}

function toggleVoiceCardSelection(cardId) {
  if (!window._voiceCardSelectionMode) return;
  var idx = window._voiceCardSelectedIds.indexOf(cardId);
  if (idx >= 0) {
    window._voiceCardSelectedIds.splice(idx, 1);
  } else {
    window._voiceCardSelectedIds.push(cardId);
  }
  renderWordCardVoiceGroup();
}

function blockSelectedVoiceCards() {
  var group = window._voiceCardCurrentGroup;
  if (!group || !window._voiceCardSelectionMode) return;
  var selectedIds = window._voiceCardSelectedIds;
  if (!selectedIds.length) { Core.toast('请先选中语音'); return; }
  var blocked = Storage.getBlockedVoiceCards();
  var allBlocked = selectedIds.every(function(id) { return blocked.indexOf(id) >= 0; });
  if (allBlocked) {
    blocked = blocked.filter(function(id) { return selectedIds.indexOf(id) < 0; });
    Storage.setBlockedVoiceCards(blocked);
    Core.toast('已取消屏蔽 ' + selectedIds.length + ' 条语音');
  } else {
    selectedIds.forEach(function(id) {
      if (blocked.indexOf(id) < 0) blocked.push(id);
    });
    Storage.setBlockedVoiceCards(blocked);
    Core.toast('已屏蔽 ' + selectedIds.length + ' 条语音');
  }
  renderWordCardVoiceGroup();
}

function moveSelectedVoiceCardsInGroup() {
  if (!window._voiceCardSelectedIds.length) { Core.toast('请先选中语音'); return; }
  var groups = getVoiceCardGroups().map(function(g) { return g.name; });
  if (groups.length < 2) { Core.toast('至少需要两个分组才能挪动'); return; }
  var currentGroup = window._voiceCardCurrentGroup;
  var otherGroups = groups.filter(function(g) { return g !== currentGroup; });

  _closeMoveGroupPicker();

  var overlay = document.createElement('div');
  overlay.className = 'move-group-picker-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) _closeMoveGroupPicker(); };

  var itemsHtml = '';
  for (var i = 0; i < otherGroups.length; i++) {
    var g = otherGroups[i];
    itemsHtml += '<div class="move-group-picker-item" onclick="_doMoveVoiceCards(\'' + escapeAttr(g) + '\')">'
               + '<i class="fas fa-headphones move-group-picker-icon"></i>'
               + '<span class="move-group-picker-name">' + escapeHtml(g) + '</span>'
               + '</div>';
  }

  overlay.innerHTML = '<div class="move-group-picker-panel" onclick="event.stopPropagation()">'
                    + '<div class="move-group-picker-title">挪动到分组</div>'
                    + '<div class="move-group-picker-list">' + itemsHtml + '</div>'
                    + '</div>';
  document.body.appendChild(overlay);
}

function _doMoveVoiceCards(target) {
  var cards = Storage.getVoiceCards();
  cards.forEach(function(c) {
    if (window._voiceCardSelectedIds.indexOf(c.id) >= 0) c.category = target;
  });
  Storage.setVoiceCards(cards);
  var count = window._voiceCardSelectedIds.length;
  window._voiceCardSelectedIds = [];
  window._voiceCardSelectionMode = false;
  _closeMoveGroupPicker();
  renderWordCardVoiceGroup();
  Core.toast('已移动 ' + count + ' 条语音到「' + target + '」');
}

/* --- 导出语音（元数据 JSON，音频二进制存本机 SoundFileDB） --- */
function exportVoiceCards() {
  var cards = Storage.getVoiceCards();
  if (!cards.length) { Core.toast('暂无语音可导出'); return; }
  var groups = {};
  cards.forEach(function(c) {
    var cat = c.category || '未分组';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ name: c.name || '', duration: c.duration || 0, source: c.source || '', audioMime: c.audioMime || '' });
  });
  var payload = { exportDate: new Date().toISOString(), type: 'voiceCards', groups: groups };
  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'voicecards_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  Core.toast('已导出 ' + cards.length + ' 条语音元数据（' + Object.keys(groups).length + ' 个分组）');
}

/* --- 全分组去重（按名称，需名称非空） --- */
function deduplicateVoiceCards() {
  var cards = Storage.getVoiceCards();
  if (!cards.length) { Core.toast('暂无语音，无需去重'); return; }
  Core.confirm('全分组去重', '将跨所有分组扫描，名称相同的语音只保留最早的一条，其余删除。确定执行？', function() {
    var seen = {};
    var kept = [];
    var removed = 0;
    cards.forEach(function(c) {
      var name = (c.name || '').trim();
      var key = name + '\u0001' + (c.category || '未分类');
      if (name !== '' && key && seen[key]) {
        removed++;
        if (c.audioKey) SoundFileDB.del(c.audioKey).catch(function() {});
      } else {
        if (name !== '') seen[key] = true;
        kept.push(c);
      }
    });
    Storage.setVoiceCards(kept);
    renderWordCardVoice();
    var tips = [];
    if (removed === 0) {
      tips.push('没有发现重复语音');
    } else {
      tips.push('已删除 ' + removed + ' 条重复语音');
      tips.push('保留 ' + kept.length + ' 条语音');
    }
    Core.toast(tips.join('，'));
  });
}

/* IndexedDB 兜底恢复后的补偿重渲染：
   Storage.getCards 首次读取发生在 IDB 恢复前会拿到空默认值，且字卡模块未监听恢复事件，
   导致主字卡分组点进去内容为空（需退出重进才显示）。恢复完成后若停留在主字卡相关子页则刷新。 */
window.addEventListener('mirror-storage-restored', function(e) {
  if (!e.detail) return;
  if (e.detail.key !== 'cards' && e.detail.key !== 'voiceCards') return;
  if (window.Navigation) {
    var p = Navigation.currentPage;
    if (p === 'wordcard-main' || p === 'wordcard-main-group' ||
        p === 'wordcard-voice' || p === 'wordcard-voice-group') renderWordCards();
  }
});
window.addEventListener('mirror-storage-synced', function() {
  if (window.Navigation) {
    var p = Navigation.currentPage;
    if (p === 'wordcard-main' || p === 'wordcard-main-group' ||
        p === 'wordcard-voice' || p === 'wordcard-voice-group') renderWordCards();
  }
});

