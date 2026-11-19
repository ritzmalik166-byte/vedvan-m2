/* ==========================================================================
   Vedvan — home section: About Vedvan (initAboutVedvanExperience)

   A pinned, scrubbed film. One master timeline drives everything:
     - state.open   0 → 1   the compact window (.about__slot) grows into the
                            full viewport: clip-path inset + inner cover scale
     - state.frame          index into the frame sequence, drawn on <canvas>
     - chapter text         reveal → hold (frame held) → exit
   A separate scrub on entry (state.enter) settles the window's slight tilt
   and scale while the section rises below the hero.

   Frames: script/home/about.data.js describes the images (built from
   canvas2/frame_NNN.png by tools/build-about-frames.py). The export is a
   continuous 30 fps sequence, so frame_N is timecode N-1; checkpoints below
   use the "S.FFf" timecode notation (seconds.frames, e.g. "7.5f" = 7 s +
   5 frames = index 215 = frame_216).

   Timeline (units; scroll length = duration × viewport height × VH_PER_UNIT):
     intro       window opens while frames run 0 → "what"
     what        chapter 1 reveal, hold, dispersal exit; frames → "vision"
     vision      chapter 2 reveal, hold, drift exit; frames → "philosophy"
     philosophy  chapter 3 reveal, hold, drift exit; frames → last frame
     outro       from the "outro" checkpoint the film tints toward the next
                 section's green (solid at the lower edge), then the pin
                 releases and the section scrolls away into it
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  var DATA = window.VedvanAboutFrames;
  if (!V || !DATA) return;

  var QUERIES = {
    desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
    tablet: '(min-width: 768px) and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)',
    mobile: '(max-width: 767.98px) and (prefers-reduced-motion: no-preference)',
    portrait: '(orientation: portrait)'
  };

  // Chapter checkpoints, in chapter order (timecodes, see header). The canvas2
  // export ends at 15.19f, before the earlier export's 15.25f / 18.14f, so
  // philosophy and outro sit at the same share of the film, on the settled
  // meditation shot.
  var CHECKPOINTS = {
    what: '2.19f',
    vision: '7.5f',
    philosophy: '13.6f',
    outro: '15.3f'
  };

  var VH_PER_UNIT = { desktop: 0.7, tablet: 0.62, mobile: 0.55 };
  var TIMING = {
    open: 2,              // window expansion (frames run to the first checkpoint)
    leadIn: 0.6,          // text starts this long before frames settle
    reveal: 1.2,          // text fully in after this long
    hold: { desktop: 1.6, tablet: 1.4, mobile: 1.2 },
    exit: 1.1,
    resume: 0.6,          // frames resume this long after the exit starts
    travelPerSecond: 0.4,  // units per second of footage between checkpoints
    travelMin: 1.7,
    travelMax: 3.5,
    veilMin: 1.3,
    tail: 0.3
  };
  // Seconds the timeline takes to catch up with the scroll. Wheels and
  // trackpads already glide through Lenis, so desktop needs less; touch
  // scrolling is native, so the scrub is its only smoothing
  var SCRUB = { desktop: 0.9, tablet: 1, mobile: 1 };
  // Text blur (px multiplier): filters on many words cost most on phones
  var BLUR = { desktop: 1, tablet: 0.8, mobile: 0.5 };
  // Window depth: tilt (deg) and scale before the section reaches the top,
  // inner over-scale while compact, and slow push-in across the film
  var DEPTH = {
    desktop: { tilt: 7, scale: 0.92, settle: 0.08, drift: 0.035 },
    tablet: { tilt: 4, scale: 0.94, settle: 0.06, drift: 0.03 },
    mobile: { tilt: 0, scale: 0.96, settle: 0.05, drift: 0.02 }
  };
  // retain: most frames held in memory at once (null = the whole sequence).
  // With a limit, loading follows the playhead and the frames farthest from
  // it are released (they come back from the HTTP cache if revisited)
  var LOADING = {
    desktop: { concurrency: 6, stride: 1, maxDpr: 2, retain: null },
    tablet: { concurrency: 5, stride: 1, maxDpr: 2, retain: 110 },
    mobile: { concurrency: 4, stride: 2, maxDpr: 2, retain: 70 }
  };
  // Coarse-to-fine load passes (frame steps); the loader line hides after
  // the pass at COARSE_STEP so it never lingers through the fine passes
  var PASSES = [32, 16, 8, 4, 2, 1];
  var COARSE_STEP = 4;
  // Dispersal exit: words sink by up to `drop` of the viewport height, sway
  // `sway` px and tilt `tilt` deg; `spread` is how much of the exit the
  // word starts are staggered across (reading order plus a little jitter)
  var DISPERSE = {
    desktop: { drop: 0.075, sway: 8, tilt: 3 },
    tablet: { drop: 0.065, sway: 6, tilt: 2.5 },
    mobile: { drop: 0.05, sway: 3, tilt: 2 },
    word: 0.8,
    spread: 0.55,
    blur: 6
  };
  // Shade per chapter: landscape frames carry text left / low / high-left;
  // portrait crops stack it at the bottom except for the philosophy chapter
  var SHADES = { landscape: ['side', 'low', 'high'], portrait: ['low', 'low', 'high'] };

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Deterministic spread so the dispersal is identical in both directions
  function spread(i, seed, min, max) {
    var x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    return min + (x - Math.floor(x)) * (max - min);
  }

  /* Frame lookup ------------------------------------------------------- */

  function parseTimecode(value) {
    var m = /^(\d+)\.(\d+)f$/.exec(String(value).trim());
    if (!m) {
      console.warn('[Vedvan] About: unreadable checkpoint "' + value + '"');
      return 0;
    }
    return parseInt(m[1], 10) * DATA.fps + parseInt(m[2], 10);
  }

  // Image index (0-based) for a checkpoint, clamped to the sequence
  function frameAt(checkpoint) {
    var index = parseTimecode(checkpoint);
    if (index > DATA.count - 1) {
      console.warn('[Vedvan] About: checkpoint "' + checkpoint + '" is past the last frame');
    }
    return clamp(index, 0, DATA.count - 1);
  }

  // Index i → <path>frame_NNN.webp, numbered from DATA.first like the source
  function frameUrl(set, i) {
    var name = String(DATA.first + i);
    while (name.length < DATA.digits) name = '0' + name;
    return set.path + DATA.prefix + name + DATA.extension;
  }

  /* Sequence: progressive loader + ticker-driven, cross-fading canvas renderer */

  function createSequence(canvas, opts) {
    var set = opts.set;
    var count = DATA.count;
    var stride = opts.stride;
    // Two stacked canvases: the upper one cross-fades over the lower through
    // CSS opacity (compositor only). They swap roles as the playhead moves, so
    // each frame step costs one drawImage, the same as a single canvas
    var upper = canvas.cloneNode(false);
    upper.removeAttribute('data-about-canvas');
    upper.style.transition = 'none';
    upper.style.opacity = '0';
    upper.style.willChange = 'opacity';
    canvas.after(upper);
    var layers = [canvas, upper].map(function (el) {
      return { el: el, ctx: el.getContext('2d', { alpha: false }), frame: -1 };
    });
    var upperOpacity = 0;
    var images = new Array(count);
    var status = new Uint8Array(count); // 0 idle · 1 loading · 2 ready · 3 failed
    var required = opts.required;
    var order = [];
    var queued = new Uint8Array(count);
    var priority = [];
    var cursor = 0;
    var active = 0;
    var settled = 0;
    var readyCount = 0;
    var coarseCount = 0;
    var retain = opts.retain || 0;
    // Window (in frames) loaded around the playhead when memory is limited
    var ahead = Math.round(retain * stride * 0.65);
    var behind = Math.round(retain * stride * 0.3);
    var wanted = 0;          // fractional playhead
    var direction = 1;       // last direction of travel (1 forward, -1 back)
    var drawn = -1;          // dominant frame on screen
    var dirty = true;
    var started = false;
    var destroyed = false;
    var firstDrawn = false;
    var blendFrom = Infinity; // no blending while the canvas fades in
    // Neighbours further apart than this are not blended (a load gap, not a
    // frame step), so a missing stretch never smears into a double exposure
    var blendReach = stride * 2;
    var ticker = window.gsap.ticker;

    function loadable(i) {
      return i % stride === 0 || required.indexOf(i) >= 0;
    }

    function enqueue(i) {
      if (i < 0 || i >= count || queued[i] || !loadable(i)) return;
      queued[i] = 1;
      order.push(i);
    }

    required.forEach(enqueue);
    if (retain) {
      // The loader line tracks the checkpoints plus the first window
      coarseCount = order.length + Math.min(retain, Math.ceil(ahead / stride));
    } else {
      PASSES.forEach(function (step) {
        if (step < stride) return;
        for (var i = 0; i < count; i += step) enqueue(i);
        if (step >= COARSE_STEP) coarseCount = order.length;
      });
      enqueue(count - 1);
      if (!coarseCount) coarseCount = order.length;
    }

    function reportProgress() {
      if (opts.onProgress) opts.onProgress(Math.min(1, settled / coarseCount), !retain && settled >= order.length);
    }

    // Next idle frame in the window: ahead in the direction of travel first
    function windowNext() {
      var base = Math.round(wanted);
      base -= base % stride;
      var i;
      for (var d = 0; d <= ahead; d += stride) {
        i = base + direction * d;
        if (i >= 0 && i < count && status[i] === 0) return i;
      }
      for (var b = stride; b <= behind; b += stride) {
        i = base - direction * b;
        if (i >= 0 && i < count && status[i] === 0) return i;
      }
      return -1;
    }

    function next() {
      while (priority.length) {
        var p = priority.shift();
        if (status[p] === 0) return p;
      }
      while (cursor < order.length) {
        var o = order[cursor++];
        if (status[o] === 0) return o;
      }
      return retain ? windowNext() : -1;
    }

    // Releases the ready frames farthest from the playhead once over the limit;
    // checkpoints and the frames on screen stay
    function evict() {
      while (readyCount > retain) {
        var far = -1;
        var farDistance = ahead;
        for (var i = 0; i < count; i++) {
          if (status[i] !== 2 || required.indexOf(i) >= 0 || i === layers[0].frame || i === layers[1].frame) continue;
          var distance = Math.abs(i - wanted);
          if (distance > farDistance) {
            far = i;
            farDistance = distance;
          }
        }
        if (far < 0) return;
        images[far] = null;
        status[far] = 0;
        readyCount--;
      }
    }

    function pump() {
      if (!started || destroyed) return;
      while (active < opts.concurrency) {
        var i = next();
        if (i < 0) return;
        load(i);
      }
    }

    function load(i) {
      var img = new Image();
      status[i] = 1;
      active++;
      img.decoding = 'async';
      images[i] = img;

      var finished = false;
      function done(ok) {
        if (finished || destroyed) return;
        finished = true;
        active--;
        settled++;
        status[i] = ok ? 2 : 3;
        if (!ok) images[i] = null;
        else readyCount++;
        if (retain) evict();
        if (ok && (drawn < 0 || Math.abs(i - wanted) <= Math.abs(drawn - wanted) + blendReach)) dirty = true;
        reportProgress();
        pump();
      }

      img.onload = function () {
        // decode() keeps JPEG/WebP decoding off the main thread before first draw
        if (img.decode) img.decode().then(function () { done(true); }, function () { done(img.naturalWidth > 0); });
        else done(true);
      };
      img.onerror = function () {
        done(false);
      };
      img.src = frameUrl(set, i);
    }

    // Frames near the playhead jump the queue, biased toward the direction of
    // travel (on the stride grid) so reverse scrolling is fed as well as forward
    function prioritise(target) {
      var base = target - (target % stride);
      priority.length = 0;
      for (var d = 0; d <= 10; d++) {
        priority.push(base + direction * d * stride);
        if (d && d <= 4) priority.push(base - direction * d * stride);
      }
      pump();
    }

    function readyWithin(from, step, reach) {
      for (var d = 0; d <= reach; d++) {
        var i = from + d * step;
        if (i < 0 || i >= count) break;
        if (status[i] === 2) return i;
      }
      return -1;
    }

    // Fallback while the neighbourhood is still loading: the nearest ready
    // frame, ties going to the side already passed so the picture lags the
    // playhead instead of flicking ahead and back
    function nearestReady(t) {
      if (status[t] === 2) return t;
      var behind = -direction;
      for (var d = 1; d < count; d++) {
        var a = t + behind * d;
        var b = t - behind * d;
        if (a >= 0 && a < count && status[a] === 2) return a;
        if (b >= 0 && b < count && status[b] === 2) return b;
        if ((a < 0 || a >= count) && (b < 0 || b >= count)) break;
      }
      return -1;
    }

    // Draws frame i into a layer; false (and the frame dropped) if it fails
    function paint(layer, i) {
      var img = images[i];
      var cw = layer.el.width;
      var ch = layer.el.height;
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var s = Math.max(cw / iw, ch / ih);
      var sw = cw / s;
      var sh = ch / s;
      try {
        layer.ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, cw, ch);
      } catch (error) {
        status[i] = 3;
        images[i] = null;
        layer.frame = -1;
        dirty = true;
        return false;
      }
      layer.frame = i;
      return true;
    }

    function setUpper(value) {
      if (value === upperOpacity) return;
      upperOpacity = value;
      upper.style.opacity = String(value);
    }

    // Shows lo and hi mixed by `mix` (the weight of hi) with at most one draw:
    // reuse whichever layer already holds one of them and paint the other.
    // If neither is held (a jump), show the dominant one alone this tick and
    // fill in the blend on the next.
    function show(lo, hi, mix) {
      var under = layers[0];
      var over = layers[1];
      function weight(f) { return f === hi ? mix : 1 - mix; }
      var underOk = under.frame === lo || under.frame === hi;
      var overOk = over.frame === lo || over.frame === hi;
      if (underOk && overOk && under.frame !== over.frame) {
        setUpper(weight(over.frame));
      } else if (underOk) {
        var missing = under.frame === lo ? hi : lo;
        if (paint(over, missing)) setUpper(weight(missing));
      } else if (overOk) {
        if (paint(under, over.frame === lo ? hi : lo)) setUpper(weight(over.frame));
      } else if (paint(under, mix < 0.5 ? lo : hi)) {
        setUpper(0);
        dirty = true;
      }
    }

    function showOne(f) {
      if (layers[1].frame === f) setUpper(1);
      else if (layers[0].frame === f || paint(layers[0], f)) setUpper(0);
    }

    // Runs on GSAP's ticker after the scrubbed timeline has updated, so the
    // frame lands in the same paint as the window's clip and scale. Between
    // two ready neighbours the later one is cross-faded over the earlier by
    // the playhead's fraction (in 1/32 steps), so slow scrolls glide instead
    // of stepping and gaps in the export dissolve instead of jumping.
    function render() {
      if (!dirty || destroyed || !canvas.width || !canvas.height) return;
      dirty = false;
      var base = Math.floor(wanted);
      var lo = readyWithin(base, -1, blendReach);
      var hi = readyWithin(base + 1, 1, blendReach);
      var mix = lo >= 0 && hi >= 0 ? Math.round((wanted - lo) / (hi - lo) * 32) / 32 : -1;
      if (mix > 0 && mix < 1 && performance.now() >= blendFrom) {
        show(lo, hi, mix);
        drawn = mix < 0.5 ? lo : hi;
      } else {
        var f = mix >= 0 ? (mix < 0.5 ? lo : hi) : nearestReady(Math.round(wanted));
        if (f < 0) return;
        showOne(f);
        drawn = f;
      }
      if (!firstDrawn && layers[0].frame >= 0) {
        firstDrawn = true;
        // Matches the canvas fade-in in about.css
        blendFrom = performance.now() + 650;
        if (opts.onFirstDraw) opts.onFirstDraw();
      }
    }

    ticker.add(render);

    return {
      start: function () {
        if (started) return;
        started = true;
        pump();
      },
      want: function (value) {
        var next = clamp(value, 0, count - 1);
        if (Math.abs(next - wanted) < 0.001) return;
        direction = next > wanted ? 1 : -1;
        wanted = next;
        dirty = true;
        var target = Math.round(next);
        if (status[target] !== 2 && started) prioritise(target);
        // A moving window needs feeding even when the current frame is ready
        else if (retain) pump();
      },
      // Backing store follows the CSS size × DPR, capped where the source
      // frame has no more detail to give
      resize: function (cssW, cssH) {
        var cover = Math.max(cssW / set.width, cssH / set.height);
        var dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr, Math.max(1, 1 / cover));
        var w = Math.max(1, Math.round(cssW * dpr));
        var h = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          layers.forEach(function (layer) {
            layer.el.width = w;
            layer.el.height = h;
            layer.ctx.imageSmoothingQuality = 'high';
            layer.frame = -1;
          });
          // Resizing clears the canvases: repaint now, not next tick, so a
          // refresh (e.g. mobile toolbar resize) never shows a blank frame
          dirty = true;
          render();
        }
      },
      destroy: function () {
        destroyed = true;
        ticker.remove(render);
        upper.remove();
        images.forEach(function (img, i) {
          if (img && status[i] === 1) {
            img.onload = img.onerror = null;
            img.src = '';
          }
        });
        images.length = 0;
        priority.length = 0;
      }
    };
  }

  /* Text helpers -------------------------------------------------------- */

  /* Wraps each word of a heading in an inline-block span inside an
     aria-hidden layer and adds one sr-only copy of the text. */
  function splitWords(el) {
    if (!el) return { words: [], revert: function () {} };
    var original = el.innerHTML;
    var label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = el.textContent.replace(/\s+/g, ' ').trim();

    var visual = document.createElement('span');
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
            word.className = 'about__word';
            word.textContent = part;
            target.appendChild(word);
          });
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
      words: Array.prototype.slice.call(visual.querySelectorAll('.about__word')),
      revert: function () {
        el.innerHTML = original;
      }
    };
  }

  /* Experience ---------------------------------------------------------- */

  function buildExperience(section, size, portrait) {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    var intro = section.querySelector('[data-about-intro]');
    var title = section.querySelector('[data-about-title]');
    var slot = section.querySelector('[data-about-slot]');
    var win = section.querySelector('[data-about-window]');
    var media = section.querySelector('[data-about-media]');
    var canvas = section.querySelector('[data-about-canvas]');
    var veil = section.querySelector('[data-about-veil]');
    var loader = section.querySelector('[data-about-loader]');
    var loaderFill = section.querySelector('[data-about-loader-fill]');
    var chapterEls = Array.prototype.slice.call(section.querySelectorAll('[data-about-chapter]'));
    if (!intro || !title || !slot || !win || !media || !canvas || !chapterEls.length) return;

    var set = DATA.sets[portrait ? 'portrait' : 'landscape'];
    var depth = DEPTH[size];
    var load = LOADING[size];
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var names = ['what', 'vision', 'philosophy'];
    var shadeNames = SHADES[portrait ? 'portrait' : 'landscape'];
    var shades = {};
    Array.prototype.forEach.call(section.querySelectorAll('[data-about-shade]'), function (el) {
      var m = /about__shade--(\w+)/.exec(el.className);
      if (m) shades[m[1]] = el;
    });

    var frames = {
      what: frameAt(CHECKPOINTS.what),
      vision: frameAt(CHECKPOINTS.vision),
      philosophy: frameAt(CHECKPOINTS.philosophy),
      outro: frameAt(CHECKPOINTS.outro),
      end: DATA.count - 1
    };

    section.classList.add('is-sequenced');

    var state = { open: 0, enter: 0, frame: 0, drift: 0 };
    var geo = null;

    var sequence = createSequence(canvas, {
      set: set,
      stride: load.stride * (saveData ? 2 : 1),
      concurrency: load.concurrency,
      maxDpr: load.maxDpr,
      retain: load.retain,
      required: [0, frames.what, frames.vision, frames.philosophy, frames.outro, frames.end],
      onFirstDraw: function () {
        section.classList.add('has-frames');
      },
      onProgress: function (ratio, complete) {
        if (loaderFill) loaderFill.style.transform = 'scaleX(' + ratio + ')';
        if (loader && (ratio >= 1 || complete)) loader.classList.add('is-done');
      }
    });

    function measure() {
      var r = section.getBoundingClientRect();
      var s = slot.getBoundingClientRect();
      geo = {
        W: section.clientWidth,
        H: section.clientHeight,
        x: s.left - r.left,
        y: s.top - r.top,
        w: s.width,
        h: s.height,
        radius: parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 0
      };
      sequence.resize(geo.W, geo.H);
      render();
    }

    // Window geometry for the current state. The canvas always covers the
    // full viewport; the inner scale k makes it cover the window rectangle
    function render() {
      if (!geo) return;
      var g = geo;
      var p = state.open;
      var w = lerp(g.w, g.W, p);
      var h = lerp(g.h, g.H, p);
      var cx = lerp(g.x + g.w / 2, g.W / 2, p);
      var cy = lerp(g.y + g.h / 2, g.H / 2, p);
      var top = cy - h / 2;
      var left = cx - w / 2;
      var right = g.W - left - w;
      var bottom = g.H - top - h;
      win.style.clipPath = 'inset(' + top.toFixed(2) + 'px ' + right.toFixed(2) + 'px ' + bottom.toFixed(2) + 'px ' +
        left.toFixed(2) + 'px round ' + (g.radius * (1 - p)).toFixed(2) + 'px)';

      var settle = 1 - state.enter;
      var tilt = depth.tilt * settle;
      var scale = lerp(depth.scale, 1, state.enter);
      win.style.transformOrigin = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';
      // Always the same function list, so reaching rest never swaps the layer
      win.style.transform = 'perspective(1400px) rotateX(' + tilt.toFixed(3) + 'deg) scale(' + scale.toFixed(4) + ')';

      var k = Math.max(w / g.W, h / g.H) * (1 + depth.settle * (1 - p) + depth.drift * state.drift);
      media.style.transform = 'translate3d(' + (cx - g.W / 2).toFixed(2) + 'px,' + (cy - g.H / 2).toFixed(2) + 'px,0) scale(' + k.toFixed(5) + ')';

      sequence.want(state.frame);
    }

    /* Chapters --------------------------------------------------------- */

    var titleSplit = splitWords(title);
    var parts = chapterEls.map(function (el, n) {
      var copy = el.querySelector('[data-about-copy]');
      var disperse = el.getAttribute('data-about-exit') === 'disperse';
      var blockEls = Array.prototype.slice.call(el.querySelectorAll('[data-about-block]'));
      if (!blockEls.length) blockEls = [copy];
      var splits = [];
      var blocks = blockEls.map(function (block) {
        var split = splitWords(block.querySelector('[data-about-heading]'));
        splits.push(split);
        var texts = Array.prototype.slice.call(block.querySelectorAll('[data-about-text]'));
        // Dispersing chapters also split their paragraphs; heading and text
        // words together, in reading order
        var scatter = disperse ? texts.reduce(function (all, text) {
          var textSplit = splitWords(text);
          splits.push(textSplit);
          return all.concat(textSplit.words);
        }, split.words.slice()) : [];
        return {
          el: block,
          rule: block.querySelector('[data-about-rule]'),
          words: split.words,
          texts: texts,
          scatter: scatter
        };
      });
      return {
        el: el,
        name: names[n] || 'chapter-' + (n + 1),
        frame: frames[names[n]],
        shade: shades[shadeNames[n]] || null,
        disperse: disperse,
        blocks: blocks,
        splits: splits
      };
    }).filter(function (p) { return typeof p.frame === 'number'; });

    gsap.set(Object.keys(shades).map(function (k) { return shades[k]; }), { opacity: 0 });

    function blur(px) {
      return 'blur(' + (px * BLUR[size]).toFixed(1) + 'px)';
    }

    // Entrance: the window rights its tilt and scale as the section rises,
    // easing to rest as the pin takes over so there is no hand-off kink.
    // Created before the pinned timeline, in scroll order.
    gsap.fromTo(state, { enter: 0 }, {
      enter: 1,
      ease: 'sine.out',
      onUpdate: render,
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 0.4 }
    });

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: render,
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: function () {
          return '+=' + Math.round(window.innerHeight * VH_PER_UNIT[size] * tl.duration());
        },
        pin: true,
        scrub: SCRUB[size],
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: function () {
          sequence.start();
        }
      }
    });

    function revealChapter(p, at) {
      tl.set(p.el, { opacity: 1 }, at);
      if (p.shade) tl.fromTo(p.shade, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'sine.inOut', immediateRender: false }, at - 0.2);
      p.blocks.forEach(function (b, i) {
        var bAt = at + i * 0.35;
        if (b.rule) tl.fromTo(b.rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, bAt);
        if (b.words.length) {
          tl.fromTo(b.words,
            { opacity: 0, yPercent: 45, filter: blur(10) },
            { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.95, ease: 'power3.out', stagger: 0.07 },
            bAt + 0.08);
        }
        b.texts.forEach(function (text, j) {
          tl.fromTo(text,
            { opacity: 0, y: 18, filter: blur(8), '--reveal': 0 },
            { opacity: 1, y: 0, filter: 'blur(0px)', '--reveal': 1, duration: 1.1, ease: 'power3.out' },
            bAt + 0.3 + j * 0.18);
        });
      });
    }

    // Dispersal: the copy softens as a whole while its words, staggered in
    // reading order, sink, sway and fade.
    function disperseChapter(p, at) {
      var d = DISPERSE[size];
      p.blocks.forEach(function (b) {
        // Blur is tweened as a number (GSAP steps rather than eases this
        // filter). The paragraph mask is lifted while the tween runs and
        // handed back to the stylesheet before it, since tweening the custom
        // property would freeze the --reveal wipe on the way back up.
        var fx = { blur: 0 };
        var unmasked = false;
        tl.fromTo(fx, { blur: 0 }, {
          blur: DISPERSE.blur * BLUR[size],
          duration: DISPERSE.word + DISPERSE.spread,
          ease: 'power2.in',
          immediateRender: false,
          onUpdate: function () {
            b.el.style.filter = fx.blur > 0.05 ? 'blur(' + fx.blur.toFixed(2) + 'px)' : '';
            var off = this.progress() > 0;
            if (off === unmasked) return;
            unmasked = off;
            b.texts.forEach(function (text) {
              if (off) text.style.setProperty('--text-mask', 'none');
              else text.style.removeProperty('--text-mask');
            });
          }
        }, at);
        var last = Math.max(1, b.scatter.length - 1);
        b.scatter.forEach(function (word, i) {
          var start = DISPERSE.spread * (0.6 * i / last + 0.4 * spread(i, 7, 0, 1));
          tl.fromTo(word,
            { x: 0, y: 0, rotation: 0 },
            {
              x: spread(i, 2, -1, 1) * d.sway,
              y: function () { return window.innerHeight * d.drop * spread(i, 3, 0.35, 1); },
              rotation: spread(i, 5, -1, 1) * d.tilt,
              duration: DISPERSE.word,
              ease: 'power2.in',
              immediateRender: false
            },
            at + start);
          // Fades on a gentler curve so a word dims as soon as it starts to
          // move instead of sliding out of line at full strength
          tl.fromTo(word, { opacity: 1 }, { opacity: 0, duration: DISPERSE.word, ease: 'sine.in', immediateRender: false }, at + start);
        });
      });
    }

    function driftChapter(p, at) {
      p.blocks.forEach(function (b, i) {
        var targets = [b.rule].concat(b.words.length ? [b.el.querySelector('[data-about-heading]')] : [], b.texts).filter(Boolean);
        tl.fromTo(targets,
          { y: 0, opacity: 1, filter: 'blur(0px)' },
          {
            y: function () { return -window.innerHeight * 0.05; },
            opacity: 0,
            filter: blur(10),
            duration: TIMING.exit,
            ease: 'power2.inOut',
            stagger: 0.08,
            immediateRender: false
          },
          at + i * 0.15);
      });
    }

    function exitChapter(p, at) {
      if (p.disperse) disperseChapter(p, at);
      else driftChapter(p, at);
      if (p.shade) tl.fromTo(p.shade, { opacity: 1 }, { opacity: 0, duration: TIMING.exit + 0.2, ease: 'sine.inOut', immediateRender: false }, at + 0.2);
      tl.set(p.el, { opacity: 0 }, at + TIMING.exit + 0.4);
    }

    function travelFor(from, to) {
      var seconds = (to - from) / DATA.fps;
      return clamp(seconds * TIMING.travelPerSecond, TIMING.travelMin, TIMING.travelMax);
    }

    /* Sequence --------------------------------------------------------- */

    tl.addLabel('intro', 0);
    tl.fromTo(state, { open: 0 }, { open: 1, duration: TIMING.open, ease: 'power2.inOut' }, 0);
    tl.fromTo(state, { frame: 0 }, { frame: parts[0].frame, duration: TIMING.open, ease: 'sine.inOut' }, 0);
    tl.fromTo(titleSplit.words,
      { y: 0, opacity: 1, filter: 'blur(0px)' },
      {
        y: function () { return -window.innerHeight * 0.26; },
        opacity: 0,
        filter: blur(8),
        duration: TIMING.open * 0.6,
        ease: 'power2.in',
        stagger: 0.08
      },
      0.1);

    var settledAt = TIMING.open;
    var hold = TIMING.hold[size];
    var veilAt = 0;

    parts.forEach(function (p, n) {
      var revealAt = Math.max(0, settledAt - TIMING.leadIn);
      revealChapter(p, revealAt);
      tl.addLabel(p.name, revealAt + TIMING.reveal);

      var exitAt = revealAt + TIMING.reveal + hold;
      exitChapter(p, exitAt);

      var last = n === parts.length - 1;
      var to = last ? frames.end : parts[n + 1].frame;
      var resumeAt = exitAt + TIMING.resume;
      var travel = travelFor(p.frame, to);
      tl.fromTo(state, { frame: p.frame }, { frame: to, duration: travel, ease: 'sine.inOut', immediateRender: false }, resumeAt);

      if (last) {
        // Time at which sine.inOut reaches the outro checkpoint
        var f = clamp((frames.outro - p.frame) / Math.max(1, to - p.frame), 0, 1);
        veilAt = resumeAt + travel * Math.acos(1 - 2 * f) / Math.PI;
      }
      settledAt = resumeAt + travel;
    });

    var veilDuration = Math.max(TIMING.veilMin, settledAt - veilAt);
    tl.addLabel('outro', veilAt);
    if (veil) tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: veilDuration, ease: 'sine.inOut', immediateRender: false }, veilAt);
    tl.to({}, { duration: TIMING.tail }, veilAt + veilDuration);
    tl.fromTo(state, { drift: 0 }, { drift: 1, duration: tl.duration() - TIMING.open, ease: 'none' }, TIMING.open);

    ScrollTrigger.addEventListener('refresh', measure);
    measure();

    // Start loading once the page has finished loading (hero first), or as
    // soon as the section is entered, whichever comes first
    var startTimer = 0;
    function startSoon() {
      startTimer = window.setTimeout(sequence.start, 400);
    }
    if (document.readyState === 'complete') startSoon();
    else window.addEventListener('load', startSoon, { once: true });

    return function destroyExperience() {
      window.clearTimeout(startTimer);
      window.removeEventListener('load', startSoon);
      ScrollTrigger.removeEventListener('refresh', measure);
      sequence.destroy();
      titleSplit.revert();
      parts.forEach(function (p) {
        p.splits.forEach(function (s) { s.revert(); });
        p.blocks.forEach(function (b) {
          b.el.style.filter = '';
          b.texts.forEach(function (text) { text.style.removeProperty('--text-mask'); });
        });
      });
      win.style.clipPath = '';
      win.style.transform = '';
      win.style.transformOrigin = '';
      media.style.transform = '';
      if (loaderFill) loaderFill.style.transform = '';
      if (loader) loader.classList.remove('is-done');
      section.classList.remove('is-sequenced', 'has-frames');
    };
  }

  V.registerPage('home', function initAboutVedvanExperience(page) {
    var section = page.container.querySelector('[data-about]');
    if (!section) return;

    var poster = section.querySelector('[data-about-poster]');
    function onPosterError() {
      poster.style.visibility = 'hidden';
    }
    if (poster) poster.addEventListener('error', onPosterError);

    if (page.mm && window.gsap && window.ScrollTrigger) {
      page.mm.add(QUERIES, function (context) {
        var c = context.conditions;
        var size = c.desktop ? 'desktop' : c.tablet ? 'tablet' : c.mobile ? 'mobile' : null;
        if (!size) return;
        return buildExperience(section, size, c.portrait);
      });
    }

    return function destroyAbout() {
      if (poster) poster.removeEventListener('error', onPosterError);
    };
  });
})();
