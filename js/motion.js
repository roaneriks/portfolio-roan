/* =========================================================================
   MOTION
   - Lenis: smooth scroll (skipped if prefers-reduced-motion)
   - GSAP ScrollTrigger: kept in sync with Lenis
   - Nav morph: .is-scrolled toggled past a scroll threshold
   - Homepage panel snap: JS-driven via lenis.scrollTo() — CSS scroll-snap
     is intentionally removed because native snap and Lenis both try to own
     the final scroll position at the same time, causing the visible flash.
     Instead, a capture-phase wheel listener intercepts every wheel event:
     during a snap animation it calls e.preventDefault() so Lenis's own
     bubble-phase listener never sees the event (Lenis v1 checks
     event.defaultPrevented and skips the event if true). This means Lenis
     only scrolls via our lenis.scrollTo() calls — one panel per gesture,
     one easing curve, no competition.
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

  window.addEventListener('scroll', setNavState, { passive: true });
  setNavState();

  if (reduceMotion || typeof Lenis === 'undefined') {
    return;
  }

  var lenis = new Lenis({
    duration: 1.2,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothWheel: true
  });

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
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // ---- Homepage panel snap ----
  if (document.documentElement.classList.contains('is-home')) {
    var panels = Array.from(document.querySelectorAll('.hero, .panel'));
    if (panels.length) {
      var currentIdx = 0;
      var isSnapping = false;

      var snapFallback = null;

      function snapTo(idx) {
        idx = Math.max(0, Math.min(panels.length - 1, idx));
        isSnapping = true;
        currentIdx = idx;

        var target = panels[idx].offsetTop;

        clearTimeout(snapFallback);
        snapFallback = setTimeout(function () { isSnapping = false; }, 1700);

        lenis.scrollTo(target, {
          duration: 1.3,
          easing: function (t) { return 1 - Math.pow(1 - t, 4); },
          onComplete: function () {
            clearTimeout(snapFallback);
            isSnapping = false;
          }
        });
      }

      window.addEventListener('wheel', function (e) {
        e.preventDefault();
        if (isSnapping) return;

        var scrollY = window.scrollY;
        var direction = e.deltaY > 0 ? 1 : -1;

        var closest = 0;
        var closestDist = Infinity;
        panels.forEach(function (el, i) {
          var dist = Math.abs(el.offsetTop - scrollY);
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        });

        currentIdx = closest;
        snapTo(currentIdx + direction);
      }, { passive: false, capture: true });
    }
  }

})();
