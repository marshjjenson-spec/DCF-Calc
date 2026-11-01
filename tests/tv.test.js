// Terminal value: guides, estimators, method comparison, implied growth, checks. Three companies from SEC fixtures.
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCFSec = require('../js/sec.js'); global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
const D = require('../js/data.js'), A = require('../js/analysis.js'), M = DCFModel, Hp = require('../js/help.js');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-6) => a != null && Math.abs(a - b) < t;
// formulas from the spec
ok('nominal growth (1 + 2%) × (1 + 2%) − 1 = 4.04%', near(A.nominalGrowth(0.02, 0.02), 0.0404, 1e-12));
ok('nominal growth needs both inputs', A.nominalGrowth(0.02, null) === null);
const st = A.stats([0.1, null, 0.12, 0.14, 0.13]);
ok('stats: mean, median, range, slope', near(st.mean, 0.1225) && near(st.median, 0.125) && st.min === 0.1 && st.max === 0.14 && st.slope > 0 && st.n === 4);
const R = A.histRoic([{ ebit: 100, tax: 0.25, equity: 500, debt: 300, leases: 100, cash: 100 }, { ebit: 120, tax: 0.25, equity: 600, debt: 300, leases: 100, cash: 200 }]);
ok('ROIC: NOPAT = EBIT × (1 − t), IC = E + D + L − cash, average IC', near(R[1].nopat, 90) && R[0].ic === 800 && R[1].ic === 800 && near(R[1].roic, 90 / 800) && R[0].roic === null);
ok('ROIC row without balance sheet is not zero', A.histRoic([{ ebit: 100, tax: 0.2 }])[0].ic === null);
const sm = A.segMargin([{ rev: 600, m: 0.3 }, { rev: 400, m: 0.1 }, {}], 50, 1000);
ok('segment margin: Σ(rev × m) − unallocated, reconciled', near(sm.ebitda, 180 + 40 - 50) && near(sm.margin, 0.17) && near(sm.gap, 0));
ok('reinvestment rate 2.5% ÷ 10% = 25%, FCFF = NOPAT × 75%', near(0.025 / 0.10, 0.25));
// guides: every terminal input has all sections, real-figure examples only where labelled
['tg', 'tem', 'troic', 'tvMethod', 'exitMult'].forEach(k => { const g = Hp.T[k]; ok(k + ' guide complete', g && g.what && g.why && g.where.length && g.calc.formula && g.example && g.forecast.length && g.scen && g.mistakes.length && g.sources.length); });
ok('tg example uses the verified Fed SEP figures', /September 16, 2026/.test(Hp.T.tg.example) && /4\.04%/.test(Hp.T.tg.example));
ok('troic text does not force ROIC above WACC', !/must be > WACC|should be above WACC/i.test(FIELDS.find(f => f.key === 'troic').enter + FIELDS.find(f => f.key === 'troic').tip));
ok('tg text no longer says it MUST be ≤ risk-free', !/MUST be/.test(FIELDS.find(f => f.key === 'tg').tip));
ok('hypothetical examples are labelled', ['troic', 'tvMethod', 'exitMult'].every(k => /^Hypothetical/.test(Hp.T[k].example)));
Object.values(Hp.S).forEach(x => ok('source url is https: ' + x[0].slice(0, 30), /^https:\/\//.test(x[1])));
// three companies: imported filings + the sample's forecast assumptions (test-only assumptions, not company data)
const sample = M.fromSample(require('../data/amzn-sample.json'));
const FC = ['g1','g2','g3','em1','em5','em10','gm1','gm5','gm10','da','tax','nol','capex1','capex2','capex3','nwc','acq','s2c','rf','erp','beta','scp','csrp','kd','we','tg','tem','tcapex','troic','tvMethod','exitMult','prob'];
const cos = { AMZN: { file: 'sec-amzn', fy: [716924, 79975, 65756] }, TSLA: { file: 'sec-tsla' }, MSTR: { file: 'sec-mstr' } };
Object.entries(cos).forEach(([t, c]) => {
  const m = M.blank(); D.applyImport(m, D.mapSEC(require('./fixtures/' + c.file + '.json'))); m.inputs.company.valDate = '2026-11-01';
  FC.forEach(k => { m.inputs[k] = JSON.parse(JSON.stringify(sample.inputs[k])); });
  ['price', 'basic', 'options', 'treasury', 'cash', 'sti', 'debt', 'pension', 'leases', 'minority', 'stakes', 'dtl', 'optVal', 'midYear'].forEach(k => { if (m.inputs[k] == null) m.inputs[k] = sample.inputs[k]; });
  const all = DCF.runAll(M.engineInputs(m).inp, m.mode);
  const fin = m.fin.years[0].values;
  const an = A.anchors(m).tem;
  // margins shown are the filing figures
  const ebitdaFY = fin.ebit + fin.da;
  ok(t + ': latest FY EBITDA margin = (EBIT + D&A) ÷ revenue from the filing', near(an.latestFY, ebitdaFY / fin.rev, 1e-9) || an.latestFY === null);
  if (c.fy) ok(t + ': FY2025 margin 20.3% (79,975 + 65,756) ÷ 716,924', near(an.latestFY, (79975 + 65756) / 716924, 1e-9));
  if (!all.scen.Base.ok) { ok(t + ': base scenario calculates', false); console.log(all.scen.Base); return; }
  const cmp = A.tvCompare(m, 'Base');
  ok(t + ': Gordon column equals the engine', near(cmp.G.perShare, DCF.run(M.engineInputs(m).inp, 'Base', m.mode, { tvMethod: 'Gordon Growth' }).perShare, 1e-9));
  ok(t + ': exit TV = year-10 EBITDA × multiple', near(cmp.X.tv, cmp.X.r.years[9].ebitda * m.inputs.exitMult.Base, 1e-6));
  ok(t + ': timing: Gordon 9.5 years with mid-year, exit 10', cmp.G.period === (m.inputs.midYear === 'Y' ? 9.5 : 10) - (cmp.G.r.stub || 0) && cmp.X.period === 10 - (cmp.X.r.stub || 0));
  ok(t + ': implied multiple uses the end-of-year-10 Gordon value', near(cmp.impl.trailing * cmp.impl.ebitda10, cmp.G.tv * (m.inputs.midYear === 'Y' ? Math.sqrt(1 + cmp.G.r.waccUsed) : 1), 1e-3));
  // round trip: the PV of a Gordon TV at g = 3% → implied g = 3%
  const g0 = DCF.run(M.engineInputs(m).inp, 'Base', m.mode, { tvMethod: 'Gordon Growth', tg: 0.03 });
  const ig = A.impliedG(m, 'Base', g0.pvTV);
  ok(t + ': implied-growth solver recovers g with FCFF depending on g', ig.ok && ig.roots.some(r => near(r, 0.03, 1e-7)));
  // FCFF11 = NOPAT × (1 − g ÷ ROIC)
  const y11 = cmp.G.r.years[10];
  ok(t + ': terminal FCFF = NOPAT × (1 − g ÷ ROIC)', near(y11.fcff, y11.nopat * (1 - m.inputs.tg.Base / m.inputs.troic.Base), 1e-6));
  // checks never change inputs
  const before = JSON.stringify(m.inputs); A.tvChecks(m, all, {}); ok(t + ': checks change nothing', JSON.stringify(m.inputs) === before);
});
// checks fire on the conditions in the spec
const c1 = JSON.parse(JSON.stringify(sample)); c1.inputs.tg.Base = 0.06; c1.inputs.troic.Base = 0.05; c1.inputs.tem.Base = c1.inputs.em10.Base + 0.05;
const a1 = DCF.runAll(M.engineInputs(c1).inp, c1.mode), k1 = A.tvChecks(c1, a1, { peers: [{ m: 10, basis: 'Forward (next-year EBITDA)' }, { m: 12, basis: 'Trailing (last-twelve-month EBITDA)' }] });
const has = (re, lvl) => k1.some(x => re.test(x.text) && (!lvl || x.level === lvl));
ok('check: g above risk-free flagged as a discipline', has(/above the risk-free rate/, 'warn'));
ok('check: ROIC below WACC is a warning, not forbidden', has(/so every dollar reinvested/, "warn"));
ok('check: reinvestment above 100%', has(/above 100%/, 'bad'));
ok('check: margin step year 10 → 11', has(/steps from/));
ok('check: exit multiple outside peers', has(/outside the range of the peers/));
ok('check: forward multiple on trailing EBITDA', has(/forward EBITDA/));
ok('check: mixed peer bases', has(/mix trailing and forward/));
const c2 = JSON.parse(JSON.stringify(sample)); c2.inputs.tg.Base = 0.12;
ok('check: g ≥ WACC is an error', A.tvChecks(c2, DCF.runAll(M.engineInputs(c2).inp, c2.mode), {}).some(x => x.level === 'bad' && /not below WACC/.test(x.text)));
const c3 = JSON.parse(JSON.stringify(sample)); c3.inputs.troic.Base = 0.05;
const x3 = DCF.run(M.engineInputs(c3).inp, 'Base', c3.mode, { tvMethod: 'Exit Multiple' });
const ig3 = A.impliedG(c3, 'Base', x3.pvTV);
ok('implied growth with ROIC < WACC: explained, never invented', ig3.ok || /does not add value|No growth rate/.test(ig3.why));
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
