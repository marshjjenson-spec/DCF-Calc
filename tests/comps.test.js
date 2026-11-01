// Trading Comps: every calculation re-done independently here (no engine helpers), plus data handling,
// persistence, exports and real SEC filings for several companies. Synthetic companies are labelled
// "SYN-" and are arithmetic fixtures only, never presented as company data.
global.DCFSec = require('../js/sec.js');
global.CompsEngine = require('../js/comps-engine.js');
global.CompsData = require('../js/comps-data.js');
global.CompsModel = require('../js/comps-model.js');
global.JSZip = require('../js/vendor/jszip.min.js');
const E = CompsEngine, D = CompsData, M = CompsModel, X = require('../js/comps-export.js'), H = require('../js/comps-help.js');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-9) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

// ---------- independent reference implementations ----------
const refPct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; if (!n) return null; const r = 1 + (n - 1) * q; const k = Math.floor(r), d = r - k; return k >= n ? s[n - 1] : s[k - 1] + d * (s[k] - s[k - 1]); }; // Excel PERCENTILE.INC by its rank definition
const refMedian = xs => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mk = (t, vals, role) => { const c = D.emptyCompany(role || 'peer'); c.ticker = t; c.name = 'Synthetic ' + t; c.reason = 'arithmetic fixture'; Object.entries(vals).forEach(([k, v]) => { c.v[k] = { v, src: { cat: 'manual', provider: 'test fixture' } }; }); c.priceDate = '2026-10-31'; return c; };

// ---------- a five-peer synthetic set ----------
const m = M.blank('SYN test');
m.target = mk('SYN-T', { price: 50, shares: 100, dilutive: 4, cash: 500, sti: 50, stBorrow: 10, ltdCurrent: 40, ltdNoncurrent: 1500, finLease: 30, opLease: 200, nci: 20, preferred: 0, rev_ttm: 4000, ebitda_ttm: 800, ebit_ttm: 500, eps_ttm: 3, ni_ttm: 300, fcf_ttm: 250, equity: 900, rev_ttm_prior: 3600, capex_ttm: 200 }, 'target');
const P = [[100, 10, 1100], [120, -2, 1400], [90, 7, 1200], [110, 9, 1500], [300, 20, 1300]];
m.peers = P.map(([px, eps, ebitda], i) => mk('SYN-' + i, { price: px, shares: 100, cash: 100, ltdNoncurrent: 200 + i * 10, stBorrow: 0, rev_ttm: 2000 + 100 * i, ebitda_ttm: ebitda, ebit_ttm: ebitda * 0.7, eps_ttm: eps, equity: 500 + i, fcf_ttm: 300, rev_ttm_prior: 1900 }));
const set = m.settings;

// market cap and EV, line by line
m.peers.forEach((c, i) => {
  const mc = P[i][0] * 100, ev = mc + 0 + (200 + i * 10) - 100;
  ok(`market cap ${c.ticker} = price × shares`, near(E.marketCap(c, set).v, mc));
  ok(`EV ${c.ticker} = market cap + debt − cash`, near(E.evBuild(c, set).v, ev));
});
const tEV = 50 * 100 + 10 + 40 + 1500 + 30 + 20 + 0 - 500 - 50; // op lease excluded by default
ok('target EV build: debt, finance leases, NCI, preferred, less cash and STI; operating leases excluded by default', near(E.evBuild(m.target, set).v, tEV));
ok('operating lease policy include adds the liability', near(E.evBuild(m.target, Object.assign({}, set, { leasePolicy: 'include' })).v, tEV + 200));
const tInc = JSON.parse(JSON.stringify(m.target)); tInc.inc = { opLease: true };
ok('per-company lease override beats the model default', near(E.evBuild(tInc, set).v, tEV + 200));
const tSti = JSON.parse(JSON.stringify(m.target)); tSti.inc = { sti: false };
ok('short-term investments can be left in EV', near(E.evBuild(tSti, set).v, tEV + 50));
const tNon = JSON.parse(JSON.stringify(m.target)); tNon.v.otherNonop = { v: 70, src: { cat: 'manual' } };
ok('other non-operating assets subtract only when ticked', near(E.evBuild(tNon, set).v, tEV) && (tNon.inc = { otherNonop: true }) && near(E.evBuild(tNon, set).v, tEV - 70));
ok('diluted share basis adds net dilutive shares', near(E.marketCap(m.target, { shareBasis: 'diluted' }).v, 50 * 104));
ok('diluted basis without dilutive shares is missing, not zero', E.marketCap(m.peers[0], { shareBasis: 'diluted' }).v === null);

