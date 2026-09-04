/* === 设置功能 === */

function renderSettings() {
  // 设置页无需动态渲染（账号设置入口在 HTML 中静态定义）
}

/* === 账号设置 === */

var _accountEditing = { type: null, id: null };

/* Canvas 压缩图片，避免 localStorage 配额溢出 */
function _compressAvatarImage(dataUrl, maxSize, callback) {
  var img = new Image();
  img.onload = function() {
    var w = img.width, h = img.height;
    if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
    if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', 0.75));
  };
  img.src = dataUrl;
}

/* 头像形状切换 */
function _toggleAvatarShape(shape) {
  _accountEditing._shape = shape;
  var circleBtn = document.getElementById('edit-account-shape-circle');
  var squareBtn = document.getElementById('edit-account-shape-square');
  var preview = document.getElementById('edit-account-avatar-preview');
  if (circleBtn && squareBtn) {
    circleBtn.classList.toggle('active', shape === 'circle');
    squareBtn.classList.toggle('active', shape === 'square');
  }
  if (preview) {
    preview.style.borderRadius = shape === 'circle' ? '50%' : '8px';
  }
}

/* 更新头像预览 */
function _updateAvatarPreview(imageData, shape) {
  var preview = document.getElementById('edit-account-avatar-preview');
  if (!preview) return;
  if (imageData) {
    preview.style.backgroundImage = 'url(' + imageData + ')';
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.style.backgroundRepeat = 'no-repeat';
    preview.textContent = '';
    preview.style.color = 'transparent';
  } else {
    preview.style.backgroundImage = '';
    preview.textContent = '?';
    preview.style.color = '#fff';
  }
  preview.style.borderRadius = (shape === 'square') ? '8px' : '50%';
}

function renderAccountSettings() {
  var my = Storage.getMyProfile();
  var avatarEl = document.getElementById('my-account-avatar-icon');
  var labelEl = document.getElementById('my-account-label');
  if (avatarEl) {
    _applyAvatarStyle(avatarEl, my.avatarImage, my.avatar, my.avatarColor, my.avatarShape);
  }
  if (labelEl) labelEl.textContent = my.nickname;

  var list = document.getElementById('partner-account-list');
  if (!list) return;
  var partners = Storage.getPartnerProfiles();
  if (!partners.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-lighter);font-size:0.85rem">暂无角色，点击下方按钮添加</div>';
    return;
  }
  var html = '';
  partners.forEach(function(p, i) {
    html += '<div class="settings-item" style="cursor:default">'
          + _buildAvatarHtml(p.avatarImage, p.avatar, p.avatarColor, p.avatarShape)
          + '<div class="s-content"><div class="s-label">' + escapeHtml(p.nickname) + '</div></div>'
          + '<div class="account-actions">'
          + '<button class="account-action-btn" onclick="movePartnerAccount(' + i + ',-1)" title="上移"><i class="fas fa-arrow-up"></i></button>'
          + '<button class="account-action-btn" onclick="movePartnerAccount(' + i + ',1)" title="下移"><i class="fas fa-arrow-down"></i></button>'
          + '<button class="account-action-btn" onclick="editPartnerAccount(\'' + escapeHtml(p.id) + '\')" title="编辑"><i class="fas fa-pen"></i></button>'
          + '<button class="account-action-btn danger" onclick="deletePartnerAccount(\'' + escapeHtml(p.id) + '\')" title="删除"><i class="fas fa-trash-alt"></i></button>'
          + '</div>'
          + '</div>';
    if (i < partners.length - 1) html += '<div class="list-divider"></div>';
  });
  list.innerHTML = html;
}

/* 账号排序：上移/下移角色 */
function movePartnerAccount(index, dir) {
  var partners = Storage.getPartnerProfiles();
  var target = index + dir;
  if (target < 0 || target >= partners.length) return;
  var tmp = partners[index];
  partners[index] = partners[target];
  partners[target] = tmp;
  Storage.setPartnerProfiles(partners);
  renderAccountSettings();
  if (typeof Navigation !== 'undefined' && Navigation._renderChatList) Navigation._renderChatList();
}

/* 生成头像 DOM HTML */
function _buildAvatarHtml(avatarImage, avatarText, avatarColor, avatarShape) {
  var shapeClass = avatarShape === 'square' ? ' square' : '';
  if (avatarImage) {
    return '<div class="account-avatar-sm' + shapeClass + '" style="background:' + avatarColor + ';background-image:url(' + avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat"></div>';
  }
  return '<div class="account-avatar-sm' + shapeClass + '" style="background:' + avatarColor + '">' + avatarText + '</div>';
}

/* 应用头像样式到已有 DOM 元素 */
function _applyAvatarStyle(el, avatarImage, avatarText, avatarColor, avatarShape) {
  el.style.background = '';
  el.style.backgroundImage = '';
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';
  el.className = 'account-avatar-sm' + (avatarShape === 'square' ? ' square' : '');
  el.style.backgroundColor = avatarColor;
  if (avatarImage) {
    el.style.backgroundImage = 'url(' + avatarImage + ')';
    el.textContent = '';
  } else {
    el.textContent = avatarText;
  }
}

function editMyAccount() {
  _accountEditing = { type: 'my', id: null };
  var p = Storage.getMyProfile();
  _showAccountModal('编辑我的信息', p);
}

function editPartnerAccount(id) {
  var partners = Storage.getPartnerProfiles();
  var p = null;
  for (var i = 0; i < partners.length; i++) {
    if (partners[i].id === id) { p = partners[i]; break; }
  }
  if (!p) return;
  _accountEditing = { type: 'partner', id: id };
  _showAccountModal('编辑角色信息', p);
}

function addPartnerAccount() {
  _accountEditing = { type: 'partner', id: 'partner_' + Date.now() };
  _showAccountModal('添加角色', { nickname: '', avatar: '?', avatarColor: Core.avatarColor('?'), avatarImage: '', avatarShape: 'circle' });
}

function _showAccountModal(title, profile) {
  var overlay = document.getElementById('edit-account-overlay');
  var titleEl = document.getElementById('edit-account-title');
  var nicknameInput = document.getElementById('edit-account-nickname-input');
  var fileInput = document.getElementById('edit-account-avatar-file');
  if (!overlay || !titleEl || !nicknameInput || !fileInput) return;

  titleEl.textContent = title;
  nicknameInput.value = profile.nickname;

  // 在线状态 / 情绪状态（含「随机」选项；选中随机时聊天室顶栏从内置列表随机展示）
  var onlineValueEl = document.getElementById('edit-account-online-status-value');
  var onlineTextEl = document.getElementById('edit-account-online-status-text');
  if (onlineValueEl) onlineValueEl.value = profile.onlineStatus || '';
  if (onlineTextEl) onlineTextEl.textContent = profile.onlineStatus || '随机';
  var moodValueEl = document.getElementById('edit-account-mood-status-value');
  var moodTextEl = document.getElementById('edit-account-mood-status-text');
  if (moodValueEl) moodValueEl.value = profile.moodStatus || '';
  if (moodTextEl) moodTextEl.textContent = profile.moodStatus || '随机';

  // 头像数据暂存
  _accountEditing._image = profile.avatarImage || '';
  _accountEditing._shape = profile.avatarShape || 'circle';
  _accountEditing._avatar = profile.avatar || '?';
  _accountEditing._color = profile.avatarColor || '#A090B0';

  // 预览
  var preview = document.getElementById('edit-account-avatar-preview');
  if (preview) {
    _updateAvatarPreview(_accountEditing._image, _accountEditing._shape);
    preview.style.backgroundColor = _accountEditing._color;
  }

  // 形状切换按钮
  var circleBtn = document.getElementById('edit-account-shape-circle');
  var squareBtn = document.getElementById('edit-account-shape-square');
  if (circleBtn && squareBtn) {
    circleBtn.classList.toggle('active', _accountEditing._shape === 'circle');
    squareBtn.classList.toggle('active', _accountEditing._shape === 'square');
  }

  // 文件上传
  fileInput.value = '';
  fileInput.onchange = function() {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _compressAvatarImage(e.target.result, 200, function(compressed) {
        _accountEditing._image = compressed;
        _updateAvatarPreview(compressed, _accountEditing._shape);
      });
    };
    reader.readAsDataURL(file);
  };

  overlay.classList.add('active');
}

