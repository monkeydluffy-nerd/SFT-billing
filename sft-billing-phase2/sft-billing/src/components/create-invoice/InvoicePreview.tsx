import { motion, AnimatePresence } from "framer-motion";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface InvoicePreviewProps {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
}

/**
 * Renders the invoice as it will actually look — this is deliberately
 * NOT a generic "summary card"; it's laid out like a real printable
 * invoice (letterhead, bill-to, line items, totals, payment info) so
 * what the client eventually sees is exactly what's on screen right now.
 * Only the total re-mounts on change (via the `key`), giving it a brief
 * cross-fade rather than flashing the entire document on every keystroke.
 */
export function InvoicePreview({ invoice, client, business }: InvoicePreviewProps) {
  const { subtotal, taxAmount, discount, total } = computeInvoiceTotals(invoice);
  const hasItems = invoice.items.some((item) => item.description.trim());

  return (
    <div className="mx-auto w-full max-w-[560px] rounded-lg border border-border bg-surface p-10 shadow-float">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xl text-ink">{business?.name ?? "Your Company"}</p>
          <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-ink-muted">{business?.address}</p>
          {business?.taxId && <p className="mt-1 text-xs text-ink-faint">{business.taxId}</p>}
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-ink">Invoice</p>
          <p className="font-tabular text-sm text-ink-muted">{invoice.number}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 border-y border-border py-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Billed to</p>
          <p className="mt-1 font-medium text-ink">{client?.name ?? "Select a client"}</p>
          {client && <p className="text-xs text-ink-muted">{client.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-faint">
            Issued <span className="font-tabular text-ink-muted">{formatDate(invoice.issueDate)}</span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Due <span className="font-tabular text-ink-muted">{formatDate(invoice.dueDate)}</span>
          </p>
        </div>
      </div>

      <div className="mt-5">
        {hasItems ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-faint">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Rate</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.items
                .filter((item) => item.description.trim())
                .map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-2 text-ink">{item.description}</td>
                    <td className="font-tabular py-2 text-right text-ink-muted">{item.quantity}</td>
                    <td className="font-tabular py-2 text-right text-ink-muted">{formatCurrency(item.unitPrice)}</td>
                    <td className="font-tabular py-2 text-right text-ink">{formatCurrency(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-ink-faint">
            Add line items to see them here
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <div className="w-52 space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-muted">
            <span>Subtotal</span>
            <span className="font-tabular">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-muted">
            <span>Tax ({(invoice.taxRate * 100).toFixed(0)}%)</span>
            <span className="font-tabular">{formatCurrency(taxAmount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-ink-muted">
              <span>Discount</span>
              <span className="font-tabular">−{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1.5 font-medium text-ink">
            <span>Total due</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={total}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="font-tabular"
              >
                {formatCurrency(total)}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Notes</p>
          <p className="mt-1 text-sm text-ink-muted">{invoice.notes}</p>
        </div>
      )}

      {business?.bankDetails && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Payment details</p>
          <p className="mt-1 text-xs text-ink-muted">{business.bankDetails}</p>
        </div>
      )}
    </div>
  );
}
