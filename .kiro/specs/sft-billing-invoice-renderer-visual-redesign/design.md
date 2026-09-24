# InvoiceDocumentRenderer Screen Visual Redesign

## 1. Purpose and scope

Redesign the existing shared `InvoiceDocumentRenderer` as a screen-only React/TypeScript presentation of the supplied reference implementation in `public/invoice`.

The visual source of truth is the combination of the user-supplied invoice screenshot attached to this review and the public reference files under `sft-billing-phase2.2-gst/sft-billing/public/invoice`: `Invoice.tsx`, `Invoice.module.css`, `invoiceModel.ts`, `types.ts`, and `README.md`. The screenshot is a co-equal visual authority for composition, hierarchy, spacing, geometry, color, and graphical treatment; the public files are the authority for the reference implementation's structure and behavior. If the screenshot and public files appear visually ambiguous, preserve the existing model/consumer behavior and record the chosen interpretation in browser evidence.

The existing public component is a visual reference, not a replacement API. The redesigned component continues to accept exactly the existing `InvoiceDocumentRendererProps` contract:

```ts
export interface InvoiceDocumentRendererProps {
  model: InvoiceDocumentModel;
}
```

`InvoiceDocumentModel` and `InvoiceDocumentRendererProps` are immutable contracts for this work: their interfaces, field names, field types, optionality, nesting, and semantics must not be changed. All existing consumers and the normalized `InvoiceDocumentModel` remain unchanged. Presentation mapping may read and format only fields already present on the existing model; it may not add presentation-only fields to the model, derive replacement fields, or require consumer changes. The renderer formats and places values only; it does not calculate, normalize, mutate, or invent invoice data.

### Explicit exclusions

- No backend, API, payment, invoice-numbering, GST, calculation, or model changes.
- No consumer/call-site changes.
- No print/PDF/output-generation changes.
- Do not add, remove, or alter `@page`, `@media print`, print transforms, print dimensions, or print-only behavior. Print/PDF logic is outside this design and remains untouched.
- No Terms & Conditions content and no QR/scanner content in the screen DOM.

## 2. Architecture and data flow

```text
Existing backend/application flow
        │
        ▼
Existing InvoiceDocumentModel
        │  (all identity, item, tax, totals, optional and label values)
        ▼
InvoiceDocumentRenderer({ model })
        │  pure screen projection + existing formatters only
        ▼
1024 × 1448 CSS-pixel screen artboard
```

The renderer destructures the existing model and maps each value to one semantic section. Existing pure display helpers such as `formatCurrency` and `formatDate` may be used. The renderer must never:

- multiply quantity by rate;
- calculate taxable value, CGST, SGST, line amount, totals, round-off, grand total, or amount in words;
- substitute generated invoice numbers or dates;
- mutate the model or nested source objects.

If a required displayed value is unavailable, use the existing model’s empty-value treatment or an existing backend-provided field at the presentation boundary. Do not add arithmetic or a new source of truth.

## 3. Artboard and screen container

The screen page is a fixed portrait artboard exactly `1024px × 1448px` in CSS pixels. It has a visible page boundary, balanced internal margins, white surface, and reference-aligned navy/copper/neutral styling. Content must wrap and compose within that artboard; if an unusually long model requires overflow, it must remain visible rather than being clipped.

The outer screen region owns horizontal overflow. The artboard must not shrink below 1024px and must not hide overflow to conceal table collisions:

```css
.invoice-screen-region {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  background: #eef0f2;
  padding: 24px;
}

.invoice-screen-canvas {
  min-width: calc(1024px + 48px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.invoice-document {
  flex: 0 0 1024px;
  width: 1024px;
  height: 1448px;
  min-height: 1448px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #d6d9dd;
  position: relative;
  overflow: visible;
}
```

At viewport widths below 1024px, the page remains 1024px wide and the region exposes horizontal scrolling. At widths of at least 1024px, the canvas centers the page while preserving the 1024:1448 portrait ratio. All page descendants use `box-sizing: border-box`.

