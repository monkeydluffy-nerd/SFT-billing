"""Invoice CRUD, including its owned InvoiceItems rows and derived totals/status.

An Invoice returned from this service always includes `items` (joined
from InvoiceItems) and `totals`/`status` (computed fresh from
calculation_service) — never stored/stale values from the sheet.
"""
from __future__ import annotations

from typing import Any

from app.excel.constants import SHEET_CLIENTS, SHEET_INVOICE_ITEMS, SHEET_INVOICES, SHEET_PAYMENTS
from app.excel.rows import append_row, delete_row, find_row_index, read_rows, write_row
from app.excel.workbook import load_workbook_safely, save_workbook
from app.services import activity_service
from app.services.calculation_service import compute_invoice_status, compute_invoice_totals
from app.services.numbering_service import is_invoice_number_taken, next_invoice_number
from app.utils.errors import ConflictError, NotFoundError, ValidationFailedError
from app.utils.validators import is_valid_iso_date, new_id, now_iso


def _validate_header(payload: dict[str, Any], partial: bool = False) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not partial or "clientId" in payload:
        if not payload.get("clientId"):
            errors["clientId"] = "Select a client."
    if not partial or "issueDate" in payload:
        if not payload.get("issueDate") or not is_valid_iso_date(payload["issueDate"]):
            errors["issueDate"] = "Issue date must be a valid date."
    if not partial or "dueDate" in payload:
        if not payload.get("dueDate") or not is_valid_iso_date(payload["dueDate"]):
            errors["dueDate"] = "Due date must be a valid date."
    gst = payload.get("gst")
    if gst is not None:
        cgst = gst.get("cgstRate")
        sgst = gst.get("sgstRate")
        if cgst is None or not (0 <= cgst <= 1):
            errors["gst.cgstRate"] = "CGST rate must be between 0 and 1 (e.g. 0.09 for 9%)."
        if sgst is None or not (0 <= sgst <= 1):
            errors["gst.sgstRate"] = "SGST rate must be between 0 and 1 (e.g. 0.09 for 9%)."
    discount = payload.get("discount")
    if discount is not None and discount < 0:
        errors["discount"] = "Discount can't be negative."
    return errors


def _validate_items(items: list[dict[str, Any]]) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not items:
        errors["items"] = "Add at least one line item."
        return errors
    for index, item in enumerate(items):
        if not (item.get("description") or "").strip():
            errors[f"items[{index}].description"] = "Description is required."
        quantity = item.get("quantity")
        if not isinstance(quantity, (int, float)) or quantity <= 0:
            errors[f"items[{index}].quantity"] = "Quantity must be a number greater than zero."
        unit_price = item.get("unitPrice")
        if not isinstance(unit_price, (int, float)) or unit_price < 0:
            errors[f"items[{index}].unitPrice"] = "Unit price must be a non-negative number."
    return errors


def _client_exists(wb, client_id: str) -> bool:
    rows = read_rows(wb[SHEET_CLIENTS], SHEET_CLIENTS)
    return any(r["id"] == client_id for r in rows)


def _items_for_invoice(wb, invoice_id: str) -> list[dict[str, Any]]:
    rows = read_rows(wb[SHEET_INVOICE_ITEMS], SHEET_INVOICE_ITEMS)
    return [r for r in rows if r["invoiceId"] == invoice_id]


def _paid_amount_for_invoice(wb, invoice_id: str) -> float:
    rows = read_rows(wb[SHEET_PAYMENTS], SHEET_PAYMENTS)
    return sum(float(r["amount"]) for r in rows if r["invoiceId"] == invoice_id)


