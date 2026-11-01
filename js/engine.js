// ===== DCF ENGINE (pure functions; no UI) =====
// Mirrors the "dcf-model-amzn-CMGs6046.xlsx" DCF Engine. mode:'workbook' reproduces Excel exactly;
// mode:'corrected' applies the standard-practice fixes listed in FIXES.
const DCF = (() => {
  const SC = ['Base', 'Bear', 'Bull'];
  const TRI = ['g1','g2','g3','em1','em5','em10','da','tax','nol','capex1','capex2','capex3','nwc','acq','s2c',
               'rf','erp','beta','scp','csrp','kd','we','tg','tem','tcapex','troic','tvMethod','exitMult','prob'];
  const SINGLE = ['price','basic','options','treasury','rev0','cash','sti','debt','pension','leases','minority','stakes','dtl','optVal','midYear'];
  const isNum = v => typeof v === 'number' && isFinite(v);
  // which inputs each mode needs
  function required(inp, s, mode) {
    const tri = ['g1','g2','g3','em1','em5','em10','da','tax','nol','capex1','capex2','capex3','nwc','acq','s2c','rf','erp','beta','scp','csrp','kd','tg','tem','tvMethod'];
    if (mode === 'workbook') tri.push('we','tcapex'); else tri.push('troic');
    // no debt (and no leases counted) in the weights: the debt weight is 0, so no borrowing rate is needed
    if (mode !== 'workbook' && isNum(inp.debt) && inp.debt === 0 && (inp.leasesInWacc === false || (isNum(inp.leases) && inp.leases === 0))) tri.splice(tri.indexOf('kd'), 1);
    if (inp.tvMethod && inp.tvMethod[s] === 'Exit Multiple') tri.push('exitMult');
    const single = SINGLE.slice();
    // leases unused when they are neither subtracted in the bridge nor counted in the weights
    if (inp.leasesInBridge === false && inp.leasesInWacc === false) single.splice(single.indexOf('leases'), 1);
    return { tri, single };
  }
  function missing(inp, s, mode) {
    const r = required(inp, s, mode), out = [];
    r.tri.forEach(k => { const v = inp[k] && inp[k][s]; if (k === 'tvMethod') { if (v !== 'Gordon Growth' && v !== 'Exit Multiple') out.push(k); } else if (!isNum(v)) out.push(k); });
    r.single.forEach(k => { if (k === 'midYear') { if (inp.midYear !== 'Y' && inp.midYear !== 'N') out.push(k); } else if (!isNum(inp[k])) out.push(k); });
    return out;
  }
  function wacc(inp, s, mode) {
    const v = k => inp[k][s];
    const ke = v('rf') + v('beta') * v('erp') + v('scp') + v('csrp');
    const kdAT = isNum(v('kd')) ? v('kd') * (1 - v('tax')) : null;
    const shares = inp.basic + inp.options - inp.treasury;
    const mcap = shares * inp.price;
    // operating leases count as debt in the weights unless the analyst excludes them (inp.leasesInWacc === false)
    const L = inp.leasesInWacc === false ? 0 : inp.leases;
    let we;
    if (mode === 'workbook') we = v('we');
    else we = mcap / (mcap + inp.debt + L);
    const wd = 1 - we;
    return { ke, kdAT, we, wd, wacc: ke * we + (wd > 0 ? kdAT * wd : 0), mcap, shares, debtW: mode === 'workbook' ? null : inp.debt, leasesW: mode === 'workbook' ? null : L };
  }
  // run one scenario. ov = optional overrides {wacc, tg, exitMult, tvMethod}
  function run(inp, s, mode = 'corrected', ov = {}) {
    const miss = missing(inp, s, mode);
    if (miss.length) return { ok: false, missing: miss, errors: [] };
    const v = k => (k in ov ? ov[k] : (inp[k] ? inp[k][s] : null));
    const W = wacc(inp, s, mode);
    const w = 'wacc' in ov ? ov.wacc : W.wacc;
    const g = v('tg');
    const errors = [];
    if (W.shares <= 0) errors.push('Diluted shares must be greater than zero.');
    if (inp.price <= 0) errors.push('Share price must be greater than zero.');
    const tvMethod = v('tvMethod');
    if (tvMethod === 'Gordon Growth' && !(w > g)) errors.push(`WACC (${(w*100).toFixed(2)}%) must be higher than terminal growth (${(g*100).toFixed(2)}%) for Gordon Growth.`);
    if (mode === 'corrected' && !(v('troic') > 0)) errors.push('Terminal ROIC must be greater than zero.');
    if (!(v('s2c') > 0)) errors.push('Sales-to-capital ratio must be greater than zero.');
    if (errors.length) return { ok: false, missing: [], errors };
    const growth = [v('g1'), v('g1'), v('g1'), v('g2'), v('g2'), v('g2'), v('g2'), v('g3'), v('g3'), v('g3'), g];
    const path = (a, b, c, i) => i < 5 ? a + i / 4 * (b - a) : b + (i - 4) / 5 * (c - b);
    const capxPct = [v('capex1'), v('capex1'), v('capex1'), v('capex2'), v('capex2'), v('capex2'), v('capex2'), v('capex3'), v('capex3'), v('capex3'), v('tcapex')];
    const years = []; let prev = inp.rev0;
    for (let i = 0; i < 11; i++) {
      const rev = prev * (1 + growth[i]);
      const emPct = i < 10 ? path(v('em1'), v('em5'), v('em10'), i) : v('tem');
      const ebitda = rev * emPct, da = rev * v('da'), ebit = ebitda - da;
      const taxRate = v('tax') - (i < 3 ? v('nol') : 0);
      const taxes = ebit * taxRate, nopat = ebit - taxes;
      let capex = rev * capxPct[i], dnwc = (rev - prev) * v('nwc'), acq = rev * v('acq');
      let fcff = nopat + da - capex - dnwc - acq;
      const gmPct = (isNum(v('gm1')) && isNum(v('gm5')) && isNum(v('gm10'))) ? (i < 10 ? path(v('gm1'), v('gm5'), v('gm10'), i) : v('gm10')) : null;
      const y = { gmPct, gp: gmPct === null ? null : rev * gmPct, t: i + 1, growth: growth[i], rev, emPct, ebitda, da, ebit, ebitPct: ebit / rev, taxRate, taxes, nopat, capex, dnwc, acq, fcff };
      if (i === 10 && mode === 'corrected') {
        // Damodaran stable growth: reinvestment rate = g / ROIC, so FCFF = NOPAT x (1 - g/ROIC)
        y.reinvestRate = g / v('troic'); y.fcff = nopat * (1 - y.reinvestRate);
        y.capex = y.da = y.dnwc = y.acq = null; y.reinvestment = nopat * y.reinvestRate;
      }
      y.fcffPct = y.fcff / rev;
      years.push(y); prev = rev;
    }
    // invested capital & ROIC (workbook rows 33-34)
    let ic = years[0].rev / v('s2c');
    years.forEach((y, i) => {
      if (i === 0) { y.ic = ic; y.roic = y.nopat / ic; }
      else if (i < 10) { y.roic = y.nopat / years[i - 1].ic; ic = ic + (y.capex + y.dnwc + y.acq - y.da); y.ic = ic; }
      else { y.ic = y.rev / v('s2c'); y.roic = y.nopat / years[9].ic; }
      y.reinvRateModel = 1 - y.fcff / y.nopat;
    });
    const mid = inp.midYear === 'Y';
    // stub: years already elapsed between the end of the base period and the valuation date (0 = workbook timing)
    const off = isNum(inp.stub) && inp.stub > 0 ? inp.stub : 0;
    let sumPV = 0;
    years.slice(0, 10).forEach(y => { y.period = y.t - (mid ? 0.5 : 0) - off; y.df = 1 / Math.pow(1 + w, y.period); y.pv = y.fcff * y.df; sumPV += y.pv; });
    const T = years[10], Y10 = years[9];
    let tv, tvPeriod = 10, tvGordon, tvExit;
    if (mode === 'workbook') {
      tvGordon = T.fcff * (1 + g) / (w - g);
      tvExit = T.ebitda * v('exitMult');
    } else {
      tvGordon = T.fcff / (w - g);
      tvExit = Y10.ebitda * v('exitMult');
    }
    if (tvMethod === 'Gordon Growth') { tv = tvGordon; if (mode === 'corrected' && mid) tvPeriod = 9.5; }
    else tv = tvExit;
    tvPeriod -= off;
    const pvTV = tv / Math.pow(1 + w, tvPeriod);
    const ev = sumPV + pvTV;
    // operating lease liabilities are subtracted only when leases are treated as debt (inp.leasesInBridge !== false)
    const bridge = inp.cash + inp.sti + inp.stakes - inp.debt - inp.pension - (inp.leasesInBridge === false ? 0 : inp.leases) - inp.minority - inp.dtl - inp.optVal;
    const equity = ev + bridge;
    const perShare = equity / W.shares;
    const termRoic = T.roic;
    const impliedReinv = g / (mode === 'corrected' ? v('troic') : termRoic);
    const res = {
      ok: true, scenario: s, mode, stub: off, years, W, waccUsed: w, g, tvMethod, tv, tvGordon, tvExit, tvPeriod, pvTV, sumPV, ev, bridge, equity, perShare,
      upside: perShare / inp.price - 1, tvShare: pvTV / ev,
      evEbitda1: ev / years[0].ebitda, evRev1: ev / years[0].rev,
      impliedExitMultiple: tv / Y10.ebitda,
      checks: {
        termRoic: mode === 'corrected' ? v('troic') : termRoic,
        spread: (mode === 'corrected' ? v('troic') : termRoic) - w,
        impliedReinv, modelReinv: T.reinvestRate != null ? T.reinvestRate : T.reinvRateModel,
        tgrVsRf: g <= v('rf'),
      }
    };
    res.checks.reinvGap = res.checks.modelReinv - res.checks.impliedReinv;
    return res;
  }
  function runAll(inp, mode = 'corrected') {
    const out = {}; SC.forEach(s => out[s] = run(inp, s, mode));
    const probs = SC.map(s => inp.prob[s]);
    const probSum = probs.every(isNum) ? probs.reduce((a, b) => a + b, 0) : null;
    let weighted = null, weightedNote = '';
    if (probSum === null) weightedNote = 'Enter all three scenario probabilities.';
    else if (Math.abs(probSum - 1) > 1e-9) weightedNote = `Probabilities add to ${(probSum*100).toFixed(1)}%. They must add to 100%.`;
    else if (!SC.every(s => out[s].ok)) weightedNote = 'Every scenario must calculate first.';
    else weighted = SC.reduce((a, s) => a + out[s].perShare * inp.prob[s], 0);
    return { scen: out, probSum, weighted, weightedNote };
  }
  // WACC builder (cross-check sheet)
  function waccBuilder(inp, wb, mode) {
    const s = 'Base', v = k => inp[k][s];
    if (![v('rf'), v('erp'), v('beta'), v('kd'), v('tax'), wb.crp].every(isNum)) return null;
    const W = wacc(inp, s, mode);
    const keBuilt = v('rf') + v('beta') * v('erp') + (wb.crp || 0) + v('scp') + v('csrp');
    const adjBeta = isNum(wb.rawBeta) ? 0.67 * wb.rawBeta + 0.33 : null;
    const de = W.wd / W.we;
    const relevered = isNum(wb.unlevBeta) ? wb.unlevBeta * (1 + (1 - v('tax')) * de) : null;
    const built = keBuilt * W.we + v('kd') * (1 - v('tax')) * W.wd;
    return { W, keBuilt, adjBeta, de, relevered, realRf: isNum(wb.bei) ? v('rf') - wb.bei : null, built, diff: built - W.wacc };
  }
  // Workbook mode reproduces the Excel grids, which hold the active scenario's projected FCFFs fixed and
  // vary only the discount rate and the capitalisation (TV) inputs. Corrected mode re-runs the full model per cell.
  function fixedGrid(base, w, tvFn) {
    const mid = base.years[0].period === 0.5;
    let pv = 0; base.years.slice(0, 10).forEach(y => { pv += y.fcff / Math.pow(1 + w, y.t - (mid ? 0.5 : 0)); });
    return pv + tvFn() / Math.pow(1 + w, 10);
  }
  function sensitivity(inp, s, mode, waccs, gs) {
    const base = run(inp, s, mode);
    if (!base.ok) return null;
    return gs.map(g => waccs.map(w => {
      if (mode === 'workbook') {
        if (!(w > g)) return null;
        const ev = fixedGrid(base, w, () => base.years[10].fcff * (1 + g) / (w - g));
        return (ev + base.bridge) / base.W.shares;
      }
      const r = run(inp, s, mode, { wacc: w, tg: g }); return r.ok ? r.perShare : null;
    }));
  }
  function sensitivityExit(inp, s, mode, waccs, mults) {
    const base = run(inp, s, mode);
    if (!base.ok) return null;
    return waccs.map(w => mults.map(m => {
      if (mode === 'workbook') {
        const ev = fixedGrid(base, w, () => base.years[10].ebitda * m);
        return { ev, perShare: (ev + base.bridge) / base.W.shares };
      }
      const r = run(inp, s, mode, { wacc: w, exitMult: m, tvMethod: 'Exit Multiple' });
      return r.ok ? { ev: r.ev, perShare: r.perShare } : null;
    }));
  }
  return { SC, TRI, SINGLE, run, runAll, wacc, waccBuilder, sensitivity, sensitivityExit, missing };
})();
if (typeof module !== 'undefined') module.exports = DCF;
