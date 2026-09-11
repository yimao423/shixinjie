        // 10. 牌组列表渲染 — 修复自定义封面Logo不显示问题
        // ================================================
        function renderDeckList() {
            const container = document.getElementById('deck-list');
            if (!container) return;

            if (deckListData.length === 0) {
                container.innerHTML = `
                            <div class="empty-state">
                                <i class="fa-solid fa-folder-open"></i>
                                <p>暂无牌组</p>
                                <p class="sub">点击「创建牌组」添加你的专属牌组</p>
                            </div>
                        `;
                document.getElementById('deck-count-label').textContent = '0 个牌组';
                return;
            }

            document.getElementById('deck-count-label').textContent = deckListData.length + ' 个牌组';

            container.innerHTML = deckListData.map((deck, index) => {
                const isIChing = deck.id === 'iching';
                const isLenormand = deck.id === 'lenormand';
                
                // 自定义牌组随机图标，基础牌组保持原有图标
                let iconHtml = '';
                let iconClass = deck.icon;
                if (iconClass === 'taiji') {
                    iconHtml = `<div class="taiji-icon">${getTaijiSVG(36)}</div>`;
                } else {
                    // 如果图标不完整，自动补全 fa-solid 前缀
                    if (iconClass && !iconClass.includes('fa-')) {
                        iconClass = 'fa-solid fa-' + iconClass;
                    }
                    iconHtml = `<div class="w-9 h-9 bg-primary-light/70 rounded-lg flex items-center justify-center text-primary/80 text-xl"><i class="${iconClass}"></i></div>`;
                }

                const cardCount = isIChing ? '64' : isLenormand ? '36' : (deck.cards ? deck.cards.length : '78');

                return `
                            <div class="glass-card p-4 rounded-xl flex items-center ${deck.borderColor} cursor-pointer hover:shadow-md transition-shadow deck-item relative group" data-deck-id="${deck.id}">
                                <div class="w-12 h-12 bg-primary-light/30 rounded-lg flex items-center justify-center text-primary/80 flex-shrink-0">
                                    ${iconHtml}
                                </div>
                                <div class="ml-4 flex-1 min-w-0">
                                    <div class="flex justify-between items-start">
                                        <div class="min-w-0 flex-1">
                                            <p class="text-sm font-medium text-dark-text truncate">${deck.name}</p>
                                            <p class="text-[10px] text-light-text truncate">${deck.nameEn}</p>
                                        </div>
                                        <span class="text-[10px] ${deck.tagColor} px-2 py-0.5 rounded-full flex-shrink-0 ml-2">${deck.tag}</span>
                                    </div>
                                    <div class="flex justify-between items-end mt-1">
                                        <p class="text-[10px] text-light-text truncate max-w-[60%]">${deck.desc}</p>
                                        <span class="text-[10px] text-light-text ml-2 flex-shrink-0">${cardCount}张</span>
                                    </div>
                                </div>
                                <button class="delete-btn" onclick="deleteDeck('${deck.id}', event)" title="删除牌组">
                                    <i class="fa-solid fa-trash-can text-sm"></i>
                                </button>
                            </div>
                        `;
            }).join('');

            container.querySelectorAll('.deck-item').forEach(el => {
                const deckId = el.dataset.deckId;
                el.addEventListener('click', function(e) {
                    if (e.target.closest('.delete-btn')) return;
                    openDeckDetail(deckId);
                });
            });
        }

        // ================================================
        // 11. 牌组排序 & 删除 — 保留原样
        // ================================================
        function sortDecks(mode) {
            currentSort = mode;
            document.querySelectorAll('.sort-btn').forEach(btn => {
                btn.classList.toggle('active-sort', btn.dataset.sort === mode);
            });

            const sorted = [...deckListData];
            switch (mode) {
                case 'default':
                    sorted.sort((a, b) => {
                        const idxA = baseDecks.findIndex(d => d.id === a.id);
                        const idxB = baseDecks.findIndex(d => d.id === b.id);
                        return idxA - idxB;
                    });
                    break;
                case 'name-asc':
                    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
                    break;
                case 'name-desc':
                    sorted.sort((a, b) => b.name.localeCompare(a.name, 'zh'));
                    break;
                default:
                    break;
            }
            deckListData = sorted;
            renderDeckList();
        }

        function deleteDeck(deckId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const deck = deckListData.find(d => d.id === deckId);
            if (!deck) return;
            if (!confirm(`确定要删除牌组「${deck.name}」吗？此操作不可撤销。`)) return;

            const detailPage = document.getElementById('page-deck-detail');
            if (detailPage && detailPage.classList.contains('active')) {
                const titleEl = document.getElementById('deck-detail-title');
                if (titleEl && titleEl.textContent === deck.name) {
                    switchPage('page-decks');
                }
            }

            deckListData = deckListData.filter(d => d.id !== deckId);
            saveDecksToStorage();
            renderDeckList();
        }

        // ================================================
        // 12. 牌组详情 — 保留原样 (支持自定义牌组)
        // ================================================
        // 自定义牌组翻转：首次翻转时切换到原图
        function flipCustomCard(el, event) {
            el.classList.toggle('flipped');
            const fullSrc = el.getAttribute('data-full-src');
            const img = el.querySelector('.flip-card-front img');
            if (fullSrc && img && img.src !== fullSrc) {
                img.src = fullSrc;
            }
        }

        function openDeckDetail(deckId) {
            const deck = deckListData.find(d => d.id === deckId);
            if (!deck) {
                alert('该牌组已不存在');
                switchPage('page-decks');
                return;
            }

            document.getElementById('deck-detail-title').textContent = deck.name;
            document.getElementById('deck-detail-sub').textContent = `${deck.nameEn} · 点击牌面翻转查看牌背`;

            const grid = document.getElementById('deck-grid');

            const isIChing = deck.id === 'iching';
            const isLenormand = deck.id === 'lenormand';

            let count = 0;
            let cards = [];

            if (isIChing) {
                count = 64;
                cards = ichingData.map((hex, index) => ({
                    id: index,
                    name: hex.name,
                    nameEn: hex.judgment,
                    isMajor: false,
                    suitName: null,
                    upperElement: hex.upperElement,
                    lowerElement: hex.lowerElement
                }));
            } else if (isLenormand) {
                count = 36;
                cards = lenormandCards.map((card, index) => ({
                    id: index,
                    name: card.name,
                    nameEn: card.nameEn,
                    emoji: card.emoji,
                    keyword: card.keyword,
                    isMajor: false,
                    suitName: null
                }));
            } else if (deck.data) {
                count = deck.data.cards.length;
                cards = deck.data.cards;
            } else if (deck.cards && deck.cards.length > 0) {
                count = deck.cards.length;
                cards = deck.cards;
            } else {
                cards = [];
            }

            document.getElementById('deck-detail-count').textContent = count;

            const isCustomDeck = deck.cards && deck.cards.length > 0 && deck.cards[0].imageData;
            const isBackImage = isCustomDeck && deck.backImageData;

            grid.innerHTML = cards.map((card, idx) => {
                if (isCustomDeck) {
                    const numberDisplay = card.tarotNumber || String(idx + 1);
                    const frontAspect = deck.cards && deck.cards[0] ? '' : '';
                    const backHTML = isBackImage
                        ? `<div class="flip-card-back" style="display:flex; align-items:center; justify-content:center; overflow:hidden;"><img src="${deck.backImageData}" alt="牌背" style="width:100%; height:100%; object-fit:cover; border-radius:16px; display:block;"></div>`
                        : `<div class="flip-card-back" style="background: ${deck.backColor || 'linear-gradient(135deg, #CBE8F4 0%, #B3D9EC 30%, #C5E4F2 60%, #B8DEEE 100%)'};"><div class="back-border"></div><div class="back-center-icon"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#8B7355" stroke-width="0.8" opacity="0.4"/><circle cx="50" cy="50" r="41" fill="none" stroke="#A0916E" stroke-width="0.3" stroke-dasharray="3 5.8" opacity="0.3"/><circle cx="50" cy="50" r="38" fill="none" stroke="#8B7355" stroke-width="0.5" opacity="0.25"/><g stroke="#8B7355" stroke-width="1" opacity="0.35"><line x1="16" y1="30" x2="21" y2="30"/><line x1="26" y1="30" x2="31" y2="30"/><line x1="16" y1="35" x2="21" y2="35"/><line x1="26" y1="35" x2="31" y2="35"/><line x1="16" y1="40" x2="21" y2="40"/><line x1="26" y1="40" x2="31" y2="40"/><line x1="16" y1="60" x2="21" y2="60"/><line x1="26" y1="60" x2="31" y2="60"/><line x1="16" y1="65" x2="21" y2="65"/><line x1="26" y1="65" x2="31" y2="65"/><line x1="16" y1="70" x2="21" y2="70"/><line x1="26" y1="70" x2="31" y2="70"/></g><g stroke="#8B7355" stroke-width="1" opacity="0.35"><line x1="69" y1="30" x2="84" y2="30"/><line x1="69" y1="35" x2="84" y2="35"/><line x1="69" y1="40" x2="84" y2="40"/><line x1="69" y1="60" x2="84" y2="60"/><line x1="69" y1="65" x2="84" y2="65"/><line x1="69" y1="70" x2="84" y2="70"/></g><circle cx="50" cy="50" r="16" fill="none" stroke="#8B7355" stroke-width="1.8"/><path d="M50,34 A16,16 0 0,1 50,66 A8,8 0 0,0 50,50 A8,8 0 0,1 50,34Z" fill="#8B7355" opacity="0.25"/><circle cx="50" cy="42" r="2" fill="#8B7355" opacity="0.55"/><circle cx="50" cy="58" r="2" fill="#C4B594" opacity="0.6"/><circle cx="50" cy="50" r="1.5" fill="#8B7355" opacity="0.3"/></svg></div><div class="back-deck-name">${deck.name}</div></div>`;
                    return `
                        <div class="flip-card-scene-custom" data-card-id="${card.id}" data-full-src="${card.imageData}" onclick="flipCustomCard(this, event)">
                            <div class="flip-card-inner">
                                <div class="flip-card-front" style="background: #f1f5f9; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:0; overflow:hidden;">
                                    <img src="${card.thumbData || card.imageData}" alt="${card.name || '未命名'}" style="width:100%; height:auto; object-fit:contain; display:block; border-radius:14px;" loading="lazy">
                                    <div class="card-number" style="position:absolute; top:6px; left:8px; font-size:10px; font-weight:600; color:rgba(255,255,255,0.9); text-shadow:0 2px 8px rgba(0,0,0,0.6); font-variant-numeric:tabular-nums;">${numberDisplay}</div>
                                </div>
                                ${backHTML}
                            </div>
                        </div>
                    `;
                }

                const bgGradient = isIChing ?
                    getCardGradient(false, null, 'iching', card.id) :
                    isLenormand ?
                    getCardGradient(false, null, 'lenormand', card.id) :
                    getCardGradient(card.isMajor, card.suitName, null, null);

                const numberDisplay = isIChing ? String(idx + 1) : isLenormand ? String(idx + 1) : (card.tarotNumber || '');

                let suitBadge = '';
                if (card.suitName && !card.isMajor && !isIChing && !isLenormand) {
                    suitBadge = `<div class="card-suit-badge">${card.suitName}</div>`;
                }

                let frontContent = '';
                if (isLenormand) {
                    frontContent = `
                        <div class="card-number">${numberDisplay}</div>
                        <div class="card-svg-icon">${getLenormandSVG(card.id)}</div>
                        <div class="card-divider"></div>
                        <div class="card-name">${card.name}</div>
                        <div class="card-name-en">${card.nameEn}</div>
                        <div class="card-keyword">${card.keyword}</div>
                    `;
                } else {
                    const svgContent = getCardSVG(card.id, card.suitName, card.isMajor, deck.id);
                    frontContent = `
                        <div class="card-number">${numberDisplay}</div>
                        <div class="card-svg-icon">${svgContent}</div>
                        <div class="card-divider"></div>
                        <div class="card-name">${card.name}</div>
                        <div class="card-name-en">${card.nameEn}</div>
                        ${suitBadge}
                    `;
                }

                return `
                    <div class="flip-card-scene" data-card-id="${card.id}" onclick="this.classList.toggle('flipped')">
                        <div class="flip-card-inner">
                            <div class="flip-card-front card-thumb" style="background: ${bgGradient};">
                                ${frontContent}
                            </div>
                            <div class="flip-card-back${deck.id === 'iching' ? ' iching-back' : ''}" style="background: ${deck.backColor || 'linear-gradient(135deg, #CBE8F4 0%, #B3D9EC 30%, #C5E4F2 60%, #B8DEEE 100%)'};">
                                <div class="back-border"></div>
                                <div class="back-center-icon">
                                    ${deck.id === 'iching' ? getIChingBackSVG() : '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#8B7355" stroke-width="0.8" opacity="0.4"/><circle cx="50" cy="50" r="41" fill="none" stroke="#A0916E" stroke-width="0.3" stroke-dasharray="3 5.8" opacity="0.3"/><circle cx="50" cy="50" r="38" fill="none" stroke="#8B7355" stroke-width="0.5" opacity="0.25"/><g stroke="#8B7355" stroke-width="1" opacity="0.35"><line x1="16" y1="30" x2="21" y2="30"/><line x1="26" y1="30" x2="31" y2="30"/><line x1="16" y1="35" x2="21" y2="35"/><line x1="26" y1="35" x2="31" y2="35"/><line x1="16" y1="40" x2="21" y2="40"/><line x1="26" y1="40" x2="31" y2="40"/><line x1="16" y1="60" x2="21" y2="60"/><line x1="26" y1="60" x2="31" y2="60"/><line x1="16" y1="65" x2="21" y2="65"/><line x1="26" y1="65" x2="31" y2="65"/><line x1="16" y1="70" x2="21" y2="70"/><line x1="26" y1="70" x2="31" y2="70"/></g><g stroke="#8B7355" stroke-width="1" opacity="0.35"><line x1="69" y1="30" x2="84" y2="30"/><line x1="69" y1="35" x2="84" y2="35"/><line x1="69" y1="40" x2="84" y2="40"/><line x1="69" y1="60" x2="84" y2="60"/><line x1="69" y1="65" x2="84" y2="65"/><line x1="69" y1="70" x2="84" y2="70"/></g><circle cx="50" cy="50" r="16" fill="none" stroke="#8B7355" stroke-width="1.8"/><path d="M50,34 A16,16 0 0,1 50,66 A8,8 0 0,0 50,50 A8,8 0 0,1 50,34Z" fill="#8B7355" opacity="0.25"/><circle cx="50" cy="42" r="2" fill="#8B7355" opacity="0.55"/><circle cx="50" cy="58" r="2" fill="#C4B594" opacity="0.6"/><circle cx="50" cy="50" r="1.5" fill="#8B7355" opacity="0.3"/></svg>'}
                                </div>
                                <div class="back-deck-name">${deck.name}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            switchPage('page-deck-detail');

            const detailPage = document.getElementById('page-deck-detail');
            if (detailPage) detailPage.scrollTop = 0;

            setTimeout(() => {
                const backBtn = document.getElementById('back-to-top');
                if (detailPage) {
                    detailPage.addEventListener('scroll', function() {
                        if (this.scrollTop > 300) {
                            backBtn.classList.add('visible');
                        } else {
                            backBtn.classList.remove('visible');
                        }
                    });
                }
            }, 100);
        }

        // ================================================
        // 21. 创建牌组 - 封面选择
        // ================================================
        function selectCover(el) {
            document.querySelectorAll('.cover-option').forEach(opt => opt.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('selected-cover').value = el.dataset.value;
        }

        // ================================================
        // 22. 创建牌组 - 牌背上传处理
        // ================================================
        let backImageData = null;

        function handleBackImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            // 高质压缩牌背图片（1200px, JPEG 0.92）
            compressImagePromise(file, 1200, 0.92).then(dataUrl => {
                backImageData = dataUrl;
                const previewContainer = document.getElementById('back-preview-container');
                const previewImg = document.getElementById('back-preview-img');
                previewContainer.style.display = 'block';
                previewImg.src = backImageData;
                document.getElementById('back-upload-area').style.display = 'none';
            }).catch(() => {
                // 压缩失败回退原始读取
                const reader = new FileReader();
                reader.onload = function(e) {
                    backImageData = e.target.result;
                    const previewContainer = document.getElementById('back-preview-container');
                    const previewImg = document.getElementById('back-preview-img');
                    previewContainer.style.display = 'block';
                    previewImg.src = backImageData;
                    document.getElementById('back-upload-area').style.display = 'none';
                };
                reader.readAsDataURL(file);
            });
        }

        // ================================================
        // 23. 创建牌组 - 牌面上传 (完全支持多选批量)
        // ================================================
        let uploadedCards = [];

        function compressImagePromise(file, maxWidth, quality) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = function() {
                    reject(new Error('FileReader failed'));
                };
                reader.onload = function(e) {
                    const img = new Image();
                    img.onerror = function() {
                        reject(new Error('Image load failed'));
                    };
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        if (width > maxWidth) {
                            const ratio = maxWidth / width;
                            width = maxWidth;
                            height = height * ratio;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        // 从已有 data URL 生成缩略图（轻量二次压缩）
        function compressThumbnailPromise(dataUrl, maxWidth, quality) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onerror = () => reject(new Error('Thumb load failed'));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxWidth) {
                        const r = maxWidth / w;
                        w = maxWidth;
                        h = Math.round(h * r);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = dataUrl;
            });
        }

        async function handleCardFilesUpload(event) {
            const files = event.target.files;
            if (!files || files.length === 0) {
                event.target.value = '';
                return;
            }

            if (uploadedCards.length >= 78) {
                alert('当前牌组已上传 78 张，已达单副牌组上限！');
                event.target.value = '';
                return;
            }

            const fileArray = Array.from(files);
            let canAdd = 78 - uploadedCards.length;
            if (fileArray.length > canAdd) {
                alert('一次最多上传 78 张，当前最多还能上传 ' + canAdd + ' 张，请分批上传。');
                event.target.value = '';
                return;
            }

            // 分批并行处理，每批 4 张，兼顾速度与内存
            const BATCH_SIZE = 4;
            for (let batch = 0; batch < fileArray.length; batch += BATCH_SIZE) {
                const batchFiles = fileArray.slice(batch, batch + BATCH_SIZE);
                const results = await Promise.all(batchFiles.map(async (file) => {
                    if (!file.type.startsWith('image/')) return null;
                    try {
                        const dataUrl = await compressImagePromise(file, 1200, 0.92);
                        let thumbData = null;
                        try {
                            thumbData = await compressThumbnailPromise(dataUrl, 200, 0.6);
                        } catch(e) {
                            console.warn('缩略图生成失败，使用原图:', e);
                        }
                        return {
                            file: file,
                            dataUrl: dataUrl,
                            thumbData: thumbData || dataUrl,
                            name: file.name.replace(/\.[^/.]+$/, ''),
                            comment: ''
                        };
                    } catch (err) {
                        // 压缩失败时回退：直接用 FileReader 读取原始 data URL
                        console.warn('图片压缩失败，使用原始数据:', err);
                        try {
                            const rawDataUrl = await new Promise((resolve, reject) => {
                                const reader2 = new FileReader();
                                reader2.onload = function(ev) { resolve(ev.target.result); };
                                reader2.onerror = function() { reject(new Error('FileReader fallback failed')); };
                                reader2.readAsDataURL(file);
                            });
                            let thumbData = null;
                            try {
                                thumbData = await compressThumbnailPromise(rawDataUrl, 200, 0.6);
                            } catch(e) {}
                            return {
                                file: file,
                                dataUrl: rawDataUrl,
                                thumbData: thumbData || rawDataUrl,
                                name: file.name.replace(/\.[^/.]+$/, ''),
                                comment: ''
                            };
                        } catch (err2) {
                            console.warn('图片处理彻底失败:', err2);
                            return null;
                        }
                    }
                }));
                const valid = results.filter(r => r !== null);
                uploadedCards.push(...valid);
                renderCardUploadList();
            }

            renderCardUploadList();
            event.target.value = '';
        }

        function renderCardUploadList() {
            const container = document.getElementById('card-upload-list');
            const countLabel = document.getElementById('card-upload-count');
            if (!container) return;

            countLabel.textContent = `已上传 ${uploadedCards.length} 张`;

            if (uploadedCards.length === 0) {
                container.innerHTML = `<div class="text-light-text text-xs col-span-full text-center py-4">暂无上传</div>`;
                return;
            }

            container.innerHTML = uploadedCards.map((card, index) => `
                        <div class="card-upload-item" data-index="${index}" draggable="true" ondragstart="handleDragStart.call(this, event)" ondragend="handleDragEnd.call(this, event)" ondragover="handleDragOver.call(this, event)" ondragleave="handleDragLeave.call(this, event)" ondrop="handleDrop.call(this, event)">
                            <img src="${card.dataUrl}" class="thumb" alt="牌面" draggable="false">
                            <div class="card-info">
                                <input type="text" value="${card.name}" onchange="updateCardName(${index}, this.value)" placeholder="牌名">
                                <input type="text" value="${card.comment}" onchange="updateCardComment(${index}, this.value)" placeholder="注释" class="text-[10px] text-light-text">
                            </div>
                            <button class="remove-btn" onclick="removeCard(${index})"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    `).join('');
        }

        function updateCardName(index, value) {
            if (uploadedCards[index]) uploadedCards[index].name = value;
        }

        function updateCardComment(index, value) {
            if (uploadedCards[index]) uploadedCards[index].comment = value;
        }

        function removeCard(index) {
            uploadedCards.splice(index, 1);
            renderCardUploadList();
        }

        // ===== 拖拽排序 =====
        let dragSrcIndex = null;

        function handleDragStart(e) {
            dragSrcIndex = parseInt(this.dataset.index);
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragSrcIndex);
        }

        function handleDragEnd(e) {
            this.classList.remove('dragging');
            document.querySelectorAll('.card-upload-item').forEach(item => {
                item.classList.remove('drag-over');
            });
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const targetIndex = parseInt(this.dataset.index);
            if (targetIndex !== dragSrcIndex) {
                this.classList.add('drag-over');
            }
        }

        function handleDragLeave(e) {
            this.classList.remove('drag-over');
        }

        function handleDrop(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const targetIndex = parseInt(this.dataset.index);
            if (dragSrcIndex !== null && targetIndex !== dragSrcIndex) {
                const movedItem = uploadedCards.splice(dragSrcIndex, 1)[0];
                uploadedCards.splice(targetIndex, 0, movedItem);
            }
            dragSrcIndex = null;
            renderCardUploadList();
        }

        // ================================================
        // 24. 确认创建牌组
        // ================================================
        function confirmCreateDeck() {
            const nameInput = document.getElementById('create-deck-name');
            const name = nameInput.value.trim();
            if (!name) {
                alert('请输入牌组名称');
                nameInput.focus();
                return;
            }

            // 随机生成封面图标
            const iconPool = ['fa-clone', 'fa-compass', 'fa-gem', 'fa-star', 'fa-moon', 'fa-sun', 'fa-feather', 'fa-wand-magic-sparkles', 'fa-scroll', 'fa-crown'];
            const randomIcon = iconPool[Math.floor(Math.random() * iconPool.length)];

            // 随机生成牌背颜色
            const backColorPool = [
                'var(--theme-card-back)',
                'var(--theme-card-back-2)',
                'var(--theme-card-back-3)',
                'var(--theme-card-back-4)',
                'var(--theme-card-back-5)'
            ]
            const randomBackColor = backColorPool[Math.floor(Math.random() * backColorPool.length)];

            // 构建牌组数据
            const deckId = 'custom_' + Date.now();
            const deck = {
                id: deckId,
                name: name,
                nameEn: name + ' Deck',
                desc: '自定义牌组',
                tag: '自定义',
                tagColor: 'theme-tag',
                borderColor: 'theme-accent-border',
                icon: 'fa-solid ' + randomIcon,
                createdAt: new Date().toISOString().slice(0, 10),
                isIChing: false,
                isLenormand: false,
                data: null,
                backColor: randomBackColor,
                backImageData: backImageData,
                cards: uploadedCards.map((card, idx) => ({
                    id: idx,
                    name: card.name || '未命名',
                    nameEn: '',
                    suit: null,
                    suitName: null,
                    rank: null,
                    isMajor: false,
                    isCourt: false,
                    tarotNumber: String(idx + 1),
                    imageData: card.dataUrl,
                    thumbData: card.thumbData || card.dataUrl
                }))
            };

            deckListData.push(deck);
            saveDecksToStorage();
            renderDeckList();
            switchPage('page-decks');

            // 清空表单
            nameInput.value = '';
            uploadedCards = [];
            backImageData = null;
            renderCardUploadList();
            // 重置牌背上传状态
            document.getElementById('back-preview-container').style.display = 'none';
            document.getElementById('back-preview-img').src = '';
            document.getElementById('back-upload-area').style.display = 'flex';
        }

        // ================================================
