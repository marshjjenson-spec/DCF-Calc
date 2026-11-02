// ===== THREE-STATEMENT MODEL: schema, persistence, set-up from history, completion (no UI) =====
// Stored under its own browser key, so DCF and Trading Comps models are never read or changed by saving,
// opening or deleting a three-statement model. Versions are kept inside each model.
const FsmModel = (() => {
  const E = typeof FsmEngine !== 'undefined' ? FsmEngine : require('./fsm-engine.js');
  const isNum = E.isNum, N = E.N, SC = E.SC;
  const KEY = 'dcf3s.models.v1', CUR = 'dcf3s.current';
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const nulls = () => Array(N).fill(null);
  const fill = v => Array(N).fill(v);

  function blank(name = 'New three-statement model') {
    const asm = {}; SC.forEach(s => { asm[s] = {}; E.SC_KEYS.forEach(k => asm[s][k] = nulls()); });
    const shared = {}; E.SH_KEYS.forEach(k => shared[k] = nulls()); shared.divMode = 'payout';
    return {
      id: uid(), kind: 'fsm', version: 1, name, created: new Date().toISOString(), updated: new Date().toISOString(), savedAt: null,
      company: { name: null, ticker: null, cik: null, exchange: null, industry: null, fyEnd: null, currency: 'USD', price: null, priceDate: null, valDate: null },
      hist: { periods: [], ttm: null, cells: {}, refs: {}, notes: [], provider: null, retrieved: null, filings: null, reviewed: {} },
      settings: { base: 'fy', daPresentation: 'embedded', daAlloc: 'opex', depMethod: 'pctRev', interest: 'opening', buyback: 'treasury', nolDTA: 'allowance', segments: false, flReinvest: true, tol: 0.5, days: 365, layout: 'compact', freeze: true },
      asm, shared,
      segments: [],
      ppeSched: { life: null, remLife: null, halfYear: true },
      acqAlloc: { gw: 0.8, intang: 0.2 },
      debt: { tranches: [], revolver: { enabled: false, capacity: null, rate: null, open: 0, sweep: true, fee: null } },
      tax: { statutory: null, nolOpen: 0, nolUsable: 1, capPct: 0.8, annualLimit: null },
      equity: { sharesOpen: null, sharesSrc: null, price0: null, priceSrc: null },
      reviewed: {}, notes: {}, log: [], versions: [], dcfLinks: [], ui: { learn: true, scen: 'Base' },
    };
  }
  function upgrade(m) {
    const b = blank(m.name);
    const out = Object.assign(b, m);
    ['company', 'settings', 'ppeSched', 'acqAlloc', 'tax', 'equity', 'ui'].forEach(k => { out[k] = Object.assign(blank()[k], m[k] || {}); });
    out.hist = Object.assign(blank().hist, m.hist || {});
    out.debt = Object.assign(blank().debt, m.debt || {}); out.debt.revolver = Object.assign(blank().debt.revolver, (m.debt || {}).revolver || {});
    SC.forEach(s => { out.asm[s] = Object.assign({}, blank().asm[s], (m.asm || {})[s] || {}); });
    out.shared = Object.assign(blank().shared, m.shared || {});
    ['reviewed', 'notes'].forEach(k => out[k] = m[k] || {});
    ['log', 'versions', 'dcfLinks', 'segments'].forEach(k => out[k] = m[k] || []);
    return out;
  }
  function loadAll() { let all = {}; try { all = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } Object.keys(all).forEach(k => { all[k] = upgrade(all[k]); }); return all; }
  function saveAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  function save(m) { const all = loadAll(); m.updated = new Date().toISOString(); all[m.id] = m; return saveAll(all); }
  function get(id) { return loadAll()[id] || null; }
  function remove(id) { const all = loadAll(); delete all[id]; saveAll(all); }
  function duplicate(m, name) { const c = upgrade(JSON.parse(JSON.stringify(m))); c.id = uid(); c.name = name || (m.name + ' (copy)'); c.created = new Date().toISOString(); c.savedAt = null; c.versions = []; c.log = [{ at: new Date().toISOString(), field: 'duplicated from', to: m.name }]; c.dcfLinks = []; return c; }
  function getCurrent() { try { return localStorage.getItem(CUR); } catch (e) { return null; } }
  function setCurrent(id) { try { localStorage.setItem(CUR, id); } catch (e) {} }
  function log(m, field, from, to) { m.log.unshift({ at: new Date().toISOString(), field, from: from === undefined ? null : from, to: to === undefined ? null : to }); if (m.log.length > 500) m.log.length = 500; }
  // versions: a full copy of the model's inputs (not its version list) with a label
  function saveVersion(m, label) {
    const snap = JSON.parse(JSON.stringify(Object.assign({}, m, { versions: [], log: [] })));
    const n = (m.versions[0] ? m.versions[0].n : 0) + 1;
    m.versions.unshift({ n, at: new Date().toISOString(), label: label || 'Version ' + n, snap });
    if (m.versions.length > 20) m.versions.length = 20;
    return n;
  }
  function restoreVersion(m, n) {
    const v = m.versions.find(x => x.n === n); if (!v) return null;
    const r = upgrade(JSON.parse(JSON.stringify(v.snap)));
    r.id = m.id; r.versions = m.versions; r.log = m.log; r.name = m.name;
    log(r, 'restored version', null, v.label);
    return r;
  }
  const versionNo = m => m.versions[0] ? m.versions[0].n : 0;

  // ---------- set-up from the imported history (data, not assumptions) ----------
  // Opening balances, debt tranches and the share count come from the latest balance sheet.
  function initFromHistory(m) {
    const op = E.opening(m);
    const out = { notes: [] };
    if (!op.b) return out;
    const R = m.hist.refs || {};
    const cell = (k, pid) => m.hist.cells[k] && m.hist.cells[k][pid];
    const x = op.x;
    // debt tranches (replaced only when none exist yet)
    if (!m.debt.tranches.length) {
      const fyEnd = m.hist.periods.length ? m.hist.periods[m.hist.periods.length - 1].end : null;
      const ladderOk = R.matY1 && R.matY1.src && R.matY1.src.end === fyEnd && op.b.kind === 'FY';
      const ladder = ladderOk ? ['matY1', 'matY2', 'matY3', 'matY4', 'matY5'].map(k => R[k] ? R[k].v : null) : null;
      if (x.std) m.debt.tranches.push({ id: uid(), name: 'Short-term borrowings / commercial paper', kind: 'cp', open: x.std, rate: nulls(), repay: fill(0), borrow: fill(0), prepay: fill(0), other: fill(0), note: 'Rolled over each year unless you enter repayments or new borrowings.' });
      const lt = x.cltd + x.ltd;
      if (lt) m.debt.tranches.push({ id: uid(), name: 'Long-term debt (notes and term loans)', kind: 'term', open: lt, rate: nulls(), repay: ladder ? ladder.concat(nulls().slice(5)) : nulls(), borrow: nulls(), prepay: fill(0), other: fill(0),
        note: ladder ? `Scheduled repayments for years 1–5 are the principal maturities in the ${fyEnd} debt note (us-gaap:LongTermDebtMaturitiesRepaymentsOfPrincipal…). The filing gives only a total after year five (${R.matAfter ? R.matAfter.v.toFixed(0) : 'n/a'}): enter years 6–10 from the debt note.` : 'Enter scheduled repayments from the maturity table in the debt note of the latest 10-K.' });
      out.notes.push(`${m.debt.tranches.length} debt tranche(s) set up from the opening balance sheet (${op.b.label}).`);
    }
    if (R.revCap && !isNum(m.debt.revolver.capacity)) { m.debt.revolver.capacity = R.revCap.v; out.notes.push(`Revolving credit capacity ${R.revCap.v.toFixed(0)} from the debt note (${R.revCap.src.end}). The revolver stays off until you turn it on.`); }
    // share count at the opening balance sheet date (not a weighted average)
    const sh = cell('sharesBS', op.b.bsPid);
    if (sh && isNum(sh.v)) { m.equity.sharesOpen = sh.v; m.equity.sharesSrc = Object.assign({}, sh.src, { note: 'Common shares outstanding on the balance sheet date (not a weighted-average EPS denominator).' }); }
    else if (R.sharesCover && !m.equity.sharesOpen) { m.equity.sharesOpen = R.sharesCover.v; m.equity.sharesSrc = Object.assign({}, R.sharesCover.src, { note: `Cover-page count as of ${R.sharesCover.src.end}, after the opening balance sheet date (${op.b.end}). Replace it with the balance-sheet-date count if the filing gives one.` }); out.notes.push('Opening share count taken from the filing cover page (a later date than the balance sheet).'); }
    if (isNum(m.company.price) && !isNum(m.equity.price0)) { m.equity.price0 = m.company.price; m.equity.priceSrc = { provider: m.company.priceSrc || 'Company data', date: m.company.priceDate }; }
    if (R.statutory && !isNum(m.tax.statutory)) m.tax.statutory = R.statutory.v;
    return out;
  }

  // ---------- historical reference values for each assumption ----------
  function references(m) {
    const P = m.hist.periods;
    const rs = P.map((p, i) => E.histRatios(m.hist, p.id, i ? P[i - 1].id : null, m.settings));
    const pickVals = k => rs.map(r => r[k]);
    const avgN = (a, n) => { const v = a.slice(-n).filter(isNum); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
    const out = {};
    ['g', 'gm', 'rnd', 'sga', 'oth', 'sbc', 'tax', 'dso', 'dio', 'dpo', 'accr', 'defrev', 'oca', 'ocl', 'capex', 'dep', 'depPPE', 'opl', 'nwcPct', 'incNwc', 'payout', 'intRate', 'yield'].forEach(k => {
      const v = pickVals(k);
      const valid = v.filter(isNum);
      out[k] = { years: P.map((p, i) => ({ id: p.id, v: v[i] })), last: v[v.length - 1], avg3: avgN(v, 3), avg5: avgN(v, 5), hi: valid.length ? Math.max(...valid) : null, lo: valid.length ? Math.min(...valid) : null };
    });
    // TTM reference where a TTM column exists
    if (m.hist.ttm) { const t = E.histRatios(m.hist, 'TTM', P.length ? P[P.length - 1].id : null, m.settings); Object.keys(out).forEach(k => { out[k].ttm = k === 'g' ? null : t[k]; }); }
    return out;
  }
  // "Start from history": fills every empty assumption with a historical reference. Each group is marked
  // as not reviewed, so the model is not complete until the analyst confirms or changes it.
  function fillFromHistory(m, how = 'avg3') {
    const R = references(m);
    const op = E.opening(m);
    const cell = (k, pid) => m.hist.cells[k] && m.hist.cells[k][pid] && isNum(m.hist.cells[k][pid].v) ? m.hist.cells[k][pid].v : null;
    const last = m.hist.periods.length ? m.hist.periods[m.hist.periods.length - 1].id : null;
    const pick = k => { const r = R[k]; if (!r) return null; return isNum(r[how]) ? r[how] : isNum(r.last) ? r.last : null; };
    const filled = [];
    const setArr = (obj, k, v) => { if (!isNum(v)) return; if (obj[k].every(x => x === null)) { obj[k] = fill(v); filled.push(k); m.reviewed[k] = false; } };
    const map = { gm: 'gm', rnd: 'rnd', sga: 'sga', oth: 'oth', sbc: 'sbc', tax: 'tax', dso: 'dso', dio: 'dio', dpo: 'dpo', accr: 'accr', defrev: 'defrev', oca: 'oca', ocl: 'ocl' };
    SC.forEach(s => {
      const A = m.asm[s];
      const g = pick('g');
      if (isNum(g)) setArr(A, 'g', g);
      Object.entries(map).forEach(([k, r]) => { let v = pick(r); if (!isNum(v) && ['rnd', 'oth', 'dio', 'defrev', 'oca', 'ocl', 'accr', 'sbc'].includes(k) && R[r] && R[r].years.every(y => !isNum(y.v))) v = 0; setArr(A, k, v); });
      const cx = pick('capex'); if (isNum(cx)) { setArr(A, 'maint', cx * 0.5); setArr(A, 'gcapex', cx * 0.5); }
      setArr(A, 'dep', m.settings.depMethod === 'pctPPE' ? pick('depPPE') : pick('dep'));
      setArr(A, 'acq', 0);
    });
    const S = m.shared;
    const x = op.x || {};
    setArr(S, 'sti', x.sti);
    setArr(S, 'yield', pick('yield'));
    setArr(S, 'minCash', isNum(x.cash) ? Math.round(x.cash * 0.5) : null);
    ['nonop', 'eqinc', 'oltaChg', 'oltlChg', 'aociChg', 'issue', 'nciDist', 'prefDiv', 'otherFin', 'disposals', 'impair', 'flAdd'].forEach(k => setArr(S, k, 0));
    setArr(S, 'opl', pick('opl'));
    const flPrin = cell('leasePrin', last), fl0 = (() => { const P = m.hist.periods; return P.length > 1 ? cell('finl', P[P.length - 2].id) : null; })();
    setArr(S, 'flRepay', isNum(flPrin) && fl0 ? Math.min(1, flPrin / fl0) : (isNum(x.finl) && x.finl === 0 ? 0 : null));
    setArr(S, 'flRate', pick('intRate'));
    const intang0 = x.intang;
    setArr(S, 'amort', intang0 ? 0.1 : 0);
    const defs = m.hist.periods.map(p => { const d = cell('defTax', p.id), t = cell('tax', p.id); return isNum(d) && isNum(t) && t > 0 ? d / t : null; }).filter(isNum);
    setArr(S, 'defPct', defs.length ? Math.max(0, Math.min(0.5, defs.slice(-3).reduce((a, b) => a + b, 0) / defs.slice(-3).length)) : 0);
    const div = cell('div', last), bb = cell('buyback', last);
    if (S.div.every(v => v === null)) { const po = pick('payout'); if (isNum(po)) { S.divMode = 'payout'; setArr(S, 'div', po); } else if (!div) { S.divMode = 'none'; setArr(S, 'div', 0); } }
    setArr(S, 'buyback', isNum(bb) ? bb : 0);
    const nd = m.hist.refs && m.hist.refs.netDilFY; setArr(S, 'dilutive', nd ? nd.v : 0);
    setArr(S, 'awards', 0);
    setArr(S, 'pxg', 0);
    const nciPct = (() => { const a = cell('niNci', last), n = cell('ni', last); return isNum(a) && isNum(n) && n ? a / n : 0; })();
    setArr(S, 'nciPct', nciPct);
    m.debt.tranches.forEach(t => { const r = pick('intRate'); if (t.rate.every(v => v === null) && isNum(r)) { t.rate = fill(r); filled.push('rate:' + t.name); m.reviewed.debt = false; } if (t.borrow.every(v => v === null)) t.borrow = fill(0); });
    if (m.settings.depMethod === 'vintage' && !m.ppeSched.life) { m.ppeSched.life = 10; m.ppeSched.remLife = 8; m.reviewed.depreciation = false; }
    return filled;
  }

  // ---------- completion ----------
  function completion(m) {
    const sec = [];
    const item = (ok, text, page, detail) => ({ ok: !!ok, text, page, detail: detail || '' });
    const h = m.hist;
    const op = E.opening(m);
    sec.push({ id: 'company', title: 'Company and data', items: [
      item(m.company.name || m.company.ticker, 'Company selected', 'company'),
      item(h.periods.length >= 5, `Five completed fiscal years imported (${h.periods.length})`, 'historical'),
      item(h.periods.length && op.ok, op.ok ? `Opening balance sheet ready (${op.b && op.b.label})` : 'Opening balance sheet incomplete: ' + (op.missing || []).join(', '), 'historical'),
      item(op.ok && Math.abs(op.x.check) <= (m.settings.tol || 0.5), op.ok ? `Opening balance sheet balances (difference ${op.x.check.toFixed(2)})` : 'Opening balance sheet balances', 'reconciliation'),
      item(h.reviewed && h.reviewed.all, 'Historical statements reviewed against the filings', 'historical'),
      item(isNum(m.equity.sharesOpen) && isNum(m.equity.price0), 'Opening share count and share price entered', 'equity'),
    ] });
    const runs = SC.map(s => E.run(m, s));
    const asmItems = SC.map((s, i) => item(runs[i].ok, runs[i].ok ? `${s} scenario: all assumptions entered` : `${s} scenario: ${runs[i].missing.length} missing (${runs[i].missing.slice(0, 4).join(', ')}${runs[i].missing.length > 4 ? '…' : ''})`, 'assumptions'));
    const unrev = Object.entries(m.reviewed).filter(([, v]) => v === false).map(([k]) => k);
    asmItems.push(item(!unrev.length, unrev.length ? `${unrev.length} assumption(s) filled from history still to review` : 'Every assumption reviewed', 'assumptions'));
    sec.push({ id: 'assumptions', title: 'Forecast assumptions', items: asmItems });
    const chk = runs.map((r, i) => r.ok ? r.checks : null);
    const fails = chk.map((c, i) => c ? c.filter(x => x.status === 'fail') : null);
    sec.push({ id: 'checks', title: 'Reconciliation', items: SC.map((s, i) => item(runs[i].ok && !fails[i].length, runs[i].ok ? (fails[i].length ? `${s}: ${fails[i].length} failing check(s): ${fails[i].map(f => f.label).join('; ')}` : `${s}: every check passes`) : `${s}: cannot run yet`, 'reconciliation')) });
    sec.push({ id: 'docs', title: 'Documentation and save', items: [
      item(Object.values(m.notes || {}).some(v => v && v.trim()), 'Research notes written', 'sources'),
      item(m.savedAt && m.savedAt >= (m.log[0] ? m.log[0].at : ''), 'Saved since the last change', 'saved'),
    ] });
    sec.forEach(s => { s.done = s.items.filter(i => i.ok).length; s.total = s.items.length; s.status = s.done === s.total ? 'complete' : s.done ? 'progress' : 'empty'; });
    const done = sec.reduce((a, s) => a + s.done, 0), total = sec.reduce((a, s) => a + s.total, 0);
    return { sections: sec, done, total, pct: done === total ? 100 : Math.min(99, Math.floor(done / total * 100)), complete: done === total, runs };
  }

  return { KEY, blank, upgrade, loadAll, save, get, remove, duplicate, getCurrent, setCurrent, log, saveVersion, restoreVersion, versionNo, initFromHistory, references, fillFromHistory, completion, uid, fill, nulls };
})();
if (typeof module !== 'undefined') module.exports = FsmModel;
