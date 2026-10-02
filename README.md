# SFT Billing Software

The only working app is `sft-billing-phase2.2-gst/sft-billing`.

Older phase folders and zip copies are leftovers. Do not edit them.

This app is offline-first. It does not use Supabase. Invoices, clients, and payments are saved in this browser on this PC (`localStorage`, key `sft-billing-offline-v1`).

## Run

```bash
cd sft-billing-phase2.2-gst/sft-billing
npm install
npm run dev
```

Open the local Vite URL. Download invoice writes a PDF on this PC. Upload invoice reads a JSON file exported from this app.

Set `VITE_USE_API=true` only if you also start the local FastAPI backend. That path is optional and still stays on this PC.
