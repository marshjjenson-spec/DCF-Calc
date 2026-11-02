// Stock Price Simulator: every formula re-done independently here (plain loops, no engine helpers), plus edge cases
// (negative earnings, missing values, unusual multiples, dilution, stock splits, base periods), reverse projections,
// sensitivity grids, imports that never overwrite analyst values, persistence, and real SEC filings.
// Synthetic companies ("SYN") are arithmetic fixtures only, never presented as company data.
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
global.DCFSec = require('../js/sec.js');
global.CompsEngine = require('../js/comps-engine.js'); global.CompsData = require('../js/comps-data.js'); global.CompsModel = require('../js/comps-model.js');
global.CompsHelp = require('../js/comps-help.js');
global.SimEngine = require('../js/sim-engine.js');
const E = SimEngine, M = require('../js/sim-model.js'), H = require('../js/sim-help.js'), D = CompsData;
const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-9) => typeof a === 'number' && typeof b === 'number' && isFinite(a) && Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

// ---------- synthetic company ----------
function synth(vals) {
  const m = M.blank('SYN'); const c = m.company; c.ticker = 'SYN'; c.name = 'Synthetic SYN'; c.priceDate = '2026-03-31';
  const v = Object.assign({ price: 20, shares: 100, dilutive: 0, rev_ttm: 1000, ni_ttm: 100, ebitda_ttm: 200, ebit_ttm: 150, fcf_ttm: 80, eps_ttm: 1.0, cash: 50, ltdNoncurrent: 200, nci: 10 }, vals || {});
  Object.entries(v).forEach(([k, x]) => { if (x !== null) c.v[k] = { v: x, src: { cat: 'manual', provider: 'test fixture', end: k.endsWith('_ttm') ? '2026-03-31' : null } }; });
  const A = { revGrowth: 0.10, netMargin: 0.12, ebitdaMargin: 0.22, ebitMargin: 0.16, fcfMargin: 0.09, epsGrowth: 0.15, dilution: 0.02, pe: 18, evEbitda: 11, evEbit: 14, evRev: 2.2, ps: 2, pfcf: 20, cashChange: 10, debtChange: -5 };
  E.SCEN.forEach((s, i) => { Object.entries(A).forEach(([k, x]) => { m.scen[s][k] = E.AK[k].unit === 'x' ? x * (0.9 + 0.1 * i) : x + (i - 1) * 0.01; }); });
  return m;
}
// independent reference projection for one scenario
function ref(m, s, n, opts = {}) {
  const A = m.scen[s], c = m.company.v; const g = k => A.py[k] && typeof A.py[k][opts.t] === 'number' ? A.py[k][opts.t] : A[k];
  const out = []; let rev = c.rev_ttm.v, sh = c.shares.v + c.dilutive.v, cash = c.cash.v + (c.sti ? c.sti.v : 0), debt = c.ltdNoncurrent.v, eps = c.eps_ttm.v;
  for (let t = 1; t <= n; t++) {
    const at = k => (A.py[k] && typeof A.py[k][t - 1] === 'number') ? A.py[k][t - 1] : A[k];
    rev = rev * (1 + at('revGrowth')); const sh0 = sh; sh = sh * (1 + at('dilution')); const wa = (sh0 + sh) / 2;
    cash += at('cashChange'); debt += at('debtChange'); eps = eps * (1 + at('epsGrowth'));
    const claims = (c.nci ? c.nci.v : 0) + (c.preferred ? c.preferred.v : 0);
    const bridge = x => (x - debt - claims + cash) / sh;
    out.push({ rev, sh, wa, cash, debt,
      pe: rev * at('netMargin') / wa * at('pe'), eps: eps * at('pe'),
      ev_ebitda: bridge(rev * at('ebitdaMargin') * at('evEbitda')), ev_ebit: bridge(rev * at('ebitMargin') * at('evEbit')), ev_rev: bridge(rev * at('evRev')),
      ps: rev * at('ps') / sh, pfcf: rev * at('fcfMargin') * at('pfcf') / sh });
  }
  return out;
}
const m = synth();
const all = E.runAll(m);
E.SCEN.forEach(s => {
  const R = ref(m, s, 5), P = all.scen[s];
  R.forEach((r, i) => {
    const y = P.years[i];
    ok(`${s} Y${i + 1} revenue = start × (1+g)^t`, near(y.rev, r.rev) && near(y.rev, 1000 * Math.pow(1 + m.scen[s].revGrowth, i + 1)));
    ok(`${s} Y${i + 1} shares year-end and weighted average`, near(y.sharesEnd, r.sh) && near(y.sharesWA, r.wa));
    ok(`${s} Y${i + 1} cash and debt paths`, near(y.cash, r.cash) && near(y.debt, r.debt));
    E.METHOD_IDS.forEach(id => ok(`${s} Y${i + 1} ${id} price`, near(y.p[id], r[id])));
  });
});
// the user's stated formulas, literally, with no dilution and year-end shares
{
  const z = synth(); E.SCEN.forEach(s => { z.scen[s].dilution = 0; z.scen[s].cashChange = 0; z.scen[s].debtChange = 0; }); z.settings.waBasis = 'end';
  const p = E.project(z, 'Base'); const A = z.scen.Base, n = 5;
  const revN = 1000 * Math.pow(1 + A.revGrowth, n), niN = revN * A.netMargin, epsN = niN / 100;
  ok('P/E projection: revenue × (1+g)^n × net margin ÷ diluted shares × P/E', near(p.methods.pe.price, epsN * A.pe));
  ok('EPS growth projection: starting EPS × (1+g)^n × P/E', near(p.methods.eps.price, 1.0 * Math.pow(1 + A.epsGrowth, n) * A.pe));
  ok('EV/EBITDA projection: EBITDA × multiple − debt − claims + cash, ÷ shares', near(p.methods.ev_ebitda.price, (revN * A.ebitdaMargin * A.evEbitda - 200 - 10 + 50) / 100));
  ok('EV/Revenue projection: revenue × multiple through the bridge', near(p.methods.ev_rev.price, (revN * A.evRev - 200 - 10 + 50) / 100));
  ok('EV/EBIT projection: EBIT × multiple through the bridge', near(p.methods.ev_ebit.price, (revN * A.ebitMargin * A.evEbit - 160) / 100));
  // equity vs enterprise multiples are not mixed: debt moves EV-method prices only
  const z2 = JSON.parse(JSON.stringify(z)); z2.company.v.ltdNoncurrent.v = 700; const p2 = E.project(M.upgrade(z2), 'Base');
  ok('more debt lowers EV/Revenue price by debt ÷ shares', near(p.methods.ev_rev.price - p2.methods.ev_rev.price, 5));
  ok('more debt leaves P/E, EPS, P/S and P/FCF prices unchanged', ['pe', 'eps', 'ps', 'pfcf'].every(id => near(p.methods[id].price, p2.methods[id].price)));
  ok('P/S is an equity multiple: revenue × P/S ÷ shares, no bridge', near(p.methods.ps.price, revN * A.ps / 100));
}
// per-year overrides
{
  const z = synth(); z.scen.Base.py.revGrowth = [0.3, 0.2, null, null, null, null, null, null, null, null];
  const p = E.project(z, 'Base'); const g = z.scen.Base.revGrowth;
  ok('per-year growth overrides years 1–2, constant used after', near(p.years[4].rev, 1000 * 1.3 * 1.2 * Math.pow(1 + g, 3)));
  ok('per-year values recorded per year', near(p.years[0].revGrowth, 0.3) && near(p.years[2].revGrowth, g));
  const fd = E.fade(0.2, 0.08, 5); ok('fade helper reaches the end value in year n', near(fd[4], 0.08) && near(fd[0], 0.2 - 0.12 / 5) && near(fd[9], 0.08));
  z.settings.years = 10; const p10 = E.project(z, 'Base'); ok('ten-year horizon', p10.years.length === 10);
  z.settings.years = 0; ok('horizon clamped to 1–10', E.project(z, 'Base').years.length === 1); z.settings.years = 99; ok('horizon clamped at 10', E.project(z, 'Base').years.length === 10);
}
// returns: CAGR from the price date, total return and IRR with dividends
{
  const z = synth(); z.company.priceDate = '2026-09-30'; // base period ended 2026-03-31: 0.5 years elapsed
  const st = E.start(z); ok('stub = years from base period end to price date', near(st.stub, (new Date('2026-09-30') - new Date('2026-03-31')) / (365.25 * 864e5)));
  const p = E.project(z, 'Base'); const R = p.sel.returns; const h = 5 - st.stub;
  ok('holding period = n − stub', near(R.h, h));
  ok('price return = Pn ÷ P0 − 1', near(R.upside, p.sel.price / 20 - 1));
  ok('annualised return = (Pn ÷ P0)^(1/h) − 1', near(R.cagr, Math.pow(p.sel.price / 20, 1 / h) - 1));
  z.settings.fromPriceDate = false; ok('switching off the price-date measure uses whole years', near(E.project(z, 'Base').sel.returns.h, 5));
  z.settings.fromPriceDate = true;
  z.settings.divMode = 'growth'; z.company.v.dps = { v: 0.5, src: { cat: 'manual' } }; E.SCEN.forEach(s => { z.scen[s].dpsGrowth = 0.05; });
  const q = E.project(z, 'Base'); const Rq = q.sel.returns; const dps = [1, 2, 3, 4, 5].map(t => 0.5 * Math.pow(1.05, t));
  ok('DPS grows from today\'s dividend', q.years.every((y, i) => near(y.dps, dps[i])));
  ok('dividends summed in total return', near(Rq.divs, dps.reduce((a, b) => a + b, 0)) && near(Rq.total, (q.sel.price + Rq.divs) / 20 - 1));
  const npv = Rq.irr !== null ? -20 + q.years.reduce((a, y, i) => a + (dps[i] + (i === 4 ? q.sel.price : 0)) / Math.pow(1 + Rq.irr, y.h), 0) : 99;
  ok('IRR sets the NPV of −price, dividends and final price to zero', Math.abs(npv) < 1e-8);
  ok('IRR with dividends exceeds the price-only CAGR', Rq.irr > Rq.cagr);
  z.settings.divMode = 'payout'; E.SCEN.forEach(s => { z.scen[s].payout = 0.4; });
  const r2 = E.project(z, 'Base'); ok('payout dividends = EPS × payout', r2.years.every(y => near(y.dps, y.epsPE * 0.4)));
  const pv = E.presentValue(r2, 'pe', 0.09); const pvRef = r2.years.reduce((a, y) => a + y.dps / Math.pow(1.09, y.h), 0) + r2.sel.price / Math.pow(1.09, r2.last.h);
  ok('value today at a required return discounts dividends and the final price', near(pv, pvRef));
  ok('value today at the IRR equals today\'s price', near(E.presentValue(r2, 'pe', r2.sel.returns.irr), 20, 1e-7));
  z.settings.divMode = 'growth'; z.company.v.dps = { v: null, src: { cat: 'manual' } };
  ok('dividend growth without a starting dividend is reported missing', E.project(z, 'Base').sel.missing.includes('dps'));
}
// negative earnings and non-positive metrics
{
  const z = synth({ ni_ttm: -50, eps_ttm: -0.5 }); E.SCEN.forEach(s => { z.scen[s].netMargin = -0.05; });
  const p = E.project(z, 'Base');
  ok('negative EPS: P/E gives no price, with a reason', p.methods.pe.price === null && /negative/.test(p.methods.pe.why));
  ok('negative starting EPS: EPS growth refuses to compound a loss', p.methods.eps.price === null && /negative/.test(p.methods.eps.why));
  ok('EV/Revenue still prices a loss-making company', near(p.methods.ev_rev.price, ref(z, 'Base', 5)[4].ev_rev));
  ok('starting EPS warning raised', E.checks(z, E.runAll(z)).some(c => /Starting EPS is zero or negative/.test(c.text)));
  const w = synth(); E.SCEN.forEach(s => { w.scen[s].evRev = 0.05; }); w.company.v.ltdNoncurrent.v = 5000;
  const pw = E.project(w, 'Base');
  ok('claims above EV floor the price at 0, with a reason', pw.methods.ev_rev.price === 0 && /exceed/.test(pw.methods.ev_rev.why));
  const x = synth(); E.SCEN.forEach(s => { x.scen[s].fcfMargin = -0.02; });
  ok('negative FCF: P/FCF gives no price', E.project(x, 'Base').methods.pfcf.price === null);
  // turnaround: losses then profits by year 5 through a per-year margin path
  const t = synth({ ni_ttm: -50, eps_ttm: -0.5 }); t.scen.Base.py.netMargin = E.fade(-0.05, 0.1, 5);
  const pt = E.project(t, 'Base'); ok('turnaround: P/E prices the final year once EPS turns positive', pt.years[0].p.pe === null && pt.methods.pe.price > 0);
}
// missing values
{
  const z = synth({ ltdNoncurrent: null }); const p = E.project(z, 'Base');
  ok('no debt line: EV methods report debt missing (not assumed 0)', ['ev_ebitda', 'ev_ebit', 'ev_rev'].every(id => p.methods[id].missing.includes('debt') && p.methods[id].price === null));
  ok('equity methods still work without debt', p.methods.pe.price > 0 && p.methods.ps.price > 0);
  const z2 = synth({ dilutive: null }); const p2 = E.project(z2, 'Base');
  ok('diluted basis without net dilutive shares: reported missing', p2.methods.pe.missing.includes('dilutive'));
  z2.settings.shareBasis = 'basic'; ok('basic share basis works without dilutive shares', E.project(z2, 'Base').methods.pe.price > 0);
  const z3 = synth(); z3.scen.Base.netMargin = null; const p3 = E.project(z3, 'Base');
  ok('missing net margin blocks only the P/E method', p3.methods.pe.missing.includes('netMargin') && p3.methods.ev_ebitda.missing.length === 0);
  const z4 = synth({ price: null }); const p4 = E.project(z4, 'Base');
  ok('no current price: projection still runs, returns are blank', p4.methods.pe.price > 0 && p4.sel.returns.upside === null);
  const blank = M.blank(); const pb = E.runAll(blank);
  ok('blank simulation: nothing calculates, no zero-filled prices', E.SCEN.every(s => E.METHOD_IDS.every(id => pb.scen[s].methods[id].price === null)));
  ok('blank simulation: weighted price explains why', pb.weighted === null && pb.weightedNote.length > 0);
  // FY fallback when no TTM
  const z5 = synth(); z5.company.v.ebitda_fy = { v: 190, src: { cat: 'manual', end: '2025-12-31' } }; delete z5.company.v.ebitda_ttm;
  const s5 = E.start(z5); ok('TTM missing for a line: FY used with a note', s5.ebitda === 190 && s5.notes.some(n => /EBITDA/.test(n)));
  z5.settings.base = 'fy'; ok('FY base uses FY figures only', E.start(z5).rev === null);
}
// unusual multiples
{
  const z = synth(); z.scen.Bull.pe = 150; const ch = E.checks(z, E.runAll(z));
  ok('unusual P/E flagged', ch.some(c => /Bull: Future P\/E ratio of 150\.0×/.test(c.text)));
  const z2 = synth(); z2.scen.Base.evEbitda = -3; const p = E.project(z2, 'Base');
  ok('negative multiple gives no price', p.methods.ev_ebitda.price === null && /not meaningful/.test(p.methods.ev_ebitda.why));
  const z3 = synth(); z3.scen.Base.ebitMargin = 0.3; ok('operating margin above EBITDA margin flagged', E.checks(z3, E.runAll(z3)).some(c => /above the EBITDA margin/.test(c.text)));
  const z4 = synth(); z4.scen.Bear.pe = 40; ok('scenario order Bear ≤ Base ≤ Bull checked', E.checks(z4, E.runAll(z4)).some(c => /not ordered/.test(c.text)));
}
// share dilution and buybacks
{
  const z = synth(); E.SCEN.forEach(s => { z.scen[s].dilution = 0; }); const p0 = E.project(z, 'Base').methods.ps.price;
  E.SCEN.forEach(s => { z.scen[s].dilution = -0.03; }); const pb = E.project(z, 'Base').methods.ps.price;
  ok('buybacks of 3% a year raise the P/S price by 1 ÷ 0.97^5', near(pb / p0, 1 / Math.pow(0.97, 5)));
  const g = E.dilutionGrid(z, 'Base', [0, 0.05], ['ps', 'pe']); ok('dilution grid: more shares, lower price', g[1][0] < g[0][0] && g[1][1] < g[0][1]);
  ok('dilution grid at 5% matches a direct projection', near(g[1][0], p0 / Math.pow(1.05, 5)));
}
// stock splits
{
  const z = synth({ eps_ttm: 4.0 }); // net income 100 ÷ EPS 4 = 25mm shares, but 100mm outstanding: a 4-for-1 split since the EPS period
  const ch = E.checks(z, E.runAll(z)); ok('split mismatch detected (4-for-1)', ch.some(c => /4-for-1 stock split/.test(c.text)));
  z.settings.split = { factor: 4, appliesTo: 'eps' };
  ok('split factor divides EPS', near(E.start(z).eps, 1.0));
  ok('no split warning once adjusted', !E.checks(z, E.runAll(z)).some(c => /stock split/.test(c.text)));
  ok('EPS growth price after split adjustment matches unsplit company', near(E.project(z, 'Base').methods.eps.price, E.project(synth(), 'Base').methods.eps.price));
  const y = synth({ shares: 25, eps_ttm: 4.0 }); y.settings.split = { factor: 4, appliesTo: 'all' };
  ok('"all share figures" multiplies the share count too', near(E.start(y).shares, 100) && near(E.project(y, 'Base').methods.pe.price, E.project(synth(), 'Base').methods.pe.price));
  const r = synth({ eps_ttm: 0.25 }); ok('reverse split suspicion detected', E.checks(r, E.runAll(r)).some(c => /reverse split/.test(c.text)));
}
// reverse projections: every solved value re-checked by running the projection forward
[['Base', 35, 5], ['Bull', 60, 3], ['Bear', 15, 7], ['Base', 25, 1]].forEach(([s, target, n]) => {
  const z = synth(); const r = E.reverse(z, s, target, n); const it = k => r.items.find(i => i.key === k);
  ok(`reverse ${s} $${target} Y${n}: required EPS × P/E = target`, near(it('eps').value * r.y.mult.pe, target));
  ['pe', 'netMargin', 'revGrowth', 'epsGrowth', 'ebitda', 'evEbitda'].forEach(k => ok(`reverse ${s} $${target} Y${n}: ${k} gives the target when run forward`, near(it(k).check, target, 1e-8)));
  ok(`reverse ${s}: annualised return to target`, near(r.cagr, Math.pow(target / 20, 1 / r.y.h) - 1));
  ok(`reverse ${s}: held-constant explanation`, /Everything else/.test(r.held) && r.items.every(i => i.held.length));
});
{
  const z = synth({ ni_ttm: -50, eps_ttm: -0.5 }); E.SCEN.forEach(s => { z.scen[s].netMargin = -0.05; });
  const r = E.reverse(z, 'Base', 30, 5); ok('reverse with losses: EPS-growth not solvable, explained', r.items.find(i => i.key === 'epsGrowth').value === null && /not positive/.test(r.items.find(i => i.key === 'epsGrowth').note));
  ok('reverse with negative margin: growth not solvable, explained', r.items.find(i => i.key === 'revGrowth').value === null);
  ok('reverse rejects a non-positive target', E.reverse(z, 'Base', 0, 5).error);
}
// sensitivity
{
  const z = synth(); const c = E.finalValue(z, 'Base', 'revGrowth'), pe = E.finalValue(z, 'Base', 'pe');
  const g = E.grid(z, 'Base', 'revGrowth', E.axis(c, 0.02), 'pe', E.axis(pe, 2), 'pe');
  ok('grid centre equals the scenario price', near(g[2][2], E.project(z, 'Base').methods.pe.price));
  ok('grid rises with P/E (expansion) and growth', g.every(row => row.every((v, j) => j === 0 || v > row[j - 1])) && g.every((row, i) => i === 0 || row[2] > g[i - 1][2]));
  ok('grid cell matches an independent projection', near(g[0][4], (() => { const z2 = synth(); z2.scen.Base.revGrowth = c - 0.04; z2.scen.Base.pe = pe + 4; return ref(z2, 'Base', 5)[4].pe; })()));
  const ge = E.grid(z, 'Base', 'ebitdaMargin', [0.2, 0.25], 'evEbitda', [10, 12], 'ev_ebitda');
  ok('EBITDA × EV/EBITDA grid cell', near(ge[1][1], (() => { const z2 = synth(); z2.scen.Base.ebitdaMargin = 0.25; z2.scen.Base.evEbitda = 12; return ref(z2, 'Base', 5)[4].ev_ebitda; })()));
  const gm = E.grid(z, 'Base', 'netMargin', [0.1], 'pe', [20], 'pe'); ok('net margin × P/E grid cell', near(gm[0][0], (() => { const z2 = synth(); z2.scen.Base.netMargin = 0.1; z2.scen.Base.pe = 20; return ref(z2, 'Base', 5)[4].pe; })()));
  const gg = E.grid(z, 'Base', 'epsGrowth', [0.1], 'pe', [25], 'eps'); ok('EPS growth × P/E grid cell', near(gg[0][0], Math.pow(1.1, 5) * 25));
  z.scen.Base.py.pe = [30, 30, 30, 30, 30, null, null, null, null, null];
  ok('grid replaces per-year values for the varied assumption', near(E.grid(z, 'Base', 'revGrowth', [c], 'pe', [pe], 'pe')[0][0], g[2][2]));
}
// scenario weighting
{
  const z = synth(); const a = E.runAll(z);
  ok('weighted price = Σ probability × price', near(a.weighted, 0.25 * a.scen.Bear.sel.price + 0.5 * a.scen.Base.sel.price + 0.25 * a.scen.Bull.sel.price));
  z.settings.weights = { Bear: 0.3, Base: 0.5, Bull: 0.3 }; const b = E.runAll(z); ok('weights not adding to 100% give no weighted price', b.weighted === null && /110/.test(b.weightedNote));
  ok('scenarios differ', a.scen.Bear.sel.price < a.scen.Base.sel.price && a.scen.Base.sel.price < a.scen.Bull.sel.price);
}
// operating leases in the bridge
{
  const z = synth({ opLease: 30 }); const p1 = E.project(z, 'Base').methods.ev_ebitda.price; z.settings.leases = 'debt';
  ok('operating leases as debt lower EV prices by leases ÷ shares', near(p1 - E.project(z, 'Base').methods.ev_ebitda.price, 30 / E.project(z, 'Base').last.sharesEnd));
}

