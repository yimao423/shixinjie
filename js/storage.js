/* ==== storage.js ==== */
/* ===== 拾心界 - 本地存储管理 ===== */

/* ===== StickerDB: IndexedDB 表情包库（解决 localStorage 5MB 限制） ===== */
const StickerDB = {
  DB_NAME: 'MirrorStickers',
  DB_VERSION: 1,
  STORE_NAME: 'stickers',
  CAT_STORE_NAME: 'stickerCategories',
  _db: null,

  open: function() {
    if (this._db) return Promise.resolve(this._db);
    var self = this;
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(self.DB_NAME, self.DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(self.STORE_NAME)) {
          db.createObjectStore(self.STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(self.CAT_STORE_NAME)) {
          db.createObjectStore(self.CAT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function(e) {
        self._db = e.target.result;
        resolve(self._db);
      };
      req.onerror = function(e) {
        reject(e.target.error);
      };
    });
  },

  getAll: function() {
    var self = this;
    return this.open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(self.STORE_NAME, 'readonly');
        var store = tx.objectStore(self.STORE_NAME);
        var req = store.getAll();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    });
  },

  // 返回随机一张表情包（用于自动回复），库为空返回 null
  getRandom: function() {
    return this.getAll().then(function(stickers) {
      if (!stickers || !stickers.length) return null;
      return stickers[Math.floor(Math.random() * stickers.length)];
    });
  },

  addMany: function(stickers) {
    var self = this;
    return this.open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(self.STORE_NAME, 'readwrite');
        var store = tx.objectStore(self.STORE_NAME);
        var count = 0;
        stickers.forEach(function(s) { store.add(s); count++; });
        tx.oncomplete = function() { resolve({ count: count }); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  },

  deleteMany: function(ids) {
    var self = this;
    return this.open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(self.STORE_NAME, 'readwrite');
        var store = tx.objectStore(self.STORE_NAME);
        ids.forEach(function(id) { store.delete(id); });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  },

  clearAll: function() {
    var self = this;
    return this.open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(self.STORE_NAME, 'readwrite');
        var store = tx.objectStore(self.STORE_NAME);
        store.clear();
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  },

  replaceAll: function(stickers) {
    var self = this;
    return this.clearAll().then(function() {
      return self.addMany(stickers);
    });
  },

  getCategories: function() {
    var self = this;
    return this.open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(self.CAT_STORE_NAME, 'readonly');
        var store = tx.objectStore(self.CAT_STORE_NAME);
        var req = store.getAll();
        req.onsuccess = function() {
          resolve(req.result.map(function(r) { return r.name; }));
        };
        req.onerror = function() { reject(req.error); };
      });
    });
  },

  addCategory: function(name) {
    var self = this;
    return this.getCategories().then(function(cats) {
      if (cats.indexOf(name) !== -1) return Promise.resolve(cats);
      return self.open().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(self.CAT_STORE_NAME, 'readwrite');
          var store = tx.objectStore(self.CAT_STORE_NAME);
          store.add({ name: name });
          tx.oncomplete = function() {
            cats.push(name);
            resolve(cats);
          };
          tx.onerror = function() { reject(tx.error); };
        });
      });
    });
  },

  replaceCategories: function(names) {
    var self = this;
    return this.open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(self.CAT_STORE_NAME, 'readwrite');
        var store = tx.objectStore(self.CAT_STORE_NAME);
        store.clear();
        names.forEach(function(n) { store.add({ name: n }); });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  },

  /* 首次加载时迁移 localStorage 旧数据 */
  migrateIfNeeded: function() {
    var self = this;
    var oldStickers = null;
    try {
      var raw = localStorage.getItem('mirror_stickers');
      if (raw) { oldStickers = JSON.parse(raw); }
    } catch(e) {}

    var oldCats = null;
    try {
      var rawCats = localStorage.getItem('mirror_stickerCategories');
      if (rawCats) { oldCats = JSON.parse(rawCats); }
    } catch(e) {}

    if (!oldStickers && !oldCats) return Promise.resolve();

    return self.getAll().then(function(existing) {
      if (existing.length > 0) {
        /* 已有 IndexedDB 数据，跳过迁移，清理旧键 */
        localStorage.removeItem('mirror_stickers');
        localStorage.removeItem('mirror_stickerCategories');
        return Promise.resolve();
      }
      var promises = [];
      if (oldStickers && oldStickers.length) {
        promises.push(self.addMany(oldStickers));
      }
      if (oldCats && oldCats.length) {
        promises.push(self.replaceCategories(oldCats));
      }
      return Promise.all(promises).then(function() {
        localStorage.removeItem('mirror_stickers');
        localStorage.removeItem('mirror_stickerCategories');
      });
    });
  }
};

/* ============================================================
   AppKVDB: 通用 IndexedDB 键值镜像层（全局存储架构升级）
   覆盖所有仍走 localStorage 的 mirror_* 通用键（设置、月经记录、
   日记、树洞、记事本、字卡、收藏、商城等），作为权威持久层：
   - 每次 Storage.set 同步写 localStorage（保持现有同步 API 兼容）
     + 异步写 AppKVDB（无 5MB 配额、跟随设备永久保存）
   - 启动时双向智能同步：IDB 有而 localStorage 无/旧 → 回填，
     localStorage 更新 → 覆盖 IDB，避免任一方向覆盖丢数据
   ============================================================ */
var AppKVDB = (function() {
  var DB_NAME = 'mirror_app_kv_db';
  var DB_VER = 1;
  var STORE = 'kv';
  var _db = null;
  var _opening = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;
    if (!window.indexedDB) return Promise.reject(new Error('no indexedDB'));
    _opening = new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = function(e) {
        _db = e.target.result;
        _opening = null;
        resolve(_db);
      };
      req.onerror = function() { _opening = null; reject(req.error); };
      req.onblocked = function() { _opening = null; reject(new Error('indexedDB blocked')); };
    });
    return _opening;
  }

  function put(record) {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
        tx.onabort = function() { reject(tx.error); };
      });
    });
  }

  function get(key) {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function getAll() {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function del(key) {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  return { put: put, get: get, getAll: getAll, del: del };
})();
window.AppKVDB = AppKVDB;

/* ============================================================
   MessageDB: IndexedDB 持久化聊天记录
   （localStorage 容量约 5MB，图片/长对话易写满导致刷新后聊天记录丢失；
     IndexedDB 无容量限制，作为聊天记录的永久存储层，写入自动兜底）
   ============================================================ */
var MessageDB = (function() {
  var DB_NAME = 'mirror_message_db';
  var DB_VER = 1;
  var STORE = 'messages';
  var _db = null;
  var _opening = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;
    if (!window.indexedDB) return Promise.reject(new Error('no indexedDB'));
    _opening = new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'chatId' });
        }
      };
      req.onsuccess = function(e) {
        _db = e.target.result;
        _opening = null;
        resolve(_db);
      };
      req.onerror = function() { _opening = null; reject(req.error); };
      req.onblocked = function() { _opening = null; reject(new Error('indexedDB blocked')); };
    });
    return _opening;
  }

  function set(chatId, messages) {
    // 串行写队列：保证写入顺序、减少并发事务堆积，降低刷新时事务未完成导致丢失的概率
    var write = _writeChain.then(function() {
      return _writeInternal(chatId, messages);
    });
    _writeChain = write.then(function() {}, function() {});
    return write;
  }

  var _writeChain = Promise.resolve();
  function _writeInternal(chatId, messages) {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ chatId: chatId, messages: messages, updatedAt: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = function() { reject(tx.error); };
        tx.onabort = function() { reject(tx.error); };
      });
    });
  }

  /* 删除指定聊天的记录（清空聊天记录时同步清理 IndexedDB） */
  function del(chatId) {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(chatId);
        tx.oncomplete = resolve;
        tx.onerror = function() { reject(tx.error); };
        tx.onabort = function() { reject(tx.error); };
      });
    });
  }

  /* 清空整个库（聊天消息 + meta 记录）。"重置全部数据"必须调用此方法，
     否则刷新后 getChats/getMessages 会从 IndexedDB 恢复旧数据。
     同时重置串行写队列，避免清空后仍被排队中的旧写回填。 */
  function clearAll() {
    _writeChain = Promise.resolve();
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = function() { reject(tx.error); };
        tx.onabort = function() { reject(tx.error); };
      });
    });
  }

  /* meta 记录（复用同一 store，key 前缀 __meta_）：用于持久化聊天列表等小数据 */
  function setMeta(key, value) {
    return set('__meta_' + key, value);
  }
  function getMeta(key) {
    return get('__meta_' + key);
  }

  function getAll() {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function get(chatId) {
    return open().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(chatId);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  return { set: set, get: get, getAll: getAll, del: del, clearAll: clearAll, setMeta: setMeta, getMeta: getMeta };
})();
window.MessageDB = MessageDB;

