/* ==========================================================================
   Vedvan — core bootstrap
   Owns global config, plugin registration and the page lifecycle.

   Lifecycle
   - Vedvan.registerGlobal(fn)        persistent UI outside the Barba container
                                      (header, menu); runs once.
   - Vedvan.registerPage(ns, fn)      page-scoped setup for a Barba namespace.
                                      fn({ container, mm }) may return a cleanup.
                                      Put every GSAP tween / ScrollTrigger inside
                                      mm.add(...) so it is reverted on leave.
   - Vedvan.initPage / destroyPage    called on first load and by Barba hooks.

   Events dispatched on document: "vedvan:page:init", "vedvan:page:destroy".
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var currentScript = document.currentScript;
  var scriptBase = new URL('.', currentScript ? currentScript.src : window.location.href);
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  var config = {
    breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
    media: {
      motionOK: '(prefers-reduced-motion: no-preference)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
      mobile: '(max-width: 767.98px)',
      desktop: '(min-width: 768px)'
    },
    ease: {
      out: 'expo.out',
      inOut: 'power3.inOut',
      soft: 'power2.out'
    },
    lenis: {
      // Trackpads and programmatic scrolls; trackpads already add OS momentum
      lerp: 0.1,
      // Notched mouse wheels: a little softer so separate notches blend into one glide
      wheelLerp: 0.08,
      wheelMultiplier: 1,
      smoothWheel: true
    },
    barba: {
      // Barba fetches pages over HTTP; it cannot work from file://
      enabled: window.location.protocol !== 'file:'
    },
    three: {
      moduleUrl: new URL('three-scene.js', scriptBase).href,
      maxPixelRatio: 1.75
    }
  };

  var globals = [];
  var pages = new Map();
  var current = null;
  var started = false;
  var pageToken = 0;

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function hasGSAP() {
    return typeof window.gsap !== 'undefined';
  }

  function hasScrollTrigger() {
    return typeof window.ScrollTrigger !== 'undefined';
  }

  function supportsWebGL() {
    try {
      var canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  function safeRun(label, fn) {
    try {
      return fn();
    } catch (error) {
      console.error('[Vedvan] ' + label + ' failed:', error);
      return undefined;
    }
  }

  function refreshScroll() {
    if (hasScrollTrigger()) window.ScrollTrigger.refresh();
  }

  /* Three.js is only fetched when a container holds [data-three-scene]. */
  function mountThreeScenes(container, token, cleanups) {
    var targets = container.querySelectorAll('[data-three-scene]');
    if (!targets.length) return;
    if (!supportsWebGL()) {
      root.classList.add('no-webgl');
      return;
    }

    import(config.three.moduleUrl)
      .then(function (mod) {
        if (token !== pageToken) return;
        targets.forEach(function (el) {
          var destroy = safeRun('Three scene', function () {
            return mod.mountScene(el, {
              reducedMotion: reducedMotionQuery.matches,
              maxPixelRatio: config.three.maxPixelRatio
            });
          });
          if (typeof destroy === 'function') cleanups.push(destroy);
        });
      })
      .catch(function (error) {
        console.warn('[Vedvan] Three.js scene could not be loaded:', error);
      });
  }

  function initPage(container) {
    if (!container) return;
    destroyPage();

    var namespace = container.getAttribute('data-barba-namespace') || 'default';
    var mm = hasGSAP() ? window.gsap.matchMedia() : null;
    var cleanups = [];
    var token = ++pageToken;

    (pages.get(namespace) || []).forEach(function (setup) {
      var cleanup = safeRun('Page "' + namespace + '" setup', function () {
        return setup({ container: container, namespace: namespace, mm: mm });
      });
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    });

    mountThreeScenes(container, token, cleanups);

    current = { namespace: namespace, container: container, mm: mm, cleanups: cleanups };
    root.setAttribute('data-page', namespace);
    emit('vedvan:page:init', { namespace: namespace, container: container });
    refreshScroll();
  }

  function destroyPage() {
    if (!current) return;
    var page = current;
    current = null;
    pageToken++;

    emit('vedvan:page:destroy', { namespace: page.namespace, container: page.container });
    page.cleanups.reverse().forEach(function (cleanup) {
      safeRun('Page cleanup', cleanup);
    });
    if (page.mm) page.mm.revert();
  }

  function start() {
    if (started) return;
    started = true;

    if (hasGSAP()) {
      if (hasScrollTrigger()) window.gsap.registerPlugin(window.ScrollTrigger);
      window.gsap.defaults({ ease: config.ease.out, duration: 0.9 });
    } else {
      console.warn('[Vedvan] GSAP did not load; animations are disabled.');
      root.classList.add('anim-failed');
    }

    if (Vedvan.scroll) safeRun('Smooth scroll', Vedvan.scroll.init);

    globals.forEach(function (setup) {
      safeRun('Global setup', setup);
    });

    initPage(document.querySelector('[data-barba="container"]') || document.body);

    if (Vedvan.transitions) safeRun('Page transitions', Vedvan.transitions.init);

    root.classList.add('is-ready');

    // Late layout changes (web fonts, images) shift trigger positions
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshScroll);
    window.addEventListener('load', refreshScroll, { once: true });
  }

  var Vedvan = (window.Vedvan = {
    config: config,
    root: root,
    supportsWebGL: supportsWebGL,
    refreshScroll: refreshScroll,
    get prefersReducedMotion() {
      return reducedMotionQuery.matches;
    },
    onReducedMotionChange: function (fn) {
      reducedMotionQuery.addEventListener('change', fn);
      return function () {
        reducedMotionQuery.removeEventListener('change', fn);
      };
    },
    registerGlobal: function (setup) {
      globals.push(setup);
    },
    registerPage: function (namespace, setup) {
      if (!pages.has(namespace)) pages.set(namespace, []);
      pages.get(namespace).push(setup);
    },
    initPage: initPage,
    destroyPage: destroyPage,
    get currentPage() {
      return current ? current.namespace : null;
    }
  });

  // Deferred scripts run while readyState is already "interactive", and the
  // event loop can turn between them, so a readyState check or setTimeout
  // would start before later modules register. DOMContentLoaded fires only
  // after every deferred script; "load" covers late (non-deferred) inclusion.
  if (document.readyState === 'complete') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
    window.addEventListener('load', start, { once: true });
  }
})();
