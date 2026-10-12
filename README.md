# Superstore BI Dashboard

Local bilingual Business Intelligence dashboard for the Superstore CSV dataset.

## Backend setup

Create and use the project virtual environment from PowerShell with Python 3.11:

```powershell
uv venv --python 3.11 .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements-dev.txt
python -m ipykernel install --prefix .\.venv --name superstore-dashboard --display-name "Python (Superstore .venv)"
```

For the exact Python 3.11-tested dependency set, use `python -m pip install -r backend\requirements-lock.txt`.

Run the API from the project root:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Open the API at `http://127.0.0.1:8000`. Open interactive documentation at `http://127.0.0.1:8000/docs`.

Run the automated tests:

```powershell
python -m pytest backend\tests -q
```

## Frontend setup

The Next.js dashboard is in `frontend`. It reads dashboard data only from the FastAPI API through a local Next.js proxy.

```powershell
cd frontend
npm install
npm run build
npm run start -- --port 3000
```

Open `http://127.0.0.1:3000`. Set `BACKEND_API_URL` in `frontend/.env.local` only when the backend does not use its default address. See `frontend/README.md` for details.

The dashboard has Overview, Products, Profitability, and Geography views. Export report creates four PNG images from the applied filter state. Verified baseline images are in `reports/`; English copies are in `reports/en/`.

## Configuration

The backend reads `dataset/superstore-sales.csv` by default. Set `SUPERSTORE_DATASET_PATH` to use another project-relative or absolute CSV path.

The CSV is read once at application startup. The backend validates required columns, required values, numeric fields, ISO dates, and shipping dates. It keeps repeated `Order ID` values because each row is one order line item.

## API

- `GET /api/v1/health`
- `GET /api/v1/metadata`
- `POST /api/v1/dashboard`

`POST /api/v1/dashboard` accepts optional date, year, region, segment, category, subcategory, and state filters. Values in one filter use OR logic. Different filters use AND logic.
