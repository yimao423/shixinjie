/* === 初始化 === */
document.addEventListener('DOMContentLoaded', () => App.init());

/* === 启动时从 IndexedDB 恢复聊天记录（彻底修复刷新丢失） === */
/* 消息数组版本号：以最新消息 id 为主、条数为辅，用于比较 localStorage 与 IndexedDB 哪个更新 */
function _msgArrayVersion(msgs) {
  var newestId = 0;
  var len = msgs ? msgs.length : 0;
  if (Array.isArray(msgs)) {
    for (var i = 0; i < msgs.length; i++) {
      var id = msgs[i] && msgs[i].id ? msgs[i].id : 0;
      if (id > newestId) newestId = id;
    }
  }
  return newestId * 100000 + (len % 100000);
}
/* 合并两条消息（按 id 去重，按 time/id 升序），保留双方独有消息，杜绝覆盖丢记录 */
function _mergeMessageArrays(a, b) {
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
}

function restoreMessagesFromIDB() {
  if (!window.MessageDB) return;
  // 1) localStorage 与 IndexedDB 双向智能同步：只允许“更新的一方”覆盖旧的一方，
  //    绝不能用 localStorage 旧快照覆盖 IndexedDB 中更新的记录（这是此前刷新丢记录的根因）
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('mirror_msg_') === 0) keys.push(k);
    }
  } catch (e) {}
  var syncTasks = [];
  keys.forEach(function(k) {
    var chatId = k.slice('mirror_msg_'.length);
    try {
      var lsVal = JSON.parse(localStorage.getItem(k) || 'null');
      if (!chatId || !Array.isArray(lsVal) || !lsVal.length) return;
      syncTasks.push(MessageDB.get(chatId).then(function(record) {
        var dbMsgs = record && Array.isArray(record.messages) ? record.messages : null;
        var lsVer = _msgArrayVersion(lsVal);
        var dbVer = dbMsgs ? _msgArrayVersion(dbMsgs) : -1;
        if (dbVer < 0) {
          // IDB 无记录：把 localStorage 迁入 IDB
          return MessageDB.set(chatId, lsVal);
        }
        if (lsVer > dbVer) {
          // localStorage 更新：覆盖 IDB
          return MessageDB.set(chatId, lsVal);
        }
        if (lsVer < dbVer) {
          // IDB 更新（上一会话新消息未同步回 localStorage）：反向把 IDB 写回 localStorage，保留 IDB 最新数据
          try { localStorage.setItem(k, JSON.stringify(dbMsgs)); } catch (e2) {}
        }
        // 版本相同但内容可能不同：合并双方，保留各自独有消息，避免任何一侧丢失
        if (lsVer === dbVer) {
          var merged = _mergeMessageArrays(lsVal, dbMsgs);
          try { localStorage.setItem(k, JSON.stringify(merged)); } catch (e2) {}
          return MessageDB.set(chatId, merged);
        }
        return Promise.resolve();
      }).catch(function() { return MessageDB.set(chatId, lsVal); }));
    } catch (e) {}
  });
  // 2) 从 IndexedDB 读取全量聊天记录回填内存缓存，并刷新当前聊天页
  Promise.all(syncTasks).catch(function() {}).then(function() {
    return MessageDB.getAll();
  }).then(function(records) {
    if (!records || !records.length) return;
    records.forEach(function(r) {
      // 跳过 meta 记录（__meta_* 为聊天列表等数据，另行恢复）
      if (r && typeof r.chatId === 'string' && r.chatId.indexOf('__meta_') === 0) return;
      if (r && r.chatId && Array.isArray(r.messages)) {
        var cacheKey = 'msg_' + r.chatId;
        var updatedAt = r.updatedAt || 0;
        var curUpdatedAt = Storage._msgUpdatedAt[cacheKey] || 0;
        if (updatedAt < curUpdatedAt) {
          // 内存已有更新数据（用户已操作）：与 IDB 合并，保留双方独有消息
          Storage._msgCache[cacheKey] = _mergeMessageArrays(Storage._msgCache[cacheKey], r.messages);
          Storage._msgUpdatedAt[cacheKey] = Date.now();
          if (window.MessageDB) MessageDB.set(r.chatId, Storage._msgCache[cacheKey]).catch(function() {});
          try { localStorage.setItem('mirror_msg_' + r.chatId, JSON.stringify(Storage._msgCache[cacheKey])); } catch (e) {}
          return;
        }
        Storage._msgCache[cacheKey] = r.messages;
        Storage._msgUpdatedAt[cacheKey] = updatedAt;
        // 尽力写回 localStorage，下次启动可同步读取，减少异步窗口
        try { localStorage.setItem('mirror_msg_' + r.chatId, JSON.stringify(r.messages)); } catch (e) {}
      }
    });
    var page = document.getElementById('page-chat-room');
    var chatId = page ? page.dataset.chatId : '';
    if (chatId && typeof renderChatMessages === 'function') {
      renderChatMessages(chatId);
    }
  }).catch(function() {});
}

