/* ==========================================================================
   Vedvan — home page interactions
   Hero background video: plays once and rests on its final frame. Fades in
   once a frame is ready, falls back to the gradient if the file fails, waits
   for the welcome gateway to reveal the page, pauses while off-screen (and
   resumes from the same point), and stays on its first frame for reduced
   motion and Save-Data. Calling play() on an ended video restarts it, so
   nothing calls it once playback has finished.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  V.registerPage('home', function initHeroVideo(page) {
    var hero = page.container.querySelector('[data-hero]');
    var video = hero && hero.querySelector('[data-hero-video]');
    if (!video) return;

    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var held = V.prefersReducedMotion || saveData;
    var waiting = !!(V.gateway && V.gateway.active);
    var ended = video.ended;
    var inView = true;
    var active = true;

    function sync() {
      if (ended) return;
      if (held || waiting || !inView) {
        video.pause();
        return;
      }
      var attempt = video.play();
      if (attempt && attempt.catch) {
        // Autoplay blocked (e.g. Low Power Mode): the current frame stays as the background
        attempt.catch(function () {});
      }
    }

    function onReady() {
      hero.classList.add('is-video-ready');
    }

    function onError() {
      hero.classList.add('has-video-error');
      console.warn('[Vedvan] Hero video failed to load:', video.currentSrc || video.getAttribute('src'));
    }

    function onEnded() {
      ended = true;
    }

    if (held || waiting) {
      video.removeAttribute('autoplay');
      video.pause();
      // Autoplay may already have advanced behind the gateway; start the single play from the top
      if (waiting && video.currentTime > 0) video.currentTime = 0;
    }

    if (video.error) onError();
    else if (video.readyState >= 2) onReady();

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);

    var observer = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      sync();
    });
    observer.observe(hero);

    if (waiting) {
      V.gateway.whenRevealed(function () {
        if (!active) return;
        waiting = false;
        sync();
      });
    }

    var stopWatchingMotion = V.onReducedMotionChange(function () {
      if (V.prefersReducedMotion) {
        held = true;
        sync();
      }
    });

    return function destroyHeroVideo() {
      active = false;
      stopWatchingMotion();
      observer.disconnect();
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      video.pause();
    };
  });
})();

(() => {
  const hero = document.querySelector(".hero[data-hero]");
  if (!hero) return;

  const heroVideo = hero.querySelector("[data-hero-video]");
  const soundButton = hero.querySelector("[data-hero-sound]");
  const mutedIcon = hero.querySelector("[data-sound-muted-icon]");
  const soundOnIcon = hero.querySelector("[data-sound-on-icon]");

  if (!heroVideo) return;

  const videoSources = {
    desktop:
      "https://contenaissance.blob.core.windows.net/ct-assets/VEDVAN_Walkthrough_New_Nov_17_Logo_update_For_web_Resized.mp4",

    tablet:
      "https://contenaissance.blob.core.windows.net/ct-assets/Vedvan%2012sep%20Video%20768px%20-%20797px%2002.mp4",

    mobile:
      "https://contenaissance.blob.core.windows.net/ct-assets/Vedvan%2012sep%20Video%20375px%20-%20797px%2002.mp4",
  };

  let currentSource = "";

  // Keep video muted by default.
  heroVideo.muted = true;
  heroVideo.defaultMuted = true;

  const getVideoSource = () => {
    const width = window.innerWidth;

    if (width >= 1024) return videoSources.desktop;
    if (width >= 768) return videoSources.tablet;

    return videoSources.mobile;
  };

  const updateSoundIcon = () => {
    const isMuted = heroVideo.muted;

    if (soundButton) {
      soundButton.setAttribute(
        "aria-label",
        isMuted ? "Unmute video" : "Mute video"
      );

      soundButton.setAttribute(
        "aria-pressed",
        String(!isMuted)
      );
    }

    mutedIcon?.classList.toggle("hidden", !isMuted);
    soundOnIcon?.classList.toggle("hidden", isMuted);
  };

  const updateHeroVideo = () => {
    const newSource = getVideoSource();

    if (newSource === currentSource) return;

    currentSource = newSource;
    heroVideo.src = newSource;
    heroVideo.load();

    heroVideo.play().catch(() => {
      // Browser autoplay restrictions may prevent playback.
    });
  };

  // Toggle video sound.
  soundButton?.addEventListener("click", () => {
    heroVideo.muted = !heroVideo.muted;
    updateSoundIcon();

    if (heroVideo.paused) {
      heroVideo.play().catch(() => {});
    }
  });

  heroVideo.addEventListener("volumechange", updateSoundIcon);

  // Initial setup.
  updateHeroVideo();
  updateSoundIcon();

  // Responsive source switching.
  window.addEventListener("resize", updateHeroVideo, {
    passive: true,
  });
})();
