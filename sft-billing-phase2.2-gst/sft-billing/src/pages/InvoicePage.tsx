import { useMemo, useState } from "react";
import { ArrowLeft, Inbox, AlertTriangle, Printer, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { InvoiceHeader } from "@/components/invoices/InvoiceHeader";
import { ActionToolbar } from "@/components/invoices/ActionToolbar";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { InvoicePdfViewer } from "@/components/invoices/InvoicePdfViewer";
import { InvoiceSummary } from "@/components/invoices/InvoiceSummary";
import { PaymentHistoryList } from "@/components/invoices/PaymentHistoryList";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useClients } from "@/hooks/useClients";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { printPdfBlob } from "@/lib/printPdf";
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
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  async function handlePrint() {
    if (!selectedInvoiceId || printing) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const { blob } = await activeDataProvider.getInvoicePdf(selectedInvoiceId);
      await printPdfBlob(blob);
    } catch (caught) {
      setPrintError(caught instanceof Error ? caught.message : "Couldn't print the invoice.");
    } finally {
      setPrinting(false);
    }
  }

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
            <Button variant="secondary" onClick={() => goToInvoices()}>
              <ArrowLeft size={14} /> Back to invoices
            </Button>
          }
        />
        <div className="px-6 lg:px-8 py-10">
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
        <div className="space-y-2 px-6 lg:px-8 py-7">
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
            <Button variant="secondary" onClick={() => goToInvoices()}>
              <ArrowLeft size={14} /> Back to invoices
            </Button>
          }
        />
        <div className="px-6 lg:px-8 py-10">
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
            <>
              <Button variant="secondary" onClick={() => goToInvoices()}>
                <ArrowLeft size={14} /> Back to invoices
              </Button>
              <Button variant="secondary" onClick={() => void handlePrint()} disabled={printing} aria-label="Print invoice">
                {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                Print
              </Button>
            </>
          }
        />
        {printError && (
          <p role="alert" className="px-6 pb-2 text-sm text-overdue lg:px-8">
            {printError}
          </p>
        )}
      </div>

      <div className="space-y-5 px-6 pb-10 lg:px-8 print:px-0 print:py-0">
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
            onExpandPreview={() => setIsPreviewExpanded((prev) => !prev)}
            isPreviewExpanded={isPreviewExpanded}
          />
        </div>

        {/* The real PDF (what "Download PDF" delivers) beside the ledger details */}
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 print:hidden">
            <InvoicePdfViewer
              invoice={invoice}
              fallback={
                <div className="mt-4 w-full text-left">
                  <InvoicePreview invoice={invoice} client={client} business={business} isExpanded={isPreviewExpanded} />
                </div>
              }
            />
          </div>
          <div className="space-y-8 xl:sticky xl:top-4 print:hidden">
            <InvoiceSummary invoice={invoice} client={client} ledgerInfo={ledgerInfo} invoicePayments={invoicePayments} />
            <section aria-label="Payment history">
              <p className="mb-3 text-sm font-medium text-ink">Payment history</p>
              <PaymentHistoryList payments={invoicePayments} onOpenReceipt={navigateToPaymentReceipt} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}