// ===== STOCK PRICE SIMULATOR: CALCULATION ENGINE (pure functions, no UI) =====
// Projects a company's revenue, earnings, cash flow and share count for 1–10 years, then converts each year's
// figures into a hypothetical share price with one of seven methods. Equity multiples (P/E, P/S, P/FCF) are applied
// to equity measures and give equity value directly; enterprise multiples (EV/EBITDA, EV/EBIT, EV/Revenue) are
// applied to enterprise measures and pass through the equity bridge (− debt − other claims + cash) before dividing
// by shares. The two kinds are never mixed. Nothing here is a forecast of a market price: every output is the
// arithmetic consequence of the analyst's assumptions.
const SimEngine = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const SCEN = ['Bear', 'Base', 'Bull'];
  const MAXY = 10;

  // ---------- methods ----------
  // kind 'eq': multiple × equity measure = equity value (P/E uses per-share EPS directly)
  // kind 'ev': multiple × operating measure = enterprise value, then the equity bridge
  const METHODS = {
    pe: { label: 'P/E projection', short: 'P/E', kind: 'eq', mult: 'pe', metric: 'eps', need: ['revGrowth', 'netMargin', 'pe'],
      formula: 'Revenue × (1 + growth)^t × net margin = net income; net income ÷ diluted weighted-average shares = EPS; EPS × P/E = price' },
    eps: { label: 'EPS growth projection', short: 'EPS growth', kind: 'eq', mult: 'pe', metric: 'eps', need: ['epsGrowth', 'pe'],
      formula: 'Starting EPS × (1 + EPS growth)^t = EPS; EPS × P/E = price' },
    ev_ebitda: { label: 'EV/EBITDA projection', short: 'EV/EBITDA', kind: 'ev', mult: 'evEbitda', metric: 'ebitda', need: ['revGrowth', 'ebitdaMargin', 'evEbitda'],
      formula: 'Revenue × EBITDA margin = EBITDA; EBITDA × EV/EBITDA = enterprise value; EV − debt − other claims + cash = equity value; equity ÷ diluted shares = price' },
    ev_ebit: { label: 'EV/EBIT projection', short: 'EV/EBIT', kind: 'ev', mult: 'evEbit', metric: 'ebit', need: ['revGrowth', 'ebitMargin', 'evEbit'],
      formula: 'Revenue × operating margin = EBIT; EBIT × EV/EBIT = enterprise value; EV − debt − other claims + cash = equity value; equity ÷ diluted shares = price' },
    ev_rev: { label: 'EV/Revenue projection', short: 'EV/Revenue', kind: 'ev', mult: 'evRev', metric: 'rev', need: ['revGrowth', 'evRev'],
      formula: 'Revenue × EV/Revenue = enterprise value; EV − debt − other claims + cash = equity value; equity ÷ diluted shares = price' },
    ps: { label: 'Price/Sales projection', short: 'P/S', kind: 'eq', mult: 'ps', metric: 'rev', need: ['revGrowth', 'ps'],
      formula: 'Revenue × P/S = equity value (market capitalisation); equity ÷ diluted shares = price. No bridge: P/S is an equity multiple' },
    pfcf: { label: 'Price/FCF projection', short: 'P/FCF', kind: 'eq', mult: 'pfcf', metric: 'fcf', need: ['revGrowth', 'fcfMargin', 'pfcf'],
      formula: 'Revenue × FCF margin = free cash flow; FCF × P/FCF = equity value; equity ÷ diluted shares = price. No bridge: P/FCF is an equity multiple' },
  };
  const METHOD_IDS = Object.keys(METHODS);

  // ---------- assumptions ----------
  // unit: pct (decimal), x (multiple), mm ($ millions). warn: [low, high] outside which a warning is shown.
  const ASSUME = [
    { key: 'revGrowth', label: 'Annual revenue growth', unit: 'pct', grp: 'growth', warn: [-0.25, 0.5] },
    { key: 'netMargin', label: 'Net profit margin', unit: 'pct', grp: 'growth', warn: [-0.3, 0.45] },
    { key: 'ebitdaMargin', label: 'EBITDA margin', unit: 'pct', grp: 'growth', warn: [-0.3, 0.7] },
    { key: 'ebitMargin', label: 'Operating (EBIT) margin', unit: 'pct', grp: 'growth', warn: [-0.3, 0.6] },
    { key: 'fcfMargin', label: 'Free cash flow margin', unit: 'pct', grp: 'growth', warn: [-0.3, 0.5] },
    { key: 'epsGrowth', label: 'Earnings (EPS) growth', unit: 'pct', grp: 'growth', warn: [-0.3, 0.6] },
    { key: 'dilution', label: 'Net share change (dilution + / buybacks −)', unit: 'pct', grp: 'shares', warn: [-0.08, 0.08], zero: true },
    { key: 'cashChange', label: 'Change in cash and investments', unit: 'mm', grp: 'balance', zero: true },
    { key: 'debtChange', label: 'Change in debt', unit: 'mm', grp: 'balance', zero: true },
    { key: 'payout', label: 'Dividend payout ratio', unit: 'pct', grp: 'dividend', warn: [0, 1] },
    { key: 'dpsGrowth', label: 'Dividend per share growth', unit: 'pct', grp: 'dividend', warn: [-0.5, 0.3] },
    { key: 'pe', label: 'Future P/E ratio', unit: 'x', grp: 'mult', warn: [5, 60] },
    { key: 'evEbitda', label: 'Future EV/EBITDA', unit: 'x', grp: 'mult', warn: [3, 35] },
    { key: 'evEbit', label: 'Future EV/EBIT', unit: 'x', grp: 'mult', warn: [5, 45] },
    { key: 'evRev', label: 'Future EV/Revenue', unit: 'x', grp: 'mult', warn: [0.2, 20] },
    { key: 'ps', label: 'Future price/sales', unit: 'x', grp: 'mult', warn: [0.2, 20] },
    { key: 'pfcf', label: 'Future price/free cash flow', unit: 'x', grp: 'mult', warn: [5, 60] },
  ];
  const AK = Object.fromEntries(ASSUME.map(a => [a.key, a]));
  const MULT_KEYS = ASSUME.filter(a => a.grp === 'mult').map(a => a.key);

  function blankScenario() {
    const A = { py: {}, src: {} };
    ASSUME.forEach(a => { A[a.key] = a.zero ? 0 : null; A.py[a.key] = null; });
    return A;
  }
  // value of an assumption in forecast year t (1-based): the per-year override if set, else the constant
  function at(A, key, t) {
    const py = A && A.py && A.py[key];
    if (py && isNum(py[t - 1])) return py[t - 1];
    const v = A ? A[key] : null;
    return isNum(v) ? v : (AK[key] && AK[key].zero ? 0 : null);
  }
  const hasPerYear = (A, key) => !!(A && A.py && A.py[key] && A.py[key].some(isNum));
  // straight-line path from a to b over n years (year 1 = first step, year n = b)
  function fade(a, b, n) { const out = []; for (let t = 1; t <= MAXY; t++) out.push(t <= n ? a + (b - a) * t / n : b); return out; }

  // ---------- starting figures ----------
  const val = (c, k) => { const r = c && c.v && c.v[k]; return r && isNum(r.v) ? r.v : null; };
  const srcOf = (c, k) => (c && c.v && c.v[k] && c.v[k].src) || null;
  const DEBT_LINES = ['stBorrow', 'ltdCurrent', 'ltdNoncurrent', 'finLease'];
  const CLAIM_LINES = ['preferred', 'nci', 'otherClaims'];
  const CASH_LINES = ['cash', 'sti'];
  function yearsBetween(a, b) { if (!a || !b) return null; const d = (new Date(b) - new Date(a)) / (365.25 * 864e5); return isFinite(d) ? d : null; }
  function addYears(iso, n) { if (!iso) return null; const d = new Date(iso + 'T00:00:00Z'); if (isNaN(d)) return null; d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString().slice(0, 10); }

  function start(sim) {
    const c = sim.company || { v: {} }, S = sim.settings || {};
    const base = S.base === 'fy' ? 'fy' : 'ttm';
    const notes = [], missing = [];
    const pick = k => {
      let v = val(c, k + '_' + base), used = k + '_' + base;
      if (!isNum(v) && base === 'ttm' && isNum(val(c, k + '_fy'))) { v = val(c, k + '_fy'); used = k + '_fy'; notes.push(`No TTM ${k.toUpperCase()} figure: the latest fiscal year is used for it.`); }
      return { v, key: used, src: srcOf(c, used) };
    };
    const rev = pick('rev'), ni = pick('ni'), ebitda = pick('ebitda'), ebit = pick('ebit'), fcf = pick('fcf'), eps = pick('eps');
    const split = S.split || {}; const f = isNum(split.factor) && split.factor > 0 ? split.factor : 1;
    const shAdj = split.appliesTo === 'all' ? f : 1, psAdj = f;
    const basic = val(c, 'shares');
    let shares = null, shareBasis = S.shareBasis === 'basic' ? 'basic' : 'diluted';
    if (isNum(basic)) {
      if (shareBasis === 'diluted') { const d = val(c, 'dilutive'); if (isNum(d)) shares = (basic + d) * shAdj; else missing.push('dilutive'); }
      else shares = basic * shAdj;
    } else missing.push('shares');
    let debt = 0, anyLoan = false;
    DEBT_LINES.forEach(k => { const v = val(c, k); if (isNum(v)) { debt += v; if (k !== 'finLease') anyLoan = true; } });
    if (S.leases === 'debt') { const v = val(c, 'opLease'); if (isNum(v)) debt += v; else notes.push('Operating leases are set to count as debt, but no operating lease liability is entered.'); }
    if (!anyLoan) { debt = null; missing.push('debt'); }
    let cash = null; if (isNum(val(c, 'cash'))) cash = val(c, 'cash') + (val(c, 'sti') || 0); else missing.push('cash');
    let claims = 0; CLAIM_LINES.forEach(k => { const v = val(c, k); if (isNum(v)) claims += v; });
    const price = val(c, 'price');
    if (!isNum(price)) missing.push('price');
    const dps = isNum(val(c, 'dps')) ? val(c, 'dps') / psAdj : null;
    const baseEnd = (rev.src && rev.src.end) || c.baseEnd || null;
    const stub = S.fromPriceDate !== false ? yearsBetween(baseEnd, c.priceDate) : null;
    return {
      base, rev: rev.v, ni: ni.v, ebitda: ebitda.v, ebit: ebit.v, fcf: fcf.v, eps: isNum(eps.v) ? eps.v / psAdj : null, epsReported: eps.v,
      basic, shares, shareBasis, debt, cash, claims, price, priceDate: c.priceDate || null, dps, baseEnd,
      stub: isNum(stub) ? Math.max(0, Math.min(stub, 1.5)) : 0, stubRaw: stub, splitFactor: f, splitAppliesTo: split.appliesTo === 'all' ? 'all' : 'eps',
      keys: { rev: rev.key, ni: ni.key, ebitda: ebitda.key, ebit: ebit.key, fcf: fcf.key, eps: eps.key }, notes, missing,
    };
  }

  // current (trailing) multiples implied by today's price, for anchoring future multiples
  function current(st) {
    const mcap = isNum(st.price) && isNum(st.shares) ? st.price * st.shares : null;
    const ev = isNum(mcap) && isNum(st.debt) && isNum(st.cash) ? mcap + st.debt + st.claims - st.cash : null;
    const r = (a, b) => isNum(a) && isNum(b) && b > 0 ? a / b : null;
    return { mcap, ev, pe: r(st.price, st.eps), peCalc: isNum(mcap) && isNum(st.ni) && st.ni > 0 ? mcap / st.ni : null, evEbitda: r(ev, st.ebitda), evEbit: r(ev, st.ebit), evRev: r(ev, st.rev), ps: r(mcap, st.rev), pfcf: r(mcap, st.fcf),
      netMargin: isNum(st.ni) && isNum(st.rev) && st.rev > 0 ? st.ni / st.rev : null,
      ebitdaMargin: isNum(st.ebitda) && st.rev > 0 ? st.ebitda / st.rev : null, ebitMargin: isNum(st.ebit) && st.rev > 0 ? st.ebit / st.rev : null, fcfMargin: isNum(st.fcf) && st.rev > 0 ? st.fcf / st.rev : null,
      divYield: isNum(st.dps) && st.price > 0 ? st.dps / st.price : null, payout: isNum(st.dps) && isNum(st.eps) && st.eps > 0 ? st.dps / st.eps : null };
  }

  // ---------- projection ----------
  // opt.A: an alternative assumption set (sensitivity, reverse checks); opt.years: horizon override
  function project(sim, sname, opt = {}) {
    const S = sim.settings || {};
    const A = opt.A || (sim.scen && sim.scen[sname]) || blankScenario();
    const st = opt.st || start(sim);
    const n = Math.max(1, Math.min(MAXY, Math.round(opt.years || (isNum(S.years) ? S.years : 5))));
    const avg = S.waBasis !== 'end';
    const divMode = S.divMode || 'none';
    const miss = {}; METHOD_IDS.forEach(m => { miss[m] = new Set(); });
    const needStart = { pe: ['rev', 'shares'], eps: ['eps', 'shares'], ev_ebitda: ['rev', 'shares', 'debt', 'cash'], ev_ebit: ['rev', 'shares', 'debt', 'cash'], ev_rev: ['rev', 'shares', 'debt', 'cash'], ps: ['rev', 'shares'], pfcf: ['rev', 'shares'] };
    METHOD_IDS.forEach(m => {
      needStart[m].forEach(k => { if (!isNum(st[k])) miss[m].add(k === 'shares' && st.missing.includes('dilutive') ? 'dilutive' : k); });
      METHODS[m].need.forEach(k => { for (let t = 1; t <= n; t++) if (!isNum(at(A, k, t))) { miss[m].add(k); break; } });
    });
    const years = [];
    let rev = st.rev, sh = st.shares, epsG = st.eps, dps = st.dps, cash = st.cash, debt = st.debt;
    for (let t = 1; t <= n; t++) {
      const y = { t, end: addYears(st.baseEnd, t), h: t - st.stub };
      const g = at(A, 'revGrowth', t);
      y.revGrowth = g;
      rev = isNum(rev) && isNum(g) ? rev * (1 + g) : null; y.rev = rev;
      const mg = k => { const m = at(A, k, t); return isNum(rev) && isNum(m) ? rev * m : null; };
      y.netMargin = at(A, 'netMargin', t); y.ni = mg('netMargin');
      y.ebitdaMargin = at(A, 'ebitdaMargin', t); y.ebitda = mg('ebitdaMargin');
      y.ebitMargin = at(A, 'ebitMargin', t); y.ebit = mg('ebitMargin');
      y.fcfMargin = at(A, 'fcfMargin', t); y.fcf = mg('fcfMargin');
      const d = at(A, 'dilution', t); y.dilution = d;
      const shPrev = sh; sh = isNum(sh) && d > -1 ? sh * (1 + d) : null;
      y.sharesStart = shPrev; y.sharesEnd = sh; y.sharesWA = isNum(sh) ? (avg ? (shPrev + sh) / 2 : sh) : null;
      y.epsPE = isNum(y.ni) && isNum(y.sharesWA) && y.sharesWA > 0 ? y.ni / y.sharesWA : null;
      const eg = at(A, 'epsGrowth', t); y.epsGrowth = eg;
      epsG = isNum(epsG) && isNum(eg) && st.eps > 0 ? epsG * (1 + eg) : null; y.epsG = epsG;
      y.niFromEps = isNum(epsG) && isNum(y.sharesWA) ? epsG * y.sharesWA : null;
      cash = isNum(cash) ? cash + at(A, 'cashChange', t) : null; debt = isNum(debt) ? debt + at(A, 'debtChange', t) : null;
      y.cash = cash; y.debt = debt; y.claims = st.claims;
      y.netClaims = isNum(cash) && isNum(debt) ? debt + st.claims - cash : null;
      y.mult = {}; MULT_KEYS.forEach(k => { y.mult[k] = at(A, k, t); });
      // prices by method
      y.p = {}; y.why = {}; y.ev = {}; y.eq = {};
      const setP = (m, v, why) => { y.p[m] = isNum(v) ? v : null; if (why) y.why[m] = why; };
      // P/E (from revenue and margin)
      { const M = y.mult.pe; if (!isNum(y.epsPE) || !isNum(M)) setP('pe', null); else if (y.epsPE <= 0) setP('pe', null, 'EPS is zero or negative: a P/E multiple cannot price a loss. Use EV/Revenue or P/S, or a year with positive earnings.'); else if (M <= 0) setP('pe', null, 'A P/E of zero or below is not meaningful.'); else { setP('pe', y.epsPE * M); y.eq.pe = y.p.pe * y.sharesWA; } }
      // EPS growth
      { const M = y.mult.pe; if (isNum(st.eps) && st.eps <= 0) setP('eps', null, 'Starting EPS is zero or negative: growing a loss by a percentage is not meaningful. Use the P/E projection with a margin path instead.'); else if (!isNum(epsG) || !isNum(M)) setP('eps', null); else if (M <= 0) setP('eps', null, 'A P/E of zero or below is not meaningful.'); else setP('eps', epsG * M); }
      // enterprise multiples
      [['ev_ebitda', 'ebitda', 'evEbitda'], ['ev_ebit', 'ebit', 'evEbit'], ['ev_rev', 'rev', 'evRev']].forEach(([m, k, mk]) => {
        const met = y[k], M = y.mult[mk];
        if (!isNum(met) || !isNum(M) || !isNum(y.netClaims) || !isNum(sh)) return setP(m, null);
        if (met <= 0) return setP(m, null, `Projected ${k === 'rev' ? 'revenue' : k.toUpperCase()} is zero or negative: the ${METHODS[m].short} multiple cannot value it.`);
        if (M <= 0) return setP(m, null, 'A multiple of zero or below is not meaningful.');
        const ev = met * M, eq = ev - y.netClaims; y.ev[m] = ev; y.eq[m] = eq;
        if (eq <= 0) return setP(m, 0, 'Debt and other claims exceed the projected enterprise value: equity is worth nothing in this case (shareholders cannot lose more than their investment, so the price is floored at 0).');
        setP(m, eq / sh);
      });
      // equity multiples on totals
      [['ps', 'rev', 'ps'], ['pfcf', 'fcf', 'pfcf']].forEach(([m, k, mk]) => {
        const met = y[k], M = y.mult[mk];
        if (!isNum(met) || !isNum(M) || !isNum(sh)) return setP(m, null);
        if (met <= 0) return setP(m, null, `Projected ${k === 'rev' ? 'revenue' : 'free cash flow'} is zero or negative: the ${METHODS[m].short} multiple cannot value it.`);
        if (M <= 0) return setP(m, null, 'A multiple of zero or below is not meaningful.');
        y.eq[m] = met * M; setP(m, y.eq[m] / sh);
      });
      // dividends per share paid in year t
      const epsDiv = (S.method === 'eps') ? epsG : y.epsPE;
      if (divMode === 'payout') { const po = at(A, 'payout', t); y.dps = isNum(po) && isNum(epsDiv) ? Math.max(0, epsDiv) * po : null; }
      else if (divMode === 'growth') { const dg = at(A, 'dpsGrowth', t); dps = isNum(dps) && isNum(dg) ? dps * (1 + dg) : null; y.dps = dps; }
      else y.dps = 0;
      years.push(y);
    }
    if (divMode === 'payout') { for (let t = 1; t <= n; t++) if (!isNum(at(A, 'payout', t))) { METHOD_IDS.forEach(m => miss[m].add('payout')); break; } }
    if (divMode === 'growth') { if (!isNum(st.dps)) METHOD_IDS.forEach(m => miss[m].add('dps')); for (let t = 1; t <= n; t++) if (!isNum(at(A, 'dpsGrowth', t))) { METHOD_IDS.forEach(m => miss[m].add('dpsGrowth')); break; } }
    const methods = {};
    METHOD_IDS.forEach(m => {
      const last = years[n - 1];
      methods[m] = { missing: Array.from(miss[m]), price: last.p[m], why: last.why[m] || null, ok: miss[m].size === 0 && isNum(last.p[m]) };
      methods[m].returns = returns(st, years, m);
    });
    const sel = S.method && METHODS[S.method] ? S.method : 'pe';
    return { scenario: sname, n, st, years, methods, method: sel, sel: methods[sel], last: years[n - 1], A };
  }

  // ---------- returns ----------
  // price return, annualised price return (CAGR over the holding period), dividends, total return and IRR.
  // The holding period runs from the price date: year t ends t years after the base period end, so it is t − stub.
  function returns(st, years, m) {
    const n = years.length, last = years[n - 1], P0 = st.price, Pn = last.p[m], h = last.h;
    const out = { price: Pn, upside: null, cagr: null, divs: null, total: null, irr: null, h };
    if (!isNum(P0) || P0 <= 0 || !isNum(Pn)) return out;
    out.upside = Pn / P0 - 1;
    if (h > 0.05) out.cagr = Pn > 0 ? Math.pow(Pn / P0, 1 / h) - 1 : -1;
    const divs = years.map(y => isNum(y.dps) ? y.dps : null);
    if (divs.every(isNum)) {
      out.divs = divs.reduce((a, b) => a + b, 0);
      out.total = (Pn + out.divs) / P0 - 1;
      const flows = years.map((y, i) => ({ t: Math.max(y.h, 0.0001), v: divs[i] + (i === n - 1 ? Pn : 0) }));
      if (h > 0.05) out.irr = irr(P0, flows);
    }
    return out;
  }
  // internal rate of return for −P0 now and flows [{t (years), v}], by bisection
  function irr(P0, flows) {
    const npv = r => flows.reduce((a, f) => a + f.v / Math.pow(1 + r, f.t), 0) - P0;
    if (flows.every(f => f.v === 0)) return -1;
    let lo = -0.9999, hi = 10;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; if (hi - lo < 1e-12) break; }
    return (lo + hi) / 2;
  }
  // present value today of the projected price and dividends at a required annual return r
  function presentValue(proj, m, r) {
    if (!isNum(r) || r <= -1) return null;
    const ys = proj.years, last = ys[ys.length - 1];
    if (!isNum(last.p[m])) return null;
    let pv = 0;
    for (const y of ys) { const d = isNum(y.dps) ? y.dps : 0; pv += d / Math.pow(1 + r, Math.max(y.h, 0)); }
    return pv + last.p[m] / Math.pow(1 + r, Math.max(last.h, 0));
  }

  // ---------- all scenarios ----------
  function runAll(sim) {
    const st = start(sim);
    const out = {}; SCEN.forEach(s => { out[s] = project(sim, s, { st }); });
    const w = (sim.settings && sim.settings.weights) || {};
    const ws = SCEN.map(s => isNum(w[s]) ? w[s] : null);
    const sum = ws.reduce((a, b) => a + (b || 0), 0);
    let weighted = null, weightedNote = '';
    if (ws.some(x => x === null)) weightedNote = 'Enter a probability for each scenario.';
    else if (ws.some(x => x < 0)) weightedNote = 'Probabilities cannot be negative.';
    else if (Math.abs(sum - 1) > 0.001) weightedNote = `Probabilities add up to ${(sum * 100).toFixed(1)}%, not 100%.`;
    else if (SCEN.some(s => !out[s].sel.ok)) weightedNote = 'Every scenario needs a price for the selected method.';
    else weighted = SCEN.reduce((a, s, i) => a + ws[i] * out[s].sel.price, 0);
    return { st, scen: out, weighted, weightedNote, cur: current(st) };
  }

  // ---------- sensitivity ----------
  // replace assumptions with constants for every year (per-year overrides for those keys are cleared)
  function withA(A, over) {
    const B = JSON.parse(JSON.stringify(A)); B.py = B.py || {};
    Object.entries(over).forEach(([k, v]) => { B[k] = v; B.py[k] = null; });
    return B;
  }
  function priceWith(sim, sname, over, method, st) {
    const S = Object.assign({}, sim.settings, { method });
    const p = project(Object.assign({}, sim, { settings: S }), sname, { A: withA(sim.scen[sname], over), st });
    return p.methods[method].price;
  }
  // axis centred on c with k steps of size s on each side
  function axis(c, s, k = 2) { const out = []; for (let i = -k; i <= k; i++) out.push(c + i * s); return out; }
  function grid(sim, sname, rowKey, rows, colKey, cols, method) {
    const st = start(sim);
    return rows.map(r => cols.map(c => priceWith(sim, sname, { [rowKey]: r, [colKey]: c }, method, st)));
  }
  // dilution rows × methods
  function dilutionGrid(sim, sname, rows, methods) {
    const st = start(sim);
    return rows.map(r => methods.map(m => priceWith(sim, sname, { dilution: r }, m, st)));
  }
  // the value an assumption takes in the final year (used to centre the grids)
  function finalValue(sim, sname, key) { const n = Math.max(1, Math.min(MAXY, Math.round((sim.settings && sim.settings.years) || 5))); return at(sim.scen[sname], key, n); }

  // ---------- reverse projection ----------
  // For a target price in year n, solve one assumption at a time with every other assumption held at the
  // scenario's values. Each answer is re-checked by running the forward projection with it.
  function reverse(sim, sname, target, yearN) {
    const S = sim.settings || {}, st = start(sim);
    const n = Math.max(1, Math.min(MAXY, Math.round(yearN || S.years || 5)));
    const sim2 = Object.assign({}, sim, { settings: Object.assign({}, S, { years: n }) });
    const p = project(sim2, sname, { st, years: n }); const y = p.years[n - 1];
    const A = sim.scen[sname];
    const out = [];
    const add = (key, label, value, held, note, check) => out.push({ key, label, value: isNum(value) ? value : null, held, note: note || '', check: isNum(check) ? check : null });
    if (!isNum(target) || target <= 0) return { n, items: [], error: 'Enter a target price above zero.' };
    const pe = y.mult.pe;
    // EPS
    const epsReq = isNum(pe) && pe > 0 ? target / pe : null;
    add('eps', `Year-${n} EPS`, epsReq, [`P/E ${fx(pe)}`], isNum(pe) ? '' : 'Needs a future P/E.', epsReq);
    // P/E multiple
    const peBase = S.method === 'eps' ? y.epsG : y.epsPE;
    const peReq = isNum(peBase) && peBase > 0 ? target / peBase : null;
    add('pe', `Year-${n} P/E multiple`, peReq, [`EPS ${fp(peBase)} (${S.method === 'eps' ? 'EPS growth path' : 'revenue × margin ÷ shares'})`], isNum(peBase) && peBase <= 0 ? 'Projected EPS is not positive: no P/E gives a positive price.' : '', isNum(peReq) ? priceWith(sim2, sname, { pe: peReq }, S.method === 'eps' ? 'eps' : 'pe', st) : null);
    // net margin in year n
    let mReq = null; if (isNum(epsReq) && isNum(y.sharesWA) && isNum(y.rev) && y.rev > 0) mReq = epsReq * y.sharesWA / y.rev;
    let mCheck = null; if (isNum(mReq)) { const B = JSON.parse(JSON.stringify(A)); B.py = B.py || {}; const arr = []; for (let t = 1; t <= MAXY; t++) arr.push(at(A, 'netMargin', t)); arr[n - 1] = mReq; B.py.netMargin = arr; mCheck = project(Object.assign({}, sim2, { settings: Object.assign({}, sim2.settings, { method: 'pe' }) }), sname, { A: B, st, years: n }).methods.pe.price; }
    add('netMargin', `Year-${n} net profit margin`, mReq, [`revenue ${fm(y.rev)}`, `diluted shares ${fs(y.sharesWA)}`, `P/E ${fx(pe)}`], 'Only the final-year margin matters to the year-' + n + ' price under the P/E method.', mCheck);
    // revenue growth (one constant rate for every year), margin and share path held
    let gReq = null, gNote = hasPerYear(A, 'revGrowth') ? 'Replaces your per-year growth path with one constant rate.' : '';
    if (isNum(epsReq) && isNum(y.sharesWA) && isNum(y.netMargin) && y.netMargin > 0 && isNum(st.rev) && st.rev > 0) { const revN = epsReq * y.sharesWA / y.netMargin; gReq = Math.pow(revN / st.rev, 1 / n) - 1; }
    else if (isNum(y.netMargin) && y.netMargin <= 0) gNote = 'The net margin is not positive, so no growth rate produces positive earnings.';
    add('revGrowth', 'Annual revenue growth (constant)', gReq, [`year-${n} net margin ${fpc(y.netMargin)}`, 'share path', `P/E ${fx(pe)}`], gNote, isNum(gReq) ? priceWith(sim2, sname, { revGrowth: gReq }, 'pe', st) : null);
    // EPS growth
    let egReq = null; if (isNum(epsReq) && isNum(st.eps) && st.eps > 0 && epsReq > 0) egReq = Math.pow(epsReq / st.eps, 1 / n) - 1;
    add('epsGrowth', 'Annual EPS growth (constant)', egReq, [`starting EPS ${fp(st.eps)}`, `P/E ${fx(pe)}`], isNum(st.eps) && st.eps <= 0 ? 'Starting EPS is not positive: a growth rate cannot be solved.' : '', isNum(egReq) ? priceWith(sim2, sname, { epsGrowth: egReq }, 'eps', st) : null);
    // EBITDA and EV/EBITDA (target price × end-of-year shares + net claims = required EV)
    const evReq = isNum(y.sharesEnd) && isNum(y.netClaims) ? target * y.sharesEnd + y.netClaims : null;
    const em = y.mult.evEbitda;
    const ebitdaReq = isNum(evReq) && isNum(em) && em > 0 ? evReq / em : null;
    add('ebitda', `Year-${n} EBITDA ($mm)`, ebitdaReq, [`EV/EBITDA ${fx(em)}`, `net debt and claims ${fm(y.netClaims)}`, `shares ${fs(y.sharesEnd)}`], isNum(y.netClaims) ? '' : 'Needs cash and debt.', isNum(ebitdaReq) && isNum(y.rev) && y.rev > 0 ? (() => { const B = JSON.parse(JSON.stringify(A)); B.py = B.py || {}; const arr = []; for (let t = 1; t <= MAXY; t++) arr.push(at(A, 'ebitdaMargin', t)); arr[n - 1] = ebitdaReq / y.rev; B.py.ebitdaMargin = arr; return project(sim2, sname, { A: B, st, years: n }).methods.ev_ebitda.price; })() : null);
    const emReq = isNum(evReq) && isNum(y.ebitda) && y.ebitda > 0 ? evReq / y.ebitda : null;
    add('evEbitda', `Year-${n} EV/EBITDA multiple`, emReq, [`EBITDA ${fm(y.ebitda)}`, `net debt and claims ${fm(y.netClaims)}`, `shares ${fs(y.sharesEnd)}`], isNum(y.ebitda) && y.ebitda <= 0 ? 'Projected EBITDA is not positive.' : '', isNum(emReq) ? priceWith(sim2, sname, { evEbitda: emReq }, 'ev_ebitda', st) : null);
    const cagr = isNum(st.price) && st.price > 0 && y.h > 0.05 ? Math.pow(target / st.price, 1 / y.h) - 1 : null;
    return { n, items: out, y, cagr, held: 'Each line changes one assumption only. Everything else (growth, margins, share count, cash, debt and the other multiples) stays at the ' + sname + ' scenario values.' };
  }
  const fx = v => isNum(v) ? v.toFixed(1) + '×' : 'n/a';
  const fp = v => isNum(v) ? '$' + v.toFixed(2) : 'n/a';
  const fpc = v => isNum(v) ? (v * 100).toFixed(1) + '%' : 'n/a';
  const fm = v => isNum(v) ? Math.round(v).toLocaleString('en-US') + ' $mm' : 'n/a';
  const fs = v => isNum(v) ? v.toFixed(1) + 'mm' : 'n/a';

  // ---------- checks ----------
  function checks(sim, all) {
    const out = []; const S = sim.settings || {}, st = all.st;
    const add = (level, text, page) => out.push({ level, text, page });
    if (st.missing.length) add('bad', 'Starting figures missing: ' + st.missing.map(k => START_LABEL[k] || k).join(', ') + '.', 'company');
    st.notes.forEach(n => add('warn', n, 'company'));
    if (isNum(st.stubRaw) && st.stubRaw > 1.25) add('warn', `The base period ended ${st.stubRaw.toFixed(1)} years before the price date. Newer financials would make the starting point more reliable.`, 'company');
    if (isNum(st.stubRaw) && st.stubRaw < 0) add('warn', 'The price date is before the end of the base period. Check both dates.', 'company');
    // stock split mismatch: shares implied by net income ÷ EPS against the share count
    if (isNum(st.ni) && isNum(st.epsReported) && st.epsReported !== 0 && isNum(st.basic) && st.ni / st.epsReported > 0) {
      const implied = st.ni / st.epsReported, r = st.basic * (S.split && S.split.appliesTo === 'all' ? st.splitFactor : 1) / implied;
      const k = Math.round(r);
      if (k >= 2 && Math.abs(r / k - 1) < 0.06 && st.splitFactor === 1) add('bad', `Net income ÷ EPS implies about ${implied.toFixed(0)}mm shares, but the share count is ${st.basic.toFixed(0)}mm (about ${k}× more). This usually means a ${k}-for-1 stock split after the EPS period: set the split factor to ${k} for per-share figures.`, 'company');
      const k2 = Math.round(1 / r);
      if (k2 >= 2 && Math.abs((1 / r) / k2 - 1) < 0.06 && st.splitFactor === 1) add('bad', `The share count is about 1/${k2} of the shares implied by net income ÷ EPS. A reverse split (1-for-${k2}) may have happened: check the filing's share note.`, 'company');
    }
    if (isNum(st.eps) && st.eps <= 0) add('warn', 'Starting EPS is zero or negative. P/E and EPS growth projections need positive earnings; use a margin path that turns positive, or EV/Revenue or P/S.', 'growth');
    SCEN.forEach(s => {
      const p = all.scen[s], A = sim.scen[s];
      ASSUME.forEach(a => {
        if (!a.warn) return;
        for (let t = 1; t <= p.n; t++) { const v = at(A, a.key, t); if (isNum(v) && (v < a.warn[0] || v > a.warn[1])) { add('warn', `${s}: ${a.label} of ${a.unit === 'x' ? v.toFixed(1) + '×' : (v * 100).toFixed(1) + '%'} in year ${t} is unusual (typical range ${a.unit === 'x' ? a.warn[0] + '×–' + a.warn[1] + '×' : (a.warn[0] * 100).toFixed(0) + '% to ' + (a.warn[1] * 100).toFixed(0) + '%'}). Check that it is intended.`, a.grp === 'mult' ? 'multiples' : 'growth'); break; }
          if (isNum(v) && a.unit === 'x' && v <= 0) { add('bad', `${s}: ${a.label} must be above zero.`, 'multiples'); break; } }
      });
      for (let t = 1; t <= p.n; t++) {
        const y = p.years[t - 1];
        if (isNum(y.ebitMargin) && isNum(y.ebitdaMargin) && y.ebitMargin > y.ebitdaMargin + 1e-9) { add('warn', `${s} year ${t}: the operating margin is above the EBITDA margin. EBIT = EBITDA − D&A, so it should be lower.`, 'growth'); break; }
        if (isNum(y.netMargin) && isNum(y.ebitMargin) && y.netMargin > y.ebitMargin + 0.02) { add('warn', `${s} year ${t}: the net margin is above the operating margin. That needs large non-operating income or a tax benefit; check it.`, 'growth'); break; }
      }
      const last = p.last;
      if (last.why[p.method]) add('warn', `${s}: ${last.why[p.method]}`, 'projections');
      if (isNum(last.cash) && last.cash < 0) add('warn', `${s}: cash becomes negative by year ${p.n}. Reduce cash outflows or add debt.`, 'company');
      if (isNum(last.debt) && last.debt < 0) add('warn', `${s}: debt becomes negative by year ${p.n}.`, 'company');
      // method consistency: P/E against EV/EBITDA price
      if (isNum(last.p.pe) && isNum(last.p.ev_ebitda) && last.p.pe > 0 && Math.abs(last.p.ev_ebitda / last.p.pe - 1) > 0.5) add('info', `${s}: the EV/EBITDA price (${fp(last.p.ev_ebitda)}) and the P/E price (${fp(last.p.pe)}) differ by more than 50%. The multiples imply different views; this is information, not an error.`, 'multiples');
    });
    const b = all.scen.Bear.sel.price, m = all.scen.Base.sel.price, u = all.scen.Bull.sel.price;
    if ([b, m, u].every(isNum) && !(b <= m && m <= u)) add('warn', 'The scenario prices are not ordered Bear ≤ Base ≤ Bull. Check the scenario assumptions.', 'scenarios');
    return out;
  }
  const START_LABEL = { rev: 'starting revenue', ni: 'net income', eps: 'starting EPS', shares: 'shares outstanding', dilutive: 'net dilutive shares (or switch to basic shares)', debt: 'debt (enter 0 if none)', cash: 'cash (enter 0 if none)', price: 'current share price', dps: 'starting dividend per share' };

  return { SCEN, MAXY, METHODS, METHOD_IDS, ASSUME, AK, MULT_KEYS, blankScenario, at, hasPerYear, fade, start, current, project, returns, irr, presentValue, runAll, withA, priceWith, axis, grid, dilutionGrid, finalValue, reverse, checks, addYears, yearsBetween, START_LABEL, isNum, DEBT_LINES, CLAIM_LINES, CASH_LINES };
})();
if (typeof module !== 'undefined') module.exports = SimEngine;
