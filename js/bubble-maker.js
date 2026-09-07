/* ==== bubble-maker.js ==== */
/* ===== 拾心界 - 气泡商城（气泡生成器已移除，我的气泡区块已移除） =====
   保留功能：
   1) 气泡商城：CSS 气泡 列表展示、删除、改名、指派
   2) CSS 适配导入气泡：粘贴 CSS 代码保存为气泡
   3) 气泡预览显示模式：商城卡片横条预览（左对方 / 右我方）+ 微信风格单气泡预览
   4) 聊天渲染：为聊天消息注入已指派气泡样式（chat.js 调用 buildBubbleExt；历史指派的内置气泡仍兼容渲染）
*/

const BubbleMaker = (function() {

  /* ================= 工具 ================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(id) { return document.getElementById(id); }
  function clampNum(v, min, max) {
    v = parseFloat(v);
    if (isNaN(v)) return min;
    return Math.min(max, Math.max(min, v));
  }
  function toast(msg) {
    try {
      if (window.Core && typeof Core.toast === 'function') { Core.toast(msg); return; }
    } catch (e) {}
    // 兜底自建提示条
    var old = document.querySelector('.bs-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'bs-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2000);
  }

  /* ================= 数据层（与项目 Storage 机制一致） ================= */
  function getBubbles() {
    var list = Storage.get('bubbleList', []) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var cfg = normalizeBubble(list[i]);
      if (cfg) out.push(cfg);
    }
    return out;
  }
  function setBubbles(list) { Storage.set('bubbleList', list || []); }
  function getAssignments() { return Storage.get('bubbleAssignments', {}) || {}; }
  function setAssignments(map) { Storage.set('bubbleAssignments', map || {}); }
  function getBubbleById(id) {
    var list = getBubbles();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /* ================= 配置模型 ================= */
  function defaultCfg() {
    return {
      id: null,
      name: '',
      source: 'maker',
      cssClass: null,
      cssCode: null,
      wechat: false,
      radius: 16,          // 气泡圆角 px
      maxWidth: 260,       // 气泡最大宽度 px
      padding: 12,         // 内边距 px
      bgColor: '#B8DCF0',  // 背景色
      textColor: '#3A4050',// 文字颜色
      borderWidth: 0,      // 边框粗细 px
      borderColor: '#4C9AFF', // 边框颜色
      shadowEnabled: true, // 阴影开关
      shadowSize: 8,       // 阴影大小 px
      shadowBlur: 16,      // 阴影模糊度 px
      shadowAngle: 0,      // 阴影角度（0=正下方，顺时针旋转）
      tailEnabled: true,   // CSS 尖角三角开关
      tailSize: 10,        // 尖角大小 px
      tailPos: 'br',       // 尖角位置：br 右下 / bl 左下（我方消息视角；对方消息自动镜像）
      decoration: null,    // 装饰 {type: 'image'|'symbol', url?, text?, size, anchor}
      createdAt: 0
    };
  }
  /* 装饰锚点：四角（tl 左上 / tr 右上 / bl 左下 / br 右下），图片中心对齐气泡角 */
  var DECO_ANCHORS = [
    { key: 'tl', label: '左上' }, { key: 'tr', label: '右上' },
    { key: 'bl', label: '左下' }, { key: 'br', label: '右下' }
  ];
  function isValidAnchor(a) {
    if (!a) return false;
    for (var i = 0; i < DECO_ANCHORS.length; i++) {
      if (DECO_ANCHORS[i].key === a) return true;
    }
    return false;
  }
  /* 装饰物定位样式：四角中心对齐固定（正方形图片/符号中心对准气泡角） */
  function decoStyleFor(d) {
    var size = clampNum(d && d.size, 16, 80);
    var half = Math.round(size / 2);
    var anchor = isValidAnchor(d && d.anchor) ? d.anchor : 'tr';
    var st = 'position:absolute;z-index:2;pointer-events:none;';
    switch (anchor) {
      case 'tl': st += 'left:' + (-half) + 'px;top:' + (-half) + 'px;'; break;
      case 'tr': st += 'right:' + (-half) + 'px;top:' + (-half) + 'px;'; break;
      case 'bl': st += 'left:' + (-half) + 'px;bottom:' + (-half) + 'px;'; break;
      case 'br': st += 'right:' + (-half) + 'px;bottom:' + (-half) + 'px;'; break;
      default: st += 'right:' + (-half) + 'px;top:' + (-half) + 'px;';
    }
    return st;
  }
  /* 归一化：兼容旧版（v1）已保存数据，自动迁移到新字段；CSS 导入款转为基础款 */
  function normalizeBubble(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var cfg = defaultCfg();
    cfg.id = raw.id || ('bub_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
    cfg.name = raw.name || '未命名气泡';
    cfg.createdAt = raw.createdAt || Date.now();
    // CSS 款：完整保留 cssCode/cssClass/wechat，不参与基础款迁移
    if (raw.source === 'css') {
      cfg.source = 'css';
      if (raw.cssClass) cfg.cssClass = raw.cssClass;
      if (raw.cssCode) cfg.cssCode = raw.cssCode;
      if (typeof raw.wechat === 'boolean') cfg.wechat = raw.wechat;
      return cfg;
    }
    // 旧字段迁移
    if (typeof raw.radius === 'number') cfg.radius = clampNum(raw.radius, 0, 40);
    else if (typeof raw.radiusTL === 'number' || typeof raw.radiusTR === 'number' || typeof raw.radiusBL === 'number' || typeof raw.radiusBR === 'number') {
      var r = ((raw.radiusTL || 0) + (raw.radiusTR || 0) + (raw.radiusBL || 0) + (raw.radiusBR || 0)) / 4;
      cfg.radius = clampNum(r, 0, 40);
    }
    if (typeof raw.maxWidth === 'number') cfg.maxWidth = clampNum(raw.maxWidth, 120, 360);
    if (typeof raw.padding === 'number') cfg.padding = clampNum(raw.padding, 4, 28);
    if (raw.bgColor) cfg.bgColor = raw.bgColor;
    if (raw.textColor) cfg.textColor = raw.textColor;
    if (typeof raw.borderWidth === 'number') cfg.borderWidth = clampNum(raw.borderWidth, 0, 8);
    if (raw.borderColor) cfg.borderColor = raw.borderColor;
    if (typeof raw.shadowEnabled === 'boolean') cfg.shadowEnabled = raw.shadowEnabled;
    if (typeof raw.shadowSize === 'number') cfg.shadowSize = clampNum(raw.shadowSize, 0, 30);
    if (typeof raw.shadowBlur === 'number') cfg.shadowBlur = clampNum(raw.shadowBlur, 0, 40);
    if (typeof raw.shadowAngle === 'number') cfg.shadowAngle = clampNum(raw.shadowAngle, 0, 360);
    if (typeof raw.tailEnabled === 'boolean') cfg.tailEnabled = raw.tailEnabled;
    if (typeof raw.tailSize === 'number') cfg.tailSize = clampNum(raw.tailSize, 4, 24);
    if (raw.tailPos === 'bl') cfg.tailPos = 'bl';
    else if (raw.tailPos === 'br') cfg.tailPos = 'br';
    // 装饰迁移：v2 结构 {type,url,text,size,anchor}；v1 结构 {url,size}；v1 装饰数组取第一个可用图片
    if (raw.decoration) {
      var d = raw.decoration;
      if (d.type === 'symbol' && d.text) {
        cfg.decoration = {
          type: 'symbol',
          text: d.text,
          size: clampNum(d.size, 16, 80),
          anchor: isValidAnchor(d.anchor) ? d.anchor : 'tr'
        };
      } else if (d.url) {
        cfg.decoration = {
          type: 'image',
          url: d.url,
          text: d.type === 'symbol' ? (d.text || '') : undefined,
          size: clampNum(d.size, 16, 80),
          anchor: isValidAnchor(d.anchor) ? d.anchor : 'tr'
        };
      }
    } else if (Array.isArray(raw.decorations) && raw.decorations.length) {
      for (var i = 0; i < raw.decorations.length; i++) {
        var d = raw.decorations[i];
        if (d && d.src) {
          cfg.decoration = { type: 'image', url: d.src, size: clampNum(d.size || 36, 16, 80), anchor: isValidAnchor(d.anchor) ? d.anchor : 'tr' };
          break;
        }
      }
    }
    return cfg;
  }

  /* ================= 动态样式注入（聊天渲染用，幂等） ================= */
  function ensureStyleEl() {
    var st = document.getElementById('bubble-dynamic-styles');
    if (!st) {
      st = document.createElement('style');
      st.id = 'bubble-dynamic-styles';
      document.head.appendChild(st);
    }
    return st;
  }
  /* 阴影值计算：角度 0=正下方，顺时针旋转（x=sin(angle)*size, y=cos(angle)*size） */
  function shadowCssVal(cfg, alpha) {
    if (!cfg || !cfg.shadowEnabled) return 'none';
    var a = (typeof cfg.shadowAngle === 'number' && isFinite(cfg.shadowAngle)) ? cfg.shadowAngle : 0;
    var rad = a * Math.PI / 180;
    var x = Math.round(Math.sin(rad) * cfg.shadowSize);
    var y = Math.round(Math.cos(rad) * cfg.shadowSize);
    return x + 'px ' + y + 'px ' + cfg.shadowBlur + 'px rgba(0,0,0,' + (typeof alpha === 'number' ? alpha : 0.16) + ')';
  }
  /* 生成某气泡的完整聊天 CSS：含 self/other 两个方向 */
  function bubbleCssFor(cfg) {
    var id = cfg.id;
    var ts = cfg.tailSize;
    var tailColor = (cfg.borderWidth > 0 && cfg.borderColor) ? cfg.borderColor : cfg.bgColor;
    var shadow = 'box-shadow:' + shadowCssVal(cfg) + ';';
    var border = cfg.borderWidth > 0 ? (cfg.borderWidth + 'px solid ' + cfg.borderColor) : 'none';
    var css = '';
    css += '.message-bubble.bub-' + id + '{'
      + 'border-radius:' + cfg.radius + 'px;'
      + 'max-width:' + cfg.maxWidth + 'px;'
      + 'padding:' + cfg.padding + 'px;'
      + 'background:' + cfg.bgColor + ';'
      + 'color:' + cfg.textColor + ';'
      + 'border:' + border + ';'
      + shadow
      + '}';
    if (cfg.tailEnabled) {
      var selfSide = (cfg.tailPos === 'bl') ? 'left' : 'right';
      var selfBorder = (cfg.tailPos === 'bl') ? 'borderRight' : 'borderLeft';
      var otherSide = (selfSide === 'right') ? 'left' : 'right';
      var otherBorder = (selfBorder === 'borderLeft') ? 'borderRight' : 'borderLeft';
      css += '.message-row.self .message-bubble.bub-' + id + '::after{'
        + 'content:"";position:absolute;top:50%;transform:translateY(-50%);'
        + selfSide + ':-' + ts + 'px;width:0;height:0;'
        + selfBorder + ':' + ts + 'px solid ' + tailColor + ';'
        + 'borderTop:' + Math.round(ts * 0.62) + 'px solid transparent;'
        + 'borderBottom:' + Math.round(ts * 0.62) + 'px solid transparent;'
        + '}';
      css += '.message-row.other .message-bubble.bub-' + id + '::after{'
        + 'content:"";position:absolute;top:50%;transform:translateY(-50%);'
        + otherSide + ':-' + ts + 'px;width:0;height:0;'
        + otherBorder + ':' + ts + 'px solid ' + tailColor + ';'
        + 'borderTop:' + Math.round(ts * 0.62) + 'px solid transparent;'
        + 'borderBottom:' + Math.round(ts * 0.62) + 'px solid transparent;'
        + '}';
    } else {
      css += '.message-row.self .message-bubble.bub-' + id + '::after,'
        + '.message-row.other .message-bubble.bub-' + id + '::after{display:none;}';
    }
    return css;
  }
  function ensureBubbleStyle(cfg) {
    if (!cfg || !cfg.id) return;
    var st = ensureStyleEl();
    if (st.textContent.indexOf('.bub-' + cfg.id) !== -1) return;
    st.textContent += bubbleCssFor(cfg);
  }
  /* CSS 款作用域化：把用户粘贴的选择器限定到 .bub-css-<id> 专属命名空间，避免多条 CSS 互相串扰 */
  function scopeCss(cfg) {
    if (!cfg || !cfg.cssCode) return '';
    var code = cfg.cssCode;
    var ns = '.bub-css-' + cfg.id;
    if (cfg.wechat) {
      // 先替换长选择器，再替换 .message（负向断言避免误伤 .message-sent 等子串）
      code = code.replace(/\.message-sent/g, ns + '.message-sent');
      code = code.replace(/\.message-received/g, ns + '.message-received');
      code = code.replace(/\.message(?![\-\w])/g, ns + '.message');
      return code;
    }
    // 非微信：把用户自定义类名（cssClass）的选择器限定到命名空间内
    var cls = cfg.cssClass;
    if (cls) {
      var re = new RegExp('\\.' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])', 'g');
      code = code.replace(re, ns + '.' + cls);
    }
    return code;
  }
  var _injectedCss = {};
  /* 注入某 CSS 款气泡的作用域化样式（幂等：同 id 不重复注入；force 时先移除旧段再重灌） */
  function ensureCssBubbleStyle(cfg, force) {
    if (!cfg || cfg.source !== 'css' || !cfg.cssCode) return;
    var key = 'css_' + cfg.id;
    if (!force && _injectedCss[key]) return;
    var st = ensureStyleEl();
    var mark = '/*bub-css-' + cfg.id + '*/';
    if (st.textContent.indexOf(mark) !== -1) {
      st.textContent = st.textContent.split(mark + '\n').join('');
    }
    var scoped = scopeCss(cfg);
    if (!scoped) return;
    st.textContent += '\n' + mark + '\n' + scoped;
    _injectedCss[key] = true;
  }
  function rebuildAllStyles() {
    var st = ensureStyleEl();
    st.textContent = '';
    _injectedCss = {};
    var list = getBubbles();
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.source === 'css') {
        ensureCssBubbleStyle(c, true);
      } else {
        st.textContent += bubbleCssFor(c);
      }
    }
  }

  /* ================= 聊天渲染接口（chat.js 调用，接口保持兼容） ================= */
  function getBubbleForMsg(msg, isSelf) {
    try {
      var assignments = getAssignments();
      var chatId = '';
      var roomEl = el('page-chat-room');
      if (roomEl) chatId = roomEl.dataset.chatId || '';
      var key = null;
      if (isSelf) {
        key = 'self';
      } else if (window.isGroupChatId && isGroupChatId(chatId)) {
        key = (msg && msg.fromId) || '';
      } else {
        key = window._chatCurrentPartnerId || 'other';
      }
      var bubId = assignments[key];
      if (!bubId) return null;
      return getBubbleById(bubId);
    } catch (e) { return null; }
  }
  function buildBubbleExt(msg, isSelf) {
    var cfg = getBubbleForMsg(msg, isSelf);
    if (!cfg) return { extraCls: '', deco: '', ears: '' };
    var hasDeco = !!(cfg.decoration && (cfg.decoration.url || (cfg.decoration.type === 'symbol' && cfg.decoration.text)));
    if (cfg.source === 'css') {
      try { ensureCssBubbleStyle(cfg); } catch (e) {}
      if (hasDeco) {
        try { ensureDecoMargin(cfg); } catch (e) {}
      }
      if (cfg.wechat) {
        return { extraCls: ' bub-css-' + cfg.id + ' bub-applied message message-' + (isSelf ? 'sent' : 'received') + (hasDeco ? ' bub-has-deco' : ''), deco: hasDeco ? buildDecoHtml(cfg) : '', ears: '' };
      }
      return { extraCls: ' bub-css-' + cfg.id + ' bub-applied ' + (cfg.cssClass || '') + (hasDeco ? ' bub-has-deco' : ''), deco: hasDeco ? buildDecoHtml(cfg) : '', ears: '' };
    }
    try { ensureBubbleStyle(cfg); } catch (e) {}
    if (hasDeco) {
      try { ensureDecoMargin(cfg); } catch (e) {}
    }
    return {
      extraCls: ' bub-' + cfg.id + ' bub-applied' + (hasDeco ? ' bub-has-deco' : ''),
      deco: hasDeco ? buildDecoHtml(cfg) : '',
      ears: ''
    };
  }
  /* 带装饰气泡：在聊天中为下方时间戳让位（按装饰尺寸与下侧锚点自适应 margin-bottom） */
  function ensureDecoMargin(cfg) {
    if (!cfg || !cfg.decoration) return;
    var st = ensureStyleEl();
    var idCls = (cfg.source === 'css' ? 'bub-css-' : 'bub-') + cfg.id;
    var size = clampNum(cfg.decoration.size, 16, 80);
    var anchor = isValidAnchor(cfg.decoration.anchor) ? cfg.decoration.anchor : 'tr';
    var mb = (anchor === 'bl' || anchor === 'br') ? (Math.round(size / 2) + 6) : 4;
    var mark = '/*bub-deco-margin-' + cfg.id + '*/';
    var idx = st.textContent.indexOf(mark);
    if (idx !== -1) {
      var segStart = st.textContent.lastIndexOf('\n', idx);
      var segEnd = st.textContent.indexOf('\n', idx + mark.length);
      if (segEnd === -1) segEnd = st.textContent.length;
      st.textContent = st.textContent.slice(0, segStart + 1) + st.textContent.slice(segEnd + 1);
    }
    st.textContent += '\n' + mark + '\n.message-row .message-bubble.' + idCls + '.bub-has-deco{margin-bottom:' + mb + 'px;}';
  }
  /* 装饰物 HTML：绝对定位在气泡四角（图片用背景，符号用文本） */
  function buildDecoHtml(cfg) {
    if (!cfg || !cfg.decoration) return '';
    var sz = clampNum(cfg.decoration.size, 16, 80);
    var st = decoStyleFor(cfg.decoration);
    var isSymbol = cfg.decoration.type === 'symbol' && cfg.decoration.text;
    if (isSymbol) {
      var t = esc(cfg.decoration.text).replace(/\s+/g, ' ');
      return '<span class="bub-deco" style="' + st + 'font-size:' + sz + 'px;line-height:1;white-space:nowrap;text-align:center;">' + t + '</span>';
    }
    if (!cfg.decoration.url) return '';
    return '<span class="bub-deco" style="' + st + 'width:' + sz + 'px;height:' + sz + 'px;background-image:url(' + cfg.decoration.url + ');background-size:contain;background-repeat:no-repeat;background-position:center;"></span>';
  }

  /* ================= 商城页 ================= */
  var _bound = false;
  function renderBubbleShop() {
    if (!_bound) { bindEvents(); _bound = true; }
    var cssGrid = el('bs-grid-css');
    var list = getBubbles();
    var cssList = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].source === 'css') cssList.push(list[i]);
    }
    // CSS 气泡
    if (cssGrid) {
      if (!cssList.length) {
        cssGrid.innerHTML = '<div class="bs-empty">还没有 CSS 气泡，粘贴 CSS 代码创建</div>';
      } else {
        var ch = '';
        for (var c = 0; c < cssList.length; c++) {
          var cc = cssList[c];
          ch += '<div class="bs-card">'
            + '<div class="bs-card-preview">' + miniBubbleStripHtml(cc) + '</div>'
            + '<div class="bs-card-name">' + esc(cc.name) + '</div>'
            + '<div class="bs-card-actions">'
            + '<button class="bs-card-btn" onclick="BubbleMakerAssign(\'' + cc.id + '\')">指派</button>'
            + '<button class="bs-card-btn" onclick="BubbleMakerRename(\'' + cc.id + '\')">改名</button>'
            + '<button class="bs-card-btn danger" onclick="BubbleMakerDelete(\'' + cc.id + '\')">删除</button>'
            + '</div>'
            + '</div>';
        }
        cssGrid.innerHTML = ch;
      }
    }
  }
  /* 商城预览：横条（左对方 / 右我方）—— 气泡预览显示模式 */
  function miniBubbleStripHtml(cfg) {
    return '<div class="bs-strip">'
      + '<div class="bs-strip-side bs-strip-other">' + miniBubbleSingle(cfg, true) + '</div>'
      + '<div class="bs-strip-side bs-strip-self">' + miniBubbleSingle(cfg, false) + '</div>'
      + '</div>';
  }
  function miniBubbleSingle(cfg, isOther) {
    if (cfg.source === 'css') {
      try { ensureCssBubbleStyle(cfg); } catch (e) {}
      if (cfg.wechat) {
        var m = isOther ? 'recv message message-received' : 'sent message message-sent';
        return '<div class="bs-mini-msg ' + m + ' bub-css-' + cfg.id + '">气泡</div>';
      }
      return '<div class="bs-mini-bubble bub-css-' + cfg.id + ' ' + (cfg.cssClass || '') + '">气泡</div>';
    }
    var shadow = cfg.shadowEnabled ? ('box-shadow:' + shadowCssVal(cfg, 0.12) + ';') : '';
    var border = cfg.borderWidth > 0 ? (cfg.borderWidth + 'px solid ' + cfg.borderColor) : 'none';
    var tail = '';
    if (cfg.tailEnabled) {
      var ts = cfg.tailSize;
      var tailPos = isOther ? (cfg.tailPos === 'bl' ? 'br' : 'bl') : cfg.tailPos;
      var side = tailPos === 'bl' ? 'left' : 'right';
      var borderProp = side === 'left' ? 'border-right' : 'border-left';
      var tailColor = (cfg.borderWidth > 0) ? cfg.borderColor : cfg.bgColor;
      tail = '<span style="position:absolute;top:50%;transform:translateY(-50%);' + side + ':-' + ts + 'px;width:0;height:0;'
        + borderProp + ':' + ts + 'px solid ' + tailColor + ';'
        + 'border-top:' + Math.round(ts * 0.62) + 'px solid transparent;'
        + 'border-bottom:' + Math.round(ts * 0.62) + 'px solid transparent;"></span>';
    }
    var deco = '';
    if (cfg.decoration && (cfg.decoration.url || (cfg.decoration.type === 'symbol' && cfg.decoration.text))) {
      var sz = clampNum(cfg.decoration.size, 16, 80);
      var dcfg = { size: sz, anchor: isValidAnchor(cfg.decoration.anchor) ? cfg.decoration.anchor : 'tr' };
      if (cfg.decoration.type === 'symbol' && cfg.decoration.text) {
        deco = '<span style="' + decoStyleFor(dcfg) + 'font-size:' + sz + 'px;line-height:1;white-space:nowrap;text-align:center;">' + esc(cfg.decoration.text).replace(/\s+/g, ' ') + '</span>';
      } else {
        deco = '<span style="' + decoStyleFor(dcfg) + 'width:' + sz + 'px;height:' + sz + 'px;background-image:url(' + cfg.decoration.url + ');background-size:contain;background-repeat:no-repeat;background-position:center;"></span>';
      }
    }
    return '<div class="bs-mini-bubble" style="border-radius:' + cfg.radius + 'px;max-width:' + cfg.maxWidth + 'px;padding:' + cfg.padding + 'px;background:' + cfg.bgColor + ';color:' + cfg.textColor + ';border:' + border + ';' + shadow + '">气泡' + tail + deco + '</div>';
  }

  /* ================= 商城操作 ================= */
  function deleteBubble(id) {
    var cfg = getBubbleById(id);
    if (!cfg) return;
    if (!window.confirm('确定删除气泡「' + (cfg.name || '') + '」吗？')) return;
    var list = getBubbles();
    var next = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== id) next.push(list[i]);
    }
    setBubbles(next);
    // 清理指派引用
    var assign = getAssignments();
    var changed = false;
    for (var k in assign) {
      if (assign[k] === id) { delete assign[k]; changed = true; }
    }
    if (changed) setAssignments(assign);
    try { rebuildAllStyles(); } catch (e) {}
    renderBubbleShop();
    toast('已删除气泡');
  }
  var _renameId = null;
  function renameBubble(id) {
    var cfg = getBubbleById(id);
    if (!cfg) return;
    _renameId = id;
    var overlay = el('bs-rename-overlay');
    var input = el('bs-rename-input');
    if (overlay) overlay.style.display = 'flex';
    if (input) { input.value = cfg.name || ''; input.focus(); }
  }
  function closeRename() {
    var overlay = el('bs-rename-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  function doRename() {
    var id = _renameId;
    var input = el('bs-rename-input');
    if (!id || !input) return;
    var name = (input.value || '').trim();
    if (!name) { toast('请输入名称'); return; }
    var list = getBubbles();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].name = name; break; }
    }
    setBubbles(list);
    closeRename();
    renderBubbleShop();
    toast('名称已更新');
  }

  /* ================= CSS 代码导入 ================= */
  function cssNameExists(name, list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return true;
    }
    return false;
  }
  function saveCssBubble() {
    var codeEl = el('bs-css-code');
    if (!codeEl) return;
    var code = (codeEl.value || '').trim();
    if (!code) {
      toast('请先粘贴 CSS 代码');
      return;
    }
    // 提取类名：取代码中第一个 .xxx 类选择器
    var clsMatch = code.match(/\.([A-Za-z_][\w-]*)/);
    if (!clsMatch) {
      toast('CSS 中未找到类名，请粘贴形如 .my-bubble { ... } 的代码');
      return;
    }
    var cssClass = clsMatch[1];
    // 微信风格检测：同时含 .message-sent 与 .message-received 选择器（带前瞻避免误判 message-sentinel 等前缀类）
    var wechat = /\.message-sent(?=[\s,{.:])/.test(code) && /\.message-received(?=[\s,{.:])/.test(code);
    var list = getBubbles();
    // 同名自动编号
    var baseName = cssClass;
    var name = baseName;
    var seq = 2;
    while (cssNameExists(name, list)) {
      name = baseName + ' ' + seq;
      seq++;
    }
    var cfg = {
      id: 'bub_css_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name,
      source: 'css',
      cssCode: code,
      cssClass: wechat ? 'message' : cssClass,
      wechat: !!wechat,
      createdAt: Date.now()
    };
    // 先写入，再读取校验（防假成功）
    list.push(cfg);
    setBubbles(list);
    var saved = getBubbles().some(function(b) { return b.id === cfg.id; });
    if (!saved) {
      // 回滚
      var rollback = getBubbles().filter(function(b) { return b.id !== cfg.id; });
      setBubbles(rollback);
      toast('保存失败，请重试');
      return;
    }
    try { rebuildAllStyles(); } catch (e) {}
    if (codeEl) codeEl.value = '';
    renderBubbleShop();
    toast('CSS 气泡已保存至气泡商城');
  }

  /* ================= 指派 ================= */
  var _assignOpen = false;
  function openAssign(id) {
    var cfg = getBubbleById(id);
    if (!cfg) return;
    var overlay = el('bs-assign-overlay');
    var nameEl = el('bs-assign-name');
    var box = el('bs-assign-targets');
    if (!overlay || !box) return;
    _assignOpen = true;
    if (nameEl) nameEl.textContent = '「' + (cfg.name || '') + '」';
    box.innerHTML = '';
    var assign = getAssignments();
    var bubbles = getBubbles();
    var allPartners = [];
    try { allPartners = Storage.getPartnerProfiles() || []; } catch (e) {}

    var targets = [{ key: 'self', label: '我方', sub: '我的消息' }];
    for (var i = 0; i < allPartners.length; i++) {
      targets.push({ key: allPartners[i].id, label: allPartners[i].nickname || '角色', sub: '对方 / 角色' });
    }

    for (var t = 0; t < targets.length; t++) {
      var tr = targets[t];
      var row = document.createElement('div');
      row.className = 'bs-assign-item';
      row.setAttribute('data-key', tr.key);
      var label = document.createElement('span');
      label.className = 'bs-assign-label';
      label.innerHTML = esc(tr.label) + '<small>' + esc(tr.sub) + '</small>';
      var sel = document.createElement('select');
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '默认气泡（不指定）';
      sel.appendChild(opt0);
      for (var b = 0; b < bubbles.length; b++) {
        var o = document.createElement('option');
        o.value = bubbles[b].id;
        o.textContent = bubbles[b].name;
        if (assign[tr.key] === bubbles[b].id) o.selected = true;
        sel.appendChild(o);
      }
      row.appendChild(label);
      row.appendChild(sel);
      box.appendChild(row);
    }
    overlay.style.display = 'flex';
  }
  function closeAssign() {
    var overlay = el('bs-assign-overlay');
    if (overlay) overlay.style.display = 'none';
    _assignOpen = false;
  }
  function saveAssign() {
    if (!_assignOpen) return;
    var box = el('bs-assign-targets');
    var rows = box.querySelectorAll('.bs-assign-item');
    var assign = getAssignments();
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].getAttribute('data-key');
      var sel = rows[i].querySelector('select');
      if (!key || !sel) continue;
      if (sel.value) assign[key] = sel.value;
      else delete assign[key];
    }
    setAssignments(assign);
    closeAssign();
    toast('指派已保存');
  }

  /* ================= 事件绑定（仅商城） ================= */
  function bindEvents() {
    var cssSave = el('bs-css-save');
    if (cssSave) cssSave.addEventListener('click', saveCssBubble);
    var assignCancel = el('bs-assign-cancel');
    if (assignCancel) assignCancel.addEventListener('click', closeAssign);
    var assignSave = el('bs-assign-save');
    if (assignSave) assignSave.addEventListener('click', saveAssign);
    var assignOverlay = el('bs-assign-overlay');
    if (assignOverlay) {
      assignOverlay.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'bs-assign-overlay') closeAssign();
      });
    }
    var renameCancel = el('bs-rename-cancel');
    if (renameCancel) renameCancel.addEventListener('click', closeRename);
    var renameSave = el('bs-rename-save');
    if (renameSave) renameSave.addEventListener('click', doRename);
    var renameOverlay = el('bs-rename-overlay');
    if (renameOverlay) {
      renameOverlay.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'bs-rename-overlay') closeRename();
      });
    }
    var renameInput = el('bs-rename-input');
    if (renameInput) {
      renameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doRename(); });
    }
  }

  /* ================= 初始化 ================= */
  function init() {
    try { rebuildAllStyles(); } catch (e) {}
    window.addEventListener('mirror-storage-synced', function() {
      try { rebuildAllStyles(); } catch (e) {}
    });
    window.addEventListener('mirror-storage-restored', function() {
      try { rebuildAllStyles(); } catch (e) {}
    });
  }

  /* ================= 对外接口 ================= */
  return {
    getBubbles: getBubbles,
    getAssignments: getAssignments,
    buildBubbleExt: buildBubbleExt,
    rebuildAllStyles: rebuildAllStyles,
    renderBubbleShop: renderBubbleShop,
    deleteBubble: deleteBubble,
    openAssign: openAssign,
    openRename: renameBubble,
    saveRename: doRename,
    init: init
  };
})();

/* ===== window 挂载（供 navigation.js / 内联 onclick 调用） ===== */
window.BubbleMaker = BubbleMaker;
window.renderBubbleShop = function() { BubbleMaker.renderBubbleShop(); };
window.BubbleMakerDelete = function(id) { BubbleMaker.deleteBubble(id); };
window.BubbleMakerAssign = function(id) { BubbleMaker.openAssign(id); };
window.BubbleMakerRename = function(id) { BubbleMaker.openRename(id); };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { BubbleMaker.init(); });
} else {
  BubbleMaker.init();
}