Use reference tokens such as navy `#2b3a4a`, copper `#c0673a`, copper-dark `#a85832`, ink, muted ink, soft border, alternate-row gray, and white paper. Use the reference typography hierarchy: serif treatment for the major invoice identity/ribbon where appropriate, readable sans-serif body text, strong navy bars, copper tags/accents, and deliberate spacing rather than generic cards.

## 4. DOM order and composition

The root hierarchy must follow this exact order. Stable semantic classes and test hooks should be retained/introduced without changing the public props contract.

```text
.invoice-screen-region
  .invoice-screen-canvas
    article.invoice-document
      header.invoice-header
        .invoice-header-main
          .invoice-logo (dynamic image or logo-empty treatment)
          .invoice-business-identity
          .invoice-contact
        .invoice-gst-pan-strip
        .invoice-tax-invoice-ribbon

      section.invoice-parties
        section.bill-to-panel
        section.invoice-details-panel

      section.order-delivery-section       // only if any value exists

      section.invoice-items-section
        table.invoice-items-table          // or defined empty-items state

      section.invoice-summary
        .amount-in-words-panel
        .totals-panel

      section.invoice-closing
        section.bank-details-panel
        section.declaration-panel
        section.authorized-signatory-panel

      footer.invoice-graphical-footer
```

The reference order is header, GST/PAN strip and TAX INVOICE ribbon, Bill To and Invoice Details, optional Order/Delivery, item table, totals/Amount in Words, Bank Details, Declaration/signature, and graphical footer. Terms & Conditions and QR/scanner panels are not alternate or hidden sections; they are absent from this screen composition.

### Header and identity

- Render `business.logoUrl` when available. The image has constrained dimensions and an appropriate dynamic alt value.
- When unavailable, render a stable reference-compatible logo-empty lockup/placeholder occupying the same header geometry; never render a broken image artifact.
- Render dynamic business name, address, phone, email, GSTIN, and PAN from the model.
- The GST/PAN strip has stable `GSTIN:` and `PAN:` labels, stable alignment, and defined empty treatment for unavailable identifiers.
- The TAX INVOICE ribbon is a prominent copper/navy graphical element consistent with the reference, positioned below/alongside the GST/PAN strip according to the reference composition.
- Render dynamic invoice number, issue date, due date, and model-provided labels. Do not generate replacement values.

### Bill To, Invoice Details, and Order/Delivery

Bill To and Invoice Details are sibling panels with reference-aligned heading bars/tags and label/value rows. Bill To includes customer name, multiline billing address, and GSTIN when available. Invoice Details includes invoice number, issue date, due date, and applicable model-provided detail labels; it must not introduce standalone Terms content.

Render Order/Delivery only when at least one of supplier code, purchase-order number, purchase-order date, or transporter is present. Render each available field, omit absent fields, and omit the entire section when all are absent so the table moves upward without a reserved blank panel. Long values and multiline addresses use normal wrapping and `overflow-wrap: anywhere`; labels and values must not overlap, clip, or collide.

## 5. Exact ten-column table design

When line items are present, render exactly these columns in exactly this order:

| Order | Header | Width | Alignment |
|---:|---|---:|---|
| 1 | S.No | 6% | centered |
| 2 | Description | 24% | left |
| 3 | HSN/SAC | 10% | centered |
| 4 | Qty | 7% | centered |
| 5 | Unit | 7% | centered |
| 6 | Rate (₹) | 10% | right |
| 7 | Taxable Value (₹) | 12% | right |
| 8 | CGST 9% (₹) | 8% | right |
| 9 | SGST 9% (₹) | 8% | right |
| 10 | Amount (₹) | 8% | right |

The table must use an explicit `colgroup` with those widths, `width: 100%`, `table-layout: fixed`, and collapsed borders. Header and body cells share the same column contract. Headers may wrap at defined boundaries; descriptions and other long values wrap within their cells; numeric cells use right alignment and tabular numerals. The table remains inside the artboard content width and never relies on clipping or overlay to hide overflow.

