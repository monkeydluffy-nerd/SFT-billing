# Implementation Plan: SFT Billing Final Stabilization

## Overview

Execute one coordinated stabilization pass for the canonical React/TypeScript/Vite application at `sft-billing-phase2.2-gst/sft-billing` and the existing FastAPI/openpyxl backend at `backend`. The pass must preserve the DataProvider boundary and workbook as the payment source of truth, complete optional payment-proof persistence, establish one shared invoice document model/renderer, make invoice navigation exact and stable-id based, correct lifecycle/financial semantics and targeted UI defects, and finish with automated and manual verification.

The implementation language is the existing TypeScript/Python stack. Do not implement application code while creating or reviewing this plan.

Affected areas include frontend payment/domain types and providers (`src/types/payment.ts`, `src/types/index.ts`, `src/services/dataProvider.ts`, `src/services/mockDataProvider.ts`, `src/services/apiDataProvider.ts`, payment hooks), invoice pages/components and shared document/export code (`src/pages/CreateInvoicePage.tsx`, `src/pages/InvoicePage.tsx`, `src/components/create-invoice/InvoicePreview.tsx`, new shared renderer/model, `src/services/invoiceExportService.ts`), payment/receipt and navigation surfaces (`src/pages/PaymentsPage.tsx`, `src/components/payments/PaymentReceiptView.tsx`, `src/components/shared/InvoiceNumberLink.tsx`, `src/hooks/useWorkspaceStore.ts`, `src/App.tsx`, Invoices/Overview/Clients/Client Detail/Reports/Intelligence/CommandPalette), line input/AURA/Settings (`LineItemEditor.tsx`, `AuraPanel.tsx`, `WorkspaceSettingsPage.tsx`), invoice math/words/numbering, and TypeScript/Vite configuration. Backend areas include `backend/app/models/schemas.py`, `backend/app/routes/payments.py`, `backend/app/services/payment_service.py`, a new managed attachment helper/service, `backend/app/excel/constants.py`, `backend/app/excel/rows.py`, workbook initialization/load paths, and existing activity integration.

## Tasks

- [x] 1. Inspect the existing implementation and establish a baseline before changing code
  - [x] 1.1 Inventory the current frontend pages/components/services/hooks/types, backend schemas/routes/services/excel helpers, existing export and navigation state, and test/build commands; verify the actual current implementation against the requirements/design before selecting edit points.
    - Explicitly inspect `sft-billing-phase2.2-gst/sft-billing` and `backend`, including `InvoicePreview`, `InvoicePage`, `CreateInvoicePage`, `PaymentsPage`, `WorkspaceSettingsPage`, Reports/Intelligence/CommandPalette, payment contracts, `invoiceMath`, `amountInWords`, numbering, export, `backend/app/routes/payments.py`, `payment_service.py`, `schemas.py`, and workbook helpers.
    - Record current behavior and affected files without introducing a parallel implementation or assuming stale design paths are present.
    - _Requirements: 1.1-1.5, 5.1-5.9, 8.1-9.7, 10.1-10.6, 19.1-19.5_
  - [x] 1.2 Run the existing focused unit, backend, integration, TypeScript, ESLint, and build checks that are available before edits; capture baseline failures for lifecycle, payment/proof, renderer/navigation, terminology, layout, encoding, and configuration issues.
    - Verify numbering, invoice math, amount-in-words, payment routes, workbook loading, and current export behavior before changing verified implementation.
    - _Requirements: 12.5-12.7, 19.1-19.5_

