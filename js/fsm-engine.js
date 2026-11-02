// ===== THREE-STATEMENT MODEL ENGINE (pure functions; no UI, no network) =====
// Forecasts a linked income statement, balance sheet and cash flow statement for ten years, per scenario,
// with supporting schedules (working capital, PP&E and depreciation, intangibles, debt and interest, leases,
// taxes and deferred taxes, equity and shares). Cash comes only from the cash flow statement: nothing is
// plugged to force the balance sheet to balance, so every imbalance shows up in the checks.
// All amounts are in millions of the reporting currency; shares in millions; rates as decimals.
const FsmEngine = (() => {
  const SC = ['Base', 'Bear', 'Bull'];
  const N = 10;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const sum = a => a.reduce((x, y) => x + (isNum(y) ? y : 0), 0);
  const nz = v => isNum(v) ? v : 0;
  const r6 = v => Math.round(v * 1e6) / 1e6;

  // ---------- statement lines (display order, labels, groups) ----------
  const IS = [
    { k: 'rev', l: 'Revenue', grp: 'rev', key: true },
    { k: 'cogs', l: 'Cost of revenue', grp: 'cost', neg: true },
    { k: 'gp', l: 'Gross profit', key: true, calc: true },
    { k: 'gm', l: 'Gross margin', pct: true, calc: true },
    { k: 'rnd', l: 'Research & development', grp: 'opex', neg: true },
    { k: 'sga', l: 'Selling, general & administrative', grp: 'opex', neg: true },
    { k: 'oth', l: 'Other operating expenses', grp: 'opex', neg: true },
    { k: 'opex', l: 'Total operating expenses', calc: true, neg: true },
    { k: 'ebit', l: 'Operating income (EBIT)', key: true },
    { k: 'da', l: 'Depreciation & amortization', memo: true },
    { k: 'ebitda', l: 'EBITDA', key: true, calc: true },
    { k: 'intInc', l: 'Interest income' },
    { k: 'intExp', l: 'Interest expense', neg: true },
    { k: 'nonop', l: 'Other nonoperating income (expense)' },
    { k: 'pbt', l: 'Pretax income', key: true },
    { k: 'tax', l: 'Income tax expense', neg: true },
    { k: 'eqinc', l: 'Equity-method investment income, net of tax' },
    { k: 'ni', l: 'Net income', key: true },
    { k: 'niNci', l: 'Net income attributable to noncontrolling interests', neg: true },
    { k: 'niParent', l: 'Net income attributable to the company' },
    { k: 'prefDiv', l: 'Preferred dividends and other adjustments', neg: true },
    { k: 'niCommon', l: 'Net income attributable to common shareholders', key: true },
    { k: 'waBasic', l: 'Weighted-average basic shares (mm)', shares: true },
    { k: 'waDil', l: 'Weighted-average diluted shares (mm)', shares: true },
    { k: 'epsBasic', l: 'Basic EPS', ps: true },
    { k: 'epsDil', l: 'Diluted EPS', ps: true },
    { k: 'sbc', l: 'Memo: stock-based compensation (inside the costs above)', memo: true },
  ];
  const BS = [
    { k: 'cash', l: 'Cash and cash equivalents', sec: 'ca' },
    { k: 'sti', l: 'Short-term investments', sec: 'ca' },
    { k: 'ar', l: 'Accounts receivable', sec: 'ca' },
    { k: 'inv', l: 'Inventory', sec: 'ca' },
    { k: 'oca', l: 'Other current assets', sec: 'ca' },
    { k: 'tca', l: 'Total current assets', tot: 'ca' },
    { k: 'ppe', l: 'Property, plant & equipment, net', sec: 'nca' },
    { k: 'rou', l: 'Operating lease right-of-use assets', sec: 'nca' },
    { k: 'gw', l: 'Goodwill', sec: 'nca' },
    { k: 'intang', l: 'Intangible assets, net', sec: 'nca' },
    { k: 'dta', l: 'Deferred tax assets', sec: 'nca' },
    { k: 'olta', l: 'Other long-term assets', sec: 'nca' },
    { k: 'ta', l: 'Total assets', tot: 'a', key: true },
    { k: 'ap', l: 'Accounts payable', sec: 'cl' },
    { k: 'accr', l: 'Accrued operating liabilities', sec: 'cl' },
    { k: 'defrev', l: 'Deferred revenue', sec: 'cl' },
    { k: 'std', l: 'Short-term debt', sec: 'cl' },
    { k: 'cltd', l: 'Current portion of long-term debt', sec: 'cl' },
    { k: 'ocl', l: 'Other current liabilities', sec: 'cl' },
    { k: 'tcl', l: 'Total current liabilities', tot: 'cl' },
    { k: 'ltd', l: 'Long-term debt', sec: 'ncl' },
    { k: 'opl', l: 'Operating lease liabilities', sec: 'ncl' },
    { k: 'finl', l: 'Finance lease liabilities', sec: 'ncl' },
    { k: 'dtl', l: 'Deferred tax liabilities', sec: 'ncl' },
    { k: 'oltl', l: 'Other long-term liabilities', sec: 'ncl' },
    { k: 'tl', l: 'Total liabilities', tot: 'l', key: true },
    { k: 'cs', l: 'Common stock', sec: 'eq' },
    { k: 'apic', l: 'Additional paid-in capital', sec: 'eq' },
    { k: 're', l: 'Retained earnings', sec: 'eq' },
    { k: 'treas', l: 'Treasury stock', sec: 'eq', contra: true },
    { k: 'aoci', l: 'Accumulated other comprehensive income', sec: 'eq' },
    { k: 'oeq', l: 'Other equity', sec: 'eq' },
    { k: 'nci', l: 'Noncontrolling interests', sec: 'eq' },
    { k: 'te', l: 'Total equity', tot: 'e', key: true },
    { k: 'tle', l: 'Total liabilities and equity', tot: 'le', key: true },
    { k: 'check', l: 'Balance check (assets − liabilities − equity)', check: true },
  ];
  const CF = [
    { k: 'ni', l: 'Net income', sec: 'cfo' },
    { k: 'da', l: 'Depreciation & amortization', sec: 'cfo' },
    { k: 'sbc', l: 'Stock-based compensation', sec: 'cfo' },
    { k: 'defTax', l: 'Deferred income taxes', sec: 'cfo' },
    { k: 'dNwcCf', l: 'Changes in operating working capital', sec: 'cfo' },
    { k: 'otherCfo', l: 'Other noncash adjustments', sec: 'cfo' },
    { k: 'cfo', l: 'Net cash from operating activities', tot: 'cfo', key: true },
    { k: 'capexCf', l: 'Capital expenditures', sec: 'cfi' },
    { k: 'acqCf', l: 'Acquisitions, net of cash acquired', sec: 'cfi' },
    { k: 'invCf', l: 'Purchases and sales of investments, net', sec: 'cfi' },
    { k: 'otherCfi', l: 'Other investing activities', sec: 'cfi' },
    { k: 'cfi', l: 'Net cash from investing activities', tot: 'cfi', key: true },
    { k: 'debtIss', l: 'Debt issuance (incl. revolver draws)', sec: 'cff' },
    { k: 'debtRep', l: 'Debt repayment (incl. revolver repayments)', sec: 'cff' },
    { k: 'buybackCf', l: 'Share repurchases', sec: 'cff' },
    { k: 'issueCf', l: 'Share issuance', sec: 'cff' },
    { k: 'divCf', l: 'Dividends', sec: 'cff' },
    { k: 'leaseCf', l: 'Finance lease principal payments', sec: 'cff' },
    { k: 'otherCff', l: 'Other financing activities', sec: 'cff' },
    { k: 'cff', l: 'Net cash from financing activities', tot: 'cff', key: true },
    { k: 'fx', l: 'Effect of exchange rates on cash', sec: 'fx' },
    { k: 'dCash', l: 'Net change in cash', tot: 'chg', key: true },
    { k: 'cashBeg', l: 'Beginning cash', sec: 'bal' },
    { k: 'cashEnd', l: 'Ending cash', sec: 'bal', key: true },
  ];

  // ---------- assumptions ----------
  // Scenario drivers (each an array of ten years); shared drivers apply to every scenario.
  const DRIVERS = [
    { k: 'g', l: 'Revenue growth', u: 'pct', grp: 'Revenue', sc: true },
    { k: 'gm', l: 'Gross margin (cost of revenue before D&A)', u: 'pct', grp: 'Margins', sc: true },
    { k: 'rnd', l: 'R&D (% of revenue, before D&A)', u: 'pct', grp: 'Margins', sc: true },
    { k: 'sga', l: 'SG&A (% of revenue, before D&A)', u: 'pct', grp: 'Margins', sc: true },
    { k: 'oth', l: 'Other operating expenses (% of revenue, before D&A)', u: 'pct', grp: 'Margins', sc: true },
    { k: 'sbc', l: 'Stock-based compensation (% of revenue)', u: 'pct', grp: 'Margins', sc: true },
    { k: 'tax', l: 'Effective (normalized) tax rate', u: 'pct', grp: 'Taxes', sc: true },
    { k: 'dso', l: 'Days sales outstanding (DSO)', u: 'days', grp: 'Working capital', sc: true },
    { k: 'dio', l: 'Days inventory outstanding (DIO)', u: 'days', grp: 'Working capital', sc: true },
    { k: 'dpo', l: 'Days payable outstanding (DPO)', u: 'days', grp: 'Working capital', sc: true },
    { k: 'accr', l: 'Accrued operating liabilities (% of revenue)', u: 'pct', grp: 'Working capital', sc: true },
    { k: 'defrev', l: 'Deferred revenue (% of revenue)', u: 'pct', grp: 'Working capital', sc: true },
    { k: 'oca', l: 'Other operating current assets (% of revenue)', u: 'pct', grp: 'Working capital', sc: true },
    { k: 'ocl', l: 'Other operating current liabilities (% of revenue)', u: 'pct', grp: 'Working capital', sc: true },
    { k: 'maint', l: 'Maintenance CapEx (% of revenue)', u: 'pct', grp: 'Capital expenditures', sc: true },
    { k: 'gcapex', l: 'Growth CapEx (% of revenue)', u: 'pct', grp: 'Capital expenditures', sc: true },
    { k: 'dep', l: 'Depreciation (% of revenue or of opening PP&E, per method)', u: 'pct', grp: 'Depreciation', sc: true, when: m => m.settings.depMethod !== 'vintage' },
    { k: 'acq', l: 'Acquisitions ($mm)', u: 'mm', grp: 'Acquisitions', sc: true },
    // shared (financing and other policies: the same in every scenario unless there is a reason)
    { k: 'amort', l: 'Amortization (% of opening intangibles)', u: 'pct', grp: 'Depreciation' },
    { k: 'flAdd', l: 'New finance leases ($mm, non-cash additions to PP&E)', u: 'mm', grp: 'Leases' },
    { k: 'flRepay', l: 'Finance lease principal repaid (% of opening balance)', u: 'pct', grp: 'Leases' },
    { k: 'flRate', l: 'Finance lease interest rate', u: 'pct', grp: 'Leases' },
    { k: 'opl', l: 'Operating lease liabilities (% of revenue)', u: 'pct', grp: 'Leases' },
    { k: 'sti', l: 'Short-term investments, end of year ($mm)', u: 'mm', grp: 'Cash and investments' },
    { k: 'yield', l: 'Interest rate earned on cash and investments', u: 'pct', grp: 'Cash and investments' },
    { k: 'minCash', l: 'Minimum cash balance ($mm)', u: 'mm', grp: 'Cash and investments' },
    { k: 'nonop', l: 'Other nonoperating income (expense) ($mm)', u: 'mm', grp: 'Other income' },
    { k: 'eqinc', l: 'Equity-method income, net of tax ($mm)', u: 'mm', grp: 'Other income' },
    { k: 'oltaChg', l: 'Change in other long-term assets ($mm)', u: 'mm', grp: 'Other balance sheet' },
    { k: 'oltlChg', l: 'Change in other long-term liabilities ($mm)', u: 'mm', grp: 'Other balance sheet' },
    { k: 'aociChg', l: 'Other comprehensive income ($mm)', u: 'mm', grp: 'Other balance sheet' },
    { k: 'defPct', l: 'Deferred share of tax expense (timing differences)', u: 'pct', grp: 'Taxes' },
    { k: 'divMode', l: 'Dividend policy', u: 'choice', grp: 'Equity', scalar: true },
    { k: 'div', l: 'Dividends (payout ratio, or $mm per year)', u: 'num', grp: 'Equity' },
    { k: 'buyback', l: 'Share repurchases ($mm)', u: 'mm', grp: 'Equity' },
    { k: 'issue', l: 'Share issuance proceeds ($mm)', u: 'mm', grp: 'Equity' },
    { k: 'awards', l: 'Net shares issued to employees (mm shares)', u: 'sh', grp: 'Equity' },
    { k: 'dilutive', l: 'Dilutive securities in diluted EPS (mm shares)', u: 'sh', grp: 'Equity' },
    { k: 'pxg', l: 'Share price growth (for buyback and issuance share counts)', u: 'pct', grp: 'Equity' },
    { k: 'nciPct', l: 'Noncontrolling interests share of net income', u: 'pct', grp: 'Equity' },
    { k: 'nciDist', l: 'Distributions to noncontrolling interests ($mm)', u: 'mm', grp: 'Equity' },
    { k: 'prefDiv', l: 'Preferred dividends ($mm)', u: 'mm', grp: 'Equity' },
    { k: 'otherFin', l: 'Other financing cash flows ($mm)', u: 'mm', grp: 'Equity' },
    { k: 'disposals', l: 'Net book value of PP&E disposals ($mm, sold at book value)', u: 'mm', grp: 'Capital expenditures' },
    { k: 'impair', l: 'Impairments of PP&E ($mm, non-cash)', u: 'mm', grp: 'Capital expenditures' },
  ];
  const DBY = Object.fromEntries(DRIVERS.map(d => [d.k, d]));
  const SC_KEYS = DRIVERS.filter(d => d.sc).map(d => d.k);
  const SH_KEYS = DRIVERS.filter(d => !d.sc && !d.scalar).map(d => d.k);

  // ---------- historical view: classification, residuals and checks ----------
  // h.cells[key][pid] = {v, src}. Missing is null (never 0). Returns derived statements per period.
  const val = (h, k, pid) => { const c = h.cells[k] && h.cells[k][pid]; return c && isNum(c.v) ? c.v : null; };
  function histPeriod(h, pid, settings = {}) {
    const g = k => val(h, k, pid);
    const o = { pid };
    const has = k => g(k) !== null;
    // income statement
    o.rev = g('rev'); o.cogs = g('cogs');
    o.gp = has('gp') ? g('gp') : (isNum(o.rev) && isNum(o.cogs) ? o.rev - o.cogs : null);
    if (!isNum(o.cogs) && isNum(o.gp) && isNum(o.rev)) o.cogs = o.rev - o.gp;
    o.gm = isNum(o.gp) && o.rev ? o.gp / o.rev : null;
    o.rnd = g('rnd'); o.sga = g('sga'); o.othTag = g('oth');
    o.ebit = g('ebit');
    // unclassified operating costs: what the tagged lines leave unexplained versus reported operating income
    if (isNum(o.gp) && isNum(o.ebit)) {
      const tagged = nz(o.rnd) + nz(o.sga) + nz(o.othTag);
      o.unclassOpex = o.gp - o.ebit - tagged;
    } else o.unclassOpex = null;
    o.oth = isNum(o.unclassOpex) ? nz(o.othTag) + o.unclassOpex : o.othTag;
    o.opex = isNum(o.gp) && isNum(o.ebit) ? o.gp - o.ebit : null;
    o.da = g('da'); o.sbc = g('sbc');
    o.ebitda = isNum(o.ebit) && isNum(o.da) ? o.ebit + o.da : null;
    o.intInc = g('intInc'); o.intExp = g('intExp'); o.pbt = g('pbt'); o.tax = g('tax'); o.eqinc = g('eqinc');
    o.nonopTag = g('nonop');
    o.nonop = isNum(o.pbt) && isNum(o.ebit) ? o.pbt - o.ebit - nz(o.intInc) + nz(o.intExp) : o.nonopTag;
    o.ni = g('ni'); o.niParent = g('niParent'); o.niNci = g('niNci'); o.niCommon = g('niCommon');
    if (!isNum(o.ni) && isNum(o.niParent)) o.ni = o.niParent + nz(o.niNci);
    if (!isNum(o.niParent) && isNum(o.ni)) o.niParent = o.ni - nz(o.niNci);
    if (!isNum(o.niNci) && isNum(o.ni) && isNum(o.niParent)) o.niNci = o.ni - o.niParent;
    if (!isNum(o.niCommon) && isNum(o.niParent)) o.niCommon = o.niParent - nz(g('prefDiv'));
    o.prefDiv = isNum(o.niParent) && isNum(o.niCommon) ? o.niParent - o.niCommon : null;
    o.waBasic = g('waBasic'); o.waDil = g('waDil'); o.epsBasic = g('epsBasic'); o.epsDil = g('epsDil');
    o.isCheck = isNum(o.pbt) && isNum(o.tax) && isNum(o.ni) ? o.pbt - o.tax + nz(o.eqinc) - o.ni : null;
    // balance sheet
    ['cash', 'sti', 'ar', 'inv', 'oca', 'ppe', 'rou', 'gw', 'intang', 'dta', 'olta', 'ap', 'accr', 'defrev', 'std', 'cltd', 'ocl', 'ltd', 'opl', 'finl', 'dtl', 'oltl', 'cs', 'apic', 're', 'treas', 'aoci', 'oeq', 'nci', 'ta', 'tca', 'tcl', 'tl', 'te', 'tle'].forEach(k => { o[k] = g(k); });
    const S = (keys) => keys.every(k => !isNum(o[k])) ? null : sum(keys.map(k => o[k]));
    o.tcaCalc = S(['cash', 'sti', 'ar', 'inv', 'oca']);
    o.taCalc = isNum(o.tcaCalc) ? o.tcaCalc + nz(S(['ppe', 'rou', 'gw', 'intang', 'dta', 'olta'])) : null;
    o.tclCalc = S(['ap', 'accr', 'defrev', 'std', 'cltd', 'ocl']);
    o.tlCalc = isNum(o.tclCalc) ? o.tclCalc + nz(S(['ltd', 'opl', 'finl', 'dtl', 'oltl'])) : null;
    o.teCalc = S(['cs', 'apic', 're', 'aoci', 'oeq', 'nci']); if (isNum(o.teCalc)) o.teCalc -= nz(o.treas);
    o.bsCheck = isNum(o.taCalc) && isNum(o.tlCalc) && isNum(o.teCalc) ? o.taCalc - o.tlCalc - o.teCalc : null;
    o.hasBS = isNum(o.ta) || isNum(o.cash);
    // cash flow statement
    ['cfo', 'cfi', 'cff', 'capex', 'acq', 'invNet', 'debtIss', 'debtRep', 'buyback', 'issue', 'div', 'leasePrin', 'fx', 'dCash', 'defTax', 'otherNoncash', 'cashEndCF'].forEach(k => { o[k] = g(k); });
    o.cfoNi = isNum(o.ni) ? o.ni : null;
    o.dNwcCf = isNum(o.cfo) && isNum(o.ni) ? o.cfo - o.ni - nz(o.da) - nz(o.sbc) - nz(o.defTax) - nz(o.otherNoncash) : null;
    o.otherCfi = isNum(o.cfi) ? o.cfi + nz(o.capex) + nz(o.acq) - nz(o.invNet) : null;
    o.otherCff = isNum(o.cff) ? o.cff - nz(o.debtIss) + nz(o.debtRep) + nz(o.buyback) - nz(o.issue) + nz(o.div) + nz(o.leasePrin) : null;
    o.cfCheck = isNum(o.cfo) && isNum(o.cfi) && isNum(o.cff) && isNum(o.dCash) ? o.cfo + o.cfi + o.cff + nz(o.fx) - o.dCash : null;
    // operating working capital
    o.nwc = nwcOf(o);
    o.days = settings.days || 365;
    return o;
  }
  function nwcOf(b) {
    if (![b.ar, b.inv, b.oca, b.ap, b.accr, b.defrev, b.ocl].some(isNum)) return null;
    return nz(b.ar) + nz(b.inv) + nz(b.oca) - nz(b.ap) - nz(b.accr) - nz(b.defrev) - nz(b.ocl);
  }
  // Historical reference ratios used to inform assumptions (never applied automatically)
  function histRatios(h, pid, prev, settings = {}) {
    const o = histPeriod(h, pid, settings), p = prev ? histPeriod(h, prev, settings) : null;
    const D = settings.days || 365;
    const al = allocDA(o, settings.daAlloc || 'opex');
    const r = {};
    r.g = p && isNum(o.rev) && isNum(p.rev) && p.rev ? o.rev / p.rev - 1 : null;
    r.gm = isNum(o.rev) && o.rev && isNum(al.cogsX) ? 1 - al.cogsX / o.rev : null;
    r.rnd = isNum(o.rev) && o.rev && isNum(al.rndX) ? al.rndX / o.rev : null;
    r.sga = isNum(o.rev) && o.rev && isNum(al.sgaX) ? al.sgaX / o.rev : null;
    r.oth = isNum(o.rev) && o.rev && isNum(al.othX) ? al.othX / o.rev : null;
    r.sbc = isNum(o.sbc) && o.rev ? o.sbc / o.rev : null;
    r.tax = isNum(o.tax) && isNum(o.pbt) && o.pbt > 0 ? o.tax / o.pbt : null;
    r.dso = isNum(o.ar) && o.rev ? o.ar / o.rev * D : null;
    r.dio = isNum(o.inv) && isNum(o.cogs) && o.cogs ? o.inv / o.cogs * D : null;
    r.dpo = isNum(o.ap) && isNum(o.cogs) && o.cogs ? o.ap / o.cogs * D : null;
    ['accr', 'defrev', 'oca', 'ocl'].forEach(k => { r[k] = isNum(o[k]) && o.rev ? o[k] / o.rev : null; });
    r.capex = isNum(o.capex) && o.rev ? o.capex / o.rev : null;
    r.dep = isNum(o.da) && o.rev ? o.da / o.rev : null;
    r.depPPE = p && isNum(o.da) && isNum(p.ppe) && p.ppe ? o.da / p.ppe : null;
    r.opl = isNum(o.opl) && o.rev ? o.opl / o.rev : null;
    r.nwcPct = isNum(o.nwc) && o.rev ? o.nwc / o.rev : null;
    r.incNwc = p && isNum(o.nwc) && isNum(p.nwc) && isNum(o.rev) && isNum(p.rev) && o.rev !== p.rev ? (o.nwc - p.nwc) / (o.rev - p.rev) : null;
    r.payout = isNum(o.div) && isNum(o.niCommon) && o.niCommon > 0 ? o.div / o.niCommon : null;
    const debt0 = p ? nz(p.std) + nz(p.cltd) + nz(p.ltd) : 0;
    r.intRate = p && isNum(o.intExp) && debt0 > 0 ? o.intExp / debt0 : null;
    r.yield = p && isNum(o.intInc) && (nz(p.cash) + nz(p.sti)) > 0 ? o.intInc / (nz(p.cash) + nz(p.sti)) : null;
    return r;
  }
  // D&A embedded in reported costs, removed from the lines it sits in so that margins are "before D&A".
  // alloc: 'opex' = spread over operating expense lines in proportion to their size; 'cogs' = all in cost of revenue;
  // 'all' = spread over cost of revenue and operating expenses; 'separate' = D&A is already its own line (nothing to remove).
  function allocDA(o, alloc) {
    const da = nz(o.da);
    const lines = { cogs: o.cogs, rnd: o.rnd, sga: o.sga, oth: o.oth };
    const out = { cogsX: lines.cogs, rndX: lines.rnd, sgaX: lines.sga, othX: lines.oth, w: { cogs: 0, rnd: 0, sga: 0, oth: 0 } };
    if (alloc === 'separate' || !da) return out;
    const pool = alloc === 'cogs' ? ['cogs'] : alloc === 'all' ? ['cogs', 'rnd', 'sga', 'oth'] : ['rnd', 'sga', 'oth'];
    const base = sum(pool.map(k => Math.max(0, nz(lines[k]))));
    if (!base) return out;
    pool.forEach(k => { const w = Math.max(0, nz(lines[k])) / base; out.w[k] = w; if (isNum(lines[k])) out[k + 'X'] = lines[k] - da * w; });
    return out;
  }

  // ---------- opening balance sheet (the forecast's starting point) ----------
  function basePeriod(model) {
    const h = model.hist;
    const fy = h.periods[h.periods.length - 1];
    if (model.settings.base === 'ttm' && h.ttm && h.ttm.end && fy && h.ttm.end > fy.end) return { pid: 'TTM', end: h.ttm.end, kind: 'TTM', label: 'TTM ' + h.ttm.end, flowsPid: 'TTM', bsPid: 'TTM' };
    return fy ? { pid: fy.id, end: fy.end, kind: 'FY', label: fy.label, flowsPid: fy.id, bsPid: fy.id } : null;
  }
  function opening(model) {
    const b = basePeriod(model);
    if (!b) return { ok: false, missing: ['historical periods'], b };
    const o = histPeriod(model.hist, b.bsPid, model.settings);
    const fl = b.flowsPid === b.bsPid ? o : histPeriod(model.hist, b.flowsPid, model.settings);
    const x = {};
    ['cash', 'sti', 'ar', 'inv', 'oca', 'ppe', 'rou', 'gw', 'intang', 'dta', 'olta', 'ap', 'accr', 'defrev', 'std', 'cltd', 'ocl', 'ltd', 'opl', 'finl', 'dtl', 'oltl', 'cs', 'apic', 're', 'treas', 'aoci', 'oeq', 'nci'].forEach(k => { x[k] = isNum(o[k]) ? o[k] : null; });
    const miss = [];
    ['cash', 'ppe', 're'].forEach(k => { if (!isNum(x[k])) miss.push(k); });
    if (!isNum(fl.rev)) miss.push('rev');
    Object.keys(x).forEach(k => { if (!isNum(x[k])) x[k] = 0; });
    x.rev = fl.rev; x.cogs = fl.cogs; x.ni = fl.ni;
    x.shares = isNum(model.equity && model.equity.sharesOpen) ? model.equity.sharesOpen : null;
    if (!isNum(x.shares)) miss.push('shares');
    x.nwc = nwcOf(x);
    x.ta = x.cash + x.sti + x.ar + x.inv + x.oca + x.ppe + x.rou + x.gw + x.intang + x.dta + x.olta;
    x.tl = x.ap + x.accr + x.defrev + x.std + x.cltd + x.ocl + x.ltd + x.opl + x.finl + x.dtl + x.oltl;
    x.te = x.cs + x.apic + x.re - x.treas + x.aoci + x.oeq + x.nci;
    x.check = x.ta - x.tl - x.te;
    x.reportedTA = o.ta; x.reportedTL = o.tl; x.reportedTE = o.te;
    return { ok: !miss.length, missing: miss, b, x };
  }

  // ---------- debt tranches ----------
  // model.debt.tranches: [{id, name, kind:'term'|'cp', open, rate:[10], repay:[10] scheduled, borrow:[10], prepay:[10], other:[10], maturity, note}]
  // model.debt.revolver: {enabled, capacity, rate, open, sweep}
  function arr(a, i) { return a && isNum(a[i]) ? a[i] : null; }

  // ---------- one scenario ----------
  function run(model, s = 'Base') {
    const S = model.settings;
    const op = opening(model);
    const miss = op.missing.slice();
    const A = model.asm[s] || {}, SH = model.shared || {};
    const need = (key, src) => { for (let i = 0; i < N; i++) if (!isNum(arr(src[key], i))) { miss.push(key); return; } };
    SC_KEYS.forEach(k => { if (DBY[k].when && !DBY[k].when(model)) return; if (k === 'g' && S.segments && (model.segments || []).length) return; need(k, A); });
    SH_KEYS.forEach(k => { if (k === 'div' && SH.divMode === 'none') return; need(k, SH); });
    if (S.depMethod === 'vintage') { if (!(model.ppeSched && model.ppeSched.life > 0)) miss.push('usefulLife'); if (!(model.ppeSched && model.ppeSched.remLife > 0)) miss.push('remainingLife'); }
    if (S.segments && (model.segments || []).length) (model.segments || []).forEach((sg, j) => { if (!isNum(sg.rev0)) miss.push('segment ' + (j + 1) + ' base revenue'); for (let i = 0; i < N; i++) if (!isNum(arr(sg.g && sg.g[s], i))) { miss.push('segment ' + (j + 1) + ' growth'); break; } });
    const tranches = (model.debt && model.debt.tranches) || [];
    tranches.forEach((t, j) => { if (!isNum(t.open)) miss.push(`debt ${t.name || j + 1}: opening balance`); for (let i = 0; i < N; i++) { if (!isNum(arr(t.rate, i))) { miss.push(`debt ${t.name || j + 1}: interest rate`); break; } } });
    const rv = (model.debt && model.debt.revolver) || {};
    if (rv.enabled && (!isNum(rv.capacity) || !isNum(rv.rate))) miss.push('revolver capacity and rate');
    if (!isNum(model.equity && model.equity.price0)) miss.push('share price (for buybacks)');
    if (op.ok) {
      const tol = isNum(S.tol) ? S.tol : 0.5;
      const trSum = sum(tranches.map(t => t.open)) + nz(rv.open), bsDebt = op.x.std + op.x.cltd + op.x.ltd;
      if (Math.abs(trSum - bsDebt) > tol) miss.push(`debt tranches (${trSum.toFixed(1)}) must add up to the opening balance sheet debt (${bsDebt.toFixed(1)}): short-term + current portion + long-term`);
    }
    if (!op.ok || miss.length) return { ok: false, scenario: s, missing: [...new Set(miss)], open: op };

    const x = op.x, D = S.days || 365;
    const years = [];
    const nol0 = nz(model.tax && model.tax.nolOpen) * (isNum(model.tax && model.tax.nolUsable) ? model.tax.nolUsable : 1);
    // a recognised loss carryforward already sits in the opening deferred tax assets
    const nolDTA0 = S.nolDTA === 'recognized' ? Math.min(nol0 * nz(arr(A.tax, 0)), x.dta) : 0;
    let prev = Object.assign({}, x, { revolver: nz(rv.open), tr: tranches.map(t => t.open), nol: nol0, nolDTA: nolDTA0, vint: [] });
    const segs = S.segments && (model.segments || []).length ? model.segments : null;
    let segPrev = segs ? segs.map(sg => sg.rev0) : null;
    const price0 = model.equity.price0;
    const avg = S.interest === 'average';
    const life = model.ppeSched && model.ppeSched.life, remLife = model.ppeSched && model.ppeSched.remLife, half = !!(model.ppeSched && model.ppeSched.halfYear);
    const existingDep = S.depMethod === 'vintage' ? x.ppe / remLife : 0;
    for (let i = 0; i < N; i++) {
      const a = k => arr(A[k], i), sh = k => arr(SH[k], i);
      const y = { t: i + 1, i, tr: {} };
      // --- revenue
      if (segs) { y.seg = segs.map((sg, j) => segPrev[j] * (1 + sg.g[s][i])); y.rev = sum(y.seg); segPrev = y.seg; y.g = y.rev / prev.rev - 1; }
      else { y.g = a('g'); y.rev = prev.rev * (1 + y.g); }
      y.tr.rev = segs ? { f: 'Sum of segment revenues', p: segs.map((sg, j) => [sg.name || 'Segment ' + (j + 1), y.seg[j]]) } : { f: 'Prior revenue × (1 + growth)', p: [['Prior revenue', prev.rev], ['Growth', y.g]] };
      // --- operating costs before D&A
      y.cogsX = y.rev * (1 - a('gm')); y.rndX = y.rev * a('rnd'); y.sgaX = y.rev * a('sga'); y.othX = y.rev * a('oth');
      y.sbc = y.rev * a('sbc');
      y.ebitda = y.rev - y.cogsX - y.rndX - y.sgaX - y.othX;
      y.tr.ebitda = { f: 'Revenue − cost of revenue − R&D − SG&A − other operating expenses (all before D&A)', p: [['Revenue', y.rev], ['Cost of revenue before D&A', y.cogsX], ['R&D before D&A', y.rndX], ['SG&A before D&A', y.sgaX], ['Other before D&A', y.othX]] };
      // --- PP&E roll-forward
      y.maint = y.rev * a('maint'); y.gcapex = y.rev * a('gcapex'); y.capex = y.maint + y.gcapex;
      y.flAdd = sh('flAdd');
      y.acq = a('acq');
      const acqAlloc = model.acqAlloc || { gw: 1, intang: 0 };
      y.acqGw = y.acq * nz(acqAlloc.gw); y.acqInt = y.acq * nz(acqAlloc.intang); y.acqPpe = y.acq - y.acqGw - y.acqInt;
      y.disposals = Math.min(sh('disposals'), prev.ppe); y.impair = sh('impair');
      if (S.depMethod === 'vintage') {
        const add = y.capex + y.flAdd + y.acqPpe;
        prev.vint = prev.vint.concat([add]);
        let dep = i < remLife ? Math.min(existingDep, Math.max(0, x.ppe - existingDep * i)) : 0;
        prev.vint.forEach((v, j) => { const age = i - j; const yrs = half ? (age === 0 ? 0.5 : age < life ? 1 : age === life ? 0.5 : 0) : (age < life ? 1 : 0); dep += v / life * yrs; });
        y.dep = dep;
        y.tr.dep = { f: `Opening PP&E ÷ ${remLife} remaining years + each year's additions ÷ ${life}-year useful life${half ? ' (half a year in the first and last year)' : ''}`, p: [['Opening net PP&E', x.ppe], ['Additions this year', add]] };
      } else if (S.depMethod === 'pctPPE') { y.dep = prev.ppe * a('dep'); y.tr.dep = { f: 'Opening net PP&E × depreciation rate', p: [['Opening net PP&E', prev.ppe], ['Rate', a('dep')]] }; }
      else { y.dep = y.rev * a('dep'); y.tr.dep = { f: 'Revenue × depreciation % of revenue', p: [['Revenue', y.rev], ['Depreciation % of revenue', a('dep')]] }; }
      y.ppe = prev.ppe + y.capex + y.flAdd + y.acqPpe - y.dep - y.disposals - y.impair;
      y.tr.ppe = { f: 'Opening PP&E + CapEx + new finance leases + PP&E acquired in acquisitions − depreciation − disposals − impairments', p: [['Opening', prev.ppe], ['CapEx', y.capex], ['Finance lease additions', y.flAdd], ['From acquisitions', y.acqPpe], ['Depreciation', -y.dep], ['Disposals', -y.disposals], ['Impairments', -y.impair]] };
      // --- intangibles and goodwill
      y.amort = Math.min(prev.intang * sh('amort'), prev.intang + y.acqInt);
      y.intang = prev.intang + y.acqInt - y.amort;
      y.gw = prev.gw + y.acqGw;
      y.da = y.dep + y.amort;
      y.ebit = y.ebitda - y.da - y.impair;
      y.tr.ebit = { f: 'EBITDA − depreciation − amortization − impairments', p: [['EBITDA', y.ebitda], ['Depreciation', -y.dep], ['Amortization', -y.amort], ['Impairments', -y.impair]] };
      // presentation: D&A shown inside the cost lines it belongs to (embedded) or as its own line (separate)
      const w = S.daAlloc === 'cogs' ? { cogs: 1, rnd: 0, sga: 0, oth: 0 } : (() => { const pool = S.daAlloc === 'all' ? ['cogs', 'rnd', 'sga', 'oth'] : ['rnd', 'sga', 'oth']; const tot = sum(pool.map(k => Math.max(0, y[k + 'X']))); const o = { cogs: 0, rnd: 0, sga: 0, oth: 0 }; if (tot) pool.forEach(k => o[k] = Math.max(0, y[k + 'X']) / tot); else o.oth = 1; return o; })();
      const emb = S.daPresentation !== 'separate';
      y.cogs = y.cogsX + (emb ? y.da * w.cogs : 0);
      y.rnd = y.rndX + (emb ? y.da * w.rnd : 0);
      y.sga = y.sgaX + (emb ? y.da * w.sga : 0);
      y.oth = y.othX + (emb ? y.da * w.oth : 0) + y.impair;
      y.gp = y.rev - y.cogs; y.gm = y.gp / y.rev;
      y.opex = y.rnd + y.sga + y.oth + (emb ? 0 : y.da);
      y.daLine = emb ? null : y.da;
      y.presCheck = y.gp - y.opex - y.ebit;
      // --- working capital (cost of revenue as presented, consistent with the historical day counts)
      y.ar = y.rev / D * a('dso'); y.inv = y.cogs / D * a('dio'); y.ap = y.cogs / D * a('dpo');
      y.accr = y.rev * a('accr'); y.defrev = y.rev * a('defrev'); y.oca = y.rev * a('oca'); y.ocl = y.rev * a('ocl');
      y.nwc = y.ar + y.inv + y.oca - y.ap - y.accr - y.defrev - y.ocl;
      y.dNwc = y.nwc - prev.nwc;
      y.tr.ar = { f: 'Revenue ÷ days in period × DSO', p: [['Revenue', y.rev], ['Days', D], ['DSO', a('dso')]] };
      y.tr.inv = { f: 'Cost of revenue ÷ days × DIO', p: [['Cost of revenue', y.cogs], ['Days', D], ['DIO', a('dio')]] };
      y.tr.ap = { f: 'Cost of revenue ÷ days × DPO', p: [['Cost of revenue', y.cogs], ['Days', D], ['DPO', a('dpo')]] };
      y.tr.nwc = { f: 'AR + inventory + other operating current assets − AP − accrued − deferred revenue − other operating current liabilities', p: [['AR', y.ar], ['Inventory', y.inv], ['Other current assets', y.oca], ['AP', -y.ap], ['Accrued', -y.accr], ['Deferred revenue', -y.defrev], ['Other current liabilities', -y.ocl]] };
      // --- leases (operating: non-cash, liability and asset move together; finance: debt-like)
      y.opl = y.rev * sh('opl'); y.rou = prev.rou + (y.opl - prev.opl);
      y.flPrin = Math.min(prev.finl * sh('flRepay'), prev.finl); y.finl = prev.finl + y.flAdd - y.flPrin;
      // --- other balance sheet items
      y.sti = sh('sti'); y.eqinc = sh('eqinc');
      y.olta = prev.olta + sh('oltaChg') + y.eqinc; y.oltl = prev.oltl + sh('oltlChg'); y.aoci = prev.aoci + sh('aociChg');
      y.cs = prev.cs; y.oeq = prev.oeq;
      // --- shares (not circular)
      y.px = price0 * Math.pow(1 + sh('pxg'), i + 0.5);
      y.buyback = sh('buyback'); y.issue = sh('issue');
      y.shBought = y.buyback / y.px; y.shIssued = y.issue / y.px; y.awards = sh('awards');
      y.sharesBeg = prev.shares; y.sharesEnd = prev.shares + y.awards + y.shIssued - y.shBought;
      y.waBasic = (y.sharesBeg + y.sharesEnd) / 2; y.dilutive = sh('dilutive'); y.waDil = y.waBasic + y.dilutive;
      y.tr.sharesEnd = { f: 'Opening shares + employee awards + shares issued (proceeds ÷ price) − shares repurchased (amount ÷ price)', p: [['Opening', y.sharesBeg], ['Awards', y.awards], ['Issued', y.shIssued], ['Repurchased', -y.shBought], ['Assumed average price', y.px]] };
      // --- debt schedule: scheduled flows (not dependent on cash)
      y.trs = tranches.map((t, j) => {
        const beg = prev.tr[j];
        const sched = Math.min(nz(arr(t.repay, i)), beg);
        const pre = Math.min(nz(arr(t.prepay, i)), beg - sched);
        const bor = nz(arr(t.borrow, i)), oth = nz(arr(t.other, i));
        const end = beg + bor - sched - pre + oth;
        return { id: t.id, name: t.name, kind: t.kind || 'term', beg, borrow: bor, sched, prepay: pre, other: oth, end, rate: arr(t.rate, i), nextRepay: t.kind === 'cp' ? 0 : Math.min(nz(arr(t.repay, i + 1)), end) };
      });
      // --- financing solve: interest, taxes, net income, cash and revolver
      const begCash = prev.cash + prev.sti;
      let intExp = 0, intInc = 0, iter = 0, conv = true, revDraw = 0, revRepay = 0, res = null;
      const solve = (ie, ii) => {
        const r = {};
        r.intExp = ie; r.intInc = ii; r.nonop = sh('nonop');
        r.pbt = y.ebit + ii - ie + r.nonop;
        Object.assign(r, taxCalc(model, y, prev, r.pbt, a('tax'), sh('defPct')));
        r.ni = r.pbt - r.tax + y.eqinc;
        r.niNci = r.ni * sh('nciPct'); r.niParent = r.ni - r.niNci; r.prefDiv = sh('prefDiv'); r.niCommon = r.niParent - r.prefDiv;
        r.div = SH.divMode === 'none' ? 0 : SH.divMode === 'amount' ? sh('div') : Math.max(0, r.niCommon) * sh('div');
        r.nciDist = sh('nciDist');
        // cash flow statement
        r.cfoOther = sh('oltlChg') - y.eqinc + y.impair;
        r.cfo = r.ni + y.da + y.sbc + r.defTax - y.dNwc + r.cfoOther;
        r.invCf = -(y.sti - prev.sti);
        r.otherCfi = -sh('oltaChg') + y.disposals;
        r.cfi = -y.capex - y.acq + r.invCf + r.otherCfi;
        const debtFlows = sum(y.trs.map(q => q.borrow - q.sched - q.prepay));
        r.cffPre = debtFlows - y.flPrin - y.buyback + y.issue - r.div - r.nciDist - r.prefDiv + sh('otherFin');
        const cashPre = prev.cash + r.cfo + r.cfi + r.cffPre;
        r.revDraw = 0; r.revRepay = 0;
        if (rv.enabled) {
          const room = Math.max(0, rv.capacity - prev.revolver);
          const minC = sh('minCash');
          if (cashPre < minC) r.revDraw = Math.min(minC - cashPre, room);
          else if (rv.sweep !== false) r.revRepay = Math.min(prev.revolver, cashPre - minC);
        }
        r.revolver = prev.revolver + r.revDraw - r.revRepay;
        r.cash = cashPre + r.revDraw - r.revRepay;
        return r;
      };
      const intOf = (r) => {
        const tie = sum(y.trs.map(q => (avg && r ? (q.beg + q.end) / 2 : q.beg) * nz(q.rate)));
        const rvb = avg && r ? (prev.revolver + r.revolver) / 2 : prev.revolver;
        const fl = (avg ? (prev.finl + y.finl) / 2 : prev.finl) * sh('flRate');
        const unused = rv.enabled && isNum(rv.fee) ? Math.max(0, rv.capacity - rvb) * rv.fee : 0;
        const ie = tie + rvb * nz(rv.rate) + fl + unused;
        const cb = avg && r ? (begCash + r.cash + y.sti) / 2 : begCash;
        return { ie, ii: cb * sh('yield'), parts: { tranches: tie, revolver: rvb * nz(rv.rate), finLease: fl, fee: unused } };
      };
      let ip = intOf(null);
      res = solve(ip.ie, ip.ii);
      if (avg) {
        conv = false;
        for (iter = 1; iter <= 100; iter++) {
          const nx = intOf(res);
          if (Math.abs(nx.ie - res.intExp) < 1e-7 && Math.abs(nx.ii - res.intInc) < 1e-7) { conv = true; ip = nx; break; }
          ip = nx; res = solve(nx.ie, nx.ii);
        }
      }
      Object.assign(y, res);
      y.intParts = ip.parts; y.iter = iter; y.converged = conv;
      y.tr.intExp = { f: avg ? 'Average balance × rate, for each tranche, the revolver and finance leases (solved iteratively)' : 'Opening balance × rate, for each tranche, the revolver and finance leases (no circularity)', p: [['Debt tranches', ip.parts.tranches], ['Revolver', ip.parts.revolver], ['Finance leases', ip.parts.finLease], ['Unused commitment fee', ip.parts.fee]] };
      y.tr.intInc = { f: (avg ? 'Average' : 'Opening') + ' (cash + short-term investments) × yield', p: [['Opening cash + investments', begCash], ['Yield', sh('yield')]] };
      // debt presentation
      y.cp = sum(y.trs.filter(q => q.kind === 'cp').map(q => q.end));
      y.termEnd = sum(y.trs.filter(q => q.kind !== 'cp').map(q => q.end));
      y.cltd = sum(y.trs.filter(q => q.kind !== 'cp').map(q => q.nextRepay));
      y.std = y.cp + y.revolver; y.ltd = y.termEnd - y.cltd;
      y.debt = y.std + y.cltd + y.ltd;
      y.debtIss = sum(y.trs.map(q => q.borrow)) + y.revDraw;
      y.debtRep = -(sum(y.trs.map(q => q.sched + q.prepay)) + y.revRepay);
      y.debtOther = sum(y.trs.map(q => q.other));
      y.cff = y.cffPre + y.revDraw - y.revRepay;
      y.fx = 0;
      y.dCash = y.cfo + y.cfi + y.cff + y.fx;
      y.cashBeg = prev.cash; y.cashEnd = y.cash;
      // equity roll-forward
      y.apic = prev.apic + y.sbc + y.issue;
      const retire = S.buyback === 'retire';
      y.treas = prev.treas + (retire ? 0 : y.buyback);
      y.re = prev.re + y.niParent - y.div - y.prefDiv - (retire ? y.buyback : 0);
      y.nci = prev.nci + y.niNci - y.nciDist;
      y.epsBasic = y.waBasic > 0 ? y.niCommon / y.waBasic : null;
      y.epsDil = y.waDil > 0 ? (y.niCommon >= 0 ? y.niCommon / y.waDil : y.niCommon / y.waBasic) : null;
      y.epsDilNote = y.niCommon < 0 ? 'Loss year: dilutive securities are anti-dilutive, so diluted EPS equals basic EPS.' : '';
      // cash flow presentation
      y.defTaxCf = y.defTax; y.dNwcCf = -y.dNwc; y.otherCfo = y.cfoOther;
      y.capexCf = -y.capex; y.acqCf = -y.acq; y.buybackCf = -y.buyback; y.issueCf = y.issue; y.divCf = -(y.div + y.nciDist + y.prefDiv); y.leaseCf = -y.flPrin; y.otherCff = sh('otherFin');
      // balance sheet
      y.dta = res.dta; y.dtl = res.dtl;
      y.tca = y.cash + y.sti + y.ar + y.inv + y.oca;
      y.ta = y.tca + y.ppe + y.rou + y.gw + y.intang + y.dta + y.olta;
      y.tcl = y.ap + y.accr + y.defrev + y.std + y.cltd + y.ocl;
      y.tl = y.tcl + y.ltd + y.opl + y.finl + y.dtl + y.oltl;
      y.te = y.cs + y.apic + y.re - y.treas + y.aoci + y.oeq + y.nci;
      y.tle = y.tl + y.te;
      y.check = y.ta - y.tl - y.te;
      y.checkMove = y.check - x.check;
      // free cash flow to the firm (valuation definition, not reported cash flow)
      const opRate = a('tax');
      y.opTax = y.ebit > 0 ? y.ebit * opRate : 0;
      y.nopat = y.ebit - y.opTax;
      const reinvLeases = S.flReinvest !== false;
      y.fcff = y.nopat + y.da + y.impair - y.capex - y.dNwc - y.acq - (reinvLeases ? y.flAdd : 0);
      y.tr.fcff = { f: `EBIT × (1 − tax rate) + D&A + non-cash impairments − CapEx − increase in operating NWC − acquisitions${reinvLeases ? ' − new finance leases' : ''}`, p: [['EBIT', y.ebit], ['Operating taxes', -y.opTax], ['D&A', y.da], ['Impairments', y.impair], ['CapEx', -y.capex], ['Increase in NWC', -y.dNwc], ['Acquisitions', -y.acq], ['Finance lease additions', reinvLeases ? -y.flAdd : 0]] };
      y.cfoLessCapex = y.cfo - y.capex;
      y.fcfeSimple = y.cfo - y.capex - y.flPrin;
      y.ic = y.nwc + y.ppe + y.gw + y.intang;
      y.nwcPct = y.nwc / y.rev;
      // carry
      prev = Object.assign({}, y, { tr: y.trs.map(q => q.end), vint: prev.vint, nwc: y.nwc, shares: y.sharesEnd });
      years.push(y);
    }
    const out = { ok: true, scenario: s, years, open: op, x };
    out.checks = checks(model, out);
    return out;
  }

  // ---------- taxes ----------
  // Book (accounting) tax expense vs cash (current) tax. Losses add to the loss carryforward; usage is limited by
  // capPct of taxable income and an annual limit. With a valuation allowance the carryforward has no deferred
  // tax asset, so using it lowers book tax too; when recognised, using it reduces the deferred tax asset instead.
  function taxCalc(model, y, prev, pbt, rate, defPct) {
    const T = model.tax || {};
    const recognised = (model.settings.nolDTA || 'allowance') === 'recognized';
    const cap = isNum(T.capPct) ? T.capPct : 1, lim = isNum(T.annualLimit) ? T.annualLimit : Infinity;
    let nol = prev.nol, nolDTA = prev.nolDTA, used = 0, created = 0;
    let book, current, defOther = 0, defNol = 0;
    if (pbt <= 0) {
      created = -pbt; nol += created;
      if (recognised) { book = pbt * rate; current = 0; defNol = book; nolDTA += -book; }
      else { book = 0; current = 0; }
    } else {
      used = Math.min(nol, pbt * cap, lim); nol -= used;
      const taxable = pbt - used;
      if (recognised) {
        book = pbt * rate;
        const nolRelease = Math.min(used * rate, nolDTA); nolDTA -= nolRelease; defNol = nolRelease;
        const cur = book - nolRelease; current = cur * (1 - defPct); defOther = cur * defPct;
      } else { book = taxable * rate; current = book * (1 - defPct); defOther = book * defPct; }
    }
    const dtl = prev.dtl + defOther;
    const dta = prev.dta - (recognised ? (prev.nolDTA - nolDTA) : 0);
    const r = { tax: book, curTax: current, defTax: defOther + defNol, defOther, defNol, nolUsed: used, nolCreated: created, nol, nolDTA, dtl, dta, taxRate: rate, etr: pbt ? book / pbt : null };
    y.tr = y.tr || {};
    y.tr.tax = { f: recognised ? 'Pretax income × tax rate (losses recognised as a deferred tax asset)' : 'Taxable income after loss carryforwards × tax rate (valuation allowance on losses)', p: [['Pretax income', pbt], ['Loss carryforward used', -used], ['Tax rate', rate]] };
    return r;
  }

  // ---------- reconciliation checks ----------
  function status(diff, tol) { if (!isNum(diff)) return 'fail'; const a = Math.abs(diff); return a <= tol ? 'pass' : a <= tol * 10 ? 'warn' : 'fail'; }
  function checks(model, out) {
    const tol = isNum(model.settings.tol) ? model.settings.tol : 0.5;
    const ys = out.years, x = out.x;
    const rows = [];
    const add = (id, label, by, why) => rows.push({ id, label, by, why, status: by.some(b => b.status === 'fail') ? 'fail' : by.some(b => b.status === 'warn') ? 'warn' : 'pass' });
    const per = f => ys.map(y => { const d = f(y); return { t: y.t, diff: d, status: status(d, tol) }; });
    add('open', 'Opening balance sheet balances', [{ t: 0, diff: x.check, status: status(x.check, tol) }], 'Total assets − total liabilities − total equity on the starting balance sheet. A difference here is carried into every forecast year.');
    add('bs', 'Balance sheet balances', per(y => y.check), 'Total assets − total liabilities − total equity, every forecast year.');
    add('bsMove', 'Forecast adds no new imbalance', per(y => y.checkMove), 'Change in the balance check since the opening balance sheet. Non-zero means a forecast link is broken.');
    add('cash', 'Cash flow reconciliation', per(y => y.cashEnd - (y.cashBeg + y.cfo + y.cfi + y.cff + y.fx)), 'Ending cash − (beginning cash + CFO + CFI + CFF + FX).');
    add('cashBS', 'Cash flow ending cash = balance sheet cash', per(y => y.cashEnd - y.cash), 'The cash flow statement is the only source of the balance sheet cash line.');
    add('debt', 'Debt schedule reconciliation', per((y, i) => y.debt - (ys[y.i - 1] ? ys[y.i - 1].debt : x.std + x.cltd + x.ltd) - (y.debtIss + y.debtRep + y.debtOther)), 'Ending debt − (beginning debt + borrowings − repayments ± other changes).');
    add('ppe', 'PP&E reconciliation', per(y => y.ppe - ((ys[y.i - 1] ? ys[y.i - 1].ppe : x.ppe) + y.capex + y.flAdd + y.acqPpe - y.dep - y.disposals - y.impair)), 'Ending PP&E − (beginning + additions − depreciation − disposals − impairments).');
    add('re', 'Retained earnings reconciliation', per(y => y.re - ((ys[y.i - 1] ? ys[y.i - 1].re : x.re) + y.niParent - y.div - y.prefDiv - (model.settings.buyback === 'retire' ? y.buyback : 0))), 'Ending retained earnings − (beginning + net income to the company − dividends ± other direct adjustments).');
    add('shares', 'Share count reconciliation', per(y => y.sharesEnd - (y.sharesBeg + y.awards + y.shIssued - y.shBought)), 'Ending shares − (beginning + awards + issued − repurchased).');
    add('tax', 'Deferred tax reconciliation', per(y => ((y.dtl - (ys[y.i - 1] ? ys[y.i - 1].dtl : x.dtl)) - (y.dta - (ys[y.i - 1] ? ys[y.i - 1].dta : x.dta))) - y.defTax), 'Change in deferred tax liabilities − change in deferred tax assets − deferred tax expense (used once, in the cash flow statement).');
    add('taxSplit', 'Tax expense = current + deferred', per(y => y.tax - y.curTax - y.defTax), 'Book tax expense − (current tax + deferred tax).');
    add('ni', 'Income statement adds up', per(y => y.ni - (y.ebit + y.intInc - y.intExp + y.nonop - y.tax + y.eqinc)), 'Net income − (EBIT + interest income − interest expense + other nonoperating − tax + equity-method income).');
    add('pres', 'D&A counted once in operating income', per(y => y.presCheck), 'Gross profit − operating expenses (as presented) − EBIT. D&A shown inside cost lines is not subtracted again.');
    add('fcff', 'FCFF reconciliation to cash from operations', per(y => fcffBridge(y, model).diff), 'FCFF rebuilt from CFO − CapEx through every reconciling item minus FCFF from EBIT. Shows the two cash flow definitions are consistent, not equal.');
    const neg = ys.filter(y => y.cash < -tol);
    add('fund', 'No funding gap (cash never negative)', ys.map(y => ({ t: y.t, diff: Math.min(0, y.cash), status: y.cash < -tol ? 'fail' : 'pass' })), neg.length ? 'Cash goes negative: the plan needs more financing than the assumptions provide. Nothing is plugged: add borrowing, a revolver, less buyback, or change the plan.' : 'Cash stays at or above zero without any balancing debt.');
    if (model.settings.interest === 'average') add('circ', 'Interest circularity solved', ys.map(y => ({ t: y.t, diff: y.converged ? 0 : NaN, status: y.converged ? 'pass' : 'fail', note: `${y.iter} iteration(s)` })), 'Average-balance interest is solved by repeated calculation until interest changes by less than $0.0000001mm.');
    return rows;
  }
  // FCFF from the cash flow statement: shows every difference between reported-style cash flow and FCFF
  function fcffBridge(y, model) {
    const reinvLeases = model.settings.flReinvest !== false;
    const items = [
      ['Cash from operations', y.cfo],
      ['− Capital expenditures', -y.capex],
      ['+ Interest expense (financing cost, not an operating cash flow)', y.intExp],
      ['− Interest income (cash and investments are valued separately)', -y.intInc],
      ['− Other nonoperating income', -y.nonop],
      ['− Stock-based compensation (treated as a real operating cost in FCFF)', -y.sbc],
      ['− Deferred taxes (FCFF uses operating taxes on EBIT)', -y.defTax],
      ['+ Book tax expense', y.tax],
      ['− Operating taxes on EBIT', -y.opTax],
      ['− Increase in other long-term liabilities (non-cash in CFO)', -y.cfoOther - y.eqinc + y.impair],
      ['− Acquisitions', -y.acq],
      ['− New finance leases (asset additions financed by leases)', reinvLeases ? -y.flAdd : 0],
    ];
    const rebuilt = sum(items.map(x => x[1]));
    return { items, rebuilt, fcff: y.fcff, diff: rebuilt - y.fcff };
  }

  // ---------- financial ratios ----------
  const RATIOS = [
    { k: 'gm', l: 'Gross margin', g: 'Profitability', f: 'Gross profit ÷ revenue', u: 'pct', fn: o => div(o.gp, o.rev) },
    { k: 'ebitdaM', l: 'EBITDA margin', g: 'Profitability', f: 'EBITDA ÷ revenue', u: 'pct', fn: o => div(o.ebitda, o.rev) },
    { k: 'ebitM', l: 'EBIT margin', g: 'Profitability', f: 'EBIT ÷ revenue', u: 'pct', fn: o => div(o.ebit, o.rev) },
    { k: 'npm', l: 'Net profit margin', g: 'Profitability', f: 'Net income to the company ÷ revenue', u: 'pct', fn: o => div(o.niParent, o.rev) },
    { k: 'roic', l: 'ROIC', g: 'Profitability', f: 'EBIT × (1 − tax rate) ÷ average invested capital (operating NWC + net PP&E + goodwill + intangibles)', u: 'pct', fn: (o, p) => p && isNum(o.ebit) ? div(o.ebit * (1 - nz(o.taxRateRef)), avg2(icOf(o), icOf(p))) : null, avg: true },
    { k: 'roe', l: 'ROE', g: 'Profitability', f: 'Net income to the company ÷ average equity attributable to the company', u: 'pct', fn: (o, p) => p ? div(o.niParent, avg2(eqParent(o), eqParent(p))) : null, avg: true },
    { k: 'roa', l: 'ROA', g: 'Profitability', f: 'Net income ÷ average total assets', u: 'pct', fn: (o, p) => p ? div(o.ni, avg2(taOf(o), taOf(p))) : null, avg: true },
    { k: 'cur', l: 'Current ratio', g: 'Liquidity', f: 'Current assets ÷ current liabilities', u: 'x', fn: o => div(tcaOf(o), tclOf(o)) },
    { k: 'quick', l: 'Quick ratio', g: 'Liquidity', f: '(Cash + short-term investments + receivables) ÷ current liabilities', u: 'x', fn: o => div(nz(o.cash) + nz(o.sti) + nz(o.ar), tclOf(o)) },
    { k: 'cashR', l: 'Cash ratio', g: 'Liquidity', f: '(Cash + short-term investments) ÷ current liabilities', u: 'x', fn: o => div(nz(o.cash) + nz(o.sti), tclOf(o)) },
    { k: 'de', l: 'Debt / equity', g: 'Leverage', f: 'Total debt (incl. finance leases) ÷ total equity', u: 'x', fn: o => div(debtOf(o), teOf(o)) },
    { k: 'dEbitda', l: 'Debt / EBITDA', g: 'Leverage', f: 'Total debt ÷ EBITDA', u: 'x', fn: o => o.ebitda > 0 ? div(debtOf(o), o.ebitda) : null },
    { k: 'ndEbitda', l: 'Net debt / EBITDA', g: 'Leverage', f: '(Total debt − cash − short-term investments) ÷ EBITDA', u: 'x', fn: o => o.ebitda > 0 && isNum(debtOf(o)) ? (debtOf(o) - nz(o.cash) - nz(o.sti)) / o.ebitda : null },
    { k: 'cov', l: 'Interest coverage', g: 'Leverage', f: 'EBIT ÷ interest expense', u: 'x', fn: o => o.intExp > 0 ? div(o.ebit, o.intExp) : null },
    { k: 'arT', l: 'Receivables turnover', g: 'Operating efficiency', f: 'Revenue ÷ average receivables', u: 'x', fn: (o, p) => p ? div(o.rev, avg2(o.ar, p.ar)) : null, avg: true },
    { k: 'invT', l: 'Inventory turnover', g: 'Operating efficiency', f: 'Cost of revenue ÷ average inventory', u: 'x', fn: (o, p) => p ? div(o.cogs, avg2(o.inv, p.inv)) : null, avg: true },
    { k: 'apT', l: 'Payables turnover', g: 'Operating efficiency', f: 'Cost of revenue ÷ average payables', u: 'x', fn: (o, p) => p ? div(o.cogs, avg2(o.ap, p.ap)) : null, avg: true },
    { k: 'dso', l: 'DSO', g: 'Operating efficiency', f: 'Ending receivables ÷ revenue × 365', u: 'days', fn: o => isNum(o.ar) && o.rev ? o.ar / o.rev * 365 : null },
    { k: 'dio', l: 'DIO', g: 'Operating efficiency', f: 'Ending inventory ÷ cost of revenue × 365', u: 'days', fn: o => isNum(o.inv) && o.cogs ? o.inv / o.cogs * 365 : null },
    { k: 'dpo', l: 'DPO', g: 'Operating efficiency', f: 'Ending payables ÷ cost of revenue × 365', u: 'days', fn: o => isNum(o.ap) && o.cogs ? o.ap / o.cogs * 365 : null },
    { k: 'ccc', l: 'Cash conversion cycle', g: 'Operating efficiency', f: 'DSO + DIO − DPO', u: 'days', fn: o => { const a = isNum(o.ar) && o.rev ? o.ar / o.rev * 365 : null, b = isNum(o.inv) && o.cogs ? o.inv / o.cogs * 365 : null, c = isNum(o.ap) && o.cogs ? o.ap / o.cogs * 365 : null; return [a, b, c].every(isNum) ? a + b - c : null; } },
    { k: 'cfoM', l: 'Operating cash flow margin', g: 'Cash flow', f: 'Cash from operations ÷ revenue', u: 'pct', fn: o => div(o.cfo, o.rev) },
    { k: 'capexR', l: 'CapEx / revenue', g: 'Cash flow', f: 'Capital expenditures ÷ revenue', u: 'pct', fn: o => div(o.capex, o.rev) },
    { k: 'fcfM', l: 'Free cash flow margin', g: 'Cash flow', f: '(Cash from operations − CapEx) ÷ revenue (a reported-style measure, not FCFF)', u: 'pct', fn: o => isNum(o.cfo) && isNum(o.capex) ? div(o.cfo - o.capex, o.rev) : null },
    { k: 'conv', l: 'Cash conversion', g: 'Cash flow', f: 'Cash from operations ÷ net income', u: 'x', fn: o => o.ni > 0 ? div(o.cfo, o.ni) : null },
  ];
  const div = (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b : null;
  const avg2 = (a, b) => isNum(a) && isNum(b) ? (a + b) / 2 : null;
  const tcaOf = o => isNum(o.tca) ? o.tca : (isNum(o.tcaCalc) ? o.tcaCalc : null);
  const tclOf = o => isNum(o.tcl) ? o.tcl : (isNum(o.tclCalc) ? o.tclCalc : null);
  const taOf = o => isNum(o.ta) ? o.ta : (isNum(o.taCalc) ? o.taCalc : null);
  const teOf = o => isNum(o.te) ? o.te : (isNum(o.teCalc) ? o.teCalc : null);
  const debtOf = o => [o.std, o.cltd, o.ltd, o.finl].some(isNum) ? nz(o.std) + nz(o.cltd) + nz(o.ltd) + nz(o.finl) : null;
  const icOf = o => isNum(o.nwc) && isNum(o.ppe) ? o.nwc + o.ppe + nz(o.gw) + nz(o.intang) : null;
  const eqParent = o => isNum(teOf(o)) ? teOf(o) - nz(o.nci) : null;
  function ratioSeries(model, res) {
    const h = model.hist; const P = h.periods;
    const hist = P.map((p, i) => { const o = histPeriod(h, p.id, model.settings); const pr = i ? histPeriod(h, P[i - 1].id, model.settings) : null; const tr = histRatios(h, p.id, i ? P[i - 1].id : null, model.settings).tax; o.taxRateRef = isNum(tr) ? tr : 0; if (pr) pr.taxRateRef = o.taxRateRef; return { id: p.id, label: p.label, o, p: pr }; });
    const fc = res && res.ok ? res.years.map((y, i) => { const o = Object.assign({}, y, { taxRateRef: y.taxRate, capex: y.capex }); const pr = i ? Object.assign({}, res.years[i - 1]) : Object.assign({}, res.x, { nwc: res.x.nwc }); return { id: 'F' + y.t, label: null, o, p: pr }; }) : [];
    return RATIOS.map(R => {
      const flag = [];
      const hv = hist.map(c => R.fn(c.o, c.p));
      const fv = fc.map(c => R.fn(c.o, c.p));
      if (['dio', 'invT'].includes(R.k) && hist.every(c => !isNum(c.o.inv) || c.o.inv === 0)) flag.push('No inventory reported: not meaningful for this company.');
      if (R.k === 'cov' && hist.some(c => !(c.o.intExp > 0))) flag.push('Undefined when interest expense is zero or not reported.');
      if (['dEbitda', 'ndEbitda'].includes(R.k)) flag.push('EBITDA here is EBIT + D&A from the cash flow statement, not a company-defined adjusted EBITDA.');
      if (R.k === 'roic') flag.push('Uses the period tax rate; invested capital excludes operating lease right-of-use assets, consistent with lease costs staying in EBIT.');
      if (R.k === 'conv') flag.push('Not meaningful when net income is zero or negative.');
      if (R.k === 'cur' || R.k === 'quick' || R.k === 'cashR') flag.push('Forecast current liabilities exclude the current portion of lease liabilities, which the model keeps in the lease lines.');
      return { ...R, hist: hv, fc: fv, flags: flag };
    });
  }

  // ---------- links to the DCF ----------
  // Compatible outputs for the existing DCF engine (corrected method): one forecast per scenario plus the
  // opening net debt items, all as of the same opening balance sheet date. Nothing in the DCF is overwritten.
  function dcfLink(model, opts = {}) {
    const out = { ok: true, scen: {}, problems: [], base: null };
    const op = opening(model);
    out.base = op.b;
    SC.forEach(s => {
      const r = run(model, s);
      if (!r.ok) { out.scen[s] = { ok: false, missing: r.missing }; out.problems.push(`${s}: ${r.missing.length} input(s) missing`); return; }
      const fails = r.checks.filter(c => c.status === 'fail' && c.id !== 'fund').map(c => c.label);
      out.scen[s] = {
        ok: true, failing: fails,
        years: r.years.map(y => ({ t: y.t, rev: y.rev, growth: y.g, ebitda: y.ebitda, da: y.da + y.impair, ebit: y.ebit, taxRate: y.taxRate, taxes: y.opTax, nopat: y.nopat, capex: y.capex + (model.settings.flReinvest !== false ? y.flAdd : 0), dnwc: y.dNwc, acq: y.acq, fcff: y.fcff, sbc: y.sbc, ic: y.ic, emPct: y.ebitda / y.rev, ebitPct: y.ebit / y.rev })),
        ic0: isNum(op.x.nwc) ? op.x.nwc + op.x.ppe + op.x.gw + op.x.intang : null,
        termTax: r.years[N - 1].taxRate,
      };
    });
    const x = op.x || {};
    out.bridge = { cash: x.cash, sti: x.sti, debt: nz(x.std) + nz(x.cltd) + nz(x.ltd) + nz(x.finl), finLeases: x.finl, opLeases: x.opl, minority: x.nci, preferred: op.b ? val(model.hist, 'mezz', op.b.bsPid) : null, shares: x.shares, date: op.b && op.b.end };
    return out;
  }

  return { SC, N, IS, BS, CF, DRIVERS, DBY, SC_KEYS, SH_KEYS, RATIOS, isNum, histPeriod, histRatios, allocDA, basePeriod, opening, run, checks, fcffBridge, ratioSeries, dcfLink, nwcOf, status };
})();
if (typeof module !== 'undefined') module.exports = FsmEngine;
