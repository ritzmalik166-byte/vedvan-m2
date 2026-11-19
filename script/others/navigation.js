/* ==========================================================================
   Vedvan — floating navigation pill
   Persistent across Barba navigations (lives outside the container).
   Handles the expandable menu: aria-expanded, inert panel, Escape / outside
   click to close, focus return, and current-page marking.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  V.registerGlobal(function initNavigation() {
    var header = document.querySelector('[data-site-header]');
    if (!header) return;

    var toggle = header.querySelector('[data-menu-toggle]');
    var menu = header.querySelector('[data-menu]');
    if (!toggle || !menu) return;

    var isOpen = false;

    function setOpen(open, options) {
      options = options || {};
      isOpen = open;
      header.toggleAttribute('data-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      menu.inert = !open;

      if (open && options.focusFirst) {
        var first = menu.querySelector('a, button');
        if (first) first.focus({ preventScroll: true });
      }
      if (!open && options.returnFocus) toggle.focus({ preventScroll: true });
    }

    function markCurrentLinks() {
      var here = new URL(window.location.href);
      header.querySelectorAll('a[href]').forEach(function (link) {
        var url = new URL(link.getAttribute('href'), here);
        var samePage = url.origin === here.origin &&
          url.pathname.replace(/index\.html$/, '') === here.pathname.replace(/index\.html$/, '') &&
          !url.hash;
        if (samePage) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }

    toggle.addEventListener('click', function (event) {
      // Keyboard activation (detail === 0) moves focus into the menu
      setOpen(!isOpen, { focusFirst: event.detail === 0 });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) setOpen(false, { returnFocus: true });
    });

    document.addEventListener('click', function (event) {
      if (isOpen && !header.contains(event.target)) setOpen(false);
    });

    header.addEventListener('focusout', function (event) {
      if (isOpen && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });

    // Same-page links (logo, Home) scroll to top instead of reloading
    header.addEventListener('click', function (event) {
      var link = event.target.closest('a[aria-current="page"]');
      if (!link) return;
      event.preventDefault();
      setOpen(false);
      V.scroll.scrollTo(0);
    });

    // Section links (#home, #about, …): close the menu, then glide to the section.
    // stopPropagation keeps Lenis' own anchor handler from firing a second scroll.
    header.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      V.scroll.scrollTo(id === 'home' ? 0 : target, {
        duration: 1.6,
        easing: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
      });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });

    // Scrolled state: CSS (lg+ only) turns the pill into a full-width bar and
    // slides the inline links in. Tablet/mobile ignore the class.
    var scrolled = null;
    var ticking = false;
    function updateScrolled() {
      ticking = false;
      var next = window.scrollY > 0;
      if (next === scrolled) return;
      scrolled = next;
      header.classList.toggle('is-scrolled', next);
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateScrolled);
    }, { passive: true });
    updateScrolled();

    // Desktop has no Menu panel: don't leave it open after resizing up to lg.
    // (Hidden inline links use visibility: hidden, so they're out of tab order.)
    var desktopQuery = window.matchMedia('(min-width: 64rem)');
    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', function () {
        if (desktopQuery.matches && isOpen) setOpen(false);
      });
    }

    document.addEventListener('vedvan:page:destroy', function () {
      setOpen(false);
    });
    document.addEventListener('vedvan:page:init', markCurrentLinks);

    setOpen(false);
  });
})();
