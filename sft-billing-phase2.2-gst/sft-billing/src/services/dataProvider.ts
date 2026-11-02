import type {
  ActivityEvent,
  BusinessProfile,
  CatalogProduct,
  CatalogProductInput,
  Client,
  Invoice,
  InventoryMovement,
  InventoryMovementInput,
  Notification,
  Payment,
  PaymentProofUpload,
  Product,
  ProductStock,
  RecordPaymentResult,
  ReportDefinition,
  User,
} from "@/types";

/**
 * This is the ONLY interface components/hooks are allowed to depend on
 * for data access (see src/hooks/*). The API, in-memory, and offline
 * providers implement this interface so screens do not depend on a
 * specific backend.
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
  updateClient(clientId: string, update: Partial<Omit<Client, "id">>): Promise<Client>;
  /** Deletes a client only when no protected billing records reference it. */
  deleteClient(clientId: string): Promise<void>;

  getInvoices(): Promise<Invoice[]>;
  reserveInvoiceNumber(invoiceId: string): Promise<string>;
  releaseReservation(invoiceId: string): Promise<{ released: boolean; invoiceId: string }>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  /** Persists a new or edited invoice — used by Create Invoice (save draft / send) and row actions (mark paid, duplicate). */
  saveInvoice(invoice: Invoice): Promise<Invoice>;
  /** Deletes only an unbilled invoice with no payment or inventory history. */
  deleteInvoice(invoiceId: string): Promise<void>;
  /** Downloads the saved invoice rendered with the backend's Excel template. */
  getInvoiceExcel(id: string): Promise<{ blob: Blob; warnings: string[] }>;
  /** Downloads a PDF converted from the same saved Excel template. */
  getInvoicePdf(id: string): Promise<{ blob: Blob; warnings: string[] }>;

  getProducts(): Promise<Product[]>;
  getCatalogProducts(): Promise<CatalogProduct[]>;
  createCatalogProduct(product: CatalogProductInput): Promise<CatalogProduct>;
  updateCatalogProduct(
    productId: string,
    update: Partial<CatalogProductInput>,
  ): Promise<CatalogProduct>;
  setCatalogProductArchived(productId: string, isArchived: boolean): Promise<CatalogProduct>;
  setCatalogProductActive(productId: string, isActive: boolean): Promise<CatalogProduct>;
  deleteCatalogProduct(productId: string): Promise<void>;
  getProductStock(productId: string): Promise<ProductStock>;
  getInventoryMovements(productId: string): Promise<InventoryMovement[]>;
  recordInventoryMovement(
    productId: string,
    movement: InventoryMovementInput,
  ): Promise<InventoryMovement>;

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

  /** Fetch notifications with optional filters. */
  getNotifications(limit?: number, unreadOnly?: boolean, category?: string): Promise<Notification[]>;
  /** Get unread notification count, optionally filtered by category. */
  getUnreadCount(category?: string): Promise<{ count: number; category?: string }>;
  /** Get available notification categories. */
  getNotificationCategories(): Promise<Record<string, string>>;
  /** Get available notification types. */
  getNotificationTypes(): Promise<Record<string, [string, string]>>;
  /** Mark a notification as read. */
  markNotificationRead(notificationId: string): Promise<Notification>;
  /** Mark all notifications as read, optionally filtered by category. */
  markAllNotificationsRead(category?: string): Promise<{ count: number }>;

  getReports(): Promise<ReportDefinition[]>;

  getCurrentUser(): Promise<User>;
  /** The workspace's own identity, shown as the "from" party on every invoice preview. Editable in Workspace Settings. */
  getBusinessProfile(): Promise<BusinessProfile>;
  /** Persists an edit made in Workspace Settings. Partial - only supplied fields change. */
  updateBusinessProfile(update: Partial<BusinessProfile>): Promise<BusinessProfile>;
}
