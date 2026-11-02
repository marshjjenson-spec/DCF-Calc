// ===== THREE-STATEMENT MODEL: USER INTERFACE =====
// A separate modelling workspace inside DCF Pro, reached at #fsm. Its own navigation, saved models and storage key.
// It reads DCF models only to copy company details and, when the analyst asks, to link its forecast to a DCF.
// No financial formula lives here: calculations are in FsmEngine; imports in FsmData.
const FsmApp = (() => {
  const E = FsmEngine, D = FsmData, M = FsmModel, H = FsmHelp;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNum = E.isNum, SC = E.SC, N = E.N;
  const active = () => /^#fsm(\/|$)/.test(location.hash);
  const PAGES = [
    { id: 'dashboard', title: 'Three-Statement dashboard', grp: 'Overview', icon: 'home' },
    { id: 'company', title: 'Company selection', grp: 'Overview', icon: 'building' },
    { id: 'historical', title: 'Historical financial data', grp: 'Overview', icon: 'db' },
    { id: 'assumptions', title: 'Forecast assumptions', grp: 'Overview', icon: 'sliders' },
    { id: 'is', title: 'Income statement', grp: 'Financial statements', icon: 'bars' },
    { id: 'bs', title: 'Balance sheet', grp: 'Financial statements', icon: 'layers' },
    { id: 'cf', title: 'Cash flow statement', grp: 'Financial statements', icon: 'trend' },
    { id: 'revenue', title: 'Revenue & operating expenses', grp: 'Supporting schedules', icon: 'pct' },
    { id: 'nwc', title: 'Working capital', grp: 'Supporting schedules', icon: 'calc' },
    { id: 'ppe', title: 'CapEx & PP&E', grp: 'Supporting schedules', icon: 'building' },
    { id: 'da', title: 'Depreciation & amortization', grp: 'Supporting schedules', icon: 'trend' },
    { id: 'debt', title: 'Debt & interest', grp: 'Supporting schedules', icon: 'list' },
    { id: 'tax', title: 'Taxes & deferred taxes', grp: 'Supporting schedules', icon: 'pct' },
    { id: 'equity', title: 'Equity, SBC & shares', grp: 'Supporting schedules', icon: 'target' },
    { id: 'ratios', title: 'Financial ratios', grp: 'Analysis', icon: 'grid' },
    { id: 'scenarios', title: 'Bear, Base & Bull scenarios', grp: 'Analysis', icon: 'layers' },
    { id: 'reconciliation', title: 'Model reconciliation', grp: 'Analysis', icon: 'check' },
    { id: 'dcf', title: 'DCF integration', grp: 'Analysis', icon: 'flag' },
    { id: 'sources', title: 'Sources & research notes', grp: 'Analysis', icon: 'book' },
    { id: 'saved', title: 'Saved models', grp: 'Analysis', icon: 'folder' },
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
  const NA = '<span class="na">—</span>';
  const fmt = (v, u) => {
    if (!isNum(v)) return NA;
    if (u === 'pct') return `<span class="${v < 0 ? 'neg' : ''}">${(v * 100).toFixed(1)}%</span>`;
    if (u === 'days') return v.toFixed(1);
    if (u === 'x') return v.toFixed(2) + '×';
    if (u === 'ps') return v < 0 ? `<span class="neg">(${nf(2).format(-v)})</span>` : nf(2).format(v);
    if (u === 'sh') return nf(1).format(v);
    if (u === 'chk') return Math.abs(v) < 0.005 ? '0.00' : `<span class="neg">${nf(2).format(v)}</span>`;
    const r = Math.abs(v) < 0.5 ? 0 : v;
    return r < 0 ? `<span class="neg">(${nf(0).format(-r)})</span>` : nf(0).format(r);
  };
  const plain = s => String(s).replace(/<[^>]+>/g, '');
  const toIn = (v, u) => !isNum(v) ? '' : u === 'pct' ? String(+(v * 100).toFixed(4)) : String(+v.toFixed(4));
  function parse(str, u) {
    const s = String(str).trim(); if (s === '') return { v: null };
    let t = s.replace(/[,$\s×x%]/gi, ''); let neg = false; if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { error: `"${s}" is not a number.` };
    let n = Number(t) * (neg ? -1 : 1); if (u === 'pct') n /= 100; return { v: n };
  }
  const CAT = { sec: ['SEC', 'Reported in an SEC filing (XBRL company facts)'], calc: ['Calc', 'Calculated from reported figures'], vendor: ['FMP', 'Provider-standardised statement (Financial Modeling Prep)'], manual: ['Manual', 'Entered by the analyst'], market: ['Mkt', 'Market data'] };

  // ---------- state ----------
  let models = {}, cur = null, booted = false;
  let drawer = null, modal = null, msg = null, busy = null, confirmDel = null, errs = {};
  const ui = { open: {}, search: { q: '', results: [], open: false }, dcfSel: null, histSt: 'IS', sens: null };
  let cache = null;
  function persist() { if (!cur) return; cache = null; if (!M.save(cur)) toast('Could not save in this browser storage. Use "Save model file" on Saved models.'); models = M.loadAll(); M.setCurrent(cur.id); }
  function change(field, from, to) { M.log(cur, field, from, to); persist(); }
  function toast(t) { let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); } const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; box.appendChild(el); setTimeout(() => el.remove(), 3600); }
  function page() { const m = /^#fsm\/?([a-z]*)/.exec(location.hash); const id = (m && m[1]) || 'dashboard'; return PAGES.find(p => p.id === id) ? id : 'dashboard'; }
  const link = (id, text) => `<a href="#fsm/${id}">${text}</a>`;
  const hb = k => H.G[k] ? `<button class="help" data-fhelp="${k}" aria-label="Guide: ${esc(H.G[k].t)}">?</button>` : '';
  function dataCfg() { let c = null; try { c = JSON.parse(localStorage.getItem('dcfcalc.data')); } catch (e) {} return Object.assign({ provider: 'fmp', keys: {}, remember: true }, c || {}); }
  let memKey = null;
  const fmpKey = () => memKey || dataCfg().keys.fmp || null;
  function saveKey(k, remember) { const c = dataCfg(); c.provider = 'fmp'; c.keys = Object.assign({}, c.keys, { fmp: k }); c.remember = remember; try { localStorage.setItem('dcfcalc.data', JSON.stringify(remember ? c : Object.assign({}, c, { keys: {} }))); } catch (e) {} memKey = k; }
  const scen = () => cur.ui.scen || 'Base';
  function calc() {
    if (cache) return cache;
    const runs = {}; SC.forEach(s => { runs[s] = E.run(cur, s); });
    const comp = M.completion(cur);
    const refs = M.references(cur);
    cache = { runs, comp, refs, r: runs[scen()] };
    return cache;
  }

  // ---------- columns ----------
  function cols() {
    const h = cur.hist; const b = E.basePeriod(cur);
    const hist = h.periods.map(p => ({ id: p.id, label: p.label, sub: p.end, kind: 'hist' }));
    const ttm = h.ttm ? [{ id: 'TTM', label: 'TTM', sub: h.ttm.end, kind: 'ttm' }] : [];
    const fc = [];
    if (b) {
      const end = new Date(b.end + 'T00:00:00Z');
      for (let t = 1; t <= N; t++) {
        const d = new Date(Date.UTC(end.getUTCFullYear() + t, end.getUTCMonth(), end.getUTCDate()));
        const lab = b.kind === 'FY' ? 'FY' + (Number(String(cur.hist.periods[cur.hist.periods.length - 1].label).replace(/\D/g, '')) + t) + 'E' : 'NTM' + t;
        fc.push({ id: 'F' + t, t, label: lab, sub: '12m to ' + d.toISOString().slice(0, 7), kind: 'fc' });
      }
    }
    return { hist, ttm, fc, b };
  }
  function head(c, extra = '') {
    return `<thead><tr><th>${extra}</th>${c.hist.map(x => `<th class="hist" title="Historical fiscal year (reported)">${esc(x.label)}<small>${esc(x.sub)}</small></th>`).join('')}${c.ttm.map(x => `<th class="ttmc" title="Trailing twelve months: a reference column, not a fiscal year">${esc(x.label)}<small>${esc(x.sub)}</small></th>`).join('')}${c.fc.map(x => `<th class="fc" title="Forecast (${esc(scen())} scenario)">${esc(x.label)}<small>${esc(x.sub)}</small></th>`).join('')}</tr></thead>`;
  }

  // ---------- statement rows ----------
  // each row: [label, histFn(o) | null, fcFn(y) | null, opts]
  const neg = v => isNum(v) ? -v : null;
  function hv(pid) { return E.histPeriod(cur.hist, pid, cur.settings); }
  const histCellSrc = (k, pid) => cur.hist.cells[k] && cur.hist.cells[k][pid];
  function tableRows(defs) {
    const c = cols(), { r } = calc();
    const hs = c.hist.concat(c.ttm).map(x => ({ x, o: hv(x.id) }));
    const body = defs.map(d => {
      if (d.sec) return `<tr class="sec"><td colspan="${1 + hs.length + c.fc.length}">${esc(d.sec)}</td></tr>`;
      if (d.expand && cur.settings.layout !== 'expanded') return '';
      const u = d.u || 'mm';
      const histTd = hs.map(({ x, o }) => {
        const v = d.h ? d.h(o) : null;
        const ck = d.ck && histCellSrc(d.ck, x.id);
        const cat = ck && ck.src ? (ck.manual ? 'manual' : ck.src.cat) : d.h && isNum(v) ? 'calc' : null;
        return `<td class="${x.kind === 'ttm' ? 'ttmc' : 'hist'} ${cat ? 'v-' + cat : isNum(v) ? '' : 'v-miss'}">${d.ck || isNum(v) ? `<button class="cellbtn" data-fcell="${d.ck || d.k || ''}|${x.id}|${esc(d.l)}">${fmt(v, u)}</button>` : fmt(v, u)}</td>`;
      }).join('');
      const fcTd = c.fc.map((x, i) => { const y = r && r.ok ? r.years[i] : null; const v = y && d.f ? d.f(y) : null; return `<td class="fc">${y && d.tr ? `<button class="cellbtn" data-finsp="${d.tr}|${i}|${esc(d.l)}">${fmt(v, u)}</button>` : fmt(v, u)}</td>`; }).join('');
      return `<tr class="${d.cls || ''}"><td>${esc(d.l)} ${d.help ? hb(d.help) : ''}</td>${histTd}${fcTd}</tr>`;
    }).join('');
    return `<div class="tbl-wrap fs-wrap ${cur.settings.freeze ? '' : 'nofreeze'}"><table class="fin fs-table">${head(c, '$ millions')}<tbody>${body}</tbody></table></div>`;
  }
  const emb = () => cur.settings.daPresentation !== 'separate';
  const IS_ROWS = () => [
    { sec: 'Revenue and gross profit' },
    { l: 'Revenue', k: 'rev', ck: 'rev', h: o => o.rev, f: y => y.rev, tr: 'rev', cls: 'key', help: 'rev' },
    { l: 'Revenue growth', u: 'pct', h: null, f: y => y.g, cls: 'sub' },
    { l: 'Cost of revenue', ck: 'cogs', h: o => neg(o.cogs), f: y => -y.cogs, help: 'cogs' },
    { l: 'Gross profit', h: o => o.gp, f: y => y.gp, cls: 'total', help: 'gp' },
    { l: 'Gross margin', u: 'pct', h: o => o.gm, f: y => y.gm, cls: 'sub' },
    { sec: 'Operating expenses' },
    { l: 'Research & development', ck: 'rnd', h: o => neg(o.rnd), f: y => -y.rnd, help: 'rnd' },
    { l: 'Selling, general & administrative', ck: 'sga', h: o => neg(o.sga), f: y => -y.sga, help: 'sga' },
    { l: 'Other operating expenses', ck: 'oth', h: o => neg(o.oth), f: y => -y.oth, help: 'oth' },
    { l: 'of which: not separately tagged by the company (reported costs − tagged lines)', h: o => neg(o.unclassOpex), f: null, cls: 'sub', expand: true },
    { l: 'Depreciation & amortization (separate line)', h: null, f: y => emb() ? null : -y.da, cls: emb() ? 'sub' : '' },
    { l: 'Total operating expenses', h: o => neg(o.opex), f: y => -y.opex, cls: 'total' },
    { l: 'Operating income (EBIT)', ck: 'ebit', h: o => o.ebit, f: y => y.ebit, tr: 'ebit', cls: 'key', help: 'ebit' },
    { l: 'EBIT margin', u: 'pct', h: o => isNum(o.ebit) && o.rev ? o.ebit / o.rev : null, f: y => y.ebit / y.rev, cls: 'sub' },
    { l: emb() ? 'Memo: D&A included in the costs above (not subtracted again)' : 'Memo: D&A', ck: 'da', h: o => o.da, f: y => y.da, tr: 'dep', cls: 'sub', help: 'da' },
    { l: 'EBITDA (EBIT + D&A)', h: o => o.ebitda, f: y => y.ebitda, tr: 'ebitda', cls: 'total', help: 'ebitda' },
    { sec: 'Below operating income' },
    { l: 'Interest income', ck: 'intInc', h: o => o.intInc, f: y => y.intInc, tr: 'intInc', help: 'intInc' },
    { l: 'Interest expense', ck: 'intExp', h: o => neg(o.intExp), f: y => -y.intExp, tr: 'intExp', help: 'intExp' },
    { l: 'Other nonoperating income (expense)', ck: 'nonop', h: o => o.nonop, f: y => y.nonop, help: 'nonop' },
    { l: 'Pretax income', ck: 'pbt', h: o => o.pbt, f: y => y.pbt, cls: 'total', help: 'pbt' },
    { l: 'Income tax expense', ck: 'tax', h: o => neg(o.tax), f: y => -y.tax, tr: 'tax', help: 'tax' },
    { l: 'Effective tax rate', u: 'pct', h: o => isNum(o.tax) && o.pbt ? o.tax / o.pbt : null, f: y => y.etr, cls: 'sub' },
    { l: 'Equity-method investment income, net of tax', ck: 'eqinc', h: o => o.eqinc, f: y => y.eqinc },
    { l: 'Net income', ck: 'ni', h: o => o.ni, f: y => y.ni, cls: 'key', help: 'ni' },
    { l: 'Attributable to noncontrolling interests', ck: 'niNci', h: o => neg(o.niNci), f: y => -y.niNci, cls: 'sub' },
    { l: 'Net income attributable to the company', ck: 'niParent', h: o => o.niParent, f: y => y.niParent },
    { l: 'Preferred dividends and other adjustments', h: o => neg(o.prefDiv), f: y => -y.prefDiv, cls: 'sub' },
    { l: 'Net income attributable to common shareholders', ck: 'niCommon', h: o => o.niCommon, f: y => y.niCommon, cls: 'total', help: 'niCommon' },
    { sec: 'Per share' },
    { l: 'Weighted-average basic shares (mm)', u: 'sh', ck: 'waBasic', h: o => o.waBasic, f: y => y.waBasic, help: 'waBasic' },
    { l: 'Weighted-average diluted shares (mm)', u: 'sh', ck: 'waDil', h: o => o.waDil, f: y => y.waDil, help: 'waDil' },
    { l: 'Basic EPS', u: 'ps', ck: 'epsBasic', h: o => o.epsBasic, f: y => y.epsBasic, help: 'eps' },
    { l: 'Diluted EPS', u: 'ps', ck: 'epsDil', h: o => o.epsDil, f: y => y.epsDil, help: 'eps' },
    { l: 'Memo: stock-based compensation (inside the costs above)', ck: 'sbc', h: o => o.sbc, f: y => y.sbc, cls: 'sub', help: 'sbc' },
    { l: 'Check: EBIT − (gross profit − operating expenses as shown)', u: 'chk', h: null, f: y => y.presCheck, cls: 'sub chk', expand: true },
  ];
  const BS_ROWS = () => [
    { sec: 'Assets' },
    { l: 'Cash and cash equivalents', ck: 'cash', h: o => o.cash, f: y => y.cash, help: 'cash' },
    { l: 'Short-term investments', ck: 'sti', h: o => o.sti, f: y => y.sti, help: 'sti' },
    { l: 'Accounts receivable', ck: 'ar', h: o => o.ar, f: y => y.ar, tr: 'ar', help: 'ar' },
    { l: 'Inventory', ck: 'inv', h: o => o.inv, f: y => y.inv, tr: 'inv', help: 'inv' },
    { l: 'Other current assets', ck: 'oca', h: o => o.oca, f: y => y.oca, help: 'oca' },
    { l: 'Total current assets', h: o => o.tcaCalc, f: y => y.tca, cls: 'total' },
    { l: 'Property, plant & equipment, net', ck: 'ppe', h: o => o.ppe, f: y => y.ppe, tr: 'ppe', help: 'ppe' },
    { l: 'Operating lease right-of-use assets', ck: 'rou', h: o => o.rou, f: y => y.rou, help: 'rou' },
    { l: 'Goodwill', ck: 'gw', h: o => o.gw, f: y => y.gw, help: 'gw' },
    { l: 'Intangible assets, net', ck: 'intang', h: o => o.intang, f: y => y.intang, help: 'intang' },
    { l: 'Deferred tax assets', ck: 'dta', h: o => o.dta, f: y => y.dta, help: 'dta' },
    { l: 'Other long-term assets', ck: 'olta', h: o => o.olta, f: y => y.olta, help: 'olta' },
    { l: 'Total assets', ck: 'ta', h: o => o.taCalc, f: y => y.ta, cls: 'key' },
    { sec: 'Liabilities' },
    { l: 'Accounts payable', ck: 'ap', h: o => o.ap, f: y => y.ap, tr: 'ap', help: 'ap' },
    { l: 'Accrued operating liabilities', ck: 'accr', h: o => o.accr, f: y => y.accr, help: 'accr' },
    { l: 'Deferred revenue', ck: 'defrev', h: o => o.defrev, f: y => y.defrev, help: 'defrev' },
    { l: 'Short-term debt (incl. revolver)', ck: 'std', h: o => o.std, f: y => y.std, help: 'std' },
    { l: 'Current portion of long-term debt', ck: 'cltd', h: o => o.cltd, f: y => y.cltd, help: 'cltd' },
    { l: 'Other current liabilities', ck: 'ocl', h: o => o.ocl, f: y => y.ocl, help: 'ocl' },
    { l: 'Total current liabilities (excl. current lease liabilities)', h: o => o.tclCalc, f: y => y.tcl, cls: 'total' },
    { l: 'Long-term debt', ck: 'ltd', h: o => o.ltd, f: y => y.ltd, help: 'ltd' },
    { l: 'Operating lease liabilities (current + noncurrent)', ck: 'opl', h: o => o.opl, f: y => y.opl, help: 'opl' },
    { l: 'Finance lease liabilities (current + noncurrent)', ck: 'finl', h: o => o.finl, f: y => y.finl, help: 'finl' },
    { l: 'Deferred tax liabilities', ck: 'dtl', h: o => o.dtl, f: y => y.dtl, help: 'dtl' },
    { l: 'Other long-term liabilities', ck: 'oltl', h: o => o.oltl, f: y => y.oltl, help: 'oltl' },
    { l: 'Total liabilities', ck: 'tl', h: o => o.tlCalc, f: y => y.tl, cls: 'key' },
    { sec: 'Equity' },
    { l: 'Common stock', ck: 'cs', h: o => o.cs, f: y => y.cs },
    { l: 'Additional paid-in capital', ck: 'apic', h: o => o.apic, f: y => y.apic, help: 'apic' },
    { l: 'Retained earnings', ck: 're', h: o => o.re, f: y => y.re, help: 're' },
    { l: 'Treasury stock', ck: 'treas', h: o => neg(o.treas), f: y => -y.treas, help: 'treas' },
    { l: 'Accumulated other comprehensive income', ck: 'aoci', h: o => o.aoci, f: y => y.aoci, help: 'aoci' },
    { l: 'Other equity (incl. preferred stock)', ck: 'oeq', h: o => o.oeq, f: y => y.oeq },
    { l: 'Noncontrolling interests', ck: 'nci', h: o => o.nci, f: y => y.nci, help: 'nci' },
    { l: 'Total equity', ck: 'te', h: o => o.teCalc, f: y => y.te, cls: 'key' },
    { l: 'Total liabilities and equity', h: o => isNum(o.tlCalc) && isNum(o.teCalc) ? o.tlCalc + o.teCalc : null, f: y => y.tle, cls: 'total' },
    { l: 'Balance check (assets − liabilities − equity)', u: 'chk', h: o => o.bsCheck, f: y => y.check, cls: 'chk', help: 'bscheck' },
    { l: 'Reported total assets (filing)', ck: 'ta', h: o => o.ta, f: null, cls: 'sub', expand: true },
    { l: 'Reported total current liabilities (filing; includes current lease liabilities)', ck: 'tcl', h: o => o.tcl, f: null, cls: 'sub', expand: true },
  ];
  const CF_ROWS = () => [
    { sec: 'Operating activities' },
    { l: 'Net income (including noncontrolling interests)', ck: 'ni', h: o => o.ni, f: y => y.ni },
    { l: 'Depreciation & amortization', ck: 'da', h: o => o.da, f: y => y.da, help: 'da' },
    { l: 'Stock-based compensation', ck: 'sbc', h: o => o.sbc, f: y => y.sbc, help: 'sbc' },
    { l: 'Deferred income taxes', ck: 'defTax', h: o => o.defTax, f: y => y.defTax, help: 'deftax' },
    { l: 'Changes in operating working capital', h: o => o.dNwcCf, f: y => y.dNwcCf, help: 'dnwc' },
    { l: 'Other noncash adjustments', ck: 'otherNoncash', h: o => o.otherNoncash, f: y => y.otherCfo },
    { l: 'Net cash from operating activities', ck: 'cfo', h: o => o.cfo, f: y => y.cfo, cls: 'key', help: 'cfo' },
    { sec: 'Investing activities' },
    { l: 'Capital expenditures', ck: 'capex', h: o => neg(o.capex), f: y => y.capexCf, help: 'capex' },
    { l: 'Acquisitions, net of cash acquired', ck: 'acq', h: o => neg(o.acq), f: y => y.acqCf, help: 'acq' },
    { l: 'Purchases and sales of investments, net', ck: 'invNet', h: o => o.invNet, f: y => y.invCf },
    { l: 'Other investing activities', h: o => o.otherCfi, f: y => y.otherCfi },
    { l: 'Net cash from investing activities', ck: 'cfi', h: o => o.cfi, f: y => y.cfi, cls: 'key' },
    { sec: 'Financing activities' },
    { l: 'Debt issuance (incl. revolver draws)', ck: 'debtIss', h: o => o.debtIss, f: y => y.debtIss },
    { l: 'Debt repayment (incl. revolver repayments)', ck: 'debtRep', h: o => neg(o.debtRep), f: y => y.debtRep },
    { l: 'Share repurchases', ck: 'buyback', h: o => neg(o.buyback), f: y => y.buybackCf, help: 'buyback' },
    { l: 'Share issuance', ck: 'issue', h: o => o.issue, f: y => y.issueCf },
    { l: 'Dividends (common, preferred, noncontrolling)', ck: 'div', h: o => neg(o.div), f: y => y.divCf, help: 'div' },
    { l: 'Finance lease principal payments', ck: 'leasePrin', h: o => neg(o.leasePrin), f: y => y.leaseCf, help: 'finl' },
    { l: 'Other financing activities', h: o => o.otherCff, f: y => y.otherCff },
    { l: 'Net cash from financing activities', ck: 'cff', h: o => o.cff, f: y => y.cff, cls: 'key' },
    { sec: 'Cash reconciliation' },
    { l: 'Effect of exchange rates on cash', ck: 'fx', h: o => o.fx, f: y => y.fx },
    { l: 'Net change in cash', ck: 'dCash', h: o => o.dCash, f: y => y.dCash, cls: 'total' },
    { l: 'Beginning cash', h: null, f: y => y.cashBeg },
    { l: 'Ending cash (flows to the balance sheet)', ck: 'cashEndCF', h: o => o.cashEndCF, f: y => y.cashEnd, cls: 'key' },
    { l: 'Check: CFO + CFI + CFF + FX − change in cash', u: 'chk', h: o => o.cfCheck, f: y => y.cashEnd - y.cashBeg - y.dCash, cls: 'chk' },
    { sec: 'Free cash flow (valuation definitions)' },
    { l: 'Free cash flow to the firm (FCFF)', h: null, f: y => y.fcff, tr: 'fcff', cls: 'key', help: 'fcff' },
    { l: 'Memo: CFO − CapEx (reported-style; not FCFF)', h: o => isNum(o.cfo) && isNum(o.capex) ? o.cfo - o.capex : null, f: y => y.cfoLessCapex, cls: 'sub' },
  ];

  // ---------- small building blocks ----------
  function panel(title, body, opts = {}) { return `<section class="panel ${opts.cls || ''}">${title ? `<div class="panel-head"><h2>${title}${opts.help ? ' ' + hb(opts.help) : ''}</h2>${opts.right || ''}</div>` : ''}${body}</section>`; }
  const pill = (level, text) => `<span class="pill ${level === 'fail' || level === 'bad' ? 'bad' : level === 'warn' ? 'warn' : level === 'pass' || level === 'good' ? 'good' : 'neutral'}">${esc(text)}</span>`;
  const learn = text => cur.ui.learn ? `<div class="cx-learn"><b>How this works.</b> ${text}</div>` : '';
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;
  function notes(key, title) {
    const v = cur.notes[key] || ''; const k = 'n-' + key;
    return `<details class="cx-notes" data-k="${k}" ${ui.open[k] || v ? 'open' : ''}><summary>My research notes${title ? ': ' + esc(title) : ''}${v ? ' <span class="tag src">saved</span>' : ''}</summary><textarea data-fnote="${esc(key)}" rows="3" placeholder="Optional. Why you chose this, the source, your calculation, the risks.">${esc(v)}</textarea></details>`;
  }
  function setSel(path, options, label, helpK) {
    const v = getPath(path);
    return `<label class="fs-set">${esc(label)} ${helpK ? hb(helpK) : ''}<span class="inwrap"><select data-fset="${path}">${options.map(([a, b]) => opt(a, b, v)).join('')}</select></span></label>`;
  }
  function setNum(path, label, u, helpK, ph) {
    const v = getPath(path); const id = 'fs_' + path.replace(/\./g, '_'); const e = errs[id];
    return `<label class="fs-set">${esc(label)} ${helpK ? hb(helpK) : ''}<span class="inwrap"><input id="${id}" data-fnum="${path}" data-u="${u || 'mm'}" value="${e ? esc(e.text) : toIn(v, u)}" placeholder="${esc(ph || 'required')}" inputmode="decimal" class="${e ? 'err' : ''}"></span>${u === 'pct' ? '<span class="footnote">%</span>' : ''}${e ? `<span class="errmsg">${esc(e.msg)}</span>` : ''}</label>`;
  }
  function getPath(p) { return p.split('.').reduce((o, k) => o == null ? o : o[k], cur); }
  function setPath(p, v) { const ks = p.split('.'); const last = ks.pop(); const o = ks.reduce((a, k) => a[k], cur); o[last] = v; }

  // assumption rows: one driver, ten years, with historical references
  function asmRows(keys, opts = {}) {
    const { refs } = calc(); const c = cols(); const s = scen();
    const hs = c.hist.concat(c.ttm);
    const rows = keys.map(k => {
      const d = E.DBY[k]; if (!d) return '';
      if (d.when && !d.when(cur)) return '';
      const shared = !d.sc;
      const arr = shared ? cur.shared[k] : cur.asm[s][k];
      const u = d.u === 'pct' ? 'pct' : d.u === 'days' ? 'days' : d.u === 'sh' ? 'sh' : 'mm';
      const rk = { maint: 'capex', gcapex: 'capex', dep: cur.settings.depMethod === 'pctPPE' ? 'depPPE' : 'dep', flRate: 'intRate', div: 'payout' }[k] || k;
      const ref = refs[rk];
      const refTd = hs.map(x => { const v = ref ? (x.id === 'TTM' ? ref.ttm : (ref.years.find(y => y.id === x.id) || {}).v) : null; return `<td class="${x.kind === 'ttm' ? 'ttmc' : 'hist'} ref">${ref ? fmt(v, u === 'mm' ? 'mm' : u) : ''}</td>`; }).join('');
      const inputs = c.fc.map((x, i) => { const id = `fa_${k}_${shared ? 'SH' : s}_${i}`; const e = errs[id]; return `<td class="fc"><input id="${id}" data-fa="${k}|${shared ? 'SH' : s}|${i}" data-u="${u}" value="${e ? esc(e.text) : toIn(arr[i], u)}" placeholder="—" inputmode="decimal" class="${e ? 'err' : ''}" aria-label="${esc(d.l)}, ${esc(x.label)}"></td>`; }).join('');
      const rev = cur.reviewed[k] === false ? ' <span class="tag memo">from history: review</span>' : '';
      const avg = ref && isNum(ref.avg3) ? `3-yr avg ${plain(fmt(ref.avg3, u))}` : '';
      return `<tr><td><div class="fs-dl">${esc(d.l)} ${hb('a_' + k) || hb(k)}${shared ? ' <span class="tag">all scenarios</span>' : ''}${rev}</div>
        <div class="fs-tools"><button class="btn tiny" data-ftool="fill|${k}">Set all years</button><button class="btn tiny" data-ftool="interp|${k}">Interpolate Y1→Y10</button>${shared ? '' : `<button class="btn tiny" data-ftool="copybase|${k}">Copy from Base</button>`}${ref ? `<button class="btn tiny" data-ftool="hist|${k}">Use 3-yr avg</button>` : ''}${cur.reviewed[k] === false ? `<button class="btn tiny" data-ftool="ok|${k}">Mark reviewed</button>` : ''} <span class="footnote">${avg}</span></div></td>${refTd}${inputs}</tr>`;
    }).join('');
    return `<div class="tbl-wrap fs-wrap"><table class="fin fs-table fs-asm">${head(c, opts.title || `Assumption (${s})`)}<tbody>${rows}</tbody></table></div>
      <p class="footnote">Grey columns show the historical reference ratio for each year (calculated from the imported statements). Blue cells are your forecast inputs for the <b>${esc(s)}</b> scenario; rows tagged "all scenarios" are shared financing and policy inputs. Percentages are entered as numbers (12 = 12%).</p>`;
  }

  // ---------- top bar and rail ----------
  function renderTop() {
    const top = document.getElementById('topbar');
    if (top.dataset.owner !== 'fsm') {
      top.dataset.owner = 'fsm';
      top.innerHTML = `<div class="hdr-main">
        <button class="hbtn menu-btn" id="fs-menu" aria-label="Open sections">${icon('list')}</button>
        <div class="brand">${icon('logo', 'logo')}<div><b>DCF Pro</b><small>Financial Valuation Platform</small></div></div>
        <div class="hdr-title"><b>Three-Statement Model</b><small>Linked income statement, balance sheet and cash flow forecast with supporting schedules</small></div>
        <div class="search" role="search"><label class="sr" for="fs-search">Import company by ticker</label>
          <div class="search-box">${icon('search')}<input id="fs-search" type="search" autocomplete="off" placeholder="Company ticker or name…"></div>
          <div class="search-sel" id="fs-sel"></div><div id="fs-results" class="search-results" role="listbox" hidden></div></div>
        <div class="hdr-actions">
          <button class="hbtn primary" id="fs-save">${icon('save')}<span>Save Model</span></button>
          <button class="hbtn accent" id="fs-new">${icon('plus')}<span>New Model</span></button>
          <div class="theme-toggle" role="group" aria-label="Colour theme"><button data-fs-theme="light" aria-label="Light mode">${icon('sun')}</button><button data-fs-theme="dark" aria-label="Dark mode">${icon('moon')}</button></div>
        </div></div><div class="hdr-sub" id="fs-sub"></div>`;
    }
    const theme = document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    top.querySelectorAll('[data-fs-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fsTheme === theme)));
    const co = cur.company;
    top.querySelector('#fs-sel').innerHTML = co.name || co.ticker ? `<span class="chip">${esc((co.name || '') + (co.ticker ? ' (' + co.ticker + ')' : ''))}</span>` : '<span class="chip muted">No company selected</span>';
    renderResults();
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated)); if (!models[cur.id]) list.unshift(cur);
    const { runs } = calc();
    const st = SC.map(s => { const r = runs[s]; const f = r.ok ? r.checks.filter(c => c.status === 'fail').length : null; return `<span class="pill ${!r.ok ? 'neutral' : f ? 'bad' : 'good'}" title="${s}: ${!r.ok ? 'assumptions incomplete' : f ? f + ' failing check(s)' : 'all checks pass'}">${s[0]}${r.ok ? (f ? ' ✕' : ' ✓') : ' …'}</span>`; }).join('');
    $('#fs-sub').innerHTML = `<div class="seg model-switch" role="group" aria-label="Valuation model"><a href="#dashboard">Discounted Cash Flow</a><a href="#comps">Trading Comps</a><a href="#fsm" aria-current="true">Three-Statement Model</a></div>
      <div class="model-pick"><label for="fs-model" class="footnote">Model</label><select id="fs-model" class="plain">${list.map(m => opt(m.id, m.name, cur.id)).join('')}</select></div>
      <div class="seg" role="group" aria-label="Scenario">${SC.map(s => `<button data-fscen="${s}" aria-pressed="${s === scen()}">${s}</button>`).join('')}</div>
      <button class="btn ghost" id="fs-data">${icon('db')} Data source: ${fmpKey() ? 'Financial Modeling Prep' : 'SEC files'}</button>
      <div class="live"><div><div class="lbl">Checks</div><div>${st}</div></div></div>`;
  }
  function renderResults() {
    const box = document.getElementById('fs-results'); if (!box) return;
    const S = ui.search;
    if (!S.open) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    let h = '';
    if (!fmpKey()) h = `<div class="sr-note">Connect Financial Modeling Prep to search and import by ticker, or load the SEC company facts file on ${link('company', 'Company selection')}.<br><button class="btn primary" data-fs-open-data>Connect a data source</button></div>`;
    else if (S.busy) h = '<div class="sr-note">Searching…</div>';
    else if (S.error) h = `<div class="sr-note bad">${esc(S.error)}</div>`;
    else if (S.results.length) h = S.results.map(r => `<button role="option" data-fs-import="${esc(r.symbol)}"><b>${esc(r.symbol)}</b><span>${esc(r.name)}</span><small>${esc(r.exchange)}</small></button>`).join('');
    else if (S.q) h = `<div class="sr-note">Press Enter to import “${esc(S.q.toUpperCase())}”.</div>`;
    box.innerHTML = h;
  }
  function renderRail() {
    const { comp } = calc();
    const st = { company: 'company', historical: 'company', assumptions: 'assumptions', reconciliation: 'checks', sources: 'docs' };
    let h = '', grp = '';
    PAGES.forEach(p => {
      if (p.grp !== grp) { grp = p.grp; h += `<h4>${grp}</h4>`; }
      const s = st[p.id] && comp.sections.find(x => x.id === st[p.id]);
      const badge = s ? `<span class="pct ${s.status === 'complete' ? 'done' : ''}">${s.status === 'complete' ? '✓' : Math.round(s.done / s.total * 100) + '%'}</span>` : '';
      h += `<a href="#fsm/${p.id}" ${page() === p.id ? 'aria-current="page"' : ''}>${icon(p.icon)}<span class="t">${p.title}</span>${badge}</a>`;
    });
    h += `<h4>Other models</h4><a href="#dashboard">${icon('calc')}<span class="t">Discounted Cash Flow</span></a><a href="#comps">${icon('grid')}<span class="t">Trading Comps</span></a>`;
    $('#rail').innerHTML = h;
  }
  function pageHead(title, lead, right = '') {
    const c = cols();
    return `<div class="fs-head"><div><h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div><div class="fs-hr">${right}${c.b ? `<span class="pill neutral">Forecast from ${esc(c.b.label)}</span>` : ''}<span class="pill neutral">${esc(scen())} scenario</span></div></div>
      ${busy ? `<div class="notice"><span class="spinner"></span> ${esc(busy)}</div>` : ''}${msg ? `<div class="notice ${msg.level || ''}">${esc(msg.text)}</div>` : ''}`;
  }
  function needData() {
    if (cur.hist.periods.length) return '';
    return `<div class="notice">No historical statements yet. Import the company on ${link('company', 'Company selection')}: from the SEC company facts file (primary source), Financial Modeling Prep, or start from the company in your DCF model.</div>`;
  }
  function runNotice() {
    const { r } = calc();
    if (r.ok) return '';
    return `<div class="notice"><b>The ${esc(scen())} forecast cannot run yet.</b> Missing: ${esc(r.missing.slice(0, 12).join(', '))}${r.missing.length > 12 ? ` and ${r.missing.length - 12} more` : ''}. Enter them on ${link('assumptions', 'Forecast assumptions')} (or the schedule pages), or press "Start from history" there. Nothing is filled in for you.</div>`;
  }
  const layoutBar = () => `<div class="fs-bar"><label class="cx-chk"><input type="checkbox" data-fset-bool="settings.layout" ${cur.settings.layout === 'expanded' ? 'checked' : ''}> Expanded layout (detail rows)</label><label class="cx-chk"><input type="checkbox" data-fset-bool="settings.freeze" ${cur.settings.freeze ? 'checked' : ''}> Freeze the line-item column</label><label class="cx-chk"><input type="checkbox" data-fs-learn ${cur.ui.learn ? 'checked' : ''}> Show explanations</label>
    <span class="fs-legend"><span class="v-sec">SEC reported</span><span class="v-vendor">Provider</span><span class="v-calc">Calculated</span><span class="v-manual">Manual</span><span class="v-miss">— missing</span><span class="fc-l">Forecast (formula)</span><span class="in-l">Your input</span></span></div>`;

  // ---------- charts ----------
  function bars(series, opts = {}) {
    const W = 560, Hh = 180, pad = 30;
    const all = series.flatMap(s => s.v).filter(isNum); if (!all.length) return '<p class="footnote">No data yet.</p>';
    const max = Math.max(0, ...all), min = Math.min(0, ...all), n = series[0].v.length;
    const y = v => pad / 2 + (max - v) / (max - min || 1) * (Hh - pad);
    const bw = (W - 50) / n / (series.length + 0.6);
    const g = series.map((s, j) => s.v.map((v, i) => isNum(v) ? `<rect x="${44 + i * (W - 50) / n + j * bw}" y="${Math.min(y(v), y(0))}" width="${bw * 0.9}" height="${Math.abs(y(v) - y(0))}" class="b${j}"><title>${esc(s.name)} ${esc(opts.labels[i])}: ${plain(fmt(v, opts.u || 'mm'))}</title></rect>` : '').join('')).join('');
    const lab = opts.labels.map((l, i) => i % Math.ceil(n / 10) === 0 ? `<text x="${44 + (i + 0.4) * (W - 50) / n}" y="${Hh - 2}" class="ax">${esc(l)}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${Hh}" class="fs-chart" role="img" aria-label="${esc(opts.title || 'chart')}"><line x1="40" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="zero"/><text x="2" y="${y(max) + 8}" class="ax">${plain(fmt(max, opts.u || 'mm'))}</text>${min < 0 ? `<text x="2" y="${y(min)}" class="ax">${plain(fmt(min, opts.u || 'mm'))}</text>` : ''}${g}${lab}</svg>
      <div class="glegend">${series.map((s, j) => `<span><i class="b${j}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  }

  // ---------- pages ----------
  const P = {};
  P.dashboard = () => {
    const { runs, comp } = calc(); const c = cols(); const co = cur.company;
    const r = runs[scen()];
    const y = r.ok ? r.years : null;
    const kv = (k, v, s, cls) => `<div class="stat ${cls || ''}"><span class="k">${k}</span><span class="v">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
    const fails = r.ok ? r.checks.filter(x => x.status === 'fail') : [];
    const stats = `<div class="stats">
      ${kv('Company', esc(co.ticker || co.name || '—'), esc(co.name || 'Select a company'))}
      ${kv('Forecast starts from', c.b ? esc(c.b.label) : '—', c.b ? 'balance sheet ' + esc(c.b.end) : 'no historical data')}
      ${kv('Revenue, year 1', y ? fmt(y[0].rev) : NA, y ? 'growth ' + plain(fmt(y[0].g, 'pct')) : '')}
      ${kv('Revenue, year 10', y ? fmt(y[9].rev) : NA, y ? 'CAGR ' + plain(fmt(Math.pow(y[9].rev / r.x.rev, 0.1) - 1, 'pct')) : '')}
      ${kv('EBIT margin, year 10', y ? fmt(y[9].ebit / y[9].rev, 'pct') : NA, '')}
      ${kv('Diluted EPS, year 1 / 10', y ? fmt(y[0].epsDil, 'ps') + ' / ' + fmt(y[9].epsDil, 'ps') : NA, '')}
      ${kv('FCFF, year 1', y ? fmt(y[0].fcff) : NA, 'free cash flow to the firm')}
      ${kv('Checks (' + esc(scen()) + ')', r.ok ? (fails.length ? `<span class="neg">${fails.length} failing</span>` : '<span class="pos">All pass</span>') : '—', r.ok ? `${r.checks.length} reconciliations` : 'forecast incomplete', r.ok && !fails.length ? 'primary' : '')}
      ${kv('Model completion', comp.pct + '%', `${comp.done} of ${comp.total} items`)}
    </div>`;
    const labels = c.fc.map(x => x.label);
    const chart1 = SC.every(s => runs[s].ok) ? bars(SC.map(s => ({ name: s, v: runs[s].years.map(q => q.rev) })), { labels, title: 'Revenue by scenario' }) : '<p class="footnote">Revenue by scenario appears when all three scenarios have their assumptions.</p>';
    const chart2 = r.ok ? bars([{ name: 'FCFF', v: r.years.map(q => q.fcff) }, { name: 'Net income', v: r.years.map(q => q.ni) }, { name: 'CFO − CapEx', v: r.years.map(q => q.cfoLessCapex) }], { labels, title: 'Cash flows' }) : runNotice();
    const steps = comp.sections.flatMap(s => s.items.filter(i => !i.ok).map(i => `<li>${link(i.page, esc(i.text))}</li>`)).slice(0, 8).join('');
    return pageHead('Three-Statement dashboard', 'A linked forecast of the income statement, balance sheet and cash flow statement. Cash comes only from the cash flow statement and every balance sheet must balance without a plug.')
      + needData() + stats
      + `<div class="grid2">${panel('Revenue by scenario ($mm)', chart1)}${panel(`Cash flows, ${esc(scen())} ($mm)`, chart2)}</div>`
      + `<div class="grid2">${panel('Reconciliation status', SC.map(s => { const q = runs[s]; return `<p><b>${s}</b> ${!q.ok ? pill('neutral', 'assumptions incomplete') : q.checks.map(ch => pill(ch.status, ch.label)).join(' ')}</p>`; }).join('') + `<p>${link('reconciliation', 'Open Model reconciliation')}</p>`)}
         ${panel('Next steps', steps ? `<ol>${steps}</ol>` : '<p>Everything on the completion list is done.</p>')}</div>`
      + learn('Work through the pages in order: choose the company, check the imported history, set the assumptions, then review the statements and schedules. Use the Base / Bear / Bull switch at the top to see each scenario; each has its own fully linked statements.');
  };

  P.company = () => {
    const co = cur.company;
    const dcfs = dcfModels();
    const k = fmpKey();
    const cik = co.cik ? String(co.cik).replace(/^0+/, '') : '';
    const b = E.basePeriod(cur);
    const h = cur.hist;
    return pageHead('Company selection', 'Choose the company, then import its statements. Data shared with the DCF (company, ticker, CIK, share price) can be copied from a DCF model, and the statements import automatically when a source is available.')
      + `<div class="grid2">${panel('Start from a DCF model', dcfs.length ? `<p class="footnote">Copies the company, ticker, CIK and share price (with its date) from the DCF model. Your DCF model is not changed. If the SEC file for that company was loaded in this browser, or a Financial Modeling Prep key is set, the statements import automatically.</p>
          <label class="fs-set">DCF model <span class="inwrap"><select id="fs-dcf-src">${dcfs.map(m => opt(m.id, `${m.name}${m.inputs.company.ticker ? ' (' + m.inputs.company.ticker + ')' : ''}`, ui.dcfSel || (dcfs[0] || {}).id)).join('')}</select></span></label>
          <div class="btns"><button class="btn primary" data-fs-fromdcf>Use this company</button></div>` : '<p class="footnote">No DCF models are saved in this browser yet.</p>')}
        ${panel('Import from Financial Modeling Prep', `<p class="footnote">Five annual statements, plus quarterly statements for the TTM column when your plan includes them. Provider statements are standardised: the SEC import is preferred where the two differ.</p>
          <label class="fs-set">Ticker <span class="inwrap"><input id="fs-tk" value="${esc(co.ticker || '')}" placeholder="e.g. AMZN"></span></label>
          <div class="btns"><button class="btn primary" data-fs-fmp>${k ? 'Import' : 'Connect a key first'}</button></div>`)}</div>`
      + panel('Import from the SEC company facts file (primary source)', `<ol class="fs-steps"><li>Find the company's CIK ${cik ? `(this company: <b>${esc(cik)}</b>)` : `on <a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank" rel="noopener">EDGAR company search</a>`}.</li>
          <li>${cik ? `<a href="https://data.sec.gov/api/xbrl/companyfacts/CIK${esc(cik.padStart(10, '0'))}.json" target="_blank" rel="noopener">Open the company facts file</a>` : 'Open https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json'} and save it (Ctrl+S or ⌘S). Optionally also save <code>data.sec.gov/submissions/CIK##########.json</code> for filing dates and document links.</li>
          <li><label class="btn">Load the saved file(s)<input type="file" id="fs-sec-file" accept=".json,application/json" multiple hidden></label></li></ol>
          <p class="footnote">Browsers cannot download SEC files directly into a page, so the file is loaded by hand once. It is kept in this browser and reused by every model for the same company.</p>
          ${cachedList()}`)
      + panel('Company', `<div class="cx-form">${['name|Company name', 'ticker|Ticker', 'cik|CIK', 'exchange|Exchange', 'industry|Industry', 'fyEnd|Fiscal year-end (MM-DD)', 'currency|Reporting currency'].map(x => { const [f, l] = x.split('|'); return `<label>${l}<span class="inwrap"><input type="text" class="txt" data-fco="${f}" value="${esc(co[f] || '')}"></span></label>`; }).join('')}
          <label>Share price ${hb('price0')}<span class="inwrap"><input data-fnum="equity.price0" data-u="ps" value="${toIn(cur.equity.price0)}" placeholder="required" inputmode="decimal"></span></label>
          <label>Price date<span class="inwrap"><input type="date" data-fco="priceDate" value="${esc(co.priceDate || '')}"></span></label></div>
          <p class="footnote">Units: millions of ${esc(co.currency || 'USD')}, shares in millions. The share price is used only to turn buyback and issuance amounts into share counts.</p>`)
      + panel('Forecast start', `${setSel('settings.base', [['fy', 'Latest completed fiscal year' + (h.periods.length ? ' (' + h.periods[h.periods.length - 1].label + ')' : '')], ['ttm', 'TTM / interim balance sheet' + (h.ttm ? ' (' + h.ttm.end + ')' : ' (no TTM column)')]], 'Start the forecast from', 'base')}
          <p class="footnote">${b ? `Opening balance sheet: <b>${esc(b.end)}</b>. Forecast year 1 covers the twelve months after it, so no month in the historical results is counted again.` : ''} ${cur.settings.base === 'ttm' && !(h.ttm && h.periods.length && h.ttm.end > h.periods[h.periods.length - 1].end) ? '<b>No TTM column exists, so the latest fiscal year is used.</b>' : ''}</p>`, { help: 'base' })
      + notes('company', 'company and data');
  };
  function cachedList() {
    const list = typeof SecCache !== 'undefined' ? SecCache.listSync() : [];
    if (!list.length) return '';
    return `<p class="footnote">SEC files saved in this browser: ${list.map(x => `<button class="btn tiny" data-fs-cache="${esc(x.cik)}">${esc(x.name)} (CIK ${esc(String(+x.cik))}, saved ${esc(String(x.savedAt).slice(0, 10))})</button>`).join(' ')}</p>`;
  }

  P.historical = () => {
    const h = cur.hist; const st = ui.histSt;
    const tabs = `<div class="seg" role="group" aria-label="Statement">${[['IS', 'Income statement'], ['BS', 'Balance sheet'], ['CF', 'Cash flow']].map(([k, l]) => `<button data-fs-histst="${k}" aria-pressed="${st === k}">${l}</button>`).join('')}</div>`;
    const rows = (st === 'IS' ? IS_ROWS() : st === 'BS' ? BS_ROWS() : CF_ROWS()).filter(d => d.sec || d.h);
    const notesList = (h.notes || []).length ? `<details class="cx-notes" open><summary>Import and classification notes (${h.notes.length})</summary><ul>${h.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : '';
    const prop = Object.entries(h.cells).flatMap(([k, byP]) => Object.entries(byP).filter(([, c]) => c.proposed).map(([pid, c]) => ({ k, pid, c })));
    return pageHead('Historical financial data', `Five completed fiscal years and a separate TTM column, from ${esc(h.provider || 'no source yet')}${h.retrieved ? ' (retrieved ' + esc(String(h.retrieved).slice(0, 10)) + ')' : ''}. Click any figure to see its source (form, accession, period, filing date, raw value and units) or to enter a figure yourself.`, tabs)
      + needData() + layoutBar()
      + (prop.length ? `<div class="notice"><b>${prop.length} imported figure(s) differ from your manual entries.</b> Your values are kept: ${prop.slice(0, 6).map(p => `${esc(p.k)} ${esc(p.pid)} (yours ${plain(fmt(p.c.v))}, filing ${plain(fmt(p.c.proposed.v))})`).join('; ')}. Open a cell to accept the filing's figure.</div>` : '')
      + tableRows(rows.filter(d => d.h || d.sec).map(d => Object.assign({}, d, { f: null, tr: null })))
      + learn('TTM = latest fiscal year + current year-to-date − the same year-to-date a year earlier. It is a reference column, never a fiscal year. Missing figures show — (not zero). Lines the company does not tag separately are derived only from reported totals and marked Calc; open them to see the arithmetic.')
      + notesList
      + panel('Review', `<label class="cx-chk"><input type="checkbox" data-fs-reviewed ${h.reviewed && h.reviewed.all ? 'checked' : ''}> I have compared these statements with the filings and accept the classification</label>`)
      + notes('historical', 'historical data');
  };

  P.assumptions = () => {
    const grp = {}; E.DRIVERS.forEach(d => { if (d.scalar) return; (grp[d.grp] = grp[d.grp] || []).push(d.k); });
    const filled = Object.values(cur.reviewed).filter(v => v === false).length;
    return pageHead('Forecast assumptions', `Each driver has ten yearly inputs for the selected scenario, next to the historical reference values. Switch scenarios at the top. Every input has a guide (?) covering what it is, why it is forecast, where to find it, how to calculate the history, how to estimate it, its effect on all three statements, common mistakes and its effect on the DCF.`)
      + needData() + runNotice()
      + panel('Start from history', `<p class="footnote">Fills every <b>empty</b> input with a historical reference (3-year average where available; financing inputs with last year's amounts or zero). Filled inputs are tagged "from history: review" and the model is not complete until you review them. Existing inputs are never overwritten.</p>
        <div class="btns"><button class="btn primary" data-fs-fillhist="avg3">Fill empty inputs from 3-year averages</button><button class="btn" data-fs-fillhist="last">Fill from the latest year</button>${filled ? `<button class="btn" data-fs-reviewall>Mark all ${filled} as reviewed</button>` : ''}</div>`)
      + Object.entries(grp).map(([g, ks]) => panel(esc(g), asmRows(ks) + notes('asm-' + g + '-' + scen(), g + ' (' + scen() + ')'))).join('')
      + panel('Dividend policy', setSel('shared.divMode', [['payout', 'Payout ratio of net income to common'], ['amount', 'Fixed amount per year ($mm)'], ['none', 'No dividends']], 'Dividends are entered as', 'div'));
  };

  P.is = () => pageHead('Income statement', `Historical fiscal years (grey), TTM (reference) and ten forecast years for the ${esc(scen())} scenario. ${emb() ? 'D&A is shown inside the cost lines (as most companies report it) and is not subtracted again: EBITDA adds it back.' : 'D&A is shown as its own line; the cost lines exclude it.'}`)
    + needData() + runNotice() + layoutBar() + tableRows(IS_ROWS())
    + panel('Presentation', `${setSel('settings.daPresentation', [['embedded', 'D&A inside cost of revenue and operating expenses (as reported)'], ['separate', 'D&A as a separate line']], 'D&A presentation', 'daPres')}${setSel('settings.daAlloc', [['opex', 'Inside operating expenses (spread by size)'], ['cogs', 'Inside cost of revenue'], ['all', 'Across cost of revenue and operating expenses']], 'Where the company reports D&A', 'daAlloc')}<p class="footnote">This changes only where D&A is shown and how the historical "before D&A" margins are measured. EBIT, EBITDA and cash flows are the same either way, because D&A is subtracted exactly once.</p>`)
    + learn('Click a forecast number to see its formula and the inputs behind it. Revenue = prior revenue × (1 + growth). EBIT = revenue − costs before D&A − D&A. Pretax income = EBIT + interest income − interest expense + other nonoperating. Net income = pretax − tax + equity-method income. EPS = net income to common ÷ weighted-average shares.')
    + notes('is', 'income statement');

  P.bs = () => {
    const { r } = calc();
    const bad = r.ok ? r.years.filter(y => Math.abs(y.check) > (cur.settings.tol || 0.5)) : [];
    return pageHead('Balance sheet', 'Cash comes from the cash flow statement; every other line from its schedule. Nothing is plugged: the balance check row shows any difference exactly.')
      + needData() + runNotice() + layoutBar()
      + (r.ok ? (bad.length ? `<div class="notice bad"><b>Out of balance</b> in ${bad.length} year(s) by up to ${plain(fmt(Math.max(...bad.map(y => Math.abs(y.check))), 'chk'))}. ${Math.abs(r.x.check) > (cur.settings.tol || 0.5) ? `The opening balance sheet is already out by ${plain(fmt(r.x.check, 'chk'))}: fix the historical classification on ${link('historical', 'Historical financial data')}.` : `See ${link('reconciliation', 'Model reconciliation')} for the accounts responsible.`}</div>` : `<div class="notice good">Every forecast year balances (largest difference ${plain(fmt(Math.max(...r.years.map(y => Math.abs(y.check))), 'chk'))}; tolerance ${cur.settings.tol}).</div>`) : '')
      + tableRows(BS_ROWS())
      + learn('Lease liabilities include their current portion, so total current liabilities here exclude current lease liabilities (the filing\'s total, which includes them, is in the expanded layout). Operating lease assets and liabilities move together and do not affect cash.')
      + notes('bs', 'balance sheet');
  };
  P.cf = () => pageHead('Cash flow statement', 'Change in cash = CFO + CFI + CFF + FX; ending cash flows to the balance sheet. FCFF (the DCF definition) is shown separately: it is not CFO − CapEx.')
    + needData() + runNotice() + layoutBar() + tableRows(CF_ROWS())
    + fcffBridgePanel()
    + learn('Historical "changes in operating working capital" is CFO − net income − D&A − SBC − deferred taxes − other non-cash items, so it also holds any line the company does not tag. Historical ending cash is the cash flow statement total, which includes restricted cash; the balance sheet line excludes it.')
    + notes('cf', 'cash flow statement');
  function fcffBridgePanel() {
    const { r } = calc(); if (!r.ok) return '';
    const c = cols();
    const br = r.years.map(y => E.fcffBridge(y, cur));
    const rows = br[0].items.map((it, j) => `<tr><td>${esc(it[0])}</td>${br.map(b => `<td class="fc">${fmt(b.items[j][1])}</td>`).join('')}</tr>`).join('');
    return panel('From cash from operations to FCFF', `<div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th>${c.fc.map(x => `<th class="fc">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${rows}
      <tr class="key"><td>= FCFF</td>${br.map(b => `<td class="fc">${fmt(b.rebuilt)}</td>`).join('')}</tr><tr class="sub chk"><td>Difference to FCFF from EBIT</td>${br.map(b => `<td class="fc">${fmt(b.diff, 'chk')}</td>`).join('')}</tr></tbody></table></div>`, { help: 'fcff' });
  }

  // schedules
  function sched(title, lead, rowsDefs, drivers, extra, helpK) {
    return pageHead(title, lead) + needData() + runNotice() + layoutBar()
      + tableRows(rowsDefs) + (drivers && drivers.length ? panel('Inputs', asmRows(drivers)) : '') + (extra || '') + notes('s-' + helpK, title);
  }
  P.revenue = () => {
    const segOn = cur.settings.segments;
    const segs = cur.segments || [];
    const c = cols();
    const segPanel = panel('Segment revenue (optional)', `<label class="cx-chk"><input type="checkbox" data-fset-bool="settings.segments" ${segOn ? 'checked' : ''}> Forecast revenue as the sum of segments</label>
      <p class="footnote">Segment figures are in the segment note of the 10-K (for Amazon: North America, International and AWS, "Segment Information"). The SEC company facts file does not contain them, so enter base-year segment revenue yourself; the segments must add up to total revenue in the base year.</p>
      ${segOn ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Segment</th><th>Base-year revenue</th>${c.fc.map(x => `<th class="fc">${esc(x.label)} growth</th>`).join('')}<th></th></tr></thead><tbody>
      ${segs.map((sg, j) => `<tr><td><span class="inwrap"><input class="txt" data-fseg="${j}|name" value="${esc(sg.name || '')}" placeholder="Segment name"></span></td><td><input data-fseg="${j}|rev0" data-u="mm" value="${toIn(sg.rev0)}" placeholder="required"></td>${c.fc.map((x, i) => `<td class="fc"><input data-fseg="${j}|g|${i}" data-u="pct" value="${toIn(((sg.g || {})[scen()] || [])[i], 'pct')}" placeholder="—"></td>`).join('')}<td><button class="btn tiny danger" data-fsegdel="${j}">Remove</button></td></tr>`).join('')}
      </tbody></table></div><div class="btns"><button class="btn" data-fsegadd>Add segment</button></div>
      ${(() => { const op = E.opening(cur); const s = segs.reduce((a, x) => a + (isNum(x.rev0) ? x.rev0 : 0), 0); return op.x && isNum(op.x.rev) && segs.length ? `<p class="footnote">Segments add up to ${plain(fmt(s))}; base revenue is ${plain(fmt(op.x.rev))} (${Math.abs(s - op.x.rev) < 1 ? 'they match' : '<b>they do not match: segments may exclude eliminations or other revenue</b>'}).</p>` : ''; })()}` : ''}`, { help: 'segments' });
    return sched('Revenue & operating expenses', 'Revenue growth and the cost structure: cost of revenue, R&D, SG&A and other operating expenses as a share of revenue, before D&A (which comes from the PP&E and intangibles schedules).',
      [{ l: 'Revenue', ck: 'rev', h: o => o.rev, f: y => y.rev, tr: 'rev', cls: 'key' }, { l: 'Growth', u: 'pct', h: null, f: y => y.g, cls: 'sub' },
        { l: 'Cost of revenue before D&A', h: o => E.allocDA(o, cur.settings.daAlloc).cogsX, f: y => y.cogsX }, { l: 'R&D before D&A', h: o => E.allocDA(o, cur.settings.daAlloc).rndX, f: y => y.rndX }, { l: 'SG&A before D&A', h: o => E.allocDA(o, cur.settings.daAlloc).sgaX, f: y => y.sgaX }, { l: 'Other operating expenses before D&A', h: o => E.allocDA(o, cur.settings.daAlloc).othX, f: y => y.othX },
        { l: 'EBITDA', h: o => o.ebitda, f: y => y.ebitda, tr: 'ebitda', cls: 'total' }, { l: 'EBITDA margin', u: 'pct', h: o => isNum(o.ebitda) && o.rev ? o.ebitda / o.rev : null, f: y => y.ebitda / y.rev, cls: 'sub' },
        { l: 'Stock-based compensation (inside the costs)', ck: 'sbc', h: o => o.sbc, f: y => y.sbc, cls: 'sub' }],
      ['g', 'gm', 'rnd', 'sga', 'oth', 'sbc'], segPanel, 'revenue');
  };
  P.nwc = () => {
    const D0 = cur.settings.days || 365;
    return sched('Working capital', `Operating working capital = operating current assets − non-debt operating current liabilities. Receivables = revenue ÷ ${D0} × DSO; inventory and payables use cost of revenue ÷ ${D0} × DIO / DPO. An increase in NWC uses cash.`,
      [{ l: 'Accounts receivable', ck: 'ar', h: o => o.ar, f: y => y.ar, tr: 'ar' }, { l: 'Inventory', ck: 'inv', h: o => o.inv, f: y => y.inv, tr: 'inv' }, { l: 'Other operating current assets', ck: 'oca', h: o => o.oca, f: y => y.oca },
        { l: 'Accounts payable', ck: 'ap', h: o => neg(o.ap), f: y => -y.ap, tr: 'ap' }, { l: 'Accrued operating liabilities', ck: 'accr', h: o => neg(o.accr), f: y => -y.accr }, { l: 'Deferred revenue', ck: 'defrev', h: o => neg(o.defrev), f: y => -y.defrev }, { l: 'Other operating current liabilities', ck: 'ocl', h: o => neg(o.ocl), f: y => -y.ocl },
        { l: 'Operating NWC', h: o => o.nwc, f: y => y.nwc, tr: 'nwc', cls: 'key', help: 'nwc' }, { l: 'Change in NWC (increase = cash used)', h: null, f: y => y.dNwc, cls: 'total', help: 'dnwc' }, { l: 'Cash flow impact (−change in NWC)', h: o => o.dNwcCf, f: y => -y.dNwc, cls: 'sub' },
        { l: 'NWC % of revenue', u: 'pct', h: o => isNum(o.nwc) && o.rev ? o.nwc / o.rev : null, f: y => y.nwcPct, cls: 'sub' },
        { l: 'DSO (days)', u: 'days', h: o => isNum(o.ar) && o.rev ? o.ar / o.rev * D0 : null, f: y => y.ar / y.rev * D0, cls: 'sub' }, { l: 'DIO (days)', u: 'days', h: o => isNum(o.inv) && o.cogs ? o.inv / o.cogs * D0 : null, f: y => y.inv / y.cogs * D0, cls: 'sub' }, { l: 'DPO (days)', u: 'days', h: o => isNum(o.ap) && o.cogs ? o.ap / o.cogs * D0 : null, f: y => y.ap / y.cogs * D0, cls: 'sub' }],
      ['dso', 'dio', 'dpo', 'accr', 'defrev', 'oca', 'ocl'], panel('Worksheet: what each component is', H.worksheet('nwc')) + calcDays(), 'nwc');
  };
  function calcDays() {
    const s = ui.calc || { a: 1000, b: 36500 };
    const dso = isNum(s.a) && isNum(s.b) && s.b ? s.a / s.b * 365 : null;
    return panel('Calculator: days outstanding', `<div class="cx-form"><label>Ending balance ($mm)<span class="inwrap"><input data-fcalc="a" value="${toIn(s.a)}"></span></label><label>Annual revenue or cost of revenue ($mm)<span class="inwrap"><input data-fcalc="b" value="${toIn(s.b)}"></span></label></div>
      <p><b>Days = balance ÷ annual flow × 365 = ${plain(fmt(dso, 'days'))} days.</b> Use revenue for DSO and cost of revenue for DIO and DPO, over the same twelve months as the balance.</p>`);
  }
  P.ppe = () => sched('Capital expenditures & PP&E', 'Ending net PP&E = beginning + capitalised additions (CapEx, new finance leases, PP&E from acquisitions) − depreciation − disposals − impairments. Finance lease and acquisition additions are not CapEx, so nothing is counted twice.',
    [{ l: 'Beginning net PP&E', h: null, f: y => y.ppe - (y.capex + y.flAdd + y.acqPpe - y.dep - y.disposals - y.impair) },
      { l: 'Maintenance CapEx', h: null, f: y => y.maint, help: 'maint' }, { l: 'Growth CapEx', h: null, f: y => y.gcapex, help: 'gcapex' }, { l: 'Total CapEx (cash)', ck: 'capex', h: o => o.capex, f: y => y.capex, cls: 'total', help: 'capex' },
      { l: 'New finance leases (non-cash)', h: null, f: y => y.flAdd }, { l: 'PP&E acquired in acquisitions', h: null, f: y => y.acqPpe }, { l: 'Total capitalised additions', h: null, f: y => y.capex + y.flAdd + y.acqPpe, cls: 'total' },
      { l: 'Depreciation', h: null, f: y => -y.dep, tr: 'dep' }, { l: 'Disposals (net book value)', h: null, f: y => -y.disposals }, { l: 'Impairments', h: null, f: y => -y.impair },
      { l: 'Ending net PP&E', ck: 'ppe', h: o => o.ppe, f: y => y.ppe, tr: 'ppe', cls: 'key' }, { l: 'CapEx % of revenue', u: 'pct', h: o => isNum(o.capex) && o.rev ? o.capex / o.rev : null, f: y => y.capex / y.rev, cls: 'sub' }, { l: 'CapEx ÷ depreciation', u: 'x', h: o => isNum(o.capex) && o.da ? o.capex / o.da : null, f: y => y.capex / y.dep, cls: 'sub' }],
    ['maint', 'gcapex', 'flAdd', 'disposals', 'impair', 'acq'], panel('Where the historical figures are', H.worksheet('ppe')) + panel('Acquisitions: purchase price allocation', `<div class="cx-form">${setNum('acqAlloc.gw', 'Share to goodwill', 'pct', 'acq')}${setNum('acqAlloc.intang', 'Share to intangible assets', 'pct')}</div><p class="footnote">The rest is recorded as acquired PP&E (not CapEx). Acquisitions are an investing outflow; they are not added to CapEx.</p>`), 'ppe');
  P.da = () => {
    const vin = cur.settings.depMethod === 'vintage';
    return sched('Depreciation & amortization', 'Depreciation of PP&E and amortization of intangible assets. Choose a simple percentage method or a vintage schedule that depreciates each year\'s additions over a useful life.',
      [{ l: 'Depreciation', h: null, f: y => y.dep, tr: 'dep' }, { l: 'Amortization of intangibles', h: null, f: y => y.amort }, { l: 'Total D&A', ck: 'da', h: o => o.da, f: y => y.da, cls: 'key', help: 'da' },
        { l: 'D&A % of revenue', u: 'pct', h: o => isNum(o.da) && o.rev ? o.da / o.rev : null, f: y => y.da / y.rev, cls: 'sub' },
        { l: 'Beginning intangibles', h: null, f: y => y.intang - y.acqInt + y.amort }, { l: '+ From acquisitions', h: null, f: y => y.acqInt }, { l: '− Amortization', h: null, f: y => -y.amort }, { l: 'Ending intangibles', ck: 'intang', h: o => o.intang, f: y => y.intang, cls: 'total' }],
      ['dep', 'amort'], panel('Depreciation method', `${setSel('settings.depMethod', [['pctRev', 'Simplified: % of revenue'], ['pctPPE', 'Simplified: % of opening net PP&E'], ['vintage', 'Detailed: vintage schedule (straight-line by year of addition)']], 'Method', 'depMethod')}
        ${vin ? `<div class="cx-form">${setNum('ppeSched.remLife', 'Remaining life of opening PP&E (years)', 'num', 'depMethod')}${setNum('ppeSched.life', 'Useful life of new additions (years)', 'num')}</div><label class="cx-chk"><input type="checkbox" data-fset-bool="ppeSched.halfYear" ${cur.ppeSched.halfYear ? 'checked' : ''}> Half-year convention (half a year of depreciation in the year added)</label>
          <p class="footnote">The useful-life note in the 10-K (Amazon: "Property and Equipment" in Note 1) gives the ranges by asset class; remaining life ≈ net PP&E ÷ annual depreciation.</p>` : ''}`), 'da');
  };
  P.debt = () => {
    const c = cols(); const { r } = calc(); const rv = cur.debt.revolver;
    const op = E.opening(cur);
    const trSum = cur.debt.tranches.reduce((a, t) => a + (isNum(t.open) ? t.open : 0), 0) + (rv.open || 0);
    const bsDebt = op.x ? op.x.std + op.x.cltd + op.x.ltd : null;
    const trs = cur.debt.tranches.map((t, j) => {
      const row = (f, l, u) => `<tr><td>${l}</td>${c.fc.map((x, i) => `<td class="fc"><input data-ftr="${t.id}|${f}|${i}" data-u="${u}" value="${toIn((t[f] || [])[i], u)}" placeholder="—"></td>`).join('')}</tr>`;
      const out = r.ok ? `<tr class="sub"><td>Beginning balance</td>${r.years.map(y => `<td class="fc">${fmt(y.trs[j].beg)}</td>`).join('')}</tr><tr class="sub"><td>Interest expense</td>${r.years.map(y => `<td class="fc">${fmt((cur.settings.interest === 'average' ? (y.trs[j].beg + y.trs[j].end) / 2 : y.trs[j].beg) * (y.trs[j].rate || 0))}</td>`).join('')}</tr><tr class="total"><td>Ending balance</td>${r.years.map(y => `<td class="fc">${fmt(y.trs[j].end)}</td>`).join('')}</tr>` : '';
      return panel(`${esc(t.name || 'Tranche ' + (j + 1))}`, `<div class="cx-form"><label>Name<span class="inwrap"><input class="txt" data-ftrf="${t.id}|name" value="${esc(t.name || '')}"></span></label><label>Type<span class="inwrap"><select data-ftrf="${t.id}|kind">${opt('term', 'Term debt / notes', t.kind)}${opt('cp', 'Short-term / commercial paper', t.kind)}</select></span></label><label>Opening balance ($mm)<span class="inwrap"><input data-ftrf="${t.id}|open" data-u="mm" value="${toIn(t.open)}"></span></label><label>Maturity / notes<span class="inwrap"><input class="txt" data-ftrf="${t.id}|maturity" value="${esc(t.maturity || '')}" placeholder="e.g. 2027–2064"></span></label></div>
        ${t.note ? `<p class="footnote">${esc(t.note)}</p>` : ''}
        <div class="tbl-wrap"><table class="fin fs-table"><thead><tr><th>$ millions</th>${c.fc.map(x => `<th class="fc">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${row('rate', 'Interest rate (%)', 'pct')}${row('borrow', 'New borrowings', 'mm')}${row('repay', 'Scheduled repayments', 'mm')}${row('prepay', 'Optional repayments', 'mm')}${row('other', 'Non-cash and other changes (+/−)', 'mm')}${out}</tbody></table></div>
        <div class="btns"><button class="btn tiny" data-ftrtool="${t.id}|rate">Same rate every year</button><button class="btn tiny" data-ftrtool="${t.id}|zero">Zero empty repayments/borrowings</button><button class="btn tiny danger" data-ftrdel="${t.id}">Remove tranche</button></div>`);
    }).join('');
    const sum = r.ok ? `<tr><td>Total debt (short-term + current + long-term)</td>${r.years.map(y => `<td class="fc">${fmt(y.debt)}</td>`).join('')}</tr><tr><td>Revolver balance</td>${r.years.map(y => `<td class="fc">${fmt(y.revolver)}</td>`).join('')}</tr><tr class="sub"><td>Revolver draw / (repayment)</td>${r.years.map(y => `<td class="fc">${fmt(y.revDraw - y.revRepay)}</td>`).join('')}</tr><tr class="sub"><td>Available revolver capacity</td>${r.years.map(y => `<td class="fc">${rv.enabled ? fmt(rv.capacity - y.revolver) : NA}</td>`).join('')}</tr><tr><td>Interest expense</td>${r.years.map(y => `<td class="fc"><button class="cellbtn" data-finsp="intExp|${y.i}|Interest expense">${fmt(y.intExp)}</button></td>`).join('')}</tr><tr><td>Interest coverage (EBIT ÷ interest)</td>${r.years.map(y => `<td class="fc">${y.intExp > 0 ? fmt(y.ebit / y.intExp, 'x') : NA}</td>`).join('')}</tr><tr class="sub"><td>Finance lease liabilities</td>${r.years.map(y => `<td class="fc">${fmt(y.finl)}</td>`).join('')}</tr><tr class="sub"><td>Operating lease liabilities</td>${r.years.map(y => `<td class="fc">${fmt(y.opl)}</td>`).join('')}</tr>${cur.settings.interest === 'average' ? `<tr class="sub"><td>Circularity iterations</td>${r.years.map(y => `<td class="fc">${y.iter}${y.converged ? '' : ' ✕'}</td>`).join('')}</tr>` : ''}` : '';
    return pageHead('Debt & interest', 'A schedule by financing tranche. Ending debt = beginning + borrowings − repayments ± other changes. Interest follows the selected balance method. A cash shortfall is never filled silently: the revolver draws only within its capacity, and any remaining gap shows as negative cash and a failed check.')
      + needData() + runNotice()
      + (op.x && Math.abs(trSum - bsDebt) > (cur.settings.tol || 0.5) ? `<div class="notice bad">The tranches add up to ${plain(fmt(trSum))}, but the opening balance sheet has ${plain(fmt(bsDebt))} of debt (short-term ${plain(fmt(op.x.std))} + current portion ${plain(fmt(op.x.cltd))} + long-term ${plain(fmt(op.x.ltd))}). Adjust the opening balances so they match.</div>` : '')
      + panel('Interest method', `${setSel('settings.interest', [['opening', 'Opening balance × rate (simple, no circularity)'], ['average', 'Average balance × rate (solved iteratively)']], 'Interest on', 'interestMethod')}<p class="footnote">Opening-balance interest ignores borrowing and repayment during the year, so it is a labelled approximation. Average-balance interest is more accurate but circular (interest → net income → cash → revolver → interest); the model solves it by repeated calculation and reports the iterations.</p>`)
      + trs + `<div class="btns"><button class="btn" data-ftradd>Add a tranche</button></div>`
      + panel('Revolving credit facility', `<label class="cx-chk"><input type="checkbox" data-fset-bool="debt.revolver.enabled" ${rv.enabled ? 'checked' : ''}> Use a revolver to keep cash at the minimum balance</label>
        <div class="cx-form">${setNum('debt.revolver.capacity', 'Facility capacity ($mm)', 'mm', 'revolver')}${setNum('debt.revolver.rate', 'Interest rate on drawn balance', 'pct')}${setNum('debt.revolver.fee', 'Commitment fee on undrawn amount', 'pct', null, 'optional')}${setNum('debt.revolver.open', 'Opening drawn balance ($mm)', 'mm', null, '0')}</div>
        <label class="cx-chk"><input type="checkbox" data-fset-bool="debt.revolver.sweep" ${rv.sweep !== false ? 'checked' : ''}> Repay the revolver from cash above the minimum (cash sweep)</label>
        <p class="footnote">Minimum cash is an input on ${link('assumptions', 'Forecast assumptions')} (Cash and investments).</p>`, { help: 'revolver' })
      + (r.ok ? panel('Debt summary', `<div class="tbl-wrap"><table class="fin fs-table"><thead><tr><th>$ millions</th>${c.fc.map(x => `<th class="fc">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${sum}</tbody></table></div>`) : '')
      + panel('Leases and cash', asmRows(['flAdd', 'flRepay', 'flRate', 'opl', 'sti', 'yield', 'minCash']) + '<p class="footnote">Finance leases are debt: principal payments are financing cash flows, interest is interest expense, new leases add PP&E without cash. Operating leases stay operating costs (as in the DCF): their liability and right-of-use asset move together with no cash effect.</p>')
      + notes('s-debt', 'debt');
  };
  P.tax = () => {
    const recog = cur.settings.nolDTA === 'recognized';
    return sched('Taxes & deferred taxes', 'Book (accounting) tax expense on the income statement versus cash (current) taxes. Deferred tax expense is the difference; it moves deferred tax assets and liabilities and is added back in CFO once.',
      [{ l: 'Pretax income', ck: 'pbt', h: o => o.pbt, f: y => y.pbt }, { l: 'Statutory rate (reference)', u: 'pct', h: () => cur.tax.statutory, f: () => cur.tax.statutory, cls: 'sub' },
        { l: 'Effective accounting tax rate', u: 'pct', h: o => isNum(o.tax) && o.pbt ? o.tax / o.pbt : null, f: y => y.etr }, { l: 'Normalized tax rate (assumption)', u: 'pct', h: null, f: y => y.taxRate, cls: 'sub' },
        { l: 'Current tax expense (cash taxes)', h: o => isNum(o.tax) && isNum(o.defTax) ? o.tax - o.defTax : null, f: y => y.curTax }, { l: 'Deferred tax expense', ck: 'defTax', h: o => o.defTax, f: y => y.defTax }, { l: 'Total tax expense', ck: 'tax', h: o => o.tax, f: y => y.tax, tr: 'tax', cls: 'total' },
        { l: 'Deferred tax assets', ck: 'dta', h: o => o.dta, f: y => y.dta }, { l: 'Deferred tax liabilities', ck: 'dtl', h: o => o.dtl, f: y => y.dtl },
        { l: 'Loss carryforward: created', h: null, f: y => y.nolCreated, cls: 'sub' }, { l: 'Loss carryforward: used', h: null, f: y => y.nolUsed, cls: 'sub' }, { l: 'Loss carryforward: ending (usable)', h: null, f: y => y.nol, cls: 'total' }],
      ['tax', 'defPct'], panel('Loss carryforwards (NOLs)', `${setSel('settings.nolDTA', [['allowance', 'Valuation allowance: losses carry no deferred tax asset'], ['recognized', 'Recognised: losses create a deferred tax asset']], 'Accounting for losses', 'nol')}
        <div class="cx-form">${setNum('tax.nolOpen', 'Opening loss carryforwards ($mm)', 'mm', 'nol', '0')}${setNum('tax.nolUsable', 'Share usable', 'pct')}${setNum('tax.capPct', 'Annual use limit (% of taxable income)', 'pct')}${setNum('tax.annualLimit', 'Annual dollar limit ($mm, e.g. Section 382)', 'mm', null, 'none')}${setNum('tax.statutory', 'Statutory rate (reference)', 'pct')}</div>
        ${cur.hist.refs && cur.hist.refs.nol ? `<p class="footnote">The tax note reports gross loss carryforwards of ${plain(fmt(cur.hist.refs.nol.v))} (${esc(cur.hist.refs.nol.src.end)}), across jurisdictions, some with expiry dates or limits. Not all of it is usable: enter only what you expect to use.</p>` : ''}
        <p class="footnote">US federal losses from 2018 on can offset up to 80% of taxable income each year. ${recog ? 'Recognised: the opening loss carryforward is assumed to be inside the opening deferred tax assets.' : ''}</p>`), 'tax');
  };
  P.equity = () => sched('Equity, stock compensation & shares', 'Ending retained earnings = beginning + net income to the company − dividends ± other direct adjustments. Shares: beginning + employee awards + issued − repurchased. Weighted-average shares (for EPS) are kept separate from period-end shares.',
    [{ l: 'Beginning shares outstanding', u: 'sh', h: null, f: y => y.sharesBeg }, { l: '+ Employee equity awards (net)', u: 'sh', h: null, f: y => y.awards }, { l: '+ Shares issued', u: 'sh', h: null, f: y => y.shIssued }, { l: '− Shares repurchased', u: 'sh', h: null, f: y => -y.shBought },
      { l: 'Ending shares outstanding (period-end)', u: 'sh', ck: 'sharesBS', h: o => (cur.hist.cells.sharesBS && cur.hist.cells.sharesBS[o.pid] || {}).v, f: y => y.sharesEnd, tr: 'sharesEnd', cls: 'key' },
      { l: 'Weighted-average basic shares', u: 'sh', ck: 'waBasic', h: o => o.waBasic, f: y => y.waBasic }, { l: 'Dilutive securities', u: 'sh', h: o => isNum(o.waDil) && isNum(o.waBasic) ? o.waDil - o.waBasic : null, f: y => y.dilutive, cls: 'sub' }, { l: 'Weighted-average diluted shares', u: 'sh', ck: 'waDil', h: o => o.waDil, f: y => y.waDil },
      { l: 'Assumed share price for buybacks', u: 'ps', h: null, f: y => y.px, cls: 'sub' },
      { l: 'Beginning retained earnings', h: null, f: y => y.re - y.niParent + y.div + y.prefDiv + (cur.settings.buyback === 'retire' ? y.buyback : 0) }, { l: '+ Net income to the company', h: null, f: y => y.niParent }, { l: '− Common dividends', h: null, f: y => -y.div }, { l: '− Buybacks charged to retained earnings', h: null, f: y => cur.settings.buyback === 'retire' ? -y.buyback : 0 }, { l: 'Ending retained earnings', ck: 're', h: o => o.re, f: y => y.re, cls: 'total' },
      { l: 'Stock-based compensation (credited to APIC)', ck: 'sbc', h: o => o.sbc, f: y => y.sbc }, { l: 'Additional paid-in capital', ck: 'apic', h: o => o.apic, f: y => y.apic }, { l: 'Treasury stock', ck: 'treas', h: o => neg(o.treas), f: y => -y.treas }, { l: 'Noncontrolling interests', ck: 'nci', h: o => o.nci, f: y => y.nci }],
    ['buyback', 'issue', 'awards', 'dilutive', 'pxg', 'div', 'nciPct', 'nciDist', 'prefDiv', 'otherFin', 'aociChg'],
    panel('Opening shares and accounting', `<div class="cx-form">${setNum('equity.sharesOpen', 'Shares outstanding at the opening balance sheet date (mm)', 'sh', 'sharesOpen')}${setNum('equity.price0', 'Current share price', 'ps', 'price0')}</div>
      ${cur.equity.sharesSrc ? `<p class="footnote">Source: ${esc(cur.equity.sharesSrc.concept || '')} ${esc(cur.equity.sharesSrc.period || '')} ${cur.equity.sharesSrc.url ? `<a href="${esc(cur.equity.sharesSrc.url)}" target="_blank" rel="noopener">filing</a>` : ''}. ${esc(cur.equity.sharesSrc.note || '')}</p>` : ''}
      ${setSel('settings.buyback', [['treasury', 'Treasury stock (held as a negative equity line)'], ['retire', 'Retired (charged to retained earnings)']], 'Repurchased shares are', 'treas')}
      <p class="footnote">A historical EPS denominator is an average over a past year, not a current share count. Historical SBC expense is a cost already in the income statement; future dilution from awards is the "net shares issued to employees" input.</p>`), 'equity');

  P.ratios = () => {
    const { r } = calc(); const c = cols();
    const rs = E.ratioSeries(cur, r);
    let grp = '';
    const body = rs.map(R => { const g = R.g !== grp ? `<tr class="sec"><td colspan="${1 + c.hist.length + c.fc.length + 1}">${esc(R.g)}</td></tr>` : ''; grp = R.g;
      return g + `<tr><td><b>${esc(R.l)}</b> ${hb('r_' + R.k)}<div class="footnote">${esc(R.f)}</div>${R.flags.length ? `<div class="footnote warnf">${esc(R.flags.join(' '))}</div>` : ''}</td>${R.hist.map(v => `<td class="hist">${fmt(v, R.u)}</td>`).join('')}${c.fc.map((x, i) => `<td class="fc">${fmt(R.fc[i], R.u)}</td>`).join('')}</tr>`; }).join('');
    return pageHead('Financial ratios', 'Historical trend and forecast for the selected scenario. Ratios that use an average balance need the prior year, so the first historical year shows —.') + needData() + runNotice()
      + `<div class="tbl-wrap fs-wrap"><table class="fin fs-table"><thead><tr><th>Ratio</th>${c.hist.map(x => `<th class="hist">${esc(x.label)}</th>`).join('')}${c.fc.map(x => `<th class="fc">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` + notes('ratios', 'ratios');
  };
  P.scenarios = () => {
    const { runs } = calc();
    const key = [['Revenue, year 1', y => y[0].rev], ['Revenue, year 5', y => y[4].rev], ['Revenue, year 10', y => y[9].rev], ['Revenue CAGR', (y, r) => Math.pow(y[9].rev / r.x.rev, 0.1) - 1, 'pct'], ['EBITDA margin, year 5', y => y[4].ebitda / y[4].rev, 'pct'], ['EBIT margin, year 10', y => y[9].ebit / y[9].rev, 'pct'], ['Net income, year 5', y => y[4].ni], ['Diluted EPS, year 5', y => y[4].epsDil, 'ps'], ['Diluted EPS, year 10', y => y[9].epsDil, 'ps'], ['FCFF, years 1–10 total', y => y.reduce((a, q) => a + q.fcff, 0)], ['Cash, year 10', y => y[9].cash], ['Total debt, year 10', y => y[9].debt], ['Lowest cash balance', y => Math.min(...y.map(q => q.cash))], ['Net debt ÷ EBITDA, year 5', y => (y[4].debt + y[4].finl - y[4].cash - y[4].sti) / y[4].ebitda, 'x'], ['ROIC, year 5 (EBIT after tax ÷ invested capital)', y => y[4].nopat / y[4].ic, 'pct']];
    const rows = key.map(([l, fn, u]) => `<tr><td>${esc(l)}</td>${SC.map(s => `<td>${runs[s].ok ? fmt(fn(runs[s].years, runs[s]), u || 'mm') : NA}</td>`).join('')}</tr>`).join('');
    const chk = `<tr class="total"><td>Reconciliation</td>${SC.map(s => `<td>${runs[s].ok ? (runs[s].checks.some(c => c.status === 'fail') ? pill('fail', runs[s].checks.filter(c => c.status === 'fail').length + ' failing') : pill('pass', 'all pass')) : pill('neutral', 'incomplete')}</td>`).join('')}</tr>`;
    const tool = `<div class="cx-form"><label>Copy Base into<span class="inwrap"><select id="fs-sc-to">${opt('Bear', 'Bear')}${opt('Bull', 'Bull')}</select></span></label><label>Growth change (percentage points)<span class="inwrap"><input id="fs-sc-g" value="0" inputmode="decimal"></span></label><label>Gross margin change (pp)<span class="inwrap"><input id="fs-sc-m" value="0" inputmode="decimal"></span></label></div><div class="btns"><button class="btn" data-fs-sccopy>Copy and adjust</button></div>
      <p class="footnote">Overwrites that scenario's operating drivers with Base ± your changes (asks first). Financing policy and discount rates are not scenario-specific unless you change them.</p>`;
    return pageHead('Bear, Base & Bull scenarios', 'Each scenario runs its own fully linked statements, schedules, ratios and free cash flow. A change in one scenario never moves another.') + needData()
      + panel('Side by side', `<div class="tbl-wrap"><table class="fin"><thead><tr><th>$ millions</th>${SC.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>${rows}${chk}</tbody></table></div>`)
      + (SC.every(s => runs[s].ok) ? panel('FCFF by scenario', bars(SC.map(s => ({ name: s, v: runs[s].years.map(q => q.fcff) })), { labels: cols().fc.map(x => x.label) })) : '')
      + panel('Build a scenario from Base', tool) + SC.map(s => notes('scen-' + s, s + ' scenario rationale')).join('');
  };
  P.reconciliation = () => {
    const { runs } = calc(); const c = cols();
    const grid = SC.map(s => {
      const r = runs[s];
      if (!r.ok) return panel(`${s} scenario`, `<p class="footnote">Cannot run yet: ${esc(r.missing.slice(0, 10).join(', '))}.</p>`);
      return panel(`${s} scenario`, `<div class="tbl-wrap"><table class="fin fs-table"><thead><tr><th>Check</th><th>Status</th>${c.fc.map(x => `<th class="fc">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${r.checks.map(ch => `<tr><td><b>${esc(ch.label)}</b><div class="footnote">${esc(ch.why)}</div></td><td>${pill(ch.status, ch.status.toUpperCase())}</td>${ch.by.length === 1 ? `<td colspan="${c.fc.length}" class="fc">opening: ${fmt(ch.by[0].diff, 'chk')}</td>` : ch.by.map(b => `<td class="fc s-${b.status}">${fmt(b.diff, 'chk')}${b.note ? `<small>${esc(b.note)}</small>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    }).join('');
    const hp = c.hist.concat(c.ttm).map(x => ({ x, o: hv(x.id) }));
    const hrow = (l, fn, why) => `<tr><td><b>${esc(l)}</b><div class="footnote">${esc(why)}</div></td>${hp.map(({ o }) => { const v = fn(o); return `<td class="hist ${isNum(v) ? (Math.abs(v) <= 1 ? 's-pass' : 's-warn') : ''}">${isNum(v) ? fmt(v, 'chk') : NA}</td>`; }).join('')}</tr>`;
    const hist = `<div class="tbl-wrap"><table class="fin fs-table"><thead><tr><th>Check</th>${hp.map(({ x }) => `<th class="hist">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>
      ${hrow('Balance sheet: assets − liabilities − equity (lines as classified)', o => o.bsCheck, 'Uses the lines shown on the balance sheet page, after the carve-outs listed in the import notes.')}
      ${hrow('Reported total assets − classified total assets', o => isNum(o.ta) && isNum(o.taCalc) ? o.ta - o.taCalc : null, 'Zero when every asset line is accounted for.')}
      ${hrow('Income statement: pretax − tax + equity income − net income', o => o.isCheck, 'Zero when the reported lines add up.')}
      ${hrow('Cash flow: CFO + CFI + CFF + FX − change in cash', o => o.cfCheck, 'Zero when the reported section totals add up.')}
      ${hrow('Cash flow ending cash − balance sheet cash (restricted cash)', o => isNum(o.cashEndCF) && isNum(o.cash) ? o.cashEndCF - o.cash : null, 'The cash flow statement includes restricted cash; the balance sheet line does not. A difference equal to restricted cash is expected.')}
      ${hrow('Operating costs not separately tagged', o => o.unclassOpex, 'Gross profit − operating income − tagged expense lines. Shown inside "Other operating expenses"; reclassify it on Historical data if you know the split.')}
      </tbody></table></div>`;
    return pageHead('Model reconciliation', 'Pass / Warning / Fail by fiscal year and scenario, with the exact difference. Tolerance: ±' + (cur.settings.tol || 0.5) + ' ($mm). A warning is within 10× the tolerance. Nothing is corrected silently.', `<label class="fs-set">Tolerance ($mm)<span class="inwrap"><input data-fnum="settings.tol" data-u="mm" value="${toIn(cur.settings.tol)}" style="width:60px"></span></label>`)
      + needData() + grid + panel('Historical source reconciliation', hist) + panel('Statement link audit', H.worksheet('links'));
  };
  P.dcf = () => {
    const list = dcfModels();
    const sel = list.find(m => m.id === ui.dcfSel) || list.find(m => m.forecastSource && m.forecastSource.fsmId === cur.id) || list.find(m => (m.inputs.company.ticker || '') === (cur.company.ticker || '-')) || list[0];
    const L = E.dcfLink(cur);
    let cmp = '';
    if (sel && typeof DCFModel !== 'undefined' && typeof DCF !== 'undefined') {
      const runWith = linked => { try { const m = DCFModel.upgrade(JSON.parse(JSON.stringify(sel))); m.forecastSource = linked ? { mode: 'linked', fsmId: cur.id } : { mode: 'original' }; const ei = DCFModel.engineInputs(m, linked ? { fsm: cur } : {}); return { all: DCF.runAll(ei.inp, m.mode), link: ei.link }; } catch (e) { return { err: e.message }; } };
      const a = runWith(false), b = runWith(true);
      const ps = (x, s) => x.all && x.all.scen[s] && x.all.scen[s].ok ? fmt(x.all.scen[s].perShare, 'ps') : `<span class="footnote">${esc(x.err || (x.all && x.all.scen[s] ? (x.all.scen[s].missing || []).concat(x.all.scen[s].errors || []).slice(0, 3).join(', ') || 'incomplete' : ''))}</span>`;
      const sumF = (x, s) => x.all && x.all.scen[s] && x.all.scen[s].ok ? fmt(x.all.scen[s].years.slice(0, 10).reduce((q, y) => q + y.fcff, 0)) : NA;
      cmp = `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Scenario</th><th>Original DCF: value per share</th><th>Linked forecast: value per share</th><th>Original: FCFF yrs 1–10</th><th>Linked: FCFF yrs 1–10</th></tr></thead><tbody>${SC.map(s => `<tr><td>${s}</td><td>${ps(a, s)}</td><td>${ps(b, s)}</td><td>${sumF(a, s)}</td><td>${sumF(b, s)}</td></tr>`).join('')}</tbody></table></div>
        <p class="footnote">Both columns use the DCF model's own WACC, terminal value method, terminal growth, share count and other equity bridge items. With the linked forecast, revenue, EBITDA, EBIT, operating taxes, D&A, CapEx, change in NWC, acquisitions and invested capital come from this model, and cash, investments, debt (including finance leases) and noncontrolling interests come from its opening balance sheet (${esc(L.bridge.date || '')}). The methods are not forced to agree.</p>`;
    }
    const mode = sel && sel.forecastSource && sel.forecastSource.mode === 'linked' && sel.forecastSource.fsmId === cur.id;
    const yrs = L.scen[scen()];
    const c = cols();
    const outRows = yrs && yrs.ok ? [['Revenue', 'rev'], ['EBITDA', 'ebitda'], ['EBIT', 'ebit'], ['Operating taxes on EBIT', 'taxes'], ['NOPAT', 'nopat'], ['D&A', 'da'], ['CapEx (incl. new finance leases)', 'capex'], ['Increase in operating NWC', 'dnwc'], ['Acquisitions', 'acq'], ['FCFF', 'fcff'], ['Stock-based compensation (memo: already an expense in EBIT)', 'sbc'], ['Invested capital', 'ic']].map(([l, k]) => `<tr class="${k === 'fcff' ? 'key' : ''}"><td>${esc(l)}</td>${yrs.years.map(y => `<td class="fc">${fmt(y[k])}</td>`).join('')}</tr>`).join('') : '';
    return pageHead('DCF integration', 'Optionally use this model\'s forecast in an existing DCF valuation. The DCF\'s own assumptions are never overwritten: the setting only chooses which forecast the DCF engine uses, and you can switch back at any time.')
      + needData() + runNotice()
      + (list.length ? panel('DCF Forecast Source', `<label class="fs-set">DCF model<span class="inwrap"><select id="fs-dcf-link">${list.map(m => opt(m.id, m.name + (m.inputs.company.ticker ? ' (' + m.inputs.company.ticker + ')' : ''), sel && sel.id)).join('')}</select></span></label>
          <div class="seg" role="group" aria-label="DCF Forecast Source"><button data-fs-dcfsrc="original" aria-pressed="${!mode}">Original DCF assumptions</button><button data-fs-dcfsrc="linked" aria-pressed="${!!mode}">Linked Three-Statement forecast</button></div>
          ${sel && sel.inputs.company.ticker && cur.company.ticker && sel.inputs.company.ticker.toUpperCase() !== cur.company.ticker.toUpperCase() ? `<div class="notice bad">This DCF model is for ${esc(sel.inputs.company.ticker)}, but this three-statement model is for ${esc(cur.company.ticker)}.</div>` : ''}
          ${sel && sel.mode === 'workbook' ? '<div class="notice">This DCF uses the "Original workbook" method. A linked forecast works with the Corrected method only; the DCF keeps its original forecast until you switch its method.</div>' : ''}
          ${L.problems.length ? `<div class="notice">Linked forecast incomplete: ${esc(L.problems.join('; '))}. The DCF shows the scenario as incomplete rather than mixing forecasts.</div>` : ''}
          ${SC.some(s => L.scen[s].ok && L.scen[s].failing.length) ? `<div class="notice bad">Some scenarios have failing reconciliation checks (${SC.filter(s => L.scen[s].ok && L.scen[s].failing.length).map(s => s + ': ' + L.scen[s].failing.join(', ')).join('; ')}). Fix them before relying on the linked valuation.</div>` : ''}
          ${(sel && sel.fsmLog || []).length ? `<details class="cx-notes"><summary>Link history (${sel.fsmLog.length})</summary><ul>${sel.fsmLog.slice(0, 20).map(x => `<li>${esc(String(x.at).slice(0, 16).replace('T', ' '))}: ${esc(x.text)}</li>`).join('')}</ul></details>` : ''}`, { help: 'dcfLink' }) : panel('DCF Forecast Source', '<p class="footnote">No DCF model is saved in this browser yet. Create one on the Discounted Cash Flow tab first.</p>'))
      + (cmp ? panel('Valuation with each forecast source', cmp) : '')
      + panel(`Outputs passed to the DCF (${esc(scen())})`, outRows ? `<div class="tbl-wrap"><table class="fin fs-table"><thead><tr><th>$ millions</th>${c.fc.map(x => `<th class="fc">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${outRows}</tbody></table></div>
        <p class="footnote">FCFF = EBIT × (1 − tax rate) + D&A − CapEx − increase in operating NWC − acquisitions${cur.settings.flReinvest !== false ? ' − new finance leases' : ''}. The tax rate is this model's normalized rate. Terminal value uses the DCF's own method on year 10 of this forecast.</p>
        <label class="cx-chk"><input type="checkbox" data-fset-bool="settings.flReinvest" ${cur.settings.flReinvest !== false ? 'checked' : ''}> Treat new finance leases as reinvestment in FCFF (consistent with counting finance lease liabilities as debt)</label>` : runNotice(), { help: 'fcff' })
      + learn('Why both definitions exist: CFO − CapEx is a reported-style cash flow after interest and with SBC added back. FCFF is the cash available to all capital providers before financing: it starts from EBIT, taxes it at an operating rate, treats SBC as a real cost and subtracts all reinvestment. The reconciliation between them is on the Cash flow statement page.');
  };
  P.sources = () => {
    const h = cur.hist;
    const recs = {};
    Object.values(h.cells).forEach(byP => Object.values(byP).forEach(c => { const s = c.src; if (s && s.accn) { const k = s.accn; recs[k] = recs[k] || { form: s.form, accn: s.accn, filed: s.filed, url: s.url, end: s.end, n: 0 }; recs[k].n++; } }));
    const fil = Object.values(recs).sort((a, b) => String(b.filed).localeCompare(String(a.filed)));
    const manual = Object.entries(h.cells).flatMap(([k, byP]) => Object.entries(byP).filter(([, c]) => c.manual).map(([pid, c]) => `<li>${esc(k)} ${esc(pid)}: ${plain(fmt(c.v))}${c.note ? ' — ' + esc(c.note) : ''} (${esc(String(c.at).slice(0, 10))})</li>`));
    const nts = Object.entries(cur.notes).filter(([, v]) => v && v.trim());
    return pageHead('Sources & research notes', 'Every filing the historical statements come from, your manual entries, and all your research notes.')
      + panel('Filings used', fil.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Form</th><th>Accession</th><th>Period end</th><th>Filed</th><th>Figures</th></tr></thead><tbody>${fil.map(f => `<tr><td>${esc(f.form)}</td><td>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.accn)}</a>` : esc(f.accn)}</td><td>${esc(f.end || '')}</td><td>${esc(f.filed || '')}</td><td>${f.n}</td></tr>`).join('')}</tbody></table></div>` : `<p class="footnote">${h.provider ? esc(h.provider) + ' figures carry no SEC accession numbers.' : 'Nothing imported yet.'}</p>`)
      + panel('Manual entries', manual.length ? `<ul>${manual.join('')}</ul>` : '<p class="footnote">None.</p>')
      + panel('Research notes', nts.length ? nts.map(([k, v]) => `<h3>${esc(k)}</h3><p class="fs-pre">${esc(v)}</p>`).join('') : '<p class="footnote">No notes yet. Each page and assumption group has a "My research notes" box.</p>')
      + panel('References', H.refs()) + notes('general', 'general');
  };
  P.saved = () => {
    const list = Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated));
    return pageHead('Saved models', 'Three-statement models are saved in this browser, separately from DCF and Trading Comps models. Save versions to keep snapshots you can restore.')
      + panel('This model', `<label class="fs-set">Name<span class="inwrap"><input class="txt" id="fs-name" value="${esc(cur.name)}"></span></label>
        <div class="btns"><button class="btn primary" data-fs-version>Save a version</button><button class="btn" data-fs-dup="${cur.id}">Duplicate</button><button class="btn" data-fs-export="xlsx">Export to Excel</button><button class="btn" data-fs-export="pdf">Summary report (PDF)</button><button class="btn" data-fs-export="json">Save model file</button><label class="btn">Open model file<input type="file" id="fs-open-file" accept=".json" hidden></label></div>
        ${cur.versions.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Version</th><th>Saved</th><th></th></tr></thead><tbody>${cur.versions.map(v => `<tr><td>${esc(v.label)}</td><td>${esc(String(v.at).slice(0, 16).replace('T', ' '))}</td><td><button class="btn tiny" data-fs-restore="${v.n}">Restore</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">No versions yet.</p>'}`)
      + panel('All three-statement models', list.length ? `<div class="tbl-wrap"><table class="fin"><thead><tr><th>Model</th><th>Company</th><th>Updated</th><th></th></tr></thead><tbody>${list.map(m => `<tr><td>${esc(m.name)}${m.id === cur.id ? ' <span class="tag src">open</span>' : ''}</td><td>${esc(m.company.ticker || m.company.name || '')}</td><td>${esc(String(m.updated).slice(0, 16).replace('T', ' '))}</td><td><button class="btn tiny" data-fs-open="${m.id}">Open</button> <button class="btn tiny" data-fs-dup="${m.id}">Duplicate</button> ${confirmDel === m.id ? `<button class="btn tiny danger" data-fs-del2="${m.id}">Confirm delete</button>` : `<button class="btn tiny danger" data-fs-del="${m.id}">Delete</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="footnote">None saved yet.</p>')
      + panel('Change log', `<ul class="fs-log">${cur.log.slice(0, 40).map(l => `<li>${esc(String(l.at).slice(0, 16).replace('T', ' '))} · ${esc(l.field)}${l.to !== null && l.to !== undefined ? ': ' + esc(typeof l.to === 'object' ? JSON.stringify(l.to) : l.to) : ''}</li>`).join('')}</ul>`);
  };

  // ---------- drawer: help, sources, inspector ----------
  function renderDrawer() {
    const root = $('#drawer-root');
    if (!drawer) { if (root.dataset.owner === 'fsm') root.innerHTML = ''; return; }
    root.dataset.owner = 'fsm';
    let h = '';
    if (drawer.type === 'help') {
      const g = H.G[drawer.key]; if (!g) { drawer = null; root.innerHTML = ''; return; }
      h = `<h2 id="fs-dr-title">${esc(g.t)}</h2>` + H.render(drawer.key, esc, ui.open) + `<details open><summary>My research notes</summary><textarea data-fnote="g-${esc(drawer.key)}" rows="4" placeholder="Saved with this model.">${esc(cur.notes['g-' + drawer.key] || '')}</textarea></details>` + companyLinks(g.q);
    } else if (drawer.type === 'cell') {
      const { k, pid, label } = drawer;
      const c = histCellSrc(k, pid); const s = c && c.src || {};
      const v = c ? c.v : null;
      const dl = [['Value', isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' ' + (s.unit || '') : 'missing (not reported or not tagged)'], ['Kind', c && c.manual ? 'Entered by the analyst' : (CAT[s.cat] || ['', s.cat || ''])[1]], ['Company', s.company ? `${s.company}${s.ticker ? ' (' + s.ticker + ')' : ''}` : null], ['Statement', s.statement], ['Concept / field', s.concept || s.field], ['Form', s.form ? `${s.form}${s.accn ? ' · ' + s.accn : ''}` : null], ['Fiscal period', s.fy ? `FY${s.fy} ${s.fp || ''}` : null], ['Reporting period', s.period], ['Filed', s.filed], ['Raw reported value', isNum(s.raw) ? s.raw.toLocaleString('en-US') + ' ' + (s.rawUnit || '') : null], ['Converted value', isNum(s.value) ? s.value.toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' ' + (s.unit || '') : null], ['Method', s.method], ['Retrieved', s.retrieved], ['Definition', s.definition]].filter(x => x[1]);
      const id = 'fs-man';
      h = `<h2 id="fs-dr-title">${esc(label)} · ${esc(pid)}</h2><dl>${dl.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
        ${s.url ? `<p><a href="${esc(s.url)}" target="_blank" rel="noopener">Open the filing</a></p>` : ''}
        ${s.parts && s.parts.length ? `<h3>Built from</h3><ul>${s.parts.map(p => `<li>${esc(p.metric || p.concept || '')}: ${isNum(p.value) ? p.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''} ${esc(p.period || '')} ${p.form ? esc(p.form) : ''} ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">filing</a>` : ''}</li>`).join('')}</ul>` : ''}
        ${c && c.proposed ? `<div class="notice">The latest import reports ${plain(fmt(c.proposed.v))} for this figure. <button class="btn tiny" data-fs-acceptprop="${esc(k)}|${esc(pid)}">Use the imported figure</button></div>` : ''}
        ${k ? `<h3>Enter or correct this figure</h3><p class="footnote">For a figure the import could not classify or that is missing. Enter 0 only if the filing reports zero. Your figure is kept on re-import; the imported value stays on record.</p>
        <label class="fs-set">Value ($mm)<span class="inwrap"><input id="${id}" value="${c && c.manual ? toIn(c.v) : ''}" inputmode="decimal"></span></label><label class="fs-set">Source or reason<span class="inwrap"><input class="txt" id="fs-man-note" value="${esc(c && c.manual ? c.note : '')}" placeholder="e.g. 10-K p.38, segment note"></span></label>
        <div class="btns"><button class="btn primary" data-fs-man="${esc(k)}|${esc(pid)}">Save my figure</button>${c && c.manual ? `<button class="btn" data-fs-unman="${esc(k)}|${esc(pid)}">Restore the imported figure</button>` : ''}</div>` : ''}
        ${c && c.orig ? `<p class="footnote">Imported value on record: ${plain(fmt(c.orig.v))} (${esc((c.orig.src || {}).concept || (c.orig.src || {}).field || '')}).</p>` : ''}
        <button class="btn" data-fs-copy>Copy details</button>`;
    } else if (drawer.type === 'insp') {
      const { r } = calc(); const y = r.ok ? r.years[drawer.i] : null; const tr = y && y.tr && y.tr[drawer.k];
      const lab = cols().fc[drawer.i];
      if (!tr) h = `<h2 id="fs-dr-title">${esc(drawer.label)}</h2><p>No formula trace for this line.</p>`;
      else {
        const res = drawer.k === 'tax' ? y.tax : drawer.k === 'sharesEnd' ? y.sharesEnd : y[drawer.k];
        h = `<h2 id="fs-dr-title">${esc(drawer.label)} · ${esc(lab ? lab.label : '')} (${esc(scen())})</h2><div class="formula"><b>${esc(tr.f)}</b></div>
          <table class="fin"><tbody>${tr.p.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${typeof b === 'number' ? (Math.abs(b) < 5 && b % 1 !== 0 ? (b * 100).toFixed(3) + '%' : b.toLocaleString('en-US', { maximumFractionDigits: 2 })) : esc(b)}</td></tr>`).join('')}<tr class="key"><td>Result</td><td>${isNum(res) ? res.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</td></tr></tbody></table>
          <p class="footnote">Upstream values are this year's schedule results; "prior" values are last year's (or the opening balance sheet for year 1).</p><button class="btn" data-fs-copy>Copy calculation</button>`;
      }
    }
    root.innerHTML = `<div class="scrim" data-fs-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="fs-dr-title"><button class="btn close" data-fs-close aria-label="Close">Close</button>${h}</aside>`;
    const cl = root.querySelector('.close'); if (cl) cl.focus();
  }
  function companyLinks(q) {
    const cik = cur.company.cik ? String(cur.company.cik).replace(/^0+/, '') : null;
    if (!cik) return '<p class="footnote">Import a company to get direct links to its own filings here.</p>';
    return `<p class="footnote"><b>For ${esc(cur.company.ticker || cur.company.name)}:</b> <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-&dateb=&owner=include&count=40" target="_blank" rel="noopener">10-K and 10-Q filings on EDGAR</a>${q ? ` · <a href="https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"' + q + '"')}&ciks=${cik.padStart(10, '0')}" target="_blank" rel="noopener">search its filings for “${esc(q)}”</a>` : ''}</p>`;
  }
  function renderModal() {
    const root = $('#modal-root');
    if (!modal) { if (root.dataset.owner === 'fsm') root.innerHTML = ''; return; }
    root.dataset.owner = 'fsm';
    if (modal.type === 'confirm') {
      root.innerHTML = `<div class="scrim mscrim" data-fs-close-modal></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="fs-md-title"><h2 id="fs-md-title">${esc(modal.title)}</h2><p>${esc(modal.text)}</p><div class="btns"><button class="btn primary" data-fs-confirm>${esc(modal.ok || 'Continue')}</button><button class="btn" data-fs-close-modal>Cancel</button></div></div>`;
      return;
    }
    root.innerHTML = `<div class="scrim mscrim" data-fs-close-modal></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="fs-md-title"><button class="btn close" data-fs-close-modal aria-label="Close">Close</button>
      <h2 id="fs-md-title">Data source</h2>
      <p class="footnote">Ticker import uses Financial Modeling Prep, with the same key as the DCF calculator. Without a key, load the SEC company facts file on Company selection: it is the primary source and is reused for every model of that company.</p>
      <label>API key <span class="inwrap"><input type="password" id="fs-key" value="${esc(fmpKey() || '')}" autocomplete="off"></span></label>
      <label class="cx-chk"><input type="checkbox" id="fs-key-rem" ${dataCfg().remember ? 'checked' : ''}> Remember the key on this computer</label>
      <div class="btns"><button class="btn primary" data-fs-key-save>Save</button><a class="footnote" href="https://site.financialmodelingprep.com/developer/docs" target="_blank" rel="noopener">Get a key</a></div></div>`;
  }

  // ---------- render ----------
  function render() {
    if (!active()) return;
    if (!booted) boot();
    cache = null;
    const act = document.activeElement && document.activeElement.id;
    document.body.dataset.page = 'fsm-' + page();
    renderTop(); renderRail();
    $('#main').innerHTML = `<div class="page fs-page">${P[page()]()}</div>`;
    renderDrawer(); renderModal();
    document.title = (cur.company.name ? cur.company.name + ' · ' : '') + 'Three-Statement Model · DCF Pro';
    if (act) { const el = document.getElementById(act); if (el && el.tagName !== 'BUTTON') el.focus({ preventScroll: true }); }
  }
  function boot() {
    booted = true;
    models = M.loadAll();
    const id = M.getCurrent();
    cur = (id && models[id]) || Object.values(models).sort((a, b) => b.updated.localeCompare(a.updated))[0] || M.blank();
  }
  function dcfModels() { try { return typeof DCFModel !== 'undefined' ? Object.values(DCFModel.loadAll()).sort((a, b) => b.updated.localeCompare(a.updated)) : []; } catch (e) { return []; } }

  // ---------- imports ----------
  function afterImport(imp, label) {
    const res = D.apply(cur, imp);
    const ini = M.initFromHistory(cur);
    change('imported', null, `${label} (${imp.meta.provider})`);
    msg = { level: 'good', text: `${label}: ${imp.periods.length} fiscal years${imp.ttm ? ' and a TTM column (' + imp.ttm.end + ')' : ''} imported from ${imp.meta.provider}. ${res.kept ? res.kept + ' manual figure(s) kept' + (res.proposed ? ', ' + res.proposed + ' differ from the import (review on Historical data)' : '') + '. ' : ''}${ini.notes.join(' ')} Forecast assumptions were not changed.` };
  }
  async function importTicker(sym) {
    sym = String(sym || '').trim().toUpperCase(); if (!sym) return;
    const key = fmpKey(); if (!key) { modal = { type: 'data' }; render(); return; }
    if (cur.company.ticker && cur.company.ticker !== sym && cur.hist.periods.length) { modal = { type: 'confirm', title: `Replace ${cur.company.ticker} with ${sym}?`, text: `This model holds ${cur.company.ticker}'s statements. Importing ${sym} replaces them (your assumptions stay). To keep both, create a new model first.`, ok: 'Replace', act: () => doFmp(sym, key) }; render(); return; }
    doFmp(sym, key);
  }
  async function doFmp(sym, key) {
    busy = `Importing ${sym} from Financial Modeling Prep…`; msg = null; render();
    try { const imp = await D.fetchFMP(sym, key); busy = null; afterImport(imp, sym); }
    catch (e) { busy = null; msg = { level: 'bad', text: friendly(e) }; }
    render();
  }
  function friendly(e) { const m = (e && e.message) || String(e); if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach Financial Modeling Prep. Check the connection, or load the SEC company facts file instead.'; if (/api ?key|apikey|invalid/i.test(m)) return 'The provider did not accept the API key (' + m + ').'; return m; }
  function loadSec(el) {
    const files = Array.from(el.files || []); if (!files.length) return;
    Promise.all(files.map(f => f.text().then(t => JSON.parse(t)))).then(js => {
      let facts = js.find(j => j.facts && (j.facts['us-gaap'] || (j.facts.facts && j.facts.facts['us-gaap'])));
      let subs = js.find(j => j.filings || (j.subs && j.subs.filings));
      if (facts && facts.facts && facts.facts.facts) { subs = subs || facts.subs; facts = facts.facts; }
      if (subs && subs.subs) subs = subs.subs;
      if (!facts) throw new Error('None of the files is an SEC company facts file.');
      if (typeof SecCache !== 'undefined') SecCache.put(facts, subs);
      fromSecJson(facts, subs);
    }).catch(e => { msg = { level: 'bad', text: e.message && e.message.length < 200 ? e.message : 'That file could not be read as SEC company facts.' }; render(); });
  }
  function fromSecJson(facts, subs) {
    const cik = String(facts.cik || '').padStart(10, '0');
    const go = () => { try { const imp = D.fromSEC(facts, subs, { ticker: cur.company.ticker }); afterImport(imp, imp.meta.company.name); } catch (e) { msg = { level: 'bad', text: e.message }; } render(); };
    if (cur.company.cik && String(cur.company.cik).padStart(10, '0') !== cik && cur.hist.periods.length) { modal = { type: 'confirm', title: 'Replace this company?', text: `This model holds ${cur.company.name || cur.company.ticker}'s statements (CIK ${+cur.company.cik}). The file is for ${facts.entityName} (CIK ${+cik}). Replace the statements? Your assumptions stay.`, ok: 'Replace', act: go }; render(); return; }
    go();
  }
  function fromDcf(id) {
    const m = dcfModels().find(x => x.id === id); if (!m) return;
    const d = D.fromDCF(m);
    ['name', 'ticker', 'cik', 'industry', 'currency', 'priceDate', 'valDate'].forEach(k => { if (d[k]) cur.company[k] = d[k]; });
    if (isNum(d.price)) { cur.company.price = d.price; cur.equity.price0 = d.price; cur.equity.priceSrc = { provider: 'DCF model "' + m.name + '"', date: d.priceDate }; }
    if (!cur.name || /^New three-statement/.test(cur.name)) cur.name = (d.ticker || d.name || 'Company') + ' three-statement model';
    cur.dcfLinks = (cur.dcfLinks || []).filter(x => x.id !== m.id).concat([{ id: m.id, name: m.name, at: new Date().toISOString() }]);
    change('company from DCF', null, m.name);
    msg = { level: 'good', text: `Company details and share price copied from DCF "${m.name}". The DCF model was not changed.` };
    // automatic statements import: cached SEC file first, then the provider
    const cached = d.cik && typeof SecCache !== 'undefined' ? SecCache.getSync(d.cik) : null;
    if (cached) { fromSecJson(cached.facts, cached.subs); return; }
    if (typeof SecCache !== 'undefined' && d.cik) { SecCache.get(d.cik).then(x => { if (x) fromSecJson(x.facts, x.subs); else if (fmpKey() && d.ticker) doFmp(d.ticker, fmpKey()); else { msg.text += ' Load the SEC company facts file below to import the statements.'; render(); } }); return; }
    if (fmpKey() && d.ticker) { doFmp(d.ticker, fmpKey()); return; }
    msg.text += ' Load the SEC company facts file below (or connect Financial Modeling Prep) to import the statements.';
    render();
  }
  let searchT = null;
  async function search(q) {
    const S = ui.search; S.q = q; S.results = []; S.error = null;
    if (!q || !fmpKey()) { renderResults(); return; }
    S.busy = true; renderResults();
    try { const res = await fetch(`https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&apikey=${encodeURIComponent(fmpKey())}`); const j = await res.json(); if (S.q !== q) return; S.results = Array.isArray(j) ? j.slice(0, 10).map(r => ({ symbol: r.symbol, name: r.name, exchange: r.exchange || r.exchangeFullName || '' })) : []; if (!Array.isArray(j)) S.error = (j && (j['Error Message'] || j.message)) || 'Search failed.'; }
    catch (e) { S.error = friendly(e); }
    S.busy = false; renderResults();
  }

  // ---------- assumption tools ----------
  function arrOf(k, sc) { return sc === 'SH' ? cur.shared[k] : cur.asm[sc][k]; }
  function tool(act, k) {
    const s = scen(); const d = E.DBY[k]; const sc = d.sc ? s : 'SH'; const a = arrOf(k, sc);
    if (act === 'fill') { const v = a.find(isNum); if (!isNum(v)) { toast('Enter year 1 first.'); return; } for (let i = 0; i < N; i++) a[i] = v; }
    if (act === 'interp') { if (!isNum(a[0]) || !isNum(a[N - 1])) { toast('Enter year 1 and year 10 first.'); return; } for (let i = 1; i < N - 1; i++) a[i] = a[0] + (a[N - 1] - a[0]) * i / (N - 1); }
    if (act === 'copybase') { if (s === 'Base') { toast('This is the Base scenario.'); return; } cur.asm[s][k] = cur.asm.Base[k].slice(); }
    if (act === 'hist') { const { refs } = calc(); const rk = { maint: 'capex', gcapex: 'capex', dep: cur.settings.depMethod === 'pctPPE' ? 'depPPE' : 'dep', flRate: 'intRate', div: 'payout' }[k] || k; const v = refs[rk] && refs[rk].avg3; if (!isNum(v)) { toast('No historical reference for this input.'); return; } for (let i = 0; i < N; i++) a[i] = ['maint', 'gcapex'].includes(k) ? v / 2 : v; cur.reviewed[k] = false; }
    if (act === 'ok') { cur.reviewed[k] = true; }
    change(`${k} (${sc}) ${act}`, null, null); render();
  }

  // ---------- events ----------
  function readNum(el) {
    const u = el.dataset.u || 'mm'; const p = parse(el.value, u === 'pct' ? 'pct' : 'num');
    if (p.error) { errs[el.id] = { text: el.value, msg: p.error }; return { error: true }; }
    delete errs[el.id]; return { v: p.v };
  }
  document.addEventListener('change', e => {
    if (!active()) return;
    const el = e.target, d = el.dataset;
    if (d.fa) { const [k, sc, i] = d.fa.split('|'); const r = readNum(el); if (r.error) { render(); return; } const a = arrOf(k, sc); const from = a[+i]; a[+i] = r.v; if (cur.reviewed[k] === false) cur.reviewed[k] = true; change(`${k} ${sc} year ${+i + 1}`, from, r.v); render(); return; }
    if (d.fnum) { const r = readNum(el); if (r.error) { render(); return; } const from = getPath(d.fnum); setPath(d.fnum, r.v); change(d.fnum, from, r.v); render(); return; }
    if (d.fset) { const from = getPath(d.fset); setPath(d.fset, el.value); change(d.fset, from, el.value); render(); return; }
    if (d.fsetBool) { const p = d.fsetBool; const v = p === 'settings.layout' ? (el.checked ? 'expanded' : 'compact') : el.checked; setPath(p, v); change(p, null, v); render(); return; }
    if (d.fco) { cur.company[d.fco] = el.value.trim() || null; cur.company[d.fco + 'Manual'] = true; change('company ' + d.fco, null, el.value); render(); return; }
    if (d.ftr) { const [id, f, i] = d.ftr.split('|'); const t = cur.debt.tranches.find(x => x.id === id); const r = readNum(el); if (r.error) { render(); return; } t[f] = t[f] || M.nulls(); t[f][+i] = r.v; change(`debt ${t.name} ${f} y${+i + 1}`, null, r.v); render(); return; }
    if (d.ftrf) { const [id, f] = d.ftrf.split('|'); const t = cur.debt.tranches.find(x => x.id === id); if (f === 'open') { const r = readNum(el); if (r.error) { render(); return; } t.open = r.v; } else t[f] = el.value; change(`debt ${t.name} ${f}`, null, t[f]); render(); return; }
    if (d.fseg) { const [j, f, i] = d.fseg.split('|'); const sg = cur.segments[+j]; if (f === 'name') sg.name = el.value; else { const r = readNum(el); if (r.error) { render(); return; } if (f === 'rev0') sg.rev0 = r.v; else { sg.g = sg.g || {}; SC.forEach(s => { sg.g[s] = sg.g[s] || M.nulls(); }); sg.g[scen()][+i] = r.v; } } change('segment ' + (sg.name || j), null, null); render(); return; }
    if (d.fnote) { cur.notes[d.fnote] = el.value; change('note ' + d.fnote, null, null); return; }
    if (d.fcalc) { ui.calc = ui.calc || { a: 1000, b: 36500 }; const p = parse(el.value, 'num'); ui.calc[d.fcalc] = p.v; render(); return; }
    if (d.fsLearn !== undefined) { cur.ui.learn = el.checked; persist(); render(); return; }
    if (d.fsReviewed !== undefined) { cur.hist.reviewed = Object.assign({}, cur.hist.reviewed, { all: el.checked }); change('historical review', null, el.checked); render(); return; }
    if (el.id === 'fs-model') { cur = models[el.value] || cur; M.setCurrent(cur.id); drawer = null; msg = null; render(); return; }
    if (el.id === 'fs-dcf-src') { ui.dcfSel = el.value; return; }
    if (el.id === 'fs-dcf-link') { ui.dcfSel = el.value; render(); return; }
    if (el.id === 'fs-name') { cur.name = el.value.trim() || cur.name; change('renamed', null, cur.name); render(); return; }
    if (el.id === 'fs-sec-file') return loadSec(el);
    if (el.id === 'fs-open-file') { const fl = el.files[0]; if (!fl) return; fl.text().then(t => { const m = M.upgrade(JSON.parse(t)); if (m.kind !== 'fsm') throw new Error('x'); if (models[m.id]) m.id = M.uid(); cur = m; persist(); render(); toast('Opened ' + m.name); }).catch(() => toast('That file is not a three-statement model file.')); return; }
  });
  document.addEventListener('toggle', e => { if (!active()) return; const d = e.target; if (d && d.dataset && d.dataset.k) ui.open[d.dataset.k] = d.open; }, true);
  document.addEventListener('input', e => { if (!active()) return; if (e.target.id === 'fs-search') { const q = e.target.value.trim(); ui.search.open = true; clearTimeout(searchT); searchT = setTimeout(() => search(q), 300); } });
  document.addEventListener('focusin', e => { if (active() && e.target.id === 'fs-search') { ui.search.open = true; renderResults(); } });
  document.addEventListener('keydown', e => {
    if (!active()) return;
    if (e.key === 'Escape' && (drawer || modal)) { drawer = null; modal = null; render(); return; }
    if (e.key === 'Enter' && e.target.id === 'fs-search') { e.preventDefault(); ui.search.open = false; importTicker(e.target.value); e.target.value = ''; }
  });
  function setDcfSource(mode) {
    const id = ($('#fs-dcf-link') || {}).value; if (!id || typeof DCFModel === 'undefined') return;
    const all = DCFModel.loadAll(); const m = all[id]; if (!m) return;
    const prev = m.forecastSource ? m.forecastSource.mode : 'original';
    m.forecastSource = mode === 'linked' ? { mode: 'linked', fsmId: cur.id, fsmName: cur.name, fsmVersion: M.versionNo(cur), linkedAt: new Date().toISOString() } : { mode: 'original', fsmId: m.forecastSource && m.forecastSource.fsmId || null };
    m.fsmLog = [{ at: new Date().toISOString(), text: mode === 'linked' ? `Forecast source set to the linked three-statement model "${cur.name}" (version ${M.versionNo(cur)})` : 'Forecast source set back to the original DCF assumptions' }].concat(m.fsmLog || []).slice(0, 100);
    if (DCFModel.save) DCFModel.save(m); else { all[id] = m; try { localStorage.setItem(DCFModel.KEY || 'dcfcalc.models.v1', JSON.stringify(all)); } catch (x) {} }
    cur.dcfLinks = (cur.dcfLinks || []).filter(x => x.id !== id).concat([{ id, name: m.name, at: new Date().toISOString(), mode }]);
    change('DCF forecast source', prev, mode);
    toast(mode === 'linked' ? `DCF "${m.name}" now uses this forecast. Its own assumptions are kept.` : `DCF "${m.name}" uses its original assumptions again.`);
    render();
  }
  document.addEventListener('click', e => {
    if (!active()) return;
    if (ui.search.open && !e.target.closest('.search')) { ui.search.open = false; renderResults(); }
    const b = e.target.closest('button, a, [data-fs-close], [data-fs-close-modal]'); if (!b) return;
    const d = b.dataset;
    if (d.fsClose !== undefined) { drawer = null; renderDrawer(); return; }
    if (d.fsCloseModal !== undefined) { modal = null; renderModal(); return; }
    if (d.fsConfirm !== undefined) { const act = modal && modal.act; modal = null; renderModal(); if (act) act(); return; }
    if (d.fhelp) { drawer = { type: 'help', key: d.fhelp }; renderDrawer(); return; }
    if (d.fcell) { const [k, pid, label] = d.fcell.split('|'); drawer = { type: 'cell', k, pid, label }; renderDrawer(); return; }
    if (d.finsp) { const [k, i, label] = d.finsp.split('|'); drawer = { type: 'insp', k, i: +i, label }; renderDrawer(); return; }
    if (d.fsCopy !== undefined) { const t = ($('.drawer') || {}).innerText || ''; try { navigator.clipboard.writeText(t.replace(/^Close\s*/, '')); toast('Copied.'); } catch (x) { toast('Copy is not available in this browser.'); } return; }
    if (b.id === 'fs-menu') { $('#rail').classList.toggle('open'); return; }
    if (b.closest('#rail') && b.tagName === 'A') { $('#rail').classList.remove('open'); return; }
    if (d.fsTheme) { document.documentElement.setAttribute('data-theme', d.fsTheme); try { localStorage.setItem('dcfcalc.theme', d.fsTheme); } catch (x) {} render(); return; }
    if (d.fscen) { cur.ui.scen = d.fscen; persist(); render(); return; }
    if (b.id === 'fs-save') { M.log(cur, 'saved', null, null); cur.savedAt = cur.log[0].at; persist(); toast('Saved ' + cur.name); render(); return; }
    if (b.id === 'fs-new') { cur = M.blank(); persist(); drawer = null; msg = null; location.hash = 'fsm/company'; render(); toast('New three-statement model'); return; }
    if (b.id === 'fs-data' || d.fsOpenData !== undefined) { modal = { type: 'data' }; renderModal(); return; }
    if (d.fsKeySave !== undefined) { saveKey((($('#fs-key') || {}).value || '').trim(), ($('#fs-key-rem') || {}).checked); modal = null; render(); toast('Data source saved.'); return; }
    if (d.fsImport) { ui.search.open = false; importTicker(d.fsImport); return; }
    if (d.fsFmp !== undefined) { importTicker(($('#fs-tk') || {}).value); return; }
    if (d.fsFromdcf !== undefined) { fromDcf(($('#fs-dcf-src') || {}).value); return; }
    if (d.fsCache) { SecCache.get(d.fsCache).then(x => { if (x) fromSecJson(x.facts, x.subs); }); return; }
    if (d.fsHistst) { ui.histSt = d.fsHistst; render(); return; }
    if (d.fsMan) { const [k, pid] = d.fsMan.split('|'); const p = parse(($('#fs-man') || {}).value, 'num'); if (p.error || p.v === null) { toast(p.error || 'Enter a number (0 only if the filing reports zero).'); return; } D.setManual(cur, k, pid, p.v, (($('#fs-man-note') || {}).value || '').trim()); D.reclassify(cur); change(`manual ${k} ${pid}`, null, p.v); drawer = null; render(); return; }
    if (d.fsUnman) { const [k, pid] = d.fsUnman.split('|'); D.setManual(cur, k, pid, null); D.reclassify(cur); change(`restored ${k} ${pid}`, null, null); drawer = null; render(); return; }
    if (d.fsAcceptprop) { const [k, pid] = d.fsAcceptprop.split('|'); const c = cur.hist.cells[k][pid]; cur.hist.cells[k][pid] = { v: c.proposed.v, src: c.proposed.src }; D.reclassify(cur); change(`accepted import ${k} ${pid}`, c.v, c.proposed.v); drawer = null; render(); return; }
    if (d.ftool) { const [act, k] = d.ftool.split('|'); tool(act, k); return; }
    if (d.fsFillhist) { const f = M.fillFromHistory(cur, d.fsFillhist); change('filled from history', null, f.length + ' inputs'); toast(f.length ? `${f.length} empty input(s) filled from history. Review each one.` : 'No empty inputs to fill.'); render(); return; }
    if (d.fsReviewall !== undefined) { Object.keys(cur.reviewed).forEach(k => cur.reviewed[k] = true); change('all assumptions reviewed', null, null); render(); return; }
    if (d.ftradd !== undefined) { cur.debt.tranches.push({ id: M.uid(), name: 'New tranche', kind: 'term', open: 0, rate: M.nulls(), repay: M.fill(0), borrow: M.fill(0), prepay: M.fill(0), other: M.fill(0) }); change('tranche added', null, null); render(); return; }
    if (d.ftrdel) { cur.debt.tranches = cur.debt.tranches.filter(t => t.id !== d.ftrdel); change('tranche removed', null, null); render(); return; }
    if (d.ftrtool) { const [id, act] = d.ftrtool.split('|'); const t = cur.debt.tranches.find(x => x.id === id); if (act === 'rate') { const v = t.rate.find(isNum); if (!isNum(v)) { toast('Enter the year-1 rate first.'); return; } t.rate = M.fill(v); } else ['repay', 'borrow', 'prepay', 'other'].forEach(f => { t[f] = (t[f] || M.nulls()).map(v => isNum(v) ? v : 0); }); change(`debt ${t.name} ${act}`, null, null); render(); return; }
    if (d.fsegadd !== undefined) { cur.segments.push({ name: '', rev0: null, g: { Base: M.nulls(), Bear: M.nulls(), Bull: M.nulls() } }); change('segment added', null, null); render(); return; }
    if (d.fsegdel) { cur.segments.splice(+d.fsegdel, 1); change('segment removed', null, null); render(); return; }
    if (d.fsDcfsrc) { setDcfSource(d.fsDcfsrc); return; }
    if (d.fsSccopy !== undefined) {
      const to = ($('#fs-sc-to') || {}).value, dg = Number(($('#fs-sc-g') || {}).value) / 100, dm = Number(($('#fs-sc-m') || {}).value) / 100;
      if (!isFinite(dg) || !isFinite(dm)) { toast('Enter the changes as numbers.'); return; }
      modal = { type: 'confirm', title: `Overwrite the ${to} scenario?`, text: `Its operating drivers will be replaced with Base, with growth ${dg >= 0 ? '+' : ''}${(dg * 100).toFixed(1)} pp and gross margin ${dm >= 0 ? '+' : ''}${(dm * 100).toFixed(1)} pp.`, ok: 'Overwrite', act: () => { E.SC_KEYS.forEach(k => { cur.asm[to][k] = cur.asm.Base[k].map(v => isNum(v) ? v + (k === 'g' ? dg : k === 'gm' ? dm : 0) : v); }); change(`${to} from Base`, null, { dg, dm }); render(); } };
      renderModal(); return;
    }
    if (d.fsVersion !== undefined) { const n = M.saveVersion(cur); change('version saved', null, n); toast('Version ' + n + ' saved.'); render(); return; }
    if (d.fsRestore) { modal = { type: 'confirm', title: 'Restore this version?', text: 'The current inputs are replaced by the saved version. Save a version first if you want to keep them.', ok: 'Restore', act: () => { const r = M.restoreVersion(cur, +d.fsRestore); if (r) { cur = r; persist(); toast('Version restored.'); } render(); } }; renderModal(); return; }
    if (d.fsOpen) { cur = models[d.fsOpen]; M.setCurrent(cur.id); msg = null; render(); return; }
    if (d.fsDup) { const m = M.duplicate(models[d.fsDup] || cur); cur = m; persist(); render(); toast('Duplicated as ' + m.name); return; }
    if (d.fsDel) { confirmDel = d.fsDel; render(); return; }
    if (d.fsDel2) { M.remove(d.fsDel2); models = M.loadAll(); if (cur.id === d.fsDel2) cur = Object.values(models)[0] || M.blank(); confirmDel = null; render(); toast('Model deleted.'); return; }
    if (d.fsExport) { doExport(d.fsExport); return; }
  });
  function download(name, data, type) { const blob = data instanceof Blob ? data : new Blob([data], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  async function doExport(kind) {
    const base = (cur.company.ticker || 'model') + ' three-statement ' + new Date().toISOString().slice(0, 10);
    if (kind === 'json') { download(base + '.json', JSON.stringify(cur, null, 1), 'application/json'); return; }
    if (kind === 'xlsx') { try { const blob = await FsmExport.xlsx(window.JSZip, cur); download(base + '.xlsx', blob); } catch (e) { toast('Excel export failed: ' + e.message); } return; }
    if (kind === 'pdf') { const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to open the printable report.'); return; } w.document.write(FsmExport.printHtml(cur)); w.document.close(); setTimeout(() => { try { w.print(); } catch (x) {} }, 400); }
  }
  window.addEventListener('hashchange', () => { if (active()) { drawer = null; render(); $('#main').scrollTop = 0; } });

  return { render, active, _test: { get cur() { return cur; }, set cur(m) { cur = m; cache = null; }, P, boot } };
})();
