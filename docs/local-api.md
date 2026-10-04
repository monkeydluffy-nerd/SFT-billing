# Local API

`VITE_USE_API=true` sends invoices to `http://127.0.0.1:8000`.
They are stored in `backend/data/SFT_Billing.xlsx`.

Verified example: invoice `001/2026-27`, id `iv_8f004aee89d9`.
Fallback when the flag is off is browser storage (`offlineDataProvider`), not mock data.
