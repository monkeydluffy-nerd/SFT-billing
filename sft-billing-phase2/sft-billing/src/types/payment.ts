export type PaymentMethod = "bank_transfer" | "card" | "upi" | "cheque" | "cash";

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  method: PaymentMethod;
  receivedAt: string; // ISO date
  reference?: string;
}
