# Requirements Document

## Introduction

This spec covers targeted changes to the core invoicing workflow of the SFT Billing frontend (`sft-billing-phase2.2-gst/sft-billing/src`). Today, "Create Invoice" conflates finalizing an invoice with emailing it, invoice payment status is set manually via a "Mark Paid" button, there is no dedicated invoice detail/view page, and the Clients/Client Detail pages show limited rollups. This feature separates **billing** (moving an invoice from Draft to Billed) from **sending** (emailing an already-billed invoice), removes manual payment marking in favor of ledger-derived status, removes the Duplicate action, renames "pending"/"paid" terminology to "outstanding"/"received" across the core workflow, and introduces a new Invoice Detail page and Payment Receipt view reachable from clickable invoice numbers throughout the app. Clients and Client Detail pages gain new financial rollups. All financial calculations continue to route through a single calculation layer (`lib/invoiceMath.ts`), extended with new rollup helpers, and drafts remain excluded from all financial totals.

This spec is scoped to the core business workflow only. AURA, Intelligence, Reports, Workspace Settings, authentication/login, branding, Tauri packaging, the backend `InvoiceStatus` enum, and invoice export/PDF are explicitly out of scope except where a targeted correction below strictly requires reusing an existing mechanism (see Amendment Log). No architectural rewrite is intended — only the targeted changes described below.

## Amendment Log (Correction Pass)

This document was amended after the client reviewed the running application. The correction pass is **documentation-only**: no implementation change is authorized by the amendments below until a corresponding design/tasks update is produced in a later step. The following changes were made to the original requirements above:

- **Second correction pass** (explicit business decisions on the three Open Questions): Requirement 16 is rewritten from an open question into an approved, resolved requirement — Reports_Page and Intelligence_Page invoice-number rendering is now explicitly in scope for linking only (no other Reports/Intelligence logic changes), and command-palette invoice search results now navigate to the specific invoice. The "Out of Scope" section gained an explicit carve-out for this narrow rendering/navigation change. In "Open Questions / Contradictions", item 1 (Reports/Intelligence linking) is marked RESOLVED; item 2 (billed invoice editing) and item 3 (delivery channel) are reconfirmed as deliberately OPEN with no assumed behavior; item 4 (Requirement 9.6 figure-routing tension) remains OPEN, as it addresses a distinct concern (routing financial figures through the calculation layer) not settled by this pass.

- **Superseded — Requirement 5**: The original Invoice_Detail_Page definition (computed-totals cards + Invoice_Ledger_Status + payment history as the primary experience) is corrected. The client confirmed the already-built `InvoicePage.tsx` financial-summary/dashboard design is wrong. Requirement 5 below is rewritten so the Invoice_Detail_Page renders the full invoice document (reusing the existing `InvoicePreview.tsx` rendering/calculation), with status and payment history demoted to secondary, supporting information.
- **Amended — Requirement 2**: row-action ACs extended to explicitly cover Received_Status and Overdue_Status rows.
- **Amended — Requirement 3**: added an explicit constraint that Draft_Invoice records never receive an Invoice_Ledger_Status value.
- **Amended — Requirement 6**: Payment_Receipt_View definition strengthened to require a real printable/viewable receipt document with business details, not a generic summary card.
- **Amended — Requirement 7**: added an explicit constraint that "Total Billed" is not replaced with, or conflated with, Outstanding.
- **Amended — Requirement 9**: broadened the list of figures that must route through the Invoice_Math_Module to explicitly include IGST and to address AURA/Reports/Intelligence reuse.
- **Amended — Requirement 10**: added explicit prohibition of "Pending" as a synonym for Outstanding, "Collected" as a synonym for Received, and Draft_Invoice ever being presented as a financial amount.
- **Amended — Requirement 11**: added an explicit constraint that Overview_Page must not present a separate "Pending" financial metric, and that Draft may appear only as a workflow-state indicator.
- **Added — Requirement 12**: single invoice-rendering source shared by Create Invoice preview, Invoice_Detail_Page, and downloads/print.
- **Added — Requirement 13**: Create Invoice preview visibility/responsiveness fix.
- **Added — Requirement 14**: AURA positioning extension so AURA never overlaps invoice financial content or controls (reuses existing sticky-footer-avoidance mechanism; no AURA intelligence redesign).
- **Added — Requirement 15**: character-encoding (mojibake) correction in source files.
- **Added — Requirement 16**: universal canonical invoice-number linking across all list/detail surfaces (extends Requirement 5.8).
- **Added — Requirement 17**: invoice numbering stability when drafts coexist with newly created invoices.
- **Added — Requirement 18**: drafts remain editable indefinitely with no forced finalization or reminder nagging.
- **Added — Requirement 19**: amount-in-words must always derive from the final rounded grand total, enumerated across specific test scenarios.
- **Added — Requirement 20**: Create Invoice action hierarchy (Bill Invoice / Save as Draft / Download) and their effect on lifecycle state.
- **Open questions**: see "Open Questions / Contradictions" at the end of this document. These are deliberately left unresolved rather than silently decided.

