# Implementation Plan: Invoice Frontend Stabilization

## Overview

This plan stabilizes `sft-billing-phase2.2-gst/sft-billing` (React + TypeScript + Vite). It fixes the TypeScript build, introduces a Vitest + fast-check + Testing Library test setup, verifies invoice math/amount-in-words, fixes the LineItemEditor leading-zero bug, fixes the AURA/footer overlap, flips sidebar availability, and builds out the Clients and Payments modules end-to-end through the existing `DataProvider`. All paths below are relative to `sft-billing-phase2.2-gst/sft-billing/` unless noted otherwise.

## Tasks

- [ ] 1. Fix TypeScript build configuration
  - [ ] 1.1 Declare `@types/node` and fix `tsconfig.node.json` emit conflict
    - Add `"@types/node": "^20.14.0"` to `package.json` `devDependencies`
    - Add `"noEmit": true` to `tsconfig.node.json`'s `compilerOptions`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ] 1.2 Fix `CommandPalette.tsx` KeyboardEvent type mismatch
    - Alias the React `KeyboardEvent` import to `ReactKeyboardEvent` and retype the `window.addEventListener("keydown", ...)` handler (around line 68) against the DOM's global `KeyboardEvent`, leaving the input-level handler (around line 194) typed as `ReactKeyboardEvent<HTMLInputElement>`
    - _Requirements: 8.1, 8.5_
  - [ ] 1.3 Verify clean build
    - Run `npm install` then `tsc -b --force` from the project root and confirm exit code 0 with zero errors and no stray `vite.config.js`/`.d.ts`/`tailwind.config.js`/`.d.ts` files left in the project root
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 2. Set up the test runner
  - [ ] 2.1 Install and configure Vitest, fast-check, and Testing Library
    - Add `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, and `fast-check` as pinned exact-version devDependencies
    - Add a `"test": "vitest run"` script to `package.json`
    - Configure Vitest (in `vite.config.ts` or a `vitest.config.ts`) with `environment: "jsdom"` and a test setup file that imports `@testing-library/jest-dom`
    - _Requirements: 7.1, 7.2, 7.4_
  - [ ] 2.2 Verify the test runner executes
    - Add a trivial smoke test (e.g. `1 + 1 === 2`) and run `vitest run` once to confirm the pipeline works, then remove the smoke test
    - _Requirements: 7.1, 7.2, 7.4_

- [ ] 3. Checkpoint - Ensure build and test setup are clean
  - Run `tsc -b` and `vitest run`, ensure both succeed, ask the user if questions arise.

- [ ] 4. Verify invoice totals and amount-in-words correctness
  - [ ] 4.1 Write unit and property tests for `computeInvoiceTotals`
    - Add `src/lib/invoiceMath.test.ts` with a unit test using the worked example (taxable value ₹25,700, CGST 9%, SGST 9%, zero discount, zero round-off) asserting `cgstAmount === 2313`, `sgstAmount === 2313`, and `total === 30326`
    - _Requirements: 7.1, 7.2_
  - [ ]* 4.2 Write property test for invoice totals determinism
    - **Property 12: Invoice totals are deterministic and match the reference calculation**
    - **Validates: Requirements 7.1, 7.2**
    - Use `fast-check` to generate random non-negative line items, GST rates in `[0, 1]`, discounts, and round-offs (≥100 runs), asserting `cgstAmount`/`sgstAmount` equal `(subtotal - discount) * rate` and `total` equals `max(0, (subtotal - discount) + cgstAmount + sgstAmount + roundOff)`
  - [ ] 4.3 If a discrepancy is found, correct `invoiceMath.ts`
    - Only touch `computeInvoiceTotals`/`suggestRoundOff`/`getInvoiceStatus` if task 4.1 or 4.2 fails; fix the root cause, do not add a compensating hard-coded value
    - _Requirements: 7.3, 7.5_
  - [ ] 4.4 Write unit tests for `amountInWords`
    - Add `src/lib/amountInWords.test.ts` asserting `amountInWords(30326)` matches "Thirty Thousand Three Hundred Twenty Six Rupees Only" (or the module's existing casing/hyphenation convention), plus boundary examples (0, exact lakh/crore boundaries)
    - _Requirements: 7.4_

- [ ] 5. Fix LineItemEditor unit price / quantity leading-zero bug
  - [ ] 5.1 Implement text-buffer based numeric input handling
    - In `src/components/create-invoice/LineItemEditor.tsx`, add `quantityText`/`unitPriceText` string-buffer state keyed by line item id, a `displayValue` helper, and a `handleNumericChange` helper that accepts partial-number strings (`/^\d*\.?\d*$/`) and only pushes parsed numeric values to `updateItem`
    - Change the quantity and unit price `<input>` elements from `type="number"` to `type="text"` with `inputMode="decimal"`, wiring `value`/`onChange` to the new helpers
    - Clear a row's entries from both text-buffer maps in `removeItem`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 5.2 Write property test for numeric field display fidelity
    - **Property 11: Numeric line-item fields display exactly what was typed**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
    - Add `src/components/create-invoice/LineItemEditor.test.tsx` using `fast-check` to drive `userEvent.type` with generated digit/decimal-point sequences into the quantity and unit price inputs, asserting the displayed value equals the typed string
  - [ ]* 5.3 Write unit tests for the named bug scenarios
    - Test typing "200" displays "200" (not "0200"), and clearing a field then typing a new value does not prepend stale digits
    - _Requirements: 6.1, 6.4_

- [ ] 6. Verify order/delivery field mapping (manual walkthrough, no code change expected)
  - [ ]* 6.1 Write property test for order/delivery field round-trip
    - **Property 9: Order/delivery fields round-trip into the preview under their correct labels**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Add `src/components/create-invoice/InvoicePreview.test.tsx` iterating the power set (16 combinations) of `{supplierCode, poNumber, poDate, transporter}`, asserting each set field renders under its label with `poDate` formatted the same as `issueDate`/`dueDate`, and the order/delivery block is omitted when all four are unset
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 6.2 Manually verify end-to-end mapping in the running app
    - Walk through `CreateInvoicePage`: type into each of the four order/delivery fields, confirm each appears under its label in `InvoicePreview`, confirm the block disappears when all four are cleared, confirm P.O. Date renders in the same format as Issued/Due dates
    - If this walkthrough or task 6.1 surfaces a real mapping defect, correct that specific mapping in `InvoicePreview.tsx`/`CreateInvoicePage.tsx` without altering the layout of unaffected fields
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ] 7. Fix AURA panel / sticky footer overlap
  - [ ] 7.1 Thread `currentPage` into `AuraPanel` and apply a footer-aware offset
    - In `src/components/aura/AuraPanel.tsx`, read `currentPage` from `useWorkspaceStore`, compute `hasStickyFooter = currentPage === "create-invoice"`, and apply `bottom-24` instead of `bottom-6` to both the collapsed button's and expanded panel's `fixed ... right-6` className when `hasStickyFooter` is true, leaving `bottom-6` for all other pages
    - Do not modify `framer-motion` transition props, panel content, or interaction logic
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 7.2 Write test for AURA offset behavior
    - **Property 10: AURA never overlaps the sticky footer on Create Invoice, and keeps its original position elsewhere**
    - **Validates: Requirements 5.1, 5.2, 5.4**
    - Add `src/components/aura/AuraPanel.test.tsx` as an example-based test over the enumerable set of `AppPage` values, asserting the rendered className includes `bottom-24` only when `currentPage === "create-invoice"` and `bottom-6` otherwise
  - [ ] 7.3 Manually verify no visual overlap
    - At a 1440x900 viewport on `CreateInvoicePage`, confirm the collapsed AURA button and the expanded panel both sit fully above the sticky footer
    - _Requirements: 5.1, 5.2_

- [ ] 8. Checkpoint - Ensure all tests pass so far
  - Run `vitest run` and `tsc -b`, ensure both succeed, ask the user if questions arise.

- [ ] 9. Flip sidebar availability for Clients and Payments
  - [ ] 9.1 Update `NAV_ITEMS` in `SidebarNav.tsx`
    - In `src/components/layout/SidebarNav.tsx`, set `available: true` for the "Clients" and "Payments" nav items, leaving "Intelligence", "Reports", and "Workspace Settings" at `available: false`
    - _Requirements: 3.1, 3.2_
  - [ ]* 9.2 Write unit tests for sidebar navigation
    - One test each for clicking "Clients" and "Payments" asserting the corresponding store navigation state changes and the items are no longer disabled/tagged "Soon"
    - _Requirements: 3.1, 3.3_

- [ ] 10. Add client-detail navigation state to the workspace store
  - [ ] 10.1 Add `selectedClientId`, `navigateToClientDetail`, and `goToClients` to `useWorkspaceStore`
    - In `src/hooks/useWorkspaceStore.ts`, add `selectedClientId: string | null` (default `null`), `navigateToClientDetail(clientId: string)` (sets `currentPage: "clients"` and `selectedClientId`), and `goToClients()` (sets `currentPage: "clients"` and `selectedClientId: null`), following the existing `invoiceDraftPrefill`/`goToInvoices` pattern
    - _Requirements: 1.2, 9.5_
  - [ ]* 10.2 Write unit tests for the new store actions
    - Test that `navigateToClientDetail` sets `selectedClientId` and `currentPage`, and `goToClients` clears `selectedClientId`
    - _Requirements: 1.2_

- [ ] 11. Implement AddClientModal
  - [ ] 11.1 Create `src/components/clients/AddClientModal.tsx`
    - Fields: name, contactName, email, phone (optional), billingAddress, gstin (optional), notes (optional), using plain labeled `<input>`/`<textarea>` elements styled per the codebase's existing input class recipe (not the phase1 `FormField`/`Input` primitives)
    - Validate on submit (required: name, contactName, email format, billingAddress); on invalid, set field-level errors and do not call `createClient`
    - On valid submit, call `activeDataProvider.createClient(...)` with a `cl_runtime_${Date.now()}` id, then invoke `onCreated(clientId)`
    - Use the existing `Modal` component (`open`, `onClose`, `title`, `children`, `footer`) without adding a `size` prop
    - _Requirements: 1.3, 1.4, 1.5, 9.1, 9.2, 10.1, 10.2_
  - [ ]* 11.2 Write property test for valid client creation
    - **Property 3: Valid client creation persists exactly the submitted data**
    - **Validates: Requirements 1.3, 1.6**
    - Mock `activeDataProvider.createClient`, generate well-formed form inputs with `fast-check`, assert it is called exactly once with matching field values
  - [ ]* 11.3 Write property test for invalid client submissions
    - **Property 4: Invalid client submissions never reach the DataProvider**
    - **Validates: Requirements 1.4**
    - Generate forms missing/invalidating exactly one required field, assert `createClient` is never called and a field-level error is shown for the invalid field

- [ ] 12. Implement ClientsPage
  - [ ] 12.1 Create `src/pages/ClientsPage.tsx`
    - Use `useClients()` and `useInvoices()` (for per-row invoice counts), `PageHeader` + `Skeleton` loading rows + `EmptyState` (error state, `AlertTriangle` icon) pattern matching `InvoicesPage`
    - Add a search box filtering by `fuzzyMatch(query, client.name)`
    - "Add client" action opens `AddClientModal`; on `onCreated`, call `reload()` and show a `Toast`
    - Row click calls `navigateToClientDetail(client.id)`
    - Retrieve/persist data exclusively through hooks/`DataProvider`; no `appStore` reference
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 9.1, 9.2, 10.1, 10.3_
  - [ ]* 12.2 Write property test for client list rendering
    - **Property 1: Client list rendering completeness**
    - **Validates: Requirements 1.1**
    - Generate arrays of `Client` objects (0-10 items) with `fast-check`, assert exactly one row renders per client with the correct name

- [ ] 13. Implement ClientDetailPage
  - [ ] 13.1 Create `src/pages/ClientDetailPage.tsx`
    - Use `useClients()`, `useInvoices()`, and `selectedClientId`/`goToClients` from `useWorkspaceStore`
    - Filter invoices by `clientId === selectedClientId`, sorted by `issueDate` descending
    - Render client detail card (contact name, email, phone, billing address, GSTIN, client since) and an invoices section reusing `InvoiceRow` or a simple read-only row
    - Show `EmptyState` (`Inbox` icon, "No invoices yet") when `clientInvoices.length === 0`
    - _Requirements: 1.2, 1.5, 1.7, 9.1, 9.2, 10.1_
  - [ ]* 13.2 Write property test for client detail invoice filtering
    - **Property 2: Client detail invoice filtering**
    - **Validates: Requirements 1.2**
    - Generate a client id and an array of `Invoice` objects with `fast-check`, assert exactly the subset with matching `clientId` is displayed

- [ ] 14. Wire Clients pages into App.tsx
  - [ ] 14.1 Add the `"clients"` case to `App.tsx`
    - Render `<AppShell>{selectedClientId ? <ClientDetailPage /> : <ClientsPage />}</AppShell>` for `currentPage === "clients"`, following the existing switch-case pattern
    - _Requirements: 1.1, 1.2, 3.3_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Run `vitest run` and `tsc -b`, ensure both succeed, ask the user if questions arise.

- [ ] 16. Implement RecordPaymentModal and PaymentsPage
  - [ ] 16.1 Create `src/components/payments/RecordPaymentModal.tsx`
    - Fields: invoice select, amount (number, defaulting to the selected invoice's computed total), method select (`bank_transfer`/`card`/`upi`/`cheque`/`cash`), reference (optional)
    - Validate: invoice, amount > 0, and method required; on invalid, show field-level errors and do not call `recordPayment`
    - On valid submit, call `activeDataProvider.recordPayment(...)` with a `pm_runtime_${Date.now()}` id matching `InvoicesPage.markPaid`'s existing call shape, then invoke `onRecorded(payment)`
    - _Requirements: 2.2, 2.3, 9.1, 9.2, 10.1, 10.2_
  - [ ] 16.2 Create `src/pages/PaymentsPage.tsx`
    - Use `usePayments()`, `useInvoices()`, `useClients()`; render rows with `receivedAt`, resolved invoice number, resolved client name, amount, method, reference, sorted by `receivedAt` descending
    - "Record payment" action opens `RecordPaymentModal`; on `onRecorded`, call `reload()` and show a `Toast`
    - Reuse `PageHeader`/`Skeleton`/`EmptyState` patterns; no hard-coded demo payment data
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 9.1, 9.2, 10.1, 10.3_
  - [ ]* 16.3 Write property test for payment list rendering
    - **Property 5: Payment list rendering completeness**
    - **Validates: Requirements 2.1**
    - Generate arrays of `Payment` objects with `fast-check`, assert exactly one row renders per payment
  - [ ]* 16.4 Write property test for valid payment recording
    - **Property 6: Valid payment recording persists exactly the submitted data**
    - **Validates: Requirements 2.2, 2.4**
    - Mock `activeDataProvider.recordPayment`, generate well-formed payment form inputs, assert it is called exactly once with matching data and the list subsequently includes it
  - [ ]* 16.5 Write property test for invalid payment submissions
    - **Property 7: Invalid payment submissions never reach the DataProvider**
    - **Validates: Requirements 2.3**
    - Generate forms missing exactly one required field, assert `recordPayment` is never called and a field-level error is shown
  - [ ]* 16.6 Write property test for payment row resolution
    - **Property 8: Payment rows resolve to the correct invoice and client**
    - **Validates: Requirements 2.5**
    - Generate a `Payment` with a matching `Invoice`/`Client` in loaded data, assert the rendered row shows that invoice's `number` and that client's `name`

- [ ] 17. Wire PaymentsPage into App.tsx
  - [ ] 17.1 Add the `"payments"` case to `App.tsx`
    - Render `<AppShell><PaymentsPage /></AppShell>` for `currentPage === "payments"`, following the existing switch-case pattern
    - _Requirements: 2.1, 3.3_

- [ ] 18. Final checkpoint - Full build and verification pass
  - Run `tsc -b --force` (confirm zero errors, no stray build artifacts) and `vitest run` (confirm all tests pass); manually re-verify the AURA/footer non-overlap (task 7.3) and the order/delivery field walkthrough (task 6.2) still hold after all changes; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test-writing sub-tasks and are not implemented as part of default execution.
- All Clients/Payments code depends only on hooks (`useClients`, `useInvoices`, `usePayments`) and domain types, never on `mockDataProvider.ts` directly or the phase1 `appStore` pattern (Requirement 9).
- No changes are made to `sft-billing-phase1` or `sft-billing-phase2` (non-`.2-gst` variant), or to any type in `src/types/`.
- Tasks 4 and 6 are verification-first: code changes to `invoiceMath.ts` or `InvoicePreview.tsx`/`CreateInvoicePage.tsx` only happen if a real discrepancy/defect is found.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "2.2"] },
    { "id": 2, "tasks": ["4.1", "4.2", "5.1", "6.1", "7.1", "9.1", "10.1"] },
    { "id": 3, "tasks": ["4.3", "4.4", "5.2", "5.3", "6.2", "7.2", "7.3", "9.2", "10.2", "11.1"] },
    { "id": 4, "tasks": ["11.2", "11.3", "12.1", "13.1"] },
    { "id": 5, "tasks": ["12.2", "13.2", "14.1"] },
    { "id": 6, "tasks": ["16.1"] },
    { "id": 7, "tasks": ["16.2"] },
    { "id": 8, "tasks": ["16.3", "16.4", "16.5", "16.6", "17.1"] }
  ]
}
```
