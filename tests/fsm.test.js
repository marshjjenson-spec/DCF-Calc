// Three-Statement Model: independent recalculation on a synthetic company, real SEC filings for six companies
// (Amazon first), revolver and circularity, loss carryforwards, vintage depreciation, scenario independence,
// missing data, manual overrides, persistence, the DCF forecast link, the Excel export and the guides.
// Synthetic figures are labelled "SYN" and are arithmetic fixtures only, never presented as company data.
const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.DCFSec = require('../js/sec.js');
global.FsmEngine = require('../js/fsm-engine.js');
global.FsmData = require('../js/fsm-data.js');
global.FsmModel = require('../js/fsm-model.js');
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
global.JSZip = require('../js/vendor/jszip.min.js');
const E = FsmEngine, D = FsmData, M = FsmModel, X = require('../js/fsm-export.js'), H = require('../js/fsm-help.js');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-9) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
const fx = t => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fsm/sec-' + t + '.json'), 'utf8'));
const zeroRest = m => { E.SH_KEYS.forEach(k => { m.shared[k] = m.shared[k].map(v => v === null ? 0 : v); }); E.SC.forEach(s => E.SC_KEYS.forEach(k => { m.asm[s][k] = m.asm[s][k].map(v => v === null ? 0 : v); })); m.debt.tranches.forEach(t => { t.rate = t.rate.map(v => v === null ? 0.04 : v); t.repay = t.repay.map(v => v === null ? 0 : v); t.borrow = t.borrow.map(v => v === null ? 0 : v); }); return m; };
const fromFile = (t, set) => { const j = fx(t); const m = M.blank(t); Object.assign(m.settings, set || {}); D.apply(m, D.fromSEC(j.facts, j.subs)); M.initFromHistory(m); M.fillFromHistory(m); if (!E.isNum(m.equity.price0)) m.equity.price0 = 100; if (!E.isNum(m.equity.sharesOpen)) m.equity.sharesOpen = 300; return zeroRest(m); }; // price and (MSTR) share count are test inputs, not quotes

