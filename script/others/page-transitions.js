/* ==========================================================================
   Vedvan — page transitions (Barba.js 2.10)
   Pages opt in with:
     <div data-barba="wrapper">
       <main data-barba="container" data-barba-namespace="home">…</main>
     </div>
   Links opt out with data-barba-prevent. Barba only swaps the container and
   <title>; every page must therefore link the same global CSS/JS bundle.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  var overlay = null;

  function isSamePageHash(href) {
    var url = new URL(href, window.location.href);
    return url.hash !== '' &&
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname;
  }

  function coverScreen() {
    var gsap = window.gsap;
    if (!gsap || !overlay) return Promise.resolve();
    var logo = overlay.querySelector('[data-transition-logo]');
    var clouds = overlay.querySelectorAll('[data-transition-cloud]');

    if (V.prefersReducedMotion) {
      gsap.set(clouds, { autoAlpha: 1 });
      gsap.set(logo, { autoAlpha: 1 });
      return gsap.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'none' });
    }
    return gsap.timeline()
      .fromTo(overlay, { autoAlpha: 1, clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: V.config.ease.inOut })
      .fromTo(clouds[0], { autoAlpha: 0, xPercent: 10, yPercent: 8 },
        { autoAlpha: 1, xPercent: 0, yPercent: 0, duration: 0.9, ease: 'power2.out' }, 0.2)
      .fromTo(clouds[1], { autoAlpha: 0, xPercent: -8, yPercent: 10 },
        { autoAlpha: 1, xPercent: 0, yPercent: 0, duration: 1, ease: 'power2.out' }, 0.25)
      .fromTo(logo, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.55);
  }

  function revealScreen() {
    var gsap = window.gsap;
    if (!gsap || !overlay) return Promise.resolve();
    var logo = overlay.querySelector('[data-transition-logo]');
    var clouds = overlay.querySelectorAll('[data-transition-cloud]');

    if (V.prefersReducedMotion) {
      return gsap.to(overlay, { autoAlpha: 0, duration: 0.2, ease: 'none' });
    }
    return gsap.timeline()
      .to(logo, { autoAlpha: 0, duration: 0.3 })
      .to(clouds[0], { autoAlpha: 0, xPercent: 24, yPercent: -12, scale: 1.25, duration: 1, ease: 'power3.inOut' }, 0)
      .to(clouds[1], { autoAlpha: 0, xPercent: -22, yPercent: 10, scale: 1.2, duration: 1, ease: 'power3.inOut' }, 0.05)
      .to(overlay, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.8, ease: V.config.ease.inOut }, 0.2)
      .set(overlay, { autoAlpha: 0, clearProps: 'clipPath' })
      .set(clouds, { clearProps: 'transform' });
  }

  // Curtain clouds are only needed for internal navigation, so fetch them once the page is idle
  function loadCurtainClouds() {
    overlay.querySelectorAll('img[data-src]').forEach(function (img) {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    });
  }

  function scheduleCurtainClouds() {
    var idle = window.requestIdleCallback || function (fn) { return window.setTimeout(fn, 1200); };
    function queue() { idle(loadCurtainClouds); }
    if (document.readyState === 'complete') queue();
    else window.addEventListener('load', queue, { once: true });
  }

  function init() {
    var barba = window.barba;
    if (!barba || !V.config.barba.enabled) return;
    if (!document.querySelector('[data-barba="wrapper"]')) return;

    overlay = document.querySelector('[data-page-transition]');
    if (overlay) scheduleCurtainClouds();
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    barba.hooks.before(function () {
      V.root.classList.add('is-transitioning');
      V.scroll.stop();
    });

    barba.hooks.afterLeave(function () {
      V.destroyPage();
    });

    barba.hooks.beforeEnter(function () {
      // Also runs on first load, where the welcome gateway may still hold the scroll
      if (!V.gateway || !V.gateway.holdsScroll) V.scroll.start();
      V.scroll.scrollTo(0, { immediate: true, force: true });
    });

    barba.hooks.after(function (data) {
      V.initPage(data.next.container);
      V.root.classList.remove('is-transitioning');
    });

    barba.init({
      debug: false,
      timeout: 8000,
      preventRunning: true,
      prevent: function (data) {
        var el = data.el;
        var href = data.href || '';
        return el.hasAttribute('data-barba-prevent') ||
          el.target === '_blank' ||
          el.hasAttribute('download') ||
          /^(mailto|tel):/i.test(href) ||
          isSamePageHash(href);
      },
      transitions: [
        {
          name: 'curtain',
          leave: function () {
            return coverScreen();
          },
          enter: function () {
            return revealScreen();
          }
        }
      ]
    });
  }

  V.transitions = { init: init };
})();
