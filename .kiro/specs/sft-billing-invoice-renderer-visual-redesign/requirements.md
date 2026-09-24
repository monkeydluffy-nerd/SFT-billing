# Requirements Document

## Introduction

This feature redesigns the shared `InvoiceDocumentRenderer` screen to match the supplied reference invoice implementation and screenshot. The reference folder `sft-billing-phase2.2-gst/sft-billing/public/invoice` is a visual and structural source of truth through `Invoice.tsx`, `Invoice.module.css`, `invoiceModel.ts`, `types.ts`, and `README.md`; the user-supplied invoice screenshot attached to the request is an additional visual source of truth alongside those files. The redesign covers browser-screen presentation only and preserves the renderer’s current model contract, dynamic data, backend calculations, GST behavior, numbering, consumers, and print/PDF behavior. This phase does not change the existing `InvoiceDocumentModel` or `InvoiceDocumentRendererProps` contract; contract changes are not permitted.

## Glossary

- **Invoice Document**: The invoice screen produced by the shared renderer.
- **InvoiceDocumentRenderer**: The existing shared component that accepts the current `InvoiceDocumentRendererProps` contract and renders an invoice document.
- **Invoice Document Model**: The existing normalized `InvoiceDocumentModel` consumed by `InvoiceDocumentRenderer`.
- **Reference Invoice**: The supplied implementation and screenshot in `public/invoice`, together with the user-supplied invoice screenshot attached to the request; all are visual sources of truth, using a 1024×1448 portrait artboard.
- **Screen Inspection Report**: The required browser-evidence artifact at `.kiro/specs/sft-billing-invoice-renderer-visual-redesign/browser-evidence.md` that records the inspected route or shared consumer path, viewport dimensions, fixture cases, measured layout observations, defect checks, and screenshots or equivalent measured evidence.
- **Screen Preview**: The browser presentation of the Invoice Document before print or PDF output.
- **A4-like Artboard**: A portrait screen page sized 1024×1448 CSS pixels, preserving the reference aspect ratio.
- **TAX INVOICE Ribbon**: The copper/navy graphical invoice title element shown below the GST/PAN strip.
- **Order/Delivery Section**: The optional section for supplier code, purchase-order number, purchase-order date, and transporter.
- **Invoice Table Column Contract**: The fixed ten-column order: S.No, Description, HSN/SAC, Qty, Unit, Rate (₹), Taxable Value (₹), CGST 9% (₹), SGST 9% (₹), Amount (₹).
- **Fixed Table Geometry**: The reference column widths, in contract order: 6%, 24%, 10%, 7%, 7%, 10%, 12%, 8%, 8%, 8%.
- **Renderer Arithmetic**: Any calculation or recalculation of line taxes, taxable values, totals, round-off, grand total, or amount in words inside the renderer.

## Requirements

### Requirement 1: Reference Source and Page Composition

**User Story:** As an invoice reviewer, I want the screen invoice to match the supplied reference, so that the preview has the intended professional appearance.

#### Acceptance Criteria

1. THE InvoiceDocumentRenderer SHALL use the named reference `Invoice.tsx`, `Invoice.module.css`, `invoiceModel.ts`, `types.ts`, and `README.md` files in `sft-billing-phase2.2-gst/sft-billing/public/invoice`, together with the user-supplied invoice screenshot attached to the request, as co-equal visual and structural sources of truth for the Screen Preview.
2. WHEN the Invoice Document renders in Screen Preview, THE InvoiceDocumentRenderer SHALL display a 1024×1448 CSS-pixel A4-like Artboard with a visible page boundary, balanced margins, and a white page surface.
3. WHEN the viewport is narrower than 1024 CSS pixels, THE InvoiceDocumentRenderer SHALL preserve the A4-like Artboard width and expose horizontal scrolling rather than reducing content below readable proportions.
4. WHEN the viewport is at least 1024 CSS pixels wide, THE InvoiceDocumentRenderer SHALL center the A4-like Artboard while preserving its portrait aspect ratio.
5. THE InvoiceDocumentRenderer SHALL compose the header, GST/PAN strip, TAX INVOICE Ribbon, Bill To panel, Invoice Details panel, optional Order/Delivery Section, item table, totals, Amount in Words panel, Bank Details, Declaration, Authorized Signatory, and graphical footer in the reference order.
6. THE InvoiceDocumentRenderer SHALL use reference-aligned navy, copper, neutral, typography, borders, spacing, and graphical shapes rather than a generic card or unstyled raw HTML presentation.

### Requirement 2: Header and Invoice Identity

