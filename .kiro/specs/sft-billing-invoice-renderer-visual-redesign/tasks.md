# Implementation Plan: Screen-Only Invoice Renderer Visual Redesign

## Overview

Recreate the supplied invoice implementation and **user-supplied invoice screenshot** as the shared React/TypeScript `InvoiceDocumentRenderer` screen DOM and CSS on a fixed 1024×1448 CSS-pixel artboard. The implementation reference is the supplied screenshot together with `sft-billing-phase2.2-gst/sft-billing/public/invoice/Invoice.tsx`, `Invoice.module.css`, `invoiceModel.ts`, `types.ts`, and `README.md`; where visual details are shown in the screenshot, it is the visual source of truth.

The existing `InvoiceDocumentModel` and `InvoiceDocumentRendererProps` contracts are immutable. In particular, the existing `InvoiceDocumentRendererProps` shape and `model` prop must not change, and all existing consumers must continue using the same shared consumer path. The renderer is a pure screen presentation boundary: it may use existing display formatters, but must not calculate, recalculate, normalize, mutate, or invent invoice data.

Print/PDF/output-generation behavior, `@media print`, `@page`, backend/API/payment/GST/calculation/numbering logic, and consumer/call-site changes are out of scope and must not be implemented or tested as part of this feature.

## Tasks

- [ ] 1. Audit the existing contracts, reference, screenshot, and shared consumer path
  - [ ] 1.1 Audit the current `InvoiceDocumentRenderer`, the exact existing `InvoiceDocumentRendererProps` contract, `InvoiceDocumentModel`, adapter/presentation mapping, fixtures, and shared consumer path against the supplied screenshot and `public/invoice/Invoice.tsx`, `Invoice.module.css`, `invoiceModel.ts`, `types.ts`, and `README.md`.
    - Record the route/entry point and shared consumer path that browser inspection must use.
    - Inventory logo, business/contact, GST/PAN, invoice identity/dates/labels, Bill To, order/delivery, ten item columns, supplied financial values, totals, amount in words, bank, declaration, signatory, and empty-state values.
    - **Contract guardrail:** do not alter `InvoiceDocumentModel`, `InvoiceDocumentRendererProps`, the `model` prop, or any existing consumer/call site.
    - _Requirements: 1.1, 2.1-2.5, 3.1-3.3, 4.1, 4.5, 5.1-5.6, 6.1-6.3, 7.1-7.3_
  - [ ] 1.2 If a renderer-ready value is absent from the current presentation boundary, expose only an already existing model/backend-provided value through the unchanged contract.
    - Do not add backend/API fields, change calculations/GST/numbering, introduce a new source of truth, or perform Renderer Arithmetic.
    - Preserve zero values and distinguish absent optional values from falsy values.
    - _Requirements: 4.5, 5.5-5.6, 7.2-7.6_
  - [ ]* 1.3 Add focused contract/adapter regression tests proving the unchanged props/model contracts, complete values, zero values, absent optional values, and preservation of deliberately non-derivable backend financial values.
    - _Requirements: 4.5, 5.1-5.6, 7.1-7.4_

- [ ] 2. Rebuild the screen-only renderer DOM and composition
  - [ ] 2.1 Replace only the renderer’s screen composition with the reference order: screen region/canvas, 1024×1448 document, header, GST/PAN strip, TAX INVOICE ribbon, Bill To, Invoice Details, conditional Order/Delivery, items, summary, Amount in Words, totals, bank, declaration, authorized signatory, and graphical footer.
    - Add stable semantic classes/test landmarks while preserving the exact existing `InvoiceDocumentRendererProps` and `InvoiceDocumentModel` contracts and shared consumer path.
    - Do not render Terms & Conditions, QR codes, scanners, or relabeled equivalents.
    - _Requirements: 1.5-1.6, 6.4-6.6, 7.1, 7.5_
  - [ ] 2.2 Implement dynamic header and invoice identity from the model.
    - Render available logo/business/contact/GSTIN/PAN values, stable empty-logo treatment, ribbon, invoice number, issue date, due date, and model-provided labels without generated replacements.
    - Preserve long/multiline values without collision.
    - _Requirements: 2.1-2.5, 3.5, 7.2-7.3_
  - [ ] 2.3 Implement Bill To, Invoice Details, and conditional Order/Delivery panels.
    - Render all available fields; omit the complete optional section when supplier code, PO number/date, and transporter are all absent, reclaiming its space.
    - _Requirements: 3.1-3.5_
  - [ ] 2.4 Implement the exact ten-column item table.
    - Render exactly `S.No`, `Description`, `HSN/SAC`, `Qty`, `Unit`, `Rate (₹)`, `Taxable Value (₹)`, `CGST 9% (₹)`, `SGST 9% (₹)`, `Amount (₹)` in every header/body row.
    - Add explicit `colgroup` widths `6%/24%/10%/7%/7%/10%/12%/8%/8%/8%`, fixed layout, model-supplied values, defined empty-items state, and no Discount or combined SGST/Amount column.
    - _Requirements: 4.1-4.7_
  - [ ] 2.5 Implement totals, Amount in Words, Bank Details, Declaration, Authorized Signatory, and footer.
    - Render supplied values and defined empty/conditional treatments; perform no renderer arithmetic and add no Terms/QR/scanner content.
    - _Requirements: 5.1-5.6, 6.1-6.6, 7.2-7.4_

