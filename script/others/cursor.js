/* ==========================================================================
   Vedvan — lotus cursor
   Replaces the system pointer with the lotus mark on devices with a fine,
   hovering pointer (mouse / trackpad). A small dot marks the exact hotspot;
   the lotus trails it below-right on an eased requestAnimationFrame loop
   that only runs while it is catching up.

   The lotus is assets/logo/logo-icn1.png, used as a CSS mask filled
   with the site gold (styles/others/cursor.css). On touch devices,
   or without JS, the native cursor is left untouched.

   The cursor lives on <body>, outside the Barba container, above every
   overlay (--vv-z-cursor), and never takes pointer events.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  var FINE_POINTER = '(hover: hover) and (pointer: fine)';
  // How quickly the lotus closes the distance to the pointer (per second)
  var FOLLOW = 15;
  var INTERACTIVE = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], label, summary, select, ' +
    'input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], input[type="reset"], input[type="range"], input[type="file"], ' +
    '[data-cursor="hover"]';
  var TEXT_ENTRY = 'input:not([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"], [type="range"], [type="color"], [type="file"]), ' +
    'textarea, [contenteditable=""], [contenteditable="true"]';

  V.registerGlobal(function initLotusCursor() {
    if (V.cursor) return;

    var root = V.root;
    var finePointer = window.matchMedia(FINE_POINTER);

    Array.prototype.forEach.call(document.querySelectorAll('[data-lotus-cursor]'), function (stale) {
      stale.remove();
    });

    var el = document.createElement('div');
    el.className = 'lotus-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-lotus-cursor', '');
    el.innerHTML = '<span class="lotus-cursor__lotus"><span class="lotus-cursor__icon"></span></span>' +
      '<span class="lotus-cursor__dot"></span>';
    var lotus = el.querySelector('.lotus-cursor__lotus');
    var icon = el.querySelector('.lotus-cursor__icon');
    var dot = el.querySelector('.lotus-cursor__dot');

    var hasIcon = true;
    var enabled = false;
    var visible = false;
    var x = 0;
    var y = 0;
    var lx = 0;
    var ly = 0;
    var raf = 0;
    var last = 0;
    var state = { hover: false, text: false, press: false };

    function setState(name, value) {
      if (state[name] === value) return;
      state[name] = value;
      el.classList.toggle('is-' + name, value);
    }

    function write() {
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      lotus.style.transform = 'translate3d(' + lx.toFixed(2) + 'px,' + ly.toFixed(2) + 'px,0)';
    }

    function tick(now) {
      var dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (V.prefersReducedMotion) {
        lx = x;
        ly = y;
      } else {
        var k = 1 - Math.exp(-FOLLOW * dt);
        lx += (x - lx) * k;
        ly += (y - ly) * k;
      }
      var settled = Math.abs(x - lx) < 0.1 && Math.abs(y - ly) < 0.1;
      if (settled) {
        lx = x;
        ly = y;
      }
      write();
      raf = settled ? 0 : window.requestAnimationFrame(tick);
    }

    function run() {
      if (raf) return;
      last = performance.now();
      raf = window.requestAnimationFrame(tick);
    }

    function show() {
      if (visible) return;
      visible = true;
      el.classList.add('is-visible');
      root.classList.add('has-lotus-cursor');
    }

    function hide() {
      if (!visible) return;
      visible = false;
      el.classList.remove('is-visible');
      root.classList.remove('has-lotus-cursor');
      setState('press', false);
    }

    function onMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse') {
        hide();
        return;
      }
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        // Appear in place rather than gliding in from the last exit point
        lx = x;
        ly = y;
        write();
        show();
      }
      run();
    }

    function onOver(e) {
      var target = e.target instanceof Element ? e.target : null;
      var control = target && target.closest(INTERACTIVE);
      setState('hover', !!control && !control.matches(':disabled'));
      setState('text', !!(target && target.closest(TEXT_ENTRY)));
    }

    function onDown(e) {
      if (e.pointerType === 'mouse') setState('press', true);
    }

    function onUp() {
      setState('press', false);
    }

    // Native drag-and-drop suppresses pointer events; keep tracking from dragover
    function onDrag(e) {
      if (e.clientX || e.clientY) onMove({ pointerType: 'mouse', clientX: e.clientX, clientY: e.clientY });
    }

    function onPageChange() {
      setState('hover', false);
      setState('text', false);
    }

    function enable() {
      if (enabled) return;
      enabled = true;
      document.body.appendChild(el);
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerover', onOver, { passive: true });
      document.addEventListener('pointerdown', onDown, { passive: true });
      document.addEventListener('pointerup', onUp, { passive: true });
      document.addEventListener('pointercancel', onUp, { passive: true });
      document.addEventListener('dragover', onDrag, { passive: true });
      root.addEventListener('mouseleave', hide);
      window.addEventListener('blur', onUp);
    }

    function disable() {
      if (!enabled) return;
      enabled = false;
      hide();
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('dragover', onDrag);
      root.removeEventListener('mouseleave', hide);
      window.removeEventListener('blur', onUp);
      el.remove();
    }

    function sync() {
      if (hasIcon && finePointer.matches) enable();
      else disable();
    }

    sync();
    finePointer.addEventListener('change', sync);
    document.addEventListener('vedvan:page:init', onPageChange);

    V.cursor = { enable: sync, disable: disable };
  });
})();