const Storage = {
  PREFIX: 'mirror_',
  /* 会话内存缓存：localStorage 配额不足等写入失败时兜底，
     保证当前会话内 get/set 读写一致（数据仍异步写入 IDB 权威存储，刷新后可恢复） */
  _memCache: {},

  /* ===== 通用键 IndexedDB 镜像（全局存储架构升级） =====
     所有 mirror_* 通用键均双写 localStorage + AppKVDB：
     - localStorage 负责同步读取兼容（现有业务代码无需改动）
     - AppKVDB（IndexedDB）负责权威持久化，无 5MB 配额，跟随设备永久保存
     以下键已有专属 IndexedDB 存储（MessageDB/StickerDB/CallBgDB 等），不纳入通用镜像，避免重复。 */
  _KV_SKIP_PREFIXES: ['msg_', 'chats', 'groupChats', 'albums', 'albums_ts', 'photos', 'stickers', 'stickerCategories', 'callBgImage', '__ts_', 'rp_'],

  _isKVMirrorable(key) {
    for (var i = 0; i < this._KV_SKIP_PREFIXES.length; i++) {
      var p = this._KV_SKIP_PREFIXES[i];
      if (key === p || key.indexOf(p) === 0) return false;
    }
    return true;
  },

  /* 启动时双向智能同步：localStorage <-> AppKVDB
     原则：仅"更新的一方"覆盖旧的一方；IDB 无记录时把 localStorage 迁入；
     localStorage 无/旧时回填 IDB。绝不无条件覆盖（避免刷新丢数据）。 */
  syncAllFromIDB() {
    if (!window.AppKVDB || !window.indexedDB) return Promise.resolve();
    var self = this;
    // 1) 先迁移 localStorage 中已有的 mirror_* 键到 IDB（双向比较）
    var lsKeys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(self.PREFIX) === 0 && self._isKVMirrorable(k.slice(self.PREFIX.length))) {
          lsKeys.push(k);
        }
      }
    } catch (e) {}
    var tasks = lsKeys.map(function(fullKey) {
      var key = fullKey.slice(self.PREFIX.length);
      var lsVal = null;
      try { lsVal = JSON.parse(localStorage.getItem(fullKey) || 'null'); }
      catch (e) { lsVal = null; }
      if (lsVal === null) return Promise.resolve();
      return AppKVDB.get(fullKey).then(function(record) {
        var dbTs = record && record.updatedAt ? record.updatedAt : 0;
        var lsTs = 0;
        try { lsTs = parseInt(localStorage.getItem(self.PREFIX + '__ts_' + key) || '0', 10) || 0; } catch (e) {}
        if (!record) {
          // IDB 无记录：迁移入 IDB（保留旧数据）
          return AppKVDB.put({ key: fullKey, value: lsVal, updatedAt: lsTs || Date.now() });
        }
        if (lsTs > dbTs) {
          // localStorage 更新：覆盖 IDB
          return AppKVDB.put({ key: fullKey, value: lsVal, updatedAt: lsTs });
        }
        // IDB 更新/相同：保持 IDB 为准，回填 localStorage（若缺失）
        if (localStorage.getItem(fullKey) === null) {
          try { localStorage.setItem(fullKey, JSON.stringify(record.value)); } catch (e2) {}
        }
        return Promise.resolve();
      }).catch(function() { return AppKVDB.put({ key: fullKey, value: lsVal, updatedAt: lsTs || Date.now() }); });
    });
    // 2) 反向：IDB 有而 localStorage 没有的键（清缓存/超限兜底），回填 localStorage
    return Promise.all(tasks).catch(function() {}).then(function() {
      return AppKVDB.getAll();
    }).then(function(records) {
      if (!records || !records.length) return;
      records.forEach(function(r) {
        if (!r || !r.key || r.key.indexOf(self.PREFIX) !== 0) return;
        var shortKey = r.key.slice(self.PREFIX.length);
        if (!self._isKVMirrorable(shortKey)) return;
        var needBackfill = false;
        try {
          if (localStorage.getItem(r.key) === null) {
            // localStorage 缺失（清缓存/超限）：直接回填
            needBackfill = true;
          } else {
            // localStorage 有旧值但 IDB 版本更新（如 set 写 localStorage 失败走内存+IDB 兜底后刷新）：
            // 以 IDB 为准覆盖，避免"刷新后新数据被旧值遮蔽而丢失"
            var lsTs = 0;
            try { lsTs = parseInt(localStorage.getItem(self.PREFIX + '__ts_' + shortKey) || '0', 10) || 0; } catch (eTs) {}
            if (r.updatedAt && r.updatedAt > lsTs) needBackfill = true;
          }
        } catch (e) { needBackfill = true; }
        if (!needBackfill) return;
        try {
          localStorage.setItem(r.key, JSON.stringify(r.value));
          localStorage.setItem(self.PREFIX + '__ts_' + shortKey, String(r.updatedAt || Date.now()));
          self._memCache[shortKey] = r.value;
        } catch (e2) {}
      });
      // 同步完成后通知全局（业务可选择性监听做 UI 刷新）
      try {
        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('mirror-storage-synced'));
        }
      } catch (e3) {}
    }).catch(function() {});
  },

  /* 申请持久化存储（navigator.storage.persist）：
     Safari/Chrome 支持时请求将站点存储标记为持久化，降低被系统清理概率 */
  requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(function() {});
      }
    } catch (e) {}
  },

  /* 检测 IndexedDB 在 file:// 等环境下的可用性。
     Chrome/Safari 的 file:// 下 IndexedDB 可用；Firefox 的 file:// 下可能被禁用；
     隐私模式下可能不可用。不可用时给出引导（本地起服务 / 降级 localStorage）。 */
  _checkIndexedDBAvailability() {
    var self = this;
    function showWarn(msg) {
      console.warn('[拾心界存储] ' + msg);
      try {
        if (window.Core && typeof Core.toast === 'function') {
          Core.toast(msg);
        }
      } catch (e) {}
    }
    try {
      if (!window.indexedDB) {
        showWarn('IndexedDB 不可用，将降级为 localStorage 存储（容量有限）。建议用本地服务访问：在网站目录执行 python3 -m http.server，然后访问 http://localhost:8000');
        return;
      }
      var dbName = '__love_letter_idb_probe__';
      var req = window.indexedDB.open(dbName, 1);
      var finished = false;
      req.onerror = function() {
        finished = true;
        showWarn('IndexedDB 打开失败，将降级为 localStorage 存储（容量有限）。建议用本地服务访问：在网站目录执行 python3 -m http.server，然后访问 http://localhost:8000');
      };
      req.onsuccess = function() {
        var db = req.result;
        try {
          var tx = db.transaction([], 'readonly');
          if (tx) { /* 事务可创建，视为可用 */ }
        } catch (e) {}
        try { db.close(); } catch (e2) {}
        try { window.indexedDB.deleteDatabase(dbName); } catch (e3) {}
        finished = true;
      };
      req.onblocked = function() {
        if (!finished) {
          console.warn('[拾心界存储] IndexedDB 探测被阻塞（可能隐私模式），继续使用现有存储通道');
        }
      };
      // 超时保护
      setTimeout(function() {
        if (!finished) {
          try { window.indexedDB.deleteDatabase(dbName); } catch (e) {}
        }
      }, 3000);
    } catch (e) {
      showWarn('IndexedDB 不可用，将降级为 localStorage 存储（容量有限）。建议用本地服务访问：在网站目录执行 python3 -m http.server，然后访问 http://localhost:8000');
    }
  },

  get(key, defaultValue = null) {
    // 内存缓存优先：本会话写入/校验过的数据即时一致
    if (this._memCache && key in this._memCache) {
      this._asyncVerifyFromIDB(key);
      return this._memCache[key];
    }
    try {
      const val = localStorage.getItem(this.PREFIX + key);
      if (val !== null) {
        // 镜像命中：异步校验 IDB 权威版本，若 IDB 更新则以 IDB 为准回填
        this._asyncVerifyFromIDB(key);
        return JSON.parse(val);
      }
    } catch (e) {
      return defaultValue;
    }
    // localStorage 无值（清缓存/超限/从未写入）：异步从 AppKVDB 权威层兜底恢复
    this._asyncVerifyFromIDB(key);
    return defaultValue;
  },

  // 异步权威校验（防重入、每 key 至多一个在途请求）：
  // IDB 为权威存储，localStorage 仅镜像。发现 IDB 版本更新/本地缺失时，
  // 回填内存缓存 + localStorage 镜像，并广播 mirror-storage-restored 供业务重渲染。
  _asyncVerifyFromIDB(key) {
    if (!window.AppKVDB || !this._isKVMirrorable(key)) return;
    if (this._verifyBusy && this._verifyBusy[key]) return;
    if (!this._verifyBusy) this._verifyBusy = {};
    this._verifyBusy[key] = true;
    var self = this;
    AppKVDB.get(this.PREFIX + key).then(function(record) {
      self._verifyBusy[key] = false;
      if (!record || record.value === undefined) return;
      var dbTs = record.updatedAt || 0;
      var localTs = 0;
      if (self._memCache && self._memCache['__ts_' + key]) {
        localTs = parseInt(self._memCache['__ts_' + key], 10) || 0;
      }
      if (!localTs) {
        try { localTs = parseInt(localStorage.getItem(self.PREFIX + '__ts_' + key) || '0', 10) || 0; } catch (e) {}
      }
      // 本会话已写过（内存为最新）：IDB 不新于本地则跳过，避免覆盖本地更新
      if (self._memCache && key in self._memCache) {
        if (dbTs <= localTs) return;
      } else if (localTs > 0 && dbTs <= localTs) {
        // 本地镜像不旧于 IDB：无需处理
        return;
      }
      // IDB 版本更新或本地缺失：以 IDB 为准回填
      self._memCache[key] = record.value;
      self._memCache['__ts_' + key] = String(dbTs || Date.now());
      try {
        localStorage.setItem(self.PREFIX + key, JSON.stringify(record.value));
        localStorage.setItem(self.PREFIX + '__ts_' + key, String(dbTs || Date.now()));
      } catch (e2) {}
      try {
        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('mirror-storage-restored', { detail: { key: key, value: record.value } }));
        }
      } catch (e3) {}
    }).catch(function() {
      self._verifyBusy[key] = false;
    });
  },

  set(key, value) {
    var now = Date.now();
    // 内存缓存始终为最新：页面即时读取一致（会话内权威）
    this._memCache[key] = value;
    this._memCache['__ts_' + key] = String(now);
    // localStorage 尽力镜像：失败不影响成功语义（IDB 才是权威持久层）
    var lsOk = false;
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      localStorage.setItem(this.PREFIX + '__ts_' + key, String(now));
      lsOk = true;
    } catch (e) {
      console.warn('Storage.set localStorage 镜像失败（配额满/隐私模式），数据将仅由 IndexedDB 持久化:', e.message);
    }
    // IndexedDB 权威持久化（跟随设备永久保存，无 5MB 配额限制）
    var hasIDB = !!(window.AppKVDB && this._isKVMirrorable(key));
    if (hasIDB) {
      AppKVDB.put({ key: this.PREFIX + key, value: value, updatedAt: now }).catch(function() {});
      return true;
    }
    return lsOk;
  },

  remove(key) {
    if (this._memCache) {
      delete this._memCache[key];
      delete this._memCache['__ts_' + key];
    }
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (e) {}
    try {
      localStorage.removeItem(this.PREFIX + '__ts_' + key);
    } catch (e2) {}
    if (window.AppKVDB && this._isKVMirrorable(key)) {
      AppKVDB.del(this.PREFIX + key).catch(function() {});
    }
  },
  
  // === 聊天数据 ===
  // 内存消息缓存：localStorage 超限写入失败时，当前会话仍可正常渲染显示
  _msgCache: {},
  // 消息缓存更新时间戳（key: 'msg_<chatId>' -> 最近一次 setMessages 的内存时间；用于与 IndexedDB updatedAt 比较，避免旧数据覆盖新数据）
  _msgUpdatedAt: {},
  // 聊天列表内存缓存：localStorage 写失败时页面仍保持正确状态，刷新后从 IndexedDB 恢复
  _chatsCache: null,
  _groupChatsCache: null,
  _metaUpdatedAt: {},

  getChats() {
    if (this._chatsCache) return this._chatsCache;
    var fromLS = this.get('chats', null);
    if (fromLS !== null && Array.isArray(fromLS)) {
      this._chatsCache = fromLS;
      this._metaUpdatedAt['chats'] = 0;
      this._restoreMetaFromIDB('chats');
      return fromLS;
    }
    // localStorage 无数据：异步从 IndexedDB 恢复（localStorage 清空/超限后兜底）
    this._restoreMetaFromIDB('chats');
    // 不再回退到预置示例聊天（DefaultData.chats），避免未添加角色时出现"幽灵"聊天记录
    return [];
  },
  
  setChats(chats) {
    this._chatsCache = chats;
    this._metaUpdatedAt['chats'] = Date.now();
    this.set('chats', chats);
    // 同步 IndexedDB 持久化聊天列表：localStorage 超限时列表仍不丢失
    if (window.MessageDB) MessageDB.setMeta('chats', chats).catch(function() {});
  },

  // === 群聊数据 ===
  getGroupChats() {
    if (this._groupChatsCache) return this._groupChatsCache;
    var fromLS = this.get('groupChats', null);
    if (fromLS !== null && Array.isArray(fromLS)) {
      this._groupChatsCache = fromLS;
      this._metaUpdatedAt['groupChats'] = 0;
      this._restoreMetaFromIDB('groupChats');
      return fromLS;
    }
    this._restoreMetaFromIDB('groupChats');
    return [];
  },
  
  setGroupChats(groups) {
    this._groupChatsCache = groups;
    this._metaUpdatedAt['groupChats'] = Date.now();
    this.set('groupChats', groups);
    if (window.MessageDB) MessageDB.setMeta('groupChats', groups).catch(function() {});
  },

  /* 从 IndexedDB 恢复聊天列表/群聊列表（meta 记录），仅在 IDB 数据更新时覆盖 */
  _restoreMetaFromIDB(key) {
    if (!window.MessageDB || !key) return;
    var self = this;
    MessageDB.getMeta(key).then(function(record) {
      if (!record || !Array.isArray(record.messages)) return;
      var updatedAt = record.updatedAt || 0;
      if (updatedAt <= (self._metaUpdatedAt[key] || 0)) return;
      self._metaUpdatedAt[key] = updatedAt;
      var list = record.messages;
      if (key === 'chats') {
        self._chatsCache = list;
        self.set('chats', list);
      } else if (key === 'groupChats') {
        self._groupChatsCache = list;
        self.set('groupChats', list);
      }
      if (typeof Navigation !== 'undefined' && typeof Navigation._renderChatList === 'function') {
        Navigation._renderChatList();
      }
    }).catch(function() {});
  },
  
  getMessages(chatId) {
    var cacheKey = 'msg_' + chatId;
    if (this._msgCache[cacheKey]) return this._msgCache[cacheKey];
    var fromLS = this.get(cacheKey, null);
    if (fromLS !== null && Array.isArray(fromLS)) {
      this._msgCache[cacheKey] = fromLS;
      this._msgUpdatedAt[cacheKey] = 0;
      this._restoreFromIDB(chatId);
      return fromLS;
    }
    // localStorage 无数据：异步从 IndexedDB 兜底恢复（彻底修复刷新后聊天记录丢失）
    this._restoreFromIDB(chatId);
    // 不再回退到预置示例消息（DefaultData.getMessages），避免无角色/无会话时统计出"幽灵"消息
    return [];
  },

  /* 合并两条消息数组（按 id 去重，按 time/id 升序），保留双方独有消息 */
  _mergeMessages(a, b) {
    var out = [];
    var seen = {};
    var pushAll = function(arr) {
      if (!Array.isArray(arr)) return;
      for (var i = 0; i < arr.length; i++) {
        var m = arr[i];
        if (!m) continue;
        var key = m.id || ('t' + (m.time || 0) + '_' + i);
        if (seen[key]) continue;
        seen[key] = true;
        out.push(m);
      }
    };
    pushAll(a);
    pushAll(b);
    out.sort(function(x, y) {
      var xt = x.time || 0, yt = y.time || 0;
      if (xt !== yt) return xt - yt;
      return (x.id || 0) - (y.id || 0);
    });
    return out;
  },

  /* 从 IndexedDB 异步恢复指定聊天的消息到内存缓存（localStorage 超限写入失败时的兜底） */
  _restoreFromIDB(chatId) {
    if (!window.MessageDB || !chatId) return;
    var self = this;
    var cacheKey = 'msg_' + chatId;
    MessageDB.get(chatId).then(function(record) {
      if (!record || !Array.isArray(record.messages)) return;
      // 仅当 IDB 数据比当前缓存更新时才覆盖，避免旧数据回填覆盖用户刚写的新数据
      var updatedAt = record.updatedAt || 0;
      var curUpdatedAt = self._msgUpdatedAt[cacheKey] || 0;
      if (updatedAt < curUpdatedAt) {
        // 内存缓存更新（用户刚发消息、IDB 可能还是旧快照）：合并双方，保留各自独有消息，写回 IDB 与 localStorage
        var merged = self._mergeMessages(self._msgCache[cacheKey], record.messages);
        self._msgCache[cacheKey] = merged;
        self._msgUpdatedAt[cacheKey] = Date.now();
        if (window.MessageDB) MessageDB.set(chatId, merged).catch(function() {});
        self.set(cacheKey, merged);
        var page2 = document.getElementById('page-chat-room');
        var curChatId2 = page2 ? page2.dataset.chatId : '';
        if (curChatId2 === chatId && typeof renderChatMessages === 'function') {
          renderChatMessages(chatId);
        }
        return;
      }
      self._msgCache[cacheKey] = record.messages;
      self._msgUpdatedAt[cacheKey] = updatedAt;
      // 尽力同步回 localStorage，下次启动可同步读取，减少异步窗口
      self.set(cacheKey, record.messages);
      var page = document.getElementById('page-chat-room');
      var curChatId = page ? page.dataset.chatId : '';
      if (curChatId === chatId && typeof renderChatMessages === 'function') {
        renderChatMessages(chatId);
      }
    }).catch(function() {});
  },
  
  setMessages(chatId, messages) {
    var cacheKey = 'msg_' + chatId;
    this._msgCache[cacheKey] = messages;
    this._msgUpdatedAt[cacheKey] = Date.now();
    // localStorage 镜像延迟写入（400ms debounce）：避免高频发送时同步全量序列化整个数组阻塞主线程。
    // 内存缓存为会话内权威（getMessages 先读内存），IndexedDB 为持久层，localStorage 仅作镜像/兜底。
    this._scheduleMessagesMirror(chatId);
    // 延迟写入 IndexedDB 持久化：localStorage 容量有限（约5MB，图片消息易超限导致刷新丢失），IndexedDB 无此限制，保证聊天记录跟随设备永久保存
    // 使用 per-chatId 500ms debounce 延迟到事件循环，避免发送/自动回复高频调用时阻塞主线程（DOM 渲染已改为增量，无需等待落库）
    if (window.MessageDB) {
      if (!this._idbWriteTimers) this._idbWriteTimers = {};
      var self = this;
      if (this._idbWriteTimers[chatId]) clearTimeout(this._idbWriteTimers[chatId]);
      this._idbWriteTimers[chatId] = setTimeout(function() {
        delete self._idbWriteTimers[chatId];
        MessageDB.set(chatId, messages).catch(function() {});
      }, 500);
    }
  },

  /* 消息 localStorage 镜像的防抖调度：多个连续 setMessages 合并为一次写入，减少主线程同步阻塞 */
  _scheduleMessagesMirror(chatId) {
    if (!this._msgMirrorTimers) this._msgMirrorTimers = {};
    var self = this;
    if (this._msgMirrorTimers[chatId]) clearTimeout(this._msgMirrorTimers[chatId]);
    this._msgMirrorTimers[chatId] = setTimeout(function() {
      delete self._msgMirrorTimers[chatId];
      self._writeMessagesMirror(chatId);
    }, 400);
  },

  /* 立即将指定聊天的最新消息写入 localStorage 镜像（从内存缓存取最新值，保证镜像不落后于内存） */
  _writeMessagesMirror(chatId) {
    var cacheKey = 'msg_' + chatId;
    var messages = this._msgCache[cacheKey];
    if (!messages) return;
    try {
      localStorage.setItem(this.PREFIX + cacheKey, JSON.stringify(messages));
      localStorage.setItem(this.PREFIX + '__ts_' + cacheKey, String(Date.now()));
    } catch (e) {
      // 配额满/隐私模式下镜像写入失败不致命：数据仍由 IndexedDB 持久化
      console.warn('Storage 消息 localStorage 镜像写入失败，数据由 IndexedDB 持久化:', e.message);
    }
  },

  /* 立即刷写所有待写的消息镜像（页面隐藏/刷新前调用，配合 installPagehideFlush，防止刷新丢最近消息） */
  _flushMessagesMirrors() {
    if (!this._msgMirrorTimers) return;
    var self = this;
    for (var chatId in this._msgMirrorTimers) {
      if (this._msgMirrorTimers.hasOwnProperty(chatId)) {
        clearTimeout(this._msgMirrorTimers[chatId]);
        delete this._msgMirrorTimers[chatId];
        self._writeMessagesMirror(chatId);
      }
    }
  },

  /* 立即刷写全部待持久化数据并等待 IndexedDB 落盘完成（全量导入/重置等 reload 前必须调用）：
     - 清掉消息的防抖定时器，立即写 localStorage 镜像 + IndexedDB；
     - 重写聊天列表/群聊列表的 IDB meta；
     - 将内存缓存中全部通用键（字卡/表情/设置等）重写进 AppKVDB 权威层；
     所有写事务完成后 resolve（2s 超时兜底），杜绝 reload 打断异步防抖写导致数据回滚/丢失 */
  flushAll() {
    var self = this;
    var jobs = [];
    // 1) 消息：清防抖定时器，立即写 localStorage 镜像 + IndexedDB
    if (this._msgMirrorTimers) {
      Object.keys(this._msgMirrorTimers).forEach(function(chatId) {
        clearTimeout(self._msgMirrorTimers[chatId]);
        delete self._msgMirrorTimers[chatId];
        self._writeMessagesMirror(chatId);
      });
    }
    if (this._idbWriteTimers) {
      Object.keys(this._idbWriteTimers).forEach(function(chatId) {
        clearTimeout(self._idbWriteTimers[chatId]);
        delete self._idbWriteTimers[chatId];
        if (window.MessageDB && self._msgCache['msg_' + chatId]) {
          jobs.push(MessageDB.set(chatId, self._msgCache['msg_' + chatId]));
        }
      });
    }
    // 2) 聊天列表/群聊列表 IDB meta
    if (this._chatsCache && window.MessageDB) jobs.push(MessageDB.setMeta('chats', this._chatsCache));
    if (this._groupChatsCache && window.MessageDB) jobs.push(MessageDB.setMeta('groupChats', this._groupChatsCache));
    // 3) 通用键（cards/emojis/kaomojis/settings 等）重写进 AppKVDB 权威层，等待落盘
    if (window.AppKVDB && this._memCache) {
      Object.keys(this._memCache).forEach(function(key) {
        if (key.indexOf('__ts_') === 0) return;
        if (!self._isKVMirrorable(key)) return;
        var val = self._memCache[key];
        if (val === undefined) return;
        jobs.push(AppKVDB.put({ key: self.PREFIX + key, value: val, updatedAt: Date.now() }));
      });
    }
    return Promise.race([
      Promise.all(jobs.map(function(p) { return Promise.resolve(p).catch(function() {}); })),
      new Promise(function(res) { setTimeout(res, 2000); })
    ]);
  },

  // === 字卡数据 ===
  getCards() {
    return this.get('cards', DefaultData.cards);
  },
  
  setCards(cards) {
    this.set('cards', cards);
  },

  // === 副字卡数据 ===
  /* 副字卡（角色专属字卡）：每条 {id, text, source, partnerId}。
     partnerId 关联对方角色，每个角色的字卡只能由该角色发送。
     复用 mirror + AppKVDB 双写机制，与主字卡同层持久化。 */
  getSubCards() {
    return this.get('subCards', []);
  },

  setSubCards(cards) {
    this.set('subCards', cards);
  },

  getBlockedSubCards() {
    return this.get('blockedSubCards', []);
  },

  setBlockedSubCards(ids) {
    this.set('blockedSubCards', ids);
  },

  // === 语音字卡数据 ===
  /* 语音字卡列表：仅存元数据（id/name/category/duration/audioKey/audioMime/source），
     音频二进制经 SoundFileDB(IndexedDB) 永久持久化，列表只保存 IDB key 引用。
     复用 Storage 的 mirror + AppKVDB 双写机制（受限场景超 5MB 时 IndexedDB 权威兜底）。 */
  getVoiceCards() {
    return this.get('voiceCards', []);
  },

  setVoiceCards(cards) {
    this.set('voiceCards', cards);
  },

  getBlockedVoiceCards() {
    return this.get('blockedVoiceCards', []);
  },

  setBlockedVoiceCards(ids) {
    this.set('blockedVoiceCards', ids);
  },

  /* 语音字卡聊天混入开关（默认开启，便于直接体验 5% 语音混入） */
  getVoiceMixing() {
    var v = this.get('voiceMixing', null);
    return v === null ? true : !!v;
  },
  setVoiceMixing(v) {
    this.set('voiceMixing', v);
  },

  getEmojis() {
    return this.get('emojis', DefaultData.emojis);
  },
  
  setEmojis(emojis) {
    this.set('emojis', emojis);
  },
  
  /* Emoji 分组排序（分组名数组，决定字卡列表与聊天面板的显示顺序） */
  getEmojiGroupOrder() {
    return this.get('emojiGroupOrder', []);
  },
  
  setEmojiGroupOrder(order) {
    this.set('emojiGroupOrder', order);
  },
  
  /* 最近使用的 emoji（聊天面板「最近使用」分区，最新在前，最多10个） */
  getRecentEmojis() {
    return this.get('recentEmojis', []);
  },
  
  setRecentEmojis(list) {
    this.set('recentEmojis', list);
  },
  
  getKaomojis() {
    return this.get('kaomojis', DefaultData.kaomojis);
  },
  
  setKaomojis(kaomojis) {
    this.set('kaomojis', kaomojis);
  },

  getPats() {
    return this.get('pats', DefaultData.pats);
  },
  
  setPats(pats) {
    this.set('pats', pats);
  },

  /* ===== 表情包（IndexedDB，异步方法） ===== */
  getStickersAsync: function() {
    return StickerDB.getAll();
  },

  addStickersAsync: function(stickers) {
    return StickerDB.addMany(stickers);
  },

  setStickersAsync: function(stickers) {
    return StickerDB.replaceAll(stickers);
  },

  getStickerCategoriesAsync: function() {
    return StickerDB.getCategories();
  },

  addStickerCategoryAsync: function(name) {
    return StickerDB.addCategory(name);
  },

  /* ===== 表情包（localStorage 旧版，已废弃，仅保留兼容） ===== */
  getStickers: function() {
    return this.get('stickers', DefaultData.stickers);
  },

  setStickers: function(stickers) {
    return this.set('stickers', stickers);
  },

  addStickers: function(stickers) {
    var all = this.getStickers();
    var merged = all.concat(stickers);
    var saved = this.setStickers(merged);
    if (!saved) { console.warn('Storage.addStickers: setStickers failed, possibly quota exceeded'); }
    return { stickers: merged, saved: saved };
  },

  getStickerCategories: function() {
    return this.get('stickerCategories', []);
  },

  setStickerCategories: function(cats) {
    this.set('stickerCategories', cats);
  },

  addStickerCategory: function(cat) {
    var cats = this.getStickerCategories();
    if (cats.indexOf(cat) === -1) {
      cats.push(cat);
      this.setStickerCategories(cats);
    }
    return cats;
  },

  // === 设置数据 ===
  getMyProfile() {
    var p = this.get('myProfile', null);
    if (!p) {
      p = { nickname: '我', avatar: '我', avatarColor: '#A8D8EA', avatarImage: '', avatarShape: 'circle' };
    }
    // 兼容旧数据：补全头像字段，避免聊天界面取不到图片头像
    if (p.avatarImage === undefined) p.avatarImage = '';
    if (p.avatarShape === undefined) p.avatarShape = 'circle';
    if (!p.avatarColor) p.avatarColor = '#A8D8EA';
    return p;
  },
  
  setMyProfile(profile) {
    this.set('myProfile', profile);
  },
  
  getPartnerProfile() {
    return this.get('partnerProfile', { nickname: '镜', avatar: '镜', avatarColor: '#C8B8E0' });
  },
  
  setPartnerProfile(profile) {
    this.set('partnerProfile', profile);
  },
  
  getPartnerProfiles() {
    var profiles = this.get('partnerProfiles', null);
    if (profiles === null) {
      var old = this.get('partnerProfile', null);
      if (old) {
        profiles = [{ id: 'partner_1', nickname: old.nickname, avatar: old.avatar, avatarColor: old.avatarColor, avatarImage: '', avatarShape: 'circle' }];
      } else {
        profiles = [];
      }
      this.set('partnerProfiles', profiles);
    }
    // 迁移旧数据：补全 avatarImage 和 avatarShape 字段
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].avatarImage === undefined) profiles[i].avatarImage = '';
      if (profiles[i].avatarShape === undefined) profiles[i].avatarShape = 'circle';
    }
    return profiles;
  },
  
  setPartnerProfiles(profiles) {
    this.set('partnerProfiles', profiles);
  },
  
  // 外观设置
  getFontSize() {
    let v = parseFloat(this.get('fontSize', 16));
    if (isNaN(v)) v = 16;
    let px;
    if (v >= 2) {
      // 新格式：直接为 px 字号
      px = Math.round(v);
    } else {
      // 兼容旧百分比倍率格式（0.8~1.5）：按基准 16px 换算并迁移
      px = Math.round(16 * v);
    }
    px = Math.max(12, Math.min(24, px));
    if (px !== v) this.set('fontSize', px);
    return px;
  },

  setFontSize(size) {
    const px = Math.max(12, Math.min(24, Math.round(parseFloat(size) || 16)));
    this.set('fontSize', px);
    document.documentElement.style.fontSize = px + 'px';
  },
  
  // ===== 聊天设置 =====
  
  // --- 功能设置 - 交互 ---
  getReadReceipt() { return this.get('readReceipt', true); },
  setReadReceipt(v) { this.set('readReceipt', v); },
  getReadReceiptMode() { return this.get('readReceiptMode', 'icon'); },
  setReadReceiptMode(v) { this.set('readReceiptMode', v); },
  
  getReadIgnore() { return this.get('readIgnore', false); },
  setReadIgnore(v) { this.set('readIgnore', v); },
  
  getTypingIndicator() { return this.get('typingIndicator', true); },
  setTypingIndicator(v) { this.set('typingIndicator', v); },
  getTypingIndicatorText() { return this.get('typingIndicatorText', '对方正在输入…'); },
  setTypingIndicatorText(v) { this.set('typingIndicatorText', v); },
  getTypingSymbol() { return this.get('typingSymbol', '❤︎'); },
  setTypingSymbol(v) { this.set('typingSymbol', v); },
  
  // --- 拍一拍符号（我方发送 / 对方发送可分别自定义，默认爱心） ---
  getPatSelfSymbol() { return this.get('patSelfSymbol', '♥︎'); },
  setPatSelfSymbol(v) { this.set('patSelfSymbol', v); },
  getPatOtherSymbol() { return this.get('patOtherSymbol', '♥︎'); },
  setPatOtherSymbol(v) { this.set('patOtherSymbol', v); },
  
  getEnterToSend() { return this.get('enterToSend', true); },
  setEnterToSend(v) { this.set('enterToSend', v); },
  
  getShowRecallContent() { return this.get('showRecallContent', false); },
  setShowRecallContent(v) { this.set('showRecallContent', v); },
  
  // --- 功能设置 - 时间戳 ---
  getTimestampStyle() { return this.get('timestampStyle', 'time'); },
  setTimestampStyle(v) { this.set('timestampStyle', v); },
  
  // --- 节奏设置（单位：秒；旧版本为分钟，首次读取时自动迁移） ---
  _paceUnitMigrated: false,
  _ensurePaceSeconds() {
    if (this._paceUnitMigrated) return;
    this._paceUnitMigrated = true;
    if (this.get('paceUnitV2', false)) return;
    var rawMin = this.get('replyMinDelay', null);
    var rawMax = this.get('replyMaxDelay', null);
    var rawInterval = this.get('proactiveSendInterval', null);
    if (rawMin !== null) this.set('replyMinDelay', Math.max(1, Math.round(rawMin * 60)));
    if (rawMax !== null) this.set('replyMaxDelay', Math.max(1, Math.round(rawMax * 60)));
    if (rawInterval !== null) this.set('proactiveSendInterval', Math.max(1, Math.round(rawInterval * 60)));
    this.set('paceUnitV2', true);
  },
  getReplyMinDelay() { this._ensurePaceSeconds(); return this.get('replyMinDelay', 30); },
  setReplyMinDelay(v) { this.set('replyMinDelay', v); },
  
  getReplyMaxDelay() { this._ensurePaceSeconds(); return this.get('replyMaxDelay', 180); },
  setReplyMaxDelay(v) { this.set('replyMaxDelay', v); },
  
  getProactiveSend() { return this.get('proactiveSend', false); },
  setProactiveSend(v) { this.set('proactiveSend', v); },
  
  getProactiveSendInterval() { this._ensurePaceSeconds(); return this.get('proactiveSendInterval', 600); },
  setProactiveSendInterval(v) { this.set('proactiveSendInterval', v); },
  
  getSpellCardSend() { return this.get('spellCardSend', false); },
  setSpellCardSend(v) { this.set('spellCardSend', v); },
  
  getEmojiMixing() { return this.get('emojiMixing', false); },
  setEmojiMixing(v) { this.set('emojiMixing', v); },
  
  getKaomojiMixing() { return this.get('kaomojiMixing', false); },
  setKaomojiMixing(v) { this.set('kaomojiMixing', v); },

  getStickerMixing() { return this.get('stickerMixing', false); },
  setStickerMixing(v) { this.set('stickerMixing', v); },
  getRedPacketMixing() { return this.get('redpacketMixing', false); },
  setRedPacketMixing(v) { this.set('redpacketMixing', v); },
  getPatMixEnabled() { return this.get('patMixEnabled', true); },
  setPatMixEnabled(v) { this.set('patMixEnabled', v); },
  
  getSimulateCall() { return this.get('simulateCall', false); },
  setSimulateCall(v) { this.set('simulateCall', v); },
  getBackgroundKeepAlive() { return this.get('backgroundKeepAlive', false); },
  setBackgroundKeepAlive(v) { this.set('backgroundKeepAlive', v); },
  getBackgroundPush() { return this.get('backgroundPush', false); },
  setBackgroundPush(v) { this.set('backgroundPush', v); },
  getDreamTime() { return this.get('dreamTime', null); },
  setDreamTime(v) { this.set('dreamTime', v); },
  
  // --- 通话记录 ---
  getCallRecords() { return this.get('callRecords', []); },
  setCallRecords(v) { this.set('callRecords', v); },
  addCallRecord(record) {
    var records = this.getCallRecords();
    records.unshift(record);
    if (records.length > 100) records = records.slice(0, 100);
    this.setCallRecords(records);
    return records;
  },
  removeCallRecord(id) {
    var records = this.getCallRecords().filter(function(r) { return String(r.id) !== String(id); });
    this.setCallRecords(records);
    return records;
  },
  clearCallRecords() {
    this.setCallRecords([]);
  },
  
  // --- 通话设置 ---
  getCallBg() { return this.get('callBg', 0); },
  setCallBg(v) { this.set('callBg', v); },
  getCallBgImage() { return _callBgImageCache || this.get('callBgImage', ''); },
  setCallBgImage(v) {
    _callBgImageCache = v || '';
    this.set('callBgImage', _callBgImageCache);
    if (!v) { if (window.CallBgDB) CallBgDB.del('image').catch(function(){}); }
  },
  
  // --- 音效设置 ---
  getSoundEnabled() { return this.get('soundEnabled', true); },
  setSoundEnabled(v) { this.set('soundEnabled', v); },
  
  getSoundVolume() { return this.get('soundVolume', 80); },
  setSoundVolume(v) { this.set('soundVolume', v); },
  
  getReceiveSound() { var v = this.get('receiveSound', 'msg'); return (v === 'retro' || v === 'waterdrop') ? 'msg' : v; },
  setReceiveSound(v) { this.set('receiveSound', v); },
  
  getSendSound() { var v = this.get('sendSound', 'msg'); return (v === 'retro' || v === 'waterdrop') ? 'msg' : v; },
  setSendSound(v) { this.set('sendSound', v); },
  
  getCustomSounds() { return this.get('customSounds', []); },
  setCustomSounds(v) { this.set('customSounds', v); },

  // --- 保留旧版兼容（已不再在 UI 中使用，保留供 app.js 旧代码兼容） ---
  getNotify() { return this.get('notify', true); },
  setNotify(val) { this.set('notify', val); },
  getAutoReply() { return this.get('autoReply', true); },
  setAutoReply(val) { this.set('autoReply', val); },
  getChatBg() { return this.get('chatBg', 'default'); },
  setChatBg(val) { this.set('chatBg', val); },

  // --- 聊天专属设置（三点菜单） ---
  getPinnedChats() { return this.get('pinnedChats', []); },
  setPinnedChats(arr) { this.set('pinnedChats', arr); },

  isChatPinned(chatId) {
    return this.getPinnedChats().indexOf(chatId) !== -1;
  },

  togglePinChat(chatId) {
    var pinned = this.getPinnedChats();
    var idx = pinned.indexOf(chatId);
    if (idx !== -1) {
      pinned.splice(idx, 1);
    } else {
      pinned.push(chatId);
    }
    this.setPinnedChats(pinned);
    return idx === -1; // true = 已置顶
  },

  getChatMuted(chatId) { return this.get('muted_' + chatId, false); },
  setChatMuted(chatId, val) { this.set('muted_' + chatId, val); },

  getChatBgCustom(chatId) { return this.get('chatBg_' + chatId, 'default'); },
  setChatBgCustom(chatId, val) { this.set('chatBg_' + chatId, val); },

  clearChatMessages(chatId) {
    this.remove('msg_' + chatId);
    delete this._msgCache['msg_' + chatId];
    delete this._msgUpdatedAt['msg_' + chatId];
    // 同步清理 IndexedDB 中的记录
    if (window.MessageDB) MessageDB.del(chatId).catch(function() {});
  },
  
  // === 日常记录 ===
  getDailyRecords() {
    return this.get('dailyRecords', []);
  },
  
  setDailyRecords(records) {
    this.set('dailyRecords', records);
  },
  
  addDailyRecord(date, text) {
    const records = this.getDailyRecords();
    records.push({ id: Date.now(), date, text, createdAt: Date.now() });
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.setDailyRecords(records);
    return records;
  },
  
  updateDailyRecord(id, text) {
    const records = this.getDailyRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx >= 0) {
      records[idx].text = text;
      records[idx].updatedAt = Date.now();
      this.setDailyRecords(records);
    }
  },
  
  deleteDailyRecord(id) {
    const records = this.getDailyRecords().filter(r => r.id !== id);
    this.setDailyRecords(records);
    return records;
  },
  
  getRecordsByDate(date) {
    return this.getDailyRecords().filter(r => r.date === date);
  },

  // === 行踪 ===
  getWhereabouts() {
    const list = this.get('whereabouts', null);
    if (Array.isArray(list) && list.length > 0) return list;
    // key 不存在或列表为空（含用户本地已有空数组 key）：写入内置默认行踪，
    // 保证行踪页打开始终有固定内置条目（对标拍一拍/主字卡模式）
    const base = Date.now();
    const defaults = [
      ['图书馆', '安静看书'],
      ['咖啡店', '喝咖啡'],
      ['公园', '散步'],
      ['健身房', '锻炼身体'],
      ['书店', '逛书店'],
      ['电影院', '看电影'],
      ['海边', '看海发呆'],
      ['家里', '听音乐']
    ];
    const built = defaults.map((d, i) => ({
      id: base + i,
      place: d[0],
      action: d[1],
      group: '我的行踪',
      createdAt: base - i
    }));
    this.set('whereabouts', built);
    return built;
  },

  setWhereabouts(list) {
    this.set('whereabouts', list);
  },

  // 行踪分组：按 group 聚合，无 group 的旧数据归入「我的行踪」
  getWhereaboutGroups() {
    const list = this.getWhereabouts();
    const groups = {};
    list.forEach(function(w) {
      const g = (w.group && String(w.group).trim()) ? w.group : '我的行踪';
      if (!groups[g]) groups[g] = 0;
      groups[g]++;
    });
    const out = [];
    for (const name in groups) out.push({ name: name, count: groups[name] });
    return out;
  },

  getWhereaboutsByGroup(group) {
    const g = (group && String(group).trim()) ? group : '我的行踪';
    return this.getWhereabouts().filter(w => ((w.group && String(w.group).trim()) ? w.group : '我的行踪') === g);
  },

  addWhereabout(place, action, group) {
    const list = this.getWhereabouts();
    list.push({ id: Date.now(), place: place || '', action: action || '', group: (group && String(group).trim()) ? group : '我的行踪', createdAt: Date.now() });
    this.setWhereabouts(list);
    return list;
  },

  deleteWhereabout(id) {
    const list = this.getWhereabouts().filter(w => w.id !== id);
    this.setWhereabouts(list);
    return list;
  },

  // === 行踪汇报 ===
  getWhereaboutReports() {
    return this.get('whereaboutReports', []);
  },

  setWhereaboutReports(list) {
    this.set('whereaboutReports', list);
  },

  addWhereaboutReport(report) {
    const list = this.getWhereaboutReports();
    // id 加随机后缀，避免同毫秒撞 id 导致按 id 删除时误删多条
    list.push(Object.assign({ id: Date.now() + Math.floor(Math.random() * 1000), time: Date.now() }, report));
    // 汇报条目按时间排列（正序：早 -> 晚）
    list.sort((a, b) => (a.time || 0) - (b.time || 0));
    this.setWhereaboutReports(list);
    return list;
  },

  deleteWhereaboutReport(id) {
    const list = this.getWhereaboutReports().filter(r => r.id !== id);
    this.setWhereaboutReports(list);
    return list;
  },


  // === 月经记录 ===
  getPeriodRecords() { return this.get('periodRecords', []); },
  setPeriodRecords(records) { this.set('periodRecords', records); },

  // === 树洞 ===
  getTreeholePosts() { return this.get('treeholePosts', []); },
  setTreeholePosts(posts) { this.set('treeholePosts', posts); },

  // === 记事本 ===
  getNotes() { return this.get('notes', []); },
  setNotes(notes) { this.set('notes', notes); },

  // === 格言 ===
  getQuotes() { return this.get('quotes', [
    '爱不是彼此凝视，而是一起朝同一个方向看。',
    '世间万物，唯有你是我心之所向。',
    '你是我所有温柔的来源和归宿。',
    '星河滚烫，你是人间理想。',
    '白茶清欢无别事，我在等风也等你。',
    '愿有岁月可回首，且以深情共白头。',
    '春风十里不如你。',
    '所爱隔山海，山海皆可平。',
    '你是无意穿堂风，偏偏孤倨引山洪。',
    '浮世三千，吾爱有三：日、月与卿。'
  ]); },
  setQuotes(quotes) { this.set('quotes', quotes); },

  // === 收藏（结构化：含消息类别、发送方、时间、内容数据） ===
  getFavorites() { return this.get('favorites', []); },
  setFavorites(favorites) { this.set('favorites', favorites); },

  // === 他的收藏（对方角色自动收藏，结构与 favorites 一致） ===
  getHisFavorites() { return this.get('hisFavorites', []); },
  setHisFavorites(hisFavorites) { this.set('hisFavorites', hisFavorites); },

  // === 每日留言语录 ===
  getDailyQuotes() { return this.get('dailyQuotes', [
    '今天也想见到你，不管什么天气。',
    '和你在一起的每一天，都是情人节。',
    '你的名字，是我见过最短的情诗。',
    '你笑起来的样子，比今天的阳光还暖。',
    '想和你一起，看遍世间所有的日出日落。',
    '有你在，人间值得。',
    '今天的风很甜，因为想起了你。',
    '你是我的今天，以及所有的明天。',
    '和你聊天的时候，时间总是过得特别快。',
    '世界很大，但我的心很小，只装得下一个你。'
  ]); },
  setDailyQuotes(quotes) { this.set('dailyQuotes', quotes); },

  // === 商城 ===
  getShopCart() { return this.get('shopCart', []); },
  setShopCart(cart) { this.set('shopCart', cart); },

  // === 屏蔽字卡 ===
  getBlockedCards() { return this.get('blockedCards', []); },
  setBlockedCards(ids) { this.set('blockedCards', ids); }
};

