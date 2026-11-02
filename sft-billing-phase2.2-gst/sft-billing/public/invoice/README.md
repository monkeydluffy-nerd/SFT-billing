# Legacy invoice prototype (not used by SFT Billing)

The application does not load this standalone prototype. Current invoice
downloads are generated from `backend/app/excel/templates/Surfine_Bill_format.xlsx`;
PDF downloads are converted from that workbook by the backend.

The wiring notes below are historical and do not describe the active billing app.

## 1. Drop-in files

Copy into your Vite app:

```
src/invoice/
  types.ts          # domain types — also mirror in FastAPI (see backend/invoices.py)
  invoiceModel.ts    # buildInvoice(), formatAmount/formatCurrency, amount-in-words
  Invoice.tsx         # the renderer (CSS Modules + lucide-react icons)
  Invoice.module.css  # pixel-exact layout, ported 1:1 from the JS version
  excelExport.ts      # ExcelJS export built from the SAME buildInvoice() output
  logo.png
src/tests/
  Invoice.test.tsx
backend/
  invoices.py          # FastAPI router + Pydantic models mirroring types.ts
```

Install the two extra deps this version needs:

```bash
npm install lucide-react exceljs
```

(`lucide-react` replaces the hand-drawn contact SVGs; `exceljs` powers the export.)

## 2. Why CSS Modules instead of Tailwind here

The design uses fixed pixel grids, `clip-path` polygons (the ribbon, the
footer shapes) and exact `colgroup` widths on the items table. That's not
naturally expressible in Tailwind utilities without an arbitrary-value class
for nearly every rule, which is harder to keep pixel-accurate on review.
`Invoice.module.css` is scoped automatically by Vite, so it won't leak into
or clash with the rest of your Tailwind app — use Tailwind everywhere else
as normal.

## 3. Data flow

```
FastAPI (RawInvoice JSON) --fetch--> buildInvoice() --> <Invoice invoice={...} />
                                                     \--> exportInvoiceToExcel()
```

Only `invoiceModel.ts` computes taxable value, CGST/SGST, totals, round-off
and the amount in words. Both the on-screen component and the Excel export
consume its output, so the two can never disagree — never recompute totals
in the component or in `excelExport.ts`.

Example fetch + render:

```tsx
import { useEffect, useState } from 'react';
import Invoice from './invoice/Invoice';
import { buildInvoice } from './invoice/invoiceModel';
import type { RawInvoice, Invoice as InvoiceData } from './invoice/types';

function InvoicePage({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json() as Promise<RawInvoice>)
      .then((raw) => setInvoice(buildInvoice(raw)));
  }, [id]);

  if (!invoice) return null;
  return <Invoice invoice={invoice} />;
}
```

## 4. Excel export

```tsx
import { downloadInvoiceExcel } from './invoice/excelExport';

<button onClick={() => downloadInvoiceExcel(invoice, `${invoice.meta[0].value}.xlsx`)}>
  Download Excel
</button>
```

`exportInvoiceToExcel()` (the non-browser half) returns a `Buffer`, so it also
works unchanged in a Node/FastAPI-adjacent worker, or in a Vite server route,
if you'd rather generate the file server-side and stream it back.

## 5. PDF export (not in this stack list, but you'll likely want it)

Two options, in order of how well they preserve pixel fidelity:

- **Browser print**: wrap `<Invoice>` in [`react-to-print`](https://www.npmjs.com/package/react-to-print) and call `window.print()` on a `contentRef` — the CSS already has an `@page { size: A4; margin: 0 }` block and a print-time `transform: scale(0.7754)`, so "Save as PDF" from the print dialog reproduces the artboard exactly.
- **Server-side**: render the same component to static HTML (e.g. with a small Playwright/Chromium step in FastAPI, or `react-dom/server` + Playwright's `page.pdf()`), reusing `Invoice.module.css` as-is.

## 6. Backend contract

`backend/invoices.py` defines Pydantic models that mirror `types.ts`
field-for-field. Mount it in your FastAPI app:

```python
from fastapi import FastAPI
from invoices import router as invoices_router

app = FastAPI()
app.include_router(invoices_router)
```

Keep calculation out of Python — the backend stores/serves the *raw*
invoice (seller, buyer, meta, items, tax rates); `buildInvoice()` on the
frontend is the single source of truth for totals. If you later need
totals server-side too (e.g. for a nightly report), port `invoiceModel.ts`
to Python once and treat that as the second source of truth explicitly,
rather than duplicating the arithmetic ad hoc.

## 7. Testing

`src/tests/Invoice.test.tsx` covers both layers:

- `invoiceModel` — per-line tax math, totals, round-off, amount-in-words,
  currency formatting — checked against the exact reference invoice figures
  (₹27,950.00 taxable, ₹32,981.00 grand total).
- `<Invoice />` — renders with React Testing Library and asserts buyer name,
  line items and the grand total text appear.

Run with your existing Vitest config; if you don't have jsdom set up yet:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```ts
// vite.config.ts
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: './src/tests/setup.ts' },
});
```

```ts
// src/tests/setup.ts
import '@testing-library/jest-dom/vitest';
```
