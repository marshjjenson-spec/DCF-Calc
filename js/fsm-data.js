// ===== THREE-STATEMENT MODEL: HISTORICAL STATEMENT IMPORT (no UI) =====
// Builds five fiscal years plus a separate TTM column of income statement, balance sheet and cash flow lines from
// an SEC company facts file (primary source) or from Financial Modeling Prep (provider-standardised statements).
// Every figure keeps its source: company, ticker, concept, form, accession, fiscal period, filing date, period end,
// units, raw reported value and converted value, and the statement it belongs to. Missing stays missing (null):
// nothing is estimated from ratios. Lines that are not tagged separately are derived only from reported totals
// (for example "other current assets = total current assets − tagged lines"), and are labelled as calculated.
const FsmData = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const Sec = typeof DCFSec !== 'undefined' ? DCFSec : require('./sec.js');
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
  const today = () => new Date().toISOString().slice(0, 10);
  const nz = v => isNum(v) ? v : 0;

  // concept map. sign: -1 flips the tag's sign into the model's convention. alt: alternatives, each a list summed.
  const MAP = {
    // income statement (durations)
    rev: { st: 'IS', l: 'Revenue', alt: [['RevenueFromContractWithCustomerExcludingAssessedTax'], ['Revenues'], ['SalesRevenueNet'], ['RevenueFromContractWithCustomerIncludingAssessedTax']] },
    cogs: { st: 'IS', l: 'Cost of revenue', alt: [['CostOfGoodsAndServicesSold'], ['CostOfRevenue'], ['CostOfGoodsSold'], ['CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization']] },
    gp: { st: 'IS', l: 'Gross profit', alt: [['GrossProfit']] },
    rnd: { st: 'IS', l: 'Research & development', alt: [['ResearchAndDevelopmentExpense'], ['ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost']] },
    sga: { st: 'IS', l: 'Selling, general & administrative', alt: [['SellingGeneralAndAdministrativeExpense'], ['MarketingExpense', 'GeneralAndAdministrativeExpense'], ['SellingAndMarketingExpense', 'GeneralAndAdministrativeExpense'], ['SellingExpense', 'GeneralAndAdministrativeExpense']] },
    oth: { st: 'IS', l: 'Other operating expenses (tagged)', alt: [['OtherCostAndExpenseOperating'], ['-OtherOperatingIncomeExpenseNet']] },
    ebit: { st: 'IS', l: 'Operating income', alt: [['OperatingIncomeLoss']] },
    intInc: { st: 'IS', l: 'Interest income', alt: [['InvestmentIncomeInterest'], ['InterestIncomeOther'], ['InvestmentIncomeInterestAndDividend'], ['InterestIncomeOperating']] },
    intExp: { st: 'IS', l: 'Interest expense', alt: [['InterestExpenseNonoperating'], ['InterestExpense'], ['InterestExpenseDebt']] },
    nonop: { st: 'IS', l: 'Other nonoperating income (expense)', alt: [['OtherNonoperatingIncomeExpense'], ['NonoperatingIncomeExpense']] },
    pbt: { st: 'IS', l: 'Pretax income', alt: [['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'], ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments']] },
    tax: { st: 'IS', l: 'Income tax expense', alt: [['IncomeTaxExpenseBenefit']] },
    eqinc: { st: 'IS', l: 'Equity-method income', alt: [['IncomeLossFromEquityMethodInvestmentsNetOfDividendsOrDistributions'], ['IncomeLossFromEquityMethodInvestments']] },
    ni: { st: 'IS', l: 'Net income (including noncontrolling interests)', alt: [['ProfitLoss']] },
    niParent: { st: 'IS', l: 'Net income attributable to the company', alt: [['NetIncomeLoss']] },
    niNci: { st: 'IS', l: 'Net income attributable to noncontrolling interests', alt: [['NetIncomeLossAttributableToNoncontrollingInterest']] },
    niCommon: { st: 'IS', l: 'Net income available to common shareholders', alt: [['NetIncomeLossAvailableToCommonStockholdersBasic']] },
    epsBasic: { st: 'IS', l: 'Basic EPS', unit: 'USD/shares', alt: [['EarningsPerShareBasic'], ['EarningsPerShareBasicAndDiluted']] },
    epsDil: { st: 'IS', l: 'Diluted EPS', unit: 'USD/shares', alt: [['EarningsPerShareDiluted'], ['EarningsPerShareBasicAndDiluted']] },
    waBasic: { st: 'IS', l: 'Weighted-average basic shares', unit: 'shares', alt: [['WeightedAverageNumberOfSharesOutstandingBasic']] },
    waDil: { st: 'IS', l: 'Weighted-average diluted shares', unit: 'shares', alt: [['WeightedAverageNumberOfDilutedSharesOutstanding']] },
    // cash flow (durations)
    da: { st: 'CF', l: 'Depreciation & amortization', alt: [['DepreciationDepletionAndAmortization'], ['DepreciationAmortizationAndAccretionNet'], ['DepreciationAndAmortization'], ['DepreciationDepletionAndAmortizationPropertyPlantAndEquipment']] },
    sbc: { st: 'CF', l: 'Stock-based compensation', alt: [['ShareBasedCompensation'], ['AllocatedShareBasedCompensationExpense']] },
    defTax: { st: 'CF', l: 'Deferred income taxes', alt: [['DeferredIncomeTaxExpenseBenefit'], ['DeferredIncomeTaxesAndTaxCredits']] },
    otherNoncash: { st: 'CF', l: 'Other non-cash items', alt: [['-OtherNoncashIncomeExpense'], ['OtherNoncashExpense']] },
    cfo: { st: 'CF', l: 'Net cash from operating activities', alt: [['NetCashProvidedByUsedInOperatingActivities'], ['NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']] },
    capex: { st: 'CF', l: 'Capital expenditures', alt: [['PaymentsToAcquirePropertyPlantAndEquipment'], ['PaymentsToAcquireProductiveAssets']] },
    acq: { st: 'CF', l: 'Acquisitions, net of cash acquired', alt: [['PaymentsToAcquireBusinessesNetOfCashAcquired'], ['PaymentsToAcquireBusinessesGross']] },
    invBuy: { st: 'CF', l: 'Purchases of investments', alt: [['PaymentsToAcquireMarketableSecurities'], ['PaymentsToAcquireAvailableForSaleSecuritiesDebt', 'PaymentsToAcquireOtherInvestments'], ['PaymentsToAcquireAvailableForSaleSecuritiesDebt'], ['PaymentsToAcquireInvestments'], ['PaymentsToAcquireShortTermInvestments']] },
    invSell: { st: 'CF', l: 'Sales and maturities of investments', alt: [['ProceedsFromSaleAndMaturityOfMarketableSecurities'], ['ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities', 'ProceedsFromSaleOfAvailableForSaleSecuritiesDebt', 'ProceedsFromSaleAndMaturityOfOtherInvestments'], ['ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities', 'ProceedsFromSaleOfAvailableForSaleSecuritiesDebt'], ['ProceedsFromSaleMaturityAndCollectionsOfInvestments'], ['ProceedsFromSaleOfShortTermInvestments']] },
    cfi: { st: 'CF', l: 'Net cash from investing activities', alt: [['NetCashProvidedByUsedInInvestingActivities'], ['NetCashProvidedByUsedInInvestingActivitiesContinuingOperations']] },
    debtIssG: { st: 'CF', l: 'Proceeds from borrowings', alt: [['ProceedsFromIssuanceOfDebt'], ['ProceedsFromIssuanceOfLongTermDebt', 'ProceedsFromShortTermDebt'], ['ProceedsFromIssuanceOfLongTermDebt'], ['ProceedsFromShortTermDebt']] },
    debtRepG: { st: 'CF', l: 'Repayments of borrowings', alt: [['RepaymentsOfDebt'], ['RepaymentsOfLongTermDebt', 'RepaymentsOfShortTermDebt'], ['RepaymentsOfLongTermDebt'], ['RepaymentsOfShortTermDebt']] },
    debtNetST: { st: 'CF', l: 'Net change in short-term borrowings', alt: [['ProceedsFromRepaymentsOfShortTermDebt'], ['ProceedsFromRepaymentsOfCommercialPaper']] },
    buyback: { st: 'CF', l: 'Share repurchases', alt: [['PaymentsForRepurchaseOfCommonStock']] },
    issue: { st: 'CF', l: 'Share issuance', alt: [['ProceedsFromIssuanceOfCommonStock'], ['ProceedsFromStockOptionsExercised']] },
    div: { st: 'CF', l: 'Dividends paid', alt: [['PaymentsOfDividendsCommonStock'], ['PaymentsOfDividends']] },
    leasePrin: { st: 'CF', l: 'Finance lease principal payments', alt: [['FinanceLeasePrincipalPayments'], ['RepaymentsOfLongTermCapitalLeaseObligations']] },
    cff: { st: 'CF', l: 'Net cash from financing activities', alt: [['NetCashProvidedByUsedInFinancingActivities'], ['NetCashProvidedByUsedInFinancingActivitiesContinuingOperations']] },
    fx: { st: 'CF', l: 'Effect of exchange rates on cash', alt: [['EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], ['EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations'], ['EffectOfExchangeRateOnCashAndCashEquivalents']] },
    dCash: { st: 'CF', l: 'Net change in cash (incl. restricted cash)', alt: [['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect'], ['CashAndCashEquivalentsPeriodIncreaseDecrease']] },
    // balance sheet (instants)
    cash: { st: 'BS', i: true, l: 'Cash and cash equivalents', alt: [['CashAndCashEquivalentsAtCarryingValue'], ['Cash']] },
    sti: { st: 'BS', i: true, l: 'Short-term investments', alt: [['MarketableSecuritiesCurrent'], ['ShortTermInvestments'], ['AvailableForSaleSecuritiesDebtSecuritiesCurrent']] },
    ar: { st: 'BS', i: true, l: 'Accounts receivable', alt: [['AccountsReceivableNetCurrent'], ['ReceivablesNetCurrent'], ['AccountsReceivableNet']] },
    inv: { st: 'BS', i: true, l: 'Inventory', alt: [['InventoryNet'], ['InventoryFinishedGoodsNetOfReserves']] },
    tca: { st: 'BS', i: true, l: 'Total current assets', alt: [['AssetsCurrent']] },
    ppe: { st: 'BS', i: true, l: 'Property, plant & equipment, net', alt: [['PropertyPlantAndEquipmentNet'], ['PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization'], ['PropertyPlantAndEquipmentExcludingLessorAssetUnderOperatingLeaseAfterAccumulatedDepreciation']] },
    rou: { st: 'BS', i: true, l: 'Operating lease right-of-use assets', alt: [['OperatingLeaseRightOfUseAsset']] },
    gw: { st: 'BS', i: true, l: 'Goodwill', alt: [['Goodwill']] },
    intang: { st: 'BS', i: true, l: 'Intangible assets, net', alt: [['IntangibleAssetsNetExcludingGoodwill'], ['FiniteLivedIntangibleAssetsNet']] },
    dta: { st: 'BS', i: true, l: 'Deferred tax assets', alt: [['DeferredIncomeTaxAssetsNet']] },
    ta: { st: 'BS', i: true, l: 'Total assets', alt: [['Assets']] },
    ap: { st: 'BS', i: true, l: 'Accounts payable', alt: [['AccountsPayableCurrent'], ['AccountsPayableTradeCurrent']] },
    accrTag: { st: 'BS', i: true, l: 'Accrued liabilities (as reported)', alt: [['AccruedLiabilitiesCurrent'], ['OtherAccruedLiabilitiesCurrent']] },
    defrev: { st: 'BS', i: true, l: 'Deferred revenue', alt: [['ContractWithCustomerLiabilityCurrent'], ['DeferredRevenueCurrent']] },
    std: { st: 'BS', i: true, l: 'Short-term debt', alt: [['ShortTermBorrowings'], ['CommercialPaper']] },
    cltd: { st: 'BS', i: true, l: 'Current portion of long-term debt', alt: [['LongTermDebtCurrent'], ['LongTermDebtAndCapitalLeaseObligationsCurrent']] },
    oclTag: { st: 'BS', i: true, l: 'Other current liabilities (as reported)', alt: [['OtherLiabilitiesCurrent']] },
    oplC: { st: 'BS', i: true, l: 'Operating lease liabilities, current', alt: [['OperatingLeaseLiabilityCurrent']] },
    finlC: { st: 'BS', i: true, l: 'Finance lease liabilities, current', alt: [['FinanceLeaseLiabilityCurrent']] },
    tcl: { st: 'BS', i: true, l: 'Total current liabilities (as reported)', alt: [['LiabilitiesCurrent']] },
    ltdNC: { st: 'BS', i: true, l: 'Long-term debt, noncurrent', alt: [['LongTermDebtNoncurrent'], ['LongTermDebtAndCapitalLeaseObligations']] },
    ltdTot: { st: 'BS', i: true, l: 'Long-term debt including current portion', alt: [['LongTermDebt']] },
    opl: { st: 'BS', i: true, l: 'Operating lease liabilities', alt: [['OperatingLeaseLiability'], ['OperatingLeaseLiabilityCurrent', 'OperatingLeaseLiabilityNoncurrent']] },
    finl: { st: 'BS', i: true, l: 'Finance lease liabilities', alt: [['FinanceLeaseLiability'], ['FinanceLeaseLiabilityCurrent', 'FinanceLeaseLiabilityNoncurrent']] },
    dtl: { st: 'BS', i: true, l: 'Deferred tax liabilities', alt: [['DeferredIncomeTaxLiabilitiesNet'], ['DeferredTaxLiabilitiesNoncurrent']] },
    tl: { st: 'BS', i: true, l: 'Total liabilities', alt: [['Liabilities']] },
    cs: { st: 'BS', i: true, l: 'Common stock', alt: [['CommonStockValue'], ['CommonStocksIncludingAdditionalPaidInCapital']] },
    apic: { st: 'BS', i: true, l: 'Additional paid-in capital', alt: [['AdditionalPaidInCapital'], ['AdditionalPaidInCapitalCommonStock']] },
    re: { st: 'BS', i: true, l: 'Retained earnings', alt: [['RetainedEarningsAccumulatedDeficit']] },
    treas: { st: 'BS', i: true, l: 'Treasury stock', alt: [['TreasuryStockValue'], ['TreasuryStockCommonValue']] },
    aoci: { st: 'BS', i: true, l: 'Accumulated other comprehensive income', alt: [['AccumulatedOtherComprehensiveIncomeLossNetOfTax']] },
    pref: { st: 'BS', i: true, l: 'Preferred stock', alt: [['PreferredStockValue']] },
    se: { st: 'BS', i: true, l: "Stockholders' equity attributable to the company", alt: [['StockholdersEquity']] },
    nci: { st: 'BS', i: true, l: 'Noncontrolling interests', alt: [['MinorityInterest']] },
    mezz: { st: 'BS', i: true, l: 'Temporary (mezzanine) equity, e.g. redeemable preferred stock', alt: [['TemporaryEquityCarryingAmountAttributableToParent'], ['TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests']] },
    teInc: { st: 'BS', i: true, l: 'Total equity including noncontrolling interests', alt: [['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']] },
    tle: { st: 'BS', i: true, l: 'Total liabilities and equity', alt: [['LiabilitiesAndStockholdersEquity']] },
    cashEndCF: { st: 'CF', i: true, l: 'Cash, cash equivalents and restricted cash (cash flow statement)', alt: [['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], ['CashAndCashEquivalentsAtCarryingValue']] },
    sharesBS: { st: 'BS', i: true, l: 'Common shares outstanding (balance sheet date)', unit: 'shares', alt: [['CommonStockSharesOutstanding']] },
  };
  const REFS = {
    matY1: 'LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths', matY2: 'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearTwo', matY3: 'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearThree',
    matY4: 'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearFour', matY5: 'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearFive', matAfter: 'LongTermDebtMaturitiesRepaymentsOfPrincipalAfterYearFive',
    revCap: 'LineOfCreditFacilityMaximumBorrowingCapacity', nol: 'OperatingLossCarryforwards', nolDTA: 'DeferredTaxAssetsOperatingLossCarryforwards', valAllow: 'DeferredTaxAssetsValuationAllowance',
    restrictedC: 'RestrictedCashCurrent', restrictedNC: 'RestrictedCashNoncurrent', finRou: 'FinanceLeaseRightOfUseAsset', otherNCA: 'OtherAssetsNoncurrent', otherNCL: 'OtherLiabilitiesNoncurrent', otherCA: 'OtherAssetsCurrent',
  };

  // ---------- SEC company facts ----------
  function fromSEC(json, subs, opts = {}) {
    if (!json || !json.facts || !json.facts['us-gaap']) throw new Error('This is not an SEC company facts file (data.sec.gov/api/xbrl/companyfacts/CIK##########.json).');
    const L = Sec.latest(json, subs);
    const s = subs || {};
    const company = { name: json.entityName || s.name || null, cik: String(json.cik || '').padStart(10, '0'), ticker: opts.ticker || (s.tickers && s.tickers[0]) || null, exchange: (s.exchanges && s.exchanges[0]) || null, industry: s.sicDescription || null, fyEnd: s.fiscalYearEnd ? s.fiscalYearEnd.slice(0, 2) + '-' + s.fiscalYearEnd.slice(2) : null, currency: 'USD' };
    // fiscal years: the five newest annual periods reported in 10-Ks
    const fyEnds = {};
    MAP.rev.alt.forEach(a => a.forEach(c => Sec.entries(json, c, 'USD').filter(x => x.pt === 'FY' && /^10-K/.test(x.form)).forEach(x => { if (!fyEnds[x.end] || x.filed > fyEnds[x.end].filed) fyEnds[x.end] = x; })));
    // fiscal years must be about a year apart (drop 52/53-week duplicates within a few days)
    const ends = Object.keys(fyEnds).sort().reverse().filter((e, i, a) => i === 0 || days(e, a[i - 1]) > 300).slice(0, 5).reverse();
    if (!ends.length) throw new Error('No annual revenue from a 10-K was found in this SEC file.');
    const periods = ends.map(end => ({ id: 'FY' + end.slice(0, 4), label: 'FY' + end.slice(0, 4), end, start: fyEnds[end].start, kind: 'FY', form: fyEnds[end].form, accn: fyEnds[end].accn, filed: fyEnds[end].filed }));
    // fiscal year label: the year in which most of the fiscal year falls (Walmart's year ending January 2026 is FY2026 by its own naming)
    periods.forEach(p => { const mid = new Date((new Date(p.start || p.end).getTime() + new Date(p.end).getTime()) / 2); p.calYear = mid.getUTCFullYear(); });
    const cells = {};
    const notes = [];
    const fmtN = v => Math.round(v).toLocaleString('en-US');
    const meta = { company, provider: 'SEC EDGAR XBRL company facts', retrieved: new Date().toISOString(), filings: { newest: L.newest, q: L.q, k: L.k } };
    const base = r => Object.assign({ provider: 'SEC EDGAR XBRL company facts', company: company.name, ticker: company.ticker, cik: company.cik, retrieved: today() }, r);
    const recOf = (x, key, m, scale) => {
      const r = Sec.record(json, x, { L, metric: m.l, unit: m.unit === 'shares' ? 'millions of shares' : m.unit === 'USD/shares' ? 'USD per share' : '$ millions', scale, annual: true });
      return base({ cat: 'sec', concept: r.concept, form: r.form, accn: r.accn, filed: r.filed, fy: r.fy, fp: r.fp, period: r.periodText, start: r.start, end: r.end, url: r.url, raw: r.raw, rawUnit: r.rawUnit, unit: r.unit, statement: m.st, value: r.value });
    };
    const scaleOf = m => m.unit === 'USD/shares' ? 1 : 1e6;
    const unitOf = m => m.unit || 'USD';
    // year-end balance: the latest 10-K that reports it, else the latest 10-Q (all filings, not only the newest one per date)
    function bsEntry(c, unit, end) {
      const f = json && json.facts && json.facts['us-gaap'] && json.facts['us-gaap'][c];
      const list = ((f && f.units && f.units[unit]) || []).filter(x => !x.start && x.end === end && isNum(x.val) && /^10-[KQ](\/A)?$/.test(x.form || ''));
      if (!list.length) return null;
      const later = (a, b) => String(a.filed) > String(b.filed) ? a : b;
      const k = list.filter(x => /^10-K/.test(x.form));
      const x = (k.length ? k : list).reduce(later);
      return Object.assign({ concept: c, ns: 'us-gaap', unit, pt: 'instant' }, x);
    }
    // one figure for a period: the first alternative whose concepts are all present for that period
    function getFY(key, end, start) {
      const m = MAP[key];
      for (const alt of m.alt) {
        const parts = [];
        for (const c0 of alt) {
          const neg = c0[0] === '-'; const c = neg ? c0.slice(1) : c0;
          // balance sheet: prefer the annual report's own figure; a later 10-Q can re-present the year-end balance under a different meaning
          const x = m.i ? bsEntry(c, unitOf(m), end) : Sec.entries(json, c, unitOf(m)).find(e => e.pt === 'FY' && e.end === end);
          if (!x) { parts.length = 0; break; }
          parts.push({ x, neg });
        }
        if (!parts.length) continue;
        const sc = scaleOf(m);
        const v = parts.reduce((a, p) => a + (p.neg ? -1 : 1) * p.x.val / sc, 0);
        if (parts.length === 1) { const r = recOf(parts[0].x, key, m, sc); if (parts[0].neg) { r.value = -r.value; r.method = `Sign reversed: us-gaap:${alt[0].slice(1)} reports income as positive; shown here as an expense.`; } return { v, src: r }; }
        const recs = parts.map(p => recOf(p.x, key, m, sc));
        return { v, src: base({ cat: 'calc', statement: m.st, period: recs[0].period, end, unit: recs[0].unit, url: recs[0].url, form: recs[0].form, accn: recs[0].accn, filed: recs[0].filed, method: alt.map(c => 'us-gaap:' + c.replace(/^-/, '')).join(' + ') + ' (sum of reported lines)', parts: recs.map(r => ({ concept: r.concept, value: r.value, form: r.form, accn: r.accn, url: r.url })) }) };
      }
      return null;
    }
    // TTM: flows = FY + YTD − prior YTD (same concept); balance sheet = latest 10-Q balance sheet after the fiscal year
    const fyLast = periods[periods.length - 1];
    function getTTM(key) {
      const m = MAP[key];
      if (m.i) {
        for (const alt of m.alt) {
          const parts = []; let end = null;
          for (const c0 of alt) {
            const neg = c0[0] === '-'; const c = neg ? c0.slice(1) : c0;
            const x = Sec.entries(json, c, unitOf(m)).filter(e => !e.start && /^10-Q/.test(e.form) && e.end > fyLast.end).sort((a, b) => b.end.localeCompare(a.end))[0];
            if (!x || (end && x.end !== end)) { parts.length = 0; break; }
            end = x.end; parts.push({ x, neg });
          }
          if (!parts.length) continue;
          const sc = scaleOf(m);
          const v = parts.reduce((a, p) => a + (p.neg ? -1 : 1) * p.x.val / sc, 0);
          const recs = parts.map(p => recOf(p.x, key, m, sc));
          return { v, end, src: parts.length === 1 ? recs[0] : base({ cat: 'calc', statement: m.st, period: recs[0].period, end, unit: recs[0].unit, url: recs[0].url, method: alt.join(' + '), parts: recs.map(r => ({ concept: r.concept, value: r.value, accn: r.accn, url: r.url })) }) };
        }
        return null;
      }
      for (const alt of m.alt) {
        const parts = [];
        for (const c0 of alt) {
          const neg = c0[0] === '-'; const c = neg ? c0.slice(1) : c0;
          const fy = Sec.entries(json, c, unitOf(m)).find(e => e.pt === 'FY' && e.end === fyLast.end);
          if (!fy) { parts.length = 0; break; }
          if (unitOf(m) !== 'USD') { parts.length = 0; break; } // per-share and share counts are not additive across periods
          const t = Sec.ttm(json, [c], { L, metric: m.l, fy });
          if (!t || !isNum(t.value)) { parts.length = 0; break; }
          parts.push({ t, neg });
        }
        if (!parts.length) continue;
        const ends = [...new Set(parts.map(p => p.t.end))];
        if (ends.length > 1) return { v: null, note: `${m.l}: the parts of this line end on different dates (${ends.join(', ')}), so no TTM figure is built.` };
        const v = parts.reduce((a, p) => a + (p.neg ? -1 : 1) * p.t.value, 0);
        const t0 = parts[0].t;
        return { v, end: t0.end, src: base({ cat: parts.length === 1 && t0.parts && t0.parts.length === 1 ? 'sec' : 'calc', statement: m.st, period: t0.periodText, end: t0.end, unit: '$ millions', url: t0.url, form: t0.form, accn: t0.accn, filed: t0.filed, method: parts.map(p => (p.neg ? '−(' : '') + p.t.method + (p.neg ? ')' : '')).join(' + '), parts: parts.flatMap(p => (p.t.parts || []).map(q => ({ metric: q.metric, concept: q.concept, value: q.value, form: q.form, accn: q.accn, period: q.periodText, url: q.url }))) }) };
      }
      return null;
    }
    const pids = periods.map(p => p.id);
    Object.keys(MAP).forEach(key => {
      cells[key] = {};
      periods.forEach(p => { const r = getFY(key, p.end, p.start); if (r && isNum(r.v)) cells[key][p.id] = r; });
    });
    // TTM column
    let ttm = null;
    const revT = getTTM('rev');
    if (revT && isNum(revT.v) && revT.end > fyLast.end) {
      ttm = { id: 'TTM', label: 'TTM', end: revT.end, kind: 'TTM', bsEnd: null, note: '' };
      Object.keys(MAP).forEach(key => { const r = getTTM(key); if (r && isNum(r.v)) { if (!MAP[key].i && r.end !== revT.end) { notes.push(`TTM ${MAP[key].l}: ends ${r.end}, not ${revT.end}; left out of the TTM column.`); return; } cells[key].TTM = r; if (MAP[key].i) ttm.bsEnd = ttm.bsEnd && ttm.bsEnd > r.end ? ttm.bsEnd : r.end; } else if (r && r.note) notes.push(r.note); });
      ttm.label = 'TTM ' + ttm.end;
      // flag balance sheet lines that change by a factor of five or more between the annual report and the latest 10-Q (often a tagging change, e.g. lessor assets tagged as lease assets)
      const taRef = cells.ta && cells.ta[fyLast.id] ? Math.abs(cells.ta[fyLast.id].v) : null;
      Object.keys(MAP).forEach(key => { if (!MAP[key].i || MAP[key].unit) return; const a0 = cells[key][fyLast.id], a1 = cells[key].TTM; if (!a0 || !a1 || !taRef) return; const big = Math.max(Math.abs(a0.v), Math.abs(a1.v)) > 0.01 * taRef; const r = Math.abs(a1.v) / Math.max(1e-9, Math.abs(a0.v)); if (big && (r > 5 || r < 0.2)) notes.push(`Check ${MAP[key].l}: ${fmtN(a0.v)} in the ${fyLast.label} 10-K but ${fmtN(a1.v)} in the 10-Q for ${a1.end || ttm.end}. A change this large is often a change in how the company tags the line; compare the two balance sheets before using the TTM base.`); });
      ttm.note = `Twelve months ended ${ttm.end}: latest fiscal year + year-to-date − the same year-to-date a year earlier. A reference column, not a fiscal year.`;
    } else notes.push(`No 10-Q after the fiscal year ended ${fyLast.end}: there is no separate TTM column (it would equal ${fyLast.label}).`);
    const allP = ttm ? pids.concat(['TTM']) : pids;
    // ---------- classification of each period's statements (residuals from reported totals, carve-outs) ----------
    allP.forEach(pid => classify(cells, pid, notes, base));
    // references (latest annual footnote figures)
    const refs = {};
    Object.entries(REFS).forEach(([k, c]) => {
      const x = Sec.pick(json, [c], 'USD', 'instant');
      if (x) { const r = Sec.record(json, x, { L, metric: c, unit: '$ millions' }); refs[k] = { v: r.value, src: base({ cat: 'sec', concept: r.concept, form: r.form, accn: r.accn, filed: r.filed, period: r.periodText, end: r.end, url: r.url, raw: r.raw, rawUnit: r.rawUnit, unit: '$ millions', statement: 'Note' }) };
      }
    });
    const effRate = Sec.pick(json, ['EffectiveIncomeTaxRateReconciliationAtFederalStatutoryIncomeTaxRate'], 'pure', 'FY');
    if (effRate) refs.statutory = { v: effRate.val, src: base({ cat: 'sec', concept: 'us-gaap:EffectiveIncomeTaxRateReconciliationAtFederalStatutoryIncomeTaxRate', form: effRate.form, accn: effRate.accn, filed: effRate.filed, end: effRate.end, period: 'fiscal year ended ' + effRate.end, unit: 'rate', statement: 'Note' }) };
    // shares: cover page (latest date) and balance-sheet date counts, kept separate
    const SH = Sec.shares(json, { L });
    if (SH.actual) refs.sharesCover = { v: SH.actual.value, src: base({ cat: 'sec', concept: SH.actual.concept, form: SH.actual.form, accn: SH.actual.accn, filed: SH.actual.filed, end: SH.actual.end, period: 'as of ' + SH.actual.end, url: SH.actual.url, raw: SH.actual.raw, rawUnit: 'shares', unit: 'millions of shares', statement: 'Cover page', method: SH.actual.method, multiClass: !!SH.actual.multiClass }) };
    if (SH.netDilFY) refs.netDilFY = { v: SH.netDilFY.value, src: base({ cat: SH.netDilFY.cat || 'sec', concept: SH.netDilFY.concept, end: SH.netDilFY.end, period: SH.netDilFY.periodText, form: SH.netDilFY.form, accn: SH.netDilFY.accn, url: SH.netDilFY.url, unit: 'millions of shares', statement: 'EPS note', method: SH.netDilFY.method }) };
    if (SH.netDilQ) refs.netDilQ = { v: SH.netDilQ.value, src: base({ cat: SH.netDilQ.cat || 'sec', concept: SH.netDilQ.concept, end: SH.netDilQ.end, period: SH.netDilQ.periodText, form: SH.netDilQ.form, accn: SH.netDilQ.accn, url: SH.netDilQ.url, unit: 'millions of shares', statement: 'EPS note', method: SH.netDilQ.method }) };
    notes.push('Segment revenue is not in the SEC company facts file (segment figures carry dimensions). Enter segments from the segment note of the 10-K if you forecast by segment.');
    if (!periods.length || periods.length < 5) notes.push(`Only ${periods.length} fiscal year(s) were found in the file.`);
    return { providerId: 'sec', meta, periods, ttm, cells, refs, notes };
  }

  // Build classified lines for one period from the tagged figures. Returns nothing; writes cells[key][pid].
  function classify(cells, pid, notes, base) {
    const tol = 1.0;
    const g = k => cells[k] && cells[k][pid] && isNum(cells[k][pid].v) ? cells[k][pid].v : null;
    const set = (k, v, method, deps) => { if (!isNum(v)) return; cells[k] = cells[k] || {}; cells[k][pid] = { v, src: base({ cat: 'calc', method, deps: deps || [], period: pid }) }; };
    const label = pid === 'TTM' ? 'TTM' : pid;
    // income statement
    if (!isNum(g('gp')) && isNum(g('rev')) && isNum(g('cogs'))) set('gp', g('rev') - g('cogs'), 'Revenue − cost of revenue', ['rev', 'cogs']);
    if (!isNum(g('cogs')) && isNum(g('rev')) && isNum(g('gp'))) set('cogs', g('rev') - g('gp'), 'Revenue − gross profit (cost of revenue not tagged separately)', ['rev', 'gp']);
    if (isNum(g('ni')) === false && isNum(g('niParent'))) set('ni', g('niParent') + nz(g('niNci')), 'Net income attributable to the company + noncontrolling interests', ['niParent', 'niNci']);
    // equity-method income: below pretax income only when the arithmetic says so
    if (isNum(g('eqinc')) && isNum(g('pbt')) && isNum(g('tax')) && isNum(g('ni'))) {
      const below = Math.abs(g('pbt') - g('tax') + g('eqinc') - g('ni')) <= tol, inside = Math.abs(g('pbt') - g('tax') - g('ni')) <= tol;
      if (!below && inside) { delete cells.eqinc[pid]; }
    } else if (cells.eqinc && cells.eqinc[pid] && isNum(g('pbt')) && isNum(g('tax')) && isNum(g('ni')) && Math.abs(g('pbt') - g('tax') - g('ni')) <= tol) delete cells.eqinc[pid];
    // balance sheet
    if (!isNum(g('ta'))) return;
    // current assets: other current assets = total current assets − cash − investments − receivables − inventory
    if (isNum(g('tca'))) set('oca', g('tca') - nz(g('cash')) - nz(g('sti')) - nz(g('ar')) - nz(g('inv')), 'Total current assets − cash − short-term investments − receivables − inventory (the lines not tagged separately)', ['tca', 'cash', 'sti', 'ar', 'inv']);
    // noncurrent assets: operating lease ROU assets reported inside PP&E are carved out
    if (isNum(g('tca'))) {
      let olta = g('ta') - g('tca') - nz(g('ppe')) - nz(g('rou')) - nz(g('gw')) - nz(g('intang')) - nz(g('dta'));
      if (olta < -tol && isNum(g('rou')) && Math.abs(olta + g('rou')) <= Math.max(tol, Math.abs(g('ta')) * 1e-4) && isNum(g('ppe'))) {
        set('ppe', g('ppe') - g('rou'), 'PP&E as reported includes operating lease right-of-use assets, shown separately below', ['ppe', 'rou']);
        olta += g('rou');
        notes.push(`${label}: the PP&E figure includes operating lease right-of-use assets; they are shown on their own line.`);
      }
      set('olta', olta, 'Total assets − current assets − PP&E − lease assets − goodwill − intangibles − deferred tax assets. Includes any line the company does not tag separately (for Amazon, intangibles sit inside "Other assets" on the face and are shown on their own line here).', ['ta', 'tca', 'ppe', 'rou', 'gw', 'intang', 'dta']);
      if (olta < -tol) notes.push(`${label}: tagged noncurrent assets exceed total assets by ${(-olta).toFixed(0)}: a line is counted twice. Review the balance sheet and correct the classification.`);
    }
    // equity
    let te = isNum(g('teInc')) ? g('teInc') : isNum(g('se')) ? g('se') + nz(g('nci')) : null;
    // temporary (mezzanine) equity sits between liabilities and equity; it is carried in "other equity" so the balance sheet ties
    const mz = g('mezz');
    const mezzIn = isNum(mz) && mz !== 0 && isNum(te) && isNum(g('ta')) && (isNum(g('tl')) ? Math.abs(g('ta') - g('tl') - te - mz) <= Math.max(tol, Math.abs(g('ta')) * 1e-5) : true);
    if (mezzIn) { te += mz; notes.push(`${label}: temporary (mezzanine) equity of ${mz.toFixed(0)} (for example redeemable preferred stock) is reported between liabilities and equity. It is included in "Other equity" so the balance sheet ties. It is a claim ahead of common shareholders: subtract it in the DCF equity bridge.`); }
    if (isNum(te)) set('te', te, isNum(g('teInc')) ? 'Reported total equity including noncontrolling interests' : "Stockholders' equity + noncontrolling interests", ['se', 'nci']);
    if (isNum(g('se'))) {
      let cs = g('cs');
      const csIncl = cells.cs && cells.cs[pid] && cells.cs[pid].src && /CommonStocksIncludingAdditionalPaidInCapital/.test(cells.cs[pid].src.concept || '');
      if (csIncl) { set('apic', g('cs'), 'Common stock and additional paid-in capital are reported as one line', ['cs']); set('cs', 0, 'Included in additional paid-in capital (one line in the filing)'); cs = 0; }
      const oeq = g('se') - nz(cs) - nz(g('apic')) - nz(g('re')) + nz(g('treas')) - nz(g('aoci')) + (mezzIn ? mz : 0);
      set('oeq', oeq, "Stockholders' equity − common stock − APIC − retained earnings + treasury stock − AOCI (preferred stock and other equity lines)" + (mezzIn ? ' + temporary (mezzanine) equity' : ''), ['se', 'cs', 'apic', 're', 'treas', 'aoci'].concat(mezzIn ? ['mezz'] : []));
    }
    // liabilities
    const tl = isNum(g('tl')) ? g('tl') : isNum(g('tle')) && isNum(te) ? g('tle') - te : isNum(te) ? g('ta') - te : null;
    if (isNum(tl) && !isNum(g('tl'))) set('tl', tl, isNum(g('tle')) ? 'Total liabilities and equity − total equity (total liabilities are not tagged)' : 'Total assets − total equity', ['tle', 'te']);
    // long-term debt: noncurrent, or total less the current portion
    if (!isNum(g('ltdNC')) && isNum(g('ltdTot'))) set('ltdNC', g('ltdTot') - nz(g('cltd')), 'Long-term debt including the current portion − current portion', ['ltdTot', 'cltd']);
    if (isNum(g('ltdNC'))) set('ltd', g('ltdNC'), 'Long-term debt, noncurrent', ['ltdNC']);
    if (isNum(g('tcl'))) {
      // tagged current lines, including current lease portions (moved to the lease lines in this model)
      const spec = ['ap', 'accrTag', 'defrev', 'std', 'cltd', 'oclTag', 'oplC', 'finlC'];
      let excess = spec.reduce((a, k) => a + nz(g(k)), 0) - g('tcl');
      let accr = g('accrTag'), ocl = g('oclTag');
      if (excess > tol) {
        // some tagged items sit inside a broader reported line ("accrued expenses and other"): find which
        const cands = ['std', 'cltd', 'oplC', 'finlC', 'defrev'].filter(k => isNum(g(k)) && g(k) !== 0);
        let best = null;
        for (let mask = 1; mask < (1 << cands.length); mask++) {
          const pick = cands.filter((_, i) => mask & (1 << i)); const sm = pick.reduce((a, k) => a + g(k), 0);
          if (Math.abs(sm - excess) <= Math.max(tol, g('tcl') * 1e-5) && (!best || pick.length < best.length)) best = pick;
        }
        const host = isNum(accr) ? 'accr' : isNum(ocl) ? 'ocl' : null;
        if (best && host) {
          const amt = best.reduce((a, k) => a + g(k), 0);
          if (host === 'accr') accr -= amt; else ocl -= amt;
          excess -= amt;
          notes.push(`${label}: ${best.map(k => MAP[k].l.toLowerCase()).join(', ')} (${amt.toFixed(0)} in total) are included in the company's "${host === 'accr' ? MAP.accrTag.l : MAP.oclTag.l}" line; they are shown on their own lines and removed from it.`);
        }
      }
      set('accr', isNum(accr) ? accr : 0, isNum(g('accrTag')) ? (accr !== g('accrTag') ? `Reported accrued liabilities (${g('accrTag').toFixed(0)}) less the items shown on their own lines` : 'Reported accrued liabilities') : 'Not tagged separately (included in other current liabilities)', ['accrTag']);
      const oclV = g('tcl') - nz(g('ap')) - nz(accr) - nz(g('defrev')) - nz(g('std')) - nz(g('cltd')) - nz(g('oplC')) - nz(g('finlC'));
      set('ocl', oclV, 'Total current liabilities − the lines shown separately (includes items the company does not tag separately)', ['tcl', 'ap', 'accr', 'defrev', 'std', 'cltd', 'oplC', 'finlC']);
      if (oclV < -tol) notes.push(`${label}: tagged current liabilities exceed the reported total by ${(-oclV).toFixed(0)} and no combination of items explains it. Shown as a negative "other current liabilities" so the difference is visible; correct the classification.`);
      // noncurrent: other long-term liabilities = total liabilities − current − LTD − leases − deferred taxes
      if (isNum(tl)) {
        const curShown = g('tcl') - nz(g('oplC')) - nz(g('finlC'));
        const oltl = tl - curShown - nz(g('ltd')) - nz(g('opl')) - nz(g('finl')) - nz(g('dtl'));
        set('oltl', oltl, 'Total liabilities − current liabilities − long-term debt − lease liabilities (current and noncurrent) − deferred tax liabilities', ['tl', 'tcl', 'ltd', 'opl', 'finl', 'dtl']);
        if (oltl < -tol) notes.push(`${label}: tagged noncurrent liabilities exceed the total by ${(-oltl).toFixed(0)}. A lease or debt line may be included in long-term debt; check the debt note.`);
      }
    }
    if (isNum(g('ta')) && isNum(te) && isNum(tl) && Math.abs(g('ta') - tl - te) > tol) notes.push(`${label}: reported total assets (${g('ta').toFixed(0)}) do not equal liabilities + equity (${(tl + te).toFixed(0)}).`);
    // cash flow derived lines
    const iss = nz(g('debtIssG')) + Math.max(0, nz(g('debtNetST'))), rep = nz(g('debtRepG')) + Math.max(0, -nz(g('debtNetST')));
    if ([g('debtIssG'), g('debtNetST')].some(isNum)) set('debtIss', iss, 'Proceeds from borrowings (+ net increase in short-term borrowings)', ['debtIssG', 'debtNetST']);
    if ([g('debtRepG'), g('debtNetST')].some(isNum)) set('debtRep', rep, 'Repayments of borrowings (+ net decrease in short-term borrowings)', ['debtRepG', 'debtNetST']);
    if ([g('invBuy'), g('invSell')].some(isNum)) set('invNet', nz(g('invSell')) - nz(g('invBuy')), 'Sales and maturities of investments − purchases of investments', ['invSell', 'invBuy']);
  }

  // ---------- Financial Modeling Prep ----------
  async function fmpGet(path, key, fetchFn, optional) {
    try {
      const res = await fetchFn('https://financialmodelingprep.com/stable/' + path + (path.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(key));
      let j = null; try { j = await res.json(); } catch (e) {}
      const msg = j && !Array.isArray(j) && (j['Error Message'] || j.message || j.error);
      if (!res.ok || msg) throw new Error(msg || `HTTP ${res.status}`);
      return j;
    } catch (e) { if (optional) return { __error: e.message }; throw e; }
  }
  const FMP = {
    rev: ['IS', 'revenue'], cogs: ['IS', 'costOfRevenue'], gp: ['IS', 'grossProfit'], rnd: ['IS', 'researchAndDevelopmentExpenses'], sga: ['IS', 'sellingGeneralAndAdministrativeExpenses'],
    oth: ['IS', 'otherExpenses'], ebit: ['IS', 'operatingIncome'], intInc: ['IS', 'interestIncome'], intExp: ['IS', 'interestExpense'], pbt: ['IS', 'incomeBeforeTax'], tax: ['IS', 'incomeTaxExpense'],
    niParent: ['IS', 'netIncome'], epsBasic: ['IS', 'eps', 1], epsDil: ['IS', 'epsDiluted', 1], waBasic: ['IS', 'weightedAverageShsOut'], waDil: ['IS', 'weightedAverageShsOutDil'],
    da: ['CF', 'depreciationAndAmortization'], sbc: ['CF', 'stockBasedCompensation'], defTax: ['CF', 'deferredIncomeTax'], otherNoncash: ['CF', 'otherNonCashItems'], cfo: ['CF', 'netCashProvidedByOperatingActivities'],
    capex: ['CF', 'investmentsInPropertyPlantAndEquipment', -1], acq: ['CF', 'acquisitionsNet', -1], invBuy: ['CF', 'purchasesOfInvestments', -1], invSell: ['CF', 'salesMaturitiesOfInvestments'], cfi: ['CF', 'netCashProvidedByInvestingActivities'],
    buyback: ['CF', 'commonStockRepurchased', -1], issue: ['CF', 'commonStockIssuance'], div: ['CF', 'commonDividendsPaid', -1], cff: ['CF', 'netCashProvidedByFinancingActivities'], fx: ['CF', 'effectOfForexChangesOnCash'], dCash: ['CF', 'netChangeInCash'],
    cash: ['BS', 'cashAndCashEquivalents'], sti: ['BS', 'shortTermInvestments'], ar: ['BS', 'netReceivables'], inv: ['BS', 'inventory'], tca: ['BS', 'totalCurrentAssets'], ppe: ['BS', 'propertyPlantEquipmentNet'], gw: ['BS', 'goodwill'], intang: ['BS', 'intangibleAssets'], dta: ['BS', 'taxAssets'], ta: ['BS', 'totalAssets'],
    ap: ['BS', 'accountPayables'], accrTag: ['BS', 'accruedExpenses'], defrev: ['BS', 'deferredRevenue'], std: ['BS', 'shortTermDebt'], tcl: ['BS', 'totalCurrentLiabilities'], ltdNC: ['BS', 'longTermDebt'], finl: ['BS', 'capitalLeaseObligations'],
    dtl: ['BS', 'deferredTaxLiabilitiesNonCurrent'], tl: ['BS', 'totalLiabilities'], cs: ['BS', 'commonStock'], apic: ['BS', 'additionalPaidInCapital'], re: ['BS', 'retainedEarnings'], treas: ['BS', 'treasuryStock', -1], aoci: ['BS', 'accumulatedOtherComprehensiveIncomeLoss'],
    se: ['BS', 'totalStockholdersEquity'], nci: ['BS', 'minorityInterest'], teInc: ['BS', 'totalEquity'], tle: ['BS', 'totalLiabilitiesAndTotalEquity'],
  };
  function fromFMP(symbol, d) {
    const p = (Array.isArray(d.profile) ? d.profile[0] : d.profile) || {};
    const sort = x => Array.isArray(x) ? x.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
    const IS = sort(d.incomeA), BSa = sort(d.balanceA), CFa = sort(d.cashA);
    if (!IS.length) throw new Error(`The provider returned no annual income statements for ${symbol}.`);
    const company = { name: p.companyName || null, ticker: p.symbol || symbol, cik: p.cik ? String(p.cik).padStart(10, '0') : null, exchange: p.exchange || p.exchangeShortName || null, industry: p.industry || null, fyEnd: null, currency: (IS[IS.length - 1] && IS[IS.length - 1].reportedCurrency) || p.currency || 'USD' };
    const periods = IS.slice(-5).map(r => ({ id: 'FY' + (r.fiscalYear || r.calendarYear || String(r.date).slice(0, 4)), label: 'FY' + (r.fiscalYear || r.calendarYear || String(r.date).slice(0, 4)), end: r.date, kind: 'FY', filed: r.filingDate || r.fillingDate || null, accn: null, form: '10-K', url: r.finalLink || r.link || null }));
    const cells = {}; const notes = [];
    const src = (row, field, st, raw) => ({ provider: 'Financial Modeling Prep', cat: 'vendor', company: company.name, ticker: company.ticker, cik: company.cik, field, statement: st, period: 'fiscal year ended ' + row.date, end: row.date, filed: row.filingDate || row.fillingDate || null, url: row.finalLink || row.link || null, raw, rawUnit: row.reportedCurrency || 'USD', unit: '$ millions', retrieved: today(), definition: 'Provider-standardised statement line. Its classification can differ from the company\'s presentation: check against the filing.' });
    const tables = { IS, BS: BSa, CF: CFa };
    Object.entries(FMP).forEach(([key, [st, field, sign]]) => {
      cells[key] = {};
      periods.forEach(pp => {
        const row = tables[st].find(r => r.date === pp.end) || tables[st].find(r => Math.abs(days(r.date, pp.end)) < 10);
        if (!row || row[field] === null || row[field] === undefined || row[field] === '') return;
        const raw = Number(row[field]); if (!isFinite(raw)) return;
        const perShare = sign === 1 && (field === 'eps' || field === 'epsDiluted');
        const v = perShare ? raw : (sign === -1 ? -raw : raw) / 1e6;
        cells[key][pp.id] = { v: field.startsWith('weighted') ? raw / 1e6 : v, src: src(row, field, st, raw) };
      });
    });
    // FMP reports buybacks, dividends, capex as negative cash flows: shown here as positive amounts with the cash flow sign applied in the statements
    ['capex', 'acq', 'invBuy', 'buyback', 'div', 'treas'].forEach(k => Object.values(cells[k] || {}).forEach(c => { c.v = Math.abs(c.v); }));
    periods.forEach(pp => classify(cells, pp.id, notes, r => Object.assign({ provider: 'Calculated from Financial Modeling Prep', company: company.name, ticker: company.ticker, retrieved: today() }, r)));
    // TTM from quarterly statements, when the provider returned them
    let ttm = null;
    const qIS = sort(d.incomeQ), qCF = sort(d.cashQ), qBS = sort(d.balanceQ);
    const fyRow = IS[IS.length - 1];
    if (qIS.length && fyRow) {
      const after = qIS.filter(q => q.date > fyRow.date);
      if (after.length) {
        const prior = after.map(q => qIS.find(x => Math.abs(days(x.date, q.date) - 365) <= 10));
        if (prior.every(Boolean)) {
          const end = after[after.length - 1].date;
          ttm = { id: 'TTM', label: 'TTM ' + end, end, kind: 'TTM', bsEnd: null, note: `Twelve months ended ${end}, from the provider's quarterly statements: FY + quarters since − the same quarters a year earlier.` };
          const flow = (rows, field) => { const a = after.map(q => rows.find(r => r.date === q.date)), b = prior.map(q => rows.find(r => r.date === q.date)); const fy = (rows === qCF ? CFa : IS).find(r => r.date === fyRow.date); if (!fy || a.some(x => !x) || b.some(x => !x)) return null; const vals = [fy].concat(a, b).map(r => Number(r[field])); if (vals.some(v => !isFinite(v))) return null; return (vals[0] + a.reduce((s, r) => s + Number(r[field]), 0) - b.reduce((s, r) => s + Number(r[field]), 0)); };
          Object.entries(FMP).forEach(([key, [st, field, sign]]) => {
            if (st === 'BS') { const r = qBS.filter(x => x.date > fyRow.date).slice(-1)[0]; if (r && r[field] !== null && r[field] !== undefined && isFinite(Number(r[field]))) { const raw = Number(r[field]); let v = (sign === -1 ? -raw : raw) / 1e6; if (key === 'treas') v = Math.abs(v); cells[key].TTM = { v, src: Object.assign(src(r, field, st, raw), { period: 'as of ' + r.date }) }; ttm.bsEnd = r.date; } return; }
            if (field === 'eps' || field === 'epsDiluted' || field.startsWith('weighted')) return;
            const raw = flow(st === 'CF' ? qCF : qIS, field); if (raw === null) return;
            let v = (sign === -1 ? -raw : raw) / 1e6; if (['capex', 'acq', 'invBuy', 'buyback', 'div'].includes(key)) v = Math.abs(v);
            cells[key].TTM = { v, src: { provider: 'Calculated from Financial Modeling Prep', cat: 'calc', company: company.name, ticker: company.ticker, field, statement: st, period: 'twelve months ended ' + end, end, unit: '$ millions', method: ttm.note, retrieved: today() } };
          });
          classify(cells, 'TTM', notes, r => Object.assign({ provider: 'Calculated from Financial Modeling Prep', company: company.name, ticker: company.ticker, retrieved: today() }, r));
        }
      }
    }
    if (!ttm) notes.push('The provider returned no quarterly statements after the last fiscal year (some plans do not include them): there is no TTM column. Load the SEC company facts file for a TTM column built from the 10-Q.');
    notes.push('Financial Modeling Prep statements are standardised by the provider. Where a line is classified differently from the filing, the SEC company facts import is the primary source.');
    const refs = {};
    if (p.price) refs.price = { v: Number(p.price), src: { provider: 'Financial Modeling Prep', cat: 'market', period: 'quote ' + today(), unit: 'USD per share', retrieved: today() } };
    return { providerId: 'fmp', meta: { company, provider: 'Financial Modeling Prep', retrieved: new Date().toISOString() }, periods, ttm, cells, refs, notes };
  }
  async function fetchFMP(symbol, key, fetchFn = fetch) {
    const s = encodeURIComponent(symbol);
    const profile = await fmpGet(`profile?symbol=${s}`, key, fetchFn);
    if (!profile || (Array.isArray(profile) && !profile.length)) throw new Error(`No company found for "${symbol}".`);
    const calls = { incomeA: `income-statement?symbol=${s}&period=annual&limit=5`, balanceA: `balance-sheet-statement?symbol=${s}&period=annual&limit=5`, cashA: `cash-flow-statement?symbol=${s}&period=annual&limit=5`,
      incomeQ: `income-statement?symbol=${s}&period=quarter&limit=8`, balanceQ: `balance-sheet-statement?symbol=${s}&period=quarter&limit=2`, cashQ: `cash-flow-statement?symbol=${s}&period=quarter&limit=8` };
    const keys = Object.keys(calls);
    const res = await Promise.all(keys.map(k => fmpGet(calls[k], key, fetchFn, true)));
    const d = { profile }; keys.forEach((k, i) => { d[k] = res[i] && res[i].__error ? null : res[i]; });
    const out = fromFMP(symbol, d);
    keys.forEach((k, i) => { if (res[i] && res[i].__error) out.notes.push(`The provider did not return ${k}: ${res[i].__error}`); });
    return out;
  }

  // ---------- apply an import to a model (never overwrites manual figures) ----------
  // Manual cells keep their value; a different imported value is recorded as a proposal on the cell for review.
  function apply(model, imp) {
    const h = model.hist;
    const res = { filled: 0, kept: 0, proposed: 0 };
    h.periods = imp.periods.map(p => Object.assign({}, p));
    h.ttm = imp.ttm ? Object.assign({}, imp.ttm) : null;
    const old = h.cells || {};
    const cells = {};
    Object.entries(imp.cells).forEach(([k, byP]) => {
      cells[k] = {};
      Object.entries(byP).forEach(([pid, c]) => { cells[k][pid] = { v: c.v, src: c.src }; res.filled++; });
    });
    // keep manual entries and classifications
    Object.entries(old).forEach(([k, byP]) => Object.entries(byP || {}).forEach(([pid, c]) => {
      if (!c || !c.manual) return;
      cells[k] = cells[k] || {};
      const imported = cells[k][pid];
      if (imported && isNum(imported.v) && Math.abs(imported.v - c.v) > 1e-6) { c.proposed = { v: imported.v, src: imported.src }; res.proposed++; }
      cells[k][pid] = c; res.kept++;
    }));
    h.cells = cells; h.refs = Object.assign({}, h.refs || {}, imp.refs || {});
    h.notes = imp.notes.slice(); h.provider = imp.meta.provider; h.retrieved = imp.meta.retrieved; h.filings = imp.meta.filings || null; h.providerId = imp.providerId;
    const c = imp.meta.company;
    Object.keys(c).forEach(k => { if (c[k] && !model.company[k + 'Manual']) model.company[k] = c[k]; });
    return res;
  }
  // a manual figure: keeps the imported one for reference and audit
  function setManual(model, key, pid, v, note) {
    const h = model.hist; h.cells[key] = h.cells[key] || {};
    const prev = h.cells[key][pid];
    if (v === null) { if (prev && prev.manual) { if (prev.orig) h.cells[key][pid] = prev.orig; else delete h.cells[key][pid]; } return; }
    h.cells[key][pid] = { v, manual: true, note: note || '', at: new Date().toISOString(), orig: prev && !prev.manual ? prev : (prev && prev.orig) || null, src: { provider: 'Analyst', cat: 'manual', method: note || 'Entered by the analyst', unit: '$ millions', retrieved: today() } };
  }
  // re-derive the calculated lines after a manual change (residuals depend on the reported figures)
  function reclassify(model) {
    const h = model.hist; const notes = [];
    const pids = h.periods.map(p => p.id).concat(h.ttm ? ['TTM'] : []);
    const derived = ['oca', 'olta', 'te', 'oeq', 'tl', 'ltd', 'accr', 'ocl', 'oltl', 'debtIss', 'debtRep', 'invNet'];
    pids.forEach(pid => {
      derived.forEach(k => { const c = h.cells[k] && h.cells[k][pid]; if (c && !c.manual && c.src && c.src.cat === 'calc') delete h.cells[k][pid]; });
      classify(h.cells, pid, notes, r => Object.assign({ provider: 'Calculated', retrieved: today() }, r));
      // a manual figure always wins over a recalculated one
    });
    return notes;
  }

  // ---------- from a DCF model: company details and market data only ----------
  function fromDCF(dcf) {
    const I = dcf.inputs || {}, C = I.company || {};
    return { name: C.name || null, ticker: C.ticker || null, cik: (dcf.meta && dcf.meta.cik) || null, industry: C.industry || null, currency: C.currency || 'USD', price: isNum(I.price) ? I.price : null, priceDate: (dcf.asOf && dcf.asOf.price) || C.valDate || null, sharesCover: isNum(I.basic) ? I.basic : null, valDate: C.valDate || null, dcfId: dcf.id, dcfName: dcf.name };
  }

  return { MAP, REFS, fromSEC, fromFMP, fetchFMP, apply, setManual, reclassify, classify, fromDCF };
})();
if (typeof module !== 'undefined') module.exports = FsmData;