// ---------------- 1. synthetic company, recalculated independently ----------------
function synthetic() {
  const m = M.blank('SYN test');
  m.hist.periods = [{ id: 'FY2025', label: 'FY2025', start: '2025-01-01', end: '2025-12-31', kind: 'FY' }];
  const v = { rev: 1000, cogs: 600, sga: 200, oth: 0, ebit: 150, da: 50, sbc: 10, intInc: 0, intExp: 20, nonop: 0, pbt: 130, tax: 26, ni: 104,
    cash: 100, sti: 0, ar: 120, inv: 80, oca: 20, tca: 320, ppe: 500, rou: 0, gw: 0, intang: 0, dta: 0, olta: 30, ta: 850,
    ap: 90, accr: 40, defrev: 10, std: 0, cltd: 20, ocl: 0, tcl: 160, ltd: 380, opl: 0, finl: 0, dtl: 0, oltl: 10, tl: 550,
    cs: 1, apic: 99, re: 200, treas: 0, aoci: 0, oeq: 0, nci: 0, te: 300, tle: 850, se: 300 };
  Object.entries(v).forEach(([k, x]) => { m.hist.cells[k] = { FY2025: { v: x, src: { cat: 'calc', provider: 'SYN fixture' } } }; });
  m.equity.sharesOpen = 100; m.equity.price0 = 20;
  m.debt.tranches = [{ id: 't1', name: 'SYN term loan', kind: 'term', open: 400, rate: M.fill(0.05), repay: M.fill(20), borrow: M.fill(0), prepay: M.fill(0), other: M.fill(0) }];
  m.debt.revolver = { enabled: false, capacity: 0, rate: 0, open: 0 };
  const A = { g: 0.10, gm: 0.45, rnd: 0, sga: 0.18, oth: 0.02, sbc: 0.01, tax: 0.21, dso: 40, dio: 50, dpo: 60, accr: 0.04, defrev: 0.01, oca: 0.02, ocl: 0, maint: 0.04, gcapex: 0.03, dep: 0.05, acq: 0 };
  E.SC.forEach(s => Object.entries(A).forEach(([k, x]) => { m.asm[s][k] = M.fill(s === 'Bear' && k === 'g' ? 0.02 : x); }));
  E.SH_KEYS.forEach(k => { m.shared[k] = M.fill(0); });
  m.shared.yield = M.fill(0.03); m.shared.div = M.fill(0.25); m.shared.divMode = 'payout'; m.shared.minCash = M.fill(0); m.shared.amort = M.fill(0);
  m.settings.days = 365;
  return m;
}
{
  const m = synthetic();
  const r = E.run(m, 'Base');
  ok('synthetic model runs', r.ok);
  // independent year-by-year rebuild (opening-balance interest, embedded D&A, % of revenue depreciation)
  let p = { rev: 1000, cogs: 600, cash: 100, ppe: 500, ar: 120, inv: 80, oca: 20, ap: 90, accr: 40, defrev: 10, ocl: 0, re: 200, apic: 99, debt: 400 };
  const nwc0 = q => q.ar + q.inv + q.oca - q.ap - q.accr - q.defrev - q.ocl;
  for (let i = 0; i < 10; i++) {
    const y = r.years[i];
    const rev = p.rev * 1.10, cogsX = rev * 0.55, sgaX = rev * 0.18, othX = rev * 0.02, ebitda = rev - cogsX - sgaX - othX;
    const dep = rev * 0.05, capex = rev * 0.07, ppe = p.ppe + capex - dep, ebit = ebitda - dep;
    const cogs = cogsX; // D&A shown inside operating expenses by default (no D&A in cost of revenue)
    const ar = rev / 365 * 40, inv = cogs / 365 * 50, ap = cogs / 365 * 60, accr = rev * 0.04, defrev = rev * 0.01, oca = rev * 0.02;
    const q = { ar, inv, oca, ap, accr, defrev, ocl: 0 }, dNwc = nwc0(q) - nwc0(p);
    const repay = Math.min(20, p.debt), intExp = p.debt * 0.05, intInc = p.cash * 0.03;
    const pbt = ebit + intInc - intExp, tax = pbt * 0.21, ni = pbt - tax, div = Math.max(0, ni) * 0.25, sbc = rev * 0.01;
    const cfo = ni + dep + sbc - dNwc, cfi = -capex, cff = -repay - div, cash = p.cash + cfo + cfi + cff;
    ok(`SYN year ${i + 1} revenue`, near(y.rev, rev)); ok(`SYN year ${i + 1} EBIT`, near(y.ebit, ebit)); ok(`SYN year ${i + 1} PP&E`, near(y.ppe, ppe));
    ok(`SYN year ${i + 1} inventory on cost of revenue`, near(y.inv, inv)); ok(`SYN year ${i + 1} interest on opening debt`, near(y.intExp, intExp));
    ok(`SYN year ${i + 1} net income`, near(y.ni, ni)); ok(`SYN year ${i + 1} CFO`, near(y.cfo, cfo)); ok(`SYN year ${i + 1} cash from the cash flow`, near(y.cash, cash));
    ok(`SYN year ${i + 1} retained earnings roll-forward`, near(y.re, p.re + ni - div)); ok(`SYN year ${i + 1} APIC + SBC`, near(y.apic, p.apic + sbc));
    ok(`SYN year ${i + 1} balance sheet balances`, Math.abs(y.check) < 1e-6);
    ok(`SYN year ${i + 1} FCFF = NOPAT + D&A − CapEx − ΔNWC`, near(y.fcff, ebit * 0.79 + dep - capex - dNwc));
    p = Object.assign({}, q, { rev, cogs, cash, ppe, re: p.re + ni - div, apic: p.apic + sbc, debt: p.debt - repay });
  }
  ok('SYN every check passes', r.checks.every(c => c.status === 'pass'));
  // scenario independence: Bear growth differs, Base is untouched by Bear inputs
  const before = JSON.stringify(E.run(m, 'Base').years.map(y => y.fcff));
  m.asm.Bear.gm = M.fill(0.30);
  ok('changing Bear leaves Base unchanged', JSON.stringify(E.run(m, 'Base').years.map(y => y.fcff)) === before);
  ok('Bear uses its own growth', near(E.run(m, 'Bear').years[0].rev, 1020));
  // D&A presentation never changes EBIT
  const sep = JSON.parse(JSON.stringify(m)); sep.settings.daPresentation = 'separate';
  ok('D&A shown separately: EBIT unchanged', E.run(sep, 'Base').years.every((y, i) => near(y.ebit, r.years[i].ebit)));
  const cg = JSON.parse(JSON.stringify(m)); cg.settings.daAlloc = 'cogs';
  ok('D&A inside cost of revenue: gross profit lower, EBIT unchanged', E.run(cg, 'Base').years.every((y, i) => near(y.ebit, r.years[i].ebit) && y.gp < r.years[i].gp));
  // average-balance interest: converges and equals rate × average balances
  const av = JSON.parse(JSON.stringify(m)); av.settings.interest = 'average';
  const ra = E.run(av, 'Base');
  ok('average interest converges', ra.ok && ra.years.every(y => y.converged));
  ra.years.forEach((y, i) => { const pd = i ? ra.years[i - 1].debt : 400, pc = i ? ra.years[i - 1].cash + ra.years[i - 1].sti : 100;
    ok(`average interest year ${i + 1}`, near(y.intExp, (pd + y.debt) / 2 * 0.05, 1e-7)); ok(`average interest income year ${i + 1}`, near(y.intInc, (pc + y.cash + y.sti) / 2 * 0.03, 1e-7)); });
  ok('average interest: balance sheet still balances', ra.years.every(y => Math.abs(y.check) < 1e-6));
  // revolver: a large dividend forces draws; cash held at the minimum; capacity respected
  const rv = JSON.parse(JSON.stringify(m)); rv.shared.divMode = 'amount'; rv.shared.div = M.fill(200); rv.shared.minCash = M.fill(50); rv.debt.revolver = { enabled: true, capacity: 5000, rate: 0.06, open: 0, sweep: true };
  const rr = E.run(rv, 'Base');
  ok('revolver draws when cash would fall below the minimum', rr.years.some(y => y.revDraw > 0));
  ok('revolver keeps cash at or above the minimum', rr.years.every(y => y.cash >= 50 - 1e-6));
  ok('revolver: every check passes', rr.checks.every(c => c.status === 'pass'));
  const small = JSON.parse(JSON.stringify(rv)); small.debt.revolver.capacity = 10;
  const rs = E.run(small, 'Base');
  ok('revolver capped at capacity', rs.years.every(y => y.revolver <= 10 + 1e-9));
  ok('funding gap reported, not hidden', rs.checks.find(c => c.id === 'fund').status === 'fail');
  ok('funding gap: still balances (no plug)', rs.years.every(y => Math.abs(y.check) < 1e-6));
  // loss carryforwards
  const nl = JSON.parse(JSON.stringify(m)); nl.tax = { nolOpen: 300, nolUsable: 1, capPct: 0.8 };
  const rn = E.run(nl, 'Base'); const y1 = rn.years[0];
  ok('NOL: use limited to 80% of taxable income', near(y1.nolUsed, Math.min(300, y1.pbt * 0.8)));
  ok('NOL: tax on income after losses used', near(y1.tax, (y1.pbt - y1.nolUsed) * 0.21));
  ok('NOL: balance runs down', near(rn.years[0].nol, 300 - y1.nolUsed));
  ok('NOL: balances', rn.years.every(y => Math.abs(y.check) < 1e-6));
  const nr = JSON.parse(JSON.stringify(nl)); nr.settings.nolDTA = 'recognized'; nr.hist.cells.dta = { FY2025: { v: 63, src: { cat: 'calc' } } }; nr.hist.cells.olta.FY2025.v = 30 - 63 + 63; nr.hist.cells.ta.FY2025.v = 913; nr.hist.cells.oeq = { FY2025: { v: 63, src: { cat: 'calc' } } }; nr.hist.cells.te.FY2025.v = 363; nr.hist.cells.tle.FY2025.v = 913;
  const rr2 = E.run(nr, 'Base');
  ok('recognised NOL: deferred tax asset falls as losses are used', rr2.ok && rr2.years[0].dta < 63 && near(63 - rr2.years[0].dta, Math.min(rr2.years[0].nolUsed * 0.21, 63)));
  ok('recognised NOL: balances', rr2.ok && rr2.years.every(y => Math.abs(y.check) < 1e-6));
  // vintage depreciation, recomputed independently
  const vt = JSON.parse(JSON.stringify(m)); vt.settings.depMethod = 'vintage'; vt.ppeSched = { life: 5, remLife: 4, halfYear: false };
  const rv2 = E.run(vt, 'Base'); const adds = [];
  rv2.years.forEach((y, i) => { adds.push(y.capex); let d = i < 4 ? 500 / 4 : 0; adds.forEach((a, j) => { if (i - j < 5) d += a / 5; }); ok(`vintage depreciation year ${i + 1}`, near(y.dep, d)); });
  ok('vintage: balances', rv2.years.every(y => Math.abs(y.check) < 1e-6));
  // missing data stays missing
  const blank = M.blank('empty');
  const rb = E.run(blank, 'Base');
  ok('blank model does not run', !rb.ok && rb.missing.length > 0);
  const gap = synthetic(); gap.asm.Base.gm[3] = null;
  const rg = E.run(gap, 'Base');
  ok('one missing assumption stops the scenario (no zero fill)', !rg.ok && rg.missing.includes('gm'));
  ok('…and leaves the other scenarios running', E.run(gap, 'Bull').ok);
}

