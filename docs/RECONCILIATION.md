# Reconciliation with Excel

Run `npm test`. The tests compare the website engine with values calculated by a spreadsheet engine
(LibreOffice, full recalculation) from the workbook and from edited copies of it. Tolerance: 1 part in 10^9.

| Output (Amazon example) | Excel, original | Website, original method | Difference | Excel, corrected template | Website, corrected | Difference |
|---|---|---|---|---|---|---|
| Base value per share | $183.78 | $183.78 | < 1e-9 | $179.20 | $179.20 | < 1e-9 |
| Bear value per share | $47.41 | $47.41 | < 1e-9 | $47.56 | $47.56 | < 1e-9 |
| Bull value per share | $374.88 | $374.88 | < 1e-9 | $364.55 | $364.55 | < 1e-9 |
| Probability-weighted | $204.28 | $204.28 | < 1e-9 | $199.21 | $199.21 | < 1e-9 |
| Base enterprise value ($mm) | 2,066,527 | 2,066,527 | < 1e-9 | 2,016,360 | 2,016,360 | < 1e-9 |

What the 331 engine checks cover:

- Original workbook: value per share, WACC and all 11 FCFF years for Base, Bear and Bull; EV, equity, TV, PV of TV,
  sum of PVs, TV share, EV/EBITDA, terminal ROIC and reinvestment checks; weighted value; market cap; both 48-cell
  sensitivity grids; the WACC Builder tie-out.
- Four edited copies of the workbook, recalculated: exit multiple in all scenarios; end-of-year discounting;
  shifted growth, beta, terminal growth, equity weight and NWC; shifted cash, debt, options, treasury shares and price.
- The corrected Excel template, recalculated: all scenario values, weighted value, EV, TV, WACC and both grids.
- Behaviour with bad data: missing inputs block only the affected scenario; WACC ≤ g is refused; probabilities
  that do not add to 100% block the weighted value; zero shares are refused; an exit multiple is required only when chosen.

`tests/model-excel.test.js` adds 19 checks: blank models never calculate and are never zero-filled, invalid entries
are flagged and treated as missing, and Excel export then import returns the same inputs for both templates.
Exported files were also recalculated in LibreOffice and match the engine.
