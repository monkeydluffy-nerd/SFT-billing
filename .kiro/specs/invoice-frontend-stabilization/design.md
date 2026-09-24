# Design Document

## Overview

This is a stabilization pass on the already-scaffolded `sft-billing-phase2.2-gst/sft-billing` frontend (React 18 + TypeScript + Vite 5 + Tailwind, `tsc -b && vite build`, no test runner currently configured — confirmed by reading `package.json`, no `vitest`/`jest` dependency present). It completes two half-built modules (Clients, Payments), fixes three concrete defects (order/delivery field mapping, AURA/footer overlap, unit-price leading-zero), verifies two correctness-critical modules (`invoiceMath.ts`, `amountInWords.ts`) against a worked example, and fixes the TypeScript build.

Everything here plugs into patterns that already exist in the codebase — `DataProvider` / `useAsyncResource`-based hooks for data, `PageHeader` / `EmptyState` / `StatusChip` / `Modal` / `SkeletonLoader` / `Toast` for UI, `useWorkspaceStore` (Zustand) for cross-cutting UI state only. No new architectural layer is introduced.

**Build investigation performed for this design** (read-only, all temp artifacts removed afterward): running `tsc -b --force` against the actual project surfaced exactly two real errors, not the ones a naive reading of Requirement 8 would guess:

1. `tsconfig.node.json`'s `include` covers `vite.config.ts` and `tailwind.config.ts`, but that project has `"noEmit"` unset (defaults to emitting `.js`/`.d.ts`), so building it drops `vite.config.js`, `vite.config.d.ts`, `tailwind.config.js`, `tailwind.config.d.ts` into the project root — stray build output, and if `tsc -b` runs twice back-to-back without `--force` it also throws `TS6377`/emit-conflict style errors on rebuild because the emitted `.js` files shadow the `.ts` sources for module resolution. This is the "tsconfig.node.json emit conflict" in Requirement 8.2/8.4.
2. `src/components/command-palette/CommandPalette.tsx` (not `vite.config.ts`) fails with `TS2769` on `window.addEventListener("keydown", onKeyDown)` because the local `onKeyDown` is typed against React's `KeyboardEvent<Element>` (imported from `"react"`) instead of the DOM's global `KeyboardEvent`. This is a real, currently-broken build in this codebase.

`vite.config.ts`'s `node:path`/`__dirname` usage compiles cleanly today only because `@types/node` (v20.14.0) is already present in `node_modules` and satisfies the ambient `NodeJS`/`__dirname` typings — but it is **not declared** in `package.json` `devDependencies`, so it's an undeclared transitive dependency that could disappear on a clean `npm install` from a fresh lockfile resolution, silently breaking `vite.config.ts`'s types. Requirement 8.3 is addressed by declaring it explicitly rather than by relying on an implicit transitive install.

## Architecture

No layering changes. The existing four-layer shape is preserved and extended into two new pages:

```
UI (pages/components)
   ↓ reads/writes via
Hooks (useClients, useInvoices, usePayments, useAsyncResource)
   ↓ call
DataProvider interface (src/services/dataProvider.ts)
   ↓ implemented by
mockDataProvider.ts (in-memory arrays, today) / future apiDataProvider.ts (Phase 3+)
```

`App.tsx`'s page switch grows two new cases (`"clients"`, `"payments"`); `ClientDetailPage` is reached via workspace-store navigation state (a `selectedClientId`-style field), consistent with how `invoiceDraftPrefill` already routes into `CreateInvoicePage`.

## Components and Interfaces

### 1. New: `src/pages/ClientsPage.tsx`

Modeled directly on `InvoicesPage.tsx`'s structure (`PageHeader` + `Skeleton` loading rows + `EmptyState` + `Toast`), but simpler — no bulk actions, no filter bar beyond a search box (reusing `fuzzyMatch` from `@/lib/fuzzyMatch`, same as `InvoicesPage`/`ClientCombobox`).

```tsx
export function ClientsPage() {
  const { data: clients, loading, error, reload } = useClients();
  const { data: invoices } = useInvoices(); // for "N invoices" count per row
  const { navigateToClientDetail } = useWorkspaceStore(); // new store action, see below
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // filter via fuzzyMatch(query, client.name), same pattern as InvoicesPage
  // rows: name, contact, email, invoice count (from `invoices`), "View" -> navigateToClientDetail(client.id)
}
```

- List row click calls `navigateToClientDetail(clientId)` (Requirement 1.2).
- "Add client" button (top-right `action` slot of `PageHeader`, same slot InvoicesPage uses for "New invoice") opens `AddClientModal`.
- On `AddClientModal`'s success callback, call `reload()` (Requirement 1.6) and show a `Toast` ("Client added").
- Loading state reuses `Skeleton` rows (Requirement 10.3); no new skeleton component needed since this list layout is simple rows, matching the existing `Skeleton` usage in `InvoicesPage`, not the more elaborate `OverviewSkeleton`.
- Error state reuses the same `EmptyState icon={AlertTriangle}` pattern as `InvoicesPage`.

### 2. New: `src/pages/ClientDetailPage.tsx`