No Discount column and no combined SGST/Amount column are rendered. Every row retains ten cells. Item quantity, unit, rate, taxable value, CGST, SGST, and amount are displayed from the model exactly after formatting; the renderer performs no arithmetic. When there are no items, render the model-defined empty-items state with a valid bounded presentation rather than a malformed/collapsed table.

## 6. Summary and closing sections

The summary renders model-provided taxable amount, CGST, SGST, round-off when applicable, and grand total. Round-off is conditional: a model-applicable row is shown; otherwise only that row is omitted. The copper Grand Total treatment is visually prominent and reference-aligned. Missing totals use the model-defined empty-value treatment.

The Amount in Words panel is bounded, visually associated with totals, and renders the model-provided amount-in-words text without conversion or recomputation.

Bank Details renders dynamic account holder, bank, branch, account number, and IFSC fields. If bank details are unavailable, render the defined bank-empty treatment while preserving surrounding closing geometry. Declaration and Authorized Signatory render their model-provided text/data, including dynamic signatory information when present. The footer is the final page child, uses the reference copper/navy wedge/band/slash graphics or equivalent CSS shapes, and remains positioned at the bottom of the artboard without unexplained blank space.

## 7. Error and optional-value behavior

- Preserve zero values; do not use truthiness checks that suppress valid zero amounts or quantities.
- Use existing formatters for dates/currency only.
- Missing logo: stable empty logo treatment, no broken-image icon.
- Missing GST/PAN/contact value: stable label and empty-value treatment.
- Missing order/delivery: omit the complete section and reclaim its space.
- Missing bank: bank-empty treatment with preserved layout.
- Missing signatory/declaration: model-defined empty treatment.
- Missing round-off: omit only the round-off row.
- Empty items: defined empty-items state.
- Missing totals/amount in words: model-defined empty value, never invented output.

## 8. Correctness properties

The prework classification identifies visual geometry, omission rules, and browser evidence as example/edge/integration/smoke checks. The following non-redundant properties cover variable model projection, financial isolation, and immutability.

### Property 1: Model values map to their designated sections

**For any** valid normalized invoice model, every supplied business, customer, invoice identity, GST/PAN, line-item, total, amount-in-words, bank, declaration, signatory, and applicable order/delivery value SHALL render in its designated screen section, while absent optional sections SHALL be omitted without removing unrelated required sections.

**Validates: Requirements 2.1, 2.3, 2.5, 3.1, 3.2, 3.3, 4.5, 5.1, 5.3, 6.1, 6.3, 7.2, 7.6**

### Property 2: Renderer displays supplied financial values without arithmetic

**For any** valid model whose supplied line-item and total values may intentionally differ from values derivable from quantity, rate, and GST rates, the renderer SHALL display the supplied taxable value, CGST, SGST, amount, totals, round-off, grand total, and amount-in-words values after display formatting, without recalculating, rounding, summing, or replacing them.

**Validates: Requirements 4.5, 5.1, 5.4, 5.5, 5.6, 7.3**

### Property 3: Rendering does not mutate the model

**For any** valid normalized invoice model, rendering the screen preview SHALL leave the model and all nested business, customer, identity, order/delivery, items, GST, totals, bank, declaration, signatory, labels, and optional data deeply equal to their pre-render values.

**Validates: Requirements 7.1, 7.4**

### Property 4: Variable text remains owned by its field or cell

**For any** valid model containing multiline addresses, long labels, long descriptions, long identifiers, and variable item counts, each displayed value SHALL remain within its designated panel or table cell, wrap rather than collide with adjacent content, and preserve ten aligned cells per item row.

**Validates: Requirements 3.5, 4.3, 4.4**

## 9. Testing and browser inspection

### Unit/component and property tests

Use existing renderer/consumer test infrastructure. Add representative component tests for populated data, absent logo, absent bank, absent order/delivery, empty items, zero values, conditional round-off, multiline addresses, long descriptions, exact ten headers/order, fixed widths, alignment classes, copper Grand Total, footer, and negative assertions for Terms & Conditions and QR/scanner content. Include a frozen/deep-equality model test and intentionally inconsistent financial fixtures to prove no renderer arithmetic.

