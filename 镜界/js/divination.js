        // ================================================
        // 占卜抽牌系统
        // ================================================
        let divineState = {
            deckId: 'tarot',
            reversedEnabled: false,
            drawMode: 'deck',
            spreadId: null,
            spreadCardCount: null,
            customCount: 3,
            shuffledCards: [],
            drawnCards: [], // { cardData, reversed, fanIndex, readingId }
            readingCardIdCounter: 0,
            isDivineActive: false,
            backImageData: null,   // 在 startDivine 时捕获，保证所有牌使用同一牌背
            question: ''           // 本轮占卜问题（可空）
        };

        function getDeckCards(deckId) {
            const deck = deckListData.find(d => d.id === deckId);
            if (!deck) return [];

            if (deckId === 'iching') {
                return ichingData.map((hex, idx) => ({ ...hex, cardIndex: idx, _deckType: 'iching' }));
            }
            if (deckId === 'lenormand') {
                return lenormandCards.map((card, idx) => ({ ...card, cardIndex: idx, _deckType: 'lenormand' }));
            }
            if (deck.data) {
                return deck.data.cards.map((c, idx) => ({ ...c, cardIndex: idx, _deckType: 'custom' }));
            }
            if (deck.cards && deck.cards.length > 0) {
                return deck.cards.map((c, idx) => ({ ...c, cardIndex: idx, _deckType: 'custom' }));
            }
            // default: use majorArcana + minorArcana raw data
            const allCards = [];
            majorArcana.forEach((c, idx) => allCards.push({ ...c, cardIndex: idx, isMajor: true, suitName: null, _deckType: 'tarot' }));
            ['wands','cups','swords','pentacles'].forEach(suit => {
                minorArcana[suit].forEach((c, idx) => {
                    allCards.push({ ...c, cardIndex: allCards.length, isMajor: false, suitName: suit, _deckType: 'tarot' });
                });
            });
            return allCards;
        }

        // ---- 自然尺寸适配：读取牌背图片原始宽高，同步设置卡片 .reading-card 和 .card-inner 盒模型 ----
        function naturalizeCardSize(cardEl, natW, natH) {
            if (!natW || !natH || natW <= 0 || natH <= 0) return;
            // max-width 限制：桌面端 120px，手机端 90px（与 CSS 媒体查询同步）
            const maxW = window.innerWidth <= 480 ? 90 : 120;
            let finalW = natW;
            let finalH = natH;
            if (natW > maxW) {
                finalW = maxW;
                finalH = Math.round(natH * (maxW / natW));
            }
            cardEl.style.width = finalW + 'px';
            cardEl.style.height = finalH + 'px';
            const inner = cardEl.querySelector('.card-inner');
            if (inner) {
                inner.style.width = '100%';
                inner.style.height = '100%';
            }
        }

        // 内置牌组牌背太极六爻 SVG（与牌组详情页保持一致）
        function getBuiltInDeckBackSVG(deckId) {
            if (deckId === 'iching') return getIChingBackSVG();
            return '<svg viewBox="0 0 100 100" style="width:100%;height:100%;fill:none;stroke:#8B7355;stroke-width:1.5;">'+
                '<circle cx="50" cy="50" r="44" stroke-width="0.8" opacity="0.4"/>'+
                '<circle cx="50" cy="50" r="41" stroke="#A0916E" stroke-width="0.3" stroke-dasharray="3 5.8" opacity="0.3"/>'+
                '<circle cx="50" cy="50" r="38" stroke-width="0.5" opacity="0.25"/>'+
                '<g stroke-width="1" opacity="0.35">'+
                '<line x1="16" y1="30" x2="21" y2="30"/><line x1="26" y1="30" x2="31" y2="30"/>'+
                '<line x1="16" y1="35" x2="21" y2="35"/><line x1="26" y1="35" x2="31" y2="35"/>'+
                '<line x1="16" y1="40" x2="21" y2="40"/><line x1="26" y1="40" x2="31" y2="40"/>'+
                '<line x1="16" y1="60" x2="21" y2="60"/><line x1="26" y1="60" x2="31" y2="60"/>'+
                '<line x1="16" y1="65" x2="21" y2="65"/><line x1="26" y1="65" x2="31" y2="65"/>'+
                '<line x1="16" y1="70" x2="21" y2="70"/><line x1="26" y1="70" x2="31" y2="70"/>'+
                '</g>'+
                '<g stroke-width="1" opacity="0.35">'+
                '<line x1="69" y1="30" x2="84" y2="30"/><line x1="69" y1="35" x2="84" y2="35"/>'+
                '<line x1="69" y1="40" x2="84" y2="40"/><line x1="69" y1="60" x2="84" y2="60"/>'+
                '<line x1="69" y1="65" x2="84" y2="65"/><line x1="69" y1="70" x2="84" y2="70"/>'+
                '</g>'+
                '<circle cx="50" cy="50" r="16" stroke-width="1.8"/>'+
                '<path d="M50,34 A16,16 0 0,1 50,66 A8,8 0 0,0 50,50 A8,8 0 0,1 50,34Z" fill="#8B7355" opacity="0.25"/>'+
                '<circle cx="50" cy="42" r="2" fill="#8B7355" opacity="0.55"/>'+
                '<circle cx="50" cy="58" r="2" fill="#C4B594" opacity="0.6"/>'+
                '<circle cx="50" cy="50" r="1.5" fill="#8B7355" opacity="0.3"/>'+
                '</svg>';
        }

                function getIChingBackSVG() {
            // I Ching card back — scattered star-dust motif.
            // Warm cream/sand gradient with random star points of varying sizes.
            // Fine cross glints on larger stars, standalone gold glints.
            // Warm brown/gold palette; no black, no borders, no rings.
            // viewBox 100x140 (5:7) matches card aspect ratio.
            return '<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="display:block;width:100%;height:100%"><defs><linearGradient id="icbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE3CE"/><stop offset="0.5" stop-color="#E5D9BE"/><stop offset="1" stop-color="#D9C7A6"/></linearGradient></defs><rect width="100" height="140" style="fill:url(#icbg)"/><circle cx="62.3" cy="9.2" r="0.36" style="fill:#8B7355" opacity="0.23"/><circle cx="15.0" cy="100.8" r="0.47" style="fill:#D9C7A6" opacity="0.31"/><circle cx="8.6" cy="34.0" r="0.45" style="fill:#C9A86A" opacity="0.34"/><circle cx="69.0" cy="95.8" r="0.42" style="fill:#C4B594" opacity="0.35"/><circle cx="77.2" cy="6.8" r="0.57" style="fill:#BFAA80" opacity="0.29"/><circle cx="19.7" cy="128.5" r="0.38" style="fill:#B8986A" opacity="0.29"/><circle cx="37.6" cy="50.0" r="0.36" style="fill:#C9A86A" opacity="0.38"/><circle cx="53.2" cy="130.6" r="0.4" style="fill:#7A6448" opacity="0.27"/><circle cx="61.3" cy="119.3" r="0.39" style="fill:#8B7355" opacity="0.38"/><circle cx="10.0" cy="35.2" r="0.37" style="fill:#B8986A" opacity="0.41"/><circle cx="82.3" cy="54.7" r="0.43" style="fill:#9E8262" opacity="0.24"/><circle cx="37.3" cy="91.8" r="0.53" style="fill:#B8986A" opacity="0.35"/><circle cx="21.1" cy="99.3" r="0.32" style="fill:#BFAA80" opacity="0.27"/><circle cx="87.4" cy="94.1" r="0.34" style="fill:#9E8262" opacity="0.41"/><circle cx="74.3" cy="35.3" r="0.26" style="fill:#9E8262" opacity="0.3"/><circle cx="11.8" cy="122.9" r="0.48" style="fill:#9E8262" opacity="0.25"/><circle cx="49.9" cy="119.2" r="0.51" style="fill:#D4BF90" opacity="0.27"/><circle cx="27.7" cy="77.9" r="0.36" style="fill:#D9C7A6" opacity="0.31"/><circle cx="57.4" cy="52.3" r="0.65" style="fill:#D4BF90" opacity="0.33"/><circle cx="14.0" cy="12.0" r="0.29" style="fill:#D4BF90" opacity="0.4"/><circle cx="43.2" cy="14.1" r="0.4" style="fill:#C4B594" opacity="0.33"/><circle cx="91.5" cy="116.2" r="0.25" style="fill:#B8986A" opacity="0.37"/><circle cx="53.3" cy="40.2" r="0.51" style="fill:#B8986A" opacity="0.27"/><circle cx="19.9" cy="6.4" r="0.54" style="fill:#A08060" opacity="0.44"/><circle cx="73.1" cy="71.0" r="0.29" style="fill:#A08060" opacity="0.41"/><circle cx="50.7" cy="31.5" r="0.4" style="fill:#D4BF90" opacity="0.33"/><circle cx="74.5" cy="73.9" r="0.25" style="fill:#9E8262" opacity="0.32"/><circle cx="15.8" cy="52.5" r="0.64" style="fill:#A08060" opacity="0.26"/><circle cx="27.2" cy="78.6" r="0.28" style="fill:#C4B594" opacity="0.4"/><circle cx="92.1" cy="74.2" r="0.3" style="fill:#C4B594" opacity="0.44"/><circle cx="20.5" cy="73.5" r="0.49" style="fill:#8B7355" opacity="0.43"/><circle cx="72.5" cy="94.3" r="0.54" style="fill:#BFAA80" opacity="0.45"/><circle cx="63.2" cy="62.1" r="0.46" style="fill:#B8986A" opacity="0.26"/><circle cx="11.6" cy="8.7" r="0.47" style="fill:#D9C7A6" opacity="0.26"/><circle cx="12.2" cy="86.8" r="0.34" style="fill:#C9A86A" opacity="0.41"/><circle cx="12.2" cy="36.5" r="0.52" style="fill:#8B7355" opacity="0.33"/><circle cx="69.7" cy="118.9" r="0.48" style="fill:#8B7355" opacity="0.4"/><circle cx="77.1" cy="30.4" r="0.29" style="fill:#BFAA80" opacity="0.29"/><circle cx="42.2" cy="116.6" r="0.27" style="fill:#B8986A" opacity="0.22"/><circle cx="70.1" cy="108.5" r="0.29" style="fill:#8B7355" opacity="0.25"/><circle cx="45.5" cy="60.0" r="0.36" style="fill:#8B7355" opacity="0.42"/><circle cx="12.6" cy="109.4" r="0.59" style="fill:#B8986A" opacity="0.21"/><circle cx="93.9" cy="113.0" r="0.64" style="fill:#8B7355" opacity="0.24"/><circle cx="48.7" cy="33.4" r="0.41" style="fill:#C9A86A" opacity="0.24"/><circle cx="6.2" cy="56.0" r="0.62" style="fill:#C4B594" opacity="0.27"/><circle cx="67.3" cy="99.5" r="0.56" style="fill:#C4B594" opacity="0.24"/><circle cx="32.1" cy="130.0" r="0.48" style="fill:#7A6448" opacity="0.22"/><circle cx="33.6" cy="12.4" r="0.44" style="fill:#7A6448" opacity="0.24"/><circle cx="90.5" cy="16.3" r="0.32" style="fill:#D9C7A6" opacity="0.22"/><circle cx="81.8" cy="57.7" r="0.63" style="fill:#D9C7A6" opacity="0.26"/><circle cx="58.3" cy="85.3" r="0.42" style="fill:#D9C7A6" opacity="0.34"/><circle cx="33.8" cy="39.4" r="0.52" style="fill:#9E8262" opacity="0.26"/><circle cx="40.8" cy="92.0" r="0.37" style="fill:#9E8262" opacity="0.43"/><circle cx="88.3" cy="7.2" r="0.5" style="fill:#D9C7A6" opacity="0.45"/><circle cx="12.4" cy="33.3" r="0.36" style="fill:#9E8262" opacity="0.42"/><circle cx="83.4" cy="53.3" r="0.31" style="fill:#7A6448" opacity="0.38"/><circle cx="59.8" cy="132.4" r="0.51" style="fill:#C9A86A" opacity="0.37"/><circle cx="54.8" cy="125.3" r="0.29" style="fill:#D4BF90" opacity="0.27"/><circle cx="84.3" cy="101.0" r="0.31" style="fill:#A08060" opacity="0.35"/><circle cx="69.1" cy="32.1" r="0.5" style="fill:#A08060" opacity="0.33"/><circle cx="28.1" cy="122.2" r="0.68" style="fill:#BFAA80" opacity="0.51"/><circle cx="9.9" cy="48.7" r="0.72" style="fill:#A08060" opacity="0.34"/><circle cx="44.9" cy="96.3" r="0.96" style="fill:#B8986A" opacity="0.32"/><circle cx="83.7" cy="121.7" r="0.95" style="fill:#9E8262" opacity="0.45"/><circle cx="19.0" cy="22.3" r="0.82" style="fill:#C9A86A" opacity="0.52"/><circle cx="24.5" cy="37.9" r="0.71" style="fill:#7A6448" opacity="0.52"/><circle cx="41.8" cy="85.4" r="0.74" style="fill:#8B7355" opacity="0.52"/><circle cx="91.9" cy="109.8" r="1.13" style="fill:#C9A86A" opacity="0.34"/><circle cx="87.4" cy="106.1" r="0.88" style="fill:#8B7355" opacity="0.37"/><circle cx="75.3" cy="19.8" r="1.13" style="fill:#C4B594" opacity="0.36"/><circle cx="77.9" cy="64.9" r="0.82" style="fill:#8B7355" opacity="0.36"/><circle cx="64.1" cy="57.0" r="0.8" style="fill:#B8986A" opacity="0.54"/><circle cx="30.6" cy="88.1" r="0.87" style="fill:#7A6448" opacity="0.38"/><circle cx="8.4" cy="118.3" r="0.79" style="fill:#D9C7A6" opacity="0.54"/><circle cx="29.4" cy="19.9" r="0.89" style="fill:#9E8262" opacity="0.41"/><circle cx="92.6" cy="20.8" r="1.14" style="fill:#8B7355" opacity="0.36"/><circle cx="68.4" cy="6.2" r="1.16" style="fill:#7A6448" opacity="0.47"/><circle cx="88.7" cy="100.3" r="0.76" style="fill:#BFAA80" opacity="0.32"/><circle cx="64.5" cy="48.3" r="0.82" style="fill:#B8986A" opacity="0.48"/><circle cx="32.4" cy="45.6" r="0.87" style="fill:#BFAA80" opacity="0.47"/><circle cx="54.8" cy="30.6" r="1.02" style="fill:#BFAA80" opacity="0.47"/><circle cx="85.4" cy="84.8" r="0.82" style="fill:#7A6448" opacity="0.51"/><circle cx="32.7" cy="32.9" r="1.08" style="fill:#D9C7A6" opacity="0.46"/><circle cx="46.9" cy="62.6" r="0.77" style="fill:#C4B594" opacity="0.5"/><circle cx="90.5" cy="100.2" r="1.01" style="fill:#A08060" opacity="0.43"/><circle cx="61.7" cy="48.9" r="1.1" style="fill:#8B7355" opacity="0.47"/><circle cx="25.8" cy="31.5" r="0.66" style="fill:#8B7355" opacity="0.55"/><circle cx="59.8" cy="104.4" r="0.9" style="fill:#D9C7A6" opacity="0.35"/><circle cx="67.3" cy="69.3" r="0.78" style="fill:#C9A86A" opacity="0.52"/><circle cx="81.7" cy="119.3" r="1.08" style="fill:#8B7355" opacity="0.34"/><circle cx="90.3" cy="72.3" r="0.68" style="fill:#8B7355" opacity="0.53"/><circle cx="16.7" cy="23.1" r="0.91" style="fill:#7A6448" opacity="0.55"/><circle cx="58.4" cy="127.6" r="1.14" style="fill:#D9C7A6" opacity="0.5"/><circle cx="84.5" cy="60.6" r="1.15" style="fill:#C4B594" opacity="0.52"/><circle cx="71.4" cy="66.8" r="0.79" style="fill:#8B7355" opacity="0.51"/><circle cx="31.3" cy="104.4" r="1.59" style="fill:#8B7355" opacity="0.47"/><circle cx="14.5" cy="43.4" r="1.42" style="fill:#9E8262" opacity="0.62"/><circle cx="14.8" cy="26.7" r="1.51" style="fill:#D4BF90" opacity="0.58"/><circle cx="13.4" cy="58.5" r="1.63" style="fill:#BFAA80" opacity="0.42"/><circle cx="78.0" cy="56.3" r="1.82" style="fill:#C9A86A" opacity="0.61"/><circle cx="72.3" cy="55.2" r="1.2" style="fill:#9E8262" opacity="0.47"/><circle cx="40.8" cy="118.6" r="1.87" style="fill:#7A6448" opacity="0.59"/><circle cx="53.9" cy="82.8" r="1.38" style="fill:#8B7355" opacity="0.47"/><circle cx="48.8" cy="56.2" r="1.74" style="fill:#BFAA80" opacity="0.58"/><circle cx="78.6" cy="122.0" r="1.98" style="fill:#7A6448" opacity="0.41"/><circle cx="41.1" cy="78.0" r="1.22" style="fill:#BFAA80" opacity="0.43"/><circle cx="46.8" cy="14.2" r="1.5" style="fill:#8B7355" opacity="0.51"/><circle cx="36.4" cy="117.1" r="1.42" style="fill:#BFAA80" opacity="0.46"/><circle cx="14.9" cy="10.4" r="1.63" style="fill:#9E8262" opacity="0.46"/><circle cx="13.8" cy="126.7" r="1.23" style="fill:#C9A86A" opacity="0.64"/><circle cx="24.7" cy="10.5" r="1.32" style="fill:#D4BF90" opacity="0.52"/><circle cx="17.6" cy="125.5" r="1.57" style="fill:#A08060" opacity="0.59"/><circle cx="22.1" cy="83.3" r="1.8" style="fill:#B8986A" opacity="0.59"/><circle cx="23.1" cy="47.3" r="2.69" style="fill:#D9C7A6" opacity="0.68"/><circle cx="64.2" cy="125.0" r="2.48" style="fill:#B8986A" opacity="0.63"/><circle cx="57.4" cy="109.7" r="2.29" style="fill:#A08060" opacity="0.62"/><circle cx="78.0" cy="82.0" r="2.15" style="fill:#C9A86A" opacity="0.7"/><circle cx="37.8" cy="61.4" r="2.44" style="fill:#9E8262" opacity="0.58"/><circle cx="11.0" cy="60.4" r="2.59" style="fill:#9E8262" opacity="0.56"/><circle cx="60.8" cy="109.4" r="2.85" style="fill:#7A6448" opacity="0.56"/><circle cx="87.2" cy="42.4" r="2.97" style="fill:#C4B594" opacity="0.58"/><line x1="17.2" y1="47.3" x2="29.0" y2="47.3" style="stroke:#D9C7A6;stroke-width:0.25" opacity="0.75"/><line x1="23.1" y1="41.4" x2="23.1" y2="53.2" style="stroke:#D9C7A6;stroke-width:0.25" opacity="0.75"/><line x1="58.7" y1="125.0" x2="69.7" y2="125.0" style="stroke:#B8986A;stroke-width:0.25" opacity="0.75"/><line x1="64.2" y1="119.5" x2="64.2" y2="130.5" style="stroke:#B8986A;stroke-width:0.25" opacity="0.75"/><line x1="52.4" y1="109.7" x2="62.4" y2="109.7" style="stroke:#A08060;stroke-width:0.25" opacity="0.75"/><line x1="57.4" y1="104.7" x2="57.4" y2="114.7" style="stroke:#A08060;stroke-width:0.25" opacity="0.75"/><line x1="73.3" y1="82.0" x2="82.7" y2="82.0" style="stroke:#C9A86A;stroke-width:0.25" opacity="0.75"/><line x1="78.0" y1="77.3" x2="78.0" y2="86.7" style="stroke:#C9A86A;stroke-width:0.25" opacity="0.75"/><line x1="32.4" y1="61.4" x2="43.2" y2="61.4" style="stroke:#9E8262;stroke-width:0.25" opacity="0.73"/><line x1="37.8" y1="56.0" x2="37.8" y2="66.8" style="stroke:#9E8262;stroke-width:0.25" opacity="0.73"/><line x1="42.8" y1="107.8" x2="51.8" y2="107.8" style="stroke:#B8986A;stroke-width:0.2" opacity="0.36"/><line x1="47.3" y1="103.3" x2="47.3" y2="112.3" style="stroke:#B8986A;stroke-width:0.2" opacity="0.36"/><line x1="69.9" y1="22.1" x2="80.3" y2="22.1" style="stroke:#BFAA80;stroke-width:0.2" opacity="0.35"/><line x1="75.1" y1="16.9" x2="75.1" y2="27.3" style="stroke:#BFAA80;stroke-width:0.2" opacity="0.35"/><line x1="51.5" y1="89.5" x2="59.1" y2="89.5" style="stroke:#D4BF90;stroke-width:0.2" opacity="0.4"/><line x1="55.3" y1="85.7" x2="55.3" y2="93.3" style="stroke:#D4BF90;stroke-width:0.2" opacity="0.4"/></svg>';
        }

                function getCardGradientByType(card) {
            const dt = card._deckType;
            if (dt === 'iching') return getCardGradient(false, null, 'iching', card.cardIndex);
            if (dt === 'lenormand') return getCardGradient(false, null, 'lenormand', card.cardIndex);
            if (dt === 'custom' && card.imageData) return '#f1f5f9';
            return getCardGradient(card.isMajor, card.suitName, null, null);
        }

        function getCardSVGForCard(card) {
            const dt = card._deckType;
            if (dt === 'lenormand') return getLenormandSVG(card.cardIndex);
            if (dt === 'custom' && card.imageData) return '';
            return getCardSVG(card.cardIndex, card.suitName, card.isMajor, dt === 'iching' ? 'iching' : 'tarot');
        }

        // 周易牌面 DOM 缓存：预渲染 64 张 card-thumb，供随机占卜 cloneNode 复用
        // 与 openDeckDetail 中 iching 牌面渲染逻辑完全一致
        let _ichingDeckCacheReady = false;
        function ensureIChingDeckCache() {
            if (_ichingDeckCacheReady) return;
            const cache = document.getElementById('iching-card-cache');
            if (!cache) return;
            if (typeof getCardGradient !== 'function' || typeof getCardSVG !== 'function') return;
            const frag = document.createDocumentFragment();
            ichingData.forEach((hex, idx) => {
                const bgGradient = getCardGradient(false, null, 'iching', idx);
                const svgContent = getCardSVG(idx, null, false, 'iching');
                const thumb = document.createElement('div');
                thumb.className = 'card-thumb';
                thumb.setAttribute('data-card-id', String(idx));
                thumb.style.background = bgGradient;
                thumb.innerHTML = '<div class="card-number">' + String(idx + 1) + '</div>' +
                    '<div class="card-svg-icon">' + svgContent + '</div>' +
                    '<div class="card-divider"></div>' +
                    '<div class="card-name">' + hex.name + '</div>' +
                    '<div class="card-name-en">' + hex.judgment + '</div>';
                frag.appendChild(thumb);
            });
            cache.innerHTML = '';
            cache.appendChild(frag);
            _ichingDeckCacheReady = true;
        }

        // 保留旧函数作为兜底（不再作为主路径）
        function buildIChingCardFaceHTML(card, cardIndex) {
            const bgGradient = getCardGradient(false, null, 'iching', cardIndex);
            const svgContent = getCardSVG(cardIndex, null, false, 'iching');
            const numberDisplay = String(cardIndex + 1);
            return '<div class="card-number">' + numberDisplay + '</div>' +
                '<div class="card-svg-icon">' + svgContent + '</div>' +
                '<div class="card-divider"></div>' +
                '<div class="card-name">' + card.name + '</div>' +
                '<div class="card-name-en">' + card.nameEn + '</div>';
        }

        function fisherYatesShuffle(arr) {
            const a = [...arr];
            // Use crypto.getRandomValues for true randomness
            const getRandomInt = (max) => {
                const arr = new Uint32Array(1);
                crypto.getRandomValues(arr);
                return arr[0] % max;
            };
            for (let i = a.length - 1; i > 0; i--) {
                const j = getRandomInt(i + 1);
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        function openDivineConfig() {
            const overlay = document.getElementById('divine-config-overlay');
            const select = document.getElementById('divine-deck-select');
            select.innerHTML = deckListData.map(d => `<option value="${d.id}" ${d.id === divineState.deckId ? 'selected' : ''}>${d.name} (${d.id==='iching'?'64':d.id==='lenormand'?'36':(d.cards?d.cards.length:'78')}张)</option>`).join('');
            document.getElementById('divine-draw-mode').value = divineState.drawMode;
            // 填充牌阵选择器
            const spreadSelect = document.getElementById('divine-spread-select');
            spreadSelect.innerHTML = spreadListData.map(s => `<option value="${s.id}" ${s.id === divineState.spreadId ? 'selected' : ''}>${s.name}（${s.cardCount}张）</option>`).join('');
            onDrawModeChange();
            if (divineState.drawMode === 'spread' && divineState.spreadId) {
                onSpreadChange();
            }
            const revToggle = document.getElementById('reversed-toggle');
            if (divineState.reversedEnabled) revToggle.classList.add('active');
            else revToggle.classList.remove('active');
            overlay.style.display = 'flex';
        }

        function closeDivineConfig() {
            document.getElementById('divine-config-overlay').style.display = 'none';
        }

        function toggleReversed() {
            divineState.reversedEnabled = !divineState.reversedEnabled;
            const el = document.getElementById('reversed-toggle');
            if (divineState.reversedEnabled) el.classList.add('active');
            else el.classList.remove('active');
        }

        function onDrawModeChange() {
            const mode = document.getElementById('divine-draw-mode').value;
            divineState.drawMode = mode;
            document.getElementById('spread-draw-config').style.display = mode === 'spread' ? 'block' : 'none';
        }

        function onSpreadChange() {
            const spreadId = document.getElementById('divine-spread-select').value;
            const spread = spreadListData.find(s => s.id === spreadId);
            const hintEl = document.getElementById('spread-card-count-hint');
            const displayEl = document.getElementById('spread-card-count-display');
            if (spread) {
                divineState.spreadId = spreadId;
                divineState.spreadCardCount = spread.cardCount;
                hintEl.style.display = 'block';
                displayEl.textContent = spread.cardCount + ' 张（' + spread.positions.join('·') + '）';
            } else {
                divineState.spreadId = null;
                divineState.spreadCardCount = null;
                hintEl.style.display = 'none';
                displayEl.textContent = '-';
            }
        }

        function startDivine() {
            const deckSelect = document.getElementById('divine-deck-select');
            divineState.deckId = deckSelect.value;
            // 在抽牌开始时捕获当前牌组的牌背图片，确保所有牌使用统一牌背
            const currentDeck = deckListData.find(d => d.id === divineState.deckId);
            divineState.backImageData = currentDeck ? currentDeck.backImageData : null;
            divineState.drawMode = document.getElementById('divine-draw-mode').value;
            if (divineState.drawMode === 'spread') {
                divineState.spreadId = document.getElementById('divine-spread-select').value;
                const spread = spreadListData.find(s => s.id === divineState.spreadId);
                divineState.spreadCardCount = spread ? spread.cardCount : 3;
            } else {
                divineState.spreadId = null;
                divineState.spreadCardCount = null;
            }
            divineState.drawnCards = [];
            divineState.readingCardIdCounter = 0;
            divineState.isDivineActive = true;
            divineState._saved = false;
            // 捕获本轮占卜问题（可留空），并清空输入框等待下次填写
            var questionInput = document.getElementById('divine-question-input');
            divineState.question = (questionInput && questionInput.value ? questionInput.value.trim() : '');
            if (questionInput) questionInput.value = '';

            closeDivineConfig();

            // Show shuffle animation
            const shuffleOverlay = document.getElementById('shuffling-overlay');
            shuffleOverlay.style.display = 'flex';

            setTimeout(() => {
                const allCards = getDeckCards(divineState.deckId);
                divineState.shuffledCards = fisherYatesShuffle(allCards);
                shuffleOverlay.style.display = 'none';
                document.getElementById('divine-result-footer').style.display = 'none';
                renderFan();
                clearReadingArea();
            }, 800);
        }

        function renderFan() {
            const container = document.getElementById('fan-scroll-container');
            const deck = deckListData.find(d => d.id === divineState.deckId);
            const isCustomBack = deck && deck.backImageData;
            const deckName = deck ? deck.name : '';
            const backColor = deck ? deck.backColor : 'var(--theme-card-back)';

            container.innerHTML = divineState.shuffledCards.map((card, idx) => {
                const alreadyDrawn = divineState.drawnCards.some(d => d.fanIndex === idx);
                const removedClass = alreadyDrawn ? ' removed' : '';
                if (isCustomBack) {
                    return `<div class="fan-card${removedClass}" data-fan-idx="${idx}" style="height:auto; overflow:visible;" onclick="pickFanCard(${idx})" title="第${idx+1}张">
                        <img src="${deck.backImageData}" style="width:100%; height:auto; display:block; border-radius:8px;" alt="牌背">
                    </div>`;
                }
                // 内置牌组扇形显示牌背（与 addReadingCard 牌背结构一致，无 inline 尺寸）
                return `<div class="fan-card${removedClass}${deck.id === 'iching' ? ' iching-back' : ''}" data-fan-idx="${idx}" style="background:${backColor}; display:flex; flex-direction:column; align-items:center; justify-content:center;" onclick="pickFanCard(${idx})" title="第${idx+1}张">
                    <div class="back-border"></div>
                    <div class="back-center-icon">${getBuiltInDeckBackSVG(deck.id)}</div>
                    <div class="back-deck-name">${deckName}</div>
                </div>`;
            }).join('');

            // Scroll to center (instant, no smooth — avoids Safari scroll conflict)
            setTimeout(() => {
                if (divineState.shuffledCards.length > 0) {
                    const mid = Math.floor(divineState.shuffledCards.length / 2);
                    const cardEl = container.querySelector(`[data-fan-idx="${mid}"]`);
                    if (cardEl) {
                        const cardRect = cardEl.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        const targetLeft = container.scrollLeft + (cardRect.left - containerRect.left) - (container.clientWidth / 2) + (cardEl.offsetWidth / 2);
                        container.scrollLeft = Math.max(0, targetLeft);
                    }
                }
            }, 100);
        }

        function clearReadingArea() {
            const area = document.getElementById('reading-area');
            area.innerHTML = '<div class="placeholder-text">请从下方牌堆中选择一张牌</div>';
        }

        function updateReadingAreaPlaceholder() {
            const area = document.getElementById('reading-area');
            const cards = area.querySelectorAll('.reading-card');
            if (cards.length === 0) {
                area.innerHTML = '<div class="placeholder-text">请从下方牌堆中选择一张牌</div>';
            } else {
                const placeholder = area.querySelector('.placeholder-text');
                if (placeholder) placeholder.remove();
            }
        }

        function pickFanCard(fanIdx) {
            if (!divineState.isDivineActive) return;
            if (divineState.drawnCards.some(d => d.fanIndex === fanIdx)) return;

            // 按牌阵抽取模式下检查抽牌数量上限
            if (divineState.drawMode === 'spread') {
                if (divineState.drawnCards.length >= divineState.spreadCardCount) {
                    return;
                }
            }

            const card = divineState.shuffledCards[fanIdx];
            // Determine reversed
            let isReversed = false;
            if (divineState.reversedEnabled) {
                const arr = new Uint32Array(1);
                crypto.getRandomValues(arr);
                isReversed = arr[0] % 2 === 0;
            }

            const readingId = 'rc_' + (divineState.readingCardIdCounter++);
            divineState.drawnCards.push({ cardData: card, reversed: isReversed, fanIndex: fanIdx, readingId: readingId });

            // Animate fan card
            const fanCardEl = document.querySelector(`.fan-card[data-fan-idx="${fanIdx}"]`);
            if (fanCardEl) {
                fanCardEl.classList.add('picked');
                setTimeout(() => { fanCardEl.classList.add('removed'); }, 500);
            }

            // Add to reading area
            addReadingCard(card, isReversed, readingId);

            // Show footer if cards drawn
            if (divineState.drawnCards.length > 0) {
                document.getElementById('divine-result-footer').style.display = 'flex';
            }

            updateReadingAreaPlaceholder();

            // 牌阵模式抽满后自动保存
            if (divineState.drawMode === 'spread' && divineState.drawnCards.length >= divineState.spreadCardCount && !divineState._saved) {
                divineState._saved = true;
                var _deck = deckListData.find(function(d) { return d.id === divineState.deckId; });
                var _spread;
                if (divineState.spreadId) {
                    _spread = spreadListData.find(function(s) { return s.id === divineState.spreadId; });
                }
                if (!_spread) {
                    _spread = { id: 'free', name: '自由抽取', cardCount: divineState.drawnCards.length, positions: null };
                }
                if (_deck && typeof window._saveDivineRecord === 'function') {
                    var _drawnCards = divineState.drawnCards.map(function(d) {
                        var c = d.cardData || {};
                        c.isReversed = d.reversed;
                        return c;
                    });
                    window._saveDivineRecord(_deck, _spread, _drawnCards, divineState.reversedEnabled, 'free', divineState.question);
                }
            }
        }

        function addReadingCard(card, isReversed, readingId) {
            const area = document.getElementById('reading-area');
            const placeholder = area.querySelector('.placeholder-text');
            if (placeholder) placeholder.remove();

            const bgGradient = getCardGradientByType(card);
            const isCustomBack = divineState.backImageData;
            const svgIcon = getCardSVGForCard(card);
            let _ichCacheThumb = null;  // 周易克隆源：稍后填入 cardEl
            const numberDisp = card.tarotNumber || (card.cardIndex !== undefined ? String(card.cardIndex + 1) : '');
            const nameDisp = card.name || card.nameEn || '';

            // ---- 构建卡面/卡背 HTML（内置牌组复用牌组详情页 card-thumb 结构） ----
            let frontFaceHTML;
            if (card._deckType === 'custom' && card.imageData) {
                frontFaceHTML = `<div class="card-face card-front-face" style="background:#f1f5f9; padding:0; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center;">
                    <img src="${card.imageData}" style="width:100%; height:100%; object-fit:contain; border-radius:10px;" alt="${nameDisp}">
                </div>`;
            } else if (isCustomBack) {
                // 自定义牌背但牌面非自定义：保留原样式
                frontFaceHTML = `<div class="card-face card-front-face" style="background:${bgGradient};">
                    <div class="card-number-display">${numberDisp}</div>
                    <div class="card-svg-icon">${svgIcon}</div>
                    <div class="card-name-display">${nameDisp}</div>
                </div>`;
            } else if (card._deckType === 'iching') {
                // 周易牌组：直接从 DOM 缓存 clone card-thumb，确保与牌组详情页100%一致
                ensureIChingDeckCache();
                const cacheThumb = document.getElementById('iching-card-cache').querySelector('.card-thumb[data-card-id="' + card.cardIndex + '"]');
                if (cacheThumb) {
                    frontFaceHTML = '<div class="card-face card-front-face card-thumb" style="background:' + bgGradient + ';"></div>';
                    // 标志位：稍后 clone 内容
                    _ichCacheThumb = cacheThumb;
                } else {
                    // 兜底：缓存未就绪
                    const nameEnDisp = card.nameEn || card.judgment || '';
                    frontFaceHTML = '<div class="card-face card-front-face card-thumb" style="background:' + bgGradient + ';">' +
                        '<div class="card-number">' + numberDisp + '</div>' +
                        '<div class="card-svg-icon">' + svgIcon + '</div>' +
                        '<div class="card-divider"></div>' +
                        '<div class="card-name">' + nameDisp + '</div>' +
                        '<div class="card-name-en">' + nameEnDisp + '</div>' +
                        '</div>';
                }
            } else {
                // 内置牌组（lenormand/tarot）：复用 card-thumb 结构
                const nameEnDisp = card.nameEn || card.judgment || '';
                frontFaceHTML = '<div class="card-face card-front-face card-thumb" style="background:' + bgGradient + ';">' +
                    '<div class="card-number">' + numberDisp + '</div>' +
                    '<div class="card-svg-icon">' + svgIcon + '</div>' +
                    '<div class="card-divider"></div>' +
                    '<div class="card-name">' + nameDisp + '</div>' +
                    '<div class="card-name-en">' + nameEnDisp + '</div>' +
                    '</div>';
            }

            let backFaceHTML;
            if (isCustomBack) {
                backFaceHTML = `<div class="card-face card-back-face" style="display:flex; align-items:center; justify-content:center; overflow:hidden; background-color:#2a1a3a;">
                    <img src="${divineState.backImageData}" alt="牌背">
                </div>`;
            } else {
                const divDeck = deckListData.find(d => d.id === divineState.deckId);
                const divDeckName = divDeck ? divDeck.name : '';
                const isIChingDeck = divDeck && divDeck.id === 'iching';
                const divBackColor = divDeck ? (divDeck.backColor || 'var(--theme-card-back)') : 'var(--theme-card-back)';
                backFaceHTML = `<div class="card-face card-back-face${isIChingDeck ? ' iching-back' : ''}" style="background: ${divBackColor};">
                    <div class="back-border"></div>
                    <div class="back-center-icon">${getBuiltInDeckBackSVG(divDeck ? divDeck.id : null)}</div>
                    <div class="back-deck-name">${divDeckName}</div>
                </div>`;
            }

            // ---- 创建卡片 DOM ----
            const cardEl = document.createElement('div');
            cardEl.className = 'reading-card' + (isReversed ? ' reversed' : '') + (isCustomBack ? ' natural-back' : '');
            cardEl.setAttribute('data-reading-id', readingId);
            cardEl.draggable = true;

            cardEl.innerHTML = '<div class="card-inner">' +
                backFaceHTML +
                frontFaceHTML +
                '</div>';

            // ---- 周易牌组：用 cloneNode(true) 克隆缓存 DOM，保留 SVG xmlns 命名空间 ----
            if (_ichCacheThumb) {
                const frontFace = cardEl.querySelector('.card-front-face.card-thumb');
                if (frontFace) {
                    const clone = _ichCacheThumb.cloneNode(true);
                    frontFace.replaceChildren(...clone.childNodes);
                    frontFace.style.background = _ichCacheThumb.style.background;
                }
            }

            // ---- 牌背自然尺寸适配（异步加载图片取宽高，然后同步重置卡片盒模型） ----
            if (isCustomBack) {
                const backImg = cardEl.querySelector('.card-back-face img');
                if (backImg) {
                    // 图片大概率已在浏览器缓存中，onload 几乎同步触发
                    backImg.onload = function() {
                        naturalizeCardSize(cardEl, backImg.naturalWidth, backImg.naturalHeight);
                    };
                    // 如果已经加载完成（complete=true 且 naturalWidth>0），直接应用
                    if (backImg.complete && backImg.naturalWidth > 0) {
                        naturalizeCardSize(cardEl, backImg.naturalWidth, backImg.naturalHeight);
                    }
                }
            }

            // Click to flip（移动端 touchend 也会触发 click，用 _lastTouchTime 去重）
            cardEl._lastTouchTime = 0;
            cardEl.addEventListener('click', function(e) {
                if (Date.now() - cardEl._lastTouchTime < 400) return;
                if (cardEl.classList.contains('dragging')) return;
                cardEl.classList.toggle('flipped');
            });

            // Drag support
            cardEl.addEventListener('dragstart', function(e) {
                cardEl.classList.add('dragging');
                e.dataTransfer.setData('text/plain', readingId);
                e.dataTransfer.effectAllowed = 'move';
            });
            cardEl.addEventListener('dragend', function(e) {
                cardEl.classList.remove('dragging');
            });

            // Touch drag support
            let touchStartX, touchStartY, touchStartTime;
            let origLeft, origTop;
            let isDragging = false;

            cardEl.addEventListener('touchstart', function(e) {
                if (e.touches.length !== 1) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                origLeft = cardEl.offsetLeft;
                origTop = cardEl.offsetTop;
                isDragging = false;
            }, { passive: true });

            cardEl.addEventListener('touchmove', function(e) {
                if (e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - touchStartX;
                const dy = e.touches[0].clientY - touchStartY;
                if (!isDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                    isDragging = true;
                    cardEl.classList.add('dragging');
                    cardEl.style.position = 'relative';
                    cardEl.style.zIndex = '20';
                }
                if (isDragging) {
                    cardEl.style.left = (dx) + 'px';
                    cardEl.style.top = (dy) + 'px';
                }
            }, { passive: true });

            cardEl.addEventListener('touchend', function(e) {
                if (!isDragging) {
                    // Was a tap, flip the card
                    if (Date.now() - touchStartTime < 300) {
                        cardEl.classList.toggle('flipped');
                        cardEl._lastTouchTime = Date.now();
                    }
                } else {
                    // Snap back
                    cardEl.classList.remove('dragging');
                    cardEl.style.position = '';
                    cardEl.style.left = '';
                    cardEl.style.top = '';
                    cardEl.style.zIndex = '';
                }
                isDragging = false;
            });

            area.appendChild(cardEl);

            // Reading area drop handler
            area.addEventListener('dragover', function(e) { e.preventDefault(); });
            area.addEventListener('drop', function(e) {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedEl = area.querySelector('[data-reading-id="' + draggedId + '"]');
                if (!draggedEl) return;
                const cards = [...area.querySelectorAll('.reading-card')].filter(c => c !== draggedEl);
                const dropX = e.clientX;
                let targetAfter = null;
                for (const c of cards) {
                    const rect = c.getBoundingClientRect();
                    if (dropX > rect.left + rect.width / 2) {
                        targetAfter = c;
                    } else {
                        break;
                    }
                }
                if (targetAfter) {
                    area.insertBefore(draggedEl, targetAfter.nextSibling);
                } else {
                    area.insertBefore(draggedEl, area.firstChild);
                }
            });
        }


        function revealAllCards() {
            const area = document.getElementById('reading-area');
            const cards = area.querySelectorAll('.reading-card');
            cards.forEach(c => c.classList.add('flipped'));

            // 记录自由抽取结果
            if (divineState.isDivineActive && divineState.drawnCards.length > 0 && !divineState._saved) {
                var deck = deckListData.find(function(d) { return d.id === divineState.deckId; });
                var spread;
                if (divineState.spreadId) {
                    spread = spreadListData.find(function(s) { return s.id === divineState.spreadId; });
                }
                if (!spread) {
                    spread = { id: 'free', name: '自由抽取', cardCount: divineState.drawnCards.length, positions: null };
                }
                if (deck && typeof window._saveDivineRecord === 'function') {
                    var drawnCards = divineState.drawnCards.map(function(d) {
                        var card = d.cardData;
                        card = card || {};
                        card.isReversed = d.reversed;
                        return card;
                    });
                    window._saveDivineRecord(deck, spread, drawnCards, divineState.reversedEnabled, 'free', divineState.question);
                    divineState._saved = true;
                }
            }
        }

        function reshuffleDeck() {
            if (!divineState.isDivineActive || divineState.shuffledCards.length === 0) return;

            // 重新洗牌前若已抽牌但未保存，先保存当前记录
            if (divineState.drawnCards.length > 0 && !divineState._saved) {
                divineState._saved = true;
                var _rsDeck = deckListData.find(function(d) { return d.id === divineState.deckId; });
                var _rsSpread;
                if (divineState.spreadId) {
                    _rsSpread = spreadListData.find(function(s) { return s.id === divineState.spreadId; });
                }
                if (!_rsSpread) {
                    _rsSpread = { id: 'free', name: '自由抽取', cardCount: divineState.drawnCards.length, positions: null };
                }
                if (_rsDeck && typeof window._saveDivineRecord === 'function') {
                    var _rsDrawn = divineState.drawnCards.map(function(d) {
                        var c = d.cardData || {};
                        c.isReversed = d.reversed;
                        return c;
                    });
                    window._saveDivineRecord(_rsDeck, _rsSpread, _rsDrawn, divineState.reversedEnabled, 'free', divineState.question);
                }
            }

            // Show shuffle animation
            const shuffleOverlay = document.getElementById('shuffling-overlay');
            shuffleOverlay.style.display = 'flex';
            setTimeout(() => {
                divineState.shuffledCards = fisherYatesShuffle(divineState.shuffledCards);
                divineState.drawnCards = [];
                divineState.readingCardIdCounter = 0;
                divineState._saved = false;
                shuffleOverlay.style.display = 'none';
                document.getElementById('divine-result-footer').style.display = 'none';
                renderFan();
                clearReadingArea();
            }, 800);
        }

        function resetDivine() {
            // 重置前若已抽牌但未保存，先保存当前记录
            if (divineState.drawnCards.length > 0 && !divineState._saved) {
                divineState._saved = true;
                var _rzDeck = deckListData.find(function(d) { return d.id === divineState.deckId; });
                var _rzSpread;
                if (divineState.spreadId) {
                    _rzSpread = spreadListData.find(function(s) { return s.id === divineState.spreadId; });
                }
                if (!_rzSpread) {
                    _rzSpread = { id: 'free', name: '自由抽取', cardCount: divineState.drawnCards.length, positions: null };
                }
                if (_rzDeck && typeof window._saveDivineRecord === 'function') {
                    var _rzDrawn = divineState.drawnCards.map(function(d) {
                        var c = d.cardData || {};
                        c.isReversed = d.reversed;
                        return c;
                    });
                    window._saveDivineRecord(_rzDeck, _rzSpread, _rzDrawn, divineState.reversedEnabled, 'free', divineState.question);
                }
            }

            divineState.drawnCards = [];
            divineState.readingCardIdCounter = 0;
            divineState.isDivineActive = false;
            divineState.shuffledCards = [];
            divineState.backImageData = null;
            divineState._saved = false;
            document.getElementById('fan-scroll-container').innerHTML = '';
            document.getElementById('reading-area').innerHTML = '<div class="placeholder-text">请先点击设置按钮开始抽牌</div>';
            document.getElementById('divine-result-footer').style.display = 'none';
            openDivineConfig();
        }

        function onDivineBack() {
            // 返回首页前若已抽牌但未保存，先保存当前记录
            if (divineState.drawnCards.length > 0 && !divineState._saved) {
                divineState._saved = true;
                var _dbDeck = deckListData.find(function(d) { return d.id === divineState.deckId; });
                var _dbSpread;
                if (divineState.spreadId) {
                    _dbSpread = spreadListData.find(function(s) { return s.id === divineState.spreadId; });
                }
                if (!_dbSpread) {
                    _dbSpread = { id: 'free', name: '自由抽取', cardCount: divineState.drawnCards.length, positions: null };
                }
                if (_dbDeck && typeof window._saveDivineRecord === 'function') {
                    var _dbDrawn = divineState.drawnCards.map(function(d) {
                        var c = d.cardData || {};
                        c.isReversed = d.reversed;
                        return c;
                    });
                    window._saveDivineRecord(_dbDeck, _dbSpread, _dbDrawn, divineState.reversedEnabled, 'free', divineState.question);
                }
            }
            divineState.drawnCards = [];
            divineState.readingCardIdCounter = 0;
            divineState.isDivineActive = false;
            divineState.shuffledCards = [];
            divineState.backImageData = null;
            divineState._saved = false;
            document.getElementById('fan-scroll-container').innerHTML = '';
            document.getElementById('reading-area').innerHTML = '<div class="placeholder-text">请先点击设置按钮开始抽牌</div>';
            document.getElementById('divine-result-footer').style.display = 'none';
            switchPage('page-home');
        }

        // ================================================