```tsx
export function ClientDetailPage() {
  const { data: clients, loading: clientsLoading } = useClients();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { selectedClientId, goToClients, openCreateInvoice } = useWorkspaceStore();
  const client = clients?.find((c) => c.id === selectedClientId);
  const clientInvoices = useMemo(
    () => (invoices ?? []).filter((i) => i.clientId === selectedClientId)
             .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [invoices, selectedClientId],
  );
  // header: PageHeader title={client?.name ?? "Client"} action={<Back to clients button>}
  // detail card: contact name, email, phone, billing address, GSTIN, "Client since" (formatDate)
  // invoices section: reuse a slimmed row (client name column omitted since it's implied) or
  //   reuse InvoiceRow with clients prop still passed (InvoiceRow already tolerates it) for full parity
  // if clientInvoices.length === 0: <EmptyState icon={Inbox} title="No invoices yet" .../> (Requirement 1.7)
}
```

`selectedClientId` is read from `useWorkspaceStore`, following the same pattern as `pendingInvoiceFilter`/`invoiceDraftPrefill` — ephemeral navigation-carried state, not domain data, so it belongs in the store per the store's own documented boundary.

Reusing `InvoiceRow` as-is is preferred over building a new row component (Requirement 10.1), even though it renders more actions (reminder/mark-paid/duplicate) than a read-only client-scoped list strictly needs — those actions already work correctly against `activeDataProvider` and reusing them is less risk than forking a second row component. If this feels heavier than needed at implementation time, a simpler read-only row is an acceptable local deviation, but shared primitives (`StatusChip`, `formatCurrency`, `formatDate`) must still be reused rather than reimplemented.

### 3. New: `src/components/clients/AddClientModal.tsx`

The phase1 version (`sft-billing-phase1/sft-billing/src/components/clients/AddClientModal.tsx`, read above) is a good structural reference — same field set (name, contact name, email, phone, billing address, GSTIN/tax id, notes) and same validate-on-blur pattern — but it cannot be ported verbatim:

- It imports `useAppStore` (Zustand `createClient` action) — forbidden by Requirement 1.5 / 9.5. Replace with a direct call to `activeDataProvider.createClient(...)` followed by the caller's `reload()`.
- It imports `FormField`, `Input`, `Textarea` from `@/components/shared/FormField` — **that file does not exist in phase2.2-gst** (confirmed: `grep` for `FormField` across `sft-billing-phase2.2-gst/sft-billing` returns no matches, and `src/components/shared/` only has `Button.tsx`, `ConfirmDialog.tsx` [does not exist either, see note below], `EmptyState.tsx`, `InlineBanner.tsx`, `Modal.tsx`, `SkeletonLoader.tsx`, `StatusChip.tsx`). The modal must use plain labeled `<input>`/`<textarea>` elements styled like every other form field in this codebase (`CreateInvoicePage.tsx`'s inline order-details inputs, `ClientCombobox.tsx`'s quick-add inputs — same `h-9`/`h-10 rounded-md border border-border bg-surface px-2.5/3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong` class recipe), not the phase1 `FormField`/`Input` primitives. This keeps Requirement 10.1's intent (reuse existing look) honest to what phase2.2-gst actually has, rather than pulling in a component that was never migrated.
- `Modal`'s signature in phase2.2-gst is `{ open, onClose, title, children, footer }` with no `size` prop (phase1's call used `size="xl"`) — the phase2.2-gst `Modal` renders a fixed `max-w-md` dialog. The form must fit that width (stack fields vertically instead of phase1's 2-column grid, or accept the narrower width) — do not add a `size` prop to the shared `Modal` just for this feature (Requirement 10.1/10.2 forbid new one-off primitives).
- The `Client` type in phase2.2-gst has `gstin` (not `taxId`) and no `website` field. Field list becomes: name, contactName, email, phone (optional), billingAddress, gstin (optional), notes (optional) — no website field.

```tsx
interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clientId: string) => void; // caller reloads + toasts
}
export function AddClientModal({ open, onClose, onCreated }: AddClientModalProps) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<...>({});
  const [submitting, setSubmitting] = useState(false);
  // validate(): name, contactName, email (required + regex), billingAddress required — same rules as phase1
  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, contactName: true, email: true, billingAddress: true });
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return; // Requirement 1.4 — no createClient call
    setSubmitting(true);
    const client: Client = {
      id: `cl_runtime_${Date.now()}`,
      name: values.name.trim(),
      contactName: values.contactName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      billingAddress: values.billingAddress.trim(),
      gstin: values.gstin.trim() || undefined,
      clientSince: new Date().toISOString(),
      notes: values.notes.trim() || undefined,
    };
    await activeDataProvider.createClient(client); // Requirement 1.3
    setSubmitting(false);
    onCreated(client.id);
  }
  // render: Modal with plain styled inputs, field-level error <p className="text-xs text-overdue"> under each,
  // matching validation's error rendering pattern (see LineItemEditor / CreateInvoicePage's own field errors)
}
```

Note this mirrors `CreateInvoicePage.handleCreateClient`, which already builds a client object with the same shape and calls `activeDataProvider.createClient` directly — that inline handler is the canonical in-repo example of "how this codebase creates a client through the DataProvider," and `AddClientModal` should match it rather than reinvent client-construction logic.

### 4. New: `src/pages/PaymentsPage.tsx` (+ `RecordPaymentModal`)

```tsx
export function PaymentsPage() {
  const { data: payments, loading, error, reload } = usePayments();
  const { data: invoices } = useInvoices();
  const { data: clients } = useClients();
  const [recordOpen, setRecordOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // rows: receivedAt (formatDate), invoice.number (via invoices.find), client.name (via getClientName),
  //   amount (formatCurrency), method (label map), reference
  // sorted by receivedAt desc, same ordering convention as InvoicesPage
}
```

Row rendering resolves `invoiceId`/`clientId` the same way `InvoicesPage`/`InvoiceRow` already resolve `clientId` — via `clients?.find(...)` / `getClientName` (Requirement 2.5) plus an equivalent `invoices?.find((i) => i.id === payment.invoiceId)?.number ?? "Unknown invoice"` lookup (new tiny helper, or inlined — not worth adding to `clientLookup.ts` unless reused elsewhere, so inline it to avoid a premature abstraction).

`RecordPaymentModal` (small, colocated in `src/components/payments/RecordPaymentModal.tsx` or inlined at the bottom of `PaymentsPage.tsx` if under ~40 lines — final placement is an implementation-time call, not a design decision):

```tsx
interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoices: Invoice[];
  clients: Client[] | undefined;
  onRecorded: (payment: Payment) => void;
}
// fields: invoice select (unpaid invoices preferred, but any invoice allowed — no requirement restricts this),
//   amount (number input, defaults to the selected invoice's computeInvoiceTotals(...).total),
//   method (select: bank_transfer | card | upi | cheque | cash),
//   reference (optional text)
// validate: invoiceId required, amount > 0 required, method required (Requirement 2.3)
// on submit: activeDataProvider.recordPayment({ id: `pm_runtime_${Date.now()}`, invoiceId, clientId: invoice.clientId, amount, method, receivedAt: new Date().toISOString(), reference || undefined })
```

This mirrors `InvoicesPage.markPaid`'s existing inline `recordPayment` call shape exactly (same field set, same `pm_runtime_...` id convention), so the new modal is consistent with the one place in the codebase that already calls `recordPayment`.

### 5. Modified: `src/hooks/useWorkspaceStore.ts`

Two additions, following the exact pattern already used for `invoiceDraftPrefill`/`goToInvoices`:

```ts
selectedClientId: string | null;
navigateToClientDetail: (clientId: string) => void; // sets currentPage: "clients-detail" (or reuses "clients" + selectedClientId, see below), selectedClientId
goToClients: () => void; // sets currentPage: "clients", selectedClientId: null
```

Decision: rather than adding a new `AppPage` value `"clients-detail"`, `ClientsPage` vs `ClientDetailPage` can be distinguished inside `App.tsx`'s existing `"clients"` case by checking `selectedClientId !== null` — this avoids growing `AppPage`'s union (and thus `SidebarNav`'s nav-item logic, which switches on exact page identity) for what is really a sub-view of one page, and matches how `CreateInvoicePage` is already a distinct case from `"invoices"` only because it needs its own sidebar-inactive state, which `ClientDetailPage` does not. If this turns out to read awkwardly in `App.tsx`, adding a literal `"client-detail"` page value with `SidebarNav`'s `isActive` check widened to `currentPage === "clients" || currentPage === "client-detail"` (matching the existing `"invoices"`/`"create-invoice"` pairing exactly) is the fallback and is the cleaner long-term choice — implementer's call, both are consistent with existing patterns.

### 6. Modified: `src/App.tsx`

Add `"clients"` and `"payments"` cases wrapped in `<AppShell>`, following the existing four-case switch exactly:

```tsx
case "clients":
  return <AppShell>{selectedClientId ? <ClientDetailPage /> : <ClientsPage />}</AppShell>;
case "payments":
  return <AppShell><PaymentsPage /></AppShell>;
```

### 7. Modified: `src/components/layout/SidebarNav.tsx`

Two one-line changes to `NAV_ITEMS`:

```ts
{ page: "clients", label: "Clients", icon: Users, available: true },
{ page: "payments", label: "Payments", icon: CreditCard, available: true },
```

No other change needed — `available: false` already drives both the "Soon" tag and the disabled/`navigateTo` gating generically (Requirements 3.1, 3.3), and `"intelligence"`/`"reports"`/`"settings"` stay untouched at `available: false` (Requirement 3.2). The `isActive` check (`currentPage === item.page || (item.page === "invoices" && currentPage === "create-invoice")`) does not need a Clients-specific extension unless the `"client-detail"` page-value fallback above is chosen, in which case it gains one more `||` clause mirroring the existing one.

### 8. Modified: `src/components/aura/AuraPanel.tsx` (or a thin wrapper) — AURA/footer overlap fix

**Root cause, confirmed by reading the code:** `AuraPanel`'s two `motion` elements are both hard-coded to `fixed bottom-6 right-6` (collapsed button) and `fixed bottom-6 right-6` (expanded panel, `h-[520px] w-[380px]`). `CreateInvoicePage` renders a `border-t ... px-10 py-4` sticky footer as the *last sibling* inside its own `flex h-full flex-col` container — that footer is not `fixed`, it's a normal flow element that ends up flush with the bottom of `AppShell`'s `<main>` because `CreateInvoicePage`'s root is `flex h-full flex-col` with the scrollable content as `flex-1`. Its rendered height is small (`py-4` + text line ≈ 56–64px) but AURA's `bottom-6` (24px) collapsed button sits at the same visual band, and the expanded panel (`h-[520px]`, `bottom-6`) can extend low enough to sit behind/over that footer depending on viewport height.

**Chosen mechanism:** thread the current page into `AuraPanel` via `useWorkspaceStore`'s existing `currentPage`, which `AuraPanel` does not currently read but is trivially available (it's already imported for `openAura`/`closeAura`/etc.). No prop drilling and no new context needed:

```tsx
const { auraOpen, openAura, closeAura, goToInvoices, openCreateInvoice, currentPage } = useWorkspaceStore();
const hasStickyFooter = currentPage === "create-invoice"; // the only page with one today
const bottomOffsetClass = hasStickyFooter ? "bottom-24" : "bottom-6"; // ~96px clears a ~64px footer + margin
```

Apply `bottomOffsetClass` (via `cn(...)`) to both the collapsed button's and the expanded panel's `fixed ... right-6` className, replacing the literal `bottom-6`. This satisfies:
- 5.1/5.2: on `CreateInvoicePage`, both states use `bottom-24`, clearing the footer.
- 5.3: no change to `AnimatePresence`/`motion` transition props, no change to internal panel content, styling, or interaction — only the offset utility class changes.
- 5.4: every other page (`overview`, `invoices`, `clients`, `payments`, etc.) keeps `bottom-6`, unchanged from today.

This is a `AuraPanel`-internal change, not a wrapping layout component — simpler, and avoids adding a new "AURA-aware" concept to `AppShell` for a single-page special case. If a second sticky-footer page appears later, `hasStickyFooter` generalizes to a small page-set check or a store flag (`hasStickyFooter: boolean` set by the page itself) — not needed for this feature's scope.

### 9. Modified: `src/pages/CreateInvoicePage.tsx` and `src/components/create-invoice/InvoicePreview.tsx` — order/delivery field mapping (Requirement 4)

Reading both files closely: `CreateInvoicePage`'s order-details block already binds `draft.supplierCode`, `draft.transporter`, `draft.poNumber`, `draft.poDate` correctly (each `input`'s `value`/`onChange` round-trips through `setDraft({ ...draft, <field>: e.target.value })`), and `InvoicePreview` already reads `invoice.supplierCode`/`poNumber`/`poDate`/`transporter` and already gates the whole block on `hasOrderDetails = invoice.supplierCode || invoice.poNumber || invoice.poDate || invoice.transporter`, and already formats `poDate` with the same `formatDate()` used for `issueDate`/`dueDate`.