// missing data stays missing
const noCash = JSON.parse(JSON.stringify(m.peers[0])); delete noCash.v.cash;
ok('missing cash makes EV incomplete (never zero)', E.evBuild(noCash, set).v === null && E.evBuild(noCash, set).missing.includes('cash'));
const noDebt = JSON.parse(JSON.stringify(m.peers[0])); ['stBorrow', 'ltdCurrent', 'ltdNoncurrent', 'finLease'].forEach(k => delete noDebt.v[k]);
ok('no debt line at all is reported as missing debt', E.evBuild(noDebt, set).missing.includes('debt'));
const noPrice = JSON.parse(JSON.stringify(m.peers[0])); delete noPrice.v.price;
ok('missing price: market cap and EV missing; multiple is N/A', E.marketCap(noPrice, set).v === null && E.multiple(noPrice, 'ev_ebitda', 'ttm', set).status === 'na');

// multiples and N/M
m.peers.forEach((c, i) => {
  const mc = P[i][0] * 100, ev = mc + (200 + i * 10) - 100;
  ok(`EV/EBITDA ${c.ticker}`, near(E.multiple(c, 'ev_ebitda', 'ttm', set).v, ev / P[i][2]));
  ok(`EV/Revenue ${c.ticker}`, near(E.multiple(c, 'ev_rev', 'ttm', set).v, ev / (2000 + 100 * i)));
  ok(`EV/EBIT ${c.ticker}`, near(E.multiple(c, 'ev_ebit', 'ttm', set).v, ev / (P[i][2] * 0.7)));
  ok(`P/B ${c.ticker}`, near(E.multiple(c, 'pb', 'cur', set).v, mc / (500 + i)));
  ok(`P/FCF ${c.ticker}`, near(E.multiple(c, 'p_fcf', 'ttm', set).v, mc / 300));
  const pe = E.multiple(c, 'pe', 'ttm', set);
  ok(`P/E ${c.ticker}: ${P[i][1] > 0 ? 'price ÷ EPS' : 'negative EPS is N/M'}`, P[i][1] > 0 ? near(pe.v, P[i][0] / P[i][1]) : pe.status === 'nm');
});
const negEV = mk('SYN-CASHRICH', { price: 1, shares: 10, cash: 100, ltdNoncurrent: 0, rev_ttm: 50, ebitda_ttm: 5 });
ok('negative EV gives N/M for EV multiples', E.multiple(negEV, 'ev_ebitda', 'ttm', set).status === 'nm' && E.multiple(negEV, 'ev_rev', 'ttm', set).status === 'nm');
const zeroE = mk('SYN-ZERO', { price: 10, shares: 10, cash: 1, ltdNoncurrent: 1, rev_ttm: 50, ebitda_ttm: 0 });
ok('zero EBITDA gives N/M', E.multiple(zeroE, 'ev_ebitda', 'ttm', set).status === 'nm');