// ---------------- 2. real filings ----------------
const T = { amzn: 'AMAZON', aapl: 'Apple', wmt: 'Walmart', tsla: 'Tesla', mstr: 'Strategy', gm: 'General Motors' };
for (const t of Object.keys(T)) {
  const j = fx(t); const imp = D.fromSEC(j.facts, j.subs);
  ok(`${t}: five fiscal years imported`, imp.periods.length === 5);
  const pids = imp.periods.map(p => p.id).concat(imp.ttm ? ['TTM'] : []);
  pids.forEach(pid => { const g = k => imp.cells[k] && imp.cells[k][pid] ? imp.cells[k][pid].v : null; if (g('ta') === null) return;
    ok(`${t} ${pid}: total assets = liabilities + equity`, Math.abs(g('ta') - g('tl') - g('te')) <= 1); });
  ok(`${t}: every cell carries its source`, Object.values(imp.cells).every(byP => Object.values(byP).every(c => c.src && c.src.provider)));
  for (const set of [{}, { interest: 'average' }, { base: 'ttm' }, { daPresentation: 'separate', buyback: 'retire' }]) {
    const m = fromFile(t, set);
    E.SC.forEach(s => { const r = E.run(m, s);
      ok(`${t} ${JSON.stringify(set)} ${s}: runs`, r.ok);
      if (!r.ok) { console.log('   missing', r.missing); return; }
      // the opening balance sheet carries the filing's own rounding (GM's September 2026 10-Q: assets exceed liabilities + equity by 1): the forecast must add nothing to it
      ok(`${t} ${JSON.stringify(set)} ${s}: balance sheet balances every year (no new difference)`, Math.abs(r.open.x.check) <= 1 && r.years.every(y => Math.abs(y.checkMove) < 1e-6));
      ok(`${t} ${JSON.stringify(set)} ${s}: no check fails (funding gaps reported separately)`, r.checks.filter(c => c.id !== 'fund').every(c => c.status !== 'fail'));
      ok(`${t} ${JSON.stringify(set)} ${s}: cash comes from the cash flow statement`, r.years.every(y => near(y.cash, y.cashBeg + y.dCash, 1e-9)));
    });
  }
}
{
  const j = fx('amzn'); const imp = D.fromSEC(j.facts, j.subs); const c = (k, p) => imp.cells[k][p].v;
  ok('AMZN FY2025 revenue 716,924 (10-K)', c('rev', 'FY2025') === 716924);
  ok('AMZN FY2025 total assets 818,042', c('ta', 'FY2025') === 818042);
  ok('AMZN FY2025 accrued liabilities exclude 17,402 of debt and leases', c('accr', 'FY2025') === 58118 && imp.notes.some(n => /FY2025.*17402/.test(n)));
  ok('AMZN FY2025 D&A 65,756 and CapEx 131,819', c('da', 'FY2025') === 65756 && c('capex', 'FY2025') === 131819);
  ok('AMZN TTM column to 2026-09-30', imp.ttm && imp.ttm.end === '2026-09-30');
  ok('AMZN TTM revenue = FY + YTD − prior YTD (797,455)', c('rev', 'TTM') === 797455);
  const g = D.fromSEC(fx('gm').facts, fx('gm').subs);
  ok('GM FY2025 lease assets from the 10-K (1,000), not the later 10-Q re-tagging', g.cells.rou.FY2025.v === 1000);
  ok('GM PP&E found after the tag change', g.cells.ppe.FY2025.v === 51683);
  ok('GM tagging change flagged for the TTM column', g.notes.some(n => /Check Operating lease right-of-use/.test(n)));
  ok('GM: only total debt tagged, left unsplit with an explanation (no estimate)', !g.cells.ltd || !g.cells.ltd.FY2025 ? g.notes.some(n => /FY2025: the company tags only total debt/.test(n)) : false);
  const ms = D.fromSEC(fx('mstr').facts, fx('mstr').subs);
  ok('MSTR mezzanine equity kept in other equity and noted', ms.cells.oeq.FY2025.v > 6900 && ms.notes.some(n => /mezzanine/.test(n)));
  const mm = M.blank('m'); D.apply(mm, ms); M.initFromHistory(mm);
  ok('MSTR: no share count in the file stays missing (no estimate)', !E.isNum(mm.equity.sharesOpen) && E.run(mm, 'Base').missing.includes('shares'));
}