// ---------- model: proposals, review, persistence ----------
{
  const z = synth(); M.setAssumption(z, 'Base', 'revGrowth', 0.07); // analyst-entered
  z.scen.Bear.revGrowth = null; z.scen.Bear.src = {};
  const n = M.propose(z, { source: 'test', cat: 'history', scen: { Base: { revGrowth: { c: 0.2 } }, Bear: { revGrowth: { c: 0.03 } } } });
  ok('proposal lists changes without applying them', n === 2 && z.scen.Base.revGrowth === 0.07 && z.scen.Bear.revGrowth === null);
  M.applyPending(z, z.pending.items.map(i => i.id), false);
  ok('apply without permission skips the analyst value, fills the empty one', z.scen.Base.revGrowth === 0.07 && z.scen.Bear.revGrowth === 0.03 && z.pending.items.length === 1);
  ok('applied value records its source', z.scen.Bear.src.revGrowth.cat === 'history');
  M.applyPending(z, z.pending.items.map(i => i.id), true);
  ok('analyst value replaced only with explicit permission', z.scen.Base.revGrowth === 0.2 && z.pending === null);
  ok('undo restores the analyst value', M.undoAssumption(z, 'Base', 'revGrowth') && z.scen.Base.revGrowth === 0.07 && z.scen.Base.src.revGrowth.cat === 'analyst');
  const n2 = M.propose(z, { source: 'same', cat: 'history', scen: { Base: { revGrowth: { c: 0.07 } } } }); ok('identical values are not proposed', n2 === 0 && z.pending === null);
  M.propose(z, { source: 'py', cat: 'dcf', scen: { Base: { pe: { py: [20, 19, 18] } } } }); M.applyPending(z, z.pending.items.map(i => i.id), true);
  ok('per-year proposal stored as a path', z.scen.Base.py.pe[2] === 18 && z.scen.Base.py.pe[3] === null);
  // persistence
  ok('save and reload', M.save(z) && M.loadAll()[z.id].scen.Base.py.pe[0] === 20);
  ok('simulations use their own storage key', Object.keys(store).every(k => k.startsWith('dcfsim.')));
  const up = M.upgrade({ id: 'old', name: 'Old', scen: { Base: { pe: 12 } } }); ok('upgrade fills defaults for partial saved files', up.scen.Bear.dilution === 0 && up.scen.Base.pe === 12 && up.settings.split.factor === 1);
  const dup = M.duplicate(z); ok('duplicate gets a new id and keeps assumptions', dup.id !== z.id && dup.scen.Base.revGrowth === z.scen.Base.revGrowth);
  M.remove(z.id); ok('delete removes it', !M.loadAll()[z.id]);
  const comp = M.completion(synth()); ok('completion lists missing rationale and conclusion', !comp.complete && comp.sections.find(s => s.id === 'docs').done === 0);
}
// company re-import never overwrites a manual figure
{
  const z = M.blank(); D.setManual(z.company, 'rev_ttm', 999); z.company.v.cash = { v: 1, src: { cat: 'sec' } };
  M.importFMP(z, { provider: 'test', retrieved: new Date().toISOString(), info: {}, values: { rev_ttm: { v: 1000, src: { cat: 'sec' } }, cash: { v: 2, src: { cat: 'sec' } }, shares: { v: 5, src: { cat: 'sec' } } }, refs: {}, notes: [] });
  ok('manual figure kept; change proposed for review', z.company.v.rev_ttm.v === 999 && z.company.pending.items.some(p => p.key === 'rev_ttm' && p.manual));
  ok('blank figure filled', z.company.v.shares.v === 5);
}
// DCF forecast import: the DCF model is read, not changed
{
  const sample = require('../data/amzn-sample.json'); const dm = DCFModel.fromSample(sample); const before = JSON.stringify(dm);
  const prop = M.dcfProposal(dm, DCFModel, DCF);
  const res = DCF.runAll(DCFModel.engineInputs(dm).inp, dm.mode);
  ok('DCF proposal carries the DCF growth path by year', E.SCEN.every(s => prop.scen[s] && prop.scen[s].revGrowth.py.every((g, i) => near(g, res.scen[s].years[i].growth))));
  ok('DCF proposal carries EBITDA and operating margins', near(prop.scen.Base.ebitdaMargin.py[4], res.scen.Base.years[4].emPct) && near(prop.scen.Base.ebitMargin.py[9], res.scen.Base.years[9].ebitPct));
  ok('DCF model unchanged by the import', JSON.stringify(dm) === before);
  ok('DCF proposal explains what it cannot import', /net margin/.test(prop.note));
}
// three-statement import through its documented interface (a stub of FsmEngine.run)
{
  const z = synth(); const st = E.start(z);
  const years = [1, 2, 3, 4, 5].map(t => ({ rev: 1000 * Math.pow(1.1, t), ebitda: 220 * Math.pow(1.1, t), ebit: 160 * Math.pow(1.1, t), niCommon: 120 * Math.pow(1.1, t), waDil: 100 * Math.pow(0.99, t), epsDil: 1.2 * Math.pow(1.1, t) / Math.pow(0.99, t), debt: 200, finl: 0, cash: 50 + 10 * t, sti: 0, div: 30 * Math.pow(1.1, t) }));
  const Fsm = { run: (mm, s) => s === 'Bear' ? { ok: false, missing: ['g1'] } : { ok: true, years } };
  const prop = M.fsmProposal({ name: 'stub', id: 'f1' }, {}, Fsm, st);
  ok('three-statement: growth from revenue path (year 1 from the simulation start)', near(prop.scen.Base.revGrowth.py[0], 0.1) && near(prop.scen.Base.revGrowth.py[3], 0.1));
  ok('three-statement: net margin, dilution, payout, cash change', near(prop.scen.Base.netMargin.py[2], 0.12) && near(prop.scen.Base.dilution.py[1], -0.01) && near(prop.scen.Base.payout.py[0], 0.25) && near(prop.scen.Base.cashChange.py[0], 10));
  ok('three-statement: incomplete scenario reported, not imported', !prop.scen.Bear && /Bear/.test(prop.note));
}

