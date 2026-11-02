import { useMemo, useState } from "react";
import { ArrowLeft, Inbox, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { InvoiceHeader } from "@/components/invoices/InvoiceHeader";
import { ActionToolbar } from "@/components/invoices/ActionToolbar";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { InvoiceSummary } from "@/components/invoices/InvoiceSummary";
import { PaymentHistoryList } from "@/components/invoices/PaymentHistoryList";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { computeInvoiceTotals, getInvoiceLedgerStatus } from "@/lib/invoiceMath";

/** Invoice detail shows billing actions and ledger information, not a separate invoice rendering. */
export function InvoicePage() {
  const {
    data: invoices,
    loading: invoicesLoading,
    error: invoicesError,
    reload: reloadInvoices,
  } = useInvoices();
  const {
    data: payments,
    loading: paymentsLoading,
    error: paymentsError,
    reload: reloadPayments,
  } = usePayments();
  const { data: clients, loading: clientsLoading, error: clientsError, reload: reloadClients } = useClients();
  const { data: business } = useBusinessProfile();
  const { selectedInvoiceId, goToInvoices, openCreateInvoice, navigateToPaymentReceipt } = useWorkspaceStore();

  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  // The selected stable id is the only resolution key. This deliberately does
  // not fall back to a first item, filtered invoice list, or display number.
  const invoice = invoices?.find((candidate) => candidate.id === selectedInvoiceId);
  const invoicePayments = useMemo(
    () => (payments ?? []).filter((payment) => payment.invoiceId === selectedInvoiceId),
    [payments, selectedInvoiceId],
  );

  const loading = invoicesLoading || paymentsLoading || clientsLoading;
  const error = invoicesError ?? paymentsError ?? clientsError;

  function retryLoad() {
    reloadInvoices();
    reloadPayments();
    reloadClients();
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Invoice"
          action={
            <button
              type="button"
              onClick={() => goToInvoices()}
              className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-micro hover:border-accent/40 hover:bg-accent/[0.14]"
            >
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
        <div className="px-10 py-10">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load invoice"
            description={error.message}
            action={
              <button
                type="button"
                onClick={retryLoad}
                className="text-sm font-medium text-accent hover:underline"
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Invoice" subtitle="Loading…" />
        <div className="space-y-2 px-10 py-7">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <PageHeader
          title="Invoice"
          action={
            <button
              type="button"
              onClick={() => goToInvoices()}
              className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-micro hover:border-accent/40 hover:bg-accent/[0.14]"
            >
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
        <div className="px-10 py-10">
          <EmptyState icon={Inbox} title="Invoice not found" description="This invoice may have been removed." />
        </div>
      </div>
    );
  }

  const ledgerInfo = invoice.isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);
  const invoiceTotals = computeInvoiceTotals(invoice);
  const client = clients?.find((c) => c.id === invoice.clientId);

  return (
    <div className="flex flex-col h-full">
      <div className="print:hidden">
        <PageHeader
          title="Invoice"
          action={
            <button
              type="button"
              onClick={() => goToInvoices()}
              className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-micro hover:border-accent/40 hover:bg-accent/[0.14]"
            >
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-7 print:px-0 print:py-0 space-y-6">
        {/* Invoice Header */}
        <InvoiceHeader
          invoice={invoice}
          client={client}
          ledgerInfo={ledgerInfo}
          invoiceTotals={invoiceTotals}
        />

        {/* Action Toolbar */}
        <div className="print:hidden">
          <ActionToolbar
            invoice={invoice}
            ledgerInfo={ledgerInfo}
            onContinueEditing={() =>
              openCreateInvoice({
                invoiceId: invoice.id,
                clientId: invoice.clientId,
                items: invoice.items,
                gst: invoice.gst,
                discount: invoice.discount,
                notes: invoice.notes,
                terms: invoice.terms,
                supplierCode: invoice.supplierCode,
                poNumber: invoice.poNumber,
                poDate: invoice.poDate,
                transporter: invoice.transporter,
              })
            }
            onSent={reloadInvoices}
            onReminderSent={() => {}}
            onPaymentRecorded={() => {
              reloadInvoices();
              reloadPayments();
            }}
            onPrint={() => window.print()}
            onExpandPreview={() => setIsPreviewExpanded((prev) => !prev)}
            isPreviewExpanded={isPreviewExpanded}
          />
        </div>

        {/* Invoice Preview */}
        <InvoicePreview
          invoice={invoice}
          client={client}
          business={business}
          isExpanded={isPreviewExpanded}
        />

        {/* Invoice Summary and Details */}
        <InvoiceSummary
          invoice={invoice}
          client={client}
          ledgerInfo={ledgerInfo}
          invoicePayments={invoicePayments}
        />

        {/* Payment History */}
        <section aria-label="Payment history" className="print:hidden">
          <p className="mb-3 text-sm font-medium text-ink">Payment history</p>
          <PaymentHistoryList payments={invoicePayments} onOpenReceipt={navigateToPaymentReceipt} />
        </section>
      </div>
    </div>
  );
}