// statistics vs independent PERCENTILE.INC and outliers
const pe = m.peers.map((c, i) => P[i][1] > 0 ? P[i][0] / P[i][1] : null).filter(v => v !== null);
const colPE = E.column(m, 'pe', 'ttm');
ok('P/E statistics exclude the N/M observation (n = 4)', colPE.stats.n === 4 && colPE.nm === 1);
['q1', 'median', 'q3'].forEach((k, j) => ok(`P/E ${k} equals PERCENTILE.INC`, near(colPE.stats[k], refPct(pe, [0.25, 0.5, 0.75][j]))));
ok('P/E mean, min, max', near(colPE.stats.mean, pe.reduce((a, b) => a + b, 0) / pe.length) && near(colPE.stats.min, Math.min(...pe)) && near(colPE.stats.max, Math.max(...pe)));
const evE = m.peers.map((c, i) => (P[i][0] * 100 + (200 + i * 10) - 100) / P[i][2]);
const colE = E.column(m, 'ev_ebitda', 'ttm');
ok('EV/EBITDA median equals an independent median', near(colE.stats.median, refMedian(evE)));
const q1 = refPct(evE, 0.25), q3 = refPct(evE, 0.75), lo = q1 - 1.5 * (q3 - q1), hi = q3 + 1.5 * (q3 - q1);
const flags = evE.map(v => v < lo || v > hi);
ok('Tukey outlier flags match an independent calculation', colE.obs.every((o, i) => !!o.outlier === flags[i]) && flags.some(Boolean));
ok('flagged outliers stay in the statistics (not removed automatically)', colE.stats.n === 5);
for (let n = 1; n <= 9; n++) { const xs = Array.from({ length: n }, (_, i) => Math.round(Math.sin(i * 7.3 + n) * 1000) / 37); ok(`percentile n=${n}`, [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].every(q => near(E.percentile(xs.slice().sort((a, b) => a - b), q), refPct(xs, q)))); }
ok('fewer than four observations: no outlier test', E.outlierFlags([1, 2, 30]).fences === null);

// analyst exclusion of one observation (with reason) and peer status
const m2 = JSON.parse(JSON.stringify(m)); m2.peers[4].excludeObs = { 'ev_ebitda@ttm': { reason: 'one-off gain inflates EBITDA' } };
const c2 = E.column(m2, 'ev_ebitda', 'ttm');
ok('excluded observation leaves the statistics only after the analyst excludes it', c2.stats.n === 4 && near(c2.stats.median, refMedian(evE.slice(0, 4))) && c2.excludedObs === 1);
const m3 = JSON.parse(JSON.stringify(m)); m3.peers[0].status = 'excluded';
ok('removing a peer recalculates the statistics', E.column(m3, 'ev_ebitda', 'ttm').stats.n === 4 && near(E.column(m3, 'ev_ebitda', 'ttm').stats.median, refMedian(evE.slice(1))));
const m4 = JSON.parse(JSON.stringify(m)); m4.peers[1].status = 'broader';
ok('broader peers are only in the "core + broader" group', E.column(m4, 'ev_ebitda', 'ttm').stats.n === 4 && E.column(m4, 'ev_ebitda', 'ttm', { group: 'all' }).stats.n === 5);

// normalisation
const m5 = JSON.parse(JSON.stringify(m)); m5.peers[0].adj = [{ id: 'a', metric: 'ebitda', period: 'ttm', amount: 100, reason: 'restructuring', source: '10-K note 9' }];
ok('normalised EBITDA = reported + adjustments', near(E.metric(m5.peers[0], 'ebitda', 'ttm', true).v, 1200) && near(E.multiple(m5.peers[0], 'ev_ebitda', 'ttm', m5.settings).v, (10000 + 100) / 1200));
m5.settings.normalized = false;
ok('reported basis ignores adjustments', near(E.multiple(m5.peers[0], 'ev_ebitda', 'ttm', m5.settings).v, 10100 / 1100));

