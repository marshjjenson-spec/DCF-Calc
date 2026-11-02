// Change in NWC: component lines from real SEC filings, signs, classification, the three outputs, the balance-sheet
// method, the importer, the forecast link and the sign of working capital through FCFF and value.
// Fixtures (tests/fixtures/nwc) are extracts of SEC company facts files retrieved 1 Nov 2026; see the README there.
const N = require('../js/nwc.js'), S = require('../js/sec.js'), H = require('../js/nwc-help.js'), DH = require('../js/help.js');
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
global.DCFNwc = N;
const D = require('../js/data.js'), M = require('../js/model.js'), E = require('../js/engine.js');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-6) => typeof a === 'number' && Math.abs(a - b) < t;
const fx = n => require('./fixtures/nwc/sec-' + n + '.json');
const amzn = fx('amzn');

// ---- Amazon FY2025: the six reported lines, signs kept, from the 10-K ----
const A = N.fromSec(amzn), P = A.periods.FY2025;
ok('Amazon FY2025 lines come from the 2025 10-K (0001018724-26-000004)', P && P.accn === '0001018724-26-000004' && P.end === '2025-12-31' && P.form === '10-K');
ok('Amazon FY2025 has exactly six lines', P.lines.length === 6);
const L = id => P.lines.find(l => l.id === id);
ok('inventories −3,002', near(L('IncreaseDecreaseInInventories').cf, -3002));
ok('accounts receivable, net and other −7,333', near(L('IncreaseDecreaseInAccountsReceivableAndOtherOperatingAssets').cf, -7333));
ok('other assets −15,632', near(L('IncreaseDecreaseInOtherNoncurrentAssets').cf, -15632));
ok('accounts payable +11,231', near(L('IncreaseDecreaseInAccountsPayable').cf, 11231));
ok('accrued expenses and other −5,019', near(L('IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities').cf, -5019));
ok('unearned revenue −214', near(L('IncreaseDecreaseInContractWithCustomerLiability').cf, -214));
ok('asset sign: XBRL +3,002 increase in inventory is −3,002 of cash', near(L('IncreaseDecreaseInInventories').raw, 3002));
ok('every line keeps its source: accession, period, link', P.lines.every(l => l.accn && l.start === '2025-01-01' && l.end === '2025-12-31' && /amzn-20251231\.htm$|\/000101872426000004\//.test(l.url)));
const s0 = N.summary(P.lines, {}, []);
ok('1. sum of all reported lines = −19,969', near(s0.all, -19969));
ok('partial subset: receivables + inventory + payables = +896', near(s0.subset, 896));
ok('2. clearly operating (incl. unearned revenue) = +682', near(s0.core, 682));
ok('3. analyst-adjusted default = clearly operating only (mixed lines excluded) = +682', near(s0.adjusted, 682));
ok('reported and adjusted stay separate', s0.all !== s0.adjusted);
ok('mixed lines are not silently classed operating', L('IncreaseDecreaseInOtherNoncurrentAssets').cls === 'review' && L('IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities').cls === 'review');
ok('status is incomplete while material mixed lines are unresolved', s0.status === 'incomplete' && s0.material.length === 2);
// the analyst classifies: other assets not operating, accrued operating
const ed = { IncreaseDecreaseInOtherNoncurrentAssets: { cls: 'exclude', reason: 'Noncurrent' }, IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities: { cls: 'core' } };
const s1 = N.summary(P.lines, ed, []);
ok('after classification: complete, adjusted = 682 − 5,019 = −4,337', s1.status === 'complete' && near(s1.adjusted, -4337) && near(s1.all, -19969));
// an adjustment for the operating part of a mixed line
const s2 = N.summary(P.lines, { IncreaseDecreaseInOtherNoncurrentAssets: { cls: 'exclude' }, IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities: { cls: 'exclude' } }, [{ label: 'Operating part of accrued expenses (hypothetical)', amt: -1000, inc: true }]);
ok('adjustment added to the analyst figure only', near(s2.adjusted, 682 - 1000) && near(s2.all, -19969) && near(s2.core, 682));
ok('an included line with no amount is not treated as zero', N.summary([], {}, [{ label: 'x', amt: null, inc: true }]).adjusted === null);

// ---- Amazon TTM: the 10-Q reports a twelve-month column ----
const T = A.periods.TTM;
ok('Amazon TTM to 2026-09-30 is reported (T12 column of the Q3 10-Q)', T && T.reported && T.end === '2026-09-30' && T.accn === '0001018724-26-000040');
ok('Amazon TTM sum of all lines −33,037', near(N.summary(T.lines, {}, []).all, -33037));

// ---- balance-sheet method ----
const b25 = A.bs['2025-12-31'], b24 = A.bs['2024-12-31'];
ok('Amazon operating NWC 2025 = (229,083 − 86,810 − 300 − 36,219) − (218,005 − 3,203 − 14,199) = −94,849', near(b25.opNwc, -94849));
ok('Amazon operating NWC 2024 = −72,924', near(b24.opNwc, -72924));
ok('reported current assets − current liabilities is kept separately (11,078)', near(b25.reportedNwc, 11078));
ok('teaching text uses the same balance-sheet figures', H.amazon().includes('−94,849') && H.amazon().includes('−72,924'));
ok('balance-sheet change is not forced to equal the cash flow lines', Math.abs(-(b25.opNwc - b24.opNwc) - s0.all) > 1000);

// ---- other presentations ----
const W = N.fromSec(fx('wmt')), C = N.fromSec(fx('cost')), AP = N.fromSec(fx('aapl')), MS = N.fromSec(fx('msft')), TS = N.fromSec(fx('tsla')), F = N.fromSec(fx('f'));
ok('Walmart FY2026: fiscal year ending January (2026-01-31)', W.periods.FY2026 && W.periods.FY2026.end === '2026-01-31');
ok('Walmart deferred income taxes are not working capital (skipped)', !W.periods.FY2026.lines.some(l => /DeferredIncomeTaxes/.test(l.id)));
ok('Walmart FY2026 complete: small accrued-tax line left out, +639', N.summary(W.periods.FY2026.lines, {}, []).status === 'complete' && near(N.importable(W.periods.FY2026).v, 639));
ok('Costco: netted "other operating assets and liabilities" is mixed', C.periods.FY2025.lines.find(l => l.id === 'IncreaseDecreaseInOtherOperatingCapitalNet').cls === 'review');
ok('Costco has no 10-Q after its fiscal year: no TTM invented', !C.periods.TTM);
const apL = AP.periods.FY2025.lines;
ok('Apple: signs reconcile to its operating cash flow (WC lines sum −25,000)', near(N.summary(apL, {}, []).all, -25000));
ok('Apple: inventories fell, so cash +1,400', near(apL.find(l => l.id === 'IncreaseDecreaseInInventories').cf, 1400));
ok('Microsoft: noncurrent "other" lines flagged for review', MS.periods.FY2025.lines.filter(l => l.noncurrent).every(l => l.cls === 'review'));
ok('Tesla: combined payables-and-accrued line is operating', TS.periods.FY2025.lines.find(l => l.id === 'IncreaseDecreaseInAccountsPayableAndAccruedLiabilities').cls === 'core');
ok('Ford: finance receivables excluded and the finance arm flagged', F.finArm && F.periods.FY2025.lines.find(l => l.id === 'IncreaseDecreaseInFinanceReceivables').cls === 'exclude');
ok('Ford: finance receivables never in the clearly operating total', !N.summary(F.periods.FY2025.lines, {}, []).lines.filter(l => l.cls === 'core').some(l => /Finance/.test(l.id)));
// one filing per period: a tag replaced in a later filing is not added twice
ok('each period uses lines from one filing only', [A, W, C, AP, MS, TS, F].every(x => Object.values(x.periods).every(p => new Set(p.lines.map(l => l.accn)).size <= 1)));
// combined line and its parts in one period: parts are details
const fake = { cik: 1, facts: { 'us-gaap': {
  IncreaseDecreaseInAccountsPayableAndAccruedLiabilities: { units: { USD: [{ start: '2024-01-01', end: '2024-12-31', val: 100e6, accn: 'a', form: '10-K', fy: 2024, fp: 'FY', filed: '2025-02-01' }] } },
  IncreaseDecreaseInAccountsPayable: { units: { USD: [{ start: '2024-01-01', end: '2024-12-31', val: 60e6, accn: 'a', form: '10-K', fy: 2024, fp: 'FY', filed: '2025-02-01' }] } },
  IncreaseDecreaseInInventories: { units: { USD: [{ start: '2024-01-01', end: '2024-12-31', val: 30e6, accn: 'a', form: '10-K', fy: 2024, fp: 'FY', filed: '2025-02-01' }] } } } } };
const fk = N.fromSec(fake).periods.FY2024, fs = N.summary(fk.lines, {}, []);
ok('no double count: payables inside a combined line are a detail', fk.lines.find(l => l.id === 'IncreaseDecreaseInAccountsPayable').cls === 'detail' && near(fs.all, 100 - 30));

// ---- importer ----
const impA = D.mapSEC(amzn);
ok('importer: Amazon years left blank (mixed lines), never zero', impA.hist.dnwc.every(v => v === null));
ok('importer: the worksheet data is attached with every year', ['FY2025', 'FY2024', 'FY2023', 'FY2022', 'FY2021'].every(k => impA.nwcData.periods[k]));
ok('importer: a note explains which lines need review', impA.notes.some(n => /FY2025: Not filled in: 2 material lines/.test(n)));
const impW = D.mapSEC(fx('wmt'));
ok('importer: Walmart complete years filled with the clearly operating sum and flagged for review', near(impW.hist.dnwc[4], 639) && impW.hist.dnwc[2] === null && impW.histSrc.dnwc.review === true);
ok('importer: Walmart TTM from components when complete', impW.ttm.items.dnwc && near(impW.ttm.items.dnwc.value, -598) && impW.ttm.items.dnwc.cat === 'calc');
// user overrides survive a re-import
const m = M.blank(); D.applyImport(m, impW, { fresh: true });
m.hist.dnwc[4] = 500; m.nwc = { edits: { FY2026: { IncreaseDecreaseInAccruedTaxesPayable: { cls: 'core' } } } };
const r2 = D.applyImport(m, D.mapSEC(fx('wmt')));
ok('re-import keeps the typed value (offered for review instead)', m.hist.dnwc[4] === 500 && r2.pending.some(p => p.key === 'hist'));
ok('re-import keeps the analyst classifications', m.nwc.edits.FY2026.IncreaseDecreaseInAccruedTaxesPayable.cls === 'core');
// CIK: a model for another company does not inherit an old CIK
const m2 = M.blank(); m2.meta = { cik: '0001018724', symbol: 'AMZN' }; m2.inputs.company.ticker = 'AMZN';
D.applyImport(m2, { providerId: 'av', provider: 'x', retrieved: new Date().toISOString(), symbol: 'TSLA', company: { name: 'Tesla, Inc.', ticker: 'TSLA', cik: null }, values: {}, tri: {}, hist: null, histSrc: {}, ref: {}, notes: [] });
ok('importing a different company drops the old CIK', m2.meta.cik === null);
ok('EDGAR searches without a CIK are not offered (would show other companies)', DH.edgarSearch('Inventories', null) === null);
ok('EDGAR searches are limited to the company CIK, padded to 10 digits', /ciks=0001018724$/.test(DH.edgarSearch('Inventories', 1018724)) && /ciks=0001018724$/.test(DH.edgarSearch('Inventories', '0001018724')));

// ---- history and forecast link ----
const mh = M.blank(); D.applyImport(mh, impA, { fresh: true });
mh.hist.dnwc[4] = -4337; // FY2025 selected after classification
const hist = N.history(mh), h25 = hist.find(c => c.key === 'FY2025');
ok('history: revenue, NWC, BS change and reported lines for FY2025', near(h25.rev, 716924) && near(h25.nwc, -94849) && near(h25.bsChg, -21925) && near(h25.reported, -19969));
ok('history: NWC % revenue = −94,849 ÷ 716,924', near(h25.pctRev, -94849 / 716924));
ok('history: forecast-direction ratio = −(−4,337) ÷ 78,965 = +5.49%', near(h25.incrSel, 4337 / 78965));
ok('history: missing selected values stay missing', hist.filter(c => c.key !== 'FY2025').every(c => c.sel === null && c.incrSel === null));
mh.inputs.nwc = { Base: -0.055, Bear: 0.06, Bull: null };
ok('sign-error check: forecast −5.5% vs history +5.5% is flagged', N.forecastChecks(mh).some(w => w.s === 'Base') && !N.forecastChecks(mh).some(w => w.s === 'Bear'));

// ---- learning calculator and teaching examples ----
const lr = N.learn(N.LEARN_DEFAULT());
ok('learning calculator: beginning 80, ending 123, change +43, cash −43', near(lr.nwcB, 80) && near(lr.nwcE, 123) && near(lr.chg, 43) && near(lr.cash, -43) && lr.check);
ok('learning calculator: FCFF 335 − 43 = 292', near(lr.fcff, 292));
ok('learning text explains receivables +50 → cash −50', /increased by \$50 million.*reduces operating cash flow by \$50 million/.test(lr.rows[0].text));
ok('payables +40 provides cash', near(lr.rows.find(r => r.k === 'ap').cash, 40));
const lr2 = N.learn({ begin: { ar: 100 }, end: {} });
ok('a blank balance stays blank, not zero', lr2.chg === null && lr2.rows[0].chg === null);
const fc = N.fcff({ ebit: 500, tax: 0.25, da: 80, capex: 120, dnwc: 43 });
ok('FCFF = 375 + 80 − 120 − 43 = 292, and the cash-sign form gives the same', near(fc.fcff, 292) && near(fc.fcffCashSign, 292) && fc.same);
ok('an NWC increase lowers FCFF; a decrease raises it', N.fcff({ ebit: 500, tax: 0.25, da: 80, capex: 120, dnwc: 43 }).fcff < N.fcff({ ebit: 500, tax: 0.25, da: 80, capex: 120, dnwc: 0 }).fcff && N.fcff({ ebit: 500, tax: 0.25, da: 80, capex: 120, dnwc: -43 }).fcff > 335);
const f1 = N.forecast({ rev0: 1000, rev1: 1200, nwc0: 100, incr: 0.15, pctRev: 0.1 });
ok('incremental example: 15% × 200 = 30', near(f1.A.dNwc, 30) && near(f1.A.nwc1, 130));
ok('% of revenue: 10% × 1,200 − 100 = 20, implied 10%', near(f1.B.dNwc, 20) && near(f1.B.ratio, 0.1));
const f2 = N.forecast({ rev0: 1200, rev1: 1320, nwc0: 130, incr: 0.15, pctRev: 0.1 });
ok('teaching table: A +18, B at 10% +2', near(f2.A.dNwc, 18) && near(f2.B.dNwc, 2));

// ---- the model: working capital through FCFF, terminal value and value ----
const sample = require('../data/amzn-sample.json');
const base = M.fromSample(sample);
base.mode = 'corrected';
const run = (mdl, nwc) => { const x = JSON.parse(JSON.stringify(mdl)); x.inputs.nwc = { Base: nwc, Bear: nwc, Bull: nwc }; const { inp } = M.engineInputs(x); return E.run(inp, 'Base', x.mode); };
const r0 = run(base, 0), rUp = run(base, 0.15), rDn = run(base, -0.15);
ok('engine: a positive NWC ratio (investment) lowers year-1 FCFF by exactly ΔNWC', r0.ok && rUp.ok && near(r0.years[0].fcff - rUp.years[0].fcff, rUp.years[0].dnwc) && rUp.years[0].dnwc > 0);
ok('engine: ΔNWC = (revenue − prior revenue) × ratio', near(rUp.years[1].dnwc, (rUp.years[1].rev - rUp.years[0].rev) * 0.15, 1e-6));
ok('engine: more working capital → lower enterprise value; less → higher', rUp.ev < r0.ev && rDn.ev > r0.ev);
ok('engine: corrected terminal year has no separate NWC line (reinvestment = g ÷ ROIC), so it is not counted twice', rUp.years[10].dnwc === null && near(rUp.years[10].fcff, r0.years[10].fcff, 1e-6));
const wb = JSON.parse(JSON.stringify(base)); wb.mode = 'workbook';
const w0 = run(wb, 0), wUp = run(wb, 0.15);
ok('workbook terminal year subtracts its ΔNWC once', near(w0.years[10].fcff - wUp.years[10].fcff, wUp.years[10].dnwc, 1e-6));

console.log(`nwc: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