// ---------------- 3. manual overrides, persistence, versions ----------------
{
  const j = fx('amzn'); const m = M.blank('AMZN'); D.apply(m, D.fromSEC(j.facts, j.subs));
  D.setManual(m, 'inv', 'FY2025', 40000, 'SYN override for the test');
  ok('manual value used', m.hist.cells.inv.FY2025.v === 40000 && m.hist.cells.inv.FY2025.manual);
  const res = D.apply(m, D.fromSEC(j.facts, j.subs));
  ok('re-import keeps the manual value and records the filing figure as a proposal', m.hist.cells.inv.FY2025.v === 40000 && m.hist.cells.inv.FY2025.proposed && m.hist.cells.inv.FY2025.proposed.v === 38325 && res.proposed === 1);
  D.setManual(m, 'inv', 'FY2025', null);
  ok('removing the override restores the filing figure', m.hist.cells.inv.FY2025.v === 38325);
  M.save(m); const all = M.loadAll();
  ok('saved and reloaded', all[m.id] && all[m.id].hist.cells.rev.FY2025.v === 716924);
  const d = M.duplicate(m); ok('duplicate gets a new id', d.id !== m.id && d.hist.cells.rev.FY2025.v === 716924);
  M.saveVersion(m, 'v1'); const v1 = M.versionNo(m); m.asm.Base.g = M.fill(0.5); M.saveVersion(m, 'v2');
  ok('versions numbered', M.versionNo(m) === v1 + 1);
}

