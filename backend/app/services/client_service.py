"""Client CRUD against the Clients sheet."""
from __future__ import annotations

from typing import Any

from app.excel.constants import SHEET_CLIENTS
from app.excel.rows import append_row, delete_row, find_row_index, read_rows, write_row
from app.excel.workbook import load_workbook_safely, save_workbook
from app.utils.errors import NotFoundError, ValidationFailedError
from app.utils.validators import is_valid_email, is_valid_gstin, new_id, now_iso


def _validate(payload: dict[str, Any], partial: bool = False) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not partial or "name" in payload:
        if not (payload.get("name") or "").strip():
            errors["name"] = "Client name is required."
    if not partial or "contactName" in payload:
        if not (payload.get("contactName") or "").strip():
            errors["contactName"] = "Contact name is required."
    if not partial or "email" in payload:
        email = (payload.get("email") or "").strip()
        if not email:
            errors["email"] = "Email is required."
        elif not is_valid_email(email):
            errors["email"] = "Enter a valid email address."
    if not partial or "billingAddress" in payload:
        if not (payload.get("billingAddress") or "").strip():
            errors["billingAddress"] = "Billing address is required."
    gstin = payload.get("gstin")
    if gstin and not is_valid_gstin(gstin):
        errors["gstin"] = "Invalid GSTIN format."
    return errors


def list_clients() -> list[dict[str, Any]]:
    wb = load_workbook_safely()
    return read_rows(wb[SHEET_CLIENTS], SHEET_CLIENTS)


def get_client(client_id: str) -> dict[str, Any]:
    for row in list_clients():
        if row["id"] == client_id:
            return row
    raise NotFoundError(f"Client {client_id} not found.")


def create_client(payload: dict[str, Any]) -> dict[str, Any]:
    errors = _validate(payload)
    if errors:
        raise ValidationFailedError(errors)

    wb = load_workbook_safely()
    ws = wb[SHEET_CLIENTS]

    row = {
        "id": payload.get("id") or new_id("cl"),
        "name": payload["name"].strip(),
        "contactName": payload["contactName"].strip(),
        "email": payload["email"].strip(),
        "phone": (payload.get("phone") or "").strip() or None,
        "billingAddress": payload["billingAddress"].strip(),
        "gstin": (payload.get("gstin") or "").strip().upper() or None,
        "clientSince": payload.get("clientSince") or now_iso(),
        "notes": (payload.get("notes") or "").strip() or None,
    }
    append_row(ws, SHEET_CLIENTS, row)
    save_workbook(wb)
    return row


def update_client(client_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    errors = _validate(payload, partial=True)
    if errors:
        raise ValidationFailedError(errors)

    wb = load_workbook_safely()
    ws = wb[SHEET_CLIENTS]
    row_num = find_row_index(ws, SHEET_CLIENTS, "id", client_id)
    if row_num is None:
        raise NotFoundError(f"Client {client_id} not found.")

    current = read_rows(ws, SHEET_CLIENTS)[row_num - 2]
    updated = dict(current)
    for key in ("name", "contactName", "email", "phone", "billingAddress", "notes"):
        if key in payload and payload[key] is not None:
            updated[key] = payload[key].strip() if isinstance(payload[key], str) else payload[key]
    if "gstin" in payload and payload["gstin"] is not None:
        updated["gstin"] = payload["gstin"].strip().upper() or None

    write_row(ws, SHEET_CLIENTS, row_num, updated)
    save_workbook(wb)
    return updated


def delete_client(client_id: str) -> None:
    wb = load_workbook_safely()
    ws = wb[SHEET_CLIENTS]
    row_num = find_row_index(ws, SHEET_CLIENTS, "id", client_id)
    if row_num is None:
        raise NotFoundError(f"Client {client_id} not found.")
    delete_row(ws, row_num)
    save_workbook(wb)
