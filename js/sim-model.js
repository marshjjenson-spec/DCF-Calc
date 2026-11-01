// ===== STOCK PRICE SIMULATOR MODEL: schema, persistence, imports, proposals, completion (no UI) =====
// Simulations are stored under their own browser storage key, so DCF, Trading Comps and Three-Statement models are
// never changed by saving, opening or deleting a simulation. The company record reuses the Trading Comps format
// (every reported figure carries its source; manual entries are never overwritten by an import). Assumptions are
// analyst projections: they record where each came from (analyst, history, DCF, three-statement model), and an
// import only replaces an assumption the analyst typed after the analyst approves it.
const SimModel = (() => {
  const E = typeof SimEngine !== 'undefined' ? SimEngine : require('./sim-engine.js');
  const D = typeof CompsData !== 'undefined' ? CompsData : require('./comps-data.js');
  const Sec = typeof DCFSec !== 'undefined' ? DCFSec : require('./sec.js');
  const isNum = E.isNum;
  const KEY = 'dcfsim.models.v1', CUR = 'dcfsim.current';
  const uid = D.uid;
  const now = () => new Date().toISOString();

  function blank(name = 'New simulation') {
    const scen = {}; E.SCEN.forEach(s => { scen[s] = E.blankScenario(); });
    return { id: uid(), kind: 'sim', version: 1, name, created: now(), updated: now(), savedAt: null,
      company: D.emptyCompany('target'), hist: [],
      settings: { method: 'pe', years: 5, base: 'ttm', shareBasis: 'diluted', waBasis: 'avg', leases: 'exclude', fromPriceDate: true, divMode: 'none', split: { factor: 1, appliesTo: 'eps' }, weights: { Bear: 0.25, Base: 0.5, Bull: 0.25 }, reqReturn: null, active: 'Base', perYear: false },
      scen, sens: {}, reverse: { target: null, year: null, scen: 'Base' }, pending: null, notes: {}, rationale: { Bear: '', Base: '', Bull: '' }, conclusion: '',
      dcfLink: null, compsLink: null, log: [], ui: { learn: true } };
  }
  function upgrade(m) {
    const b = blank(m.name);
    const out = Object.assign(b, m);
    out.settings = Object.assign(blank().settings, m.settings || {});
    out.settings.split = Object.assign({ factor: 1, appliesTo: 'eps' }, (m.settings || {}).split || {});
    out.settings.weights = Object.assign({ Bear: 0.25, Base: 0.5, Bull: 0.25 }, (m.settings || {}).weights || {});
    out.company = Object.assign(D.emptyCompany('target'), m.company || {});
    out.scen = {}; E.SCEN.forEach(s => { const A = Object.assign(E.blankScenario(), (m.scen || {})[s] || {}); A.py = Object.assign(E.blankScenario().py, A.py || {}); A.src = A.src || {}; out.scen[s] = A; });
    out.hist = m.hist || []; out.notes = m.notes || {}; out.log = m.log || []; out.ui = Object.assign({ learn: true }, m.ui || {});
    out.rationale = Object.assign({ Bear: '', Base: '', Bull: '' }, m.rationale || {});
    out.reverse = Object.assign({ target: null, year: null, scen: 'Base' }, m.reverse || {});
    out.sens = m.sens || {};
    return out;
  }
  function loadAll() { let all = {}; try { all = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } Object.keys(all).forEach(k => { all[k] = upgrade(all[k]); }); return all; }
  function saveAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  function save(m) { const all = loadAll(); m.updated = now(); all[m.id] = m; return saveAll(all); }
  function remove(id) { const all = loadAll(); delete all[id]; saveAll(all); }
  function duplicate(m, name) { const c = upgrade(JSON.parse(JSON.stringify(m))); c.id = uid(); c.name = name || (m.name + ' (copy)'); c.created = now(); c.savedAt = null; c.log = [{ at: now(), field: 'duplicated from', to: m.name }].concat(c.log || []).slice(0, 500); return c; }
  function getCurrent() { try { return localStorage.getItem(CUR); } catch (e) { return null; } }
  function setCurrent(id) { try { localStorage.setItem(CUR, id); } catch (e) {} }
  function log(m, field, from, to) { m.log.unshift({ at: now(), field, from: from === undefined ? null : from, to: to === undefined ? null : to }); if (m.log.length > 500) m.log.length = 500; }

  // ---------- assumptions with provenance ----------
  const SRC = { analyst: 'Analyst', history: 'From history', dcf: 'From DCF', fsm: 'From three-statement model', current: 'Today\'s multiple' };
  function setAssumption(m, s, key, v, t) {
    const A = m.scen[s];
    if (t) { const arr = (A.py[key] || new Array(E.MAXY).fill(null)).slice(); while (arr.length < E.MAXY) arr.push(null); arr[t - 1] = v; A.py[key] = arr.some(isNum) ? arr : null; }
    else A[key] = v;
    A.src[key] = { cat: 'analyst', at: now() };
  }
  const isManual = (A, key) => !!(A.src && A.src[key] && A.src[key].cat === 'analyst');

  // a proposal sets constants and/or per-year paths for scenarios: { source, cat, note, scen: { Base: { key: { c: value, py: [..] } } } }
  // Nothing is applied here: proposal items are compared with the current values and listed for review.
  function propose(m, prop) {
    const items = [];
    E.SCEN.forEach(s => {
      const P = (prop.scen || {})[s]; if (!P) return;
      const A = m.scen[s];
      Object.entries(P).forEach(([key, p]) => {
        const fromC = A[key], fromPy = A.py[key];
        const toC = isNum(p.c) ? p.c : null;
        const toPy = p.py ? Array.from({ length: E.MAXY }, (_, i) => isNum(p.py[i]) ? p.py[i] : null) : null;
        const clearPy = !toPy && isNum(toC);
        const sameC = toC === null || fromC === toC;
        const samePy = toPy ? JSON.stringify(fromPy || null) === JSON.stringify(toPy) : !(clearPy && E.hasPerYear(A, key));
        if (sameC && samePy) return;
        if (toC === null && !toPy) return;
        const empty = !isNum(fromC) && !E.hasPerYear(A, key);
        items.push({ id: uid(), scen: s, key, fromC, fromPy, toC, toPy, clearPy, manual: isManual(A, key), empty, note: p.note || '' });
      });
    });
    m.pending = items.length ? { id: uid(), at: now(), source: prop.source, cat: prop.cat, note: prop.note || '', items } : null;
    return items.length;
  }
  // apply proposal items; analyst-entered values are only replaced when allowManual is true (the analyst ticked them)
  function applyPending(m, ids, allowManual) {
    const P = m.pending; if (!P) return 0;
    let n = 0;
    P.items = P.items.filter(it => {
      if (!ids.includes(it.id)) return true;
      if (it.manual && !allowManual) return true;
      const A = m.scen[it.scen];
      A.prev = A.prev || {}; A.prev[it.key] = { c: A[it.key], py: A.py[it.key], src: A.src[it.key], at: now() };
      if (isNum(it.toC)) A[it.key] = it.toC;
      if (it.toPy) A.py[it.key] = it.toPy; else if (it.clearPy) A.py[it.key] = null;
      A.src[it.key] = { cat: P.cat, source: P.source, at: now(), note: it.note || P.note || '' };
      n++; return false;
    });
    if (!P.items.length) m.pending = null;
    return n;
  }
  function dismissPending(m, ids) { if (!m.pending) return; m.pending.items = m.pending.items.filter(i => !ids.includes(i.id)); if (!m.pending.items.length) m.pending = null; }
  function undoAssumption(m, s, key) { const A = m.scen[s]; const p = A.prev && A.prev[key]; if (!p) return false; A[key] = p.c; A.py[key] = p.py; A.src[key] = p.src; delete A.prev[key]; return true; }

  // ---------- historical figures (reported, never projections) ----------
  function histFromSEC(json, subs) {
    let F; try { F = Sec.financials(json, { L: Sec.latest(json, subs) }); } catch (e) { return []; }
    const fyEntries = (concept, unit) => { try { return Sec.entries(json, concept, unit).filter(x => x.pt === 'FY'); } catch (e) { return []; } };
    const epsE = fyEntries('EarningsPerShareDiluted', 'USD/shares'), waE = fyEntries('WeightedAverageNumberOfDilutedSharesOutstanding', 'shares');
    const dpsE = fyEntries('CommonStockDividendsPerShareDeclared', 'USD/shares');
    const byEnd = (arr, end) => { const r = arr.filter(x => x.end === end).sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0]; return r ? r.val : null; };
    return F.years.map(y => ({ end: y.end, label: y.label, form: y.form, accn: y.accn, filed: y.filed, rev: y.values.rev ?? null, ni: y.values.ni ?? null, ebit: y.values.ebit ?? null, ebitda: y.values.ebitda ?? null,
      fcf: y.values.fcf ?? null, eps: byEnd(epsE, y.end), waDil: isNum(byEnd(waE, y.end)) ? byEnd(waE, y.end) / 1e6 : null, dps: byEnd(dpsE, y.end), source: 'SEC EDGAR XBRL company facts' }));
  }
  // import from the SEC files: the company record (reported figures, with sources) plus five fiscal years of history
  function importSEC(m, json, subs) {
    const imp = D.fromSEC(json, subs);
    const res = D.applyImport(m.company, imp);
    const h = histFromSEC(json, subs); if (h.length) m.hist = h;
    return { res, imp, hist: h.length };
  }
  function importFMP(m, imp) { const res = D.applyImport(m.company, imp); if (imp.priceDate && !m.company.priceDate) m.company.priceDate = imp.priceDate; return { res, imp }; }

  // ---------- historical anchors ----------
  const cagr = (a, b, n) => isNum(a) && isNum(b) && a > 0 && b > 0 && n > 0 ? Math.pow(b / a, 1 / n) - 1 : null;
  function anchors(m) {
    const c = m.company, v = k => (c.v[k] && isNum(c.v[k].v)) ? c.v[k].v : null;
    const H = (m.hist || []).slice().sort((a, b) => b.end.localeCompare(a.end));
    const st = E.start(m);
    const o = {};
    o.revGrowth = { ttm: isNum(v('rev_ttm')) && isNum(v('rev_ttm_prior')) && v('rev_ttm_prior') > 0 ? v('rev_ttm') / v('rev_ttm_prior') - 1 : null,
      fy: isNum(v('rev_fy')) && isNum(v('rev_fy_prior')) && v('rev_fy_prior') > 0 ? v('rev_fy') / v('rev_fy_prior') - 1 : null,
      y3: H.length >= 4 ? cagr(H[3].rev, H[0].rev, 3) : null, y5: H.length >= 5 ? cagr(H[4].rev, H[0].rev, 4) : null };
    const mgn = (k) => ({ ttm: isNum(v(k + '_ttm')) && v('rev_ttm') > 0 ? v(k + '_ttm') / v('rev_ttm') : null, fy: isNum(v(k + '_fy')) && v('rev_fy') > 0 ? v(k + '_fy') / v('rev_fy') : null,
      avg: (() => { const xs = H.slice(0, 5).filter(y => isNum(y[k]) && y.rev > 0).map(y => y[k] / y.rev); return xs.length >= 3 ? xs.reduce((a, b) => a + b, 0) / xs.length : null; })(),
      lo: (() => { const xs = H.slice(0, 5).filter(y => isNum(y[k]) && y.rev > 0).map(y => y[k] / y.rev); return xs.length ? Math.min(...xs) : null; })(),
      hi: (() => { const xs = H.slice(0, 5).filter(y => isNum(y[k]) && y.rev > 0).map(y => y[k] / y.rev); return xs.length ? Math.max(...xs) : null; })() });
    o.netMargin = mgn('ni'); o.ebitdaMargin = mgn('ebitda'); o.ebitMargin = mgn('ebit'); o.fcfMargin = mgn('fcf');
    const epsH = H.filter(y => isNum(y.eps));
    o.epsGrowth = { fy: epsH.length >= 2 && epsH[1].eps > 0 && epsH[0].eps > 0 ? epsH[0].eps / epsH[1].eps - 1 : null, y3: epsH.length >= 4 ? cagr(epsH[3].eps, epsH[0].eps, 3) : null, y5: epsH.length >= 5 ? cagr(epsH[4].eps, epsH[0].eps, 4) : null };
    const waH = H.filter(y => isNum(y.waDil));
    o.dilution = { fy: waH.length >= 2 ? waH[0].waDil / waH[1].waDil - 1 : null, y3: waH.length >= 4 ? cagr(waH[3].waDil, waH[0].waDil, 3) : null };
    o.cur = E.current(st);
    return o;
  }
  // a starting point from history and today's multiples: Base = history, Bear and Bull shifted. Proposed, not applied.
  function historyProposal(m) {
    const a = anchors(m), first = (...xs) => xs.find(isNum);
    const g = first(a.revGrowth.y3, a.revGrowth.ttm, a.revGrowth.fy);
    const nm = first(a.netMargin.ttm, a.netMargin.fy), em = first(a.ebitdaMargin.ttm, a.ebitdaMargin.fy), om = first(a.ebitMargin.ttm, a.ebitMargin.fy), fm = first(a.fcfMargin.ttm, a.fcfMargin.fy);
    const eg = first(a.epsGrowth.y3, a.epsGrowth.fy), dl = first(a.dilution.y3, a.dilution.fy);
    const C = a.cur;
    const r1 = v => isNum(v) ? Math.round(v * 1000) / 1000 : v, rx = v => isNum(v) ? Math.round(v * 10) / 10 : v;
    const base = { revGrowth: r1(g), netMargin: r1(nm), ebitdaMargin: r1(em), ebitMargin: r1(om), fcfMargin: r1(fm), epsGrowth: r1(eg), dilution: isNum(dl) ? Math.round(dl * 10000) / 10000 : dl, pe: rx(C.pe || C.peCalc), evEbitda: rx(C.evEbitda), evEbit: rx(C.evEbit), evRev: isNum(C.evRev) ? Math.round(C.evRev * 100) / 100 : null, ps: isNum(C.ps) ? Math.round(C.ps * 100) / 100 : null, pfcf: rx(C.pfcf) };
    const shift = { revGrowth: 0.03, netMargin: 0.02, ebitdaMargin: 0.03, ebitMargin: 0.02, fcfMargin: 0.02, epsGrowth: 0.04, dilution: -0.005 };
    const multK = { Bear: 0.8, Base: 1, Bull: 1.2 };
    const scen = {};
    E.SCEN.forEach(s => {
      const sign = s === 'Bear' ? -1 : s === 'Bull' ? 1 : 0; const P = {};
      Object.entries(base).forEach(([k, v]) => {
        if (!isNum(v)) return;
        if (E.MULT_KEYS.includes(k)) { if (v > 0) P[k] = { c: Math.round(v * multK[s] * 100) / 100, note: `Today's ${E.AK[k].label.replace('Future ', '')}${s === 'Base' ? '' : (s === 'Bear' ? ' × 0.8' : ' × 1.2')}` }; return; }
        P[k] = { c: Math.round((v + sign * (shift[k] || 0)) * 10000) / 10000, note: s === 'Base' ? 'Historical figure' : `Historical figure ${sign > 0 ? '+' : '−'} ${(Math.abs(shift[k] || 0) * 100).toFixed(1)} points` };
      });
      scen[s] = P;
    });
    return { source: 'Historical figures and today\'s multiples', cat: 'history', note: 'A starting point only: review each value and write why it is reasonable for the future.', scen };
  }

  // ---------- from a DCF model (its forecast years; the DCF model is not changed) ----------
  function dcfProposal(dcfModel, DCFModelApi, DCFApi) {
    const mm = DCFModelApi.upgrade(JSON.parse(JSON.stringify(dcfModel)));
    const ei = DCFModelApi.engineInputs(mm); const all = DCFApi.runAll(ei.inp, mm.mode);
    const scen = {}; const notes = [];
    E.SCEN.forEach(s => {
      const r = all.scen[s]; if (!r || !r.ok) { notes.push(`${s}: the DCF scenario does not calculate (missing inputs), so nothing is proposed for it.`); return; }
      const ys = r.years.slice(0, 10);
      scen[s] = { revGrowth: { py: ys.map(y => y.growth), c: ys[0].growth, note: 'DCF revenue growth by year' }, ebitdaMargin: { py: ys.map(y => y.emPct), c: ys[0].emPct, note: 'DCF EBITDA margin by year' }, ebitMargin: { py: ys.map(y => y.ebitPct), c: ys[0].ebitPct, note: 'DCF operating margin by year' } };
    });
    notes.push('The DCF has no interest expense or share count forecast, so net margin, EPS and dilution are not imported. Its NOPAT margin is an upper bound for a net margin when the company has debt.');
    return { source: 'DCF model "' + (dcfModel.name || '') + '"', cat: 'dcf', note: notes.join(' '), scen, dcfRev0: ei.inp.rev0 };
  }
  // ---------- from a three-statement model (FsmEngine.run, when that model is present) ----------
  function fsmProposal(fsmModel, FsmModelApi, FsmEngineApi, st) {
    const m3 = FsmModelApi.upgrade ? FsmModelApi.upgrade(JSON.parse(JSON.stringify(fsmModel))) : fsmModel;
    const scen = {}; const notes = [];
    E.SCEN.forEach(s => {
      let r; try { r = FsmEngineApi.run(m3, s); } catch (e) { notes.push(`${s}: ${e.message}`); return; }
      if (!r || !r.ok) { notes.push(`${s}: the three-statement scenario is incomplete${r && r.missing ? ' (' + r.missing.slice(0, 4).join(', ') + ')' : ''}.`); return; }
      const ys = r.years.slice(0, 10);
      const rv = i => ys[i].rev, prevRev = i => i === 0 ? st.rev : rv(i - 1);
      const div = (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b : null;
      const ni = y => isNum(y.niCommon) ? y.niCommon : y.ni;
      const cashOf = y => (y.cash || 0) + (y.sti || 0), debtOf = y => (y.debt || 0) + (y.finl || 0);
      scen[s] = {
        revGrowth: { py: ys.map((y, i) => isNum(prevRev(i)) && prevRev(i) > 0 ? rv(i) / prevRev(i) - 1 : null), note: 'Three-statement revenue growth by year' },
        netMargin: { py: ys.map(y => div(ni(y), y.rev)), note: 'Three-statement net income to common ÷ revenue' },
        ebitdaMargin: { py: ys.map(y => div(y.ebitda, y.rev)), note: 'Three-statement EBITDA margin' },
        ebitMargin: { py: ys.map(y => div(y.ebit, y.rev)), note: 'Three-statement operating margin' },
        epsGrowth: { py: ys.map((y, i) => i === 0 ? (isNum(st.eps) && st.eps > 0 && isNum(y.epsDil) ? y.epsDil / st.eps - 1 : null) : (ys[i - 1].epsDil > 0 && isNum(y.epsDil) ? y.epsDil / ys[i - 1].epsDil - 1 : null)), note: 'Three-statement diluted EPS growth' },
        dilution: { py: ys.map((y, i) => { const prev = i === 0 ? st.shares : ys[i - 1].waDil; return isNum(prev) && prev > 0 && isNum(y.waDil) ? y.waDil / prev - 1 : null; }), note: 'Change in three-statement diluted weighted-average shares' },
        payout: { py: ys.map(y => isNum(y.div) && ni(y) > 0 ? y.div / ni(y) : null), note: 'Three-statement dividends ÷ net income' },
        cashChange: { py: ys.map((y, i) => i === 0 ? (isNum(st.cash) ? cashOf(y) - st.cash : null) : cashOf(y) - cashOf(ys[i - 1])), note: 'Change in three-statement cash and short-term investments' },
        debtChange: { py: ys.map((y, i) => i === 0 ? (isNum(st.debt) ? debtOf(y) - st.debt : null) : debtOf(y) - debtOf(ys[i - 1])), note: 'Change in three-statement debt and finance leases' },
      };
    });
    notes.push('Year 1 changes are measured from this simulation\'s starting figures: check that both models use the same base period (FY or TTM).');
    return { source: 'Three-statement model "' + (fsmModel.name || '') + '"', cat: 'fsm', note: notes.join(' '), scen };
  }

  // ---------- completion ----------
  function completion(m, all) {
    all = all || E.runAll(m);
    const st = all.st, S = m.settings, c = m.company;
    const item = (ok, text, page) => ({ ok: !!ok, text, page });
    const sec = [];
    sec.push({ id: 'company', title: 'Company & starting financials', items: [
      item(c.name || c.ticker, 'Company identified', 'company'),
      item(isNum(st.price) && c.priceDate, 'Current share price with its date', 'company'),
      item(isNum(st.rev) && (isNum(st.ni) || isNum(st.eps)), 'Starting revenue and earnings', 'company'),
      item(isNum(st.shares), S.shareBasis === 'diluted' ? 'Diluted share count (basic + net dilutive)' : 'Share count', 'company'),
      item(isNum(st.cash) && isNum(st.debt), 'Cash and debt (enter 0 when there is none)', 'company'),
    ] });
    sec.push({ id: 'assume', title: 'Assumptions', items: E.SCEN.map(s => item(all.scen[s].sel.ok, `${s}: every input for the ${E.METHODS[S.method].short} method`, 'growth')).concat([item(!m.pending, 'No imported assumptions waiting for review', 'growth')]) });
    sec.push({ id: 'scen', title: 'Scenarios', items: [
      item(isNum(all.weighted), all.weighted === null ? 'Probability-weighted price: ' + all.weightedNote : 'Probability-weighted price calculated', 'scenarios'),
      item(E.SCEN.every(s => (m.rationale[s] || '').trim()), 'A written rationale for each scenario', 'scenarios'),
    ] });
    sec.push({ id: 'docs', title: 'Conclusion and save', items: [
      item((m.conclusion || '').trim(), 'Conclusion written', 'results'),
      item(m.savedAt && m.savedAt >= (m.log[0] ? m.log[0].at : ''), 'Saved since the last change', 'saved'),
    ] });
    sec.forEach(s => { s.done = s.items.filter(i => i.ok).length; s.total = s.items.length; s.status = s.done === s.total ? 'complete' : s.done ? 'progress' : 'empty'; });
    const done = sec.reduce((a, s) => a + s.done, 0), total = sec.reduce((a, s) => a + s.total, 0);
    return { sections: sec, done, total, pct: done === total ? 100 : Math.min(99, Math.floor(done / total * 100)), complete: done === total };
  }

  return { blank, upgrade, loadAll, save, remove, duplicate, getCurrent, setCurrent, log, setAssumption, isManual, propose, applyPending, dismissPending, undoAssumption, histFromSEC, importSEC, importFMP, anchors, historyProposal, dcfProposal, fsmProposal, completion, SRC, KEY };
})();
if (typeof module !== 'undefined') module.exports = SimModel;
