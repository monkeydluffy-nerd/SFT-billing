# Design Document

## Overview

This design defines one coordinated stabilization pass for the canonical `sft-billing-phase2.2-gst/sft-billing` React/TypeScript/Vite application and its existing FastAPI/openpyxl backend in `backend`. It preserves the current DataProvider boundary, FastAPI route/service layering, workbook persistence, invoice math, numbering, AURA intelligence, Reports/Intelligence business logic, authentication/security, Tauri packaging, and branding. It does not add application code in this phase; it specifies the implementation that a later task phase will execute as one pass.

The pass has four implementation themes:

1. Make the invoice document canonical: one `Invoice_Document_Renderer` extracted from the existing `InvoicePreview`, reused by create preview, invoice detail, print/PDF, and the existing export integration.
2. Complete payment and receipt behavior through the existing DataProvider and FastAPI/openpyxl path, including one optional proof attachment associated with the exact payment.
3. Correct navigation, lifecycle labels, layout, numeric input, Settings/logo presentation, targeted Reports/Intelligence labels/comparisons, and mojibake without redesigning unrelated surfaces.
4. Verify existing calculation, amount-in-words, numbering, layering, and build behavior before changing any verified implementation.

No SQLite, second database, browser `localStorage` proof storage, external messaging channel, billed-invoice edit workflow, IGST implementation, branding redesign, or parallel document renderer is authorized.

## Architecture

### Existing layered system

The implementation keeps the current dependency direction:

```text
React pages/components
        │
        │ domain reads/writes only through hooks and DataProvider
        ▼
Hooks and view-model adapters
        │
        ▼
DataProvider interface
        │
        ├── mockDataProvider (development/test implementation)
        └── apiDataProvider
                │ HTTP/JSON or multipart payment-proof request
                ▼
        FastAPI schemas and routes
                │
                ▼
        domain services
                ├── invoice/payment/activity services
                └── payment-proof attachment service
                        │
                        ├── existing workbook row helpers
                        ├── existing Excel workbook
                        └── application-managed local attachment root
```

Presentation components never read or write workbook files, attachment paths, browser storage, or backend files. They obtain invoices, payments, clients, business profile, and proof metadata through hooks backed by `activeDataProvider`.

The application may continue to select `mockDataProvider` or `apiDataProvider` through the existing service switch. Both implementations must expose the same payment/proof contract. The mock provider may keep data in memory for tests, but it must model proof metadata and stable references so the UI does not depend on transient component state.

### One coordinated implementation pass

The pass must update the related contracts together rather than landing a frontend-only proof shape, a backend-only column, or a renderer-only view. The coordinated order is:

1. Establish or verify shared domain types and pure math/view-model adapters.
2. Extend the DataProvider and both provider implementations.
3. Extend Pydantic, payment route/service, workbook headers/migration, and application-managed attachment persistence.
4. Extract and adopt the shared invoice document renderer and connect existing export integration.
5. Apply page/component navigation, lifecycle, receipt, proof, layout, terminology, Settings, and encoding changes.
6. Run contract, property, integration, UI, and build verification before considering the pass complete.

## Components and Interfaces

### Invoice flow

```text
CreateInvoicePage draft
  ├─ Save as draft ───────► DataProvider.saveInvoice(isDraft=true)
  ├─ Bill invoice ────────► DataProvider.saveInvoice(isDraft=false, billedAt=now)
  └─ preview ─────────────► InvoiceDocumentModel
                              └─ Invoice_Document_Renderer

InvoicesPage / Overview / Clients / Payments / Reports / Intelligence / CommandPalette
  └─ InvoiceNumberLink(invoice.id)
       └─ useWorkspaceStore.navigateToInvoiceDetail(id)
            └─ Invoice_Detail_Page
                 ├─ Invoice_Document_Renderer
                 ├─ derived Invoice_Ledger_Status and payment history
                 └─ existing print/PDF/download/export integration
```

`Invoice_Document_Renderer` receives a normalized document model containing the invoice, related client, business profile, and values from `Invoice_Math_Module`. The renderer owns the supported document sections and their labels. The detail page renders ledger status and payment history in a supporting region outside the primary document. A draft detail view offers continuation to Create Invoice, not billed-only actions.

### Payment and receipt flow

```text
PaymentsPage / Invoice_Detail_Page
  └─ RecordPayment form
       ├─ validates invoice, amount, method
       ├─ optional one-file proof selected (or replacement requested through the same internal orchestration)
       └─ DataProvider.recordPayment(paymentInput, optionalProof)
              └─ FastAPI POST /api/payments
                   ├─ validate payment and invoice
                   ├─ allocate payment id and persist the payment row with no proof metadata
                   ├─ emit exactly one payment activity after the row is durable
                   ├─ if proof: write one generated, payment-specific attachment reference
                   ├─ read back and validate the stored attachment
                   ├─ internally enrich the same workbook row with the one proof metadata/reference
                   ├─ after successful replacement enrichment, clean the prior managed attachment
                   └─ return the retained payment and, on proof failure, one actionable proof error

GET /api/payments
  └─ Payment[] with optional current PaymentProof metadata/reference
       ├─ PaymentsPage persisted proof indicator
       ├─ Payment_Receipt_View
       └─ Invoice_Detail_Page payment history
```

