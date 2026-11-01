# Fixes to the workbook methodology

The website runs two methods. **Corrected** (the default) applies the fixes below. **Original workbook** reproduces
`dcf-model-amzn-CMGs6046.xlsx` exactly, including the issues below. Switch with the Method menu in the top bar.
`templates/dcf-template-corrected.xlsx` is the same workbook with these fixes made in its formulas, and Excel export uses it.

| # | Issue in the workbook | Where | Corrected method | Basis |
|---|---|---|---|---|
| 1 | Gordon Growth applied g twice: the terminal-year FCFF is already year 11 and was multiplied by (1 + g) again | DCF Engine C50, Dashboard C56:C58 | TV = FCFF(year 11) / (WACC − g) | [Damodaran, Terminal Value](https://pages.stern.nyu.edu/~adamodar/pdfiles/country/TerminalValue.pdf): TV uses next year's cash flow |
| 2 | Terminal reinvestment (7.6%) disagreed with g / ROIC (14.3%); the Terminal ROIC input was never used | DCF Engine M26:M30, C78:C83 | Year-11 FCFF = NOPAT × (1 − g / terminal ROIC) | Damodaran stable-growth identity: g = reinvestment rate × ROIC |
| 3 | Mid-year convention used for cash flows but the Gordon TV discounted a full 10 years | DCF Engine C53 | Gordon TV discounted 9.5 years when mid-year is on; exit-multiple TV stays at 10 | [BVR](https://www.bvresources.com/articles/bvwire/avoid-this-inconsistency-with-the-terminal-value) |
| 4 | Exit multiple applied to year-11 EBITDA but discounted as year 10 | DCF Engine C46, C51 | Year 10 EBITDA × multiple | Standard practice: multiple on the final forecast year |
| 5 | WACC weights typed (97/3) instead of market values; leases treated as debt in the bridge but not in the weights | Assumptions C64:E65 | We = market cap / (market cap + debt + operating leases) | Workbook checklist item 42: market-value weights |
| 6 | Base revenue typed separately from Historicals | Assumptions C26:E26 | Linked to Historicals G7 | One number, one place |
| 7 | Inputs that changed nothing: SBC %, interest income, NWC base, R&D capitalisation, revenue mix | Assumptions rows 30–31, 41–42, 51, 53 | Removed from the input screens; gross margin kept as display only | An input that changes nothing misleads |
| 8 | Labels that did not match formulas (Sensitivity note, Readme grid name, hidden 21% historical tax) | Sensitivity B14, Readme D18, Historicals B19 | Wording corrected | No formula change |
| 9 | Operating leases counted twice: lease cost stayed in operating costs (EBITDA and FCFF) while the lease liability was also subtracted in the bridge and counted as debt in the weights | Assumptions C79–C85, C64 | Standard US GAAP treatment by default: lease cost stays in the cash flows; the liability is neither subtracted nor weighted. A lease-adjusted (debt) treatment can be chosen per model. Excel export writes the lease cell as 0 under the standard treatment | Consistency across cash flows, EBITDA, weights and the bridge |
| 10 | A forecast operating loss produced a negative tax (a refund) | DCF Engine row 17 | A loss year pays no tax; losses are carried forward against later profits (years 1–10) | Damodaran: losses create NOLs, not refunds |

Effect on the Amazon example (fixes 1–8): Base $183.78 → $179.20, Bear $47.41 → $47.56, Bull $374.88 → $364.55,
probability-weighted $204.28 → $199.21. With fix 9 (standard lease treatment, now the default): Base $181.01,
Bear $53.43, Bull $359.97, probability-weighted $200.23. Choosing the lease-adjusted treatment reproduces the $179.20 figures.
Fix 10 does not change the example (no forecast losses).
