import type {
  ActivityEvent,
  BusinessProfile,
  Client,
  Invoice,
  Payment,
  PaymentProofUpload,
  Product,
  RecordPaymentResult,
  ReportDefinition,
  User,
} from "@/types";

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
  /** Used by Create Invoice's inline "+ new client" — full Clients module (edit, history) arrives in Phase 3. */
  createClient(client: Client): Promise<Client>;
  /** Persists edits through the existing client PUT endpoint while keeping the stable id and relationship date unchanged. */
  updateClient(clientId: string, update: Partial<Omit<Client, "id" | "clientSince">>): Promise<Client>;

  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  /** Persists a new or edited invoice — used by Create Invoice (save draft / send) and row actions (mark paid, duplicate). */
  saveInvoice(invoice: Invoice): Promise<Invoice>;

  getProducts(): Promise<Product[]>;

  getPayments(): Promise<Payment[]>;
  /**
   * Records a payment and optionally uploads one proof through the same
   * provider boundary. Passing an existing payment id with a proof replaces
   * that payment's current proof in place; it must not create another payment.
   */
  recordPayment(
    payment: Omit<Payment, "paymentProof">,
    proof?: PaymentProofUpload,
  ): Promise<RecordPaymentResult>;

  getActivity(): Promise<ActivityEvent[]>;
  /** Appends a new activity event — used whenever an action in the UI (send, remind, mark paid) produces something worth recording. */
  addActivityEvent(event: Omit<ActivityEvent, "id">): Promise<ActivityEvent>;

  getReports(): Promise<ReportDefinition[]>;

  getCurrentUser(): Promise<User>;
  /** The workspace's own identity, shown as the "from" party on every invoice preview. Editable in Workspace Settings. */
  getBusinessProfile(): Promise<BusinessProfile>;
  /** Persists an edit made in Workspace Settings. Partial - only supplied fields change. */
  updateBusinessProfile(update: Partial<BusinessProfile>): Promise<BusinessProfile>;
}