## Glossary

- **Invoice**: A billing record represented by the `Invoice` type in `src/types/invoice.ts`, holding line items, GST, discount, round-off, and lifecycle markers (`isDraft`, `billedAt`, `sentAt`, `paidAt` legacy field, `viewedAt`).
- **Draft_Invoice**: An `Invoice` where `isDraft` is `true`. Not yet billed; excluded from all financial totals and rollups.
- **Billed_Invoice**: An `Invoice` where `isDraft` is `false` and `billedAt` is set. Included in financial totals.
- **Bill_Invoice_Action**: The action that transitions a `Draft_Invoice` to a `Billed_Invoice` by setting `billedAt` to the current timestamp and `isDraft` to `false`. Does not send an email.
- **Send_Invoice_Action**: The action that emails a `Billed_Invoice` to its client and sets `sentAt` to the current timestamp. Only available for `Billed_Invoice` records.
- **Send_Reminder_Action**: The action that records a reminder event for an outstanding or overdue `Billed_Invoice`, presented through a confirm/edit/cancel modal. Does not perform real email delivery.
- **Record_Payment_Action**: The existing action that creates a `Payment` record against a `Billed_Invoice`.
- **Payment**: A ledger entry represented by the `Payment` type in `src/types/payment.ts`, linked to an invoice via `invoiceId`.
- **Invoice_Ledger_Status**: The derived status of a `Billed_Invoice`, computed from the sum of its associated `Payment` amounts compared to its computed total, and from its due date. One of `Outstanding`, `Overdue`, or `Received`.
- **Received_Status**: The `Invoice_Ledger_Status` value applied when the sum of a `Billed_Invoice`'s payments is greater than or equal to its computed total.
- **Outstanding_Status**: The `Invoice_Ledger_Status` value applied when a `Billed_Invoice` is not fully paid and its due date has not passed.
- **Overdue_Status**: The `Invoice_Ledger_Status` value applied when a `Billed_Invoice` is not fully paid and its due date has passed.
- **Invoice_Math_Module**: The calculation layer at `src/lib/invoiceMath.ts`, exposing `computeInvoiceTotals`, `getInvoiceTotalsWithWords`, `getInvoiceStatus`, and the new rollup helpers introduced by this feature.
- **Client_Rollup**: Aggregated financial figures for a client — total billed, total received, total outstanding, and total overdue — computed by the Invoice_Math_Module from that client's `Billed_Invoice` records and associated `Payment` records.
- **Invoice_Detail_Page**: The page (correcting the previously-built `pages/InvoicePage.tsx`) that displays the full invoice document for a single invoice — reusing the Invoice_Document_Renderer — with its `Invoice_Ledger_Status` and payment history presented as secondary, supporting information alongside document actions (`Send_Invoice_Action`, `Send_Reminder_Action`, `Record_Payment_Action`, Print/PDF, Download, Back).
- **Invoice_Document_Renderer**: The single rendering/calculation component, based on the existing `components/create-invoice/InvoicePreview.tsx`, that renders the full invoice document (business identity block, "Tax Invoice" heading, invoice number/dates, bill-to block, order/delivery details where available, line items table, taxable value/discount/CGST/SGST/IGST/round-off/grand total, amount in words, bank details, declaration/terms, authorized signatory). The Create_Invoice_Page preview, the Invoice_Detail_Page, and any print/PDF/download output SHALL all use the Invoice_Document_Renderer as their rendering source.
- **Payment_Receipt_View**: A view reachable from an invoice's payment history or the Payments list that displays a single `Payment` as a real printable/viewable receipt document, not a generic summary card.
- **AURA_Panel**: The existing floating assistant component at `components/aura/AuraPanel.tsx`, which repositions itself via a `PAGES_WITH_STICKY_FOOTER` page list and a `bottomOffsetClass` (`bottom-24` vs `bottom-6`) to avoid overlapping a page's sticky footer.
- **Invoices_Page**: The existing invoice list page at `src/pages/InvoicesPage.tsx`.
- **Invoice_Row**: A single row rendered by `src/components/invoices/InvoiceRow.tsx` within the Invoices_Page.
- **Create_Invoice_Page**: The existing page at `src/pages/CreateInvoicePage.tsx` used to build a new or edit an existing `Draft_Invoice`.
- **Clients_Page**: The existing client list page at `src/pages/ClientsPage.tsx`.
- **Client_Detail_Page**: The existing per-client page at `src/pages/ClientDetailPage.tsx`.
- **Overview_Page**: The existing dashboard page at `src/pages/OverviewPage.tsx`.
- **Payments_Page**: The existing payment list page at `src/pages/PaymentsPage.tsx`.
- **Confirm_Modal_Pattern**: The existing reusable modal composition (`Modal` component with title, body text, and a footer containing a Cancel button and a primary Confirm button) already used for the invoice-send confirmation.

