/* =========================================================================
   PROJECTS INDEX — tag filter.
   Each card carries a normalised `data-tags` token list (e.g. "management
   product"). The display tags shown on the card can read differently (e.g.
   "Product Design") — the filter matches on the normalised tokens so the
   behaviour stays predictable.
   ========================================================================= */
(function () {
  'use strict';

  var buttons = Array.prototype.slice.call(document.querySelectorAll('.filter__btn'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var countEl = document.querySelector('[data-count]');

  function apply(filter) {
    var shown = 0;

    cards.forEach(function (card) {
      var tags = (card.dataset.tags || '').split(/\s+/);
      var match = filter === 'all' || tags.indexOf(filter) !== -1;
      card.hidden = !match;
      if (match) shown++;
    });

    // Reflect the active button state (visual + a11y).
    buttons.forEach(function (btn) {
      var active = btn.dataset.filter === filter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    // Keep the visible count in sync with the active filter.
    if (countEl) {
      countEl.textContent = String(shown).padStart(2, '0') +
        (shown === 1 ? ' Project' : ' Projects');
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      apply(btn.dataset.filter);
    });
  });
})();