- [ ] 2. Establish the shared payment domain and provider contract
  - [x] 2.1 Add the optional `PaymentProof`, `PaymentProofUpload`, `PaymentProofError`, and `RecordPaymentResult` shapes to the existing frontend payment/domain type locations without changing payment identity, amount, method, invoice association, or timestamps.
    - Keep proof singular and optional; use an opaque stable `attachmentReference`, never a browser path or binary-in-storage value.
    - _Requirements: 1.5, 8.1-8.3, 8.8-8.10, 9.7_
  - [x] 2.2 Extend `DataProvider`, `mockDataProvider`, `apiDataProvider`, and payment hooks as one contract change for no-proof JSON and proof-bearing multipart submissions, persisted proof metadata on reads, structured proof errors, reload-driven display state, and one-file proof replacement through the same approved payment boundary.
    - Keep replacement identified by the existing payment id and `invoiceId`; do not expose a second public payment mutation API or allow any presentation component to access workbook, attachment, filesystem, or `localStorage` storage.
    - _Requirements: 1.1-1.5, 8.3, 8.6-8.10, 8.11, 9.1-9.7_
  - [~] 2.3 Write mandatory provider contract/unit tests for payment submission with and without proof, required-field rejection without a provider call, response mapping parity between mock/API adapters, persisted proof metadata, retained-payment proof-error results, and replacement requests that preserve the existing payment identity without a separate public mutation contract.
    - _Requirements: 8.1-8.3, 8.6, 8.9, 8.11, 9.1-9.7_
  - [ ]* 2.4 Add the optional property test for **Property 14: Payment proof is optional without changing payment identity**, covering valid submissions with and without proof and confirming unchanged payment id, invoice id, amount, and method.
    - **Property 14; Validates: Requirements 8.1, 8.2, 9.3, 9.7**

- [ ] 3. Complete backend payment-proof persistence through FastAPI/openpyxl
  - [~] 3.1 Extend `backend/app/models/schemas.py` and the existing payment route contract with optional proof metadata, one-file upload handling, backend-generated references, structured proof-specific errors, and rejection of client-supplied attachment references while preserving ordinary no-proof JSON behavior.
    - Keep new payment and replacement handling behind the existing approved payment boundary; do not add a parallel proof API, a public `PUT` route solely for replacement, a second database, or SQLite.
    - _Requirements: 1.2-1.5, 8.4, 8.10, 9.7_
  - [~] 3.2 Implement the application-managed attachment helper/service under `backend/app/services/` with a configured local attachment root fallback, generated payment-specific relative references, temporary/staged writes, readback validation, normalized path validation, traversal/absolute-path/symlink protection, safe reads, and best-effort orphan cleanup.
    - Treat filename as display metadata only; do not expose server paths or trust browser MIME/name for filesystem naming. For replacement, keep the prior managed file untouched until the new file is written, read back, and enriched successfully; record only safe diagnostic categories when cleanup fails.
    - _Requirements: 8.5, 8.8, 8.11, 9.7_
  - [~] 3.3 Extend `backend/app/excel/constants.py`, `rows.py`, and workbook initialization/load paths with backward-compatible optional proof metadata columns (`proof_fileName`, `proof_mimeType`, `proof_sizeBytes`, `proof_uploadedAt`, `proof_attachmentReference`).
    - Append missing headers without reordering/deleting existing columns or rows; blank legacy columns map to `paymentProof=None`; malformed partial metadata becomes proof-unavailable rather than being silently reconstructed.
    - The initial payment-row write must leave all proof columns blank. The internal enrichment must fill all five columns atomically on the same payment row only after attachment write/readback succeeds; replacement updates that row and never appends a proof-history row.
    - _Requirements: 1.2-1.4, 8.5-8.7, 8.10, 9.7_
  - [~] 3.4 Orchestrate payment validation, exact generated payment identity plus `invoiceId` association, durable payment-row persistence, activity behavior, proof write/readback/enrichment, replacement, response envelopes, and proof-specific failure handling in `payment_service.py` and `routes/payments.py`.
    - First validate the required invoice, positive amount, and method, allocate the payment identity, and durably persist the same payment row with blank proof metadata before any proof write, readback, or metadata handling begins.
    - After the payment row is durable, emit exactly one existing payment activity event. Proof write, readback, metadata enrichment, replacement, cleanup, and all proof-error paths must never create another payment or payment activity.
    - For a new proof or replacement, accept at most one file, generate a safe payment-scoped relative reference under the managed attachment root, write/stage the attachment, read it back and validate its content/metadata, then internally enrich the same workbook payment row atomically with the proof metadata/reference. This enrichment is an internal workbook-service operation, not a new public payment mutation API and not a second database.
    - On proof write, readback, or metadata-enrichment failure, retain the same payment id and `invoiceId`, leave newly committed proof metadata absent/unavailable (or retain the prior valid proof on a failed replacement), return one actionable proof-specific error, and perform best-effort temporary/orphan cleanup with safe diagnostics that never expose server paths.
    - For replacement, stage/write/read back and enrich the new file first while preserving the prior managed proof; only after the new metadata succeeds may the service clean the prior managed file. Keep exactly one current proof file/reference, no proof history, no new payment, no changed identity, and no activity event. Do not add a public `PUT` route solely for replacement.
    - _Requirements: 1.2-1.5, 8.2, 8.4-8.7, 8.10-8.11, 9.2-9.7_
  - [~] 3.5 Write mandatory backend integration/contract tests for POST/GET payments with and without proof, exact payment/invoice association, workbook reload persistence, legacy workbooks missing proof headers, and reference/path safety.
    - Assert payment validation, identity allocation, and the blank-proof payment-row write occur before proof handling; assert the existing payment activity is emitted exactly once after the row is durable and never from proof paths.
    - Inject proof-write failure before metadata enrichment, workbook metadata-enrichment failure after attachment creation, and attachment readback failure. Each case must retain the same payment id and `invoiceId`, leave newly committed proof metadata absent/unavailable, return one actionable proof-specific error, attempt orphan/temp cleanup, and avoid a duplicate payment or activity.
    - Verify cleanup success and cleanup failure as best effort, with safe diagnostics only and no exposed server paths. Verify successful replacement stages/writes/reads back and enriches the new file before deleting the prior managed file, preserves the same id/invoiceId, leaves exactly one current proof file/reference with no history, and emits no payment activity.
    - _Requirements: 8.1-8.7, 8.10-8.11, 9.2-9.7_
  - [ ]* 3.6 Add the optional property test for **Property 9: A successful proof round trip remains attached to the exact payment**, covering arbitrary valid payment ids, invoice ids, and one-file proof metadata/reference round trips through durable-row-first persistence.
    - **Property 9; Validates: Requirements 8.2, 8.3, 8.4, 8.6, 8.7, 9.7**
  - [ ]* 3.7 Add the optional property test for **Property 16: Proof failure retains the durable payment and emits no duplicate activity**, covering proof write, readback, and workbook metadata-enrichment failures after the payment row is persisted.
    - **Property 16; Validates: Requirements 8.11, 9.2, 9.4**
  - [ ]* 3.8 Add the optional property test for **Property 17: Successful replacement commits one current proof after enrichment**, covering prior-proof preservation until new readback/enrichment succeeds, same payment identity, one current reference, post-success prior-file cleanup, no proof history, and no activity event.
    - **Property 17; Validates: Requirements 8.2, 8.5, 9.7**

