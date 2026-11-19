/* ==========================================================================
   Vedvan — site footer

   Form: there is no newsletter endpoint yet, so a valid submission opens the
   visitor's email app with a message to connect@thevedvan.com prefilled.
   Swap handleSubmit's final step for a real request when a service exists.

   Motion: the image layer is taller than its scene (see footer.css) and
   rises into place while the footer scrolls in, with the wordmark rising a
   little further so it reads as a separate layer. The footer lives outside
   the Barba container, so this runs once; refreshPriority -1 makes the
   trigger measure after the page's pinned sections have added their space.
   Reduced motion: everything is static.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  var MAILTO = 'connect@thevedvan.com';
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  V.registerGlobal(function initFooter() {
    var footer = document.querySelector('[data-site-footer]');
    if (!footer) return;

    initForm(footer.querySelector('[data-footer-form]'));
    initMotion(footer);
  });

  function initForm(form) {
    if (!form) return;
    var status = form.querySelector('[data-footer-status]');
    var consent = form.elements.consent;

    function setStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle('is-error', !!isError);
    }

    function fieldError(input) {
      var value = input.value.trim();
      if (!value) return true;
      return input.type === 'email' && !EMAIL_PATTERN.test(value);
    }

    form.addEventListener('input', function (event) {
      var target = event.target;
      if (target.getAttribute('aria-invalid') === 'true' && !fieldError(target)) {
        target.removeAttribute('aria-invalid');
      }
      if (target === consent && consent.checked) {
        consent.closest('.site-footer__consent').classList.remove('is-invalid');
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var fields = [form.elements.firstName, form.elements.lastName, form.elements.email];
      var firstInvalid = null;
      fields.forEach(function (input) {
        var invalid = fieldError(input);
        if (invalid) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        if (invalid && !firstInvalid) firstInvalid = input;
      });

      consent.closest('.site-footer__consent').classList.toggle('is-invalid', !consent.checked);
      if (!firstInvalid && !consent.checked) firstInvalid = consent;

      if (firstInvalid) {
        setStatus('Please complete all required fields with a valid email and accept the consent.', true);
        firstInvalid.focus();
        return;
      }

      var first = fields[0].value.trim();
      var last = fields[1].value.trim();
      var email = fields[2].value.trim();
      var body = 'Please add me to the Vedvan community updates.\n\n' +
        'Name: ' + first + ' ' + last + '\n' +
        'Email: ' + email + '\n';
      window.location.href = 'mailto:' + MAILTO +
        '?subject=' + encodeURIComponent('Join the world of Vedvan') +
        '&body=' + encodeURIComponent(body);
      setStatus('Thank you. Your email app should open with your details ready to send.');
    });
  }

  function initMotion(footer) {
    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;

    var scene = footer.querySelector('[data-footer-scene]');
    var layer = footer.querySelector('[data-footer-parallax]');
    var wordmark = footer.querySelector('[data-footer-wordmark]');
    if (!scene || !layer) return;

    gsap.matchMedia().add({
      motionOK: V.config.media.motionOK,
      mobile: V.config.media.mobile
    }, function (context) {
      var c = context.conditions;
      if (!c.motionOK) return;

      // Rise stays inside the layer's 12% top overscan
      gsap.timeline({
        scrollTrigger: {
          trigger: scene,
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: true,
          refreshPriority: -1,
          invalidateOnRefresh: true
        }
      })
        .fromTo(layer, { yPercent: c.mobile ? 6 : 10, scale: 1.04 }, { yPercent: 0, scale: 1, ease: 'none' }, 0)
        .fromTo(wordmark, { yPercent: c.mobile ? 25 : 45 }, { yPercent: 0, ease: 'none' }, 0);
    });
  }
})();
