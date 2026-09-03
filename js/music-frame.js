/* === 首页音乐卡片封面相框：可上传图片 + 永久保存 ===
 * 交互与持久化完全对齐首页手帐四相框（JournalCard）：
 *  - 原图存入 IndexedDB（JournalPhotoDB，key=music_cover），localStorage 仅存占位标记
 *  - 元数据同步写入 AppKVDB（mirror_ 前缀）兜底恢复
 *  - IndexedDB 不可用时回退为压缩后 base64 存 localStorage
 *  - 单击上传、双击删除、刷新后自动恢复
 */
(function () {
  var STORAGE_KEY = 'music_card_cover';
  var IDB_KEY = 'music_cover';
  /* 常驻单例 file input：只创建一次、change 只绑定一次，
     避免每次点击重建 input 导致 focus 监听累积、change 事件丢失 */
  var _input = null;
  /* 上传中锁：防止并发上传 / 重复点击 */
  var _uploading = false;

  var MusicFrame = {
    _getData() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null && raw !== undefined) return raw;
      } catch (e) {}
      // 全局存储架构升级：localStorage 无值时从 IndexedDB 兜底恢复
      if (window.AppKVDB) {
        var fullKey = 'mirror_' + STORAGE_KEY;
        AppKVDB.get(fullKey).then(function (record) {
          if (!record || record.value === undefined) return;
          try { localStorage.setItem(STORAGE_KEY, record.value); } catch (e2) {}
          MusicFrame.render();
        }).catch(function () {});
      }
      return '';
    },

    _save(placeholder) {
      try {
        localStorage.setItem(STORAGE_KEY, placeholder);
      } catch (e) {
        console.warn('MusicFrame._save failed (quota exceeded?):', e.message);
      }
      // 元数据同步写入 IndexedDB 持久化（localStorage 清空/超限后仍可恢复）
      if (window.AppKVDB) {
        AppKVDB.put({
          key: 'mirror_' + STORAGE_KEY,
          value: placeholder,
          updatedAt: Date.now()
        }).catch(function () {});
      }
      return true;
    },

    /* 图片压缩：防止 base64 数据撑爆 localStorage 配额（通常 5-10MB） */
    _compressImage(dataUrl, callback, maxWidth, quality) {
      maxWidth = maxWidth || 800;
      quality = quality || 0.75;
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { callback(dataUrl); };
      img.src = dataUrl;
    },

    /* 创建（仅首次）并返回常驻 file input */
    _ensureInput() {
      if (_input) return _input;

      _input = document.createElement('input');
      _input.type = 'file';
      _input.id = 'music-frame-photo-input';
      _input.accept = 'image/*';
      _input.style.display = 'none';

      _input.addEventListener('change', function () {
        var file = _input.files && _input.files[0];
        if (!file) return;
        _uploading = true;

        var reader = new FileReader();
        reader.onload = function (e) {
          var rawDataUrl = e.target.result;
          var savePhoto = function () {
            if (window.JournalPhotoDB) {
              window.JournalPhotoDB.set(IDB_KEY, rawDataUrl).then(function () {
                _uploading = false;
                MusicFrame._save('__idb__');
                MusicFrame.render();
              }).catch(function () {
                /* IndexedDB 不可用时回退：压缩后存 localStorage */
                _uploading = false;
                MusicFrame._compressImage(rawDataUrl, function (compressedDataUrl) {
                  MusicFrame._save(compressedDataUrl);
                  MusicFrame.render();
                });
              });
            } else {
              _uploading = false;
              MusicFrame._compressImage(rawDataUrl, function (compressedDataUrl) {
                MusicFrame._save(compressedDataUrl);
                MusicFrame.render();
              });
            }
          };
          savePhoto();
        };
        reader.onerror = function () { _uploading = false; };
        reader.readAsDataURL(file);

        /* 复用 input：清空 value，允许下次选择同一文件也能触发 change */
        try { _input.value = ''; } catch (ignore) {}
      });

      document.body.appendChild(_input);
      return _input;
    },

    /* 单击上传：常驻 input 直接 click，无增删、无 focus 监听竞态 */
    triggerUpload() {
      if (_uploading) return;
      this._ensureInput().click();
    },

    /* 双击删除（对齐 JournalCard.removePhoto：置空 + 同步删除 IndexedDB 原图） */
    removePhoto(e) {
      e.stopPropagation();
      MusicFrame._save('');
      MusicFrame.render();
      if (window.JournalPhotoDB) {
        window.JournalPhotoDB.del(IDB_KEY).catch(function () {});
      }
    },

    /* 单击/双击处理器：空相框单击上传；有图相框单击上传、双击删除 */
    _makeSlotHandler(hasPhoto) {
      var self = this;
      if (!hasPhoto) {
        return function () { self.triggerUpload(); };
      }
      var clickTimer = null;
      return function (e) {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          self.removePhoto(e);
          return;
        }
        clickTimer = setTimeout(function () {
          clickTimer = null;
          self.triggerUpload();
        }, 300);
      };
    },

    render() {
      var slotEl = document.getElementById('music-frame-slot');
      var bodyEl = document.getElementById('music-frame-body');
      if (!slotEl || !bodyEl) return;

      var photo = this._getData();
      if (photo) {
        if (photo === '__idb__') {
          /* IndexedDB 持久化图片：异步读取原图后展示，刷新页面后仍可恢复 */
          bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-spinner fa-spin"></i></div>';
          slotEl.classList.add('has-photo');
          if (window.JournalPhotoDB) {
            window.JournalPhotoDB.get(IDB_KEY).then(function (raw) {
              if (raw) {
                bodyEl.innerHTML = '<img src="' + raw + '" alt="音乐封面">';
              } else {
                bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
                slotEl.classList.remove('has-photo');
              }
            }).catch(function () {
              bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
              slotEl.classList.remove('has-photo');
            });
          } else {
            bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
            slotEl.classList.remove('has-photo');
          }
        } else {
          bodyEl.innerHTML = '<img src="' + photo + '" alt="音乐封面">';
          slotEl.classList.add('has-photo');
        }
      } else {
        bodyEl.innerHTML = '<div class="journal-frame-empty"><i class="fas fa-image"></i></div>';
        slotEl.classList.remove('has-photo');
      }

      /* 用 JS onclick 覆盖 HTML 中的内联属性，实现单击/双击区分 */
      slotEl.onclick = this._makeSlotHandler(!!photo);
    }
  };

  window.MusicFrame = MusicFrame;

  /* 首次渲染（脚本位于 body 末尾，DOM 通常已就绪；保险起见等待 DOMContentLoaded） */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { MusicFrame.render(); });
  } else {
    MusicFrame.render();
  }
})();
