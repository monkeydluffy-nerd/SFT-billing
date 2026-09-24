from __future__ import annotations

from fastapi import APIRouter

from app.services import invoice_service
from app.utils.http_errors import raise_as_http

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.get("")
def list_invoices() -> list[dict]:
    try:
        return invoice_service.list_invoices()
    except Exception as exc:
        raise_as_http(exc)


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str) -> dict:
    try:
        return invoice_service.get_invoice(invoice_id)
    except Exception as exc:
        raise_as_http(exc)


@router.post("", status_code=201)
def create_invoice(payload: dict) -> dict:
    try:
        return invoice_service.create_invoice(payload)
    except Exception as exc:
        raise_as_http(exc)


@router.put("/{invoice_id}")
def update_invoice(invoice_id: str, payload: dict) -> dict:
    try:
        return invoice_service.update_invoice(invoice_id, payload)
    except Exception as exc:
        raise_as_http(exc)


@router.delete("/{invoice_id}", status_code=200)
def delete_invoice(invoice_id: str) -> dict:
    try:
        invoice_service.delete_invoice(invoice_id)
        return {"deleted": True, "id": invoice_id}
    except Exception as exc:
        raise_as_http(exc)
