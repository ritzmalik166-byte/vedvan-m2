/* ==========================================================================
   Vedvan — home section 2: pinned story (GSAP + ScrollTrigger)

   The section is pinned. Scroll distance is divided into equal "steps", one
   per slide, and a ScrollTrigger marks the start of each step. When a
   trigger point is crossed the next slide plays a normal time-based
   transition (it is NOT scrubbed), in either scroll direction.

   Pinned only on desktop (>= 1280px, side-by-side). Below 1280px (phones,
   tablets and lg) the section is not pinned: it is a simple slider
   (buildSlider) at the height of its content.

   Hooks read from the markup:
     [data-story-slide]            one slide
     [data-story-copy]             zone copy block
     [data-story-eyebrow]          eyebrow + ornaments (fade together)
     [data-story-title]            heading; data-story-split="chars" rises
                                   letters out of a mask
     [data-story-tagline]          italic line under a zone heading
     [data-story-text]             body copy (revealed word by word)
     [data-story-extra]            other items that rise in (element row, quote)
     [data-story-media]            in-slide image (Wellness slide)
     [data-story-cta]              link / button
     [data-story-tint="#hex"]      element glow colour for a zone slide

   Shared stage ([data-story-stage]) holds one image per zone slide
   ([data-story-for="N"], N = slide number) and a glass caption each
   ([data-story-caption="N"]).
   ========================================================================== */
   (function () {
    'use strict';
  
    var V = window.Vedvan;
    if (!V) return;
  
    var QUERIES = {
      // Below 1280px the section is not pinned: buildSlider takes over
      desktop: '(min-width: 1280px) and (prefers-reduced-motion: no-preference)'
    };
    var STEP_VH = { desktop: 0.75, mobile: 0.6 }; // scroll distance per slide, in viewport heights
    var GLOW = 0.2;                                // peak opacity of the element glow
  
    function pad(n) {
      return (n < 10 ? '0' : '') + n;
    }
  
    function toArray(list) {
      return Array.prototype.slice.call(list || []);
    }
  
    /* Wraps each word in an inline-block span inside an aria-hidden layer and
       adds one sr-only copy of the full text, so screen readers hear it once.
       Inline elements and <br> are preserved. mode "chars" also wraps each
       letter; the returned pieces are then letters. */
    function splitWords(el, mode) {
      if (!el) return { words: [], revert: function () {} };
      var chars = mode === 'chars';
      var original = el.innerHTML;
      var label = document.createElement('span');
      label.className = 'sr-only';
      label.textContent = el.textContent.replace(/\s+/g, ' ').trim();
  
      var visual = document.createElement('span');
      visual.className = 'split';
      visual.setAttribute('aria-hidden', 'true');
  
      (function walk(source, target) {
        Array.prototype.forEach.call(source.childNodes, function (node) {
          if (node.nodeType === Node.TEXT_NODE) {
            node.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) {
                target.appendChild(document.createTextNode(' '));
                return;
              }
              var word = document.createElement('span');
              word.className = 'split__word';
              if (chars) {
                Array.from(part).forEach(function (ch) {
                  var c = document.createElement('span');
                  c.className = 'split__char';
                  c.textContent = ch;
                  word.appendChild(c);
                });
              } else {
                word.textContent = part;
              }
              target.appendChild(word);
            });
          } else if (node.nodeName === 'BR') {
            target.appendChild(document.createElement('br'));
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            var clone = node.cloneNode(false);
            clone.removeAttribute('id');
            target.appendChild(clone);
            walk(node, clone);
          }
        });
      })(el, visual);
  
      el.replaceChildren(label, visual);
  
      return {
        words: toArray(visual.querySelectorAll(chars ? '.split__char' : '.split__word')),
        revert: function () {
          el.innerHTML = original;
        }
      };
    }
  
    function buildSequence(section, slides, isMobile) {
      var gsap = window.gsap;
      var ScrollTrigger = window.ScrollTrigger;
      var reach = isMobile ? 0.6 : 1;
      var n = slides.length;
  
      var fill = section.querySelector('[data-story-progress-fill]');
      var counter = section.querySelector('[data-story-progress-current]');
      var total = section.querySelector('[data-story-progress-total]');
      var stage = section.querySelector('[data-story-stage]');
      var rig = stage ? stage.querySelector('[data-story-rig]') : null;
      var rail = section.querySelector('[data-story-rail]');
      var railButtons = toArray(section.querySelectorAll('[data-story-goto]'));
      var tint = section.querySelector('[data-story-tint]');
      var depthLayer = section.querySelector('[data-story-depth]');
      var allImgs = stage ? toArray(stage.querySelectorAll('img[data-story-for]')) : [];
      var allCaps = stage ? toArray(stage.querySelectorAll('[data-story-caption]')) : [];
  
      section.classList.add('is-sequenced');
  
      var parts = slides.map(function (slide, i) {
        var no = i + 1;
        var titleEl = slide.querySelector('[data-story-title]');
        var texts = toArray(slide.querySelectorAll('[data-story-text]')).map(function (el) {
          return splitWords(el);
        });
        var eyebrows = toArray(slide.querySelectorAll('[data-story-eyebrow]'));
        var mode = titleEl && titleEl.getAttribute('data-story-split');
        return {
          slide: slide,
          no: no,
          zone: slide.hasAttribute('data-story-zone'),
          color: slide.getAttribute('data-story-tint'),
          eyebrow: eyebrows,
          chars: mode === 'chars',
          title: splitWords(titleEl, mode),
          tagline: splitWords(slide.querySelector('[data-story-tagline]')),
          texts: texts,
          words: [].concat.apply([], texts.map(function (t) { return t.words; })),
          extras: toArray(slide.querySelectorAll('[data-story-extra]')),
          media: slide.querySelector('[data-story-media]'),
          mediaImg: slide.querySelector('[data-story-media] img'),
          cta: slide.querySelector('[data-story-cta]'),
          img: stage ? stage.querySelector('img[data-story-for="' + no + '"]') : null,
          caption: stage ? stage.querySelector('[data-story-caption="' + no + '"]') : null
        };
      });
  
      /* Resting (hidden) state -------------------------------------------- */
      gsap.set(slides, { autoAlpha: 0, pointerEvents: 'none' });
      if (rig) gsap.set(rig, { autoAlpha: 0 });
      if (rail) gsap.set(rail, { autoAlpha: 0 });
      if (allCaps.length) gsap.set(allCaps, { autoAlpha: 0 });
      if (allImgs.length) gsap.set(allImgs, { autoAlpha: 0 });
      if (tint) gsap.set(tint, { opacity: 0 });
      if (depthLayer) gsap.set(depthLayer, { opacity: 0 });
  
      function vw(fraction) {
        return function () { return window.innerWidth * fraction * reach; };
      }
  
      /* Slide content transitions (time-based) ---------------------------- */
      // d = +1 when moving forward (content arrives from below), -1 backward.
  
      function enter(tl, p, at, d) {
        if (p.eyebrow.length) {
          tl.fromTo(p.eyebrow,
            { opacity: 0, y: 12 * d, filter: 'blur(4px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' },
            at);
        }
  
        if (p.title.words.length) {
          if (p.chars) {
            tl.fromTo(p.title.words,
              { yPercent: 110 * d, autoAlpha: 0 },
              { yPercent: 0, autoAlpha: 1, duration: 0.9, ease: 'power4.out', stagger: 0.05 },
              at + 0.05);
          } else {
            tl.fromTo(p.title.words,
              { autoAlpha: 0, y: 28 * d, filter: 'blur(5px)' },
              { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: 0.06 },
              at + 0.05);
          }
        }
  
        if (p.tagline.words.length) {
          tl.fromTo(p.tagline.words,
            { autoAlpha: 0, y: 16 * d, filter: 'blur(4px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out', stagger: 0.06 },
            at + 0.35);
        }
  
        if (p.words.length) {
          tl.fromTo(p.words,
            { autoAlpha: 0, y: 10 * d, filter: 'blur(3px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'sine.out', stagger: Math.min(0.018, 0.8 / p.words.length) },
            at + (p.tagline.words.length ? 0.5 : 0.35));
        }
  
        if (p.extras.length) {
          tl.fromTo(p.extras,
            { autoAlpha: 0, y: 20 * d },
            { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.1 },
            at + 0.65);
        }
  
        if (p.media) {
          tl.fromTo(p.media,
            { autoAlpha: 0, y: 30 * d },
            { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' },
            at + 0.1);
          if (p.mediaImg) {
            tl.fromTo(p.mediaImg,
              { clipPath: d > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)', scale: 1.18 },
              { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.4, ease: 'power3.inOut' },
              at + 0.1);
          }
        }
  
        if (p.cta) {
          tl.fromTo(p.cta,
            { opacity: 0, y: 12 * d, filter: 'blur(4px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'sine.out' },
            at + 0.85);
        }
  
        tl.set(p.slide, { autoAlpha: 1, pointerEvents: 'auto' }, at);
      }
  
      function leave(tl, p, at, d) {
        var o = { duration: 0.4, ease: 'power2.in' };
        function to(targets, vars, pos) {
          if (!targets || targets.length === 0) return;
          vars.duration = o.duration;
          vars.ease = o.ease;
          tl.to(targets, vars, pos === undefined ? at : pos);
        }
  
        tl.set(p.slide, { pointerEvents: 'none' }, at);
        to(p.eyebrow, { opacity: 0, y: -10 * d, filter: 'blur(4px)' });
        if (p.chars) {
          to(p.title.words, { yPercent: -110 * d, autoAlpha: 0, stagger: 0.02 });
        } else {
          to(p.title.words, { autoAlpha: 0, y: -22 * d, filter: 'blur(4px)', stagger: 0.02 });
        }
        to(p.tagline.words, { autoAlpha: 0, y: -10 * d, filter: 'blur(3px)', stagger: 0.02 });
        to(p.words, { autoAlpha: 0, y: -8 * d, filter: 'blur(3px)', stagger: Math.min(0.004, 0.3 / Math.max(p.words.length, 1)) });
        to(p.extras, { autoAlpha: 0, y: -12 * d, stagger: 0.03 });
        if (p.media) to(p.media, { autoAlpha: 0, y: -20 * d });
        if (p.cta) to(p.cta, { opacity: 0, y: -10 * d, filter: 'blur(4px)' });
        tl.set(p.slide, { autoAlpha: 0 }, at + 0.7);
      }
  
      /* Shared stage: frame, images, captions, rail, glow ----------------- */
  
      function captionIn(tl, p, at, d) {
        if (!p.caption) return;
        tl.fromTo(p.caption,
          { autoAlpha: 0, y: 20 * d },
          { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' },
          at);
      }
  
      function captionOut(tl, p, at, d) {
        if (!p.caption) return;
        tl.to(p.caption, { autoAlpha: 0, y: -14 * d, duration: 0.4, ease: 'power2.in' }, at);
      }
  
      function stageIn(tl, p, at, d) {
        allImgs.forEach(function (img) {
          gsap.set(img, { autoAlpha: img === p.img ? 1 : 0, clipPath: 'inset(0% 0% 0% 0%)', scale: 1, yPercent: 0, zIndex: 1 });
        });
        if (allCaps.length) gsap.set(allCaps, { autoAlpha: 0 });
  
        if (rig) {
          tl.fromTo(rig,
            { autoAlpha: 0, x: vw(0.05), y: function () { return window.innerHeight * 0.04; }, scale: 0.95, rotationY: -8, filter: 'blur(10px)' },
            { autoAlpha: 1, x: 0, y: 0, scale: 1, rotationY: 0, filter: 'blur(0px)', duration: 1.4, ease: 'power3.out' },
            at);
        }
        if (p.img) {
          tl.fromTo(p.img, { scale: 1.2 }, { scale: 1, duration: 1.8, ease: 'power2.out' }, at);
        }
        captionIn(tl, p, at + 0.6, d);
        if (rail) {
          tl.fromTo(rail,
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' },
            at + 0.7);
        }
        if (tint && p.color) {
          tl.fromTo(tint, { opacity: 0, color: p.color }, { opacity: GLOW, duration: 1.4, ease: 'sine.inOut' }, at);
        }
        if (depthLayer) {
          tl.fromTo(depthLayer, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'sine.inOut' }, at);
        }
      }
  
      function stageOut(tl, p, at, d) {
        if (rig) {
          tl.to(rig, { autoAlpha: 0, x: vw(0.04), scale: 0.97, filter: 'blur(8px)', duration: 0.8, ease: 'power2.in' }, at);
        }
        captionOut(tl, p, at, d);
        if (rail) tl.to(rail, { autoAlpha: 0, y: 12, duration: 0.4, ease: 'power2.in' }, at);
        if (tint) tl.to(tint, { opacity: 0, duration: 0.9, ease: 'sine.inOut' }, at);
        if (depthLayer) tl.to(depthLayer, { opacity: 0, duration: 0.9, ease: 'sine.inOut' }, at);
      }
  
      function settleStage(tl, p) {
        var o = { duration: 0.5, ease: 'power2.out' };
        if (rig) tl.to(rig, Object.assign({ autoAlpha: 1, x: 0, y: 0, scale: 1, rotationY: 0, filter: 'blur(0px)' }, o), 0);
        if (rail) tl.to(rail, Object.assign({ autoAlpha: 1, y: 0 }, o), 0);
        if (tint && p.color) tl.to(tint, Object.assign({ opacity: GLOW }, o), 0);
        if (depthLayer) tl.to(depthLayer, Object.assign({ opacity: 1 }, o), 0);
      }

      // The next image wipes over the current one (up when going forward,
      // down when going back) while that one drifts and zooms away.
      function wipe(tl, prev, next, d) {
        var dur = 1.2;
        allImgs.forEach(function (img) {
          if (img !== prev.img && img !== next.img) gsap.set(img, { autoAlpha: 0 });
        });
        if (prev.img) gsap.set(prev.img, { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', scale: 1, yPercent: 0, zIndex: 1 });
        if (next.img) {
          gsap.set(next.img, { zIndex: 2 });
          tl.fromTo(next.img,
            { autoAlpha: 1, clipPath: d > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)', scale: 1.18 },
            { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: dur, ease: 'power3.inOut' },
            0);
        }
        if (prev.img) {
          tl.to(prev.img, { scale: 1.08, yPercent: -4 * d, duration: dur, ease: 'power2.in' }, 0);
          tl.set(prev.img, { autoAlpha: 0 }, dur);
        }
        captionOut(tl, prev, 0, d);
        captionIn(tl, next, 0.7, d);
        if (tint && prev.color && next.color) {
          tl.to(tint, { color: next.color, duration: 1.4, ease: 'sine.inOut' }, 0);
        }
      }
  
      /* State machine: one transition per trigger point ------------------- */
  
      var active = -1;
      var timelines = [];
      var currentIndex = -1;
  
      function syncUI(i) {
        if (i === currentIndex) return;
        currentIndex = i;
        if (counter) counter.textContent = pad(i + 1);
        railButtons.forEach(function (btn) {
          var on = parseInt(btn.getAttribute('data-story-goto'), 10) === i + 1;
          btn.classList.toggle('is-active', on);
          if (on) btn.setAttribute('aria-current', 'true');
          else btn.removeAttribute('aria-current');
        });
      }
  
      function goTo(i, dir) {
        if (i === active || i < 0 || i >= n) return;
        var prev = active >= 0 ? parts[active] : null;
        var next = parts[i];
        var d = dir || (i > active ? 1 : -1);
  
        timelines.forEach(function (t) { t.kill(); });
        timelines = [];
  
        // Normalise anything an interrupted transition may have left behind
        parts.forEach(function (p) {
          if (p !== prev && p !== next) gsap.set(p.slide, { autoAlpha: 0, pointerEvents: 'none' });
        });
        if (prev) gsap.set(prev.slide, { autoAlpha: 1 });
        if (!next.zone && !(prev && prev.zone)) {
          if (rig) gsap.set(rig, { autoAlpha: 0 });
          if (rail) gsap.set(rail, { autoAlpha: 0 });
          if (allCaps.length) gsap.set(allCaps, { autoAlpha: 0 });
          if (tint) gsap.set(tint, { opacity: 0 });
          if (depthLayer) gsap.set(depthLayer, { opacity: 0 });
        }
  
        var tl = gsap.timeline({ defaults: { ease: 'none' } });
        timelines.push(tl);
  
        var zoneToZone = !!(prev && prev.zone && next.zone);
        var enterAt = 0;
        if (prev) {
          leave(tl, prev, 0, d);
          enterAt = zoneToZone ? 0.45 : 0.35;
        }
        enter(tl, next, enterAt, d);
  
        if (zoneToZone) {
          // A fast scroll can interrupt stageIn halfway, leaving the frame
          // blurred / faded / scaled. Always settle it back to rest here.
          settleStage(tl, next);
          wipe(tl, prev, next, d);
        } else if (next.zone) {
          stageIn(tl, next, Math.max(0, enterAt - 0.1), d);
        } else if (prev && prev.zone) {
          stageOut(tl, prev, 0, d);
        }
  
        // Once settled, drop leftover filters so nothing stays soft
        tl.eventCallback('onComplete', function () {
          var targets = [].concat(next.eyebrow, next.title.words, next.tagline.words, next.words);
          if (next.cta) targets.push(next.cta);
          if (targets.length) gsap.set(targets, { clearProps: 'filter' });
          if (rig && next.zone) gsap.set(rig, { clearProps: 'filter' });
        });

        active = i;
        syncUI(i);
      }
  
      // Several triggers can fire in one frame (fast scroll or rail jump);
      // only the last one plays.
      var pending = null;
      var raf = 0;
      function request(i, dir) {
        pending = { i: i, dir: dir };
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = 0;
          if (pending) goTo(pending.i, pending.dir);
          pending = null;
        });
      }
  
      /* ScrollTriggers ---------------------------------------------------- */
  
      function step() {
        return window.innerHeight * (isMobile ? STEP_VH.mobile : STEP_VH.desktop);
      }
  
      var pin = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: function () { return '+=' + Math.round(step() * n); },
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          if (!fill || active < 0) return;
          var local = Math.min(1, Math.max(0, self.progress * n - active));
          gsap.set(fill, { scaleX: local });
        }
      });
  
      // First slide plays as the section approaches the top
      ScrollTrigger.create({
        trigger: section,
        start: 'top 70%',
        once: true,
        onEnter: function () { request(0, 1); }
      });
  
      // One trigger point per slide
      var slideTriggers = parts.map(function (p, i) {
        return ScrollTrigger.create({
          start: function () { return pin.start + i * step(); },
          end: function () { return pin.start + (i + 1) * step(); },
          invalidateOnRefresh: true,
          onEnter: function () { request(i, 1); },
          onEnterBack: function () { request(i, -1); }
        });
      });
  
      if (total && n > 1) {
        total.textContent = '/ ' + pad(n);
        total.hidden = false;
      }
      syncUI(0);
  
      function scrollToSlide(index) {
        var st = slideTriggers[index - 1];
        if (!st) return;
        var y = st.start + 2;
        if (V.scroll && typeof V.scroll.scrollTo === 'function') V.scroll.scrollTo(y, { force: true });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      }
  
      function onRailClick(event) {
        var btn = event.target.closest('[data-story-goto]');
        if (btn) scrollToSlide(parseInt(btn.getAttribute('data-story-goto'), 10));
      }
      if (rail) rail.addEventListener('click', onRailClick);
  
      // Keyboard users tabbing into a hidden slide's link jump to that slide
      function onFocusIn(event) {
        var index = parts.findIndex(function (p) { return p.slide.contains(event.target); });
        if (index < 0 || index === active) return;
        var y = slideTriggers[index].start + 2;
        if (V.scroll && typeof V.scroll.scrollTo === 'function') V.scroll.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
      }
      section.addEventListener('focusin', onFocusIn);
  
      return function destroySequence() {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        pending = null;
        timelines.forEach(function (t) { t.kill(); });
        timelines = [];
        section.removeEventListener('focusin', onFocusIn);
        if (rail) rail.removeEventListener('click', onRailClick);
  
        var nodes = []
          .concat(slides)
          .concat(toArray(section.querySelectorAll('[data-story-slide] *')))
          .concat(toArray(stage ? stage.querySelectorAll('*') : []));
        if (stage) nodes.push(stage);
        if (rail) nodes.push(rail);
        if (tint) nodes.push(tint);
        if (depthLayer) nodes.push(depthLayer);
        gsap.killTweensOf(nodes);
        gsap.set(nodes, { clearProps: 'all' });
  
        parts.forEach(function (p) {
          p.title.revert();
          p.tagline.revert();
          p.texts.forEach(function (t) { t.revert(); });
        });
        if (fill) gsap.set(fill, { clearProps: 'all' });
        if (counter) counter.textContent = pad(1);
        if (total) {
          total.textContent = '';
          total.hidden = true;
        }
        railButtons.forEach(function (btn) {
          btn.classList.remove('is-active');
          btn.removeAttribute('aria-current');
        });
        section.classList.remove('is-sequenced');
      };
    }
  
    /* Below xl (< 1280px: phones, tablets, lg): a simple slider instead of the
       pinned sequence. All slides share one grid cell (so the section is as
       tall as the tallest slide); prev/next buttons, dots, arrow keys and swipe
       move between them, and a zone slide shows its image from the shared
       frame (beside it on lg, above it on phones/tablets). */
    var SLIDER_QUERY = '(max-width: 1279.98px)';
    var SLIDER_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function buildSlider(section, slides) {
      var n = slides.length;
      var imgs = toArray(section.querySelectorAll('[data-story-frame] img[data-story-for]'));
      var current = 0;

      var nav = document.createElement('div');
      nav.className = 'story__slider-nav';

      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'story__slider-btn story__slider-btn--prev';
      prev.setAttribute('aria-label', 'Previous slide');
      prev.innerHTML = SLIDER_ARROW;

      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'story__slider-btn';
      next.setAttribute('aria-label', 'Next slide');
      next.innerHTML = SLIDER_ARROW;

      var dotsWrap = document.createElement('div');
      dotsWrap.className = 'story__slider-dots';
      var dots = slides.map(function (slide, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'story__slider-dot';
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function () { go(i); });
        dotsWrap.appendChild(dot);
        return dot;
      });

      var count = document.createElement('span');
      count.className = 'story__slider-count';
      count.setAttribute('aria-hidden', 'true');

      nav.append(prev, dotsWrap, next, count);
      section.appendChild(nav);

      var gsap = window.gsap;
      var tint = section.querySelector('.story__tint');
      var depth = section.querySelector('[data-story-depth]');

      // Pieces of each slide that animate in, in reading order. Display titles
      // animate line by line.
      var parts = slides.map(function (slide) {
        var items = [];
        toArray(slide.querySelectorAll(
          '[data-story-eyebrow], [data-story-title], [data-story-tagline], [data-story-text], [data-story-extra], [data-story-cta], [data-story-media]'
        )).forEach(function (el) {
          var lines = el.matches('[data-story-title]') ? toArray(el.querySelectorAll('.story__line')) : [];
          if (lines.length) items.push.apply(items, lines);
          else items.push(el);
        });
        var no = slides.indexOf(slide) + 1;
        return {
          items: items,
          media: slide.querySelector('[data-story-media]'),
          img: imgs.filter(function (img) { return Number(img.getAttribute('data-story-for')) === no; })[0] || null,
          color: slide.getAttribute('data-story-tint')
        };
      });

      // Decode every zone image up front so none paints blank the first time
      // it is shown
      var imgToken = 0;
      var decoded = new Map();
      function ready(img) {
        if (!decoded.has(img)) {
          var p = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
          decoded.set(img, p);
        }
        return decoded.get(img);
      }
      imgs.forEach(ready);

      var animated = [];
      parts.forEach(function (p) {
        animated.push.apply(animated, p.items);
        if (p.media && p.media.querySelector('img')) animated.push(p.media.querySelector('img'));
        if (p.img) animated.push(p.img);
      });

      function setA11y(k, on) {
        slides[k].toggleAttribute('inert', !on);
        slides[k].setAttribute('aria-hidden', on ? 'false' : 'true');
      }

      function settle(k) {
        // Leave only slide k showing, with nothing mid-tween
        slides.forEach(function (slide, j) {
          slide.classList.toggle('is-active', j === k);
          slide.classList.remove('is-leaving');
          setA11y(j, j === k);
        });
        imgs.forEach(function (img) {
          img.classList.toggle('is-active', img === parts[k].img);
          img.classList.remove('is-leaving');
        });
      }

      function go(i, instant) {
        var to = (i + n) % n;
        var from = current;
        if (to === from && !instant) return;
        // Wrapping from the last slide to the first still reads as "forward"
        var dir = (to > from && !(from === 0 && to === n - 1)) || (from === n - 1 && to === 0) ? 1 : -1;
        current = to;

        if (!gsap || instant || V.prefersReducedMotion) {
          imgToken++;
          if (gsap) {
            gsap.killTweensOf(animated);
            gsap.set(animated, { clearProps: 'all' });
          }
          settle(to);
          if (gsap && tint) {
            gsap.set(tint, { opacity: parts[to].color ? 0.2 : 0 });
            if (parts[to].color) gsap.set(tint, { color: parts[to].color });
          }
          if (gsap && depth) gsap.set(depth, { opacity: parts[to].color ? 1 : 0 });
        } else {
          animate(from, to, dir);
        }

        dots.forEach(function (dot, k) {
          dot.classList.toggle('is-active', k === current);
          if (k === current) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
        count.innerHTML = pad(current + 1) + '<i>/' + pad(n) + '</i>';
      }

      function animate(from, to, dir) {
        var out = parts[from];
        var inn = parts[to];

        // Drop any transition still running (rapid clicks)
        gsap.killTweensOf(animated);
        slides.forEach(function (slide, j) {
          if (j !== from && j !== to) {
            slide.classList.remove('is-active', 'is-leaving');
            setA11y(j, false);
            gsap.set(parts[j].items, { clearProps: 'all' });
          }
        });
        imgs.forEach(function (img) {
          if (img !== out.img && img !== inn.img) {
            img.classList.remove('is-active', 'is-leaving');
            gsap.set(img, { clearProps: 'all' });
          }
        });

        // Outgoing slide: its pieces drift away against the direction of travel
        slides[from].classList.remove('is-active');
        slides[from].classList.add('is-leaving');
        setA11y(from, false);
        var shift = Math.min(64, window.innerWidth * 0.08);
        gsap.to(out.items, {
          autoAlpha: 0,
          x: -dir * shift * 0.75,
          filter: 'blur(6px)',
          duration: 0.5,
          ease: 'power2.in',
          stagger: 0.025,
          overwrite: true,
          onComplete: function () {
            slides[from].classList.remove('is-leaving');
            gsap.set(out.items, { clearProps: 'all' });
          }
        });

        // Incoming slide: pieces rise in one after another from the travel side
        slides[to].classList.add('is-active');
        setA11y(to, true);
        gsap.fromTo(inn.items,
          { autoAlpha: 0, x: dir * shift, y: 14, filter: 'blur(10px)' },
          {
            autoAlpha: 1, x: 0, y: 0, filter: 'blur(0px)',
            duration: 1.05,
            ease: 'expo.out',
            stagger: 0.07,
            delay: 0.32,
            overwrite: true,
            onComplete: function () { gsap.set(inn.items, { clearProps: 'filter' }); }
          });

        // Slide 7's own image: a clip wipe on top of the item fade
        if (inn.media) {
          var mediaImg = inn.media.querySelector('img');
          gsap.fromTo(inn.media,
            { clipPath: dir > 0 ? 'inset(0% 0% 0% 100% round 1.25rem)' : 'inset(0% 100% 0% 0% round 1.25rem)' },
            { clipPath: 'inset(0% 0% 0% 0% round 1.25rem)', duration: 1.3, ease: 'expo.inOut', delay: 0.2 });
          if (mediaImg) gsap.fromTo(mediaImg, { scale: 1.2 }, { scale: 1, duration: 1.8, ease: 'expo.out', delay: 0.2 });
        }

        // Zone image: the frame itself never moves or scales (scaling the
        // clipped <img> made its box grow past the column and jitter). The new
        // image wipes in over the old one, which stays fully visible and
        // untouched underneath until it is covered, so the section background
        // never shows through. Only clip-path animates (no filter /
        // object-position, which repaint every frame and stutter on phones).
        var token = ++imgToken;
        if (out.img && out.img !== inn.img) {
          out.img.classList.remove('is-active');
          out.img.classList.add('is-leaving');
          // A rapid click may have stopped its own wipe halfway: show it whole
          gsap.set(out.img, { autoAlpha: 1, clearProps: 'clipPath,filter,objectPosition' });
          if (!inn.img) {
            gsap.to(out.img, {
              autoAlpha: 0,
              duration: 0.6,
              ease: 'power2.in',
              onComplete: function () {
                out.img.classList.remove('is-leaving');
                gsap.set(out.img, { clearProps: 'all' });
              }
            });
          }
        }
        if (inn.img) {
          var nextImg = inn.img;
          var prevImg = out.img !== inn.img ? out.img : null;
          // Keep the new image fully clipped (invisible) until its pixels are
          // decoded, then wipe it in
          gsap.set(nextImg, {
            autoAlpha: 1,
            clipPath: dir > 0 ? 'inset(0% 0% 0% 100% round 1.25rem)' : 'inset(0% 100% 0% 0% round 1.25rem)'
          });
          nextImg.classList.add('is-active');
          ready(nextImg).then(function () {
            if (token !== imgToken) return; // a newer transition took over
            gsap.to(nextImg, {
              clipPath: 'inset(0% 0% 0% 0% round 1.25rem)',
              duration: 1.1,
              ease: 'power3.inOut',
              delay: prevImg ? 0.05 : 0.25,
              onComplete: function () {
                gsap.set(nextImg, { clearProps: 'clipPath' });
                if (prevImg && token === imgToken) {
                  prevImg.classList.remove('is-leaving');
                  gsap.set(prevImg, { clearProps: 'all' });
                }
              }
            });
          });
        }

        // Backdrop: deeper forest + the zone's colour glow behind zone slides
        if (tint) {
          if (inn.color) gsap.to(tint, { opacity: 0.2, color: inn.color, duration: 1.4, ease: 'sine.inOut' });
          else gsap.to(tint, { opacity: 0, duration: 0.9, ease: 'sine.inOut' });
        }
        if (depth) gsap.to(depth, { opacity: inn.color ? 1 : 0, duration: 1.2, ease: 'sine.inOut' });
      }

      function onPrev() { go(current - 1); }
      function onNext() { go(current + 1); }
      function onKey(e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
      }

      // Horizontal swipe on touch screens (story.css sets touch-action: pan-y
      // so the browser keeps vertical scrolling but leaves sideways drags to us)
      var startX = null;
      var startY = 0;
      function onDown(e) {
        if (e.pointerType === 'mouse') return;
        startX = e.clientX;
        startY = e.clientY;
      }
      function onUp(e) {
        if (startX === null) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        startX = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? onNext : onPrev)();
      }
      function onCancel() { startX = null; }

      prev.addEventListener('click', onPrev);
      next.addEventListener('click', onNext);
      section.addEventListener('keydown', onKey);
      section.addEventListener('pointerdown', onDown);
      section.addEventListener('pointerup', onUp);
      section.addEventListener('pointercancel', onCancel);

      section.classList.add('is-slider');
      go(0, true);

      return function destroySlider() {
        prev.removeEventListener('click', onPrev);
        next.removeEventListener('click', onNext);
        section.removeEventListener('keydown', onKey);
        section.removeEventListener('pointerdown', onDown);
        section.removeEventListener('pointerup', onUp);
        section.removeEventListener('pointercancel', onCancel);
        nav.remove();
        slides.forEach(function (slide) {
          slide.classList.remove('is-active');
          slide.removeAttribute('inert');
          slide.removeAttribute('aria-hidden');
        });
        imgs.forEach(function (img) { img.classList.remove('is-active'); });
        if (gsap) {
          gsap.killTweensOf(animated);
          gsap.set(animated, { clearProps: 'all' });
          if (tint) gsap.set(tint, { clearProps: 'opacity,color' });
          if (depth) gsap.set(depth, { clearProps: 'opacity' });
        }
        section.classList.remove('is-slider');
      };
    }

    V.registerPage('home', function initStory(page) {
      var section = page.container.querySelector('[data-story]');
      if (!section) return;
  
      var slides = toArray(section.querySelectorAll('[data-story-slide]'));
      var images = toArray(section.querySelectorAll('[data-story-frame] img, [data-story-media] img'));
  
      // A failed image is hidden so its frame's tinted backing shows instead
      function onImageError(event) {
        event.target.classList.add('is-broken');
      }
      images.forEach(function (img) {
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) img.classList.add('is-broken');
        img.addEventListener('error', onImageError);
      });
  
      if (page.mm && window.gsap && window.ScrollTrigger && slides.length) {
        page.mm.add(QUERIES, function (context) {
          var c = context.conditions;
          if (!c.desktop) return;
          return buildSequence(section, slides, false);
        });
      }
  
      // Simple slider below xl
      var sliderMq = window.matchMedia(SLIDER_QUERY);
      var destroySlider = null;
      function syncSlider() {
        if (sliderMq.matches && !destroySlider && slides.length) {
          destroySlider = buildSlider(section, slides);
        } else if (!sliderMq.matches && destroySlider) {
          destroySlider();
          destroySlider = null;
        }
      }
      syncSlider();
      if (sliderMq.addEventListener) sliderMq.addEventListener('change', syncSlider);
      else sliderMq.addListener(syncSlider);

      return function destroyStory() {
        if (sliderMq.removeEventListener) sliderMq.removeEventListener('change', syncSlider);
        else sliderMq.removeListener(syncSlider);
        if (destroySlider) destroySlider();
        images.forEach(function (img) {
          img.removeEventListener('error', onImageError);
        });
      };
    });
  })();