import { Printer } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { METHOD_LABELS } from "@/lib/paymentLabels";
import type { PaymentProof } from "@/types";

interface PaymentReceiptViewProps {
  paymentId: string;
  onClose: () => void;
}

function hasReadableProof(proof: PaymentProof): boolean {
  return Boolean(
    proof.fileName.trim() &&
      proof.mimeType.trim() &&
      Number.isFinite(proof.sizeBytes) &&
      proof.sizeBytes >= 0 &&
      proof.uploadedAt.trim() &&
      proof.attachmentReference.trim(),
  );
}

/**
 * User filenames are display metadata only. Showing only the final segment
 * prevents a malformed browser filename from looking like a server path.
 */
function displayProofFileName(fileName: string): string {
  return fileName.split(/[\\/]/u).pop() || "Attached proof";
}

/**
 * The Payment_Receipt_View is a provider-backed receipt document, not a
 * transient payment summary. It resolves every related record by its stable
 * id and never chooses a replacement invoice when the association is absent.
 */
export function PaymentReceiptView({ paymentId, onClose }: PaymentReceiptViewProps) {
  const {
    data: payments,
    loading: paymentsLoading,
    error: paymentsError,
    reload: reloadPayments,
  } = usePayments();
  const {
    data: invoices,
    loading: invoicesLoading,
    error: invoicesError,
    reload: reloadInvoices,
  } = useInvoices();
  const { data: clients, loading: clientsLoading, error: clientsError, reload: reloadClients } = useClients();
  const {
    data: business,
    loading: businessLoading,
    error: businessError,
    reload: reloadBusiness,
  } = useBusinessProfile();

  const payment = payments?.find((item) => item.id === paymentId);
  const invoice = payment ? invoices?.find((item) => item.id === payment.invoiceId) : undefined;
  const client = payment ? clients?.find((item) => item.id === payment.clientId) : undefined;
  const loading = paymentsLoading || invoicesLoading || clientsLoading || businessLoading;
  const error = paymentsError ?? invoicesError ?? clientsError ?? businessError;

  function retry() {
    reloadPayments();
    reloadInvoices();
    reloadClients();
    reloadBusiness();
  }

  function receiptFooter(canPrint: boolean) {
    return (
      <>
        {canPrint && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.print()}
            className="print:hidden"
            aria-label="Print receipt"
          >
            <Printer size={14} aria-hidden />
            Print receipt
          </Button>
        )}
        {error && (
          <Button type="button" variant="secondary" size="sm" onClick={retry}>
            Retry
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="print:hidden">
          Close
        </Button>
      </>
    );
  }

  if (loading) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Payment receipt"
        className="payment-receipt-modal"
        panelClassName="payment-receipt-panel"
        footer={receiptFooter(false)}
      >
        <p role="status">Loading payment receipt…</p>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Payment receipt"
        className="payment-receipt-modal"
        panelClassName="payment-receipt-panel"
        footer={receiptFooter(false)}
      >
        <div role="alert" className="space-y-1">
          <p className="font-medium text-ink">Couldn&apos;t load payment receipt</p>
          <p>{error.message}</p>
        </div>
      </Modal>
    );
  }

  if (!payment) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Payment receipt"
        className="payment-receipt-modal"
        panelClassName="payment-receipt-panel"
        footer={receiptFooter(false)}
      >
        <div role="alert" className="space-y-1">
          <p className="font-medium text-ink">Payment not found</p>
          <p>This payment may have been removed.</p>
        </div>
      </Modal>
    );
  }

  const proof = payment.paymentProof;
  const proofUnavailable = Boolean(proof && !hasReadableProof(proof));
  const methodLabel = METHOD_LABELS[payment.method] ?? payment.method;

  return (
      <Modal
        open
        onClose={onClose}
        title="Payment receipt"
        className="payment-receipt-modal"
        panelClassName="payment-receipt-panel"
        footer={receiptFooter(true)}
      >
      <article
        data-testid="payment-receipt"
        data-print-document="payment-receipt"
        aria-label="Payment receipt document"
        className="receipt-document space-y-5 text-left text-sm"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex min-w-0 items-start gap-3">
            {business?.logoUrl && <img src={business.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0">
              {business ? (
                <>
                  <p className="font-display text-xl text-ink">{business.name}</p>
                  <address className="mt-1 whitespace-pre-line text-xs not-italic leading-relaxed text-ink-muted">
                    {business.address}
                  </address>
                  {(business.email || business.phone) && (
                    <p className="mt-1 text-xs text-ink-faint">
                      {[business.email, business.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {(business.gstin || business.pan) && (
                    <p className="mt-1 text-xs text-ink-faint">
                      {[business.gstin && `GSTIN: ${business.gstin}`, business.pan && `PAN: ${business.pan}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </>
              ) : (
                <p role="status" className="font-medium text-ink-muted">
                  Business details unavailable
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <h1 className="font-display text-lg text-ink">Payment receipt</h1>
            <p className="mt-1 text-xs text-ink-faint">Receipt reference</p>
            <p className="font-tabular text-sm text-ink-muted">{payment.id}</p>
          </div>
        </header>

        <section aria-label="Payment details" className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <span className="text-ink-faint">Invoice</span>
            {invoice ? (
              <InvoiceNumberLink invoice={invoice} className="text-right" />
            ) : (
              <span role="status" className="text-right text-ink-faint">
                Invoice unavailable
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-ink-faint">Customer</span>
            {client ? (
              <div className="max-w-[65%] text-right">
                <p className="font-medium text-ink">{client.name}</p>
                <div className="mt-0.5 space-y-0.5 text-xs text-ink-muted">
                  {client.contactName && <p>{client.contactName}</p>}
                  {client.email && <p>{client.email}</p>}
                  {client.billingAddress && <p className="whitespace-pre-line">{client.billingAddress}</p>}
                </div>
              </div>
            ) : (
              <span role="status" className="text-right text-ink-faint">
                Customer unavailable
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink-faint">Payment date</span>
            <span className="font-tabular text-right text-ink">{formatDate(payment.receivedAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <span className="font-medium text-ink">Amount received</span>
            <span className="font-tabular text-right text-lg font-medium text-ink">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink-faint">Method</span>
            <span className="text-right text-ink">{methodLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink-faint">Transaction reference</span>
            <span className="max-w-[65%] break-words text-right text-ink">{payment.reference || "—"}</span>
          </div>
        </section>

        <section aria-label="Payment proof" className="border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Payment proof</p>
          {!proof ? (
            <p className="mt-1 text-sm text-ink-muted">No proof attached.</p>
          ) : proofUnavailable ? (
            <div role="alert" data-testid="payment-proof-unavailable" className="mt-1 space-y-1">
              <p className="font-medium text-ink">Proof unavailable</p>
              <p className="text-sm text-ink-muted">
                The payment was recorded, but its proof could not be loaded. Try again from the payment entry.
              </p>
            </div>
          ) : (
            <div className="mt-1 space-y-0.5 text-sm text-ink-muted">
              <p className="font-medium text-ink">Proof attached</p>
              <p>{displayProofFileName(proof.fileName)}</p>
              <p className="text-xs text-ink-faint">{proof.mimeType} · {proof.sizeBytes} bytes</p>
            </div>
          )}
        </section>
      </article>
    </Modal>
  );
}
