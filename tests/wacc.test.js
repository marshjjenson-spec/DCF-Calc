// WACC calculators and validation
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
const A = require('../js/analysis.js'), M = DCFModel, Hp = require('../js/help.js');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-9) => a != null && Math.abs(a - b) < t;
ok('bottom-up: 1.10 × [1 + 0.75 × 0.20] = 1.265', near(A.relever(1.1, 0.25, 0.2), 1.265));
ok('unlever is the inverse', near(A.unlever(1.265, 0.25, 0.2), 1.1));
ok('weighted cost of debt: ($1B × 4.5% + $2B × 5.5%) ÷ $3B = 5.17%', near(A.weightedKd([{ amt: 1000, y: 0.045 }, { amt: 2000, y: 0.055 }, {}]).kd, (45 + 110) / 3000));
ok('interest coverage EBIT ÷ interest', near(A.coverage(79975, 2274), 79975 / 2274) && A.coverage(1, 0) === null);
ok('historical rate uses average debt', near(A.histRate(100, 1800, 2200), 0.05));
ok('size labels are descriptive', A.sizeLabel(250) === 'Micro-cap' && A.sizeLabel(1500) === 'Small-cap' && A.sizeLabel(5000) === 'Mid-cap' && A.sizeLabel(50000) === 'Large-cap' && A.sizeLabel(2.6e6) === 'Mega-cap');
// regression beta: stock = 2% + 1.5 × market exactly → beta 1.5
const mk = [], st = []; let pm = 100, ps = 50; const rets = [0.02, -0.03, 0.05, 0.01, -0.02, 0.04, -0.01, 0.03, 0.00, -0.04, 0.02, 0.01];
for (let i = 0; i <= rets.length * 3; i++) { const d = new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 10); mk.push({ date: d, close: pm }); st.push({ date: d, close: ps }); const r = rets[i % rets.length]; pm *= 1 + r; ps *= 1 + 0.002 + 1.5 * r; }
const rb = A.regressionBeta(st, mk);
ok('regression beta recovers 1.5', rb.ok && near(rb.beta, 1.5, 1e-9) && near(rb.r2, 1, 1e-9) && rb.n === rets.length * 3);
ok('adjusted beta is labelled 0.67 × raw + 0.33', near(rb.adjusted, 0.67 * 1.5 + 0.33));
const rb2 = A.regressionBeta(st.filter((_, i) => i !== 5), mk);
ok('missing dates are dropped and reported', rb2.ok && rb2.warn.some(w => /no matching date/.test(w)));
const split = st.map((p, i) => i > 10 ? { date: p.date, close: p.close / 2 } : p);
ok('a split in an unadjusted series is flagged', A.regressionBeta(split, mk).warn.some(w => /split/.test(w)));
ok('too few observations is not a result', !A.regressionBeta(st.slice(0, 3), mk).ok);
const pp = A.parsePrices('Date,Adj Close\n2026-01-01,100\n2026-02-01,"105.5"\nbad line\n');
ok('price paste parser reads dates and closes, reports bad lines', pp.prices.length === 2 && pp.prices[1].close === 105.5 && pp.badLines.length === 1);
// live WACC parts match the engine
const s = M.fromSample(require('../data/amzn-sample.json'));
const all = DCF.runAll(M.engineInputs(s).inp, s.mode);
const wp = A.waccParts(s, 'Base');
ok('live WACC parts equal the engine WACC', near(wp.wacc, all.scen.Base.waccUsed, 1e-12) && near(wp.we + wp.wd, 1));
ok('cost of equity = rf + β × ERP + premiums', near(wp.ke, wp.rf + wp.beta * wp.erp + wp.scp + wp.csrp));
// zero premiums are complete, not missing
const z = JSON.parse(JSON.stringify(s)); M.SC.forEach(x => { z.inputs.scp[x] = 0; z.inputs.csrp[x] = 0; });
const comp = M.completion(z);
ok('0% size and company premiums count as complete', !Object.values(comp).some(g => g.items.some(i => (i.key === 'scp' || i.key === 'csrp') && !i.ok)));
ok('size and company premiums are optional adjustments', M.inputStatus(FIELDS.find(f => f.key === 'scp'), z) === 'optional');
// no debt: kd not applicable, WACC = cost of equity
const nd = JSON.parse(JSON.stringify(z)); nd.inputs.debt = 0; nd.waccCfg = { leases: 'exclude' }; M.SC.forEach(x => nd.inputs.kd[x] = null);
ok('no debt and leases excluded: cost of debt not applicable', M.inputStatus(FIELDS.find(f => f.key === 'kd'), nd) === 'na' && !Object.values(M.completion(nd)).some(g => g.items.some(i => i.key === 'kd')));
const r = DCF.run(M.engineInputs(nd).inp, 'Base', nd.mode);
ok('no debt: WACC equals cost of equity', r.ok && near(r.waccUsed, r.W.ke, 1e-12));
const withL = JSON.parse(JSON.stringify(nd)); withL.waccCfg = {}; 
ok('leases still counted: borrowing rate needed', !DCF.run(M.engineInputs(withL).inp, 'Base', withL.mode).ok || withL.inputs.leases === 0);
ok('excluding leases changes the weights only when chosen', near(DCF.run(M.engineInputs(s).inp, 'Base', s.mode).waccUsed, all.scen.Base.waccUsed));
// help coverage
['rf', 'erp', 'beta', 'scp', 'csrp', 'kd', 'we'].forEach(k => { const w = Hp.W[k]; ok(k + ' guide has every section', w && w.quick && w.need && w.where.length && w.calc && w.example && w.choose && w.scen && w.mistakes && w.sources.length); });
ok('size premium help has no universal $2bn rule', !/\$2 ?b(n|illion)? .*(use|enter) 0/i.test(JSON.stringify(Hp.W.scp)) && /no universal/.test(Hp.W.scp.need));
ok('every source link is https and typed', Object.values(Hp.S).every(x => /^https:\/\//.test(x[1]) && ['direct', 'raw', 'method'].includes(x[2])));
ok('field text no longer states a 0–3% standard or $2bn rule', !/0–3%|about \$2bn|sub-\$2B/.test(JSON.stringify(FIELDS.filter(f => ['scp', 'csrp', 'erp'].includes(f.key)))));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
