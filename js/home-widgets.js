/* ==== home-widgets.js ==== */
/* ===== 拾心界 - 首页功能小组件（纪念日 / 音乐播放器联动） ===== */
/* 纪念日数据使用项目现有 Storage（localStorage + IndexedDB 双写）持久化 */

const AnniversaryWidget = {
  STORAGE_KEY: 'anniversaries',
  _editingId: null,

  /* ========== 数据存取 ========== */
  getList() {
    const list = Storage.get(this.STORAGE_KEY, []);
    return Array.isArray(list) ? list : [];
  },

  saveList(list) {
    Storage.set(this.STORAGE_KEY, list);
  },

  /* ========== 日期工具 ========== */
  // 返回 { label, days }：今天 / 昨天 / 明天 / X天后 / X天前
  calcDays(dateStr) {
    const parts = String(dateStr || '').split('-');
    if (parts.length !== 3) return { label: '', days: 0 };
    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(target.getTime())) return { label: '', days: 0 };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return { label: '今天', days: 0 };
    if (diff === 1) return { label: '明天', days: 1 };
    if (diff === -1) return { label: '昨天', days: -1 };
    if (diff > 1) return { label: diff + '天后', days: diff };
    return { label: (-diff) + '天前', days: diff };
  },

  // '2026-08-24' -> '2026.08.24'
  formatDate(dateStr) {
    const parts = String(dateStr || '').split('-');
    if (parts.length !== 3) return dateStr || '';
    return parts[0] + '.' + parts[1] + '.' + parts[2];
  },

  /* ========== 首页小组件渲染 ========== */
  render() {
    const listEl = document.getElementById('home-anniv-list');
    if (!listEl) return;
    const list = this.getList();
    if (!list.length) {
      listEl.innerHTML = '<div class="home-anniv-empty">还没有纪念日<br>点击添加你们的重要日子</div>';
      return;
    }
    // 小组件默认展示最近 3 条
    const shown = list.slice(0, 3);
    let html = '';
    shown.forEach((item) => {
      const daysInfo = this.calcDays(item.date);
      const todayCls = daysInfo.days === 0 ? ' today' : '';
      let numHtml = '';
      if (daysInfo.days === 0) {
        numHtml = '<span class="home-anniv-num-text">今天</span>';
      } else {
        numHtml = Math.abs(daysInfo.days) + '<span class="home-anniv-num-unit">' + (daysInfo.days > 0 ? '天后' : '天前') + '</span>';
      }
      html += `
        <div class="home-anniv-item">
          <div class="home-anniv-num${todayCls}">${numHtml}</div>
          <div class="home-anniv-item-body">
            <div class="home-anniv-item-name">${Core.escapeHtml(item.name || '未命名纪念日')}</div>
            <div class="home-anniv-item-date">${this.formatDate(item.date)}</div>
          </div>
        </div>`;
    });
    if (list.length > 3) {
      html += '<div class="home-anniv-more">共 ' + list.length + ' 个纪念日，点击管理</div>';
    }
    listEl.innerHTML = html;
  },

  /* ========== 管理弹窗 ========== */
  openManager() {
    const overlay = document.getElementById('anniv-modal-overlay');
    if (!overlay) return;
    this.renderManagerList();
    overlay.classList.add('active');
  },

  closeManager() {
    const overlay = document.getElementById('anniv-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  renderManagerList() {
    const listEl = document.getElementById('anniv-modal-list');
    if (!listEl) return;
    const list = this.getList();
    if (!list.length) {
      listEl.innerHTML = '<div class="anniv-modal-empty">暂无纪念日<br>点击右上角「添加」记录第一个重要日子吧</div>';
      return;
    }
    let html = '';
    list.forEach((item) => {
      const daysInfo = this.calcDays(item.date);
      const todayCls = daysInfo.days === 0 ? ' today' : '';
      html += `
        <div class="anniv-modal-item" data-id="${item.id}">
          <div class="home-anniv-item-body">
            <div class="home-anniv-item-name">${Core.escapeHtml(item.name || '未命名纪念日')}</div>
            <div class="home-anniv-item-date">${this.formatDate(item.date)}</div>
          </div>
          <span class="anniv-modal-item-days${todayCls}">${daysInfo.label}</span>
          <div class="anniv-modal-ops">
            <button class="anniv-modal-op" onclick="AnniversaryWidget.openForm(${item.id})" title="编辑"><i class="fas fa-pen"></i></button>
            <button class="anniv-modal-op del" onclick="AnniversaryWidget.deleteItem(${item.id})" title="删除"><i class="fas fa-trash-can"></i></button>
          </div>
        </div>`;
    });
    listEl.innerHTML = html;
  },

  /* ========== 添加 / 编辑 ========== */
  openForm(id) {
    this._editingId = id || null;
    const overlay = document.getElementById('anniv-form-overlay');
    const titleEl = document.getElementById('anniv-form-title');
    const nameEl = document.getElementById('anniv-form-name');
    const dateEl = document.getElementById('anniv-form-date');
    if (!overlay || !nameEl || !dateEl) return;

    if (this._editingId !== null) {
      const item = this.getList().find((it) => it.id === this._editingId);
      if (item) {
        titleEl.textContent = '编辑纪念日';
        nameEl.value = item.name || '';
        dateEl.value = item.date || '';
      }
    } else {
      titleEl.textContent = '添加纪念日';
      nameEl.value = '';
      dateEl.value = '';
    }
    overlay.classList.add('active');
    setTimeout(() => { try { nameEl.focus(); } catch (e) {} }, 60);
  },

  closeForm() {
    const overlay = document.getElementById('anniv-form-overlay');
    if (overlay) overlay.classList.remove('active');
    this._editingId = null;
  },

  saveForm() {
    const nameEl = document.getElementById('anniv-form-name');
    const dateEl = document.getElementById('anniv-form-date');
    if (!nameEl || !dateEl) return;
    const name = String(nameEl.value || '').trim();
    const date = String(dateEl.value || '').trim();
    if (!name) {
      if (window.Core) Core.toast('请输入纪念日名称');
      return;
    }
    if (!date) {
      if (window.Core) Core.toast('请选择纪念日日期');
      return;
    }

    const list = this.getList();
    if (this._editingId !== null) {
      const item = list.find((it) => it.id === this._editingId);
      if (item) {
        item.name = name;
        item.date = date;
      }
      if (window.Core) Core.toast('纪念日已更新');
    } else {
      list.push({ id: Date.now(), name: name, date: date, createdAt: Date.now() });
      if (window.Core) Core.toast('纪念日已添加');
    }
    this.saveList(list);
    this.closeForm();
    this.render();
    this.renderManagerList();
  },

  /* ========== 删除 ========== */
  deleteItem(id) {
    const item = this.getList().find((it) => it.id === id);
    const name = item ? (item.name || '这个纪念日') : '这个纪念日';
    if (window.Core && Core.confirm) {
      Core.confirm('删除纪念日', '确定删除「' + name + '」吗？', () => {
        const list = this.getList().filter((it) => it.id !== id);
        this.saveList(list);
        if (window.Core) Core.toast('已删除');
        this.render();
        this.renderManagerList();
      });
    } else {
      const list = this.getList().filter((it) => it.id !== id);
      this.saveList(list);
      this.render();
      this.renderManagerList();
    }
  }
};

window.AnniversaryWidget = AnniversaryWidget;

/* 页面加载完成后初始渲染（若首页已激活） */
document.addEventListener('DOMContentLoaded', () => {
  AnniversaryWidget.render();
});
