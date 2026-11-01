# DCF Workbench

A guided discounted cash flow calculator rebuilt from the `dcf-model-amzn-CMGs6046.xlsx` teaching workbook.
It walks an analyst through every input (what it is, what to enter, where to find it, a video, and a place to
record the source), tracks completion, and calculates a ten-year FCFF valuation with Base, Bear and Bull
scenarios, sensitivity grids and a probability-weighted value.

**Run it locally:** download `dist/DCF-Workbench.html` and double-click it. It is one self-contained file (example data and Excel templates embedded) and needs no server or install; only the fonts load from the internet, with system fonts as the fallback. Rebuild it with `python3 tools/build-standalone.py`.

Or serve the folder (`npm start`, then http://localhost:8000). No build step,
no server code, no paid services. Models save in the browser; model files (.json) and Excel files carry work between computers.

## Structure

| Path | What it is |
|---|---|
| `js/engine.js` | Calculation engine: pure functions, one per workbook sheet. No UI code |
| `js/model.js` | Input data model, validation, completion tracking, browser persistence |
| `js/fields.js` | Every input field: label, unit, scenario columns, workbook cell, help text from the workbook checklist |
| `js/excel.js` | Excel export (writes inputs into the workbook template) and import |
| `js/app.js` | User interface only |
| `templates/` | The original workbook and the corrected workbook used for export |
| `data/amzn-sample.json` | The workbook's Amazon figures, used as the example model |
| `tests/` | Reconciliation tests against Excel values; run `npm test` |
| `docs/FIXES.md` | Each change from the workbook's method and why |
| `docs/RECONCILIATION.md` | Excel vs website results |
