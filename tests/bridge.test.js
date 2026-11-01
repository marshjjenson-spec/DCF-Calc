// Equity bridge worksheets, lease treatment, mid-year timing and scenario probabilities
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
const A = require('../js/analysis.js'), M = DCFModel, Hp = require('../js/help.js');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-6) => a != null && Math.abs(a - b) < t;
// guides
Object.entries(Hp.B).forEach(([k, g]) => ok(k + ' guide has every section', g.what && g.need && g.include && g.where && g.calc && g.calc.formula && g.calc.example && g.decide.length && g.mistakes.length));
ok('debt definition is the requested wording', /^Total financial debt is the value of a company's outstanding interest-bearing/.test(Hp.B.debt.what) && FIELDS.find(f => f.key === 'debt').what === Hp.B.debt.what);
ok('no fixed mid-year or probability rules of thumb', !/5–7%|50–60%/.test(JSON.stringify(FIELDS.filter(f => ['midYear', 'prob'].includes(f.key)))));
// debt
const rows = A.DEBT_CATS.map(c => ({ cat: c }));
rows[2] = Object.assign(rows[2], { cur: 2000, inc: 'Yes' }); rows[3] = Object.assign(rows[3], { cur: 1500, inc: 'Yes' }); rows[5] = Object.assign(rows[5], { nc: 20000, inc: 'Yes', mkt: 18000 }); rows[11] = Object.assign(rows[11], { cur: 500, nc: 2500, inc: 'Yes' });
const d = A.debtRecon(rows, { leaseMode: 'operating' });
ok('debt total adds included rows: 2,000 + 1,500 + 20,000 + 3,000', near(d.total, 26500) && d.n === 4 && !d.warn.some(w => w.level === 'bad'));
ok('market values used where available', near(A.debtRecon(rows, { market: true }).total, 24500));
const dup = rows.map(r => Object.assign({}, r)); dup[6] = Object.assign(dup[6], { rep: 21500, inc: 'Yes' });
ok('current portion counted twice is flagged', A.debtRecon(dup, {}).warn.some(w => /current portion is included both/.test(w.text)));
const ol = rows.map(r => Object.assign({}, r)); ol[12] = Object.assign(ol[12], { cur: 100, nc: 900, inc: 'Yes' });
ok('operating leases in debt flagged under operating treatment', A.debtRecon(ol, { leaseMode: 'operating' }).warn.some(w => w.level === 'bad' && /counts leases twice/.test(w.text)));
ok('operating leases in debt flagged under debt treatment too', A.debtRecon(ol, { leaseMode: 'debt' }).warn.some(w => /also subtracted on their own line/.test(w.text)));
ok('nothing included is not zero', A.debtRecon(A.DEBT_CATS.map(c => ({ cat: c })), {}).total === null);
// pension
const p = A.pensionCalc({ pbo: 5000, assets: 4000 });
ok('pension deficit 5,000 − 4,000 = 1,000, no automatic tax haircut', p.deficit === 1000 && p.proposed === 1000 && p.tax === null);
ok('pension: counted elsewhere is removed once', A.pensionCalc({ pbo: 5000, assets: 4000, elsewhere: 1000 }).proposed === 0);
ok('pension: tax only when chosen', near(A.pensionCalc({ pbo: 5000, assets: 4000, applyTax: 'Yes', tax: 0.25 }).proposed, 750) && A.pensionCalc({ pbo: 5000, assets: 4000, tax: 0.25 }).proposed === 1000);
ok('pension without inputs is not zero', A.pensionCalc({}) === null);
// NCI
const n = A.nciCalc({ subEq: 10000, pct: 0.2, carry: 900, method: 'Estimated economic value' });
ok('NCI: 10,000 × 20% = 2,000, book shown separately', n.est === 2000 && n.carry === 900 && n.selected === 2000);
// investments
const iv = A.investCalc([{ shares: 50, price: 20, inFc: 'No', inCash: 'No' }, { value: 300, inFc: 'Yes', inCash: 'No' }, { value: 100 }]);
ok('investments: 50 × $20 added; one already in forecast excluded; undecided not added', iv.total === 1000 && iv.undecided === 1);
// deferred taxes
const t = A.dtlCalc({ dtl: 1000, dta: 600, va: 100, sched: [{ amt: 100 }, { amt: 100 }, { amt: 100 }], r: 0.08 });
ok('net DTL = 1,000 − (600 − 100) = 500', t.net === 500);
ok('PV of incremental tax payments at 8% = 257.71', near(t.pv, 100 / 1.08 + 100 / 1.08 ** 2 + 100 / 1.08 ** 3, 1e-9) && near(t.pv, 257.71, 0.01));
// Black–Scholes
ok('normal CDF', near(A.ncdf(0), 0.5, 1e-7) && near(A.ncdf(1.96), 0.9750021, 1e-6));
const bs = A.blackScholes(100, 100, 5, 0.04, 0, 0.3);
ok('Black–Scholes S=K=100, T=5, r=4%, σ=30%: 33.96', near(bs.c, 33.9618, 1e-3));
ok('put-call parity holds', (() => { const c = A.blackScholes(100, 120, 2, 0.04, 0.01, 0.25).c; const d1 = (Math.log(100 / 120) + (0.04 - 0.01 + 0.03125) * 2) / (0.25 * Math.SQRT2); const put = 120 * Math.exp(-0.08) * A.ncdf(-(d1 - 0.25 * Math.SQRT2)) - 100 * Math.exp(-0.02) * A.ncdf(-d1); return near(c - put, 100 * Math.exp(-0.02) - 120 * Math.exp(-0.08), 1e-6); })());
ok('out-of-the-money option keeps time value', A.blackScholes(100, 150, 5, 0.04, 0, 0.3).c > 0);
const ot = A.optionTranches([{ n: 10, k: 100, t: 5, vol: 0.3, forf: 0.1 }, {}], 100, { r: 0.04 });
ok('tranches: value × options × (1 − forfeiture)', near(ot.total, bs.c * 10 * 0.9, 1e-6));
// mid-year
const s = M.fromSample(require('../data/amzn-sample.json'));
const my = A.midYearCompare(s, 'Base');
ok('mid-year: each FCFF discounted half a year less', near(my.mid.years[0].pv, my.end.years[0].fcff / Math.pow(1 + my.mid.waccUsed, 0.5), 1e-6) && near(my.end.years[0].pv, my.end.years[0].fcff / (1 + my.end.waccUsed), 1e-6));
ok('mid-year example: 100 at 10% → 90.91 vs 95.35', near(100 / 1.1, 90.909, 1e-3) && near(100 / Math.sqrt(1.1), 95.346, 1e-3));
ok('Gordon TV under mid-year = end-year-10 value of mid-year flows', near(my.mid.pvTV, my.mid.tvGordon * Math.sqrt(1 + my.mid.waccUsed) / Math.pow(1 + my.mid.waccUsed, 10), 1e-3));
// probabilities
ok('weighted example 100/150/200 at 25/50/25 = 150', 100 * 0.25 + 150 * 0.5 + 200 * 0.25 === 150);
ok('probabilities: blank is missing, 0% is valid', !A.probCheck({ Bear: null, Base: 0.5, Bull: 0.5 }).ok && A.probCheck({ Bear: 0, Base: 0.5, Bull: 0.5 }).ok);
const pc = A.probCheck({ Bear: 0.2, Base: 0.5, Bull: 0.2 });
ok('invalid sum is reported with a rescale offer, not silently fixed', !pc.ok && near(pc.normalized.Base, 0.5 / 0.9));
const dp = A.driverProbs({ p0: 0.6 }, { p0: 0.5 }, [['Bull', 'Base'], ['Base', 'Bear']]);
ok('driver probabilities: 0.6×0.5 Bull, 0.6×0.5 + 0.4×0.5 Base, 0.4×0.5 Bear', near(dp.probs.Bull, 0.3) && near(dp.probs.Base, 0.5) && near(dp.probs.Bear, 0.2));
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
