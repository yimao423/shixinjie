/* ============================================================
   拾心界 · 一起听歌
   —— 加号菜单新功能（仅使用网易云音乐，与其它平台无关）
   通过本地音乐服务（music-server，借鉴 eryu 的网易云代理思路）
   导入网易云歌单并播放；开启「和 TA 一起听」后，对方角色会跟着听，
   并会在播放中途主动切歌 / 暂停 / 点评，动作以聊天消息呈现。

   界面分两个视图，避免拥挤：
     ① 歌单界面（lt-view-playlist）：
        服务状态 + 我的歌单/搜索 Tab + 列表；底部吸底迷你播放条
     ② 播放界面（lt-view-player）：
        大封面 + 歌名/歌手 + 进度 + 控制 + 和 TA 一起听开关

   依赖：
     - 本地音乐服务: http://127.0.0.1:9801（双击 music-server/start.command 启动）
     - 站点现有接口: _currentChatId / Storage.getMessages / Storage.setMessages /
                    updateLastMsg / _safeAppendMessage / App.playSound / showBackgroundPush
   ============================================================ */
(function () {
  'use strict';

  var LT = {
    SERVICE: 'http://127.0.0.1:9801',
    KEY_PL: 'lt_playlists',
    playlists: [],
    queue: [],
    index: -1,
    mode: 'sequential',   // 'sequential' | 'loop' | 'shuffle'
    _curPlaylistId: null, // 当前队列所属歌单 id（用于记忆上次播放位置）
    together: false,
    playing: false,
    serviceOk: false,
    view: 'playlist',     // 'playlist' | 'player'
    audio: null,
    _chatId: null,
    _timer: null,
    _talkTimer: null,
    _lastPartnerMsgAt: 0,
    _lastAction: '',
    _opening: false,
    searchList: [],
  };

  /* ---------- 通用工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtDur(ms) {
    if (!ms || !isFinite(ms) || ms <= 0) return '';
    return fmtTime(ms / 1000);
  }
  function safeCover(url) {
    if (!url) return '';
    return String(url).replace(/^http:\/\//, 'https://');
  }

  /* ---------- 视图切换（歌单界面 / 播放界面） ---------- */
  function ltShowView(view) {
    LT.view = view;
    var pl = $('lt-view-playlist'), py = $('lt-view-player');
    if (pl) pl.style.display = view === 'playlist' ? '' : 'none';
    if (py) py.style.display = view === 'player' ? '' : 'none';
  }
  window.ltGoPlayer = function () { ltShowView('player'); };
  window.ltGoPlaylist = function () { ltShowView('playlist'); };

  /* ---------- 对外入口 ---------- */
  window.openListenTogetherPanel = function () {
    var ov = $('listen-together-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    LT._opening = true;
    closePlusMenu && closePlusMenu();
    LT._chatId = (typeof _currentChatId === 'function') ? _currentChatId() : null;
    try { LT.playlists = Storage.get(LT.KEY_PL, []) || []; } catch (e) { LT.playlists = []; }
    ltShowView('playlist');
    ltRenderPlaylists();
    renderMiniBar();
    _renderTogetherSwitch();
    _syncVolumeUI();
    renderModeBtn();
    _detectService();
    if (!LT._chatId) {
      setServiceText('请先进入聊天室，才能和 TA 一起听', 'warn');
    }
  };

  window.closeListenTogetherPanel = function () {
    var ov = $('listen-together-overlay');
    if (ov) ov.style.display = 'none';
    LT._opening = false;
    if (!LT.together) _stopTalkScheduler();
  };

  /* ---------- 服务检测 ---------- */
  function setServiceText(text, cls) {
    var el = $('lt-service-text');
    if (el) { el.textContent = text; el.className = ''; if (cls) el.classList.add('lt-svc-' + cls); }
    var act = $('lt-service-actions');
    if (act) act.innerHTML = '';
    if (cls === 'warn') {
      act.innerHTML = '<button class="lt-link-btn" onclick="ltOpenGuide()">查看启动方式</button>';
    } else if (LT.serviceOk) {
      act.innerHTML = '<span class="lt-svc-dot"></span>';
    }
  }

  window.ltOpenGuide = function () {
    var hint = '音乐服务未启动或未就绪。\n\n启动方式（两种任选）：\n' +
      '1. 双击 拾心界/music-server/start.command 启动本地服务\n' +
      '2. 或在终端运行：python3 拾心界/music-server/music_server.py\n\n' +
      '提示：VIP / 需要登录的歌曲需配置网易云 Cookie：\n' +
      '在 music-server 目录创建 .netease_cred 文件，写入一行：\n' +
      'MUSIC_U=你的网易云登录Cookie\n\n' +
      '未配置 Cookie 也能播放部分免费歌曲。';
    alert(hint);
  };

  function _detectService() {
    setServiceText('正在检测音乐服务…', '');
    fetch(LT.SERVICE + '/health', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        LT.serviceOk = !!(d && d.ok);
        if (LT.serviceOk) {
          setServiceText('音乐服务已就绪，可以导入歌单听歌了');
        } else {
          setServiceText('音乐服务响应异常', 'warn');
        }
      })
      .catch(function () {
        LT.serviceOk = false;
        setServiceText('未检测到音乐服务（请先启动）', 'warn');
      });
  }

  /* ---------- Tab 切换 ---------- */
  window.ltSwitchTab = function (tab) {
    $('lt-tab-pl') && $('lt-tab-pl').classList.toggle('active', tab === 'pl');
    $('lt-tab-search') && $('lt-tab-search').classList.toggle('active', tab === 'search');
    $('lt-import-row') && ($('lt-import-row').style.display = tab === 'pl' ? '' : 'none');
    $('lt-search-row') && ($('lt-search-row').style.display = tab === 'search' ? '' : 'none');
    $('lt-playlist-list') && ($('lt-playlist-list').style.display = tab === 'pl' ? '' : 'none');
    $('lt-search-list') && ($('lt-search-list').style.display = tab === 'search' ? '' : 'none');
    var empty = $('lt-empty');
    if (empty) {
      if (tab === 'pl') {
        empty.style.display = (LT.playlists.length || LT.queue.length) ? 'none' : '';
        empty.textContent = '歌单为空，输入上方链接导入网易云歌单';
      } else {
        empty.style.display = 'none';
      }
    }
    if (tab === 'search') setTimeout(function () { $('lt-search-input') && $('lt-search-input').focus(); }, 60);
  };

  /* ---------- 歌单列表渲染 ---------- */
  function ltRenderPlaylists() {
    var box = $('lt-playlist-list');
    if (!box) return;
    var back = $('lt-head-back-pl');
    if (back) back.style.display = 'none';
    var empty = $('lt-empty');
    if (!LT.playlists.length && !LT.queue.length) {
      box.innerHTML = '';
      if (empty) { empty.style.display = ''; empty.textContent = '歌单为空，输入上方链接导入网易云歌单'; }
      return;
    }
    if (!LT.playlists.length && LT.queue.length) {
      // 仅搜索组成的临时队列
      empty.style.display = 'none';
      return;
    }
    var html = '';
    for (var i = 0; i < LT.playlists.length; i++) {
      var p = LT.playlists[i];
      html += '<div class="lt-pl-item" onclick="ltOpenPlaylist(' + i + ')">' +
        '<div class="lt-pl-cover">' + (p.cover ? '<img src="' + esc(safeCover(p.cover)) + '" alt="">' : '<i class="fas fa-list-ul"></i>') + '</div>' +
        '<div class="lt-pl-info"><div class="lt-pl-name">' + esc(p.name || '未命名歌单') + '</div>' +
        '<div class="lt-pl-sub">' + (p.count ? p.count + ' 首歌曲' : '') + '</div></div>' +
        '<button class="lt-pl-del" onclick="event.stopPropagation();ltRemovePlaylist(' + i + ')" title="删除歌单"><i class="fas fa-trash-can"></i></button>' +
        '</div>';
    }
    box.innerHTML = html;
    if (empty) empty.style.display = 'none';
  }

  window.ltRemovePlaylist = function (i) {
    LT.playlists.splice(i, 1);
    try { Storage.set(LT.KEY_PL, LT.playlists); } catch (e) {}
    ltRenderPlaylists();
    if (typeof Core !== 'undefined' && Core.toast) Core.toast('已删除歌单');
  };

  /* ---------- 导入歌单 ---------- */
  window.ltImportPlaylist = function () {
    var inp = $('lt-playlist-input');
    var val = inp ? inp.value.trim() : '';
    if (!val) { inp && inp.focus(); return; }
    if (!LT.serviceOk) { setServiceText('请先启动音乐服务再导入', 'warn'); return; }
    var btn = $('lt-import-btn');
    if (btn) { btn.disabled = true; btn.textContent = '导入中…'; }
    var skipVip = !!(document.getElementById('lt-skip-vip') && document.getElementById('lt-skip-vip').checked);
    fetch(LT.SERVICE + '/playlist?id=' + encodeURIComponent(val) + (skipVip ? '&skip_vip=1' : ''))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (btn) { btn.disabled = false; btn.textContent = '导入'; }
        if (!d || !d.ok || !d.songs || !d.songs.length) {
          setServiceText('导入失败：' + (d && d.error ? d.error : '歌单为空或链接无效'), 'warn');
          return;
        }
        var pid = d.playlistId || String(val.match(/\d+/) ? val.match(/\d+/)[0] : Date.now());
        for (var i = 0; i < LT.playlists.length; i++) {
          if (String(LT.playlists[i].id) === String(pid)) { LT.playlists.splice(i, 1); break; }
        }
        LT.playlists.unshift({
          id: pid,
          name: d.name || ('歌单 ' + pid),
          count: d.songs.length,
          cover: (d.songs[0] && d.songs[0].cover) || '',
          songs: d.songs
        });
        try { Storage.set(LT.KEY_PL, LT.playlists); } catch (e) {}
        var tip = '歌单「' + (d.name || '') + '」导入成功，共 ' + d.songs.length + ' 首';
        if (skipVip && d.skipped) tip += '（已跳过 ' + d.skipped + ' 首 VIP 歌曲）';
        setServiceText(tip);
        ltRenderPlaylists();
        if (inp) inp.value = '';
        ltOpenPlaylist(0);
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = '导入'; }
        setServiceText('网络错误，请确认音乐服务已启动', 'warn');
      });
  };

  /* ---------- 打开歌单（展示其歌曲列表，从上次位置续播，不再强制从头开始） ---------- */
  window.ltOpenPlaylist = function (idx) {
    var p = LT.playlists[idx];
    if (!p || !p.songs || !p.songs.length) { setServiceText('该歌单暂无歌曲', 'warn'); return; }
    LT.queue = p.songs.slice();
    LT._curPlaylistId = p.id;
    // 记忆上次播放位置：再次进入歌单直接续播，不从头开始
    var start = 0;
    if (typeof p.lastIndex === 'number' && p.lastIndex >= 0 && p.lastIndex < p.songs.length) {
      start = p.lastIndex;
    }
    LT.index = start;
    renderQueue();
    ltPlay(start, true);
  };

  function renderQueue() {
    var box = $('lt-playlist-list');
    if (!box) return;
    if (!LT.queue.length) { ltRenderPlaylists(); return; }
    var html = '';
    for (var i = 0; i < LT.queue.length; i++) {
      var s = LT.queue[i];
      html += '<div class="lt-song-item' + (i === LT.index ? ' active' : '') + '" onclick="ltPick(' + i + ')">' +
        '<span class="lt-song-idx">' + (i + 1) + '</span>' +
        '<div class="lt-song-main">' +
        '<div class="lt-song-name">' + esc(s.name || '未知歌曲') + '</div>' +
        '<div class="lt-song-artist">' + esc(s.artist || '未知歌手') + '</div>' +
        '</div>' +
        '<span class="lt-song-dur">' + fmtDur(s.duration) + '</span>' +
        '</div>';
    }
    box.innerHTML = html;
    var emptyEl = $('lt-empty');
    if (emptyEl) emptyEl.style.display = 'none';
    var back = $('lt-head-back-pl');
    if (back) back.style.display = '';
    // 返回歌单页签显示（此时列表已是歌曲队列）
    $('lt-tab-pl') && $('lt-tab-pl').classList.add('active');
    $('lt-tab-search') && $('lt-tab-search').classList.remove('active');
    $('lt-import-row') && ($('lt-import-row').style.display = '');
    $('lt-search-row') && ($('lt-search-row').style.display = 'none');
  }

  /** 从歌曲队列视图返回歌单列表视图（播放不中断，迷你条继续显示） */
  window.ltBackToPlaylists = function () {
    ltSwitchTab('pl');
    ltRenderPlaylists();
  };

  /** 用户在歌曲列表点击一首：播放并进入播放界面 */
  window.ltPick = function (idx) {
    ltPlay(idx);
    ltShowView('player');
  };

  /* ---------- 播放控制 ---------- */
  function getAudio() {
    if (!LT.audio) {
      LT.audio = new Audio();
      LT.audio.preload = 'auto';
      _syncVolumeUI();
      LT.audio.addEventListener('timeupdate', function () { updateProgress(false); });
      LT.audio.addEventListener('loadedmetadata', function () {
        var d = $('lt-dur-time');
        if (d && isFinite(LT.audio.duration)) d.textContent = fmtTime(LT.audio.duration);
      });
      LT.audio.addEventListener('play', function () { LT.playing = true; renderPlayBtn(); });
      LT.audio.addEventListener('pause', function () { LT.playing = false; renderPlayBtn(); });
      LT.audio.addEventListener('ended', function () { onEnded(); });
      LT.audio.addEventListener('error', function () {
        setServiceText('播放出错，可能该歌曲需登录或已失效，自动换下一首', 'warn');
        setTimeout(function () { ltNext(); }, 1200);
      });
    }
    return LT.audio;
  }

  /** 播放指定索引。不强制切换视图（角色自动切歌/用户点歌时由调用方决定是否进播放页） */
  function ltPlay(idx, isNew) {
    if (!LT.queue.length) return;
    if (idx < 0) idx = LT.queue.length - 1;
    if (idx >= LT.queue.length) idx = 0;
    LT.index = idx;
    // 记下当前歌单的播放位置，下次进入续播
    if (LT._curPlaylistId) {
      for (var pi = 0; pi < LT.playlists.length; pi++) {
        if (String(LT.playlists[pi].id) === String(LT._curPlaylistId)) {
          LT.playlists[pi].lastIndex = idx;
          try { Storage.set(LT.KEY_PL, LT.playlists); } catch (e) {}
          break;
        }
      }
    }
    var song = LT.queue[idx];
    renderQueue();
    renderPlayerInfo(song);
    renderMiniBar();
    var audio = getAudio();
    fetch(LT.SERVICE + '/song/url?id=' + song.id)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) {
          setServiceText('该歌曲无法播放：' + (d && d.error ? d.error : '未知错误'), 'warn');
          return;
        }
        audio.src = LT.SERVICE + d.url;
        var p = audio.play();
        if (p && p.catch) p.catch(function () {
          setServiceText('已就绪，点击播放按钮开始', '');
          renderPlayBtn();
        });
      })
      .catch(function () {
        setServiceText('网络错误：无法获取播放地址', 'warn');
      });
    if (LT._timer) clearInterval(LT._timer);
    LT._timer = setInterval(function () { updateProgress(true); }, 500);
  }
  window.ltPlay = ltPlay;

  window.ltTogglePlay = function () {
    var audio = getAudio();
    if (!audio.src) { setServiceText('请先从歌单选一首歌播放', 'warn'); return; }
    var wasPlaying = !audio.paused;
    if (wasPlaying) {
      audio.pause();
      if (LT.together && Math.random() < 0.22) {
        _partnerSay(pick(USER_PAUSE_TEXTS), true);
      }
    } else {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { setServiceText('浏览器拦截了自动播放，请再点一次', 'warn'); });
    }
    renderPlayBtn();
  };

  window.ltPrev = function () {
    if (!LT.queue.length) return;
    if (LT.together && Math.random() < 0.25) _partnerSay(pick(USER_SKIP_TEXTS), true);
    ltPlay(LT.index - 1);
  };

  window.ltNext = function () {
    if (!LT.queue.length) return;
    if (LT.together && Math.random() < 0.25) _partnerSay(pick(USER_SKIP_TEXTS), true);
    if (LT.mode === 'shuffle' && LT.queue.length > 1) {
      var nxt = LT.index;
      while (nxt === LT.index) nxt = Math.floor(Math.random() * LT.queue.length);
      ltPlay(nxt);
      return;
    }
    ltPlay(LT.index + 1);
  };

  window.ltSeek = function () {
    var bar = $('lt-progress');
    var audio = LT.audio;
    if (!bar || !audio || !audio.duration) return;
    audio.currentTime = (bar.value / 1000) * audio.duration;
  };

  /* ---------- 音量控制 ---------- */
  window.ltSetVolume = function () {
    var bar = $('lt-volume');
    if (!bar) return;
    var v = Number(bar.value) / 100;
    if (LT.audio) LT.audio.volume = v;
    try { Storage.set('lt_volume', v); } catch (e) {}
  };

  function _syncVolumeUI() {
    var vb = $('lt-volume');
    if (!vb) return;
    var vol = 0.8;
    try {
      var sv = Number(Storage.get('lt_volume', 0.8));
      if (isFinite(sv) && sv >= 0 && sv <= 1) vol = sv;
    } catch (e) {}
    vb.value = Math.round(vol * 100);
    if (LT.audio) LT.audio.volume = vol;
  }

  /* ---------- 播放模式：顺延 / 循环 / 随机 ---------- */
  window.ltSetMode = function (m) {
    LT.mode = (m === 'loop' || m === 'shuffle') ? m : 'sequential';
    renderModeBtn();
    if (typeof Core !== 'undefined' && Core.toast) {
      var names = { sequential: '顺延播放', loop: '循环播放', shuffle: '随机播放' };
      Core.toast('已切换为' + names[LT.mode]);
    }
  };

  function renderModeBtn() {
    ['seq', 'loop', 'shuffle'].forEach(function (k) {
      var el = $('lt-mode-' + k);
      if (el) el.classList.toggle('active', LT.mode === (k === 'seq' ? 'sequential' : k));
    });
  }

  function onEnded() {
    if (!LT.queue.length) return;
    if (LT.mode === 'sequential') {
      // 顺延播放：按顺序，最后一首播完自动停止
      if (LT.index >= LT.queue.length - 1) {
        LT.playing = false;
        renderPlayBtn();
        return;
      }
      if (LT.together) _partnerSay(pick(AUTO_NEXT_TEXTS));
      ltPlay(LT.index + 1);
      return;
    }
    if (LT.mode === 'shuffle') {
      var nxt = LT.index;
      if (LT.queue.length > 1) {
        while (nxt === LT.index) nxt = Math.floor(Math.random() * LT.queue.length);
      }
      if (LT.together) _partnerSay(pick(AUTO_NEXT_TEXTS));
      ltPlay(nxt);
      return;
    }
    // loop：循环播放，最后一首自动回第一首（ltPlay 内部会自动回绕）
    if (LT.together) _partnerSay(pick(AUTO_NEXT_TEXTS));
    ltPlay(LT.index + 1);
  }

  function updateProgress() {
    var audio = LT.audio;
    if (!audio) return;
    var bar = $('lt-progress');
    var cur = $('lt-cur-time');
    if (!bar) return;
    if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
      bar.value = Math.round((audio.currentTime / audio.duration) * 1000);
    } else {
      bar.value = 0;
    }
    if (cur) cur.textContent = fmtTime(audio.currentTime);
  }

  function renderPlayBtn() {
    var btn = $('lt-play-btn');
    if (btn) btn.innerHTML = '<i class="fas fa-' + (LT.playing ? 'pause' : 'play') + '"></i>';
    var mini = $('lt-mini-play');
    if (mini) mini.innerHTML = '<i class="fas fa-' + (LT.playing ? 'pause' : 'play') + '"></i>';
  }

  function renderPlayerInfo(song) {
    var cover = $('lt-cover');
    if (cover) {
      if (song.cover) cover.innerHTML = '<img src="' + esc(safeCover(song.cover)) + '" alt="">';
      else cover.innerHTML = '<i class="fas fa-music"></i>';
    }
    var t = $('lt-song-title'); if (t) t.textContent = song.name || '未知歌曲';
    var a = $('lt-song-artist'); if (a) a.textContent = song.artist || '未知歌手';
    var dur = $('lt-dur-time'); if (dur) dur.textContent = fmtDur(song.duration);
    var cur = $('lt-cur-time'); if (cur) cur.textContent = '00:00';
    var bar = $('lt-progress'); if (bar) bar.value = 0;
    renderPlayBtn();
  }

  /** 迷你播放条：有播放中的歌曲即显示 */
  function renderMiniBar() {
    var bar = $('lt-minibar');
    if (!bar) return;
    if (!LT.queue.length) { bar.style.display = 'none'; return; }
    var song = LT.queue[LT.index] || LT.queue[0];
    if (!song) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    var mc = $('lt-mini-cover');
    if (mc) {
      if (song.cover) mc.innerHTML = '<img src="' + esc(safeCover(song.cover)) + '" alt="">';
      else mc.innerHTML = '<i class="fas fa-music"></i>';
    }
    var mt = $('lt-mini-title'); if (mt) mt.textContent = song.name || '未知歌曲';
    var ma = $('lt-mini-artist'); if (ma) ma.textContent = song.artist || '未知歌手';
    renderPlayBtn();
  }

  /* ---------- 一起听（角色互动） ---------- */
  window.ltToggleTogether = function () {
    var chk = $('lt-together-check');
    LT.together = !!(chk && chk.checked);
    _renderTogetherSwitch();
    if (LT.together) {
      if (!LT._chatId) {
        setServiceText('请先进入聊天室，才能和 TA 一起听', 'warn');
        chk.checked = false;
        LT.together = false;
        _renderTogetherSwitch();
        return;
      }
      _partnerSay(pick(OPEN_TEXTS));
      _scheduleTalk();
      setServiceText('已开启一起听：对方会跟着播放，并可能中途切歌 / 暂停 / 点评');
    } else {
      _stopTalkScheduler();
      setServiceText('已关闭一起听');
    }
  };

  function _renderTogetherSwitch() {
    var chk = $('lt-together-check');
    if (chk) chk.checked = LT.together;
  }

  function _scheduleTalk() {
    if (LT._talkTimer) clearTimeout(LT._talkTimer);
    if (!LT.together || !LT.playing) { LT._talkTimer = null; return; }
    var delay = 45 + Math.random() * 65; // 45~110 秒
    LT._talkTimer = setTimeout(function () {
      if (!LT.together || !LT.playing) { _scheduleTalk(); return; }
      _partnerAction();
      _scheduleTalk();
    }, delay * 1000);
  }

  function _stopTalkScheduler() {
    if (LT._talkTimer) { clearTimeout(LT._talkTimer); LT._talkTimer = null; }
  }

  // 角色主动动作：暂停 / 切歌 / 恢复播放 / 点评（整体低频，静默率 40%）
  function _partnerAction() {
    var r = Math.random();
    // 每次调度并不必触发动作：40% 静默，保证主动动作整体低频
    if (r >= 0.60) { LT._lastAction = 'idle'; return; }
    // 动作区间分配：暂停16% / 切歌14% / 恢复播放14% / 点评16%
    if (r < 0.16) {
      // 暂停（需正在播放）
      if (LT.audio && !LT.audio.paused && LT.audio.src) {
        LT._lastAction = 'pause';
        _partnerSay(pick(PAUSE_TEXTS));
        LT.audio.pause(); LT.playing = false; renderPlayBtn();
        return;
      }
    } else if (r < 0.30) {
      // 切歌（需歌单多于 1 首）
      if (LT.queue.length > 1) {
        LT._lastAction = 'skip';
        _partnerSay(pick(SKIP_TEXTS));
        var audio = LT.audio;
        if (audio && audio.src) {
          var nxt = (LT.index + 1 >= LT.queue.length) ? 0 : LT.index + 1;
          ltPlay(nxt);
        }
        return;
      }
    } else if (r < 0.44) {
      // 恢复播放（需暂停中且有歌）
      var audio2 = LT.audio;
      if (audio2 && audio2.paused && audio2.src) {
        LT._lastAction = 'resume';
        _partnerSay(pick(RESUME_TEXTS));
        var p = audio2.play();
        if (p && p.catch) p.catch(function () {});
        LT.playing = true; renderPlayBtn();
        return;
      }
    } else {
      // 点评（无前置条件）
      LT._lastAction = 'praise';
      _partnerSay(pick(PRAISE_TEXTS));
      return;
    }
    // 动作前置不满足 → 静默不发，同样保持低频
    LT._lastAction = 'idle';
  }

  /* ---------- 聊天注入（对方发言） ---------- */
  var _lastSayAt = 0;
  function _partnerSay(text, force) {
    if (!LT._chatId) return;
    var now = Date.now();
    if (!force && now - _lastSayAt < 6000) return; // 消息冷却，避免刷屏
    _lastSayAt = now;
    try {
      var chatId = String(LT._chatId);
      var msgs = Storage.getMessages(chatId) || [];
      var newMsg = {
        id: Date.now() + Math.floor(Math.random() * 100),
        type: 'other',
        text: text,
        time: Date.now(),
        msgType: 'text'
      };
      msgs.push(newMsg);
      Storage.setMessages(chatId, msgs);
      if (typeof updateLastMsg === 'function') updateLastMsg(chatId, text);
      if (typeof _safeAppendMessage === 'function') _safeAppendMessage(chatId, newMsg);
      else if (typeof appendMessage === 'function') appendMessage(chatId, newMsg);
      if (typeof App !== 'undefined' && App.playSound) { try { App.playSound('receive'); } catch (e) {} }
      if (typeof showBackgroundPush === 'function') { try { showBackgroundPush(text); } catch (e) {} }
    } catch (e) {
      // 注入失败不影响音乐播放
    }
  }

  /* ---------- 语料 ---------- */
  var OPEN_TEXTS = [
    '来啦来啦，一起听歌呀～',
    '陪你听歌，比歌本身还开心～',
    '这个歌单，我想和你一首一首听过去',
    '音乐响起来，想你的心思也藏不住了',
  ];
  var SKIP_TEXTS = [
    '这首听腻了，换一首吧～',
    '这首歌不对味，切掉切掉！',
    '哼，我想听点别的，切歌啦',
    '这首不够甜，换首更配我们的',
    '现在这个氛围，我想换首歌',
  ];
  var PAUSE_TEXTS = [
    '先暂停一下，我想跟你说句话～',
    '停！让我缓一下，这首太戳我了',
    '暂停一下下，耳朵想休息会儿～',
    '等等，我想仔细听你说话',
    '先别放啦，我想安静待一会儿',
  ];
  var PRAISE_TEXTS = [
    '这首歌……好像有点好听诶',
    '歌词写得真戳我',
    '这旋律让我想起你了',
    '果然我们的审美一致',
    '这首我偷偷收藏了嘿嘿',
  ];
  var RESUME_TEXTS = [
    '我回来啦，继续听吧～',
    '好了好了，快接着放歌',
    '刚走开一下下，继续～',
    '别停呀，我还想听这首',
  ];
  var USER_PAUSE_TEXTS = [
    '怎么暂停了，还没听够呢',
    '这首歌你不喜欢吗？',
    '那……先不听了，陪你说话',
    '你暂停，是不是有话想跟我说',
  ];
  var USER_SKIP_TEXTS = [
    '好呀好呀，这首更好听',
    '你怎么知道我正想切这首',
    '这首我超爱！',
    '切歌的动作好默契',
  ];
  var AUTO_NEXT_TEXTS = [
    '这首放完了，下一首也很配我们',
    '自动续上啦，继续听',
    '下一首，我猜你也会喜欢',
  ];

  /* ---------- 搜索 ---------- */
  window.ltSearch = function () {
    var inp = $('lt-search-input');
    var q = inp ? inp.value.trim() : '';
    if (!q) { inp && inp.focus(); return; }
    if (!LT.serviceOk) { setServiceText('请先启动音乐服务再搜索', 'warn'); return; }
    fetch(LT.SERVICE + '/search?q=' + encodeURIComponent(q) + '&limit=20')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok || !d.songs) { setServiceText('搜索失败', 'warn'); return; }
        var songs = d.songs.map(function (s) {
          return { id: s.id, name: s.name, artist: s.artist, cover: s.cover, duration: s.duration };
        });
        LT.searchList = songs;
        renderSearchList(songs);
        setServiceText('搜索到 ' + songs.length + ' 首，点击「+」加入并播放');
      })
      .catch(function () { setServiceText('网络错误：搜索失败', 'warn'); });
  };

  function renderSearchList(songs) {
    var box = $('lt-search-list');
    if (!box) return;
    if (!songs.length) { box.innerHTML = '<div class="lt-empty" style="display:block">没有搜到相关歌曲</div>'; return; }
    var html = '';
    for (var i = 0; i < songs.length; i++) {
      var s = songs[i];
      html += '<div class="lt-song-item" onclick="ltAddFromSearch(' + i + ')">' +
        '<span class="lt-song-idx"><i class="fas fa-plus"></i></span>' +
        '<div class="lt-song-main">' +
        '<div class="lt-song-name">' + esc(s.name) + '</div>' +
        '<div class="lt-song-artist">' + esc(s.artist) + '</div>' +
        '</div>' +
        '<span class="lt-song-dur">' + fmtDur(s.duration) + '</span>' +
        '</div>';
    }
    box.innerHTML = html;
  }

  /** 搜索结果点「+」：加入当前队列并立即播放（进入播放界面） */
  window.ltAddFromSearch = function (idx) {
    var s = LT.searchList && LT.searchList[idx];
    if (!s) return;
    LT.queue.push(s);
    ltPlay(LT.queue.length - 1);
    renderQueue();
    ltShowView('player');
    // 切回我的歌单页签以显示队列
    ltSwitchTab('pl');
  };

  // 深链：URL 带 #lt 时自动打开「一起听歌」面板（刷新后保持弹窗 / 便于直达）
  var _m = location.hash.match(/#lt(?:=([a-z]+))?/);
  if (_m) {
    setTimeout(function () {
      openListenTogetherPanel();
      if (_m[1] === 'player') ltShowView('player');
    }, 450);
  }
})();