A proof is optional and singular: one payment has zero or one current managed proof file in this scope. The payment row is the durable record of identity and `invoiceId` before any proof work begins. Proof handling is a post-persistence enrichment of that row; it never creates a second payment or emits another payment activity event. A replacement uses the same internal attachment/write-readback/enrichment orchestration, commits the new metadata before cleaning the prior managed file, and never creates multi-file proof history. No new public `PUT` payment mutation route is introduced solely for replacement; any replacement entry point must remain behind the existing approved service boundary.

## Data Models

### Shared frontend payment contract

The existing `Payment` fields remain unchanged. Add one optional metadata object with an opaque, stable reference:

```ts
export interface PaymentProof {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string; // ISO timestamp
  attachmentReference: string; // opaque app-managed relative reference, never a browser path
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  receivedAt: string;
  reference?: string;
  paymentProof?: PaymentProof;
}

export interface PaymentProofUpload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Blob;
}

export interface PaymentProofError {
  code: "proof_storage_failed" | "proof_unavailable" | "proof_invalid";
  stage: "write" | "readback" | "metadata_enrichment" | "cleanup";
  message: string;
  paymentId: string;
  retryable: boolean;
}

export interface RecordPaymentResult {
  payment: Payment;
  proofError?: PaymentProofError;
}
```

`PaymentProofUpload` is an input-only boundary value. Binary content is never serialized into a workbook cell or browser `localStorage`. `PaymentProof` is the persisted response shape and is present only after the attachment has been read back successfully and its metadata has been enriched into the matching workbook row. `attachmentReference` is an opaque, application-managed relative reference such as `payment-proofs/{paymentId}/{proofToken}`; the client must not construct filesystem paths from it and must not expose an absolute server path.

The proof metadata describes exactly one current managed file. `fileName` is display metadata, not a path. `mimeType` and `sizeBytes` are retained for display/download validation. `uploadedAt` is assigned by the backend persistence operation. A generated proof token or equivalent stable identifier may be embedded in the reference, but it is not a second domain record. A failed new proof attempt leaves `paymentProof` absent; a failed replacement does not discard the previously committed proof metadata.

### DataProvider extension

The existing methods remain. The payment recording operation is extended as the single provider boundary for optional proof submission:

```ts
interface DataProvider {
  getPayments(): Promise<Payment[]>;
  recordPayment(
    payment: Omit<Payment, "paymentProof">,
    proof?: PaymentProofUpload,
  ): Promise<RecordPaymentResult>;
}
```

If preserving the current `recordPayment(payment: Payment): Promise<Payment>` shape is required by an existing adapter during implementation, the adapter may use an equivalent provider-specific input/result wrapper, but the public application contract must still expose persisted `paymentProof` on reads and a proof-specific error result when the payment is retained without proof. No component may bypass this boundary to upload a file or mutate a payment.

`mockDataProvider` stores the returned `PaymentProof` metadata/reference in its in-memory payment store. `apiDataProvider` sends ordinary no-proof submissions through the existing JSON payment route and proof-bearing submissions through the same payment operation using a multipart request containing the payment fields and one proof file. It maps the response envelope and backend validation errors into the shared types.

### Backend Pydantic contract

Extend the existing payment models rather than creating a parallel proof API:

```python
class PaymentProof(BaseModel):
    fileName: str = Field(min_length=1)
    mimeType: str = Field(min_length=1)
    sizeBytes: int = Field(ge=0)
    uploadedAt: str
    attachmentReference: str = Field(min_length=1)

class PaymentBase(BaseModel):
    invoiceId: str
    amount: float = Field(gt=0)
    method: PaymentMethod
    receivedAt: Optional[str] = None
    reference: Optional[str] = None

class Payment(PaymentBase):
    id: str
    clientId: str
    receivedAt: str
    paymentProof: Optional[PaymentProof] = None
```

The upload request may carry the one file separately from the payment fields, but a new payment request does not accept proof metadata or a client-supplied `attachmentReference`; the backend generates the reference only after the payment row exists. The response and persisted row use the `Payment`/`PaymentProof` shape after successful internal metadata enrichment. Existing payments with blank proof columns deserialize with `paymentProof=None`.

### Workbook representation and migration

Extend `PAYMENTS_HEADERS` with optional proof metadata columns, preserving all existing columns and rows:

```text
proof_fileName
proof_mimeType
proof_sizeBytes
proof_uploadedAt
proof_attachmentReference
```

The row adapter maps these five columns to/from the current `paymentProof`. Blank legacy columns produce `None`; partially populated metadata is treated as invalid proof metadata and reported as unavailable rather than silently reconstructed. Workbook initialization/load must append missing headers in a backward-compatible migration step before reading/writing payment rows. It must never reorder or delete existing columns or rows. The initial payment write intentionally leaves these columns blank; a later internal workbook-service enrichment fills all five columns only after the new attachment has been written, read back, and validated. Replacement enrichment updates the same payment row rather than appending a payment or creating a proof-history row.

The workbook stores metadata and the stable reference only. The binary file is stored beneath an application-managed attachment root controlled by the backend, for example `backend/data/payment-proofs/`. The root is outside browser-accessible project source and is resolved by backend configuration. The reference is relative and normalized; path traversal, absolute paths, symlinks outside the root, and a client-provided filename as a path are rejected. The reference must include or be deterministically scoped to the exact payment id so a proof cannot be associated with another payment or invoice.

