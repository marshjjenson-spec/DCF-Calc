// ===== TRADING COMPS EXPORT: Excel workbook with live formulas, notes (Markdown), printable summary =====
// The workbook is written from scratch (no template). Every calculated figure is an Excel formula that
// points at the input cells, with the app's own result stored as the cached value, so Excel shows the
// same numbers before recalculating and recalculates them from the inputs on open. Inputs that are
// missing stay blank or say "n/a"; nothing is filled with zero. Proposed data updates that are still
// waiting for review are listed separately and never used in the calculations.
const CompsExport = (() => {
  const E = typeof CompsEngine !== 'undefined' ? CompsEngine : require('./comps-engine.js');
  const D = typeof CompsData !== 'undefined' ? CompsData : require('./comps-data.js');
  const isNum = E.isNum;
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const nameOf = c => (c.ticker || c.name || 'Company');
  const SRC_CAT = { sec: 'SEC filing (reported)', calc: 'Calculated from filings', market: 'Market data', vendor: 'Data vendor', estimate: 'Estimate', manual: 'Manual entry (analyst, not independently verified)', dcf: 'Copied from a DCF model' };

  // ---------- minimal xlsx writer ----------
  // Styles: 0 default, 1 bold, 2 #,##0.0, 3 0.0x, 4 0.0%, 5 0.00, 6 title, 7 italic note, 8 #,##0.00 bold, 9 0.0000
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.0"/><numFmt numFmtId="165" formatCode="0.0&quot;x&quot;"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const S = { b: 1, mm: 2, x: 3, pct: 4, px: 5, title: 6, note: 7, pxb: 8, fx: 9 };
  // A cell is: null | number | string | { v, f, s }
  function cellXml(ref, c) {
    if (c === null || c === undefined || c === '') return '';
    if (typeof c !== 'object') c = { v: c };
    const s = c.s ? ` s="${c.s}"` : '';
    if (c.f) {
      const f = `<f>${xesc(c.f.replace(/^=/, '').replace(/\b(QUARTILE|PERCENTILE)\.INC\(/g, '_xlfn.$1.INC('))}</f>`; // newer functions carry the _xlfn. prefix in the file format
      if (isNum(c.v)) return `<c r="${ref}"${s}>${f}<v>${c.v}</v></c>`;
      if (typeof c.v === 'string') return `<c r="${ref}"${s} t="str">${f}<v>${xesc(c.v)}</v></c>`;
      return `<c r="${ref}"${s}>${f}</c>`;
    }
    if (isNum(c.v)) return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
    if (c.v === null || c.v === undefined) return s ? `<c r="${ref}"${s}/>` : '';
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xesc(c.v)}</t></is></c>`;
  }
  function sheetXml(sh) {
    const rows = sh.rows.map((r, i) => { const cells = (r || []).map((c, j) => cellXml(colName(j) + (i + 1), c)).join(''); return cells ? `<row r="${i + 1}">${cells}</row>` : ''; }).join('');
    const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const pane = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${sh.freeze[0]}" ySplit="${sh.freeze[1]}" topLeftCell="${colName(sh.freeze[0])}${sh.freeze[1] + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`;
  }
  async function writeBook(JSZip, sheets) {
    const z = new JSZip();
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
    z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
    z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Trading Comps</dc:title><dc:creator>DCF Pro</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`);
    z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    z.file('xl/styles.xml', STYLES);
    sheets.forEach((s, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
    return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  // ---------- workbook layout ----------
  // Comps sheet columns (0-based index → letter via colName)
  const MULT_COLS = [['ev_rev', 'rev'], ['ev_ebitda', 'ebitda'], ['ev_ebit', 'ebit'], ['pe', 'eps'], ['pb', 'book'], ['p_fcf', 'fcf']];
  function layout() {
    const cols = ['Ticker', 'Company', 'Status', 'Currency (statements / price)', 'Share price', 'Basic shares (mm)', 'Net dilutive shares (mm)', 'Shares used (mm)', 'FX rate (price ccy per reporting ccy)', 'Market cap (mm, price ccy)'];
    const C = {}; ['tk', 'name', 'status', 'ccy', 'price', 'shares', 'dil', 'shUsed', 'fx', 'mcap'].forEach((k, i) => { C[k] = i; });
    E.EV_LINES.forEach(L => { C[L.key] = cols.length; cols.push(L.label + ' (mm)'); });
    C.net = cols.length; cols.push('Net claims (mm, reporting ccy)');
    C.ev = cols.length; cols.push('Enterprise value (mm, price ccy)');
    ['rev', 'ebitda', 'ebit', 'eps', 'fcf', 'book'].forEach(k => { C['m_' + k] = cols.length; cols.push(''); });
    MULT_COLS.forEach(([id]) => { C['x_' + id] = cols.length; cols.push(''); });
    C.sel = cols.length; cols.push('');
    C.selMet = cols.length; cols.push('');
    C.weight = cols.length; cols.push('Weight (custom weighting)');
    C.flag = cols.length; cols.push('Flags and exclusions');
    return { cols, C, L: k => colName(C[k]) };
  }

  function build(model) {
    const m = model, set = m.settings, t = m.target;
    const peers = E.peerSet(m);
    const b = E.benchmark(m), sel = b.sel;
    const tp = set.tablePeriod || 'ttm';
    const per = id => id === 'pb' ? 'cur' : (id === 'p_fcf' && !['ttm', 'fy'].includes(tp) ? null : tp);
    const { cols, C, L } = layout();
    const metLabel = k => k === 'book' ? 'Book equity (mm)' : `${E.PERIODS[tp]} ${E.METRICS[k].label}${k === 'eps' ? ' (per share)' : ' (mm)'}${set.normalized ? ', normalised' : ''}`;
    ['rev', 'ebitda', 'ebit', 'eps', 'fcf', 'book'].forEach(k => { cols[C['m_' + k]] = metLabel(k); });
    MULT_COLS.forEach(([id]) => { cols[C['x_' + id]] = per(id) ? E.multLabel(id, per(id)) : E.MULTIPLES[id].label + ' (not available for ' + E.PERIODS[tp] + ')'; });
    const selM = E.MULTIPLES[sel.multiple];
    cols[C.sel] = 'Selected: ' + b.label;
    cols[C.selMet] = 'Selected metric: ' + (selM.metric === 'book' ? 'Book equity' : `${E.PERIODS[sel.period] || sel.period} ${E.METRICS[selM.metric].label}`);
    const rows = [];
    rows.push([{ v: 'Trading Comps: ' + (m.name || ''), s: S.title }]);
    rows.push([{ v: `Target: ${t.name || ''}${t.ticker ? ' (' + t.ticker + ')' : ''}. Peer group: ${E.groupLabel(m, sel.group)}. Exported ${new Date().toISOString().slice(0, 10)}. Amounts in millions unless stated. Statistics use QUARTILE.INC (same as PERCENTILE.INC) over the peers in this group only; N/M, n/a and excluded observations are text, so Excel's statistics skip them.`, s: S.note }]);
    rows.push([{ v: `Settings: operating leases ${set.leasePolicy === 'include' ? 'included in' : 'excluded from'} EV by default; share basis ${set.shareBasis}; metrics ${set.normalized ? 'normalised (reported + documented adjustments)' : 'as reported'}; outliers flagged with Tukey fences k = ${set.outlierK || 1.5} (flagged, not removed).`, s: S.note }]);
    const HDR = 4; // header row number (1-based)
    rows.push(cols.map(h => ({ v: h, s: S.b })));
    const first = HDR + 1;
    const company = (c, r, isTarget) => {
      const row = []; const put = (k, v) => { row[C[k]] = v; };
      const ref = k => L(k) + r;
      put('tk', c.ticker || ''); put('name', c.name || ''); put('status', isTarget ? 'Target' : (c.status || ''));
      put('ccy', (c.currency || '') + (c.priceCurrency && c.priceCurrency !== c.currency ? ' / ' + c.priceCurrency : ''));
      const v = k => E.val(c, k);
      put('price', isNum(v('price')) ? { v: v('price'), s: S.px } : 'n/a');
      put('shares', isNum(v('shares')) ? { v: v('shares'), s: S.mm } : 'n/a');
      put('dil', isNum(v('dilutive')) ? { v: v('dilutive'), s: S.mm } : null);
      const sh = E.sharesOf(c, set);
      put('shUsed', isNum(sh.v) ? { f: set.shareBasis === 'diluted' ? `${ref('shares')}+${ref('dil')}` : `${ref('shares')}`, v: sh.v, s: S.mm } : 'n/a: ' + (sh.missing || []).join(', ') + ' missing');
      const fx = E.fxOf(c);
      put('fx', isNum(fx.rate) ? { v: fx.rate, s: S.fx } : 'n/a: rate missing');
      const mc = E.marketCap(c, set);
      put('mcap', isNum(mc.v) ? { f: `${ref('price')}*${ref('shUsed')}`, v: mc.v, s: S.mm } : 'n/a');
      const terms = [];
      E.EV_LINES.forEach(Ln => {
        const x = v(Ln.key), inc = E.lineIncluded(c, Ln, set);
        put(Ln.key, isNum(x) ? { v: x, s: S.mm } : null);
        if (inc && isNum(x)) terms.push((Ln.sign > 0 ? '+' : '-') + ref(Ln.key));
      });
      const e = E.evBuild(c, set);
      const netOk = !e.missing.filter(k => !['price', 'shares', 'dilutive'].includes(k)).length;
      let netV = e.net; if (!isNum(netV) && netOk) { netV = 0; E.EV_LINES.forEach(Ln => { const x = v(Ln.key); if (E.lineIncluded(c, Ln, set) && isNum(x)) netV += Ln.sign * x; }); }
      put('net', netOk ? { f: terms.length ? terms.join('').replace(/^\+/, '') : '0', v: netV, s: S.mm } : 'n/a: ' + e.missing.join(', ') + ' missing');
      put('ev', isNum(e.v) ? { f: `${ref('mcap')}+${ref('net')}*${ref('fx')}`, v: e.v, s: S.mm } : 'n/a: ' + e.missing.join(', ') + ' missing');
      ['rev', 'ebitda', 'ebit', 'eps', 'fcf', 'book'].forEach(k => { const mt = E.metric(c, k, k === 'book' ? 'cur' : tp, set.normalized !== false); put('m_' + k, isNum(mt.v) ? { v: mt.v, s: k === 'eps' ? S.px : S.mm } : 'n/a'); });
      const multCell = (id, p, metCol, valueOverride) => {
        if (!p) return 'n/a';
        const Mm = E.MULTIPLES[id]; const res = E.multiple(c, id, p, set);
        const ex = !isTarget && c.excludeObs && c.excludeObs[E.mid(id, p)];
        if (res.status === 'na') return 'n/a';
        const den = metCol, num = Mm.kind === 'ev' ? ref('ev') : Mm.perShare ? ref('price') : ref('mcap');
        const cond = Mm.kind === 'ev' ? `OR(${num}<=0,${den}<=0)` : `${den}<=0`;
        if (ex) return 'Excluded: ' + (ex.reason || 'no reason given') + (res.status === 'ok' ? ` (${res.v.toFixed(2)}x)` : '');
        return { f: `IF(${cond},"N/M",${num}/(${den}*${ref('fx')}))`, v: res.status === 'ok' ? res.v : 'N/M', s: S.x };
      };
      MULT_COLS.forEach(([id, k]) => put('x_' + id, multCell(id, per(id), ref('m_' + k))));
      // selected multiple at its own period (may differ from the table period)
      const sm = E.metric(c, selM.metric, selM.metric === 'book' ? 'cur' : sel.period, set.normalized !== false);
      put('selMet', isNum(sm.v) ? { v: sm.v, s: selM.metric === 'eps' ? S.px : S.mm } : 'n/a');
      put('sel', multCell(sel.multiple, sel.period, ref('selMet')));
      const w = sel.weights && sel.weights[c.id];
      const so = E.multiple(c, sel.multiple, sel.period, set);
      put('weight', !isTarget && sel.benchmark === 'weighted' ? (isNum(w) && w > 0 && so.status === 'ok' && !(c.excludeObs && c.excludeObs[E.mid(sel.multiple, sel.period)]) ? w : 0) : null);
      return row;
    };
    peers.forEach((c, i) => rows.push(company(c, first + i, false)));
    const last = first + peers.length - 1;
    // outlier flags from the engine
    const col = b.col;
    peers.forEach((c, i) => {
      const o = col.obs.find(x => x.id === c.id); const notes = [];
      if (o && o.outlier) notes.push('Outlier on ' + b.label + ' (flagged, still counted unless excluded)');
      Object.entries(c.excludeObs || {}).forEach(([k, x]) => notes.push('Excluded ' + E.multLabel(E.splitMid(k).id, E.splitMid(k).p) + ': ' + (x.reason || '')));
      if (c.reason) notes.push('Why included: ' + c.reason);
      rows[first - 1 + i][C.flag] = notes.join('; ');
    });
    rows.push([]);
    const statRow = {};
    const rng = k => peers.length ? `${L(k)}${first}:${L(k)}${last}` : null;
    const STATS = [['min', 'Minimum', 'MIN(@)'], ['q1', '25th percentile (QUARTILE.INC)', 'QUARTILE.INC(@,1)'], ['mean', 'Mean', 'AVERAGE(@)'], ['median', 'Median', 'MEDIAN(@)'], ['q3', '75th percentile (QUARTILE.INC)', 'QUARTILE.INC(@,3)'], ['max', 'Maximum', 'MAX(@)'], ['n', 'Valid observations counted', 'COUNT(@)']];
    const statCols = MULT_COLS.filter(([id]) => per(id)).map(([id]) => ['x_' + id, id, per(id)]).concat([['sel', sel.multiple, sel.period]]);
    STATS.forEach(([k, label, fx]) => {
      const r = rows.length + 1; statRow[k] = r;
      const row = []; row[C.name] = { v: label, s: S.b }; row[C.status] = 'Peers in group';
      statCols.forEach(([ck, id, p]) => {
        const R = rng(ck); if (!R) return;
        const st = E.column(m, id, p).stats;
        const cached = st.n ? st[k] : (k === 'n' ? 0 : null);
        row[C[ck]] = { f: fx.replace('@', R), v: isNum(cached) ? cached : undefined, s: k === 'n' ? 0 : S.x };
        if (!st.n && k !== 'n') row[C[ck]] = 'n/a: no valid observations';
      });
      rows.push(row);
    });
    rows.push([]);
    rows.push([{ v: 'Target (not included in the statistics)', s: S.b }]);
    const tRow = rows.length + 1;
    rows.push(company(t, tRow, true));
    const excluded = m.peers.filter(p => !peers.includes(p));
    if (excluded.length) {
      rows.push([]); rows.push([{ v: 'Peers outside the selected group (not in the statistics)', s: S.b }]);
      excluded.forEach(p => rows.push([p.ticker || '', p.name || '', p.status || '', p.reason ? 'Reason: ' + p.reason : 'No reason recorded']));
    }
    const comps = { name: 'Comps', rows, widths: cols.map((h, i) => i === 1 ? 30 : i === C.flag ? 60 : 14), freeze: [2, HDR] };

    // ---------- Valuation sheet (formulas into the Comps sheet) ----------
    const V = []; const cref = (k, r) => `Comps!$${L(k)}$${r}`;
    V.push([{ v: 'Implied valuation', s: S.title }]);
    V.push([{ v: 'Every figure below is a formula on the Comps sheet. Change an input there and the valuation recalculates.', s: S.note }]);
    V.push([]);
    const imp = E.implied(m, b.selected);
    const vr = {}; const line = (k, label, cell, note) => { vr[k] = V.length + 1; V.push([label, cell, note ? { v: note, s: S.note } : null]); };
    line('mult', 'Multiple', b.label);
    line('bench', 'Benchmark', E.BENCH[sel.benchmark] || sel.benchmark, b.note);
    const sr = statRow[{ median: 'median', mean: 'mean', q1: 'q1', q3: 'q3' }[sel.benchmark]];
    let baseCell;
    if (sr && b.col.stats.n) baseCell = { f: cref('sel', sr), v: b.base, s: S.x };
    else if (sel.benchmark === 'weighted' && isNum(b.base)) baseCell = { f: `SUMPRODUCT(${cref('sel', first)}:${cref('sel', last).replace('Comps!', '')},${cref('weight', first)}:${cref('weight', last).replace('Comps!', '')})/SUM(${cref('weight', first)}:${cref('weight', last).replace('Comps!', '')})`, v: b.base, s: S.x };
    else if (sel.benchmark === 'manual' && isNum(b.base)) baseCell = { v: b.base, s: S.x };
    else baseCell = 'n/a';
    line('base', 'Benchmark multiple', baseCell);
    line('prem', 'Premium (+) / discount (−)', { v: b.premium || 0, s: S.pct }, Object.values(sel.premiumWhy || {}).filter(Boolean).join('; ') || (b.premium ? 'No justification recorded' : ''));
    const B = k => `$B$${vr[k]}`;
    line('selm', 'Selected multiple', isNum(b.selected) ? { f: `${B('base')}*(1+${B('prem')})`, v: b.selected, s: S.x } : 'n/a');
    line('met', cols[C.selMet].replace('Selected metric: ', 'Target ') + (set.normalized ? ' (normalised)' : ''), { f: cref('selMet', tRow), v: (rows[tRow - 1][C.selMet] || {}).v, s: selM.metric === 'eps' ? S.px : S.mm });
    line('fx', 'FX rate', { f: cref('fx', tRow), v: E.fxOf(t).rate || undefined, s: S.fx });
    line('sh', 'Shares used (mm)', { f: cref('shUsed', tRow), v: isNum(E.sharesOf(t, set).v) ? E.sharesOf(t, set).v : undefined, s: S.mm });
    line('price', 'Current share price', { f: cref('price', tRow), v: E.val(t, 'price') || undefined, s: S.px }, t.priceDate ? 'Observed ' + t.priceDate : 'Price date not recorded');
    const ok = isNum(b.selected) && !imp.error;
    if (selM.kind === 'ev') {
      line('ev', 'Implied enterprise value (mm)', ok || isNum(imp.ev) ? { f: `${B('selm')}*${B('met')}*${B('fx')}`, v: imp.ev, s: S.mm } : 'n/a');
      line('net', 'Less net claims (mm, price ccy)', { f: `${cref('net', tRow)}*${B('fx')}`, v: isNum((rows[tRow - 1][C.net] || {}).v) && isNum(E.fxOf(t).rate) ? rows[tRow - 1][C.net].v * E.fxOf(t).rate : undefined, s: S.mm }, 'Debt and debt-like claims minus cash and non-operating assets (see the bridge below)');
      line('eq', 'Implied equity value (mm)', { f: `${B('ev')}-${B('net')}`, v: imp.equity, s: S.mm });
      line('ps', 'Implied value per share', { f: `${B('eq')}/${B('sh')}`, v: imp.perShare, s: S.pxb });
    } else if (selM.perShare) {
      line('ps', 'Implied value per share (no EV bridge)', { f: `${B('selm')}*${B('met')}*${B('fx')}`, v: imp.perShare, s: S.pxb });
      line('eq', 'Implied equity value (mm)', { f: `${B('ps')}*${B('sh')}`, v: imp.equity, s: S.mm }, set.shareBasis === 'basic' ? 'Diluted EPS × basic shares: reference only' : '');
    } else {
      line('eq', 'Implied equity value (mm, no EV bridge)', { f: `${B('selm')}*${B('met')}*${B('fx')}`, v: imp.equity, s: S.mm });
      line('ps', 'Implied value per share', { f: `${B('eq')}/${B('sh')}`, v: imp.perShare, s: S.pxb });
    }
    line('up', 'Upside / downside', { f: `${B('ps')}/${B('price')}-1`, v: imp.upside, s: S.pct });
    if (imp.error) V.push([{ v: 'Not complete in the app: ' + imp.error, s: S.note }]);
    // per-share formula for any multiple expression
    const psF = (mx, metX = B('met')) => selM.kind === 'ev' ? `(${mx}*${metX}*${B('fx')}-${B('net')})/${B('sh')}` : selM.perShare ? `${mx}*${metX}*${B('fx')}` : `${mx}*${metX}*${B('fx')}/${B('sh')}`;
    if (selM.kind === 'ev' && imp.bridge) {
      V.push([]); V.push([{ v: 'Equity bridge (price currency, mm)', s: S.b }]);
      E.EV_LINES.forEach(Ln => { if (!E.lineIncluded(t, Ln, set) || !isNum(E.val(t, Ln.key))) return; V.push([(Ln.sign > 0 ? 'Less ' : 'Add ') + Ln.label, { f: `${Ln.sign > 0 ? '-' : ''}${cref(Ln.key, tRow)}*${B('fx')}`, v: -Ln.sign * E.val(t, Ln.key) * (E.fxOf(t).rate || 1), s: S.mm }]); });
      (imp.notReported || []).forEach(k => V.push([E.EV_LINES.find(x => x.key === k).label, 'not reported (left out, not set to zero)']));
    }
    // range
    V.push([]); V.push([{ v: 'Valuation range (peer quartiles)', s: S.b }, { v: 'Multiple', s: S.b }, { v: 'Value per share', s: S.b }, { v: 'Upside', s: S.b }]);
    const rg = E.range(m);
    rg.rows.forEach(r => { const st = statRow[r.key]; const rr = V.length + 1; V.push([r.name, b.col.stats.n ? { f: cref('sel', st), v: r.mult, s: S.x } : 'n/a', isNum(r.perShare) ? { f: psF(`B${rr}`), v: r.perShare, s: S.px } : 'n/a', isNum(r.upside) ? { f: `C${rr}/${B('price')}-1`, v: r.upside, s: S.pct } : 'n/a']); });
    rg.arows.forEach(r => { const rr = V.length + 1; V.push([r.name, { v: r.mult, s: S.x }, isNum(r.perShare) ? { f: psF(`B${rr}`), v: r.perShare, s: S.px } : 'n/a', isNum(r.upside) ? { f: `C${rr}/${B('price')}-1`, v: r.upside, s: S.pct } : 'n/a']); });
    if ((sel.analyst || {}).why) V.push([{ v: 'Analyst range reasoning: ' + sel.analyst.why, s: S.note }]);
    // sensitivity
    const sg = E.sensGrid(m, Object.assign({}, m.sens));
    if (!sg.error && sg.grid.length) {
      V.push([]); V.push([{ v: `Sensitivity: value per share by ${b.label} (rows) and change in the target metric (columns)`, s: S.b }]);
      const hr = V.length + 1; V.push([null].concat(sg.deltas.map(d => ({ v: d, s: S.pct }))));
      sg.mults.forEach((mu, i) => { const rr = V.length + 1; V.push([{ v: mu, s: S.x }].concat(sg.deltas.map((d, j) => { const cl = colName(j + 1); const r = sg.grid[i][j]; return isNum(r.perShare) ? { f: psF(`$A${rr}`, `${B('met')}*(1+${cl}$${hr})`), v: r.perShare, s: S.px } : 'n/a'; }))); });
    }
    const valuation = { name: 'Valuation', rows: V, widths: [52, 18, 18, 14, 14, 14, 14, 14] };

    // ---------- Adjustments ----------
    const A = [[{ v: 'Financial adjustments (normalisation)', s: S.title }], [{ v: 'Each amount is added to the reported figure in the Comps sheet when metrics are normalised. A positive amount adds back an expense.', s: S.note }], ['Company', 'Metric', 'Period', 'Type', 'Amount (mm)', 'Recurring?', 'Reason', 'Source'].map(v => ({ v, s: S.b }))];
    [t].concat(m.peers).forEach(c => (c.adj || []).forEach(a => A.push([nameOf(c), (E.METRICS[a.metric] || {}).label || a.metric, E.PERIODS[a.period] || a.period, a.type || '', isNum(a.amount) ? { v: a.amount, s: S.mm } : 'n/a', a.recurring ? 'Yes' : 'No', a.reason || 'NO REASON RECORDED', a.source || 'NO SOURCE RECORDED'])));
    if (A.length === 3) A.push(['No adjustments: reported figures are used.']);
    const adjust = { name: 'Adjustments', rows: A, widths: [14, 20, 10, 28, 14, 10, 50, 40] };

    // ---------- Sources ----------
    const SR = [[{ v: 'Sources and data status', s: S.title }], [{ v: 'Status shows how each figure was obtained. Manual entries and estimates are not independently verified. Proposed updates waiting for review are listed at the bottom and are NOT used in any calculation.', s: S.note }], ['Company', 'Figure', 'Value', 'Unit', 'Status', 'Provider', 'Period / as of', 'Filing', 'Method / note', 'Link'].map(v => ({ v, s: S.b }))];
    [t].concat(m.peers).forEach(c => Object.entries(c.v || {}).forEach(([k, r]) => {
      if (!r || !isNum(r.v)) return; const s = r.src || {};
      SR.push([nameOf(c), D.label(k), r.v, s.unit || '', SRC_CAT[s.cat] || s.cat || 'unknown', s.provider || '', s.asOf || s.period || '', [s.form, s.accn, s.filed].filter(Boolean).join(' '), [s.method, s.stale ? 'STALE: ' + (s.staleNote || '') : '', s.definition].filter(Boolean).join(' '), s.url || '']);
    }));
    const pend = [t].concat(m.peers).filter(c => c.pending && c.pending.items && c.pending.items.length);
    if (pend.length) {
      SR.push([]); SR.push([{ v: 'PROPOSED UPDATES WAITING FOR REVIEW (not used in the calculations)', s: S.b }]);
      SR.push(['Company', 'Figure', 'Current value (used)', 'Proposed value (not used)', 'Provider', 'Overrides a manual entry?'].map(v => ({ v, s: S.b })));
      pend.forEach(c => c.pending.items.forEach(p => SR.push([nameOf(c), D.label(p.key), p.from, p.to, (p.src && p.src.provider) || c.pending.provider || '', p.manual ? 'Yes' : 'No'])));
    }
    const sources = { name: 'Sources', rows: SR, widths: [12, 34, 16, 18, 26, 30, 26, 30, 60, 50] };

    // ---------- Notes & definitions ----------
    const N = [[{ v: 'Notes, settings and definitions', s: S.title }]];
    const kv = (k, v) => N.push([{ v: k, s: S.b }, v === null || v === undefined || v === '' ? '—' : v]);
    kv('Model', m.name); kv('Target', `${t.name || ''}${t.ticker ? ' (' + t.ticker + ')' : ''}`); kv('Price observation date', t.priceDate || 'not recorded');
    kv('Valuation conclusion', m.conclusion || 'not written');
    kv('Reason for the multiple', sel.why || 'not recorded'); kv('Multiple confirmed by the analyst', sel.confirmed ? 'Yes' : 'No');
    kv('Peer group', E.groupLabel(m, sel.group)); kv('Operating lease policy', set.leasePolicy === 'include' ? 'Include operating lease liabilities in EV (use EBITDA before lease cost consistently)' : 'Exclude operating lease liabilities from EV (EBITDA after lease cost)');
    kv('Share basis', set.shareBasis === 'diluted' ? 'Basic shares + net dilutive shares' : 'Basic shares outstanding (cover-page count, not a weighted average)');
    kv('TTM', 'Last fiscal year + current year-to-date − prior year-to-date (same length).');
    kv('NTM', 'Time-weighted blend of FY+1 and FY+2 estimates; not the same as FY+1.');
    kv('N/M', 'Not meaningful: the denominator (or EV) is zero or negative. Excluded from the statistics automatically.');
    kv('Outliers', 'Flagged with Tukey fences (Q1 − k×IQR, Q3 + k×IQR) when at least four observations exist. Never removed automatically; an observation leaves the statistics only when the analyst excludes it with a reason.');
    if (m.dcfLink) kv('Linked DCF model', m.dcfLink);
    Object.entries(m.notes || {}).forEach(([k, v]) => { if (v && String(v).trim()) kv('Note: ' + k, v); });
    N.push([]); N.push([{ v: 'Peer selection', s: S.b }]);
    m.peers.forEach(p => N.push([`${p.ticker || ''} ${p.name || ''}`.trim(), `${p.status || ''}${p.reason ? ': ' + p.reason : ' (no reason recorded)'}`]));
    const notesSheet = { name: 'Notes', rows: N, widths: [36, 110] };
    return [valuation, comps, adjust, sources, notesSheet];
  }

  async function xlsx(JSZip, model) { return writeBook(JSZip, build(model)); }

  // ---------- notes (Markdown) ----------
  const f2 = (v, d = 2) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'n/a';
  const fp = v => isNum(v) ? (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%' : 'n/a';
  function notesMarkdown(model) {
    const m = model, t = m.target, sel = m.selection;
    const b = E.benchmark(m), imp = E.implied(m, b.selected), rg = E.range(m), st = b.col.stats;
    const L = [];
    L.push(`# Trading Comps: ${m.name}`, '', `Target: **${t.name || 'not set'}${t.ticker ? ' (' + t.ticker + ')' : ''}**. Price ${f2(E.val(t, 'price'))} ${t.priceCurrency || ''}${t.priceDate ? ' observed ' + t.priceDate : ' (date not recorded)'}. Exported ${new Date().toISOString().slice(0, 10)}.`, '');
    L.push('## Valuation', '', `- Multiple: ${b.label}; benchmark: ${E.BENCH[sel.benchmark] || sel.benchmark} (${b.note})`, `- Peer statistics (n = ${st.n}): min ${f2(st.min)}x, Q1 ${f2(st.q1)}x, median ${f2(st.median)}x, mean ${f2(st.mean)}x, Q3 ${f2(st.q3)}x, max ${f2(st.max)}x`, `- Premium / discount: ${fp(b.premium)}${b.premium ? ' — ' + (Object.values(sel.premiumWhy || {}).filter(Boolean).join('; ') || 'no justification recorded') : ''}`, `- Selected multiple: ${f2(b.selected)}x`);
    if (imp.error) L.push(`- **Not complete:** ${imp.error}`); else { imp.steps.forEach(s => L.push(`- ${s.label}: ${s.formula} = ${s.pct ? fp(s.v) : f2(s.v)}`)); }
    imp.warnings && imp.warnings.forEach(w => L.push(`- Note: ${w}`));
    L.push('', '## Range', '', '| Case | Multiple | Value per share | Upside |', '|---|---|---|---|');
    rg.rows.concat(rg.arows).forEach(r => L.push(`| ${r.name} | ${f2(r.mult)}x | ${f2(r.perShare)} | ${fp(r.upside)} |`));
    L.push('', '## Peers', '', '| Ticker | Company | Status | ' + b.label + ' | Flags | Reason |', '|---|---|---|---|---|---|');
    m.peers.forEach(p => { const o = b.col.obs.find(x => x.id === p.id); const mv = o ? (o.m.status === 'ok' ? f2(o.m.v) + 'x' : o.m.status === 'nm' ? 'N/M' : 'n/a') : '—'; L.push(`| ${p.ticker || ''} | ${p.name || ''} | ${p.status} | ${mv} | ${[o && o.outlier ? 'outlier (flagged)' : '', o && o.excluded ? 'excluded: ' + o.exReason : ''].filter(Boolean).join('; ')} | ${(p.reason || 'no reason recorded').replace(/\|/g, '/')} |`); });
    const adj = [t].concat(m.peers).flatMap(c => (c.adj || []).map(a => Object.assign({ who: nameOf(c) }, a)));
    if (adj.length) { L.push('', '## Adjustments', ''); adj.forEach(a => L.push(`- ${a.who} ${a.metric} ${a.period}: ${f2(a.amount, 1)} mm (${a.type || ''}). Reason: ${a.reason || 'not recorded'}. Source: ${a.source || 'not recorded'}.`)); }
    L.push('', '## Reasoning', '', `- Why this multiple: ${sel.why || 'not recorded'}`, `- Analyst range: ${(sel.analyst || {}).why || 'not recorded'}`, `- Conclusion: ${m.conclusion || 'not written'}`);
    const notes = Object.entries(m.notes || {}).filter(([, v]) => v && String(v).trim());
    if (notes.length) { L.push('', '## Research notes', ''); notes.forEach(([k, v]) => L.push(`- **${k}**: ${String(v).replace(/\n+/g, ' ')}`)); }
    const pend = [t].concat(m.peers).filter(c => c.pending && c.pending.items && c.pending.items.length);
    if (pend.length) { L.push('', '## Waiting for review (not used)', ''); pend.forEach(c => c.pending.items.forEach(p => L.push(`- ${nameOf(c)} ${D.label(p.key)}: ${p.from} → ${p.to} proposed by ${(p.src && p.src.provider) || c.pending.provider || 'import'}`))); }
    const man = [t].concat(m.peers).flatMap(c => Object.entries(c.v || {}).filter(([, r]) => r && r.src && r.src.cat === 'manual').map(([k]) => nameOf(c) + ' ' + D.label(k)));
    if (man.length) L.push('', '## Manual entries (not independently verified)', '', man.map(x => '- ' + x).join('\n'));
    L.push('', '_This is a relative valuation from how comparable companies trade. It is not an investment recommendation._', '');
    return L.join('\n');
  }

  // ---------- printable summary (opened in a new window and printed to PDF) ----------
  function printHtml(model) {
    const m = model, t = m.target, set = m.settings;
    const b = E.benchmark(m), imp = E.implied(m, b.selected), rg = E.range(m), st = b.col.stats;
    const h = s => xesc(s == null ? '' : s);
    const peers = E.peerSet(m);
    const rowsP = peers.map(p => { const o = b.col.obs.find(x => x.id === p.id); const e = E.evBuild(p, set); return `<tr><td>${h(p.ticker)}</td><td>${h(p.name)}</td><td class="n">${f2(E.marketCap(p, set).v, 0)}</td><td class="n">${f2(e.v, 0)}</td><td class="n">${o ? (o.m.status === 'ok' ? f2(o.m.v) + 'x' : o.m.status === 'nm' ? 'N/M' : 'n/a') : '—'}</td><td>${o && o.outlier ? 'outlier (flagged)' : ''}${o && o.excluded ? ' excluded: ' + h(o.exReason) : ''}</td></tr>`; }).join('');
    const stepRows = imp.error ? `<tr><td colspan="2"><b>Not complete:</b> ${h(imp.error)}</td></tr>` : imp.steps.map(s => `<tr><td>${h(s.label)}<div class="f">${h(s.formula)}</div></td><td class="n">${s.pct ? fp(s.v) : f2(s.v)}</td></tr>`).join('');
    const rr = rg.rows.concat(rg.arows).map(r => `<tr><td>${h(r.name)}</td><td class="n">${f2(r.mult)}x</td><td class="n">${f2(r.perShare)}</td><td class="n">${fp(r.upside)}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${h(m.name)} · Trading Comps</title><style>
body{font:12px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:24px;background:#fff}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
table{border-collapse:collapse;width:100%;margin:4px 0}td,th{border-bottom:1px solid #e3e3e3;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f3f3}.n{text-align:right;font-variant-numeric:tabular-nums}.f{color:#555;font-size:11px}.muted{color:#555}.big{font-size:22px;font-weight:700}
@media print{body{margin:10mm}h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body>
<h1>Trading Comps: ${h(t.name || m.name)}${t.ticker ? ' (' + h(t.ticker) + ')' : ''}</h1>
<p class="muted">${h(m.name)} · price ${f2(E.val(t, 'price'))} ${h(t.priceCurrency || '')}${t.priceDate ? ' observed ' + h(t.priceDate) : ' (date not recorded)'} · peer group: ${h(E.groupLabel(m, b.sel.group))} · printed ${new Date().toISOString().slice(0, 10)}</p>
<p><span class="big">${isNum(imp.perShare) ? f2(imp.perShare) : 'Incomplete'}</span> ${isNum(imp.upside) ? ' implied value per share, ' + fp(imp.upside) + ' vs the current price' : ''}</p>
<h2>Multiple and benchmark</h2><p>${h(b.label)} · ${h(E.BENCH[b.sel.benchmark] || '')}: ${h(b.note)} Statistics (n = ${st.n}): min ${f2(st.min)}x, Q1 ${f2(st.q1)}x, median ${f2(st.median)}x, mean ${f2(st.mean)}x, Q3 ${f2(st.q3)}x, max ${f2(st.max)}x. Premium/discount ${fp(b.premium)}. Selected ${f2(b.selected)}x.</p>
${m.selection.why ? `<p><b>Why this multiple:</b> ${h(m.selection.why)}</p>` : ''}
<h2>Implied valuation</h2><table>${stepRows}</table>
<h2>Range</h2><table><tr><th>Case</th><th class="n">Multiple</th><th class="n">Value per share</th><th class="n">Upside</th></tr>${rr}</table>
<h2>Peers</h2><table><tr><th>Ticker</th><th>Company</th><th class="n">Market cap (mm)</th><th class="n">EV (mm)</th><th class="n">${h(b.label)}</th><th>Flags</th></tr>${rowsP}</table>
<h2>Conclusion</h2><p>${h(m.conclusion || 'Not written.')}</p>
<p class="muted">Relative valuation from how comparable public companies trade, using the data and judgements recorded in this model. Not an investment recommendation.</p>
</body></html>`;
  }

  return { xlsx, build, notesMarkdown, printHtml, _colName: colName };
})();
if (typeof module !== 'undefined') module.exports = CompsExport;
