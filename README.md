# SFT Billing Software

The desktop frontend is in `sft-billing-phase2.2-gst/sft-billing`; the FastAPI
backend and its migrations are in `backend/`. Local databases, source/customer
workbooks, backups, payment proofs, and credentials are excluded. The only
bundled data assets are the blank invoice export template and the audited
client/product first-run seed.

## Run the backend for development

In PowerShell:

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python run_server.py
```

By default, the development backend stores its SQLite database at
`backend/data/sft_billing.db`. This runtime directory is ignored by Git. Set
`SFT_BILLING_DATABASE_URL` when you need to use a separate disposable database
for tests.

## Run the frontend

In a second PowerShell terminal:

```powershell
cd sft-billing-phase2.2-gst/sft-billing
npm ci
$env:VITE_USE_API = "true"
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

For the production desktop database path, first-run seed behavior, and
installer persistence guarantees, see the frontend
[README](sft-billing-phase2.2-gst/sft-billing/README.md).
