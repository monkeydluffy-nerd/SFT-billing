"""Payment CRUD and durable payment-proof orchestration."""
from __future__ import annotations

import logging
import math
from collections.abc import Mapping
from typing import Any

from app.excel.constants import SHEET_INVOICES, SHEET_PAYMENTS
from app.excel.rows import (
    append_row,
    delete_row,
    find_row_index,
    read_rows,
    update_payment_proof,
    write_row,
)
from app.excel.workbook import load_workbook_safely, save_workbook
from app.services import activity_service
from app.services.calculation_service import compute_invoice_totals
from app.services.payment_proof_service import (
    AttachmentEnrichmentError,
    AttachmentReadbackError,
    AttachmentSecurityError,
    AttachmentServiceError,
    AttachmentUpload,
    AttachmentValidationError,
    get_payment_proof_service,
)
from app.utils.errors import NotFoundError, ValidationFailedError
from app.utils.validators import new_id, now_iso

VALID_METHODS = {"bank_transfer", "card", "upi", "cheque", "cash"}
_PROOF_UPLOAD_KEY = "_proof_upload"
_ALLOWED_PROOF_ERROR_STAGES = {"write", "readback", "metadata_enrichment", "cleanup"}
logger = logging.getLogger(__name__)


def _validate(payload: dict[str, Any]) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not payload.get("invoiceId"):
        errors["invoiceId"] = "Invoice is required."
    amount = payload.get("amount")
    if (
        amount is None
        or isinstance(amount, bool)
        or not isinstance(amount, (int, float))
        or not math.isfinite(float(amount))
        or amount <= 0
    ):
        errors["amount"] = "Amount must be a number greater than zero."
    if payload.get("method") not in VALID_METHODS:
        errors["method"] = "Select a valid payment method."
    return errors


def list_payments() -> list[dict[str, Any]]:
    wb = load_workbook_safely()
    return read_rows(wb[SHEET_PAYMENTS], SHEET_PAYMENTS)


def list_payments_for_invoice(invoice_id: str) -> list[dict[str, Any]]:
    return [p for p in list_payments() if p["invoiceId"] == invoice_id]


def get_payment(payment_id: str) -> dict[str, Any]:
    for row in list_payments():
        if row["id"] == payment_id:
            return row
    raise NotFoundError(f"Payment {payment_id} not found.")


def _paid_amount_for_invoice(wb, invoice_id: str, exclude_payment_id: str | None = None) -> float:
    rows = read_rows(wb[SHEET_PAYMENTS], SHEET_PAYMENTS)
    return sum(
        float(r["amount"])
        for r in rows
        if r["invoiceId"] == invoice_id and r["id"] != exclude_payment_id
    )


def _find_payment_row(wb, payment_id: str) -> dict[str, Any] | None:
    for row in read_rows(wb[SHEET_PAYMENTS], SHEET_PAYMENTS):
        if row.get("id") == payment_id:
            return row
    return None


def _allocate_payment_id(payments_ws, requested_id: Any) -> str:
    """Keep a caller-supplied id when unused, otherwise allocate a unique id."""
    if isinstance(requested_id, str) and requested_id.strip():
        return requested_id

    # ``new_id`` is UUID-backed in normal operation.  The loop also protects
    # the workbook invariant when a deterministic test clock/id source is in
    # use or an extremely unlikely collision occurs.
    for _ in range(100):
        candidate = new_id("pm")
        if find_row_index(payments_ws, SHEET_PAYMENTS, "id", candidate) is None:
            return candidate
    raise RuntimeError("Could not allocate a unique payment identity.")


def _coerce_proof_upload(payload: Mapping[str, Any]) -> AttachmentUpload | None:
    raw_upload = payload.get(_PROOF_UPLOAD_KEY)
    if raw_upload is None:
        return None
    if isinstance(raw_upload, (list, tuple)):
        raise AttachmentValidationError(
            "Payment proof must contain one uploaded file.",
            category="multiple_uploads",
            stage="write",
            retryable=False,
        )
    if isinstance(raw_upload, AttachmentUpload):
        return raw_upload
    if isinstance(raw_upload, Mapping):
        return AttachmentUpload.from_mapping(raw_upload)
    raise AttachmentValidationError(
        "Payment proof upload is invalid.",
        category="invalid_upload",
        stage="write",
        retryable=False,
    )


