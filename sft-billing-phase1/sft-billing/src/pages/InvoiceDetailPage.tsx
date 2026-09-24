import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Edit2, Copy, Send, CircleDollarSign, XCircle, Printer,
  Building2, Calendar, FileText, Clock, CheckCircle2
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { StatusChip } from "@/components/shared/StatusChip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { useAppStore } from "@/stores/appStore";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import type { ActivityEvent } from "@/types";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";

// ---------------------------------------------------------------------------
// Activity icon mapping
// ---------------------------------------------------------------------------
function ActivityIcon({ type }: { type: ActivityEvent["type"] }) {
  const cls = "h-7 w-7 rounded-full flex items-center justify-center shrink-0";
  if (type === "invoice_created") return <div className={cn(cls, "bg-neutral-bg")}><FileText size={13} className="text-neutral" /></div>;
  if (type === "invoice_sent") return <div className={cn(cls, "bg-pending-bg")}><Send size={13} className="text-pending" /></div>;
  if (type === "invoice_paid" || type === "payment_received") return <div className={cn(cls, "bg-success-bg")}><CheckCircle2 size={13} className="text-success" /></div>;
  if (type === "invoice_cancelled") return <div className={cn(cls, "bg-neutral-bg")}><XCircle size={13} className="text-neutral" /></div>;
  return <div className={cn(cls, "bg-canvas")}><Clock size={13} className="text-ink-faint" /></div>;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function InvoiceDetailPage() {
  const { selectedInvoiceId, navigateTo, navigateToEditInvoice, navigateToCreateInvoice } = useWorkspaceStore();
  const { getInvoiceById, getClientById, getPaymentsForInvoice, markInvoiceSent, cancelInvoice, duplicateInvoice, activity } = useAppStore();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const invoice = selectedInvoiceId ? getInvoiceById(selectedInvoiceId) : undefined;
  const client = invoice ? getClientById(invoice.clientId) : undefined;
  const payments = invoice ? getPaymentsForInvoice(invoice.id) : [];

  // Activity events for this invoice
  const invoiceActivity = useMemo(() =>
    activity
      .filter((e) => e.invoiceId === invoice?.id || (e.paymentId && payments.some(p => p.id === e.paymentId)))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [activity, invoice?.id, payments]
  );

  if (!invoice) {
    return (
      <div>
        <PageHeader title="Invoice" />
        <div className="px-10 py-16">
          <EmptyState icon={FileText} title="Invoice not found" description="This invoice may have been deleted or the link is invalid." />
        </div>
      </div>
    );
  }

  const status = getInvoiceStatus(invoice);
  const totals = computeInvoiceTotals(invoice);
  const canEdit = !invoice.cancelledAt;
  const canSend = !invoice.cancelledAt && !invoice.sentAt && invoice.isDraft;
  const canMarkSent = !invoice.cancelledAt && (invoice.isDraft || !invoice.sentAt);
  const canRecordPayment = !invoice.cancelledAt && totals.outstanding > 0;
  const canCancel = !invoice.cancelledAt && !invoice.paidAt;

  function handleDuplicate() {
    const dup = duplicateInvoice(invoice.id);
    if (dup) navigateToEditInvoice(dup.id);
  }

  return (
    <div>
      <PageHeader
        title={invoice.number}
        subtitle={client?.name}
        action={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => navigateToEditInvoice(invoice.id)}>
                <Edit2 size={14} />
                Edit
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleDuplicate}>
              <Copy size={14} />
              Duplicate
            </Button>
            {canMarkSent && (
              <Button variant="secondary" size="sm" onClick={() => markInvoiceSent(invoice.id)}>
                <Send size={14} />
                Mark as Sent
              </Button>
            )}
            {canRecordPayment && (
              <Button variant="primary" size="sm" onClick={() => setPaymentOpen(true)}>
                <CircleDollarSign size={14} />
                Record Payment
              </Button>
            )}
          </div>
        }
      />

      <div className="px-10 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigateTo("invoices")}
            className="flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-micro hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back to Invoices
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]"
        >
          {/* LEFT: Invoice content */}
          <div className="space-y-6">

            {/* Invoice header card */}
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-xl text-ink">{invoice.number}</h2>
                    <StatusChip info={status} />
                  </div>
                  {client && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
                      <Building2 size={14} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-ink">{client.name}</p>
                        <p>{client.contactName}</p>
                        <p>{client.email}</p>
                        {client.phone && <p>{client.phone}</p>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm text-ink-muted">
                    <Calendar size={13} />
                    <span>Issued {formatDate(invoice.issueDate)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                    <Clock size={13} />
                    <span>Due {formatDate(invoice.dueDate)}</span>
                  </div>
                  {invoice.paymentTerms && (
                    <p className="mt-1 text-xs text-ink-faint">{invoice.paymentTerms}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-6 py-3">
                <p className="text-sm font-medium text-ink">Line items</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-canvas text-left text-xs text-ink-muted">
                    <th className="px-6 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium">Unit Price</th>
                    <th className="px-6 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-3 text-ink">{item.description}</td>
                      <td className="font-tabular px-4 py-3 text-right text-ink-muted">{item.quantity}</td>
                      <td className="font-tabular px-4 py-3 text-right text-ink-muted">{formatCurrency(item.unitPrice, true)}</td>
                      <td className="font-tabular px-6 py-3 text-right font-medium text-ink">
                        {formatCurrency(item.quantity * item.unitPrice, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-border bg-canvas px-6 py-4">
                <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                  <div className="flex justify-between text-ink-muted">
                    <span>Subtotal</span>
                    <span className="font-tabular">{formatCurrency(totals.subtotal, true)}</span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Tax ({(invoice.taxRate * 100).toFixed(0)}%)</span>
                    <span className="font-tabular">{formatCurrency(totals.taxAmount, true)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-ink-muted">
                      <span>Discount</span>
                      <span className="font-tabular text-success">−{formatCurrency(totals.discount, true)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-medium text-ink">
                    <span>Total</span>
                    <span className="font-tabular">{formatCurrency(totals.total, true)}</span>
                  </div>
                  {(invoice.paidAmount ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between text-success">
                        <span>Paid</span>
                        <span className="font-tabular">{formatCurrency(invoice.paidAmount ?? 0, true)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-ink">
                        <span>Outstanding</span>
                        <span className="font-tabular">{formatCurrency(totals.outstanding, true)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-2 text-sm font-medium text-ink">Notes</p>
                <p className="text-sm text-ink-muted whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            {/* Danger zone */}
            {canCancel && (
              <div className="rounded-lg border border-dashed border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">Cancel invoice</p>
                    <p className="text-xs text-ink-faint mt-0.5">This action cannot be undone.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)} className="text-overdue hover:bg-overdue-bg hover:text-overdue">
                    <XCircle size={14} />
                    Cancel invoice
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Sidebar panels */}
          <div className="space-y-6">

            {/* Payments received */}
            <div className="rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-ink">Payments</p>
                {canRecordPayment && (
                  <button
                    type="button"
                    onClick={() => setPaymentOpen(true)}
                    className="text-xs text-accent hover:underline"
                  >
                    + Record
                  </button>
                )}
              </div>
              {payments.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-ink-faint">No payments recorded</p>
              ) : (
                <div className="divide-y divide-border">
                  {payments.map((p) => (
                    <div key={p.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-tabular text-sm font-medium text-success">{formatCurrency(p.amount, true)}</span>
                        <span className="text-xs text-ink-faint">{formatDate(p.receivedAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted capitalize">{p.method.replace("_", " ")}</p>
                      {p.reference && <p className="text-xs text-ink-faint">{p.reference}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Client info shortcut */}
            {client && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-sm font-medium text-ink">Client</p>
                <div className="space-y-1.5 text-sm">
                  <button
                    type="button"
                    onClick={() => useWorkspaceStore.getState().navigateToClient(client.id)}
                    className="font-medium text-accent hover:underline text-left"
                  >
                    {client.name}
                  </button>
                  <p className="text-ink-muted">{client.contactName}</p>
                  <p className="text-ink-muted">{client.email}</p>
                  {client.phone && <p className="text-ink-muted">{client.phone}</p>}
                  <p className="text-xs text-ink-faint mt-2">{client.billingAddress}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToCreateInvoice(client.id)}
                  className="mt-3 text-xs text-accent hover:underline"
                >
                  Create another invoice for {client.name} →
                </button>
              </div>
            )}

            {/* Activity timeline */}
            <div className="rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-ink">Activity</p>
              </div>
              {invoiceActivity.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-ink-faint">No activity yet</p>
              ) : (
                <div className="px-4 py-3">
                  <div className="space-y-3">
                    {invoiceActivity.map((event) => (
                      <div key={event.id} className="flex items-start gap-2.5">
                        <ActivityIcon type={event.type} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-ink leading-relaxed">{event.summary}</p>
                          <p className="mt-0.5 text-[11px] text-ink-faint">{formatRelativeTime(event.occurredAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancelInvoice(invoice.id)}
        title="Cancel invoice"
        message={`Are you sure you want to cancel invoice ${invoice.number}? This cannot be undone.`}
        confirmLabel="Cancel invoice"
        variant="danger"
      />

      {paymentOpen && (
        <RecordPaymentModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          preselectedInvoiceId={invoice.id}
        />
      )}
    </div>
  );
}