No database, second workbook, or new persistence technology is introduced. The workbook remains the source of payment-record truth; the attachment file is content addressed by its stable payment-specific reference and is only valid when the corresponding workbook row contains matching metadata. If enrichment fails, the row remains the durable payment record with no newly committed proof metadata; cleanup of the new orphan is best effort and never changes the payment identity.

## Error Handling

### Durable payment-first orchestration

The existing payment service owns one orchestration for recording a payment and optionally handling its proof. The public payment operation may receive one uploaded file, but its internal order is fixed so proof work cannot create or duplicate a payment:

1. `PaymentsPage` validates the required invoice, positive amount, and method locally and displays field-level errors without calling the provider when the payment itself is invalid.
2. The provider sends the payment fields and, optionally, one selected proof upload. It does not put binary content or sensitive proof metadata in `localStorage`, a Zustand store, URL parameters, or invoice state.
3. The FastAPI payment service validates the invoice and payment fields, allocates the payment identity, and immediately persists the payment row through the existing workbook service with all proof columns blank. Once this write succeeds, the original payment `id` and `invoiceId` are durable and are never replaced by proof handling.
4. After the payment row is durably persisted, the payment service invokes the existing activity service exactly once for that payment. This is the only payment activity emission in the orchestration. Proof write, readback, enrichment, replacement, cleanup, and proof-error paths never invoke payment activity creation.
5. If no proof was selected, the service returns the persisted payment with no `paymentProof`.
6. If one proof was selected, the service generates a safe application-managed reference scoped to that exact payment, writes the file to a temporary location under the managed attachment root, and promotes it to the generated managed reference. The workbook row is not enriched yet.
7. The service reads the promoted attachment back and validates that the content and metadata match the selected upload. A write or readback failure leaves the payment row unchanged with no new proof metadata.
8. Only after successful readback does the service perform an internal workbook-service metadata enrichment/update for the same payment row, setting the one optional proof metadata/reference. The enrichment is row-atomic, or restores the prior/blank proof columns if the workbook service reports failure, so a failed operation cannot leave partially populated proof metadata. This is an internal persistence operation, not a new public payment mutation API and not a second database.
9. The response returns the same persisted payment. On proof failure it returns that retained payment plus one actionable proof-specific error; the provider and UI reload the payment from the DataProvider so the displayed proof state is persisted state rather than transient upload state.

The row write and the single activity event therefore happen before any proof file is considered committed. A proof failure cannot roll back or recreate the payment, cannot change its `id` or `invoiceId`, and cannot cause a second payment activity event.

### Replacement of the one managed proof file

The payment-proof attachment service exposes the same internal write/readback/enrichment orchestration for replacement, identified by the existing payment `id` and `invoiceId`. Replacement stages the new generated reference and file while the prior managed metadata/file remains untouched. The same-row metadata update is committed as one enrichment result (or restores the prior metadata on failure). After the new file is read back and the same-row workbook metadata enrichment succeeds, the row points to the new proof and the service attempts to delete the prior managed attachment. The model has one current proof file per payment and no multi-file proof history.

Replacement does not allocate a new payment, rewrite the payment identity, or emit a payment activity event. No public `PUT /api/payments/{id}` route is added solely for replacement; the replacement operation remains an internal service orchestration behind the existing approved payment boundary. If a replacement write, readback, or enrichment fails, the attempted new proof is not committed. A valid prior proof remains associated; a new payment remains without proof metadata. The payment is returned with the same `id`/`invoiceId` and an actionable proof-specific error.

### Failure handling and cleanup

- **Proof write failure before metadata:** the already durable payment row remains with blank proof columns, exactly one payment activity event, and a `proof_storage_failed` error with `stage: "write"` and a retry/remediation message.
- **Readback failure:** the row is not enriched, the new temporary/promoted file is treated as an orphan, and the retained payment is returned with `proof_unavailable`/`stage: "readback"` plus an actionable message.
- **Workbook metadata-enrichment failure after attachment creation:** the row remains the original payment with no newly committed proof metadata; the service attempts to delete the new orphan and returns `proof_storage_failed`/`stage: "metadata_enrichment"`. It never creates a replacement payment or emits another activity event.
- **Prior-file cleanup failure after successful replacement:** the new proof metadata remains the committed current value. The service records a safe backend diagnostic for the orphan-cleanup failure without exposing a server path or changing the payment result into a duplicate or rollback. The old file is never deleted before the new file and metadata succeed.
- **Cleanup failure for any temporary/orphan file:** cleanup is best effort. The backend records only a safe diagnostic identifier/category and failure stage; it does not return filesystem paths, filenames that reveal server layout, or sensitive proof data.
- **Retrieval/readback of an already committed proof failure:** the payment is not deleted or hidden. Its payment identity and invoice association remain available, and the UI shows `Proof unavailable` with the existing retry/open affordance. Metadata is retained only as the current persisted reference and is not silently reassigned.

### Validation and safety

- Required payment validation remains invoice, amount, and method; invalid payments are never recorded and therefore emit no payment activity.
- Proof validation is applied during post-persistence proof handling and rejects an empty upload, unreadable content, malformed metadata, unsafe generated/reference state, or backend-configured size/type violation. The exact allowed MIME/size policy remains deployment configuration rather than an invented product rule.
- The server trusts neither the browser filename nor browser MIME type for filesystem naming. It generates the reference from the persisted payment identity and uses the filename only as display metadata after validation.
- The proof operation is tied to the persisted payment id and invoice id and cannot attach a proof to an arbitrary invoice or a different payment.
- A missing or malformed proof reference is a proof-specific error, not a payment deletion or a generic payment-list failure.
- The UI distinguishes payment failure from proof failure: payment validation or payment-row persistence errors prevent a payment result; proof errors preserve the payment and tell the user that the payment was recorded but its proof needs attention.
- No component accesses workbook or attachment files directly. No proof binary is stored in browser localStorage, and no second database or workbook is introduced.
## Invoice Lifecycle, Math, and Numbering

