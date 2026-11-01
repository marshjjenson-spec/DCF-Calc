// ===== CHARTS (pure SVG builders, no model logic) =====
// Colours come from CSS variables so the charts follow light and dark mode.
const DCFCharts = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = v => '$' + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2));
  function niceStep(span, target) { const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => span / s <= target + 0.01) || p * 10; }

  // rows: [{label, lo, hi, kind: 'bear'|'base'|'bull'|'range'|'target'|'point', note}]
  function football(rows, opts = {}) {
    if (!rows.length) return '';
    const vals = rows.flatMap(r => [r.lo, r.hi]).filter(isNum).concat(isNum(opts.price) ? [opts.price] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || Math.max(1, hi * 0.1); lo = Math.max(0, lo - pad); hi += pad;
    const step = niceStep(hi - lo, 8); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const W = 580, L = 150, R = W - 104, rowH = 34, top = 22, H = top + rows.length * rowH + 30;
    const X = v => L + (v - lo) / (hi - lo) * (R - L);
    const fill = { bear: 'url(#ff-bear)', base: 'url(#ff-base)', bull: 'url(#ff-bull)', range: 'var(--chart-grey)', target: 'var(--chart-grey)', point: 'url(#ff-base)' };
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Football field of value per share ranges')}">
      <defs><linearGradient id="ff-bear" x1="0" x2="1"><stop offset="0" stop-color="var(--navy)"/><stop offset="1" stop-color="var(--navy-2)"/></linearGradient>
      <linearGradient id="ff-base" x1="0" x2="1"><stop offset="0" stop-color="var(--blue)"/><stop offset="1" stop-color="var(--cyan)"/></linearGradient>
      <linearGradient id="ff-bull" x1="0" x2="1"><stop offset="0" stop-color="var(--cyan)"/><stop offset="1" stop-color="var(--cyan-2)"/></linearGradient></defs>`;
    for (let t = lo; t <= hi + 1e-9; t += step) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top - 8}" y2="${H - 24}" stroke="var(--line)"/><text x="${X(t)}" y="${H - 8}" text-anchor="middle" class="tick">$${+t.toFixed(2)}</text>`;
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      s += `<text x="0" y="${y + 15}" class="lab">${esc(r.label)}</text>`;
      if (!isNum(r.lo) || !isNum(r.hi)) { s += `<text x="${L}" y="${y + 15}" class="na">${esc(r.note || 'needs inputs')}</text>`; return; }
      const x0 = X(r.lo), x1 = X(r.hi), w = Math.max(r.kind === 'point' ? 0 : 3, x1 - x0);
      if (r.kind === 'point') s += `<rect x="${x0 - 30}" y="${y + 2}" width="60" height="18" rx="5" fill="${fill.point}"/><text x="${x0}" y="${y + 15}" text-anchor="middle" class="val strong" fill="#fff">${money(r.lo)}</text>`;
      else s += `<rect x="${x0}" y="${y + 3}" width="${w}" height="16" rx="5" fill="${fill[r.kind] || fill.base}"/><text x="${x1 + 6}" y="${y + 15}" class="val">${r.lo === r.hi ? money(r.lo) : money(r.lo) + ' – ' + money(r.hi)}</text>`;
    });
    if (isNum(opts.price)) s += `<line x1="${X(opts.price)}" x2="${X(opts.price)}" y1="${top - 10}" y2="${H - 24}" class="price"/><text x="${X(opts.price)}" y="${top - 12}" text-anchor="middle" class="price-t">Price ${money(opts.price)}</text>`;
    return s + '</svg>';
  }

  // points: [{label, fcff ($ mm), margin (fraction)}]
  function fcf(points, opts = {}) {
    const n = points.length; if (!n) return '';
    const W = 560, H = 270, L = 46, R = W - 50, T = 26, B = H - 30;
    const bn = points.map(p => isNum(p.fcff) ? p.fcff / 1000 : null);
    const vmax = Math.max(0, ...bn.filter(isNum)), vmin = Math.min(0, ...bn.filter(isNum));
    const step = niceStep((vmax - vmin) || 1, 5), top = Math.ceil(vmax / step) * step || step, bot = Math.floor(vmin / step) * step;
    const Y = v => B - (v - bot) / (top - bot) * (B - T);
    const ms = points.map(p => p.margin).filter(isNum);
    const mmax = Math.max(0.01, ...ms), mmin = Math.min(0, ...ms);
    const mstep = niceStep((mmax - mmin) || 0.01, 5), mtop = Math.ceil(mmax / mstep) * mstep, mbot = Math.floor(mmin / mstep) * mstep;
    const YM = v => B - (v - mbot) / (mtop - mbot) * (B - T);
    const slot = (R - L) / n, bw = Math.min(46, slot * 0.62);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Projected free cash flow')}"><defs><linearGradient id="fcf-bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--blue)"/><stop offset="1" stop-color="var(--cyan)"/></linearGradient></defs>`;
    for (let v = bot; v <= top + 1e-9; v += step) s += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">${+v.toFixed(1)}</text>`;
    for (let v = mbot; v <= mtop + 1e-9; v += mstep) s += `<text x="${R + 6}" y="${YM(v) + 4}" class="tick">${+(v * 100).toFixed(1)}%</text>`;
    s += `<text x="${L - 40}" y="${T - 12}" class="tick">FCFF $bn</text><text x="${R + 52}" y="${T - 12}" text-anchor="end" class="tick">FCFF margin</text>`;
    const line = [];
    points.forEach((p, i) => {
      const cx = L + slot * i + slot / 2;
      if (isNum(bn[i])) { const y0 = Y(Math.max(0, bn[i])), y1 = Y(Math.min(0, bn[i])); s += `<rect x="${cx - bw / 2}" y="${y0}" width="${bw}" height="${Math.max(1, y1 - y0)}" rx="3" fill="${bn[i] < 0 ? 'var(--bad)' : 'url(#fcf-bar)'}"><title>${esc(p.label)}: $${bn[i].toFixed(1)}bn</title></rect>`;
        if (n <= 10) s += `<text x="${cx}" y="${bn[i] >= 0 ? y0 - 5 : y1 + 13}" text-anchor="middle" class="val small">${bn[i].toFixed(bn[i] >= 100 ? 0 : 1)}</text>`; }
      s += `<text x="${cx}" y="${H - 10}" text-anchor="middle" class="tick">${esc(p.label)}</text>`;
      if (isNum(p.margin)) line.push([cx, YM(p.margin)]);
    });
    if (line.length > 1) s += `<polyline points="${line.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--navy-line)" stroke-width="2"/>`;
    line.forEach(([x, y]) => s += `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--navy-line)"/>`);
    return s + '</svg>';
  }

  function ring(pct, complete) {
    const r = 62, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `<svg class="ring" viewBox="0 0 160 160" role="img" aria-label="Model ${pct}% complete"><defs><linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--cyan)"/><stop offset="1" stop-color="var(--blue)"/></linearGradient></defs>
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="16"/>
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="${complete ? 'var(--good)' : 'url(#ring-g)'}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 80 80)"/>
      <text x="80" y="82" text-anchor="middle" class="ring-pct">${pct}%</text><text x="80" y="104" text-anchor="middle" class="ring-lab">${complete ? 'Complete' : 'Complete'}</text></svg>`;
  }
  return { football, fcf, ring };
})();
if (typeof module !== 'undefined') module.exports = DCFCharts;
