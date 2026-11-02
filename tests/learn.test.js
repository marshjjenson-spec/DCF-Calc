// Every help panel in every model has a first-time guide with all five parts and at least one checked video
global.FIELDS = require('../js/fields.js').FIELDS; const { HIST_FIELDS, DIL_HELP } = require('../js/fields.js');
const L = require('../js/learn.js'), C = require('../js/comps-help.js'), F = require('../js/fsm-help.js'), S = require('../js/sim-help.js');
const fs = require('fs');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const panels = {
  dcf: [...FIELDS.map(f => f.key), ...HIST_FIELDS.map(h => 'hist.' + h.key), ...Object.keys(DIL_HELP), 'dil.proxy', 'ttm.'],
  comps: Object.keys(C.G), fsm: Object.keys(F.G), sim: Object.keys(S.G),
};
let n = 0;
for (const [tab, keys] of Object.entries(panels)) for (const k of keys) {
  n++;
  const id = L.topicFor(tab, k);
  ok(`${tab}:${k} has a beginner topic`, id && L.T[id]);
  const h = L.render(tab, k, esc, k);
  ok(`${tab}:${k} renders all five parts`, /In plain English/.test(h) && /step by step/.test(h) && /Typical values/.test(h) && /Why it is set this way/.test(h) && /youtube\.com\/watch\?v=/.test(h));
  ok(`${tab}:${k} has no unfilled {label}`, !/\{label\}/.test(h));
}
ok('about 300 panels covered (' + n + ')', n >= 290);
for (const [id, t] of Object.entries(L.T)) {
  ok(id + ' plain', t.plain && t.plain.length > 40);
  ok(id + ' has at least 2 steps', Array.isArray(t.steps) && t.steps.length >= 2);
  ok(id + ' has ranges with three columns', Array.isArray(t.ranges) && t.ranges.length >= 1 && t.ranges.every(r => r.length === 3));
  ok(id + ' explains why', t.why && t.why.length > 40);
  ok(id + ' has a video', t.vids.length >= 1 && t.vids.every(v => L.V[v]));
  ok(id + ' links exist', (t.links || []).every(k => L.L[k]));
}
for (const [id, v] of Object.entries(L.V)) {
  ok(id + ' YouTube id format', /^[A-Za-z0-9_-]{11}$/.test(v[2]));
  ok(id + ' has title and channel', v[0] && v[1]);
}
ok('no duplicate video ids', new Set(Object.values(L.V).map(v => v[2])).size === Object.keys(L.V).length);
ok('every catalogued video is used', Object.keys(L.V).every(v => Object.values(L.T).some(t => t.vids.includes(v))));
// terminal growth guide answers "why"
const tg = L.T.tg;
ok('terminal growth: names GDP, risk-free rate and WACC', /economy/.test(tg.why) && /risk-free/.test(tg.why) && /WACC/.test(tg.why));
// no YouTube search pages pretending to be videos anywhere in the app
const js = fs.readdirSync(__dirname + '/../js').filter(f => f.endsWith('.js')).map(f => fs.readFileSync(__dirname + '/../js/' + f, 'utf8')).join('\n');
ok('no YouTube search links in the app', !/youtube\.com\/results/.test(js));
console.log(`learn: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