def _proof_error(
    payment_id: str,
    error: Exception,
    *,
    default_stage: str = "write",
) -> dict[str, Any]:
    """Map internal proof failures to one safe, actionable response error."""
    if isinstance(error, AttachmentReadbackError):
        code = "proof_unavailable"
        stage = "readback"
        message = "Payment was recorded, but its proof could not be read back. Retry the proof upload."
    elif isinstance(error, AttachmentValidationError) or isinstance(error, AttachmentSecurityError):
        code = "proof_invalid"
        stage = "write"
        message = "Payment was recorded, but the proof upload is invalid. Choose one valid file and retry."
    else:
        code = "proof_storage_failed"
        stage = getattr(error, "stage", default_stage)
        if stage not in _ALLOWED_PROOF_ERROR_STAGES:
            stage = default_stage if default_stage in _ALLOWED_PROOF_ERROR_STAGES else "write"
        if stage == "readback":
            message = "Payment was recorded, but its proof could not be read back. Retry the proof upload."
            code = "proof_unavailable"
        elif stage == "metadata_enrichment":
            message = "Payment was recorded, but its proof metadata could not be saved. Retry the proof upload."
        else:
            message = "Payment was recorded, but its proof could not be stored. Retry the proof upload."

    retryable = getattr(error, "retryable", None)
    if not isinstance(retryable, bool):
        retryable = code != "proof_invalid"

    return {
        "code": code,
        "stage": stage,
        "message": message,
        "paymentId": payment_id,
        "retryable": retryable,
    }


def _log_cleanup_diagnostic(payment_id: str, error: Exception) -> None:
    diagnostic = getattr(error, "cleanup_diagnostic_category", None)
    if diagnostic:
        # Only the safe category and stable domain id are logged; never an OS
        # exception, configured root, or server filesystem path.
        logger.warning(
            "Payment proof cleanup diagnostic category=%s payment_id=%s",
            diagnostic,
            payment_id,
        )


def _retained_payment(payment_id: str, fallback: dict[str, Any]) -> dict[str, Any]:
    try:
        return get_payment(payment_id)
    except Exception:
        # The durable row was already committed before proof handling began.
        # A reload failure must not manufacture a second payment or lose the
        # identity that the caller can use to retry proof handling.
        return fallback


def _proof_failure(
    payment_id: str,
    fallback: dict[str, Any],
    error: Exception,
    *,
    default_stage: str = "write",
) -> dict[str, Any]:
    _log_cleanup_diagnostic(payment_id, error)
    retained = _retained_payment(payment_id, fallback)
    return {
        "payment": retained,
        "proofError": _proof_error(payment_id, error, default_stage=default_stage),
    }


def _persist_proof(
    payment_id: str,
    upload: AttachmentUpload,
    fallback_payment: dict[str, Any],
) -> dict[str, Any]:
    """Stage/read/enrich one proof, then return the exact retained payment.

    The workbook callback saves metadata before ``replace`` cleans a prior
    reference.  If enrichment or saving fails, the callback restores the
    in-memory proof cells; the attachment service removes the new orphan and
    leaves the prior reference untouched.
    """
    try:
        wb = load_workbook_safely()
        payments_ws = wb[SHEET_PAYMENTS]
        current_payment = _find_payment_row(wb, payment_id)
        if current_payment is None:
            raise AttachmentEnrichmentError(
                "Payment proof metadata could not be enriched.",
                category="payment_not_found",
                stage="metadata_enrichment",
                retryable=True,
            )

        previous_proof = current_payment.get("paymentProof")
        prior_reference = (
            previous_proof.get("attachmentReference")
            if isinstance(previous_proof, Mapping)
            else None
        )
        attachment_service = get_payment_proof_service()

        def enrich(metadata: dict[str, Any]) -> None:
            try:
                update_payment_proof(payments_ws, payment_id, metadata)
                # This save is deliberately inside the attachment service's
                # enrichment callback: replacement cleanup is not allowed to
                # start until the same-row workbook metadata is durable.
                save_workbook(wb)
            except Exception:
                # Keep a shared in-memory workbook consistent when a test or
                # workbook adapter raises during save.  A fresh reload remains
                # the source of truth for the returned retained payment.
                try:
                    update_payment_proof(payments_ws, payment_id, previous_proof)
                except Exception as restore_error:
                    logger.warning(
                        "Payment proof metadata restore failed category=%s payment_id=%s",
                        type(restore_error).__name__,
                        payment_id,
                    )
                raise

        replacement = attachment_service.replace(
            payment_id,
            upload,
            prior_reference=prior_reference,
            metadata_enricher=enrich,
        )
        if not replacement.prior_cleanup.success:
            logger.warning(
                "Payment proof cleanup diagnostic category=%s payment_id=%s",
                replacement.prior_cleanup.diagnostic_category or "cleanup_failed",
                payment_id,
            )
        return {"payment": get_payment(payment_id)}
    except AttachmentServiceError as error:
        return _proof_failure(
            payment_id,
            fallback_payment,
            error,
            default_stage="metadata_enrichment",
        )
    except Exception as error:
        # Workbook adapters and injected test doubles may raise a plain
        # exception.  Keep it inside the proof-specific retained-payment
        # envelope instead of turning it into a duplicate/retryable payment.
        return _proof_failure(
            payment_id,
            fallback_payment,
            error,
            default_stage="metadata_enrichment",
        )