def _hydrate(wb, invoice_row: dict[str, Any]) -> dict[str, Any]:
    items = _items_for_invoice(wb, invoice_row["id"])
    paid_amount = _paid_amount_for_invoice(wb, invoice_row["id"])
    totals = compute_invoice_totals(
        items=items,
        cgst_rate=float(invoice_row["cgstRate"]),
        sgst_rate=float(invoice_row["sgstRate"]),
        discount=float(invoice_row["discount"] or 0),
        round_off=float(invoice_row["roundOff"] or 0),
        paid_amount=paid_amount,
    )
    status = compute_invoice_status(
        is_draft=bool(invoice_row["isDraft"]),
        cancelled_at=invoice_row.get("cancelledAt"),
        paid_at=invoice_row.get("paidAt"),
        paid_amount=paid_amount,
        total=totals["total"],
        due_date=invoice_row["dueDate"],
    )
    return {
        "id": invoice_row["id"],
        "number": invoice_row["number"],
        "clientId": invoice_row["clientId"],
        "issueDate": invoice_row["issueDate"],
        "dueDate": invoice_row["dueDate"],
        "gst": {"cgstRate": float(invoice_row["cgstRate"]), "sgstRate": float(invoice_row["sgstRate"])},
        "discount": float(invoice_row["discount"] or 0),
        "roundOff": float(invoice_row["roundOff"] or 0),
        "notes": invoice_row.get("notes"),
        "terms": invoice_row.get("terms"),
        "supplierCode": invoice_row.get("supplierCode"),
        "poNumber": invoice_row.get("poNumber"),
        "poDate": invoice_row.get("poDate"),
        "transporter": invoice_row.get("transporter"),
        "items": [
            {
                "id": i["id"],
                "invoiceId": i["invoiceId"],
                "productId": i.get("productId"),
                "description": i["description"],
                "hsnCode": i.get("hsnCode"),
                "quantity": float(i["quantity"]),
                "unitPrice": float(i["unitPrice"]),
            }
            for i in items
        ],
        "isDraft": bool(invoice_row["isDraft"]),
        "sentAt": invoice_row.get("sentAt"),
        "billedAt": invoice_row.get("billedAt"),
        "viewedAt": invoice_row.get("viewedAt"),
        "paidAt": invoice_row.get("paidAt"),
        "cancelledAt": invoice_row.get("cancelledAt"),
        "status": status,
        "totals": totals,
    }


def list_invoices() -> list[dict[str, Any]]:
    wb = load_workbook_safely()
    rows = read_rows(wb[SHEET_INVOICES], SHEET_INVOICES)
    return [_hydrate(wb, row) for row in rows]


def get_invoice(invoice_id: str) -> dict[str, Any]:
    wb = load_workbook_safely()
    rows = read_rows(wb[SHEET_INVOICES], SHEET_INVOICES)
    for row in rows:
        if row["id"] == invoice_id:
            return _hydrate(wb, row)
    raise NotFoundError(f"Invoice {invoice_id} not found.")


def list_invoices_for_client(client_id: str) -> list[dict[str, Any]]:
    return [inv for inv in list_invoices() if inv["clientId"] == client_id]


def create_invoice(payload: dict[str, Any]) -> dict[str, Any]:
    header_errors = _validate_header(payload)
    items = payload.get("items") or []
    item_errors = _validate_items(items)
    errors = {**header_errors, **item_errors}
    if "gst" not in payload or payload.get("gst") is None:
        errors["gst"] = "GST rates are required."
    if errors:
        raise ValidationFailedError(errors)

    wb = load_workbook_safely()
    if not _client_exists(wb, payload["clientId"]):
        raise NotFoundError(f"Client {payload['clientId']} not found.")

    number = payload.get("number") or next_invoice_number(wb)
    if is_invoice_number_taken(wb, number):
        raise ConflictError(f"Invoice number {number} already exists.")

    invoice_id = payload.get("id") or new_id("iv")
    is_draft = bool(payload.get("isDraft", True))
    invoice_row = {
        "id": invoice_id,
        "number": number,
        "clientId": payload["clientId"],
        "issueDate": payload["issueDate"],
        "dueDate": payload["dueDate"],
        "cgstRate": payload["gst"]["cgstRate"],
        "sgstRate": payload["gst"]["sgstRate"],
        "discount": payload.get("discount", 0) or 0,
        "roundOff": payload.get("roundOff", 0) or 0,
        "notes": payload.get("notes"),
        "terms": payload.get("terms"),
        "supplierCode": payload.get("supplierCode"),
        "poNumber": payload.get("poNumber"),
        "poDate": payload.get("poDate"),
        "transporter": payload.get("transporter"),
        "isDraft": is_draft,
        # Billing is distinct from sending. A billed invoice gets billedAt,
        # while sentAt remains unset until the explicit send action.
        "billedAt": None if is_draft else payload.get("billedAt") or now_iso(),
        "sentAt": payload.get("sentAt"),
        "viewedAt": None,
        "paidAt": None,
        "cancelledAt": None,
    }
    append_row(wb[SHEET_INVOICES], SHEET_INVOICES, invoice_row)

    items_ws = wb[SHEET_INVOICE_ITEMS]
    for item in items:
        append_row(items_ws, SHEET_INVOICE_ITEMS, {
            "id": item.get("id") or new_id("li"),
            "invoiceId": invoice_id,
            "productId": item.get("productId"),
            "description": item["description"].strip(),
            "hsnCode": item.get("hsnCode"),
            "quantity": float(item["quantity"]),
            "unitPrice": float(item["unitPrice"]),
        })

    save_workbook(wb)

    activity_service.add_activity_event({
        "type": "invoice_created",
        "summary": f"Invoice {number} created",
        "clientId": payload["clientId"],
        "invoiceId": invoice_id,
    })

    return get_invoice(invoice_id)


