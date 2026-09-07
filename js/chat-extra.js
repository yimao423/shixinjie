/* === 加号菜单 === */

function togglePlusMenu() {
  var panel = document.getElementById('plus-panel');
  if (!panel) return;
  if (panel.classList.contains('active')) {
    closePlusMenu();
  } else {
    openPlusMenu();
  }
}

function openPlusMenu() {
  var panel = document.getElementById('plus-panel');
  var area = document.getElementById('chat-panel-area');
  if (!panel || !area) return;
  
  // 点击菜单按钮只弹面板，不弹输入法
  var input = document.getElementById('chat-input');
  if (input) input.blur();
  
  // 面板高度跟随键盘高度：先重新测量再应用，避免残留过期键盘高度值挤压面板（修复偶尔只显示一行）
  if (typeof _captureKeyboardHeight === 'function') _captureKeyboardHeight();
  if (typeof _applyChatPanelHeight === 'function') _applyChatPanelHeight();
  
  closeStickerPanel();
  
  area.classList.add('open-plus');
  area.classList.remove('open-sticker');
  panel.classList.add('active');
  
  // 小黑屋 / 黑屋通知：单聊与群聊均可用
  // 小黑屋开启时（当前聊天存在被关成员），小黑屋图标变红
  var chatId = document.getElementById('page-chat-room').dataset.chatId;
  var brItem = document.getElementById('plus-menu-black-room');
  if (brItem) {
    var _brIds = getBlackRoomIds(chatId);
    brItem.classList.toggle('active', !!(Array.isArray(_brIds) && _brIds.length));
  }
  
  // 消息列表滚到底部
  scrollChatToBottom();

  // 加号菜单分页：重置到第一页并联动指示点
  var _pg = document.getElementById('plus-menu-grid');
  if (_pg) { _pg.scrollLeft = 0; _syncPlusMenuDots(); }
  _bindPlusMenuPagination();
}

function closePlusMenu() {
  var panel = document.getElementById('plus-panel');
  var area = document.getElementById('chat-panel-area');
  if (panel) panel.classList.remove('active');
  if (area) area.classList.remove('open-plus');
}

/* ============================================================
   涂鸦画板（加号菜单 → 涂鸦）
   ============================================================ */
var DOODLE_CANVAS_SIZE = 360;          // 画布逻辑分辨率（正方形）
var _doodleCtx = null;
var _doodleDrawing = false;
var _doodleLastX = 0, _doodleLastY = 0;
var _doodleColor = '#E05A7A';
var _doodleSize = 6;
var _doodleTool = 'brush';             // brush / text / eraser
var _doodleBg = '#FFFFFF';
var _doodleHistory = [];               // 撤销栈（dataURL）
var _doodleHistoryMax = 20;

var DOODLE_COLORS = ['#E05A7A', '#D9534F', '#F2A93B', '#F5D547', '#5BC08B', '#3BA9C4', '#5A8DE0', '#9B6BE8', '#8B5A2B', '#3A3A3A', '#FFFFFF', '#000000'];
var DOODLE_BGS = ['#FFFFFF', '#FFF6E9', '#FFEDF3', '#EAF4FF', '#F3EEFF', '#EAFBF0', '#FFF9E6', '#2B2B33'];

function openDoodlePanel() {
  var overlay = document.getElementById('doodle-overlay');
  if (!overlay) return;
  closePlusMenu();
  overlay.style.display = 'flex';
  // 初始化画布
  var canvas = document.getElementById('doodle-canvas');
  if (canvas) {
    canvas.width = DOODLE_CANVAS_SIZE;
    canvas.height = DOODLE_CANVAS_SIZE;
    _doodleCtx = canvas.getContext('2d');
  }
  _doodleColor = '#E05A7A';
  _doodleSize = 6;
  _doodleTool = 'brush';
  _doodleBg = '#FFFFFF';
  _doodleHistory = [];
  _renderDoodleColorSwatches();
  _renderDoodleBgSwatches();
  _doodleClearCanvas();
  _doodleSyncToolUI();
  document.getElementById('doodle-size').value = 6;
  document.getElementById('doodle-size-val').textContent = 6;
  document.getElementById('doodle-color-picker').value = '#E05A7A';
  document.getElementById('doodle-text-input').value = '';
  _doodleShowHint('选择画笔 / 文字工具，调整颜色与笔刷大小，在画板上自由绘制；完成后点击「发送」');
}

function closeDoodlePanel() {
  var overlay = document.getElementById('doodle-overlay');
  if (!overlay) return;
  // 彻底清除遮罩：隐藏 + 移除所有可能残留的状态
  overlay.style.display = 'none';
  overlay.classList.remove('doodle-overlay-show');
  var panel = overlay.querySelector('.doodle-panel');
  if (panel) panel.classList.remove('doodle-panel-closing');
}

function _doodleClearCanvas() {
  var ctx = _doodleCtx;
  if (!ctx) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = _doodleBg;
  ctx.fillRect(0, 0, DOODLE_CANVAS_SIZE, DOODLE_CANVAS_SIZE);
  _doodleShowEmpty();
}

function _doodlePushHistory() {
  var canvas = document.getElementById('doodle-canvas');
  if (!canvas) return;
  try {
    _doodleHistory.push(canvas.toDataURL('image/png'));
    if (_doodleHistory.length > _doodleHistoryMax) _doodleHistory.shift();
  } catch (e) {}
}

function _doodleRestoreHistory(dataUrl) {
  var canvas = document.getElementById('doodle-canvas');
  var ctx = _doodleCtx;
  if (!canvas || !ctx || !dataUrl) return;
  var img = new Image();
  img.onload = function() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    _doodleHideEmpty();
  };
  img.src = dataUrl;
}

function doodleUndo() {
  if (!_doodleHistory.length) { _doodleShowHint('没有可撤销的步骤了'); return; }
  var last = _doodleHistory.pop();
  if (!_doodleHistory.length) {
    // 回到空白（保留背景色）
    _doodleClearCanvas();
  } else {
    _doodleRestoreHistory(_doodleHistory[_doodleHistory.length - 1]);
  }
  _doodleShowHint('已撤销');
}

function doodleClear() {
  _doodlePushHistory();
  _doodleClearCanvas();
  _doodleShowHint('画板已清空');
}

function _doodleSyncToolUI() {
  var brushBtn = document.getElementById('doodle-tool-brush');
  var textBtn = document.getElementById('doodle-tool-text');
  var eraserBtn = document.getElementById('doodle-tool-eraser');
  var textRow = document.getElementById('doodle-text-row');
  if (brushBtn) brushBtn.classList.toggle('active', _doodleTool === 'brush');
  if (textBtn) textBtn.classList.toggle('active', _doodleTool === 'text');
  if (eraserBtn) eraserBtn.classList.toggle('active', _doodleTool === 'eraser');
  if (textRow) textRow.style.display = _doodleTool === 'text' ? 'flex' : 'none';
  var hint = document.getElementById('doodle-hint');
  if (hint) {
    if (_doodleTool === 'text') hint.textContent = '文字工具：在下方输入英文或汉字，点击画布任意位置放置文字（字号随笔刷大小变化）';
    else if (_doodleTool === 'eraser') hint.textContent = '橡皮工具：在画布上涂抹即可擦除内容';
    else hint.textContent = '画笔工具：拖动手指 / 鼠标在画布上自由绘制';
  }
}

function doodleSetTool(tool) {
  _doodleTool = tool;
  _doodleSyncToolUI();
}

function doodleSetColor(color) {
  _doodleColor = color;
  var picker = document.getElementById('doodle-color-picker');
  if (picker && picker.value !== color) picker.value = color;
  _renderDoodleColorSwatches();
}

function doodleSetSize(size) {
  _doodleSize = parseInt(size, 10) || 6;
  var val = document.getElementById('doodle-size-val');
  if (val) val.textContent = _doodleSize;
}

function _renderDoodleColorSwatches() {
  var wrap = document.getElementById('doodle-colors');
  if (!wrap) return;
  var html = '';
  DOODLE_COLORS.forEach(function(c) {
    html += '<div class="doodle-color-swatch' + (_doodleColor.toLowerCase() === c.toLowerCase() ? ' active' : '') + '" style="background:' + c + '" onclick="doodleSetColor(\'' + c + '\')"></div>';
  });
  wrap.innerHTML = html;
}

function _renderDoodleBgSwatches() {
  var wrap = document.getElementById('doodle-bgs');
  if (!wrap) return;
  var html = '';
  DOODLE_BGS.forEach(function(c) {
    html += '<div class="doodle-bg-swatch' + (_doodleBg.toLowerCase() === c.toLowerCase() ? ' active' : '') + '" style="background:' + c + '" onclick="doodleSetBg(\'' + c + '\')"></div>';
  });
  wrap.innerHTML = html;
}

function _doodleHexToRgb(hex) {
  var h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (isNaN(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function doodleSetBg(color) {
  if (color === _doodleBg) return;
  var canvas = document.getElementById('doodle-canvas');
  var ctx = _doodleCtx;
  if (!canvas || !ctx) return;
  _doodlePushHistory();
  // 提取笔画层：将与旧底色相近的像素置为透明，避免旧底色盖住新底色导致"切换无效"
  var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var d = imgData.data;
  var oldRgb = _doodleHexToRgb(_doodleBg);
  for (var i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - oldRgb.r) < 12 && Math.abs(d[i + 1] - oldRgb.g) < 12 && Math.abs(d[i + 2] - oldRgb.b) < 12) {
      d[i + 3] = 0;
    }
  }
  var tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').putImageData(imgData, 0, 0);
  // 铺新底色
  _doodleBg = color;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 把笔画层画回新底色上
  ctx.drawImage(tmp, 0, 0);
  _renderDoodleBgSwatches();
  _doodleHideEmpty();
}

function _doodleCanvasPos(e) {
  var canvas = document.getElementById('doodle-canvas');
  if (!canvas) return { x: 0, y: 0 };
  var rect = canvas.getBoundingClientRect();
  var clientX, clientY;
  if (e.touches && e.touches.length) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
  else if (e.changedTouches && e.changedTouches.length) { clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY; }
  else { clientX = e.clientX; clientY = e.clientY; }
  return {
    x: (clientX - rect.left) * canvas.width / rect.width,
    y: (clientY - rect.top) * canvas.height / rect.height
  };
}

function _doodleStrokeStart(e) {
  e.preventDefault();
  if (!_doodleCtx) return;
  if (_doodleTool === 'text') { _doodlePlaceTextAt(e); return; }
  _doodleDrawing = true;
  var pos = _doodleCanvasPos(e);
  _doodleLastX = pos.x; _doodleLastY = pos.y;
  _doodleCtx.globalCompositeOperation = 'source-over';
  _doodleCtx.lineCap = 'round';
  _doodleCtx.lineJoin = 'round';
  if (_doodleTool === 'eraser') {
    _doodleCtx.strokeStyle = _doodleBg;
    _doodleCtx.lineWidth = _doodleSize * 2.5;
  } else {
    _doodleCtx.strokeStyle = _doodleColor;
    _doodleCtx.lineWidth = _doodleSize;
  }
  _doodleHideEmpty();
  _doodleCtx.beginPath();
  _doodleCtx.moveTo(_doodleLastX, _doodleLastY);
  _doodleCtx.lineTo(_doodleLastX + 0.1, _doodleLastY + 0.1);
  _doodleCtx.stroke();
}

function _doodleStrokeMove(e) {
  e.preventDefault();
  if (!_doodleDrawing || !_doodleCtx) return;
  var pos = _doodleCanvasPos(e);
  _doodleCtx.lineTo(pos.x, pos.y);
  _doodleCtx.stroke();
  _doodleLastX = pos.x; _doodleLastY = pos.y;
}

function _doodleStrokeEnd(e) {
  if (!_doodleDrawing) return;
  e.preventDefault();
  _doodleDrawing = false;
  _doodlePushHistory();
}

function _doodleHideEmpty() {
  var el = document.getElementById('doodle-canvas-empty');
  if (el) el.style.display = 'none';
}

function _doodleShowEmpty() {
  var el = document.getElementById('doodle-canvas-empty');
  if (!el) return;
  el.style.display = _doodleHasContent() ? 'none' : 'flex';
}

function _doodleHasContent() {
  var canvas = document.getElementById('doodle-canvas');
  if (!canvas) return false;
  try {
    var ctx = canvas.getContext('2d');
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
  } catch (e) {}
  return false;
}

function _doodleShowHint(text) {
  var hint = document.getElementById('doodle-hint');
  if (hint) hint.textContent = text;
  setTimeout(function() {
    var h2 = document.getElementById('doodle-hint');
    if (h2 && h2.textContent === text && !_doodleDrawing) _doodleSyncToolUI();
  }, 2200);
}

/* 文字工具：点击画布放置文字 */
function _doodlePlaceTextAt(e) {
  var input = document.getElementById('doodle-text-input');
  var text = input ? input.value.trim() : '';
  if (!text) { _doodleShowHint('请先在输入框中输入文字'); return; }
  var pos = _doodleCanvasPos(e);
  var ctx = _doodleCtx;
  if (!ctx) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = _doodleColor;
  ctx.font = '600 ' + Math.max(14, _doodleSize * 4) + 'px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pos.x, pos.y);
  _doodleHideEmpty();
  _doodlePushHistory();
  _doodleShowHint('文字已放置，可继续输入或切换回画笔');
}

function doodlePlaceText() {
  var input = document.getElementById('doodle-text-input');
  var text = input ? input.value.trim() : '';
  if (!text) { _doodleShowHint('请先输入文字'); return; }
  var ctx = _doodleCtx;
  if (!ctx) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = _doodleColor;
  ctx.font = '600 ' + Math.max(14, _doodleSize * 4) + 'px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, DOODLE_CANVAS_SIZE / 2, DOODLE_CANVAS_SIZE / 2);
  _doodleHideEmpty();
  _doodlePushHistory();
  _doodleShowHint('文字已放置到画布中央，可继续编辑');
}

/* 发送涂鸦（我方）：导出为图片，与表情包同样式直接发送 */
function doodleSend() {
  var canvas = document.getElementById('doodle-canvas');
  if (!canvas) return;
  var data = canvas.toDataURL('image/png');
  // 阈值判定压缩：小涂鸦原样保留，超过阈值才压缩，避免涂鸦细节损失
  ChatMedia.compressSmart(data, ChatMedia.OPT.doodle).then(function(compressed) {
    _doSendDoodle('self', compressed);
    closeDoodlePanel();
  }).catch(function() {
    // 兜底：即使压缩/发送异常也必须关闭遮罩，避免界面被遮罩挡住
    closeDoodlePanel();
  });
}

/* 涂鸦消息落库（我方 / 对方共用；type: self / other） */
function _doSendDoodle(side, stickerData, chatId) {
  chatId = chatId || (document.getElementById('page-chat-room') ? document.getElementById('page-chat-room').dataset.chatId : null);
  if (!chatId || !stickerData) return;
  var msgId = Date.now();
  var messages = Storage.getMessages(chatId);
  // 大体积涂鸦存入 IndexedDB，消息只保留轻量引用（渲染时异步还原）
  ChatMedia.storeForMessage(stickerData, 'doodle_' + msgId).then(function(finalData) {
    var newMsg = { id: msgId, type: side, text: '[涂鸦]', time: msgId, msgType: 'doodle', read: side !== 'self', stickerData: finalData };
    messages.push(newMsg);
    Storage.setMessages(chatId, messages);
    updateLastMsg(chatId, '[涂鸦]');
    _safeAppendMessage(chatId, newMsg);
    App.playSound(side === 'self' ? 'send' : 'receive');
    if (side === 'self') {
      // 我方发完涂鸦后对方正常自动回复
      scheduleAutoReply(chatId);
    } else {
      showBackgroundPush('[涂鸦]');
    }
  });
}

/* 触发词：我方发送"涂鸦"二字时，对方发送涂鸦 */
function scheduleDoodleAutoReply(chatId) {
  if (Storage.getTypingIndicator()) {
    showTypingIndicator();
    setTimeout(function() {
      hideTypingIndicator();
      _sendDoodleAutoReply(chatId);
    }, 1600 + Math.random() * 2200);
  } else {
    setTimeout(function() {
      _sendDoodleAutoReply(chatId);
    }, 900 + Math.random() * 1400);
  }
}

function _sendDoodleAutoReply(chatId) {
  var data = _generateDoodleDataURL();
  _doSendDoodle('other', data, chatId);
}

/* 触发词：我方发送"你发拍一拍"时，对方发送拍一拍 */
function schedulePatAutoReply(chatId) {
  if (Storage.getTypingIndicator()) {
    showTypingIndicator();
    setTimeout(function() {
      hideTypingIndicator();
      _sendPatAutoReply(chatId);
    }, 1600 + Math.random() * 2200);
  } else {
    setTimeout(function() {
      _sendPatAutoReply(chatId);
    }, 900 + Math.random() * 1400);
  }
}

function _sendPatAutoReply(chatId) {
  var pats = Storage.getPats();
  var a = '拍了拍', b = '想你了';
  if (pats.length) {
    var p = pats[Math.floor(Math.random() * pats.length)];
    var parts = _splitPatTemplate(p.text);
    a = (p.a !== undefined && p.a !== null) ? p.a : parts.a;
    b = (p.b !== undefined && p.b !== null) ? p.b : parts.b;
  }
  var isGroup = isGroupChatId(chatId);
  var template = '"我方"' + a + '"对方"' + b;
  var finalText = _buildPatText(template, 'other', isGroup, chatId);
  var messages = Storage.getMessages(chatId);
  var newMsg = {
    id: Date.now(),
    type: 'other',
    text: finalText,
    time: Date.now(),
    msgType: 'pat',
    isPat: true
  };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, finalText);
  _safeAppendMessage(chatId, newMsg);
  App.playSound('receive');
  showBackgroundPush(finalText);
}

