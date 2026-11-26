import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { activeDataProvider } from "@/services";
import { computeInvoiceTotals, roundMoney } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { isSupportedPaymentProof, PAYMENT_PROOF_ACCEPT, PAYMENT_PROOF_INVALID_MESSAGE } from "@/lib/paymentProof";
import type {
  Client,
  Invoice,
  Payment,
  PaymentMethod,
  PaymentProofError,
  PaymentProofUpload,
  RecordPaymentResult,
} from "@/types";

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoices: Invoice[];
  clients: Client[] | undefined;
  onRecorded: (result: RecordPaymentResult) => void;
  /** Optional callback used to refresh provider-backed lists for retained results too. */
  onPersisted?: (result: RecordPaymentResult) => void;
  /** Existing payment to which one new proof file should be attached/replaced. */
  paymentToReplace?: Payment;
}

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";
const errorInputClass = "border-overdue";
const labelClass = "mb-1.5 block text-xs font-medium text-ink-muted";
const errorTextClass = "mt-1 text-xs text-overdue";

interface FormErrors {
  invoiceId?: string;
  amount?: string;
  method?: string;
  proof?: string;
}

function toProofUpload(file: File): PaymentProofUpload {
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    content: file,
  };
}

/**
 * Records a payment through the DataProvider boundary and optionally enriches
 * that same payment with one proof file. An existing payment id is retained
 * after a proof failure so retrying cannot create a duplicate ledger record.
 */