- [~] 4. Preserve lifecycle, ledger status, calculations, rollups, and numbering semantics
  - [x] 4.1 Verify or minimally correct `Invoice_Math_Module`/invoice rollup adapters so billed invoices derive Outstanding, Overdue, or Received from payment totals, computed grand total, and due date; drafts have no ledger status and are excluded from financial totals.
    - Keep the calculation module as the exclusive source for subtotal, taxable value, discount, CGST, SGST, round-off, grand total, received, outstanding, overdue, and billed values; do not add IGST fields/rules/formulas.
    - _Requirements: 3.1-3.5, 4.7-4.10, 12.1-12.4, 16.1-16.4_
  - [x] 4.2 Verify or minimally correct Bill/Save/Download/Send/Reminder actions and numbering allocation across Create Invoice, Invoices, Invoice Detail, activity, and numbering modules.
    - Bill only changes `isDraft` and `billedAt`, preserves `sentAt`; Save/Download do not bill; drafts remain editable and retain numbers; new numbers are next unused and never duplicated; Send and reminder remain confirmation/record-only with no external messaging and no billed-invoice edit workflow.
    - _Requirements: 2.1-2.11, 11.1-11.6, 12.5-12.7_
  - [~] 4.3 Update core workflow pages and related adapters to use Draft/Billed and ledger-derived Outstanding/Overdue/Received semantics, exclude drafts from financial totals, remove Mark Paid and Duplicate actions, show only appropriate draft/billed/payment/reminder/receipt actions, and preserve existing data-provider layering.
    - Cover Overview, Invoices, Invoice Detail support regions, Clients, Client Detail, Payments, and Create Invoice without broad redesign or inferred billed-edit behavior.
    - _Requirements: 2.4-2.11, 3.6-3.11, 4.1-4.10, 19.4-19.5_
  - [~] 4.4 Write mandatory unit/regression tests for the ₹25,700 taxable-value example (CGST ₹2,313, SGST ₹2,313, total ₹30,326), amount-in-words from final rounded total, draft exclusion, billed status transitions, rollups, Bill/Save/Download/Reminder semantics, and stable numbering sequences.
    - Change verified math/amount-in-words/numbering implementation only if a failing test identifies a root defect; preserve public signatures when tests pass.
    - _Requirements: 2.1-2.10, 3.1-3.11, 4.7-4.10, 11.1-11.6, 12.1-12.7_
  - [ ]* 4.5 Add the optional property test for **Property 1: Ledger status is payment- and due-date-derived**.
    - **Property 1; Validates: Requirements 3.1-3.4**
  - [ ]* 4.6 Add the optional property test for **Property 2: Drafts are excluded from ledger status and financial rollups**.
    - **Property 2; Validates: Requirements 3.5, 4.7, 4.10**
  - [ ]* 4.7 Add the optional property test for **Property 3: Billing changes only the intended lifecycle fields**.
    - **Property 3; Validates: Requirements 2.1-2.3**
  - [ ]* 4.8 Add the optional property test for **Property 4: Invoice number allocation is stable and unique**.
    - **Property 4; Validates: Requirements 11.1-11.5**

