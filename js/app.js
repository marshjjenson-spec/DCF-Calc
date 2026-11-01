// ===== USER INTERFACE =====
// Renders the sections, handles input, and calls DCF (engine), DCFModel (data/validation/storage) and DCFExcel.
// No valuation formula lives in this file.
(() => {
  const SC = DCFModel.SC;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNum = DCFModel.isNum;
  const FBY = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const HBY = Object.fromEntries(HIST_FIELDS.map(h => [h.key, h]));
  const GUIDE_IDX = { company: 0, market: 1, hist: 2, revenue: 3, margins: 4, reinvest: 5, wacc: 6, terminal: 7, bridge: 8, scenarios: 9 };
  const GUIDE_TITLES = ['Company information', 'Market data', 'Historical financials', 'Revenue forecast', 'Margins and taxes', 'Reinvestment', 'Cost of capital', 'Terminal value', 'Equity bridge', 'Scenarios and final checks'];
  const PAGES = [
    { id: 'dashboard', title: 'Dashboard', grp: 'Overview', icon: 'home' },
    { id: 'checklist', title: 'Model completion', grp: 'Overview', icon: 'check' },
    { id: 'start', title: 'How to use', grp: 'Overview', icon: 'book' },
    { id: 'company', title: 'Company & market data', grp: 'Inputs', icon: 'building', fg: ['company', 'market'] },
    { id: 'historicals', title: 'Historical financials', grp: 'Inputs', icon: 'bars', fg: ['hist'] },
    { id: 'assumptions', title: 'Forecast assumptions', grp: 'Inputs', icon: 'sliders', fg: ['revenue', 'margins', 'reinvest'] },
    { id: 'wacc', title: 'WACC builder', grp: 'Inputs', icon: 'pct', fg: ['wacc'] },
    { id: 'terminal', title: 'Terminal value', grp: 'Inputs', icon: 'flag', fg: ['terminal'] },
    { id: 'bridge', title: 'Equity bridge & scenarios', grp: 'Inputs', icon: 'layers', fg: ['bridge', 'scenarios'] },
    { id: 'capital', title: 'Cap structure', grp: 'Inputs', icon: 'stack' },
    { id: 'projections', title: 'Projections', grp: 'Model', icon: 'trend' },
    { id: 'valuation', title: 'DCF engine', grp: 'Model', icon: 'calc' },
    { id: 'sensitivity', title: 'Sensitivity', grp: 'Model', icon: 'grid' },
    { id: 'summary', title: 'Valuation summary', grp: 'Results', icon: 'target' },
    { id: 'method', title: 'Fixes & reconciliation', grp: 'Results', icon: 'shield' },
    { id: 'files', title: 'Saved models library', grp: 'Your work', icon: 'folder' },
    { id: 'record', title: 'Sources & change log', grp: 'Your work', icon: 'list' },
  ];
  const UNIT_TXT = { pct: '%', usd: '$/share', usd_mm: '$ mm', shares: 'mm shares', x: '×', text: 'text', date: 'date', choice: 'choice' };
  const KIND_TXT = { reported: 'Reported figure', forecast: 'Forecast assumption', market: 'Market data', company: 'Company info' };
  const VIDEO = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  const LINKS = {
    edgar: ['SEC EDGAR filings search', 'https://www.sec.gov/edgar/search/'],
    yahoo: ['Yahoo Finance quotes', 'https://finance.yahoo.com/'],
    fred: ['FRED 10-year Treasury (DGS10)', 'https://fred.stlouisfed.org/series/DGS10'],
    dam: ['Damodaran Online data', 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html'],
    erp: ['Damodaran implied ERP', 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm'],
    imf: ['IMF World Economic Outlook', 'https://www.imf.org/en/Publications/WEO'],
  };
  const LINKS_FOR = { company: ['edgar'], market: ['yahoo', 'edgar'], revenue: ['edgar', 'dam'], margins: ['edgar', 'dam'], reinvest: ['edgar', 'dam'], wacc: ['fred', 'erp', 'dam'], terminal: ['imf', 'dam'], bridge: ['edgar'], scenarios: [], hist: ['edgar'] };

  // ---------- formatting & parsing ----------
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const fmt = {
    mm: v => !isNum(v) ? '<span class="na">n/a</span>' : (v < 0 ? `<span class="neg">(${nf0.format(-v)})</span>` : nf0.format(v)),
    pct: (v, d = 1) => !isNum(v) ? '<span class="na">n/a</span>' : (v < 0 ? `<span class="neg">${(v * 100).toFixed(d)}%</span>` : (v * 100).toFixed(d) + '%'),
    usd: v => !isNum(v) ? '<span class="na">n/a</span>' : (v < 0 ? `<span class="neg">−$${(-v).toFixed(2)}</span>` : '$' + v.toFixed(2)),
    x: v => !isNum(v) ? '<span class="na">n/a</span>' : v.toFixed(2) + '×',
    n: (v, d = 2) => !isNum(v) ? '<span class="na">n/a</span>' : v.toFixed(d),
    bn: v => !isNum(v) ? 'n/a' : '$' + (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + 'bn',
  };
  const plain = s => String(s).replace(/<[^>]+>/g, '');
  function toInputText(v, unit) {
    if (v === null || v === undefined) return '';
    if (unit === 'pct') return String(+(v * 100).toFixed(6));
    if (typeof v === 'number') return String(+v.toFixed(8));
    return String(v);
  }
  function parse(str, unit) {
    const s = String(str).trim();
    if (s === '') return { v: null };
    if (unit === 'text' || unit === 'date' || unit === 'choice') return { v: s };
    let t = s.replace(/[,$\s×x%]/gi, '');
    let neg = false; if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { error: `"${s}" is not a number. Type digits only, for example ${unit === 'pct' ? '14 for 14%' : '1250'}.` };
    let n = Number(t) * (neg ? -1 : 1);
    if (unit === 'pct') n = n / 100;
    return { v: n };
  }

  // ---------- state ----------
  let models = DCFModel.loadAll();
  let cur = null;
  let sample = null;
  let drawerKey = null;
  let pendingFocus = null;
  let confirmDelete = null;
  let parseErrors = {}; // id -> message for text that could not be parsed

  function persist() { if (cur) { const ok = DCFModel.save(cur); if (!ok) toast('Could not save in this browser. Use "Save model file" on Saved models.'); models = DCFModel.loadAll(); } }
  function toast(msg) { let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); } const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 3200); }

  // ---------- theme ----------
  function currentTheme() {
    const a = document.documentElement.getAttribute('data-theme'); if (a) return a;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('dcfcalc.theme', t); } catch (e) {} }

  // ---------- data provider settings and import ----------
  let dataMem = null;
  function dataCfg() {
    if (dataMem) return dataMem;
    let c = null; try { c = JSON.parse(localStorage.getItem('dcfcalc.data')); } catch (e) {}
    dataMem = Object.assign({ provider: 'fmp', keys: {}, remember: true, replace: false }, c || {});
    return dataMem;
  }
  function saveDataCfg() { const c = dataCfg(); try { if (c.remember) localStorage.setItem('dcfcalc.data', JSON.stringify(c)); else localStorage.setItem('dcfcalc.data', JSON.stringify(Object.assign({}, c, { keys: {} }))); } catch (e) {} }
  function dataProviderLabel() { const c = dataCfg(); return c.provider && c.keys[c.provider] ? DCFData.PROVIDERS[c.provider].name : 'not connected'; }
  let importStatus = null;
  let modal = null; // 'data'
  const pristine = m => !m.log.length && !m.inputs.company.name;
  function friendlyErr(e, prov) {
    const m = (e && e.message) || String(e);
    if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(m)) return `Could not reach ${prov}. Check your internet connection. If it keeps failing, the provider may be refusing requests from a file on your computer: try the other provider or load an SEC company facts file.`;
    if (/limit|premium|subscription|upgrade|frequency|rate/i.test(m)) return `${prov} refused the request: ${m}`;
    if (/api ?key|apikey|invalid/i.test(m)) return `${prov} did not accept the API key. Check it in Data source. (${m})`;
    return m;
  }
  function targetModelFor(match) {
    if (match(cur) || pristine(cur)) return cur;
    const m = DCFModel.blank(); return m;
  }
  async function importSymbol(sym) {
    sym = String(sym || '').trim().toUpperCase();
    if (!sym) return;
    const cfg = dataCfg();
    if (!cfg.provider || !cfg.keys[cfg.provider]) { modal = 'data'; renderModal(); return; }
    const prov = DCFData.PROVIDERS[cfg.provider];
    searchState.open = false; renderSearchResults();
    const inp = document.getElementById('co-search'); if (inp) inp.value = '';
    importStatus = { busy: true, msg: `Importing ${sym} from ${prov.name}…` };
    if (page() !== 'dashboard') location.hash = 'dashboard'; else render();
    try {
      const imp = cfg.provider === 'fmp' ? await DCFData.fetchFMP(sym, cfg.keys.fmp) : await DCFData.fetchAV(sym, cfg.keys.av);
      imp.symbol = sym;
      finishImport(imp, m => m.meta && m.meta.symbol === sym, sym);
    } catch (e) { importStatus = { error: friendlyErr(e, prov.name) }; render(); }
  }
  function finishImport(imp, match, label) {
    const m = targetModelFor(match);
    const isNew = m !== cur;
    const res = DCFData.applyImport(m, imp, { replace: dataCfg().replace });
    cur = m; persist(); setCurrent();
    importStatus = { ok: true, label, provider: imp.provider, at: imp.retrieved, changed: res.changed.length, kept: res.kept, notes: res.notes, isNew };
    if (page() !== 'dashboard') location.hash = 'dashboard'; else render();
    toast(`Imported ${res.changed.length} figures from ${imp.provider}`);
  }
  function loadSecFile(el) {
    const file = el.files[0]; if (!file) return;
    file.text().then(t => {
      const imp = DCFData.mapSEC(JSON.parse(t));
      modal = null; renderModal();
      finishImport(imp, m => m.meta && m.meta.cik && m.meta.cik === imp.company.cik, imp.company.name);
    }).catch(e => { toast(e.message && e.message.length < 160 ? e.message : 'That file could not be read as SEC company facts.'); });
  }
  async function runSearch(q) {
    const cfg = dataCfg();
    searchState = { q, results: [], open: true, busy: false, error: null };
    if (!q || !cfg.provider || !cfg.keys[cfg.provider]) { renderSearchResults(); return; }
    searchState.busy = true; renderSearchResults();
    const mine = q;
    try {
      const r = cfg.provider === 'fmp' ? await DCFData.searchFMP(q, cfg.keys.fmp) : await DCFData.searchAV(q, cfg.keys.av);
      if (searchState.q !== mine) return;
      searchState.results = r; searchState.busy = false;
    } catch (e) { if (searchState.q !== mine) return; searchState.busy = false; searchState.error = friendlyErr(e, DCFData.PROVIDERS[cfg.provider].name); }
    renderSearchResults();
  }
  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!modal) { root.innerHTML = ''; return; }
    const c = dataCfg();
    const P = DCFData.PROVIDERS;
    const secQ = (document.getElementById('sec-q') || {}).value || (cur.meta && (cur.meta.cik || cur.meta.symbol)) || '';
    root.innerHTML = `<div class="scrim mscrim" data-close-modal></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-title">
      <button class="btn close" data-close-modal aria-label="Close">Close</button>
      <h2 id="md-title">Data source</h2>
      <p class="footnote">Company search and automatic import use a financial data provider. Imported figures are reported financials and market data only, each saved with its source, period and retrieval time. Forecast assumptions always stay yours.</p>
      <fieldset class="prov"><legend>Provider</legend>
        ${Object.values(P).map(p => `<label class="prov-opt"><input type="radio" name="prov" value="${p.id}" ${c.provider === p.id ? 'checked' : ''}><span><b>${p.name}</b><small>${p.note}</small></span></label>
          <label class="form keyrow">API key for ${p.name}<span class="row"><input type="password" autocomplete="off" data-key="${p.id}" value="${esc(c.keys[p.id] || '')}" placeholder="Paste your key"><a class="btn" href="${p.keyUrl}" target="_blank" rel="noopener">Get a free key</a></span></label>`).join('')}
      </fieldset>
      <label class="check"><input type="checkbox" id="cfg-remember" ${c.remember ? 'checked' : ''}> Remember my keys on this computer</label>
      <label class="check"><input type="checkbox" id="cfg-replace" ${c.replace ? 'checked' : ''}> When importing, replace values I've typed in (otherwise they are kept)</label>
      <div class="btns"><button class="btn primary" id="cfg-save">Save and close</button></div>
      <hr>
      <h3>No API key? Use the SEC's own data</h3>
      <p class="footnote">The SEC publishes every listed company's reported figures as a “company facts” file. It has no share prices, so you type the price and 52-week range yourself.</p>
      <ol class="footnote steps">
        <li>Type the ticker or CIK number: <input type="text" id="sec-q" value="${esc(secQ)}" placeholder="e.g. AMZN or 1018724" style="width:180px"></li>
        <li>${/^\d+$/.test(secQ.trim()) ? `<a href="https://data.sec.gov/api/xbrl/companyfacts/CIK${secQ.trim().padStart(10, '0')}.json" target="_blank" rel="noopener">Open the company facts file for CIK ${esc(secQ.trim())}</a> and save it (Ctrl+S or ⌘S).` : secQ.trim() ? `<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(secQ.trim())}&type=10-K" target="_blank" rel="noopener">Look up the CIK for ${esc(secQ.trim().toUpperCase())} on EDGAR</a>, then type the number above.` : 'A link to the file appears here.'}</li>
        <li><label class="btn">Load the saved file<input type="file" id="sec-file" accept=".json,application/json" hidden></label></li>
      </ol>
    </div>`;
    const f = root.querySelector('.close'); if (f) f.focus();
  }

  // ---------- calculation (memoised per render) ----------
  let calcCache = null;
  function calc() {
    if (calcCache) return calcCache;
    const mode = cur.mode;
    const { inp, invalid } = DCFModel.engineInputs(cur);
    const all = DCF.runAll(inp, mode);
    const act = all.scen[cur.active];
    const wb = DCF.waccBuilder(inp, cur.wb, mode);
    const comp = DCFModel.completion(cur);
    calcCache = { mode, inp, invalid, all, act, wb, comp };
    return calcCache;
  }
  function blockers() {
    const { comp } = calc(); const out = [];
    Object.entries(comp).forEach(([g, c]) => c.items.forEach(i => { if (!i.ok) out.push(Object.assign({ g }, i)); }));
    return out;
  }

  // ---------- routing ----------
  function page() { const h = location.hash.slice(1); return PAGES.find(p => p.id === h) ? h : 'dashboard'; }
  window.addEventListener('hashchange', () => { render(); $('#main').scrollTop = 0; });
  function goField(pageId, elId) { pendingFocus = elId; if (page() === pageId) render(); else location.hash = pageId; }
  function fieldPage(key) {
    if (key.startsWith('hist')) return 'historicals';
    const f = FBY[key]; if (!f) return 'dashboard';
    return PAGES.find(p => p.fg && p.fg.includes(f.group)).id;
  }
  const fid = (key, s) => 'f-' + key.replace(/\./g, '_') + '-' + (s || 'v');

  // ---------- top bar & rail ----------
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
    building: '<rect x="4" y="3" width="11" height="18"/><path d="M15 9h5v12h-5M8 7h3M8 11h3M8 15h3"/>',
    bars: '<path d="M5 20V12M10 20V8M15 20V4M20 20v-6"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    stack: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2"/>',
    grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    save: '<path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    logo: '<path d="M4 20V13M9 20V9M14 20V5M19 20V2" stroke-width="3.2"/>',
  };
  const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
  let searchState = { q: '', results: [], open: false, busy: false, error: null };
  function renderTop() {
    const { all, act } = calc();
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated));
    const opts = list.map(m => `<option value="${m.id}" ${m.id === cur.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    const block = blockers().length;
    let live;
    if (all.weighted !== null) {
      const up = all.weighted / cur.inputs.price - 1;
      live = `<div><div class="lbl">Probability-weighted</div><div class="big">${fmt.usd(all.weighted)}</div></div>
        <div><div class="lbl">vs price ${fmt.usd(cur.inputs.price)}</div><div><span class="pill ${up >= 0 ? 'good' : 'bad'}">${up >= 0 ? '+' : ''}${(up * 100).toFixed(1)}%</span></div></div>`;
    } else live = `<a class="pill bad" href="#checklist">${block ? block + (block === 1 ? ' input needed' : ' inputs needed') : esc(all.weightedNote)}</a>`;
    const actTxt = act.ok ? `<div><div class="lbl">${cur.active} case</div><div class="big">${fmt.usd(act.perShare)}</div></div>` : '';
    const theme = currentTheme();
    const selName = cur.inputs.company.name ? `${cur.inputs.company.name}${cur.meta && cur.meta.symbol ? ' (' + cur.meta.symbol + ')' : ''}` : '';
    const top = document.getElementById('topbar');
    // keep the search box (and its typing) intact across re-renders
    if (!top.querySelector('.hdr-main')) {
      top.innerHTML = `<div class="hdr-main">
        <button class="hbtn menu-btn" id="menu-btn" aria-label="Open sections">${icon('list')}</button>
        <div class="brand">${icon('logo', 'logo')}<div><b>DCF Pro</b><small>Financial Valuation Platform</small></div></div>
        <div class="hdr-title"><b>Dynamic DCF Valuation Dashboard</b><small>Multi-scenario intrinsic value model for equity research and corporate finance</small></div>
        <div class="search" role="search">
          <label class="sr" for="co-search">Search company or ticker</label>
          <div class="search-box">${icon('search')}<input id="co-search" type="search" autocomplete="off" placeholder="Search company or ticker…" aria-autocomplete="list" aria-controls="search-results"></div>
          <div class="search-sel" id="search-sel"></div>
          <div id="search-results" class="search-results" role="listbox"></div>
        </div>
        <div class="hdr-actions">
          <button class="hbtn primary" id="save-model">${icon('save')}<span>Save DCF Model</span></button>
          <button class="hbtn accent" id="new-dcf">${icon('plus')}<span>Start New DCF</span></button>
          <div class="theme-toggle" role="group" aria-label="Colour theme"><button data-theme-set="light" aria-label="Light mode">${icon('sun')}</button><button data-theme-set="dark" aria-label="Dark mode">${icon('moon')}</button></div>
        </div></div><div class="hdr-sub" id="hdr-sub"></div>`;
    }
    top.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === theme)));
    top.querySelector('#search-sel').innerHTML = selName ? `<span class="chip">${esc(selName)}</span>` : '<span class="chip muted">No company selected</span>';
    renderSearchResults();
    $('#hdr-sub').innerHTML = `
      <div class="model-pick"><label for="model-select" class="footnote">Model</label>
        <select id="model-select" class="plain">${opts}</select></div>
      <div class="model-pick"><label for="mode-select" class="footnote">Method</label>
        <select id="mode-select" class="plain"><option value="corrected" ${cur.mode === 'corrected' ? 'selected' : ''}>Corrected (recommended)</option><option value="workbook" ${cur.mode === 'workbook' ? 'selected' : ''}>Original workbook</option></select></div>
      <div class="seg" role="group" aria-label="Active scenario">${SC.map(s => `<button data-act="${s}" aria-pressed="${cur.active === s}">${s}</button>`).join('')}</div>
      <button class="btn ghost" id="open-data">${icon('db')} Data source: ${esc(dataProviderLabel())}</button>
      <div class="live">${actTxt}${live}</div>`;
  }
  function renderSearchResults() {
    const box = document.getElementById('search-results'); if (!box) return;
    const S = searchState;
    if (!S.open) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    const cfg = dataCfg();
    let html = '';
    if (!cfg.provider || !cfg.keys[cfg.provider]) html = `<div class="sr-note">Connect a free data provider to search and import company data automatically.<br><button class="btn primary" data-open-data>Connect a data source</button></div>`;
    else if (S.busy) html = `<div class="sr-note">Searching ${esc(DCFData.PROVIDERS[cfg.provider].name)}…</div>`;
    else if (S.error) html = `<div class="sr-note bad">${esc(S.error)}</div>`;
    else if (S.results.length) html = S.results.map((r, i) => `<button role="option" data-import="${esc(r.symbol)}" id="sr-${i}"><b>${esc(r.symbol)}</b><span>${esc(r.name)}</span><small>${esc(r.exchange)}${r.currency ? ' · ' + esc(r.currency) : ''}</small></button>`).join('');
    else if (S.q) html = `<div class="sr-note">No matches yet. Press Enter to import the ticker “${esc(S.q.toUpperCase())}” directly.</div>`;
    html += `<div class="sr-foot"><button class="linkbtn" data-open-data>No API key? Load an SEC company facts file instead</button></div>`;
    box.innerHTML = html;
  }
  function renderRail() {
    const { comp } = calc();
    const pctFor = p => {
      if (!p.fg) return '';
      let d = 0, t = 0; p.fg.forEach(g => { if (comp[g]) { d += comp[g].done; t += comp[g].total; } });
      if (!t) return '';
      return `<span class="pct ${d === t ? 'done' : ''}">${d === t ? '✓' : Math.round(d / t * 100) + '%'}</span>`;
    };
    let html = '', grp = '';
    PAGES.forEach(p => {
      if (p.grp !== grp) { grp = p.grp; html += `<h4>${grp}</h4>`; }
      html += `<a href="#${p.id}" ${page() === p.id ? 'aria-current="page"' : ''}>${icon(p.icon || 'list')}<span class="t">${p.title}</span>${pctFor(p)}</a>`;
    });
    $('#rail').innerHTML = html;
  }

  // ---------- field rendering ----------
  function tagsFor(f, extra = '') {
    const t = [];
    if (f.required && DCFModel.relevant(f, cur)) t.push('<span class="tag req">Required</span>');
    t.push(`<span class="tag ${f.kind === 'reported' ? 'rep' : ''}">${KIND_TXT[f.kind]}</span>`);
    t.push(`<span class="tag">${UNIT_TXT[f.unit]}</span>`);
    const pv = f.tri ? null : provOf(f.key, f.key.startsWith('company.') ? cur.inputs.company[f.key.split('.')[1]] : cur.inputs[f.key]);
    if (pv === 'imported') t.push(`<span class="tag imp" title="${esc(srcTitle(f.key))}">Imported</span>`);
    else if (pv === 'overridden') t.push(`<span class="tag ovr" title="${esc(srcTitle(f.key))}">Overridden</span>`);
    else if (cur.sources[f.key]) t.push('<span class="tag src">Source noted</span>');
    if (cur.reviewed[f.key] && f.kind !== 'forecast') t.push('<span class="tag src">Verified</span>');
    if (cur.defaults && cur.defaults[f.key]) t.push('<span class="tag ovr">Default: confirm</span>');
    if (f.key === 'gm1' || f.key === 'gm5' || f.key === 'gm10') t.push('<span class="tag memo">Display only</span>');
    return `<div class="tags">${t.join('')}${extra}</div>`;
  }
  function inputHtml(f, s) {
    const val = s ? cur.inputs[f.key][s] : (f.key.startsWith('company.') ? cur.inputs.company[f.key.split('.')[1]] : cur.inputs[f.key]);
    const id = fid(f.key, s);
    const err = parseErrors[id] || DCFModel.fieldError(f, val);
    const data = `data-t="in" data-k="${f.key}" ${s ? `data-s="${s}"` : ''} data-unit="${f.unit}" id="${id}" aria-label="${esc(f.label + (s ? ' ' + s : ''))}"`;
    let control;
    if (f.unit === 'choice') {
      const opts = f.key === 'midYear' ? [['Y', 'Y: mid-year'], ['N', 'N: end of year']] : [['Gordon Growth', 'Gordon Growth'], ['Exit Multiple', 'Exit Multiple']];
      control = `<select ${data}><option value="">Choose…</option>${opts.map(([v, l]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    } else if (f.unit === 'date') control = `<input type="date" ${data} value="${esc(val || '')}">`;
    else if (f.unit === 'text') control = `<input type="text" class="txt" ${data} value="${esc(val || '')}" placeholder="Enter">`;
    else control = `<input type="text" inputmode="decimal" ${data} value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(val, f.unit))}" placeholder="Enter"><span class="unit">${f.unit === 'pct' ? '%' : f.unit === 'x' ? '×' : f.unit === 'usd' ? '$' : f.unit === 'usd_mm' ? '$mm' : f.unit === 'shares' ? 'mm' : ''}</span>`;
    const empty = (val === null || val === undefined || val === '') && !parseErrors[id];
    return `<div class="inwrap ${err ? 'err' : ''} ${empty && f.required ? 'empty' : ''}">${control}</div>${err ? `<div class="errmsg">${esc(err)}</div>` : ''}`;
  }
  function labelCell(f, note) {
    return `<div class="flabel"><div class="name"><button class="help" data-help="${f.key}" aria-label="How to fill in ${esc(f.label)}">?</button>${esc(f.label)}</div>${tagsFor(f)}${note ? `<div class="footnote">${note}</div>` : ''}</div>`;
  }
  function calcRow(label, vals, tri, note, gridTri) {
    const tags = '<div class="tags"><span class="tag calc">Calculated</span></div>';
    const lab = `<div class="flabel"><div class="name">${esc(label)}</div>${tags}${note ? `<div class="footnote">${note}</div>` : ''}</div>`;
    if (tri) return `<div>${lab}</div>${SC.map((s, i) => `<div class="cell" data-s="${s}"><div class="calcv">${vals[i]}</div></div>`).join('')}`;
    return `<div>${lab}</div><div><div class="calcv">${vals}</div></div><div class="blank"></div>${gridTri ? '<div class="blank"></div>' : ''}`;
  }
  function groupPanel(g) {
    const fs = FIELDS.filter(f => f.group === g);
    const tri = fs.some(f => f.tri);
    const { inp, all } = calc();
    const gi = GUIDE_IDX[g], gs = GUIDE_SECTIONS[gi];
    let rows = tri ? `<div class="hdr">Input</div>${SC.map(s => `<div class="hdr">${s}</div>`).join('')}` : `<div class="hdr">Input</div><div class="hdr">Value</div><div class="hdr blank"></div>`;
    fs.forEach(f => {
      if (!tri && f.tri) return;
      const rel = DCFModel.relevant(f, cur);
      if (f.key === 'rev0' && cur.mode === 'corrected') {
        rows += calcRow('Base-year revenue ($ mm)', fmt.mm(inp.rev0), false, `Linked to the latest year on <a href="#historicals">Historical financials</a>${cur.hist.years[4] ? ' (FY' + esc(cur.hist.years[4]) + ')' : ''}.`, true);
        return;
      }
      if ((f.key === 'we' || f.key === 'tcapex') && cur.mode === 'corrected') return;
      let note = '';
      if (f.key === 'exitMult') note = 'Needed only for scenarios that use Exit Multiple.';
      if (!rel && f.key !== 'exitMult') note = 'Not used by the current method.';
      if (f.tri) rows += `<div>${labelCell(f, note)}</div>${SC.map(s => `<div class="cell" data-s="${s}">${inputHtml(f, s)}</div>`).join('')}`;
      else rows += `<div>${labelCell(f, note)}</div><div>${inputHtml(f, null)}</div><div class="blank"></div>${tri ? '<div class="blank"></div>' : ''}`;
    });
    // calculated rows for some groups
    if (g === 'market') {
      const sh = [inp.basic, inp.options, inp.treasury].every(isNum) ? inp.basic + inp.options - inp.treasury : null;
      rows += calcRow('Diluted shares (mm)', fmt.n(sh, 0), false, 'Basic + options and RSUs − treasury shares.');
      rows += calcRow('Market capitalisation ($ mm)', fmt.mm(isNum(sh) && isNum(inp.price) ? sh * inp.price : null), false, 'Diluted shares × price. Should match a public quote within about 1%.');
    }
    if (g === 'wacc') {
      const W = SC.map(s => { const r = all.scen[s]; return r.ok ? r.W : null; });
      const wv = SC.map(s => all.scen[s].ok ? all.scen[s].waccUsed : null);
      rows += calcRow('Cost of equity = Rf + β × ERP + premiums', W.map(w => fmt.pct(w && w.ke, 2)), true);
      rows += calcRow('After-tax cost of debt = Kd × (1 − t)', W.map(w => fmt.pct(w && w.kdAT, 2)), true);
      rows += calcRow('Equity weight', W.map(w => fmt.pct(w && w.we, 1)), true, cur.mode === 'corrected' ? 'Market values: market cap ÷ (market cap + debt + operating leases).' : 'Typed on this page in original-workbook mode.');
      rows += calcRow('WACC', wv.map(v => `<b>${fmt.pct(v, 2)}</b>`), true);
    }
    if (g === 'scenarios') {
      const ps = SC.map(s => inp.prob[s]);
      const sum = ps.every(isNum) ? ps.reduce((a, b) => a + b, 0) : null;
      rows += calcRow('Probability check (must be 100%)', isNum(sum) ? `<span class="pill ${Math.abs(sum - 1) < 1e-9 ? 'good' : 'bad'}">${(sum * 100).toFixed(1)}%</span>` : '<span class="na">enter all three</span>', false, null, true);
    }
    return `<section class="panel" id="grp-${g}">
      <div class="panel-head"><h2>${GROUPS[g].title}</h2><span class="footnote">Blue boxes are yours to fill in. Click ? on any row for help, sources and a video.</span></div>
      <details><summary class="footnote">Why this matters, how to think about it, what to watch for</summary>
        <div class="guide-box" style="margin-top:8px"><div><b>Why</b>${esc(gs.why)}</div><div><b>Think</b>${esc(gs.think)}</div><div><b>Watch out</b>${esc(gs.watch)}</div></div></details>
      <div class="fgrid ${tri ? '' : 'single'}">${rows}</div></section>`;
  }

  // ---------- pages ----------
  const P = {};
  // ---------- dashboard ----------
  function track() {
    const c = calc();
    if (!c.tr) c.tr = DCFModel.tracker(cur, c.all, checksList().map(([t, d, cls]) => ({ title: t, detail: d, status: cls })));
    return c.tr;
  }
  let dashTab = 'key';
  const PROV_TXT = { imported: 'Imported', overridden: 'Overridden by analyst', manual: 'Entered by analyst', calc: 'Calculated by the model' };
  function provDot(kind, title) { return kind ? `<span class="pv pv-${kind}" title="${esc(title || PROV_TXT[kind])}" aria-label="${esc(title || PROV_TXT[kind])}"></span>` : '<span class="pv pv-none" title="Not filled in" aria-label="Not filled in"></span>'; }
  function provOf(key, value) { return DCFData.provenance(cur, key, value); }
  function srcTitle(key) { const s = cur.sources[key]; if (!s) return ''; return `${s.auto ? 'Imported from ' : 'Source: '}${s.name}${s.period ? ', ' + s.period : ''}${s.retrieved ? '. Retrieved ' + new Date(s.retrieved).toLocaleString() : ''}`; }
  // value-per-share range for one scenario: WACC ± 0.5 pt × terminal growth ± 0.5 pt (or exit multiple ± 1×)
  function scenarioRange(s) {
    const { all, inp } = calc(); const r = all.scen[s];
    if (!r.ok) return null;
    let vals = [];
    if (r.tvMethod === 'Exit Multiple') {
      const m = inp.exitMult[s]; const g = DCF.sensitivityExit(inp, s, cur.mode, [r.waccUsed - 0.005, r.waccUsed, r.waccUsed + 0.005], [m - 1, m, m + 1]);
      if (g) vals = g.flat().filter(Boolean).map(x => x.perShare);
    } else {
      const g = DCF.sensitivity(inp, s, cur.mode, [r.waccUsed - 0.005, r.waccUsed, r.waccUsed + 0.005], [r.g - 0.005, r.g, r.g + 0.005]);
      if (g) vals = g.flat().filter(isNum);
    }
    vals = vals.filter(isNum);
    return vals.length ? { lo: Math.min(...vals), hi: Math.max(...vals) } : null;
  }
  function dashInput(key, s, label) {
    const f = FBY[key]; if (!f) return '';
    return `<div class="di-row"><div class="di-lab"><button class="help" data-help="${key}" aria-label="How to fill in ${esc(f.label)}">?</button><span>${esc(label || f.label)}</span>${f.required && DCFModel.relevant(f, cur, s) ? '' : '<small>optional</small>'}</div><div class="di-in">${inputHtml(f, s)}</div></div>`;
  }
  P.dashboard = () => {
    const { all, act, inp } = calc();
    const T = track();
    const C = cur.inputs.company, M = cur.meta || {};
    const sym = M.symbol || (C.ticker ? String(C.ticker).split(' ')[0] : '');
    const initials = (C.name || 'DCF').replace(/[,.]/g, ' ').split(/\s+/).filter(w => w && !/^(inc|corp|corporation|co|ltd|plc|llc|sa|ag|nv|com|the|group|holdings?)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'D';
    const secBy = Object.fromEntries(T.sections.map(s => [s.id, s]));
    // workflow steps
    const autoDone = !!M.retrieved && ['company', 'hist', 'bridge'].every(id => !secBy[id].unsourced.length) && secBy.hist.status === 'complete';
    const analystIds = ['forecast', 'wacc', 'terminal', 'scenarios'];
    const analystDone = analystIds.every(id => secBy[id].status === 'complete');
    const step = (done, partial, title, sub, n) => `<div class="step ${done ? 'done' : partial ? 'part' : ''}"><span class="dot">${done ? icon('check') : n}</span><div><b>${title}</b><small>${sub}</small></div></div>`;
    let status = '';
    if (importStatus && importStatus.busy) status = `<div class="notice info"><span class="spinner" aria-hidden="true"></span> ${esc(importStatus.msg)}</div>`;
    else if (importStatus && importStatus.error) status = `<div class="notice bad"><b>Import failed.</b> ${esc(importStatus.error)} <button class="linkbtn" data-open-data>Data source settings</button> <button class="linkbtn" data-dismiss-import>Dismiss</button></div>`;
    else if (importStatus && importStatus.ok) status = `<div class="notice good"><b>${importStatus.isNew ? 'New model created. ' : ''}Imported ${importStatus.changed} figures for ${esc(importStatus.label || '')}</b> from ${esc(importStatus.provider)} at ${new Date(importStatus.at).toLocaleString()}. Each one has its source on the <a href="#record">Sources</a> page. Review them, then fill in the inputs marked as yours.
      ${importStatus.kept && importStatus.kept.length ? `<div class="footnote">Kept your own values for: ${importStatus.kept.map(k => esc(DCFModel.labelOf(k))).join(', ')}.</div>` : ''}
      ${importStatus.notes && importStatus.notes.length ? `<ul class="footnote">${importStatus.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''} <button class="linkbtn" data-dismiss-import>Dismiss</button></div>`;
    const empty = !C.name && !M.retrieved;
    const header = `<section class="card hero" style="grid-area:hero">
      <div class="logo" aria-hidden="true">${esc(initials)}</div>
      <div class="hero-t"><h1>${C.name ? esc(C.name) + (sym ? ` <span class="tk">(${esc(sym)})</span>` : '') : 'Start a valuation'}</h1>
        <div class="muted">${C.industry ? esc(C.industry) : empty ? 'Search a company or ticker above to import its data, or type it in on Company & market data.' : 'Industry not set'}${M.sector && M.sector !== C.industry ? ' · ' + esc(M.sector) : ''}</div></div>
      ${M.retrieved ? `<span class="badge ok">${icon('check')} Company data imported from ${esc(M.provider)} · ${new Date(M.retrieved).toLocaleDateString()}</span>` : `<button class="badge" data-focus-search>${icon('search')} Import company data</button>`}
    </section>
    <section class="card steps" style="grid-area:steps" aria-label="Workflow">
      ${step(autoDone, !!M.retrieved, 'Auto-filled data', 'Company financials, market data', 1)}<span class="arrow" aria-hidden="true">→</span>
      ${step(analystDone, analystIds.some(id => secBy[id].completed > 0), 'Analyst inputs', 'Assumptions, WACC, scenarios', 2)}<span class="arrow" aria-hidden="true">→</span>
      ${step(T.complete, T.ready, 'Ready for valuation', T.complete ? 'All checks passed' : T.ready ? 'Calculates, review remaining' : 'Run DCF and analyse results', 3)}
    </section>`;
    // company overview
    const sh = [inp.basic, inp.options, inp.treasury].every(isNum) ? inp.basic + inp.options - inp.treasury : null;
    const ovRow = (label, key, v, display) => `<tr><th scope="row">${label}</th><td><span class="ovc">${provDot(v === null || v === undefined || v === '' ? null : provOf(key, v), srcTitle(key))}<button class="cellbtn" data-help="${key}">${display != null ? display : (v ? esc(v) : '<span class="na">Not set</span>')}</button></span></td></tr>`;
    const ref = cur.ref || {};
    const overview = `<section class="card" style="grid-area:ov"><div class="card-h">${icon('building')}<h2>Company overview</h2></div>
      <table class="kv"><tbody>
      ${ovRow('Company name', 'company.name', C.name)}${ovRow('Ticker', 'company.ticker', C.ticker)}${ovRow('Industry', 'company.industry', C.industry)}${ovRow('Currency', 'company.currency', C.currency)}
      ${ovRow('Valuation date', 'company.valDate', C.valDate)}${ovRow('Analyst', 'company.analyst', C.analyst)}
      ${ovRow('Share price', 'price', inp.price, isNum(inp.price) ? fmt.usd(inp.price) : null)}
      ${ovRow('52-week range', 'hi52', isNum(inp.lo52) && isNum(inp.hi52) ? inp.hi52 : null, isNum(inp.lo52) && isNum(inp.hi52) ? `${fmt.usd(inp.lo52)} – ${fmt.usd(inp.hi52)}` : null)}
      <tr><th scope="row">Market cap ($ mm)</th><td><span class="ovc">${provDot(isNum(sh) && isNum(inp.price) ? 'calc' : null, 'Calculated: diluted shares × price')}${isNum(sh) && isNum(inp.price) ? fmt.mm(sh * inp.price) : '<span class="na">needs shares</span>'}</span>${ref.marketCap ? `<div class="footnote">Provider: ${fmt.mm(ref.marketCap.v)}</div>` : ''}</td></tr>
      </tbody></table>
      <div class="legend"><span>${provDot('imported')} Imported</span><span>${provDot('manual')} Analyst</span><span>${provDot('overridden')} Overridden</span><span>${provDot('calc')} Calculated</span></div></section>`;
    // valuation summary
    const vs = s => all.scen[s].ok ? fmt.usd(all.scen[s].perShare) : '<span class="na">—</span>';
    const up = isNum(all.weighted) && isNum(inp.price) ? all.weighted / inp.price - 1 : null;
    const summary = `<section class="card" style="grid-area:vs"><div class="card-h">${icon('layers')}<h2>Valuation summary</h2><span class="tagc">Model output</span></div>
      <table class="kv num"><tbody>
        <tr><th scope="row">Base intrinsic value / share</th><td>${vs('Base')}</td></tr>
        <tr><th scope="row">Bear intrinsic value / share</th><td>${vs('Bear')}</td></tr>
        <tr><th scope="row">Bull intrinsic value / share</th><td>${vs('Bull')}</td></tr>
        <tr class="hl"><th scope="row">Probability-weighted value / share</th><td>${isNum(all.weighted) ? fmt.usd(all.weighted) : '—'}</td></tr>
        <tr><th scope="row">Current share price</th><td>${fmt.usd(inp.price)}</td></tr>
        <tr><th scope="row">Implied upside / (downside)</th><td>${isNum(up) ? (up < 0 ? `<span class="neg">(${(-up * 100).toFixed(1)}%)</span>` : `<span class="pos">+${(up * 100).toFixed(1)}%</span>`) : '—'}</td></tr>
      </tbody></table>
      ${isNum(all.weighted) ? '<p class="footnote">Calculated by the DCF engine from your inputs. These are model estimates, not market data.</p>' : `<p class="footnote">${esc(all.weightedNote || 'Fill in the required inputs to see the valuation.')} <a href="#checklist">See what's missing</a>.</p>`}</section>`;
    // key drivers
    const wv = s => all.scen[s].ok ? fmt.pct(all.scen[s].waccUsed, 2) : '<span class="na">—</span>';
    const tri = (key, f = v => fmt.pct(v, 2)) => SC.map(s => `<td>${isNum(inp[key][s]) ? f(inp[key][s]) : '<span class="na">—</span>'}</td>`).join('');
    const H = cur.hist; const hn = (k, i) => isNum(H[k][i]) ? H[k][i] : null;
    const avg = fn => { const v = [0, 1, 2, 3, 4].map(fn).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const cagr = (() => { const idx = [0, 1, 2, 3, 4].filter(i => isNum(hn('rev', i)) && H.rev[i] > 0); if (idx.length < 2) return null; const a = idx[0], b = idx[idx.length - 1]; return Math.pow(H.rev[b] / H.rev[a], 1 / (b - a)) - 1; })();
    const ebitdaM = avg(i => isNum(hn('gp', i)) && isNum(hn('opex', i)) && hn('rev', i) ? (H.gp[i] - H.opex[i]) / H.rev[i] : null);
    const daM = avg(i => isNum(hn('da', i)) && hn('rev', i) ? H.da[i] / H.rev[i] : null);
    const capM = avg(i => isNum(hn('capex', i)) && hn('rev', i) ? -H.capex[i] / H.rev[i] : null);
    const refs = [];
    if (ref.rf) refs.push({ k: 'rf', label: '10-year Treasury yield', v: ref.rf.v, f: v => fmt.pct(v, 2), src: `${ref.rf.source}, ${ref.rf.period}`, target: 'rf', all: true });
    if (ref.beta) refs.push({ k: 'beta', label: 'Provider beta', v: ref.beta.v, f: v => fmt.n(v, 2), src: `${ref.beta.source}, ${ref.beta.period}`, target: 'beta' });
    if (ref.effTax) refs.push({ k: 'effTax', label: 'Effective tax rate, 3-yr avg', v: ref.effTax.v, f: v => fmt.pct(v, 1), src: `Calculated from imported statements, ${ref.effTax.period}`, target: 'tax' });
    if (isNum(cagr)) refs.push({ k: 'cagr', label: 'Historical revenue CAGR', v: cagr, f: v => fmt.pct(v, 1), src: 'Calculated from historicals', target: 'g1' });
    if (isNum(ebitdaM)) refs.push({ k: 'ebitdaM', label: 'Avg historical EBITDA margin', v: ebitdaM, f: v => fmt.pct(v, 1), src: 'Calculated from historicals', target: 'em1' });
    if (isNum(daM)) refs.push({ k: 'daM', label: 'Avg D&A % of revenue', v: daM, f: v => fmt.pct(v, 1), src: 'Calculated from historicals', target: 'da' });
    if (isNum(capM)) refs.push({ k: 'capM', label: 'Avg CapEx % of revenue', v: capM, f: v => fmt.pct(v, 1), src: 'Calculated from historicals', target: 'capex1' });
    const drivers = `<section class="card" style="grid-area:kd"><div class="card-h">${icon('target')}<h2>Key drivers & assumptions</h2></div>
      <table class="kv num drivers"><thead><tr><th></th>${SC.map(s => `<th class="${s === cur.active ? 'on' : ''}">${s}</th>`).join('')}</tr></thead><tbody>
        <tr><th scope="row">WACC</th>${SC.map(s => `<td>${wv(s)}</td>`).join('')}</tr>
        <tr><th scope="row">Terminal growth</th>${tri('tg')}</tr>
        <tr><th scope="row">Risk-free rate</th>${tri('rf')}</tr>
        <tr><th scope="row">Beta</th>${tri('beta', v => fmt.n(v, 2))}</tr>
        <tr><th scope="row">Revenue growth, yrs 1–3</th>${tri('g1', v => fmt.pct(v, 1))}</tr>
        <tr><th scope="row">EBITDA margin, yr 5</th>${tri('em5', v => fmt.pct(v, 1))}</tr>
        <tr><th scope="row">Diluted shares (mm)</th><td colspan="3">${isNum(sh) ? fmt.n(sh, 0) : '<span class="na">needs options & treasury shares</span>'}</td></tr>
      </tbody></table>
      <h3 class="sub-h">Reference from data <span class="footnote">use as a starting point for the ${cur.active} case</span></h3>
      ${refs.length ? `<div class="refs">${refs.map(r => `<div class="ref"><div><span>${esc(r.label)}</span><small title="${esc(r.src)}">${esc(r.src)}</small></div><b>${plain(r.f(r.v))}</b><button class="btn tiny" data-use-ref="${r.k}" title="Copy into ${esc(FBY[r.target].label)}${r.all ? ' for all scenarios' : ' (' + cur.active + ')'}">Use</button></div>`).join('')}</div>` : '<p class="footnote">Import a company to see market references and historical drivers here.</p>'}
    </section>`;
    // analyst input panel
    const s = cur.active;
    const tabs = [['key', 'Key inputs'], ['scen', 'Scenarios'], ['adv', 'Advanced']];
    let body = '';
    if (dashTab === 'key') body = ['g1', 'g2', 'g3', 'em1', 'em5', 'em10', 'tg', 'rf', 'erp', 'beta', 'kd'].map(k => dashInput(k, s)).join('') + dashInput('options', null) + dashInput('treasury', null);
    else if (dashTab === 'scen') body = `<div class="di-grid"><div></div>${SC.map(x => `<b>${x}</b>`).join('')}
        <div class="di-lab"><button class="help" data-help="prob">?</button><span>Probability</span></div>${SC.map(x => `<div>${inputHtml(FBY.prob, x)}</div>`).join('')}
        <div class="di-lab"><button class="help" data-help="tvMethod">?</button><span>Terminal method</span></div>${SC.map(x => `<div>${inputHtml(FBY.tvMethod, x)}</div>`).join('')}
        <div class="di-lab"><button class="help" data-help="exitMult">?</button><span>Exit multiple</span></div>${SC.map(x => `<div>${cur.inputs.tvMethod[x] === 'Exit Multiple' ? inputHtml(FBY.exitMult, x) : '<span class="na">Gordon</span>'}</div>`).join('')}
      </div>${dashInput('midYear', null)}${cur.defaults && (cur.defaults.tvMethod || cur.defaults.midYear) ? `<div class="notice">The terminal method and mid-year convention start with the workbook's defaults. <button class="btn tiny" data-confirm-default="tvMethod,midYear">Keep the defaults</button></div>` : ''}
      ${isNum(all.probSum) ? `<p class="footnote">Probabilities add to <b class="${Math.abs(all.probSum - 1) < 1e-9 ? 'pos' : 'neg'}">${(all.probSum * 100).toFixed(1)}%</b> (must be 100%).</p>` : ''}`;
    else body = ['da', 'tax', 'nol', 'capex1', 'capex2', 'capex3', 'nwc', 'acq', 's2c', 'troic', 'scp', 'csrp'].concat(cur.mode === 'workbook' ? ['we', 'tcapex'] : []).map(k => dashInput(k, s)).join('');
    const inputs = `<section class="card inputs" style="grid-area:in"><div class="card-h">${icon('sliders')}<h2>Analyst inputs</h2></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${dashTab === k}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${dashTab !== 'scen' ? `<div class="seg small" role="group" aria-label="Scenario to edit">${SC.map(x => `<button data-act="${x}" aria-pressed="${x === s}">${x}</button>`).join('')}</div><p class="footnote">Editing the <b>${s}</b> case. Click ? for what to enter and where to find it.</p>` : ''}
      <div class="di">${body}</div>
      <button class="run" id="run-dcf">${icon('play')} Run DCF valuation</button>
      ${cur.lastRun ? `<p class="footnote center">Last run ${new Date(cur.lastRun).toLocaleString()}</p>` : ''}</section>`;
    // football field
    const ffRows = [];
    [['Bear', 'bear'], ['Base', 'base'], ['Bull', 'bull']].forEach(([x, k]) => { const r = scenarioRange(x); ffRows.push(r ? { label: `DCF: ${x} case`, lo: r.lo, hi: r.hi, kind: k } : { label: `DCF: ${x} case`, kind: k, note: 'needs inputs' }); });
    if (isNum(inp.lo52) && isNum(inp.hi52)) ffRows.push({ label: '52-week trading range', lo: inp.lo52, hi: inp.hi52, kind: 'range' });
    if (isNum(cur.street.low) && isNum(cur.street.high)) ffRows.push({ label: 'Street price targets', lo: cur.street.low, hi: cur.street.high, kind: 'target' });
    ffRows.push(isNum(all.weighted) ? { label: 'Probability-weighted', lo: all.weighted, hi: all.weighted, kind: 'point' } : { label: 'Probability-weighted', kind: 'point', note: 'needs all three cases' });
    const football = `<section class="card" style="grid-area:ff"><div class="card-h">${icon('bars')}<h2>Football field <span class="muted">value per share</span></h2></div>
      ${DCFCharts.football(ffRows, { price: inp.price })}
      <p class="footnote">Each DCF bar spans WACC ± 0.5 pt and terminal growth ± 0.5 pt (exit multiple ± 1× for exit-multiple cases). The dashed line is today's price.</p></section>`;
    // sensitivity
    let sens = '<p class="footnote">The grid appears once the active case calculates.</p>';
    if (act.ok) {
      const w0 = act.waccUsed, step = 0.005, W = [-2, -1, 0, 1, 2].map(i => w0 + i * step);
      if (act.tvMethod === 'Exit Multiple') {
        const m0 = inp.exitMult[s], Ms = [-2, -1, 0, 1, 2].map(i => m0 + i);
        const g = DCF.sensitivityExit(inp, s, cur.mode, W, Ms);
        sens = `<table class="sens"><thead><tr><th class="corner">WACC ↓ / Exit multiple →</th>${Ms.map((m, j) => `<th class="${j === 2 ? 'c' : ''}">${m.toFixed(1)}×</th>`).join('')}</tr></thead><tbody>
          ${W.map((w, i) => `<tr class="${i === 2 ? 'c' : ''}"><th>${(w * 100).toFixed(2)}%</th>${g[i].map((v, j) => `<td class="${i === 2 || j === 2 ? 'axis' : ''} ${i === 2 && j === 2 ? 'mid' : ''} ${v && isNum(inp.price) && v.perShare >= inp.price ? 'above' : ''}">${v ? '$' + v.perShare.toFixed(2) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      } else {
        const g0 = act.g, G = [-2, -1, 0, 1, 2].map(i => g0 + i * step);
        const grid = DCF.sensitivity(inp, s, cur.mode, W, G); // [g][w]
        sens = `<table class="sens"><thead><tr><th class="corner">WACC ↓ / Terminal growth →</th>${G.map((g, j) => `<th class="${j === 2 ? 'c' : ''}">${(g * 100).toFixed(1)}%</th>`).join('')}</tr></thead><tbody>
          ${W.map((w, i) => `<tr><th class="${i === 2 ? 'c' : ''}">${(w * 100).toFixed(2)}%</th>${G.map((g, j) => { const v = grid[j][i]; return `<td class="${i === 2 || j === 2 ? 'axis' : ''} ${i === 2 && j === 2 ? 'mid' : ''} ${isNum(v) && isNum(inp.price) && v >= inp.price ? 'above' : ''}">${isNum(v) ? '$' + v.toFixed(2) : '<span class="na">g ≥ WACC</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
      }
    }
    const sensitivity = `<section class="card" style="grid-area:se"><div class="card-h">${icon('grid')}<h2>Sensitivity analysis <span class="muted">${s} case, value per share</span></h2><a class="more" href="#sensitivity">Full grids</a></div>${sens}
      <p class="footnote">Centre cell is the ${s} case. Shaded cells are at or above today's price.</p></section>`;
    // scenario results
    const scenRow = x => { const r = all.scen[x]; return `<tr class="${x === s ? 'hl' : ''}"><th scope="row"><button class="cellbtn" data-act="${x}">${x} case</button></th><td>${isNum(inp.prob[x]) ? (inp.prob[x] * 100).toFixed(0) + '%' : '—'}</td><td>${r.ok ? fmt.mm(r.equity) : '—'}</td><td>${r.ok ? fmt.usd(r.perShare) : '—'}</td><td>${r.ok ? (r.upside < 0 ? `<span class="neg">(${(-r.upside * 100).toFixed(1)}%)</span>` : `<span class="pos">+${(r.upside * 100).toFixed(1)}%</span>`) : '—'}</td></tr>`; };
    const wEq = isNum(all.weighted) ? SC.reduce((a, x) => a + inp.prob[x] * all.scen[x].equity, 0) : null;
    const scen = `<section class="card" style="grid-area:sc"><div class="card-h">${icon('calc')}<h2>DCF scenarios: key results</h2></div>
      <div class="tbl-wrap"><table class="kv num scen"><thead><tr><th>Scenario</th><th>Weight</th><th>Equity value ($ mm)</th><th>Value / share</th><th>Upside</th></tr></thead><tbody>
      ${['Bear', 'Base', 'Bull'].map(scenRow).join('')}
      <tr class="tot"><th scope="row">Probability-weighted</th><td>${isNum(all.probSum) ? (all.probSum * 100).toFixed(0) + '%' : '—'}</td><td>${isNum(wEq) ? fmt.mm(wEq) : '—'}</td><td>${isNum(all.weighted) ? fmt.usd(all.weighted) : '—'}</td><td>${isNum(up) ? (up < 0 ? `<span class="neg">(${(-up * 100).toFixed(1)}%)</span>` : `<span class="pos">+${(up * 100).toFixed(1)}%</span>`) : '—'}</td></tr>
      </tbody></table></div><a class="more" href="#summary">Full scenario comparison</a></section>`;
    // FCF chart
    const fy = isNum(+H.years[4]) && H.years[4] ? +H.years[4] : null;
    const fcfChart = act.ok ? DCFCharts.fcf(act.years.slice(0, 10).map((y, i) => ({ label: fy ? `${String(fy + i + 1).slice(2)}E` : 'Y' + (i + 1), fcff: y.fcff, margin: y.rev ? y.fcff / y.rev : null })), { label: `Projected free cash flow, ${s} case` }) : '<p class="footnote">The chart appears once the active case calculates.</p>';
    const fcf = `<section class="card" style="grid-area:fc"><div class="card-h">${icon('trend')}<h2>Projected free cash flow <span class="muted">${s} case</span></h2><a class="more" href="#projections">Projections</a></div>
      <div class="legend"><span><i class="sw bar"></i> FCFF ($ bn)</span><span><i class="sw line"></i> FCFF margin</span>${fy ? `<span class="muted">Years are fiscal years after FY${fy}</span>` : ''}</div>${fcfChart}</section>`;
    // completion
    const icons = { complete: '<span class="st ok" aria-label="Complete">✓</span>', progress: '<span class="st part" aria-label="In progress"></span>', empty: '<span class="st no" aria-label="Not started"></span>' };
    const secLine = sec => {
      const first = sec.missing && sec.missing[0] || sec.invalid && sec.invalid[0] || sec.defaults && sec.defaults[0];
      let detail = '';
      if (sec.id === 'calc') detail = sec.status === 'complete' ? 'All cases calculate, no failing checks' : `${sec.calcItems.filter(i => !i.ok).length ? sec.calcItems.filter(i => !i.ok).length + ' not calculating' : ''}${sec.failing.length ? (sec.calcItems.some(i => !i.ok) ? ', ' : '') + sec.failing.length + ' failing check' + (sec.failing.length > 1 ? 's' : '') : ''}`;
      else if (sec.id === 'review') detail = sec.status === 'complete' ? 'Reviewed and saved' : `${sec.unreviewed.length ? sec.unreviewed.length + ' to review' : ''}${!sec.saved ? (sec.unreviewed.length ? ', ' : '') + 'not saved since last change' : ''}`;
      else detail = sec.status === 'complete' ? `${sec.required} of ${sec.required} · sourced` : [sec.missing.length ? sec.missing.length + ' missing' : '', sec.invalid.length ? sec.invalid.length + ' invalid' : '', sec.defaults.length ? sec.defaults.length + ' default' : '', sec.unsourced.length ? sec.unsourced.length + ' unsourced' : ''].filter(Boolean).join(', ');
      const go = first ? `data-goto="${first.key}" data-s="${first.s || ''}" data-i="${first.i == null ? '' : first.i}"` : `data-go-page="${sec.id === 'calc' ? 'checklist' : sec.page}"`;
      return `<li><button ${go} class="cl-line">${icons[sec.status]}<span class="t">${esc(sec.title)}</span><small>${esc(detail)}</small></button></li>`;
    };
    const comp = `<section class="card completion" style="grid-area:mc"><div class="card-h">${icon('check')}<h2>Model completion</h2><a class="more" href="#checklist">Details</a></div>
      <div class="mc-body">${DCFCharts.ring(T.pct, T.complete)}<ul class="mc-list">${T.sections.map(secLine).join('')}</ul></div>
      <p class="footnote mc-status">${T.complete ? '<b class="pos">Complete.</b> Every required input is filled in, valid and sourced, all cases calculate and no check fails.' : T.ready ? `<b>Calculates, not complete yet.</b> ${T.warnings.filter(w => w.level === 'bad').length ? T.warnings.filter(w => w.level === 'bad').length + ' check(s) fail. ' : ''}Click a line to go to the next item.` : '<b>Not ready.</b> Click a line to jump to the next missing input.'}</p></section>`;
    return `<div class="dash">${status ? `<div style="grid-area:status">${status}</div>` : ''}${header}${overview}${summary}${drivers}${inputs}${football}${sensitivity}${scen}${fcf}${comp}</div>`;
  };

  P.start = () => {
    const ws = [
      ['Read the checklist', 'Open the completion checklist. It shows what each input is and what is still missing.', 'checklist'],
      ['Enter historicals', 'Type 5 years of revenue, profit, D&A, CapEx and working capital from the 10-K. They anchor your forecast.', 'historicals'],
      ['Fill in the Base case', 'Work down the Base column of the assumption pages, using history as your guide.', 'assumptions'],
      ['Fill in Bear and Bull', 'Make them plausible stories, not just ±20%. Then set the probabilities.', 'bridge'],
      ['Review the results', 'Read the summary, clear every red check, and stress-test on Sensitivity.', 'summary'],
    ];
    const s = cur.sample ? `<div class="notice">This model holds the example figures from your workbook <b>dcf-model-amzn-CMGs6046.xlsx</b> (Amazon, valuation date 1 Jul 2026). Replace them with your own sourced figures, or start a blank model on <a href="#files">Saved models & Excel</a>.</div>` : '';
    return `<div><h1>Build a DCF valuation, one input at a time</h1><p class="lead">This calculator reproduces the workbook's ten-year free-cash-flow model with Base, Bear and Bull scenarios. It guides you through each input, explains where to find it, and checks the result. Nothing is calculated from a blank: an empty box stays empty until you fill it.</p></div>${s}
    <section class="panel"><h2>Workflow</h2><ol style="margin:0;padding-left:20px;display:grid;gap:8px">${ws.map(w => `<li><b><a href="#${w[2]}">${w[0]}</a>.</b> ${w[1]}</li>`).join('')}</ol></section>
    <section class="panel"><h2>Reading the screen</h2><div class="guide-box">
      <div><b>Blue box</b>An input you type. A dashed border means it is still empty.</div>
      <div><b>Black number</b>Calculated by the model. Change the inputs upstream to change it.</div>
      <div><b>Grey column</b>Reported history from filings, kept apart from forecasts.</div>
      <div><b>? button</b>What the input means, where to find it, a tip, a video, and a place to record your source.</div></div></section>
    <section class="panel"><h2>Using AI tools safely</h2><div class="grid2"><div><h3>Good uses</h3><ul class="footnote"><li>Pulling figures out of a filing you paste in, then spot-checking three numbers.</li><li>Computing ratios such as CapEx ÷ revenue.</li><li>Finding the right page of a long 10-K.</li><li>Peer-reviewing your finished output.</li></ul></div><div><h3>Bad uses</h3><ul class="footnote"><li>Today's price, Treasury yield or any live data. Look these up yourself.</li><li>Figures from filings the tool has not seen.</li><li>Management guidance you did not give it.</li><li>Your judgment calls: probabilities, terminal growth, exit multiple.</li></ul></div></div></section>`;
  };
  P.checklist = () => {
    const { all } = calc();
    const T = track();
    const btn = (i, extra = '') => `<button data-goto="${i.key}" data-s="${i.s || ''}" data-i="${i.i == null ? '' : i.i}" title="${esc(i.problem || '')}">${esc(i.label)}${i.problem && i.problem !== 'Missing' ? ': ' + esc(i.problem) : ''}${extra}</button>`;
    const lab = k => DCFModel.labelOf(k);
    let html = `<div><h1>Model completion</h1><p class="lead">Every section the valuation depends on: required inputs, what's missing or invalid, where each figure came from, whether the model calculates, and what still needs attention. Click any item to jump to it.</p></div>`;
    html += `<section class="panel mc-top"><div class="mc-body">${DCFCharts.ring(T.pct, T.complete)}<div>
      ${T.complete ? '<div class="notice good"><b>The model is complete.</b> Required inputs are filled in, valid and sourced; every case calculates; no validation check fails; assumptions are reviewed and the model is saved.</div>'
        : `<div class="notice ${T.ready ? '' : 'bad'}"><b>${T.ready ? 'The valuation calculates, but the model is not complete yet.' : "The valuation can't be calculated yet."}</b> ${T.ready ? 'Finish the items below before relying on the result.' : 'Fill in the missing inputs below.'}</div>`}
      <p class="footnote">${T.done} of ${T.points} tracked items done. The percentage stays below 100 until every section is complete; a default or placeholder value never counts as done.</p></div></div></section>`;
    T.sections.forEach(sec => {
      const pill = sec.status === 'complete' ? '<span class="pill good">Complete</span>' : sec.status === 'progress' ? '<span class="pill warn">In progress</span>' : '<span class="pill bad">Not started</span>';
      html += `<section class="panel"><div class="panel-head"><h2>${esc(sec.title)}</h2>${pill}</div>`;
      if (sec.id === 'calc') {
        html += `<div class="checks">${sec.calcItems.map(i => `<div class="row"><div>${esc(i.label)}${i.problem ? `<small>${esc(i.problem)}</small>` : ''}</div><span class="pill ${i.ok ? 'good' : 'bad'}">${i.ok ? 'Ready' : 'Not ready'}</span></div>`).join('')}</div>`;
        html += `<h3>Validation checks (${cur.active} case)</h3>${checksHtml()}`;
      } else if (sec.id === 'review') {
        html += sec.unreviewed.length ? `<p class="footnote">Forecast assumptions not yet marked as reviewed. Open one, check it against your evidence, and tick “I've reviewed this”. Or mark a whole section once you've been through it.</p><div class="missing-list">${sec.unreviewed.map(f => `<button class="rev" data-help="${f.key}">${esc(f.label)}</button>`).join('')}</div>
          <div class="btns">${['revenue', 'margins', 'reinvest', 'wacc', 'terminal', 'scenarios'].filter(g => sec.unreviewed.some(f => FBY[f.key].group === g)).map(g => `<button class="btn" data-review-group="${g}">Mark ${esc(GROUPS[g].title.toLowerCase())} reviewed</button>`).join('')}</div>` : '<p><span class="pill good">All forecast assumptions reviewed</span></p>';
        html += `<p>${sec.saved ? `<span class="pill good">Saved</span> <span class="footnote">${new Date(sec.savedAt).toLocaleString()}</span>` : `<span class="pill warn">Not saved since the last change</span> <button class="btn primary" data-save-model>Save DCF Model</button>`}</p>`;
      } else {
        html += `<div class="stats mini"><div class="stat"><span class="k">Required</span><span class="v">${sec.required}</span></div><div class="stat"><span class="k">Completed</span><span class="v">${sec.completed}</span></div><div class="stat"><span class="k">Missing</span><span class="v">${sec.missing.length}</span></div><div class="stat"><span class="k">Invalid</span><span class="v">${sec.invalid.length}</span></div><div class="stat"><span class="k">Sourced</span><span class="v">${sec.sourced}/${sec.needSource}</span></div><div class="stat"><span class="k">Verified</span><span class="v">${sec.verified}/${sec.needSource}</span></div></div>`;
        if (sec.missing.length) html += `<h3>Missing</h3><div class="missing-list">${sec.missing.map(i => btn(i)).join('')}</div>`;
        if (sec.invalid.length) html += `<h3>Invalid</h3><div class="missing-list">${sec.invalid.map(i => btn(i)).join('')}</div>`;
        if (sec.defaults.length) html += `<h3>Default values to confirm</h3><div class="missing-list">${sec.defaults.map(i => btn(i)).join('')}</div><div class="btns"><button class="btn" data-confirm-default="${[...new Set(sec.defaults.map(i => i.key))].join(',')}">Keep the defaults</button></div>`;
        if (sec.unsourced.length) html += `<h3>No source recorded</h3><p class="footnote">Reported figures need a source. Click one and fill in “Record your source”, or import the company's data.</p><div class="missing-list">${sec.unsourced.map(k => `<button data-help="${k}">${esc(lab(k))}</button>`).join('')}</div>`;
        if (sec.flagged.length) html += `<h3>Imported figures to check</h3><div class="missing-list">${sec.flagged.map(k => `<button class="rev" data-help="${k}" title="${esc(cur.sources[k].notes)}">${esc(lab(k))}</button>`).join('')}</div>`;
        if (sec.status === 'complete') html += '<p class="footnote">Everything in this section is filled in, valid and sourced.</p>';
      }
      html += `</section>`;
    });
    if (T.warnings.length) html += `<section class="panel"><h2>Outstanding warnings (${T.warnings.length})</h2><div class="checks">${T.warnings.map(w => `<div class="row"><div>${w.key ? `<button class="linkbtn" data-help="${w.key}">${esc(w.text)}</button>` : esc(w.text)}${w.detail ? `<small>${esc(w.detail)}</small>` : ''}</div><span class="pill ${w.level}">${w.level === 'bad' ? 'Fails' : 'Review'}</span></div>`).join('')}</div></section>`;
    return html;
  };
  function checksList() {
    const { all, act, wb, inp } = calc();
    const out = [];
    if (!act.ok) return out;
    const c = act.checks;
    out.push(['Terminal growth ≤ risk-free rate', `g ${fmt.pct(act.g, 2)} vs Rf ${fmt.pct(inp.rf[cur.active], 2)}`, c.tgrVsRf ? 'good' : 'bad', c.tgrVsRf ? 'OK' : 'g above Rf']);
    const ts = act.tvShare;
    out.push(['Terminal value is 60–80% of EV', `TV share ${fmt.pct(ts)}`, ts >= 0.6 && ts <= 0.8 ? 'good' : (ts > 0.85 || ts < 0.5 ? 'bad' : 'warn'), ts >= 0.6 && ts <= 0.8 ? 'OK' : 'Review']);
    const sp = c.spread;
    out.push(['Terminal ROIC above WACC by 5–15 pts', `ROIC ${fmt.pct(c.termRoic)} − WACC ${fmt.pct(act.waccUsed, 2)} = ${fmt.pct(sp)}`, sp < 0 ? 'bad' : (sp >= 0.05 && sp <= 0.15 ? 'good' : 'warn'), sp < 0 ? 'Destroys value' : (sp >= 0.05 && sp <= 0.15 ? 'OK' : 'Review')]);
    const gap = c.reinvGap;
    out.push(['Terminal reinvestment = g ÷ ROIC (±2 pts)', `Model ${fmt.pct(c.modelReinv)} vs implied ${fmt.pct(c.impliedReinv)}`, Math.abs(gap) <= 0.02 ? 'good' : 'bad', Math.abs(gap) <= 0.02 ? 'OK' : 'Inconsistent']);
    const ps = all.probSum;
    out.push(['Scenario probabilities add to 100%', isNum(ps) ? (ps * 100).toFixed(1) + '%' : 'incomplete', isNum(ps) && Math.abs(ps - 1) < 1e-9 ? 'good' : 'bad', isNum(ps) && Math.abs(ps - 1) < 1e-9 ? 'OK' : 'Fix']);
    if (wb) out.push(['Built-up WACC matches the WACC used (Base)', `Difference ${(wb.diff * 100).toFixed(4)}%`, Math.abs(wb.diff) < 1e-9 ? 'good' : 'bad', Math.abs(wb.diff) < 1e-9 ? 'OK' : 'Mismatch']);
    out.push(['Market cap ties to a public quote within ~1%', `Model market cap ${fmt.mm(act.W.mcap)} $mm. Compare with Yahoo Finance.`, 'neutral', 'Check by hand']);
    if (all.scen.Bear.ok && all.scen.Base.ok) { const d = all.scen.Bear.perShare / all.scen.Base.perShare - 1; out.push(['Bear case at least 20% below Base', `Bear is ${fmt.pct(d)} vs Base`, d <= -0.2 ? 'good' : 'warn', d <= -0.2 ? 'OK' : 'Stress harder']); }
    if (cur.mode === 'workbook' && isNum(cur.hist.rev[4]) && isNum(inp.rev0) && inp.rev0 !== cur.hist.rev[4]) out.push(['Base-year revenue equals latest historical revenue', `${fmt.mm(inp.rev0)} vs ${fmt.mm(cur.hist.rev[4])}`, 'warn', 'Differs']);
    const tf = cur.tranches.reduce((a, t) => a + (isNum(t.face) ? t.face : 0), 0);
    if (tf > 0 && isNum(inp.debt) && Math.abs(tf - inp.debt) / inp.debt > 0.01) out.push(['Debt tranches add up to total debt', `Tranches ${fmt.mm(tf)} vs total debt ${fmt.mm(inp.debt)} $mm`, 'warn', 'Explain gap']);
    return out;
  }
  function checksHtml() {
    const l = checksList();
    if (!l.length) return '<p class="footnote">Checks appear once the active scenario calculates.</p>';
    return `<div class="checks">${l.map(([t, d, cls, lab]) => `<div class="row"><div>${t}<small>${d}</small></div><span class="pill ${cls}">${lab}</span></div>`).join('')}</div>`;
  }
  P.company = () => `<div><h1>Company & market data</h1><p class="lead">Who you are valuing, as of when, and the share data that turns equity value into a price per share.</p></div>${groupPanel('company')}${groupPanel('market')}`;
  P.assumptions = () => `<div><h1>Forecast assumptions</h1><p class="lead">The drivers of the ten-year forecast, one column per scenario. Revenue grows in three phases, margins move in a straight line between years 1, 5 and 10, and reinvestment scales with revenue.</p></div>${groupPanel('revenue')}${groupPanel('margins')}${groupPanel('reinvest')}`;
  P.terminal = () => `<div><h1>Terminal value</h1><p class="lead">The value of everything after year 10, usually 60–80% of the total.</p></div>${groupPanel('terminal')}`;
  P.bridge = () => `<div><h1>Equity bridge & scenarios</h1><p class="lead">The balance-sheet items that turn enterprise value into equity value apply to every scenario. Then weight the scenarios.</p></div>${groupPanel('bridge')}${groupPanel('scenarios')}`;
  P.wacc = () => {
    const { wb, inp } = calc();
    const b = (k, label, unit, note) => {
      const id = 'wb-' + k, v = cur.wb[k], err = parseErrors[id];
      return `<tr><td>${label}${note ? `<div class="footnote">${note}</div>` : ''}</td><td><input type="text" inputmode="decimal" data-t="wb" data-k="${k}" data-unit="${unit}" id="${id}" class="${err ? 'err' : ''}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, unit))}" placeholder="Enter">${unit === 'pct' ? ' %' : ''}${err ? `<div class="errmsg">${esc(err)}</div>` : ''}</td></tr>`;
    };
    const r = (label, v, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${v}</td></tr>`;
    const s = 'Base';
    let builder = '<p class="footnote">Fill in the Base WACC inputs above to see the build-up.</p>';
    if (wb) builder = `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Component (Base)</th><th>Value</th></tr></thead><tbody>
      ${r('10-year Treasury yield', fmt.pct(inp.rf[s], 2))}${b('bei', 'Inflation expectation (10Y breakeven)', 'pct', 'Optional. FRED series T10YIE.')}${r('Implied real risk-free rate', fmt.pct(wb.realRf, 2), 'sub')}
      ${b('crp', 'Country risk premium', 'pct', 'Enter 0 for a US-only business.')}
      ${r('Implied ERP used', fmt.pct(inp.erp[s], 2))}${b('histErp', 'Historical ERP (reference only)', 'pct', 'Not used. Implied ERP is forward-looking.')}
      ${b('rawBeta', 'Raw regression beta', 'x', 'Optional, for comparison.')}${r('Adjusted beta (0.67 × raw + 0.33)', fmt.n(wb.adjBeta), 'sub')}
      ${b('unlevBeta', 'Industry unlevered beta (Damodaran)', 'x', 'Optional, for comparison.')}${r('Debt / equity (market)', fmt.pct(wb.de), 'sub')}${r('Re-levered beta: βu × [1 + (1 − t) × D/E]', fmt.n(wb.relevered), 'sub')}
      ${r('Beta used', fmt.n(inp.beta[s]))}
      ${r('Cost of equity (incl. country risk premium)', fmt.pct(wb.keBuilt, 2), 'total')}
      ${r('After-tax cost of debt', fmt.pct(wb.W.kdAT, 2))}${r('Equity / debt weights', fmt.pct(wb.W.we) + ' / ' + fmt.pct(wb.W.wd))}
      ${r('WACC, built up', fmt.pct(wb.built, 2), 'key')}${r('WACC used by the model', fmt.pct(wb.W.wacc, 2))}${r('Difference (should be 0.00%)', `<span class="pill ${Math.abs(wb.diff) < 1e-9 ? 'good' : 'bad'}">${(wb.diff * 100).toFixed(2)}%</span>`)}
      </tbody></table></div>`;
    return `<div><h1>Cost of capital (WACC)</h1><p class="lead">The discount rate for the cash flows: cost of equity from CAPM, after-tax cost of debt, weighted by market values.</p></div>${groupPanel('wacc')}
      <section class="panel"><div class="panel-head"><h2>WACC builder: a cross-check of the Base case</h2></div>${builder}</section>`;
  };
  P.historicals = () => {
    const H = cur.hist, Y = H.years;
    const cell = (key, i) => {
      const id = `h-${key}-${i}`, v = H[key][i], err = parseErrors[id];
      const pv = DCFData.provenance(cur, 'hist.' + key, H[key]); const impv = cur.imported && cur.imported['hist.' + key];
      const cellImp = impv && isNum(v) && impv.v[i] === v;
      return `<td class="hist"><input type="text" inputmode="decimal" data-t="hist" data-k="${key}" data-i="${i}" id="${id}" class="${err ? 'err' : ''} ${cellImp ? 'imp' : (pv === 'overridden' && impv ? 'ovr' : '')}" title="${cellImp ? esc(srcTitle('hist.' + key)) : ''}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, 'num'))}" placeholder="Enter" aria-label="${esc(HBY[key].label)} ${Y[i] || ''}">${err ? `<div class="errmsg">${esc(err)}</div>` : ''}</td>`;
    };
    const row = (key) => `<tr><td><div class="name" style="display:flex;gap:6px;align-items:center"><button class="help" data-help="hist.${key}" aria-label="How to fill in ${esc(HBY[key].label)}">?</button>${esc(HBY[key].label)}</div></td>${[0, 1, 2, 3, 4].map(i => cell(key, i)).join('')}</tr>`;
    const comp = (label, fn, cls = 'sub', f = fmt.mm) => `<tr class="${cls}"><td>${label}</td>${[0, 1, 2, 3, 4].map(i => { const v = fn(i); return `<td class="hist">${f(v)}</td>`; }).join('')}</tr>`;
    const n = (k, i) => isNum(H[k][i]) ? H[k][i] : null;
    const all = (...xs) => xs.every(isNum);
    const ebitda = i => all(n('gp', i), n('opex', i)) ? H.gp[i] - H.opex[i] : null;
    const ebit = i => all(ebitda(i), n('da', i)) ? ebitda(i) - H.da[i] : null;
    const t = cur.inputs.tax.Base;
    const ebt = i => all(ebit(i), n('interest', i)) ? ebit(i) - H.interest[i] : null;
    const taxes = i => all(ebt(i), t) ? ebt(i) * t : null;
    const ni = i => all(ebt(i), taxes(i)) ? ebt(i) - taxes(i) : null;
    const ocf = i => all(ni(i), n('da', i), n('sbc', i), n('dnwc', i)) ? ni(i) + H.da[i] + H.sbc[i] + H.dnwc[i] : null;
    const fcf = i => all(ocf(i), n('capex', i)) ? ocf(i) + H.capex[i] : null;
    const div = (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b : null;
    const yrs = Y.map((y, i) => `<th class="hist"><input type="text" inputmode="numeric" data-t="year" data-i="${i}" id="y-${i}" value="${esc(y == null ? '' : y)}" placeholder="FY" style="width:64px" aria-label="Fiscal year ${i + 1}"></th>`).join('');
    const avg = (fn) => { const v = [0, 1, 2, 3, 4].map(fn).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const cagr = all(n('rev', 0), n('rev', 4)) && H.rev[0] > 0 ? Math.pow(H.rev[4] / H.rev[0], 1 / 4) - 1 : null;
    const hs = Object.entries(cur.sources).filter(([k, x]) => k.startsWith('hist.') && x.auto);
    const impNote = hs.length ? `<div class="notice info"><b>Imported from ${esc(hs[0][1].provider)}</b> (${esc(hs[0][1].period)}), retrieved ${new Date(hs[0][1].retrieved).toLocaleString()}. Cyan cells are imported; amber cells are ones you changed. ${HIST_FIELDS.filter(h => !cur.sources['hist.' + h.key]).length ? 'Still to enter by hand: ' + HIST_FIELDS.filter(h => !cur.sources['hist.' + h.key]).map(h => esc(h.label)).join(', ') + '.' : ''} Click ? on a row to see its exact source.</div>` : `<div class="notice">Search a company in the top bar to import five years of statements automatically, or type them in from the 10-K.</div>`;
    return `<div><h1>Historical financials</h1><p class="lead">Reported figures in $ millions, oldest year first, from the 10-K income and cash flow statements. These are your evidence for the forecast. ${cur.mode === 'corrected' ? 'The latest year\'s revenue becomes the base-year revenue.' : ''}</p></div>${impNote}
    <section class="panel"><div class="panel-head"><h2>Income statement and free cash flow</h2><span class="footnote">Type the fiscal year in each column header. Cash outflows (CapEx, a rise in NWC) are negative, as on the cash flow statement.</span></div>
    <div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions, reported</th>${yrs}</tr></thead><tbody>
      ${row('rev')}${comp('YoY growth', i => i ? div(n('rev', i), n('rev', i - 1)) - 1 : null, 'sub', v => fmt.pct(isNum(v) ? v : null))}
      ${row('gp')}${comp('Gross margin', i => div(n('gp', i), n('rev', i)), 'sub', fmt.pct)}
      ${row('opex')}${comp('EBITDA = gross profit − operating expenses', ebitda, 'total')}${comp('EBITDA margin', i => div(ebitda(i), n('rev', i)), 'sub', fmt.pct)}
      ${row('da')}${comp('EBIT', ebit, 'total')}${comp('EBIT margin', i => div(ebit(i), n('rev', i)), 'sub', fmt.pct)}
      ${row('interest')}${comp('Pre-tax income', ebt)}${comp(`Taxes, estimated at the Base tax rate (${isNum(t) ? (t * 100).toFixed(1) + '%' : 'not set'}), not reported`, taxes, 'sub')}${comp('Net income (estimated)', ni, 'total')}
      ${row('sbc')}${row('dnwc')}${comp('Operating cash flow (estimated)', ocf, 'total')}${row('capex')}${comp('Free cash flow (estimated)', fcf, 'key')}${comp('FCF margin', i => div(fcf(i), n('rev', i)), 'sub', fmt.pct)}
    </tbody></table></div></section>
    <section class="panel"><h2>Ratios to anchor your assumptions</h2><div class="stats">
      <div class="stat"><span class="k">Revenue CAGR, 4 years</span><span class="v">${plain(fmt.pct(cagr))}</span><span class="s">Compare with growth phases 1–2</span></div>
      <div class="stat"><span class="k">Avg EBITDA margin</span><span class="v">${plain(fmt.pct(avg(i => div(ebitda(i), n('rev', i)))))}</span><span class="s">Latest ${plain(fmt.pct(div(ebitda(4), n('rev', 4))))}</span></div>
      <div class="stat"><span class="k">Avg D&A % revenue</span><span class="v">${plain(fmt.pct(avg(i => div(n('da', i), n('rev', i)))))}</span><span class="s">Compare with D&A input</span></div>
      <div class="stat"><span class="k">Avg CapEx % revenue</span><span class="v">${plain(fmt.pct(avg(i => div(isNum(n('capex', i)) ? -H.capex[i] : null, n('rev', i)))))}</span><span class="s">Compare with CapEx phases</span></div>
      <div class="stat"><span class="k">Avg SBC % revenue</span><span class="v">${plain(fmt.pct(avg(i => div(n('sbc', i), n('rev', i)))))}</span><span class="s">Already inside EBITDA margins</span></div>
    </div></section>`;
  };
  P.capital = () => {
    const { act, inp } = calc();
    const T = cur.tranches;
    const tc = (i, k, unit) => { const id = `t-${i}-${k}`, v = T[i][k], err = parseErrors[id]; return `<td><input type="text" ${unit === 'text' ? 'class="txt"' : 'inputmode="decimal"'} data-t="tr" data-i="${i}" data-k="${k}" data-unit="${unit}" id="${id}" class="${unit === 'text' ? 'txt' : ''} ${err ? 'err' : ''}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, unit))}" placeholder="${unit === 'text' ? 'Name' : 'Enter'}">${err ? `<div class="errmsg">${esc(err)}</div>` : ''}</td>`; };
    const face = T.reduce((a, t) => a + (isNum(t.face) ? t.face : 0), 0);
    const wc = face ? T.reduce((a, t) => a + (isNum(t.face) && isNum(t.coupon) ? t.face * t.coupon : 0), 0) / face : null;
    const sh = [inp.basic, inp.options, inp.treasury].every(isNum) ? inp.basic + inp.options - inp.treasury : null;
    const mcap = isNum(sh) && isNum(inp.price) ? sh * inp.price : null;
    const nd = [inp.debt, inp.leases, inp.cash, inp.sti].every(isNum) ? inp.debt + inp.leases - inp.cash - inp.sti : null;
    const tev = isNum(mcap) && isNum(nd) ? mcap + nd : null;
    const dcfEv = act.ok ? act.ev : null;
    return `<div><h1>Capital structure</h1><p class="lead">The debt schedule from the 10-K long-term debt note, the diluted share count, and a check of the market's enterprise value against your DCF.</p></div>
    <section class="panel"><div class="panel-head"><h2>Debt tranches</h2><span class="footnote">From the 10-K debt footnote. A cross-check only: the valuation uses Total debt and Pre-tax cost of debt.</span></div>
      <div class="tbl-wrap"><table class="fin"><thead><tr><th>Tranche</th><th>Face value ($ mm)</th><th>Coupon (%)</th><th>Maturity (year)</th><th>Notes</th></tr></thead><tbody>
      ${T.map((t, i) => `<tr>${tc(i, 'name', 'text').replace('<td>', '<td style="text-align:left">')}${tc(i, 'face', 'num')}${tc(i, 'coupon', 'pct')}${tc(i, 'maturity', 'num')}${tc(i, 'note', 'text')}</tr>`).join('')}
      <tr class="total"><td>Total of tranches</td><td>${fmt.mm(face || null)}</td><td>${fmt.pct(wc, 2)} <span class="footnote">weighted coupon</span></td><td></td><td></td></tr></tbody></table></div>
      ${face && isNum(inp.debt) && Math.abs(face - inp.debt) / inp.debt > 0.01 ? `<div class="notice">Tranches add to ${fmt.mm(face)} but Total debt is ${fmt.mm(inp.debt)} $mm. The difference is usually finance leases, commercial paper or other borrowings. Make sure Total debt includes all of them.</div>` : ''}
      ${isNum(wc) && isNum(inp.kd.Base) ? `<p class="footnote">The weighted coupon (${plain(fmt.pct(wc, 2))}) is what the company pays on old debt. The model uses the pre-tax cost of debt you entered (${plain(fmt.pct(inp.kd.Base, 2))} Base), which should be today's yield to maturity.</p>` : ''}
    </section>
    <div class="grid2"><section class="panel"><h2>Diluted share count (treasury stock method)</h2><div class="tbl-wrap"><table class="fin"><tbody>
      <tr><td>Basic shares outstanding</td><td>${fmt.n(inp.basic, 0)}</td></tr><tr><td>+ Options and RSUs in the money</td><td>${fmt.n(inp.options, 0)}</td></tr><tr><td>− Treasury shares from proceeds</td><td>${fmt.n(inp.treasury, 0)}</td></tr><tr class="total"><td>Diluted shares (mm)</td><td>${fmt.n(sh, 0)}</td></tr></tbody></table></div></section>
    <section class="panel"><h2>Market vs DCF enterprise value</h2><div class="tbl-wrap"><table class="fin"><tbody>
      <tr><td>Market capitalisation</td><td>${fmt.mm(mcap)}</td></tr><tr><td>+ Debt + operating leases − cash − short-term investments</td><td>${fmt.mm(nd)}</td></tr><tr class="total"><td>Trading enterprise value</td><td>${fmt.mm(tev)}</td></tr>
      <tr><td>DCF enterprise value (${cur.active})</td><td>${fmt.mm(dcfEv)}</td></tr><tr class="key"><td>Market premium / (discount) to DCF</td><td>${fmt.pct(isNum(tev) && isNum(dcfEv) ? tev / dcfEv - 1 : null)}</td></tr></tbody></table></div>
      <p class="footnote">Uses the same debt-like items as the equity bridge, so the two numbers compare like for like.</p></section></div>`;
  };
  function needsCalc(what) {
    const { act } = calc();
    if (act.ok) return '';
    const items = act.missing.map(k => (FBY[k] ? FBY[k].label : k));
    return `<div class="notice bad"><b>The ${cur.active} case can't calculate yet.</b> ${act.errors.length ? act.errors.map(esc).join(' ') : 'Missing: ' + items.slice(0, 12).map(esc).join(', ') + (items.length > 12 ? `, and ${items.length - 12} more` : '') + '.'} <a href="#checklist">Open the checklist</a>.</div>`;
  }
  P.projections = () => {
    const { act } = calc();
    const head = `<div><h1>Projections: ${cur.active} case</h1><p class="lead">Revenue down to free cash flow to the firm for ten years plus the terminal year, beside the reported history. Switch scenarios in the top bar.</p></div>`;
    const nc = needsCalc(); if (nc) return head + nc;
    const Y = act.years, H = cur.hist;
    const hy = H.years.map(y => `<th class="hist">FY${esc(y || '')}<br><span style="font-weight:400">reported</span></th>`).join('');
    const py = Y.map(y => `<th>${y.t === 11 ? 'Terminal<br>year 11' : 'Year ' + y.t}</th>`).join('');
    const hv = (fn) => [0, 1, 2, 3, 4].map(i => `<td class="hist">${fn(i)}</td>`).join('');
    const hn = (k, i) => isNum(H[k][i]) ? H[k][i] : null;
    const hEbitda = i => isNum(hn('gp', i)) && isNum(hn('opex', i)) ? H.gp[i] - H.opex[i] : null;
    const blankH = hv(() => '');
    const row = (label, key, f = fmt.mm, cls = '', hist = blankH) => `<tr class="${cls}"><td>${label}</td>${hist}${Y.map(y => `<td>${y[key] === null || y[key] === undefined ? '<span class="na">—</span>' : f(y[key])}</td>`).join('')}</tr>`;
    const neg = k => Object.assign({}, ...Y.map(() => ({})));
    const corrected = cur.mode === 'corrected';
    return head + `<section class="panel"><div class="panel-head"><h2>Revenue to NOPAT ($ mm)</h2></div><div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th>${hy}${py}</tr></thead><tbody>
      ${row('Revenue growth', 'growth', fmt.pct, 'sub', hv(i => i && isNum(hn('rev', i)) && isNum(hn('rev', i - 1)) ? fmt.pct(H.rev[i] / H.rev[i - 1] - 1) : ''))}
      ${row('Revenue', 'rev', fmt.mm, 'total', hv(i => fmt.mm(hn('rev', i))))}
      ${row('Gross margin (display only)', 'gmPct', fmt.pct, 'sub', hv(i => isNum(hn('gp', i)) && isNum(hn('rev', i)) ? fmt.pct(H.gp[i] / H.rev[i]) : ''))}
      ${row('Gross profit (display only)', 'gp', fmt.mm, 'sub', hv(i => fmt.mm(hn('gp', i))))}
      ${row('EBITDA margin', 'emPct', fmt.pct, 'sub', hv(i => isNum(hEbitda(i)) && isNum(hn('rev', i)) ? fmt.pct(hEbitda(i) / H.rev[i]) : ''))}
      ${row('EBITDA', 'ebitda', fmt.mm, '', hv(i => fmt.mm(hEbitda(i))))}
      ${row('− D&A', 'da', v => fmt.mm(-v), '', hv(i => isNum(hn('da', i)) ? fmt.mm(-H.da[i]) : ''))}
      ${row('EBIT', 'ebit', fmt.mm, 'total', hv(i => isNum(hEbitda(i)) && isNum(hn('da', i)) ? fmt.mm(hEbitda(i) - H.da[i]) : ''))}
      ${row('EBIT margin', 'ebitPct', fmt.pct, 'sub')}
      ${row('Tax rate applied (after NOL)', 'taxRate', fmt.pct, 'sub')}
      ${row('− Taxes on EBIT', 'taxes', v => fmt.mm(-v))}
      ${row('NOPAT = EBIT × (1 − t)', 'nopat', fmt.mm, 'key')}
    </tbody></table></div></section>
    <section class="panel"><div class="panel-head"><h2>Free cash flow to the firm ($ mm)</h2>${corrected ? '<span class="footnote">Terminal year: reinvestment = NOPAT × g ÷ terminal ROIC, so the FCFF there is NOPAT × (1 − g ÷ ROIC).</span>' : ''}</div><div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th>${hy}${py}</tr></thead><tbody>
      ${row('NOPAT', 'nopat')}
      ${row('+ D&A', 'da', fmt.mm, '', hv(i => fmt.mm(hn('da', i))))}
      ${row('− Capital expenditures', 'capex', v => fmt.mm(-v), '', hv(i => fmt.mm(hn('capex', i))))}
      ${row('− Change in NWC', 'dnwc', v => fmt.mm(-v), '', hv(i => fmt.mm(hn('dnwc', i))))}
      ${row('− Acquisitions', 'acq', v => fmt.mm(-v))}
      ${corrected ? row('− Reinvestment (terminal year, g ÷ ROIC)', 'reinvestment', v => fmt.mm(-v)) : ''}
      ${row('FCFF', 'fcff', fmt.mm, 'key')}
      ${row('FCFF margin', 'fcffPct', fmt.pct, 'sub')}
      ${row('Reinvestment rate (1 − FCFF ÷ NOPAT)', 'reinvRateModel', fmt.pct, 'sub')}
      ${row('Invested capital (estimated)', 'ic', fmt.mm, 'sub')}
      ${row('ROIC (NOPAT ÷ prior-year invested capital)', 'roic', fmt.pct, 'sub')}
    </tbody></table></div><p class="footnote">Grey columns are reported history (FY figures as entered). White columns are forecasts. Negative numbers are in red brackets.</p></section>`;
  };
  P.valuation = () => {
    const { act } = calc();
    const head = `<div><h1>DCF valuation: ${cur.active} case</h1><p class="lead">Discounting, terminal value, and the bridge from enterprise value to value per share.</p></div>`;
    const nc = needsCalc(); if (nc) return head + nc;
    const Y = act.years.slice(0, 10);
    const r = (l, v, cls = '') => `<tr class="${cls}"><td>${l}</td><td>${v}</td></tr>`;
    const i = calc().inp, c = act.checks, corr = cur.mode === 'corrected';
    const tvFormula = act.tvMethod === 'Gordon Growth' ? (corr ? 'FCFF(year 11) ÷ (WACC − g)' : 'FCFF(terminal) × (1 + g) ÷ (WACC − g)') : (corr ? 'Year 10 EBITDA × exit multiple' : 'Terminal-year EBITDA × exit multiple');
    return head + `<section class="panel"><h2>Discounting</h2><div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th>${Y.map(y => `<th>Year ${y.t}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      <tr><td>FCFF</td>${Y.map(y => `<td>${fmt.mm(y.fcff)}</td>`).join('')}<td></td></tr>
      <tr class="sub"><td>Discount period (${i.midYear === 'Y' ? 'mid-year' : 'end of year'})</td>${Y.map(y => `<td>${y.period.toFixed(1)}</td>`).join('')}<td></td></tr>
      <tr class="sub"><td>Discount factor at WACC ${plain(fmt.pct(act.waccUsed, 2))}</td>${Y.map(y => `<td>${y.df.toFixed(4)}</td>`).join('')}<td></td></tr>
      <tr class="key"><td>PV of FCFF</td>${Y.map(y => `<td>${fmt.mm(y.pv)}</td>`).join('')}<td>${fmt.mm(act.sumPV)}</td></tr></tbody></table></div></section>
    <div class="grid2"><section class="panel"><h2>Terminal value</h2><div class="tbl-wrap"><table class="fin"><tbody>
      ${r('Method', esc(act.tvMethod))}${r('Formula', tvFormula)}
      ${r('Terminal growth g', fmt.pct(act.g, 2))}${r('WACC', fmt.pct(act.waccUsed, 2))}
      ${act.tvMethod === 'Exit Multiple' ? r('Exit multiple', fmt.x(i.exitMult[cur.active])) : ''}
      ${r('Gordon Growth TV', fmt.mm(act.tvGordon), act.tvMethod === 'Gordon Growth' ? 'total' : 'sub')}${r('Exit Multiple TV', isNum(i.exitMult[cur.active]) ? fmt.mm(act.tvExit) : '<span class="na">no multiple entered</span>', act.tvMethod === 'Exit Multiple' ? 'total' : 'sub')}
      ${r(`PV of terminal value (discounted ${act.tvPeriod} years)`, fmt.mm(act.pvTV), 'key')}
      ${r('Terminal value as % of EV', fmt.pct(act.tvShare))}${r('Implied exit multiple (TV ÷ year 10 EBITDA)', fmt.x(act.impliedExitMultiple))}
    </tbody></table></div></section>
    <section class="panel"><h2>Enterprise value to value per share</h2><div class="tbl-wrap"><table class="fin"><tbody>
      ${r('Sum of PV of FCFF (years 1–10)', fmt.mm(act.sumPV))}${r('+ PV of terminal value', fmt.mm(act.pvTV))}${r('Enterprise value', fmt.mm(act.ev), 'total')}
      ${r('+ Cash & equivalents', fmt.mm(i.cash), 'sub')}${r('+ Short-term investments', fmt.mm(i.sti), 'sub')}${r('+ Equity stakes', fmt.mm(i.stakes), 'sub')}
      ${r('− Total debt', fmt.mm(-i.debt), 'sub')}${r('− Pension underfunding', fmt.mm(-i.pension), 'sub')}${r('− Operating leases', fmt.mm(-i.leases), 'sub')}${r('− Minority interest', fmt.mm(-i.minority), 'sub')}${r('− Deferred tax liability', fmt.mm(-i.dtl), 'sub')}${r('− Options value', fmt.mm(-i.optVal), 'sub')}
      ${r('Equity value', fmt.mm(act.equity), 'total')}${r('÷ Diluted shares (mm)', fmt.n(act.W.shares, 0))}
      ${r('Intrinsic value per share', fmt.usd(act.perShare), 'key')}${r('Current share price', fmt.usd(i.price))}${r('Upside / (downside)', fmt.pct(act.upside))}
      ${r('Implied EV / EBITDA (year 1)', fmt.x(act.evEbitda1))}${r('Implied EV / revenue (year 1)', fmt.x(act.evRev1))}
    </tbody></table></div></section></div>
    <section class="panel"><h2>Value-creation and sanity checks</h2>${checksHtml()}</section>`;
  };
  P.sensitivity = () => {
    const { act, inp } = calc();
    const head = `<div><h1>Sensitivity analysis: ${cur.active} case</h1><p class="lead">How the value per share moves with the discount rate, terminal growth and exit multiple. Edit the blue axis values to change the grid.</p></div>`;
    const nc = needsCalc(); if (nc) return head + nc;
    cur.sens = cur.sens || { w: [0.0825, 0.0875, 0.0925, 0.0975, 0.1025, 0.1075, 0.1125, 0.1175], g: [0.0225, 0.025, 0.0275, 0.03, 0.0325, 0.035], m: [8, 10, 12, 14, 16, 18, 20, 22] };
    const S = cur.sens;
    const ax = (arr, i, unit) => `<input type="text" inputmode="decimal" data-t="sens" data-k="${arr}" data-i="${i}" data-unit="${unit}" id="s-${arr}-${i}" value="${toInputText(S[arr][i], unit)}" style="width:64px">${unit === 'pct' ? '%' : '×'}`;
    const g1 = DCF.sensitivity(inp, cur.active, cur.mode, S.w, S.g);
    const g2 = DCF.sensitivityExit(inp, cur.active, cur.mode, S.w, S.m);
    const price = inp.price;
    const cellCls = v => !isNum(v) ? '' : (v >= price ? 'style="color:var(--good)"' : '');
    const t1 = `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Terminal growth ↓ · WACC →</th>${S.w.map((w, j) => `<th>${ax('w', j, 'pct')}</th>`).join('')}</tr></thead><tbody>
      ${S.g.map((g, i) => `<tr><td>${ax('g', i, 'pct')}</td>${g1[i].map(v => `<td ${cellCls(v)}>${isNum(v) ? '$' + v.toFixed(2) : '<span class="na">g ≥ WACC</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const t2 = `<div class="tbl-wrap"><table class="fin"><thead><tr><th>WACC ↓ · Exit multiple →</th>${S.m.map((m, j) => `<th>${ax('m', j, 'x')}</th>`).join('')}</tr></thead><tbody>
      ${S.w.map((w, i) => `<tr><td>${plain(fmt.pct(w, 2))}</td>${g2[i].map(v => `<td ${cellCls(v && v.perShare)}>${v ? '$' + v.perShare.toFixed(2) + `<div class="footnote">EV ${(v.ev / 1000).toFixed(0)}bn</div>` : '<span class="na">n/a</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const note = cur.mode === 'corrected' ? 'Each cell re-runs the full model with that WACC and growth rate, so the terminal-year cash flow is rebuilt at each g.' : 'As in the workbook, the projected FCFFs are held fixed and only the discounting and terminal value change.';
    return head + `<section class="panel"><div class="panel-head"><h2>Value per share: WACC × terminal growth (Gordon Growth)</h2><span class="footnote">Green = at or above today's price of ${plain(fmt.usd(price))}.</span></div>${t1}<p class="footnote">${note}</p></section>
    <section class="panel"><div class="panel-head"><h2>Value per share and EV: exit multiple × WACC</h2><span class="footnote">Terminal value = ${cur.mode === 'corrected' ? 'year 10' : 'terminal-year'} EBITDA × multiple.</span></div>${t2}</section>`;
  };
  function football(all, inp) {
    const st = cur.street;
    const rows = [];
    if (SC.every(s => all.scen[s].ok)) rows.push({ l: 'DCF: Bear to Bull', lo: Math.min(...SC.map(s => all.scen[s].perShare)), hi: Math.max(...SC.map(s => all.scen[s].perShare)), mid: all.scen.Base.perShare, ml: 'Base' });
    if (isNum(inp.lo52) && isNum(inp.hi52)) rows.push({ l: '52-week trading range', lo: inp.lo52, hi: inp.hi52 });
    if (isNum(st.low) && isNum(st.high)) rows.push({ l: 'Street price targets', lo: st.low, hi: st.high, mid: st.mean, ml: 'Mean' });
    if (!rows.length) return '<p class="footnote">Ranges appear once scenarios and market data are filled in.</p>';
    const vals = rows.flatMap(r => [r.lo, r.hi]).concat(isNum(inp.price) ? [inp.price] : []).concat(isNum(all.weighted) ? [all.weighted] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08 || 10; lo = Math.max(0, lo - pad); hi = hi + pad;
    const L = 190, R = 720, X = v => L + (v - lo) / (hi - lo) * (R - L), rowH = 44, top = 30, H = top + rows.length * rowH + 40;
    const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4))); const st2 = [1, 2, 5, 10].map(m => m * step).find(s => (hi - lo) / s <= 6);
    const ticks = []; for (let t = Math.ceil(lo / st2) * st2; t <= hi; t += st2) ticks.push(t);
    let svg = `<svg viewBox="0 0 760 ${H}" role="img" aria-label="Value per share ranges compared with the share price">`;
    ticks.forEach(t => { svg += `<line x1="${X(t)}" x2="${X(t)}" y1="${top - 6}" y2="${H - 30}" stroke="var(--line)"/><text x="${X(t)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="IBM Plex Mono, monospace">$${t.toFixed(0)}</text>`; });
    rows.forEach((r, i) => {
      const y = top + i * rowH + 12;
      svg += `<text x="16" y="${y + 13}" font-size="13" fill="var(--ink)">${esc(r.l)}</text><rect x="${X(r.lo)}" y="${y}" width="${Math.max(2, X(r.hi) - X(r.lo))}" height="18" rx="4" fill="var(--accent)" fill-opacity="0.22" stroke="var(--accent)"/>`;
      svg += `<text x="${X(r.lo) - 6}" y="${y + 13}" text-anchor="end" font-size="11.5" fill="var(--muted)" font-family="IBM Plex Mono, monospace">$${r.lo.toFixed(0)}</text><text x="${X(r.hi) + 6}" y="${y + 13}" font-size="11.5" fill="var(--muted)" font-family="IBM Plex Mono, monospace">$${r.hi.toFixed(0)}</text>`;
      if (isNum(r.mid)) svg += `<line x1="${X(r.mid)}" x2="${X(r.mid)}" y1="${y - 3}" y2="${y + 21}" stroke="var(--ink)" stroke-width="2"/>`;
    });
    if (isNum(inp.price)) svg += `<line x1="${X(inp.price)}" x2="${X(inp.price)}" y1="${top - 10}" y2="${H - 30}" stroke="var(--bad)" stroke-dasharray="4 3" stroke-width="1.5"/><text x="${X(inp.price)}" y="${top - 14}" text-anchor="middle" font-size="12" fill="var(--bad)">Price $${inp.price.toFixed(2)}</text>`;
    if (isNum(all.weighted)) svg += `<circle cx="${X(all.weighted)}" cy="${top + 21}" r="6" fill="var(--input)"/><text x="${X(all.weighted) + 9}" y="${top + 4}" font-size="12" fill="var(--input)">Weighted $${all.weighted.toFixed(2)}</text>`;
    return svg + '</svg>';
  }
  P.summary = () => {
    const { all, inp } = calc();
    const st = cur.street;
    const cards = SC.map(s => { const r = all.scen[s]; return `<div class="stat"><span class="k">${s} case · ${isNum(inp.prob[s]) ? (inp.prob[s] * 100).toFixed(0) + '%' : '?'} weight</span><span class="v">${r.ok ? plain(fmt.usd(r.perShare)) : '—'}</span><span class="s">${r.ok ? `${r.upside >= 0 ? '+' : ''}${(r.upside * 100).toFixed(1)}% vs price · WACC ${(r.waccUsed * 100).toFixed(2)}%` : '<a href="#checklist">Needs input</a>'}</span></div>`; }).join('');
    const w = all.weighted;
    const wcard = `<div class="stat primary"><span class="k">Probability-weighted value</span><span class="v">${isNum(w) ? plain(fmt.usd(w)) : '—'}</span><span class="s">${isNum(w) ? `${w >= inp.price ? '+' : ''}${((w / inp.price - 1) * 100).toFixed(1)}% vs ${plain(fmt.usd(inp.price))} price` : esc(all.weightedNote)}</span></div>`;
    const tr = (l, f) => `<tr><td>${l}</td>${SC.map(s => `<td>${all.scen[s].ok ? f(all.scen[s]) : '<span class="na">—</span>'}</td>`).join('')}</tr>`;
    const comp = `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Output</th>${SC.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>
      ${tr('Enterprise value ($ mm)', r => fmt.mm(r.ev))}${tr('Equity value ($ mm)', r => fmt.mm(r.equity))}${tr('Value per share', r => fmt.usd(r.perShare))}${tr('Upside / (downside)', r => fmt.pct(r.upside))}
      ${tr('WACC', r => fmt.pct(r.waccUsed, 2))}${tr('Terminal growth', r => fmt.pct(r.g, 2))}${tr('Terminal value method', r => esc(r.tvMethod))}${tr('TV % of EV', r => fmt.pct(r.tvShare))}
      ${tr('Implied EV / EBITDA (year 1)', r => fmt.x(r.evEbitda1))}${tr('Terminal ROIC − WACC', r => fmt.pct(r.checks.spread))}</tbody></table></div>`;
    const sv = isNum(w) && isNum(st.mean) ? w / st.mean - 1 : null;
    const street = `<div class="tbl-wrap"><table class="fin"><tbody>
      ${['mean', 'median', 'high', 'low', 'rec', 'ltg'].map(k => { const lab = { mean: 'Mean target price ($)', median: 'Median target price ($)', high: 'High target ($)', low: 'Low target ($)', rec: 'Recommendation mean (1 = strong buy)', ltg: 'Consensus long-term growth (%)' }[k]; const unit = k === 'ltg' ? 'pct' : 'num'; const id = 'st-' + k; return `<tr><td>${lab}</td><td><input type="text" inputmode="decimal" data-t="st" data-k="${k}" data-unit="${unit}" id="${id}" class="${parseErrors[id] ? 'err' : ''}" value="${esc(toInputText(st[k], unit))}" placeholder="Optional">${unit === 'pct' ? ' %' : ''}</td></tr>`; }).join('')}
      <tr><td>Source and date</td><td><input type="text" class="txt" data-t="st" data-k="asOf" data-unit="text" id="st-asOf" value="${esc(st.asOf || '')}" placeholder="e.g. LSEG, 1 Jul 2026"></td></tr>
      <tr class="key"><td>Your weighted value vs Street mean</td><td>${fmt.pct(sv)}</td></tr></tbody></table></div>`;
    const snaps = cur.snapshots;
    const snapTbl = snaps.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Saved version</th><th>Method</th><th>Base</th><th>Bear</th><th>Bull</th><th>Weighted</th><th></th></tr></thead><tbody>
      ${snaps.map((s, i) => `<tr><td>${esc(s.name)}<div class="footnote">${new Date(s.at).toLocaleString()}</div></td><td>${s.mode === 'corrected' ? 'Corrected' : 'Original'}</td>${['Base', 'Bear', 'Bull', 'weighted'].map(k => `<td>${fmt.usd(s.values[k])}</td>`).join('')}<td><button class="btn" data-snap-restore="${i}">Restore</button> <button class="btn danger" data-snap-del="${i}">Delete</button></td></tr>`).join('')}
      <tr class="key"><td>Current inputs</td><td>${cur.mode === 'corrected' ? 'Corrected' : 'Original'}</td>${SC.map(s => `<td>${all.scen[s].ok ? fmt.usd(all.scen[s].perShare) : '—'}</td>`).join('')}<td>${fmt.usd(w)}</td><td></td></tr></tbody></table></div>` : '<p class="footnote">No saved versions yet. Save one before you change assumptions, then compare.</p>';
    return `<div><h1>Valuation summary${cur.inputs.company.name ? ': ' + esc(cur.inputs.company.name) : ''}</h1><p class="lead">${cur.inputs.company.ticker ? esc(cur.inputs.company.ticker) + ' · ' : ''}${cur.inputs.company.valDate ? 'valued as of ' + esc(cur.inputs.company.valDate) + ' · ' : ''}${cur.mode === 'corrected' ? 'corrected method' : 'original workbook method'} · $ millions except per share.</p></div>
      <div class="stats">${wcard}${cards}</div>
      <section class="panel football"><h2>Where the value falls</h2>${football(all, inp)}<p class="footnote">Bars show ranges, black ticks the Base case and Street mean, the dashed red line today's price, and the blue dot your probability-weighted value.</p></section>
      <section class="panel"><h2>Scenario comparison</h2>${comp}</section>
      <div class="grid2"><section class="panel"><h2>Sanity checks (${cur.active} case)</h2>${checksHtml()}</section>
      <section class="panel"><h2>Street consensus vs model</h2><p class="footnote">Optional. Type the consensus figures and where they came from.</p>${street}</section></div>
      <section class="panel"><div class="panel-head"><h2>Saved versions</h2><div class="btns"><input type="text" class="plain" id="snap-name" placeholder="Version name, e.g. Lower margins" style="border:1px solid var(--line-strong);border-radius:5px;padding:6px 8px;background:var(--surface);color:var(--ink)"><button class="btn primary" id="snap-save">Save this version</button></div></div>${snapTbl}</section>`;
  };
  P.method = () => {
    const { inp } = calc();
    const both = mode => { const m = JSON.parse(JSON.stringify(cur)); m.mode = mode; const e = DCFModel.engineInputs(m).inp; return DCF.runAll(e, mode); };
    const o = both('workbook'), c = both('corrected');
    const val = (r, s) => r.scen[s].ok ? fmt.usd(r.scen[s].perShare) : '<span class="na">needs input</span>';
    const fixes = [
      ['Gordon Growth terminal value applied growth twice', 'The terminal-year cash flow is already year 11, grown by g. The workbook multiplied it by (1 + g) again.', 'TV = FCFF(year 11) ÷ (WACC − g)', 'Damodaran: terminal value uses next year\'s cash flow divided by (cost of capital − g).'],
      ['Terminal reinvestment did not match growth', 'The workbook built year 11 from separate CapEx and NWC inputs, so its reinvestment (7.6%) disagreed with g ÷ ROIC (14.3%), and the Terminal ROIC input was ignored.', 'Year-11 FCFF = NOPAT × (1 − g ÷ terminal ROIC). The terminal ROIC input now drives it.', 'Damodaran stable-growth identity: growth = reinvestment rate × ROIC.'],
      ['Gordon terminal value was discounted a half-year too far', 'Cash flows were discounted at mid-year (0.5 … 9.5), but the Gordon terminal value at a full 10 years.', 'With mid-year on, the Gordon TV is discounted 9.5 years. The exit-multiple TV stays at 10 years.', 'BVR: under the mid-year convention, discount a perpetuity-growth TV by N − 0.5; an exit-multiple TV by N.'],
      ['Exit multiple used year-11 EBITDA', 'The multiple was applied to the terminal-year (year 11) EBITDA but discounted as if received at year 10.', 'TV = Year 10 EBITDA × multiple, discounted 10 years.', 'Standard practice: apply the multiple to the final forecast year\'s EBITDA.'],
      ['WACC weights were typed, not market values', 'Equity and debt weights were a typed 97/3, while the equity bridge treats both debt and operating leases as debt.', 'Equity weight = market cap ÷ (market cap + debt + operating leases), calculated.', 'Workbook checklist: weight by market values, not book.'],
      ['Base revenue was typed twice', 'Base-year revenue on Assumptions was not linked to Historicals.', 'Linked to the latest historical year.', 'Avoids two numbers that should be one.'],
      ['Inputs that did nothing', 'SBC %, interest income rate, NWC base, R&D capitalisation rate and revenue mix never reached the valuation.', 'Removed from the input screens. EBITDA margins are entered after SBC. Gross margin is kept, labelled display only.', 'An input that changes nothing misleads the analyst.'],
      ['Wording that did not match the formulas', 'Sensitivity said "Base-case FCFFs" but used the active scenario; the Readme named the wrong second grid; historical taxes were a hidden 21%.', 'Labels corrected; estimated taxes labelled as estimates at the Base tax rate.', 'No formula change.'],
    ];
    return `<div><h1>Fixes & reconciliation</h1><p class="lead">What was changed from the workbook, why, and proof that the website matches Excel. Use the Method menu in the top bar to switch between the corrected method and the exact original workbook.</p></div>
    <section class="panel"><h2>Effect on this model</h2><div class="tbl-wrap"><table class="fin"><thead><tr><th>Value per share</th><th>Original workbook</th><th>Corrected</th></tr></thead><tbody>
      ${SC.map(s => `<tr><td>${s}</td><td>${val(o, s)}</td><td>${val(c, s)}</td></tr>`).join('')}
      <tr class="key"><td>Probability-weighted</td><td>${fmt.usd(o.weighted)}</td><td>${fmt.usd(c.weighted)}</td></tr></tbody></table></div></section>
    <section class="panel"><h2>The eight fixes</h2><div class="tbl-wrap"><table class="fin"><thead><tr><th>Issue</th><th style="text-align:left">What was wrong</th><th style="text-align:left">Corrected method</th><th style="text-align:left">Basis</th></tr></thead><tbody>
      ${fixes.map(f => `<tr><td><b>${f[0]}</b></td><td style="text-align:left;white-space:normal;font-family:var(--font-ui);min-width:220px">${f[1]}</td><td style="text-align:left;white-space:normal;font-family:var(--font-ui);min-width:220px">${f[2]}</td><td style="text-align:left;white-space:normal;font-family:var(--font-ui);min-width:200px">${f[3]}</td></tr>`).join('')}</tbody></table></div>
      <p class="footnote">Sources: <a href="https://pages.stern.nyu.edu/~adamodar/pdfiles/country/TerminalValue.pdf" target="_blank" rel="noopener">Damodaran, Terminal Value</a> · <a href="https://www.bvresources.com/articles/bvwire/avoid-this-inconsistency-with-the-terminal-value" target="_blank" rel="noopener">BVR, Avoid this inconsistency with the terminal value</a></p></section>
    <section class="panel"><h2>Reconciliation with Excel (Amazon example)</h2><p class="footnote">Automated tests in the repository's <code>tests</code> folder compare the engine with the workbook, recalculated in a spreadsheet engine: 331 checks across the original file, four edited copies and the corrected template, at a tolerance of one part in a billion. All pass.</p>
      <div class="tbl-wrap"><table class="fin"><thead><tr><th>Output</th><th>Excel (original)</th><th>Website (original method)</th><th>Difference</th><th>Corrected Excel template</th><th>Website (corrected)</th><th>Difference</th></tr></thead><tbody>
      ${RECON.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td></tr>`).join('')}</tbody></table></div></section>`;
  };
  // reconciliation rows are filled at start-up from the bundled example (see boot)
  let RECON = [];
  P.files = () => {
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated));
    const preview = window.DCF_PREVIEW ? `<div class="notice">This is the preview copy of the site. Your models save in this browser, but file downloads (model file, Excel export) are blocked here. Use the full website for those.</div>` : '';
    // live value and completion for every model (each is calculated on its own inputs)
    const stats = {};
    const keep = cur;
    list.forEach(m => { try { cur = DCFModel.upgrade(JSON.parse(JSON.stringify(m))); calcCache = null; const { all } = calc(); stats[m.id] = { w: all.weighted, pct: track().pct, complete: track().complete }; } catch (e) { stats[m.id] = {}; } });
    cur = keep; calcCache = null;
    return `<div><h1>Saved models library</h1><p class="lead">Each company is a separate, independent model. Starting a new DCF never erases another one. Work saves automatically in this browser as you type; “Save DCF Model” records a checkpoint with its results and progress. To move work between computers, save a model file or export to Excel.</p></div>${preview}
    <section class="panel"><div class="panel-head"><h2>Your models (${list.length})</h2><div class="btns"><button class="btn primary" id="new-blank">Start new DCF</button><button class="btn" id="new-sample">New from Amazon example</button><button class="btn" id="dup">Duplicate current</button></div></div>
      <div class="tbl-wrap"><table class="fin lib"><thead><tr><th>Model</th><th>Company</th><th>Weighted value / share</th><th>Completion</th><th>Last saved (checkpoint)</th><th>Last change</th><th></th></tr></thead><tbody>
      ${list.map(m => `<tr><td>${m.id === cur.id ? '<b>' + esc(m.name) + '</b> (open)' : esc(m.name)}<div class="footnote">${m.mode === 'corrected' ? 'Corrected method' : 'Original method'}</div></td><td>${esc((m.inputs.company && m.inputs.company.ticker) || '')}</td><td>${fmt.usd(isNum(stats[m.id].w) ? stats[m.id].w : null)}</td><td>${isNum(stats[m.id].pct) ? `<span class="pill ${stats[m.id].complete ? 'good' : stats[m.id].pct >= 50 ? 'warn' : 'bad'}">${stats[m.id].pct}%</span>` : ''}</td><td>${m.savedAt ? new Date(m.savedAt).toLocaleString() : '<span class="na">not yet</span>'}</td><td>${new Date(m.updated).toLocaleString()}</td><td>
        ${m.id !== cur.id ? `<button class="btn" data-open="${m.id}">Open</button>` : ''}
        ${confirmDelete === m.id ? `<button class="btn danger" data-del-yes="${m.id}">Delete for good</button> <button class="btn" data-del-no>Keep</button>` : `<button class="btn danger" data-del="${m.id}">Delete</button>`}</td></tr>`).join('')}</tbody></table></div>
      <label class="form" style="max-width:420px"><span class="footnote">Name of the open model</span><input type="text" id="model-name" value="${esc(cur.name)}"></label></section>
    <div class="grid2"><section class="panel"><h2>Model file</h2><p class="footnote">A .json file with every input, source note, saved version and the change log. Open it here later to carry on.</p><div class="btns"><button class="btn primary" id="save-json">Save model file</button><label class="btn">Open model file<input type="file" id="open-json" accept=".json,application/json" hidden></label></div></section>
    <section class="panel"><h2>Excel</h2><p class="footnote">Export writes your inputs into a copy of the workbook, keeping every sheet and formula, and Excel recalculates when you open it. Pick the corrected template or the exact original. Import reads the inputs from any workbook built on either template.</p>
      <div class="btns"><button class="btn primary" data-export="corrected">Export to Excel (corrected)</button><button class="btn" data-export="original">Export to Excel (original)</button><label class="btn">Import from Excel<input type="file" id="import-xlsx" accept=".xlsx" hidden></label></div><div id="xl-status" class="footnote"></div></section></div>`;
  };
  P.record = () => {
    const srcs = Object.entries(cur.sources);
    const lab = k => FBY[k] ? FBY[k].label : (k.startsWith('hist.') && HBY[k.slice(5)] ? HBY[k.slice(5)].label + ' (historicals)' : k);
    return `<div><h1>Sources & change log</h1><p class="lead">Where each figure came from, and every change made to the inputs. Add a source from any field's ? panel.</p></div>
    <section class="panel"><h2>Sources recorded (${srcs.length})</h2>${srcs.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Input</th><th style="text-align:left">Source</th><th style="text-align:left">Filing / report</th><th style="text-align:left">Period</th><th style="text-align:left">Link</th><th style="text-align:left">Notes</th></tr></thead><tbody>
      ${srcs.map(([k, s]) => `<tr><td><button class="btn" data-help="${k}">${esc(lab(k))}</button></td><td style="text-align:left;font-family:var(--font-ui)">${esc(s.name)}</td><td style="text-align:left;font-family:var(--font-ui)">${esc(s.type)}</td><td style="text-align:left;font-family:var(--font-ui)">${esc(s.period)}</td><td style="text-align:left;font-family:var(--font-ui)">${s.url && /^https?:\/\//i.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">open</a>` : esc(s.url || '')}</td><td style="text-align:left;white-space:normal;font-family:var(--font-ui)">${esc(s.notes)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">No sources recorded yet.</p>'}</section>
    <section class="panel"><h2>Change log (latest ${Math.min(cur.log.length, 200)})</h2>${cur.log.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>When</th><th style="text-align:left">Input</th><th>Scenario</th><th>From</th><th>To</th></tr></thead><tbody>
      ${cur.log.slice(0, 200).map(l => `<tr><td>${new Date(l.at).toLocaleString()}</td><td style="text-align:left;font-family:var(--font-ui)">${esc(lab(l.field))}</td><td>${esc(l.s || '')}</td><td>${esc(l.from == null ? '—' : l.from)}</td><td>${esc(l.to == null ? '—' : l.to)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">No changes yet.</p>'}</section>`;
  };

  // ---------- help drawer ----------
  function renderDrawer() {
    const root = $('#drawer-root');
    if (!drawerKey) { root.innerHTML = ''; return; }
    const isHist = drawerKey.startsWith('hist.');
    const f = isHist ? Object.assign({ unit: 'usd_mm', kind: 'reported', group: 'hist', required: drawerKey === 'hist.rev', what: 'A reported figure for each of the last five fiscal years.', enter: '$ millions, as reported. Cash outflows are negative.' }, HBY[drawerKey.slice(5)]) : FBY[drawerKey];
    const gs = GUIDE_SECTIONS[GUIDE_IDX[f.group]];
    const src = cur.sources[drawerKey] || {};
    const vids = cur.videos || {};
    const custom = vids[drawerKey];
    const links = (LINKS_FOR[f.group] || []).map(k => `<li><a href="${LINKS[k][1]}" target="_blank" rel="noopener">${LINKS[k][0]}</a></li>`).join('');
    const changes = cur.log.filter(l => l.field === drawerKey).slice(0, 5);
    const types = ['', '10-K annual report', '10-Q quarterly report', '8-K / earnings release', 'Investor presentation', 'Proxy statement (DEF 14A)', 'Market data provider', 'Analyst / consensus estimate', 'Academic data (e.g. Damodaran)', 'Own judgment', 'Other'];
    root.innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title">
      <button class="btn close" data-close aria-label="Close help">Close</button>
      <div><h3>${isHist ? 'Historical financials' : GROUPS[f.group].title}</h3><h2 id="dr-title">${esc(f.label)}</h2></div>
      <div class="tags">${f.required ? '<span class="tag req">Required</span>' : '<span class="tag">Optional</span>'}<span class="tag ${f.kind === 'reported' ? 'rep' : ''}">${KIND_TXT[f.kind]}</span><span class="tag">${UNIT_TXT[f.unit] || f.unit}</span>${f.tri ? '<span class="tag">One value per scenario</span>' : ''}</div>
      <dl>
        <div><dt>What it is</dt><dd>${esc(f.what)}</dd></div>
        <div><dt>What to enter</dt><dd>${esc(f.enter)}</dd></div>
        ${f.source ? `<div><dt>Where to find it</dt><dd>${esc(f.source)}</dd></div>` : ''}
        ${f.backup ? `<div><dt>Cross-check with</dt><dd>${esc(f.backup)}</dd></div>` : ''}
        ${f.tip ? `<div><dt>Tip</dt><dd>${esc(f.tip)}</dd></div>` : ''}
        <div><dt>Workbook cell</dt><dd><code>${esc(isHist ? 'Historicals row ' + f.row : f.cell)}</code></dd></div>
      </dl>
      <a class="video" href="${esc(custom || VIDEO(f.video || f.label + ' DCF'))}" target="_blank" rel="noopener"><span class="play" aria-hidden="true">▶</span><span><b>Watch how to fill this in</b><br><span class="footnote">${custom ? 'Video chosen for this model' : 'YouTube videos on “' + esc(f.video || f.label) + '”'}</span></span></a>
      ${links ? `<div><h3>Useful links</h3><ul style="margin:6px 0 0;padding-left:18px">${links}</ul></div>` : ''}
      <details><summary class="footnote">Section guide: why, think, watch out</summary><div class="guide-box" style="margin-top:8px;grid-template-columns:1fr"><div><b>Why</b>${esc(gs.why)}</div><div><b>Think</b>${esc(gs.think)}</div><div><b>Watch out</b>${esc(gs.watch)}</div></div></details>
      ${src.auto ? `<div class="notice ${src.review ? '' : 'info'}"><b>Imported automatically</b> from ${esc(src.provider || src.name)}${src.period ? ', ' + esc(src.period) : ''}, retrieved ${new Date(src.retrieved).toLocaleString()}.${(() => { const imp = cur.imported && cur.imported[drawerKey]; const v = isHist ? cur.hist[drawerKey.slice(5)] : (drawerKey.startsWith('company.') ? cur.inputs.company[drawerKey.split('.')[1]] : cur.inputs[drawerKey]); const pv = DCFData.provenance(cur, drawerKey, v); return pv === 'overridden' ? ` <b>You have changed it</b> from the imported ${esc(Array.isArray(imp.v) ? imp.v.map(x => isNum(x) ? Math.round(x) : '—').join(', ') : imp.v)}.` : ''; })()}${src.notes ? `<div class="footnote">${esc(src.notes)}</div>` : ''}${src.url ? ` <a href="${esc(src.url)}" target="_blank" rel="noopener">Open the filings to check it</a>` : ''}</div>` : ''}
      <div class="form"><h3>Record your source</h3>
        <label>Source name<input type="text" data-src="name" value="${esc(src.name || '')}" placeholder="e.g. Amazon 2025 Form 10-K"></label>
        <label>Filing or report type<select data-src="type">${types.map(t => `<option ${src.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label>Reporting period<input type="text" data-src="period" value="${esc(src.period || '')}" placeholder="e.g. FY2025, Q2 2026, as of 1 Jul 2026"></label>
        <label>Source URL<input type="url" data-src="url" value="${esc(src.url || '')}" placeholder="https://"></label>
        <label>Analyst notes<textarea data-src="notes" rows="3" placeholder="Why this number, adjustments made">${esc(src.notes || '')}</textarea></label>
        <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="reviewed" ${cur.reviewed[drawerKey] ? 'checked' : ''}> ${f.kind === 'forecast' ? "I've reviewed this assumption" : "I've checked this figure against the filing or quote"}</label>
      </div>
      <div class="form"><h3>Teacher's video (optional)</h3><label>Replace the video link for this field in this model<input type="url" id="video-url" value="${esc(custom || '')}" placeholder="https://www.youtube.com/watch?v=…"></label></div>
      ${changes.length ? `<div><h3>Recent changes</h3><ul class="footnote" style="padding-left:18px">${changes.map(l => `<li>${new Date(l.at).toLocaleString()}${l.s ? ' · ' + l.s : ''}: ${esc(l.from == null ? '—' : l.from)} → ${esc(l.to == null ? '—' : l.to)}</li>`).join('')}</ul></div>` : ''}
    </aside>`;
    const first = root.querySelector('.close'); if (first) first.focus();
  }

  // ---------- render ----------
  function render() {
    calcCache = null;
    const active = document.activeElement && document.activeElement.id;
    renderTop(); renderRail();
    const p = page();
    document.body.dataset.page = p;
    $('#main').innerHTML = `<div class="page">${P[p]()}</div>`;
    document.title = (cur.inputs.company.name ? cur.inputs.company.name + ' · ' : '') + 'DCF Pro';
    const target = pendingFocus || active;
    pendingFocus = null;
    if (target) { const el = document.getElementById(target); if (el) { el.focus({ preventScroll: false }); if (el.scrollIntoView && target !== active) el.scrollIntoView({ block: 'center' }); } }
  }

  // ---------- events ----------
  function setInput(el) {
    const t = el.dataset.t, unit = el.dataset.unit || 'num';
    const id = el.id;
    const p = parse(el.value, unit === 'num' ? 'num' : unit);
    if (p.error) { parseErrors[id] = p.error; parseErrors[id + ':raw'] = el.value; render(); return; }
    delete parseErrors[id]; delete parseErrors[id + ':raw'];
    const v = p.v;
    let field, s = el.dataset.s || null, from;
    if (t === 'in') {
      const k = el.dataset.k; field = k;
      if (k.startsWith('company.')) { const c = k.split('.')[1]; from = cur.inputs.company[c]; cur.inputs.company[c] = v; if (c === 'name' && v) { if (cur.name === 'New company' || cur.sample) cur.name = v; } }
      else if (s) { from = cur.inputs[k][s]; cur.inputs[k][s] = v; }
      else { from = cur.inputs[k]; cur.inputs[k] = v; }
    } else if (t === 'hist') { const k = el.dataset.k, i = +el.dataset.i; field = 'hist.' + k; s = cur.hist.years[i] ? 'FY' + cur.hist.years[i] : 'year ' + (i + 1); from = cur.hist[k][i]; cur.hist[k][i] = v; }
    else if (t === 'year') { const i = +el.dataset.i; field = 'hist.years'; from = cur.hist.years[i]; cur.hist.years[i] = v === null ? null : (isNaN(+v) ? v : +v); }
    else if (t === 'wb') { field = 'wb.' + el.dataset.k; from = cur.wb[el.dataset.k]; cur.wb[el.dataset.k] = v; }
    else if (t === 'tr') { const i = +el.dataset.i, k = el.dataset.k; field = `tranche ${i + 1} ${k}`; from = cur.tranches[i][k]; cur.tranches[i][k] = v; }
    else if (t === 'st') { field = 'street.' + el.dataset.k; from = cur.street[el.dataset.k]; cur.street[el.dataset.k] = v; }
    else if (t === 'sens') { const a = el.dataset.k, i = +el.dataset.i; if (v === null) { render(); return; } cur.sens[a][i] = v; persist(); render(); return; }
    if (from !== v) { DCFModel.logChange(cur, field, s, from, v); }
    if (t === 'in' && cur.defaults && cur.defaults[field]) delete cur.defaults[field];
    persist();
    setTimeout(render, 0);
  }
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.t) return setInput(el);
    if (el.id === 'model-select') { cur = models[el.value]; try { localStorage.setItem('dcfcalc.current', cur.id); } catch (x) {} parseErrors = {}; render(); return; }
    if (el.id === 'mode-select') { DCFModel.logChange(cur, 'method', null, cur.mode, el.value); cur.mode = el.value; persist(); render(); toast(el.value === 'corrected' ? 'Using the corrected method' : 'Using the exact original workbook method'); return; }
    if (el.id === 'model-name') { cur.name = el.value.trim() || 'Untitled model'; persist(); render(); return; }
    if (el.id === 'reviewed') { cur.reviewed[drawerKey] = el.checked; persist(); render(); renderDrawer(); return; }
    if (el.id === 'video-url') { cur.videos = cur.videos || {}; const u = el.value.trim(); if (u && !/^https?:\/\//i.test(u)) { toast('The video link must start with https://'); return; } if (u) cur.videos[drawerKey] = u; else delete cur.videos[drawerKey]; persist(); renderDrawer(); return; }
    if (el.dataset && el.dataset.src !== undefined) { const s = cur.sources[drawerKey] || {}; s[el.dataset.src] = el.value; if (Object.values(s).some(x => x)) cur.sources[drawerKey] = s; else delete cur.sources[drawerKey]; persist(); render(); return; }
    if (el.id === 'open-json') return openJson(el);
    if (el.id === 'sec-file') return loadSecFile(el);
    if (el.id === 'sec-q') { renderModal(); return; }
    if (el.id === 'import-xlsx') return importXlsx(el);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal) { modal = null; renderModal(); return; }
    if (e.key === 'Escape' && searchState.open) { searchState.open = false; renderSearchResults(); return; }
    if (e.target.id === 'co-search') {
      if (e.key === 'Enter') { e.preventDefault(); const q = e.target.value.trim(); if (!q) return; const exact = searchState.results.find(r => r.symbol.toUpperCase() === q.toUpperCase()); importSymbol(exact ? exact.symbol : (searchState.results.length && !/^[A-Za-z.\-]{1,6}$/.test(q) ? searchState.results[0].symbol : q)); return; }
      if (e.key === 'ArrowDown') { const f = document.querySelector('#search-results [data-import]'); if (f) { e.preventDefault(); f.focus(); } return; }
    }
    if (e.target.closest && e.target.closest('#search-results') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const items = [...document.querySelectorAll('#search-results [data-import]')]; const i = items.indexOf(e.target); const n = items[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); else if (e.key === 'ArrowUp') $('#co-search').focus(); return; }
    if (e.key === 'Escape' && drawerKey) { drawerKey = null; renderDrawer(); } if (e.key === 'Enter' && e.target.dataset && e.target.dataset.t && e.target.tagName === 'INPUT') e.target.blur(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('button, [data-close], [data-close-modal], a');
    if (searchState.open && !e.target.closest('.search')) { searchState.open = false; renderSearchResults(); }
    if (!b) return;
    if (b.matches('[data-close-modal]')) { modal = null; renderModal(); return; }
    if (b.dataset.openData !== undefined || b.id === 'open-data') { searchState.open = false; renderSearchResults(); modal = 'data'; renderModal(); return; }
    if (b.dataset.import) { importSymbol(b.dataset.import); return; }
    if (b.dataset.themeSet) { setTheme(b.dataset.themeSet); renderTop(); return; }
    if (b.id === 'save-model' || b.dataset.saveModel !== undefined) { saveModel(); return; }
    if (b.id === 'new-dcf') { newDcf(); return; }
    if (b.id === 'run-dcf') { runDcf(); return; }
    if (b.dataset.tab) { dashTab = b.dataset.tab; render(); return; }
    if (b.dataset.useRef) { useRef(b.dataset.useRef); return; }
    if (b.dataset.confirmDefault) { b.dataset.confirmDefault.split(',').forEach(k => { if (cur.defaults && cur.defaults[k]) { delete cur.defaults[k]; DCFModel.logChange(cur, k, null, null, 'kept default (' + (FBY[k].tri ? SC.map(x => cur.inputs[k][x]).join(' / ') : cur.inputs[k]) + ')'); } }); persist(); render(); toast('Defaults confirmed'); return; }
    if (b.dataset.reviewGroup) { const g = b.dataset.reviewGroup; FIELDS.filter(f => f.group === g && f.kind === 'forecast').forEach(f => cur.reviewed[f.key] = true); DCFModel.logChange(cur, 'reviewed section', null, null, GROUPS[g].title); persist(); render(); return; }
    if (b.dataset.dismissImport !== undefined) { importStatus = null; render(); return; }
    if (b.dataset.focusSearch !== undefined) { const i = $('#co-search'); if (i) { i.focus(); searchState.open = true; renderSearchResults(); } return; }
    if (b.dataset.goPage) { location.hash = b.dataset.goPage; return; }
    if (b.id === 'cfg-save') {
      const c = dataCfg(); const r = document.querySelector('input[name="prov"]:checked'); if (r) c.provider = r.value;
      document.querySelectorAll('[data-key]').forEach(i => { const v = i.value.trim(); if (v) c.keys[i.dataset.key] = v; else delete c.keys[i.dataset.key]; });
      c.remember = $('#cfg-remember').checked; c.replace = $('#cfg-replace').checked; saveDataCfg();
      modal = null; renderModal(); render(); toast(c.keys[c.provider] ? `Connected to ${DCFData.PROVIDERS[c.provider].name}. Search a company in the top bar.` : 'Settings saved. Add an API key to search and import.');
      const i = $('#co-search'); if (i && c.keys[c.provider]) i.focus();
      return;
    }
    if (b.matches('[data-close]')) { drawerKey = null; renderDrawer(); return; }
    if (b.dataset.help) { drawerKey = b.dataset.help; renderDrawer(); return; }
    if (b.dataset.act) { cur.active = b.dataset.act; persist(); render(); return; }
    if (b.id === 'menu-btn') { $('#rail').classList.toggle('open'); return; }
    if (b.closest('#rail') && b.tagName === 'A') { $('#rail').classList.remove('open'); return; }
    if (b.dataset.goto) {
      const k = b.dataset.goto;
      if (k.startsWith('hist.')) return goField('historicals', `h-${k.slice(5)}-${b.dataset.i || 4}`);
      return goField(fieldPage(k), fid(k, b.dataset.s || null));
    }
    if (b.id === 'snap-save') { const nm = ($('#snap-name').value || '').trim() || 'Version ' + (cur.snapshots.length + 1); const { all } = calc(); const values = { weighted: all.weighted }; SC.forEach(s => values[s] = all.scen[s].ok ? all.scen[s].perShare : null); cur.snapshots.unshift({ name: nm, at: new Date().toISOString(), mode: cur.mode, values, data: JSON.parse(JSON.stringify({ inputs: cur.inputs, hist: cur.hist, wb: cur.wb, tranches: cur.tranches, mode: cur.mode })) }); persist(); render(); toast('Saved “' + nm + '”'); return; }
    if (b.dataset.snapRestore !== undefined) { const s = cur.snapshots[+b.dataset.snapRestore]; Object.assign(cur, JSON.parse(JSON.stringify(s.data))); DCFModel.logChange(cur, 'restored version', null, null, s.name); persist(); render(); toast('Restored “' + s.name + '”'); return; }
    if (b.dataset.snapDel !== undefined) { cur.snapshots.splice(+b.dataset.snapDel, 1); persist(); render(); return; }
    if (b.id === 'new-blank') { newDcf(); return; }
    if (b.id === 'new-sample') { if (!sample) { toast('The example data could not be loaded.'); return; } cur = DCFModel.fromSample(sample, 'Amazon.com, Inc. (example)'); persist(); setCurrent(); render(); return; }
    if (b.id === 'dup') { const c = JSON.parse(JSON.stringify(cur)); c.id = DCFModel.blank().id; c.name = cur.name + ' (copy)'; cur = c; persist(); setCurrent(); render(); return; }
    if (b.dataset.open) { cur = models[b.dataset.open]; setCurrent(); render(); return; }
    if (b.dataset.del) { confirmDelete = b.dataset.del; render(); return; }
    if (b.dataset.delNo !== undefined) { confirmDelete = null; render(); return; }
    if (b.dataset.delYes) { DCFModel.remove(b.dataset.delYes); models = DCFModel.loadAll(); confirmDelete = null; if (b.dataset.delYes === cur.id) { cur = Object.values(models)[0] || (sample ? DCFModel.fromSample(sample, 'Amazon.com, Inc. (example)') : DCFModel.blank()); persist(); setCurrent(); } render(); return; }
    if (b.id === 'save-json') { download(new Blob([JSON.stringify(cur, null, 1)], { type: 'application/json' }), safeName(cur.name) + '.dcf.json'); return; }
    if (b.dataset.export) return exportXlsx(b.dataset.export);
  });
  let searchTimer = null;
  document.addEventListener('input', e => {
    if (e.target.id !== 'co-search') return;
    const q = e.target.value.trim();
    clearTimeout(searchTimer);
    searchState.q = q; searchState.open = true;
    if (!q) { searchState.results = []; searchState.error = null; renderSearchResults(); return; }
    searchTimer = setTimeout(() => runSearch(q), 350);
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'co-search') { searchState.open = true; renderSearchResults(); } });
  function saveModel() {
    cur.savedAt = new Date().toISOString();
    calcCache = null;
    const { all } = calc(); const T = track();
    cur.savedResults = { at: cur.savedAt, weighted: all.weighted, Base: all.scen.Base.ok ? all.scen.Base.perShare : null, Bear: all.scen.Bear.ok ? all.scen.Bear.perShare : null, Bull: all.scen.Bull.ok ? all.scen.Bull.perShare : null, pct: T.pct, complete: T.complete, mode: cur.mode };
    persist(); render();
    toast(`Saved “${cur.name}” with its results and progress (${T.pct}% complete)`);
  }
  function newDcf() {
    persist();
    cur = DCFModel.blank(); persist(); setCurrent(); importStatus = null; dashTab = 'key';
    if (page() !== 'dashboard') location.hash = 'dashboard'; else render();
    toast('New DCF started. Your other models are kept in the Saved models library.');
    setTimeout(() => { const i = $('#co-search'); if (i) i.focus(); }, 50);
  }
  function runDcf() {
    cur.lastRun = new Date().toISOString(); persist(); calcCache = null;
    const { all } = calc(); const T = track();
    render();
    if (all.weighted !== null) {
      toast(`Valuation run: probability-weighted value ${plain(fmt.usd(all.weighted))}${T.complete ? '' : `. Model ${T.pct}% complete`}`);
      const el = document.querySelector('[style*="grid-area:vs"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const n = blockers().length;
      toast(n ? `Can't run yet: ${n} required input${n > 1 ? 's' : ''} missing or invalid` : `Can't run yet: ${all.weightedNote}`);
      const el = document.querySelector('.completion'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  function useRef(k) {
    const R = cur.ref || {}, H = cur.hist;
    const map = { rf: 'rf', beta: 'beta', effTax: 'tax', cagr: 'g1', ebitdaM: 'em1', daM: 'da', capM: 'capex1' };
    const t = map[k]; if (!t) return;
    let v = R[k] ? R[k].v : null, label = R[k] ? R[k].label : '';
    const hn = (key, i) => isNum(H[key][i]) ? H[key][i] : null;
    const avg = fn => { const xs = [0, 1, 2, 3, 4].map(fn).filter(isNum); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
    if (k === 'cagr') { const idx = [0, 1, 2, 3, 4].filter(i => isNum(hn('rev', i)) && H.rev[i] > 0); if (idx.length > 1) v = Math.pow(H.rev[idx[idx.length - 1]] / H.rev[idx[0]], 1 / (idx[idx.length - 1] - idx[0])) - 1; label = 'Historical revenue CAGR'; }
    if (k === 'ebitdaM') { v = avg(i => isNum(hn('gp', i)) && isNum(hn('opex', i)) && hn('rev', i) ? (H.gp[i] - H.opex[i]) / H.rev[i] : null); label = 'Average historical EBITDA margin'; }
    if (k === 'daM') { v = avg(i => isNum(hn('da', i)) && hn('rev', i) ? H.da[i] / H.rev[i] : null); label = 'Average historical D&A % of revenue'; }
    if (k === 'capM') { v = avg(i => isNum(hn('capex', i)) && hn('rev', i) ? -H.capex[i] / H.rev[i] : null); label = 'Average historical CapEx % of revenue'; }
    if (!isNum(v)) return;
    v = t === 'beta' ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000;
    const scen = k === 'rf' ? SC : [cur.active];
    scen.forEach(x => { const from = cur.inputs[t][x]; cur.inputs[t][x] = v; DCFModel.logChange(cur, t, x, from, v); });
    if (!cur.sources[t] && R[k]) cur.sources[t] = { name: R[k].source, type: R[k].type, period: R[k].period, url: R[k].url || '', notes: `Accepted the ${label.toLowerCase()} as the starting value${k === 'rf' ? ' for all scenarios' : ' for the ' + cur.active + ' case'}.`, retrieved: R[k].retrieved, provider: R[k].provider, auto: true };
    persist(); render();
    toast(`${FBY[t].label}${k === 'rf' ? ' (all cases)' : ' (' + cur.active + ')'} set to ${t === 'beta' ? v.toFixed(2) : (v * 100).toFixed(2) + '%'}. Review it before relying on it.`);
  }
  const safeName = s => (s || 'model').replace(/[^\w\- .()]+/g, '').trim().slice(0, 60) || 'model';
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  function setCurrent() { try { localStorage.setItem('dcfcalc.current', cur.id); } catch (e) {} models = DCFModel.loadAll(); parseErrors = {}; }
  function openJson(el) {
    const file = el.files[0]; if (!file) return;
    file.text().then(t => { const m = DCFModel.upgrade(JSON.parse(t)); if (!m.inputs || !m.hist) throw new Error('bad'); m.id = models[m.id] ? DCFModel.blank().id : m.id; cur = m; persist(); setCurrent(); render(); toast('Opened ' + m.name); })
      .catch(() => toast('That file is not a DCF Workbench model file.'));
  }
  async function exportXlsx(tpl) {
    const st = $('#xl-status'); st.textContent = 'Building the workbook…';
    try {
      let buf;
      if (window.DCF_TEMPLATES && window.DCF_TEMPLATES[tpl]) buf = Uint8Array.from(atob(window.DCF_TEMPLATES[tpl]), c => c.charCodeAt(0)).buffer;
      else { const res = await fetch(`templates/dcf-template-${tpl}.xlsx`); if (!res.ok) throw new Error('The workbook template could not be loaded (' + res.status + ').'); buf = await res.arrayBuffer(); }
      const bytes = await DCFExcel.exportModel(JSZip, buf, cur, FIELDS, HIST_FIELDS, tpl === 'original' ? 'workbook' : 'corrected');
      download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName(cur.name)} DCF (${tpl}).xlsx`);
      st.textContent = 'Exported. Excel recalculates every formula when you open the file.';
    } catch (e) { st.textContent = 'Export failed: ' + e.message; }
  }
  async function importXlsx(el) {
    const file = el.files[0]; if (!file) return; const st = $('#xl-status'); st.textContent = 'Reading the workbook…';
    try {
      const m = await DCFExcel.importModel(JSZip, await file.arrayBuffer(), DCFModel.blank(file.name.replace(/\.xlsx$/i, '')), FIELDS, HIST_FIELDS);
      if (m.inputs.company.name) m.name = m.inputs.company.name + ' (imported)';
      DCFModel.logChange(m, 'imported from Excel', null, null, file.name);
      cur = m; persist(); setCurrent(); render(); toast('Imported ' + file.name + (m.mode === 'workbook' ? ' (original workbook method)' : ''));
    } catch (e) { st.textContent = 'Import failed: ' + e.message; }
  }

  // ---------- boot ----------
  async function boot() {
    if (!window.DCF_SAMPLE) { try { const r = await fetch('data/amzn-sample.json'); if (r.ok) sample = await r.json(); } catch (e) {} }
    if (!sample && window.DCF_SAMPLE) sample = window.DCF_SAMPLE;
    let id = null; try { id = localStorage.getItem('dcfcalc.current'); } catch (e) {}
    cur = (id && models[id]) || Object.values(models)[0] || null;
    if (cur) cur = DCFModel.upgrade(cur);
    if (!cur) { cur = sample ? DCFModel.fromSample(sample, 'Amazon.com, Inc. (example)') : DCFModel.blank(); persist(); setCurrent(); }
    if (sample) {
      const s = DCFModel.fromSample(sample);
      const ow = DCF.runAll(DCFModel.engineInputs(Object.assign(s, { mode: 'workbook' })).inp, 'workbook');
      const s2 = DCFModel.fromSample(sample); const co = DCF.runAll(DCFModel.engineInputs(s2).inp, 'corrected');
      const X = { Base: 183.77816669798423, Bear: 47.40697715833958, Bull: 374.88474315588223, weighted: 204.28057290452983, ev: 2066527.2598430207, tv: 3813533.1556296204 };
      const XC = { Base: 179.197930539096, Bear: 47.5633682647069, Bull: 364.550000240151, weighted: 199.209035509482, ev: 2016359.93319471 };
      const d = (a, b) => isNum(a) && isNum(b) ? Math.abs(a - b).toExponential(1) : 'n/a';
      RECON = SC.map(k => [k + ' value per share', fmt.usd(X[k]), fmt.usd(ow.scen[k].perShare), d(ow.scen[k].perShare, X[k]), fmt.usd(XC[k]), fmt.usd(co.scen[k].perShare), d(co.scen[k].perShare, XC[k])]);
      RECON.push(['Probability-weighted value', fmt.usd(X.weighted), fmt.usd(ow.weighted), d(ow.weighted, X.weighted), fmt.usd(XC.weighted), fmt.usd(co.weighted), d(co.weighted, XC.weighted)]);
      RECON.push(['Base enterprise value ($ mm)', fmt.mm(X.ev), fmt.mm(ow.scen.Base.ev), d(ow.scen.Base.ev, X.ev), fmt.mm(XC.ev), fmt.mm(co.scen.Base.ev), d(co.scen.Base.ev, XC.ev)]);
    }
    render();
  }
  boot();
})();
