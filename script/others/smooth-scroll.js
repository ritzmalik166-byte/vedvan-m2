/* ==========================================================================
   Vedvan — smooth scrolling (Lenis 1.3)
   Lenis is driven by GSAP's ticker so the site runs a single rAF loop, and
   ScrollTrigger updates on every Lenis scroll. Disabled for reduced motion
   (native scrolling is used instead) and toggled live if that preference
   changes.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  var lenis = null;
  var tickerCallback = null;
  var initialised = false;

  // A notched mouse wheel sends coarse steps (line units, or a legacy
  // wheelDelta that isn't the trackpad's exact -3 × deltaY); trackpads send
  // fine pixel deltas. Unrecognised devices fall back to the trackpad lerp.
  function isNotchedWheel(event) {
    if (event.deltaMode === 1 || event.deltaMode === 2) return true;
    var legacy = event.wheelDeltaY;
    return typeof legacy === 'number' && legacy !== 0 && legacy !== -3 * event.deltaY;
  }

  // Runs before Lenis reads options.lerp for this input event
  function chooseLerp(data) {
    var event = data.event;
    if (event && event.type === 'wheel') {
      lenis.options.lerp = isNotchedWheel(event) ? V.config.lenis.wheelLerp : V.config.lenis.lerp;
    }
  }

  function create() {
    if (lenis || typeof window.Lenis === 'undefined' || V.prefersReducedMotion) return;

    var gsap = window.gsap;
    var useGsapTicker = !!(gsap && gsap.ticker);

    lenis = new window.Lenis({
      lerp: V.config.lenis.lerp,
      wheelMultiplier: V.config.lenis.wheelMultiplier,
      smoothWheel: V.config.lenis.smoothWheel,
      virtualScroll: chooseLerp,
      anchors: true,
      autoRaf: !useGsapTicker
    });

    if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);

    if (useGsapTicker) {
      tickerCallback = function (time) {
        lenis.raf(time * 1000);
      };
      // Prioritised so the new scroll position reaches ScrollTrigger before GSAP
      // renders this frame; otherwise scrubbed tweens trail the scroll by a frame
      gsap.ticker.add(tickerCallback, false, true);
      gsap.ticker.lagSmoothing(0);
    }
  }

  function destroy() {
    if (!lenis) return;
    if (tickerCallback && window.gsap) {
      window.gsap.ticker.remove(tickerCallback);
      window.gsap.ticker.lagSmoothing(500, 33);
    }
    tickerCallback = null;
    lenis.destroy();
    lenis = null;
  }

  function init() {
    if (initialised) return;
    initialised = true;
    create();

    V.onReducedMotionChange(function () {
      if (V.prefersReducedMotion) destroy();
      else create();
      V.refreshScroll();
    });
  }

  function scrollTo(target, options) {
    options = options || {};
    if (lenis) {
      // options.lerp changes per wheel device; keep programmatic scrolls consistent
      if (options.lerp === undefined && !options.duration) options = Object.assign({ lerp: V.config.lenis.lerp }, options);
      lenis.scrollTo(target, options);
      return;
    }
    var top = 0;
    if (typeof target === 'number') {
      top = target;
    } else {
      var el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return;
      top = el.getBoundingClientRect().top + window.scrollY + (options.offset || 0);
    }
    window.scrollTo({
      top: top,
      behavior: options.immediate || V.prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  V.scroll = {
    init: init,
    destroy: destroy,
    scrollTo: scrollTo,
    stop: function () {
      if (lenis) lenis.stop();
    },
    start: function () {
      if (lenis) lenis.start();
    },
    get instance() {
      return lenis;
    }
  };
})();