// ---------------- 4. DCF forecast link ----------------
{
  const f = fromFile('amzn'); f.id = 'fsm-test'; M.save(f);
  const d = DCFModel.fromSample(require('../data/amzn-sample.json'));
  const stored = JSON.stringify(d.inputs);
  const o = DCFModel.engineInputs(d); const a = DCF.runAll(o.inp, d.mode);
  ok('original source: no link', !o.link && !o.inp.linked);
  d.forecastSource = { mode: 'linked', fsmId: f.id, fsmName: f.name };
  const l = DCFModel.engineInputs(d); const b = DCF.runAll(l.inp, d.mode);
  const L = E.dcfLink(f);
  ok('linked: the link is usable', l.link && l.link.ok);
  E.SC.forEach(s => {
    ok(`linked ${s}: years 1–10 FCFF equal the three-statement FCFF`, b.scen[s].ok && b.scen[s].years.slice(0, 10).every((y, i) => near(y.fcff, L.scen[s].years[i].fcff)));
    ok(`linked ${s}: revenue and EBIT equal`, b.scen[s].years.slice(0, 10).every((y, i) => near(y.rev, L.scen[s].years[i].rev) && near(y.ebit, L.scen[s].years[i].ebit)));
    const T10 = b.scen[s].years[10], Y = b.scen[s].years[9], g = l.inp.tg[s];
    ok(`linked ${s}: terminal year grows year 10 at the terminal rate`, near(T10.rev, Y.rev * (1 + g)) && near(T10.ebitPct, Y.ebitPct));
  });
  ok('linked: debt in the bridge from the three-statement opening balance sheet', near(l.inp.debt, L.bridge.debt) && l.link.overrides.some(x => x.key === 'debt'));
  ok('linked: the DCF stored inputs are not changed', JSON.stringify(d.inputs) === stored);
  ok('linked: values differ from the original drivers', !near(a.scen.Base.perShare, b.scen.Base.perShare));
  d.forecastSource = { mode: 'original' };
  ok('switching back gives the original value', near(DCF.runAll(DCFModel.engineInputs(d).inp, d.mode).scen.Base.perShare, a.scen.Base.perShare));
  d.forecastSource = { mode: 'linked', fsmId: 'does-not-exist' };
  const miss = DCFModel.engineInputs(d);
  ok('missing linked model: original drivers used, problem explained', !miss.inp.linked && miss.link.problems.length > 0 && near(DCF.runAll(miss.inp, d.mode).scen.Base.perShare, a.scen.Base.perShare));
  d.forecastSource = { mode: 'linked', fsmId: f.id }; d.mode = 'workbook';
  ok('workbook mode never uses a link', !DCFModel.engineInputs(d).inp.linked);
  ok('older DCF files upgrade to the original source', DCFModel.upgrade(JSON.parse(JSON.stringify(Object.assign({}, d, { forecastSource: undefined })))).forecastSource.mode === 'original');
}