### Lifecycle state machine

```text
Draft_Invoice (isDraft=true, billedAt absent or historical)
  ├─ Save as draft ─────── remains editable and non-financial
  ├─ Download/preview ──── no lifecycle mutation
  └─ Bill invoice ──────── isDraft=false, billedAt=now, sentAt unchanged

Billed_Invoice (isDraft=false)
  ├─ View/detail/print/download
  ├─ Send invoice ──────── existing record/confirm flow, no channel selection
  ├─ Send reminder ─────── activity record only, no external delivery
  └─ Record payment ────── append Payment; ledger status is derived
```

Drafts remain editable indefinitely. Billing is the only transition that sets `isDraft=false` and `billedAt`; it does not imply sending. Saving or downloading a draft does not bill it. The design does not define billed-invoice editing. Existing `sentAt`, legacy fields, and untouched legacy status consumers remain compatible unless the reconciled requirements explicitly require a narrow change.

### Ledger-derived status

Keep the existing legacy `InvoiceStatus` and its consumers unchanged where they are not in the approved correction scope. Add or preserve a separate pure `Invoice_Ledger_Status` calculation in `Invoice_Math_Module`:

```text
if invoice.isDraft: no ledger status
else if sum(payments for invoice.id) >= computeInvoiceTotals(invoice).total: Received
else if asOf <= dueDate: Outstanding
else: Overdue
```

All core workflow displays, client rollups, invoice rows, detail support information, and payment actions use this ledger-derived status. Drafts are excluded from financial totals and show workflow state only. No `Mark Paid` action changes status; only recording a Payment can affect the ledger.

The calculation remains the exclusive source for subtotal, taxable value, discount, CGST, SGST, round-off, grand total, amount-in-words, received, outstanding, overdue, and billed rollups in this scope. The existing CGST/SGST behavior and public calculation signatures are preserved when verification passes. The worked regression remains: taxable value ₹25,700 at CGST 9% and SGST 9% produces ₹2,313 each and total ₹30,326 with zero round-off; amount-in-words is derived from the final rounded total.

Number allocation must inspect assigned numbers, including drafts, and select the next unused incrementing number. It must not finalize drafts, reuse numbers, or create duplicates. Numbering and amount-in-words are verified before structural changes; a failing test is fixed in its owning module, not compensated for in a page.

## Shared Invoice Document Strategy

### `InvoiceDocumentModel`

Extract the document data preparation from the existing `InvoicePreview` into a shared, testable adapter. The model includes:

- business identity: canonical business profile name, logo, address, email, GSTIN, PAN;
- document identity: Tax Invoice heading, invoice number, invoice date, due date;
- customer details;
- order/delivery values: `supplierCode`, `poNumber`, `poDate`, and `transporter` under their matching labels;
- line items and supported tax/discount/round-off values;
- totals and final amount-in-words from `Invoice_Math_Module`;
- bank details, declaration/terms, and authorized signatory;
- normalized display strings with corrected Unicode and no mojibake.

The adapter omits the order/delivery block when all four order/delivery values are empty. It does not add IGST fields or rules. It uses the same canonical business-profile logo value as Settings.

### Renderer reuse

Create one `Invoice_Document_Renderer` from the existing `InvoicePreview` markup. The renderer is the only owner of the invoice document structure and labels:

- `InvoicePreview` becomes a thin create-page consumer of the renderer.
- `Invoice_Detail_Page` renders the same renderer for one resolved invoice.
- Print/PDF uses the rendered document and its existing print/output integration.
- The existing `invoiceExportService` remains the export entry point, but it consumes the same `InvoiceDocumentModel` and math values rather than re-deriving a second set of totals or maintaining conflicting document rules. Its Excel-specific layout is an output adapter for the same model, not an independent invoice-document implementation.

The renderer displays the full professional document. Detail-only status, payment history, actions, and navigation controls live outside the primary document region. Preview, detail, and output must show identical monetary values and amount-in-words for the same invoice.

The renderer must preserve current supported CGST/SGST behavior and must not invent IGST. A future IGST decision must update frontend types, backend Pydantic schemas, calculations, export model, workbook persistence, and renderer together; no partial field is added now.

## Exact Affected Areas

### Frontend

