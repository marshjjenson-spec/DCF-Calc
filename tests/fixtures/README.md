# SEC test fixtures

`sec-amzn.json`, `sec-tsla.json` and `sec-mstr.json` are extracts of the SEC company facts files
(data.sec.gov/api/xbrl/companyfacts/CIK##########.json), retrieved 1 Nov 2026. They keep only the concepts the
calculator reads, and only facts filed on or after 2024-01-01, with every field of each fact. Each also holds the
10-K / 10-Q filings list from data.sec.gov/submissions.

Figures checked against the filings themselves:

- Amazon Q3 2026 10-Q (accession 0001018724-26-000040, filed 2026-10-30): cover page 10,813,138,306 shares as of
  October 21, 2026; EPS shares for the three months ended September 30, 2026: basic 10,797, dilutive effect of stock
  awards 132, diluted 10,929 (millions); RSUs outstanding 223.3 million (Note 1, Stock Award Activity; tagged with an
  award-type dimension, so not in company facts); unrecognised compensation $22.3 billion.
- Amazon revenue: FY2025 $716,924 million (10-K 0001018724-26-000004), nine months 2026 $584,069 million and nine
  months 2025 $503,538 million (Q3 2026 10-Q). TTM $797,455 million.
- Tesla Q3 2026 10-Q (0001628280-26-066775): 3,952,757,946 shares as of October 15, 2026. Options and RSU counts
  are only in the FY2025 10-K and are stale after the 2018 CEO award exercise in Q2 2026.
- Strategy Q2 2026 10-Q (0001050446-26-000044): class A 364,585,501 and class B 19,640,250 shares as of July 24,
  2026 (two classes, so no single cover-page count in company facts); options 3,176 thousand at a weighted-average
  exercise price of $43.72 (tagged as 43,720 in XBRL); six convertible note series totalling $6,713.7 million.
