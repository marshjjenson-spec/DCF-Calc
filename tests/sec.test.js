// SEC filing reader against real company facts extracts (filed since 2024) for Amazon, Tesla and Strategy.
// Expected figures were checked against the filings themselves (see tests/fixtures/README.md).
const S = require('../js/sec.js'), D = require('../js/data.js'), M = require('../js/model.js');
global.FIELDS = require('../js/fields.js').FIELDS; global.HIST_FIELDS = require('../js/fields.js').HIST_FIELDS;
let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const near = (a, b, t = 1e-6) => a != null && Math.abs(a - b) < t;
const amzn = require('./fixtures/sec-amzn.json'), tsla = require('./fixtures/sec-tsla.json'), mstr = require('./fixtures/sec-mstr.json');

// ---- latest filings ----
const L = S.latest(amzn);
ok('AMZN newest filing is the Q3 2026 10-Q', L.newest.accn === '0001018724-26-000040' && L.newest.form === '10-Q' && L.newest.periodEnd === '2026-09-30' && L.newest.filed === '2026-10-30');
ok('AMZN latest 10-K is FY2025', L.k.accn === '0001018724-26-000004' && L.k.periodEnd === '2025-12-31');
ok('AMZN filing link is the primary document', /000101872426000040\/amzn-20260930\.htm$/.test(L.newest.url));
ok('MSTR newest filing is the Q2 2026 10-Q', S.latest(mstr).newest.periodEnd === '2026-06-30');

// ---- share types ----
const sh = S.shares(amzn, { L });
ok('actual shares: cover page, raw and converted', sh.actual.raw === 10813138306 && near(sh.actual.value, 10813.138306) && sh.actual.end === '2026-10-21' && sh.actual.concept === 'dei:EntityCommonStockSharesOutstanding');
ok('Q3 basic weighted average 10,797 (three months)', sh.waBasicQ.value === 10797 && sh.waBasicQ.periodType === 'Q' && sh.waBasicQ.end === '2026-09-30');
ok('Q3 diluted weighted average 10,929', sh.waDilQ.value === 10929);
ok('Q3 net dilutive effect 132 (not the FY2025 171)', sh.netDilQ.value === 132 && sh.netDilQ.accn === '0001018724-26-000040');
ok('FY2025 net dilutive effect kept separately as 171', sh.netDilFY.value === 171 && sh.netDilFY.periodType === 'FY');
ok('actual shares are not the weighted average', sh.actual.value !== sh.waBasicQ.value);
ok('RSUs are not in company facts for Amazon (dimensional): not invented', !sh.rsu);
ok('unrecognised compensation $22,300 mm', sh.unrecog.value === 22300);
const flags = S.checkActualShares(10797, sh, 'x');
ok('10,797 entered as actual shares is flagged as a quarterly weighted average', flags.some(f => f.level === 'bad' && /quarterly basic weighted-average/.test(f.text)));
ok('the cover-page count passes', S.checkActualShares(10813.138306, sh).length === 0);
ok('raw shares typed as millions are flagged', S.checkActualShares(10813138306, sh).some(f => /raw shares/.test(f.text)));
const msh = S.shares(mstr);
ok('MSTR: no single cover-page count (two classes): left empty', !msh.actual);
ok('MSTR: net dilution calculated from EPS shares and labelled', msh.netDilQ.value === 0 && msh.netDilQ.cat === 'calc');