| Area | Design change | Explicit preservation |
|---|---|---|
| `src/types/payment.ts`, `src/types/index.ts` | Add optional `PaymentProof`, proof upload/result/error contract. | Existing payment identity, method, amount, and timestamps. |
| `src/services/dataProvider.ts` | Extend payment recording boundary for optional proof and structured proof failure. | No component-level storage access. |
| `src/services/mockDataProvider.ts` | Model proof metadata/reference and result behavior for tests. | Mock remains a provider implementation, not production persistence. |
| `src/services/apiDataProvider.ts` | Map proof-bearing payment requests/responses and API errors. | Existing API base, invoice/client/activity behavior. |
| `src/hooks/usePayments.ts` and related hooks | Provide loading, reload, and persisted proof state through DataProvider. | Existing hook conventions. |
| `src/components/create-invoice/InvoicePreview.tsx` | Thin wrapper around shared renderer; correct labels/encoding. | Existing supported fields and visual language. |
| new shared invoice renderer/model under `src/components/create-invoice/` or existing document component area | Own one document structure and normalized values. | No second renderer or tax implementation. |
| `src/pages/InvoicePage.tsx` / canonical `Invoice_Detail_Page` | Replace summary-dashboard primary content with full renderer; retain support status/payment history and actions. | Existing detail loading/error patterns and domain logic. |
| `src/pages/CreateInvoicePage.tsx` | Use renderer; retain left-form/right-preview layout; one outer page scroll container; fix protected controls, mapping verification, mojibake. | Draft/bill semantics, existing form and export integration. |
| `src/components/create-invoice/LineItemEditor.tsx` | Use controlled string buffers for quantity/unit price, including empty and trailing decimal states. | Line item model remains numeric; descriptions/HSN/suggestions unchanged. |
| `src/components/payments/PaymentReceiptView.tsx` | New real printable/viewable receipt document with business identity, payment fields, and canonical invoice link. | Existing payment methods and provider data. |
| `src/pages/PaymentsPage.tsx` and payment form | Provider-backed list/record flow, optional proof upload, persisted proof indicator, receipt navigation, field errors. | No hard-coded demo payment data in presentation. |
| `src/components/shared/InvoiceNumberLink.tsx` | Shared exact-id navigation to `Invoice_Detail_Page`. | No filtered-list or summary-dashboard fallback. |
| `src/hooks/useWorkspaceStore.ts`, `src/App.tsx` | Preserve/use `selectedInvoiceId`, `invoice-detail`, and `selectedPaymentId` navigation state; ensure receipts return to originating surface. | Store remains UI/navigation state only. |
| Invoices, Overview, Clients, Client Detail, Payments | Replace invoice-number render targets with shared canonical link; retain lifecycle/status rules and rollups. | No unrelated redesign. |
| `src/pages/ReportsPage.tsx`, `src/pages/IntelligencePage.tsx`, `src/components/command-palette/CommandPalette.tsx`, and only the required report row passthrough | Exact invoice-number navigation, targeted Pending/Collected terminology, correct current/prior comparison labels/direction. | Metrics, filters, classifications, data sources, fuzzy search, quick actions, and exports remain unchanged. |
| `src/components/aura/AuraPanel.tsx` | Footer-aware offset/safe zone on Create Invoice and Invoice Detail. | Response content, classification, intelligence, and interaction behavior unchanged. |
| `src/pages/WorkspaceSettingsPage.tsx` | Remove unnecessary/fake Regional Formatting controls; retain useful supported settings; use one canonical business-profile logo source with a preview; correct encoding. | Do not redesign Settings or branding; product branding and visual identity unchanged. |
| `src/services/invoiceExportService.ts` | Consume shared normalized invoice document model/output values while retaining existing export entry point. | No parallel export path. |
| `src/lib/invoiceMath.ts`, `src/lib/amountInWords.ts`, numbering module | Verify first; change only on a failing root-level test. | Public signatures and correct logic remain unchanged. |
| TypeScript/Vite project config | Resolve Node types and `tsconfig.node` emit conflict through config, without suppressions. | No unnecessary `any`, `@ts-ignore`, or `@ts-nocheck`. |

### Backend

| Area | Design change |
|---|---|
| `backend/app/models/schemas.py` | Add `PaymentProof` and optional proof field to payment schemas; preserve existing payment validation. |
| `backend/app/routes/payments.py` | Extend the existing payment operation for an optional single multipart proof while retaining ordinary no-proof JSON behavior and existing list/get routes. |
| `backend/app/services/payment_service.py` | Validate payment, allocate and durably persist the payment row without proof metadata, emit exactly one payment activity, then orchestrate proof write/readback and same-row metadata enrichment; return the retained payment plus structured proof failure without changing its identity. Reuse this internal orchestration for one-file replacement. |
| new payment-proof attachment helper/service under `backend/app/services/` | Safely generate one application-managed reference, write/read one file beneath configured root, reject traversal, clean temporary/orphan files where possible. |
| `backend/app/excel/constants.py` | Add optional proof metadata headers to the existing Payments sheet. |
| `backend/app/excel/rows.py` and workbook initialization/load path | Preserve old rows, add missing headers compatibly, map optional proof columns without direct openpyxl access from routes/components. |
| existing `backend/app/services/activity_service.py` | Preserve the existing payment-received activity behavior, invoked exactly once after the payment row is durable; proof write/readback/enrichment/replacement/cleanup paths must never emit another payment event. |
| backend data/configuration | Use an application-managed local attachment root and stable relative references; no SQLite or second database. |

## Navigation and Error States

### Canonical invoice navigation

`InvoiceNumberLink` accepts the stable invoice `id` and displayed invoice number. Its activation calls `navigateToInvoiceDetail(invoice.id)` and stops row-click propagation where necessary. It is used for invoice numbers in Invoices, Payments, Clients/Client Detail, Overview, Reports, Intelligence result actions, Payment Receipt, and CommandPalette invoice results wherever an invoice number is rendered.

The detail route resolves by stable id, never by display number or filtered-list position. If the id is missing, stale, or not returned by the provider, the detail page shows a not-found state with a Back action and does not silently open another invoice. Loading and provider failures use existing loading/error primitives and provide retry where the hook supports reload.

