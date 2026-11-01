// ===== MODEL DATA, VALIDATION AND PERSISTENCE (no UI) =====
const DCFModel = (() => {
  const SC = ['Base', 'Bear', 'Bull'];
  const F = typeof FIELDS !== 'undefined' ? FIELDS : require('./fields.js').FIELDS;
  const HF = typeof HIST_FIELDS !== 'undefined' ? HIST_FIELDS : require('./fields.js').HIST_FIELDS;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  function blank(name = 'New company') {
    const inputs = { company: { name: null, ticker: null, industry: null, currency: 'USD', valDate: null, analyst: null } };
    F.forEach(f => { if (f.key.startsWith('company.')) return; inputs[f.key] = f.tri ? { Base: null, Bear: null, Bull: null } : null; });
    inputs.tvMethod = { Base: 'Gordon Growth', Bear: 'Gordon Growth', Bull: 'Gordon Growth' };
    inputs.midYear = 'Y';
    const hist = { years: [null, null, null, null, null] };
    HF.forEach(h => hist[h.key] = [null, null, null, null, null]);
    return { id: uid(), name, updated: new Date().toISOString(), mode: 'corrected', active: 'Base', inputs, hist,
      wb: { bei: null, crp: null, histErp: null, rawBeta: null, unlevBeta: null },
      tranches: Array.from({ length: 6 }, () => ({ name: null, face: null, coupon: null, maturity: null, note: null })),
      street: { mean: null, median: null, high: null, low: null, rec: null, ltg: null, asOf: null },
      sources: {}, reviewed: {}, log: [], snapshots: [] };
  }
  function fromSample(s, name) {
    const m = blank(name || s.company.name);
    Object.keys(m.inputs).forEach(k => { if (k in s) m.inputs[k] = JSON.parse(JSON.stringify(s[k])); });
    m.inputs.company = Object.assign({}, s.company);
    m.hist = JSON.parse(JSON.stringify(s.hist));
    m.wb = Object.assign({}, s.wb); m.tranches = JSON.parse(JSON.stringify(s.tranches));
    m.street = Object.assign({}, s.street);
    m.sample = true;
    return m;
  }
  const isNum = v => typeof v === 'number' && isFinite(v);
  function fieldError(f, v) {
    if (v === null || v === undefined || v === '') return null;
    if (f.unit === 'choice') {
      const ok = f.key === 'midYear' ? ['Y', 'N'] : ['Gordon Growth', 'Exit Multiple'];
      return ok.includes(v) ? null : 'Pick one of the options.';
    }
    if (f.unit === 'text' || f.unit === 'date') return null;
    if (!isNum(v)) return 'Enter a number.';
    const pct = f.unit === 'pct', fmt = x => pct ? (x * 100) + '%' : x;
    if (f.min === 0.0001) { if (v <= 0) return 'Must be greater than zero.'; }
    else if (f.min !== null && v < f.min) return `Must be at least ${fmt(+(f.min * (pct ? 100 : 1)).toFixed(4) / (pct ? 100 : 1))}.`;
    if (f.max !== null && v > f.max) return `Must be at most ${fmt(f.max)}.`;
    return null;
  }
  // Fields that matter in a given mode
  function relevant(f, model, s) {
    if (f.key === 'we') return model.mode === 'workbook';
    if (f.key === 'tcapex') return model.mode === 'workbook';
    if (f.key === 'troic') return true;
    if (f.key === 'rev0') return model.mode === 'workbook';
    if (f.key === 'exitMult') return !s || model.inputs.tvMethod[s] === 'Exit Multiple';
    return true;
  }
  // Build the flat engine input, dropping invalid values (they count as missing, never as zero)
  function engineInputs(model) {
    const out = {}, invalid = [];
    F.forEach(f => {
      if (f.key.startsWith('company.')) return;
      const v = model.inputs[f.key];
      if (f.tri) { out[f.key] = {}; SC.forEach(s => { const e = fieldError(f, v[s]); if (e) invalid.push({ key: f.key, s, e }); out[f.key][s] = e ? null : v[s]; }); }
      else { const e = fieldError(f, v); if (e) invalid.push({ key: f.key, e }); out[f.key] = e ? null : v; }
    });
    if (model.mode === 'corrected') { const r = model.hist.rev[4]; out.rev0 = isNum(r) && r > 0 ? r : null; }
    return { inp: out, invalid };
  }
  // Completion status per group. Required = needed by the valuation in the current mode.
  function completion(model) {
    const { invalid } = engineInputs(model);
    const groups = {};
    const add = (g, item) => { (groups[g] = groups[g] || { items: [], done: 0, total: 0 }).items.push(item); groups[g].total++; if (item.ok) groups[g].done++; };
    F.forEach(f => {
      if (!f.required || !relevant(f, model)) return;
      const cols = f.tri ? SC : [null];
      cols.forEach(s => {
        if (f.key === 'exitMult' && model.inputs.tvMethod[s] !== 'Exit Multiple') return;
        const v = f.tri ? model.inputs[f.key][s] : model.inputs[f.key];
        const bad = invalid.find(x => x.key === f.key && (x.s || null) === s);
        const ok = v !== null && v !== undefined && v !== '' && !bad;
        add(f.group, { key: f.key, s, label: f.label + (s ? ` (${s})` : ''), ok, problem: bad ? bad.e : (ok ? null : 'Missing') });
      });
    });
    // historicals: revenue required for the latest year in corrected mode; others recommended
    HF.forEach(h => model.hist[h.key].forEach((v, i) => {
      const need = h.key === 'rev' ? (i === 4 && model.mode === 'corrected') : false;
      if (!need) return;
      add('hist', { key: 'hist.' + h.key, i, label: `${h.label} (${model.hist.years[i] || 'latest year'})`, ok: isNum(v) && v > 0, problem: isNum(v) ? (v > 0 ? null : 'Must be greater than zero') : 'Missing' });
    }));
    return groups;
  }
  function logChange(model, field, s, from, to) {
    model.log.unshift({ at: new Date().toISOString(), field, s: s || null, from, to });
    if (model.log.length > 500) model.log.length = 500;
  }
  // ---- persistence (browser storage, per-company models) ----
  const KEY = 'dcfcalc.models.v1';
  function loadAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  function save(model) { const all = loadAll(); model.updated = new Date().toISOString(); all[model.id] = model; return saveAll(all); }
  function remove(id) { const all = loadAll(); delete all[id]; saveAll(all); }
  function upgrade(m) { // fill any keys missing from an older file
    const b = blank(m.name); const out = Object.assign(b, m);
    out.inputs = Object.assign(blank().inputs, m.inputs || {});
    ['sources', 'reviewed'].forEach(k => out[k] = m[k] || {}); ['log', 'snapshots'].forEach(k => out[k] = m[k] || []);
    return out;
  }
  return { SC, blank, fromSample, fieldError, relevant, engineInputs, completion, logChange, loadAll, save, remove, upgrade, isNum };
})();
if (typeof module !== 'undefined') module.exports = DCFModel;
