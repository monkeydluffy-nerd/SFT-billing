"""SFT Billing backend entrypoint.

The frontend uses SQLite-backed API domains and the legacy workbook for
domains that have not yet been migrated.

See README.md for how to launch this application.
"""
from __future__ import annotations

import os
import argparse
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import engine, initialize_database, initialize_notifications_database, validate_production_database
from app.excel.workbook import ensure_workbook_exists
from app.routes import (
    activities,
    auth,
    business_profile,
    clients,
    dashboard,
    health,
    invoice_items,
    invoices,
    notifications,
    payments,
    products,
)

app = FastAPI(
    title="SFT Billing API",
    description=(
        "Local FastAPI backend for SFT Billing. Migrated domains use SQLite; "
        "domains not yet migrated continue to use the legacy workbook."
    ),
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
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Invoice-Export-Warnings"],
)


@app.on_event("startup")
def on_startup() -> None:
    validate_production_database()
    if getattr(sys, "frozen", False):
        initialize_database(engine)
        initialize_notifications_database(engine)
    ensure_workbook_exists()


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(business_profile.router)
app.include_router(clients.router)
app.include_router(invoices.router)
app.include_router(invoice_items.router)
app.include_router(payments.router)
app.include_router(activities.router)
app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(notifications.router)


def _mount_frontend() -> None:
    """Serve the built web UI from the same origin as the API (installed app)."""
    from pathlib import Path
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    static_dir = os.environ.get("SFT_BILLING_STATIC_DIR")
    if not static_dir or not Path(static_dir).is_dir():
        return
    root = Path(static_dir).resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (root / full_path).resolve()
        if full_path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(root / "index.html")


_mount_frontend()


def parse_args():
    parser = argparse.ArgumentParser(description="SFT Billing Backend")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    return parser.parse_args()


if __name__ == "__main__":
    import uvicorn
    args = parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
