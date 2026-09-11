/* ==== theme.js ==== */
/* ===== 拾心界 - 主题管理 ===== */

/* 安卓 fixed/渐变层重绘修复（修复1+2）：背景层 #app-bg 的 --bg-gradient 变量变更后，
   读取一次 getComputedStyle 强制 reflow，确保渐变层随变量强制重绘（background-attachment:fixed 不随变量重绘的替代方案） */
window.__forceBgPaint = function () {
  var el = document.getElementById('app-bg');
  if (!el) return;
  getComputedStyle(el).backgroundImage;
};

const ThemeManager = {
  themes: [
    { id: 'default', name: '浅蓝', color: '#B8DCF0' },
    { id: 'light-pink', name: '浅粉', color: '#F0C0D0' },
    { id: 'light-purple', name: '浅紫', color: '#D8C0E8' },
    { id: 'light-red', name: '浅红', color: '#F0B0B8' },
    { id: 'light-orange', name: '浅橙', color: '#F5C898' },
    { id: 'light-yellow', name: '浅黄', color: '#F5E0A0' },
    { id: 'light-green', name: '浅绿', color: '#B0D8C0' },
    { id: 'white', name: '黑白', color: '#FFFFFF' },
    { id: 'black', name: '暗夜', color: '#5A5A6A' }
  ],

  currentTheme: 'default',
  customColor: null,

  init() {
    this.currentTheme = Storage.get('theme', 'default');
    this.customColor = Storage.get('customThemeColor', null);
    // 防御：镜像中 theme 值非法/为空时兜底回 default，避免 data-theme 被设为无效值
    //（如镜像写入字符串 "null"）导致首帧 CSS 变量不匹配而回退默认浅蓝。
    // —— 根治修复（全局审查结论）：此前只认内置主题表，而内置表不含 'custom'，导致
    //    已保存的自定义主题镜像一刷新即被误判非法、强制回默认浅蓝（背景/欢迎页丢色、
    //    图标因走独立比较仍保留），即"设置后正常、重进回浅蓝、图标色保留"的完整成因。
    //    现改为：'custom' 是合法主题标识，改为校验其自定义主色，而非直接打回默认。
    const isBuiltin = this.themes.find(function(t) { return t.id === this.currentTheme; });
    if (this.currentTheme !== 'custom' && !isBuiltin) {
      this.currentTheme = 'default';
    }
    // custom 主题完整性兜底：确保拥有有效的自定义主色。缺失时依次尝试 themeBundle 合并键
    //（theme/customThemeColor 单键镜像可能缺失/未写全，而 themeBundle 与 iconZones 等键同批
    //  落盘，可在启动同步段兜底补回）；仍不可用则回归默认，避免停留非法 custom 态回浅蓝。
    this._ensureCustomColor();
    // 启动应用不写回：localStorage 镜像缺失时避免把 default 覆盖进权威存储（IDB）
    this.apply(false);
    // 启动主动权威恢复（修复1+2）：localStorage 镜像缺失/被清时，直接从 IndexedDB 权威层
    // 拉取真实主题并 apply(true) 写回镜像，避免移动端刷新首帧回退默认浅蓝、需二次刷新才命中镜像。
    // 保留下方 mirror-storage-restored 监听做异步兜底（二者均以 IDB 为权威，重复回调安全性由防重入保证）。
    // 升级：权威恢复支持指数退避重试 —— IDB 打开完成可能晚于首帧同步段（移动端常见竞态），
    // 一次拉取可能因 AppKVDB 尚未就绪而 miss，此时按 150/300/600/1200ms 递增重试，直至命中主题为止，
    // 确保"设置过自定主题的用户，刷新后首帧也能直接命中真实主题，不再闪默认浅蓝"。
    var self = this;
    var _restoreAttempts = 0;
    var _MAX_RESTORE_ATTEMPTS = 5;
    function _attemptAuthorityRestore() {
      Promise.all([Storage.getAsync('theme'), Storage.getAsync('customThemeColor')]).then(function(vals) {
        var theme = vals[0], color = vals[1];
        var isBuiltin = theme && self.themes.find(function(t) { return t.id === theme; });
        // 注意：'custom' 虽不在内置主题表，却是合法主题标识（自定义主题），须单独放行，
        //       否则 IDB 权威层恢复对自定义主题永不生效（与同步段回浅蓝同源）。
        if (theme === 'custom' || isBuiltin) {
          // 先记录恢复前的同步生效值，用于判定恢复后是否需要重新 apply
          var prevTheme = self.currentTheme;
          var prevColor = self.customColor;
          if (theme === 'custom') {
            // custom 主题恢复：必要时从 themeBundle 补齐自定义色（权威层单键可能缺失）
            if (!color) {
              var b = Storage.get('themeBundle', null);
              if (b && b.customColor && /^#[0-9a-fA-F]{6}$/.test(b.customColor)) color = b.customColor;
            }
            if (color) {
              self.currentTheme = 'custom';
              self.customColor = color;
              Storage.set('customThemeColor', color);
            } else {
              // 权威层仅有 custom 标识、无任何有效自定义色：保留同步段已确立的状态（不吞掉有效态）
              self.currentTheme = prevTheme;
              self.customColor = prevColor;
            }
          } else {
            self.currentTheme = theme;
            self.customColor = null;
          }
          // 需要 apply 的判定（修复）：主题标识变化；或 custom 主题恢复了有效自定义色且与当前应用色不一致。
          // 根因：当 localStorage 镜像存在 theme='custom' 但 customThemeColor 镜像缺失时，同步首帧
          //       customColor=null → apply 走 clearCustomVars 回退默认浅蓝；旧逻辑仅以 theme 是否变化
          //       （changed）决定是否 apply，此时 theme 未变(changed=false) —— custom 色虽已从 IDB 恢复
          //       却永不重绘；旧判定对 custom 主题永不通过，同样导致 IDB 恢复对自定义主题失效。现强制
          //       apply(true) + 写回镜像，使首次直接打开链接即正确显示自定义主题色（背景 + splash）。
          var needApply = theme !== prevTheme || (self.currentTheme === 'custom' && self.customColor && self.customColor !== prevColor);
          if (needApply) {
            if (self.currentTheme !== 'custom') self.customColor = null;
            self.apply(true);
          }
          // 首帧兜底重绘：CSS 变量变更后，在下一渲染帧强制重绘 body 渐变层（#app-bg 为
          // background-attachment:fixed，移动端 WebView 下偶见不随变量刷新；splash 同帧随变量更新）。
          requestAnimationFrame(function() {
            if (window.__forceBgPaint) window.__forceBgPaint();
          });
          return; // 命中真实主题即停止重试
        }
        // 权威层本次未命中：指数退避重试，等待 IDB 就绪后再拉一次
        _restoreAttempts++;
        if (_restoreAttempts < _MAX_RESTORE_ATTEMPTS) {
          setTimeout(_attemptAuthorityRestore, 150 * Math.pow(2, _restoreAttempts - 1));
        }
      });
    }
    _attemptAuthorityRestore();
    // 权威层异步恢复监听：localStorage 被清/损坏而 IDB 仍有真实主题时，恢复后重新应用并写回
    window.addEventListener('mirror-storage-restored', (e) => {
      const d = e.detail;
      if (!d) return;
      if (d.key === 'theme' && typeof d.value === 'string' && this.themes.find(t => t.id === d.value)) {
        if (this.currentTheme !== d.value) {
          this.currentTheme = d.value;
          this.apply();
        }
      } else if (d.key === 'customThemeColor' && this.currentTheme === 'custom') {
        this.customColor = d.value;
        this.apply();
      }
    });
  },

  /* custom 主题完整性兜底（全局审查根治的一部分）：
     确保 currentTheme='custom' 时拥有有效的自定义主色，否则按以下顺序恢复：
     1) 单键镜像有效 → 直接放行；
     2) themeBundle 合并键中 customColor 有效 → 补回单键镜像（双写回权威层）；
     3) themeBundle 显示用户最终用的是某个内置主题 → 跟随内置主题（纠偏旧 custom 脏镜像）；
     4) 完全不可用（历史脏数据/存储被清）→ 回归默认主题，避免停留非法 custom 态回浅蓝。
     只在启动同步段调用，不写回权威层默认值（避免污染 IDB 权威数据）。 */
  _ensureCustomColor() {
    if (this.customColor && /^#[0-9a-fA-F]{6}$/.test(this.customColor)) return;
    const bundle = Storage.get('themeBundle', null);
    if (bundle && typeof bundle === 'object' && bundle.customColor && /^#[0-9a-fA-F]{6}$/.test(bundle.customColor)) {
      this.customColor = bundle.customColor;
      // 回填单键镜像+权威层（统一走 Storage 双写），修复缺口
      Storage.set('customThemeColor', this.customColor);
      return;
    }
    if (bundle && bundle.theme && this.themes.find(function(t) { return t.id === bundle.theme; })) {
      // bundle 显示用户最后用的是内置主题，同步纠偏（避免停在旧 custom）
      this.currentTheme = bundle.theme;
      this.customColor = null;
      return;
    }
    // custom 主题无任何可用色（历史脏数据/存储被清）：回归默认，避免停留非法态
    this.currentTheme = 'default';
    this.customColor = null;
  },

  apply(persist = true) {
    const root = document.documentElement;
    root.setAttribute('data-theme', this.currentTheme);
    if (this.currentTheme === 'custom' && this.customColor) {
      this.applyCustomVars(this.customColor);
    } else {
      this.clearCustomVars();
    }
    this.updateBgEdges();
    // 安卓 fixed/渐变层强制重绘（修复1+2）：背景层 #app-bg 随 --bg-gradient 变更后强制 reflow 重绘
    if (window.__forceBgPaint) window.__forceBgPaint();
    // 主题/自定义色变更后同步全局图标分区：跟随区实时联动，面板显示刷新
    if (window.IconZones) IconZones.onThemeChange();
    if (persist) {
      Storage.set('theme', this.currentTheme);
      // 捆绑键：主题+自定义色合并为单键持久化（同批写 localStorage 镜像 + IDB）。
      // 供启动 init 同步恢复兜底，避免个别单键镜像缺失时依赖异步 IDB 恢复链路。
      Storage.set('themeBundle', {
        theme: this.currentTheme,
        customColor: this.customColor,
        ts: Date.now()
      });
    }
  },

  // 从当前背景渐变中自动提取顶部/底部颜色，供顶栏与底部导航沉浸式使用
  updateBgEdges() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const grad = cs.getPropertyValue('--bg-gradient').trim();
    const colors = grad.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g) || [];
    if (colors.length >= 2) {
      root.style.setProperty('--bg-top', colors[0]);
      // 底栏精确取色（真实可见优先）：优先「渲染采样底栏上边缘紧贴处背景横带」——
      // 它把当前页面真正渲染出来的可见背景（含各页面本地覆盖层/输入栏/壁纸）都采进来，
      // 底栏顶边与该处逐像素一致，任何页面/主题下都不会出现可辨分界。取不到或解析失败
      // 才退回「按 body 渐变纯计算」与「离屏重建渐变采样」兜底（这两者只能还原 body 渐变，
      // 遇到页面自身背景覆盖渐变时可能产生 ±5 级差，故仅作降级）。
      const real = this._sampleNavRealColor() || this._computeNavBottomColor();
      const sampled = real || this._sampleBgBottomColor(grad);
      root.style.setProperty('--bg-bottom', sampled || colors[colors.length - 1]);
      root.style.setProperty('--bg-bottom-end', colors[colors.length - 1]);
    } else {
      root.style.removeProperty('--bg-top');
      root.style.removeProperty('--bg-bottom');
      root.style.removeProperty('--bg-bottom-end');
    }
    // 计算毛玻璃半透层叠加当前背景后的不透明色（顶栏沉浸用）
    const glass = cs.getPropertyValue('--glass-bg').trim();
    const top = this.parseColor(colors[0] || '');
    const g = this.parseColor(glass);
    if (top && g) {
      const r = Math.round(g.r * g.a + top.r * (1 - g.a));
      const gg = Math.round(g.g * g.a + top.g * (1 - g.a));
      const b = Math.round(g.b * g.a + top.b * (1 - g.a));
      root.style.setProperty('--glass-solid', `rgb(${r},${gg},${b})`);
    } else {
      root.style.removeProperty('--glass-solid');
    }
  },

  /* 路由切换 / 窗口尺寸变化后刷新底栏背景色：等浏览器完成下一次重绘后再采样，
     保证采到的是切换后页面真实渲染结果。因底栏为 fixed，滚动过程不重采（散射色带仅出现在
     切换瞬间），微信/QQ 亦不随滚动改写底栏色。 */
  refreshNavBg() {
    const self = this;
    requestAnimationFrame(function() {
      setTimeout(function() {
        if (!document.hidden) self.updateBgEdges();
      }, 16);
    });
  },

  /* 按视口纯计算底栏所处位置的渐变真色（首选方案）：
     body 渐变 background-attachment:fixed 以视口为坐标系铺满；底栏 fixed 于视口底部，
     故「底栏覆盖处背景色」= 渐变在(视口水平中心, 底栏垂直中点)处的插值色。
     解析 --bg-gradient 的 stop/位置与角度，按 CSS 同一投影规则计算插值，返回 hex。
     解析失败返回空串（调用方回退渲染采样）。无 canvas / 无渲染依赖，内容干扰为零。 */
  _computeNavBottomColor() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const grad = cs.getPropertyValue('--bg-gradient').trim();
    if (!grad || grad.indexOf('linear-gradient') !== 0) return '';
    const m = grad.match(/^linear-gradient\(\s*([^)]+)\)\s*$/);
    if (!m) return '';
    const seg = m[1].trim();
    let angle = 180;
    let body = seg;
    const am = seg.match(/^([-+\d.]+)deg\s*,\s*([\s\S]+)$/);
    if (am) { angle = parseFloat(am[1]); body = am[2]; }
    let stops = [];
    const stopRe = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*(?:([-+\d.]+)%\s*)?/g;
    let sm;
    while ((sm = stopRe.exec(body)) !== null) {
      if (!sm[1]) continue;
      stops.push({ c: sm[1], p: sm[2] !== undefined && sm[2] !== null && sm[2] !== '' ? Math.max(0, Math.min(1, parseFloat(sm[2]) / 100)) : null });
    }
    if (stops.length < 2) return '';
    // 补全缺失位置：头 0、尾 100%，中间在相邻已知位置间均分
    let posIdx = [];
    for (let i = 0; i < stops.length; i++) if (stops[i].p !== null) posIdx.push(i);
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].p === null) {
        if (i === 0) stops[i].p = 0;
        else if (i === stops.length - 1) stops[i].p = 1;
        else {
          let prev = -1, next = -1;
          for (let k = i - 1; k >= 0; k--) if (stops[k].p !== null) { prev = k; break; }
          for (let k = i + 1; k < stops.length; k++) if (stops[k].p !== null) { next = k; break; }
          if (prev >= 0 && next >= 0) {
            const slot = next - prev;
            const segLen = stops[next].p - stops[prev].p;
            stops[i].p = stops[prev].p + segLen * ((i - prev) / slot);
          } else stops[i].p = prev >= 0 ? stops[prev].p : 0;
        }
      }
    }
    const W = Math.max(document.documentElement.clientWidth || 0, 320);
    const H = Math.max(window.innerHeight || 0, 480);
    let navTop = H - 76;
    const nav = document.getElementById('bottom-nav') || document.querySelector('.bottom-nav');
    if (nav) { try { navTop = nav.getBoundingClientRect().top; } catch (e) {} }
    // 底栏覆盖处采样点：水平取视口中心，垂直取「底栏顶边上缘紧贴处」的背景色。
    // 关键：底栏固定于视口底部，用户可见的分界只发生在底栏上边缘这一条缝上；
    // 采样底栏顶边正上方的渐变插值色作为 --bg-bottom，可保证底栏实体色与该处
    // 实际可见背景逐像素一致，任意页面/主题/机型下顶边无缝、肉眼看不出分界。
    // （旧实现取底栏垂直中点，顶部与下方同列渐变仍有细微起伏，偶见可辨色带。）
    const px = W / 2;
    const py = Math.max(0, Math.min(H - 1, navTop - 1));
    const rad = angle * Math.PI / 180;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const L = Math.abs(W * dx) + Math.abs(H * dy);
    if (!(L > 0)) return '';
    const cx = W / 2, cy = H / 2;
    const sxp = cx - dx * L / 2, syp = cy - dy * L / 2;
    const tRaw = ((px - sxp) * dx + (py - syp) * dy) / L;
    const t = Math.max(0, Math.min(1, tRaw));
    let i = 0;
    for (; i < stops.length - 1; i++) {
      if (t <= stops[i + 1].p) break;
    }
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const span = (b.p - a.p) || 1;
    const f = Math.max(0, Math.min(1, (t - a.p) / span));
    const ca = this.parseColor(a.c), cb = this.parseColor(b.c);
    if (!ca || !cb) return '';
    const cc = (x, y) => Math.round(x + (y - x) * f);
    const toHex = v => ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    return '#' + toHex(cc(ca.r, cb.r)) + toHex(cc(ca.g, cb.g)) + toHex(cc(ca.b, cb.b));
  },

  /* 实际渲染采样（兜底）：把当前文档渲染绘制到离屏 canvas，采样「底栏上边缘紧贴处的背景横带」。
     只在左右两侧角落（宽 12%）取色，规避居中内容（白卡片/列表/消息）的干扰，
     稳定跟随背景主体（渐变/壁纸/页面底部底色）。取该角落横带内出现频次最高的颜色桶的平均色；
     采样失败返回空串（调用方回退重建渐变采样）。 */
  _sampleNavRealColor() {
    try {
      const nav = document.getElementById('bottom-nav') || document.querySelector('.bottom-nav');
      let navTop = window.innerHeight - 90;
      if (nav) { try { navTop = nav.getBoundingClientRect().top; } catch (e) {} }
      const W = Math.max(document.documentElement.clientWidth || 0, 320);
      const H = Math.max(window.innerHeight || 0, 480);
      const sy = Math.max(0, Math.floor(navTop) - 5);
      const sh = Math.min(4, Math.max(1, Math.floor(navTop) - 1));
      if (sy + sh > H) return '';
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(document.documentElement, 0, sy, W, sh, 0, 0, W, sh);
      const d = ctx.getImageData(0, 0, W, sh).data;
      // 只统计左右两侧 12% 角落的像素，规避居中内容干扰（采样条严格位于底栏上边缘之上，
      // 不跨入底栏自身，避免把上一版 --bg-bottom 递归采进去造成惯性偏差）
      const leftEnd = Math.floor(W * 0.12);
      const rightStart = Math.ceil(W * 0.88);
      const buckets = {};
      const touch = (i) => {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r === 0 && g === 0 && b === 0) return;
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        let bk = buckets[key];
        if (!bk) { bk = buckets[key] = { n: 0, r: 0, g: 0, b: 0 }; }
        bk.n++; bk.r += r; bk.g += g; bk.b += b;
      };
      for (let y = 0; y < sh; y++) {
        const base = y * W;
        for (let x = 0; x < leftEnd; x++) touch((base + x) * 4);
        for (let x = rightStart; x < W; x++) touch((base + x) * 4);
      }
      let best = null;
      for (const k in buckets) {
        if (!Object.prototype.hasOwnProperty.call(buckets, k)) continue;
        const bk = buckets[k];
        if (!best || bk.n > best.n) best = bk;
      }
      if (!best || !best.n) return '';
      const toHex = v => ('0' + Math.round(best[v] / best.n).toString(16)).slice(-2);
      return '#' + toHex('r') + toHex('g') + toHex('b');
    } catch (e) {
      return '';
    }
  },

  // 离屏 canvas 重建 body 的 linear-gradient 背景（与 background-attachment:fixed 一致按视口铺满），
  // 采样底栏覆盖处中心像素色并转十六进制返回；解析失败返回空串（调用方回退端点色）
  _sampleBgBottomColor(grad) {
    try {
      if (!grad || grad.indexOf('linear-gradient') !== 0) return '';
      const m = grad.match(/^linear-gradient\(\s*([^)]+)\)\s*$/);
      if (!m) return '';
      const seg = m[1].trim();
      let angle = 160;
      let body = seg;
      const am = seg.match(/^([-+\d.]+)deg\s*,\s*([\s\S]+)$/);
      if (am) { angle = parseFloat(am[1]); body = am[2]; }
      const stopRe = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*(?:([-+\d.]+)%\s*)?/g;
      const stops = [];
      let sm;
      while ((sm = stopRe.exec(body)) !== null) {
        if (!sm[1]) continue;
        stops.push({ c: sm[1], p: sm[2] != null ? Math.max(0, Math.min(1, parseFloat(sm[2]) / 100)) : null });
      }
      if (stops.length < 2) return '';
      const W = Math.max(document.documentElement.clientWidth || 0, 320);
      const H = Math.max(window.innerHeight || 0, 480);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const rad = angle * Math.PI / 180;
      const dx = Math.sin(rad), dy = -Math.cos(rad);
      const L = Math.abs(W * dx) + Math.abs(H * dy);
      const cxx = W / 2, cyy = H / 2;
      const g = ctx.createLinearGradient(cxx - dx * L / 2, cyy - dy * L / 2, cxx + dx * L / 2, cyy + dy * L / 2);
      for (let i = 0; i < stops.length; i++) {
        let p = stops[i].p;
        if (p === null) {
          // 无位置的中段 stop：按 CSS 默认在相邻 stop 间均分，这里取前一已知位置（内置主题均带位置）
          let j = i - 1;
          while (j >= 0 && stops[j].p === null) j--;
          p = (j >= 0 && stops[j].p !== null) ? stops[j].p : (i > 0 ? 0.5 : 0);
        }
        g.addColorStop(p, stops[i].c);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // 底栏覆盖处中心点：底栏高约 90px（含 safe-bottom），采样其垂直中点，水平取视口中心
      const navH = 90;
      const sy = Math.max(0, Math.floor(H - navH / 2));
      const sx = Math.min(W - 1, Math.floor(W / 2));
      const d = ctx.getImageData(sx, sy, 1, 1).data;
      const toHex = v => ('0' + v.toString(16)).slice(-2);
      return '#' + toHex(d[0]) + toHex(d[1]) + toHex(d[2]);
    } catch (e) {
      return '';
    }
  },

  parseColor(str) {
    if (!str) return null;
    let m = str.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map(s => parseFloat(s.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    m = str.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
        a: h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1
      };
    }
    return null;
  },

  set(themeId) {
    if (this.themes.find(t => t.id === themeId)) {
      this.currentTheme = themeId;
      this.apply();
    }
  },

  setCustom() {
    this.currentTheme = 'custom';
    this.apply();
  },

  getCurrent() {
    if (this.currentTheme === 'custom') {
      return { id: 'custom', name: '自定义', color: this.customColor || '#B8DCF0' };
    }
    return this.themes.find(t => t.id === this.currentTheme) || this.themes[0];
  },

  /* ---- 自定义主题 ---- */

  // 实时预览：临时应用自定义主色（不保存）
  previewCustom(color) {
    this.applyCustomVars(color);
    this.updateBgEdges();
    const hexEl = document.getElementById('custom-theme-hex');
    if (hexEl) hexEl.textContent = color.toUpperCase();
  },

  // 保存自定义主题
  saveCustom() {
    const colorInput = document.getElementById('custom-theme-color');
    const color = colorInput ? colorInput.value : '#B8DCF0';
    this.customColor = color;
    Storage.set('customThemeColor', color);
    this.currentTheme = 'custom';
    this.apply();
    this.renderThemeSelector(document.querySelector('.theme-grid'));
    Core.toast('自定义主题已保存');
  },

  // 恢复默认主题
  resetCustom() {
    this.customColor = null;
    Storage.remove('customThemeColor');
    this.currentTheme = 'default';
    this.apply();
    this.renderThemeSelector(document.querySelector('.theme-grid'));
    const colorInput = document.getElementById('custom-theme-color');
    if (colorInput) colorInput.value = '#B8DCF0';
    const hexEl = document.getElementById('custom-theme-hex');
    if (hexEl) hexEl.textContent = '#B8DCF0';
    Core.toast('已恢复默认主题');
  },

  // 根据主色生成配套浅色变体并应用到 CSS 变量
  applyCustomVars(color) {
    const root = document.documentElement;
    const rgb = this.hexToRgb(color);
    const light = this.lighten(color, 0.85);
    const dark = this.darken(color, 0.75);
    // 背景：基于主色仅减淡约 40%（混白 40% 左右），明显呈现所选主色色调
    const bgMain = this.lighten(color, 0.48);
    const bgStart = this.lighten(color, 0.38);
    const bgMid = this.lighten(color, 0.55);
    const bgEnd = this.lighten(color, 0.45);
    const bgPanel = this.lighten(color, 0.62);
    root.style.setProperty('--primary', color);
    root.style.setProperty('--primary-rgb', rgb);
    root.style.setProperty('--primary-light', light);
    root.style.setProperty('--panel-light', this.lighten(color, 0.78));
    root.style.setProperty('--primary-dark', dark);
    // 修复7：--primary-soft（拍一拍通知气泡文字/次要图标色等）跟随自定义主色。
    // 内置主题色板里 soft 即 primary 的"近同色微调变体"：浅色主色取略深一档、深色主色提亮保证可读。
    var _rp = parseInt(color.substring(1,3), 16), _gp = parseInt(color.substring(3,5), 16), _bp = parseInt(color.substring(5,7), 16);
    if (!isNaN(_rp + _gp + _bp)) {
      var _curL = (Math.max(_rp, _gp, _bp) + Math.min(_rp, _gp, _bp)) / 2 / 255;
      var _softL = _curL > 0.55 ? Math.max(0.68, _curL - 0.06) : 0.25;
      root.style.setProperty('--primary-soft', this.mixToLightness(color, _softL));
    }
    root.style.setProperty('--primary-bg', bgPanel);
    root.style.setProperty('--bg-main', bgMain);
    root.style.setProperty('--bg-gradient', `linear-gradient(160deg, ${bgStart}, ${bgMid} 55%, ${bgEnd})`);
    root.style.setProperty('--nav-active', color);
    root.style.setProperty('--nav-icon-active-bg', `rgba(${rgb}, 0.55)`);
    root.style.setProperty('--nav-label-active', color);
    root.style.setProperty('--magic-color', color);
    root.style.setProperty('--magic-rgb', rgb);
    root.style.setProperty('--magic-glow', `rgba(${rgb}, 0.30)`);
    // 聊天气泡：明度对齐默认浅蓝主题（发送 L≈0.78 明亮、接收 L≈0.97 极浅），保留主色色相
    const selfBg = this.mixToLightness(color, 0.78);
    const otherBg = this.mixToLightness(color, 0.97);
    const darkText = this.darken(color, 0.62);
    const selfText = this.darken(color, 0.35);
    root.style.setProperty('--chat-bubble-self-bg', selfBg);
    root.style.setProperty('--chat-bubble-self-text', selfText);
    root.style.setProperty('--chat-bubble-self-border', '#FFFFFF');
    root.style.setProperty('--chat-bubble-other-bg', otherBg);
    root.style.setProperty('--chat-bubble-other-text', darkText);
    root.style.setProperty('--chat-bubble-other-border', color);
  },

  // 清除自定义主题的 inline CSS 变量
  clearCustomVars() {
    const root = document.documentElement;
    [
      '--primary', '--primary-rgb', '--primary-light', '--panel-light', '--primary-dark', '--primary-soft', '--primary-bg',
      '--bg-main', '--bg-gradient', '--nav-active', '--nav-icon-active-bg', '--nav-label-active',
      '--magic-color', '--magic-rgb', '--magic-glow',
      '--chat-bubble-self-bg', '--chat-bubble-self-text', '--chat-bubble-self-border',
      '--chat-bubble-other-bg', '--chat-bubble-other-text', '--chat-bubble-other-border'
    ].forEach(v => root.style.removeProperty(v));
  },

  /* ---- 颜色工具 ---- */

  hexToRgb(hex) {
    const h = hex.replace('#', '');
    return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`;
  },

  // 向白色混合生成浅色
  lighten(hex, ratio) {
    const h = hex.replace('#', '');
    const r = Math.round(parseInt(h.substring(0, 2), 16) + (255 - parseInt(h.substring(0, 2), 16)) * ratio);
    const g = Math.round(parseInt(h.substring(2, 4), 16) + (255 - parseInt(h.substring(2, 4), 16)) * ratio);
    const b = Math.round(parseInt(h.substring(4, 6), 16) + (255 - parseInt(h.substring(4, 6), 16)) * ratio);
    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
  },

  // 向黑色混合生成深色
  darken(hex, ratio) {
    const h = hex.replace('#', '');
    const r = Math.round(parseInt(h.substring(0, 2), 16) * ratio);
    const g = Math.round(parseInt(h.substring(2, 4), 16) * ratio);
    const b = Math.round(parseInt(h.substring(4, 6), 16) * ratio);
    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
  },

  // 调节至目标 HSL 明度（L=(max+min)/2），用于气泡明度对齐默认主题：
  // 目标比当前暗 → 各通道等比缩放（保持色相）；目标比当前亮 → 向白色混合
  mixToLightness(hex, targetL) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const curL = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
    if (Math.abs(curL - targetL) < 0.002) return hex;
    if (targetL < curL) {
      const k = targetL / curL;
      return `#${this.toHex(Math.round(r * k))}${this.toHex(Math.round(g * k))}${this.toHex(Math.round(b * k))}`;
    }
    // 目标比当前亮：向白色混合 t，使 (max'+min')/2 达到 targetL*255
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const T = targetL * 255;
    let t = (2 * T - max - min) / (510 - max - min);
    t = Math.max(0, Math.min(1, t));
    const mix = c => Math.round(c + (255 - c) * t);
    return `#${this.toHex(mix(r))}${this.toHex(mix(g))}${this.toHex(mix(b))}`;
  },

  toHex(n) {
    return n.toString(16).padStart(2, '0');
  },

  renderThemeSelector(container) {
    if (!container) return;
    let html = '<div class="theme-grid">';
    this.themes.forEach(t => {
      const active = t.id === this.currentTheme ? ' active' : '';
      html += `
        <div class="theme-option${active}" data-theme="${t.id}" onclick="ThemeManager.set('${t.id}');ThemeManager.renderThemeSelector(document.querySelector('.theme-grid'));Core.toast('主题已切换')">
          <div class="theme-swatch" style="background:${t.color}"></div>
          <div class="theme-name">${t.name}</div>
        </div>
      `;
    });
    // 自定义主题选项（保存过自定义主题后显示）
    if (this.customColor) {
      const active = this.currentTheme === 'custom' ? ' active' : '';
      html += `
        <div class="theme-option${active}" data-theme="custom" onclick="ThemeManager.setCustom();ThemeManager.renderThemeSelector(document.querySelector('.theme-grid'));Core.toast('已应用自定义主题')">
          <div class="theme-swatch" style="background:${this.customColor}"></div>
          <div class="theme-name">自定义</div>
        </div>
      `;
    }
    html += '</div>';
    container.outerHTML = html;
  }
};

