/* ============================================================
   bookshelf.js — 小说书架（对标主流小说阅读器）
   功能：
     1. 书架展示（封面网格 + 进度记忆，localStorage 持久化元数据）
     2. 上传导入 txt 小说（FileReader + 双通道持久化，自动识别编码 / 去 BOM）
     3. 阅读器（全屏沉浸式：左右区域点击翻页 / 点中心弹出底部设置菜单 / 目录抽屉 / 进度记忆）

   存储策略（修复 file:// 刷新后导入不生效）：
     - 元数据 bookshelf_meta：localStorage 优先，失败则镜像写入 IndexedDB 兜底；
     - 正文 bookshelf_book_*：localStorage 优先（file:// 下 IndexedDB 不可用，且 IDB open
       可能永不 settle），带 ~4MB 容量预检；失败/超大则降级 IndexedDB（带 4s 超时）；
     - 所有写入均返回成功与否，失败明确提示原因，杜绝"静默吞错"。
   设计语言：毛玻璃卡片 + 主题变量（--primary / --glass-*），与全站一致
   ============================================================ */
(function () {
  'use strict';

  var META_KEY = 'bookshelf_meta';
  var SETTINGS_KEY = 'bookshelf_settings';
  var BOOK_KEY_PREFIX = 'bookshelf_book_';
  var LOCAL_LIMIT = 4 * 1024 * 1024; // localStorage 安全容量（UTF-16 字符数，Chrome 限额约 5MB）
  var BG_IMAGE_KEY = 'bookshelf_bg_image'; // IndexedDB 中阅读背景图（dataURL）的 key
  var BG_IMAGE_MAX_EDGE = 1600;            // 上传背景图压缩后的最长边（px）
  var BG_IMAGE_QUALITY = 0.82;             // JPEG 压缩质量
  var BG_IMAGE_LS_LIMIT = 2500 * 1024;     // 背景图 dataURL 允许直接存 localStorage 的长度上限（提高以降低对 IndexedDB 的依赖）

  /* ---- 封面渐变池（按书名 hash 取色，保持稳定） ---- */
  var COVERS = [
    'linear-gradient(135deg,#A6CAE4,#7FB0D8)',
    'linear-gradient(135deg,#C9B8E8,#A99BE0)',
    'linear-gradient(135deg,#F6C6A8,#EFA57E)',
    'linear-gradient(135deg,#B8E0C8,#8FCBA8)',
    'linear-gradient(135deg,#F6B8C8,#EE93AE)',
    'linear-gradient(135deg,#B8DCF0,#98C0D8)'
  ];

  /* ---- 阅读背景主题 ---- */
  var THEMES = [
    { id: 'paper',   name: '羊皮纸', bg: '#F6F1E6', text: '#4A4036', dim: '#8A7F6F' },
    { id: 'white',   name: '纯白',   bg: '#FFFFFF', text: '#3A4050', dim: '#8890A0' },
    { id: 'green',   name: '护眼绿', bg: '#E7F0E3', text: '#3E4A3C', dim: '#77866F' },
    { id: 'night',   name: '夜间',   bg: '#242830', text: '#B8BEC8', dim: '#7A8090' },
    { id: 'site',    name: '网站背景', bg: 'linear-gradient(160deg,#D8EEF8,#F0F6FA 55%,#E8F4FB)', text: '#3A4050', dim: '#8890A0' }
  ];
  var LINE_HEIGHTS = [1.6, 1.8, 2.0, 2.2];
  var ALIGNS = [
    { id: 'justify', name: '两端对齐' },
    { id: 'left',    name: '左对齐' },
    { id: 'center',  name: '居中' }
  ];

  /* ---- 工具 ---- */
  function toast(msg) {
    if (window.Core && typeof Core.toast === 'function') { Core.toast(msg); return; }
    try { alert(msg); } catch (e) {}
  }

  /* 判断十六进制颜色亮度：用于自定义背景自动选择深色/浅色文字 */
  function isDarkColor(hex) {
    var c = String(hex || '#FFFFFF').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16);
    var g = parseInt(c.substr(2, 2), 16);
    var b = parseInt(c.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }

  /* ---- 会话内 meta 缓存：localStorage 不可用时，IDB 异步回填后即时生效 ---- */
  var _metaCache = null;

  /* 存储错误分类：区分「配额满」与「禁用/不可用」两种真实原因 */
  function classifyStorageError(e) {
    if (!e) return 'unknown';
    var name = e.name || '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014) return 'quota';
    if (name === 'SecurityError' || name === 'InvalidStateError' || name === 'NotSupportedError') return 'disabled';
    return 'unknown';
  }

  function loadMeta() {
    if (_metaCache) return _metaCache;
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(META_KEY) || '[]'); } catch (e) { arr = []; }
    if (Array.isArray(arr)) _metaCache = arr;
    return Array.isArray(arr) ? arr : [];
  }

  /* 写入 meta：localStorage 尽力写，失败时异步降级 AppKVDB(IndexedDB，带 withTimeout 超时)。
     两者任一成功即成功（返回 Promise<{ok, lsError}>）；仅两者都失败才视为失败。 */
  function saveMeta(arr) {
    _metaCache = arr;
    var json = JSON.stringify(arr);
    var lsError = null;
    try { localStorage.setItem(META_KEY, json); lsError = null; }
    catch (e) { lsError = e; }
    if (!lsError) {
      // localStorage 成功：异步镜像 IndexedDB 权威层（fire-and-forget，带超时），
      // 保证 localStorage 被清理后刷新仍可从 IDB 恢复
      if (window.AppKVDB && window.indexedDB) {
        try { withTimeout(window.AppKVDB.put({ key: META_KEY, value: json, updatedAt: Date.now() }), 4000).catch(function () {}); } catch (e) {}
      }
      return Promise.resolve({ ok: true, lsError: null });
    }
    // localStorage 失败：异步降级 IndexedDB 权威层
    if (!window.AppKVDB || !window.indexedDB) {
      return Promise.resolve({ ok: false, lsError: lsError });
    }
    return withTimeout(window.AppKVDB.put({ key: META_KEY, value: json, updatedAt: Date.now() }), 4000)
      .then(function () { return { ok: true, lsError: null }; })
      .catch(function (idbErr) { return { ok: false, lsError: lsError, idbErr: idbErr }; });
  }

  /* localStorage 无数据/不可用时，从 AppKVDB 异步回填 meta 并回调触发书架重渲染，
     保证刷新后已导入书籍仍显示（IndexedDB 为权威持久层） */
  function backfillMetaFromIDB(cb) {
    if (!window.AppKVDB || !window.indexedDB) return;
    var localHas = false;
    try {
      var raw = localStorage.getItem(META_KEY);
      localHas = raw !== null;
      if (localHas) {
        // key 存在但内容为空数组（如曾被清空）时，仍尝试从 IndexedDB 权威层回填，避免误判
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 0) localHas = false;
      }
    } catch (e) { localHas = false; }
    if (localHas) return; // localStorage 已有有效数据，无需回填
    withTimeout(window.AppKVDB.get(META_KEY), 4000)
      .then(function (rec) {
        if (!rec || rec.value === undefined) return;
        var m;
        try { m = JSON.parse(rec.value); } catch (e) { m = null; }
        if (!Array.isArray(m)) return;
        _metaCache = m;
        try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {}
        if (typeof cb === 'function') cb(m);
      })
      .catch(function () {});
  }

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s) {
        if (!s.customBg) s.customBg = '#F6F1E6';
        if (!s.customBgImage) s.customBgImage = 0;
        if (s.customBgImage === 1 && s.customBgImageData === undefined) s.customBgImageData = null;
        return s;
      }
    } catch (e) {}
    return { fontSize: 17, lineHeight: 1.8, align: 'justify', theme: 'paper', indent: true, chapter: 0, customBg: '#F6F1E6', customBgImage: 0, customBgImageData: null };
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* Promise 超时包装：避免 file:// 下 IndexedDB open 挂起导致 never settle */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('storage timeout')); }, ms || 4000);
      Promise.resolve(promise).then(function (v) { clearTimeout(timer); resolve(v); },
                                      function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function hashOf(str) {
    var h = 0;
    if (!str) return 0;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function coverOf(title) { return COVERS[hashOf(title) % COVERS.length]; }

  /* ---- 章节切分：匹配 "第X章/回/节/卷/部" 开头行 ---- */
  function splitChapters(content) {
    var lines = String(content || '').split(/\r?\n/);
    var chapters = [];
    var cur = { title: '', body: [] };
    var titleRe = /^\s*(第[0-9０-９一二三四五六七八九十百千万零〇]+[章节回卷集部篇].{0,40})\s*$/;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (titleRe.test(ln)) {
        if (cur.body.length || cur.title) chapters.push(cur);
        cur = { title: ln, body: [] };
      } else if (ln) {
        cur.body.push(lines[i]);
      }
    }
    if (cur.body.length || cur.title) chapters.push(cur);
    if (!chapters.length && String(content || '').trim()) {
      chapters.push({ title: '正文', body: [content] });
    }
    return chapters;
  }

  /* ---- 编码识别（UTF-8 → GBK 回退）+ 显式剥 BOM ---- */
  function decodeBuffer(buf) {
    var s = '';
    try { s = new TextDecoder('utf-8', { fatal: false }).decode(buf); }
    catch (e) { try { s = new TextDecoder('utf-8').decode(buf); } catch (e2) { s = ''; } }
    var bad = (s.match(/\uFFFD/g) || []).length;
    var ratio = buf.byteLength > 0 ? bad / buf.byteLength : 0;
    if (ratio > 0.01) {
      try { s = new TextDecoder('gbk').decode(buf); } catch (e3) {}
    }
    // 去 BOM（utf-8-sig）
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    return s;
  }

  /* ---- 查找用户书（书架仅保留用户上传的书籍，无内置书） ---- */
  function findBook(id) {
    var meta = loadMeta();
    for (var i = 0; i < meta.length; i++) { if (meta[i].id === id) { return meta[i]; } }
    return null;
  }

  var BookshelfApp = {
    state: { view: 'shelf', bookId: null, chapter: 0 },
    _chapters: null,
    _pageIdx: 0,
    _totalPages: 1,
    _pageWidth: 0,
    _gap: 34,

    /* ================= 书架视图 ================= */
    render: function () {
      var container = document.getElementById('bookshelf-container');
      if (!container) return;
      if (this.state.view === 'reader') { this._renderReader(container); return; }
      this._renderShelf(container);
      // localStorage 无数据时异步从 IndexedDB 回填 meta，回填成功后重渲染书架（保证刷新后书籍仍显示）
      var self = this;
      backfillMetaFromIDB(function () {
        if (self.state.view === 'shelf') { self._renderShelf(container); }
      });
    },

    /* 阅读时隐藏页面顶栏，返回书架时恢复 */
    _syncHeader: function (hide) {
      var header = document.querySelector('#page-bookshelf > .page-header');
      if (header) header.classList.toggle('reader-hide', !!hide);
    },
    /* 阅读时隐藏全局底栏（全屏沉浸） */
    _syncReadingMode: function (on) {
      var page = document.getElementById('page-bookshelf');
      if (page) page.classList.toggle('reader-active', !!on);
      if (on) document.body.classList.add('reading-mode');
      else document.body.classList.remove('reading-mode');
    },

    _renderShelf: function (container) {
      container.classList.remove('reader-mode');
      this._syncHeader(false);
      this._syncReadingMode(false);
      var meta = loadMeta();
      if (!meta.length) {
        container.innerHTML =
          '<div class="bookshelf-empty glass-card">' +
            '<div class="bookshelf-empty-icon"><i class="fas fa-book-open"></i></div>' +
            '<div class="bookshelf-empty-title">书架空空如也</div>' +
            '<div class="bookshelf-empty-tip">点击右上角「+」导入小说，上传你喜欢的 txt 小说<br>从此拥有一间随时可读的移动书房</div>' +
          '</div>';
        return;
      }
      var html = '<div class="bookshelf-grid">';
      for (var i = 0; i < meta.length; i++) {
        var b = meta[i];
        var progress = b.progress || 0;
        var latest = '';
        if (b.chapterTitle && b.chapterCount && b.chapterCount > 1) {
          latest = '读到 ' + b.chapterTitle;
        } else if (progress > 0) {
          latest = '读到 ' + progress + '%';
        } else {
          latest = '未开始阅读';
        }
        html +=
          '<div class="book-card" onclick="BookshelfApp.openReader(\'' + b.id + '\')">' +
            '<div class="book-cover" style="background:' + coverOf(b.title) + '">' +
              '<span class="book-cover-title">' + this._esc(b.title) + '</span>' +
            '</div>' +
            '<div class="book-name">' + this._esc(b.title) + '</div>' +
            '<div class="book-progress-track"><div class="book-progress-bar" style="width:' + progress + '%"></div></div>' +
            '<div class="book-latest">' + this._esc(latest) + '</div>' +
            '<div class="book-actions">' +
              '<button class="book-del" onclick="event.stopPropagation();BookshelfApp.removeBook(\'' + b.id + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
      container.innerHTML = html;
    },

    /* ================= 导入 ================= */
    openImport: function () {
      var input = document.getElementById('bookshelf-file-input');
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'bookshelf-file-input';
        input.accept = '.txt,text/plain';
        input.style.display = 'none';
        input.addEventListener('change', function () { BookshelfApp._onFile(input); });
        document.body.appendChild(input);
      }
      input.value = '';
      input.click();
    },

    _onFile: function (input) {
      var file = input.files && input.files[0];
      if (!file) return;
      var title = file.name.replace(/\.txt$/i, '') || '未命名小说';
      var reader = new FileReader();
      reader.onload = function () {
        var content = decodeBuffer(reader.result);
        if (!String(content).trim()) { toast('文件内容为空，导入失败'); return; }
        var id = 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        var chapters = splitChapters(content);

        // 1) 元数据：localStorage 优先，失败则 IndexedDB 镜像兜底；写入失败必须明确告知
        var meta = loadMeta();
        var bookRec = {
          id: id, title: title, addedAt: Date.now(), lastReadAt: null,
          progress: 0, chapter: 0, chapterCount: chapters.length,
          chapterTitle: chapters.length ? chapters[0].title : '',
          pageRatio: 0, pageIdx: 0
        };
        meta.unshift(bookRec);
        // 1) 元数据：localStorage 尽力写，失败异步降级 AppKVDB(IndexedDB，带超时)；两者任一成功即继续，
        //    仅两者都失败才报致命错误，且按真实原因区分「禁用」与「配额满」并给出可执行建议
        saveMeta(meta).then(function (metaRes) {
          if (!metaRes.ok) {
            if (metaRes.lsError && classifyStorageError(metaRes.lsError) === 'quota') {
              toast('导入失败：本地存储空间已满，无法保存书架记录。\n建议：1) 删除部分书籍腾出空间后重试；2) 或改用本地服务访问本应用（在网站目录执行 python3 -m http.server，再访问 http://localhost:8000）');
            } else {
              toast('导入失败：浏览器已禁用本地存储，且 IndexedDB 也不可用，无法保存书架记录。\n建议：1) 允许浏览器存储数据（Chrome 设置 → 隐私和安全 → 网站设置 → 内容 → Cookie 和网站数据）；2) 或改用本地服务访问本应用（在网站目录执行 python3 -m http.server，再访问 http://localhost:8000）');
            }
            return;
          }
          BookshelfApp.render();

          // 2) 正文：localStorage 优先（file:// 下可靠），带容量预检；失败/超大降级 IndexedDB（带超时）
          var persist = function () {
            var lsErr = null;
            if (content.length <= LOCAL_LIMIT) {
              try {
                localStorage.setItem(BOOK_KEY_PREFIX + id, content);
                // 双通道冗余：localStorage 写成功后必须异步镜像 IndexedDB 权威层
                //（fire-and-forget 带超时，失败静默——localStorage 已成功即不丢书），
                // 保证 localStorage 被清空/禁用后刷新仍可从 IDB 恢复正文
                if (window.AppKVDB && window.indexedDB) {
                  try { withTimeout(window.AppKVDB.put({ key: BOOK_KEY_PREFIX + id, value: content }), 4000).catch(function () {}); } catch (e) {}
                }
                toast('《' + title + '》导入成功');
                return;
              } catch (e) { lsErr = e; /* 配额满 / 存储禁用，继续走 IDB */ }
            }
            if (window.AppKVDB) {
              try {
                withTimeout(window.AppKVDB.put({ key: BOOK_KEY_PREFIX + id, value: content }), 4000)
                  .then(function () { toast('《' + title + '》导入成功'); })
                  .catch(function () { reportFail(lsErr); });
              } catch (e) { reportFail(lsErr); }
            } else {
              reportFail(lsErr);
            }
          };
          var reportFail = function (contentErr) {
            // 回滚书架记录，避免出现打不开的"幽灵书"
            var m = loadMeta().filter(function (b) { return b.id !== id; });
            saveMeta(m);
            BookshelfApp.render();
            if (content.length > LOCAL_LIMIT) {
              toast('《' + title + '》导入失败：文件较大，超出浏览器本地存储容量（约 4MB）。\n建议：1) 将小说拆分为多个文件；2) 或通过本地服务访问本应用（如 python3 -m http.server）');
              return;
            }
            var reason = classifyStorageError(contentErr || {});
            if (reason === 'quota') {
              toast('《' + title + '》导入失败：本地存储空间已满，正文无法保存。\n建议：1) 删除部分书籍或清理浏览器数据腾出空间后重试；2) 或改用本地服务访问本应用（在网站目录执行 python3 -m http.server，再访问 http://localhost:8000）');
            } else if (reason === 'disabled') {
              toast('《' + title + '》导入失败：浏览器已禁用本地存储，正文无法保存。\n建议：1) 允许浏览器存储数据（Chrome 设置 → 隐私和安全 → 网站设置 → Cookie 和网站数据）；2) 或改用本地服务访问本应用（在网站目录执行 python3 -m http.server，再访问 http://localhost:8000）');
            } else {
              toast('《' + title + '》导入失败：正文保存失败，浏览器本地存储与 IndexedDB 均不可用。\n建议改用本地服务访问本应用（在网站目录执行 python3 -m http.server，再访问 http://localhost:8000）');
            }
          };
          persist();
        });
      };
      reader.readAsArrayBuffer(file);
    },

    removeBook: function (id) {
      if (!window.confirm('确定删除这本小说吗？删除后不可恢复。')) return;
      var meta = loadMeta();
      meta = meta.filter(function (b) { return b.id !== id; });
      saveMeta(meta);
      // 同步删除 IndexedDB 权威层中的元数据与正文，避免刷新后从 IDB 回填出"幽灵书"
      if (window.AppKVDB) {
        window.AppKVDB.put({ key: META_KEY, value: JSON.stringify(meta), updatedAt: Date.now() }).catch(function () {});
        window.AppKVDB.del(BOOK_KEY_PREFIX + id).catch(function () {});
      }
      try { localStorage.removeItem(BOOK_KEY_PREFIX + id); } catch (e) {}
      this.state = { view: 'shelf', bookId: null, chapter: 0 };
      this.render();
    },

    /* ================= 阅读器 ================= */
    openReader: function (id) {
      var book = findBook(id);
      if (!book) return;
      var settings = loadSettings();
      this.state = { view: 'reader', bookId: id, chapter: typeof book.chapter === 'number' ? book.chapter : 0 };
      settings.chapter = this.state.chapter;
      saveSettings(settings);
      var container = document.getElementById('bookshelf-container');
      if (!container) return;
      container.innerHTML = '<div class="bookshelf-loading"><i class="fas fa-spinner fa-spin"></i> 正在打开小说…</div>';
      var self = this;
      var done = function (content) {
        if (!content) { toast('读取小说失败：正文未找到，请重新导入'); self.state = { view: 'shelf', bookId: null, chapter: 0 }; self.render(); return; }
        self._chapters = splitChapters(content);
        self._renderReader(container);
      };
      // localStorage 优先读取（file:// 下正文存于此）；未命中再查 IndexedDB（带超时）
      var local = null;
      try { local = localStorage.getItem(BOOK_KEY_PREFIX + id); } catch (e) {}
      if (local) { done(local); return; }
      if (window.AppKVDB) {
        withTimeout(window.AppKVDB.get(BOOK_KEY_PREFIX + id), 4000)
          .then(function (rec) {
            var val = rec && rec.value ? rec.value : null;
            if (val) {
              // 从 IDB 恢复正文后回填 localStorage（容量允许时），两通道保持一致
              try { if (val.length <= LOCAL_LIMIT) localStorage.setItem(BOOK_KEY_PREFIX + id, val); } catch (e) {}
            }
            done(val);
          })
          .catch(function () { done(null); });
      } else {
        done(null);
      }
    },

    backToShelf: function () {
      this._saveProgress();
      this._syncReadingMode(false);
      this.state = { view: 'shelf', bookId: null, chapter: 0 };
      this.render();
    },

    _renderReader: function (container) {
      var book = findBook(this.state.bookId);
      if (!book || !this._chapters || !this._chapters.length) { this.state = { view: 'shelf', bookId: null, chapter: 0 }; this.render(); return; }
      var settings = loadSettings();
      var chapter = this._chapters[this.state.chapter] || this._chapters[0];
      var theme = THEMES[0];
      for (var t = 0; t < THEMES.length; t++) { if (THEMES[t].id === settings.theme) { theme = THEMES[t]; break; } }
      var isCustomBg = settings.theme === 'custom';
      var isCustomBgImage = settings.customBgImage === 1;
      var customBgColor = settings.customBg || '#F6F1E6';
      var bgImageDataUrl = isCustomBgImage ? (settings.customBgImageData || '') : '';
      var shellThemeId = theme.id;
      var shellBgStyle = '';
      if (isCustomBgImage) {
        // 图片背景：原图完整显示 + 深色文字，正文可读性由分栏玻璃底保证
        shellThemeId = 'white';
        if (bgImageDataUrl) {
          shellBgStyle = ' style="background-image:url(\'' + bgImageDataUrl + '\');background-size:cover;background-position:center;background-repeat:no-repeat;"';
        } else {
          // 数据存于 IndexedDB（大图）：先浅色占位，渲染后异步取回再应用
          shellBgStyle = '';
        }
      } else if (isCustomBg) {
        // 自定义颜色背景：按亮度自动选深/浅文字配色（白色文字主题 / 夜间文字主题），内联覆盖背景色
        shellThemeId = isDarkColor(customBgColor) ? 'night' : 'white';
        shellBgStyle = ' style="background:' + customBgColor + '"';
      }
      var align = ALIGNS[0];
      for (var a = 0; a < ALIGNS.length; a++) { if (ALIGNS[a].id === settings.align) { align = ALIGNS[a]; break; } }

      var bodyHtml = '';
      if (chapter.title) bodyHtml += '<div class="reader-chapter-title">' + this._esc(chapter.title) + '</div>';
      for (var j = 0; j < chapter.body.length; j++) {
        var p = String(chapter.body[j]).trim();
        if (!p) continue;
        bodyHtml += '<p>' + this._esc(p) + '</p>';
      }
      if (!bodyHtml) bodyHtml = '<p>（本章暂无内容）</p>';

      // 背景主题色点
      var themeBar = '';
      for (var ti = 0; ti < THEMES.length; ti++) {
        themeBar += '<button class="reader-theme-dot' + (THEMES[ti].id === settings.theme ? ' active' : '') +
          '" style="background:' + THEMES[ti].bg + '" title="' + THEMES[ti].name + '" data-theme-id="' + THEMES[ti].id +
          '" onclick="BookshelfApp.setTheme(\'' + THEMES[ti].id + '\')"></button>';
      }
      // 背景入口：上传图片 / 自定义颜色（两个独立按钮）
      themeBar += '<button class="reader-opt-btn reader-bg-image-btn' + (settings.customBgImage === 1 ? ' active' : '') +
        '" title="上传背景图片" onclick="BookshelfApp.pickBgImage()"><i class="fas fa-image"></i>图片</button>';
      themeBar += '<button class="reader-opt-btn reader-bg-color-btn' + (settings.theme === 'custom' && settings.customBgImage !== 1 ? ' active' : '') +
        '" title="自定义背景颜色" onclick="BookshelfApp.pickBgColor()"><i class="fas fa-palette"></i>颜色</button>';
      // 行距档位
      var lhBar = '';
      for (var li = 0; li < LINE_HEIGHTS.length; li++) {
        lhBar += '<button class="reader-opt-btn reader-lh-btn' + (LINE_HEIGHTS[li] === settings.lineHeight ? ' active' : '') +
          '" onclick="BookshelfApp.setLineHeight(' + li + ')">' + LINE_HEIGHTS[li] + '</button>';
      }
      // 对齐档位
      var alignBar = '';
      for (var ai = 0; ai < ALIGNS.length; ai++) {
        alignBar += '<button class="reader-opt-btn reader-align-btn' + (ALIGNS[ai].id === settings.align ? ' active' : '') +
          '" data-align="' + ALIGNS[ai].id + '" onclick="BookshelfApp.setAlign(\'' + ALIGNS[ai].id + '\')">' + ALIGNS[ai].name + '</button>';
      }
      // 目录列表
      var tocHtml = '';
      for (var ci = 0; ci < this._chapters.length; ci++) {
        var ctitle = this._chapters[ci].title || ('第 ' + (ci + 1) + ' 章');
        tocHtml += '<div class="reader-toc-item' + (ci === this.state.chapter ? ' current' : '') +
          '" onclick="BookshelfApp.jumpToChapter(' + ci + ')">' + this._esc(ctitle) + '</div>';
      }

      var html =
        '<div class="reader-shell menu-shown" data-theme="' + shellThemeId + '"' + shellBgStyle + '">' +
          /* 顶部栏：返回 + 书名 + 章节进度 + 目录（菜单弹出时显示） */
          '<div class="reader-topbar">' +
            '<button class="reader-topbar-btn" onclick="BookshelfApp.backToShelf()" title="返回书架"><i class="fas fa-chevron-left"></i></button>' +
            '<div class="reader-topbar-title">' + this._esc(book.title) + '</div>' +
            '<div class="reader-topbar-chapter">' + (this.state.chapter + 1) + '/' + this._chapters.length + ' 章</div>' +
            '<button class="reader-topbar-btn" onclick="BookshelfApp.openToc()" title="章节目录"><i class="fas fa-list-ul"></i></button>' +
          '</div>' +
          /* 分页视口（手动逐页排版，左右翻页） */
          '<div class="reader-viewport" id="reader-viewport">' +
            '<div class="reader-slider' + (isCustomBgImage ? ' has-bg-image' : '') + '" id="reader-pages" style="font-size:' + settings.fontSize + 'px;line-height:' + settings.lineHeight +
              ';text-align:' + align.id + ';' + (settings.indent ? 'text-indent:2em;' : '') + '">' +
            '</div>' +
          '</div>' +
          /* 页码指示 */
          '<div class="reader-page-indicator" id="reader-page-indicator">1 / 1</div>' +
          /* 设置菜单：从底部向上滑出 */
          '<div class="reader-settings-panel" id="reader-settings-panel">' +
            '<div class="reader-settings-head">' +
              '<span class="reader-settings-title">阅读设置</span>' +
              '<button class="reader-settings-close" onclick="BookshelfApp.closeSettings()" title="收起"><i class="fas fa-chevron-down"></i></button>' +
            '</div>' +
            '<div class="reader-set-row"><span class="reader-set-label">背景</span><div class="reader-set-opts">' + themeBar + '</div></div>' +
            '<div class="reader-set-row"><span class="reader-set-label">字号</span><div class="reader-set-opts">' +
              '<button class="reader-opt-btn" onclick="BookshelfApp.changeFontSize(-1)">A−</button>' +
              '<span class="reader-tb-label" id="reader-font-label">' + settings.fontSize + '</span>' +
              '<button class="reader-opt-btn" onclick="BookshelfApp.changeFontSize(1)">A＋</button>' +
            '</div></div>' +
            '<div class="reader-set-row"><span class="reader-set-label">行距</span><div class="reader-set-opts">' + lhBar + '</div></div>' +
            '<div class="reader-set-row"><span class="reader-set-label">对齐</span><div class="reader-set-opts">' + alignBar + '</div></div>' +
            '<div class="reader-set-row"><span class="reader-set-label">段落缩进</span><button class="reader-switch' + (settings.indent ? ' on' : '') + '" id="reader-indent-switch" onclick="BookshelfApp.toggleIndent()"><span></span></button></div>' +
            '<div class="reader-set-row reader-set-actions">' +
              '<button class="reader-opt-btn" onclick="BookshelfApp.prevChapter()"><i class="fas fa-chevron-left"></i> 上一章</button>' +
              '<button class="reader-opt-btn" onclick="BookshelfApp.nextChapter()">下一章 <i class="fas fa-chevron-right"></i></button>' +
            '</div>' +
          '</div>' +
          /* 目录侧滑抽屉 */
          '<div class="reader-drawer-mask" id="reader-drawer-mask" onclick="BookshelfApp.closeToc()"></div>' +
          '<div class="reader-drawer" id="reader-drawer">' +
            '<div class="reader-drawer-head"><i class="fas fa-list-ul"></i> 目录</div>' +
            '<div class="reader-drawer-list">' + tocHtml + '</div>' +
          '</div>' +
        '</div>';

      container.innerHTML = html;
      container.classList.add('reader-mode');

      // localStorage 无图数据时，渲染后异步从 IndexedDB 取回并应用
      // （覆盖大图仅存 IDB 与 localStorage settings 被清空的恢复场景；
      //  用户切预设主题/选色时会删除 IDB 中的 BG_IMAGE_KEY，故 IDB 有数据即代表应恢复图片背景）
      if (!bgImageDataUrl) {
        this._loadBgImageFromIDB();
      }
      this._syncHeader(true);
      this._syncReadingMode(true);

      var self = this;
      // 恢复上次阅读位置（按页比例）
      this._pageIdx = 0;
      this._totalPages = 1;

      // 分页：手动逐页测量填充，杜绝多列翻页错位 / 内容重叠
      var paginate = function () {
        var vp = document.getElementById('reader-viewport');
        var slider = document.getElementById('reader-pages');
        if (!vp || !slider) return;
        var vw = vp.clientWidth;
        var vh = vp.clientHeight;
        if (vw <= 0 || vh <= 0) return;
        var ch = self._chapters[self.state.chapter] || self._chapters[0];
        var blocks = [];
        if (ch && ch.title) blocks.push({ tag: 'title', text: ch.title });
        if (ch && ch.body) {
          for (var b = 0; b < ch.body.length; b++) {
            var tx = String(ch.body[b]).trim();
            if (tx) blocks.push({ tag: 'p', text: tx });
          }
        }
        if (!blocks.length) blocks.push({ tag: 'p', text: '（本章暂无内容）' });

        // 隐藏测量容器：与最终页面同宽同款排版（内边距由 .reader-page 提供，保证逐页像素一致）
        var measure = document.createElement('div');
        measure.className = 'reader-page reader-page-measure';
        measure.style.width = vw + 'px';
        measure.style.fontSize = slider.style.fontSize;
        measure.style.lineHeight = slider.style.lineHeight;
        measure.style.textAlign = slider.style.textAlign;
        if (slider.style.textIndent) measure.style.textIndent = slider.style.textIndent;
        document.body.appendChild(measure);

        var pagesArr = [];
        var cur = [];
        var queue = blocks.slice();
        var makeEl = function (item) {
          var el = document.createElement(item.tag === 'title' ? 'div' : 'p');
          el.textContent = item.text;
          return el;
        };
        var flush = function () { if (cur.length) { pagesArr.push(cur); cur = []; measure.innerHTML = ''; } };
        while (queue.length) {
          var item = queue.shift();
          var el = makeEl(item);
          measure.appendChild(el);
          if (measure.scrollHeight <= vh + 1) { cur.push(item); continue; }
          measure.removeChild(el);
          if (cur.length) { flush(); queue.unshift(item); continue; } // 本页已满，封页后重排该段
          // 当前页为空而单段仍超一页：二分切分
          var text = item.text, tag = item.tag;
          var el2 = makeEl({ tag: tag, text: text });
          measure.appendChild(el2);
          var lo = 0, hi = text.length;
          while (lo < hi) {
            var mid = Math.ceil((lo + hi) / 2);
            el2.textContent = text.slice(0, mid);
            if (measure.scrollHeight <= vh + 1) lo = mid; else hi = mid - 1;
          }
          lo = Math.max(1, lo);
          if (lo < text.length) {
            cur.push({ tag: tag, text: text.slice(0, lo) });
            queue.unshift({ tag: tag, text: text.slice(lo) });
          } else {
            cur.push({ tag: tag, text: text });
          }
          measure.removeChild(el2);
          flush();
        }
        flush();
        document.body.removeChild(measure);

        // 渲染各页
        var html = '';
        for (var i = 0; i < pagesArr.length; i++) {
          var inner = '';
          for (var j = 0; j < pagesArr[i].length; j++) {
            var it = pagesArr[i][j];
            if (it.tag === 'title') inner += '<div class="reader-chapter-title">' + self._esc(it.text) + '</div>';
            else inner += '<p>' + self._esc(it.text) + '</p>';
          }
          html += '<div class="reader-page" style="width:' + vw + 'px">' + inner + '</div>';
        }
        slider.innerHTML = html;

        var total = Math.max(1, pagesArr.length);
        var ratio = self._totalPages > 1 ? self._pageIdx / (self._totalPages - 1) : 0;
        self._totalPages = total;
        self._pageWidth = vw;
        if (self._pageIdx >= total) self._pageIdx = total - 1;
        // 保留阅读比例（字号/行距/宽度变化后位置不跳变）
        if (ratio > 0) self._pageIdx = Math.min(total - 1, Math.max(0, Math.round(ratio * (total - 1))));
        self._applyPage();
      };
      this._paginate = paginate;
      this._paginate();
      // 字体加载后再精确分页一次
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { self._paginate(); });
      }
      setTimeout(function () { self._paginate(); }, 60);
      window.addEventListener('resize', this._onResize = function () { self._paginate(); });

      // 点击事件：左 1/3 上一页 / 右 1/3 下一页 / 中 1/3 弹菜单；菜单开时点外部收起
      var shellEl = container.querySelector('.reader-shell');
      if (shellEl) {
        shellEl.addEventListener('click', function (ev) {
          var t = ev.target;
          if (t && t.closest && (t.closest('.reader-topbar') || t.closest('.reader-settings-panel') ||
              t.closest('.reader-drawer') || t.closest('.reader-drawer-mask'))) {
            return;
          }
          var sp = document.getElementById('reader-settings-panel');
          if (sp && sp.classList.contains('open')) { BookshelfApp.closeSettings(); return; }
          var vp = document.getElementById('reader-viewport');
          if (!vp) return;
          var rect = vp.getBoundingClientRect();
          var x = ev.clientX - rect.left;
          var third = rect.width / 3;
          if (x < third) { BookshelfApp.prevPage(); }
          else if (x > third * 2) { BookshelfApp.nextPage(); }
          else { BookshelfApp.toggleSettings(); }
        });
      }
    },

    /* 应用当前页：平移分栏容器 + 更新页码 */
    _applyPage: function () {
      var pages = document.getElementById('reader-pages');
      if (!pages) return;
      pages.style.transform = 'translateX(-' + (this._pageIdx * this._pageWidth) + 'px)';
      var ind = document.getElementById('reader-page-indicator');
      if (ind) ind.textContent = (this._pageIdx + 1) + ' / ' + this._totalPages;
    },

    /* 左右翻页（点屏幕左/右区域） */
    prevPage: function () {
      if (this._pageIdx > 0) {
        this._pageIdx--;
        this._applyPage();
        this._saveProgress();
      } else if (this.state.chapter > 0) {
        this.prevChapter();
      }
    },
    nextPage: function () {
      if (this._pageIdx < this._totalPages - 1) {
        this._pageIdx++;
        this._applyPage();
        this._saveProgress();
      } else if (this.state.chapter < this._chapters.length - 1) {
        this.nextChapter();
      } else {
        toast('已到全书末尾');
      }
    },

    /* 设置菜单：从底部向上滑出 / 收起 */
    toggleSettings: function () {
      var sp = document.getElementById('reader-settings-panel');
      var shell = document.querySelector('.reader-shell');
      if (!sp || !shell) return;
      var open = !sp.classList.contains('open');
      sp.classList.toggle('open', open);
      shell.classList.toggle('menu-shown', open);
    },
    closeSettings: function () {
      var sp = document.getElementById('reader-settings-panel');
      var shell = document.querySelector('.reader-shell');
      if (sp) sp.classList.remove('open');
      if (shell) shell.classList.remove('menu-shown');
    },
    /* 兼容旧调用：无底部工具栏，菜单即设置面板 */
    toggleMenu: function () { this.toggleSettings(); },

    /* ================= 目录抽屉 ================= */
    openToc: function () {
      var d = document.getElementById('reader-drawer');
      var m = document.getElementById('reader-drawer-mask');
      if (d) d.classList.add('open');
      if (m) m.classList.add('show');
    },
    closeToc: function () {
      var d = document.getElementById('reader-drawer');
      var m = document.getElementById('reader-drawer-mask');
      if (d) d.classList.remove('open');
      if (m) m.classList.remove('show');
    },
    jumpToChapter: function (idx) {
      this.closeToc();
      if (idx === this.state.chapter) return;
      this._saveProgress();
      var settings = loadSettings();
      this.state.chapter = idx;
      settings.chapter = idx;
      saveSettings(settings);
      this._pageIdx = 0;
      this.render();
    },

    _saveProgress: function () {
      if (!this._chapters || !this._chapters.length) return;
      var total = Math.max(1, this._totalPages || 1);
      var idx = Math.min(Math.max(0, this._pageIdx || 0), total - 1);
      var ratio = total > 1 ? idx / (total - 1) : 0;
      var curChapter = this.state.chapter || 0;
      var curTitle = this._chapters[curChapter] ? this._chapters[curChapter].title : '';
      var chapterBase = curChapter / this._chapters.length;
      var progress = Math.min(100, Math.round((chapterBase + (ratio / this._chapters.length)) * 100));

      var meta = loadMeta();
      for (var i = 0; i < meta.length; i++) {
        if (meta[i].id === this.state.bookId) {
          meta[i].chapter = curChapter;
          meta[i].chapterTitle = curTitle;
          meta[i].chapterCount = this._chapters.length;
          meta[i].pageRatio = ratio;
          meta[i].pageIdx = idx;
          meta[i].progress = progress;
          meta[i].lastReadAt = Date.now();
          break;
        }
      }
      saveMeta(meta);
    },

    _switchChapter: function (delta) {
      this._saveProgress();
      var settings = loadSettings();
      var next = this.state.chapter + delta;
      if (next < 0 || next >= this._chapters.length) return;
      this.state.chapter = next;
      settings.chapter = next;
      saveSettings(settings);
      this._pageIdx = 0;
      this.render();
    },

    prevChapter: function () { this._switchChapter(-1); },
    nextChapter: function () { this._switchChapter(1); },

    /* ================= 阅读设置 ================= */
    setTheme: function (id) {
      var s = loadSettings();
      s.theme = id;
      s.customBgImage = 0;       // 切换预设主题时清除图片背景
      s.customBgImageData = null;
      saveSettings(s);
      if (window.AppKVDB && window.indexedDB) {
        try { window.AppKVDB.del(BG_IMAGE_KEY).catch(function () {}); } catch (e) {}
      }
      var shell = document.querySelector('.reader-shell');
      if (shell) {
        shell.setAttribute('data-theme', id);
        shell.style.background = ''; // 切换预设主题时清除自定义内联背景
        shell.style.backgroundImage = '';
      }
      var pages = document.getElementById('reader-pages');
      if (pages) pages.classList.remove('has-bg-image');
      var dots = document.querySelectorAll('.reader-theme-dot');
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', dots[i].getAttribute('data-theme-id') === id);
      }
      var bi = document.querySelector('.reader-bg-image-btn');
      if (bi) bi.classList.remove('active');
      var bc = document.querySelector('.reader-bg-color-btn');
      if (bc) bc.classList.remove('active');
      var name = id;
      for (var t = 0; t < THEMES.length; t++) { if (THEMES[t].id === id) { name = THEMES[t].name; break; } }
      toast('背景：' + name);
    },

    /* 上传图片作为阅读背景：读取 -> 压缩 -> 持久化（IDB 优先，小图可并存 localStorage）-> 应用 */
    pickBgImage: function () {
      var self = this;
      if (this._bgImageInput) { try { document.body.removeChild(this._bgImageInput); } catch (e) {} this._bgImageInput = null; }
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      this._bgImageInput = input;
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) { toast('请选择图片文件'); return; }
        self._readImageAsDataUrl(file, function (raw) {
          self._compressImage(raw, function (dataUrl) {
            self._saveBgImage(dataUrl);
          });
        });
      });
      input.click();
    },

    /* 读取图片为 dataURL */
    _readImageAsDataUrl: function (file, cb) {
      var reader = new FileReader();
      reader.onload = function () { cb(String(reader.result || '')); };
      reader.onerror = function () { toast('图片读取失败'); };
      reader.readAsDataURL(file);
    },

    /* canvas 压缩：最长边 <= BG_IMAGE_MAX_EDGE，JPEG quality BG_IMAGE_QUALITY */
    _compressImage: function (rawDataUrl, cb) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var maxEdge = BG_IMAGE_MAX_EDGE;
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; // 透明图补白底，JPEG 无透明通道
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        var out = '';
        try { out = canvas.toDataURL('image/jpeg', BG_IMAGE_QUALITY); } catch (e) { out = ''; }
        if (!out || out.length < 50) { toast('图片压缩失败，请换一张图片'); return; }
        cb(out);
      };
      img.onerror = function () { toast('图片加载失败，请换一张图片'); };
      img.src = rawDataUrl;
    },

    /* 持久化背景图：IDB 优先（key=BG_IMAGE_KEY），小图同时存 localStorage(settings.customBgImageData)，均持久化标记 */
    _saveBgImage: function (dataUrl) {
      var s = loadSettings();
      s.theme = 'custom';
      s.customBgImage = 1;
      s.customBgImageData = null;
      // 写入 IndexedDB 权威层（fire-and-forget + 超时）
      if (window.AppKVDB && window.indexedDB) {
        try { withTimeout(window.AppKVDB.put({ key: BG_IMAGE_KEY, value: dataUrl, updatedAt: Date.now() }), 4000).catch(function () {}); } catch (e) {}
      }
      // 小图并存 localStorage，保证 IDB 不可用时仍生效
      if (dataUrl.length <= BG_IMAGE_LS_LIMIT) { s.customBgImageData = dataUrl; }
      saveSettings(s);
      this._applyBgImage(dataUrl);
      toast('已应用图片背景');
    },

    /* 应用图片背景到阅读器（原图显示 + 深色文字，正文可读性由分栏玻璃底保证） */
    _applyBgImage: function (dataUrl) {
      var shell = document.querySelector('.reader-shell');
      if (!shell || !dataUrl) return;
      shell.setAttribute('data-theme', 'white');
      shell.style.backgroundImage = 'url(\'' + dataUrl + '\')';
      shell.style.backgroundSize = 'cover';
      shell.style.backgroundPosition = 'center';
      shell.style.backgroundRepeat = 'no-repeat';
      var pages = document.getElementById('reader-pages');
      if (pages) pages.classList.add('has-bg-image');
      var dots = document.querySelectorAll('.reader-theme-dot');
      for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
      var bi = document.querySelector('.reader-bg-image-btn');
      if (bi) bi.classList.add('active');
      var bc = document.querySelector('.reader-bg-color-btn');
      if (bc) bc.classList.remove('active');
    },

    /* 从 IndexedDB 回填背景图（localStorage 无数据时，异步取回并应用） */
    _loadBgImageFromIDB: function () {
      var self = this;
      if (!window.AppKVDB || !window.indexedDB) return;
      withTimeout(window.AppKVDB.get(BG_IMAGE_KEY), 4000)
        .then(function (rec) {
          if (!rec || !rec.value) return;
          var s = loadSettings();
          // 用户切预设主题/选色时会删除 IDB 中的 BG_IMAGE_KEY，
          // 故 IDB 有数据即代表应恢复图片背景（含 localStorage settings 被清空的场景）
          if (s.customBgImage !== 1) {
            s.theme = 'custom';
            s.customBgImage = 1;
            s.customBgImageData = null;
            saveSettings(s);
          }
          if (rec.value.length <= BG_IMAGE_LS_LIMIT && !s.customBgImageData) {
            s.customBgImageData = rec.value;
            saveSettings(s);
          }
          self._applyBgImage(rec.value);
        })
        .catch(function () {});
    },

    /* 选择颜色作为阅读背景：取色后应用并持久化（清除图片背景） */
    pickBgColor: function () {
      if (this._customColorInput) { try { document.body.removeChild(this._customColorInput); } catch (e) {} this._customColorInput = null; }
      var input = document.createElement('input');
      input.type = 'color';
      var s = loadSettings();
      input.value = s.customBg || '#F6F1E6';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '0';
      input.style.opacity = '0';
      document.body.appendChild(input);
      this._customColorInput = input;
      var self = this;
      input.addEventListener('change', function () {
        var color = input.value;
        var st = loadSettings();
        st.theme = 'custom';
        st.customBg = color;
        st.customBgImage = 0;       // 取色时清除图片背景
        st.customBgImageData = null;
        saveSettings(st);
        if (window.AppKVDB && window.indexedDB) {
          try { window.AppKVDB.del(BG_IMAGE_KEY).catch(function () {}); } catch (e) {}
        }
        self._applyCustomBg(color);
        try { document.body.removeChild(input); } catch (e) {}
        if (self._customColorInput === input) self._customColorInput = null;
      });
      input.click();
    },

    /* 应用自定义背景：按亮度自动选文字配色 + 内联覆盖背景色 + 更新选中态 */
    _applyCustomBg: function (color) {
      var shell = document.querySelector('.reader-shell');
      if (shell) {
        shell.setAttribute('data-theme', isDarkColor(color) ? 'night' : 'white');
        shell.style.background = color;
        shell.style.backgroundImage = '';
      }
      var pages = document.getElementById('reader-pages');
      if (pages) pages.classList.remove('has-bg-image');
      var dots = document.querySelectorAll('.reader-theme-dot');
      for (var i = 0; i < dots.length; i++) dots[i].classList.remove('active');
      var bc = document.querySelector('.reader-bg-color-btn');
      if (bc) bc.classList.add('active');
      var bi = document.querySelector('.reader-bg-image-btn');
      if (bi) bi.classList.remove('active');
      toast('背景：自定义 ' + color);
    },

    changeFontSize: function (delta) {
      var s = loadSettings();
      s.fontSize = Math.min(30, Math.max(13, s.fontSize + delta));
      saveSettings(s);
      var pages = document.getElementById('reader-pages');
      if (pages) pages.style.fontSize = s.fontSize + 'px';
      var label = document.getElementById('reader-font-label');
      if (label) label.textContent = s.fontSize;
      if (this._paginate) this._paginate();
    },

    setLineHeight: function (idx) {
      var s = loadSettings();
      s.lineHeight = LINE_HEIGHTS[idx];
      saveSettings(s);
      var pages = document.getElementById('reader-pages');
      if (pages) pages.style.lineHeight = s.lineHeight;
      var btns = document.querySelectorAll('.reader-lh-btn');
      for (var i = 0; i < btns.length; i++) { btns[i].classList.toggle('active', i === idx); }
      if (this._paginate) this._paginate();
      toast('行距：' + s.lineHeight);
    },

    setAlign: function (id) {
      var s = loadSettings();
      s.align = id;
      saveSettings(s);
      var pages = document.getElementById('reader-pages');
      if (pages) pages.style.textAlign = id;
      var btns = document.querySelectorAll('.reader-align-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-align') === id);
      }
      for (var a = 0; a < ALIGNS.length; a++) { if (ALIGNS[a].id === id) { toast('对齐：' + ALIGNS[a].name); break; } }
      if (this._paginate) this._paginate();
    },

    toggleIndent: function () {
      var s = loadSettings();
      s.indent = !s.indent;
      saveSettings(s);
      var pages = document.getElementById('reader-pages');
      if (pages) pages.style.textIndent = s.indent ? '2em' : '0';
      var sw = document.getElementById('reader-indent-switch');
      if (sw) sw.classList.toggle('on', s.indent);
      if (this._paginate) this._paginate();
      toast(s.indent ? '段落缩进：开' : '段落缩进：关');
    },

    /* ================= 工具 ================= */
    _esc: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  };

  window.BookshelfApp = BookshelfApp;
  window.renderBookshelf = function () { window.BookshelfApp.render(); };
})();
