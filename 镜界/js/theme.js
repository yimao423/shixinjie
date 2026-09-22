        // 26. 初始化 & 欢迎屏
        // ================================================
        
        // ================================================
        // 26. 外观系统
        // ================================================
        (function initAppearanceSystem() {
            var THEME_KEY = 'mirror_world_theme';
            // 配色表统一由 index.html 头部的引导脚本提供（解析阶段即写入，早于首帧），这里仅兜底
            var COLORS = window.MIRROR_THEME_COLORS || {
                'default': { primary: '#7EC8E3', 'primary-light': '#E0F2F8', 'bg-main': '#EAF4F8', 'dark-text': '#1A3A4A', 'light-text': '#6B8A9A' }
            };

            function colorsFor(name) { return COLORS[name] || COLORS['default']; }
            function normalize(name) { return COLORS[name] ? name : 'default'; }

            /* 主题持久化：localStorage 同步镜像 + Storage(IndexedDB) 权威层双写。
               历史 bug：旧实现只写 localStorage 且没有 try/catch，移动端配额告急或
               隐私模式下 setItem 抛错会直接中断整个 applyTheme —— Tailwind 调色板同步被跳过，
               于是部署后首页部分按键颜色回退成默认浅蓝，重开浏览器也不会恢复。
               现在任一层写成功即视为保存成功，并额外做一次回读校验。 */
            function persistTheme(name) {
                var lsOk = false;
                try { localStorage.setItem(THEME_KEY, name); lsOk = true; } catch (e) { lsOk = false; }
                var kvOk = false;
                try {
                    if (window.Storage && typeof Storage.set === 'function') {
                        Storage.set(THEME_KEY, name);
                        kvOk = true;
                        if (typeof Storage.flush === 'function') { try { Storage.flush(); } catch (e1) { /* 落库异步化，忽略 */ } }
                    }
                } catch (e2) { kvOk = false; }
                // 回读校验：个别浏览器 setItem 不抛错但读回为空，双写都失败时给出提示
                var back = null;
                try { back = localStorage.getItem(THEME_KEY); } catch (e3) { back = null; }
                if (back !== name && !kvOk && !lsOk) {
                    try { console.warn('[mirror] 外观主题保存失败：本地存储不可用'); } catch (e4) { /* 忽略 */ }
                }
                return lsOk || kvOk;
            }

            /* 读取已保存主题：localStorage 优先（与首帧引导脚本同源），再兜底 Storage 内存/IndexedDB 缓存 */
            function readSavedTheme() {
                var v = null;
                try { v = localStorage.getItem(THEME_KEY); } catch (e) { v = null; }
                if (!v && window.Storage && typeof Storage.get === 'function') {
                    try { v = Storage.get(THEME_KEY, null) || null; } catch (e2) { v = null; }
                }
                return normalize(v || 'default');
            }

            /* 触发一次 DOM 变更，促使 Tailwind Play CDN 重新扫描并按新调色板重建样式表 */
            function nudgeRebuild() {
                try {
                    var html = document.documentElement;
                    html.classList.add('theme-rebuild');
                    void html.offsetWidth;
                    html.classList.remove('theme-rebuild');
                } catch (e) { /* 忽略 */ }
            }

            /* 同步 Tailwind 调色板：
               Play CDN 的配色由运行时 config 决定，必须「整体重新赋值一个新对象」才会重建样式，
               原地修改 colors 的属性可能不触发重建 → 首页按键颜色残留上一个主题（表现即浅蓝回退）。 */
            function syncTailwindColors(name) {
                var colors = colorsFor(name);
                var tries = 0;
                function attempt() {
                    if (!window.tailwind) {
                        // CDN 尚未就绪（defer/慢网）：稍后重试，避免主题色永久丢失
                        if (tries++ < 20) setTimeout(attempt, 150);
                        return;
                    }
                    var cur = window.tailwind.config || {};
                    var cfg = {};
                    for (var k in cur) { if (Object.prototype.hasOwnProperty.call(cur, k)) cfg[k] = cur[k]; }
                    if (!cfg.theme) cfg.theme = {};
                    if (!cfg.theme.extend) cfg.theme.extend = {};
                    var merged = {};
                    var old = cfg.theme.extend.colors || {};
                    for (var c in old) { if (Object.prototype.hasOwnProperty.call(old, c)) merged[c] = old[c]; }
                    for (var n in colors) { merged[n] = colors[n]; }
                    cfg.theme.extend.colors = merged;
                    try { window.tailwind.config = cfg; } catch (e) { /* 忽略 */ }
                    try { if (typeof window.tailwind.refresh === 'function') window.tailwind.refresh(); } catch (e2) { /* 忽略 */ }
                    window.__mirrorTailwindThemeSynced = true;
                    nudgeRebuild();
                }
                attempt();
            }

            function applyTheme(themeName, options) {
                options = options || {};
                var name = normalize(themeName || 'default');
                var html = document.documentElement;

                // 顺序很重要：先同步调色板 → 再切 data-theme → 最后改 class（触发 CDN 重建）
                syncTailwindColors(name);
                html.removeAttribute('data-dark');
                if (name === 'default') html.removeAttribute('data-theme');
                else html.setAttribute('data-theme', name);

                document.querySelectorAll('.theme-btn').forEach(function (btn) {
                    btn.classList.toggle('active', btn.dataset.theme === name);
                });
                nudgeRebuild();

                if (!options.skipPersist) persistTheme(name);
                return name;
            }

            function getCurrentTheme() {
                return normalize(document.documentElement.getAttribute('data-theme') || 'default');
            }

            function init() {
                // 首帧引导脚本已按同样规则写过 data-theme，这里再走一遍 applyTheme 以同步调色板与按钮高亮
                applyTheme(readSavedTheme(), { skipPersist: true });

                var options = document.getElementById('theme-options');
                if (options) {
                    options.addEventListener('click', function (e) {
                        var btn = e.target.closest ? e.target.closest('.theme-btn') : null;
                        if (!btn) return;
                        applyTheme(btn.dataset.theme);
                    });
                }

                // 本地镜像缺失（清缓存/换设备）时，异步从 IndexedDB 权威层恢复一次
                var local = null;
                try { local = localStorage.getItem(THEME_KEY); } catch (e) { local = null; }
                if (!local && window.Storage && typeof Storage.getAsync === 'function') {
                    Storage.getAsync(THEME_KEY, null).then(function (v) {
                        if (v && COLORS[v] && getCurrentTheme() === 'default') applyTheme(v, { skipPersist: true });
                    }).catch(function () { /* 忽略 */ });
                }
            }

            /* 跨窗口一致：拾心界宿主页通过 postMessage 下发主题（仅在本地无保存值时采纳，尊重用户选择）；
               同源多标签页之间用 storage 事件同步。 */
            window.MirrorThemeSyncFromParent = function (name, force) {
                if (!COLORS[name]) return false;
                var local = null;
                try { local = localStorage.getItem(THEME_KEY); } catch (e) { local = null; }
                if (local && !force) {
                    if (getCurrentTheme() !== normalize(local)) applyTheme(local, { skipPersist: true });
                    return false;
                }
                applyTheme(name, { skipPersist: true });
                return true;
            };
            window.addEventListener('message', function (ev) {
                try {
                    var data = ev && ev.data;
                    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }
                    if (data && data.type === 'shxj-theme' && data.theme) {
                        window.MirrorThemeSyncFromParent(data.theme, !!data.force);
                    }
                } catch (e2) { /* 忽略 */ }
            });
            window.addEventListener('storage', function (ev) {
                try {
                    if (ev && ev.key === THEME_KEY && ev.newValue) applyTheme(ev.newValue, { skipPersist: true });
                } catch (e) { /* 忽略 */ }
            });

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else { init(); }

            window.applyTheme = applyTheme;
            window.getCurrentTheme = getCurrentTheme;
        })();

        // ================================================
        // 27. 界面大小（整站等比缩放）
        // ================================================
        (function initUiScale() {
            var SCALE_KEY = 'mirror_ui_scale';
            var MIN_SCALE = 70;
            var MAX_SCALE = 130;
            var STEP = 10;
            var DEF_SCALE = 100;

            function clamp(v) {
                v = Math.round(v / STEP) * STEP;
                if (v < MIN_SCALE) v = MIN_SCALE;
                if (v > MAX_SCALE) v = MAX_SCALE;
                return v;
            }

            function applyScale(scale) {
                scale = clamp(scale);
                var root = document.documentElement;
                if (scale === DEF_SCALE) {
                    root.style.removeProperty('zoom');
                } else {
                    root.style.zoom = (scale / 100);
                }
                var slider = document.getElementById('ui-scale-slider');
                var label = document.getElementById('ui-scale-current');
                if (slider) slider.value = scale;
                if (label) label.textContent = scale + '%';
                try { localStorage.setItem(SCALE_KEY, String(scale)); } catch (e) { /* 配额/隐私模式：不影响当前生效 */ }
                try {
                    if (window.Storage && typeof Storage.set === 'function') Storage.set(SCALE_KEY, scale);
                } catch (e2) { /* 忽略 */ }
                return scale;
            }

            function init() {
                var saved = NaN;
                try { saved = parseInt(localStorage.getItem(SCALE_KEY), 10); } catch (e) { saved = NaN; }
                if (isNaN(saved) && window.Storage && typeof Storage.get === 'function') {
                    try { saved = parseInt(Storage.get(SCALE_KEY, NaN), 10); } catch (e2) { saved = NaN; }
                }
                if (isNaN(saved)) saved = DEF_SCALE;
                applyScale(saved);

                var slider = document.getElementById('ui-scale-slider');
                if (slider) {
                    slider.addEventListener('input', function () {
                        applyScale(parseInt(slider.value, 10));
                    });
                }
                var minusBtn = document.getElementById('ui-scale-minus');
                if (minusBtn) {
                    minusBtn.addEventListener('click', function () {
                        var cur = parseInt((slider && slider.value) || '100', 10);
                        applyScale(cur - STEP);
                    });
                }
                var plusBtn = document.getElementById('ui-scale-plus');
                if (plusBtn) {
                    plusBtn.addEventListener('click', function () {
                        var cur = parseInt((slider && slider.value) || '100', 10);
                        applyScale(cur + STEP);
                    });
                }
                var resetBtn = document.getElementById('ui-scale-reset');
                if (resetBtn) {
                    resetBtn.addEventListener('click', function () {
                        applyScale(DEF_SCALE);
                    });
                }
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else { init(); }

            window.applyUiScale = applyScale;
        })();
