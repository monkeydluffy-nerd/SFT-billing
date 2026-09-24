import type { ActivityEvent, Client, Invoice, Payment, ReportDefinition, User } from "@/types";

/**
 * This is the ONLY interface components/hooks are allowed to depend on
 * for data access (see src/hooks/*). `mockDataProvider.ts` implements it
 * against the in-memory demo dataset today; a future `apiDataProvider.ts`
 * implements the same interface against real HTTP/database calls. When
 * that day comes, only `activeDataProvider` below changes — no component
 * or hook is touched.
 *
 * Every method returns a Promise even though the mock implementation is
 * synchronous under the hood, so components already handle real-world
 * latency, loading states, and failure correctly from day one (see the
 * simulated delay/failure in mockDataProvider.ts).
 */
export interface DataProvider {
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;

  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  /** Phase 2: will persist a new/edited invoice. Mock version below stores in-memory only. */
  saveInvoice(invoice: Invoice): Promise<Invoice>;

  getPayments(): Promise<Payment[]>;
  /** Phase 3: will persist a recorded payment. Mock version below stores in-memory only. */
  recordPayment(payment: Payment): Promise<Payment>;

  getActivity(): Promise<ActivityEvent[]>;

  getReports(): Promise<ReportDefinition[]>;

  getCurrentUser(): Promise<User>;
}
