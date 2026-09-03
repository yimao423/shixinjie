/* ==== core.js ==== */
/* ===== 拾心界 - 核心功能模块 ===== */

const Core = {
  /* === 工具函数 === */
  
  // 获取 DOM 元素
  $(selector) {
    return document.querySelector(selector);
  },
  
  $$(selector) {
    return document.querySelectorAll(selector);
  },
  
  // HTML 转义
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  
  // Toast 提示
  toast(msg, duration = 2000) {
    let t = this.$('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), duration);
  },
  
  // 确认对话框
  confirm(title, message, onConfirm, onCancel) {
    let overlay = this.$('.confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3></h3>
          <p></p>
          <div class="btn-row">
            <button class="btn-cancel">取消</button>
            <button class="btn-confirm">确认</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    overlay.classList.add('active');
    
    const cleanup = () => {
      overlay.classList.remove('active');
      overlay.querySelector('.btn-cancel').onclick = null;
      overlay.querySelector('.btn-confirm').onclick = null;
    };
    
    overlay.querySelector('.btn-cancel').onclick = () => {
      cleanup();
      if (onCancel) onCancel();
    };
    
    overlay.querySelector('.btn-confirm').onclick = () => {
      cleanup();
      if (onConfirm) onConfirm();
    };
    
    // 点击遮罩关闭
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        if (onCancel) onCancel();
      }
    };
  },
  
  // 危险确认（红色按钮）
  dangerConfirm(title, message, onConfirm) {
    let overlay = this.$('.confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3></h3>
          <p></p>
          <div class="btn-row">
            <button class="btn-cancel">取消</button>
            <button class="btn-confirm btn-danger">确认</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.btn-confirm').className = 'btn-confirm btn-danger';
    }
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    overlay.classList.add('active');
    
    const cleanup = () => {
      overlay.classList.remove('active');
      overlay.querySelector('.btn-cancel').onclick = null;
      overlay.querySelector('.btn-confirm').onclick = null;
    };
    
    overlay.querySelector('.btn-cancel').onclick = cleanup;
    overlay.querySelector('.btn-confirm').onclick = () => {
      cleanup();
      if (onConfirm) onConfirm();
    };
  },
  
  // 格式化时间
  formatTime(date) {
    const d = new Date(date);
    const now = new Date();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    if (d.toDateString() === now.toDateString()) {
      return `${h}:${m}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `昨天 ${h}:${m}`;
    }
    return `${d.getMonth()+1}/${d.getDate()} ${h}:${m}`;
  },
  
  // 格式化完整日期
  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
  },
  
  // 生成随机颜色（用于头像）
  avatarColor(str) {
    let hash = 0;
    for (let i = 0; i < (str || '?').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#A8D8EA', '#D8C8F0', '#F0A0A0', '#A0D8C8',
      '#F0C878', '#A8C8F0', '#E0A8C8', '#98D8A0',
      '#D8A8B8', '#88C8D8', '#C0C8E0', '#D8C8A0'
    ];
    return colors[Math.abs(hash) % colors.length];
  },
  
  // 获取当前时间字符串
  getTimeStr() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  },
  
  // 节流
  throttle(fn, delay) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  },
  
  // 防抖
  debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 表单弹窗（替代原生 prompt，玻璃拟态样式）
  // fields: [{label, placeholder, value}]，onConfirm(fieldValues) 返回字段值数组
  formModal(title, fields, onConfirm, onCancel) {
    const existing = this.$('.form-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'form-modal-overlay';
    let fieldsHtml = fields.map(function(f, i) {
      return '<div class="form-modal-field">'
        + '<label>' + Core.escapeHtml(f.label) + '</label>'
        + '<input type="text" class="form-modal-input" data-index="' + i + '"'
        + ' placeholder="' + (f.placeholder ? Core.escapeHtml(f.placeholder) : '') + '"'
        + ' value="' + (f.value ? Core.escapeHtml(f.value) : '') + '">'
        + '</div>';
    }).join('');

    overlay.innerHTML = '<div class="form-modal-panel">'
      + '<h3 class="form-modal-title">' + Core.escapeHtml(title) + '</h3>'
      + fieldsHtml
      + '<div class="form-modal-actions">'
      + '<button class="form-modal-cancel">取消</button>'
      + '<button class="form-modal-confirm">确认</button>'
      + '</div></div>';

    document.body.appendChild(overlay);

    const panel = overlay.querySelector('.form-modal-panel');
    const inputs = overlay.querySelectorAll('.form-modal-input');
    const cancelBtn = overlay.querySelector('.form-modal-cancel');
    const confirmBtn = overlay.querySelector('.form-modal-confirm');

    const cleanup = function() {
      overlay.classList.remove('active');
      setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 250);
    };

    cancelBtn.onclick = function() {
      cleanup();
      if (onCancel) onCancel();
    };

    confirmBtn.onclick = function() {
      var values = [];
      inputs.forEach(function(inp) { values.push(inp.value.trim()); });
      cleanup();
      if (onConfirm) onConfirm(values);
    };

    overlay.onclick = function(e) {
      if (e.target === overlay) {
        cleanup();
        if (onCancel) onCancel();
      }
    };

    // 回车提交
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { confirmBtn.click(); }
    });

    // 入场动画
    requestAnimationFrame(function() {
      overlay.classList.add('active');
      if (inputs.length > 0) {
        inputs[0].focus();
        inputs[0].select();
      }
    });

    return overlay;
  }
};

window.Core = Core;


