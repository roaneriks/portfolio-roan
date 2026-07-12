/* =========================================================================
   ADMIN DASHBOARD — fetches events from /api/stats, aggregates them in the
   browser, and renders every panel. No chart library: the charts are plain
   SVG built by hand, which keeps the page dependency-free like the rest of
   the site.

   Chart series colors are NOT the brand navy (#1E3A5F is too dark/muted to
   read as a data mark). They are a colorblind-validated pair:
     #2F6CB3 (views)  ·  #B4552D (visitors)   — ΔE 76 apart under protanopia.

   Add ?demo=1 to the URL to explore the dashboard with generated sample
   data before any real traffic exists.
   ========================================================================= */
(function () {
  'use strict';

  // Opening this page marks the browser as "owner" — analytics.js sees the
  // flag and stops recording, so your own visits never pollute the stats.
  try { localStorage.setItem('pf_notrack', '1'); } catch (e) { /* no-op */ }

  var DEMO = new URLSearchParams(location.search).get('demo') === '1';
  var C1 = '#2F6CB3'; // views
  var C2 = '#B4552D'; // visitors

  /* ================= Element lookups ================= */

  var $ = function (id) { return document.getElementById(id); };
  var gate = $('gate'), gateForm = $('gate-form'), gatePass = $('gate-pass'),
      gateError = $('gate-error'), dash = $('dash'), loading = $('loading'),
      empty = $('empty'), content = $('content'), tooltip = $('tooltip');

  // Tiny DOM helper — build elements instead of string HTML so visitor-
  // supplied text (link labels, referrers) can never inject markup.
  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /* ================= State ================= */

  var state = {
    days: 30,
    key: sessionStorage.getItem('pf_admin_key') || '',
    events: [],
    daily: null // cached series for resize re-render
  };

  /* ================= Formatting helpers ================= */

  function fmtNum(n) { return (n || 0).toLocaleString('en'); }

  function fmtDur(s) {
    if (!s || s <= 0) return '0s';
    if (s < 60) return Math.round(s) + 's';
    return Math.floor(s / 60) + 'm ' + Math.round(s % 60) + 's';
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function fmtAgo(ts) {
    var d = Date.now() - ts;
    if (d < 60e3) return 'just now';
    if (d < 3600e3) return Math.floor(d / 60e3) + 'm ago';
    if (d < 86400e3) return Math.floor(d / 3600e3) + 'h ago';
    if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + 'd ago';
    return fmtDate(ts);
  }

  var regionNames, langNames;
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    langNames = new Intl.DisplayNames(['en'], { type: 'language' });
  } catch (e) { /* older browser — fall back to raw codes */ }

  function countryName(code) {
    if (!code) return 'Unknown';
    try { return regionNames ? regionNames.of(code) : code; } catch (e) { return code; }
  }
  function languageName(tag) {
    if (!tag) return 'Unknown';
    try { return langNames ? langNames.of(tag) : tag; } catch (e) { return tag; }
  }

  function pageName(p) { return p === '/' ? 'Home' : p; }

  /* ================= Tooltip ================= */

  function showTip(lines, x, y) {
    tooltip.textContent = '';
    lines.forEach(function (line, i) {
      var row = h('div');
      if (i === 0) { row.appendChild(h('strong', null, line)); }
      else row.textContent = line;
      tooltip.appendChild(row);
    });
    tooltip.hidden = false;
    var w = tooltip.offsetWidth, vw = window.innerWidth;
    tooltip.style.left = Math.min(x + 14, vw - w - 8) + 'px';
    tooltip.style.top = (y + 14) + 'px';
  }
  function hideTip() { tooltip.hidden = true; }

  function attachTip(node, linesFn) {
    node.addEventListener('mousemove', function (e) { showTip(linesFn(), e.clientX, e.clientY); });
    node.addEventListener('mouseleave', hideTip);
  }

  /* ================= Auth & loading ================= */

  function showGate(withError) {
    gate.hidden = false;
    dash.hidden = true;
    gateError.hidden = !withError;
    gatePass.focus();
  }

  function showDash() {
    gate.hidden = true;
    dash.hidden = false;
    $('demo-note').hidden = !DEMO;
  }

  function load() {
    showDash();
    loading.hidden = false;
    empty.hidden = true;
    content.hidden = true;
    loading.textContent = 'Loading events…';

    var ready;
    if (DEMO) {
      ready = Promise.resolve(genDemo(state.days === 'all' ? 90 : state.days));
    } else {
      ready = fetch('/api/stats?days=' + state.days, {
        headers: { 'x-admin-key': state.key }
      }).then(function (res) {
        if (res.status === 401) { showGate(true); throw { silent: true }; }
        if (!res.ok) throw new Error('server said ' + res.status);
        return res.json();
      }).then(function (body) {
        try { sessionStorage.setItem('pf_admin_key', state.key); } catch (e) { /* no-op */ }
        return body.events;
      });
    }

    ready.then(function (events) {
      state.events = events.map(function (e) {
        e.ts = new Date(e.created_at).getTime();
        return e;
      }).sort(function (a, b) { return a.ts - b.ts; });
      loading.hidden = true;
      if (state.events.length === 0) { empty.hidden = false; return; }
      content.hidden = false;
      renderAll();
    }).catch(function (err) {
      if (err && err.silent) return;
      loading.textContent = 'Could not load data — ' + (err.message || err) +
        '. Is the site deployed with SUPABASE_URL / SUPABASE_SECRET_KEY / ADMIN_PASSWORD set?';
    });
  }

  gateForm.addEventListener('submit', function (e) {
    e.preventDefault();
    state.key = gatePass.value;
    load();
  });

  $('logout-btn').addEventListener('click', function () {
    try { sessionStorage.removeItem('pf_admin_key'); } catch (e) { /* no-op */ }
    state.key = '';
    gatePass.value = '';
    showGate(false);
  });

  $('refresh-btn').addEventListener('click', load);

  $('range').addEventListener('click', function (e) {
    var btn = e.target.closest('.range__btn');
    if (!btn) return;
    this.querySelectorAll('.range__btn').forEach(function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
    state.days = btn.dataset.days === 'all' ? 'all' : parseInt(btn.dataset.days, 10);
    load();
  });

  /* ================= Aggregation ================= */

  function groupCount(rows, keyFn) {
    var map = new Map();
    rows.forEach(function (r) {
      var k = keyFn(r);
      if (k === null || k === undefined || k === '') return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).sort(function (a, b) { return b[1] - a[1]; });
  }

  function distinct(rows, keyFn) {
    var s = new Set();
    rows.forEach(function (r) { var k = keyFn(r); if (k) s.add(k); });
    return s.size;
  }

  function aggregate(events) {
    var pv = events.filter(function (e) { return e.event_type === 'page_view'; });
    var clicks = events.filter(function (e) { return e.event_type === 'click' || e.event_type === 'outbound_click'; });
    var outbound = events.filter(function (e) { return e.event_type === 'outbound_click'; });

    // page_leave rows can repeat per view (tab hidden → shown → hidden);
    // keep the highest duration/scroll per view_id, capped at 30 minutes so
    // one forgotten tab can't wreck the averages.
    var leaves = new Map();
    events.forEach(function (e) {
      if (e.event_type !== 'page_leave' || !e.view_id) return;
      var cur = leaves.get(e.view_id) || { duration: 0, scroll: 0, page: e.page };
      cur.duration = Math.min(Math.max(cur.duration, e.duration_s || 0), 1800);
      cur.scroll = Math.max(cur.scroll, e.scroll_pct || 0);
      leaves.set(e.view_id, cur);
    });

    return { pv: pv, clicks: clicks, outbound: outbound, leaves: leaves };
  }

  function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  /* ================= Render: everything ================= */

  var agg;

  function renderAll() {
    agg = aggregate(state.events);
    renderTiles();
    computeDaily();
    renderTimeChart();
    renderPages();
    renderSources();
    renderAudience();
    renderClicks();
    renderOutbound();
    initHeatmap();
    renderActivity();
  }

  /* ---------- Stat tiles ---------- */

  function tile(label, value, sub) {
    var t = h('div', 'tile');
    t.appendChild(h('p', 'tile__label', label));
    t.appendChild(h('p', 'tile__value', value));
    if (sub) t.appendChild(h('p', 'tile__sub', sub));
    return t;
  }

  function renderTiles() {
    var pv = agg.pv;
    var visitors = distinct(pv, function (e) { return e.visitor_id; });
    var sessions = distinct(pv, function (e) { return e.session_id; });
    var newVisitors = new Set();
    pv.forEach(function (e) { if (e.is_new_visitor) newVisitors.add(e.visitor_id); });
    var durations = [], scrolls = [];
    agg.leaves.forEach(function (l) {
      if (l.duration > 0) durations.push(l.duration);
      scrolls.push(l.scroll);
    });

    var box = $('tiles');
    box.textContent = '';
    box.appendChild(tile('Page views', fmtNum(pv.length)));
    box.appendChild(tile('Visitors', fmtNum(visitors),
      visitors ? Math.round((newVisitors.size / visitors) * 100) + '% new' : ''));
    box.appendChild(tile('Sessions', fmtNum(sessions),
      sessions ? (pv.length / sessions).toFixed(1) + ' pages / session' : ''));
    box.appendChild(tile('Avg time on page', fmtDur(mean(durations))));
    box.appendChild(tile('Avg scroll depth', Math.round(mean(scrolls)) + '%'));
    box.appendChild(tile('Outbound clicks', fmtNum(agg.outbound.length)));
  }

  /* ---------- Traffic over time (SVG line chart) ---------- */

  function computeDaily() {
    var pv = agg.pv;
    if (pv.length === 0) { state.daily = []; return; }
    var start;
    if (state.days === 'all') start = pv[0].ts;
    else start = Date.now() - state.days * 86400e3;

    var byDay = new Map();
    var d = new Date(start); d.setHours(0, 0, 0, 0);
    for (var t = d.getTime(); t <= Date.now(); t += 86400e3) {
      byDay.set(new Date(t).toDateString(), { ts: t, views: 0, visitors: new Set() });
    }
    pv.forEach(function (e) {
      var k = new Date(e.ts).toDateString();
      var day = byDay.get(k);
      if (!day) return;
      day.views++;
      if (e.visitor_id) day.visitors.add(e.visitor_id);
    });
    state.daily = Array.from(byDay.values()).map(function (day) {
      return { ts: day.ts, views: day.views, visitors: day.visitors.size };
    });
  }

  function niceMax(v) {
    if (v <= 5) return 5;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var norm = v / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function renderTimeChart() {
    var box = $('time-chart');
    box.textContent = '';
    var daily = state.daily;
    if (!daily || daily.length === 0) return;

    var W = Math.max(box.clientWidth || 640, 320), H = 260;
    var m = { top: 14, right: 92, bottom: 28, left: 42 };
    var iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    var yMax = niceMax(Math.max.apply(null, daily.map(function (d) { return d.views; }).concat([1])));

    var x = function (i) { return m.left + (daily.length === 1 ? iw / 2 : (i / (daily.length - 1)) * iw); };
    var y = function (v) { return m.top + ih - (v / yMax) * ih; };

    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Daily page views and unique visitors' });

    // Recessive horizontal gridlines + y labels (division count chosen so
    // every label is a whole number — 50 splits into 5×10, not 4×12.5).
    var divs = yMax % 4 === 0 ? 4 : 5;
    for (var g = 0; g <= divs; g++) {
      var gv = (yMax / divs) * g;
      svg.appendChild(svgEl('line', { x1: m.left, x2: W - m.right, y1: y(gv), y2: y(gv),
        stroke: '#E9E9E6', 'stroke-width': 1 }));
      var lbl = svgEl('text', { x: m.left - 8, y: y(gv) + 3.5, 'text-anchor': 'end',
        'font-family': 'Space Mono, monospace', 'font-size': 10, fill: '#5A5A57' });
      lbl.textContent = gv >= 1000 ? (gv / 1000) + 'k' : gv;
      svg.appendChild(lbl);
    }

    // x tick labels (~6, always first and last).
    var stepX = Math.max(1, Math.ceil(daily.length / 6));
    daily.forEach(function (day, i) {
      if (i % stepX !== 0 && i !== daily.length - 1) return;
      var t = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle',
        'font-family': 'Space Mono, monospace', 'font-size': 10, fill: '#5A5A57' });
      t.textContent = fmtDate(day.ts);
      svg.appendChild(t);
    });

    // The two series: thin 2px lines, no dot per point (markers on hover).
    var series = [
      { name: 'Views', color: C1, get: function (day) { return day.views; } },
      { name: 'Visitors', color: C2, get: function (day) { return day.visitors; } }
    ];
    series.forEach(function (s) {
      var dAttr = daily.map(function (day, i) {
        return (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(s.get(day)).toFixed(1);
      }).join(' ');
      svg.appendChild(svgEl('path', { d: dAttr, fill: 'none', stroke: s.color,
        'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    });

    // Direct labels at the line ends: colored dot + name in ink (text never
    // wears the series color). Nudge apart if the two ends collide.
    var last = daily[daily.length - 1];
    var ends = series.map(function (s) { return { s: s, yy: y(s.get(last)) }; });
    if (Math.abs(ends[0].yy - ends[1].yy) < 14) {
      var mid = (ends[0].yy + ends[1].yy) / 2;
      ends[0].yy = mid + (ends[0].yy <= ends[1].yy ? -7 : 7);
      ends[1].yy = mid + (ends[0].yy <= ends[1].yy ? 7 : -7);
    }
    ends.forEach(function (endp) {
      svg.appendChild(svgEl('circle', { cx: x(daily.length - 1), cy: y(endp.s.get(last)),
        r: 3.5, fill: endp.s.color, stroke: '#FAFAF8', 'stroke-width': 2 }));
      var t = svgEl('text', { x: x(daily.length - 1) + 10, y: endp.yy + 3.5,
        'font-family': 'General Sans, sans-serif', 'font-size': 12, fill: '#0B0B0B' });
      t.textContent = endp.s.name;
      svg.appendChild(t);
    });

    // Hover layer: crosshair + markers + tooltip on the nearest day.
    var hoverLine = svgEl('line', { y1: m.top, y2: m.top + ih, stroke: '#5A5A57',
      'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' });
    svg.appendChild(hoverLine);
    var markers = series.map(function (s) {
      var c = svgEl('circle', { r: 4, fill: s.color, stroke: '#FAFAF8',
        'stroke-width': 2, visibility: 'hidden' });
      svg.appendChild(c);
      return c;
    });

    var capture = svgEl('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' });
    capture.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var px = e.clientX - rect.left;
      var i = Math.round(((px - m.left) / iw) * (daily.length - 1));
      i = Math.max(0, Math.min(daily.length - 1, i));
      var day = daily[i];
      hoverLine.setAttribute('x1', x(i)); hoverLine.setAttribute('x2', x(i));
      hoverLine.setAttribute('visibility', 'visible');
      markers[0].setAttribute('cx', x(i)); markers[0].setAttribute('cy', y(day.views));
      markers[1].setAttribute('cx', x(i)); markers[1].setAttribute('cy', y(day.visitors));
      markers.forEach(function (mk) { mk.setAttribute('visibility', 'visible'); });
      showTip([new Date(day.ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        day.views + ' views', day.visitors + ' visitors'], e.clientX, e.clientY);
    });
    capture.addEventListener('mouseleave', function () {
      hoverLine.setAttribute('visibility', 'hidden');
      markers.forEach(function (mk) { mk.setAttribute('visibility', 'hidden'); });
      hideTip();
    });
    svg.appendChild(capture);
    box.appendChild(svg);

    // Legend (identity is never color-alone: swatch + name in ink).
    var legend = $('chart-legend');
    legend.textContent = '';
    series.forEach(function (s) {
      var item = h('span', 'legend__item');
      var sw = h('span', 'legend__swatch');
      sw.style.background = s.color;
      item.appendChild(sw);
      item.appendChild(document.createTextNode(s.name));
      legend.appendChild(item);
    });

    // Accessible fallback: the same numbers as a plain table.
    var tbl = h('table');
    var thead = h('thead'), hr = h('tr');
    ['Date', 'Views', 'Visitors'].forEach(function (c) { hr.appendChild(h('th', null, c)); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tbody = h('tbody');
    daily.forEach(function (day) {
      if (day.views === 0 && day.visitors === 0) return;
      var tr = h('tr');
      tr.appendChild(h('td', null, fmtDate(day.ts)));
      tr.appendChild(h('td', 'num', day.views));
      tr.appendChild(h('td', 'num', day.visitors));
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    var wrap = $('time-table');
    wrap.textContent = '';
    wrap.appendChild(tbl);
  }

  // Re-render the chart at the new width when the window resizes.
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.daily) renderTimeChart(); }, 150);
  });

  /* ---------- Bar-row lists ---------- */

  // rows: [{ label, sub, value, valueText, tip: [lines] }]
  function renderBars(el, rows, minorList) {
    el.textContent = '';
    if (rows.length === 0) { el.appendChild(h('p', 'list-empty', 'Nothing here yet.')); return; }
    var max = rows[0].value;
    rows.forEach(function (r) {
      var row = h('div', 'bar-row');
      var label = h('span', 'bar-row__label', r.label);
      label.title = r.label;
      if (r.sub) label.appendChild(h('small', null, r.sub));
      row.appendChild(label);
      if (!minorList) {
        var track = h('div', 'bar-row__track');
        var fill = h('div', 'bar-row__fill');
        fill.style.width = Math.max((r.value / max) * 100, 1) + '%';
        track.appendChild(fill);
        row.appendChild(track);
      }
      row.appendChild(h('span', 'bar-row__value', r.valueText || fmtNum(r.value)));
      if (r.tip) attachTip(row, function () { return r.tip; });
      el.appendChild(row);
    });
  }

  function renderPages() {
    var perPage = new Map();
    agg.pv.forEach(function (e) {
      var p = perPage.get(e.page) || { views: 0, visitors: new Set(), durations: [], scrolls: [] };
      p.views++;
      if (e.visitor_id) p.visitors.add(e.visitor_id);
      perPage.set(e.page, p);
    });
    agg.leaves.forEach(function (l) {
      var p = perPage.get(l.page);
      if (!p) return;
      if (l.duration > 0) p.durations.push(l.duration);
      p.scrolls.push(l.scroll);
    });
    var rows = Array.from(perPage.entries())
      .sort(function (a, b) { return b[1].views - a[1].views; })
      .slice(0, 12)
      .map(function (entry) {
        var page = entry[0], p = entry[1];
        return {
          label: pageName(page),
          sub: fmtDur(mean(p.durations)) + ' avg · ' + Math.round(mean(p.scrolls)) + '% scroll',
          value: p.views,
          tip: [pageName(page), p.views + ' views · ' + p.visitors.size + ' visitors',
            'avg time ' + fmtDur(mean(p.durations)) + ' · avg scroll ' + Math.round(mean(p.scrolls)) + '%']
        };
      });
    renderBars($('pages-list'), rows);
  }

  function renderSources() {
    // One source per session (decided at session start by analytics.js).
    var sessionSource = new Map();
    agg.pv.forEach(function (e) {
      if (e.session_id && !sessionSource.has(e.session_id)) {
        sessionSource.set(e.session_id, e.source || 'direct');
      }
    });
    var rows = groupCount(Array.from(sessionSource.values()), function (s) { return s; })
      .slice(0, 10)
      .map(function (entry) {
        return {
          label: entry[0] === 'direct' ? 'Direct / typed in' : entry[0],
          value: entry[1],
          valueText: fmtNum(entry[1]),
          tip: [entry[0], entry[1] + ' sessions']
        };
      });
    renderBars($('sources-list'), rows);

    // Full referrer URLs — external only, trimmed for display.
    var refs = groupCount(agg.pv, function (e) {
      if (!e.referrer) return null;
      var r = e.referrer.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (r.indexOf(location.hostname) === 0) return null;
      return r.slice(0, 60);
    }).slice(0, 8).map(function (entry) {
      return { label: entry[0], value: entry[1] };
    });
    renderBars($('referrers-list'), refs, true);
  }

  function renderAudience() {
    function visitorsBy(keyFn, labelFn) {
      var map = new Map();
      agg.pv.forEach(function (e) {
        var k = keyFn(e);
        if (!k) return;
        if (!map.has(k)) map.set(k, new Set());
        if (e.visitor_id) map.get(k).add(e.visitor_id);
      });
      return Array.from(map.entries())
        .map(function (entry) { return { key: entry[0], n: entry[1].size }; })
        .sort(function (a, b) { return b.n - a.n; })
        .slice(0, 8)
        .map(function (r) { return { label: labelFn(r.key), value: r.n }; });
    }
    renderBars($('countries-list'), visitorsBy(function (e) { return e.country; }, countryName));
    renderBars($('devices-list'), visitorsBy(function (e) { return e.device; },
      function (k) { return k.charAt(0).toUpperCase() + k.slice(1); }));
    renderBars($('browsers-list'), visitorsBy(function (e) { return e.browser; }, String));
    renderBars($('languages-list'), visitorsBy(function (e) {
      return (e.language || '').toLowerCase() || null;
    }, languageName));
  }

  /* ---------- Clicks ---------- */

  function renderClicks() {
    var byEl = new Map();
    agg.clicks.forEach(function (e) {
      if (!e.el_text && !e.el_tag) return;
      var k = (e.el_text || '(' + e.el_tag + ')');
      var c = byEl.get(k) || { n: 0, tag: e.el_tag, pages: new Map() };
      c.n++;
      c.pages.set(e.page, (c.pages.get(e.page) || 0) + 1);
      byEl.set(k, c);
    });
    var rows = Array.from(byEl.entries())
      .sort(function (a, b) { return b[1].n - a[1].n; })
      .slice(0, 12)
      .map(function (entry) {
        var label = entry[0], c = entry[1];
        var topPage = Array.from(c.pages.entries()).sort(function (a, b) { return b[1] - a[1]; })[0];
        return {
          label: label,
          sub: (c.tag ? '<' + c.tag + '> · ' : '') + 'mostly on ' + pageName(topPage[0]),
          value: c.n,
          tip: [label, c.n + ' clicks across ' + c.pages.size + ' page(s)']
        };
      });
    renderBars($('clicks-list'), rows);
  }

  function renderOutbound() {
    var byHref = new Map();
    agg.outbound.forEach(function (e) {
      if (!e.el_href) return;
      var c = byHref.get(e.el_href) || { n: 0, text: e.el_text };
      c.n++;
      byHref.set(e.el_href, c);
    });
    var rows = Array.from(byHref.entries())
      .sort(function (a, b) { return b[1].n - a[1].n; })
      .slice(0, 10)
      .map(function (entry) {
        var href = entry[0], c = entry[1];
        var label = href.replace(/^mailto:/, '✉ ').replace(/^tel:/, '☎ ')
          .replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        return {
          label: label.slice(0, 60),
          sub: c.text ? 'via “' + c.text + '”' : '',
          value: c.n,
          tip: [href, c.n + ' clicks']
        };
      });
    renderBars($('outbound-list'), rows);
  }

  /* ---------- Click map (dots over the live page in an iframe) ---------- */

  var hm = { device: 'desktop', page: null };

  function initHeatmap() {
    var byPage = groupCount(agg.clicks, function (e) { return e.page; });
    var select = $('hm-page');
    select.textContent = '';
    if (byPage.length === 0) {
      $('hm-viewport').hidden = true;
      select.hidden = true;
      return;
    }
    $('hm-viewport').hidden = false;
    select.hidden = false;
    byPage.forEach(function (entry) {
      var opt = h('option', null, pageName(entry[0]) + ' · ' + entry[1] + ' clicks');
      opt.value = entry[0];
      select.appendChild(opt);
    });
    if (!hm.page || !byPage.some(function (p) { return p[0] === hm.page; })) {
      hm.page = byPage[0][0];
    }
    select.value = hm.page;
    renderHeatmap();
  }

  $('hm-page').addEventListener('change', function () { hm.page = this.value; renderHeatmap(); });
  $('hm-desktop').addEventListener('click', function () { setHmDevice('desktop', this); });
  $('hm-mobile').addEventListener('click', function () { setHmDevice('mobile', this); });
  function setHmDevice(device, btn) {
    hm.device = device;
    $('hm-desktop').classList.toggle('is-active', device === 'desktop');
    $('hm-mobile').classList.toggle('is-active', device === 'mobile');
    void btn; // active state handled above
    renderHeatmap();
  }

  var HM_VH = { desktop: 750, mobile: 812 };  // preview viewport heights

  function renderHeatmap() {
    var frame = $('hm-frame'), stage = $('hm-stage'), sizer = $('hm-sizer'),
        dots = $('hm-dots'), viewport = $('hm-viewport');
    var W = hm.device === 'desktop' ? 1200 : 375;
    var VH = HM_VH[hm.device];
    dots.textContent = '';
    frame.style.width = W + 'px';
    frame.style.height = VH + 'px';
    stage.style.width = W + 'px';

    // The homepage plays a full-screen intro animation on first visit per
    // tab. The iframe shares this tab's sessionStorage, so marking the
    // intro as seen up-front keeps it out of the preview.
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) { /* no-op */ }

    frame.onload = function () {
      var doc = frame.contentDocument;
      if (!doc || !doc.head) return;

      // The homepage's snap panels are 100vh tall — inside an iframe that
      // grows to fit its content, that's a feedback loop (taller iframe →
      // taller panels → taller iframe…). Freeze viewport-height sections at
      // the preview's viewport size and undo the GSAP slide so the page can
      // be unrolled to its full height once.
      var style = doc.createElement('style');
      style.textContent =
        'html, body { overflow: visible !important; height: auto !important; }' +
        '.snap-panel, .hero { height: ' + VH + 'px !important; min-height: ' + VH + 'px !important; }' +
        '.snap-container { transform: none !important; visibility: visible !important; }' +
        '.intro { display: none !important; }';
      doc.head.appendChild(style);

      var fit = function () {
        var vw = viewport.clientWidth - 2;
        if (vw < 60) { setTimeout(fit, 300); return; }  // panel hidden mid-layout — retry
        // Always measure at viewport height so any remaining vh-sized
        // element can't compound between measurements.
        frame.style.height = VH + 'px';
        void frame.offsetHeight;  // force reflow before reading scrollHeight
        var docH = Math.max(doc.documentElement.scrollHeight, VH);
        frame.style.height = docH + 'px';
        var scale = Math.min(vw / W, 1);
        stage.style.transform = 'scale(' + scale + ')';
        sizer.style.width = Math.round(W * scale) + 'px';
        sizer.style.height = Math.round(docH * scale) + 'px';
        drawDots(docH);
      };
      fit();
      setTimeout(fit, 500);  // re-fit after fonts/images settle
    };
    frame.src = hm.page;
  }

  function drawDots(frameDocH) {
    var dots = $('hm-dots');
    dots.textContent = '';
    var wanted = hm.device === 'desktop' ? { desktop: 1, tablet: 1 } : { mobile: 1 };
    var pts = agg.clicks.filter(function (e) {
      return e.page === hm.page && wanted[e.device] &&
        e.x_pct !== null && e.x_pct !== undefined && e.y_doc && e.doc_h;
    }).slice(-600); // cap for DOM sanity
    var W = hm.device === 'desktop' ? 1200 : 375;
    pts.forEach(function (e) {
      var dot = h('div', 'hm__dot');
      dot.style.left = ((e.x_pct / 100) * W).toFixed(1) + 'px';
      // y is stored with the document height it was measured against, so it
      // survives the page being longer/shorter in this preview.
      dot.style.top = ((e.y_doc / e.doc_h) * frameDocH).toFixed(1) + 'px';
      dots.appendChild(dot);
    });
  }

  /* ---------- Recent activity ---------- */

  function renderActivity() {
    var rows = state.events.slice(-30).reverse();
    var tbl = h('table');
    var thead = h('thead'), hr = h('tr');
    ['When', 'What', 'Page', 'Detail', 'Where', 'Device'].forEach(function (c) {
      hr.appendChild(h('th', null, c));
    });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tbody = h('tbody');
    rows.forEach(function (e) {
      var detail = '';
      if (e.event_type === 'page_view') detail = e.source && e.source !== 'direct' ? 'from ' + e.source : 'direct';
      else if (e.event_type === 'page_leave') detail = fmtDur(e.duration_s) + ' · ' + (e.scroll_pct || 0) + '% scroll';
      else detail = e.el_text || e.el_href || '';
      var tr = h('tr');
      tr.appendChild(h('td', null, fmtAgo(e.ts)));
      tr.appendChild(h('td', 'num', e.event_type.replace('_', ' ')));
      tr.appendChild(h('td', null, pageName(e.page || '')));
      tr.appendChild(h('td', null, detail));
      tr.appendChild(h('td', null, [countryName(e.country), e.city].filter(Boolean).join(', ')));
      tr.appendChild(h('td', null, (e.device || '') + (e.browser ? ' · ' + e.browser : '')));
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    var wrap = $('activity-table');
    wrap.textContent = '';
    wrap.appendChild(tbl);
  }

  /* ================= Demo data (?demo=1) ================= */

  function genDemo(days) {
    var pages = [
      { p: '/', w: 30, h: 4200 }, { p: '/projects', w: 16, h: 2600 },
      { p: '/projects/ikea-hej', w: 10, h: 5200 }, { p: '/projects/trends-report', w: 7, h: 4800 },
      { p: '/projects/dutch-climate', w: 6, h: 4600 }, { p: '/projects/japandi-table', w: 6, h: 4400 },
      { p: '/playground', w: 8, h: 3000 }, { p: '/about', w: 9, h: 2400 },
      { p: '/contact', w: 8, h: 1200 }
    ];
    var sources = [['direct', 34], ['linkedin.com', 26], ['google.com', 18], ['instagram.com', 8], ['t.co', 5], ['qr', 9]];
    var countries = [['ES', 30], ['NL', 24], ['DE', 10], ['US', 10], ['GB', 8], ['FR', 7], ['IT', 5], ['BE', 6]];
    var cities = { ES: 'Barcelona', NL: 'Amsterdam', DE: 'Berlin', US: 'New York', GB: 'London', FR: 'Paris', IT: 'Milan', BE: 'Antwerp' };
    var browsers = [['Chrome', 48], ['Safari', 30], ['Firefox', 12], ['Edge', 10]];
    var langs = [['en-us', 40], ['nl-nl', 25], ['es-es', 20], ['de-de', 8], ['fr-fr', 7]];

    function pick(weighted) {
      var total = weighted.reduce(function (a, b) { return a + b[1]; }, 0);
      var r = Math.random() * total;
      for (var i = 0; i < weighted.length; i++) {
        r -= weighted[i][1];
        if (r <= 0) return weighted[i][0];
      }
      return weighted[0][0];
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    var events = [];
    var now = Date.now();
    for (var d = days - 1; d >= 0; d--) {
      var dayStart = now - d * 86400e3;
      var weekend = [0, 6].indexOf(new Date(dayStart).getDay()) !== -1;
      var nSessions = Math.round(rnd(6, 16) * (weekend ? 0.6 : 1) * (1 + (days - d) / days * 0.5));
      for (var s = 0; s < nSessions; s++) {
        var vid = 'demo-v' + Math.floor(Math.random() * 1400);
        var sid = 'demo-s' + d + '-' + s;
        var isNew = Math.random() < 0.62;
        var device = pick([['desktop', 52], ['mobile', 42], ['tablet', 6]]);
        var country = pick(countries);
        var base = {
          visitor_id: vid, session_id: sid, device: device,
          browser: pick(browsers), os: device === 'mobile' ? pick([['iOS', 60], ['Android', 40]]) : pick([['macOS', 55], ['Windows', 40], ['Linux', 5]]),
          country: country, city: cities[country], language: pick(langs),
          viewport_w: device === 'mobile' ? 390 : 1440, viewport_h: device === 'mobile' ? 844 : 900
        };
        var src = pick(sources);
        var ts = dayStart + rnd(8, 23) * 3600e3;
        var nPages = 1 + Math.floor(Math.random() * 3.4);
        var cur = Math.random() < 0.75 ? pages[0] : pages[Math.floor(Math.random() * pages.length)];
        for (var pi = 0; pi < nPages; pi++) {
          var viewId = sid + '-view' + pi;
          events.push(Object.assign({}, base, {
            event_type: 'page_view', page: cur.p, view_id: viewId,
            created_at: new Date(ts).toISOString(),
            source: src, referrer: src === 'direct' || src === 'qr' ? null : 'https://' + src + '/',
            is_new_visitor: isNew && pi === 0
          }));
          // Clicks: clustered around nav (top), project links (middle),
          // and the odd stray click.
          var nClicks = Math.floor(rnd(0, 3.4));
          for (var c = 0; c < nClicks; c++) {
            var zone = Math.random();
            var yRel = zone < 0.3 ? rnd(0.01, 0.05) : zone < 0.8 ? rnd(0.2, 0.7) : rnd(0.7, 0.98);
            var isOut = cur.p === '/contact' && Math.random() < 0.5;
            events.push(Object.assign({}, base, {
              event_type: isOut ? 'outbound_click' : 'click',
              page: cur.p, view_id: viewId,
              created_at: new Date(ts + rnd(2, 40) * 1000).toISOString(),
              el_tag: 'a',
              el_text: isOut ? 'roan.eriks@gmail.com' : pick([['Projects', 30], ['IKEA Hej', 20], ['About me', 15], ["Let's talk", 18], ['Playground', 10], ['Japandi Table', 7]]),
              el_href: isOut ? 'mailto:roan.eriks@gmail.com' : null,
              x_pct: zone < 0.3 ? rnd(55, 92) : rnd(12, 88),
              y_doc: Math.round(yRel * cur.h), doc_h: cur.h
            }));
          }
          events.push(Object.assign({}, base, {
            event_type: 'page_leave', page: cur.p, view_id: viewId,
            created_at: new Date(ts + rnd(10, 200) * 1000).toISOString(),
            duration_s: Math.round(Math.min(Math.exp(rnd(2.2, 5.4)), 600)),
            scroll_pct: Math.round(rnd(25, 100))
          }));
          ts += rnd(15, 190) * 1000;
          cur = pages[Math.floor(Math.random() * pages.length)];
        }
      }
    }
    return events;
  }

  /* ================= Boot ================= */

  if (DEMO) {
    load();
  } else if (state.key) {
    load();          // stored password — try it silently
  } else {
    showGate(false);
  }
})();
