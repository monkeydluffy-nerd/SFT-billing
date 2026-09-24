# Requirements Document

## Introduction

This feature is the final stabilization pass for the canonical SFT Billing application at `sft-billing-phase2.2-gst/sft-billing` and its existing FastAPI/openpyxl backend at `backend`. The pass corrects the invoice lifecycle and document experience, completes payment and payment-proof persistence through the existing architecture, fixes exact-invoice navigation, corrects targeted terminology, layout, Settings/logo, and encoding defects, and verifies existing calculation and numbering pipelines. The pass does not implement application code in this requirements phase, does not add SQLite or a second database, does not redesign Reports or Intelligence, and does not silently decide unresolved product questions.

The previously approved lifecycle, draft behavior, canonical invoice navigation, shared invoice rendering, core terminology, amount-in-words, invoice-number stability, and open business decisions remain in force except where this document records a genuine contradiction and its explicit resolution. IGST implementation is intentionally deferred because the current frontend and backend models and calculation/export path do not represent IGST.

## Glossary

- **Application**: The React + TypeScript + Vite frontend in `sft-billing-phase2.2-gst/sft-billing`.
- **Backend**: The existing Python FastAPI service in `backend`, including its Pydantic schemas, routes, services, and openpyxl workbook persistence.
- **DataProvider**: The Application data-access interface and its active implementation; components and hooks use this boundary instead of accessing storage directly.
- **System**: The Application together with the Backend and their existing DataProvider boundary.
- **Invoice**: A billing record containing client, line-item, tax, amount, lifecycle, and document data.
- **Draft_Invoice**: An Invoice with `isDraft` set to `true`; editable and excluded from financial totals.
- **Billed_Invoice**: An Invoice with `isDraft` set to `false` and a billing timestamp; included in financial totals.
- **Bill_Invoice_Action**: The action that changes a Draft_Invoice to a Billed_Invoice without sending an external message.
- **Send_Invoice_Action**: The record/confirm-only action for a Billed_Invoice that records the intended send state without selecting or integrating an external communication channel.
- **Send_Reminder_Action**: The record/confirm-only action for an Outstanding_Status or Overdue_Status Billed_Invoice; it does not send an external message.
- **Payment**: A ledger record linked to exactly one Invoice through `invoiceId`.
- **Payment_Proof**: Optional user-supplied evidence associated with one Payment, represented by proof metadata and a persisted file or stable local Attachment_Reference.
- **Attachment_Reference**: A stable, application-managed local path or reference that identifies a Payment_Proof when binary content cannot be safely stored in the Excel workbook.
- **Invoice_Ledger_Status**: A derived status for a Billed_Invoice: Outstanding_Status, Overdue_Status, or Received_Status, based on payments and due date.
- **Outstanding_Status**: The derived status for a not-fully-paid Billed_Invoice whose due date has not passed.
- **Overdue_Status**: The derived status for a not-fully-paid Billed_Invoice whose due date has passed.
- **Received_Status**: The derived status for a Billed_Invoice whose associated payments meet or exceed its computed total.
- **Invoice_Math_Module**: The existing calculation module exposing invoice totals, status, rollup, and amount-in-words functions.
- **AmountInWords_Module**: The existing module that converts a final rounded invoice total into its written-words representation.
- **Invoice_Document_Renderer**: The single shared renderer extracted from the existing InvoicePreview markup and used by creation preview, detail view, and print/download output.
- **InvoicePreview**: The existing Create_Invoice_Page preview component whose document markup is superseded by Invoice_Document_Renderer extraction.
- **Invoice_Detail_Page**: The canonical full-document page for one invoice, correcting the superseded summary-dashboard InvoicePage.
- **Payment_Receipt_View**: The real printable/viewable receipt document for one Payment.
- **Invoices_Page**: The invoice list page.
- **Invoice_Row**: One invoice entry rendered within Invoices_Page.
- **InvoiceNumberLink**: The shared navigation behavior for a clickable invoice number that opens the matching Invoice_Detail_Page.
- **LineItemEditor**: The Create_Invoice_Page editor for invoice line-item quantity and unit-price inputs.
- **Build_Toolchain**: The TypeScript and Vite project configuration used to type-check and build the Application.
- **Stabilization_Scope**: The requirements boundary governing this final stabilization pass.
- **Reports_Page**: The Reports page whose invoice-number cells require narrow linking corrections only.
- **Intelligence_Page**: The Intelligence page whose invoice-opening callback requires narrow canonical-navigation correction only.
- **CommandPalette**: The search palette whose invoice result action opens one matched invoice.
- **Create_Invoice_Page**: The page used to create or edit a Draft_Invoice and preview its document.
- **Workspace_Settings_Page**: The Settings page that exposes supported Regional Formatting preferences and canonical business-profile/logo controls.
- **AURA_Panel**: The existing floating assistant whose positioning may change, but whose intelligence and response behavior remain unchanged.
- **Targeted_Status_Label**: A visible Reports_Page or Intelligence_Page Pending/Collected label explicitly identified for correction; untargeted legacy labels remain governed by the previously approved terminology boundary.
- **Period_Comparison**: A displayed current-period versus prior-period label, value, or delta.