// ---- TTM ----
const F = S.financials(amzn, { L });
const r = F.ttm.items.rev;
ok('AMZN TTM revenue = 716,924 + 584,069 − 503,538 = 797,455', near(r.value, 797455) && r.parts.length === 3 && near(r.parts[0].value, 716924) && near(r.parts[1].value, 584069) && near(r.parts[2].value, 503538));
ok('TTM labelled calculated, with the end date', r.cat === 'calc' && r.end === '2026-09-30' && /Calculated, not a reported figure/.test(r.method));
ok('TTM parts carry accession numbers and filing dates', r.parts[0].accn === '0001018724-26-000004' && r.parts[1].accn === '0001018724-26-000040' && r.parts[1].filed === '2026-10-30');
ok('a 12-month column inside a 10-Q is not treated as a fiscal year', F.years[0].label === 'FY2025' && F.years.every(y => y.form === '10-K'));
ok('five fiscal years, newest first', F.years.map(y => y.fy).join() === '2025,2024,2023,2022,2021');
ok('AMZN FY revenues', [716924, 637959, 574785, 513983, 469822].every((v, i) => near(F.years[i].values.rev, v)));
ok('TTM EBITDA = TTM EBIT + TTM D&A', near(F.ttm.items.ebitda.value, F.ttm.items.ebit.value + F.ttm.items.da.value));
ok('TTM free cash flow = CFO − CapEx', near(F.ttm.items.fcf.value, F.ttm.items.cfo.value - F.ttm.items.capex.value));
ok('latest quarter growth', near(F.quarter.rev, 201944) && near(F.quarter.prior, 180169));
ok('TTM a year earlier for TTM growth (FY2024 + 9M2025 − 9M2024)', near(F.ttmPrior.value, 691330) && F.ttmPrior.end === '2025-09-30');
const T = S.financials(tsla);
ok('TSLA TTM revenue built', near(T.ttm.items.rev.value, 103570, 1) && T.ttm.end === '2026-09-30');
ok('TSLA: no D&A tag in the extract, so EBITDA is left empty rather than estimated', !T.ttm.items.ebitda && T.years[0].values.ebitda == null);
const MF = S.financials(mstr);
ok('MSTR TTM uses six-month periods', MF.ttm.items.rev.parts[1].periodType === 'H1' && MF.ttm.end === '2026-06-30');

// ---- import mapping ----
const imp = D.mapSEC(amzn);
ok('import: actual shares from the cover page, with record', near(imp.values.basic.v, 10813.138306) && imp.values.basic.rec.accn === '0001018724-26-000040' && imp.values.basic.asOf === '2026-10-21');
ok('import: Q3 diluted WA kept as a reference, not as diluted shares', imp.ref.dilutedWA.v === 10929 && !imp.values.options && !imp.values.treasury);
ok('import: base-year choices', near(imp.base.ttm.value, 797455) && imp.base.ttm.end === '2026-09-30' && imp.base.fy.value === 716924);
ok('import: historicals oldest first for storage', imp.hist.years.join() === '2021,2022,2023,2024,2025');
ok('import: no flags for Amazon', imp.flags.length === 0);
const m = M.blank(); D.applyImport(m, imp);
ok('apply: source record has accession, form, filed, measurement date, raw value', m.sources.basic.accn === '0001018724-26-000040' && m.sources.basic.form === '10-Q' && m.sources.basic.filed === '2026-10-30' && m.sources.basic.end === '2026-10-21' && m.sources.basic.raw === 10813138306 && m.sources.basic.cat === 'sec' && m.sources.basic.verified);
ok('apply: TTM and share data stored for display', near(m.ttm.items.rev.value, 797455) && m.shareData.netDilQ.value === 132);
const ti = D.mapSEC(tsla);
ok('TSLA: stale lease figure is flagged with its date', ti.flags.some(f => f.key === 'leases' && /2025-12-31/.test(f.text)));
ok('TSLA actual shares 3,952.757946 mm as of 2026-10-15', near(ti.values.basic.v, 3952.757946) && ti.values.basic.asOf === '2026-10-15');
const mi = D.mapSEC(mstr);
ok('MSTR: no basic share count imported', !mi.values.basic);
ok('MSTR: option exercise price that looks mis-scaled is flagged once a price is known', (() => { mi.values.price = { v: 300 }; return D.validateImport(mi).some(f => f.key === 'sh.optionsK'); })());
ok('a file for another company is flagged', D.validateImport(imp, Object.assign(M.blank(), { meta: { cik: '0001318605' } })).some(f => f.level === 'bad'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
