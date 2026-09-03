/* ==== navigation.js ==== */
/* ===== 拾心界 - 页面导航管理 ===== */

const Navigation = {
  currentPage: 'chat-list',
  pageStack: [],
  
  // 页面列表
  pages: ['home', 'chat-list', 'chat-room', 'wordcard', 'wordcard-quotes', 'wordcard-main', 'wordcard-main-group', 'wordcard-sub-main', 'wordcard-sub-group', 'wordcard-voice', 'wordcard-voice-group', 'wordcard-kaomoji', 'wordcard-kaomoji-group', 'wordcard-pat', 'wordcard-pat-group', 'wordcard-emoji', 'wordcard-emoji-group', 'wordcard-stickers', 'wordcard-stickers-group', 'wordcard-daily-quotes', 'wordcard-quote-lib', 'wordcard-lib', 'wordcard-face-lib', 'discover', 'favorites', 'his-favorites', 'moments', 'moments-publish', 'moments-visitors', 'mailbox', 'write-letter', 'mailbox-reply', 'mailbox-detail', 'mailbox-settings', 'whereabout-settings', 'daily-record', 'whereabouts', 'whereabout-group', 'whereabout-reports', 'settings', 'account-settings', 'appearance', 'chat-settings', 'feature-settings', 'pace-settings', 'sound-settings', 'data-manage', 'about', 'period', 'shop', 'shop-cart', 'love-diary', 'love-test', 'bookshelf', 'recipe', 'bubble-shop', 'mini-games', 'game-sheep', 'game-goose', 'game-llk', 'game-2048', 'game-memory'],
  
  init() {
    // 初始导航：移除 HTML 中预设的 active 类，切换到初始页面
    document.querySelectorAll('.page.active').forEach(p => p.classList.remove('active'));
    this._navigateTo('home');
    this._updateNav('home');
  },
  
  // 切换底部 Tab 页面
  switchTab(page) {
    this.pageStack = [];
    this._navigateTo(page);
    this._updateNav(page);
  },
  
  // 内部导航（带栈记录）
  navigateTo(page) {
    this.pageStack.push(this.currentPage);
    this._navigateTo(page);
  },
  
  // 返回上一页
  goBack() {
    if (this.pageStack.length > 0) {
      const prev = this.pageStack.pop();
      this._navigateTo(prev, 'slide-left');
    } else {
      this.switchTab('home');
    }
  },
  
  // 执行页面切换
  _navigateTo(page, reverseAnim = '') {
    // 切换页面时兜底关闭涂鸦遮罩，避免遮罩残留挡住界面
    if (typeof closeDoodlePanel === 'function') { try { closeDoodlePanel(); } catch (e) {} }
    // 隐藏当前页
    const currentEl = this._getPageEl(this.currentPage);
    if (currentEl) {
      currentEl.classList.remove('active');
    }
    
    // 显示目标页
    const targetEl = this._getPageEl(page);
    if (targetEl) {
      targetEl.classList.add('active');
      targetEl.scrollTop = 0;
    }
    
    this.currentPage = page;
    
    // 触发页面渲染
    this._renderPage(page);
  },
  
  // 获取页面 DOM
  _getPageEl(page) {
    return document.getElementById('page-' + page);
  },
  
  // 更新底部导航高亮
  _updateNav(page) {
    const tabMap = {
      'home': 'chat',
      'chat-list': 'chat',
      'chat-room': 'chat',
      'wordcard': 'wordcard',
      'wordcard-quotes': 'wordcard',
      'wordcard-main': 'wordcard',
      'wordcard-main-group': 'wordcard',
      'wordcard-sub-main': 'wordcard',
      'wordcard-sub-group': 'wordcard',
      'wordcard-voice': 'wordcard',
      'wordcard-voice-group': 'wordcard',
      'wordcard-kaomoji': 'wordcard',
      'wordcard-kaomoji-group': 'wordcard',
      'wordcard-pat': 'wordcard',
      'wordcard-pat-group': 'wordcard',
      'wordcard-emoji': 'wordcard',
      'wordcard-emoji-group': 'wordcard',
      'wordcard-stickers': 'wordcard',
      'wordcard-stickers-group': 'wordcard',
      'wordcard-daily-quotes': 'wordcard',
      'wordcard-quote-lib': 'wordcard',
      'wordcard-lib': 'wordcard',
      'wordcard-face-lib': 'wordcard',
      'discover': 'discover',
      'favorites': 'discover',
      'his-favorites': 'discover',
      'moments': 'discover',
      'moments-publish': 'discover',
      'moments-visitors': 'discover',
      'mailbox': 'discover',
      'write-letter': 'discover',
      'mailbox-reply': 'discover',
      'mailbox-detail': 'discover',
      'mailbox-settings': 'settings',
      'whereabout-settings': 'settings',
      'daily-record': 'discover',
      'whereabouts': 'wordcard',
      'whereabout-group': 'wordcard',
      'whereabout-reports': 'discover',
      'settings': 'settings',
      'account-settings': 'settings',
      'appearance': 'settings',
      'chat-settings': 'settings',
      'feature-settings': 'settings',
      'pace-settings': 'settings',
      'sound-settings': 'settings',
      'data-manage': 'settings',
      'about': 'settings',
      'period': 'chat',
      'shop': 'chat',
      'shop-cart': 'chat',
      'love-diary': 'chat',
      'love-test': 'chat',
      'bookshelf': 'chat',
      'recipe': 'chat',
      'bubble-shop': 'settings'
    };
    
    const tab = tabMap[page] || 'chat';
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === tab);
    });
  },
  
  // 渲染页面内容
  _renderPage(page) {
    switch (page) {
      case 'home':
        this._renderHome();
        break;
      case 'chat-list':
        this._renderChatList();
        break;
      case 'chat-room':
        break; // 聊天室由 openChatRoom 处理
      case 'wordcard':
        break; // 字卡入口页，纯导航
      case 'wordcard-quote-lib':
        break; // 格言留言聚合页，纯导航
      case 'wordcard-lib':
        break; // 字卡库聚合页，纯导航
      case 'wordcard-face-lib':
        break; // 颜文字表情聚合页，纯导航
      case 'wordcard-quotes':
        window.renderWordCardQuotes && window.renderWordCardQuotes();
        break;
      case 'wordcard-main':
        window.renderWordCardMain && window.renderWordCardMain();
        break;
      case 'wordcard-main-group':
        window.renderWordCardMainGroup && window.renderWordCardMainGroup();
        break;
      case 'wordcard-sub-main':
        window.renderWordCardSubMain && window.renderWordCardSubMain();
        break;
      case 'wordcard-sub-group':
        window.renderWordCardSubGroup && window.renderWordCardSubGroup();
        break;
      case 'wordcard-voice':
        window.renderWordCardVoice && window.renderWordCardVoice();
        break;
      case 'wordcard-voice-group':
        window.renderWordCardVoiceGroup && window.renderWordCardVoiceGroup();
        break;
      case 'wordcard-kaomoji':
        window.renderWordCardKaomoji && window.renderWordCardKaomoji();
        break;
      case 'wordcard-kaomoji-group':
        window.renderWordCardKaomojiGroup && window.renderWordCardKaomojiGroup();
        break;
      case 'wordcard-pat':
        window.renderWordCardPat && window.renderWordCardPat();
        break;
      case 'wordcard-pat-group':
        window.renderWordCardPatGroup && window.renderWordCardPatGroup();
        break;
      case 'wordcard-emoji':
        window.renderWordCardEmoji && window.renderWordCardEmoji();
        break;
      case 'wordcard-emoji-group':
        window.renderWordCardEmojiGroup && window.renderWordCardEmojiGroup();
        break;
      case 'wordcard-stickers':
        window.renderWordCardStickers && window.renderWordCardStickers();
        break;
      case 'wordcard-stickers-group':
        window.renderWordCardStickersGroup && window.renderWordCardStickersGroup();
        break;
      case 'wordcard-daily-quotes':
        window.renderDailyQuotes && window.renderDailyQuotes();
        break;
      case 'discover':
        // 进入发现页只让时间被检查（PartnerFreeWill 幂等：未到期不产生任何新内容）
        if (window.PartnerFreeWill && typeof PartnerFreeWill.checkAndAct === 'function') {
          try { PartnerFreeWill.checkAndAct(); } catch (e) {}
        }
        break;
      case 'favorites':
        window.renderFavorites && window.renderFavorites();
        break;
      case 'his-favorites':
        window.renderHisFavorites && window.renderHisFavorites();
        break;
      case 'moments':
        window.renderMoments && window.renderMoments();
        break;
      case 'moments-publish':
        break; // 朋友圈发布页由 openMomentsPublish 动态渲染
      case 'moments-visitors':
        window.renderMomentsVisitors && window.renderMomentsVisitors();
        break;
      case 'mailbox':
        window.renderMailbox && window.renderMailbox();
        break;
      case 'write-letter':
        break; // 写信界面由 openWriteLetter 动态渲染
      case 'mailbox-reply':
        break; // 回信界面由 openReplyLetter 动态渲染
      case 'mailbox-detail':
        break; // 信件详情由 openMailboxDetail 动态渲染
      case 'mailbox-settings':
        window.renderMailboxSettings && window.renderMailboxSettings();
        break;
      case 'whereabout-settings':
        window.renderWhereaboutSettings && window.renderWhereaboutSettings();
        break;
      case 'daily-record':
        window.renderDailyRecords && window.renderDailyRecords();
        break;
      case 'whereabouts':
        window.renderWhereabouts && window.renderWhereabouts();
        break;
      case 'whereabout-group':
        window.renderWhereaboutGroup && window.renderWhereaboutGroup();
        break;
      case 'whereabout-reports':
        window.renderWhereaboutReports && window.renderWhereaboutReports();
        break;
      case 'settings':
        window.renderSettings && window.renderSettings();
        break;
      case 'account-settings':
        window.renderAccountSettings && window.renderAccountSettings();
        break;
      case 'appearance':
        window.renderAppearance && window.renderAppearance();
        break;
      case 'chat-settings':
        window.renderChatSettings && window.renderChatSettings();
        break;
      case 'feature-settings':
        window.renderFeatureSettings && window.renderFeatureSettings();
        break;
      case 'pace-settings':
        window.renderPaceSettings && window.renderPaceSettings();
        break;
      case 'sound-settings':
        window.renderSoundSettings && window.renderSoundSettings();
        break;
      case 'data-manage':
        window.renderDataManage && window.renderDataManage();
        break;
      case 'period':
        window.renderPeriod && window.renderPeriod();
        break;
      case 'shop':
        window.renderShop && window.renderShop();
        break;
      case 'shop-cart':
        window.renderShopCart && window.renderShopCart();
        break;
      case 'love-diary':
        window.renderLoveDiary && window.renderLoveDiary();
        break;
      case 'love-test':
        window.renderLoveTest && window.renderLoveTest();
        break;
      case 'mini-games':
        window.renderMiniGames && window.renderMiniGames();
        break;
      case 'game-sheep':
        window.renderGameSheep && window.renderGameSheep();
        break;
      case 'game-goose':
        window.renderGameGoose && window.renderGameGoose();
        break;
      case 'game-llk':
        window.renderGameLlk && window.renderGameLlk();
        break;
      case 'game-2048':
        window.renderGame2048 && window.renderGame2048();
        break;
      case 'game-memory':
        window.renderGameMemory && window.renderGameMemory();
        break;
      case 'bookshelf':
        window.renderBookshelf && window.renderBookshelf();
        break;
      case 'recipe':
        window.renderRecipe && window.renderRecipe();
        break;
      case 'bubble-shop':
        window.renderBubbleShop && window.renderBubbleShop();
        break;
    }
  },
  
  // 渲染首页
  _renderHome() {
    const now = new Date();

    const dateEl = document.getElementById('home-date');
    if (dateEl) {
      const days = ['日','一','二','三','四','五','六'];
      dateEl.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}`;
    }

    // 随机格言
    const quoteEl = document.getElementById('home-quote');
    if (quoteEl && window.renderHomeQuote) {
      window.renderHomeQuote(quoteEl);
    }

    // （不再渲染聊天预览卡片，聊天已改为图标入口）

    // 首页小组件：纪念日（每次回到首页刷新展示）
    if (window.AnniversaryWidget && typeof window.AnniversaryWidget.render === 'function') {
      window.AnniversaryWidget.render();
    }
  },
  
  // 渲染聊天列表（基于账号设置中的角色 + 群聊）
  _renderChatList() {
    const container = document.getElementById('chat-list-container');
    if (!container) return;
    
    const partners = Storage.getPartnerProfiles();
    const groupChats = Storage.getGroupChats();
    if (!partners.length && !groupChats.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-plus"></i>
          <p>暂无角色，请前往「设置-账号设置」添加角色</p>
        </div>
      `;
      return;
    }
    
    var pinnedChats = Storage.getPinnedChats();
    var chats = Storage.getChats();
    
    // 构建会话条目（群聊 + 单聊）
    var items = [];
    
    // 群聊条目
    groupChats.forEach(function(g) {
      var chat = null;
      for (var ci = 0; ci < chats.length; ci++) {
        if (chats[ci].id === g.id) { chat = chats[ci]; break; }
      }
      chat = chat || { lastMsg: '', lastTime: 0, unread: 0 };
      items.push({
        chatId: g.id,
        name: g.name || '群聊',
        memberCount: (g.memberIds || []).length,
        lastMsg: chat.lastMsg || '',
        lastTime: chat.lastTime || 0,
        unread: chat.unread || 0,
        isPinned: pinnedChats.indexOf(g.id) !== -1,
        isGroup: true,
        group: g,
        sortTime: chat.lastTime || 0
      });
    });
    
    // 单聊条目
    partners.forEach(function(p) {
      const chatId = 'partner_' + p.id;
      var chat = null;
      for (var ci = 0; ci < chats.length; ci++) {
        if (chats[ci].id === chatId) { chat = chats[ci]; break; }
      }
      chat = chat || { lastMsg: '', lastTime: 0, unread: 0 };
      items.push({
        chatId: chatId,
        name: p.nickname,
        lastMsg: chat.lastMsg || '',
        lastTime: chat.lastTime || 0,
        unread: chat.unread || 0,
        isPinned: pinnedChats.indexOf(chatId) !== -1,
        isGroup: false,
        partner: p,
        sortTime: chat.lastTime || 0
      });
    });
    
    // 排序：置顶优先，其次按最后消息时间倒序
    items.sort(function(a, b) {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.sortTime || 0) - (a.sortTime || 0);
    });
    
    let html = '';
    items.forEach(function(it) {
      let avatarHtml = '';
      if (it.isGroup) {
        avatarHtml = _buildGroupAvatarHtml(it.group);
      } else {
        const p = it.partner;
        if (p.avatarImage) {
          avatarHtml = '<div class="chat-avatar" style="background:' + (p.avatarColor || '#A090B0') + ';background-image:url(' + p.avatarImage + ');background-size:cover;background-position:center;border-radius:' + (p.avatarShape === 'square' ? '8px' : '50%') + '"></div>';
        } else {
          avatarHtml = '<div class="chat-avatar" style="background:' + (p.avatarColor || '#A090B0') + ';border-radius:' + (p.avatarShape === 'square' ? '8px' : '50%') + '">' + (p.avatar || p.nickname.charAt(0)) + '</div>';
        }
      }
      
      var pinIndicator = it.isPinned ? '<span class="chat-pin-badge" style="font-size:0.65rem;color:var(--primary,#4C9AFF);margin-left:4px"><i class="fas fa-thumbtack"></i></span>' : '';
      var memberBadge = it.isGroup ? '<span class="group-member-count">(' + it.memberCount + '人)</span>' : '';
      var openFn = it.isGroup ? "openGroupRoom('" + it.chatId + "')" : "openChatRoom('" + it.chatId + "')";
      
      html += `
        <div class="chat-item" onclick="${openFn}" data-chat-id="${it.chatId}">
          ${avatarHtml}
          <div class="chat-info">
            <div class="chat-name">${Core.escapeHtml(it.name)}${memberBadge}${pinIndicator}</div>
            <div class="chat-preview">${Core.escapeHtml(it.lastMsg || '')}</div>
          </div>
          <div class="chat-meta">
            <div class="chat-time">${it.lastTime ? Core.formatTime(it.lastTime) : ''}</div>
            ${it.unread > 0 ? '<div class="chat-badge">' + it.unread + '</div>' : ''}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }
};

window.Navigation = Navigation;


