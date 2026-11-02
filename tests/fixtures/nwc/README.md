# Working-capital test fixtures

Extracts of the SEC company facts files (data.sec.gov/api/xbrl/companyfacts/CIK##########.json) for Amazon, Walmart,
Costco, Apple, Microsoft, Tesla and Ford, retrieved 1 Nov 2026. They keep every `IncreaseDecrease*` concept, the
balance-sheet concepts the operating-NWC calculation reads and the income and cash flow concepts the importer reads,
for facts filed on or after 2021-06-01, with every field of each fact.

Checked against the filings: Amazon 2025 Form 10-K (accession 0001018724-26-000004), Consolidated Statements of Cash
Flows, changes in operating assets and liabilities: inventories (3,002); accounts receivable, net and other (7,333);
other assets (15,632); accounts payable 11,231; accrued expenses and other (5,019); unearned revenue (214). Balance
sheet at December 31, 2025 and 2024 as quoted in `js/nwc-help.js`. Apple's FY2025 lines add up to −25,000, which
reconciles to its operating cash flow less net income, D&A, stock-based compensation and other noncash items.