/* ============================================================
   涂鸦自动生成（对方发送）：特殊符号（◇♢♦▲▼等）+ 不规则线条 / 蚊香随机组合
   ============================================================ */
/* 对方涂鸦动物样式池：龙 / 猫 / 狗 / 羊 / 鹿 / 兔 / 鱼（不规则线条手绘风） */
var DOODLE_ANIMALS = [
  { name: '龙', draw: _doodleAnimalDragon },
  { name: '猫', draw: _doodleAnimalCat },
  { name: '狗', draw: _doodleAnimalDog },
  { name: '羊', draw: _doodleAnimalSheep },
  { name: '鹿', draw: _doodleAnimalDeer },
  { name: '兔', draw: _doodleAnimalRabbit },
  { name: '鱼', draw: _doodleAnimalFish }
];

function _generateDoodleDataURL() {
  var W = DOODLE_CANVAS_SIZE, H = DOODLE_CANVAS_SIZE;
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');
  // 随机纯色背景
  var bgList = ['#FFFFFF', '#FFF6E9', '#FFEDF3', '#EAF4FF', '#F3EEFF', '#EAFBF0', '#FFF9E6', '#F2F2F7'];
  var bg = bgList[Math.floor(Math.random() * bgList.length)];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  var colors = ['#E05A7A', '#D9534F', '#F2A93B', '#F5D547', '#5BC08B', '#3BA9C4', '#5A8DE0', '#9B6BE8', '#E86BA0', '#FF8C42', '#6B8E23', '#3A3A3A'];
  // 动物模式：45% 概率生成一整只动物涂鸦（龙/猫/狗/羊/鹿/兔/鱼等）
  if (Math.random() < 0.45) {
    _drawDoodleAnimalScene(ctx, W, H, colors);
    return canvas.toDataURL('image/png');
  }
  // 符号池：◇ ♢ ♦ ▲ ▼ ❤ ✿ ❀ ○；不规则线条 / 蚊香等笔画权重更高（多份）；混入动物元素偶尔出现
  var shapes = [
    _doodleShapeDiamond, _doodleShapeDiamondOutline, _doodleShapeDiamondSolid,
    _doodleShapeTriangle, _doodleShapeTriangleDown,
    _doodleShapeHeart, _doodleShapeFlower5, _doodleShapeFlower4, _doodleShapeCircle,
    _doodleShapeWave, _doodleShapeWave,
    _doodleShapeScrawlLine, _doodleShapeScrawlLine, _doodleShapeScrawlLine,
    _doodleShapeScrawlLoop, _doodleShapeScrawlLoop,
    _doodleShapeSpiral, _doodleShapeSpiral,
    _doodleAnimalCat, _doodleAnimalDog, _doodleAnimalSheep, _doodleAnimalDeer, _doodleAnimalDragon, _doodleAnimalRabbit, _doodleAnimalFish
  ];
  var count = 9 + Math.floor(Math.random() * 8); // 9~16 个元素，涂鸦更满
  // 主角符号机制：同一符号可在单张涂鸦中重复多次使用、可重复叠加
  var hero = Math.random() < 0.6 ? shapes[Math.floor(Math.random() * shapes.length)] : null;
  var heroRemain = hero ? 2 + Math.floor(Math.random() * 5) : 0; // 重复 2~6 次
  for (var i = 0; i < count; i++) {
    var fn = (hero && heroRemain > 0 && Math.random() < 0.8) ? hero : shapes[Math.floor(Math.random() * shapes.length)];
    if (fn === hero) heroRemain--;
    var x = 36 + Math.random() * (W - 72);
    var y = 36 + Math.random() * (H - 72);
    var size = 12 + Math.random() * 34;
    var color = colors[Math.floor(Math.random() * colors.length)];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI * 2);
    fn(ctx, size, color);
    ctx.restore();
  }
  return canvas.toDataURL('image/png');
}

/* 波浪线 */
function _doodleShapeWave(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  var len = size * 2.4;
  var amp = size * 0.45;
  ctx.moveTo(-len / 2, 0);
  ctx.bezierCurveTo(-len / 3, -amp, -len / 6, amp, 0, 0);
  ctx.bezierCurveTo(len / 6, -amp, len / 3, amp, len / 2, 0);
  ctx.stroke();
  ctx.restore();
}

