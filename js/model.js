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
      sources: {}, reviewed: {}, log: [], snapshots: [],
      imported: {}, ref: {}, meta: {}, importNotes: [], savedAt: null, lastRun: null,
      // choices that start with a default value: they don't count as complete until the analyst confirms them
      defaults: { tvMethod: true, midYear: true },
      asOf: { price: null, range: null, basic: null },
      dilution: blankDilution() };
  }
  function blankDilution(method = null) {
    const row = () => ({ label: null, n: null, k: null });
    return { method, est: null, ignore: false, none: false, options: [row(), row(), row(), row()], rsu: { n: null, unrecog: null }, warrants: [row(), row()], converts: [Object.assign(row(), { net: false }), Object.assign(row(), { net: false })] };
  }
  function fromSample(s, name) {
    const m = blank(name || s.company.name);
    Object.keys(m.inputs).forEach(k => { if (k in s) m.inputs[k] = JSON.parse(JSON.stringify(s[k])); });
    m.inputs.company = Object.assign({}, s.company);
    m.hist = JSON.parse(JSON.stringify(s.hist));
    m.wb = Object.assign({}, s.wb); m.tranches = JSON.parse(JSON.stringify(s.tranches));
    m.street = Object.assign({}, s.street);
    m.sample = true;
    m.defaults = {};
    m.dilution = blankDilution('totals');
    m.asOf = { price: s.company.valDate || null, range: s.company.valDate || null, basic: null };
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
  // ---- share dilution ----
  // Turns the dilution inputs into the workbook's two cells: gross new shares (options) and shares repurchased (treasury).
  // Options and warrants: treasury stock method, only when in the money. Unvested RSUs: all units, less shares bought back
  // with unrecognised compensation (ASC 260 treasury stock method). Convertibles: if-converted, only when in the money;
  // net share settlement issues shares only for the excess over principal. Awards already vested are in shares outstanding.
  function dilution(model) {
    const D = model.dilution || blankDilution();
    const P = model.inputs.price, B = model.inputs.basic;
    const out = { method: D.method, ok: false, problem: null, gross: null, buyback: null, net: null, diluted: null, rows: [], warnings: [], invalid: [] };
    const okP = isNum(P) && P > 0, okB = isNum(B) && B > 0;
    const fin = (g, bb) => { out.gross = g; out.buyback = bb; out.net = g - bb; out.diluted = okB ? B + g - bb : null; out.ok = okB; if (!okB) out.problem = 'Enter actual shares outstanding'; if (okB && B > 0 && out.net / B > 0.15) out.warnings.push(`Net dilution is ${(out.net / B * 100).toFixed(1)}% of shares outstanding. Check the inputs.`); return out; };
    if (!D.method) { out.problem = 'Choose a dilution method'; return out; }
    if (D.method === 'totals') {
      const o = model.inputs.options, t = model.inputs.treasury;
      if (!isNum(o) || !isNum(t)) { out.problem = 'Missing'; return out; }
      if (o < 0 || t < 0) { out.problem = 'Must be at least 0.'; return out; }
      return fin(o, t);
    }
    if (D.method === 'simple') {
      if (D.ignore) { out.warnings.push('Valuing on actual shares outstanding only: dilution from options, RSUs, warrants and convertibles is ignored.'); return fin(0, 0); }
      if (!isNum(D.est)) { out.problem = 'Enter estimated diluted shares, or tick "Value on actual shares only"'; return out; }
      if (!okB) { out.problem = 'Enter actual shares outstanding'; return out; }
      if (D.est < B) { out.problem = 'Estimated diluted shares are below actual shares outstanding'; out.invalid.push('est'); return out; }
      out.rows.push({ type: 'Estimate', label: 'Estimated diluted shares − actual shares', n: D.est, gross: D.est - B, buyback: 0, net: D.est - B, note: 'Your estimate' });
      return fin(D.est - B, 0);
    }
    // advanced
    if (D.none) { out.rows = []; return fin(0, 0); }
    if (!okP) { out.problem = 'Enter the share price first (the treasury stock method needs it)'; return out; }
    let g = 0, bb = 0, any = false;
    const tsm = (type, r, i) => {
      const has = isNum(r.n) || isNum(r.k); if (!has) return;
      if (!isNum(r.n) || !isNum(r.k) || r.n < 0 || r.k < 0) { out.invalid.push(`${type} ${i + 1}`); return; }
      any = true; const itm = P > r.k;
      const rg = itm ? r.n : 0, rb = itm ? r.n * r.k / P : 0;
      out.rows.push({ type, label: r.label || `${type} ${i + 1}`, n: r.n, k: r.k, itm, gross: rg, buyback: rb, net: rg - rb, note: itm ? 'Treasury stock method' : 'Out of the money: not dilutive' });
      g += rg; bb += rb;
    };
    (D.options || []).forEach((r, i) => tsm('Options', r, i));
    if (D.rsu && (isNum(D.rsu.n) || isNum(D.rsu.unrecog))) {
      if (!isNum(D.rsu.n) || D.rsu.n < 0 || (isNum(D.rsu.unrecog) && D.rsu.unrecog < 0)) out.invalid.push('RSUs');
      else {
        any = true; const rb = isNum(D.rsu.unrecog) ? Math.min(D.rsu.n, D.rsu.unrecog / P) : 0;
        out.rows.push({ type: 'RSUs', label: 'Unvested RSUs / PSUs', n: D.rsu.n, k: null, itm: true, gross: D.rsu.n, buyback: rb, net: D.rsu.n - rb, note: isNum(D.rsu.unrecog) ? 'Treasury stock method (unrecognised cost as proceeds)' : 'Counted in full (no unrecognised cost entered)' });
        g += D.rsu.n; bb += rb;
        if (!isNum(D.rsu.unrecog)) out.warnings.push('Unvested RSUs are counted in full because no unrecognised compensation cost was entered. This is conservative.');
      }
    }
    (D.warrants || []).forEach((r, i) => tsm('Warrants', r, i));
    (D.converts || []).forEach((r, i) => {
      const has = isNum(r.n) || isNum(r.k); if (!has) return;
      if (!isNum(r.n) || !isNum(r.k) || r.n < 0 || r.k <= 0) { out.invalid.push(`Convertible ${i + 1}`); return; }
      any = true; const itm = P > r.k;
      let rg = 0, rb = 0;
      if (itm) { rg = r.n; rb = r.net ? r.n * r.k / P : 0; }
      out.rows.push({ type: 'Convertible', label: r.label || `Convertible ${i + 1}`, n: r.n, k: r.k, itm, gross: rg, buyback: rb, net: rg - rb, note: !itm ? 'Out of the money: stays as debt' : r.net ? 'Net share settlement: shares for the excess over principal' : 'If-converted: all conversion shares' });
      if (itm && !r.net) out.warnings.push(`${r.label || 'Convertible ' + (i + 1)} is counted as converted. Remove its principal from Total debt in the equity bridge so it isn't counted twice.`);
      g += rg; bb += rb;
    });
    if (out.invalid.length) { out.problem = 'Complete or clear: ' + out.invalid.join(', '); return out; }
    if (!any) { out.problem = 'Enter at least one dilutive security, or tick "No dilutive securities outstanding"'; return out; }
    return fin(g, bb);
  }
  // Writes the calculated dilution into the workbook's two cells, so Excel export and the engine agree
  function syncDilution(model) {
    const d = dilution(model);
    if (!d.method || d.method === 'totals') return d;
    model.inputs.options = d.ok ? d.gross : null; model.inputs.treasury = d.ok ? d.buyback : null;
    return d;
  }
  // Dates, staleness, units and consistency for the market data
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
  const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  function marketChecks(model, today) {
    const I = model.inputs, A = model.asOf || {}, vd = I.company.valDate, ref = isDate(vd) ? vd : (today || new Date().toISOString().slice(0, 10));
    const w = [];
    const add = (level, key, text) => w.push({ level, key, text });
    if (!isNum(I.price)) add('bad', 'price', 'Share price is missing.');
    else if (!isDate(A.price)) add('warn', 'price', 'Add the date of the share price (As of).');
    else if (Math.abs(days(A.price, ref)) > 5) add('warn', 'price', `The share price is from ${A.price}, ${Math.round(Math.abs(days(A.price, ref)))} days ${days(A.price, ref) > 0 ? 'before' : 'after'} the ${isDate(vd) ? 'valuation date' : 'current date'} (${ref}). Use the close on the valuation date.`);
    if (isNum(I.hi52) && isNum(I.lo52) && I.hi52 < I.lo52) add('bad', 'hi52', 'The 52-week high is below the 52-week low.');
    else if (isNum(I.hi52) && isNum(I.lo52) && isNum(I.price) && (I.price > I.hi52 * 1.02 || I.price < I.lo52 * 0.98)) add('warn', 'price', 'The share price is outside the 52-week range. Check that both use the same date and are split-adjusted.');
    if ((isNum(I.hi52) || isNum(I.lo52)) && !isDate(A.range)) add('warn', 'hi52', 'Add the end date of the 52-week range (As of).');
    if (!isNum(I.basic)) add('bad', 'basic', 'Actual shares outstanding are missing.');
    else {
      if (I.basic > 60000) add('warn', 'basic', `Shares outstanding of ${Math.round(I.basic).toLocaleString('en-US')} million looks too high. Is it in shares instead of millions?`);
      if (I.basic < 1) add('warn', 'basic', 'Shares outstanding below 1 million. Is it in billions instead of millions?');
      if (!isDate(A.basic)) add('warn', 'basic', 'Add the cover-page date of the share count (As of).');
      else if (days(A.basic, ref) > 120) add('warn', 'basic', `The share count is from ${A.basic}, more than 4 months before ${ref}. Check for a newer 10-Q.`);
    }
    const r = model.ref && model.ref.marketCap, d = dilution(model);
    if (r && isNum(r.v) && isNum(I.price) && isNum(I.basic)) { const mc = I.price * I.basic, gap = mc / r.v - 1; if (Math.abs(gap) > 0.1) add('warn', 'basic', `Price × actual shares (${Math.round(mc).toLocaleString('en-US')} $mm) differs from the provider's market cap by ${(gap * 100).toFixed(0)}%. Check the share count and units.`); }
    d.warnings.forEach(t => add('warn', 'dilution', t));
    return w;
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
    const d = dilution(model);
    if (d.method && d.method !== 'totals') { out.options = d.ok ? d.gross : null; out.treasury = d.ok ? d.buyback : null; }
    return { inp: out, invalid, dilution: d };
  }
  // Completion status per group. Required = needed by the valuation in the current mode.
  function completion(model) {
    const { invalid } = engineInputs(model);
    const groups = {};
    const add = (g, item) => { (groups[g] = groups[g] || { items: [], done: 0, total: 0 }).items.push(item); groups[g].total++; if (item.ok) groups[g].done++; };
    const dil = dilution(model);
    F.forEach(f => {
      if (!f.required || !relevant(f, model)) return;
      if ((f.key === 'options' || f.key === 'treasury') && dil.method !== 'totals') return;
      const cols = f.tri ? SC : [null];
      cols.forEach(s => {
        if (f.key === 'exitMult' && model.inputs.tvMethod[s] !== 'Exit Multiple') return;
        const v = f.tri ? model.inputs[f.key][s] : model.inputs[f.key];
        const bad = invalid.find(x => x.key === f.key && (x.s || null) === s);
        const ok = v !== null && v !== undefined && v !== '' && !bad;
        add(f.group, { key: f.key, s, label: f.label + (s ? ` (${s})` : ''), ok, problem: bad ? bad.e : (ok ? null : 'Missing') });
      });
    });
    if (dil.method !== 'totals') add('market', { key: 'dilution', s: null, label: dil.method ? 'Share dilution' : 'Share dilution: choose a method', ok: dil.ok, problem: dil.ok ? null : (dil.problem && dil.problem !== 'Missing' && dil.method ? dil.problem : 'Missing') });
    // historicals: revenue required for the latest year in corrected mode; others recommended
    HF.forEach(h => model.hist[h.key].forEach((v, i) => {
      const need = h.key === 'rev' ? (i === 4 && model.mode === 'corrected') : false;
      if (!need) return;
      add('hist', { key: 'hist.' + h.key, i, label: `${h.label} (${model.hist.years[i] || 'latest year'})`, ok: isNum(v) && v > 0, problem: isNum(v) ? (v > 0 ? null : 'Must be greater than zero') : 'Missing' });
    }));
    return groups;
  }
  // ---- model completion tracker ----
  // Sections of the model with required, completed, missing, invalid, default-only and source status,
  // plus calculation readiness and outstanding warnings. checks: [{title, status: 'good'|'warn'|'bad'|'neutral', detail}]
  const SECTIONS = [
    { id: 'company', title: 'Company & market data', groups: ['company', 'market'], page: 'company' },
    { id: 'hist', title: 'Historical financials', groups: ['hist'], page: 'historicals' },
    { id: 'forecast', title: 'Forecast assumptions', groups: ['revenue', 'margins', 'reinvest'], page: 'assumptions' },
    { id: 'wacc', title: 'WACC & cost of capital', groups: ['wacc'], page: 'wacc' },
    { id: 'terminal', title: 'Terminal value', groups: ['terminal'], page: 'terminal' },
    { id: 'bridge', title: 'Equity bridge', groups: ['bridge'], page: 'bridge' },
    { id: 'scenarios', title: 'Scenarios & timing', groups: ['scenarios'], page: 'bridge' },
  ];
  const needsSource = f => f.kind === 'reported' || (f.kind === 'market' && !f.tri);
  function tracker(model, all, checks) {
    const comp = completion(model);
    const out = [];
    let pts = 0, done = 0;
    SECTIONS.forEach(sec => {
      const items = [].concat(...sec.groups.map(g => comp[g] ? comp[g].items : []));
      const missing = items.filter(i => !i.ok && i.problem === 'Missing');
      const invalid = items.filter(i => !i.ok && i.problem !== 'Missing');
      const defaults = items.filter(i => i.ok && model.defaults && model.defaults[i.key]).map(i => Object.assign({}, i, { problem: 'Default value: confirm it' }));
      // source status for reported figures and single market figures that are filled in
      const srcKeys = [];
      items.forEach(i => { const f = F.find(x => x.key === i.key); if (i.ok && ((f && needsSource(f)) || i.key === 'hist.rev') && !srcKeys.includes(i.key)) srcKeys.push(i.key); });
      if (sec.id === 'hist') HF.forEach(h => { if (model.hist[h.key].some(isNum) && !srcKeys.includes('hist.' + h.key)) srcKeys.push('hist.' + h.key); });
      const unsourced = srcKeys.filter(k => !model.sources[k]);
      const verified = srcKeys.filter(k => model.reviewed[k]);
      const flagged = srcKeys.filter(k => model.sources[k] && model.sources[k].review && !model.reviewed[k]);
      const required = items.length, completed = items.filter(i => i.ok).length - defaults.length;
      const ok = !missing.length && !invalid.length && !defaults.length && !unsourced.length;
      pts += required + srcKeys.length; done += completed + (srcKeys.length - unsourced.length);
      out.push({ id: sec.id, title: sec.title, page: sec.page, required, completed, missing, invalid, defaults, sourced: srcKeys.length - unsourced.length, needSource: srcKeys.length, unsourced, verified: verified.length, flagged, status: ok ? 'complete' : (completed > 0 ? 'progress' : 'empty') });
    });
    // calculation readiness
    const calcItems = SC.map(s => ({ label: s + ' case calculates', ok: !!(all && all.scen[s].ok), problem: all && !all.scen[s].ok ? (all.scen[s].errors && all.scen[s].errors.length ? all.scen[s].errors.join(' ') : 'Waiting for inputs') : null }));
    calcItems.push({ label: 'Probability-weighted value calculates', ok: !!(all && all.weighted !== null), problem: all && all.weighted === null ? all.weightedNote : null });
    const failing = (checks || []).filter(c => c.status === 'bad');
    const warns = (checks || []).filter(c => c.status === 'warn');
    const calcOk = calcItems.every(i => i.ok) && !failing.length;
    pts += calcItems.length + (checks || []).length; done += calcItems.filter(i => i.ok).length + (checks || []).filter(c => c.status !== 'bad').length;
    out.push({ id: 'calc', title: 'Calculation & validation checks', page: 'valuation', calcItems, failing, warns, status: calcOk ? 'complete' : (calcItems.some(i => i.ok) ? 'progress' : 'empty') });
    // review and save
    const fc = F.filter(f => f.kind === 'forecast' && f.required && relevant(f, model) && f.unit !== 'choice');
    const unreviewed = fc.filter(f => !model.reviewed[f.key]);
    const lastChange = model.log.length ? model.log[0].at : null;
    const saved = !!model.savedAt && (!lastChange || model.savedAt >= lastChange);
    pts += fc.length + 1; done += fc.length - unreviewed.length + (saved ? 1 : 0);
    out.push({ id: 'review', title: 'Model review & save', page: 'checklist', unreviewed: unreviewed.map(f => ({ key: f.key, label: f.label })), saved, savedAt: model.savedAt, status: !unreviewed.length && saved ? 'complete' : (fc.length - unreviewed.length || model.savedAt ? 'progress' : 'empty') });
    const complete = out.every(s => s.status === 'complete');
    let pct = pts ? Math.floor(done / pts * 100) : 0;
    if (!complete) pct = Math.min(pct, 99);
    const mkt = marketChecks(model).filter(w => w.level === 'warn' || isNum(model.inputs[w.key]));
    const warnings = [].concat(mkt.map(w => ({ level: w.level, key: w.key === 'dilution' ? null : w.key, text: w.text })), failing.map(c => ({ level: 'bad', text: c.title, detail: c.detail })), warns.map(c => ({ level: 'warn', text: c.title, detail: c.detail })),
      [].concat(...out.filter(s => s.flagged).map(s => s.flagged.map(k => ({ level: 'warn', key: k, text: 'Check imported figure: ' + labelOf(k), detail: model.sources[k].notes })))));
    return { sections: out, pct, complete, ready: calcItems.every(i => i.ok), warnings, points: pts, done };
  }
  function labelOf(k) { const f = F.find(x => x.key === k); if (f) return f.label; const h = HF.find(x => 'hist.' + x.key === k); return h ? h.label + ' (historicals)' : k; }

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
    ['sources', 'reviewed', 'imported', 'ref', 'meta'].forEach(k => out[k] = m[k] || {}); ['log', 'snapshots', 'importNotes'].forEach(k => out[k] = m[k] || []);
    out.defaults = m.defaults || {}; // older files: their choices were made by the analyst
    out.asOf = Object.assign({ price: null, range: null, basic: null }, m.asOf || {});
    // older files typed the workbook's two totals directly: keep that method
    out.dilution = m.dilution ? Object.assign(blankDilution(), m.dilution) : blankDilution(isNum(out.inputs.options) || isNum(out.inputs.treasury) ? 'totals' : null);
    return out;
  }
  return { SC, SECTIONS, blank, blankDilution, dilution, syncDilution, marketChecks, fromSample, fieldError, relevant, engineInputs, completion, tracker, labelOf, logChange, loadAll, save, remove, upgrade, isNum };
})();
if (typeof module !== 'undefined') module.exports = DCFModel;
