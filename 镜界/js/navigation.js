        // 20. 页面路由切换
        // ================================================
        function switchPage(pageId) {
            document.querySelectorAll('#app .page').forEach(page => {
                page.classList.remove('active');
            });

            const target = document.getElementById(pageId);
            if (target) {
                target.setAttribute('data-freeze-transitions', '');
                target.classList.add('active');
                if (target.scrollTop !== undefined) target.scrollTop = 0;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        target.removeAttribute('data-freeze-transitions');
                    });
                });
            }

            // 导航高亮
            const navMap = {
                'page-home': 'page-home',
                'page-decks': 'page-home',
                'page-divine': 'page-divine',
                'page-tutorial': 'page-tutorial',
                'page-settings': 'page-settings',
                'page-spreads': 'page-home',
                'page-spread-detail': 'page-home',
                'page-create-spread': 'page-home',
                'page-deck-detail': 'page-home',
                'page-create': 'page-home',
                'page-manual-viewer': 'page-tutorial',
                'page-divine-history': 'page-home'
            };

            const navTarget = navMap[pageId] || 'page-home';
            document.querySelectorAll('.nav-item-new').forEach(item => {
                item.classList.remove('active-nav');
            });
            const activeNav = document.querySelector('.nav-item-new[data-target="' + navTarget + '"]');
            if (activeNav) {
                activeNav.classList.add('active-nav');
            }

            // 回到首页时刷新今日运势和占卜记录
            if (pageId === 'page-home') {
                if (typeof initDailyFortune === 'function') initDailyFortune();
                if (typeof window.renderRecentRecords === 'function') window.renderRecentRecords();
            }
            // 进入设置页时刷新快捷占卜设置显示 + 存储空间
            if (pageId === 'page-settings') {
                if (typeof updateQuickDivineSettingsUI === 'function') updateQuickDivineSettingsUI();
                if (typeof updateStorageUsage === 'function') updateStorageUsage();
            }
        }

        // ================================================
