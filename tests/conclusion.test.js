// Conclusion: verdict, reverse DCF, value drivers, thesis review and memo (all read-only)
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCFSec = require('../js/sec.js'); global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
const C = require('../js/conclusion.js'), M = DCFModel, E = DCF;
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-6) => typeof a === 'number' && Math.abs(a - b) < t;
const sample = require('../data/amzn-sample.json');
for (const mode of ['corrected', 'workbook']) {
  const m = M.fromSample(sample); m.mode = mode;
  const { inp } = M.engineInputs(m);
  const all = E.runAll(inp, mode);
  ok(mode + ': sample calculates', all.scen.Base.ok && typeof all.weighted === 'number');
  const before = JSON.stringify(inp);
  // reverse DCF: each implied lever, put back into the engine, gives the price
  const I = C.implied(inp, 'Base', mode);
  ok(mode + ': implied runs', I && I.growth.ok && I.margin.ok && I.irr.ok);
  const g = E.run(inp, 'Base', mode, { g1: I.growth.rates[0], g2: I.growth.rates[1], g3: I.growth.rates[2] });
  ok(mode + ': implied growth gives the price', near(g.perShare, inp.price, 1e-4));
  const mg = E.run(inp, 'Base', mode, { em1: I.margin.em[0], em5: I.margin.em[1], em10: I.margin.em[2], tem: I.margin.em[3] });
  ok(mode + ': implied margin gives the price', near(mg.perShare, inp.price, 1e-4));
  const w = E.run(inp, 'Base', mode, { wacc: I.irr.rate });
  ok(mode + ': implied return gives the price', near(w.perShare, inp.price, 1e-4));
  // direction: value above price means the market implies less growth and a higher return than WACC
  const up = all.scen.Base.perShare > inp.price;
  ok(mode + ': growth shift sign matches value vs price', up ? I.growth.shift < 0 : I.growth.shift > 0);
  ok(mode + ': implied return vs WACC sign', up ? I.irr.rate > all.scen.Base.waccUsed : I.irr.rate < all.scen.Base.waccUsed);
  ok(mode + ': inputs untouched', JSON.stringify(inp) === before);
  // drivers: sorted by range, WACC lowers value as it rises, growth raises it
  const D = C.drivers(inp, 'Base', mode);
  ok(mode + ': drivers listed', D.list.length >= 5);
  ok(mode + ': drivers sorted', D.list.every((d, i) => !i || D.list[i - 1].range >= d.range));
  const dw = D.list.find(d => d.id === 'wacc'); ok(mode + ': WACC up lowers value', dw.up < D.base && dw.down > D.base);
  const dg = D.list.find(d => d.id === 'growth'); ok(mode + ': margin up raises value', D.list.find(d => d.id === 'margin').up > D.base);
  ok(mode + ': growth driver exists', !!dg);
  // grid and verdict
  const G = C.grid(inp, 'Base', mode);
  ok(mode + ': grid 5x5', G.length === 5 && G.every(r => r.length === 5));
  ok(mode + ': grid centre = Base value', near(G[2][2], all.scen.Base.perShare, 1e-6));
  const V = C.verdict(all, inp.price, 0.15, G);
  ok(mode + ': verdict ok', V.ok && ['Buy', 'Hold', 'Sell'].includes(V.call));
  ok(mode + ': gap = weighted / price − 1', near(V.gap, all.weighted / inp.price - 1));
  ok(mode + ': buy-below price clears the hurdle', near(V.value / V.buyBelow - 1, 0.15));
  ok(mode + ': sell-above price', near(V.value / V.sellAbove - 1, -0.15));
}
// verdict thresholds
const fake = (w, b, be, bu) => ({ weighted: w, scen: { Base: { ok: true, perShare: b }, Bear: { ok: true, perShare: be }, Bull: { ok: true, perShare: bu } } });
ok('Buy above hurdle', C.verdict(fake(130, 125, 90, 160), 100, 0.15).call === 'Buy');
ok('Hold inside hurdle', C.verdict(fake(110, 108, 80, 140), 100, 0.15).call === 'Hold');
ok('Sell below hurdle', C.verdict(fake(80, 82, 60, 99), 100, 0.15).call === 'Sell');
ok('hurdle boundary counts as Buy', C.verdict(fake(115, 115, 115, 115), 100, 0.15).call === 'Buy');
ok('default hurdle 15%', C.verdict(fake(114, 114, 90, 130), 100, null).call === 'Hold');
ok('falls back to Base when weights missing', C.verdict({ weighted: null, scen: { Base: { ok: true, perShare: 150 }, Bear: { ok: false }, Bull: { ok: false } } }, 100, 0.15).basis.startsWith('Base'));
ok('no price, no verdict', !C.verdict(fake(130, 125, 90, 160), null, 0.15).ok);
const allUp = C.verdict(fake(200, 200, 150, 250), 100, 0.15, [[150, 160], [170, 180]]);
ok('robust when every scenario and grid cell agree', allUp.robust.level === 'high' && allUp.gridShare === 1);
ok('low robustness when scenarios split', C.verdict(fake(110, 110, 70, 150), 100, 0.15, [[90, 120]]).robust.level === 'low');
ok('medium robustness when grid splits', C.verdict(fake(130, 130, 105, 150), 100, 0.15, [[90, 95], [120, 130]]).robust.level === 'medium');
// solver
ok('solver finds a root', near(C.solve(x => x - 0.123, -1, 1, 0.01), 0.123, 1e-7));
ok('solver: no root in range', C.solve(x => 5 + x, -1, 1, 0.01) === null);
ok('solver: nearest root', near(C.solve(x => (x - 0.3) * (x + 0.1), -1, 1, 0.01), -0.1, 1e-7));
ok('solver: skips invalid points', near(C.solve(x => (x > 0.05 && x < 0.1 ? null : x - 0.2), -1, 1, 0.01), 0.2, 1e-7));
// thesis review
const V = C.verdict(fake(130, 125, 90, 160), 100, 0.15);
let R = C.review(C.blankThesis(), V, null, {});
ok('blank thesis is not ready', !R.ready && R.items.some(x => /recommendation/.test(x.text)));
const full = { rec: 'Buy', points: ['Growth from cloud services', 'Margins expand with scale', 'Capex falls after build-out'], risks: ['Regulation in the EU', 'Price war in retail'], changeMind: 'Cloud growth below 10% for two quarters', variant: 'The market implies 6% growth; I expect 10%', catalysts: '' };
R = C.review(full, V, null, { pct: 100, failing: 0 });
ok('full thesis agreeing with numbers is ready', R.ready, R);
R = C.review(Object.assign({}, full, { rec: 'Sell' }), V, null, {});
ok('Sell against a Buy verdict is flagged', !R.ready && R.items.some(x => x.level === 'bad' && /point to Buy/.test(x.text)));
R = C.review(full, V, null, { tvShare: 0.9, failing: 2, pct: 80 });
ok('TV share, failing checks and completion are reported', R.items.some(x => /Terminal value is 90%/.test(x.text)) && R.items.some(x => /2 sanity checks fail/.test(x.text)) && R.items.some(x => /80% complete/.test(x.text)));
R = C.review(full, V, { growth: { ok: true, cagr: 0.2 } }, { histCagr: 0.08 });
ok('implied growth above history is explained', R.items.some(x => /well above/.test(x.text)));
ok('Bear above price warning', C.review(full, C.verdict(fake(200, 200, 150, 250), 100, 0.15), null, {}).items.some(x => /Bear case is above/.test(x.text)));
// memo
const m = M.fromSample(sample); const { inp } = M.engineInputs(m); const all = E.runAll(inp, 'corrected');
const V2 = C.verdict(all, inp.price, 0.15, C.grid(inp, 'Base', 'corrected'));
const md = C.memo({ company: m.inputs.company, mode: 'corrected', verdict: V2, thesis: full, implied: C.implied(inp, 'Base', 'corrected'), drivers: C.drivers(inp, 'Base', 'corrected'), probs: inp.prob, histCagr: 0.1, reviewItems: [] });
ok('memo has the title and recommendation', /^# .*: Buy/.test(md));
ok('memo has valuation, implied, drivers, thesis, risks', ['## Valuation', '## What the price implies', '## What matters most', '## Thesis', '## Risks', '## What would change my mind'].every(h => md.includes(h)));
ok('memo leaves out empty sections', !md.includes('## Catalysts'));
ok('memo states the weighted value', md.includes('$' + all.weighted.toFixed(2)));
// older saved models get a blank thesis
const old = JSON.parse(JSON.stringify(M.blank())); delete old.thesis;
ok('upgrade adds a thesis', M.upgrade(old).thesis && Array.isArray(M.upgrade(old).thesis.points));
console.log(`conclusion: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