def record_payment(payload: dict[str, Any]) -> dict[str, Any]:
    """Record a payment once, then optionally enrich that same row with proof."""
    errors = _validate(payload)
    if errors:
        raise ValidationFailedError(errors)

    # Required payment validation and invoice association happen before any
    # proof value is inspected or any identity is allocated.
    wb = load_workbook_safely()
    invoices_ws = wb[SHEET_INVOICES]
    invoice_id = payload["invoiceId"]
    invoice_row_num = find_row_index(invoices_ws, SHEET_INVOICES, "id", invoice_id)
    if invoice_row_num is None:
        raise NotFoundError(f"Invoice {invoice_id} not found.")

    invoice_rows = read_rows(invoices_ws, SHEET_INVOICES)
    invoice_row = next(
        row for row in invoice_rows if row.get("id") == invoice_id
    )
    payments_ws = wb[SHEET_PAYMENTS]
    requested_id = payload.get("id")
    existing_payment = None
    if isinstance(requested_id, str) and requested_id.strip():
        existing_payment = _find_payment_row(wb, requested_id)

    # A POST carrying an existing payment id is the approved replacement
    # boundary.  It must never append another ledger row or emit activity.
    if existing_payment is not None:
        if existing_payment.get("invoiceId") != invoice_id:
            raise ValidationFailedError(
                {"invoiceId": "This payment identity is already associated with another invoice."}
            )
        try:
            proof_upload = _coerce_proof_upload(payload)
        except AttachmentServiceError as error:
            return _proof_failure(requested_id, existing_payment, error)
        if proof_upload is None:
            return existing_payment
        return _persist_proof(requested_id, proof_upload, existing_payment)

    payment_id = _allocate_payment_id(payments_ws, requested_id)
    client_id = payload.get("clientId") or invoice_row["clientId"]
    row = {
        "id": payment_id,
        "invoiceId": invoice_id,
        "clientId": client_id,
        "amount": round(float(payload["amount"]), 2),
        "method": payload["method"],
        "receivedAt": payload.get("receivedAt") or now_iso(),
        "reference": (payload.get("reference") or "").strip() or None,
        # Explicitly blank all proof metadata on the durable first write.
        "paymentProof": None,
    }
    append_row(payments_ws, SHEET_PAYMENTS, row)

    # Recompute paidAt on the invoice: only stamped once total paid >= grand total.
    from app.excel.constants import SHEET_INVOICE_ITEMS

    items = [
        i
        for i in read_rows(wb[SHEET_INVOICE_ITEMS], SHEET_INVOICE_ITEMS)
        if i["invoiceId"] == invoice_id
    ]
    total_paid = _paid_amount_for_invoice(wb, invoice_id)
    totals = compute_invoice_totals(
        items=items,
        cgst_rate=float(invoice_row["cgstRate"]),
        sgst_rate=float(invoice_row["sgstRate"]),
        discount=float(invoice_row["discount"] or 0),
        round_off=float(invoice_row["roundOff"] or 0),
        paid_amount=total_paid,
    )
    updated_invoice = dict(invoice_row)
    if total_paid >= totals["total"] and totals["total"] > 0 and not updated_invoice.get("paidAt"):
        updated_invoice["paidAt"] = row["receivedAt"]
    write_row(invoices_ws, SHEET_INVOICES, invoice_row_num, updated_invoice)

    # This save is the durable payment-row boundary.  Activity is emitted
    # only after it succeeds, and proof handling starts only after the event.
    save_workbook(wb)

    activity_service.add_activity_event({
        "type": "payment_received",
        "occurredAt": row["receivedAt"],
        "summary": f"Payment of {row['amount']} received for invoice {invoice_row['number']}",
        "clientId": client_id,
        "invoiceId": invoice_id,
        "paymentId": payment_id,
        "amount": row["amount"],
    })

    try:
        proof_upload = _coerce_proof_upload(payload)
    except AttachmentServiceError as error:
        return _proof_failure(payment_id, row, error)
    if proof_upload is None:
        return row
    return _persist_proof(payment_id, proof_upload, row)


def delete_payment(payment_id: str) -> None:
    wb = load_workbook_safely()
    ws = wb[SHEET_PAYMENTS]
    row_num = find_row_index(ws, SHEET_PAYMENTS, "id", payment_id)
    if row_num is None:
        raise NotFoundError(f"Payment {payment_id} not found.")
    delete_row(ws, row_num)
    save_workbook(wb)
