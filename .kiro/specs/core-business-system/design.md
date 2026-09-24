# Design Document

## Amendment Log (Correction Pass)

This design document was amended to reflect the correction pass recorded in `requirements.md`'s own "Amendment Log (Correction Pass)" section. That correction pass was triggered by direct inspection of the already-built application, which showed that `pages/InvoicePage.tsx` had been built as a financial-summary/dashboard (status chip + total-due card + subtotal/tax/discount/round-off grid + amount-in-words + payment history) rather than the actual invoice document, among other findings. This amendment is **documentation-only** — no implementation change is authorized by anything below until a corresponding `tasks.md` update is produced in a later step.

The following changes were made to the design above and below:

- **Superseded — Invoice_Detail_Page design (was: "`pages/InvoicePage.tsx` (NEW) — Invoice Detail page")**: the summary-dashboard layout (status chip, total-due card, subtotal/CGST/SGST/discount/round-off grid, amount-in-words block, payment history as primary content) is corrected. The section is rewritten so the page renders the full invoice document via a new shared `Invoice_Document_Renderer`, with `Invoice_Ledger_Status` and payment history demoted to secondary, supporting information, alongside document actions (Print/PDF, Download, Send Invoice, Send Reminder, Record Payment, Back). See "Invoice_Document_Renderer: single rendering source (Requirement 12)" and "`pages/InvoicePage.tsx` — Invoice Detail page (REDESIGNED per corrected Requirement 5)" below.
- **Added — Invoice_Document_Renderer extraction plan (Requirement 12)**: documents the exact refactor of `components/create-invoice/InvoicePreview.tsx` into the single shared rendering source reused by Create Invoice's preview, the redesigned Invoice_Detail_Page, and the Download path.
- **Added — Create Invoice preview layout fix (Requirement 13)**: documents the specific `grid`/scroll-container change needed so the right-side preview column is not clipped by the sticky footer, without shrinking the document.
- **Added — AURA positioning extension (Requirement 14)**: documents adding `"invoice-detail"` to `PAGES_WITH_STICKY_FOOTER` (or a generalized safe-zone mechanism only if actually needed), as a positioning-only change.
- **Added — Mojibake correction plan (Requirement 15)**: documents the literal find-and-replace correction needed in `pages/CreateInvoicePage.tsx` and `components/create-invoice/InvoicePreview.tsx`, and the grep-based verification step for other files.
- **Amended — Payment_Receipt_View design (Requirement 6 amendment)**: changed from a `Modal`-based key-value list to a proper printable/viewable receipt document layout.
- **Amended — Row-action design (Requirement 2 amendments)**: wording tightened to explicitly confirm Received_Status and Overdue_Status row coverage against the already-built `InvoiceRow.tsx`/`InvoicesPage.tsx` (no new components required — see "Verification against Requirement 2 amendments" below).
- **Added — verification notes for Requirements 17 and 19**: `lib/invoiceNumber.ts` and the amount-in-words pipeline (`lib/amountInWords.ts` + `getInvoiceTotalsWithWords`) were inspected against the newly-added requirements; both are documented as already correct, with reasoning, rather than redesigned.
- **Added — Reports_Page / Intelligence_Page invoice-number-linking finding (Requirement 16 open question)**: documents the confirmed current rendering in `ReportsPage.tsx` and `IntelligencePage.tsx`, and proposes (pending user approval) that `ReportsPage`'s two invoice-number cells become `<InvoiceNumberLink>`.
- **Added — explicit non-decision on billed-invoice editing (Requirement 18 / Open Question 2)**: no editing-of-billed-invoices behavior is designed in this pass.
- **Added — three new correctness properties** (single-invoice-rendering-source identity, AURA non-overlap, amount-in-words-matches-final-total across enumerated scenarios) mapped to Requirements 12, 13, 14, 19.

- **Second correction pass (Requirement 16 approved and designed)**: Requirement 16 has moved from "recommendation pending approval" to **approved and designed**. The prior "Reports_Page / Intelligence_Page invoice-number linking — finding and recommendation (Requirement 16, Open Question 1)" section is replaced in full by "Reports_Page / Intelligence_Page / CommandPalette invoice-number linking — approved design (Requirement 16)" below, which specifies the exact, now-authorized changes to three files:
  - `pages/ReportsPage.tsx` — the invoice-number `<td>` cells confirmed across the "Invoices", "Outstanding", "Overdue", and "Payments" report tables named in Requirement 16.3 become `<InvoiceNumberLink>` (five cell occurrences total, since the "revenue" report renders the same `invoiceRows` data through the identical cell markup as "invoices" and is corrected alongside it, even though Requirement 16.3 names the report by its "Invoices" tab label rather than separately calling out "revenue"). `lib/reports.ts` gains one minimal, narrowly-scoped passthrough field (`invoiceId` on `PaymentReportRow`) — see that section for why this one file needed a change and the other report row shapes did not.
  - `pages/IntelligencePage.tsx` — `openInvoice` is fixed to call `navigateToInvoiceDetail(invoiceId)` instead of `goToInvoices()`.
  - `components/command-palette/CommandPalette.tsx` — the "Invoices" result group's `run` action is fixed to call `navigateToInvoiceDetail(invoice.id)` instead of `goToInvoices(info.status)`.
  - **Explicit non-goal**: no other Reports calculation/filtering/aggregation/export logic, no other Intelligence classification/metrics/signals logic, and no other CommandPalette Quick Actions/Navigation/fuzzy-search/filtering logic is changed anywhere in this pass. This carve-out overrides the prior blanket "Reports/Intelligence are out of scope" boundary for this narrow linking/navigation purpose only, per the resolved Requirement 16 and its corresponding "Out of Scope" carve-out in `requirements.md`.
  - Correctness Property 12 is extended (not superseded) to also cover Reports_Page, Intelligence_Page, and CommandPalette invoice-number links — see the updated Property 12 below.

- Everything else in this document — the ledger-status/rollup calculation design (`getInvoiceLedgerStatus`, `getClientRollup`, `getGlobalRollup`), the terminology rename plan, the Bill/Send/Reminder action separation and modals, the `useWorkspaceStore` navigation additions, the row-action redesign, `MiniTimeline`, the Clients/Client Detail rollup blocks, and Properties 1–16 — remains valid as originally designed and is preserved unchanged below.

## Overview

This design implements the core-workflow changes described in `requirements.md`: separating "billing" from "sending", replacing manual "Mark Paid" with ledger-derived status, removing "Duplicate", adding an Invoice Detail page and a Payment Receipt view, adding client financial rollups, and renaming "Pending"/"Paid" to "Outstanding"/"Received" in the core workflow only.

The guiding constraint from the requirements ("no second implementation of invoice total, rollup, or status computation outside the Invoice_Math_Module") drives most of the structure below: every new number or status shown anywhere is a call into `lib/invoiceMath.ts`, never a locally re-derived value.

Everything here is additive or narrowly modifies existing files under `sft-billing-phase2.2-gst/sft-billing/src`. No backend, AURA, Intelligence, Reports, Workspace Settings, auth, branding, or packaging code is touched **(except the narrow, now-approved Requirement 16 invoice-number-linking carve-out affecting `pages/ReportsPage.tsx`, `lib/reports.ts`, `pages/IntelligencePage.tsx`, and `components/command-palette/CommandPalette.tsx` — see "Reports_Page / Intelligence_Page / CommandPalette invoice-number linking — approved design (Requirement 16)" below; no other Reports/Intelligence/Workspace-Settings/AURA behavior is touched)**. `lib/reports.ts`, `lib/intelligence.ts`, `lib/auraAssistant.ts`, `data/mockActivity.ts`, and `ReportsPage.tsx`/`IntelligencePage.tsx`/`WorkspaceSettingsPage.tsx` keep calling `getInvoiceStatus()` exactly as it exists today — that function's signature and semantics (`draft`/`paid`/`pending`/`overdue`) are **not** changed, for reasons explained in "Two status concepts" below.

## Two status concepts — internal type vs. ledger status vs. display label (Reports/Intelligence/CommandPalette carve-out noted)