- [ ] 4. Checkpoint - Ensure the payment contract/persistence and lifecycle/math tests pass before proceeding to document and UI integration; ask the user if questions arise.

- [ ] 5. Extract and adopt one canonical invoice document model and renderer
  - [~] 5.1 Extract a shared, testable `InvoiceDocumentModel` adapter from `InvoicePreview` for business identity, canonical logo, invoice/customer/order-delivery fields, supported CGST/SGST/discount/round-off values, bank/declaration/signatory sections, normalized Unicode labels, and final amount-in-words.
    - Map `supplierCode`, `poNumber`, `poDate`, and `transporter` to matching labels; omit the entire order/delivery block when all four are empty; explicitly omit IGST from the model and preserve CGST/SGST behavior.
    - _Requirements: 5.2, 5.8-5.9, 6.5-6.7, 13.5-13.6, 16.1-16.4, 18.1-18.3_
  - [~] 5.2 Extract the existing invoice markup into one `Invoice_Document_Renderer`; make `InvoicePreview` a thin consumer and ensure the renderer owns document structure/labels without a second monetary calculation path.
    - Keep the established visual language and existing export integration boundary; do not create a parallel renderer.
    - _Requirements: 5.1-5.9, 6.1-6.7, 16.4-16.5_
  - [~] 5.3 Replace the primary `InvoicePage`/canonical Invoice Detail content with the full professional document renderer, keeping ledger status and payment history outside the document, draft continuation to Create Invoice, billed print/PDF/download/back actions, loading/error/not-found states, and existing provider patterns.
    - Resolve by stable invoice id only; a missing/stale id must show not-found plus Back, never silently open another invoice or a filtered list.
    - _Requirements: 5.1-5.8, 10.1-10.5_
  - [~] 5.4 Update `invoiceExportService` and existing print/PDF integration to consume the same `InvoiceDocumentModel` and math values as preview/detail while retaining the existing export entry point and output integration.
    - Preview, detail, print/PDF, and download/export must present identical supported monetary values, amount-in-words, order/delivery mapping, and canonical business identity.
    - _Requirements: 5.2-5.9, 6.1-6.6, 12.4, 13.5-13.6_
  - [ ]* 5.5 Add the optional property test for **Property 5: Amount-in-words reflects the final rounded total** across all renderer consumers.
    - **Property 5; Validates: Requirements 6.5, 12.4**
  - [ ]* 5.6 Add the optional property test for **Property 6: Shared invoice outputs agree on document values** across create preview, detail, print/PDF, and existing export integration.
    - **Property 6; Validates: Requirements 5.2, 5.8, 6.1-6.6, 13.5**
  - [ ]* 5.7 Add the optional property test for **Property 7: Empty order/delivery data does not create a document block** and non-empty values remain under their matching labels.
    - **Property 7; Validates: Requirements 13.5-13.6**
  - [ ]* 5.8 Add the optional property test for **Property 15: Renderer identity is structural, not duplicated**, using the shared model/renderer path for every in-scope consumer.
    - **Property 15; Validates: Requirements 5.6-5.7, 6.1, 6.2, 6.4**

