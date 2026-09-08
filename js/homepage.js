const HomePage = {
  partnerOffset: 0,       // 对方时间偏移（小时）
  heartbeatState: 'connecting', // connecting | connected | disconnected
  swipePage: 0,
  swipeTotal: 1,
  swipeStartX: 0,
  swipeStartY: 0,
  swipeMoved: false,
  timeTimer: null,
  heartbeatTimer: null,
  heartbeatCycleTimer: null,

  init() {
    this._initTime();
    this._initHeartbeat();
    // 首页功能已改造为小组件布局，不再使用横向滑动（保留 _initSwipe 定义以兼容旧结构）
  },

  /* ========== 双时区 ========== */
  _initTime() {
    const partnerCard = document.getElementById('partner-time-card');
    if (partnerCard) {
      partnerCard.addEventListener('click', () => this._adjustPartnerTime());
    }
    // 梦角时间：进入网站时确定一个起始时间（首次进入默认当前时间），之后按真实时间持续走动
    if (!Storage.getDreamTime()) {
      const now = new Date();
      Storage.setDreamTime({
        start: now.getTime(),
        base: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      });
    }
    // 填充梦角时间选择器选项
    const hourPicker = document.getElementById('dream-hour-picker');
    if (hourPicker && !hourPicker.options.length) {
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = String(h).padStart(2,'0') + '时';
        hourPicker.appendChild(opt);
      }
    }
    const minutePicker = document.getElementById('dream-minute-picker');
    if (minutePicker && !minutePicker.options.length) {
      for (let m = 0; m < 60; m += 5) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = String(m).padStart(2,'0') + '分';
        minutePicker.appendChild(opt);
      }
    }
    this._updateClocks();
    this.timeTimer = setInterval(() => this._updateClocks(), 30000); // 性能优化第一批：时钟仅显示 HH:MM，1s->30s
  },

  _updateClocks() {
    const now = new Date();
    // 系统时间
    const myEl = document.getElementById('my-time');
    if (myEl) {
      myEl.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }
    // 梦角时间：以进入时的固定时间为起点，按真实流逝继续往后走
    const partnerEl = document.getElementById('partner-time');
    if (partnerEl) {
      partnerEl.textContent = this._calcDreamTime();
    }
  },

  _calcDreamTime() {
    const dream = Storage.getDreamTime();
    if (!dream) return '00:00';
    const startTs = Number(dream.start) || Date.now();
    const baseParts = String(dream.base || '00:00').split(':');
    const baseMin = (parseInt(baseParts[0], 10) || 0) * 60 + (parseInt(baseParts[1], 10) || 0);
    const elapsedMin = Math.floor((Date.now() - startTs) / 1000 / 60);
    const total = (baseMin + elapsedMin) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  },

  _adjustPartnerTime() {
    // 允许调整梦角时间：弹出时/分选择器，选择后以新时间作为起点继续走动
    const dream = Storage.getDreamTime() || { start: Date.now(), base: '00:00' };
    const baseParts = String(dream.base || '00:00').split(':');
    const curH = parseInt(baseParts[0], 10) || 0;
    const curM = parseInt(baseParts[1], 10) || 0;

    const hourOptions = [];
    for (let h = 0; h < 24; h++) hourOptions.push({ label: String(h).padStart(2,'0') + '时', value: h });
    const minuteOptions = [];
    for (let m = 0; m < 60; m += 5) minuteOptions.push({ label: String(m).padStart(2,'0') + '分', value: m });

    const hourPicker = document.getElementById('dream-hour-picker');
    const minutePicker = document.getElementById('dream-minute-picker');
    if (hourPicker) hourPicker.value = curH;
    if (minutePicker) minutePicker.value = Math.floor(curM / 5) * 5;

    const overlay = document.getElementById('dream-time-overlay');
    if (overlay) {
      overlay.classList.add('active');
      const okBtn = document.getElementById('dream-time-ok');
      if (okBtn) {
        okBtn.onclick = () => {
          const h = parseInt(hourPicker ? hourPicker.value : 0, 10) || 0;
          const m = parseInt(minutePicker ? minutePicker.value : 0, 10) || 0;
          Storage.setDreamTime({
            start: Date.now(),
            base: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
          });
          this._updateClocks();
          overlay.classList.remove('active');
          Core.toast('梦角时间已调整');
        };
      }
      const cancelBtn = document.getElementById('dream-time-cancel');
      if (cancelBtn) {
        cancelBtn.onclick = () => { overlay.classList.remove('active'); };
      }
    }
  },

  /* ========== 心跳时间线 ========== */
  _initHeartbeat() {
    // 模拟连接流程：连接中 → 已连接 → 偶尔断开重连
    this._setHeartbeat('connecting', '连接中');
    this.heartbeatCycleTimer = setTimeout(() => {
      this._setHeartbeat('connected', '已连接');
      this._startHeartbeatCycle();
    }, 3000);
  },

  _startHeartbeatCycle() {
    this.heartbeatTimer = setInterval(() => {
      if (this.heartbeatState === 'connected') {
        // 10% 概率短暂断开
        if (Math.random() < 0.10) {
          this._setHeartbeat('disconnected', '连接断开');
          setTimeout(() => {
            this._setHeartbeat('connecting', '重新连接中');
            setTimeout(() => {
              this._setHeartbeat('connected', '已连接');
            }, 2500);
          }, 2000);
        }
      }
    }, 15000);
  },

  _setHeartbeat(state, label) {
    this.heartbeatState = state;
    const bar = document.getElementById('heartbeat-bar');
    const lbl = document.getElementById('heartbeat-label');
    if (bar) {
      bar.className = 'heartbeat-bar ' + state;
    }
    if (lbl) {
      lbl.textContent = '\u2665\uFE0E ' + label + ' \u2665\uFE0E';
      lbl.className = 'heartbeat-label ' + state;
    }
  },

  /* ========== 应用滑动 ========== */
  _initSwipe() {
    const wrapper = document.getElementById('app-swipe-wrapper');
    if (!wrapper) return;
    wrapper.addEventListener('touchstart', (e) => this._onSwipeStart(e), {passive: false});
    wrapper.addEventListener('touchmove', (e) => this._onSwipeMove(e), {passive: false});
    wrapper.addEventListener('touchend', (e) => this._onSwipeEnd(e), {passive: false});
  },

  _onSwipeStart(e) {
    this.swipeStartX = e.touches[0].clientX;
    this.swipeStartY = e.touches[0].clientY;
    this.swipeMoved = false;
  },

  _onSwipeMove(e) {
    const dx = e.touches[0].clientX - this.swipeStartX;
    const dy = e.touches[0].clientY - this.swipeStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      e.preventDefault();
      this.swipeMoved = true;
      const track = document.getElementById('app-swipe-track');
      if (track) {
        const offset = -this.swipePage * 100 + (dx / track.parentElement.offsetWidth) * 100;
        track.style.transition = 'none';
        track.style.transform = `translateX(${offset}%)`;
      }
    }
  },

  _onSwipeEnd(e) {
    if (!this.swipeMoved) return;
    const dx = e.changedTouches[0].clientX - this.swipeStartX;
    const track = document.getElementById('app-swipe-track');
    if (track) track.style.transition = '';
    if (dx < -50 && this.swipePage < this.swipeTotal - 1) {
      this._swipeTo(this.swipePage + 1);
    } else if (dx > 50 && this.swipePage > 0) {
      this._swipeTo(this.swipePage - 1);
    } else {
      this._swipeTo(this.swipePage); // 回弹
    }
  },

  _swipeTo(page) {
    this.swipePage = page;
    const track = document.getElementById('app-swipe-track');
    if (track) {
      track.style.transform = `translateX(${-page * 100}%)`;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  HomePage.init();
});
