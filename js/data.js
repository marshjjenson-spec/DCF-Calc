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
  const SEC_TAGS = {
    rev: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
    cogs: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'],
    gp: ['GrossProfit'],
    opInc: ['OperatingIncomeLoss'],
    da: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization', 'DepreciationDepletionAndAmortizationPropertyPlantAndEquipment'],
    interest: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'],
    sbc: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
    capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
    tax: ['IncomeTaxExpenseBenefit'],
    ebt: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
    cash: ['CashAndCashEquivalentsAtCarryingValue'],
    sti: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    debtLT: ['LongTermDebtNoncurrent', 'LongTermDebt'],
    debtCur: ['LongTermDebtCurrent'],
    stDebt: ['ShortTermBorrowings', 'CommercialPaper'],
    leases: ['OperatingLeaseLiability'],
    leasesNC: ['OperatingLeaseLiabilityNoncurrent'],
    leasesC: ['OperatingLeaseLiabilityCurrent'],
    minority: ['MinorityInterest'],
  };
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
  function secSeries(facts, tags, unit = 'USD') {
    // first tag that has annual (10-K, about one year) data
    for (const t of tags) {
      const f = facts['us-gaap'] && facts['us-gaap'][t];
      const list = f && f.units && f.units[unit];
      if (!list) continue;
      const ann = list.filter(x => /^10-K/.test(x.form || '') && x.start && x.end && days(x.start, x.end) > 340 && days(x.start, x.end) < 390);
      if (!ann.length) continue;
      const byEnd = {};
      ann.forEach(x => { if (!byEnd[x.end] || String(x.filed) > String(byEnd[x.end].filed)) byEnd[x.end] = x; });
      return { tag: t, byEnd };
    }
    return null;
  }
  function secInstant(facts, tags, unit = 'USD', ns = 'us-gaap') {
    for (const t of tags) {
      const f = facts[ns] && facts[ns][t];
      const list = f && f.units && f.units[unit];
      if (!list || !list.length) continue;
      const best = list.filter(x => !x.start && /^10-[KQ]/.test(x.form || '')).sort((a, b) => String(b.end).localeCompare(String(a.end)) || String(b.filed).localeCompare(String(a.filed)))[0];
      if (best) return Object.assign({ tag: t }, best);
    }
    return null;
  }
  const filingUrl = (cik, accn) => accn ? `https://www.sec.gov/Archives/edgar/data/${String(cik).replace(/^0+/, '')}/${String(accn).replace(/-/g, '')}/` : edgarFilings(cik);
  function mapSEC(json) {
    if (!json || !json.facts || !json.facts['us-gaap']) throw new Error('This is not an SEC company facts file. Download it from data.sec.gov/api/xbrl/companyfacts/.');
    const facts = json.facts, cik = String(json.cik || '').padStart(10, '0');
    const imp = blankImport('sec', 'SEC EDGAR company facts', null);
    imp.company = { name: json.entityName || null, cik, ticker: null, industry: null, currency: 'USD' };
    const ser = {}; ['rev', 'cogs', 'gp', 'opInc', 'da', 'interest', 'sbc', 'capex', 'tax', 'ebt'].forEach(k => ser[k] = secSeries(facts, SEC_TAGS[k]));
    if (!ser.rev) throw new Error('No annual revenue was found in this file.');
    const ends = Object.keys(ser.rev.byEnd).sort().slice(-5);
    const val = (k, end) => ser[k] && ser[k].byEnd[end] ? ser[k].byEnd[end].val : null;
    const rows = ends.map(end => {
      const rev = val('rev', end), gp = isNum(val('gp', end)) ? val('gp', end) : (isNum(rev) && isNum(val('cogs', end)) ? rev - val('cogs', end) : null);
      const da = val('da', end), capex = val('capex', end);
      const fy = ser.rev.byEnd[end].fy;
      return { year: +String(end).slice(0, 4), end, fy, rev: mm(rev), gp: mm(gp), opex: mm(opexExDA(gp, val('opInc', end), da)), da: mm(da), interest: mm(val('interest', end)), sbc: mm(val('sbc', end)), dnwc: null, capex: isNum(capex) ? mm(-Math.abs(capex)) : null, tax: val('tax', end), ebt: val('ebt', end) };
    });
    const last = ser.rev.byEnd[ends[ends.length - 1]];
    const h = histFrom(rows, { source: 'SEC EDGAR XBRL company facts (10-K)', type: '10-K annual report', url: filingUrl(cik, last.accn), derived: {
      gp: ser.gp ? `XBRL tag ${ser.gp.tag}.` : 'Calculated: revenue − cost of revenue.', opex: 'Calculated: gross profit − (operating income + D&A).', capex: `XBRL tag ${ser.capex ? ser.capex.tag : '—'}, shown as a negative cash outflow.`, rev: `XBRL tag ${ser.rev.tag}.`, da: ser.da ? `XBRL tag ${ser.da.tag}.` : '', interest: ser.interest ? `XBRL tag ${ser.interest.tag}.` : '', sbc: ser.sbc ? `XBRL tag ${ser.sbc.tag}.` : '' } });
    imp.hist = h.hist; imp.histSrc = h.src;
    const eff = effectiveTax(rows); if (eff) putRef(imp, 'effTax', eff.v, { source: 'Calculated from imported statements', type: 'Calculated', period: eff.period, label: 'Effective tax rate (3-year average)', calculated: true });
    const inst = (k, label) => { const x = secInstant(facts, SEC_TAGS[k]); return x ? { v: x.val, meta: { cls: 'filing', source: `SEC EDGAR XBRL (${x.form}, ${x.tag})`, type: /^10-Q/.test(x.form) ? '10-Q quarterly report' : '10-K annual report', url: filingUrl(cik, x.accn), period: 'as of ' + x.end, end: x.end } } : null; };
    const putI = (key, x, extra) => { if (x) put(imp, key, mm(x.v), Object.assign(x.meta, extra || {})); };
    putI('cash', inst('cash')); putI('sti', inst('sti'));
    const lt = inst('debtLT'), cur = inst('debtCur'), st = inst('stDebt');
    if (lt) { const sameEnd = x => x && x.meta.end === lt.meta.end ? x.v : null; const parts = [lt.v, lt.meta.source.includes('LongTermDebtNoncurrent') ? sameEnd(cur) : null, sameEnd(st)]; put(imp, 'debt', mm(sumIf(...parts)), Object.assign(lt.meta, { notes: 'Sum of long-term debt, its current portion and short-term borrowings where tagged. Check the 10-K debt note.', review: true })); }
    const ol = inst('leases');
    if (ol) putI('leases', ol);
    else { const nc = inst('leasesNC'), c = inst('leasesC'); if (nc) put(imp, 'leases', mm(sumIf(nc.v, c && c.meta.end === nc.meta.end ? c.v : null)), Object.assign(nc.meta, { notes: 'Current + non-current operating lease liabilities.' })); }
    putI('minority', inst('minority'));
    const inc = secSeries(facts, ['IncrementalCommonSharesAttributableToShareBasedPaymentArrangements', 'IncrementalCommonSharesAttributableToDilutiveEffectOfShareBasedPaymentArrangements'], 'shares');
    const dil = secSeries(facts, ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares'), bas = secSeries(facts, ['WeightedAverageNumberOfSharesOutstandingBasic'], 'shares');
    if (inc) { const e = Object.keys(inc.byEnd).sort().pop(), x = inc.byEnd[e]; putRef(imp, 'incrementalWA', mm(x.val), { source: `SEC EDGAR XBRL (10-K, ${inc.tag})`, type: '10-K annual report', url: filingUrl(cik, x.accn), period: 'FY ended ' + e + ' average', label: 'Incremental dilutive shares (weighted average)', notes: 'Average dilution for the fiscal year from share-based awards. Reference only: not a current count.' }); }
    if (dil) { const e = Object.keys(dil.byEnd).sort().pop(); putRef(imp, 'dilutedWA', mm(dil.byEnd[e].val), { source: 'SEC EDGAR XBRL (10-K, WeightedAverageNumberOfDilutedSharesOutstanding)', type: '10-K annual report', url: filingUrl(cik, dil.byEnd[e].accn), period: 'FY ended ' + e + ' average', label: 'Diluted weighted-average shares', notes: 'An average for the fiscal year. Reference only: not a current diluted count.' }); }
    const sh = secInstant(facts, ['EntityCommonStockSharesOutstanding'], 'shares', 'dei');
    if (sh) put(imp, 'basic', mm(sh.val), { cls: 'filing', asOf: sh.end, source: `SEC EDGAR cover page (${sh.form})`, type: /^10-Q/.test(sh.form) ? '10-Q quarterly report' : '10-K annual report', url: filingUrl(cik, sh.accn), period: 'as of ' + sh.end, notes: 'Shares outstanding from the filing cover page.' });
    imp.notes.push('SEC files hold reported figures only. Enter the share price and 52-week range from a quote, and check the change in working capital on the cash flow statement.');
    finishNotes(imp);
    return imp;
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
  // Writes reported and market figures only. A value the analyst has typed over is kept unless replace is true.
  // Returns a list of what changed.
  const SINGLE_KEYS = ['price', 'hi52', 'lo52', 'basic', 'cash', 'sti', 'debt', 'leases', 'minority', 'dtl'];
  function applyImport(model, imp, opts = {}) {
    const replace = !!opts.replace, at = imp.retrieved;
    model.imported = model.imported || {};
    const changed = [], kept = [];
    const srcRec = (meta) => ({ name: meta.source, type: meta.type, cls: meta.cls || (/Market data/.test(meta.type || '') ? 'market' : /10-[KQ]|filing/i.test(meta.type || '') ? 'filing' : null), asOf: meta.asOf || null, period: meta.period || '', url: meta.url || '', notes: meta.notes || '', retrieved: at, provider: imp.provider, auto: true, review: !!meta.review });
    const canWrite = (key, curVal) => {
      if (curVal === null || curVal === undefined || curVal === '') return true;
      if (replace) return true;
      const prev = model.imported[key];
      return !!prev && JSON.stringify(prev.v) === JSON.stringify(curVal); // still the earlier imported value
    };
    const log = (key, from, to) => { if (JSON.stringify(from) !== JSON.stringify(to)) { model.log.unshift({ at, field: key, s: null, from: from == null ? null : from, to, by: imp.provider }); changed.push(key); } };
    // company info
    const C = model.inputs.company;
    ['name', 'ticker', 'industry', 'currency'].forEach(k => {
      const v = imp.company[k]; if (!v) return;
      const key = 'company.' + k;
      if (!canWrite(key, C[k]) && !(k === 'currency' && C[k] === 'USD' && !model.imported[key])) { kept.push(key); return; }
      log(key, C[k], v); C[k] = v; model.imported[key] = { v, at };
      model.sources[key] = srcRec({ source: imp.provider + (imp.providerId === 'sec' ? '' : ' company profile'), type: imp.providerId === 'sec' ? '10-K annual report' : 'Market data provider', url: edgarFilings(imp.company.cik), period: 'as of ' + at.slice(0, 10) });
    });
    if (!C.valDate) {
      const p = imp.values.price; const d = p && /(\d{4}-\d{2}-\d{2})/.exec(p.period || '');
      const vd = d ? d[1] : at.slice(0, 10);
      log('company.valDate', null, vd); C.valDate = vd; model.imported['company.valDate'] = { v: vd, at };
      model.sources['company.valDate'] = srcRec({ source: d ? 'Set to the date of the imported share price' : 'Set to the import date', type: 'Own judgment', period: vd, notes: 'Change it if you value the company as of another date.' });
    }
    model.meta = Object.assign({}, model.meta || {}, { cik: imp.company.cik || null, exchange: imp.company.exchange || null, sector: imp.company.sector || null, country: imp.company.country || null, website: imp.company.website || null, description: imp.company.description || null, provider: imp.provider, providerId: imp.providerId, retrieved: at, symbol: imp.symbol || (model.meta && model.meta.symbol) || null });
    // single values
    SINGLE_KEYS.forEach(key => {
      const x = imp.values[key]; if (!x) return;
      if (!canWrite(key, model.inputs[key])) { kept.push(key); return; }
      log(key, model.inputs[key], x.v); model.inputs[key] = x.v; model.imported[key] = { v: x.v, at };
      model.sources[key] = srcRec(x);
      const ak = { price: 'price', hi52: 'range', lo52: 'range', basic: 'basic' }[key];
      if (ak) { model.asOf = model.asOf || {}; model.asOf[ak] = x.asOf || null; }
      if (model.reviewed) delete model.reviewed[key];
    });
    // market inputs that have scenario columns
    Object.entries(imp.tri || {}).forEach(([key, x]) => {
      if (!model.inputs[key]) return;
      let wrote = false;
      x.scen.forEach(sc => {
        const ik = key + '.' + sc;
        if (!canWrite(ik, model.inputs[key][sc])) { kept.push(ik); return; }
        if (JSON.stringify(model.inputs[key][sc]) !== JSON.stringify(x.v)) { model.log.unshift({ at, field: key, s: sc, from: model.inputs[key][sc], to: x.v, by: imp.provider }); changed.push(ik); }
        model.inputs[key][sc] = x.v; model.imported[ik] = { v: x.v, at }; wrote = true;
      });
      if (wrote) { model.sources[key] = srcRec(x.meta); if (model.reviewed) delete model.reviewed[key]; }
    });
    // historicals: replace the whole block when the import has statements and nothing typed over would be lost
    if (imp.hist) {
      const H = model.hist;
      const typed = Object.keys(imp.histSrc).some(k => H[k].some((v, i) => isNum(v) && !(model.imported['hist.' + k] && JSON.stringify(model.imported['hist.' + k].v) === JSON.stringify(H[k]))));
      if (!typed || replace) {
        if (JSON.stringify(H.years) !== JSON.stringify(imp.hist.years)) { log('hist.years', H.years.join(', '), imp.hist.years.join(', ')); H.years = imp.hist.years.slice(); }
        Object.keys(imp.histSrc).forEach(k => { log('hist.' + k, null, imp.hist[k].map(v => isNum(v) ? Math.round(v) : '—').join(', ')); H[k] = imp.hist[k].slice(); model.imported['hist.' + k] = { v: H[k].slice(), at }; model.sources['hist.' + k] = srcRec(imp.histSrc[k]); if (model.reviewed) delete model.reviewed['hist.' + k]; });
      } else kept.push('hist');
    }
    model.ref = Object.assign({}, model.ref || {}, Object.fromEntries(Object.entries(imp.ref).map(([k, x]) => [k, Object.assign({ retrieved: at, provider: imp.provider }, x)])));
    model.importNotes = imp.notes.slice();
    if (model.inputs.company.name && (model.name === 'New company' || !model.name)) model.name = model.inputs.company.name;
    return { changed, kept, notes: imp.notes };
  }
  // A field's provenance: 'imported', 'overridden' (imported then changed by the analyst), 'manual', or null when empty
  function provenance(model, key, value) {
    const imp = model.imported && model.imported[key];
    const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && !value.some(v => v !== null));
    if (empty) return null;
    if (!imp) return 'manual';
    return JSON.stringify(imp.v) === JSON.stringify(value) ? 'imported' : 'overridden';
  }

  return { PROVIDERS, mapFMP, fetchFMP, searchFMP, mapAV, fetchAV, searchAV, mapSEC, applyImport, provenance, edgarFilings, SINGLE_KEYS };
})();
if (typeof module !== 'undefined') module.exports = DCFData;
