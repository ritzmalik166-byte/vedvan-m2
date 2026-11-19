/* Vedvan — About v3 (initAboutVedvan2)
   Slide 1: reveal on enter. Stage: scenes scroll over a full-screen backdrop; the Vision card
   rises from the bottom-right, slides up and out, then the Mission card rises from the
   bottom-left — one scrubbed timeline. Reduced motion / no GSAP: static CSS layout. */
   (function () {
    'use strict';
    var V = window.Vedvan;
    var QUERIES = {
      desktop: '(prefers-reduced-motion: no-preference) and (min-width: 900px) and (min-aspect-ratio: 1/1)',
      mobile: '(prefers-reduced-motion: no-preference) and (max-width: 899.98px), (prefers-reduced-motion: no-preference) and (max-aspect-ratio: 1/1)'
    };
    function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
  
    /* Wraps each word in a masked inline-block; keeps one screen-reader copy. */
    function splitWords(el) {
      var original = el.innerHTML;
      var label = document.createElement('span');
      label.className = 'a2-sr';
      label.textContent = el.textContent.replace(/\s+/g, ' ').trim();
      var visual = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true');
      (function walk(source, target) {
        Array.prototype.forEach.call(source.childNodes, function (node) {
          if (node.nodeType === 3) {
            node.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { target.appendChild(document.createTextNode(' ')); return; }
              var outer = document.createElement('span'); outer.className = 'a2-word';
              var inner = document.createElement('span'); inner.className = 'a2-word__in';
              inner.textContent = part; outer.appendChild(inner); target.appendChild(outer);
            });
          } else if (node.nodeType === 1) {
            var clone = node.cloneNode(false); target.appendChild(clone); walk(node, clone);
          }
        });
      })(el, visual);
      el.replaceChildren(label, visual);
      return { words: qsa('.a2-word__in', visual), revert: function () { el.innerHTML = original; } };
    }
    function wordsOf(splits) { return splits.reduce(function (a, s) { return a.concat(s.words); }, []); }
  
    /* Slide 1: paused reveal timeline */
    function prepareIntro(gsap, panel) {
      var splits = qsa('[data-a2-heading]', panel).map(splitWords);
      var words = wordsOf(splits), fades = qsa('[data-a2-fade]', panel);
      var fig = panel.querySelector('[data-a2-img]'), img = fig.querySelector('img');
      var rule = panel.querySelector('[data-a2-rule]'), index = panel.querySelector('[data-a2-index]');
      gsap.set(words, { yPercent: 115, rotate: 3 });
      gsap.set(fades, { opacity: 0, y: 26 });
      gsap.set(fig, { clipPath: 'inset(0% 0% 100% 0%)' });
      gsap.set(img, { scale: 1.4 });
      gsap.set(rule, { scaleX: 0 });
      gsap.set(index, { opacity: 0 });
      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.to(fig, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' }, 0)
        .to(img, { scale: 1.08, duration: 2 }, 0)
        .to(words, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'power4.out', stagger: 0.06 }, 0.15)
        .to(fades, { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 0.4)
        .to(rule, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, 0.2)
        .to(index, { opacity: 1, duration: 1.4 }, 0.2);
      return { tl: tl, splits: splits, img: img, fig: fig };
    }
  
    /* Card content reveal: paused timeline, played when the card scrolls in */
    function prepareCard(gsap, card) {
      var splits = qsa('[data-a2-heading]', card).map(splitWords);
      var words = wordsOf(splits), fades = qsa('[data-a2-fade]', card);
      var fig = card.querySelector('[data-a2-img]'), img = fig.querySelector('img');
      gsap.set(fig, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(img, { scale: 1.5 });
      gsap.set(words, { yPercent: 115, rotate: 3 });
      gsap.set(fades, { opacity: 0, y: 24 });
      var tl = gsap.timeline({ paused: true });
      tl.to(fig, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0.3)
        .to(img, { scale: 1.05, duration: 1.8, ease: 'power2.out' }, 0.3)
        .to(words, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05 }, 0.1)
        .to(fades, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }, 0.3);
      return { tl: tl, splits: splits };
    }
  
    function build(section, mode) {
      var gsap = window.gsap, mobile = mode === 'mobile';
      var splits = [], intro = null;
  
      /* Slide 1 */
      var panel = section.querySelector('[data-a2-panel]');
      if (panel) {
        intro = prepareIntro(gsap, panel);
        splits = splits.concat(intro.splits);
        window.ScrollTrigger.create({ trigger: panel, start: 'top 70%', once: true, onEnter: function () { intro.tl.play(); } });
        gsap.fromTo(intro.img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: intro.fig, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
      qsa('[data-a2-orb]', section).forEach(function (orb, i) {
        gsap.to(orb, { x: i ? -40 : 50, y: i ? -30 : 40, duration: 9 + i * 3, ease: 'sine.inOut', repeat: -1, yoyo: true });
      });
  
      /* Stage: no pin. The fixed backdrop stays put while the page scrolls over it (parallax). */
      var stage = section.querySelector('[data-a2-stage]');
      var dx = mobile ? 14 : 38;
  
      qsa('[data-a2-scene]', stage).forEach(function (scene, i) {
        var card = scene.querySelector('[data-a2-card]');
        var side = i % 2 === 0 ? 1 : -1; // vision from the right, mission from the left
        var c = prepareCard(gsap, card);
        splits = splits.concat(c.splits);
  
        // Card slides in from the bottom corner
        gsap.fromTo(card, { xPercent: side * dx, yPercent: 45, rotate: side * 5 },
          { xPercent: 0, yPercent: 0, rotate: 0, ease: 'power2.out',
            scrollTrigger: { trigger: scene, start: 'top 90%', end: 'top 25%', scrub: 1 } });
  
        // Content reveal (replays when scrolling back)
        window.ScrollTrigger.create({
          trigger: scene, start: 'top 55%',
          onEnter: function () { c.tl.timeScale(1).play(); },
          onLeaveBack: function () { c.tl.timeScale(1.8).reverse(); }
        });
  
        // Card drifts up and tilts away as the section moves on
        gsap.fromTo(card, { yPercent: 0, rotate: 0 }, { yPercent: -14, rotate: -side * 2, ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: scene, start: 'bottom 85%', end: 'bottom top', scrub: true } });
      });
  
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.ScrollTrigger.refresh(); });
  
      return function destroyAbout2() {
        if (intro) intro.tl.kill();
        splits.forEach(function (s) { s.revert(); });
        section.classList.remove('is-enhanced');
      };
    }
  
    function attach(section, mm) {
      mm.add(QUERIES, function (context) {
        var c = context.conditions;
        var mode = c.desktop ? 'desktop' : c.mobile ? 'mobile' : null;
        if (!mode) return;
        return build(section, mode);
      });
    }
  
    function boot() {
      if (!window.gsap || !window.ScrollTrigger) return;
      window.gsap.registerPlugin(window.ScrollTrigger);
      if (V && typeof V.registerPage === 'function') {
        V.registerPage('home', function initAboutVedvan2(page) {
          var section = page.container.querySelector('[data-about2]');
          if (section && page.mm) attach(section, page.mm);
        });
        return;
      }
      var section = document.querySelector('[data-about2]');
      if (section) attach(section, window.gsap.matchMedia());
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  })();