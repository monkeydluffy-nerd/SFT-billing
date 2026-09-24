"""SFT Billing backend entrypoint.

React/TypeScript frontend to FastAPI to openpyxl to SFT_Billing.xlsx

See README.md for how to launch this application.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.excel.workbook import ensure_workbook_exists
from app.routes import activities, business_profile, clients, dashboard, health, invoice_items, invoices, payments

app = FastAPI(
    title="SFT Billing API",
    description="Local FastAPI backend for SFT Billing, persisting to SFT_Billing.xlsx via openpyxl.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    ensure_workbook_exists()


app.include_router(health.router)
app.include_router(business_profile.router)
app.include_router(clients.router)
app.include_router(invoices.router)
app.include_router(invoice_items.router)
app.include_router(payments.router)
app.include_router(activities.router)
app.include_router(dashboard.router)
