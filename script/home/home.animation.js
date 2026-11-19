/* ==========================================================================
   Vedvan — home page animations (GSAP + ScrollTrigger)
   Everything is created inside mm.add(...) so core.js reverts it when Barba
   leaves the page or the reduced-motion preference changes.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  V.registerPage('home', function initHomeAnimations(page) {
    var gsap = window.gsap;
    var hero = page.container.querySelector('[data-hero]');
    if (!page.mm || !gsap || !hero) return;

    var media = hero.querySelector('.hero__media');
    var video = hero.querySelector('[data-hero-video]');
    var reveals = hero.querySelectorAll('[data-animate]');

    page.mm.add(
      { motionOK: V.config.media.motionOK, reduceMotion: V.config.media.reduceMotion },
      function (context) {
        if (context.conditions.reduceMotion) {
          gsap.set(reveals, { autoAlpha: 1 });
          return;
        }

        var intro = gsap.timeline({ paused: true, defaults: { ease: V.config.ease.out } })
          .fromTo(video, { scale: 1.12 }, { scale: 1, duration: 2.6 }, 0)
          .fromTo(reveals,
            { autoAlpha: 0, yPercent: 40 },
            { autoAlpha: 1, yPercent: 0, duration: 1.6, stagger: 0.12 },
            0.35);

        // Hold the intro behind the welcome gateway so it plays as the site is revealed
        var active = true;
        if (V.gateway) V.gateway.whenRevealed(function () { if (active) intro.play(); });
        else intro.play();

        if (window.ScrollTrigger) {
          gsap.to(media, {
            yPercent: 15,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
          });
        }

        return function () { active = false; };
      }
    );
  });
})();
