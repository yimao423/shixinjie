        // 26. 初始化 & 欢迎屏
        // ================================================
        
        // ================================================
        // 26. 外观系统
        // ================================================
        (function initAppearanceSystem() {
            var THEME_KEY = 'mirror_world_theme';

            function applyTheme(themeName) {
                var html = document.documentElement;
                html.removeAttribute('data-theme');
                html.removeAttribute('data-dark');
                if (themeName && themeName !== 'default') {
                    html.setAttribute('data-theme', themeName);
                }
                document.querySelectorAll('.theme-btn').forEach(function(btn) {
                    btn.classList.toggle('active', btn.dataset.theme === themeName);
                });
                localStorage.setItem(THEME_KEY, themeName);
                updateTailwindColors(themeName);
            }

            function getCurrentTheme() {
                var attr = document.documentElement.getAttribute('data-theme');
                return attr || 'default';
            }

            function updateTailwindColors(themeName) {
                if (!window.tailwind || !window.tailwind.config) return;
                var cfg = window.tailwind.config;
                if (!cfg.theme || !cfg.theme.extend || !cfg.theme.extend.colors) return;
                var themeColors = {
                    'default': { primary: '#7EC8E3', 'primary-light': '#E0F2F8', 'bg-main': '#EAF4F8', 'dark-text': '#1A3A4A', 'light-text': '#6B8A9A' },
                    'blue-pink': { primary: '#F0A0B8', 'primary-light': '#FCE8F0', 'bg-main': '#F6ECEF', 'dark-text': '#3A2A30', 'light-text': '#8A7A80' },
                    'blue-purple': { primary: '#B8A0E8', 'primary-light': '#F0E8FC', 'bg-main': '#EEEBF6', 'dark-text': '#2A253A', 'light-text': '#7A758A' },
                    'red-orange': { primary: '#F5A0A0', 'primary-light': '#FAEAEA', 'bg-main': '#F6ECEC', 'dark-text': '#4A2A2A', 'light-text': '#9A7A7A' },
                    'orange-yellow': { primary: '#F5C89A', 'primary-light': '#FAF0E0', 'bg-main': '#F6F0E8', 'dark-text': '#4A3A2A', 'light-text': '#9A8A6A' },
                    'blue-green': { primary: '#78C8A0', 'primary-light': '#E8F8F0', 'bg-main': '#EEF6F2', 'dark-text': '#1A3028', 'light-text': '#688078' },
                    'global-black': { primary: '#b0b0b8', 'primary-light': '#2a2a2e', 'bg-main': '#111111', 'dark-text': '#e0e0e0', 'light-text': '#999999' },
                    'global-white': { primary: '#444444', 'primary-light': '#f0f0f0', 'bg-main': '#ffffff', 'dark-text': '#111111', 'light-text': '#333333' }
                };
                var colors = themeColors[themeName] || themeColors['default'];
                for (var k in colors) { cfg.theme.extend.colors[k] = colors[k]; }
                try { if (window.tailwind.refresh) window.tailwind.refresh(); } catch(e) {}
            }

            function init() {
                var savedTheme = localStorage.getItem(THEME_KEY) || 'default';
                applyTheme(savedTheme);
                document.getElementById('theme-options').addEventListener('click', function(e) {
                    var btn = e.target.closest('.theme-btn');
                    if (!btn) return;
                    applyTheme(btn.dataset.theme);
                });
            }

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
                try { localStorage.setItem(SCALE_KEY, String(scale)); } catch (e) {}
                return scale;
            }

            function init() {
                var saved = parseInt(localStorage.getItem(SCALE_KEY), 10);
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