function saveAccount() {
  var nickname = document.getElementById('edit-account-nickname-input').value.trim() || '未命名';
  var avatarImage = _accountEditing._image || '';
  var avatarShape = _accountEditing._shape || 'circle';
  var avatarText = _accountEditing._avatar || '?';
  var color = _accountEditing._color;
  // 在线/情绪状态：空字符串 = 随机（顶栏从内置列表随机展示）
  var onlineStatusEl = document.getElementById('edit-account-online-status-value');
  var moodStatusEl = document.getElementById('edit-account-mood-status-value');
  var onlineStatus = onlineStatusEl ? onlineStatusEl.value : '';
  var moodStatus = moodStatusEl ? moodStatusEl.value : '';

  var profileData = {
    nickname: nickname,
    avatar: avatarText,
    avatarColor: color,
    avatarImage: avatarImage,
    avatarShape: avatarShape,
    onlineStatus: onlineStatus,
    moodStatus: moodStatus
  };

  if (_accountEditing.type === 'my') {
    Storage.setMyProfile(profileData);
  } else if (_accountEditing.type === 'partner') {
    var partners = Storage.getPartnerProfiles();
    var found = false;
    for (var i = 0; i < partners.length; i++) {
      if (partners[i].id === _accountEditing.id) {
        Object.assign(partners[i], profileData);
        found = true;
        break;
      }
    }
    if (!found) {
      profileData.id = _accountEditing.id;
      partners.push(profileData);
    }
    Storage.setPartnerProfiles(partners);
  }

  document.getElementById('edit-account-overlay').classList.remove('active');
  renderAccountSettings();
  // 同步刷新聊天列表与聊天室消息，保证头像与账号设置一致
  if (typeof Navigation !== 'undefined' && Navigation._renderChatList) {
    try { Navigation._renderChatList(); } catch(e) {}
  }
  var chatRoomEl = document.getElementById('page-chat-room');
  if (chatRoomEl && chatRoomEl.dataset && chatRoomEl.dataset.chatId) {
    try { renderChatMessages(chatRoomEl.dataset.chatId); } catch(e) {}
    try {
      var _pp = Storage.getPartnerProfiles();
      var _cur = null;
      if (!isGroupChatId(chatRoomEl.dataset.chatId)) {
        for (var _i = 0; _i < _pp.length; _i++) { if (_pp[_i].id === chatRoomEl.dataset.chatId) { _cur = _pp[_i]; break; } }
        setChatRoomStatus(_cur);
      } else {
        // 群聊：刷新成员状态栏
        var _g = getGroupByChatId(chatRoomEl.dataset.chatId);
        if (_g) {
          var _gm = getGroupMembers(_g);
          var _statusEl = document.getElementById('chat-room-status');
          if (_statusEl) {
            var _names = _gm.map(function(m) { return m.nickname || '角色'; });
            _statusEl.innerHTML = '<span class="chat-room-status-dot" style="background:#58C878"></span>'
              + '<span>群聊(' + _gm.length + '人)</span>'
              + '<span class="chat-room-status-sep">·</span>'
              + '<span>' + Core.escapeHtml(_names.join('、').slice(0, 18)) + '</span>';
          }
        }
      }
    } catch(e) {}
  }
  Core.toast('已保存');
}

function closeAccountModal() {
  document.getElementById('edit-account-overlay').classList.remove('active');
}

/* ==== 在线状态 / 情绪状态 选择弹窗（自适应网站玻璃拟态风格，支持自定义） ==== */
var _statusPickerKind = '';

/* 判断当前值是否为预设列表外的自定义值 */
function _isCustomStatusValue(value, presetTexts) {
  return !!value && presetTexts.indexOf(value) === -1;
}

function openStatusPicker(kind) {
  var overlay = document.getElementById('status-picker-overlay');
  var listEl = document.getElementById('status-picker-list');
  var titleEl = document.getElementById('status-picker-title');
  if (!overlay || !listEl || !titleEl) return;

  _statusPickerKind = kind;
  var isOnline = kind === 'online';
  titleEl.textContent = isOnline ? '选择在线状态' : '选择情绪状态';

  var preset = isOnline
    ? CHAT_ONLINE_STATUSES.map(function(s) { return { text: s.text, dot: s.dot }; })
    : CHAT_MOOD_STATUSES.map(function(m) { return { text: m }; });
  var presetTexts = preset.map(function(p) { return p.text; });
  var hiddenId = isOnline ? 'edit-account-online-status-value' : 'edit-account-mood-status-value';
  var currentVal = document.getElementById(hiddenId) ? document.getElementById(hiddenId).value : '';

  var html = '<div class="status-picker-option' + (currentVal === '' ? ' active' : '') + '" data-value="" onclick="selectStatusOption(this)">'
    + '<span class="status-picker-dot" style="background:transparent;border:1px dashed var(--text-lighter)"></span>'
    + '<span>随机</span></div>';

  preset.forEach(function(item) {
    html += '<div class="status-picker-option' + (item.text === currentVal ? ' active' : '') + '" data-value="' + Core.escapeHtml(item.text) + '" onclick="selectStatusOption(this)">'
      + '<span class="status-picker-dot" style="background:' + (item.dot || 'var(--primary)') + '"></span>'
      + '<span>' + Core.escapeHtml(item.text) + '</span></div>';
  });

  var customValue = _isCustomStatusValue(currentVal, presetTexts) ? currentVal : '';
  html += '<div class="status-picker-custom">'
    + '<input type="text" id="status-picker-custom-input" class="glass-input" placeholder="自定义状态…" maxlength="12" value="' + Core.escapeHtml(customValue) + '">'
    + '<button class="glass-btn primary" onclick="applyCustomStatus()">应用</button>'
    + '</div>'
    + '<div class="status-picker-hint">选择「随机」则聊天室顶栏每次随机展示，也可以输入自定义内容</div>';

  listEl.innerHTML = html;
  overlay.classList.add('active');

  var customInput = document.getElementById('status-picker-custom-input');
  if (customInput && customValue) {
    customInput.focus();
    try { customInput.setSelectionRange(customInput.value.length, customInput.value.length); } catch(e) {}
  }
}

function selectStatusOption(el) {
  if (!el) return;
  _applyStatusValue(el.dataset.value || '');
}

function applyCustomStatus() {
  var input = document.getElementById('status-picker-custom-input');
  var value = input ? input.value.trim() : '';
  _applyStatusValue(value ? value.slice(0, 12) : '');
}

function _applyStatusValue(value) {
  var isOnline = _statusPickerKind === 'online';
  var hiddenId = isOnline ? 'edit-account-online-status-value' : 'edit-account-mood-status-value';
  var textId = isOnline ? 'edit-account-online-status-text' : 'edit-account-mood-status-text';
  var hiddenEl = document.getElementById(hiddenId);
  var textEl = document.getElementById(textId);
  if (hiddenEl) hiddenEl.value = value;
  if (textEl) textEl.textContent = value || '随机';
  closeStatusPicker();
}

function closeStatusPicker() {
  var overlay = document.getElementById('status-picker-overlay');
  if (overlay) overlay.classList.remove('active');
}

function deletePartnerAccount(id) {
  Core.confirm('删除角色', '确定删除这个角色吗？', function() {
    var partners = Storage.getPartnerProfiles();
    Storage.setPartnerProfiles(partners.filter(function(p) { return p.id !== id; }));
    renderAccountSettings();
    Core.toast('角色已删除');
  });
}

