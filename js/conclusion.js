// ===== CONCLUSION (pure functions; no UI) =====
// Turns a finished model into a conclusion a learner can defend:
//  - verdict: value vs price against the analyst's own margin of safety, and how robust that call is
//  - implied: what today's price assumes (reverse DCF), solved with the full engine, one lever at a time
//  - drivers: which inputs move value most (a tornado), each bumped by a standard amount
//  - review: checks that the written thesis agrees with the numbers
//  - memo: a one-page investment memo in Markdown
// Nothing here changes the model: every calculation re-runs the engine with temporary overrides.
const DCFConclusion = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const eng = () => (typeof DCF !== 'undefined' ? DCF : require('./engine.js'));
  const SC = ['Base', 'Bear', 'Bull'];
  const REC = ['Buy', 'Hold', 'Sell'];

  // the analyst's margin of safety: the gap between value and price needed before acting
  const DEFAULT_HURDLE = 0.15;
  function blankThesis() {
    return { rec: null, hurdle: null, horizon: null, points: ['', '', ''], risks: ['', '', ''], changeMind: '', catalysts: '', variant: '', saved: null };
  }

  // ---- verdict ----
  // value: the value per share the conclusion rests on (probability-weighted, or the Base case if weights are missing)
  function verdict(all, price, hurdle, grid) {
    const h = isNum(hurdle) && hurdle >= 0 ? hurdle : DEFAULT_HURDLE;
    const useW = isNum(all.weighted);
    const value = useW ? all.weighted : (all.scen.Base && all.scen.Base.ok ? all.scen.Base.perShare : null);
    if (!isNum(value) || !isNum(price) || price <= 0) return { ok: false, reason: useW || (all.scen.Base && all.scen.Base.ok) ? 'Enter the current share price.' : 'The Base case must calculate first.' };
    const gap = value / price - 1;
    // the price at which the value clears the margin of safety (a buy-below price) and the price above which it is overvalued
    const buyBelow = value / (1 + h), sellAbove = value / (1 - Math.min(h, 0.95));
    let call, tone, text;
    if (gap >= h - 1e-12) { call = 'Buy'; tone = 'good'; text = `Your value is ${pct(gap)} above the price, more than your ${pct(h, 0)} margin of safety. On your assumptions the shares look undervalued.`; }
    else if (gap <= -h + 1e-12) { call = 'Sell'; tone = 'bad'; text = `Your value is ${pct(-gap)} below the price, more than your ${pct(h, 0)} margin of safety. On your assumptions the shares look overvalued.`; }
    else { call = 'Hold'; tone = 'warn'; text = `Your value is within ${pct(h, 0)} of the price (${gap >= 0 ? '+' : '−'}${pct(Math.abs(gap))}). That gap is smaller than the error in any DCF, so the shares look roughly fairly valued.`; }
    const scen = SC.filter(s => all.scen[s] && all.scen[s].ok).map(s => ({ s, perShare: all.scen[s].perShare, above: all.scen[s].perShare > price }));
    const above = scen.filter(x => x.above).length;
    let gridShare = null, gridN = 0;
    if (grid) { const cells = grid.flat().filter(isNum); gridN = cells.length; if (gridN) gridShare = cells.filter(v => v > price).length / gridN; }
    // robustness: the same answer across scenarios and most of the WACC x growth grid
    let robust;
    if (scen.length < 3 || gridShare === null) robust = { level: 'unknown', text: 'Fill in all three scenarios to test how robust the call is.' };
    else if ((above === 3 || above === 0) && (gridShare >= 0.8 || gridShare <= 0.2)) robust = { level: 'high', text: `${above === 3 ? 'All three scenarios are above' : 'All three scenarios are below'} the price, and ${pct(above === 3 ? gridShare : 1 - gridShare, 0)} of the sensitivity grid agrees. The call does not depend on one assumption.` };
    else if (above === 1 || above === 2) robust = { level: 'low', text: `${above} of 3 scenarios ${above === 1 ? 'is' : 'are'} above the price and ${pct(gridShare, 0)} of the sensitivity grid is. The answer depends on which story plays out, so the probabilities and the Bear/Bull drivers deserve the most evidence.` };
    else robust = { level: 'medium', text: `${above === 3 ? 'All three scenarios are above' : 'All three scenarios are below'} the price, but only ${pct(above === 3 ? gridShare : 1 - gridShare, 0)} of the sensitivity grid agrees. A modest change in WACC or terminal growth flips the answer.` };
    return { ok: true, value, basis: useW ? 'probability-weighted value' : 'Base case (scenario weights are incomplete)', price, gap, hurdle: h, call, tone, text, buyBelow, sellAbove, scen, above, gridShare, gridN, robust };
  }
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';

  // grid of value per share around the scenario's WACC and terminal input, for robustness
  function grid(inp, s, mode) {
    const base = eng().run(inp, s, mode);
    if (!base.ok) return null;
    const w0 = base.waccUsed;
    const ws = [-0.02, -0.01, 0, 0.01, 0.02].map(d => w0 + d);
    if (base.tvMethod === 'Exit Multiple') {
      const m0 = inp.exitMult[s]; const ms = [-4, -2, 0, 2, 4].map(d => m0 + d).filter(m => m > 0);
      const g = eng().sensitivityExit(inp, s, mode, ws, ms);
      return g ? g.map(r => r.map(c => (c ? c.perShare : null))) : null;
    }
    const gs = [-0.01, -0.005, 0, 0.005, 0.01].map(d => base.g + d);
    return eng().sensitivity(inp, s, mode, ws, gs);
  }

  // ---- reverse DCF: what the price implies ----
  // Finds the shift that makes value per share equal the price, holding everything else at the scenario's inputs.
  // Searches outward from no change and takes the nearest crossing, then bisects. Returns null if none in range.
  function solve(f, lo, hi, step) {
    const f0 = f(0);
    if (!isNum(f0)) return null;
    if (Math.abs(f0) < 1e-9) return 0;
    const scan = dir => {
      let a = 0, fa = f0;
      for (let x = step; x <= (dir > 0 ? hi : -lo) + 1e-12; x += step) {
        const b = dir * x, fb = f(b);
        if (!isNum(fb)) { a = b; fa = null; continue; }
        if (isNum(fa) && Math.sign(fa) !== Math.sign(fb)) return [a, b, fa];
        a = b; fa = fb;
      }
      return null;
    };
    const up = scan(1), dn = scan(-1);
    const pick = [up, dn].filter(Boolean).sort((p, q) => Math.min(Math.abs(p[0]), Math.abs(p[1])) - Math.min(Math.abs(q[0]), Math.abs(q[1])))[0];
    if (!pick) return null;
    let [a, b, fa] = pick;
    for (let i = 0; i < 80 && Math.abs(b - a) > 1e-8; i++) { const m = (a + b) / 2, fm = f(m); if (!isNum(fm)) break; if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
    return (a + b) / 2;
  }
  function cagr(r) { const y = r.years; return isNum(y[9].rev) && isNum(y[0].rev) && y[0].growth > -1 ? Math.pow(y[9].rev / (y[0].rev / (1 + y[0].growth)), 1 / 10) - 1 : null; }
  function implied(inp, s, mode) {
    const E = eng(), base = E.run(inp, s, mode);
    if (!base.ok) return null;
    const price = inp.price;
    const v = k => inp[k] && inp[k][s];
    const per = ov => { const r = E.run(inp, s, mode, ov); return r.ok ? r.perShare - price : null; };
    const out = { price, value: base.perShare, linked: base.linked, baseCagr: base.linked ? null : cagr(base), baseEm10: base.years[9].emPct, wacc: base.waccUsed };
    // 1. growth: every forecast year's revenue growth moves by the same amount
    if (!base.linked) {
      const gov = d => ({ g1: v('g1') + d, g2: v('g2') + d, g3: v('g3') + d });
      const d = solve(d => (v('g1') + d <= -0.95 || v('g2') + d <= -0.95 || v('g3') + d <= -0.95 ? null : per(gov(d))), -0.5, 0.6, 0.01);
      if (d === null) out.growth = { ok: false, reason: 'No revenue growth between −50 and +60 points from yours gives the price.' };
      else { const r = E.run(inp, s, mode, gov(d)); out.growth = { ok: true, shift: d, rates: [v('g1') + d, v('g2') + d, v('g3') + d], cagr: cagr(r) }; }
      // 2. margins: EBITDA margin in every year (1, 5, 10 and terminal) moves by the same amount
      const mov = d => ({ em1: v('em1') + d, em5: v('em5') + d, em10: v('em10') + d, tem: v('tem') + d });
      const m = solve(d => per(mov(d)), -0.5, 0.5, 0.01);
      if (m === null) out.margin = { ok: false, reason: 'No EBITDA margin between −50 and +50 points from yours gives the price.' };
      else out.margin = { ok: true, shift: m, em: [v('em1') + m, v('em5') + m, v('em10') + m, v('tem') + m] };
    } else {
      out.growth = out.margin = { ok: false, reason: 'This scenario uses the linked three-statement forecast, so revenue and margins come from that model. Change them there.' };
    }
    // 3. discount rate: the return you earn if you buy at today's price and the forecast comes true
    const floor = base.tvMethod === 'Gordon Growth' ? base.g + 0.0005 : 0.001;
    const w = solve(d => (base.waccUsed + d <= floor ? null : per({ wacc: base.waccUsed + d })), floor - base.waccUsed, 0.4, 0.0025);
    out.irr = w === null ? { ok: false, reason: 'No discount rate in range gives the price.' } : { ok: true, rate: base.waccUsed + w, spread: w };
    return out;
  }

  // ---- value drivers (tornado) ----
  const DRIVERS = [
    { id: 'growth', label: 'Revenue growth, years 1–10', bump: 0.02, unit: 'pts', keys: ['g1', 'g2', 'g3'], forecast: true },
    { id: 'margin', label: 'EBITDA margin, every year', bump: 0.02, unit: 'pts', keys: ['em1', 'em5', 'em10', 'tem'], forecast: true },
    { id: 'capex', label: 'CapEx, % of revenue', bump: 0.01, unit: 'pts', keys: ['capex1', 'capex2', 'capex3', 'tcapex'], forecast: true },
    { id: 'tax', label: 'Tax rate', bump: 0.03, unit: 'pts', keys: ['tax'], forecast: true },
    { id: 'wacc', label: 'WACC', bump: 0.01, unit: 'pts', ov: 'wacc' },
    { id: 'tg', label: 'Terminal growth', bump: 0.005, unit: 'pts', keys: ['tg'], gordon: true },
    { id: 'exit', label: 'Exit multiple', bump: 2, unit: 'x', keys: ['exitMult'], exit: true },
  ];
  function drivers(inp, s, mode) {
    const E = eng(), base = E.run(inp, s, mode);
    if (!base.ok) return null;
    const out = [];
    DRIVERS.forEach(d => {
      if (d.gordon && base.tvMethod !== 'Gordon Growth') return;
      if (d.exit && base.tvMethod !== 'Exit Multiple') return;
      if (d.forecast && base.linked) return;
      const run = sign => {
        const ov = {};
        if (d.ov === 'wacc') ov.wacc = base.waccUsed + sign * d.bump;
        else d.keys.forEach(k => { if (inp[k] && isNum(inp[k][s])) ov[k] = inp[k][s] + sign * d.bump; });
        const r = E.run(inp, s, mode, ov);
        return r.ok ? r.perShare : null;
      };
      const lo = run(-1), hi = run(1);
      if (!isNum(lo) || !isNum(hi)) return;
      if (Math.abs(lo - base.perShare) < 1e-9 && Math.abs(hi - base.perShare) < 1e-9) return;
      out.push({ id: d.id, label: d.label, bump: d.bump, unit: d.unit, down: lo, up: hi, range: Math.abs(hi - lo) });
    });
    out.sort((a, b) => b.range - a.range);
    return { base: base.perShare, list: out };
  }

  // ---- does the written thesis agree with the numbers? ----
  function review(thesis, V, imp, ctx = {}) {
    const t = thesis || blankThesis(), out = [];
    const filled = a => (a || []).filter(x => x && String(x).trim().length >= 8).length;
    const add = (level, text) => out.push({ level, text });
    if (!t.rec) add('todo', 'Choose a recommendation: Buy, Hold or Sell.');
    else if (V && V.ok && t.rec !== V.call) {
      const why = { Buy: 'buying', Hold: 'holding', Sell: 'selling' }[t.rec];
      add('bad', `You chose ${t.rec}, but your own numbers point to ${V.call} (value ${V.gap >= 0 ? 'above' : 'below'} price by ${pct(Math.abs(V.gap))}, margin of safety ${pct(V.hurdle, 0)}). Either explain in your reasons why ${why} still makes sense, or revisit the assumptions.`);
    }
    if (filled(t.points) < 3) add('todo', `Write three reasons for your view (${filled(t.points)} of 3 so far). Each should name a driver in the model, such as growth, margins or reinvestment, and the evidence for it.`);
    if (filled(t.risks) < 2) add('todo', `List at least two risks (${filled(t.risks)} so far): what would make your Base case wrong?`);
    if (!t.changeMind || t.changeMind.trim().length < 8) add('todo', 'Say what would change your mind: a measurable signal, such as "revenue growth below 8% for two quarters".');
    if (!t.variant || t.variant.trim().length < 8) add('todo', 'Say where you differ from the market: which number in the "what the price implies" panel do you disagree with, and why?');
    if (V && V.ok && V.robust.level === 'low') add('warn', 'Your scenarios disagree about whether the shares are cheap. A high-conviction recommendation needs a clear reason to weight one story over the others.');
    if (V && V.ok && V.scen.length === 3 && V.above === 3 && t.rec !== 'Sell') add('warn', 'Even your Bear case is above the price. Check that the Bear case is genuinely pessimistic: a real downside case usually sits below the price.');
    if (V && V.ok && V.scen.length === 3 && V.above === 0 && t.rec !== 'Buy') add('warn', 'Even your Bull case is below the price. Check that the Bull case is genuinely optimistic, or the market may know something your model does not.');
    if (isNum(ctx.tvShare) && ctx.tvShare > 0.85) add('warn', `Terminal value is ${pct(ctx.tvShare, 0)} of enterprise value, so the conclusion rests mostly on what happens after year 10. Mention this in your risks.`);
    if (ctx.failing > 0) add('warn', `${ctx.failing} sanity check${ctx.failing > 1 ? 's fail' : ' fails'} on the Valuation summary. Fix ${ctx.failing > 1 ? 'them' : 'it'} before relying on the conclusion.`);
    if (isNum(ctx.pct) && ctx.pct < 100) add('info', `The model is ${ctx.pct}% complete. A conclusion from an incomplete model is a draft.`);
    if (imp && imp.growth && imp.growth.ok && isNum(ctx.histCagr) && isNum(imp.growth.cagr)) {
      const d = imp.growth.cagr - ctx.histCagr;
      if (d > 0.05) add('info', `The price implies about ${pct(imp.growth.cagr)} a year of revenue growth for ten years, well above the ${pct(ctx.histCagr)} the company managed recently. A Sell case can point to this.`);
      else if (d < -0.05) add('info', `The price implies only about ${pct(imp.growth.cagr)} a year of revenue growth, well below the ${pct(ctx.histCagr)} the company managed recently. A Buy case can point to this.`);
    }
    const blocking = out.filter(x => x.level === 'todo' || x.level === 'bad').length;
    return { items: out, ready: blocking === 0, blocking };
  }

  // ---- one-page investment memo (Markdown) ----
  function memo(m) {
    const L = [], f$ = v => (isNum(v) ? '$' + v.toFixed(2) : 'n/a'), fp = (v, d = 1) => (isNum(v) ? (v >= 0 ? '' : '−') + (Math.abs(v) * 100).toFixed(d) + '%' : 'n/a');
    const c = m.company || {}, V = m.verdict, t = m.thesis || blankThesis();
    L.push(`# ${c.name || 'Company'}${c.ticker ? ' (' + c.ticker + ')' : ''}: ${t.rec || (V && V.ok ? V.call : 'No recommendation')}`);
    L.push('');
    L.push(`${c.analyst ? 'Analyst: ' + c.analyst + ' · ' : ''}${c.valDate ? 'Valued as of ' + c.valDate + ' · ' : ''}${t.horizon ? 'Horizon: ' + t.horizon + ' · ' : ''}Discounted cash flow, ${m.mode === 'corrected' ? 'corrected method' : 'original workbook method'}`);
    L.push('');
    if (V && V.ok) {
      L.push('## Valuation');
      L.push('');
      L.push('| | Value per share | vs price |');
      L.push('|---|---:|---:|');
      V.scen.forEach(x => L.push(`| ${x.s} case${m.probs && isNum(m.probs[x.s]) ? ' (' + (m.probs[x.s] * 100).toFixed(0) + '%)' : ''} | ${f$(x.perShare)} | ${fp(x.perShare / V.price - 1)} |`));
      L.push(`| **${V.basis[0].toUpperCase() + V.basis.slice(1)}** | **${f$(V.value)}** | **${fp(V.gap)}** |`);
      L.push(`| Current price | ${f$(V.price)} | |`);
      L.push('');
      L.push(`Model view: **${V.call}**. ${V.text} Buy below ${f$(V.buyBelow)}; overvalued above ${f$(V.sellAbove)} (margin of safety ${fp(V.hurdle, 0)}).`);
      L.push('');
      L.push(`Robustness: ${V.robust.text}`);
      L.push('');
    }
    const I = m.implied;
    if (I) {
      L.push('## What the price implies');
      L.push('');
      if (I.growth && I.growth.ok) L.push(`- Revenue growth: about ${fp(I.growth.cagr)} a year for ten years (my Base case: ${fp(I.baseCagr)}${isNum(m.histCagr) ? '; recent history: ' + fp(m.histCagr) : ''}).`);
      if (I.margin && I.margin.ok) L.push(`- EBITDA margin: ${fp(I.margin.em[2])} by year 10 (my Base case: ${fp(I.baseEm10)}).`);
      if (I.irr && I.irr.ok) L.push(`- Return from buying today if my forecast comes true: ${fp(I.irr.rate, 2)} a year, vs a WACC of ${fp(I.wacc, 2)}.`);
      L.push('');
    }
    if (m.drivers && m.drivers.list.length) {
      L.push('## What matters most');
      L.push('');
      m.drivers.list.slice(0, 4).forEach(d => L.push(`- ${d.label} ${d.unit === 'x' ? '±' + d.bump + '×' : '±' + (d.bump * 100).toFixed(1) + ' pts'}: ${f$(Math.min(d.down, d.up))} to ${f$(Math.max(d.down, d.up))}`));
      L.push('');
    }
    const list = (h, a) => { const xs = (a || []).filter(x => x && String(x).trim()); if (!xs.length) return; L.push('## ' + h); L.push(''); xs.forEach((x, i) => L.push(`${i + 1}. ${String(x).trim()}`)); L.push(''); };
    const para = (h, x) => { if (!x || !String(x).trim()) return; L.push('## ' + h); L.push(''); L.push(String(x).trim()); L.push(''); };
    list('Thesis', t.points);
    para('Where I differ from the market', t.variant);
    list('Risks', t.risks);
    para('Catalysts', t.catalysts);
    para('What would change my mind', t.changeMind);
    if (m.reviewItems && m.reviewItems.length) { L.push('## Open review points'); L.push(''); m.reviewItems.forEach(x => L.push(`- ${x.text}`)); L.push(''); }
    L.push('_Prepared with DCF Pro. A DCF is only as good as its assumptions; every figure above can be traced to the model inputs._');
    return L.join('\n');
  }

  return { REC, DEFAULT_HURDLE, blankThesis, verdict, grid, solve, implied, DRIVERS, drivers, review, memo };
})();
if (typeof module !== 'undefined') module.exports = DCFConclusion;
