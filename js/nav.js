/* =========================================================================
   SHARED NAV — single source of truth.
   Injected into the <div id="site-nav"></div> placeholder on every page so
   the markup lives in exactly one file. Highlights the active link and wires
   up the mobile menu toggle (the toggle button is hidden on desktop via CSS).
   ========================================================================= */
(function () {
  'use strict';

  var links = [
    { label: 'Projects',   href: '/projects' },
    { label: 'Playground', href: '/playground' },
    { label: 'About me',   href: '/about' },
    { label: "Let's talk", href: '/contact' }
  ];

  // Normalise the current path: strip trailing ".html" and trailing slash so
  // "/about", "/about.html" and "/about/" all match the same nav item.
  var path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';

  var linksHTML = links.map(function (link) {
    var active = path === link.href || path.indexOf(link.href + '/') === 0;
    return '<a class="nav__link' + (active ? ' is-active' : '') + '" href="' +
      link.href + '"' + (active ? ' aria-current="page"' : '') + '>' +
      link.label + '</a>';
  }).join('');

  var navHTML =
    '<header class="nav" data-nav>' +
      '<nav class="nav__pill" aria-label="Primary">' +
        '<a class="nav__logo" href="/" aria-label="Roan Eriks — home">RE</a>' +
        '<button class="nav__toggle" type="button" aria-label="Toggle menu" ' +
          'aria-expanded="false" aria-controls="nav-links">' +
          '<span></span><span></span>' +
        '</button>' +
        '<div class="nav__links" id="nav-links">' + linksHTML + '</div>' +
      '</nav>' +
    '</header>';

  var mount = document.getElementById('site-nav');
  if (mount) {
    mount.outerHTML = navHTML;
  }

  // Mobile menu toggle.
  var toggle = document.querySelector('.nav__toggle');
  var menu = document.getElementById('nav-links');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close the menu after a link is tapped.
    menu.addEventListener('click', function (e) {
      if (e.target.classList.contains('nav__link')) {
        menu.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