// 外观设置
function renderAppearance() {
  const themeContainer = document.getElementById('theme-selector-container');
  if (themeContainer) ThemeManager.renderThemeSelector(themeContainer);
  
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontSizeValue = document.getElementById('font-size-value');
  if (fontSizeSlider) {
    fontSizeSlider.value = Storage.getFontSize();
    if (fontSizeValue) fontSizeValue.textContent = Storage.getFontSize() + 'px';
    updateRangeGradient(fontSizeSlider);
  }

  // 全局字体设置：同步 UI 并异步恢复已保存字体
  if (window.FontManager) {
    FontManager.syncUI();
    FontManager.restore();
  }
}

function changeFontSize(val) {
  Storage.setFontSize(val);
  const el = document.getElementById('font-size-value');
  if (el) el.textContent = Storage.getFontSize() + 'px';
  updateRangeGradient(document.getElementById('font-size-slider'));
}

// ===== 聊天设置 =====

// 通用的 toggle 设置项处理
function chatSettingToggle(key, el) {
  var setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
  if (typeof Storage[setterName] === 'function') {
    Storage[setterName](el.checked);
  }
  
  // 主动发送开关变化时，即时重启定时器（全站生效，无需停留在聊天室）
  if (key === 'proactiveSend') {
    if (el.checked) {
      startProactiveTimer();
    } else {
      stopProactiveTimer();
    }
  }
  
  // 允许对方主动拨打开关变化时，即时启停模拟来电（全站生效，无需进入聊天室）
  if (key === 'simulateCall') {
    if (el.checked) {
      startSimulateCallTimer();
    } else {
      stopSimulateCallTimer();
    }
  }
  
  // 后台保活开关变化：启停静默音频循环
  if (key === 'backgroundKeepAlive') {
    if (el.checked) {
      startKeepAliveAudio();
    } else {
      stopKeepAliveAudio();
    }
  }
  
  // 后台消息推送开关变化：请求通知权限
  if (key === 'backgroundPush') {
    if (el.checked) {
      ensureNotifyPermission();
    }
  }
}

// 聊天设置入口页渲染
function renderChatSettings() {
  setToggle('cs-keep-alive', Storage.getBackgroundKeepAlive());
  setToggle('cs-bg-push', Storage.getBackgroundPush());
}

// 功能设置子页渲染
function renderFeatureSettings() {
  setToggle('cs-read-receipt', Storage.getReadReceipt());
  setToggle('cs-read-ignore', Storage.getReadIgnore());
  setToggle('cs-typing-indicator', Storage.getTypingIndicator());
  setToggle('cs-enter-send', Storage.getEnterToSend());
  setToggle('cs-show-recall-content', Storage.getShowRecallContent());
  renderTimestampSelection();
  renderReadModeSelection();
  renderTypingSymbolSelection();
  renderPatSymbolSelection();
  var typingTextEl = document.getElementById('cs-typing-text');
  if (typingTextEl) typingTextEl.value = Storage.getTypingIndicatorText();
}

// 已读显示模式选择
function chatSetReadMode(mode) {
  Storage.setReadReceiptMode(mode);
  renderReadModeSelection();
  Core.toast(mode === 'icon' ? '已读显示模式：图形（✓）' : '已读显示模式：文字');
}

function renderReadModeSelection() {
  var current = Storage.getReadReceiptMode();
  ['icon', 'text'].forEach(function(m) {
    var el = document.getElementById('cs-read-mode-' + m);
    if (!el) return;
    if (m === current) {
      el.classList.add('checked');
    } else {
      el.classList.remove('checked');
    }
  });
}

// 自定义正在输入提示文案
function chatSetTypingText(text) {
  text = (text || '').trim();
  if (!text) {
    text = '对方正在输入…';
    var inputEl = document.getElementById('cs-typing-text');
    if (inputEl) inputEl.value = text;
  }
  Storage.setTypingIndicatorText(text);
  var bubbleText = document.getElementById('chat-typing-text');
  if (bubbleText) bubbleText.textContent = text;
  Core.toast('正在输入提示文案已更新');
}

// 节奏设置子页渲染
function renderPaceSettings() {
  var minDelay = Storage.getReplyMinDelay();
  var maxDelay = Storage.getReplyMaxDelay();
  _paceSetInput('cs-reply-min-delay', minDelay);
  _paceSetInput('cs-reply-max-delay', maxDelay);
  setToggle('cs-proactive-send', Storage.getProactiveSend());
  var proactiveInterval = Storage.getProactiveSendInterval();
  _paceSetInput('cs-proactive-interval', proactiveInterval);
  setToggle('cs-spell-card', Storage.getSpellCardSend());
  setToggle('cs-emoji-mixing', Storage.getEmojiMixing());
  setToggle('cs-kaomoji-mixing', Storage.getKaomojiMixing());
  setToggle('cs-sticker-mixing', Storage.getStickerMixing());
  setToggle('cs-redpacket-mixing', Storage.getRedPacketMixing());
  setToggle('cs-pat-mixing', Storage.getPatMixEnabled());
  setToggle('cs-voice-mixing', Storage.getVoiceMixing());
  setToggle('cs-simulate-call', Storage.getSimulateCall());
}

// 辅助：秒 → 输入框数值与单位（优先按最大可整除单位展示）
function _paceSplit(sec) {
  sec = Math.max(1, Math.round(sec));
  if (sec % 3600 === 0) return { num: sec / 3600, unit: 3600 };
  if (sec % 60 === 0) return { num: sec / 60, unit: 60 };
  return { num: sec, unit: 1 };
}

// 辅助：将秒值填充到数字输入框 + 单位选择器
function _paceSetInput(prefix, sec) {
  var numEl = document.getElementById(prefix + '-num');
  var unitEl = document.getElementById(prefix + '-unit');
  if (!numEl || !unitEl) return;
  var parts = _paceSplit(sec);
  numEl.value = parts.num;
  unitEl.value = String(parts.unit);
}

// 辅助：从数字输入框 + 单位选择器读取秒值；无效时返回 null
function _paceReadInput(prefix) {
  var numEl = document.getElementById(prefix + '-num');
  var unitEl = document.getElementById(prefix + '-unit');
  if (!numEl || !unitEl) return null;
  var num = parseInt(numEl.value, 10);
  var unit = parseInt(unitEl.value, 10) || 1;
  if (!num || isNaN(num) || num < 1) return null;
  return Math.max(1, num * unit);
}

// 音效设置子页渲染
function renderSoundSettings() {
  setToggle('cs-sound-enabled', Storage.getSoundEnabled());
  var vol = Storage.getSoundVolume();
  setSlider('cs-sound-volume', vol);
  setSliderValue('cs-sound-volume-val', vol + '%');
  renderSoundSelection('receive', Storage.getReceiveSound());
  renderSoundSelection('send', Storage.getSendSound());
  _updateCustomSoundUploadUI('receive');
  _updateCustomSoundUploadUI('send');
}

// 辅助：设置开关
function setToggle(id, val) {
  var el = document.getElementById(id);
  if (el) el.checked = val;
}

// 辅助：设置滑块
function setSlider(id, val) {
  var el = document.getElementById(id);
  if (el) { el.value = val; updateRangeGradient(el); }
}

