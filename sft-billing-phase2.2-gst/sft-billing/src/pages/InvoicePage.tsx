import { useMemo } from "react";
import { AlertTriangle, ArrowLeft, Inbox, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { StatusChip } from "@/components/shared/StatusChip";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { Button } from "@/components/shared/Button";
import { DownloadInvoiceButton } from "@/components/create-invoice/DownloadInvoiceButton";
import { InvoiceFileActions } from "@/components/create-invoice/InvoiceFileActions";
import { InvoiceDocumentRenderer } from "@/components/create-invoice/InvoiceDocumentRenderer";
import { buildInvoiceDocumentModel } from "@/components/create-invoice/invoiceDocumentModel";
import { InvoiceDetailActions } from "@/components/invoices/InvoiceDetailActions";
import { PaymentHistoryList } from "@/components/invoices/PaymentHistoryList";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { getInvoiceLedgerStatus } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency } from "@/lib/formatters";

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
  const {
    data: business,
    loading: businessLoading,
    error: businessError,
    reload: reloadBusiness,
  } = useBusinessProfile();
  const { selectedInvoiceId, goToInvoices, openCreateInvoice, navigateToPaymentReceipt, navigateToInvoiceDetail } = useWorkspaceStore();

  const invoice = invoices?.find((candidate) => candidate.id === selectedInvoiceId);
  const invoicePayments = useMemo(
    () => (payments ?? []).filter((payment) => payment.invoiceId === selectedInvoiceId),
    [payments, selectedInvoiceId],
  );

  const loading = invoicesLoading || paymentsLoading || clientsLoading || businessLoading;
  const error = invoicesError ?? paymentsError ?? clientsError ?? businessError;

  function retryLoad() {
    reloadInvoices();
    reloadPayments();
    reloadClients();
    reloadBusiness();
  }

  function handleUploaded(saved: { id: string }) {
    reloadInvoices();
    navigateToInvoiceDetail(saved.id);
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Invoice"
          action={
            <button type="button" onClick={() => goToInvoices()} className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent">
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load invoice" description={error.message} action={<button type="button" onClick={retryLoad} className="text-sm font-medium text-accent hover:underline">Retry</button>} />
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
            <button type="button" onClick={() => goToInvoices()} className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent">
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
        <div className="px-10 py-10">
          <EmptyState icon={Inbox} title="Invoice not found" description="This invoice may have been removed." />
          <div className="mt-6 flex justify-center">
            <InvoiceFileActions onUploaded={handleUploaded} />
          </div>
        </div>
      </div>
    );
  }

  const client = clients?.find((candidate) => candidate.id === invoice.clientId);
  const model = buildInvoiceDocumentModel({ invoice, client, business });
  const ledgerInfo = invoice.isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title={invoice.number}
          subtitle={getClientName(clients, invoice.clientId)}
          action={
            <button type="button" onClick={() => goToInvoices()} className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent">
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
      </div>

      <div className="space-y-8 px-10 py-7 print:space-y-0 print:px-0 print:py-0">
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={14} aria-hidden /> Print / PDF
          </Button>
          <DownloadInvoiceButton invoice={invoice} client={client} business={business} />
          <InvoiceFileActions invoice={invoice} onUploaded={handleUploaded} />
          <InvoiceDetailActions
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
          />
        </div>

        <section aria-label="Invoice document" data-testid="invoice-document" className="invoice-print-region flex justify-center print:block">
          <InvoiceDocumentRenderer model={model} />
        </section>

        <section aria-label="Invoice ledger summary" className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-5 print:hidden">
          <div>
            {invoice.isDraft ? (
              <StatusChip info={{ status: "draft", daysOverdue: 0, severity: null }} />
            ) : (
              ledgerInfo && <LedgerStatusChip info={ledgerInfo} />
            )}
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-medium text-ink-faint">Invoice total</p>
            <p className="font-tabular text-xl text-ink">{formatCurrency(model.totals.total)}</p>
          </div>
        </section>

        <section aria-label="Payment history" className="print:hidden">
          <p className="mb-3 text-sm font-medium text-ink">Payment history</p>
          <PaymentHistoryList payments={invoicePayments} onOpenReceipt={navigateToPaymentReceipt} />
        </section>
      </div>
    </div>
  );
}
