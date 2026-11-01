// ===== TRADING COMPS MODEL: schema, persistence, completion (no UI) =====
// Trading Comps models are stored separately from DCF models (their own browser storage key),
// so a DCF model is never read or changed by saving, opening or deleting a comps model.
const CompsModel = (() => {
  const E = typeof CompsEngine !== 'undefined' ? CompsEngine : require('./comps-engine.js');
  const D = typeof CompsData !== 'undefined' ? CompsData : require('./comps-data.js');
  const isNum = E.isNum;
  const KEY = 'dcfcomps.models.v1', TKEY = 'dcfcomps.templates.v1', CUR = 'dcfcomps.current';
  const uid = D.uid;

  function blank(name = 'New Trading Comps') {
    return { id: uid(), kind: 'comps', version: 1, name, created: new Date().toISOString(), updated: new Date().toISOString(), savedAt: null,
      target: D.emptyCompany('target'), peers: [], groups: [], valDate: null, analyst: null,
      settings: { leasePolicy: 'exclude', shareBasis: 'basic', normalized: true, outlierK: 1.5, tablePeriod: 'ttm' },
      selection: { multiple: 'ev_ebitda', period: 'ttm', benchmark: 'median', manual: null, weights: {}, premium: 0, premiumWhy: {}, group: 'core', confirmed: false, why: '', analyst: { low: null, central: null, high: null, why: '' } },
      sens: { multStep: null, multN: 5, metStep: 0.05, metN: 5, gCenter: 0.05, gStep: 0.025, gN: 5 },
      notes: {}, conclusion: '', dcfLink: null, log: [], ui: { learn: true } };
  }
  function upgrade(m) {
    const b = blank(m.name);
    const out = Object.assign(b, m);
    out.settings = Object.assign(blank().settings, m.settings || {});
    out.selection = Object.assign(blank().selection, m.selection || {});
    out.selection.analyst = Object.assign(blank().selection.analyst, (m.selection || {}).analyst || {});
    out.sens = Object.assign(blank().sens, m.sens || {});
    const fix = c => Object.assign(D.emptyCompany(c && c.role || 'peer'), c || {});
    out.target = fix(Object.assign({ role: 'target' }, m.target || {}));
    out.peers = (m.peers || []).map(fix);
    out.groups = m.groups || []; out.notes = m.notes || {}; out.log = m.log || []; out.ui = Object.assign({ learn: true }, m.ui || {});
    return out;
  }
  function loadAll() { let all = {}; try { all = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } Object.keys(all).forEach(k => { all[k] = upgrade(all[k]); }); return all; }
  function saveAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  function save(m) { const all = loadAll(); m.updated = new Date().toISOString(); all[m.id] = m; return saveAll(all); }
  function remove(id) { const all = loadAll(); delete all[id]; saveAll(all); }
  function duplicate(m, name) { const c = upgrade(JSON.parse(JSON.stringify(m))); c.id = uid(); c.name = name || (m.name + ' (copy)'); c.created = new Date().toISOString(); c.savedAt = null; c.log = [{ at: new Date().toISOString(), field: 'duplicated from', to: m.name }].concat(c.log || []).slice(0, 500); return c; }
  function getCurrent() { try { return localStorage.getItem(CUR); } catch (e) { return null; } }
  function setCurrent(id) { try { localStorage.setItem(CUR, id); } catch (e) {} }
  // peer-group templates: tickers, names, status and reasons (no financial data)
  function loadTemplates() { try { return JSON.parse(localStorage.getItem(TKEY)) || []; } catch (e) { return []; } }
  function saveTemplate(name, m) {
    const t = { id: uid(), name, created: new Date().toISOString(), target: m.target.ticker || null, peers: m.peers.map(p => ({ ticker: p.ticker, name: p.name, status: p.status, reason: p.reason, cik: p.cik })) };
    const all = loadTemplates(); all.unshift(t); try { localStorage.setItem(TKEY, JSON.stringify(all.slice(0, 50))); return t; } catch (e) { return null; }
  }
  function removeTemplate(id) { try { localStorage.setItem(TKEY, JSON.stringify(loadTemplates().filter(t => t.id !== id))); } catch (e) {} }
  function applyTemplate(m, t) {
    let added = 0;
    t.peers.forEach(p => {
      if (m.peers.some(x => x.ticker && p.ticker && x.ticker.toUpperCase() === p.ticker.toUpperCase())) return;
      const c = D.emptyCompany('peer'); Object.assign(c, { ticker: p.ticker, name: p.name, status: p.status || 'core', reason: p.reason || '', cik: p.cik || null });
      m.peers.push(c); added++;
    });
    return added;
  }
  function log(m, field, from, to) { m.log.unshift({ at: new Date().toISOString(), field, from: from === undefined ? null : from, to: to === undefined ? null : to }); if (m.log.length > 500) m.log.length = 500; }

  // ---------- completion checklist ----------
  function completion(m) {
    const set = m.settings, t = m.target;
    const peers = E.peerSet(m);
    const b = E.benchmark(m);
    const imp = E.implied(m, b.selected);
    const tq = D.quality(t, m);
    const sec = [];
    const item = (ok, text, page, detail) => ({ ok: !!ok, text, page, detail: detail || '' });
    sec.push({ id: 'target', title: 'Target company', items: [
      item(t.name || t.ticker, 'Company identified', 'target'),
      item(E.has(t, 'price') && t.priceDate, 'Share price with its observation date', 'target'),
      item(E.has(t, 'shares'), 'Actual common shares outstanding', 'target'),
      item(E.evBuild(t, set).missing.length === 0, 'Enterprise value build complete (debt, cash and claims)', 'target'),
      item(E.has(t, 'rev_ttm') || E.has(t, 'rev_fy'), 'Operating figures imported or entered', 'target'),
    ] });
    sec.push({ id: 'peers', title: 'Peer selection', items: [
      item(peers.length >= 4, `At least four included peers (${peers.length} in the selected group)`, 'peers'),
      item(peers.every(p => p.reason), 'A reason recorded for every included peer', 'peers'),
      item(m.peers.filter(p => p.status === 'excluded').every(p => p.reason), 'A reason recorded for every excluded peer', 'peers'),
    ] });
    const bad = peers.filter(p => D.quality(p, m).some(q => q.level === 'bad'));
    const pend = [t].concat(m.peers).filter(c => c.pending);
    sec.push({ id: 'data', title: 'Peer financial data', items: [
      item(peers.length && !bad.length, bad.length ? `${bad.length} included peer(s) with missing price, shares, EV or revenue: ${bad.map(p => p.ticker || p.name).join(', ')}` : 'Every included peer has price, shares, EV and revenue', 'peerdata'),
      item(!pend.length, pend.length ? `Proposed data updates waiting for review (${pend.map(c => c.ticker || c.name).join(', ')})` : 'No data updates waiting for review', 'peerdata'),
      item(![t].concat(peers).some(c => E.fxOf(c).missing), 'Exchange rates entered where currencies differ', 'peerdata'),
    ] });
    const adj = [t].concat(peers).flatMap(c => (c.adj || []).filter(a => isNum(a.amount) && a.amount !== 0));
    sec.push({ id: 'adjust', title: 'Financial adjustments', items: [
      item(adj.every(a => a.reason && a.source), adj.length ? `${adj.filter(a => a.reason && a.source).length} of ${adj.length} adjustments justified and sourced` : 'No adjustments made (reported figures are used)', 'adjust'),
    ] });
    sec.push({ id: 'multiple', title: 'Multiple selection', items: [
      item(b.col.stats.n >= 3, `At least three valid peer observations for ${b.label} (${b.col.stats.n})`, 'table'),
      item(m.selection.confirmed, 'Multiple and benchmark confirmed by the analyst', 'multiple'),
      item(m.selection.why && m.selection.why.trim(), 'Reason for the multiple recorded', 'multiple'),
      item(!(isNum(m.selection.premium) && m.selection.premium !== 0) || Object.values(m.selection.premiumWhy || {}).some(x => x && x.trim()), 'Premium or discount justified (if any)', 'multiple'),
    ] });
    sec.push({ id: 'valuation', title: 'Implied valuation', items: [
      item(isNum(imp.perShare), imp.error ? 'Implied value: ' + imp.error : 'Implied value per share calculated', 'implied'),
      item(isNum(imp.upside), 'Upside or downside against the current price', 'implied'),
    ] });
    sec.push({ id: 'docs', title: 'Documentation and save', items: [
      item(m.conclusion && m.conclusion.trim(), 'Valuation conclusion written', 'summary'),
      item(m.savedAt && m.savedAt >= (m.log[0] ? m.log[0].at : ''), 'Saved since the last change', 'saved'),
    ] });
    sec.forEach(s => { s.done = s.items.filter(i => i.ok).length; s.total = s.items.length; s.status = s.done === s.total ? 'complete' : s.done ? 'progress' : 'empty'; });
    const done = sec.reduce((a, s) => a + s.done, 0), total = sec.reduce((a, s) => a + s.total, 0);
    const complete = done === total;
    return { sections: sec, done, total, pct: complete ? 100 : Math.min(99, Math.floor(done / total * 100)), complete, valued: isNum(imp.perShare), b, imp, targetQuality: tq };
  }

  return { blank, upgrade, loadAll, save, remove, duplicate, getCurrent, setCurrent, loadTemplates, saveTemplate, removeTemplate, applyTemplate, log, completion, KEY };
})();
if (typeof module !== 'undefined') module.exports = CompsModel;