// 辅助：设置滑块文字
function setSliderValue(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

// 辅助：将秒格式化为可读文本（>=60 秒显示 X分Y秒）
function formatSecondsText(sec) {
  sec = Math.max(1, Math.round(sec));
  if (sec < 60) return sec + '秒';
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return s > 0 ? (m + '分' + s + '秒') : (m + '分钟');
}

// 辅助：更新 range input 的渐变填充（动态反映 value/min/max 比例）
// 渐变内使用 CSS 变量（--slider-fill / --slider-track-empty），主题切换后由浏览器实时解析最新
// --primary，避免 inline 渐变冻结为旧主题色导致已填充部分与主色不一致
function updateRangeGradient(el) {
  var min = parseFloat(el.min) || 0;
  var max = parseFloat(el.max) || 100;
  var val = parseFloat(el.value) || 0;
  var pct = ((val - min) / (max - min)) * 100;
  el.style.backgroundImage =
    'linear-gradient(to right, ' +
    'var(--slider-fill, #4C9AFF) 0%, var(--slider-fill, #4C9AFF) ' + pct + '%, ' +
    'var(--slider-track-empty, rgba(255,255,255,0.2)) ' + pct + '%, ' +
    'var(--slider-track-empty, rgba(255,255,255,0.2)) 100%)';
}

// 时间戳样式选择
function chatSetTimestamp(style) {
  Storage.setTimestampStyle(style);
  renderTimestampSelection();
}

function renderTimestampSelection() {
  var current = Storage.getTimestampStyle();
  ['none', 'time', 'datetime'].forEach(function(s) {
    var el = document.getElementById('cs-ts-' + s);
    if (!el) return;
    if (s === current) {
      el.classList.add('checked');
    } else {
      el.classList.remove('checked');
    }
  });
}

// 回复速度数字输入（最短/最长联动：最短不能超过最长，最长不能小于最短且不能超过主动发送间隔）
function chatSetReplyDelay(type) {
  var prefix = type === 'min' ? 'cs-reply-min-delay' : 'cs-reply-max-delay';
  var val = _paceReadInput(prefix);
  if (val === null) {
    // 输入无效时回显当前存储值
    var cur = type === 'min' ? Storage.getReplyMinDelay() : Storage.getReplyMaxDelay();
    _paceSetInput(prefix, cur);
    Core.toast('请输入不小于 1 的数字');
    return;
  }
  if (type === 'min') {
    var maxVal = Storage.getReplyMaxDelay();
    if (val > maxVal) {
      val = maxVal;
      _paceSetInput(prefix, val);
      Core.toast('最短等待不能超过最长等待，已自动调整为 ' + formatSecondsText(val));
    }
    Storage.setReplyMinDelay(val);
  } else {
    var minVal = Storage.getReplyMinDelay();
    if (val < minVal) {
      val = minVal;
      _paceSetInput(prefix, val);
      Core.toast('最长等待不能小于最短等待，已自动调整为 ' + formatSecondsText(val));
    }
    var proactiveInterval = Storage.getProactiveSendInterval();
    if (val > proactiveInterval) {
      val = proactiveInterval;
      _paceSetInput(prefix, val);
      Core.toast('最长等待不能超过主动发送间隔，已自动调整为 ' + formatSecondsText(val));
    }
    Storage.setReplyMaxDelay(val);
  }
}

// 主动发送间隔数字输入（间隔变小时联动压缩最长等待）
function chatSetProactiveInterval() {
  var prefix = 'cs-proactive-interval';
  var val = _paceReadInput(prefix);
  if (val === null) {
    _paceSetInput(prefix, Storage.getProactiveSendInterval());
    Core.toast('请输入不小于 1 的数字');
    return;
  }
  Storage.setProactiveSendInterval(val);

  // 联动：最长等待不能超过主动发送间隔
  var maxDelay = Storage.getReplyMaxDelay();
  if (maxDelay > val) {
    Storage.setReplyMaxDelay(val);
    var maxDelayEl = document.getElementById('cs-reply-max-delay-num');
    if (maxDelayEl) {
      _paceSetInput('cs-reply-max-delay', val);
      Core.toast('最长等待已同步调整为不超过主动发送间隔');
    }
  }

  // 间隔变化时重启定时器（应用新间隔，保证到点必发）
  if (Storage.getProactiveSend()) {
    stopProactiveTimer();
    startProactiveTimer();
  }
}

// 音效选择
function chatSetSound(type, sound) {
  if (type === 'receive') {
    Storage.setReceiveSound(sound);
  } else {
    Storage.setSendSound(sound);
  }
  renderSoundSelection(type, sound);
}

function renderSoundSelection(type, selected) {
  var containerId = 'cs-send-sound-options';
  if (type === 'receive') containerId = 'cs-receive-sound-options';
  var container = document.getElementById(containerId);
  if (!container) return;
  var options = container.querySelectorAll('.sound-option');
  options.forEach(function(opt) {
    if (opt.getAttribute('data-sound') === selected) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });
}

// 音效音量滑块
function chatSetSoundVolume(val) {
  Storage.setSoundVolume(parseInt(val));
  setSliderValue('cs-sound-volume-val', val + '%');
  updateRangeGradient(document.getElementById('cs-sound-volume'));
}

// 上传自定义音效（接收/发送/来电铃声），音频数据写入 IndexedDB 永久保存，localStorage 仅存元数据
function chatUploadSound(type, fileInput) {
  var file = fileInput.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.mp3')) {
    Core.toast('仅支持 MP3 格式文件');
    fileInput.value = '';
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    var soundId = 'custom_' + Date.now();
    // 音频内容写入 IndexedDB，永久保存且不受 localStorage 容量限制
    var saveMeta = function() {
      var customSounds = Storage.getCustomSounds();
      customSounds = customSounds.filter(function(s) { return s.id !== soundId; });
      customSounds.push({ id: soundId, name: file.name, type: type });
      Storage.setCustomSounds(customSounds);

      if (type === 'receive') {
        Storage.setReceiveSound(soundId);
        renderSoundSelection('receive', soundId);
        var nameEl = document.getElementById('cs-receive-upload-name');
        if (nameEl) nameEl.textContent = file.name;
      } else {
        Storage.setSendSound(soundId);
        renderSoundSelection('send', soundId);
        var nameEl3 = document.getElementById('cs-send-upload-name');
        if (nameEl3) nameEl3.textContent = file.name;
      }
      _updateCustomSoundUploadUI(type);
      Core.toast('自定义音效已上传并永久保存');
    };
    if (window.SoundFileDB) {
      SoundFileDB.set(soundId, base64).then(saveMeta).catch(function(err) {
        // IndexedDB 不可用时降级：仍写入 localStorage（仅保留元数据，旧设备可能放不下音频）
        console.warn('SoundFileDB save failed:', err);
        saveMeta();
      });
    } else {
      saveMeta();
    }
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
}

/* 删除自定义音效：恢复为对应内置默认音效 */
function chatDeleteSound(type) {
  var label = type === 'receive' ? '接收消息音效' : '发送消息音效';
  Core.dangerConfirm('删除自定义音效', '确定删除当前' + label + '的自定义音效并恢复默认吗？', function() {
    var current = type === 'receive' ? Storage.getReceiveSound() : Storage.getSendSound();
    if (current && current.indexOf('custom_') === 0) {
      if (window.SoundFileDB) {
        SoundFileDB.del(current).catch(function() {});
      }
      var customSounds = Storage.getCustomSounds().filter(function(s) { return s.id !== current; });
      Storage.setCustomSounds(customSounds);
    }
    if (type === 'receive') {
      Storage.setReceiveSound('msg');
      renderSoundSelection('receive', 'msg');
      var nameEl = document.getElementById('cs-receive-upload-name');
      if (nameEl) nameEl.textContent = '';
    } else {
      Storage.setSendSound('msg');
      renderSoundSelection('send', 'msg');
      var nameEl3 = document.getElementById('cs-send-upload-name');
      if (nameEl3) nameEl3.textContent = '';
    }
    _updateCustomSoundUploadUI(type);
    Core.toast('已删除自定义音效，恢复默认');
  });
}

/* 更新自定义音效上传行的预览/删除按钮显隐 */
function _updateCustomSoundUploadUI(type) {
  var current = type === 'receive' ? Storage.getReceiveSound() : Storage.getSendSound();
  var actionsId = type === 'receive' ? 'cs-receive-upload-actions' : 'cs-send-upload-actions';
  var actionsEl = document.getElementById(actionsId);
  if (!actionsEl) return;
  if (current && current.indexOf('custom_') === 0) {
    actionsEl.style.display = 'inline-flex';
  } else {
    actionsEl.style.display = 'none';
  }
}

/* 内置音效预生成 WAV 数据（data URI）。移动端部分浏览器 Web Audio 合成无声，统一改用 Audio 播放 */
var BUILTIN_SOUND_DATA = {
  msg: 'data:audio/wav;base64,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',
  default: 'data:audio/wav;base64,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',
  crisp: 'data:audio/wav;base64,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',
  soft: 'data:audio/wav;base64,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',
  retro: 'data:audio/wav;base64,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PAo5CjYKMwowCi0KKgonCiQKIQoeChsKGQoWChMKEAoNCgoKBwoECgEK/gn7CfgJ9gnzCfAJ7QkW9hn2HPYf9iH2JPYn9ir2LfYw9jP2NfY49jv2PvZB9kT2RvZJ9kz2T/ZS9lT2V/Za9l32YPZi9mX2aPZr9m72cPZz9nb2efZ79n72gfaE9ob2ifaM9o/2kfaU9pf2mvac9p/2XglbCVkJVglTCVEJTglLCUgJRglDCUAJPgk7CTgJNgkzCTAJLgkrCSgJJgkjCSAJHgkbCRgJFgkTCREJDgkLCQkJBgkDCQEJ/gj8CPkI9gj0CPEI7wjsCOkI5wjkCOII3wjdCCb3Kfcr9y73MPcz9zX3OPc79z33QPdC90X3R/dK90z3T/dR91T3VvdZ91v3Xvdg92P3Zfdo92r3bfdv93L3dPd393n3fPd+94H3g/eG94j3i/eN94/3kveU95f3mfec9573ofddCFsIWAhWCFMIUQhPCEwISghHCEUIQwhACD4IOwg5CDcINAgyCC8ILQgrCCgIJggkCCEIHwgcCBoIGAgVCBMIEQgOCAwICggHCAUIAwgACP4H/Af5B/cH9QfzB/AH7gfsB+kHGfgb+B74IPgi+CT4J/gp+Cv4Lvgw+DL4NPg3+Dn4O/g9+ED4QvhE+Eb4SfhL+E34T/hS+FT4VvhY+Fr4Xfhf+GH4Y/hl+Gj4avhs+G74cfhz+HX4d/h5+Hv4fviA+IL4hPiG+HgHdQdzB3EHbwdtB2sHaAdmB2QHYgdgB14HXAdZB1cHVQdTB1EHTwdNB0sHSAdGB0QHQgdABz4HPAc6BzgHNQczBzEHLwctBysHKQcnByUHIwchBx8HHQcaBxgHFgcUBxIHEAfy+PT49vj4+Pr4/Pj++AD5AvkE+Qb5CPkK+Qz5DvkQ+RL5FPkW+Rj5Gvkc+R75IPki+ST5Jvko+Sr5LPku+TD5Mvk0+Tb5OPk6+Tz5PvlA+UL5RPlG+Uj5SvlM+U75UPlS+VT5qwapBqcGpQajBqEGnwadBpsGmQaXBpUGkwaSBpAGjgaMBooGiAaGBoQGggaBBn8GfQZ7BnkGdwZ1BnMGcQZwBm4GbAZqBmgGZgZkBmMGYQZfBl0GWwZZBlcGVgZUBlIGUAZOBkwGtfm3+bn5u/m9+b75wPnC+cT5xvnI+cn5y/nN+c/50fnS+dT51vnY+dn5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',
  waterdrop: 'data:audio/wav;base64,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',
};

// 音效预览
function previewSound(type) {
  // 自定义上传音效（接收/发送/来电铃声）：从 IndexedDB 读取音频后播放
  if (type && type.indexOf('custom_') === 0) {
    var playCustom = function(data) {
      if (!data) { Core.toast('音效文件不存在'); return; }
      var audio = new Audio(data);
      audio.volume = Math.max(0, Math.min(1, (Storage.getSoundVolume() || 80) / 100));
      audio.play().catch(function() {});
    };
    if (window.SoundFileDB) {
      SoundFileDB.get(type).then(function(data) {
        if (!data) {
          // 兼容旧版本：音频数据曾直接存在 localStorage
          var legacy = Storage.getCustomSounds().filter(function(s) { return s.id === type; })[0];
          if (legacy && legacy.data) playCustom(legacy.data);
          else Core.toast('音效文件不存在');
          return;
        }
        playCustom(data);
      }).catch(function() {
        Core.toast('音效文件读取失败');
      });
    } else {
      var legacy2 = Storage.getCustomSounds().filter(function(s) { return s.id === type; })[0];
      if (legacy2 && legacy2.data) playCustom(legacy2.data);
      else Core.toast('当前环境不支持音效播放');
    }
    return;
  }
  // 内置音效：播放预生成的 WAV 数据（兼容移动端，避免 Web Audio 合成在部分浏览器无声）
  var builtin = BUILTIN_SOUND_DATA[type];
  if (builtin) {
    var audio = new Audio(builtin);
    audio.volume = Math.max(0, Math.min(1, (Storage.getSoundVolume() || 80) / 100));
    audio.play().catch(function() {});
  }
}

// 数据管理
function renderDataManage() {
  // 统计聊天记录总条数（单聊 + 群聊），按 chat id 去重（群聊会同时出现在 chats 与 groupChats 中，避免重复计数）
  var totalMsgs = 0;
  try {
    var chats = Storage.getChats() || [];
    var countedIds = {};
    chats.forEach(function(c) {
      if (!c || !c.id || countedIds[c.id]) return;
      countedIds[c.id] = true;
      var msgs = Storage.getMessages(c.id);
      if (msgs && msgs.length) totalMsgs += msgs.length;
    });
    var groups = Storage.getGroupChats() || [];
    groups.forEach(function(g) {
      if (!g || !g.id || countedIds[g.id]) return;
      countedIds[g.id] = true;
      var msgs = Storage.getMessages(g.id);
      if (msgs && msgs.length) totalMsgs += msgs.length;
    });
  } catch (e) {}
  // 字卡数量
  var cardCount = 0;
  try {
    var cards = Storage.getCards();
    cardCount = Array.isArray(cards) ? cards.length : 0;
  } catch (e) {}
  // 设置项数量（localStorage mirror_* 非消息键，含聊天列表/群聊/字卡/表情等配置数据）
  var settingCount = 0;
  var lsBytes = 0;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i) || '';
      if (k.indexOf('mirror_') === 0 && k.indexOf('mirror_msg_') !== 0) {
        if (k.indexOf('mirror___ts_') === 0) continue;
        settingCount++;
        var v = localStorage.getItem(k);
        if (v) lsBytes += v.length * 2;
      }
    }
  } catch (e) {}

  // 估算总占用：优先用真实配额估算，失败则用条目数代替
  var totalBytes = null;
  var quotaBytes = null;
  if (window.navigator && navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(function(est) {
      if (est && typeof est.usage === 'number') totalBytes = est.usage;
      if (est && typeof est.quota === 'number') quotaBytes = est.quota;
      _updateDataStatsUI(totalMsgs, cardCount, settingCount, totalBytes, quotaBytes, lsBytes);
    }).catch(function() {
      _updateDataStatsUI(totalMsgs, cardCount, settingCount, null, null, lsBytes);
    });
  } else {
    _updateDataStatsUI(totalMsgs, cardCount, settingCount, null, null, lsBytes);
  }
}

