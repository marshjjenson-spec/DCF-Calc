// ===== TRADING COMPS: USER INTERFACE =====
// A separate valuation model inside DCF Pro, reached at #comps. It has its own navigation, saved models and
// storage key; the DCF calculator is only read (for the DCF comparison and to copy company data, with review).
// No valuation formula lives here: calculations are in CompsEngine.
const CompsApp = (() => {
  const E = CompsEngine, D = CompsData, M = CompsModel, H = CompsHelp;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNum = E.isNum;
  const active = () => /^#comps(\/|$)/.test(location.hash);
  const PAGES = [
    { id: 'dashboard', title: 'Trading Comps dashboard', grp: 'Overview', icon: 'home' },
    { id: 'checklist', title: 'Model completion checklist', grp: 'Overview', icon: 'check' },
    { id: 'howto', title: 'How to use Trading Comps', grp: 'Overview', icon: 'book' },
    { id: 'target', title: 'Target company', grp: 'Company research', icon: 'building' },
    { id: 'peers', title: 'Peer selection', grp: 'Company research', icon: 'layers' },
    { id: 'peerdata', title: 'Peer financial data', grp: 'Company research', icon: 'bars' },
    { id: 'adjust', title: 'Financial adjustments', grp: 'Company research', icon: 'sliders' },
    { id: 'table', title: 'Trading comps table', grp: 'Valuation', icon: 'grid' },
    { id: 'multiple', title: 'Valuation multiple selection', grp: 'Valuation', icon: 'pct' },
    { id: 'implied', title: 'Implied valuation', grp: 'Valuation', icon: 'calc' },
    { id: 'sensitivity', title: 'Sensitivity analysis', grp: 'Valuation', icon: 'trend' },
    { id: 'summary', title: 'Valuation summary', grp: 'Results', icon: 'target' },
    { id: 'dcf', title: 'DCF comparison', grp: 'Results', icon: 'flag' },
    { id: 'sources', title: 'Sources & research notes', grp: 'Results', icon: 'list' },
    { id: 'saved', title: 'Saved Trading Comps models', grp: 'Results', icon: 'folder' },
  ];
  const ICON = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>', building: '<rect x="4" y="3" width="11" height="18"/><path d="M15 9h5v12h-5M8 7h3M8 11h3M8 15h3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', bars: '<path d="M5 20V12M10 20V8M15 20V4M20 20v-6"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>', list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>', folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
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
    x: v => !isNum(v) ? NA : v.toFixed(2) + '×',
    pct: (v, d = 1) => !isNum(v) ? NA : `<span class="${v < 0 ? 'neg' : ''}">${(v * 100).toFixed(d)}%</span>`,
    px: (v, cur) => !isNum(v) ? NA : (v < 0 ? '−' : '') + ((cur || 'USD') === 'USD' ? '$' : (cur + ' ')) + nf(2).format(Math.abs(v)),
    sh: v => !isNum(v) ? NA : nf(3).format(v),
    up: v => !isNum(v) ? NA : `<span class="pill ${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%</span>`,
  };
  const plain = s => String(s).replace(/<[^>]+>/g, '');
  const UNIT = { mm: '$mm', ps: 'per share', sh: 'mm shares', pct: '%', x: '×' };
  function fmtIn(v, unit) { if (!isNum(v)) return ''; if (unit === 'pct') return String(+(v * 100).toFixed(6)); return String(+v.toFixed(unit === 'ps' || unit === 'x' ? 4 : 6)); }
  function parse(str, unit) {
    const s = String(str).trim(); if (s === '') return { v: null };
    let t = s.replace(/[,$\s×x%]/gi, ''); let neg = false; if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { error: `"${s}" is not a number.` };
    let n = Number(t) * (neg ? -1 : 1); if (unit === 'pct') n /= 100; return { v: n };
  }
  const CAT = { sec: ['SEC', 'Reported in an SEC filing'], calc: ['Calc', 'Calculated from reported figures'], market: ['Mkt', 'Market data'], vendor: ['Vendor', 'Provider-compiled figure (vendor definition)'], estimate: ['Est', 'Analyst consensus estimate'], manual: ['Manual', 'Entered by the analyst'], dcf: ['DCF', 'Copied from a DCF model'] };

  // ---------- state ----------
  let models = {}, cur = null, booted = false;
  let drawer = null; // {type:'help', key} | {type:'src', cid, key}
  let modal = null, confirm = null, busy = null, msg = null, errs = {};
  const ui = { peer: null, filter: {}, compare: false, suggest: null, open: {}, dcfSel: null, tableP: null, search: { q: '', results: [], open: false } };

  function persist() { if (!cur) return; if (!M.save(cur)) toast('Could not save in this browser storage. Use "Save model file" on Saved Trading Comps models.'); models = M.loadAll(); M.setCurrent(cur.id); }
  function change(field, from, to) { M.log(cur, field, from, to); persist(); }
  function toast(t) { let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); } const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; box.appendChild(el); setTimeout(() => el.remove(), 3600); }
  const all = () => [cur.target].concat(cur.peers);
  const byId = id => all().find(c => c.id === id);
  const nameOf = c => c ? (c.ticker || c.name || 'Unnamed') : '';
  function page() { const m = /^#comps\/?([a-z]*)/.exec(location.hash); const id = (m && m[1]) || 'dashboard'; return PAGES.find(p => p.id === id) ? id : 'dashboard'; }
  const link = (id, text) => `<a href="#comps/${id}">${text}</a>`;
  const hb = k => H.G[k] ? `<button class="help" data-chelp="${k}" aria-label="Guide: ${esc(H.G[k].t)}">?</button>` : '';
  function dataCfg() { let c = null; try { c = JSON.parse(localStorage.getItem('dcfcalc.data')); } catch (e) {} return Object.assign({ provider: 'fmp', keys: {}, remember: true }, c || {}); }
  function saveKey(k, remember) { const c = dataCfg(); c.provider = 'fmp'; c.keys = Object.assign({}, c.keys, { fmp: k }); c.remember = remember; try { localStorage.setItem('dcfcalc.data', JSON.stringify(remember ? c : Object.assign({}, c, { keys: {} }))); } catch (e) {} memKey = k; }
  let memKey = null;
  const fmpKey = () => memKey || dataCfg().keys.fmp || null;
  function calc() {
    const comp = M.completion(cur);
    return { comp, b: comp.b, imp: comp.imp };
  }

  // ---------- small building blocks ----------
  function vin(c, key, unit, opts = {}) {
    const r = c.v[key]; const v = r && isNum(r.v) ? r.v : null; const cat = r && r.src ? r.src.cat : null;
    const id = `cx_${c.id}_${key}`;
    const err = errs[id];
    return `<span class="cx-in ${cat ? 'cx-' + cat : 'cx-none'} ${err ? 'err' : ''}"><input id="${id}" data-cv="${c.id}|${key}" data-unit="${unit}" value="${err ? esc(err.text) : fmtIn(v, unit)}" placeholder="${opts.ph || '—'}" inputmode="decimal" aria-label="${esc(nameOf(c) + ': ' + D.label(key))}">${r && r.src ? `<button class="cx-srcb" data-csrc="${c.id}|${key}" title="${esc((CAT[cat] || ['', 'Source'])[1])}: open the source and history">${(CAT[cat] || ['Src'])[0]}</button>` : ''}</span>${err ? `<div class="errmsg">${esc(err.msg)}</div>` : ''}`;
  }
  function tin(c, field, opts = {}) { return `<span class="inwrap"><input type="text" class="txt" data-cf="${c.id}|${field}" value="${esc(c[field] || '')}" placeholder="${esc(opts.ph || '')}" aria-label="${esc(opts.label || field)}"></span>`; }
  function notes(key, title) {
    const v = cur.notes[key] || '';
    const k = 'n-' + key;
    return `<details class="cx-notes" data-k="${k}" ${ui.open[k] || v ? 'open' : ''}><summary>My research notes${title ? ': ' + esc(title) : ''}${v ? ' <span class="tag src">saved</span>' : ''}</summary><textarea data-cnote="${esc(key)}" rows="3" placeholder="Optional. Why you chose this, sources, calculations, risks.">${esc(v)}</textarea></details>`;
  }
  function panel(title, body, opts = {}) { return `<section class="panel ${opts.cls || ''}">${title ? `<div class="panel-head"><h2>${title}${opts.help ? ' ' + hb(opts.help) : ''}</h2>${opts.right || ''}</div>` : ''}${body}</section>`; }
  const pill = (level, text) => `<span class="pill ${level === 'bad' ? 'bad' : level === 'warn' ? 'warn' : level === 'good' ? 'good' : 'neutral'}">${esc(text)}</span>`;
  const learn = text => cur.ui.learn ? `<div class="cx-learn"><b>How this works.</b> ${text}</div>` : '';
  function opt(v, label, sel) { return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`; }
  const multOptions = (sel, filterFn) => Object.entries(E.MULTIPLES).flatMap(([id, Mm]) => Mm.periods.map(p => [E.mid(id, p), E.multLabel(id, p)])).filter(x => !filterFn || filterFn(x[0])).map(([k, l]) => opt(k, l, sel)).join('');

  // ---------- top bar and rail ----------
  function renderTop() {
    const top = document.getElementById('topbar');
    if (top.dataset.owner !== 'comps') {
      top.dataset.owner = 'comps';
      top.innerHTML = `<div class="hdr-main">
        <button class="hbtn menu-btn" id="cx-menu" aria-label="Open sections">${icon('list')}</button>
        <div class="brand">${icon('logo', 'logo')}<div><b>DCF Pro</b><small>Financial Valuation Platform</small></div></div>
        <div class="hdr-title"><b>Trading Comps</b><small>Comparable company analysis: relative valuation from how similar public companies are priced</small></div>
        <div class="search" role="search"><label class="sr" for="cx-search">Import target by ticker</label>
          <div class="search-box">${icon('search')}<input id="cx-search" type="search" autocomplete="off" placeholder="Target ticker or name…"></div>
          <div class="search-sel" id="cx-sel"></div><div id="cx-results" class="search-results" role="listbox" hidden></div></div>
        <div class="hdr-actions">
          <button class="hbtn primary" id="cx-save">${icon('save')}<span>Save Comps Model</span></button>
          <button class="hbtn accent" id="cx-new">${icon('plus')}<span>New Comps</span></button>
          <div class="theme-toggle" role="group" aria-label="Colour theme"><button data-cx-theme="light" aria-label="Light mode">${icon('sun')}</button><button data-cx-theme="dark" aria-label="Dark mode">${icon('moon')}</button></div>
        </div></div><div class="hdr-sub" id="cx-sub"></div>`;
    }
    const theme = document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    top.querySelectorAll('[data-cx-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cxTheme === theme)));
    const t = cur.target;
    top.querySelector('#cx-sel').innerHTML = t.name || t.ticker ? `<span class="chip">${esc((t.name || '') + (t.ticker ? ' (' + t.ticker + ')' : ''))}</span>` : '<span class="chip muted">No target selected</span>';
    renderResults();
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated));
    if (!models[cur.id]) list.unshift(cur);
    const { b, imp } = calc();
    const live = isNum(imp.perShare) ? `<div><div class="lbl">Implied (${esc(b.label)})</div><div class="big">${f.px(imp.perShare, t.priceCurrency)}</div></div><div><div class="lbl">vs price ${plain(f.px(E.val(t, 'price'), t.priceCurrency))}</div><div>${f.up(imp.upside)}</div></div>`
      : `<a class="pill bad" href="#comps/checklist">Valuation incomplete</a>`;
    $('#cx-sub').innerHTML = `<div class="seg model-switch" role="group" aria-label="Valuation model"><a href="#dashboard">Discounted Cash Flow</a><a href="#comps" aria-current="true">Trading Comps</a><a href="#fsm">Three-Statement Model</a><a href="#sim">Stock Price Simulator</a></div>
      <div class="model-pick"><label for="cx-model" class="footnote">Comps model</label><select id="cx-model" class="plain">${list.map(m => opt(m.id, m.name, cur.id)).join('')}</select></div>
      <div class="model-pick"><label for="cx-group" class="footnote">Peer group</label><select id="cx-group" class="plain">${groupOptions(cur.selection.group)}</select></div>
      <button class="btn ghost" id="cx-data">${icon('db')} Data source: ${fmpKey() ? 'Financial Modeling Prep' : 'not connected'}</button>
      <div class="live">${live}</div>`;
  }
  const groupOptions = sel => [opt('core', 'Core peers', sel), opt('all', 'Core + Broader', sel)].concat(cur.groups.map(g => opt(g.id, g.name, sel))).join('');
  function renderResults() {
    const box = document.getElementById('cx-results'); if (!box) return;
    const S = ui.search;
    if (!S.open) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    let h = '';
    if (!fmpKey()) h = `<div class="sr-note">Connect Financial Modeling Prep to search and import, or load SEC company facts files on Target company.<br><button class="btn primary" data-cx-open-data>Connect a data source</button></div>`;
    else if (S.busy) h = '<div class="sr-note">Searching…</div>';
    else if (S.error) h = `<div class="sr-note bad">${esc(S.error)}</div>`;
    else if (S.results.length) h = S.results.map(r => `<button role="option" data-cx-import="${esc(r.symbol)}" data-role="target"><b>${esc(r.symbol)}</b><span>${esc(r.name)}</span><small>${esc(r.exchange)}${r.currency ? ' · ' + esc(r.currency) : ''}</small></button>`).join('');
    else if (S.q) h = `<div class="sr-note">Press Enter to import “${esc(S.q.toUpperCase())}” as the target.</div>`;
    box.innerHTML = h;
  }
  function renderRail() {
    const { comp } = calc();
    const st = { dashboard: null, target: 'target', peers: 'peers', peerdata: 'data', adjust: 'adjust', multiple: 'multiple', implied: 'valuation', summary: 'docs' };
    let h = '', grp = '';
    PAGES.forEach(p => {
      if (p.grp !== grp) { grp = p.grp; h += `<h4>${grp}</h4>`; }
      const s = st[p.id] && comp.sections.find(x => x.id === st[p.id]);
      const badge = s ? `<span class="pct ${s.status === 'complete' ? 'done' : ''}">${s.status === 'complete' ? '✓' : Math.round(s.done / s.total * 100) + '%'}</span>` : '';
      h += `<a href="#comps/${p.id}" ${page() === p.id ? 'aria-current="page"' : ''}>${icon(p.icon)}<span class="t">${p.title}</span>${badge}</a>`;
    });
    h += `<h4>Other models</h4><a href="#dashboard">${icon('calc')}<span class="t">Discounted Cash Flow</span></a><a href="#sim">${icon('trend')}<span class="t">Stock Price Simulator</span></a>`;
    $('#rail').innerHTML = h;
  }

  // ---------- company workspace (target and each peer) ----------
  const MET_ROWS = [['rev', 'mm'], ['gp', 'mm'], ['ebitda', 'mm'], ['ebit', 'mm'], ['ni', 'mm'], ['eps', 'ps'], ['capex', 'mm'], ['fcf', 'mm']];
  const MET_HELP = { rev: 'rev', gp: 'gp', ebitda: 'ebitda', ebit: 'ebit', ni: 'ni', eps: 'eps', capex: 'capex', fcf: 'fcf' };
  const PER_COLS = [['fy', 'Last FY'], ['ttm', 'TTM'], ['ntm', 'NTM'], ['fy1', 'FY+1'], ['fy2', 'FY+2']];
  const REF_USE = { eqInv: 'otherNonop', crypto: 'otherNonop', sharesMulti: 'shares', dilutive: 'dilutive' };
  function profileHtml(c) {
    const fx = E.fxOf(c);
    return `<div class="cx-form">
      <label>Company name ${tin(c, 'name', { label: 'Company name' })}</label><label>Ticker ${tin(c, 'ticker', { label: 'Ticker' })}</label>
      <label>Exchange ${tin(c, 'exchange', { label: 'Exchange' })}</label><label>Industry ${tin(c, 'industry', { label: 'Industry' })}</label>
      <label>Sector ${tin(c, 'sector', { label: 'Sector' })}</label><label>Country ${tin(c, 'country', { label: 'Country' })}</label>
      <label>Fiscal year-end (MM-DD) ${tin(c, 'fyEnd', { label: 'Fiscal year-end', ph: '12-31' })}</label>
      <label>Accounting standard <span class="inwrap"><select data-cf="${c.id}|accounting">${['US GAAP', 'IFRS', 'Other'].map(x => opt(x, x, c.accounting)).join('')}</select></span></label>
      <label>Reporting currency ${tin(c, 'currency', { label: 'Reporting currency', ph: 'USD' })}</label><label>Share price currency ${tin(c, 'priceCurrency', { label: 'Price currency', ph: 'USD' })}</label>
      ${fx.same ? '' : `<label>Exchange rate (${esc(c.priceCurrency)} per ${esc(c.currency)}) ${hb('fx')}<span class="inwrap"><input data-cfx="${c.id}|rate" value="${isNum(c.fx.rate) ? c.fx.rate : ''}" inputmode="decimal" placeholder="required"></span></label>
        <label>Rate date <span class="inwrap"><input type="date" data-cfx="${c.id}|date" value="${esc(c.fx.date || '')}"></span></label><label>Rate source <span class="inwrap"><input type="text" class="txt" data-cfx="${c.id}|source" value="${esc(c.fx.source || '')}" placeholder="e.g. Federal Reserve H.10"></span></label>`}
      </div>
      <label class="cx-desc">Business description<textarea data-cf="${c.id}|description" rows="3" placeholder="Products, customers, revenue mix, geography">${esc(c.description || '')}</textarea></label>`;
  }
  function marketHtml(c) {
    const mc = E.marketCap(c, cur.settings), sh = E.sharesOf(c, cur.settings);
    return `<table class="fin cx-kv"><tbody>
      <tr><td>Share price ${hb('price')}</td><td>${vin(c, 'price', 'ps')}</td><td class="cx-note">${c.priceCurrency || 'USD'} per share</td></tr>
      <tr><td>Price observation date</td><td><span class="inwrap"><input type="date" data-cf="${c.id}|priceDate" value="${esc(c.priceDate || '')}" aria-label="Price date"></span></td><td class="cx-note">The same date for every company</td></tr>
      <tr><td>Actual common shares outstanding ${hb('shares')}</td><td>${vin(c, 'shares', 'sh')}</td><td class="cx-note">millions, cover-page count${c.v.shares && c.v.shares.src && c.v.shares.src.asOf ? ' as of ' + esc(c.v.shares.src.asOf) : ''}</td></tr>
      <tr><td>Net dilutive shares ${hb('dilutive')}</td><td>${vin(c, 'dilutive', 'sh')}</td><td class="cx-note">${cur.settings.shareBasis === 'diluted' ? 'used: diluted share basis' : 'not used on the basic share basis'}</td></tr>
      <tr class="key"><td>Market capitalisation ${hb('mcap')}</td><td>${f.mm(mc.v)}</td><td class="cx-note">${isNum(mc.v) ? `${plain(f.px(mc.price, c.priceCurrency))} × ${f.sh(mc.shares)} ${sh.basis} shares` : 'needs ' + (mc.missing || []).map(D.label).join(' and ')}</td></tr>
      </tbody></table>`;
  }
  function evHtml(c) {
    const e = E.evBuild(c, cur.settings);
    const fx = E.fxOf(c);
    const rows = E.EV_LINES.map(L => {
      const inc = E.lineIncluded(c, L, cur.settings);
      const tog = ['opLease', 'sti', 'otherNonop'].includes(L.key) ? `<label class="cx-chk"><input type="checkbox" data-cinc="${c.id}|${L.key}" ${inc ? 'checked' : ''}> include</label>` : '';
      const st = !inc ? '<span class="tag">excluded</span>' : !E.has(c, L.key) ? (e.missing.includes(L.key) ? '<span class="tag req">required</span>' : '<span class="tag">not reported</span>') : '';
      return `<tr class="${inc ? '' : 'cx-off'}"><td>${L.sign > 0 ? '+ ' : '− '}${esc(L.label)} ${hb(L.key)}</td><td>${vin(c, L.key, 'mm')}</td><td class="cx-note">${tog} ${st}</td></tr>`;
    }).join('');
    const debtMissing = e.missing.includes('debt');
    return `<table class="fin cx-kv"><thead><tr><th>Market cap to enterprise value</th><th>${esc(c.currency || 'USD')} $mm</th><th>Status</th></tr></thead><tbody>
      <tr><td>Market capitalisation</td><td>${f.mm(e.mc.v)}</td><td class="cx-note">${fx.same ? '' : 'in ' + esc(c.priceCurrency) + '; claims converted at ' + (isNum(fx.rate) ? fx.rate : 'missing rate')}</td></tr>
      ${rows}
      <tr class="key"><td>= Enterprise value ${hb('ev')}</td><td>${f.mm(e.v)}</td><td class="cx-note">${e.missing.length ? 'incomplete: ' + e.missing.map(k => k === 'fx' ? 'exchange rate' : k === 'debt' ? 'debt' : D.label(k)).join(', ') : e.notReported.length ? e.notReported.length + ' line(s) not reported, treated as none' : 'complete'}</td></tr>
      </tbody></table>
      ${debtMissing ? '<div class="notice bad">No borrowings (short-term, current or long-term debt) have been entered or imported; finance leases alone do not count. Enterprise value stays incomplete: enter the company\'s borrowings from the balance sheet, or 0 in one debt line if it has none.</div>' : ''}
      <p class="footnote">Lease policy for all companies: <b>${cur.settings.leasePolicy === 'include' ? 'operating leases included in EV' : 'operating leases excluded from EV (US GAAP EBITDA already bears the rent)'}</b>. Change it on ${link('adjust', 'Financial adjustments')}. Finance leases are always debt.</p>`;
  }
  function metricsHtml(c) {
    const head = PER_COLS.map(p => `<th>${p[1]}</th>`).join('');
    const rows = MET_ROWS.map(([m, u]) => `<tr><td>${esc(E.METRICS[m].label)} ${hb(MET_HELP[m])}</td>${PER_COLS.map(([p]) => `<td>${(p === 'ntm' || p === 'fy1' || p === 'fy2') && ['gp', 'capex', 'fcf'].includes(m) ? '' : vin(c, m + '_' + p, u)}</td>`).join('')}</tr>`).join('');
    const extra = `<tr class="sub"><td>D&A (for EBITDA)</td><td>${vin(c, 'da_fy', 'mm')}</td><td>${vin(c, 'da_ttm', 'mm')}</td><td></td><td></td><td></td></tr>
      <tr class="sub"><td>Revenue one year earlier ${hb('growth')}</td><td>${vin(c, 'rev_fy_prior', 'mm')}</td><td>${vin(c, 'rev_ttm_prior', 'mm')}</td><td></td><td></td><td></td></tr>
      <tr class="sub"><td>Book equity ${hb('equity')}</td><td colspan="5">${vin(c, 'equity', 'mm')}</td></tr>`;
    const g = E.growth(c);
    const margins = ['gp', 'ebitda', 'ebit', 'ni'].map(m => `${E.METRICS[m].label} margin ${plain(f.pct(E.margin(c, m)))}`).join(' · ');
    return `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Metric ($mm; EPS per share)</th>${head}</tr></thead><tbody>${rows}${extra}</tbody></table></div>
      <p class="footnote">Revenue growth ${plain(f.pct(g))} · ${margins}. TTM = latest fiscal year + current year-to-date − prior-year year-to-date ${hb('ttm')}. NTM and FY+1 are consensus estimates and are kept separate ${hb('ntm')}.</p>`;
  }
  function refsHtml(c) {
    const R = c.ref || {}; const ks = Object.keys(R); if (!ks.length) return '';
    return `<div class="cx-refs"><h3>Reference values (not used until you accept them)</h3><ul>${ks.map(k => { const r = R[k]; const to = REF_USE[k];
      return `<li><b>${esc((r.src && r.src.definition ? r.src.definition.split('.')[0] : k))}</b>: ${f.mm(r.v)} ${r.src && r.src.period ? '<span class="footnote">' + esc(r.src.period) + '</span>' : ''} ${r.src && r.src.url ? `<a href="${esc(r.src.url)}" target="_blank" rel="noopener">filing</a>` : ''} ${to ? `<button class="btn tiny" data-cref="${c.id}|${k}|${to}">Use as ${esc(D.label(to))}</button>` : ''}<div class="footnote">${esc(r.src && r.src.definition || '')}</div></li>`; }).join('')}</ul></div>`;
  }
  function pendingHtml(c) {
    if (!c.pending) return '';
    const items = c.pending.items;
    return `<div class="notice"><b>${items.length} proposed update(s) from ${esc(c.pending.provider)}</b> (${esc(String(c.pending.at).slice(0, 10))}). Nothing has changed yet: review and apply.
      <div class="tbl-wrap"><table class="fin"><thead><tr><th>Figure</th><th>Current</th><th>Proposed</th><th>Source</th><th></th></tr></thead><tbody>
      ${items.map(p => `<tr><td>${esc(D.label(p.key))}${p.manual ? ' <span class="tag memo">your manual figure</span>' : ''}</td><td>${f.mm(p.from)}</td><td>${f.mm(p.to)}</td><td class="cx-note">${esc(p.src.period || '')} ${p.src.form ? esc(p.src.form) : ''}</td><td><button class="btn tiny" data-cpend="${c.id}|${p.id}|apply">Apply</button> <button class="btn tiny" data-cpend="${c.id}|${p.id}|skip">Keep current</button></td></tr>`).join('')}</tbody></table></div>
      <div class="btns"><button class="btn" data-cpend="${c.id}|all|apply">Apply all except manual figures</button><button class="btn ghost" data-cpend="${c.id}|all|skip">Keep all current values</button></div></div>`;
  }
  function importHtml(c, role) {
    const dcfs = dcfModels();
    return `<div class="cx-import">
      <div><b>Import by ticker</b> (Financial Modeling Prep)<div class="btns"><span class="inwrap"><input type="text" class="txt" id="cx-tk-${c.id}" value="${esc(c.ticker || '')}" placeholder="Ticker" aria-label="Ticker to import"></span><button class="btn primary" data-cx-import-id="${c.id}">Import</button></div></div>
      <div><b>Load SEC company facts file</b> <span class="footnote">(data.sec.gov companyfacts JSON; optional matching submissions file)</span><div class="btns"><label class="btn">Choose file(s)<input type="file" data-csec="${c.id}" accept=".json,application/json" multiple hidden></label>${c.cik ? `<a class="footnote" href="https://data.sec.gov/api/xbrl/companyfacts/CIK${esc(String(c.cik).padStart(10, '0'))}.json" target="_blank" rel="noopener">Open this company's facts file</a>` : ''}</div></div>
      ${role === 'target' && dcfs.length ? `<div><b>Use the company from a DCF model</b> <span class="footnote">(market and balance-sheet figures; differences are proposed for review)</span><div class="btns"><span class="inwrap"><select id="cx-dcf-src">${dcfs.map(m => opt(m.id, m.name, matchDcf() && matchDcf().id)).join('')}</select></span><button class="btn" data-cx-from-dcf>Copy from DCF</button></div></div>` : ''}
    </div>${busy && busy.cid === c.id ? `<p class="footnote"><span class="spinner"></span> ${esc(busy.text)}</p>` : ''}${msg && msg.cid === c.id ? `<div class="notice ${msg.level || ''}">${esc(msg.text)}</div>` : ''}${role === 'target' && confirm && confirm.replaceTarget ? `<div class="btns"><button class="btn primary" data-cx-confirm-target>Replace the target with ${esc(confirm.sym)}</button><button class="btn ghost" data-cx-cancel>Keep ${esc(c.ticker || 'the current target')}</button></div>` : ''}`;
  }
  function workspace(c, role) {
    const q = D.quality(c, cur);
    const notesList = (c.importNotes || []).length ? `<details class="cx-notes" data-k="in-${c.id}" ${ui.open['in-' + c.id] ? 'open' : ''}><summary>Import notes (${c.importNotes.length})</summary><ul class="footnote">${c.importNotes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : '';
    return `${panel('Import data', importHtml(c, role) + pendingHtml(c) + notesList)}
      ${panel('Company profile', profileHtml(c))}
      <div class="grid2">${panel('Market data', marketHtml(c))}${panel('Enterprise value builder', evHtml(c), { help: 'ev' })}</div>
      ${panel('Operating figures', metricsHtml(c) + refsHtml(c))}
      ${q.length ? panel('Data quality', `<ul class="cx-q">${q.map(x => `<li>${pill(x.level, x.level === 'bad' ? 'Missing' : 'Check')} ${esc(x.text)}</li>`).join('')}</ul>`) : panel('Data quality', '<p>' + pill('good', 'OK') + ' No missing or stale figures detected.</p>')}
      ${notes('co-' + c.id, nameOf(c))}`;
  }

  // ---------- pages ----------
  const P = {};
  P.dashboard = () => {
    const { comp, b, imp } = calc(); const t = cur.target;
    const peers = E.peerSet(cur);
    const tm = E.targetMultiple(cur, b.sel.multiple, b.sel.period);
    const e = E.evBuild(t, cur.settings);
    const latest = all().map(c => c.v.rev_ttm && c.v.rev_ttm.src && c.v.rev_ttm.src.end).filter(Boolean).sort().pop();
    const stat = (k, v, s, cls = '') => `<div class="stat ${cls}"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s || ''}</span></div>`;
    const warn = comp.targetQuality.filter(q => q.level === 'bad');
    return `<div><h1>Trading Comps dashboard</h1><p class="lead">${t.name ? esc(t.name) + (t.ticker ? ' (' + esc(t.ticker) + ')' : '') : 'No target company yet: start on ' + link('target', 'Target company')}. ${comp.valued ? '' : '<b>Valuation incomplete.</b> Missing inputs stay missing; nothing is estimated for you.'}</p></div>
      <div class="stats">
        ${stat('Share price', f.px(E.val(t, 'price'), t.priceCurrency), t.priceDate ? 'as of ' + esc(t.priceDate) : 'no date')}
        ${stat('Market cap ($mm)', f.mm(e.mc.v), e.mc.basis + ' shares')}
        ${stat('Enterprise value ($mm)', f.mm(e.v), e.missing.length ? 'incomplete' : 'complete')}
        ${stat('Peer group', esc(E.groupLabel(cur, cur.selection.group)), peers.length + ' included companies')}
        ${stat('Latest financial data', latest ? esc(latest) : NA, 'newest TTM period end')}
        ${stat('Selected multiple', esc(b.label), esc(E.BENCH[b.sel.benchmark]) + (b.premium ? `, ${(b.premium * 100).toFixed(1)}% ${b.premium > 0 ? 'premium' : 'discount'}` : ''))}
        ${stat('Peer median', f.x(b.col.stats.median), b.col.stats.n + ' valid observations')}
        ${stat('Implied equity value ($mm)', f.mm(imp.equity), imp.error ? esc(imp.error) : '')}
        ${stat('Implied value per share', f.px(imp.perShare, t.priceCurrency), imp.error ? 'incomplete' : esc(b.label) + ' at ' + plain(f.x(b.selected)), 'primary')}
        ${stat('Upside / downside', f.up(imp.upside), 'vs current price')}
        ${stat('Completion', comp.pct + '%', comp.complete ? 'complete' : link('checklist', 'see what is left'))}
        ${stat('Data quality', warn.length ? warn.length + ' missing' : 'OK', warn.length ? esc(warn[0].text) : 'target data complete')}
      </div>
      ${panel('Target vs peer median', `<table class="fin"><thead><tr><th>Multiple</th><th>Target</th><th>Peer median</th><th>Target vs median</th><th>n</th></tr></thead><tbody>
        ${['ev_rev', 'ev_ebitda', 'ev_ebit', 'pe'].map(id => { const p = cur.settings.tablePeriod || 'ttm'; const col = E.column(cur, id, p); const tmv = E.targetMultiple(cur, id, p); return `<tr ${id === b.sel.multiple ? 'class="key"' : ''}><td>${esc(E.multLabel(id, p))}</td><td>${tmv.status === 'ok' ? f.x(tmv.v) : tmv.status.toUpperCase()}</td><td>${f.x(col.stats.median)}</td><td>${tmv.status === 'ok' && isNum(col.stats.median) ? f.pct(tmv.v / col.stats.median - 1) : NA}</td><td>${col.stats.n}</td></tr>`; }).join('')}
        </tbody></table><p class="footnote">The target is never part of the peer statistics. Current target ${esc(b.label)}: ${tm.status === 'ok' ? plain(f.x(tm.v)) : esc(tm.reason || tm.status)}.</p>`)}
      ${comp.sections.filter(s => s.status !== 'complete').length ? panel('Next steps', `<ul class="cx-q">${comp.sections.flatMap(s => s.items.filter(i => !i.ok).map(i => `<li>${link(i.page, esc(i.text))}</li>`)).slice(0, 8).join('')}</ul>`) : ''}`;
  };
  P.checklist = () => {
    const { comp } = calc();
    return `<div><h1>Model completion checklist</h1><p class="lead">${comp.done} of ${comp.total} checks complete. A valuation can be calculated before every documentation step is done, but it stays marked incomplete.</p></div>
      ${comp.sections.map(s => panel(`${esc(s.title)} ${pill(s.status === 'complete' ? 'good' : s.status === 'progress' ? 'warn' : 'bad', s.done + '/' + s.total)}`, `<ul class="cx-check">${s.items.map(i => `<li class="${i.ok ? 'ok' : ''}">${i.ok ? '✓' : '○'} ${link(i.page, esc(i.text))}</li>`).join('')}</ul>`)).join('')}`;
  };
  P.howto = () => `<div><h1>How to use Trading Comps</h1><p class="lead">Trading comps value a company from how the market prices similar listed companies today. This model is separate from the DCF: it has its own saved models, and it only reads your DCF models for the comparison page.</p></div>
    ${panel('Steps', `<ol class="cx-steps">
      <li><b>${link('target', 'Target company')}</b>: import by ticker (Financial Modeling Prep) or load the SEC company facts file, then enter the share price and its date. Check the enterprise value build line by line.</li>
      <li><b>${link('peers', 'Peer selection')}</b>: add 5–10 companies with similar business models, mark each Core, Broader or Excluded, and write why.</li>
      <li><b>${link('peerdata', 'Peer financial data')}</b>: import each peer and fix any missing price, shares, debt or TTM figures. Review proposed updates.</li>
      <li><b>${link('adjust', 'Financial adjustments')}</b>: remove genuinely non-recurring items consistently, with a reason and source each. Choose the lease policy and share basis for all companies.</li>
      <li><b>${link('table', 'Trading comps table')}</b>: read the multiples, the N/M cases and the outlier flags. Exclude an observation only with a reason.</li>
      <li><b>${link('multiple', 'Multiple selection')}</b>: pick the multiple and benchmark, justify any premium or discount, and confirm.</li>
      <li><b>${link('implied', 'Implied valuation')}</b> and <b>${link('sensitivity', 'Sensitivity')}</b>: follow each step from multiple to value per share and test the assumptions.</li>
      <li><b>${link('summary', 'Summary')}</b>, <b>${link('dcf', 'DCF comparison')}</b>, <b>${link('sources', 'Sources')}</b>: write your conclusion, compare with your DCF, and export.</li></ol>`)}
    ${panel('Conventions used', `<ul>
      <li>Blue fields are editable. A small badge shows where each figure came from: SEC (reported), Calc (calculated from reported figures), Vendor (provider definition), Est (consensus estimate), Mkt (market data), DCF (copied from a DCF model), Manual (yours). Click it for the source, the original amount and the history.</li>
      <li>Missing figures stay missing. A multiple shows N/A when an input is missing and N/M when its denominator or EV is zero or negative ${hb('nm')}.</li>
      <li>Statistics use only included peers with valid observations, and never the target ${hb('stats')}. Quartiles follow Excel's PERCENTILE.INC.</li>
      <li>Outliers are flagged with Tukey fences and never removed automatically ${hb('outlier')}.</li>
      <li>Market cap = price × actual cover-page shares. Weighted-average shares are never used as a current count.</li>
      <li>TTM = last fiscal year + year-to-date − prior-year year-to-date. NTM is calendarised from FY+1 and FY+2 consensus and is never mixed with FY+1.</li></ul>`)}
    <p><label class="cx-chk"><input type="checkbox" data-cx-learn ${cur.ui.learn ? 'checked' : ''}> Show "How this works" explanations on each page</label></p>`;
  P.target = () => `<div><h1>Target company ${hb('price')}</h1><p class="lead">The company you are valuing. Its own multiples are shown next to the peers but never included in the peer statistics.</p></div>
    ${learn('Import gives reported figures with their sources. Enter the share price and its date yourself if the import has none (SEC files contain no prices). The enterprise value builder below is also the equity bridge used for the implied valuation, so the same claims and assets are used in both directions.')}
    ${workspace(cur.target, 'target')}`;
  P.peers = () => {
    const t = cur.target;
    const F = ui.filter;
    const pass = p => { const r = E.val(p, 'rev_ttm') ?? E.val(p, 'rev_fy'), g = E.growth(p), m = E.margin(p, 'ebitda');
      return (!isNum(F.revMin) || (isNum(r) && r >= F.revMin)) && (!isNum(F.revMax) || (isNum(r) && r <= F.revMax)) && (!isNum(F.gMin) || (isNum(g) && g >= F.gMin)) && (!isNum(F.mMin) || (isNum(m) && m >= F.mMin)); };
    const sorted = cur.peers.slice().sort((a, b) => (isNum(a.rank) ? a.rank : 999) - (isNum(b.rank) ? b.rank : 999));
    const indMismatch = cur.peers.filter(p => p.status !== 'excluded' && p.industry && t.industry && p.industry !== t.industry).length;
    const inc = cur.peers.filter(p => p.status !== 'excluded').length;
    const rows = sorted.map(p => {
      const cmp = E.comparability(t, p); const q = D.quality(p, cur).filter(x => x.level === 'bad');
      return `<tr class="${p.status === 'excluded' ? 'cx-off' : ''} ${pass(p) ? '' : 'cx-hidden'}"><td><span class="inwrap cx-rank"><input data-crank="${p.id}" value="${isNum(p.rank) ? p.rank : ''}" inputmode="numeric" aria-label="Rank of ${esc(nameOf(p))}"></span></td>
        <td><b>${esc(p.ticker || '')}</b><div class="footnote">${esc(p.name || '')}</div></td><td class="cx-note">${esc(p.industry || '')}${p.country ? ' · ' + esc(p.country) : ''}</td>
        <td><span class="inwrap"><select data-cf="${p.id}|status" aria-label="Status of ${esc(nameOf(p))}">${opt('core', 'Core', p.status)}${opt('broader', 'Broader', p.status)}${opt('excluded', 'Excluded', p.status)}</select></span></td>
        <td><textarea data-cf="${p.id}|reason" rows="2" placeholder="${p.status === 'excluded' ? 'Why excluded' : 'Why comparable'}" aria-label="Reason for ${esc(nameOf(p))}">${esc(p.reason || '')}</textarea></td>
        <td class="cx-note"><button class="linkbtn" data-ccmp="${p.id}">${cmp.tested ? cmp.met + ' of ' + cmp.tested + ' criteria' : 'no data yet'}</button>${ui.cmp === p.id ? `<ul class="footnote">${cmp.res.map(r => `<li>${r.met === null ? '–' : r.met ? '✓' : '✗'} ${esc(r.label)}</li>`).join('')}</ul>` : ''}</td>
        <td class="cx-note">${q.length ? pill('bad', q.length + ' missing') : pill('good', 'data OK')}</td>
        <td><a class="btn tiny" href="#comps/peerdata" data-cpeer="${p.id}">Data</a> <button class="btn tiny danger" data-cremove="${p.id}">Remove</button></td></tr>
        ${ui.compare ? `<tr class="sub"><td></td><td colspan="7" class="cx-descr">${esc(p.description || 'No description imported.')}</td></tr>` : ''}`;
    }).join('');
    const sug = ui.suggest;
    return `<div><h1>Peer selection ${hb('peerSel')}</h1><p class="lead">${inc} included peer(s) (${cur.peers.filter(p => p.status === 'core').length} Core, ${cur.peers.filter(p => p.status === 'broader').length} Broader), ${cur.peers.filter(p => p.status === 'excluded').length} excluded. Industry codes are a start, not a reason: record why each company is comparable.</p></div>
      ${learn('Core peers are the closest comparables; Broader peers widen the set; Excluded peers stay on the list with your reason but never enter the statistics. The comparability criteria are transparent screens, not proof of comparability.')}
      ${indMismatch && inc ? `<div class="notice"><b>Business mix check.</b> ${indMismatch} of ${inc} included peers have a different industry classification from the target (${esc(t.industry || '')}). If the target has several distinct businesses (for example retail, cloud and advertising), one consolidated peer group can give a misleading multiple: consider a sum-of-the-parts valuation ${hb('sotp')}.</div>` : ''}
      ${panel('Add peers', `<div class="cx-import">
        <div><b>Add by ticker</b> (imports from Financial Modeling Prep)<div class="btns"><span class="inwrap"><input type="text" class="txt" id="cx-add-tk" placeholder="Ticker, e.g. WMT" aria-label="Peer ticker"></span><button class="btn primary" data-cx-addpeer>Add and import</button><button class="btn" data-cx-addmanual>Add without import</button></div></div>
        <div><b>Load SEC company facts files</b> <span class="footnote">(several at once; matched to existing peers by CIK)</span><div class="btns"><label class="btn">Choose files<input type="file" data-csec="newpeer" accept=".json,application/json" multiple hidden></label></div></div>
        <div><b>Suggested peers</b> <span class="footnote">(provider list based on sector, exchange and market cap: check each business model)</span><div class="btns"><button class="btn" data-cx-suggest ${t.ticker ? '' : 'disabled'}>Suggest peers for ${esc(t.ticker || 'the target')}</button></div></div></div>
        ${busy && busy.cid === 'peers' ? `<p class="footnote"><span class="spinner"></span> ${esc(busy.text)}</p>` : ''}${msg && msg.cid === 'peers' ? `<div class="notice ${msg.level || ''}">${esc(msg.text)}</div>` : ''}
        ${sug ? `<div class="cx-sug">${sug.error ? `<div class="notice bad">${esc(sug.error)}</div>` : sug.list.length ? `<p class="footnote">Suggestions are a starting point only. Similar sector and size do not make a business comparable: compare products, customers and revenue mix before adding.</p><ul>${sug.list.map(s => `<li><b>${esc(s.symbol)}</b> ${esc(s.name || '')} ${isNum(s.mktCap) ? '<span class="footnote">market cap ' + f.mm(s.mktCap / 1e6) + ' $mm</span>' : ''} ${cur.peers.some(p => p.ticker === s.symbol) ? '<span class="tag">added</span>' : `<button class="btn tiny" data-cx-addsym="${esc(s.symbol)}">Add</button>`}</li>`).join('')}</ul>` : '<p>No suggestions returned.</p>'}</div>` : ''}`)}
      ${panel('Peer list', `<div class="cx-filter"><b>Filter</b> <label>Revenue ≥ <span class="inwrap"><input data-cfilter="revMin" value="${isNum(F.revMin) ? F.revMin : ''}" placeholder="$mm"></span></label><label>Revenue ≤ <span class="inwrap"><input data-cfilter="revMax" value="${isNum(F.revMax) ? F.revMax : ''}" placeholder="$mm"></span></label><label>Growth ≥ <span class="inwrap"><input data-cfilter="gMin" data-unit="pct" value="${isNum(F.gMin) ? +(F.gMin * 100).toFixed(4) : ''}" placeholder="%"></span></label><label>EBITDA margin ≥ <span class="inwrap"><input data-cfilter="mMin" data-unit="pct" value="${isNum(F.mMin) ? +(F.mMin * 100).toFixed(4) : ''}" placeholder="%"></span></label><label class="cx-chk"><input type="checkbox" data-cx-compare ${ui.compare ? 'checked' : ''}> Compare descriptions</label></div>
        <p class="footnote">The filter only hides rows on this page; it never changes which peers are in the valuation.</p>
        ${cur.peers.length ? `<div class="tbl-wrap"><table class="fin cx-peers"><thead><tr><th>Rank</th><th>Company</th><th>Industry</th><th>Status</th><th>Reason</th><th>Comparability ${hb('relevance')}</th><th>Data</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>No peers yet.</p>'}
        ${t.description || cur.peers.length ? `<details class="cx-notes" data-k="tdesc" ${ui.open.tdesc ? 'open' : ''}><summary>Target description</summary><p class="footnote">${esc(t.description || 'Not imported.')}</p></details>` : ''}`)}
      ${panel('Custom peer groups', `<p class="footnote">A custom group is a named subset (for example a segment peer set). Excluded peers never count, even inside a group.</p>
        ${cur.groups.map(g => `<div class="cx-group"><span class="inwrap"><input type="text" class="txt" data-cgname="${g.id}" value="${esc(g.name)}" aria-label="Group name"></span> ${cur.peers.map(p => `<label class="cx-chk"><input type="checkbox" data-cgpeer="${g.id}|${p.id}" ${g.peerIds.includes(p.id) ? 'checked' : ''}> ${esc(nameOf(p))}</label>`).join(' ')} <button class="btn tiny danger" data-cgdel="${g.id}">Delete group</button></div>`).join('')}
        <div class="btns"><button class="btn" data-cx-addgroup>New custom group</button><span class="footnote">Valuation uses: <b>${esc(E.groupLabel(cur, cur.selection.group))}</b> (change it in the top bar)</span></div>`)}
      ${panel('Peer list templates', `<div class="btns"><span class="inwrap"><input type="text" class="txt" id="cx-tpl-name" placeholder="Template name" aria-label="Template name"></span><button class="btn" data-cx-savetpl>Save current peers as a template</button></div>
        ${M.loadTemplates().length ? `<ul>${M.loadTemplates().map(t => `<li>${esc(t.name)} <span class="footnote">${t.peers.length} peers · ${esc(t.created.slice(0, 10))}</span> <button class="btn tiny" data-cx-applytpl="${t.id}">Add these peers</button> <button class="btn tiny danger" data-cx-deltpl="${t.id}">Delete</button></li>`).join('')}</ul>` : '<p class="footnote">No templates yet. A template stores tickers, status and reasons only; financial data is imported fresh.</p>'}`)}
      ${notes('peers', 'peer selection')}${notes('excluded', 'why peers were excluded')}`;
  };
  P.peerdata = () => {
    if (!cur.peers.length) return `<div><h1>Peer financial data</h1><p class="lead">Add peers on ${link('peers', 'Peer selection')} first.</p></div>`;
    const sel = byId(ui.peer) && ui.peer !== cur.target.id ? byId(ui.peer) : cur.peers[0];
    ui.peer = sel.id;
    const grid = `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Peer</th><th>Status</th><th>Price</th><th>Price date</th><th>Shares (mm)</th><th>Market cap</th><th>EV</th><th>TTM revenue</th><th>TTM EBITDA</th><th>TTM ends</th><th>Quality</th></tr></thead><tbody>
      ${cur.peers.map(p => { const e = E.evBuild(p, cur.settings); const q = D.quality(p, cur); const bad = q.filter(x => x.level === 'bad').length, w = q.filter(x => x.level === 'warn').length;
        return `<tr class="${p.id === sel.id ? 'key' : ''} ${p.status === 'excluded' ? 'cx-off' : ''}"><td><button class="linkbtn" data-cpeer="${p.id}">${esc(nameOf(p))}</button></td><td>${esc(p.status)}</td><td>${f.px(E.val(p, 'price'), p.priceCurrency)}</td><td>${esc(p.priceDate || '')}</td><td>${f.sh(E.val(p, 'shares'))}</td><td>${f.mm(e.mc.v)}</td><td>${f.mm(e.v)}</td><td>${f.mm(E.val(p, 'rev_ttm'))}</td><td>${f.mm(E.metric(p, 'ebitda', 'ttm', false).v)}</td><td>${esc((p.v.rev_ttm && p.v.rev_ttm.src && p.v.rev_ttm.src.end) || '')}</td><td>${bad ? pill('bad', bad + ' missing') : w ? pill('warn', w + ' to check') : pill('good', 'OK')}</td></tr>`; }).join('')}</tbody></table></div>`;
    const dates = [...new Set(all().map(c => c.priceDate).filter(Boolean))];
    return `<div><h1>Peer financial data</h1><p class="lead">A separate workspace for every peer. Select a peer below; each figure keeps its source, and manual figures are never overwritten by a re-import.</p></div>
      ${dates.length > 1 ? `<div class="notice">Prices are observed on ${dates.length} different dates (${dates.map(esc).join(', ')}). Use one date for all companies.</div>` : ''}
      ${panel('All peers', grid)}
      <div class="cx-tabs" role="tablist">${cur.peers.map(p => `<button role="tab" aria-selected="${p.id === sel.id}" data-cpeer="${p.id}">${esc(nameOf(p))}</button>`).join('')}</div>
      <h2>${esc(sel.name || sel.ticker || 'Peer')}</h2>
      ${workspace(sel, 'peer')}`;
  };
  const ADJ_TYPES = ['Restructuring', 'Litigation expense or gain', 'Asset impairment', 'Gain or loss on asset sale', 'Acquisition and integration costs', 'Accounting policy difference', 'Stock-based compensation definition', 'Lease accounting difference', 'Fiscal calendar change', 'Discontinued operations', 'Currency effect', 'Crypto or investment remeasurement', 'Other unusual item'];
  P.adjust = () => {
    const b = E.benchmark(cur);
    const sel = b.sel;
    const Mm = E.MULTIPLES[sel.multiple];
    const comp = all().filter(c => c.role === 'target' || c.status !== 'excluded');
    const rows = comp.map(c => {
      const met = E.metric(c, Mm.metric, sel.period, true);
      const rep = E.multiple(c, sel.multiple, sel.period, cur.settings, { normalized: false }), nor = E.multiple(c, sel.multiple, sel.period, cur.settings, { normalized: true });
      const cell = r => r.status === 'ok' ? f.x(r.v) : `<span class="na" title="${esc(r.reason)}">${r.status === 'nm' ? 'N/M' : 'N/A'}</span>`;
      return `<tr><td>${esc(nameOf(c))}${c.role === 'target' ? ' <span class="tag">target</span>' : ''}</td><td>${Mm.metric === 'eps' ? f.px(met.reported) : f.mm(met.reported)}</td><td>${Mm.metric === 'eps' ? f.px(met.adj) : f.mm(met.adj)}</td><td>${Mm.metric === 'eps' ? f.px(met.v) : f.mm(met.v)}</td><td>${cell(rep)}</td><td>${cell(nor)}</td></tr>`;
    }).join('');
    const adjRows = all().flatMap(c => (c.adj || []).map(a => ({ c, a }))).map(({ c, a }) => `<tr><td>${esc(nameOf(c))}</td>
      <td><span class="inwrap"><select data-cadj="${c.id}|${a.id}|metric">${['rev', 'ebitda', 'ebit', 'ni', 'eps'].map(m => opt(m, E.METRICS[m].label, a.metric)).join('')}</select></span></td>
      <td><span class="inwrap"><select data-cadj="${c.id}|${a.id}|period">${['ttm', 'fy', 'ntm', 'fy1'].map(p => opt(p, E.PERIODS[p], a.period)).join('')}</select></span></td>
      <td><span class="inwrap"><select data-cadj="${c.id}|${a.id}|type">${ADJ_TYPES.map(x => opt(x, x, a.type)).join('')}</select></span></td>
      <td><span class="inwrap"><input data-cadj="${c.id}|${a.id}|amount" value="${isNum(a.amount) ? a.amount : ''}" inputmode="decimal" placeholder="+ adds back" aria-label="Amount"></span></td>
      <td><textarea data-cadj="${c.id}|${a.id}|reason" rows="2" placeholder="Why it is non-recurring">${esc(a.reason || '')}</textarea></td>
      <td><textarea data-cadj="${c.id}|${a.id}|source" rows="2" placeholder="Filing, page, note">${esc(a.source || '')}</textarea></td>
      <td><label class="cx-chk"><input type="checkbox" data-cadj="${c.id}|${a.id}|recurring" ${a.recurring ? 'checked' : ''}> recurs in prior years</label>${a.recurring ? '<div class="errmsg">A recurring cost is not a one-off: it should normally stay in the metric.</div>' : ''}${isNum(a.amount) && a.amount !== 0 && (!a.reason || !a.source) ? '<div class="errmsg">Needs a reason and a source.</div>' : ''}</td>
      <td><button class="btn tiny danger" data-cadjdel="${c.id}|${a.id}">Remove</button></td></tr>`).join('');
    const vendorWarn = cur.peers.concat([cur.target]).filter(c => c.ref && c.ref.vendorEbitda && E.has(c, 'ebitda_fy') && Math.abs(c.ref.vendorEbitda.v / E.val(c, 'ebitda_fy') - 1) > 0.05);
    const ebitdaSrc = [...new Set(comp.map(c => c.v.ebitda_ttm && c.v.ebitda_ttm.src ? c.v.ebitda_ttm.src.cat : null).filter(Boolean))];
    const stds = [...new Set(comp.map(c => c.accounting || 'US GAAP'))];
    return `<div><h1>Financial adjustments ${hb('normalize')}</h1><p class="lead">Reported metric ± analyst adjustments = normalised metric. Adjust only genuinely non-recurring items, the same way for every company, with a reason and a source.</p></div>
      ${learn('An amount is added to the reported figure: a one-off charge added back is positive, a one-off gain removed is negative. Company "adjusted" figures are a starting point, not an authority: a cost that recurs every year is not one-off because the company labels it so.')}
      ${panel('Model-wide definitions', `<div class="cx-form">
        <label>Lease policy (all companies) ${hb('leasePolicy')}<span class="inwrap"><select data-cset="leasePolicy">${opt('exclude', 'Exclude operating leases from EV (US GAAP EBITDA)', cur.settings.leasePolicy)}${opt('include', 'Include operating leases in EV (needs EBITDAR / IFRS-style EBITDA)', cur.settings.leasePolicy)}</select></span></label>
        <label>Share basis (all companies) ${hb('shareBasis')}<span class="inwrap"><select data-cset="shareBasis">${opt('basic', 'Basic: actual cover-page shares', cur.settings.shareBasis)}${opt('diluted', 'Diluted: actual + net dilutive shares', cur.settings.shareBasis)}</select></span></label>
        <label>Metrics used in multiples <span class="inwrap"><select data-cset="normalized">${opt('true', 'Normalised (reported ± adjustments)', String(cur.settings.normalized !== false))}${opt('false', 'Reported only', String(cur.settings.normalized !== false))}</select></span></label></div>
        ${cur.settings.leasePolicy === 'include' ? '<div class="notice">Operating leases are in EV. US GAAP EBITDA still deducts the operating lease cost, so add it back (type "Lease accounting difference") for every US GAAP company, or the multiples are overstated.</div>' : ''}
        ${stds.length > 1 ? `<div class="notice bad">The companies use different accounting standards (${stds.map(esc).join(', ')}). IFRS 16 EBITDA excludes all lease costs while US GAAP EBITDA includes operating lease cost: adjust one side so EBITDA is defined the same way.</div>` : ''}
        ${ebitdaSrc.length > 1 ? `<div class="notice">TTM EBITDA comes from different kinds of sources (${ebitdaSrc.map(c => (CAT[c] || [c])[1]).join('; ')}). Check that every company's EBITDA is EBIT + D&A on the same basis.</div>` : ''}
        ${vendorWarn.length ? `<div class="notice">The provider's own EBITDA differs by more than 5% from EBIT + D&A for ${vendorWarn.map(nameOf).join(', ')}: the definitions differ. This model uses EBIT + D&A.</div>` : ''}`)}
      ${panel('Adjustments', `${adjRows ? `<div class="tbl-wrap"><table class="fin cx-adj"><thead><tr><th>Company</th><th>Metric</th><th>Period</th><th>Type</th><th>Amount</th><th>Justification</th><th>Source</th><th>Check</th><th></th></tr></thead><tbody>${adjRows}</tbody></table></div>` : '<p>No adjustments. Reported figures are used.</p>'}
        <div class="btns"><span class="inwrap"><select id="cx-adj-co">${all().map(c => opt(c.id, nameOf(c) + (c.role === 'target' ? ' (target)' : ''), '')).join('')}</select></span><button class="btn" data-cx-addadj>Add adjustment</button></div>`)}
      ${panel(`Reported vs normalised: ${esc(b.label)}`, `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Company</th><th>Reported ${esc(E.METRICS[Mm.metric] ? E.METRICS[Mm.metric].label : 'metric')}</th><th>Adjustments</th><th>Normalised</th><th>Reported multiple</th><th>Normalised multiple</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
      ${notes('adjust', 'adjustments')}`;
  };
  function obsCell(o) {
    if (o.m.status !== 'ok') return `<td class="cx-nm" title="${esc(o.m.reason)}">${o.m.status === 'nm' ? 'N/M' : 'N/A'}</td>`;
    return `<td class="${o.excluded ? 'cx-exobs' : ''} ${o.outlier ? 'cx-out' : ''}" title="${o.outlier ? 'Outside the Tukey fences: check it' : ''}${o.excluded ? ' Excluded: ' + esc(o.exReason) : ''}">${o.outlier ? '<span class="cx-flag" aria-label="outlier">⚑</span>' : ''}${f.x(o.m.v)}</td>`;
  }
  P.table = () => {
    const p = cur.settings.tablePeriod || 'ttm';
    const ids = ['ev_rev', 'ev_ebitda', 'ev_ebit', 'pe', 'pb', 'p_fcf'];
    const per = id => E.MULTIPLES[id].periods.includes(p) ? p : E.MULTIPLES[id].periods.includes('ttm') && p !== 'cur' ? (E.MULTIPLES[id].periods[0]) : E.MULTIPLES[id].periods[0];
    const cols = ids.map(id => E.column(cur, id, per(id)));
    const inc = E.peerSet(cur);
    const others = cur.peers.filter(x => !inc.includes(x));
    const metP = p === 'fy1' ? 'fy1' : p === 'ntm' ? 'ntm' : p === 'fy' ? 'fy' : 'ttm';
    const row = (c, st, isT) => {
      const e = E.evBuild(c, cur.settings);
      const met = k => E.metric(c, k, metP, cur.settings.normalized !== false).v;
      const cells = cols.map(col => { if (isT) { const tm = E.targetMultiple(cur, col.id, col.p); return tm.status === 'ok' ? `<td>${f.x(tm.v)}</td>` : `<td class="cx-nm" title="${esc(tm.reason)}">${tm.status === 'nm' ? 'N/M' : 'N/A'}</td>`; } const o = col.obs.find(x => x.id === c.id); return o ? obsCell(o) : '<td class="cx-off">–</td>'; }).join('');
      const rev = met('rev');
      return `<tr class="${st || ''}"><td><b>${esc(c.ticker || '')}</b> ${esc(c.name || '')}${isT ? ' <span class="tag">target</span>' : st ? ` <span class="tag">${esc(c.status)}${st === 'cx-off' ? ': not in statistics' : ''}</span>` : ''}</td><td class="cx-note">${esc(c.industry || '')}</td><td class="cx-note">${esc(c.country || '')}</td>
        <td>${f.mm(e.mc.v)}</td><td>${f.mm(e.v)}</td><td>${f.mm(rev)}</td><td>${f.pct(E.growth(c))}</td><td>${f.mm(met('ebitda'))}</td><td>${f.pct(isNum(rev) && rev > 0 && isNum(met('ebitda')) ? met('ebitda') / rev : null)}</td><td>${f.mm(met('ebit'))}</td><td>${f.pct(isNum(rev) && rev > 0 && isNum(met('ebit')) ? met('ebit') / rev : null)}</td><td>${f.mm(met('ni'))}</td><td>${isNum(met('eps')) ? f.px(met('eps'), c.currency) : NA}</td><td>${f.mm(E.metric(c, 'fcf', metP === 'ttm' ? 'ttm' : 'fy', true).v)}</td>${cells}</tr>`;
    };
    const statRow = (k, label) => `<tr class="cx-stat"><td>${label}</td><td colspan="13"></td>${cols.map(c => `<td>${k === 'n' ? c.stats.n : f.x(c.stats[k])}</td>`).join('')}</tr>`;
    const fyEnds = [...new Set(inc.map(c => c.fyEnd).filter(Boolean))];
    const nmNotes = cols.flatMap(c => c.obs.filter(o => o.m.status !== 'ok').map(o => `${o.ticker || o.name}, ${c.label}: ${o.m.reason}`));
    const outs = cols.flatMap(c => c.obs.filter(o => o.outlier).map(o => ({ c, o })));
    return `<div><h1>Trading comps table ${hb('stats')}</h1><p class="lead">${esc(E.groupLabel(cur, cur.selection.group))}: ${inc.length} companies in the statistics. ${cur.settings.normalized !== false ? 'Normalised metrics.' : 'Reported metrics.'} $ millions except per-share figures. Scroll sideways for all columns.</p></div>
      <div class="btns"><div class="seg" role="group" aria-label="Period">${[['ttm', 'Trailing (TTM)'], ['fy', 'Last fiscal year'], ['ntm', 'Forward (NTM)'], ['fy1', 'Next fiscal year (FY+1)']].map(([k, l]) => `<button data-cx-tperiod="${k}" aria-pressed="${p === k}">${l}</button>`).join('')}</div><span class="footnote">P/Book uses the latest balance sheet; P/FCF is trailing only.</span></div>
      ${p === 'fy1' && fyEnds.length > 1 ? `<div class="notice">Peers have different fiscal year-ends (${fyEnds.map(esc).join(', ')}): FY+1 estimates cover different periods. Use NTM for a date-aligned comparison.</div>` : ''}
      ${(p === 'ntm' || p === 'fy1') && cols.every(c => !c.stats.n) ? '<div class="notice">No forward estimates are available for the included peers, so forward multiples show N/A. Estimates are never invented: import them from the provider or enter consensus figures with their source.</div>' : ''}
      <div class="tbl-wrap cx-comps"><table class="fin"><thead><tr><th>Company</th><th>Industry</th><th>Country</th><th>Market cap</th><th>EV</th><th>Revenue</th><th>Rev. growth</th><th>EBITDA</th><th>EBITDA margin</th><th>EBIT</th><th>EBIT margin</th><th>Net income</th><th>EPS</th><th>FCF</th>${cols.map(c => `<th>${esc(c.label)} ${hb('m_' + c.id)}</th>`).join('')}</tr></thead><tbody>
        ${inc.map(c => row(c, '', false)).join('')}
        ${statRow('max', 'Maximum')}${statRow('q3', '75th percentile')}${statRow('mean', 'Mean')}${statRow('median', 'Median')}${statRow('q1', '25th percentile')}${statRow('min', 'Minimum')}${statRow('n', 'Valid observations (n)')}
        <tr class="key">${row(cur.target, '', true).replace(/^<tr class="">/, '').replace(/<\/tr>$/, '')}</tr>
        ${others.map(c => row(c, 'cx-off', false)).join('')}
      </tbody></table></div>
      <p class="footnote">⚑ = outside the Tukey fences (Q1 − 1.5 × IQR, Q3 + 1.5 × IQR); flagged, still counted unless you exclude it. Struck-through values are observations you excluded. N/M = zero or negative denominator or EV; N/A = data missing. Quartiles: PERCENTILE.INC.</p>
      ${outs.length ? panel('Outlier review', `<p class="footnote">Exclude an observation only with a reason. It stays visible and can be included again.</p><ul class="cx-q">${outs.map(({ c, o }) => `<li><b>${esc(o.ticker || o.name)}</b> ${esc(c.label)} ${f.x(o.m.v)} ${o.excluded ? `${pill('warn', 'excluded')} ${esc(o.exReason)} <button class="btn tiny" data-cobs="${o.id}|${c.key}|include">Include again</button>` : `<span class="inwrap"><input type="text" class="txt" id="cx-why-${o.id}-${c.key.replace('@', '_')}" placeholder="Reason to exclude" aria-label="Reason to exclude"></span> <button class="btn tiny" data-cobs="${o.id}|${c.key}|exclude">Exclude from statistics</button>`}</li>`).join('')}</ul>`) : ''}
      ${cols.some(c => c.excludedObs) ? panel('Excluded observations', `<ul>${cols.flatMap(c => c.obs.filter(o => o.excluded).map(o => `<li>${esc(o.ticker || o.name)}, ${esc(c.label)}: ${esc(o.exReason || 'no reason')} <button class="btn tiny" data-cobs="${o.id}|${c.key}|include">Include again</button></li>`)).join('')}</ul>`) : ''}
      ${nmNotes.length ? `<details class="cx-notes" data-k="nmn" ${ui.open.nmn ? 'open' : ''}><summary>Why some cells are N/M or N/A (${nmNotes.length})</summary><ul class="footnote">${nmNotes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
      ${notes('table', 'comps table')}`;
  };
  function suitability(id, p) {
    const t = cur.target, Mm = E.MULTIPLES[id];
    const met = E.metric(t, Mm.metric, p, cur.settings.normalized !== false).v;
    const col = E.column(cur, id, p);
    const out = [];
    if (!isNum(met)) out.push(['bad', 'Target metric missing.']);
    else if (met <= 0) out.push(['bad', 'Target metric is negative or zero: this multiple cannot value it.']);
    if (col.stats.n < 3) out.push(['bad', `Only ${col.stats.n} valid peer observations.`]);
    if (col.nm) out.push(['warn', `${col.nm} peer(s) N/M.`]);
    if (col.stats.n >= 3 && isNum(col.stats.q1) && col.stats.q1 > 0 && col.stats.q3 / col.stats.q1 > 2) out.push(['warn', 'Wide dispersion: 75th percentile is more than twice the 25th.']);
    const notes = { ev_rev: 'Useful when EBITDA is temporarily negative; ignores differences in profitability.', ev_ebitda: 'Useful for profitable operating companies with similar capital intensity.', ev_ebit: 'Reflects depreciation: better for capital-intensive businesses.', pe: 'Useful for established profitable companies; leverage and accounting differences affect it.', pb: 'Mainly for banks, insurers and asset holders.', p_fcf: 'For mature, stable cash generators.' };
    return { out, note: notes[id], col, met };
  }
  P.multiple = () => {
    const b = E.benchmark(cur), sel = b.sel, t = cur.target;
    const rows = Object.entries(E.MULTIPLES).flatMap(([id, Mm]) => Mm.periods.map(p => { const s = suitability(id, p); const tm = E.targetMultiple(cur, id, p);
      return `<tr class="${sel.multiple === id && sel.period === p ? 'key' : ''}"><td><label class="cx-chk"><input type="radio" name="cx-mult" data-cx-mult="${E.mid(id, p)}" ${sel.multiple === id && sel.period === p ? 'checked' : ''}> ${esc(E.multLabel(id, p))}</label> ${hb('m_' + id)}</td><td>${s.col.stats.n}</td><td>${f.x(s.col.stats.median)}</td><td>${tm.status === 'ok' ? f.x(tm.v) : tm.status.toUpperCase()}</td><td class="cx-note">${s.out.length ? s.out.map(o => pill(o[0], o[1])).join(' ') : pill('good', 'usable')} <div class="footnote">${esc(s.note)}</div></td></tr>`; })).join('');
    const W = sel.weights || {};
    const pw = sel.benchmark === 'weighted' ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Peer</th><th>${esc(b.label)}</th><th>Weight</th></tr></thead><tbody>${b.col.obs.map(o => `<tr><td>${esc(o.ticker || o.name)}</td><td>${o.m.status === 'ok' ? f.x(o.m.v) : o.m.status.toUpperCase()}</td><td><span class="inwrap"><input data-cweight="${o.id}" value="${isNum(W[o.id]) ? W[o.id] : ''}" inputmode="decimal" placeholder="0"></span></td></tr>`).join('')}</tbody></table></div><p class="footnote">Weights are relative (they are normalised to 100%). Explain the weighting in the reason below.</p>` : '';
    const factors = [['growth', 'Growth'], ['profitability', 'Profitability'], ['mix', 'Business mix'], ['moat', 'Competitive advantage'], ['scale', 'Scale'], ['risk', 'Risk'], ['capex', 'Capital intensity'], ['leverage', 'Financial leverage']];
    const tg = E.growth(t), pg = E.stats(E.peerSet(cur).map(E.growth)).median, tmg = E.margin(t, 'ebitda'), pmg = E.stats(E.peerSet(cur).map(c => E.margin(c, 'ebitda'))).median;
    return `<div><h1>Valuation multiple selection ${hb('benchmark')}</h1><p class="lead">Choose the multiple that best fits ${esc(nameOf(t) || 'the target')}'s circumstances, the peer statistic, and any premium or discount. The peer median is a benchmark, not fair value.</p></div>
      ${learn('Each multiple shows the number of valid peer observations, the peer median, the target\'s own current multiple and whether it can value the target. A negative target metric makes that multiple unusable rather than producing a negative value.')}
      ${panel('Multiple', `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Multiple</th><th>n</th><th>Peer median</th><th>Target now</th><th>Suitability</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
      ${panel('Benchmark and adjustment', `<div class="cx-form">
        <label>Peer statistic ${hb('benchmark')}<span class="inwrap"><select data-csel="benchmark">${Object.entries(E.BENCH).map(([k, l]) => opt(k, l, sel.benchmark)).join('')}</select></span></label>
        ${sel.benchmark === 'manual' ? `<label>Manual multiple (×)<span class="inwrap"><input data-cselnum="manual" value="${isNum(sel.manual) ? sel.manual : ''}" inputmode="decimal"></span></label>` : ''}
        <label>Premium (+) or discount (−) ${hb('premium')}<span class="inwrap"><input data-cselnum="premium" data-unit="pct" value="${isNum(sel.premium) && sel.premium !== 0 ? +(sel.premium * 100).toFixed(4) : ''}" inputmode="decimal" placeholder="0"><span class="unit">%</span></span></label></div>
        ${pw}
        <table class="fin cx-kv"><tbody><tr><td>${esc(E.BENCH[sel.benchmark])}</td><td>${f.x(b.base)}</td></tr><tr><td>Premium / discount</td><td>${f.pct(b.premium)}</td></tr><tr class="key"><td>Selected multiple</td><td>${f.x(b.selected)}</td></tr></tbody></table>
        <p class="footnote">${esc(b.note)} Target revenue growth ${plain(f.pct(tg))} vs peer median ${plain(f.pct(pg))}; EBITDA margin ${plain(f.pct(tmg))} vs ${plain(f.pct(pmg))}.</p>
        <h3>Reasons for a premium or discount</h3><p class="footnote">Fill in the factors that apply. A premium or discount without a reason is flagged on the checklist.</p>
        <div class="cx-why">${factors.map(([k, l]) => `<label>${l}<textarea data-cprem="${k}" rows="2">${esc((sel.premiumWhy || {})[k] || '')}</textarea></label>`).join('')}</div>`)}
      ${panel('Analyst low, central and high multiples', `<p class="footnote">Optional. Used for a second valuation range alongside the peer quartiles.</p><div class="cx-form">${['low', 'central', 'high'].map(k => `<label>${k[0].toUpperCase() + k.slice(1)} (×)<span class="inwrap"><input data-cana="${k}" value="${isNum(sel.analyst[k]) ? sel.analyst[k] : ''}" inputmode="decimal"></span></label>`).join('')}</div><label class="cx-desc">Why these multiples<textarea data-cana="why" rows="2">${esc(sel.analyst.why || '')}</textarea></label>`)}
      ${panel('Your decision', `<label class="cx-desc">Why this multiple is appropriate for this company<textarea data-csel="why" rows="3">${esc(sel.why || '')}</textarea></label>
        <label class="cx-chk"><input type="checkbox" data-csel="confirmed" ${sel.confirmed ? 'checked' : ''}> I confirm ${esc(b.label)} at the ${esc(E.BENCH[sel.benchmark].toLowerCase())}${b.premium ? ` with a ${(b.premium * 100).toFixed(1)}% ${b.premium > 0 ? 'premium' : 'discount'}` : ''} as the valuation multiple.</label>`)}
      ${notes('multiple', 'multiple choice')}`;
  };
  function stepsTable(imp) {
    if (!imp.steps.length && imp.error) return `<div class="notice bad">${esc(imp.error)}</div>`;
    return `<table class="fin cx-steps-t"><thead><tr><th>Step</th><th style="text-align:left">Calculation</th><th>Result</th></tr></thead><tbody>${imp.steps.map(s => `<tr><td>${esc(s.label)}</td><td style="text-align:left">${esc(s.formula)}</td><td>${s.pct ? f.up(s.v) : /per share/i.test(s.label) ? f.px(s.v, cur.target.priceCurrency) : f.mm(s.v)}</td></tr>`).join('')}</tbody></table>${imp.error ? `<div class="notice bad">${esc(imp.error)}</div>` : ''}${imp.warnings.map(w => `<div class="notice">${esc(w)}</div>`).join('')}`;
  }
  P.implied = () => {
    const b = E.benchmark(cur), imp = E.implied(cur, b.selected), r = E.range(cur), t = cur.target;
    const Mm = E.MULTIPLES[b.sel.multiple];
    const bridge = imp.bridge ? `<table class="fin cx-kv"><thead><tr><th>Enterprise-to-equity bridge</th><th>$mm</th></tr></thead><tbody><tr><td>Implied enterprise value</td><td>${f.mm(imp.ev)}</td></tr>${imp.bridge.map(l => `<tr class="sub"><td>${l.sign > 0 ? '− ' : '+ '}${esc(l.label)}</td><td>${f.mm(l.v)}</td></tr>`).join('')}${(imp.notReported || []).map(k => `<tr class="sub cx-off"><td>${esc(D.label(k))}: not reported (none)</td><td>–</td></tr>`).join('')}<tr class="key"><td>Implied equity value</td><td>${f.mm(imp.equity)}</td></tr></tbody></table>` : Mm.kind === 'eq' ? '<p class="footnote">An equity multiple gives equity value (or value per share) directly, so no enterprise-to-equity bridge is applied.</p>' : '';
    const rr = (rows, title) => rows.length ? `<h3>${title}</h3><div class="tbl-wrap"><table class="fin"><thead><tr><th>Case</th><th>Multiple</th><th>Target metric</th><th>Implied EV</th><th>Implied equity</th><th>Per share</th><th>Upside</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.name)}</td><td>${f.x(x.mult)}</td><td>${Mm.metric === 'eps' ? f.px(x.metric && x.metric.v) : f.mm(x.metric && x.metric.v)}</td><td>${Mm.kind === 'ev' ? f.mm(x.ev) : '–'}</td><td>${f.mm(x.equity)}</td><td>${x.error ? `<span class="na" title="${esc(x.error)}">n/a</span>` : f.px(x.perShare, t.priceCurrency)}</td><td>${f.up(x.upside)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const allM = Object.entries(E.MULTIPLES).flatMap(([id, MM]) => MM.periods.map(p => { const col = E.column(cur, id, p); if (!col.stats.n) return ''; const x = E.implied(cur, col.stats.median, { multiple: id, period: p }); return `<tr><td>${esc(E.multLabel(id, p))}</td><td>${col.stats.n}</td><td>${f.x(col.stats.median)}</td><td>${x.error ? `<span class="na" title="${esc(x.error)}">${x.nm ? 'N/M' : 'n/a'}</span>` : f.px(x.perShare, t.priceCurrency)}</td><td>${f.up(x.upside)}</td></tr>`; })).join('');
    return `<div><h1>Implied valuation ${hb('impliedEv')}</h1><p class="lead">${esc(b.label)} at ${f.x(b.selected)} (${esc(E.BENCH[b.sel.benchmark].toLowerCase())}${b.premium ? `, ${(b.premium * 100).toFixed(1)}% ${b.premium > 0 ? 'premium' : 'discount'}` : ''}), applied to the target's ${esc(E.PERIODS[b.sel.period] || '')} ${esc(Mm.metric === 'book' ? 'book equity' : E.METRICS[Mm.metric].label)}.</p></div>
      ${learn(Mm.kind === 'ev' ? 'Implied EV = multiple × target metric. Implied equity = EV − debt and other claims + cash and non-operating assets, using exactly the lines of the target\'s own EV build. Per share = equity ÷ shares on the model\'s share basis.' : 'P/E gives a value per share directly (multiple × diluted EPS). No enterprise-to-equity bridge is applied to an equity multiple.')}
      <div class="grid2">${panel('Step by step', stepsTable(imp), { help: 'perShare' })}${panel('Bridge', bridge || '<p class="footnote">Available once the implied EV is calculated.</p>', { help: 'bridge' })}</div>
      ${panel('Valuation range', `${rr(r.rows, 'Peer quartiles')}${rr(r.arows, 'Analyst low, central and high')}<p class="footnote">This range reflects where peers are priced and the multiples you chose. It is not a probability distribution of Bear, Base and Bull business outcomes. ${hb('range')}</p>`, { help: 'range' })}
      ${panel('Every multiple at the peer median', allM ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Multiple</th><th>n</th><th>Median</th><th>Per share</th><th>Upside</th></tr></thead><tbody>${allM}</tbody></table></div><p class="footnote">For cross-checking only; the selected multiple drives the valuation.</p>` : '<p>No multiples with valid peer observations yet.</p>')}
      ${notes('implied', 'implied valuation')}`;
  };
  function gridTable(g, rowLab, colLab, colFmt) {
    if (g.error) return `<div class="notice">${esc(g.error)}</div>`;
    const price = E.val(cur.target, 'price');
    return `<div class="tbl-wrap"><table class="fin cx-sens"><thead><tr><th>${rowLab} ↓ / ${colLab} →</th>${g.cols.map(c => `<th>${colFmt(c)}</th>`).join('')}</tr></thead><tbody>${g.mults.map((m, i) => `<tr><td>${f.x(m)}</td>${g.grid[i].map(x => `<td class="${isNum(x.perShare) && isNum(price) ? (x.perShare >= price ? 'cx-up' : 'cx-dn') : ''}" title="${x.error ? esc(x.error) : ''}">${x.error ? NA : f.px(x.perShare, cur.target.priceCurrency)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  P.sensitivity = () => {
    const s = cur.sens, b = E.benchmark(cur);
    const g1 = E.sensGrid(cur, { multStep: s.multStep, multN: s.multN, metStep: s.metStep, metN: s.metN }); g1.cols = g1.deltas || [];
    const g2 = E.growthGrid(cur, { multStep: s.multStep, multN: s.multN, gCenter: s.gCenter, gStep: s.gStep, gN: s.gN }); g2.cols = g2.gs || [];
    const ps = E.peerSens(cur);
    const t = cur.target;
    const ctl = `<div class="cx-form"><label>Multiple step (×)<span class="inwrap"><input data-csens="multStep" value="${isNum(s.multStep) ? s.multStep : ''}" placeholder="auto (10%)" inputmode="decimal"></span></label><label>Multiple rows<span class="inwrap"><input data-csens="multN" value="${s.multN}" inputmode="numeric"></span></label>
      <label>Metric step<span class="inwrap"><input data-csens="metStep" data-unit="pct" value="${+(s.metStep * 100).toFixed(4)}" inputmode="decimal"><span class="unit">%</span></span></label><label>Metric columns<span class="inwrap"><input data-csens="metN" value="${s.metN}" inputmode="numeric"></span></label>
      <label>Growth centre<span class="inwrap"><input data-csens="gCenter" data-unit="pct" value="${+(s.gCenter * 100).toFixed(4)}" inputmode="decimal"><span class="unit">%</span></span></label><label>Growth step<span class="inwrap"><input data-csens="gStep" data-unit="pct" value="${+(s.gStep * 100).toFixed(4)}" inputmode="decimal"><span class="unit">%</span></span></label></div>`;
    // chart: implied value per share across multiples (target metric unchanged)
    const pts = (g1.mults || []).map((m, i) => ({ x: m, y: g1.grid[i][Math.floor(g1.deltas.length / 2)].perShare }));
    return `<div><h1>Sensitivity analysis ${hb('sens')}</h1><p class="lead">How the implied value per share moves with the multiple, the target metric, forward growth and the choice of peers. Every cell is a full recalculation with the model's inputs. Shaded green: above the current price.</p></div>
      ${panel('Ranges', ctl)}
      ${panel(`${esc(g1.label || b.label)}: multiple vs change in target metric`, gridTable(g1, 'Multiple', 'Metric change', d => (d >= 0 ? '+' : '') + (d * 100).toFixed(1) + '%') + (isNum(g1.metric) ? `<p class="footnote">Base target metric ${E.MULTIPLES[g1.id].metric === 'eps' ? plain(f.px(g1.metric)) : plain(f.mm(g1.metric)) + ' $mm'}.</p>` : ''))}
      ${panel('Chart: implied value per share vs multiple', lineChart(pts, E.val(t, 'price'), b.selected, b.label))}
      ${panel(`Forward growth vs multiple (${esc(E.MULTIPLES[b.sel.multiple].label)} on TTM metric × (1 + growth))`, gridTable(g2, 'Multiple', 'Forward growth', g => (g * 100).toFixed(1) + '%') + '<p class="footnote">Approximates a forward metric by growing the TTM figure. Compare with consensus NTM figures where available; this is a what-if, not an estimate.</p>')}
      ${panel('Peer selection vs implied value', `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Peer set</th><th>n</th><th>Selected multiple</th><th>Per share</th></tr></thead><tbody>
        ${ps.groups.map(g => `<tr ${g.group === cur.selection.group ? 'class="key"' : ''}><td>${esc(g.label)}</td><td>${g.n}</td><td>${f.x(g.mult)}</td><td>${f.px(g.perShare, t.priceCurrency)}</td></tr>`).join('')}
        ${ps.rows.map(r => `<tr class="sub"><td>Without ${esc(r.ticker || r.name)}</td><td>${r.n}</td><td>${f.x(r.mult)}</td><td>${f.px(r.perShare, t.priceCurrency)}</td></tr>`).join('')}</tbody></table></div><p class="footnote">If removing one peer moves the value a lot, the conclusion depends on that company.</p>`)}
      ${notes('sens', 'sensitivity')}`;
  };

  // ---------- charts (SVG; colours from CSS variables so they follow light and dark mode) ----------
  function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => span / s <= n + 0.01) || p * 10; }
  function axis(lo, hi, n) { if (lo === hi) { lo -= 1; hi += 1; } const st = niceStep(hi - lo, n); return { lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, st }; }
  function lineChart(pts, price, sel, label) {
    pts = pts.filter(p => isNum(p.x) && isNum(p.y)); if (pts.length < 2) return '<p class="footnote">Needs a selected multiple and the target metric.</p>';
    const W = 560, Hh = 240, L = 58, R = W - 16, T = 16, B = Hh - 34;
    const ys = pts.map(p => p.y).concat(isNum(price) ? [price] : []);
    const ax = axis(Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x)), 6), ay = axis(Math.min(0, ...ys), Math.max(...ys), 5);
    const X = v => L + (v - ax.lo) / (ax.hi - ax.lo) * (R - L), Y = v => B - (v - ay.lo) / (ay.hi - ay.lo) * (B - T);
    let s = `<svg class="chart cx-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Implied value per share against the ${esc(label)} multiple">`;
    for (let v = ay.lo; v <= ay.hi + 1e-9; v += ay.st) s += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">$${+v.toFixed(2)}</text>`;
    for (let v = ax.lo; v <= ax.hi + 1e-9; v += ax.st) s += `<text x="${X(v)}" y="${Hh - 16}" text-anchor="middle" class="tick">${+v.toFixed(2)}×</text>`;
    s += `<text x="${(L + R) / 2}" y="${Hh - 2}" text-anchor="middle" class="tick">${esc(label)} multiple</text>`;
    if (isNum(price)) s += `<line x1="${L}" x2="${R}" y1="${Y(price)}" y2="${Y(price)}" class="price"/><text x="${R}" y="${Y(price) - 5}" text-anchor="end" class="price-t">Price $${price.toFixed(2)}</text>`;
    s += `<polyline points="${pts.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}" fill="none" stroke="var(--blue)" stroke-width="2"/>`;
    pts.forEach(p => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="var(--blue)" stroke="var(--surface)" stroke-width="2"><title>${p.x.toFixed(2)}×: $${p.y.toFixed(2)}</title></circle>`; });
    if (isNum(sel)) { const sp = pts.reduce((a, p) => Math.abs(p.x - sel) < Math.abs(a.x - sel) ? p : a, pts[0]); s += `<circle cx="${X(sp.x)}" cy="${Y(sp.y)}" r="6" fill="none" stroke="var(--ink)" stroke-width="2"/><text x="${X(sp.x) + 9}" y="${Y(sp.y) - 8}" class="val">Selected ${sp.x.toFixed(2)}× → $${sp.y.toFixed(2)}</text>`; }
    return s + '</svg>';
  }
  function barChart(items, median, label) {
    items = items.filter(i => isNum(i.v)); if (!items.length) return '<p class="footnote">No valid observations.</p>';
    items.sort((a, b) => b.v - a.v);
    const W = 560, rowH = 24, T = 10, L = 120, R = W - 60, Hh = T + items.length * rowH + 26;
    const ax = axis(0, Math.max(...items.map(i => i.v), isNum(median) ? median : 0), 5);
    const X = v => L + (v - ax.lo) / (ax.hi - ax.lo) * (R - L);
    let s = `<svg class="chart cx-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(label)}: target and peers">`;
    for (let v = ax.lo; v <= ax.hi + 1e-9; v += ax.st) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${Hh - 22}" stroke="var(--line)"/><text x="${X(v)}" y="${Hh - 8}" text-anchor="middle" class="tick">${+v.toFixed(1)}×</text>`;
    items.forEach((it, i) => { const y = T + i * rowH; s += `<text x="${L - 8}" y="${y + 15}" text-anchor="end" class="lab ${it.target ? 'strong' : ''}">${esc(it.label)}</text><rect x="${L}" y="${y + 4}" width="${Math.max(2, X(it.v) - L)}" height="14" rx="4" fill="${it.target ? 'var(--navy)' : it.out ? 'var(--chart-grey)' : 'var(--blue)'}"><title>${esc(it.label)}: ${it.v.toFixed(2)}×${it.target ? ' (target, not in statistics)' : ''}</title></rect>${it.target ? `<text x="${X(it.v) + 6}" y="${y + 15}" class="val">${it.v.toFixed(2)}×</text>` : ''}`; });
    if (isNum(median)) s += `<line x1="${X(median)}" x2="${X(median)}" y1="${T - 4}" y2="${Hh - 22}" class="price"/><text x="${X(median) + 4}" y="${T + 6}" class="price-t">Median ${median.toFixed(2)}×</text>`;
    return s + '</svg>';
  }
  function scatter(points, xLab, yLab) {
    const pts = points.filter(p => isNum(p.x) && isNum(p.y)); if (pts.length < 2) return '<p class="footnote">Needs at least two companies with both figures.</p>';
    const W = 560, Hh = 280, L = 52, R = W - 20, T = 14, B = Hh - 38;
    const ax = axis(Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x)), 6), ay = axis(Math.min(0, ...pts.map(p => p.y)), Math.max(...pts.map(p => p.y)), 5);
    const X = v => L + (v - ax.lo) / (ax.hi - ax.lo) * (R - L), Y = v => B - (v - ay.lo) / (ay.hi - ay.lo) * (B - T);
    let s = `<svg class="chart cx-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(yLab)} against ${esc(xLab)}">`;
    for (let v = ay.lo; v <= ay.hi + 1e-9; v += ay.st) s += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">${+v.toFixed(1)}×</text>`;
    for (let v = ax.lo; v <= ax.hi + 1e-9; v += ax.st) s += `<text x="${X(v)}" y="${B + 16}" text-anchor="middle" class="tick">${+(v * 100).toFixed(0)}%</text>`;
    s += `<text x="${(L + R) / 2}" y="${Hh - 4}" text-anchor="middle" class="tick">${esc(xLab)}</text>`;
    // least-squares line through the peers (not the target): shows how the market prices the driver
    const pe = pts.filter(p => !p.target);
    if (pe.length >= 3) { const mx = pe.reduce((a, p) => a + p.x, 0) / pe.length, my = pe.reduce((a, p) => a + p.y, 0) / pe.length; const sxx = pe.reduce((a, p) => a + (p.x - mx) ** 2, 0); if (sxx > 0) { const sl = pe.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx, ic = my - sl * mx; const ss = pe.reduce((a, p) => a + (p.y - ic - sl * p.x) ** 2, 0), st = pe.reduce((a, p) => a + (p.y - my) ** 2, 0); const r2 = st > 0 ? 1 - ss / st : null;
      s += `<line x1="${X(ax.lo)}" y1="${Y(ic + sl * ax.lo)}" x2="${X(ax.hi)}" y2="${Y(ic + sl * ax.hi)}" stroke="var(--faint)" stroke-dasharray="4 4"/><text x="${R}" y="${T + 10}" text-anchor="end" class="tick">Peer fit: ${(sl / 100).toFixed(3)}× per point${isNum(r2) ? ', R² ' + r2.toFixed(2) : ''}</text>`; } }
    pts.forEach(p => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.target ? 6 : 4.5}" fill="${p.target ? 'var(--navy)' : 'var(--blue)'}" stroke="var(--surface)" stroke-width="2"><title>${esc(p.label)}: ${(p.x * 100).toFixed(1)}%, ${p.y.toFixed(2)}×</title></circle><text x="${X(p.x) + 8}" y="${Y(p.y) + 4}" class="lab ${p.target ? 'strong' : ''}">${esc(p.label)}</text>`; });
    return s + '</svg>';
  }
  function football(rowsIn, price) {
    if (!rowsIn.length) return '<p class="footnote">No ranges yet.</p>';
    return `<div class="football">${DCFCharts.football(rowsIn, { price, label: 'Implied value per share ranges' })}</div>`;
  }

  P.summary = () => {
    const { comp, b, imp } = calc(); const t = cur.target, r = E.range(cur);
    const peers = E.peerSet(cur);
    const e = E.evBuild(t, cur.settings);
    const tm = E.targetMultiple(cur, b.sel.multiple, b.sel.period);
    const items = b.col.obs.filter(o => o.m.status === 'ok' && !o.excluded).map(o => ({ label: o.ticker || o.name, v: o.m.v, out: o.outlier })).concat(tm.status === 'ok' ? [{ label: (t.ticker || 'Target') + ' (target)', v: tm.v, target: true }] : []);
    const sc = (fx) => peers.map(c => { const m = E.multiple(c, b.sel.multiple, b.sel.period, cur.settings); return { label: c.ticker || c.name, x: fx(c), y: m.status === 'ok' ? m.v : null }; }).concat([{ label: t.ticker || 'Target', x: fx(t), y: tm.status === 'ok' ? tm.v : null, target: true }]);
    const ff = E.footballRows(cur).map(x => ({ label: x.label, lo: x.lo, hi: x.hi, kind: x.id === b.sel.multiple && x.p === b.sel.period ? 'base' : 'range' }));
    if (r.arows.length > 1) { const v = r.arows.map(x => x.perShare).filter(isNum); if (v.length > 1) ff.push({ label: 'Analyst range', lo: Math.min(...v), hi: Math.max(...v), kind: 'bull' }); }
    const kv = (k, v) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`;
    const dates = [t.priceDate ? 'price ' + t.priceDate : null, t.v.rev_ttm && t.v.rev_ttm.src && t.v.rev_ttm.src.end ? 'TTM to ' + t.v.rev_ttm.src.end : null, 'model saved ' + (cur.savedAt ? cur.savedAt.slice(0, 10) : 'not yet')].filter(Boolean).join(' · ');
    return `<div><h1>Valuation summary</h1><p class="lead">${esc(t.name || 'Target')}${t.ticker ? ' (' + esc(t.ticker) + ')' : ''}: relative value from ${peers.length} ${esc(E.groupLabel(cur, cur.selection.group).toLowerCase())}. ${comp.valued ? '' : '<b>Incomplete:</b> ' + esc(imp.error || 'see the checklist')}</p></div>
      <div class="btns"><button class="btn primary" data-cx-export="xlsx">Export Excel workbook</button><button class="btn" data-cx-export="pdf">Export PDF summary</button><button class="btn" data-cx-export="notes">Export research notes & sources</button><span class="footnote" id="cx-xl-status"></span></div>
      <div class="grid2">${panel('Key figures', `<table class="kv num"><tbody>
        ${kv('Current share price', f.px(E.val(t, 'price'), t.priceCurrency) + (t.priceDate ? ` <small>${esc(t.priceDate)}</small>` : ''))}${kv('Market capitalisation ($mm)', f.mm(e.mc.v))}${kv('Enterprise value ($mm)', f.mm(e.v))}
        ${kv('Peer group', esc(E.groupLabel(cur, cur.selection.group)) + ` (${peers.length})`)}${kv('Selected multiple', esc(b.label) + ' ' + f.x(b.selected))}${kv('Peer median', f.x(b.col.stats.median))}
        ${kv('Target metric', imp.metric ? (E.MULTIPLES[b.sel.multiple].metric === 'eps' ? f.px(imp.metric.v) : f.mm(imp.metric.v)) : NA)}${kv('Implied enterprise value ($mm)', f.mm(imp.ev))}${kv('Implied equity value ($mm)', f.mm(imp.equity))}
        <tr class="hl"><th scope="row">Implied value per share</th><td>${f.px(imp.perShare, t.priceCurrency)}</td></tr>
        ${kv('Range (25th–75th percentile)', r.rows[0] && isNum(r.rows[0].perShare) && isNum(r.rows[2].perShare) ? `${f.px(r.rows[0].perShare)} – ${f.px(r.rows[2].perShare)}` : NA)}${kv('Upside / downside', f.up(imp.upside))}
        </tbody></table><p class="footnote">Dates: ${esc(dates)}. Sources on ${link('sources', 'Sources & research notes')}.</p>`)}
        ${panel(`Target vs peers: ${esc(b.label)}`, barChart(items, b.col.stats.median, b.label) + '<p class="footnote">Dark bar: target (shown for comparison, not in the statistics). Grey: flagged outlier.</p>')}</div>
      <div class="grid2">${panel(`Revenue growth vs ${esc(b.label)}`, scatter(sc(E.growth), 'Revenue growth', b.label))}${panel(`EBITDA margin vs ${esc(b.label)}`, scatter(sc(c => E.margin(c, 'ebitda')), 'EBITDA margin', b.label))}</div>
      ${panel('Implied valuation ranges (25th–75th percentile of each multiple)', football(ff, E.val(t, 'price')) + '<p class="footnote">Blue: the selected multiple. These are ranges of peer pricing, not business scenarios.</p>')}
      ${panel('Valuation conclusion', `<p class="footnote">Your own words. Nothing here is generated: no investment recommendation is made by the model.</p><textarea data-cx-conclusion rows="5" placeholder="What the comps imply, how much weight you give them, and the main risks.">${esc(cur.conclusion || '')}</textarea>`)}
      ${notes('summary', 'summary')}`;
  };
  function dcfModels() { try { return typeof DCFModel !== 'undefined' ? Object.values(DCFModel.loadAll()).sort((a, b) => b.updated.localeCompare(a.updated)) : []; } catch (e) { return []; } }
  function matchDcf() {
    const list = dcfModels(); const t = cur.target;
    if (cur.dcfLink) { const m = list.find(x => x.id === cur.dcfLink); if (m) return m; }
    const tk = (t.ticker || '').toUpperCase(), cik = t.cik ? String(t.cik).replace(/^0+/, '') : null;
    return list.find(m => (m.meta && m.meta.symbol && m.meta.symbol.toUpperCase() === tk && tk) || (cik && m.meta && m.meta.cik && String(m.meta.cik).replace(/^0+/, '') === cik)) || null;
  }
  P.dcf = () => {
    const list = dcfModels(); const m = (ui.dcfSel && list.find(x => x.id === ui.dcfSel)) || matchDcf();
    const { b, imp } = calc(); const t = cur.target, r = E.range(cur);
    const price = E.val(t, 'price');
    let body = '';
    if (!list.length) body = '<p>No DCF models are saved in this browser. Build one in the DCF calculator first.</p>';
    else if (!m) body = '<p>No DCF model matches this target. Pick one below.</p>';
    else {
      let res = null, comp = null, err = null;
      try { const ei = DCFModel.engineInputs(DCFModel.upgrade(JSON.parse(JSON.stringify(m)))); res = DCF.runAll(ei.inp, m.mode); comp = DCFModel.completion(m); } catch (e) { err = e.message; }
      const ready = comp && Object.values(comp).every(g => g.items.every(i => i.ok)) && res && isNum(res.weighted);
      const dv = ready ? res.weighted : null;
      const cmp = E.dcfCompare(dv, imp.perShare, price);
      const flags = [];
      const dPrice = m.inputs && m.inputs.price, dDate = (m.asOf && m.asOf.price) || (m.inputs && m.inputs.company && m.inputs.company.valDate);
      if (isNum(dPrice) && isNum(price) && Math.abs(dPrice / price - 1) > 0.001) flags.push(`The DCF uses a share price of ${plain(f.px(dPrice))}${dDate ? ' (' + dDate + ')' : ''}; Trading Comps uses ${plain(f.px(price))}${t.priceDate ? ' (' + t.priceDate + ')' : ''}. Differences against "the price" are measured at different dates.`);
      if (dDate && t.priceDate && dDate !== t.priceDate) flags.push(`Observation dates differ: DCF ${dDate}, comps ${t.priceDate}.`);
      flags.push(`Share basis: the DCF divides by its diluted share count (treasury stock method); Trading Comps uses ${cur.settings.shareBasis === 'diluted' ? 'basic + net dilutive shares' : 'basic actual shares'}.${cur.settings.shareBasis === 'basic' ? ' Switch to the diluted basis on Financial adjustments for a closer comparison.' : ''}`);
      const ff = [];
      if (ready) { const sc = ['Bear', 'Base', 'Bull'].map(s => res.scen[s] && res.scen[s].perShare).filter(isNum); if (sc.length) ff.push({ label: 'DCF Bear–Bull', lo: Math.min(...sc), hi: Math.max(...sc), kind: 'range' }); ff.push({ label: 'DCF weighted', lo: dv, hi: dv, kind: 'point' }); }
      if (r.rows[0] && isNum(r.rows[0].perShare) && isNum(r.rows[2].perShare)) ff.push({ label: 'Comps 25th–75th', lo: Math.min(r.rows[0].perShare, r.rows[2].perShare), hi: Math.max(r.rows[0].perShare, r.rows[2].perShare), kind: 'base' });
      if (isNum(imp.perShare)) ff.push({ label: 'Comps selected', lo: imp.perShare, hi: imp.perShare, kind: 'point' });
      body = `<p>Comparing with DCF model <b>${esc(m.name)}</b>${cur.dcfLink === m.id ? ' (linked)' : ''}. ${ready ? '' : '<span class="pill bad">DCF incomplete</span> The DCF has missing inputs, so no DCF value is compared. Finish it in the DCF calculator.'}${err ? ' ' + esc(err) : ''}</p>
        <table class="fin"><thead><tr><th>Measure</th><th>Value per share</th><th>vs market price</th></tr></thead><tbody>
        <tr><td>DCF intrinsic value (probability-weighted)</td><td>${ready ? f.px(dv) : 'incomplete'}</td><td>${f.up(cmp.dcfVsPrice)}</td></tr>
        ${ready ? ['Bear', 'Base', 'Bull'].map(s => `<tr class="sub"><td>DCF ${s}</td><td>${f.px(res.scen[s].perShare)}</td><td>${f.up(isNum(price) && isNum(res.scen[s].perShare) ? res.scen[s].perShare / price - 1 : null)}</td></tr>`).join('') : ''}
        <tr><td>Trading Comps implied (${esc(b.label)})</td><td>${isNum(imp.perShare) ? f.px(imp.perShare) : 'incomplete'}</td><td>${f.up(cmp.compsVsPrice)}</td></tr>
        <tr><td>Current market price</td><td>${f.px(price)}</td><td></td></tr>
        <tr class="key"><td>DCF vs Comps</td><td>${isNum(cmp.gap) ? f.px(cmp.gap) : NA}</td><td>${f.pct(cmp.dcfVsComps)} ${isNum(cmp.dcfVsComps) ? '(DCF relative to comps)' : ''}</td></tr></tbody></table>
        ${flags.map(x => `<div class="notice">${esc(x)}</div>`).join('')}
        ${ff.length ? football(ff, price) : ''}`;
    }
    return `<div><h1>DCF comparison ${hb('dcfComp')}</h1><p class="lead">DCF estimates value from discounted projected cash flows. Trading Comps estimate relative value from how similar public companies are priced. Neither guarantees a correct market price, and the two are not forced to agree.</p></div>
      ${panel('Comparison', body + (list.length ? `<div class="btns"><span class="inwrap"><select id="cx-dcf-pick">${list.map(x => opt(x.id, x.name, m && m.id)).join('')}</select></span><button class="btn" data-cx-dcfpick>Compare with this DCF</button>${m ? `<button class="btn ghost" data-cx-dcflink="${m.id}">${cur.dcfLink === m.id ? 'Linked' : 'Link this DCF to the comps model'}</button><a class="btn ghost" href="#dashboard">Open the DCF calculator</a>` : ''}</div>` : ''))}
      ${notes('dcf', 'why DCF and comps differ')}`;
  };
  P.sources = () => {
    const rows = all().flatMap(c => Object.entries(c.v).filter(([, r]) => r && r.src).map(([k, r]) => `<tr><td>${esc(nameOf(c))}</td><td>${esc(D.label(k))}</td><td>${Math.abs(r.v) < 1000 && !/^(rev|gp|ebitda|ebit|ni|capex|fcf|da|cfo)_/.test(k) && k !== 'cash' ? (isNum(r.v) ? r.v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : NA) : f.mm(r.v)}</td><td><button class="cx-srcb" data-csrc="${c.id}|${k}">${(CAT[r.src.cat] || ['Src'])[0]}</button> ${esc(r.src.provider || '')}</td><td class="cx-note">${esc(r.src.period || '')}${r.src.form ? ' · ' + esc(r.src.form) : ''}${r.src.filed ? ' filed ' + esc(r.src.filed) : ''}</td><td>${r.src.url ? `<a href="${esc(r.src.url)}" target="_blank" rel="noopener">link</a>` : ''}</td><td class="cx-note">${esc(r.src.retrieved || '')}</td></tr>`)).join('');
    const nts = Object.entries(cur.notes).filter(([, v]) => v && v.trim());
    return `<div><h1>Sources & research notes</h1><p class="lead">Every figure used, with its provider, period, filing and link, and every note you wrote. Click a badge for the original amount and the history of changes.</p></div>
      <div class="btns"><button class="btn" data-cx-export="notes">Export notes & sources (Markdown)</button><button class="btn" data-cx-export="xlsx">Export Excel workbook</button></div>
      ${panel('Figures and sources', rows ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Company</th><th>Figure</th><th>Value</th><th>Source</th><th>Period</th><th>Link</th><th>Imported</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>No figures yet.</p>')}
      ${panel('Research notes', nts.length ? nts.map(([k, v]) => `<h3>${esc(noteTitle(k))}</h3><p class="cx-pre">${esc(v)}</p>`).join('') : '<p class="footnote">No notes yet. Every page has an optional "My research notes" box, and each guide (?) has one too.</p>')}
      ${panel('Guide sources', `<ul>${Object.values(H.S).map(s => `<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a></li>`).join('')}</ul>`)}
      ${panel('Change log', cur.log.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>When</th><th>What</th><th>From</th><th>To</th></tr></thead><tbody>${cur.log.slice(0, 200).map(l => `<tr><td>${esc(l.at.slice(0, 16).replace('T', ' '))}</td><td>${esc(l.field)}</td><td>${esc(l.from == null ? '' : String(l.from))}</td><td>${esc(l.to == null ? '' : String(l.to))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">No changes yet.</p>')}`;
  };
  function noteTitle(k) { if (k.startsWith('co-')) { const c = byId(k.slice(3)); return 'Company: ' + nameOf(c); } if (k.startsWith('g-')) return 'Guide: ' + ((H.G[k.slice(2)] || {}).t || k); return ({ peers: 'Peer selection', excluded: 'Excluded peers', adjust: 'Adjustments', table: 'Comps table', multiple: 'Multiple choice', implied: 'Implied valuation', sens: 'Sensitivity', summary: 'Summary', dcf: 'DCF comparison' })[k] || k; }
  P.saved = () => {
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated));
    return `<div><h1>Saved Trading Comps models</h1><p class="lead">Stored in this browser under their own key, separate from DCF models. Save a model file to keep a copy or move it to another computer.</p></div>
      ${panel('Models', list.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Name</th><th>Target</th><th>Peers</th><th>Updated</th><th>Saved</th><th></th></tr></thead><tbody>${list.map(m => `<tr ${m.id === cur.id ? 'class="key"' : ''}><td>${m.id === cur.id ? `<span class="inwrap"><input type="text" class="txt" data-cx-rename value="${esc(m.name)}" aria-label="Model name"></span>` : esc(m.name)}</td><td>${esc(m.target.ticker || m.target.name || '')}</td><td>${m.peers.length}</td><td>${esc(m.updated.slice(0, 16).replace('T', ' '))}</td><td>${m.savedAt ? esc(m.savedAt.slice(0, 10)) : 'autosaved'}</td><td>${m.id === cur.id ? '<span class="tag">open</span>' : `<button class="btn tiny" data-cx-open="${m.id}">Open</button>`} <button class="btn tiny" data-cx-dup="${m.id}">Duplicate</button> ${confirm && confirm.del === m.id ? `<button class="btn tiny danger" data-cx-del2="${m.id}">Confirm delete</button> <button class="btn tiny" data-cx-cancel>Cancel</button>` : `<button class="btn tiny danger" data-cx-del="${m.id}">Delete</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p>No saved models yet. Changes are saved automatically once you start.</p>')}
      ${panel('Files', `<div class="btns"><button class="btn" data-cx-export="json">Save model file (.json)</button><label class="btn">Open model file<input type="file" id="cx-open-file" accept=".json,application/json" hidden></label><button class="btn" data-cx-export="xlsx">Export Excel workbook</button></div><p class="footnote">Peer list templates are on ${link('peers', 'Peer selection')}.</p>`)}`;
  };

  // ---------- drawers and modal ----------
  function renderDrawer() {
    const root = $('#drawer-root');
    if (!drawer) { if (root.dataset.owner === 'comps') root.innerHTML = ''; return; }
    root.dataset.owner = 'comps';
    let h = '';
    if (drawer.type === 'help') {
      const g = H.G[drawer.key]; if (!g) { drawer = null; root.innerHTML = ''; return; }
      const sec = H.ORDER.map(([title, k], i) => {
        let body = g[k];
        if (k === 'mistakes') body = `<ul>${g.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
        else if (k === 'src') body = `<ul>${g.src.map(s => H.S[s]).filter(Boolean).map(s => `<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a> <span class="tag">${s[2] === 'direct' ? 'data' : s[2] === 'raw' ? 'search' : 'method'}</span></li>`).join('')}</ul>${companySrc(drawer.key)}`;
        else body = `<p>${esc(body)}</p>`;
        return `<details ${i < 2 || ui.open['h' + i] ? 'open' : ''} data-k="h${i}"><summary>${i + 1}. ${title}</summary>${body}</details>`;
      }).join('');
      h = `<h2 id="cx-dr-title">${esc(g.t)}</h2><div class="cx-guide">${sec}<details open><summary>10. My research notes</summary><textarea data-cnote="g-${esc(drawer.key)}" rows="4" placeholder="Saved with this comps model.">${esc(cur.notes['g-' + drawer.key] || '')}</textarea></details></div>`;
    } else {
      const c = byId(drawer.cid); const r = c && c.v[drawer.key];
      if (!r) { drawer = null; root.innerHTML = ''; return; }
      const s = r.src || {};
      const dl = [['Value', isNum(r.v) ? r.v.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + (s.unit || '') : 'missing'], ['Kind', (CAT[s.cat] || ['', s.cat])[1]], ['Provider', s.provider], ['Original reported amount', isNum(s.orig) ? s.orig.toLocaleString('en-US') + ' ' + (s.origUnit || '') : null], ['Currency', s.currency], ['Period', s.period], ['Form', s.form ? s.form + (s.accn ? ' · ' + s.accn : '') : null], ['Filed', s.filed], ['Market observation date', s.asOf], ['XBRL concept', s.concept], ['Method', s.method], ['Definition', s.definition], ['Analysts', s.analysts], ['Imported', s.retrieved], ['Stale', s.stale ? s.staleNote : null]].filter(x => x[1] !== null && x[1] !== undefined && x[1] !== '');
      h = `<h2 id="cx-dr-title">${esc(nameOf(c))}: ${esc(D.label(drawer.key))}</h2><dl>${dl.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${s.url ? `<p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open the source</a></p>` : ''}
        ${s.parts && s.parts.length ? `<h3>Built from</h3><ul>${s.parts.map(p => `<li>${esc(p.metric)}: ${isNum(p.value) ? p.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''} (${esc(p.period || '')}${p.form ? ', ' + esc(p.form) : ''}) ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">filing</a>` : ''}</li>`).join('')}</ul>` : ''}
        ${r.hist && r.hist.length ? `<h3>History</h3><ul>${r.hist.slice().reverse().map(x => `<li>${isNum(x.v) ? x.v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : 'missing'} · ${esc((x.src && x.src.provider) || '')} · ${esc(x.why || '')} ${esc(String(x.at || '').slice(0, 10))}</li>`).join('')}</ul>${s.cat === 'manual' && r.hist.some(x => x.src && x.src.cat !== 'manual') ? `<button class="btn" data-crestore="${c.id}|${drawer.key}">Restore the imported figure</button>` : ''}` : ''}`;
    }
    root.innerHTML = `<div class="scrim" data-cx-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="cx-dr-title"><button class="btn close" data-cx-close aria-label="Close">Close</button>${h}</aside>`;
    const cl = root.querySelector('.close'); if (cl && !drawer.keepFocus) cl.focus();
  }
  function companySrc(key) {
    const c = cur.target; const cik = c.cik ? String(c.cik).replace(/^0+/, '') : null;
    if (!cik) return '<p class="footnote">Import the target to get direct links to its own filings here.</p>';
    const q = { shares: 'shares of common stock outstanding', cash: 'cash and cash equivalents', ltdNoncurrent: 'long-term debt', ltdCurrent: 'current portion of long-term debt', stBorrow: 'short-term borrowings', finLease: 'finance lease liabilities', opLease: 'operating lease liabilities', nci: 'noncontrolling interests', preferred: 'preferred stock', dilutive: 'dilutive effect', eps: 'diluted earnings per share', normalize: 'restructuring', sotp: 'segment information', ebitda: 'depreciation and amortization' }[key];
    return `<p class="footnote"><b>For ${esc(nameOf(c))}:</b> <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-&dateb=&owner=include&count=40" target="_blank" rel="noopener">10-K and 10-Q filings on EDGAR</a>${q ? ` · <a href="https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"' + q + '"')}&ciks=${cik.padStart(10, '0')}" target="_blank" rel="noopener">search its filings for “${esc(q)}”</a>` : ''}</p>`;
  }
  function renderModal() {
    const root = $('#modal-root');
    if (!modal) { if (root.dataset.owner === 'comps') root.innerHTML = ''; return; }
    root.dataset.owner = 'comps';
    root.innerHTML = `<div class="scrim mscrim" data-cx-close-modal></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="cx-md-title"><button class="btn close" data-cx-close-modal aria-label="Close">Close</button>
      <h2 id="cx-md-title">Data source for Trading Comps</h2>
      <p class="footnote">Ticker import and peer suggestions use Financial Modeling Prep (the same key as the DCF calculator). A free key allows about 250 requests a day; one company import uses about 9. Quarterly statements and analyst estimates may need a paid plan: without them TTM comes from the SEC file and forward multiples show Not Available.</p>
      <label>API key <span class="inwrap"><input type="password" id="cx-key" value="${esc(fmpKey() || '')}" autocomplete="off"></span></label>
      <label class="cx-chk"><input type="checkbox" id="cx-key-rem" ${dataCfg().remember ? 'checked' : ''}> Remember the key on this computer</label>
      <div class="btns"><button class="btn primary" data-cx-key-save>Save</button><a class="footnote" href="${esc(D.FMP_HOME)}" target="_blank" rel="noopener">Get a key</a></div><hr>
      <p class="footnote"><b>Without a key:</b> load SEC company facts files (data.sec.gov/api/xbrl/companyfacts/CIK##########.json, saved from your browser) on Target company or Peer selection, and enter prices yourself. <a href="${esc(H.S.secApi[1])}" target="_blank" rel="noopener">About the SEC files</a>.</p></div>`;
  }

  // ---------- render ----------
  function render() {
    if (!active()) return;
    if (!booted) boot();
    const act = document.activeElement && document.activeElement.id;
    document.body.dataset.page = 'comps-' + page();
    renderTop(); renderRail();
    $('#main').innerHTML = `<div class="page cx-page">${P[page()]()}</div>`;
    renderDrawer(); renderModal();
    document.title = (cur.target.name ? cur.target.name + ' · ' : '') + 'Trading Comps · DCF Pro';
    if (act) { const el = document.getElementById(act); if (el && el.tagName !== 'BUTTON') el.focus({ preventScroll: true }); }
  }
  function boot() {
    booted = true;
    models = M.loadAll();
    const id = M.getCurrent();
    cur = (id && models[id]) || Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated))[0] || M.blank();
  }

  // ---------- imports ----------
  async function importTicker(sym, cid) {
    sym = String(sym || '').trim().toUpperCase(); if (!sym) return;
    const key = fmpKey(); if (!key) { modal = 'data'; render(); return; }
    const target = cid === 'target' ? cur.target : cid === 'newpeer' ? null : byId(cid);
    const where = cid === 'newpeer' ? 'peers' : (target ? target.id : cur.target.id);
    busy = { cid: where, text: `Importing ${sym} from Financial Modeling Prep…` }; msg = null; render();
    try {
      const imp = await D.fetchFMP(sym, key);
      let c = target;
      if (!c) { if (cur.peers.some(p => (p.ticker || '').toUpperCase() === sym)) { c = cur.peers.find(p => (p.ticker || '').toUpperCase() === sym); } else { c = D.emptyCompany('peer'); c.ticker = sym; cur.peers.push(c); } }
      if (c === cur.target && c.ticker && c.ticker.toUpperCase() !== sym && Object.keys(c.v).length) {
        busy = null; confirm = { replaceTarget: imp, sym }; msg = { cid: c.id, level: 'bad', text: `The target is ${c.ticker}. Importing ${sym} replaces the target's data (peers are kept). Use the confirm button below.` }; render(); return;
      }
      const res = D.applyImport(c, imp);
      if (imp.priceDate && !c.priceDate) c.priceDate = imp.priceDate;
      change('imported ' + sym, null, imp.provider);
      busy = null; msg = { cid: cid === 'newpeer' ? 'peers' : c.id, level: res.pending ? '' : 'good', text: `${sym}: ${res.filled} figure(s) filled${res.pending ? `, ${res.pending} change(s) proposed for review` : ''}. ${imp.notes.length ? imp.notes.length + ' import note(s).' : ''}` };
    } catch (e) { busy = null; msg = { cid: where, level: 'bad', text: friendly(e) }; }
    render();
  }
  function friendly(e) { const m = (e && e.message) || String(e); if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach Financial Modeling Prep. Check the connection, or load SEC company facts files instead.'; if (/api ?key|apikey|invalid/i.test(m)) return 'The provider did not accept the API key (' + m + ').'; return m; }
  async function loadSec(el) {
    const cid = el.dataset.csec; const files = Array.from(el.files || []); if (!files.length) return;
    const jsons = [];
    for (const fl of files) { try { jsons.push({ name: fl.name, j: JSON.parse(await fl.text()) }); } catch (e) { msg = { cid: cid === 'newpeer' ? 'peers' : cid, level: 'bad', text: fl.name + ' is not a JSON file.' }; render(); return; } }
    // pair company facts with submissions files (same CIK); also accept {facts, subs} bundles
    const facts = [], subs = {};
    jsons.forEach(({ j }) => { if (j.facts && j.facts.facts) { facts.push({ f: j.facts, s: j.subs }); } else if (j.facts) facts.push({ f: j }); else if (j.filings && j.cik) subs[String(j.cik).replace(/^0+/, '')] = j; });
    if (!facts.length) { msg = { cid: cid === 'newpeer' ? 'peers' : cid, level: 'bad', text: 'No SEC company facts file found among the selected files.' }; render(); return; }
    const out = [];
    facts.forEach(({ f: fj, s }) => {
      try {
        const imp = D.fromSEC(fj, s || subs[String(fj.cik).replace(/^0+/, '')]);
        let c;
        if (cid === 'newpeer') { const ck = imp.info.cik; c = cur.peers.find(p => p.cik && String(p.cik).replace(/^0+/, '') === String(ck).replace(/^0+/, '')) || cur.peers.find(p => p.ticker && imp.info.ticker && p.ticker.toUpperCase() === imp.info.ticker.toUpperCase()); if (!c) { c = D.emptyCompany('peer'); cur.peers.push(c); } }
        else c = byId(cid);
        const res = D.applyImport(c, imp);
        out.push(`${nameOf(c) || imp.info.name}: ${res.filled} filled${res.pending ? ', ' + res.pending + ' proposed for review' : ''}`);
      } catch (e) { out.push(e.message); }
    });
    change('loaded SEC file(s)', null, files.map(x => x.name).join(', '));
    msg = { cid: cid === 'newpeer' ? 'peers' : cid, level: 'good', text: out.join(' · ') + '. SEC files have no share price: enter it with its date.' };
    render();
  }
  async function search(q) {
    ui.search.q = q; if (!q || !fmpKey()) { ui.search.results = []; renderResults(); return; }
    ui.search.busy = true; ui.search.error = null; renderResults();
    try { ui.search.results = await DCFData.searchFMP(q, fmpKey()); } catch (e) { ui.search.error = friendly(e); ui.search.results = []; }
    ui.search.busy = false; renderResults();
  }
  let searchT = null;

  // ---------- exports ----------
  const safeName = s => (s || 'comps').replace(/[^\w\- .()]+/g, '').trim().slice(0, 60) || 'comps';
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  async function doExport(kind) {
    if (kind === 'json') { download(new Blob([JSON.stringify(cur, null, 1)], { type: 'application/json' }), safeName(cur.name) + ' Trading Comps.json'); return; }
    if (kind === 'notes') { download(new Blob([CompsExport.notesMarkdown(cur)], { type: 'text/markdown' }), safeName(cur.name) + ' Trading Comps notes.md'); return; }
    if (kind === 'pdf') { const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to open the printable summary.'); return; } w.document.write(CompsExport.printHtml(cur, $('#main').querySelector('.cx-page') ? null : null)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400); return; }
    if (kind === 'xlsx') {
      const st = document.getElementById('cx-xl-status'); if (st) st.textContent = 'Building the workbook…';
      try { const bytes = await CompsExport.xlsx(JSZip, cur); download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), safeName(cur.name) + ' Trading Comps.xlsx'); if (st) st.textContent = 'Exported. Excel recalculates the formulas when the file opens.'; }
      catch (e) { if (st) st.textContent = 'Export failed: ' + e.message; else toast('Export failed: ' + e.message); }
    }
  }

  // ---------- events ----------
  function setPath(obj, path, v) { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach(k => { o = o[k] = o[k] || {}; }); o[ks[ks.length - 1]] = v; }
  document.addEventListener('change', e => {
    if (!active()) return;
    const el = e.target, d = el.dataset;
    if (d.cv) {
      const [cid, key] = d.cv.split('|'); const c = byId(cid); if (!c) return;
      const p = parse(el.value, d.unit === 'pct' ? 'pct' : 'num');
      if (p.error) { errs[el.id] = { text: el.value, msg: p.error }; render(); return; }
      delete errs[el.id];
      const from = c.v[key] ? c.v[key].v : null;
      if (from === p.v) return;
      D.setManual(c, key, p.v, 'Entered on ' + page());
      if (key === 'price' && p.v !== null && !c.priceDate) c.priceDate = cur.valDate || new Date().toISOString().slice(0, 10);
      change(nameOf(c) + ': ' + D.label(key), from, p.v); render(); return;
    }
    if (d.cf) { const [cid, fld] = d.cf.split('|'); const c = byId(cid); if (!c) return; const from = c[fld]; c[fld] = el.value.trim() || null; if (fld === 'currency' || fld === 'priceCurrency') c[fld] = c[fld] ? c[fld].toUpperCase() : null; if (fld === 'status') { if (c.status === 'excluded') ui.toast = null; } change(nameOf(c) + ': ' + fld, from, c[fld]); render(); return; }
    if (d.cfx) { const [cid, fld] = d.cfx.split('|'); const c = byId(cid); if (!c) return; let v = el.value.trim(); if (fld === 'rate') { const p = parse(v, 'num'); if (p.error || (p.v !== null && p.v <= 0)) { toast('Enter a positive exchange rate.'); return; } v = p.v; } c.fx[fld] = v || null; change(nameOf(c) + ': exchange rate ' + fld, null, v); render(); return; }
    if (d.cinc) { const [cid, k] = d.cinc.split('|'); const c = byId(cid); c.inc = c.inc || {}; c.inc[k] = el.checked; change(nameOf(c) + ': include ' + k, !el.checked, el.checked); render(); return; }
    if (d.cset) { const v = d.cset === 'normalized' ? el.value === 'true' : el.value; const from = cur.settings[d.cset]; cur.settings[d.cset] = v; change('setting ' + d.cset, from, v); render(); return; }
    if (d.csel) { const k = d.csel; const v = el.type === 'checkbox' ? el.checked : el.value; const from = cur.selection[k]; cur.selection[k] = v; if (k !== 'confirmed' && k !== 'why') cur.selection.confirmed = false; change('selection ' + k, from, v); render(); return; }
    if (d.cselnum) { const p = parse(el.value, d.unit === 'pct' ? 'pct' : 'num'); if (p.error) { toast(p.error); return; } const from = cur.selection[d.cselnum]; cur.selection[d.cselnum] = d.cselnum === 'premium' ? (p.v || 0) : p.v; cur.selection.confirmed = false; change('selection ' + d.cselnum, from, p.v); render(); return; }
    if (d.cxMult !== undefined) { const { id, p } = E.splitMid(d.cxMult); cur.selection.multiple = id; cur.selection.period = p; cur.selection.confirmed = false; change('selected multiple', null, d.cxMult); render(); return; }
    if (d.cprem) { cur.selection.premiumWhy = cur.selection.premiumWhy || {}; cur.selection.premiumWhy[d.cprem] = el.value; change('premium reason ' + d.cprem, null, el.value.slice(0, 40)); return; }
    if (d.cana) { if (d.cana === 'why') cur.selection.analyst.why = el.value; else { const p = parse(el.value, 'num'); if (p.error) { toast(p.error); return; } cur.selection.analyst[d.cana] = p.v; } change('analyst multiple ' + d.cana, null, el.value); render(); return; }
    if (d.cweight) { const p = parse(el.value, 'num'); if (p.error || (p.v !== null && p.v < 0)) { toast('Enter a weight of 0 or more.'); return; } cur.selection.weights = cur.selection.weights || {}; cur.selection.weights[d.cweight] = p.v; change('peer weight', null, p.v); render(); return; }
    if (d.csens) { const p = parse(el.value, d.unit === 'pct' ? 'pct' : 'num'); if (p.error) { toast(p.error); return; } let v = p.v; if (['multN', 'metN', 'gN'].includes(d.csens)) v = Math.max(3, Math.min(11, Math.round(v || 5))); cur.sens[d.csens] = v; change('sensitivity ' + d.csens, null, v); render(); return; }
    if (d.crank) { const c = byId(d.crank); const p = parse(el.value, 'num'); c.rank = p.v; change(nameOf(c) + ': rank', null, p.v); render(); return; }
    if (d.cfilter) { const p = parse(el.value, d.unit === 'pct' ? 'pct' : 'num'); ui.filter[d.cfilter] = p.error ? null : p.v; render(); return; }
    if (d.cadj) { const [cid, aid, fld] = d.cadj.split('|'); const c = byId(cid); const a = c.adj.find(x => x.id === aid); if (!a) return; let v = el.type === 'checkbox' ? el.checked : el.value; if (fld === 'amount') { const p = parse(v, 'num'); if (p.error) { toast(p.error); return; } v = p.v; } const from = a[fld]; a[fld] = v; change(nameOf(c) + ': adjustment ' + fld, from, v); render(); return; }
    if (d.cgname) { const g = cur.groups.find(x => x.id === d.cgname); g.name = el.value || 'Custom group'; change('group name', null, g.name); render(); return; }
    if (d.cgpeer) { const [gid, pid] = d.cgpeer.split('|'); const g = cur.groups.find(x => x.id === gid); g.peerIds = el.checked ? g.peerIds.concat([pid]) : g.peerIds.filter(x => x !== pid); change('group members', null, g.name); render(); return; }
    if (d.cnote !== undefined) { cur.notes[d.cnote] = el.value; change('note ' + d.cnote, null, '(' + el.value.length + ' characters)'); return; }
    if (d.cxConclusion !== undefined) { cur.conclusion = el.value; change('conclusion', null, '(' + el.value.length + ' characters)'); return; }
    if (d.cxRename !== undefined) { cur.name = el.value.trim() || cur.name; change('renamed', null, cur.name); render(); return; }
    if (d.cxLearn !== undefined) { cur.ui.learn = el.checked; persist(); render(); return; }
    if (d.cxCompare !== undefined) { ui.compare = el.checked; render(); return; }
    if (d.csec) return loadSec(el);
    if (el.id === 'cx-model') { cur = models[el.value] || cur; M.setCurrent(cur.id); drawer = null; render(); return; }
    if (el.id === 'cx-group') { cur.selection.group = el.value; cur.selection.confirmed = false; change('peer group', null, el.value); render(); return; }
    if (el.id === 'cx-open-file') { const fl = el.files[0]; if (!fl) return; fl.text().then(t => { const m = M.upgrade(JSON.parse(t)); if (m.kind !== 'comps') throw new Error('x'); if (models[m.id]) m.id = M.blank().id; cur = m; persist(); render(); toast('Opened ' + m.name); }).catch(() => toast('That file is not a Trading Comps model file.')); }
  });
  document.addEventListener('toggle', e => { if (!active()) return; const d = e.target; if (d && d.dataset && d.dataset.k) ui.open[d.dataset.k] = d.open; }, true);
  document.addEventListener('input', e => {
    if (!active()) return;
    if (e.target.id === 'cx-search') { const q = e.target.value.trim(); ui.search.open = true; clearTimeout(searchT); searchT = setTimeout(() => search(q), 300); }
  });
  document.addEventListener('focusin', e => { if (active() && e.target.id === 'cx-search') { ui.search.open = true; renderResults(); } });
  document.addEventListener('keydown', e => {
    if (!active()) return;
    if (e.key === 'Escape' && (drawer || modal)) { drawer = null; modal = null; render(); return; }
    if (e.key === 'Enter' && e.target.id === 'cx-search') { e.preventDefault(); ui.search.open = false; importTicker(e.target.value, 'target'); e.target.value = ''; return; }
    if (e.key === 'Enter' && e.target.id === 'cx-add-tk') { e.preventDefault(); const v = e.target.value; importTicker(v, 'newpeer'); return; }
  });
  document.addEventListener('click', e => {
    if (!active()) return;
    if (ui.search.open && !e.target.closest('.search')) { ui.search.open = false; renderResults(); }
    const b = e.target.closest('button, a, [data-cx-close], [data-cx-close-modal]'); if (!b) return;
    const d = b.dataset;
    if (d.cxClose !== undefined) { drawer = null; renderDrawer(); return; }
    if (d.cxCloseModal !== undefined) { modal = null; renderModal(); return; }
    if (d.chelp) { drawer = { type: 'help', key: d.chelp }; renderDrawer(); return; }
    if (d.csrc) { const [cid, key] = d.csrc.split('|'); drawer = { type: 'src', cid, key }; renderDrawer(); return; }
    if (b.id === 'cx-menu') { $('#rail').classList.toggle('open'); return; }
    if (b.closest('#rail') && b.tagName === 'A') { $('#rail').classList.remove('open'); return; }
    if (d.cxTheme) { document.documentElement.setAttribute('data-theme', d.cxTheme); try { localStorage.setItem('dcfcalc.theme', d.cxTheme); } catch (x) {} render(); return; }
    if (b.id === 'cx-save') { cur.savedAt = new Date().toISOString(); M.log(cur, 'saved', null, null); cur.savedAt = cur.log[0].at; persist(); toast('Saved ' + cur.name); render(); return; }
    if (b.id === 'cx-new') { cur = M.blank(); persist(); drawer = null; msg = null; location.hash = 'comps/target'; render(); toast('New Trading Comps model'); return; }
    if (b.id === 'cx-data' || d.cxOpenData !== undefined) { modal = 'data'; renderModal(); return; }
    if (d.cxKeySave !== undefined) { const k = ($('#cx-key') || {}).value; saveKey((k || '').trim(), ($('#cx-key-rem') || {}).checked); modal = null; render(); toast('Data source saved.'); return; }
    if (d.cxImport) { ui.search.open = false; const i = $('#cx-search'); if (i) i.value = ''; importTicker(d.cxImport, 'target'); return; }
    if (d.cxImportId) { const tk = ($('#cx-tk-' + d.cxImportId) || {}).value; importTicker(tk, d.cxImportId === cur.target.id ? 'target' : d.cxImportId); return; }
    if (d.cxAddpeer !== undefined) { importTicker(($('#cx-add-tk') || {}).value, 'newpeer'); return; }
    if (d.cxAddsym) { importTicker(d.cxAddsym, 'newpeer'); return; }
    if (d.cxAddmanual !== undefined) { const tk = (($('#cx-add-tk') || {}).value || '').trim().toUpperCase(); const c = D.emptyCompany('peer'); c.ticker = tk || null; cur.peers.push(c); ui.peer = c.id; change('peer added', null, tk || 'unnamed'); render(); return; }
    if (d.cxSuggest !== undefined) {
      const key = fmpKey(); if (!key) { modal = 'data'; render(); return; }
      busy = { cid: 'peers', text: 'Asking the provider for peer suggestions…' }; render();
      D.suggestPeers(cur.target.ticker, key).then(list => { ui.suggest = { list }; }).catch(err => { ui.suggest = { error: friendly(err), list: [] }; }).then(() => { busy = null; render(); });
      return;
    }
    if (d.cremove) { if (!(confirm && confirm.rm === d.cremove)) { confirm = { rm: d.cremove }; b.textContent = 'Confirm remove'; return; } const c = byId(d.cremove); cur.peers = cur.peers.filter(p => p.id !== d.cremove); cur.groups.forEach(g => { g.peerIds = g.peerIds.filter(x => x !== d.cremove); }); confirm = null; change('peer removed', nameOf(c), null); render(); return; }
    if (d.cpeer) { ui.peer = d.cpeer; if (page() !== 'peerdata') { location.hash = 'comps/peerdata'; } else render(); return; }
    if (d.ccmp) { ui.cmp = ui.cmp === d.ccmp ? null : d.ccmp; render(); return; }
    if (d.cref) { const [cid, rk, to] = d.cref.split('|'); const c = byId(cid); const prev = c.v[to] ? c.v[to].v : null; if (to === 'otherNonop' && isNum(prev)) { if (!(confirm && confirm.ref === d.cref)) { confirm = { ref: d.cref }; b.textContent = `Replace ${prev.toFixed(0)}?`; return; } } D.useRef(c, rk, to); if (to === 'otherNonop') { c.inc = c.inc || {}; c.inc.otherNonop = true; } confirm = null; change(nameOf(c) + ': accepted reference ' + rk, prev, c.v[to].v); render(); return; }
    if (d.cpend) { const [cid, pid, act] = d.cpend.split('|'); const c = byId(cid); if (!c.pending) return; const ids = pid === 'all' ? c.pending.items.filter(p => act === 'skip' || !p.manual).map(p => p.id) : [pid]; if (act === 'apply') D.applyPending(c, ids, pid !== 'all'); else D.dismissPending(c, ids); change(nameOf(c) + ': reviewed import', null, act); render(); return; }
    if (d.crestore) { const [cid, k] = d.crestore.split('|'); const c = byId(cid); if (D.restore(c, k)) { change(nameOf(c) + ': restored ' + k, null, c.v[k].v); render(); } return; }
    if (d.cxTperiod) { cur.settings.tablePeriod = d.cxTperiod; persist(); render(); return; }
    if (d.cobs) { const [cid, key, act] = d.cobs.split('|'); const c = byId(cid); c.excludeObs = c.excludeObs || {}; if (act === 'exclude') { const why = (($('#cx-why-' + cid + '-' + key.replace('@', '_')) || {}).value || '').trim(); if (!why) { toast('Write a reason before excluding an observation.'); return; } c.excludeObs[key] = { reason: why, at: new Date().toISOString() }; } else delete c.excludeObs[key]; change(nameOf(c) + ': ' + act + ' observation ' + key, null, act); render(); return; }
    if (d.cxAddadj !== undefined) { const c = byId(($('#cx-adj-co') || {}).value) || cur.target; const ms = E.MULTIPLES[cur.selection.multiple].metric; c.adj = c.adj || []; c.adj.push({ id: D.uid(), metric: ['rev', 'ebitda', 'ebit', 'ni', 'eps'].includes(ms) ? ms : 'ebitda', period: ['ttm', 'fy', 'ntm', 'fy1'].includes(cur.selection.period) ? cur.selection.period : 'ttm', type: ADJ_TYPES[0], amount: null, reason: '', source: '', recurring: false }); change(nameOf(c) + ': adjustment added', null, null); render(); return; }
    if (d.cadjdel) { const [cid, aid] = d.cadjdel.split('|'); const c = byId(cid); c.adj = c.adj.filter(a => a.id !== aid); change(nameOf(c) + ': adjustment removed', null, null); render(); return; }
    if (d.cxAddgroup !== undefined) { cur.groups.push({ id: 'g' + D.uid(), name: 'Custom group ' + (cur.groups.length + 1), peerIds: [] }); change('group added', null, null); render(); return; }
    if (d.cgdel) { cur.groups = cur.groups.filter(g => g.id !== d.cgdel); if (cur.selection.group === d.cgdel) cur.selection.group = 'core'; change('group deleted', null, null); render(); return; }
    if (d.cxSavetpl !== undefined) { const n = (($('#cx-tpl-name') || {}).value || '').trim() || ((cur.target.ticker || 'Peer') + ' peers'); if (M.saveTemplate(n, cur)) toast('Template saved: ' + n); render(); return; }
    if (d.cxApplytpl) { const t = M.loadTemplates().find(x => x.id === d.cxApplytpl); const n = M.applyTemplate(cur, t); change('template applied', null, t.name); toast(n + ' peer(s) added. Import their data on Peer financial data.'); render(); return; }
    if (d.cxDeltpl) { M.removeTemplate(d.cxDeltpl); render(); return; }
    if (d.cxFromDcf !== undefined) { const id = ($('#cx-dcf-src') || {}).value; const m = dcfModels().find(x => x.id === id); if (!m) return; const imp = D.fromDCF(m); const res = D.applyImport(cur.target, imp); change('copied from DCF', null, m.name); msg = { cid: cur.target.id, level: 'good', text: `From DCF "${m.name}": ${res.filled} figure(s) filled${res.pending ? ', ' + res.pending + ' difference(s) proposed for review' : ''}. The DCF model was not changed.` }; render(); return; }
    if (d.cxDcfpick !== undefined) { ui.dcfSel = ($('#cx-dcf-pick') || {}).value; render(); return; }
    if (d.cxDcflink) { cur.dcfLink = cur.dcfLink === d.cxDcflink ? null : d.cxDcflink; change('DCF link', null, cur.dcfLink); render(); return; }
    if (d.cxExport) { doExport(d.cxExport); return; }
    if (d.cxOpen) { cur = models[d.cxOpen]; M.setCurrent(cur.id); render(); return; }
    if (d.cxDup) { const m = M.duplicate(models[d.cxDup] || cur); cur = m; persist(); render(); toast('Duplicated as ' + m.name); return; }
    if (d.cxDel) { confirm = { del: d.cxDel }; render(); return; }
    if (d.cxDel2) { M.remove(d.cxDel2); models = M.loadAll(); if (cur.id === d.cxDel2) cur = Object.values(models)[0] || M.blank(); confirm = null; render(); toast('Model deleted.'); return; }
    if (d.cxCancel !== undefined) { confirm = null; render(); return; }
    if (d.cxConfirmTarget !== undefined && confirm && confirm.replaceTarget) { const t = D.emptyCompany('target'); D.applyImport(t, confirm.replaceTarget, { isNew: true }); if (confirm.replaceTarget.priceDate) t.priceDate = confirm.replaceTarget.priceDate; t.adj = []; const old = cur.target; cur.target = t; confirm = null; msg = null; change('target replaced', nameOf(old), nameOf(t)); render(); return; }
  });
  window.addEventListener('hashchange', () => { if (active()) { render(); $('#main').scrollTop = 0; } });

  return { render, active, _test: { get cur() { return cur; }, set cur(m) { cur = m; }, P, boot } };
})();
