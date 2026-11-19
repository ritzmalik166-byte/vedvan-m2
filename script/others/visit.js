/* ==========================================================================
   Vedvan — "Request a Private Visit" popup

   Any element with [data-visit-open] opens it (Enquire, the zone CTAs,
   Connect With Us). An optional data-visit-type="Site Visit" preselects the
   request type. The link's own href stays as a no-JS fallback.

   Accessibility: role="dialog" + aria-modal; the rest of the page is made
   inert while open, focus moves into the popup and returns to the button
   afterwards; Escape, the close button and the backdrop all close it.

   Submission: there is no form endpoint yet, so (like the footer form) a
   valid request opens the visitor's email app with the details prefilled.
   Replace sendRequest() with a real request when a service exists.
   ========================================================================== */
(function () {
  'use strict';

  var V = window.Vedvan;
  if (!V) return;

  var MAILTO = 'connect@thevedvan.com';
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var CLOSE_MS = 500;

  V.registerGlobal(function initVisit() {
    var root = document.querySelector('[data-visit]');
    if (!root) return;

    var panel = root.querySelector('.visit__panel');
    var form = root.querySelector('[data-visit-form]');
    var done = root.querySelector('[data-visit-done]');
    var status = root.querySelector('[data-visit-status]');
    var dateInput = form.elements.date;
    var outside = [
      document.querySelector('[data-barba="wrapper"]'),
      document.querySelector('[data-site-header]'),
      document.querySelector('.visit-fab')
    ].filter(Boolean);

    var lastTrigger = null;
    var closeTimer = null;
    var isOpen = false;

    function todayISO() {
      var d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 10);
    }

    function selectType(type) {
      if (!type) return;
      Array.prototype.forEach.call(form.elements.requestType, function (radio) {
        radio.checked = radio.value.toLowerCase() === type.toLowerCase();
      });
    }

    function open(trigger) {
      if (isOpen) return;
      isOpen = true;
      lastTrigger = trigger || document.activeElement;
      clearTimeout(closeTimer);

      // Fresh form each time unless a request is half filled
      if (!done.hidden) resetForm();
      dateInput.min = todayISO();
      if (trigger && trigger.dataset.visitType) selectType(trigger.dataset.visitType);

      root.hidden = false;
      // Force a style flush so the opening transition runs
      void root.offsetWidth;
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('visit-open');
      outside.forEach(function (el) { el.inert = true; });
      if (V.scroll) V.scroll.stop();

      panel.focus({ preventScroll: true });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('visit-open');
      outside.forEach(function (el) { el.inert = false; });
      if (V.scroll) V.scroll.start();

      closeTimer = setTimeout(function () {
        root.hidden = true;
      }, V.prefersReducedMotion ? 0 : CLOSE_MS);

      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus({ preventScroll: true });
      }
    }

    function resetForm() {
      form.reset();
      form.hidden = false;
      done.hidden = true;
      status.textContent = '';
      form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
      form.querySelectorAll('.visit__error').forEach(function (el) { el.textContent = ''; });
    }

    /* Validation ---------------------------------------------------------- */
    function check(input) {
      var value = input.value.trim();
      switch (input.name) {
        case 'name':
          return value.length >= 2 ? '' : 'Please enter your name.';
        case 'email':
          if (!value) return 'Please enter your email.';
          return EMAIL_PATTERN.test(value) ? '' : 'Please enter a valid email address.';
        case 'phone':
          var digits = value.replace(/\D/g, '');
          if (!digits) return 'Please enter your phone number.';
          return /^[+\d\s()-]+$/.test(value) && digits.length >= 7 && digits.length <= 15
            ? '' : 'Please enter a valid phone number.';
        case 'date':
          if (!value) return 'Please choose a preferred date.';
          return value >= todayISO() ? '' : 'Please choose today or a later date.';
        default:
          return '';
      }
    }

    function showError(input, message) {
      var error = document.getElementById(input.getAttribute('aria-describedby'));
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      if (error) error.textContent = message;
    }

    var textFields = ['name', 'email', 'phone', 'date'].map(function (n) { return form.elements[n]; });

    // Clear an error as soon as the field becomes valid
    form.addEventListener('input', function (event) {
      var input = event.target;
      if (input.getAttribute('aria-invalid') === 'true' && !check(input)) showError(input, '');
    });

    form.addEventListener('focusout', function (event) {
      var input = event.target;
      if (textFields.indexOf(input) !== -1 && input.value.trim()) showError(input, check(input));
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var firstInvalid = null;
      textFields.forEach(function (input) {
        var message = check(input);
        showError(input, message);
        if (message && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        status.textContent = 'Please check the highlighted fields.';
        firstInvalid.focus();
        return;
      }

      status.textContent = '';
      sendRequest({
        type: (form.querySelector('input[name="requestType"]:checked') || {}).value || '',
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        date: form.elements.date.value
      });

      form.hidden = true;
      done.hidden = false;
      var heading = done.querySelector('[tabindex]');
      if (heading) heading.focus({ preventScroll: true });
    });

    function sendRequest(data) {
      var body =
        'Request type: ' + data.type + '\n' +
        'Name: ' + data.name + '\n' +
        'Email: ' + data.email + '\n' +
        'Phone: ' + data.phone + '\n' +
        'Preferred date: ' + data.date + '\n';
      window.location.href = 'mailto:' + MAILTO +
        '?subject=' + encodeURIComponent('Vedvan: ' + data.type + ' request') +
        '&body=' + encodeURIComponent(body);
    }

    /* Opening / closing ---------------------------------------------------- */
    // Capture phase so Barba and Lenis never see the click on a trigger link
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-visit-open]');
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      open(trigger);
    }, true);

    root.addEventListener('click', function (event) {
      if (event.target.closest('[data-visit-close]')) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) {
        event.stopPropagation();
        close();
      }
    });

    document.addEventListener('vedvan:page:destroy', close);

    /* Phone Enquire tab: revealed once the middle of section 2 (#about)
       reaches the middle of the screen; hidden again above that point.
       Pages without #about show it straight away. ---------------------- */
    var fab = document.querySelector('.visit-fab');
    if (fab) {
      var fabTicking = false;
      var updateFab = function () {
        fabTicking = false;
        var section = document.getElementById('about');
        var show = true;
        if (section) {
          var rect = section.getBoundingClientRect();
          show = rect.top + rect.height / 2 <= window.innerHeight / 2;
        }
        fab.classList.toggle('is-revealed', show);
      };
      var queueFab = function () {
        if (fabTicking) return;
        fabTicking = true;
        requestAnimationFrame(updateFab);
      };
      window.addEventListener('scroll', queueFab, { passive: true });
      window.addEventListener('resize', queueFab);
      document.addEventListener('vedvan:page:init', queueFab);
      updateFab();
    }

    // Public hook, e.g. Vedvan.visit.open() from anywhere
    V.visit = { open: function (type) { open(type ? { dataset: { visitType: type } } : null); }, close: close };
  });
})();
