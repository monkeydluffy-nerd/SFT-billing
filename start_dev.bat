@echo off
set "SFT_BILLING_DATABASE_URL=sqlite:///%LOCALAPPDATA:\=/%/SFT Billing/sft_billing.db"
start "SFT Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "SFT Frontend" cmd /k "cd /d %~dp0sft-billing-phase2.2-gst\sft-billing && npm run dev"
