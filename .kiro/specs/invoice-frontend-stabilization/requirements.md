# Requirements Document

## Introduction

This feature stabilizes the `sft-billing-phase2.2-gst` frontend (the canonical project going forward, located at `sft-billing-phase2.2-gst/sft-billing`) by completing two unfinished modules (Clients, Payments), fixing known UI/data defects (order/delivery fields, AURA panel overlap, unit-price input), verifying existing correctness-critical logic (invoice totals, amount-in-words), and resolving TypeScript build failures. No backend work, no visual redesign, and no changes to `sft-billing-phase1` or `sft-billing-phase2` are in scope. All new data access must go through the existing `DataProvider` interface (`src/services/dataProvider.ts`) and its hooks, preserving the UI → Domain/types → Business logic → Data-access layering already established in the codebase.

## Glossary

- **Application**: The `sft-billing-phase2.2-gst/sft-billing` React + TypeScript + Vite frontend.
- **DataProvider**: The `DataProvider` interface defined in `src/services/dataProvider.ts`, implemented by `mockDataProvider.ts` and exposed as `activeDataProvider`; the sole permitted data-access boundary for components and hooks.
- **ClientsPage**: The page component that lists clients and provides navigation to individual client details, to be added to the Application.
- **ClientDetailPage**: The page component that displays a single client's details and related invoices, to be added to the Application.
- **AddClientModal**: The modal component used to create a new client, to be added to the Application.
- **PaymentsPage**: The page component that lists recorded payments and allows recording a new payment against an invoice, to be added to the Application.
- **SidebarNav**: The navigation component at `src/components/layout/SidebarNav.tsx` that renders the primary navigation list and "Soon" availability indicators.
- **InvoicePreview**: The component at `src/components/create-invoice/InvoicePreview.tsx` that renders the printable invoice document.
- **LineItemEditor**: The component at `src/components/create-invoice/LineItemEditor.tsx` that edits invoice line items, including the unit price field.
- **AuraPanel**: The component at `src/components/aura/AuraPanel.tsx` rendering the AURA assistant's collapsed button and expanded panel.
- **CreateInvoicePage**: The page component at `src/pages/CreateInvoicePage.tsx` containing the sticky invoice action footer.
- **InvoiceMath_Module**: The module at `src/lib/invoiceMath.ts` containing `computeInvoiceTotals`, `suggestRoundOff`, and `getInvoiceStatus`.
- **AmountInWords_Module**: The module at `src/lib/amountInWords.ts` that converts a numeric total into its written-words representation.
- **Order_Delivery_Fields**: The optional invoice fields `supplierCode`, `poNumber`, `poDate`, and `transporter` defined on the `Invoice` and `InvoiceDraftPrefill` types in `src/types/invoice.ts`.
- **Build_Toolchain**: The TypeScript project configuration (`tsconfig.json`, `tsconfig.node.json`) and `vite.config.ts` used to type-check and build the Application via `tsc -b`.
- **Developer**: The person invoking `tsc -b` or the Vite build/dev commands against the Application.
- **User**: The person interacting with the Application's UI (Clients, Payments, Invoices, Sidebar, AURA).

## Requirements

### Requirement 1: Clients module ported into the Application

**User Story:** As a User, I want to view, add, and inspect clients from within the Application, so that I can manage client relationships without leaving the billing workspace.

#### Acceptance Criteria

1. THE Application SHALL provide a ClientsPage that lists clients retrieved through the DataProvider's `getClients` method.
2. WHEN a User selects a client from the ClientsPage, THE Application SHALL display a ClientDetailPage showing that client's details and the invoices associated with that client's id.
3. WHEN a User submits a valid new client through the AddClientModal, THE Application SHALL persist the new client by calling the DataProvider's `createClient` method.
4. IF the AddClientModal form contains a missing or invalid required field, THEN THE Application SHALL display a field-level validation message and SHALL NOT call the DataProvider's `createClient` method.
5. THE ClientsPage, ClientDetailPage, and AddClientModal SHALL retrieve and persist client data exclusively through the DataProvider and its associated hooks (`useClients`), and SHALL NOT reference the phase1 `appStore` Zustand store or mutate client data directly.
6. WHEN a client is created through the AddClientModal, THE Application SHALL refresh the client list shown on the ClientsPage to include the new client.
7. WHERE a client has no associated invoices, THE ClientDetailPage SHALL display an empty state instead of an empty table.

### Requirement 2: Payments module built from scratch

**User Story:** As a User, I want to view recorded payments and record a new payment against an invoice, so that I can track which invoices have been paid.

#### Acceptance Criteria