/* ◇ 菱形 */
function _doodleShapeDiamond(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.75, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.75, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ❤ 心形 */
function _doodleShapeHeart(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.7);
  ctx.bezierCurveTo(-size * 1.1, -size * 0.1, -size * 0.55, -size * 0.95, 0, -size * 0.4);
  ctx.bezierCurveTo(size * 0.55, -size * 0.95, size * 1.1, -size * 0.1, 0, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* △ 三角形 */
function _doodleShapeTriangle(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.9, size * 0.8);
  ctx.lineTo(-size * 0.9, size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ✿ 五瓣花 */
function _doodleShapeFlower5(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  var r = size * 0.32;
  for (var i = 0; i < 5; i++) {
    var a = i * Math.PI * 2 / 5;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * size * 0.55, Math.sin(a) * size * 0.55, r, r * 0.6, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF6D8';
  ctx.fill();
  ctx.restore();
}

/* ♢ 空心菱形 */
function _doodleShapeDiamondOutline(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.09);
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.72, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/* ♦ 实心方块菱形 */
function _doodleShapeDiamondSolid(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.8, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.lineTo(size * 0.28, -size * 0.05);
  ctx.lineTo(0, size * 0.35);
  ctx.lineTo(-size * 0.28, -size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ▼ 倒三角 */
function _doodleShapeTriangleDown(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size * 0.9, -size * 0.8);
  ctx.lineTo(-size * 0.9, -size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* 蚊香螺旋线 */
function _doodleShapeSpiral(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.1);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  var turns = 2.2 + Math.random() * 1.6;   // 2~4 圈
  var steps = 42;
  var maxR = size * (0.75 + Math.random() * 0.45);
  for (var i = 0; i <= steps; i++) {
    var t = i / steps;
    var a = t * Math.PI * 2 * turns + (Math.random() - 0.5) * 0.28;
    var r = t * maxR;
    var px = Math.cos(a) * r;
    var py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/* ❀ 四瓣花 */
function _doodleShapeFlower4(ctx, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  for (var i = 0; i < 4; i++) {
    var a = i * Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.5, size * 0.3, size * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF6D8';
  ctx.fill();
  ctx.restore();
}

/* ○ 圆环 */
function _doodleShapeCircle(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.13);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* 不规则线条 */
function _doodleShapeScrawlLine(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  var len = size * (2.0 + Math.random() * 0.9);
  ctx.moveTo(-len / 2, 0);
  var segs = 5 + Math.floor(Math.random() * 4);
  for (var i = 1; i <= segs; i++) {
    var nx = -len / 2 + (len * i / segs);
    var ny = (Math.random() - 0.5) * size * 1.7;
    ctx.lineTo(nx, ny);
  }
  ctx.stroke();
  ctx.restore();
}

/* 不规则线圈 */
function _doodleShapeScrawlLoop(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.11);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  var pts = [];
  var n = 8 + Math.floor(Math.random() * 6);
  for (var i = 0; i <= n; i++) {
    var a = i / n * Math.PI * 2;
    var r = size * (0.7 + (Math.random() - 0.5) * 0.6);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (var j = 1; j < pts.length; j++) {
    var midX = (pts[j - 1][0] + pts[j][0]) / 2;
    var midY = (pts[j - 1][1] + pts[j][1]) / 2;
    ctx.quadraticCurveTo(pts[j - 1][0], pts[j - 1][1], midX, midY);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/* 动物涂鸦场景：随机选一只动物作主角 + 不规则线条点缀 + 偶尔小动物彩蛋 */
function _drawDoodleAnimalScene(ctx, W, H, colors) {
  var animal = DOODLE_ANIMALS[Math.floor(Math.random() * DOODLE_ANIMALS.length)];
  var mainColor = colors[Math.floor(Math.random() * colors.length)];
  var accentColor = colors[Math.floor(Math.random() * colors.length)];
  // 主动物：居中、较大、轻微随机旋转（保持手绘感）
  ctx.save();
  ctx.translate(W * 0.5 + (Math.random() - 0.5) * W * 0.08, H * 0.52 + (Math.random() - 0.5) * H * 0.06);
  ctx.rotate((Math.random() - 0.5) * 0.3);
  animal.draw(ctx, W * 0.30 + Math.random() * W * 0.08, mainColor);
  ctx.restore();
  // 点缀：心形 / 不规则线条 / 圆环 / 小花 / 波浪
  var decos = [_doodleShapeHeart, _doodleShapeScrawlLine, _doodleShapeCircle, _doodleShapeFlower5, _doodleShapeWave];
  var decoCount = 3 + Math.floor(Math.random() * 4);
  for (var i = 0; i < decoCount; i++) {
    ctx.save();
    ctx.translate(30 + Math.random() * (W - 60), 24 + Math.random() * (H - 48));
    ctx.rotate(Math.random() * Math.PI * 2);
    decos[Math.floor(Math.random() * decos.length)](ctx, 8 + Math.random() * 18, accentColor);
    ctx.restore();
  }
  // 彩蛋：35% 概率在角落再画一只小动物
  if (Math.random() < 0.35) {
    var small = DOODLE_ANIMALS[Math.floor(Math.random() * DOODLE_ANIMALS.length)];
    ctx.save();
    ctx.translate(55 + Math.random() * (W - 110), H - 46 - Math.random() * 28);
    ctx.rotate((Math.random() - 0.5) * 0.4);
    small.draw(ctx, W * 0.10 + Math.random() * W * 0.05, accentColor);
    ctx.restore();
  }
}

/* 简笔画动物：龙 */
function _doodleAnimalDragon(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // S 形身体
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.35);
  ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.45, s * 0.9, -s * 0.1, s * 0.72);
  ctx.bezierCurveTo(s * 0.3, s * 0.5, s * 0.15, s * 0.15, s * 0.45, -s * 0.05);
  ctx.bezierCurveTo(s * 0.7, -s * 0.22, s * 0.85, s * 0.1, s * 0.72, s * 0.3);
  ctx.stroke();
  // 头
  ctx.beginPath();
  ctx.arc(-s * 0.52, s * 0.3, s * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-s * 0.58, s * 0.25, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // 龙角
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, s * 0.14);
  ctx.lineTo(-s * 0.7, -s * 0.08);
  ctx.moveTo(-s * 0.48, s * 0.12);
  ctx.lineTo(-s * 0.52, -s * 0.1);
  ctx.stroke();
  // 龙须
  ctx.beginPath();
  ctx.moveTo(-s * 0.66, s * 0.4);
  ctx.quadraticCurveTo(-s * 0.9, s * 0.42, -s * 0.85, s * 0.55);
  ctx.stroke();
  // 背刺
  var spikes = [[-s * 0.28, s * 0.72], [-s * 0.02, s * 0.62], [s * 0.22, s * 0.4], [s * 0.42, s * 0.12]];
  for (var i = 0; i < spikes.length; i++) {
    ctx.beginPath();
    ctx.moveTo(spikes[i][0] - s * 0.06, spikes[i][1] - s * 0.04);
    ctx.lineTo(spikes[i][0] + s * 0.02, spikes[i][1] - s * 0.2);
    ctx.lineTo(spikes[i][0] + s * 0.1, spikes[i][1] + s * 0.02);
    ctx.stroke();
  }
  // 尾巴分叉
  ctx.beginPath();
  ctx.moveTo(s * 0.7, s * 0.28);
  ctx.lineTo(s * 0.92, s * 0.18);
  ctx.moveTo(s * 0.7, s * 0.28);
  ctx.lineTo(s * 0.95, s * 0.4);
  ctx.stroke();
  ctx.restore();
}

/* 简笔画动物：猫 */
function _doodleAnimalCat(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // 头
  ctx.beginPath();
  ctx.arc(0, -s * 0.15, s * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  // 耳朵（左 / 右）
  ctx.beginPath();
  ctx.moveTo(-s * 0.38, -s * 0.38);
  ctx.lineTo(-s * 0.26, -s * 0.72);
  ctx.lineTo(-s * 0.05, -s * 0.5);
  ctx.moveTo(s * 0.38, -s * 0.38);
  ctx.lineTo(s * 0.26, -s * 0.72);
  ctx.lineTo(s * 0.05, -s * 0.5);
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-s * 0.16, -s * 0.22, s * 0.045, 0, Math.PI * 2);
  ctx.arc(s * 0.16, -s * 0.22, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  // 鼻子
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.08);
  ctx.lineTo(-s * 0.05, -s * 0.02);
  ctx.lineTo(s * 0.05, -s * 0.02);
  ctx.closePath();
  ctx.fill();
  // 嘴
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.02);
  ctx.quadraticCurveTo(-s * 0.07, s * 0.1, -s * 0.14, s * 0.06);
  ctx.moveTo(0, -s * 0.02);
  ctx.quadraticCurveTo(s * 0.07, s * 0.1, s * 0.14, s * 0.06);
  ctx.stroke();
  // 胡须
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.1);
  ctx.lineTo(-s * 0.6, -s * 0.16);
  ctx.moveTo(-s * 0.3, -s * 0.02);
  ctx.lineTo(-s * 0.6, s * 0.05);
  ctx.moveTo(s * 0.3, -s * 0.1);
  ctx.lineTo(s * 0.6, -s * 0.16);
  ctx.moveTo(s * 0.3, -s * 0.02);
  ctx.lineTo(s * 0.6, s * 0.05);
  ctx.stroke();
  // 身体
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.28);
  ctx.quadraticCurveTo(-s * 0.42, s * 0.8, -s * 0.05, s * 0.85);
  ctx.quadraticCurveTo(s * 0.34, s * 0.9, s * 0.44, s * 0.52);
  ctx.stroke();
  // 卷尾巴
  ctx.beginPath();
  ctx.moveTo(s * 0.4, s * 0.55);
  ctx.quadraticCurveTo(s * 0.82, s * 0.4, s * 0.74, s * 0.08);
  ctx.quadraticCurveTo(s * 0.66, -s * 0.12, s * 0.8, -s * 0.16);
  ctx.stroke();
  ctx.restore();
}

/* 简笔画动物：狗 */
function _doodleAnimalDog(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // 头
  ctx.beginPath();
  ctx.arc(0, -s * 0.2, s * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // 垂耳（左 / 右）
  ctx.beginPath();
  ctx.ellipse(-s * 0.34, -s * 0.32, s * 0.14, s * 0.32, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(s * 0.34, -s * 0.32, s * 0.14, s * 0.32, 0.35, 0, Math.PI * 2);
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-s * 0.15, -s * 0.26, s * 0.04, 0, Math.PI * 2);
  ctx.arc(s * 0.15, -s * 0.26, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // 鼻子
  ctx.beginPath();
  ctx.arc(0, -s * 0.08, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // 嘴
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.02);
  ctx.quadraticCurveTo(-s * 0.12, s * 0.06, -s * 0.18, 0);
  ctx.moveTo(0, -s * 0.02);
  ctx.quadraticCurveTo(s * 0.12, s * 0.06, s * 0.18, 0);
  ctx.stroke();
  // 身体
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.24);
  ctx.quadraticCurveTo(-s * 0.4, s * 0.85, s * 0.05, s * 0.88);
  ctx.quadraticCurveTo(s * 0.42, s * 0.9, s * 0.46, s * 0.5);
  ctx.stroke();
  // 腿
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, s * 0.82);
  ctx.lineTo(-s * 0.2, s * 1.05);
  ctx.moveTo(s * 0.18, s * 0.84);
  ctx.lineTo(s * 0.16, s * 1.05);
  ctx.stroke();
  // 上翘尾巴
  ctx.beginPath();
  ctx.moveTo(s * 0.42, s * 0.52);
  ctx.quadraticCurveTo(s * 0.78, s * 0.35, s * 0.62, -s * 0.05);
  ctx.stroke();
  ctx.restore();
}

/* 简笔画动物：羊 */
function _doodleAnimalSheep(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // 卷毛身体：一圈小圆
  var lumps = [[-s * 0.42, -s * 0.05], [-s * 0.15, -s * 0.35], [s * 0.2, -s * 0.38], [s * 0.45, -s * 0.08], [s * 0.4, s * 0.3], [s * 0.05, s * 0.45], [-s * 0.35, s * 0.35]];
  for (var i = 0; i < lumps.length; i++) {
    ctx.beginPath();
    ctx.arc(lumps[i][0], lumps[i][1], s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 头（侧脸）
  ctx.beginPath();
  ctx.arc(s * 0.6, -s * 0.52, s * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(s * 0.68, -s * 0.56, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // 耳朵
  ctx.beginPath();
  ctx.ellipse(s * 0.78, -s * 0.62, s * 0.12, s * 0.06, 0.5, 0, Math.PI * 2);
  ctx.stroke();
  // 羊角（螺旋）
  ctx.beginPath();
  var hornSteps = 20;
  for (var h = 0; h <= hornSteps; h++) {
    var ht = h / hornSteps;
    var ha = ht * Math.PI * 2.2 - 0.6;
    var hr = s * 0.08 + ht * s * 0.16;
    var hx = s * 0.6 + Math.cos(ha) * hr;
    var hy = -s * 0.52 + Math.sin(ha) * hr * 0.7;
    if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
  }
  ctx.stroke();
  // 腿
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, s * 0.4);
  ctx.lineTo(-s * 0.24, s * 0.95);
  ctx.moveTo(s * 0.12, s * 0.44);
  ctx.lineTo(s * 0.1, s * 0.95);
  ctx.stroke();
  ctx.restore();
}

/* 简笔画动物：鹿 */
function _doodleAnimalDeer(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // 头
  ctx.beginPath();
  ctx.arc(0, -s * 0.42, s * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  // 脖子 + 身体
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, -s * 0.2);
  ctx.quadraticCurveTo(-s * 0.34, s * 0.2, -s * 0.38, s * 0.5);
  ctx.quadraticCurveTo(-s * 0.4, s * 0.85, s * 0.18, s * 0.88);
  ctx.quadraticCurveTo(s * 0.5, s * 0.88, s * 0.52, s * 0.5);
  ctx.stroke();
  // 鹿角（左枝）
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, -s * 0.6);
  ctx.lineTo(-s * 0.3, -s * 0.95);
  ctx.moveTo(-s * 0.24, -s * 0.8);
  ctx.lineTo(-s * 0.42, -s * 0.88);
  ctx.moveTo(-s * 0.2, -s * 0.72);
  ctx.lineTo(-s * 0.34, -s * 0.62);
  ctx.stroke();
  // 鹿角（右枝）
  ctx.beginPath();
  ctx.moveTo(s * 0.16, -s * 0.6);
  ctx.lineTo(s * 0.3, -s * 0.95);
  ctx.moveTo(s * 0.24, -s * 0.8);
  ctx.lineTo(s * 0.42, -s * 0.88);
  ctx.moveTo(s * 0.2, -s * 0.72);
  ctx.lineTo(s * 0.34, -s * 0.62);
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(s * 0.12, -s * 0.44, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  // 耳朵
  ctx.beginPath();
  ctx.ellipse(s * 0.24, -s * 0.6, s * 0.1, s * 0.05, 0.5, 0, Math.PI * 2);
  ctx.stroke();
  // 腿
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, s * 0.82);
  ctx.lineTo(-s * 0.2, s * 1.08);
  ctx.moveTo(s * 0.1, s * 0.84);
  ctx.lineTo(s * 0.08, s * 1.08);
  ctx.stroke();
  ctx.restore();
}

/* 简笔画动物：兔 */
function _doodleAnimalRabbit(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // 头
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  // 长耳朵
  ctx.beginPath();
  ctx.ellipse(-s * 0.16, -s * 0.6, s * 0.09, s * 0.34, -0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(s * 0.16, -s * 0.6, s * 0.09, s * 0.34, 0.1, 0, Math.PI * 2);
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-s * 0.14, -s * 0.14, s * 0.04, 0, Math.PI * 2);
  ctx.arc(s * 0.14, -s * 0.14, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // 鼻子
  ctx.beginPath();
  ctx.arc(0, -s * 0.02, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // 三瓣嘴
  ctx.beginPath();
  ctx.moveTo(0, s * 0.02);
  ctx.lineTo(0, s * 0.1);
  ctx.moveTo(0, s * 0.1);
  ctx.lineTo(-s * 0.08, s * 0.14);
  ctx.moveTo(0, s * 0.1);
  ctx.lineTo(s * 0.08, s * 0.14);
  ctx.stroke();
  // 身体
  ctx.beginPath();
  ctx.moveTo(-s * 0.26, s * 0.3);
  ctx.quadraticCurveTo(-s * 0.34, s * 0.85, s * 0.05, s * 0.88);
  ctx.quadraticCurveTo(s * 0.4, s * 0.9, s * 0.4, s * 0.42);
  ctx.stroke();
  // 短尾巴
  ctx.beginPath();
  ctx.arc(s * 0.36, s * 0.72, s * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* 简笔画动物：鱼 */
function _doodleAnimalFish(ctx, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var s = size;
  // 身体
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.75, s * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 尾巴
  ctx.beginPath();
  ctx.moveTo(s * 0.62, 0);
  ctx.lineTo(s * 1.0, -s * 0.35);
  ctx.lineTo(s * 0.95, s * 0.3);
  ctx.closePath();
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-s * 0.3, -s * 0.1, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // 鱼鳍
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, -s * 0.34);
  ctx.quadraticCurveTo(s * 0.05, -s * 0.62, s * 0.3, -s * 0.3);
  ctx.stroke();
  // 气泡
  ctx.beginPath();
  ctx.arc(-s * 0.8, -s * 0.45, s * 0.08, 0, Math.PI * 2);
  ctx.moveTo(-s * 1.0, -s * 0.6);
  ctx.arc(-s * 1.0, -s * 0.6, s * 0.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* 绑定涂鸦画布事件（在页面加载完成后执行） */
function _initDoodleCanvasEvents() {
  var canvas = document.getElementById('doodle-canvas');
  if (!canvas || canvas.__doodleBound) return;
  canvas.__doodleBound = true;
  canvas.addEventListener('mousedown', _doodleStrokeStart);
  canvas.addEventListener('mousemove', _doodleStrokeMove);
  canvas.addEventListener('mouseup', _doodleStrokeEnd);
  canvas.addEventListener('mouseleave', _doodleStrokeEnd);
  canvas.addEventListener('touchstart', _doodleStrokeStart, { passive: false });
  canvas.addEventListener('touchmove', _doodleStrokeMove, { passive: false });
  canvas.addEventListener('touchend', _doodleStrokeEnd, { passive: false });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initDoodleCanvasEvents);
} else {
  _initDoodleCanvasEvents();
}

/* ============================================================
   小黑屋 & 黑屋通知（群聊专属，仅群聊模式可用）
   ============================================================ */
/* 内置恋爱向黑屋通知文案（合并弹窗预设网格：图标 + 文案） */
var BLACK_NOTICE_PRESETS = [
  { icon: '❄️', text: '你已被打入冷宫，好好反思一下自己' },
  { icon: '👑', text: '本宫今日不想见你，退下吧' },
  { icon: '😡', text: '去小黑屋面壁思过，想明白了再来' },
  { icon: '🌙', text: '哼，今天不想理你，自己冷静冷静' },
  { icon: '🔒', text: '已被关进小黑屋，好好反省吧' }
];

/* 浅粉红碎心图标（黑屋通知气泡内使用，浅粉红色，与主题色一致） */
var BLACK_NOTICE_ICON_SVG = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M16 27.6 C11.7 23.7 5.8 18.2 5.8 11.5 C5.8 7.7 9 5 12.7 5 C14.3 5 15.8 5.7 16.8 6.7 C17.8 5.7 19.3 5 20.9 5 C24.6 5 27.8 7.7 27.8 11.5 C27.8 18.2 21.9 23.7 17.6 27.6 C17 28.1 16.6 28.1 16 27.6 Z" fill="#F0A8BC" stroke="none"/><path d="M18.2 6.8 L21.4 14.0 L16.4 14.0 L13.2 22.2 L12.2 22.2 L16.0 14.0 L11.8 14.0 Z" fill="rgba(255,255,255,0.95)" stroke="none"/></svg>';

/* 获取某群聊的小黑屋成员名单 */
function getBlackRoomIds(chatId) {
  var ids = Storage.get('blackRoom_' + chatId, []);
  return Array.isArray(ids) ? ids : [];
}
function setBlackRoomIds(chatId, ids) {
  Storage.set('blackRoom_' + chatId, ids || []);
}

/* 小黑屋合并弹窗：是否开启黑屋 + 选择成员 + 黑屋通知（单聊/群聊通用；单聊对象为当前对方） */
function openBlackRoomPanel() {
  closePlusMenu();
  var chatId = _currentChatId();
  if (!chatId) { Core.toast('请先进入聊天'); return; }
  var isGroup = isGroupChatId(chatId);
  var members = [];
  if (isGroup) {
    var g = getGroupByChatId(chatId);
    members = g ? getGroupMembers(g) : [];
  } else {
    var partner = _getCurrentPartnerProfile();
    if (partner) members = [partner];
  }
  if (!members.length) { Core.toast('暂无成员'); return; }

  var cur = getBlackRoomIds(chatId);
  var enabled = !!Storage.get('blackRoomEnabled_' + chatId, cur.length > 0);
  var memberHtml = '<div class="black-member-chip active" data-member="__ALL__"><i class="fas fa-users"></i>全员</div>';
  members.forEach(function(m) {
    var av = _decisionChipAvatarHtml(m);
    var active = cur.indexOf(m.id) !== -1 ? ' active' : '';
    memberHtml += '<div class="black-member-chip' + active + '" data-member="' + m.id + '">' + av + Core.escapeHtml(m.nickname || '成员') + '</div>';
  });

  var presetHtml = '';
  BLACK_NOTICE_PRESETS.forEach(function(p) {
    var span = p.span2 ? ' span-2' : '';
    presetHtml += '<div class="black-preset-item' + span + '" data-text="' + Core.escapeHtml(p.text) + '"><span class="preset-icon">' + p.icon + '</span><span class="preset-text">' + Core.escapeHtml(p.text) + '</span></div>';
  });

  // 成员选择仅在群聊显示；单聊开启黑屋即视为关入当前对方
  var memberFieldHtml = isGroup
    ? '<div class="black-field">'
      + '<label>选择成员（点击切换，可多选）</label>'
      + '<div class="black-member-list' + (enabled ? '' : ' disabled') + '" id="black-room-member-list">' + memberHtml + '</div>'
      + '<div class="black-hint">开启后，选中成员发送的消息会附带「已被打入冷宫」标签</div>'
      + '</div>'
    : '';

  var html = '<div class="black-overlay" id="black-room-overlay" onclick="closeBlackRoomPanel()">'
    + '<div class="black-panel" onclick="event.stopPropagation()">'
    + '<div class="black-title"><i class="fas fa-user-lock"></i>小黑屋</div>'
    + '<div class="black-field">'
    + '<div class="black-toggle-row">'
    + '<span class="black-toggle-label"><i class="fas fa-user-lock"></i>开启小黑屋</span>'
    + '<button type="button" class="black-toggle' + (enabled ? ' on' : '') + '" id="black-enabled-toggle" onclick="toggleBlackEnabled()"></button>'
    + '</div>'
    + '</div>'
    + memberFieldHtml
    + '<div class="black-field">'
    + '<label>黑屋通知（点击选项填入下方输入框）</label>'
    + '<div class="black-preset-grid" id="black-notice-preset-list">' + presetHtml + '</div>'
    + '<textarea class="black-input black-notice-custom" id="black-notice-custom" placeholder="自定义通知内容..." maxlength="100"></textarea>'
    + '</div>'
    + '<div class="black-actions">'
    + '<button class="black-btn black-btn-cancel" onclick="closeBlackRoomPanel()">取消</button>'
    + '<button class="black-btn black-btn-primary" onclick="saveBlackRoomPanel()">保存并发送</button>'
    + '</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);

  var list = document.getElementById('black-room-member-list');
  if (list) {
    list.addEventListener('click', function(e) {
      var chip = e.target.closest ? e.target.closest('.black-member-chip') : null;
      if (!chip) return;
      var toggle = document.getElementById('black-enabled-toggle');
      if (toggle && !toggle.classList.contains('on')) return;
      chip.classList.toggle('active');
    });
  }
  var presetList = document.getElementById('black-notice-preset-list');
  if (presetList) {
    presetList.addEventListener('click', function(e) {
      var item = e.target.closest ? e.target.closest('.black-preset-item') : null;
      if (!item) return;
      var input = document.getElementById('black-notice-custom');
      if (input) input.value = item.getAttribute('data-text') || '';
      var items = presetList.querySelectorAll('.black-preset-item');
      items.forEach(function(x) { x.classList.remove('selected'); });
      item.classList.add('selected');
    });
  }
  var overlay = document.getElementById('black-room-overlay');
  if (overlay) {
    overlay.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  }
}

function toggleBlackEnabled() {
  var toggle = document.getElementById('black-enabled-toggle');
  var list = document.getElementById('black-room-member-list');
  if (!toggle) return;
  var on = toggle.classList.toggle('on');
  if (list) list.classList.toggle('disabled', !on);
}

function closeBlackRoomPanel() {
  var el = document.getElementById('black-room-overlay');
  if (el) el.remove();
}

/* 保存黑屋开关 + 名单，并按需发送黑屋通知 */
function saveBlackRoomPanel() {
  var chatId = _currentChatId();
  if (!chatId) return;
  var toggle = document.getElementById('black-enabled-toggle');
  var enabled = toggle ? toggle.classList.contains('on') : false;
  var chips = document.querySelectorAll('#black-room-member-list .black-member-chip.active');
  var ids = [];
  var hasAll = false;
  chips.forEach(function(c) {
    if (c.dataset.member === '__ALL__') { hasAll = true; return; }
    ids.push(c.dataset.member);
  });

  // 保存黑屋开关状态与名单（关闭则清空）
  var finalIds = enabled ? ids : [];
  if (enabled) {
    if (hasAll && isGroupChatId(chatId)) {
      // 群聊选「全员」：名单为全部成员，开启后所有成员消息都带标签
      var gAll = getGroupByChatId(chatId);
      var allMembers = gAll ? getGroupMembers(gAll) : [];
      finalIds = allMembers.map(function(m) { return m.id; });
    } else if (!isGroupChatId(chatId)) {
      // 单聊：成员选择不展示，开启黑屋即视为关入当前对方
      var partner = _getCurrentPartnerProfile();
      if (partner) finalIds = [partner.id];
    }
  }
  setBlackRoomIds(chatId, finalIds);
  Storage.set('blackRoomEnabled_' + chatId, !!enabled);
  // 记录本次开启时刻：标签只出现在开启后发送的消息上（开启前/关闭后的历史消息不标）
  Storage.set('blackRoomEnabledAt_' + chatId, enabled ? Date.now() : null);

  // 发送黑屋通知（内容非空才发送）
  var input = document.getElementById('black-notice-custom');
  var text = (input && input.value || '').trim();
  var sent = false;
  if (text) {
    var memberIds = [];
    var names = [];
    var isGroup = isGroupChatId(chatId);
    if (isGroup) {
      if (hasAll) {
        var g = getGroupByChatId(chatId);
        var all = g ? getGroupMembers(g) : [];
        all.forEach(function(m) { memberIds.push(m.id); names.push(m.nickname || '成员'); });
      } else {
        chips.forEach(function(c) {
          if (c.dataset.member === '__ALL__') return;
          memberIds.push(c.dataset.member);
          var g2 = getGroupByChatId(chatId);
          var ms = g2 ? getGroupMembers(g2) : [];
          for (var i = 0; i < ms.length; i++) {
            if (ms[i].id === c.dataset.member) { names.push(ms[i].nickname || '成员'); break; }
          }
        });
      }
    } else {
      // 单聊：成员选择不展示，通知对象固定为当前对方
      var p = _getCurrentPartnerProfile();
      if (p) { memberIds.push(p.id); names.push(p.nickname || '对方'); }
    }
    if (memberIds.length) {
      _sendBlackNoticeCore(chatId, memberIds, names, text, isGroup && hasAll);
      sent = true;
    }
  }

  closeBlackRoomPanel();
  renderChatMessages(chatId);
  var parts = [];
  parts.push(enabled ? (finalIds.length ? '已开启小黑屋 ' + finalIds.length + ' 人' : '小黑屋已开启') : '小黑屋已关闭');
  if (sent) parts.push('已发送黑屋通知');
  Core.toast(parts.join('，'));
}

/* 发送黑屋通知（居中气泡，粉红色系，与拍一拍/撤回同款透明度结构） */
function _sendBlackNoticeCore(chatId, memberIds, names, text, hasAll) {
  if (!memberIds.length) { Core.toast('请选择通知对象'); return; }
  var targetText = hasAll ? '全员' : names.join('、');
  var messages = Storage.getMessages(chatId);
  var newMsg = {
    id: Date.now(),
    type: 'system',
    text: '[黑屋通知·' + targetText + '] ' + text,
    time: Date.now(),
    msgType: 'blacknotice',
    isBlackNotice: true,
    noticeMemberIds: memberIds.slice()
  };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, '[黑屋通知] ' + text);
  appendMessage(chatId, newMsg);
  App.playSound('send');
}

/* ============================================================
   惩罚功能（加号菜单 / 小黑屋旁）
   发布惩罚通知（居中气泡，红色系）：
   - 单聊：惩罚对象为当前对方；群聊：惩罚对象为全员
   - 发布后，被惩罚对象延时自动回复「收到惩罚："内容"我知道错了😭」
   ============================================================ */
var PUNISH_PRESETS = [
  { icon: '🧎', text: '跪搓衣板' },
  { icon: '📝', text: '写检讨书' },
  { icon: '✍️', text: '罚抄名字一百遍' },
  { icon: '🤐', text: '一天不许说话' },
  { icon: '🧧', text: '发红包道歉' },
  { icon: '💌', text: '背情书' },
  { icon: '🧱', text: '面壁思过' },
  { icon: '🧹', text: '做家务' }
];

/* 打开发布惩罚弹窗（复用 black-overlay/black-panel 结构，预设网格独立类避免污染黑屋） */
function openPunishPanel() {
  closePlusMenu();
  var chatId = _currentChatId();
  if (!chatId) { Core.toast('请先进入聊天'); return; }
  var isGroup = isGroupChatId(chatId);
  var targetName = isGroup ? (_getCurrentGroupName() || '群聊') : _getCurrentPartnerName();

  var presetHtml = '';
  PUNISH_PRESETS.forEach(function(p) {
    presetHtml += '<div class="punish-preset-item" data-text="' + Core.escapeHtml(p.text) + '"><span class="preset-icon">' + p.icon + '</span><span class="preset-text">' + Core.escapeHtml(p.text) + '</span></div>';
  });

  var html = '<div class="black-overlay" id="punish-overlay" onclick="closePunishPanel()">'
    + '<div class="black-panel punish-panel" onclick="event.stopPropagation()">'
    + '<div class="black-title"><i class="fas fa-gavel"></i>发布惩罚</div>'
    + '<div class="black-field">'
    + '<label>惩罚对象：' + Core.escapeHtml(targetName) + '</label>'
    + '<div class="punish-preset-grid" id="punish-preset-list">' + presetHtml + '</div>'
    + '<textarea class="black-input black-notice-custom" id="punish-custom-input" placeholder="自定义惩罚…" maxlength="100"></textarea>'
    + '</div>'
    + '<div class="black-actions">'
    + '<button class="black-btn black-btn-cancel" onclick="closePunishPanel()">取消</button>'
    + '<button class="black-btn black-btn-primary" onclick="sendPunish()">发布</button>'
    + '</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);

  var presetList = document.getElementById('punish-preset-list');
  if (presetList) {
    presetList.addEventListener('click', function(e) {
      var item = e.target.closest ? e.target.closest('.punish-preset-item') : null;
      if (!item) return;
      var input = document.getElementById('punish-custom-input');
      if (input) input.value = item.getAttribute('data-text') || '';
      var items = presetList.querySelectorAll('.punish-preset-item');
      items.forEach(function(x) { x.classList.remove('selected'); });
      item.classList.add('selected');
    });
  }
  var overlay = document.getElementById('punish-overlay');
  if (overlay) {
    overlay.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  }
}

function closePunishPanel() {
  var el = document.getElementById('punish-overlay');
  if (el) el.remove();
}

/* 发布惩罚通知 */
function sendPunish() {
  var chatId = _currentChatId();
  if (!chatId) { Core.toast('请先进入聊天'); return; }
  var input = document.getElementById('punish-custom-input');
  var text = (input && input.value || '').trim();
  if (!text) { Core.toast('请输入惩罚内容'); return; }

  var isGroup = isGroupChatId(chatId);
  var memberIds = [];
  var names = [];
  if (isGroup) {
    var g = getGroupByChatId(chatId);
    var all = g ? getGroupMembers(g) : [];
    all.forEach(function(m) { memberIds.push(m.id); names.push(m.nickname || '成员'); });
  } else {
    var p = _getCurrentPartnerProfile();
    if (p) { memberIds.push(p.id); names.push(p.nickname || '对方'); }
  }
  if (!memberIds.length) { Core.toast('暂无通知对象'); return; }

  _sendPunishCore(chatId, memberIds, names, text, isGroup);
  closePunishPanel();
  renderChatMessages(chatId);
  Core.toast('已发布惩罚通知');
}

/* 发送惩罚通知（居中气泡，红色系，与黑屋通知同款透明度结构） */
function _sendPunishCore(chatId, memberIds, names, text, hasAll) {
  if (!memberIds.length) { Core.toast('请选择通知对象'); return; }
  var targetText = hasAll ? '全员' : names.join('、');
  var messages = Storage.getMessages(chatId);
  var newMsg = {
    id: Date.now(),
    type: 'system',
    text: '[惩罚·' + targetText + '] ' + text,
    time: Date.now(),
    msgType: 'punish',
    isPunish: true,
    punishMemberIds: memberIds.slice()
  };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, '[惩罚] ' + text);
  appendMessage(chatId, newMsg);
  App.playSound('send');

  // 被惩罚对象自动回复：收到惩罚：内容 + 我知道错了😭
  schedulePunishReply(chatId, memberIds.slice(), text);
}

/* 模拟被惩罚方回复「收到惩罚："xxx"我知道错了😭」 */
function schedulePunishReply(chatId, memberIds, punishText) {
  var minDelay = Storage.getReplyMinDelay ? (Storage.getReplyMinDelay() || 1) : 1;
  var maxDelay = Storage.getReplyMaxDelay ? (Storage.getReplyMaxDelay() || 4) : 4;
  var delay = (minDelay + Math.random() * Math.max(0, maxDelay - minDelay)) * 1000;
  if (delay < 800) delay = 800 + Math.random() * 1200;
  var isGroup = isGroupChatId(chatId);
  var replyTargets = [];
  if (isGroup && memberIds && memberIds.length) {
    var g = getGroupByChatId(chatId);
    var members = g ? getGroupMembers(g) : [];
    memberIds.forEach(function(mid) {
      for (var i = 0; i < members.length; i++) {
        if (members[i].id === mid) { replyTargets.push(members[i]); break; }
      }
    });
    if (!replyTargets.length && members.length) replyTargets.push(members[Math.floor(Math.random() * members.length)]);
  }
  setTimeout(function() {
    if (Storage.getTypingIndicator && Storage.getTypingIndicator()) {
      showTypingIndicator(isGroup && replyTargets.length ? (replyTargets[0].nickname || '') : '');
      setTimeout(function() { _doPunishReply(chatId, replyTargets, punishText, isGroup); }, 1400 + Math.random() * 2000);
    } else {
      _doPunishReply(chatId, replyTargets, punishText, isGroup);
    }
  }, delay);
}

function _doPunishReply(chatId, replyTargets, punishText, isGroup) {
  hideTypingIndicator();
  var replyText = '收到惩罚："' + punishText + '"我知道错了😭';
  if (isGroup && replyTargets.length) {
    replyTargets.forEach(function(member, idx) {
      setTimeout(function() {
        var msgs = Storage.getMessages(chatId);
        var newMsg = { id: Date.now() + idx, type: 'other', fromId: member.id, text: replyText, time: Date.now(), msgType: 'text' };
        msgs.push(newMsg);
        Storage.setMessages(chatId, msgs);
        updateLastMsg(chatId, (member.nickname || '成员') + '：' + replyText);
        _safeAppendMessage(chatId, newMsg);
        App.playSound('receive');
        showBackgroundPush((member.nickname || '成员') + '：' + replyText);
      }, idx * (1200 + Math.random() * 1500));
    });
    return;
  }
  var msgs = Storage.getMessages(chatId);
  var newMsg = { id: Date.now(), type: 'other', text: replyText, time: Date.now(), msgType: 'text' };
  msgs.push(newMsg);
  Storage.setMessages(chatId, msgs);
  updateLastMsg(chatId, replyText);
  _safeAppendMessage(chatId, newMsg);
  App.playSound('receive');
  showBackgroundPush(replyText);
}

/* ============================================================
   拍一拍（加号菜单 / 字卡界面）
   文案模板："我方"xxxx"对方"xxxx（占位符渲染，可自定义）
   我方发送：我方=我，对方=对方；对方发送：人员调换；群聊：对方自动取群聊名
   字卡界面：对方角色自动回复发布（居中气泡）
   ============================================================ */
var PAT_PRESETS = [
  '"我方"拍了拍"对方"：想你了',
  '"我方"戳了戳"对方"：抱抱',
  '"我方"拍了拍"对方"：晚安，梦里见',
  '"我方"捏了捏"对方"：么么哒',
  '"我方"摸了摸"对方"的小脑袋'
];

/* 拍一拍气泡内的小爱心图标（固定粉红色） */
var PAT_ICON_SVG = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M16 28 C16 28 3.5 20.5 3.5 11.5 C3.5 6.5 7.5 3.5 11.5 3.5 C13.8 3.5 15.2 4.6 16 5.8 C16.8 4.6 18.2 3.5 20.5 3.5 C24.5 3.5 28.5 6.5 28.5 11.5 C28.5 20.5 16 28 16 28 Z"/></svg>';
window.PAT_ICON_SVG = PAT_ICON_SVG;

/* 规范化文本符号：❤(U+2764)/♥(U+2665) 若未带变体选择符则追加 U+FE0E，强制文本呈现，避免被彩色 emoji 字体抢渲染 */
function _normTextSymbol(sym) {
  if (!sym) return sym;
  sym = String(sym);
  if ((sym === '❤' || sym === '♥') && sym.indexOf('\uFE0E') === -1 && sym.indexOf('\uFE0F') === -1) {
    return sym + '\uFE0E';
  }
  return sym;
}

/* 拍一拍气泡符号：按发送方取自定义符号（默认爱心），在聊天设置-功能设置中可分别设置我方/对方符号 */
function _patSymbolForMsg(msg) {
  var isSelf = !!(msg && msg.type === 'self');
  var sym = isSelf ? Storage.getPatSelfSymbol() : Storage.getPatOtherSymbol();
  return _normTextSymbol((sym && String(sym).trim()) || '♥︎');
}
window._patSymbolForMsg = _patSymbolForMsg;

/* 打开拍一拍弹窗（同款图二布局：标题 + 3列预设网格 + 双输入框紧凑排布 + 取消/发送按钮）
   mode='self' 我方发送；mode='other' 对方角色自动回复发布 */
function openPatPanel(mode, presetText) {
  var chatId = _currentChatId();
  if (!chatId) { Core.toast('请先进入聊天'); return; }
  var isGroup = isGroupChatId(chatId);
  var partnerName = isGroup ? (_getCurrentGroupName() || '群聊') : _getCurrentPartnerName();

  var presetHtml = '';
  // 拍一拍预设统一来自用户分组管理库（与设置页"拍一拍"、混发拍一拍同一来源）
  var presetPats = Storage.getPats();
  if (!presetPats.length) {
    // 用户库为空时兜底内置恋爱向模板
    presetPats = PAT_PRESETS.map(function(text) { return { text: text }; });
  }
  presetPats.forEach(function(p) {
    var _parts = _splitPatTemplate(p.text);
    var _a = (p.a !== undefined && p.a !== null) ? p.a : _parts.a;
    var _b = (p.b !== undefined && p.b !== null) ? p.b : _parts.b;
    // 属性值需额外转义双引号：模板含"我方""对方"占位符，Core.escapeHtml 不转义引号会导致 data-* 属性被截断
    var _aAttr = Core.escapeHtml(String(_a == null ? '' : _a)).replace(/"/g, '&quot;');
    var _bAttr = Core.escapeHtml(String(_b == null ? '' : _b)).replace(/"/g, '&quot;');
    var _textAttr = Core.escapeHtml(String(p.text == null ? '' : p.text)).replace(/"/g, '&quot;');
    presetHtml += '<div class="pat-preset-card" data-text="' + _textAttr + '" data-a="' + _aAttr + '" data-b="' + _bAttr + '">'
      + '<span class="pat-preset-icon">♡</span>'
      + '<span class="pat-preset-a">' + Core.escapeHtml(_a || '拍了拍') + '</span>'
      + '<span class="pat-preset-b">' + Core.escapeHtml(_b || '') + '</span>'
      + '</div>';
  });

  var isOther = mode === 'other';
  var btnText = isOther ? '让对方拍一拍' : '发送拍一拍';

  var html = '<div class="black-overlay" id="pat-overlay" onclick="closePatPanel()">'
    + '<div class="black-panel pat-panel" onclick="event.stopPropagation()">'
    + '<div class="black-title"><i class="fas fa-hand-point-up"></i>拍一拍</div>'
    + '<div class="black-field">'
    + '<label>拍一拍模板（点击预设填入下方输入框）</label>'
    + '<div class="pat-preset-grid" id="pat-preset-list">' + presetHtml + '</div>'
    + '</div>'
    + '<div class="black-field">'
    + '<label>自定义内容（保留"我方"/"对方"两个动作）</label>'
    + '<div class="pat-input-row">'
    + '<div class="pat-input-wrap"><span class="pat-input-tag">我方</span><input class="black-input" id="pat-custom-a" placeholder="如：拍了拍" maxlength="30"></div>'
    + '<div class="pat-input-wrap"><span class="pat-input-tag">对方</span><input class="black-input" id="pat-custom-b" placeholder="如：想你了" maxlength="30"></div>'
    + '</div>'
    + '</div>'
    + '<div class="black-actions">'
    + '<button class="black-btn black-btn-cancel" onclick="closePatPanel()">取消</button>'
    + '<button class="black-btn black-btn-primary" onclick="sendPat(\'' + (isOther ? 'other' : 'self') + '\')">' + btnText + '</button>'
    + '</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);

  // 预填模板（字卡拍一拍点击条目时传入，拆分"我方"/"对方"动作填入输入框）
  if (presetText) {
    var _parts = _splitPatTemplate(presetText);
    var _inA = document.getElementById('pat-custom-a');
    var _inB = document.getElementById('pat-custom-b');
    if (_inA) _inA.value = _parts.a;
    if (_inB) _inB.value = _parts.b;
  }

  var presetList = document.getElementById('pat-preset-list');
  if (presetList) {
    presetList.addEventListener('click', function(e) {
      var item = e.target.closest ? e.target.closest('.pat-preset-card') : null;
      if (!item) return;
      var inputA = document.getElementById('pat-custom-a');
      var inputB = document.getElementById('pat-custom-b');
      var valA = item.getAttribute('data-a');
      var valB = item.getAttribute('data-b');
      // 兼容无 data-a/data-b 的旧卡片：退回解析 data-text
      if (valA === null && valB === null) {
        var parts = _splitPatTemplate(item.getAttribute('data-text') || '');
        valA = parts.a; valB = parts.b;
      }
      if (inputA) inputA.value = valA == null ? '' : valA;
      if (inputB) inputB.value = valB == null ? '' : valB;
      var items = presetList.querySelectorAll('.pat-preset-card');
      items.forEach(function(x) { x.classList.remove('selected'); });
      item.classList.add('selected');
      Core.toast('已填入模板，点击「发送拍一拍」即可');
    });
  }
  var overlay = document.getElementById('pat-overlay');
  if (overlay) {
    overlay.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  }
}

function closePatPanel() {
  var el = document.getElementById('pat-overlay');
  if (el) el.remove();
}

/* 拍一拍文案渲染：模板含"我方"/"对方"占位符，按发送方与会话类型替换为真实名字。
   我方发送：我方=我，对方=对方；对方发送：人员调换；群聊：对方自动取群聊名（人员自适应） */
/* 按 chatId 解析对方/群聊名称（不依赖当前全局会话状态，避免异步回调期间切换会话导致名字错乱） */
function _resolveChatNameByChatId(chatId) {
  if (!chatId) return '';
  // 私人聊天：partner_<id>
  if (chatId.indexOf('partner_') === 0) {
    var pid = chatId.slice('partner_'.length);
    try {
      var partners = Storage.getPartnerProfiles();
      for (var p = 0; p < partners.length; p++) {
        if (String(partners[p].id) === pid) {
          return partners[p].nickname || partners[p].avatar || '';
        }
      }
    } catch (e) {}
  }
  // 普通会话（聊天记录表 chat.name）
  try {
    var chats = Storage.getChats();
    if (chats && Array.isArray(chats)) {
      for (var i = 0; i < chats.length; i++) {
        if (String(chats[i].id) === String(chatId)) return chats[i].name || '';
      }
    }
  } catch (e) {}
  // 群聊
  try {
    var groups = Storage.getGroupChats ? Storage.getGroupChats() : [];
    if (groups && Array.isArray(groups)) {
      for (var j = 0; j < groups.length; j++) {
        if (String(groups[j].id) === String(chatId)) return groups[j].name || '';
      }
    }
  } catch (e) {}
  return '';
}

/* 构建拍一拍文本。chatId 可选：传入时按该会话解析对方名，
   修复多角色场景下自动回复（setTimeout 回调）时全局会话已切换导致名字错乱的问题 */
function _buildPatText(template, mode, isGroup, chatId) {
  var selfName = '我';
  var boundName = _resolveChatNameByChatId(chatId);
  var otherName;
  if (isGroup) {
    otherName = boundName || (_getCurrentGroupName() || '群聊');
  } else {
    otherName = boundName || _getCurrentPartnerName();
  }
  var myName = (mode === 'other') ? otherName : selfName;
  var yourName = (mode === 'other') ? selfName : otherName;
  var text = (template || '').trim();
  if (text.indexOf('"我方"') === -1 && text.indexOf('"对方"') === -1) {
    // 未使用占位符时自动补全：开头加"我方"，在第一个 ：/，/, 前插入"对方"
    var m = /([：，,])/.exec(text);
    if (m) {
      text = '"我方"' + text.slice(0, m.index) + '"对方"' + text.slice(m.index);
    } else {
      text = '"我方"' + text + '"对方"';
    }
  }
  return text.replace(/"我方"/g, myName).replace(/"对方"/g, yourName);
}

/* 拆分拍一拍模板为"我方"动作与"对方"动作两部分 */
function _splitPatTemplate(text) {
  var m = /"我方"([\s\S]*)"对方"([\s\S]*)/.exec(text || '');
  if (m) return { a: m[1], b: m[2] };
  return { a: text || '', b: '' };
}

/* 发送拍一拍：mode='self' 我方发送；mode='other' 对方角色自动回复发布 */
function sendPat(mode) {
  var chatId = _currentChatId();
  if (!chatId) return;
  var inputA = document.getElementById('pat-custom-a');
  var inputB = document.getElementById('pat-custom-b');
  var a = (inputA && inputA.value || '').trim();
  var b = (inputB && inputB.value || '').trim();
  if (!a && !b) { Core.toast('请输入拍一拍内容'); return; }

  var isGroup = isGroupChatId(chatId);
  var template = '"我方"' + a + '"对方"' + b;
  // 按 chatId 绑定对方名，避免多角色场景下批向当前全局会话造成名字错乱
  var finalText = _buildPatText(template, mode, isGroup, chatId);

  var messages = Storage.getMessages(chatId);
  var newMsg = {
    id: Date.now(),
    type: mode === 'other' ? 'other' : 'self',
    text: finalText,
    time: Date.now(),
    msgType: 'pat',
    isPat: true
  };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, finalText);
  closePatPanel();
  appendMessage(chatId, newMsg);
  App.playSound('send');

  // 我方发出的拍一拍：触发对方自动回复并混发拍一拍（不再局限于关键词触发）
  if (mode !== 'other') {
    schedulePatAutoReplyFlow(chatId);
  }
}

/* ============================================================
   对方收到拍一拍后自动回复 + 低概率混发拍一拍
   （区别于旧版仅「你发拍一拍」关键词触发的 schedulePatAutoReply；
     混发改为与红包/表情包/字卡一致的低概率机制，概率更低，不再必发）
   ============================================================ */
var PAT_AUTO_REPLY_MIX_PROBABILITY = 0.5; // 50%，用户主动发拍一拍后对方回拍概率（由 15% 提升至 50%）
var _patAutoReplyFlowTimers = {};
function schedulePatAutoReplyFlow(chatId) {
  if (!chatId) return;
  var isGroup = isGroupChatId(chatId);

  // 1) 对方先正常自动回复（文本/字卡/颜文字/表情包/红包等，沿用现有混发机制）
  if (isGroup) {
    if (typeof scheduleGroupAutoReply === 'function') scheduleGroupAutoReply(chatId);
  } else {
    if (typeof scheduleAutoReply === 'function') scheduleAutoReply(chatId);
  }

  // 2) 低概率混发一条拍一拍：对方（或群聊中随机成员）也拍一拍你
  //    开关关闭时不再混发（概率 0），开启时保持 50%
  if (!Storage.getPatMixEnabled()) return;
  if (Math.random() >= PAT_AUTO_REPLY_MIX_PROBABILITY) return;
  var minDelay = Storage.getReplyMinDelay();
  var maxDelay = Storage.getReplyMaxDelay();
  var delay = (minDelay + Math.random() * Math.max(0, maxDelay - minDelay)) * 1000 + 2600 + Math.random() * 3000;
  if (delay < 3200) delay = 3200 + Math.random() * 2600;
  if (_patAutoReplyFlowTimers[chatId]) clearTimeout(_patAutoReplyFlowTimers[chatId]);
  _patAutoReplyFlowTimers[chatId] = setTimeout(function() {
    delete _patAutoReplyFlowTimers[chatId];
    // 对方还在输入中时，等输入气泡播完再发，避免节奏突兀
    if (Storage.getTypingIndicator()) {
      showTypingIndicator();
      setTimeout(function() {
        hideTypingIndicator();
        _sendPatAutoReply(chatId);
      }, 1500 + Math.random() * 2000);
    } else {
      _sendPatAutoReply(chatId);
    }
  }, delay);
}

/* 字卡界面拍一拍入口：跳转到最近活跃的聊天会话，再打开拍一拍弹窗（对方发布模式） */
function openPatPanelFromWordcard() {
  var chatId = _getMostRecentChatId();
  if (!chatId) { Core.toast('暂无聊天会话'); return; }
  if (chatId.indexOf('partner_') === 0) {
    openChatRoom(chatId);
  } else {
    openGroupRoom(chatId);
  }
  openPatPanel('other');
}

/* 获取最近活跃的聊天会话（按最后消息时间倒序取第一个） */
function _getMostRecentChatId() {
  var chats = Storage.getChats();
  var partners = Storage.getPartnerProfiles();
  var groupChats = Storage.getGroupChats();
  var best = null;
  var bestTime = -1;
  chats.forEach(function(c) {
    if ((c.lastTime || 0) > bestTime) { bestTime = c.lastTime || 0; best = c.id; }
  });
  if (best) return best;
  if (partners.length) return 'partner_' + partners[0].id;
  if (groupChats.length) return groupChats[0].id;
  return null;
}

/* ============================================================
   字卡界面拍一拍管理（分组列表 + 分组子页，对齐主字卡/颜文字样式）
   字卡界面的拍一拍只能由对方角色发布（对方拍了拍你）
   ============================================================ */

/* 拍一拍分组列表 */
function getPatGroups() {
  var pats = Storage.getPats();
  var groups = {};
  pats.forEach(function(p) {
    var cat = p.category || '未分类';
    if (!groups[cat]) groups[cat] = 0;
    groups[cat]++;
  });
  var list = [];
  for (var name in groups) {
    list.push({ name: name, count: groups[name] });
  }
  return list;
}

/* 入口页：拍一拍分组列表 */
function renderWordCardPat() {
  var container = document.getElementById('pat-group-list');
  if (!container) return;
  window._patCurrentGroup = '';

  var groups = getPatGroups();
  if (!groups.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">暂无分组</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    html += '<div class="group-item-wrapper">'
          + '<div class="discover-item" onclick="openPatGroup(\'' + escapeHtml(g.name) + '\')">'
          + '<div class="discover-icon"><i class="fas fa-hand-point-up"></i></div>'
          + '<div class="discover-info">'
          + '<div class="discover-title">' + escapeHtml(g.name) + '</div>'
          + '<div class="discover-desc">' + g.count + ' 条拍一拍</div>'
          + '</div>'
          + '<i class="fas fa-chevron-right discover-arrow"></i>'
          + '</div>'
          + '<div class="group-item-actions">'
          + '<button onclick="event.stopPropagation();editPatGroupName(\'' + escapeHtml(g.name) + '\')" title="编辑分组名"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="event.stopPropagation();deletePatGroupItem(\'' + escapeHtml(g.name) + '\')" title="删除分组"><i class="fas fa-trash-alt"></i></button>'
          + '</div></div>';
    if (i < groups.length - 1) html += '<div class="list-divider"></div>';
  }
  container.innerHTML = html;
}

function openPatGroup(name) {
  window._patCurrentGroup = name;
  Navigation.navigateTo('wordcard-pat-group');
}

/* 分组子页：拍一拍列表（点击条目 = 对方角色发布） */
function renderWordCardPatGroup() {
  var container = document.getElementById('pat-grid-group');
  var titleEl = document.getElementById('pat-group-title');
  if (!container) return;

  var group = window._patCurrentGroup || '';
  if (titleEl) titleEl.textContent = group;

  var pats = Storage.getPats().filter(function(p) { return (p.category || '未分类') === group; });
  if (!pats.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-lighter)">此分组暂无拍一拍</div>';
    return;
  }

  var html = '';
  pats.forEach(function(p) {
    var pid = p.id || '';
    var parts = _splitPatTemplate(p.text);
    var a = (p.a !== undefined && p.a !== null) ? p.a : parts.a;  // 对方动作（前）
    var b = (p.b !== undefined && p.b !== null) ? p.b : parts.b;  // 我方动作（后）
    html += '<div class="card-list-item" data-pat-id="' + escapeHtml(pid) + '">'
          + '<div class="card-list-item-body" onclick="sendPatFromWordcard(\'' + escapeHtml(pid) + '\')" title="点击发送给对方">'
          + '<div class="pat-parts">'
          + '<div class="pat-part"><span class="pat-part-tag pat-tag-other">对方</span><span class="pat-part-text">' + escapeHtml(a) + '</span></div>'
          + '<div class="pat-part"><span class="pat-part-tag pat-tag-self">我方</span><span class="pat-part-text">' + escapeHtml(b) + '</span></div>'
          + '</div>'
          + '</div>'
          + '<div class="card-list-item-actions" onclick="event.stopPropagation()">'
          + '<button onclick="editPatItem(\'' + escapeHtml(pid) + '\')" title="编辑"><i class="fas fa-pen"></i></button>'
          + '<button class="danger" onclick="deletePatItem(\'' + escapeHtml(pid) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
          + '</div>'
          + '</div>';
  });
  container.innerHTML = html;
}

/* 添加拍一拍分组 */
function addPatGroup() {
  _showPatInputModal({
    title: '添加拍一拍分组',
    showGroupInput: true,
    callback: function(data) {
      var pats = Storage.getPats();
      var added = 0, skipped = 0;
      if (_isPatTextDuplicate(data.a, data.b)) { skipped++; }
      else {
        pats.push({ id: 'p' + Date.now(), a: data.a, b: data.b, category: data.category });
        added++;
      }
      Storage.setPats(pats);
      renderWordCardPat();
      var msg = '分组「' + data.category + '」已创建，已添加 ' + added + ' 条拍一拍';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 条重复';
      Core.toast(msg);
    }
  });
}

function editPatGroupName(oldName) {
  Core.formModal('修改分组名称', [
    { label: '新分组名称', placeholder: '请输入新名称', value: oldName }
  ], function(values) {
    var newName = values[0];
    if (!newName || newName === oldName) return;
    var pats = Storage.getPats();
    pats.forEach(function(p) {
      if ((p.category || '未分类') === oldName) p.category = newName;
    });
    Storage.setPats(pats);
    renderWordCardPat();
    if (window._patCurrentGroup === oldName) window._patCurrentGroup = newName;
    Core.toast('分组已重命名');
  });
}

function deletePatGroupItem(groupName) {
  Core.confirm('删除分组', '确定删除分组「' + groupName + '」及其下所有拍一拍？此操作不可撤销。', function() {
    var pats = Storage.getPats();
    Storage.setPats(pats.filter(function(p) { return (p.category || '未分类') !== groupName; }));
    renderWordCardPat();
    Core.toast('分组已删除');
  });
}

/* 添加拍一拍到当前分组 */
function addPatToGroup() {
  var group = window._patCurrentGroup;
  if (!group) { alert('未选择分组'); return; }
  _showPatInputModal({
    title: '添加拍一拍',
    group: group,
    callback: function(data) {
      var pats = Storage.getPats();
      var added = 0, skipped = 0;
      if (_isPatTextDuplicate(data.a, data.b)) { skipped++; }
      else {
        pats.push({ id: 'p' + Date.now(), a: data.a, b: data.b, category: data.category });
        added++;
      }
      Storage.setPats(pats);
      renderWordCardPatGroup();
      var msg = '已添加 ' + added + ' 条拍一拍';
      if (skipped > 0) msg += '，跳过 ' + skipped + ' 条重复';
      Core.toast(msg);
    }
  });
}

/* 拍一拍专用输入弹窗：对方动作 + 我方动作 两个输入框 */
function _showPatInputModal(options) {
  _closeCardInputModal();
  var title = options.title || '添加拍一拍';
  var group = options.group || '';
  var showGroupInput = options.showGroupInput || false;
  var presetA = options.presetA || '';
  var presetB = options.presetB || '';
  var callback = options.callback;

  var overlay = document.createElement('div');
  overlay.className = 'card-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) _closeCardInputModal(); };

  var groupHtml = '';
  if (showGroupInput) {
    groupHtml = '<div class="card-modal-row"><label class="card-modal-label">分组名称</label>'
      + '<input class="card-modal-field" id="pi-group" placeholder="输入分组名称（默认：未分类）"></div>';
  } else if (group) {
    groupHtml = '<div class="card-modal-row"><label class="card-modal-label">分组</label>'
      + '<span class="card-modal-static">' + escapeHtml(group) + '</span></div>';
  }

  overlay.innerHTML =
    '<div class="card-modal-panel" onclick="event.stopPropagation()">'
    + '<div class="card-modal-title">' + escapeHtml(title) + '</div>'
    + groupHtml
    + '<div class="card-modal-row">'
    +   '<label class="card-modal-label">对方动作</label>'
    +   '<input class="card-modal-field" id="pi-a" placeholder="如：拍了拍" value="' + escapeAttr(presetA) + '">'
    + '</div>'
    + '<div class="card-modal-row">'
    +   '<label class="card-modal-label">我方动作</label>'
    +   '<input class="card-modal-field" id="pi-b" placeholder="如：想你了" value="' + escapeAttr(presetB) + '">'
    + '</div>'
    + '<div class="card-modal-hint">发送效果：对方拍了拍我：想你了</div>'
    + '<div class="card-modal-actions">'
    +   '<button class="card-modal-btn card-modal-btn-cancel" onclick="_closeCardInputModal()">取消</button>'
    +   '<button class="card-modal-btn card-modal-btn-confirm" id="pi-confirm">确认</button>'
    + '</div>'
    + '</div>';

  document.body.appendChild(overlay);

  setTimeout(function() {
    var a = document.getElementById('pi-a');
    if (a) a.focus();
  }, 100);

  document.getElementById('pi-confirm').onclick = function() {
    var a = document.getElementById('pi-a').value.trim();
    var b = document.getElementById('pi-b').value.trim();
    if (!a && !b) { Core.toast('请输入拍一拍内容'); return; }
    var category = group;
    if (showGroupInput) {
      category = (document.getElementById('pi-group').value || '').trim() || '未分类';
    }
    _closeCardInputModal();
    callback({ a: a, b: b, category: category });
  };
}

function _isPatTextDuplicate(a, b, excludeId) {
  var pats = Storage.getPats();
  for (var i = 0; i < pats.length; i++) {
    var p = pats[i];
    var parts = _splitPatTemplate(p.text);
    var pa = (p.a !== undefined && p.a !== null) ? p.a : parts.a;
    var pb = (p.b !== undefined && p.b !== null) ? p.b : parts.b;
    if (pa === a && pb === b && p.id !== excludeId) return true;
  }
  return false;
}

function editPatItem(id) {
  var pats = Storage.getPats();
  var target = null;
  for (var i = 0; i < pats.length; i++) {
    if (pats[i].id === id) { target = pats[i]; break; }
  }
  if (!target) return;
  var parts = _splitPatTemplate(target.text);
  var a = (target.a !== undefined && target.a !== null) ? target.a : parts.a;
  var b = (target.b !== undefined && target.b !== null) ? target.b : parts.b;
  _showPatInputModal({
    title: '编辑拍一拍',
    group: target.category || '未分类',
    presetA: a,
    presetB: b,
    callback: function(data) {
      target.a = data.a;
      target.b = data.b;
      Storage.setPats(pats);
      renderWordCardPatGroup();
      Core.toast('拍一拍已更新');
    }
  });
}

function deletePatItem(id) {
  Core.confirm('删除拍一拍', '确定删除这条拍一拍吗？', function() {
    var pats = Storage.getPats();
    Storage.setPats(pats.filter(function(p) { return p.id !== id; }));
    renderWordCardPatGroup();
    Core.toast('拍一拍已删除');
  });
}

/* 从字卡界面发送拍一拍：只能由对方角色发布（对方拍了拍你），不打开聊天拍一拍面板 */
function sendPatFromWordcard(id) {
  var pats = Storage.getPats();
  var target = null;
  for (var i = 0; i < pats.length; i++) {
    if (pats[i].id === id) { target = pats[i]; break; }
  }
  if (!target) return;
  var parts = _splitPatTemplate(target.text);
  var a = (target.a !== undefined && target.a !== null) ? target.a : parts.a;
  var b = (target.b !== undefined && target.b !== null) ? target.b : parts.b;
  var chatId = _getMostRecentChatId();
  if (!chatId) { Core.toast('暂无聊天会话'); return; }
  if (chatId.indexOf('partner_') === 0) {
    openChatRoom(chatId);
  } else {
    openGroupRoom(chatId);
  }
  var isGroup = isGroupChatId(chatId);
  var template = '"我方"' + a + '"对方"' + b;
  var finalText = _buildPatText(template, 'other', isGroup, chatId);
  var messages = Storage.getMessages(chatId);
  var newMsg = {
    id: Date.now(),
    type: 'other',
    text: finalText,
    time: Date.now(),
    msgType: 'pat',
    isPat: true
  };
  messages.push(newMsg);
  Storage.setMessages(chatId, messages);
  updateLastMsg(chatId, finalText);
  _safeAppendMessage(chatId, newMsg);
  App.playSound('receive');
  showBackgroundPush(finalText);
}

/* 导出拍一拍 */
function exportPatsJSON() {
  var pats = Storage.getPats();
  if (!pats.length) { Core.toast('暂无拍一拍可导出'); return; }
  var groups = {};
  pats.forEach(function(p) {
    var cat = p.category || '未分类';
    if (!groups[cat]) groups[cat] = [];
    var parts = _splitPatTemplate(p.text);
    groups[cat].push({ a: (p.a !== undefined && p.a !== null) ? p.a : parts.a, b: (p.b !== undefined && p.b !== null) ? p.b : parts.b });
  });
  var payload = { exportDate: new Date().toISOString(), type: 'pats', groups: groups };
  var data = JSON.stringify(payload, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url;
  a.download = 'pats_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  var groupCount = Object.keys(groups).length;
  Core.toast('已导出 ' + pats.length + ' 条拍一拍（' + groupCount + ' 个分组）');
}

/* 导入拍一拍 */
function importPatsJSON() { importUniversalJSON('pats'); }

/* 去重拍一拍 */
function deduplicatePats() {
  var pats = Storage.getPats();
  var seen = {}, deduped = [];
  pats.forEach(function(p) {
    var parts = _splitPatTemplate(p.text);
    var key = (p.a !== undefined && p.a !== null ? p.a : parts.a) + '\u0001' + (p.b !== undefined && p.b !== null ? p.b : parts.b);
    if (!seen[key]) { seen[key] = true; deduped.push(p); }
  });
  var removed = pats.length - deduped.length;
  if (removed === 0) { Core.toast('未发现重复拍一拍'); return; }
  Core.confirm('去重拍一拍', '发现 ' + removed + ' 条重复，是否删除？', function() {
    Storage.setPats(deduped);
    renderWordCardPat();
    Core.toast('已删除 ' + removed + ' 条重复拍一拍');
  });
}

/* ============================================================
   聊天特效（飘落 / 烟花 / 炸弹）
   发布包含关键词的消息时，整个聊天界面播放对应 emoji 特效，
   可在「特效」弹窗中自定义关键词与表情
   ============================================================ */
/* 红色鞭子图标（历史惩罚通知气泡渲染使用，固定红色） */
var PUNISH_ICON_SVG = '<i class="fas fa-bullhorn" style="font-size:14px;display:inline-block;vertical-align:-1px"></i>';
window.PUNISH_ICON_SVG = PUNISH_ICON_SVG;

/* 自定义简笔画烟花图标（替换 🎆 emoji 用于特效弹窗展示） */
var FIREWORK_ICON_SVG = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width="20" height="20" style="vertical-align:middle">'
  + '<circle cx="16" cy="16" r="1.6" fill="none" stroke="#F5A623" stroke-width="1.8"/>'
  + '<path d="M16 5 L16 8 M16 24 L16 27 M5 16 L8 16 M24 16 L27 16 M7.8 7.8 L10 10 M22 22 L24.2 24.2 M24.2 7.8 L22 10 M10 22 L7.8 24.2" stroke="#F5A623" stroke-width="1.8" stroke-linecap="round"/>'
  + '<circle cx="16" cy="5" r="1.4" fill="#FFB84D"/>'
  + '<circle cx="16" cy="27" r="1.4" fill="#FFB84D"/>'
  + '<circle cx="5" cy="16" r="1.4" fill="#FFB84D"/>'
  + '<circle cx="27" cy="16" r="1.4" fill="#FFB84D"/>'
  + '<circle cx="7.8" cy="7.8" r="1.4" fill="#FF8A5C"/>'
  + '<circle cx="24.2" cy="24.2" r="1.4" fill="#FF8A5C"/>'
  + '<circle cx="24.2" cy="7.8" r="1.4" fill="#FF8A5C"/>'
  + '<circle cx="7.8" cy="24.2" r="1.4" fill="#FF8A5C"/>'
  + '<circle cx="12" cy="3.5" r="0.8" fill="#FFD76A"/>'
  + '<circle cx="20" cy="28.5" r="0.8" fill="#FFD76A"/>'
  + '<circle cx="3.5" cy="20" r="0.8" fill="#FFD76A"/>'
  + '<circle cx="28.5" cy="12" r="0.8" fill="#FFD76A"/>'
  + '</svg>';

/* 内置特效规则（首次使用自动写入，可自定义增删改） */
var DEFAULT_EFFECTS = [
  { id: 'fx-1', keyword: '好想你', emoji: '✨', type: 'fall', count: 42, enabled: true },
  { id: 'fx-2', keyword: '爱你', emoji: '💗', type: 'fall', count: 32, enabled: true },
  { id: 'fx-3', keyword: '烟花', emoji: '🎆', type: 'firework', count: 5, enabled: true },
  { id: 'fx-4', keyword: '炸弹', emoji: '💣', type: 'bomb', count: 1, enabled: true },
  { id: 'fx-5', keyword: '想你', emoji: '💘', type: 'heart', count: 24, enabled: false },
  { id: 'fx-6', keyword: '星星', emoji: '⭐', type: 'star', count: 18, enabled: false }
];
var EFFECT_TYPE_NAMES = { fall: '飘落', firework: '烟花', bomb: '炸弹', heart: '爱心', star: '星光' };

function getEffects() {
  var list = Storage.get('chatEffects', null);
  if (!Array.isArray(list) || !list.length) {
    var defs = [];
    DEFAULT_EFFECTS.forEach(function(e) { defs.push({ id: e.id, keyword: e.keyword, emoji: e.emoji, type: e.type, count: e.count, enabled: e.enabled }); });
    return defs;
  }
  return list;
}
function setEffects(list) { Storage.set('chatEffects', list || []); }
function isEffectsEnabled() { return Storage.get('chatEffectsEnabled', true) !== false; }
function setEffectsEnabled(v) { Storage.set('chatEffectsEnabled', !!v); }

/* 特效设置弹窗：总开关 + 规则列表 + 新增规则 + 快速添加 */
function openEffectsPanel() {
  closeEffectsPanel();
  closePlusMenu();
  var enabled = isEffectsEnabled();
  var effects = getEffects();
  var rowHtml = '';
  effects.forEach(function(fx, i) {
    rowHtml += '<div class="fx-rule-row" data-idx="' + i + '">'
      + '<span class="fx-rule-emoji">' + (fx.type === 'firework' || fx.emoji === '🎆' ? FIREWORK_ICON_SVG : (fx.emoji || '✨')) + '</span>'
      + '<span class="fx-rule-keyword">' + Core.escapeHtml(fx.keyword || '') + '</span>'
      + '<span class="fx-rule-type">' + (EFFECT_TYPE_NAMES[fx.type] || '飘落') + '</span>'
      + '<label class="fx-rule-toggle"><input type="checkbox" data-role="toggle"' + (fx.enabled !== false ? ' checked' : '') + '><span></span></label>'
      + '<button class="fx-rule-del" data-role="del">×</button>'
      + '</div>';
  });
  if (!rowHtml) rowHtml = '<div class="fx-empty">还没有特效规则，添加一条试试</div>';

  var html = '<div class="black-overlay" id="effects-overlay" onclick="closeEffectsPanel()">'
    + '<div class="black-panel fx-panel" onclick="event.stopPropagation()">'
    + '<div class="black-title"><i class="fas fa-wand-magic-sparkles"></i>特效</div>'
    + '<div class="fx-switch-row">'
    + '<span>开启聊天特效</span>'
    + '<label class="fx-rule-toggle fx-master"><input type="checkbox" id="fx-master"' + (enabled ? ' checked' : '') + '><span></span></label>'
    + '</div>'
    + '<div class="fx-hint">发布包含关键词的消息时，整个聊天界面会播放对应 emoji 特效</div>'
    + '<div class="fx-rule-list" id="fx-rule-list">' + rowHtml + '</div>'
    + '<div class="fx-add-title">＋ 添加特效规则</div>'
    + '<div class="fx-add-row">'
    + '<input class="black-input fx-add-input" id="fx-keyword" placeholder="关键词，如：好想你" maxlength="20">'
    + '<input class="black-input fx-add-input fx-add-emoji" id="fx-emoji" placeholder="表情" maxlength="8">'
    + '</div>'
    + '<div class="fx-type-row" id="fx-type-row">'
    + '<button class="fx-type-btn active" data-type="fall">飘落</button>'
    + '<button class="fx-type-btn" data-type="bomb">炸弹</button>'
    + '<button class="fx-type-btn" data-type="heart">爱心</button>'
    + '<button class="fx-type-btn" data-type="star">星光</button>'
    + '</div>'
    + '<div class="fx-count-row"><span>数量</span><input type="number" id="fx-count" min="1" max="200" step="1" value="30" inputmode="numeric"><span class="fx-count-tip">1-200</span></div>'
    + '<div class="fx-add-actions">'
    + '<button class="black-btn black-btn-primary" onclick="addEffectRule()">添加</button>'
    + '</div>'
    + '<div class="fx-presets">'
    + '<div class="fx-presets-label">快速添加：</div>'
    + '<div class="fx-preset-item" data-preset="好想你|✨|fall|42">✨ 好想你</div>'
    + '<div class="fx-preset-item" data-preset="爱你|💗|fall|32">💗 爱你</div>'
    + '<div class="fx-preset-item" data-preset="烟花|🎆|firework|5">' + FIREWORK_ICON_SVG + ' 烟花</div>'
    + '<div class="fx-preset-item" data-preset="炸弹|💣|bomb|1">💣 炸弹</div>'
    + '<div class="fx-preset-item" data-preset="想你|💘|heart|24">💘 爱心</div>'
    + '<div class="fx-preset-item" data-preset="星星|⭐|star|18">⭐ 星光</div>'
    + '</div>'
    + '<div class="black-actions">'
    + '<button class="black-btn black-btn-cancel" onclick="closeEffectsPanel()">完成</button>'
    + '</div>'
    + '</div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);

  var master = document.getElementById('fx-master');
  if (master) {
    master.addEventListener('change', function() { setEffectsEnabled(master.checked); });
  }
  var list = document.getElementById('fx-rule-list');
  if (list) {
    list.addEventListener('click', function(e) {
      var t = e.target;
      var row = t.closest ? t.closest('.fx-rule-row') : null;
      if (!row) return;
      var idx = parseInt(row.dataset.idx, 10);
      var effects2 = getEffects();
      if (t.dataset.role === 'del') {
        effects2.splice(idx, 1);
        setEffects(effects2);
        openEffectsPanel();
        return;
      }
      if (t.dataset.role === 'toggle') {
        var fx = effects2[idx];
        if (fx) { fx.enabled = t.checked; setEffects(effects2); }
      }
    });
  }
  var typeRow = document.getElementById('fx-type-row');
  if (typeRow) {
    typeRow.addEventListener('click', function(e) {
      var btn = e.target.closest ? e.target.closest('.fx-type-btn') : null;
      if (!btn) return;
      typeRow.querySelectorAll('.fx-type-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      typeRow.dataset.selectedType = btn.dataset.type;
    });
  }
  var countInput = document.getElementById('fx-count');
  if (countInput) {
    countInput.addEventListener('change', function() {
      var v = parseInt(countInput.value, 10);
      if (isNaN(v) || v < 1) countInput.value = 1;
      else if (v > 200) countInput.value = 200;
    });
  }
  var presets = document.querySelectorAll('.fx-preset-item');
  presets.forEach(function(p) {
    p.addEventListener('click', function() {
      var parts = p.dataset.preset.split('|');
      var kw = document.getElementById('fx-keyword');
      var em = document.getElementById('fx-emoji');
      var cnt = document.getElementById('fx-count');
      if (kw) kw.value = parts[0];
      if (em) em.value = parts[1];
      var typeBtns = document.querySelectorAll('#fx-type-row .fx-type-btn');
      typeBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.type === parts[2]); });
      var typeRow2 = document.getElementById('fx-type-row');
      if (typeRow2) typeRow2.dataset.selectedType = parts[2];
      if (cnt) cnt.value = parts[3];
    });
  });
  var overlay = document.getElementById('effects-overlay');
  if (overlay) {
    overlay.addEventListener('touchmove', function(e) {
      var panel = overlay.querySelector('.black-panel');
      if (panel && panel.contains(e.target)) return; /* 面板内允许滚动 */
      e.preventDefault();
    }, { passive: false });
  }
}

function closeEffectsPanel() {
  var el = document.getElementById('effects-overlay');
  if (el) el.remove();
}

/* 添加特效规则 */
function addEffectRule() {
  var kw = document.getElementById('fx-keyword');
  var em = document.getElementById('fx-emoji');
  var keyword = (kw && kw.value || '').trim();
  var emoji = (em && em.value || '').trim();
  if (!keyword) { Core.toast('请输入关键词'); return; }
  if (!emoji) { Core.toast('请输入表情'); return; }
  var typeBtn = document.querySelector('#fx-type-row .fx-type-btn.active');
  var typeRowEl = document.getElementById('fx-type-row');
  var type = (typeRowEl && typeRowEl.dataset.selectedType) || (typeBtn ? typeBtn.dataset.type : 'fall');
  var countInput = document.getElementById('fx-count');
  var count = countInput ? parseInt(countInput.value, 10) : 30;
  if (!count || count < 1) count = 1;
  var effects = getEffects();
  effects.push({ id: 'fx-' + Date.now(), keyword: keyword, emoji: emoji, type: type, count: count, enabled: true });
  setEffects(effects);
  Core.toast('已添加特效：' + emoji + ' ' + keyword);
  openEffectsPanel();
}

/* === 特效渲染 === */
function getEffectLayer() {
  var layer = document.getElementById('chat-effect-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'chat-effect-layer';
    layer.className = 'chat-effect-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function fxRemove(el, delay) {
  setTimeout(function() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }, delay || 100);
}

/* 飘落：多个 emoji 从顶部随机落下（分帧创建，避免一次性大量 DOM 造成卡顿） */
function fxFall(emoji, count) {
  var layer = getEffectLayer();
  var n = Math.min(60, Math.max(10, count || 30));
  var batch = Math.max(4, Math.min(8, Math.ceil(n / 10)));
  var created = 0;
  (function step() {
    var end = Math.min(created + batch, n);
    for (; created < end; created++) {
      var el = document.createElement('div');
      el.className = 'fx-fall-item';
      el.textContent = emoji || '✨';
      el.style.left = (Math.random() * 100) + '%';
      el.style.fontSize = (14 + Math.random() * 24) + 'px';
      el.style.animationDuration = (2.2 + Math.random() * 3.2) + 's';
      el.style.animationDelay = (Math.random() * 1.4) + 's';
      layer.appendChild(el);
      fxRemove(el, 6500);
    }
    if (created < n) requestAnimationFrame(step);
  })();
}

/* 烟花：火箭上升 + 七彩放射简笔画爆炸 */
function fxFirework(emoji, count) {
  var layer = getEffectLayer();
  var n = Math.min(8, Math.max(1, count || 5));
  for (var i = 0; i < n; i++) {
    (function(idx) {
      var rocket = document.createElement('div');
      rocket.className = 'fx-firework-rocket';
      rocket.innerHTML = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="16" cy="16" r="2.2" fill="none" stroke="#FFE9A8" stroke-width="1.8"/><path d="M16 2 L16 6 M16 26 L16 30 M2 16 L6 16 M26 16 L30 16 M5.2 5.2 L8.2 8.2 M23.8 23.8 L26.8 26.8 M26.8 5.2 L23.8 8.2 M8.2 23.8 L5.2 26.8" stroke="#FFD76A" stroke-width="2.2" stroke-linecap="round"/></svg>';
      var x = 12 + Math.random() * 76;
      var y = 18 + Math.random() * 42;
      rocket.style.left = x + '%';
      rocket.style.setProperty('--fy', y + 'vh');
      rocket.style.animationDelay = (idx * 0.45 + Math.random() * 0.7) + 's';
      layer.appendChild(rocket);
      var onEnd = function() {
        if (rocket.parentNode) rocket.parentNode.removeChild(rocket);
        fxBurstSketch(layer, x, y, 34);
      };
      rocket.addEventListener('animationend', onEnd);
      setTimeout(onEnd, 6000);
    })(i);
  }
}

/* 烟花爆炸：简笔画火花粒子 + 七彩放射渐变核心（分帧创建粒子） */
function fxBurstSketch(layer, x, y, sparkCount) {
  var n = Math.min(44, Math.max(16, sparkCount || 30));
  var batch = 6;
  var created = 0;
  (function step() {
    var end = Math.min(created + batch, n);
    for (; created < end; created++) {
      var i = created;
      var p = document.createElement('span');
      p.className = 'fx-fw-spark';
      var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.35;
      var dist = 70 + Math.random() * 110;
      var hue = Math.round(i * 360 / n);
      p.style.left = x + 'vw';
      p.style.top = y + 'vh';
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      p.style.setProperty('--rot', (ang * 180 / Math.PI) + 'deg');
      p.style.setProperty('--c', 'hsl(' + hue + ', 100%, 62%)');
      p.style.animationDelay = (Math.random() * 0.15) + 's';
      layer.appendChild(p);
      fxRemove(p, 1500);
    }
    if (created < n) requestAnimationFrame(step);
  })();
  /* 中心七彩放射简笔画烟花 */
  var core = document.createElement('div');
  core.className = 'fx-fw-core';
  core.style.left = x + 'vw';
  core.style.top = y + 'vh';
  layer.appendChild(core);
  fxRemove(core, 950);
}

/* 爆炸粒子（烟花炸开 / 炸弹爆炸共用） */
function fxBurst(layer, x, y, emoji) {
  var colors = ['✨', '⭐', '💫', '🌟', '💖', '💙', '💜', '🟡'];
  var n = 18;
  for (var i = 0; i < n; i++) {
    var p = document.createElement('div');
    p.className = 'fx-burst-particle';
    p.textContent = i % 3 === 0 ? (emoji || '🎆') : colors[i % colors.length];
    var ang = (Math.PI * 2 * i) / n + Math.random() * 0.3;
    var dist = 60 + Math.random() * 90;
    p.style.left = x + 'vw';
    p.style.top = y + 'vh';
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    p.style.fontSize = (12 + Math.random() * 14) + 'px';
    layer.appendChild(p);
    fxRemove(p, 1500);
  }
}

/* 炸弹：从右上飞入 -> 落地 -> 爆炸 */
function fxBomb(emoji) {
  var layer = getEffectLayer();
  var bx = 40 + Math.random() * 20;
  var bomb = document.createElement('div');
  bomb.className = 'fx-bomb';
  bomb.textContent = emoji || '💣';
  bomb.style.left = bx + '%';
  layer.appendChild(bomb);
  setTimeout(function() {
    if (bomb.parentNode) bomb.parentNode.removeChild(bomb);
    var boom = document.createElement('div');
    boom.className = 'fx-boom';
    boom.style.left = bx + '%';
    layer.appendChild(boom);
    fxBurst(layer, bx, 55, '💥');
    fxRemove(boom, 1100);
  }, 950);
}

/* 爱心：从底部气泡上升（分帧创建） */
function fxHeart(emoji, count) {
  var layer = getEffectLayer();
  var n = Math.min(40, Math.max(8, count || 24));
  var batch = Math.max(3, Math.min(6, Math.ceil(n / 10)));
  var created = 0;
  (function step() {
    var end = Math.min(created + batch, n);
    for (; created < end; created++) {
      var el = document.createElement('div');
      el.className = 'fx-heart-item';
      el.textContent = emoji || '💗';
      el.style.left = (10 + Math.random() * 80) + '%';
      el.style.fontSize = (16 + Math.random() * 22) + 'px';
      el.style.animationDuration = (2.6 + Math.random() * 2.4) + 's';
      el.style.animationDelay = (Math.random() * 1.2) + 's';
      el.style.setProperty('--sway', (Math.random() * 60 - 30) + 'px');
      layer.appendChild(el);
      fxRemove(el, 6000);
    }
    if (created < n) requestAnimationFrame(step);
  })();
}

/* 流星：斜向划过屏幕 */
function fxShooting(count) {
  var layer = getEffectLayer();
  var n = Math.min(12, Math.max(3, count || 8));
  for (var i = 0; i < n; i++) {
    (function(idx) {
      var m = document.createElement('div');
      m.className = 'fx-shooting';
      var fromX = 10 + Math.random() * 60;
      var fromY = 5 + Math.random() * 40;
      var dist = 130 + Math.random() * 160;
      m.style.left = fromX + '%';
      m.style.top = fromY + 'vh';
      m.style.setProperty('--mx', (-dist) + 'px');
      m.style.setProperty('--my', (dist * 0.62) + 'px');
      m.style.animationDelay = (idx * 0.55 + Math.random() * 0.5) + 's';
      layer.appendChild(m);
      fxRemove(m, 4200);
    })(i);
  }
}

/* 彩带：彩色纸屑旋转飘落（分帧创建） */
function fxConfetti(count) {
  var layer = getEffectLayer();
  var n = Math.min(60, Math.max(12, count || 36));
  var colors = ['#FF5F6D', '#FFC371', '#A8E063', '#4FACFE', '#B06AB3', '#FF8ED4', '#6EE7B7'];
  var batch = Math.max(4, Math.min(8, Math.ceil(n / 10)));
  var created = 0;
  (function step() {
    var end = Math.min(created + batch, n);
    for (; created < end; created++) {
      var el = document.createElement('div');
      el.className = 'fx-confetti-item';
      el.style.left = (Math.random() * 100) + '%';
      el.style.width = (6 + Math.random() * 7) + 'px';
      el.style.height = (10 + Math.random() * 10) + 'px';
      el.style.background = colors[created % colors.length];
      el.style.animationDuration = (2.4 + Math.random() * 2.6) + 's';
      el.style.animationDelay = (Math.random() * 1.2) + 's';
      layer.appendChild(el);
      fxRemove(el, 6500);
    }
    if (created < n) requestAnimationFrame(step);
  })();
}

/* 星光：星星四散旋转 */
function fxStar(emoji, count) {
  var layer = getEffectLayer();
  var n = Math.min(30, Math.max(6, count || 18));
  for (var i = 0; i < n; i++) {
    (function(idx) {
      var s = document.createElement('div');
      s.className = 'fx-star-item';
      s.textContent = emoji || '⭐';
      s.style.left = (12 + Math.random() * 76) + '%';
      s.style.top = (15 + Math.random() * 55) + 'vh';
      s.style.fontSize = (14 + Math.random() * 18) + 'px';
      s.style.setProperty('--sx', (Math.random() * 220 - 110) + 'px');
      s.style.setProperty('--sy', (Math.random() * 220 - 110) + 'px');
      s.style.animationDelay = (idx * 0.15 + Math.random() * 0.4) + 's';
      layer.appendChild(s);
      fxRemove(s, 3200);
    })(i);
  }
}

/* 命中关键词 -> 返回特效规则 */
function matchChatEffect(text) {
  if (!isEffectsEnabled() || !text) return null;
  var effects = getEffects();
  for (var i = 0; i < effects.length; i++) {
    var fx = effects[i];
    if (fx.enabled !== false && fx.keyword && text.indexOf(fx.keyword) !== -1) {
      return fx;
    }
  }
  return null;
}

function triggerChatEffect(fx) {
  if (!fx) return;
  var emoji = fx.emoji || '✨';
  if (fx.type === 'firework') { fxFirework(emoji, fx.count || 5); }
  else if (fx.type === 'bomb') { fxBomb(emoji); }
  else if (fx.type === 'heart') { fxHeart(emoji, fx.count || 24); }
  else if (fx.type === 'shooting') { fxShooting(fx.count || 8); }
  else if (fx.type === 'confetti') { fxConfetti(fx.count || 36); }
  else if (fx.type === 'star') { fxStar(emoji, fx.count || 18); }
  else { fxFall(emoji, fx.count || 30); }
}

window.openEffectsPanel = openEffectsPanel;
window.closeEffectsPanel = closeEffectsPanel;
window.addEffectRule = addEffectRule;

/* ============================================================
   加号菜单分页指示点（左右滑动分页联动）
   ============================================================ */
var _plusPaginationBound = false;
function _plusMenuGoPage(idx) {
  var grid = document.getElementById('plus-menu-grid');
  if (!grid) return;
  var pages = grid.querySelectorAll('.plus-menu-page');
  if (!pages.length) return;
  idx = Math.max(0, Math.min(idx, pages.length - 1));
  grid.scrollLeft = idx * grid.clientWidth;
  _syncPlusMenuDots();
}
function _bindPlusMenuPagination() {
  if (_plusPaginationBound) return;
  var grid = document.getElementById('plus-menu-grid');
  var dots = document.getElementById('plus-menu-dots');
  if (!grid) return;
  grid.addEventListener('scroll', function() { _syncPlusMenuDots(); }, { passive: true });
  /* 指示点点击：直接切到对应页（PC/移动端通用） */
  if (dots) {
    var spans = dots.querySelectorAll('.plus-menu-dot');
    for (var i = 0; i < spans.length; i++) {
      (function(idx) {
        spans[idx].addEventListener('click', function(ev) {
          ev.preventDefault();
          _plusMenuGoPage(idx);
        });
      })(i);
    }
  }
  /* PC 端鼠标滚轮：在加号菜单区域滚动 -> 横向翻页（禁用被动以阻止页面纵向滚动） */
  grid.addEventListener('wheel', function(ev) {
    if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return; // 横向滚轮/触控板已有原生横向滚动
    ev.preventDefault();
    var cur = Math.round(grid.scrollLeft / grid.clientWidth);
    _plusMenuGoPage(ev.deltaY > 0 ? cur + 1 : cur - 1);
  }, { passive: false });
  _plusPaginationBound = true;
}
function _syncPlusMenuDots() {
  var grid = document.getElementById('plus-menu-grid');
  var dots = document.getElementById('plus-menu-dots');
  if (!grid || !dots) return;
  var cw = grid.clientWidth || 1;
  var page = Math.max(0, Math.round(grid.scrollLeft / cw));
  var spans = dots.querySelectorAll('.plus-menu-dot');
  for (var i = 0; i < spans.length; i++) {
    spans[i].classList.toggle('active', i === page);
  }
}

/* ============================================================
   屏幕常亮（加号菜单 → 屏幕常亮）：基于 Web Wake Lock API
   - 开启后保持屏幕常亮（类似雨见浏览器的屏幕常亮功能）
   - 页面切后台时浏览器会自动释放唤醒锁，切回前台后自动重新获取
   - 不支持 Wake Lock 的浏览器给出提示
   ============================================================ */
var _wakeLockSentinel = null;          // 当前 WakeLockSentinel 实例
var _screenAlwaysOn = false;           // 开关状态
var _wakelockSupported = null;         // 支持性缓存

function isWakeLockSupported() {
  if (_wakelockSupported === null) {
    _wakelockSupported = !!(navigator.wakeLock && typeof navigator.wakeLock.request === 'function');
  }
  return _wakelockSupported;
}

async function _requestWakeLock() {
  if (!isWakeLockSupported() || !_screenAlwaysOn) return;
  try {
    _wakeLockSentinel = await navigator.wakeLock.request('screen');
    // 监听锁被系统释放：开启状态下若页面仍可见则自动重新获取
    _wakeLockSentinel.addEventListener('release', function() {
      _wakeLockSentinel = null;
      if (_screenAlwaysOn && document.visibilityState === 'visible') {
        _requestWakeLock();
      }
    });
  } catch (e) {
    _wakeLockSentinel = null;
    // 请求失败（如浏览器策略/低电量等）：关闭开关并提示
    if (_screenAlwaysOn) {
      _screenAlwaysOn = false;
      Storage.set('screenAlwaysOn', false);
      _updateWakelockMenuUI();
      if (document.visibilityState === 'visible') Core.toast('屏幕常亮开启失败');
    }
  }
}

async function _releaseWakeLock() {
  if (_wakeLockSentinel) {
    try { await _wakeLockSentinel.release(); } catch (e) {}
    _wakeLockSentinel = null;
  }
}

function _updateWakelockMenuUI() {
  var item = document.getElementById('plus-menu-wakelock');
  if (item) item.classList.toggle('active', _screenAlwaysOn);
}

function toggleScreenAlwaysOn() {
  if (!isWakeLockSupported()) {
    Core.toast('当前浏览器不支持屏幕常亮');
    return;
  }
  if (_screenAlwaysOn) {
    _screenAlwaysOn = false;
    Storage.set('screenAlwaysOn', false);
    _releaseWakeLock();
    Core.toast('屏幕常亮已关闭');
  } else {
    _screenAlwaysOn = true;
    Storage.set('screenAlwaysOn', true);
    _requestWakeLock();
    Core.toast('屏幕常亮已开启');
  }
  _updateWakelockMenuUI();
}

/* 页面可见性切换：回到前台且开关开启时重新获取唤醒锁（浏览器切后台会自动释放） */
document.addEventListener('visibilitychange', function() {
  if (!_screenAlwaysOn) return;
  if (document.visibilityState === 'visible') {
    if (!_wakeLockSentinel) _requestWakeLock();
  } else {
    // 主动释放，避免后台持锁
    _releaseWakeLock();
  }
});

/* 恢复持久化的开关状态（进入聊天室时调用） */
function restoreScreenAlwaysOn() {
  _screenAlwaysOn = !!Storage.get('screenAlwaysOn', false);
  _updateWakelockMenuUI();
  if (_screenAlwaysOn && document.visibilityState === 'visible' && !_wakeLockSentinel) {
    _requestWakeLock();
  }
}
window.toggleScreenAlwaysOn = toggleScreenAlwaysOn;
window.restoreScreenAlwaysOn = restoreScreenAlwaysOn;

/* ============================================================
   贴表情（加号菜单 → 贴表情）：emoji 平铺到聊天界面背景
   - 我方一次添加一个；确认添加后对方随机添加一个
   - 平铺：大小不一、带旋转倾斜、不透明度 60%
   - 背景色跟随所选 emoji 主题色变化
   - 可在弹窗内关闭 / 清除 / 更换
   ============================================================ */
var EMOJI_STICKER_THEMES = [
  { key: 'blue',   name: '蓝', bg: '#D6E9FF', emojis: ['🦋','❄️','💙','🌊','🐬','💧','🧊','⛄','🐋','🐳','🌌','🌍','🔷','🫧'] },
  { key: 'pink',   name: '粉', bg: '#FFE3EC', emojis: ['🌸','💖','🎀','🌺','🩷','💗','🦩','🍑','💕','💝','🌷','🪷','🍓','🐷'] },
  { key: 'white',  name: '白', bg: '#F4F6F9', emojis: ['🐰','☁️','🤍','🐑','🌫️','🥚','🐇','🕊️','🦢','🍼','🧸','💭','🪶','🥛'] },
  { key: 'green',  name: '绿', bg: '#E4F6E3', emojis: ['🍀','🌿','🍃','🌱','🥝','🐸','🌵','🥦','🍉','🥒','🫛','🦎','🌲','🥬'] },
  { key: 'yellow', name: '黄', bg: '#FFF5D6', emojis: ['🌻','☀️','⭐','🌟','🍋','🐤','🌼','🧀','🍯','🍌','🐝','🌽','🍍','🥐'] },
  { key: 'purple', name: '紫', bg: '#F0E6FF', emojis: ['🔮','💜','🦄','🍇','🫐','👾','☂️','🥳','🪐','🌂','🍆','👑','💟','🪻'] },
  { key: 'orange', name: '橙', bg: '#FFEBD8', emojis: ['🍊','🎃','🦊','🐯','🔥','🍁','🥕','🍮','🧡','🍂','🦁','🐿️','🥭','🦀'] }
];
var _emojiStickerSelected = '';

function getEmojiStickerData(chatId) {
  if (!chatId) return null;
  var d = Storage.get('emojiSticker_' + chatId);
  return (d && typeof d === 'object') ? d : null;
}

function findEmojiStickerTheme(emoji) {
  for (var i = 0; i < EMOJI_STICKER_THEMES.length; i++) {
    if (EMOJI_STICKER_THEMES[i].emojis.indexOf(emoji) !== -1) return EMOJI_STICKER_THEMES[i];
  }
  return EMOJI_STICKER_THEMES[0];
}

function removeEmojiStickerLayer() {
  var el = document.getElementById('emoji-sticker-layer');
  if (el) el.remove();
}

/* 平铺渲染：壁纸式砖墙交错（5列×7行，每两行之间增加一行且奇数行偏移半格），
   间距一致、无重叠、留白合理、60%透明度，仅轻微交替旋转与双字号营造秩序感 */
function lightenHex(hex, amount) {
  // 将主题色向白色混合 amount(0-1)，得到更淡的柔和色，避免背景抢眼
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex || '#FFFFFF';
  var n = parseInt(m[1], 16);
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function renderEmojiStickerLayer(chatId) {
  removeEmojiStickerLayer();
  var data = getEmojiStickerData(chatId);
  if (!data || (!data.mine && !data.partner)) return;
  var page = document.getElementById('page-chat-room');
  if (!page) return;
  var theme = findEmojiStickerTheme(data.mine || data.partner);
  var layer = document.createElement('div');
  layer.className = 'emoji-sticker-layer';
  layer.id = 'emoji-sticker-layer';
  // 背景色随所选 emoji 主题变化，但向白色混合 62% 使其明显更淡、更柔和
  layer.style.background = lightenHex(theme.bg, 0.62);
  var all = [];
  if (data.mine) all.push(data.mine);
  if (data.partner) all.push(data.partner);
  var cols = 5, rows = 7;              // 5列 × 7行：每两行之间增加一行
  var cellW = 100 / cols;
  var cellH = 100 / rows;
  var padX = cellW * 0.24;             // 左右留白：格内边距
  var padY = cellH * 0.18;             // 上下留白
  var rotMap = [-6, 0, 6, 0];          // 轻微交替旋转，保持秩序
  var idx = 0;
  for (var row = 0; row < rows; row++) {
    // 奇数行相对前一行偏移半个列间距，形成砖墙/斜对角交错
    var offset = (row % 2 === 1) ? cellW / 2 : 0;
    var perRow = (row % 2 === 1) ? cols - 1 : cols;
    for (var col = 0; col < perRow; col++) {
      var e = document.createElement('span');
      e.className = 'emoji-sticker-item';
      // 交替取我方/对方，均匀分布
      e.textContent = all[idx % all.length];
      e.style.left = (col * cellW + offset + padX) + '%';
      e.style.top = (row * cellH + padY) + '%';
      // 双字号交替（大/小），统一不超过格内尺寸避免重叠
      e.style.fontSize = (idx % 2 === 0 ? 24 : 18) + 'px';
      e.style.width = (cellW - padX * 2) + '%';
      e.style.height = (cellH - padY * 2) + '%';
      e.style.display = 'flex';
      e.style.alignItems = 'center';
      e.style.justifyContent = 'center';
      e.style.transform = 'rotate(' + rotMap[(row + col) % rotMap.length] + 'deg)';
      layer.appendChild(e);
      idx++;
    }
  }
  page.insertBefore(layer, page.firstChild);
}

function openEmojiStickerPanel() {
  closePlusMenu();
  var chatId = _currentChatId();
  if (!chatId) { if (typeof Core !== 'undefined' && Core.toast) Core.toast('请先进入聊天'); return; }
  var data = getEmojiStickerData(chatId);
  _emojiStickerSelected = (data && data.mine) || '';

  var groupHtml = '';
  for (var i = 0; i < EMOJI_STICKER_THEMES.length; i++) {
    var t = EMOJI_STICKER_THEMES[i];
    var itemsHtml = '';
    for (var j = 0; j < t.emojis.length; j++) {
      itemsHtml += '<span class="emoji-sticker-opt" data-emoji="' + t.emojis[j] + '" data-theme="' + t.key + '">' + t.emojis[j] + '</span>';
    }
    groupHtml += '<div class="emoji-sticker-group"><div class="emoji-sticker-group-title">' + t.name + '系</div><div class="emoji-sticker-grid">' + itemsHtml + '</div></div>';
  }

  var statusHtml = '尚未贴表情';
  if (data && data.mine) {
    statusHtml = '当前贴图：我 <span>' + data.mine + '</span>' + (data.partner ? ' · 对方 <span>' + data.partner + '</span>' : '');
  }

  var html = '<div class="black-overlay" id="emoji-sticker-overlay" onclick="closeEmojiStickerPanel()">'
    + '<div class="black-panel emoji-sticker-panel" onclick="event.stopPropagation()">'
    + '<div class="black-title"><i class="fas fa-face-smile"></i>贴表情</div>'
    + '<div class="emoji-sticker-status" id="emoji-sticker-status">' + statusHtml + '</div>'
    + '<div class="emoji-sticker-group-list">' + groupHtml + '</div>'
    + '<div class="black-actions">'
    + '<button class="black-btn black-btn-cancel" onclick="closeEmojiStickerPanel()">关闭</button>'
    + '<button class="black-btn black-btn-cancel" onclick="clearEmojiSticker()">清除</button>'
    + '<button class="black-btn black-btn-primary" onclick="applyEmojiSticker()">添加</button>'
    + '</div></div></div>';

  var page = document.getElementById('page-chat-room');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  page.appendChild(tmp.firstChild);

  var overlay = document.getElementById('emoji-sticker-overlay');
  /* 选中监听挂在 group-list 上（panel 内联 stopPropagation 会拦截 overlay 层，
     必须挂在内层才能正常响应 emoji 选择点击） */
  var groupList = overlay.querySelector('.emoji-sticker-group-list');
  groupList.addEventListener('click', function(e) {
    var t = e.target.closest ? e.target.closest('.emoji-sticker-opt') : null;
    if (!t) return;
    var opts = groupList.querySelectorAll('.emoji-sticker-opt');
    for (var k = 0; k < opts.length; k++) opts[k].classList.remove('selected');
    t.classList.add('selected');
    _emojiStickerSelected = t.getAttribute('data-emoji');
  });
  var opts = groupList.querySelectorAll('.emoji-sticker-opt');
  for (var k = 0; k < opts.length; k++) {
    if (opts[k].getAttribute('data-emoji') === _emojiStickerSelected) opts[k].classList.add('selected');
  }
}

function closeEmojiStickerPanel() {
  var el = document.getElementById('emoji-sticker-overlay');
  if (el) el.remove();
}

/* 确认添加：保存我方 emoji 并渲染，随后模拟对方随机添加一个 */
function applyEmojiSticker() {
  var chatId = _currentChatId();
  if (!chatId) { if (typeof Core !== 'undefined' && Core.toast) Core.toast('请先进入聊天'); return; }
  if (!_emojiStickerSelected) { if (typeof Core !== 'undefined' && Core.toast) Core.toast('请先选择一个表情'); return; }
  var data = getEmojiStickerData(chatId) || {};
  data.mine = _emojiStickerSelected;
  Storage.set('emojiSticker_' + chatId, data);
  renderEmojiStickerLayer(chatId);
  closeEmojiStickerPanel();
  if (typeof Core !== 'undefined' && Core.toast) Core.toast('已贴上表情');
  setTimeout(function() { emojiStickerPartnerAdd(chatId); }, 1200 + Math.random() * 1300);
}

/* 对方随机添加一个 emoji（与我的不同） */
function emojiStickerPartnerAdd(chatId) {
  var data = getEmojiStickerData(chatId);
  if (!data || !data.mine) return;
  var pool = [];
  for (var i = 0; i < EMOJI_STICKER_THEMES.length; i++) pool = pool.concat(EMOJI_STICKER_THEMES[i].emojis);
  pool = pool.filter(function(e) { return e !== data.mine; });
  if (!pool.length) pool = ['✨'];
  data.partner = pool[Math.floor(Math.random() * pool.length)];
  Storage.set('emojiSticker_' + chatId, data);
  renderEmojiStickerLayer(chatId);
  if (typeof Core !== 'undefined' && Core.toast) Core.toast('对方也贴了一个表情');
}

/* 清除贴表情 */
function clearEmojiSticker() {
  var chatId = _currentChatId();
  if (!chatId) { if (typeof Core !== 'undefined' && Core.toast) Core.toast('请先进入聊天'); return; }
  Storage.set('emojiSticker_' + chatId, null);
  removeEmojiStickerLayer();
  closeEmojiStickerPanel();
  if (typeof Core !== 'undefined' && Core.toast) Core.toast('已清除贴表情');
}

window.openEmojiStickerPanel = openEmojiStickerPanel;
window.closeEmojiStickerPanel = closeEmojiStickerPanel;
window.applyEmojiSticker = applyEmojiSticker;
window.clearEmojiSticker = clearEmojiSticker;
window.renderEmojiStickerLayer = renderEmojiStickerLayer;
