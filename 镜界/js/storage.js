        // 25. 持久化存储 (IndexedDB — 突破 localStorage 5MB 限制)
        // ================================================
        const DB_NAME = 'mirror_world_db';
        const DB_VERSION = 1;
        const STORE_NAME = 'custom_data';
        const STORAGE_KEY = 'mirror_world_custom_data'; // 仅用于旧数据迁移

        function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
                request.onsuccess = (event) => resolve(event.target.result);
                request.onerror = (event) => reject(event.target.error);
            });
        }

        async function saveDecksToStorage() {
            try {
                const customDecks = deckListData.filter(d => d.id.startsWith('custom_'));
                const customSpreads = spreadListData.filter(s => s.id.startsWith('custom_'));
                const db = await openDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ id: 'decks', data: customDecks });
                store.put({ id: 'spreads', data: customSpreads });
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
                db.close();
            } catch (e) {
                console.warn('IndexedDB 保存失败:', e.message);
                // 尝试降级到 localStorage（仅当数据量小时可能成功）
                try {
                    const customDecks = deckListData.filter(d => d.id.startsWith('custom_'));
                    const customSpreads = spreadListData.filter(s => s.id.startsWith('custom_'));
                    const payload = JSON.stringify({ decks: customDecks, spreads: customSpreads });
                    if (payload.length < 5 * 1024 * 1024) {
                        localStorage.setItem(STORAGE_KEY, payload);
                    }
                } catch (e2) {
                    console.warn('localStorage 降级也失败:', e2.message);
                }
                alert('⚠️ 牌组保存失败，可能存储空间不足。\n\n建议：\n1. 减少牌组中图片的数量或尺寸\n2. 清理浏览器存储空间\n3. 刷新后重新创建');
            }
        }

        async function loadDecksFromStorage() {
            // 第一步：尝试从 localStorage 迁移旧数据到 IndexedDB
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    const hasDecks = data.decks && Array.isArray(data.decks) && data.decks.length > 0;
                    const hasSpreads = data.spreads && Array.isArray(data.spreads) && data.spreads.length > 0;
                    if (hasDecks || hasSpreads) {
                        const db = await openDB();
                        const tx = db.transaction(STORE_NAME, 'readwrite');
                        const store = tx.objectStore(STORE_NAME);
                        if (hasDecks) store.put({ id: 'decks', data: data.decks });
                        if (hasSpreads) store.put({ id: 'spreads', data: data.spreads || [] });
                        await new Promise((resolve, reject) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                        });
                        db.close();
                        localStorage.removeItem(STORAGE_KEY);
                        console.log('已从 localStorage 迁移 ' + (data.decks ? data.decks.length : 0) + ' 个牌组到 IndexedDB');
                    }
                }
            } catch (e) {
                console.warn('localStorage 迁移失败:', e.message);
            }

            // 第二步：从 IndexedDB 加载持久化数据
            try {
                const db = await openDB();
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);

                const decksReq = store.get('decks');
                const spreadsReq = store.get('spreads');

                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });

                const decksResult = decksReq.result;
                const spreadsResult = spreadsReq.result;
                db.close();

                if (decksResult && decksResult.data && Array.isArray(decksResult.data)) {
                    decksResult.data.forEach(d => {
                        if (!deckListData.find(e => e.id === d.id)) {
                            deckListData.push(d);
                        }
                    });
                }
                if (spreadsResult && spreadsResult.data && Array.isArray(spreadsResult.data)) {
                    spreadsResult.data.forEach(s => {
                        if (!spreadListData.find(e => e.id === s.id)) {
                            spreadListData.push(s);
                        }
                    });
                }
            } catch (e) {
                console.warn('IndexedDB 加载失败:', e.message);
            }

            // 主题颜色迁移：旧自定义牌组中可能残留硬编码颜色，统一替换为 theme-aware 类
            deckListData.forEach(d => {
                if (d.tagColor !== 'theme-tag') d.tagColor = 'theme-tag';
                if (d.borderColor !== 'theme-accent-border') d.borderColor = 'theme-accent-border';
            });

        }

