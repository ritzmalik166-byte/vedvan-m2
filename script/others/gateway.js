/* ==========================================================================
   Vedvan — welcome gateway (loader)

   Runs once per browsing session on a full page load (the inline head script
   decides and sets .gateway-on / .gateway-off). Barba page changes never
   reload the document, so internal navigation never replays it.

   Progress model: the percentage is the weighted share of settled readiness
   checks, never a timer —
     - every non-lazy <img> in the document (load or error)
     - the hero video's first frame (non-critical: dropped after VIDEO_WAIT)
     - web fonts (document.fonts.ready)
     - DOM parsed, the Vedvan app initialised (vedvan:page:init), window load
   The displayed number eases toward that share and the gateway leaves only
   when every check has settled. If something hangs, it still leaves after
   MAX_WAIT, at the honest percentage it reached rather than a fake 100%.

   Other scripts can wait for the reveal: Vedvan.gateway.whenRevealed(fn).
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  var STORAGE_KEY = 'vedvan:gateway';
  var MAX_WAIT = 12000;
  var VIDEO_WAIT = 7000;
  var HOLD_AT_100 = 0.35;

  var root = document.documentElement;
  var el = document.querySelector('[data-gateway]');
  var revealed = false;
  var revealQueue = [];

  V.gateway = {
    get active() {
      return !!el && !revealed;
    },
    get holdsScroll() {
      return !!el && !revealed && !scrollUnlocked;
    },
    whenRevealed: function (fn) {
      if (revealed || !el) fn();
      else revealQueue.push(fn);
    }
  };

  if (!el || el.hasAttribute('data-gateway-running')) return;

  if (!root.classList.contains('gateway-on') || root.classList.contains('anim-failed') || !window.gsap) {
    el.parentNode.removeChild(el);
    root.classList.remove('gateway-on');
    revealed = true;
    return;
  }
  el.setAttribute('data-gateway-running', '');

  var gsap = window.gsap;
  var reduced = V.prefersReducedMotion;
  var clouds = Array.prototype.slice.call(el.querySelectorAll('[data-gateway-cloud]'));
  var cloudImgs = clouds.map(function (cloud) { return cloud.querySelector('img'); });
  var bg = el.querySelector('[data-gateway-bg]');
  var logo = el.querySelector('[data-gateway-logo]');
  var welcome = el.querySelector('[data-gateway-welcome]');
  var progress = el.querySelector('[data-gateway-progress]');
  var fill = el.querySelector('[data-gateway-fill]');
  var percent = el.querySelector('[data-gateway-percent]');

  var display = { value: 0 };
  var shownValue = -1;
  var target = 0;
  var introDone = false;
  var leaving = false;
  var scrollUnlocked = false;
  var listeners = [];
  var timers = [];
  var tasks = [];
  var inerted = [];
  var ctx = gsap.context(function () {}, el);

  function on(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push([target, type, fn, options]);
  }

  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  /* Readiness checks ------------------------------------------------------- */
  function track(weight) {
    var task = { weight: weight, settled: false, dropped: false };
    tasks.push(task);
    return {
      settle: function () {
        if (task.settled || task.dropped) return;
        task.settled = true;
        update();
      },
      drop: function () {
        if (task.settled || task.dropped) return;
        task.dropped = true;
        update();
      }
    };
  }

  function share() {
    var total = 0;
    var done = 0;
    tasks.forEach(function (task) {
      if (task.dropped) return;
      total += task.weight;
      if (task.settled) done += task.weight;
    });
    return total ? done / total : 1;
  }

  function allSettled() {
    return tasks.every(function (task) { return task.settled || task.dropped; });
  }

  function trackImage(img) {
    var check = track(1);
    if (img.complete) {
      check.settle();
      return;
    }
    on(img, 'load', check.settle, { once: true });
    on(img, 'error', check.settle, { once: true });
  }

  function trackVideo(video) {
    var check = track(2);
    if (video.readyState >= 2 || video.error) {
      check.settle();
      return;
    }
    on(video, 'loadeddata', check.settle, { once: true });
    on(video, 'error', check.settle, { once: true });
    later(check.drop, VIDEO_WAIT);
  }

  function registerChecks() {
    var dom = track(1);
    if (document.readyState === 'loading') on(document, 'DOMContentLoaded', dom.settle, { once: true });
    else dom.settle();

    var app = track(2);
    if (V.currentPage) app.settle();
    else on(document, 'vedvan:page:init', app.settle, { once: true });

    var fonts = track(1);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fonts.settle, fonts.settle);
    else fonts.settle();

    var load = track(2);
    if (document.readyState === 'complete') load.settle();
    else on(window, 'load', load.settle, { once: true });

    document.querySelectorAll('img').forEach(function (img) {
      if (img.loading !== 'lazy') trackImage(img);
    });
    document.querySelectorAll('[data-hero-video]').forEach(trackVideo);
  }

  /* Progress display ------------------------------------------------------- */
  function render() {
    var value = Math.round(display.value);
    fill.style.transform = 'scaleX(' + (display.value / 100).toFixed(4) + ')';
    if (value === shownValue) return;
    shownValue = value;
    percent.textContent = value + '%';
    progress.setAttribute('aria-valuenow', String(value));
  }

  function update() {
    target = share();
    if (!introDone || leaving) return;
    gsap.to(display, {
      value: target * 100,
      duration: reduced ? 0.3 : 0.9,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: render,
      onComplete: maybeLeave
    });
  }

  function maybeLeave() {
    if (leaving || !introDone || !allSettled() || display.value < 99.95) return;
    leave(HOLD_AT_100);
  }

  /* Page underneath ------------------------------------------------------- */
  function lockPage() {
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child === el || child.tagName === 'SCRIPT' || child.hasAttribute('inert')) return;
      child.setAttribute('inert', '');
      inerted.push(child);
    });
    // Lenis is created after this script runs, so stop it once the app is up
    on(document, 'vedvan:page:init', function () {
      if (!scrollUnlocked && V.scroll) V.scroll.stop();
    }, { once: true });
  }

  // The scroll lock hides the scrollbar, so ScrollTrigger measured its pins at
  // the wider layout; restoring the scrollbar changes the width without a
  // resize event, so re-measure here, while the gateway is still opaque.
  function unlockScroll() {
    if (scrollUnlocked) return;
    scrollUnlocked = true;
    var lockedWidth = document.body.offsetWidth;
    root.classList.remove('gateway-on');
    if (V.scroll) V.scroll.start();
    if (document.body.offsetWidth !== lockedWidth) V.refreshScroll();
  }

  function releasePage() {
    if (revealed) return;
    revealed = true;
    inerted.forEach(function (child) { child.removeAttribute('inert'); });
    inerted = [];
    unlockScroll();
    try { sessionStorage.setItem(STORAGE_KEY, 'seen'); } catch (e) { /* storage blocked: shows again next load */ }
    revealQueue.splice(0).forEach(function (fn) {
      try { fn(); } catch (error) { console.error('[Vedvan] gateway reveal callback failed:', error); }
    });
  }

  /* Animation ------------------------------------------------------------- */
  function intro() {
    ctx.add(function () {
      if (reduced) {
        gsap.timeline({ onComplete: startProgress })
          .to(clouds, { autoAlpha: 1, duration: 0.6, ease: 'none' }, 0)
          .to([logo, welcome, progress], { autoAlpha: 1, duration: 0.6, ease: 'none' }, 0.1);
        return;
      }

      gsap.timeline()
        .fromTo(clouds[0], { autoAlpha: 0, xPercent: 14, yPercent: -6, scale: 1.04 },
          { autoAlpha: 1, xPercent: 0, yPercent: 0, scale: 1, duration: 2.8, ease: 'power2.out' }, 0.1)
        .fromTo(clouds[1], { autoAlpha: 0, xPercent: -12, yPercent: 8, scale: 1.06 },
          { autoAlpha: 1, xPercent: 0, yPercent: 0, scale: 1, duration: 3.2, ease: 'power2.out' }, 0.3)
        .fromTo(logo, { autoAlpha: 0, y: 14, scale: 0.96 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 1.6, ease: 'expo.out' }, 0.75)
        .fromTo(welcome, { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power3.out' }, 1.15)
        .fromTo(progress, { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 1.4)
        .call(startProgress, null, 1.6);

      // Idle drift: independent directions and periods so the pair never moves in step
      gsap.to(cloudImgs[0], { xPercent: -3.5, yPercent: 2.5, rotation: -0.6, duration: 9.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(cloudImgs[1], { xPercent: 3, yPercent: -2, rotation: 0.5, duration: 7.5, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.6 });
    });
  }

  function startProgress() {
    introDone = true;
    update();
  }

  function leave(delay) {
    if (leaving) return;
    leaving = true;
    gsap.killTweensOf(display);
    unlockScroll();

    ctx.add(function () {
      if (reduced) {
        gsap.timeline({ delay: delay, onComplete: finish })
          .to(el, { autoAlpha: 0, duration: 0.6, ease: 'none' }, 0)
          .call(releasePage, null, 0.1);
        return;
      }

      gsap.timeline({ delay: delay, onComplete: finish })
        .to([progress, welcome, logo], { autoAlpha: 0, y: -12, duration: 0.7, ease: 'power2.in', stagger: 0.07 }, 0)
        .to(clouds[0], { xPercent: 34, yPercent: -16, scale: 1.4, autoAlpha: 0, duration: 1.9, ease: 'power3.inOut' }, 0.2)
        .to(clouds[1], { xPercent: -30, yPercent: 14, scale: 1.35, autoAlpha: 0, duration: 1.8, ease: 'power3.inOut' }, 0.25)
        .to(bg, { autoAlpha: 0, duration: 1.3, ease: 'power2.inOut' }, 0.55)
        .set(el, { pointerEvents: 'none' }, 0.7)
        .call(releasePage, null, 0.7);
    });
  }

  function finish() {
    releasePage();
    listeners.forEach(function (entry) {
      entry[0].removeEventListener(entry[1], entry[2], entry[3]);
    });
    listeners = [];
    timers.forEach(window.clearTimeout);
    timers = [];
    if (ctx) ctx.revert();
    if (window.gsap) window.gsap.killTweensOf(display);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    root.classList.remove('gateway-on');
  }

  try {
    lockPage();
    registerChecks();
    intro();
    // Never hold the site hostage: leave at whatever genuine progress was reached
    later(function () {
      if (!leaving) leave(0);
    }, Math.max(0, MAX_WAIT - performance.now()));
  } catch (error) {
    console.error('[Vedvan] gateway failed:', error);
    finish();
  }
})();
