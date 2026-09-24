# Implementation Plan: Core Business System

## Overview

This plan implements the changes in `design.md`: separating Bill from Send, replacing manual "Mark Paid" with ledger-derived status, removing "Duplicate", adding an Invoice Detail page and Payment Receipt view, adding client rollups, and renaming "Pending"/"Paid" to "Outstanding"/"Received" on the seven named core-workflow surfaces only. All code lives under `sft-billing-phase2.2-gst/sft-billing/src`, in TypeScript/React, tested with Vitest + `fast-check` (already available as devDependencies). Work proceeds bottom-up: types → calculation layer (with its property tests) → navigation state → shared components → page-level wiring → cross-page terminology/link sweep → final verification.

## Amendment Log (Correction Pass)

This task plan was amended to match the correction pass already recorded in `requirements.md`'s and `design.md`'s own "Amendment Log (Correction Pass)" sections, triggered by direct inspection of the running application. Most of the original plan below (types, `invoiceMath.ts` rollups/ledger status, `useWorkspaceStore` additions, `SendInvoiceModal`/`SendReminderModal`, `InvoicesPage`/`InvoiceRow`/`BulkActionBar` cleanup, `ClientsPage`/`ClientDetailPage`/`PaymentsPage` wiring, terminology renames, and the original final-verification task) remains valid and unchanged. The following changes were made:

- **Superseded — Task 11**: the original "Create `pages/InvoicePage.tsx` (Invoice Detail page)" task built a financial-summary dashboard. Per corrected Requirement 5 and design.md's redesign, it is superseded by **Task 27** (extract `InvoiceDocument`) and **Task 28** (redesign `InvoicePage.tsx` around `InvoiceDocument`). Task 11 and its subtask 11.1 are kept below, struck through and marked `[SUPERSEDED]`, rather than deleted, so the history of the change is visible.
- **Added — Task 27**: extract `components/create-invoice/InvoiceDocument.tsx` from `InvoicePreview.tsx` (Requirement 12), with a property test for Property 17.
- **Added — Task 28**: redesign `pages/InvoicePage.tsx` to render the full invoice document as primary content, with ledger status/payment history demoted to secondary content (Requirements 5.1-5.9, 12.1-12.4), replacing Task 11's design and carrying forward its Property 10 test.
- **Added — Task 29**: fix the Create Invoice preview layout so the preview column scrolls independently and is never clipped by the sticky footer (Requirement 13), with a unit test for independent scroll behavior.
- **Added — Task 30**: extend AURA positioning to include `"invoice-detail"` in `PAGES_WITH_STICKY_FOOTER` (Requirement 14), positioning-only, with a property test for Property 18.
- **Added — Task 31**: fix confirmed mojibake byte sequences in `pages/CreateInvoicePage.tsx` and `InvoicePreview.tsx`/`InvoiceDocument.tsx` (Requirement 15), plus a grep-based verification sweep of the rest of `src/` and fixes for any additional occurrences found.
- **Amended — Task 13**: `Payment_Receipt_View` changed in place from a `Modal`-wrapped key-value list to a proper printable/viewable receipt document (business identity block, receipt reference, customer, payment fields) per amended Requirement 6. Its property test (Property 13) still applies unchanged; only the rendered content/layout it validates has changed.
- **Added — Task 33**: verification-only task proving invoice numbering stability (Requirement 17) with a test, rather than skipping verification just because `design.md` found `lib/invoiceNumber.ts` already correct by inspection.
- **Added — Task 34**: property test for Property 19 (amount-in-words always matches the final rounded total), enumerating the scenario axes from Requirement 19.2 crossed with randomized amounts, rather than skipping a test just because `design.md` found the pipeline already correct by inspection.
- **Deliberately NOT added — billed-invoice editing**: `design.md` documents this as an explicit non-decision (Open Question 2 in `requirements.md`). No task exists for it in this plan.
- **Added — Tasks 36-39 (Requirement 16 now resolved and approved)**: Requirement 16 (universal invoice-number linking) moved from an open question to an approved, resolved requirement covering `Reports_Page`, `Intelligence_Page`, and `CommandPalette`, per `design.md`'s "Reports_Page / Intelligence_Page / CommandPalette invoice-number linking — approved design (Requirement 16)" section. **Task 36**: add the `invoiceId` passthrough field to `PaymentReportRow` in `lib/reports.ts`. **Task 37**: replace all five invoice-number `<td>` cells in `pages/ReportsPage.tsx` with `InvoiceNumberLink` (depends on Task 36). **Task 38**: fix `pages/IntelligencePage.tsx`'s `openInvoice` to navigate to the canonical Invoice_Detail_Page. **Task 39**: fix `components/command-palette/CommandPalette.tsx`'s "Invoices" result group to navigate to the canonical Invoice_Detail_Page, with subtasks 39.1 (property test extending Property 12's scope) and 39.2 (unit test confirming no other Reports/Intelligence/CommandPalette logic changed). Task 35 (final verification) is understood to also cover this new work, and its text has been updated accordingly; it remains the last task in the plan and in the Task Dependency Graph.
- **Renumbered — final checkpoint**: the original Task 27 ("Final checkpoint — Full verification pass") is renumbered to **Task 35** to make room for the new tasks above, and its scope is extended to run Properties 1-19 (not just 1-16) and the new unit tests (independent-scroll check, mojibake grep-and-fix verification, receipt document content check).

