"""FastAPI router for invoices.

Mirrors src/invoice/types.ts field-for-field so the frontend can
`fetch('/api/invoices/{id}')` and pass the JSON straight into
buildInvoice() with no reshaping. Calculation lives ONLY on the
frontend/Excel layer (invoiceModel.ts / excelExport.ts) — this router
just stores/serves the raw payload, so totals are always derived from
one place, not recomputed and risking drift.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


class Seller(BaseModel):
    name: str
    nameSuffix: str
    legalName: str
    tagline: str
    address: list[str]
    phone: str
    email: str
    website: str
    gstin: str
    pan: str
    logo: str | None = None


class Buyer(BaseModel):
    name: str
    address: list[str]
    gstin: str
    state: str


class MetaRow(BaseModel):
    label: str
    value: str


class TaxRates(BaseModel):
    cgstRate: float
    sgstRate: float


class LineItemInput(BaseModel):
    description: str
    hsn: str
    qty: float
    unit: str
    rate: float


class BankDetails(BaseModel):
    accountName: str
    bankName: str
    accountNumber: str
    ifsc: str
    branch: str


class FooterText(BaseModel):
    left: str
    right: str


class RawInvoice(BaseModel):
    seller: Seller
    buyer: Buyer
    meta: list[MetaRow]
    tax: TaxRates
    items: list[LineItemInput]
    bank: BankDetails
    declaration: str
    footer: FooterText


# Swap this in-memory store for your real persistence layer.
_INVOICES: dict[str, RawInvoice] = {}


@router.get("/{invoice_id}", response_model=RawInvoice)
def get_invoice(invoice_id: str) -> RawInvoice:
    invoice = _INVOICES.get(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=RawInvoice)
def upsert_invoice(invoice_id: str, payload: RawInvoice) -> RawInvoice:
    _INVOICES[invoice_id] = payload
    return payload


@router.get("", response_model=list[str])
def list_invoice_ids() -> list[str]:
    return list(_INVOICES.keys())
