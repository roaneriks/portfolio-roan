/* =========================================================================
   MOTION — added after layout/content were complete.
   - Lenis: smooth scroll (skipped if the user prefers reduced motion)
   - GSAP ScrollTrigger: kept in sync with Lenis
   - Nav morph: toggles .is-scrolled on the nav past a small threshold

   Scroll-snap on the homepage panels is handled in CSS (html.is-home).
   Everything here degrades gracefully if a library fails to load.
   ========================================================================= */
(function () {
  'use strict';

  var nav = document.querySelector('.nav');
  var SCROLL_THRESHOLD = 60;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setNavState() {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
  }

  // Nav morph is driven by the native scroll position so it works regardless
  // of whether Lenis is active (Lenis scrolls the window, firing this event).
  window.addEventListener('scroll', setNavState, { passive: true });
  setNavState();

  // Reduced motion (or missing Lenis): no smooth scroll. Nav toggle still works.
  if (reduceMotion || typeof Lenis === 'undefined') {
    return;
  }

  // Smooth scroll.
  var lenis = new Lenis({
    duration: 1.1,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothWheel: true
  });

  // Drive Lenis from GSAP's ticker and keep ScrollTrigger in sync, if present.
  if (typeof gsap !== 'undefined') {
    if (gsap.registerPlugin && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
    }
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  } else {
    // No GSAP — run Lenis' own RAF loop.
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
})();
