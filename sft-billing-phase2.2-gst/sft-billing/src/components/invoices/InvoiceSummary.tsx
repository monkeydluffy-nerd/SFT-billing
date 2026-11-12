import type { Client, Invoice, InvoiceLedgerStatusInfo, Payment } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { NumberTicker } from "@/components/ui/kit";

interface InvoiceSummaryProps {
  invoice: Invoice;
  client: Client | undefined;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  invoicePayments: Payment[];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{children}</dd>
    </div>
  );
}

/** One flat panel: amount + progress, then a divided details list. */
export function InvoiceSummary({ invoice, client, invoicePayments }: InvoiceSummaryProps) {
  const totals = computeInvoiceTotals(invoice);
  const paid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.max(0, totals.total - paid);
  const progress = totals.total > 0 ? Math.min(100, (paid / totals.total) * 100) : 0;

  return (
    <section aria-label={invoice.isDraft ? "Draft invoice details" : "Invoice summary and details"}>
      <div>
        <p className="text-xs font-medium text-ink-muted">{invoice.isDraft ? "Invoice total" : "Outstanding"}</p>
        <p className="mt-1 text-[2rem] font-medium leading-none tracking-tight text-ink">
          <NumberTicker value={invoice.isDraft ? totals.total : outstanding} format={(n) => formatCurrency(n)} />
        </p>
        {!invoice.isDraft && (
          <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Collected">
              <div className="h-full rounded-full bg-success transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-muted">
              <span>
                Received <span className="font-tabular text-ink">{formatCurrency(paid)}</span>
              </span>
              <span>
                Invoice total <span className="font-tabular text-ink">{formatCurrency(totals.total)}</span>
              </span>
            </div>
          </>
        )}
      </div>

      <dl className="mt-5 divide-y divide-border border-t border-border">
        <Row label="Invoice number"><span className="font-mono text-[13px]">{invoice.number}</span></Row>
        <Row label="Issue date">{formatDate(invoice.issueDate)}</Row>
        <Row label="Due date">{formatDate(invoice.dueDate)}</Row>
        <Row label="Client">{client?.name ?? "Unknown client"}</Row>
        {invoice.poNumber && <Row label="PO number"><span className="font-mono text-[13px]">{invoice.poNumber}</span></Row>}
        {invoice.supplierCode && <Row label="Supplier code">{invoice.supplierCode}</Row>}
        {invoice.transporter && <Row label="Transporter">{invoice.transporter}</Row>}
      </dl>
    </section>
  );
}
