/* ============================================================
 * MirrorLibs —— 镜界重型依赖「按需惰性加载」器
 * ------------------------------------------------------------
 * 背景：jszip / pdf.js / mammoth 原先以 <script defer> 同步写在 index.html head，
 * 浏览器必须等这三个 CDN 脚本「下载 + 执行」完成才会触发 DOMContentLoaded，
 * 在部署环境（弱网 / CDN 不可达）下会把欢迎页的展示与首屏交互拖到不可控。
 *
 * 现在：
 *   1) 页面 load 之后空闲预取（不阻塞欢迎页首帧）；
 *   2) 功能首次使用前通过 MirrorLibs.ensure(name) / withLib(name, fn) 自动补齐；
 *   3) 单个 CDN 失败自动切备用源，全部失败则沿用 app.js 原有降级逻辑
 *      （提取搜索文本返回空 / PDF 回退原生查看器）；
 *   4) pdf.js 3.x 必须显式指定 worker，加载成功后自动绑定 workerSrc。
 * ============================================================ */
(function () {
    'use strict';

    var SOURCES = {
        jszip: {
            global: 'JSZip',
            urls: [
                'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
                'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
            ]
        },
        pdfjs: {
            global: 'pdfjsLib',
            urls: [
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
                'https://cdn.jsdelivr.net/npm/pdf.js@3.11.174/build/pdf.min.js'
            ],
            workerSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        },
        mammoth: {
            global: 'mammoth',
            urls: [
                'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
                'https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js'
            ]
        }
    };

    var pending = {};   /* name -> Promise（在途加载） */

    function isReady(name) {
        var def = SOURCES[name];
        if (!def) return true;
        return typeof window[def.global] !== 'undefined';
    }

    function injectScript(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = function () { resolve(url); };
            s.onerror = function () { reject(new Error('依赖加载失败: ' + url)); };
            document.head.appendChild(s);
        });
    }

    /* pdf.js 3.x 缺少 worker 时无法解析文档，加载成功后立即绑定 */
    function bindPdfWorker() {
        try {
            var def = SOURCES.pdfjs;
            if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions &&
                !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = def.workerSrc;
            }
        } catch (e) { /* 忽略 */ }
    }

    /* 加载指定依赖：已就绪直接 resolve，在途复用同一 Promise，多源顺序重试 */
    function load(name) {
        if (!SOURCES[name]) return Promise.reject(new Error('未知依赖: ' + name));
        if (isReady(name)) { if (name === 'pdfjs') bindPdfWorker(); return Promise.resolve(true); }
        if (pending[name]) return pending[name];

        var urls = SOURCES[name].urls.slice();
        var p = new Promise(function (resolve, reject) {
            (function tryNext(i) {
                if (i >= urls.length) { reject(new Error(name + ' 全部加载源均失败')); return; }
                injectScript(urls[i]).then(function () {
                    if (name === 'pdfjs') bindPdfWorker();
                    if (isReady(name)) resolve(true);
                    else tryNext(i + 1);   /* 脚本 200 但全局未挂载：换源重试 */
                }).catch(function () { tryNext(i + 1); });
            })(0);
        });
        pending[name] = p;
        p.catch(function () { delete pending[name]; });   /* 失败后允许下次重试 */
        return p;
    }

    /* 空闲预取：把 CDN 下载挪到欢迎页展示之后，不影响首屏流畅度 */
    function prefetch() {
        ['jszip', 'pdfjs', 'mammoth'].forEach(function (n) {
            load(n).catch(function () { /* 预取失败静默，等真正用到时再重试 */ });
        });
    }

    /* 功能入口包装：库就绪或补齐后执行 fn，失败也执行 fn（由调用方走原有降级分支） */
    function withLib(name, fn) {
        if (isReady(name)) { fn(true); return; }
        load(name).then(function () { fn(true); }, function () { fn(false); });
    }

    window.MirrorLibs = {
        load: load,
        ensure: load,
        withLib: withLib,
        isReady: isReady,
        prefetch: prefetch,
        sources: SOURCES
    };

    /* 触发时机：load 之后 + 2.5s 兜底（load 迟迟不来的弱网场景），load 内部已去重 */
    if (document.readyState === 'complete') {
        setTimeout(prefetch, 0);
    } else {
        window.addEventListener('load', function () { setTimeout(prefetch, 200); });
        setTimeout(prefetch, 2500);
    }
})();
