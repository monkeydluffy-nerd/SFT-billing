import { useEffect, useState } from "react";
import { X, Pencil, Printer, FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { METHOD_LABELS } from "@/lib/paymentLabels";
import type { Payment, Invoice, Client, RecordPaymentResult } from "@/types";
import { cn } from "@/lib/cn";
import { RecordPaymentSidePanel } from "./RecordPaymentSidePanel";

const METHOD_ICONS: Record<string, React.ReactNode> = {
  bank_transfer: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3-3v8a3 3 0 003 3z" /></svg>,
  card: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  upi: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  cheque: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  cash: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.759 1.112l-1.112 1.112A2 2 0 0112 10h-2a2 2 0 01-2-2V6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2z" /><circle cx="12" cy="12" r="3" /></svg>,
};

interface PaymentDetailSidePanelProps {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  invoices: Invoice[];
  clients: Client[] | undefined;
  payments: Payment[];
  onRecorded: (result: RecordPaymentResult) => void;
}

export function PaymentDetailSidePanel({
  open,
  onClose,
  payment,
  invoices,
  clients,
  payments,
  onRecorded,
}: PaymentDetailSidePanelProps) {
  const [editOpen, setEditOpen] = useState(false);

  const invoice = payment ? invoices?.find((i) => i.id === payment.invoiceId) : undefined;
  const client = payment ? clients?.find((c) => c.id === payment.clientId) : undefined;
  const invoicePayments = payment
    ? payments.filter((item) => item.invoiceId === payment.invoiceId)
    : [];

  useEffect(() => {
    if (!open) {
      setEditOpen(false);
    }
  }, [open]);

  if (!open || !payment) return null;

  const invoiceTotals = invoice ? computeInvoiceTotals(invoice) : null;
  const paid = invoicePayments.reduce((total, item) => total + item.amount, 0);
  const outstanding = invoiceTotals ? invoiceTotals.total - paid : 0;
  const isFullyPaid = outstanding <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-detail-title"
    >
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex flex-col w-full max-w-lg h-full bg-surface shadow-float-lg border-l border-border animate-in slide-in-from-right duration-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 id="payment-detail-title" className="font-display text-xl text-ink">
            Payment Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:bg-canvas hover:text-ink transition-colors duration-micro"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Payment Header */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-premium/10 text-premium font-medium text-sm flex items-center justify-center">
              {getInitials(client?.name ?? "Unknown")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink text-base truncate">{client?.name ?? "Unknown client"}</p>
              <p className="text-sm text-ink-muted truncate">{invoice?.number ?? "Unknown invoice"}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            {/* Payment ID & Date */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-ink-muted">Payment ID</p>
                <p className="font-mono text-ink text-sm truncate">{payment.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Date</p>
                <p className="font-tabular text-ink">{formatDate(payment.receivedAt)}</p>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-success-bg/50 border border-success/20 rounded-lg p-4">
              <p className="text-xs font-medium text-success">Amount Received</p>
              <p className="mt-1 font-tabular text-2xl font-bold text-success flex items-center gap-2">
                <span className="text-success">+</span>
                {formatCurrency(payment.amount)}
              </p>
            </div>

            {/* Method */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-ink-muted">Method</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-premium/10 text-premium">
                    {METHOD_ICONS[payment.method]}
                  </span>
                  <span className="font-medium text-ink">{METHOD_LABELS[payment.method]}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Reference</p>
                <p className="font-mono text-ink text-sm truncate">{payment.reference ?? "—"}</p>
              </div>
            </div>

            {/* Invoice Payment Progress */}
            {invoice && invoiceTotals && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">Invoice Balance</span>
                  <span className="font-tabular font-medium text-ink">{formatCurrency(invoiceTotals.total)}</span>
                </div>
                <div className="h-2 bg-canvas rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.min(100, (paid / invoiceTotals.total) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">Paid: {formatCurrency(paid)}</span>
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
                      isFullyPaid ? "bg-success-bg text-success" : "bg-caution-bg text-caution"
                    )}
                  >
                    {isFullyPaid ? (
                      <>
                        <CheckCircle2 size={10} className="mr-1" />
                        Fully paid
                      </>
                    ) : (
                      <>
                        <Clock size={10} className="mr-1" />
                        Partial
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Proof */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Payment Proof</p>
              {payment.paymentProof ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success-bg/30 border border-success/20">
                  <FileText className="text-success" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-success">Proof attached</p>
                    <p className="text-xs text-ink-muted truncate">{payment.paymentProof.fileName}</p>
                    <p className="text-xs text-ink-faint">
                      {payment.paymentProof.mimeType} · {payment.paymentProof.sizeBytes} bytes
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-overdue-bg/30 border border-overdue/20">
                  <AlertTriangle className="text-overdue" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-overdue">No proof attached</p>
                    <p className="text-xs text-ink-muted">Add proof to complete the payment record</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditOpen(true)}
              className="w-full"
            >
              <Pencil size={14} className="mr-2" /> Edit Payment
            </Button>
            <Button
              variant="ghost"
              className="w-full text-overdue hover:bg-overdue/5"
              disabled
              title="Payment deletion is not available yet"
            >
              Delete Payment unavailable
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="w-full print:hidden"
            >
              <Printer size={14} className="mr-2" /> Print Receipt
            </Button>
          </div>

        </div>

        {/* Edit Payment Side Panel */}
        <RecordPaymentSidePanel
          open={editOpen}
          onClose={() => setEditOpen(false)}
          invoices={invoices}
          clients={clients}
          payments={payments}
          paymentToReplace={payment}
          onRecorded={(result) => {
            setEditOpen(false);
            onRecorded(result);
          }}
        />

      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}