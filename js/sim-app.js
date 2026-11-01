// ===== STOCK PRICE SIMULATOR: USER INTERFACE =====
// A separate model inside DCF Pro, reached at #sim. It has its own navigation, saved simulations and storage key.
// The DCF, Trading Comps and Three-Statement models are only read (to copy company data or forecasts after review,
// and for the value comparison). No formula lives here: calculations are in SimEngine.
const SimApp = (() => {
  const E = SimEngine, M = SimModel, H = SimHelp, D = CompsData;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNum = E.isNum;
  const active = () => /^#sim(\/|$)/.test(location.hash);
  const PAGES = [
    { id: 'dashboard', title: 'Projection dashboard', grp: 'Overview', icon: 'home' },
    { id: 'company', title: 'Company & starting financials', grp: 'Inputs', icon: 'building' },
    { id: 'growth', title: 'Growth & profitability', grp: 'Inputs', icon: 'trend' },
    { id: 'multiples', title: 'Valuation multiples', grp: 'Inputs', icon: 'pct' },
    { id: 'projections', title: 'Year-by-year projections', grp: 'Projections', icon: 'bars' },
    { id: 'scenarios', title: 'Bear / Base / Bull scenarios', grp: 'Projections', icon: 'layers' },
    { id: 'sensitivity', title: 'Sensitivity analysis', grp: 'Projections', icon: 'grid' },
    { id: 'results', title: 'Results & expected returns', grp: 'Results', icon: 'target' },
    { id: 'reverse', title: 'Reverse projection', grp: 'Results', icon: 'calc' },
    { id: 'saved', title: 'Saved simulations', grp: 'Results', icon: 'folder' },
  ];
  const ICON = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', building: '<rect x="4" y="3" width="11" height="18"/><path d="M15 9h5v12h-5M8 7h3M8 11h3M8 15h3"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    bars: '<path d="M5 20V12M10 20V8M15 20V4M20 20v-6"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>', list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', save: '<path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    logo: '<path d="M4 20V13M9 20V9M14 20V5M19 20V2" stroke-width="3.2"/>',
  };
  const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ''}</svg>`;

  // ---------- formatting ----------
  const nf = d => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NA = '<span class="na">n/a</span>';
  const f = {
    mm: v => !isNum(v) ? NA : v < 0 ? `<span class="neg">(${nf(0).format(-v)})</span>` : nf(0).format(v),
    x: v => !isNum(v) ? NA : v.toFixed(1) + '×',
    pct: (v, d = 1) => !isNum(v) ? NA : `<span class="${v < 0 ? 'neg' : ''}">${(v * 100).toFixed(d)}%</span>`,
    px: v => !isNum(v) ? NA : (v < 0 ? '−$' : '$') + nf(2).format(Math.abs(v)),
    sh: v => !isNum(v) ? NA : nf(1).format(v),
    up: v => !isNum(v) ? NA : `<span class="pill ${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%</span>`,
  };
  const plain = s => String(s).replace(/<[^>]+>/g, '');
  const fmtU = (v, unit) => unit === 'pct' ? f.pct(v) : unit === 'x' ? f.x(v) : unit === 'ps' ? f.px(v) : unit === 'sh' ? f.sh(v) : f.mm(v);
  function fmtIn(v, unit) { if (!isNum(v)) return ''; if (unit === 'pct') return String(+(v * 100).toFixed(2)); return String(+v.toFixed(unit === 'x' ? 2 : unit === 'mm' ? 1 : 4)); }
  function parse(str, unit) {
    const s = String(str).trim(); if (s === '') return { v: null };
    let t = s.replace(/[,$\s×x%]/gi, ''); let neg = false; if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (!/^[-+−]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { error: `"${s}" is not a number.` };
    let n = Number(t.replace('−', '-')) * (neg ? -1 : 1); if (unit === 'pct') n /= 100; return { v: n };
  }
  const CAT = { sec: ['SEC', 'Reported in an SEC filing'], calc: ['Calc', 'Calculated from reported figures'], market: ['Mkt', 'Market data'], vendor: ['Vendor', 'Provider-compiled figure'], estimate: ['Est', 'Analyst estimate'], manual: ['Manual', 'Entered by you'], dcf: ['DCF', 'Copied from a DCF model'] };
  const SCOL = { Bear: 'sim-bear', Base: 'sim-base', Bull: 'sim-bull' };

  // ---------- state ----------
  let models = {}, cur = null, booted = false;
  let drawer = null, modal = null, confirm = null, busy = null, msg = null, errs = {};
  const ui = { scen: 'Base', open: {}, search: { q: '', results: [], open: false }, sensScen: 'Base', sensYear: null, cmpDcf: null, cmpComps: null, chart: 'price' };
  function persist() { if (!cur) return; if (!M.save(cur)) toast('Could not save in this browser. Use "Save simulation file" on Saved simulations.'); models = M.loadAll(); M.setCurrent(cur.id); }
  function change(field, from, to) { M.log(cur, field, from, to); persist(); }
  function toast(t) { let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); } const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; box.appendChild(el); setTimeout(() => el.remove(), 3600); }
  function page() { const m = /^#sim\/?([a-z]*)/.exec(location.hash); const id = (m && m[1]) || 'dashboard'; return PAGES.find(p => p.id === id) ? id : 'dashboard'; }
  const link = (id, text) => `<a href="#sim/${id}">${text}</a>`;
  const hb = k => H.G[k] ? `<button class="help" data-shelp="${k}" aria-label="Guide: ${esc(H.G[k].t)}">?</button>` : '';
  function dataCfg() { let c = null; try { c = JSON.parse(localStorage.getItem('dcfcalc.data')); } catch (e) {} return Object.assign({ provider: 'fmp', keys: {}, remember: true }, c || {}); }
  let memKey = null;
  const fmpKey = () => memKey || dataCfg().keys.fmp || null;
  function saveKey(k, remember) { const c = dataCfg(); c.provider = 'fmp'; c.keys = Object.assign({}, c.keys, { fmp: k }); c.remember = remember; try { localStorage.setItem('dcfcalc.data', JSON.stringify(remember ? c : Object.assign({}, c, { keys: {} }))); } catch (e) {} memKey = k; }
  let cache = null;
  function calc() { if (cache) return cache; const all = E.runAll(cur); cache = { all, checks: E.checks(cur, all), comp: M.completion(cur, all), anc: M.anchors(cur) }; return cache; }
  const years = () => Math.max(1, Math.min(10, Math.round(cur.settings.years || 5)));
  const methodLabel = m => E.METHODS[m || cur.settings.method].short;
  const DISC = '<div class="notice info sim-disc"><b>Hypothetical, not a prediction.</b> These prices are the arithmetic result of your assumptions about growth, margins, share count and future multiples. They are not a forecast of the market price, a price target or a guarantee of any return. Markets can price the shares well above or below any projection.</div>';
  const COMPANY_LABEL = { price: 'Current share price', shares: 'Basic shares outstanding (mm)', dilutive: 'Net dilutive shares (mm)', cash: 'Cash and equivalents', sti: 'Short-term investments', stBorrow: 'Short-term borrowings', ltdCurrent: 'Current portion of long-term debt', ltdNoncurrent: 'Long-term debt', finLease: 'Finance lease liabilities', opLease: 'Operating lease liabilities', preferred: 'Preferred equity', nci: 'Noncontrolling interests', otherClaims: 'Other debt-like claims', dps: 'Dividend per share (annual)' };
  const OPS = [['rev', 'Revenue', 'mm', 'rev'], ['ni', 'Net income', 'mm', 'ni'], ['ebitda', 'EBITDA', 'mm', 'ebitda'], ['ebit', 'Operating income (EBIT)', 'mm', 'ebit'], ['fcf', 'Free cash flow', 'mm', 'fcf'], ['eps', 'Diluted EPS', 'ps', 'eps']];

  // ---------- building blocks ----------
  function cin(key, unit, label) {
    const c = cur.company, r = c.v[key]; const v = r && isNum(r.v) ? r.v : null; const cat = r && r.src ? r.src.cat : null;
    const id = `sv_${key}`; const err = errs[id];
    return `<span class="cx-in ${cat ? 'cx-' + cat : 'cx-none'} ${err ? 'err' : ''}"><input id="${id}" data-sv="${key}" data-unit="${unit}" value="${err ? esc(err.text) : fmtIn(v, unit)}" placeholder="—" inputmode="decimal" aria-label="${esc(label || COMPANY_LABEL[key] || key)}">${r && r.src ? `<button class="cx-srcb" data-ssrc="${key}" title="${esc((CAT[cat] || ['', 'Source'])[1])}: open the source and history">${(CAT[cat] || ['Src'])[0]}</button>` : ''}</span>${err ? `<div class="errmsg">${esc(err.msg)}</div>` : ''}`;
  }
  function ain(s, key, t, opts = {}) {
    const A = cur.scen[s], a = E.AK[key]; const unit = a.unit;
    const v = t ? (A.py[key] ? A.py[key][t - 1] : null) : A[key];
    const id = `sa_${s}_${key}_${t}`; const err = errs[id];
    const ph = t ? fmtIn(E.at(Object.assign({}, A, { py: {} }), key, t), unit) : '—';
    const src = !t && A.src[key] ? A.src[key].cat : null;
    return `<span class="cx-in sim-a ${t && !isNum(v) ? 'sim-inherit' : ''} ${src === 'analyst' ? 'cx-manual' : src ? 'cx-dcf' : 'cx-none'} ${err ? 'err' : ''}"><input id="${id}" data-sa="${s}|${key}|${t}" data-unit="${unit}" value="${err ? esc(err.text) : fmtIn(v, unit)}" placeholder="${esc(ph || '—')}" inputmode="decimal" aria-label="${esc(s + ': ' + a.label + (t ? ', year ' + t : ''))}"><span class="unit">${unit === 'pct' ? '%' : unit === 'x' ? '×' : '$mm'}</span></span>${err ? `<div class="errmsg">${esc(err.msg)}</div>` : ''}`;
  }
  const srcTag = (A, key) => { const s = A.src[key]; if (!s) return '<span class="tag">default</span>'; return `<span class="tag ${s.cat === 'analyst' ? 'ovr' : 'imp'}" title="${esc((s.source || '') + (s.note ? ': ' + s.note : '') + (s.at ? ' · ' + s.at.slice(0, 10) : ''))}">${esc(M.SRC[s.cat] || s.cat)}</span>`; };
  function panel(title, body, opts = {}) { return `<section class="panel ${opts.cls || ''}">${title ? `<div class="panel-head"><h2>${title}${opts.help ? ' ' + hb(opts.help) : ''}</h2>${opts.right || ''}</div>` : ''}${body}</section>`; }
  const pill = (level, text) => `<span class="pill ${level === 'bad' ? 'bad' : level === 'warn' ? 'warn' : level === 'good' ? 'good' : 'neutral'}">${esc(text)}</span>`;
  const learn = text => cur.ui.learn ? `<div class="cx-learn"><b>How this works.</b> ${text}</div>` : '';
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;
  const stat = (k, v, s, cls = '') => `<div class="stat ${cls}"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s || ''}</span></div>`;
  function notes(key, title) { const v = cur.notes[key] || ''; const k = 'n-' + key; return `<details class="cx-notes" data-k="${k}" ${ui.open[k] || v ? 'open' : ''}><summary>My research notes${title ? ': ' + esc(title) : ''}${v ? ' <span class="tag src">saved</span>' : ''}</summary><textarea data-snote="${esc(key)}" rows="3" placeholder="Optional. Sources, reasoning, risks.">${esc(v)}</textarea></details>`; }
  const scenTabs = (sel, attr = 'data-sscen') => `<div class="cx-tabs" role="tablist">${E.SCEN.map(s => `<button role="tab" ${attr}="${s}" aria-selected="${s === sel}">${s}</button>`).join('')}</div>`;
  const warnList = (list) => list.length ? `<ul class="flags">${list.map(w => `<li class="${w.level === 'bad' ? 'bad' : ''}">${w.level === 'info' ? 'ℹ' : '⚠'} ${esc(w.text)}${w.page && w.page !== page() ? ' ' + link(w.page, 'Go') : ''}</li>`).join('')}</ul>` : '';

  // ---------- charts (SVG; colours from the validated categorical palette, direct labels as secondary encoding) ----------
  function lineChart(series, opts = {}) {
    const W = 720, Hh = 260, L = 64, R = 92, T = 16, B = 34;
    const pts = series.flatMap(s => s.pts.filter(p => isNum(p.y)));
    const refs = (opts.refs || []).filter(r => isNum(r.y));
    if (!pts.length) return '<p class="footnote">No projected prices yet: complete the inputs for the selected method.</p>';
    const xs = series[0].pts.map(p => p.x); const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let lo = Math.min(0, ...pts.map(p => p.y), ...refs.map(r => r.y)), hi = Math.max(...pts.map(p => p.y), ...refs.map(r => r.y)); if (hi === lo) hi = lo + 1;
    const step = niceStep((hi - lo) / 5); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step;
    const X = x => L + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - L - R), Y = y => T + (1 - (y - lo) / (hi - lo)) * (Hh - T - B);
    let g = '';
    for (let v = lo; v <= hi + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="sim-grid"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">${opts.fmt ? opts.fmt(v) : '$' + nf(0).format(v)}</text>`;
    xs.forEach(x => { g += `<text x="${X(x)}" y="${Hh - 12}" text-anchor="middle" class="tick">${x === 0 ? 'Today' : 'Y' + x}</text>`; });
    refs.forEach(r => { g += `<line x1="${L}" x2="${W - R}" y1="${Y(r.y)}" y2="${Y(r.y)}" class="sim-ref"/><text x="${W - R + 6}" y="${Y(r.y) + 4}" class="sim-reft">${esc(r.label)}</text>`; });
    const labels = [];
    series.forEach(s => {
      const ok = s.pts.filter(p => isNum(p.y)); if (!ok.length) return;
      g += `<path d="${ok.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('')}" class="sim-line ${s.cls}" fill="none"/>`;
      ok.forEach(p => { g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" class="sim-dot ${s.cls}"><title>${esc(s.name)} · ${p.x === 0 ? 'today' : 'year ' + p.x}: ${plain(opts.fmt ? opts.fmt(p.y) : f.px(p.y))}</title></circle>`; });
      const last = ok[ok.length - 1]; labels.push({ y: Y(last.y), x: X(last.x), text: `${s.name} ${plain(opts.fmt ? opts.fmt(last.y) : f.px(last.y))}` });
    });
    labels.sort((a, b) => a.y - b.y); for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
    labels.forEach(l => { g += `<text x="${l.x + 8}" y="${l.y + 4}" class="sim-lab">${esc(l.text)}</text>`; });
    const legend = series.length > 1 ? `<div class="legend sim-legend">${series.map(s => `<span><i class="sw line ${s.cls}"></i>${esc(s.name)}</span>`).join('')}${refs.map(r => `<span><i class="sw line sim-refsw"></i>${esc(r.label)}</span>`).join('')}</div>` : '';
    return `${legend}<svg class="chart sim-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(opts.label || 'Projected share price by year')}">${g}</svg>`;
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function priceChart(all, opts = {}) {
    const n = years(), m = cur.settings.method, P0 = all.st.price;
    const series = E.SCEN.map(s => ({ name: s, cls: SCOL[s], pts: [{ x: 0, y: P0 }].concat(all.scen[s].years.map(y => ({ x: y.t, y: y.p[m] }))) }));
    const refs = [{ y: P0, label: 'Today' }];
    if (opts.dcf && isNum(opts.dcf)) refs.push({ y: opts.dcf, label: 'DCF value' });
    return lineChart(series, { refs, label: `Projected share price by year, ${methodLabel()} method, ${n} years` });
  }

  // ---------- top bar and rail ----------
  function renderTop() {
    const top = document.getElementById('topbar');
    if (top.dataset.owner !== 'sim') {
      top.dataset.owner = 'sim';
      top.innerHTML = `<div class="hdr-main">
        <button class="hbtn menu-btn" id="sim-menu" aria-label="Open sections">${icon('list')}</button>
        <div class="brand">${icon('logo', 'logo')}<div><b>DCF Pro</b><small>Financial Valuation Platform</small></div></div>
        <div class="hdr-title"><b>Stock Price Simulator</b><small>How growth, profitability, share count and future multiples could move a share price over 1–10 years</small></div>
        <div class="search" role="search"><label class="sr" for="sim-search">Import company by ticker</label>
          <div class="search-box">${icon('search')}<input id="sim-search" type="search" autocomplete="off" placeholder="Company ticker or name…"></div>
          <div class="search-sel" id="sim-sel"></div><div id="sim-results" class="search-results" role="listbox" hidden></div></div>
        <div class="hdr-actions">
          <button class="hbtn primary" id="sim-save">${icon('save')}<span>Save Simulation</span></button>
          <button class="hbtn accent" id="sim-new">${icon('plus')}<span>New Simulation</span></button>
          <div class="theme-toggle" role="group" aria-label="Colour theme"><button data-sim-theme="light" aria-label="Light mode">${icon('sun')}</button><button data-sim-theme="dark" aria-label="Dark mode">${icon('moon')}</button></div>
        </div></div><div class="hdr-sub" id="sim-sub"></div>`;
    }
    const theme = document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    top.querySelectorAll('[data-sim-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.simTheme === theme)));
    const c = cur.company;
    top.querySelector('#sim-sel').innerHTML = c.name || c.ticker ? `<span class="chip">${esc((c.name || '') + (c.ticker ? ' (' + c.ticker + ')' : ''))}</span>` : '<span class="chip muted">No company selected</span>';
    renderResults();
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated)); if (!models[cur.id]) list.unshift(cur);
    const { all } = calc(); const b = all.scen[cur.settings.active] || all.scen.Base;
    const live = b.sel.ok ? `<div><div class="lbl">${esc(b.scenario)} · year ${years()} · ${esc(methodLabel())}</div><div class="big">${f.px(b.sel.price)}</div></div><div><div class="lbl">vs price ${plain(f.px(all.st.price))}</div><div>${f.up(b.sel.returns.upside)}</div></div>`
      : `<a class="pill bad" href="#sim/growth">Inputs needed</a>`;
    $('#sim-sub').innerHTML = `${switchNav('sim')}
      <div class="model-pick"><label for="sim-model" class="footnote">Simulation</label><select id="sim-model" class="plain">${list.map(m => opt(m.id, m.name, cur.id)).join('')}</select></div>
      <div class="model-pick"><label for="sim-method" class="footnote">Method</label><select id="sim-method" class="plain">${E.METHOD_IDS.map(m => opt(m, E.METHODS[m].label, cur.settings.method)).join('')}</select></div>
      <div class="model-pick"><label for="sim-years" class="footnote">Years</label><select id="sim-years" class="plain">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => opt(n, n + (n === 1 ? ' year' : ' years'), years())).join('')}</select></div>
      <button class="btn ghost" id="sim-data">${icon('db')} Data source: ${fmpKey() ? 'Financial Modeling Prep' : 'not connected'}</button>
      <div class="live">${live}</div>`;
  }
  // the platform's model switch; models that are not loaded in this build are left out
  function switchNav(on) {
    const items = [['dashboard', 'Discounted Cash Flow', 'dcf'], ['comps', 'Trading Comps', 'comps']];
    if (typeof FsmApp !== 'undefined') items.push(['fsm', 'Three-Statement Model', 'fsm']);
    items.push(['sim', 'Stock Price Simulator', 'sim']);
    return `<div class="seg model-switch" role="group" aria-label="Valuation model">${items.map(([h, t, k]) => `<a href="#${h}" ${k === on ? 'aria-current="true"' : ''}>${t}</a>`).join('')}</div>`;
  }
  function renderResults() {
    const box = document.getElementById('sim-results'); if (!box) return;
    const S = ui.search; if (!S.open) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false; let h = '';
    if (!fmpKey()) h = `<div class="sr-note">Connect Financial Modeling Prep to search and import, or load SEC company facts files on Company &amp; starting financials.<br><button class="btn primary" data-sim-open-data>Connect a data source</button></div>`;
    else if (S.busy) h = '<div class="sr-note">Searching…</div>';
    else if (S.error) h = `<div class="sr-note bad">${esc(S.error)}</div>`;
    else if (S.results.length) h = S.results.map(r => `<button role="option" data-sim-import="${esc(r.symbol)}"><b>${esc(r.symbol)}</b><span>${esc(r.name)}</span><small>${esc(r.exchange || '')}</small></button>`).join('');
    else if (S.q) h = `<div class="sr-note">Press Enter to import “${esc(S.q.toUpperCase())}”.</div>`;
    box.innerHTML = h;
  }
  function renderRail() {
    const { comp } = calc();
    const st = { company: 'company', growth: 'assume', scenarios: 'scen', results: 'docs' };
    let h = '', grp = '';
    PAGES.forEach(p => {
      if (p.grp !== grp) { grp = p.grp; h += `<h4>${grp}</h4>`; }
      const s = st[p.id] && comp.sections.find(x => x.id === st[p.id]);
      const badge = s ? `<span class="pct ${s.status === 'complete' ? 'done' : ''}">${s.status === 'complete' ? '✓' : Math.round(s.done / s.total * 100) + '%'}</span>` : '';
      h += `<a href="#sim/${p.id}" ${page() === p.id ? 'aria-current="page"' : ''}>${icon(p.icon)}<span class="t">${p.title}</span>${badge}</a>`;
    });
    h += `<h4>Other models</h4><a href="#dashboard">${icon('calc')}<span class="t">Discounted Cash Flow</span></a><a href="#comps">${icon('grid')}<span class="t">Trading Comps</span></a>${typeof FsmApp !== 'undefined' ? `<a href="#fsm">${icon('bars')}<span class="t">Three-Statement Model</span></a>` : ''}`;
    $('#rail').innerHTML = h;
  }

  // ---------- other models (read only) ----------
  function dcfModels() { try { return typeof DCFModel !== 'undefined' ? Object.values(DCFModel.loadAll()).sort((a, b) => b.updated.localeCompare(a.updated)) : []; } catch (e) { return []; } }
  function compsModels() { try { return typeof CompsModel !== 'undefined' ? Object.values(CompsModel.loadAll()).sort((a, b) => b.updated.localeCompare(a.updated)) : []; } catch (e) { return []; } }
  function fsmModels() { try { if (typeof FsmModel !== 'undefined' && FsmModel.loadAll) return Object.values(FsmModel.loadAll()); const j = JSON.parse(localStorage.getItem('dcf3s.models.v1') || '{}'); return Object.values(j); } catch (e) { return []; } }
  const tickerOf = m => ((m.meta && m.meta.symbol) || (m.target && m.target.ticker) || (m.company && m.company.ticker) || '').toUpperCase();
  function matchModel(list, linkId) { if (linkId) { const x = list.find(m => m.id === linkId); if (x) return x; } const tk = (cur.company.ticker || '').toUpperCase(); return tk ? list.find(m => tickerOf(m) === tk) || null : null; }
  function dcfValue(m) {
    if (!m || typeof DCFModel === 'undefined' || typeof DCF === 'undefined') return null;
    try {
      const mm = DCFModel.upgrade(JSON.parse(JSON.stringify(m))); const ei = DCFModel.engineInputs(mm); const res = DCF.runAll(ei.inp, mm.mode);
      const comp = DCFModel.completion(mm); const complete = Object.values(comp).every(g => g.items.every(i => i.ok));
      const sc = {}; E.SCEN.forEach(s => { sc[s] = res.scen[s] && res.scen[s].ok ? res.scen[s].perShare : null; });
      const ke = res.scen.Base && res.scen.Base.ok && res.scen.Base.W ? res.scen.Base.W.ke : null;
      return { name: m.name, weighted: isNum(res.weighted) ? res.weighted : null, scen: sc, complete, ke, price: mm.inputs.price, date: (mm.asOf && mm.asOf.price) || mm.inputs.company.valDate || null };
    } catch (e) { return { name: m.name, error: e.message, scen: {} }; }
  }
  function compsValue(m) {
    if (!m || typeof CompsModel === 'undefined') return null;
    try { const mm = CompsModel.upgrade(JSON.parse(JSON.stringify(m))); const c = CompsModel.completion(mm); const r = CompsEngine.range(mm); return { name: m.name, perShare: c.imp.perShare, label: c.b.label, lo: r.rows[0] && r.rows[0].perShare, hi: r.rows[2] && r.rows[2].perShare, complete: c.complete, date: mm.target.priceDate, price: CompsEngine.val(mm.target, 'price') }; }
    catch (e) { return { name: m.name, error: e.message }; }
  }

  // ---------- pages ----------
  const P = {};
  P.dashboard = () => {
    const { all, checks, comp } = calc(); const st = all.st, c = cur.company, n = years(), m = cur.settings.method;
    const s = cur.settings.active || 'Base', p = all.scen[s], y = p.last, R = p.sel.returns;
    const multK = E.METHODS[m].mult;
    const dcf = dcfValue(matchModel(dcfModels(), cur.dcfLink));
    return `<div><h1>Projection dashboard</h1><p class="lead">${c.name ? esc(c.name) + (c.ticker ? ' (' + esc(c.ticker) + ')' : '') : 'No company yet: start on ' + link('company', 'Company &amp; starting financials')}. ${esc(s)} scenario, ${esc(E.METHODS[m].label)}, ${n} ${n === 1 ? 'year' : 'years'}${y.end ? ' (year ' + n + ' ends ' + esc(y.end) + ')' : ''}.</p></div>
      ${DISC}
      <div class="cx-tabs" role="tablist">${E.SCEN.map(x => `<button role="tab" data-sactive="${x}" aria-selected="${x === s}">${x}</button>`).join('')}</div>
      <div class="stats">
        ${stat('Current stock price', f.px(st.price), c.priceDate ? 'as of ' + esc(c.priceDate) : 'no date')}
        ${stat('Projected stock price', f.px(p.sel.price), p.sel.ok ? `year ${n}, ${esc(methodLabel())}` : esc(p.sel.why || 'inputs needed'), 'primary')}
        ${stat('Projected EPS', f.px(m === 'eps' ? y.epsG : y.epsPE), m === 'eps' ? 'EPS growth path' : 'revenue × margin ÷ shares')}
        ${stat('Projected revenue ($mm)', f.mm(y.rev), isNum(st.rev) ? 'from ' + plain(f.mm(st.rev)) + ' actual' : '')}
        ${stat('Projected earnings ($mm)', f.mm(m === 'eps' ? y.niFromEps : y.ni), 'net income')}
        ${stat('Future multiple', f.x(y.mult[multK]), esc(E.AK[multK].label.replace('Future ', '')) + (isNum(all.cur[multK === 'pe' ? 'pe' : multK]) ? ', today ' + plain(f.x(all.cur[multK])) : ''))}
        ${stat('Projected share count (mm)', f.sh(y.sharesEnd), isNum(st.shares) ? 'from ' + plain(f.sh(st.shares)) + ' today' : '')}
        ${stat('Total upside / downside', f.up(R.upside), 'price return')}
        ${stat('Annualized price return', f.pct(R.cagr), isNum(R.h) ? R.h.toFixed(2) + ' years from the price date' : '')}
        ${stat('Total return incl. dividends', f.pct(R.irr), 'IRR per year' + (isNum(R.divs) && R.divs > 0 ? ', ' + plain(f.px(R.divs)) + ' dividends' : ''))}
        ${stat('Probability-weighted price', f.px(all.weighted), all.weighted === null ? esc(all.weightedNote) : 'Bear/Base/Bull weights')}
        ${stat('Completion', comp.pct + '%', comp.complete ? 'complete' : link('saved', 'see the checklist'))}
      </div>
      ${panel(`Projected stock price by year (${esc(methodLabel())})`, priceChart(all, { dcf: dcf && dcf.weighted }) + `<p class="footnote">Each point is the price the ${esc(methodLabel())} multiple gives for that year's projected figures. ${dcf && isNum(dcf.weighted) ? 'The DCF value is today\'s intrinsic value, not a future price.' : ''} ${link('projections', 'See every year and method')}.</p>`)}
      <div class="grid2">
        ${panel('Scenarios side by side', scenSummary(all))}
        ${panel('Checks', checks.length ? warnList(checks.slice(0, 10)) : '<p class="footnote">No warnings.</p>')}
      </div>
      ${panel('Questions this simulator answers', `<ul class="cx-q">
        <li>"If the company keeps a 30× P/E while earnings grow, what could the stock reach?" Set the P/E to 30 on ${link('multiples', 'Valuation multiples')} and read year ${n}.</li>
        <li>"If revenue doubles but the P/E falls?" Set growth so revenue doubles (${f.pct(Math.pow(2, 1 / n) - 1)} a year over ${n} years) and lower the P/E; ${link('sensitivity', 'Sensitivity')} shows the whole grid.</li>
        <li>"If EBITDA grows 20% and it trades at 15× EV/EBITDA?" Choose the EV/EBITDA method, set the EBITDA margin and growth, and set EV/EBITDA to 15.</li>
        <li>"What return could an investor earn?" See ${link('results', 'Results &amp; expected returns')}. To see what a price target requires, use ${link('reverse', 'Reverse projection')}.</li></ul>`)}`;
  };
  function scenSummary(all) {
    const m = cur.settings.method;
    const rows = [['Projected price', s => f.px(all.scen[s].sel.price)], ['Upside', s => f.up(all.scen[s].sel.returns.upside)], ['Annualized return', s => f.pct(all.scen[s].sel.returns.cagr)], ['Revenue growth (yr 1)', s => f.pct(all.scen[s].years[0].revGrowth)], ['Future multiple', s => f.x(all.scen[s].last.mult[E.METHODS[m].mult])], ['Probability', s => f.pct(cur.settings.weights[s], 0)]];
    return `<div class="tbl-wrap"><table class="fin"><thead><tr><th></th>${E.SCEN.map(s => `<th><i class="sw-dot ${SCOL[s]}"></i>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(([l, fn]) => `<tr><td>${l}</td>${E.SCEN.map(s => `<td>${fn(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  P.company = () => {
    const { all, checks, anc } = calc(); const c = cur.company, st = all.st, S = cur.settings;
    const busyNote = busy ? `<div class="notice info"><span class="spinner"></span> ${esc(busy)}</div>` : '';
    const note = msg ? `<div class="notice ${msg.level || ''}">${esc(msg.text)}</div>` : '';
    const dl = dcfModels(), cl = compsModels();
    const imp = panel('Import starting financials', `${learn('Imports fill <b>reported figures and market data only</b> (Actual). Your growth, margin and multiple assumptions are projections and are never filled by a company import. A re-import never overwrites a figure you typed: differences are listed below for you to approve.')}
      <div class="cx-import">
        <div><b>By ticker (Financial Modeling Prep)</b><div class="cx-form"><span class="inwrap"><input type="text" class="txt" id="sim-tk" placeholder="e.g. AMD" value="${esc(c.ticker || '')}" aria-label="Ticker"></span><button class="btn primary" data-sim-tkimp>Import</button></div><p class="footnote">Price, shares, statements, balance sheet. ${fmpKey() ? '' : '<button class="linkbtn" data-sim-open-data>Connect a key</button>'}</p></div>
        <div><b>SEC company facts file(s)</b><div class="cx-form"><input type="file" id="sim-sec" accept=".json,application/json" multiple aria-label="SEC company facts and submissions files"></div><p class="footnote">data.sec.gov/api/xbrl/companyfacts/CIK##########.json (plus the submissions file for filing dates). Gives five fiscal years of history and TTM; no share price.</p></div>
        <div><b>Copy from another model</b><div class="cx-form"><select id="sim-copy-src" class="plain"><option value="">Choose…</option>${dl.map(m => opt('dcf:' + m.id, 'DCF: ' + m.name, '')).join('')}${cl.map(m => opt('comps:' + m.id, 'Trading Comps target: ' + m.name, '')).join('')}</select><button class="btn" data-sim-copy>Copy</button></div><p class="footnote">The other model is only read, never changed.</p></div>
      </div>${busyNote}${note}${pendingCompany()}`);
    const row = (key, unit) => `<tr><td>${esc(COMPANY_LABEL[key])} ${hb(guideFor(key))}</td><td>${cin(key, unit)}</td></tr>`;
    const refDil = c.ref && c.ref.dilutive && !isNum((c.v.dilutive || {}).v) ? `<p class="footnote">The latest 10-Q reports ${f.sh(c.ref.dilutive.v)}mm net dilutive shares. <button class="btn tiny" data-sim-useref="dilutive">Use it</button></p>` : '';
    const ops = `<table class="fin"><thead><tr><th>Actual figures ($mm)</th><th class="hist">TTM</th><th class="hist">Latest fiscal year</th><th>Used (${S.base === 'fy' ? 'FY' : 'TTM'})</th></tr></thead><tbody>${OPS.map(([k, l, u, gk]) => `<tr><td>${l} ${hb(gk)}</td><td>${cin(k + '_ttm', u === 'ps' ? 'ps' : 'mm', l + ' TTM')}</td><td>${cin(k + '_fy', u === 'ps' ? 'ps' : 'mm', l + ' FY')}</td><td>${fmtU(st[k], u)}</td></tr>`).join('')}</tbody></table>
      <p class="footnote">Period: ${esc(st.baseEnd ? 'twelve months ended ' + st.baseEnd : 'not dated')}. Green edge = SEC filing, cyan = market data, orange = entered by you. Click a badge for the source, filing and history.</p>`;
    const settings = `<div class="cx-form">
      <label>Base period ${hb('base')}<select data-sset="base" class="plain">${opt('ttm', 'Trailing twelve months (TTM)', S.base)}${opt('fy', 'Latest fiscal year', S.base)}</select></label>
      <label>Share count ${hb('shares')}<select data-sset="shareBasis" class="plain">${opt('diluted', 'Diluted (basic + net dilutive)', S.shareBasis)}${opt('basic', 'Basic only', S.shareBasis)}</select></label>
      <label>Operating leases ${hb('leases')}<select data-sset="leases" class="plain">${opt('exclude', 'Not debt (US GAAP multiples)', S.leases)}${opt('debt', 'Count as debt', S.leases)}</select></label>
      <label>Price date<span class="inwrap"><input type="date" data-sdate="priceDate" value="${esc(c.priceDate || '')}"></span></label>
      <label class="cx-chk"><input type="checkbox" data-sset="fromPriceDate" ${S.fromPriceDate !== false ? 'checked' : ''}> Measure returns from the price date ${hb('base')}</label></div>
      <div class="cx-form"><label>Stock split factor ${hb('split')}<span class="inwrap"><input data-ssplit="factor" value="${esc(S.split.factor)}" inputmode="decimal" aria-label="Split factor"></span></label>
      <label>Apply to<select data-ssplit="appliesTo" class="plain">${opt('eps', 'EPS and dividends only (filing restated shares)', S.split.appliesTo)}${opt('all', 'EPS, dividends and share counts', S.split.appliesTo)}</select></label></div>`;
    const cm = all.cur;
    const curMult = `<table class="fin"><tbody>${[['Market capitalisation ($mm)', f.mm(cm.mcap)], ['Enterprise value ($mm)', f.mm(cm.ev)], ['P/E (price ÷ EPS)', f.x(cm.pe)], ['EV/EBITDA', f.x(cm.evEbitda)], ['EV/EBIT', f.x(cm.evEbit)], ['EV/Revenue', f.x(cm.evRev)], ['Price/Sales', f.x(cm.ps)], ['Price/FCF', f.x(cm.pfcf)], ['Dividend yield', f.pct(cm.divYield)]].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table><p class="footnote">Today's multiples from today's price, ${S.shareBasis} shares and the ${S.base === 'fy' ? 'fiscal-year' : 'TTM'} figures. Use them as one anchor for future multiples.</p>`;
    return `<div><h1>Company &amp; starting financials</h1><p class="lead">Reported, actual figures that every projection starts from. Projections start on ${link('growth', 'Growth &amp; profitability')}.</p></div>
      ${imp}
      <div class="grid2">
        ${panel('Market data and shares', `<table class="fin cx-kv"><tbody>${row('price', 'ps')}${row('shares', 'sh')}${row('dilutive', 'sh')}${row('dps', 'ps')}</tbody></table>${refDil}<p class="footnote">Diluted shares used: ${f.sh(st.shares)}mm${st.splitFactor !== 1 ? ` (after the ${st.splitFactor}-for-1 split adjustment)` : ''}.</p>`)}
        ${panel('Balance sheet (for the equity bridge)', `<table class="fin cx-kv"><tbody>${['cash', 'sti', 'stBorrow', 'ltdCurrent', 'ltdNoncurrent', 'finLease', 'opLease', 'preferred', 'nci', 'otherClaims'].map(k => row(k, 'mm')).join('')}</tbody></table><p class="footnote">Debt used ${f.mm(st.debt)} · cash used ${f.mm(st.cash)} · other claims ${f.mm(st.claims)} ($mm). Enter 0 for a line the company does not have.</p>`)}
      </div>
      ${panel('Operating figures', ops)}
      ${panel('Settings', settings)}
      <div class="grid2">${panel('Today\'s multiples', curMult)}${panel('Checks', warnList(checks.filter(x => x.page === 'company')) || '<p class="footnote">No warnings.</p>')}</div>
      ${panel('Historical financials (reported)', histTable(anc))}
      ${notes('company', 'starting financials')}`;
  };
  function guideFor(key) { return { price: 'price', shares: 'shares', dilutive: 'dilutive', dps: 'dps', cash: 'cash', sti: 'cash', stBorrow: 'debt', ltdCurrent: 'debt', ltdNoncurrent: 'debt', finLease: 'debt', opLease: 'leases', preferred: 'claims', nci: 'claims', otherClaims: 'claims' }[key] || key; }
  function histTable(anc) {
    const H = (cur.hist || []).slice().sort((a, b) => b.end.localeCompare(a.end));
    if (!H.length) return '<p class="footnote">Load the SEC company facts file to see five fiscal years of reported history here. Each figure links to its 10-K.</p>';
    const rows = [['Revenue ($mm)', y => f.mm(y.rev)], ['Revenue growth', (y, i) => H[i + 1] && H[i + 1].rev > 0 ? f.pct(y.rev / H[i + 1].rev - 1) : NA], ['Net income ($mm)', y => f.mm(y.ni)], ['Net margin', y => y.rev > 0 && isNum(y.ni) ? f.pct(y.ni / y.rev) : NA], ['EBITDA margin', y => y.rev > 0 && isNum(y.ebitda) ? f.pct(y.ebitda / y.rev) : NA], ['Operating margin', y => y.rev > 0 && isNum(y.ebit) ? f.pct(y.ebit / y.rev) : NA], ['Diluted EPS', y => f.px(y.eps)], ['Diluted shares (mm, weighted)', y => f.sh(y.waDil)], ['Dividend per share', y => f.px(y.dps)]];
    const a = anc;
    return `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Actual</th>${H.map(y => `<th class="hist">${esc(y.label)}${y.accn ? `<br><small><a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${esc(String(cur.company.cik || '').replace(/^0+/, ''))}&type=10-K" target="_blank" rel="noopener">${esc(y.form || '10-K')}</a></small>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map(([l, fn]) => `<tr><td>${l}</td>${H.map((y, i) => `<td class="hist">${fn(y, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="footnote">Revenue CAGR: 3-year ${plain(f.pct(a.revGrowth.y3))}, 4-year ${plain(f.pct(a.revGrowth.y5))}. EPS CAGR 3-year ${plain(f.pct(a.epsGrowth.y3))}. Diluted share change per year (3-year) ${plain(f.pct(a.dilution.y3))}. Source: SEC EDGAR XBRL company facts.</p>`;
  }
  function pendingCompany() {
    const c = cur.company; if (!c.pending) return '';
    return `<div class="notice"><b>Imported figures that differ from yours (${esc(c.pending.provider)}).</b> Nothing has been changed yet.
      <table class="fin"><thead><tr><th>Figure</th><th>Current</th><th>Imported</th><th></th></tr></thead><tbody>${c.pending.items.map(p => `<tr><td>${esc(D.label(p.key))}${p.manual ? ' <span class="tag ovr">you entered</span>' : ''}</td><td>${esc(nf(2).format(p.from))}</td><td>${esc(nf(2).format(p.to))}</td><td><button class="btn tiny" data-scpend="${p.id}|apply">${p.manual ? 'Replace mine' : 'Apply'}</button> <button class="btn tiny" data-scpend="${p.id}|skip">Keep current</button></td></tr>`).join('')}</tbody></table>
      <div class="btns"><button class="btn primary" data-scpend="all|apply">Apply all except my entries</button><button class="btn" data-scpend="all|skip">Keep all current</button></div></div>`;
  }

  // assumption tables: all three scenarios side by side, or one scenario with a column per year
  function anchorText(key, anc) {
    const a = anc[key], C = anc.cur; const p = v => plain(f.pct(v)), x = v => plain(f.x(v));
    if (key === 'revGrowth') return `TTM ${p(a.ttm)} · FY ${p(a.fy)} · 3-yr ${p(a.y3)}`;
    if (['netMargin', 'ebitdaMargin', 'ebitMargin', 'fcfMargin'].includes(key)) return `TTM ${p(a.ttm)} · FY ${p(a.fy)} · 5-yr range ${p(a.lo)}–${p(a.hi)}`;
    if (key === 'epsGrowth') return `FY ${p(a.fy)} · 3-yr ${p(a.y3)}`;
    if (key === 'dilution') return `FY ${p(a.fy)} · 3-yr ${p(a.y3)}`;
    if (key === 'payout') return `Today ${p(C.payout)}`;
    if (E.MULT_KEYS.includes(key)) return `Today ${x(C[key])}`;
    return '';
  }
  function assumeTable(keys) {
    const { anc } = calc(); const n = years();
    if (!cur.settings.perYear) {
      return `<div class="tbl-wrap"><table class="fin sim-at"><thead><tr><th>Assumption (all years)</th>${E.SCEN.map(s => `<th><i class="sw-dot ${SCOL[s]}"></i>${s}</th>`).join('')}<th>Reference (actual)</th></tr></thead><tbody>
        ${keys.map(k => `<tr><td>${esc(E.AK[k].label)} ${hb(k)}${E.SCEN.some(s => E.hasPerYear(cur.scen[s], k)) ? ' <span class="tag imp">per-year values set</span>' : ''}</td>${E.SCEN.map(s => `<td>${ain(s, k, 0)} ${srcTag(cur.scen[s], k)}</td>`).join('')}<td class="cx-note">${esc(anchorText(k, anc))}${E.MULT_KEYS.includes(k) && isNum(anc.cur[k]) ? ` <button class="btn tiny" data-sim-hold="${k}">Use today's in all</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>`;
    }
    const s = ui.scen, A = cur.scen[s];
    return `${scenTabs(s)}<div class="tbl-wrap"><table class="fin sim-at"><thead><tr><th>${esc(s)} assumption</th><th>All years</th>${Array.from({ length: n }, (_, i) => `<th>Y${i + 1}</th>`).join('')}<th>Source</th><th></th></tr></thead><tbody>
      ${keys.map(k => `<tr><td>${esc(E.AK[k].label)} ${hb(k)}<div class="cx-note">${esc(anchorText(k, anc))}</div></td><td>${ain(s, k, 0)}</td>${Array.from({ length: n }, (_, i) => `<td>${ain(s, k, i + 1)}</td>`).join('')}<td>${srcTag(A, k)}${A.prev && A.prev[k] ? ` <button class="btn tiny" data-sim-undo="${s}|${k}">Undo import</button>` : ''}</td><td><button class="btn tiny" data-sim-fade="${s}|${k}" title="Straight line from the year-1 value to the year-${n} value">Fade</button> <button class="btn tiny" data-sim-clear="${s}|${k}">Clear years</button></td></tr>`).join('')}
      </tbody></table></div><p class="footnote">An empty year uses the "All years" value (shown in grey). To fade, enter year 1 and year ${n}, then press Fade.</p>`;
  }
  function pendingAssume() {
    const P = cur.pending; if (!P) return '';
    const fmtv = (it, v, py) => { const a = E.AK[it.key]; if (py && py.some(isNum)) return py.slice(0, years()).map(x => isNum(x) ? plain(fmtU(x, a.unit)) : '·').join(', '); return isNum(v) ? plain(fmtU(v, a.unit)) : '—'; };
    return panel(`Review proposed assumptions: ${esc(P.source)}`, `<p class="footnote">${esc(P.note)} Nothing is applied until you approve it. Values you typed are only replaced if you tick them.</p>
      <div class="tbl-wrap"><table class="fin"><thead><tr><th><input type="checkbox" id="sim-pend-all" aria-label="Select all"></th><th>Scenario</th><th>Assumption</th><th>Current</th><th>Proposed</th></tr></thead><tbody>${P.items.map(it => `<tr><td><input type="checkbox" data-sim-pick="${it.id}" ${it.manual ? '' : 'checked'} aria-label="Apply"></td><td>${it.scen}</td><td>${esc(E.AK[it.key].label)}${it.manual ? ' <span class="tag ovr">you entered</span>' : ''}<div class="cx-note">${esc(it.note)}</div></td><td>${fmtv(it, it.fromC, it.fromPy)}</td><td>${fmtv(it, it.toC, it.toPy)}</td></tr>`).join('')}</tbody></table></div>
      <div class="btns"><button class="btn primary" data-sim-papply>Apply ticked</button><button class="btn" data-sim-pdismiss>Dismiss all</button></div>`, { cls: 'sim-pending' });
  }
  function importButtons() {
    const dl = dcfModels(), fl = fsmModels();
    return `<div class="cx-form"><button class="btn" data-sim-hist>Start from history and today's multiples</button>
      <select id="sim-dcf-src" class="plain" aria-label="DCF model">${dl.length ? dl.map(m => opt(m.id, m.name, cur.dcfLink || '')).join('') : '<option value="">No DCF models saved</option>'}</select><button class="btn" data-sim-fromdcf ${dl.length ? '' : 'disabled'}>Import DCF forecast</button>
      ${typeof FsmEngine !== 'undefined' || fl.length ? `<select id="sim-fsm-src" class="plain" aria-label="Three-statement model">${fl.length ? fl.map(m => opt(m.id, m.name || 'Three-statement model', '')).join('') : '<option value="">No three-statement models saved</option>'}</select><button class="btn" data-sim-fromfsm ${fl.length && typeof FsmEngine !== 'undefined' ? '' : 'disabled'}>Import three-statement forecast</button>` : ''}</div>`;
  }
  const perYearToggle = () => `<label class="cx-chk"><input type="checkbox" data-sset="perYear" ${cur.settings.perYear ? 'checked' : ''}> Adjust each forecast year separately ${hb('perYear')}</label>`;
  P.growth = () => {
    const { checks } = calc();
    return `<div><h1>Growth &amp; profitability assumptions</h1><p class="lead">Analyst projections, not reported figures. Every scenario has its own values; each can be one rate for all years or a path by year.</p></div>
      ${learn('P/E projection: revenue × (1 + growth)^t × net margin ÷ diluted shares = EPS. EV methods use the EBITDA or operating margin instead. The EPS growth projection skips revenue and grows EPS directly. Only the inputs of the method you choose are required; the others let you compare methods.')}
      ${panel('Fill assumptions from data or another model', importButtons() + '<p class="footnote">Each source proposes values for you to review first. History gives Base; Bear and Bull are shifted by a few points as a starting point you should replace with your own reasoning.</p>')}
      ${pendingAssume()}
      ${panel('Revenue, margins and earnings', perYearToggle() + assumeTable(['revGrowth', 'netMargin', 'ebitdaMargin', 'ebitMargin', 'fcfMargin', 'epsGrowth']))}
      ${panel('Share count, cash and debt', assumeTable(['dilution', 'cashChange', 'debtChange']) + `<div class="cx-form"><label>EPS share basis ${hb('waBasis')}<select data-sset="waBasis" class="plain">${opt('avg', 'Weighted average (start + end) ÷ 2', cur.settings.waBasis)}${opt('end', 'End of year', cur.settings.waBasis)}</select></label></div>`)}
      ${panel('Dividends', `<div class="cx-form"><label>Dividend method ${hb('dps')}<select data-sset="divMode" class="plain">${opt('none', 'No dividends', cur.settings.divMode)}${opt('payout', 'Payout ratio of EPS', cur.settings.divMode)}${opt('growth', 'Grow today\'s dividend per share', cur.settings.divMode)}</select></label></div>${cur.settings.divMode === 'none' ? '' : assumeTable([cur.settings.divMode === 'payout' ? 'payout' : 'dpsGrowth'])}`)}
      ${panel('Checks', warnList(checks.filter(x => x.page === 'growth')) || '<p class="footnote">No warnings.</p>')}
      ${notes('growth', 'growth and margins')}`;
  };
  P.multiples = () => {
    const { all, checks } = calc(); const m = cur.settings.method;
    const cards = `<div class="meth sim-meth" role="radiogroup" aria-label="Projection method">${E.METHOD_IDS.map(id => `<button role="radio" aria-checked="${id === m}" data-sim-method="${id}"><b>${esc(E.METHODS[id].label)}</b><small>${E.METHODS[id].kind === 'ev' ? 'Enterprise multiple: EV, then − debt − claims + cash' : 'Equity multiple: no debt adjustment'}</small></button>`).join('')}</div>`;
    return `<div><h1>Valuation multiples</h1><p class="lead">The multiple you assume the market will pay at the end of each year. ${hb('method')}</p></div>
      ${learn('Equity multiples (P/E, P/S, P/FCF) apply to figures that belong to shareholders and give equity value directly. Enterprise multiples (EV/EBITDA, EV/EBIT, EV/Revenue) apply to operating figures that belong to all capital providers; the simulator then subtracts projected debt and other claims and adds projected cash before dividing by shares. The two kinds are never mixed.')}
      ${panel('Projection method', cards + `<p class="footnote"><b>${esc(E.METHODS[m].label)}:</b> ${esc(E.METHODS[m].formula)}.</p>`)}
      ${panel('Future multiples', perYearToggle() + assumeTable(E.MULT_KEYS) + '<p class="footnote">Multiple expansion means a higher multiple than today; contraction a lower one. Test both on Sensitivity analysis.</p>')}
      ${panel('Checks', warnList(checks.filter(x => x.page === 'multiples')) || '<p class="footnote">No warnings.</p>')}
      ${notes('multiples', 'multiples')}`;
  };
  P.projections = () => {
    const { all } = calc(); const s = ui.scen, p = all.scen[s], st = all.st, m = cur.settings.method;
    const Y = p.years;
    const r = (label, a0, fn, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="hist">${a0}</td>${Y.map(y => `<td>${fn(y)}</td>`).join('')}</tr>`;
    const methRows = E.METHOD_IDS.map(id => r(`${esc(E.METHODS[id].short)} price${id === m ? ' (selected)' : ''}`, f.px(st.price), y => isNum(y.p[id]) ? f.px(y.p[id]) : `<span class="na" title="${esc(y.why[id] || 'Inputs missing: ' + p.methods[id].missing.join(', '))}">n/a</span>`, id === m ? 'key' : '')).join('');
    const evm = E.METHODS[m].kind === 'ev' ? m : 'ev_ebitda';
    return `<div><h1>Year-by-year stock price projections</h1><p class="lead">The first column is actual (reported); every other column is a projection.</p></div>
      ${DISC}${scenTabs(s)}
      ${panel(`${esc(s)}: projected price by year`, lineChart(E.METHOD_IDS.filter(id => p.years.some(y => isNum(y.p[id]))).slice(0, 3).sort((a, b) => (b === m) - (a === m)).map((id, i) => ({ name: E.METHODS[id].short, cls: ['sim-base', 'sim-bear', 'sim-bull'][i], pts: [{ x: 0, y: st.price }].concat(Y.map(y => ({ x: y.t, y: y.p[id] }))) })), { refs: [{ y: st.price, label: 'Today' }], label: s + ' projected price by method' }) + '<p class="footnote">Up to three methods with a price are drawn, the selected method first. The table shows all seven.</p>')}
      ${panel('Projection table', `<div class="tbl-wrap"><table class="fin sim-proj"><thead><tr><th></th><th class="hist">Actual<br><small>${esc(st.baseEnd || '')}</small></th>${Y.map(y => `<th>Year ${y.t}<br><small>${esc(y.end || '')}</small></th>`).join('')}</tr></thead><tbody>
        ${r('Revenue ($mm)', f.mm(st.rev), y => f.mm(y.rev))}${r('Revenue growth', '', y => f.pct(y.revGrowth))}
        ${r('Net income ($mm)', f.mm(st.ni), y => f.mm(y.ni))}${r('Net margin', f.pct(isNum(st.ni) && st.rev > 0 ? st.ni / st.rev : null), y => f.pct(y.netMargin))}
        ${r('EBITDA ($mm)', f.mm(st.ebitda), y => f.mm(y.ebitda))}${r('Operating income ($mm)', f.mm(st.ebit), y => f.mm(y.ebit))}${r('Free cash flow ($mm)', f.mm(st.fcf), y => f.mm(y.fcf))}
        ${r('Diluted shares, weighted avg (mm)', f.sh(st.shares), y => f.sh(y.sharesWA))}${r('Diluted shares, year end (mm)', f.sh(st.shares), y => f.sh(y.sharesEnd))}
        ${r('EPS (revenue × margin ÷ shares)', f.px(st.eps), y => f.px(y.epsPE), m === 'pe' ? 'sub' : '')}${r('EPS (EPS growth path)', f.px(st.eps), y => f.px(y.epsG), m === 'eps' ? 'sub' : '')}
        ${r('Dividend per share', f.px(st.dps), y => f.px(y.dps))}
        ${r('Cash ($mm)', f.mm(st.cash), y => f.mm(y.cash))}${r('Debt ($mm)', f.mm(st.debt), y => f.mm(y.debt))}${r('Debt + claims − cash ($mm)', f.mm(isNum(st.debt) && isNum(st.cash) ? st.debt + st.claims - st.cash : null), y => f.mm(y.netClaims))}
        ${r(`Enterprise value, ${esc(E.METHODS[evm].short)} ($mm)`, '', y => f.mm(y.ev[evm]))}${r(`Equity value, ${esc(E.METHODS[evm].short)} ($mm)`, '', y => f.mm(y.eq[evm]))}
        ${r('Future P/E', f.x(all.cur.pe), y => f.x(y.mult.pe))}${r('Future EV/EBITDA', f.x(all.cur.evEbitda), y => f.x(y.mult.evEbitda))}
        ${methRows}
        ${r('Years from price date', '0', y => y.h.toFixed(2))}
      </tbody></table></div>
      ${E.METHOD_IDS.map(id => p.methods[id].missing.length ? `<p class="footnote">${esc(E.METHODS[id].short)} needs: ${esc(p.methods[id].missing.map(k => E.AK[k] ? E.AK[k].label : E.START_LABEL[k] || k).join(', '))}.</p>` : p.methods[id].why ? `<p class="footnote">${esc(E.METHODS[id].short)}: ${esc(p.methods[id].why)}</p>` : '').join('')}`)}
      <div class="btns"><button class="btn" data-sim-csv>Download this table (CSV)</button></div>`;
  };
  P.scenarios = () => {
    const { all, checks } = calc(); const m = cur.settings.method, n = years();
    const keyRows = ['revGrowth', 'netMargin', 'ebitdaMargin', 'epsGrowth', 'dilution', E.METHODS[m].mult].filter((k, i, a) => a.indexOf(k) === i);
    const row = (l, fn, cls = '') => `<tr class="${cls}"><td>${l}</td>${E.SCEN.map(s => `<td>${fn(s)}</td>`).join('')}</tr>`;
    const fv = (s, k) => { const a = E.AK[k]; const v0 = E.at(cur.scen[s], k, 1), vn = E.at(cur.scen[s], k, n); return isNum(v0) && isNum(vn) && Math.abs(v0 - vn) > 1e-12 ? plain(fmtU(v0, a.unit)) + ' → ' + plain(fmtU(vn, a.unit)) : fmtU(vn, a.unit); };
    return `<div><h1>Bear / Base / Bull scenarios</h1><p class="lead">Each scenario has its own growth, margins, dilution and multiples. Edit them on ${link('growth', 'Growth &amp; profitability')} and ${link('multiples', 'Valuation multiples')}.</p></div>
      ${DISC}
      ${panel(`Projected price by scenario (${esc(methodLabel())})`, priceChart(all))}
      ${panel('Side by side', `<div class="tbl-wrap"><table class="fin"><thead><tr><th></th>${E.SCEN.map(s => `<th><i class="sw-dot ${SCOL[s]}"></i>${s}</th>`).join('')}</tr></thead><tbody>
        ${keyRows.map(k => row(esc(E.AK[k].label), s => fv(s, k))).join('')}
        ${row(`Year-${n} revenue ($mm)`, s => f.mm(all.scen[s].last.rev))}${row(`Year-${n} EPS`, s => f.px(m === 'eps' ? all.scen[s].last.epsG : all.scen[s].last.epsPE))}${row(`Year-${n} shares (mm)`, s => f.sh(all.scen[s].last.sharesEnd))}
        ${row(`Year-${n} price`, s => f.px(all.scen[s].sel.price), 'key')}${row('Upside', s => f.up(all.scen[s].sel.returns.upside))}${row('Annualized return', s => f.pct(all.scen[s].sel.returns.cagr))}
        ${E.METHOD_IDS.filter(id => id !== m).map(id => row(`${esc(E.METHODS[id].short)} price (for comparison)`, s => f.px(all.scen[s].methods[id].price), 'sub')).join('')}
        <tr><td>Probability ${hb('weights')}</td>${E.SCEN.map(s => `<td><span class="cx-in sim-a"><input data-sweight="${s}" value="${fmtIn(cur.settings.weights[s], 'pct')}" inputmode="decimal" aria-label="${s} probability"><span class="unit">%</span></span></td>`).join('')}</tr>
      </tbody></table></div><p><b>Probability-weighted year-${n} price: ${f.px(all.weighted)}</b> ${all.weighted === null ? esc(all.weightedNote) : ''}</p>`)}
      ${panel('Scenario rationale', `<div class="cx-why">${E.SCEN.map(s => `<label>${s}: what has to happen?<textarea data-srat="${s}" rows="4" placeholder="The business story behind these numbers">${esc(cur.rationale[s] || '')}</textarea></label>`).join('')}</div>`)}
      ${panel('Checks', warnList(checks.filter(x => x.page === 'scenarios' || x.page === 'projections')) || '<p class="footnote">No warnings.</p>')}`;
  };
  // ---------- sensitivity ----------
  function sensCfg(id, defC, defS) { const o = cur.sens[id] || {}; return { c: isNum(o.c) ? o.c : defC, s: isNum(o.s) && o.s > 0 ? o.s : defS }; }
  function sensTable(id, title, rowKey, colKey, method, help) {
    const s = ui.sensScen, n = years();
    const rc = E.finalValue(cur, s, rowKey), cc = E.finalValue(cur, s, colKey);
    const ru = E.AK[rowKey].unit, cu = E.AK[colKey].unit;
    const defStep = (k, v) => E.AK[k].unit === 'x' ? Math.max(0.5, Math.round((isNum(v) ? v : 10) * 0.15 * 2) / 2) : ({ revGrowth: 0.02, epsGrowth: 0.025, netMargin: 0.01, ebitdaMargin: 0.02, dilution: 0.01 }[k] || 0.01);
    const R = sensCfg(id + 'r', rc, defStep(rowKey, rc)), C = sensCfg(id + 'c', cc, defStep(colKey, cc));
    if (!isNum(R.c) || !isNum(C.c)) return panel(title, `<p class="footnote">Enter the ${esc(E.AK[rowKey].label.toLowerCase())} and ${esc(E.AK[colKey].label.toLowerCase())} for the ${s} scenario first.</p>`, { help });
    const rows = E.axis(R.c, R.s), cols = E.axis(C.c, C.s);
    const g = E.grid(cur, s, rowKey, rows, colKey, cols, method);
    const P0 = calc().all.st.price, today = calc().all.cur[colKey];
    const last = calc().all.scen[s].last;
    const rowLab = v => rowKey === 'ebitdaMargin' && isNum(last.rev) ? `${plain(f.pct(v))}<br><small>EBITDA ${plain(f.mm(last.rev * v))}</small>` : plain(fmtU(v, ru));
    const colLab = v => `${plain(fmtU(v, cu))}${isNum(today) && cu === 'x' ? `<br><small>${v >= today ? '+' : '−'}${Math.abs(v - today).toFixed(1)}× vs today</small>` : ''}`;
    const ctl = `<div class="cx-form sim-sctl"><label>${esc(E.AK[rowKey].label)} centre<span class="cx-in"><input data-ssens="${id}r|c" data-unit="${ru}" value="${fmtIn(R.c, ru)}"></span></label><label>step<span class="cx-in"><input data-ssens="${id}r|s" data-unit="${ru}" value="${fmtIn(R.s, ru)}"></span></label><label>${esc(E.AK[colKey].label)} centre<span class="cx-in"><input data-ssens="${id}c|c" data-unit="${cu}" value="${fmtIn(C.c, cu)}"></span></label><label>step<span class="cx-in"><input data-ssens="${id}c|s" data-unit="${cu}" value="${fmtIn(C.s, cu)}"></span></label></div>`;
    return panel(title, `${ctl}<div class="tbl-wrap"><table class="sens"><thead><tr><th class="corner">${esc(E.AK[rowKey].label)} ↓ · ${esc(E.AK[colKey].label)} →</th>${cols.map(c => `<th class="c">${colLab(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr><th class="c">${rowLab(r)}</th>${g[i].map((v, j) => `<td class="${i === 2 && j === 2 ? 'mid' : isNum(v) && isNum(P0) && v >= P0 ? 'above' : ''}" title="${isNum(v) && isNum(P0) ? (v / P0 - 1 >= 0 ? '+' : '') + ((v / P0 - 1) * 100).toFixed(1) + '% vs today' : ''}">${isNum(v) ? plain(f.px(v)) : '<span class="na">n/a</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="footnote">Year-${n} price, ${esc(E.METHODS[method].label)}, ${s} scenario. Each cell replaces both assumptions for every year (per-year values for them are ignored); everything else is held. Shaded cells are at or above today's price (${plain(f.px(P0))}).</p>`, { help });
  }
  P.sensitivity = () => {
    const s = ui.sensScen, n = years();
    const dl = (() => {
      const base = E.finalValue(cur, s, 'dilution'); const C = sensCfg('dil', isNum(base) ? base : 0, 0.01);
      const rows = E.axis(C.c, C.s, 3); const ms = ['pe', 'eps', 'ev_ebitda', 'ev_ebit', 'ev_rev', 'ps', 'pfcf'];
      const g = E.dilutionGrid(cur, s, rows, ms);
      return panel('Share dilution versus projected stock price', `<div class="cx-form sim-sctl"><label>Dilution centre<span class="cx-in"><input data-ssens="dil|c" data-unit="pct" value="${fmtIn(C.c, 'pct')}"></span></label><label>step<span class="cx-in"><input data-ssens="dil|s" data-unit="pct" value="${fmtIn(C.s, 'pct')}"></span></label></div>
        <div class="tbl-wrap"><table class="sens"><thead><tr><th class="corner">Net share change per year ↓ · method →</th>${ms.map(m => `<th class="c">${esc(E.METHODS[m].short)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr><th class="c">${plain(f.pct(r))}<br><small>${isNum(calc().all.st.shares) ? plain(f.sh(calc().all.st.shares * Math.pow(1 + r, n))) + 'mm in Y' + n : ''}</small></th>${g[i].map(v => `<td class="${i === 3 ? 'mid' : ''}">${isNum(v) ? plain(f.px(v)) : '<span class="na">n/a</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="footnote">Negative = net buybacks. Each method keeps its own multiple and margins from the ${s} scenario.</p>`, { help: 'dilution' });
    })();
    return `<div><h1>Sensitivity analysis</h1><p class="lead">How the year-${n} price changes when two assumptions move together. Use it to test multiple expansion and contraction.</p></div>
      ${DISC}
      <div class="cx-form">${scenTabs(s, 'data-ssensscen')}</div>
      ${sensTable('rg', 'Revenue growth versus future P/E', 'revGrowth', 'pe', 'pe', 'revGrowth')}
      ${sensTable('eg', 'EPS growth versus future P/E', 'epsGrowth', 'pe', 'eps', 'epsGrowth')}
      ${sensTable('nm', 'Net profit margin versus future P/E', 'netMargin', 'pe', 'pe', 'netMargin')}
      ${sensTable('eb', 'EBITDA versus EV/EBITDA', 'ebitdaMargin', 'evEbitda', 'ev_ebitda', 'evEbitda')}
      ${dl}`;
  };
  P.results = () => {
    const { all } = calc(); const m = cur.settings.method, n = years(), st = all.st;
    const dm = matchModel(dcfModels(), cur.dcfLink), dv = dcfValue(dm);
    const cm = matchModel(compsModels(), cur.compsLink), cv = compsValue(cm);
    const r = cur.settings.reqReturn;
    const rows = E.SCEN.map(s => { const p = all.scen[s], R = p.sel.returns; return `<tr><td><i class="sw-dot ${SCOL[s]}"></i>${s}</td><td>${f.px(R.price)}</td><td>${f.up(R.upside)}</td><td>${f.pct(R.cagr)}</td><td>${f.px(R.divs)}</td><td>${f.pct(R.total)}</td><td>${f.pct(R.irr)}</td><td>${f.px(E.presentValue(p, m, r))}</td></tr>`; }).join('');
    const methTable = `<table class="fin"><thead><tr><th>Method (${esc(cur.settings.active)})</th><th>Year-${n} price</th><th>Upside</th><th>Annualized</th><th>Value today at required return</th></tr></thead><tbody>${E.METHOD_IDS.map(id => { const p = all.scen[cur.settings.active], R = p.methods[id].returns; return `<tr class="${id === m ? 'key' : ''}"><td>${esc(E.METHODS[id].label)}</td><td>${f.px(R.price)}</td><td>${f.up(R.upside)}</td><td>${f.pct(R.cagr)}</td><td>${f.px(E.presentValue(p, id, r))}</td></tr>`; }).join('')}</tbody></table>`;
    const base = all.scen.Base;
    const cmp = `<table class="fin"><thead><tr><th>Measure</th><th>Value per share</th><th>Date it refers to</th><th>vs current price</th></tr></thead><tbody>
      <tr><td>Current market price</td><td>${f.px(st.price)}</td><td>${esc(cur.company.priceDate || '—')}</td><td>—</td></tr>
      <tr><td>DCF intrinsic value${dv ? ` (“${esc(dv.name)}”${dv.complete ? '' : ', incomplete'})` : ''}</td><td>${dv ? f.px(isNum(dv.weighted) ? dv.weighted : dv.scen.Base) : NA}</td><td>Today${dv && dv.date ? ' (' + esc(dv.date) + ')' : ''}</td><td>${dv && isNum(st.price) ? f.up((isNum(dv.weighted) ? dv.weighted : dv.scen.Base) / st.price - 1) : NA}</td></tr>
      <tr><td>Trading Comps implied value${cv ? ` (“${esc(cv.name)}”, ${esc(cv.label || '')})` : ''}</td><td>${cv ? f.px(cv.perShare) : NA}</td><td>Today${cv && cv.date ? ' (' + esc(cv.date) + ')' : ''}</td><td>${cv && isNum(st.price) && isNum(cv.perShare) ? f.up(cv.perShare / st.price - 1) : NA}</td></tr>
      <tr><td>Simulator Base, value today at ${isNum(r) ? plain(f.pct(r)) : 'your required return'}</td><td>${f.px(E.presentValue(base, m, r))}</td><td>Today (discounted)</td><td>${isNum(E.presentValue(base, m, r)) && isNum(st.price) ? f.up(E.presentValue(base, m, r) / st.price - 1) : NA}</td></tr>
      <tr class="key"><td>Simulator Base, projected year-${n} price</td><td>${f.px(base.sel.price)}</td><td>${esc(base.last.end || 'year ' + n)} (future)</td><td>${f.up(base.sel.returns.upside)}</td></tr>
      <tr><td>Simulator probability-weighted year-${n} price</td><td>${f.px(all.weighted)}</td><td>future</td><td>${isNum(all.weighted) && isNum(st.price) ? f.up(all.weighted / st.price - 1) : NA}</td></tr></tbody></table>
      <p class="footnote">These methods answer different questions and are not forced to agree. The DCF and Trading Comps estimate a value <b>today</b>; the simulator projects a <b>future</b> price under assumed multiples. Discount the projected price at your required return to compare it with today's values. ${dv && isNum(dv.price) && isNum(st.price) && Math.abs(dv.price / st.price - 1) > 0.001 ? `The DCF uses a price of ${plain(f.px(dv.price))}; this simulation uses ${plain(f.px(st.price))}.` : ''}</p>
      <div class="cx-form"><label>DCF model<select data-slink="dcfLink" class="plain"><option value="">Match by ticker</option>${dcfModels().map(x => opt(x.id, x.name, cur.dcfLink || '')).join('')}</select></label><label>Trading Comps model<select data-slink="compsLink" class="plain"><option value="">Match by ticker</option>${compsModels().map(x => opt(x.id, x.name, cur.compsLink || '')).join('')}</select></label></div>`;
    return `<div><h1>Results &amp; expected returns</h1><p class="lead">What an investor buying at today's price would earn if the projection came true.</p></div>
      ${DISC}
      ${panel('Returns by scenario', `<div class="cx-form"><label><span>Required annual return ${hb('reqReturn')}</span><span class="cx-in sim-a"><input data-sreq value="${fmtIn(r, 'pct')}" inputmode="decimal" placeholder="e.g. 9" aria-label="Required return"><span class="unit">%</span></span></label>${dv && isNum(dv.ke) ? `<button class="btn tiny" data-sim-useke="${dv.ke}">Use the DCF cost of equity (${plain(f.pct(dv.ke))})</button>` : ''}</div>
        <div class="tbl-wrap"><table class="fin"><thead><tr><th>Scenario</th><th>Year-${n} price</th><th>Price return</th><th>Annualized price return ${hb('returns')}</th><th>Dividends received</th><th>Total return</th><th>IRR incl. dividends</th><th>Value today</th></tr></thead><tbody>${rows}<tr class="total"><td>Probability-weighted</td><td>${f.px(all.weighted)}</td><td>${isNum(all.weighted) && isNum(st.price) ? f.up(all.weighted / st.price - 1) : NA}</td><td colspan="5"></td></tr></tbody></table></div>`)}
      ${panel('All methods', methTable)}
      ${panel('Compare with DCF, Trading Comps and the market', cmp)}
      ${panel('Conclusion', `<textarea data-sconc rows="5" placeholder="What does the simulation tell you? Which assumptions matter most? What would change your mind?">${esc(cur.conclusion || '')}</textarea>`)}`;
  };
  P.reverse = () => {
    const R = cur.reverse, s = R.scen || 'Base', n = isNum(R.year) ? R.year : years();
    const res = isNum(R.target) ? E.reverse(cur, s, R.target, n) : null;
    const unitOf = k => k === 'eps' ? 'ps' : k === 'ebitda' ? 'mm' : E.AK[k] ? E.AK[k].unit : 'mm';
    const cur0 = res ? { eps: cur.settings.method === 'eps' ? res.y.epsG : res.y.epsPE, pe: res.y.mult.pe, netMargin: res.y.netMargin, revGrowth: E.at(cur.scen[s], 'revGrowth', 1), epsGrowth: E.at(cur.scen[s], 'epsGrowth', 1), ebitda: res.y.ebitda, evEbitda: res.y.mult.evEbitda } : {};
    return `<div><h1>Reverse projection</h1><p class="lead">Enter a future stock price. The simulator solves for what each assumption would need to be, changing one at a time. ${hb('reverse')}</p></div>
      ${panel('Target', `<div class="cx-form"><label>Target price<span class="cx-in"><input data-srev="target" value="${fmtIn(R.target, 'ps')}" inputmode="decimal" placeholder="e.g. 400" aria-label="Target price"></span></label><label>In year<select data-srev="year" class="plain">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => opt(y, 'Year ' + y, n)).join('')}</select></label><label>Hold the other assumptions at<select data-srev="scen" class="plain">${E.SCEN.map(x => opt(x, x + ' scenario', s)).join('')}</select></label></div>`)}
      ${res ? (res.error ? `<div class="notice bad">${esc(res.error)}</div>` : panel('Required assumptions', `<p><b>Held constant:</b> ${esc(res.held)}</p>
        <div class="tbl-wrap"><table class="fin"><thead><tr><th>To reach ${plain(f.px(R.target))} in year ${n}, you need</th><th>Required</th><th>${esc(s)} value</th><th>Held at</th><th>Check: price with it</th></tr></thead><tbody>${res.items.map(it => `<tr><td>${esc(it.label)}${it.note ? `<div class="cx-note">${esc(it.note)}</div>` : ''}</td><td><b>${fmtU(it.value, unitOf(it.key))}</b></td><td>${fmtU(cur0[it.key], unitOf(it.key))}</td><td class="cx-note">${esc(it.held.join(' · '))}</td><td>${it.key === 'eps' ? (isNum(it.value) && isNum(res.y.mult.pe) ? f.px(it.value * res.y.mult.pe) : NA) : f.px(it.check)}</td></tr>`).join('')}</tbody></table></div>
        <p class="footnote">Reaching ${plain(f.px(R.target))} from today's ${plain(f.px(calc().all.st.price))} is a price return of ${plain(f.pct(res.cagr))} a year. The check column re-runs the forward projection with the solved value; it should equal the target.</p>`)) : '<p class="footnote">Enter a target price to start.</p>'}`;
  };
  P.saved = () => {
    const { comp } = calc();
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated));
    return `<div><h1>Saved simulations</h1><p class="lead">Simulations are saved in this browser, separately from DCF, Trading Comps and Three-Statement models. Each keeps its company data and sources, assumptions, scenarios, dates and change log.</p></div>
      ${panel('This simulation', `<div class="cx-form"><label>Name<span class="inwrap"><input type="text" class="txt" data-srename value="${esc(cur.name)}"></span></label><label class="cx-chk"><input type="checkbox" data-slearn ${cur.ui.learn ? 'checked' : ''}> Show "How this works" notes</label></div>
        <p class="footnote">Created ${esc(cur.created.slice(0, 10))} · updated ${esc(cur.updated.slice(0, 16).replace('T', ' '))} · ${cur.savedAt ? 'saved ' + esc(cur.savedAt.slice(0, 16).replace('T', ' ')) : 'not saved yet'} · data: ${esc((cur.company.imports || []).map(i => i.provider + ' ' + String(i.at).slice(0, 10)).join(', ') || 'none imported')}</p>
        <div class="btns"><button class="btn primary" id="sim-save2">Save</button><button class="btn" data-sim-export="json">Save simulation file</button><label class="btn">Open simulation file<input type="file" id="sim-open-file" accept=".json" hidden></label><button class="btn" data-sim-dup="${cur.id}">Duplicate</button></div>`)}
      ${panel('Completion', comp.sections.map(s => `<h3>${esc(s.title)} ${pill(s.status === 'complete' ? 'good' : s.status === 'progress' ? 'warn' : 'bad', s.done + '/' + s.total)}</h3><ul class="cx-check">${s.items.map(i => `<li class="${i.ok ? 'ok' : ''}">${i.ok ? '✓' : '○'} ${link(i.page, esc(i.text))}</li>`).join('')}</ul>`).join(''))}
      ${panel('All simulations', list.length ? `<table class="fin"><thead><tr><th>Name</th><th>Company</th><th>Method</th><th>Updated</th><th></th></tr></thead><tbody>${list.map(m => `<tr ${m.id === cur.id ? 'class="key"' : ''}><td>${esc(m.name)}</td><td>${esc(m.company.ticker || m.company.name || '—')}</td><td>${esc(E.METHODS[m.settings.method] ? E.METHODS[m.settings.method].short : '')}</td><td>${esc(m.updated.slice(0, 10))}</td><td>${m.id === cur.id ? 'open' : `<button class="btn tiny" data-sim-open="${m.id}">Open</button>`} <button class="btn tiny" data-sim-dup="${m.id}">Duplicate</button> ${confirm && confirm.del === m.id ? `<button class="btn tiny danger" data-sim-del2="${m.id}">Confirm delete</button> <button class="btn tiny" data-sim-cancel>Cancel</button>` : `<button class="btn tiny" data-sim-del="${m.id}">Delete</button>`}</td></tr>`).join('')}</tbody></table>` : '<p class="footnote">Nothing saved yet. Press Save Simulation.</p>')}
      ${panel('Change log', cur.log.length ? `<ul class="footnote" style="padding-left:18px">${cur.log.slice(0, 40).map(l => `<li>${esc(new Date(l.at).toLocaleString())}: ${esc(l.field)}${l.to !== null && l.to !== undefined ? ' → ' + esc(typeof l.to === 'object' ? JSON.stringify(l.to) : l.to) : ''}</li>`).join('')}</ul>` : '<p class="footnote">No changes yet.</p>')}`;
  };

  // ---------- drawer and modal ----------
  function renderDrawer() {
    const root = $('#drawer-root');
    if (!drawer) { if (root.dataset.owner === 'sim') root.innerHTML = ''; return; }
    root.dataset.owner = 'sim'; let h = '';
    if (drawer.type === 'help') {
      const g = H.G[drawer.key]; if (!g) { drawer = null; root.innerHTML = ''; return; }
      const sec = H.ORDER.map(([title, k], i) => {
        let body = g[k]; if (!body || body === '—') return '';
        if (k === 'mistakes') body = `<ul>${g.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
        else if (k === 'src') body = `<ul>${g.src.map(s => H.S[s]).filter(Boolean).map(s => `<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a> <span class="tag">${s[2] === 'direct' ? 'data' : s[2] === 'raw' ? 'search' : 'method'}</span></li>`).join('')}</ul>`;
        else if (k === 'calc' && g.formula) body = `<p class="formula"><b>${esc(g.formula)}</b></p><p>${esc(body)}</p>`;
        else body = `<p>${esc(body)}</p>`;
        const open = k === 'research' ? !!ui.open['sh' + i] : (i < 4 || ui.open['sh' + i]);
        return `<details ${open ? 'open' : ''} data-k="sh${i}"><summary>${i + 1}. ${title}${k === 'research' ? ' (optional)' : ''}</summary>${body}</details>`;
      }).join('');
      h = `<h2 id="sim-dr-title">${esc(g.t)}</h2><div class="cx-guide">${sec}<details ${cur.notes['g-' + drawer.key] ? 'open' : ''}><summary>My research notes</summary><textarea data-snote="g-${esc(drawer.key)}" rows="4" placeholder="Saved with this simulation.">${esc(cur.notes['g-' + drawer.key] || '')}</textarea></details></div>`;
    } else {
      const r = cur.company.v[drawer.key]; if (!r) { drawer = null; root.innerHTML = ''; return; }
      const s = r.src || {};
      const dl = [['Value', isNum(r.v) ? r.v.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + (s.unit || '') : 'missing'], ['Kind', (CAT[s.cat] || ['', s.cat])[1]], ['Provider', s.provider], ['Original reported amount', isNum(s.orig) ? s.orig.toLocaleString('en-US') + ' ' + (s.origUnit || '') : null], ['Period', s.period], ['Form', s.form ? s.form + (s.accn ? ' · ' + s.accn : '') : null], ['Filed', s.filed], ['Market observation date', s.asOf], ['XBRL concept', s.concept], ['Method', s.method], ['Definition', s.definition], ['Imported', s.retrieved]].filter(x => x[1] !== null && x[1] !== undefined && x[1] !== '');
      h = `<h2 id="sim-dr-title">${esc(COMPANY_LABEL[drawer.key] || D.label(drawer.key))}</h2><dl>${dl.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${s.url ? `<p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open the source</a></p>` : ''}
        ${r.hist && r.hist.length ? `<h3>History</h3><ul>${r.hist.slice().reverse().map(x => `<li>${isNum(x.v) ? x.v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : 'missing'} · ${esc((x.src && x.src.provider) || '')} · ${esc(x.why || '')} ${esc(String(x.at || '').slice(0, 10))}</li>`).join('')}</ul>${s.cat === 'manual' && r.hist.some(x => x.src && x.src.cat !== 'manual') ? `<button class="btn" data-srestore="${drawer.key}">Restore the imported figure</button>` : ''}` : ''}`;
    }
    root.innerHTML = `<div class="scrim" data-sim-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="sim-dr-title"><button class="btn close" data-sim-close aria-label="Close">Close</button>${h}</aside>`;
    const cl = root.querySelector('.close'); if (cl) cl.focus();
  }
  function renderModal() {
    const root = $('#modal-root');
    if (!modal) { if (root.dataset.owner === 'sim') root.innerHTML = ''; return; }
    root.dataset.owner = 'sim';
    root.innerHTML = `<div class="scrim mscrim" data-sim-close-modal></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="sim-md-title"><button class="btn close" data-sim-close-modal aria-label="Close">Close</button>
      <h2 id="sim-md-title">Data source</h2><p class="footnote">Ticker import uses Financial Modeling Prep, with the same key as the DCF calculator and Trading Comps. A free key allows about 250 requests a day; one import uses about 9.</p>
      <label>API key <span class="inwrap"><input type="password" id="sim-key" value="${esc(fmpKey() || '')}" autocomplete="off"></span></label>
      <label class="cx-chk"><input type="checkbox" id="sim-key-rem" ${dataCfg().remember ? 'checked' : ''}> Remember the key on this computer</label>
      <div class="btns"><button class="btn primary" data-sim-key-save>Save</button><a class="footnote" href="${esc(D.FMP_HOME)}" target="_blank" rel="noopener">Get a key</a></div><hr>
      <p class="footnote"><b>Without a key:</b> load the SEC company facts file on Company &amp; starting financials and enter the price yourself.</p></div>`;
  }

  // ---------- render ----------
  function render() {
    if (!active()) return;
    if (!booted) boot();
    cache = null;
    ['drawer-root', 'modal-root'].forEach(id => { const r = document.getElementById(id); if (r && r.dataset.owner && r.dataset.owner !== 'sim') { r.innerHTML = ''; r.dataset.owner = 'sim'; } });
    const act = document.activeElement && document.activeElement.id;
    document.body.dataset.page = 'sim-' + page();
    renderTop(); renderRail();
    $('#main').innerHTML = `<div class="page cx-page sim-page">${P[page()]()}</div>`;
    renderDrawer(); renderModal();
    document.title = (cur.company.name ? cur.company.name + ' · ' : '') + 'Stock Price Simulator · DCF Pro';
    if (act) { const el = document.getElementById(act); if (el && el.tagName !== 'BUTTON') el.focus({ preventScroll: true }); }
  }
  function boot() {
    booted = true; models = M.loadAll();
    const id = M.getCurrent();
    cur = (id && models[id]) || Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated))[0] || M.blank();
  }

  // ---------- imports ----------
  function friendly(e) { const m = (e && e.message) || String(e); if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach Financial Modeling Prep. Check the connection, or load the SEC company facts file instead.'; return m; }
  async function importTicker(sym) {
    sym = String(sym || '').trim().toUpperCase(); if (!sym) return;
    const key = fmpKey(); if (!key) { modal = 'data'; render(); return; }
    const c = cur.company;
    if (c.ticker && c.ticker.toUpperCase() !== sym && Object.keys(c.v).length) { msg = { level: 'bad', text: `This simulation is for ${c.ticker}. Start a new simulation to project ${sym}, so these figures and assumptions are not mixed.` }; if (page() !== 'company') location.hash = 'sim/company'; else render(); return; }
    busy = `Importing ${sym} from Financial Modeling Prep…`; msg = null; if (page() !== 'company') location.hash = 'sim/company'; render();
    try { const imp = await D.fetchFMP(sym, key); const r = M.importFMP(cur, imp); if (!cur.company.ticker) cur.company.ticker = sym; if (cur.name === 'New simulation') cur.name = sym + ' simulation'; change('imported ' + sym, null, imp.provider); msg = { level: r.res.pending ? '' : 'good', text: `${sym}: ${r.res.filled} figure(s) filled${r.res.pending ? `, ${r.res.pending} difference(s) waiting for your review` : ''}.${imp.notes.length ? ' ' + imp.notes.slice(0, 2).join(' ') : ''}` }; }
    catch (e) { msg = { level: 'bad', text: friendly(e) }; }
    busy = null; render();
  }
  async function loadSec(el) {
    const files = Array.from(el.files || []); if (!files.length) return;
    const jsons = [];
    for (const fl of files) { try { jsons.push(JSON.parse(await fl.text())); } catch (e) { msg = { level: 'bad', text: fl.name + ' is not a JSON file.' }; render(); return; } }
    let facts = null, subs = null;
    jsons.forEach(j => { if (j.facts && j.facts.facts) { facts = j.facts; subs = j.subs || subs; } else if (j.facts) facts = j; else if (j.filings) subs = j; });
    if (!facts) { msg = { level: 'bad', text: 'No SEC company facts file found among the selected files.' }; render(); return; }
    const c = cur.company;
    if (c.cik && String(c.cik).replace(/^0+/, '') !== String(facts.cik).replace(/^0+/, '') && Object.keys(c.v).length) { msg = { level: 'bad', text: `That file is for ${facts.entityName}, but this simulation is for ${c.name || c.ticker}. Start a new simulation for another company.` }; render(); return; }
    try { const r = M.importSEC(cur, facts, subs); if (cur.name === 'New simulation' && cur.company.ticker) cur.name = cur.company.ticker + ' simulation'; change('loaded SEC file', null, facts.entityName); msg = { level: 'good', text: `${facts.entityName}: ${r.res.filled} figure(s) filled${r.res.pending ? `, ${r.res.pending} difference(s) waiting for your review` : ''}, ${r.hist} fiscal years of history. SEC files have no share price: enter it with its date.` }; }
    catch (e) { msg = { level: 'bad', text: e.message }; }
    render();
  }
  function copyFrom(v) {
    if (!v) return; const [kind, id] = v.split(':');
    let imp = null, name = '';
    if (kind === 'dcf') { const m = dcfModels().find(x => x.id === id); if (!m) return; imp = D.fromDCF(m); name = m.name; }
    else { const m = compsModels().find(x => x.id === id); if (!m) return; const t = m.target; name = m.name; imp = { provider: 'Trading Comps target in "' + m.name + '"', retrieved: new Date().toISOString(), info: { name: t.name, ticker: t.ticker, cik: t.cik, exchange: t.exchange, industry: t.industry, currency: t.currency, fyEnd: t.fyEnd }, values: Object.fromEntries(Object.entries(t.v || {}).filter(([, r]) => r && isNum(r.v)).map(([k, r]) => [k, { v: r.v, src: r.src }])), refs: t.ref || {}, notes: [], priceDate: t.priceDate || null }; }
    const c = cur.company;
    if (c.ticker && imp.info.ticker && c.ticker.toUpperCase() !== imp.info.ticker.toUpperCase() && Object.keys(c.v).length) { msg = { level: 'bad', text: `That model is for ${imp.info.ticker}; this simulation is for ${c.ticker}.` }; render(); return; }
    const res = D.applyImport(c, imp); if (imp.priceDate && !c.priceDate) c.priceDate = imp.priceDate;
    if (kind === 'dcf') cur.dcfLink = id; else cur.compsLink = id;
    change('copied company data', null, name); msg = { level: 'good', text: `From "${name}": ${res.filled} figure(s) filled${res.pending ? ', ' + res.pending + ' difference(s) for review' : ''}. That model was not changed.` }; render();
  }
  async function search(q) {
    ui.search.q = q; if (!q || !fmpKey()) { ui.search.results = []; renderResults(); return; }
    ui.search.busy = true; ui.search.error = null; renderResults();
    try { ui.search.results = await DCFData.searchFMP(q, fmpKey()); } catch (e) { ui.search.error = friendly(e); ui.search.results = []; }
    ui.search.busy = false; renderResults();
  }
  let searchT = null;
  const safeName = s => (s || 'simulation').replace(/[^\w\- .()]+/g, '').trim().slice(0, 60) || 'simulation';
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  function csv() {
    const { all } = calc(); const p = all.scen[ui.scen], st = all.st;
    const head = ['Line', 'Actual ' + (st.baseEnd || '')].concat(p.years.map(y => 'Year ' + y.t + (y.end ? ' ' + y.end : '')));
    const L = [['Revenue ($mm)', st.rev, y => y.rev], ['Revenue growth', null, y => y.revGrowth], ['Net income ($mm)', st.ni, y => y.ni], ['EBITDA ($mm)', st.ebitda, y => y.ebitda], ['EBIT ($mm)', st.ebit, y => y.ebit], ['FCF ($mm)', st.fcf, y => y.fcf], ['Diluted shares WA (mm)', st.shares, y => y.sharesWA], ['Diluted shares end (mm)', st.shares, y => y.sharesEnd], ['EPS (P/E path)', st.eps, y => y.epsPE], ['EPS (growth path)', st.eps, y => y.epsG], ['DPS', st.dps, y => y.dps], ['Cash ($mm)', st.cash, y => y.cash], ['Debt ($mm)', st.debt, y => y.debt]].concat(E.METHOD_IDS.map(id => [E.METHODS[id].short + ' price', st.price, y => y.p[id]]));
    const cell = v => isNum(v) ? String(+v.toFixed(6)) : '';
    const rows = [head].concat(L.map(([l, a, fn]) => [l, cell(a)].concat(p.years.map(y => cell(fn(y))))));
    rows.unshift(['Hypothetical projection: not a forecast or guarantee of the market price. Scenario ' + ui.scen + ', ' + (cur.company.name || '')]);
    download(new Blob([rows.map(r => r.map(x => /[",\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(',')).join('\n')], { type: 'text/csv' }), safeName(cur.name) + ' ' + ui.scen + ' projection.csv');
  }

  // ---------- events ----------
  document.addEventListener('change', e => {
    if (!active()) return;
    const el = e.target, d = el.dataset;
    if (d.sv) {
      const p = parse(el.value, d.unit === 'pct' ? 'pct' : 'num');
      if (p.error) { errs[el.id] = { text: el.value, msg: p.error }; render(); return; }
      if (p.v !== null && ['shares', 'price'].includes(d.sv) && p.v <= 0) { errs[el.id] = { text: el.value, msg: 'Must be above zero.' }; render(); return; }
      delete errs[el.id];
      const c = cur.company, from = c.v[d.sv] ? c.v[d.sv].v : null; if (from === p.v) return;
      D.setManual(c, d.sv, p.v, 'Entered on the simulator');
      if (d.sv === 'price' && p.v !== null && !c.priceDate) c.priceDate = new Date().toISOString().slice(0, 10);
      change(COMPANY_LABEL[d.sv] || D.label(d.sv), from, p.v); render(); return;
    }
    if (d.sa) {
      const [s, key, t] = d.sa.split('|'); const p = parse(el.value, d.unit);
      if (p.error) { errs[el.id] = { text: el.value, msg: p.error }; render(); return; }
      if (p.v !== null && E.AK[key].unit === 'x' && p.v <= 0) { errs[el.id] = { text: el.value, msg: 'A multiple must be above zero.' }; render(); return; }
      if (p.v !== null && key === 'dilution' && p.v <= -1) { errs[el.id] = { text: el.value, msg: 'The share count cannot fall by 100% or more.' }; render(); return; }
      delete errs[el.id];
      M.setAssumption(cur, s, key, p.v, +t || 0); change(`${s}: ${E.AK[key].label}${+t ? ' year ' + t : ''}`, null, p.v); render(); return;
    }
    if (d.sset) { const k = d.sset; const v = el.type === 'checkbox' ? el.checked : el.value; const from = cur.settings[k]; cur.settings[k] = v; change('setting ' + k, from, v); render(); return; }
    if (d.ssplit) { let v = el.value; if (d.ssplit === 'factor') { const p = parse(v, 'num'); if (p.error || !(p.v > 0)) { toast('Enter a split factor above zero (1 = no split).'); render(); return; } v = p.v; } cur.settings.split[d.ssplit] = v; change('split ' + d.ssplit, null, v); render(); return; }
    if (d.sdate) { cur.company.priceDate = el.value || null; change('price date', null, el.value); render(); return; }
    if (d.sweight) { const p = parse(el.value, 'pct'); if (p.error || (p.v !== null && p.v < 0)) { toast('Enter a probability of 0% or more.'); render(); return; } cur.settings.weights[d.sweight] = p.v; change('probability ' + d.sweight, null, p.v); render(); return; }
    if (d.ssens) { const [id, k] = d.ssens.split('|'); const p = parse(el.value, d.unit); if (p.error) { toast(p.error); return; } cur.sens[id] = Object.assign({}, cur.sens[id], { [k]: p.v }); persist(); render(); return; }
    if (d.srev) { if (d.srev === 'target') { const p = parse(el.value, 'num'); if (p.error) { toast(p.error); return; } cur.reverse.target = p.v; } else if (d.srev === 'year') cur.reverse.year = +el.value; else cur.reverse.scen = el.value; change('reverse ' + d.srev, null, el.value); render(); return; }
    if (d.sreq !== undefined) { const p = parse(el.value, 'pct'); if (p.error) { toast(p.error); return; } cur.settings.reqReturn = p.v; change('required return', null, p.v); render(); return; }
    if (d.slink) { cur[d.slink] = el.value || null; change(d.slink, null, el.value); render(); return; }
    if (d.srat) { cur.rationale[d.srat] = el.value; change('rationale ' + d.srat, null, '(' + el.value.length + ' characters)'); return; }
    if (d.sconc !== undefined) { cur.conclusion = el.value; change('conclusion', null, '(' + el.value.length + ' characters)'); return; }
    if (d.snote !== undefined) { cur.notes[d.snote] = el.value; change('note ' + d.snote, null, '(' + el.value.length + ' characters)'); return; }
    if (d.srename !== undefined) { cur.name = el.value.trim() || cur.name; change('renamed', null, cur.name); render(); return; }
    if (d.slearn !== undefined) { cur.ui.learn = el.checked; persist(); render(); return; }
    if (el.id === 'sim-pend-all') { document.querySelectorAll('[data-sim-pick]').forEach(x => { x.checked = el.checked; }); return; }
    if (el.id === 'sim-sec') return loadSec(el);
    if (el.id === 'sim-model') { cur = models[el.value] || cur; M.setCurrent(cur.id); drawer = null; msg = null; render(); return; }
    if (el.id === 'sim-method') { const from = cur.settings.method; cur.settings.method = el.value; change('method', from, el.value); render(); return; }
    if (el.id === 'sim-years') { const from = cur.settings.years; cur.settings.years = +el.value; change('projection years', from, +el.value); render(); return; }
    if (el.id === 'sim-open-file') { const fl = el.files[0]; if (!fl) return; fl.text().then(t => { const m = M.upgrade(JSON.parse(t)); if (m.kind !== 'sim') throw new Error('x'); if (models[m.id]) m.id = M.blank().id; cur = m; persist(); render(); toast('Opened ' + m.name); }).catch(() => toast('That file is not a Stock Price Simulator file.')); }
  });
  document.addEventListener('toggle', e => { if (!active()) return; const d = e.target; if (d && d.dataset && d.dataset.k) ui.open[d.dataset.k] = d.open; }, true);
  document.addEventListener('input', e => { if (!active()) return; if (e.target.id === 'sim-search') { const q = e.target.value.trim(); ui.search.open = true; clearTimeout(searchT); searchT = setTimeout(() => search(q), 300); } });
  document.addEventListener('focusin', e => { if (active() && e.target.id === 'sim-search') { ui.search.open = true; renderResults(); } });
  document.addEventListener('keydown', e => {
    if (!active()) return;
    if (e.key === 'Escape' && (drawer || modal)) { drawer = null; modal = null; render(); return; }
    if (e.key === 'Enter' && e.target.id === 'sim-search') { e.preventDefault(); ui.search.open = false; importTicker(e.target.value); e.target.value = ''; return; }
    if (e.key === 'Enter' && e.target.id === 'sim-tk') { e.preventDefault(); importTicker(e.target.value); }
  });
  document.addEventListener('click', e => {
    if (!active()) return;
    if (ui.search.open && !e.target.closest('.search')) { ui.search.open = false; renderResults(); }
    const b = e.target.closest('button, a'); if (!b) { if (e.target.closest('[data-sim-close],[data-sim-close-modal]')) { drawer = null; modal = null; renderDrawer(); renderModal(); } return; }
    const d = b.dataset;
    if (d.simClose !== undefined) { drawer = null; renderDrawer(); return; }
    if (d.simCloseModal !== undefined) { modal = null; renderModal(); return; }
    if (d.shelp) { drawer = { type: 'help', key: d.shelp }; renderDrawer(); return; }
    if (d.ssrc) { drawer = { type: 'src', key: d.ssrc }; renderDrawer(); return; }
    if (b.id === 'sim-menu') { $('#rail').classList.toggle('open'); return; }
    if (b.closest('#rail') && b.tagName === 'A') { $('#rail').classList.remove('open'); return; }
    if (d.simTheme) { document.documentElement.setAttribute('data-theme', d.simTheme); try { localStorage.setItem('dcfcalc.theme', d.simTheme); } catch (x) {} render(); return; }
    if (b.id === 'sim-save' || b.id === 'sim-save2') { M.log(cur, 'saved', null, null); cur.savedAt = cur.log[0].at; persist(); toast('Saved ' + cur.name); render(); return; }
    if (b.id === 'sim-new') { cur = M.blank(); persist(); drawer = null; msg = null; location.hash = 'sim/company'; render(); toast('New simulation'); return; }
    if (b.id === 'sim-data' || d.simOpenData !== undefined) { modal = 'data'; renderModal(); return; }
    if (d.simKeySave !== undefined) { saveKey((($('#sim-key') || {}).value || '').trim(), ($('#sim-key-rem') || {}).checked); modal = null; render(); toast('Data source saved.'); return; }
    if (d.simImport) { ui.search.open = false; const i = $('#sim-search'); if (i) i.value = ''; importTicker(d.simImport); return; }
    if (d.simTkimp !== undefined) { importTicker(($('#sim-tk') || {}).value); return; }
    if (d.simCopy !== undefined) { copyFrom(($('#sim-copy-src') || {}).value); return; }
    if (d.simUseref) { const c = cur.company; const prev = c.v[d.simUseref] ? c.v[d.simUseref].v : null; D.useRef(c, d.simUseref, d.simUseref); change('accepted reference ' + d.simUseref, prev, c.v[d.simUseref].v); render(); return; }
    if (d.scpend) { const [pid, act] = d.scpend.split('|'); const c = cur.company; if (!c.pending) return; const ids = pid === 'all' ? c.pending.items.filter(p => act === 'skip' || !p.manual).map(p => p.id) : [pid]; if (act === 'apply') D.applyPending(c, ids, pid !== 'all'); else D.dismissPending(c, ids); change('reviewed import', null, act); render(); return; }
    if (d.srestore) { if (D.restore(cur.company, d.srestore)) { change('restored ' + d.srestore, null, cur.company.v[d.srestore].v); render(); } return; }
    if (d.sscen) { ui.scen = d.sscen; render(); return; }
    if (d.sactive) { cur.settings.active = d.sactive; persist(); render(); return; }
    if (d.ssensscen) { ui.sensScen = d.ssensscen; render(); return; }
    if (d.simMethod) { const from = cur.settings.method; cur.settings.method = d.simMethod; change('method', from, d.simMethod); render(); return; }
    if (d.simHold) { const k = d.simHold, v = calc().all.cur[k]; if (!isNum(v)) return; const prop = { source: 'Today\'s multiple', cat: 'current', note: `Hold today's ${E.AK[k].label.replace('Future ', '')} (${v.toFixed(2)}×) in every scenario.`, scen: {} }; E.SCEN.forEach(s => { prop.scen[s] = { [k]: { c: v, note: 'Today\'s multiple' } }; }); M.propose(cur, prop); persist(); render(); return; }
    if (d.simFade) { const [s, k] = d.simFade.split('|'); const A = cur.scen[s], n = years(); const a = E.at(A, k, 1), z = E.at(A, k, n); if (!isNum(a) || !isNum(z)) { toast('Enter the year-1 and final-year values first.'); return; } A.py[k] = Array.from({ length: E.MAXY }, (_, i) => i < n ? (n === 1 ? z : a + (z - a) * i / (n - 1)) : null); A.src[k] = { cat: 'analyst', at: new Date().toISOString(), note: 'Faded' }; change(`${s}: fade ${k}`, null, null); render(); return; }
    if (d.simClear) { const [s, k] = d.simClear.split('|'); cur.scen[s].py[k] = null; change(`${s}: cleared per-year ${k}`, null, null); render(); return; }
    if (d.simUndo) { const [s, k] = d.simUndo.split('|'); if (M.undoAssumption(cur, s, k)) { change(`${s}: undo import ${k}`, null, null); render(); } return; }
    if (d.simHist !== undefined) { const n = M.propose(cur, M.historyProposal(cur)); persist(); render(); toast(n ? n + ' value(s) proposed for review.' : 'Nothing to propose: import the company first.'); return; }
    if (d.simFromdcf !== undefined) { const m = dcfModels().find(x => x.id === ($('#sim-dcf-src') || {}).value); if (!m) return; try { const n = M.propose(cur, M.dcfProposal(m, DCFModel, DCF)); cur.dcfLink = m.id; persist(); render(); toast(n ? n + ' value(s) proposed for review.' : 'The DCF forecast matches the current values.'); } catch (x) { toast('Could not read that DCF model: ' + x.message); } return; }
    if (d.simFromfsm !== undefined) { const m = fsmModels().find(x => x.id === ($('#sim-fsm-src') || {}).value); if (!m || typeof FsmEngine === 'undefined') return; try { const n = M.propose(cur, M.fsmProposal(m, typeof FsmModel !== 'undefined' ? FsmModel : {}, FsmEngine, E.start(cur))); persist(); render(); toast(n ? n + ' value(s) proposed for review.' : 'Nothing to import.'); } catch (x) { toast('Could not read that three-statement model: ' + x.message); } return; }
    if (d.simPapply !== undefined) { const ids = Array.from(document.querySelectorAll('[data-sim-pick]')).filter(x => x.checked).map(x => x.dataset.simPick); const n = M.applyPending(cur, ids, true); change('applied proposed assumptions', null, n); toast(n + ' assumption(s) applied.'); render(); return; }
    if (d.simPdismiss !== undefined) { cur.pending = null; change('dismissed proposed assumptions', null, null); render(); return; }
    if (d.simUseke) { cur.settings.reqReturn = +d.simUseke; change('required return', null, +d.simUseke); render(); return; }
    if (d.simCsv !== undefined) { csv(); return; }
    if (d.simExport === 'json') { download(new Blob([JSON.stringify(cur, null, 1)], { type: 'application/json' }), safeName(cur.name) + ' simulation.json'); return; }
    if (d.simOpen) { cur = models[d.simOpen]; M.setCurrent(cur.id); render(); return; }
    if (d.simDup) { const m = M.duplicate(models[d.simDup] || cur); cur = m; persist(); render(); toast('Duplicated as ' + m.name); return; }
    if (d.simDel) { confirm = { del: d.simDel }; render(); return; }
    if (d.simDel2) { M.remove(d.simDel2); models = M.loadAll(); if (cur.id === d.simDel2) cur = Object.values(models)[0] || M.blank(); confirm = null; render(); toast('Simulation deleted.'); return; }
    if (d.simCancel !== undefined) { confirm = null; render(); return; }
  });
  window.addEventListener('hashchange', () => {
    if (active()) { render(); $('#main').scrollTop = 0; return; }
    drawer = null; modal = null;
    ['drawer-root', 'modal-root'].forEach(id => { const r = document.getElementById(id); if (r && r.dataset.owner === 'sim') { r.innerHTML = ''; r.dataset.owner = ''; } });
  });

  return { render, active, _test: { get cur() { return cur; }, set cur(m) { cur = m; }, P, boot } };
})();
