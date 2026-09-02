/* ==== theme.js ==== */
/* ===== 拾心界 - 主题管理 ===== */

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
    // 启动应用不写回：localStorage 镜像缺失时避免把 default 覆盖进权威存储（IDB）
    this.apply(false);
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

  apply(persist = true) {
    const root = document.documentElement;
    root.setAttribute('data-theme', this.currentTheme);
    if (this.currentTheme === 'custom' && this.customColor) {
      this.applyCustomVars(this.customColor);
    } else {
      this.clearCustomVars();
    }
    this.updateBgEdges();
    if (persist) {
      Storage.set('theme', this.currentTheme);
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
      root.style.setProperty('--bg-bottom', colors[colors.length - 1]);
    } else {
      root.style.removeProperty('--bg-top');
      root.style.removeProperty('--bg-bottom');
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
      '--primary', '--primary-rgb', '--primary-light', '--panel-light', '--primary-dark', '--primary-bg',
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


