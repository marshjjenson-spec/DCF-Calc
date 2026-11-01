// ===== CHANGE IN NWC: TEACHING CONTENT (static text, no model state) =====
// The written part of the Historical financials → Change in NWC guide. Every reported figure here was read from
// the named SEC filing (Amazon's 2025 Form 10-K, accession 0001018724-26-000004, through its XBRL facts).
// Anything made up for teaching is labelled "Hypothetical".
const DCFNwcHelp = (() => {
  const AMZN_K = { co: 'Amazon.com, Inc.', form: '10-K', period: 'fiscal year ended December 31, 2025', accn: '0001018724-26-000004', filed: '2026-02-06', url: 'https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm', cik: '1018724' };
  const SRC = {
    edgar: ['SEC EDGAR full-text search', 'https://www.sec.gov/edgar/search/'],
    damCf: ['Damodaran, The Little Book of Valuation: cash flows', 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/littlebook/cashflows.htm'],
    damWc: ['Damodaran: working capital ratios by industry (data)', 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/wcdata.html'],
    amzn: ['Amazon 2025 Form 10-K (filed 2026-02-06)', AMZN_K.url],
    sec10k: ['Investor.gov: how to read a 10-K', 'https://www.investor.gov/introduction-investing/getting-started/researching-investments/how-read-10-k'],
  };
  // Amazon FY2025, Consolidated Statements of Cash Flows → Operating activities → Changes in operating assets and liabilities ($ millions)
  const AMZN_LINES = [
    { label: 'Inventories', cf: -3002, tag: 'IncreaseDecreaseInInventories', cls: 'core', note: 'Clearly operating: goods held for sale.' },
    { label: 'Accounts receivable, net and other', cf: -7333, tag: 'IncreaseDecreaseInAccountsReceivableAndOtherOperatingAssets', cls: 'core', note: 'Mainly customer and vendor receivables. "And other" means checking the note before calling all of it operating.' },
    { label: 'Other assets', cf: -15632, tag: 'IncreaseDecreaseInOtherNoncurrentAssets', cls: 'review', note: 'Tagged as noncurrent. Long-term items are usually not working capital. Needs classification from the notes.' },
    { label: 'Accounts payable', cf: 11231, tag: 'IncreaseDecreaseInAccountsPayable', cls: 'core', note: 'Clearly operating: money owed to suppliers.' },
    { label: 'Accrued expenses and other', cf: -5019, tag: 'IncreaseDecreaseInAccruedLiabilitiesAndOtherOperatingLiabilities', cls: 'review', note: 'Operating accruals mixed with other items. On Amazon\'s balance sheet this caption also holds current lease liabilities and current debt. Needs classification.' },
    { label: 'Unearned revenue', cf: -214, tag: 'IncreaseDecreaseInContractWithCustomerLiability', cls: 'core', note: 'Clearly operating: cash received before delivery (for example Prime memberships, AWS commitments).' },
  ];
  // Amazon balance sheet at December 31 ($ millions), same 10-K
  const AMZN_BS = {
    y25: { ca: 229083, cash: 86810, sti: 36219, rcash: 300, ar: 67729, inv: 38325, cl: 218005, ap: 121909, acc: 75520, def: 20576, debt: 2748 + 455, leases: 12655 + 1544 },
    y24: { ca: 190867, cash: 78779, sti: 22423, rcash: 247, ar: 55451, inv: 34214, cl: 179431, ap: 94363, acc: 66965, def: 18103, debt: 5017 + 151, leases: 10546 + 1375 },
  };
  const n0 = v => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const sg = v => (v < 0 ? '−' : '+') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // ---- 1 and 2: always visible ----
  const what = () => `<p>Net Working Capital (NWC) represents operating resources tied up in day-to-day business activities, such as customer receivables and inventory, minus operating financing provided by suppliers and other operating liabilities.</p>
    <p>Change in NWC measures how this operating investment changes between periods.</p>
    <p>For this DCF input, we use the <b>cash flow sign</b>:</p>
    <ul><li><b>Negative</b> means the change <b>used</b> cash.</li><li><b>Positive</b> means the change <b>provided</b> cash.</li></ul>
    <p>An increase in operating NWC normally reduces free cash flow. A decrease normally increases free cash flow.</p>
    <div class="notice info">The NWC used in a DCF is <b>operating</b> NWC, not simply total current assets − total current liabilities. Cash and marketable securities are investments, not operating needs, and short-term debt and the current part of long-term debt are financing. Both are valued separately in the equity bridge, so leaving them in NWC would count them twice.</div>`;
  const why = () => `<p>Companies can report revenue and profits before receiving the cash associated with those transactions. They can also purchase inventory before selling it, and receive goods or services before paying suppliers.</p>
    <p>These timing differences create operating working capital.</p>
    <p>When more money becomes tied up in receivables and inventory, that money is not immediately available to investors. When a company delays payment to suppliers, it temporarily preserves cash.</p>
    <p>DCF valuation focuses on cash flows, not just accounting profits. We calculate Change in Net Working Capital to account for the cash invested in or released from everyday business operations.</p>
    <p><b>Why it changes the value.</b> Free cash flow to the firm (FCFF) is the cash left for all investors, lenders and shareholders, after the business has paid for what it needs to keep running and growing. Cash that must be put into receivables and inventory is not available to them, so it is subtracted from FCFF. Enterprise value is the present value of FCFF, so every dollar of extra working capital a growing company needs lowers enterprise value, and every dollar suppliers or customers finance raises it, all else equal.</p>`;

  // ---- 3: each component ----
  const comp = (id, title, body) => ({ id, title, body });
  const COMPONENTS = [
    comp('ar', 'Accounts receivable', `<p><b>What it is.</b> When a company sells on credit, the customer owes it money: the sale is in revenue now, but the cash arrives later (often 30–90 days). Accounts receivable is the total customers owe at the balance-sheet date.</p>
      <p><b>Why a rise reduces cash even when revenue rises.</b> Revenue is recorded when the sale is made. If receivables went up, part of this year's revenue has not been collected yet, so operating cash flow is lower than profit by the amount of the increase.</p>
      <div class="formula">Hypothetical: beginning receivables $100 mm → ending $150 mm. Increase = $50 mm. Cash impact = −$50 mm, assuming no other adjustments.</div>
      <p>Why: the company booked $50 mm more of sales than it collected. Collections fall short of revenue by exactly the increase. A fall in receivables works the other way: customers paid down old balances, so cash collected exceeded revenue.</p>
      <p class="footnote">Watch for: receivables growing faster than revenue (slower collection, looser credit, or channel stuffing), and receivables sold to a bank (factoring), which lowers receivables without better collection.</p>`),
    comp('inv', 'Inventory', `<p><b>What it is.</b> Raw materials, work in progress and finished goods bought or made but not yet sold. The company paid (or owes) for them, but they reach the income statement as cost of sales only when sold.</p>
      <p><b>Why it consumes working capital.</b> Building inventory means spending cash today for sales tomorrow.</p>
      <div class="formula">Hypothetical: beginning inventory $200 mm → ending $260 mm. Increase = $60 mm. Cash impact = −$60 mm, assuming no other adjustments.</div>
      <p>Inventory can grow because of <b>expansion</b> (new stores, warehouses, product lines), <b>stocking decisions</b> (buying ahead of price rises or supply risk), <b>seasonal demand</b> (stocking before the holidays) or <b>slower sales</b> (goods not moving). The first three can be healthy; the last is a warning sign. Compare inventory growth with revenue and cost-of-sales growth, and read MD&A for the reason.</p>`),
    comp('ap', 'Accounts payable', `<p><b>What it is.</b> Amounts the company owes suppliers for goods and services already received.</p>
      <div class="formula">Hypothetical: beginning accounts payable $120 mm → ending $160 mm. Increase = $40 mm. Cash impact = +$40 mm, assuming no other adjustments.</div>
      <p><b>Why paying later preserves cash.</b> The costs are already in the income statement, but $40 mm of them has not been paid in cash yet. Suppliers are, in effect, lending the company that money for free. It is temporary: if payment terms go back to normal, the cash goes out. A large retailer that sells inventory before paying for it can run on suppliers' money.</p>
      <p class="footnote">Watch for: payables that include amounts owed for property and equipment. Those are investing, not operating working capital, and are a common reason the balance sheet change differs from the cash flow statement line.</p>`),
    comp('acc', 'Accrued operating expenses', `<p><b>What it is.</b> Expenses recognised in the income statement but not yet paid: wages earned but not yet in a pay cheque, bonuses, utilities, rent, professional fees.</p>
      <div class="formula">Hypothetical: accrued wages $50 mm at the start of the year and $65 mm at the end. Increase = $15 mm. Cash impact = +$15 mm, assuming no other adjustments.</div>
      <p>Why: $15 mm of this year's wage expense is still owed to employees, so cash paid was $15 mm less than the expense. Only operating accruals belong here. Accrued <b>interest</b> is a financing item (FCFF is before interest), and accrued <b>income taxes</b> overlap with the tax rate you apply to EBIT, so many analysts leave both out.</p>`),
    comp('def', 'Deferred (unearned) revenue', `<p><b>What it is.</b> Cash customers paid before the company delivered: subscriptions, memberships, gift cards, prepaid service contracts. It is a liability because the company still owes the product or service.</p>
      <div class="formula">Hypothetical: deferred revenue $30 mm → $45 mm. Increase = $15 mm. Cash impact = +$15 mm, assuming no other adjustments.</div>
      <p>Why: customers paid $15 mm more in advance than the company recognised as revenue. Subscription software firms often have large deferred revenue, which is one reason they can have negative working capital. A fall in deferred revenue means the company is delivering on old prepayments faster than it collects new ones: revenue without matching new cash.</p>`),
    comp('other', 'Other operating assets and liabilities', `<p>Many companies group several accounts into one line such as "Other assets", "Other current liabilities" or "Accrued expenses and other". These can mix operating items (prepaid rent, customer deposits) with items that are not working capital (derivatives, tax balances, long-term deposits, current lease liabilities, current debt).</p>
      <p><b>How to investigate:</b></p>
      <ol><li>Find the balance-sheet caption, then search the notes for its name (for example "Other assets" or "Accrued expenses and other"). Most 10-Ks break them down in a "Supplemental financial information" or "Other balance sheet items" note.</li>
      <li>Ask of each part: is it caused by day-to-day sales, purchasing and employees? Then it is operating. Is it debt, interest, a tax balance, a lease liability, a long-term investment or cash? Then it is not.</li>
      <li>Check whether it is current. A noncurrent item (more than a year away) is usually not working capital.</li>
      <li>If only part is operating, exclude the reported line and enter the operating part as an adjustment in the worksheet, with the note it comes from.</li></ol>
      <p><b>Do not automatically include every miscellaneous asset and liability.</b> The worksheet marks these lines "Mixed or uncertain" and keeps them out of the clearly operating total until you classify them.</p>`),
  ];
  const signs = () => `<p>The cash flow statement shows each change with the sign of its effect on cash, not the sign of the balance-sheet change.</p>
    <table class="fin sgn"><thead><tr><th>Balance-sheet movement</th><th>Cash impact</th><th>Why</th></tr></thead><tbody>
      <tr><td>Increase in accounts receivable</td><td class="neg">Generally negative</td><td>Sales recorded, cash not yet collected</td></tr>
      <tr><td>Decrease in accounts receivable</td><td>Generally positive</td><td>Old balances collected</td></tr>
      <tr><td>Increase in inventories</td><td class="neg">Generally negative</td><td>Cash spent on goods not yet sold</td></tr>
      <tr><td>Decrease in inventories</td><td>Generally positive</td><td>Goods sold without replacing them</td></tr>
      <tr><td>Increase in accounts payable</td><td>Generally positive</td><td>Costs recorded, cash not yet paid</td></tr>
      <tr><td>Decrease in accounts payable</td><td class="neg">Generally negative</td><td>Suppliers paid down</td></tr>
      <tr><td>Increase in deferred operating revenue</td><td>Generally positive</td><td>Customers paid in advance</td></tr>
      <tr><td>Decrease in deferred operating revenue</td><td class="neg">Generally negative</td><td>Revenue earned from cash received earlier</td></tr></tbody></table>
    <p><b>Use the line from the cash flow statement with its reported sign</b>, subject to classifying it correctly. "(3,002)" or "−3,002" for inventories already means cash used. Do not reverse the sign a second time. The only time you flip a sign is when converting between the cash flow contribution and the balance-sheet change in NWC (the forecast input is in the balance-sheet direction: investment is positive).</p>`;

  // ---- 4: operating NWC and the two methods ----
  const calcNwc = () => `<div class="formula">Operating NWC = Accounts receivable + Inventory + Other operating current assets − Accounts payable − Other nondebt operating current liabilities</div>
    <p>Equivalently: <b>noncash operating current assets − nondebt operating current liabilities</b>.</p>
    <p><b>Why cash and interest-bearing debt are excluded.</b> Cash and marketable securities earn interest and are not needed to run the business day to day; they are added to enterprise value in the equity bridge. Short-term borrowings, commercial paper and the current portion of long-term debt are financing; they are subtracted in the bridge, and their cost is in WACC. Leaving either in NWC would count it twice and mix financing with operations. Current lease liabilities are left out too: lease payments are already in operating costs (or, if you treat leases as debt, in the bridge).</p>
    <p><b>Negative operating NWC</b> happens when a business collects from customers before it pays suppliers: retailers that turn inventory in weeks but pay suppliers in months, subscription businesses paid in advance, marketplaces holding sellers' money. Growth then <i>releases</i> cash: each extra dollar of sales brings in more supplier and customer financing. Amazon has had negative operating NWC for many years.</p>
    <h4>Complete example (hypothetical)</h4>
    <table class="fin"><thead><tr><th>$ millions</th><th>Beginning</th><th>Ending</th><th>Change</th></tr></thead><tbody>
      <tr><td>Accounts receivable</td><td>100</td><td>150</td><td>+50</td></tr><tr><td>Inventory</td><td>200</td><td>260</td><td>+60</td></tr><tr><td>Other operating current assets (prepaid)</td><td>20</td><td>25</td><td>+5</td></tr>
      <tr class="sub"><td>Operating current assets</td><td>320</td><td>435</td><td>+115</td></tr>
      <tr><td>Accounts payable</td><td>120</td><td>160</td><td>+40</td></tr><tr><td>Accrued operating expenses</td><td>50</td><td>65</td><td>+15</td></tr><tr><td>Deferred operating revenue</td><td>30</td><td>45</td><td>+15</td></tr><tr><td>Other operating current liabilities</td><td>40</td><td>42</td><td>+2</td></tr>
      <tr class="sub"><td>Operating current liabilities</td><td>240</td><td>312</td><td>+72</td></tr>
      <tr class="total"><td>Operating NWC</td><td>80</td><td>123</td><td>+43</td></tr></tbody></table>
    <div class="formula">Change in NWC = Ending NWC − Beginning NWC = 123 − 80 = +43</div>
    <p>A <b>positive</b> change means the business needed $43 mm more of its own money tied up in operations at the end of the year than at the start: an additional investment, like CapEx but in working capital. Its cash flow effect is −43.</p>`;
  const convert = () => `<div class="tgrid2"><div><b>Balance-sheet change in NWC</b><div class="formula">Change = Ending NWC − Beginning NWC</div><p class="footnote">Investment direction: positive = more cash tied up.</p></div><div><b>Cash flow effect</b><div class="formula">Cash flow effect ≈ −Change in NWC</div><p class="footnote">Cash flow direction: negative = cash used. This is the sign on the cash flow statement and in the Historical financials row.</p></div></div>
    <p><b>Why the signs are opposite.</b> Working capital is a use of cash. If the balance of operating assets net of operating liabilities goes <i>up</i>, the company put cash <i>in</i>, so cash went <i>down</i>.</p>
    <div class="formula">Hypothetical: beginning NWC $1,500 mm → ending $2,100 mm. Change in NWC = +$600 mm. Cash flow effect = −$600 mm.</div>
    <p>The company needs an additional $600 mm tied up in operations: money that could otherwise have gone to lenders and shareholders.</p>
    <div class="formula">If instead NWC falls from $1,500 mm to $1,200 mm: Change in NWC = −$300 mm. Cash flow effect = +$300 mm (cash released).</div>
    <p><b>Why real cash flow statements differ from simple balance-sheet changes.</b> Do not assume the balance-sheet difference must equal the sum of the reported cash flow lines:</p>
    <ul><li><b>Acquisitions and disposals</b>: receivables and inventory of a business bought come onto the balance sheet without operating cash; the cash paid is in investing activities.</li>
      <li><b>Foreign exchange</b>: translating a foreign subsidiary's balances at a new rate changes them without any cash moving.</li>
      <li><b>Noncash transactions</b>: payables for equipment (investing), assets acquired under leases, stock-settled liabilities, reclassifications from long-term to current.</li>
      <li><b>Different definitions</b>: the cash flow statement may combine lines differently from the balance sheet ("Accounts receivable, net and other" vs "Accounts receivable"), and some balance-sheet items (current debt, lease liabilities, tax balances) move in other parts of the cash flow statement.</li>
      <li><b>Allowances and write-downs</b>: bad-debt and inventory write-downs are often added back separately in operating cash flow.</li></ul>
    <p>When they disagree, the cash flow statement is usually the better measure of the cash actually used, because it strips these effects out. The balance sheet is the better guide to the <i>level</i> of NWC for forecasting ratios.</p>`;

  // ---- 5: where to find the numbers ----
  const steps = (co) => [
    ['Open the company\'s most recent appropriate SEC 10-K or 10-Q.', `Use the 10-K for a fiscal year and the latest 10-Q for year to date (TTM). A newer filing replaces older figures, and restated prior years in the newest 10-K are the ones to use. ${co.filing}`],
    ['Locate the Consolidated Statements of Cash Flows.', 'It follows the income statement, balance sheet and (often) the statement of equity in Item 8 (10-K) or Part I, Item 1 (10-Q). Ctrl+F "Cash Flows".'],
    ['Find the Operating Activities section.', 'It starts from net income, adds back noncash items (D&A, stock-based compensation, deferred taxes), then lists the working-capital changes. Investing and financing activities come after it and do not belong in NWC.'],
    ['Find the heading "Changes in operating assets and liabilities" or equivalent.', 'Some companies say "Changes in assets and liabilities" or "Changes in working capital", and a few put the lines straight under the noncash items with no heading.'],
    ['Look for the components: accounts receivable, inventories, accounts payable, accrued operating expenses, deferred or unearned revenue, other operating current assets, other operating current liabilities.', 'Write each line down with its exact label and sign. Some companies combine categories (for example "Accounts payable and accrued liabilities", or one "Other operating assets and liabilities, net"), so additional disclosures in the notes may be required to split them.'],
    ['Understand the business meaning of each item.', 'Ask what activity moves it: customer credit, buying stock, paying suppliers, paying staff, customer prepayments. That tells you whether it is operating.'],
    ['Determine which disclosed items genuinely represent operating working capital.', 'Include lines caused by day-to-day operations. Exclude financing (interest, debt), investments, tax balances if your tax rate covers them, noncurrent "other assets" and anything you cannot identify. Mixed lines: read the note and include only the operating part.'],
    ['Keep the cash flow statement signs when adding included items.', 'Add the numbers exactly as printed: parentheses mean negative. Do not flip any sign at this stage.'],
    ['Reconcile the result.', 'Compare with the balance-sheet change in operating NWC (step 4 of this guide) and investigate large differences: acquisitions, foreign exchange, equipment payables, reclassifications.'],
    ['Enter the amount in $ millions.', 'Check the statement header ("in millions"). A 10-Q in thousands must be divided by 1,000. Use the same period as the other historical figures: a fiscal year, or TTM, never a single quarter.'],
  ];

  // ---- 6: Amazon worked example ----
  function amazon() {
    const all = AMZN_LINES.reduce((a, l) => a + l.cf, 0);
    const sub = -7333 - 3002 + 11231;
    const core = sub - 214;
    const B = AMZN_BS, op = y => (y.ca - y.cash - y.sti - y.rcash) - (y.cl - y.debt - y.leases);
    const o25 = op(B.y25), o24 = op(B.y24), d = o25 - o24;
    const ch = k => B.y25[k] - B.y24[k];
    return `<p>Source: <a href="${AMZN_K.url}" target="_blank" rel="noopener">Amazon 2025 Form 10-K</a> (accession ${AMZN_K.accn}, filed ${AMZN_K.filed}) → Consolidated Statements of Cash Flows → Operating activities → Changes in operating assets and liabilities. $ millions, fiscal year ended December 31, 2025. Each figure was also checked against the XBRL tag shown.</p>
      <table class="fin"><thead><tr><th>Line as printed</th><th>Cash flow sign</th><th>How to read it</th><th>Classification</th></tr></thead><tbody>
      ${AMZN_LINES.map(l => `<tr><td>${l.label}<br><span class="footnote">us-gaap:${l.tag}</span></td><td class="num">${sg(l.cf)}</td><td>${l.cf < 0 ? 'Used cash: the asset grew or the liability shrank' : 'Provided cash: the liability grew'}</td><td>${l.cls === 'core' ? 'Operating' : '<b>Mixed: needs review</b>'}<br><span class="footnote">${l.note}</span></td></tr>`).join('')}
      </tbody></table>
      <h4>Three different numbers</h4>
      <div class="three">
        <div><span>1. Sum of all reported operating asset and liability change lines</span><b>${sg(all)}</b><small>−3,002 − 7,333 − 15,632 + 11,231 − 5,019 − 214 = ${n0(all)} million</small></div>
        <div><span>2. Clearly identifiable working-capital accounts</span><b>${sg(sub)}</b><small>Accounts receivable + inventory + accounts payable: −7,333 − 3,002 + 11,231 = +896 million. With unearned revenue (also clearly operating): +896 − 214 = ${sg(core)} million.</small></div>
        <div><span>3. Analyst-adjusted DCF cash flow effect</span><b>Your call</b><small>Number 2 plus the operating parts of "Other assets" and "Accrued expenses and other" once you have read the notes. It lies between the two figures only if those parts are operating.</small></div>
      </div>
      <div class="notice warn"><b>−19,969 is the sum of all reported operating asset and liability change lines</b>, not automatically the normalised DCF change in NWC: "Other assets" (−15,632) is a noncurrent line and "Accrued expenses and other" (−5,019) mixes operating accruals with other items. <b>+896 is only a partial subset</b> (receivables, inventory and payables), not Amazon's complete NWC change. Neither is the right DCF input until it is reconciled to your model's operating NWC definition.</div>
      <h4>Checking against the balance sheet</h4>
      <table class="fin"><thead><tr><th>$ millions</th><th>Dec 31, 2024</th><th>Dec 31, 2025</th><th>Change</th><th>Cash effect implied</th><th>Cash flow statement</th></tr></thead><tbody>
        <tr><td>Accounts receivable, net and other</td><td>${n0(B.y24.ar)}</td><td>${n0(B.y25.ar)}</td><td>${sg(ch('ar'))}</td><td>${sg(-ch('ar'))}</td><td>−7,333</td></tr>
        <tr><td>Inventories</td><td>${n0(B.y24.inv)}</td><td>${n0(B.y25.inv)}</td><td>${sg(ch('inv'))}</td><td>${sg(-ch('inv'))}</td><td>−3,002</td></tr>
        <tr><td>Accounts payable</td><td>${n0(B.y24.ap)}</td><td>${n0(B.y25.ap)}</td><td>${sg(ch('ap'))}</td><td>${sg(ch('ap'))}</td><td>+11,231</td></tr>
        <tr><td>Accrued expenses and other</td><td>${n0(B.y24.acc)}</td><td>${n0(B.y25.acc)}</td><td>${sg(ch('acc'))}</td><td>${sg(ch('acc'))}</td><td>−5,019</td></tr>
        <tr><td>Unearned revenue</td><td>${n0(B.y24.def)}</td><td>${n0(B.y25.def)}</td><td>${sg(ch('def'))}</td><td>${sg(ch('def'))}</td><td>−214</td></tr>
        <tr class="total"><td>Operating NWC (totals method, below)</td><td>${n0(o24)}</td><td>${n0(o25)}</td><td>${sg(d)}</td><td>${sg(-d)}</td><td>${sg(all)} (all lines)</td></tr></tbody></table>
      <p class="footnote">Operating NWC = (total current assets − cash − marketable securities − restricted cash) − (total current liabilities − current debt − current lease liabilities). 2025: (229,083 − 86,810 − 36,219 − 300) − (218,005 − 3,203 − 14,199) = ${n0(o25)}. 2024: (190,867 − 78,779 − 22,423 − 247) − (179,431 − 5,168 − 11,921) = ${n0(o24)}. Calculated from the 10-K balance sheet and lease and debt notes (XBRL facts).</p>
      <p>The balance sheet says operating NWC fell by ${n0(-d)} (cash released), while the cash flow statement lines add up to cash <i>used</i> of ${n0(-all)}. Every line differs. This is normal and is exactly why the guide says not to force the two methods to agree: balance-sheet movements include items that are not operating cash, such as payables for property and equipment, liabilities moving from long-term to current, lease liabilities, acquisitions and currency translation, and the cash flow statement's "Other assets" line is not a current asset at all. Read the notes before choosing your figure, and write down why in your research notes.</p>`;
  }

  // ---- 7: FCFF ----
  const fcffText = () => `<div class="formula">FCFF = EBIT × (1 − Tax rate) + D&A − CapEx − Change in operating NWC</div>
    <dl class="svl"><div><dt>EBIT</dt><dd>Operating income: revenue minus operating costs, before interest and taxes.</dd></div><div><dt>Tax rate</dt><dd>The tax rate on operating income (not the effective rate after interest). EBIT × (1 − t) is NOPAT: what operations earn after tax for all investors.</dd></div>
      <div><dt>D&A</dt><dd>Depreciation and amortisation: a noncash expense inside EBIT, added back.</dd></div><div><dt>CapEx</dt><dd>Cash spent on property, equipment and software: long-term reinvestment.</dd></div>
      <div><dt>Change in operating NWC</dt><dd>Balance-sheet direction: the increase in operating working capital. Short-term reinvestment. Subtracted.</dd></div></dl>
    <h4>Worked example (hypothetical)</h4>
    <table class="fin"><tbody><tr><td>EBIT</td><td class="num">500</td></tr><tr><td>Tax rate</td><td class="num">25%</td></tr><tr class="sub"><td>NOPAT = 500 × (1 − 25%)</td><td class="num">375</td></tr><tr><td>+ D&A</td><td class="num">80</td></tr><tr><td>− CapEx</td><td class="num">(120)</td></tr><tr class="sub"><td>Cash flow before working capital</td><td class="num">335</td></tr><tr><td>− Change in operating NWC (increase of 43)</td><td class="num">(43)</td></tr><tr class="total"><td>FCFF</td><td class="num">292</td></tr></tbody></table>
    <p><b>If NWC increases</b> by 43, FCFF falls from 335 to 292. <b>If NWC decreases</b> by 43, FCFF rises to 335 + 43 = 378. Because enterprise value is the present value of FCFF, an increase in NWC generally lowers DCF enterprise value, all else equal.</p>
    <h4>The same formula with the cash flow sign</h4>
    <div class="formula">FCFF = NOPAT + D&A − CapEx + (Cash flow effect of NWC)  →  375 + 80 − 120 + (−43) = 292</div>
    <p>The Historical financials row stores the <b>cash flow effect</b> (−43 in this example), so it is <b>added</b>. Subtracting it as well would reverse the sign twice and turn a use of cash into a source.</p>`;
  const audit = () => `<p><b>How this model handles the sign, end to end</b> (checked by automated tests):</p>
    <table class="fin"><thead><tr><th>Where</th><th>What is stored</th><th>How it enters</th></tr></thead><tbody>
      <tr><td>Historical financials: Change in NWC</td><td>Cash flow effect (increase in NWC = negative)</td><td>Operating cash flow = net income + D&A + SBC <b>+</b> change in NWC; free cash flow = operating cash flow + CapEx (negative)</td></tr>
      <tr><td>Forecast assumptions: Change in NWC % of change in revenue</td><td>Investment direction (positive = cash tied up)</td><td>Each year: ΔNWC = (revenue − prior revenue) × ratio, and FCFF = NOPAT + D&A − CapEx <b>−</b> ΔNWC − acquisitions</td></tr>
      <tr><td>Historical ratio shown on Forecast assumptions</td><td>−(cash flow effect) ÷ change in revenue</td><td>The minus sign converts the cash flow sign into the investment direction once</td></tr>
      <tr><td>Projections table</td><td>Shown with the cash flow sign, history and forecast alike</td><td>Display only</td></tr>
      <tr><td>Terminal year (corrected method)</td><td>Reinvestment = g ÷ ROIC × NOPAT, which already includes working capital</td><td>No separate NWC line, so it is not counted twice</td></tr>
      <tr><td>Terminal year (original workbook method)</td><td>Year-11 ΔNWC from the same ratio</td><td>Subtracted once</td></tr></tbody></table>`;

  // ---- 8: forecasting ----
  const forecastText = () => `<p><b>Why forecast it.</b> A growing business usually needs more receivables and inventory, net of payables, to support more sales. If the forecast grows revenue but ignores that investment, FCFF and the value are overstated. A company with negative working capital is the reverse: growth releases cash, and ignoring it understates value.</p>
    <h4>Method A: incremental ratio (what this model uses)</h4>
    <div class="formula">Incremental NWC ratio = Change in NWC ÷ Change in revenue</div>
    <div class="formula">Hypothetical: revenue $1,000 mm → $1,200 mm, change $200 mm. Operating NWC $100 mm → $130 mm, increase $30 mm. Ratio = 30 ÷ 200 = 15%.</div>
    <p>The business needed $30 mm of additional operating working capital to support $200 mm of additional revenue: 15 cents per extra dollar of sales. Used as a reference point, next year's forecast ΔNWC = 15% × forecast change in revenue. In this model the input "Change in NWC % of change in revenue" is exactly this ratio, positive when NWC is an investment, so every forecast year computes ΔNWC = (revenue<sub>t</sub> − revenue<sub>t−1</sub>) × ratio and subtracts it from FCFF.</p>
    <h4>Method B: NWC as a percentage of revenue</h4>
    <div class="formula">Forecast NWC = (Operating NWC ÷ Revenue) × Forecast revenue;  ΔNWC = Forecast NWC − Current NWC</div>
    <p>Hypothetical, continuing the example: NWC is 130 on revenue of 1,200 (10.8% of revenue). Next year revenue grows 10% to 1,320.</p>
    <table class="fin"><tbody><tr><td>Method A: 15% × (1,320 − 1,200)</td><td class="num">ΔNWC = +18</td></tr><tr><td>Method B at the current 10.8%: 10.8% × 1,320 − 130</td><td class="num">ΔNWC = +13</td></tr><tr><td>Method B at a normalised 10.0%: 10.0% × 1,320 − 130</td><td class="num">ΔNWC = +2</td></tr></tbody></table>
    <p>Method A prices only the new revenue at last year's incremental rate. Method B moves the whole balance to the ratio you choose, so choosing a ratio below today's level releases cash once (a catch-up) before growth uses it again. The implied incremental ratio of Method B is ΔNWC ÷ change in revenue (13 ÷ 120 = 10.8%, or 2 ÷ 120 = 1.7%), which is what you would enter in this model.</p>
    <p><b>When a normalised NWC-to-revenue ratio is more stable.</b> The level ratio usually moves slowly because it reflects payment terms and inventory turns. The incremental ratio divides one small difference by another: in a year when revenue barely changed, a modest NWC swing produces a huge or negative ratio. Prefer the level ratio (or an average) when revenue growth is low or volatile.</p>
    <ul><li><b>Historical averages</b>: average 3–5 years, not one year. Drop years distorted by acquisitions, supply shocks or pandemic stocking, and say so.</li>
      <li><b>Business models differ</b>: manufacturers and distributors often need 10–25% of revenue; software and marketplaces can be negative; banks and insurers do not use this concept at all.</li>
      <li><b>Seasonality</b>: a fiscal year that ends before the busy season shows high inventory and payables. Compare like dates, and do not use a single quarter-end balance as a full-year level.</li>
      <li><b>Unusual periods</b>: one big swing (inventory build, a customer paying late, a supplier-terms change) should not set the long-term assumption. Mean reversion is the default.</li>
      <li><b>Negative working capital</b>: it can persist for a long time, but growth that slows also slows the cash it releases. Do not let a negative ratio make a fast-growth forecast look more valuable than it can be.</li></ul>
    <p>Do not assume a single historical ratio will remain constant. Choose a figure for each scenario and explain it in your notes.</p>`;

  // ---- 10: mistakes ----
  const MISTAKES = [
    ['Including cash and marketable securities in operating NWC', 'Cash is valued separately in the equity bridge (added to enterprise value). Counting it in NWC as well treats the cash pile as an operating need and double counts it; a cash build would also look like "investment" that cuts FCFF.'],
    ['Including short-term borrowing as an operating liability', 'Commercial paper, short-term loans and the current portion of long-term debt are financing. In NWC they would make the company look as if suppliers fund it, raise FCFF, and then be subtracted again as debt in the bridge.'],
    ['Double-counting changes in accounts payable or accrued expenses', 'If the cash flow statement shows a combined line ("Accounts payable and accrued liabilities") and the note breaks it down, add the combined line or the parts, never both. The worksheet marks parts of a combined line as details and does not add them.'],
    ['Treating every "Other assets" line as current operating NWC', 'Amazon\'s "Other assets" change (−15,632 in 2025) is tagged as noncurrent. Long-term items are not working capital unless the notes show they are operating (for example long-term prepaid or capitalised contract costs, which you might then treat like CapEx).'],
    ['Confusing balance-sheet changes with cash flow contributions', 'An increase in NWC of +600 is a cash flow effect of −600. The Historical financials row wants the cash flow effect; the forecast input wants the investment direction.'],
    ['Reversing a cash flow statement sign twice', 'Entering "−3,002" for inventories as "+3,002" because "an increase is a use of cash" flips a sign the statement already applied. Copy the statement\'s sign; flip only when converting to the balance-sheet direction.'],
    ['Mixing quarterly and annual amounts', 'A 10-Q cash flow statement shows year to date, not the quarter. Do not put a nine-month change next to fiscal-year revenue. Build TTM (fiscal year + year to date − prior year to date) or use the 10-K.'],
    ['Double-counting operating lease effects', 'Lease payments are already in operating costs (and EBIT). If current lease liabilities stay in NWC, or if lease changes appear in "other liabilities", they can be counted again; and if you treat leases as debt, they belong in the bridge, not NWC.'],
    ['Treating acquisition-related working-capital movements as ordinary operations', 'Receivables and inventory acquired with a business are paid for in investing activities. A balance-sheet NWC change in an acquisition year overstates organic working-capital needs; use the cash flow statement lines and the acquisitions % input.'],
    ['Using old figures when newer disclosures are available', 'A 10-Q filed after the 10-K gives a more recent TTM, and the newest 10-K may restate prior years. Use the latest filing and note its accession number and period.'],
  ];

  return { AMZN_K, AMZN_LINES, AMZN_BS, SRC, COMPONENTS, MISTAKES, what, why, signs, calcNwc, convert, steps, amazon, fcffText, audit, forecastText };
})();
if (typeof module !== 'undefined') module.exports = DCFNwcHelp;