Property tests must run at least 100 iterations per property and use the required tag format:

`Feature: sft-billing-invoice-renderer-visual-redesign, Property N: <property title>`

Each property test references its corresponding design property. CSS/DOM assertions verify `1024px` width, `1448px` minimum height, non-shrinking behavior, overflow ownership, `colgroup` widths, fixed table layout, wrapping, and alignment.

### Required browser-inspection evidence artifact

Browser inspection is a required deliverable, not an informal manual check. Record one evidence artifact at:

`.kiro/specs/sft-billing-invoice-renderer-visual-redesign/browser-evidence.md`

The artifact must identify the exact existing shared consumer route/path inspected (not an isolated renderer story or substitute page), the build/fixture setup, date of inspection, and pass/fail status. It must contain all of the following for all four inspection combinations: populated-wide, populated-narrow, sparse-wide, and sparse-narrow:

1. **Viewport matrix:** one wide viewport at or above `1024px` (record exact width × height) and one narrow viewport below `1024px` (record exact width × height).
2. **Evidence per viewport and fixture:** screenshots or measured DOM/CSS evidence. Measurements must include the artboard bounding width/height, page boundary, centering or horizontal overflow/scroll dimensions, and any relevant section bounding boxes. Screenshots must identify the viewport and fixture.
3. **Composition checks:** observed section order; presence/absence of Bill To, Invoice Details, Order/Delivery, item table or empty-items state, totals, Amount in Words, Bank Details, Declaration, Authorized Signatory, and footer. Explicitly record that Terms & Conditions and QR/scanner content are absent.
4. **Table checks:** exact header order and exact measured/declared widths for all ten columns: `6%, 24%, 10%, 7%, 7%, 10%, 12%, 8%, 8%, 8%`. Record table width, cell wrapping/readability, numeric/text alignment, and confirmation that no forbidden Discount or combined SGST/Amount column exists.
5. **Content and layout checks:** dynamic logo/business/customer/invoice values, optional order/delivery and bank behavior, totals/amount-in-words, copper Grand Total, footer placement, long-text wrapping, collision/overlap checks, clipping/overflow checks, and unexplained-large-empty-space checks. A sparse fixture must specifically demonstrate omitted optional sections reclaim space rather than leaving a blank panel.
6. **Pass/fail notes:** each check must have a clear `PASS` or `FAIL`, observed evidence/measurement, and concise notes. Any `FAIL` must name the defect, correction made, and the subsequent inspection result; approval requires a final passing inspection at both viewports and both fixture states.

### Browser screen inspection workflow

Inspect the existing shared consumer path with representative dynamic model data. Use a populated fixture containing multiple line items, long text, logo, bank, and order/delivery values, and a sparse fixture with absent optional values and empty items. Inspect both recorded viewports. If inspection finds overflow, clipping, collision, spacing, geometry, hierarchy, or dynamic-value defects, correct only the screen presentation and repeat inspection; update the evidence artifact with the failed and replacement checks. Print/PDF inspection is explicitly excluded from this artifact and this phase.

## 10. Implementation sequence (design guidance only)

1. Preserve the existing props/model contract and confirm all required backend-provided values are available.
2. Replace only the screen composition with the documented semantic DOM order; remove Terms/QR/scanner presentation.
3. Establish the fixed 1024×1448 screen artboard, outer scroll/centering behavior, reference palette, typography, panels, ribbon, and footer graphics.
4. Implement conditional logo, Order/Delivery, bank, signatory, round-off, and empty-item/value treatments.
5. Implement the exact ten-column `colgroup`, fixed layout, widths, wrapping, and alignment.
6. Add focused component/property/CSS checks and perform browser inspection at wide and narrow viewports.

This is a design artifact only. No production code, print/PDF logic, backend logic, or consumer code is implemented here.