## Requirements

### Requirement 1: Preserve the existing architecture and scope boundary

**User Story:** As a maintainer, I want stabilization changes to use the existing frontend and FastAPI/openpyxl architecture, so that the application remains replaceable and does not acquire a second persistence system.

#### Acceptance Criteria

1. THE Application SHALL retrieve and persist domain data through the DataProvider boundary and its associated hooks.
2. THE Backend SHALL persist payment records through the existing FastAPI schemas, routes, services, and openpyxl workbook mechanism.
3. THE System SHALL NOT introduce SQLite or a second database for this feature.
4. THE Application SHALL NOT access workbook files, attachment files, or backend storage directly from a presentation component.
5. IF a required payment field is absent from the DataProvider or Backend contract, THEN THE System SHALL extend the existing contract and implementation rather than bypassing the contract.

### Requirement 2: Preserve invoice lifecycle and action semantics

**User Story:** As a billing user, I want billing, saving, downloading, sending, and reminders to have distinct effects, so that an invoice cannot change state accidentally.

#### Acceptance Criteria

1. WHEN a user confirms the Bill_Invoice_Action on a Draft_Invoice, THE System SHALL set `isDraft` to `false`.
2. WHEN a user confirms the Bill_Invoice_Action on a Draft_Invoice, THE System SHALL set `billedAt` to the current timestamp.
3. WHEN a user confirms the Bill_Invoice_Action on a Draft_Invoice, THE System SHALL leave `sentAt` unset unless it was already present.
4. WHEN a user saves a Draft_Invoice, THE System SHALL persist the invoice as editable and non-financial.
5. WHEN a user downloads a Draft_Invoice, THE System SHALL leave `isDraft` and `billedAt` unchanged.
6. WHILE an Invoice is a Draft_Invoice, THE System SHALL keep the Invoice editable regardless of elapsed time.
7. THE Create_Invoice_Page SHALL present “Bill invoice” as the finalization action and “Save as draft” as the non-finalizing persistence action.
8. WHILE an Invoice is a Billed_Invoice, THE Invoice_Detail_Page SHALL provide Send_Invoice_Action according to the existing confirmation flow.
9. WHEN a user confirms Send_Reminder_Action, THE System SHALL record a reminder activity without performing external message delivery.
10. WHEN a user cancels Send_Reminder_Action, THE System SHALL close the confirmation flow without recording a reminder activity.
11. THE System SHALL NOT assume whether a Billed_Invoice may be edited; billed-invoice editing remains an open business decision.

### Requirement 3: Derive invoice status from the payment ledger

**User Story:** As a billing user, I want invoice status to reflect recorded payments instead of a manual paid flag, so that displayed status matches the ledger.

#### Acceptance Criteria

1. THE Invoice_Math_Module SHALL compute Invoice_Ledger_Status from associated Payment amounts, the computed invoice total, and the invoice due date.
2. WHEN associated Payment amounts meet or exceed a Billed_Invoice total, THE Invoice_Math_Module SHALL return Received_Status.
3. WHEN associated Payment amounts are below a Billed_Invoice total and the due date has not passed, THE Invoice_Math_Module SHALL return Outstanding_Status.
4. WHEN associated Payment amounts are below a Billed_Invoice total and the due date has passed, THE Invoice_Math_Module SHALL return Overdue_Status.
5. THE Invoice_Math_Module SHALL NOT assign Invoice_Ledger_Status to a Draft_Invoice.
6. THE Invoices_Page SHALL NOT provide a Mark Paid action that changes status without creating a Payment.
7. THE Invoices_Page SHALL NOT provide a Duplicate action.
8. WHILE an Invoice_Row represents a Draft_Invoice, THE Invoices_Page SHALL show Edit and Bill invoice actions.
9. WHILE an Invoice_Row represents a Billed_Invoice, THE Invoices_Page SHALL show a View invoice action.
10. WHILE a Billed_Invoice has Outstanding_Status or Overdue_Status, THE Invoices_Page SHALL show Send reminder and Record payment actions.
11. WHILE a Billed_Invoice has Received_Status, THE Invoices_Page SHALL show payment or receipt access.

