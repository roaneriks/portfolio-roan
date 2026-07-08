/* =========================================================================
   MOTION
   - Nav morph: .is-scrolled toggled on scroll (all pages)
   - Homepage panel snap: pure GSAP, no Lenis.
       body.is-home gets overflow:hidden so native scroll is fully disabled.
       .snap-container slides via gsap.to({ y }) — one panel per gesture.
       Works on both wheel (mouse + trackpad) and touch swipe.
   - Lenis smooth scroll: all other pages only.
   ========================================================================= */
(function () {
  'use strict';

  var isHome = document.body.classList.contains('is-home') ||
               document.documentElement.classList.contains('is-home');

  // ---- Nav morph ----
  // On the homepage the container translates, not the window, so we listen
  // to a custom scroll position; on other pages window.scrollY is fine.
  var nav = document.querySelector('.nav');
  var SCROLL_THRESHOLD = 60;

  function setNavScrolled(y) {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', y > SCROLL_THRESHOLD);
  }

  if (!isHome) {
    window.addEventListener('scroll', function () {
      setNavScrolled(window.scrollY);
    }, { passive: true });
    setNavScrolled(window.scrollY);
  }

  // =========================================================================
  // HOMEPAGE — GSAP snap
  // =========================================================================
  if (isHome) {
    // Move is-home to body so CSS overflow:hidden applies.
    document.body.classList.add('is-home');

    var container   = document.querySelector('.snap-container');
    var panels      = Array.from(document.querySelectorAll('.snap-panel'));
    var total       = panels.length;
    var currentIdx  = 0;
    var isAnimating = false;

    // On the landing panel, peek 100px of the next section into view as a
    // scroll hint. Any other panel sits flush at its normal offset.
    var PEEK = 100;

    if (!container || !total) return;

    function yFor(idx) {
      return idx === 0 ? -PEEK : -(idx * window.innerHeight);
    }

    function goTo(idx) {
      idx = Math.max(0, Math.min(total - 1, idx));
      if (idx === currentIdx && isAnimating) return;
      currentIdx  = idx;
      isAnimating = true;

      // Nav state: treat the translated position as the scroll position.
      setNavScrolled(idx > 0 ? SCROLL_THRESHOLD + 1 : 0);

      gsap.to(container, {
        y: yFor(idx),
        duration: 1.2,
        ease: 'power3.inOut',
        onComplete: function () { isAnimating = false; }
      });
    }

    // Apply the initial peek offset without animating on page load.
    gsap.set(container, { y: yFor(currentIdx) });

    // ---- Wheel (mouse + trackpad) ----
    window.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (isAnimating) return;
      goTo(currentIdx + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });

    // ---- Touch swipe ----
    var touchStartY = 0;
    window.addEventListener('touchstart', function (e) {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', function (e) {
      if (isAnimating) return;
      var dy = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 30) return;   // ignore tiny taps
      goTo(currentIdx + (dy > 0 ? 1 : -1));
    }, { passive: true });

    // ---- Resize: recalculate y so panels stay aligned ----
    window.addEventListener('resize', function () {
      gsap.set(container, { y: yFor(currentIdx) });
    });

    return; // skip Lenis on homepage
  }

  // =========================================================================
  // ALL OTHER PAGES — Lenis smooth scroll
  // =========================================================================
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || typeof Lenis === 'undefined') return;

  var lenis = new Lenis({
    duration: 1.2,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothWheel: true
  });

  lenis.on('scroll', function (e) { setNavScrolled(e.scroll); });
  setNavScrolled(0);

  if (typeof gsap !== 'undefined') {
    if (gsap.registerPlugin && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
    }
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    (function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    })(performance.now());
  }

})();