- [ ] 3. Rebuild reference-aligned screen CSS only
  - [ ] 3.1 Implement the scroll-owning screen region and fixed page shell at exactly `width: 1024px`, `height/min-height: 1448px`, with visible boundary, white surface, balanced margins, screenshot-aligned palette/typography, narrow viewport horizontal scrolling, and wide viewport centering.
    - Do not shrink below 1024px, clip overflow, or hide collisions.
    - Do not add or alter print rules, `@media print`, `@page`, PDF, or output-generation behavior.
    - _Requirements: 1.2-1.6, 7.5_
  - [ ] 3.2 Style the screenshot/reference hierarchy: header, GST/PAN strip, copper/navy ribbon, panels, table, totals, copper Grand Total, Amount in Words, closing content, and graphical footer.
    - Add wrapping/overflow ownership for long addresses, labels, identifiers, descriptions, and numeric cells.
    - _Requirements: 1.6, 2.4, 3.5, 4.3-4.4, 5.2-5.3, 6.4_
  - [ ] 3.3 Enforce the exact table CSS contract: `width: 100%`, `table-layout: fixed`, collapsed borders, exact colgroup widths, shared header/body alignment, numeric right alignment/tabular numerals, and defined wrapping without collision-hiding clipping.
    - _Requirements: 4.1-4.4_

- [ ] 4. Checkpoint - integrated implementation before tests
  - Ensure tasks 1–3 are integrated and type-safe before adding regression tests.
  - Confirm `InvoiceDocumentModel`, `InvoiceDocumentRendererProps`, `model`, and shared consumers are unchanged; confirm no print/PDF/`@media print`/`@page`/backend/API files were changed.
  - Dependency: tasks 5 and 6 may not begin until this checkpoint passes.

- [ ] 5. Add mandatory component, property, and CSS regression coverage
  - [ ] 5.1 Add component regression tests for populated, missing-logo, missing-bank, missing-order/delivery, empty-items, zero-value, multiline-address, long-description, and conditional-round-off fixtures.
    - Assert dynamic values, section order, optional behavior, supplied totals, footer, and absence of Terms & Conditions/QR/scanner content.
    - _Requirements: 1.5-1.6, 2.1-2.5, 3.1-3.5, 4.1-4.7, 5.1-5.6, 6.1-6.6_
  - [ ] 5.2 Add a mandatory regression test with intentionally inconsistent financial fixtures.
    - Assert supplied taxable value, CGST, SGST, amount, totals, round-off, Grand Total, and amount-in-words values render after formatting without arithmetic or replacement.
    - _Requirements: 4.5, 5.1, 5.4-5.6, 7.3-7.4_
  - [ ] 5.3 Add a mandatory deep-equality immutability regression test for the model and nested objects before and after rendering.
    - _Requirements: 7.1, 7.4_
  - [ ] 5.4 Add mandatory DOM/CSS regression tests for artboard size, non-shrinking narrow behavior, overflow ownership, wide centering, exact colgroup widths, fixed layout, wrapping/alignment hooks, ribbon, copper Grand Total, footer, and section order.
    - Assert screen styles only; do not introduce print/PDF assertions.
    - _Requirements: 1.2-1.5, 4.1-4.4, 5.2, 6.4, 8.2_
  - [ ]* 5.5 Add property tests for Design Property 1, “Model values map to their designated sections,” with at least 100 iterations and the required feature/property tag.
    - _Requirements: 2.1, 2.3, 2.5, 3.1-3.3, 4.5, 5.1, 5.3, 6.1, 6.3, 7.2, 7.6_
  - [ ]* 5.6 Add property tests for Design Property 2, “Renderer displays supplied financial values without arithmetic,” with at least 100 iterations and the required tag.
    - _Requirements: 4.5, 5.1, 5.4-5.6, 7.3-7.4_
  - [ ]* 5.7 Add property tests for Design Property 3, “Rendering does not mutate the model,” with at least 100 iterations and the required tag.
    - _Requirements: 7.1, 7.4_
  - [ ]* 5.8 Add property tests for Design Property 4, “Variable text remains owned by its field or cell,” with at least 100 iterations and the required tag.
    - _Requirements: 3.5, 4.3-4.4_

