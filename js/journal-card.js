/* === 手帐双卡片：相框 + 心情表情 + 留言 === */
const JournalCard = {
  STORAGE_KEY: 'love_journal_card',
  MAX_SLOTS: 4,

  /* 内置仿黄豆表情定义（SVG 路径，24x24 viewBox，跟随 currentColor） */
  EMOJI_TYPES: [
    { id:'smile',   name:'微笑', svg:'<circle cx="7.5" cy="9" r="1.6"/><circle cx="16.5" cy="9" r="1.6"/><path d="M7.5 15 Q12 19 16.5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id:'grin',    name:'大笑', svg:'<path d="M5.5 7.5 Q7.5 5 9.5 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14.5 7.5 Q16.5 5 18.5 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="12" cy="16" rx="4" ry="3" fill="currentColor"/>' },
    { id:'kiss',    name:'亲亲', svg:'<path d="M5.5 7.5 Q7 5.5 8.5 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="9" r="1.6"/><circle cx="12" cy="15.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/>' },
    { id:'cool',    name:'酷酷', svg:'<rect x="4.5" y="7" width="6.5" height="3.5" rx="1.5" fill="currentColor"/><rect x="13" y="7" width="6.5" height="3.5" rx="1.5" fill="currentColor"/><path d="M8 14.5 Q12 16 16 14.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' },
    { id:'tongue',  name:'调皮', svg:'<circle cx="7.5" cy="9" r="1.6"/><circle cx="16.5" cy="9" r="1.6"/><path d="M8 13.5 Q12 10 16 13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="12" cy="17" rx="3.5" ry="2.5" fill="currentColor"/>' },
    { id:'love',    name:'喜欢', svg:'<circle cx="7.5" cy="9" r="1.6"/><circle cx="16.5" cy="9" r="1.6"/><path d="M7.5 15 Q12 19 16.5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="5" cy="6.5" r="1.8" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.5"/><circle cx="19" cy="6.5" r="1.8" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.5"/>' },
    { id:'star',    name:'星星眼', svg:'<polygon points="7.5,6.5 8.3,8.3 10,8.3 8.8,9.5 9.3,11.5 7.5,10.2 5.7,11.5 6.2,9.5 5,8.3 6.7,8.3" fill="currentColor"/><polygon points="16.5,6.5 17.3,8.3 19,8.3 17.8,9.5 18.3,11.5 16.5,10.2 14.7,11.5 15.2,9.5 14,8.3 15.7,8.3" fill="currentColor"/><path d="M7.5 15 Q12 19 16.5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
    { id:'wink',    name:'眨眼', svg:'<circle cx="17" cy="9" r="1.6"/><path d="M5.5 7.5 Q7 5.5 8.5 7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7.5 15 Q12 19 16.5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
  ],

  /* 数据迁移：单 photo → photos 数组；添加 dailyQuoteIndex */
  _migrateData(data) {
    if (!data.photos) {
      data.photos = data.photo ? [data.photo, '', '', ''] : ['', '', '', ''];
      delete data.photo;
    }
    while (data.photos.length < this.MAX_SLOTS) data.photos.push('');
    if (data.dailyQuoteIndex === undefined) data.dailyQuoteIndex = -1; // -1 = 每日随机
    return data;
  },

  _getData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      let data = raw ? JSON.parse(raw) : null;
      // 全局存储架构升级：localStorage 无值时从 IndexedDB 兜底恢复
      if (!data && window.AppKVDB) {
        const fullKey = 'mirror_' + this.STORAGE_KEY;
        AppKVDB.get(fullKey).then((record) => {
          if (!record || record.value === undefined) return;
          try { localStorage.setItem(fullKey.slice(7), JSON.stringify(record.value)); } catch(e2) {}
          this.render();
        }).catch(function() {});
      }
      if (!data) data = { photos: ['','','',''], emoji: 'smile', quote: '对方还没留下语录哦', dailyQuoteIndex: -1 };
      return this._migrateData(data);
    } catch (e) { return { photos: ['','','',''], emoji: 'smile', quote: '对方还没留下语录哦', dailyQuoteIndex: -1 }; }
  },

  _save(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        photos: data.photos, emoji: data.emoji, quote: data.quote, dailyQuoteIndex: data.dailyQuoteIndex
      }));
    } catch (e) {
      console.warn('JournalCard._save failed (quota exceeded?):', e.message);
    }
    // 全局存储架构升级：元数据同步写入 IndexedDB 持久化（localStorage 清空/超限后仍可恢复）
    if (window.AppKVDB) {
      AppKVDB.put({
        key: 'mirror_' + this.STORAGE_KEY,
        value: { photos: data.photos, emoji: data.emoji, quote: data.quote, dailyQuoteIndex: data.dailyQuoteIndex },
        updatedAt: Date.now()
      }).catch(function() {});
    }
    return true;
  },

  _getEmojiSVG(id) {
    const def = this.EMOJI_TYPES.find(e => e.id === id);
    return def ? def.svg : this.EMOJI_TYPES[0].svg;
  },

  _buildEmojiHTML(id, cls) {
    const svg = this._getEmojiSVG(id);
    return `<div class="cust-emoji cust-emoji-${id}${cls ? ' ' + cls : ''}"><svg viewBox="0 0 24 24" class="cust-emoji-face">${svg}</svg></div>`;
  },

  /* 当前正在操作的槽位，避免全局状态依赖 */
  _activeSlot: null,

  /* 图片压缩：防止 base64 数据撑爆 localStorage 配额（通常 5-10MB） */
  _compressImage(dataUrl, callback, maxWidth = 800, quality = 0.75) {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  },

  triggerUpload(index) {
    this._activeSlot = index;

    /* 移除旧的 file input（取消 / 异常残留） */
    const oldInput = document.getElementById('journal-photo-input');
    if (oldInput) oldInput.remove();

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'journal-photo-input';
    input.accept = 'image/*';
    input.style.display = 'none';

    /* 防重入：确保同一 input 的清理动作只执行一次 */
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      /* 只在 input 仍在 DOM 中时移除 */
      if (input.parentNode) input.remove();
    };

    /* ---- change 事件：用户选择了文件 ---- */
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file || this._activeSlot === null) {
        cleanup();
        return;
      }

      /* 先捕获 slot，再立刻置空 _activeSlot，避免竞态 */
      const slot = this._activeSlot;
      this._activeSlot = null;

      const reader = new FileReader();

      reader.onload = (e) => {
        const data = this._getData();
        const rawDataUrl = e.target.result;
        /* 原始图片直接存入 IndexedDB：无容量限制、跟随设备永久保存；
           localStorage 仅存占位标记，避免压缩与配额问题 */
        const savePhoto = () => {
          if (window.JournalPhotoDB) {
            window.JournalPhotoDB.set('slot_' + slot, rawDataUrl).then(() => {
              data.photos[slot] = '__idb__';
              const saved = this._save(data);
              this.render(data);
              if (!saved) Core.toast('图片已保存到设备存储，请放心使用');
              cleanup();
            }).catch(() => {
              /* IndexedDB 不可用时回退：压缩后存 localStorage */
              this._compressImage(rawDataUrl, (compressedDataUrl) => {
                data.photos[slot] = compressedDataUrl;
                const saved = this._save(data);
                this.render(data);
                if (!saved) Core.toast('图片已显示，但本地存储空间不足，刷新页面后可能丢失');
                cleanup();
              });
            });
          } else {
            this._compressImage(rawDataUrl, (compressedDataUrl) => {
              data.photos[slot] = compressedDataUrl;
              const saved = this._save(data);
              this.render(data);
              if (!saved) Core.toast('图片已显示，但本地存储空间不足，刷新页面后可能丢失');
              cleanup();
            });
          }
        };
        savePhoto();
      };

      reader.onerror = () => {
        cleanup();
      };

      /* 启动异步读取；在 onload/onerror 之前绝不触碰 input DOM */
      reader.readAsDataURL(file);
    });

    /* ---- 取消兜底：用户取消了文件对话框 ---- */
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      /* 延迟让路给 change 事件；使用闭包捕获当前 input 引用，避免
         快速连续上传时 getElementById 拿到后一次调用新建的 input */
      setTimeout(() => {
        if (input.parentNode) input.remove();
      }, 300);
    };
    window.addEventListener('focus', onFocus);

    document.body.appendChild(input);
    input.click();
  },

  removePhoto(e, index) {
    e.stopPropagation();
    const data = this._getData();
    data.photos[index] = '';
    this._save(data);
    this.render();
    /* 同步删除 IndexedDB 中的原图，彻底释放设备存储 */
    if (window.JournalPhotoDB) {
      window.JournalPhotoDB.del('slot_' + index).catch(function() {});
    }
  },

  pickEmoji() {
    const overlay = document.getElementById('emoji-picker-overlay');
    const grid = document.getElementById('emoji-picker-grid');
    if (!overlay || !grid) return;

    let html = '';
    this.EMOJI_TYPES.forEach(emoji => {
      html += `<div class="emoji-picker-item" onclick="JournalCard.selectEmoji('${emoji.id}')" title="${emoji.name}">${this._buildEmojiHTML(emoji.id, '')}</div>`;
    });
    grid.innerHTML = html;
    overlay.classList.add('active');
  },

  selectEmoji(id) {
    const data = this._getData();
    data.emoji = id;
    this._save(data);
    this.render();
    this.closeEmojiPicker();
  },

  closeEmojiPicker() {
    const overlay = document.getElementById('emoji-picker-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  /* === 每日留言语录 - 留言库联动 === */

  /* 基于日期的每日随机索引：同一天始终返回同一句 */
  _getDailyRandomIndex(quotes) {
    if (!quotes || !quotes.length) return -1;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    return dayOfYear % quotes.length;
  },

  /* 获取当天要显示的留言（每日随机 or 对方选定） */
  _getDailyQuote(data) {
    var quotes = window.Storage ? window.Storage.getDailyQuotes() : [];
    if (!quotes || !quotes.length) return { text: '对方还没留下语录哦', index: -1, isRandom: true, isEmpty: true };

    var idx = data.dailyQuoteIndex;
    if (idx === undefined || idx < 0 || idx >= quotes.length) {
      // 每日随机
      idx = this._getDailyRandomIndex(quotes);
      return { text: quotes[idx], index: idx, isRandom: true, isEmpty: false };
    }
    return { text: quotes[idx], index: idx, isRandom: false, isEmpty: false };
  },

  /* 留言选择弹窗 */
  _showQuotePicker() {
    var quotes = window.Storage ? window.Storage.getDailyQuotes() : [];
    if (!quotes || !quotes.length) return;

    // 移除旧弹窗
    this._closeQuotePicker();

    var overlay = document.createElement('div');
    overlay.className = 'quote-picker-overlay active';
    overlay.onclick = function(e) { if (e.target === overlay) JournalCard._closeQuotePicker(); };

    var itemsHtml = '';
    for (var i = 0; i < quotes.length; i++) {
      itemsHtml += '<div class="quote-picker-item" onclick="JournalCard._selectDailyQuote(' + i + ')">' +
                   '<span class="quote-picker-text">' + this._escapeHtml(quotes[i]) + '</span>' +
                   '</div>';
    }
    // 每日随机选项
    itemsHtml += '<div class="quote-picker-item quote-picker-random" onclick="JournalCard._selectDailyQuote(-1)">' +
                 '<i class="fas fa-random"></i><span>每天随机一句</span></div>';

    overlay.innerHTML = '<div class="quote-picker-panel" onclick="event.stopPropagation()">' +
                        '<div class="quote-picker-title">选择留言</div>' +
                        '<div class="quote-picker-list">' + itemsHtml + '</div>' +
                        '</div>';

    document.body.appendChild(overlay);
  },

  _selectDailyQuote(index) {
    var data = this._getData();
    data.dailyQuoteIndex = index;
    this._save(data);
    this.render(data);
    this._closeQuotePicker();
  },

  _closeQuotePicker() {
    var el = document.querySelector('.quote-picker-overlay');
    if (el) el.remove();
  },

  _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  /* 为相框生成单击/双击处理器：空相框单击上传；有图相框单击上传、双击删除 */
  _makeSlotHandler(index, hasPhoto) {
    if (!hasPhoto) {
      return () => this.triggerUpload(index);
    }
    let clickTimer = null;
    return (e) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        this.removePhoto(e, index);
        return;
      }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        this.triggerUpload(index);
      }, 300);
    };
  },

  render(data) {
    if (!data) data = this._getData();

    /* 多相框：逐个渲染 slot 1~4 */
    for (let i = 0; i < this.MAX_SLOTS; i++) {
      const slotEl = document.getElementById('frame-slot-' + (i + 1));
      const bodyEl = slotEl ? slotEl.querySelector('.journal-frame-body') : null;
      if (!bodyEl) continue;

      const photo = data.photos[i] || '';
      if (photo) {
        if (photo === '__idb__') {
          /* IndexedDB 持久化图片：异步读取原图后展示，刷新页面后仍可恢复 */
          bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-spinner fa-spin"></i></div>';
          slotEl.classList.add('has-photo');
          if (window.JournalPhotoDB) {
            window.JournalPhotoDB.get('slot_' + i).then(function(raw) {
              if (raw) {
                bodyEl.innerHTML = `<img src="${raw}" alt="相框${i+1}">`;
              } else {
                bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
                slotEl.classList.remove('has-photo');
              }
            }).catch(function() {
              bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
              slotEl.classList.remove('has-photo');
            });
          } else {
            bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
            slotEl.classList.remove('has-photo');
          }
        } else {
          bodyEl.innerHTML = `<img src="${photo}" alt="相框${i+1}">`;
          slotEl.classList.add('has-photo');
        }
      } else {
        bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
        slotEl.classList.remove('has-photo');
      }

      /* 用 JS onclick 覆盖 HTML 中的内联属性，实现单击/双击区分 */
      slotEl.onclick = this._makeSlotHandler(i, !!photo);
    }

    /* 心情表情 */
    const moodDisplay = document.getElementById('journal-mood-display');
    if (moodDisplay) {
      moodDisplay.innerHTML = this._buildEmojiHTML(data.emoji, '');
    }

    /* 留言语录 - 从留言库绑定 */
    const quoteArea = document.getElementById('journal-quote');
    if (quoteArea) {
      const daily = this._getDailyQuote(data);

      if (daily.isEmpty) {
        quoteArea.textContent = '对方还没留下语录哦';
        quoteArea.style.color = 'var(--text-muted, #999)';
        quoteArea.classList.remove('clickable');
        quoteArea.style.cursor = 'default';
        quoteArea.onclick = null;
      } else {
        quoteArea.textContent = daily.text;
        quoteArea.style.color = 'var(--text-light)';
        quoteArea.classList.add('clickable');
        quoteArea.style.cursor = 'pointer';
        quoteArea.onclick = () => this._showQuotePicker();
      }
    }
  }
};