/* 通用 UTF-8 文本读取（Promise<{text, bytes}>）：
   规避移动端部分浏览器 FileReader.readAsText 的编码嗅探不稳定 / 文本截断问题，
   优先 Blob.arrayBuffer() 一次取全字节，回退 readAsArrayBuffer，
   显式 UTF-8 解码并剥离 BOM，保证中文、Emoji 与超长 JSON 都能完整读取。 */
Storage.readFileAsUTF8 = function(file) {
  return new Promise(function(resolve, reject) {
    if (!file) { reject(new Error('未选择文件')); return; }

    function decode(buf) {
      var bytes = new Uint8Array(buf);
      var off = 0;
      // 剥离 UTF-8 BOM
      if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) off = 3;
      var text;
      if (window.TextDecoder) {
        try {
          text = new TextDecoder('utf-8').decode(bytes.subarray(off));
        } catch (e) {
          text = Storage._utf8BytesToString(bytes, off);
        }
      } else {
        text = Storage._utf8BytesToString(bytes, off);
      }
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      resolve({ text: text, bytes: bytes.length });
    }

    function viaReader() {
      var reader = new FileReader();
      reader.onerror = function() { reject(new Error('读取文件失败')); };
      reader.onload = function(ev) {
        var result = ev.target.result;
        if (result && result.byteLength !== undefined) { decode(result); }
        else if (typeof result === 'string') { resolve({ text: result, bytes: -1 }); }
        else { reject(new Error('无法读取文件内容')); }
      };
      reader.readAsArrayBuffer(file);
    }

    if (file.arrayBuffer) {
      try {
        file.arrayBuffer().then(decode).catch(viaReader);
        return;
      } catch (e) { /* fall through */ }
    }
    viaReader();
  });
};

