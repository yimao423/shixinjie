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
    // 移动端软键盘适配：全屏聊天页高度改由 --chat-h（= visualViewport.height 可视区高度）单值驱动。
    // 相比旧的"innerHeight - visualViewport.height 差值"方案，消除了键盘弹出过程中
    // innerHeight 与 vv.height 在 rAF 合并窗口内更新不同步导致的 --kbd 瞬时错值 / 页面高度抖动
    // （即"时好时坏 / 卡死不动"的根源）。两种引擎下 --chat-h 均单调、稳定地跟随可视区：
    //  - resizes-content：布局视口随键盘自动收缩，innerHeight == vv.height == 可视高，页面高度 = vv.height 正确
    //  - resizes-visual ：布局视口不收缩，vv.height 仍精确反映扣掉键盘后的可视区，页面高度 = vv.height 正确
    // --kbd 保留为向后兼容：仅在高阈值确认为软键盘时写入差值（地址栏收起的小幅变化一律归零，避免误压扁），
    // 供旧布局 calc(100% - var(--kbd)) 回退使用，并继续承担"键盘弹出时根滚动归零"的职责。
    if (window.visualViewport) {
      var _kbdRaf = 0;
      function _syncKbd() {
        if (_kbdRaf) return;
        _kbdRaf = requestAnimationFrame(function () {
          _kbdRaf = 0;
          var vv = window.visualViewport;
          var ih = window.innerHeight || document.documentElement.clientHeight;
          var vvH = vv ? vv.height : 0;
          // 单值驱动：页面可视高度 = visualViewport 高度。桌面无键盘时 vv.height == 布局视口高，保持全高无回归。
          if (vvH > 0) {
            document.documentElement.style.setProperty('--chat-h', Math.round(vvH) + 'px');
          }
          // 向后兼容 --kbd：仅在确认为软键盘（差值达阈值且比例达标，或 vv.type 明确 virtual-keyboard）时写入，
          // 竞态中间态（diff 未达阈值）写 0——此时页面高度由 --chat-h 精确控制，不影响最终布局。
          var kbd = 0;
          if (ih && vvH && vvH < ih) {
            var diff = ih - vvH;
            var kind = (vv && vv.type) || '';
            // visualViewport.type === 'virtual-keyboard' 为规范可选信号（新版 Chromium），仅作加分确认
            if (kind === 'virtual-keyboard' || (diff >= 120 && diff / ih >= 0.15)) {
              kbd = Math.round(diff);
            }
          }
          document.documentElement.style.setProperty('--kbd', kbd + 'px');
          if (kbd > 0 && window.scrollY > 0) {
            window.scrollTo(0, 0);
          }
        });
      }
      window.visualViewport.addEventListener('resize', _syncKbd);
      window.visualViewport.addEventListener('scroll', _syncKbd);
      window.addEventListener('resize', _syncKbd);
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