function _fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function _updateDataStatsUI(totalMsgs, cardCount, settingCount, totalBytes, quotaBytes, lsBytes) {
  var setText = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  setText('data-stat-msgs', String(totalMsgs));
  setText('data-stat-cards', String(cardCount));
  setText('data-stat-settings', String(settingCount));
  var totalEl = document.getElementById('data-storage-total');
  if (totalEl) {
    if (totalBytes != null && quotaBytes) {
      totalEl.textContent = '已用 ' + _fmtBytes(totalBytes) + ' / 配额 ' + _fmtBytes(quotaBytes);
    } else if (totalBytes != null) {
      totalEl.textContent = '已用 ' + _fmtBytes(totalBytes);
    } else {
      totalEl.textContent = '聊天 ' + totalMsgs + ' 条 · 字卡 ' + cardCount + ' 张 · 设置 ' + settingCount + ' 项';
    }
  }
  var bar = document.getElementById('data-storage-bar');
  if (bar) {
    var pct = (totalBytes != null && quotaBytes) ? Math.min(100, totalBytes / quotaBytes * 100) : 0;
    bar.style.width = pct.toFixed(1) + '%';
  }
}


function exportChats() {
  const chats = Storage.getChats();
  const allMessages = {};
  chats.forEach(c => {
    // 深拷贝消息数组：导出瘦身只作用于副本，避免改动内存/持久层中的真实消息
    allMessages[c.id] = (Storage.getMessages(c.id) || []).map(m => JSON.parse(JSON.stringify(m)));
  });
  const media = {};
  _backupOverlayShow('正在压缩聊天图片…');
  ChatMedia.prepareExportMessages(allMessages, media, [0], ChatMedia.EXPORT_THRESHOLD).then(function() {
    const data = { app: '拾心界', chats, messages: allMessages, media, exportedAt: new Date().toISOString() };
    _backupOverlayShow('正在打包聊天记录…');
    return _packJsonInWorker(data);
  }).then(function(json) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '拾心界_聊天记录_' + Core.formatDate(new Date()) + '.json';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    _backupOverlayHide();
    Core.toast('聊天记录已导出');
  }).catch(function() {
    _backupOverlayHide();
    Core.toast('聊天记录导出失败');
  });
}

