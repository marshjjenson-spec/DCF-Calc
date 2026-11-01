// Every editable field has help; examples are real (with an accession number) or clearly labelled
global.FIELDS = require('../js/fields.js').FIELDS; const { HIST_FIELDS, DIL_HELP } = require('../js/fields.js');
const Hp = require('../js/help.js');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const keys = [...FIELDS.map(f => f.key), ...HIST_FIELDS.map(h => 'hist.' + h.key), ...Object.keys(DIL_HELP), 'dil.proxy'];
const missing = keys.filter(k => !Hp.H[k] && !Hp.G[k]);
ok('every editable field has a help entry: ' + missing.join(', '), missing.length === 0);
Object.entries(Hp.H).forEach(([k, h]) => { if (!h.example) return; const e = h.example(); ok(k + ' example is verified with a filing or says none', (e.kind === 'verified' && e.filing && e.filing.form) || e.kind === 'none'); if (e.kind === 'verified' && e.filing.accn) ok(k + ' accession format', /^\d{10}-\d{2}-\d{6}$/.test(e.filing.accn)); });
ok('Amazon RSU help says 223.3 million is gross, not net', /gross/.test(Hp.H['dil.rsu'].example().text) && /132/.test(Hp.H['dil.rsu'].example().text));
ok('Amazon shares help: 10,813,138,306 as of October 21, 2026, not 10,797', /10,813,138,306/.test(Hp.H.basic.example().text) && /not this count|10,797/.test(Hp.H.basic.example().text));
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../js/fields.js', 'utf8');
ok('no made-up share count presented as a filing quote', !/10,731/.test(src));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