1. THE Application SHALL provide a PaymentsPage that lists payments retrieved through the DataProvider's `getPayments` method via the existing `usePayments` hook.
2. WHEN a User submits a valid new payment on the PaymentsPage, THE Application SHALL persist the payment by calling the DataProvider's `recordPayment` method.
3. IF a payment submission is missing a required field (invoice, amount, or method), THEN THE Application SHALL display a field-level validation message and SHALL NOT call the DataProvider's `recordPayment` method.
4. WHEN a payment is successfully recorded, THE PaymentsPage SHALL refresh the displayed payment list to include the new payment.
5. THE PaymentsPage SHALL display each payment's associated invoice number and client name by resolving `invoiceId` and `clientId` through the `useInvoices` and `useClients` hooks.
6. THE PaymentsPage SHALL retrieve and persist payment data exclusively through the DataProvider and its associated hooks, and SHALL NOT hard-code demo payment data inside presentation components.

### Requirement 3: Sidebar availability indicators reflect functional status

**User Story:** As a User, I want the sidebar to accurately show which sections are usable, so that I do not waste time clicking on dead navigation items and do not mistake a working feature for an unfinished one.

#### Acceptance Criteria

1. WHEN the Clients module and Payments module are both functional, THE SidebarNav SHALL mark the "Clients" and "Payments" navigation items as available and SHALL remove their "Soon" indicators.
2. THE SidebarNav SHALL continue to mark the "Intelligence", "Reports", and "Workspace Settings" navigation items as unavailable with a "Soon" indicator.
3. WHEN a User selects the "Clients" or "Payments" navigation item, THE Application SHALL navigate to the corresponding page instead of leaving the item disabled.

### Requirement 4: Order and delivery fields are correctly mapped end-to-end

**User Story:** As a User, I want the supplier code, purchase order number, purchase order date, and transporter details I enter to appear correctly on the invoice preview, so that the printed invoice reflects accurate order and delivery information.

#### Acceptance Criteria

1. WHEN a User enters a value for `supplierCode`, `poNumber`, `poDate`, or `transporter` on the invoice draft, THE InvoicePreview SHALL display that value under its corresponding labeled field.
2. WHERE none of `supplierCode`, `poNumber`, `poDate`, or `transporter` are set on the invoice draft, THE InvoicePreview SHALL omit the order/delivery details block entirely.
3. THE InvoicePreview SHALL format a set `poDate` value using the same date-formatting function used for `issueDate` and `dueDate`.
4. THE Invoice and InvoiceDraftPrefill types SHALL declare `supplierCode`, `poNumber`, `poDate`, and `transporter` as optional fields, consistent with their current definitions in `src/types/invoice.ts`.
5. IF an existing mapping defect prevents an entered order/delivery field value from appearing correctly in the InvoicePreview, THEN THE Application SHALL correct that specific mapping without altering the layout of unaffected fields.

### Requirement 5: AURA panel does not overlap the invoice action footer

**User Story:** As a User composing an invoice, I want the AURA button and panel to stay out of the way of the sticky send/save actions, so that I can always access both without one obscuring the other.

#### Acceptance Criteria

1. WHILE a User is on the CreateInvoicePage, THE AuraPanel's collapsed button SHALL NOT visually overlap the sticky invoice action footer.
2. WHILE a User is on the CreateInvoicePage and the AuraPanel is expanded, THE AuraPanel SHALL NOT visually overlap the sticky invoice action footer.
3. THE Application SHALL reposition the AuraPanel using layout adjustments (position, offset, or footer-aware spacing) without changing AURA's existing internal animation behavior or visual design.
4. WHILE a User is on a page without a sticky footer, THE AuraPanel SHALL retain its current fixed bottom-right position and behavior.

### Requirement 6: Unit price input accepts numeric entry without leading-zero artifacts

**User Story:** As a User entering a line item's unit price, I want to type a number like "200" and have it show as "200", so that I do not have to fight the input field to enter a correct price.

#### Acceptance Criteria

1. WHEN a User types a numeric value into the LineItemEditor's unit price field, THE LineItemEditor SHALL display the value the User typed without an extraneous leading zero.
2. WHEN a User types a decimal value (e.g. "12.50") into the LineItemEditor's unit price field, THE LineItemEditor SHALL preserve the decimal value as typed, including a trailing decimal point during entry.
3. IF the unit price field is empty, THEN THE LineItemEditor SHALL treat the underlying value as zero without forcing a visible "0" that blocks typing a new leading digit.
4. WHEN a User clears the unit price field and types a new value, THE LineItemEditor SHALL NOT prepend the previous value's digits to the new input.
5. THE LineItemEditor SHALL apply the same leading-zero handling to the quantity field's numeric input.