**This means Requirements 4.1–4.3 already pass against the current code as written** — no mapping defect was found in `CreateInvoicePage.tsx` → `Invoice` → `InvoicePreview.tsx` for these four fields. This is consistent with the requirements document's own framing ("investigation suggests they may already be correct"). Design commitment: do not change `InvoicePreview.tsx`'s order-details block or `CreateInvoicePage.tsx`'s order-details inputs. Requirement 4.5's conditional ("if a defect is found... correct that specific mapping") is a contingency, not an instruction to make a change now. The implementation task for Requirement 4 is a **verification task** (manually walk through: type into each of the four fields in `CreateInvoicePage`, confirm each appears under its label in `InvoicePreview`, confirm the block disappears when all four are cleared, confirm the P.O. Date renders as `d MMM yyyy` matching Issued/Due), not a code-change task, unless that walkthrough surfaces something the static read above missed (e.g. a `resolveInvoiceDraft`/`createDraftInvoice` path that drops a field — also read above and confirmed `poDate`/`poNumber`/`supplierCode`/`transporter` are all carried through `createDraftInvoice`'s prefill spreading correctly).

### 10. Modified: `src/components/create-invoice/LineItemEditor.tsx` — unit price / quantity leading-zero bug (Requirement 6)

**Root cause, confirmed by reading the code:** both inputs are:

```tsx
<input type="number" min={0} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} .../>
<input type="number" min={0} value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })} .../>
```

`value` is bound directly to the numeric `InvoiceLineItem.quantity`/`unitPrice` (a `number`, defaulting to `0`/`1` from `newLineItem()`). This is the classic controlled-`<input type="number">`-bound-to-a-number bug: when the field's underlying value is `0` and the user's first keystroke is e.g. `2`, React re-renders with `value={0}` still momentarily present in some browsers' native number-input parsing, or — more concretely here — when the user clears the field to empty and types `2`, `Number("")` is `0`, so an intermediate render can show `0` before the digit lands, and typing `50` after a `0` state can produce a literal `"050"` → `Number("050") === 50` is fine numerically, but the *displayed* string during editing can retain the stale leading `"0"` because the DOM input element's own text buffer is not perfectly synced to a controlled numeric value on every keystroke in this pattern (well-documented React + `type="number"` limitation). This matches Requirement 6.1/6.3/6.4 exactly.

**Fix:** switch each field to the standard controlled-string-buffer pattern already partially hinted at by `hsnCode`'s handling (`item.hsnCode ?? ""` — a string field). Track the *displayed text* as a string per row/field, separate from the numeric value stored on the `InvoiceLineItem`:

```tsx
// New local state in LineItemEditor, keyed by item id, for the two numeric-text fields:
const [quantityText, setQuantityText] = useState<Record<string, string>>({});
const [unitPriceText, setUnitPriceText] = useState<Record<string, string>>({});

// Derive display value: prefer the in-progress text buffer if present, else format from the numeric model
function displayValue(map: Record<string, string>, id: string, numeric: number): string {
  return id in map ? map[id] : (numeric === 0 ? "" : String(numeric));
}

// On change: accept any string that matches a partial-number pattern (digits, at most one '.', empty),
// store it verbatim in the text buffer, and only push a parsed numeric value up to onChange
// when the string parses to a finite number (empty/"." in-progress states push 0 or are held back).
function handleNumericChange(id: string, raw: string, map: Record<string, string>, setMap: ..., field: "quantity" | "unitPrice") {
  if (!/^\d*\.?\d*$/.test(raw)) return; // reject non-numeric keystrokes outright, same intent as type="number" min={0}
  setMap((prev) => ({ ...prev, [id]: raw }));
  const parsed = raw === "" || raw === "." ? 0 : Number(raw);
  if (!Number.isNaN(parsed)) updateItem(id, { [field]: parsed });
}
```

Inputs change from `type="number"` to `type="text"` with `inputMode="decimal"` (keeps the mobile/numeric keyboard affordance without the browser's native number-input text-buffer quirks), and `onChange` calls `handleNumericChange` instead of `Number(e.target.value)` directly:

```tsx
<input
  type="text"
  inputMode="decimal"
  value={displayValue(quantityText, item.id, item.quantity)}
  onChange={(e) => handleNumericChange(item.id, e.target.value, quantityText, setQuantityText, "quantity")}
  .../>
<input
  type="text"
  inputMode="decimal"
  value={displayValue(unitPriceText, item.id, item.unitPrice)}
  onChange={(e) => handleNumericChange(item.id, e.target.value, unitPriceText, setUnitPriceText, "unitPrice")}
  onKeyDown={(e) => onUnitPriceKeyDown(e, index)}
  .../>
```

Row removal (`removeItem`) should also clear that row's id out of both text-buffer maps to avoid stale entries accumulating (minor cleanup, not behavior-visible but avoids an unbounded map). This satisfies 6.1 (typed digits shown as typed, no coercion round-trip through a numeric `value`), 6.2 (a trailing `"."` is a valid buffered string, not collapsed), 6.3 (empty buffer displays as empty, not `"0"`, while the underlying model value is `0`), 6.4 (clearing sets the buffer to `""`, so the next keystroke starts clean, not appended to stale digits), 6.5 (identical treatment for both fields via the shared `handleNumericChange`/`displayValue` helpers).

This is the only change to `LineItemEditor.tsx` in scope — the description/HSN/suggestion/keyboard-navigation logic is untouched.

### 11. Modified: `vite.config.ts`, `tsconfig.node.json`, `package.json` — build fixes (Requirement 8)

**`package.json`:** add `"@types/node": "^20.14.0"` to `devDependencies`, matching the version already resolved in `node_modules` today — makes the existing implicit dependency explicit and pinned (Requirement 8.3, "adding correct Node type support"). No `@ts-ignore`/`any` introduced.

**`tsconfig.node.json`:** add `"noEmit": true` to `compilerOptions`, matching `tsconfig.json`'s own `noEmit: true` for the exact same reason — this project is Vite/esbuild-built, not `tsc`-emitted; `tsc -b`'s only job here is type-checking config files, not producing `.js` output. This directly removes the stray `vite.config.js`/`.d.ts`/`tailwind.config.js`/`.d.ts` emission and the resulting emit/shadow conflict on rebuild (Requirement 8.2, 8.4) — a root-cause project-configuration fix, not a suppression.

**`vite.config.ts`:** no code change is required once `@types/node` is properly declared — confirmed by testing: with `@types/node` present, `tsc -p tsconfig.node.json --noEmit` reports zero errors against `node:path`/`__dirname` today. Requirement 8.1 is satisfied by the `package.json` fix above, not by editing `vite.config.ts` itself.

**`src/components/command-palette/CommandPalette.tsx`:** the actual remaining build error (found during investigation, not named in the requirements' file list, but required by Requirement 8.5's "zero errors across the entire project"). Root cause: `onKeyDown`'s parameter is typed as React's `KeyboardEvent` (from `import { ... type KeyboardEvent } from "react"`) but the function is passed to `window.addEventListener`, which expects the DOM's global `KeyboardEvent`. Fix: rename the import alias so the local handler at line 68 uses the DOM type, without touching the second `onKeyDown` at line 194 (that one is correctly used as an `<input>`'s `onKeyDown` prop and correctly typed against React's `KeyboardEvent<HTMLInputElement>`):

```tsx
// before: import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
// ...
function onKeyDown(e: KeyboardEvent) { ... }          // now resolves to lib.dom.d.ts's global KeyboardEvent — correct for window.addEventListener
// ...
function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) { ... } // the input-level handler, explicitly React's type
```

This is the smallest possible fix: one import rename, zero behavior change, no suppression.

**Verification for Requirement 8:** run `tsc -b --force` (clean rebuild) from a clean `tsconfig.tsbuildinfo`/`tsconfig.node.tsbuildinfo` state after these changes and confirm exit code 0 with no stray `.js`/`.d.ts` files left in the project root — this was the exact repro/verify loop used during this design's investigation.

### 12. Verify-only: `src/lib/invoiceMath.ts`, `src/lib/amountInWords.ts`, `src/types/invoice.ts`, `InvoicePreview.tsx`

Manual calculation walkthrough for Requirement 7 (also to be captured as a unit test, see Testing Strategy):

- `subtotal` is whatever the line items sum to; the requirement's example specifies a **taxable value** of ₹25,700 directly (i.e. `subtotal - discount = 25700`, achievable with `discount = 0` and items summing to 25700, or any other combination — the function doesn't care which).
- `cgstAmount = 25700 * 0.09 = 2313` ✓ exact, no rounding needed (`25700 * 0.09` is exactly `2313` in floating point for this input — verified: `25700 * 9 = 231300`, `/100 = 2313`).
- `sgstAmount = 25700 * 0.09 = 2313` ✓ same.
- `rawTotal = 25700 + 2313 + 2313 = 30326`.
- `roundOff = 0` (per the requirement's "zero round-off"), `total = Math.max(0, 30326 + 0) = 30326` ✓ matches Requirement 7.2 exactly.

**No discrepancy found.** `computeInvoiceTotals` and `suggestRoundOff` need no changes; their existing signatures and structure are preserved (Requirement 7.3 is satisfied by inaction, confirmed correct rather than assumed correct).

`amountInWords(30326)`: `rupees = 30326`, `paise = 0`. `integerToIndianWords(30326)`: crore=0, lakh=0, thousand=`Math.floor(30326/1000)=30` → `threeDigits(30)` = `twoDigits(30)` = `"Thirty"` → `"Thirty Thousand"`; hundred=`30326 % 1000 = 326` → `threeDigits(326)`: hundreds=3→`"Three Hundred"`, rest=26→`twoDigits(26)`="Twenty Six"→`"Three Hundred Twenty Six"`. Joined: `"Thirty Thousand Three Hundred Twenty Six"` + `" Rupees"` + (paise=0, no paise clause) + `" Only"` → **`"Thirty Thousand Three Hundred Twenty Six Rupees Only"`** — matches Requirement 7.4's expected wording exactly (case/hyphenation of "Twenty Six" vs "Twenty-six" is a cosmetic detail the requirement doesn't pin down; current output has no hyphen, which is fine and unchanged).

`src/types/invoice.ts`: already declares all four order/delivery fields as optional (`supplierCode?`, `poNumber?`, `poDate?`, `transporter?`) on both `Invoice` and `InvoiceDraftPrefill` (confirmed by reading the file) — Requirement 4.4 needs no change.

`InvoicePreview.tsx`: confirmed correct per section 9 above — no change.

## Data Models

No changes to any type in `src/types/`. Specifically:
- `Invoice` / `InvoiceDraftPrefill` (`src/types/invoice.ts`): unchanged — order/delivery fields already correctly optional.
- `Client` (`src/types/client.ts`): unchanged — already has every field the new `AddClientModal`/`ClientsPage`/`ClientDetailPage` need (`id`, `name`, `contactName`, `email`, `phone?`, `billingAddress`, `gstin?`, `clientSince`, `notes?`).
- `Payment` (`src/types/payment.ts`): unchanged — already has every field `PaymentsPage`/`RecordPaymentModal` need (`id`, `invoiceId`, `clientId`, `amount`, `method`, `receivedAt`, `reference?`).

`DataProvider` interface (`src/services/dataProvider.ts`): unchanged — `getClients`, `createClient`, `getPayments`, `recordPayment`, `getInvoices` already all exist with the signatures the new pages need (confirmed by reading the interface and `mockDataProvider.ts`'s implementation). No new method is required, so Requirement 9.3's "IF a new page requires data not yet exposed... THEN add a method" branch does not trigger for this feature.

## Error Handling

Consistent with existing pages:
- `useAsyncResource`'s `error` is surfaced via the same `EmptyState icon={AlertTriangle} title="Couldn't load…" description={error.message}` pattern `InvoicesPage` already uses, applied identically in `ClientsPage` and `PaymentsPage`.
- Form validation errors (`AddClientModal`, `RecordPaymentModal`) are field-level, rendered inline under each field as `<p className="text-xs text-overdue">{error}</p>`, matching `LineItemEditor`'s and `CreateInvoicePage`'s existing error rendering — never a blocking alert or toast for validation (Toast is reserved for post-success confirmations, consistent with its own documented intent in `Toast.tsx`).
- `activeDataProvider` calls in this mock-backed phase cannot actually fail (no simulated failure path exists in `mockDataProvider.ts` today, confirmed by reading it — only `delay()`, no rejection), so no new error-recovery UI beyond the existing `loading`/`error` states from `useAsyncResource` is needed for the create/record flows themselves.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Client list rendering completeness

For any array of `Client` objects returned by `getClients`, `ClientsPage` renders exactly one row per client, and each rendered row's name matches that client's `name`.

**Validates: Requirements 1.1**

### Property 2: Client detail invoice filtering

For any client id and any array of `Invoice` objects, `ClientDetailPage` displays exactly the subset of invoices whose `clientId` equals the selected client's id, and no invoice belonging to a different client.

**Validates: Requirements 1.2**

### Property 3: Valid client creation persists exactly the submitted data

For any well-formed `AddClientModal` form (non-empty name, non-empty contact name, a syntactically valid email, non-empty billing address), submitting the form calls `DataProvider.createClient` exactly once with a client object whose fields match the submitted values, and the client list subsequently includes that client.

**Validates: Requirements 1.3, 1.6**

### Property 4: Invalid client submissions never reach the DataProvider

For any `AddClientModal` form missing the name, contact name, billing address, or containing a syntactically invalid/empty email, submitting the form does not call `DataProvider.createClient`, and a field-level error message is shown for each invalid field.

**Validates: Requirements 1.4**

### Property 5: Payment list rendering completeness

For any array of `Payment` objects returned by `getPayments`, `PaymentsPage` renders exactly one row per payment.

**Validates: Requirements 2.1**

### Property 6: Valid payment recording persists exactly the submitted data

For any well-formed payment form (an existing invoice selected, a positive amount, a method selected), submitting calls `DataProvider.recordPayment` exactly once with a payment object matching the submitted values, and the payment list subsequently includes it.

**Validates: Requirements 2.2, 2.4**

### Property 7: Invalid payment submissions never reach the DataProvider

For any payment form missing the invoice, amount, or method, submitting does not call `DataProvider.recordPayment`, and a field-level error is shown for each missing field.

**Validates: Requirements 2.3**

### Property 8: Payment rows resolve to the correct invoice and client

For any `Payment` together with a matching `Invoice` (by `invoiceId`) and `Client` (by `clientId`) in the loaded data, the rendered payment row displays that invoice's `number` and that client's `name`.

**Validates: Requirements 2.5**

### Property 9: Order/delivery fields round-trip into the preview under their correct labels

For any subset of `{supplierCode, poNumber, poDate, transporter}` set to non-empty values on an invoice draft (including the empty subset), `InvoicePreview` displays exactly the set fields under their corresponding labels, formats a set `poDate` using the same formatter as `issueDate`/`dueDate`, and omits the order/delivery block entirely when the subset is empty.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: AURA never overlaps the sticky footer on Create Invoice, and keeps its original position elsewhere

For any workspace page, `AuraPanel`'s collapsed button and expanded panel use the `bottom-6` offset unless the current page is `create-invoice`, in which case they use the larger `bottom-24` offset that clears the sticky footer's rendered height.

**Validates: Requirements 5.1, 5.2, 5.4**

### Property 11: Numeric line-item fields display exactly what was typed

For any sequence of keystrokes forming a valid non-negative decimal-in-progress string (digits and at most one decimal point, including the empty string) typed into a line item's quantity or unit price field, the field's displayed value equals that string exactly — never a value with an extraneous leading zero, a stale trailing digit from a prior value, or a forced `"0"` when the field is empty.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 12: Invoice totals are deterministic and match the reference calculation

For any invoice's `items`, `gst` rates, `discount`, and `roundOff`, `computeInvoiceTotals` returns `cgstAmount` and `sgstAmount` each equal to `(subtotal - discount) * <rate>`, and `total` equal to `max(0, (subtotal - discount) + cgstAmount + sgstAmount + roundOff)`.

**Validates: Requirements 7.1, 7.2**

## Testing Strategy

**Test runner decision:** `package.json` has no `vitest`, `jest`, `@testing-library/react`, or any test script today (confirmed by reading `package.json` — only `dev`/`build`/`preview`/`lint`/`tauri` scripts exist). Introducing a test runner is in scope for this feature because Requirement 7 explicitly calls for verifying `computeInvoiceTotals`/`amountInWords` against a concrete example, and that is only meaningfully "verified" (vs. asserted by hand, as this design document did above) if it's an automated, re-runnable test. **Decision: add Vitest** (`vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom`, all pinned exact versions at implementation time) as a dev dependency with a `"test": "vitest run"` script. Vitest is the standard choice for a Vite project (shares Vite's config/transform pipeline, zero extra bundler config) and is lighter than pulling in Jest's separate transform stack. This is a one-time setup cost, not scope creep, because without it Requirement 7's "verified against a known correct example" has no durable artifact.

**Pure-logic unit + property tests** (`src/lib/*.test.ts`, using `vitest` + a lightweight property runner — `fast-check` is the standard pairing with Vitest and is added alongside it):
- `invoiceMath.test.ts`: the exact worked example from Requirement 7.1/7.2 as a unit test (Property 12's concrete instance), plus a `fast-check` property test generating random non-negative line items, GST rates in `[0, 1]`, discounts, and round-offs, asserting Property 12's formula holds for every generated input (≥100 runs).
- `amountInWords.test.ts`: unit test for `amountInWords(30326)` matching Requirement 7.4's expected text, plus a small set of boundary examples (0, exact lakh/crore boundaries) — this module's output space (English number names) doesn't lend itself to a single round-trip property, so example-based coverage is appropriate here per the PBT decision guide (deterministic string formatting, not a transform with an inverse).

**Component-level tests** (`src/components/**/*.test.tsx`, `@testing-library/react`):
- `LineItemEditor.test.tsx`: Property 11 as a `fast-check` property test driving `userEvent.type` with generated digit/decimal-point sequences into a rendered quantity/unit-price input and asserting the input's displayed value equals the typed string; plus explicit unit tests for the two named bug scenarios in the requirements ("200" not "0200", clearing then retyping).
- `AddClientModal.test.tsx`: Property 3/4 — one property test generating valid form field combinations (asserting `createClient` is called once with matching data) and one generating combinations with exactly one required field invalid/missing (asserting `createClient` is never called and the corresponding field shows an error). `activeDataProvider.createClient` is mocked (`vi.spyOn`/module mock) so no real data layer is exercised.
- `PaymentsPage`/`RecordPaymentModal` equivalent tests for Property 6/7, same mocking approach against `recordPayment`.
- `ClientsPage.test.tsx` / `ClientDetailPage.test.tsx`: Property 1/2/5/8 as property tests over generated arrays of clients/invoices/payments (small arrays, e.g. 0–10 items, since these are rendering/filtering properties where iteration count matters less than shape coverage — 100 iterations is still appropriate per the workflow's minimum).
- `InvoicePreview.test.tsx`: Property 9 as a property test over the power set of the four optional fields (16 combinations is small enough to test exhaustively rather than randomly, or wrap in `fast-check`'s `fc.subarray` for idiomatic property framing).
- `AuraPanel.test.tsx`: Property 10 as an example-based test over the small enumerable set of `AppPage` values (not a `fast-check` property — per the PBT decision guide, an enumerable set of ~8 fixed cases is better served by explicit examples than randomized generation) asserting the rendered className includes `bottom-24` only when `currentPage === "create-invoice"`.

**Integration/manual verification** (not property tests, per the PBT guidance that visual/layout overlap and one-time build checks are unsuitable for PBT):
- AURA/footer non-overlap: one manual visual check at a fixed viewport (e.g. 1440×900, the codebase's implied desktop-first baseline — no responsive breakpoints are evident in the reviewed layout code) confirming the collapsed button and the expanded panel both sit fully above the sticky footer on `CreateInvoicePage`, plus the `AuraPanel.test.tsx` className assertion above as the automated proxy for this.
- `tsc -b --force` exit code 0 with no stray build artifacts, run once after the `vite.config.ts`/`tsconfig.node.json`/`package.json`/`CommandPalette.tsx` fixes land — a build smoke check, not a repeated automated test (per the PBT guidance on one-time configuration checks).
- Sidebar navigation (Requirement 3.3): explicit example tests, one per {Clients, Payments}, asserting `navigateTo`/store state changes on click — an enumerable set of two items doesn't warrant a generative property.

**What stays untouched and unverified-by-new-tests:** `InvoicePreview.tsx`'s already-correct rendering of client/business fields not touched by this feature, `invoiceValidation.ts`, `invoiceDraft.ts`, and every other existing page/component not named above — no regression tests are added for code this feature does not modify, consistent with keeping this stabilization pass proportional.

## What Must Remain Untouched

- `sft-billing-phase1/` and `sft-billing-phase2/` — read only for reference (as done above for `AddClientModal`), never modified.
- `AuraPanel`'s `framer-motion` transition props, message-thread UI, and `runAuraCommand`/`auraAssistant.ts` logic — only the two `bottom-*` offset classes change.
- `InvoicePreview.tsx`'s layout for all fields other than the order/delivery block, which itself is also unchanged (no defect found).
- `computeInvoiceTotals`, `suggestRoundOff`, `getInvoiceStatus` in `invoiceMath.ts` — signatures and internal structure both confirmed correct and left as-is.
- `Button`, `Modal`, `EmptyState`, `StatusChip`, `SkeletonLoader`, `PageHeader`, `Toast`, `InlineBanner` — consumed as-is; no prop additions (e.g. no `size` prop on `Modal`) introduced for this feature's convenience.
- `Client`, `Payment`, `Invoice`, `InvoiceDraftPrefill` types — no field additions or changes.
- `DataProvider` interface — no new methods; every operation this feature needs already exists.
