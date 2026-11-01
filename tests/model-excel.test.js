// Model, validation, persistence-shape and Excel round-trip tests.
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
const DCF = require('../js/engine.js'), M = require('../js/model.js'), X = require('../js/excel.js');
const JSZip = require('../js/vendor/jszip.min.js');
const fs = require('fs'), path = require('path');
const sample = require('../data/amzn-sample.json');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
(async () => {
  // blank model: nothing calculates, nothing is zero-filled
  const b = M.blank();
  const be = M.engineInputs(b);
  ok('blank model blocks every scenario', DCF.SC.every(s => !DCF.run(be.inp, s).ok));
  ok('blank model has no zero substitution', b.inputs.cash === null && b.inputs.g1.Base === null);
  const comp = M.completion(b);
  ok('blank completion shows missing items', Object.values(comp).reduce((a, g) => a + g.total - g.done, 0) > 60);
  // sample model in corrected mode links base revenue to latest historical
  const m = M.fromSample(sample);
  const { inp } = M.engineInputs(m);
  ok('corrected mode uses Historicals latest revenue', inp.rev0 === sample.hist.rev[4]);
  ok('sample model complete', Object.values(M.completion(m)).every(g => g.done === g.total));
  // validation
  const t = M.fromSample(sample); t.inputs.tax.Base = 0.9; t.inputs.price = -5;
  const te = M.engineInputs(t);
  ok('out-of-range tax is flagged', te.invalid.some(x => x.key === 'tax' && x.s === 'Base'));
  ok('negative price is flagged', te.invalid.some(x => x.key === 'price'));
  ok('invalid value treated as missing, not used', te.inp.tax.Base === null && !DCF.run(te.inp, 'Base').ok);
  // workbook mode reproduces Excel through the model layer
  const w = M.fromSample(sample); w.mode = 'workbook';
  ok('workbook mode via model = Excel $183.78', Math.abs(DCF.run(M.engineInputs(w).inp, 'Base', 'workbook').perShare - 183.77816669798423) < 1e-9);
  // Excel export: corrected template
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  const m2 = M.fromSample(sample); m2.inputs.g1.Base = 0.18; m2.inputs.price = 200; m2.inputs.company.name = 'Test & Co <x>';
  for (const tpl of ['corrected', 'original']) {
    const buf = fs.readFileSync(path.join(__dirname, `../templates/dcf-template-${tpl}.xlsx`));
    const bytes = await X.exportModel(JSZip, buf, m2, FIELDS, HIST_FIELDS, tpl === 'original' ? 'workbook' : 'corrected');
    fs.writeFileSync(path.join(out, `export-${tpl}.xlsx`), bytes);
    const back = await X.importModel(JSZip, bytes, M.blank(), FIELDS, HIST_FIELDS);
    ok(`${tpl}: import detects template`, back.mode === (tpl === 'original' ? 'workbook' : 'corrected'));
    ok(`${tpl}: round-trip growth`, back.inputs.g1.Base === 0.18 && back.inputs.g2.Bear === sample.g2.Bear);
    ok(`${tpl}: round-trip price, name, date`, back.inputs.price === 200 && back.inputs.company.name === 'Test & Co <x>' && back.inputs.company.valDate === sample.company.valDate);
    ok(`${tpl}: round-trip historicals and tranches`, back.hist.rev[4] === sample.hist.rev[4] && back.tranches[4].face === sample.tranches[4].face);
    ok(`${tpl}: round-trip TV method and mid-year`, back.inputs.tvMethod.Bull === 'Gordon Growth' && back.inputs.midYear === 'Y');
  }
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
