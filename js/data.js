// ===== FINANCIAL DATA IMPORT (no UI) =====
// Fetches public company data from a data provider, or reads an SEC "company facts" file,
// and turns it into figures the model can use. Every figure carries its source, reporting
// period and retrieval time. Only reported figures and market data are written into the model.
// Forecast assumptions are never filled in: provider figures such as beta or the 10-year
// Treasury yield are kept as reference values for the analyst to accept or ignore.
const DCFData = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const num = v => { if (v === null || v === undefined || v === '' || v === 'None' || v === '-') return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; };
  const mm = v => isNum(v) ? v / 1e6 : null;
  const sumIf = (...xs) => xs.some(isNum) ? xs.reduce((a, b) => a + (isNum(b) ? b : 0), 0) : null;
  const yearOf = (date, fy) => { const f = num(fy); if (isNum(f) && f > 1900) return f; return date ? +String(date).slice(0, 4) : null; };
  const today = () => new Date().toISOString().slice(0, 10);
  const edgarFilings = cik => cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(cik).replace(/^0+/, '')}&type=10-K&dateb=&owner=include&count=40` : 'https://www.sec.gov/edgar/search/';

  const PROVIDERS = {
    fmp: { id: 'fmp', name: 'Financial Modeling Prep', keyUrl: 'https://site.financialmodelingprep.com/developer/docs', home: 'https://site.financialmodelingprep.com/', note: 'Free key: 250 requests a day, US-listed companies, 5 years of annual statements. One import uses about 7 requests.' },
    av: { id: 'av', name: 'Alpha Vantage', keyUrl: 'https://www.alphavantage.co/support/#api-key', home: 'https://www.alphavantage.co/', note: 'Free key: 25 requests a day. One import uses 6 requests. Stock-based compensation and change in working capital are not provided.' },
  };

  // ---- a normalised import ----
  // { provider, providerId, retrieved, symbol, company:{...}, values:{key:{v,...}}, hist:{years:[], rev:[], ...}, histSrc:{key:{...}}, ref:{key:{v,...}}, notes:[] }
  function blankImport(providerId, providerName, symbol) {
    return { providerId, provider: providerName, retrieved: new Date().toISOString(), symbol, company: {}, values: {}, tri: {}, hist: null, histSrc: {}, ref: {}, notes: [] };
  }
  function put(imp, key, v, meta) { if (!isNum(v) && typeof v !== 'string') return; if (typeof v === 'string' && !v.trim()) return; imp.values[key] = Object.assign({ v }, meta); }
  function putRef(imp, key, v, meta) { if (!isNum(v)) return; imp.ref[key] = Object.assign({ v }, meta); }

  // Build five years of history, oldest first, from per-year rows sorted newest or oldest first.
  function histFrom(rows, meta) {
    const r = rows.filter(x => isNum(x.year)).sort((a, b) => a.year - b.year).slice(-5);
    while (r.length < 5) r.unshift({ year: null });
    const keys = ['rev', 'gp', 'opex', 'da', 'interest', 'sbc', 'dnwc', 'capex'];
    const hist = { years: r.map(x => x.year) };
    keys.forEach(k => hist[k] = r.map(x => isNum(x[k]) ? x[k] : null));
    const src = {};
    keys.forEach(k => { if (hist[k].some(isNum)) src[k] = Object.assign({}, meta, { period: periodText(hist.years, hist[k]), notes: (meta.derived && meta.derived[k]) || meta.notes || '' }); });
    Object.values(src).forEach(s => delete s.derived);
    return { hist, src };
  }
  function periodText(years, vals) { const ys = years.filter((y, i) => isNum(y) && isNum(vals[i])); return ys.length ? (ys.length > 1 ? `FY${ys[0]}–FY${ys[ys.length - 1]}` : `FY${ys[0]}`) : ''; }
  // EBITDA = operating income + D&A, so operating expenses excluding D&A = gross profit − EBITDA.
  function opexExDA(gp, opInc, da) { return isNum(gp) && isNum(opInc) && isNum(da) ? gp - (opInc + da) : null; }

  // ---------- Financial Modeling Prep (stable API) ----------
  function mapFMP(symbol, d) {
    const imp = blankImport('fmp', PROVIDERS.fmp.name, symbol);
    const p = (Array.isArray(d.profile) ? d.profile[0] : d.profile) || {};
    const q = (Array.isArray(d.quote) ? d.quote[0] : d.quote) || {};
    const inc = Array.isArray(d.income) ? d.income : [], bal = Array.isArray(d.balance) ? d.balance : [], cf = Array.isArray(d.cashflow) ? d.cashflow : [];
    const cik = p.cik || (inc[0] && inc[0].cik) || null;
    const filings = edgarFilings(cik);
    const exch = p.exchange || p.exchangeShortName || q.exchange || '';
    imp.company = { name: p.companyName || q.name || null, ticker: (p.symbol || symbol) + (exch ? ' ' + exch : ''), industry: p.industry || null, sector: p.sector || null, currency: p.currency || (inc[0] && inc[0].reportedCurrency) || null, cik, exchange: p.exchangeFullName || exch || null, country: p.country || null, website: p.website || null, description: p.description || null };
    const qDate = isNum(num(q.timestamp)) ? new Date(num(q.timestamp) * 1000).toISOString().slice(0, 10) : today();
    const mkt = { source: `${PROVIDERS.fmp.name} quote`, type: 'Market data provider', cls: 'market', url: PROVIDERS.fmp.home, period: 'as of ' + qDate, asOf: qDate };
    put(imp, 'price', num(q.price) ?? num(p.price), mkt);
    let hi = num(q.yearHigh), lo = num(q.yearLow);
    if ((!isNum(hi) || !isNum(lo)) && typeof p.range === 'string') { const m = p.range.split('-').map(num); if (m.length === 2) { lo = lo ?? m[0]; hi = hi ?? m[1]; } }
    put(imp, 'hi52', hi, Object.assign({}, mkt, { period: '52 weeks to ' + qDate }));
    put(imp, 'lo52', lo, Object.assign({}, mkt, { period: '52 weeks to ' + qDate }));
    const sf = (Array.isArray(d.float) ? d.float[0] : d.float) || {};
    const incSorted = inc.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (isNum(num(sf.outstandingShares))) put(imp, 'basic', mm(num(sf.outstandingShares)), { source: `${PROVIDERS.fmp.name} shares outstanding (from company filings)`, type: 'Filing data via provider', cls: 'filing', url: filings, asOf: sf.date ? String(sf.date).slice(0, 10) : null, period: 'as of ' + (sf.date ? String(sf.date).slice(0, 10) : 'date not given'), notes: 'Period-end shares outstanding compiled by the provider from the latest filing. Check against the 10-Q / 10-K cover page.', review: true });
    else imp.notes.push('The provider did not return a current share count. Enter actual shares outstanding from the latest 10-Q / 10-K cover page. (Weighted-average shares from the income statement are not used as a substitute.)');
    const wa = incSorted.find(r => isNum(num(r.weightedAverageShsOut)));
    if (wa) putRef(imp, 'basicWA', mm(num(wa.weightedAverageShsOut)), { source: `${PROVIDERS.fmp.name} income statement`, type: '10-K annual report', url: filings, period: 'FY' + yearOf(wa.date, wa.fiscalYear) + ' average', label: 'Basic weighted-average shares', notes: 'An average for the fiscal year. Reference only: not a current share count.' });
    const dl = incSorted.find(r => isNum(num(r.weightedAverageShsOutDil)));
    if (dl) putRef(imp, 'dilutedWA', mm(num(dl.weightedAverageShsOutDil)), { source: `${PROVIDERS.fmp.name} income statement`, type: '10-K annual report', url: filings, period: 'FY' + yearOf(dl.date, dl.fiscalYear) + ' average', label: 'Diluted weighted-average shares', notes: 'An average for the fiscal year that excludes anti-dilutive awards. Reference only: not a current diluted count.' });
    imp.shareData = {};
    if (wa) imp.shareData.waBasicFY = { value: mm(num(wa.weightedAverageShsOut)), periodText: 'fiscal year ' + yearOf(wa.date, wa.fiscalYear) + ' (provider)', form: '10-K' };
    if (dl) imp.shareData.waDilFY = { value: mm(num(dl.weightedAverageShsOutDil)), periodText: 'fiscal year ' + yearOf(dl.date, dl.fiscalYear) + ' (provider)', form: '10-K' };
    putRef(imp, 'marketCap', mm(num(q.marketCap) ?? num(p.marketCap)), Object.assign({}, mkt, { label: 'Market capitalisation ($ mm)' }));
    putRef(imp, 'beta', num(p.beta), { source: `${PROVIDERS.fmp.name} company profile`, type: 'Market data provider', url: PROVIDERS.fmp.home, period: 'as of ' + qDate, label: 'Provider beta', notes: 'Regression beta from the provider (usually 5 years of monthly returns against the S&P 500).' });
    // statements
    const byYear = {};
    const row = (r) => { const y = yearOf(r.date, r.fiscalYear); if (!isNum(y)) return null; return (byYear[y] = byYear[y] || { year: y, end: r.date }); };
    inc.forEach(r => { const o = row(r); if (!o) return; o.rev = num(r.revenue); o.gp = num(r.grossProfit); if (!isNum(o.gp) && isNum(o.rev) && isNum(num(r.costOfRevenue))) o.gp = o.rev - num(r.costOfRevenue); o.opInc = num(r.operatingIncome); o.daIS = num(r.depreciationAndAmortization); o.interest = num(r.interestExpense); o.tax = num(r.incomeTaxExpense); o.ebt = num(r.incomeBeforeTax); });
    cf.forEach(r => { const o = row(r); if (!o) return; o.da = num(r.depreciationAndAmortization); o.sbc = num(r.stockBasedCompensation); o.dnwc = num(r.changeInWorkingCapital); const c = num(r.capitalExpenditure) ?? num(r.investmentsInPropertyPlantAndEquipment); o.capex = isNum(c) ? -Math.abs(c) : null; });
    const rows = Object.values(byYear).map(o => { const da = isNum(o.da) ? o.da : o.daIS; return { year: o.year, rev: mm(o.rev), gp: mm(o.gp), opex: mm(opexExDA(o.gp, o.opInc, da)), da: mm(da), interest: mm(o.interest), sbc: mm(o.sbc), dnwc: mm(o.dnwc), capex: mm(o.capex), tax: o.tax, ebt: o.ebt }; });
    if (rows.length) {
      const h = histFrom(rows, { source: `${PROVIDERS.fmp.name} annual statements`, type: '10-K annual report', url: filings, derived: { opex: 'Calculated from the provider data: gross profit − (operating income + D&A).', capex: 'Shown as a negative cash outflow.' } });
      imp.hist = h.hist; imp.histSrc = h.src;
      const eff = effectiveTax(rows); if (eff) putRef(imp, 'effTax', eff.v, { source: 'Calculated from imported statements', type: 'Calculated', period: eff.period, label: 'Effective tax rate (3-year average)', calculated: true });
    }
    const b = bal.slice().sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
    if (b) {
      const bs = { source: `${PROVIDERS.fmp.name} balance sheet`, type: '10-K annual report', url: filings, period: 'as of ' + String(b.date).slice(0, 10) };
      put(imp, 'cash', mm(num(b.cashAndCashEquivalents)), bs);
      put(imp, 'sti', mm(num(b.shortTermInvestments)), bs);
      const td = num(b.totalDebt) ?? sumIf(num(b.shortTermDebt), num(b.longTermDebt));
      put(imp, 'debt', mm(td), Object.assign({}, bs, { notes: 'Provider total debt. It may include finance or operating lease liabilities: check the 10-K debt and lease notes so leases are not counted twice.', review: true }));
      put(imp, 'minority', mm(num(b.minorityInterest)), bs);
      put(imp, 'dtl', mm(num(b.deferredTaxLiabilitiesNonCurrent)), Object.assign({}, bs, { notes: 'Non-current deferred tax liabilities as reported. Net them against deferred tax assets if your method calls for it.', review: true }));
    }
    const t = Array.isArray(d.treasury) ? d.treasury.slice().sort((x, y) => String(y.date).localeCompare(String(x.date)))[0] : null;
    if (t && isNum(num(t.year10))) putRef(imp, 'rf', num(t.year10) / 100, { source: `${PROVIDERS.fmp.name} Treasury rates`, type: 'Market data provider', url: 'https://fred.stlouisfed.org/series/DGS10', period: 'as of ' + t.date, label: '10-year Treasury yield' });
    finishNotes(imp);
    imp.flags = validateImport(imp);
    return imp;
  }
  async function fetchFMP(symbol, key, fetchFn = fetch) {
    const base = 'https://financialmodelingprep.com/stable/';
    const get = async (path, optional) => {
      try {
        const res = await fetchFn(base + path + (path.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(key));
        let j = null; try { j = await res.json(); } catch (e) {}
        const msg = j && !Array.isArray(j) && (j['Error Message'] || j.message || j.error);
        if (!res.ok || msg) throw new Error(msg || `HTTP ${res.status}`);
        return j;
      } catch (e) { if (optional) return { __error: e.message }; throw e; }
    };
    const s = encodeURIComponent(symbol);
    const profile = await get(`profile?symbol=${s}`);
    if (!profile || (Array.isArray(profile) && !profile.length)) throw new Error(`No company found for "${symbol}".`);
    const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const [quote, income, balance, cashflow, float, treasury] = await Promise.all([
      get(`quote?symbol=${s}`, true), get(`income-statement?symbol=${s}&period=annual&limit=5`, true), get(`balance-sheet-statement?symbol=${s}&period=annual&limit=1`, true),
      get(`cash-flow-statement?symbol=${s}&period=annual&limit=5`, true), get(`shares-float?symbol=${s}`, true), get(`treasury-rates?from=${from}&to=${today()}`, true)]);
    const d = { profile, quote, income, balance, cashflow, float, treasury };
    const imp = mapFMP(symbol, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && v.__error ? null : v])));
    Object.entries({ quote: 'quote', income: 'income statements', balance: 'balance sheet', cashflow: 'cash flow statements', float: 'shares outstanding', treasury: 'Treasury rates' }).forEach(([k, l]) => { if (d[k] && d[k].__error) imp.notes.push(`The provider did not return ${l}: ${d[k].__error}`); });
    return imp;
  }
  async function searchFMP(q, key, fetchFn = fetch) {
    const res = await fetchFn(`https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&apikey=${encodeURIComponent(key)}`);
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok || !Array.isArray(j)) throw new Error((j && (j['Error Message'] || j.message)) || `HTTP ${res.status}`);
    return j.slice(0, 12).map(r => ({ symbol: r.symbol, name: r.name, exchange: r.exchange || r.exchangeFullName || '', currency: r.currency || '' }));
  }

  // ---------- Alpha Vantage ----------
  function mapAV(symbol, d) {
    const imp = blankImport('av', PROVIDERS.av.name, symbol);
    const o = d.overview || {}, q = (d.quote && d.quote['Global Quote']) || {};
    const cik = o.CIK || null, filings = edgarFilings(cik);
    imp.company = { name: o.Name || null, ticker: (o.Symbol || symbol) + (o.Exchange ? ' ' + o.Exchange : ''), industry: o.Industry ? titleCase(o.Industry) : null, sector: o.Sector ? titleCase(o.Sector) : null, currency: o.Currency || null, cik, exchange: o.Exchange || null, country: o.Country || null, website: o.OfficialSite || null, description: o.Description || null };
    const qDate = q['07. latest trading day'] || today();
    const mkt = { source: `${PROVIDERS.av.name} quote`, type: 'Market data provider', cls: 'market', url: PROVIDERS.av.home, period: 'as of ' + qDate, asOf: qDate };
    put(imp, 'price', num(q['05. price']), mkt);
    put(imp, 'hi52', num(o['52WeekHigh']), Object.assign({}, mkt, { source: `${PROVIDERS.av.name} company overview`, period: '52 weeks to about ' + qDate, notes: 'Provider range, refreshed about daily.' }));
    put(imp, 'lo52', num(o['52WeekLow']), Object.assign({}, mkt, { source: `${PROVIDERS.av.name} company overview`, period: '52 weeks to about ' + qDate, notes: 'Provider range, refreshed about daily.' }));
    put(imp, 'basic', mm(num(o.SharesOutstanding)), { source: `${PROVIDERS.av.name} company overview (shares outstanding)`, type: 'Filing data via provider', cls: 'filing', url: filings, asOf: o.LatestQuarter || null, period: 'latest quarter ' + (o.LatestQuarter || 'not given'), notes: 'Shares outstanding reported by the provider for the latest quarter. Check against the 10-Q / 10-K cover page, which is usually more recent.', review: true });
    putRef(imp, 'marketCap', mm(num(o.MarketCapitalization)), Object.assign({}, mkt, { label: 'Market capitalisation ($ mm)' }));
    putRef(imp, 'beta', num(o.Beta), { source: `${PROVIDERS.av.name} company overview`, type: 'Market data provider', url: PROVIDERS.av.home, period: 'as of ' + (o.LatestQuarter || qDate), label: 'Provider beta', notes: 'Regression beta reported by the provider.' });
    const byYear = {};
    const row = r => { const y = yearOf(r.fiscalDateEnding); if (!isNum(y)) return null; return (byYear[y] = byYear[y] || { year: y }); };
    ((d.income && d.income.annualReports) || []).forEach(r => { const x = row(r); if (!x) return; x.rev = num(r.totalRevenue); x.gp = num(r.grossProfit); if (!isNum(x.gp) && isNum(x.rev) && isNum(num(r.costOfRevenue))) x.gp = x.rev - num(r.costOfRevenue); x.opInc = num(r.operatingIncome); x.daIS = num(r.depreciationAndAmortization); x.interest = num(r.interestExpense); x.tax = num(r.incomeTaxExpense); x.ebt = num(r.incomeBeforeTax); });
    ((d.cashflow && d.cashflow.annualReports) || []).forEach(r => { const x = row(r); if (!x) return; x.da = num(r.depreciationDepletionAndAmortization); const c = num(r.capitalExpenditures); x.capex = isNum(c) ? -Math.abs(c) : null; });
    const rows = Object.values(byYear).map(x => { const da = isNum(x.da) ? x.da : x.daIS; return { year: x.year, rev: mm(x.rev), gp: mm(x.gp), opex: mm(opexExDA(x.gp, x.opInc, da)), da: mm(da), interest: mm(x.interest), sbc: null, dnwc: null, capex: mm(x.capex), tax: x.tax, ebt: x.ebt }; });
    if (rows.length) {
      const h = histFrom(rows, { source: `${PROVIDERS.av.name} annual statements`, type: '10-K annual report', url: filings, derived: { opex: 'Calculated from the provider data: gross profit − (operating income + D&A).', capex: 'Shown as a negative cash outflow.' } });
      imp.hist = h.hist; imp.histSrc = h.src;
      const eff = effectiveTax(rows); if (eff) putRef(imp, 'effTax', eff.v, { source: 'Calculated from imported statements', type: 'Calculated', period: eff.period, label: 'Effective tax rate (3-year average)', calculated: true });
    }
    const b = ((d.balance && d.balance.annualReports) || []).slice().sort((x, y) => String(y.fiscalDateEnding).localeCompare(String(x.fiscalDateEnding)))[0];
    if (b) {
      const bs = { source: `${PROVIDERS.av.name} balance sheet`, type: '10-K annual report', url: filings, period: 'as of ' + b.fiscalDateEnding };
      put(imp, 'cash', mm(num(b.cashAndCashEquivalentsAtCarryingValue)), bs);
      put(imp, 'sti', mm(num(b.shortTermInvestments)), bs);
      const td = sumIf(num(b.shortTermDebt), num(b.longTermDebtNoncurrent) ?? num(b.longTermDebt));
      put(imp, 'debt', mm(td), Object.assign({}, bs, { notes: 'Short-term debt + long-term debt as reported by the provider. Check the 10-K debt note, and whether finance leases are included.', review: true }));
    }
    const ty = d.treasury && Array.isArray(d.treasury.data) ? d.treasury.data.find(x => isNum(num(x.value))) : null;
    if (ty) putRef(imp, 'rf', num(ty.value) / 100, { source: `${PROVIDERS.av.name} Treasury yield`, type: 'Market data provider', url: 'https://fred.stlouisfed.org/series/DGS10', period: 'as of ' + ty.date, label: '10-year Treasury yield' });
    imp.notes.push('Alpha Vantage does not provide stock-based compensation or the change in working capital. Enter them from the cash flow statement.');
    finishNotes(imp);
    imp.flags = validateImport(imp);
    return imp;
  }
  async function fetchAV(symbol, key, fetchFn = fetch) {
    const get = async (fn, extra = '', optional) => {
      try {
        const res = await fetchFn(`https://www.alphavantage.co/query?function=${fn}${extra}&apikey=${encodeURIComponent(key)}`);
        const j = await res.json();
        const msg = j && (j['Error Message'] || j.Information || j.Note);
        if (!res.ok || msg) throw new Error(msg || `HTTP ${res.status}`);
        return j;
      } catch (e) { if (optional) return { __error: e.message }; throw e; }
    };
    const s = '&symbol=' + encodeURIComponent(symbol);
    const overview = await get('OVERVIEW', s);
    if (!overview || !overview.Symbol) throw new Error(`No company found for "${symbol}".`);
    const [quote, income, cashflow, balance, treasury] = await Promise.all([get('GLOBAL_QUOTE', s, true), get('INCOME_STATEMENT', s, true), get('CASH_FLOW', s, true), get('BALANCE_SHEET', s, true), get('TREASURY_YIELD', '&interval=daily&maturity=10year', true)]);
    const d = { overview, quote, income, cashflow, balance, treasury };
    const imp = mapAV(symbol, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && v.__error ? null : v])));
    Object.entries({ quote: 'a quote', income: 'income statements', cashflow: 'cash flow statements', balance: 'a balance sheet', treasury: 'Treasury yields' }).forEach(([k, l]) => { if (d[k] && d[k].__error) imp.notes.push(`The provider did not return ${l}: ${d[k].__error}`); });
    return imp;
  }
  async function searchAV(q, key, fetchFn = fetch) {
    const res = await fetchFn(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${encodeURIComponent(key)}`);
    const j = await res.json();
    const msg = j && (j['Error Message'] || j.Information || j.Note);
    if (!res.ok || msg) throw new Error(msg || `HTTP ${res.status}`);
    return (j.bestMatches || []).slice(0, 12).map(r => ({ symbol: r['1. symbol'], name: r['2. name'], exchange: r['4. region'] || '', currency: r['8. currency'] || '' }));
  }

  // ---------- SEC company facts file (data.sec.gov/api/xbrl/companyfacts/CIK##########.json) ----------
  // Uses DCFSec to pick the newest appropriate disclosure for each metric. Every value carries a full source record.
  const Sec = (typeof DCFSec !== 'undefined') ? DCFSec : (typeof require !== 'undefined' ? require('./sec.js') : null);
  const filingUrl = (cik, accn) => accn ? Sec.indexUrl(cik, accn) : edgarFilings(cik);
  const BS = {
    cash: { c: ['CashAndCashEquivalentsAtCarryingValue'], label: 'Cash & equivalents' },
    sti: { c: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'], label: 'Short-term investments' },
    debtLT: { c: ['LongTermDebt'], label: 'Long-term debt incl. current portion' },
    debtNC: { c: ['LongTermDebtNoncurrent'], label: 'Long-term debt, non-current' },
    debtCur: { c: ['LongTermDebtCurrent'], label: 'Current portion of long-term debt' },
    stDebt: { c: ['ShortTermBorrowings', 'CommercialPaper'], label: 'Short-term borrowings' },
    leases: { c: ['OperatingLeaseLiability'], label: 'Operating lease liabilities' },
    leasesNC: { c: ['OperatingLeaseLiabilityNoncurrent'], label: 'Operating lease liabilities, non-current' },
    leasesC: { c: ['OperatingLeaseLiabilityCurrent'], label: 'Operating lease liabilities, current' },
    minority: { c: ['MinorityInterest'], label: 'Non-controlling interests' },
    finL: { c: ['FinanceLeaseLiability'], label: 'Finance lease liabilities' },
    finLNC: { c: ['FinanceLeaseLiabilityNoncurrent'], label: 'Finance lease liabilities, non-current' },
    finLC: { c: ['FinanceLeaseLiabilityCurrent'], label: 'Finance lease liabilities, current' },
    crypto: { c: ['CryptoAssetFairValue'], label: 'Crypto assets at fair value' },
  };
  function secMeta(rec, extra) {
    return Object.assign({ rec, cls: rec.cat === 'calc' ? 'calc' : 'filing', asOf: rec.end, source: `SEC EDGAR XBRL: ${rec.form} ${rec.accn}`, type: /^10-Q/.test(rec.form || '') ? '10-Q quarterly report' : '10-K annual report', url: rec.url, period: rec.periodText, notes: rec.method && rec.method !== 'Reported' ? rec.method : '' }, extra || {});
  }
  function mapSEC(json, subs) {
    if (!json || !json.facts || !json.facts['us-gaap']) throw new Error('This is not an SEC company facts file. Download it from data.sec.gov/api/xbrl/companyfacts/.');
    const cik = String(json.cik || '').padStart(10, '0');
    const imp = blankImport('sec', 'SEC EDGAR company facts', null);
    imp.company = { name: json.entityName || null, cik, ticker: null, industry: null, currency: 'USD' };
    const L = Sec.latest(json, subs);
    imp.filings = { newest: L.newest, q: L.q, k: L.k, amendments: L.amendments };
    const F = Sec.financials(json, { L });
    if (!F.years.length) throw new Error('No annual revenue was found in this file.');
    imp.fin = F;
    // historicals: the model stores oldest first
    const ys = F.years.slice().reverse();
    while (ys.length < 5) ys.unshift({ values: {}, recs: {}, fy: null });
    const H = { years: ys.map(y => y.fy) };
    const v = (y, k) => y.values[k] == null ? null : y.values[k];
    H.rev = ys.map(y => v(y, 'rev'));
    H.gp = ys.map(y => v(y, 'gp'));
    H.opex = ys.map(y => v(y, 'gp') != null && v(y, 'ebitda') != null ? v(y, 'gp') - v(y, 'ebitda') : null);
    H.da = ys.map(y => v(y, 'da'));
    H.interest = ys.map(y => v(y, 'interest'));
    H.sbc = ys.map(y => v(y, 'sbc'));
    H.dnwc = ys.map(y => v(y, 'dnwc'));
    H.capex = ys.map(y => v(y, 'capex') == null ? null : -v(y, 'capex'));
    // working capital: the separate change lines of the cash flow statement, each with its source, sign and class.
    // A year is filled in only when every material line is clearly operating; otherwise it is left for review.
    const NW = typeof DCFNwc !== 'undefined' ? DCFNwc : require('./nwc.js');
    const nd = NW.fromSec(json, { L, ends: F.years.map(y => y.end), at: imp.retrieved });
    imp.nwcData = nd;
    const nwcNote = [];
    ys.forEach((y, i) => {
      if (!y.fy) return;
      const p = nd.periods['FY' + y.fy];
      if (isNum(H.dnwc[i])) { nwcNote.push(`FY${y.fy}: the company's reported total (IncreaseDecreaseInOperatingCapital)${p && p.lines.length > 1 ? `; ${p.lines.length - 1} component lines are in the worksheet` : ''}. Check it uses an operating definition.`); return; }
      const r = NW.importable(p);
      if (isNum(r.v)) { H.dnwc[i] = r.v; nwcNote.push(`FY${y.fy}: ${NW.fmt(r.v)} = ${r.reason}`); }
      else if (p && p.lines.length) nwcNote.push(`FY${y.fy}: ${r.reason}`);
    });
    if (nd.finArm) nwcNote.push('The company reports finance receivables (a finance arm). They are classed as not operating working capital.');
    if (nwcNote.length) imp.notes.push('Change in NWC from the cash flow statement lines: ' + nwcNote.join(' '));
    if (!(F.ttm.items.dnwc && isNum(F.ttm.items.dnwc.value)) && nd.periods.TTM && F.ttm.end && nd.periods.TTM.end === F.ttm.end) {
      const r = NW.importable(nd.periods.TTM);
      if (isNum(r.v)) F.ttm.items.dnwc = { metric: 'Change in NWC (cash flow sign)', cat: 'calc', periodType: 'TTM', value: r.v, end: F.ttm.end, periodText: 'twelve months ended ' + F.ttm.end, provider: 'Calculated from SEC EDGAR XBRL', method: `${nd.periods.TTM.method} ${r.reason}`, nwc: true };
    }
    imp.hist = H; imp.histSrc = {};
    const newestY = F.years[0];
    const concept = k => F.conceptUsed[k] ? `XBRL tag us-gaap:${F.conceptUsed[k]}. ` : '';
    const notes = { rev: concept('rev'), gp: newestY.recs.gp && newestY.recs.gp.cat === 'calc' ? 'Calculated: revenue − cost of revenue.' : concept('gp'), opex: 'Calculated: gross profit − (operating income + D&A).', da: concept('da'), interest: concept('interest'), sbc: concept('sbc'), dnwc: F.conceptUsed.dnwc ? concept('dnwc') + (Sec.CONCEPT_NOTES.IncreaseDecreaseInOperatingCapital || '') + ' Review it in the Change in NWC worksheet.' : 'Calculated from the separate working-capital lines of the cash flow statement, only for years whose material lines are all clearly operating. Other years are left blank for review in the Change in NWC worksheet.', capex: concept('capex') + (Sec.CONCEPT_NOTES[F.conceptUsed.capex] || '') + ' Shown as a negative cash outflow.' };
    Object.keys(notes).forEach(k => { if (H[k].some(isNum)) imp.histSrc[k] = { source: `SEC EDGAR XBRL (10-K annual periods)`, type: '10-K annual report', cls: 'filing', url: newestY.recs.rev ? newestY.recs.rev.url : filingUrl(cik), period: periodText(H.years, H[k]), notes: notes[k], rec: newestY.recs[k] || null }; });
    if (imp.histSrc.dnwc) imp.histSrc.dnwc.review = true;
    imp.ttm = F.ttm; imp.quarter = F.quarter; imp.ttmPrior = F.ttmPrior;
    const rows = F.years.map(y => ({ year: y.fy, tax: y.values.tax == null ? null : y.values.tax * 1e6, ebt: y.values.ebt == null ? null : y.values.ebt * 1e6 }));
    const eff = effectiveTax(rows); if (eff) putRef(imp, 'effTax', eff.v, { source: 'Calculated from SEC 10-K figures', type: 'Calculated', period: eff.period, label: 'Effective tax rate (3-year average)', calculated: true });
    // balance sheet: the newest instant for each item
    const inst = k => { const x = Sec.pick(json, BS[k].c, 'USD', 'instant'); return x ? Sec.record(json, x, { L, metric: BS[k].label, unit: '$ millions' }) : null; };
    const putR = (key, r, extra) => { if (r) put(imp, key, r.value, secMeta(r, extra)); };
    putR('cash', inst('cash')); putR('sti', inst('sti'));
    const lt = inst('debtLT'), nc = inst('debtNC'), dc = inst('debtCur'), st = inst('stDebt');
    const same = (a, b) => a && b && a.end === b.end;
    let debt = null;
    if (lt) debt = Object.assign({}, lt, { value: lt.value + (same(st, lt) ? st.value : 0), method: `Long-term debt including current portion (${lt.concept})${same(st, lt) ? ' + short-term borrowings' : ''}.` });
    else if (nc) debt = Object.assign({}, nc, { value: nc.value + (same(dc, nc) ? dc.value : 0) + (same(st, nc) ? st.value : 0), method: 'Non-current + current long-term debt' + (same(st, nc) ? ' + short-term borrowings' : '') + '.' });
    // a total and its current + non-current parts: use whichever is newer (some companies tag only the parts in 10-Qs)
    const newer = (tot, a, b, method) => { const sum = a && b && same(a, b) ? Object.assign({}, a, { value: a.value + b.value, method, cat: 'calc' }) : null; return tot && (!sum || tot.end >= sum.end) ? tot : sum; };
    // finance leases are financial debt under any lease treatment
    const fl = newer(inst('finL'), inst('finLC'), inst('finLNC'), 'Current + non-current finance lease liabilities');
    if (debt && fl && same(fl, debt)) debt = Object.assign({}, debt, { value: debt.value + fl.value, cat: 'calc', method: debt.method + ` + finance lease liabilities ${Math.round(fl.value).toLocaleString('en-US')} (${fl.concept || 'current + non-current'}).` });
    else if (debt && fl) imp.notes.push(`Finance lease liabilities (${Math.round(fl.value).toLocaleString('en-US')} $mm, ${fl.end}) are dated differently from debt (${debt.end}), so they were not added. Add them in the debt worksheet if they are still outstanding.`);
    else if (debt) imp.notes.push('No finance lease liabilities were found in the SEC data. If the leases note shows any, add them to Total debt.');
    if (debt) putR('debt', Object.assign(debt, { cat: debt.method ? 'calc' : 'sec' }), { notes: debt.method + ' Operating leases are a separate line. Check the debt note for other borrowings.', review: true });
    const ol = newer(inst('leases'), inst('leasesC'), inst('leasesNC'), 'Current + non-current operating lease liabilities');
    if (ol) putR('leases', ol);
    // digital assets held at fair value: a non-operating asset whose remeasurement runs through operating income
    const cr = inst('crypto');
    if (cr) { putRef(imp, 'crypto', cr.value, { label: 'Crypto assets at fair value', source: `SEC EDGAR XBRL: ${cr.form} ${cr.accn}`, period: 'as of ' + cr.end, notes: 'A non-operating asset. Consider adding it in the equity bridge (equity investments worksheet) at fair value on the valuation date.', rec: cr });
      imp.notes.push(`This company holds crypto assets (${Math.round(cr.value).toLocaleString('en-US')} $mm at fair value on ${cr.end}). Their unrealized gains and losses are reported inside operating income, so historical EBIT and EBITDA margins are not operating margins. Exclude the remeasurement from your margin estimates and value the holdings in the equity bridge.`); }
    // D&A not in company facts (some companies use their own XBRL tag for the cash-flow line)
    if (F.years[0] && F.years[0].values.da == null) imp.notes.push(`D&A for ${F.years[0].label} is not in the SEC company facts under a standard tag (the company may use its own tag for "depreciation and amortization" on the cash flow statement). EBITDA is left blank rather than estimated: enter D&A from the cash flow statement.`);
    putR('minority', inst('minority'));
    // shares: separate types
    const SH = Sec.shares(json, { L });
    imp.shareData = SH;
    if (SH.actual && !SH.actual.multiClass) putR('basic', SH.actual, { asOf: SH.actual.end, notes: 'Actual shares outstanding from the filing cover page (raw ' + SH.actual.raw.toLocaleString('en-US') + ' shares).' });
    else if (SH.actual && SH.actual.multiClass) { imp.notes.push('The cover page lists more than one share class. Their sum is offered as a reference only: check each class and enter the total yourself.'); putRef(imp, 'basicMulti', SH.actual.value, { label: 'Sum of share classes on the cover page', source: 'SEC cover page', period: SH.actual.periodText }); }
    else imp.notes.push('The SEC file has no cover-page share count for this company (common for companies with several share classes). Enter actual shares outstanding from the cover page of the latest 10-Q or 10-K. Weighted-average shares are not used as a substitute.');
    Object.entries(SH).forEach(([k, r]) => { if (k !== 'actual') putRef(imp, 'sh.' + k, r.value, { label: r.metric, source: `SEC EDGAR XBRL: ${r.form} ${r.accn}`, period: r.periodText, notes: r.definition + (r.method && r.method !== 'Reported' ? ' ' + r.method : ''), rec: r }); });
    if (SH.waDilQ) putRef(imp, 'dilutedWA', SH.waDilQ.value, { label: 'Diluted weighted-average shares (latest quarter)', source: `SEC EDGAR XBRL: ${SH.waDilQ.form} ${SH.waDilQ.accn}`, period: SH.waDilQ.periodText, notes: SHARE_REF_NOTE });
    // base-year candidates
    imp.base = { fy: F.years[0] && F.years[0].values.rev != null ? { value: F.years[0].values.rev, end: F.years[0].end, label: F.years[0].label } : null, ttm: F.ttm.items.rev && F.ttm.items.rev.value != null ? { value: F.ttm.items.rev.value, end: F.ttm.items.rev.end, isFY: F.ttm.isFY } : null };
    imp.flags = validateImport(imp);
    imp.notes.push('SEC files hold reported figures only. Enter the share price and 52-week range from a quote.');
    finishNotes(imp);
    return imp;
  }
  const SHARE_REF_NOTE = 'A quarterly weighted average used for diluted EPS. Reference only: not a current diluted share count.';

  // ---------- checks before anything is written ----------
  function validateImport(imp, model) {
    const flags = [];
    const V = imp.values;
    const add = (key, level, text) => flags.push({ key, level, text });
    if (V.basic && Sec) Sec.checkActualShares(V.basic.v, imp.shareData || {}, 'The imported share count').forEach(f => add('basic', f.level, f.text));
    if (V.price && !(V.price.v > 0 && V.price.v < 1e6)) add('price', 'bad', `The share price ${V.price.v} is not plausible.`);
    ['cash', 'sti', 'debt', 'leases', 'minority'].forEach(k => { if (V[k] && V[k].v < 0) add(k, 'bad', `${k} is negative (${V[k].v}). Balance-sheet amounts should be positive.`); });
    ['cash', 'sti', 'debt', 'leases', 'minority', 'dtl'].forEach(k => { const r = V[k] && V[k].rec; if (r && r.stale) add(k, 'warn', `${r.metric}: ${r.staleNote} This figure is as of ${r.end}.`); });
    const sd = imp.shareData || {};
    if (sd.optionsK && V.price && sd.optionsK.value > V.price.v * 20) add('sh.optionsK', 'warn', `The weighted-average option exercise price in the XBRL data ($${sd.optionsK.value.toLocaleString('en-US')}) is more than 20 times the share price. It may be tagged with the wrong scale: check the stock-based compensation note in the filing.`);
    if (sd.options && sd.options.stale) add('sh.options', 'warn', `Options outstanding come from an older filing (${sd.options.periodText}). Awards exercised or granted since then are not reflected.`);
    if (model && model.inputs.company.ticker && imp.symbol && !String(model.inputs.company.ticker).toUpperCase().startsWith(String(imp.symbol).toUpperCase())) add('company.ticker', 'bad', `This model is for ${model.inputs.company.ticker}, but the import is for ${imp.symbol}.`);
    if (model && model.meta && model.meta.cik && imp.company.cik && String(+model.meta.cik) !== String(+imp.company.cik)) add('company.name', 'bad', `This model belongs to CIK ${+model.meta.cik}, but the file is for CIK ${+imp.company.cik} (${imp.company.name}).`);
    return flags;
  }

  // ---------- SEC filing list (data.sec.gov/submissions is readable from a browser) ----------
  async function fetchFilings(cik, fetchFn = fetch) {
    const c = String(cik || '').replace(/^0+/, '').padStart(10, '0');
    const res = await fetchFn(`https://data.sec.gov/submissions/CIK${c}.json`);
    if (!res.ok) throw new Error(`SEC filing list: HTTP ${res.status}`);
    const j = await res.json();
    const L = Sec.latest({ cik: c, facts: {} }, j);
    return { cik: c, name: j.name, tickers: j.tickers || [], newest: L.newest, q: L.q, k: L.k, amendments: L.amendments.slice(0, 5), checked: new Date().toISOString() };
  }
  // Is the provider's data older than the newest filing?
  function compareToFilings(imp, filings) {
    const out = [];
    if (!filings || !filings.newest) return out;
    const n = filings.newest;
    const lastFY = imp.hist && imp.hist.years.filter(isNum).slice(-1)[0];
    if (/^10-Q/.test(n.form) && n.periodEnd && lastFY && n.periodEnd.slice(0, 4) >= String(lastFY)) out.push({ level: 'warn', text: `A newer filing exists: ${n.form} for the period ended ${n.periodEnd}, filed ${n.filed} (accession ${n.accn}). The provider's annual statements stop at FY${lastFY}. Load the SEC company facts file to get the TTM figures and the latest balance sheet.` });
    return out;
  }

  // ---------- helpers ----------
  function effectiveTax(rows) {
    const r = rows.filter(x => isNum(x.tax) && isNum(x.ebt) && x.ebt > 0).sort((a, b) => b.year - a.year).slice(0, 3);
    if (!r.length) return null;
    const v = r.reduce((a, x) => a + x.tax, 0) / r.reduce((a, x) => a + x.ebt, 0);
    return isNum(v) ? { v, period: r.length > 1 ? `FY${r[r.length - 1].year}–FY${r[0].year}` : `FY${r[0].year}` } : null;
  }
  function titleCase(s) { return String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()); }
  function finishNotes(imp) {
    // market inputs: the 10-year Treasury applies to every scenario; the provider beta starts the Base case only
    if (imp.ref.rf) imp.tri.rf = { scen: ['Base', 'Bear', 'Bull'], v: imp.ref.rf.v, meta: imp.ref.rf };
    if (imp.ref.beta) imp.tri.beta = { scen: ['Base'], v: Math.round(imp.ref.beta.v * 100) / 100, meta: Object.assign({}, imp.ref.beta, { review: true, notes: 'Provider regression beta, used as the Base case starting point. Set the Bear and Bull betas yourself, and compare with an industry beta.' }) };
    if (!imp.hist) imp.notes.push('No annual statements were returned, so historicals must be entered by hand.');
    if (imp.company.currency && imp.company.currency !== 'USD') imp.notes.push(`Figures are in ${imp.company.currency}. The model's labels say $; keep every input in the same currency.`);
  }

  // ---------- apply to a model ----------
  // Empty fields are filled. A field that already holds a value is never overwritten here: the new value
  // goes to model.pending with both values and their dates, for the analyst to approve (applyPending).
  // A value the analyst typed is marked as an override and needs explicit confirmation.
  const SINGLE_KEYS = ['price', 'hi52', 'lo52', 'basic', 'cash', 'sti', 'debt', 'leases', 'minority', 'dtl'];
  const LABELS = { price: 'Share price', hi52: '52-week high', lo52: '52-week low', basic: 'Actual common shares outstanding', cash: 'Cash & equivalents', sti: 'Short-term investments', debt: 'Total debt', leases: 'Operating lease liabilities', minority: 'Minority interest', dtl: 'Deferred tax liability', hist: 'Historical financials (five fiscal years)', 'company.name': 'Company name', 'company.ticker': 'Ticker', 'company.industry': 'Industry', 'company.currency': 'Currency', rf: 'Risk-free rate', beta: 'Beta' };
  function srcRecord(imp, meta) {
    const r = meta.rec || {};
    const cat = meta.cls === 'market' ? 'market' : r.cat === 'calc' || meta.calculated ? 'calc' : imp.providerId === 'sec' ? 'sec' : 'provider';
    return { name: meta.source, type: meta.type, cls: meta.cls || (cat === 'market' ? 'market' : cat === 'sec' ? 'filing' : null), cat, verified: cat === 'sec' || (cat === 'calc' && imp.providerId === 'sec'),
      asOf: meta.asOf || r.end || null, period: meta.period || '', url: meta.url || '', notes: meta.notes || '', retrieved: imp.retrieved, provider: imp.provider, auto: true, review: !!meta.review,
      company: imp.company.name || null, ticker: imp.symbol || imp.company.ticker || null, metric: r.metric || null, raw: r.raw == null ? null : r.raw, rawUnit: r.rawUnit || null, unit: r.unit || null, scale: r.scale || null,
      form: r.form || null, accn: r.accn || null, fp: r.fp || null, fy: r.fy || null, start: r.start || null, end: r.end || null, filed: r.filed || null, concept: r.concept || null, method: r.method || null, stale: !!r.stale };
  }
  // an older CIK is kept only when the new import is for the same company (same ticker or name)
  function sameCo(model, imp) {
    const t = x => String(x || '').split(/[\s/:]/)[0].toUpperCase();
    const a = t(model.meta && model.meta.symbol) || t(model.inputs.company.ticker), b = t(imp.symbol) || t(imp.company.ticker);
    if (a && b) return a === b;
    const n = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(inc|corp|corporation|co|ltd|plc)$/, '');
    return !!(n(model.inputs.company.name) && n(model.inputs.company.name) === n(imp.company.name));
  }
  function applyImport(model, imp, opts = {}) {
    const at = imp.retrieved, fresh = !!opts.fresh;
    model.imported = model.imported || {};
    const changed = [], kept = [], pending = [];
    const log = (key, from, to, s) => { if (JSON.stringify(from) !== JSON.stringify(to)) { model.log.unshift({ at, field: key, s: s || null, from: from == null ? null : from, to, by: imp.provider }); changed.push(key + (s ? '.' + s : '')); } };
    const empty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.some(x => x !== null && x !== undefined));
    const flagFor = key => (imp.flags || []).filter(f => f.key === key && f.level === 'bad');
    // decide: write now, or propose
    const offer = (key, curVal, newVal, meta, write, s) => {
      if (flagFor(key).length) { kept.push(key); pending.push({ key, s: s || null, label: LABELS[key] || key, from: curVal, to: newVal, toDate: meta && (meta.asOf || meta.period), kind: 'blocked', reason: flagFor(key).map(f => f.text).join(' '), meta }); return; }
      if (empty(curVal) || fresh) { write(); return; }
      if (JSON.stringify(curVal) === JSON.stringify(newVal)) { write(true); return; }
      const ik = s ? key + '.' + s : key;
      const pv = model.imported[ik] && JSON.stringify(model.imported[ik].v) === JSON.stringify(curVal) ? 'imported' : 'user';
      const old = model.sources[key] || {};
      pending.push({ key, s: s || null, label: (LABELS[key] || key) + (s ? ` (${s})` : ''), from: curVal, to: newVal, fromDate: old.asOf || old.period || null, toDate: meta && (meta.asOf || meta.period) || null, kind: pv === 'imported' ? 'update' : 'override', meta });
      kept.push(ik);
    };
    const C = model.inputs.company;
    ['name', 'ticker', 'industry', 'currency'].forEach(k => {
      const v = imp.company[k]; if (!v) return;
      const key = 'company.' + k;
      const meta = { source: imp.provider + (imp.providerId === 'sec' ? '' : ' company profile'), type: imp.providerId === 'sec' ? '10-K annual report' : 'Market data provider', url: edgarFilings(imp.company.cik), period: 'as of ' + at.slice(0, 10) };
      if (k === 'currency' && C[k] === 'USD' && !model.imported[key] && v !== 'USD') { offer(key, C[k], v, meta, () => {}); return; }
      offer(key, C[k], v, meta, (same) => { if (!same) log(key, C[k], v); C[k] = v; model.imported[key] = { v, at }; model.sources[key] = srcRecord(imp, meta); });
    });
    if (!C.valDate) {
      const p = imp.values.price; const d = p && /(\d{4}-\d{2}-\d{2})/.exec(p.period || '');
      const vd = d ? d[1] : at.slice(0, 10);
      log('company.valDate', null, vd); C.valDate = vd; model.imported['company.valDate'] = { v: vd, at };
      model.sources['company.valDate'] = { name: d ? 'Set to the date of the imported share price' : 'Set to the import date', type: 'Own judgment', cat: 'analyst', period: vd, notes: 'Change it if you value the company as of another date.', retrieved: at };
    }
    model.meta = Object.assign({}, model.meta || {}, { cik: imp.company.cik || (model.meta && model.meta.cik && sameCo(model, imp) ? model.meta.cik : null), exchange: imp.company.exchange || null, sector: imp.company.sector || null, country: imp.company.country || null, website: imp.company.website || null, description: imp.company.description || null, provider: imp.provider, providerId: imp.providerId, retrieved: at, symbol: imp.symbol || (model.meta && model.meta.symbol) || null });
    SINGLE_KEYS.forEach(key => {
      const x = imp.values[key]; if (!x) return;
      offer(key, model.inputs[key], x.v, x, (same) => {
        if (!same) log(key, model.inputs[key], x.v);
        model.inputs[key] = x.v; model.imported[key] = { v: x.v, at };
        model.sources[key] = srcRecord(imp, x);
        const ak = { price: 'price', hi52: 'range', lo52: 'range', basic: 'basic' }[key];
        if (ak) { model.asOf = model.asOf || {}; model.asOf[ak] = x.asOf || null; }
        if (!same && model.reviewed) delete model.reviewed[key];
      });
    });
    Object.entries(imp.tri || {}).forEach(([key, x]) => {
      if (!model.inputs[key]) return;
      x.scen.forEach(sc => offer(key, model.inputs[key][sc], x.v, x.meta, (same) => {
        if (!same) log(key, model.inputs[key][sc], x.v, sc);
        model.inputs[key][sc] = x.v; model.imported[key + '.' + sc] = { v: x.v, at }; model.sources[key] = srcRecord(imp, x.meta);
      }, sc));
    });
    if (imp.hist) {
      const H = model.hist;
      const anyTyped = Object.keys(imp.histSrc).some(k => !empty(H[k]));
      const write = () => {
        if (JSON.stringify(H.years) !== JSON.stringify(imp.hist.years)) { log('hist.years', H.years.join(', '), imp.hist.years.join(', ')); H.years = imp.hist.years.slice(); }
        Object.keys(imp.histSrc).forEach(k => { log('hist.' + k, null, imp.hist[k].map(v => isNum(v) ? Math.round(v) : '—').join(', ')); H[k] = imp.hist[k].slice(); model.imported['hist.' + k] = { v: H[k].slice(), at }; model.sources['hist.' + k] = srcRecord(imp, imp.histSrc[k]); if (model.reviewed) delete model.reviewed['hist.' + k]; });
      };
      if (!anyTyped || fresh) write();
      else {
        const same = Object.keys(imp.histSrc).every(k => JSON.stringify(H[k]) === JSON.stringify(imp.hist[k])) && JSON.stringify(H.years) === JSON.stringify(imp.hist.years);
        if (same) write();
        else { const user = Object.keys(imp.histSrc).some(k => !empty(H[k]) && !(model.imported['hist.' + k] && JSON.stringify(model.imported['hist.' + k].v) === JSON.stringify(H[k])));
          pending.push({ key: 'hist', label: LABELS.hist, from: 'FY' + H.years.filter(isNum).join(', FY'), to: 'FY' + imp.hist.years.filter(isNum).join(', FY'), fromDate: null, toDate: imp.histSrc.rev && imp.histSrc.rev.period, kind: user ? 'override' : 'update', meta: { hist: imp.hist, histSrc: imp.histSrc } }); kept.push('hist'); }
      }
    }
    // calculated and reference data are refreshed: they never replace an input
    if (imp.ttm) model.ttm = { end: imp.ttm.end, isFY: imp.ttm.isFY, items: imp.ttm.items, quarter: imp.quarter || null, prior: imp.ttmPrior || null, at, provider: imp.provider };
    if (imp.nwcData) model.nwcData = imp.nwcData;
    if (imp.fin) model.fin = { years: imp.fin.years.map(y => ({ label: y.label, end: y.end, fy: y.fy, form: y.form, accn: y.accn, filed: y.filed, values: y.values, recs: y.recs })), at };
    if (imp.shareData) model.shareData = Object.assign({ at }, imp.shareData);
    if (imp.filings) model.filings = Object.assign({ checked: at }, imp.filings);
    if (imp.base) model.baseCandidates = imp.base;
    model.ref = Object.assign({}, model.ref || {}, Object.fromEntries(Object.entries(imp.ref).map(([k, x]) => [k, Object.assign({ retrieved: at, provider: imp.provider }, x)])));
    model.importNotes = imp.notes.slice();
    model.importFlags = (imp.flags || []).slice();
    model.pending = pending.length ? { at, provider: imp.provider, items: pending.map(p => Object.assign({ id: p.key + (p.s ? '.' + p.s : '') }, p)) } : null;
    if (model.inputs.company.name && (model.name === 'New company' || !model.name)) model.name = model.inputs.company.name;
    return { changed, kept, pending, notes: imp.notes, flags: imp.flags || [] };
  }
  // Apply the pending items the analyst approved (ids). Overrides need confirmOverrides.
  function applyPending(model, ids, confirmOverrides) {
    const P = model.pending; if (!P) return [];
    const done = [];
    const imp = { retrieved: P.at, provider: P.provider, providerId: /SEC/.test(P.provider) ? 'sec' : 'x', company: { name: model.inputs.company.name }, symbol: model.meta && model.meta.symbol };
    P.items.filter(p => ids.includes(p.id) && p.kind !== 'blocked' && (p.kind !== 'override' || confirmOverrides)).forEach(p => {
      const at = new Date().toISOString();
      if (p.key === 'hist') {
        const H = model.hist, h = p.meta.hist;
        H.years = h.years.slice();
        Object.keys(p.meta.histSrc).forEach(k => { model.log.unshift({ at, field: 'hist.' + k, s: null, from: (H[k] || []).map(v => isNum(v) ? Math.round(v) : '—').join(', '), to: h[k].map(v => isNum(v) ? Math.round(v) : '—').join(', '), by: P.provider + ' (approved)' }); H[k] = h[k].slice(); model.imported['hist.' + k] = { v: H[k].slice(), at: P.at }; model.sources['hist.' + k] = srcRecord(imp, p.meta.histSrc[k]); });
      } else if (p.key.startsWith('company.')) {
        const c = p.key.split('.')[1]; model.log.unshift({ at, field: p.key, s: null, from: model.inputs.company[c], to: p.to, by: P.provider + ' (approved)' }); model.inputs.company[c] = p.to; model.imported[p.key] = { v: p.to, at: P.at };
      } else if (p.s) {
        model.log.unshift({ at, field: p.key, s: p.s, from: model.inputs[p.key][p.s], to: p.to, by: P.provider + ' (approved)' }); model.inputs[p.key][p.s] = p.to; model.imported[p.key + '.' + p.s] = { v: p.to, at: P.at }; model.sources[p.key] = srcRecord(imp, p.meta);
      } else {
        model.log.unshift({ at, field: p.key, s: null, from: model.inputs[p.key], to: p.to, by: P.provider + ' (approved)' }); model.inputs[p.key] = p.to; model.imported[p.key] = { v: p.to, at: P.at }; model.sources[p.key] = srcRecord(imp, p.meta);
        const ak = { price: 'price', hi52: 'range', lo52: 'range', basic: 'basic' }[p.key]; if (ak) { model.asOf = model.asOf || {}; model.asOf[ak] = p.meta.asOf || null; }
      }
      done.push(p.id);
    });
    P.items = P.items.filter(p => !done.includes(p.id));
    if (!P.items.length) model.pending = null;
    return done;
  }
  function dismissPending(model, ids) { if (!model.pending) return; model.pending.items = model.pending.items.filter(p => !ids.includes(p.id)); if (!model.pending.items.length) model.pending = null; }

  // A field's provenance: 'imported', 'overridden' (imported then changed by the analyst), 'manual', or null when empty
  function provenance(model, key, value) {
    const imp = model.imported && model.imported[key];
    const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && !value.some(v => v !== null));
    if (empty) return null;
    if (!imp) return 'manual';
    return JSON.stringify(imp.v) === JSON.stringify(value) ? 'imported' : 'overridden';
  }

  return { PROVIDERS, mapFMP, fetchFMP, searchFMP, mapAV, fetchAV, searchAV, mapSEC, applyImport, applyPending, dismissPending, validateImport, fetchFilings, compareToFilings, provenance, edgarFilings, SINGLE_KEYS, srcRecord };
})();
if (typeof module !== 'undefined') module.exports = DCFData;
