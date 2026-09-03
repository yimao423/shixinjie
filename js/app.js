/* ==== app.js ==== */
/* ===== 拾心界 - 主应用逻辑 ===== */

const App = {
  init() {
    ThemeManager.init();
    if (window.IconZones) IconZones.init();
    Storage.setFontSize(Storage.getFontSize());
    // 全局字体：应用启动即恢复已保存的字体
    if (window.FontManager) FontManager.restore();
    this.initSplash();
    Navigation.init();
    JournalCard.render();
    // 移动端软键盘适配：部分移动浏览器（如 Edge Android/G100）键盘弹出时采用
    // resizes-visual（dvh 不随键盘收缩），导致页面底部输入栏被键盘遮挡、顶部露出空白。
    // 这里监听 visualViewport 计算键盘高度写入 CSS 变量 --kbd，全屏聊天页据此收紧自身高度，
    // 保证输入栏始终紧贴键盘；同时把键盘弹出时的根滚动归零，防止内容整体顶出可视区。
    if (window.visualViewport) {
      var _kbdRaf = 0;
      function _syncKbd() {
        if (_kbdRaf) return;
        _kbdRaf = requestAnimationFrame(function () {
          _kbdRaf = 0;
          var kbd = Math.max(0, window.innerHeight - window.visualViewport.height);
          document.documentElement.style.setProperty('--kbd', kbd + 'px');
          if (kbd > 0 && window.scrollY > 0) {
            window.scrollTo(0, 0);
          }
        });
      }
      window.visualViewport.addEventListener('resize', _syncKbd);
      window.visualViewport.addEventListener('scroll', _syncKbd);
      _syncKbd();
    }
    // 全站来电：应用启动即启动"允许对方主动拨打"定时器（不限于聊天界面）
    startSimulateCallTimer();
    // 全站主动发送：应用启动即启动（不限于聊天界面），保证到点必发
    if (Storage.getProactiveSend()) {
      startProactiveTimer();
    }
    // 时空信箱：全站定时调度（对方主动来信 / 回信到点自动送达，不限于信箱页面）
    if (window.MailboxApp && typeof MailboxApp.startScheduler === 'function') {
      MailboxApp.startScheduler();
    }
    // 行踪汇报：全站定时调度（对方按设置自动汇报行踪，不限于行踪汇报页）
    if (window.startWhereaboutScheduler) {
      startWhereaboutScheduler();
    }
    // 对方自主行为驱动器：全站时间驱动（他的收藏 / 朋友圈对方动态按时间自然产生，不绑定页面访问）
    if (window.PartnerFreeWill && typeof PartnerFreeWill.start === 'function') {
      PartnerFreeWill.start();
    }
    // 后台保活：若已开启则播放静音音频（无手势时等用户首次点击后恢复）
    if (Storage.getBackgroundKeepAlive()) {
      startKeepAliveAudio();
    }
    // 低电量模式（性能优化第一批）：移动端 + 电量≤20% 且未充电时启用毛玻璃降级，默认不触发，UI 不变
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.getBattery) {
      navigator.getBattery().then(function(b) {
        if (b && b.level <= 0.2 && !b.charging) document.documentElement.classList.add('energy-saver');
      }).catch(function() {});
    }
  },
  
  /* === 欢迎页 === */
  initSplash() {
    const progress = document.getElementById('splash-progress');
    const progressDot = document.getElementById('splash-progress-dot');
    const splash = document.getElementById('splash-screen');
    const app = document.getElementById('app');
    
    if (!progress || !splash || !app) return;
    
    let val = 0;
    const interval = setInterval(() => {
      val += 2;
      if (val > 100) val = 100;
      progress.style.width = val + '%';
      if (progressDot) progressDot.style.left = val + '%';
      
      if (val >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          splash.classList.add('fade-out');
          app.classList.add('active');
          
          setTimeout(() => {
            splash.style.display = 'none';
          }, 700);
        }, 300);
      }
    }, 30);
  },
  
  /* === 播放提示音 === */
  playSound(type) {
    // 根据音效设置播放：接收/发送各自使用用户选择的音效（内置或自定义上传）
    try {
      if (!Storage.getSoundEnabled()) return;
      var soundId = type === 'receive' ? Storage.getReceiveSound() : Storage.getSendSound();
      if (!soundId) soundId = 'msg';

      // 自定义上传音效：从 IndexedDB 读取后播放
      if (soundId.indexOf('custom_') === 0) {
        var vol = Math.max(0, Math.min(1, (Storage.getSoundVolume() || 80) / 100));
        var playCustom = function(data) {
          if (!data) return;
          var audio = new Audio(data);
          audio.volume = vol;
          audio.play().catch(function() {});
        };
        if (window.SoundFileDB) {
          SoundFileDB.get(soundId).then(function(data) {
            if (data) { playCustom(data); return; }
            var legacy = Storage.getCustomSounds().filter(function(s) { return s.id === soundId; })[0];
            if (legacy && legacy.data) playCustom(legacy.data);
          }).catch(function() {});
        } else {
          var legacy2 = Storage.getCustomSounds().filter(function(s) { return s.id === soundId; })[0];
          if (legacy2 && legacy2.data) playCustom(legacy2.data);
        }
        return;
      }

      // 内置音效：复用音效合成器（与预览一致）
      if (typeof previewSound === 'function') {
        previewSound(soundId);
      }
    } catch(e) {}
  }
};