### Requirement 4: Apply approved financial terminology and exclude drafts

**User Story:** As a billing user, I want financial labels to distinguish Outstanding, Received, Total Billed, and workflow drafts, so that unfinished invoices do not appear as money owed or received.

#### Acceptance Criteria

1. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL use “Outstanding” for the core workflow state represented by Outstanding_Status.
2. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL use “Received” for the core workflow state represented by Received_Status.
3. THE core workflow pages SHALL NOT use “Pending” as a synonym for Outstanding_Status.
4. THE core workflow pages SHALL NOT use “Collected” as a synonym for Received_Status.
5. THE Clients_Page SHALL label its lifetime finalized-invoice value “Total Billed”.
6. THE Clients_Page SHALL NOT label an Outstanding value as “Total Billed”.
7. THE Overview_Page, Clients_Page, Client_Detail_Page, and Invoices_Page financial totals SHALL exclude Draft_Invoice records.
8. WHERE the Overview_Page displays Draft_Invoice records, THE Overview_Page SHALL display a workflow-state indicator rather than a financial amount.
9. THE Invoice_Math_Module SHALL provide the exclusive calculation source for displayed subtotal, taxable value, discount, CGST, SGST, round-off, grand total, received, outstanding, overdue, and billed rollup figures in this scope.
10. THE Clients_Page SHALL display total billed, and THE Client_Detail_Page SHALL display total billed, total received, total outstanding, and total overdue using Invoice_Math_Module rollups.

### Requirement 5: Correct the canonical invoice document experience

**User Story:** As a billing user, I want the invoice page to show the actual professional invoice document, so that viewing, printing, and downloading an invoice present the same document rather than a summary dashboard.

#### Acceptance Criteria

1. THE Invoice_Detail_Page SHALL render the full professional invoice document instead of the superseded InvoicePage summary dashboard.
2. THE Invoice_Document_Renderer SHALL display the supported invoice document fields: business identity, logo, address, email, GSTIN, PAN, Tax Invoice heading, invoice number, invoice and due dates, customer details, order/delivery details, line items, discount, CGST, SGST, round-off, grand total, amount in words, bank details, declaration/terms, and authorized signatory.
3. THE Invoice_Detail_Page SHALL display Invoice_Ledger_Status and payment history outside the primary invoice document area as supporting information.
4. THE Invoice_Detail_Page SHALL provide print/PDF, download, and back actions for a Billed_Invoice.
5. WHEN the displayed Invoice is a Draft_Invoice, THE Invoice_Detail_Page SHALL provide an action to continue editing it on the Create_Invoice_Page instead of billed-invoice actions.
6. THE System SHALL extract the existing InvoicePreview document markup into the Invoice_Document_Renderer.
7. THE InvoicePreview component SHALL consume the Invoice_Document_Renderer rather than maintain an independent copy of invoice document markup.
8. THE Invoice_Detail_Page SHALL compute displayed monetary values through Invoice_Math_Module functions.
9. THE Invoice_Document_Renderer SHALL preserve the existing supported CGST and SGST calculation behavior while IGST implementation is deferred under Requirement 16.

### Requirement 6: Use one shared renderer for preview, detail, and output

**User Story:** As a billing user, I want the live preview, detail page, and downloaded or printed invoice to match exactly, so that one invoice cannot have conflicting visual or monetary representations.

#### Acceptance Criteria