Payment receipt navigation carries `selectedPaymentId` as transient UI state. It resolves the payment through provider data and the related invoice/client/business profile. A missing payment shows a not-found state with a return action. A missing related invoice shows the receipt with an unavailable invoice link state rather than linking to a guessed invoice.

### Page states

- Invoice detail: loading skeleton, provider error with Retry/Back, not found, draft mode, billed mode, and successful document/supporting panels.
- Payments: loading rows, empty state, list error with Retry, form validation errors, payment persistence error, proof-specific retained-payment warning, and refreshed success state.
- Receipt: loading, not found, missing related records, printable document, and proof unavailable state without hiding payment data.
- Create Invoice: existing loading/draft/client states, one outer page scroll owner, no nested scroll workaround, and footer-safe AURA placement.
- Reports/Intelligence/CommandPalette: preserve existing empty/loading/error behavior; only the approved target/link/copy changes are made.

## Layout, Encoding, Settings, and AURA

### Create Invoice layout

Retain the established left form/right preview layout. The page has one outer scroll container that contains both form and preview; inner cards and document sections do not become independent scroll owners. Tax values, totals, round-off, and controls remain reachable above/around the existing footer without a sticky footer covering them. Any height/overflow change is made at the page layout boundary, not by shrinking or duplicating the document.

Order/delivery inputs continue to map as follows: `supplierCode` → Supplier code, `poNumber` → P.O. No., `poDate` → P.O. date, and `transporter` → Transporter. The shared renderer omits the block when all are empty. Numeric quantity/unit-price fields use text buffers with decimal input mode so `2`, `2.`, empty, and clear-then-type sequences are represented exactly while the domain model receives finite numeric values.

### AURA safe zone

AURA retains its existing fixed bottom-right behavior on ordinary pages. On Create Invoice and Invoice Detail, it receives a footer-aware/protected-content bottom offset sufficient to clear sticky controls and invoice totals/payment regions. This changes only positioning; response content, classification, intelligence, and action behavior remain untouched.

### Settings and business identity

Remove unnecessary/fake Regional Formatting controls from Workspace Settings. Retain useful supported settings and one canonical business-profile logo source; Settings and the invoice renderer read that source. Remove duplicate, stale, or placeholder logo presentation only where found. Do not redesign Settings or branding or change product branding assets, application identity, auth, or visual brand direction.

### Mojibake

Correct the named production source files and shared renderer labels to intended Unicode characters, including rupee signs, middle dots, em dashes, ellipses, minus signs, arrows, checks, and apostrophes. Verification includes a lexical scan for listed mojibake sequences and rendered checks in the affected pages.

## Reports, Intelligence, and Command Palette Scope

The approved changes are narrowly limited to:

- invoice-number cells/results activating the exact `Invoice_Detail_Page` by invoice id;
- targeted `Pending` → `Outstanding` and `Collected` → `Received` labels only where the requirements identify the label as a correction target;
- period-comparison labels that correctly identify current and prior periods, with deltas associated in the correct direction.

Do not redesign Reports or Intelligence, change their metrics, filters, data sources, classifications, exports, or AURA business logic. Untargeted legacy labels remain unchanged. If a report table lacks an invoice id, add only the minimal id passthrough in its existing row shape; do not remodel report aggregation.

## Intentional Non-Changes and Open Decisions

### Intentional non-changes

- No SQLite, second database, replacement persistence, or browser `localStorage` proof data.
- No external email, WhatsApp, SMS, or other communication channel for send/reminder actions.
- No billed-invoice edit workflow or assumption about whether billed records may be edited.
- No `Mark Paid` or Duplicate action; payment ledger remains the source of Received/Outstanding/Overdue.
- No rewrite of verified invoice math, amount-in-words, numbering, or public calculation signatures.
- No IGST rate, rule, field, calculation, export, or workbook representation.
- No AURA response/intelligence change.
- No Reports/Intelligence redesign or broad terminology migration.
- No unrelated branding, auth/security, Tauri, or backend architecture changes.
- No multi-file payment-proof system, proof replacement history, or proof removal action. One current managed proof file may be replaced only through the same internal payment-proof orchestration; no public PUT payment mutation route is added solely for replacement.
- No direct workbook or attachment filesystem access from React components.

### Open decisions preserved

1. Billed-invoice editing requires a separate product decision before any workflow is designed.
2. External communication channel selection remains open; send/reminder remain record/confirm-only.
3. Whether all Reports/Intelligence/AURA financial figures must use `Invoice_Math_Module` is not resolved by the narrow corrections and must not be inferred.
4. Attachment MIME/size policy follows existing deployment policy or a separately approved configuration; this design does not invent a product rule.
5. A future IGST decision must be coordinated across frontend types, backend schemas, calculations, exports, persistence, and document rendering in one change.

## Correctness Properties

*A correctness property is a behavior that must hold for every valid input in its domain. The properties below are intentionally limited to unique, executable invariants identified during acceptance-criteria prework; UI, integration, encoding, and build criteria are covered by the verification matrix rather than forced into property tests.*

The property reflection consolidated overlapping status branches into one ledger-status property, kept payment-proof optionality separate from proof round-trip association, and kept failure retention separate from successful replacement because each validates a distinct invariant. The payment-proof properties explicitly model the durable-row-first ordering and the single activity-event boundary.

### Property 1: Ledger status is payment- and due-date-derived