**User Story:** As an invoice recipient, I want the issuer and invoice identity to be immediately identifiable, so that I can verify the document at a glance.

#### Acceptance Criteria

1. WHEN the Invoice Document renders, THE InvoiceDocumentRenderer SHALL display the dynamic business logo when `business.logoUrl` is available, together with the dynamic business name, address, phone, email, GSTIN, and PAN values available in the Invoice Document Model.
2. IF the business logo is unavailable, THEN THE InvoiceDocumentRenderer SHALL preserve header geometry and display the reference-compatible logo-empty treatment without a broken-image artifact.
3. THE InvoiceDocumentRenderer SHALL display a GST/PAN strip with stable labels and alignment for available and unavailable identifiers.
4. THE InvoiceDocumentRenderer SHALL display a prominent copper/navy TAX INVOICE Ribbon consistent with the Reference Invoice.
5. THE InvoiceDocumentRenderer SHALL display the dynamic invoice number, issue date, due date, and model-provided invoice labels without generating replacement values.

### Requirement 3: Bill To, Invoice Details, and Optional Order/Delivery

**User Story:** As an invoice user, I want customer and transaction details grouped into clear panels, so that invoice parties and dates are easy to verify.

#### Acceptance Criteria

1. THE InvoiceDocumentRenderer SHALL display a Bill To panel containing the dynamic customer name, billing address, and GSTIN when available.
2. THE InvoiceDocumentRenderer SHALL display an Invoice Details panel containing the dynamic invoice number, issue date, due date, and applicable model-provided detail labels.
3. WHERE order or delivery data is present, THE InvoiceDocumentRenderer SHALL display each available supplier code, purchase-order number, purchase-order date, and transporter value in the Order/Delivery Section.
4. IF order or delivery data is absent, THEN THE InvoiceDocumentRenderer SHALL omit the Order/Delivery Section and reclaim its space without a large blank panel.
5. THE InvoiceDocumentRenderer SHALL preserve multi-line addresses and long field values without collision, clipping, or unreadable overlap.

### Requirement 4: Fixed Ten-Column Item Table

**User Story:** As an invoice reviewer, I want every taxable amount and GST value aligned in a stable table, so that each line can be audited without ambiguity.

#### Acceptance Criteria

1. WHEN line items are present, THE InvoiceDocumentRenderer SHALL render columns in exactly this order: S.No, Description, HSN/SAC, Qty, Unit, Rate (₹), Taxable Value (₹), CGST 9% (₹), SGST 9% (₹), Amount (₹).
2. THE InvoiceDocumentRenderer SHALL apply Fixed Table Geometry in the Invoice Table Column Contract order: 6%, 24%, 10%, 7%, 7%, 10%, 12%, 8%, 8%, and 8%.
3. THE InvoiceDocumentRenderer SHALL align Description to the reading edge, S.No/HSN/SAC/Qty/Unit consistently, and Rate/Taxable Value/CGST/SGST/Amount to the numeric edge in headers and body rows.
4. THE InvoiceDocumentRenderer SHALL keep the table within the A4-like Artboard, wrap long descriptions and headers at defined boundaries, and preserve readable row heights.
5. THE InvoiceDocumentRenderer SHALL render line-item quantity, unit price, taxable value, CGST, SGST, and amount from the Invoice Document Model without Renderer Arithmetic.
6. IF no line items are available, THEN THE InvoiceDocumentRenderer SHALL display the model’s defined empty-items state without a malformed or collapsed table.
7. THE InvoiceDocumentRenderer SHALL render no Discount column and no combined SGST/Amount column.

### Requirement 5: Totals and Amount in Words

**User Story:** As an invoice recipient, I want the payable total emphasized and explained, so that the amount due is immediately understandable.

#### Acceptance Criteria

1. THE InvoiceDocumentRenderer SHALL display taxable amount, CGST, SGST, round-off when applicable, and grand total from the model-provided totals.
2. THE InvoiceDocumentRenderer SHALL render Grand Total with a prominent copper treatment consistent with the Reference Invoice.
3. THE InvoiceDocumentRenderer SHALL display the model-provided amount in words in a bounded Amount in Words panel.
4. WHERE round-off is applicable, THE InvoiceDocumentRenderer SHALL display the model-provided round-off row; IF round-off is not applicable, THEN THE InvoiceDocumentRenderer SHALL omit that row without changing other total values.
5. THE InvoiceDocumentRenderer SHALL perform no Renderer Arithmetic for line taxes, totals, round-off, grand total, or amount in words.
6. IF a required total value is unavailable, THEN THE InvoiceDocumentRenderer SHALL display the model’s defined empty-value treatment rather than inventing a value.