- [ ] 6. Complete the payment UI and real receipt document
  - [~] 6.1 Update `PaymentsPage` and its payment form to validate invoice/positive amount/method with field-level errors, submit through the provider with optional one-file proof, request a one-file replacement through the same approved payment boundary, refresh from the provider after success, show persisted proof state, preserve payment and prior proof on proof failure, and omit proof-removal controls.
    - Do not hard-code demo payments, use transient upload state as persisted truth, store proof in `localStorage`, create proof history, add a public `PUT` route solely for replacement, or expose backend storage paths. A failed new proof leaves proof metadata absent/unavailable; a failed replacement leaves the prior valid proof associated.
    - _Requirements: 8.1-8.3, 8.6-8.11, 9.1-9.7_
  - [~] 6.2 Create `PaymentReceiptView` as a real printable/viewable receipt document with receipt/payment reference, invoice number, customer, payment date, amount, method, optional transaction reference, business details, proof-unavailable state, and an exact canonical invoice link.
    - Provide access from Invoice Detail payment history and Payments selection, plus loading/not-found/missing-related-record states without guessing an invoice.
    - _Requirements: 7.1-7.6, 8.11_
  - [~] 6.3 Write mandatory payment UI/integration tests for no-proof and proof-bearing submission, persisted proof display after reload, retained-payment proof-write/readback/enrichment failures with same id/invoiceId and actionable proof errors, exactly-one activity behavior, successful one-file replacement preserving the prior proof until enrichment succeeds, receipt access from both approved surfaces, receipt field projection, and missing payment/invoice states.
    - _Requirements: 7.1-7.6, 8.1-8.11, 9.1-9.7_
  - [ ]* 6.4 Add the optional property test for **Property 11: Receipt fields are projections of associated records**.
    - **Property 11; Validates: Requirements 7.2-7.3, 7.6**

- [ ] 7. Make every invoice number an exact canonical detail link
  - [~] 7.1 Implement or normalize shared `InvoiceNumberLink` and stable-id navigation in `useWorkspaceStore`/`App.tsx`, including row-click propagation handling, selected invoice state, receipt return state, loading/error/not-found behavior, and no filtered-list fallback.
    - _Requirements: 10.1-10.5_
  - [~] 7.2 Replace invoice-number render targets with `InvoiceNumberLink` in Invoices, Payments, Clients, Client Detail, Overview, Invoice Detail supporting content, and Payment Receipt wherever an invoice number is shown.
    - Each activation must carry the exact stable invoice `id`, not a display number, row index, filtered-list query, or alternate summary page.
    - _Requirements: 7.6, 10.1, 10.5_
  - [~] 7.3 Update Reports, Intelligence, and CommandPalette invoice result actions to open the exact Invoice Detail page by stable id; add only minimal existing-row id passthrough where required.
    - Keep Reports/Intelligence metrics, filters, classifications, data sources, fuzzy search, quick actions, exports, and unrelated legacy labels unchanged.
    - _Requirements: 10.2-10.6, 15.5-15.6_
  - [~] 7.4 Write mandatory exact-navigation tests for every approved invoice-number surface, including Reports tables, Intelligence `openInvoice`, CommandPalette results, Payment Receipt, stale/missing ids, and not-found states.
    - Assert no activation opens a filtered invoice list, different invoice, or summary dashboard.
    - _Requirements: 5.3, 7.4-7.6, 10.1-10.6_
  - [ ]* 7.5 Add the optional property test for **Property 10: Canonical invoice links target the exact detail record** across all invoice-number surfaces.
    - **Property 10; Validates: Requirements 7.6, 10.1, 10.5**

- [~] 8. Checkpoint - Ensure shared renderer, payment receipt, exact-navigation, and focused UI tests pass before layout, terminology, and Settings cleanup; ask the user if questions arise.

- [ ] 9. Correct Create Invoice layout, numeric input, field mapping, and AURA positioning
  - [~] 9.1 Update `CreateInvoicePage` to retain the left-form/right-preview layout with one outer page scroll owner, no inaccessible nested scrolling, reachable tax/totals/round-off/document controls, correct order/delivery mapping through the shared renderer, and no sticky-footer occlusion.
    - _Requirements: 13.1-13.6_
  - [~] 9.2 Refactor `LineItemEditor` numeric entry to use controlled text buffers that preserve empty values, decimal text including trailing `.`, clear-then-type behavior, and no extraneous leading/stale digits while passing finite numeric values to domain calculations.
    - _Requirements: 13.7-13.9_
  - [~] 9.3 Apply footer-aware/protected-content offsets to `AuraPanel` on Create Invoice and Invoice Detail while preserving ordinary fixed bottom-right behavior and all response/classification/intelligence behavior.
    - _Requirements: 14.1-14.4_
  - [ ]* 9.4 Add the optional property test for **Property 8: Numeric input preserves the active text buffer** across quantity and unit-price typing/clearing/decimal sequences.
    - **Property 8; Validates: Requirements 13.7-13.9**

