# Superstore BI Frontend

The Next.js frontend reads data through the existing FastAPI endpoints. It uses the backend totals, margins, and distinct order counts.

The four views are Overview, Products, Profitability, and Geography. Global filters apply after selecting Apply. Pending changes appear as chips. Reset restores the complete dataset.

## Configuration

Copy `.env.example` to `.env.local` when a different backend address is needed. The development default is `http://127.0.0.1:8000`.

`next.config.ts` proxies browser requests from `/api/backend/*` to the backend. This avoids browser CORS configuration during local development.

## Run locally

Start the FastAPI backend from the project root:

```powershell
cd ..
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Then start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run build
npm run start -- --port 3000
```

Open `http://localhost:3000`.

Use `npm run dev` for development. On this machine, the development HMR WebSocket previously failed. The production preview above works without HMR. To stop either server, use Ctrl+C in its terminal.

## Report images

Select Export report, then save each of the four PNG links. Reports use the applied filters and the current language. Pending changes do not alter the report. Fonts, plots, and map shapes are ready before capture.

The Overview report canvas is 1600 × 1400 logical pixels, rendered at 2× (3200 × 2800). Products and Geography use 1600 × 1200 (3200 × 2400). The extra Overview height keeps both monthly bar charts readable. Long filter summaries can increase the height. Reports have no menus, status messages, or tooltips.

Baseline files are in `../reports`: `01-overview.png`, `02-products.png`, `03-profitability.png`, and `04-geography.png`.

## Data and assets

- Sub-category aggregates come directly from `POST /api/v1/dashboard`.
- Margin values are already percentages. The frontend does not multiply them by 100.
- Annual baseline findings use dashboard requests with `years: [2016]` and `years: [2017]`.
- The API zero-fills months without observations. For a zero-Sales, zero-Profit month, the frontend checks the existing dashboard endpoint with that month intersected with all applied filters. Its line-item count distinguishes an absent observation from a measured zero. At most four checks run at once; results use the existing filter cache and cancellation.
- Monthly Margin uses monthly Profit divided by monthly Sales, multiplied by 100. A zero Sales total returns no defined Margin.
- The three-month Sales average is a trailing arithmetic average of three consecutive observed months. The first two months and windows containing a missing month have no average.
- Monthly Sales uses blue columns with an average line. Monthly Profit uses positive teal and negative red columns. Both charts use identical chronological positions, one shared scroll container, separate USD scales, and no second y-axis.
- Missing States remain No data; they are not assigned zero.
- Local map boundaries and licence details are in `src/assets/README.md`.
- Vazirmatn is bundled locally. Its SIL OFL licence is in `public/fonts/OFL.txt`.
- `html-to-image` produces the PNGs. Recharts renders the monthly trends. Native SVG renders the aligned Profit bars, state map, and scatter plot.

To regenerate geographic and font assets after a fresh install:

```powershell
node scripts/prepare-assets.mjs
```

## Quality commands

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

The monthly calculation tests use Node.js 24's TypeScript support. They cover the 48-month calendar, financial formulas, zero and missing values, averaging gaps, filter intersections, request concurrency, and cancellation.
