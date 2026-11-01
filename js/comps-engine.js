// ===== TRADING COMPS ENGINE (no UI, no network) =====
// Pure functions for a comparable company analysis: market capitalisation, the enterprise value build,
// normalised metrics, trading multiples (with N/M rules), peer statistics, the implied valuation, the
// valuation range, sensitivity tables and the comparison with a DCF. Every result carries the figures it
// was built from so the interface can show each step. A missing input stays missing: nothing here
// substitutes zero for a figure that was not reported or entered.
const CompsEngine = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);

  // ---------- definitions ----------
  // Metric keys are stored per period: rev_ttm, ebitda_fy, eps_ntm, ...
  const METRICS = {
    rev: { label: 'Revenue', unit: 'mm' },
    gp: { label: 'Gross profit', unit: 'mm' },
    ebitda: { label: 'EBITDA', unit: 'mm' },
    ebit: { label: 'EBIT', unit: 'mm' },
    ni: { label: 'Net income to common', unit: 'mm' },
    eps: { label: 'Diluted EPS', unit: 'ps' },
    capex: { label: 'Capital expenditures', unit: 'mm' },
    fcf: { label: 'Free cash flow (CFO − CapEx)', unit: 'mm' },
  };
  const PERIODS = { ttm: 'TTM', fy: 'Last FY', ntm: 'NTM', fy1: 'FY+1' };
  // EV lines: sign +1 adds to EV (claims), −1 subtracts (assets). 'opt' lines may be legitimately absent.
  const EV_LINES = [
    { key: 'stBorrow', label: 'Short-term borrowings and commercial paper', sign: 1, grp: 'debt' },
    { key: 'ltdCurrent', label: 'Current portion of long-term debt', sign: 1, grp: 'debt' },
    { key: 'ltdNoncurrent', label: 'Long-term debt, non-current', sign: 1, grp: 'debt' },
    { key: 'finLease', label: 'Finance lease liabilities', sign: 1, grp: 'debt' },
    { key: 'opLease', label: 'Operating lease liabilities', sign: 1, grp: 'lease', policy: true },
    { key: 'preferred', label: 'Preferred equity', sign: 1, grp: 'claim' },
    { key: 'nci', label: 'Noncontrolling interests', sign: 1, grp: 'claim' },
    { key: 'otherClaims', label: 'Other debt-like claims', sign: 1, grp: 'claim' },
    { key: 'cash', label: 'Cash and cash equivalents', sign: -1, grp: 'asset', core: true },
    { key: 'sti', label: 'Short-term investments', sign: -1, grp: 'asset' },
    { key: 'otherNonop', label: 'Other non-operating assets', sign: -1, grp: 'asset' },
  ];
  // multiples: kind 'ev' (enterprise value numerator) or 'eq' (equity numerator)
  const MULTIPLES = {
    ev_rev: { label: 'EV / Revenue', kind: 'ev', metric: 'rev', periods: ['ttm', 'fy', 'ntm', 'fy1'] },
    ev_ebitda: { label: 'EV / EBITDA', kind: 'ev', metric: 'ebitda', periods: ['ttm', 'fy', 'ntm', 'fy1'] },
    ev_ebit: { label: 'EV / EBIT', kind: 'ev', metric: 'ebit', periods: ['ttm', 'fy', 'ntm', 'fy1'] },
    pe: { label: 'P / E', kind: 'eq', metric: 'eps', perShare: true, periods: ['ttm', 'fy', 'ntm', 'fy1'] },
    pb: { label: 'P / Book', kind: 'eq', metric: 'book', periods: ['cur'] },
    p_fcf: { label: 'Price / FCF', kind: 'eq', metric: 'fcf', periods: ['ttm', 'fy'] },
  };
  const mid = (id, p) => id + '@' + p;
  const splitMid = s => { const [id, p] = String(s).split('@'); return { id, p }; };
  const multLabel = (id, p) => { const M = MULTIPLES[id]; if (!M) return id; return p === 'cur' ? M.label : `${M.label} (${PERIODS[p] || p})`; };

  // ---------- values with overrides ----------
  // c.v[key] = { v, src, hist }   (v may be null: then the figure is missing)
  const val = (c, key) => { const r = c && c.v && c.v[key]; return r && isNum(r.v) ? r.v : null; };
  const has = (c, key) => val(c, key) !== null;

  // FX: financial statement amounts are in c.currency; the share price is in c.priceCurrency.
  // c.fx = { rate } = units of price currency per one unit of reporting currency.
  function fxOf(c) {
    const pc = c.priceCurrency || c.currency, rc = c.currency || c.priceCurrency;
    if (!pc || !rc || pc === rc) return { rate: 1, same: true };
    const r = c.fx && isNum(c.fx.rate) && c.fx.rate > 0 ? c.fx.rate : null;
    return { rate: r, same: false, from: rc, to: pc, missing: r === null };
  }

  // ---------- market capitalisation and share basis ----------
  function sharesOf(c, settings) {
    const basic = val(c, 'shares');
    if (!isNum(basic)) return { v: null, missing: ['shares'], basis: 'basic' };
    if ((settings && settings.shareBasis) === 'diluted') {
      const d = val(c, 'dilutive');
      if (!isNum(d)) return { v: null, missing: ['dilutive'], basis: 'diluted', basic };
      return { v: basic + d, basis: 'diluted', basic, dilutive: d };
    }
    return { v: basic, basis: 'basic', basic };
  }
  function marketCap(c, settings) {
    const price = val(c, 'price'), sh = sharesOf(c, settings);
    const missing = [].concat(isNum(price) ? [] : ['price'], sh.missing || []);
    if (missing.length) return { v: null, missing, price, shares: sh.v, basis: sh.basis };
    return { v: price * sh.v, price, shares: sh.v, basis: sh.basis, formula: `${price} × ${sh.v}` };
  }

  // ---------- enterprise value build ----------
  // Lines that are missing are reported as missing; cash must be present or confirmed (entered as 0).
  function lineIncluded(c, line, settings) {
    if (line.policy) { const o = c.inc && typeof c.inc[line.key] === 'boolean' ? c.inc[line.key] : null; return o !== null ? o : (settings && settings.leasePolicy) === 'include'; }
    if (line.key === 'sti') return !(c.inc && c.inc.sti === false);
    if (line.key === 'otherNonop') return !!(c.inc && c.inc.otherNonop);
    return !(c.inc && c.inc[line.key] === false);
  }
  function evBuild(c, settings) {
    const mc = marketCap(c, settings);
    const fx = fxOf(c);
    const lines = [], notReported = [], missing = mc.missing ? mc.missing.slice() : [];
    let net = 0; // net claims, in reporting currency
    EV_LINES.forEach(L => {
      const v = val(c, L.key), inc = lineIncluded(c, L, settings);
      lines.push({ key: L.key, label: L.label, sign: L.sign, v, included: inc && isNum(v), excluded: !inc, grp: L.grp });
      if (!inc) return;
      if (!isNum(v)) { if (L.core) missing.push(L.key); else notReported.push(L.key); return; }
      net += L.sign * v;
    });
    // no borrowing figure at all is not the same as no debt: it must be entered (0 if the company has none).
    // Finance leases alone do not count: a filer whose loans are untagged would otherwise look debt-free.
    const debtKeys = ['stBorrow', 'ltdCurrent', 'ltdNoncurrent'];
    if (debtKeys.every(k => !isNum(val(c, k)))) { missing.push('debt'); debtKeys.forEach(k => { const i = notReported.indexOf(k); if (i >= 0) notReported.splice(i, 1); }); }
    if (fx.missing) missing.push('fx');
    if (missing.length) return { v: null, mc, lines, net: null, missing, notReported, fx };
    const netPx = net * fx.rate;
    const ev = mc.v + netPx;
    return { v: ev, mc, lines, net, netPx, missing: [], notReported, fx };
  }

  // ---------- metrics with normalisation ----------
  // adjustments: c.adj = [{ id, metric, period, amount, type, reason, source, recurring }]; amount is added to the reported metric.
  function adjustmentsFor(c, metric, period) { return (c.adj || []).filter(a => a.metric === metric && a.period === period && isNum(a.amount)); }
  function metric(c, m, p, normalized) {
    if (m === 'book') { const v = val(c, 'equity'); return { v, reported: v, adj: 0, items: [] }; }
    const reported = val(c, m + '_' + p);
    if (!isNum(reported)) return { v: null, reported: null, adj: 0, items: [] };
    // EBITDA follows EBIT adjustments too when the analyst marks them as also affecting EBITDA
    const items = normalized ? adjustmentsFor(c, m, p) : [];
    const adj = items.reduce((a, b) => a + b.amount, 0);
    return { v: reported + adj, reported, adj, items };
  }

  // ---------- one multiple for one company ----------
  // status: 'ok' | 'nm' (not meaningful: zero/negative denominator or EV) | 'na' (data not available)
  function multiple(c, id, p, settings, opts = {}) {
    const M = MULTIPLES[id];
    if (!M) return { status: 'na', reason: 'Unknown multiple.' };
    const normalized = opts.normalized !== undefined ? opts.normalized : !(settings && settings.normalized === false);
    const met = metric(c, M.metric, p, normalized);
    const fx = fxOf(c);
    const mLabel = M.metric === 'book' ? 'book equity' : `${PERIODS[p] || p} ${METRICS[M.metric].label}`;
    if (!isNum(met.v)) return { status: 'na', reason: `${mLabel} is not available.`, metric: met };
    if (fx.missing) return { status: 'na', reason: `No exchange rate from ${fx.from} to ${fx.to}: the price and the financial statements are in different currencies.`, metric: met };
    const den = met.v * fx.rate;
    let num, numLabel, numObj;
    if (M.kind === 'ev') {
      const e = evBuild(c, settings); numObj = e;
      if (!isNum(e.v)) return { status: 'na', reason: 'Enterprise value cannot be calculated: ' + e.missing.join(', ') + ' missing.', metric: met };
      if (e.v <= 0) return { status: 'nm', reason: 'Enterprise value is zero or negative (cash exceeds market value plus claims). The multiple has no economic meaning.', metric: met, num: e.v };
      num = e.v; numLabel = 'Enterprise value';
    } else if (M.perShare) {
      num = val(c, 'price'); numLabel = 'Share price';
      if (!isNum(num)) return { status: 'na', reason: 'Share price is missing.', metric: met };
    } else {
      const mc = marketCap(c, settings); numObj = mc;
      if (!isNum(mc.v)) return { status: 'na', reason: 'Market capitalisation cannot be calculated: ' + mc.missing.join(', ') + ' missing.', metric: met };
      num = mc.v; numLabel = 'Market capitalisation';
    }
    if (den <= 0) return { status: 'nm', reason: `${mLabel} is ${den === 0 ? 'zero' : 'negative'}: a multiple of a ${den === 0 ? 'zero' : 'negative'} figure is not meaningful (N/M).`, metric: met, num };
    return { status: 'ok', v: num / den, num, den, numLabel, metric: met, numObj };
  }

  // ---------- statistics (PERCENTILE.INC / QUARTILE.INC convention) ----------
  function percentile(sorted, q) {
    const n = sorted.length; if (!n) return null; if (n === 1) return sorted[0];
    const h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  }
  function stats(values) {
    const xs = values.filter(isNum).slice().sort((a, b) => a - b);
    const n = xs.length;
    if (!n) return { n: 0, min: null, q1: null, mean: null, median: null, q3: null, max: null };
    return { n, min: xs[0], q1: percentile(xs, 0.25), mean: xs.reduce((a, b) => a + b, 0) / n, median: percentile(xs, 0.5), q3: percentile(xs, 0.75), max: xs[n - 1] };
  }
  // Tukey fences: an observation below Q1 − k·IQR or above Q3 + k·IQR is flagged. It is never removed automatically.
  function outlierFlags(values, k = 1.5) {
    const s = stats(values);
    if (s.n < 4) return { fences: null, flags: values.map(() => false), note: 'Fewer than four valid observations: no outlier test.' };
    const iqr = s.q3 - s.q1, lo = s.q1 - k * iqr, hi = s.q3 + k * iqr;
    return { fences: { lo, hi, iqr, k }, flags: values.map(v => isNum(v) && (v < lo || v > hi)) };
  }

  // ---------- peer sets ----------
  // group: 'core' (Core peers), 'all' (Core + Broader) or a custom group id
  function peerSet(model, group) {
    const g = group || (model.selection && model.selection.group) || 'core';
    const peers = model.peers || [];
    let list;
    if (g === 'core') list = peers.filter(p => p.status === 'core');
    else if (g === 'all') list = peers.filter(p => p.status === 'core' || p.status === 'broader');
    else { const cg = (model.groups || []).find(x => x.id === g); list = cg ? peers.filter(p => cg.peerIds.includes(p.id) && p.status !== 'excluded') : []; }
    return list;
  }
  const groupLabel = (model, g) => g === 'core' ? 'Core peers' : g === 'all' ? 'Core + Broader peers' : ((model.groups || []).find(x => x.id === g) || {}).name || 'Custom group';

  // One column of the comps table: each included peer's observation, its outlier flag, the analyst's
  // observation-level exclusion (with reason), and the statistics of the observations that count.
  function column(model, id, p, opts = {}) {
    const settings = model.settings || {};
    const peers = opts.peers || peerSet(model, opts.group);
    const key = mid(id, p);
    const obs = peers.map(c => {
      const m = multiple(c, id, p, settings, opts);
      const ex = c.excludeObs && c.excludeObs[key];
      return { id: c.id, ticker: c.ticker, name: c.name, m, excluded: !!ex, exReason: ex ? (ex.reason || '') : null };
    });
    const valid = obs.filter(o => o.m.status === 'ok');
    const vals = valid.map(o => o.m.v);
    const of = outlierFlags(vals, settings.outlierK || 1.5);
    valid.forEach((o, i) => { o.outlier = of.flags[i]; });
    const counted = valid.filter(o => !o.excluded);
    const st = stats(counted.map(o => o.m.v));
    return { id, p, key, label: multLabel(id, p), obs, stats: st, fences: of.fences, fenceNote: of.note || '', nm: obs.filter(o => o.m.status === 'nm').length, na: obs.filter(o => o.m.status === 'na').length, excludedObs: valid.filter(o => o.excluded).length };
  }

  // ---------- benchmark selection ----------
  const BENCH = { median: 'Peer median', mean: 'Peer mean', q1: '25th percentile', q3: '75th percentile', manual: 'Manually selected multiple', weighted: 'Custom peer weighting' };
  function benchmark(model, opts = {}) {
    const sel = Object.assign({ multiple: 'ev_ebitda', period: 'ttm', benchmark: 'median', premium: 0 }, model.selection || {}, opts.selection || {});
    const col = column(model, sel.multiple, sel.period, opts);
    let base = null, note = '';
    if (sel.benchmark === 'manual') { base = isNum(sel.manual) ? sel.manual : null; note = base === null ? 'Enter the multiple you selected.' : 'Analyst-selected multiple.'; }
    else if (sel.benchmark === 'weighted') {
      const w = sel.weights || {};
      const items = col.obs.filter(o => o.m.status === 'ok' && !o.excluded && isNum(w[o.id]) && w[o.id] > 0);
      const sw = items.reduce((a, o) => a + w[o.id], 0);
      base = sw > 0 ? items.reduce((a, o) => a + w[o.id] * o.m.v, 0) / sw : null;
      note = base === null ? 'Give at least one valid peer a positive weight.' : `Weighted average of ${items.length} peers (weights normalised to sum to 100%).`;
    } else { base = col.stats[sel.benchmark]; note = col.stats.n ? `${BENCH[sel.benchmark]} of ${col.stats.n} valid observations.` : 'No valid peer observations for this multiple.'; }
    const prem = isNum(sel.premium) ? sel.premium : 0;
    const selected = isNum(base) ? base * (1 + prem) : null;
    return { sel, col, base, premium: prem, selected, note, label: multLabel(sel.multiple, sel.period) };
  }

  // ---------- implied valuation for the target ----------
  // EV multiples: implied EV = multiple × target metric; equity = EV − claims + assets (the same lines and
  // inclusion choices as the target's own EV build); per share = equity ÷ shares (the model's share basis).
  // Equity multiples: P/E gives a per-share value directly (no bridge); P/B and P/FCF give equity value.
  function implied(model, mult, opts = {}) {
    const settings = model.settings || {};
    const t = model.target || {};
    const sel = Object.assign({}, model.selection || {}, opts.selection || {});
    const id = opts.multiple || sel.multiple || 'ev_ebitda', p = opts.period || sel.period || 'ttm';
    const M = MULTIPLES[id];
    const steps = [], warnings = [];
    const out = { id, p, label: multLabel(id, p), mult, steps, warnings, ev: null, equity: null, perShare: null, upside: null };
    if (!M) { out.error = 'Unknown multiple.'; return out; }
    if (!isNum(mult)) { out.error = 'No multiple selected yet.'; return out; }
    const normalized = !(settings.normalized === false);
    const met = isNum(opts.metricOverride) ? { v: opts.metricOverride, reported: opts.metricOverride, adj: 0, items: [] } : metric(t, M.metric, p, normalized);
    const fx = fxOf(t);
    out.metric = met;
    const mName = M.metric === 'book' ? 'Book equity' : `${PERIODS[p] || p} ${METRICS[M.metric].label}`;
    if (!isNum(met.v)) { out.error = `Target ${mName.toLowerCase()} is missing.`; return out; }
    if (fx.missing) { out.error = `No exchange rate from ${fx.from} to ${fx.to} for the target.`; return out; }
    if (met.v <= 0) { out.error = `Target ${mName.toLowerCase()} is ${met.v === 0 ? 'zero' : 'negative'} (${met.v}). A multiple of it gives no meaningful value: choose another multiple.`; out.nm = true; return out; }
    const metPx = met.v * fx.rate;
    const sh = sharesOf(t, settings);
    const price = val(t, 'price');
    if (M.kind === 'ev') {
      out.ev = mult * metPx;
      steps.push({ label: 'Implied enterprise value', formula: `${fmtX(mult)} × ${mName} ${fmtN(metPx)}`, v: out.ev });
      const e = evBuild(t, settings);
      const missingBridge = e.missing.filter(k => k !== 'price' && k !== 'shares' && k !== 'dilutive');
      if (missingBridge.length) { out.error = 'The equity bridge is incomplete: ' + missingBridge.join(', ') + ' missing.'; return out; }
      if (!isNum(e.net)) {
        // EV could not be built only because price/shares are missing: rebuild the net claims directly
        let net = 0; EV_LINES.forEach(L => { const v = val(t, L.key); if (lineIncluded(t, L, settings) && isNum(v)) net += L.sign * v; }); e.netPx = net * (fx.rate || 1); e.net = net;
      }
      out.bridge = e.lines.filter(l => l.included).map(l => ({ key: l.key, label: l.label, sign: l.sign, v: (-l.sign * l.v * fx.rate) || 0 }));
      out.notReported = e.notReported;
      out.equity = out.ev - e.netPx;
      steps.push({ label: 'Less net claims (debt and other claims − cash and non-operating assets)', formula: `${fmtN(out.ev)} − ${fmtN(e.netPx)}`, v: out.equity });
      if (!isNum(sh.v)) { out.error = 'Shares outstanding are missing' + (sh.missing && sh.missing.includes('dilutive') ? ' (diluted basis needs the net dilutive shares)' : '') + '.'; return out; }
      out.perShare = out.equity / sh.v;
      steps.push({ label: 'Implied value per share', formula: `${fmtN(out.equity)} ÷ ${fmtN(sh.v)} ${sh.basis} shares`, v: out.perShare });
      if (out.equity < 0) warnings.push('Implied equity value is negative: net claims exceed the implied enterprise value.');
    } else if (M.perShare) {
      out.perShare = mult * metPx;
      steps.push({ label: 'Implied value per share (equity multiple: no enterprise-to-equity bridge)', formula: `${fmtX(mult)} × ${mName} ${fmtN(metPx, 2)}`, v: out.perShare });
      if (isNum(sh.v)) { out.equity = out.perShare * sh.v; steps.push({ label: 'Implied equity value', formula: `${fmtN(out.perShare, 2)} × ${fmtN(sh.v)} ${sh.basis} shares`, v: out.equity }); }
      if (sh.basis === 'basic') warnings.push('P/E uses diluted EPS while the model share basis is basic shares: the implied equity value is shown for reference only.');
    } else {
      out.equity = mult * metPx;
      steps.push({ label: 'Implied equity value (equity multiple: no enterprise-to-equity bridge)', formula: `${fmtX(mult)} × ${mName} ${fmtN(metPx)}`, v: out.equity });
      if (!isNum(sh.v)) { out.error = 'Shares outstanding are missing.'; return out; }
      out.perShare = out.equity / sh.v;
      steps.push({ label: 'Implied value per share', formula: `${fmtN(out.equity)} ÷ ${fmtN(sh.v)} ${sh.basis} shares`, v: out.perShare });
    }
    if (isNum(price) && price > 0 && isNum(out.perShare)) { out.upside = out.perShare / price - 1; steps.push({ label: 'Upside / downside', formula: `(${fmtN(out.perShare, 2)} ÷ ${fmtN(price, 2)} − 1) × 100`, v: out.upside, pct: true }); }
    out.price = price; out.shares = sh;
    return out;
  }
  const fmtX = v => isNum(v) ? v.toFixed(2) + '×' : 'n/a';
  const fmtN = (v, d = 0) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'n/a';

  // ---------- valuation range ----------
  function range(model, opts = {}) {
    const b = benchmark(model, opts);
    const st = b.col.stats;
    const rows = [['q1', 'Lower quartile', st.q1], ['median', 'Median', st.median], ['q3', 'Upper quartile', st.q3]].map(([k, l, m]) => Object.assign({ key: k, name: l }, implied(model, m, { multiple: b.sel.multiple, period: b.sel.period })));
    const A = (model.selection && model.selection.analyst) || {};
    const arows = [['low', 'Analyst low', A.low], ['central', 'Analyst central', A.central], ['high', 'Analyst high', A.high]].filter(r => isNum(r[2])).map(([k, l, m]) => Object.assign({ key: k, name: l }, implied(model, m, { multiple: b.sel.multiple, period: b.sel.period })));
    return { b, rows, arows };
  }
  // football field across every multiple/period with at least one valid peer observation
  function footballRows(model) {
    const out = [];
    Object.entries(MULTIPLES).forEach(([id, M]) => M.periods.forEach(p => {
      const col = column(model, id, p);
      if (!col.stats.n) return;
      const lo = implied(model, col.stats.q1, { multiple: id, period: p }), md = implied(model, col.stats.median, { multiple: id, period: p }), hi = implied(model, col.stats.q3, { multiple: id, period: p });
      if (!isNum(lo.perShare) || !isNum(hi.perShare)) return;
      out.push({ id, p, label: multLabel(id, p), lo: Math.min(lo.perShare, hi.perShare), hi: Math.max(lo.perShare, hi.perShare), mid: md.perShare, n: col.stats.n });
    }));
    return out;
  }

  // ---------- sensitivity ----------
  const steps = (center, step, n) => { const out = []; const h = Math.floor(n / 2); for (let i = -h; i <= h; i++) out.push(center + i * step); return out; };
  // multiple (rows) × change in the target metric (columns, as fractions: −0.1 = −10%)
  function sensGrid(model, cfg) {
    const b = benchmark(model);
    const id = cfg.multiple || b.sel.multiple, p = cfg.period || b.sel.period;
    const M = MULTIPLES[id];
    const met = metric(model.target || {}, M.metric, p, !((model.settings || {}).normalized === false));
    const center = isNum(cfg.center) ? cfg.center : b.selected;
    if (!isNum(center) || !isNum(met.v)) return { error: !isNum(center) ? 'Select a multiple first.' : 'The target metric is missing.', rows: [], cols: [] };
    const mults = steps(center, cfg.multStep || Math.max(0.1, Math.round(center * 0.1 * 10) / 10), cfg.multN || 5).filter(m => m > 0);
    const deltas = steps(0, cfg.metStep || 0.05, cfg.metN || 5);
    const grid = mults.map(m => deltas.map(d => implied(model, m, { multiple: id, period: p, metricOverride: met.v * (1 + d) })));
    return { id, p, label: multLabel(id, p), mults, deltas, metric: met.v, grid };
  }
  // forward growth: target forward metric = TTM metric × (1 + g), valued at a forward multiple
  function growthGrid(model, cfg) {
    const b = benchmark(model);
    const id = cfg.multiple || b.sel.multiple, M = MULTIPLES[id];
    const base = metric(model.target || {}, M.metric, 'ttm', !((model.settings || {}).normalized === false));
    const center = isNum(cfg.center) ? cfg.center : b.selected;
    if (!isNum(center) || !isNum(base.v)) return { error: !isNum(center) ? 'Select a multiple first.' : 'The target TTM metric is missing.', rows: [], cols: [] };
    const mults = steps(center, cfg.multStep || Math.max(0.1, Math.round(center * 0.1 * 10) / 10), cfg.multN || 5).filter(m => m > 0);
    const gs = steps(isNum(cfg.gCenter) ? cfg.gCenter : 0.05, cfg.gStep || 0.025, cfg.gN || 5);
    const grid = mults.map(m => gs.map(g => implied(model, m, { multiple: id, period: 'ttm', metricOverride: base.v * (1 + g) })));
    return { id, label: M.label + ' × forward metric', mults, gs, metric: base.v, grid };
  }
  // peer selection: the implied value with each included peer removed in turn, and for each peer group
  function peerSens(model) {
    const b = benchmark(model);
    const peers = peerSet(model);
    const rows = peers.map(pr => {
      const others = peers.filter(x => x !== pr);
      const bb = benchmark(model, { peers: others });
      const imp = implied(model, bb.selected, { multiple: b.sel.multiple, period: b.sel.period });
      return { id: pr.id, ticker: pr.ticker, name: pr.name, mult: bb.selected, perShare: imp.perShare, n: bb.col.stats.n };
    });
    const groups = ['core', 'all'].concat((model.groups || []).map(g => g.id)).map(g => {
      const bb = benchmark(model, { group: g });
      const imp = implied(model, bb.selected, { multiple: b.sel.multiple, period: b.sel.period });
      return { group: g, label: groupLabel(model, g), mult: bb.selected, perShare: imp.perShare, n: bb.col.stats.n };
    });
    return { base: b, rows, groups };
  }

  // ---------- target's own multiple (shown separately; never part of the peer statistics) ----------
  function targetMultiple(model, id, p) { return multiple(model.target || {}, id, p, model.settings || {}); }

  // ---------- DCF comparison ----------
  function dcfCompare(dcf, comps, price) {
    const d = (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b - 1 : null;
    return {
      dcfVsPrice: d(dcf, price), compsVsPrice: d(comps, price), dcfVsComps: d(dcf, comps),
      gap: isNum(dcf) && isNum(comps) ? dcf - comps : null,
    };
  }

  // ---------- TTM and NTM helpers ----------
  // TTM = latest fiscal year + current year-to-date − prior-year comparable year-to-date
  function ttm(fy, ytd, priorYtd) { return isNum(fy) && isNum(ytd) && isNum(priorYtd) ? fy + ytd - priorYtd : null; }
  // NTM calendarisation: share of the current fiscal year (FY+1) still ahead of the valuation date, then FY+2.
  // fy0End: end of the last reported fiscal year; fy1End: end of FY+1; asOf: valuation date (ISO strings).
  function ntm(fy1, fy2, fy0End, fy1End, asOf) {
    if (!isNum(fy1) || !isNum(fy2) || !fy1End || !asOf) return { v: null, note: 'NTM needs FY+1 and FY+2 estimates and their fiscal year-end.' };
    const e1 = new Date(fy1End), d = new Date(asOf);
    const e0 = fy0End ? new Date(fy0End) : new Date(e1.getTime() - 365 * 864e5);
    const len = (e1 - e0) / 864e5, left = (e1 - d) / 864e5;
    if (!(len > 0)) return { v: null, note: 'Fiscal year dates are inconsistent.' };
    if (left < 0) return { v: null, note: `The valuation date ${asOf} is after the FY+1 year-end ${fy1End}: roll the estimates forward.` };
    const w1 = Math.min(1, left / len), w2 = 1 - w1;
    return { v: w1 * fy1 + w2 * fy2, w1, w2, note: `NTM = ${(w1 * 100).toFixed(1)}% × FY+1 + ${(w2 * 100).toFixed(1)}% × FY+2 (calendarised to ${asOf}).` };
  }

  // ---------- comparability criteria (transparent; never proof of comparability) ----------
  const CRITERIA = [
    { key: 'industry', label: 'Same industry classification', test: (t, p) => t.industry && p.industry ? (t.industry === p.industry) : null },
    { key: 'size', label: 'Revenue within 0.25× to 4× of the target', test: (t, p) => { const a = val(t, 'rev_ttm') ?? val(t, 'rev_fy'), b = val(p, 'rev_ttm') ?? val(p, 'rev_fy'); return isNum(a) && isNum(b) && a > 0 && b > 0 ? (b / a >= 0.25 && b / a <= 4) : null; } },
    { key: 'growth', label: 'Revenue growth within ±10 percentage points', test: (t, p) => { const a = growth(t), b = growth(p); return isNum(a) && isNum(b) ? Math.abs(a - b) <= 0.10 : null; } },
    { key: 'margin', label: 'EBITDA margin within ±10 percentage points', test: (t, p) => { const a = margin(t, 'ebitda'), b = margin(p, 'ebitda'); return isNum(a) && isNum(b) ? Math.abs(a - b) <= 0.10 : null; } },
    { key: 'capex', label: 'CapEx / revenue within ±5 percentage points', test: (t, p) => { const a = margin(t, 'capex'), b = margin(p, 'capex'); return isNum(a) && isNum(b) ? Math.abs(a - b) <= 0.05 : null; } },
  ];
  function growth(c) {
    const a = val(c, 'rev_ttm'), b = val(c, 'rev_ttm_prior');
    if (isNum(a) && isNum(b) && b > 0) return a / b - 1;
    const f = val(c, 'rev_fy'), g = val(c, 'rev_fy_prior');
    return isNum(f) && isNum(g) && g > 0 ? f / g - 1 : null;
  }
  function margin(c, m, p) {
    const per = p || (has(c, m + '_ttm') && has(c, 'rev_ttm') ? 'ttm' : 'fy');
    const r = val(c, 'rev_' + per), x = metric(c, m, per, true).v;
    return isNum(r) && r > 0 && isNum(x) ? x / r : null;
  }
  function comparability(target, peer) {
    const res = CRITERIA.map(k => ({ key: k.key, label: k.label, met: k.test(target, peer) }));
    const tested = res.filter(r => r.met !== null);
    return { res, met: tested.filter(r => r.met).length, tested: tested.length };
  }

  return { METRICS, PERIODS, EV_LINES, MULTIPLES, BENCH, CRITERIA, mid, splitMid, multLabel, val, has, fxOf, sharesOf, marketCap, lineIncluded, evBuild, adjustmentsFor, metric, multiple, percentile, stats, outlierFlags, peerSet, groupLabel, column, benchmark, implied, range, footballRows, sensGrid, growthGrid, peerSens, targetMultiple, dcfCompare, ttm, ntm, growth, margin, comparability, isNum };
})();
if (typeof module !== 'undefined') module.exports = CompsEngine;
