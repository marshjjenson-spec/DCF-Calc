// ===== ANALYSIS HELPERS =====
// Read-only calculations for the screens: the TTM column, historical anchors for each forecast input,
// consistency checks, the effect of an input on value, and estimators. Nothing here writes to the model
// or changes how the valuation is calculated; the engine stays the only place value is computed.
const DCFAnalysis = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const SC = ['Bear', 'Base', 'Bull'];
  const div = (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b : null;
  const mean = xs => { const v = xs.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const eng = () => (typeof DCF !== 'undefined' ? DCF : require('./engine.js'));
  const mdl = () => (typeof DCFModel !== 'undefined' ? DCFModel : require('./model.js'));

  // ---- TTM in the historical table's own form ($ mm, cash outflows negative) ----
  function ttmColumn(model) {
    const T = mdl().ttmOf(model); if (!T || !T.items) return null;
    const I = T.items, V = k => I[k] && isNum(I[k].value) ? I[k].value : null;
    const v = {
      rev: V('rev'), gp: V('gp'), da: V('da'), interest: V('interest'), sbc: V('sbc'), dnwc: V('dnwc'),
      capex: isNum(V('capex')) ? -V('capex') : null,
      opex: isNum(V('gp')) && isNum(V('ebitda')) ? V('gp') - V('ebitda') : null,
    };
    return { end: T.end, isFY: !!T.isFY, manual: !!T.manual, label: T.isFY ? 'TTM = FY' : 'TTM', v, items: I, prior: T.prior, quarter: T.quarter, provider: T.provider, at: T.at };
  }
  // A TTM built by hand: FY + YTD − prior YTD for each line the analyst typed. Lines left blank stay blank.
  const MANUAL_KEYS = ['rev', 'cogs', 'gp', 'ebit', 'da', 'interest', 'ebt', 'tax', 'ni', 'cfo', 'capex', 'sbc', 'dnwc'];
  function manualTTM(tm) {
    if (!tm) return null;
    const items = {}, ytd = tm.ytdLabel || 'YTD';
    MANUAL_KEYS.forEach(k => {
      const r = tm.rows && tm.rows[k]; if (!r) return;
      const ok = [r.fy, r.ytd, r.prior].every(isNum);
      if (!ok) return;
      const value = r.fy + r.ytd - r.prior;
      items[k] = { metric: k, cat: 'calc', periodType: 'TTM', value, end: tm.end || null, periodText: 'twelve months ended ' + (tm.end || '(date not set)'), provider: 'Calculated from figures you entered',
        method: `TTM = FY ended ${tm.fyEnd || '?'} (${fmt(r.fy)}) + ${ytd} ${tm.end || '?'} (${fmt(r.ytd)}) − ${ytd} ${tm.priorEnd || '?'} (${fmt(r.prior)}) = ${fmt(value)} $mm. Calculated from figures you typed.`,
        parts: [{ metric: 'FY', value: r.fy, end: tm.fyEnd, cat: 'manual', url: tm.fyUrl || null }, { metric: 'YTD', value: r.ytd, end: tm.end, cat: 'manual', url: tm.ytdUrl || null }, { metric: 'Prior YTD', value: r.prior, end: tm.priorEnd, cat: 'manual', url: tm.ytdUrl || null }] };
    });
    const V = k => items[k] ? items[k].value : null;
    if (!items.gp && isNum(V('rev')) && isNum(V('cogs'))) items.gp = { cat: 'calc', value: V('rev') - V('cogs'), end: tm.end, method: 'TTM revenue − TTM cost of revenue' };
    if (isNum(V('ebit')) && isNum(V('da'))) items.ebitda = { cat: 'calc', value: V('ebit') + V('da'), end: tm.end, method: 'TTM operating income + TTM D&A (calculated EBITDA)' };
    if (isNum(V('cfo')) && isNum(V('capex'))) items.fcf = { cat: 'calc', value: V('cfo') - V('capex'), end: tm.end, method: 'TTM operating cash flow − TTM capital expenditures' };
    if (!items.rev) return null;
    return { end: tm.end || null, isFY: false, manual: true, items, provider: 'Entered by you' };
  }
  const fmt = v => isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
  // Check the three dates of a hand-built TTM line up
  function manualTTMChecks(tm) {
    const out = [];
    if (!tm) return out;
    const d = (a, b) => (new Date(b) - new Date(a)) / 864e5;
    if (!tm.end || !tm.priorEnd || !tm.fyEnd) out.push({ level: 'warn', text: 'Enter all three period end dates so the twelve months can be checked.' });
    else {
      if (Math.abs(d(tm.priorEnd, tm.end) - 365) > 8) out.push({ level: 'bad', text: `The prior-year period (${tm.priorEnd}) should end one year before the current period (${tm.end}).` });
      if (!(tm.fyEnd < tm.end && tm.fyEnd > tm.priorEnd)) out.push({ level: 'bad', text: `The fiscal year (${tm.fyEnd}) should end between the prior-year period and the current period. Otherwise months are counted twice or left out.` });
    }
    return out;
  }

  // ---- historical series: FY oldest first plus TTM ----
  function series(model) {
    const H = model.hist, n = (k, i) => isNum(H[k] && H[k][i]) ? H[k][i] : null;
    const ebitda = i => isNum(n('gp', i)) && isNum(n('opex', i)) ? H.gp[i] - H.opex[i] : null;
    const fy = [0, 1, 2, 3, 4].map(i => ({ label: H.years[i] != null ? 'FY' + H.years[i] : null, rev: n('rev', i), gp: n('gp', i), ebitda: ebitda(i), da: n('da', i), capex: isNum(n('capex', i)) ? -H.capex[i] : null, dnwc: n('dnwc', i), sbc: n('sbc', i), interest: n('interest', i) }));
    const tc = ttmColumn(model);
    const ttm = tc && isNum(tc.v.rev) ? { label: tc.isFY ? 'TTM (= FY)' : 'TTM to ' + tc.end, rev: tc.v.rev, gp: tc.v.gp, ebitda: tc.items.ebitda ? tc.items.ebitda.value : null, da: tc.v.da, capex: isNum(tc.v.capex) ? -tc.v.capex : null, dnwc: tc.v.dnwc, sbc: tc.v.sbc, interest: tc.v.interest, priorRev: tc.prior && tc.prior.value, end: tc.end, isFY: tc.isFY } : null;
    return { fy, ttm };
  }

  // ---- historical anchors for each forecast input ----
  // Returns { key: { rows:[{label, v, note}], latestFY, ttm, avg3, avg5, hi, lo, trend, unit, note } }
  function anchors(model) {
    const { fy, ttm } = series(model);
    const pctOf = (a, b) => fy.map(y => div(y[a], y[b]));
    const ttmPct = (a, b) => ttm ? div(ttm[a], ttm[b]) : null;
    const yoy = fy.map((y, i) => i && isNum(y.rev) && isNum(fy[i - 1].rev) && fy[i - 1].rev ? y.rev / fy[i - 1].rev - 1 : null);
    const pack = (vals, ttmV, unit, extra = {}) => {
      const last = (() => { for (let i = 4; i >= 0; i--) if (isNum(vals[i])) return { v: vals[i], i }; return null; })();
      const real = vals.filter(isNum);
      const last3 = vals.slice(2).filter(isNum), last5 = real;
      let trend = null;
      if (last3.length >= 3) { const d = last3[2] - last3[0]; const scale = unit === 'x' ? 0.1 : 0.005; trend = Math.abs(d) < scale ? 'flat' : d > 0 ? 'rising' : 'falling'; }
      return Object.assign({ unit, years: fy.map(y => y.label), vals, latestFY: last ? last.v : null, latestLabel: last ? fy[last.i].label : null, ttm: ttmV, ttmLabel: ttm ? ttm.label : null, avg3: last3.length === 3 ? mean(last3) : null, avg5: last5.length === 5 ? mean(last5) : null, hi: real.length ? Math.max(...real) : null, lo: real.length ? Math.min(...real) : null, trend, n: real.length }, extra);
    };
    const out = {};
    // revenue growth
    const r = fy.map(y => y.rev);
    const cagr = (a, b, yrs) => isNum(a) && isNum(b) && a > 0 && b > 0 ? Math.pow(b / a, 1 / yrs) - 1 : null;
    const ttmG = ttm && isNum(ttm.priorRev) && ttm.priorRev ? ttm.rev / ttm.priorRev - 1 : null;
    const Q = (mdl().ttmOf(model) || {}).quarter;
    const g = pack(yoy, ttmG, 'pct', {
      cagr3: cagr(r[1], r[4], 3), cagr4: cagr(r[0], r[4], 4), cagr5: null,
      quarterYoY: Q && isNum(Q.yoy) ? Q.yoy : null, quarterEnd: Q ? Q.end : null,
      accel: isNum(yoy[4]) && isNum(yoy[3]) ? yoy[4] - yoy[3] : null,
      ttmVsFY: isNum(ttmG) && isNum(yoy[4]) ? ttmG - yoy[4] : null,
      note: 'Five fiscal years give four year-on-year growth rates. A five-year CAGR needs six fiscal years, so it is shown as not available rather than estimated.' });
    out.g1 = out.g2 = out.g3 = g;
    out.gm1 = out.gm5 = out.gm10 = pack(pctOf('gp', 'rev'), ttmPct('gp', 'rev'), 'pct');
    out.em1 = out.em5 = out.em10 = out.tem = pack(pctOf('ebitda', 'rev'), ttmPct('ebitda', 'rev'), 'pct', { note: 'EBITDA here is calculated: gross profit − operating expenses excluding D&A (equal to operating income + D&A). It is not the company\'s "adjusted EBITDA", which usually adds back stock-based compensation and other items.' });
    out.da = pack(pctOf('da', 'rev'), ttmPct('da', 'rev'), 'pct');
    out.capex1 = out.capex2 = out.capex3 = pack(pctOf('capex', 'rev'), ttmPct('capex', 'rev'), 'pct', { note: 'Cash paid for property and equipment from the cash flow statement. Assets acquired under finance leases are not in this line, so for lease-heavy companies true investment is higher.' });
    // NWC: forecast input = increase in NWC ÷ increase in revenue (positive = cash invested). Historical cash flow sign is the opposite.
    const nwcR = fy.map((y, i) => i && isNum(y.dnwc) && isNum(y.rev) && isNum(fy[i - 1].rev) && y.rev !== fy[i - 1].rev ? -y.dnwc / (y.rev - fy[i - 1].rev) : null);
    out.nwc = pack(nwcR, null, 'pct', { note: 'Historical ratio = −(change in NWC on the cash flow statement) ÷ (change in revenue). The minus sign turns the cash flow sign (investment negative) into the forecast sign (investment positive). Ratios jump around when revenue barely changes.' });
    // tax: reported effective rate where the filing data is loaded
    const fin = (model.fin && model.fin.years) || [];
    const effFY = fin.slice().reverse().map(y => y && y.values ? div(y.values.tax, y.values.ebt) : null);
    while (effFY.length < 5) effFY.unshift(null);
    const tt = (mdl().ttmOf(model) || {}).items;
    out.tax = pack(effFY.slice(-5), tt && tt.tax && tt.ebt ? div(tt.tax.value, tt.ebt.value) : null, 'pct', { note: 'Effective rate = income tax expense ÷ pre-tax income, from the filings. It includes one-off items; the cash tax rate (cash taxes paid ÷ pre-tax income) can be very different. Not available unless the SEC company facts file is loaded.' });
    out.sbc = pack(pctOf('sbc', 'rev'), ttmPct('sbc', 'rev'), 'pct');
    // marginal sales-to-capital: change in revenue ÷ net reinvestment (CapEx − D&A + increase in NWC), acquisitions excluded
    const reinv = fy.map(y => isNum(y.capex) && isNum(y.da) ? y.capex - y.da + (isNum(y.dnwc) ? -y.dnwc : 0) : null);
    const s2c = fy.map((y, i) => i && isNum(reinv[i]) && reinv[i] > 0 && isNum(y.rev) && isNum(fy[i - 1].rev) ? (y.rev - fy[i - 1].rev) / reinv[i] : null);
    const sumRe = reinv.slice(1).every(isNum) ? reinv.slice(1).reduce((a, b) => a + b, 0) : null;
    out.s2c = pack(s2c, null, 'x', { cumulative: isNum(sumRe) && sumRe > 0 && isNum(r[0]) && isNum(r[4]) ? (r[4] - r[0]) / sumRe : null,
      note: 'Approximation: change in revenue ÷ (CapEx − D&A + increase in NWC) in the same year. Acquisitions are not in the imported data and are left out. A year with little or negative net reinvestment gives no ratio.' });
    out.acq = pack([null, null, null, null, null], null, 'pct', { note: 'Acquisitions are not in the imported data. Find "Acquisitions, net of cash acquired" in the investing section of the cash flow statement for each year.' });
    return out;
  }

  // ---- consistency checks across inputs (warnings only; nothing is changed) ----
  function consistency(model, all) {
    const I = model.inputs, out = [];
    const v = (k, s) => I[k] && typeof I[k] === 'object' ? I[k][s] : I[k];
    const pct = x => (x * 100).toFixed(1) + '%';
    const A = anchors(model);
    SC.forEach(s => {
      [['1', 'year 1'], ['5', 'year 5'], ['10', 'year 10']].forEach(([n, l]) => {
        const gm = v('gm' + n, s), em = v('em' + n, s);
        if (isNum(gm) && isNum(em) && em > gm) out.push({ level: 'bad', key: 'em' + n, s, text: `${s}: EBITDA margin in ${l} (${pct(em)}) is above gross margin (${pct(gm)}). EBITDA is gross profit minus operating costs, so it cannot exceed gross profit unless other income is included.` });
      });
      const g1 = v('g1', s), cx = v('capex1', s), da = v('da', s), nwc = v('nwc', s);
      if (isNum(g1) && g1 > 0.08 && isNum(cx) && isNum(da) && cx <= da && (!isNum(nwc) || nwc <= 0)) out.push({ level: 'warn', key: 'capex1', s, text: `${s}: revenue grows ${pct(g1)} a year in years 1–3, but CapEx (${pct(cx)}) is no more than D&A (${pct(da)}) and working capital adds nothing. Growth usually needs net investment.` });
      const c3 = v('capex3', s);
      if (isNum(c3) && isNum(da) && c3 < da) out.push({ level: 'warn', key: 'capex3', s, text: `${s}: CapEx in years 8–10 (${pct(c3)}) is below D&A (${pct(da)}). The asset base would shrink while revenue keeps growing.` });
      if (isNum(nwc) && (nwc < -0.5 || nwc > 1)) out.push({ level: 'warn', key: 'nwc', s, text: `${s}: change in NWC of ${pct(nwc)} of the change in revenue is unusual. Check the sign: positive means cash invested in working capital.` });
      const an = A.nwc.avg3;
      if (isNum(nwc) && isNum(an) && Math.abs(an) > 0.02 && Math.sign(nwc) !== Math.sign(an) && Math.abs(Math.abs(nwc) / Math.abs(an) - 1) < 0.25) out.push({ level: 'warn', key: 'nwc', s, text: `${s}: the NWC input (${pct(nwc)}) has the opposite sign to the 3-year historical ratio (${pct(an)}) with about the same size. The cash flow statement sign may have been copied without flipping it.` });
      const tax = v('tax', s), nol = v('nol', s);
      if (isNum(tax) && isNum(nol) && nol > tax) out.push({ level: 'bad', key: 'nol', s, text: `${s}: the NOL benefit (${pct(nol)}) is larger than the tax rate (${pct(tax)}), which would make taxes negative.` });
      const acq = v('acq', s);
      if (isNum(acq) && acq > 0 && isNum(cx) && A.capex1.avg3 && cx > A.capex1.avg3 * 1.5) out.push({ level: 'info', key: 'acq', s, text: `${s}: acquisitions (${pct(acq)}) are added on top of CapEx (${pct(cx)}). If your CapEx figure already includes acquisition spending, it is counted twice.` });
      const tg = v('tg', s), rf = v('rf', s), tem = v('tem', s), em10 = v('em10', s), troic = v('troic', s);
      if (isNum(tg) && isNum(rf) && tg > rf) out.push({ level: 'warn', key: 'tg', s, text: `${s}: terminal growth (${pct(tg)}) is above the risk-free rate (${pct(rf)}). Over the long run few companies outgrow the economy.` });
      if (isNum(tem) && isNum(em10) && Math.abs(tem - em10) > 0.05) out.push({ level: 'info', key: 'tem', s, text: `${s}: the terminal EBITDA margin (${pct(tem)}) differs from year 10 (${pct(em10)}) by more than 5 points. The terminal year then is not a steady continuation of year 10.` });
      const r = all && all.scen && all.scen[s];
      if (r && r.ok && isNum(troic) && troic < r.waccUsed) out.push({ level: 'info', key: 'troic', s, text: `${s}: terminal ROIC (${pct(troic)}) is below WACC (${pct(r.waccUsed)}), so growth after year 10 destroys value.` });
      const s2c = v('s2c', s);
      if (r && r.ok && isNum(s2c) && r.years[0] && isNum(r.years[0].roic) && (r.years[0].roic > 1 || r.years[0].roic < 0)) out.push({ level: 'info', key: 's2c', s, text: `${s}: the sales-to-capital ratio of ${s2c.toFixed(2)}× gives a year-1 ROIC of ${pct(r.years[0].roic)}. Check the ratio against the history.` });
    });
    // probability and scenario order
    if (all && SC.every(s => all.scen[s] && all.scen[s].ok)) {
      const [b, m, u] = SC.map(s => all.scen[s].perShare);
      if (!(b <= m && m <= u)) out.push({ level: 'warn', key: 'scenarios', text: `Value per share is not ordered Bear ≤ Base ≤ Bull (${b.toFixed(2)}, ${m.toFixed(2)}, ${u.toFixed(2)}). Check that each scenario's inputs tell one consistent story.` });
    }
    // base period and balance sheet timing
    const bi = mdl().baseInfo(model);
    bi.warnings.forEach(w => out.push({ level: w.level || 'warn', key: 'base', text: w.text }));
    if (bi.mode === 'ttm' && model.ttm && model.ttm.end) {
      const bs = model.sources && model.sources.cash && model.sources.cash.end;
      if (bs && bs !== model.ttm.end) out.push({ level: 'info', key: 'base', text: `The TTM period ends ${model.ttm.end}, the balance sheet is as of ${bs}. Using the same date for both keeps cash and cash flows from overlapping.` });
    }
    return out;
  }

  // ---- effect of one input on value: re-runs the engine with a bump, nothing is saved ----
  function effect(model, key, s, delta) {
    const { inp } = mdl().engineInputs(model);
    const base = eng().run(inp, s, model.mode);
    if (!base.ok) return null;
    const t = JSON.parse(JSON.stringify(inp));
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) { if (t[k] && typeof t[k] === 'object') { if (!isNum(t[k][s])) return null; t[k][s] += delta; } else { if (!isNum(t[k])) return null; t[k] += delta; } }
    const r = eng().run(t, s, model.mode);
    if (!r.ok) return null;
    return { from: base.perShare, to: r.perShare, diff: r.perShare - base.perShare, pct: r.perShare / base.perShare - 1, delta, evFrom: base.ev, evTo: r.ev };
  }

  // ---- estimators (hypothetical: nothing is written back) ----
  function revenuePath(rev0, rates) {
    const out = []; let prev = rev0;
    if (!isNum(rev0)) return out;
    for (let i = 0; i < 10; i++) { const g = rates[i < 3 ? 0 : i < 7 ? 1 : 2]; if (!isNum(g)) break; const rev = prev * (1 + g); out.push({ t: i + 1, g, rev, add: rev - prev }); prev = rev; }
    return out;
  }
  // straight-line path between years 1, 5 and 10 (the engine's formula)
  function marginPath(a, b, c) { return Array.from({ length: 10 }, (_, i) => [a, b, c].every(isNum) ? (i < 5 ? a + i / 4 * (b - a) : b + (i - 4) / 5 * (c - b)) : null); }
  // NOL: tax-rate reduction over years 1–3 = min(NOL, Σ EBIT 1–3) × tax rate ÷ Σ EBIT 1–3
  function nolBenefit(nol, ebit3, tax) {
    if (![nol, ebit3, tax].every(isNum) || ebit3 <= 0 || nol < 0) return null;
    const used = Math.min(nol, ebit3);
    return { used, saved: used * tax, rateCut: used * tax / ebit3, leftover: nol - used };
  }
  // scenario overview from the engine results
  function scenarioTable(all) {
    return SC.map(s => { const r = all.scen[s]; if (!r || !r.ok) return { s, ok: false }; const Y = r.years; return { s, ok: true, rev1: Y[0].rev, rev5: Y[4].rev, rev10: Y[9].rev, ebit1: Y[0].ebit, ebit10: Y[9].ebit, fcf1: Y[0].fcff, fcf10: Y[9].fcff, ev: r.ev, perShare: r.perShare, upside: r.upside, tvShare: r.tvShare }; });
  }

  // ---- WACC calculators (read-only; results are copied into inputs only by an explicit click) ----
  // Prices: [{date:'YYYY-MM-DD', close:number}] adjusted closes. Returns are aligned on dates both series have.
  function parsePrices(text) {
    const out = [], bad = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const t = line.trim(); if (!t) return;
      const c = t.split(/[,;\t]/).map(x => x.trim().replace(/^"|"$/g, ''));
      if (c.length < 2) { bad.push(i + 1); return; }
      const d = c[0], v = Number(c[c.length - 1].replace(/[$,]/g, ''));
      const ds = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : (() => { const x = new Date(d); return isNaN(x) ? null : x.toISOString().slice(0, 10); })();
      if (!ds || !isNum(v) || v <= 0) { if (i > 0 || !/date/i.test(t)) bad.push(i + 1); return; }
      out.push({ date: ds, close: v });
    });
    out.sort((a, b) => a.date.localeCompare(b.date));
    return { prices: out, badLines: bad };
  }
  function regressionBeta(stock, market, opts = {}) {
    const S = new Map(stock.map(p => [p.date, p.close])), M = new Map(market.map(p => [p.date, p.close]));
    const dates = stock.map(p => p.date).filter(d => M.has(d));
    const warn = [];
    const dropped = stock.length + market.length - 2 * dates.length;
    if (dropped > 0) warn.push(`${dropped} observation${dropped > 1 ? 's' : ''} had no matching date in the other series and ${dropped > 1 ? 'were' : 'was'} left out.`);
    const rs = [], rm = [];
    for (let i = 1; i < dates.length; i++) {
      const a = S.get(dates[i]) / S.get(dates[i - 1]) - 1, b = M.get(dates[i]) / M.get(dates[i - 1]) - 1;
      rs.push(a); rm.push(b);
      if (Math.abs(a) > 0.4) warn.push(`Stock return of ${(a * 100).toFixed(0)}% ending ${dates[i]}: check for a split or other corporate action in an unadjusted price series.`);
    }
    const n = rs.length;
    if (n < 3) return { ok: false, n, warn: warn.concat('Need at least four matching dates.') };
    const ms = mean(rs), mm = mean(rm);
    let cov = 0, vm = 0, vs = 0;
    for (let i = 0; i < n; i++) { cov += (rs[i] - ms) * (rm[i] - mm); vm += (rm[i] - mm) ** 2; vs += (rs[i] - ms) ** 2; }
    cov /= (n - 1); vm /= (n - 1); vs /= (n - 1);
    if (!(vm > 0)) return { ok: false, n, warn: warn.concat('The market series does not vary.') };
    const beta = cov / vm, r2 = (cov * cov) / (vm * vs);
    const alpha = ms - beta * mm;
    let sse = 0; for (let i = 0; i < n; i++) sse += (rs[i] - alpha - beta * rm[i]) ** 2;
    const se = n > 2 ? Math.sqrt(sse / (n - 2) / (vm * (n - 1))) : null;
    if (n < 24) warn.push(`Only ${n} returns: the estimate is imprecise. 60 monthly or 104 weekly returns are common choices.`);
    // stability: compare the two halves
    let halves = null;
    if (n >= 20) { const h = Math.floor(n / 2); const b1 = regressionBeta(dates.slice(0, h + 1).map(d => ({ date: d, close: S.get(d) })), dates.slice(0, h + 1).map(d => ({ date: d, close: M.get(d) }))), b2 = regressionBeta(dates.slice(h).map(d => ({ date: d, close: S.get(d) })), dates.slice(h).map(d => ({ date: d, close: M.get(d) }))); if (b1.ok && b2.ok) { halves = [b1.beta, b2.beta]; if (Math.abs(b1.beta - b2.beta) > 0.4) warn.push(`Beta was ${b1.beta.toFixed(2)} in the first half of the period and ${b2.beta.toFixed(2)} in the second: unstable.`); } }
    return { ok: true, beta, adjusted: 0.67 * beta + 0.33, r2, se, n, from: dates[0], to: dates[dates.length - 1], cov, varM: vm, halves, warn };
  }
  const relever = (bu, t, de) => [bu, t, de].every(isNum) ? bu * (1 + (1 - t) * de) : null;
  const unlever = (bl, t, de) => [bl, t, de].every(isNum) ? bl / (1 + (1 - t) * de) : null;
  function weightedKd(tranches) {
    const ok = (tranches || []).filter(x => isNum(x.amt) && x.amt > 0 && isNum(x.y));
    const tot = ok.reduce((a, x) => a + x.amt, 0);
    return ok.length ? { kd: ok.reduce((a, x) => a + x.amt * x.y, 0) / tot, total: tot, n: ok.length } : null;
  }
  const coverage = (ebit, interest) => isNum(ebit) && isNum(interest) && interest > 0 ? ebit / interest : null;
  const histRate = (interest, d0, d1) => isNum(interest) && isNum(d0) && isNum(d1) && d0 + d1 > 0 ? interest / ((d0 + d1) / 2) : null;
  // descriptive market-cap labels in common use (not size-premium groups)
  function sizeLabel(mcap) {
    if (!isNum(mcap)) return null;
    return mcap < 300 ? 'Micro-cap' : mcap < 2000 ? 'Small-cap' : mcap < 10000 ? 'Mid-cap' : mcap < 200000 ? 'Large-cap' : 'Mega-cap';
  }
  // live WACC parts for one scenario, from the model's own inputs
  function waccParts(model, s) {
    const { inp } = mdl().engineInputs(model);
    const v = k => inp[k] && typeof inp[k] === 'object' ? inp[k][s] : inp[k];
    const okKe = ['rf', 'beta', 'erp', 'scp', 'csrp'].every(k => isNum(v(k)));
    const ke = okKe ? v('rf') + v('beta') * v('erp') + v('scp') + v('csrp') : null;
    const shares = [inp.basic, inp.options, inp.treasury].every(isNum) ? inp.basic + inp.options - inp.treasury : null;
    const E = isNum(shares) && isNum(inp.price) ? shares * inp.price : null;
    const L = inp.leasesInWacc === false ? 0 : inp.leases;
    const D = inp.debt;
    const wb = model.mode === 'workbook';
    const we = wb ? v('we') : (isNum(E) && isNum(D) && isNum(L) ? E / (E + D + L) : null);
    const wd = isNum(we) ? 1 - we : null;
    const kd = v('kd'), tax = v('tax');
    const kdAT = isNum(kd) && isNum(tax) ? kd * (1 - tax) : null;
    const debtPart = isNum(wd) ? (wd > 0 ? (isNum(kdAT) ? wd * kdAT : null) : 0) : null;
    const wacc = isNum(ke) && isNum(we) && isNum(debtPart) ? we * ke + debtPart : null;
    return { s, rf: v('rf'), beta: v('beta'), erp: v('erp'), scp: v('scp'), csrp: v('csrp'), ke, kd, tax, kdAT, E, D, L, leasesIn: inp.leasesInWacc !== false, shares, price: inp.price, we, wd, wacc, wbMode: wb, sum: isNum(we) ? we + wd : null };
  }

  return { parsePrices, regressionBeta, relever, unlever, weightedKd, coverage, histRate, sizeLabel, waccParts, ttmColumn, manualTTM, manualTTMChecks, MANUAL_KEYS, series, anchors, consistency, effect, revenuePath, marginPath, nolBenefit, scenarioTable, isNum };
})();
if (typeof module !== 'undefined') module.exports = DCFAnalysis;