## Tasks

- [ ] 1. Add `billedAt` and ledger-status types to `types/invoice.ts`
  - Add optional `billedAt?: string` field to the `Invoice` interface, alongside existing `sentAt`/`paidAt`/`viewedAt`
  - Add new `InvoiceLedgerStatus` union type (`"outstanding" | "overdue" | "received"`) and `InvoiceLedgerStatusInfo` interface (`status`, `daysOverdue`, `severity`)
  - Do not modify `InvoiceStatus` or `InvoiceStatusInfo`
  - _Requirements: 1.3_

- [ ] 2. Implement ledger status and rollup helpers in `lib/invoiceMath.ts`
  - [ ] 2.1 Implement `getInvoiceLedgerStatus(invoice, payments, asOf?)`
    - Sum payments matching `invoice.id`, compare to `computeInvoiceTotals(invoice).total`
    - Return `received` when paid >= total; otherwise `outstanding` when `asOf` is on/before due date, else `overdue` with computed `daysOverdue` and `severity` (`"strong"` at >= 30 days, else `"mild"`)
    - Do not read `paidAt`; leave `getInvoiceStatus`, `computeInvoiceTotals`, `getInvoiceTotalsWithWords`, `suggestRoundOff` untouched
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.2 Write property test for ledger status purity (Property 7)
    - **Property 7: Ledger status is a pure function of payment sum, total, and due date**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 2.3 Write property test for legacy paidAt independence (Property 8)
    - **Property 8: Ledger status is independent of the legacy paidAt flag**
    - **Validates: Requirements 3.5**

  - [ ] 2.4 Implement `getClientRollup(clientId, invoices, payments, asOf?)`
    - Filter to non-draft invoices for the client, sum `computeInvoiceTotals(invoice).total` into `totalBilled`, partition into `totalReceived`/`totalOutstanding`/`totalOverdue` via `getInvoiceLedgerStatus`
    - _Requirements: 7.2, 8.1, 8.2, 9.1, 9.3_

  - [ ] 2.5 Implement `getGlobalRollup(invoices, payments, asOf?)`
    - Same computation as `getClientRollup` but across all non-draft invoices, unscoped by client
    - _Requirements: 9.1, 9.3_

  - [ ]* 2.6 Write property test for rollup partitioning (Property 14)
    - **Property 14: Client and global rollups equal the sum of non-draft invoices, partitioned by ledger status**
    - **Validates: Requirements 7.2, 8.1, 8.2, 9.1**

  - [ ]* 2.7 Write property test for draft exclusion and post-billing inclusion (Property 15)
    - **Property 15: Draft invoices never affect any rollup, ledger total, or overview metric — until they are billed**
    - **Validates: Requirements 7.3, 8.3, 9.3, 11.1, 11.2, 11.3, 11.4**

- [ ] 3. Checkpoint — Ensure all `invoiceMath.ts` tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add invoice-detail and payment-receipt navigation state to `hooks/useWorkspaceStore.ts`
  - Add `selectedInvoiceId: string | null` and `navigateToInvoiceDetail(invoiceId)` (sets `currentPage` to `"invoice-detail"` and `selectedInvoiceId`), mirroring the existing `selectedClientId`/`navigateToClientDetail` pattern
  - Add `selectedPaymentId: string | null`, `navigateToPaymentReceipt(paymentId)`, and `closePaymentReceipt()`
  - Add `"invoice-detail"` to the `AppPage` union
  - _Requirements: 5.1, 5.8, 6.2, 6.3_