- [ ] 10. Apply only the approved Reports/Intelligence corrections
  - [~] 10.1 Correct only explicitly targeted `Pending` → `Outstanding`, `Collected` → `Received`, and current/prior period comparison labels/delta direction in Reports and Intelligence; preserve existing metrics, filters, classifications, data sources, exports, and untargeted legacy labels.
    - Do not redesign either page or broaden terminology migration beyond identified targets.
    - _Requirements: 4.1-4.6, 10.6, 15.1-15.6_
  - [~] 10.2 Write mandatory focused UI tests for targeted status labels, current/prior comparison direction, preserved untargeted labels, and unchanged Reports/Intelligence data-source/filter behavior.
    - _Requirements: 15.1-15.6_
  - [ ]* 10.3 Add the optional property test for **Property 12: Current/prior comparison deltas are directionally correct**.
    - **Property 12; Validates: Requirements 15.3-15.4**

- [ ] 11. Reconcile Settings/logo scope, encoding, IGST deferral, and build configuration
  - [~] 11.1 Update `WorkspaceSettingsPage` to remove unnecessary/fake Regional Formatting controls while retaining useful real workspace settings, and consolidate Settings and invoice rendering on one canonical business-profile logo value/preview.
    - This latest user instruction supersedes the stale Requirement 17/design wording that says to retain Regional Formatting; do not implement fake controls, do not perform a branding redesign, and do not create a second logo source.
    - _Requirements: 1.1, 5.2, 16.1-16.5, 17.2-17.5 as reconciled by latest instruction_
  - [~] 11.2 Scan and correct mojibake in `CreateInvoicePage`, `InvoicePreview`, the shared renderer/model, `PaymentReceiptView`, `WorkspaceSettingsPage`, and other directly affected production labels; verify intended rupee, middle-dot, em-dash, ellipsis, minus, arrow, check, and apostrophe characters.
    - _Requirements: 6.7, 18.1-18.3_
  - [x] 11.3 Resolve Node path/`__dirname` typing and `tsconfig.node.json` emit conflicts through correct TypeScript/Vite project configuration; do not use `@ts-ignore`, `@ts-nocheck`, or unnecessary `any`.
    - _Requirements: 19.1-19.3_
  - [~] 11.4 Add mandatory static/scope checks for no SQLite/second DB/localStorage proof storage, no direct presentation-layer storage access, no phase1 appStore mutations, no duplicate renderer/export path, no unapproved Reports/Intelligence redesign, no external messaging, no billed-edit workflow, and no IGST frontend/backend/calculation/export/persistence additions.
    - _Requirements: 1.1-1.5, 2.8-2.11, 6.4-6.6, 8.8-8.10, 14.4, 15.5-15.6, 16.1-16.5, 19.4-19.5_
  - [ ]* 11.5 Add the optional property test for **Property 13: Canonical business-logo value is consistent** between Settings and `Invoice_Document_Renderer` with no stale/placeholder alternate source.
    - **Property 13; Validates: Requirements 17.2-17.3 as reconciled by latest instruction**

- [~] 12. Checkpoint - Ensure all targeted corrections and scope checks pass before the final integrated verification; ask the user if questions arise.