// implied valuation: EV multiple with bridge
m.selection.premium = 0.05;
const b = E.benchmark(m);
ok('benchmark = median × (1 + premium)', near(b.selected, refMedian(evE) * 1.05));
const imp = E.implied(m, b.selected);
const iEV = b.selected * 800, iEq = iEV - (10 + 40 + 1500 + 30 + 20 - 500 - 50), iPS = iEq / 100;
ok('implied EV = multiple × target EBITDA', near(imp.ev, iEV));
ok('implied equity = EV − net claims (same lines as the EV build)', near(imp.equity, iEq));
ok('implied value per share = equity ÷ shares', near(imp.perShare, iPS));
ok('upside = value ÷ price − 1', near(imp.upside, iPS / 50 - 1));
ok('bridge lines carry their sign; zero lines are not negative zero', imp.bridge.every(l => !Object.is(l.v, -0) && (l.sign === 1 || l.sign === -1)));
// P/E: no bridge
const iPE = E.implied(m, 15, { multiple: 'pe', period: 'ttm' });
ok('P/E: value per share = multiple × EPS with no bridge', near(iPE.perShare, 45) && !iPE.bridge && iPE.steps[0].label.includes('no enterprise-to-equity bridge'));
const iPB = E.implied(m, 2, { multiple: 'pb', period: 'cur' });
ok('P/B: equity = multiple × book, then per share', near(iPB.equity, 1800) && near(iPB.perShare, 18));
const neg = JSON.parse(JSON.stringify(m)); neg.target.v.ebitda_ttm.v = -50;
ok('negative target metric: no value, clear reason', E.implied(neg, 8).perShare === null && /negative/.test(E.implied(neg, 8).error));
const noT = JSON.parse(JSON.stringify(m)); delete noT.target.v.cash;
ok('missing target cash stops the bridge (no silent zero)', E.implied(noT, 8).perShare === null && /cash/.test(E.implied(noT, 8).error));

// range and sensitivity
const rg = E.range(m);
ok('range rows at peer Q1, median, Q3 (before premium)', near(rg.rows[0].mult, refPct(evE, 0.25)) && near(rg.rows[1].mult, refMedian(evE)) && near(rg.rows[2].mult, refPct(evE, 0.75)));
m.selection.analyst = { low: 7, central: 8, high: 9, why: 'test' };
ok('analyst range values', E.range(m).arows.length === 3 && near(E.range(m).arows[1].perShare, (8 * 800 - (iEV - iEq)) / 100));
const sg = E.sensGrid(m, { multStep: 1, multN: 5, metStep: 0.1, metN: 3 });
ok('sensitivity grid: each cell = (m × metric × (1+d) − net claims) ÷ shares', sg.grid.every((row, i) => row.every((cell, j) => near(cell.perShare, (sg.mults[i] * 800 * (1 + sg.deltas[j]) - (iEV - iEq)) / 100))));
ok('sensitivity centre row is the selected multiple', sg.mults.some(x => near(x, b.selected)));
const ps = E.peerSens(m);
ok('peer sensitivity: removing each peer in turn', ps.rows.length === 5 && ps.rows.every(r => r.n === 4));

// TTM, NTM, growth, FX, DCF comparison
ok('TTM = FY + YTD − prior YTD', E.ttm(716924, 584069, 503538) === 797455);
ok('TTM needs all three parts', E.ttm(100, null, 50) === null);
const n1 = E.ntm(100, 120, '2025-12-31', '2026-12-31', '2026-10-31');
ok('NTM calendarisation: 61 of 365 days of FY+1 left', near(n1.w1, 61 / 365) && near(n1.v, (61 / 365) * 100 + (304 / 365) * 120));
ok('NTM after FY+1 year-end is refused', E.ntm(100, 120, '2025-12-31', '2026-12-31', '2027-01-15').v === null);
ok('growth = TTM ÷ prior TTM − 1', near(E.growth(m.target), 4000 / 3600 - 1));
const fxc = mk('SYN-FX', { price: 20, shares: 50, cash: 10, ltdNoncurrent: 40, rev_ttm: 300, ebitda_ttm: 60 }); fxc.currency = 'EUR'; fxc.priceCurrency = 'USD';
ok('different currencies without a rate: N/A with reason', E.multiple(fxc, 'ev_ebitda', 'ttm', set).status === 'na' && /exchange rate/.test(E.multiple(fxc, 'ev_ebitda', 'ttm', set).reason));
fxc.fx = { rate: 1.1, date: '2026-10-31', source: 'test' };
ok('FX: statement amounts converted to the price currency', near(E.evBuild(fxc, set).v, 1000 + 30 * 1.1) && near(E.multiple(fxc, 'ev_ebitda', 'ttm', set).v, (1000 + 33) / (60 * 1.1)));
const dc = E.dcfCompare(120, 100, 80);
ok('DCF comparison differences', near(dc.dcfVsComps, 0.2) && near(dc.gap, 20) && near(dc.compsVsPrice, 0.25));
ok('comparability: size test 0.25×–4×', E.comparability(m.target, m.peers[0]).res.some(x => x.key === 'size' && x.met === true));

