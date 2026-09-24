import unittest
from unittest.mock import patch

from app.excel.constants import SHEET_CLIENTS, SHEET_INVOICE_ITEMS, SHEET_INVOICES
from app.excel.rows import append_row
from app.excel.workbook import create_new_workbook, ensure_sheets_present
from app.services import invoice_service
from app.services.numbering_service import next_invoice_number


class InvoiceLifecycleTests(unittest.TestCase):
    def _client(self):
        return {"id": "client-1"}

    def _invoice_row(self, *, is_draft: bool, sent_at=None, billed_at=None):
        return {
            "id": "invoice-1",
            "number": "INV-1035",
            "clientId": "client-1",
            "issueDate": "2025-05-01T00:00:00+00:00",
            "dueDate": "2025-05-16T00:00:00+00:00",
            "cgstRate": 0.09,
            "sgstRate": 0.09,
            "discount": 0,
            "roundOff": 0,
            "isDraft": is_draft,
            "billedAt": billed_at,
            "sentAt": sent_at,
            "viewedAt": None,
            "paidAt": None,
            "cancelledAt": None,
        }

    def _item(self):
        return {
            "id": "line-1",
            "invoiceId": "invoice-1",
            "description": "Consulting",
            "quantity": 1,
            "unitPrice": 1000,
        }

    def test_number_allocator_scans_drafts_and_billed_invoices(self):
        wb = create_new_workbook()
        ws = wb[SHEET_INVOICES]
        append_row(ws, SHEET_INVOICES, {"id": "billed", "number": "INV-1035", "isDraft": False})
        append_row(ws, SHEET_INVOICES, {"id": "draft", "number": "INV-1039", "isDraft": True})

        self.assertEqual(next_invoice_number(wb), "INV-1040")

    def test_billed_creation_sets_billed_at_without_marking_invoice_sent(self):
        wb = create_new_workbook()
        append_row(wb[SHEET_CLIENTS], SHEET_CLIENTS, self._client())
        activity = {"type": "invoice_created"}

        payload = {
            "id": "invoice-1",
            "clientId": "client-1",
            "issueDate": "2025-05-01T00:00:00+00:00",
            "dueDate": "2025-05-16T00:00:00+00:00",
            "gst": {"cgstRate": 0.09, "sgstRate": 0.09},
            "discount": 0,
            "roundOff": 0,
            "isDraft": False,
            "items": [{"description": "Consulting", "quantity": 1, "unitPrice": 1000}],
        }

        with patch.object(invoice_service, "load_workbook_safely", return_value=wb), patch.object(
            invoice_service, "save_workbook"
        ), patch.object(invoice_service.activity_service, "add_activity_event", return_value=activity):
            result = invoice_service.create_invoice(payload)

        self.assertFalse(result["isDraft"])
        self.assertTrue(result["billedAt"])
        self.assertIsNone(result["sentAt"])

    def test_billing_existing_draft_sets_billed_at_and_preserves_sent_at(self):
        wb = create_new_workbook()
        append_row(wb[SHEET_CLIENTS], SHEET_CLIENTS, self._client())
        append_row(
            wb[SHEET_INVOICES],
            SHEET_INVOICES,
            self._invoice_row(is_draft=True, sent_at="2025-05-02T10:00:00+00:00"),
        )
        append_row(wb[SHEET_INVOICE_ITEMS], SHEET_INVOICE_ITEMS, self._item())
        billed_at = "2025-05-03T10:00:00+00:00"

        with patch.object(invoice_service, "load_workbook_safely", return_value=wb), patch.object(
            invoice_service, "save_workbook"
        ), patch.object(invoice_service.activity_service, "add_activity_event") as activity:
            result = invoice_service.update_invoice("invoice-1", {"isDraft": False, "billedAt": billed_at})

        self.assertFalse(result["isDraft"])
        self.assertEqual(result["billedAt"], billed_at)
        self.assertEqual(result["sentAt"], "2025-05-02T10:00:00+00:00")
        activity.assert_not_called()

    def test_legacy_invoice_sheet_gets_billed_at_header_without_reordering(self):
        wb = create_new_workbook()
        ws = wb[SHEET_INVOICES]
        original_headers = [ws.cell(row=1, column=i).value for i in range(1, ws.max_column)]
        ws.delete_cols(ws.max_column)

        changed = ensure_sheets_present(wb)

        headers = [ws.cell(row=1, column=i).value for i in range(1, ws.max_column + 1)]
        self.assertTrue(changed)
        self.assertEqual(headers[:-1], original_headers)
        self.assertEqual(headers[-1], "billedAt")


if __name__ == "__main__":
    unittest.main()
