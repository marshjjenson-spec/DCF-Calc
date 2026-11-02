// ===== THREE-STATEMENT MODEL EXPORT: Excel workbook with live formulas, printable report =====
// One model sheet per scenario stacks the income statement, balance sheet, cash flow statement and the
// supporting schedules. Each forecast cell that follows from the assumptions or from other lines is an
// Excel formula pointing at the Assumptions sheet and at other cells, with the app's own result stored as
// the cached value, so Excel opens showing the same numbers and recalculates from the inputs.
// Items solved by the app's schedules (interest with the revolver, taxes with loss carryforwards, debt
// tranche flows, deferred taxes, vintage depreciation) are written as values and labelled "Schedule value".
// Historical figures are written as values with their source on the Historical data sheet. Missing data
// stays blank; nothing is filled with zero.
const FsmExport = (() => {
  const E = typeof FsmEngine !== 'undefined' ? FsmEngine : require('./fsm-engine.js');
  const isNum = E.isNum, N = E.N, SC = E.SC;
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  // ---------- minimal xlsx writer (same format as the Trading Comps export) ----------
  // Styles: 0 default, 1 bold, 2 #,##0.0, 3 0.00 (per share), 4 0.0%, 5 #,##0.0 blue (input), 6 title, 7 italic note, 8 #,##0.0 bold, 9 0.0% blue (input), 10 0.0 (days)
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.0;(#,##0.0)"/><numFmt numFmtId="165" formatCode="0.00"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF1F4FD1"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="166" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const ST = { b: 1, mm: 2, ps: 3, pct: 4, inMm: 5, title: 6, note: 7, mmb: 8, inPct: 9, inDays: 10 };
  function cellXml(ref, c) {
    if (c === null || c === undefined || c === '') return '';
    if (typeof c !== 'object') c = { v: c };
    const s = c.s ? ` s="${c.s}"` : '';
    if (c.f) {
      const f = `<f>${xesc(c.f.replace(/^=/, ''))}</f>`;
      if (isNum(c.v)) return `<c r="${ref}"${s}>${f}<v>${c.v}</v></c>`;
      return `<c r="${ref}"${s}>${f}</c>`;
    }
    if (isNum(c.v)) return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
    if (c.v === null || c.v === undefined) return '';
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xesc(c.v)}</t></is></c>`;
  }
  function sheetXml(sh) {
    const rows = sh.rows.map((r, i) => { const cells = (r || []).map((c, j) => cellXml(colName(j) + (i + 1), c)).join(''); return cells ? `<row r="${i + 1}">${cells}</row>` : ''; }).join('');
    const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const pane = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${sh.freeze[0]}" ySplit="${sh.freeze[1]}" topLeftCell="${colName(sh.freeze[0])}${sh.freeze[1] + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`;
  }
  async function writeBook(JSZip, sheets, title) {
    const z = new JSZip();
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
    z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
    z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xesc(title)}</dc:title><dc:creator>DCF Pro</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`);
    z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    z.file('xl/styles.xml', STYLES);
    sheets.forEach((s, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
    return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  // ---------- Assumptions sheet ----------
  // Columns: A label, B unit, C..L years 1-10. Returns the sheet and an address lookup.
  const unitStyle = u => u === 'pct' ? ST.inPct : u === 'days' ? ST.inDays : ST.inMm;
  function assumptionsSheet(model) {
    const rows = [[{ v: 'Assumptions', s: ST.title }], [{ v: 'Blue cells are inputs. Changing them recalculates the formula cells on the scenario sheets; items marked "Schedule value" there are recalculated only in the app.', s: ST.note }], []];
    const addr = { sc: {}, sh: {}, k: {} };
    const head = ['Driver', 'Unit'].concat(Array.from({ length: N }, (_, i) => 'Year ' + (i + 1)));
    const dmap = {}; E.DRIVERS.forEach(d => { dmap[d.k] = d; });
    SC.forEach(s => {
      rows.push([{ v: s + ' scenario', s: ST.b }]); rows.push(head.map(v => ({ v, s: ST.b })));
      addr.sc[s] = {};
      E.SC_KEYS.forEach(k => { const d = dmap[k]; const arr = (model.asm[s] || {})[k] || []; rows.push([d.l, d.u].concat(Array.from({ length: N }, (_, i) => isNum(arr[i]) ? { v: arr[i], s: unitStyle(d.u) } : null))); addr.sc[s][k] = rows.length; });
      rows.push([]);
    });
    rows.push([{ v: 'Shared by all scenarios', s: ST.b }]); rows.push(head.map(v => ({ v, s: ST.b })));
    E.SH_KEYS.forEach(k => { const d = dmap[k] || { l: k, u: 'mm' }; const arr = (model.shared || {})[k] || []; rows.push([d.l, d.u].concat(Array.from({ length: N }, (_, i) => isNum(arr[i]) ? { v: arr[i], s: unitStyle(d.u) } : null))); addr.sh[k] = rows.length; });
    rows.push([]);
    rows.push([{ v: 'Constants', s: ST.b }]);
    const K = [['days', 'Days in year', model.settings.days || 365, ST.inMm], ['price0', 'Current share price (for buybacks)', model.equity && model.equity.price0, ST.inMm], ['gwShare', 'Acquisitions: share to goodwill', (model.acqAlloc || {}).gw, ST.inPct], ['intShare', 'Acquisitions: share to intangible assets', (model.acqAlloc || {}).intang, ST.inPct]];
    K.forEach(([k, l, v, s]) => { rows.push([l, '', isNum(v) ? { v, s } : null]); addr.k[k] = 'Assumptions!$C$' + rows.length; });
    const yc = i => colName(2 + i);
    return { sheet: { name: 'Assumptions', rows, widths: [52, 8].concat(Array(N).fill(11)), freeze: [2, 3] }, sc: (s, k, i) => `Assumptions!${yc(i)}${addr.sc[s][k]}`, sh: (k, i) => `Assumptions!${yc(i)}${addr.sh[k]}`, k: k => addr.k[k] };
  }

  // ---------- scenario sheet ----------
  // Line definitions: [key, label, kind] kind: 'h' heading, 'pct', 'ps', 'sh' shares, otherwise $mm.
  // f(c) returns a formula for forecast column c (c.y = this column, c.p = prior column, c.i = year index), or null for a value.
  function scenarioSheet(model, res, s, AS) {
    const S = model.settings, emb = S.daPresentation !== 'separate', retire = S.buyback === 'retire', reinv = S.flReinvest !== false;
    const avg = S.interest === 'average', vint = S.depMethod === 'vintage', segs = S.segments && (model.segments || []).length;
    const h = model.hist, P = h.periods.concat(h.ttm ? [h.ttm] : []);
    const hp = P.map(p => E.histPeriod(h, p.id, S));
    const x = res.x;
    const C0 = 2, HC = P.length, OC = C0 + HC, F0 = OC + 1; // hist columns start at C, then Opening, then years
    const col = i => colName(F0 + i), opn = colName(OC);
    const A = (k, i) => AS.sc(s, k, i), SH = (k, i) => AS.sh(k, i), K = AS.k;
    const rows = [];
    const R = {}; // key -> row number
    const L = []; // definitions in order
    const add = (k, l, f, o = {}) => L.push(Object.assign({ k, l, f }, o));
    const head = l => L.push({ head: l });
    // Income statement
    head('Income statement');
    add('rev', 'Revenue', segs ? null : c => `${c.p}rev*(1+${A('g', c.i)})`, { tot: true });
    add('cogs', 'Cost of revenue', c => emb ? `cogsX+da*wCogs` : `cogsX`);
    add('gp', 'Gross profit', c => `rev-cogs`, { tot: true });
    add('gm', 'Gross margin', c => `gp/rev`, { u: 'pct' });
    add('rnd', 'Research & development', c => emb ? `rndX+da*wRnd` : `rndX`);
    add('sga', 'Selling, general & administrative', c => emb ? `sgaX+da*wSga` : `sgaX`);
    add('oth', 'Other operating expenses (incl. impairments)', c => emb ? `othX+da*wOth+impair` : `othX+impair`);
    if (!emb) add('daLine', 'Depreciation & amortization', c => `da`);
    add('opex', 'Total operating expenses', c => emb ? `rnd+sga+oth` : `rnd+sga+oth+daLine`);
    add('ebit', 'Operating income (EBIT)', c => `gp-opex`, { tot: true });
    add('ebitda', 'EBITDA', c => `ebit+da+impair`);
    add('intInc', 'Interest income', null, { sched: true });
    add('intExp', 'Interest expense', null, { sched: true });
    add('nonop', 'Other nonoperating income (expense)', c => `${SH('nonop', c.i)}`);
    add('pbt', 'Pretax income', c => `ebit+intInc-intExp+nonop`, { tot: true });
    add('tax', 'Income tax expense', null, { sched: true });
    add('eqinc', 'Equity-method income, net of tax', c => `${SH('eqinc', c.i)}`);
    add('ni', 'Net income', c => `pbt-tax+eqinc`, { tot: true });
    add('niNci', 'Attributable to noncontrolling interests', c => `ni*${SH('nciPct', c.i)}`);
    add('niParent', 'Attributable to the company', c => `ni-niNci`);
    add('prefDiv', 'Preferred dividends', c => `${SH('prefDiv', c.i)}`);
    add('niCommon', 'Net income to common shareholders', c => `niParent-prefDiv`, { tot: true });
    add('waBasic', 'Weighted-average basic shares (mm)', c => `(sharesBeg+sharesEnd)/2`, { u: 'sh' });
    add('waDil', 'Weighted-average diluted shares (mm)', c => `waBasic+${SH('dilutive', c.i)}`, { u: 'sh' });
    add('epsBasic', 'Basic EPS', c => `niCommon/waBasic`, { u: 'ps' });
    add('epsDil', 'Diluted EPS (basic in a loss year)', c => `IF(niCommon>=0,niCommon/waDil,niCommon/waBasic)`, { u: 'ps' });
    // Balance sheet
    head('Balance sheet');
    add('cash', 'Cash and cash equivalents', c => `${c.p}cash+dCash`);
    add('sti', 'Short-term investments', c => `${SH('sti', c.i)}`);
    add('ar', 'Accounts receivable', c => `rev/${K('days')}*${A('dso', c.i)}`);
    add('inv', 'Inventory', c => `cogs/${K('days')}*${A('dio', c.i)}`);
    add('oca', 'Other current assets', c => `rev*${A('oca', c.i)}`);
    add('tca', 'Total current assets', c => `cash+sti+ar+inv+oca`, { tot: true });
    add('ppe', 'Property, plant & equipment, net', c => `${c.p}ppe+capex+flAdd+acqPpe-dep-disposals-impair`);
    add('rou', 'Operating lease right-of-use assets', c => `${c.p}rou+(opl-${c.p}opl)`);
    add('gw', 'Goodwill', c => `${c.p}gw+acqGw`);
    add('intang', 'Intangible assets, net', c => `${c.p}intang+acqInt-amort`);
    add('dta', 'Deferred tax assets', null, { sched: true });
    add('olta', 'Other long-term assets', c => `${c.p}olta+${SH('oltaChg', c.i)}+eqinc`);
    add('ta', 'Total assets', c => `tca+ppe+rou+gw+intang+dta+olta`, { tot: true });
    add('ap', 'Accounts payable', c => `cogs/${K('days')}*${A('dpo', c.i)}`);
    add('accr', 'Accrued operating liabilities', c => `rev*${A('accr', c.i)}`);
    add('defrev', 'Deferred revenue', c => `rev*${A('defrev', c.i)}`);
    add('std', 'Short-term debt (incl. revolver)', null, { sched: true });
    add('cltd', 'Current portion of long-term debt', null, { sched: true });
    add('ocl', 'Other current liabilities', c => `rev*${A('ocl', c.i)}`);
    add('tcl', 'Total current liabilities', c => `ap+accr+defrev+std+cltd+ocl`, { tot: true });
    add('ltd', 'Long-term debt', null, { sched: true });
    add('opl', 'Operating lease liabilities', c => `rev*${SH('opl', c.i)}`);
    add('finl', 'Finance lease liabilities', c => `${c.p}finl+flAdd-flPrin`);
    add('dtl', 'Deferred tax liabilities', null, { sched: true });
    add('oltl', 'Other long-term liabilities', c => `${c.p}oltl+${SH('oltlChg', c.i)}`);
    add('tl', 'Total liabilities', c => `tcl+ltd+opl+finl+dtl+oltl`, { tot: true });
    add('cs', 'Common stock', c => `${c.p}cs`);
    add('apic', 'Additional paid-in capital', c => `${c.p}apic+sbc+${SH('issue', c.i)}`);
    add('re', 'Retained earnings', c => `${c.p}re+niParent-div-prefDiv` + (retire ? `-${SH('buyback', c.i)}` : ''));
    add('treas', 'Treasury stock (subtracted)', c => retire ? `${c.p}treas` : `${c.p}treas+${SH('buyback', c.i)}`);
    add('aoci', 'Accumulated other comprehensive income', c => `${c.p}aoci+${SH('aociChg', c.i)}`);
    add('oeq', 'Other equity', c => `${c.p}oeq`);
    add('nci', 'Noncontrolling interests', c => `${c.p}nci+niNci-${SH('nciDist', c.i)}`);
    add('te', 'Total equity', c => `cs+apic+re-treas+aoci+oeq+nci`, { tot: true });
    add('tle', 'Total liabilities and equity', c => `tl+te`, { tot: true });
    add('check', 'Balance check (assets − liabilities − equity)', c => `ta-tl-te`, { check: true });
    // Cash flow statement
    head('Cash flow statement');
    add('cf_ni', 'Net income', c => `ni`);
    add('cf_da', 'Depreciation & amortization', c => `da`);
    add('cf_imp', 'Impairments (non-cash)', c => `impair`);
    add('cf_sbc', 'Stock-based compensation', c => `sbc`);
    add('defTax', 'Deferred income taxes', null, { sched: true });
    add('dNwcCf', 'Changes in operating working capital', c => `-(nwc-${c.p}nwc)`);
    add('cf_oltl', 'Change in other long-term liabilities', c => `${SH('oltlChg', c.i)}`);
    add('cf_eq', 'Less: equity-method income (non-cash)', c => `-eqinc`);
    add('cfo', 'Net cash from operating activities', c => `cf_ni+cf_da+cf_imp+cf_sbc+defTax+dNwcCf+cf_oltl+cf_eq`, { tot: true });
    add('capexCf', 'Capital expenditures', c => `-capex`);
    add('acqCf', 'Acquisitions, net of cash acquired', c => `-acq`);
    add('invCf', 'Purchases and sales of investments, net', c => `-(sti-${c.p}sti)`);
    add('otherCfi', 'Other investing (long-term assets, disposals)', c => `-${SH('oltaChg', c.i)}+disposals`);
    add('cfi', 'Net cash from investing activities', c => `capexCf+acqCf+invCf+otherCfi`, { tot: true });
    add('debtIss', 'Debt issuance (incl. revolver draws)', null, { sched: true });
    add('debtRep', 'Debt repayment (incl. revolver repayments)', null, { sched: true });
    add('buybackCf', 'Share repurchases', c => `-${SH('buyback', c.i)}`);
    add('issueCf', 'Share issuance', c => `${SH('issue', c.i)}`);
    add('divCf', 'Dividends (common, NCI, preferred)', c => `-(div+${SH('nciDist', c.i)}+prefDiv)`);
    add('leaseCf', 'Finance lease principal payments', c => `-flPrin`);
    add('otherCff', 'Other financing activities', c => `${SH('otherFin', c.i)}`);
    add('cff', 'Net cash from financing activities', c => `debtIss+debtRep+buybackCf+issueCf+divCf+leaseCf+otherCff`, { tot: true });
    add('dCash', 'Net change in cash', c => `cfo+cfi+cff`, { tot: true });
    // Schedules
    head('Operating schedule (costs before D&A)');
    add('cogsX', 'Cost of revenue before D&A', c => `rev*(1-${A('gm', c.i)})`);
    add('rndX', 'R&D before D&A', c => `rev*${A('rnd', c.i)}`);
    add('sgaX', 'SG&A before D&A', c => `rev*${A('sga', c.i)}`);
    add('othX', 'Other operating before D&A', c => `rev*${A('oth', c.i)}`);
    add('sbc', 'Stock-based compensation (inside the costs)', c => `rev*${A('sbc', c.i)}`);
    if (emb) { add('wCogs', 'Share of D&A shown in cost of revenue', null, { u: 'pct', sched: true }); add('wRnd', 'Share of D&A shown in R&D', null, { u: 'pct', sched: true }); add('wSga', 'Share of D&A shown in SG&A', null, { u: 'pct', sched: true }); add('wOth', 'Share of D&A shown in other operating', null, { u: 'pct', sched: true }); }
    head('PP&E, intangibles and acquisitions');
    add('maint', 'Maintenance CapEx', c => `rev*${A('maint', c.i)}`);
    add('gcapex', 'Growth CapEx', c => `rev*${A('gcapex', c.i)}`);
    add('capex', 'Total CapEx', c => `maint+gcapex`, { tot: true });
    add('flAdd', 'New finance leases (non-cash PP&E additions)', c => `${SH('flAdd', c.i)}`);
    add('acq', 'Acquisitions', c => `${A('acq', c.i)}`);
    add('acqGw', 'to goodwill', c => `acq*${K('gwShare')}`);
    add('acqInt', 'to intangible assets', c => `acq*${K('intShare')}`);
    add('acqPpe', 'to PP&E', c => `acq-acqGw-acqInt`);
    add('disposals', 'Disposals at net book value', c => `MIN(${SH('disposals', c.i)},${c.p}ppe)`);
    add('impair', 'Impairments', c => `${SH('impair', c.i)}`);
    add('dep', 'Depreciation', vint ? null : S.depMethod === 'pctPPE' ? c => `${c.p}ppe*${A('dep', c.i)}` : c => `rev*${A('dep', c.i)}`, { sched: vint });
    add('amort', 'Amortization of intangibles', c => `MIN(${c.p}intang*${SH('amort', c.i)},${c.p}intang+acqInt)`);
    add('da', 'Total D&A', c => `dep+amort`, { tot: true });
    head('Working capital');
    add('nwc', 'Operating net working capital', c => `ar+inv+oca-ap-accr-defrev-ocl`, { tot: true });
    add('flPrin', 'Finance lease principal repaid', c => `MIN(${c.p}finl*${SH('flRepay', c.i)},${c.p}finl)`);
    head('Shares and distributions');
    add('px', 'Assumed average share price', c => `${K('price0')}*(1+${SH('pxg', c.i)})^${c.i + 0.5}`, { u: 'ps' });
    add('sharesBeg', 'Shares outstanding, beginning (mm)', c => `${c.p}sharesEnd`, { u: 'sh' });
    add('sharesEnd', 'Shares outstanding, end (mm)', c => `sharesBeg+${SH('awards', c.i)}+${SH('issue', c.i)}/px-${SH('buyback', c.i)}/px`, { u: 'sh' });
    add('div', 'Common dividends', model.shared.divMode === 'none' ? c => `0` : model.shared.divMode === 'amount' ? c => `${SH('div', c.i)}` : c => `MAX(0,niCommon)*${SH('div', c.i)}`);
    head('Debt, interest and taxes (schedule values from the app)');
    add('revolver', 'Revolver balance', null, { sched: true });
    add('debt', 'Total debt (excl. leases)', c => `std+cltd+ltd`);
    add('nolUsed', 'Loss carryforwards used', null, { sched: true });
    add('nol', 'Loss carryforwards, end of year', null, { sched: true });
    add('curTax', 'Current (cash) tax', null, { sched: true });
    head('Free cash flow to the firm');
    add('opTax', 'Operating taxes on EBIT', c => `IF(ebit>0,ebit*${A('tax', c.i)},0)`);
    add('nopat', 'NOPAT', c => `ebit-opTax`);
    add('dNwc', 'Increase in operating NWC', c => `nwc-${c.p}nwc`);
    add('fcff', 'Free cash flow to the firm', c => `nopat+da+impair-capex-dNwc-acq` + (reinv ? '-flAdd' : ''), { tot: true });

    // assign rows
    rows.push([{ v: `${model.company.name || model.name} — ${s} scenario ($ millions unless stated)`, s: ST.title }]);
    rows.push([{ v: 'Historical columns are reported figures (sources on the Historical data sheet). Forecast cells are formulas unless marked "Schedule value".', s: ST.note }]);
    const hdr = ['Line', 'Basis'].concat(P.map(p => p.label), ['Opening'], Array.from({ length: N }, (_, i) => 'Year ' + (i + 1)));
    rows.push(hdr.map(v => ({ v, s: ST.b })));
    let r = rows.length;
    L.forEach(d => { r++; if (d.head) { d.row = r; return; } d.row = r; R[d.k] = r; });
    const keyRe = new RegExp('(^|[^A-Za-z0-9_!$])(' + Object.keys(R).sort((a, b) => b.length - a.length).join('|') + ')(?![A-Za-z0-9_(])', 'g');
    const yv = (y, k) => {
      const map = { cf_ni: 'ni', cf_da: 'da', cf_imp: 'impair', cf_sbc: 'sbc', cf_oltl: null, cf_eq: null };
      if (k === 'cf_oltl') return y.cfoOther + y.eqinc - y.impair;
      if (k === 'cf_eq') return -y.eqinc;
      if (k === 'wCogs' || k === 'wRnd' || k === 'wSga' || k === 'wOth') { const base = { wCogs: 'cogs', wRnd: 'rnd', wSga: 'sga', wOth: 'oth' }[k]; return y.da ? (y[base] - y[base + 'X'] - (base === 'oth' ? y.impair : 0)) / y.da : 0; }
      return y[map[k] || k];
    };
    const histKey = { cf_ni: 'ni', cf_da: 'da', cf_sbc: 'sbc', capexCf: null, dNwcCf: null };
    L.forEach(d => {
      if (d.head) { rows.push([{ v: d.head, s: ST.b }]); return; }
      const st = d.u === 'pct' ? ST.pct : d.u === 'ps' ? ST.ps : d.tot ? ST.mmb : ST.mm;
      const line = [d.l, d.sched || !d.f ? 'Schedule value' : 'Formula'];
      hp.forEach(o => { const hk = histKey[d.k] !== undefined ? histKey[d.k] : d.k; const v = hk ? o[hk] : null; line.push(isNum(v) ? { v, s: st } : null); });
      const ov = d.k === 'sharesEnd' ? x.shares : x[d.k];
      line.push(isNum(ov) ? { v: ov, s: st } : null);
      res.years.forEach((y, i) => {
        const v = yv(y, d.k);
        if (d.f && !d.sched) {
          const c = { i, y: col(i), p: i ? col(i - 1) : opn };
          let f = d.f(c);
          // bare keys refer to this column; "<col>key" refers to that column's row
          f = f.replace(new RegExp('\\b([A-Z]{1,3})(' + Object.keys(R).join('|') + ')\\b', 'g'), (m0, cl, k) => cl + R[k]);
          f = f.replace(keyRe, (m0, pre, k) => pre + c.y + R[k]);
          line.push({ f, v: isNum(v) ? v : undefined, s: st });
        } else line.push(isNum(v) ? { v, s: st } : null);
      });
      rows.push(line);
    });
    return { name: s + ' model', rows, widths: [46, 14].concat(Array(HC).fill(11), [11], Array(N).fill(11)), freeze: [2, 3], R, F0, OC };
  }

  function historySheet(model) {
    const h = model.hist, P = h.periods.concat(h.ttm ? [h.ttm] : []);
    const rows = [[{ v: 'Historical data and sources', s: ST.title }], [{ v: 'Every historical figure with where it came from. Blank means not reported or not found (never zero). Manual entries are labelled.', s: ST.note }], []];
    rows.push(['Line', 'Period', 'Value ($mm)', 'Source', 'Concept / note', 'Form', 'Filed', 'Period covered', 'Raw value', 'Raw unit', 'Link'].map(v => ({ v, s: ST.b })));
    const lab = {}; E.IS.concat(E.BS, E.CF).forEach(L => { lab[L.k] = lab[L.k] || L.l; });
    Object.keys(h.cells || {}).forEach(k => P.forEach(p => {
      const c = (h.cells[k] || {})[p.id]; if (!c) return; const s = c.src || {};
      rows.push([lab[k] || k, p.label, isNum(c.v) ? { v: c.v, s: ST.mm } : 'not reported', c.manual ? 'Manual entry (analyst)' : s.provider || '', c.manual ? (c.note || '') : (s.concept || s.note || ''), s.form || '', s.filed || '', s.period || '', isNum(s.raw) ? s.raw : null, s.rawUnit || '', s.url || '']);
    }));
    return { name: 'Historical data', rows, widths: [40, 16, 14, 26, 50, 8, 12, 30, 18, 8, 70], freeze: [2, 4] };
  }
  function checksSheet(model, runs) {
    const rows = [[{ v: 'Model checks', s: ST.title }], [{ v: 'Pass, warning or fail for each check, scenario and year. The model never plugs a difference.', s: ST.note }], []];
    rows.push(['Scenario', 'Check', 'Status'].concat(Array.from({ length: N }, (_, i) => 'Year ' + (i + 1)), ['What it tests']).map(v => ({ v, s: ST.b })));
    SC.forEach(s => { const r = runs[s]; if (!r.ok) { rows.push([s, 'Model incomplete', 'fail', 'Missing: ' + r.missing.join('; ')]); return; }
      r.checks.forEach(c => { const by = Array.from({ length: N }, (_, i) => { const b = (c.by || []).find(q => q.t === i + 1); return b && isNum(b.diff) ? { v: b.diff, s: ST.mm } : b ? b.status : null; }); rows.push([s, c.label, c.status].concat(by, [c.why || ''])); }); });
    return { name: 'Checks', rows, widths: [10, 46, 9].concat(Array(N).fill(10), [80]), freeze: [3, 4] };
  }
  function ratiosSheet(model, runs) {
    const rows = [[{ v: 'Ratios (values)', s: ST.title }], []];
    const P = model.hist.periods;
    SC.forEach(s => { const r = runs[s]; const R = E.ratioSeries(model, r);
      rows.push([{ v: s + ' scenario', s: ST.b }]); rows.push(['Ratio', 'Formula'].concat(P.map(p => p.label), Array.from({ length: N }, (_, i) => 'Year ' + (i + 1))).map(v => ({ v, s: ST.b })));
      R.forEach(q => { const st = q.u === 'pct' ? ST.pct : ST.ps; rows.push([q.l, q.f].concat(q.hist.map(v => isNum(v) ? { v, s: st } : null), q.fc.map(v => isNum(v) ? { v, s: st } : null))); });
      rows.push([]); });
    return { name: 'Ratios', rows, widths: [34, 40].concat(Array(P.length + N).fill(10)), freeze: [2, 0] };
  }
  function summarySheet(model, runs) {
    const c = model.company || {};
    const rows = [[{ v: `Three-statement model: ${c.name || model.name}`, s: ST.title }], [{ v: `${c.ticker || ''} · CIK ${c.cik || 'n/a'} · exported ${new Date().toISOString().slice(0, 10)} from DCF Pro`, s: ST.note }], []];
    const S = model.settings;
    [['Base period', S.base === 'ttm' ? 'Trailing twelve months' : 'Latest fiscal year'], ['D&A presentation', S.daPresentation], ['Depreciation method', S.depMethod], ['Interest', S.interest === 'average' ? 'Average balances (iterative)' : 'Opening balances'], ['Buybacks', S.buyback], ['Loss carryforwards', S.nolDTA], ['Data provider', model.hist.provider || ''], ['Retrieved', model.hist.retrieved || '']].forEach(([a, b]) => rows.push([{ v: a, s: ST.b }, b]));
    rows.push([]); rows.push(['Scenario summary (values)', ''].concat(Array.from({ length: N }, (_, i) => 'Year ' + (i + 1))).map(v => ({ v, s: ST.b })));
    const K = [['rev', 'Revenue'], ['ebitda', 'EBITDA'], ['ebit', 'EBIT'], ['niCommon', 'Net income to common'], ['epsDil', 'Diluted EPS'], ['fcff', 'FCFF'], ['cash', 'Cash'], ['debt', 'Total debt'], ['check', 'Balance check']];
    SC.forEach(s => { const r = runs[s]; if (!r.ok) { rows.push([s, 'incomplete: ' + r.missing.slice(0, 6).join('; ')]); return; } K.forEach(([k, l]) => rows.push([s, l].concat(r.years.map(y => isNum(y[k]) ? { v: y[k], s: k === 'epsDil' ? ST.ps : ST.mm } : null)))); });
    rows.push([]); rows.push([{ v: 'Notes', s: ST.b }]);
    Object.keys(model.notes || {}).forEach(k => { if (model.notes[k]) rows.push([k, String(model.notes[k])]); });
    (model.hist.notes || []).forEach(n => rows.push(['Import note', typeof n === 'string' ? n : (n.text || JSON.stringify(n))]));
    return { name: 'Summary', rows, widths: [26, 30].concat(Array(N).fill(11)) };
  }
  function build(model) {
    const runs = {}; SC.forEach(s => { runs[s] = E.run(model, s); });
    const AS = assumptionsSheet(model);
    const sheets = [summarySheet(model, runs), AS.sheet];
    SC.forEach(s => { if (runs[s].ok) sheets.push(scenarioSheet(model, runs[s], s, AS)); });
    sheets.push(historySheet(model), checksSheet(model, runs), ratiosSheet(model, runs));
    return { sheets, runs };
  }
  async function xlsx(JSZip, model) {
    if (!JSZip) throw new Error('The Excel library did not load.');
    const { sheets } = build(model);
    return new Blob([await writeBook(JSZip, sheets, 'Three-statement model')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------- printable report ----------
  function printHtml(model) {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const f = (v, u) => !isNum(v) ? '—' : u === 'pct' ? (v * 100).toFixed(1) + '%' : u === 'ps' ? v.toFixed(2) : (v < 0 ? '(' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ')' : v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
    const scen = (model.ui && model.ui.scen) || 'Base';
    const r = E.run(model, scen);
    const c = model.company || {};
    let h = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.ticker || model.name)} three-statement model</title><style>body{font:11px/1.35 -apple-system,Segoe UI,Arial,sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 6px;border-bottom:1px solid #999}table{border-collapse:collapse;width:100%;margin-bottom:8px}td,th{padding:2px 5px;text-align:right;border-bottom:1px solid #eee;white-space:nowrap}td:first-child,th:first-child{text-align:left}tr.t td{font-weight:600;border-top:1px solid #999}.n{color:#555;font-size:10px}.fail{color:#b00020}.pass{color:#1b6e2b}.warn{color:#8a5a00}@media print{h2{page-break-after:avoid}table{page-break-inside:auto}}</style></head><body>`;
    h += `<h1>${esc(c.name || model.name)} — three-statement model, ${esc(scen)} scenario</h1><p class="n">${esc(c.ticker || '')} · $ millions unless stated · printed ${new Date().toISOString().slice(0, 10)} · DCF Pro</p>`;
    if (!r.ok) return h + `<p class="fail">The model is incomplete: ${esc(r.missing.join('; '))}</p></body></html>`;
    const P = model.hist.periods, hp = P.map(p => E.histPeriod(model.hist, p.id, model.settings));
    const tbl = (title, lines) => {
      h += `<h2>${esc(title)}</h2><table><tr><th></th>${P.map(p => `<th>${esc(p.label)}</th>`).join('')}${r.years.map(y => `<th>Y${y.t}</th>`).join('')}</tr>`;
      lines.forEach(L => { if (L.memo && L.k === 'sbc') return; const u = L.pct ? 'pct' : L.ps ? 'ps' : 'mm'; h += `<tr class="${L.key || L.tot ? 't' : ''}"><td>${esc(L.l)}</td>${hp.map(o => `<td>${f(o[L.k], u)}</td>`).join('')}${r.years.map(y => `<td>${f(y[L.k], u)}</td>`).join('')}</tr>`; });
      h += '</table>';
    };
    tbl('Income statement', E.IS); tbl('Balance sheet', E.BS); tbl('Cash flow statement', E.CF);
    h += `<h2>Free cash flow to the firm</h2><table><tr><th></th>${r.years.map(y => `<th>Y${y.t}</th>`).join('')}</tr>${[['nopat', 'NOPAT'], ['da', 'D&A'], ['capex', 'CapEx'], ['dNwc', 'Increase in NWC'], ['acq', 'Acquisitions'], ['fcff', 'FCFF']].map(([k, l]) => `<tr class="${k === 'fcff' ? 't' : ''}"><td>${l}</td>${r.years.map(y => `<td>${f(y[k])}</td>`).join('')}</tr>`).join('')}</table>`;
    h += `<h2>Checks</h2><table><tr><th>Check</th><th>Status</th></tr>${r.checks.map(q => `<tr><td>${esc(q.label)}</td><td class="${q.status}">${esc(q.status)}</td></tr>`).join('')}</table>`;
    h += `<p class="n">Historical figures come from ${esc(model.hist.provider || 'the imported filings')}${model.hist.retrieved ? ', retrieved ' + esc(model.hist.retrieved) : ''}. Forecasts are the analyst's assumptions, not company guidance.</p></body></html>`;
    return h;
  }
  return { xlsx, printHtml, build, writeBook, _cellXml: cellXml, colName };
})();
if (typeof module !== 'undefined') module.exports = FsmExport;
