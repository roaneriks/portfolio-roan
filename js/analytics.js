/* =========================================================================
   ANALYTICS — anonymous visitor tracking, loaded on every page.

   What it records (all anonymous — no names, no IPs, no cookies):
   - page_view      each page load, with referrer / UTM source
   - click          every click, with position (feeds the admin heatmap)
   - outbound_click clicks that leave the site (LinkedIn, mail, live demos)
   - page_leave     time the page was actually visible + deepest scroll

   Events are queued and flushed to /api/track with navigator.sendBeacon,
   which survives page navigation — nothing blocks or slows the page.
   The Supabase credentials live server-side; this file holds no secrets.

   Your own visits are excluded: opening /admin sets a localStorage flag
   that switches this script off in that browser.
   ========================================================================= */
(function () {
  'use strict';

  var ENDPOINT = '/api/track';
  var SESSION_MINUTES = 30; // gap that starts a new session

  /* ---------- Should we track at all? ---------- */

  // Skip your own visits (flag set by admin.html), automated browsers,
  // and local development (where /api/track doesn't exist anyway).
  var localhost = /^(localhost|127\.|192\.168\.)/.test(location.hostname);
  var isBot = navigator.webdriver ||
    /bot|crawl|spider|headless|lighthouse|prerender|preview/i.test(navigator.userAgent);
  var optedOut = false;
  try { optedOut = localStorage.getItem('pf_notrack') === '1'; } catch (e) { /* no-op */ }

  if (isBot || optedOut || (localhost && location.search.indexOf('track=1') === -1)) {
    return;
  }

  /* ---------- Anonymous identity ---------- */

  function uuid() {
    return (crypto.randomUUID) ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  }

  // visitor_id: one random id per browser, persists across visits, so the
  // dashboard can tell new visitors from returning ones. Nothing personal.
  var visitorId, isNewVisitor = false;
  try {
    visitorId = localStorage.getItem('pf_vid');
    if (!visitorId) {
      visitorId = uuid();
      isNewVisitor = true;
      localStorage.setItem('pf_vid', visitorId);
    }
  } catch (e) { visitorId = uuid(); }

  // session: groups page views within one browsing session. A session ends
  // after 30 minutes of inactivity (the standard analytics convention).
  // The traffic source is decided once, when the session starts, so an
  // internal click from /projects to /about doesn't overwrite "linkedin".
  function resolveSource() {
    var params = new URLSearchParams(location.search);
    if (params.get('utm_source')) return params.get('utm_source');
    if (params.get('src')) return params.get('src'); // short form for QR codes etc.
    if (document.referrer) {
      try {
        var host = new URL(document.referrer).hostname;
        if (host && host !== location.hostname) return host.replace(/^www\./, '');
      } catch (e) { /* malformed referrer */ }
    }
    return 'direct';
  }

  var session;
  try { session = JSON.parse(localStorage.getItem('pf_sess')); } catch (e) { /* no-op */ }
  var now = Date.now();
  if (!session || !session.id || now - session.t > SESSION_MINUTES * 60 * 1000) {
    session = { id: uuid(), src: resolveSource(), t: now };
  }
  session.t = now;
  try { localStorage.setItem('pf_sess', JSON.stringify(session)); } catch (e) { /* no-op */ }

  /* ---------- Page & device context (sent with every event) ---------- */

  // Normalise "/about.html" and "/about/" to "/about" so the dashboard
  // counts them as one page (matches Vercel's cleanUrls setting).
  var page = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  var viewId = uuid(); // ties this page view to its page_leave row

  function detectBrowser(ua) {
    if (/edg\//i.test(ua)) return 'Edge';
    if (/opr\//i.test(ua)) return 'Opera';
    if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
    if (/firefox/i.test(ua)) return 'Firefox';
    if (/chrome|crios/i.test(ua)) return 'Chrome';
    if (/safari/i.test(ua)) return 'Safari';
    return 'Other';
  }
  function detectOS(ua) {
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/android/i.test(ua)) return 'Android';
    if (/mac os/i.test(ua)) return 'macOS';
    if (/windows/i.test(ua)) return 'Windows';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Other';
  }

  var base = {
    visitor_id: visitorId,
    session_id: session.id,
    view_id: viewId,
    page: page,
    device: window.innerWidth < 768 ? 'mobile' : (window.innerWidth < 1024 ? 'tablet' : 'desktop'),
    browser: detectBrowser(navigator.userAgent),
    os: detectOS(navigator.userAgent),
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    language: (navigator.language || '').slice(0, 8)
  };

  /* ---------- Queue & flush ---------- */

  // Events are batched for ~1s so a burst of clicks becomes one request.
  // sendBeacon hands the payload to the browser, which delivers it even if
  // the user has already navigated away — ideal for analytics.
  var queue = [];
  var flushTimer = null;

  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (queue.length === 0) return;
    var payload = JSON.stringify(queue.splice(0, queue.length));
    var sent = false;
    if (navigator.sendBeacon) {
      sent = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
    }
    if (!sent) {
      fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true,
        headers: { 'Content-Type': 'application/json' } }).catch(function () { /* no-op */ });
    }
  }

  function track(event) {
    queue.push(Object.assign({}, base, event));
    if (!flushTimer) flushTimer = setTimeout(flush, 1000);
  }

  /* ---------- 1. Page view ---------- */

  var params = new URLSearchParams(location.search);
  track({
    event_type: 'page_view',
    page_title: document.title,
    referrer: document.referrer || null,
    source: session.src,
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    is_new_visitor: isNewVisitor
  });

  /* ---------- Scroll position helpers ---------- */

  // The homepage never scrolls natively: motion.js locks body scroll and
  // slides .snap-container with a GSAP transform instead. So "how far down
  // the page is the visitor" = window.scrollY on normal pages, but the
  // container's -translateY on the homepage. Read whichever applies.
  function getScrollOffset() {
    var y = window.scrollY || 0;
    var snap = document.querySelector('.snap-container');
    if (snap) {
      var tr = getComputedStyle(snap).transform;
      if (tr && tr !== 'none') {
        var nums = tr.match(/-?[\d.]+(?:e-?\d+)?/g);
        // matrix(a,b,c,d,tx,ty) → ty is nums[5]; matrix3d → nums[13]
        var ty = nums ? parseFloat(tr.indexOf('matrix3d') === 0 ? nums[13] : nums[5]) : 0;
        if (ty < 0) y += -ty;
      }
    }
    return y;
  }

  function getDocHeight() {
    var snap = document.querySelector('.snap-container');
    var h = document.documentElement.scrollHeight;
    return snap ? Math.max(snap.offsetHeight, h) : h;
  }

  /* ---------- 2. Clicks (position feeds the admin heatmap) ---------- */

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a, button, [role="button"]') : null;
    var href = el && el.href ? el.href : null;

    // Outbound = a link that leaves roaneriks.com (incl. mailto:/tel:).
    var outbound = false;
    if (href) {
      if (/^(mailto:|tel:)/.test(href)) outbound = true;
      else {
        try { outbound = new URL(href).hostname !== location.hostname; } catch (err) { /* no-op */ }
      }
    }

    var target = el || e.target;
    track({
      event_type: outbound ? 'outbound_click' : 'click',
      el_tag: target.tagName ? target.tagName.toLowerCase() : null,
      el_text: (target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) || null,
      el_href: href,
      x_pct: Math.round((e.clientX / window.innerWidth) * 1000) / 10,
      y_doc: Math.round(e.clientY + getScrollOffset()),
      doc_h: getDocHeight()
    });

    // A beacon survives navigation, so flush outbound clicks right away.
    if (outbound) flush();
  }, { capture: true, passive: true });

  /* ---------- 3. Engagement: visible time + deepest scroll ---------- */

  var maxScrollPct = 0;
  function updateScroll() {
    var docH = getDocHeight() - window.innerHeight;
    var pct = docH > 0 ? Math.round((getScrollOffset() / docH) * 100) : 100;
    if (pct > maxScrollPct) maxScrollPct = Math.min(pct, 100);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  // The homepage's GSAP slide fires no scroll events — sample it instead.
  if (document.querySelector('.snap-container')) {
    setInterval(updateScroll, 1500);
  }
  updateScroll();

  // Count time only while the tab is actually visible.
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  var visibleTotal = 0;

  var lastLeaveKey = null;
  function sendLeave() {
    if (visibleSince) { visibleTotal += Date.now() - visibleSince; visibleSince = null; }
    updateScroll();
    var duration = Math.round(visibleTotal / 100) / 10;
    // pagehide often fires right after visibilitychange→hidden; don't send
    // the same numbers twice.
    var key = duration + '|' + maxScrollPct;
    if (key === lastLeaveKey) return;
    lastLeaveKey = key;
    track({
      event_type: 'page_leave',
      scroll_pct: maxScrollPct,
      duration_s: duration
    });
    flush();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      // Tab hidden or page being left — report cumulative numbers now.
      // If the visitor comes back, an updated row is sent on the next hide;
      // the dashboard keeps the highest value per view_id.
      sendLeave();
    } else if (!visibleSince) {
      visibleSince = Date.now();
    }
  });
  window.addEventListener('pagehide', sendLeave);
})();