function clearChats() {
  Core.dangerConfirm('清空聊天记录', '此操作不可恢复，确定要清空所有聊天记录吗？', () => {
    const chats = Storage.getChats();
    chats.forEach(c => {
      c.lastMsg = '';
      c.unread = 0;
      Storage.clearChatMessages(c.id);
    });
    Storage.setChats(chats);
    const groups = Storage.getGroupChats();
    groups.forEach(g => {
      Storage.clearChatMessages(g.id);
    });
    Core.toast('聊天记录已清空');
  });
}

function clearCards() {
  Core.dangerConfirm('清空字卡数据', '此操作不可恢复，确定要清空所有字卡数据吗？', () => {
    Storage.setCards([]);
    Core.toast('字卡数据已清空');
  });
}

/* ===== 数据管理：备份与恢复 / 危险操作 ===== */

/* 导入聊天记录：读取之前导出的 JSON（{ chats, messages } 或全量备份格式），按消息 id 去重合并到对应聊天 */
function importChats() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var data;
      try { data = JSON.parse(ev.target.result); } catch (err) { Core.toast('文件解析失败：不是有效的 JSON'); return; }
      if (!data || typeof data !== 'object') { Core.toast('备份文件格式不正确'); return; }
      var chats = Array.isArray(data.chats) ? data.chats : null;
      var messages = data.messages && typeof data.messages === 'object' ? data.messages : null;
      if (!chats && !messages) { Core.toast('未找到聊天数据（需要 chats / messages 字段）'); return; }
      var total = 0;
      if (messages) {
        Object.keys(messages).forEach(function(k) {
          if (Array.isArray(messages[k])) total += messages[k].length;
        });
      }
      Core.dangerConfirm('导入聊天记录', '将从备份文件合并约 ' + total + ' 条消息到对应聊天（按消息 id 去重，不覆盖现有数据）。确定导入？', function() {
        // 0) 先恢复备份中的大图 media 到 IndexedDB 并等待全部写入事务完成，
        //    再合并消息与渲染，避免消息先写入、图片引用异步还原时的竞态丢图
        ChatMedia.restoreMedia(data.media || {}).then(function() {
          try {
            // 1) 聊天列表：备份中有而当前没有的聊天补上（保留现有聊天）
            if (chats && chats.length) {
              var curChats = Storage.getChats() || [];
              var curIds = {};
              curChats.forEach(function(c) { if (c && c.id) curIds[c.id] = true; });
              var mergedChats = curChats.slice();
              var needSave = false;
              chats.forEach(function(c) {
                if (c && c.id && !curIds[c.id]) { mergedChats.push(c); needSave = true; }
              });
              if (needSave) Storage.setChats(mergedChats);
            }
            // 2) 消息合并：按消息 id 去重（保留现有消息，导入的消息中 id 已存在则跳过；无 id 的新消息直接追加）
            var importedCount = 0;
            if (messages) {
              Object.keys(messages).forEach(function(cid) {
                var list = messages[cid];
                if (!Array.isArray(list) || !list.length) return;
                var valid = list.filter(function(m) { return m && (m.id !== undefined || m.time); });
                if (!valid.length) return;
                var existing = Storage.getMessages(cid);
                var merged = Storage._mergeMessages(existing, valid);
                Storage.setMessages(cid, merged);
                importedCount += valid.length;
              });
            }
            Core.toast('导入完成，已合并 ' + importedCount + ' 条消息');
            if (typeof Navigation !== 'undefined' && Navigation._renderChatList) Navigation._renderChatList();
          } catch (err2) {
            Core.toast('导入失败：' + (err2 && err2.message ? err2.message : err2));
          }
        }).catch(function(err3) {
          Core.toast('导入失败（恢复媒体数据出错）：' + (err3 && err3.message ? err3.message : err3));
        });
      });
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ================= v4 单 JSON 导出：图片压缩 + Worker 打包 ================= */
var _backupOverlay = null;

function _backupOverlayShow(text) {
  if (!_backupOverlay) {
    _backupOverlay = document.createElement('div');
    _backupOverlay.className = 'backup-progress-overlay';
    _backupOverlay.innerHTML = '<div class="backup-progress-card"><div class="backup-progress-spinner"></div><div class="backup-progress-text">准备中…</div></div>';
    document.body.appendChild(_backupOverlay);
  }
  _backupOverlay.style.display = 'flex';
  var t = _backupOverlay.querySelector('.backup-progress-text');
  if (t) t.textContent = text || '准备中…';
}
function _backupOverlayHide() {
  if (_backupOverlay) _backupOverlay.style.display = 'none';
}

/* JSON.stringify 在 Web Worker 中执行，不阻塞主线程（移动端/PC 均不卡）；
   环境不支持 Worker 时降级为主线程 stringify。 */
function _packJsonInWorker(data) {
  return new Promise(function(resolve, reject) {
    if (!window.Worker || !window.URL) {
      try { resolve(JSON.stringify(data)); } catch (e) { reject(e); }
      return;
    }
    var code = "self.onmessage=function(e){try{var j=JSON.stringify(e.data);self.postMessage({ok:true,json:j});}catch(err){self.postMessage({ok:false,error:String((err&&err.message)||err)});}};";
    var url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    var worker = new Worker(url);
    var timer = setTimeout(function() { worker.terminate(); URL.revokeObjectURL(url); reject(new Error('打包超时')); }, 60000);
    worker.onmessage = function(ev) {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      if (ev.data && ev.data.ok) resolve(ev.data.json);
      else reject(new Error((ev.data && ev.data.error) || '打包失败'));
    };
    worker.onerror = function() {
      clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url);
      reject(new Error('打包失败'));
    };
    worker.postMessage(data);
  });
}