## Requirements

### Requirement 1: Separate Bill Invoice action from Send Invoice action

**User Story:** As a billing user, I want to finalize an invoice as "billed" without necessarily emailing it, so that I can record billed revenue immediately while choosing when, or whether, to send the invoice to the client.

#### Acceptance Criteria

1. WHEN a user activates the Bill_Invoice_Action on a Draft_Invoice, THE Create_Invoice_Page SHALL set `isDraft` to `false` and `billedAt` to the current timestamp on that invoice.
2. WHEN a user activates the Bill_Invoice_Action on a Draft_Invoice, THE Create_Invoice_Page SHALL NOT set `sentAt` on that invoice.
3. THE Invoice type SHALL define a `billedAt` field distinct from `sentAt`, representing the moment an invoice transitioned from Draft_Invoice to Billed_Invoice.
4. THE Create_Invoice_Page SHALL replace its primary "Send invoice" button with a "Bill invoice" button.
5. WHEN a user clicks the "Bill invoice" button on the Create_Invoice_Page, THE Create_Invoice_Page SHALL open the Confirm_Modal_Pattern retitled for billing confirmation, without wording implying an email will be sent.
6. WHEN a user confirms billing in the retitled Confirm_Modal_Pattern, THE Create_Invoice_Page SHALL perform the Bill_Invoice_Action and navigate back to the Invoices_Page.
7. THE Send_Invoice_Action SHALL be available only on the Invoice_Detail_Page for a Billed_Invoice, and SHALL NOT be available on the Create_Invoice_Page.
8. WHEN a user activates the Send_Invoice_Action on a Billed_Invoice, THE Invoice_Detail_Page SHALL set `sentAt` to the current timestamp without modifying `billedAt`.
9. IF a Billed_Invoice already has `sentAt` set, THEN THE Invoice_Detail_Page SHALL present a "Resend invoice" affordance in place of the initial send affordance.

### Requirement 2: Invoices Page row actions reflect draft vs billed state

**User Story:** As a billing user, I want the actions shown on each invoice row to match whether that invoice is a draft or already billed, so that I only see actions that are valid for that invoice's state.

#### Acceptance Criteria

1. WHILE an Invoice_Row represents a Draft_Invoice, THE Invoices_Page SHALL present only "Edit" and "Bill invoice" actions on that row.
2. WHILE an Invoice_Row represents a Billed_Invoice, THE Invoices_Page SHALL present a "View" action that opens the Invoice_Detail_Page for that invoice.
3. WHILE an Invoice_Row represents a Billed_Invoice whose `sentAt` is not set, THE Invoices_Page SHALL present a "Send invoice" action on that row.
4. WHILE an Invoice_Row represents a Billed_Invoice with Invoice_Ledger_Status equal to Outstanding_Status or Overdue_Status, THE Invoices_Page SHALL present a "Send reminder" action on that row.
5. WHILE an Invoice_Row represents a Billed_Invoice with Invoice_Ledger_Status not equal to Received_Status, THE Invoices_Page SHALL present a "Record payment" action on that row.
6. WHILE an Invoice_Row represents a Billed_Invoice with Invoice_Ledger_Status equal to Received_Status, THE Invoices_Page SHALL present a "View invoice" action and appropriate payment/receipt access on that row.
7. WHILE an Invoice_Row represents a Billed_Invoice with Invoice_Ledger_Status equal to Overdue_Status, THE Invoices_Page SHALL present "View invoice", "Send reminder", and "Record payment" actions on that row.
8. THE Invoices_Page SHALL NOT present a "Mark paid" action on any Invoice_Row.
9. THE Invoices_Page SHALL NOT present a "Duplicate" action on any Invoice_Row.
10. THE Invoices_Page SHALL NOT present a "Duplicate" action anywhere else in its interface.
11. THE Invoices_Page SHALL NOT reintroduce a "Duplicate" action in any future state of its interface.

### Requirement 3: Ledger-derived invoice status replaces manual Mark Paid

**User Story:** As a billing user, I want an invoice's paid/outstanding status to be calculated automatically from recorded payments, so that the displayed status can never drift from the actual payment ledger.

#### Acceptance Criteria

