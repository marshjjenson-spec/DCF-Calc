// ===== SEC FILE CACHE =====
// Keeps SEC company facts files (and the optional submissions file) that the user has loaded, so the
// three-statement model can import a company already loaded in the DCF without asking for the file again.
// Stored in IndexedDB (files are several MB, too large for localStorage) with an in-memory mirror for
// synchronous lookups. Nothing is fetched; only files the user chose are kept, on this device.
const SecCache = (() => {
  const DB = 'dcfcalc.sec', STORE = 'facts', MAX = 12;
  const mem = new Map(); // cik -> { cik, name, facts, subs, saved }
  const norm = c => String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, '');
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        if (typeof indexedDB === 'undefined') return res(null);
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE, { keyPath: 'cik' }); };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
        rq.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(mode, fn) { return db().then(d => d ? new Promise(res => { try { const t = d.transaction(STORE, mode); const st = t.objectStore(STORE); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : true); t.onerror = () => res(null); t.onabort = () => res(null); } catch (e) { res(null); } }) : null); }
  function put(facts, subs) {
    const cik = norm(facts && facts.cik); if (!cik) return Promise.resolve(false);
    const rec = { cik, name: facts.entityName || (subs && subs.name) || '', facts, subs: subs || null, saved: new Date().toISOString() };
    const prev = mem.get(cik); if (!subs && prev && prev.subs) rec.subs = prev.subs;
    mem.set(cik, rec);
    while (mem.size > MAX) { const oldest = [...mem.values()].sort((a, b) => a.saved < b.saved ? -1 : 1)[0]; mem.delete(oldest.cik); tx('readwrite', st => st.delete(oldest.cik)); }
    return tx('readwrite', st => st.put(rec)).then(r => !!r);
  }
  function getSync(cik) { return mem.get(norm(cik)) || null; }
  function get(cik) { const k = norm(cik); if (mem.has(k)) return Promise.resolve(mem.get(k)); return tx('readonly', st => st.get(k)).then(r => { if (r && r.cik) { mem.set(k, r); return r; } return null; }); }
  function listSync() { return [...mem.values()].map(r => ({ cik: r.cik, name: r.name, saved: r.saved, hasSubs: !!r.subs })).sort((a, b) => a.name < b.name ? -1 : 1); }
  function remove(cik) { const k = norm(cik); mem.delete(k); return tx('readwrite', st => st.delete(k)); }
  // Load the index into memory at start so listSync and getSync work without waiting.
  const ready = tx('readonly', st => st.getAll()).then(all => { (all || []).forEach(r => { if (r && r.cik) mem.set(r.cik, r); }); try { if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('seccache-ready')); } catch (e) {} return true; });
  return { put, get, getSync, listSync, remove, ready, _norm: norm };
})();
if (typeof module !== 'undefined') module.exports = SecCache;
