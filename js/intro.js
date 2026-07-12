/* =========================================================================
   INTRO — first-visit loading animation (homepage only).

   Phase 1 · loading  — the three-engine venn spins at the centre of a
                        full-screen overlay while a counter runs 000 → 100.
   Phase 2 · handoff  — the venn flies from the centre into its real spot
                        in the hero (measured live, so it lands pixel-exact),
                        the overlay fades, and nav + hero text stagger in.

   The inline <head> script on index.html adds .is-intro to <html> before
   first paint so the page never flashes. It is skipped on repeat visits
   this session (sessionStorage) and for prefers-reduced-motion.

   On small screens the hero venn is display:none, so instead of the
   handoff the loader venn converges into itself and fades out.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('is-intro')) return;  // repeat visit / reduced motion

  // GSAP comes from a CDN — if it failed to load, reveal the page and bail.
  if (typeof gsap === 'undefined') {
    root.classList.remove('is-intro');
    return;
  }

  window.__introRan = true;      // cancels the inline-script safety timeout
  window.__introPlaying = true;  // motion.js ignores wheel/touch while true
  try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}

  // ---- Build the overlay ------------------------------------------------
  // The loader venn reuses the real .engines-venn--hero geometry (same
  // classes, no labels) so the handoff lands seamlessly on the hero venn.
  document.body.insertAdjacentHTML('beforeend',
    '<div class="intro" aria-hidden="true">' +
      '<div class="intro__bg"></div>' +
      '<p class="intro__tag">Roan Eriks — Portfolio</p>' +
      '<p class="intro__counter">000</p>' +
      '<div class="engines-venn engines-venn--hero intro__venn">' +
        '<div class="intro__spin">' +
          '<div class="engine engine--bd"></div>' +
          '<div class="engine engine--id"></div>' +
          '<div class="engine engine--ai"></div>' +
        '</div>' +
        '<p class="engines-venn__core">RE</p>' +
      '</div>' +
    '</div>');

  var q = function (s) { return document.querySelector(s); };

  var intro   = q('.intro');
  var bg      = q('.intro__bg');
  var tag     = q('.intro__tag');
  var counter = q('.intro__counter');
  var venn    = q('.intro__venn');
  var spin    = q('.intro__spin');
  var circles = venn.querySelectorAll('.engine');
  var core    = venn.querySelector('.engines-venn__core');

  // ---- Page elements the timeline reveals at the end ---------------------
  var nav      = q('.nav');
  var heroVenn = q('.hero__venn');                                  // wrapper
  var vennEnd  = heroVenn && heroVenn.querySelector('.engines-venn'); // target box
  var labels   = heroVenn ?
    Array.prototype.slice.call(heroVenn.querySelectorAll('.engine__text')) : [];

  // Scroll cue is fade-only: its idle bounce is a CSS transform animation,
  // so a GSAP y tween on it would fight the keyframes.
  var cue    = q('.hero__scroll-cue');
  var reveal = [q('.hero__title'), q('.hero__catch')]
    .concat(Array.prototype.slice.call(document.querySelectorAll('.hero__contact li')))
    .filter(Boolean);

  // Hide everything with inline styles, then drop the blanket CSS guard
  // (autoAlpha reveals resolve to visibility:inherit, which would stay
  // stuck under an ancestor hidden by the .is-intro rule).
  if (nav) gsap.set(nav, { autoAlpha: 0, y: -14 });
  gsap.set(reveal, { autoAlpha: 0, y: 26 });
  if (cue) gsap.set(cue, { autoAlpha: 0 });
  if (heroVenn) gsap.set(heroVenn, { autoAlpha: 0 });
  if (labels.length) gsap.set(labels, { autoAlpha: 0, y: 10 });
  root.classList.remove('is-intro');

  // ---- Timeline -----------------------------------------------------------
  // The loader venn's start box (centred on screen) is pure CSS — nothing
  // is measured until the flight starts, so late layout (fonts, resizes,
  // a hidden tab during load) can't strand the intro.
  var T_HANDOFF = 1.6;                     // loading phase length
  var D_HANDOFF = 1.15;                    // flight duration
  var T_SWAP    = T_HANDOFF + D_HANDOFF;   // loader venn → real venn
  var T_TEXT    = T_SWAP - 0.45;           // page text starts just before

  var tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: function () {
      window.__introPlaying = false;
      intro.parentNode.removeChild(intro);
      // Hand the final say back to the stylesheet — end state is exactly
      // the page as designed, no inline leftovers.
      gsap.set([nav, heroVenn, cue].concat(reveal, labels).filter(Boolean),
        { clearProps: 'all' });
    }
  });

  // The spin — runs the whole intro, eases through two full turns and
  // lands upright exactly when the venn docks into the hero.
  tl.fromTo(spin, { rotation: 0 }, {
    rotation: 720,
    duration: T_SWAP,
    ease: 'power2.inOut',
    transformOrigin: '50% 56.24%'  // venn centroid — same point as the RE core
  }, 0);

  // Circles bloom in one after another while already turning.
  tl.fromTo(circles, { scale: 0.4, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, duration: 0.9, stagger: 0.14, ease: 'back.out(1.4)'
  }, 0.1);

  // RE core pops once the circles have met in the middle.
  tl.fromTo(core, { scale: 0.5, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.8)'
  }, 0.8);

  // Corner captions + counter.
  tl.fromTo([tag, counter], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.15);

  var cnt = { v: 0 };
  tl.to(cnt, {
    v: 100,
    duration: T_HANDOFF - 0.1,
    ease: 'power1.inOut',
    onUpdate: function () {
      counter.textContent = String(Math.round(cnt.v)).padStart(3, '0');
    }
  }, 0.1);

  tl.to([tag, counter], { autoAlpha: 0, duration: 0.35 }, T_HANDOFF);

  // Flight vs converge, decided and measured at go-time. Desktop: fly the
  // venn into its real spot in the hero. Small screens (hero venn is
  // display:none): converge into itself and fade — the text takes over.
  tl.add(function () {
    var r = vennEnd && vennEnd.getBoundingClientRect();

    if (r && r.width > 20) {
      // Freeze the CSS-centred box (left 50% + translate -50%) into explicit
      // px so left/top/width/height tween cleanly, then fly to the hero rect.
      var r0 = venn.getBoundingClientRect();
      gsap.set(venn, {
        left: r0.left, top: r0.top, width: r0.width, height: r0.height,
        xPercent: 0, yPercent: 0
      });
      gsap.to(venn, {
        left: r.left, top: r.top, width: r.width, height: r.height,
        duration: D_HANDOFF, ease: 'power3.inOut'
      });
    } else {
      gsap.to(venn, {
        scale: 0.55, autoAlpha: 0, duration: 0.8, ease: 'power3.in',
        transformOrigin: '50% 56.24%'
      });
    }
  }, T_HANDOFF);

  // Overlay dissolves mid-flight, revealing the page beneath.
  tl.to(bg, { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' }, T_HANDOFF + 0.3);
  tl.set(intro, { pointerEvents: 'none' }, T_HANDOFF + 0.3);

  // Touchdown: swap the loader venn for the real one (identical geometry,
  // so the cut is invisible), then the labels rise into the circles.
  // On small screens these are no-ops — the venn already faded out above.
  if (heroVenn) tl.set(heroVenn, { autoAlpha: 1 }, T_SWAP);
  tl.set(venn, { autoAlpha: 0 }, T_SWAP);
  if (labels.length) {
    tl.to(labels, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, T_SWAP + 0.05);
  }

  // Page content staggers in around the landing venn.
  if (nav) tl.to(nav, { autoAlpha: 1, y: 0, duration: 0.6 }, T_TEXT);
  tl.to(reveal, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.09 }, T_TEXT + 0.1);
  if (cue) tl.to(cue, { autoAlpha: 1, duration: 0.6 }, T_TEXT + 0.5);
})();
