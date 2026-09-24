import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from app.excel.constants import SHEET_CLIENTS, SHEET_INVOICE_ITEMS, SHEET_INVOICES, SHEET_PAYMENTS
from app.excel.rows import append_row, read_rows
from app.excel.workbook import WorkbookAccessError, create_new_workbook
from app.services import payment_service
from app.services.payment_proof_service import (
    AttachmentEnrichmentError,
    AttachmentReadbackError,
    AttachmentWriteError,
    PaymentProofAttachmentService,
)
from app.utils.errors import ValidationFailedError


class PaymentServiceOrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.attachment_service = PaymentProofAttachmentService(
            Path(self.temp_dir.name) / "payment-proofs"
        )
        self.workbook = create_new_workbook()
        append_row(
            self.workbook[SHEET_CLIENTS],
            SHEET_CLIENTS,
            {"id": "client-task-34", "name": "Task 3.4 Client"},
        )
        append_row(
            self.workbook[SHEET_INVOICES],
            SHEET_INVOICES,
            {
                "id": "invoice-task-34",
                "number": "INV-2034",
                "clientId": "client-task-34",
                "issueDate": "2025-06-01T00:00:00+00:00",
                "dueDate": "2025-06-30T00:00:00+00:00",
                "cgstRate": 0.09,
                "sgstRate": 0.09,
                "discount": 0,
                "roundOff": 0,
                "isDraft": False,
            },
        )
        append_row(
            self.workbook[SHEET_INVOICE_ITEMS],
            SHEET_INVOICE_ITEMS,
            {
                "id": "line-task-34",
                "invoiceId": "invoice-task-34",
                "description": "Implementation",
                "quantity": 1,
                "unitPrice": 1000,
            },
        )
        self.activity_events = []
        self.saved_snapshots = []

    def tearDown(self):
        self.temp_dir.cleanup()

    @staticmethod
    def _upload(content=b"proof-content", file_name="receipt.pdf"):
        return {
            "fileName": file_name,
            "mimeType": "application/pdf",
            "sizeBytes": len(content),
            "content": content,
        }

    def _activity(self, event):
        self.activity_events.append(
            {
                "event": dict(event),
                "payments": read_rows(self.workbook[SHEET_PAYMENTS], SHEET_PAYMENTS),
            }
        )
        return event

    def _save(self, workbook):
        self.saved_snapshots.append(
            read_rows(workbook[SHEET_PAYMENTS], SHEET_PAYMENTS)
        )

    def _patch_runtime(self, *, proof_service=None, save_side_effect=None):
        return (
            patch.object(
                payment_service,
                "load_workbook_safely",
                return_value=self.workbook,
            ),
            patch.object(
                payment_service,
                "save_workbook",
                side_effect=save_side_effect or self._save,
            ),
            patch.object(
                payment_service.activity_service,
                "add_activity_event",
                side_effect=self._activity,
            ),
            patch.object(
                payment_service,
                "get_payment_proof_service",
                return_value=proof_service or self.attachment_service,
            ),
        )

    def test_invalid_required_payment_fields_are_rejected_before_workbook_or_proof_work(self):
        invalid_payloads = (
            {"invoiceId": "invoice-task-34", "amount": 0, "method": "upi"},
            {"invoiceId": "invoice-task-34", "amount": 1250, "method": ""},
            {"invoiceId": "", "amount": 1250, "method": "upi"},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with patch.object(payment_service, "load_workbook_safely") as load, patch.object(
                    payment_service.activity_service,
                    "add_activity_event",
                ) as activity:
                    with self.assertRaises(ValidationFailedError):
                        payment_service.record_payment(payload)

                load.assert_not_called()
                activity.assert_not_called()
                self.assertEqual(
                    read_rows(self.workbook[SHEET_PAYMENTS], SHEET_PAYMENTS),
                    [],
                )

        payload = {
            "invoiceId": "invoice-task-34",
            "amount": 1250,
            "method": "upi",
            "receivedAt": "2025-06-15T10:30:00+00:00",
        }
        patchers = self._patch_runtime()
        with patchers[0] as load, patchers[1] as save, patchers[2] as activity, patchers[3]:
            with patch.object(payment_service, "new_id", return_value="pm-generated-task-34"):
                result = payment_service.record_payment(payload)

        self.assertEqual(result["id"], "pm-generated-task-34")
        self.assertEqual(result["invoiceId"], "invoice-task-34")
        self.assertIsNone(result["paymentProof"])
        self.assertEqual(save.call_count, 1)
        self.assertEqual(activity.call_count, 1)
        self.assertEqual(self.activity_events[0]["payments"][0]["id"], result["id"])
        self.assertIsNone(self.activity_events[0]["payments"][0]["paymentProof"])
        self.assertEqual(len(read_rows(self.workbook[SHEET_PAYMENTS], SHEET_PAYMENTS)), 1)
        load.assert_called_once()

    def test_proof_is_written_read_back_and_enriched_on_the_same_payment_row(self):
        payload = {
            "id": "pm-proof-task-34",
            "invoiceId": "invoice-task-34",
            "amount": 1250,
            "method": "upi",
            "receivedAt": "2025-06-15T10:30:00+00:00",
            "_proof_upload": self._upload(),
        }
        patchers = self._patch_runtime()
        with patchers[0], patchers[1] as save, patchers[2] as activity, patchers[3]:
            result = payment_service.record_payment(payload)

        payment = result["payment"]
        self.assertEqual(payment["id"], "pm-proof-task-34")
        self.assertEqual(payment["invoiceId"], "invoice-task-34")
        self.assertEqual(payment["paymentProof"]["fileName"], "receipt.pdf")
        self.assertTrue(
            payment["paymentProof"]["attachmentReference"].startswith("pm-proof-task-34/")
        )
        self.assertEqual(save.call_count, 2)
        self.assertIsNone(self.saved_snapshots[0][0]["paymentProof"])
        self.assertIsNotNone(self.saved_snapshots[1][0]["paymentProof"])
        self.assertEqual(activity.call_count, 1)
        self.assertIsNone(self.activity_events[0]["payments"][0]["paymentProof"])
        self.assertEqual(len(read_rows(self.workbook[SHEET_PAYMENTS], SHEET_PAYMENTS)), 1)
        stored_path = self.attachment_service._root / payment["paymentProof"]["attachmentReference"]
        self.assertTrue(stored_path.is_file())

    def test_proof_failures_retain_the_durable_payment_without_duplicate_activity(self):
        failures = (
            AttachmentWriteError(
                "safe write failure",
                category="write_failed",
                stage="write",
                retryable=True,
            ),
            AttachmentReadbackError(
                "safe readback failure",
                category="readback_failed",
                stage="readback",
                retryable=True,
            ),
            AttachmentEnrichmentError(
                "safe enrichment failure",
                category="metadata_enrichment_failed",
                stage="metadata_enrichment",
                retryable=True,
            ),
        )
        for failure in failures:
            with self.subTest(stage=failure.stage):
                self.workbook = create_new_workbook()
                append_row(
                    self.workbook[SHEET_INVOICES],
                    SHEET_INVOICES,
                    {
                        "id": "invoice-task-34",
                        "number": "INV-2034",
                        "clientId": "client-task-34",
                        "cgstRate": 0.09,
                        "sgstRate": 0.09,
                        "discount": 0,
                        "roundOff": 0,
                        "isDraft": False,
                    },
                )
                failing_service = Mock()
                failing_service.replace.side_effect = failure
                payload = {
                    "id": f"pm-failure-{failure.stage}",
                    "invoiceId": "invoice-task-34",
                    "amount": 1250,
                    "method": "upi",
                    "_proof_upload": self._upload(),
                }
                self.activity_events = []
                self.saved_snapshots = []
                patchers = self._patch_runtime(proof_service=failing_service)
                with patchers[0], patchers[1] as save, patchers[2] as activity, patchers[3]:
                    result = payment_service.record_payment(payload)

                self.assertEqual(result["payment"]["id"], payload["id"])
                self.assertEqual(result["payment"]["invoiceId"], payload["invoiceId"])
                self.assertIsNone(result["payment"]["paymentProof"])
                self.assertEqual(result["proofError"]["stage"], failure.stage)
                self.assertEqual(result["proofError"]["paymentId"], payload["id"])
                self.assertTrue(result["proofError"]["message"])
                self.assertEqual(save.call_count, 1)
                self.assertEqual(activity.call_count, 1)
                self.assertEqual(
                    len(read_rows(self.workbook[SHEET_PAYMENTS], SHEET_PAYMENTS)),
                    1,
                )

    def test_successful_replacement_enriches_before_prior_cleanup_without_activity(self):
        initial_payload = {
            "id": "pm-replace-task-34",
            "invoiceId": "invoice-task-34",
            "amount": 1250,
            "method": "upi",
            "_proof_upload": self._upload(b"prior", "prior.pdf"),
        }
        save_calls = []

        def save_initial(workbook):
            save_calls.append(read_rows(workbook[SHEET_PAYMENTS], SHEET_PAYMENTS))

        with patch.object(payment_service, "load_workbook_safely", return_value=self.workbook), patch.object(
            payment_service, "save_workbook", side_effect=save_initial
        ) as save, patch.object(
            payment_service.activity_service,
            "add_activity_event",
            side_effect=self._activity,
        ) as activity, patch.object(
            payment_service,
            "get_payment_proof_service",
            return_value=self.attachment_service,
        ):
            first = payment_service.record_payment(initial_payload)
            prior_reference = first["payment"]["paymentProof"]["attachmentReference"]
            prior_path = self.attachment_service._root / prior_reference
            observed_prior_during_enrichment = []

            def save_replacement(workbook):
                observed_prior_during_enrichment.append(prior_path.is_file())
                save_calls.append(read_rows(workbook[SHEET_PAYMENTS], SHEET_PAYMENTS))

            save.side_effect = save_replacement
            replacement = payment_service.record_payment(
                {
                    **initial_payload,
                    "_proof_upload": self._upload(b"replacement", "replacement.pdf"),
                }
            )

        new_payment = replacement["payment"]
        new_reference = new_payment["paymentProof"]["attachmentReference"]
        self.assertEqual(new_payment["id"], initial_payload["id"])
        self.assertEqual(new_payment["invoiceId"], initial_payload["invoiceId"])
        self.assertNotEqual(new_reference, prior_reference)
        self.assertEqual(observed_prior_during_enrichment, [True])
        self.assertFalse(prior_path.exists())
        self.assertTrue((self.attachment_service._root / new_reference).is_file())
        self.assertEqual(activity.call_count, 1)
        self.assertEqual(len(read_rows(self.workbook[SHEET_PAYMENTS], SHEET_PAYMENTS)), 1)
        self.assertEqual(save.call_count, 3)

    def test_failed_replacement_retains_prior_proof_and_does_not_emit_activity(self):
        initial_payload = {
            "id": "pm-replace-failure-task-34",
            "invoiceId": "invoice-task-34",
            "amount": 1250,
            "method": "upi",
            "_proof_upload": self._upload(b"prior", "prior.pdf"),
        }
        should_fail = False

        def save_or_fail(workbook):
            if should_fail:
                raise WorkbookAccessError("safe workbook failure")

        with patch.object(payment_service, "load_workbook_safely", return_value=self.workbook), patch.object(
            payment_service, "save_workbook", side_effect=save_or_fail
        ) as save, patch.object(
            payment_service.activity_service,
            "add_activity_event",
            side_effect=self._activity,
        ) as activity, patch.object(
            payment_service,
            "get_payment_proof_service",
            return_value=self.attachment_service,
        ):
            first = payment_service.record_payment(initial_payload)
            prior_payment = first["payment"]
            prior_reference = prior_payment["paymentProof"]["attachmentReference"]
            prior_path = self.attachment_service._root / prior_reference
            should_fail = True
            result = payment_service.record_payment(
                {
                    **initial_payload,
                    "_proof_upload": self._upload(b"replacement", "replacement.pdf"),
                }
            )

        self.assertEqual(result["payment"]["id"], initial_payload["id"])
        self.assertEqual(
            result["payment"]["paymentProof"]["attachmentReference"],
            prior_reference,
        )
        self.assertEqual(result["proofError"]["stage"], "metadata_enrichment")
        self.assertTrue(prior_path.is_file())
        self.assertEqual(
            [path for path in (self.attachment_service._root / initial_payload["id"]).iterdir() if not path.name.startswith(".")],
            [prior_path],
        )
        self.assertEqual(activity.call_count, 1)
        self.assertEqual(save.call_count, 3)


if __name__ == "__main__":
    unittest.main()