- [ ] 5. Build shared linking and status components
  - [ ] 5.1 Create `components/shared/InvoiceNumberLink.tsx`
    - Renders the invoice number as a button that calls `navigateToInvoiceDetail(invoice.id)` on click with `stopPropagation`, styled as a link
    - _Requirements: 5.1, 5.8, 7.4, 8.4_

  - [ ]* 5.2 Write property test for invoice-number link resolution (Property 12)
    - **Property 12: Invoice numbers are links everywhere required, and always resolve to the right invoice**
    - **Validates: Requirements 5.1, 5.8, 7.4, 8.4**

  - [ ] 5.3 Create `components/shared/LedgerStatusChip.tsx`
    - Renders `InvoiceLedgerStatusInfo` with labels "Outstanding"/"Overdue"/"Received", matching `StatusChip`'s accessibility rule (label + icon, never color alone) and overdue severity gradient
    - Do not modify `StatusChip.tsx`'s `CONFIG`
    - _Requirements: 10.1, 10.2_

  - [ ]* 5.4 Write property test for ledger label correctness and legacy label stability (Property 16)
    - **Property 16: Core-workflow ledger labels are exactly "Outstanding"/"Received"; legacy labels are unchanged**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 6. Replace the Send-invoice flow with the Bill-invoice flow in `pages/CreateInvoicePage.tsx`
  - Replace the "Send invoice" button with a "Bill invoice" button; replace the confirmation modal's title/body with billing-only wording that does not imply an email will be sent
  - Implement `handleConfirmBill`: save the invoice with `isDraft: false`, `billedAt: now`, without setting `sentAt`; keep the existing `invoice_created` activity event for new invoices; navigate to the Invoices_Page after saving
  - Remove the now-unused `Send` icon import and any invoice-sent activity event creation from this file; update the `Ctrl/Cmd+Enter` shortcut to trigger the bill-confirmation modal
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 6.1 Write property test for billing semantics (Property 1)
    - **Property 1: Billing sets billedAt and clears draft status without touching sentAt**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 6.2 Write property test for confirm-bill persistence and navigation (Property 2)
    - **Property 2: Confirming Bill invoice persists and navigates**
    - **Validates: Requirements 1.6**

  - [ ]* 6.3 Write unit test for Bill/Send modal wording
    - Assert the billing confirmation modal's title/body contains no email-sending language
    - _Requirements: 1.4, 1.5_

- [ ] 7. Create `components/invoices/SendInvoiceModal.tsx`
  - Extract the send/resend confirmation modal (title toggles "Send this invoice?"/"Resend this invoice?" based on `invoice.sentAt`), following `Confirm_Modal_Pattern`
  - On confirm: save the invoice with `sentAt: now` without altering `billedAt`, and add an `invoice_sent` activity event
  - _Requirements: 1.7, 1.8, 1.9, 4.4_

  - [ ]* 7.1 Write property test for send semantics and resend labeling (Property 4)
    - **Property 4: Sending sets sentAt without touching billedAt, and label follows sentAt**
    - **Validates: Requirements 1.8, 1.9**

  - [ ]* 7.2 Write property test for Send-invoice affordance scoping (Property 3)
    - **Property 3: Send Invoice availability is exactly "billed invoice, on the Detail page"**
    - **Validates: Requirements 1.7**

- [ ] 8. Create `components/invoices/SendReminderModal.tsx`
  - Implement review/edit/confirm/cancel modal following `Confirm_Modal_Pattern`, pre-filled with a default reminder message referencing the invoice number and due date
  - On confirm: append exactly one `invoice_reminder_sent` activity event referencing the invoice id, with no real email delivery
  - On cancel: close without appending any activity event
  - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 8.1 Write property test for reminder confirm/cancel activity-log effects (Property 9)
    - **Property 9: Confirming a reminder records exactly one event; cancelling records none**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 8.2 Write unit test for reminder modal wording
    - Assert the modal exposes review/edit/confirm/cancel controls and the "no email is sent" disclosure text
    - _Requirements: 4.1_

- [ ] 9. Create `components/invoices/InvoiceDetailActions.tsx`
  - For a `Draft_Invoice`, render only a "Continue editing" action that calls `onContinueEditing`
  - For a `Billed_Invoice`, render "Send invoice"/"Resend invoice" (label from `invoice.sentAt`) always; "Send reminder" when ledger status is `outstanding` or `overdue`; "Record payment" when ledger status is not `received`; wire each to `SendInvoiceModal`, `SendReminderModal`, and the existing `components/payments/RecordPaymentModal.tsx` scoped to this invoice
  - _Requirements: 5.6, 5.7_

  - [ ]* 9.1 Write property test for status-gated action visibility (Property 5)
    - **Property 5: Row and Detail actions are fully determined by draft/billed state and ledger status**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 5.6, 5.7**

- [ ] 10. Create `components/invoices/PaymentHistoryList.tsx`
  - Render a list of payments (date, amount, method), or an `EmptyState` when empty; each row invokes `onOpenReceipt(payment.id)` when activated
  - Move `METHOD_LABELS` out of `pages/PaymentsPage.tsx` into a shared export (e.g. `lib/formatters.ts` or a new `lib/paymentLabels.ts`) so both `PaymentsPage` and this component use the same map
  - _Requirements: 5.4, 5.5_

  - [ ]* 10.1 Write property test for payment-history completeness and receipt linking (Property 11)
    - **Property 11: Detail page payment history is exactly that invoice's payments, each linking to its own receipt**
    - **Validates: Requirements 5.4, 5.5**