For all billed invoices, payment collections, and evaluation dates, the ledger status is `Received` exactly when payments for that invoice meet or exceed the computed total, otherwise `Outstanding` when the due date has not passed and `Overdue` when it has passed.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 2: Drafts are excluded from ledger status and financial rollups

For any collection containing draft and billed invoices and any associated payments, draft invoices contribute no ledger status or financial rollup amount, while billed invoices are partitioned into total billed, received, outstanding, and overdue according to the shared math module.

**Validates: Requirements 3.5, 4.7, 4.10**

### Property 3: Billing changes only the intended lifecycle fields

For any valid draft invoice and any pre-existing `sentAt` value, applying Bill_Invoice_Action produces a billed invoice with `isDraft=false` and a current `billedAt`, while preserving the existing `sentAt` value and leaving all other invoice data unchanged.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Invoice number allocation is stable and unique

For all sequences of invoice creations and all previously assigned invoice numbers, the allocator preserves every existing draft number, returns the next unused incrementing number, never reuses a number, and never produces duplicates.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

### Property 5: Amount-in-words reflects the final rounded total

For any valid invoice whose raw total and round-off produce a final rounded grand total, the amount-in-words output is the conversion of that final total and is identical wherever the invoice total is rendered.

**Validates: Requirements 6.5, 12.4**

### Property 6: Shared invoice outputs agree on document values

For any valid invoice, client, and business profile, the create preview, invoice detail, print/PDF output, and existing export integration expose the same supported monetary values, amount-in-words value, order/delivery mapping, and canonical business identity.

**Validates: Requirements 5.2, 5.8, 6.1, 6.2, 6.3, 6.5, 6.6, 13.5**

### Property 7: Empty order/delivery data does not create a document block

For any invoice whose `supplierCode`, `poNumber`, `poDate`, and `transporter` are all empty, the shared invoice document output contains no order/delivery block; for any non-empty field, that field appears under its matching label.

**Validates: Requirements 13.5, 13.6**

### Property 8: Numeric input preserves the active text buffer

For all valid sequences of typing digits, clearing, entering decimals, and leaving a trailing decimal point in quantity or unit-price fields, the displayed input buffer equals the accepted user text without an extraneous leading zero or digits from a previous value, while the stored numeric model remains finite for calculable values.

**Validates: Requirements 13.7, 13.8, 13.9**

### Property 9: A successful proof round trip remains attached to the exact payment

For any valid payment identity, invoice id, and optional single proof upload, the durable-row-first payment orchestration returns and later retrieves the same payment identity, `invoiceId`, proof metadata, and payment-specific attachment reference, and never exposes that proof as belonging to another payment or invoice.

**Validates: Requirements 8.2, 8.3, 8.4, 8.6, 8.7, 9.7**

### Property 10: Canonical invoice links target the exact detail record

For any invoice id and every surface that renders its invoice number, activating the shared InvoiceNumberLink selects that exact id for Invoice_Detail_Page rather than a filtered invoice list, a different invoice, or a summary dashboard.

**Validates: Requirements 7.6, 10.1, 10.5**

### Property 11: Receipt fields are projections of associated records

For any payment with a related invoice, client, and business profile, Payment_Receipt_View displays the payment reference/date/amount/method, associated invoice number, customer identity, and business identity from those records, and its invoice link carries the payment's exact `invoiceId`.

**Validates: Requirements 7.2, 7.3, 7.6**

### Property 12: Current/prior comparison deltas are directionally correct

For all valid current-period and prior-period values, a Reports or Intelligence Period_Comparison labels each period correctly and displays a delta whose sign and direction correspond to current relative to prior.

**Validates: Requirements 15.3, 15.4**

### Property 13: Canonical business-logo value is consistent

For any canonical business-profile logo value, Settings and Invoice_Document_Renderer read and display that same value, with no alternate stale or placeholder source selected by either surface.

**Validates: Requirements 17.2, 17.3**

### Property 14: Payment proof is optional without changing payment identity

For all valid payment submissions with and without proof, payment validation and ledger association use the same required payment invoice, amount, and method rules; absence of proof does not prevent recording, and proof presence does not change the payment id, invoice id, amount, or method allocated by the durable payment row.

**Validates: Requirements 8.1, 8.2, 9.3, 9.7**

### Property 15: Renderer identity is structural, not duplicated

For all invoice document consumers in scope, the rendered document structure is obtained from the one shared Invoice_Document_Renderer/model path; no consumer introduces a second independent invoice-document markup or monetary calculation path.

**Validates: Requirements 5.6, 5.7, 6.1, 6.2, 6.4**

### Property 16: Proof failure retains the durable payment and emits no duplicate activity

For any valid payment and any proof write, readback, or workbook metadata-enrichment failure after the payment row is persisted, the returned and retrievable payment retains the original `id` and `invoiceId`, has no newly committed proof metadata or marks it unavailable, returns one actionable proof-specific error, and has exactly one payment activity event rather than a proof-induced duplicate.

**Validates: Requirements 8.11, 9.2, 9.4**

### Property 17: Successful replacement commits one current proof after enrichment

For any payment with zero or one existing managed proof and any valid replacement upload, successful replacement preserves the payment's `id` and `invoiceId`, enriches the same workbook row with exactly one current proof reference, removes no prior file until the new attachment has been read back and metadata has succeeded, attempts cleanup of the prior managed file afterward, and emits no payment activity event.