// data handling: overrides, restore, pending review, references
const c = D.emptyCompany('peer'); D.applyImport(c, { provider: 'A', retrieved: 't1', values: { rev_ttm: { v: 100, src: { cat: 'sec', provider: 'A' } } }, info: {} });
ok('import fills blanks', E.val(c, 'rev_ttm') === 100);
D.setManual(c, 'rev_ttm', 110, 'analyst check');
ok('manual override keeps the previous value in history', E.val(c, 'rev_ttm') === 110 && c.v.rev_ttm.src.cat === 'manual' && c.v.rev_ttm.hist.length === 1);
const r2 = D.applyImport(c, { provider: 'B', retrieved: 't2', values: { rev_ttm: { v: 120, src: { cat: 'sec', provider: 'B' } } }, info: {} });
ok('re-import never overwrites a manual figure: proposed for review', E.val(c, 'rev_ttm') === 110 && r2.pending === 1 && c.pending.items[0].manual === true);
ok('apply-all skips manual figures unless allowed', D.applyPending(c, c.pending.items.map(x => x.id), false) === 0 && E.val(c, 'rev_ttm') === 110);
ok('a manual figure is replaced only when explicitly allowed', D.applyPending(c, c.pending.items.map(x => x.id), true) === 1 && E.val(c, 'rev_ttm') === 120 && !c.pending);
D.setManual(c, 'rev_ttm', 99);
ok('restore returns the last non-manual value', D.restore(c, 'rev_ttm') && E.val(c, 'rev_ttm') === 120);
c.ref = { dilutive: { v: 5, src: { cat: 'sec', provider: 'SEC' } } };
ok('reference values are not used until accepted', !E.has(c, 'dilutive') && D.useRef(c, 'dilutive', 'dilutive') && E.val(c, 'dilutive') === 5);
const q = D.quality(Object.assign(D.emptyCompany('peer'), { ticker: 'X' }), m);
ok('quality flags missing price, shares, EV and revenue', ['price', 'shares', 'ev', 'rev_ttm'].every(k => q.some(x => x.key === k && x.level === 'bad')));

// persistence, duplicate, templates (in-memory localStorage)
global.localStorage = { s: {}, getItem(k) { return this.s[k] ?? null; }, setItem(k, v) { this.s[k] = String(v); }, removeItem(k) { delete this.s[k]; } };
global.localStorage.setItem('dcfcalc.models', '{"dcf1":{"id":"dcf1"}}');
ok('save and reload a comps model', M.save(m) && M.loadAll()[m.id].peers.length === 5);
ok('comps models are stored apart from DCF models', localStorage.getItem('dcfcalc.models') === '{"dcf1":{"id":"dcf1"}}' && M.KEY !== 'dcfcalc.models');
const dup = M.duplicate(m);
ok('duplicate gets a new id and keeps the data', dup.id !== m.id && dup.peers.length === 5 && near(E.implied(dup, E.benchmark(dup).selected).perShare, E.implied(m, E.benchmark(m).selected).perShare));
const tpl = M.saveTemplate('SYN peers', m);
ok('template stores tickers and reasons, no financial data', tpl.peers.length === 5 && !JSON.stringify(tpl).includes('"v":'));
const fresh = M.blank(); ok('apply template adds peers once', M.applyTemplate(fresh, tpl) === 5 && M.applyTemplate(fresh, tpl) === 0);
const up = M.upgrade({ id: 'old', name: 'old', target: { ticker: 'A' }, peers: [{ ticker: 'B' }] });
ok('older saved models are upgraded with defaults', up.settings.leasePolicy === 'exclude' && up.peers[0].excludeObs && up.selection.analyst);
const comp = M.completion(m);
ok('completion checklist runs and is not 100% without a conclusion', comp.total > 10 && !comp.complete && comp.valued);

