"""Standalone InvoiceItem CRUD (in addition to the nested items array
accepted by invoice_service.create_invoice/update_invoice) — for the
/api/invoice-items endpoints the spec calls for directly."""
from __future__ import annotations

from typing import Any

from app.excel.constants import SHEET_INVOICE_ITEMS, SHEET_INVOICES
from app.excel.rows import append_row, delete_row, find_row_index, read_rows, write_row
from app.excel.workbook import load_workbook_safely, save_workbook
from app.utils.errors import NotFoundError, ValidationFailedError
from app.utils.validators import new_id


def _validate(payload: dict[str, Any], partial: bool = False) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not partial or "description" in payload:
        if not (payload.get("description") or "").strip():
            errors["description"] = "Description is required."
    if not partial or "quantity" in payload:
        quantity = payload.get("quantity")
        if not isinstance(quantity, (int, float)) or quantity <= 0:
            errors["quantity"] = "Quantity must be a number greater than zero."
    if not partial or "unitPrice" in payload:
        unit_price = payload.get("unitPrice")
        if not isinstance(unit_price, (int, float)) or unit_price < 0:
            errors["unitPrice"] = "Unit price must be a non-negative number."
    return errors


def list_items_for_invoice(invoice_id: str) -> list[dict[str, Any]]:
    wb = load_workbook_safely()
    rows = read_rows(wb[SHEET_INVOICE_ITEMS], SHEET_INVOICE_ITEMS)
    return [r for r in rows if r["invoiceId"] == invoice_id]


def get_item(item_id: str) -> dict[str, Any]:
    wb = load_workbook_safely()
    rows = read_rows(wb[SHEET_INVOICE_ITEMS], SHEET_INVOICE_ITEMS)
    for row in rows:
        if row["id"] == item_id:
            return row
    raise NotFoundError(f"Invoice item {item_id} not found.")


def create_item(invoice_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    errors = _validate(payload)
    if errors:
        raise ValidationFailedError(errors)

    wb = load_workbook_safely()
    if find_row_index(wb[SHEET_INVOICES], SHEET_INVOICES, "id", invoice_id) is None:
        raise NotFoundError(f"Invoice {invoice_id} not found.")

    row = {
        "id": payload.get("id") or new_id("li"),
        "invoiceId": invoice_id,
        "productId": payload.get("productId"),
        "description": payload["description"].strip(),
        "hsnCode": payload.get("hsnCode"),
        "quantity": float(payload["quantity"]),
        "unitPrice": float(payload["unitPrice"]),
    }
    append_row(wb[SHEET_INVOICE_ITEMS], SHEET_INVOICE_ITEMS, row)
    save_workbook(wb)
    return row


def update_item(item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    errors = _validate(payload, partial=True)
    if errors:
        raise ValidationFailedError(errors)

    wb = load_workbook_safely()
    ws = wb[SHEET_INVOICE_ITEMS]
    row_num = find_row_index(ws, SHEET_INVOICE_ITEMS, "id", item_id)
    if row_num is None:
        raise NotFoundError(f"Invoice item {item_id} not found.")

    current = read_rows(ws, SHEET_INVOICE_ITEMS)[row_num - 2]
    updated = dict(current)
    for field in ("productId", "description", "hsnCode", "quantity", "unitPrice"):
        if field in payload and payload[field] is not None:
            updated[field] = payload[field]

    write_row(ws, SHEET_INVOICE_ITEMS, row_num, updated)
    save_workbook(wb)
    return updated


def delete_item(item_id: str) -> None:
    wb = load_workbook_safely()
    ws = wb[SHEET_INVOICE_ITEMS]
    row_num = find_row_index(ws, SHEET_INVOICE_ITEMS, "id", item_id)
    if row_num is None:
        raise NotFoundError(f"Invoice item {item_id} not found.")
    delete_row(ws, row_num)
    save_workbook(wb)
