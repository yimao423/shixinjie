/* ============================================================
   love-apps.js — 恋爱主题应用
   1. 三维科普 ScienceApp —— 情侣双方共建的常识科普知识库（导航复用 love-diary 入口）
   2. 心流状态 MoodFlowApp —— 情绪标签系统（情绪种类+内容意愿含义标签，按情绪分类配色，可自定义，localStorage 持久化）
   3. 情话彩蛋库 SWEET_QUOTES —— 供互动小游戏通关彩蛋使用（原每日情话功能已移除）
   设计语言：毛玻璃卡片 + 主题变量，与全站一致
   ============================================================ */
(function () {
  'use strict';

  function toast(msg) {
    if (window.Core && typeof Core.toast === 'function') {
      Core.toast(msg);
      return;
    }
    try { alert(msg); } catch (e) {}
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fDate(d) {
    var days = ['日', '一', '二', '三', '四', '五', '六'];
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + days[d.getDay()];
  }

  /* ============================================================
     1. 三维科普 ScienceApp —— 情侣双方共建的常识科普知识库
     - 内置 24 条常识科普，覆盖 8 大分类
     - 支持自定义添加 / 编辑 / 删除科普条目
     - 持久化：science_articles（自定义条目）
     ============================================================ */
  var ARTICLES_KEY = 'science_articles';

  var SCIENCE_CATEGORIES = ['恋爱价值观', '社科常识', '日常出行', '行为习惯', '知识认知', '生理知识', '健康养生', '工作模式'];

  var SCIENCE_BUILTIN = [
    { id: 's01', category: '社科常识', title: '五险一金分别是什么',
      content: '五险一金是职场最基本的法定保障。五险指养老保险、医疗保险、失业保险、工伤保险、生育保险；一金指住房公积金。\n其中养老、医疗、失业、住房公积金由个人和单位按比例共同缴纳，工伤和生育保险由单位全额缴纳。\n缴费基数一般按本人上年度月平均工资确定，各地设有上下限。了解自己每月扣款去向，是守护权益的第一步。' },
    { id: 's02', category: '社科常识', title: '个人所得税起征点与专项附加扣除',
      content: '我国综合所得个税每月减除费用为 5000 元（即每年 6 万元），超出部分按 3%~45% 的七级超额累进税率计税。\n符合条件还可享受专项附加扣除：子女教育、继续教育、大病医疗、住房贷款利息、住房租金、赡养老人、3 岁以下婴幼儿照护等。\n每年 12 月记得在个税 App 确认下一年度专项附加扣除，能实实在在少交税。' },
    { id: 's03', category: '社科常识', title: '医保报销与社保卡的正确用法',
      content: '社保卡兼具身份凭证、就医结算、金融账户等功能。医保报销按"三大目录"执行：甲类药品全额纳入报销、乙类需先自付一定比例、丙类（自费）完全自付。\n门诊、住院报销比例和起付线各地不同。异地就医前建议先在医保平台办理异地备案，否则报销比例会大幅下降。\n切勿将社保卡借给他人使用，涉嫌骗保会被暂停医保待遇。' },
    { id: 's04', category: '日常出行', title: '高铁购票与改签规则',
      content: '铁路 12306 实行实名制购票，预售期通常为提前 15 天（具体以公告为准）。\n改签规则：开车前 48 小时以上可免费改签任意日期车次；开车前 48 小时以内，可改签开车前或当日的其他车次。\n改签后票价多退少补。错过车次可在开车后 2 小时内办理改签，但不能改签当日之后的车次。出行高峰建议尽早规划。' },
    { id: 's05', category: '日常出行', title: '公交地铁乘车小常识',
      content: '乘坐地铁进闸后有停留时限，通常为 120 分钟，超时需要补交超时费；进出闸需刷卡或扫码，避免尾随通过闸机（会扣全程票价甚至产生信用风险）。\n公交部分城市实行上下车分段计费，下车忘记刷卡会按全程扣费。\n候车时站在安全线内、先下后上，是文明更是安全。' },
    { id: 's06', category: '日常出行', title: '航空行李与安检规定',
      content: '国内经济舱免费托运行李一般限 20kg（廉价航空除外），随身行李通常限 1 件、不超过 5kg，尺寸约 20×40×55cm。\n充电宝严禁托运，额定能量 100Wh 以内的可随身携带，且需标识清晰。\n液体随身携带每瓶不超过 100ml（以瓶身标注为准）。登机前提前取出电子设备、雨伞、金属物品，能加快安检速度。' },
    { id: 's07', category: '行为习惯', title: '中餐用餐基本礼仪',
      content: '入座后等长辈或主人先动筷；夹菜使用公筷，不翻动盘中菜品；进食时尽量不发出大声响。\n给他人夹菜要使用公筷公勺；敬酒碰杯时杯沿略低于长辈或上级。\n临时离席轻声说明缘由，不把筷子竖直插在饭中。良好的用餐习惯让约会与聚餐都更舒适。' },
    { id: 's08', category: '行为习惯', title: '排队与公共秩序',
      content: '公共场所遵循先来后到，排队时与前人保持适当距离；不插队、不加塞。\n乘坐电梯先出后进，扶梯按当地习惯靠一侧站立；自动扶梯上不追逐打闹。\n小小的秩序意识，是两个人出门时最体面的默契。' },
    { id: 's09', category: '知识认知', title: '常见的几种诈骗套路',
      content: '冒充公检法"涉嫌洗钱"、刷单返利、杀猪盘婚恋诱导投资、冒充客服退款、虚假征信类诈骗，都是高频套路。\n记住三不：不轻信、不透露、不转账。凡是"不配合就要逮捕/影响征信"的都是恐吓话术；凡是先垫钱后返利的一定是骗局。\n拿不准就挂断电话，拨打反诈专线 96110 或 110 咨询。' },
    { id: 's10', category: '知识认知', title: '这些生活常识误区，别再信了',
      content: '感冒吃抗生素无效且有害——抗生素只针对细菌感染，普通感冒多为病毒引起。\n烫伤不要涂牙膏、酱油，应立即用流动凉水冲洗。\n"左眼跳财右眼跳灾"没有科学依据，持续眼皮跳动请就医。\n隔夜菜不是都不能吃，但绿叶菜和海鲜最好当餐吃完，剩菜要彻底加热。' },
    { id: 's11', category: '生理知识', title: '好好睡觉，是最廉价的养生',
      content: '成年人建议每天睡 7~9 小时，长期不足会增加心血管疾病、肥胖和情绪问题风险。\n睡前 1 小时减少手机使用——屏幕蓝光会抑制褪黑素分泌，让人更难入睡。\n卧室保持黑暗、安静、凉爽，建立规律的作息时间，比任何保健品都有效。' },
    { id: 's12', category: '生理知识', title: '每天怎么吃才算营养均衡',
      content: '《中国居民膳食指南》建议每天摄入 12 种以上、每周 25 种以上食物。\n一餐的理想搭配：主食约一拳头、蔬菜约两拳、蛋白质一掌、水果约一拳。\n少盐（每日 5g 以内）、少油、控糖、限酒。两个人一起做饭、互相提醒，是健康又浪漫的事。' },
    { id: 's13', category: '生理知识', title: '关键时刻能救命的急救常识',
      content: '气道异物梗阻：用海姆立克急救法，双手环抱患者腹部，向上向内快速冲击，直至异物排出。\n心脏骤停：立即拨打 120，并开始心肺复苏——按压胸骨下半段，深度 5~6cm，频率每分钟 100~120 次，按压与人工呼吸比 30:2。\n烧烫伤：流动凉水冲洗 15~20 分钟，不要涂抹牙膏、酱油。止血：直接按压伤口，抬高患肢。' },
    { id: 's29', category: '生理知识', title: '男女两性的生理差异',
      content: '男女在激素水平、体脂率、肌肉量、骨骼密度上存在天然差异，这决定了力量、代谢与耐力的不同，也影响患病风险与用药剂量。\n女性的激素随月经周期波动，情绪、食欲、精力也随之起伏，这不是"矫情"，而是真实的生理节律。\n理解并尊重彼此的身体差异，是亲密关系中相互照顾的第一步。' },
    { id: 's30', category: '生理知识', title: '经期护理与痛经缓解',
      content: '经期注意保暖、少碰生冷，卫生用品建议每 2~4 小时更换一次以防感染。\n缓解痛经：热敷下腹、适度运动（散步、拉伸）、补充温水，必要时遵医嘱服用布洛芬等止痛药。\n经血量明显过多、周期紊乱或痛经严重影响生活时，应及时就医排查，不必硬扛。' },
    { id: 's31', category: '生理知识', title: '两性健康与安全防护',
      content: '正确使用安全套能同时预防意外怀孕和大部分性传播疾病，是性价比最高的健康投资。\nHPV 疫苗男女都可接种，接种后仍需定期做宫颈癌筛查（TCT/HPV 检测）。\n固定、坦诚的性伴侣关系，加上定期的身体检查，是对彼此健康最负责的态度。' },
    { id: 's32', category: '生理知识', title: '婚前检查与备孕基础',
      content: '婚前检查（婚检）能发现遗传病、传染病与生殖健康隐患，建议领证前主动完成，费用大多由政府承担。\n备孕前 3 个月开始补充叶酸，戒烟戒酒、规律作息，双方一起做基础体检。\n排卵期（下次月经前 14 天左右）同房受孕率更高；备孕超过一年未成功，建议夫妻共同就诊。' },
    { id: 's14', category: '恋爱价值观', title: '有效沟通：把"你总是"换成"我感到"',
      content: '指责式沟通（"你总是迟到"）容易触发防御和争吵。试试"我信息"句式："我感到很担心，因为我怕你路上出事，下次提前说一声好吗？"\n吵架时翻旧账、人身攻击、冷暴力都是关系杀手。先处理情绪，再处理事情。\n睡前不赌气，矛盾不过夜，是最简单也最有效的经营之道。' },
    { id: 's15', category: '恋爱价值观', title: '亲密关系也需要边界感',
      content: '再相爱的人，也保留自己的空间与社交圈。尊重对方的时间、隐私和选择，不查手机、不控制行程、不替对方做决定。\n边界感不是疏远，而是"我们在一起，但仍是独立的两个人"。\n懂得尊重边界的关系，反而更长久、更安心。' },
    { id: 's16', category: '恋爱价值观', title: '长期亲密关系怎么经营',
      content: '定期安排"二人时间"：一顿不刷手机的晚餐、一次短途旅行，都能让感情保鲜。\n保持仪式感，纪念日、节日的小惊喜不是形式，是"我在乎"的表达。\n培养共同目标（存钱、健身、学新技能），一起成长的关系最有韧性。分歧时先理解，再被理解。' },
    { id: 's17', category: '工作模式', title: '劳动合同里必须看懂的条款',
      content: '入职 1 个月内必须签订书面劳动合同；劳动合同应写明岗位、薪资、工时、社保等内容。\n试用期：合同 3 年以上，试用期最长 6 个月；试用期工资不得低于转正工资的 80%。\n离职：试用期提前 3 天、正式期提前 30 天书面通知即可，无需公司批准。离职时记得办理社保转移和离职证明。' },
    { id: 's18', category: '工作模式', title: '职场礼仪与人际小技巧',
      content: '守时守信是最基本的职业素养；邮件和消息简洁明了，先说结论再展开。\n会议发言有准备、有观点，敢于表达但尊重他人；不背后议论同事。\n主动汇报进度、及时同步信息，能让你和团队都更省心。' },
    { id: 's19', category: '健康养生', title: '熬夜伤身与作息修复',
      content: '长期熬夜会打乱生物钟，导致免疫力下降、内分泌失调、注意力涣散，还会悄悄影响情绪稳定。\n补觉不等于熬夜后睡懒觉，关键是恢复规律：固定起床时间、午间小睡 20 分钟即可回血。\n睡前一小时远离手机蓝光，把卧室灯光调暗，能让入睡更快、睡得更好。' },
    { id: 's20', category: '健康养生', title: '喝水与饮食小常识',
      content: '成人每天饮水建议约 1500-1700 毫升，少量多次比一口气猛灌更科学；运动出汗后注意补充电解质。\n三餐规律、主食粗细搭配，多吃蔬菜水果，少油少盐少糖。\n外卖虽方便，但尽量选看得见食材原貌的餐品，两个人一起下厨更是最好的养生。' }
  ];
  // 内置科普统一标记 builtin（内置数据只读来源，可编辑以移动分组，但不可删除）
  for (var _si = 0; _si < SCIENCE_BUILTIN.length; _si++) SCIENCE_BUILTIN[_si].builtin = true;

  window.ScienceApp = {
    view: 'list',
    cat: 'all',
    currentId: null,
    searchOpen: false,
    keyword: '',

    /* 局部 HTML 转义（escHtml 是 RecipeApp 闭包内的函数，此处不可见，需自备） */
    _esc: function (s) {
      return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /* ---- 数据读写 ---- */
    _getCustom: function () {
      try { return Storage.get(ARTICLES_KEY, []); } catch (e) { return []; }
    },
    _saveCustom: function (arr) {
      try { Storage.set(ARTICLES_KEY, arr); } catch (e) {}
    },
    _all: function () {
      var custom = this._getCustom();
      var customIds = {};
      for (var i = 0; i < custom.length; i++) customIds[custom[i].id] = true;
      return custom.concat(SCIENCE_BUILTIN.filter(function (b) { return !customIds[b.id]; }));
    },
    findById: function (id) {
      var all = this._all();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },

    _summary: function (a) {
      var first = (a.content || '').split('\n')[0] || '';
      return first.length > 60 ? first.slice(0, 60) + '…' : first;
    },

    /* ---- 视图切换 ---- */
    setCat: function (c) {
      this.cat = c;
      this.keyword = '';
      var el = document.getElementById('science-search-input');
      if (el) el.value = '';
      this.render();
    },
    toggleSearch: function () {
      this.searchOpen = !this.searchOpen;
      this.render();
    },
    onSearch: function () {
      var el = document.getElementById('science-search-input');
      this.keyword = (el && el.value) || '';
      this.render();
    },
    closeSearch: function () {
      this.searchOpen = false;
      this.keyword = '';
      this.render();
    },
    openDetail: function (id) {
      this.view = 'detail';
      this.currentId = id;
      this.render();
    },
    backToList: function () {
      this.view = 'list';
      this.currentId = null;
      this.render();
    },

    /* ---- 添加 / 编辑 ---- */
    openAdd: function () {
      this._openForm(null);
    },
    openEdit: function (id) {
      var a = this.findById(id);
      if (!a) return;
      this._openForm(a);
    },
    _openForm: function (a) {
      var catOptions = '';
      for (var i = 0; i < SCIENCE_CATEGORIES.length; i++) {
        var c = SCIENCE_CATEGORIES[i];
        catOptions += '<option value="' + c + '"' + (a && a.category === c ? ' selected' : '') + '>' + c + '</option>';
      }
      var html =
        '<div class="glass-modal-title"><i class="fas fa-compass"></i> ' + (a ? '编辑科普' : '添加科普') + '</div>' +
        '<div class="science-form">' +
          '<label class="science-label">标题</label>' +
          '<input class="science-input" id="science-form-title" maxlength="40" placeholder="科普标题">' +
          '<label class="science-label">分类</label>' +
          '<select class="science-input" id="science-form-cat">' + catOptions + '</select>' +
          '<label class="science-label">正文（支持多行分段）</label>' +
          '<textarea class="science-textarea" id="science-form-content" rows="8" placeholder="写下科普内容…"></textarea>' +
        '</div>' +
        '<div class="glass-modal-actions">' +
          '<button class="glass-btn" onclick="ScienceApp._closeOverlay()">取消</button>' +
          '<button class="glass-btn primary" onclick="ScienceApp.saveForm(' + (a ? "'" + a.id + "'" : 'null') + ')"><i class="fas fa-check"></i> 保存</button>' +
        '</div>';
      this._showOverlay(html);
      var t = document.getElementById('science-form-title');
      var c2 = document.getElementById('science-form-content');
      if (a) { if (t) t.value = a.title; if (c2) c2.value = a.content; }
      if (t) t.focus();
    },
    saveForm: function (editId) {
      var t = document.getElementById('science-form-title');
      var c = document.getElementById('science-form-content');
      var cat = document.getElementById('science-form-cat');
      var title = (t && t.value || '').trim();
      var content = (c && c.value || '').trim();
      var category = (cat && cat.value) || '社科常识';
      if (!title) { toast('请填写标题'); return; }
      if (!content) { toast('请填写正文内容'); return; }
      var arr = this._getCustom();
      if (editId) {
        var found = false;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].id === editId) {
            arr[i].title = title;
            arr[i].category = category;
            arr[i].content = content;
            arr[i].updatedAt = Date.now();
            found = true;
          }
        }
        if (!found) {
          // 编辑的是内置条目：在自定义存储中创建覆盖记录（实现移动分组/修改内容）
          var bi = null;
          for (var j = 0; j < SCIENCE_BUILTIN.length; j++) {
            if (SCIENCE_BUILTIN[j].id === editId) { bi = SCIENCE_BUILTIN[j]; break; }
          }
          if (!bi) { toast('未找到该科普，可能已被删除'); this._closeOverlay(); this.render(); return; }
          arr.unshift({ id: editId, title: title, category: category, content: content, custom: true, createdAt: Date.now() });
        }
      } else {
        arr.unshift({ id: 'c' + Date.now(), title: title, category: category, content: content, custom: true, createdAt: Date.now() });
      }
      this._saveCustom(arr);
      this._closeOverlay();
      toast(editId ? '科普已更新' : '科普已添加');
      if (editId) this.cat = category;
      this.render();
    },
    delArticle: function (id) {
      var a = this.findById(id);
      if (!a || a.builtin) { toast('内置科普不可删除'); return; }
      var arr = this._getCustom().filter(function (e) { return e.id !== id; });
      this._saveCustom(arr);
      toast('已删除该科普');
      this.view = 'list';
      this.currentId = null;
      this.render();
    },

    /* ---- 弹层 ---- */
    _showOverlay: function (html) {
      this._closeOverlay();
      var ov = document.createElement('div');
      ov.className = 'glass-modal-overlay';
      ov.id = 'science-overlay';
      ov.onclick = function () { ScienceApp._closeOverlay(); };
      ov.innerHTML = '<div class="glass-modal-panel" onclick="event.stopPropagation()">' + html + '</div>';
      document.body.appendChild(ov);
    },
    _closeOverlay: function () {
      var ov = document.getElementById('science-overlay');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    },

    /* ---- 列表渲染 ---- */
    /* ---- 左侧竖向侧边栏 ---- */
    _sbIcons: {
      '社科常识': 'fa-scale-balanced',
      '日常出行': 'fa-location-dot',
      '行为习惯': 'fa-thumbs-up',
      '知识认知': 'fa-book-open',
      '生理知识': 'fa-heart',
      '健康养生': 'fa-bolt',
      '恋爱价值观': 'fa-users',
      '工作模式': 'fa-cog'
    },
    _sidebarHtml: function () {
      var html = '<div class="recipe-sidebar">';
      var act = (this.cat === 'all') ? ' active' : '';
      html += '<button class="recipe-sb-item' + act + '" onclick="ScienceApp.setCat(\'all\')">' +
        '<i class="fas fa-images"></i><span>全部</span></button>';
      for (var i = 0; i < SCIENCE_CATEGORIES.length; i++) {
        var c = SCIENCE_CATEGORIES[i];
        var icon = this._sbIcons[c] || 'fa-book-open';
        var a2 = (this.cat === c) ? ' active' : '';
        html += '<button class="recipe-sb-item' + a2 + '" onclick="ScienceApp.setCat(\'' + c + '\')">' +
          '<i class="fas ' + icon + '"></i><span>' + c + '</span></button>';
      }
      html += '</div>';
      return html;
    },

    /* ---- 顶栏搜索展开条 ---- */
    _searchbarHtml: function () {
      if (!this.searchOpen) return '';
      return '<div class="recipe-searchbar"><i class="fas fa-search"></i>' +
        '<input type="text" id="science-search-input" placeholder="搜索科普" oninput="ScienceApp.onSearch()" value="' + this._esc(this.keyword) + '">' +
        '<button class="recipe-searchbar-clear" onclick="ScienceApp.closeSearch()" title="收起搜索"><i class="fas fa-times"></i></button>' +
      '</div>';
    },

    _filtered: function () {
      var kw = (this.keyword || '').trim().toLowerCase();
      var all = this._all();
      if (this.cat !== 'all') all = all.filter(function (a) { return a.category === this.cat; }, this);
      if (kw) {
        all = all.filter(function (a) {
          var hay = ((a.title || '') + ' ' + (a.category || '') + ' ' + (a.content || '')).toLowerCase();
          return hay.indexOf(kw) !== -1;
        });
      }
      return all;
    },

    _cardHtml: function (a) {
      return '<div class="science-card glass-card" onclick="ScienceApp.openDetail(\'' + a.id + '\')">' +
        '<div class="science-card-head">' +
          '<span class="science-card-title"></span>' +
          '<span class="science-card-cat">' + a.category + '</span>' +
        '</div>' +
        '<div class="science-card-summary"></div>' +
      '</div>';
    },

    _listHtml: function () {
      var list = this._filtered();
      var catTitle = this.cat === 'all' ? '全部科普' : this.cat + '科普';
      var html = this._searchbarHtml() +
        '<div class="science-list-head">' +
          '<span class="science-list-title"><i class="fas fa-compass"></i> ' + catTitle + '</span>' +
          '<span class="science-list-count">共 ' + list.length + ' 篇</span>' +
        '</div>' +
        '<div class="science-list">';
      if (!list.length) {
        html += '<div class="love-empty">' + (this.keyword ? '没有找到匹配的科普，换个关键词试试' : '该分类下暂无科普') + '</div>';
      } else {
        for (var i = 0; i < list.length; i++) html += this._cardHtml(list[i]);
      }
      html += '</div>';
      return html;
    },

    /* ---- 详情渲染 ---- */
    _detailHtml: function () {
      var a = this.findById(this.currentId);
      if (!a) { this.view = 'list'; return this._listHtml(); }
      var editDel = '<div class="science-detail-admin">' +
          '<button class="glass-btn" onclick="ScienceApp.openEdit(\'' + a.id + '\')"><i class="fas fa-edit"></i> 编辑</button>' +
          (a.builtin ? '' : '<button class="glass-btn danger" onclick="ScienceApp.delArticle(\'' + a.id + '\')"><i class="fas fa-trash-alt"></i> 删除</button>') +
        '</div>';
      return '<div class="science-detail">' +
        '<button class="glass-btn science-back" onclick="ScienceApp.backToList()"><i class="fas fa-chevron-left"></i> 返回列表</button>' +
        '<div class="science-detail-card glass-card">' +
          '<div class="science-detail-head">' +
            '<span class="science-detail-title"></span>' +
            '<span class="science-card-cat">' + a.category + '</span>' +
          '</div>' +
          '<div class="science-detail-content"></div>' +
        '</div>' +
        editDel +
      '</div>';
    },

    /* ---- 主渲染 ---- */
    render: function () {
      var container = document.getElementById('science-container');
      if (!container) return;
      if (this.view === 'detail') {
        container.innerHTML = '<div class="recipe-main">' + this._detailHtml() + '</div>';
      } else {
        container.innerHTML = this._sidebarHtml() + '<div class="recipe-main">' + this._listHtml() + '</div>';
      }
      // 顶栏搜索按钮激活态 + 搜索框值回填
      var si = document.getElementById('science-search-input');
      if (si && si.value !== this.keyword) si.value = this.keyword;
      var sbtn = document.getElementById('science-search-btn');
      if (sbtn) sbtn.classList.toggle('active', this.searchOpen);
      // 搜索展开时保持输入框聚焦（重建 DOM 后恢复焦点到末尾，支持连续输入）
      if (this.searchOpen) {
        var sf = document.getElementById('science-search-input');
        if (sf && document.activeElement !== sf) {
          sf.focus();
          try { sf.setSelectionRange(sf.value.length, sf.value.length); } catch (e) {}
        }
      }
      // 用户内容一律 textContent 填充，防注入
      var list = this.view === 'detail' ? [] : this._filtered();
      var cards = container.querySelectorAll('.science-card');
      for (var i = 0; i < cards.length && i < list.length; i++) {
        var a = list[i];
        cards[i].querySelector('.science-card-title').textContent = a.title || '';
        cards[i].querySelector('.science-card-summary').textContent = this._summary(a) || '';
      }
      if (this.view === 'detail') {
        var a2 = this.findById(this.currentId);
        if (a2) {
          var dt = container.querySelector('.science-detail-title');
          if (dt) dt.textContent = a2.title || '';
          var dc = container.querySelector('.science-detail-content');
          if (dc) dc.textContent = a2.content || '';
        }
      }
    }
  };

  window.renderLoveDiary = function () {
    window.ScienceApp.render();
  };
  window.renderScience = function () {
    window.ScienceApp.render();
  };

  /* ============================================================
     2. 心流状态 MoodFlowApp —— 情绪标签系统
     - 内置情绪种类标签（开心/难过/生气/害怕/厌恶/焦虑/羡慕/尴尬/无聊），按情绪分类分配主题色
     - 内置内容意愿含义标签（想要抱抱/想聊天/需要陪伴...），关联情绪分类并继承其配色
     - 支持自定义添加情绪种类与含义标签，localStorage 持久化（moodflow_emotions / moodflow_intents）
     - 供聊天界面调用：对方角色回复文本气泡时随机标注含义标签（带情绪分类颜色）
     ============================================================ */
  var MOOD_EMOTION_KEY = 'moodflow_emotions';
  var MOOD_INTENT_KEY = 'moodflow_intents';
  // 标签管理持久化：删除隐藏列表 / 改名覆盖表（内置与自定义统一处理）
  var MOOD_HIDDEN_EMOTION_KEY = 'moodflow_hidden_emotions';
  var MOOD_HIDDEN_INTENT_KEY = 'moodflow_hidden_intents';
  var MOOD_RENAME_EMOTION_KEY = 'moodflow_rename_emotions';
  var MOOD_RENAME_INTENT_KEY = 'moodflow_rename_intents';

  var MOOD_BUILTIN_EMOTIONS = [
    { id: 'happy', name: '开心', color: '#FFD93D', light: '#FFF3C4' },
    { id: 'sad', name: '难过', color: '#5D8BEB', light: '#E3EBFC' },
    { id: 'angry', name: '生气', color: '#E74C3C', light: '#FCE3E0' },
    { id: 'fear', name: '害怕', color: '#9B59B6', light: '#EDE1F6' },
    { id: 'disgust', name: '厌恶', color: '#27AE60', light: '#DFF2E7' },
    { id: 'anxious', name: '焦虑', color: '#F39C12', light: '#FDEBDC' },
    { id: 'envy', name: '羡慕', color: '#1ABC9C', light: '#D9F3EE' },
    { id: 'embarrassment', name: '尴尬', color: '#F1948A', light: '#FCE4E1' },
    { id: 'ennui', name: '无聊', color: '#5C6BC0', light: '#E4E6F5' }
  ];

  var MOOD_BUILTIN_INTENTS = [
    { id: 'int_happy1', emotion: 'happy', text: '今天好开心想和你分享' },
    { id: 'int_happy2', emotion: 'happy', text: '想到你就忍不住想笑' },
    { id: 'int_happy3', emotion: 'happy', text: '想把此刻的快乐都给你' },
    { id: 'int_sad1', emotion: 'sad', text: '心里闷闷的需要抱抱' },
    { id: 'int_sad2', emotion: 'sad', text: '想被你温柔地安慰' },
    { id: 'int_sad3', emotion: 'sad', text: '今天有点低落想靠着你' },
    { id: 'int_angry1', emotion: 'angry', text: '有点气不过想让你哄哄' },
    { id: 'int_angry2', emotion: 'angry', text: '想静静但别真的走开' },
    { id: 'int_angry3', emotion: 'angry', text: '需要你耐心听我吐槽' },
    { id: 'int_calm1', emotion: 'ennui', text: '好无聊想找你打发时间' },
    { id: 'int_calm2', emotion: 'ennui', text: '想和你安静地待着也好' },
    { id: 'int_calm3', emotion: 'ennui', text: '想一起出去走走透透气' },
    { id: 'int_anxious1', emotion: 'anxious', text: '心里慌慌的需要你鼓励' },
    { id: 'int_anxious2', emotion: 'anxious', text: '想听你说一切都会好的' },
    { id: 'int_anxious3', emotion: 'anxious', text: '需要你帮我稳住心情' },
    { id: 'int_eager1', emotion: 'envy', text: '有点羡慕别人想让你也夸夸我' },
    { id: 'int_eager2', emotion: 'envy', text: '想要你偏心一点' },
    { id: 'int_eager3', emotion: 'envy', text: '想被你放在心上' },
    { id: 'int_shy1', emotion: 'embarrassment', text: '刚才好丢人想躲起来' },
    { id: 'int_shy2', emotion: 'embarrassment', text: '有点不好意思开口' },
    { id: 'int_shy3', emotion: 'embarrassment', text: '想让你看到又怕被你发现' },
    { id: 'int_miss1', emotion: 'fear', text: '有点害怕想让你陪着我' },
    { id: 'int_miss2', emotion: 'fear', text: '需要一点安全感' },
    { id: 'int_miss3', emotion: 'fear', text: '做了噩梦想抱紧你' },
    { id: 'int_disgust1', emotion: 'disgust', text: '遇到讨厌的事想跟你吐槽' },
    { id: 'int_disgust2', emotion: 'disgust', text: '需要你和我站在一边' },
    { id: 'int_disgust3', emotion: 'disgust', text: '今天好想躲开那个人' }
  ];

  var MOOD_EMO_COLORS = ['#E8A87C', '#C38D9E', '#85B79D', '#7B8FDB', '#B39DDB', '#FFB6C1', '#AED581', '#FFD54F', '#80CBC4', '#F48FB1'];

  /* 心流状态页：当前选中的情绪分类 id（左侧分栏切换） */
  var moodCurrentEmotionId = null;

  window.MoodFlowApp = {
    _emotionById: function (id) {
      // 兼容旧版本内置分类 id：自定义数据若仍引用旧 id，只读映射到新分类（不改动 localStorage）
      var LEGACY_ID_MAP = { calm: 'ennui', eager: 'envy', shy: 'embarrassment', miss: 'fear' };
      if (LEGACY_ID_MAP[id]) id = LEGACY_ID_MAP[id];
      var all = this.getEmotions();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return all[0] || null;
    },

    /* ---- 数据读写（内置 + 自定义，localStorage 持久化） ---- */
    getEmotions: function () {
      var custom = [];
      try { custom = Storage.get(MOOD_EMOTION_KEY, []); } catch (e) {}
      if (!Array.isArray(custom)) custom = [];
      var hidden = this._hiddenEmotions();
      var renames = this._renamesEmotions();
      return MOOD_BUILTIN_EMOTIONS.concat(custom).filter(function (e) {
        return hidden.indexOf(e.id) === -1;
      }).map(function (e) {
        var r = renames[e.id];
        if (!r) return e;
        // 返回浅拷贝，避免污染内置常量对象
        var copy = {};
        for (var k in e) copy[k] = e[k];
        if (r.name) copy.name = r.name;
        if (r.color) copy.color = r.color;
        return copy;
      });
    },
    getIntents: function () {
      var custom = [];
      try { custom = Storage.get(MOOD_INTENT_KEY, []); } catch (e) {}
      if (!Array.isArray(custom)) custom = [];
      var hidden = this._hiddenIntents();
      var renames = this._renamesIntents();
      return MOOD_BUILTIN_INTENTS.concat(custom).filter(function (it) {
        return hidden.indexOf(it.id) === -1;
      }).map(function (it) {
        var r = renames[it.id];
        if (!r || !r.text) return it;
        var copy = {};
        for (var k in it) copy[k] = it[k];
        copy.text = r.text;
        return copy;
      });
    },
    /* ---- 隐藏（删除）列表读写 ---- */
    _hiddenEmotions: function () {
      var a = [];
      try { a = Storage.get(MOOD_HIDDEN_EMOTION_KEY, []); } catch (e) {}
      return Array.isArray(a) ? a : [];
    },
    _hiddenIntents: function () {
      var a = [];
      try { a = Storage.get(MOOD_HIDDEN_INTENT_KEY, []); } catch (e) {}
      return Array.isArray(a) ? a : [];
    },
    _saveHiddenEmotions: function (a) { try { Storage.set(MOOD_HIDDEN_EMOTION_KEY, a); } catch (e) {} },
    _saveHiddenIntents: function (a) { try { Storage.set(MOOD_HIDDEN_INTENT_KEY, a); } catch (e) {} },
    /* ---- 改名覆盖表读写 ---- */
    _renamesEmotions: function () {
      var m = {};
      try { m = Storage.get(MOOD_RENAME_EMOTION_KEY, {}); } catch (e) {}
      return m && typeof m === 'object' ? m : {};
    },
    _renamesIntents: function () {
      var m = {};
      try { m = Storage.get(MOOD_RENAME_INTENT_KEY, {}); } catch (e) {}
      return m && typeof m === 'object' ? m : {};
    },
    _saveRenamesEmotions: function (m) { try { Storage.set(MOOD_RENAME_EMOTION_KEY, m); } catch (e) {} },
    _saveRenamesIntents: function (m) { try { Storage.set(MOOD_RENAME_INTENT_KEY, m); } catch (e) {} },
    _saveCustomEmotions: function (arr) { try { Storage.set(MOOD_EMOTION_KEY, arr); } catch (e) {} },
    _saveCustomIntents: function (arr) { try { Storage.set(MOOD_INTENT_KEY, arr); } catch (e) {} },

    /* ---- 自定义添加（localStorage 持久化） ---- */
    addEmotion: function (name, color) {
      var nameT = String(name || '').trim();
      if (!nameT) return null;
      var all = this.getEmotions();
      for (var i = 0; i < all.length; i++) if (all[i].name === nameT) return null;
      var item = {
        id: 'emo_' + Date.now(),
        name: nameT,
        color: color || MOOD_EMO_COLORS[Math.floor(Math.random() * MOOD_EMO_COLORS.length)],
        light: null,
        custom: true
      };
      var custom = [];
      try { custom = Storage.get(MOOD_EMOTION_KEY, []); } catch (e) {}
      if (!Array.isArray(custom)) custom = [];
      custom.push(item);
      this._saveCustomEmotions(custom);
      return item;
    },
    addIntent: function (text, emotionId) {
      var textT = String(text || '').trim();
      if (!textT) return null;
      var all = this.getIntents();
      for (var i = 0; i < all.length; i++) if (all[i].text === textT) return null;
      var item = { id: 'int_' + Date.now(), emotion: emotionId || 'happy', text: textT, custom: true };
      var custom = [];
      try { custom = Storage.get(MOOD_INTENT_KEY, []); } catch (e) {}
      if (!Array.isArray(custom)) custom = [];
      custom.push(item);
      this._saveCustomIntents(custom);
      return item;
    },

    /* ---- 供聊天渲染：随机取一个含义标签 ---- */
    getRandomIntent: function () {
      var intents = this.getIntents();
      if (!intents.length) return null;
      var it = intents[Math.floor(Math.random() * intents.length)];
      var emo = this._emotionById(it.emotion);
      return {
        id: it.id,
        text: it.text,
        emotion: emo ? emo.name : '',
        color: emo ? emo.color : '#8890A0',
        light: emo ? (emo.light || '#E8EEF5') : '#E8EEF5'
      };
    },
    intentHtml: function (intent, colorOverride, lightOverride) {
      if (!intent || !intent.text) return '';
      var color = colorOverride || intent.color || '#8890A0';
      var light = lightOverride || intent.light || '#E8EEF5';
      // 心流标签背景/描边统一为半透明（与「已撤回」标签透明度一致）
      var lightRgb = this._hexToRgb(light);
      var colorRgb = this._hexToRgb(color);
      return '<span class="chat-mood-intent" style="--mood-color:' + color + ';--mood-light:' + light + ';--mood-light-rgb:' + lightRgb + ';--mood-color-rgb:' + colorRgb + '">' + Core.escapeHtml(intent.text) + '</span>';
    },
    /* 十六进制色转 "r,g,b" 字符串（供 rgba 半透明背景使用） */
    _hexToRgb: function (hex) {
      var s = String(hex || '').replace(/^#/, '');
      if (s.length === 3) s = s.split('').map(function (c) { return c + c; }).join('');
      if (!/^[0-9a-fA-F]{6}$/.test(s)) return '136,144,160';
      var r = parseInt(s.substr(0, 2), 16);
      var g = parseInt(s.substr(2, 2), 16);
      var b = parseInt(s.substr(4, 2), 16);
      return r + ',' + g + ',' + b;
    },
    getRandomIntentHtml: function () {
      var it = this.getRandomIntent();
      if (!it) return '';
      return this.intentHtml(it);
    },

    /* ---- 心流状态页面渲染：左侧情绪分类栏 + 右侧内容（对齐商城/菜谱/三维科普 recipe-shell） ---- */
    renderTags: function () {
      var emotions = this.getEmotions();
      var intents = this.getIntents();
      if (!emotions.length) emotions = MOOD_BUILTIN_EMOTIONS;
      // 当前选中情绪分类（默认第一个，切换后保持）
      if (!moodCurrentEmotionId) {
        moodCurrentEmotionId = emotions[0] ? emotions[0].id : '';
      }
      var currentEmo = null;
      for (var ci = 0; ci < emotions.length; ci++) {
        if (emotions[ci].id === moodCurrentEmotionId) { currentEmo = emotions[ci]; break; }
      }
      if (!currentEmo) { currentEmo = emotions[0] || null; if (currentEmo) moodCurrentEmotionId = currentEmo.id; }
      var curColor = currentEmo ? (currentEmo.color || '#8890A0') : '#8890A0';
      var curLight = currentEmo ? (currentEmo.light || '#E8EEF5') : '#E8EEF5';
      var curName = currentEmo ? currentEmo.name : '';

      // 左侧：情绪种类分类栏（recipe-sb-item，色点作图标）
      var sbItems = emotions.map(function (e) {
        var color = e.color || '#8890A0';
        var active = e.id === moodCurrentEmotionId ? ' active' : '';
        return '<button class="recipe-sb-item' + active + '" data-emo="' + e.id + '" style="--mood-color:' + color + '" title="' + Core.escapeHtml(e.name) + '">'
          + '<span class="mood-sb-dot"></span>'
          + '<span>' + Core.escapeHtml(e.name) + '</span>'
          + '</button>';
      }).join('');
      // 右侧：当前情绪分类下的含义标签（每个标签带 编辑/删除 按钮）
      var curIntents = [];
      for (var ii = 0; ii < intents.length; ii++) {
        if (intents[ii].emotion === moodCurrentEmotionId) curIntents.push(intents[ii]);
      }
      var intentTags = curIntents.map(function (it) {
        return '<span class="mood-tag mood-tag-intent" data-text="' + Core.escapeHtml(it.text) + '" data-id="' + Core.escapeHtml(it.id) + '" style="--mood-color:' + curColor + ';--mood-light:' + curLight + '">'
          + '<span class="mood-tag-text">' + Core.escapeHtml(it.text) + '</span>'
          + '<button class="mood-tag-act mood-tag-edit" data-act="edit" title="修改标签" aria-label="修改标签"><i class="fas fa-pen"></i></button>'
          + '<button class="mood-tag-act mood-tag-del" data-act="del" title="删除标签" aria-label="删除标签"><i class="fas fa-trash-can"></i></button>'
          + '</span>';
      }).join('');

      return '<div class="recipe-shell">'
        + '<div class="recipe-sidebar">' + sbItems + '</div>'
        + '<div class="recipe-main">'
        + '<div class="mood-main-title">'
        + '<i class="fas fa-face-smile"></i> <span>' + Core.escapeHtml(curName) + ' · 含义标签</span>'
        + '<span class="mood-head-actions">'
        + '<button class="mood-head-btn" data-act="edit-emo" title="修改情绪分类" aria-label="修改情绪分类"><i class="fas fa-pen-to-square"></i></button>'
        + '<button class="mood-head-btn danger" data-act="del-emo" title="删除情绪分类" aria-label="删除情绪分类"><i class="fas fa-trash-can"></i></button>'
        + '</span>'
        + '</div>'
        + '<div class="mood-tags">' + (intentTags || '<span class="mood-empty">该情绪下暂无含义标签</span>') + '</div>'
        + '</div>'
        + '</div>';
    },
    /* 切换左侧情绪分类并重渲染 */
    selectEmotion: function (id) {
      moodCurrentEmotionId = id;
      if (window.renderLoveTest) window.renderLoveTest();
    },

    addEmotionFromForm: function () {
      var input = document.getElementById('mood-add-emotion-input');
      if (!input) return;
      // 优先取自定义颜色输入；否则取色板 active
      var colorInput = document.getElementById('mood-add-emotion-color');
      var color = colorInput && colorInput.value ? colorInput.value : '';
      if (!color) {
        var swActive = document.querySelector('#mood-add-emotion-swatches .mood-swatch.active');
        color = swActive ? (swActive.getAttribute('data-color') || '') : '';
      }
      var item = this.addEmotion(input.value, color);
      if (!item) { toast('情绪种类为空或已存在'); return; }
      input.value = '';
      toast('已添加情绪：' + item.name);
      // 新情绪默认选中并刷新
      moodCurrentEmotionId = item.id;
      if (window.renderLoveTest) window.renderLoveTest();
    },
    addIntentFromForm: function () {
      var input = document.getElementById('mood-add-intent-input');
      if (!input) return;
      var sel = document.getElementById('mood-add-intent-emotion');
      var item = this.addIntent(input.value, sel ? sel.value : 'happy');
      if (!item) { toast('含义标签为空或已存在'); return; }
      input.value = '';
      toast('已添加含义标签');
      if (window.renderLoveTest) window.renderLoveTest();
    },
    /* 顶栏加号：弹出自定义添加弹窗（新增情绪种类 / 新增含义标签） */
    openAddModal: function () {
      var emotions = this.getEmotions();
      if (!emotions.length) emotions = MOOD_BUILTIN_EMOTIONS;
      // 添加含义标签的所属情绪下拉（默认当前选中）
      var emoOptions = emotions.map(function (e) {
        var sel = e.id === moodCurrentEmotionId ? ' selected' : '';
        return '<option value="' + e.id + '"' + sel + '>' + Core.escapeHtml(e.name) + '</option>';
      }).join('');
      // 添加情绪种类的预设色板（默认选中第一个）
      var swatches = MOOD_EMO_COLORS.map(function (c, idx) {
        return '<span class="mood-swatch' + (idx === 0 ? ' active' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>';
      }).join('');
      var html =
        '<div class="glass-modal-title"><i class="fas fa-heart"></i> 自定义添加</div>'
        + '<div class="mood-add-title">新增情绪种类</div>'
        + '<div class="mood-add-row">'
        + '<input type="text" id="mood-add-emotion-input" maxlength="12" placeholder="新情绪种类，如：委屈">'
        + '</div>'
        + '<div class="mood-add-color-row">'
        + '<span class="mood-swatches" id="mood-add-emotion-swatches">' + swatches + '</span>'
        + '<label class="mood-color-custom">'
        + '<input type="color" id="mood-add-emotion-color" value="' + (MOOD_EMO_COLORS[0] || '#E08E8E') + '" title="自定义颜色">'
        + '<span>自定义</span>'
        + '</label>'
        + '</div>'
        + '<button class="glass-btn primary" onclick="MoodFlowApp.addEmotionFromForm()"><i class="fas fa-plus"></i> 添加情绪</button>'
        + '<div class="mood-add-divider"></div>'
        + '<div class="mood-add-title">新增含义标签</div>'
        + '<div class="mood-add-row">'
        + '<input type="text" id="mood-add-intent-input" maxlength="20" placeholder="新含义标签，如：想听睡前故事">'
        + '<select id="mood-add-intent-emotion">' + emoOptions + '</select>'
        + '</div>'
        + '<button class="glass-btn primary" onclick="MoodFlowApp.addIntentFromForm()"><i class="fas fa-plus"></i> 添加含义</button>'
        + '<div class="glass-modal-actions">'
        + '<button class="glass-btn" onclick="MoodFlowApp.closeAddModal()">取消</button>'
        + '</div>';
      this.closeAddModal();
      var ov = document.createElement('div');
      ov.className = 'glass-modal-overlay';
      ov.id = 'mood-overlay';
      ov.onclick = function () { MoodFlowApp.closeAddModal(); };
      ov.innerHTML = '<div class="glass-modal-panel" onclick="event.stopPropagation()">' + html + '</div>';
      document.body.appendChild(ov);
      // 绑定弹窗内色板选择
      var msw = document.querySelectorAll('#mood-overlay .mood-swatch');
      msw.forEach(function (s) {
        s.addEventListener('click', function () {
          msw.forEach(function (x) { x.classList.remove('active'); });
          s.classList.add('active');
          var cInput = document.getElementById('mood-add-emotion-color');
          var c = s.getAttribute('data-color');
          if (cInput && c) cInput.value = c;
        });
      });
    },
    closeAddModal: function () {
      var ov = document.getElementById('mood-overlay');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    },
    bindAddForm: function () {
      // 左侧情绪分类栏切换（recipe-sb-item）
      var sbItems = document.querySelectorAll('#love-test-container .recipe-sb-item');
      sbItems.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-emo') || '';
          if (id && window.MoodFlowApp && typeof window.MoodFlowApp.selectEmotion === 'function') {
            window.MoodFlowApp.selectEmotion(id);
          }
        });
      });
      // 右侧含义标签：点击记录心情；编辑/删除按钮分别处理
      var tags = document.querySelectorAll('#love-test-container .mood-tag-intent');
      tags.forEach(function (tag) {
        tag.addEventListener('click', function (ev) {
          var actBtn = ev.target.closest('.mood-tag-act');
          if (actBtn) return; // 编辑/删除按钮由下方单独处理
          var t = tag.getAttribute('data-text') || '';
          if (t) toast('已记录此刻心情：「' + t + '」');
        });
      });
      // 含义标签：修改 / 删除
      var acts = document.querySelectorAll('#love-test-container .mood-tag-act');
      acts.forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var tag = btn.closest('.mood-tag-intent');
          if (!tag) return;
          var id = tag.getAttribute('data-id') || '';
          if (!id) return;
          var act = btn.getAttribute('data-act') || '';
          if (act === 'edit') MoodFlowApp.openEditIntentModal(id);
          else if (act === 'del') MoodFlowApp.openDeleteIntentModal(id);
        });
      });
      // 标题栏：修改 / 删除当前情绪分类
      var headActs = document.querySelectorAll('#love-test-container .mood-head-btn');
      headActs.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act') || '';
          if (act === 'edit-emo') MoodFlowApp.openEditEmotionModal(moodCurrentEmotionId);
          else if (act === 'del-emo') MoodFlowApp.openDeleteEmotionModal(moodCurrentEmotionId);
        });
      });
    },

    /* ============ 标签管理：修改 / 删除 ============ */
    /* 弹窗通用容器 */
    _openModal: function (title, bodyHtml, actionsHtml) {
      this.closeAddModal(); // 复用一个 overlay 容器逻辑
      var ov = document.createElement('div');
      ov.className = 'glass-modal-overlay';
      ov.id = 'mood-overlay';
      ov.onclick = function () { MoodFlowApp.closeAddModal(); };
      ov.innerHTML = '<div class="glass-modal-panel" onclick="event.stopPropagation()">'
        + '<div class="glass-modal-title">' + title + '</div>'
        + bodyHtml
        + '<div class="glass-modal-actions">' + actionsHtml + '</div>'
        + '</div>';
      document.body.appendChild(ov);
      return ov;
    },

    /* ---- 修改含义标签 ---- */
    openEditIntentModal: function (id) {
      var all = this.getIntents();
      var it = null;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { it = all[i]; break; }
      if (!it) { toast('标签不存在'); return; }
      var _this = this;
      this._openModal(
        '<i class="fas fa-pen"></i> 修改含义标签',
        '<div class="mood-add-row"><input type="text" id="mood-edit-intent-input" maxlength="20" value="' + Core.escapeHtml(it.text) + '"></div>',
        '<button class="glass-btn primary" id="mood-edit-intent-save">保存</button>'
        + '<button class="glass-btn" onclick="MoodFlowApp.closeAddModal()">取消</button>'
      );
      var saveBtn = document.getElementById('mood-edit-intent-save');
      saveBtn.addEventListener('click', function () {
        var input = document.getElementById('mood-edit-intent-input');
        var val = input ? input.value.trim() : '';
        if (!val) { toast('标签内容不能为空'); return; }
        _this.renameIntent(id, val);
        MoodFlowApp.closeAddModal();
        if (window.renderLoveTest) window.renderLoveTest();
      });
      var input = document.getElementById('mood-edit-intent-input');
      if (input) input.focus();
    },
    renameIntent: function (id, newText) {
      var renames = this._renamesIntents();
      renames[id] = { text: newText };
      this._saveRenamesIntents(renames);
      toast('标签已修改');
    },
    /* ---- 删除含义标签 ---- */
    openDeleteIntentModal: function (id) {
      var all = this.getIntents();
      var it = null;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { it = all[i]; break; }
      if (!it) { toast('标签不存在'); return; }
      var _this = this;
      this._openModal(
        '<i class="fas fa-trash-can"></i> 删除含义标签',
        '<p class="mood-modal-desc">确认删除含义标签「' + Core.escapeHtml(it.text) + '」？</p>',
        '<button class="glass-btn danger" id="mood-del-intent-confirm">删除</button>'
        + '<button class="glass-btn" onclick="MoodFlowApp.closeAddModal()">取消</button>'
      );
      document.getElementById('mood-del-intent-confirm').addEventListener('click', function () {
        _this.deleteIntent(id);
        MoodFlowApp.closeAddModal();
        if (window.renderLoveTest) window.renderLoveTest();
      });
    },
    deleteIntent: function (id) {
      var hidden = this._hiddenIntents();
      if (hidden.indexOf(id) === -1) hidden.push(id);
      this._saveHiddenIntents(hidden);
      toast('标签已删除');
    },

    /* ---- 修改情绪分类 ---- */
    openEditEmotionModal: function (id) {
      var all = this.getEmotions();
      var e = null;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { e = all[i]; break; }
      if (!e) { toast('情绪分类不存在'); return; }
      var _this = this;
      var swatches = MOOD_EMO_COLORS.map(function (c) {
        var active = c.toLowerCase() === (e.color || '').toLowerCase() ? ' active' : '';
        return '<span class="mood-swatch' + active + '" data-color="' + c + '" style="background:' + c + '"></span>';
      }).join('');
      this._openModal(
        '<i class="fas fa-pen-to-square"></i> 修改情绪分类',
        '<div class="mood-add-row"><input type="text" id="mood-edit-emotion-input" maxlength="12" value="' + Core.escapeHtml(e.name) + '"></div>'
        + '<div class="mood-add-color-row">'
        + '<span class="mood-swatches" id="mood-edit-emotion-swatches">' + swatches + '</span>'
        + '<label class="mood-color-custom">'
        + '<input type="color" id="mood-edit-emotion-color" value="' + (e.color || '#E08E8E') + '" title="自定义颜色">'
        + '<span>自定义</span>'
        + '</label>'
        + '</div>',
        '<button class="glass-btn primary" id="mood-edit-emotion-save">保存</button>'
        + '<button class="glass-btn" onclick="MoodFlowApp.closeAddModal()">取消</button>'
      );
      // 色板选择联动
      var msw = document.querySelectorAll('#mood-edit-emotion-swatches .mood-swatch');
      msw.forEach(function (s) {
        s.addEventListener('click', function () {
          msw.forEach(function (x) { x.classList.remove('active'); });
          s.classList.add('active');
          var cInput = document.getElementById('mood-edit-emotion-color');
          var c = s.getAttribute('data-color');
          if (cInput && c) cInput.value = c;
        });
      });
      document.getElementById('mood-edit-emotion-save').addEventListener('click', function () {
        var nameInput = document.getElementById('mood-edit-emotion-input');
        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) { toast('情绪分类名不能为空'); return; }
        var colorInput = document.getElementById('mood-edit-emotion-color');
        var color = colorInput && colorInput.value ? colorInput.value : (e.color || '');
        _this.renameEmotion(id, name, color);
        MoodFlowApp.closeAddModal();
        if (window.renderLoveTest) window.renderLoveTest();
      });
      var input = document.getElementById('mood-edit-emotion-input');
      if (input) input.focus();
    },
    renameEmotion: function (id, newName, newColor) {
      var renames = this._renamesEmotions();
      var r = renames[id] || {};
      r.name = newName;
      if (newColor) r.color = newColor;
      renames[id] = r;
      this._saveRenamesEmotions(renames);
      toast('情绪分类已修改');
    },
    /* ---- 删除情绪分类（同时隐藏其下含义标签） ---- */
    openDeleteEmotionModal: function (id) {
      var all = this.getEmotions();
      var e = null;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { e = all[i]; break; }
      if (!e) { toast('情绪分类不存在'); return; }
      var _this = this;
      this._openModal(
        '<i class="fas fa-trash-can"></i> 删除情绪分类',
        '<p class="mood-modal-desc">确认删除情绪分类「' + Core.escapeHtml(e.name) + '」？其下所有含义标签将一并删除。</p>',
        '<button class="glass-btn danger" id="mood-del-emo-confirm">删除</button>'
        + '<button class="glass-btn" onclick="MoodFlowApp.closeAddModal()">取消</button>'
      );
      document.getElementById('mood-del-emo-confirm').addEventListener('click', function () {
        _this.deleteEmotion(id);
        MoodFlowApp.closeAddModal();
        if (window.renderLoveTest) window.renderLoveTest();
      });
    },
    deleteEmotion: function (id) {
      // 隐藏该情绪分类
      var hidden = this._hiddenEmotions();
      if (hidden.indexOf(id) === -1) hidden.push(id);
      this._saveHiddenEmotions(hidden);
      // 同步隐藏其下所有含义标签
      var all = this.getIntents();
      var hiddenInt = this._hiddenIntents();
      all.forEach(function (it) {
        if (it.emotion === id && hiddenInt.indexOf(it.id) === -1) hiddenInt.push(it.id);
      });
      this._saveHiddenIntents(hiddenInt);
      // 若删除的是当前选中，切到第一个
      if (moodCurrentEmotionId === id) moodCurrentEmotionId = null;
      toast('情绪分类已删除');
    }
  };

  /* ============================================================
     心流状态页渲染入口（仅情绪标签系统）
     ============================================================ */
  window.renderLoveTest = function () {
    var container = document.getElementById('love-test-container');
    if (!container) return;
    if (window.MoodFlowApp && typeof window.MoodFlowApp.renderTags === 'function') {
      container.innerHTML = window.MoodFlowApp.renderTags();
    }
    if (window.MoodFlowApp && typeof window.MoodFlowApp.bindAddForm === 'function') {
      window.MoodFlowApp.bindAddForm();
    }
  };

  /* ============================================================
     3. 情话彩蛋库 SWEET_QUOTES（原每日情话功能已移除，情话库保留，
        供互动小游戏通关彩蛋使用）
     ============================================================ */
  var SWEET_QUOTES = [
    '遇见你之后，星河皆可摘，万物皆可期。',
    '别人问我喜欢什么，我又要开始形容你了。',
    '你是年少的欢喜，倒过来也是。',
    '想把世界上最好的都给你，却发现世界上最好的就是你。',
    '我看过一千个关于秋天的句子，都不及这一刻慵懒的你。',
    '你是我在这人间最想留住的小幸运。',
    '山野万里，你是我藏在微风里的欢喜。',
    '月亮不会奔你而来，但我可以。',
    '所有的晦暗都留给过往，从遇见你开始，凛冬散尽，星河长明。',
    '你是无意穿堂风，偏偏孤倨引山洪。',
    '我的世界原本荒芜寸草不生，后来你来走了一遭，奇迹般万物生长。',
    '草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。',
    '如果全世界都对你恶语相加，那我就对你说上一世情话。',
    '你是我猝不及防的心动，也是我始料未及的惊鸿。',
    '海底月是天上月，眼前人是心上人。',
    '这世间青山灼灼，星光杳杳，晚风渐渐，也抵不过你眉目间的星辰。',
    '我写了很多情话，落款都是你。',
    '风止于秋水，我止于你。',
    '你的名字，是我写过最短的情诗。',
    '我见众生皆草木，唯你是青山。',
    '人间太吵了，你来我心里住吧。',
    '你是我的，半截的诗，不许别人更改一个字。',
    '愿岁月可回首，且以深情共白头。',
    '我在贩卖日落，你像神明一样慷慨地将光洒向我。',
    '十里清风，万顷星河，你是我藏在心底的温柔。',
    '我的心里原本荒凉，遇见你之后，开出了漫山遍野的花。',
    '你不用多好，我喜欢就好；我没有很好，你不嫌弃就好。',
    '酸甜苦辣，与你分享；三餐四季，与你共度。',
    '只许一生一世人，只做一世一双人。',
    '想牵你的手，从心动，到古稀，到尽头。',
    '你是我的今天，以及所有的明天。',
    '我喜欢你，像风走了八千里，不问归期。',
    '初见是惊鸿一瞥，南柯一梦是你；等待是山重水复，怦然心动是你。',
    '我携满天星辰赠你，仍觉满天星辰不及你。',
    '你的笑像西瓜最中间那一勺的口感。',
    '这一生，风雨飘摇，还好有你，是我唯一的港湾。',
    '我这一生都是坚定的唯物主义者，唯有你，我希望有来生。',
    '从前的日色变得慢，车、马、邮件都慢，一生只够爱一个人。',
    '你眼里的星河，是我见过最美的宇宙。',
    '喜欢是乍见之欢，爱是久处不厌，而我，对你两者都是。'
  ];

  // 暴露给互动小游戏通关彩蛋使用
  window.SWEET_QUOTES = SWEET_QUOTES;

})();

