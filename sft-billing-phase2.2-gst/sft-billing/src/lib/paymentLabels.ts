import type { PaymentMethod } from "@/types";

/**
 * Shared payment-method label map — the single source of truth used by
 * PaymentsPage, PaymentHistoryList (Invoice Detail page), and
 * PaymentReceiptView, so these three surfaces can never disagree about
 * how a payment method displays.
 */
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
};