1. THE Invoice_Math_Module SHALL compute the Invoice_Ledger_Status of a Billed_Invoice by comparing the sum of its associated Payment amounts against its computed total from `computeInvoiceTotals`.
2. WHEN the sum of a Billed_Invoice's associated Payment amounts is greater than or equal to its computed total, THE Invoice_Math_Module SHALL report Invoice_Ledger_Status as Received_Status.
3. WHEN the sum of a Billed_Invoice's associated Payment amounts is less than its computed total and its due date has not passed, THE Invoice_Math_Module SHALL report Invoice_Ledger_Status as Outstanding_Status.
4. WHEN the sum of a Billed_Invoice's associated Payment amounts is less than its computed total and its due date has passed, THE Invoice_Math_Module SHALL report Invoice_Ledger_Status as Overdue_Status.
5. THE Invoice_Math_Module SHALL report Invoice_Ledger_Status independently of any manually set "paid" flag.
6. THE Invoices_Page, Invoice_Detail_Page, Client_Detail_Page, Clients_Page, and Overview_Page SHALL display invoice status exclusively through Invoice_Math_Module's derived Invoice_Ledger_Status computation.
7. THE Invoices_Page SHALL NOT provide a manual action that directly sets an invoice as paid without an associated Payment record.
8. THE Invoice_Math_Module SHALL NOT assign a Received_Status, Outstanding_Status, or Overdue_Status value to a Draft_Invoice.

### Requirement 4: Bill invoice, Send Invoice, and Send Reminder use consistent confirmation modals

**User Story:** As a billing user, I want the "Bill invoice", "Send invoice", and "Send reminder" actions to ask for confirmation the same way, so that the interface feels consistent and I do not accidentally trigger irreversible actions.

#### Acceptance Criteria

1. WHEN a user activates the Send_Reminder_Action from the Invoices_Page or Invoice_Detail_Page, THE System SHALL open a modal following the Confirm_Modal_Pattern allowing the user to review reminder content, edit it, confirm sending, or cancel.
2. WHEN a user confirms the Send_Reminder_Action in its modal, THE System SHALL record a reminder activity event without performing real email delivery.
3. WHEN a user cancels the Send_Reminder_Action modal, THE System SHALL close the modal without recording a reminder activity event.
4. THE Send_Invoice_Action confirmation modal on the Invoice_Detail_Page SHALL follow the Confirm_Modal_Pattern already used for invoice actions.

### Requirement 5: Invoice Detail page renders the full invoice document, not a summary dashboard [SUPERSEDES prior version]

**User Story:** As a billing user, I want to open a dedicated page for a single invoice that shows the actual invoice document, so that what I view matches what was billed, sent, printed, and downloaded, and I am not shown a generic summary dashboard instead of the invoice itself.

#### Acceptance Criteria

1. THE System SHALL provide an Invoice_Detail_Page reachable by clicking an invoice number.
2. THE Invoice_Detail_Page SHALL render the full invoice document via the Invoice_Document_Renderer, displaying at minimum: business logo, business name, business address, business email, business GSTIN, business PAN, a "Tax Invoice" heading, invoice number, invoice date, due date, customer name, customer address, customer email, customer GSTIN, purchase order/order/delivery details where available on the invoice, the complete line items table (description, HSN, quantity, rate, taxable value per line), discount, CGST, SGST, and IGST where applicable, round off, grand total, amount in words, bank details, declaration/terms, and authorized signatory.
3. THE Invoice_Detail_Page SHALL compute every displayed monetary figure via `computeInvoiceTotals` or `getInvoiceTotalsWithWords` from the Invoice_Math_Module, matching the figures shown by the Create_Invoice_Page preview for the same invoice.
4. THE Invoice_Detail_Page SHALL display the invoice's Invoice_Ledger_Status and payment history as secondary, supporting information positioned outside the primary invoice document area, not as the primary content of the page.
5. THE Invoice_Detail_Page SHALL NOT replace the full invoice document with a summary-card layout (status chip, total-due card, and a subtotal/tax/discount/round-off grid in place of the actual document) as its primary content.
6. WHERE a Payment record associated with the displayed invoice exists, THE Invoice_Detail_Page SHALL allow the user to open the Payment_Receipt_View for that Payment record.
7. WHILE the displayed invoice is a Billed_Invoice, THE Invoice_Detail_Page SHALL present the Send_Invoice_Action, Send_Reminder_Action (when Invoice_Ledger_Status is Outstanding_Status or Overdue_Status), Record_Payment_Action (when Invoice_Ledger_Status is not Received_Status), a Print/PDF action, a Download action, and a Back action.
8. IF the displayed invoice is a Draft_Invoice, THEN THE Invoice_Detail_Page SHALL present an action to continue editing that draft on the Create_Invoice_Page instead of the billed-invoice actions.
9. THE Overview_Page, Clients_Page, Client_Detail_Page, Invoices_Page, and Payments_Page SHALL render each invoice number as a clickable link that navigates to the Invoice_Detail_Page for that invoice.