// help guides: ten-part structure and sources
Object.entries(H.G).forEach(([k, g]) => ok(`guide ${k} has every part`, g.t && g.what && g.why && g.find && g.calc && g.ex && g.interp && g.choose && g.mistakes && g.mistakes.length && g.src && g.src.length && g.src.every(s => H.S[s])));
Object.values(H.S).forEach(([t, u]) => ok('source link is https: ' + t, /^https:\/\//.test(u)));
ok('illustrative examples are labelled', Object.values(H.G).filter(g => /Illustrative/.test(g.ex)).length > 20);

// exports
const nm = X.notesMarkdown(m); ok('notes export lists peers and the valuation', nm.includes('SYN-0') && nm.includes('Selected multiple') && nm.includes('not an investment recommendation'));
const ph = X.printHtml(m); ok('printable summary has the implied value', ph.includes(E.implied(m, E.benchmark(m).selected).perShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
const pendM = JSON.parse(JSON.stringify(m)); pendM.target.pending = { provider: 'T', items: [{ id: 'x', key: 'cash', from: 500, to: 999, src: { provider: 'T' } }] };
const sheets = X.build(pendM);
const flat = JSON.stringify(sheets);
ok('workbook has valuation, comps, adjustments, sources and notes sheets', sheets.map(s => s.name).join() === 'Valuation,Comps,Adjustments,Sources,Notes');
ok('pending updates exported as not used', flat.includes('NOT used in any calculation') && flat.includes('PROPOSED UPDATES WAITING FOR REVIEW'));
ok('manual entries labelled as not independently verified', flat.includes('not independently verified'));
const vs = sheets[0].rows.find(r => r && r[0] === 'Implied value per share');
ok('workbook value per share is a formula with the app result cached', vs && vs[1].f && near(vs[1].v, E.implied(m, E.benchmark(m).selected).perShare));
ok('workbook statistics use QUARTILE.INC and MEDIAN formulas', flat.includes('QUARTILE.INC(') && flat.includes('MEDIAN('));
ok('N/M observations are formulas that return "N/M"', flat.includes('"N/M"'));

// ---------- real SEC filings (data.sec.gov company facts saved 2026-11-01) ----------
const FX = path.join(__dirname, 'fixtures', 'comps');
const load = t => { const f = path.join(FX, 'sec-' + t + '.json'); if (!fs.existsSync(f)) return null; return JSON.parse(fs.readFileSync(f, 'utf8')); };
const tickers = ['amzn', 'tsla', 'mstr', 'wmt', 'cost', 'gm', 'f', 'coin'];
const recs = {};
tickers.forEach(t => {
  const j = load(t); if (!j) { ok('fixture present: ' + t, false); return; }
  let imp; try { imp = D.fromSEC(j.facts, j.subs); } catch (e) { ok(`fromSEC ${t}: ${e.message}`, false); return; }
  const c = D.emptyCompany('peer'); D.applyImport(c, imp, { isNew: true }); recs[t] = { c, imp, j };
  ok(`${t}: revenue imported with an SEC source`, E.has(c, 'rev_fy') && /SEC/.test(c.v.rev_fy.src.provider) && c.v.rev_fy.src.url);
  ok(`${t}: no share price from SEC (prices come from the analyst or a market data source)`, !E.has(c, 'price'));
  ok(`${t}: every imported value has a source category`, Object.values(c.v).every(r => r.src && r.src.cat));
  const fy = c.v.rev_fy && c.v.rev_fy.src;
  if (E.has(c, 'rev_ttm') && c.v.rev_ttm.src.parts && c.v.rev_ttm.src.parts.length === 3) {
    const [a, y, p] = c.v.rev_ttm.src.parts.map(x => x.value);
    ok(`${t}: TTM revenue = FY + YTD − prior YTD from the filings`, near(E.val(c, 'rev_ttm'), a + y - p, 1e-9));
  }
});
if (recs.amzn) {
  const a = recs.amzn.c;
  ok('AMZN TTM revenue (mm) matches 716,924 + 584,069 − 503,538', near(E.val(a, 'rev_ttm'), 797455, 1e-6));
  ok('AMZN shares are the cover-page count, not a weighted average', a.v.shares && /EntityCommonStockSharesOutstanding/.test(a.v.shares.src.definition || '') && near(E.val(a, 'shares'), 10813.138306, 1e-9));
}
if (recs.mstr) {
  const s = recs.mstr.c;
  ok('MSTR: negative earnings give N/M P/E (not a negative multiple)', !(E.val(s, 'eps_ttm') > 0) ? (s.v.price = { v: 100, src: { cat: 'manual' } }, E.multiple(s, 'pe', 'ttm', {}).status !== 'ok') : true);
  ok('MSTR: digital assets offered as a reference, not added automatically', !!(s.ref && s.ref.crypto) && !E.has(s, 'otherNonop'));
}
['gm', 'f'].forEach(t => { if (!recs[t]) return; const c = recs[t].c; ok(`${t.toUpperCase()}: without LongTermDebt tags the debt is not set to zero`, !(E.val(c, 'ltdNoncurrent') === 0 && E.val(c, 'stBorrow') === 0 && !c.importNotes.length)); });
if (recs.f) ok('F: finance leases alone do not make EV complete when borrowings are untagged', E.evBuild(Object.assign(JSON.parse(JSON.stringify(recs.f.c)), {}), {}).missing.includes('debt'));
const finOnly = mk('SYN-FINONLY', { price: 10, shares: 10, cash: 5, finLease: 3, rev_ttm: 50, ebitda_ttm: 10 });
ok('finance leases alone: borrowings still reported missing', E.evBuild(finOnly, set).missing.includes('debt'));
['wmt', 'mstr', 'f'].forEach(t => { if (!recs[t]) return; const c = recs[t].c; ok(`${t.toUpperCase()}: shares only from the cover page (never filled from weighted averages)`, !E.has(c, 'shares') || /EntityCommonStockSharesOutstanding|cover/i.test(JSON.stringify(c.v.shares.src))); });
// a full comps set on real fundamentals: AMZN target vs WMT, COST, TSLA, GM, F; prices are explicit test inputs
if (Object.keys(recs).length === tickers.length) {
  const PX = { amzn: 220, wmt: 100, cost: 900, tsla: 400, gm: 70, f: 12, coin: 300, mstr: 300 }; // test inputs, not market quotes
  const mod = M.blank('SEC fundamentals, test prices');
  const prep = (t, role) => { const c = JSON.parse(JSON.stringify(recs[t].c)); c.role = role; c.id = D.uid(); c.v.price = { v: PX[t], src: { cat: 'manual', provider: 'test input' } }; c.priceDate = '2026-10-31'; c.reason = 'test'; c.status = 'core'; return c; };
  mod.target = prep('amzn', 'target'); mod.peers = ['wmt', 'cost', 'tsla', 'gm', 'f'].map(t => prep(t, 'peer'));
  mod.selection.multiple = 'ev_rev'; mod.selection.period = 'ttm';
  const col = E.column(mod, 'ev_rev', 'ttm');
  const vals = col.obs.filter(o => o.m.status === 'ok').map(o => o.m.v);
  ok('real fundamentals: EV/Revenue statistics match PERCENTILE.INC', !vals.length || (near(col.stats.median, refMedian(vals)) && near(col.stats.q1, refPct(vals, 0.25))));
  mod.peers.forEach(p => { const r = E.multiple(p, 'ev_rev', 'ttm', mod.settings); if (r.status === 'ok') { const e = E.evBuild(p, mod.settings); ok(`${p.ticker} EV/Revenue = EV ÷ TTM revenue`, near(r.v, e.v / E.val(p, 'rev_ttm'))); } else ok(`${p.ticker} EV/Revenue not available is explained`, !!r.reason); });
  const bb = E.benchmark(mod), ii = E.implied(mod, bb.selected);
  ok('real fundamentals: implied value or a stated reason', (typeof ii.perShare === 'number' && isFinite(ii.perShare)) || !!ii.error);
  ['tsla', 'mstr'].forEach(t => { const mm = JSON.parse(JSON.stringify(mod)); mm.target = prep(t, 'target'); const r = E.implied(mm, E.benchmark(mm).selected); ok(`${t.toUpperCase()} as a second/third target: value or a stated reason`, (typeof r.perShare === 'number' && isFinite(r.perShare)) || !!r.error); });
}

console.log(`comps: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
