# DCF Pro

A guided discounted cash flow calculator rebuilt from the `dcf-model-amzn-CMGs6046.xlsx` teaching workbook.
It walks an analyst through every input (what it is, what to enter, where to find it, a video, and a place to
record the source), tracks completion, and calculates a ten-year FCFF valuation with Base, Bear and Bull
scenarios, sensitivity grids and a probability-weighted value.

**Run it locally:** download `dist/DCF-Workbench.html` and double-click it. It is one self-contained file (example data and Excel templates embedded) and needs no server or install; only the fonts load from the internet, with system fonts as the fallback. Rebuild it with `python3 tools/build-standalone.py`.

Or serve the folder (`npm start`, then http://localhost:8000). No build step,
no server code, no paid services. Models save in the browser; model files (.json) and Excel files carry work between computers.

## Dashboard

The dashboard is the home page. It follows the approved navy-to-cyan design: company search, company overview,
valuation summary, key drivers with reference values from data, the analyst input panel (key inputs, scenarios,
advanced), a football field, a WACC × growth sensitivity grid, scenario results, projected free cash flow and the
model completion tracker. Light and dark mode are remembered per computer.

## Company data import

Search a company or ticker in the top bar. The import fills **reported figures and market data only**: company
details, valuation date, share price, 52-week range, shares outstanding, dilutive options and RSUs (as reported, with
treasury shares at 0), the 10-year Treasury yield for every scenario, the provider beta for the Base case (flagged
for review), five years of historicals, cash, short-term investments, debt, minority interest and deferred tax. The
analyst's name is remembered on the computer and filled into new models. Each figure is saved with its source, reporting period and retrieval time,
and shown as Imported, Overridden (changed by the analyst) or Analyst-entered. Forecast assumptions are never filled
in; the effective tax rate and historical ratios appear as references the analyst can choose to use. A re-import keeps any value the analyst typed over.

Sources (set up under **Data source**, keys stay on the analyst's computer):

| Source | Key | What it gives |
|---|---|---|
| Financial Modeling Prep | Free key, 250 requests a day, US-listed companies | Search, quote, profile, 5 years of statements, balance sheet, Treasury rates |
| Alpha Vantage | Free key, 25 requests a day | Search, quote, overview, statements, balance sheet, Treasury yield (no SBC or change in NWC) |
| SEC EDGAR company facts file | None | Reported figures straight from the filings, each linked to its filing. No prices |

Figures the provider may define differently from the workbook (total debt, deferred tax, weighted-average shares)
are flagged for the analyst to check against the filing.

## Model completion

For each section the tracker counts required, completed, missing and invalid inputs, default values still to
confirm, and whether each reported figure has a source and has been verified. It also tracks whether every scenario
calculates, failing and warning checks, reviewed assumptions, and whether the model was saved after the last change.
The model shows Complete, and 100%, only when all of these pass; defaults and placeholders never count as done.

## Market data and share dilution

- **Actual common shares outstanding (latest available date)** comes from the cover page of the latest 10-Q or 10-K. Imports never substitute weighted-average shares for it. Each market input has an as-of date, a source badge (market quote or SEC filing data) and a "Where to find it" guide.
- **Share dilution** has three methods: *Simple* (an estimated diluted count, or value on actual shares only), *Advanced* (options and warrants by treasury stock method, unvested RSUs with optional unrecognised cost, convertibles by if-converted or net share settlement; out-of-the-money securities are excluded) and *Workbook totals* (the spreadsheet's two cells). Simple and Advanced fill the workbook's options and treasury cells, so the engine and Excel export are unchanged. Typed totals are kept and restored if you switch back.
- Diluted weighted-average EPS shares from filings are shown only as a reference; they are used only if you press "Use as my estimate".
- Warnings cover a missing or stale price or share date, a 52-week high below the low, a price outside the range, likely unit errors, and a market cap that differs from the provider's.
- **Share dilution guide** (sidebar, or "Learn about diluted shares") explains basic vs diluted shares, where to find each figure on EDGAR, the formula and treasury stock method, Amazon's Q3 2026 EPS share table, a sandbox calculator and common mistakes. It shows your model's share counts read-only and never changes your inputs.

## Structure

| Path | What it is |
|---|---|
| `js/engine.js` | Calculation engine: pure functions, one per workbook sheet. No UI code |
| `js/model.js` | Input data model, validation, the completion tracker, browser persistence |
| `js/data.js` | Data providers (FMP, Alpha Vantage, SEC company facts): fetch, map to model figures with sources, apply with provenance |
| `js/charts.js` | SVG charts: football field, free cash flow, completion ring |
| `js/fields.js` | Every input field: label, unit, scenario columns, workbook cell, help text from the workbook checklist |
| `js/excel.js` | Excel export (writes inputs into the workbook template) and import |
| `js/app.js` | User interface only |
| `templates/` | The original workbook and the corrected workbook used for export |
| `data/amzn-sample.json` | The workbook's Amazon figures, used as the example model |
| `tests/` | Reconciliation tests against Excel values; run `npm test` |
| `docs/FIXES.md` | Each change from the workbook's method and why |
| `docs/RECONCILIATION.md` | Excel vs website results |
