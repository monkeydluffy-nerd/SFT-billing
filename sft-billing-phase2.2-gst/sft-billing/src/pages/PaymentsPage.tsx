import { useMemo, useState } from "react";
import { Plus, Inbox, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { usePayments } from "@/hooks/usePayments";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { METHOD_LABELS } from "@/lib/paymentLabels";
import type { Payment, RecordPaymentResult } from "@/types";

export function PaymentsPage() {
  const { data: payments, loading, error, reload } = usePayments();
  const { data: invoices } = useInvoices();
  const { data: clients } = useClients();
  const navigateToPaymentReceipt = useWorkspaceStore((s) => s.navigateToPaymentReceipt);

  const [recordOpen, setRecordOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<Payment | null>(null);
  const [proofWarnings, setProofWarnings] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const sortedPayments = useMemo(
    () => [...(payments ?? [])].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()),
    [payments],
  );
  const billedInvoices = useMemo(() => (invoices ?? []).filter((invoice) => !invoice.isDraft), [invoices]);

  function invoiceFor(invoiceId: string) {
    return invoices?.find((i) => i.id === invoiceId);
  }

  function handlePersisted(result: RecordPaymentResult) {
    // Reload even for a retained-payment proof error. The provider response
    // and subsequent read are the persisted truth, not the selected File.
    reload();
    setProofWarnings((previous) => {
      const next = { ...previous };
      if (result.proofError) next[result.payment.id] = result.proofError.message;
      else delete next[result.payment.id];
      return next;
    });
  }

  function closeRecordPayment() {
    setRecordOpen(false);
    setReplacementTarget(null);
  }

  function handleRecorded(result: RecordPaymentResult) {
    closeRecordPayment();
    setToast(`Payment of ${formatCurrency(result.payment.amount)} recorded`);
  }

  function openNewPayment() {
    setReplacementTarget(null);
    setRecordOpen(true);
  }

  function openProofReplacement(payment: Payment) {
    setRecordOpen(false);
    setReplacementTarget(payment);
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Payments" subtitle="Every payment received, in one place" />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load payments" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Every payment received, in one place"
        action={
          <button
            type="button"
            onClick={openNewPayment}
            disabled={!invoices || billedInvoices.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} /> Record payment
          </button>
        }
      />

      <div className="space-y-5 px-10 py-7">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : sortedPayments.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No payments recorded yet"
            description="Record a payment against an invoice to see it here."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {sortedPayments.map((payment) => {
              const invoice = invoiceFor(payment.invoiceId);
              const proofWarning = proofWarnings[payment.id];
              return (
                <div
                  key={payment.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToPaymentReceipt(payment.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateToPaymentReceipt(payment.id);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-canvas"
                >
                  <span className="w-28 shrink-0 text-ink-muted">{formatDate(payment.receivedAt)}</span>
                  <span className="w-24 shrink-0">
                    {invoice ? <InvoiceNumberLink invoice={invoice} /> : <span className="font-medium text-ink">Unknown invoice</span>}
                  </span>
                  <span className="flex-1 truncate text-ink-muted">{getClientName(clients, payment.clientId)}</span>
                  <span className="font-tabular w-28 shrink-0 text-right text-ink">{formatCurrency(payment.amount)}</span>
                  <span className="w-32 shrink-0 text-ink-muted">{METHOD_LABELS[payment.method]}</span>
                  <span className="w-32 shrink-0 truncate text-ink-faint">{payment.reference ?? "—"}</span>
                  <span className="flex w-52 shrink-0 items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${payment.paymentProof ? "text-ink-muted" : proofWarning ? "text-overdue" : "text-ink-faint"}`}
                      title={payment.paymentProof?.fileName ?? proofWarning}
                    >
                      {payment.paymentProof ? `Proof: ${payment.paymentProof.fileName}` : proofWarning ? "Proof unavailable" : "No proof"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProofReplacement(payment);
                      }}
                      className="shrink-0 text-xs font-medium text-accent hover:underline"
                      aria-label={`${payment.paymentProof ? "Replace" : "Add"} proof for payment ${payment.id}`}
                    >
                      {payment.paymentProof ? "Replace proof" : "Add proof"}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecordPaymentModal
        open={recordOpen || Boolean(replacementTarget)}
        onClose={closeRecordPayment}
        invoices={billedInvoices}
        clients={clients}
        paymentToReplace={replacementTarget ?? undefined}
        onPersisted={handlePersisted}
        onRecorded={handleRecorded}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