// ---------- real SEC filings ----------
['amzn', 'tsla', 'mstr'].forEach(t => {
  const j = require(`./fixtures/comps/sec-${t}.json`);
  const z = M.blank(t); const r = M.importSEC(z, j.facts, j.subs);
  ok(`${t.toUpperCase()}: SEC import fills reported figures`, r.res.filled > 10 && z.company.name);
  ok(`${t.toUpperCase()}: history has up to five fiscal years, newest first, labelled actual`, z.hist.length >= 3 && z.hist.length <= 5 && z.hist[0].end > z.hist[1].end && z.hist.every(h => h.source === 'SEC EDGAR XBRL company facts'));
  ok(`${t.toUpperCase()}: starting revenue = TTM from the filing`, E.start(z).rev === z.company.v.rev_ttm.v);
  D.setManual(z.company, 'price', 100); z.company.priceDate = '2026-10-31';
  if (z.company.ref && z.company.ref.dilutive) D.useRef(z.company, 'dilutive', 'dilutive'); else D.setManual(z.company, 'dilutive', 0);
  M.propose(z, M.historyProposal(z)); if (z.pending) M.applyPending(z, z.pending.items.map(i => i.id), true);
  const a = E.runAll(z);
  ok(`${t.toUpperCase()}: every scenario and method gives a price or a stated reason`, E.SCEN.every(s => E.METHOD_IDS.every(id => { const x = a.scen[s].methods[id]; return (typeof x.price === 'number' && isFinite(x.price)) || x.why || x.missing.length; })));
  ok(`${t.toUpperCase()}: no NaN anywhere in the projection`, !JSON.stringify(a).includes('NaN'));
  ok(`${t.toUpperCase()}: Base P/E projection re-derived independently`, (() => { const p = a.scen.Base; if (p.methods.pe.price === null) return true; const A = z.scen.Base; let rev = a.st.rev, sh = a.st.shares; let wa; for (let i = 0; i < 5; i++) { rev *= 1 + A.revGrowth; const s0 = sh; sh *= 1 + (A.dilution || 0); wa = (s0 + sh) / 2; } return near(p.methods.pe.price, rev * A.netMargin / wa * A.pe); })());
});
{
  const j = require('./fixtures/comps/sec-amzn.json'); const z = M.blank(); M.importSEC(z, j.facts, j.subs);
  ok('AMZN: TTM revenue 797,455 $mm (FY2025 716,924 + 9M 2026 584,069 − 9M 2025 503,538)', z.company.v.rev_ttm.v === 797455);
  ok('AMZN: FY2025 diluted EPS 7.17 and 10,827mm diluted shares in history', z.hist[0].eps === 7.17 && Math.round(z.hist[0].waDil) === 10827);
}

// ---------- guides ----------
E.ASSUME.forEach(a => ok(`guide for ${a.key}`, !!H.G[a.key]));
['price', 'shares', 'dilutive', 'rev', 'ni', 'eps', 'ebitda', 'ebit', 'fcf', 'cash', 'debt', 'claims', 'dps', 'base', 'split', 'method', 'years', 'weights', 'reqReturn', 'returns', 'reverse', 'perYear', 'leases', 'waBasis'].forEach(k => ok(`guide for ${k}`, !!H.G[k]));
Object.entries(H.G).forEach(([k, g]) => {
  ok(`guide ${k} has every part`, ['what', 'why', 'find', 'calc', 'forecast', 'effect', 'ex', 'research'].every(p => typeof g[p] === 'string' && g[p].length) && Array.isArray(g.mistakes) && g.mistakes.length && g.src.length);
  ok(`guide ${k} sources resolve to https links`, g.src.every(s => H.S[s] && /^https:\/\//.test(H.S[s][1])));
});
ok('multiple and method guides carry formulas', E.MULT_KEYS.every(k => H.G[k].formula) && ['revGrowth', 'netMargin', 'epsGrowth', 'dilution'].every(k => H.G[k].formula));

console.log(`sim: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