1. THE Create_Invoice_Page preview SHALL render through Invoice_Document_Renderer.
2. THE Invoice_Detail_Page SHALL render through Invoice_Document_Renderer.
3. THE Print/PDF and Download outputs SHALL render through Invoice_Document_Renderer or its existing output integration.
4. THE System SHALL NOT maintain a second independent invoice-document rendering implementation.
5. WHEN the same Invoice is rendered in preview, detail, and output, THE System SHALL display identical subtotal, taxable value, discount, CGST, SGST, round-off, grand total, and amount-in-words values.
6. THE System SHALL reuse the existing invoice download/export mechanism rather than introduce a parallel export path.
7. THE Create_Invoice_Page, Invoice_Detail_Page, and InvoicePreview source files SHALL not retain mojibake in shared document labels or symbols.

### Requirement 7: Provide a real payment receipt document

**User Story:** As a billing user, I want to open a professional receipt for one payment, so that I can verify and present payment evidence.

#### Acceptance Criteria

1. THE Payment_Receipt_View SHALL render a printable/viewable receipt document rather than a generic modal summary.
2. THE Payment_Receipt_View SHALL display a receipt or payment reference.
3. THE Payment_Receipt_View SHALL display the associated invoice number, customer name, payment date, amount received, payment method, transaction/reference information when present, and business details.
4. WHEN a user opens payment history on the Invoice_Detail_Page, THE System SHALL provide access to the associated Payment_Receipt_View.
5. WHEN a user selects a payment on the Payments_Page, THE System SHALL provide access to the associated Payment_Receipt_View.
6. THE Payment_Receipt_View SHALL display its associated invoice number as a canonical link to the Invoice_Detail_Page.

### Requirement 8: Persist optional payment proof with the exact payment

**User Story:** As a billing user, I want to attach optional proof to a payment and find the same proof after refresh or reopening, so that payment evidence stays with the correct ledger record.

#### Acceptance Criteria

1. THE Payments_Page SHALL allow a user to submit a Payment without Payment_Proof.
2. WHEN a user submits a Payment with Payment_Proof, THE System SHALL associate the proof with the exact Payment record identified by its payment identity and `invoiceId`.
3. THE DataProvider SHALL expose Payment_Proof metadata and its stable reference when a Payment is retrieved.
4. THE Backend SHALL persist Payment_Proof metadata through the existing FastAPI payment schema and route contract.
5. IF the Excel workbook cannot safely store Payment_Proof binary content, THEN THE Backend SHALL persist the binary content at an application-managed local location and SHALL store a stable Attachment_Reference associated with the exact Payment record in the existing workbook persistence.
6. WHEN a Payment with Payment_Proof is retrieved after a refresh, THE System SHALL return the same proof metadata and Attachment_Reference associated with that Payment.
7. WHEN a Payment with Payment_Proof is retrieved after the application is closed and reopened, THE System SHALL return the same proof metadata and Attachment_Reference associated with that Payment.
8. THE System SHALL NOT store Payment_Proof binary content or sensitive proof data in browser localStorage.
9. THE Payments_Page SHALL show the persisted proof state for a Payment without relying on transient component state.
10. THE System SHALL NOT create a second database or replace the existing FastAPI/openpyxl persistence to support Payment_Proof.
11. IF a Payment_Proof cannot be stored or retrieved, THEN THE System SHALL preserve the Payment record and display an actionable proof-specific error.

### Requirement 9: Complete payment records through the existing data boundary

**User Story:** As a billing user, I want payment records and their optional proof to be consistent across the UI and backend, so that the Payments module remains usable after the backend swap.

#### Acceptance Criteria

1. THE Payments_Page SHALL list payments retrieved through the DataProvider.
2. WHEN a user submits a valid payment, THE Payments_Page SHALL call the DataProvider payment-recording operation.
3. IF a payment is missing a required invoice, amount, or method, THEN THE Payments_Page SHALL show a field-level validation error and SHALL NOT record the Payment.
4. WHEN a Payment is recorded successfully, THE Payments_Page SHALL refresh its list from the DataProvider.
5. THE Payments_Page SHALL resolve and display the associated invoice number and client name through existing data hooks.
6. THE Payments_Page SHALL NOT hard-code demonstration Payment records in presentation components.
7. THE Payment type, frontend schemas, backend schemas/routes, and persistence representation SHALL represent optional Payment_Proof consistently.

### Requirement 10: Make invoice numbers universally canonical links

**User Story:** As a billing user, I want every invoice number to open the same invoice document, so that no screen routes me to an unrelated list or duplicate view.

#### Acceptance Criteria

