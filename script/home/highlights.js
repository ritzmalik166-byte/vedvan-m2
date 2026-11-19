/* ==========================================================================
   Vedvan — home section 4: key highlights

   Parallax: the image layer sits inside a clipped frame and is taller than
   it (see highlights.css), and one scrubbed ScrollTrigger moves it from
   slightly above to slightly below centre while the section crosses the
   viewport, so the content appears to glide over the image. Lenis already
   smooths the scroll; the short scrub only softens native touch scrolling.
   Nothing is pinned. The heading, stats and labels reveal once on entry and
   reverse only when the section is scrolled back out above.
   Reduced motion: no parallax and no reveal — everything is static.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  V.registerPage('home', function initHighlights(page) {
    var section = page.container.querySelector('[data-highlights]');
    if (!section) return;

    var gsap = window.gsap;
    var layer = section.querySelector('[data-highlights-parallax]');
    var title = section.querySelector('[data-highlights-title]');
    var items = Array.prototype.slice.call(section.querySelectorAll('[data-highlights-item]'));

    if (page.mm && gsap && window.ScrollTrigger) {
      page.mm.add({
        motionOK: V.config.media.motionOK,
        wide: '(min-width: 1024px)',
        mobile: V.config.media.mobile
      }, function (context) {
        var c = context.conditions;
        if (!c.motionOK) return;

        // Travel stays inside the layer's overscan (8% each side)
        var travel = c.mobile ? 3.5 : c.wide ? 6 : 5;
        gsap.fromTo(layer,
          { yPercent: -travel, scale: c.mobile ? 1.02 : 1.06 },
          {
            yPercent: travel,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.4,
              invalidateOnRefresh: true
            }
          });

        var stats = items.map(function (item) { return item.querySelector('.highlights__stat'); });
        var labels = items.map(function (item) { return item.querySelector('.highlights__label'); });
        gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: {
            trigger: section.querySelector('.highlights__content'),
            start: c.mobile ? 'top 85%' : 'top 70%',
            toggleActions: 'play none none reverse'
          }
        })
          .from(title, { autoAlpha: 0, y: 24, duration: 1 }, 0)
          .from(stats, { autoAlpha: 0, y: 10, duration: 0.8, stagger: 0.12 }, 0.25)
          .from(labels, { autoAlpha: 0, y: 14, duration: 0.85, stagger: 0.12 }, 0.32);
      });
    }
  });
})();
