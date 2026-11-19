/* ==========================================================================
   Vedvan — home sections 8 + 9 (GSAP + ScrollTrigger)

   SECTION 8 — The Vedvan Promise  ([data-promise])
     Heading: left-aligned; eyebrow and the two lines simply fade up.

     Desktop (>= 80rem): the stage PINS. One scrubbed timeline runs:
       (optional statement fills in word by word) → each freedom in turn:
       its gold rule draws and its text lights up while its photograph
       wipes up into the viewer (the previous photo slowly pushes back and
       darkens). A counter and a progress line follow the playhead.
     1024–1279px: no pin; the stage is a simple slider (buildPromiseSlider).
     Tablet / phone: no pin; the statement still fills with the scroll, each
       freedom and each photograph reveals as it arrives.

   SECTION 9 — Final CTA  ([data-finale])
     An ivory curtain wipes down over the forest green (scrubbed); the
     three title lines rise from masks and drift apart; the hairline draws,
     the lead and button follow (button is magnetic with a mouse). The
     full-bleed photograph opens from a narrow centre strip to full width
     while it zooms out and drifts; VEDVAN rises letter by letter over it.

   Every tween is a fromTo with explicit values, so playback is identical in
   both scroll directions and after resize/refresh. Reduced motion: none of
   this runs and the static layout from promise.css is shown.
   ========================================================================== */
   (function () {
    'use strict';
  
    var V = window.Vedvan;
    if (!V) return;
  
    // 1024–1279px (slider) is its own mode: the promise stage is a simple
    // slider there (no pin), and it runs with or without reduced motion.
    var QUERIES = {
      desktop: '(min-width: 80rem) and (prefers-reduced-motion: no-preference)',
      slider: '(min-width: 64rem) and (max-width: 79.99rem)',
      compact: '(max-width: 63.99rem) and (prefers-reduced-motion: no-preference)',
      motionOK: '(prefers-reduced-motion: no-preference)'
    };

    var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  
    // Pinned sequence (relative units; scroll length = duration × PER_UNIT × viewport height)
    var PER_UNIT = 0.5;
    var SCRUB = 1.2;
    var FIRST = 2.2;   // time of the first freedom (after the statement fills)
    var STEP = 1.5;    // time between freedoms
    var HOLD = 0.9;    // final hold before the pin releases
  
    function pad(n) {
      return (n < 10 ? '0' : '') + n;
    }
  
    function list(root, selector) {
      return Array.prototype.slice.call(root.querySelectorAll(selector));
    }
  
    /* Wraps each word (or letter, mode "chars") in an inline-block span inside
       an aria-hidden layer and adds one sr-only copy of the text, so screen
       readers hear the sentence once. Inline elements and <br> are preserved. */
    function splitWords(el, mode) {
      if (!el) return { words: [], revert: function () {} };
      var chars = mode === 'chars';
      var original = el.innerHTML;
      var label = document.createElement('span');
      label.className = 'sr-only';
      label.textContent = el.textContent.replace(/\s+/g, ' ').trim();
  
      var visual = document.createElement('span');
      visual.className = 'fx';
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
              word.className = 'fx__word';
              if (chars) {
                Array.from(part).forEach(function (ch) {
                  var c = document.createElement('span');
                  c.className = 'fx__char';
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
        words: Array.prototype.slice.call(visual.querySelectorAll(chars ? '.fx__char' : '.fx__word')),
        revert: function () {
          el.innerHTML = original;
        }
      };
    }
  
    var CLIP_HIDDEN = 'inset(100% 0% 0% 0%)';
    var CLIP_SHOWN = 'inset(0% 0% 0% 0%)';
  
    /* SECTION 8 ------------------------------------------------------------ */
    function buildPromise(section, pinned, split) {
      var gsap = window.gsap;
  
      var head = section.querySelector('[data-promise-head]');
      var eyebrow = section.querySelector('[data-promise-eyebrow]');
      var lines = list(section, '[data-promise-line]');
      var bg = section.querySelector('[data-promise-bg]');
      var stage = section.querySelector('[data-promise-stage]');
      var statementEl = section.querySelector('[data-promise-statement]');
      var items = list(section, '[data-promise-freedom]');
      var shots = list(section, '[data-promise-shot]');
  
      // Background tone drifts slowly against the scroll
      if (bg) {
        gsap.fromTo(bg,
          { yPercent: -4 },
          { yPercent: 4, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
  
      // Heading: simple fade-up for the eyebrow, then each line (no sideways drift)
      if (head && lines.length) {
        gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 80%', toggleActions: 'play none none reverse' } })
          .fromTo(eyebrow,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0)
          .fromTo(lines,
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.12 }, 0.15);
      }
  
      // lg → xl: only the background drift and heading reveal run here; the
      // stage is the slider (buildPromiseSlider)
      if (pinned === 'head-only') return null;

      var statement = split(statementEl);
      if (pinned && stage && items.length && items.length === shots.length) {
        /* Pinned sequence ---------------------------------------------------- */
        section.classList.add('is-pinned');
  
        var counter = section.querySelector('[data-promise-count]');
        var progress = section.querySelector('[data-promise-progress]');
        // Without a statement the first freedom follows the first photo
        var first = statement.words.length ? FIRST : 0.6;
        var starts = items.map(function (_, i) { return first + i * STEP; });
        var lastStart = starts[starts.length - 1];
  
        var tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: function () { return '+=' + Math.round(window.innerHeight * PER_UNIT * tl.duration()); },
            pin: true,
            scrub: SCRUB,
            anticipatePin: 1,
            invalidateOnRefresh: true
          }
        });
  
        // 1. Statement (if any) fills in word by word
        if (statement.words.length) {
          tl.fromTo(statement.words,
            { opacity: 0.16 },
            { opacity: 1, duration: 0.6, stagger: 0.12 }, 0);
        }
  
        // 2. Freedoms in turn, each with its photograph
        items.forEach(function (item, i) {
          var at = starts[i];
          var rule = item.querySelector('[data-promise-rule]');
          var shot = shots[i];
          var img = shot.querySelector('img');
  
          // Rule is drawn from the start of the timeline's own state: hidden until `at`
          tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, at);
  
          // Item lights up, text eases in; dims again when the next one takes over
          tl.fromTo(item, { opacity: 0.3 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, at);
          if (i < items.length - 1) {
            tl.fromTo(item, { opacity: 1 }, { opacity: 0.3, duration: 0.6, ease: 'power2.in', immediateRender: false }, starts[i + 1]);
          }
  
          // Photograph wipes up; image settles out of a zoom
          var photoAt = i === 0 ? 0.5 : at - 0.2;
          tl.fromTo(shot, { clipPath: CLIP_HIDDEN }, { clipPath: CLIP_SHOWN, duration: 1.3, ease: 'power3.inOut' }, photoAt);
          tl.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'power2.out' }, photoAt);
  
          // The one it covers pushes back (no darkening: a brightness filter
          // read as a dark fade and repainted the big image every frame)
          if (i > 0) {
            var prevImg = shots[i - 1].querySelector('img');
            tl.fromTo(prevImg,
              { scale: 1 },
              { scale: 1.12, duration: 1.5, ease: 'power1.in', immediateRender: false }, photoAt);
          }
        });
  
        // Progress line follows the whole sequence
        if (progress) {
          tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: lastStart, ease: 'none' }, 0);
        }
  
        // Final hold, then the pin releases
        tl.to({}, { duration: HOLD }, lastStart);
  
        if (counter) {
          var current = 0;
          tl.eventCallback('onUpdate', function () {
            var t = tl.time();
            var index = 0;
            for (var i = 0; i < starts.length; i++) if (t >= starts[i] - 0.2) index = i;
            if (index !== current) {
              current = index;
              counter.textContent = pad(index + 1);
            }
          });
        }
  
        return function () {
          section.classList.remove('is-pinned');
          if (counter) counter.textContent = '01';
        };
      }
  
      /* Tablet / phone: no pin ---------------------------------------------- */
      var texts = items.map(function (item) { return split(item.querySelector('[data-promise-freedom-text]')); });
  
      if (statement.words.length) {
        gsap.fromTo(statement.words,
          { opacity: 0.16 },
          { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: statementEl, start: 'top 85%', end: 'bottom 55%', scrub: true } });
      }
  
      items.forEach(function (item, i) {
        var rule = item.querySelector('[data-promise-rule]');
        var num = item.querySelector('.promise__num');
        var desc = item.querySelector('[data-promise-freedom-desc]');
        var itemTl = gsap.timeline({ scrollTrigger: { trigger: item, start: 'top 90%', toggleActions: 'play none none reverse' } })
          .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power3.inOut' }, 0)
          .fromTo(num, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.15)
          .fromTo(texts[i].words,
            { autoAlpha: 0, y: 16, filter: 'blur(5px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power2.out', stagger: 0.035 }, 0.2);
        if (desc) {
          itemTl.fromTo(desc, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.45);
        }
      });
  
      shots.forEach(function (shot) {
        var img = shot.querySelector('img');
        gsap.timeline({ scrollTrigger: { trigger: shot, start: 'top 88%', toggleActions: 'play none none reverse' } })
          .fromTo(shot, { clipPath: CLIP_HIDDEN }, { clipPath: CLIP_SHOWN, duration: 1.2, ease: 'power3.inOut' }, 0)
          .fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.7, ease: 'power2.out' }, 0);
      });
    }
  
    /* SECTION 8, lg → xl (1024–1279px): simple slider, no pin ---------------
       Freedoms on the left act as tabs; the viewer on the right shows one
       photograph at a time. The stage is as tall as its content. The new
       photo wipes in from the travel side and settles out of a zoom inside
       its fixed frame; the old one stays put underneath and dims. */
    function buildPromiseSlider(section, motionOK) {
      var gsap = window.gsap;
      var items = list(section, '[data-promise-freedom]');
      var shots = list(section, '[data-promise-shot]');
      var textCol = section.querySelector('.promise__text');
      if (!items.length || items.length !== shots.length || !textCol) return null;

      var n = items.length;
      var current = 0;
      var animate = motionOK && !!gsap;

      section.classList.add('is-slider');

      var nav = document.createElement('div');
      nav.className = 'promise__slider-nav';
      var prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'promise__slider-btn promise__slider-btn--prev';
      prev.setAttribute('aria-label', 'Previous');
      prev.innerHTML = ARROW;
      var next = document.createElement('button');
      next.type = 'button';
      next.className = 'promise__slider-btn';
      next.setAttribute('aria-label', 'Next');
      next.innerHTML = ARROW;
      var dotsWrap = document.createElement('div');
      dotsWrap.className = 'promise__slider-dots';
      var dots = items.map(function (item, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'promise__slider-dot';
        var t = item.querySelector('[data-promise-freedom-text]');
        dot.setAttribute('aria-label', 'Show ' + (t ? t.textContent.trim() : 'slide ' + (i + 1)));
        dot.addEventListener('click', function () { go(i); });
        dotsWrap.appendChild(dot);
        return dot;
      });
      var count = document.createElement('span');
      count.className = 'promise__slider-count';
      count.setAttribute('aria-hidden', 'true');
      nav.append(prev, dotsWrap, next, count);
      textCol.appendChild(nav);

      // Freedoms act as tabs
      var handlers = items.map(function (item, i) {
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        function onClick() { go(i); }
        function onKey(e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); }
        }
        item.addEventListener('click', onClick);
        item.addEventListener('keydown', onKey);
        return { click: onClick, key: onKey };
      });

      var imgs = shots.map(function (shot) { return shot.querySelector('img'); });
      var rules = items.map(function (item) { return item.querySelector('[data-promise-rule]'); });
      var tracked = shots.concat(imgs, rules).filter(Boolean);
      var cleanups = [];

      // Resolves once a photo is downloaded AND decoded so the wipe never
      // reveals an empty frame; a timeout keeps a slow image from blocking.
      function ready(img) {
        return new Promise(function (resolve) {
          if (!img) return resolve();
          var finished = false;
          function done() {
            if (finished) return;
            finished = true;
            resolve();
          }
          function decode() {
            if (img.decode) img.decode().then(done, done);
            else done();
          }
          if (img.complete && img.naturalWidth) decode();
          else {
            img.addEventListener('load', decode, { once: true });
            img.addEventListener('error', done, { once: true });
          }
          setTimeout(done, 4000);
        });
      }

      imgs.forEach(function (img) {
        if (!img) return;
        img.loading = 'eager';
        ready(img);
      });

      function killCleanups() {
        cleanups.forEach(function (c) { if (c) c.kill(); });
        cleanups = [];
      }

      var shown = 0;     // photo actually on screen
      var request = 0;   // newest click wins while a photo is loading

      function sync() {
        items.forEach(function (item, k) {
          item.classList.toggle('is-active', k === current);
          if (k === current) item.setAttribute('aria-current', 'true');
          else item.removeAttribute('aria-current');
        });
        dots.forEach(function (dot, k) {
          dot.classList.toggle('is-active', k === current);
          if (k === current) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
        count.innerHTML = pad(current + 1) + '<i>/' + pad(n) + '</i>';
      }

      function go(i) {
        var to = (i + n) % n;
        var from = current;
        if (to === from) return;
        var dir = (to > from && !(from === 0 && to === n - 1)) || (from === n - 1 && to === 0) ? 1 : -1;
        current = to;
        sync();

        if (!animate) {
          shots.forEach(function (shot, k) {
            shot.classList.toggle('is-active', k === to);
            shot.classList.remove('is-leaving', 'is-under');
          });
          shown = to;
          return;
        }

        var token = ++request;
        ready(imgs[to]).then(function () {
          if (token !== request || to === shown) return;
          var origin = shown;
          shown = to;
          play(origin, to, dir);
        });
      }

      function play(from, to, dir) {
        gsap.killTweensOf(tracked);
        killCleanups();
        // On a fast click the outgoing photo may still be mid-wipe; keep the
        // one that was under it as a full backdrop so no dark gap shows
        shots.forEach(function (shot, k) {
          if (k === from || k === to) {
            shot.classList.remove('is-under');
            return;
          }
          var wasLeaving = shot.classList.contains('is-leaving');
          shot.classList.remove('is-active', 'is-leaving', 'is-under');
          if (wasLeaving) shot.classList.add('is-under');
          gsap.set([shot, imgs[k]], { clearProps: 'all' });
        });

        // The active freedom's gold rule draws in
        if (rules[to]) gsap.fromTo(rules[to], { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' });

        var outShot = shots[from];
        var outImg = imgs[from];
        outShot.classList.remove('is-active');
        outShot.classList.add('is-leaving');
        // Old photo stays put underneath, untouched (no dimming)
        cleanups.push(gsap.delayedCall(1.2, function () {
          outShot.classList.remove('is-leaving');
          gsap.set([outShot, outImg], { clearProps: 'all' });
        }));

        var inShot = shots[to];
        var inImg = imgs[to];
        inShot.classList.add('is-active');
        gsap.fromTo(inShot,
          { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.2,
            ease: 'power3.inOut',
            onComplete: function () {
              gsap.set(inShot, { clearProps: 'clipPath' });
              shots.forEach(function (shot) { shot.classList.remove('is-under'); });
            }
          });
        // Photo settles out of a light zoom (GPU transform only)
        gsap.fromTo(inImg,
          { scale: 1.08, force3D: true },
          {
            scale: 1,
            duration: 1.4,
            ease: 'power3.out',
            force3D: true,
            onComplete: function () { gsap.set(inImg, { clearProps: 'transform' }); }
          });
      }

      function onPrev() { go(current - 1); }
      function onNext() { go(current + 1); }
      function onKey(e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
      }
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
      var viewer = section.querySelector('[data-promise-viewer]');

      prev.addEventListener('click', onPrev);
      next.addEventListener('click', onNext);
      section.addEventListener('keydown', onKey);
      if (viewer) {
        viewer.addEventListener('pointerdown', onDown);
        viewer.addEventListener('pointerup', onUp);
      }

      shots[0].classList.add('is-active');
      sync();

      return function destroySlider() {
        prev.removeEventListener('click', onPrev);
        next.removeEventListener('click', onNext);
        section.removeEventListener('keydown', onKey);
        if (viewer) {
          viewer.removeEventListener('pointerdown', onDown);
          viewer.removeEventListener('pointerup', onUp);
        }
        items.forEach(function (item, i) {
          item.removeEventListener('click', handlers[i].click);
          item.removeEventListener('keydown', handlers[i].key);
          item.removeAttribute('role');
          item.removeAttribute('tabindex');
          item.removeAttribute('aria-current');
          item.classList.remove('is-active');
        });
        killCleanups();
        shots.forEach(function (shot) { shot.classList.remove('is-active', 'is-leaving', 'is-under'); });
        if (gsap) {
          gsap.killTweensOf(tracked);
          gsap.set(tracked, { clearProps: 'all' });
        }
        nav.remove();
        section.classList.remove('is-slider');
      };
    }

    /* SECTION 9 ------------------------------------------------------------ */
    function buildFinale(section, isCompact, split) {
      var gsap = window.gsap;
      var reach = isCompact ? 0.5 : 1;
  
      var title = section.querySelector('.finale__title');
      var lines = list(section, '[data-finale-line]');
      // Each line split into letters; letters fan out from the line's centre
      var lineChars = lines.map(function (line) { return split(line, 'chars').words; });
      var rule = section.querySelector('[data-finale-rule]');
      var lead = split(section.querySelector('[data-finale-lead]'));
      var ctaWrap = section.querySelector('[data-finale-cta-wrap]');
      var band = section.querySelector('[data-finale-band]');
      var img = section.querySelector('[data-finale-img]');
      var wordmark = split(section.querySelector('[data-finale-wordmark]'), 'chars');
      var tagline = section.querySelector('[data-finale-tagline]');
  
      // Background stays ivory at all times (no curtain wipe), so scrolling
      // back up never exposes another colour behind this section.

      // Title, hairline, lead and button arrive as the section comes into view
      var tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 60%', toggleActions: 'play none none reverse' } });
      // Letters flip up out of the mask, unblurring, spreading outward from the centre
      lineChars.forEach(function (chars, i) {
        if (!chars.length) return;
        tl.fromTo(chars,
          { yPercent: 110, rotationX: -85, autoAlpha: 0, filter: 'blur(6px)' },
          { yPercent: 0, rotationX: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out',
            stagger: { each: 0.035, from: 'center' } }, i * 0.22);
      });
      tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power3.inOut' }, 0.6);
      tl.fromTo(lead.words,
        { autoAlpha: 0, y: 14, filter: 'blur(4px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'sine.out', stagger: 0.04 }, 0.9);
      tl.fromTo(ctaWrap,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, 1.3);
  
      // Centred title breathes in: wide tracking settles to tight while scrolling
      if (title) {
        gsap.fromTo(title,
          { letterSpacing: (0.12 * reach) + 'em' },
          { letterSpacing: '-0.01em', ease: 'none', scrollTrigger: { trigger: section, start: 'top 75%', end: 'top 10%', scrub: true } });
      }
  
      // Photograph opens from a narrow centre strip, zooms out and drifts
      if (band && img) {
        gsap.fromTo(band,
          { clipPath: 'inset(0% 34% 0% 34%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: band, start: 'top 92%', end: 'top 25%', scrub: true } });
        gsap.fromTo(img,
          { scale: 1.4 },
          { scale: 1, ease: 'none', scrollTrigger: { trigger: band, start: 'top 92%', end: 'top 15%', scrub: true } });
        gsap.fromTo(img,
          { yPercent: -6 },
          { yPercent: 6, ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true } });
  
        gsap.timeline({ scrollTrigger: { trigger: band, start: 'top 55%', toggleActions: 'play none none reverse' } })
          .fromTo(wordmark.words,
            { yPercent: 115 },
            { yPercent: 0, duration: 1.3, ease: 'power4.out', stagger: 0.06 }, 0)
          .fromTo(tagline,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, 0.7);
      }
    }
  
    V.registerPage('home', function initPromise(page) {
      var gsap = window.gsap;
      var promise = page.container.querySelector('[data-promise]');
      var finale = page.container.querySelector('[data-finale]');
      if ((!promise && !finale) || !page.mm || !gsap || !window.ScrollTrigger) return;
  
      // Scroll animation
      page.mm.add(QUERIES, function (context) {
        var c = context.conditions;
        if (!c.desktop && !c.compact && !c.slider) return;
  
        var splits = [];
        var teardown = null;
        function split(el, mode) {
          var s = splitWords(el, mode);
          splits.push(s);
          return s;
        }
  
        var sliderTeardown = null;
        if (c.slider) {
          // Slider works with or without reduced motion; the scroll reveals don't
          if (promise) {
            if (c.motionOK) buildPromise(promise, 'head-only', split);
            sliderTeardown = buildPromiseSlider(promise, !!c.motionOK);
          }
          if (finale && c.motionOK) buildFinale(finale, false, split);
        } else {
          if (promise) teardown = buildPromise(promise, !!c.desktop, split);
          if (finale) buildFinale(finale, !!c.compact, split);
        }

        return function () {
          if (typeof sliderTeardown === 'function') sliderTeardown();
          if (typeof teardown === 'function') teardown();
          splits.forEach(function (s) { s.revert(); });
        };
      });
    });
  })();