### Requirement 7: Invoice totals and amount-in-words calculations remain correct and unmodified in structure

**User Story:** As a User relying on invoice totals, I want the tax and total calculations to be verified against a known correct example, so that I can trust the amounts shown on every invoice.

#### Acceptance Criteria

1. WHEN InvoiceMath_Module's `computeInvoiceTotals` is called with a taxable value of ₹25,700, a CGST rate of 9%, and an SGST rate of 9%, THE InvoiceMath_Module SHALL return a CGST amount of ₹2,313 and an SGST amount of ₹2,313.
2. WHEN InvoiceMath_Module's `computeInvoiceTotals` is called with the inputs in Acceptance Criterion 1 and zero discount and zero round-off, THE InvoiceMath_Module SHALL return a total of ₹30,326.
3. THE Application SHALL preserve the existing structure and public signatures of `computeInvoiceTotals`, `suggestRoundOff`, and `getInvoiceStatus` in InvoiceMath_Module without restructuring them, unless a defect is found that produces an incorrect result for the example in Acceptance Criteria 1 and 2.
4. WHEN AmountInWords_Module is called with a grand total of ₹30,326, THE AmountInWords_Module SHALL return a words representation corresponding to thirty thousand three hundred twenty-six rupees.
5. IF a discrepancy between InvoiceMath_Module's computed totals and the documented example is found, THEN THE Application SHALL correct the root cause in InvoiceMath_Module and SHALL NOT introduce a compensating hard-coded value elsewhere.

### Requirement 8: TypeScript build succeeds without suppressions

**User Story:** As a Developer, I want `tsc -b` to complete without errors, so that I can trust type safety and produce a working build.

#### Acceptance Criteria

1. WHEN a Developer runs `tsc -b` against the Application, THE Build_Toolchain SHALL complete without reporting a type error in `vite.config.ts`.
2. WHEN a Developer runs `tsc -b` against the Application, THE Build_Toolchain SHALL complete without reporting a `tsconfig.node.json` emit conflict.
3. THE Application SHALL resolve `vite.config.ts` type errors involving `node:path` and `__dirname` by adding correct Node type support rather than by adding `@ts-ignore`, `@ts-nocheck`, or an unnecessary `any` type annotation.
4. THE Application SHALL resolve the `tsconfig.node.json` emit conflict by correcting the project configuration rather than by disabling the affected type-checking rule.
5. WHEN a Developer runs `tsc -b` against the Application after these fixes, THE Build_Toolchain SHALL report zero errors across the entire project, including newly added Clients and Payments source files.

### Requirement 9: Architectural layering is preserved across all new and modified code

**User Story:** As a Developer maintaining the Application for a future backend swap, I want every new feature to go through the existing data-access boundary, so that swapping in a real backend in Phase 3 requires touching only the DataProvider implementation.

#### Acceptance Criteria

1. THE Application's Clients and Payments presentation components SHALL depend only on hooks (`useClients`, `useInvoices`, `usePayments`) and domain types (`src/types`), and SHALL NOT depend directly on `mockDataProvider.ts`.
2. THE Application SHALL NOT hard-code demonstration or mock data literals inside any presentation component; all displayed data SHALL originate from a hook backed by the DataProvider.
3. IF a new page or component requires data not yet exposed by the DataProvider interface, THEN THE Application SHALL add a method to the DataProvider interface and its mock implementation rather than bypassing the interface.
4. THE Application SHALL NOT introduce a Python or SQLite backend, or any direct network/database call from a component or hook, as part of this feature.
5. THE Application SHALL NOT reintroduce the phase1 `appStore` Zustand pattern of direct state mutation for Clients, Payments, or any other domain data.

### Requirement 10: Visual design remains consistent with the established look

**User Story:** As a User familiar with the existing Application, I want new pages to look and feel like the rest of the workspace, so that the product feels cohesive rather than bolted-on.

#### Acceptance Criteria

1. THE ClientsPage, ClientDetailPage, AddClientModal, and PaymentsPage SHALL use the existing shared components (`Button`, `Modal`, `FormField`, `EmptyState`, `StatusChip`, or their Application-local equivalents) rather than introducing new one-off styled primitives.
2. THE Application SHALL NOT introduce gradients, additional animation effects beyond what is already used in the codebase, oversized cards, or rounding radii inconsistent with the existing design tokens when building the Clients and Payments modules.
3. WHERE a new page requires a loading state, THE Application SHALL reuse the existing `SkeletonLoader` pattern rather than introducing a new loading affordance.