### Requirement 6: Bank, Declaration, Signatory, and Footer

**User Story:** As an invoice issuer, I want payment and certification information to complete the page composition, so that the screen invoice is professionally usable.

#### Acceptance Criteria

1. THE InvoiceDocumentRenderer SHALL display Bank Details using dynamic account holder, bank, branch, account number, and IFSC values when available.
2. IF bank details are unavailable, THEN THE InvoiceDocumentRenderer SHALL display the defined bank-empty treatment while preserving the surrounding layout.
3. THE InvoiceDocumentRenderer SHALL display the model-provided Declaration and Authorized Signatory area, including dynamic signatory data when available.
4. THE InvoiceDocumentRenderer SHALL display a graphical branded footer consistent with the Reference Invoice and positioned at the bottom of the A4-like Artboard.
5. THE InvoiceDocumentRenderer SHALL omit standalone Terms & Conditions content from the Screen Preview.
6. THE InvoiceDocumentRenderer SHALL omit QR codes, scanners, and standalone QR/scanner panels from the Screen Preview.

### Requirement 7: Contract, Data, and Scope Preservation

**User Story:** As a billing-system maintainer, I want the visual redesign to preserve existing behavior, so that shared consumers continue to receive the same invoice meaning.

#### Acceptance Criteria

1. THE InvoiceDocumentRenderer SHALL preserve the existing public `InvoiceDocumentModel` contract and existing public `InvoiceDocumentRendererProps` contract, including the current `model` prop, without requiring shared consumers to change.
2. THE visual redesign SHALL make no additions, removals, renames, or type changes to the existing public `InvoiceDocumentModel` or `InvoiceDocumentRendererProps` contract.
3. THE InvoiceDocumentRenderer SHALL obtain business, customer, invoice identity, order/delivery, line-item, GST, totals, bank, declaration, signatory, labels, and empty-state values from the Invoice Document Model.
4. THE InvoiceDocumentRenderer SHALL preserve dynamic invoice data, backend-provided calculations, GST logic, invoice numbering, date values, and optional-field behavior.
5. THE visual redesign SHALL not mutate the Invoice Document Model or source invoice data.
6. THE visual redesign SHALL not change backend logic, backend APIs, payment behavior, shared consumers, print behavior, PDF behavior, or output-generation behavior.
7. IF a required visual value is absent from the current presentation model, THEN THE presentation boundary SHALL expose an existing backend-provided value without changing backend calculations or adding Renderer Arithmetic.

### Requirement 8: Browser Inspection and Completion Evidence

**User Story:** As a product reviewer, I want the redesigned screen checked in a browser, so that spacing and collision defects are caught before approval.

#### Acceptance Criteria

1. WHEN implementation is complete, THE implementation workflow SHALL perform a browser visual inspection of the InvoiceDocumentRenderer through the route or shared consumer path that renders the Screen Preview, using representative dynamic model data.
2. THE implementation workflow SHALL create the Screen Inspection Report at `.kiro/specs/sft-billing-invoice-renderer-visual-redesign/browser-evidence.md`, recording the route or shared consumer path, viewport dimensions for one wide viewport at least 1024 CSS pixels and one narrow viewport below 1024 CSS pixels, and the exact fixture cases inspected.
3. THE Screen Inspection Report SHALL include a populated fixture and a sparse or optional-data fixture covering absent or present order/delivery, bank, logo, identifiers, and line-item values as applicable.
4. THE Screen Inspection Report SHALL record the exact item-table headers, measured or declared widths for all ten columns, visibility of every required and optional section, observed dynamic values, and results of collision, clipping, wrapping, horizontal-overflow, and unexplained-blank-space checks.
5. THE Screen Inspection Report SHALL attach screenshots or equivalent measured evidence for each required viewport and fixture case, sufficient to verify the recorded observations.
6. DURING browser inspection, THE implementation workflow SHALL verify the 1024×1448 artboard, section order, table column order and widths, table readability, absence of collisions, absence of unexplained large blank regions, copper Grand Total, and footer placement.
7. DURING browser inspection, THE implementation workflow SHALL verify dynamic logo/business/customer/invoice values, optional order/delivery and bank behavior, omission of Terms & Conditions and QR/scanner content, and preservation of the current shared consumer path.
8. IF browser inspection identifies a spacing, overflow, collision, clipping, geometry, or hierarchy defect, THEN the implementation workflow SHALL correct the screen presentation and repeat the browser inspection before approval.
9. THE implementation workflow SHALL limit this phase to Screen Preview browser inspection and SHALL exclude print, PDF, backend, and output-generation inspection or implementation.