- [ ] 13. Integrate and perform final verification
  - [~] 13.1 Run the complete automated integration/regression suite across frontend providers/hooks/pages, backend FastAPI routes/services/workbook reload, payment proof persistence, receipt, exact navigation, shared renderer/export, lifecycle/status/rollups, numbering, amount-in-words, layout/input, targeted Reports/Intelligence, Settings/logo, encoding, and layering.
    - Include legacy workbook migration, payment-proof write-before-metadata ordering, write/readback/enrichment failure retention with same id/invoiceId, exactly-one activity assertions, orphan/temp cleanup diagnostics, successful replacement with post-enrichment prior-file cleanup, stale/not-found navigation, draft/billed flows, and all required persistence and exact-navigation checks.
    - _Requirements: 1.1-19.5_
  - [~] 13.2 Run clean and repeated `tsc -b`, ESLint, frontend/Vite build, backend test suite, unit/property tests (each property test at least 100 iterations where implemented), and integration tests; fix all errors without suppressions and confirm no stray emitted config files.
    - _Requirements: 12.5-12.7, 19.1-19.5_
  - [~] 13.3 Execute the final manual flow verification matrix on the implemented application: create/save/download/edit a draft, create another invoice without renumbering/finalizing the draft, bill/send/remind without external messaging, record payments with and without proof, reopen and inspect proof/receipt, follow invoice links from every approved surface, inspect exact not-found states, verify shared preview/detail/print/export values, inspect Create Invoice scroll/input/AURA behavior, check targeted Reports/Intelligence labels/comparisons, confirm Settings/logo cleanup, and scan production UI for mojibake.
    - _Requirements: 2.1-2.11, 5.1-7.6, 8.1-10.6, 11.1-18.3_

## Notes

- Tasks marked with `*` are optional property-test tasks. Required provider, backend persistence, receipt, exact-navigation, lifecycle/math, UI, integration, build, and manual verification tasks are not optional.
- The design contains a Correctness Properties section; optional property tests are listed individually for Properties 1-17 and must use the required tag `Feature: sft-billing-final-stabilization, Property N: <property text>` with at least 100 iterations when implemented.
- Payment proof is optional, singular, provider-backed, and durable-payment-first: validate the payment, allocate its identity, persist the payment row with blank proof metadata, and emit exactly one activity event after the row is durable before any proof handling. Then write/read back one generated payment-scoped attachment and atomically enrich the same workbook row. Proof failures retain the same payment id/invoiceId, leave newly committed proof metadata absent/unavailable, return an actionable proof-specific error, perform best-effort orphan/temp cleanup, and never duplicate activity or payment records.
- Replacement uses the same internal attachment/write-readback/enrichment orchestration, preserves the prior managed file until new metadata succeeds, then cleans the prior file. It keeps exactly one current proof file/reference with no proof history, no new payment, and no activity event; no public `PUT` route is added solely for replacement and no proof-removal action is introduced.
- Invoice numbers always navigate by exact stable invoice id to the canonical full Invoice Detail page, with explicit not-found behavior. Required persistence and exact-navigation tests cannot be skipped.
- Send invoice/reminder remain confirmation/record-only and do not select or integrate an external messaging channel. Billed-invoice editing remains undecided and must not be invented.
- IGST is explicitly deferred: do not add a partial field, rate, rule, calculation, export, renderer, or persistence representation.
- Reports/Intelligence changes are limited to exact invoice navigation and targeted terminology/comparison corrections; Settings/logo changes are cleanup only, not branding redesign.
- The explicit corrected Settings scope removes unnecessary/fake Regional Formatting controls while preserving useful real settings and one canonical business-profile logo source.
- All tasks are intended for one coordinated implementation pass in dependency order; no source-code implementation is performed during this planning phase.
- The corrected payment-proof sequencing, failure retention, one-activity boundary, orphan cleanup, and successful replacement flow introduce no other contradiction. This plan is ready for implementation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "11.3"] },
    { "id": 2, "tasks": ["2.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "4.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["2.4", "4.3", "5.1", "9.2"] },
    { "id": 6, "tasks": ["3.1", "3.2", "3.3", "5.2", "7.1", "9.1", "9.3", "11.1"] },
    { "id": 7, "tasks": ["3.4", "5.3", "5.4", "7.3", "11.2"] },
    { "id": 8, "tasks": ["3.5", "4.4", "10.1"] },
    { "id": 9, "tasks": ["3.6", "3.7", "3.8", "4.5", "4.6", "4.7", "4.8", "5.5", "5.6", "5.7", "5.8", "9.4", "10.2"] },
    { "id": 10, "tasks": ["6.1", "6.2", "10.3"] },
    { "id": 11, "tasks": ["6.3", "6.4", "7.2", "11.4", "11.5"] },
    { "id": 12, "tasks": ["7.4", "7.5"] },
    { "id": 13, "tasks": ["13.1"] },
    { "id": 14, "tasks": ["13.2", "13.3"] }
  ]
}
```
