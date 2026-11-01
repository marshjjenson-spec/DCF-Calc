// Independent recalculation of the valuation, written from first principles without engine code.
// Every scenario of the sample and three SEC-imported companies, both timing conventions, both terminal methods,
// both lease treatments, a loss-making case, and the original-workbook mode, must match the engine to 1e-9.
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCFSec = require('../js/sec.js'); global.DCF = require('../js/engine.js'); global.DCFModel = require('../js/model.js');
const D = require('../js/data.js'), M = DCFModel;
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
function indep(I, s, mode) {
  const v = k => I[k][s];
  const ke = v('rf') + v('beta') * v('erp') + v('scp') + v('csrp');
  const shares = I.basic + I.options - I.treasury, E = shares * I.price;
  const we = mode === 'workbook' ? v('we') : E / (E + I.debt + (I.leasesInWacc === false ? 0 : I.leases)), wd = 1 - we;
  const w = ke * we + (wd > 0 ? v('kd') * (1 - v('tax')) * wd : 0), g = v('tg');
  const gr = t => t <= 3 ? v('g1') : t <= 7 ? v('g2') : v('g3');
  const mg = t => t <= 5 ? v('em1') + (v('em5') - v('em1')) * (t - 1) / 4 : v('em5') + (v('em10') - v('em5')) * (t - 5) / 5;
  const cx = t => t <= 3 ? v('capex1') : t <= 7 ? v('capex2') : v('capex3');
  let prev = I.rev0, loss = 0; const f = [], rev = [], eb = [];
  for (let t = 1; t <= 10; t++) {
    const r = prev * (1 + gr(t)), e = r * mg(t), da = r * v('da'), ebit = e - da, rate = v('tax') - (t <= 3 ? v('nol') : 0);
    let tax;
    if (mode === 'workbook') tax = ebit * rate;
    else if (ebit < 0) { tax = 0; loss -= ebit; } else { const u = Math.min(loss, ebit); loss -= u; tax = (ebit - u) * rate; }
    f.push(ebit - tax + da - r * cx(t) - (r - prev) * v('nwc') - r * v('acq')); rev.push(r); eb.push(e); prev = r;
  }
  const r11 = rev[9] * (1 + g), e11 = r11 * v('tem'), d11 = r11 * v('da'), ebit11 = e11 - d11;
  const n11 = ebit11 - (mode === 'workbook' ? ebit11 * v('tax') : Math.max(0, ebit11) * v('tax'));
  const mid = I.midYear === 'Y', stub = I.stub || 0;
  let tv, per;
  if (mode === 'workbook') { const f11 = n11 + d11 - r11 * v('tcapex') - (r11 - rev[9]) * v('nwc') - r11 * v('acq'); tv = v('tvMethod') === 'Gordon Growth' ? f11 * (1 + g) / (w - g) : e11 * v('exitMult'); per = 10; }
  else if (v('tvMethod') === 'Gordon Growth') { tv = n11 * (1 - g / v('troic')) / (w - g); per = mid ? 9.5 : 10; }
  else { tv = eb[9] * v('exitMult'); per = 10; }
  const pv = f.reduce((a, x, i) => a + x / Math.pow(1 + w, i + 1 - (mid ? 0.5 : 0) - stub), 0) + tv / Math.pow(1 + w, per - stub);
  const eq = pv + I.cash + I.sti + I.stakes - I.debt - I.pension - (I.leasesInBridge === false ? 0 : I.leases) - I.minority - I.dtl - I.optVal;
  return { ev: pv, perShare: eq / shares, wacc: w };
}
const sample = M.fromSample(require('../data/amzn-sample.json'));
const FC = ['g1','g2','g3','em1','em5','em10','gm1','gm5','gm10','da','tax','nol','capex1','capex2','capex3','nwc','acq','s2c','rf','erp','beta','scp','csrp','kd','we','tg','tem','tcapex','troic','tvMethod','exitMult','prob'];
const models = [['sample', sample], ['sample workbook', Object.assign(JSON.parse(JSON.stringify(sample)), { mode: 'workbook' })]];
const loss = JSON.parse(JSON.stringify(sample)); M.SC.forEach(s => { loss.inputs.em1[s] = -0.08; loss.inputs.em5[s] = 0.02; }); models.push(['loss-making', loss]);
for (const [t, f] of [['AMZN', 'sec-amzn'], ['TSLA', 'sec-tsla'], ['MSTR', 'sec-mstr']]) for (const base of ['fy', 'ttm']) {
  const m = M.blank(); D.applyImport(m, D.mapSEC(require('./fixtures/' + f + '.json'))); m.inputs.company.valDate = '2026-11-01'; m.base.mode = base; m.timing = 'dated';
  FC.forEach(k => { m.inputs[k] = JSON.parse(JSON.stringify(sample.inputs[k])); });
  ['price', 'basic', 'options', 'treasury', 'cash', 'sti', 'debt', 'pension', 'leases', 'minority', 'stakes', 'dtl', 'optVal'].forEach(k => { if (m.inputs[k] == null) m.inputs[k] = sample.inputs[k]; });
  if (!m.dilution || !m.dilution.method) { m.dilution = M.blankDilution(); m.dilution.method = 'totals'; }
  models.push([`${t} ${base}`, m]);
}
let n = 0, worst = 0;
models.forEach(([name, m0]) => ['operating', 'debt'].forEach(lm => ['Y', 'N'].forEach(my => ['Gordon Growth', 'Exit Multiple'].forEach(tvm => {
  const m = JSON.parse(JSON.stringify(m0)); m.leaseMode = lm; m.inputs.midYear = my; M.SC.forEach(s => m.inputs.tvMethod[s] = tvm);
  const { inp } = M.engineInputs(m);
  M.SC.forEach(s => {
    const r = DCF.run(inp, s, m.mode), x = indep(inp, s, m.mode); n++;
    if (!r.ok) { ok(`${name} ${s} calculates`, false); return; }
    const d = Math.max(Math.abs(r.perShare - x.perShare) / Math.max(1, Math.abs(x.perShare)), Math.abs(r.ev - x.ev) / Math.max(1, Math.abs(x.ev)), Math.abs(r.waccUsed - x.wacc));
    worst = Math.max(worst, d);
    ok(`${name} / ${s} / leases ${lm} / mid-year ${my} / ${tvm}: engine = independent (${r.perShare.toFixed(4)} vs ${x.perShare.toFixed(4)})`, d < 1e-9);
  });
}))));
ok('stub periods were exercised', models.some(([, m]) => M.engineInputs(m).inp.stub > 0));
const lr = DCF.run(M.engineInputs(loss).inp, 'Base', 'corrected');
ok('losses pay no tax and are carried forward', lr.years[0].ebit < 0 && lr.years[0].taxes === 0 && lr.years.some(y => y.lossUsed > 0));
// scenarios are independent: changing Bear moves only Bear
const sc = JSON.parse(JSON.stringify(sample)); const a0 = DCF.runAll(M.engineInputs(sc).inp, sc.mode); sc.inputs.g1.Bear += 0.05; const a1 = DCF.runAll(M.engineInputs(sc).inp, sc.mode);
ok('scenarios calculate independently', a0.scen.Base.perShare === a1.scen.Base.perShare && a0.scen.Bull.perShare === a1.scen.Bull.perShare && a0.scen.Bear.perShare !== a1.scen.Bear.perShare);
ok('probability-weighted value = Σ value × probability', Math.abs(a1.weighted - M.SC.reduce((t, s) => t + a1.scen[s].perShare * sc.inputs.prob[s], 0)) < 1e-9);
// sensitivity centre equals the model
const sens = DCF.sensitivity(M.engineInputs(sample).inp, 'Base', 'corrected', [a0.scen.Base.waccUsed], [sample.inputs.tg.Base]);
ok('sensitivity table centre equals the valuation', Math.abs(sens[0][0] - a0.scen.Base.perShare) < 1e-9);
console.log(`${n} independent cases, worst relative difference ${worst.toExponential(2)}`);
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
