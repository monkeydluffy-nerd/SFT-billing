# SFT Billing Software

Working app: `sft-billing-phase2.2-gst/sft-billing`.
Backend: `backend` (FastAPI + `backend/data/SFT_Billing.xlsx`).

Desktop dev uses the local API, not Supabase.

```text
VITE_USE_API=true
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run `start_dev.bat`. New invoices should appear in `backend/data/SFT_Billing.xlsx`.
If `VITE_USE_API` is not true, the UI falls back to on-PC browser storage, not demo data.
