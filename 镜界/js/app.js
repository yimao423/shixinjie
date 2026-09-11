
        document.addEventListener('DOMContentLoaded', async () => {
            var DIVINE_RECORDS_KEY = 'mirror_divine_records';
            var MAX_RECORDS = 200;
            await loadDecksFromStorage();
            loadManualsFromStorage();
            ensureIChingDeckCache();
            renderRecentRecords();
            updateStorageUsage();

            // ---- 时钟指针动画（欢迎页）----
            function updateClockHands(groupId, cx, cy, hourAngle, minuteAngle, hourLen, minLen) {
                const group = document.getElementById(groupId);
                if (!group) return;
                const hands = group.querySelectorAll('line');
                if (hands.length < 2) return;
                const hourRad = (hourAngle - 90) * Math.PI / 180;
                hands[0].setAttribute('x2', cx + hourLen * Math.cos(hourRad));
                hands[0].setAttribute('y2', cy + hourLen * Math.sin(hourRad));
                const minRad = (minuteAngle - 90) * Math.PI / 180;
                hands[1].setAttribute('x2', cx + minLen * Math.cos(minRad));
                hands[1].setAttribute('y2', cy + minLen * Math.sin(minRad));
                // Update triangle indicators
                const tris = group.querySelectorAll('polygon');
                if (tris.length >= 2) {
                    const hx = cx + hourLen * Math.cos(hourRad);
                    const hy = cy + hourLen * Math.sin(hourRad);
                    const hTriSize = 3;
                    tris[0].setAttribute('points', 
                        (hx + hTriSize*Math.cos(hourRad+Math.PI/2)) + ',' + (hy + hTriSize*Math.sin(hourRad+Math.PI/2)) + ' ' +
                        (hx + hTriSize*Math.cos(hourRad-Math.PI/2)) + ',' + (hy + hTriSize*Math.sin(hourRad-Math.PI/2)) + ' ' +
                        (hx + hTriSize*1.8*Math.cos(hourRad)) + ',' + (hy + hTriSize*1.8*Math.sin(hourRad)));
                    const mx = cx + minLen * Math.cos(minRad);
                    const my = cy + minLen * Math.sin(minRad);
                    const mTriSize = 2.5;
                    tris[1].setAttribute('points', 
                        (mx + mTriSize*Math.cos(minRad+Math.PI/2)) + ',' + (my + mTriSize*Math.sin(minRad+Math.PI/2)) + ' ' +
                        (mx + mTriSize*Math.cos(minRad-Math.PI/2)) + ',' + (my + mTriSize*Math.sin(minRad-Math.PI/2)) + ' ' +
                        (mx + mTriSize*1.8*Math.cos(minRad)) + ',' + (my + mTriSize*1.8*Math.sin(minRad)));
                }
            }

            function tickAllClocks() {
                const now = new Date();
                const hours = now.getHours() % 12;
                const minutes = now.getMinutes();
                const hourAngle = (hours + minutes / 60) * 30;
                const minuteAngle = minutes * 6;
                updateClockHands('clock-hands-large', 100, 158, hourAngle, minuteAngle, 8, 12);
                updateClockHands('clock-hands-small', 55, 55, hourAngle, minuteAngle, 7, 11);
                updateClockHands('clock-hands-center', 40, 40, hourAngle, minuteAngle, 6, 10);
                requestAnimationFrame(tickAllClocks);
            }
            requestAnimationFrame(tickAllClocks);

            // ---- 牌背时钟动画 ----
            // ---- 生成背景放射线 ----
            const radialWrap = document.getElementById('radial-lines');
            if (radialWrap) {
                for (let i = 0; i < 24; i++) {
                    const ray = document.createElement('div');
                    ray.className = 'radial-ray';
                    const angle = (i / 24) * 360;
                    const opacity = 0.15 + (i % 3) * 0.08;
                    ray.style.transform = 'rotate(' + angle + 'deg)';
                    ray.style.opacity = opacity;
                    ray.style.height = (120 + (i % 5) * 15) + '%';
                    radialWrap.appendChild(ray);
                }
            }

            // ---- 生成散落星点 ----
            const starField = document.getElementById('star-field');
            if (starField) {
                const starCount = 45;
                for (let i = 0; i < starCount; i++) {
                    const star = document.createElement('div');
                    const size = 1 + Math.random() * 3;
                    star.className = 'magic-dot';
                    star.style.width = size + 'px';
                    star.style.height = size + 'px';
                    star.style.top = (Math.random() * 100) + '%';
                    star.style.left = (Math.random() * 100) + '%';
                    star.style.animationDelay = (Math.random() * 4) + 's';
                    star.style.animationDuration = (2.5 + Math.random() * 4) + 's';
                    star.style.opacity = (0.3 + Math.random() * 0.5);
                    starField.appendChild(star);
                }
            }

            const progressBar = document.getElementById('progress-bar');
            const progressDot = document.getElementById('progress-dot');
            const splashScreen = document.getElementById('splash-screen');
            const appContainer = document.getElementById('app');

            let width = 0;
            const interval = setInterval(() => {
                if (width >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        // 先渲染首页及关联页面内容（#app 仍 opacity:0，用户不可见）
                        switchPage('page-home');
                        renderDeckList();
                        renderSpreadList();
                        updatePositionFields();
                        initDailyFortune();
                        updateQuickDivineSettingsUI();
                        // 内容就绪后再交叉淡入淡出
                        splashScreen.classList.add('opacity-0');
                        appContainer.style.opacity = '1';
                        setTimeout(() => {
                            splashScreen.style.display = 'none';
                        }, 700);
                    }, 300);
                    return;
                }
                width += 2;
                progressBar.style.width = width + '%';
                progressDot.style.left = width + '%';
            }, 30);

            // ---- 占卜页页面进入时初始化 ----
            const pageDivine = document.getElementById('page-divine');
            if (pageDivine) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.target.id === 'page-divine' && mutation.target.classList.contains('active')) {
                            if (!divineState.isDivineActive && divineState.shuffledCards.length === 0) {
                                document.getElementById('reading-area').innerHTML = '<div class="placeholder-text">请先点击设置按钮开始抽牌</div>';
                                document.getElementById('fan-scroll-container').innerHTML = '';
                                document.getElementById('divine-result-footer').style.display = 'none';
                                document.getElementById('divine-config-overlay').style.display = 'none';
                            }
                        }
                    });
                });
                observer.observe(pageDivine, { attributes: true, attributeFilter: ['class'] });
            }

            // ---- 详情页返回顶部 ----
            const backBtn = document.getElementById('back-to-top');
            const detailPage = document.getElementById('page-deck-detail');
            if (detailPage) {
                detailPage.addEventListener('scroll', function() {
                    if (this.scrollTop > 300) {
                        backBtn.classList.add('visible');
                    } else {
                        backBtn.classList.remove('visible');
                    }
                });
            }

            const backBtnSpread = document.getElementById('back-to-top-spread');
            const spreadDetailPage = document.getElementById('page-spread-detail');
            if (spreadDetailPage) {
                spreadDetailPage.addEventListener('scroll', function() {
                    if (this.scrollTop > 300) {
                        backBtnSpread.classList.add('visible');
                    } else {
                        backBtnSpread.classList.remove('visible');
                    }
                });
            }

            // ---- 暴露全局函数 ----
            window.switchPage = switchPage;
            window.openDeckDetail = openDeckDetail;
            window.sortDecks = sortDecks;
            window.deleteDeck = deleteDeck;
            window.sortSpreads = sortSpreads;
            window.deleteSpread = deleteSpread;
            window.openSpreadDetail = openSpreadDetail;
            window.updatePositionFields = updatePositionFields;
            window.confirmCreateSpread = confirmCreateSpread;
            
            window.handleBackImageUpload = handleBackImageUpload;
            window.handleCardFilesUpload = handleCardFilesUpload;
            window.updateCardName = updateCardName;
            window.updateCardComment = updateCardComment;
            window.removeCard = removeCard;
            window.handleDragStart = handleDragStart;
            window.handleDragEnd = handleDragEnd;
            window.handleDragOver = handleDragOver;
            window.handleDragLeave = handleDragLeave;
            window.handleDrop = handleDrop;
            window.confirmCreateDeck = confirmCreateDeck;

            // ---- 今日运势卡片 ----
            const DAILY_FORTUNE_KEY = 'mirror_daily_fortune';
            const DAILY_FORTUNE_INDEX_KEY = 'mirror_daily_fortune_index';
            const DAILY_FORTUNE_DEVICE_SEED_KEY = 'mirror_daily_fortune_device_seed';

            function getTodayKey() {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }

            function getDeviceSeed() {
                let seed = localStorage.getItem(DAILY_FORTUNE_DEVICE_SEED_KEY);
                if (!seed) {
                    seed = String(Math.floor(Math.random() * 100000));
                    localStorage.setItem(DAILY_FORTUNE_DEVICE_SEED_KEY, seed);
                }
                return seed;
            }

            function getDailyFortuneIndex() {
                const today = getTodayKey();
                const saved = localStorage.getItem(DAILY_FORTUNE_KEY);
                if (saved && saved === today) {
                    const idx = parseInt(localStorage.getItem(DAILY_FORTUNE_INDEX_KEY) || '0');
                    if (!isNaN(idx) && idx >= 0 && idx < 64) return idx;
                }
                // 基于日期（不同天不同卦）+ 设备指纹（不同设备不同卦）组合哈希
                const deviceSeed = getDeviceSeed();
                const dateSeed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                const combinedSeed = dateSeed + parseInt(deviceSeed, 10);
                const idx = combinedSeed % 64;
                localStorage.setItem(DAILY_FORTUNE_KEY, today);
                localStorage.setItem(DAILY_FORTUNE_INDEX_KEY, String(idx));
                return idx;
            }

            function generateDailyHexagramSVG(lines, accentColor) {
                const lineLength = 36;
                const gap = 9;
                const yBase = 52;
                let path = '';
                for (let i = 0; i < 6; i++) {
                    const y = yBase - i * gap;
                    const isYang = lines[i] === 1;
                    const x0 = (50 - lineLength / 2);
                    if (isYang) {
                        path += `<line x1="${x0}" y1="${y}" x2="${x0 + lineLength}" y2="${y}" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"/>`;
                    } else {
                        const segLen = lineLength * 0.36;
                        const gapLen = lineLength * 0.28;
                        path += `<line x1="${x0}" y1="${y}" x2="${x0 + segLen}" y2="${y}" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"/>`;
                        path += `<line x1="${x0 + segLen + gapLen}" y1="${y}" x2="${x0 + lineLength}" y2="${y}" stroke="${accentColor}" stroke-width="3" stroke-linecap="round"/>`;
                    }
                }
                return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${path}</svg>`;
            }

            function renderDailyFortune() {
                const card = document.getElementById('daily-fortune-card');
                if (!card) return;
                const idx = getDailyFortuneIndex();
                const hex = ichingData[idx];
                if (!hex) { card.innerHTML = ''; return; }

                const upperElem = hex.upperElement || '土';
                const lowerElem = hex.lowerElement || '土';
                const upperCol = (fiveElementColors[upperElem] || fiveElementColors.土).c1;
                const lowerCol = (fiveElementColors[lowerElem] || fiveElementColors.土).c2;

                const today = getTodayKey();
                const dateStr = `${today.slice(5,7)}月${today.slice(8,10)}日`;

                card.innerHTML = `
                    <div class="daily-fortune-inner">
                        <div class="daily-fortune-accent" style="background:linear-gradient(180deg,${upperCol},${lowerCol})"></div>
                        <div class="daily-fortune-content">
                            <div class="daily-fortune-header">
                                <span class="daily-fortune-title">今日卦运</span>
                                <span class="daily-fortune-date">${dateStr}</span>
                            </div>
                            <div class="daily-fortune-name-row">
                                <span class="daily-fortune-name">${hex.name}</span>
                                <span class="daily-fortune-judgment">${hex.nameEn}</span>
                            </div>
                            <div class="daily-fortune-tags">
                                <span class="daily-fortune-tag" style="background:${upperCol}22; color:${upperCol}">${hex.lowerTrigram}${upperElem}</span>
                                <span class="daily-fortune-tag" style="background:${lowerCol}22; color:${lowerCol}">${hex.upperTrigram}${lowerElem}</span>
                                <span class="daily-fortune-tag theme-tag">第${idx+1}卦</span>
                            </div>
                        </div>
                        <div class="daily-fortune-svg">
                            ${generateDailyHexagramSVG(hex.lines, upperCol)}
                        </div>
                        <div class="daily-fortune-chevron">
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    </div>`;
            }

            function initDailyFortune() {
                renderDailyFortune();
            }

            window.openDailyFortune = function() {
                const idx = getDailyFortuneIndex();
                openDeckDetail('iching');
                // 卡片详情页打开后延迟滚动定位到对应卦
                setTimeout(() => {
                    const grid = document.getElementById('deck-grid');
                    if (grid) {
                        const cards = grid.querySelectorAll('.flip-card-scene,.flip-card-scene-custom');
                        if (cards[idx]) {
                            cards[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // 高亮闪烁
                            cards[idx].style.boxShadow = '0 0 0 3px var(--theme-primary), 0 4px 20px rgba(0,0,0,0.15)';
                            setTimeout(() => { cards[idx].style.boxShadow = ''; }, 2000);
                        }
                    }
                }, 400);
            };

            // ---- 扇形牌组鼠标拖拽滚动 + 拖拽/点击区分 ----
            (function initFanScrollMouseDrag() {
                const container = document.getElementById('fan-scroll-container');
                if (!container) return;
                let startX = null, startScroll = 0, moved = false;

                container.addEventListener('mousedown', (e) => {
                    startX = e.pageX;
                    startScroll = container.scrollLeft;
                    moved = false;
                });

                document.addEventListener('mousemove', (e) => {
                    if (startX === null) return;
                    const dx = e.pageX - startX;
                    if (Math.abs(dx) > 3) {
                        moved = true;
                        container.scrollLeft = startScroll - dx;
                        container.style.cursor = 'grabbing';
                    }
                }, { passive: true });

                document.addEventListener('mouseup', () => {
                    if (startX === null) return;
                    startX = null;
                    container.style.cursor = '';
                });

                // 拖拽后阻止扇牌的 click 事件
                container.addEventListener('click', (e) => {
                    if (moved) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        e.preventDefault();
                    }
                }, true);
            })();

            // ---- 快捷占卜设置（首页随机占卜联动） ----
            function getQuickDivineSettings() {
                const raw = localStorage.getItem('mirror_quick_divine');
                if (raw) { try { return JSON.parse(raw); } catch (e) {} }
                return {
                    deckId: deckListData.length > 0 ? deckListData[0].id : 'iching',
                    spreadId: spreadListData.length > 0 ? spreadListData[0].id : 'single',
                    showReversal: true
                };
            }

            function saveQuickDivineSettings(deckId, spreadId) {
                const current = getQuickDivineSettings();
                localStorage.setItem('mirror_quick_divine', JSON.stringify({
                    deckId, spreadId,
                    showReversal: current.showReversal
                }));
                updateQuickDivineSettingsUI();
            }

            function updateQuickDivineSettingsUI() {
                const settings = getQuickDivineSettings();
                const deck = deckListData.find(d => d.id === settings.deckId);
                const spread = spreadListData.find(s => s.id === settings.spreadId);
                const deckLabel = document.getElementById('qs-deck-label');
                const spreadLabel = document.getElementById('qs-spread-label');
                if (deckLabel) deckLabel.textContent = deck ? deck.name : '未知牌组';
                if (spreadLabel) spreadLabel.textContent = spread ? spread.name : '未知牌阵';
                // 正逆位开关状态
                const revToggle = document.getElementById('qs-reversal-toggle');
                if (revToggle) {
                    if (settings.showReversal !== false) revToggle.classList.add('active');
                    else revToggle.classList.remove('active');
                }
            }

            function toggleQuickReversal() {
                const settings = getQuickDivineSettings();
                settings.showReversal = settings.showReversal === false;
                localStorage.setItem('mirror_quick_divine', JSON.stringify(settings));
                const revToggle = document.getElementById('qs-reversal-toggle');
                if (settings.showReversal !== false) revToggle.classList.add('active');
                else revToggle.classList.remove('active');
            }

            function openQuickDeckPicker() {
                const overlay = document.getElementById('quick-deck-picker-overlay');
                const list = document.getElementById('quick-deck-picker-list');
                const settings = getQuickDivineSettings();
                list.innerHTML = deckListData.map(d => `
                    <div class="quick-picker-item ${d.id === settings.deckId ? 'active' : ''}" onclick="selectQuickDeck('${d.id}')">
                        <div>
                            <div class="qpi-name">${d.name}${d.nameEn ? ' · ' + d.nameEn : ''}</div>
                            <div class="qpi-sub">${d.desc || ''}</div>
                        </div>
                        <div class="qpi-check"><i class="fa-solid fa-check"></i></div>
                    </div>
                `).join('');
                overlay.style.display = 'flex';
            }

            function openQuickSpreadPicker() {
                const overlay = document.getElementById('quick-spread-picker-overlay');
                const list = document.getElementById('quick-spread-picker-list');
                const settings = getQuickDivineSettings();
                list.innerHTML = spreadListData.map(s => `
                    <div class="quick-picker-item ${s.id === settings.spreadId ? 'active' : ''}" onclick="selectQuickSpread('${s.id}')">
                        <div>
                            <div class="qpi-name">${s.name}${s.nameEn ? ' · ' + s.nameEn : ''}</div>
                            <div class="qpi-sub">${s.cardCount}张牌 · ${s.positions.join(' · ')}</div>
                        </div>
                        <div class="qpi-check"><i class="fa-solid fa-check"></i></div>
                    </div>
                `).join('');
                overlay.style.display = 'flex';
            }

            function selectQuickDeck(deckId) {
                const settings = getQuickDivineSettings();
                saveQuickDivineSettings(deckId, settings.spreadId);
                closeQuickPicker();
            }

            function selectQuickSpread(spreadId) {
                const settings = getQuickDivineSettings();
                saveQuickDivineSettings(settings.deckId, spreadId);
                closeQuickPicker();
            }

            function closeQuickPicker() {
                document.getElementById('quick-deck-picker-overlay').style.display = 'none';
                document.getElementById('quick-spread-picker-overlay').style.display = 'none';
            }

            function randomDivination() {
                const settings = getQuickDivineSettings();
                const deck = deckListData.find(d => d.id === settings.deckId);
                const spread = spreadListData.find(s => s.id === settings.spreadId);
                if (!deck) { alert('请先在设置中选择牌组'); return; }
                if (!spread) { alert('请先在设置中选择牌阵'); return; }

                const allCards = getDeckCards(deck.id);
                const shuffled = fisherYatesShuffle([...allCards]);
                const count = Math.min(spread.cardCount, shuffled.length);
                const showReversal = settings.showReversal !== false;
                const drawnCards = shuffled.slice(0, count).map(card => ({
                    ...card,
                    isReversed: showReversal ? Math.random() < 0.5 : false
                }));

                document.getElementById('rd-deck-name').textContent = deck.name;
                document.getElementById('rd-spread-name').textContent = spread.name + ' · ' + count + '张牌';

                const container = document.getElementById('rd-cards-container');
                let layoutClass = 'layout-multi';
                if (count === 1) layoutClass = 'layout-single';
                else if (count === 3 && spread.id === 'three') layoutClass = 'layout-three';
                else if (count === 10 && spread.id === 'celtic') layoutClass = 'layout-celtic';
                container.className = 'rd-cards-container ' + layoutClass;

                container.innerHTML = drawnCards.map((card, idx) => {
                    const isIch = deck.id === 'iching';
                    const isLen = deck.id === 'lenormand';
                    let cardFaceHtml = '';
                    if (card.imageData) {
                        cardFaceHtml = `<img class="rd-card-img" src="${card.imageData}" alt="${card.name || ''}">`;
                    } else if (isIch) {
                        ensureIChingDeckCache();
                        const cacheThumb = document.getElementById('iching-card-cache').querySelector('.card-thumb[data-card-id="' + card.cardIndex + '"]');
                        if (cacheThumb) {
                            // 用占位 div 标记，稍后用 cloneNode(true) 替换，保留 SVG xmlns 命名空间
                            cardFaceHtml = '<div class="rd-iching-clone-target" data-iching-id="' + card.cardIndex + '"></div>';
                        } else {
                            // 兜底：缓存未就绪时退回旧逻辑
                            const faceHTML = buildIChingCardFaceHTML(card, card.cardIndex);
                            const bgGradient = getCardGradient(false, null, 'iching', card.cardIndex);
                            cardFaceHtml = '<div class="card-thumb" style="background:' + bgGradient + ';">' + faceHTML + '</div>';
                        }
                    } else if (isLen) {
                        const gradient = getCardGradientByType(card);
                        cardFaceHtml = `<div class="rd-card-img" style="background:${gradient};display:flex;align-items:center;justify-content:center;aspect-ratio:2/3;min-width:80px;">${getCardSVGForCard(card)}</div>`;
                    } else {
                        const bgGrad = typeof getCardGradient === 'function'
                            ? getCardGradient(card.isMajor, card.suitName, card._deckType, card.cardIndex)
                            : getCardGradientByType(card);
                        cardFaceHtml = `<div class="rd-card-img" style="background:${bgGrad};display:flex;align-items:center;justify-content:center;aspect-ratio:2/3;min-width:80px;">${getCardSVGForCard(card)}</div>`;
                    }
                    const posLabel = spread.positions[idx] || '';
                    const cardName = isIch ? '' : (card.name || '');
                    const reversedLabel = (showReversal && card.isReversed) ? '逆位' : '正位';
                    const reversedClass = (showReversal && card.isReversed) ? 'reversed-yes' : 'reversed-no';
                    return `<div class="rd-card">
                        ${cardFaceHtml}
                        <div class="rd-card-info">
                            ${cardName ? `<span>${cardName}</span>` : ''}
                            ${posLabel ? `<span class="rd-card-pos-label">${posLabel}</span>` : ''}
                            <span class="rd-card-reversed ${reversedClass}">${reversedLabel}</span>
                        </div>
                    </div>`;
                }).join('');

                // 周易牌面：用 cloneNode(true) 替换占位 div，保留 SVG xmlns 命名空间
                container.querySelectorAll('.rd-iching-clone-target').forEach(target => {
                    const cacheThumb = document.getElementById('iching-card-cache').querySelector('.card-thumb[data-card-id="' + target.dataset.ichingId + '"]');
                    if (cacheThumb) {
                        target.replaceWith(cacheThumb.cloneNode(true));
                    }
                });

                document.getElementById('random-divine-overlay').style.display = 'flex';

                // 保存占卜记录
                saveDivineRecord(deck, spread, drawnCards, showReversal, 'random');
            }

            function reshuffleRandomDivine() { randomDivination(); }

            function closeRandomDivine() { document.getElementById('random-divine-overlay').style.display = 'none'; }

            // ======== 关于弹窗 ==========
            function openAboutModal() { document.getElementById('about-overlay').style.display = 'flex'; }
            function closeAboutModal() { document.getElementById('about-overlay').style.display = 'none'; }

            // ======== 占卜记录管理 ==========
            function getDivineRecords() {
                try { return JSON.parse(localStorage.getItem(DIVINE_RECORDS_KEY) || '[]'); }
                catch(e) { return []; }
            }

            function saveDivineRecords(records) {
                try { localStorage.setItem(DIVINE_RECORDS_KEY, JSON.stringify(records)); }
                catch(e) { console.error('[占卜记录] 写入 localStorage 失败：', e); }
            }

            function saveDivineRecord(deck, spread, drawnCards, showReversal, source, question) {
                try {
                source = source || 'random';
                var records = getDivineRecords();
                var cards = drawnCards.map(function(c, i) {
                    var pos = spread.positions && i < spread.positions.length ? spread.positions[i] : ('位' + (i+1));
                    var isIChing = deck.isIChing;
                    var isCustomDeck = deck.id && deck.id.indexOf('custom_') === 0;
                    var cardEntry = {
                        name: isIChing ? (c.name || '') : (c.name || ''),
                        isReversed: showReversal !== false && !isIChing ? (c.isReversed || false) : false,
                        position: pos,
                        cardIndex: c.cardIndex !== undefined ? c.cardIndex : i,
                        gradient: getCardGradientByType(c),
                        svgContent: c.svgContent || null,
                        imageData: null,
                        isIChing: isIChing
                    };
                    if (isCustomDeck) {
                        // 自定义牌不存储完整 imageData（base64 过大导致 localStorage 超限），改用引用
                        cardEntry._customDeckId = deck.id;
                        cardEntry.imageData = null;
                    } else {
                        cardEntry.imageData = c.imageData || null;
                    }
                    return cardEntry;
                });
                var now = new Date();
                var record = {
                    id: now.getTime(),
                    dateTime: now.toISOString(),
                    dateStr: now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate(),
                    deckId: deck.id,
                    deckName: deck.name,
                    spreadId: spread.id,
                    spreadName: spread.name,
                    source: source,
                    question: (typeof question === 'string' ? question.trim() : ''),
                    cards: cards
                };
                records.unshift(record);
                if (records.length > MAX_RECORDS) records = records.slice(0, MAX_RECORDS);
                saveDivineRecords(records);
                renderRecentRecords();
                } catch(e) {
                    console.error('[占卜记录] saveDivineRecord 异常：', e, 'deck:', deck, 'spread:', spread);
                }
            }

            // 占卜问题展示辅助（无题时优雅降级，直接返回空串不渲染问题行）
            function buildRecordQuestionHtml(r) {
                var q = (r.question || '').trim();
                if (!q) return '';
                return '<div class="divine-record-question"><i class="fa-solid fa-user-pen text-[10px]"></i><span>' + escapeHtml(q) + '</span></div>';
            }

            function buildRecordCardsPreview(r) {
                return r.cards.map(function(c) {
                    var cls = 'divine-record-card-mini';
                    if (c.isReversed) cls += ' reversed';
                    var inner = '';
                    var customImgData = null;
                    // 自定义牌：从 deckListData 重建 imageData（避免 localStorage 超限）
                    if (c._customDeckId) {
                        var cDeck = deckListData.find(function(d) { return d.id === c._customDeckId; });
                        if (cDeck && cDeck.cards && cDeck.cards[c.cardIndex]) {
                            customImgData = cDeck.cards[c.cardIndex].imageData;
                        }
                    }
                    var displayImg = customImgData || c.imageData;
                    if (c.svgContent) {
                        inner = c.svgContent;
                    } else if (displayImg) {
                        inner = '<img src="' + escapeHtml(displayImg) + '" alt="">';
                    } else {
                        inner = escapeHtml((c.name || '').substring(0,2));
                    }
                    return '<div class="' + cls + '" style="' + (c.svgContent ? '' : 'background:' + (c.gradient || 'var(--theme-primary)') + ';') + '">' + inner + '</div>';
                }).join('');
            }

            function renderRecentRecords() {
                var records = getDivineRecords();
                var listEl = document.getElementById('recent-records-list');
                var moreBtn = document.getElementById('recent-records-more');
                if (!listEl) return;
                var recent = records.slice(0, 2);
                if (recent.length === 0) {
                    listEl.innerHTML = '<div class="text-center py-6 text-light-text text-xs">暂无占卜记录</div>';
                    if (moreBtn) moreBtn.style.display = 'none';
                    return;
                }
                if (moreBtn) moreBtn.style.display = records.length > 0 ? '' : 'none';
                listEl.innerHTML = recent.map(function(r) {
                    var sourceLabel = r.source === 'free' ? '自由抽取' : '随机占卜';
                    var sourceCls = r.source === 'free' ? 'divine-record-source-free' : 'divine-record-source-random';
                    return '<div class="divine-record-item" onclick="openDivineHistory()">\
                        <div class="divine-record-header">\
                            <span class="divine-record-date">' + r.dateStr + '</span>\
                            <span class="divine-record-source-badge ' + sourceCls + '">' + sourceLabel + '</span>\
                            <span class="divine-record-meta">' + escapeHtml(r.deckName) + ' · ' + escapeHtml(r.spreadName) + '</span>\
                        </div>\
                        ' + buildRecordQuestionHtml(r) + '\
                        ' + (r.cards && r.cards.length ? '<div class="divine-record-cards-preview recent">' + buildRecordCardsPreview(r) + '</div>' : '') + '\
                    </div>';
                }).join('');
            }

            function renderFullHistory() {
                var records = getDivineRecords();
                var listEl = document.getElementById('divine-history-list');
                var countEl = document.getElementById('history-count-label');
                if (!listEl) return;
                if (countEl) countEl.textContent = records.length + ' 条记录';
                if (records.length === 0) {
                    listEl.innerHTML = '<div class="text-center py-12 text-light-text text-sm">暂无占卜记录</div>';
                    return;
                }
                listEl.innerHTML = records.map(function(r) {
                    var sourceLabel = r.source === 'free' ? '自由抽取' : '随机占卜';
                    var sourceCls = r.source === 'free' ? 'divine-record-source-free' : 'divine-record-source-random';
                    var cardsHtml = buildRecordCardsPreview(r);
                    var posHtml = r.cards.map(function(c) {
                        return '<span class="text-[10px] px-1.5 py-0.5 rounded-full" style="background:rgba(var(--theme-primary-rgb),0.1);color:var(--theme-primary);margin-right:4px;margin-bottom:4px;display:inline-block;">' + escapeHtml(c.position) + ': ' + escapeHtml(c.name) + (c.isReversed ? ' (逆)' : '') + '</span>';
                    }).join('');
                    return '<div class="divine-record-item" style="position:relative;">\
                        <button onclick="event.stopPropagation();window._deleteDivineRecord(' + r.id + ')" class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-light-text/50 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除记录"><i class="fa-solid fa-trash-can text-xs"></i></button>\
                        <div class="divine-record-header" style="padding-right:32px;">\
                            <span class="divine-record-date"><i class="fa-solid fa-calendar-day text-[10px] mr-1"></i>' + r.dateStr + '</span>\
                            <span class="divine-record-source-badge ' + sourceCls + '">' + sourceLabel + '</span>\
                            <span class="divine-record-meta">' + escapeHtml(r.deckName) + ' · ' + escapeHtml(r.spreadName) + '</span>\
                        </div>\
                        ' + buildRecordQuestionHtml(r) + '\
                        <div class="divine-record-cards-preview mb-3">' + cardsHtml + '</div>\
                        <div class="flex flex-wrap">' + posHtml + '</div>\
                    </div>';
                }).join('');
            }

            function deleteDivineRecord(id) {
                if (!confirm('确定要删除这条占卜记录吗？')) return;
                var records = getDivineRecords();
                records = records.filter(function(r) { return r.id !== id; });
                saveDivineRecords(records);
                renderFullHistory();
                renderRecentRecords();
            }

            function openDivineHistory() {
                renderFullHistory();
                switchPage('page-divine-history');
            }

            function closeDivineHistory() {
                renderRecentRecords();
                switchPage('page-home');
            }

            // ---- 占卜功能全局暴露 ----
            window.openDivineConfig = openDivineConfig;
            window.closeDivineConfig = closeDivineConfig;
            window.toggleReversed = toggleReversed;
            window.onDrawModeChange = onDrawModeChange;
            window.onSpreadChange = onSpreadChange;
            window.startDivine = startDivine;
            window.pickFanCard = pickFanCard;
            window.revealAllCards = revealAllCards;
            window.reshuffleDeck = reshuffleDeck;
            window.resetDivine = resetDivine;
            window.onDivineBack = onDivineBack;
            // 快捷占卜 - 全局暴露
            window.openQuickDeckPicker = openQuickDeckPicker;
            window.openQuickSpreadPicker = openQuickSpreadPicker;
            window.selectQuickDeck = selectQuickDeck;
            window.selectQuickSpread = selectQuickSpread;
            window.closeQuickPicker = closeQuickPicker;
            window.randomDivination = randomDivination;
            window.reshuffleRandomDivine = reshuffleRandomDivine;
            window.closeRandomDivine = closeRandomDivine;
            window.openDivineHistory = openDivineHistory;
            window.closeDivineHistory = closeDivineHistory;
            window._saveDivineRecord = saveDivineRecord;
            window.renderRecentRecords = renderRecentRecords;
            window.renderFullHistory = renderFullHistory;
            window._deleteDivineRecord = deleteDivineRecord;
            window.toggleQuickReversal = toggleQuickReversal;
            window.updateQuickDivineSettingsUI = updateQuickDivineSettingsUI;

            // ======== 数据管理：存储空间 / 导出 / 导入 ==========

            // ---------- 存储空间计算 ----------
            function calcStorageUsed() {
                var total = 0;
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (!key) continue;
                    total += key.length * 2;
                    var val = localStorage.getItem(key);
                    if (val) total += val.length * 2;
                }
                return total;
            }

            function formatStorageSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / 1048576).toFixed(1) + ' MB';
            }

            async function updateStorageUsage() {
                var used = calcStorageUsed();
                // 估算 IndexedDB 中数据大小
                try {
                    var idbUsed = await estimateIDBUsage();
                    used += idbUsed;
                } catch (e) {}
                var textEl = document.getElementById('storage-usage-text');
                var barEl = document.getElementById('storage-usage-bar');
                if (textEl) textEl.textContent = '已使用 ' + formatStorageSize(used);
                if (barEl) {
                    var pct = Math.min(Math.round(used / (5 * 1024 * 1024) * 100), 100); // 以 5MB 为参考上限
                    barEl.style.width = Math.max(pct, 1) + '%';
                }
            }

            async function estimateIDBUsage() {
                var total = 0;
                // mirror_world_db
                try {
                    var db1 = await idbOpen('mirror_world_db', 1);
                    var tx1 = db1.transaction('custom_data', 'readonly');
                    var decks = await idbPromise(tx1.objectStore('custom_data').get('decks'));
                    var spreads = await idbPromise(tx1.objectStore('custom_data').get('spreads'));
                    db1.close();
                    if (decks) total += JSON.stringify(decks).length * 2;
                    if (spreads) total += JSON.stringify(spreads).length * 2;
                } catch (e) {}
                // mirror_manuals_db
                try {
                    var db2 = await idbOpen('mirror_manuals_db', 1);
                    var tx2 = db2.transaction('files', 'readonly');
                    var allKeys = await idbPromise(tx2.objectStore('files').getAllKeys());
                    for (var k = 0; k < allKeys.length; k++) {
                        var record = await idbPromise(tx2.objectStore('files').get(allKeys[k]));
                        if (record) {
                            if (record.data) total += (typeof record.data === 'string' ? record.data.length : JSON.stringify(record.data).length) * 2;
                            if (record.searchText) total += record.searchText.length * 2;
                        }
                    }
                    db2.close();
                } catch (e) {}
                return total;
            }

            function idbOpen(name, version) {
                return new Promise(function(resolve, reject) {
                    var req = indexedDB.open(name, version);
                    req.onupgradeneeded = function(e) {
                        var db = e.target.result;
                        if (name === 'mirror_world_db' && !db.objectStoreNames.contains('custom_data')) {
                            db.createObjectStore('custom_data', { keyPath: 'id' });
                        }
                        if (name === 'mirror_manuals_db' && !db.objectStoreNames.contains('files')) {
                            db.createObjectStore('files', { keyPath: 'id' });
                        }
                    };
                    req.onsuccess = function(e) { resolve(e.target.result); };
                    req.onerror = function(e) { reject(e.target.error); };
                });
            }

            function idbPromise(request) {
                return new Promise(function(resolve, reject) {
                    request.onsuccess = function(e) { resolve(e.target.result); };
                    request.onerror = function(e) { reject(e.target.error); };
                });
            }

            // ---------- 导出数据 ----------
            async function exportMirrorData() {
                try {
                    var exportData = {};

                    // 1. 自定义牌组 & 牌阵 (IndexedDB: mirror_world_db)
                    try {
                        var db1 = await idbOpen('mirror_world_db', 1);
                        var tx1 = db1.transaction('custom_data', 'readonly');
                        var decks = await idbPromise(tx1.objectStore('custom_data').get('decks'));
                        var spreads = await idbPromise(tx1.objectStore('custom_data').get('spreads'));
                        db1.close();
                        exportData.customDecks = decks ? decks.data || decks : [];
                        exportData.customSpreads = spreads ? spreads.data || spreads : [];
                        // 修复：如果 decks.data 存在，取 .data
                        if (decks && decks.data !== undefined) exportData.customDecks = decks.data;
                        if (spreads && spreads.data !== undefined) exportData.customSpreads = spreads.data;
                    } catch (e) {
                        console.warn('导出牌组失败:', e);
                        exportData.customDecks = [];
                        exportData.customSpreads = [];
                    }

                    // 2. 占卜记录 (localStorage)
                    try {
                        exportData.divineRecords = JSON.parse(localStorage.getItem(DIVINE_RECORDS_KEY) || '[]');
                    } catch (e) {
                        exportData.divineRecords = [];
                    }

                    // 3. 牌意文件 (localStorage 元数据 + IndexedDB mirror_manuals_db 内容)
                    exportData.manuals = [];
                    try {
                        var manualsMeta = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || '[]');
                        var db2 = await idbOpen('mirror_manuals_db', 1);
                        for (var m = 0; m < manualsMeta.length; m++) {
                            var meta = manualsMeta[m];
                            var id = meta.id;
                            var contentRecord = null;
                            try {
                                var tx2 = db2.transaction('files', 'readonly');
                                contentRecord = await idbPromise(tx2.objectStore('files').get(id));
                            } catch (e) {}
                            exportData.manuals.push({
                                id: id,
                                name: meta.name,
                                type: meta.type,
                                size: meta.size,
                                fileType: meta.fileType,
                                uploadTime: meta.uploadTime,
                                data: contentRecord ? contentRecord.data : null,
                                searchText: contentRecord ? contentRecord.searchText : ''
                            });
                        }
                        db2.close();
                    } catch (e) {
                        console.warn('导出牌意文件失败:', e);
                    }

                    // 构建 JSON 并下载
                    var jsonStr = JSON.stringify(exportData, null, 2);
                    var now = new Date();
                    var dateStr = now.getFullYear() + '-' +
                        String(now.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now.getDate()).padStart(2, '0');
                    var filename = '镜界数据备份_' + dateStr + '.json';

                    var blob = new Blob([jsonStr], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    updateStorageUsage();
                    alert('数据已导出为 ' + filename + '\n\n包含：\n- 自定义牌组：' + exportData.customDecks.length + ' 个\n- 自定义牌阵：' + exportData.customSpreads.length + ' 个\n- 占卜记录：' + exportData.divineRecords.length + ' 条\n- 牌意文件：' + exportData.manuals.length + ' 个');
                } catch (e) {
                    console.error('导出失败:', e);
                    alert('导出失败: ' + e.message);
                }
            }

            // ---------- 导入数据 ----------
            async function importMirrorData(event) {
                var file = event.target.files[0];
                if (!file) return;

                // 重置 input 以便重复选择同一文件
                event.target.value = '';

                var reader = new FileReader();
                reader.onload = async function(e) {
                    try {
                        var importData = JSON.parse(e.target.result);

                        // 验证 JSON 格式
                        if (!importData || typeof importData !== 'object') {
                            throw new Error('JSON 格式无效');
                        }
                        if (!importData.customDecks && !importData.customSpreads && !importData.divineRecords && !importData.manuals) {
                            throw new Error('未找到可识别数据（customDecks / customSpreads / divineRecords / manuals）');
                        }

                        // 统计将要导入的数据量
                        var deckCount = (importData.customDecks || []).length;
                        var spreadCount = (importData.customSpreads || []).length;
                        var recordCount = (importData.divineRecords || []).length;
                        var manualCount = (importData.manuals || []).length;
                        var total = deckCount + spreadCount + recordCount + manualCount;

                        if (total === 0) {
                            alert('备份文件为空，没有数据需要导入。');
                            return;
                        }

                        var confirmMsg = '即将导入以下数据：\n\n' +
                            '- 自定义牌组：' + deckCount + ' 个\n' +
                            '- 自定义牌阵：' + spreadCount + ' 个\n' +
                            '- 占卜记录：' + recordCount + ' 条\n' +
                            '- 牌意文件：' + manualCount + ' 个\n\n' +
                            '注意：新数据将与现有数据合并，不会覆盖已有数据。\n\n是否继续？';

                        if (!confirm(confirmMsg)) return;

                        // 恢复自定义牌组
                        if (importData.customDecks && importData.customDecks.length > 0) {
                            try {
                                var db1 = await idbOpen('mirror_world_db', 1);
                                var tx1r = db1.transaction('custom_data', 'readonly');
                                var existingDecks = await idbPromise(tx1r.objectStore('custom_data').get('decks'));
                                var existingSpreads = await idbPromise(tx1r.objectStore('custom_data').get('spreads'));
                                db1.close();

                                var curDecks = (existingDecks && existingDecks.data) ? existingDecks.data : (existingDecks || []);
                                var curSpreads = (existingSpreads && existingSpreads.data) ? existingSpreads.data : (existingSpreads || []);

                                // 去重合并
                                var existingDeckIds = new Set(curDecks.map(function(d) { return d.id; }));
                                var newDecks = importData.customDecks.filter(function(d) { return !existingDeckIds.has(d.id); });
                                curDecks = curDecks.concat(newDecks);

                                var existingSpreadIds = new Set(curSpreads.map(function(s) { return s.id; }));
                                var newSpreads = (importData.customSpreads || []).filter(function(s) { return !existingSpreadIds.has(s.id); });
                                curSpreads = curSpreads.concat(newSpreads);

                                var db1w = await idbOpen('mirror_world_db', 1);
                                var tx1w = db1w.transaction('custom_data', 'readwrite');
                                tx1w.objectStore('custom_data').put({ id: 'decks', data: curDecks });
                                tx1w.objectStore('custom_data').put({ id: 'spreads', data: curSpreads });
                                await new Promise(function(resolve, reject) {
                                    tx1w.oncomplete = resolve;
                                    tx1w.onerror = reject;
                                });
                                db1w.close();

                                // 同步到内存变量
                                window._addedDecks = newDecks;
                                window._addedSpreads = newSpreads;
                            } catch (e) {
                                console.error('导入牌组失败:', e);
                            }
                        }

                        // 恢复占卜记录
                        if (importData.divineRecords && importData.divineRecords.length > 0) {
                            try {
                                var existingRecords = getDivineRecords();
                                var existingIds = new Set(existingRecords.map(function(r) { return r.id; }));
                                var newRecords = importData.divineRecords.filter(function(r) { return !existingIds.has(r.id); });
                                var merged = existingRecords.concat(newRecords);
                                merged.sort(function(a, b) { return b.id - a.id; });
                                if (merged.length > MAX_RECORDS) merged = merged.slice(0, MAX_RECORDS);
                                saveDivineRecords(merged);
                            } catch (e) {
                                console.error('导入占卜记录失败:', e);
                            }
                        }

                        // 恢复牌意文件
                        if (importData.manuals && importData.manuals.length > 0) {
                            try {
                                var existingManuals = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || '[]');
                                var existingManualIds = new Set(existingManuals.map(function(m) { return m.id; }));
                                var newManuals = importData.manuals.filter(function(m) { return !existingManualIds.has(m.id); });

                                var db2 = await idbOpen('mirror_manuals_db', 1);
                                for (var n = 0; n < newManuals.length; n++) {
                                    var mItem = newManuals[n];
                                    var tx2w = db2.transaction('files', 'readwrite');
                                    tx2w.objectStore('files').put({
                                        id: mItem.id,
                                        data: mItem.data || '',
                                        searchText: mItem.searchText || ''
                                    });
                                    await new Promise(function(resolve, reject) {
                                        tx2w.oncomplete = resolve;
                                        tx2w.onerror = reject;
                                    });
                                    existingManuals.push({
                                        id: mItem.id,
                                        name: mItem.name,
                                        type: mItem.type,
                                        size: mItem.size,
                                        fileType: mItem.fileType,
                                        uploadTime: mItem.uploadTime
                                    });
                                }
                                db2.close();
                                localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(existingManuals));
                            } catch (e) {
                                console.error('导入牌意文件失败:', e);
                            }
                        }

                        updateStorageUsage();

                        // 刷新 UI 提示
                        var msgParts = [];
                        var dAdded = window._addedDecks ? window._addedDecks.length : 0;
                        var sAdded = window._addedSpreads ? window._addedSpreads.length : 0;
                        var rAdded = importData.divineRecords ? importData.divineRecords.filter(function(r) {
                            var existing = getDivineRecords();
                            return !existing.some(function(e) { return e.id === r.id; });
                        }).length : 0;
                        var mAdded = (importData.manuals || []).length;

                        if (dAdded > 0) msgParts.push('牌组 +' + dAdded);
                        if (sAdded > 0) msgParts.push('牌阵 +' + sAdded);
                        if (rAdded > 0) msgParts.push('占卜记录 +' + rAdded);
                        if (mAdded > 0) msgParts.push('牌意文件 +' + mAdded);

                        var finalMsg = '导入完成！\n\n新增数据：\n' + (msgParts.length > 0 ? msgParts.join('\n') : '（所有数据已存在，无新增）') +
                            '\n\n请刷新页面以加载最新数据。';

                        if (confirm(finalMsg + '\n\n是否立即刷新？')) {
                            location.reload();
                        }
                        delete window._addedDecks;
                        delete window._addedSpreads;
                    } catch (e) {
                        console.error('导入失败:', e);
                        alert('导入失败：' + e.message + '\n请确认文件为有效的镜界数据备份 JSON。');
                    }
                };
                reader.readAsText(file);
            }

            // 注册到 window
            window.updateStorageUsage = updateStorageUsage;
            window.exportMirrorData = exportMirrorData;
            window.importMirrorData = importMirrorData;
            window.openAboutModal = openAboutModal;
            window.closeAboutModal = closeAboutModal;

            // ---- 牌意功能（IndexedDB 存储 + 原样预览） ----
            const MANUAL_STORAGE_KEY = 'mirror_manuals';
            const MAX_FILE_SIZE = 50 * 1024 * 1024;
            const MAX_CONTENT_LENGTH = 500000;
            const DB_NAME = 'mirror_manuals_db';
            const DB_VERSION = 1;
            const DB_STORE = 'files';
            let currentManualId = null;

            // ---- IndexedDB 操作 ----
            function openDB() {
                return new Promise(function(resolve, reject) {
                    var req = indexedDB.open(DB_NAME, DB_VERSION);
                    req.onupgradeneeded = function(e) {
                        var db = e.target.result;
                        if (!db.objectStoreNames.contains(DB_STORE)) {
                            db.createObjectStore(DB_STORE, { keyPath: 'id' });
                        }
                    };
                    req.onsuccess = function(e) { resolve(e.target.result); };
                    req.onerror = function(e) { reject(e.target.error); };
                });
            }
            function idbPut(id, data, searchText) {
                return openDB().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var tx = db.transaction(DB_STORE, 'readwrite');
                        tx.objectStore(DB_STORE).put({ id: id, data: data, searchText: searchText || '' });
                        tx.oncomplete = function() { db.close(); resolve(); };
                        tx.onerror = function() { db.close(); reject(tx.error); };
                    });
                });
            }
            function idbGet(id) {
                return openDB().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var tx = db.transaction(DB_STORE, 'readonly');
                        var req = tx.objectStore(DB_STORE).get(id);
                        req.onsuccess = function() { db.close(); resolve(req.result); };
                        req.onerror = function() { db.close(); reject(req.error); };
                    });
                });
            }
            function idbDelete(id) {
                return openDB().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var tx = db.transaction(DB_STORE, 'readwrite');
                        tx.objectStore(DB_STORE).delete(id);
                        tx.oncomplete = function() { db.close(); resolve(); };
                        tx.onerror = function() { db.close(); reject(tx.error); };
                    });
                });
            }
            // 元数据持久化到 IndexedDB（localStorage 兜底）
            function idbPutMeta(metaJson) {
                return openDB().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var tx = db.transaction(DB_STORE, 'readwrite');
                        tx.objectStore(DB_STORE).put({ id: '__meta__', data: null, searchText: metaJson });
                        tx.oncomplete = function() { db.close(); resolve(); };
                        tx.onerror = function() { db.close(); reject(tx.error); };
                    });
                });
            }
            function idbGetMeta() {
                return openDB().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var tx = db.transaction(DB_STORE, 'readonly');
                        var req = tx.objectStore(DB_STORE).get('__meta__');
                        req.onsuccess = function() { db.close(); resolve(req.result ? req.result.searchText : null); };
                        req.onerror = function() { db.close(); reject(req.error); };
                    });
                });
            }
            function idbSearch(query) {
                return openDB().then(function(db) {
                    return new Promise(function(resolve) {
                        var tx = db.transaction(DB_STORE, 'readonly');
                        var store = tx.objectStore(DB_STORE);
                        var results = [];
                        var lowerQuery = query.toLowerCase();
                        store.openCursor().onsuccess = function(e) {
                            var cursor = e.target.result;
                            if (cursor) {
                                var st = (cursor.value.searchText || '').toLowerCase();
                                if (st.indexOf(lowerQuery) !== -1) {
                                    results.push({ id: cursor.value.id, searchText: cursor.value.searchText });
                                }
                                cursor.continue();
                            } else {
                                db.close();
                                resolve(results);
                            }
                        };
                    });
                });
            }

            // ---- 元数据（localStorage） ----
            function getManuals() {
                try { return JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || '[]'); }
                catch(e) { return []; }
            }
            function saveManuals(manuals) {
                var json = JSON.stringify(manuals);
                try { localStorage.setItem(MANUAL_STORAGE_KEY, json); }
                catch(e) {
                    if (e.name === 'QuotaExceededError') {
                        showUploadToast('存储空间不足，请删除部分牌意后重试', true);
                    }
                }
                // 同步元数据到 IndexedDB，防止 localStorage 被清理
                idbPutMeta(json).catch(function() {});
            }

            // ---- Toast & 进度条 ----
            function showUploadToast(msg, isError) {
                const existing = document.querySelector('.manual-upload-toast');
                if (existing) existing.remove();
                const toast = document.createElement('div');
                toast.className = 'manual-upload-toast';
                toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:300;padding:10px 24px;border-radius:999px;font-size:13px;pointer-events:none;white-space:nowrap;';
                toast.style.background = isError ? 'rgba(239,68,68,0.9)' : 'rgba(var(--theme-primary-rgb),0.9)';
                toast.style.color = '#fff';
                toast.style.backdropFilter = 'blur(8px)';
                toast.textContent = msg;
                document.body.appendChild(toast);
                setTimeout(function() { if (toast.parentNode) toast.remove(); }, 2500);
            }
            function showUploadProgress(show) {
                var bar = document.getElementById('manual-upload-progress');
                if (bar) { bar.style.display = show ? 'block' : 'none'; }
            }
            function updateUploadProgress(status, percent) {
                var s = document.getElementById('manual-upload-status');
                var p = document.getElementById('manual-upload-percent');
                var b = document.getElementById('manual-upload-bar');
                if (s) s.textContent = status;
                if (p) p.textContent = percent;
                if (b) b.style.width = percent + '%';
            }

            // ---- 文件处理入口 ----
            function handleManualDrop(event) {
                var files = event.dataTransfer.files;
                if (!files || files.length === 0) return;
                processManualFiles(files);
            }
            function handleManualUpload(event) {
                var files = event.target.files;
                if (!files || files.length === 0) { event.target.value = ''; return; }
                processManualFiles(files);
                event.target.value = '';
            }

            // ---- 提取搜索文本 ----
            function extractSearchText(buffer, type) {
                if (type === 'txt') {
                    var decoder = new TextDecoder('utf-8');
                    return Promise.resolve(decoder.decode(buffer).substring(0, MAX_CONTENT_LENGTH));
                }
                if (type === 'docx') {
                    return new Promise(function(resolve) {
                        if (typeof JSZip === 'undefined') { resolve(''); return; }
                        JSZip.loadAsync(buffer).then(function(zip) {
                            var docXml = zip.file('word/document.xml');
                            if (docXml) {
                                return docXml.async('string').then(function(xml) {
                                    var parser = new DOMParser();
                                    var doc = parser.parseFromString(xml, 'text/xml');
                                    var texts = doc.querySelectorAll('w\\:t, t');
                                    var content = Array.from(texts).map(function(n) { return n.textContent; }).join('');
                                    resolve(content.substring(0, MAX_CONTENT_LENGTH));
                                });
                            }
                            resolve('');
                        }).catch(function() { resolve(''); });
                    });
                }
                if (type === 'pdf') {
                    return new Promise(function(resolve) {
                        if (typeof pdfjsLib === 'undefined') { resolve(''); return; }
                        var typedarray = new Uint8Array(buffer);
                        var timeoutId = setTimeout(function() { resolve(''); }, 30000);
                        pdfjsLib.getDocument({ data: typedarray }).promise.then(function(pdf) {
                            var pagePromises = [];
                            var maxPages = Math.min(pdf.numPages, 100);
                            for (var i = 1; i <= maxPages; i++) {
                                pagePromises.push(pdf.getPage(i).then(function(page) {
                                    return page.getTextContent().then(function(textContent) {
                                        return textContent.items.map(function(item) { return item.str; }).join(' ');
                                    });
                                }));
                            }
                            return Promise.all(pagePromises);
                        }).then(function(pageTexts) {
                            clearTimeout(timeoutId);
                            resolve(pageTexts.join('\n').substring(0, MAX_CONTENT_LENGTH));
                        }).catch(function() {
                            clearTimeout(timeoutId);
                            resolve('');
                        });
                    });
                }
                return Promise.resolve('');
            }

            // 延迟后台提取搜索文本并写入 IndexedDB
            function deferredExtractSearchText(id, buffer, type) {
                extractSearchText(buffer, type).then(function(searchText) {
                    if (searchText) {
                        idbGet(id).then(function(record) {
                            if (record) {
                                return idbPut(id, record.data, searchText);
                            }
                        }).catch(function() {});
                    }
                }).catch(function() {});
            }

            function processManualFiles(files) {
                var manuals = getManuals();
                var validFiles = [];
                Array.from(files).forEach(function(file) {
                    var ext = file.name.split('.').pop().toLowerCase();
                    if (['txt', 'pdf', 'docx'].indexOf(ext) === -1) {
                        showUploadToast('不支持的文件格式：' + file.name, true);
                        return;
                    }
                    if (file.size > MAX_FILE_SIZE) {
                        showUploadToast('文件过大（>50MB）：' + file.name, true);
                        return;
                    }
                    validFiles.push(file);
                });
                if (validFiles.length === 0) return;

                var total = validFiles.length;
                var processed = 0;
                showUploadProgress(true);
                updateUploadProgress('读取中...', 0);

                validFiles.forEach(function(file) {
                    var ext = file.name.split('.').pop().toLowerCase();
                    var id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
                    var manual = { id: id, name: file.name, type: ext, size: file.size, uploadTime: Date.now() };

                    var reader = new FileReader();
                    reader.onload = function(e) {
                        var buffer = e.target.result;
                        // 先存储文件——TXT 同步提取搜索文本，DOCX/PDF 后台异步提取
                        manuals.unshift(manual);
                        saveManuals(manuals);  // 每文件即时持久化，防刷新丢失
                        var searchText = '';
                        if (ext === 'txt') {
                            try {
                                var decoder = new TextDecoder('utf-8');
                                searchText = decoder.decode(buffer).substring(0, MAX_CONTENT_LENGTH);
                            } catch(e2) {}
                        }
                        idbPut(id, buffer, searchText).then(function() {
                            processed++;
                            var pct = Math.round((processed / total) * 100);
                            updateUploadProgress('已完成 ' + processed + '/' + total, pct);
                            if (processed === total) {
                                saveManuals(manuals);
                                renderManualList();
                                setTimeout(function() { showUploadProgress(false); }, 600);
                                showUploadToast('成功上传 ' + total + ' 份牌意');
                            }
                            // DOCX/PDF 后台提取搜索文本（不影响上传完成）
                            if (ext === 'docx' || ext === 'pdf') {
                                deferredExtractSearchText(id, buffer, ext);
                            }
                        }).catch(function() {
                            processed++;
                            var pct = Math.round((processed / total) * 100);
                            updateUploadProgress('已完成 ' + processed + '/' + total, pct);
                            if (processed === total) {
                                saveManuals(manuals);
                                renderManualList();
                                setTimeout(function() { showUploadProgress(false); }, 600);
                            }
                        });
                    };
                    reader.onerror = function() {
                        processed++;
                        var pct = Math.round((processed / total) * 100);
                        updateUploadProgress('已完成 ' + processed + '/' + total, pct);
                        if (processed === total) {
                            saveManuals(manuals);
                            renderManualList();
                            setTimeout(function() { showUploadProgress(false); }, 600);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                });
            }

            // ---- 列表渲染 ----
            function renderManualList() {
                var manuals = getManuals();
                var listEl = document.getElementById('manual-list');
                var emptyEl = document.getElementById('manual-empty');
                var countEl = document.getElementById('manual-count');
                if (!listEl) return;
                countEl.textContent = manuals.length + ' 份';
                if (manuals.length === 0) {
                    listEl.innerHTML = '';
                    emptyEl.style.display = 'block';
                } else {
                    emptyEl.style.display = 'none';
                    listEl.innerHTML = manuals.map(function(m) {
                        var date = new Date(m.uploadTime);
                        var dateStr = date.getFullYear() + '/' + (date.getMonth()+1) + '/' + date.getDate();
                        var sizeStr = m.size < 1024 ? m.size + 'B' : m.size < 1048576 ? (m.size/1024).toFixed(1)+'KB' : (m.size/1048576).toFixed(1)+'MB';
                        var iconMap = { txt:'fa-file-lines', pdf:'fa-file-pdf', docx:'fa-file-word' };
                        var icon = iconMap[m.type] || 'fa-file';
                        return '<div class="manual-item glass-card rounded-xl p-3 flex items-center gap-3" onclick="openManualPage(\'' + m.id + '\')">\
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(var(--theme-primary-rgb),0.12);">\
                                <i class="fa-solid ' + icon + '" style="color:var(--theme-primary);"></i>\
                            </div>\
                            <div class="flex-1 min-w-0">\
                                <p class="text-sm text-dark-text truncate">' + escapeHtml(m.name) + '</p>\
                                <p class="text-xs text-light-text">' + dateStr + ' · ' + sizeStr + '</p>\
                            </div>\
                            <button class="delete-btn w-8 h-8 rounded-full flex items-center justify-center text-light-text/40 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0" onclick="event.stopPropagation();deleteManual(\'' + m.id + '\')" title="删除">\
                                <i class="fa-solid fa-trash text-xs"></i>\
                            </button>\
                        </div>';
                    }).join('');
                }
            }

            function escapeHtml(str) {
                var div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            // ---- 详情弹窗（原样预览） ----
            var _mvBlobUrl = null; // 当前 PDF blob URL，离开页面时释放

            function _mvCleanupBlobUrl() {
                if (_mvBlobUrl) {
                    URL.revokeObjectURL(_mvBlobUrl);
                    _mvBlobUrl = null;
                }
            }

            function openManualPage(id) {
                var manuals = getManuals();
                var manual = manuals.find(function(m) { return m.id === id; });
                if (!manual) return;
                currentManualId = id;

                // 切换到查看页
                switchPage('page-manual-viewer');

                // 设置头部信息
                document.getElementById('mv-title').textContent = manual.name;
                var date = new Date(manual.uploadTime);
                var dateStr = date.getFullYear() + '/' + (date.getMonth()+1) + '/' + date.getDate();
                var sizeStr = manual.size < 1024 ? manual.size + 'B' : manual.size < 1048576 ? (manual.size/1024).toFixed(1)+'KB' : (manual.size/1048576).toFixed(1)+'MB';
                document.getElementById('mv-meta').textContent = dateStr + ' · ' + sizeStr;

                // 清空搜索
                document.getElementById('mv-search-input').value = '';
                document.getElementById('mv-search-clear').style.display = 'none';

                // 加载内容
                var contentEl = document.getElementById('mv-content');
                contentEl.innerHTML = '<div class="manual-viewer-loading"><div class="manual-viewer-loading-spinner"></div><p style="color:var(--theme-text-light);font-size:13px;">加载中...</p></div>';

                _mvCleanupBlobUrl();

                idbGet(id).then(function(record) {
                    if (!record || !record.data) {
                        contentEl.innerHTML = '<div class="manual-viewer-error"><i class="fa-solid fa-circle-exclamation"></i><p>文件数据丢失</p></div>';
                        return;
                    }
                    if (manual.type === 'txt') {
                        var decoder = new TextDecoder('utf-8');
                        contentEl.innerHTML = '<pre>' + escapeHtml(decoder.decode(record.data)) + '</pre>';
                        // 后台补搜素文本
                        if (!record.searchText) {
                            deferredExtractSearchText(id, record.data, 'txt');
                        }
                    } else if (manual.type === 'docx') {
                        if (typeof mammoth === 'undefined') {
                            contentEl.innerHTML = '<div class="manual-viewer-error"><i class="fa-solid fa-file-word"></i><p>DOCX 预览组件加载失败，请检查网络</p></div>';
                            return;
                        }
                        mammoth.convertToHtml({ arrayBuffer: record.data }).then(function(result) {
                            contentEl.innerHTML = '<div class="manual-viewer-docx">' + result.value + '</div>';
                            // 后台补搜索文本
                            if (!record.searchText) {
                                deferredExtractSearchText(id, record.data, 'docx');
                            }
                        }).catch(function() {
                            contentEl.innerHTML = '<div class="manual-viewer-error"><i class="fa-solid fa-file-word"></i><p>文档解析失败</p></div>';
                        });
                    } else if (manual.type === 'pdf') {
                        // pdfjsLib canvas 逐页渲染，完全控制样式，避免原生查看器黑框
                        if (typeof pdfjsLib === 'undefined') {
                            // 降级：原生查看器
                            var blob = new Blob([record.data], { type: 'application/pdf' });
                            _mvBlobUrl = URL.createObjectURL(blob);
                            contentEl.innerHTML = '<iframe src="' + _mvBlobUrl + '#toolbar=0" class="manual-viewer-pdf-frame"></iframe>';
                        } else {
                            contentEl.innerHTML = '<div class="manual-viewer-pdf-pages" id="mv-pdf-pages"><div class="manual-viewer-loading"><div class="manual-viewer-loading-spinner"></div><p style="color:var(--theme-text-light);font-size:13px;">加载 PDF...</p></div></div>';
                            var pagesContainer = document.getElementById('mv-pdf-pages');
                            pdfjsLib.getDocument({ data: record.data }).promise.then(function(pdf) {
                                if (!pagesContainer || currentManualId !== id) return;
                                pagesContainer.innerHTML = '';
                                var scale = 1.8;
                                var loadPage = function(pageNum) {
                                    if (pageNum > pdf.numPages) return;
                                    pdf.getPage(pageNum).then(function(page) {
                                        if (currentManualId !== id) return;
                                        var viewport = page.getViewport({ scale: scale });
                                        var canvas = document.createElement('canvas');
                                        canvas.width = viewport.width;
                                        canvas.height = viewport.height;
                                        var wrapper = document.createElement('div');
                                        wrapper.className = 'manual-viewer-pdf-page';
                                        wrapper.appendChild(canvas);
                                        pagesContainer.appendChild(wrapper);
                                        page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport });
                                        loadPage(pageNum + 1);
                                    });
                                };
                                loadPage(1);
                            }).catch(function() {
                                // 降级：原生查看器
                                var blob = new Blob([record.data], { type: 'application/pdf' });
                                _mvBlobUrl = URL.createObjectURL(blob);
                                contentEl.innerHTML = '<iframe src="' + _mvBlobUrl + '#toolbar=0" class="manual-viewer-pdf-frame"></iframe>';
                            });
                        }
                        // 后台补搜索文本
                        if (!record.searchText) {
                            deferredExtractSearchText(id, record.data, 'pdf');
                        }
                    }
                }).catch(function() {
                    contentEl.innerHTML = '<div class="manual-viewer-error"><i class="fa-solid fa-circle-exclamation"></i><p>加载失败，请稍后重试</p></div>';
                });
            }

            function closeManualPage() {
                _mvCleanupBlobUrl();
                currentManualId = null;
                switchPage('page-tutorial');
            }

            function deleteManualFromViewer() {
                if (!currentManualId) return;
                if (!confirm('确定删除这份牌意吗？')) return;
                var id = currentManualId;
                closeManualPage();
                deleteManual(id);
            }



            function deleteManual(id) {
                if (!confirm('确定删除这份牌意吗？')) return;
                var manuals = getManuals();
                manuals = manuals.filter(function(m) { return m.id !== id; });
                saveManuals(manuals);
                idbDelete(id);
                if (currentManualId === id) {
                    _mvCleanupBlobUrl();
                    currentManualId = null;
                }
                renderManualList();
                var searchResultsEl = document.getElementById('manual-search-results');
                if (searchResultsEl) searchResultsEl.style.display = 'none';
            }

            // ---- 全局搜索（文件名 + IndexedDB 全文） ----
            function searchManuals() {
                var query = document.getElementById('manual-search-input').value.trim();
                if (!query) {
                    document.getElementById('manual-search-results').style.display = 'none';
                    return;
                }
                var manuals = getManuals();
                var lowerQuery = query.toLowerCase();

                // 文件名匹配
                var nameResults = [];
                manuals.forEach(function(m) {
                    var matches = [];
                    var nameIdx = m.name.toLowerCase().indexOf(lowerQuery);
                    while (nameIdx !== -1) {
                        matches.push({ start: nameIdx, end: nameIdx + query.length });
                        nameIdx = m.name.toLowerCase().indexOf(lowerQuery, nameIdx + 1);
                    }
                    if (matches.length > 0) {
                        nameResults.push({ manual: m, matches: matches, matchType: 'name' });
                    }
                });

                idbSearch(query).then(function(contentResults) {
                    var allResults = nameResults.slice();
                    contentResults.forEach(function(cr) {
                        var manual = manuals.find(function(m) { return m.id === cr.id; });
                        if (!manual) return;
                        var st = cr.searchText || '';
                        var stLower = st.toLowerCase();
                        var idx = stLower.indexOf(lowerQuery);
                        while (idx !== -1) {
                            var start = Math.max(0, idx - 30);
                            var end = Math.min(st.length, idx + query.length + 30);
                            var ctx = st.substring(start, end);
                            if (start > 0) ctx = '...' + ctx;
                            if (end < st.length) ctx = ctx + '...';
                            allResults.push({
                                manual: manual,
                                context: ctx,
                                matchType: 'content',
                                highlightStart: idx - start + (start > 0 ? 3 : 0),
                                highlightEnd: idx - start + query.length + (start > 0 ? 3 : 0)
                            });
                            idx = stLower.indexOf(lowerQuery, idx + 1);
                        }
                    });

                    var resultListEl = document.getElementById('search-result-list');
                    var searchResultsEl = document.getElementById('manual-search-results');
                    var countEl = document.getElementById('search-result-count');
                    searchResultsEl.style.display = 'block';
                    countEl.textContent = '共 ' + allResults.length + ' 条结果';

                    if (allResults.length === 0) {
                        resultListEl.innerHTML = '<div class="text-center py-8"><i class="fa-solid fa-circle-exclamation text-3xl opacity-15" style="color:var(--theme-text-light);"></i><p class="text-sm text-light-text mt-2">未找到匹配结果</p></div>';
                    } else {
                        resultListEl.innerHTML = allResults.map(function(r) {
                            if (r.matchType === 'name') {
                                var highlightedName = '';
                                var lastEnd = 0;
                                r.matches.forEach(function(match) {
                                    highlightedName += escapeHtml(r.manual.name.substring(lastEnd, match.start));
                                    highlightedName += '<span class="search-highlight">' + escapeHtml(r.manual.name.substring(match.start, match.end)) + '</span>';
                                    lastEnd = match.end;
                                });
                                highlightedName += escapeHtml(r.manual.name.substring(lastEnd));
                                return '<div class="search-result-item glass-card rounded-xl p-3 cursor-pointer" onclick="openManualPage(\'' + r.manual.id + '\')">\
                                    <div class="flex items-center gap-2 mb-1">\
                                        <i class="fa-solid fa-tag text-xs" style="color:var(--theme-primary);"></i>\
                                        <span class="text-xs" style="color:var(--theme-primary);">文件名匹配</span>\
                                    </div>\
                                    <p class="text-sm text-dark-text">' + highlightedName + '</p>\
                                </div>';
                            } else {
                                var ctxHtml = escapeHtml(r.context);
                                var before = ctxHtml.substring(0, r.highlightStart);
                                var match = ctxHtml.substring(r.highlightStart, r.highlightEnd);
                                var after = ctxHtml.substring(r.highlightEnd);
                                return '<div class="search-result-item glass-card rounded-xl p-3 cursor-pointer" onclick="openManualPage(\'' + r.manual.id + '\')">\
                                    <div class="flex items-center gap-2 mb-1">\
                                        <i class="fa-solid fa-align-left text-xs" style="color:var(--theme-primary);"></i>\
                                        <span class="text-xs font-medium text-dark-text truncate">' + escapeHtml(r.manual.name) + '</span>\
                                    </div>\
                                    <p class="text-xs text-light-text leading-relaxed">' + before + '<span class="search-highlight">' + match + '</span>' + after + '</p>\
                                </div>';
                            }
                        }).join('');
                    }
                });
            }

            function clearManualSearch() {
                document.getElementById('manual-search-input').value = '';
                document.getElementById('manual-search-results').style.display = 'none';
            }

            // ---- 详情内搜索（基于 IndexedDB searchText） ----
            function searchWithinManualPage() {
                if (!currentManualId) return;
                var query = document.getElementById('mv-search-input').value.trim();
                var clearBtn = document.getElementById('mv-search-clear');
                if (!query) { clearManualPageSearch(); return; }
                clearBtn.style.display = 'flex';

                idbGet(currentManualId).then(function(record) {
                    if (!record || !record.searchText) {
                        document.getElementById('mv-content').innerHTML = '<div class="manual-viewer-error"><i class="fa-solid fa-magnifying-glass"></i><p>此类型文件暂不支持全文搜索<br><span style="font-size:12px;opacity:0.6;">后台正在提取文本，稍后重试</span></p></div>';
                        return;
                    }
                    var text = record.searchText;
                    var lowerText = text.toLowerCase();
                    var lowerQuery = query.toLowerCase();
                    var result = '';
                    var lastIdx = 0;
                    var idx = lowerText.indexOf(lowerQuery);
                    var matchCount = 0;
                    while (idx !== -1) {
                        matchCount++;
                        result += escapeHtml(text.substring(lastIdx, idx));
                        result += '<span class="search-highlight">' + escapeHtml(text.substring(idx, idx + query.length)) + '</span>';
                        lastIdx = idx + query.length;
                        idx = lowerText.indexOf(lowerQuery, lastIdx);
                    }
                    result += escapeHtml(text.substring(lastIdx));
                    var contentEl = document.getElementById('mv-content');
                    if (matchCount > 0) {
                        contentEl.innerHTML = '<p style="font-size:12px;color:var(--theme-text-light);margin-bottom:12px;">找到 ' + matchCount + ' 处匹配</p><pre>' + result + '</pre>';
                    } else {
                        contentEl.innerHTML = '<p style="font-size:12px;color:var(--theme-text-light);margin-bottom:12px;">未找到匹配</p><pre>' + result + '</pre>';
                    }
                }).catch(function() {
                    document.getElementById('mv-content').innerHTML = '<div class="manual-viewer-error"><i class="fa-solid fa-circle-exclamation"></i><p>搜索出错</p></div>';
                });
            }

            function clearManualPageSearch() {
                document.getElementById('mv-search-input').value = '';
                document.getElementById('mv-search-clear').style.display = 'none';
                if (!currentManualId) return;
                openManualPage(currentManualId);
            }

            function loadManualsFromStorage() {
                var manuals = getManuals();
                if (manuals.length === 0) {
                    // localStorage 为空时，尝试从 IndexedDB 恢复元数据
                    idbGetMeta().then(function(json) {
                        if (json) {
                            try { localStorage.setItem(MANUAL_STORAGE_KEY, json); } catch(e) {}
                        }
                        renderManualList();
                    }).catch(function() {
                        renderManualList();
                    });
                } else {
                    renderManualList();
                }
            }

            // ---- 全局暴露 ----
            window.handleManualUpload = handleManualUpload;
            window.handleManualDrop = handleManualDrop;
            window.openManualPage = openManualPage;
            window.closeManualPage = closeManualPage;
            window.deleteManual = deleteManual;
            window.deleteManualFromViewer = deleteManualFromViewer;
            window.searchManuals = searchManuals;
            window.clearManualSearch = clearManualSearch;
            window.searchWithinManualPage = searchWithinManualPage;
            window.clearManualPageSearch = clearManualPageSearch;
            window.loadManualsFromStorage = loadManualsFromStorage;

        });
