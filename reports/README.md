# Superstore baseline reports

The PNGs were generated through the dashboard Export report action, from the unfiltered live FastAPI response.

The files in this folder use Persian. English copies are in `en/`.

- `01-overview.png`: totals, two baseline findings, monthly Sales columns with a three-month average, diverging Profit columns, and Category and Region comparisons.
- `02-products.png`: all 17 Sub-Categories, ordered by Profit from lowest to highest.
- `03-profitability.png`: Furniture discount bridge, discount-band comparison, Sub-Category drivers, and the largest State losses.
- `04-geography.png`: state Profit map, Sales versus Profit, and the five largest State losses.

The reporting period is 2014-01-04 to 2017-12-30. The source is `superstore-sales.csv`. There are 1,163 line items, 553 distinct orders, and 41 observed States / DC.

Overview canvas: 1600 × 1400 logical pixels; PNG resolution: 3200 × 2800. Products and Geography remain 1600 × 1200 (3200 × 2400). The extra Overview height keeps both monthly charts and their labels readable.

Only observed States have business values. Geographic boundaries include 50 States and DC. Grey means No data; it does not mean zero.

The API fills months without observations with zero. The frontend checks line-item counts for ambiguous zero months through the existing route. Missing months are gaps; measured zero uses a zero marker. The trailing three-month average needs three consecutive observed months. Monthly Margin is monthly Profit / monthly Sales × 100, and is undefined when Sales is zero.

The baseline peak Sales month is 2014-09 ($21,467.30). The largest loss month is 2017-11 (-$3,588.08). Both annotations come from the current filtered series.

## Verification

Frontend lint, TypeScript checks, and the production build passed. The 24 existing backend tests passed. Source hashes for the CSV, notebook, backend code, and backend tests did not change.

Browser checks covered all three views in both languages, the 17 product bars and 41 State points, Year + Region filters, pending changes, Reset, an empty result, date validation, a network error and Retry, State search and sorting, ten-row pagination, keyboard controls, and mobile/tablet layouts.

Each final PNG was opened and reviewed. Exact totals, losses, signs, legends, State coverage, labels, and source notes are visible without tooltips. Sales and Profit are near the top. Loss-making products are listed first. High-sales States with losses are labelled and shown in the loss table. A ten-second reading time remains a design target; it was not measured in a user study.