/* JSON.parse 在 Web Worker 中执行（大备份文件导入不卡主线程），失败回退主线程解析。 */
function _parseJsonInWorker(bytes) {
  return new Promise(function(resolve, reject) {
    function parseMain() {
      try {
        var text = new TextDecoder('utf-8').decode(bytes);
        resolve(JSON.parse(text));
      } catch (e) { reject(e); }
    }
    if (!window.Worker || !window.URL) { parseMain(); return; }
    var code = "self.onmessage=function(e){try{var d=JSON.parse(e.data);self.postMessage({ok:true,data:d});}catch(err){self.postMessage({ok:false,error:String((err&&err.message)||err)});}};";
    var url, worker;
    try {
      url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      worker = new Worker(url);
    } catch (e2) { parseMain(); return; }
    var timer = setTimeout(function() { worker.terminate(); URL.revokeObjectURL(url); parseMain(); }, 30000);
    worker.onmessage = function(ev) {
      clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url);
      if (ev.data && ev.data.ok) resolve(ev.data.data);
      else parseMain();
    };
    worker.onerror = function() { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); parseMain(); };
    var text = new TextDecoder('utf-8').decode(bytes);
    worker.postMessage(text);
  });
}

/* 全量备份导出 v4：聊天记录（单聊+群聊）+ 字卡 + 表情（含分类）+ 设置等，
   图片压缩后全部内联进一个 JSON 文件：
   - 静态图片在保证清晰度前提下压缩（GIF / 透明图原样保留）；
   - 不再依赖 JSZip / ZIP / CompressionStream，全平台只产出一个 .json 文件；
   - stringify + Blob 打包放 Web Worker，移动端不再卡死无反应；
   - 导出过程有进度遮罩，完成后自动下载单个 JSON。 */
function exportFullBackup() {
  try {
    _backupOverlayShow('正在读取聊天与表情数据…');
    var chats = Storage.getChats() || [];
    var groups = Storage.getGroupChats() || [];
    var messages = {};
    chats.forEach(function(c) { messages[c.id] = (Storage.getMessages(c.id) || []).map(function(m) { return JSON.parse(JSON.stringify(m)); }); });
    groups.forEach(function(g) { messages[g.id] = (Storage.getMessages(g.id) || []).map(function(m) { return JSON.parse(JSON.stringify(m)); }); });
    // 设置镜像：localStorage 中 mirror_* 非消息键（消息已单独打包进 messages）
    var settings = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('mirror_') === 0 && k.indexOf('mirror_msg_') !== 0 && k.indexOf('mirror___ts_') !== 0) {
          var short = k.slice('mirror_'.length);
          try { settings[short] = JSON.parse(localStorage.getItem(k)); }
          catch (e) { settings[short] = localStorage.getItem(k); }
        }
      }
    } catch (e) {}
    var media = {};
    var seqBox = [0];
    var stickerJobs = [];
    // 表情包（StickerDB）：深拷贝副本压缩，真实库不动
    if (window.Storage && Storage.getStickersAsync) {
      stickerJobs.push(Storage.getStickersAsync().then(function(list) {
        return ChatMedia.collectStickersForExport(list, media, seqBox, ChatMedia.EXPORT_THRESHOLD);
      }).catch(function() { return null; }));
    }
    // 表情分类
    if (window.Storage && Storage.getStickerCategoriesAsync) {
      stickerJobs.push(Storage.getStickerCategoriesAsync().then(function(cats) { return cats || []; }).catch(function() { return null; }));
    }
    Promise.all(stickerJobs).then(function(res) {
      var stickers = res[0] || null;
      var stickerCategories = res[1] || [];
      _backupOverlayShow('正在压缩图片，优化备份体积…');
      return ChatMedia.prepareExportMessages(messages, media, seqBox, ChatMedia.EXPORT_THRESHOLD).then(function() {
        var data = {
          app: '拾心界',
          version: 4,
          exportedAt: new Date().toISOString(),
          chats: chats,
          groupChats: groups,
          messages: messages,
          cards: Storage.getCards(),
          emojis: Storage.getEmojis(),
          kaomojis: Storage.getKaomojis(),
          stickers: stickers,
          stickerCategories: stickerCategories,
          settings: settings,
          media: media
        };
        _backupOverlayShow('正在打包备份文件…');
        return _packJsonInWorker(data);
      }).then(function(json) {
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '拾心界_全量备份_' + Core.formatDate(new Date()) + '.json';
        a.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        _backupOverlayHide();
        Core.toast('全量备份已导出（单 JSON）');
      });
    }).catch(function(err) {
      _backupOverlayHide();
      Core.toast('备份导出失败：' + (err && err.message ? err.message : err));
    });
  } catch (e) {
    _backupOverlayHide();
    Core.toast('备份导出失败：' + (e && e.message ? e.message : e));
  }
}

/* 全量备份导入/恢复：支持 3 种备份文件——
   ① ZIP（v3 旧版，JSZip 解包 backup.json + media/* 二进制）；
   ② deflate 压缩单文件（v3 旧版兜底，CompressionStream 解压，media 内联）；
   ③ 单 JSON（v1/v2/v4，Worker 解析，media 内联，v4 图片已压缩）。
   恢复流程为严格串行 Promise 链：restoreMedia（等全部 IDB 写入事务完成）→
   逐条 resolveStickerForImport → setStickersAsync → 写回 stickerCategories →
   覆盖业务数据 → 全部完成才 reload（删除固定 1200ms 定时器）。 */
function _backupImportInput() {
  var el = document.getElementById('_sx_input_backup_import');
  if (el) return el;
  el = document.createElement('input');
  el.type = 'file';
  el.id = '_sx_input_backup_import';
  el.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;opacity:0;';
  document.body.appendChild(el);
  return el;
}

function importFullBackup() {
  var input = _backupImportInput();
  input.accept = '.json,.zip,.backup,application/json,application/zip';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var buffer = ev.target.result;
      var bytes = new Uint8Array(buffer);
      var parsePromise;
      if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
        parsePromise = parseZipBackup(bytes);                          // ZIP (v3)
      } else if (bytes.length > 2 && bytes[0] === 0x78 && (bytes[1] === 0x9C || bytes[1] === 0xDA || bytes[1] === 0x01 || bytes[1] === 0x5E)) {
        parsePromise = parseDeflateBackup(bytes);                      // deflate 兜底 (v3)
      } else {
        parsePromise = _parseJsonInWorker(buffer).then(function(d) {   // 单 JSON (v1/v2/v4)
          return { data: d, mediaStore: d.media || null };
        });
      }
      parsePromise.then(function(parsed) {
        var data = parsed.data;
        var mediaStore = parsed.mediaStore || {};
        if (!data || typeof data !== 'object' || data.app !== '拾心界' || !data.version) {
          Core.toast('不是有效的拾心界全量备份文件（缺少 app/version 字段）');
          return;
        }
        var summary = '将用备份文件覆盖当前所有数据（聊天记录、字卡、设置等），当前数据会被替换且不可恢复。';
        var mediaCount = Object.keys(mediaStore).length;
        if (mediaCount) summary += '（含 ' + mediaCount + ' 项媒体数据）';
        Core.dangerConfirm('恢复全量备份', summary + ' 确定恢复？', function() {
          // 严格串行：每一步都 await 完成后再进入下一步，全部完成才 reload
          var chain = Promise.resolve();
          // 1) 媒体数据：写回 ChatImageDB，等待全部写入事务完成
          chain = chain.then(function() { return ChatMedia.restoreMedia(mediaStore); });
          // 2) 表情包：逐条解析引用还原为完整 base64，全部完成后写回 StickerDB
          if (data.stickers && Array.isArray(data.stickers) && window.Storage && Storage.setStickersAsync) {
            chain = chain.then(function() {
              var resolved = [];
              return data.stickers.reduce(function(p, s) {
                return p.then(function() { return ChatMedia.resolveStickerForImport(s); }).then(function(r) { resolved.push(r); return null; });
              }, Promise.resolve()).then(function() {
                return Storage.setStickersAsync(resolved);
              });
            });
          }
          // 2.1) 表情分类：写回 StickerDB stickerCategories
          if (data.stickerCategories && Array.isArray(data.stickerCategories) && window.StickerDB && StickerDB.replaceCategories) {
            chain = chain.then(function() { return StickerDB.replaceCategories(data.stickerCategories); });
          }
          // 3) 覆盖业务数据（同步写入，放在串行链尾部）
          chain = chain.then(function() {
            if (Array.isArray(data.chats)) Storage.setChats(data.chats);
            if (Array.isArray(data.groupChats)) Storage.setGroupChats(data.groupChats);
            if (data.messages && typeof data.messages === 'object') {
              Object.keys(data.messages).forEach(function(cid) {
                var list = data.messages[cid];
                if (Array.isArray(list)) Storage.setMessages(cid, list);
              });
            }
            if (Array.isArray(data.cards)) Storage.setCards(data.cards);
            if (Array.isArray(data.emojis)) Storage.setEmojis(data.emojis);
            if (Array.isArray(data.kaomojis)) Storage.setKaomojis(data.kaomojis);
            if (data.settings && typeof data.settings === 'object') {
              Object.keys(data.settings).forEach(function(k) {
                try { Storage.set(k, data.settings[k]); } catch (e2) {}
              });
            }
            return null;
          });
          // 4) 等待全部持久化（localStorage + IndexedDB）落盘完成才刷新，
          //    避免 reload 打断消息/聊天/字卡的异步 IDB 防抖写，导致导入数据被旧数据回滚/丢失
          chain.then(function() {
            if (window.Storage && Storage.flushAll) return Storage.flushAll();
            return null;
          }).then(function() {
            Core.toast('备份恢复完成，页面即将刷新');
            window.location.reload();
          }).catch(function(err3) {
            Core.toast('恢复失败：' + (err3 && err3.message ? err3.message : err3));
          });
        });
      }).catch(function(err) {
        Core.toast('文件解析失败：' + (err && err.message ? err.message : err));
      });
    };
    reader.readAsArrayBuffer(file);
  };
  input.value = '';
  input.click();
}