- [ ] 11. [SUPERSEDED - DO NOT IMPLEMENT] Create `pages/InvoicePage.tsx` (Invoice Detail page)
  - Original scope (no longer valid): load the invoice via `selectedInvoiceId`, its payments filtered by `invoiceId`, and the associated client; render an `EmptyState` "invoice not found" fallback with a "Back to invoices" action when the invoice can't be resolved
  - Original scope (no longer valid): render totals via `getInvoiceTotalsWithWords(invoice)`; render `StatusChip` for drafts or `LedgerStatusChip` with `getInvoiceLedgerStatus(invoice, invoicePayments)` for billed invoices
  - Original scope (no longer valid): wire `InvoiceDetailActions` (continue-editing navigates to `Create_Invoice_Page` prefilled) and `PaymentHistoryList` (`onOpenReceipt` calls `navigateToPaymentReceipt`)
  - Reason superseded per corrected Requirement 5 (see Amendment Log): this task originally built a financial-summary-dashboard `InvoicePage.tsx` (status chip, total-due card, subtotal/tax/discount/round-off grid as primary content), which is wrong. The page must render the full invoice document via `InvoiceDocument`, with status/payment history as secondary content. This task becomes Task 28 below (which depends on Task 27's `InvoiceDocument` extraction). Do not implement this task as originally written.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.2 (superseded by Task 28)_

  - [ ]* 11.1 [CARRIED FORWARD to Task 28.1 - DO NOT IMPLEMENT HERE] Write property test for Detail-page totals and status fidelity (Property 10)
    - **Property 10: Detail page totals and ledger status always match the calculation layer**
    - **Validates: Requirements 5.2, 5.3, 9.2**

- [ ] 12. Wire `InvoicePage` into `App.tsx`
  - Add a `case "invoice-detail"` returning `<AppShell><InvoicePage /></AppShell>`
  - _Requirements: 5.1_

- [ ] 13. Create `components/payments/PaymentReceiptView.tsx` and mount it globally **[AMENDED per amended Requirement 6 — see Amendment Log]**
  - Render a real printable/viewable receipt document, not a generic key-value summary card: a business identity block (logo, name, address) at the top, a "Payment Receipt" heading with a receipt/payment reference, then the invoice link, customer name, payment date, amount received, method, and reference; return `null` when the payment can't be resolved
  - Resolve the associated invoice via `payment.invoiceId` and render an `InvoiceNumberLink` to it; resolve the business profile via the existing `useBusinessProfile()` hook (same hook `CreateInvoicePage.tsx` uses for `InvoiceDocument`)
  - Move `METHOD_LABELS` to a shared export (e.g. `lib/formatters.ts` or `lib/paymentLabels.ts`) if not already done in task 10, so this component and `PaymentsPage` use the same map
  - Mount once near the root of `AppShell`/`App.tsx`, gated on `selectedPaymentId` from the store, closed via `closePaymentReceipt`
  - _Requirements: 6.1, 6.2, 6.4_

  - [ ]* 13.2 Write unit test for receipt document content
    - Assert the rendered receipt includes a business identity block and a receipt/payment reference, and is not merely a key-value list lacking business details
    - _Requirements: 6.1, 6.2_

  - [ ]* 13.1 Write property test for receipt field and link fidelity (Property 13)
    - **Property 13: Payment receipt fields and invoice link always match the underlying payment**
    - **Validates: Requirements 6.1, 6.4**

- [ ] 14. Checkpoint — Ensure all detail-page and receipt tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Update `pages/InvoicesPage.tsx` row-action wiring
  - Remove `markPaid`, `duplicate`, `bulkMarkPaid` and their UI wiring (props, buttons, now-unused `Duplicate`/`CheckCircle2`-for-markPaid imports); keep `editDraft` and the existing bulk "Send reminders" loop unchanged
  - Add `reminderTarget`, `sendTarget`, and record-payment target state; render `SendReminderModal`, `SendInvoiceModal`, and `RecordPaymentModal` once outside the row loop, wired to row callbacks
  - Pass `payments` down to `InvoiceRow` (via existing or newly added `usePayments()`)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.6, 3.7_

  - [ ]* 15.1 Write property test that removed actions never render (Property 6)
    - **Property 6: Removed actions never appear**
    - **Validates: Requirements 2.6, 2.7, 2.8, 3.7**

- [ ] 16. Update `components/invoices/InvoiceRow.tsx`
  - Replace `onMarkPaid`/`onDuplicate` props with `onSendInvoice`/`onRecordPayment`; remove `onDuplicate` entirely; keep `onSendReminder`/`onEdit`
  - Render the invoice number via `InvoiceNumberLink`; render `StatusChip` (via `getInvoiceStatus`) for draft rows and `LedgerStatusChip` (via `getInvoiceLedgerStatus` against a new `payments` prop) for billed rows
  - Render draft-row actions as {Edit, Bill invoice} (Bill invoice opens `Create_Invoice_Page` prefilled, same as `editDraft`) and billed-row actions as {View, conditional Send invoice, conditional Send reminder, conditional Record payment} per the ledger-status gating rules
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.7_

- [ ] 17. Update `components/invoices/BulkActionBar.tsx`
  - Remove the "Mark paid" button and `onMarkPaid` prop; keep "Send reminders" and "Clear"
  - _Requirements: 2.6, 3.7_

- [ ] 18. Update `components/invoices/MiniTimeline.tsx`
  - Add a "Billed" step (`done: Boolean(invoice.billedAt)`, `date: invoice.billedAt`) positioned before the existing "Sent" step; leave the final legacy-status step untouched
  - _Requirements: 1.3_

- [ ] 19. Checkpoint — Ensure all Invoices_Page-related tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Update `pages/ClientsPage.tsx`
  - Replace the "Since" column with a "Total Billed" column computed via `getClientRollup(clientId, invoices, payments).totalBilled`, sourcing `payments` from `usePayments()`
  - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 20.1 Write unit test for the Clients_Page column swap
    - Assert the "Since" column is gone and a "Total Billed" column renders the rollup-derived value
    - _Requirements: 7.1_

- [ ] 21. Update `pages/ClientDetailPage.tsx`
  - Add a rollup summary block (total billed, received, outstanding, overdue) above the contact-info grid, computed via `getClientRollup(selectedClientId, invoices, payments)`
  - Replace each invoice row's plain invoice-number `<span>` with `InvoiceNumberLink`; switch non-draft rows from `StatusChip`/`getInvoiceStatus` to `LedgerStatusChip`/`getInvoiceLedgerStatus` (draft rows keep `StatusChip`)
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 22. Update `pages/PaymentsPage.tsx`
  - Replace the plain invoice-number span with `InvoiceNumberLink`; make each payment row clickable (role="button", keyboard-activatable) to call `navigateToPaymentReceipt(payment.id)`, relying on `InvoiceNumberLink`'s `stopPropagation` so the number and the row navigate to different destinations
  - Move local `METHOD_LABELS` usage onto the shared export created in task 10, if not already done there
  - _Requirements: 6.2, 6.3, 6.4_

  - [ ]* 22.1 Write unit test for Payment_Receipt_View reachability from Payments_Page
    - Assert clicking a payment row (outside the invoice-number link) opens the receipt for that payment's id
    - _Requirements: 6.3_

- [ ] 23. Update `components/overview/FocusedInvoiceList.tsx`
  - Replace the plain invoice-number rendering with `InvoiceNumberLink`
  - For non-draft invoices, render the status chip via `LedgerStatusChip`/`getInvoiceLedgerStatus` instead of `StatusChip`; keep the existing `overviewFocus`/legacy-`InvoiceStatus`-based filtering logic unchanged
  - _Requirements: 5.8, 10.1_

- [ ] 24. Checkpoint — Ensure all Clients/Client-Detail/Payments/Overview tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Apply label-only terminology renames
  - [ ] 25.1 Update `components/overview/StatStrip.tsx`
    - Relabel the `ORDER` array's "Pending"/"Paid" entries to "Outstanding"/"Received"; leave the underlying `status` keys (legacy `InvoiceStatus` values) unchanged
    - _Requirements: 10.1, 10.2_

  - [ ] 25.2 Update `components/invoices/InvoiceFilterBar.tsx`
    - Relabel `STATUS_OPTIONS`' "Pending"/"Paid" display labels to "Outstanding"/"Received"; leave the `value` (legacy `InvoiceStatus`) fields unchanged
    - _Requirements: 10.1, 10.2_

  - [ ]* 25.3 Write unit test confirming Reports/Intelligence/Workspace Settings/AURA labels are unchanged
    - Assert `StatusChip`'s `CONFIG`, `pages/ReportsPage.tsx`, `pages/IntelligencePage.tsx`, `pages/WorkspaceSettingsPage.tsx`, and `components/aura/*` still render "Pending"/"Paid" verbatim
    - _Requirements: 10.3, 10.4_

- [ ] 26. Verify `services/dataProvider.ts`/`mockDataProvider.ts` require no interface changes
  - Add a confirmatory unit test that `saveInvoice`/`getPayments`/`getInvoices` signatures are unchanged and that a saved invoice's `billedAt` round-trips through the mock provider
  - _Requirements: 9.4_

- [ ] 27. Extract `components/create-invoice/InvoiceDocument.tsx` from `InvoicePreview.tsx` (correction pass)
  - Move `InvoicePreview.tsx`'s existing document JSX verbatim into a new, page-agnostic `InvoiceDocument` component, exported with the exact same `invoice`/`client`/`business` props shape and no page-specific behavior
  - Rewrite `InvoicePreview.tsx` to be a thin wrapper: `export function InvoicePreview({ invoice, client, business }) { return <InvoiceDocument invoice={invoice} client={client} business={business} />; }`
  - Do not change any computed figure, layout, or styling during the move — this is an extraction, not a redesign
  - _Requirements: 12.1, 12.2_

  - [ ]* 27.1 Write property test for single-invoice-rendering-source identity (Property 17)
    - **Property 17: Single invoice-rendering source produces numerically identical figures everywhere**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 28. Redesign `pages/InvoicePage.tsx` around `InvoiceDocument` (correction pass, replaces superseded Task 11)
  - Load the invoice via `selectedInvoiceId`, its payments filtered by `invoiceId`, the associated client, and the business profile via `useBusinessProfile()`; render an `EmptyState` "invoice not found" fallback with a "Back to invoices" action when the invoice can't be resolved
  - Render `InvoiceDocument` as the primary content of the page
  - Add a Print/PDF action calling `window.print()`, reusing the only existing print pattern in the codebase (`ReportsPage.tsx`'s `handlePrint`); apply `print:hidden` Tailwind utility classes to the page header, action buttons, and secondary status/payment-history block so only `InvoiceDocument` prints
  - Reuse the existing `DownloadInvoiceButton`/`invoiceExportService` unchanged for the Download action — do not introduce a new export/PDF mechanism
  - Render `InvoiceDetailActions` (continue-editing navigates to `Create_Invoice_Page` prefilled) and `PaymentHistoryList` (`onOpenReceipt` calls `navigateToPaymentReceipt`) as secondary content positioned below the document, alongside a `StatusChip` (drafts) or `LedgerStatusChip` with `getInvoiceLedgerStatus(invoice, invoicePayments)` (billed invoices)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 9.2, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 28.1 Write property test for Detail-page totals and status fidelity (Property 10)
    - **Property 10: Detail page totals and ledger status always match the calculation layer**
    - **Validates: Requirements 5.2, 5.3, 9.2**

- [ ] 29. Fix Create Invoice preview layout so it is never clipped by the sticky footer (correction pass)
  - In `pages/CreateInvoicePage.tsx`, change the outer grid from `grid flex-1 grid-cols-1 gap-8 overflow-y-auto px-10 py-8 lg:grid-cols-2` to `grid flex-1 grid-cols-1 gap-8 px-10 py-8 lg:grid-cols-2 lg:overflow-hidden`
  - Give the left form column and right preview column their own independent scroll containers: add `overflow-y-auto lg:h-full lg:pr-1` to the left column and `overflow-y-auto lg:h-full` to the right (preview) column
  - Do not change any font size, spacing, or content inside `InvoicePreview`/`InvoiceDocument` — this is a layout-only fix
  - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 29.1 Write unit test confirming independent scroll behavior at the `lg` breakpoint
    - Assert the left form column and right preview column each carry their own `overflow-y-auto`/`lg:h-full` scroll container and the outer grid carries `lg:overflow-hidden`
    - _Requirements: 13.2_

- [ ] 30. Extend AURA positioning to cover the Invoice Detail page (correction pass)
  - In `components/aura/AuraPanel.tsx`, add `"invoice-detail"` to the existing `PAGES_WITH_STICKY_FOOTER` `Set` (currently `new Set(["create-invoice"])`)
  - Do not modify AURA's response content, classification logic, intelligence behavior, or any other file under `components/aura/*`/`lib/auraAssistant.ts` — this is a positioning-only change
  - _Requirements: 14.1, 14.2, 14.3_

  - [ ]* 30.1 Write property test for AURA non-overlap (Property 18)
    - **Property 18: AURA never overlaps invoice financial content or controls on any affected page**
    - **Validates: Requirements 14.1, 14.2**

- [ ] 31. Fix mojibake in source files (correction pass)
  - In `pages/CreateInvoicePage.tsx` and `components/create-invoice/InvoicePreview.tsx`/`InvoiceDocument.tsx` (post-extraction), literally find-and-replace the confirmed byte sequences: `"Â·"` → `"·"`, `"â€”"` → `"—"`, `"â€¦"` → `"…"`, `"âˆ’"` → `"−"`, `"Â§"` → `"§"`
  - _Requirements: 15.1, 15.2_

  - [ ] 31.1 Grep the full `src/` tree for the same byte sequences and fix any additional occurrences found
    - Search for `Â·`, `â€”`, `â€¦`, `âˆ’`, `Â§` across all of `src/`; for every additional file found (beyond the two named above), apply the same literal find-and-replace correction
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 32. Checkpoint — Ensure all Invoice Detail/preview-layout/AURA/mojibake tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 33. Write a stability test for invoice numbering (Requirement 17 verification)
  - Write a unit or property test proving `lib/invoiceNumber.ts`'s `nextInvoiceNumber()` never alters an existing Draft_Invoice's already-assigned number when a new invoice is created, and never reuses a number already assigned to any existing invoice (draft or billed)
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 34. Write a property test for amount-in-words correctness (Requirement 19 verification)
  - Write a property test whose generator enumerates the scenario axes from Requirement 19.2 (whole-rupee vs. paise totals, positive/negative/zero round-off, zero/non-zero discount, single/multiple line items, CGST+SGST vs. no tax) crossed with randomized amounts, rather than relying on random sampling alone
  - **Property 19: Amount in words always matches the final rounded grand total, across the enumerated scenarios**
  - **Validates: Requirements 19.1, 19.2, 19.3**
  - _Requirements: 19.1, 19.2, 19.3_

- [ ] 35. Final checkpoint — Full verification pass
  - Run the TypeScript project build (`tsc -b`), ESLint (`eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`), the full Vitest suite including all property tests 1-19 and the widened Property 12 (`vitest run`), and the production build (`vite build`); fix any failures before considering the feature complete
  - Confirm the new unit tests are included in the sweep: the independent-scroll check (task 29.1), the mojibake grep-and-fix verification (task 31.1), the receipt document content check (task 13.2), and the Requirement 16 tasks (36-39, including 39.1/39.2)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 36. Add `invoiceId` passthrough field to `PaymentReportRow` in `lib/reports.ts` (Requirement 16)
  - Add `invoiceId: string | null` to the `PaymentReportRow` interface, positioned alongside the existing `id`/`invoiceNumber` fields
  - In `buildPaymentReportRows`, hoist the existing `invoices.find((i) => i.id === payment.invoiceId)` lookup (currently made inline only for `invoiceNumber`) into a local `invoice` variable, and set `invoiceId: invoice?.id ?? null` and `invoiceNumber: invoice?.number ?? "Unknown invoice"` from that same single lookup
  - Do not add a second lookup, and do not change any other field, filter, sort, or CSV-export logic in this file
  - _Requirements: 16.3, 16.7_

- [ ] 37. Replace invoice-number cells with `InvoiceNumberLink` in `pages/ReportsPage.tsx` (Requirement 16, depends on Task 36)
  - Replace all five confirmed invoice-number `<td>` cell occurrences with `<InvoiceNumberLink>`:
    - revenue report and invoices report (both use `invoiceRows`/`InvoiceReportRow`): `<InvoiceNumberLink invoice={{ id: r.id, number: r.number }} />`
    - outstanding report and overdue report (both use `outstandingRows`/`overdueRows` built from `OutstandingReportRow`): `<InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} />`
    - payments report (`paymentRows`/`PaymentReportRow`): `r.invoiceId ? <InvoiceNumberLink invoice={{ id: r.invoiceId, number: r.invoiceNumber }} /> : r.invoiceNumber` — falls back to plain text when the invoice no longer resolves (the pre-existing `"Unknown invoice"` case)
  - Do not change any other Reports calculation, filter, date-range, aggregation, or CSV-export logic; the "client-summary" report is untouched (it has no invoice-number column)
  - _Requirements: 16.1, 16.3, 16.6, 16.7_

- [ ] 38. Fix `openInvoice` navigation in `pages/IntelligencePage.tsx` (Requirement 16)
  - Destructure `navigateToInvoiceDetail` from `useWorkspaceStore()` alongside the already-destructured `goToInvoices` (both remain in use — `goToInvoices` still serves the unrelated "View all" link)
  - Change `openInvoice` to accept the used `invoiceId` parameter (removing the `_` unused-parameter prefix) and call `navigateToInvoiceDetail(invoiceId)` instead of `goToInvoices()`; remove the stale comment about the Invoice_Detail_Page not existing yet
  - Do not change any other function, metric, classification, or signal computation on the page
  - _Requirements: 16.1, 16.4, 16.6, 16.7_

- [ ] 39. Fix invoice-result navigation in `components/command-palette/CommandPalette.tsx` (Requirement 16)
  - Destructure `navigateToInvoiceDetail` from `useWorkspaceStore()` alongside the already-destructured `goToInvoices`, `openCreateInvoice`, `navigateTo`, etc.
  - Change the "Invoices" result group's `run` from `() => goToInvoices(info.status)` to `() => navigateToInvoiceDetail(invoice.id)`
  - Do not change Quick Actions items (which still intentionally call `goToInvoices(...)` to open a filtered list), Navigation items, or the fuzzy-match/filter/sort logic
  - _Requirements: 16.1, 16.5, 16.6, 16.7_

  - [ ]* 39.1 Write property test extending Property 12's widened scope (Requirement 16)
    - **Property 12 (widened): Invoice numbers are links everywhere required, and always resolve to the right invoice** — extend the existing property test's generated invoice fixtures to also cover `Reports_Page`'s revenue/invoices/outstanding/overdue tables, `Intelligence_Page`'s `AttentionList`, and `CommandPalette`'s "Invoices" result group
    - Include the documented edge case: a payments-report row whose `invoiceId` does not resolve to a live invoice renders as plain text, not a link
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6**

  - [ ]* 39.2 Write unit test confirming no other Reports/Intelligence/CommandPalette logic changed (Requirement 16)
    - Assert that `lib/reports.ts`'s calculation/filter/aggregation/CSV-export functions (`resolvePresetRange`, `filterInvoices`, `filterPayments`, every `compute*Summary`/`build*Rows` function's data-shaping logic besides the one added `invoiceId` field), `lib/intelligence.ts`'s classification/metric functions, and `CommandPalette.tsx`'s Quick Actions/Navigation/fuzzy-search behavior are unchanged (e.g. via snapshot or targeted assertions against fixed inputs)
    - _Requirements: 16.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; the model implementing this plan must not implement `*`-marked sub-tasks.
- Every property-test sub-task corresponds to exactly one correctness property from `design.md`, tagged with its property number and the requirement clauses it validates, per the project's property-based testing convention (`fast-check`, minimum 100 iterations, existing pattern in `lib/invoiceMath.test.ts`).
- Out of scope, and therefore absent from this plan: AURA, Intelligence, Reports, Workspace Settings, authentication, branding, Tauri packaging, the backend `InvoiceStatus` enum, and invoice export/PDF — consistent with `requirements.md`'s "Out of Scope" section.
- No contradiction was found between `requirements.md` and `design.md` during task generation; the design's handling of `StatStrip.tsx` and `InvoiceFilterBar.tsx` labels is an explicit, reasoned interpretation of Requirement 10.1's page-level wording documented inline in `design.md`, not a conflict.
- Task 11 is superseded (see Amendment Log) and must not be implemented as originally written; implement Task 28 instead, which depends on Task 27.
- Reports_Page/Intelligence_Page/CommandPalette invoice-number linking (Requirement 16) is now approved and authorized; Tasks 36-39 implement it, per `design.md`'s "Reports_Page / Intelligence_Page / CommandPalette invoice-number linking — approved design (Requirement 16)" section (see Amendment Log). Only billed-invoice editing remains an open question awaiting explicit user approval, with no task in this plan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "27", "30", "33", "36", "38", "39"] },
    { "id": 1, "tasks": ["2.1", "4", "27.1", "30.1", "37"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "5.1", "5.3"] },
    { "id": 3, "tasks": ["2.6", "2.7", "5.2", "5.4", "6", "7", "8", "10", "20"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "7.1", "7.2", "8.1", "8.2", "9", "10.1", "20.1", "22", "29"] },
    { "id": 5, "tasks": ["9.1", "15", "18", "21", "22.1", "25.1", "25.2", "28", "29.1", "31"] },
    { "id": 6, "tasks": ["12", "13", "16", "17", "23", "25.3", "26", "28.1", "31.1", "34", "39.1", "39.2"] },
    { "id": 7, "tasks": ["13.1", "13.2", "15.1"] },
    { "id": 8, "tasks": ["35"] }
  ]
}
```

Notes on the graph: Task 11 (superseded) is intentionally absent — it is not to be implemented, so it does not occupy a wave. Task 27 (`InvoiceDocument` extraction) and Task 31 (mojibake fix, which also touches `InvoicePreview.tsx`/`InvoiceDocument.tsx`) are kept in different waves from each other and from Task 6/29 (which both touch `pages/CreateInvoicePage.tsx`) to avoid same-file conflicts. Task 28 (Invoice Detail redesign) waits until after Task 27 (needs `InvoiceDocument`) and Tasks 9/10 (needs `InvoiceDetailActions`/`PaymentHistoryList`) are available. Task 30 (AURA) and Task 33 (invoice numbering) are independent of the rest of the plan and scheduled early. Task 36 (`lib/reports.ts` `invoiceId` field) is scheduled before Task 37 (`ReportsPage.tsx` cells) since the row shape must carry `invoiceId` before the page can render it; Tasks 38 (`IntelligencePage.tsx`) and 39 (`CommandPalette.tsx`) are independent of everything else and of each other, so both are scheduled in wave 0 alongside Task 36. Tasks 39.1/39.2 (Requirement 16 property/unit tests) wait until Tasks 36, 37, 38, and 39 are all complete. Task 35 (final checkpoint) remains last in the graph (wave 8) even though Tasks 36-39 appear after it in the document body; its text has been updated to explicitly cover Tasks 36-39.