// ---------------- 5. Excel export: every formula reproduces the app ----------------
function evalBook(sheets) {
  const val = {};
  sheets.forEach(sh => { const m = val[sh.name] = {}; sh.rows.forEach((r, i) => (r || []).forEach((c, j) => { if (c === null || c === undefined) return; m[X.colName(j) + (i + 1)] = typeof c === 'object' ? c.v : c; })); });
  let n = 0, bad = 0;
  sheets.forEach(sh => sh.rows.forEach((r, i) => (r || []).forEach(c => {
    if (!c || typeof c !== 'object' || !c.f) return; n++;
    const js = c.f.replace(/Assumptions!\$?([A-Z]+)\$?(\d+)/g, (m0, a, b2) => `V("Assumptions","${a}${b2}")`).replace(/(^|[^A-Za-z"])([A-Z]{1,3})(\d+)(?![\d"])/g, (m0, p, a, b2) => `${p}V(${JSON.stringify(sh.name)},"${a}${b2}")`).replace(/\^/g, '**').replace(/\bMIN\(/g, 'Math.min(').replace(/\bMAX\(/g, 'Math.max(').replace(/\bIF\(/g, 'IFF(');
    const V = (s, a) => { const v = val[s][a]; if (typeof v !== 'number') throw new Error('blank'); return v; }; const IFF = (a, b2, d) => a ? b2 : d; // eslint-disable-line no-unused-vars
    let got; try { got = eval(js); } catch (e) { bad++; return; }
    if (!near(got, c.v, 1e-9)) bad++;
  })));
  return { n, bad };
}
for (const [t, set] of [['amzn', {}], ['amzn', { daPresentation: 'separate', depMethod: 'pctPPE', buyback: 'retire' }], ['wmt', { interest: 'average' }], ['tsla', { base: 'ttm' }], ['gm', {}]]) {
  const m = fromFile(t, set); m.shared.buyback = M.fill(1000); m.shared.awards = M.fill(5); if (set.depMethod === 'pctPPE') E.SC.forEach(s => { m.asm[s].dep = M.fill(0.15); });
  const { sheets } = X.build(m); const r = evalBook(sheets);
  ok(`Excel ${t} ${JSON.stringify(set)}: three scenario sheets`, sheets.filter(s => / model$/.test(s.name)).length === 3);
  ok(`Excel ${t} ${JSON.stringify(set)}: ${r.n} formulas reproduce the app's figures`, r.n > 3000 && r.bad === 0);
}
{
  const m = fromFile('amzn');
  X.writeBook(JSZip, X.build(m).sheets, 'test').then(u8 => JSZip.loadAsync(u8)).then(z => { ok('Excel file is a valid workbook package', !!z.file('xl/workbook.xml') && !!z.file('xl/worksheets/sheet3.xml')); return z.file('xl/worksheets/sheet3.xml').async('string'); })
    .then(x => { ok('Excel scenario sheet holds formulas with cached values', /<f>[^<]+<\/f><v>/.test(x)); ok('Excel: frozen panes', /state="frozen"/.test(x)); finish(); }).catch(e => { ok('Excel write: ' + e.message, false); finish(); });
  const html = X.printHtml(m); ok('printable report has the three statements and the checks', /Income statement/.test(html) && /Balance sheet/.test(html) && /Cash flow statement/.test(html) && /Checks/.test(html));
}

// ---------------- 6. guides ----------------
{
  const app = fs.readFileSync(path.join(__dirname, '../js/fsm-app.js'), 'utf8');
  const keys = new Set(); for (const m of app.matchAll(/help: *'([^']+)'/g)) keys.add(m[1]); for (const m of app.matchAll(/hb\('([^']+)'\)/g)) keys.add(m[1]);
  E.DRIVERS.forEach(d => keys.add('a_' + d.k)); E.RATIOS.forEach(r => keys.add('r_' + r.k));
  keys.forEach(k => ok(`guide exists: ${k}`, !!H.G[k]));
  Object.entries(H.G).forEach(([k, g]) => { ok(`guide ${k}: all nine parts`, H.ORDER.every(([, f]) => g[f] && (Array.isArray(g[f]) ? g[f].length : String(g[f]).length > 3))); ok(`guide ${k}: example and sources`, !!g.ex && g.src.length > 0 && g.src.every(s => H.S[s])); });
  ok('guide links are https', Object.values(H.S).every(([, u]) => /^https:\/\//.test(u)));
}

let done = false;
function finish() { if (done) return; done = true; console.log(`fsm: ${pass} passed, ${fail} failed`); if (fail) process.exit(1); }