1. THE Invoices_Page, Payments_Page, Clients_Page, Client_Detail_Page, Overview_Page, Reports_Page, Intelligence_Page, Payment_Receipt_View, and CommandPalette invoice results SHALL render invoice numbers as links to the matching Invoice_Detail_Page.
2. WHEN a user activates an invoice number in a Reports_Page invoice, outstanding, overdue, or payments table, THE Reports_Page SHALL navigate to the matching Invoice_Detail_Page.
3. WHEN Intelligence_Page invokes its openInvoice behavior, THE Intelligence_Page SHALL navigate to the matching Invoice_Detail_Page instead of the invoice list.
4. WHEN a user activates a CommandPalette invoice result, THE CommandPalette SHALL navigate to the matching Invoice_Detail_Page instead of a filtered invoice list.
5. THE System SHALL use the shared InvoiceNumberLink behavior wherever practical.
6. THE Reports_Page and Intelligence_Page changes SHALL be limited to invoice-number rendering/navigation and the targeted comparison/terminology corrections in Requirement 15.

### Requirement 11: Correct invoice numbering and draft behavior

**User Story:** As a billing user, I want invoice numbers to remain stable while drafts coexist with new invoices, so that existing records stay predictable and unique.

#### Acceptance Criteria

1. THE System SHALL retain an existing Draft_Invoice invoice number when another Invoice is created.
2. WHEN a user creates an Invoice while Draft_Invoice records exist, THE System SHALL assign the next unused incrementing invoice number.
3. THE System SHALL NOT reuse an assigned invoice number.
4. THE System SHALL NOT create two Invoices with the same invoice number.
5. THE System SHALL keep Draft_Invoice records editable after other Invoices are created.
6. THE System SHALL NOT prompt a user to finalize a Draft_Invoice solely because another Invoice was created.

### Requirement 12: Verify existing calculations without unnecessary rewrites

**User Story:** As a billing user, I want existing invoice calculations and amount-in-words output verified, so that stabilization does not introduce regressions into logic that already appears correct.

#### Acceptance Criteria

1. WHEN Invoice_Math_Module computes a taxable value of ₹25,700 with CGST 9%, SGST 9%, zero discount, and zero round-off, THE Invoice_Math_Module SHALL return CGST ₹2,313 and SGST ₹2,313.
2. WHEN Invoice_Math_Module computes the inputs in Acceptance Criterion 1, THE Invoice_Math_Module SHALL return a total of ₹30,326.
3. WHEN AmountInWords_Module converts ₹30,326, THE AmountInWords_Module SHALL return words corresponding to thirty thousand three hundred twenty-six rupees.
4. THE Invoice_Math_Module SHALL derive amount in words from the final rounded grand total.
5. THE System SHALL verify invoice-numbering and amount-in-words pipelines with tests before changing their implementation structure.
6. IF a verification test finds a defect in existing numbering or amount-in-words behavior, THEN THE System SHALL correct the defect at its root rather than add a compensating value elsewhere.
7. THE System SHALL preserve existing public calculation signatures when the verification tests pass.

### Requirement 13: Correct Create Invoice layout, field mapping, and numeric entry

**User Story:** As a billing user, I want the Create Invoice workspace to remain readable and predictable, so that I can edit fields and inspect the complete invoice without fighting nested scrolling or input artifacts.

#### Acceptance Criteria

1. THE Create_Invoice_Page SHALL preserve the established left-form/right-preview layout.
2. THE Create_Invoice_Page SHALL use one outer page scroll container for the form and preview content.
3. THE Create_Invoice_Page SHALL NOT create separate nested scrolling containers that prevent access to the complete form or preview.
4. WHILE the Create_Invoice_Page is displayed, THE System SHALL keep invoice tax values, totals, round-off, and document controls visible and readable without sticky-footer occlusion.
5. WHEN a user enters `supplierCode`, `poNumber`, `poDate`, or `transporter`, THE Invoice_Document_Renderer SHALL display the value under its matching order/delivery label.
6. WHERE all order/delivery fields are empty, THE Invoice_Document_Renderer SHALL omit the order/delivery block.
7. WHEN a user enters a numeric unit price or quantity, THE LineItemEditor SHALL display the entered value without an extraneous leading zero.
8. WHEN a user enters a decimal unit price, THE LineItemEditor SHALL preserve the decimal text during entry, including a trailing decimal point.
9. WHEN a user clears a numeric field and enters a new value, THE LineItemEditor SHALL not prepend digits from the previous value.