def update_invoice(invoice_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    wb = load_workbook_safely()
    ws = wb[SHEET_INVOICES]
    row_num = find_row_index(ws, SHEET_INVOICES, "id", invoice_id)
    if row_num is None:
        raise NotFoundError(f"Invoice {invoice_id} not found.")

    header_errors = _validate_header(payload, partial=True)
    items = payload.get("items")
    item_errors = _validate_items(items) if items is not None else {}
    errors = {**header_errors, **item_errors}
    if errors:
        raise ValidationFailedError(errors)

    current_rows = read_rows(ws, SHEET_INVOICES)
    current = current_rows[row_num - 2]

    if payload.get("clientId") and not _client_exists(wb, payload["clientId"]):
        raise NotFoundError(f"Client {payload['clientId']} not found.")

    updated = dict(current)
    simple_fields = [
        "clientId", "issueDate", "dueDate", "discount", "roundOff",
        "notes", "terms", "supplierCode", "poNumber", "poDate", "transporter",
    ]
    for field in simple_fields:
        if field in payload and payload[field] is not None:
            updated[field] = payload[field]
    if payload.get("gst"):
        updated["cgstRate"] = payload["gst"]["cgstRate"]
        updated["sgstRate"] = payload["gst"]["sgstRate"]

    was_draft = bool(current["isDraft"])
    if "isDraft" in payload and payload["isDraft"] is not None:
        updated["isDraft"] = payload["isDraft"]
        if was_draft and not payload["isDraft"] and not updated.get("billedAt"):
            updated["billedAt"] = payload.get("billedAt") or now_iso()
    if "sentAt" in payload and payload["sentAt"] is not None:
        updated["sentAt"] = payload["sentAt"]
    if "cancelledAt" in payload and payload["cancelledAt"] is not None:
        updated["cancelledAt"] = payload["cancelledAt"]

    write_row(ws, SHEET_INVOICES, row_num, updated)

    if items is not None:
        items_ws = wb[SHEET_INVOICE_ITEMS]
        # Replace all items for this invoice: delete existing rows, append the new set.
        item_rows = read_rows(items_ws, SHEET_INVOICE_ITEMS)
        # Delete from the bottom up so row numbers of not-yet-deleted rows don't shift.
        to_delete = [
            idx for idx, r in enumerate(item_rows, start=2) if r["invoiceId"] == invoice_id
        ]
        for excel_row_num in reversed(to_delete):
            delete_row(items_ws, excel_row_num)
        for item in items:
            append_row(items_ws, SHEET_INVOICE_ITEMS, {
                "id": item.get("id") or new_id("li"),
                "invoiceId": invoice_id,
                "productId": item.get("productId"),
                "description": item["description"].strip(),
                "hsnCode": item.get("hsnCode"),
                "quantity": float(item["quantity"]),
                "unitPrice": float(item["unitPrice"]),
            })

    save_workbook(wb)

    return get_invoice(invoice_id)


def delete_invoice(invoice_id: str) -> None:
    wb = load_workbook_safely()
    ws = wb[SHEET_INVOICES]
    row_num = find_row_index(ws, SHEET_INVOICES, "id", invoice_id)
    if row_num is None:
        raise NotFoundError(f"Invoice {invoice_id} not found.")
    delete_row(ws, row_num)

    items_ws = wb[SHEET_INVOICE_ITEMS]
    item_rows = read_rows(items_ws, SHEET_INVOICE_ITEMS)
    to_delete = [idx for idx, r in enumerate(item_rows, start=2) if r["invoiceId"] == invoice_id]
    for excel_row_num in reversed(to_delete):
        delete_row(items_ws, excel_row_num)

    save_workbook(wb)
