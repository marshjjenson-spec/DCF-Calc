// ===== EXCEL IMPORT / EXPORT =====
// Export writes the analyst's inputs into a copy of the workbook template (corrected or original), so every
// sheet, formula, format and colour is kept; Excel recalculates on open. Import reads the same input cells.
// Works on the raw .xlsx XML with JSZip so nothing in the template is rewritten except the input cells.
const DCFExcel = (() => {
  const A = '⚙️ Assumptions', H = '📈 Historicals', W = '📋 WACC Builder', C = '🏦 Cap Structure', D = '📊 Dashboard(View Last)', E = '🔢 DCF Engine';
  const COLS = { Base: 'C', Bear: 'D', Bull: 'E' };
  // Every input cell, as [sheet, cell, getter(model), setter(model, value), kind]
  function cellMap(fields, histFields, template) {
    const m = [];
    fields.forEach(f => {
      const row = f.cell.match(/!C(\d+)/)[1];
      if (template === 'corrected' && (f.key === 'rev0' || f.key === 'we')) return; // formulas in the corrected template
      if (f.key.startsWith('company.')) {
        const k = f.key.split('.')[1];
        m.push([A, 'C' + row, md => md.inputs.company[k], (md, v) => { md.inputs.company[k] = v; }, f.unit]);
      } else if (f.tri) {
        ['Base', 'Bear', 'Bull'].forEach(s => m.push([A, COLS[s] + row, md => md.inputs[f.key][s], (md, v) => { md.inputs[f.key][s] = v; }, f.unit]));
      } else m.push([A, 'C' + row, md => md.inputs[f.key], (md, v) => { md.inputs[f.key] = v; }, f.unit]);
    });
    'CDEFG'.split('').forEach((col, i) => {
      m.push([H, col + '6', md => md.hist.years[i], (md, v) => { md.hist.years[i] = v; }, 'num']);
      histFields.forEach(h => m.push([H, col + h.row, md => md.hist[h.key][i], (md, v) => { md.hist[h.key][i] = v; }, 'num']));
    });
    [['bei', 'C8'], ['crp', 'C10'], ['histErp', 'C14'], ['rawBeta', 'C18'], ['unlevBeta', 'C20']].forEach(([k, c]) => m.push([W, c, md => md.wb[k], (md, v) => { md.wb[k] = v; }, 'num']));
    for (let i = 0; i < 6; i++) [['name', 'B'], ['face', 'C'], ['coupon', 'D'], ['maturity', 'E'], ['note', 'F']].forEach(([k, col]) =>
      m.push([C, col + (6 + i), md => md.tranches[i] ? md.tranches[i][k] : null, (md, v) => { md.tranches[i] = md.tranches[i] || {}; md.tranches[i][k] = v; }, k === 'name' || k === 'note' ? 'text' : 'num']));
    [['mean', 'C45'], ['median', 'C46'], ['high', 'C47'], ['low', 'D47'], ['rec', 'C48'], ['ltg', 'C49']].forEach(([k, c]) => m.push([D, c, md => md.street[k], (md, v) => { md.street[k] = v; }, 'num']));
    m.push([E, 'C4', md => md.active, (md, v) => { md.active = v; }, 'text']);
    return m;
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colNum = ref => ref.match(/^[A-Z]+/)[0].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const toSerial = iso => (Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 864e5;
  const fromSerial = n => new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10);
  async function sheetPaths(zip) {
    const wbx = await zip.file('xl/workbook.xml').async('string');
    const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    const map = {};
    for (const mm of wbx.matchAll(/<sheet\b[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"[^>]*\/>/g)) {
      const name = mm[1].replace(/&amp;/g, '&');
      const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${mm[2]}"[^>]*>`))[0];
      const target = rel.match(/Target="([^"]+)"/)[1];
      map[name] = 'xl/' + target.replace(/^\/?xl\//, '');
    }
    return map;
  }
  function cellRe(ref) { return new RegExp(`<c r="${ref}"(?=[\\s>/])([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`); }
  function setCell(xml, ref, value, unit) {
    const re = cellRe(ref), m = xml.match(re);
    let body = '', t = '';
    if (value === null || value === undefined || value === '') body = '';
    else if (unit === 'date') body = `<v>${toSerial(value)}</v>`;
    else if (typeof value === 'number') body = `<v>${value}</v>`;
    else { t = ' t="inlineStr"'; body = `<is><t xml:space="preserve">${esc(value)}</t></is>`; }
    if (m) {
      const attrs = m[1].replace(/\s+t="[^"]*"/, '');
      return xml.replace(re, body ? `<c r="${ref}"${attrs}${t}>${body}</c>` : `<c r="${ref}"${attrs}/>`);
    }
    if (!body) return xml;
    const rowN = ref.match(/\d+/)[0];
    const rowRe = new RegExp(`<row r="${rowN}"[^>]*?(?:/>|>([\\s\\S]*?)</row>)`);
    const rm = xml.match(rowRe);
    const cell = `<c r="${ref}"${t}>${body}</c>`;
    if (!rm) {
      // insert a new row in order
      const rows = [...xml.matchAll(/<row r="(\d+)"/g)];
      const after = rows.find(r => +r[1] > +rowN);
      const rowXml = `<row r="${rowN}">${cell}</row>`;
      return after ? xml.slice(0, after.index) + rowXml + xml.slice(after.index) : xml.replace('</sheetData>', rowXml + '</sheetData>');
    }
    let rowXml = rm[0];
    if (rowXml.endsWith('/>')) rowXml = rowXml.slice(0, -2) + '>' + cell + '</row>';
    else {
      const cells = [...rowXml.matchAll(/<c r="([A-Z]+)\d+"/g)];
      const next = cells.find(c => colNum(c[1]) > colNum(ref));
      rowXml = next ? rowXml.slice(0, next.index) + cell + rowXml.slice(next.index) : rowXml.replace(/<\/row>$/, cell + '</row>');
    }
    return xml.replace(rm[0], rowXml);
  }
  async function exportModel(JSZip, templateBuf, model, fields, histFields, template) {
    const zip = await JSZip.loadAsync(templateBuf);
    const paths = await sheetPaths(zip);
    const bySheet = {};
    cellMap(fields, histFields, template).forEach(([sh, ref, get, , unit]) => { (bySheet[sh] = bySheet[sh] || []).push([ref, get(model), unit]); });
    for (const [sh, cells] of Object.entries(bySheet)) {
      let xml = await zip.file(paths[sh]).async('string');
      cells.forEach(([ref, v, unit]) => { xml = setCell(xml, ref, v, unit); });
      xml = xml.replace(/(<c\b[^>]*>)(<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>)<v>[^<]*<\/v>/g, '$1$2'); // drop stale cached results
      zip.file(paths[sh], xml);
    }
    let wbx = await zip.file('xl/workbook.xml').async('string');
    if (/<calcPr\b/.test(wbx)) wbx = wbx.replace(/<calcPr\b([^>]*?)\/?>/, (a, b) => `<calcPr${b.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
    else wbx = wbx.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    zip.file('xl/workbook.xml', wbx);
    zip.remove('xl/calcChain.xml');
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }
  function readCell(xml, ref, shared) {
    const m = xml.match(cellRe(ref));
    if (!m || !m[2]) return null;
    const attrs = m[1], inner = m[2];
    const t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
    const unx = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    if (t === 'inlineStr') return unx([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
    const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v === undefined) return null;
    if (t === 's') return shared[+v];
    if (t === 'str' || t === 'e') return unx(v);
    if (t === 'b') return v === '1';
    return Number(v);
  }
  async function importModel(JSZip, buf, blankModel, fields, histFields) {
    const zip = await JSZip.loadAsync(buf);
    const paths = await sheetPaths(zip);
    if (!paths[A] || !paths[E]) throw new Error('This file is not built on the DCF workbook template: the Assumptions or DCF Engine sheet is missing.');
    const sst = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : '';
    const unx = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const shared = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(si => unx([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
    const xmls = {};
    for (const [n, p] of Object.entries(paths)) if (zip.file(p)) xmls[n] = await zip.file(p).async('string');
    const engineXml = xmls[E];
    const c50 = (engineXml.match(cellRe('C50')) || [])[2] || '';
    const template = /\(1\+C47\)/.test(c50) ? 'workbook' : 'corrected';
    const model = blankModel;
    cellMap(fields, histFields, 'workbook').forEach(([sh, ref, , set, unit]) => {
      if (!xmls[sh]) return;
      let v = readCell(xmls[sh], ref, shared);
      if (unit === 'date' && typeof v === 'number') v = fromSerial(v);
      if (v === '' ) v = null;
      if ((unit === 'pct' || unit === 'x' || unit === 'usd' || unit === 'usd_mm' || unit === 'shares' || unit === 'num') && typeof v === 'string') v = isNaN(+v) ? null : +v;
      set(model, v);
    });
    model.mode = template;
    return model;
  }
  return { exportModel, importModel, cellMap };
})();
if (typeof module !== 'undefined') module.exports = DCFExcel;