### Requirement 14: Keep AURA away from invoice content and controls

**User Story:** As a billing user, I want AURA to remain available without covering invoice content or actions, so that I can read and operate the invoice at all times.

#### Acceptance Criteria

1. THE AURA_Panel SHALL NOT overlap invoice totals, tax values, payment information, important table rows, sticky footers, or document controls.
2. WHILE the Create_Invoice_Page or Invoice_Detail_Page has sticky controls, THE AURA_Panel SHALL use a footer-aware bottom offset.
3. WHILE a page has no sticky footer or protected invoice content, THE AURA_Panel SHALL retain its established fixed bottom-right behavior.
4. THE System SHALL NOT change AURA response content, classification, or intelligence behavior.

### Requirement 15: Apply targeted Reports/Intelligence terminology and comparison corrections

**User Story:** As a billing user, I want explicitly identified misleading labels and period comparisons corrected without a Reports or Intelligence redesign, so that displayed context matches the existing data.

#### Acceptance Criteria

1. WHERE a Reports_Page or Intelligence_Page Targeted_Status_Label represents Outstanding_Status, THE page SHALL display “Outstanding” instead of “Pending”.
2. WHERE a Reports_Page or Intelligence_Page Targeted_Status_Label represents Received_Status, THE page SHALL display “Received” instead of “Collected”.
3. WHERE a Reports_Page or Intelligence_Page displays a Period_Comparison, THE page SHALL identify the current period and prior period with their correct labels.
4. WHERE a Reports_Page or Intelligence_Page displays a Period_Comparison delta, THE page SHALL associate the delta with the stated current and prior periods in the correct direction.
5. THE Reports_Page and Intelligence_Page SHALL preserve existing metrics, filters, classifications, and data sources while applying the targeted corrections.
6. THE Reports_Page and Intelligence_Page SHALL retain untargeted legacy labels when no explicit correction target applies, preserving the prior terminology boundary.

### Requirement 16: Defer IGST implementation as an explicit product decision

**User Story:** As a product owner, I want the absence of IGST support recorded explicitly, so that the stabilization pass does not invent tax rules or create inconsistent frontend/backend data.

#### Acceptance Criteria

1. THE Stabilization_Scope SHALL defer IGST tax rules, frontend model fields, backend schema fields, calculation behavior, export behavior, and persistence behavior to a future business/product/data-model decision.
2. THE System SHALL NOT invent an IGST rate, split rule, eligibility rule, or calculation formula in this stabilization pass.
3. THE System SHALL NOT add a partial IGST representation that cannot persist consistently through the DataProvider, FastAPI, and openpyxl paths.
4. THE Invoice_Math_Module, Invoice_Document_Renderer, and export path SHALL preserve verified CGST/SGST behavior while IGST remains deferred.
5. WHEN a future approved decision defines IGST behavior, THE System SHALL address frontend types, backend schemas, calculations, exports, persistence, and document rendering as one coordinated change.

### Requirement 17: Remove unsupported Regional Formatting controls and clean up Settings/logo presentation

**User Story:** As a business administrator, I want Workspace Settings to expose supported Regional Formatting preferences and a consistent business logo, so that configuration remains practical and the invoice identity is not duplicated or stale.

#### Acceptance Criteria

1. IF a Regional Formatting control is not backed by a supported application preference, THEN THE Workspace_Settings_Page SHALL remove the control.
2. THE Workspace_Settings_Page SHALL display only supported Regional Formatting preferences with existing application behavior.
3. THE Workspace_Settings_Page SHALL present one canonical business-logo configuration and preview sourced from the business profile.
4. WHEN the configured business logo is rendered in Settings or Invoice_Document_Renderer, THE System SHALL use the same canonical business-profile value.
5. IF duplicate, stale, or placeholder logo presentation exists in the Settings surface, THEN THE Workspace_Settings_Page SHALL show the canonical logo presentation without the duplicate or stale presentation.
6. THE System SHALL limit Settings/logo changes to cleanup and consistency and SHALL NOT perform an unrelated branding redesign.

### Requirement 18: Remove mojibake from the production interface

**User Story:** As a billing user, I want punctuation, currency symbols, and status text to render correctly, so that the product looks professional and the invoice is legible.

#### Acceptance Criteria