### Requirement 6: New Payment Receipt view

**User Story:** As a billing user, I want to view a single payment as a receipt, so that I can confirm the details of a specific payment against an invoice.

#### Acceptance Criteria

1. THE System SHALL provide a Payment_Receipt_View that renders a real printable/viewable receipt document containing a receipt/payment reference, the associated invoice number, customer name, payment date, amount received, payment method, transaction/reference information where available, and business details.
2. THE Payment_Receipt_View SHALL NOT render as a generic summary card in place of the receipt document described in Acceptance Criterion 1.
3. THE Payment_Receipt_View SHALL be reachable from the Invoice_Detail_Page's payment history.
4. THE Payment_Receipt_View SHALL be reachable from the Payments_Page.
5. THE Payment_Receipt_View SHALL display the associated invoice number as a clickable link that navigates to the Invoice_Detail_Page for that invoice.

### Requirement 7: Clients Page shows Total Billed instead of Since

**User Story:** As a billing user, I want to see how much a client has been billed directly in the client list, so that I can gauge client value without opening each client's detail page.

#### Acceptance Criteria

1. THE Clients_Page SHALL replace its "Since" column with a "Total Billed" column.
2. THE Clients_Page SHALL compute each client's "Total Billed" value using a Client_Rollup helper from the Invoice_Math_Module, representing lifetime billed/finalized invoice value.
3. THE Clients_Page SHALL exclude Draft_Invoice records from each client's "Total Billed" value.
4. THE Clients_Page SHALL NOT display an Outstanding value in place of, or labeled as, "Total Billed".
5. THE Clients_Page SHALL render each row's client name or invoice count such that the client's invoices remain reachable, while invoice numbers shown anywhere on the page remain clickable links to the Invoice_Detail_Page per Requirement 5.

### Requirement 8: Client Detail Page shows financial rollups and clickable invoice history

**User Story:** As a billing user, I want to see a client's billed, received, outstanding, and overdue totals on their detail page, so that I understand that client's financial standing at a glance.

#### Acceptance Criteria

1. THE Client_Detail_Page SHALL display a Client_Rollup showing total billed, total received, total outstanding, and total overdue amounts for the selected client.
2. THE Client_Detail_Page SHALL compute the Client_Rollup using rollup helpers exposed by the Invoice_Math_Module.
3. THE Client_Detail_Page SHALL exclude Draft_Invoice records from every value in the Client_Rollup.
4. THE Client_Detail_Page SHALL render each invoice number in the client's invoice history as a clickable link that navigates to the Invoice_Detail_Page for that invoice.

### Requirement 9: Single calculation layer reuse for all new financial figures

**User Story:** As a developer maintaining this codebase, I want every new financial figure to come from the same calculation layer as existing figures, so that totals, rollups, and statuses can never disagree with each other across pages.

#### Acceptance Criteria

1. THE Invoice_Math_Module SHALL expose rollup helper functions used by the Clients_Page and Client_Detail_Page to compute Client_Rollup values.
2. THE Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Invoices_Page, and Overview_Page SHALL compute invoice totals exclusively via `computeInvoiceTotals` or `getInvoiceTotalsWithWords` from the Invoice_Math_Module.
3. THE Invoice_Math_Module's rollup helpers and Invoice_Ledger_Status computation SHALL exclude Draft_Invoice records from all summed or aggregated financial figures.
4. THE System SHALL NOT introduce a second implementation of invoice total, rollup, or status computation outside the Invoice_Math_Module.
5. THE Invoice_Math_Module SHALL be the exclusive source of subtotal, taxable value, discount, CGST, SGST, IGST, round off, grand total, received, outstanding, overdue, client total billed, and global total billed figures wherever those figures are displayed within the scope defined by this document.
6. WHERE Reports_Page, Intelligence_Page, or AURA_Panel already display a financial figure covered by Acceptance Criterion 5, THE System SHALL route that figure through the Invoice_Math_Module only where doing so does not require modifying Reports_Page or Intelligence_Page logic beyond swapping in the shared calculation call (see Open Questions / Contradictions).

### Requirement 10: Core-workflow terminology rename from pending/paid to outstanding/received

**User Story:** As a billing user, I want the core invoicing screens to use the terms "Outstanding" and "Received" instead of "Pending" and "Paid", so that the language matches how the business actually talks about invoice states.

#### Acceptance Criteria

1. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL display the label "Outstanding" wherever an invoice's `pending` status was previously labeled "Pending".
2. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL display the label "Received" wherever an invoice's `paid` status was previously labeled "Paid".
3. THE Reports_Page, Intelligence_Page, Workspace_Settings_Page, and AURA interface SHALL retain their existing "Pending"/"Paid" terminology unchanged.
4. THE underlying `InvoiceStatus` type value `"pending"` SHALL remain a valid internal status value distinct from any renamed user-facing label, so that Reports, Intelligence, and AURA continue to function without modification.
5. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL NOT use the label "Pending" as a synonym for Outstanding_Status anywhere in the core workflow.
6. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL NOT use the label "Collected" as a synonym for Received_Status.
7. THE Overview_Page, Invoices_Page, Invoice_Detail_Page, Clients_Page, Client_Detail_Page, Payments_Page, and Create_Invoice_Page SHALL NOT present a Draft_Invoice's status label as, or alongside, a financial amount.

### Requirement 11: Drafts excluded from all financial totals

**User Story:** As a billing user, I want invoices that are still drafts to never count toward billed, received, or outstanding totals, so that unfinished work-in-progress invoices cannot distort reported figures.

#### Acceptance Criteria

1. THE Overview_Page SHALL exclude Draft_Invoice records from every financial total and metric it displays.
2. THE Clients_Page and Client_Detail_Page SHALL exclude Draft_Invoice records from every Client_Rollup value.
3. THE Invoices_Page SHALL exclude Draft_Invoice records from any aggregate financial figures it displays.
4. IF a Draft_Invoice is later billed via the Bill_Invoice_Action, THEN THE Invoice_Math_Module SHALL include that invoice in financial totals from that point forward.
5. THE Overview_Page SHALL NOT present a separate "Pending" financial metric distinct from Outstanding_Status and Overdue_Status totals.
6. WHERE the Overview_Page displays Draft_Invoice records, THE Overview_Page SHALL present them only as a workflow-state indicator (for example, a count) and SHALL NOT present a Draft_Invoice-derived value as a financial amount.

### Requirement 12: Single invoice-rendering source across preview, detail, and downloads

**User Story:** As a billing user, I want the invoice I see while creating it, the invoice I view later, and the invoice I download or print, to always be the exact same document with the exact same numbers, so that I never have to reconcile conflicting versions of the same invoice.

#### Acceptance Criteria

1. THE Create_Invoice_Page preview, the Invoice_Detail_Page, and any Print/PDF or Download output SHALL render an invoice through the Invoice_Document_Renderer, sharing the same underlying invoice data and Invoice_Math_Module calculations.
2. THE System SHALL NOT maintain a second, independent visual rendering of an invoice document outside the Invoice_Document_Renderer.
3. WHEN an invoice is rendered by the Create_Invoice_Page preview, the Invoice_Detail_Page, and a Download/Print action for the same invoice, THE System SHALL display numerically identical subtotal, taxable value, discount, CGST, SGST, IGST, round off, grand total, and amount-in-words values across all three.
4. THE Download action on the Invoice_Detail_Page and Create_Invoice_Page SHALL reuse the existing download mechanism (`components/create-invoice/DownloadInvoiceButton.tsx` and `services/invoiceExportService`) rather than introducing a new print/PDF mechanism, unless no equivalent mechanism exists for a required output format.

### Requirement 13: Create Invoice preview remains fully visible and readable

**User Story:** As a billing user, I want the live invoice preview while creating an invoice to stay fully visible, so that I can verify tax and total values before billing without scrolling past a cut-off preview.

#### Acceptance Criteria

1. THE Create_Invoice_Page SHALL preserve its existing left-form/right-preview layout split.
2. THE Create_Invoice_Page SHALL render its invoice preview such that tax values, totals, and round-off figures are not hidden or cut off by the page's sticky footer.
3. THE Create_Invoice_Page SHALL render its invoice preview at a size that keeps invoice text readable, and SHALL NOT shrink the preview to a size where line items or totals become illegible in order to fit the available space.

### Requirement 14: AURA panel avoids invoice financial content and controls

**User Story:** As a billing user, I want the AURA assistant panel to never sit on top of invoice totals, tax values, or action buttons, so that I can always read and interact with invoice content without having to move or dismiss AURA first.

#### Acceptance Criteria

1. THE AURA_Panel SHALL NOT visually overlap invoice totals, tax values, action buttons, payment information, important table rows, sticky footer actions, or document controls on any page where those elements are present.
2. THE AURA_Panel SHALL achieve Acceptance Criterion 1 by extending its existing `PAGES_WITH_STICKY_FOOTER` list and `bottomOffsetClass` positioning mechanism to include the Invoice_Detail_Page and any other affected page, rather than by introducing new AURA behavior or intelligence.
3. THE System SHALL NOT modify AURA's response content, classification logic, or intelligence behavior as part of satisfying this requirement.

### Requirement 15: Correct character-encoding (mojibake) defects in source files

**User Story:** As a user viewing any invoice-related screen, I want punctuation and symbols to display correctly, so that the interface does not show garbled characters where a dash, ellipsis, or similar symbol was intended.