/* ZIP 备份解析：读 backup.json（mediaIndex 引用），从 ZIP media/{key} 还原二进制为 base64 mediaStore */
function parseZipBackup(bytes) {
  return new Promise(function(resolve, reject) {
    if (typeof window.JSZip === 'undefined') { reject(new Error('缺少 JSZip 库，无法解压 ZIP 备份')); return; }
    JSZip.loadAsync(bytes).then(function(zip) {
      var jsonFile = zip.file('backup.json');
      if (!jsonFile) { reject(new Error('ZIP 备份中缺少 backup.json')); return; }
      return jsonFile.async('string').then(function(text) {
        var data = JSON.parse(text);
        var mediaIndex = data.media && typeof data.media === 'object' ? data.media : {};
        var mediaStore = {};
        var jobs = Object.keys(mediaIndex).map(function(k) {
          var meta = mediaIndex[k];
          if (meta && meta.inline && meta.data) { mediaStore[k] = meta.data; return Promise.resolve(); }
          var mf = zip.file('media/' + k);
          if (!mf) return Promise.resolve();
          return mf.async('arraybuffer').then(function(buf) {
            mediaStore[k] = ChatMedia.binaryToDataUrl((meta && meta.mime) || 'image/png', new Uint8Array(buf));
            return null;
          });
        });
        return Promise.all(jobs).then(function() {
          data.media = mediaStore; // 统一为内联 mediaStore，后续逻辑与旧版一致
          resolve({ data: data, mediaStore: mediaStore });
        });
      });
    }).catch(reject);
  });
}

/* deflate 压缩单文件解析：DecompressionStream 解压后 JSON.parse（media 内联） */
function parseDeflateBackup(bytes) {
  return new Promise(function(resolve, reject) {
    if (!window.DecompressionStream) { reject(new Error('当前环境不支持 DecompressionStream，无法解压该备份')); return; }
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      new Response(stream).text().then(function(text) {
        var data = JSON.parse(text);
        resolve({ data: data, mediaStore: data.media || null });
      }).catch(reject);
    } catch (e) { reject(e); }
  });
}

/* 重置全部数据：双重确认后清空 localStorage + IndexedDB 全部数据（危险操作） */
function resetAllData() {
  Core.dangerConfirm('重置全部数据', '【高危操作】将清空 localStorage 与 IndexedDB 中的全部数据（聊天记录、字卡、设置、表情包等），且无法恢复。确定继续？', function() {
    Core.dangerConfirm('再次确认', '此操作不可撤销！请再次确认要重置全部数据吗？', function() {
      try {
        // 清空内存缓存
        if (Storage._msgCache) Storage._msgCache = {};
        if (Storage._msgUpdatedAt) Storage._msgUpdatedAt = {};
        if (Storage._metaUpdatedAt) Storage._metaUpdatedAt = {};
        if (Storage._memCache) Storage._memCache = {};
        if (Storage._chatsCache) Storage._chatsCache = null;
        if (Storage._groupChatsCache) Storage._groupChatsCache = null;
        // 取消待写 timer，避免重置后被旧数据刷回
        if (Storage._msgMirrorTimers) {
          Object.keys(Storage._msgMirrorTimers).forEach(function(k) { clearTimeout(Storage._msgMirrorTimers[k]); });
          Storage._msgMirrorTimers = {};
        }
        if (Storage._idbWriteTimers) {
          Object.keys(Storage._idbWriteTimers).forEach(function(k) { clearTimeout(Storage._idbWriteTimers[k]); });
          Storage._idbWriteTimers = {};
        }
        // 清空 localStorage
        try { localStorage.clear(); } catch (e) {}
        // 清空 IndexedDB（先走各 DB 的 clear 方法清空数据，再枚举删除所有 mirror 库兜底）
        var tasks = [];
        if (window.MessageDB && MessageDB.clearAll) tasks.push(MessageDB.clearAll().catch(function() {}));
        if (window.ChatImageDB && ChatImageDB.clearAll) tasks.push(ChatImageDB.clearAll().catch(function() {}));
        if (window.StickerDB && StickerDB.clearAll) tasks.push(StickerDB.clearAll().catch(function() {}));
        if (window.AppKVDB && AppKVDB.getAll) {
          tasks.push(AppKVDB.getAll().then(function(records) {
            var dels = (records || []).map(function(r) { return r && r.key ? AppKVDB.del(r.key).catch(function() {}) : null; });
            return Promise.all(dels);
          }).catch(function() {}));
        }
        // 兜底：枚举并删除所有 IndexedDB 库（MessageDB/StickerDB/AppKVDB 之外的
        // mirror_call_bg_db / mirror_chat_bg_db / mirror_sound_file_db / mirror_journal_photo_db 等
        // 即使当前页面持有连接导致 deleteDatabase 被阻塞，数据也已由上方 clearAll 清空，刷新后浏览器会完成删除）
        try {
          if (indexedDB.databases) {
            indexedDB.databases().then(function(dbs) {
              (dbs || []).forEach(function(d) {
                if (d && d.name && (d.name.indexOf('mirror_') === 0 || d.name.indexOf('Mirror') === 0)) {
                  try { indexedDB.deleteDatabase(d.name); } catch (e2) {}
                }
              });
            }).catch(function() {});
          }
        } catch (e2) {}
        Promise.all(tasks).then(function() {
          Core.toast('全部数据已重置，页面即将刷新');
          setTimeout(function() { window.location.reload(); }, 1200);
        }).catch(function() {
          Core.toast('数据已清理，页面即将刷新');
          setTimeout(function() { window.location.reload(); }, 1200);
        });
      } catch (err) {
        Core.toast('重置失败：' + (err && err.message ? err.message : err));
      }
    });
  });
}

// 关于
function renderAbout() {}

