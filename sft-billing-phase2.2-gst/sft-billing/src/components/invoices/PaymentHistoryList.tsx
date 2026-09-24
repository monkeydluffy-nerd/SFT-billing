import { Inbox } from "lucide-react";
import type { Payment } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { METHOD_LABELS } from "@/lib/paymentLabels";
import { EmptyState } from "@/components/shared/EmptyState";

interface PaymentHistoryListProps {
  payments: Payment[];
  onOpenReceipt: (paymentId: string) => void;
}

/**
 * The Invoice_Detail_Page's payment history — exactly the payments
 * passed in (callers filter by invoiceId), each one opening its own
 * Payment_Receipt_View when activated.
 */
export function PaymentHistoryList({ payments, onOpenReceipt }: PaymentHistoryListProps) {
  if (payments.length === 0) {
    return <EmptyState icon={Inbox} title="No payments recorded yet" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {payments.map((payment) => (
        <button
          key={payment.id}
          type="button"
          onClick={() => onOpenReceipt(payment.id)}
          className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left transition-colors duration-micro last:border-b-0 hover:bg-canvas"
        >
          <span className="w-28 shrink-0 text-ink-muted">{formatDate(payment.receivedAt)}</span>
          <span className="font-tabular flex-1 text-ink">{formatCurrency(payment.amount)}</span>
          <span className="w-32 shrink-0 text-ink-muted">{METHOD_LABELS[payment.method]}</span>
        </button>
      ))}
    </div>
  );
}
