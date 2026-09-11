        // 14. 牌阵列表渲染
        // ================================================
        function renderSpreadList() {
            const container = document.getElementById('spread-list');
            if (!container) return;

            if (spreadListData.length === 0) {
                container.innerHTML = `
                            <div class="empty-state">
                                <i class="fa-solid fa-cards"></i>
                                <p>暂无牌阵</p>
                                <p class="sub">点击「创建牌阵」设计你的专属牌阵</p>
                            </div>
                        `;
                document.getElementById('spread-count-label').textContent = '0 个牌阵';
                return;
            }

            document.getElementById('spread-count-label').textContent = spreadListData.length + ' 个牌阵';

            container.innerHTML = spreadListData.map((spread, index) => {
                const tagColors = ['theme-tag', 'theme-tag', 'theme-tag',
                    'theme-tag', 'theme-tag', 'theme-tag'
                ];
                const tagsHtml = spread.tags.map((t, i) =>
                    `<span class="text-[10px] ${tagColors[i % tagColors.length]} px-2 py-0.5 rounded-full">${t}</span>`
                ).join(' ');

                const borderColors = ['theme-accent-border', 'theme-accent-border', 'theme-accent-border', 'theme-accent-border',
                    'theme-accent-border', 'theme-accent-border'
                ];
                const borderColor = borderColors[index % borderColors.length];

                const posSummary = spread.positions.slice(0, 3).join(' · ') + (spread.positions.length > 3 ? ' …' : '');

                return `
                            <div class="p-4 rounded-xl flex flex-col ${borderColor} cursor-pointer hover:shadow-md transition-shadow spread-item relative" data-spread-id="${spread.id}">
                                <div class="flex items-start justify-between">
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <p class="text-sm font-medium text-dark-text truncate">${spread.name}</p>
                                            <span class="text-[10px] text-light-text/40">${spread.nameEn}</span>
                                            <span class="text-[10px] bg-primary/10 text-primary/80 px-1.5 py-0.5 rounded-full">${spread.cardCount}张</span>
                                        </div>
                                        <p class="text-xs text-light-text mt-0.5 line-clamp-1">${spread.description}</p>
                                        <div class="flex flex-wrap gap-1 mt-2">
                                            ${tagsHtml}
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-2 text-[10px] text-light-text/50 flex items-center gap-2">
                                    <span>牌位：${posSummary}</span>
                                    <span>·</span>
                                    <span>${spread.scene}</span>
                                </div>
                                <button class="delete-btn absolute top-3 right-3" onclick="deleteSpread('${spread.id}', event)" title="删除牌阵">
                                    <i class="fa-solid fa-trash-can text-sm"></i>
                                </button>
                            </div>
                        `;
            }).join('');

            container.querySelectorAll('.spread-item').forEach(el => {
                const spreadId = el.dataset.spreadId;
                el.addEventListener('click', function(e) {
                    if (e.target.closest('.delete-btn')) return;
                    openSpreadDetail(spreadId);
                });
            });
        }

        // ================================================
        // 15. 牌阵排序
        // ================================================
        function sortSpreads(mode) {
            currentSpreadSort = mode;
            document.querySelectorAll('#page-spreads .sort-btn').forEach(btn => {
                btn.classList.toggle('active-sort', btn.dataset.sort === mode);
            });

            const sorted = [...spreadListData];
            switch (mode) {
                case 'default':
                    sorted.sort((a, b) => {
                        const idxA = baseSpreads.findIndex(s => s.id === a.id);
                        const idxB = baseSpreads.findIndex(s => s.id === b.id);
                        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                    });
                    break;
                case 'name-asc':
                    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
                    break;
                case 'name-desc':
                    sorted.sort((a, b) => b.name.localeCompare(a.name, 'zh'));
                    break;
                case 'count':
                    sorted.sort((a, b) => a.cardCount - b.cardCount);
                    break;
                default:
                    break;
            }
            spreadListData = sorted;
            renderSpreadList();
        }

        // ================================================
        // 16. 删除牌阵
        // ================================================
        function deleteSpread(spreadId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const spread = spreadListData.find(s => s.id === spreadId);
            if (!spread) return;
            if (!confirm(`确定要删除牌阵「${spread.name}」吗？此操作不可撤销。`)) return;

            const detailPage = document.getElementById('page-spread-detail');
            if (detailPage && detailPage.classList.contains('active')) {
                const titleEl = document.getElementById('spread-detail-title');
                if (titleEl && titleEl.textContent === spread.name) {
                    switchPage('page-spreads');
                }
            }

            spreadListData = spreadListData.filter(s => s.id !== spreadId);
            saveDecksToStorage();
            renderSpreadList();
        }

        // ================================================
        // 17. 牌阵详情
        // ================================================
        function openSpreadDetail(spreadId) {
            const spread = spreadListData.find(s => s.id === spreadId);
            if (!spread) {
                alert('该牌阵已不存在');
                switchPage('page-spreads');
                return;
            }

            document.getElementById('spread-detail-title').textContent = spread.name;
            document.getElementById('spread-detail-sub').textContent = `${spread.nameEn} · ${spread.cardCount}张牌`;
            document.getElementById('spread-detail-count').textContent = spread.cardCount;

            const container = document.getElementById('spread-detail-content');

            const tagColors = ['theme-tag', 'theme-tag', 'theme-tag',
                'theme-tag', 'theme-tag', 'theme-tag'
            ];
            const tagsHtml = spread.tags.map((t, i) =>
                `<span class="text-[10px] ${tagColors[i % tagColors.length]} px-2 py-0.5 rounded-full">${t}</span>`
            ).join(' ');

            const positionsHtml = spread.positions.map((pos, i) =>
                `<div class="pos-item">
                            <div class="pos-badge">${i + 1}</div>
                            <div><span class="pos-label">${pos}</span></div>
                        </div>`
            ).join('');

            const detailParagraphs = spread.detail.split('\n\n').map(p => `<p>${p}</p>`).join('');

            container.innerHTML = `
                        <div class="spread-detail-section">
                            <h4><i class="fa-solid fa-info-circle text-primary"></i> 牌阵介绍</h4>
                            <p>${spread.description}</p>
                            <div class="flex flex-wrap gap-1 mt-3">${tagsHtml}</div>
                        </div>

                        <div class="spread-detail-section">
                            <h4><i class="fa-solid fa-layer-group text-primary"></i> 牌位说明</h4>
                            <div class="mt-1">${positionsHtml}</div>
                        </div>

                        <div class="spread-detail-section">
                            <h4><i class="fa-solid fa-compass text-primary"></i> 详解</h4>
                            ${detailParagraphs}
                        </div>

                        <div class="spread-detail-section">
                            <h4><i class="fa-solid fa-bolt text-primary"></i> 适用场景</h4>
                            <p>${spread.scene}</p>
                        </div>
                    `;

            switchPage('page-spread-detail');

            const detailPage = document.getElementById('page-spread-detail');
            if (detailPage) detailPage.scrollTop = 0;

            setTimeout(() => {
                const backBtn = document.getElementById('back-to-top-spread');
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
        // 18. 创建牌阵 - 动态牌位
        // ================================================
        function updatePositionFields() {
            const countInput = document.getElementById('spread-count-input');
            const container = document.getElementById('position-fields');
            if (!countInput || !container) return;

            let count = parseInt(countInput.value) || 3;
            if (count < 1) count = 1;
            if (count > 12) count = 12;
            countInput.value = count;

            const existingInputs = container.querySelectorAll('.position-input-group input');
            const existingNames = [];
            existingInputs.forEach(inp => {
                if (inp.value.trim()) existingNames.push(inp.value.trim());
            });

            let html = '';
            for (let i = 0; i < count; i++) {
                const defaultValue = existingNames[i] || `位置 ${i + 1}`;
                html += `
                            <div class="position-input-group">
                                <div class="pos-num">${i + 1}</div>
                                <input type="text" class="pos-name-input" placeholder="牌位名称（如：过去）" value="${defaultValue}">
                            </div>
                        `;
            }
            container.innerHTML = html;
        }

        // ================================================
        // 19. 确认创建牌阵
        // ================================================
        function confirmCreateSpread() {
            const nameInput = document.getElementById('spread-name-input');
            const nameEnInput = document.getElementById('spread-name-en-input');
            const descInput = document.getElementById('spread-desc-input');
            const detailInput = document.getElementById('spread-detail-input');
            const countInput = document.getElementById('spread-count-input');
            const tagsInput = document.getElementById('spread-tags-input');
            const sceneInput = document.getElementById('spread-scene-input');

            const name = nameInput.value.trim();
            if (!name) {
                alert('请输入牌阵名称');
                nameInput.focus();
                return;
            }

            const nameEn = nameEnInput.value.trim() || 'Custom Spread';
            const description = descInput.value.trim() || '自定义牌阵';
            const detail = detailInput.value.trim() || '暂无详解';
            const count = parseInt(countInput.value) || 3;
            const tags = tagsInput.value.trim() ? tagsInput.value.split(',').map(t => t.trim()) : ['自定义'];
            const scene = sceneInput.value.trim() || '通用场景';

            const posInputs = document.querySelectorAll('#position-fields .pos-name-input');
            const positions = [];
            posInputs.forEach(inp => {
                const val = inp.value.trim();
                if (val) positions.push(val);
            });

            if (positions.length === 0) {
                alert('请至少填写一个牌位名称');
                return;
            }

            const newSpread = {
                id: 'custom_' + Date.now(),
                name: name,
                nameEn: nameEn,
                description: description,
                detail: detail,
                cardCount: positions.length,
                positions: positions,
                tags: tags,
                scene: scene,
                usage: 0,
                createdAt: new Date().toISOString().slice(0, 10)
            };

            spreadListData.push(newSpread);
            saveDecksToStorage();
            renderSpreadList();
            switchPage('page-spreads');

            // 清空表单
            nameInput.value = '';
            nameEnInput.value = '';
            descInput.value = '';
            detailInput.value = '';
            tagsInput.value = '';
            sceneInput.value = '';
            countInput.value = '3';
            updatePositionFields();
        }

        // ================================================
