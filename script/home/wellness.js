/* ==========================================================================
   Vedvan — home section 5: Explore the VEDVAN Experience (stacking cards)

   Reads window.VedvanWellnessData (wellness.data.js) and builds the title,
   subtitle, names list, the details panel and one image card per entry
   (in order; later cards stack above earlier ones).

   Motion allowed: the section pins for LEAD + SEGMENT × (cards − 1) + TAIL
   viewport heights. In its segment each incoming card rises from the bottom
   of the image panel 1:1 with the scroll. When its top edge passes
   LATCH × panel height (25% — the panel is the full viewport on ≥768px)
   a short time-based blend finishes the move to the top, so the card
   settles without further scrolling; scrolling back above RELEASE blends it
   back onto the scroll position. The blend multiplies the scroll-driven
   offset, so every card is fully settled by the end of its own segment
   even during fast scrolling. Nothing animates while the page is idle.

   Reduced motion: no pin — the cards render as a static list.
   1024–1279px: no pin at all — a simple slider (buildSlider) at content
   height, with instant switching under reduced motion.
   ========================================================================== */
   (function () {
    'use strict';
  
    var V = window.Vedvan;
    if (!V) return;
  
    var LATCH = 0.25;
    var RELEASE = 0.3;
    var LEAD = 0.3;
    var TAIL = 0.35;
    var SEGMENT = { desktop: 1, mobile: 0.85 };
    var IMAGE_DRIFT = 0.1;
  
    function clamp(n, min, max) {
      return Math.min(Math.max(n, min), max);
    }
  
    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }
  
    V.registerPage('home', function initWellness(page) {
      var section = page.container.querySelector('[data-wellness]');
      var data = window.VedvanWellnessData;
      if (!section || !data || !data.cards || !data.cards.length) return;
  
      var gsap = window.gsap;
      var list = section.querySelector('[data-wellness-list]');
      var stack = section.querySelector('[data-wellness-stack]');
      var details = section.querySelector('[data-wellness-details]');
      var nameEl = section.querySelector('[data-wellness-name]');
      var textEl = section.querySelector('[data-wellness-text]');
      var subtitleEl = section.querySelector('[data-wellness-subtitle]');
      var eyebrowEl = section.querySelector('[data-wellness-eyebrow]');
      var titleEl = section.querySelector('[data-wellness-title]');
      if (titleEl) titleEl.textContent = data.title || '';
      if (eyebrowEl) eyebrowEl.textContent = data.eyebrow || '';
      if (subtitleEl) subtitleEl.textContent = data.subtitle || '';

      var items = [];
      var cards = [];
      var sizers = [];
      data.cards.forEach(function (d, i) {
        var item = el('li', 'wellness__item', d.label || d.name);
        list.appendChild(item);
        items.push(item);
  
        var card = el('div', 'wellness__card');
        card.style.zIndex = String(i + 1);
        var media = el('div', 'wellness__card-media');
        var img = el('img', 'wellness__card-img');
        img.src = d.image;
        img.alt = d.imageAlt || '';
        img.width = 1200;
        img.height = 1400;
        img.decoding = 'async';
        if (i > 0) img.loading = 'lazy';
        media.appendChild(img);
        var artTag = el('span', 'art-tag', '*Artistic Image');
        artTag.setAttribute('aria-hidden', 'true');
        media.appendChild(artTag);
        card.appendChild(media);
        if (d.label) card.appendChild(el('p', 'wellness__card-label', d.label));
        card.appendChild(el('h3', 'wellness__card-name', d.name));
        card.appendChild(el('p', 'wellness__card-text', d.description));
        stack.appendChild(card);
        cards.push({ el: card, img: img, latched: i === 0, blend: i === 0 ? 1 : 0, tween: null });

        // Invisible copy of every entry in the same grid cell as the live
        // details, so the panel is always as tall as the longest entry and
        // the layout never jumps (or clips) when the active card changes
        var sizer = el('div', 'wellness__details-sizer');
        sizer.setAttribute('aria-hidden', 'true');
        sizer.appendChild(el('p', 'wellness__details-name', d.name));
        sizer.appendChild(el('p', 'wellness__details-text', d.description));
        details.appendChild(sizer);
        sizers.push(sizer);
      });
  
      // Stacked cards sit outside the viewport until they enter, so lazy
      // loading would start too late; fetch them once the section is near
      var nearObserver = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        cards.forEach(function (c) { c.img.loading = 'eager'; });
        nearObserver.disconnect();
      }, { rootMargin: '150% 0px' });
      nearObserver.observe(section);
  
      /* Active name + details --------------------------------------------- */
  
      var activeIndex = -1;
      var detailsTl = null;
  
      function fillDetails(i) {
        nameEl.textContent = data.cards[i].name;
        textEl.textContent = data.cards[i].description;
      }
  
      function setActive(i, instant) {
        if (i === activeIndex) return;
        activeIndex = i;
        items.forEach(function (item, k) {
          item.classList.toggle('is-active', k === i);
          if (k === i) item.setAttribute('aria-current', 'true');
          else item.removeAttribute('aria-current');
        });
        if (detailsTl) detailsTl.kill();
        detailsTl = null;
        if (instant || !gsap || V.prefersReducedMotion) {
          fillDetails(i);
          if (gsap) gsap.set(details, { autoAlpha: 1, y: 0 });
          return;
        }
        detailsTl = gsap.timeline()
          .to(details, { autoAlpha: 0, y: -6, duration: 0.2, ease: 'power1.in' })
          .call(fillDetails, [i])
          .fromTo(details, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' });
      }
  
      setActive(0, true);
  
      /* Pinned stacking sequence ------------------------------------------ */
  
      function buildSequence(isMobile) {
        var segment = isMobile ? SEGMENT.mobile : SEGMENT.desktop;
        var viewH = 0;
        var panelH = 0;
        var scrolled = 0;
  
        section.classList.add('is-stacked');
  
        function distance() {
          return viewH * (LEAD + segment * (cards.length - 1) + TAIL);
        }
  
        function measure() {
          viewH = section.offsetHeight;
          panelH = stack.clientHeight;
        }
  
        function render() {
          cards.forEach(function (c, i) {
            if (i === 0) return;
            var u = (scrolled - viewH * (LEAD + segment * (i - 1))) / (viewH * segment);
            var raw = panelH * clamp(1 - u, 0, 1);
            var y = raw * (1 - c.blend);
            c.el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
            c.img.style.transform = 'translate3d(0,' + (-y * IMAGE_DRIFT).toFixed(2) + 'px,0)';
          });
        }
  
        function setLatch(c, on, instant) {
          if (c.latched === on) return;
          c.latched = on;
          if (c.tween) c.tween.kill();
          c.tween = null;
          if (instant) {
            c.blend = on ? 1 : 0;
            return;
          }
          c.tween = gsap.to(c, {
            blend: on ? 1 : 0,
            duration: on ? 0.8 : 0.6,
            ease: 'power2.inOut',
            onUpdate: render,
            onComplete: function () { c.tween = null; }
          });
        }
  
        function update(instant) {
          var count = 1;
          cards.forEach(function (c, i) {
            if (i === 0) return;
            var u = (scrolled - viewH * (LEAD + segment * (i - 1))) / (viewH * segment);
            var top = 1 - u;
            if (!c.latched && top <= LATCH) setLatch(c, true, instant);
            else if (c.latched && top > RELEASE) setLatch(c, false, instant);
            if (c.latched) count = i + 1;
          });
          setActive(count - 1, instant);
          render();
        }
  
        measure();
        var trigger = window.ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: function () { return '+=' + Math.round(distance()); },
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: function (self) {
            measure();
            scrolled = clamp(self.scroll() - self.start, 0, self.end - self.start);
            update(true);
          },
          onUpdate: function (self) {
            scrolled = clamp(self.scroll() - self.start, 0, self.end - self.start);
            update(false);
          }
        });
        scrolled = clamp(trigger.scroll() - trigger.start, 0, trigger.end - trigger.start);
        update(true);

        // On phones/tablets the image panel's height depends on the copy
        // below it (fonts loading, rotation), so keep the card offsets in step
        var panelObserver = typeof ResizeObserver === 'function'
          ? new ResizeObserver(function () {
              if (stack.clientHeight === panelH) return;
              measure();
              render();
            })
          : null;
        if (panelObserver) panelObserver.observe(stack);

        return function () {
          if (panelObserver) panelObserver.disconnect();
          trigger.kill();
          cards.forEach(function (c, i) {
            if (c.tween) c.tween.kill();
            c.tween = null;
            c.latched = i === 0;
            c.blend = i === 0 ? 1 : 0;
            c.el.style.transform = '';
            c.img.style.transform = '';
          });
          section.classList.remove('is-stacked');
          setActive(0, true);
        };
      }
  
      /* lg → xl (1024–1279px): simple slider, no pin ----------------------- */
      // Same side-by-side layout as the pinned version, but the section is as
      // tall as its copy column. Names, prev/next, dots, arrow keys and swipe
      // change the card; the new card wipes in over the old one.

      var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      function pad(n) {
        return (n < 10 ? '0' : '') + n;
      }

      function buildSlider() {
        var n = cards.length;
        var current = 0;
        var copy = section.querySelector('.wellness__copy');
        var instantOnly = !gsap || V.prefersReducedMotion;

        section.classList.add('is-stacked', 'is-slider');

        var nav = el('div', 'wellness__slider-nav');
        var prev = el('button', 'wellness__slider-btn wellness__slider-btn--prev');
        prev.type = 'button';
        prev.setAttribute('aria-label', 'Previous experience');
        prev.innerHTML = ARROW;
        var next = el('button', 'wellness__slider-btn');
        next.type = 'button';
        next.setAttribute('aria-label', 'Next experience');
        next.innerHTML = ARROW;
        var dotsWrap = el('div', 'wellness__slider-dots');
        var dots = cards.map(function (c, i) {
          var dot = el('button', 'wellness__slider-dot');
          dot.type = 'button';
          dot.setAttribute('aria-label', 'Show ' + data.cards[i].name);
          dot.addEventListener('click', function () { go(i); });
          dotsWrap.appendChild(dot);
          return dot;
        });
        var count = el('span', 'wellness__slider-count');
        count.setAttribute('aria-hidden', 'true');
        nav.append(prev, dotsWrap, next, count);
        copy.appendChild(nav);

        // Names act as tabs into the slider
        var itemHandlers = items.map(function (item, i) {
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

        cards.forEach(function (c, i) {
          c.el.style.zIndex = '';
          c.el.classList.toggle('is-active', i === 0);
          // Start loading every picture now, with priority, so it is
          // usually ready before the first click
          c.img.loading = 'eager';
          c.img.setAttribute('fetchpriority', 'high');
        });
        cards.forEach(function (c) { ready(c.img); });

        var all = [];
        cards.forEach(function (c) { all.push(c.el, c.img); });

        function settle(k) {
          cards.forEach(function (c, i) {
            c.el.classList.toggle('is-active', i === k);
            c.el.classList.remove('is-leaving', 'is-under');
          });
        }

        // Resolves once the picture is downloaded AND decoded, so the wipe
        // never reveals an empty frame (right after a reload the ~1 MB
        // images are often still loading when the first click comes in).
        // A timeout keeps a broken/slow image from blocking the slider.
        function ready(img) {
          return new Promise(function (resolve) {
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

        var shown = 0;      // card actually on screen
        var request = 0;    // newest click wins while an image is loading

        function go(i) {
          var to = (i + n) % n;
          var from = current;
          if (to === from) return;
          var dir = (to > from && !(from === 0 && to === n - 1)) || (from === n - 1 && to === 0) ? 1 : -1;
          current = to;
          sync();
          setActive(to);

          if (instantOnly) {
            settle(to);
            shown = to;
            return;
          }

          var token = ++request;
          ready(cards[to].img).then(function () {
            if (token !== request || to === shown) return;
            var origin = shown;
            shown = to;
            play(origin, to, dir);
          });
        }

        function play(from, to, dir) {
          var out = cards[from];
          var inn = cards[to];
          gsap.killTweensOf(all);
          cards.forEach(function (c) {
            if (c.cleanup) c.cleanup.kill();
            c.cleanup = null;
          });
          // On a fast click the outgoing card may still be mid-wipe (only
          // partly visible). Keep the card that was under it as a full
          // backdrop so the gap shows a picture, never the dark background.
          cards.forEach(function (c, k) {
            if (k === from || k === to) {
              c.el.classList.remove('is-under');
              return;
            }
            var wasLeaving = c.el.classList.contains('is-leaving');
            c.el.classList.remove('is-active', 'is-leaving', 'is-under');
            if (wasLeaving) c.el.classList.add('is-under');
            gsap.set([c.el, c.img], { clearProps: 'all' });
          });

          // Old card stays put underneath, untouched (no dimming: a filter
          // fade read as a dark flash and repainted the big image every frame)
          out.el.classList.remove('is-active');
          out.el.classList.add('is-leaving');
          out.cleanup = gsap.delayedCall(1.2, function () {
            out.cleanup = null;
            out.el.classList.remove('is-leaving');
            gsap.set([out.el, out.img], { clearProps: 'all' });
          });

          // New card wipes in from the travel side; its picture settles and
          // brightens inside the fixed frame
          inn.el.classList.add('is-active');
          gsap.fromTo(inn.el,
            { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 1.2,
              ease: 'power3.inOut',
              onComplete: function () {
                gsap.set(inn.el, { clearProps: 'clipPath' });
                cards.forEach(function (c) { c.el.classList.remove('is-under'); });
              }
            });
          // Picture settles gently inside the frame (GPU transform only)
          gsap.fromTo(inn.img,
            { yPercent: -4, force3D: true },
            {
              yPercent: 0,
              duration: 1.4,
              ease: 'power3.out',
              force3D: true,
              onComplete: function () { gsap.set(inn.img, { clearProps: 'transform' }); }
            });
        }

        function sync() {
          dots.forEach(function (dot, k) {
            dot.classList.toggle('is-active', k === current);
            if (k === current) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
          });
          count.innerHTML = pad(current + 1) + '<i>/' + pad(n) + '</i>';
        }

        function onPrev() { go(current - 1); }
        function onNext() { go(current + 1); }
        function onKey(e) {
          if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
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

        prev.addEventListener('click', onPrev);
        next.addEventListener('click', onNext);
        section.addEventListener('keydown', onKey);
        stack.addEventListener('pointerdown', onDown);
        stack.addEventListener('pointerup', onUp);

        sync();
        setActive(0, true);

        return function destroySlider() {
          prev.removeEventListener('click', onPrev);
          next.removeEventListener('click', onNext);
          section.removeEventListener('keydown', onKey);
          stack.removeEventListener('pointerdown', onDown);
          stack.removeEventListener('pointerup', onUp);
          items.forEach(function (item, i) {
            item.removeEventListener('click', itemHandlers[i].click);
            item.removeEventListener('keydown', itemHandlers[i].key);
            item.removeAttribute('role');
            item.removeAttribute('tabindex');
          });
          nav.remove();
          cards.forEach(function (c) {
            if (c.cleanup) c.cleanup.kill();
            c.cleanup = null;
          });
          if (gsap) {
            gsap.killTweensOf(all);
            gsap.set(all, { clearProps: 'all' });
          }
          cards.forEach(function (c, i) {
            c.el.classList.remove('is-active', 'is-leaving', 'is-under');
            c.el.style.zIndex = String(i + 1);
          });
          section.classList.remove('is-stacked', 'is-slider');
          setActive(0, true);
        };
      }

      if (page.mm && gsap && window.ScrollTrigger) {
        page.mm.add({
          motionOK: V.config.media.motionOK,
          mobile: V.config.media.mobile,
          slider: '(min-width: 1024px) and (max-width: 1279.98px)'
        }, function (context) {
          if (context.conditions.slider) return buildSlider();
          if (!context.conditions.motionOK) return;
          return buildSequence(context.conditions.mobile);
        });
      }
  
      return function destroyWellness() {
        nearObserver.disconnect();
        if (detailsTl) detailsTl.kill();
        list.textContent = '';
        if (subtitleEl) subtitleEl.textContent = '';
        if (eyebrowEl) eyebrowEl.textContent = '';
        if (titleEl) titleEl.textContent = '';
        cards.forEach(function (c) { c.el.remove(); });
        sizers.forEach(function (s) { s.remove(); });
      };
    });
  })();