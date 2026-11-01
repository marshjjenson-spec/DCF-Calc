// ===== SEC FILING READER (no UI, no network) =====
// Reads an SEC "company facts" file (data.sec.gov/api/xbrl/companyfacts/CIK##########.json), and
// optionally the matching "submissions" file, and picks the newest appropriate disclosure for each metric.
// Every value comes back as a full source record: concept, raw value, converted value, units, form,
// accession number, fiscal period, period start and end (the measurement date), filing date and links.
// Nothing here guesses: a metric that is not in the file comes back as null.
const DCFSec = (() => {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
  const FORMS = /^10-[KQ](\/A)?$/;
  const cikNum = cik => String(cik || '').replace(/^0+/, '');
  const accnPath = accn => String(accn || '').replace(/-/g, '');
  const indexUrl = (cik, accn) => `https://www.sec.gov/Archives/edgar/data/${cikNum(cik)}/${accnPath(accn)}/`;
  const docUrl = (cik, accn, doc) => doc ? indexUrl(cik, accn) + doc : indexUrl(cik, accn);

  // Duration type from start and end dates
  function periodType(x) {
    if (!x.start) return 'instant';
    const d = days(x.start, x.end);
    if (d >= 80 && d <= 100) return 'Q';
    if (d >= 170 && d <= 190) return 'H1';
    if (d >= 260 && d <= 280) return '9M';
    if (d >= 350 && d <= 380) return /^10-K/.test(x.form || '') || x.fp === 'FY' ? 'FY' : 'T12';
    return 'other';
  }
  const PT_TEXT = { T12: 'twelve months ended (reported in a 10-Q)', instant: 'as of', Q: 'three months ended', H1: 'six months ended', '9M': 'nine months ended', FY: 'fiscal year ended', TTM: 'twelve months ended' };

  // All filings named in the file, newest first. Submissions data, when given, adds the document name and report date.
  function filings(json, subs) {
    const by = {};
    const add = (accn, form, filed, end) => {
      if (!accn || !FORMS.test(form || '')) return;
      const f = by[accn] = by[accn] || { accn, form, filed, periodEnd: null };
      if (String(filed) > String(f.filed || '')) f.filed = filed;
      if (end && (!f.periodEnd || end > f.periodEnd) && f.form === form) f.periodEnd = end;
    };
    const facts = (json && json.facts) || {};
    Object.values(facts).forEach(ns => Object.values(ns).forEach(c => Object.values(c.units || {}).forEach(list => list.forEach(x => {
      // the period of a filing: the latest duration end it reports (cover-page instants come after the period)
      add(x.accn, x.form, x.filed, x.start ? x.end : null);
    }))));
    const recent = subs && (subs.filings ? (subs.filings.recent || subs.filings) : subs);
    const list = recent && Array.isArray(recent.accessionNumber) ? recent.accessionNumber.map((a, i) => ({ accn: a, form: recent.form[i], filed: recent.filingDate[i], reportDate: recent.reportDate && recent.reportDate[i], doc: recent.primaryDocument && recent.primaryDocument[i] })) : (json && Array.isArray(json.filings) ? json.filings.map(f => ({ accn: f.accessionNumber || f.accn, form: f.form, filed: f.filingDate || f.filed, reportDate: f.reportDate, doc: f.primaryDocument || f.doc })) : []);
    list.forEach(f => {
      if (!FORMS.test(f.form || '')) return;
      const x = by[f.accn] = by[f.accn] || { accn: f.accn, form: f.form, filed: f.filed, periodEnd: null };
      if (f.reportDate) x.periodEnd = f.reportDate;
      if (f.doc) x.doc = f.doc;
      x.filed = f.filed || x.filed;
    });
    const cik = json && json.cik;
    return Object.values(by).map(f => Object.assign(f, { url: docUrl(cik, f.accn, f.doc) }))
      .sort((a, b) => String(b.filed).localeCompare(String(a.filed)) || String(b.periodEnd).localeCompare(String(a.periodEnd)));
  }
  function latest(json, subs) {
    const all = filings(json, subs);
    // the latest original report: a 10-K/A that only adds Part III (directors, pay) has no financial statements, so it is listed under amendments
    const q = all.find(f => f.form === '10-Q') || all.find(f => /^10-Q/.test(f.form)), k = all.find(f => f.form === '10-K') || all.find(f => /^10-K/.test(f.form));
    // the newest period: the filing with the latest period end (an amendment of an old period is not "newer")
    const newest = all.slice().sort((a, b) => String(b.periodEnd).localeCompare(String(a.periodEnd)) || String(b.filed).localeCompare(String(a.filed)))[0] || null;
    return { all, q: q || null, k: k || null, newest, amendments: all.filter(f => /\/A$/.test(f.form)) };
  }

  // Facts for one concept and unit, from 10-K / 10-Q filings. Where several filings report the same period,
  // the most recently filed wins, so a 10-K/A replaces the original and a later restatement replaces earlier ones.
  function entries(json, concept, unit, ns = 'us-gaap') {
    const c = json && json.facts && json.facts[ns] && json.facts[ns][concept];
    const list = c && c.units && c.units[unit];
    if (!list) return [];
    const by = {};
    list.filter(x => FORMS.test(x.form || '') && isNum(x.val)).forEach(x => {
      const k = (x.start || '') + '|' + x.end;
      const prev = by[k];
      if (!prev || String(x.filed) > String(prev.filed) || (x.filed === prev.filed && /\/A$/.test(x.form))) by[k] = x;
      else if (String(x.filed) === String(prev.filed) && x.accn === prev.accn && x.val !== prev.val) by[k] = Object.assign({}, prev, { conflict: true });
    });
    return Object.values(by).map(x => Object.assign({ concept, ns, unit, pt: periodType(x) }, x));
  }
  // Among several concepts (companies switch tags over time), the newest disclosure of the wanted period type.
  function pick(json, concepts, unit, pt, ns) {
    let best = null;
    concepts.forEach((c, i) => {
      entries(json, c, unit, ns).filter(x => !pt || (Array.isArray(pt) ? pt.includes(x.pt) : x.pt === pt)).forEach(x => {
        if (!best || x.end > best.end || (x.end === best.end && String(x.filed) > String(best.filed)) || (x.end === best.end && x.filed === best.filed && i < best.rank)) best = Object.assign({ rank: i }, x);
      });
    });
    return best;
  }

  // A source record for a picked fact
  function record(json, x, o) {
    if (!x) return null;
    const L = o.L || latest(json);
    const f = L.all.find(y => y.accn === x.accn) || {};
    const scale = o.scale == null ? 1e6 : o.scale;
    const value = isNum(x.val) ? x.val / scale : null;
    const newest = L.newest;
    let stale = false, staleNote = '';
    if (newest && x.accn !== newest.accn && newest.periodEnd && x.end < newest.periodEnd && !(x.pt === 'FY' && o.annual)) {
      stale = true;
      staleNote = `The newest filing (${newest.form}, period ended ${newest.periodEnd}, filed ${newest.filed}) does not report this item, so the latest older disclosure is used.`;
    }
    return {
      metric: o.metric, concept: (x.ns === 'dei' ? 'dei:' : 'us-gaap:') + x.concept, raw: x.val, rawUnit: x.unit === 'USD/shares' ? 'USD per share' : x.unit,
      value, unit: o.unit, scale: scale === 1e6 ? 'millions' : scale === 1 ? 'as reported' : String(scale),
      form: x.form, accn: x.accn, fy: x.fy, fp: x.fp, start: x.start || null, end: x.end, periodType: x.pt, periodText: (PT_TEXT[x.pt] || 'period ended') + ' ' + x.end,
      filed: x.filed, url: f.url || indexUrl(json.cik, x.accn), indexUrl: indexUrl(json.cik, x.accn),
      provider: 'SEC EDGAR XBRL company facts', cat: 'sec', verified: true, method: o.method || 'Reported',
      stale, staleNote, conflict: !!x.conflict, definition: o.definition || '',
    };
  }

  // Trailing twelve months: latest year-to-date + last fiscal year − the same year-to-date a year earlier.
  function ttm(json, concepts, o = {}) {
    const L = o.L || latest(json);
    const fy = o.fy || pick(json, concepts, 'USD', 'FY');
    if (!fy) return null;
    let best = null;
    concepts.forEach(c => entries(json, c, 'USD').filter(x => /^10-Q/.test(x.form) && ['Q', 'H1', '9M'].includes(x.pt) && x.end > fy.end && days(fy.end, x.start) <= 10 && days(fy.end, x.start) >= -3).forEach(x => { if (!best || x.end > best.end) best = x; }));
    const base = { metric: o.metric, unit: '$ millions', scale: 'millions', provider: 'Calculated from SEC EDGAR XBRL', cat: 'calc', periodType: 'TTM' };
    const fyRec = record(json, fy, { L, metric: 'FY', unit: '$ millions', annual: true });
    if (!best) return Object.assign(base, { value: fy.val / 1e6, raw: fy.val, end: fy.end, periodText: 'fiscal year ended ' + fy.end, method: `No 10-Q after the fiscal year ended ${fy.end}, so the twelve months equal the fiscal year (${fy.form} ${fy.accn}).`, parts: [fyRec], filed: fy.filed, form: fy.form, accn: fy.accn, url: fyRec.url });
    const cands = entries(json, best.concept, 'USD').filter(x => x.pt === best.pt && Math.abs(days(x.end, best.end) - 365) <= 8 && Math.abs(days(x.start, best.start) - 365) <= 8);
    const prior = cands.sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0];
    if (!prior) return Object.assign(base, { value: null, method: `The ${best.form} for ${best.end} has no comparable prior-year period, so TTM cannot be built.`, parts: [] });
    const fyB = best.concept === fy.concept ? fy : pick(json, [best.concept], 'USD', 'FY');
    if (!fyB || days(fyB.end, best.start) > 10) return Object.assign(base, { value: null, method: 'The fiscal-year figure uses a different tag from the quarterly figures, so TTM cannot be built safely.', parts: [] });
    const v = fyB.val + best.val - prior.val;
    const yr = record(json, best, { L, metric: 'YTD', unit: '$ millions' }), pr = record(json, prior, { L, metric: 'Prior YTD', unit: '$ millions' }), fr = record(json, fyB, { L, metric: 'FY', unit: '$ millions', annual: true });
    return Object.assign(base, { value: v / 1e6, raw: v, end: best.end, start: null, periodText: 'twelve months ended ' + best.end, form: best.form, accn: best.accn, filed: best.filed, url: yr.url,
      method: `TTM = FY ended ${fyB.end} (${fmtMM(fyB.val)}) + ${PT_TEXT[best.pt]} ${best.end} (${fmtMM(best.val)}) − ${PT_TEXT[prior.pt]} ${prior.end} (${fmtMM(prior.val)}) = ${fmtMM(v)} $mm. Calculated, not a reported figure.`,
      parts: [fr, yr, pr] });
  }
  const fmtMM = v => (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // ---- share data: separate types that must never stand in for each other ----
  const SHARE_DEFS = {
    actual: 'Actual common shares outstanding on a single date, from the filing cover page.',
    waBasicQ: 'Average basic shares over the latest quarter, used for basic EPS. Not a count on any date.',
    waDilQ: 'Average diluted shares over the latest quarter, used for diluted EPS. Not a current diluted count.',
    netDilQ: 'Net dilutive effect of stock awards in the latest quarter\'s EPS calculation. Already net of the treasury stock method, at that quarter\'s average price.',
    waBasicFY: 'Average basic shares over the last fiscal year.',
    waDilFY: 'Average diluted shares over the last fiscal year.',
    netDilFY: 'Net dilutive effect of stock awards in the last fiscal year\'s EPS calculation.',
    rsu: 'Unvested restricted stock units (and similar awards) outstanding at period end. A gross award count, not net dilution.',
    options: 'Stock options outstanding at period end. A gross count, before the treasury stock method; some may be out of the money.',
    optionsK: 'Weighted-average exercise price of options outstanding.',
    unrecog: 'Unrecognised compensation cost of unvested awards at period end.',
    antidil: 'Potential shares left out of diluted EPS because they were anti-dilutive.',
  };
  const NET_DIL = ['IncrementalCommonSharesAttributableToShareBasedPaymentArrangements', 'IncrementalCommonSharesAttributableToDilutiveEffectOfShareBasedPaymentArrangements', 'WeightedAverageNumberDilutedSharesOutstandingAdjustment', 'IncrementalCommonSharesAttributableToCallOptionsAndWarrants'];
  function shares(json, o = {}) {
    const L = o.L || latest(json);
    const R = (x, metric, extra) => x ? Object.assign(record(json, x, Object.assign({ L, metric, unit: 'millions of shares', definition: SHARE_DEFS[metric] }, extra || {})), { key: metric }) : null;
    const out = {};
    // cover page: if one filing lists several share counts for the same date (several classes), do not pick one
    const cov = entries(json, 'EntityCommonStockSharesOutstanding', 'shares', 'dei');
    const covAll = (json.facts && json.facts.dei && json.facts.dei.EntityCommonStockSharesOutstanding && json.facts.dei.EntityCommonStockSharesOutstanding.units.shares) || [];
    const top = cov.sort((a, b) => b.end.localeCompare(a.end) || String(b.filed).localeCompare(String(a.filed)))[0];
    if (top) {
      const same = covAll.filter(x => x.accn === top.accn && x.end === top.end);
      const vals = [...new Set(same.map(x => x.val))];
      out.actual = R(top, 'actual', { method: 'Reported on the filing cover page' });
      if (vals.length > 1) { out.actual.multiClass = true; out.actual.value = vals.reduce((a, b) => a + b, 0) / 1e6; out.actual.raw = vals.reduce((a, b) => a + b, 0); out.actual.method = `Sum of ${vals.length} share classes on the cover page`; }
    } else {
      const cs = pick(json, ['CommonStockSharesOutstanding'], 'shares', 'instant');
      if (cs) out.actual = R(cs, 'actual', { method: 'Balance sheet / stockholders\' equity share count (no cover-page count in the file)' });
    }
    out.waBasicQ = R(pick(json, ['WeightedAverageNumberOfSharesOutstandingBasic'], 'shares', 'Q'), 'waBasicQ');
    out.waDilQ = R(pick(json, ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares', 'Q'), 'waDilQ');
    out.waBasicFY = R(pick(json, ['WeightedAverageNumberOfSharesOutstandingBasic'], 'shares', 'FY'), 'waBasicFY', { annual: true });
    out.waDilFY = R(pick(json, ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares', 'FY'), 'waDilFY', { annual: true });
    const nd = (pt, b, d, key) => {
      const x = pick(json, NET_DIL, 'shares', pt);
      if (x && (!b || x.end >= b.end)) return R(x, key, pt === 'FY' ? { annual: true } : {});
      // not tagged: diluted − basic for the same period, labelled as calculated
      if (b && d && b.end === d.end && b.start === d.start) {
        const r = R(Object.assign({}, d, { val: d.val - b.val }), key, pt === 'FY' ? { annual: true } : {});
        r.concept = 'calculated'; r.method = `Diluted − basic weighted-average shares for the same period (${(d.val / 1e6).toFixed(1)} − ${(b.val / 1e6).toFixed(1)} mm). Calculated from reported EPS shares.`; r.cat = 'calc';
        return r;
      }
      return null;
    };
    out.netDilQ = nd('Q', out.waBasicQ && pick(json, ['WeightedAverageNumberOfSharesOutstandingBasic'], 'shares', 'Q'), pick(json, ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares', 'Q'), 'netDilQ');
    out.netDilFY = nd('FY', pick(json, ['WeightedAverageNumberOfSharesOutstandingBasic'], 'shares', 'FY'), pick(json, ['WeightedAverageNumberOfDilutedSharesOutstanding'], 'shares', 'FY'), 'netDilFY');
    out.rsu = R(pick(json, ['ShareBasedCompensationArrangementByShareBasedPaymentAwardEquityInstrumentsOtherThanOptionsNonvestedNumber'], 'shares', 'instant'), 'rsu');
    out.options = R(pick(json, ['ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingNumber'], 'shares', 'instant'), 'options');
    if (out.options) {
      const k = entries(json, 'ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingWeightedAverageExercisePrice', 'USD/shares').find(x => x.end === out.options.end && x.accn === out.options.accn)
        || entries(json, 'ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingWeightedAverageExercisePrice', 'USD/shares').find(x => x.end === out.options.end);
      if (k) out.optionsK = R(Object.assign({ pt: 'instant' }, k), 'optionsK', { scale: 1, unit: 'USD per share' });
    }
    out.unrecog = R(pick(json, ['EmployeeServiceShareBasedCompensationNonvestedAwardsTotalCompensationCostNotYetRecognized'], 'USD', 'instant'), 'unrecog', { unit: '$ millions' });
    out.antidil = R(pick(json, ['AntidilutiveSecuritiesExcludedFromComputationOfEarningsPerShareAmount'], 'shares', ['Q', 'FY']), 'antidil');
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  }


  // ---- financial statements: five fiscal years (newest first), TTM, latest quarter ----
  const ITEMS = {
    rev: { label: 'Revenue', c: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'] },
    cogs: { label: 'Cost of revenue', c: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'] },
    gp: { label: 'Gross profit', c: ['GrossProfit'] },
    ebit: { label: 'Operating income (EBIT)', c: ['OperatingIncomeLoss'] },
    da: { label: 'Depreciation & amortization', c: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization', 'DepreciationDepletionAndAmortizationPropertyPlantAndEquipment'] },
    interest: { label: 'Interest expense', c: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'] },
    ebt: { label: 'Pretax income', c: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'] },
    tax: { label: 'Income tax expense', c: ['IncomeTaxExpenseBenefit'] },
    ni: { label: 'Net income', c: ['NetIncomeLoss', 'ProfitLoss'] },
    cfo: { label: 'Operating cash flow', c: ['NetCashProvidedByUsedInOperatingActivities'] },
    capex: { label: 'Capital expenditures', c: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'] },
    sbc: { label: 'Stock-based compensation', c: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'] },
    dnwc: { label: 'Change in operating working capital (cash flow)', c: ['IncreaseDecreaseInOperatingCapital'] },
  };
  const CONCEPT_NOTES = {
    PaymentsToAcquireProductiveAssets: 'Tagged as payments for productive assets. Some companies (Amazon: "Purchases of property and equipment, net of proceeds from sales and incentives") report this net of proceeds. It excludes assets acquired under finance leases.',
    PaymentsToAcquirePropertyPlantAndEquipment: 'Cash paid for property, plant and equipment. Excludes assets acquired under finance leases or other non-cash additions.',
    IncreaseDecreaseInOperatingCapital: 'The tag reports an increase in operating capital as a positive number, which is a cash outflow. It is shown with the cash flow sign (increase = negative).',
    DepreciationDepletionAndAmortization: 'Depreciation, depletion and amortization from the cash flow statement.',
    ProfitLoss: 'Net income including non-controlling interests.',
  };
  function financials(json, o = {}) {
    const L = o.L || latest(json);
    const fyEnds = {};
    // fiscal years: the five newest 10-K annual periods for revenue
    const revFY = [];
    ITEMS.rev.c.forEach(c => entries(json, c, 'USD').filter(x => x.pt === 'FY').forEach(x => { if (!fyEnds[x.end] || x.filed > fyEnds[x.end].filed) fyEnds[x.end] = x; }));
    const ends = Object.keys(fyEnds).sort().reverse().slice(0, 5);
    const years = ends.map(end => ({ end, start: fyEnds[end].start, fy: +end.slice(0, 4), label: 'FY' + end.slice(0, 4), form: fyEnds[end].form, accn: fyEnds[end].accn, filed: fyEnds[end].filed, values: {}, recs: {} }));
    const conceptUsed = {};
    Object.entries(ITEMS).forEach(([k, it]) => {
      years.forEach(y => {
        let found = null;
        for (const c of it.c) { const e = entries(json, c, 'USD').find(x => x.pt === 'FY' && x.end === y.end); if (e) { found = e; break; } }
        if (found) {
          let v = found.val; if (k === 'dnwc') v = -v; if (k === 'capex') v = Math.abs(v);
          y.values[k] = v / 1e6;
          y.recs[k] = Object.assign(record(json, found, { L, metric: it.label, unit: '$ millions', annual: true }), { value: v / 1e6, note: CONCEPT_NOTES[found.concept] || '' });
          conceptUsed[k] = conceptUsed[k] || found.concept;
        }
      });
    });
    // derived per year
    years.forEach(y => {
      const V = y.values;
      if (V.gp == null && V.rev != null && V.cogs != null) { V.gp = V.rev - V.cogs; y.recs.gp = { metric: 'Gross profit', cat: 'calc', method: 'Revenue − cost of revenue', value: V.gp, periodText: 'fiscal year ended ' + y.end }; }
      if (V.ebit != null && V.da != null) { V.ebitda = V.ebit + V.da; y.recs.ebitda = { metric: 'EBITDA', cat: 'calc', method: 'Operating income + D&A (calculated, not a company-reported or adjusted EBITDA)', value: V.ebitda, periodText: 'fiscal year ended ' + y.end }; }
      if (V.cfo != null && V.capex != null) { V.fcf = V.cfo - V.capex; y.recs.fcf = { metric: 'Free cash flow', cat: 'calc', method: 'Operating cash flow − capital expenditures', value: V.fcf, periodText: 'fiscal year ended ' + y.end }; }
    });
    // TTM per item, each with its own three source figures
    const ttmItems = {};
    let ttmEnd = null, ttmNote = '';
    Object.entries(ITEMS).forEach(([k, it]) => {
      const fyx = years[0] && (() => { for (const c of it.c) { const e = entries(json, c, 'USD').find(x => x.pt === 'FY' && x.end === years[0].end); if (e) return e; } return null; })();
      if (!fyx) return;
      const t = ttm(json, [fyx.concept], { L, metric: it.label, fy: fyx });
      if (!t || t.value == null) { if (t) ttmItems[k] = t; return; }
      if (k === 'dnwc') { t.value = -t.value; t.raw = -t.raw; t.method += ' Shown with the cash flow sign.'; }
      if (k === 'capex') { t.value = Math.abs(t.value); }
      t.note = CONCEPT_NOTES[fyx.concept] || '';
      ttmItems[k] = t;
      if (!ttmEnd || t.end > ttmEnd) ttmEnd = t.end;
    });
    // all TTM items must end on the same date, or the derived figures mix periods
    Object.entries(ttmItems).forEach(([k, t]) => { if (t.value != null && t.end !== ttmEnd) { t.mismatch = true; t.method += ` Ends ${t.end}, not ${ttmEnd}: not comparable, left out of TTM.`; t.value = null; } });
    const TV = k => ttmItems[k] && ttmItems[k].value != null ? ttmItems[k].value : null;
    const derive = (k, label, f, method, deps) => { const v = f(); if (v != null && isFinite(v)) ttmItems[k] = { metric: label, cat: 'calc', periodType: 'TTM', value: v, end: ttmEnd, periodText: 'twelve months ended ' + ttmEnd, method, deps }; };
    if (TV('gp') == null && TV('rev') != null && TV('cogs') != null) derive('gp', 'Gross profit', () => TV('rev') - TV('cogs'), 'TTM revenue − TTM cost of revenue', ['rev', 'cogs']);
    if (TV('ebit') != null && TV('da') != null) derive('ebitda', 'EBITDA', () => TV('ebit') + TV('da'), 'TTM operating income + TTM D&A (calculated EBITDA)', ['ebit', 'da']);
    if (TV('cfo') != null && TV('capex') != null) derive('fcf', 'Free cash flow', () => TV('cfo') - TV('capex'), 'TTM operating cash flow − TTM capital expenditures', ['cfo', 'capex']);
    const ttmIsFY = !!(ttmItems.rev && ttmItems.rev.parts && ttmItems.rev.parts.length === 1);
    // latest quarter and the same quarter a year earlier, for growth
    let q = null;
    const qx = pick(json, [conceptUsed.rev || ITEMS.rev.c[0]], 'USD', 'Q');
    if (qx) {
      const prior = entries(json, qx.concept, 'USD').filter(x => x.pt === 'Q' && Math.abs(days(x.end, qx.end) - 365) <= 8).sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0];
      q = { end: qx.end, rev: qx.val / 1e6, rec: record(json, qx, { L, metric: 'Quarterly revenue', unit: '$ millions' }), prior: prior ? prior.val / 1e6 : null, priorEnd: prior ? prior.end : null, yoy: prior ? qx.val / prior.val - 1 : null };
    }
    // TTM one year earlier (for TTM growth): FY(-1) + YTD(-1) − YTD(-2)
    let ttmPrior = null;
    if (ttmItems.rev && ttmItems.rev.parts && ttmItems.rev.parts.length === 3 && years[1]) {
      const [, yr, pr] = ttmItems.rev.parts;
      const pp = entries(json, conceptUsed.rev, 'USD').filter(x => x.pt === yr.periodType && Math.abs(days(x.end, pr.end) - 365) <= 8 && Math.abs(days(x.start, pr.start) - 365) <= 8).sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0];
      if (pp && years[1].values.rev != null) ttmPrior = { value: years[1].values.rev + pr.value - pp.val / 1e6, end: pr.end, method: `FY ended ${years[1].end} + ${PT_TEXT[yr.periodType]} ${pr.end} − ${PT_TEXT[yr.periodType]} ${pp.end}` };
    }
    return { years, ttm: { items: ttmItems, end: ttmEnd, isFY: ttmIsFY, note: ttmNote }, quarter: q, ttmPrior, conceptUsed, latest: L, entity: json.entityName, cik: json.cik };
  }

  // Checks that stop one share metric from standing in for another
  function checkActualShares(v, sh, label = 'This value') {
    const flags = [];
    if (!isNum(v)) return flags;
    if (v > 0 && v < 1) flags.push({ level: 'bad', text: `${label} (${v}) looks like billions, not millions of shares.` });
    if (v > 100000) flags.push({ level: 'bad', text: `${label} (${v.toLocaleString('en-US')}) looks like raw shares or thousands, not millions.` });
    [['waBasicQ', 'quarterly basic weighted-average'], ['waDilQ', 'quarterly diluted weighted-average'], ['waBasicFY', 'annual basic weighted-average'], ['waDilFY', 'annual diluted weighted-average']].forEach(([k, l]) => {
      const r = sh && sh[k];
      if (r && isNum(r.value) && Math.abs(v - r.value) <= Math.max(0.5, r.value * 0.00005)) flags.push({ level: 'bad', key: k, text: `${label} (${v.toLocaleString('en-US')} mm) equals the ${l} share count for the ${r.periodText} (${r.form}). That is an average used for EPS, not actual shares outstanding on a date. Use the cover-page count.` });
    });
    if (sh && sh.actual && isNum(sh.actual.value) && !flags.length) {
      const d = Math.abs(v / sh.actual.value - 1);
      if (d > 0.02) flags.push({ level: 'warn', text: `${label} differs by ${(d * 100).toFixed(1)}% from the cover-page count of ${sh.actual.value.toLocaleString('en-US', { maximumFractionDigits: 3 })} mm as of ${sh.actual.end}.` });
    }
    return flags;
  }

  return { periodType, filings, latest, entries, pick, record, ttm, shares, financials, ITEMS, CONCEPT_NOTES, checkActualShares, SHARE_DEFS, indexUrl, docUrl, PT_TEXT };
})();
if (typeof module !== 'undefined') module.exports = DCFSec;