/* 手动 UTF-8 解码兜底（极端旧环境无 TextDecoder 时） */
Storage._utf8BytesToString = function(bytes, off) {
  var out = '', i = off || 0;
  while (i < bytes.length) {
    var b = bytes[i++];
    if (b < 0x80) { out += String.fromCharCode(b); }
    else if (b < 0xE0) { out += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i++] & 0x3F)); }
    else if (b < 0xF0) {
      var c = ((b & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F);
      out += String.fromCharCode(c);
    } else {
      var cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F);
      if (cp > 0x10FFFF) continue;
      cp -= 0x10000;
      out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
    }
  }
  return out;
};

window.Storage = Storage;
window.StickerDB = StickerDB;

/* 首次加载时迁移 localStorage 旧数据到 IndexedDB */
StickerDB.migrateIfNeeded();

/* 自定义通话背景内存缓存（初始化时从 IndexedDB 加载，保证各弹窗同步读取） */
var _callBgImageCache = '';

/* 自定义通话背景持久化：IndexedDB 存储（内存无上限，跟随设备永久保持） */
var CallBgDB = (function() {
  var DB_NAME = 'mirror_call_bg_db';
  var STORE = 'call_bg';
  var db = null;
  function open() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }
  function set(key, value) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function get(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function() { resolve(req.result || ''); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }
  function del(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  return { set: set, get: get, del: del };
})();
window.CallBgDB = CallBgDB;

/* 自定义聊天背景图片持久化：IndexedDB 存储（无容量限制，跟随设备永久保持） */
var ChatBgDB = (function() {
  var DB_NAME = 'mirror_chat_bg_db';
  var STORE = 'chat_bg';
  var db = null;
  function open() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }
  function set(key, value) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function get(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function() { resolve(req.result || ''); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }
  function del(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  return { set: set, get: get, del: del };
})();
window.ChatBgDB = ChatBgDB;

/* ============================================================
   ChatImageDB: 聊天大图/大表情 IndexedDB 存储层（对标 ZY3 引用存储模式）
   聊天消息中的图片/表情若超过体积阈值，base64 存入本库，
   消息对象只保留轻量引用（__IDB_IMG__:<key>），
   大幅减小 localStorage 镜像、消息体与导出 JSON 的体积。
   ============================================================ */
var ChatImageDB = (function() {
  var DB_NAME = 'mirror_chat_image_db';
  var STORE = 'chat_images';
  var db = null;
  function open() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }
  function set(key, value) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function get(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function() { resolve(req.result || ''); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }
  function del(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function getAll() {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }
  function clear() {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  return { set: set, get: get, del: del, getAll: getAll, clear: clear };
})();
window.ChatImageDB = ChatImageDB;

/* ============================================================
   ChatMedia: 图片/表情「阈值判定」压缩 + 引用存储工具层（对标 ZY3）
   - 阈值判定：小于阈值的小图/小表情原样保存，不做无谓压缩损耗；
   - GIF 动图：任何情况下原样返回，保证动图正常播放，绝不压成静态图；
   - 大体积 base64 存入 ChatImageDB，消息仅存轻量引用，渲染时异步还原。
   ============================================================ */
var ChatMedia = {
  /* base64 长度阈值（约 37KB 原始数据），对标 ZY3 IDB_IMAGE_THRESHOLD=50000 */
  THRESHOLD: 50000,
  /* 导出抽取阈值：无 JSZip 时走 CompressionStream 兜底压缩，JSON 中媒体只能内联，
     下调该阈值可让更多小图/小表情也被抽成引用 + media，进一步减小导出体积 */
  EXPORT_THRESHOLD: 2000,
  PREFIX: '__IDB_IMG__',
  /* 1x1 透明 GIF 占位：仅用于渲染引用图时的瞬时占位，不参与任何压缩/存储 */
  PLACEHOLDER: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',

  /* 按场景设定压缩参数（对标 ZY3：小图不压、超阈值才压缩、按场景定宽/质量） */
  OPT: {
    image:    { maxWidth: 1200, quality: 0.8  }, // 聊天图片：原 480px 过小，提升至 1200px（ZY3 同宽）
    sticker:  { maxWidth: 480,  quality: 0.85 }, // 聊天表情：原 240px 过小，提升至 480px
    stickerLib:{ maxWidth: 480,  quality: 0.85 }, // 表情包库新增：静态大图阈值压缩，GIF 原样
    doodle:   { maxWidth: 480,  quality: 0.9  }, // 涂鸦：原 240px，提升至 480px
    moment:   { maxWidth: 1200, quality: 0.75 }, // 朋友圈发布图：原 800px，提升至 1200px
    momentBg: { maxWidth: 1600, quality: 0.78 }, // 朋友圈封面背景：原 1200px，提升至 1600px
    avatar:   { maxWidth: 200,  quality: 0.85 }  // 头像类：保持现状参数
  },

  isGif: function(data) {
    return !!data && String(data).indexOf('data:image/gif') === 0;
  },
  isRef: function(v) {
    return typeof v === 'string' && v.indexOf(this.PREFIX + ':') === 0;
  },
  refKey: function(v) {
    return this.isRef(v) ? v.slice(this.PREFIX.length + 1) : '';
  },
  makeRef: function(key) { return this.PREFIX + ':' + key; },

  /* 构建 HTML 时的 src 处理：引用 → 占位图 + data-media-ref 待异步还原；普通数据原样 */
  imgSrcFor: function(value) {
    if (this.isRef(value)) return { src: this.PLACEHOLDER, ref: value };
    return { src: (value || this.PLACEHOLDER), ref: '' };
  },

  /* 阈值压缩：GIF 原样；体积未超阈值原样；超过阈值且尺寸超过 maxSize 才压缩。
     压缩结果比原图更大时回退原图，任何情况不放大图片。 */
  compressSmart: function(data, opt) {
    return new Promise(function(resolve) {
      if (!data || data.indexOf('data:') !== 0) { resolve(data); return; }
      var self = ChatMedia;
      if (self.isGif(data)) { resolve(data); return; }
      var threshold = (opt && opt.threshold) || self.THRESHOLD;
      if (data.length < threshold) { resolve(data); return; }
      var maxSize = (opt && opt.maxWidth) || 1200;
      var quality = (opt && opt.quality) || 0.8;
      var img = new Image();
      img.onload = function() {
        try {
          // 尺寸已小于 maxSize 时不强行重压（仅体积超阈值也原样，避免无谓损耗）
          if (img.width <= maxSize && img.height <= maxSize) { resolve(data); return; }
          var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var out = canvas.toDataURL('image/jpeg', quality);
          if (out && out.length < data.length) { resolve(out); return; }
        } catch (e) {}
        resolve(data);
      };
      img.onerror = function() { resolve(data); };
      img.src = data;
    });
  },

  /* 消息落库存储：大体积 base64 存 ChatImageDB 返回引用；小图/GIF/已是引用原样返回 */
  storeForMessage: function(data, key) {
    var self = this;
    if (!data || data.indexOf('data:') !== 0) return Promise.resolve(data);
    if (self.isRef(data)) return Promise.resolve(data);
    if (data.length < self.THRESHOLD) return Promise.resolve(data);
    return ChatImageDB.set(key, data).then(function() {
      return self.makeRef(key);
    }).catch(function() {
      return data; // IDB 不可用时回退内联，保证消息不丢
    });
  },

  /* 解析引用 → 真实 base64；非引用原样返回；引用缺失返回占位图（旧数据无引用不受影响） */
  getData: function(v) {
    var self = this;
    if (!self.isRef(v)) return Promise.resolve(v);
    var key = self.refKey(v);
    return ChatImageDB.get(key).then(function(data) {
      return data || self.PLACEHOLDER;
    }).catch(function() { return self.PLACEHOLDER; });
  },

  /* 异步填充 DOM 中所有 [data-media-ref] 的图片（全量渲染 / 增量追加统一走这里）。
     参数 onRefsDone 可选：所有引用图片填充完成（含加载成功/失败/已卸载）后调用一次，
     用于发送消息后图片撑高容器时重新滚动到底，解决"刚发送的内容卡半显示"问题。 */
  resolveDomRefs: function(rootEl, onRefsDone) {
    var settle = function() { if (onRefsDone) { var cb = onRefsDone; onRefsDone = null; cb(); } };
    if (!rootEl || !rootEl.querySelectorAll) { settle(); return; }
    var imgs = rootEl.querySelectorAll('img[data-media-ref]');
    if (!imgs.length) { settle(); return; }
    var pending = imgs.length;
    var done = function() {
      pending--;
      if (pending <= 0) settle();
    };
    for (var i = 0; i < imgs.length; i++) {
      (function(img) {
        var ref = img.getAttribute('data-media-ref');
        if (!ref) { done(); return; }
        ChatMedia.getData(ref).then(function(src) {
          if (typeof img.isConnected === 'boolean' && !img.isConnected) { done(); return; }
          img.removeAttribute('data-media-ref');
          img.src = src;
          // 图片真正加载完成（撑高容器）后再计入完成，确保回调拿到最终高度
          var fired = false;
          var finish = function() { if (fired) return; fired = true; done(); };
          if (img.complete && img.naturalWidth) { finish(); return; }
          img.addEventListener('load', finish);
          img.addEventListener('error', finish);
          setTimeout(finish, 800); // 加载超时兜底，避免回调悬挂
        });
      })(imgs[i]);
    }
  },

  /* 删除消息时清理其引用的 IDB 大图（含撤回内容/引用内容里的引用） */
  cleanupMsg: function(msg) {
    var self = this;
    var keys = [];
    function pick(obj) {
      ['stickerData', 'imageData'].forEach(function(f) {
        if (obj && obj[f] && self.isRef(obj[f])) keys.push(self.refKey(obj[f]));
      });
    }
    pick(msg);
    if (msg) { pick(msg.recalledContent); pick(msg.quote); }
    var unique = {};
    keys.forEach(function(k) { unique[k] = true; });
    var jobs = Object.keys(unique).map(function(k) {
      return ChatImageDB.del(k).catch(function() {});
    });
    return Promise.all(jobs);
  },

  /* 导出专用压缩：GIF 原样；未超阈值原样；静态图超阈值 → 缩放到 maxWidth 内 + JPEG 降质。
     透明 PNG 检测到透明像素回退原图（避免 jpeg 黑底）；压缩结果更大回退原图。
     目的：单 JSON 自包含导出，保证图片清晰度前提下把体积压下来。 */
  compressForExport: function(data, opt) {
    return new Promise(function(resolve) {
      if (!data || data.indexOf('data:') !== 0) { resolve(data); return; }
      var self = ChatMedia;
      if (self.isGif(data)) { resolve(data); return; }
      var threshold = (opt && opt.threshold) || self.EXPORT_THRESHOLD;
      if (data.length < threshold) { resolve(data); return; }
      var maxSize = (opt && opt.maxWidth) || 1200;
      var quality = (opt && opt.quality) || 0.8;
      var img = new Image();
      img.onload = function() {
        try {
          var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var hasTrans = false;
          try {
            var sample = ctx.getImageData(0, 0, w, h);
            var px = sample.data;
            for (var i = 3; i < px.length; i += 28) { // 稀疏抽样 alpha
              if (px[i] < 250) { hasTrans = true; break; }
            }
          } catch (e) {}
          if (hasTrans) { resolve(data); return; } // 透明图：jpeg 会黑底，回退原图
          var out = canvas.toDataURL('image/jpeg', quality);
          if (out && out.length < data.length) { resolve(out); return; }
        } catch (e) {}
        resolve(data);
      };
      img.onerror = function() { resolve(data); };
      img.src = data;
    });
  },

  /* 导出瘦身 v4（单条消息）：引用 → 读取 IDB 原图压缩后写入 mediaMap（同 key 共享只压一次）；
     内联大 base64 → 压缩后直接内联（不再抽引用），保证 JSON 自包含。 */
  collectMsgMedia: function(msg, mediaMap, seqBox, threshold) {
    var self = this;
    var t = threshold || self.THRESHOLD;
    var jobs = [];
    function pick(obj, f, opt) {
      var v = obj && obj[f];
      if (!v || typeof v !== 'string') return;
      if (v.indexOf('data:') !== 0 && !self.isRef(v)) return;
      if (self.isRef(v)) {
        var k = self.refKey(v);
        if (mediaMap[k]) return; // 同 key 共享，已处理
        jobs.push(ChatImageDB.get(k).then(function(data) {
          if (!data) return null;
          return self.compressForExport(data, opt).then(function(c) {
            mediaMap[k] = c;
            return null;
          });
        }).catch(function() { return null; }));
        return;
      }
      if (v.length > t) {
        jobs.push(self.compressForExport(v, opt).then(function(c) {
          if (c !== v) obj[f] = c; // 压缩有效才替换（透明/更大回退保持原值）
          return null;
        }));
      }
    }
    pick(msg, 'stickerData', self.OPT.sticker);
    pick(msg, 'imageData', self.OPT.image);
    if (msg) {
      pick(msg.recalledContent, 'stickerData', self.OPT.sticker);
      pick(msg.recalledContent, 'imageData', self.OPT.image);
      pick(msg.quote, 'stickerData', self.OPT.sticker);
      pick(msg.quote, 'imageData', self.OPT.image);
    }
    return Promise.all(jobs);
  },

  /* 导出瘦身（全部消息）：遍历所有聊天的消息数组，收集 media 并替换大 base64 为引用 */
  prepareExportMessages: function(messagesObj, mediaMap, seqBox, threshold) {
    var self = this;
    var jobs = [];
    Object.keys(messagesObj).forEach(function(cid) {
      var list = messagesObj[cid];
      if (!Array.isArray(list)) return;
      list.forEach(function(msg) {
        if (!msg) return;
        jobs.push(self.collectMsgMedia(msg, mediaMap, seqBox, threshold));
      });
    });
    return Promise.all(jobs);
  },

  /* 导出瘦身 v4（表情包）：深拷贝副本上，引用 → 读取原图压缩后写入 mediaMap（共享去重）；
     内联大 base64 → 压缩后内联（GIF 仅搬运不压缩）。真实表情库不动。 */
  collectStickersForExport: function(stickers, mediaMap, seqBox, threshold) {
    var self = this;
    var t = threshold || self.THRESHOLD;
    var copy = (stickers || []).map(function(s) {
      try { return JSON.parse(JSON.stringify(s)); } catch (e) { return s; }
    });
    var jobs = [];
    copy.forEach(function(s) {
      if (!s || !s.data || typeof s.data !== 'string' || s.data.indexOf('data:') !== 0) return;
      if (self.isRef(s.data)) {
        var k = self.refKey(s.data);
        if (!mediaMap[k]) {
          jobs.push(ChatImageDB.get(k).then(function(d) {
            if (!d) return null;
            return self.compressForExport(d, self.OPT.stickerLib).then(function(c) {
              mediaMap[k] = c;
              return null;
            });
          }).catch(function() { return null; }));
        }
        return;
      }
      if (s.data.length > t) {
        jobs.push(self.compressForExport(s.data, self.OPT.stickerLib).then(function(c) {
          if (c !== s.data) s.data = c;
          return null;
        }));
      }
    });
    return Promise.all(jobs).then(function() { return copy; });
  },

  /* base64 dataURL → 二进制字节 + mime（ZIP 媒体文件写入用，无损搬运） */
  dataUrlToBinary: function(dataUrl) {
    var mime = 'image/png';
    var b64 = String(dataUrl || '');
    var comma = b64.indexOf(',');
    if (comma >= 0) {
      var m = /^data:([^;]+)/.exec(b64.slice(0, comma));
      if (m) mime = m[1];
      b64 = b64.slice(comma + 1);
    }
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: mime, bytes: bytes };
  },

  /* 二进制字节 + mime → base64 dataURL（ZIP 媒体文件读取还原用） */
  binaryToDataUrl: function(mime, bytes) {
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return 'data:' + (mime || 'image/png') + ';base64,' + btoa(bin);
  },

  /* 导入恢复：把 media 写回 ChatImageDB（消息中的引用保持不变，渲染时异步还原）。
     ChatImageDB.set 内部等待每条写入事务 oncomplete 后才 resolve，
     返回的 Promise.all 保证所有媒体写入完成，调用方（导出导入链）await 后可安全继续。 */
  restoreMedia: function(mediaMap) {
    var jobs = [];
    if (mediaMap && typeof mediaMap === 'object') {
      Object.keys(mediaMap).forEach(function(k) {
        jobs.push(ChatImageDB.set(k, mediaMap[k]).catch(function() {}));
      });
    }
    return Promise.all(jobs);
  },

  /* 表情库导入：引用 → 从 ChatImageDB 还原为完整 base64（表情库渲染直接 <img src>，不依赖异步解析） */
  resolveStickerForImport: function(sticker) {
    var self = this;
    if (!sticker || !self.isRef(sticker.data)) return Promise.resolve(sticker);
    var key = self.refKey(sticker.data);
    return ChatImageDB.get(key).then(function(data) {
      if (data) sticker.data = data; // 有数据还原；无则保留引用由渲染兜底
      return sticker;
    }).catch(function() { return sticker; });
  }
};
window.ChatMedia = ChatMedia;

/* 自定义音效文件持久化：IndexedDB 存储（接收/发送/来电铃声等上传的 mp3，跟随设备永久保存） */
var SoundFileDB = (function() {
  var DB_NAME = 'mirror_sound_file_db';
  var STORE = 'sound_files';
  var db = null;
  function open() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }
  function set(key, value) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function get(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function() { resolve(req.result || ''); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }
  function del(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  return { set: set, get: get, del: del };
})();
window.SoundFileDB = SoundFileDB;

/* 首页相框照片持久化：IndexedDB 存储（无容量限制，跟随设备永久保存原始图片） */
var JournalPhotoDB = (function() {
  var DB_NAME = 'mirror_journal_photo_db';
  var STORE = 'journal_photos';
  var db = null;
  function open() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      if (!window.indexedDB) { reject(new Error('no-idb')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }
  function set(key, value) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function get(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function() { resolve(req.result || ''); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }
  function del(key) {
    return open().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  return { set: set, get: get, del: del };
})();
window.JournalPhotoDB = JournalPhotoDB;


/* 启动时从 IndexedDB 恢复自定义通话背景 */
(function loadCallBgFromDB() {
  CallBgDB.get('image').then(function(img) {
    if (img) {
      _callBgImageCache = img;
      Storage.set('callBgImage', img);
    }
  }).catch(function(){});
})();

/* ============================================================
   页面隐藏/刷新前兜底：将内存中的消息与聊天列表再写入 IndexedDB，
   尽可能保证最后几条记录在刷新/关闭时也能落盘（配合串行写队列，丢失窗口极小）。
   监听三类事件：pagehide（刷新/关闭/跳转）、visibilitychange（切后台/切标签）、
   beforeunload（部分浏览器仅触发该事件），任一触发即执行刷写。
   ============================================================ */
(function installPagehideFlush() {
  function flushToDB() {
    try {
      // 先刷写待写的 localStorage 消息镜像（防抖窗口内的最近消息落盘，防止刷新丢失）
      if (Storage._flushMessagesMirrors) Storage._flushMessagesMirrors();
      var keys = Object.keys(Storage._msgCache || {});
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf('msg_') !== 0) continue;
        var chatId = k.slice(4);
        var msgs = Storage._msgCache[k];
        if (chatId && Array.isArray(msgs) && msgs.length && window.MessageDB) {
          MessageDB.set(chatId, msgs).catch(function() {});
        }
      }
      if (Storage._chatsCache && window.MessageDB) {
        MessageDB.setMeta('chats', Storage._chatsCache).catch(function() {});
      }
      if (Storage._groupChatsCache && window.MessageDB) {
        MessageDB.setMeta('groupChats', Storage._groupChatsCache).catch(function() {});
      }
    } catch (e) {}
  }
  window.addEventListener('pagehide', flushToDB);
  window.addEventListener('beforeunload', flushToDB);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') flushToDB();
  });
})();




/* ================================================================
   全局字体设置：FontManager (粘贴链接应用/恢复/重置)
   仅持久化来源信息（type/url/name），不存字体二进制，避免占用存储空间
   ================================================================ */
const FontManager = {
  FONT_FAMILY: 'GlobalFont',
  META_KEY: 'globalFontMeta',
  _applied: false,
  _face: null,
  _restoring: null,
  _cancelRestore: false,
  _gen: 0,                 // 代次计数器：每次新恢复/应用/重置递增，使更早的字体加载结果失效
  _retryRegistered: false, // 已注册 IDB 回填监听标志（防重复注册）

  /* 应用启动/进入外观设置页时恢复已保存的全局字体并同步 UI。
     防重入：App.init 与 renderAppearance 均会触发，避免大字体重复下载；
     失败自动重试一次，仍失败则给出可见提示（刷新后不再无声回退系统字体）。 */
  restore: function() {
    var self = this;
    var meta = Storage.get(this.META_KEY, null);
    if (!meta || !meta.url) {
      // 本地镜像缺失（清缓存/隐私模式/配额满）：AppKVDB（IndexedDB 权威层）
      // 回填晚于恢复触发时会漏恢复，注册监听待回填后补恢复
      this._waitIDBBackfill();
      this.syncUI();
      return Promise.resolve(false);
    }
    this.syncUI(meta.name);
    // 关键修复：不能用 document.fonts.check 判断字体是否已注册！
    // 未注册 family 时 check 对"空字体集合"恒返回 true（假阳性），
    // 导致刷新后跳过真实下载、直接插入未注册的 GlobalFont → 渲染回退系统字体。
    // 正确依据：本会话是否真实加载过 FontFace（_face）并成功应用（_applied）。
    if (this._applied && this._face) {
      this.applyToBody();
      return Promise.resolve(true);
    }
    // 防重入：同一恢复流程进行中直接复用，避免 21MB 级大字体并发下载
    if (this._restoring) return this._restoring;
    this._cancelRestore = false;
    var attempt = function(n) {
      return self.applyUrl(meta.url, { save: false, source: meta.source }).then(function() {
        self._restoring = null;
        return true;
      }).catch(function(e) {
        if (n < 2) {
          console.warn('全局字体链接恢复失败，1.5s 后重试 (' + n + '/2):', e);
          return new Promise(function(resolve) { setTimeout(resolve, 1500); }).then(function() {
            return attempt(n + 1);
          });
        }
        self._restoring = null;
        console.warn('全局字体链接恢复失败（已重试）:', e);
        Core.toast('字体链接恢复失败，请检查网络或链接是否有效');
        return false;
      });
    };
    this._restoring = attempt(1);
    return this._restoring;
  },

  /* 注入 FontFace 并替换旧 face，避免同 family 重复堆积；带 90s 超时兜底 */
  _applyFace: function(face) {
    var self = this;
    var gen = ++this._gen; // 每次新操作（恢复/应用/重置）使更早的加载结果过期
    var timer = null;
    var timeout = new Promise(function(_, reject) {
      timer = setTimeout(function() {
        reject(new Error('字体加载超时（90 秒），请检查网络或改用体积较小的字体'));
      }, 90000);
    });
    return Promise.race([face.load(), timeout]).then(function() {
      clearTimeout(timer);
      // 用户可能在加载期间重置/切换了字体：取消本次应用，
      // 避免旧字体"复活"覆盖系统字体或覆盖用户刚应用的新字体
      if (self._cancelRestore || gen !== self._gen) throw new Error('字体恢复已取消');
      if (self._face && document.fonts) {
        try { document.fonts.delete(self._face); } catch (e) {}
      }
      self._face = face;
      if (document.fonts) document.fonts.add(face);
      self.applyToBody();
      self._applied = true;
      return face;
    }, function(e) {
      clearTimeout(timer);
      throw e;
    });
  },

  /* ttf/woff/woff2 直链：new FontFace(family, 'url(链接)') 加载验证 */
  _applyTtfUrl: function(url) {
    return this._applyFace(new FontFace(this.FONT_FAMILY, 'url(' + url + ')'));
  },

  /* CSS 链接：fetch 解析 @font-face 的 src url，取其首个字体文件加载 */
  _applyCssUrl: function(url) {
    var self = this;
    return fetch(url).then(function(res) {
      if (!res.ok) throw new Error('CSS 加载失败 HTTP ' + res.status);
      return res.text();
    }).then(function(cssText) {
      var src = (cssText.match(/src:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i) || [])[1];
      if (!src) throw new Error('CSS 中未找到 @font-face src');
      if (src.indexOf('data:') === 0) throw new Error('不支持 data: 内嵌字体');
      var fontUrl = src;
      if (/^https?:\/\//i.test(src)) {
        fontUrl = src;
      } else if (src.indexOf('//') === 0) {
        fontUrl = 'https:' + src;
      } else {
        fontUrl = new URL(src, url).href;
      }
      return self._applyFace(new FontFace(self.FONT_FAMILY, 'url(' + fontUrl + ')'));
    });
  },

  /* 从链接推断字体名称（去后缀与查询参数） */
  _nameFromUrl: function(url) {
    var clean = String(url).split('?')[0].split('#')[0];
    var name = clean.split('/').pop() || '字体';
    return name.replace(/\.(ttf|woff2?|otf|css)$/i, '') || '自定义字体';
  },

  /* 应用粘贴的字体链接：.css 走 CSS 解析，其余按字体文件直链处理；验证成功才落库 */
  applyUrl: function(url, opts) {
    var self = this;
    opts = opts || {};
    var trimmed = String(url || '').trim();
    if (!trimmed) {
      Core.toast('请先粘贴字体链接');
      return Promise.reject(new Error('empty url'));
    }
    var source = opts.source || (/\.css($|\?)/i.test(trimmed) ? 'css' : 'ttf');
    var task = (source === 'css') ? this._applyCssUrl(trimmed) : this._applyTtfUrl(trimmed);
    return task.then(function() {
      var name = self._nameFromUrl(trimmed);
      if (opts.save !== false) {
        Storage.set(self.META_KEY, { type: 'url', source: source, url: trimmed, name: name, time: Date.now() });
      }
      self.syncUI(name);
      if (opts.save !== false) Core.toast('全局字体已应用并保存');
      return name;
    }).catch(function(e) {
      console.warn('字体链接应用失败:', e);
      if (opts.save !== false) Core.toast('字体链接加载失败，请检查链接或 CORS 是否允许');
      throw e;
    });
  },

  /* 设置页输入框应用按钮入口 */
  applyUrlInput: function() {
    var input = document.getElementById('global-font-url');
    if (!input) return;
    var url = input.value.trim();
    if (!url) {
      Core.toast('请先粘贴字体链接');
      return;
    }
    input.disabled = true;
    // 清除 reset 的取消标记；进行中的旧恢复/应用由 _gen 代次机制自动失效
    this._cancelRestore = false;
    // 字体文件可能很大（如 21MB），下载需数十秒，先给加载中反馈，避免误以为无反应
    Core.toast('正在加载字体，请稍候…', 60000);
    var self = this;
    try {
      // applyUrl 内部成功/失败都会 toast；这里只负责恢复输入框，并兜底同步异常
      self.applyUrl(url).catch(function(e) {
        console.warn('字体链接应用失败:', e);
        input.disabled = false;
      }).then(function() {
        input.disabled = false;
      });
    } catch (e) {
      console.error('字体链接应用同步异常:', e);
      Core.toast('字体链接加载失败，请检查链接或 CORS 是否允许');
      input.disabled = false;
    }
  },

  /* 给 body 内联 font-family 前缀插入 GlobalFont（保留原静态字体栈/兜底） */
  applyToBody: function() {
    var cur = document.body.style.fontFamily;
    if (cur && cur.indexOf("'GlobalFont'") !== -1) return;
    var stack = getComputedStyle(document.body).fontFamily || '';
    stack = stack.replace(/^'?GlobalFont'?\s*,\s*/, '');
    document.body.style.fontFamily = "'GlobalFont', " + stack;
  },

  /* 恢复系统默认：删除元信息并移除 body 内联覆盖 */
  resetToSystem: function() {
    this._applied = false;
    this._gen++; // 使进行中的恢复/应用加载结果失效，防止异步加载完成后"复活"字体
    this._cancelRestore = true;
    Storage.remove(this.META_KEY);
    document.body.style.removeProperty('font-family');
    this.syncUI();
    Core.toast('已恢复系统字体');
  },

  /* 同步设置页链接输入框（当前字体名称显示条目已移除） */
  syncUI: function() {
    var input = document.getElementById('global-font-url');
    if (input) {
      var m = Storage.get(this.META_KEY, null);
      input.value = (m && m.url) ? m.url : '';
    }
  },

  /* 本地镜像缺失（清缓存/隐私模式/配额满）时，等待 AppKVDB（IndexedDB 权威层）
     回填 globalFontMeta 后补恢复字体。listener 一次性注册（防重复累积），
     每次事件触发都会检查：meta 已回填且本会话未应用且无进行中恢复 → 重新 restore。 */
  _waitIDBBackfill: function() {
    var self = this;
    if (this._retryRegistered) return;
    this._retryRegistered = true;
    var tryOnce = function() {
      var meta = Storage.get(self.META_KEY, null);
      if (meta && meta.url && !self._applied && !self._restoring) {
        self.restore();
      }
    };
    window.addEventListener('mirror-storage-restored', function(e) {
      if (!e.detail || e.detail.key !== 'globalFontMeta') return;
      tryOnce();
    });
    window.addEventListener('mirror-storage-synced', function() {
      tryOnce();
    });
  }
};

window.FontManager = FontManager;