/* ============================================================
   5. 家庭菜谱 (RecipeApp) v2
   布局：左侧竖向可滑侧边栏分类 + 右侧内容区（玻璃拟态）
   功能：菜谱库（搜索/分类/详情/收藏）
        + 日常饮食记录（按日期+餐次记录、时间轴、删除、localStorage 持久化）
        + 对方角色点评（复用 Storage.getPartnerProfiles 角色体系）
   ============================================================ */
(function () {
  'use strict';

  /* ---- 内置菜谱数据（30 道家常菜） ---- */
  var RECIPES = [
    { id: 'r01', name: '番茄炒蛋', category: '快手菜', emoji: '🍅', time: '10分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#FF9A9E,#FECFEF)',
      ingredients: ['鸡蛋 3个', '番茄 2个', '盐 适量', '白糖 少许', '葱花 少许'],
      steps: ['番茄洗净切块，鸡蛋打散加少许盐搅匀。', '热锅倒油，倒入蛋液炒至凝固盛出。', '锅中留底油，下番茄翻炒出汁。', '加盐和白糖调味，倒回鸡蛋翻炒均匀。', '撒葱花出锅装盘。'] },
    { id: 'r02', name: '红烧肉', category: '家常菜', emoji: '🥩', time: '60分钟', difficulty: '中等', serves: '4人份', color: 'linear-gradient(135deg,#FCCF31,#F55555)',
      ingredients: ['五花肉 500克', '姜 3片', '葱 1段', '八角 2个', '冰糖 适量', '生抽 2勺', '老抽 1勺', '料酒 2勺'],
      steps: ['五花肉切块，冷水下锅加料酒焯水后捞出。', '锅中少许油放冰糖，小火炒出糖色。', '下五花肉翻炒上色，加姜葱八角爆香。', '加生抽老抽和水没过肉，小火炖40分钟。', '大火收汁，撒葱花出锅。'] },
    { id: 'r03', name: '可乐鸡翅', category: '家常菜', emoji: '🍗', time: '30分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#FBC2EB,#A6C1EE)',
      ingredients: ['鸡翅中 8个', '可乐 1罐', '姜 3片', '生抽 2勺', '老抽 少许', '料酒 1勺'],
      steps: ['鸡翅两面划刀，冷水下锅加料酒焯水。', '锅中少油，鸡翅煎至两面金黄。', '加姜片、生抽、老抽翻炒上色。', '倒入可乐没过鸡翅，大火烧开后转小火焖15分钟。', '大火收浓汤汁即可。'] },
    { id: 'r04', name: '鱼香肉丝', category: '家常菜', emoji: '🥢', time: '25分钟', difficulty: '中等', serves: '3人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['里脊肉 200克', '木耳 适量', '胡萝卜 半根', '青椒 1个', '豆瓣酱 1勺', '醋 2勺', '糖 1勺', '生抽 1勺', '水淀粉 适量'],
      steps: ['里脊肉切丝，加少许盐和水淀粉腌制。', '木耳、胡萝卜、青椒切丝备用。', '调鱼香汁：醋、糖、生抽加水淀粉。', '热锅滑熟肉丝盛出。', '下豆瓣酱炒出红油，放配菜翻炒，倒回肉丝淋鱼香汁炒匀。'] },
    { id: 'r05', name: '宫保鸡丁', category: '家常菜', emoji: '🥜', time: '25分钟', difficulty: '中等', serves: '3人份', color: 'linear-gradient(135deg,#A18CD1,#FBC2EB)',
      ingredients: ['鸡胸肉 200克', '花生米 80克', '干辣椒 6个', '花椒 少许', '葱 2根', '生抽 2勺', '醋 2勺', '糖 1勺', '水淀粉 适量'],
      steps: ['鸡胸肉切丁腌制，花生米炸熟备用。', '调宫保汁：生抽、醋、糖、水淀粉。', '热锅下鸡丁滑炒至变色盛出。', '爆香干辣椒、花椒、葱段。', '倒回鸡丁和花生，淋宫保汁翻炒均匀。'] },
    { id: 'r06', name: '糖醋排骨', category: '家常菜', emoji: '🍖', time: '45分钟', difficulty: '中等', serves: '4人份', color: 'linear-gradient(135deg,#FCCF31,#F55555)',
      ingredients: ['肋排 500克', '姜 3片', '料酒 2勺', '生抽 2勺', '老抽 1勺', '醋 3勺', '冰糖 3勺', '熟芝麻 少许'],
      steps: ['排骨焯水后沥干。', '锅中少油炒糖色，下排骨翻炒上色。', '加姜片、料酒、生抽、老抽翻炒。', '加热水没过排骨，小火炖30分钟。', '加醋和冰糖大火收汁，撒白芝麻。'] },
    { id: 'r07', name: '麻婆豆腐', category: '家常菜', emoji: '🌶️', time: '15分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#F6D365,#FDA085)',
      ingredients: ['嫩豆腐 1块', '牛肉末 80克', '豆瓣酱 1勺', '花椒粉 少许', '蒜末 适量', '生抽 1勺', '水淀粉 适量', '葱花 少许'],
      steps: ['豆腐切块，加盐开水浸泡去豆腥。', '热油炒香牛肉末、豆瓣酱和蒜末。', '加一小碗水烧开，放入豆腐轻推煮3分钟。', '分两次勾芡收汁。', '撒花椒粉和葱花出锅。'] },
    { id: 'r08', name: '红烧茄子', category: '家常菜', emoji: '🍆', time: '20分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#84FAB0,#8FD3F4)',
      ingredients: ['长茄子 2根', '蒜 4瓣', '青红椒 各半个', '生抽 2勺', '老抽 少许', '糖 1勺', '豆瓣酱 半勺', '水淀粉 适量'],
      steps: ['茄子切滚刀块，撒盐腌出水后攥干。', '热油煎软茄子盛出。', '爆香蒜末和豆瓣酱。', '下茄子、青红椒，加生抽老抽糖调味。', '勾薄芡翻炒均匀出锅。'] },
    { id: 'r09', name: '木须肉', category: '家常菜', emoji: '🥚', time: '20分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#FBC2EB,#A6C1EE)',
      ingredients: ['里脊肉 150克', '鸡蛋 2个', '木耳 适量', '黄瓜 半根', '黄花菜 少许', '盐 适量', '生抽 1勺'],
      steps: ['肉片腌制，鸡蛋炒散盛出。', '热锅滑炒肉片至变色。', '下木耳、黄花菜、黄瓜翻炒。', '倒回鸡蛋，加盐和生抽炒匀。'] },
    { id: 'r10', name: '青椒肉丝', category: '家常菜', emoji: '🫑', time: '15分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['里脊肉 150克', '青椒 2个', '姜丝 少许', '盐 适量', '生抽 1勺', '水淀粉 适量'],
      steps: ['里脊切丝，加少许盐和水淀粉腌制。', '青椒切丝。', '热锅滑炒肉丝至变色盛出。', '下青椒丝翻炒断生，倒回肉丝加盐和生抽炒匀。'] },
    { id: 'r11', name: '回锅肉', category: '家常菜', emoji: '🥓', time: '25分钟', difficulty: '中等', serves: '3人份', color: 'linear-gradient(135deg,#FCCF31,#F55555)',
      ingredients: ['五花肉 300克', '青蒜 2根', '豆瓣酱 1勺', '豆豉 少许', '甜面酱 半勺', '姜片 适量', '料酒 1勺'],
      steps: ['五花肉加姜片料酒煮至八分熟，放凉切片。', '锅中少油下肉片煸炒至微卷出油。', '下豆瓣酱、豆豉、甜面酱炒出红油。', '下青蒜段大火翻炒断生出锅。'] },
    { id: 'r12', name: '蒜蓉西兰花', category: '快手菜', emoji: '🥦', time: '12分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#84FAB0,#8FD3F4)',
      ingredients: ['西兰花 1颗', '蒜 4瓣', '盐 适量', '蚝油 1勺', '水淀粉 适量'],
      steps: ['西兰花掰小朵，盐水浸泡后焯水。', '沥干摆盘。', '热油爆香蒜末。', '加蚝油、盐和少许水烧开，勾薄芡淋在西兰花上。'] },
    { id: 'r13', name: '酸辣土豆丝', category: '快手菜', emoji: '🥔', time: '12分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#F6D365,#FDA085)',
      ingredients: ['土豆 2个', '干辣椒 4个', '花椒 少许', '白醋 2勺', '盐 适量', '蒜片 适量'],
      steps: ['土豆切细丝，冲洗去淀粉后泡水。', '热油爆香干辣椒、花椒、蒜片。', '下土豆丝大火快炒。', '沿锅边淋白醋，加盐炒至断生出锅。'] },
    { id: 'r14', name: '清炒时蔬', category: '快手菜', emoji: '🥬', time: '10分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#96E6A1,#D4FC79)',
      ingredients: ['时令绿叶菜 400克', '蒜 3瓣', '盐 适量', '食用油 适量'],
      steps: ['青菜洗净沥干，蒜切末。', '热锅热油下蒜末爆香。', '下青菜大火快炒。', '加盐调味，炒至断生即可出锅。'] },
    { id: 'r15', name: '蚝油生菜', category: '快手菜', emoji: '🥗', time: '8分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#96E6A1,#D4FC79)',
      ingredients: ['生菜 2棵', '蚝油 2勺', '生抽 1勺', '蒜 3瓣', '糖 少许', '水淀粉 适量'],
      steps: ['生菜洗净，开水焯烫10秒捞出摆盘。', '热油爆香蒜末。', '加蚝油、生抽、糖和半碗水煮开。', '勾薄芡淋在生菜上。'] },
    { id: 'r16', name: '西红柿鸡蛋汤', category: '汤羹', emoji: '🍲', time: '15分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#FF9A9E,#FECFEF)',
      ingredients: ['番茄 2个', '鸡蛋 2个', '葱花 少许', '盐 适量', '香油 几滴', '水淀粉 适量'],
      steps: ['番茄切块，鸡蛋打散。', '热油炒番茄出汁，加开水煮开。', '淋入蛋液成蛋花。', '加盐调味，勾薄芡撒葱花滴香油。'] },
    { id: 'r17', name: '紫菜蛋花汤', category: '汤羹', emoji: '🍥', time: '10分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#96E6A1,#D4FC79)',
      ingredients: ['紫菜 1小把', '鸡蛋 2个', '虾皮 少许', '葱花 少许', '盐 适量', '香油 几滴'],
      steps: ['锅中加水煮开，放入紫菜和虾皮。', '淋入打散的蛋液成蛋花。', '加盐调味。', '关火撒葱花滴香油。'] },
    { id: 'r18', name: '玉米排骨汤', category: '汤羹', emoji: '🌽', time: '60分钟', difficulty: '中等', serves: '4人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['肋排 500克', '甜玉米 2根', '胡萝卜 1根', '姜 3片', '盐 适量', '枸杞 少许'],
      steps: ['排骨焯水去浮沫。', '玉米切段，胡萝卜切块。', '排骨和姜片加足开水，大火烧开后小火炖30分钟。', '下玉米、胡萝卜再炖20分钟。', '加盐和枸杞，再煮5分钟。'] },
    { id: 'r19', name: '冬瓜丸子汤', category: '汤羹', emoji: '🍈', time: '30分钟', difficulty: '中等', serves: '3人份', color: 'linear-gradient(135deg,#96E6A1,#D4FC79)',
      ingredients: ['猪肉馅 200克', '冬瓜 300克', '鸡蛋清 1个', '姜末 少许', '盐 适量', '胡椒粉 少许', '香油 几滴'],
      steps: ['肉馅加姜末、蛋清、盐和少许水搅打上劲。', '冬瓜去皮切片。', '水微开时下入丸子，撇去浮沫。', '下冬瓜煮至透明。', '加盐、胡椒粉调味，滴香油出锅。'] },
    { id: 'r20', name: '酸辣汤', category: '汤羹', emoji: '🥘', time: '20分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#F6D365,#FDA085)',
      ingredients: ['豆腐 半块', '木耳 适量', '胡萝卜 半根', '鸡蛋 1个', '白醋 3勺', '白胡椒粉 适量', '盐 适量', '水淀粉 适量'],
      steps: ['豆腐、木耳、胡萝卜切丝。', '锅中烧水，下配菜煮开。', '淋入蛋液成蛋花。', '加盐调底味，淋白醋和胡椒粉。', '勾芡出锅。'] },
    { id: 'r21', name: '银耳莲子羹', category: '甜品', emoji: '🫕', time: '90分钟', difficulty: '中等', serves: '4人份', color: 'linear-gradient(135deg,#84FAB0,#8FD3F4)',
      ingredients: ['干银耳 1朵', '莲子 30克', '红枣 6颗', '冰糖 适量', '枸杞 少许'],
      steps: ['银耳提前泡发，撕成小朵。', '银耳、莲子加足量水煮开。', '转小火慢炖50分钟至出胶。', '加红枣、冰糖再炖20分钟。', '关火前撒枸杞。'] },
    { id: 'r22', name: '红糖糍粑', category: '甜品', emoji: '🍡', time: '30分钟', difficulty: '中等', serves: '3人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['糯米粉 200克', '温水 适量', '红糖 50克', '黄豆粉 少许', '食用油 适量'],
      steps: ['糯米粉加温水揉成光滑面团。', '搓成小长条。', '锅中少油煎至两面金黄鼓起。', '红糖加水小火熬成糖浆。', '淋在糍粑上，撒黄豆粉。'] },
    { id: 'r23', name: '红豆沙小圆子', category: '甜品', emoji: '🍡', time: '60分钟', difficulty: '简单', serves: '4人份', color: 'linear-gradient(135deg,#A18CD1,#FBC2EB)',
      ingredients: ['红豆 150克', '糯米小圆子 150克', '冰糖 适量', '清水 适量'],
      steps: ['红豆提前泡一夜，加水煮至软烂。', '加冰糖调味煮成红豆沙。', '另起锅煮小圆子至浮起。', '捞出圆子放入红豆沙中即可。'] },
    { id: 'r24', name: '蛋炒饭', category: '主食', emoji: '🍚', time: '15分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['隔夜米饭 2碗', '鸡蛋 2个', '火腿丁 适量', '玉米粒 适量', '葱花 适量', '盐 适量', '生抽 1勺'],
      steps: ['鸡蛋打散，热油炒碎盛出。', '锅中放油，下米饭炒散。', '加火腿丁和玉米粒翻炒。', '倒回鸡蛋，加盐和生抽炒匀。', '撒葱花出锅。'] },
    { id: 'r25', name: '葱油拌面', category: '主食', emoji: '🍜', time: '15分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#96E6A1,#D4FC79)',
      ingredients: ['细面条 200克', '小葱 1把', '生抽 3勺', '老抽 1勺', '糖 1勺', '食用油 适量'],
      steps: ['小葱切段，冷油下锅小火熬成焦黄葱油。', '加生抽、老抽、糖小火煮开成酱汁。', '面条煮熟过凉水沥干。', '淋上葱油酱汁拌匀，摆上葱段。'] },
    { id: 'r26', name: '拍黄瓜', category: '凉菜', emoji: '🥒', time: '10分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#96E6A1,#D4FC79)',
      ingredients: ['黄瓜 2根', '蒜 4瓣', '醋 2勺', '生抽 1勺', '香油 少许', '盐 适量', '糖 少许'],
      steps: ['黄瓜拍碎切段，加盐腌5分钟倒掉水分。', '蒜末加醋、生抽、糖、香油调成料汁。', '淋在黄瓜上拌匀。', '冷藏片刻更入味。'] },
    { id: 'r27', name: '凉拌木耳', category: '凉菜', emoji: '🍄', time: '15分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#FBC2EB,#A6C1EE)',
      ingredients: ['干木耳 20克', '蒜 3瓣', '小米椒 1个', '香菜 适量', '生抽 2勺', '醋 2勺', '香油 少许', '糖 少许'],
      steps: ['木耳泡发洗净，开水焯2分钟过凉水。', '蒜末、小米椒加生抽、醋、糖、香油调汁。', '淋在木耳上拌匀。', '撒香菜段。'] },
    { id: 'r28', name: '皮蛋瘦肉粥', category: '早餐', emoji: '🥣', time: '45分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#FF9A9E,#FECFEF)',
      ingredients: ['大米 1杯', '皮蛋 2个', '瘦肉 100克', '姜丝 少许', '葱花 少许', '盐 适量', '白胡椒粉 少许'],
      steps: ['大米提前浸泡，加水熬成浓稠白粥。', '瘦肉切丝加盐腌制，皮蛋切丁。', '粥中加入皮蛋和肉丝煮5分钟。', '加姜丝、盐、白胡椒粉调味。', '撒葱花出锅。'] },
    { id: 'r29', name: '葱花鸡蛋饼', category: '早餐', emoji: '🫓', time: '15分钟', difficulty: '简单', serves: '2人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['面粉 150克', '鸡蛋 2个', '小葱 3根', '盐 适量', '清水 适量', '食用油 适量'],
      steps: ['面粉加水调成可流动面糊，打入鸡蛋打匀。', '加葱花和盐拌匀。', '平底锅刷油，舀一勺面糊摊匀。', '小火煎至两面金黄。', '出锅卷起切块。'] },
    { id: 'r30', name: '南瓜小米粥', category: '早餐', emoji: '🎃', time: '40分钟', difficulty: '简单', serves: '3人份', color: 'linear-gradient(135deg,#FFE259,#FFA751)',
      ingredients: ['南瓜 200克', '小米 80克', '红枣 4颗', '冰糖 适量', '清水 适量'],
      steps: ['南瓜去皮切小块。', '小米淘洗干净，与南瓜一同下锅。', '加足量水大火煮开，转小火熬30分钟。', '加红枣、冰糖煮至软烂。', '搅拌一下即可盛出。'] }
  ];

  var FAV_KEY = 'sxz_recipe_favs_v1';
  var DIET_KEY = 'sxz_recipe_diet_v1';
  var CUSTOM_KEY = 'sxz_recipe_custom_v1';
  var MEALS = ['早餐', '午餐', '晚餐', '加餐'];

  function toast(msg) {
    if (window.Core && typeof Core.toast === 'function') { Core.toast(msg); return; }
    try { alert(msg); } catch (e) {}
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, "\\'");
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function nowHM() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  var RecipeApp = {
    mode: 'recipes',
    tab: 'all',
    keyword: '',
    view: 'list',
    currentId: null,
    favs: {},
    diet: [],
    mealSel: '早餐',
    dietDate: '',
    searchOpen: false,
    commentTargetId: null,
    commentRole: null,

    /* ============ 收藏 ============ */
    _loadFavs: function () {
      this.favs = {};
      try {
        var raw = localStorage.getItem(FAV_KEY);
        if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') this.favs = o; }
      } catch (e) {}
    },

    _saveFavs: function () {
      try { localStorage.setItem(FAV_KEY, JSON.stringify(this.favs)); } catch (e) {}
    },

    isFav: function (id) { return !!this.favs[id]; },

    toggleFav: function (id, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (this.favs[id]) { delete this.favs[id]; } else { this.favs[id] = 1; }
      this._saveFavs();
      var r = this.findById(id);
      toast((this.favs[id] ? '已收藏' : '已取消收藏') + '：' + (r ? r.name : ''));
      this.render();
    },

    /* ============ 数据源：内置 + 自定义合并 ============ */
    _loadCustom: function () {
      var arr = [];
      try {
        var raw = localStorage.getItem(CUSTOM_KEY);
        if (raw) {
          var o = JSON.parse(raw);
          if (Array.isArray(o)) arr = o;
        }
      } catch (e) {}
      return arr;
    },

    _saveCustom: function (arr) {
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr)); } catch (e) {}
    },

    /* 合并数据源：自定义菜谱排前 */
    _allRecipes: function () {
      return this._loadCustom().concat(RECIPES);
    },

    /* 按分类自动分配预设渐变色 */
    _catColor: function (cat) {
      var map = {
        '家常菜': 'linear-gradient(135deg,#FBC2EB,#A6C1EE)',
        '快手菜': 'linear-gradient(135deg,#FF9A9E,#FECFEF)',
        '汤羹': 'linear-gradient(135deg,#84FAB0,#8FD3F4)',
        '甜品': 'linear-gradient(135deg,#A18CD1,#FBC2EB)',
        '主食': 'linear-gradient(135deg,#FFE259,#FFA751)',
        '凉菜': 'linear-gradient(135deg,#96E6A1,#D4FC79)',
        '早餐': 'linear-gradient(135deg,#F6D365,#FDA085)'
      };
      return map[cat] || 'linear-gradient(135deg,#FF9A9E,#FECFEF)';
    },

    /* ============ 菜谱查询 ============ */
    findById: function (id) {
      var all = this._allRecipes();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },

    /* ============ 视图切换 ============ */
    setCategory: function (key) {
      this.mode = 'recipes';
      this.tab = key;
      this.keyword = '';
      var el = document.getElementById('recipe-search-input');
      if (el) el.value = '';
      this.render();
    },

    showDiet: function () {
      this.mode = 'diet';
      this.render();
    },

    showRecipes: function () {
      this.mode = 'recipes';
      this.render();
    },

    onSearch: function () {
      var el = document.getElementById('recipe-search-input');
      this.keyword = (el && el.value) || '';
      this.render(true);
    },

    toggleSearch: function () {
      this.searchOpen = !this.searchOpen;
      this.render();
    },

    closeSearch: function () {
      this.searchOpen = false;
      this.keyword = '';
      this.render();
    },

    openDetail: function (id) {
      this.view = 'detail';
      this.currentId = id;
      this.render();
    },

    backToList: function () {
      this.view = 'list';
      this.currentId = null;
      this.render();
    },

    /* ============ 菜谱过滤 ============ */
    _filtered: function () {
      var kw = (this.keyword || '').trim().toLowerCase();
      var out = [];
      var all = this._allRecipes();
      for (var i = 0; i < all.length; i++) {
        var r = all[i];
        if (this.tab === 'favs' && !this.favs[r.id]) continue;
        if (this.tab !== 'all' && this.tab !== 'favs' && r.category !== this.tab) continue;
        if (kw) {
          var hay = (r.name + ' ' + r.category + ' ' + r.ingredients.join(' ')).toLowerCase();
          if (hay.indexOf(kw) === -1) continue;
        }
        out.push(r);
      }
      return out;
    },

    _tabTitle: function () {
      if (this.tab === 'favs') return '⭐ 我的收藏';
      if (this.tab === 'all') return '全部菜谱';
      return this.tab + '菜谱';
    },

    /* ============ 左侧竖向侧边栏 ============ */
    _sidebarHtml: function () {
      var cats = [
        { key: 'all', label: '全部', icon: 'fa-images' },
        { key: '家常菜', label: '家常菜', icon: 'fa-house' },
        { key: '快手菜', label: '快手菜', icon: 'fa-bolt' },
        { key: '汤羹', label: '汤羹', icon: 'fa-tint' },
        { key: '甜品', label: '甜品', icon: 'fa-gift' },
        { key: '主食', label: '主食', icon: 'fa-database' },
        { key: '凉菜', label: '凉菜', icon: 'fa-tree' },
        { key: '早餐', label: '早餐', icon: 'fa-sun' }
      ];
      var html = '<div class="recipe-sidebar">';
      for (var i = 0; i < cats.length; i++) {
        var c = cats[i];
        var act = (this.mode === 'recipes' && this.tab === c.key) ? ' active' : '';
        html += '<button class="recipe-sb-item' + act + '" onclick="RecipeApp.setCategory(\'' + c.key + '\')">' +
          '<i class="fas ' + c.icon + '"></i><span>' + c.label + '</span></button>';
      }
      html += '<div class="recipe-sidebar-sep"></div>';
      var favAct = (this.mode === 'recipes' && this.tab === 'favs') ? ' active' : '';
      html += '<button class="recipe-sb-item' + favAct + '" onclick="RecipeApp.setCategory(\'favs\')">' +
        '<i class="fas fa-star"></i><span>我的收藏</span></button>';
      var dietAct = (this.mode === 'diet') ? ' active' : '';
      html += '<button class="recipe-sb-item' + dietAct + '" onclick="RecipeApp.showDiet()">' +
        '<i class="fas fa-book-open"></i><span>饮食记录</span></button>';
      html += '</div>';
      return html;
    },

    /* ============ 菜谱卡片 ============ */
    _cardHtml: function (r) {
      var fav = this.isFav(r.id);
      return '<div class="recipe-card glass-card" onclick="RecipeApp.openDetail(\'' + r.id + '\')">' +
        '<div class="recipe-cover" style="background:' + r.color + '"><span class="recipe-cover-emoji">' + r.emoji + '</span></div>' +
        '<button class="recipe-fav' + (fav ? ' on' : '') + '" onclick="RecipeApp.toggleFav(\'' + r.id + '\', event)"><i class="fas fa-star"></i></button>' +
        '<div class="recipe-card-body">' +
          '<div class="recipe-name">' + r.name + '</div>' +
          '<div class="recipe-tags"><span class="recipe-tag">⏱ ' + r.time + '</span><span class="recipe-tag">' + r.difficulty + '</span><span class="recipe-tag">' + r.serves + '</span></div>' +
          '<div class="recipe-cat">' + r.category + '</div>' +
        '</div>' +
      '</div>';
    },

    /* ============ 菜谱列表（右侧内容区） ============ */
    _searchbarHtml: function () {
      if (!this.searchOpen) return '';
      return '<div class="recipe-searchbar"><i class="fas fa-search"></i>' +
        '<input type="text" id="recipe-search-input" placeholder="搜索菜谱" oninput="RecipeApp.onSearch()" value="' + escHtml(this.keyword) + '">' +
        '<button class="recipe-searchbar-clear" onclick="RecipeApp.closeSearch()" title="收起搜索"><i class="fas fa-times"></i></button>' +
      '</div>';
    },

    _recipesHtml: function () {
      var list = this._filtered();
      var html = this._searchbarHtml() + '<div class="recipe-list-head"><span class="recipe-list-title">' + this._tabTitle() + '</span><span class="recipe-list-count">共 ' + list.length + ' 道</span></div>';
      if (!list.length) {
        html += '<div class="recipe-empty"><i class="fas fa-book-open"></i>' + (this.tab === 'favs' ? '还没有收藏菜谱，点击卡片右上角星标收藏吧' : '没有找到匹配的菜谱，换个关键词试试') + '</div>';
        return html;
      }
      var grid = '<div class="recipe-grid">';
      for (var i = 0; i < list.length; i++) grid += this._cardHtml(list[i]);
      grid += '</div>';
      return html + grid;
    },

    /* ============ 自定义加菜（玻璃模态表单） ============ */
    openAddModal: function () {
      var colors = [
        'linear-gradient(135deg,#FF9A9E,#FECFEF)',
        'linear-gradient(135deg,#FCCF31,#F55555)',
        'linear-gradient(135deg,#FBC2EB,#A6C1EE)',
        'linear-gradient(135deg,#FFE259,#FFA751)',
        'linear-gradient(135deg,#A18CD1,#FBC2EB)',
        'linear-gradient(135deg,#F6D365,#FDA085)',
        'linear-gradient(135deg,#84FAB0,#8FD3F4)',
        'linear-gradient(135deg,#96E6A1,#D4FC79)'
      ];
      var cats = ['家常菜', '快手菜', '汤羹', '甜品', '主食', '凉菜', '早餐'];
      var diffs = ['简单', '中等', '困难'];
      var colorHtml = '';
      for (var c = 0; c < colors.length; c++) {
        var defAct = (c === 2) ? ' active' : '';
        colorHtml += '<button type="button" class="rc-color-btn' + defAct + '" data-color="' + colors[c] + '" style="background:' + colors[c] + '" onclick="RecipeApp._pickColor(this)"></button>';
      }
      var catHtml = '';
      for (var i = 0; i < cats.length; i++) {
        var cAct = (cats[i] === '家常菜') ? ' active' : '';
        var cChk = (cats[i] === '家常菜') ? ' checked' : '';
        catHtml += '<label class="rc-chip' + cAct + '"><input type="radio" name="rc-cat" value="' + cats[i] + '"' + cChk + ' onchange="RecipeApp._pickCat(this)">' + cats[i] + '</label>';
      }
      var diffHtml = '';
      for (var j = 0; j < diffs.length; j++) {
        var dAct = (diffs[j] === '简单') ? ' active' : '';
        var dChk = (diffs[j] === '简单') ? ' checked' : '';
        diffHtml += '<label class="rc-chip' + dAct + '"><input type="radio" name="rc-diff" value="' + diffs[j] + '"' + dChk + '>' + diffs[j] + '</label>';
      }
      var html =
        '<div class="rc-modal glass-card">' +
          '<div class="rc-modal-title"><i class="fas fa-utensils"></i> 添加菜谱</div>' +
          '<div class="rc-modal-sub">记录你的拿手菜，自动归入对应分类</div>' +
          '<div class="rc-field"><label class="rc-label">菜名<span class="rc-required">*</span></label>' +
            '<input class="rc-input" id="rc-name" placeholder="如：可乐鸡翅" maxlength="20"></div>' +
          '<div class="rc-field"><label class="rc-label">分类<span class="rc-required">*</span></label>' +
            '<div class="rc-chip-group">' + catHtml + '</div></div>' +
          '<div class="rc-inline-row">' +
            '<div class="rc-field"><label class="rc-label">Emoji</label><input class="rc-input" id="rc-emoji" value="🍲" maxlength="4"></div>' +
            '<div class="rc-field"><label class="rc-label">时长</label><input class="rc-input" id="rc-time" placeholder="如 30分钟"></div>' +
          '</div>' +
          '<div class="rc-field"><label class="rc-label">难度</label><div class="rc-chip-group">' + diffHtml + '</div></div>' +
          '<div class="rc-field"><label class="rc-label">人数</label><input class="rc-input" id="rc-serves" placeholder="如 2人份"></div>' +
          '<div class="rc-field"><label class="rc-label">封面颜色</label><div class="rc-color-group">' + colorHtml + '</div></div>' +
          '<div class="rc-field"><label class="rc-label">用料清单<span class="rc-required">*</span></label>' +
            '<textarea class="rc-textarea" id="rc-ing" placeholder="每行一种用料，如：&#10;鸡翅中 8个&#10;可乐 1罐"></textarea></div>' +
          '<div class="rc-field"><label class="rc-label">做法步骤<span class="rc-required">*</span></label>' +
            '<textarea class="rc-textarea" id="rc-steps" placeholder="每行一步，如：&#10;鸡翅两面划刀焯水&#10;煎至两面金黄"></textarea></div>' +
          '<div class="rc-modal-actions">' +
            '<button class="glass-btn" onclick="RecipeApp._closeAddModal()">取消</button>' +
            '<button class="glass-btn primary" onclick="RecipeApp.saveCustomRecipe()"><i class="fas fa-check"></i> 保存菜谱</button>' +
          '</div>' +
        '</div>';
      this._showAddOverlay(html);
    },

    _showAddOverlay: function (html) {
      this._closeAddModal();
      var ov = document.createElement('div');
      ov.className = 'glass-modal-overlay';
      ov.id = 'recipe-add-overlay';
      ov.onclick = function () { RecipeApp._closeAddModal(); };
      ov.innerHTML = '<div class="glass-modal-panel" onclick="event.stopPropagation()">' + html + '</div>';
      document.body.appendChild(ov);
    },

    _closeAddModal: function () {
      var ov = document.getElementById('recipe-add-overlay');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    },

    _pickCat: function (el) {
      var chips = document.querySelectorAll('#recipe-add-overlay input[name="rc-cat"]');
      for (var i = 0; i < chips.length; i++) {
        chips[i].parentNode.classList.toggle('active', chips[i].checked);
      }
    },

    _pickColor: function (el) {
      var btns = document.querySelectorAll('#recipe-add-overlay .rc-color-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
      el.classList.add('active');
    },

    saveCustomRecipe: function () {
      var nameEl = document.getElementById('rc-name');
      var name = (nameEl && nameEl.value || '').trim();
      var catEl = document.querySelector('#recipe-add-overlay input[name="rc-cat"]:checked');
      var emojiEl = document.getElementById('rc-emoji');
      var timeEl = document.getElementById('rc-time');
      var diffEl = document.querySelector('#recipe-add-overlay input[name="rc-diff"]:checked');
      var servesEl = document.getElementById('rc-serves');
      var colorEl = document.querySelector('#recipe-add-overlay .rc-color-btn.active');
      var ingRaw = ((document.getElementById('rc-ing') || {}).value || '').split('\n');
      var stepRaw = ((document.getElementById('rc-steps') || {}).value || '').split('\n');
      var ing = [], steps = [];
      for (var i = 0; i < ingRaw.length; i++) if (ingRaw[i].trim()) ing.push(escHtml(ingRaw[i].trim()));
      for (var j = 0; j < stepRaw.length; j++) if (stepRaw[j].trim()) steps.push(escHtml(stepRaw[j].trim()));
      if (!name) { toast('请填写菜名'); return; }
      if (!catEl) { toast('请选择分类'); return; }
      if (!ing.length || !steps.length) { toast('请填写用料清单和做法步骤'); return; }
      var rec = {
        id: 'c' + Date.now(),
        name: escHtml(name),
        category: catEl.value,
        emoji: escHtml((emojiEl && emojiEl.value || '').trim() || '🍲'),
        time: escHtml((timeEl && timeEl.value || '').trim() || '约30分钟'),
        difficulty: diffEl ? diffEl.value : '简单',
        serves: escHtml((servesEl && servesEl.value || '').trim() || '2人份'),
        color: colorEl ? colorEl.getAttribute('data-color') : this._catColor(catEl.value),
        ingredients: ing,
        steps: steps,
        custom: true
      };
      var arr = this._loadCustom();
      arr.unshift(rec);
      this._saveCustom(arr);
      this._closeAddModal();
      toast('已添加菜谱：' + rec.name);
      this.render();
    },

    /* ============ 菜谱详情 ============ */
    _detailHtml: function () {
      var r = this.findById(this.currentId);
      if (!r) { this.view = 'list'; return this._recipesHtml(); }
      var fav = this.isFav(r.id);
      var ing = '';
      for (var i = 0; i < r.ingredients.length; i++) ing += '<div class="recipe-ingredient">' + r.ingredients[i] + '</div>';
      var steps = '';
      for (var j = 0; j < r.steps.length; j++) {
        steps += '<div class="recipe-step"><span class="recipe-step-num">' + (j + 1) + '</span><span>' + r.steps[j] + '</span></div>';
      }
      return '<div class="recipe-detail">' +
        '<button class="glass-btn recipe-back" onclick="RecipeApp.backToList()"><i class="fas fa-chevron-left"></i> 返回菜谱列表</button>' +
        '<div class="recipe-detail-cover glass-card" style="background:' + r.color + '"><span class="recipe-detail-emoji">' + r.emoji + '</span></div>' +
        '<div class="recipe-detail-title">' + r.name + '</div>' +
        '<div class="recipe-detail-meta">' +
          '<span><i class="fas fa-clock"></i> ' + r.time + '</span>' +
          '<span><i class="fas fa-tachometer-alt"></i> 难度：' + r.difficulty + '</span>' +
          '<span><i class="fas fa-users"></i> ' + r.serves + '</span>' +
        '</div>' +
        '<div class="recipe-detail-fav-row">' +
          '<button class="recipe-detail-fav' + (fav ? ' on' : '') + '" onclick="RecipeApp.toggleFav(\'' + r.id + '\', event)"><i class="fas fa-star"></i> ' + (fav ? '已收藏' : '收藏') + '</button>' +
        '</div>' +
        '<div class="recipe-section-title"><i class="fas fa-clipboard-list"></i> 用料清单</div>' +
        '<div class="recipe-ingredients glass-card">' + ing + '</div>' +
        '<div class="recipe-section-title"><i class="fas fa-clipboard-check"></i> 做法步骤</div>' +
        '<div class="recipe-steps">' + steps + '</div>' +
      '</div>';
    },

    /* ============ 日常饮食记录 ============ */
    _loadDiet: function () {
      this.diet = [];
      var raw = null;
      try { raw = localStorage.getItem(DIET_KEY); } catch (e) {}
      if (!raw) { try { raw = sessionStorage.getItem(DIET_KEY); } catch (e) {} }
      if (raw) {
        try {
          var arr = JSON.parse(raw);
          if (Object.prototype.toString.call(arr) === '[object Array]') this.diet = arr;
        } catch (e) {}
      }
    },

    _saveDiet: function () {
      var json = JSON.stringify(this.diet);
      try { localStorage.setItem(DIET_KEY, json); } catch (e) {}
      try { sessionStorage.setItem(DIET_KEY, json); } catch (e) {}
    },

    getDiet: function (id) {
      for (var i = 0; i < this.diet.length; i++) if (this.diet[i].id === id) return this.diet[i];
      return null;
    },

    setMeal: function (m) {
      this.mealSel = m;
      var wrap = document.getElementById('recipe-diet-meals');
      if (wrap) {
        var btns = wrap.querySelectorAll('.recipe-diet-meal');
        for (var i = 0; i < btns.length; i++) {
          btns[i].className = 'recipe-diet-meal' + (btns[i].getAttribute('data-meal') === m ? ' active' : '');
        }
      }
    },

    _setDietDate: function (v) { this.dietDate = v; },

    addDiet: function () {
      var inp = document.getElementById('recipe-diet-text');
      var text = (inp && inp.value || '').trim();
      if (!text) { toast('先写下今天吃了什么吧～'); return; }
      var dateInp = document.getElementById('recipe-diet-date');
      var date = (dateInp && dateInp.value) || this.dietDate || todayStr();
      var rec = { id: 'd' + Date.now(), date: date, meal: this.mealSel, time: nowHM(), text: text, comments: [] };
      this.diet.push(rec);
      this._saveDiet();
      if (inp) inp.value = '';
      toast('已记录「' + date + ' ' + this.mealSel + '」');
      this.render(true);
    },

    delDiet: function (id) {
      var next = [];
      for (var i = 0; i < this.diet.length; i++) if (this.diet[i].id !== id) next.push(this.diet[i]);
      this.diet = next;
      this._saveDiet();
      toast('已删除该条记录');
      this.render(true);
    },

    _dietSorted: function () {
      var arr = this.diet.slice();
      arr.sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (a.time || '') < (b.time || '') ? 1 : -1;
      });
      return arr;
    },

    _dietHtml: function () {
      if (!this.dietDate) this.dietDate = todayStr();
      var dateInp = '<input type="date" id="recipe-diet-date" class="recipe-diet-date" value="' + escHtml(this.dietDate) + '" onchange="RecipeApp._setDietDate(this.value)">';
      var meals = '<div class="recipe-diet-meals" id="recipe-diet-meals">';
      for (var i = 0; i < MEALS.length; i++) {
        var m = MEALS[i];
        meals += '<button class="recipe-diet-meal' + (this.mealSel === m ? ' active' : '') + '" data-meal="' + m + '" onclick="RecipeApp.setMeal(\'' + m + '\')">' + m + '</button>';
      }
      meals += '</div>';

      var composer = '<div class="recipe-diet-composer glass-card">' +
        '<div class="recipe-diet-composer-title"><i class="fas fa-clipboard-list"></i> 记一笔今天吃了啥</div>' +
        '<div class="recipe-diet-composer-row">' + dateInp + meals + '</div>' +
        '<input type="text" class="recipe-diet-input" id="recipe-diet-text" placeholder="如：番茄炒蛋 + 米饭 🍚" maxlength="60">' +
        '<button class="glass-btn primary recipe-diet-add" onclick="RecipeApp.addDiet()"><i class="fas fa-plus"></i> 添加记录</button>' +
      '</div>';

      var arr = this._dietSorted();
      var listHtml = '';
      if (!arr.length) {
        listHtml = '<div class="recipe-empty"><i class="fas fa-book-open"></i>还没有饮食记录，记下今天的一餐吧</div>';
      } else {
        listHtml = '<div class="recipe-diet-list">';
        var lastDay = '';
        for (var j = 0; j < arr.length; j++) {
          var it = arr[j];
          if (it.date !== lastDay) {
            lastDay = it.date;
            listHtml += '<div class="recipe-diet-day">' + (it.date === todayStr() ? '今天 · ' + it.date : it.date) + '</div>';
          }
          listHtml += this._dietItemHtml(it);
        }
        listHtml += '</div>';
      }

      return '<div class="recipe-diet-top"><button class="glass-btn recipe-diet-back" onclick="RecipeApp.showRecipes()"><i class="fas fa-chevron-left"></i> 返回菜谱库</button></div>' +
        '<div class="recipe-diet-page-title"><i class="fas fa-book-open"></i> 日常饮食记录</div>' +
        composer + listHtml;
    },

    _dietItemHtml: function (it) {
      var comments = it.comments || [];
      var html = '<div class="recipe-diet-item glass-card">' +
        '<div class="recipe-diet-item-head">' +
          '<span class="recipe-diet-meal-tag">' + escHtml(it.meal) + '</span>' +
          '<span class="recipe-diet-item-time">' + escHtml(it.time || '') + '</span>' +
          '<button class="recipe-diet-del" onclick="RecipeApp.delDiet(\'' + it.id + '\')" title="删除这条记录"><i class="fas fa-trash-alt"></i></button>' +
        '</div>' +
        '<div class="recipe-diet-item-text">' + escHtml(it.text) + '</div>';
      if (comments.length) {
        html += '<div class="recipe-comments">';
        for (var i = 0; i < comments.length; i++) {
          html += this._commentHtml(it.id, comments[i]);
        }
        html += '</div>';
      }
      html += '<button class="recipe-diet-comment-btn" onclick="RecipeApp.openComment(\'' + it.id + '\')"><i class="fas fa-comment-dots"></i> ' +
        (comments.length ? '点评 · ' + comments.length : '写点评') + '</button></div>';
      return html;
    },

    _commentHtml: function (recordId, c) {
      var av = '<div class="recipe-comment-avatar' + (c.avatarShape === 'square' ? ' square' : '') + '" style="background:' + c.avatarColor + '">' + escHtml(c.avatar || '?') + '</div>';
      if (c.avatarImage) {
        av = '<div class="recipe-comment-avatar' + (c.avatarShape === 'square' ? ' square' : '') + '" style="background:' + c.avatarColor + ';background-image:url(' + c.avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat"></div>';
      }
      return '<div class="recipe-comment">' +
        av +
        '<div class="recipe-comment-body">' +
          '<div class="recipe-comment-name">' + escHtml(c.nickname || '角色') +
            '<button class="recipe-comment-del" onclick="RecipeApp.delComment(\'' + recordId + '\',\'' + c.id + '\')" title="删除点评"><i class="fas fa-times"></i></button>' +
          '</div>' +
          '<div class="recipe-comment-bubble">' + escHtml(c.text) + '</div>' +
        '</div>' +
      '</div>';
    },

    /* ============ 对方角色点评 ============ */
    _roleAvatarHtml: function (p, cls) {
      var shape = p.avatarShape === 'square' ? ' square' : '';
      if (p.avatarImage) {
        return '<div class="' + cls + shape + '" style="background:' + p.avatarColor + ';background-image:url(' + p.avatarImage + ');background-size:cover;background-position:center;background-repeat:no-repeat"></div>';
      }
      return '<div class="' + cls + shape + '" style="background:' + p.avatarColor + '">' + escHtml(p.avatar || '?') + '</div>';
    },

    _getRoles: function () {
      try {
        if (window.Storage && typeof Storage.getPartnerProfiles === 'function') {
          return Storage.getPartnerProfiles();
        }
      } catch (e) {}
      return [];
    },

    openComment: function (recordId) {
      var rec = this.getDiet(recordId);
      if (!rec) return;
      var roles = this._getRoles();
      if (!roles || !roles.length) {
        var panelNo = '<div class="glass-modal-title">点评饮食记录</div>' +
          '<div class="recipe-comment-empty">暂未配置任何角色，无法发起点评。<br>请先前往「设置 → 角色」添加另一半的角色。</div>' +
          '<div class="glass-modal-actions">' +
            '<button class="glass-btn primary" onclick="RecipeApp._closeCommentOverlay();Navigation.switchTab(\'settings\');"><i class="fas fa-users"></i> 去设置添加</button>' +
            '<button class="glass-btn" onclick="RecipeApp._closeCommentOverlay()">取消</button>' +
          '</div>';
        this._showOverlay(panelNo);
        return;
      }
      this.commentTargetId = recordId;
      this.commentRole = roles[0];
      var listHtml = '';
      for (var i = 0; i < roles.length; i++) {
        var p = roles[i];
        var active = i === 0 ? ' active' : '';
        listHtml += '<div class="recipe-role-option' + active + '" onclick="RecipeApp._pickRole(' + i + ')">' +
          this._roleAvatarHtml(p, 'recipe-role-avatar') +
          '<span class="recipe-role-name">' + escHtml(p.nickname) + '</span>' +
          '<span class="recipe-role-check"><i class="fas fa-check"></i></span>' +
        '</div>';
      }
      var panel = '<div class="glass-modal-title">选择角色点评</div>' +
        '<div class="recipe-role-list">' + listHtml + '</div>' +
        '<textarea class="recipe-comment-input" id="recipe-comment-text" rows="3" maxlength="120" placeholder="以这位角色的身份说点什么…"></textarea>' +
        '<div class="glass-modal-actions">' +
          '<button class="glass-btn" onclick="RecipeApp._closeCommentOverlay()">取消</button>' +
          '<button class="glass-btn primary" onclick="RecipeApp._sendComment()"><i class="fas fa-paper-plane"></i> 发布点评</button>' +
        '</div>';
      this._showOverlay(panel);
    },

    _pickRole: function (idx) {
      var roles = this._getRoles();
      if (!roles[idx]) return;
      this.commentRole = roles[idx];
      var opts = document.getElementsByClassName('recipe-role-option');
      for (var i = 0; i < opts.length; i++) {
        opts[i].className = 'recipe-role-option' + (i === idx ? ' active' : '');
      }
    },

    _sendComment: function () {
      var input = document.getElementById('recipe-comment-text');
      var text = (input && input.value || '').trim();
      if (!text) { toast('写点什么再发布吧～'); return; }
      var rec = this.getDiet(this.commentTargetId);
      if (!rec) { this._closeCommentOverlay(); return; }
      var role = this.commentRole || {};
      rec.comments = rec.comments || [];
      rec.comments.push({
        id: 'c' + Date.now(),
        partnerId: role.id || '',
        nickname: role.nickname || '角色',
        avatar: role.avatar || '?',
        avatarColor: role.avatarColor || '#C8B8E0',
        avatarImage: role.avatarImage || '',
        avatarShape: role.avatarShape || 'circle',
        text: text,
        ts: nowHM()
      });
      this._saveDiet();
      this._closeCommentOverlay();
      toast('点评已发布');
      this.render(true);
    },

    delComment: function (recordId, commentId) {
      var rec = this.getDiet(recordId);
      if (!rec) return;
      var next = [];
      var c = rec.comments || [];
      for (var i = 0; i < c.length; i++) if (c[i].id !== commentId) next.push(c[i]);
      rec.comments = next;
      this._saveDiet();
      toast('已删除点评');
      this.render(true);
    },

    _showOverlay: function (html) {
      this._closeCommentOverlay();
      var ov = document.createElement('div');
      ov.className = 'glass-modal-overlay';
      ov.id = 'recipe-comment-overlay';
      ov.onclick = function () { RecipeApp._closeCommentOverlay(); };
      ov.innerHTML = '<div class="glass-modal-panel" onclick="event.stopPropagation()">' + html + '</div>';
      document.body.appendChild(ov);
    },

    _closeCommentOverlay: function () {
      var ov = document.getElementById('recipe-comment-overlay');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    },

    /* ============ 主渲染 ============ */
    render: function (skipLoad) {
      var container = document.getElementById('recipe-container');
      if (!container) return;
      if (!skipLoad) {
        this._loadFavs();
        this._loadDiet();
      }

      if (this.view === 'detail') {
        container.innerHTML = '<div class="recipe-shell"><div class="recipe-main">' + this._detailHtml() + '</div></div>';
        return;
      }

      var mainHtml = this.mode === 'diet' ? this._dietHtml() : this._recipesHtml();
      container.innerHTML = '<div class="recipe-shell">' + this._sidebarHtml() +
        '<div class="recipe-main">' + mainHtml + '</div></div>';
      var si = document.getElementById('recipe-search-input');
      if (si && si.value !== this.keyword) si.value = this.keyword;
      var btn = document.getElementById('recipe-search-btn');
      if (btn) btn.classList.toggle('active', this.searchOpen);
    },

  };

  window.RecipeApp = RecipeApp;
  window.renderRecipe = function () {
    window.RecipeApp.render();
  };
})();