export function RecordPaymentModal({
  open,
  onClose,
  invoices,
  clients,
  onRecorded,
  onPersisted,
  paymentToReplace,
}: RecordPaymentModalProps) {
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [reference, setReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [proofError, setProofError] = useState<PaymentProofError | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [persistedPayment, setPersistedPayment] = useState<Payment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const billedInvoices = useMemo(() => invoices.filter((invoice) => !invoice.isDraft), [invoices]);
  const currentPayment = persistedPayment ?? paymentToReplace;
  const isProofReplacement = Boolean(currentPayment);
  const selectedInvoice = billedInvoices.find((i) => i.id === invoiceId);

  const sortedInvoices = useMemo(
    () => [...billedInvoices].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [billedInvoices],
  );

  useEffect(() => {
    if (!open || !paymentToReplace) return;

    setPersistedPayment(paymentToReplace);
    setInvoiceId(paymentToReplace.invoiceId);
    setAmount(String(roundMoney(paymentToReplace.amount)));
    setMethod(paymentToReplace.method);
    setReference(paymentToReplace.reference ?? "");
    setProofFile(null);
    setErrors({});
    setProofError(undefined);
    setSubmitError(null);
  }, [open, paymentToReplace]);

  function reset() {
    setInvoiceId("");
    setAmount("");
    setMethod("");
    setReference("");
    setProofFile(null);
    setErrors({});
    setProofError(undefined);
    setSubmitError(null);
    setPersistedPayment(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleInvoiceSelect(id: string) {
    setInvoiceId(id);
    setErrors((previous) => ({ ...previous, invoiceId: undefined }));
    const invoice = billedInvoices.find((item) => item.id === id);
    if (invoice && !amount) {
      setAmount(String(roundMoney(computeInvoiceTotals(invoice).total)));
    }
  }

  function handleProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setProofError(undefined);
    setSubmitError(null);

    if (file && !isSupportedPaymentProof(file.name, file.type)) {
      setProofFile(null);
      setErrors((previous) => ({ ...previous, proof: PAYMENT_PROOF_INVALID_MESSAGE }));
      return;
    }

    setProofFile(file);
    setErrors((previous) => ({ ...previous, proof: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const parsedAmount = Number(amount);
    const validationErrors: FormErrors = {};
    const invoice = billedInvoices.find((item) => item.id === invoiceId);
    const isValidMethod = METHOD_OPTIONS.some((option) => option.value === method);

    if (!invoiceId || !invoice) {
      validationErrors.invoiceId = isProofReplacement
        ? "The payment's invoice is unavailable."
        : "Select an invoice.";
    }
    if (!isProofReplacement && (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      validationErrors.amount = "Enter an amount greater than zero.";
    }
    if (!isProofReplacement && !isValidMethod) {
      validationErrors.method = "Select a payment method.";
    }
    if (isProofReplacement && !proofFile) {
      validationErrors.proof = "Choose one proof file to attach or replace the current proof.";
    }

    setErrors(validationErrors);
    setSubmitError(null);
    if (Object.keys(validationErrors).length > 0 || !invoice) return;
    const selectedInvoice = invoice;

    const payment: Omit<Payment, "paymentProof"> = currentPayment
      ? {
          id: currentPayment.id,
          invoiceId: currentPayment.invoiceId,
          clientId: currentPayment.clientId,
          amount: currentPayment.amount,
          method: currentPayment.method,
          receivedAt: currentPayment.receivedAt,
          reference: currentPayment.reference,
        }
      : {
          id: `pm_runtime_${Date.now()}`,
          invoiceId: selectedInvoice.id,
          clientId: selectedInvoice.clientId,
          amount: parsedAmount,
          method: method as PaymentMethod,
          receivedAt: new Date().toISOString(),
          reference: reference.trim() || undefined,
        };

    setSubmitting(true);
    try {
      const result = await activeDataProvider.recordPayment(payment, proofFile ? toProofUpload(proofFile) : undefined);
      onPersisted?.(result);

      if (result.proofError) {
        // The payment row is durable. Keep its returned identity and any prior
        // proof in the form so a retry uses the approved replacement boundary.
        setPersistedPayment(result.payment);
        setProofError(result.proofError);
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      reset();
      onRecorded(result);
    } catch (error) {
      setSubmitting(false);
      setSubmitError(error instanceof Error ? error.message : "Could not record the payment.");
    }
  }

  const title = isProofReplacement
    ? currentPayment?.paymentProof
      ? "Replace payment proof"
      : "Attach payment proof"
    : "Record payment";
  const submitLabel = isProofReplacement
    ? currentPayment?.paymentProof
      ? "Replace proof"
      : "Attach proof"
    : "Record payment";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="record-payment-form" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-3 text-left">
        {submitError && (
          <div role="alert" className="rounded-md border border-overdue/40 bg-overdue/5 px-3 py-2 text-xs text-overdue">
            {submitError}
          </div>
        )}
        {proofError && (
          <div role="alert" className="space-y-1 rounded-md border border-overdue/40 bg-overdue/5 px-3 py-2 text-xs text-overdue">
            <p className="font-medium">{proofError.message}</p>
            <p>
              {currentPayment?.paymentProof
                ? "The existing proof remains attached. Choose another file to retry."
                : "The payment was recorded without proof. Choose a file to retry."}
            </p>
          </div>
        )}

        {currentPayment?.paymentProof && (
          <div
            data-testid="current-payment-proof"
            className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2 text-xs"
          >
            <span className="text-ink-muted">Current proof</span>
            <span className="max-w-[13rem] truncate font-medium text-ink" title={currentPayment.paymentProof.fileName}>
              {currentPayment.paymentProof.fileName}
            </span>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="payment-invoice">
            Invoice
          </label>
          <select
            id="payment-invoice"
            value={invoiceId}
            onChange={(e) => handleInvoiceSelect(e.target.value)}
            disabled={isProofReplacement || submitting}
            className={`${inputClass} ${errors.invoiceId ? errorInputClass : ""}`}
          >
            <option value="">Select an invoice</option>
            {sortedInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} — {getClientName(clients, invoice.clientId)}
              </option>
            ))}
          </select>
          {errors.invoiceId && <p className={errorTextClass}>{errors.invoiceId}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="payment-amount">
            Amount
          </label>
          <input
            id="payment-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={selectedInvoice ? String(roundMoney(computeInvoiceTotals(selectedInvoice).total)) : "0"}
            disabled={isProofReplacement || submitting}
            className={`font-tabular ${inputClass} ${errors.amount ? errorInputClass : ""}`}
          />
          {errors.amount && <p className={errorTextClass}>{errors.amount}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="payment-method">
            Method
          </label>
          <select
            id="payment-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            disabled={isProofReplacement || submitting}
            className={`${inputClass} ${errors.method ? errorInputClass : ""}`}
          >
            <option value="">Select a method</option>
            {METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.method && <p className={errorTextClass}>{errors.method}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="payment-reference">
            Reference (optional)
          </label>
          <input
            id="payment-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transaction ID, cheque number…"
            disabled={isProofReplacement || submitting}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="payment-proof">
            Proof {isProofReplacement ? "(choose one file)" : "(optional, one file)"}
          </label>
          <input
            id="payment-proof"
            type="file"
            accept={PAYMENT_PROOF_ACCEPT}
            onChange={handleProofChange}
            disabled={submitting}
            className={`block w-full text-xs text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-canvas file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-ink ${
              errors.proof ? errorInputClass : ""
            }`}
          />
          {proofFile && <p className="mt-1 truncate text-xs text-ink-muted">Selected: {proofFile.name}</p>}
          {errors.proof && <p className={errorTextClass}>{errors.proof}</p>}
        </div>
      </form>
    </Modal>
  );
}