#### Acceptance Criteria

1. THE Create_Invoice_Page source file SHALL NOT contain mojibake byte sequences (including but not limited to "Â·", "â€”", "â€¦", "âˆ’", "Â§") where a middle dot, em dash, ellipsis, minus sign, or section sign was intended.
2. THE Invoice_Document_Renderer source file SHALL NOT contain mojibake byte sequences (including but not limited to "Â·", "â€”", "â€¦", "âˆ’", "Â§") where a middle dot, em dash, ellipsis, minus sign, or section sign was intended.
3. THE System SHALL render the correct Unicode character (middle dot, em dash, ellipsis, minus sign, rupee sign, arrows, check icons, or apostrophes, as applicable) at every location previously affected by a mojibake defect.
4. THE System SHALL NOT display mojibake character sequences anywhere in the production user interface.

### Requirement 16: Universal canonical invoice-number linking [RESOLVED — approved, overrides prior Reports/Intelligence boundary for this narrow purpose]

**User Story:** As a billing user, I want every invoice number shown anywhere in the app to take me to the same invoice detail page, so that I am never confused about which page is the "real" view of an invoice.

#### Acceptance Criteria

1. THE Invoices_Page, Payments_Page, Clients_Page, Client_Detail_Page, Overview_Page, Reports_Page, Intelligence_Page, and any search or command-palette result SHALL render each invoice number as a clickable link that navigates to the single canonical Invoice_Detail_Page for that invoice.
2. THE Payment_Receipt_View SHALL render its associated invoice number as a clickable link that navigates to the same canonical Invoice_Detail_Page.
3. THE Reports_Page SHALL render the invoice number cell in its Invoices, Outstanding, Overdue, and Payments report tables as a clickable link to the canonical Invoice_Detail_Page, in place of the current plain `<td>` cell styled `text-accent`, without altering any Reports_Page calculation, metric, filter, or other business logic.
4. THE Intelligence_Page's `openInvoice` function, wired to `AttentionList`'s `onOpenInvoice` prop, SHALL navigate to the canonical Invoice_Detail_Page for the given invoice instead of calling `goToInvoices()`, without altering any Intelligence_Page calculation, classification, or other business logic.
5. THE CommandPalette's "Invoices" result group SHALL navigate its `run` action to the canonical Invoice_Detail_Page for the specific matched invoice, in place of the current `goToInvoices(info.status)` behavior that opens the filtered invoice list.
6. THE System SHALL use the shared `InvoiceNumberLink` component wherever practical to render invoice-number links introduced or corrected by this requirement, for consistent navigation behavior.
7. THE changes required by Acceptance Criteria 3, 4, and 5 SHALL be limited to invoice-number rendering and navigation only; no other Reports_Page or Intelligence_Page logic, calculation, or business behavior SHALL be modified to satisfy this requirement.

### Requirement 17: Stable invoice numbering when drafts coexist with new invoices

**User Story:** As a billing user, I want creating a new invoice to never disturb the invoice number already assigned to an existing draft, so that draft invoice numbers stay predictable and unique.

#### Acceptance Criteria

1. THE System SHALL retain a Draft_Invoice's previously assigned invoice number unchanged when another invoice is created.
2. WHEN a user creates a new invoice while one or more Draft_Invoice records already exist, THE System SHALL assign the new invoice the next incrementing invoice number without altering any existing Draft_Invoice's assigned number.
3. THE System SHALL NOT silently reuse an invoice number that has already been assigned to another invoice.
4. THE System SHALL NOT produce two invoices with the same invoice number.

### Requirement 18: Drafts remain editable indefinitely without forced finalization

**User Story:** As a billing user, I want to keep an unfinished invoice as a draft for as long as I need, so that creating other invoices in the meantime never forces me to finish or lose that draft.

#### Acceptance Criteria

1. THE System SHALL keep every Draft_Invoice editable regardless of how much time has passed since its creation.
2. THE System SHALL NOT force finalization of a Draft_Invoice as a result of the user creating another invoice.
3. THE System SHALL NOT present a reminder prompt to the user solely because a Draft_Invoice exists.

### Requirement 19: Amount in words always derives from the final rounded grand total

**User Story:** As a billing user, I want the written-out amount on an invoice to always match the final total exactly, so that the numeric total and the words never contradict each other.

#### Acceptance Criteria

1. THE Invoice_Math_Module SHALL derive the amount-in-words value from the final rounded grand total, not from any intermediate subtotal, taxable value, or pre-round-off amount.
2. THE Invoice_Math_Module SHALL produce a matching amount-in-words value for invoices with whole-rupee totals, totals including paise, positive round-off, negative round-off, zero discount, non-zero discount, a single line item, multiple line items, and invoices with CGST/SGST or IGST applied.
3. THE Create_Invoice_Page preview, Invoice_Detail_Page, and any Print/PDF or Download output SHALL display the same amount-in-words value for the same invoice.

