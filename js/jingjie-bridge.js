/* ============================================================================
 * 镜界嵌入桥接（拾心界侧）
 * 提供 openJingJie()：全屏 iframe 嵌入 ./镜界/index.html
 * 监听 {type:'back-to-shixinjie'} message 回到拾心界
 * 暴露全局兜底 window.__shxjBackJingJie__
 * ==========================================================================*/
(function () {
  'use strict';

  var JINGJIE_IFRAME_SRC = './镜界/index.html';
  var CONTAINER_ID = 'jingjie-embed-container';
  var containerNode = null;
  var opened = false;

  function getContainer() {
    if (containerNode && document.body && document.body.contains(containerNode)) {
      return containerNode;
    }
    containerNode = null;
    return null;
  }

  function ensureContainer() {
    var el = getContainer();
    if (el) return el;

    el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = CONTAINER_ID;

      var frame = document.createElement('iframe');
      frame.id = CONTAINER_ID + '-frame';
      frame.src = JINGJIE_IFRAME_SRC;
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('allowfullscreen', 'true');
      frame.setAttribute('loading', 'eager');
      frame.setAttribute('allow', 'fullscreen');

      el.appendChild(frame);
      document.body.appendChild(el);
    }
    containerNode = el;
    return el;
  }

  function hideFloating() {
    // 隐藏拾心界可能仍在屏幕上的加号菜单等浮层
    if (typeof closePlusMenu === 'function') {
      try { closePlusMenu(); } catch (e) { /* 忽略 */ }
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (e) { /* 忽略 */ }
    }
  }

  function openJingJie() {
    hideFloating();
    var el = ensureContainer();
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#ffffff;display:block;';
    opened = true;
  }

  function closeJingJie() {
    var el = getContainer();
    if (el) el.style.display = 'none';
    opened = false;
  }

  // 全局兜底回退函数（供镜界侧直调）
  window.__shxjBackJingJie__ = closeJingJie;

  // message 监听，带防重复标志
  window.addEventListener('message', function (event) {
    try {
      if (!event || !event.data) return;
      var data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { /* 非 JSON 忽略 */ }
      }
      if (data && data.type === 'back-to-shixinjie') {
        closeJingJie();
      }
    } catch (e) { /* 忽略异常，保证拾心界正常 */ }
  });

  window.openJingJie = openJingJie;
  window.closeJingJie = closeJingJie;
})();