/* 启动时从 IndexedDB 恢复聊天列表/群聊列表（localStorage 超限/清空后的兜底） */
function restoreMetaFromIDB() {
  if (!window.MessageDB) return;
  Promise.all([
    MessageDB.getMeta('chats'),
    MessageDB.getMeta('groupChats')
  ]).then(function(res) {
    var changed = false;
    if (res[0] && Array.isArray(res[0].messages)) {
      var updChats = res[0].updatedAt || 0;
      if (updChats > (Storage._metaUpdatedAt['chats'] || 0)) {
        Storage._chatsCache = res[0].messages;
        Storage._metaUpdatedAt['chats'] = updChats;
        try { localStorage.setItem('mirror_chats', JSON.stringify(res[0].messages)); } catch (e) {}
        changed = true;
      }
    }
    if (res[1] && Array.isArray(res[1].messages)) {
      var updGroups = res[1].updatedAt || 0;
      if (updGroups > (Storage._metaUpdatedAt['groupChats'] || 0)) {
        Storage._groupChatsCache = res[1].messages;
        Storage._metaUpdatedAt['groupChats'] = updGroups;
        try { localStorage.setItem('mirror_groupChats', JSON.stringify(res[1].messages)); } catch (e) {}
        changed = true;
      }
    }
    if (changed && typeof Navigation !== 'undefined' && typeof Navigation._renderChatList === 'function') {
      Navigation._renderChatList();
    }
  }).catch(function() {});
}
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(restoreMessagesFromIDB, 200);
  setTimeout(restoreMetaFromIDB, 300);
  // 全局存储架构升级：通用键双向同步（localStorage <-> AppKVDB）+ 申请持久化存储
  setTimeout(function() {
    if (window.Storage && typeof Storage.syncAllFromIDB === 'function') {
      Storage.syncAllFromIDB();
    }
    if (window.Storage && typeof Storage.requestPersist === 'function') {
      Storage.requestPersist();
    }
  }, 250);
  // 相册功能已移除：一次性清理遗留数据（localStorage 相册键 + IndexedDB 相册库），
  // 幂等执行，避免旧浏览器会话残留数据占用空间；同时检测 IndexedDB 可用性并给出引导
  setTimeout(function() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('mirror_album') === 0 || k.indexOf('mirror_photos') === 0 || k === 'mirror___ts_photos')) {
          keys.push(k);
        }
      }
      keys.forEach(function(k) { try { localStorage.removeItem(k); } catch (e) {} });
      if (keys.length) console.log('[cleanup] removed album legacy localStorage keys:', keys.length);
    } catch (e) {}
    if (window.indexedDB) {
      try { window.indexedDB.deleteDatabase('mirror_album_photo_db'); } catch (e) {}
      try { window.indexedDB.deleteDatabase('mirror_album_meta_db'); } catch (e) {}
    }
    if (typeof Storage._checkIndexedDBAvailability === 'function') {
      Storage._checkIndexedDBAvailability();
    }
  }, 500);
  // PC 端鼠标滚轮横向滚动涂鸦工具栏（移动端触摸滑动正常）
  document.querySelectorAll('.doodle-tool-row').forEach(function(row) {
    row.addEventListener('wheel', function(e) {
      if (row.scrollWidth > row.clientWidth) {
        e.preventDefault();
        row.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  });
});

window.openChatRoom = openChatRoom;
window.sendMessage = sendMessage;
window.onChatInputKey = onChatInputKey;
window.renderWordCards = renderWordCards;
window.renderWordCardQuotes = renderWordCardQuotes;
window.renderWordCardMain = renderWordCardMain;
window.renderWordCardMainGroup = renderWordCardMainGroup;
window.renderWordCardKaomoji = renderWordCardKaomoji;
window.renderWordCardKaomojiGroup = renderWordCardKaomojiGroup;
window.openKaomojiGroup = openKaomojiGroup;
window.editKaomojiItem = editKaomojiItem;
window.saveKaomojiInline = saveKaomojiInline;
window.deleteKaomojiItem = deleteKaomojiItem;
window.addKaomoji = addKaomoji;
window.addKaomojiToGroup = addKaomojiToGroup;
window.importKaomojiJSON = importKaomojiJSON;
window.exportKaomojiJSON = exportKaomojiJSON;
window.deduplicateKaomojis = deduplicateKaomojis;
window.importUniversalJSON = importUniversalJSON;
window.renderWordCardPat = renderWordCardPat;
window.renderWordCardPatGroup = renderWordCardPatGroup;
window.openPatGroup = openPatGroup;
window.addPatGroup = addPatGroup;
window.addPatToGroup = addPatToGroup;
window.editPatItem = editPatItem;
window.deletePatItem = deletePatItem;
window.sendPatFromWordcard = sendPatFromWordcard;
window.importPatsJSON = importPatsJSON;
window.exportPatsJSON = exportPatsJSON;
window.deduplicatePats = deduplicatePats;
window.renderWordCardEmoji = renderWordCardEmoji;
window.renderWordCardEmojiGroup = renderWordCardEmojiGroup;
window.openEmojiGroup = openEmojiGroup;
window.onEmojiClick = onEmojiClick;
window.selectEmojisInGroup = selectEmojisInGroup;
window.deleteSelectedEmojis = deleteSelectedEmojis;
window.addEmoji = addEmoji;
window.addEmojiToGroup = addEmojiToGroup;
window.importEmojiJSON = importEmojiJSON;
window.exportEmojiJSON = exportEmojiJSON;
window.deduplicateEmojis = deduplicateEmojis;
window.openWordCardGroup = openWordCardGroup;
window.addWordCard = addWordCard;
window.addWordCardGroup = addWordCardGroup;
window.selectWordCardsInGroup = selectWordCardsInGroup;
window.selectAllInGroup = selectAllInGroup;
window.toggleCardSelection = toggleCardSelection;
window.moveSelectedCardsInGroup = moveSelectedCardsInGroup;
window._doMoveCards = _doMoveCards;
window._closeMoveGroupPicker = _closeMoveGroupPicker;
window.editWordCardGroupName = editWordCardGroupName;
window.deleteWordCardGroupItem = deleteWordCardGroupItem;
window.editWordCard = editWordCard;
window.deleteWordCardItem = deleteWordCardItem;
window.addCardToGroup = addCardToGroup;
window.exportCardsJSON = exportCardsJSON;
window.deduplicateAllCards = deduplicateAllCards;
window.searchWordCards = searchWordCards;
window.clearWordCardSearch = clearWordCardSearch;
window.toggleSearchGroup = toggleSearchGroup;
window.editSearchCard = editSearchCard;
window.deleteSearchCardItem = deleteSearchCardItem;
window.copyCardText = copyCardText;
window.copyEmoji = copyEmoji;
window.importCardsJSON = importCardsJSON;
window.renderMoments = renderMoments;
window.renderDailyRecords = renderDailyRecords;
window.changeCalendarMonth = changeCalendarMonth;
window.selectCalendarDate = selectCalendarDate;
window.addDailyRecord = addDailyRecord;
window.editDailyRecord = editDailyRecord;
window.deleteDailyRecord = deleteDailyRecord;
window.renderSettings = renderSettings;
window.renderAccountSettings = renderAccountSettings;
window.editMyAccount = editMyAccount;
window.editPartnerAccount = editPartnerAccount;
window.addPartnerAccount = addPartnerAccount;
window.saveAccount = saveAccount;
window.closeAccountModal = closeAccountModal;
window.deletePartnerAccount = deletePartnerAccount;
window._toggleAvatarShape = _toggleAvatarShape;
window.renderAppearance = renderAppearance;
window.changeFontSize = changeFontSize;
window.renderChatSettings = renderChatSettings;
window.renderFeatureSettings = renderFeatureSettings;
window.renderPaceSettings = renderPaceSettings;
window.renderSoundSettings = renderSoundSettings;
window.chatSettingToggle = chatSettingToggle;
window.chatSetTimestamp = chatSetTimestamp;
window.chatSetReplyDelay = chatSetReplyDelay;
window.chatSetProactiveInterval = chatSetProactiveInterval;
window.chatSetSound = chatSetSound;
window.chatSetSoundVolume = chatSetSoundVolume;
window.chatUploadSound = chatUploadSound;
window.previewSound = previewSound;
window.renderDataManage = renderDataManage;
window.exportChats = exportChats;
window.clearChats = clearChats;
window.clearCards = clearCards;
window.importChats = importChats;
window.exportFullBackup = exportFullBackup;
window.importFullBackup = importFullBackup;
window.resetAllData = resetAllData;
window.renderAbout = renderAbout;
window.JournalCard = JournalCard;
/* 注意：renderDailyQuotes 等 7 个每日一言绑定的函数定义于 js/modules.js，
   而 index.html 中 modules.js 在 init.js 之后加载。若在此绑定会在顶层读取未声明变量
   抛 ReferenceError，中断后续 renderWordCardStickers 等所有绑定。故已迁至 modules.js 末尾。 */
window.renderWordCardStickers = renderWordCardStickers;
window.openStickerGroup = openStickerGroup;
window.renderWordCardStickersGroup = renderWordCardStickersGroup;
window._toggleStickerSelected = _toggleStickerSelected;
window.cancelStickerSelection = cancelStickerSelection;
window.deleteSelectedStickers = deleteSelectedStickers;
window.batchUploadStickers = batchUploadStickers;
window.addStickerGroup = addStickerGroup;
window.renameStickerCategory = renameStickerCategory;
window.deleteStickerCategory = deleteStickerCategory;
window.moveStickersToGroup = moveStickersToGroup;
window._doMoveStickers = _doMoveStickers;
window._closeStickerMovePicker = _closeStickerMovePicker;
window.toggleStickerBlock = toggleStickerBlock;
window.deduplicateAllStickers = deduplicateAllStickers;
window.exportStickerGroupJSON = exportStickerGroupJSON;
window.exportAllStickersJSON = exportAllStickersJSON;
window.deduplicateStickerGroup = deduplicateStickerGroup;
window.importStickersJSON = importStickersJSON;


