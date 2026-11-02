// ===== OPERATING WORKING CAPITAL (no UI, no network) =====
// Reads the working-capital lines a company reports in its cash flow statement ("Changes in operating assets and
// liabilities") from an SEC company facts file, keeps each line's reported cash flow sign and source, classifies
// it, and adds up three separate figures:
//   1. the sum of every reported change line,
//   2. the sum of lines clearly classified as operating working capital,
//   3. the analyst-adjusted DCF cash flow effect (lines the analyst includes, plus their own adjustments).
// It also measures operating NWC on the balance sheet at two dates, builds the history table, and holds the
// arithmetic for the learning calculator and the forecasting worksheet. Nothing here guesses: a line that is not
// in the file is missing (null), never zero.
const DCFNwc = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  const Sec = () => (typeof DCFSec !== 'undefined' ? DCFSec : require('./sec.js'));

  // ---- the tags companies use for working-capital change lines ----
  // side: A = an asset (XBRL reports an increase as positive, which used cash: cash flow sign = −value)
  //       L = a liability (an increase is positive and provided cash: cash flow sign = +value)
  //       N = net operating capital (assets − liabilities; an increase used cash: −value)
  // cls:  core = clearly operating working capital; review = mixed or uncertain, the analyst decides;
  //       exclude = not operating working capital for a DCF; total = a reported total of the other lines.
  const TAGS = {
    IncreaseDecreaseInAccountsReceivable: { label: 'Accounts receivable', side: 'A', cls: 'core', why: 'Money customers owe for sales already made: operating working capital.' },
    IncreaseDecreaseInAccountsAndOtherReceivables: { label: 'Accounts and other receivables', side: 'A', cls: 'core', check: 'The label includes "other" receivables. Check the receivables note for non-operating items (for example tax refunds or loans).', why: 'Mainly customer receivables.' },
    IncreaseDecreaseInAccountsReceivableAndOtherOperatingAssets: { label: 'Accounts receivable and other', side: 'A', cls: 'core', check: 'The label includes "other". Amazon\'s line is "Accounts receivable, net and other". Check the note for anything that is not a customer or vendor receivable.', why: 'Mainly customer and vendor receivables.' },
    IncreaseDecreaseInReceivables: { label: 'Receivables', side: 'A', cls: 'core', why: 'Customer receivables.' },
    IncreaseDecreaseInOtherReceivables: { label: 'Other receivables', side: 'A', cls: 'review', why: 'Can be vendor (non-trade) receivables, which are operating, or tax, loan and other items, which are not. Read the note.' },
    IncreaseDecreaseInInventories: { label: 'Inventories', side: 'A', cls: 'core', why: 'Goods bought or made and not yet sold: operating working capital.' },
    IncreaseDecreaseInRetailRelatedInventories: { label: 'Inventories (retail)', side: 'A', cls: 'core', why: 'Merchandise inventory: operating working capital.' },
    IncreaseDecreaseInPrepaidExpense: { label: 'Prepaid expenses', side: 'A', cls: 'core', why: 'Operating costs paid in advance (rent, insurance, licences).' },
    IncreaseDecreaseInContractWithCustomerAsset: { label: 'Contract assets', side: 'A', cls: 'core', why: 'Revenue earned but not yet billable: operating.' },
    IncreaseDecreaseInAccountsPayable: { label: 'Accounts payable', side: 'L', cls: 'core', why: 'Money owed to suppliers: operating financing of working capital.' },
    IncreaseDecreaseInAccountsPayableTrade: { label: 'Trade accounts payable', side: 'L', cls: 'core', why: 'Money owed to suppliers.' },
    IncreaseDecreaseInAccruedLiabilities: { label: 'Accrued liabilities', side: 'L', cls: 'core', check: 'Accrued interest is a financing item. Check the accrued liabilities note if interest accruals are large.', why: 'Operating expenses recognised but not yet paid (wages, utilities, services).' },
    IncreaseDecreaseInEmployeeRelatedLiabilities: { label: 'Accrued compensation', side: 'L', cls: 'core', why: 'Wages and benefits earned by employees and not yet paid.' },
    IncreaseDecreaseInAccruedSalaries: { label: 'Accrued salaries', side: 'L', cls: 'core', why: 'Wages earned and not yet paid.' },
    IncreaseDecreaseInAccountsPayableAndAccruedLiabilities: { label: 'Accounts payable and accrued liabilities', side: 'L', cls: 'core', check: 'A combined line. Do not add separate payables or accruals for the same period as well.', why: 'Supplier payables and operating accruals together.' },
    IncreaseDecreaseInContractWithCustomerLiability: { label: 'Deferred (unearned) revenue', side: 'L', cls: 'core', why: 'Cash customers paid before the company delivered: operating.' },
    IncreaseDecreaseInDeferredRevenue: { label: 'Deferred revenue', side: 'L', cls: 'core', why: 'Cash received before the revenue is earned: operating.' },
    // mixed or uncertain
    IncreaseDecreaseInOtherOperatingAssets: { label: 'Other operating assets', side: 'A', cls: 'review', why: 'A grouped line. It can hold current and noncurrent items, some not working capital. Read the note.' },
    IncreaseDecreaseInOtherCurrentAssets: { label: 'Other current assets', side: 'A', cls: 'review', why: 'Current, but grouped: prepaid items are operating, derivative or tax assets usually are not.' },
    IncreaseDecreaseInPrepaidDeferredExpenseAndOtherAssets: { label: 'Prepaid expenses and other assets', side: 'A', cls: 'review', why: 'Prepaid expenses are operating; "other assets" may be long-term or non-operating.' },
    IncreaseDecreaseInInventoriesAndOtherOperatingAssets: { label: 'Inventories and other operating assets', side: 'A', cls: 'review', why: 'Inventory is operating; "other" must be checked.' },
    IncreaseDecreaseInOtherNoncurrentAssets: { label: 'Other assets (noncurrent)', side: 'A', cls: 'review', noncurrent: true, why: 'Tagged as noncurrent. Long-term items are usually not working capital, though some (long-term prepaid or capitalised contract costs) are operating. Read the "Other assets" note.' },
    IncreaseDecreaseInOtherOperatingLiabilities: { label: 'Other operating liabilities', side: 'L', cls: 'review', why: 'A grouped line that can include lease, tax and other items. Read the note.' },
    IncreaseDecreaseInOtherCurrentLiabilities: { label: 'Other current liabilities', side: 'L', cls: 'review', why: 'Current, but grouped. Check for interest, dividends or debt-like items.' },
    IncreaseDecreaseInOperatingLiabilities: { label: 'Operating liabilities', side: 'L', cls: 'review', why: 'A grouped operating liabilities line.' },
    IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities: { label: 'Accrued expenses and other', side: 'L', cls: 'review', why: 'Operating accruals mixed with other liabilities. Amazon\'s line includes items such as current lease liabilities and other accruals that need classifying.' },
    IncreaseDecreaseInAccountsPayableAndOtherOperatingLiabilities: { label: 'Accounts payable and other liabilities', side: 'L', cls: 'review', why: 'Payables are operating; "other" liabilities must be checked.' },
    IncreaseDecreaseInOtherNoncurrentLiabilities: { label: 'Other liabilities (noncurrent)', side: 'L', cls: 'review', noncurrent: true, why: 'Tagged as noncurrent. Long-term items are usually not working capital.' },
    IncreaseDecreaseInOtherOperatingCapitalNet: { label: 'Other operating assets and liabilities, net', side: 'N', cls: 'review', why: 'Several assets and liabilities netted into one line. Read the note before including it.' },
    IncreaseDecreaseInSelfInsuranceReserve: { label: 'Self-insurance reserves', side: 'L', cls: 'review', why: 'An operating accrual for some, a long-term reserve for others.' },
    IncreaseDecreaseInAccruedIncomeTaxesPayable: { label: 'Accrued income taxes', side: 'L', cls: 'review', why: 'Taxes are taken off NOPAT at a tax rate in the forecast. Including tax payables in working capital can count the timing of tax twice; many analysts leave them out.' },
    IncreaseDecreaseInAccruedTaxesPayable: { label: 'Accrued taxes', side: 'L', cls: 'review', why: 'Taxes: decide whether your tax rate already covers their timing.' },
    IncreaseDecreaseInIncomeTaxesPayable: { label: 'Income taxes payable', side: 'L', cls: 'review', why: 'Taxes: decide whether your tax rate already covers their timing.' },
    IncreaseDecreaseInIncomeTaxesReceivable: { label: 'Income taxes receivable', side: 'A', cls: 'review', why: 'Taxes: decide whether your tax rate already covers their timing.' },
    // not operating working capital
    IncreaseDecreaseInFinanceReceivables: { label: 'Finance receivables', side: 'A', cls: 'exclude', why: 'Loans made by a finance arm (for example Ford Credit). A financing business, valued separately, not operating working capital.' },
    IncreaseDecreaseInInterestPayableNet: { label: 'Interest payable', side: 'L', cls: 'exclude', why: 'Interest is paid to lenders: a financing item. FCFF is before interest.' },
    IncreaseDecreaseInPensionPlanObligations: { label: 'Pension obligations', side: 'L', cls: 'exclude', why: 'A debt-like claim handled in the equity bridge, not working capital.' },
    // reported totals
    IncreaseDecreaseInOperatingCapital: { label: 'Total change in operating assets and liabilities (reported total)', side: 'N', cls: 'total', why: 'The company\'s own total of its working-capital lines. Shown as a check; it may use a wider definition than operating NWC.' },
  };
  // Tags that look like working capital but are not changes in operating assets and liabilities
  const SKIP = { IncreaseDecreaseInDeferredIncomeTaxes: 'a noncash adjustment, not working capital', IncreaseDecreaseInOutstandingChecksFinancingActivities: 'a financing activity', IncreaseDecreaseInRestrictedCash: 'cash, not working capital' };
  // combined lines and the lines they contain: when both appear for one period, the parts are details (not added again)
  const PARENTS = {
    IncreaseDecreaseInAccountsPayableAndAccruedLiabilities: ['IncreaseDecreaseInAccountsPayable', 'IncreaseDecreaseInAccountsPayableTrade', 'IncreaseDecreaseInAccruedLiabilities', 'IncreaseDecreaseInEmployeeRelatedLiabilities', 'IncreaseDecreaseInAccruedSalaries'],
    IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities: ['IncreaseDecreaseInAccruedLiabilities', 'IncreaseDecreaseInOtherOperatingLiabilities', 'IncreaseDecreaseInEmployeeRelatedLiabilities', 'IncreaseDecreaseInAccruedSalaries'],
    IncreaseDecreaseInAccountsPayableAndOtherOperatingLiabilities: ['IncreaseDecreaseInAccountsPayable', 'IncreaseDecreaseInAccountsPayableTrade', 'IncreaseDecreaseInOtherOperatingLiabilities', 'IncreaseDecreaseInAccruedLiabilities'],
    IncreaseDecreaseInReceivables: ['IncreaseDecreaseInAccountsReceivable', 'IncreaseDecreaseInOtherReceivables'],
    IncreaseDecreaseInAccountsAndOtherReceivables: ['IncreaseDecreaseInAccountsReceivable', 'IncreaseDecreaseInOtherReceivables'],
    IncreaseDecreaseInAccountsReceivableAndOtherOperatingAssets: ['IncreaseDecreaseInAccountsReceivable', 'IncreaseDecreaseInOtherOperatingAssets'],
    IncreaseDecreaseInPrepaidDeferredExpenseAndOtherAssets: ['IncreaseDecreaseInPrepaidExpense', 'IncreaseDecreaseInOtherCurrentAssets'],
    IncreaseDecreaseInInventoriesAndOtherOperatingAssets: ['IncreaseDecreaseInInventories', 'IncreaseDecreaseInOtherOperatingAssets'],
  };
  const CLS_TXT = { core: 'Operating working capital', review: 'Mixed or uncertain: needs review', exclude: 'Not operating working capital', total: 'Reported total (check only)', detail: 'Part of a combined line (not added again)', adj: 'Analyst adjustment' };
  const SUBSET = /^IncreaseDecreaseIn(AccountsReceivable|AccountsAndOtherReceivables|AccountsReceivableAndOtherOperatingAssets|Receivables|Inventories|RetailRelatedInventories|AccountsPayable|AccountsPayableTrade)$/;
  const cfSign = (side, val) => side === 'L' ? val : -val;

  // every IncreaseDecrease* fact in the file with a duration
  function wcFacts(json) {
    const g = (json && json.facts && json.facts['us-gaap']) || {}, out = [];
    Object.keys(g).forEach(c => {
      if (!/^IncreaseDecrease/.test(c) || SKIP[c]) return;
      (g[c].units && g[c].units.USD || []).forEach(x => { if (x.start && /^10-[KQ]/.test(x.form || '') && isNum(x.val)) out.push(Object.assign({ concept: c, pt: Sec().periodType(x) }, x)); });
    });
    return out;
  }

  // Lines for one period, all from ONE filing, so a tag the company has since replaced is not added twice.
  function buildLines(facts, accn, start, end, L, cik, extra) {
    const xs = facts.filter(x => x.accn === accn && x.end === end && x.start === start);
    const by = {};
    xs.forEach(x => { if (!by[x.concept] || String(x.filed) > String(by[x.concept].filed)) by[x.concept] = x; });
    const f = (L && L.all.find(y => y.accn === accn)) || {};
    const url = f.url || Sec().indexUrl(cik, accn);
    const lines = Object.values(by).map(x => {
      const t = TAGS[x.concept];
      const raw = x.val / 1e6;
      return {
        id: x.concept, concept: 'us-gaap:' + x.concept, label: t ? t.label : x.concept.replace(/^IncreaseDecreaseIn/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
        raw, cf: t ? cfSign(t.side, raw) : null, side: t ? t.side : null, cls: t ? t.cls : 'review', autoCls: t ? t.cls : 'review',
        why: t ? t.why : 'This tag is not one the calculator recognises, so its cash flow sign is not verified. Read the line in the filing and type the amount with its cash flow sign as an adjustment.',
        check: t && t.check || '', noncurrent: !!(t && t.noncurrent), unknown: !t,
        statement: 'Consolidated statements of cash flows: operating activities, changes in operating assets and liabilities',
        form: x.form, accn, filed: x.filed, start, end, url, extra: extra || null,
      };
    });
    // a combined line and its parts in the same period: keep the combined line, mark the parts as details
    lines.forEach(l => { const kids = PARENTS[l.id]; if (!kids) return; lines.forEach(k => { if (k !== l && kids.includes(k.id) && k.cls !== 'total') { k.cls = k.autoCls = 'detail'; k.parent = l.id; k.why = `Included in "${l.label}" for the same period. Adding it again would count it twice.`; } }); });
    const order = { core: 0, review: 1, exclude: 2, detail: 3, total: 4 };
    lines.sort((a, b) => (order[a.cls] - order[b.cls]) || Math.abs(b.cf || 0) - Math.abs(a.cf || 0));
    return lines;
  }

  // ---- from an SEC company facts file: every fiscal year the file covers, and TTM ----
  function fromSec(json, o = {}) {
    const S = Sec(), L = o.L || S.latest(json), cik = json && json.cik;
    const facts = wcFacts(json);
    const periods = {};
    // fiscal years: for each fiscal-year end, the most recent 10-K that reports working-capital lines for it
    const fy = facts.filter(x => x.pt === 'FY' && /^10-K/.test(x.form));
    const ends = [...new Set(fy.map(x => x.end))].sort().reverse();
    const want = o.ends && o.ends.length ? o.ends : ends.slice(0, 5);
    want.forEach(end => {
      const xs = fy.filter(x => x.end === end); if (!xs.length) return;
      const top = xs.slice().sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0];
      const start = top.start;
      const lines = buildLines(facts, top.accn, start, end, L, cik);
      periods['FY' + end.slice(0, 4)] = { key: 'FY' + end.slice(0, 4), kind: 'FY', label: 'Fiscal year ended ' + end, start, end, form: top.form, accn: top.accn, filed: top.filed, url: lines[0] ? lines[0].url : S.indexUrl(cik, top.accn), lines };
    });
    // TTM: a reported twelve-month column in the latest 10-Q if the company shows one (Amazon does),
    // otherwise latest fiscal year + year to date − prior year to date, line by line, with all three parts shown
    const q = facts.filter(x => /^10-Q/.test(x.form));
    const latestEnd = q.length ? q.map(x => x.end).sort().reverse()[0] : null;
    const fyLatest = ends[0];
    if (latestEnd && fyLatest && latestEnd > fyLatest) {
      const qx = q.filter(x => x.end === latestEnd);
      const accn = qx.slice().sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0].accn;
      const t12 = qx.filter(x => x.accn === accn && x.pt === 'T12');
      const fyKey = 'FY' + fyLatest.slice(0, 4), FYP = periods[fyKey] || (() => { const xs = fy.filter(x => x.end === fyLatest); const top = xs.sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0]; return { lines: buildLines(facts, top.accn, top.start, fyLatest, L, cik), end: fyLatest, accn: top.accn, url: '' }; })();
      if (t12.length) {
        const start = t12[0].start;
        const lines = buildLines(facts, accn, start, latestEnd, L, cik);
        periods.TTM = { key: 'TTM', kind: 'TTM', reported: true, label: 'Twelve months ended ' + latestEnd + ' (reported in the 10-Q)', start, end: latestEnd, form: qx[0].form, accn, filed: qx[0].filed, url: lines[0] ? lines[0].url : S.indexUrl(cik, accn), lines,
          method: 'The 10-Q reports a twelve-month cash flow column, so these are reported figures, not calculated.' };
      } else {
        const ytd = qx.filter(x => x.accn === accn && ['Q', 'H1', '9M'].includes(x.pt) && Math.abs(days(fyLatest, x.start)) <= 10);
        if (ytd.length) {
          const ys = ytd[0].start, pt = ytd[0].pt;
          const prior = q.filter(x => x.accn === accn && x.pt === pt && Math.abs(days(x.end, latestEnd) - 365) <= 8 && Math.abs(days(x.start, ys) - 365) <= 8);
          const cur = buildLines(facts, accn, ys, latestEnd, L, cik);
          const pr = prior.length ? buildLines(facts, accn, prior[0].start, prior[0].end, L, cik) : [];
          const lines = cur.map(l => {
            const f = FYP.lines.find(x => x.id === l.id), p = pr.find(x => x.id === l.id);
            const ok = f && p && isNum(l.cf) && isNum(f.cf) && isNum(p.cf);
            return Object.assign({}, l, { raw: ok ? f.raw + l.raw - p.raw : null, cf: ok ? f.cf + l.cf - p.cf : null, calc: true, parts: [f ? { what: 'Fiscal year', end: FYP.end, cf: f.cf, accn: f.accn, url: f.url } : null, { what: S.PT_TEXT[pt] + ' ' + latestEnd, end: latestEnd, cf: l.cf, accn, url: l.url }, p ? { what: S.PT_TEXT[pt] + ' ' + p.end, end: p.end, cf: p.cf, accn, url: p.url } : null],
              missingPart: !ok, why: l.why + (ok ? '' : ' One of the three figures is not in the file for this tag, so the TTM amount is left blank.') });
          });
          periods.TTM = { key: 'TTM', kind: 'TTM', reported: false, label: 'Twelve months ended ' + latestEnd + ' (calculated)', start: null, end: latestEnd, form: qx[0].form, accn, filed: qx[0].filed, url: cur[0] ? cur[0].url : '', lines,
            method: `TTM = fiscal year ended ${fyLatest} + ${S.PT_TEXT[pt]} ${latestEnd} − the same period a year earlier, for each line. Calculated, not reported.` };
        }
      }
    }
    const bs = {};
    const bsEnds = new Set();
    Object.values(periods).forEach(p => { bsEnds.add(p.end); const b = priorEnd(json, p.end, p.kind === 'TTM'); if (b) bsEnds.add(b); });
    bsEnds.forEach(e => { const r = balanceSheet(json, e, L); if (r) bs[e] = r; });
    return { cik: cik || null, entity: json.entityName || null, at: o.at || null, periods, bs, finArm: facts.some(x => x.concept === 'IncreaseDecreaseInFinanceReceivables') };
  }

  // ---- balance-sheet method: operating NWC at one date ----
  // Noncash operating current assets − nondebt operating current liabilities, from the totals so nothing is left out:
  // (total current assets − cash − restricted cash − short-term investments) − (total current liabilities − short-term
  // debt − current portion of long-term debt − current lease liabilities).
  const BSR = {
    ca: ['AssetsCurrent'], cash: ['CashAndCashEquivalentsAtCarryingValue'], rcash: ['RestrictedCashCurrent'], sti: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    cl: ['LiabilitiesCurrent'], debtCur: ['DebtCurrent'], ltdCur: ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'], stb: ['ShortTermBorrowings'], cp: ['CommercialPaper'], olCur: ['OperatingLeaseLiabilityCurrent'], flCur: ['FinanceLeaseLiabilityCurrent'],
    ar: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'], ntr: ['NontradeReceivablesCurrent'], inv: ['InventoryNet', 'RetailRelatedInventoryMerchandise'], prep: ['PrepaidExpenseAndOtherAssetsCurrent', 'PrepaidExpenseCurrent'], oca: ['OtherAssetsCurrent'],
    ap: ['AccountsPayableCurrent'], apal: ['AccountsPayableAndAccruedLiabilitiesCurrent'], acc: ['AccruedLiabilitiesCurrent'], emp: ['EmployeeRelatedLiabilitiesCurrent'], def: ['ContractWithCustomerLiabilityCurrent', 'DeferredRevenueCurrent'], tax: ['AccruedIncomeTaxesCurrent', 'TaxesPayableCurrent'], ocl: ['OtherLiabilitiesCurrent'],
  };
  const BS_LABEL = { ca: 'Total current assets', cash: 'Cash and cash equivalents', rcash: 'Restricted cash (current)', sti: 'Short-term investments / marketable securities', cl: 'Total current liabilities', debtCur: 'Current debt (total)', ltdCur: 'Current portion of long-term debt', stb: 'Short-term borrowings', cp: 'Commercial paper', olCur: 'Current operating lease liabilities', flCur: 'Current finance lease liabilities',
    ar: 'Accounts receivable', ntr: 'Vendor non-trade receivables', inv: 'Inventories', prep: 'Prepaid expenses and other current assets', oca: 'Other current assets', ap: 'Accounts payable', apal: 'Accounts payable and accrued liabilities', acc: 'Accrued expenses', emp: 'Accrued compensation', def: 'Deferred (unearned) revenue', tax: 'Income taxes payable', ocl: 'Other current liabilities' };
  function inst(json, cs, end) {
    const S = Sec();
    for (const c of cs) { const e = S.entries(json, c, 'USD').filter(x => x.pt === 'instant' && x.end === end).sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0]; if (e) return { v: e.val / 1e6, concept: 'us-gaap:' + c, accn: e.accn, form: e.form, filed: e.filed }; }
    return null;
  }
  function balanceSheet(json, end, L) {
    const g = {}; Object.keys(BSR).forEach(k => { g[k] = inst(json, BSR[k], end); });
    if (!g.ca || !g.cl) return null;
    const v = k => g[k] ? g[k].v : 0;
    // current debt: one total if the company tags it, else the parts (commercial paper only when no short-term borrowings line, which usually holds it)
    const debt = g.debtCur ? v('debtCur') : v('ltdCur') + (g.stb ? v('stb') : v('cp'));
    const opCA = v('ca') - v('cash') - v('rcash') - v('sti');
    const opCL = v('cl') - debt - v('olCur') - v('flCur');
    const accn = g.ca.accn, f = (L && L.all.find(y => y.accn === accn)) || {};
    return { end, values: Object.fromEntries(Object.entries(g).filter(([, x]) => x).map(([k, x]) => [k, x.v])), tags: Object.fromEntries(Object.entries(g).filter(([, x]) => x).map(([k, x]) => [k, x.concept])),
      debt, opCA, opCL, opNwc: opCA - opCL, reportedNwc: v('ca') - v('cl'), accn, form: g.ca.form, filed: g.ca.filed, url: f.url || Sec().indexUrl(json.cik, accn),
      method: 'Operating NWC = (total current assets − cash − restricted cash − short-term investments) − (total current liabilities − current debt − current lease liabilities).' };
  }
  // the balance-sheet date a year before (fiscal year: the prior fiscal year end; TTM: the same quarter a year earlier)
  function priorEnd(json, end) {
    const g = json && json.facts && json.facts['us-gaap'] && json.facts['us-gaap'].AssetsCurrent;
    const list = (g && g.units && g.units.USD) || [];
    const c = list.filter(x => Math.abs(days(x.end, end) - 365) <= 8).map(x => x.end).sort().reverse();
    return c[0] || null;
  }

  // ---- worksheet totals: the three outputs, kept separate ----
  // lines: imported lines; ed: { [id]: { cls, inc, reason } } the analyst's choices; adj: the analyst's own lines
  function effective(l, ed) {
    const e = (ed && ed[l.id]) || {};
    const cls = l.cls === 'detail' || l.cls === 'total' ? l.cls : (e.cls || l.cls);
    const inc = l.cls === 'detail' || l.cls === 'total' ? false : (typeof e.inc === 'boolean' ? e.inc : cls === 'core');
    const amt = isNum(e.amt) ? e.amt : l.cf; // an analyst can type the amount for a tag whose sign is not verified
    return Object.assign({}, l, { cls, inc, cf: amt, reason: e.reason || '', edited: !!(e.cls || typeof e.inc === 'boolean' || isNum(e.amt)) });
  }
  function summary(lines, ed, adj, o = {}) {
    const L = (lines || []).map(l => effective(l, ed));
    const A = (adj || []).map(a => Object.assign({ cls: a.reported ? (a.cls || 'review') : 'adj', inc: a.inc !== false, cf: isNum(a.amt) ? a.amt : null, manual: true }, a));
    const rep = L.filter(l => l.cls !== 'detail' && l.cls !== 'total').concat(A.filter(a => a.reported));
    const known = rep.filter(l => isNum(l.cf));
    const all = known.length ? sum(known.map(l => l.cf)) : null;
    const coreL = rep.filter(l => l.cls === 'core' && isNum(l.cf));
    const core = coreL.length ? sum(coreL.map(l => l.cf)) : null;
    const incl = rep.filter(l => l.inc).concat(A.filter(a => !a.reported && a.inc));
    const adjusted = incl.length && incl.every(l => isNum(l.cf)) ? sum(incl.map(l => l.cf)) : (incl.length ? null : null);
    const scale = Math.max(1, sum(rep.filter(l => isNum(l.cf)).map(l => Math.abs(l.cf))));
    const matPct = isNum(o.material) ? o.material : 0.05;
    const unresolved = rep.filter(l => l.cls === 'review');
    const material = unresolved.filter(l => !isNum(l.cf) || Math.abs(l.cf) >= matPct * scale);
    const missingAmt = incl.filter(l => !isNum(l.cf));
    const total = L.find(l => l.cls === 'total');
    // the narrow core: receivables + inventory + payables only (a partial subset, never the full change)
    const subL = rep.filter(l => SUBSET.test(l.id) && isNum(l.cf));
    const subset = subL.length ? sum(subL.map(l => l.cf)) : null;
    let status = 'empty';
    if (rep.length || A.length) status = material.length || missingAmt.length || rep.some(l => !isNum(l.cf)) ? 'incomplete' : 'complete';
    const msgs = [];
    material.forEach(l => msgs.push(`"${l.label}" (${isNum(l.cf) ? fmt(l.cf) : 'amount not verified'}) is mixed or uncertain. Classify it as operating or not, or exclude it and add the operating part as an adjustment.`));
    missingAmt.forEach(l => msgs.push(`"${l.label}" is included but has no amount.`));
    if (total && isNum(total.cf) && isNum(all) && Math.abs(total.cf - all) > 0.5) msgs.push(`The company's reported total (${fmt(total.cf)}) differs from the sum of the lines found (${fmt(all)}) by ${fmt(total.cf - all)}. Some lines may use company-specific tags that are not in the SEC file: check the cash flow statement.`);
    return { lines: L, adj: A, all, core, subset, subsetLines: subL, adjusted, included: incl, unresolved, material, status, msgs, total: total ? total.cf : null, scale };
  }
  const fmt = v => isNum(v) ? (v < 0 ? '−' : '+') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';

  // What the importer may put in the historical table: only a sum whose lines are all clearly classified
  function importable(p) {
    if (!p || !p.lines || !p.lines.length) return { v: null, reason: 'No working-capital lines were found for this period.' };
    const tot = p.lines.find(l => l.cls === 'total');
    const s = summary(p.lines, {}, []);
    if (s.status === 'complete' && isNum(s.adjusted)) return { v: s.adjusted, s, reason: `Sum of ${s.included.length} clearly operating line${s.included.length > 1 ? 's' : ''}${s.unresolved.length ? `; ${s.unresolved.length} small uncertain line${s.unresolved.length > 1 ? 's were' : ' was'} left out` : ''}.` };
    return { v: null, s, total: tot ? tot.cf : null, reason: `Not filled in: ${s.material.length} material line${s.material.length === 1 ? ' is' : 's are'} mixed or uncertain (${s.material.map(l => l.label).join(', ')}). Open the Change in NWC worksheet to classify ${s.material.length === 1 ? 'it' : 'them'}.` };
  }

  // ---- history: five fiscal years and TTM ----
  // H: model.hist (oldest first); D: model.nwcData; sel: model.nwc.selected; T: TTM column values
  function history(model) {
    const H = model.hist || {}, D = model.nwcData || null, N = model.nwc || {}, edits = N.edits || {}, adjs = N.adj || {};
    const TC = model._ttmCol || null;
    const cols = [];
    for (let i = 4; i >= 0; i--) {
      const y = H.years && H.years[i];
      cols.push({ key: y ? 'FY' + y : null, label: y ? 'FY' + y : '—', i, rev: isNum(H.rev && H.rev[i]) ? H.rev[i] : null, prevRev: i > 0 && isNum(H.rev[i - 1]) ? H.rev[i - 1] : null, sel: isNum(H.dnwc && H.dnwc[i]) ? H.dnwc[i] : null });
    }
    if (TC) cols.unshift({ key: 'TTM', label: 'TTM', i: 't', rev: isNum(TC.rev) ? TC.rev : null, prevRev: isNum(TC.prevRev) ? TC.prevRev : null, sel: isNum(TC.dnwc) ? TC.dnwc : null });
    return cols.map(c => {
      const p = D && c.key && D.periods[c.key];
      const endBs = p && D.bs[p.end], begBs = p && D.bs[priorKey(D, p.end)];
      const s = p ? summary(p.lines, edits[c.key], adjs[c.key]) : null;
      const nwc = endBs ? endBs.opNwc : null, nwcB = begBs ? begBs.opNwc : null;
      const bsChg = isNum(nwc) && isNum(nwcB) ? nwc - nwcB : null;
      const dRev = isNum(c.rev) && isNum(c.prevRev) ? c.rev - c.prevRev : null;
      const small = isNum(dRev) && isNum(c.rev) && Math.abs(dRev) < 0.02 * Math.abs(c.rev);
      return Object.assign(c, { end: p ? p.end : null, nwc, nwcBegin: nwcB, bsChg, reported: s ? s.all : null, core: s ? s.core : null, adjusted: s ? s.adjusted : null, status: s ? s.status : null,
        pctRev: isNum(nwc) && isNum(c.rev) && c.rev ? nwc / c.rev : null, dRev, small,
        incrBs: isNum(bsChg) && isNum(dRev) && dRev !== 0 ? bsChg / dRev : null,
        // forecast sign: investment positive = −(cash flow effect) ÷ change in revenue
        incrSel: isNum(c.sel) && isNum(dRev) && dRev !== 0 ? -c.sel / dRev : null });
    });
  }
  function priorKey(D, end) { const ks = Object.keys(D.bs || {}).filter(e => Math.abs(days(e, end) - 365) <= 8).sort().reverse(); return ks[0] || null; }

  // ---- learning calculator: beginning and ending balances → change, cash effect, FCFF effect ----
  const LEARN = [
    ['ar', 'Accounts receivable', 'A', 'customers owe the company', 'more of your sales have not been collected in cash yet', 'customers paid down what they owed, turning receivables into cash'],
    ['inv', 'Inventory', 'A', 'goods bought or made and not yet sold', 'more cash is tied up in goods on the shelves', 'goods were sold or run down without being replaced, releasing cash'],
    ['oca', 'Other operating current assets', 'A', 'operating costs paid in advance and other operating current assets', 'more cash was paid out in advance', 'prepaid items were used up without being replaced'],
    ['ap', 'Accounts payable', 'L', 'the company owes suppliers', 'suppliers are financing more of the business: cash stays in the company for longer', 'the company paid suppliers faster than it bought from them, using cash'],
    ['acc', 'Accrued operating expenses', 'L', 'expenses recognised but not yet paid (wages, utilities, services)', 'more costs have been recorded but not yet paid in cash', 'the company paid off accrued costs, using cash'],
    ['def', 'Deferred operating revenue', 'L', 'cash customers paid before the company delivered', 'customers paid more in advance than the company delivered', 'the company delivered on earlier prepayments without collecting as much new cash in advance'],
    ['ocl', 'Other operating current liabilities', 'L', 'other nondebt operating liabilities', 'other operating obligations grew without a cash payment', 'other operating obligations were paid down, using cash'],
  ];
  function learn(st) {
    const B = st.begin || {}, E = st.end || {};
    const rows = LEARN.map(([k, label, side, what, up, down]) => {
      const b = B[k], e = E[k];
      const chg = isNum(b) && isNum(e) ? e - b : null;
      const cash = isNum(chg) ? (side === 'A' ? -chg : chg) : null;
      let text = '';
      if (isNum(chg)) {
        const amt = Math.abs(chg).toLocaleString('en-US', { maximumFractionDigits: 1 });
        if (chg === 0) text = `${label} did not change, so it has no cash effect.`;
        else if (side === 'A') text = chg > 0 ? `Your ${label.toLowerCase()} increased by $${amt} million. Assuming no other adjustments, ${up}: $${amt} million more is tied up in ${label.toLowerCase()}, which reduces operating cash flow by $${amt} million.` : `Your ${label.toLowerCase()} decreased by $${amt} million: ${down}. Assuming no other adjustments, operating cash flow rises by $${amt} million.`;
        else text = chg > 0 ? `Your ${label.toLowerCase()} increased by $${amt} million: ${up}. Assuming no other adjustments, this provides $${amt} million of operating cash.` : `Your ${label.toLowerCase()} decreased by $${amt} million: ${down}. Assuming no other adjustments, this uses $${amt} million of cash.`;
      } else text = `Enter both balances for ${label.toLowerCase()} to see its effect.`;
      return { k, label, side, what, b: isNum(b) ? b : null, e: isNum(e) ? e : null, chg, cash, text };
    });
    const tot = side => (which) => { const xs = rows.filter(r => r.side === side).map(r => r[which]); return xs.every(isNum) ? sum(xs) : null; };
    const caB = tot('A')('b'), caE = tot('A')('e'), clB = tot('L')('b'), clE = tot('L')('e');
    const nwcB = isNum(caB) && isNum(clB) ? caB - clB : null, nwcE = isNum(caE) && isNum(clE) ? caE - clE : null;
    const chg = isNum(nwcB) && isNum(nwcE) ? nwcE - nwcB : null;
    const cash = isNum(chg) ? -chg : null;
    const pre = isNum(st.fcffPre) ? st.fcffPre : null;
    return { rows, caB, caE, clB, clE, nwcB, nwcE, chg, cash, fcffPre: pre, fcff: isNum(pre) && isNum(cash) ? pre + cash : null,
      check: isNum(cash) ? Math.abs(sum(rows.map(r => r.cash || 0)) - cash) < 1e-9 : null };
  }
  const LEARN_DEFAULT = () => ({ begin: { ar: 100, inv: 200, oca: 20, ap: 120, acc: 50, def: 30, ocl: 40 }, end: { ar: 150, inv: 260, oca: 25, ap: 160, acc: 65, def: 45, ocl: 42 }, fcffPre: 335 });

  // ---- FCFF with working capital, written two equivalent ways ----
  function fcff(x) {
    const ok = ['ebit', 'tax', 'da', 'capex', 'dnwc'].every(k => isNum(x[k]));
    if (!ok) return null;
    const nopat = x.ebit * (1 - x.tax);
    const f = nopat + x.da - x.capex - x.dnwc; // dnwc: balance-sheet increase in operating NWC (investment positive)
    const cashEffect = -x.dnwc;
    const g = nopat + x.da - x.capex + cashEffect; // the same with the cash flow sign: added, never subtracted again
    return { nopat, fcff: f, cashEffect, fcffCashSign: g, same: Math.abs(f - g) < 1e-9 };
  }

  // ---- forecasting worksheet: two methods ----
  // st: { rev0, rev1, nwc0, pctRev, incr }
  function forecast(st) {
    const { rev0, rev1, nwc0, pctRev, incr } = st || {};
    const dRev = isNum(rev0) && isNum(rev1) ? rev1 - rev0 : null;
    const A = isNum(dRev) && isNum(incr) ? { dNwc: incr * dRev, nwc1: isNum(nwc0) ? nwc0 + incr * dRev : null, ratio: incr } : null;
    const B = isNum(rev1) && isNum(pctRev) && isNum(nwc0) ? { nwc1: pctRev * rev1, dNwc: pctRev * rev1 - nwc0 } : null;
    if (B) B.ratio = isNum(dRev) && dRev !== 0 ? B.dNwc / dRev : null;
    const cur = isNum(nwc0) && isNum(rev0) && rev0 ? nwc0 / rev0 : null;
    const notes = [];
    if (A && B && Math.abs(A.dNwc - B.dNwc) > 1e-6) notes.push(`The two methods differ by ${Math.abs(A.dNwc - B.dNwc).toLocaleString('en-US', { maximumFractionDigits: 1 })} $mm. The %-of-revenue method also moves NWC from today's ${isNum(cur) ? (cur * 100).toFixed(1) + '%' : '?'} of revenue to your selected ${(pctRev * 100).toFixed(1)}%, so it includes a one-off catch-up; the incremental method only prices the new revenue.`);
    if (isNum(dRev) && isNum(rev0) && Math.abs(dRev) < 0.02 * Math.abs(rev0)) notes.push('The change in revenue is small, so the implied incremental ratio of the %-of-revenue method is unstable.');
    return { dRev, A, B, curPct: cur, notes };
  }

  // ---- checks for the forecast assumption against history (sign errors) ----
  function forecastChecks(model) {
    const out = [], v = model.inputs && model.inputs.nwc;
    if (!v) return out;
    const h = history(model).filter(c => c.i !== 't' && isNum(c.incrSel));
    const avg = h.length ? sum(h.map(c => c.incrSel)) / h.length : null;
    ['Base', 'Bear', 'Bull'].forEach(s => {
      const x = v[s]; if (!isNum(x)) return;
      if (isNum(avg) && Math.abs(avg) > 0.02 && Math.sign(x) !== Math.sign(avg) && Math.abs(Math.abs(x) / Math.abs(avg) - 1) < 0.25) out.push({ level: 'warn', s, text: `${s}: ${(x * 100).toFixed(1)}% has the opposite sign to your historical average of ${(avg * 100).toFixed(1)}% with almost the same size. This is the classic sign error: the forecast input is investment-positive (−cash flow effect ÷ change in revenue).` });
    });
    return out;
  }

  return { TAGS, SKIP, PARENTS, CLS_TXT, LEARN, LEARN_DEFAULT, wcFacts, fromSec, balanceSheet, BS_LABEL, summary, effective, importable, history, learn, fcff, forecast, forecastChecks, cfSign, fmt, isNum };
})();
if (typeof module !== 'undefined') module.exports = DCFNwc;
