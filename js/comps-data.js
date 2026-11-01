// ===== TRADING COMPS DATA (no UI) =====
// Builds a comparable-company record from an SEC company facts file (and its submissions file), from
// Financial Modeling Prep, or from an existing DCF model. Every figure carries a source record: provider,
// link, original reported amount, units, currency, reporting period, filing date, market observation date
// and import date. Re-importing a company never overwrites a manual figure: changes are proposed for review.
const CompsData = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const Sec = typeof DCFSec !== 'undefined' ? DCFSec : require('./sec.js');
  const E = typeof CompsEngine !== 'undefined' ? CompsEngine : require('./comps-engine.js');
  const num = v => { if (v === null || v === undefined || v === '' || v === 'None' || v === '-') return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; };
  const mm = v => isNum(v) ? v / 1e6 : null;
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;

  // ---------- company records ----------
  function emptyCompany(role = 'peer') {
    return { id: uid(), role, ticker: null, name: null, cik: null, exchange: null, industry: null, sector: null, country: null, description: null, fyEnd: null,
      currency: 'USD', priceCurrency: 'USD', fx: { rate: null, date: null, source: null }, accounting: 'US GAAP',
      status: role === 'peer' ? 'core' : null, rank: null, reason: '', notes: '', v: {}, ref: {}, adj: [], inc: {}, excludeObs: {}, pending: null, importNotes: [], imports: [] };
  }
  const label = k => ({ price: 'Share price', priceDate: 'Price date', shares: 'Actual common shares outstanding', dilutive: 'Net dilutive shares', equity: 'Book equity (common)' })[k]
    || (E.EV_LINES.find(L => L.key === k) || {}).label || metricLabel(k);
  function metricLabel(k) {
    const m = /^([a-z]+)_(ttm|fy|ntm|fy1|fy2)(_prior)?$/.exec(k);
    if (!m) return k;
    const base = (E.METRICS[m[1]] || { label: m[1] === 'da' ? 'D&A' : m[1] === 'cfo' ? 'Operating cash flow' : m[1] }).label;
    const per = { ttm: 'TTM', fy: 'last fiscal year', ntm: 'NTM', fy1: 'FY+1 estimate', fy2: 'FY+2 estimate' }[m[2]];
    return `${base}, ${per}${m[3] ? ' (one year earlier)' : ''}`;
  }

  // a value with its full source record
  function rec(v, src) { return { v: isNum(v) ? v : null, src: Object.assign({ retrieved: today() }, src) }; }
  function put(out, key, v, src) { if (!isNum(v)) return; out.values[key] = rec(v, src); }
  function putRef(out, key, v, src) { if (!isNum(v)) return; out.refs[key] = rec(v, src); }

  // ---------- SEC company facts ----------
  const BS = {
    cash: ['CashAndCashEquivalentsAtCarryingValue'],
    sti: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    stBorrow: ['ShortTermBorrowings', 'CommercialPaper'],
    ltdTotal: ['LongTermDebt'], ltdNC: ['LongTermDebtNoncurrent'], ltdCur: ['LongTermDebtCurrent'],
    finL: ['FinanceLeaseLiability'], finLNC: ['FinanceLeaseLiabilityNoncurrent'], finLC: ['FinanceLeaseLiabilityCurrent'],
    opL: ['OperatingLeaseLiability'], opLNC: ['OperatingLeaseLiabilityNoncurrent'], opLC: ['OperatingLeaseLiabilityCurrent'],
    nci: ['MinorityInterest'], preferred: ['PreferredStockValue'], equity: ['StockholdersEquity'],
    eqInv: ['EquityMethodInvestments'], crypto: ['CryptoAssetFairValue'],
  };
  function secSrc(r, extra) {
    return Object.assign({ provider: 'SEC EDGAR XBRL company facts', cat: r.cat === 'calc' ? 'calc' : 'sec', concept: r.concept || null, form: r.form || null, accn: r.accn || null, filed: r.filed || null,
      period: r.periodText || null, end: r.end || null, url: r.url || null, orig: isNum(r.raw) ? r.raw : null, origUnit: r.rawUnit || 'USD', unit: '$ millions', currency: 'USD', method: r.method && r.method !== 'Reported' ? r.method : 'Reported', stale: !!r.stale, staleNote: r.staleNote || '' }, extra || {});
  }
  // TTM for a per-share concept (EPS): FY + YTD − prior-year YTD, from the same concept
  function ttmPerShare(json, concept, fyEnd, L) {
    const all = Sec.entries(json, concept, 'USD/shares');
    const fy = all.filter(x => x.pt === 'FY').sort((a, b) => b.end.localeCompare(a.end)).find(x => !fyEnd || x.end === fyEnd);
    if (!fy) return null;
    const ytd = all.filter(x => /^10-Q/.test(x.form) && ['Q', 'H1', '9M'].includes(x.pt) && x.end > fy.end && days(fy.end, x.start) <= 10 && days(fy.end, x.start) >= -3).sort((a, b) => b.end.localeCompare(a.end))[0];
    const fyRec = Sec.record(json, fy, { L, metric: 'FY', unit: 'USD per share', scale: 1, annual: true });
    if (!ytd) return { fy, value: fy.val, method: `No 10-Q after the fiscal year ended ${fy.end}: TTM equals the fiscal year (${fy.form} ${fy.accn}).`, end: fy.end, rec: fyRec, parts: [fyRec] };
    const prior = all.filter(x => x.pt === ytd.pt && Math.abs(days(x.end, ytd.end) - 365) <= 8 && Math.abs(days(x.start, ytd.start) - 365) <= 8).sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0];
    if (!prior) return { fy, value: null, method: `The ${ytd.form} for ${ytd.end} has no comparable prior-year EPS: TTM EPS cannot be built.` };
    const v = fy.val + ytd.val - prior.val;
    const yr = Sec.record(json, ytd, { L, metric: 'YTD', unit: 'USD per share', scale: 1 });
    return { fy, value: v, end: ytd.end, rec: yr, parts: [fyRec, yr, Sec.record(json, prior, { L, metric: 'Prior YTD', unit: 'USD per share', scale: 1 })],
      method: `TTM EPS = FY ended ${fy.end} (${fy.val.toFixed(2)}) + ${Sec.PT_TEXT[ytd.pt]} ${ytd.end} (${ytd.val.toFixed(2)}) − ${Sec.PT_TEXT[prior.pt]} ${prior.end} (${prior.val.toFixed(2)}) = ${v.toFixed(2)}. Calculated; EPS is not strictly additive because share counts change between periods.` };
  }
  function fromSEC(json, subs) {
    if (!json || !json.facts || !json.facts['us-gaap']) throw new Error('This is not an SEC company facts file (data.sec.gov/api/xbrl/companyfacts/CIK##########.json).');
    const L = Sec.latest(json, subs);
    const F = Sec.financials(json, { L });
    if (!F.years.length) throw new Error('No annual revenue was found in this SEC file.');
    const out = { providerId: 'sec', provider: 'SEC EDGAR company facts', retrieved: new Date().toISOString(), info: {}, values: {}, refs: {}, notes: [], filings: { newest: L.newest, q: L.q, k: L.k } };
    const s = subs || {};
    out.info = { name: json.entityName || s.name || null, cik: String(json.cik || '').padStart(10, '0'), ticker: (s.tickers && s.tickers[0]) || null, exchange: (s.exchanges && s.exchanges[0]) || null, industry: s.sicDescription || null,
      fyEnd: s.fiscalYearEnd ? s.fiscalYearEnd.slice(0, 2) + '-' + s.fiscalYearEnd.slice(2) : (F.years[0] ? F.years[0].end.slice(5) : null), currency: 'USD', accounting: 'US GAAP', country: 'US' };
    const y0 = F.years[0], y1 = F.years[1];
    // fiscal year and prior fiscal year
    ['rev', 'gp', 'ebit', 'da', 'ebitda', 'ni', 'cfo', 'capex', 'fcf'].forEach(k => {
      const r = y0.recs[k];
      if (r && isNum(y0.values[k])) put(out, k + '_fy', y0.values[k], r.cat === 'calc' ? { provider: 'Calculated from SEC EDGAR XBRL', cat: 'calc', period: r.periodText, end: y0.end, url: (y0.recs.rev || {}).url, method: r.method, unit: '$ millions', currency: 'USD' } : secSrc(r, { definition: k === 'ni' ? 'Net income attributable to the parent (us-gaap:NetIncomeLoss), before any preferred dividends.' : '' }));
    });
    if (y1 && isNum(y1.values.rev)) put(out, 'rev_fy_prior', y1.values.rev, secSrc(y1.recs.rev));
    // TTM
    const T = F.ttm.items;
    ['rev', 'gp', 'ebit', 'da', 'ebitda', 'ni', 'cfo', 'capex', 'fcf'].forEach(k => {
      const t = T[k]; if (!t || !isNum(t.value)) return;
      put(out, k + '_ttm', t.value, { provider: t.cat === 'sec' ? 'SEC EDGAR XBRL company facts' : 'Calculated from SEC EDGAR XBRL', cat: t.parts && t.parts.length === 1 ? 'sec' : 'calc', period: t.periodText, end: t.end, url: t.url || (t.parts && t.parts[1] && t.parts[1].url) || null, form: t.form || null, accn: t.accn || null, filed: t.filed || null, method: t.method, unit: '$ millions', currency: 'USD', parts: (t.parts || []).map(p => ({ metric: p.metric, value: p.value, form: p.form, accn: p.accn, period: p.periodText, url: p.url })) });
    });
    if (F.ttmPrior && isNum(F.ttmPrior.value)) put(out, 'rev_ttm_prior', F.ttmPrior.value, { provider: 'Calculated from SEC EDGAR XBRL', cat: 'calc', period: 'twelve months ended ' + F.ttmPrior.end, end: F.ttmPrior.end, method: F.ttmPrior.method, unit: '$ millions', currency: 'USD' });
    Object.entries(T).forEach(([k, t]) => { if (t && t.mismatch) out.notes.push(`TTM ${t.metric}: ${t.method}`); });
    // EPS (diluted): FY and TTM
    const epsC = Sec.entries(json, 'EarningsPerShareDiluted', 'USD/shares').length ? 'EarningsPerShareDiluted' : (Sec.entries(json, 'EarningsPerShareBasicAndDiluted', 'USD/shares').length ? 'EarningsPerShareBasicAndDiluted' : null);
    if (epsC) {
      const et = ttmPerShare(json, epsC, y0.end, L);
      if (et && et.fy && et.fy.end === y0.end) put(out, 'eps_fy', et.fy.val, secSrc(Sec.record(json, et.fy, { L, metric: 'Diluted EPS', unit: 'USD per share', scale: 1, annual: true }), { unit: 'USD per share', origUnit: 'USD/shares', definition: 'Diluted earnings per share as reported (us-gaap:' + epsC + ').' }));
      if (et && isNum(et.value)) put(out, 'eps_ttm', et.value, { provider: et.parts.length === 1 ? 'SEC EDGAR XBRL company facts' : 'Calculated from SEC EDGAR XBRL', cat: et.parts.length === 1 ? 'sec' : 'calc', period: 'twelve months ended ' + et.end, end: et.end, url: et.rec.url, method: et.method, unit: 'USD per share', currency: 'USD', parts: et.parts.map(p => ({ metric: p.metric, value: p.value, form: p.form, accn: p.accn, period: p.periodText, url: p.url })) });
      else if (et) out.notes.push(et.method);
    } else out.notes.push('No diluted EPS was found in the SEC data: P/E is not available until you enter EPS.');
    // balance sheet: newest instant for each line
    const inst = (keys, metric) => { const x = Sec.pick(json, keys, 'USD', 'instant'); return x ? Sec.record(json, x, { L, metric, unit: '$ millions' }) : null; };
    const same = (a, b) => a && b && a.end === b.end;
    const sumRec = (a, b, method) => a && b && same(a, b) ? Object.assign({}, a, { value: a.value + b.value, raw: (a.raw || 0) + (b.raw || 0), method, cat: 'calc', concept: a.concept + ' + ' + b.concept }) : null;
    const newer = (tot, a, b, method) => { const sm = sumRec(a, b, method); return tot && (!sm || tot.end >= sm.end) ? tot : sm; };
    const cash = inst(BS.cash, 'Cash and cash equivalents'), sti = inst(BS.sti, 'Short-term investments');
    const bsDate = cash ? cash.end : null;
    const putBS = (key, r, extra) => { if (!r) return; const src = secSrc(r, extra); if (bsDate && r.end < bsDate) { src.stale = true; src.staleNote = `Dated ${r.end}, older than the latest balance sheet (${bsDate}). The newest filing may not tag this line.`; out.notes.push(`${label(key)}: the newest figure is dated ${r.end}, older than the latest balance sheet (${bsDate}). Check the newest 10-Q.`); } put(out, key, r.value, src); };
    putBS('cash', cash);
    if (sti) putBS('sti', sti);
    const st = inst(BS.stBorrow, 'Short-term borrowings'), lt = inst(BS.ltdTotal, 'Long-term debt'), nc = inst(BS.ltdNC, 'Long-term debt, non-current'), cu = inst(BS.ltdCur, 'Current portion of long-term debt');
    if (st) putBS('stBorrow', st);
    if (nc && cu && same(nc, cu) && (!lt || nc.end >= lt.end)) { putBS('ltdNoncurrent', nc); putBS('ltdCurrent', cu); }
    else if (lt) {
      if (cu && same(cu, lt)) { putBS('ltdCurrent', cu); putBS('ltdNoncurrent', Object.assign({}, lt, { value: lt.value - cu.value, cat: 'calc', method: `Long-term debt including current portion (${lt.value.toFixed(0)}) − current portion (${cu.value.toFixed(0)})` })); }
      else { putBS('ltdNoncurrent', Object.assign({}, lt, { method: 'Reported total long-term debt (us-gaap:LongTermDebt), which includes the current portion' })); put(out, 'ltdCurrent', 0, { provider: 'Calculated from SEC EDGAR XBRL', cat: 'calc', method: 'Included in the long-term debt line above (LongTermDebt includes amounts due within one year), so 0 here avoids counting it twice.', period: lt.periodText, end: lt.end, unit: '$ millions', currency: 'USD' }); }
    } else if (nc) { putBS('ltdNoncurrent', nc); if (cu && same(cu, nc)) putBS('ltdCurrent', cu); }
    if (!st && !lt && !nc && !cu) out.notes.push('No standard debt tags were found (some companies, such as automakers with finance arms, use their own debt tags). Enter debt from the balance sheet and debt note of the newest 10-Q. Enterprise value stays incomplete until you do, or enter 0 if the company has no debt.');
    const fl = newer(inst(BS.finL, 'Finance lease liabilities'), inst(BS.finLC, 'Finance lease liabilities, current'), inst(BS.finLNC, 'Finance lease liabilities, non-current'), 'Current + non-current finance lease liabilities');
    if (fl) putBS('finLease', fl, { definition: 'Finance lease liabilities are financial debt under US GAAP (ASC 842): the interest and amortisation sit below EBITDA.' });
    const ol = newer(inst(BS.opL, 'Operating lease liabilities'), inst(BS.opLC, 'Operating lease liabilities, current'), inst(BS.opLNC, 'Operating lease liabilities, non-current'), 'Current + non-current operating lease liabilities');
    if (ol) putBS('opLease', ol, { definition: 'Operating lease cost is an operating expense inside US GAAP EBITDA. Include this liability in EV only if you also remove the lease cost from EBITDA (EBITDAR-style).' });
    const nci = inst(BS.nci, 'Noncontrolling interests'); if (nci) putBS('nci', nci, { definition: 'Book value of noncontrolling interests. Market value is preferable when the subsidiary is listed.' });
    const pf = inst(BS.preferred, 'Preferred stock'); if (pf) putBS('preferred', pf, { definition: 'Carrying (par or stated) value. Use liquidation or market value when they differ materially.' });
    const eq = inst(BS.equity, 'Stockholders\' equity'); if (eq) putBS('equity', eq, { definition: 'Total stockholders\' equity attributable to the parent (excludes noncontrolling interests).' });
    const ei = inst(BS.eqInv, 'Equity method investments'); if (ei) putRef(out, 'eqInv', ei.value, secSrc(ei, { definition: 'Equity-method stakes. Subtract them from EV only if their income is not in EBITDA (it usually is not). Not added automatically.' }));
    const cr = inst(BS.crypto, 'Crypto assets at fair value'); if (cr) { putRef(out, 'crypto', cr.value, secSrc(cr, { definition: 'Digital assets held at fair value: a non-operating asset. Their remeasurement runs through operating income.' })); out.notes.push(`Holds crypto assets of ${Math.round(cr.value).toLocaleString('en-US')} $mm (${cr.end}). Fair-value changes are inside operating income, so EBIT and EBITDA multiples are distorted: normalise them on Financial Adjustments and consider the holdings as a non-operating asset.`); }
    // shares: actual cover-page count only
    const SH = Sec.shares(json, { L });
    if (SH.actual && !SH.actual.multiClass) put(out, 'shares', SH.actual.value, secSrc(SH.actual, { unit: 'millions of shares', origUnit: 'shares', currency: null, asOf: SH.actual.end, definition: 'Actual common shares outstanding on the cover-page date (dei:EntityCommonStockSharesOutstanding). Not a weighted average.' }));
    else if (SH.actual && SH.actual.multiClass) { putRef(out, 'sharesMulti', SH.actual.value, secSrc(SH.actual, { unit: 'millions of shares', currency: null, definition: 'Sum of several share classes on the cover page. Use it only if the classes have the same economic rights and price.' })); out.notes.push('The cover page lists more than one share class. Their sum is offered as a reference: check each class before using it.'); }
    else out.notes.push('No cover-page share count in the SEC data. Enter actual shares outstanding from the cover page of the newest 10-Q or 10-K. Weighted-average shares are not used as a substitute.');
    if (SH.netDilQ) putRef(out, 'dilutive', SH.netDilQ.value, secSrc(SH.netDilQ, { unit: 'millions of shares', currency: null, definition: 'Net dilutive shares in the latest quarter\'s diluted EPS (treasury stock method at that quarter\'s average price). A reference for the diluted share basis.' }));
    if (SH.waDilQ) putRef(out, 'waDilQ', SH.waDilQ.value, secSrc(SH.waDilQ, { unit: 'millions of shares', currency: null, definition: 'Quarterly diluted weighted-average shares. Reference only: never used as the current share count.' }));
    if (y0 && y0.values.da == null) out.notes.push(`D&A for ${y0.label} is not under a standard tag in company facts, so EBITDA is not calculated. Enter D&A-based EBITDA from the cash flow statement.`);
    out.notes.push('SEC data holds reported figures only. Enter the share price and its date from a quote (or import the company from Financial Modeling Prep).');
    return out;
  }

  // ---------- Financial Modeling Prep ----------
  const FMP_HOME = 'https://site.financialmodelingprep.com/developer/docs';
  async function fmpGet(path, key, fetchFn, optional) {
    try {
      const res = await fetchFn('https://financialmodelingprep.com/stable/' + path + (path.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(key));
      let j = null; try { j = await res.json(); } catch (e) {}
      const msg = j && !Array.isArray(j) && (j['Error Message'] || j.message || j.error);
      if (!res.ok || msg) throw new Error(msg || `HTTP ${res.status}`);
      return j;
    } catch (e) { if (optional) return { __error: e.message }; throw e; }
  }
  // TTM from discrete quarters: FY + (quarters after FY) − (the same quarters a year earlier)
  function ttmFromQuarters(fyRow, qs, field) {
    if (!fyRow || !isNum(num(fyRow[field]))) return null;
    const after = qs.filter(q => q.date > fyRow.date).sort((a, b) => a.date.localeCompare(b.date));
    if (!after.length) return { v: num(fyRow[field]), end: fyRow.date, method: `No quarter reported after the fiscal year ended ${fyRow.date}: TTM equals the fiscal year.` };
    const prior = after.map(q => qs.find(x => Math.abs(days(x.date, q.date) - 365) <= 10));
    if (prior.some(p => !p) || after.some(q => !isNum(num(q[field]))) || prior.some(p => !isNum(num(p[field])))) return { v: null, end: null, method: 'Comparable prior-year quarters are missing: TTM cannot be built.' };
    const ytd = after.reduce((a, q) => a + num(q[field]), 0), pytd = prior.reduce((a, q) => a + num(q[field]), 0);
    const end = after[after.length - 1].date;
    return { v: num(fyRow[field]) + ytd - pytd, end, method: `TTM = FY ended ${fyRow.date} + ${after.length} quarter(s) to ${end} − the same quarter(s) a year earlier (provider quarterly statements).` };
  }
  function fromFMP(symbol, d) {
    const p = (Array.isArray(d.profile) ? d.profile[0] : d.profile) || {};
    const q = (Array.isArray(d.quote) ? d.quote[0] : d.quote) || {};
    const arr = x => Array.isArray(x) ? x.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
    const incA = arr(d.incomeA), incQ = arr(d.incomeQ), cfA = arr(d.cashA), cfQ = arr(d.cashQ), bal = arr(d.balanceQ).concat(arr(d.balanceA)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const out = { providerId: 'fmp', provider: 'Financial Modeling Prep', retrieved: new Date().toISOString(), info: {}, values: {}, refs: {}, notes: [], peers: [] };
    const cik = p.cik || (incA[0] && incA[0].cik) || null;
    out.info = { name: p.companyName || q.name || null, ticker: p.symbol || symbol, cik: cik ? String(cik).padStart(10, '0') : null, exchange: p.exchange || p.exchangeShortName || q.exchange || null, industry: p.industry || null, sector: p.sector || null, country: p.country || null, description: p.description || null,
      currency: (incA[0] && incA[0].reportedCurrency) || p.currency || null, priceCurrency: p.currency || null };
    const filings = cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(cik).replace(/^0+/, '')}&type=10-&dateb=&owner=include&count=40` : FMP_HOME;
    const qDate = isNum(num(q.timestamp)) ? new Date(num(q.timestamp) * 1000).toISOString().slice(0, 10) : today();
    const V = (def) => Object.assign({ provider: 'Financial Modeling Prep', cat: 'vendor', url: filings, unit: '$ millions', currency: out.info.currency }, def);
    put(out, 'price', num(q.price) ?? num(p.price), { provider: 'Financial Modeling Prep quote', cat: 'market', url: FMP_HOME, asOf: qDate, period: 'as of ' + qDate, unit: 'per share', currency: out.info.priceCurrency, definition: 'Latest trade price from the provider (may be delayed or the previous close).' });
    if (isNum(out.values.price && out.values.price.v)) out.priceDate = qDate;
    const sf = (Array.isArray(d.float) ? d.float[0] : d.float) || {};
    if (isNum(num(sf.outstandingShares))) put(out, 'shares', mm(num(sf.outstandingShares)), V({ cat: 'vendor', asOf: sf.date ? String(sf.date).slice(0, 10) : null, period: 'as of ' + (sf.date ? String(sf.date).slice(0, 10) : 'date not given'), unit: 'millions of shares', currency: null, definition: 'Shares outstanding compiled by the provider from company filings. Check against the newest 10-Q / 10-K cover page.' }));
    else out.notes.push('The provider did not return a current share count. Enter actual shares outstanding from the newest cover page.');
    const y0 = incA[0], y1 = incA[1], c0 = cfA.find(r => y0 && r.date === y0.date);
    const putFY = (k, v, field, def) => put(out, k, v, V({ period: 'fiscal year ended ' + y0.date, end: y0.date, method: def || `Provider field ${field} (${y0.period || 'FY'} ${y0.fiscalYear || ''}).` }));
    if (y0) {
      const da = c0 && isNum(num(c0.depreciationAndAmortization)) ? num(c0.depreciationAndAmortization) : num(y0.depreciationAndAmortization);
      putFY('rev_fy', mm(num(y0.revenue)), 'revenue'); putFY('gp_fy', mm(num(y0.grossProfit)), 'grossProfit'); putFY('ebit_fy', mm(num(y0.operatingIncome)), 'operatingIncome');
      if (isNum(num(y0.operatingIncome)) && isNum(da)) putFY('ebitda_fy', mm(num(y0.operatingIncome) + da), null, 'Calculated: operating income + D&A from the cash flow statement (the provider\'s own EBITDA field is a reference only).');
      putFY('ni_fy', mm(num(y0.netIncome)), 'netIncome'); put(out, 'eps_fy', num(y0.epsDiluted) ?? num(y0.epsdiluted), V({ unit: 'per share', period: 'fiscal year ended ' + y0.date, end: y0.date, method: 'Provider diluted EPS.' }));
      if (c0) { const cx = num(c0.capitalExpenditure); if (isNum(cx)) putFY('capex_fy', mm(Math.abs(cx)), 'capitalExpenditure'); if (isNum(num(c0.operatingCashFlow)) && isNum(cx)) putFY('fcf_fy', mm(num(c0.operatingCashFlow) - Math.abs(cx)), null, 'Calculated: operating cash flow − capital expenditures.'); }
      if (isNum(num(y0.ebitda))) putRef(out, 'vendorEbitda', mm(num(y0.ebitda)), V({ period: 'fiscal year ended ' + y0.date, definition: 'The provider\'s EBITDA field. Its definition can differ from operating income + D&A (for example by including other income).' }));
    }
    if (y1) put(out, 'rev_fy_prior', mm(num(y1.revenue)), V({ period: 'fiscal year ended ' + y1.date, end: y1.date }));
    // TTM from quarterly statements
    if (y0 && incQ.length) {
      const cq = cfQ;
      const t = (k, rows, row0, field, conv) => { const r = ttmFromQuarters(row0, rows, field); if (r && isNum(r.v)) put(out, k, conv ? conv(r.v) : mm(r.v), V({ cat: 'calc', period: 'twelve months ended ' + r.end, end: r.end, method: r.method })); else if (r) out.notes.push(`${metricLabel(k)}: ${r.method}`); return r; };
      t('rev_ttm', incQ, y0, 'revenue'); t('gp_ttm', incQ, y0, 'grossProfit'); const eb = t('ebit_ttm', incQ, y0, 'operatingIncome'); t('ni_ttm', incQ, y0, 'netIncome');
      t('eps_ttm', incQ, y0, 'epsDiluted', v => v);
      if (c0 && cq.length) {
        const da = ttmFromQuarters(c0, cq, 'depreciationAndAmortization');
        if (eb && isNum(eb.v) && da && isNum(da.v) && da.end === eb.end) put(out, 'ebitda_ttm', mm(eb.v + da.v), V({ cat: 'calc', period: 'twelve months ended ' + eb.end, end: eb.end, method: 'Calculated: TTM operating income + TTM D&A.' }));
        const cx = ttmFromQuarters(Object.assign({}, c0, { capitalExpenditure: Math.abs(num(c0.capitalExpenditure)) }), cq.map(r => Object.assign({}, r, { capitalExpenditure: Math.abs(num(r.capitalExpenditure)) })), 'capitalExpenditure');
        const cf = ttmFromQuarters(c0, cq, 'operatingCashFlow');
        if (cx && isNum(cx.v)) put(out, 'capex_ttm', mm(cx.v), V({ cat: 'calc', period: 'twelve months ended ' + cx.end, end: cx.end, method: cx.method }));
        if (cx && cf && isNum(cx.v) && isNum(cf.v) && cx.end === cf.end) put(out, 'fcf_ttm', mm(cf.v - cx.v), V({ cat: 'calc', period: 'twelve months ended ' + cf.end, end: cf.end, method: 'Calculated: TTM operating cash flow − TTM capital expenditures.' }));
      }
      // TTM one year earlier (for growth): sum of the four quarters ending a year before the latest quarter
      const lastQ = incQ[0], q4 = incQ.filter(x => days(x.date, lastQ.date) >= 360 && days(x.date, lastQ.date) <= 640).slice(0, 4);
      if (q4.length === 4 && q4.every(x => isNum(num(x.revenue)))) put(out, 'rev_ttm_prior', mm(q4.reduce((a, x) => a + num(x.revenue), 0)), V({ cat: 'calc', period: 'twelve months ended ' + q4[0].date, end: q4[0].date, method: 'Sum of the four quarters ending one year before the latest quarter.' }));
    } else if (y0) out.notes.push('The provider did not return quarterly statements (they may need a paid plan). TTM figures are not available: load the SEC company facts file to build TTM from the 10-Q.');
    // balance sheet (newest quarter if returned)
    const b = bal[0];
    if (b) {
      const bs = def => V(Object.assign({ cat: 'vendor', period: 'as of ' + String(b.date).slice(0, 10), end: String(b.date).slice(0, 10) }, def));
      put(out, 'cash', mm(num(b.cashAndCashEquivalents)), bs());
      put(out, 'sti', mm(num(b.shortTermInvestments)), bs());
      put(out, 'stBorrow', mm(num(b.shortTermDebt)), bs({ definition: 'Provider "short-term debt": usually short-term borrowings plus the current portion of long-term debt, and it may include current lease liabilities. Check the debt note.' }));
      if (isNum(num(b.shortTermDebt))) put(out, 'ltdCurrent', 0, bs({ cat: 'calc', method: 'Included in the provider\'s short-term debt line above.' }));
      put(out, 'ltdNoncurrent', mm(num(b.longTermDebt)), bs({ definition: 'Provider "long-term debt". It may include non-current lease liabilities: check the 10-Q lease note so leases are not counted twice.' }));
      put(out, 'nci', mm(num(b.minorityInterest)), bs());
      put(out, 'preferred', mm(num(b.preferredStock)), bs());
      put(out, 'equity', mm(num(b.totalStockholdersEquity)), bs());
      if (isNum(num(b.capitalLeaseObligations))) putRef(out, 'leaseRef', mm(num(b.capitalLeaseObligations)), bs({ definition: 'Provider "capital lease obligations". The provider may include operating leases here; use the SEC file for a split between finance and operating leases.' }));
      out.notes.push('Provider balance-sheet fields follow the provider\'s definitions. For the enterprise value build, the SEC company facts file gives the line-by-line split (borrowings, finance leases, operating leases).');
    }
    // consensus estimates (annual) for FY+1 and FY+2, and NTM by calendarisation
    const est = Array.isArray(d.estimates) ? d.estimates.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
    if (y0 && est.length) {
      const fwd = est.filter(e => e.date > y0.date);
      const [f1, f2] = fwd;
      const ES = (e, f, def) => ({ provider: 'Financial Modeling Prep analyst estimates (consensus mean)', cat: 'estimate', url: FMP_HOME, period: 'fiscal year ending ' + e.date, end: e.date, unit: f === 'epsAvg' ? 'per share' : '$ millions', currency: out.info.currency, analysts: num(e.numAnalystsRevenue) ?? num(e.numAnalystsEps) ?? null, method: def || '', definition: 'Consensus mean of analyst estimates as compiled by the provider; the provider\'s EBITDA estimate definition may differ from operating income + D&A.' });
      const map = { rev: 'revenueAvg', ebitda: 'ebitdaAvg', ebit: 'ebitAvg', ni: 'netIncomeAvg', eps: 'epsAvg' };
      Object.entries(map).forEach(([k, f]) => {
        const conv = k === 'eps' ? v => v : mm;
        if (f1 && isNum(num(f1[f]))) put(out, k + '_fy1', conv(num(f1[f])), ES(f1, f));
        if (f2 && isNum(num(f2[f]))) put(out, k + '_fy2', conv(num(f2[f])), ES(f2, f));
        if (f1 && f2 && isNum(num(f1[f])) && isNum(num(f2[f]))) {
          const n = E.ntm(conv(num(f1[f])), conv(num(f2[f])), y0.date, f1.date, qDate);
          if (isNum(n.v)) put(out, k + '_ntm', n.v, Object.assign(ES(f1, f, n.note), { cat: 'estimate', period: 'next twelve months from ' + qDate, end: null, method: n.note + ` FY+1 ends ${f1.date}, FY+2 ends ${f2.date}.` }));
        }
      });
    } else if (d.estimates && d.estimates.__error) out.notes.push('Analyst estimates were not returned (' + d.estimates.__error + '). Forward multiples show Not Available.');
    const peers = d.peers;
    if (Array.isArray(peers)) out.peers = peers.map(x => typeof x === 'string' ? { symbol: x } : { symbol: x.symbol, name: x.companyName || x.name || null, mktCap: num(x.mktCap) }).filter(x => x.symbol && x.symbol !== symbol);
    else if (peers && Array.isArray(peers[0] && peers[0].peersList)) out.peers = peers[0].peersList.map(s => ({ symbol: s }));
    if (out.info.currency && out.info.priceCurrency && out.info.currency !== out.info.priceCurrency) out.notes.push(`The statements are in ${out.info.currency} and the share price is in ${out.info.priceCurrency}. Enter the exchange rate, its date and its source before multiples are calculated.`);
    return out;
  }
  async function fetchFMP(symbol, key, fetchFn = fetch, opts = {}) {
    const s = encodeURIComponent(symbol);
    const profile = await fmpGet(`profile?symbol=${s}`, key, fetchFn);
    if (!profile || (Array.isArray(profile) && !profile.length)) throw new Error(`No company found for "${symbol}".`);
    const calls = {
      quote: `quote?symbol=${s}`, incomeA: `income-statement?symbol=${s}&period=annual&limit=3`, incomeQ: `income-statement?symbol=${s}&period=quarter&limit=8`,
      cashA: `cash-flow-statement?symbol=${s}&period=annual&limit=2`, cashQ: `cash-flow-statement?symbol=${s}&period=quarter&limit=8`,
      balanceQ: `balance-sheet-statement?symbol=${s}&period=quarter&limit=1`, balanceA: `balance-sheet-statement?symbol=${s}&period=annual&limit=1`, float: `shares-float?symbol=${s}`,
      estimates: `analyst-estimates?symbol=${s}&period=annual&page=0&limit=10`,
    };
    if (opts.peers) calls.peers = `stock-peers?symbol=${s}`;
    const keys = Object.keys(calls);
    const res = await Promise.all(keys.map(k => fmpGet(calls[k], key, fetchFn, true)));
    const d = { profile };
    keys.forEach((k, i) => { d[k] = res[i]; });
    const clean = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && v.__error && k !== 'estimates' ? null : v]));
    const out = fromFMP(symbol, clean);
    ['quote', 'incomeA', 'balanceQ', 'float'].forEach(k => { if (d[k] && d[k].__error) out.notes.push(`The provider did not return ${k}: ${d[k].__error}`); });
    if (opts.peers && d.peers && d.peers.__error) out.notes.push('Peer suggestions were not returned: ' + d.peers.__error);
    return out;
  }

  async function suggestPeers(symbol, key, fetchFn = fetch) {
    const j = await fmpGet(`stock-peers?symbol=${encodeURIComponent(symbol)}`, key, fetchFn);
    const arr = Array.isArray(j) ? j : [];
    if (arr.length && Array.isArray(arr[0].peersList)) return arr[0].peersList.map(s => ({ symbol: s }));
    return arr.map(x => typeof x === 'string' ? { symbol: x } : { symbol: x.symbol, name: x.companyName || x.name || null, mktCap: num(x.mktCap) }).filter(x => x.symbol && x.symbol !== symbol);
  }
  // ---------- from a DCF model (shared company data; never changes the DCF model) ----------
  function fromDCF(m) {
    const I = m.inputs || {}, S = m.sources || {};
    const out = { providerId: 'dcf', provider: 'DCF model: ' + (m.name || ''), retrieved: new Date().toISOString(), info: {}, values: {}, refs: {}, notes: [] };
    const C = I.company || {};
    out.info = { name: C.name || null, ticker: (m.meta && m.meta.symbol) || (C.ticker ? String(C.ticker).split(' ')[0] : null), cik: (m.meta && m.meta.cik) || null, industry: C.industry || null, currency: C.currency || 'USD' };
    const src = (k, extra) => Object.assign({ provider: 'From DCF model "' + (m.name || '') + '"', cat: (S[k] && S[k].cls === 'market') ? 'market' : 'dcf', url: (S[k] && S[k].url) || null, period: (S[k] && S[k].period) || null, method: 'Copied from the DCF model. Its original source: ' + ((S[k] && S[k].name) || 'not recorded') + '.', unit: '$ millions', currency: C.currency || 'USD' }, extra || {});
    put(out, 'price', I.price, src('price', { unit: 'per share', asOf: (m.asOf && m.asOf.price) || C.valDate || null }));
    if (isNum(I.price)) out.priceDate = (m.asOf && m.asOf.price) || C.valDate || null;
    put(out, 'shares', I.basic, src('basic', { unit: 'millions of shares', currency: null, asOf: m.asOf && m.asOf.basic }));
    put(out, 'cash', I.cash, src('cash')); put(out, 'sti', I.sti, src('sti'));
    if (isNum(I.debt)) { put(out, 'ltdNoncurrent', I.debt, src('debt', { method: 'Total debt from the DCF model (one line). Copied into this line; the other debt lines are set to 0 because they are included here.' })); ['stBorrow', 'ltdCurrent'].forEach(k => put(out, k, 0, src('debt', { cat: 'calc', method: 'Included in the total debt copied from the DCF model.' }))); }
    put(out, 'opLease', I.leases, src('leases')); put(out, 'nci', I.minority, src('minority'));
    out.notes.push('Copied market and balance-sheet figures only. Operating figures for the multiples should come from the SEC file or the provider, so the trailing periods are dated.');
    return out;
  }

  // ---------- applying an import ----------
  // New company: every value is written. Existing company: blanks are filled; changes to existing
  // values (and anything the analyst entered manually) are proposed for review and never applied silently.
  function applyImport(c, imp, opts = {}) {
    const isNew = opts.isNew || !Object.keys(c.v || {}).length;
    const info = imp.info || {};
    const infoKeys = ['name', 'ticker', 'cik', 'exchange', 'industry', 'sector', 'country', 'description', 'fyEnd', 'currency', 'priceCurrency', 'accounting'];
    infoKeys.forEach(k => { if (info[k] && (isNew || !c[k] || opts.replaceInfo)) c[k] = info[k]; });
    if (!c.priceCurrency) c.priceCurrency = c.currency;
    const pend = [];
    let filled = 0, same = 0;
    Object.entries(imp.values).forEach(([k, r]) => {
      const cur = c.v[k];
      if (!cur || !isNum(cur.v)) { c.v[k] = Object.assign({ hist: cur && cur.hist ? cur.hist : [] }, r); filled++; return; }
      if (Math.abs(cur.v - r.v) <= 1e-9 * Math.max(1, Math.abs(r.v))) { if (!(cur.src && cur.src.cat === 'manual')) { c.v[k].src = r.src; } same++; return; }
      pend.push({ id: uid(), key: k, from: cur.v, to: r.v, manual: !!(cur.src && cur.src.cat === 'manual'), src: r.src });
    });
    if (imp.priceDate && (!c.priceDate || filled)) c.priceDate = c.priceDate && c.v.price && c.v.price.src && c.v.price.src.cat === 'manual' ? c.priceDate : imp.priceDate;
    c.ref = Object.assign({}, c.ref || {}, imp.refs || {});
    c.importNotes = (imp.notes || []).slice();
    c.imports = (c.imports || []).concat([{ at: imp.retrieved, provider: imp.provider, filled, pending: pend.length, same }]).slice(-20);
    if (pend.length) c.pending = { at: imp.retrieved, provider: imp.provider, items: pend };
    if (imp.filings) c.filings = imp.filings;
    return { filled, pending: pend.length, same };
  }
  function applyPending(c, ids, allowManual) {
    if (!c.pending) return 0;
    let n = 0;
    c.pending.items = c.pending.items.filter(p => {
      if (!ids.includes(p.id)) return true;
      if (p.manual && !allowManual) return true;
      const prev = c.v[p.key];
      c.v[p.key] = { v: p.to, src: p.src, hist: [].concat(prev && prev.hist ? prev.hist : [], prev ? [{ v: prev.v, src: prev.src, at: new Date().toISOString(), why: 'Replaced by reviewed import' }] : []).slice(-30) };
      n++; return false;
    });
    if (!c.pending.items.length) c.pending = null;
    return n;
  }
  function dismissPending(c, ids) { if (!c.pending) return; c.pending.items = c.pending.items.filter(p => !ids.includes(p.id)); if (!c.pending.items.length) c.pending = null; }
  // manual entry keeps the previous value and its source in the history
  function setManual(c, key, v, note) {
    const prev = c.v[key];
    if (prev && prev.v === v) return false;
    const hist = [].concat(prev && prev.hist ? prev.hist : [], prev && (isNum(prev.v) || prev.src) ? [{ v: prev.v, src: prev.src, at: new Date().toISOString(), why: 'Overridden by manual entry' }] : []).slice(-30);
    c.v[key] = { v, src: { provider: 'Manual entry', cat: 'manual', retrieved: today(), method: note || '' }, hist };
    return true;
  }
  function restore(c, key) {
    const r = c.v[key]; if (!r || !r.hist || !r.hist.length) return false;
    const i = r.hist.map(h => h.src && h.src.cat !== 'manual').lastIndexOf(true); if (i < 0) return false;
    const h = r.hist[i];
    c.v[key] = { v: h.v, src: h.src, hist: r.hist.slice(0, i).concat(r.hist.slice(i + 1), [{ v: r.v, src: r.src, at: new Date().toISOString(), why: 'Manual value replaced by restoring the imported figure' }]).slice(-30) };
    return true;
  }
  function useRef(c, refKey, toKey) {
    const r = c.ref && c.ref[refKey]; if (!r) return false;
    const prev = c.v[toKey];
    c.v[toKey] = { v: r.v, src: Object.assign({}, r.src, { method: (r.src.method && r.src.method !== 'Reported' ? r.src.method + ' ' : '') + 'Accepted by the analyst from the reference value.' }), hist: [].concat(prev && prev.hist ? prev.hist : [], prev ? [{ v: prev.v, src: prev.src, at: new Date().toISOString(), why: 'Replaced by an accepted reference value' }] : []).slice(-30) };
    return true;
  }

  // ---------- data quality ----------
  // returns [{level, key, text}] for one company
  function quality(c, model) {
    const out = [];
    const set = model.settings || {};
    const pd = c.priceDate;
    if (!E.has(c, 'price')) out.push({ level: 'bad', key: 'price', text: 'Share price missing.' });
    else if (!pd) out.push({ level: 'warn', key: 'price', text: 'Share price has no observation date.' });
    if (!E.has(c, 'shares')) out.push({ level: 'bad', key: 'shares', text: 'Actual shares outstanding missing.' });
    const sh = c.v.shares && c.v.shares.src;
    if (sh && sh.asOf && pd && days(sh.asOf, pd) > 200) out.push({ level: 'warn', key: 'shares', text: `Share count is dated ${sh.asOf}, more than six months before the price date.` });
    if (c.ref && c.ref.waDilQ && E.has(c, 'shares') && Math.abs(c.ref.waDilQ.v - E.val(c, 'shares')) < 1e-6) out.push({ level: 'bad', key: 'shares', text: 'Shares outstanding equal the weighted-average diluted count: use the cover-page count.' });
    const e = E.evBuild(c, set);
    if (e.missing.length) out.push({ level: 'bad', key: 'ev', text: 'Enterprise value incomplete: ' + e.missing.map(k => k === 'fx' ? 'exchange rate' : k === 'debt' ? 'borrowings (short-term, current or long-term debt; enter 0 if none)' : label(k)).join(', ') + '.' });
    if (!E.has(c, 'rev_ttm') && !E.has(c, 'rev_fy')) out.push({ level: 'bad', key: 'rev_ttm', text: 'No revenue.' });
    else if (!E.has(c, 'rev_ttm')) out.push({ level: 'warn', key: 'rev_ttm', text: 'No TTM figures: trailing multiples use the last fiscal year only if you switch the period.' });
    // stale: TTM end more than 200 days before the price date
    const t = c.v.rev_ttm && c.v.rev_ttm.src;
    if (t && t.end && pd && days(t.end, pd) > 200) out.push({ level: 'warn', key: 'rev_ttm', text: `TTM ends ${t.end}, more than six months before the price date: check for a newer 10-Q.` });
    Object.entries(c.v).forEach(([k, r]) => { if (r && r.src && r.src.stale) out.push({ level: 'warn', key: k, text: label(k) + ': ' + r.src.staleNote }); });
    const fx = E.fxOf(c);
    if (fx.missing) out.push({ level: 'bad', key: 'fx', text: `Exchange rate ${fx.from}→${fx.to} missing.` });
    else if (!fx.same && !(c.fx && c.fx.date && c.fx.source)) out.push({ level: 'warn', key: 'fx', text: 'Exchange rate has no date or source.' });
    (c.adj || []).forEach(a => { if (isNum(a.amount) && Math.abs(a.amount) > 0 && (!a.reason || !a.source)) out.push({ level: 'warn', key: 'adj', text: `Adjustment "${a.type || 'other'}" (${a.metric.toUpperCase()} ${a.period.toUpperCase()}) has no ${!a.reason ? 'justification' : 'source'}.` }); });
    if (c.pending) out.push({ level: 'warn', key: 'pending', text: `${c.pending.items.length} proposed data update(s) waiting for review.` });
    if (c.role === 'peer' && !c.reason) out.push({ level: 'warn', key: 'reason', text: 'No reason recorded for including this peer.' });
    return out;
  }

  return { emptyCompany, fromSEC, fromFMP, fetchFMP, suggestPeers, fromDCF, ttmFromQuarters, applyImport, applyPending, dismissPending, setManual, restore, useRef, quality, label, metricLabel, uid, FMP_HOME };
})();
if (typeof module !== 'undefined') module.exports = CompsData;