1. THE Create_Invoice_Page, InvoicePreview, Invoice_Document_Renderer, Payment_Receipt_View, and Workspace_Settings_Page source SHALL not contain mojibake sequences such as `Â·`, `â€”`, `â€¦`, `âˆ’`, or `Â§` where valid Unicode characters are intended.
2. THE System SHALL render the intended Unicode middle dot, em dash, ellipsis, minus sign, rupee sign, arrow, check icon, or apostrophe at each corrected location.
3. THE production user interface SHALL not display mojibake sequences.

### Requirement 19: Validate the application build and layering

**User Story:** As a developer, I want the canonical application to type-check and build without suppressions, so that stabilization fixes do not hide defects.

#### Acceptance Criteria

1. WHEN a developer runs `tsc -b` for the Application, THE Build_Toolchain SHALL report zero TypeScript errors.
2. THE Build_Toolchain SHALL resolve `node:path` and `__dirname` typing through correct Node type support rather than `@ts-ignore`, `@ts-nocheck`, or unnecessary `any` annotations.
3. THE Build_Toolchain SHALL resolve the `tsconfig.node.json` emit conflict through project configuration rather than disabling type checking.
4. THE Application's modified pages SHALL continue to depend on hooks, domain types, and the DataProvider rather than direct storage access.
5. THE Application SHALL not reintroduce the phase1 direct appStore mutation pattern for invoice, client, payment, or proof data.

## Out of Scope

- Any application-code implementation during this requirements phase.
- A second database, SQLite, or a replacement for FastAPI/openpyxl persistence.
- AURA intelligence, classification, response content, or response design changes.
- Reports_Page or Intelligence_Page redesign, metric redesign, filter redesign, classification redesign, or data-source changes; only the exact invoice-number, targeted terminology, and period-comparison corrections are in scope.
- Selection of an external communication channel or integration for Send_Invoice_Action or Send_Reminder_Action.
- Unrestricted editing rules for Billed_Invoice records.
- IGST tax rules or data-model implementation until a future business/product/data-model decision.
- Unrelated branding, visual-identity, authentication, access-control, or Tauri packaging work.
- Rewriting verified invoice-numbering or amount-in-words pipelines without a failing verification test.

## Open Questions / Contradictions

The following items remain explicit rather than being silently resolved:

1. **OPEN — Billed-invoice editing.** The requirements preserve indefinite Draft_Invoice editing but do not decide whether or how a Billed_Invoice may be edited. A business/product decision is required before any billed-edit workflow is designed.
2. **OPEN — External communication channel.** Send_Invoice_Action and Send_Reminder_Action remain record/confirm-only. Email, WhatsApp, or another channel is not selected, and no external messaging integration is authorized by this document.
3. **OPEN — Reports/Intelligence financial-figure routing.** Universal invoice-number links are approved, but whether every Reports_Page, Intelligence_Page, or AURA financial figure must be routed through Invoice_Math_Module remains a separate design decision. The narrow corrections in Requirement 15 do not resolve that question.
4. **OPEN — Other unresolved product decisions.** Any business or product decision not explicitly resolved by this document remains open and SHALL NOT be inferred during design or implementation.
5. **RESOLVED CONTRADICTION — IGST.** Earlier approved language enumerated IGST among invoice figures, but inspection found no current frontend/backend model, calculation, or export path for IGST. This pass explicitly defers IGST implementation rather than inventing tax behavior; the earlier IGST implementation expectation is superseded only to that extent.
6. **RESOLVED CONTRADICTION — Settings scope.** Earlier scope language excluded Workspace Settings, while the current correction request explicitly requires removing unnecessary or unsupported Regional Formatting controls, retaining useful supported preferences, and cleaning up logo presentation. Requirement 17 is the narrow approved exception; unrelated Settings or branding redesign remains out of scope.
7. **RESOLVED CONTRADICTION — Reports/Intelligence terminology.** Earlier language retained existing Pending/Paid terminology on Reports and Intelligence, while the correction request identifies specific visible Pending/Collected labels for correction. Requirement 15 changes only the explicitly targeted labels and leaves untargeted legacy labels unchanged.
8. **RESOLVED STORAGE BOUNDARY — Payment proof binary.** Payment proof remains optional and uses the existing FastAPI/openpyxl architecture. If Excel cannot safely store binary content, a stable application-managed Attachment_Reference is required; no second database is introduced.
