// Data import mapping, provenance, and the model completion tracker.
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
const DCF = require('../js/engine.js'), M = require('../js/model.js'), D = require('../js/data.js');
const sample = require('../data/amzn-sample.json');
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-9) => Math.abs(a - b) < t;
(async () => {
  // ---------- Financial Modeling Prep mapping ----------
  const yrs = [2021, 2022, 2023, 2024, 2025, 2020]; // includes one extra year: only the latest five are kept
  const inc = yrs.map((y, i) => ({ date: `${y}-12-31`, fiscalYear: String(y), reportedCurrency: 'USD', cik: '0001018724', revenue: 1e9 * (100 + i * 10), costOfRevenue: 1e9 * (60 + i * 5), grossProfit: 1e9 * (40 + i * 5), operatingIncome: 1e9 * (10 + i), depreciationAndAmortization: 1e9 * 5, interestExpense: 1e9, incomeTaxExpense: 1e9 * 2, incomeBeforeTax: 1e9 * 10, weightedAverageShsOut: 10.5e9 }));
  const cf = yrs.map(y => ({ date: `${y}-12-31`, fiscalYear: String(y), depreciationAndAmortization: 6e9, stockBasedCompensation: 2e9, changeInWorkingCapital: -1e9, capitalExpenditure: -8e9 }));
  const bal = [{ date: '2025-12-31', cashAndCashEquivalents: 50e9, shortTermInvestments: 20e9, totalDebt: 70e9, minorityInterest: 0, deferredTaxLiabilitiesNonCurrent: 3e9 }];
  const fm = D.mapFMP('AMZN', { profile: [{ symbol: 'AMZN', companyName: 'Amazon.com, Inc.', exchange: 'NASDAQ', industry: 'Specialty Retail', currency: 'USD', cik: '0001018724', beta: 1.31, marketCap: 2.6e12, price: 240, range: '196.0-278.56' }],
    quote: [{ symbol: 'AMZN', price: 241.75, yearHigh: 278.56, yearLow: 196, timestamp: Date.UTC(2026, 6, 1) / 1000 }], income: inc, cashflow: cf, balance: bal, float: [{ outstandingShares: 10.731e9, date: '2026-06-30' }], treasury: [{ date: '2026-06-30', year10: 4.45 }] });
  ok('FMP: company name', fm.company.name === 'Amazon.com, Inc.' && fm.company.ticker === 'AMZN NASDAQ');
  ok('FMP: price from quote', fm.values.price.v === 241.75 && /2026-07-01/.test(fm.values.price.period));
  ok('FMP: 52-week range', fm.values.hi52.v === 278.56 && fm.values.lo52.v === 196);
  ok('FMP: shares in millions', near(fm.values.basic.v, 10731));
  ok('FMP: five years, oldest first', JSON.stringify(fm.hist.years) === JSON.stringify([2021, 2022, 2023, 2024, 2025]));
  ok('FMP: revenue in $ mm', fm.hist.rev[4] === 140000 && fm.hist.rev[0] === 100000);
  ok('FMP: D&A from the cash flow statement', fm.hist.da[0] === 6000);
  ok('FMP: opex = GP − (operating income + D&A)', fm.hist.opex[0] === 40000 - (10000 + 6000));
  ok('FMP: capex negative', fm.hist.capex[0] === -8000);
  ok('FMP: change in NWC keeps cash-flow sign', fm.hist.dnwc[0] === -1000);
  ok('FMP: bridge items', fm.values.cash.v === 50000 && fm.values.sti.v === 20000 && fm.values.debt.v === 70000 && fm.values.dtl.v === 3000);
  ok('FMP: debt flagged for review', fm.values.debt.review === true);
  ok('FMP: beta and Treasury are references, not inputs', fm.ref.beta.v === 1.31 && near(fm.ref.rf.v, 0.0445) && !fm.values.beta && !fm.values.rf);
  const fmd = D.mapFMP('X', { profile: [{ symbol: 'X', companyName: 'X' }], income: [{ date: '2025-12-31', fiscalYear: '2025', revenue: 1e9, weightedAverageShsOut: 10.5e9, weightedAverageShsOutDil: 10.72e9 }] });
  ok('FMP: weighted-average shares are references only, never inputs', !fmd.values.options && !fmd.values.treasury && !fmd.values.basic && near(fmd.ref.dilutedWA.v, 10720) && near(fmd.ref.basicWA.v, 10500));
  ok('FMP: missing share count is reported, not substituted', fmd.notes.some(n => /not used as a substitute/.test(n)));
  ok('FMP: share count carries its own date, market price its quote date', fm.values.basic.asOf === '2026-06-30' && fm.values.basic.cls === 'filing' && fm.values.price.cls === 'market' && fm.values.price.asOf === '2026-07-01');
  ok('FMP: effective tax is calculated', near(fm.ref.effTax.v, 0.2) && fm.ref.effTax.calculated);
  ok('FMP: every historical has a source with period', ['rev', 'gp', 'opex', 'da', 'interest', 'sbc', 'dnwc', 'capex'].every(k => fm.histSrc[k] && fm.histSrc[k].period === 'FY2021–FY2025'));
  // missing statements stay missing, never zero
  const fm2 = D.mapFMP('XYZ', { profile: [{ symbol: 'XYZ', companyName: 'XYZ Corp' }], quote: null, income: null, cashflow: null, balance: null });
  ok('FMP: no statements → no history and no zeros', fm2.hist === null && !fm2.values.price && fm2.notes.some(n => /historicals must be entered/.test(n)));
  // fetch wrapper with a fake fetch
  const routes = { profile: [{ symbol: 'AMZN', companyName: 'Amazon.com, Inc.', cik: '1018724' }], quote: [{ price: 200 }], 'income-statement': inc, 'balance-sheet-statement': bal, 'cash-flow-statement': cf, 'shares-float': { 'Error Message': 'Premium endpoint' }, 'treasury-rates': [] };
  const fakeFetch = async url => { const ep = url.split('/stable/')[1].split('?')[0]; const body = routes[ep]; return { ok: !(body && body['Error Message']), status: body && body['Error Message'] ? 402 : 200, json: async () => body }; };
  const fi = await D.fetchFMP('AMZN', 'k', fakeFetch);
  ok('FMP fetch: tolerates a refused optional endpoint', fi.values.price.v === 200 && fi.notes.some(n => /shares outstanding/.test(n)));
  ok('FMP fetch: no weighted-average fallback for shares outstanding', !fi.values.basic && fi.ref.basicWA);
  let threw = false; try { await D.fetchFMP('AMZN', 'k', async () => ({ ok: false, status: 401, json: async () => ({ 'Error Message': 'Invalid API KEY.' }) })); } catch (e) { threw = /Invalid API KEY/.test(e.message); }
  ok('FMP fetch: bad key reports the provider message', threw);
  // ---------- Alpha Vantage mapping ----------
  const av = D.mapAV('IBM', { overview: { Symbol: 'IBM', Name: 'International Business Machines', Exchange: 'NYSE', Currency: 'USD', Industry: 'COMPUTER & OFFICE EQUIPMENT', CIK: '51143', Beta: '0.7', '52WeekHigh': '250', '52WeekLow': '160', SharesOutstanding: '930000000', LatestQuarter: '2026-06-30' },
    quote: { 'Global Quote': { '05. price': '230.5', '07. latest trading day': '2026-07-01' } },
    income: { annualReports: [{ fiscalDateEnding: '2025-12-31', totalRevenue: '62000000000', grossProfit: '35000000000', operatingIncome: '9000000000', depreciationAndAmortization: '4000000000', interestExpense: 'None' }] },
    cashflow: { annualReports: [{ fiscalDateEnding: '2025-12-31', depreciationDepletionAndAmortization: '4500000000', capitalExpenditures: '1700000000' }] },
    balance: { annualReports: [{ fiscalDateEnding: '2025-12-31', cashAndCashEquivalentsAtCarryingValue: '13000000000', shortTermInvestments: 'None', shortTermDebt: '6000000000', longTermDebtNoncurrent: '50000000000' }] },
    treasury: { data: [{ date: '2026-06-30', value: '4.40' }] } });
  ok('AV: price and shares', av.values.price.v === 230.5 && av.values.basic.v === 930);
  ok('AV: "None" stays missing', av.hist.interest[4] === null && !av.values.sti);
  ok('AV: capex negative, opex derived', av.hist.capex[4] === -1700 && av.hist.opex[4] === 35000 - (9000 + 4500));
  ok('AV: debt = short + long', av.values.debt.v === 56000);
  ok('AV: industry title case', av.company.industry === 'Computer & Office Equipment');
  // ---------- SEC company facts mapping ----------
  const dur = (y, v, accn = '0001-25-000001') => ({ start: `${y}-01-01`, end: `${y}-12-31`, val: v, fy: y + 1, fp: 'FY', form: '10-K', filed: `${y + 1}-02-01`, accn });
  const facts = { cik: 1018724, entityName: 'AMAZON.COM, INC.', facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: '2026-04-15', val: 10.7e9, form: '10-Q', filed: '2026-05-01', accn: '0001-26-000002' }] } } },
    'us-gaap': { RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => dur(y, 1e9 * (300 + i * 50))).concat([{ start: '2025-10-01', end: '2025-12-31', val: 1e9, form: '10-K', fp: 'FY', filed: '2026-02-01' }]) } },
      CostOfGoodsAndServicesSold: { units: { USD: [2021, 2022, 2023, 2024, 2025].map((y, i) => dur(y, 1e9 * (200 + i * 30))) } },
      OperatingIncomeLoss: { units: { USD: [2025].map(y => dur(y, 60e9)) } },
      DepreciationDepletionAndAmortization: { units: { USD: [2025].map(y => dur(y, 50e9)) } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [2025].map(y => dur(y, 80e9)) } },
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [{ end: '2024-12-31', val: 70e9, form: '10-K', filed: '2025-02-01', accn: 'a' }, { end: '2026-03-31', val: 66e9, form: '10-Q', filed: '2026-05-01', accn: '0001-26-000002' }] } },
      LongTermDebtNoncurrent: { units: { USD: [{ end: '2026-03-31', val: 55e9, form: '10-Q', filed: '2026-05-01', accn: 'b' }] } },
      LongTermDebtCurrent: { units: { USD: [{ end: '2026-03-31', val: 5e9, form: '10-Q', filed: '2026-05-01', accn: 'b' }] } },
      OperatingLeaseLiabilityNoncurrent: { units: { USD: [{ end: '2026-03-31', val: 80e9, form: '10-Q', filed: '2026-05-01', accn: 'c' }] } },
      OperatingLeaseLiabilityCurrent: { units: { USD: [{ end: '2026-03-31', val: 10e9, form: '10-Q', filed: '2026-05-01', accn: 'c' }] } } } } };
  const sec = D.mapSEC(facts);
  ok('SEC: latest five fiscal years', JSON.stringify(sec.hist.years) === JSON.stringify([2021, 2022, 2023, 2024, 2025]));
  ok('SEC: quarterly entry inside a 10-K is ignored', sec.hist.rev[4] === 600000);
  ok('SEC: gross profit derived from cost of revenue', sec.hist.gp[4] === 600000 - 320000);
  ok('SEC: latest balance (10-Q) used for cash', sec.values.cash.v === 66000 && /2026-03-31/.test(sec.values.cash.period) && sec.values.cash.type === '10-Q quarterly report');
  ok('SEC: debt = non-current + current portion', sec.values.debt.v === 60000);
  ok('SEC: operating leases = non-current + current', sec.values.leases.v === 90000);
  ok('SEC: cover-page shares', sec.values.basic.v === 10700);
  ok('SEC: filing URL points at the accession folder', /Archives\/edgar\/data\/1018724\/000126000002\//.test(sec.values.cash.url));
  ok('SEC: no price imported', !sec.values.price);
  const f2 = JSON.parse(JSON.stringify(facts)); f2.facts['us-gaap'].IncrementalCommonSharesAttributableToShareBasedPaymentArrangements = { units: { shares: [dur(2024, 150e6), dur(2025, 180e6)] } };
  const sec2 = D.mapSEC(f2);
  ok('SEC: incremental dilutive shares are a reference only', near(sec2.ref.incrementalWA.v, 180) && !sec2.values.options && !sec2.values.treasury);
  ok('SEC: cover-page share count dated', sec.values.basic.asOf === '2026-04-15');
  const ms = M.blank(); D.applyImport(ms, sec);
  ok('SEC: valuation date set to the import date when there is no price', ms.inputs.company.valDate === sec.retrieved.slice(0, 10));
  let bad = false; try { D.mapSEC({ foo: 1 }); } catch (e) { bad = /not an SEC company facts file/.test(e.message); }
  ok('SEC: rejects other JSON', bad);
  // ---------- applying an import ----------
  const m = M.blank();
  const r = D.applyImport(m, fm);
  ok('apply: fills company and market data', m.inputs.company.name === 'Amazon.com, Inc.' && m.inputs.price === 241.75 && m.inputs.basic === 10731);
  ok('apply: sets valuation date from the price date', m.inputs.company.valDate === '2026-07-01');
  ok('apply: fills historicals', m.hist.rev[4] === 140000 && m.hist.years[4] === 2025);
  ok('apply: never fills forecast assumptions', m.inputs.tax.Base === null && m.inputs.g1.Base === null && m.inputs.erp.Base === null && m.inputs.kd.Base === null);
  ok('apply: 10-year Treasury fills every scenario', ['Base', 'Bear', 'Bull'].every(x => near(m.inputs.rf[x], 0.0445)) && m.sources.rf.auto);
  ok('apply: provider beta starts the Base case only', m.inputs.beta.Base === 1.31 && m.inputs.beta.Bear === null && m.inputs.beta.Bull === null && m.sources.beta.review);
  ok('apply: options and treasury never imported', m.inputs.options === null && m.inputs.treasury === null && m.dilution.method === null);
  ok('apply: as-of dates recorded', m.asOf.price === '2026-07-01' && m.asOf.range === '2026-07-01' && m.asOf.basic === '2026-06-30');
  ok('apply: source with period and retrieval time', m.sources.price.auto && m.sources.price.retrieved === fm.retrieved && /2026-07-01/.test(m.sources.price.period));
  ok('apply: change log records the provider', m.log.some(l => l.field === 'price' && l.by === fm.provider));
  ok('apply: provenance imported', D.provenance(m, 'price', m.inputs.price) === 'imported' && D.provenance(m, 'hist.rev', m.hist.rev) === 'imported');
  // the analyst overrides a value, then re-imports: the override is kept
  m.inputs.price = 250; m.log.unshift({ at: new Date().toISOString(), field: 'price', from: 241.75, to: 250 });
  ok('apply: provenance overridden', D.provenance(m, 'price', 250) === 'overridden');
  const fm3 = JSON.parse(JSON.stringify(fm)); fm3.values.price.v = 260; fm3.values.cash.v = 55000; fm3.retrieved = new Date(Date.now() + 1000).toISOString();
  const r2 = D.applyImport(m, fm3);
  ok('re-import keeps the analyst override', m.inputs.price === 250 && r2.kept.includes('price'));
  ok('re-import refreshes untouched imported values', m.inputs.cash === 55000);
  D.applyImport(m, fm3, { replace: true });
  ok('replace option overwrites', m.inputs.price === 260);
  // typed historicals are kept unless replace
  const m2 = M.blank(); m2.hist.rev[4] = 123; D.applyImport(m2, fm);
  ok('typed historicals kept', m2.hist.rev[4] === 123 && !m2.sources['hist.rev']);
  // ---------- completion tracker ----------
  const run = mm => { const e = M.engineInputs(mm).inp; return DCF.runAll(e, mm.mode); };
  const b = M.blank(); const tb = M.tracker(b, run(b), []);
  ok('tracker: blank model not complete, low %', !tb.complete && tb.pct < 10 && !tb.ready);
  ok('tracker: default choices do not count as complete', tb.sections.find(s => s.id === 'terminal').defaults.length === 3 && tb.sections.find(s => s.id === 'scenarios').defaults.length === 1);
  const sm = M.fromSample(sample); const ts = M.tracker(sm, run(sm), []);
  ok('tracker: sample calculates', ts.ready);
  ok('tracker: sample without sources is not complete and below 100%', !ts.complete && ts.pct < 100 && ts.sections.find(s => s.id === 'company').unsourced.length > 0);
  // make it complete: sources for every reported figure, review, save
  const full = M.fromSample(sample);
  const t0 = M.tracker(full, run(full), []);
  t0.sections.forEach(s => (s.unsourced || []).forEach(k => full.sources[k] = { name: 'Amazon 10-K', type: '10-K annual report', period: 'FY2025' }));
  FIELDS.filter(f => f.kind === 'forecast').forEach(f => full.reviewed[f.key] = true);
  full.savedAt = new Date().toISOString();
  const tf = M.tracker(full, run(full), [{ title: 'ok', status: 'good' }]);
  ok('tracker: complete only when sourced, reviewed, saved and checks pass', tf.complete && tf.pct === 100);
  const tfail = M.tracker(full, run(full), [{ title: 'TV share', status: 'bad' }]);
  ok('tracker: a failing check blocks completion', !tfail.complete && tfail.pct < 100 && tfail.warnings.some(w => w.level === 'bad'));
  full.log.unshift({ at: new Date(Date.now() + 5000).toISOString(), field: 'g1', s: 'Base', from: 0.14, to: 0.15 });
  ok('tracker: a change after saving needs a new save', !M.tracker(full, run(full), []).complete);
  const inv = M.fromSample(sample); inv.inputs.tax.Base = 2;
  const ti = M.tracker(inv, run(inv), []);
  ok('tracker: invalid input listed', ti.sections.find(s => s.id === 'forecast').invalid.some(i => i.key === 'tax'));
  // old saved files keep their choices as made
  ok('upgrade: older models have no default flags', Object.keys(M.upgrade(JSON.parse(JSON.stringify(Object.assign(M.fromSample(sample), { defaults: undefined })))).defaults).length === 0);
  // ---------- share dilution ----------
  const dm = () => { const x = M.blank(); x.inputs.price = 200; x.inputs.basic = 1000; return x; };
  let x = dm();
  ok('dilution: no method → not ok, missing', !M.dilution(x).ok && M.completion(x).market.items.some(i => i.key === 'dilution' && !i.ok));
  x.dilution.method = 'simple';
  ok('simple: blank estimate is missing, not zero', !M.dilution(x).ok && M.engineInputs(x).inp.options === null);
  x.dilution.est = 1030;
  let d = M.dilution(x);
  ok('simple: net = estimate − actual', d.ok && d.net === 30 && d.diluted === 1030 && M.engineInputs(x).inp.options === 30 && M.engineInputs(x).inp.treasury === 0);
  x.dilution.est = 900; ok('simple: estimate below actual is invalid', !M.dilution(x).ok && /below/.test(M.dilution(x).problem));
  x.dilution.est = null; x.dilution.ignore = true; d = M.dilution(x);
  ok('simple: explicit no-dilution choice warns', d.ok && d.net === 0 && d.warnings.length === 1);
  x = dm(); x.dilution.method = 'advanced';
  x.dilution.options[0] = { label: 'ITM', n: 20, k: 50 }; x.dilution.options[1] = { label: 'OTM', n: 10, k: 250 };
  d = M.dilution(x);
  ok('advanced: in-the-money options by treasury stock method', d.ok && near(d.rows[0].net, 15) && d.rows[1].net === 0 && !d.rows[1].itm);
  x.dilution.rsu = { n: 30, unrecog: 2000 }; d = M.dilution(x);
  ok('advanced: RSUs net of unrecognised cost / price', near(d.rows.find(r => r.type === 'RSUs').net, 20));
  x.dilution.rsu = { n: 30, unrecog: null }; d = M.dilution(x);
  ok('advanced: RSUs without unrecognised cost counted in full, with a note', near(d.rows.find(r => r.type === 'RSUs').net, 30) && d.warnings.some(w => /in full/.test(w)));
  x.dilution.warrants[0] = { label: 'W', n: 10, k: 120 }; x.dilution.converts[0] = { label: 'Notes', n: 5, k: 160, net: false }; x.dilution.converts[1] = { label: 'Net', n: 5, k: 160, net: true };
  d = M.dilution(x);
  ok('advanced: warrants TSM', near(d.rows.find(r => r.type === 'Warrants').net, 4));
  ok('advanced: if-converted adds all shares and warns about debt', near(d.rows.find(r => r.label === 'Notes').net, 5) && d.warnings.some(w => /Remove its principal/.test(w)));
  ok('advanced: net share settlement adds only the excess', near(d.rows.find(r => r.label === 'Net').net, 5 * (200 - 160) / 200));
  ok('advanced: totals tie out', near(d.net, 15 + 0 + 30 + 4 + 5 + 1) && near(d.diluted, 1055) && near(d.gross - d.buyback, d.net));
  const ei = M.engineInputs(x).inp; ok('advanced: engine gets gross and buyback', near(ei.options - ei.treasury, d.net));
  x.dilution.options[2] = { label: null, n: 5, k: null }; ok('advanced: half-filled row is invalid', !M.dilution(x).ok && /Options 3/.test(M.dilution(x).problem));
  x = dm(); x.dilution.method = 'advanced'; ok('advanced: nothing entered is missing', !M.dilution(x).ok);
  x.dilution.none = true; ok('advanced: explicit none', M.dilution(x).ok && M.dilution(x).net === 0);
  x = dm(); x.dilution.method = 'advanced'; x.inputs.price = null; x.dilution.options[0] = { n: 1, k: 1 }; ok('advanced: needs a price', !M.dilution(x).ok);
  // the example and old files keep the workbook's typed totals
  const ex = M.fromSample(sample); ok('example keeps workbook totals', ex.dilution.method === 'totals' && M.dilution(ex).ok && M.dilution(ex).net === 222);
  const old = JSON.parse(JSON.stringify(M.fromSample(sample))); delete old.dilution; ok('older files upgrade to workbook totals', M.upgrade(old).dilution.method === 'totals');
  // market checks
  const mc = M.fromSample(sample); mc.asOf = { price: '2026-06-01', range: '2026-07-01', basic: '2026-01-01' };
  const w = M.marketChecks(mc);
  ok('market: stale price flagged', w.some(z => z.key === 'price' && /days before/.test(z.text)));
  ok('market: stale share count flagged', w.some(z => z.key === 'basic' && /more than 4 months/.test(z.text)));
  mc.inputs.basic = 10731000000; ok('market: share units checked', M.marketChecks(mc).some(z => /in shares instead of millions/.test(z.text)));
  mc.inputs.hi52 = 100; ok('market: high below low', M.marketChecks(mc).some(z => z.level === 'bad'));
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