**Validates: Requirements 8.2, 8.5, 9.7**

## Testing Strategy

### Test configuration

Every property test must run at least 100 iterations and use the required tag format:

```text
Feature: sft-billing-final-stabilization, Property N: <property text>
```

Use the repository's existing Vitest/Testing Library/fast-check setup where present. Do not add a new test runner solely for this design. Pure functions and in-memory provider adapters are suitable for property tests; browser layout, filesystem, workbook, API, and build checks use focused examples/integration/smoke checks.

### Verification matrix

| Verification layer | Coverage |
|---|---|
| Pure unit/property tests | Properties 1–5, 7–10, 12–14, 16–17; invoice math and amount-in-words worked example; numbering sequences; numeric text-buffer sequences. Minimum 100 iterations per property, including failure-injection adapters for payment-proof properties. |
| Renderer tests | Properties 5, 6, 7, 11, 13, 15; populated optional fields, empty order/delivery block, Unicode labels, draft/billed support separation. |
| Provider contract tests | No-proof payment and proof-bearing payment; durable payment id/invoiceId before proof handling; persisted metadata/reference round trip; proof write/readback/enrichment error envelopes returning the retained payment; exactly one activity event; mock/API shape adapter parity; internal one-file replacement with no public PUT mutation contract. |
| Backend integration tests | POST/GET payment with and without proof; exact payment/invoice association; workbook reload; attachment root/reference validation; legacy workbook with absent proof columns; proof write failure before metadata; workbook metadata-enrichment failure after attachment creation; readback failure; same-id payment retention; exactly-one payment activity event; temporary/orphan cleanup and safe diagnostic when cleanup fails; successful replacement that leaves one current managed proof file and cleans the prior file only after new metadata succeeds. |
| UI examples | Lifecycle action visibility, receipt access from Invoice Detail and Payments, canonical links from each approved surface, Reports/Intelligence/CommandPalette targeted corrections, Settings removal of unnecessary/fake Regional Formatting controls, retention of supported settings, and canonical business-profile logo cleanup, one outer Create Invoice scroll owner, AURA safe zone, persisted proof state, and actionable retained-payment proof error. |
| Encoding checks | Grep named production sources and rendered text for mojibake; assert intended Unicode symbols. |
| Layering/scope checks | Static imports for DataProvider-only access, no localStorage proof access, no SQLite/second DB, no phase1 appStore mutations, no duplicate renderer, no unapproved Reports/Intelligence changes, no IGST additions, no new public payment PUT route solely for proof replacement. |
| Build checks | Clean and repeated `tsc -b` and Vite build; explicit Node type support; no `@ts-ignore`, `@ts-nocheck`, unnecessary `any`, stray emitted config files, or tsconfig node emit conflict. |
| Regression checks | Existing AURA behavior, auth/security, Tauri/branding, invoice math, amount-in-words, numbering, export, and unrelated backend routes remain passing. |

### Required worked examples and edge cases

- Taxable value ₹25,700, CGST 9%, SGST 9%, zero discount/round-off → CGST ₹2,313, SGST ₹2,313, total ₹30,326, correct words.
- Draft invoice saved, downloaded, and left for an elapsed period remains editable, non-financial, and retains its number when another invoice is created.
- Billed invoice underpaid before due date, after due date, and fully/over-paid produce Outstanding, Overdue, and Received respectively.
- A valid payment with no proof persists normally, emits exactly one payment activity event, and retains its original id/invoiceId after reload.
- A valid payment with one proof first persists the payment row without proof metadata, emits exactly one activity event, then persists the proof metadata/reference only after write and readback validation; refresh and application reopen return the same association.
- Proof write failure before metadata enrichment retains the same payment id/invoiceId, leaves proof metadata absent, returns an actionable `stage: "write"` error, and emits no second payment event.
- Workbook metadata-enrichment failure after attachment creation retains the original payment and blank proof metadata, attempts orphan cleanup, and returns an actionable `stage: "metadata_enrichment"` error without a duplicate payment or activity.
- Attachment readback failure retains the same payment id/invoiceId, does not enrich metadata, attempts orphan cleanup, and returns an actionable `stage: "readback"` proof error.
- Temporary/orphan cleanup succeeds when possible; when it fails, the backend records a safe diagnostic without exposing server paths and does not remove the retained payment.
- A successful replacement reads back and enriches the new file before deleting the prior managed attachment, preserves the same payment id/invoiceId, leaves exactly one current proof reference, creates no proof history, and emits no payment activity event.
- Legacy workbook without proof columns still loads existing payments with `paymentProof=None` and can be migrated without data loss.
- Numeric input sequences `2`, `2.`, clear then `50`, and replacement of `050` do not display stale leading digits.
- Every order/delivery field maps to its own label; all-empty values omit the block.
- Mojibake examples are absent from Create Invoice, InvoicePreview/shared renderer, Receipt, and Settings.

## Implementation Guardrails

- Preserve existing working components and domain behavior; make the smallest change at each boundary.
- Treat the shared renderer/model and payment-proof contract as cross-layer changes that must be implemented and verified together.
- Do not use a page component as a workaround for missing provider/backend fields.
- Do not infer a business decision from an open question.
- Do not change legacy Reports/Intelligence/AURA semantics outside the exact correction allowlist.
- Do not add IGST until a future approved decision defines the complete cross-layer contract.
- Do not create tasks or implement application code as part of this design-generation phase.