- [ ] 6. Perform mandatory browser inspection and create the evidence artifact
  - Dependency: start only after checkpoint 4 and all mandatory regression tests 5.1–5.4 pass. If implementation or tests change afterward, repeat tasks 5 and 6.
  - [ ] 6.1 Inspect the **existing shared consumer route/path**, not an isolated renderer story, using all four required fixture/viewport combinations: populated-wide, populated-narrow, sparse-wide, and sparse-narrow. Wide means **≥1024px**; narrow means **<1024px**.
    - Use the supplied user invoice screenshot as the visual source of truth and record the route/path, fixture identity, viewport dimensions, and browser used for each combination.
    - _Requirements: 8.1, 8.3_
  - [ ] 6.2 Verify and record results for populated-wide, populated-narrow, sparse-wide, and sparse-narrow: 1024×1448 artboard, visible boundary, white surface, margins, centering, horizontal scrolling, exact section order, exact ten-column order and measured widths, table readability/wrapping/alignment, dynamic values, optional Order/Delivery and bank behavior, totals/Amount in Words/copper Grand Total, declaration/signature, footer placement, Terms/QR/scanner omission, and shared consumer/model contract preservation.
    - Record screenshots **or measured DOM/CSS values** for each viewport/fixture; record section-by-section pass/fail checks.
    - Explicitly record collision, clipping, overflow, unexplained-large-empty-space, and hierarchy results, including any defect and retest outcome.
    - _Requirements: 8.2-8.5_
  - [ ] 6.3 Create and commit the mandatory browser-evidence artifact at `.kiro/specs/sft-billing-invoice-renderer-visual-redesign/browser-evidence.md`.
    - The artifact must contain: source-of-truth screenshot/reference paths; existing route/shared consumer path; browser and exact wide/narrow viewport sizes; populated and sparse fixture identifiers; screenshots or measured DOM/CSS values; exact table order and measured/computed widths; section checks; collision/overflow/clipping/empty-space results; contract/scope checks; pass/fail notes; defect corrections and repeat-inspection results.
    - A missing, empty, incomplete, or stale artifact is a validation failure, not an acceptable omission.
    - _Requirements: 8.1-8.5_

- [ ] 7. Final checkpoint - fail closed on screen-only validation
  - Dependency: run only after tasks 5.1–5.4 and 6.1–6.3 pass.
  - [ ] 7.1 Run the affected frontend type-check/build and single-run mandatory regression/property tests, then verify the browser-evidence artifact exists and contains every required field from task 6.3.
    - Final validation **must fail** if browser evidence is absent, incomplete, lacks both viewport/fixture cases, lacks screenshots or measured DOM/CSS values, lacks exact table widths/order, or lacks section and collision/overflow/empty-space pass/fail notes.
    - Final validation must also fail if `InvoiceDocumentModel`, `InvoiceDocumentRendererProps`, the shared consumer path, backend/API behavior, or print/PDF/`@media print`/`@page` behavior changed.
    - Do not add or run backend, print, PDF, or output-generation changes.

## Notes

- Tasks marked with `*` are optional property-test tasks; all non-starred implementation, mandatory regression, browser inspection, evidence, and final-gate tasks are required.
- The implementation must not modify `InvoiceDocumentModel`, `InvoiceDocumentRendererProps`, the `model` prop, shared consumers, backend/API logic, payment/GST/calculation/numbering behavior, print/PDF behavior, `@media print`, or `@page`.
- Use single-run test commands rather than watch mode.
- The dependency graph below is **advisory for leaf-task scheduling**. Checkpoint dependencies are authoritative in the task text: checkpoint 4 gates tasks 5–6, all mandatory regression tasks 5.1–5.4 gate browser inspection, and tasks 5.1–5.4 plus 6.1–6.3 gate final validation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.3", "3.2"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.3"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.5", "5.6", "5.7", "5.8"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3"] },
    { "id": 9, "tasks": ["7.1"] }
  ]
}
```
