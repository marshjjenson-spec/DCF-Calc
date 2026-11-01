# SEC company facts fixtures for the Trading Comps tests

Eight real filings files, each `{ "facts": <companyfacts>, "subs": <submissions> }`, downloaded on 2026-11-01 from
`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` and `https://data.sec.gov/submissions/CIK##########.json`
(User-Agent "DCF research"), then trimmed to the tags the app reads so the repository stays small.

| File | Company | CIK | Notes |
|---|---|---|---|
| sec-amzn.json | Amazon.com, Inc. | 1018724 | Primary target in the tests |
| sec-tsla.json | Tesla, Inc. | 1318605 | Second target |
| sec-mstr.json | Strategy Inc | 1050446 | Third target: negative earnings, digital assets; no CommonStockSharesOutstanding tag |
| sec-wmt.json | Walmart Inc. | 104169 | No CommonStockSharesOutstanding tag |
| sec-cost.json | Costco Wholesale Corp | 909832 | |
| sec-gm.json | General Motors Co | 1467858 | No LongTermDebt tags (debt must not default to zero) |
| sec-f.json | Ford Motor Co | 37996 | No LongTermDebt tags; no CommonStockSharesOutstanding tag |
| sec-coin.json | Coinbase Global, Inc. | 1679788 | Revenue reported under `Revenues` |

SEC files contain no share prices. Where a test needs a price it sets an explicit test input and labels it as such;
those prices are not market quotes.
