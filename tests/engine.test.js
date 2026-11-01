// Reconciliation tests: website engine vs Excel workbook values.
const DCF = require('../js/engine.js');
const inp = require('../data/amzn-sample.json');
const X = require('./fixtures/expected_workbook.json');
let pass = 0, fail = 0;
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));
function eq(name, a, b, tol = 1e-9) { if (a === null || b === null || !(rel(a, b) <= tol)) { fail++; console.log('FAIL', name, a, b); } else pass++; }
function ok(name, c) { if (c) pass++; else { fail++; console.log('FAIL', name); } }
const all = DCF.runAll(inp, 'workbook');
for (const s of DCF.SC) {
  const r = all.scen[s];
  eq(`${s} per share`, r.perShare, X[s].ps);
  eq(`${s} WACC`, r.waccUsed, X[s].wacc);
  r.years.forEach((y, i) => eq(`${s} FCFF y${i + 1}`, y.fcff, X[s].fcff[i]));
}
const b = all.scen.Base;
for (const [k, v] of [['ev', 'ev'], ['equity', 'eq'], ['tv', 'tv'], ['pvTV', 'pvtv'], ['sumPV', 'sumpv'], ['tvShare', 'tvshare'], ['evEbitda1', 'evEbitda1']]) eq('Base ' + k, b[k], X.Base[v]);
eq('Base terminal ROIC', b.checks.termRoic, X.Base.termRoic);
eq('Base model reinvestment', b.checks.modelReinv, X.Base.modelReinv);
eq('Base reinvestment gap', b.checks.reinvGap, X.Base.reinvGap);
eq('weighted value', all.weighted, X.weighted);
eq('market cap', b.W.mcap, X.mcap);
const waccs = [0.0825, 0.0875, 0.0925, 0.0975, 0.1025, 0.1075, 0.1125, 0.1175], gs = [0.0225, 0.025, 0.0275, 0.03, 0.0325, 0.035], ms = [8, 10, 12, 14, 16, 18, 20, 22];
DCF.sensitivity(inp, 'Base', 'workbook', waccs, gs).forEach((row, i) => row.forEach((v, j) => eq(`sens1 ${i},${j}`, v, X.sens1[i][j])));
DCF.sensitivityExit(inp, 'Base', 'workbook', waccs, ms).forEach((row, i) => row.forEach((v, j) => eq(`sens2 ${i},${j}`, v.ev, X.sens2[i][j])));
const wb = DCF.waccBuilder(inp, inp.wb, 'workbook');
eq('WACC builder', wb.built, X.waccBuilt); ok('WACC tie-out = 0', Math.abs(wb.diff) < 1e-12);

// --- missing / invalid data behaviour ---
const clone = o => JSON.parse(JSON.stringify(o));
let t = clone(inp); t.price = null; let r = DCF.run(t, 'Base');
ok('missing price blocks calculation', !r.ok && r.missing.includes('price'));
t = clone(inp); t.g1.Bear = null; r = DCF.runAll(t);
ok('missing Bear growth blocks Bear only', !r.scen.Bear.ok && r.scen.Base.ok && r.weighted === null);
t = clone(inp); t.tg.Base = 0.2; r = DCF.run(t, 'Base');
ok('WACC <= g is refused for Gordon', !r.ok && r.errors[0].includes('must be higher'));
t = clone(inp); t.prob.Base = 0.5; r = DCF.runAll(t);
ok('probabilities not 100% block the weighted value', r.weighted === null && /100%/.test(r.weightedNote));
t = clone(inp); t.basic = 0; t.options = 0; r = DCF.run(t, 'Base');
ok('zero shares refused', !r.ok);
t = clone(inp); t.tvMethod.Base = 'Exit Multiple'; t.exitMult.Base = null; r = DCF.run(t, 'Base');
ok('exit multiple required only when chosen', !r.ok && r.missing.includes('exitMult'));
t = clone(inp); t.exitMult.Base = null; r = DCF.run(t, 'Base');
ok('exit multiple not required for Gordon', r.ok);

