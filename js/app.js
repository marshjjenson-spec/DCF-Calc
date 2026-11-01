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
    { id: 'guide', title: 'Share dilution guide', grp: 'Overview', icon: 'learn' },
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
  const UNIT_TXT = { pct: '%', usd: 'USD per share', usd_mm: '$ millions', shares: 'millions of shares', x: '×', text: 'text', date: 'date', choice: 'choice' };
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

  function persist() { if (cur) { DCFModel.syncDilution(cur); const ok = DCFModel.save(cur); if (!ok) toast('Could not save in this browser. Use "Save model file" on Saved models.'); models = DCFModel.loadAll(); } }
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
    dataMem = Object.assign({ provider: 'fmp', keys: {}, remember: true }, c || {}); delete dataMem.replace;
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
  // the analyst's name is remembered on this computer and filled into new models
  function withAnalyst(m) { let a = null; try { a = localStorage.getItem('dcfcalc.analyst'); } catch (e) {} if (a && !m.inputs.company.analyst) m.inputs.company.analyst = a; return m; }
  function targetModelFor(match) {
    if (match(cur) || pristine(cur)) return cur;
    return withAnalyst(DCFModel.blank());
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
    const res = DCFData.applyImport(m, imp);
    cur = m; persist(); setCurrent(); pendSel = null; pendConfirm = false;
    importStatus = { ok: true, label, provider: imp.provider, at: imp.retrieved, changed: res.changed.length, kept: res.kept, pending: res.pending.length, notes: res.notes, isNew };
    if (page() !== 'dashboard') location.hash = 'dashboard'; else render();
    toast(`Imported ${res.changed.length} figures from ${imp.provider}${res.pending.length ? `. ${res.pending.length} change${res.pending.length > 1 ? 's' : ''} wait for your approval` : ''}`);
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
      <p class="footnote">Imports never overwrite a value you typed or changed: differences are listed for you to approve. FMP and Alpha Vantage figures are shown as provider data, not as SEC-verified.</p>
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
    calcCache = { mode, inp, invalid, all, act, wb, comp, anchors: DCFAnalysis.anchors(cur) };
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
    learn: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
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
    if (!f.tri) { const val0 = f.key.startsWith('company.') ? cur.inputs.company[f.key.split('.')[1]] : cur.inputs[f.key]; const c = catOf(f.key, val0); if (c !== 'manual' && c !== 'analyst' && !(c === 'missing' && f.kind === 'company')) t.push(catBadge(c, srcTitle(f.key))); if (cur.sources[f.key] && cur.sources[f.key].stale) t.push('<span class="cat c-miss" title="A newer filing exists than the one this value came from">Older filing</span>'); }
    if (pv !== 'imported' && pv !== 'overridden' && cur.sources[f.key]) t.push('<span class="tag src">Source noted</span>');
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
    const ik = s ? f.key + '.' + s : f.key, iv = cur.imported && cur.imported[ik];
    const impCls = iv && !empty ? (JSON.stringify(iv.v) === JSON.stringify(val) ? 'imp' : 'ovr') : '';
    return `<div class="inwrap ${err ? 'err' : ''} ${empty && f.required ? 'empty' : ''} ${impCls}" ${impCls ? `title="${esc(impCls === 'imp' ? srcTitle(f.key) : 'Changed from the imported value')}"` : ''}>${control}</div>${err ? `<div class="errmsg">${esc(err)}</div>` : ''}`;
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
        { const bi = DCFModel.baseInfo(cur); rows += calcRow('Base-year revenue ($ mm)', isNum(inp.rev0) ? fmt.mm(inp.rev0) : '<span class="na">Not available</span>', false, `Linked to the forecast base: ${esc(bi.label || 'latest fiscal year')}. <button class="linkbtn" data-scroll-to="base-panel">Change the base</button>`, true); }
        return;
      }
      if ((f.key === 'we' || f.key === 'tcapex') && cur.mode === 'corrected') return;
      let note = '';
      if (f.key === 'exitMult') note = 'Needed only for scenarios that use Exit Multiple.';
      if (!rel && f.key !== 'exitMult') note = 'Not used by the current method.';
      if (f.tri) rows += `<div>${labelCell(f, note)}</div>${SC.map(s => `<div class="cell" data-s="${s}">${inputHtml(f, s)}</div>`).join('')}` + (f.kind === 'forecast' && ['revenue', 'margins', 'reinvest'].includes(g) ? aidRow(f) : '');
      else rows += `<div>${labelCell(f, note)}</div><div>${inputHtml(f, null)}</div><div class="blank"></div>${tri ? '<div class="blank"></div>' : ''}`;
    });
    // calculated rows for some groups
    if (g === 'market') {
      const sh = [inp.basic, inp.options, inp.treasury].every(isNum) ? inp.basic + inp.options - inp.treasury : null;
      rows += calcRow('Diluted shares (mm)', fmt.n(sh, 0), false, 'Actual shares + gross new shares from dilutive securities − shares repurchased (treasury stock method).');
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

  // ---------- market data and share dilution ----------
  const SRC_CLS = { market: ['Market quote', 'b-mkt'], filing: ['SEC filing data', 'b-fil'] };
  function srcBadge(key, asOfKey) {
    const s = cur.sources[key], d = cur.asOf && cur.asOf[asOfKey];
    const v = cur.inputs[key];
    if (!isNum(v)) return '<span class="na">—</span>';
    const pv = provOf(key, v);
    const cls = s && s.cls ? SRC_CLS[s.cls] : null;
    const who = pv === 'imported' ? `Imported · ${esc(s.provider || s.name)}` : pv === 'overridden' ? 'Changed by you' : s ? esc(s.name) : 'Entered by you, no source yet';
    return `<div class="srcb">${cls ? `<span class="badge-s ${cls[1]}">${cls[0]}</span>` : ''}<span class="badge-s ${pv === 'overridden' ? 'b-ovr' : pv === 'imported' ? 'b-imp' : 'b-man'}">${who}</span>${d ? `<span class="asof">as of ${esc(d)}</span>` : ''}</div>`;
  }
  function asOfInput(k, label) {
    const v = (cur.asOf || {})[k];
    return `<input type="date" class="asof-in" data-t="asof" data-k="${k}" id="asof-${k}" value="${esc(v || '')}" aria-label="As of date for ${esc(label)}">`;
  }
  function marketPanel() {
    const I = cur.inputs;
    const mc = DCFModel.marketChecks(cur);
    const warnFor = k => mc.filter(w => w.key === k).map(w => `<div class="mwarn ${w.level}">${esc(w.text)}</div>`).join('');
    const row = (key, asOfKey, showDate = true, note = '') => {
      const f = FBY[key];
      return `<div class="mrow">
        <div class="mlab"><div class="name"><button class="help" data-help="${key}" aria-label="Where to find ${esc(f.label)}">?</button>${esc(f.label)}</div>
          <div class="tags">${f.required ? '<span class="tag req">Required</span>' : '<span class="tag">Optional</span>'}<span class="tag">${esc(f.unitText || UNIT_TXT[f.unit])}</span></div>
          <details class="mini"><summary>Where to find it</summary><div class="footnote">${esc(f.source)}${f.guide && f.guide.example ? `<br><b>Example:</b> ${esc(f.guide.example)}` : ''} <button class="linkbtn" data-help="${key}">Step-by-step guide</button></div></details></div>
        <div class="mval">${inputHtml(f, null)}</div>
        <div class="mdate">${showDate ? asOfInput(asOfKey, f.label) : `<span class="footnote">${note}</span>`}</div>
        <div class="msrc">${srcBadge(key, asOfKey)}${warnFor(key)}</div></div>`;
    };
    const mcap = isNum(I.price) && isNum(I.basic) ? I.price * I.basic : null;
    return `<section class="panel" id="grp-market">
      <div class="panel-head"><h2>Market data</h2><span class="footnote">Market quotes are current prices; share counts come from SEC filings. Each value keeps its date.</span></div>
      <div class="mgrid"><div class="mrow mhead"><div>Input</div><div>Value</div><div>As of</div><div>Source and status</div></div>
        ${row('price', 'price')}${row('hi52', 'range')}${row('lo52', 'range', false, 'Same date as the high')}${row('basic', 'basic')}
        <div class="mrow calc"><div class="mlab"><div class="name">Market capitalisation on actual shares</div><div class="tags"><span class="tag calc">Calculated</span><span class="tag">$ millions</span></div></div><div class="mval"><div class="calcv">${fmt.mm(mcap)}</div></div><div></div><div class="msrc footnote">Price × actual shares outstanding. Compare this with a quote site's market cap, which also uses actual shares, not diluted.</div></div>
      </div></section>`;
  }
  function dilInput(path, unit, label, ph = 'Enter') {
    const v = path.split('.').reduce((o, k) => o == null ? o : o[k], cur.dilution);
    const id = 'dil-' + path.replace(/\./g, '-'), err = parseErrors[id];
    const u = unit === 'usd' ? '$' : unit === 'usd_mm' ? '$mm' : unit === 'shares' ? 'mm' : '';
    if (unit === 'text') return `<input type="text" class="txt dil-t" data-t="dil" data-k="${path}" data-unit="text" id="${id}" value="${esc(v || '')}" placeholder="${ph}" aria-label="${esc(label)}">`;
    return `<div class="inwrap ${err ? 'err' : ''}"><input type="text" inputmode="decimal" data-t="dil" data-k="${path}" data-unit="${unit}" id="${id}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, unit))}" placeholder="${ph}" aria-label="${esc(label)}"><span class="unit">${u}</span></div>${err ? `<div class="errmsg">${esc(err)}</div>` : ''}`;
  }
  const dilChk = (k, label, path) => `<label class="check"><input type="checkbox" data-t="dilchk" data-k="${path || k}" ${((path || k).split('.').reduce((o, x) => o == null ? o : o[x], cur.dilution)) ? 'checked' : ''}> ${label}</label>`;
  function dilutionCalcHtml(d, I) {
    if (!d.method) return '';
    const n = v => isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '—';
    let rows = '';
    rows = d.rows.length ? `<div class="tbl-wrap"><table class="fin dtab"><thead><tr><th>Security</th><th>Units (mm)</th><th>Exercise / conversion price</th><th>Gross new shares</th><th>Repurchased (TSM)</th><th>Net new shares</th><th>Treatment</th></tr></thead><tbody>
      ${d.rows.map(r => `<tr><td>${esc(r.label)}<div class="footnote">${esc(r.type)}</div></td><td>${n(r.n)}</td><td>${isNum(r.k) ? '$' + n(r.k) : '—'}</td><td>${n(r.gross)}</td><td>${r.buyback ? '(' + n(r.buyback) + ')' : n(0)}</td><td><b>${n(r.net)}</b></td><td class="note">${esc(r.note)}${r.type !== 'RSUs' && r.type !== 'Estimate' && isNum(r.k) && isNum(I.price) && r.itm ? `<div class="footnote">${n(r.n)} × $${n(r.k)} ÷ $${n(I.price)} = ${n(r.buyback)} repurchased</div>` : ''}${r.type === 'RSUs' && r.buyback ? `<div class="footnote">$${n(cur.dilution.rsu.unrecog)}mm ÷ $${n(I.price)} = ${n(r.buyback)} repurchased</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '';
    const sum = d.ok ? `<div class="dsum">
        <div><span>Actual common shares outstanding</span><b>${n(I.basic)}</b><small>${cur.asOf && cur.asOf.basic ? 'as of ' + esc(cur.asOf.basic) : 'date not set'}</small></div>
        <div class="op">+</div><div><span>Gross new shares</span><b>${n(d.gross)}</b><small>dilutive securities</small></div>
        <div class="op">−</div><div><span>Repurchased (treasury stock method)</span><b>${n(d.buyback)}</b><small>hypothetical buyback</small></div>
        <div class="op">=</div><div class="tot"><span>Estimated diluted shares</span><b>${n(d.diluted)}</b><small>used to divide equity value</small></div></div>
        <p class="footnote">Net new shares ${n(d.net)} million (${isNum(I.basic) && I.basic ? (d.net / I.basic * 100).toFixed(2) : '—'}% of actual shares). ${cur.dilution.method === 'proxy' ? `The workbook's two share cells receive ${n(d.gross)} as gross new shares and 0 as shares repurchased, because the reported figure is already net of the treasury stock method.` : `These fill the workbook's two share cells: gross new shares ${n(d.gross)} and shares repurchased ${n(d.buyback)}.`} Diluted shares here are an estimate, not a count reported by the SEC.</p>`
      : `<div class="notice bad">${esc(d.problem || 'Incomplete')}</div>`;
    return rows + sum + (d.warnings.length ? `<div class="notice"><ul>${d.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '');
  }
  function dilutionPanel() {
    const D = cur.dilution, I = cur.inputs, d = DCFModel.dilution(cur), R = cur.ref || {};
    const m = D.method;
    const meth = [['simple', 'Simple', 'Actual shares, plus an optional estimate'], ['proxy', 'Reported net dilution', 'Mode A: the latest EPS note\'s net effect, a historical proxy'], ['advanced', 'Detailed estimate', 'Mode B: options, RSUs, warrants, convertibles'], ['totals', 'Workbook totals', 'Type the two totals, as in the spreadsheet']];
    const SD = cur.shareData || {};
    let body = '';
    if (!m) body = '<div class="notice">Choose how to get from actual shares to diluted shares. New to this? Start with <b>Simple</b>.</div>';
    if (m === 'simple') {
      const refs = ['dilutedWA', 'incrementalWA', 'basicWA'].filter(k => R[k]);
      body = `<div class="dgrid2"><div><div class="flabel"><div class="name"><button class="help" data-help="dil.est">?</button>Estimated diluted shares (optional)</div><div class="tags"><span class="tag">millions of shares</span></div></div>${dilInput('est', 'shares', 'Estimated diluted shares')}</div>
        <div class="dopts">${dilChk('ignore', 'Value on actual shares only (no dilution adjustment)')}<p class="footnote">Leave the estimate blank only if you tick this. The model never assumes zero dilution for you.</p></div></div>
        ${refs.length ? `<div class="refbox"><h3>Reference from filings, not used automatically</h3>${refs.map(k => `<div class="ref"><div><span>${esc(R[k].label)}</span><small>${esc(R[k].source)}, ${esc(R[k].period)}</small><small>${esc(R[k].notes || '')}</small></div><b>${plain(fmt.n(R[k].v, 1))} mm</b>${k === 'dilutedWA' ? '<button class="btn tiny" data-use-dilwa>Use as my estimate</button>' : ''}</div>`).join('')}</div>` : ''}`;
    }
    if (m === 'proxy') {
      const q = SD.netDilQ, fy = SD.netDilFY, P = D.proxy || {};
      const recBtn = (r, k, label) => r && isNum(r.value) ? `<div class="ref"><div><span>${esc(label)}</span><small>${esc(r.periodText || '')}${r.form ? ' · ' + esc(r.form) : ''}${r.accn ? ' · ' + esc(r.accn) : ''}${r.filed ? ' · filed ' + esc(r.filed) : ''}${r.cat === 'calc' ? ' · calculated as diluted − basic weighted average' : ''}</small></div><b>${nf(r.value, 1)} mm</b><button class="btn tiny" data-dil-fill="${k}">Use this</button></div>` : '';
      body = `<div class="notice">The net dilutive effect from the EPS calculation is already net of the treasury stock method, so no buyback is subtracted. It is an average for a past period at that period's average share price: a historical proxy, not a measure of current dilution.</div>
        <div class="dgrid2"><div><div class="flabel"><div class="name"><button class="help" data-help="dil.proxy">?</button>Reported net dilutive effect</div><div class="tags"><span class="tag">millions of shares</span>${isNum(P.v) ? catBadge('proxy') : catBadge('missing')}</div></div>${dilInput('proxy.v', 'shares', 'Reported net dilutive effect')}</div>
        <div><div class="flabel"><div class="name">Period it covers</div></div>${dilInput('proxy.period', 'text', 'Period', 'e.g. three months ended 2026-09-30')}</div></div>
        ${q || fy ? `<div class="refbox"><h3>From the filings</h3>${recBtn(q, 'netDilQ', 'Latest quarter (recommended)')}${recBtn(fy, 'netDilFY', 'Last fiscal year (older)')}</div>` : '<p class="footnote">Load the SEC company facts file to fill this from the filing, or type it from the EPS note of the latest 10-Q.</p>'}`;
    }
    if (m === 'advanced') {
      const miss = [];
      if (!D.none) {
        if (!SD.rsu) miss.push('Unvested RSUs: not in the SEC company facts file for this company (often tagged by award type). Read the stock award note of the latest 10-Q.');
        if (!SD.options) miss.push('Stock options: none found in the company facts file. Check the stock-based compensation note; many companies no longer grant options.');
        [['rsu', 'RSUs'], ['options', 'Options'], ['unrecog', 'Unrecognised compensation']].forEach(([k, l]) => { if (SD[k] && SD[k].stale) miss.push(`${l} figure is from an older filing (${SD[k].periodText}). A newer 10-Q may have changed it.`); });
      }
      const canFill = SD.rsu || SD.unrecog || SD.options;
      const tr = (arr, i, type) => `<tr><td>${dilInput(`${arr}.${i}.label`, 'text', `${type} ${i + 1} name`, `${type} ${i + 1}`)}</td><td>${dilInput(`${arr}.${i}.n`, 'shares', `${type} ${i + 1} units`)}</td><td>${dilInput(`${arr}.${i}.k`, 'usd', `${type} ${i + 1} price`)}</td>${arr === 'converts' ? `<td>${dilChk('', 'Net share settlement', `converts.${i}.net`)}</td>` : ''}</tr>`;
      body = `${dilChk('none', 'No dilutive securities outstanding')}
        ${canFill && !D.none ? '<div class="btns"><button class="btn" data-dil-fill-adv>Fill empty boxes from the filing</button><span class="footnote">Only empty boxes are filled. Each figure keeps its filing and date.</span></div>' : ''}
        ${miss.length && !D.none ? `<div class="notice"><b>Detailed estimate incomplete</b><ul>${miss.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${D.none ? '' : `<div class="dsec"><h3><button class="help" data-help="dil.options">?</button> Stock options <span class="footnote">10-K stock-based compensation note: options outstanding at year end</span></h3>
          <table class="dtbl"><thead><tr><th>Tranche</th><th>Options outstanding (mm)</th><th>Weighted-avg exercise price (USD/share)</th></tr></thead><tbody>${D.options.map((r, i) => tr('options', i, 'Options')).join('')}</tbody></table></div>
        <div class="dsec"><h3><button class="help" data-help="dil.rsu">?</button> Unvested RSUs / PSUs <span class="footnote">same note: unvested at period end, and unrecognised compensation cost</span></h3>
          <table class="dtbl"><thead><tr><th>Unvested units (mm)</th><th>Unrecognised compensation ($ mm, optional)</th></tr></thead><tbody><tr><td>${dilInput('rsu.n', 'shares', 'Unvested RSUs')}</td><td>${dilInput('rsu.unrecog', 'usd_mm', 'Unrecognised compensation')}</td></tr></tbody></table></div>
        <div class="dsec"><h3><button class="help" data-help="dil.warrants">?</button> Warrants</h3>
          <table class="dtbl"><thead><tr><th>Name</th><th>Warrants (mm shares)</th><th>Exercise price (USD/share)</th></tr></thead><tbody>${D.warrants.map((r, i) => tr('warrants', i, 'Warrants')).join('')}</tbody></table></div>
        <div class="dsec"><h3><button class="help" data-help="dil.converts">?</button> Convertible securities <span class="footnote">debt note: conversion rate and price</span></h3>
          <table class="dtbl"><thead><tr><th>Name</th><th>Shares on conversion (mm)</th><th>Conversion price (USD/share)</th><th>Settlement</th></tr></thead><tbody>${D.converts.map((r, i) => tr('converts', i, 'Convertible')).join('')}</tbody></table></div>`}`;
    }
    if (m === 'totals') body = `<div class="fgrid single">${['options', 'treasury'].map(k => `<div>${labelCell(FBY[k])}</div><div>${inputHtml(FBY[k], null)}</div><div class="blank"></div>`).join('')}</div><p class="footnote">The original workbook's two cells. Simple or Advanced calculate them for you.</p>`;
    return `<section class="panel" id="f-dilution-v" tabindex="-1">
      <div class="panel-head"><h2>Share dilution</h2><div class="btns"><a class="btn" href="#guide">Learn about diluted shares</a><button class="help" data-help="dil.method" aria-label="About the dilution methods">?</button></div></div>
      <div class="meth" role="radiogroup" aria-label="Dilution method">${meth.map(([k, l, s]) => `<button role="radio" aria-checked="${m === k}" data-dil-method="${k}"><b>${l}</b><small>${s}</small></button>`).join('')}</div>
      ${body}
      ${m ? `<h3 class="sub-h">Diluted share calculation <a class="footnote" href="#guide">How this works</a></h3>${dilutionCalcHtml(d, I)}` : ''}
    </section>`;
  }
  // ---------- source categories ----------
  const CAT = { sec: ['SEC reported', 'c-sec'], market: ['Market data', 'c-mkt'], provider: ['Provider imported', 'c-prov'], calc: ['Calculated', 'c-calc'], analyst: ['Analyst assumption', 'c-an'], proxy: ['Historical proxy', 'c-proxy'], override: ['User override', 'c-ovr'], missing: ['Missing data', 'c-miss'], manual: ['Entered by you', 'c-man'] };
  const CAT_TIP = { sec: 'Read from an SEC filing (XBRL company facts), with the accession number saved', market: 'A market quote: changes every trading day', provider: 'From a data provider. Not checked against the SEC filing', calc: 'Calculated by the calculator from other figures', analyst: 'Your forecast assumption', proxy: 'A past-period figure used in place of a current one', override: 'Imported, then changed by you', missing: 'Not available: enter it or leave it blank. It is never treated as zero', manual: 'Typed by you' };
  function catOf(key, value) {
    const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && !value.some(isNum));
    if (empty) return 'missing';
    const pv = provOf(key, value);
    if (pv === 'overridden') return 'override';
    const s = cur.sources[key];
    if (s && s.cat === 'proxy') return 'proxy';
    if (pv === 'imported' && s) return s.cat || (s.cls === 'market' ? 'market' : 'provider');
    const f = FBY[key]; if (f && f.kind === 'forecast') return 'analyst';
    return 'manual';
  }
  const catBadge = (c, extra) => c && CAT[c] ? `<span class="cat ${CAT[c][1]}" title="${esc(CAT_TIP[c] + (extra ? '. ' + extra : ''))}">${CAT[c][0]}</span>` : '';
  const nf = (v, d = 0) => isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) }) : 'Not available';
  function fmtVal(key, v) {
    const f = FBY[key] || {};
    if (!isNum(v)) return v == null || v === '' ? 'Not available' : esc(v);
    if (f.unit === 'pct') return (v * 100).toFixed(2) + '%';
    if (f.unit === 'usd') return '$' + v.toFixed(2);
    if (f.unit === 'shares') return nf(v, 3) + ' mm';
    if (f.unit === 'x') return v.toFixed(2) + '×';
    return nf(v, 0) + (f.unit === 'usd_mm' ? ' $mm' : '');
  }

  // ---------- import approvals ----------
  let pendSel = null, pendConfirm = false;
  const PEND_KIND = { update: ['Newer data', 'This value came from an earlier import. The new figure is from a newer filing or quote.'], override: ['Replaces your value', 'You entered or changed this value. It is only replaced if you tick it and confirm.'], blocked: ['Not applied', 'The new figure failed a check, so it cannot be applied.'] };
  function pendingPanel() {
    const P = cur.pending, flags = cur.importFlags || [];
    if ((!P || !P.items.length) && !flags.length) return '';
    let html = '';
    if (P && P.items.length) {
      if (!pendSel) pendSel = Object.fromEntries(P.items.filter(p => p.kind === 'update').map(p => [p.id, true]));
      const anyOv = P.items.some(p => pendSel[p.id] && p.kind === 'override');
      const val = (p, which) => p.key === 'hist' ? esc(p[which] || '—') : fmtVal(p.key.split('.')[0] === 'company' ? '' : p.key, p[which]);
      html += `<section class="panel pend" id="pending"><div class="panel-head"><h2>Review imported changes</h2><span class="footnote">${esc(P.provider)}, ${new Date(P.at).toLocaleString()}. Nothing below has been applied yet. Your current values stay until you approve a change.</span></div>
        <div class="tbl-wrap"><table class="fin ptab"><thead><tr><th>Apply</th><th>Field</th><th>Current value</th><th>New value</th><th>Why it is waiting</th></tr></thead><tbody>
        ${P.items.map(p => `<tr class="pk-${p.kind}"><td>${p.kind === 'blocked' ? '—' : `<input type="checkbox" data-pend-id="${esc(p.id)}" ${pendSel[p.id] ? 'checked' : ''} aria-label="Apply ${esc(p.label)}">`}</td><td><b>${esc(p.label)}</b></td><td>${val(p, 'from')}${p.fromDate ? `<div class="footnote">${esc(p.fromDate)}</div>` : ''}</td><td>${val(p, 'to')}${p.toDate ? `<div class="footnote">${esc(p.toDate)}</div>` : ''}</td><td><span class="pkind">${PEND_KIND[p.kind][0]}</span> <span class="footnote">${esc(p.reason || PEND_KIND[p.kind][1])}</span></td></tr>`).join('')}
        </tbody></table></div>
        ${anyOv ? `<label class="check warnbox"><input type="checkbox" id="pend-confirm" ${pendConfirm ? 'checked' : ''}> I understand the ticked “Replaces your value” rows will overwrite figures I entered. The old values stay in the change log.</label>` : ''}
        <div class="btns"><button class="btn primary" data-pend-apply ${anyOv && !pendConfirm ? 'disabled' : ''}>Apply ticked changes</button><button class="btn" data-pend-dismiss>Keep my current values</button></div></section>`;
    }
    if (flags.length) html += `<section class="panel"><div class="panel-head"><h2>Import checks</h2><span class="footnote">Problems found in the imported data. Values with a red check were not applied.</span></div><ul class="flags">${flags.map(f => `<li class="${f.level}">${esc(f.text)}</li>`).join('')}</ul><div class="btns"><button class="btn" data-flags-dismiss>Hide these checks</button></div></section>`;
    return html;
  }

  // ---------- TTM ----------
  const TTM_ITEMS = [['rev', 'Revenue'], ['gp', 'Gross profit'], ['ebitda', 'EBITDA (calculated)'], ['ebit', 'Operating income (EBIT)'], ['da', 'D&A'], ['interest', 'Interest expense'], ['tax', 'Income taxes'], ['ni', 'Net income'], ['cfo', 'Operating cash flow'], ['capex', 'Capital expenditures'], ['sbc', 'Stock-based compensation'], ['fcf', 'Free cash flow (CFO − CapEx)']];
  function partsHtml(t) {
    if (!t || !t.parts || !t.parts.length) return '';
    const lab = ['Fiscal year', 'Current year to date', 'Prior year to date'], op = ['', '+', '−'];
    return `<table class="fin parts"><thead><tr><th></th><th>Part</th><th>$ millions</th><th>Period</th><th>Filing</th></tr></thead><tbody>${t.parts.map((p, i) => `<tr><td>${t.parts.length === 1 ? '' : op[i]}</td><td>${lab[i]}</td><td class="num">${nf(p.value, 0)}</td><td>${esc(p.periodText || (p.end ? 'ended ' + p.end : '—'))}</td><td>${p.accn ? `${esc(p.form)} <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.accn)}</a><div class="footnote">filed ${esc(p.filed)}</div>` : p.cat === 'manual' ? 'Entered by you' + (p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">source</a>` : '') : '—'}</td></tr>`).join('')}<tr class="total"><td>=</td><td>TTM</td><td class="num"><b>${nf(t.value, 0)}</b></td><td>${esc(t.periodText || '')}</td><td>Calculated</td></tr></tbody></table>`;
  }
  function ttmDrawerHtml(k) {
    const T = DCFModel.ttmOf(cur), t = T && T.items && T.items[k];
    const lab = (TTM_ITEMS.find(x => x[0] === k) || [k, HBY[k] ? HBY[k].label : k])[1];
    let body;
    if (!t) body = '<div class="notice">Not available for TTM. Either the company does not tag this line in a way that matches its fiscal-year figure, or no quarterly filing has it. It is left blank rather than estimated.</div>';
    else body = `<p>${esc(t.method || '')}</p>${partsHtml(t)}
      ${t.deps ? `<p class="footnote">Built from the TTM figures for ${t.deps.map(d => esc((TTM_ITEMS.find(x => x[0] === d) || [d, d])[1])).join(' and ')}, each calculated the same way.</p>` : ''}
      ${t.note ? `<p class="footnote">${esc(t.note)}</p>` : ''}
      <dl><div><dt>Units</dt><dd>$ millions. SEC data is in dollars and divided by 1,000,000.</dd></div><div><dt>Category</dt><dd>${catBadge('calc')} TTM is calculated, not a figure the company reports.</dd></div>${t.mismatch ? '<div><dt>Problem</dt><dd>This line ends on a different date from the others, so it was left out.</dd></div>' : ''}</dl>`;
    return `<div><h3>Trailing twelve months</h3><h2 id="dr-title">${esc(lab)}</h2></div>
      <div class="formula">TTM = latest fiscal year + current year to date − same period of the prior year</div>${body}
      <p class="footnote">Why: the fiscal year can be up to a year old. Adding the months since and removing the same months a year earlier gives the most recent twelve months without counting any month twice.</p>`;
  }
  function ttmCompareHtml() {
    const T = DCFModel.ttmOf(cur); if (!T || !T.items) return '';
    const fy = cur.fin && cur.fin.years && cur.fin.years[0];
    const H = cur.hist, li = 4;
    const fyv = k => {
      if (fy && fy.values && isNum(fy.values[k])) return fy.values[k];
      const h = { rev: H.rev[li], gp: H.gp[li], da: H.da[li], interest: H.interest[li], sbc: H.sbc[li], capex: isNum(H.capex[li]) ? -H.capex[li] : null, ebitda: isNum(H.gp[li]) && isNum(H.opex[li]) ? H.gp[li] - H.opex[li] : null }[k];
      return isNum(h) ? h : null;
    };
    const tv = k => T.items[k] && isNum(T.items[k].value) ? T.items[k].value : null;
    const fr = fyv('rev'), tr = tv('rev');
    const fl = fy ? fy.label : (H.years[li] ? 'FY' + H.years[li] : 'Latest FY');
    const rows = TTM_ITEMS.map(([k, l]) => { const a = fyv(k), b = tv(k); return `<tr><td>${esc(l)}</td><td class="num">${fmt.mm(a)}</td><td class="num ttm"><button class="ttmv" data-ttm="${k}">${isNum(b) ? fmt.mm(b) : '<span class="na">Not available</span>'}</button></td><td class="num">${isNum(a) && isNum(b) ? fmt.mm(b - a) : '<span class="na">—</span>'}</td><td class="num">${k === 'rev' ? '' : fmt.pct(isNum(a) && fr ? a / fr : null)}</td><td class="num ttm">${k === 'rev' ? '' : fmt.pct(isNum(b) && tr ? b / tr : null)}</td></tr>`; }).join('');
    return `<section class="panel"><div class="panel-head"><h2>TTM compared with the latest fiscal year</h2><span class="footnote">${esc(fl)}${fy && fy.end ? ' (ended ' + esc(fy.end) + ')' : ''} vs TTM to ${esc(T.end || '?')}. Click a TTM figure to see its three parts. Margins are % of revenue.</span></div>
      <div class="tbl-wrap"><table class="fin cmp"><thead><tr><th>$ millions</th><th>${esc(fl)}</th><th class="ttm">TTM</th><th>Change</th><th>${esc(fl)} margin</th><th class="ttm">TTM margin</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${T.isFY ? '<div class="notice">No 10-Q has been filed since the fiscal year ended, so TTM equals the fiscal year.</div>' : ''}</section>`;
  }
  function ttmBuilderHtml() {
    const M = cur.ttmManual || {}, R = M.rows || {};
    const keys = [['rev', 'Revenue'], ['cogs', 'Cost of revenue'], ['ebit', 'Operating income'], ['da', 'D&A'], ['interest', 'Interest expense'], ['ebt', 'Pre-tax income'], ['tax', 'Income taxes'], ['ni', 'Net income'], ['cfo', 'Operating cash flow'], ['capex', 'CapEx (positive)'], ['sbc', 'Stock-based compensation']];
    const inp = (path, unit, label) => { const id = 'tm-' + path.replace(/\./g, '-'); const v = path.split('.').reduce((o, k) => o == null ? o : o[k], M); return unit === 'date' ? `<input type="date" data-t="ttmm" data-k="${path}" data-unit="date" id="${id}" value="${esc(v || '')}" aria-label="${esc(label)}">` : unit === 'text' ? `<input type="text" class="txt" data-t="ttmm" data-k="${path}" data-unit="text" id="${id}" value="${esc(v || '')}" placeholder="https://" aria-label="${esc(label)}">` : `<input type="text" inputmode="decimal" data-t="ttmm" data-k="${path}" data-unit="num" id="${id}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, 'num'))}" placeholder="Enter" aria-label="${esc(label)}">${parseErrors[id] ? `<div class="errmsg">${esc(parseErrors[id])}</div>` : ''}`; };
    const res = DCFAnalysis.manualTTM(M), chk = DCFAnalysis.manualTTMChecks(M);
    return `<details class="panel" id="ttm-build" ${aidOpen['ttm-build'] || (!cur.ttm && Object.keys(R).length) ? 'open' : ''} data-aid="ttm-build"><summary><b>Build TTM by hand</b> <span class="footnote">for when no SEC file is loaded, or to check one: type three figures per line from the 10-K and the latest 10-Q</span></summary>
      <div class="tmgrid"><label>Fiscal year ended ${inp('fyEnd', 'date', 'Fiscal year end')}</label><label>Current period ended (latest 10-Q) ${inp('end', 'date', 'Current period end')}</label><label>Same period a year earlier ended ${inp('priorEnd', 'date', 'Prior period end')}</label>
        <label>Year to date covers <select data-t="ttmm" data-k="ytdLabel" data-unit="choice" id="tm-ytdLabel"><option value="">Choose…</option>${['three months', 'six months', 'nine months'].map(o => `<option ${M.ytdLabel === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label><label>10-K link ${inp('fyUrl', 'text', '10-K link')}</label><label>10-Q link ${inp('ytdUrl', 'text', '10-Q link')}</label></div>
      ${chk.map(c => `<div class="notice ${c.level}">${esc(c.text)}</div>`).join('')}
      <div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th><th>Fiscal year</th><th>+ Year to date</th><th>− Prior year to date</th><th class="ttm">= TTM</th></tr></thead><tbody>
      ${keys.map(([k, l]) => `<tr><td>${l}</td><td>${inp(`rows.${k}.fy`, 'num', l + ' fiscal year')}</td><td>${inp(`rows.${k}.ytd`, 'num', l + ' year to date')}</td><td>${inp(`rows.${k}.prior`, 'num', l + ' prior year to date')}</td><td class="num ttm">${res && res.items[k] ? fmt.mm(res.items[k].value) : '<span class="na">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <label class="check"><input type="checkbox" id="tm-use" ${M.use ? 'checked' : ''} ${res ? '' : 'disabled'}> Use my TTM${cur.ttm ? ' instead of the one calculated from the SEC filings' : ''}</label>
      <p class="footnote">Lines you leave blank stay blank: nothing is assumed to be zero. Interest, taxes and CapEx are typed as positive amounts.</p></details>`;
  }

  // ---------- forecast base ----------
  function basePanel(compact) {
    if (cur.mode === 'workbook') return `<section class="panel"><div class="panel-head"><h2>Forecast base</h2></div><p class="footnote">In original-workbook mode the base-year revenue is typed on this page and the forecast uses the workbook's timing. Switch to the corrected method to base the forecast on the latest fiscal year or TTM.</p></section>`;
    const b = DCFModel.baseInfo(cur), T = DCFModel.ttmOf(cur);
    const alt = JSON.parse(JSON.stringify(cur)); alt.base = Object.assign({}, alt.base, { mode: b.mode === 'ttm' ? 'fy' : 'ttm' }); const ab = DCFModel.baseInfo(alt);
    const run = m => { const { inp } = DCFModel.engineInputs(m); const r = DCF.run(inp, cur.active, m.mode); return r.ok ? r : null; };
    const r0 = run(cur), r1 = isNum(ab.rev) ? run(alt) : null;
    const card = (mode, info, r, inUse) => `<div class="bcard ${inUse ? 'on' : ''}"><div class="bh"><b>${mode === 'ttm' ? 'Trailing twelve months' : 'Latest fiscal year'}</b>${inUse ? '<span class="pill good">In use</span>' : ''}</div>
      <div class="bk"><span>Base revenue</span><b>${isNum(info.rev) ? fmt.mm(info.rev) + ' $mm' : '<span class="na">Not available</span>'}</b></div>
      <div class="bk"><span>Period</span><b>${esc(info.label || '—')}</b></div>
      <div class="bk"><span>Year 1</span><b>${info.periods ? esc(info.periods[0].start + ' to ' + info.periods[0].end) : '<span class="na">dates not set</span>'}</b></div>
      <div class="bk"><span>Year 1 revenue (${esc(cur.active)})</span><b>${r ? fmt.mm(r.years[0].rev) : '—'}</b></div>
      <div class="bk"><span>Value per share (${esc(cur.active)})</span><b>${r ? fmt.usd(r.perShare) : '—'}</b></div>
      ${!inUse && isNum(info.rev) ? `<button class="btn ${mode === 'ttm' ? 'primary' : ''}" data-base-set="${mode}">Switch to this base</button>` : !inUse ? `<p class="footnote">${mode === 'ttm' ? 'Load the SEC company facts file or build TTM by hand on Historical financials.' : 'Enter the latest fiscal year on Historical financials.'}</p>` : ''}</div>`;
    const fyInfo = b.mode === 'fy' ? b : ab, ttmInfo = b.mode === 'ttm' ? b : ab;
    const rf = b.mode === 'fy' ? r0 : r1, rt = b.mode === 'ttm' ? r0 : r1;
    return `<section class="panel" id="base-panel"><div class="panel-head"><h2>Forecast base</h2><span class="footnote">The revenue the forecast grows from, and when year 1 starts. Switching shows its effect first and changes nothing until you click.</span></div>
      <div class="bcards">${card('fy', fyInfo, rf, b.mode === 'fy')}${card('ttm', ttmInfo, rt, b.mode === 'ttm')}</div>
      <div class="brow"><label>Timing <select id="base-timing"><option value="dated" ${cur.timing === 'dated' ? 'selected' : ''}>Line up with the valuation date</option><option value="workbook" ${cur.timing !== 'dated' ? 'selected' : ''}>Workbook timing (year 1 starts on the valuation date)</option></select></label>
        <span class="footnote">${cur.timing === 'dated' ? (isNum(b.stub) ? `The base period ended ${(b.stub * 12).toFixed(1)} months before the valuation date (${esc(cur.inputs.company.valDate || '')}). Each cash flow is discounted ${b.stub.toFixed(3)} years less, because that part of year 1 has already passed.` : 'Needs the base period end date and a valuation date.') : 'Each forecast year is discounted as if it starts on the valuation date, as in the original workbook.'}</span></div>
      ${b.warnings.map(w => `<div class="notice ${w.level === 'bad' ? 'bad' : ''}">${esc(w.text)}</div>`).join('')}
      ${!compact && b.periods ? `<details><summary class="footnote">Forecast periods</summary><div class="periods">${b.periods.map((p, i) => `<span><b>Year ${i + 1}</b> ${esc(p.start)} to ${esc(p.end)}</span>`).join('')}</div></details>` : ''}
    </section>`;
  }

  // ---------- final share and value display ----------
  function shareSummary() {
    const d = DCFModel.dilution(cur), I = cur.inputs, { act } = calc();
    const n = (v, dd = 2) => isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: dd, minimumFractionDigits: dd }) : '<span class="na">Not available</span>';
    const mcap = isNum(I.price) && isNum(I.basic) ? I.price * I.basic : null;
    return `<section class="panel" id="share-summary"><div class="panel-head"><h2>Shares and value per share</h2><span class="footnote">${esc(cur.active)} scenario. Market cap uses actual shares, as quote sites do; value per share uses diluted shares.</span></div>
      <div class="ssum">
        <div><span>Actual (basic) shares</span><b>${n(I.basic, 3)}</b><small>${cur.asOf && cur.asOf.basic ? 'as of ' + esc(cur.asOf.basic) : 'date not set'} · ${catBadge(catOf('basic', I.basic))}</small></div>
        <div><span>Incremental shares</span><b>${d.ok ? n(d.net, 3) : '<span class="na">Not available</span>'}</b><small>${d.method === 'proxy' ? catBadge('proxy') + ' reported net dilution' : d.method === 'advanced' ? 'treasury stock method' : d.method === 'simple' ? (d.net ? 'your estimate' : 'none') : d.method === 'totals' ? 'workbook totals' : 'method not chosen'}</small></div>
        <div><span>Diluted shares</span><b>${d.ok ? n(d.diluted, 3) : '<span class="na">Not available</span>'}</b><small>${d.ok ? catBadge('calc') + ' ' : ''}an estimate, not an SEC-reported count</small></div>
        <div><span>Market cap on actual shares</span><b>${isNum(mcap) ? fmt.mm(mcap) + ' $mm' : '<span class="na">Not available</span>'}</b><small>price × actual shares</small></div>
        <div><span>DCF equity value</span><b>${act && act.ok ? fmt.mm(act.equity) + ' $mm' : '<span class="na">Not available</span>'}</b><small>enterprise value + bridge</small></div>
        <div class="tot"><span>Value per diluted share</span><b>${act && act.ok ? fmt.usd(act.perShare) : '<span class="na">Not available</span>'}</b><small>equity value ÷ diluted shares</small></div>
      </div></section>`;
  }

  // ---------- help drawer sections ----------
  function whereHtml(w, cik) {
    if (!w) return '';
    const row = (l, v) => v ? `<div><span>${l}</span><p>${esc(v)}</p></div>` : '';
    return `<div class="where">${row('Document', w.doc)}${row('Statement or note', w.statement)}${row('Heading to look for', w.heading)}${row('Period', w.period)}${w.find && w.find.length ? `<div><span>Search (Ctrl+F)</span><p>${w.find.map(t => `<a class="chip" href="${DCFHelp.edgarSearch(t, cik)}" target="_blank" rel="noopener" title="Search “${esc(t)}” in ${cik ? 'this company\'s' : 'all'} filings on EDGAR">${esc(t)}</a>`).join(' ')}</p></div>` : ''}</div>`;
  }
  function exampleHtml(key) {
    const e = DCFHelp.example(key, cur); let out = '';
    if (e.company) out += `<div class="ex ex-co"><b>This company's filing</b>${esc(e.company.text)}${e.company.url ? ` <a href="${esc(e.company.url)}" target="_blank" rel="noopener">Open the filing</a>` : ''}</div>`;
    if (e.verified) out += e.verified.kind === 'none' ? `<div class="ex"><b>Example</b>${esc(e.verified.text)}</div>` : `<div class="ex"><b>Real example</b>${esc(e.verified.text)}<span class="footnote">Source: ${esc(e.verified.cite)}${e.verified.url ? ` · <a href="${esc(e.verified.url)}" target="_blank" rel="noopener">Open the filing</a>` : ''}</span></div>`;
    return out;
  }
  function sourceVerifHtml(key, value) {
    const s = cur.sources[key];
    const c = catOf(key, value);
    if (!s) return `<div class="srcv"><div class="sv-head">${catBadge(c)}</div><p class="footnote">${c === 'missing' ? 'Not available. Enter it, or leave it blank: a blank is never treated as zero.' : 'No source recorded yet. Note where it came from below.'}</p></div>`;
    const R = [['Company', s.company], ['Ticker', s.ticker], ['Metric', s.metric], ['Raw value', isNum(s.raw) ? s.raw.toLocaleString('en-US') + (s.rawUnit ? ' ' + s.rawUnit : '') : null], ['Converted value', isNum(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 6 }) + (s.unit ? ' ' + s.unit : '') : null], ['Scale', s.scale ? (s.scale === 1e6 ? 'divided by 1,000,000' : String(s.scale)) : null], ['Provider', s.provider || s.name], ['Document', s.type], ['Form', s.form], ['Accession number', s.accn], ['Fiscal period', s.fy ? s.fy + ' ' + (s.fp || '') : null], ['Reporting period', s.start ? s.start + ' to ' + s.end : s.period], ['Measured as of', s.asOf || s.end], ['Filed', s.filed], ['Retrieved', s.retrieved ? new Date(s.retrieved).toLocaleString() : null], ['XBRL tag', s.concept], ['Method', s.method], ['Import status', { imported: 'As imported', overridden: 'Changed by you after import', manual: 'Entered by you' }[provOf(key, value)] || null]].filter(([, v]) => v != null && v !== '');
    return `<div class="srcv"><div class="sv-head">${catBadge(c)}${s.verified && c !== 'override' ? '<span class="footnote">Read from the SEC filing</span>' : c === 'provider' ? '<span class="footnote">Not checked against the SEC filing</span>' : ''}${s.stale ? '<span class="cat c-miss">Older filing</span>' : ''}</div>
      <dl class="svl">${R.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${s.notes ? `<p class="footnote">${esc(s.notes)}</p>` : ''}${s.url ? `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">Open the filing to verify</a>` : ''}</div>`;
  }
  // anchors table for a forecast input
  function anchorHtml(key, withUse) {
    const A = calc().anchors[key]; if (!A) return '';
    const f = A.unit === 'x' ? v => isNum(v) ? v.toFixed(2) + '×' : '<span class="na">Not available</span>' : v => isNum(v) ? (v * 100).toFixed(1) + '%' : '<span class="na">Not available</span>';
    const use = (v, l) => withUse && isNum(v) ? `<button class="btn tiny" data-suggest="${key}" data-v="${v}" data-l="${esc(l)}" title="Fills only the empty scenario cells. Values you entered are never replaced.">Use for empty cells</button>` : '';
    const rows = [['Latest fiscal year' + (A.latestLabel ? ' (' + A.latestLabel + ')' : ''), A.latestFY], ['TTM' + (A.ttmLabel ? ' (' + A.ttmLabel + ')' : ''), A.ttm], ['3-year average', A.avg3], ['5-year average', A.avg5], ['High', A.hi], ['Low', A.lo]];
    if (key.startsWith('g')) rows.push(['Latest quarter vs a year earlier' + (A.quarterEnd ? ' (' + A.quarterEnd + ')' : ''), A.quarterYoY], ['3-year CAGR', A.cagr3], ['4-year CAGR (all five fiscal years)', A.cagr4], ['5-year CAGR', A.cagr5], ['Acceleration (latest FY growth − prior FY growth)', A.accel], ['TTM growth − latest FY growth', A.ttmVsFY]);
    if (key === 's2c') rows.push(['Cumulative (first to last fiscal year)', A.cumulative]);
    const series = A.vals.some(isNum) ? `<div class="aser">${A.years.map((y, i) => `<span><small>${esc(y || '—')}</small>${f(A.vals[i])}</span>`).join('')}${isNum(A.ttm) ? `<span class="ttm"><small>TTM</small>${f(A.ttm)}</span>` : ''}</div>` : '<p class="footnote">No history loaded yet. Import the company or fill in Historical financials.</p>';
    return `${series}<table class="fin anch"><tbody>${rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num">${f(v)}</td><td>${use(v, l)}</td></tr>`).join('')}<tr><td>Trend (last three years)</td><td class="num">${A.trend || '<span class="na">Not enough years</span>'}</td><td></td></tr></tbody></table>${A.note ? `<p class="footnote">${esc(A.note)}</p>` : ''}`;
  }
  // a worked example from this company's own figures, or a verified Amazon one
  function exampleCalcHtml(key) {
    const H = cur.hist, co = cur.inputs.company.name || 'This company', T = DCFModel.ttmOf(cur), fy = cur.fin && cur.fin.years;
    const y = H.years, r = H.rev, n = v => nf(v, 0), p = v => isNum(v) ? (v * 100).toFixed(1) + '%' : '—';
    const has = (...xs) => xs.every(isNum);
    let own = null, amzn = null;
    if (/^g\d/.test(key)) { if (has(r[4], r[3])) own = `${co} FY${y[4]} growth = ${n(r[4])} ÷ ${n(r[3])} − 1 = ${p(r[4] / r[3] - 1)}.${T && T.prior && isNum(T.prior.value) && T.items.rev ? ` TTM growth = ${n(T.items.rev.value)} ÷ ${n(T.prior.value)} − 1 = ${p(T.items.rev.value / T.prior.value - 1)}.` : ''}`; amzn = 'Amazon FY2025 growth = 716,924 ÷ 637,959 − 1 = 12.4%. Applying 12% to the FY2025 base: 716,924 × 1.12 = 802,954.88 $mm of revenue in year 1 (a hypothetical rate, not a forecast). Source: Amazon 10-K for 2025, accession 0001018724-26-000004.'; }
    if (/^gm/.test(key)) { if (has(H.gp[4], r[4])) own = `${co} FY${y[4]} gross margin = ${n(H.gp[4])} ÷ ${n(r[4])} = ${p(H.gp[4] / r[4])}.`; amzn = 'Amazon 2025: (716,924 − 356,414 cost of sales) ÷ 716,924 = 50.3% (calculated; Amazon does not report gross profit). Source: 10-K for 2025.'; }
    if (/^em|^tem/.test(key)) { if (has(H.gp[4], H.opex[4], r[4])) own = `${co} FY${y[4]} EBITDA margin = (${n(H.gp[4])} − ${n(H.opex[4])}) ÷ ${n(r[4])} = ${p((H.gp[4] - H.opex[4]) / r[4])}.`; amzn = 'Amazon 2025: (operating income 79,975 + D&A 65,756) ÷ 716,924 = 20.3%. TTM to 30 Sep 2026: (104,366 + 79,353) ÷ 797,455 = 23.0%. Sources: 10-K for 2025; 10-K plus Q3 2026 10-Q for TTM.'; }
    if (key === 'da') { if (has(H.da[4], r[4])) own = `${co} FY${y[4]} D&A = ${n(H.da[4])} ÷ ${n(r[4])} = ${p(H.da[4] / r[4])} of revenue.`; amzn = 'Amazon 2025: 65,756 ÷ 716,924 = 9.2%. TTM: 79,353 ÷ 797,455 = 10.0%, rising because CapEx has grown faster than revenue.'; }
    if (/^capex/.test(key)) { if (has(H.capex[4], r[4])) own = `${co} FY${y[4]} CapEx = ${n(-H.capex[4])} ÷ ${n(r[4])} = ${p(-H.capex[4] / r[4])} of revenue.`; amzn = 'Amazon 2025: 131,819 ÷ 716,924 = 18.4%. TTM to 30 Sep 2026: 215,192 ÷ 797,455 = 27.0%. Purchases of property and equipment, net of proceeds and incentives; excludes assets acquired under finance leases.'; }
    if (key === 'tax') { const v = fy && fy[0] && fy[0].values; if (v && has(v.tax, v.ebt)) own = `${co} ${fy[0].label} effective rate = ${n(v.tax)} ÷ ${n(v.ebt)} = ${p(v.tax / v.ebt)}.`; amzn = 'Amazon 2025: income tax expense 19,087 ÷ pre-tax income 97,311 = 19.6% effective, against a 21% US federal statutory rate.'; }
    if (key === 'nwc') { if (has(H.dnwc[4], r[4], r[3]) && r[4] !== r[3]) own = `${co} FY${y[4]}: −(${n(H.dnwc[4])}) ÷ (${n(r[4])} − ${n(r[3])}) = ${p(-H.dnwc[4] / (r[4] - r[3]))}.`; amzn = 'Amazon reports each working-capital change separately (no single tagged total), so no verified ratio is shown. Add the "Changes in operating assets and liabilities" lines, then divide by the change in revenue.'; }
    if (key === 's2c') { const A = calc().anchors.s2c; if (isNum(A.latestFY)) own = `${co} ${A.latestLabel}: change in revenue ÷ (CapEx − D&A + increase in NWC) = ${A.latestFY.toFixed(2)}×.`; amzn = 'Amazon 2025: (716,924 − 637,959) ÷ (131,819 − 65,756) = 1.20×, leaving out working capital and acquisitions.'; }
    if (key === 'nol') amzn = 'Hypothetical: $1,000 mm of usable NOLs, $5,000 mm of total EBIT in years 1–3 and a 21% tax rate: 1,000 × 21% ÷ 5,000 = 4.2 points off the tax rate in years 1–3.';
    if (key === 'acq') amzn = 'No verified example on file. Read "Acquisitions, net of cash acquired" for each year in the cash flow statement and divide by revenue.';
    return `${own ? `<div class="ex ex-co"><b>From this company's figures</b>${esc(own)}</div>` : ''}${amzn ? `<div class="ex"><b>${/Hypothetical/.test(amzn) ? 'Hypothetical example' : /No verified|no verified/.test(amzn) ? 'Example' : 'Real example (Amazon)'}</b>${esc(amzn)}</div>` : ''}`;
  }
  function effectHtml(key) {
    const g = DCFHelp.G[key]; if (!g || !g.effect) return key.startsWith('gm') ? '<p>None directly: gross margin is shown for reference and to check the EBITDA path. The valuation uses EBITDA margin.</p>' : '';
    const e = DCFAnalysis.effect(cur, g.effect.keys, cur.active, g.effect.delta);
    if (!e) return '<p class="footnote">Complete the required inputs to see the effect on value.</p>';
    return `<p><b>${esc(g.effect.label)}</b> (${esc(cur.active)}): value per share ${fmt.usd(e.from)} → ${fmt.usd(e.to)}, ${e.diff >= 0 ? '+' : ''}${plain(fmt.usd(e.diff))} (${(e.pct * 100).toFixed(1)}%). Re-run with the change; nothing is saved.</p>${key === 's2c' ? '<p class="footnote">Zero by design: sales-to-capital only sets invested capital for the ROIC check in this model.</p>' : ''}`;
  }
  function forecastDrawerHtml(key, f) {
    const g = DCFHelp.G[key] || {};
    const scen = SC.map(s => `<li><b>${s}</b> ${esc(g[s.toLowerCase()] || '')} <span class="footnote">Your value: ${fmtVal(key, cur.inputs[key][s])}</span></li>`).join('');
    const links = (DCFHelp.SRC_FORECAST[key] || []).map(([l, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(l)}</a></li>`).join('');
    const sec = (t, body, open) => body ? `<details class="dsec2" ${open ? 'open' : ''}><summary>${t}</summary><div>${body}</div></details>` : '';
    return [
      sec('What it is', `<p>${esc(f.what)}</p><p class="footnote">${esc(f.enter)}</p>`, true),
      sec('Why it matters', g.why ? `<p>${esc(g.why)}</p>` : ''),
      sec('How to estimate it', g.estimate ? `<ol>${g.estimate.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${g.interp ? '<p class="footnote">The model draws a straight line from year 1 to year 5 and another from year 5 to year 10. Year 3 is halfway between years 1 and 5.</p>' : ''}` : ''),
      sec('Where to find the evidence', g.where ? `<p>${esc(g.where)}</p>` : ''),
      sec('Historical comparison', anchorHtml(key, true), true),
      sec('Example calculation', exampleCalcHtml(key)),
      sec('Bear, Base and Bull', `<ul>${scen}</ul><p class="footnote">Each scenario should tell one consistent story. The calculator does not create scenarios by adding or subtracting a fixed percentage.</p>`),
      sec('Common mistakes', g.mistakes && g.mistakes.length ? `<ul>${g.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''),
      sec('Effect on valuation', effectHtml(key)),
      sec('Sources', links ? `<ul>${links}</ul>` : '<p class="footnote">Your own research notes and evidence links are kept under each assumption.</p>'),
    ].join('');
  }

  // ---------- research notes ----------
  const NOTE_FIELDS = [['assumption', 'My assumption', 'text'], ['why', 'Why I chose it', 'area'], ['calc', 'Supporting calculations', 'area'], ['evidence', 'Evidence (one link per line)', 'area'], ['risks', 'Risks to this assumption', 'area'], ['confidence', 'Confidence', 'conf'], ['reviewed', 'Last reviewed', 'date']];
  let noteSaved = {};
  function notesHtml(key) {
    const N = (cur.notes && cur.notes[key]) || {};
    return `<div class="notes">${SC.map(s => { const n = N[s] || {}; const id = f => `nt-${key}-${s}-${f}`;
      const ctl = ([f, l, t]) => t === 'area' ? `<label>${l}<textarea rows="2" data-t="note" data-k="${key}" data-s="${s}" data-f="${f}" id="${id(f)}">${esc(n[f] || '')}</textarea></label>` : t === 'conf' ? `<label>${l}<select data-t="note" data-k="${key}" data-s="${s}" data-f="${f}" id="${id(f)}"><option value="">Not set</option>${['Low', 'Medium', 'High'].map(o => `<option ${n[f] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>` : `<label>${l}<input type="${t === 'date' ? 'date' : 'text'}" class="txt" data-t="note" data-k="${key}" data-s="${s}" data-f="${f}" id="${id(f)}" value="${esc(n[f] || '')}"></label>`;
      const ev = String(n.evidence || '').split(/\n+/).map(x => x.trim()).filter(x => /^https?:\/\//i.test(x));
      return `<fieldset><legend>${s}${n.saved ? ` <span class="saved" title="Saved ${esc(new Date(n.saved).toLocaleString())}">✓ saved</span>` : ''}</legend>${NOTE_FIELDS.map(ctl).join('')}${ev.length ? `<div class="evl">${ev.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, '').slice(0, 48))}</a>`).join('')}</div>` : ''}</fieldset>`; }).join('')}</div>`;
  }
  const hasNotes = key => cur.notes && cur.notes[key] && SC.some(s => cur.notes[key][s] && Object.entries(cur.notes[key][s]).some(([k, v]) => k !== 'saved' && v));
  // inline guide under each forecast input
  let aidOpen = {};
  function aidRow(f) {
    if (cur.ui && cur.ui.learn === false) return '';
    const g = DCFHelp.G[f.key] || {};
    const links = (DCFHelp.SRC_FORECAST[f.key] || []).map(([l, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(l)}</a></li>`).join('');
    const sub = (id, t, body) => `<details class="asub" data-aid="${f.key}:${id}" ${aidOpen[f.key + ':' + id] ? 'open' : ''}><summary>${t}</summary><div>${body}</div></details>`;
    return `<div class="aidrow"><details class="aid" data-aid="${f.key}" ${aidOpen[f.key] ? 'open' : ''}><summary>Guide, history and notes${hasNotes(f.key) ? ' <span class="saved">notes saved</span>' : ''}</summary>
      ${sub('calc', 'How to calculate', `${g.estimate ? `<ol>${g.estimate.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${exampleCalcHtml(f.key)}`)}
      ${sub('hist', 'Historical evidence', anchorHtml(f.key, true))}
      ${sub('notes', 'My research notes' + (hasNotes(f.key) ? ' ✓' : ''), notesHtml(f.key))}
      ${sub('scen', 'Scenario reasoning', `<ul>${SC.map(s => `<li><b>${s}</b> ${esc(g[s.toLowerCase()] || 'Write what has to be true for this case in your notes.')}</li>`).join('')}</ul>`)}
      ${sub('src', 'Sources', links ? `<ul>${links}</ul>` : '<p class="footnote">Add evidence links in your notes.</p>')}
    </details></div>`;
  }

  // ---------- forecast tools ----------
  function toolState() { cur.tools = cur.tools || {}; const t = cur.tools; t.rev = t.rev || { g: [null, null, null], seg: [{}, {}, {}, {}] }; t.nol = t.nol || { status: '', bal: null }; t.capex = t.capex || { guide: null }; return t; }
  const toolIn = (path, unit, label, ph = 'Enter') => { const id = 'tl-' + path.replace(/\./g, '-'); const v = path.split('.').reduce((o, k) => o == null ? o : o[k], toolState()); return unit === 'text' ? `<input type="text" class="txt" data-t="tool" data-k="${path}" data-unit="text" id="${id}" value="${esc(v || '')}" placeholder="${ph}" aria-label="${esc(label)}">` : `<div class="inwrap"><input type="text" inputmode="decimal" data-t="tool" data-k="${path}" data-unit="${unit}" id="${id}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, unit))}" placeholder="${ph}" aria-label="${esc(label)}"><span class="unit">${unit === 'pct' ? '%' : unit === 'usd_mm' ? '$mm' : ''}</span></div>`; };
  function toolsHtml() {
    const T = toolState(), b = DCFModel.baseInfo(cur), { all, inp } = calc(), s = cur.active;
    const rev0 = isNum(b.rev) ? b.rev : inp.rev0;
    // revenue growth estimator
    const segs = T.rev.seg.filter(x => isNum(x.rev) && isNum(x.g));
    const blend = segs.length ? segs.reduce((a, x) => a + x.rev * x.g, 0) / segs.reduce((a, x) => a + x.rev, 0) : null;
    const rates = [0, 1, 2].map(i => isNum(T.rev.g[i]) ? T.rev.g[i] : (i === 0 && isNum(blend) ? blend : cur.inputs[['g1', 'g2', 'g3'][i]][s]));
    const path = DCFAnalysis.revenuePath(rev0, rates);
    const revTool = `<details class="panel tool" id="tool-rev" ${aidOpen['tool-rev'] ? 'open' : ''} data-aid="tool-rev"><summary><b>Estimate revenue growth</b> <span class="footnote">try rates and see revenue in dollars</span></summary>
      <div class="notice">Hypothetical projection from the rates below. It does not change your inputs until you click a “Use” button.</div>
      <div class="tgrid"><label>Years 1–3 ${toolIn('rev.g.0', 'pct', 'Tool growth years 1–3', plain(fmt.pct(cur.inputs.g1[s])))}</label><label>Years 4–7 ${toolIn('rev.g.1', 'pct', 'Tool growth years 4–7', plain(fmt.pct(cur.inputs.g2[s])))}</label><label>Years 8–10 ${toolIn('rev.g.2', 'pct', 'Tool growth years 8–10', plain(fmt.pct(cur.inputs.g3[s])))}</label></div>
      <p class="footnote">Blank rates use your ${esc(s)} inputs. Base revenue ${fmt.mm(rev0)} $mm (${esc(b.label || 'base year')}).</p>
      <h3 class="sub-h">Segments (optional)</h3><p class="footnote">Grow each reported segment separately (10-K segment note; for Amazon: North America, International, AWS). Type the segment revenue from the filing and your growth rate; the blend is revenue-weighted.</p>
      <table class="fin seg"><thead><tr><th>Segment</th><th>Revenue ($mm)</th><th>Growth</th><th>Share</th></tr></thead><tbody>${T.rev.seg.map((x, i) => `<tr><td>${toolIn(`rev.seg.${i}.name`, 'text', 'Segment name', 'Segment ' + (i + 1))}</td><td>${toolIn(`rev.seg.${i}.rev`, 'usd_mm', 'Segment revenue')}</td><td>${toolIn(`rev.seg.${i}.g`, 'pct', 'Segment growth')}</td><td class="num">${segs.length && isNum(x.rev) ? fmt.pct(x.rev / segs.reduce((a, y) => a + y.rev, 0)) : ''}</td></tr>`).join('')}</tbody></table>
      ${isNum(blend) ? `<p>Blended growth: <b>${plain(fmt.pct(blend, 2))}</b> ${segs.length && isNum(rev0) && Math.abs(segs.reduce((a, y) => a + y.rev, 0) / rev0 - 1) > 0.02 ? `<span class="footnote">Segments add up to ${fmt.mm(segs.reduce((a, y) => a + y.rev, 0))}, not the base revenue ${fmt.mm(rev0)}: check the period.</span>` : ''}</p>` : ''}
      ${path.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Year</th>${path.map(p => `<th>${p.t}</th>`).join('')}</tr></thead><tbody><tr><td>Growth</td>${path.map(p => `<td class="num">${fmt.pct(p.g)}</td>`).join('')}</tr><tr><td>Revenue $mm</td>${path.map(p => `<td class="num">${fmt.mm(p.rev)}</td>`).join('')}</tr><tr class="sub"><td>Added</td>${path.map(p => `<td class="num">${fmt.mm(p.add)}</td>`).join('')}</tr></tbody></table></div><p class="footnote">Year 1 = ${fmt.mm(rev0)} × (1 + ${plain(fmt.pct(rates[0], 2))}) = ${nf(path[0].rev, 2)}. Year 10 revenue is ${isNum(rev0) ? (path[path.length - 1].rev / rev0).toFixed(2) + '×' : '—'} today's.</p>` : '<p class="footnote">Needs base revenue and growth rates.</p>'}
      <div class="btns">${[0, 1, 2].map(i => isNum(T.rev.g[i]) || (i === 0 && isNum(blend)) ? `<button class="btn" data-tool-use="${['g1', 'g2', 'g3'][i]}" data-v="${rates[i]}">Use ${plain(fmt.pct(rates[i], 2))} for ${esc(s)} ${['years 1–3', 'years 4–7', 'years 8–10'][i]}</button>` : '').join('')}</div></details>`;
    // margin path
    const mrow = (label, arr, cls = '') => `<tr class="${cls}"><td>${label}</td>${arr.map(v => `<td class="num">${fmt.pct(v)}</td>`).join('')}</tr>`;
    const marg = `<details class="panel tool" data-aid="tool-mg" ${aidOpen['tool-mg'] ? 'open' : ''}><summary><b>Margin path</b> <span class="footnote">how years 1, 5 and 10 become ten yearly margins</span></summary>
      <div class="tbl-wrap"><table class="fin"><thead><tr><th>Scenario</th>${Array.from({ length: 10 }, (_, i) => `<th>Y${i + 1}</th>`).join('')}</tr></thead><tbody>${SC.map(x => { const em = DCFAnalysis.marginPath(cur.inputs.em1[x], cur.inputs.em5[x], cur.inputs.em10[x]); const gm = DCFAnalysis.marginPath(cur.inputs.gm1[x], cur.inputs.gm5[x], cur.inputs.gm10[x]); return mrow(x + ' EBITDA', em, 'total') + (gm.some(isNum) ? mrow(x + ' gross', gm, 'sub') : '') + (em.some((v, i) => isNum(v) && isNum(gm[i]) && v > gm[i]) ? `<tr><td colspan="11"><span class="pill bad">EBITDA above gross margin in some years</span></td></tr>` : ''); }).join('')}</tbody></table></div>
      <p class="footnote">Years 2–4 step evenly from year 1 to year 5; years 6–9 step evenly from year 5 to year 10. Example: 20% in year 1 and 25% in year 5 gives 21.25%, 22.5% and 23.75% in years 2–4.</p>
      ${(() => { const e = DCFAnalysis.effect(cur, ['em1', 'em5', 'em10'], s, 0.01); return e ? `<p>One extra point of EBITDA margin in every year moves the ${esc(s)} value per share by <b>${plain(fmt.usd(e.diff))}</b> (${(e.pct * 100).toFixed(1)}%).</p>` : ''; })()}
      <p class="footnote">Reported vs adjusted vs calculated EBITDA: this model uses calculated EBITDA (operating income + D&A), with stock-based compensation still counted as a cost. Company "adjusted EBITDA" usually adds SBC and one-offs back and is higher.</p></details>`;
    // NOL worksheet
    const r = all.scen[s], ebit3 = r && r.ok ? r.years.slice(0, 3).reduce((a, y) => a + y.ebit, 0) : null;
    const nb = DCFAnalysis.nolBenefit(T.nol.bal, ebit3, cur.inputs.tax[s]);
    const nol = `<details class="panel tool" data-aid="tool-nol" ${aidOpen['tool-nol'] ? 'open' : ''}><summary><b>NOL worksheet</b> <span class="footnote">${{ none: 'checked: no usable NOLs', has: 'NOLs found', '': 'not reviewed yet' }[T.nol.status || '']}</span></summary>
      <label>Status <select data-t="tool" data-k="nol.status" data-unit="choice" id="tl-nol-status"><option value="" ${!T.nol.status ? 'selected' : ''}>Not reviewed yet (no benefit assumed)</option><option value="none" ${T.nol.status === 'none' ? 'selected' : ''}>Checked the tax note: no usable NOLs</option><option value="has" ${T.nol.status === 'has' ? 'selected' : ''}>The tax note shows usable NOLs</option></select></label>
      ${T.nol.status === 'has' ? `<label>Usable NOL carryforwards ($mm, after any valuation allowance) ${toolIn('nol.bal', 'usd_mm', 'NOL balance')}</label>
      <p>EBIT in years 1–3 (${esc(s)}): ${fmt.mm(ebit3)} $mm. ${nb ? `Rate cut = ${fmt.mm(nb.used)} × ${plain(fmt.pct(cur.inputs.tax[s]))} ÷ ${fmt.mm(ebit3)} = <b>${plain(fmt.pct(nb.rateCut, 2))}</b>${nb.leftover > 0 ? `. ${fmt.mm(nb.leftover)} $mm would be left for later years, which this model does not use.` : '.'}` : 'Enter the balance to calculate.'}</p>
      ${nb ? `<button class="btn" data-tool-use="nol" data-v="${nb.rateCut}">Use ${plain(fmt.pct(nb.rateCut, 2))} for ${esc(s)}</button>` : ''}` : '<p class="footnote">With no review, the NOL input should stay at 0: that means "no benefit assumed", not "the company has none". Record what you found here.</p>'}
      <p class="footnote">Where: 10-K income taxes note, "net operating loss carryforwards" and "valuation allowance". Ctrl+F: <a class="chip" href="${DCFHelp.edgarSearch('net operating loss carryforwards', cur.meta && cur.meta.cik)}" target="_blank" rel="noopener">net operating loss carryforwards</a></p></details>`;
    // CapEx estimator
    const cxg = T.capex.guide, cxp = isNum(cxg) && isNum(rev0) && rev0 ? cxg / rev0 : null, A = calc().anchors;
    const capex = `<details class="panel tool" data-aid="tool-cx" ${aidOpen['tool-cx'] ? 'open' : ''}><summary><b>CapEx estimator</b> <span class="footnote">turn a dollar outlook into a % of revenue</span></summary>
      <label>CapEx outlook for the next year ($mm, from guidance or your estimate) ${toolIn('capex.guide', 'usd_mm', 'CapEx outlook')}</label>
      <p>${isNum(cxp) ? `${fmt.mm(cxg)} ÷ ${fmt.mm(rev0)} base revenue = <b>${plain(fmt.pct(cxp))}</b> of revenue. Against year-1 revenue instead: ${r && r.ok ? plain(fmt.pct(cxg / r.years[0].rev)) : '—'}.` : 'Enter an amount.'}</p>
      <p class="footnote">History: latest FY ${plain(fmt.pct(A.capex1.latestFY))}, TTM ${plain(fmt.pct(A.capex1.ttm))}; D&A latest FY ${plain(fmt.pct(A.da.latestFY))}. CapEx above D&A means the asset base is growing.</p>
      ${isNum(cxp) ? `<button class="btn" data-tool-use="capex1" data-v="${cxp}">Use ${plain(fmt.pct(cxp))} for ${esc(s)} years 1–3</button>` : ''}
      <p class="footnote">Definition: cash purchases of property and equipment. Finance leases are excluded: if the company acquires many assets under finance leases, add them yourself or note it.</p></details>`;
    // sales-to-capital
    const s2c = `<details class="panel tool" data-aid="tool-s2c" ${aidOpen['tool-s2c'] ? 'open' : ''}><summary><b>Sales-to-capital, explained</b> <span class="footnote">what it does and does not do in this model</span></summary>
      <p>Sales-to-capital is revenue per dollar of invested capital. A ratio of 1.5× means every $1.50 of extra revenue needs $1 of net investment.</p>
      <p><b>Its role here:</b> it sets year-1 invested capital (revenue ÷ ratio), from which the model tracks invested capital and ROIC. It does <b>not</b> change free cash flow or value per share. Reinvestment is already in CapEx, D&A, working capital and acquisitions, so nothing is counted twice.</p>
      <p><b>Use it as a check:</b> marginal sales-to-capital = change in revenue ÷ net reinvestment. If your growth needs far more or far less reinvestment than the company's history shows, revisit growth or CapEx.</p>
      ${anchorHtml('s2c', false)}
      <table class="fin"><thead><tr><th></th>${SC.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody><tr><td>Your ratio</td>${SC.map(x => `<td class="num">${fmt.x(cur.inputs.s2c[x])}</td>`).join('')}</tr><tr><td>Year-1 ROIC</td>${SC.map(x => `<td class="num">${all.scen[x].ok ? fmt.pct(all.scen[x].years[0].roic) : '—'}</td>`).join('')}</tr><tr><td>Implied ratio from your inputs, years 1–5</td>${SC.map(x => { const R = all.scen[x]; if (!R.ok) return '<td>—</td>'; const re = R.years.slice(1, 5).reduce((a, y) => a + y.capex + y.dnwc + y.acq - y.da, 0); return `<td class="num">${re > 0 ? fmt.x((R.years[4].rev - R.years[0].rev) / re) : '<span class="na">no net reinvestment</span>'}</td>`; }).join('')}</tr></tbody></table></details>`;
    return `<h2 class="sec-h">Estimators</h2>${revTool}${marg}${nol}${capex}${s2c}`;
  }
  function checksPanelHtml() {
    const { all } = calc(); const list = DCFAnalysis.consistency(cur, all);
    return `<section class="panel" id="consistency"><div class="panel-head"><h2>Consistency checks</h2><span class="footnote">Warnings only. Nothing is changed for you.</span></div>
      ${list.length ? `<ul class="flags">${list.map(c => `<li class="${c.level}">${c.key && FBY[c.key] ? `<button class="linkbtn" data-goto="${c.key}" ${c.s ? `data-s="${c.s}"` : ''}>${esc(FBY[c.key].label)}</button>: ` : ''}${esc(c.text)}</li>`).join('')}</ul>` : '<p class="pill good">No conflicts found between your assumptions.</p>'}</section>`;
  }
  function scenarioAssistHtml() {
    const { all } = calc(); const T = DCFAnalysis.scenarioTable(all);
    const c = (k, f = fmt.mm) => T.map(r => `<td class="num">${r.ok ? f(r[k]) : '—'}</td>`).join('');
    return `<section class="panel"><div class="panel-head"><h2>Scenario overview</h2><span class="footnote">What each scenario's inputs produce. Scenarios are only what you enter: the calculator never builds Bear and Bull by adding or subtracting a fixed percentage, and it does not suggest probabilities.</span></div>
      <div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th>${SC.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Revenue, year 1</td>${c('rev1')}</tr><tr><td>Revenue, year 5</td>${c('rev5')}</tr><tr><td>Revenue, year 10</td>${c('rev10')}</tr><tr><td>EBIT, year 1</td>${c('ebit1')}</tr><tr><td>EBIT, year 10</td>${c('ebit10')}</tr><tr><td>Free cash flow, year 1</td>${c('fcf1')}</tr><tr><td>Free cash flow, year 10</td>${c('fcf10')}</tr><tr><td>Enterprise value</td>${c('ev')}</tr><tr class="key"><td>Value per share</td>${c('perShare', fmt.usd)}</tr><tr class="sub"><td>Terminal value share of EV</td>${c('tvShare', v => fmt.pct(v))}</tr>
      <tr><td>Your probability</td>${SC.map(s => `<td class="num">${isNum(cur.inputs.prob[s]) ? fmt.pct(cur.inputs.prob[s]) : '<span class="na">not set</span>'}</td>`).join('')}</tr></tbody></table></div></section>`;
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
  function dilSummaryRow() {
    const d = DCFModel.dilution(cur);
    const mname = { simple: 'Simple', advanced: 'Advanced', totals: 'Workbook totals' }[d.method];
    return `<div class="di-row"><div class="di-lab"><button class="help" data-help="dil.method" aria-label="About share dilution">?</button><span>Diluted shares</span></div><div class="di-in"><span class="di-val">${d.ok ? fmt.n(d.diluted, 2) + ' mm' : `<span class="na">${esc(d.problem || 'Not set')}</span>`}</span>${mname ? `<small class="footnote">${mname}</small>` : ''} <button class="linkbtn" data-goto="dilution">Edit</button> <a class="linkbtn" href="#guide">Learn</a></div></div>`;
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
      ${importStatus.pending ? `<div class="footnote"><b>${importStatus.pending} value${importStatus.pending > 1 ? 's' : ''} differ from what you have.</b> Nothing was replaced: review them below.</div>` : ''}
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
      <tr><th scope="row">Shares outstanding (mm)</th><td><span class="ovc">${provDot(isNum(inp.basic) ? provOf('basic', inp.basic) : null, srcTitle('basic'))}<button class="cellbtn" data-help="basic">${isNum(cur.inputs.basic) ? fmt.n(cur.inputs.basic, 0) : '<span class="na">Not set</span>'}</button></span>${cur.asOf && cur.asOf.basic ? `<div class="footnote">as of ${esc(cur.asOf.basic)} · SEC filing data</div>` : ''}</td></tr>
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
        <tr><th scope="row">Diluted shares (mm)</th><td colspan="3">${isNum(sh) ? fmt.n(sh, 0) : '<span class="na">needs share dilution</span>'} <a class="footnote" href="#guide">Learn</a></td></tr>
      </tbody></table>
      <h3 class="sub-h">Reference from data <span class="footnote">use as a starting point for the ${cur.active} case</span></h3>
      ${refs.length ? `<div class="refs">${refs.map(r => `<div class="ref"><div><span>${esc(r.label)}</span><small title="${esc(r.src)}">${esc(r.src)}</small></div><b>${plain(r.f(r.v))}</b><button class="btn tiny" data-use-ref="${r.k}" title="Copy into ${esc(FBY[r.target].label)}${r.all ? ' for all scenarios' : ' (' + cur.active + ')'}">Use</button></div>`).join('')}</div>` : '<p class="footnote">Import a company to see market references and historical drivers here.</p>'}
    </section>`;
    // analyst input panel
    const s = cur.active;
    const tabs = [['key', 'Key inputs'], ['scen', 'Scenarios'], ['adv', 'Advanced']];
    let body = '';
    if (dashTab === 'key') body = ['g1', 'g2', 'g3', 'em1', 'em5', 'em10', 'tg', 'rf', 'erp', 'beta', 'kd'].map(k => dashInput(k, s)).join('') + dilSummaryRow();
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
    { const pend = pendingPanel(); if (pend) status = (status || '') + pend; }
    return `<div class="dash">${status ? `<div style="grid-area:status">${status}</div>` : ''}${header}${overview}${summary}${drivers}${inputs}${football}${sensitivity}${scen}${fcf}${comp}</div>`;
  };

  // ---------- source guide (drawer) ----------
  function guideHtml(g) {
    const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
    return `<div class="gsteps">
      ${g.kind ? `<div class="gkind"><span class="badge-s ${/market/i.test(g.kind) ? 'b-mkt' : 'b-fil'}">${esc(g.kind)}</span></div>` : ''}
      ${g.where && g.where.length ? `<details open><summary>Where exactly to find it</summary><ol>${li(g.where)}</ol></details>` : ''}
      ${g.statement || g.date || g.units ? `<details><summary>Statement, date and units</summary><dl class="gdl">${g.statement ? `<div><dt>Statement or disclosure</dt><dd>${esc(g.statement)}</dd></div>` : ''}${g.date ? `<div><dt>Reporting date</dt><dd>${esc(g.date)}</dd></div>` : ''}${g.units ? `<div><dt>Units</dt><dd>${esc(g.units)}</dd></div>` : ''}</dl></details>` : ''}
      ${g.example ? `<details><summary>Example</summary><p>${esc(g.example)}</p></details>` : ''}
      ${g.terms && g.terms.length ? `<details><summary>Common terms in filings</summary><ul>${li(g.terms)}</ul></details>` : ''}
      ${g.watch && g.watch.length ? `<details><summary>Watch out for</summary><ul>${li(g.watch)}</ul></details>` : ''}
    </div>`;
  }

  // ---------- share dilution guide ----------
  // A teaching calculator. It has its own state and never writes to the DCF model.
  const gcDefaults = () => ({ basic: 100, price: 100, opts: 8, k: 40, rsu: 2, other: 0, equity: 10000, src: 'example' });
  let gc = gcDefaults();
  function gcFromModel() {
    const I = cur.inputs, D = cur.dilution || {};
    const o = { basic: isNum(I.basic) ? I.basic : null, price: isNum(I.price) ? I.price : null, opts: null, k: null, rsu: null, other: null, equity: null, src: 'model' };
    if (D.method === 'advanced' && !D.none) {
      const rows = (D.options || []).filter(r => isNum(r.n) && isNum(r.k) && r.n > 0 && (!isNum(o.price) || r.k < o.price));
      const n = rows.reduce((a, r) => a + r.n, 0);
      if (n > 0) { o.opts = n; o.k = rows.reduce((a, r) => a + r.n * r.k, 0) / n; } else { o.opts = 0; o.k = 0; }
      o.rsu = D.rsu && isNum(D.rsu.n) ? D.rsu.n : 0;
      const d = DCFModel.dilution(cur);
      o.other = d.rows.filter(r => r.type === 'Warrants' || r.type === 'Convertible').reduce((a, r) => a + (r.net || 0), 0);
    }
    const { all } = calc(); const b = all.scen.Base;
    if (b && b.ok && isNum(b.equity)) o.equity = Math.round(b.equity);
    return o;
  }
  function gcCalc(g) {
    const need = ['basic', 'price', 'opts', 'k', 'rsu', 'other'].filter(k => !isNum(g[k]));
    if (need.length) return { ok: false, need };
    if (['basic', 'price', 'opts', 'k', 'rsu', 'other', 'equity'].some(k => isNum(g[k]) && g[k] < 0)) return { ok: false, need: [], neg: true };
    if (!(g.price > 0) || !(g.basic > 0)) return { ok: false, need: [], zero: true };
    const itm = g.opts > 0 && g.k < g.price;
    const proceeds = itm ? g.opts * g.k : 0;
    const repurchased = itm ? proceeds / g.price : 0;
    const netOpts = itm ? g.opts - repurchased : 0;
    const diluted = g.basic + netOpts + g.rsu + g.other;
    const r = { ok: true, itm, proceeds, repurchased, netOpts, diluted, pct: (diluted - g.basic) / g.basic, gross: (itm ? g.opts : 0) + g.rsu + g.other };
    if (isNum(g.equity)) { r.ivBasic = g.equity / g.basic; r.ivDil = g.equity / diluted; r.diff = r.ivDil / r.ivBasic - 1; }
    return r;
  }
  const tip = t => `<span class="tip" tabindex="0" role="note" aria-label="${esc(t)}" data-tip="${esc(t)}">i</span>`;
  const gn = (v, d = 2) => isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
  function gcInput(k, label, unit, t) {
    const id = 'gc-' + k, err = parseErrors[id];
    const u = unit === 'usd' ? '$' : unit === 'usd_mm' ? '$mm' : 'mm';
    return `<label class="gcf"><span class="gl">${esc(label)} ${t ? tip(t) : ''}</span><div class="inwrap ${err ? 'err' : ''}"><input type="text" inputmode="decimal" data-t="gc" data-k="${k}" data-unit="${unit}" id="${id}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(gc[k], unit))}" placeholder="Enter" aria-label="${esc(label)}"><span class="unit">${u}</span></div>${err ? `<div class="errmsg">${esc(err)}</div>` : ''}</label>`;
  }
  function liveExample() {
    const I = cur.inputs, d = DCFModel.dilution(cur), A = cur.asOf || {};
    const { all } = calc(); const b = all.scen.Base;
    const eq = b && b.ok ? b.equity : null;
    const mname = { simple: 'Simple', advanced: 'Advanced', totals: 'Workbook totals' }[d.method] || 'Not chosen yet';
    const cell = (l, v, s) => `<div><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    return `<section class="panel glive" id="g-live"><div class="panel-head"><h2>Your model, as a live example</h2><span class="badge-s b-man">Read only</span></div>
      <p class="footnote">These are the share counts in <b>${esc(cur.name)}</b>. Nothing on this page changes them. To edit, go to <a href="#company">Company &amp; market data</a>.</p>
      <div class="dsum">
        ${cell('Actual common shares outstanding', isNum(I.basic) ? gn(I.basic) + ' mm' : '<span class="na">not entered</span>', A.basic ? 'as of ' + esc(A.basic) + ' · SEC filing data' : 'date not set')}
        <div class="op">+</div>${cell('Net new shares', d.ok ? gn(d.net) + ' mm' : '<span class="na">—</span>', 'method: ' + mname)}
        <div class="op">=</div><div class="tot">${cell('Estimated diluted shares', d.ok ? gn(d.diluted) + ' mm' : '<span class="na">—</span>', d.ok ? 'used to divide equity value' : esc(d.problem || ''))}</div>
      </div>
      ${isNum(eq) && d.ok && isNum(I.basic) && I.basic > 0 ? `<div class="gcmp"><div><span>Base case equity value</span><b>${fmt.bn(eq)}</b></div><div><span>Per actual share</span><b>${fmt.usd(eq / I.basic)}</b></div><div><span>Per diluted share</span><b>${fmt.usd(eq / d.diluted)}</b></div><div><span>Difference</span><b class="${d.diluted > I.basic ? 'neg' : ''}">${((I.basic / d.diluted - 1) * 100).toFixed(2)}%</b><small>per diluted vs per actual share</small></div></div>` : '<p class="footnote">The comparison appears once the Base case calculates and dilution is complete.</p>'}
      <div class="btns"><button class="btn" data-gc-load>Load these into the calculator below</button>${isNum(I.price) ? `<span class="footnote">Price ${fmt.usd(I.price)}${A.price ? ', market quote as of ' + esc(A.price) : ''}</span>` : ''}</div>
    </section>`;
  }
  P.guide = () => {
    const r = gcCalc(gc);
    const G = { basic: 'Common shares actually issued and outstanding on a specific date, from the 10-Q or 10-K cover page.', diluted: 'Actual shares plus the net new shares that options, RSUs, warrants and convertibles would create.', tsm: 'Treasury stock method: assume in-the-money options are exercised and the cash received buys back shares at the current price.', itm: 'In the money: the exercise price is below the current share price, so a holder would exercise.', wa: 'Weighted average: the average share count over the reporting period, used for EPS. Not a count on any single date.' };
    const steps = [
      ['Open the filing on SEC EDGAR', 'Go to <a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noopener">EDGAR full-text search</a>, type the company or ticker, and open its most recent 10-Q or 10-K. Use the latest one: share counts go stale every quarter.'],
      ['Read the cover page for actual shares', 'The first page states, for example, “As of October 24, 2026, there were X shares of the registrant\'s common stock outstanding.” That is your <b>actual common shares outstanding</b> and its date. It is usually a few weeks after the period end, which is fine.'],
      ['Find the EPS share table', 'In the <b>Consolidated Statements of Operations</b>, or the <b>Earnings per share</b> footnote, look for “Weighted-average shares used in computation of earnings per share: Basic / Diluted”. Note the period (three months, nine months or year).'],
      ['Note the dilutive effect line', 'The EPS footnote reconciles basic to diluted weighted-average shares with a line such as “Total dilutive effect of outstanding stock awards”. This tells you how much dilution the company itself counted, on average, for the period.'],
      ['Open the stock-based compensation footnote', 'Find <b>Stock-Based Compensation</b> (sometimes “Stockholders\' Equity”). It lists options outstanding with their weighted-average exercise price, unvested RSUs, and the unrecognised compensation cost. The 10-K has the full table; the 10-Q often has an update.'],
      ['Check debt and equity notes for other securities', 'Look in the <b>Debt</b> note for convertible notes (conversion rate and price) and the <b>Equity</b> note for warrants. These are handled separately from options and RSUs.'],
    ];
    const mistakes = [
      ['Using weighted-average shares as a current count', 'Weighted-average shares are an average over the quarter. Use the cover-page count for actual shares outstanding.'],
      ['Treating diluted EPS shares as current diluted shares', 'Diluted weighted-average shares from the EPS table describe the past quarter, at that quarter\'s average price. Today\'s dilution can differ.'],
      ['Counting out-of-the-money options', 'If the exercise price is above today\'s share price, no one would exercise. They add no shares.'],
      ['Adding options at gross with no buyback', 'The treasury stock method subtracts the shares the exercise cash could repurchase. Gross counting overstates dilution.'],
      ['Double-counting', 'Do not add an estimated diluted count on top of individual securities, or count shares already in the cover-page figure (for example, vested RSUs that have been settled).'],
      ['Mixing units', 'Keep shares in millions and prices in USD per share. A share count typed in thousands or units throws the value per share off by 1,000 times or more.'],
      ['Ignoring convertibles and warrants, or treating them like options', 'Convertibles use the if-converted method; their debt should then come out of the equity bridge. Warrants use the treasury stock method with their own strike.'],
    ];
    const v = r.ok;
    const calcOut = v ? `<div class="gsteps-out">
        <ol class="gcalc">
          <li><span>Are the options in the money?</span><b>${gc.opts > 0 ? (r.itm ? `Yes: $${gn(gc.k)} &lt; $${gn(gc.price)}` : `No: $${gn(gc.k)} ≥ $${gn(gc.price)}, so they are excluded`) : 'No options entered'}</b></li>
          <li><span>Exercise proceeds = options × exercise price</span><b>${r.itm ? `${gn(gc.opts)} × $${gn(gc.k)} = $${gn(r.proceeds)} mm` : '$0'}</b></li>
          <li><span>Shares repurchased = proceeds ÷ share price</span><b>${r.itm ? `$${gn(r.proceeds)} ÷ $${gn(gc.price)} = ${gn(r.repurchased)} mm` : '0'}</b></li>
          <li><span>Net new shares from options = options − repurchased</span><b>${r.itm ? `${gn(gc.opts)} − ${gn(r.repurchased)} = ${gn(r.netOpts)} mm` : '0'}</b></li>
          <li><span>Add unvested RSUs and other dilutive securities</span><b>${gn(gc.rsu)} + ${gn(gc.other)} = ${gn(gc.rsu + gc.other)} mm</b></li>
          <li class="tot"><span>Estimated diluted shares</span><b>${gn(gc.basic)} + ${gn(r.netOpts)} + ${gn(gc.rsu + gc.other)} = ${gn(r.diluted)} mm</b></li>
        </ol>
        <div class="gbreak">
          <div class="gbar" role="img" aria-label="Diluted shares breakdown">
            <span style="flex:${gc.basic}" class="b0" title="Actual shares"></span><span style="flex:${r.netOpts || 0}" class="b1" title="Net option shares"></span><span style="flex:${gc.rsu || 0}" class="b2" title="RSUs"></span><span style="flex:${gc.other || 0}" class="b3" title="Other"></span>
          </div>
          <div class="glegend"><span><i class="b0"></i>Actual ${gn(gc.basic)}</span><span><i class="b1"></i>Net options ${gn(r.netOpts)}</span><span><i class="b2"></i>RSUs ${gn(gc.rsu)}</span><span><i class="b3"></i>Other ${gn(gc.other)}</span><span>Dilution <b>${(r.pct * 100).toFixed(2)}%</b></span></div>
        </div>
        ${isNum(r.ivBasic) ? `<div class="gcmp"><div><span>Intrinsic value per actual share</span><b>$${gn(r.ivBasic)}</b><small>$${gn(gc.equity, 0)} mm ÷ ${gn(gc.basic)} mm</small></div><div><span>Intrinsic value per diluted share</span><b>$${gn(r.ivDil)}</b><small>$${gn(gc.equity, 0)} mm ÷ ${gn(r.diluted)} mm</small></div><div><span>Difference</span><b class="${r.diff < 0 ? 'neg' : ''}">${(r.diff * 100).toFixed(2)}%</b><small>what ignoring dilution would overstate</small></div></div>` : '<p class="footnote">Enter an equity value to compare value per share.</p>'}
      </div>` : `<div class="notice">${r.neg ? 'Values must be at least 0.' : r.zero ? 'Shares and price must be above 0.' : 'Fill in every box to see the calculation: ' + r.need.join(', ') + '.'}</div>`;
    const toc = [['g1', 'Basic vs diluted'], ['g2', 'Finding it on EDGAR'], ['g3', 'The formula'], ['g4', 'Amazon example'], ['g5', 'Calculator'], ['g6', 'Common mistakes']];
    return `<div class="ghead"><div><h1>Share dilution guide</h1><p class="lead">How to get from the shares a company has today to the shares that equity value should be divided by, and where each number lives in an SEC filing.</p></div><a class="btn" href="#company">Back to market data</a></div>
      <nav class="gtoc" aria-label="Guide sections">${toc.map(([id, l], i) => `<button data-scroll-to="${id}"><span>${i + 1}</span>${l}</button>`).join('')}</nav>
      ${liveExample()}
      <section class="panel gsec" id="g1"><h2><span class="gnum">1</span>Basic vs diluted shares</h2>
        <div class="grid2"><div class="gdef"><h3>Basic shares ${tip(G.basic)}</h3><p>Shares that exist today. Holders can vote and receive dividends. Reported on the filing's cover page with a date.</p></div>
        <div class="gdef"><h3>Diluted shares ${tip(G.diluted)}</h3><p>Basic shares plus the shares that would be created if in-the-money options, RSUs, warrants and convertibles turned into stock. A DCF values all of the equity, so it should be split across every share that will exist.</p></div></div>
        <details class="gex"><summary>Example: why it matters</summary>
          <p>A company has an equity value of <b>$10 billion</b>.</p>
          <div class="gcmp"><div><span>On 100 million basic shares</span><b>$100.00</b><small>$10,000 mm ÷ 100 mm</small></div><div><span>On 110 million diluted shares</span><b>$90.91</b><small>$10,000 mm ÷ 110 mm</small></div><div><span>Difference</span><b class="neg">−9.09%</b><small>overstated if you ignore dilution</small></div></div>
          <p class="footnote">The same business, the same cash flows, nine percent less per share. If the stock trades at $95, the basic figure says “cheap” and the diluted one says “expensive”.</p></details>
      </section>
      <section class="panel gsec" id="g2"><h2><span class="gnum">2</span>Finding share counts on SEC EDGAR</h2>
        <ol class="gstep">${steps.map(([h, t], i) => `<li><details ${i < 2 ? 'open' : ''}><summary><span class="sn">${i + 1}</span>${h}</summary><p>${t}</p></details></li>`).join('')}</ol>
        <div class="notice"><b>Diluted weighted-average EPS shares are not current diluted shares.</b> They average the quarter, use that quarter's average share price for the treasury stock method, and exclude anti-dilutive awards. They are a sense check for your estimate, not a substitute for it. ${tip(G.wa)}</div>
      </section>
      <section class="panel gsec" id="g3"><h2><span class="gnum">3</span>The formula</h2>
        <div class="gformula">Estimated diluted shares = <b>Actual common shares outstanding</b> + <b>Potential dilutive shares</b> − <b>Treasury stock method repurchased shares</b></div>
        <dl class="gvars">
          <div><dt>Actual common shares outstanding</dt><dd>Cover page of the latest 10-Q or 10-K, with its date. Millions of shares.</dd></div>
          <div><dt>Potential dilutive shares</dt><dd>In-the-money options and warrants, unvested RSUs and PSUs, and convertibles if converting is worthwhile. From the stock-based compensation, equity and debt notes.</dd></div>
          <div><dt>Treasury stock method repurchased shares ${tip(G.tsm)}</dt><dd>The exercise cash holders would pay, divided by today's share price: the shares the company could buy back with it.</dd></div>
        </dl>
        <details class="gex"><summary>How the treasury stock method works</summary><ol><li>Keep only options whose exercise price is below today's price ${tip(G.itm)}. Out-of-the-money options add nothing.</li><li>Exercise proceeds = options × weighted-average exercise price.</li><li>Assume the company uses the proceeds to buy back shares at today's price: repurchased = proceeds ÷ price.</li><li>Net new shares = options − repurchased.</li></ol><p class="footnote">10 million options at $40 with the stock at $100: proceeds $400 mm, repurchased 4 million, net 6 million new shares, not 10.</p></details>
        <details class="gex"><summary>RSUs, contingent shares, warrants and convertibles</summary><ul>
          <li><b>RSUs / PSUs:</b> no exercise price. Count unvested units; some analysts deduct unrecognised compensation ÷ price as a buyback. PSUs count only the shares expected to vest.</li>
          <li><b>Contingently issuable shares</b> (earn-outs, performance awards): include only if the condition is met or likely; note your judgment.</li>
          <li><b>Warrants:</b> treasury stock method with their own exercise price.</li>
          <li><b>Convertibles:</b> if-converted method. If the share price is above the conversion price, add the conversion shares and remove the principal from debt in the equity bridge, so it is not counted twice. Net share settlement adds only the value above par.</li></ul></details>
      </section>
      <section class="panel gsec" id="g4"><h2><span class="gnum">4</span>Example: Amazon's Q3 2026 10-Q</h2>
        <p>From Amazon's Form 10-Q for the quarter ended <b>September 30, 2026</b>, “the calculation of diluted shares (in millions)” for the three months ended that date:</p>
        <table class="fin gamzn"><tbody>
          <tr><td>Shares used in computation of basic earnings per share</td><td>10,797</td></tr>
          <tr><td>Total dilutive effect of outstanding stock awards</td><td>+ 132</td></tr>
          <tr class="tot"><td>Shares used in computation of diluted earnings per share</td><td>10,929</td></tr>
        </tbody></table>
        <div class="tags"><span class="badge-s b-fil">SEC filing data</span><span class="tag">Quarterly weighted average</span><span class="tag">Not a current share count</span></div>
        <details class="gex"><summary>How the EPS denominator is built</summary><p>Amazon starts with the average basic shares over the quarter (10,797 mm) and adds the net shares its stock awards would create, measured at the quarter's average price (132 mm, about 1.2%). Diluted EPS = net income ÷ 10,929 mm. For your DCF, take actual shares from the cover page instead: “10,813,138,306 shares of common stock … outstanding as of October 21, 2026”, which is 10,813.14 million on a single date. Then estimate dilution from the stock-based compensation note, using this 1.2% as a sense check.</p></details>
        <p class="footnote">Source: <a href="https://www.sec.gov/Archives/edgar/data/1018724/000101872426000040/amzn-20260930.htm" target="_blank" rel="noopener">Amazon.com, Inc. Form 10-Q, quarter ended September 30, 2026 (SEC EDGAR)</a>. Consolidated Statements of Operations, and Note 1, Accounting Policies and Supplemental Disclosures, “Earnings Per Share”. Figures checked against the filing on 1 Nov 2026.</p>
      </section>
      <section class="panel gsec" id="g5"><h2><span class="gnum">5</span>Diluted share calculator</h2>
        <p class="footnote">A sandbox. It ${gc.src === 'model' ? 'started from your model\'s figures' : 'starts with a teaching example'} and never changes your DCF inputs. Use it to see how each input moves the result.</p>
        <div class="gcgrid">
          ${gcInput('basic', 'Actual common shares outstanding', 'shares', 'From the cover page of the latest 10-Q or 10-K.')}
          ${gcInput('price', 'Current share price', 'usd', 'A current market quote, in USD per share.')}
          ${gcInput('opts', 'In-the-money options', 'shares', 'Options with exercise price below the current price. From the stock-based compensation note.')}
          ${gcInput('k', 'Weighted-average exercise price', 'usd', 'Of those in-the-money options, in USD per share.')}
          ${gcInput('rsu', 'Unvested RSUs', 'shares', 'Unvested restricted stock units at period end. Counted in full here.')}
          ${gcInput('other', 'Other dilutive securities (handled separately)', 'shares', 'Net shares from warrants and convertibles, worked out with their own method.')}
          ${gcInput('equity', 'Equity value (to compare value per share)', 'usd_mm', 'Optional. From the equity bridge: enterprise value plus cash, minus debt.')}
        </div>
        <div class="btns"><button class="btn" data-gc-load>Use my model's figures</button><button class="btn" data-gc-reset>Reset to the example</button></div>
        ${calcOut}
      </section>
      <section class="panel gsec" id="g6"><h2><span class="gnum">6</span>Common mistakes</h2>
        <div class="gmist">${mistakes.map(([h, t], i) => `<details><summary><span class="sn">${i + 1}</span>${h}</summary><p>${t}</p></details>`).join('')}</div>
      </section>`;
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
  P.company = () => `<div><h1>Company & market data</h1><p class="lead">Who you are valuing, as of when, and the share data that turns equity value into a value per share. Market quotes are current prices; share counts come from the latest SEC filing.</p></div>${groupPanel('company')}${marketPanel()}${dilutionPanel()}${shareSummary()}`;
  P.assumptions = () => {
    const learn = !(cur.ui && cur.ui.learn === false);
    const bar = `<div class="learnbar"><button class="btn" data-learn-toggle aria-pressed="${learn}">${learn ? 'Hide' : 'Show'} guides and notes</button>${learn ? '<button class="btn" data-aid-all="open">Expand all</button><button class="btn" data-aid-all="close">Collapse all</button>' : ''}<span class="footnote">Click ? on any row for the full guide: what it is, how to estimate it, history, examples, scenarios, common mistakes, effect on value and sources.</span></div>`;
    return `<div><h1>Forecast assumptions</h1><p class="lead">The drivers of the ten-year forecast, one column per scenario. Revenue grows in three phases, margins move in a straight line between years 1, 5 and 10, and reinvestment scales with revenue.</p></div>${basePanel()}${bar}${groupPanel('revenue')}${groupPanel('margins')}${groupPanel('reinvest')}${checksPanelHtml()}${learn ? toolsHtml() : ''}${scenarioAssistHtml()}`;
  };
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
    const H = cur.hist, Y = H.years, ORD = [4, 3, 2, 1, 0]; // newest first on screen; stored oldest first
    const TC = DCFAnalysis.ttmColumn(cur);
    const cell = (key, i) => {
      const id = `h-${key}-${i}`, v = H[key][i], err = parseErrors[id];
      const pv = DCFData.provenance(cur, 'hist.' + key, H[key]); const impv = cur.imported && cur.imported['hist.' + key];
      const cellImp = impv && isNum(v) && impv.v[i] === v;
      return `<td class="hist"><input type="text" inputmode="decimal" data-t="hist" data-k="${key}" data-i="${i}" id="${id}" class="${err ? 'err' : ''} ${cellImp ? 'imp' : (pv === 'overridden' && impv ? 'ovr' : '')}" title="${cellImp ? esc(srcTitle('hist.' + key)) : ''}" value="${esc(parseErrors[id + ':raw'] != null ? parseErrors[id + ':raw'] : toInputText(v, 'num'))}" placeholder="Enter" aria-label="${esc(HBY[key].label)} ${Y[i] || ''}">${err ? `<div class="errmsg">${esc(err)}</div>` : ''}</td>`;
    };
    const tcell = (key) => { const v = TC ? TC.v[key] : null; return `<td class="hist ttm">${TC ? `<button class="ttmv" data-ttm="${key === 'opex' ? 'ebitda' : key}" title="How this TTM figure is built">${isNum(v) ? fmt.mm(v) : '<span class="na">Not available</span>'}</button>` : '<span class="na">—</span>'}</td>`; };
    const row = (key) => `<tr><td><div class="name" style="display:flex;gap:6px;align-items:center"><button class="help" data-help="hist.${key}" aria-label="How to fill in ${esc(HBY[key].label)}">?</button>${esc(HBY[key].label)}</div></td>${tcell(key)}${ORD.map(i => cell(key, i)).join('')}</tr>`;
    // column accessors: 't' = TTM, numbers = stored index
    const n = (k, i) => i === 't' ? (TC && isNum(TC.v[k]) ? TC.v[k] : null) : (isNum(H[k][i]) ? H[k][i] : null);
    const all = (...xs) => xs.every(isNum);
    const ebitda = i => all(n('gp', i), n('opex', i)) ? n('gp', i) - n('opex', i) : null;
    const ebit = i => all(ebitda(i), n('da', i)) ? ebitda(i) - n('da', i) : null;
    const t = cur.inputs.tax.Base;
    const ebt = i => all(ebit(i), n('interest', i)) ? ebit(i) - n('interest', i) : null;
    const taxes = i => all(ebt(i), t) ? ebt(i) * t : null;
    const ni = i => all(ebt(i), taxes(i)) ? ebt(i) - taxes(i) : null;
    const ocf = i => all(ni(i), n('da', i), n('sbc', i), n('dnwc', i)) ? ni(i) + n('da', i) + n('sbc', i) + n('dnwc', i) : null;
    const fcf = i => all(ocf(i), n('capex', i)) ? ocf(i) + n('capex', i) : null;
    const div = (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b : null;
    const prevOf = i => i === 't' ? null : i - 1;
    const yoy = i => i === 't' ? (TC && TC.prior && isNum(TC.prior.value) ? div(n('rev', 't'), TC.prior.value) - 1 : null) : i ? (div(n('rev', i), n('rev', i - 1)) == null ? null : div(n('rev', i), n('rev', i - 1)) - 1) : null;
    const COLS = ['t', ...ORD];
    const comp = (label, fn, cls = 'sub', f = fmt.mm) => `<tr class="${cls}"><td>${label}</td>${COLS.map(i => `<td class="hist ${i === 't' ? 'ttm' : ''}">${f(fn(i))}</td>`).join('')}</tr>`;
    const yrs = ORD.map(i => `<th class="hist"><input type="text" inputmode="numeric" data-t="year" data-i="${i}" id="y-${i}" value="${esc(Y[i] == null ? '' : Y[i])}" placeholder="FY" style="width:64px" aria-label="Fiscal year, column ${5 - i}"></th>`).join('');
    const ttmHead = `<th class="hist ttm"><div class="ttmh">TTM${TC ? `<small>${TC.isFY ? '= latest FY' : 'to ' + esc(TC.end)}</small>` : '<small>not loaded</small>'}</div></th>`;
    const avg = (fn) => { const v = [0, 1, 2, 3, 4].map(fn).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const cagr = all(n('rev', 0), n('rev', 4)) && H.rev[0] > 0 ? Math.pow(H.rev[4] / H.rev[0], 1 / 4) - 1 : null;
    const hs = Object.entries(cur.sources).filter(([k, x]) => k.startsWith('hist.') && x.auto);
    const impNote = hs.length ? `<div class="notice info"><b>Imported from ${esc(hs[0][1].provider)}</b> (${esc(hs[0][1].period)}), retrieved ${new Date(hs[0][1].retrieved).toLocaleString()}. Cyan cells are imported; amber cells are ones you changed. ${HIST_FIELDS.filter(h => !cur.sources['hist.' + h.key]).length ? 'Still to enter by hand: ' + HIST_FIELDS.filter(h => !cur.sources['hist.' + h.key]).map(h => esc(h.label)).join(', ') + '.' : ''} Click ? on a row to see its exact source.</div>` : `<div class="notice">Search a company in the top bar to import five years of statements automatically, or type them in from the 10-K.</div>`;
    const latest = isNum(Y[4]) ? Y[4] : null;
    return `<div><h1>Historical financials</h1><p class="lead">Reported figures in $ millions, newest first: trailing twelve months, then the last five fiscal years. These are your evidence for the forecast. ${cur.mode === 'corrected' ? 'The forecast grows from the base you choose on Forecast assumptions (latest fiscal year or TTM).' : ''}</p></div>${impNote}
    <section class="panel"><div class="panel-head"><h2>Income statement and free cash flow</h2><span class="footnote">Type the fiscal year in each column header to relabel it. Cash outflows (CapEx, a rise in NWC) are negative, as on the cash flow statement. The shaded TTM column is calculated; click a figure to see how.</span></div>
    <div class="btns hbar">${latest ? `<button class="btn" data-hist-roll title="Moves every figure one column older, drops FY${Y[0] || ''}, and adds an empty FY${latest + 1} column">Add FY${latest + 1} (shift the years)</button>` : ''}<button class="btn" data-scroll-to="ttm-build">${cur.ttm ? 'Check or replace TTM by hand' : 'Build TTM by hand'}</button></div>
    <div class="tbl-wrap"><table class="fin hfin"><thead><tr><th>$ millions, reported</th>${ttmHead}${yrs}</tr></thead><tbody>
      ${row('rev')}${comp('YoY growth', yoy, 'sub', v => fmt.pct(isNum(v) ? v : null))}
      ${row('gp')}${comp('Gross margin', i => div(n('gp', i), n('rev', i)), 'sub', fmt.pct)}
      ${row('opex')}${comp('EBITDA = gross profit − operating expenses', ebitda, 'total')}${comp('EBITDA margin', i => div(ebitda(i), n('rev', i)), 'sub', fmt.pct)}
      ${row('da')}${comp('EBIT', ebit, 'total')}${comp('EBIT margin', i => div(ebit(i), n('rev', i)), 'sub', fmt.pct)}
      ${row('interest')}${comp('Pre-tax income', ebt)}${comp(`Taxes, estimated at the Base tax rate (${isNum(t) ? (t * 100).toFixed(1) + '%' : 'not set'}), not reported`, taxes, 'sub')}${comp('Net income (estimated)', ni, 'total')}
      ${row('sbc')}${row('dnwc')}${comp('Operating cash flow (estimated)', ocf, 'total')}${row('capex')}${comp('Free cash flow (estimated)', fcf, 'key')}${comp('FCF margin', i => div(fcf(i), n('rev', i)), 'sub', fmt.pct)}
    </tbody></table></div>
    ${TC ? `<p class="footnote">TTM ${TC.isFY ? 'equals the latest fiscal year: no 10-Q has been filed since it ended.' : `to ${esc(TC.end)} = fiscal year + year to date − the same period a year earlier, for each line. ${TC.manual ? 'Built from figures you typed.' : 'Calculated from the SEC filings.'}`} Taxes, net income and cash flow in this table use the same estimate as the fiscal years; the reported TTM figures are in the comparison below.</p>` : ''}</section>
    ${ttmCompareHtml()}
    ${ttmBuilderHtml()}
    <section class="panel"><h2>Ratios to anchor your assumptions</h2><div class="stats">
      <div class="stat"><span class="k">Revenue CAGR, 4 years</span><span class="v">${plain(fmt.pct(cagr))}</span><span class="s">Compare with growth phases 1–2</span></div>
      <div class="stat"><span class="k">Avg EBITDA margin</span><span class="v">${plain(fmt.pct(avg(i => div(ebitda(i), n('rev', i)))))}</span><span class="s">Latest ${plain(fmt.pct(div(ebitda(4), n('rev', 4))))}${TC ? ` · TTM ${plain(fmt.pct(div(ebitda('t'), n('rev', 't'))))}` : ''}</span></div>
      <div class="stat"><span class="k">Avg D&A % revenue</span><span class="v">${plain(fmt.pct(avg(i => div(n('da', i), n('rev', i)))))}</span><span class="s">Compare with D&A input</span></div>
      <div class="stat"><span class="k">Avg CapEx % revenue</span><span class="v">${plain(fmt.pct(avg(i => div(isNum(n('capex', i)) ? -H.capex[i] : null, n('rev', i)))))}</span><span class="s">Compare with CapEx phases${TC && isNum(TC.v.capex) ? ` · TTM ${plain(fmt.pct(div(-TC.v.capex, TC.v.rev)))}` : ''}</span></div>
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
    <div class="grid2"><section class="panel"><h2>Diluted share count</h2><p class="footnote">From the share dilution panel on <a href="#company">Company &amp; market data</a>. <a href="#guide">How it works</a></p><div class="tbl-wrap"><table class="fin"><tbody>
      <tr><td>Actual common shares outstanding${cur.asOf && cur.asOf.basic ? ` <span class="footnote">as of ${esc(cur.asOf.basic)}</span>` : ''}</td><td>${fmt.n(inp.basic, 2)}</td></tr><tr><td>+ Gross new shares from dilutive securities</td><td>${fmt.n(inp.options, 2)}</td></tr><tr><td>− Shares repurchased with proceeds (treasury stock method)</td><td>${fmt.n(inp.treasury, 2)}</td></tr><tr class="total"><td>Diluted shares (mm)</td><td>${fmt.n(sh, 0)}</td></tr></tbody></table></div></section>
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
      ${shareSummary()}
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
    return `<div><h1>Sources & change log</h1><p class="lead">Where each figure came from, and every change made to the inputs. Add a source from any field's ? panel.</p></div>${pendingPanel()}
    <section class="panel"><h2>Sources recorded (${srcs.length})</h2>${srcs.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Input</th><th style="text-align:left">Source</th><th style="text-align:left">Filing / report</th><th style="text-align:left">Period</th><th style="text-align:left">Link</th><th style="text-align:left">Notes</th></tr></thead><tbody>
      ${srcs.map(([k, s]) => `<tr><td><button class="btn" data-help="${k}">${esc(lab(k))}</button></td><td style="text-align:left;font-family:var(--font-ui)">${esc(s.name)}</td><td style="text-align:left;font-family:var(--font-ui)">${esc(s.type)}</td><td style="text-align:left;font-family:var(--font-ui)">${esc(s.period)}</td><td style="text-align:left;font-family:var(--font-ui)">${s.url && /^https?:\/\//i.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">open</a>` : esc(s.url || '')}</td><td style="text-align:left;white-space:normal;font-family:var(--font-ui)">${esc(s.notes)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">No sources recorded yet.</p>'}</section>
    <section class="panel"><h2>Change log (latest ${Math.min(cur.log.length, 200)})</h2>${cur.log.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>When</th><th style="text-align:left">Input</th><th>Scenario</th><th>From</th><th>To</th></tr></thead><tbody>
      ${cur.log.slice(0, 200).map(l => `<tr><td>${new Date(l.at).toLocaleString()}</td><td style="text-align:left;font-family:var(--font-ui)">${esc(lab(l.field))}</td><td>${esc(l.s || '')}</td><td>${esc(l.from == null ? '—' : l.from)}</td><td>${esc(l.to == null ? '—' : l.to)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">No changes yet.</p>'}</section>`;
  };

  // ---------- help drawer ----------
  function renderDrawer() {
    const root = $('#drawer-root');
    if (!drawerKey) { root.innerHTML = ''; return; }
    if (drawerKey.startsWith('ttm.')) { root.innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title"><button class="btn close" data-close aria-label="Close">Close</button>${ttmDrawerHtml(drawerKey.slice(4))}</aside>`; const c = root.querySelector('.close'); if (c) c.focus(); return; }
    const isHist = drawerKey.startsWith('hist.');
    const f = isHist ? Object.assign({ unit: 'usd_mm', kind: 'reported', group: 'hist', required: drawerKey === 'hist.rev', what: 'A reported figure for each of the last five fiscal years.', enter: '$ millions, as reported. Cash outflows are negative.' }, HBY[drawerKey.slice(5)]) : (FBY[drawerKey] || DIL_HELP[drawerKey] || (drawerKey === 'dil.proxy' ? { key: 'dil.proxy', label: 'Reported net dilutive effect', group: 'market', unit: 'shares', kind: 'reported', required: false, what: 'The net number of shares that stock awards added to the diluted share count in the latest EPS calculation. It is already net of the treasury stock method.', enter: 'Millions of shares from the EPS note of the newest 10-Q, with the period it covers.' } : null));
    if (!f) { drawerKey = null; root.innerHTML = ''; return; }
    const hh = DCFHelp.H[drawerKey] || {}, isFc = f.kind === 'forecast' && DCFHelp.G[drawerKey];
    const curVal = isHist ? cur.hist[drawerKey.slice(5)][4] : drawerKey === 'dil.proxy' ? (cur.dilution.proxy || {}).v : drawerKey.startsWith('company.') ? cur.inputs.company[drawerKey.split('.')[1]] : f.tri ? null : cur.inputs[drawerKey];
    const cik = cur.meta && cur.meta.cik;
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
      ${isFc ? forecastDrawerHtml(drawerKey, f) : `<dl>
        <div><dt>What it is</dt><dd>${esc(f.what)}</dd></div>
        ${hh.why ? `<div><dt>Why it matters</dt><dd>${esc(hh.why)}</dd></div>` : ''}
        <div><dt>What to enter</dt><dd>${esc(f.enter)}</dd></div>
        ${f.tip ? `<div><dt>Tip</dt><dd>${esc(f.tip)}</dd></div>` : ''}
      </dl>
      <div><h3>Where to find it</h3>${whereHtml(hh.where, cik)}${f.source ? `<p class="footnote">${esc(f.source)}</p>` : ''}${f.backup ? `<p class="footnote">Cross-check with: ${esc(f.backup)}</p>` : ''}</div>
      ${exampleHtml(drawerKey) ? `<div><h3>Example</h3>${exampleHtml(drawerKey)}</div>` : ''}
      ${hh.calc ? `<div><h3>How it is calculated</h3><p>${esc(hh.calc)}</p></div>` : ''}
      ${hh.mistakes && hh.mistakes.length ? `<div><h3>Common mistakes</h3><ul>${hh.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div><h3>Source and verification</h3>${sourceVerifHtml(drawerKey, curVal)}${hh.verify ? `<p class="footnote"><b>Check:</b> ${esc(hh.verify)}</p>` : ''}</div>`}
      ${f.cell || isHist ? `<p class="footnote">Workbook cell: <code>${esc(isHist ? 'Historicals row ' + f.row : f.cell)}</code></p>` : ''}
      ${f.guide ? guideHtml(f.guide) : ''}${String(drawerKey).startsWith('dil') || drawerKey === 'basic' ? '<a class="btn" href="#guide" data-close>Open the share dilution guide</a>' : ''}
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
      if (k.startsWith('company.')) { const c = k.split('.')[1]; from = cur.inputs.company[c]; cur.inputs.company[c] = v; if (c === 'analyst' && v) { try { localStorage.setItem('dcfcalc.analyst', v); } catch (x) {} } if (c === 'name' && v) { if (cur.name === 'New company' || cur.sample) cur.name = v; } }
      else if (s) { from = cur.inputs[k][s]; cur.inputs[k][s] = v; }
      else { from = cur.inputs[k]; cur.inputs[k] = v; }
    } else if (t === 'hist') { const k = el.dataset.k, i = +el.dataset.i; field = 'hist.' + k; s = cur.hist.years[i] ? 'FY' + cur.hist.years[i] : 'year ' + (i + 1); from = cur.hist[k][i]; cur.hist[k][i] = v; }
    else if (t === 'year') { const i = +el.dataset.i; field = 'hist.years'; from = cur.hist.years[i]; cur.hist.years[i] = v === null ? null : (isNaN(+v) ? v : +v); }
    else if (t === 'wb') { field = 'wb.' + el.dataset.k; from = cur.wb[el.dataset.k]; cur.wb[el.dataset.k] = v; }
    else if (t === 'tr') { const i = +el.dataset.i, k = el.dataset.k; field = `tranche ${i + 1} ${k}`; from = cur.tranches[i][k]; cur.tranches[i][k] = v; }
    else if (t === 'st') { field = 'street.' + el.dataset.k; from = cur.street[el.dataset.k]; cur.street[el.dataset.k] = v; }
    else if (t === 'dil') {
      const path = el.dataset.k, parts = path.split('.'); field = 'dilution.' + path;
      if (unit !== 'text' && isNum(v) && v < 0) { parseErrors[id] = 'Must be at least 0.'; parseErrors[id + ':raw'] = el.value; render(); return; }
      let o = cur.dilution; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
      const last = parts[parts.length - 1]; from = o[last]; o[last] = v;
    }
    else if (t === 'ttmm') {
      const parts = el.dataset.k.split('.'); field = 'TTM by hand: ' + el.dataset.k;
      cur.ttmManual = cur.ttmManual || { rows: {} }; let o = cur.ttmManual;
      for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      const last = parts[parts.length - 1]; from = o[last]; o[last] = v;
      cur.ttmManual.result = DCFAnalysis.manualTTM(cur.ttmManual); if (!cur.ttmManual.result) cur.ttmManual.use = false;
    }
    else if (t === 'tool') { const parts = el.dataset.k.split('.'); let o = toolState(); for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; persist(); setTimeout(render, 0); return; }
    else if (t === 'asof') { const k = el.dataset.k; field = 'asOf.' + k; cur.asOf = cur.asOf || {}; from = cur.asOf[k]; cur.asOf[k] = v; if (k === 'range' && cur.asOf.range && !cur.asOf.price) {} }
    else if (t === 'gc') { gc[el.dataset.k] = v; if (isNum(v) && v < 0) { parseErrors[id] = 'Must be at least 0.'; parseErrors[id + ':raw'] = el.value; } setTimeout(render, 0); return; }
    else if (t === 'sens') { const a = el.dataset.k, i = +el.dataset.i; if (v === null) { render(); return; } cur.sens[a][i] = v; persist(); render(); return; }
    if (from !== v) { DCFModel.logChange(cur, field, s, from, v); }
    if (t === 'in' && cur.defaults && cur.defaults[field]) delete cur.defaults[field];
    persist();
    setTimeout(render, 0);
  }
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.t === 'dilchk') { const parts = el.dataset.k.split('.'); let o = cur.dilution; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; const last = parts[parts.length - 1]; DCFModel.logChange(cur, 'dilution.' + el.dataset.k, null, !!o[last], el.checked); o[last] = el.checked; persist(); render(); return; }
    if (el.dataset && el.dataset.t === 'note') { const k = el.dataset.k, sc = el.dataset.s, f = el.dataset.f; cur.notes = cur.notes || {}; const N = cur.notes[k] = cur.notes[k] || {}; const nn = N[sc] = N[sc] || {}; nn[f] = el.value; nn.saved = new Date().toISOString(); persist(); render(); return; }
    if (el.dataset && el.dataset.pendId) { pendSel = pendSel || {}; pendSel[el.dataset.pendId] = el.checked; if (!Object.keys(pendSel).some(k => pendSel[k] && cur.pending.items.find(p => p.id === k && p.kind === 'override'))) pendConfirm = false; render(); return; }
    if (el.id === 'pend-confirm') { pendConfirm = el.checked; render(); return; }
    if (el.id === 'tm-use') { cur.ttmManual = cur.ttmManual || {}; DCFModel.logChange(cur, 'TTM source', null, cur.ttmManual.use ? 'built by hand' : 'from filings', el.checked ? 'built by hand' : 'from filings'); cur.ttmManual.use = el.checked; persist(); render(); toast(el.checked ? 'Using the TTM you built by hand' : 'Using the TTM calculated from the filings'); return; }
    if (el.id === 'base-timing') { DCFModel.logChange(cur, 'forecast timing', null, cur.timing, el.value); cur.timing = el.value; persist(); render(); toast(el.value === 'dated' ? 'Forecast years now line up with the valuation date' : 'Using the workbook timing'); return; }
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
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.aid) aidOpen[d.dataset.aid] = d.open; }, true);
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
    if (b.dataset.dilMethod) { const m = b.dataset.dilMethod; if (cur.dilution.method === m) return; const from = cur.dilution.method; if (from === 'totals' || !from) cur.dilution.savedTotals = { options: cur.inputs.options, treasury: cur.inputs.treasury }; if (m === 'totals' && cur.dilution.savedTotals) { cur.inputs.options = cur.dilution.savedTotals.options; cur.inputs.treasury = cur.dilution.savedTotals.treasury; } cur.dilution.method = m; if (m === 'proxy' && !cur.dilution.proxy) cur.dilution.proxy = { v: null, period: null }; DCFModel.logChange(cur, 'dilution method', null, from, m); persist(); render(); toast(m === 'totals' ? 'Using the workbook totals' : m === 'simple' ? 'Simple dilution: enter an estimate or value on actual shares' : m === 'proxy' ? 'Reported net dilution: use the latest EPS note figure' : 'Detailed estimate: enter each security'); return; }
    if (b.dataset.pendApply !== undefined) { const ids = Object.keys(pendSel || {}).filter(k => pendSel[k]); const done = DCFData.applyPending(cur, ids, pendConfirm); pendSel = null; pendConfirm = false; persist(); render(); toast(done.length ? `Applied ${done.length} change${done.length > 1 ? 's' : ''}. The old values are in the change log.` : 'Nothing was applied. Tick the rows to apply.'); return; }
    if (b.dataset.pendDismiss !== undefined) { const ids = cur.pending ? cur.pending.items.map(p => p.id) : []; DCFModel.logChange(cur, 'import review', null, null, `kept current values for ${ids.length} field${ids.length === 1 ? '' : 's'}`); DCFData.dismissPending(cur, ids); pendSel = null; pendConfirm = false; persist(); render(); toast('Kept your current values'); return; }
    if (b.dataset.flagsDismiss !== undefined) { cur.importFlags = []; persist(); render(); return; }
    if (b.dataset.ttm) { drawerKey = 'ttm.' + b.dataset.ttm; renderDrawer(); return; }
    if (b.dataset.baseSet) { const m = b.dataset.baseSet; cur.base = cur.base || { mode: 'fy' }; const before = DCFModel.baseInfo(cur), from = cur.base.mode; cur.base.mode = m; const after = DCFModel.baseInfo(cur); DCFModel.logChange(cur, 'forecast base', null, `${from} · ${before.label} · ${isNum(before.rev) ? Math.round(before.rev) : '—'}`, `${m} · ${after.label} · ${isNum(after.rev) ? Math.round(after.rev) : '—'}`); persist(); render(); toast(`Forecast base is now ${after.label}. Base revenue ${nf(before.rev)} → ${nf(after.rev)} $mm. The change is in the log.`); return; }
    if (b.dataset.dilFill) { const SD = cur.shareData || {}, r = SD[b.dataset.dilFill]; if (!r) return; const D = cur.dilution; D.proxy = D.proxy || {}; const from = D.proxy.v; D.proxy.v = r.value; D.proxy.period = r.periodText || null; DCFModel.logChange(cur, 'dilution.proxy.v', null, from, `${r.value} (${r.periodText || ''}, chosen by you)`);
      cur.sources['dil.proxy'] = { name: `${r.form || 'Filing'} EPS calculation`, type: r.form === '10-K' ? '10-K annual report' : '10-Q quarterly report', cat: 'proxy', period: r.periodText || '', accn: r.accn || null, form: r.form || null, filed: r.filed || null, url: r.url || '', end: r.end || null, start: r.start || null, raw: isNum(r.raw) ? r.raw : null, rawUnit: r.rawUnit || null, unit: 'millions of shares', concept: r.concept || null, method: r.cat === 'calc' ? 'Diluted weighted-average shares − basic weighted-average shares for the same period (calculated)' : 'Reported net dilutive effect of stock awards', notes: 'Historical proxy for dilution: already net of the treasury stock method, at that period\'s average share price. Not a current diluted share count.', retrieved: SD.at || null, provider: 'SEC EDGAR XBRL', verified: r.cat !== 'calc', company: cur.inputs.company.name, ticker: cur.inputs.company.ticker };
      persist(); render(); toast(`Using ${r.value} million (${r.periodText || ''}) as the reported net dilution. It is a historical proxy.`); return; }
    if (b.dataset.dilFillAdv !== undefined) { const SD = cur.shareData || {}, D = cur.dilution, filled = []; const bad = k => (cur.importFlags || []).some(f => f.key === 'sh.' + k && f.level === 'bad');
      if (SD.rsu && isNum(SD.rsu.value) && !isNum(D.rsu.n)) { D.rsu.n = SD.rsu.value; filled.push('unvested RSUs (' + SD.rsu.periodText + ')'); }
      if (SD.unrecog && isNum(SD.unrecog.value) && !isNum(D.rsu.unrecog)) { D.rsu.unrecog = SD.unrecog.value; filled.push('unrecognised compensation (' + SD.unrecog.periodText + ')'); }
      if (SD.options && isNum(SD.options.value) && !isNum(D.options[0].n)) { D.options[0].n = SD.options.value; D.options[0].label = D.options[0].label || 'Options outstanding'; filled.push('options (' + SD.options.periodText + ')'); if (SD.optionsK && isNum(SD.optionsK.value) && !isNum(D.options[0].k)) { if (bad('optionsK')) filled.push('exercise price left empty: the tagged value looks mis-scaled'); else D.options[0].k = SD.optionsK.value; } }
      if (filled.length) DCFModel.logChange(cur, 'dilution (filled from filing)', null, null, filled.join('; '));
      persist(); render(); toast(filled.length ? 'Filled ' + filled.join(', ') + '. Check each against the latest filing.' : 'Nothing filled: the boxes already have values, or the filing data does not include them.'); return; }
    if (b.dataset.histRoll !== undefined) { const H = cur.hist, latest = H.years[4]; if (!isNum(latest)) return; cur.histArchive = cur.histArchive || []; cur.histArchive.unshift({ at: new Date().toISOString(), year: H.years[0], values: Object.fromEntries(HIST_FIELDS.map(h => [h.key, H[h.key][0]])) });
      const fromYears = H.years.join(', '); H.years = [...H.years.slice(1), latest + 1]; HIST_FIELDS.forEach(h => { H[h.key] = [...H[h.key].slice(1), null]; const im = cur.imported && cur.imported['hist.' + h.key]; if (im && Array.isArray(im.v)) im.v = [...im.v.slice(1), null]; });
      DCFModel.logChange(cur, 'hist.years', null, fromYears, H.years.join(', ') + ' (shifted; FY' + cur.histArchive[0].year + ' figures kept in the file)'); persist(); render(); toast(`Added an empty FY${latest + 1} column. Fill it from the new 10-K; the forecast waits for it if the base is the latest fiscal year.`); return; }
    if (b.dataset.toolUse) { const k = b.dataset.toolUse, v = Math.round(+b.dataset.v * 1e6) / 1e6, sc = cur.active; const from = cur.inputs[k][sc]; cur.inputs[k][sc] = v; DCFModel.logChange(cur, k, sc, from, v); if (cur.defaults) delete cur.defaults[k]; persist(); render(); toast(`${FBY[k].label} (${sc}) set to ${(v * 100).toFixed(2)}%. The previous value (${isNum(from) ? (from * 100).toFixed(2) + '%' : 'empty'}) is in the change log.`); return; }
    if (b.dataset.suggest) { const k = b.dataset.suggest, v = Math.round(+b.dataset.v * 1e6) / 1e6; const empty = SC.filter(sc => !isNum(cur.inputs[k][sc])); empty.forEach(sc => { DCFModel.logChange(cur, k, sc, null, v); cur.inputs[k][sc] = v; }); if (empty.length && !cur.sources[k]) cur.sources[k] = { name: 'Historical anchor: ' + b.dataset.l, type: 'Own judgment', cat: 'analyst', notes: 'Filled from the historical anchor by your choice. Review it.' }; persist(); render(); toast(empty.length ? `Filled ${empty.join(', ')} with ${plain(fmtVal(k, v))}. Cells you had filled were not changed.` : 'All three scenarios already have values, so nothing was changed.'); return; }
    if (b.dataset.learnToggle !== undefined) { cur.ui = cur.ui || {}; cur.ui.learn = cur.ui.learn === false; persist(); render(); return; }
    if (b.dataset.aidAll) { const open = b.dataset.aidAll === 'open'; document.querySelectorAll('details[data-aid]').forEach(d => { aidOpen[d.dataset.aid] = open; }); render(); return; }
    if (b.dataset.useDilwa !== undefined) { const r = (cur.ref || {}).dilutedWA; if (!r) return; const from = cur.dilution.est; cur.dilution.est = r.v; cur.dilution.ignore = false; DCFModel.logChange(cur, 'dilution.est', null, from, r.v + ' (diluted weighted-average shares, ' + (r.period || '') + ', chosen by you)'); cur.sources['dil.est'] = { name: r.source || 'Filing', type: '10-Q quarterly report', period: r.period || '', notes: 'Diluted weighted-average shares from the EPS calculation, used as an estimate of current diluted shares by your choice. This is a period average, not a period-end count.' }; persist(); render(); toast('Used the filing figure as your estimate. It is a period average, not a current count.'); return; }
    if (b.dataset.gcLoad !== undefined) { gc = gcFromModel(); parseErrors = Object.fromEntries(Object.entries(parseErrors).filter(([k]) => !k.startsWith('gc-'))); render(); toast('Loaded your model\'s figures into the guide calculator. Your DCF inputs are unchanged.'); return; }
    if (b.dataset.gcReset !== undefined) { gc = gcDefaults(); parseErrors = Object.fromEntries(Object.entries(parseErrors).filter(([k]) => !k.startsWith('gc-'))); render(); return; }
    if (b.dataset.scrollTo) { const t = document.getElementById(b.dataset.scrollTo); if (t) { t.scrollIntoView({ block: 'start', behavior: 'smooth' }); if (t.tagName === 'DETAILS') t.open = true; } return; }
    if (b.dataset.confirmDefault) { b.dataset.confirmDefault.split(',').forEach(k => { if (cur.defaults && cur.defaults[k]) { delete cur.defaults[k]; DCFModel.logChange(cur, k, null, null, 'kept default (' + (FBY[k].tri ? SC.map(x => cur.inputs[k][x]).join(' / ') : cur.inputs[k]) + ')'); } }); persist(); render(); toast('Defaults confirmed'); return; }
    if (b.dataset.reviewGroup) { const g = b.dataset.reviewGroup; FIELDS.filter(f => f.group === g && f.kind === 'forecast').forEach(f => cur.reviewed[f.key] = true); DCFModel.logChange(cur, 'reviewed section', null, null, GROUPS[g].title); persist(); render(); return; }
    if (b.dataset.dismissImport !== undefined) { importStatus = null; render(); return; }
    if (b.dataset.focusSearch !== undefined) { const i = $('#co-search'); if (i) { i.focus(); searchState.open = true; renderSearchResults(); } return; }
    if (b.dataset.goPage) { location.hash = b.dataset.goPage; return; }
    if (b.id === 'cfg-save') {
      const c = dataCfg(); const r = document.querySelector('input[name="prov"]:checked'); if (r) c.provider = r.value;
      document.querySelectorAll('[data-key]').forEach(i => { const v = i.value.trim(); if (v) c.keys[i.dataset.key] = v; else delete c.keys[i.dataset.key]; });
      c.remember = $('#cfg-remember').checked; saveDataCfg();
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
      if (k === 'dilution' || k.startsWith('dil.')) return goField('company', 'f-dilution-v');
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
    cur = withAnalyst(DCFModel.blank()); persist(); setCurrent(); importStatus = null; dashTab = 'key';
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
