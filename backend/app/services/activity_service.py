"""Activity feed: append-only log of things that happened."""
from __future__ import annotations

from typing import Any

from app.excel.constants import SHEET_ACTIVITIES
from app.excel.rows import append_row, read_rows
from app.excel.workbook import load_workbook_safely, save_workbook
from app.utils.validators import new_id, now_iso


def list_activity() -> list[dict[str, Any]]:
    wb = load_workbook_safely()
    rows = read_rows(wb[SHEET_ACTIVITIES], SHEET_ACTIVITIES)
    return sorted(rows, key=lambda r: r.get("occurredAt") or "", reverse=True)


def add_activity_event(payload: dict[str, Any]) -> dict[str, Any]:
    wb = load_workbook_safely()
    ws = wb[SHEET_ACTIVITIES]
    row = {
        "id": new_id("ev"),
        "type": payload["type"],
        "occurredAt": payload.get("occurredAt") or now_iso(),
        "summary": payload["summary"],
        "clientId": payload.get("clientId"),
        "invoiceId": payload.get("invoiceId"),
        "paymentId": payload.get("paymentId"),
        "amount": payload.get("amount"),
    }
    append_row(ws, SHEET_ACTIVITIES, row)
    save_workbook(wb)
    return row