// --- corrected mode: independent hand calculation of the corrected terminal value ---
const c = DCF.run(inp, 'Base', 'corrected');
const T = c.years[10], w = c.waccUsed, g = inp.tg.Base;
const fcff11 = T.nopat * (1 - g / inp.troic.Base);
const mcap = (inp.basic + inp.options - inp.treasury) * inp.price;
eq('corrected weights = market values', c.W.we, mcap / (mcap + inp.debt + inp.leases));
eq('corrected TV = FCFF11 / (WACC - g)', c.tv, fcff11 / (w - g));
eq('corrected TV discounted at 9.5 under mid-year', c.pvTV, fcff11 / (w - g) / Math.pow(1 + w, 9.5));
ok('corrected reinvestment check passes', Math.abs(c.checks.reinvGap) < 1e-12);
t = clone(inp); t.tvMethod.Base = 'Exit Multiple'; r = DCF.run(t, 'Base', 'corrected');
eq('corrected exit TV uses Year 10 EBITDA at year 10', r.pvTV, r.years[9].ebitda * 16 / Math.pow(1 + r.waccUsed, 10));
// explicit years identical between modes (fixes only touch TV and weights)
const wbm = DCF.run(inp, 'Base', 'workbook');
for (let i = 0; i < 10; i++) eq('years 1-10 FCFF same in both modes y' + (i + 1), c.years[i].fcff, wbm.years[i].fcff);
// --- recalculated workbook variants (spreadsheet-engine recalculation of edited copies) ---
const CASES = require('./fixtures/expected_cases.json');
const cellMap = { C73:['tvMethod','Base'], D73:['tvMethod','Bear'], E73:['tvMethod','Bull'], C90:['midYear'], C27:['g1','Base'], D28:['g2','Bear'], E58:['beta','Bull'], C69:['tg','Base'], C64:['we','Base'], D50:['nwc','Bear'], C77:['cash'], C79:['debt'], C20:['options'], C21:['treasury'], C16:['price'] };
for (const [name, cse] of Object.entries(CASES)) {
  const t2 = clone(inp);
  for (const [cell, val] of Object.entries(cse.changes)) { const [k, s] = cellMap[cell]; if (s) t2[k][s] = val; else t2[k] = val; }
  const a = DCF.runAll(t2, 'workbook');
  for (const s of DCF.SC) eq(`${name} ${s}`, a.scen[s].perShare, cse[s]);
  eq(`${name} weighted`, a.weighted, cse.weighted); eq(`${name} EV`, a.scen.Base.ev, cse.ev); eq(`${name} equity`, a.scen.Base.equity, cse.eq);
}
// --- corrected engine vs the corrected Excel template (recalculated) ---
const XC = require('./fixtures/expected_corrected.json');
const ac = DCF.runAll(inp, 'corrected');
for (const s of DCF.SC) eq('corrected xlsx ' + s, ac.scen[s].perShare, XC[s]);
eq('corrected xlsx weighted', ac.weighted, XC.weighted); eq('corrected xlsx EV', ac.scen.Base.ev, XC.ev);
eq('corrected xlsx TV', ac.scen.Base.tv, XC.tv); eq('corrected xlsx PV TV', ac.scen.Base.pvTV, XC.pvtv); eq('corrected xlsx WACC', ac.scen.Base.waccUsed, XC.wacc);
DCF.sensitivity(inp, 'Base', 'corrected', waccs, gs).forEach((row, i) => row.forEach((v, j) => eq(`corrected sens1 ${i},${j}`, v, XC.sens1[i][j])));
DCF.sensitivityExit(inp, 'Base', 'corrected', waccs, ms).forEach((row, i) => row.forEach((v, j) => eq(`corrected sens2 ${i},${j}`, v.ev, XC.sens2[i][j])));
console.log(`\n${pass} passed, ${fail} failed`);
console.log('Corrected:', DCF.SC.map(s => s + ' ' + DCF.run(inp, s, 'corrected').perShare.toFixed(2)).join(', '), 'weighted', DCF.runAll(inp, 'corrected').weighted.toFixed(2));
process.exit(fail ? 1 : 0);