### Requirement 20: Create Invoice action hierarchy and lifecycle effects

**User Story:** As a billing user, I want the Bill Invoice, Save as Draft, and Download actions on the Create Invoice page to behave predictably, so that downloading an invoice never accidentally finalizes it or changes its state.

#### Acceptance Criteria

1. THE Create_Invoice_Page SHALL present "Bill invoice" as the action that finalizes an invoice via the Bill_Invoice_Action.
2. THE Create_Invoice_Page SHALL present "Save as draft" as the action that persists the invoice as an editable, non-financial Draft_Invoice.
3. THE Create_Invoice_Page SHALL NOT change an invoice's `isDraft` or `billedAt` state as a result of a Download action.
4. WHERE a Draft_Invoice is downloaded, THE System SHALL leave that invoice's lifecycle state unchanged after the download completes.

## Out of Scope

- AURA assistant intelligence, classification logic, and response content (positioning-only extension per Requirement 14 is in scope).
- Intelligence page metrics, classification, and logic, **except** the invoice-number rendering/navigation change described in Requirement 16 (making `openInvoice` navigate to the canonical Invoice_Detail_Page), which is explicitly in scope.
- Reports page metrics, exports, and logic, **except** the invoice-number rendering/navigation change described in Requirement 16 (making the four confirmed report-table invoice-number cells clickable links to the canonical Invoice_Detail_Page), which is explicitly in scope.
- Workspace Settings page.
- Authentication, login, and access control.
- Branding assets and visual identity work.
- Tauri desktop packaging.
- Reconciliation of the backend `InvoiceStatus` enum (Python/FastAPI) with frontend status terminology.
- The specific communication channel/template used by Send_Invoice_Action and Send_Reminder_Action (email vs. WhatsApp vs. other) remains an open business decision; this document does not introduce or assume any such integration.
- Whether editing a Billed_Invoice is permitted, and if so under what constraints, is an open business decision (see Open Questions / Contradictions); no editing behavior for billed invoices is assumed by this document.
- Any full rewrite of existing pages or architecture beyond the targeted changes described above.
- Implementation of any requirement in this document. This correction pass is documentation-only; no code change is authorized until a corresponding design/tasks update is produced.

## Open Questions / Contradictions

The following items are genuine open questions or potential contradictions identified during this correction pass. They are intentionally left unresolved here rather than silently decided, and must be settled before or during the design phase.

1. **RESOLVED — Reports_Page / Intelligence_Page invoice-number linking vs. out-of-scope boundary.** Decision (second correction pass): approved and resolved. Universal invoice-number linking overrides the Reports/Intelligence out-of-scope boundary for the narrow purpose of turning displayed invoice numbers into canonical links, and only that. See the rewritten Requirement 16 (Acceptance Criteria 3-7) and the corresponding carve-out in "Out of Scope" above.
2. **OPEN (reconfirmed) — Billed invoice editing.** Explicitly re-confirmed as an unresolved business decision during this second correction pass. No existing requirement in this document (pre- or post-correction) specifies whether a Billed_Invoice can be edited after billing, or what constraints would apply. This document does not assume unrestricted editing is allowed, nor does it invent restrictive rules; Draft_Invoice records remain fully editable and the Bill Invoice confirmation flow (Requirement 1) is unchanged. **Still needs a business/product decision** before design work addresses Create_Invoice_Page or Invoice_Detail_Page behavior for already-billed invoices.
3. **OPEN (reconfirmed) — Send_Invoice_Action / Send_Reminder_Action delivery channel.** Explicitly re-confirmed as an unresolved business decision during this second correction pass. The existing document already treats real email delivery as not fully specified (Send_Reminder_Action "does not perform real email delivery"), and no channel (email, WhatsApp, or other) is assumed or implied anywhere in this document. The UI may continue to prepare and confirm Send_Invoice_Action and Send_Reminder_Action via the Confirm_Modal_Pattern without any actual external messaging integration. **Still needs a business/product decision** before design work assumes a specific channel.
4. **OPEN — AURA / Reports / Intelligence figures routed through Invoice_Math_Module (Requirement 9.6).** Verified during this second correction pass: Decision 1 above resolves only the invoice-number-as-link question (Requirement 16), not the separate question of routing financial figures/metrics through the Invoice_Math_Module on Reports_Page, Intelligence_Page, or AURA_Panel. These are distinct concerns — one is navigation/rendering of an identifier, the other is calculation-layer reuse for computed figures — so item 4 is not resolved by Decision 1 and remains open, to be resolved case-by-case during design per Requirement 9.6's existing scoping language.
