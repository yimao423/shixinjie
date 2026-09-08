/* ============================================================
   mini-games.js — 互动游戏
   1. 羊了个羊 MiniGameSheep —— 多层牌堆 + 槽内三消
   2. 消消乐 MiniGameGoose —— 网格交换三消（原抓大鹅）
   3. 连连看 MiniGameLlk —— 连线消除配对
   4. 2048 MiniGame2048 —— 数字合并
   5. 记忆翻牌 MiniGameMemory —— 翻牌配对
   每个游戏内置「求助 TA」：卡壳时可呼叫对方角色，系统自动帮忙
   通关彩蛋：随机赠送一句每日情话（复用 love-apps 情话库）
   设计语言：毛玻璃卡片 + 主题变量，与全站一致
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 通用工具 ---------- */
  function toast(msg) {
    if (window.Core && typeof Core.toast === 'function') { Core.toast(msg); return; }
    try { alert(msg); } catch (e) {}
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 获取对方角色信息（用于求助气泡头像与昵称）
  function getPartner() {
    try {
      var profiles = window.Storage && Storage.getPartnerProfiles ? Storage.getPartnerProfiles() : [];
      if (profiles && profiles.length) return profiles[0];
    } catch (e) {}
    return { id: 'partner_1', nickname: '镜', avatar: '镜', avatarColor: '#C8B8E0', avatarImage: '' };
  }

  // 通关彩蛋：随机一句情话（复用 love-apps 的情话彩蛋库，无则兜底一句）
  function getRewardQuote() {
    if (window.SWEET_QUOTES && window.SWEET_QUOTES.length) {
      return window.SWEET_QUOTES[Math.floor(Math.random() * window.SWEET_QUOTES.length)];
    }
    var fallback = ['遇见你之后，星河皆可摘，万物皆可期。', '你是我在这人间最想留住的小幸运。', '想牵你的手，从心动，到古稀，到尽头。'];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  // 渲染结算弹层
  function showOverlay(emoji, title, quote, btnText, onBtn) {
    var old = document.querySelector('.game-overlay');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'game-overlay';
    ov.innerHTML =
      '<div class="game-overlay-panel">' +
        '<div class="overlay-emoji">' + emoji + '</div>' +
        '<h3>' + title + '</h3>' +
        '<div class="overlay-quote">「 ' + quote + ' 」</div>' +
        '<button class="glass-btn primary" style="width:100%">' + btnText + '</button>' +
      '</div>';
    ov.querySelector('button').onclick = function () { ov.remove(); if (onBtn) onBtn(); };
    document.body.appendChild(ov);
  }

  // 求助气泡：对方角色说话
  function showHelpBubble(container, text) {
    var wrap = container.querySelector('.help-bubble-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'help-bubble-wrap';
      container.insertBefore(wrap, container.firstChild);
    }
    var partner = getPartner();
    var avatar = partner.avatarImage
      ? '<img src="' + partner.avatarImage + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover">'
      : partner.avatar;
    wrap.innerHTML =
      '<div class="help-bubble show">' +
        '<div class="help-bubble-avatar" style="background:' + (partner.avatarColor || '#C8B8E0') + '">' + avatar + '</div>' +
        '<div class="help-bubble-text">' + text + '</div>' +
      '</div>';
    clearTimeout(wrap._hideTimer);
    wrap._hideTimer = setTimeout(function () {
      var b = wrap.querySelector('.help-bubble');
      if (b) b.classList.remove('show');
    }, 3200);
  }

  var HELP_TEXTS = [
    '别急，我来帮你消一组～',
    '看到那几块了吗？我帮你清掉啦',
    '这个关卡交给我，看我的！',
    '亲爱的，让我来搭把手～',
    '小意思，我这就帮你消除'
  ];
  function randomHelpText() { return HELP_TEXTS[Math.floor(Math.random() * HELP_TEXTS.length)]; }

  /* ============================================================
     1. 羊了个羊
     ============================================================ */
  var SHEEP_EMOJIS = ['❤️', '🌹', '⭐', '🍀', '🌈', '🎀', '🍰', '🐰'];
  // 简化布局：分两层，每层网格错位叠放

  var SheepGame = {
    cards: [],     // {id, layer, r, c, emoji, x, y, covered, matched}
    slot: [],      // 槽内牌 id
    slotMax: 7,
    running: false,
    helpCount: 0,
    maxHelp: 3,
    round: 1,      // 两轮制：1=第一轮（牌少），2=第二轮（牌多）

    start: function (container) {
      this.container = container;
      this.helpCount = 0;
      this.maxHelp = 3;
      this.round = 1;
      this._buildCards();
      this._render();
      this.running = true;
    },

    // 进入下一轮（第二轮牌更多）
    nextRound: function () {
      this.round = 2;
      this.slot = [];
      this.helpCount = 0;
      this._buildCards();
      this._render();
      this.running = true;
    },

    _buildCards: function () {
      // 牌总数按 3 的倍数生成，保证可消
      var self = this;
      this.cards = [];
      var id = 0;
      // 两轮制：第一轮牌少（单层 3x3=9），第二轮牌多（两层 3x4+2x3=18）
      var plan;
      if (this.round === 1) {
        plan = [
          { rows: 3, cols: 3, count: 9 }
        ];
      } else {
        plan = [
          { rows: 3, cols: 4, count: 12 },
          { rows: 2, cols: 3, count: 6 }
        ];
      }
      var total = 0;
      plan.forEach(function (p) { total += p.count; });
      // 保证 3 的倍数
      if (total % 3 !== 0) { plan[plan.length - 1].count += (3 - total % 3); }
      var emojiPool = [];
      var per = Math.floor(SHEEP_EMOJIS.length * 3 / 3); // 种类数
      var needTypes = Math.ceil(total / 3);
      var types = SHEEP_EMOJIS.slice(0, needTypes);
      plan.forEach(function (p) {
        var n = p.count;
        var arr = [];
        for (var i = 0; i < n; i++) arr.push(types[i % types.length]);
        arr = shuffle(arr);
        for (var r = 0; r < p.rows; r++) {
          for (var c = 0; c < p.cols && (r * p.cols + c) < n; c++) {
            self.cards.push({
              id: id++,
              layer: plan.indexOf(p),
              r: r, c: c,
              emoji: arr[r * p.cols + c],
              x: 0, y: 0,
              covered: false, matched: false
            });
          }
        }
      });
      // 计算每张牌的像素坐标（相对舞台）
      this._layoutCards();
      this._updateCovered();
    },

    _layoutCards: function () {
      var stageW = 300, cardW = 42, gapX = 52, gapY = 58;
      var offsetY = { 0: 14, 1: 64 };
      // 计算每层最大列数，用于层内水平居中
      var maxCols = {};
      this.cards.forEach(function (c) {
        if (!maxCols[c.layer] || (c.c + 1) > maxCols[c.layer]) maxCols[c.layer] = c.c + 1;
      });
      var self = this;
      this.cards.forEach(function (card) {
        var layer = card.layer;
        var cols = maxCols[layer] || 4;
        // 层内水平居中：占用宽度 = (cols-1)*gapX + cardW，剩余均分到两侧
        var usedW = (cols - 1) * gapX + cardW;
        var baseX = Math.round((stageW - usedW) / 2);
        var extraX = (layer % 2) * 6;
        var extraY = (layer % 2) * 8;
        card.x = baseX + card.c * gapX + extraX;
        card.y = offsetY[layer] + card.r * gapY + extraY;
      });
      // 注意：平移（_shiftPileToRightLower）延迟到 _render 中舞台创建后执行，
      // 以便基于舞台实际渲染尺寸（而非硬编码 962）计算目标位置，兼容窄屏。
    },

    // 计算牌组包围盒并整体平移到舞台右下区域，保持层间相对位置不变
    // 目标中心基于舞台实际尺寸的 58% 宽、68% 高处，确保任意宽度下牌堆完整可见
    _shiftPileToRightLower: function (stage) {
      var self = this;
      if (!this.cards.length) return;
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      this.cards.forEach(function (c) {
        if (c.x < minX) minX = c.x;
        if (c.x + 42 > maxX) maxX = c.x + 42;
        if (c.y < minY) minY = c.y;
        if (c.y + 50 > maxY) maxY = c.y + 50;
      });
      var pileW = maxX - minX, pileH = maxY - minY;
      // 目标中心：舞台实际宽度 58%、高度 68% 处（对应参考图红框偏右下的区域）
      var stageW = stage ? (stage.offsetWidth || 358) : 358;
      var stageH = stage ? (stage.offsetHeight || 340) : 340;
      // 若舞台过窄，牌堆仍应完整落在舞台内，中心不得越过可容纳边界
      var maxCX = Math.max(stageW * 0.5, stageW - pileW / 2);
      var maxCY = Math.max(stageH * 0.5, stageH - pileH / 2);
      var targetCX = Math.min(stageW * 0.58, maxCX);
      var targetCY = Math.min(stageH * 0.68, maxCY);
      var curCX = Math.round((minX + maxX) / 2);
      var curCY = Math.round((minY + maxY) / 2);
      var dx = targetCX - curCX;
      var dy = targetCY - curCY;
      this.cards.forEach(function (c) { c.x += dx; c.y += dy; });
    },

    _updateCovered: function () {
      var self = this;
      this.cards.forEach(function (card) {
        if (card.matched) { card.covered = true; return; }
        card.covered = false;
        self.cards.forEach(function (other) {
          if (other.matched || other.id === card.id) return;
          if (other.layer > card.layer) {
            // 检查矩形重叠
            var overlap = !(card.x + 42 <= other.x || other.x + 42 <= card.x ||
                            card.y + 50 <= other.y || other.y + 50 <= card.y);
            if (overlap) card.covered = true;
          }
        });
      });
    },

    _render: function () {
      var self = this;
      var html =
        '<div class="game-topbar glass-card">' +
          '<div class="game-topbar-info"><span class="chip">第 ' + this.round + ' 轮</span><span class="chip">剩余 ' + this._leftCount() + ' 张</span><span class="chip">求助 <b id="sheep-help-left">' + (this.maxHelp - this.helpCount) + '</b>/' + this.maxHelp + '</span></div>' +
          '<div class="game-topbar-actions">' +
            '<button class="game-icon-btn" onclick="MiniGameSheep.restart()" title="重开"><i class="fas fa-rotate-left"></i></button>' +
            '<button class="game-icon-btn game-help-btn" onclick="MiniGameSheep.askHelp()" title="求助TA"><i class="fas fa-heart"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="help-bubble-wrap"></div>' +
        '<div class="sheep-stage" id="sheep-stage"></div>' +
        '<div class="sheep-slot" id="sheep-slot"></div>' +
        '<div class="game-actions">' +
          '<button class="glass-btn primary" onclick="MiniGameSheep.askHelp()"><i class="fas fa-heart"></i> 求助 TA</button>' +
        '</div>';
      this.container.innerHTML = html;

      var stage = this.container.querySelector('#sheep-stage');
      // 基于舞台实际渲染尺寸重定位牌堆（窄屏自适应，避免溢出舞台）
      this._shiftPileToRightLower(stage);
      this.cards.forEach(function (card) {
        if (card.matched) return;
        var el = document.createElement('div');
        el.className = 'sheep-card' + (card.covered ? ' covered' : ' free');
        el.style.left = card.x + 'px';
        el.style.top = card.y + 'px';
        el.textContent = card.emoji;
        el.dataset.id = card.id;
        el.onclick = function () { self._onClickCard(card, el); };
        stage.appendChild(el);
      });
      this._renderSlot();
    },

    _leftCount: function () {
      var n = 0;
      this.cards.forEach(function (c) { if (!c.matched) n++; });
      return n;
    },

    _renderSlot: function () {
      var self = this;
      var slotEl = this.container.querySelector('#sheep-slot');
      if (!slotEl) return;
      slotEl.innerHTML = '';
      var cells = [];
      for (var i = 0; i < this.slotMax; i++) cells.push(this.slot[i] || null);
      cells.forEach(function (id, idx) {
        var cell = document.createElement('div');
        cell.className = 'sheep-slot-cell';
        cell.dataset.idx = idx;
        if (id != null) {
          var card = self._findCard(id);
          if (card) {
            cell.classList.add('filled');
            cell.textContent = card.emoji;
          }
        }
        slotEl.appendChild(cell);
      });
    },

    _findCard: function (id) {
      for (var i = 0; i < this.cards.length; i++) {
        if (this.cards[i].id === id) return this.cards[i];
      }
      return null;
    },

    _onClickCard: function (card, el) {
      if (!this.running || card.matched || card.covered) return;
      if (this.slot.length >= this.slotMax) {
        toast('槽已满，先求助 TA 或重开吧');
        return;
      }
      // 入槽
      this.slot.push(card.id);
      card.matched = true; // 暂时标记为已取走（从牌堆移除）
      el.classList.add('removing');
      var self = this;
      setTimeout(function () {
        el.remove();
        self._updateCovered();
        // 更新剩余
        self._refreshTopbar();
        self._checkSlotMatch();
      }, 260);
    },

    _refreshTopbar: function () {
      var chip = this.container.querySelector('.game-topbar-info .chip');
      if (chip) chip.textContent = '剩余 ' + this._leftCount() + ' 张';
    },

    _checkSlotMatch: function () {
      var self = this;
      // 统计槽内各图案
      var counts = {};
      this.slot.forEach(function (id) {
        var c = self._findCard(id);
        if (!c) return;
        counts[c.emoji] = (counts[c.emoji] || 0) + 1;
      });
      var matchedEmoji = null;
      for (var emoji in counts) {
        if (counts[emoji] >= 3) { matchedEmoji = emoji; break; }
      }
      if (matchedEmoji) {
        // 找到该图案在槽中的 3 张，做消除动画
        var hitIdx = [];
        var hitIds = [];
        this.slot.forEach(function (id, idx) {
          if (hitIdx.length >= 3) return;
          var c = self._findCard(id);
          if (c && c.emoji === matchedEmoji) { hitIdx.push(idx); hitIds.push(id); }
        });
        var slotEl = this.container.querySelector('#sheep-slot');
        hitIdx.forEach(function (idx) {
          var cell = slotEl.querySelector('.sheep-slot-cell[data-idx="' + idx + '"]');
          if (cell) cell.classList.add('matched');
        });
        var self2 = this;
        setTimeout(function () {
          hitIds.forEach(function (id) {
            var i = self2.slot.indexOf(id);
            if (i > -1) self2.slot.splice(i, 1);
          });
          self2._renderSlot();
          self2._checkWin();
        }, 360);
      } else {
        this._renderSlot();
        // 槽满即败
        if (this.slot.length >= this.slotMax) {
          this.running = false;
          showOverlay('😵', '卡住啦', '槽都塞满啦，让 TA 帮帮你，或者重开一局吧～', '再试一次', function () { SheepGame.restart(); });
        } else {
          this._checkWin();
        }
      }
    },

    _checkWin: function () {
      if (this._leftCount() === 0 && this.slot.length === 0) {
        this.running = false;
        if (this.round === 1) {
          // 第一轮完成 → 进入第二轮（牌更多、难度升级）
          showOverlay('🎉', '第一轮通过！', '难度升级，第二轮来啦～', '进入第二轮', function () { SheepGame.nextRound(); });
        } else {
          showOverlay('🎉', '通关啦！', getRewardQuote(), '再来一局', function () { SheepGame.restart(); });
        }
      }
    },

    askHelp: function () {
      if (!this.running) return;
      if (this.helpCount >= this.maxHelp) { toast('求助次数已用完啦，试试重开吧'); return; }
      var self = this;
      this.helpCount++;
      this._refreshTopbar();
      showHelpBubble(this.container, '<b>' + getPartner().nickname + '</b>：' + randomHelpText());
      setTimeout(function () { self._doHelpEliminate(); }, 500);
    },

    _doHelpEliminate: function () {
      var self = this;
      // 1) 优先从牌堆中消除一组 3 张相同（可点击的），最干净
      var groups = {};
      this.cards.forEach(function (c) {
        if (c.matched || c.covered) return;
        groups[c.emoji] = (groups[c.emoji] || 0) + 1;
      });
      var pick = null;
      for (var em in groups) { if (groups[em] >= 3) { pick = em; break; } }
      if (pick) {
        var targets = [];
        this.cards.forEach(function (c) { if (!c.matched && !c.covered && c.emoji === pick && targets.length < 3) targets.push(c); });
        var removed = 0;
        var els = this.container.querySelectorAll('.sheep-card');
        var idsToRemove = {};
        targets.forEach(function (c) { idsToRemove[c.id] = true; });
        for (var k = 0; k < els.length; k++) {
          var e = els[k];
          if (idsToRemove[e.dataset.id]) {
            e.classList.add('removing');
            (function (el2) { setTimeout(function () { el2.remove(); }, 260); })(e);
            removed++;
          }
        }
        var self5 = this;
        setTimeout(function () {
          targets.forEach(function (c) { c.matched = true; });
          self5._updateCovered();
          self5._refreshTopbar();
          self5._checkWin();
          void removed;
        }, 300);
        return;
      }

      // 2) 优先消除槽中已有的一对（凑 3 消除）
      var counts = {};
      this.slot.forEach(function (id) {
        var c = self._findCard(id);
        if (!c) return;
        counts[c.emoji] = (counts[c.emoji] || 0) + 1;
      });
      var target = null;
      for (var emoji in counts) { if (counts[emoji] >= 2) { target = emoji; break; } }

      if (target) {
        // 从牌堆中取一张同图案（若存在）凑 3
        var free = this.cards.filter(function (c) { return !c.matched && !c.covered && c.emoji === target; });
        var cardToAdd = free.length ? free[0] : null;
        if (cardToAdd) {
          cardToAdd.matched = true;
          var els2 = this.container.querySelectorAll('.sheep-card');
          for (var i = 0; i < els2.length; i++) {
            if (els2[i].dataset.id == cardToAdd.id) {
              var el = els2[i];
              el.classList.add('removing');
              (function (el2) { setTimeout(function () { el2.remove(); }, 260); })(el);
            }
          }
          this.slot.push(cardToAdd.id);
          var self3 = this;
          setTimeout(function () {
            self3._updateCovered();
            self3._checkSlotMatch();
          }, 300);
          return;
        }
        // 牌堆无同图案，则直接消除槽中这一对
        var hit = [];
        this.slot.forEach(function (id, idx) {
          var c = self._findCard(id);
          if (c && c.emoji === target && hit.length < 2) hit.push(idx);
        });
        var slotEl = this.container.querySelector('#sheep-slot');
        hit.forEach(function (idx) {
          var cell = slotEl.querySelector('.sheep-slot-cell[data-idx="' + idx + '"]');
          if (cell) cell.classList.add('matched');
        });
        var self4 = this;
        setTimeout(function () {
          var removeIds = hit.map(function (idx) { return self4.slot[idx]; });
          removeIds.forEach(function (id) {
            var j = self4.slot.indexOf(id);
            if (j > -1) self4.slot.splice(j, 1);
          });
          self4._renderSlot();
        }, 360);
        return;
      }

      // 3) 实在无可消：清空槽中一张最旧牌作为帮助
      if (this.slot.length) {
        this.slot.shift();
        this._renderSlot();
      }
    },

    restart: function () {
      this.slot = [];
      this.helpCount = 0;
      this.start(this.container);
    }
  };

  window.MiniGameSheep = {
    start: function (container) { SheepGame.start(container); },
    restart: function () { SheepGame.restart(); },
    askHelp: function () { SheepGame.askHelp(); },
    nextRound: function () { SheepGame.nextRound(); }
  };

  /* ============================================================
     2. 抓大鹅（网格交换三消）
     ============================================================ */
  var GOOSE_EMOJIS = ['🦆', '🐔', '🐰', '🐸', '🐱', '🦊'];
  var GOOSE_SIZE = 7; // 7x7 网格

  var GooseGame = {
    grid: [],        // 二维数组 {emoji, clearing, falling}
    selected: null,  // {r, c}
    score: 0,
    running: false,
    helpCount: 0,
    maxHelp: 2,

    start: function (container) {
      this.container = container;
      this.score = 0;
      this.helpCount = 0;
      this.maxHelp = 2;
      this.selected = null;
      this._buildGrid();
      this._render();
      this.running = true;
    },

    _buildGrid: function () {
      var self = this;
      this.grid = [];
      for (var r = 0; r < GOOSE_SIZE; r++) {
        var row = [];
        for (var c = 0; c < GOOSE_SIZE; c++) {
          row.push({ emoji: GOOSE_EMOJIS[Math.floor(Math.random() * GOOSE_EMOJIS.length)], clearing: false, falling: false });
        }
        this.grid.push(row);
      }
      // 消除初始三连，保证有解
      this._removeInitialMatches();
      void self;
    },

    _removeInitialMatches: function () {
      var self = this;
      // 简单清理：反复消除直到无三连
      var guard = 0;
      while (this._findMatches().length && guard < 50) {
        var matches = this._findMatches();
        matches.forEach(function (m) { self.grid[m.r][m.c].emoji = GOOSE_EMOJIS[Math.floor(Math.random() * GOOSE_EMOJIS.length)]; });
        guard++;
      }
    },

    _findMatches: function () {
      var matches = [];
      var visited = {};
      // 横向
      for (var r = 0; r < GOOSE_SIZE; r++) {
        var run = 1;
        for (var c = 1; c <= GOOSE_SIZE; c++) {
          var cur = this.grid[r][c - 1] ? this.grid[r][c - 1].emoji : null;
          var nxt = (c < GOOSE_SIZE && this.grid[r][c]) ? this.grid[r][c].emoji : null;
          if (c < GOOSE_SIZE && cur && nxt && cur === nxt) {
            run++;
          } else {
            if (run >= 3 && cur) {
              for (var k = c - run; k < c; k++) matches.push({ r: r, c: k });
            }
            run = 1;
          }
        }
      }
      // 纵向
      for (var col = 0; col < GOOSE_SIZE; col++) {
        var run2 = 1;
        for (var rr = 1; rr <= GOOSE_SIZE; rr++) {
          var cur2 = this.grid[rr - 1][col] ? this.grid[rr - 1][col].emoji : null;
          var nxt2 = (rr < GOOSE_SIZE && this.grid[rr][col]) ? this.grid[rr][col].emoji : null;
          if (rr < GOOSE_SIZE && cur2 && nxt2 && cur2 === nxt2) {
            run2++;
          } else {
            if (run2 >= 3 && cur2) {
              for (var k2 = rr - run2; k2 < rr; k2++) matches.push({ r: k2, c: col });
            }
            run2 = 1;
          }
        }
      }
      var uniq = [];
      var seen = {};
      matches.forEach(function (m) {
        var key = m.r + '_' + m.c;
        if (!seen[key]) { seen[key] = true; uniq.push(m); }
      });
      return uniq;
    },

    _render: function () {
      var self = this;
      var html =
        '<div class="game-topbar glass-card">' +
          '<div class="game-topbar-info"><span class="chip">分数 <b id="goose-score">' + this.score + '</b></span><span class="chip">求助 <b id="goose-help-left">' + (this.maxHelp - this.helpCount) + '</b>/' + this.maxHelp + '</span></div>' +
          '<div class="game-topbar-actions">' +
            '<button class="game-icon-btn" onclick="MiniGameGoose.restart()" title="重开"><i class="fas fa-rotate-left"></i></button>' +
            '<button class="game-icon-btn game-help-btn" onclick="MiniGameGoose.askHelp()" title="求助TA"><i class="fas fa-heart"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="help-bubble-wrap"></div>' +
        '<div class="goose-board" id="goose-board" style="grid-template-columns:repeat(' + GOOSE_SIZE + ',1fr)"></div>' +
        '<div class="goose-tip">点击选中一块，再点相邻的交换；连成 3 个及以上即可消除，没有上限，可以一直玩下去～</div>' +
        '<div class="game-actions">' +
          '<button class="glass-btn primary" onclick="MiniGameGoose.askHelp()"><i class="fas fa-heart"></i> 求助 TA</button>' +
        '</div>';
      this.container.innerHTML = html;
      this._renderBoard();
    },

    _renderBoard: function () {
      var self = this;
      var board = this.container.querySelector('#goose-board');
      if (!board) return;
      board.innerHTML = '';
      for (var r = 0; r < GOOSE_SIZE; r++) {
        for (var c = 0; c < GOOSE_SIZE; c++) {
          var cell = document.createElement('div');
          cell.className = 'goose-cell';
          cell.dataset.r = r;
          cell.dataset.c = c;
          if (this.grid[r][c].emoji) {
            cell.textContent = this.grid[r][c].emoji;
          } else {
            cell.classList.add('clearing');
          }
          if (this.selected && this.selected.r === r && this.selected.c === c) cell.classList.add('selected');
          cell.onclick = function () { self._onCellClick(parseInt(this.dataset.r), parseInt(this.dataset.c)); };
          board.appendChild(cell);
        }
      }
    },

    _onCellClick: function (r, c) {
      if (!this.running) return;
      if (!this.selected) {
        this.selected = { r: r, c: c };
        this._renderBoard();
        return;
      }
      var sr = this.selected.r, sc = this.selected.c;
      var adj = (Math.abs(r - sr) + Math.abs(c - sc)) === 1;
      if (adj) {
        this._swap(sr, sc, r, c);
        this.selected = null;
      } else {
        this.selected = { r: r, c: c };
        this._renderBoard();
      }
    },

    _swap: function (r1, c1, r2, c2) {
      var self = this;
      var t = this.grid[r1][c1];
      this.grid[r1][c1] = this.grid[r2][c2];
      this.grid[r2][c2] = t;
      var matches = this._findMatches();
      if (matches.length === 0) {
        // 交换无效，换回
        var t2 = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = t2;
        this._renderBoard();
        toast('这样换消不掉哦，试试别的');
        return;
      }
      this._updateTopbar();
      this._resolveMatches();
      void self;
    },

    _resolveMatches: function () {
      var self = this;
      var matches = this._findMatches();
      if (matches.length === 0) {
        this._checkState();
        return;
      }
      // 标记消除
      matches.forEach(function (m) { self.grid[m.r][m.c].clearing = true; });
      // 立即清空被消除格子的内容（下落依赖于此）
      matches.forEach(function (m) { self.grid[m.r][m.c].emoji = null; });
      this._renderBoard();
      var gained = matches.length * 20;
      this.score += gained;
      var board = this.container.querySelector('#goose-board');
      var els = board.querySelectorAll('.goose-cell');
      els.forEach(function (el) {
        var r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
        if (self.grid[r][c].clearing) el.classList.add('clearing');
      });
      this._updateTopbar();
      setTimeout(function () {
        matches.forEach(function (m) { self.grid[m.r][m.c].clearing = false; });
        self._dropAndFill();
      }, 300);
    },

    _dropAndFill: function () {
      var self = this;
      // 每列下落：从底部往上收集非空格子
      for (var c = 0; c < GOOSE_SIZE; c++) {
        var col = [];
        for (var r = GOOSE_SIZE - 1; r >= 0; r--) {
          if (this.grid[r][c].emoji) col.push(this.grid[r][c].emoji);
        }
        // 从底部重新填充，顶部补新随机
        for (var r2 = GOOSE_SIZE - 1; r2 >= 0; r2--) {
          var colIdx = GOOSE_SIZE - 1 - r2;
          if (colIdx < col.length) {
            this.grid[r2][c].emoji = col[colIdx];
          } else {
            this.grid[r2][c].emoji = GOOSE_EMOJIS[Math.floor(Math.random() * GOOSE_EMOJIS.length)];
          }
          this.grid[r2][c].clearing = false;
        }
      }
      this._renderBoard();
      // 检查是否还有新的连锁
      var next = this._findMatches();
      if (next.length) {
        setTimeout(function () { self._resolveMatches(); }, 150);
      } else {
        this._checkState();
      }
    },

    _checkState: function () {
      if (!this.running) return;
      // 无分数/步数上限：可以一直玩下去，仅重开时刷新
    },

    _updateTopbar: function () {
      var s = this.container.querySelector('#goose-score');
      if (s) s.textContent = this.score;
      var h = this.container.querySelector('#goose-help-left');
      if (h) h.textContent = this.maxHelp - this.helpCount;
    },

    askHelp: function () {
      if (!this.running) return;
      if (this.helpCount >= this.maxHelp) { toast('求助次数用完啦'); return; }
      var self = this;
      this.helpCount++;
      this._updateTopbar();
      showHelpBubble(this.container, '<b>' + getPartner().nickname + '</b>：' + randomHelpText());
      setTimeout(function () { self._doHelpEliminate(); }, 500);
    },

    _doHelpEliminate: function () {
      // 找到一组可消并直接消除（不耗步数），或找到一个可交换消除的交换
      var self = this;
      var matches = this._findMatches();
      if (matches.length >= 3) {
        matches = matches.slice(0, Math.min(matches.length, 5));
        matches.forEach(function (m) { self.grid[m.r][m.c].clearing = true; });
        // 与正常消除一致：清空被消除格子的内容，保证下落正确
        matches.forEach(function (m) { self.grid[m.r][m.c].emoji = null; });
        var board = this.container.querySelector('#goose-board');
        var els = board.querySelectorAll('.goose-cell');
        els.forEach(function (el) {
          var r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
          if (self.grid[r][c].clearing) el.classList.add('clearing');
        });
        var gained = matches.length * 20;
        this.score += gained;
        this._updateTopbar();
        setTimeout(function () {
          matches.forEach(function (m) { self.grid[m.r][m.c].clearing = false; });
          self._dropAndFill();
        }, 320);
        return;
      }
      // 否则尝试找一个交换
      for (var r = 0; r < GOOSE_SIZE; r++) {
        for (var c = 0; c < GOOSE_SIZE; c++) {
          var dirs = [[0, 1], [1, 0]];
          for (var d = 0; d < dirs.length; d++) {
            var nr = r + dirs[d][0], nc = c + dirs[d][1];
            if (nr >= GOOSE_SIZE || nc >= GOOSE_SIZE) continue;
            // 尝试交换
            var t = this.grid[r][c];
            this.grid[r][c] = this.grid[nr][nc];
            this.grid[nr][nc] = t;
            if (this._findMatches().length) {
              // 交换成功，标记候选并直接执行这次消除
              var board = this.container.querySelector('#goose-board');
              var els = board.querySelectorAll('.goose-cell');
              var hint = {};
              hint[r + '_' + c] = true; hint[nr + '_' + nc] = true;
              els.forEach(function (el) {
                var rr = parseInt(el.dataset.r), cc = parseInt(el.dataset.c);
                if (hint[rr + '_' + cc]) el.classList.add('candidate');
              });
              // 实际直接执行这次消除
              this._updateTopbar();
              this._resolveMatches();
              return;
            }
            // 还原
            var t2 = this.grid[r][c];
            this.grid[r][c] = this.grid[nr][nc];
            this.grid[nr][nc] = t2;
          }
        }
      }
      toast('暂时没有可消除的，试试重开吧');
    },

    restart: function () {
      this.start(this.container);
    }
  };

  window.MiniGameGoose = {
    start: function (container) { GooseGame.start(container); },
    restart: function () { GooseGame.restart(); },
    askHelp: function () { GooseGame.askHelp(); }
  };


  /* ============================================================
     渲染入口（供 navigation 调用）
     ============================================================ */
  window.renderMiniGames = function () {
    var container = document.getElementById('mini-games-container');
    if (!container) return;
    container.innerHTML =
      '<div class="games-list">' +
        '<div class="game-entry glass-card" onclick="Navigation.navigateTo(\'game-sheep\')">' +
          '<div class="game-entry-icon ge-sheep">🐑</div>' +
          '<div class="game-entry-info"><h3>羊了个羊</h3><p>多层牌堆，点牌入槽，三张相同自动消除。层层叠叠，考验你的眼力～</p><span class="game-badge">经典三消</span></div>' +
          '<i class="fas fa-chevron-right game-entry-arrow"></i>' +
        '</div>' +
        '<div class="game-entry glass-card" onclick="Navigation.navigateTo(\'game-goose\')">' +
          '<div class="game-entry-icon ge-goose">🦢</div>' +
          '<div class="game-entry-info"><h3>消消乐</h3><p>7×7 网格交换三消，连成 3 个消除得分，没有上限，可以一直玩下去～</p><span class="game-badge">交换三消</span></div>' +
          '<i class="fas fa-chevron-right game-entry-arrow"></i>' +
        '</div>' +
        '<div class="game-entry glass-card" onclick="Navigation.navigateTo(\'game-llk\')">' +
          '<div class="game-entry-icon ge-llk">🎯</div>' +
          '<div class="game-entry-info"><h3>连连看</h3><p>找出两张相同图案，之间没有阻挡就能连上消除，全部配对即通关！</p><span class="game-badge">连线消除</span></div>' +
          '<i class="fas fa-chevron-right game-entry-arrow"></i>' +
        '</div>' +
        '<div class="game-entry glass-card" onclick="Navigation.navigateTo(\'game-2048\')">' +
          '<div class="game-entry-icon ge-2048">🔢</div>' +
          '<div class="game-entry-info"><h3>2048</h3><p>滑动或按方向键合并数字，凑到 2048 就赢，和 TA 一起脑力冲刺！</p><span class="game-badge">数字合并</span></div>' +
          '<i class="fas fa-chevron-right game-entry-arrow"></i>' +
        '</div>' +
        '<div class="game-entry glass-card" onclick="Navigation.navigateTo(\'game-memory\')">' +
          '<div class="game-entry-icon ge-memory">💞</div>' +
          '<div class="game-entry-info"><h3>记忆翻牌</h3><p>翻开两张找相同图案，考验你和 TA 的默契与记忆力！</p><span class="game-badge">翻牌配对</span></div>' +
          '<i class="fas fa-chevron-right game-entry-arrow"></i>' +
        '</div>' +
      '</div>';
  };

  window.renderGameSheep = function () {
    var container = document.getElementById('game-sheep-container');
    if (!container) return;
    SheepGame.start(container);
  };

  window.renderGameGoose = function () {
    var container = document.getElementById('game-goose-container');
    if (!container) return;
    GooseGame.start(container);
  };



  /* ============================================================
     3. 连连看（连线消除配对）
     ============================================================ */
  var LLK_ROWS = 4, LLK_COLS = 6;
  var LLK_EMOJIS = ['❤️', '🌹', '⭐', '🍀', '🌈', '🎀', '🍰', '🐰', '🌸', '🍑', '💎', '☁️'];

  var LlkGame = {
    grid: [],       // 二维 {emoji} | null
    selected: null, // {r, c}
    left: 0,
    running: false,
    helpCount: 0,
    maxHelp: 3,

    start: function (container) {
      this.container = container;
      this.helpCount = 0;
      this.maxHelp = 3;
      this.selected = null;
      this._boardPlayed = false;   // 开局整板播放一次入场动画，之后消除重绘不再重放
      this._build();
      this._render();
      this.running = true;
    },

    _build: function () {
      var pairs = (LLK_ROWS * LLK_COLS) / 2;
      var pool = [];
      for (var i = 0; i < pairs; i++) {
        var em = LLK_EMOJIS[i % LLK_EMOJIS.length];
        pool.push(em, em);
      }
      pool = shuffle(pool);
      this.grid = [];
      var k = 0;
      for (var r = 0; r < LLK_ROWS; r++) {
        var row = [];
        for (var c = 0; c < LLK_COLS; c++) {
          row.push({ emoji: pool[k++] });
        }
        this.grid.push(row);
      }
      this.left = pairs;
    },

    _get: function (r, c) {
      if (r < 0 || c < 0 || r >= LLK_ROWS || c >= LLK_COLS) return null;
      return this.grid[r][c];
    },

    // 判断 (r1,c1) 到 (r2,c2) 能否用 ≤2 个拐点的连线连通
    _canConnect: function (a, b) {
      if (a.r === b.r && a.c === b.c) return false;
      if (this._get(a.r, a.c) == null || this._get(b.r, b.c) == null) return false;
      // 直线
      if ((a.r === b.r || a.c === b.c) && this._lineFree(a.r, a.c, b.r, b.c)) return true;
      // 1 拐点
      if (this._get(a.r, b.c) == null && this._lineFree(a.r, a.c, a.r, b.c) && this._lineFree(b.r, b.c, a.r, b.c)) return true;
      if (this._get(b.r, a.c) == null && this._lineFree(a.r, a.c, b.r, a.c) && this._lineFree(b.r, b.c, b.r, a.c)) return true;
      // 2 拐点：横向桥
      for (var rr = 0; rr < LLK_ROWS; rr++) {
        if (this._get(rr, a.c) == null && this._get(rr, b.c) == null &&
            this._lineFree(a.r, a.c, rr, a.c) && this._lineFree(rr, a.c, rr, b.c) && this._lineFree(rr, b.c, b.r, b.c)) return true;
      }
      // 2 拐点：纵向桥
      for (var cc = 0; cc < LLK_COLS; cc++) {
        if (this._get(a.r, cc) == null && this._get(b.r, cc) == null &&
            this._lineFree(a.r, a.c, a.r, cc) && this._lineFree(a.r, cc, b.r, cc) && this._lineFree(b.r, cc, b.r, b.c)) return true;
      }
      return false;
    },

    // 同行或同列的两点之间无障碍
    _lineFree: function (r1, c1, r2, c2) {
      if (r1 === r2) {
        var lo = Math.min(c1, c2), hi = Math.max(c1, c2);
        for (var c = lo + 1; c < hi; c++) {
          if (this._get(r1, c) != null) return false;
        }
        return true;
      }
      if (c1 === c2) {
        var lo2 = Math.min(r1, r2), hi2 = Math.max(r1, r2);
        for (var r = lo2 + 1; r < hi2; r++) {
          if (this._get(r, c1) != null) return false;
        }
        return true;
      }
      return false;
    },

    _render: function () {
      var html =
        '<div class="game-topbar glass-card">' +
          '<div class="game-topbar-info"><span class="chip">剩余 <b id="llk-left">' + this.left + '</b> 对</span><span class="chip">求助 <b id="llk-help-left">' + (this.maxHelp - this.helpCount) + '</b>/' + this.maxHelp + '</span></div>' +
          '<div class="game-topbar-actions">' +
            '<button class="game-icon-btn" onclick="MiniGameLlk.restart()" title="重开"><i class="fas fa-rotate-left"></i></button>' +
            '<button class="game-icon-btn game-help-btn" onclick="MiniGameLlk.askHelp()" title="求助TA"><i class="fas fa-heart"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="help-bubble-wrap"></div>' +
        '<div class="llk-board" id="llk-board"></div>' +
        '<div class="goose-tip">点选一张，再点另一张相同图案，两点间直线或 1~2 个拐角内无阻挡即可消除</div>' +
        '<div class="game-actions">' +
          '<button class="glass-btn primary" onclick="MiniGameLlk.askHelp()"><i class="fas fa-heart"></i> 求助 TA</button>' +
        '</div>';
      this.container.innerHTML = html;
      this._renderBoard();
    },

    _renderBoard: function () {
      var self = this;
      var board = this.container.querySelector('#llk-board');
      if (!board) return;
      board.innerHTML = '';
      // 仅首次/重开整板渲染时播放入场动画，其余重绘（选中、消除、洗牌）不播放，避免方块闪烁
      board.classList.toggle('init-anim', !this._boardPlayed);
      this._boardPlayed = true;
      for (var r = 0; r < LLK_ROWS; r++) {
        for (var c = 0; c < LLK_COLS; c++) {
          var cell = document.createElement('div');
          cell.className = 'llk-cell';
          cell.dataset.r = r;
          cell.dataset.c = c;
          var item = this.grid[r][c];
          if (item) cell.textContent = item.emoji;
          if (this.selected && this.selected.r === r && this.selected.c === c) cell.classList.add('selected');
          cell.onclick = function () { self._onCellClick(parseInt(this.dataset.r), parseInt(this.dataset.c)); };
          board.appendChild(cell);
        }
      }
    },

    _onCellClick: function (r, c) {
      if (!this.running) return;
      var item = this._get(r, c);
      if (!item) return;
      if (!this.selected) {
        this.selected = { r: r, c: c };
        this._renderBoard();
        return;
      }
      var a = this.selected;
      if (a.r === r && a.c === c) {
        this.selected = null;
        this._renderBoard();
        return;
      }
      var aItem = this._get(a.r, a.c);
      if (aItem && aItem.emoji === item.emoji && this._canConnect(a, { r: r, c: c })) {
        this._eliminate(a, { r: r, c: c });
      } else {
        this.selected = { r: r, c: c };
        this._renderBoard();
      }
    },

    _eliminate: function (a, b) {
      var self = this;
      this.selected = null;
      var board = this.container.querySelector('#llk-board');
      var cells = board.querySelectorAll('.llk-cell');
      cells.forEach(function (el) {
        var rr = parseInt(el.dataset.r), cc = parseInt(el.dataset.c);
        if ((rr === a.r && cc === a.c) || (rr === b.r && cc === b.c)) el.classList.add('clearing');
      });
      this.grid[a.r][a.c] = null;
      this.grid[b.r][b.c] = null;
      this.left--;
      setTimeout(function () {
        self._updateTopbar();
        self._renderBoard();
        self._checkWin();
        self._ensureSolvable();
      }, 320);
    },

    _updateTopbar: function () {
      var l = this.container.querySelector('#llk-left');
      if (l) l.textContent = this.left;
      var h = this.container.querySelector('#llk-help-left');
      if (h) h.textContent = this.maxHelp - this.helpCount;
    },

    _findPairs: function () {
      var pairs = [];
      for (var r1 = 0; r1 < LLK_ROWS; r1++) {
        for (var c1 = 0; c1 < LLK_COLS; c1++) {
          var a = this.grid[r1][c1];
          if (!a) continue;
          for (var r2 = r1; r2 < LLK_ROWS; r2++) {
            for (var c2 = (r2 === r1 ? c1 + 1 : 0); c2 < LLK_COLS; c2++) {
              var b = this.grid[r2][c2];
              if (!b || b.emoji !== a.emoji) continue;
              if (this._canConnect({ r: r1, c: c1 }, { r: r2, c: c2 })) pairs.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } });
            }
          }
        }
      }
      return pairs;
    },

    _ensureSolvable: function () {
      if (this.left <= 0) return;
      if (this._findPairs().length === 0) {
        toast('有点难连上啦，已帮你重新洗牌');
        this._rebuildRemain();
        this._renderBoard();
      }
    },

    _rebuildRemain: function () {
      var remain = [];
      for (var r = 0; r < LLK_ROWS; r++) {
        for (var c = 0; c < LLK_COLS; c++) {
          if (this.grid[r][c]) remain.push(this.grid[r][c].emoji);
        }
      }
      remain = shuffle(remain);
      var k = 0;
      for (var r2 = 0; r2 < LLK_ROWS; r2++) {
        for (var c2 = 0; c2 < LLK_COLS; c2++) {
          this.grid[r2][c2] = k < remain.length ? { emoji: remain[k++] } : null;
        }
      }
    },

    _checkWin: function () {
      if (this.left === 0) {
        this.running = false;
        showOverlay('🎉', '全部连上啦！', getRewardQuote(), '再来一局', function () { LlkGame.restart(); });
      }
    },

    askHelp: function () {
      if (!this.running) return;
      if (this.helpCount >= this.maxHelp) { toast('求助次数已用完啦，试试重开吧'); return; }
      var self = this;
      this.helpCount++;
      this._updateTopbar();
      showHelpBubble(this.container, '<b>' + getPartner().nickname + '</b>：' + randomHelpText());
      setTimeout(function () { self._doHelpEliminate(); }, 500);
    },

    _doHelpEliminate: function () {
      var pairs = this._findPairs();
      if (!pairs.length) {
        toast('暂时没有能连的，先重开吧');
        return;
      }
      var pick = pairs[0];
      this._eliminate(pick.a, pick.b);
    },

    restart: function () {
      this.start(this.container);
    }
  };

  window.MiniGameLlk = {
    start: function (container) { LlkGame.start(container); },
    restart: function () { LlkGame.restart(); },
    askHelp: function () { LlkGame.askHelp(); }
  };

  /* ============================================================
     4. 2048（数字合并）
     ============================================================ */
  var G2048_SIZE = 4;

  var Game2048 = {
    board: [],    // 二维数字，0 为空
    score: 0,
    target: 2048,
    running: false,
    helpCount: 0,
    maxHelp: 3,
    _keyHandler: null,
    _touch: null,

    start: function (container) {
      this.container = container;
      this.score = 0;
      this.helpCount = 0;
      this.maxHelp = 3;
      this.board = [];
      for (var r = 0; r < G2048_SIZE; r++) {
        var row = [];
        for (var c = 0; c < G2048_SIZE; c++) row.push(0);
        this.board.push(row);
      }
      this._addTile();
      this._addTile();
      this._render();
      this._bind();
      this.running = true;
    },

    _addTile: function () {
      var empty = [];
      for (var r = 0; r < G2048_SIZE; r++) {
        for (var c = 0; c < G2048_SIZE; c++) {
          if (this.board[r][c] === 0) empty.push([r, c]);
        }
      }
      if (!empty.length) return;
      var p = empty[Math.floor(Math.random() * empty.length)];
      this.board[p[0]][p[1]] = Math.random() < 0.9 ? 2 : 4;
    },

    _render: function () {
      var html =
        '<div class="game-topbar glass-card">' +
          '<div class="game-topbar-info"><span class="chip">分数 <b id="g2048-score">' + this.score + '</b></span><span class="chip">目标 <b>' + this.target + '</b></span><span class="chip">求助 <b id="g2048-help-left">' + (this.maxHelp - this.helpCount) + '</b>/' + this.maxHelp + '</span></div>' +
          '<div class="game-topbar-actions">' +
            '<button class="game-icon-btn" onclick="MiniGame2048.restart()" title="重开"><i class="fas fa-rotate-left"></i></button>' +
            '<button class="game-icon-btn game-help-btn" onclick="MiniGame2048.askHelp()" title="求助TA"><i class="fas fa-heart"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="help-bubble-wrap"></div>' +
        '<div class="g2048-board" id="g2048-board"></div>' +
        '<div class="g2048-dpad">' +
          '<button class="g2048-dpad-btn" data-dir="up">▲</button>' +
          '<button class="g2048-dpad-btn" data-dir="left">◀</button>' +
          '<button class="g2048-dpad-btn" data-dir="down">▼</button>' +
          '<button class="g2048-dpad-btn" data-dir="right">▶</button>' +
        '</div>' +
        '<div class="goose-tip">键盘方向键或滑动屏幕移动方块，相同的数字撞在一起会合并</div>' +
        '<div class="game-actions">' +
          '<button class="glass-btn primary" onclick="MiniGame2048.askHelp()"><i class="fas fa-heart"></i> 求助 TA</button>' +
        '</div>';
      this.container.innerHTML = html;
      this._renderBoard();
      var self = this;
      var btns = this.container.querySelectorAll('.g2048-dpad-btn');
      btns.forEach(function (btn) {
        btn.onclick = function () { self._move(this.dataset.dir); };
      });
    },

    _tileClass: function (v) {
      return 'tile-' + (v > 0 ? Math.min(11, Math.round(Math.log2(v))) : 0);
    },

    _renderBoard: function () {
      var board = this.container.querySelector('#g2048-board');
      if (!board) return;
      board.innerHTML = '';
      for (var r = 0; r < G2048_SIZE; r++) {
        for (var c = 0; c < G2048_SIZE; c++) {
          var cell = document.createElement('div');
          cell.className = 'g2048-cell ' + this._tileClass(this.board[r][c]);
          cell.textContent = this.board[r][c] || '';
          board.appendChild(cell);
        }
      }
    },

    // 返回左移后的新行与合并得分
    _slideRow: function (row) {
      var arr = row.filter(function (v) { return v !== 0; });
      var out = [];
      var gained = 0;
      var i = 0;
      while (i < arr.length) {
        if (i + 1 < arr.length && arr[i] === arr[i + 1]) {
          out.push(arr[i] * 2);
          gained += arr[i] * 2;
          i += 2;
        } else {
          out.push(arr[i]);
          i++;
        }
      }
      while (out.length < G2048_SIZE) out.push(0);
      return { row: out, gained: gained };
    },

    _move: function (dir) {
      if (!this.running) return;
      var changed = false;
      var gained = 0;
      if (dir === 'left' || dir === 'right') {
        for (var r = 0; r < G2048_SIZE; r++) {
          var row = this.board[r].slice();
          if (dir === 'right') row.reverse();
          var res = this._slideRow(row);
          var newRow = res.row;
          if (dir === 'right') newRow.reverse();
          if (newRow.join(',') !== this.board[r].join(',')) {
            changed = true;
            this.board[r] = newRow;
          }
          gained += res.gained;
        }
      } else {
        for (var c = 0; c < G2048_SIZE; c++) {
          var col = [];
          for (var r2 = 0; r2 < G2048_SIZE; r2++) col.push(this.board[r2][c]);
          if (dir === 'down') col.reverse();
          var res2 = this._slideRow(col);
          var newCol = res2.row;
          if (dir === 'down') newCol.reverse();
          for (var r3 = 0; r3 < G2048_SIZE; r3++) {
            if (this.board[r3][c] !== newCol[r3]) changed = true;
            this.board[r3][c] = newCol[r3];
          }
          gained += res2.gained;
        }
      }
      if (!changed) return;
      this.score += gained;
      this._addTile();
      this._renderBoard();
      this._updateTopbar();
      this._checkState();
    },

    _updateTopbar: function () {
      var s = this.container.querySelector('#g2048-score');
      if (s) s.textContent = this.score;
      var h = this.container.querySelector('#g2048-help-left');
      if (h) h.textContent = this.maxHelp - this.helpCount;
    },

    _canMove: function () {
      for (var r = 0; r < G2048_SIZE; r++) {
        for (var c = 0; c < G2048_SIZE; c++) {
          if (this.board[r][c] === 0) return true;
          if (c + 1 < G2048_SIZE && this.board[r][c] === this.board[r][c + 1]) return true;
          if (r + 1 < G2048_SIZE && this.board[r][c] === this.board[r + 1][c]) return true;
        }
      }
      return false;
    },

    _checkState: function () {
      var hasWin = false;
      for (var r = 0; r < G2048_SIZE; r++) {
        for (var c = 0; c < G2048_SIZE; c++) {
          if (this.board[r][c] >= this.target) hasWin = true;
        }
      }
      if (hasWin) {
        this.running = false;
        showOverlay('🎉', '凑到 ' + this.target + ' 啦！', getRewardQuote(), '再来一局', function () { Game2048.restart(); });
        return;
      }
      if (!this._canMove()) {
        this.running = false;
        showOverlay('😵', '没地方动啦', '让 TA 帮帮你，或者重开一局吧～', '再试一次', function () { Game2048.restart(); });
      }
    },

    _bind: function () {
      var self = this;
      if (this._keyHandler) {
        document.removeEventListener('keydown', this._keyHandler);
      }
      this._keyHandler = function (e) {
        var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        if (map[e.key]) {
          e.preventDefault();
          self._move(map[e.key]);
        }
      };
      document.addEventListener('keydown', this._keyHandler);
      var board = this.container.querySelector('#g2048-board');
      this._touch = { sx: 0, sy: 0, active: false };
      board.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        self._touch = { sx: t.clientX, sy: t.clientY, active: true };
      }, { passive: true });
      board.addEventListener('touchmove', function (e) {
        if (self._touch && self._touch.active) e.preventDefault();
      }, { passive: false });
      board.addEventListener('touchend', function (e) {
        if (!self._touch || !self._touch.active) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - self._touch.sx;
        var dy = t.clientY - self._touch.sy;
        self._touch.active = false;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        e.preventDefault();
        self._move(dir);
      }, { passive: false });
    },

    _findHint: function () {
      for (var r = 0; r < G2048_SIZE; r++) {
        for (var c = 0; c < G2048_SIZE; c++) {
          var v = this.board[r][c];
          if (!v) continue;
          if (c + 1 < G2048_SIZE && this.board[r][c + 1] === v) return { a: [r, c], b: [r, c + 1] };
          if (r + 1 < G2048_SIZE && this.board[r + 1][c] === v) return { a: [r, c], b: [r + 1, c] };
        }
      }
      return null;
    },

    askHelp: function () {
      if (!this.running) return;
      if (this.helpCount >= this.maxHelp) { toast('求助次数已用完啦'); return; }
      var hint = this._findHint();
      if (!hint) { toast('暂时没有相邻可合并的，先移动一步试试'); return; }
      var self = this;
      this.helpCount++;
      this._updateTopbar();
      showHelpBubble(this.container, '<b>' + getPartner().nickname + '</b>：看到那两个 ' + this.board[hint.a[0]][hint.a[1]] + ' 了吗？把它们撞一起～');
      var cells = this.container.querySelectorAll('.g2048-cell');
      cells.forEach(function (cell, idx) {
        var r = Math.floor(idx / G2048_SIZE), c = idx % G2048_SIZE;
        if ((r === hint.a[0] && c === hint.a[1]) || (r === hint.b[0] && c === hint.b[1])) {
          cell.classList.add('hint');
        }
      });
    },

    restart: function () {
      this.start(this.container);
    }
  };

  window.MiniGame2048 = {
    start: function (container) { Game2048.start(container); },
    restart: function () { Game2048.restart(); },
    askHelp: function () { Game2048.askHelp(); }
  };

  /* ============================================================
     5. 记忆翻牌（翻牌配对）
     ============================================================ */
  var MEM_ROWS = 4, MEM_COLS = 4;
  var MEM_EMOJIS = ['❤️', '🌹', '⭐', '🍀', '🌈', '🎀', '🍰', '🐰'];

  var MemoryGame = {
    cards: [],      // {emoji, matched, flipped}
    first: null,
    lock: false,
    steps: 0,
    pairs: 0,
    totalPairs: (MEM_ROWS * MEM_COLS) / 2,
    running: false,
    helpCount: 0,
    maxHelp: 2,

    start: function (container) {
      this.container = container;
      this.steps = 0;
      this.pairs = 0;
      this.helpCount = 0;
      this.maxHelp = 2;
      this.first = null;
      this.lock = false;
      this._build();
      this._render();
      this.running = true;
    },

    _build: function () {
      var pool = [];
      for (var i = 0; i < this.totalPairs; i++) {
        var em = MEM_EMOJIS[i % MEM_EMOJIS.length];
        pool.push(em, em);
      }
      pool = shuffle(pool);
      this.cards = pool.map(function (em) { return { emoji: em, matched: false, flipped: false }; });
    },

    _render: function () {
      var html =
        '<div class="game-topbar glass-card">' +
          '<div class="game-topbar-info"><span class="chip">步数 <b id="mem-steps">' + this.steps + '</b></span><span class="chip">配对 <b id="mem-pairs">' + this.pairs + '</b>/' + this.totalPairs + '</span><span class="chip">求助 <b id="mem-help-left">' + (this.maxHelp - this.helpCount) + '</b>/' + this.maxHelp + '</span></div>' +
          '<div class="game-topbar-actions">' +
            '<button class="game-icon-btn" onclick="MiniGameMemory.restart()" title="重开"><i class="fas fa-rotate-left"></i></button>' +
            '<button class="game-icon-btn game-help-btn" onclick="MiniGameMemory.askHelp()" title="求助TA"><i class="fas fa-heart"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="help-bubble-wrap"></div>' +
        '<div class="memory-board" id="memory-board"></div>' +
        '<div class="goose-tip">翻开两张牌，图案相同即可配对，用最少的步数翻开所有牌吧</div>' +
        '<div class="game-actions">' +
          '<button class="glass-btn primary" onclick="MiniGameMemory.askHelp()"><i class="fas fa-heart"></i> 求助 TA</button>' +
        '</div>';
      this.container.innerHTML = html;
      this._renderBoard();
    },

    _renderBoard: function () {
      var self = this;
      var board = this.container.querySelector('#memory-board');
      if (!board) return;
      board.innerHTML = '';
      this.cards.forEach(function (card, idx) {
        var cell = document.createElement('div');
        cell.className = 'memory-card' + ((card.matched || card.flipped) ? ' flipped' : '') + (card.matched ? ' matched' : '');
        cell.dataset.idx = idx;
        cell.innerHTML =
          '<div class="memory-inner">' +
            '<div class="memory-face memory-back">✨</div>' +
            '<div class="memory-face memory-front">' + card.emoji + '</div>' +
          '</div>';
        cell.onclick = function () { self._onFlip(idx); };
        board.appendChild(cell);
      });
    },

    _updateCard: function (idx) {
      var card = this.cards[idx];
      if (!card) return;
      var board = this.container.querySelector('#memory-board');
      if (!board) return;
      var cell = board.children[idx];
      if (!cell) return;
      cell.className = 'memory-card' + ((card.matched || card.flipped) ? ' flipped' : '') + (card.matched ? ' matched' : '');
      var front = cell.querySelector('.memory-front');
      if (front) front.textContent = card.emoji;
    },

    _onFlip: function (idx) {
      if (!this.running || this.lock) return;
      var card = this.cards[idx];
      if (card.matched || card.flipped) return;
      if (this.first === idx) return;
      var self = this;
      card.flipped = true;
      this._updateCard(idx);
      if (this.first === null) {
        this.first = idx;
        return;
      }
      var firstIdx = this.first;
      var firstCard = this.cards[firstIdx];
      this.first = null;
      this.lock = true;
      this.steps++;
      this._updateTopbar();
      if (firstCard.emoji === card.emoji) {
        firstCard.matched = true;
        card.matched = true;
        this.pairs++;
        this.lock = false;
        this._updateCard(firstIdx);
        this._updateCard(idx);
        this._updateTopbar();
        this._checkWin();
      } else {
        setTimeout(function () {
          firstCard.flipped = false;
          card.flipped = false;
          self.lock = false;
          self._updateCard(firstIdx);
          self._updateCard(idx);
        }, 750);
      }
    },

    _updateTopbar: function () {
      var s = this.container.querySelector('#mem-steps');
      if (s) s.textContent = this.steps;
      var p = this.container.querySelector('#mem-pairs');
      if (p) p.textContent = this.pairs;
      var h = this.container.querySelector('#mem-help-left');
      if (h) h.textContent = this.maxHelp - this.helpCount;
    },

    _checkWin: function () {
      if (this.pairs === this.totalPairs) {
        this.running = false;
        showOverlay('🎉', '全部翻完啦！', getRewardQuote(), '再来一局', function () { MemoryGame.restart(); });
      }
    },

    askHelp: function () {
      if (!this.running) return;
      if (this.helpCount >= this.maxHelp) { toast('求助次数已用完啦'); return; }
      var self = this;
      this.helpCount++;
      this._updateTopbar();
      showHelpBubble(this.container, '<b>' + getPartner().nickname + '</b>：我看到啦，就是这两个！');
      setTimeout(function () { self._doHelpFlip(); }, 500);
    },

    _doHelpFlip: function () {
      var map = {};
      this.cards.forEach(function (card, idx) {
        if (card.matched) return;
        if (!map[card.emoji]) map[card.emoji] = [];
        map[card.emoji].push(idx);
      });
      var found = null;
      for (var em in map) {
        if (map[em].length >= 2) { found = map[em].slice(0, 2); break; }
      }
      if (!found) return;
      var self = this;
      found.forEach(function (idx) { self.cards[idx].flipped = true; self.cards[idx].matched = true; });
      this.pairs++;
      var self2 = this;
      found.forEach(function (idx) { self2._updateCard(idx); });
      this._updateTopbar();
      this._checkWin();
    },

    restart: function () {
      this.start(this.container);
    }
  };

  window.MiniGameMemory = {
    start: function (container) { MemoryGame.start(container); },
    restart: function () { MemoryGame.restart(); },
    askHelp: function () { MemoryGame.askHelp(); }
  };

  window.renderGameLlk = function () {
    var container = document.getElementById('game-llk-container');
    if (!container) return;
    LlkGame.start(container);
  };

  window.renderGame2048 = function () {
    var container = document.getElementById('game-2048-container');
    if (!container) return;
    Game2048.start(container);
  };

  window.renderGameMemory = function () {
    var container = document.getElementById('game-memory-container');
    if (!container) return;
    MemoryGame.start(container);
  };
})();