window.ThemeManager = ThemeManager;

/* ============================================================
   全局图标分区自定义（2026-09-03）
   六个区域：首页应用 / 底栏按键 / 字卡列表 / 发现列表 /
             设置界面 / 聊天加号菜单
   默认各区域跟随当前主题主色；用户可在外观设置中为每个区域单独
   指定颜色，避免自定义主题下同色系难以区分。已保存的分区色独立
   于主题，内置主题与自定义主题切换时均保持。
   ============================================================ */
const IconZones = {
  zones: [
    { key: 'home', label: '首页应用' },
    { key: 'tabbar', label: '底栏按键' },
    { key: 'wordcard', label: '字卡列表' },
    { key: 'discover', label: '发现列表' },
    { key: 'settings', label: '设置界面' },
    { key: 'chatplus', label: '聊天加号菜单' }
  ],
  storeKey: 'iconZones',
  data: {},

  init() {
    let saved = null;
    try { saved = Storage.get(this.storeKey, null); } catch (e) {}
    this.data = (saved && typeof saved === 'object') ? saved : {};
    this.apply();
    this.syncUI();
  },

  // 将分区自定义色写入 CSS 变量；未自定义的分区 removeProperty，
  // 回落 :root 默认（跟随主题主色）。存储色若等于当前主题主色，
  // 也视为「跟随主题」，不写死 inline，保证切换主题时实时联动。
  apply() {
    const root = document.documentElement;
    const base = this._currentThemeColor().toLowerCase();
    this.zones.forEach(z => {
      const v = this.data[z.key];
      const eff = (v && v.toLowerCase() !== base) ? v : null;
      if (eff) {
        root.style.setProperty('--icon-' + z.key, eff);
        root.style.setProperty('--icon-' + z.key + '-rgb', ThemeManager.hexToRgb(eff));
      } else {
        root.style.removeProperty('--icon-' + z.key);
        root.style.removeProperty('--icon-' + z.key + '-rgb');
      }
    });
  },

  // 主题切换后回调：重算分区变量 + 刷新面板显示（由 ThemeManager.apply 触发）
  onThemeChange() {
    this.apply();
    this.syncUI();
  },

  _currentThemeColor() {
    const c = ThemeManager.getCurrent();
    return (c && c.color) ? c.color : '#B8DCF0';
  },

  // 选色实时预览该分区颜色（不落盘）
  previewZone(input) {
    const key = input.getAttribute('data-zone');
    const v = input.value;
    input.setAttribute('data-touched', '1');
    const root = document.documentElement;
    root.style.setProperty('--icon-' + key, v);
    root.style.setProperty('--icon-' + key + '-rgb', ThemeManager.hexToRgb(v));
    const hexEl = document.getElementById('icon-zone-' + key + '-hex');
    if (hexEl) { hexEl.textContent = v.toUpperCase(); hexEl.classList.add('resettable'); }
    this._syncDot(key, v);
  },

  // 保存全部：收集各分区选色并落盘
  saveFromUI() {
    const next = {};
    const base = this._currentThemeColor().toLowerCase();
    this.zones.forEach(z => {
      const input = document.getElementById('icon-zone-' + z.key);
      const val = (input && input.getAttribute('data-touched') === '1') ? input.value : null;
      // 等于当前主题主色的选择视为「跟随主题」，不落盘为固定色，
      // 保证之后切换主题时该区仍能实时联动
      next[z.key] = (val && val.toLowerCase() !== base) ? val : null;
    });
    this.data = next;
    Storage.set(this.storeKey, this.data);
    this.apply();
    this.syncUI();
    Core.toast('全局图标颜色已保存');
  },

  // 单个分区复位为跟随主题（点击 hex 文本触发）
  resetZoneFromHex(elm) {
    const row = elm.closest ? elm.closest('.icon-zone-row') : null;
    if (!row) return;
    const key = row.getAttribute('data-zone');
    if (!this.data[key]) return;
    this.data[key] = null;
    Storage.set(this.storeKey, this.data);
    const root = document.documentElement;
    root.style.removeProperty('--icon-' + key);
    root.style.removeProperty('--icon-' + key + '-rgb');
    this.syncUI();
    Core.toast('该区域已恢复跟随主题');
  },

  // 全部复位为跟随主题
  resetAll() {
    this.data = {};
    Storage.remove(this.storeKey);
    this.apply();
    this.syncUI();
    Core.toast('全部区域已恢复跟随主题');
  },

  // 同步 UI 面板：已保存区显示色值，未保存区显示「跟随主题」
  syncUI() {
    const base = this._currentThemeColor().toLowerCase();
    this.zones.forEach(z => {
      const input = document.getElementById('icon-zone-' + z.key);
      if (!input) return;
      const saved = this.data[z.key];
      const custom = (saved && saved.toLowerCase() !== base);
      input.value = custom ? saved : base;
      if (custom) input.setAttribute('data-touched', '1');
      else input.removeAttribute('data-touched');
      const hexEl = document.getElementById('icon-zone-' + z.key + '-hex');
      if (hexEl) { hexEl.textContent = custom ? saved.toUpperCase() : '跟随主题'; hexEl.classList.toggle('resettable', custom); }
      this._syncDot(z.key, custom ? saved : base);
    });
  },

  _syncDot(key, color) {
    const row = document.querySelector('.icon-zone-row[data-zone="' + key + '"]');
    if (!row) return;
    const dot = row.querySelector('.icon-zone-dot');
    if (dot) dot.style.background = color;
  }
};
window.IconZones = IconZones;