**Note (second correction pass):** the statement above — that Reports, Intelligence, and their consumers keep calling `getInvoiceStatus()` unchanged, with no Reports/Intelligence code touched — remains true for every calculation, filter, classification, and metric in those areas. It does **not** extend to the narrow Requirement 16 change: `ReportsPage.tsx`'s and `IntelligencePage.tsx`'s invoice-number *rendering/navigation* is now edited (and `CommandPalette.tsx`'s invoice-result `run` action), while every call into `getInvoiceStatus()`, `lib/reports.ts`'s summary/aggregation functions, and `lib/intelligence.ts` remains exactly as designed below.

The requirements introduce a new concept, `Invoice_Ledger_Status` (`Outstanding` | `Overdue` | `Received`), that must not disturb the existing `InvoiceStatus` type (`"draft" | "paid" | "pending" | "overdue"`) that Reports, Intelligence, AURA, and the backend enum reconciliation (out of scope) all depend on today.

Chosen approach: **add a new, separate function and a new, separate result type in `lib/invoiceMath.ts`, and leave `getInvoiceStatus()` completely untouched.**

- `getInvoiceStatus(invoice, asOf?)` — **unchanged**, same signature, same `InvoiceStatus` return values (`draft`/`pending`/`paid`/`overdue`). Still the single source of truth for Reports, Intelligence, AURA, the command palette, and `MiniTimeline`'s existing step. This satisfies Requirement 10.4 ("the underlying `InvoiceStatus` type value `pending` shall remain valid... so Reports, Intelligence, and AURA continue to function without modification") by construction — nothing about that function or type changes.
- `getInvoiceLedgerStatus(invoice, payments, asOf?)` — **new** function, new return type `InvoiceLedgerStatusInfo` with `status: InvoiceLedgerStatus` (`"outstanding" | "overdue" | "received"`). This is what Requirement 3 actually describes: it takes the invoice's payments as an explicit argument (never fetches them itself, keeping it a pure function) and derives status from the payment sum vs. `computeInvoiceTotals().total`, plus due date.
- A **display-label mapping layer**, not a new field on the type: a small `LEDGER_STATUS_LABEL` map (`outstanding → "Outstanding"`, `overdue → "Overdue"`, `received → "Received"`) used only by the seven core-workflow surfaces named in Requirement 10.1/10.2. `StatusChip` (shared, used by both core and legacy pages) is **not** modified for its `pending`/`paid` copy — instead a new sibling component renders ledger-status chips for core pages. Legacy pages keep using `StatusChip` with `getInvoiceStatus()` exactly as before.

Rejected alternative: extending `InvoiceStatus`/`StatusChip` in place with new label logic. Rejected because Requirement 10.3 requires Reports/Intelligence/Workspace Settings/AURA to keep "Pending"/"Paid" verbatim, and Requirement 9.4 forbids a second computation of status — reusing the exact same `getInvoiceStatus()` untouched, and building a distinct ledger-status function/component pair, is the only way to satisfy both without branching behavior inside a shared function by page identity (which would be fragile and untestable as a pure function).

This means `Invoice_Ledger_Status` is **only relevant to `Billed_Invoice` records** (draft has no ledger status; it's still `"draft"` via `getInvoiceStatus()` for the legacy pages, and Invoice Detail/rows special-case drafts separately per Requirement 5.7).

## Data Models

### `types/invoice.ts`

Add `billedAt`, keep `sentAt` and legacy `paidAt` untouched:

```ts
export interface Invoice {
  // ...unchanged fields...
  isDraft: boolean;
  billedAt?: string;   // NEW — set once, by Bill_Invoice_Action, never cleared
  sentAt?: string;      // unchanged — set by Send_Invoice_Action, may be re-set on resend
  viewedAt?: string;    // unchanged
  paidAt?: string;      // unchanged, legacy field — no longer written by any core-workflow action after this change, but the field and any historical data stay so `getInvoiceStatus()` (used by Reports/Intelligence/AURA) keeps working unmodified. Nothing new reads it for ledger status.
}
```

No change to `InvoiceStatus` or `InvoiceStatusInfo` (Requirement 10.4). A new, separate type is added alongside them:

```ts
export type InvoiceLedgerStatus = "outstanding" | "overdue" | "received";

export interface InvoiceLedgerStatusInfo {
  status: InvoiceLedgerStatus;
  daysOverdue: number;   // 0 unless status === "overdue"
  severity: "mild" | "strong" | null;  // mirrors existing severity gradient, for the reused chip styling
}
```

`Billed_Invoice` is not a new stored discriminant — it's simply `isDraft === false` (equivalently `billedAt` is set once billed). No schema change beyond the one new optional field.

### `types/payment.ts`, `types/activity.ts`

No changes. `Payment` already has everything the Payment Receipt View needs (`amount`, `method`, `receivedAt`, `reference`, `invoiceId`). `ActivityEventType` already has `invoice_reminder_sent` for Send_Reminder_Action — no new event type is required for this feature.

## Component / File-Level Change List

| File | Change |
|---|---|
| `types/invoice.ts` | Add `billedAt?`, add `InvoiceLedgerStatus`/`InvoiceLedgerStatusInfo` types |
| `lib/invoiceMath.ts` | Add `getInvoiceLedgerStatus()`, `getClientRollup()`, `getGlobalRollup()` |
| `hooks/useWorkspaceStore.ts` | Add `selectedInvoiceId`, `navigateToInvoiceDetail()`, `goToInvoices` unaffected |
| `pages/CreateInvoicePage.tsx` | Replace Send-invoice confirm flow with Bill-invoice confirm flow |
| `pages/InvoicePage.tsx` (NEW, REDESIGNED per correction pass) | New Invoice Detail page — renders the full invoice document via `InvoiceDocument`, with ledger status/payment history as secondary content, plus Print/PDF, Download, Send/Reminder/Record-payment, and Back actions |
| `components/create-invoice/InvoiceDocument.tsx` (NEW, correction pass) | Extracted from `InvoicePreview.tsx` — the single Invoice_Document_Renderer, reused by `InvoicePreview` (Create Invoice) and `InvoicePage` (Invoice Detail) |
| `components/create-invoice/InvoicePreview.tsx` (MODIFIED, correction pass) | Becomes a thin wrapper around `InvoiceDocument`; also where the mojibake fix (Requirement 15) is applied, now inherited by `InvoiceDocument` |
| `pages/CreateInvoicePage.tsx` (also MODIFIED, correction pass) | Preview-column layout fix (Requirement 13, independent scroll container) and mojibake fix (Requirement 15), in addition to the Bill-invoice flow change below |
| `pages/PaymentReceiptPage` — folded into `components/payments/PaymentReceiptView.tsx` (NEW, REDESIGNED per correction pass) | New Payment Receipt view, rendered inline on top of Invoices/Payments context, not a top-level `AppPage`; renders as a real receipt document (business details, receipt reference) per amended Requirement 6, not a key-value summary card |
| `components/aura/AuraPanel.tsx` (MODIFIED, correction pass) | Add `"invoice-detail"` to `PAGES_WITH_STICKY_FOOTER` — positioning-only |
| `pages/InvoicesPage.tsx` | Remove `markPaid`/`duplicate`, add reminder-modal wiring, row action split |
| `components/invoices/InvoiceRow.tsx` | Row actions redesigned by draft/billed/status; invoice number becomes a link |
| `components/invoices/BulkActionBar.tsx` | Remove "Mark paid" bulk action |
| `components/invoices/InvoiceFilterBar.tsx` | No change (still filters by legacy `InvoiceStatus`, used only for the existing draft/pending/paid/overdue quick filters — unaffected by ledger status) |
| `components/invoices/MiniTimeline.tsx` | Add a "Billed" step sourced from `billedAt`, ahead of "Sent" |
| `components/shared/LedgerStatusChip.tsx` (NEW) | Chip for `InvoiceLedgerStatusInfo`, labels Outstanding/Overdue/Received |
| `components/shared/InvoiceNumberLink.tsx` (NEW) | Reusable clickable invoice-number link |
| `components/invoices/SendReminderModal.tsx` (NEW) | Confirm/edit/cancel modal, `Confirm_Modal_Pattern` |
| `components/invoices/SendInvoiceModal.tsx` (NEW, extracted) | Confirm modal for Send/Resend on the Detail page |
| `components/invoices/BillInvoiceModal.tsx` (implemented inline in `CreateInvoicePage.tsx`, reusing `Modal`) | Confirm modal for billing |
| `components/invoices/InvoiceDetailActions.tsx` (NEW) | Action set for the Detail page, status-gated |
| `components/invoices/PaymentHistoryList.tsx` (NEW) | Payment list on Detail page, links to receipts |
| `pages/ClientsPage.tsx` | "Since" column → "Total Billed" column via `getClientRollup` |
| `pages/ClientDetailPage.tsx` | Add rollup summary block; invoice rows become links |
| `pages/PaymentsPage.tsx` | Invoice number becomes a link; row becomes clickable to open receipt |
| `pages/OverviewPage.tsx` | No functional change; already excludes drafts via `getInvoiceStatus` filtering (draft bucket separate) — invoice numbers in `FocusedInvoiceList` become links |
| `components/overview/FocusedInvoiceList.tsx` | Invoice number becomes a link |
| `services/dataProvider.ts`, `services/mockDataProvider.ts` | No interface change needed — `saveInvoice(invoice)` already persists arbitrary `Invoice` fields including the new `billedAt`; `getPayments()`/`getInvoices()` already provide everything the rollups and Detail page need client-side |
| `App.tsx` | Add a case for rendering `InvoicePage` for the invoice-detail navigation state |
| `pages/ReportsPage.tsx` | (correction pass, Requirement 16 — invoice-number linking only) Five invoice-number `<td>` cell occurrences (revenue, invoices, outstanding, overdue, payments reports) become `<InvoiceNumberLink>`; no other change |
| `lib/reports.ts` | (correction pass, Requirement 16 — invoice-number linking only) Add `invoiceId: string` passthrough field to `PaymentReportRow`/`buildPaymentReportRows` only; no calculation/filter/aggregation logic changed |
| `pages/IntelligencePage.tsx` | (correction pass, Requirement 16 — invoice-number linking only) `openInvoice` now calls `navigateToInvoiceDetail(invoiceId)` instead of `goToInvoices()`; stale comment and `_` unused-parameter prefix removed; no other change |
| `components/command-palette/CommandPalette.tsx` | (correction pass, Requirement 16 — invoice-number linking only) Invoice-result `run` now calls `navigateToInvoiceDetail(invoice.id)` instead of `goToInvoices(info.status)`; Quick Actions/Navigation items and fuzzy-search/filtering logic unchanged |

### Explicitly unchanged (out of scope, confirmed untouched)

- `pages/ReportsPage.tsx`, `lib/reports.ts` — **no longer fully untouched**: see "Reports_Page / Intelligence_Page / CommandPalette invoice-number linking — approved design (Requirement 16)" below. Only the invoice-number-cell rendering swap (and, for `lib/reports.ts`, the single `invoiceId` passthrough field on `PaymentReportRow`) is in scope; every calculation, filter, date-range, and CSV-export function in both files is otherwise untouched.
- `lib/reportSummaryItems.ts` — confirmed fully untouched; it has no involvement in invoice-number rendering (it only builds `ReportSummary` metric-card items, never a `<td>` cell or navigation handler).
- `pages/IntelligencePage.tsx` — **no longer fully untouched**: see the Requirement 16 section below. Only the `openInvoice` function's navigation target changes; every metric, classification, and signal computation on the page is otherwise untouched.
- `lib/intelligence.ts` — confirmed fully untouched; it has no navigation or rendering responsibility, only classification/metric computation, none of which is affected by Requirement 16.
- `pages/WorkspaceSettingsPage.tsx`
- `components/aura/AuraPanel.tsx`'s response content, classification logic, intelligence behavior, and every file/function it calls into (`lib/auraAssistant.ts`) — **exception, correction pass**: `AuraPanel.tsx`'s `PAGES_WITH_STICKY_FOOTER` `Set` gains one entry (`"invoice-detail"`), a positioning-only change; see "AURA positioning extension (Requirement 14)" below
- `components/command-palette/CommandPalette.tsx` — **no longer fully untouched**: see the Requirement 16 section below. Only the invoice-result `run` action's navigation target changes; Quick Actions, Navigation items, and the fuzzy-match/filter logic are otherwise untouched.
- `types/invoice.ts` — `InvoiceStatus`, `InvoiceStatusInfo`, `paidAt` semantics
- `lib/invoiceMath.ts` — `getInvoiceStatus()` (body and signature), `computeInvoiceTotals()`, `getInvoiceTotalsWithWords()`, `suggestRoundOff()`
- `components/shared/StatusChip.tsx` and its `CONFIG` labels
- `data/mockActivity.ts` generation logic (still reads `getInvoiceStatus()`/legacy fields as-is)
- `services/apiDataProvider.ts`, backend (`backend/app/**`), Tauri config, branding assets, auth/login

## Architecture

```
CreateInvoicePage ──(Bill_Invoice_Action)──> Invoice{isDraft:false, billedAt}
                                                     │
                                                     ▼
InvoicesPage / InvoiceRow ──(View)──> InvoicePage (Invoice Detail)
                                                     │
                                     ┌───────────────┼────────────────────┐
                                     ▼               ▼                    ▼
                          Send_Invoice_Action  Send_Reminder_Action  Record_Payment_Action
                          (sentAt = now)       (activity event)      (existing RecordPaymentModal)
                                                     │
                                                     ▼
                                        PaymentHistoryList ──> PaymentReceiptView
                                                                       ▲
                                                     PaymentsPage row ─┘

ClientsPage / ClientDetailPage ──(getClientRollup)──> Total Billed / rollup block
OverviewPage / InvoicesPage / ClientDetailPage / ClientsPage / PaymentsPage
        └── every invoice number rendered via <InvoiceNumberLink> → navigateToInvoiceDetail
```

All financial math funnels through `lib/invoiceMath.ts`; all navigation funnels through `useWorkspaceStore`, mirroring the existing `selectedClientId`/`navigateToClientDetail` pattern.

## Components and Interfaces

### `lib/invoiceMath.ts` — new exports

```ts
import type { Invoice, Payment, InvoiceLedgerStatusInfo } from "@/types";

/**
 * The ledger-derived counterpart to getInvoiceStatus(), scoped to
 * Billed_Invoice records only. Takes `payments` explicitly (the caller
 * is responsible for filtering to this invoice's payments) so this stays
 * a pure function with no data-layer dependency, matching the existing
 * style of computeInvoiceTotals(). Never reads `paidAt`.
 */
export function getInvoiceLedgerStatus(
  invoice: Invoice,
  payments: Payment[],
  asOf: Date = new Date(),
): InvoiceLedgerStatusInfo {
  const paid = payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + p.amount, 0);
  const { total } = computeInvoiceTotals(invoice);

  if (paid >= total) {
    return { status: "received", daysOverdue: 0, severity: null };
  }

  const due = new Date(invoice.dueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / msPerDay);

  if (daysPastDue <= 0) {
    return { status: "outstanding", daysOverdue: 0, severity: null };
  }

  return {
    status: "overdue",
    daysOverdue: daysPastDue,
    severity: daysPastDue >= 30 ? "strong" : "mild",
  };
}

export interface ClientRollup {
  clientId: string;
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
}

/**
 * Excludes Draft_Invoice records entirely (Requirement 7.3, 8.3, 9.3,
 * 11.2). "Billed" = sum of computeInvoiceTotals().total over every
 * non-draft invoice for the client; the other three buckets partition
 * that same set by getInvoiceLedgerStatus().
 */
export function getClientRollup(clientId: string, invoices: Invoice[], payments: Payment[], asOf: Date = new Date()): ClientRollup {
  const billed = invoices.filter((i) => i.clientId === clientId && !i.isDraft);
  let totalBilled = 0, totalReceived = 0, totalOutstanding = 0, totalOverdue = 0;

  for (const invoice of billed) {
    const { total } = computeInvoiceTotals(invoice);
    totalBilled += total;
    const info = getInvoiceLedgerStatus(invoice, payments, asOf);
    if (info.status === "received") totalReceived += total;
    else if (info.status === "outstanding") totalOutstanding += total;
    else totalOverdue += total;
  }

  return { clientId, totalBilled, totalReceived, totalOutstanding, totalOverdue };
}

export interface GlobalRollup {
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
}

/** Same computation as getClientRollup but across every non-draft invoice — used where a workspace-wide (not per-client) figure is needed. */
export function getGlobalRollup(invoices: Invoice[], payments: Payment[], asOf: Date = new Date()): GlobalRollup {
  const billed = invoices.filter((i) => !i.isDraft);
  let totalBilled = 0, totalReceived = 0, totalOutstanding = 0, totalOverdue = 0;
  for (const invoice of billed) {
    const { total } = computeInvoiceTotals(invoice);
    totalBilled += total;
    const info = getInvoiceLedgerStatus(invoice, payments, asOf);
    if (info.status === "received") totalReceived += total;
    else if (info.status === "outstanding") totalOutstanding += total;
    else totalOverdue += total;
  }
  return { totalBilled, totalReceived, totalOutstanding, totalOverdue };
}
```

`getInvoiceStatus()`, `computeInvoiceTotals()`, `getInvoiceTotalsWithWords()`, `suggestRoundOff()` are copied here unmodified (no diff) — shown only to make clear nothing about them changes.

### `hooks/useWorkspaceStore.ts` — additions

Mirrors the existing `selectedClientId` / `navigateToClientDetail` / `goToClients` triple exactly:

```ts
interface WorkspaceState {
  // ...existing fields...

  /** Which invoice's detail view to show. Distinguished from other pages by a dedicated AppPage value, "invoice-detail", so it can be reached from any page (Overview, Clients, Invoices, Payments) without first navigating to Invoices. */
  selectedInvoiceId: string | null;
  navigateToInvoiceDetail: (invoiceId: string) => void;

  /** Which payment's receipt to show, layered the same way. */
  selectedPaymentId: string | null;
  navigateToPaymentReceipt: (paymentId: string) => void;
  closePaymentReceipt: () => void;
}

export type AppPage =
  | "overview" | "invoices" | "create-invoice" | "clients"
  | "payments" | "intelligence" | "reports" | "settings"
  | "invoice-detail"; // NEW

// implementation:
selectedInvoiceId: null,
navigateToInvoiceDetail: (invoiceId) => set({ currentPage: "invoice-detail", selectedInvoiceId: invoiceId }),

selectedPaymentId: null,
navigateToPaymentReceipt: (paymentId) => set({ selectedPaymentId: paymentId }),
closePaymentReceipt: () => set({ selectedPaymentId: null }),
```

Design choice: `invoice-detail` is a distinct top-level `AppPage` (unlike Client Detail, which reuses `"clients"` + a null check) because the Detail page must be reachable directly from Overview, Payments, and Clients — not only from Invoices — per Requirement 5.8. A dedicated page value keeps `App.tsx`'s switch simple and makes "which page is showing" unambiguous regardless of entry point. The Payment Receipt view is deliberately **not** a page value — it's a lightweight overlay (`selectedPaymentId` gates a `Modal`-free full-panel view, or a `Modal`, rendered by `AppShell`/`App.tsx` on top of whichever page is current) so that both "Invoice Detail → payment history → receipt" and "Payments list → receipt" return to their originating page on close, rather than forcing navigation away from Payments.

### `App.tsx`

```tsx
case "invoice-detail":
  return (
    <AppShell>
      <InvoicePage />
    </AppShell>
  );
```

`AppShell`'s children render as today; the Payment Receipt overlay is rendered once, unconditionally, inside `AppShell` (or at the top of `App`) keyed off `selectedPaymentId` from the store, so it can appear regardless of `currentPage`.

### `components/shared/InvoiceNumberLink.tsx` (NEW)

```tsx
interface InvoiceNumberLinkProps {
  invoice: Pick<Invoice, "id" | "number">;
  className?: string;
}

export function InvoiceNumberLink({ invoice, className }: InvoiceNumberLinkProps) {
  const navigateToInvoiceDetail = useWorkspaceStore((s) => s.navigateToInvoiceDetail);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); navigateToInvoiceDetail(invoice.id); }}
      className={cn("font-medium text-ink underline-offset-2 hover:text-accent hover:underline", className)}
    >
      {invoice.number}
    </button>
  );
}
```

Used verbatim (same import, same props shape) in: `InvoiceRow.tsx`, `FocusedInvoiceList.tsx`, `ClientsPage.tsx` (client-level "Total Billed" doesn't need it, but per-invoice rows would if the Clients page ever lists invoices — it currently doesn't, so this page only needs the rollup, not this component; kept `ClientsPage` in the list because Requirement 7.4 requires invoice numbers "shown anywhere on the page" to remain links — satisfied vacuously today since none render there, and by this component if the page later gains an invoice list), `ClientDetailPage.tsx`, `PaymentsPage.tsx` row, `PaymentReceiptView.tsx`.

### `components/shared/LedgerStatusChip.tsx` (NEW)

Same shape and accessibility rule as `StatusChip` (label + icon, never color alone), but for `InvoiceLedgerStatusInfo`:

```tsx
const CONFIG = {
  received: { label: "Received", icon: CheckCircle2, classes: "bg-success-bg text-success" },
  outstanding: { label: "Outstanding", icon: Clock, classes: "bg-pending-bg text-pending" },
} as const;

export function LedgerStatusChip({ info, className }: { info: InvoiceLedgerStatusInfo; className?: string }) {
  if (info.status === "overdue") {
    // identical overdue rendering to StatusChip (severity gradient, "N days overdue")
  }
  const { label, icon: Icon, classes } = CONFIG[info.status];
  return ( /* same markup shape as StatusChip */ );
}
```

Used on: `InvoicesPage`/`InvoiceRow` (billed rows only), `InvoicePage` (Detail), `ClientDetailPage` invoice history rows, `ClientsPage` (not needed — no per-invoice status there), `PaymentsPage` (not needed — payments don't carry a ledger status). Draft rows keep using the existing `StatusChip` with `getInvoiceStatus()` (status `"draft"`), since ledger status is undefined for drafts.

### `pages/CreateInvoicePage.tsx` — Bill Invoice flow

Replace the "Send invoice" button/modal/handler with a "Bill invoice" equivalent. No `sentAt` involvement here at all — that moves entirely to the Detail page.

```tsx
// Footer button:
<Button onClick={() => setConfirmOpen(true)} disabled={!ready || saving}>
  <CheckCircle2 size={14} /> Bill invoice
</Button>

// Modal:
<Modal
  open={confirmOpen}
  onClose={() => setConfirmOpen(false)}
  title="Bill this invoice?"
  footer={
    <>
      <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
      <Button onClick={handleConfirmBill} disabled={saving}>
        {saving ? "Billing…" : "Bill invoice"}
      </Button>
    </>
  }
>
  This will mark invoice {draft.number} ({formatCurrency(totals.total)}) as billed for{" "}
  <span className="font-medium text-ink">{client?.name ?? "the selected client"}</span>, due {formatDate(draft.dueDate)}.
  It will not be emailed — you can send it from the invoice's detail page whenever you're ready.
</Modal>
```

```tsx
async function handleConfirmBill() {
  if (!draft) return;
  setSaving(true);
  const now = new Date().toISOString();
  const wasNew = !invoices?.some((i) => i.id === draft.id);
  const billedInvoice: Invoice = { ...draft, isDraft: false, billedAt: now };
  await activeDataProvider.saveInvoice(billedInvoice);
  if (wasNew) {
    await activeDataProvider.addActivityEvent({
      type: "invoice_created",
      occurredAt: now,
      summary: `Invoice ${draft.number} created for ${getClientName(clients, draft.clientId)}`,
      clientId: draft.clientId, invoiceId: draft.id, amount: totals?.total,
    });
  }
  setSaving(false);
  setConfirmOpen(false);
  reloadInvoices();
  setToast(`Invoice ${draft.number} billed`);
  setTimeout(() => goToInvoices(), 600);
}
```

Note: `billedInvoice` never sets `sentAt` — satisfying Requirement 1.2 directly (the field is simply absent from the spread/override). No `invoice_sent` activity event is created here anymore; that event now originates from the Detail page's `Send_Invoice_Action`. The `Send` icon/import is dropped from this file since sending no longer happens here; `FileDown`/`ArrowLeft`/`ChevronDown` and the rest of the page are unaffected. `Ctrl/Cmd+Enter` now triggers the bill-confirmation modal instead of send.

### `components/create-invoice/InvoiceDocument.tsx` (NEW) — Invoice_Document_Renderer (Requirement 12)

**Finding from direct inspection**: `components/create-invoice/InvoicePreview.tsx` already renders the correct full invoice document — logo, business identity, GSTIN/PAN, "Tax Invoice" heading, dates, bill-to with client GSTIN, order/delivery details, HSN-coded line items, taxable value/discount/CGST/SGST/round-off/grand total, amount in words, bank details, and authorized signatory. It takes exactly the three props (`invoice`, `client`, `business`) the requirement's Invoice_Document_Renderer needs, and computes every figure via `getInvoiceTotalsWithWords` already. The already-built `pages/InvoicePage.tsx`, by contrast, does **not** reuse this component — it re-implements a different, incorrect summary layout from scratch. That divergence is the root cause of the numbers/document mismatch flagged in the correction pass.

**Chosen refactor approach**: extract `InvoicePreview.tsx`'s JSX verbatim into a new, page-agnostic component `components/create-invoice/InvoiceDocument.tsx`, exported as `InvoiceDocument`, with the exact same props shape (`invoice`, `client`, `business`) and no page-specific behavior (no `key`-based cross-fade tied to Create Invoice's live-typing scenario needs to move — see below). `InvoicePreview.tsx` becomes a thin wrapper:

```tsx
// components/create-invoice/InvoicePreview.tsx (after refactor)
import { InvoiceDocument } from "./InvoiceDocument";

export function InvoicePreview({ invoice, client, business }: InvoicePreviewProps) {
  return <InvoiceDocument invoice={invoice} client={client} business={business} />;
}
```

Rejected alternative: inlining the document JSX directly into `pages/InvoicePage.tsx` and separately into `InvoicePreview.tsx`. Rejected because Requirement 12.2 explicitly forbids "a second, independent visual rendering of an invoice document outside the Invoice_Document_Renderer" — duplicating the JSX would recreate exactly the drift risk (numbers/layout disagreeing between pages) that Requirement 12 exists to close.

`InvoiceDocument` keeps the existing `AnimatePresence`/`motion.span` cross-fade on the grand total (`key={totals.total}`) — this is a cosmetic detail that is harmless when reused on a static (non-typing) Detail page or a download context; it plays exactly once on mount and does not need to be conditionally stripped out.

**Who imports `InvoiceDocument`:**
- `components/create-invoice/InvoicePreview.tsx` — via the thin wrapper above, used unchanged by `CreateInvoicePage.tsx`.
- `pages/InvoicePage.tsx` (redesigned below) — directly, as the primary content of the Invoice_Detail_Page.
- Any future Print/PDF output — see "Print/PDF action" below; the Download action reuses the existing Excel-generation pipeline instead of `InvoiceDocument` (Requirement 12.4), documented next.

### Download action — reuse existing mechanism (Requirement 12.4)

**Finding from direct inspection**: `components/create-invoice/DownloadInvoiceButton.tsx` and `services/invoiceExportService.ts` already implement a complete, working Excel-workbook download (`downloadInvoiceWorkbook({ invoice, client, business })`), taking the same three inputs as `InvoiceDocument`. The Invoice_Detail_Page's Download action reuses this exact component and service — `<DownloadInvoiceButton invoice={invoice} client={client} business={business} />` — rather than inventing a second download mechanism. This satisfies Requirement 12.4 directly: no new export/print/PDF mechanism is introduced for the Download action.

Note that today's `InvoiceRow.tsx` still renders a disabled "Download" button labeled "PDF export — Phase 4" — that placeholder is about a *per-row* PDF affordance and is out of scope for this pass (it predates this feature and is not named in any requirement above); it is left as-is. Only the new Invoice_Detail_Page (and Create Invoice's existing `DownloadInvoiceButton` usage) are affected by this design.

### Print/PDF action — scoped decision (Requirement 5.7)

**Finding from direct inspection**: no PDF-generation library and no print stylesheet exist anywhere in the codebase. `window.print()` is already used exactly once, on `ReportsPage.tsx` (`handlePrint`, wired to `ExportBar`'s "Print / PDF" button), with no accompanying `@media print` CSS anywhere in the project (confirmed by search) — so today's "Print/PDF" on Reports simply calls the browser's native print dialog against the on-screen layout, unstyled for print.

**Decision**: the Invoice_Detail_Page's "Print/PDF" action is implemented the same minimal way — a button that calls `window.print()` against the page while `InvoiceDocument` is rendered as the primary content — with no new PDF-generation dependency added. This is the narrowest change consistent with Requirement 5.7 ("a Print/PDF action") and Requirement 12.4 ("SHALL NOT introduce a new print/PDF mechanism... unless no equivalent mechanism exists for a required output format" — no PDF-specific mechanism exists at all, so reusing the one existing pattern, `window.print()`, is the correct read of that clause). A minimal print-oriented style adjustment (e.g. hiding the `PageHeader` back button, action buttons, and secondary status/payment-history block via a `print:hidden` Tailwind utility on those elements, so only `InvoiceDocument` prints) is in scope as a small CSS-only addition, since it directly serves making the printed output usable and does not add a library or generation pipeline. Generating an actual PDF file (as opposed to the browser's native print-to-PDF via the print dialog) is explicitly not implemented — this document does not invent a PDF-generation library where none exists, consistent with the instruction to keep this decision narrowly scoped.

### `pages/InvoicePage.tsx` — Invoice Detail page (REDESIGNED per corrected Requirement 5)

**What changes from the original design**: the page's primary content is no longer a status chip + total-due card + subtotal/tax/discount/round-off grid. It is now the full invoice document, rendered via `InvoiceDocument`. `Invoice_Ledger_Status` and payment history move to a secondary block below the document. Document actions (Print/PDF, Download, Send Invoice, Send Reminder, Record Payment, Back) surround the document rather than being the page's only content.

```tsx
export function InvoicePage() {
  const { data: invoices, loading: invoicesLoading, reload: reloadInvoices } = useInvoices();
  const { data: payments, loading: paymentsLoading, reload: reloadPayments } = usePayments();
  const { data: clients, loading: clientsLoading } = useClients();
  const { selectedInvoiceId, goToInvoices, openCreateInvoice, navigateToPaymentReceipt } = useWorkspaceStore();

  const invoice = invoices?.find((i) => i.id === selectedInvoiceId);
  const invoicePayments = useMemo(
    () => (payments ?? []).filter((p) => p.invoiceId === selectedInvoiceId),
    [payments, selectedInvoiceId],
  );
  const client = clients?.find((c) => c.id === invoice?.clientId);
  const ledgerInfo = invoice && !invoice.isDraft ? getInvoiceLedgerStatus(invoice, invoicePayments) : null;

  // loading / not-found states unchanged from the original design (mirror ClientDetailPage's pattern)

  return (
    <div>
      <PageHeader
        title={invoice.number}
        subtitle={getClientName(clients, invoice.clientId)}
        action={
          <button type="button" onClick={() => goToInvoices()} className="print:hidden ...">
            <ArrowLeft size={14} /> Back to invoices
          </button>
        }
      />

      <div className="space-y-8 px-10 py-7">
        {/* PRIMARY CONTENT — the actual invoice document, identical rendering
            source and figures as Create Invoice's preview and the download */}
        <InvoiceDocument invoice={invoice} client={client} business={business} />

        {/* Document actions — surround the document, do not replace it */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="...">
            <Printer size={14} /> Print / PDF
          </button>
          <DownloadInvoiceButton invoice={invoice} client={client} business={business} />
          <InvoiceDetailActions
            invoice={invoice}
            ledgerInfo={ledgerInfo}
            onContinueEditing={() => openCreateInvoice({ invoiceId: invoice.id, clientId: invoice.clientId, items: invoice.items, gst: invoice.gst, discount: invoice.discount, notes: invoice.notes, terms: invoice.terms, supplierCode: invoice.supplierCode, poNumber: invoice.poNumber, poDate: invoice.poDate, transporter: invoice.transporter })}
            onSent={reloadInvoices}
            onReminderSent={() => {}}
            onPaymentRecorded={() => { reloadInvoices(); reloadPayments(); }}
          />
        </div>

        {/* SECONDARY, SUPPORTING INFORMATION — status and payment history,
            positioned below/outside the document, never above or in place of it */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-5 print:hidden">
          {invoice.isDraft ? (
            <StatusChip info={{ status: "draft", daysOverdue: 0, severity: null }} />
          ) : (
            ledgerInfo && <LedgerStatusChip info={ledgerInfo} />
          )}
        </div>

        <div className="print:hidden">
          <p className="mb-3 text-sm font-medium text-ink">Payment history</p>
          <PaymentHistoryList payments={invoicePayments} onOpenReceipt={navigateToPaymentReceipt} />
        </div>
      </div>
    </div>
  );
}
```

`business` (the `BusinessProfile`) is fetched the same way `CreateInvoicePage.tsx` already fetches it (an existing hook, e.g. `useBusinessProfile()`) — the original design's omission of `business` from this page's data fetching was itself a symptom of not reusing `InvoiceDocument`; the redesign requires it since the document needs it.

`InvoiceDetailActions`, `PaymentHistoryList`, `LedgerStatusChip`, `StatusChip`, and the `useWorkspaceStore`/navigation wiring are all unchanged from the original design (see below) — only this page's layout and its choice of primary content changed. Requirement 5.8 (Draft_Invoice shows "continue editing" instead of billed-invoice actions) is preserved via `InvoiceDetailActions`' existing `invoice.isDraft` branch.

### `components/invoices/InvoiceDetailActions.tsx` (NEW)

Encapsulates the status-gated action set for Requirement 5.6/5.7 (also reused conceptually — not literally, see `InvoiceRow` below — for the row-level gating logic in Requirement 2):

```tsx
interface InvoiceDetailActionsProps {
  invoice: Invoice;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  onContinueEditing: () => void;
  onSent: () => void;
  onReminderSent: () => void;
  onPaymentRecorded: () => void;
}

export function InvoiceDetailActions({ invoice, ledgerInfo, onContinueEditing, onSent, onReminderSent, onPaymentRecorded }: InvoiceDetailActionsProps) {
  const [sendOpen, setSendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  if (invoice.isDraft) {
    return (
      <Button onClick={onContinueEditing}><Pencil size={14} /> Continue editing</Button>
    );
  }

  const canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
  const canRecordPayment = ledgerInfo?.status !== "received";

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setSendOpen(true)}>
        <Send size={14} /> {invoice.sentAt ? "Resend invoice" : "Send invoice"}
      </Button>
      {canRemind && (
        <Button variant="secondary" onClick={() => setReminderOpen(true)}>
          <BellRing size={14} /> Send reminder
        </Button>
      )}
      {canRecordPayment && (
        <Button variant="secondary" onClick={() => setRecordOpen(true)}>
          <IndianRupee size={14} /> Record payment
        </Button>
      )}

      <SendInvoiceModal open={sendOpen} onClose={() => setSendOpen(false)} invoice={invoice} onSent={() => { setSendOpen(false); onSent(); }} />
      <SendReminderModal open={reminderOpen} onClose={() => setReminderOpen(false)} invoice={invoice} onSent={() => { setReminderOpen(false); onReminderSent(); }} />
      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} invoices={[invoice]} onRecorded={() => { setRecordOpen(false); onPaymentRecorded(); }} />
    </div>
  );
}
```

`RecordPaymentModal` is the existing component from `components/payments/RecordPaymentModal.tsx` — reused as-is, scoped to this one invoice.

### `components/invoices/SendInvoiceModal.tsx` (NEW, extracted from the old CreateInvoicePage logic)

```tsx
export function SendInvoiceModal({ open, onClose, invoice, onSent }: { open: boolean; onClose: () => void; invoice: Invoice; onSent: () => void }) {
  const { data: clients } = useClients();
  const [saving, setSaving] = useState(false);
  const client = clients?.find((c) => c.id === invoice.clientId);
  const { total } = computeInvoiceTotals(invoice);
  const isResend = Boolean(invoice.sentAt);

  async function handleConfirm() {
    setSaving(true);
    const now = new Date().toISOString();
    await activeDataProvider.saveInvoice({ ...invoice, sentAt: now }); // billedAt untouched — not part of the spread's overrides
    await activeDataProvider.addActivityEvent({
      type: "invoice_sent",
      occurredAt: now,
      summary: `Invoice ${invoice.number} ${isResend ? "resent" : "sent"} to ${getClientName(clients, invoice.clientId)}`,
      clientId: invoice.clientId, invoiceId: invoice.id, amount: total,
    });
    setSaving(false);
    onSent();
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={isResend ? "Resend this invoice?" : "Send this invoice?"}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={saving}>{saving ? "Sending…" : isResend ? "Resend invoice" : "Send invoice"}</Button>
      </>}
    >
      This will email invoice {invoice.number} ({formatCurrency(total)}) to{" "}
      <span className="font-medium text-ink">{client?.email ?? "the selected client"}</span>.
    </Modal>
  );
}
```

### `components/invoices/SendReminderModal.tsx` (NEW)

Follows `Confirm_Modal_Pattern` and Requirement 4.1–4.3: review/edit/confirm/cancel, no real delivery, no activity event on cancel.

```tsx
export function SendReminderModal({ open, onClose, invoice, onSent }: { open: boolean; onClose: () => void; invoice: Invoice; onSent: () => void }) {
  const { data: clients } = useClients();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMessage(`Hi, this is a reminder that invoice ${invoice.number} is due ${formatDate(invoice.dueDate)}. Please let us know if you have any questions.`);
    }
  }, [open, invoice.number, invoice.dueDate]);

  async function handleConfirm() {
    setSaving(true);
    await activeDataProvider.addActivityEvent({
      type: "invoice_reminder_sent",
      occurredAt: new Date().toISOString(),
      summary: `Reminder sent for invoice ${invoice.number} to ${getClientName(clients, invoice.clientId)}`,
      clientId: invoice.clientId, invoiceId: invoice.id,
    });
    setSaving(false);
    onSent();
  }

  return (
    <Modal open={open} onClose={onClose} title="Send a reminder?" footer={<>
      <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
      <Button onClick={handleConfirm} disabled={saving}>{saving ? "Sending…" : "Send reminder"}</Button>
    </>}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-border-strong"
      />
      <p className="mt-2 text-xs text-ink-faint">This records a reminder in the activity log — no email is actually sent.</p>
    </Modal>
  );
}
```

This same component is used from both the Invoices_Page row action and the Invoice_Detail_Page action (Requirement 4.1), taking `invoice` as a prop either way.

### `pages/InvoicesPage.tsx` — changes

- Remove `markPaid()`, `duplicate()`, `bulkMarkPaid()`, and their UI wiring (`onMarkPaid`, `onDuplicate` props to `InvoiceRow`, the "Mark paid"/"Duplicate" buttons, the `computeInvoiceTotals`/`recordPayment` calls that composed `markPaid`).
- Remove the `Duplicate`/`CheckCircle2` icon imports that become unused; keep `Send`/others used elsewhere.
- `sendReminder(invoice)` stays conceptually but is superseded by opening `SendReminderModal` per row instead of firing immediately — see `InvoiceRow` below. The page keeps a `reminderTarget: Invoice | null` state to know which invoice's modal is open, plus `sendInvoiceTarget: Invoice | null` for the Send-invoice-from-row case (Requirement 2.3).
- `editDraft(invoice)` stays unchanged (still opens Create Invoice with a prefill).
- `getInvoiceStatus` import stays (still used for the filter bar's draft/pending/paid/overdue quick filters, and to detect `"draft"` for row rendering); a new `getInvoiceLedgerStatus` import is added for billed rows.
- `BulkActionBar` loses its "Mark paid" button (see below); "Send reminders" bulk action opens one `SendReminderModal` per selected invoice in sequence, or is simplified to just fire `invoice_reminder_sent` events directly for the bulk case since Requirement 4 only mandates the modal for the single-invoice `Send_Reminder_Action`, not bulk — kept as direct activity-event creation, matching today's `bulkSendReminders` behavior, to avoid stacking multiple modals. This is not a batch action named in the requirements, so its existing simple form (loop + `addActivityEvent`) is preserved unchanged; only `bulkMarkPaid` is removed.

```tsx
const [reminderTarget, setReminderTarget] = useState<Invoice | null>(null);
const [sendTarget, setSendTarget] = useState<Invoice | null>(null);

// row callbacks:
onSendReminder={() => setReminderTarget(invoice)}
onSendInvoice={() => setSendTarget(invoice)}
onRecordPayment={() => setRecordTarget(invoice)}   // opens existing RecordPaymentModal, scoped to this invoice

// render once, outside the row loop:
<SendReminderModal open={Boolean(reminderTarget)} invoice={reminderTarget!} onClose={() => setReminderTarget(null)} onSent={() => { setReminderTarget(null); setToast(`Reminder sent for ${reminderTarget?.number}`); }} />
<SendInvoiceModal open={Boolean(sendTarget)} invoice={sendTarget!} onClose={() => setSendTarget(null)} onSent={() => { setSendTarget(null); reload(); setToast(`Invoice ${sendTarget?.number} sent`); }} />
```

### `components/invoices/InvoiceRow.tsx` — redesign

Props change from `onMarkPaid`/`onDuplicate` to `onSendInvoice`/`onRecordPayment`; `onSendReminder` and `onEdit` stay. Invoice number becomes `<InvoiceNumberLink invoice={invoice} />` instead of a plain `<span>`. Status chip becomes conditional: `StatusChip` for drafts (via `getInvoiceStatus`), `LedgerStatusChip` for billed invoices (via `getInvoiceLedgerStatus`, which needs `payments` — passed down as a new `payments: Payment[]` prop, or the row computes it by filtering a `payments` list passed from `InvoicesPage`, which already has `usePayments()` available or is added).

```tsx
interface InvoiceRowProps {
  invoice: Invoice;
  clients: Client[] | undefined;
  payments: Payment[] | undefined;   // NEW — needed for ledger status
  isSelected: boolean;
  onToggleSelect: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSendReminder: () => void;
  onSendInvoice: () => void;      // replaces onMarkPaid
  onRecordPayment: () => void;    // NEW
  onEdit: () => void;
  // onDuplicate removed entirely
  busy?: boolean;
}
```

```tsx
const invoicePayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
const isDraft = invoice.isDraft;
const info = isDraft ? getInvoiceStatus(invoice) : null;                       // legacy, draft-only here
const ledgerInfo = isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments); // ledger, billed-only

// row status cell:
{isDraft ? <StatusChip info={info!} /> : <LedgerStatusChip info={ledgerInfo!} />}

// expanded action row:
{isDraft ? (
  <>
    <button onClick={onEdit}><Pencil size={12} /> Edit</button>
    <button onClick={onBill}><CheckCircle2 size={12} /> Bill invoice</button>
  </>
) : (
  <>
    <InvoiceNumberLink invoice={invoice} className="sr-only" /> {/* number already links at row level; not repeated here */}
    <button onClick={() => navigateToInvoiceDetail(invoice.id)}><Eye size={12} /> View</button>
    {!invoice.sentAt && <button onClick={onSendInvoice}><Send size={12} /> Send invoice</button>}
    {(ledgerInfo!.status === "outstanding" || ledgerInfo!.status === "overdue") && (
      <button onClick={onSendReminder}><BellRing size={12} /> Send reminder</button>
    )}
    {ledgerInfo!.status !== "received" && (
      <button onClick={onRecordPayment}><IndianRupee size={12} /> Record payment</button>
    )}
  </>
)}
```

`onBill` for a draft row's "Bill invoice" action opens `Create_Invoice_Page` pre-filled via `openCreateInvoice({ invoiceId: invoice.id, ... })` — the same navigation `editDraft` already performs; "Bill invoice" from the row is intentionally just "continue editing and bill from there" rather than a second, row-level bill confirmation, since Requirement 1 defines Bill_Invoice_Action as happening on the Create_Invoice_Page specifically. `CheckCircle2`/`Copy` imports: `Copy` (Duplicate icon) removed; `CheckCircle2` kept but now labels "Bill invoice" instead of "Mark paid"; `Eye`, `BellRing`, `IndianRupee` added.

### `components/invoices/BulkActionBar.tsx`

Remove the "Mark paid" button and `onMarkPaid` prop entirely (Requirement 2.6/3.7 — no manual mark-paid path anywhere). "Send reminders" and "Clear" stay.

### `components/invoices/MiniTimeline.tsx`

Add a "Billed" step before "Sent", sourced from the new field; keep the existing final-status step untouched (still keyed off legacy `info.status`/`paidAt`, since `MiniTimeline` is also used inside `InvoiceRow` for **draft** rows where ledger status doesn't apply — for billed rows the timeline's final step continues to reflect `getInvoiceStatus()`'s `paid`/`pending`/`overdue`, which is a display nicety, not the row's authoritative status chip; the authoritative chip is `LedgerStatusChip` shown separately in the row header. This keeps `MiniTimeline` a pure, unmodified-signature component functionally, with one added step):

```tsx
const steps = [
  { label: "Created", done: true, date: invoice.issueDate },
  { label: "Billed", done: Boolean(invoice.billedAt), date: invoice.billedAt },  // NEW
  { label: "Sent", done: Boolean(invoice.sentAt), date: invoice.sentAt },
  { label: "Viewed", done: Boolean(invoice.viewedAt), date: invoice.viewedAt },
  { label: FINAL_LABEL[info.status], done: info.status === "paid", date: invoice.paidAt },
];
```

### `pages/ClientsPage.tsx`

Replace the "Since" column with "Total Billed", computed via `getClientRollup`:

```tsx
const { data: payments } = usePayments();

function totalBilled(clientId: string): number {
  return getClientRollup(clientId, invoices ?? [], payments ?? []).totalBilled;
}

// row:
<span className="w-32 shrink-0 text-right font-tabular text-ink">{formatCurrency(totalBilled(client.id))}</span>
```

(replacing `<span className="w-32 shrink-0 text-ink-faint">Since {formatDate(client.clientSince)}</span>`)

### `pages/ClientDetailPage.tsx`

Add a rollup summary block above the existing contact-info grid, and swap each invoice row's plain `<span>{invoice.number}</span>` for `<InvoiceNumberLink>`; swap `StatusChip`+`getInvoiceStatus` for `LedgerStatusChip`+`getInvoiceLedgerStatus` on non-draft rows (drafts keep `StatusChip`, matching the row-level pattern used in `InvoiceRow`):

```tsx
const { data: payments } = usePayments();
const rollup = useMemo(
  () => (selectedClientId ? getClientRollup(selectedClientId, invoices ?? [], payments ?? []) : null),
  [selectedClientId, invoices, payments],
);

// new block, above the contact grid:
{rollup && (
  <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-5 sm:grid-cols-4">
    <div><p className="text-xs font-medium text-ink-faint">Total billed</p><p className="font-tabular mt-1 text-lg text-ink">{formatCurrency(rollup.totalBilled)}</p></div>
    <div><p className="text-xs font-medium text-ink-faint">Received</p><p className="font-tabular mt-1 text-lg text-success">{formatCurrency(rollup.totalReceived)}</p></div>
    <div><p className="text-xs font-medium text-ink-faint">Outstanding</p><p className="font-tabular mt-1 text-lg text-pending">{formatCurrency(rollup.totalOutstanding)}</p></div>
    <div><p className="text-xs font-medium text-ink-faint">Overdue</p><p className="font-tabular mt-1 text-lg text-overdue">{formatCurrency(rollup.totalOverdue)}</p></div>
  </div>
)}
```

### `pages/PaymentsPage.tsx`

Invoice number becomes `<InvoiceNumberLink>`; the whole row becomes clickable to open the receipt (Requirement 6.3):

```tsx
<div
  key={payment.id}
  role="button"
  tabIndex={0}
  onClick={() => navigateToPaymentReceipt(payment.id)}
  className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-canvas cursor-pointer"
>
  <span className="w-28 shrink-0 text-ink-muted">{formatDate(payment.receivedAt)}</span>
  <InvoiceNumberLink invoice={{ id: payment.invoiceId, number: invoiceNumber(payment.invoiceId) }} className="w-24 shrink-0" />
  {/* ...rest unchanged... */}
</div>
```

`InvoiceNumberLink`'s `stopPropagation` ensures clicking the number goes to Invoice Detail, while clicking elsewhere in the row opens the Payment Receipt — both are valid navigation targets named in Requirements 5.8 and 6.3/6.4 respectively.

### `components/payments/PaymentReceiptView.tsx` (NEW) — REVISED per amended Requirement 6

**What changes from the original design**: Requirement 6's amendment strengthens the Payment_Receipt_View definition to require "a real printable/viewable receipt document with business details, not a generic summary card." The original design below (a `Modal` wrapping a plain key-value `<div>` list, no business details) is a generic summary card and no longer satisfies Requirement 6.1/6.2. It is replaced with a printable receipt-document layout, structurally similar in spirit to `InvoiceDocument` (business identity block at top, a clear "Payment Receipt" heading, then receipt fields) but far simpler, since a payment receipt has no line items or tax breakdown.

```tsx
interface PaymentReceiptViewProps {
  paymentId: string;
  onClose: () => void;
}

/**
 * A real receipt document, not a key-value summary card (Requirement 6.1,
 * 6.2) — business identity block, a receipt/payment reference, and the
 * payment's details, laid out to be printable/viewable the same way
 * InvoiceDocument is, though simpler (no line items or tax breakdown).
 */
export function PaymentReceiptView({ paymentId, onClose }: PaymentReceiptViewProps) {
  const { data: payments } = usePayments();
  const { data: invoices } = useInvoices();
  const { data: business } = useBusinessProfile();
  const payment = payments?.find((p) => p.id === paymentId);
  const invoice = invoices?.find((i) => i.id === payment?.invoiceId);

  if (!payment) return null;

  return (
    <Modal open onClose={onClose} title="Payment receipt" footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="mx-auto w-full max-w-[480px] rounded-lg border border-border bg-surface p-8">
        {/* Business identity block — same fields InvoiceDocument leads with */}
        <div className="flex items-start gap-3 border-b border-border pb-4">
          {business?.logoUrl && <img src={business.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />}
          <div>
            <p className="font-display text-base text-ink">{business?.name ?? "Your Company"}</p>
            <p className="mt-0.5 max-w-[280px] text-xs text-ink-muted">{business?.address}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="font-display text-lg text-ink">Payment Receipt</p>
          <p className="font-tabular text-xs text-ink-faint">Receipt {payment.id}</p>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-faint">Invoice</span>
            {invoice ? <InvoiceNumberLink invoice={invoice} /> : <span>{"Unknown invoice"}</span>}
          </div>
          <div className="flex justify-between"><span className="text-ink-faint">Customer</span><span className="text-ink">{getClientName(undefined /* resolved via invoice.clientId + clients */, invoice?.clientId)}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Payment date</span><span className="text-ink">{formatDate(payment.receivedAt)}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-medium"><span className="text-ink-faint">Amount received</span><span className="font-tabular text-ink">{formatCurrency(payment.amount)}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Method</span><span className="text-ink">{METHOD_LABELS[payment.method]}</span></div>
          <div className="flex justify-between"><span className="text-ink-faint">Reference</span><span className="text-ink">{payment.reference ?? "—"}</span></div>
        </div>
      </div>
    </Modal>
  );
}
```

`METHOD_LABELS` is currently defined locally inside `PaymentsPage.tsx`; it moves to a small shared export (e.g. `lib/formatters.ts` or a new `lib/paymentLabels.ts`) so both `PaymentsPage` and `PaymentReceiptView` use the same map — this is the one small refactor needed to avoid duplicating that lookup, in keeping with the "single source" spirit of the requirements, though it's not itself an `Invoice_Math_Module` concern. `useBusinessProfile()` is the same existing hook `CreateInvoicePage.tsx` already uses to fetch the business profile for `InvoicePreview`/`InvoiceDocument`.

Note: whether this receipt document is presented inside the existing `Modal` chrome (current design, retained above for consistency with how the rest of this feature surfaces overlays) or as its own full-panel view is a presentation detail, not a requirement conflict — Requirement 6.1/6.2 require the *document content* to be a real receipt, not that it must avoid `Modal` entirely; `Modal` here is just the surrounding chrome, and its content is no longer a plain key-value list.

Rendered once, near the root of `AppShell` (or `App.tsx`), gated on `selectedPaymentId` from the store:

```tsx
const selectedPaymentId = useWorkspaceStore((s) => s.selectedPaymentId);
const closePaymentReceipt = useWorkspaceStore((s) => s.closePaymentReceipt);
{selectedPaymentId && <PaymentReceiptView paymentId={selectedPaymentId} onClose={closePaymentReceipt} />}
```

### `components/invoices/PaymentHistoryList.tsx` (NEW)

```tsx
interface PaymentHistoryListProps {
  payments: Payment[];
  onOpenReceipt: (paymentId: string) => void;
}

export function PaymentHistoryList({ payments, onOpenReceipt }: PaymentHistoryListProps) {
  if (payments.length === 0) {
    return <EmptyState icon={Inbox} title="No payments recorded yet" />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {payments.map((payment) => (
        <button
          key={payment.id}
          type="button"
          onClick={() => onOpenReceipt(payment.id)}
          className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-canvas"
        >
          <span className="w-28 shrink-0 text-ink-muted">{formatDate(payment.receivedAt)}</span>
          <span className="font-tabular flex-1 text-ink">{formatCurrency(payment.amount)}</span>
          <span className="w-32 shrink-0 text-ink-muted">{METHOD_LABELS[payment.method]}</span>
        </button>
      ))}
    </div>
  );
}
```

## Create Invoice preview layout fix (Requirement 13)

**Finding from direct inspection**: `pages/CreateInvoicePage.tsx` currently uses:

```tsx
<div className="grid flex-1 grid-cols-1 gap-8 overflow-y-auto px-10 py-8 lg:grid-cols-2">
  {/* LEFT — the builder */}
  <div className="space-y-6">...</div>
  {/* RIGHT — the live preview */}
  <div>
    <InvoicePreview invoice={draft} client={client} business={business} />
  </div>
</div>
{/* Sticky footer — running total always visible, no scrolling required */}
<div className="flex items-center justify-between border-t border-border bg-surface px-10 py-4">...</div>
```

The `overflow-y-auto` is on the *outer* grid, shared by both columns. Because the left column (form fields) and right column (preview) scroll together as one region, and the fixed-height sticky footer sits below the grid but outside its scroll area, the preview's bottom (round-off/grand-total/amount-in-words) can end up scrolled past the visible area or visually crowded against the footer, depending on how tall the left form is relative to the viewport — this is the defect Requirement 13 targets.

**Chosen fix**: give the right-side preview column its own independent scroll container, decoupled from the left column's scroll position, and reserve space for the sticky footer via height calculation rather than relying on the shared `overflow-y-auto`:

```tsx
<div className="grid flex-1 grid-cols-1 gap-8 px-10 py-8 lg:grid-cols-2 lg:overflow-hidden">
  {/* LEFT — the builder — scrolls independently */}
  <div className="space-y-6 overflow-y-auto lg:h-full lg:pr-1">...</div>

  {/* RIGHT — the live preview — scrolls independently, never clipped by the footer */}
  <div className="overflow-y-auto lg:h-full">
    <InvoicePreview invoice={draft} client={client} business={business} />
  </div>
</div>
```

Rationale: making the outer grid `lg:overflow-hidden` (desktop breakpoint only, matching the existing `lg:grid-cols-2` split) and giving each column `lg:h-full overflow-y-auto` means the grid's own height is exactly the flex-remaining space above the sticky footer (`flex-1` already provides this), and each column scrolls within that fixed height independently — the preview can never be pushed below the footer because it has its own bounded, scrollable box, not a claim on space shared with a taller left column. Below the `lg` breakpoint (stacked single-column layout), the original single shared scroll (`overflow-y-auto` on the outer container, no `lg:` prefix needed there since columns stack vertically) is preserved, since there's no side-by-side clipping problem in that layout.

This is a layout-only change — no change to `InvoiceDocument`/`InvoicePreview`'s internal font sizes, spacing, or content, so the preview is not shrunk to an illegible size (Requirement 13.3); it simply gains its own scrollbar when its content is taller than the available column height, exactly like the left form already does today.

## AURA positioning extension (Requirement 14)

**Finding from direct inspection**: `components/aura/AuraPanel.tsx` already has exactly the mechanism Requirement 14.2 describes — a `PAGES_WITH_STICKY_FOOTER` `Set` (currently `new Set(["create-invoice"])`) and a `bottomOffsetClass` (`hasStickyFooter ? "bottom-24" : "bottom-6"`) applied to both the collapsed mark and the expanded panel.

**Chosen change**: add `"invoice-detail"` to `PAGES_WITH_STICKY_FOOTER`:

```ts
const PAGES_WITH_STICKY_FOOTER = new Set(["create-invoice", "invoice-detail"]);
```

This is sufficient because the redesigned Invoice_Detail_Page (per Requirement 5/12 above) does not introduce a new bottom-fixed action bar of its own — its document actions (Print/PDF, Download, Send/Reminder/Record payment, Back) are laid out inline in the page body above the document/secondary info, not pinned to the viewport bottom. Reusing the existing two-value `bottomOffsetClass` (`bottom-24`/`bottom-6`) is therefore sufficient; a more general "safe zone" mechanism is not needed, since no page in scope for this feature requires a third offset value. If a future page introduces its own distinct bottom-fixed bar with a different height, that would be the trigger to generalize this mechanism — not part of this pass.

No other file under `components/aura/*` or `lib/auraAssistant.ts` changes — this is strictly the one-line `Set` addition above, per Requirement 14.3's explicit prohibition on touching AURA's response content, classification logic, or intelligence behavior.

## Mojibake correction (Requirement 15)

**Finding from direct inspection**: literal mojibake byte sequences are confirmed present in exactly two source files: `pages/CreateInvoicePage.tsx` and `components/create-invoice/InvoicePreview.tsx` (soon `InvoiceDocument.tsx`, per the Requirement 12 extraction above — the correction should be applied to wherever this JSX lives after that extraction). Confirmed substrings and their intended characters:

| Mojibake | Intended character | Example location |
|---|---|---|
| `Â·` | `·` (middle dot) | bank details line: `{business.bank.bankName} Â· {business.bank.branch}` |
| `â€”` | `—` (em dash) | code comments, e.g. "Renders the invoice as it will actually look â€”" |
| `â€¦` | `…` (ellipsis) | e.g. `"Preparing a blank invoiceâ€¦"`, `"Billingâ€¦"` |
| `âˆ’` | `−` (minus sign) | discount/round-off lines: `âˆ’{formatCurrency(totals.discount)}` |
| `Â§` | `§` (section sign) | code comment: `"see blueprint Â§4.3"` |

**Root cause**: this is a direct UTF-8/Latin-1 double-encoding artifact from a prior edit (each mojibake sequence is the classic pattern of a UTF-8-encoded em dash/ellipsis/minus/section sign/middle dot having been re-interpreted and re-saved as Latin-1/Windows-1252 text) — it is not a font issue and not a rendering-layer issue, since the same garbled bytes appear both inside rendered JSX text nodes (visible to users) and inside plain code comments (never rendered at all, only visible in source). A font or CSS fix could not explain garbled comment text; only a literal find-and-replace of the byte sequences in the source files fixes both.

**Chosen fix**: a direct, literal find-and-replace of each mojibake substring with its correct Unicode character, scoped to the two confirmed files above (and, after the Requirement 12 extraction, the new `InvoiceDocument.tsx` file that inherits this content from `InvoicePreview.tsx`). This is a text-substitution task, not a code-logic change — no component behavior, props, or structure changes as a result.

**Verification step (implementation-time, not part of this design-only pass)**: an implementation-time grep across the full `src/` tree for the five confirmed byte sequences (`Â·`, `â€”`, `â€¦`, `âˆ’`, `Â§`) is the correct way to confirm no other file carries the same defect before closing this requirement out. This design does not assume any other file is affected — the two files above are the only ones confirmed by direct inspection — but the grep step is called out explicitly so implementation does not skip verifying the rest of the tree.

## Reports_Page / Intelligence_Page / CommandPalette invoice-number linking — approved design (Requirement 16)

Requirement 16 is now **approved and resolved** (see `requirements.md`'s second correction pass and the corresponding "Out of Scope" carve-out). This section replaces the prior pending recommendation with the exact, authorized design. It touches exactly three source files (`pages/ReportsPage.tsx`, `pages/IntelligencePage.tsx`, `components/command-palette/CommandPalette.tsx`) and, for one narrow reason explained below, one line of a fourth (`lib/reports.ts`). Nothing else in Reports, Intelligence, or CommandPalette changes.

### Finding from direct inspection (corrected count)

`pages/ReportsPage.tsx` renders invoice numbers as plain, non-clickable `<td>` cells in **four** `renderRow` callbacks (five cell occurrences, since `invoiceRows` is rendered by two separate blocks — the "revenue" report and the "invoices" report both use the same `invoiceRows` data and the same cell markup):

| Report (`reportId`) | Row source | Cell markup |
|---|---|---|
| `"revenue"` | `invoiceRows` (`buildInvoiceReportRows`) | `<td className="px-4 py-2.5 font-medium text-accent">{r.number}</td>` |
| `"invoices"` | `invoiceRows` (`buildInvoiceReportRows`) | `<td className="px-4 py-2.5 font-medium text-accent">{r.number}</td>` |
| `"outstanding"` | `outstandingRows` (`buildOutstandingReportRows`) | `<td className="px-4 py-2.5 font-medium text-accent">{r.invoiceNumber}</td>` |
| `"overdue"` | `overdueRows` (filtered from `outstandingRows`) | `<td className="px-4 py-2.5 font-medium text-accent">{r.invoiceNumber}</td>` |
| `"payments"` | `paymentRows` (`buildPaymentReportRows`) | `<td className="px-4 py-2.5 text-accent">{r.invoiceNumber}</td>` (no `font-medium`) |

All five use `text-accent` styling that visually resembles a link but have no `onClick`/navigation behavior today.

`pages/IntelligencePage.tsx` has:

```tsx
function openInvoice(_invoiceId: string) {
  // Invoice detail view doesn't exist yet - the closest real destination is
  // the Invoices list, already filtered to what the person is looking for.
  goToInvoices();
}
```

wired to `<AttentionList items={attentionItems} onOpenInvoice={openInvoice} />`. The parameter is unused today (hence the `_` prefix) and the comment is stale — the Invoice_Detail_Page now exists (Requirement 5, corrected).

`components/command-palette/CommandPalette.tsx` builds `invoiceResults: PaletteItem[]` from `(invoices ?? []).slice(0, 200).map((invoice) => ({ ..., run: () => goToInvoices(info.status) }))`. Each mapped palette item already closes over the specific `invoice` object, so `invoice.id` is available at the point `run` is defined — no lookup is needed.

### `pages/ReportsPage.tsx` (and `lib/reports.ts`) — id-availability analysis and chosen approach

`InvoiceNumberLink` requires `Pick<Invoice, "id" | "number">`. Checking each report row shape in `lib/reports.ts` against this:

- `InvoiceReportRow` (backs `invoiceRows`, used by the "revenue" and "invoices" reports): already has `id: invoice.id` alongside `number: invoice.number`. **No `lib/reports.ts` change needed** — `ReportsPage.tsx` can pass `<InvoiceNumberLink invoice={{ id: r.id, number: r.number }} />` directly.
- `OutstandingReportRow` (backs `outstandingRows`/`overdueRows`, used by the "outstanding" and "overdue" reports): already has `id: invoice.id` alongside `invoiceNumber: invoice.number`. **No `lib/reports.ts` change needed** — `<InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} />`.
- `PaymentReportRow` (backs `paymentRows`, used by the "payments" report): its `id` field is `payment.id`, **not** the invoice id — `buildPaymentReportRows` only stores `invoiceNumber: invoices.find((i) => i.id === payment.invoiceId)?.number ?? "Unknown invoice"` and discards the invoice id it already resolved in that same lookup. This is the one genuine gap: the row shape does not carry a resolvable invoice id today.

  Two options were considered for this one row shape:
  - (a) Add an `id`-passthrough field to `PaymentReportRow`/`buildPaymentReportRows` in `lib/reports.ts` (e.g. `invoiceId: invoices.find((i) => i.id === payment.invoiceId)?.id ?? null`, reusing the exact same `.find(...)` call already being made for `invoiceNumber` — no new lookup, no new logic, purely storing a value already computed).
  - (b) Resolve the id in `ReportsPage.tsx` itself by looking up `invoices.find((i) => i.number === r.invoiceNumber)` against the already-fetched `invoices` list, avoiding any `lib/reports.ts` change.

  **Chosen: (a).** Option (b) is less minimal in practice: invoice numbers are not guaranteed unique-lookup-friendly at the page layer the way `invoiceId` already is inside `buildPaymentReportRows` (which resolves by `payment.invoiceId`, the authoritative foreign key), and doing the lookup a second time in the page would duplicate logic that already exists one line earlier in the same builder function. Option (a) is a single added field, assigned from a value the function already computes, with zero change to any existing field, filter, sort, or CSV-export behavior — it satisfies the "add an `id` field... purely for navigation purposes" framing exactly, and does not touch `computeInvoiceTotals`, `getInvoiceStatus`, sorting, or the `payments-report.csv` export columns (which continue to reference `r.id`, `r.invoiceNumber`, etc. unchanged; `invoiceId` is not added to the CSV export).

  **Exact change**: add `invoiceId: string | null` to the `PaymentReportRow` interface, and set it from the existing lookup:
  ```ts
  export interface PaymentReportRow {
    id: string;
    invoiceId: string | null; // added — Requirement 16, navigation only
    invoiceNumber: string;
    clientName: string;
    receivedAt: string;
    amount: number;
    method: Payment["method"];
  }

  export function buildPaymentReportRows(payments: Payment[], invoices: Invoice[], clients: Client[]): PaymentReportRow[] {
    return payments
      .map((payment) => {
        const invoice = invoices.find((i) => i.id === payment.invoiceId);
        return {
          id: payment.id,
          invoiceId: invoice?.id ?? null, // added
          invoiceNumber: invoice?.number ?? "Unknown invoice",
          clientName: getClientName(clients, payment.clientId),
          receivedAt: payment.receivedAt,
          amount: payment.amount,
          method: payment.method,
        };
      })
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }
  ```
  This is a pure passthrough addition: the `.find(...)` call itself is unchanged (only hoisted into a local `invoice` variable so both `invoiceId` and `invoiceNumber` read from the same lookup instead of computing it once for `invoiceNumber` alone), no filtering, sorting, aggregation, or CSV column changes result.

**`pages/ReportsPage.tsx` cell changes** — all five occurrences become `<InvoiceNumberLink>`, e.g.:
```tsx
// revenue / invoices reports (invoiceRows, InvoiceReportRow):
<td className="px-4 py-2.5 font-medium"><InvoiceNumberLink invoice={{ id: r.id, number: r.number }} /></td>

// outstanding / overdue reports (outstandingRows/overdueRows, OutstandingReportRow):
<td className="px-4 py-2.5 font-medium"><InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} /></td>

// payments report (paymentRows, PaymentReportRow):
<td className="px-4 py-2.5">
  {r.invoiceId ? <InvoiceNumberLink invoice={{ id: r.invoiceId, number: r.invoiceNumber }} /> : r.invoiceNumber}
</td>
```
The `r.invoiceId ? ... : r.invoiceNumber` fallback on the payments row handles the pre-existing `"Unknown invoice"` case (a payment whose `invoiceId` no longer resolves to a live invoice) — that case has no invoice to link to, so it renders as plain text exactly as today, with no navigation. This is the "genuine complication" called out in the task: report rows are not always guaranteed to resolve to a live invoice (a payment can reference a deleted/missing invoice), and the design does not force a link where none is possible. No other row shape has this gap.

No column headers, sort order, filters, date-range logic, CSV export logic, or summary calculations (`computeRevenueSummary`, `computeInvoiceSummary`, `computePaymentSummary`, `computeOutstandingSummary`, `computeOverdueSummary`, `computeClientSummaryTotals`) change anywhere in `lib/reports.ts` or `ReportsPage.tsx`. The "client-summary" report is untouched entirely (it has no invoice-number column).

### `pages/IntelligencePage.tsx` — fix

```tsx
function openInvoice(invoiceId: string) {
  navigateToInvoiceDetail(invoiceId);
}
```
`navigateToInvoiceDetail` is destructured from `useWorkspaceStore()` alongside the already-destructured `goToInvoices` (both remain in use — `goToInvoices` is still called elsewhere on the page, e.g. the "View all" link near the top of the page, which is unrelated to `AttentionList` and stays unchanged). The stale comment and the `_` unused-parameter prefix are removed since the parameter is now used. No other function, metric, classification, or signal computation on the page changes.

### `components/command-palette/CommandPalette.tsx` — fix

`navigateToInvoiceDetail` is destructured from `useWorkspaceStore()` alongside the already-destructured `goToInvoices`, `openCreateInvoice`, `navigateTo`, etc. Only the invoice-result mapping changes:
```tsx
const invoiceResults: PaletteItem[] =
  (invoices ?? []).slice(0, 200).map((invoice) => {
    const info = getInvoiceStatus(invoice);
    const { total } = computeInvoiceTotals(invoice);
    const clientName = getClientName(clients, invoice.clientId);
    return {
      id: `inv-${invoice.id}`,
      group: "Invoices" as const,
      label: `${invoice.number} — ${clientName}`,
      hint: `${formatCurrency(total)} · ${info.status}`,
      icon: FileText,
      available: true,
      run: () => navigateToInvoiceDetail(invoice.id), // was: () => goToInvoices(info.status)
    };
  });
```
The `quickActions` items (`"Show overdue invoices"`, `"Show pending invoices"`, etc., which still call `goToInvoices(...)` intentionally — they navigate to a filtered list, not a single invoice) and the `navigation` items (`navigateTo(target.page)`) are unchanged. The fuzzy-match/filter/sort logic (`fuzzyMatch`, the `filtered`/`grouped` `useMemo`s) is unchanged.

### Explicit reiteration of scope boundary

No changes are made anywhere in this pass to: Reports calculation, filtering, date-range resolution, aggregation, or CSV export logic (`resolvePresetRange`, `filterInvoices`, `filterPayments`, every `compute*Summary`/`build*Rows` function's actual data-shaping logic beyond the one added `invoiceId` passthrough field); Intelligence classification, metrics, or signal logic (`lib/intelligence.ts`, and every other function/computation in `IntelligencePage.tsx` besides `openInvoice`); or CommandPalette's Quick Actions, Navigation items, or fuzzy-search/filtering logic. This is the complete, exhaustive list of changes authorized by Requirement 16.

## Billed-invoice editing — explicit non-decision (Requirement 18, Open Question 2)

Per Open Question 2 in `requirements.md`, whether a Billed_Invoice can be edited after billing — and if so, under what constraints — is an open business decision. **No editing-of-billed-invoices behavior is designed in this pass.** `InvoiceDetailActions` (as designed above) does not offer an "Edit" action for billed invoices; only Draft_Invoice records get a "Continue editing" action, unchanged from the original design. Requirement 18 (drafts remain editable indefinitely, no forced finalization or reminder nagging) is already satisfied by the existing design with no further change: nothing in this feature ever forces a Draft_Invoice to be billed, and no reminder/nag logic is introduced for drafts anywhere in this document — `Send_Reminder_Action` is defined only for Billed_Invoice records with Outstanding_Status or Overdue_Status (Requirement 2.4, Property 5), never for drafts.

## Verification against Requirement 2 amendments — Received_Status and Overdue_Status rows

Requirement 2's amendment extends the row-action acceptance criteria to explicitly cover Received_Status rows (AC 2.6: "View invoice" and payment/receipt access) and Overdue_Status rows (AC 2.7: "View invoice", "Send reminder", and "Record payment"). Re-reading the row-action design above (`InvoiceRow.tsx`'s `canRemind`/`canRecordPayment` gating) against these two new ACs confirms the existing design already satisfies both without any new component:

- **Received_Status row** (AC 2.6): `canRecordPayment = ledgerInfo?.status !== "received"` is `false` for Received_Status, so "Record payment" is correctly hidden; "View" is unconditional (`onView` always rendered) — satisfying "View invoice"; payment/receipt access is satisfied because `PaymentHistoryList`/`PaymentsPage` rows link to `Payment_Receipt_View` regardless of the invoice's current ledger status (that list is keyed by `invoiceId`, not by status), so a fully-paid invoice's payment history remains reachable.
- **Overdue_Status row** (AC 2.7): `canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue"` is `true` for Overdue_Status, and `canRecordPayment` is also `true` (status is not `"received"`) — so both "Send reminder" and "Record payment" render, alongside the unconditional "View"/"View invoice" affordance. This exactly matches AC 2.7's three named actions.

No new component or prop is required; this is a wording/verification tightening of the existing design only, confirming Property 5 ("Row and Detail actions are fully determined by draft/billed state and ledger status") already covers both amended ACs.

## Verification against Requirement 17 — invoice numbering stability

**Finding from direct inspection**: `lib/invoiceNumber.ts`'s `nextInvoiceNumber(existing: Invoice[])` scans every existing invoice's number (draft or billed alike — it does not filter by `isDraft`), extracts the numeric suffix, and returns `INV-${max + 1}`. Because it is a pure read of the current `existing` array with no mutation, it never rewrites or reassigns any invoice's already-stored `number` field — a Draft_Invoice's `number`, once assigned (at Create Invoice open time, per the function's existing doc comment), is simply data on that `Invoice` object and is untouched by any later call to `nextInvoiceNumber()` for a *different*, new invoice. Since the scan includes drafts in the `max` computation, a new invoice's number is always strictly greater than every existing number, draft or billed — satisfying "assign the next incrementing invoice number without altering any existing Draft_Invoice's assigned number" (AC 17.2) and "never reuse an invoice number already assigned" (AC 17.3) by construction, as long as invoice numbers are only ever assigned via this one function (true today — it is called once per Create Invoice session per its doc comment).

**Conclusion: already correct, no change needed.** No gap was found against Requirement 17's four acceptance criteria. This is a verification note, not a new design.

## Verification against Requirement 19 — amount-in-words derives from the final rounded total

**Finding from direct inspection**: `getInvoiceTotalsWithWords()` in `lib/invoiceMath.ts` calls `computeInvoiceTotals(invoice)` to get `{ ..., total }` (where `total = Math.max(0, rawTotal + roundOff)` — i.e. the taxable value plus CGST plus SGST plus round-off, already the final rounded grand total, never an intermediate subtotal or pre-round-off amount), and then returns `{ ...totals, amountInWords: amountInWords(totals.total) }` — i.e. `amountInWords()` is called on that same final `total`, not on `rawTotal`, `subtotal`, or any other intermediate figure. `amountInWords()` itself (`lib/amountInWords.ts`) splits its single numeric input into a whole-rupee integer part (`Math.floor`) and a paise remainder (`Math.round((... - rupees) * 100)`), so it correctly handles whole-rupee totals (paise clause omitted when `paise === 0`) and totals with paise (rendered as `"... and N Paise"`) from that one shared input — it has no separate code path keyed on discount, item count, or GST type, so positive/negative round-off, zero/non-zero discount, single/multiple line items, and CGST/SGST-vs-none all flow through the identical `total → amountInWords(total)` pipeline with no branching that could cause drift.

**Conclusion: already correct, no change needed** against AC 19.1 and 19.2. AC 19.3 (Create Invoice preview, Invoice Detail, and Download/Print all show the same amount-in-words value) is satisfied by construction once the Requirement 12 `Invoice_Document_Renderer` extraction above is in place — all three surfaces call `getInvoiceTotalsWithWords()` (directly, or via `InvoiceDocument`, which calls it internally) on the same invoice object, so they can never disagree. This is a verification note, not a new design; it is called out here because Requirement 19 is new and its satisfaction depends on the Requirement 12 work landing correctly.

## Terminology Rename Plan (Requirement 10)

Exact rename map, applied **only** through the new `LedgerStatusChip` + a small label constant, never by editing `StatusChip`'s `CONFIG`:

| Legacy label (unchanged, `StatusChip`) | Core-workflow label (new, `LedgerStatusChip`) | Legacy `InvoiceStatus` value | New `InvoiceLedgerStatus` value |
|---|---|---|---|
| "Pending" | "Outstanding" | `"pending"` | `"outstanding"` |
| "Paid" | "Received" | `"paid"` | `"received"` |
| "Overdue" (unchanged label both places) | "Overdue" | `"overdue"` | `"overdue"` |
| "Draft" (unchanged label both places) | n/a (drafts use `StatusChip`, not `LedgerStatusChip`) | `"draft"` | n/a |

Files that switch from `StatusChip`/`getInvoiceStatus` to `LedgerStatusChip`/`getInvoiceLedgerStatus` for **billed** invoices (drafts keep `StatusChip` everywhere):

- `pages/InvoicesPage.tsx` / `components/invoices/InvoiceRow.tsx`
- `pages/InvoicePage.tsx` (new Detail page)
- `pages/ClientDetailPage.tsx`
- `components/overview/FocusedInvoiceList.tsx` — **exception**: this component is reused only for Overview's click-through drill-down keyed on legacy `InvoiceStatus` values (`pending`/`paid`/`overdue`/`draft`) coming from `StatStrip`/`overviewFocus`. Requirement 10.1 does list Overview_Page among the pages that must show "Outstanding"/"Received" labels, so `FocusedInvoiceList`'s status chip rendering switches to a ledger-based lookup too: for each invoice found via `getInvoiceStatus`-based filtering (unchanged, since `overviewFocus` itself stays a legacy `InvoiceStatus`), the **displayed chip** for non-draft invoices uses `getInvoiceLedgerStatus`/`LedgerStatusChip` instead of `StatusChip`, while the *filtering* key (`overviewFocus`, `StatStrip` labels "Pending"/"Paid"/"Overdue"/"Draft") is left alone. This does mean `StatStrip`'s own labels ("Pending", "Paid") are **not** in the Requirement 10.1 list of pages required to change — re-reading Requirement 10.1, it names `Overview_Page` generally, not `StatStrip` specifically. To keep this unambiguous and avoid inventing a filter model that doesn't match ledger semantics, `StatStrip`'s labels are relabeled too: "Pending" → "Outstanding", "Paid" → "Received" (its `ORDER` array's `label` field only — its `status` keys stay the legacy `InvoiceStatus` values, since that's what drives `overviewFocus`/`computeStatusTotals`, which are explicitly out of scope for recomputation). This is a label-only change to `StatStrip.tsx`'s `ORDER` constant, not a logic change.
- `pages/PaymentsPage.tsx` — has no status chip today; nothing to relabel there.
- `pages/CreateInvoicePage.tsx` — has no status chip (it only ever shows drafts); nothing to relabel there, satisfying Requirement 10.1's inclusion of Create_Invoice_Page vacuously (there is no legacy label present to begin with).

Files that must **not** change their labels (Requirement 10.3), and are not touched:

- `pages/ReportsPage.tsx` (uses `StatusChip` with `r.status` from `lib/reports.ts`, itself built on unmodified `getInvoiceStatus`)
- `pages/IntelligencePage.tsx` / `lib/intelligence.ts`
- `pages/WorkspaceSettingsPage.tsx`
- `components/aura/*`, `lib/auraAssistant.ts`
- `components/command-palette/CommandPalette.tsx` (uses `getInvoiceStatus` for its palette entries — a cross-cutting utility, not one of the seven named core pages; left unchanged since Requirement 10.1 enumerates specific pages and this isn't one of them)
- `components/invoices/InvoiceFilterBar.tsx`'s `STATUS_OPTIONS` labels ("Pending", "Paid") — **kept as-is**. These labels drive the `statusFilter` (legacy `InvoiceStatus`) quick filters on `InvoicesPage`, which continue to filter by `getInvoiceStatus()` for a different purpose (raw draft/pending/paid/overdue bucketing, still meaningful e.g. to distinguish "fully unpaid & not yet overdue" as a filter even though the *chip* now reads "Outstanding"). Because Requirement 10.1 says the page must *display* "Outstanding" wherever it previously *labeled* "Pending", and the filter bar's chip-style buttons are themselves a label of that state, this is relabeled too: `{ value: "pending", label: "Outstanding" }`, `{ value: "paid", label: "Received" }` — value (legacy `InvoiceStatus`) stays, display label changes. This is consistent with `StatStrip`'s treatment above and keeps exactly one rename surface (`label` strings) without touching any status computation.

## Data Provider Impacts

No changes to the `DataProvider` interface (`services/dataProvider.ts`) or `mockDataProvider.ts` are required:

- `saveInvoice(invoice: Invoice)` already accepts and persists the full `Invoice` shape, including the new optional `billedAt` — no signature change needed, since TypeScript's structural typing means the new field just flows through `invoiceStore[index] = invoice`.
- `getPayments()` already returns all payments; `getClientRollup`/`getGlobalRollup`/`getInvoiceLedgerStatus`/the Detail page's payment history all filter this list client-side by `invoiceId`/`clientId`, exactly like `PaymentsPage` does today for `invoiceNumber()`.
- `getInvoices()` already returns all invoices needed for rollups.
- No new lookup method (e.g. "get payments for invoice X") is introduced at the provider layer — filtering an already-fetched array client-side matches the existing pattern (`ClientDetailPage` already filters `invoices` by `clientId` this way) and avoids growing the provider interface for a feature explicitly scoped to stay within the existing calculation layer.

`services/apiDataProvider.ts` (backend-facing) is out of scope per the requirements' exclusion of backend `InvoiceStatus` reconciliation, and is not modified — it already passes through arbitrary invoice fields via `toFrontendInvoice`/generic JSON, so `billedAt` would round-trip once the backend adds the column, but that backend work is explicitly not part of this spec.

## Error Handling

- **Invoice Detail page, invoice not found** (bad/stale `selectedInvoiceId`, e.g. after external deletion): render the same `EmptyState` pattern `ClientDetailPage` uses for "Client not found", with a "Back to invoices" action.
- **Payment Receipt view, payment not found**: `PaymentReceiptView` returns `null` render (closes silently) if `paymentId` doesn't resolve — mirrors defensive `find()` fallbacks used elsewhere (`getClientName`).
- **Confirm modals (Bill/Send/Reminder/Record payment) mid-flight failures**: `activeDataProvider` calls are all `await`ed with a `saving` boolean disabling the confirm button, matching the existing `CreateInvoicePage`/`InvoicesPage` pattern; no new error-toast plumbing is introduced beyond what exists (the mock provider never rejects, and this is out of scope to change for the same "no rewrite" reason network/error-boundary work isn't).
- **Ledger status computation with an empty payments array**: `getInvoiceLedgerStatus` handles `paid = 0` naturally (falls through to the outstanding/overdue branch based on due date) — no special-casing needed, it's the same arithmetic as any partial payment.
- **Draft invoices passed into `getInvoiceLedgerStatus`**: not a defined input for that function per this design (it's only ever called on `!invoice.isDraft` invoices, mirrored by TypeScript call-site discipline, not a runtime guard) — callers are responsible for branching on `isDraft` first, matching how `getInvoiceStatus` itself branches internally instead. Consistent with `computeInvoiceTotals`'s existing convention of not runtime-validating invariants the type system and call sites already guarantee.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Billing sets billedAt and clears draft status without touching sentAt

For any draft invoice (with any prior `sentAt` value, including unset), performing the Bill_Invoice_Action results in an invoice with `isDraft === false`, `billedAt` equal to the confirmation timestamp, and `sentAt` unchanged from its value before billing.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Confirming Bill invoice persists and navigates

For any valid draft ready to bill (passes `isDraftReadyToSend`), confirming the Bill_Invoice_Action modal results in the invoice being saved with `isDraft === false` and `billedAt` set, and the workspace navigating to the Invoices_Page.

**Validates: Requirements 1.6**

### Property 3: Send Invoice availability is exactly "billed invoice, on the Detail page"

For any invoice, a "Send invoice"/"Resend invoice" affordance is present if and only if the invoice is a Billed_Invoice and the current page is the Invoice_Detail_Page; it is never present on the Create_Invoice_Page for any invoice, regardless of that invoice's state.

**Validates: Requirements 1.7**

### Property 4: Sending sets sentAt without touching billedAt, and label follows sentAt

For any Billed_Invoice (with any prior `sentAt` value, including unset), performing the Send_Invoice_Action results in `sentAt` equal to the confirmation timestamp and `billedAt` unchanged; the action's affordance reads "Resend invoice" if and only if `sentAt` was already set before the action, and "Send invoice" otherwise.

**Validates: Requirements 1.8, 1.9**

### Property 5: Row and Detail actions are fully determined by draft/billed state and ledger status

For any invoice and any set of payments:
- if the invoice is a Draft_Invoice, the action set shown (on the Invoices_Page row and the Invoice_Detail_Page) is exactly {Edit, Bill invoice} / {Continue editing}, and never includes Send invoice, Send reminder, or Record payment;
- if the invoice is a Billed_Invoice, "View" is always present; "Send invoice" is present if and only if `sentAt` is unset; "Send reminder" is present if and only if `getInvoiceLedgerStatus` reports Outstanding_Status or Overdue_Status; "Record payment" is present if and only if `getInvoiceLedgerStatus` does not report Received_Status.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 5.6, 5.7**

### Property 6: Removed actions never appear

For any invoice, in any state, on the Invoices_Page (row or bulk action bar) or anywhere else in its interface, no "Mark paid" action and no "Duplicate" action is ever rendered.

**Validates: Requirements 2.6, 2.7, 2.8, 3.7**

### Property 7: Ledger status is a pure function of payment sum, total, and due date

For any Billed_Invoice and any list of payments and any `asOf` date:
- if the sum of payments whose `invoiceId` matches the invoice is greater than or equal to `computeInvoiceTotals(invoice).total`, `getInvoiceLedgerStatus` reports Received_Status;
- otherwise, if `asOf` is on or before the invoice's due date, it reports Outstanding_Status;
- otherwise, it reports Overdue_Status with `daysOverdue` equal to the whole number of days `asOf` is past the due date.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 8: Ledger status is independent of the legacy paidAt flag

For any Billed_Invoice and any list of payments, changing only the invoice's `paidAt` field (any value, including removing it) does not change the result of `getInvoiceLedgerStatus` for that invoice and payment list.

**Validates: Requirements 3.5**

### Property 9: Confirming a reminder records exactly one event; cancelling records none

For any invoice eligible for Send_Reminder_Action, confirming the Send_Reminder_Action modal results in exactly one new `invoice_reminder_sent` activity event referencing that invoice's id being appended to the activity log, and no other change to the activity log; cancelling the same modal (at any point before confirmation) leaves the activity log exactly as it was before the modal opened.

**Validates: Requirements 4.2, 4.3**

### Property 10: Detail page totals and ledger status always match the calculation layer

For any invoice (and, when billed, any associated payments), the totals rendered on the Invoice_Detail_Page equal `getInvoiceTotalsWithWords(invoice)` field-for-field, and — when the invoice is a Billed_Invoice — the status rendered equals `getInvoiceLedgerStatus(invoice, payments)`.

**Validates: Requirements 5.2, 5.3, 9.2**

### Property 11: Detail page payment history is exactly that invoice's payments, each linking to its own receipt

For any invoice and any list of payments, the payment history shown on the Invoice_Detail_Page contains exactly the payments whose `invoiceId` equals that invoice's id (no more, no fewer, in any order), and each listed payment, when its entry is activated, navigates to a Payment_Receipt_View showing that same payment's id.

**Validates: Requirements 5.4, 5.5**

### Property 12: Invoice numbers are links everywhere required, and always resolve to the right invoice

For any invoice rendered on the Overview_Page, Clients_Page, Client_Detail_Page, Invoices_Page, Payments_Page, Payment_Receipt_View, Reports_Page (revenue, invoices, outstanding, and overdue report tables), Intelligence_Page's attention list, or CommandPalette's "Invoices" result group — and for which a resolvable invoice id is available — its invoice number is rendered as an activated link that navigates to the Invoice_Detail_Page with that exact invoice's id selected. (Extended in the second correction pass to cover Reports_Page, Intelligence_Page, and CommandPalette per Requirement 16; the one exception — a Payments-report row whose `invoiceId` cannot be resolved because the underlying invoice no longer exists — renders as plain, non-linked text instead, per the "genuine complication" noted in the Requirement 16 design section above.)

**Validates: Requirements 5.1, 5.8, 7.4, 8.4, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7**

### Property 13: Payment receipt fields and invoice link always match the underlying payment

For any payment and its associated invoice, the Payment_Receipt_View for that payment displays that payment's exact amount, method, `receivedAt` date, and reference (or its absence), and its associated invoice number link navigates to the Invoice_Detail_Page for that payment's `invoiceId`.

**Validates: Requirements 6.1, 6.4**

### Property 14: Client and global rollups equal the sum of non-draft invoices, partitioned by ledger status

For any client, any list of invoices, and any list of payments, `getClientRollup` returns a `totalBilled` equal to the sum of `computeInvoiceTotals(invoice).total` over every invoice belonging to that client with `isDraft === false`, and `totalReceived` + `totalOutstanding` + `totalOverdue` partition that same sum exactly according to each such invoice's `getInvoiceLedgerStatus` result. The same property holds for `getGlobalRollup` across all clients' non-draft invoices.

**Validates: Requirements 7.2, 8.1, 8.2, 9.1**

### Property 15: Draft invoices never affect any rollup, ledger total, or overview metric — until they are billed

For any set of invoices and payments and any client, adding an additional Draft_Invoice (in any state, for any client) does not change `getClientRollup`, `getGlobalRollup`, `computeStatusTotals`'s non-draft buckets, or any aggregate figure on the Invoices_Page. Conversely, for any Draft_Invoice, once it has been transitioned to a Billed_Invoice via the Bill_Invoice_Action, it is included in every subsequent computation of these same totals from that point forward.

**Validates: Requirements 7.3, 8.3, 9.3, 11.1, 11.2, 11.3, 11.4**

### Property 16: Core-workflow ledger labels are exactly "Outstanding"/"Received"; legacy labels are unchanged

For any Billed_Invoice, the label rendered by `LedgerStatusChip` (used on the Overview, Invoices, Invoice Detail, Clients, Client Detail, Payments, and Create Invoice surfaces named in Requirement 10) is "Outstanding" when `getInvoiceLedgerStatus` reports Outstanding_Status and "Received" when it reports Received_Status; for the same invoice, `getInvoiceStatus` and `StatusChip`'s legacy `CONFIG` continue to produce "Pending"/"Paid" unchanged, for consumption by Reports, Intelligence, Workspace Settings, and AURA.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 17: Single invoice-rendering source produces numerically identical figures everywhere (added in correction pass)

For any invoice (and, when billed, any associated payments), rendering that same invoice through the Create_Invoice_Page preview, the Invoice_Detail_Page, and the Download action all yield numerically identical subtotal, taxable value, discount, CGST, SGST, IGST (where applicable), round off, grand total, and amount-in-words values — because all three call `getInvoiceTotalsWithWords`/`computeInvoiceTotals` on the same invoice object through the shared `InvoiceDocument` component or the shared export service, never through an independently re-implemented calculation or a separately duplicated document rendering.

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 18: AURA never overlaps invoice financial content or controls on any affected page (added in correction pass)

For any page value in `PAGES_WITH_STICKY_FOOTER` (including `"create-invoice"` and `"invoice-detail"`), the AURA panel's rendered bottom offset is `bottom-24`, and for any other page value, it is `bottom-6`; on the Invoice_Detail_Page and the Create_Invoice_Page specifically, this offset keeps the AURA panel from visually overlapping the invoice document, its totals/tax values, its action buttons, or its sticky footer (on Create Invoice) at any viewport width the layout supports.

**Validates: Requirements 14.1, 14.2**

### Property 19: Amount in words always matches the final rounded grand total, across the enumerated scenarios (added in correction pass)

For any invoice — whether its final grand total is a whole number of rupees or includes paise, whether its round-off is positive, negative, or zero, whether its discount is zero or non-zero, whether it has a single line item or multiple line items, and whether it has CGST/SGST applied or none — `getInvoiceTotalsWithWords(invoice).amountInWords` equals `amountInWords(computeInvoiceTotals(invoice).total)`, i.e. it is always derived from that same final rounded `total` and never from `rawTotal`, `subtotal`, or any other intermediate figure; consequently, the Create_Invoice_Page preview, Invoice_Detail_Page, and Download/Print output display the same amount-in-words value for the same invoice in every one of these scenarios.

**Validates: Requirements 19.1, 19.2, 19.3**

## Testing Strategy

**Property tests** (minimum 100 iterations each, tagged `Feature: core-business-system, Property N: <title>`) cover the nineteen properties above using generated invoices (random line items, GST rates, discounts, round-off, due dates relative to a fixed `asOf`), generated payment lists (random amounts, subsets of invoices), and generated draft/billed mixes — exercising `lib/invoiceMath.ts`'s new functions directly, plus thin rendering-layer property tests (e.g. React Testing Library queries) for the action-visibility and label properties (5, 6, 12, 16) and for the newly-added rendering-source/AURA/amount-in-words properties (17, 18, 19) parameterized over generated invoice/payment fixtures. Property 12's rendering-layer test, extended in the second correction pass, additionally exercises `ReportsPage.tsx` (revenue/invoices/outstanding/overdue tables), `IntelligencePage.tsx`'s `AttentionList`, and `CommandPalette.tsx`'s "Invoices" result group over generated invoice fixtures, asserting each renders a link that navigates to that invoice's exact id — except the one documented Payments-report edge case where `invoiceId` is `null`, which the test asserts renders as plain non-interactive text. Property 19's generator should specifically enumerate (not just randomly sample) the scenario axes named in Requirement 19.2 — whole-rupee vs. paise totals, positive/negative/zero round-off, zero/non-zero discount, single/multiple line items, and CGST+SGST vs. no tax — crossed with randomized amounts within each axis, so every named scenario combination is exercised rather than left to chance.

**Unit/example tests** cover the fixed-shape, non-input-varying behaviors identified in prework as not property-worthy: the exact wording of the Bill/Send/Reminder modals (Requirements 1.4, 1.5, 4.1, 4.4), the Clients_Page column swap (7.1), the two navigation-wiring checks for Payment_Receipt_View reachability (6.2, 6.3), one confirmatory test that `services/dataProvider.ts`'s interface is unchanged (no new required methods) so `apiDataProvider.ts` continues to compile without modification, and one confirmatory test that the Create Invoice preview column and the left form column scroll independently at the `lg` breakpoint (Requirement 13.2) — a fixed-shape layout check, not a property.

Both approaches are complementary: property tests give broad confidence that `getInvoiceLedgerStatus`, `getClientRollup`, `getGlobalRollup`, the action-gating logic, and the shared-rendering-source guarantee can never disagree with each other across the full input space of invoice/payment combinations; unit tests pin down the small number of fixed, example-shaped UI requirements that don't vary meaningfully with input.
