import type { DataProvider } from "./dataProvider";
import {
  mockClients,
  mockInvoices,
  mockProducts,
  mockPayments,
  mockActivity,
  mockReports,
  mockCurrentUser,
  mockBusinessProfile,
} from "@/data";
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
  PaymentProof,
  PaymentProofError,
  PaymentProofUpload,
  Product,
  ProductStock,
  RecordPaymentResult,
} from "@/types";
import { isSupportedPaymentProof, PAYMENT_PROOF_INVALID_MESSAGE } from "@/lib/paymentProof";

// In-memory mutable copies so saveInvoice/recordPayment/addActivityEvent/
// createClient have somewhere real to write during development.
function clonePayment(payment: Payment): Payment {
  return {
    ...payment,
    ...(payment.paymentProof ? { paymentProof: { ...payment.paymentProof } } : {}),
  };
}

const clientStore: Client[] = [...mockClients];
const invoiceStore: Invoice[] = [...mockInvoices];
const invoiceNumberReservations: { number: string; reservedFor: string | null }[] = invoiceStore.map((invoice) => ({
  number: invoice.number,
  reservedFor: invoice.id,
}));
const catalogProductStore: CatalogProduct[] = mockProducts.map((product) => ({
  id: product.id,
  code: product.id.toUpperCase(),
  name: product.name,
  type: "product",
  hsnCode: product.hsnCode ?? "",
  unit: product.unit,
  defaultUnitPrice: product.defaultUnitPrice,
  defaultGstRate: 0.18,
  weight: null,
  weightUnit: null,
  purchaseCost: null,
  lowStockThreshold: null,
  stockOnHand: null,
  isActive: true,
  isArchived: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}));
const inventoryMovementStore: InventoryMovement[] = [];
const paymentStore: Payment[] = mockPayments.map(clonePayment);
const activityStore: ActivityEvent[] = [...mockActivity];
const notificationStore: Notification[] = [];
let businessProfileStore: BusinessProfile = { ...mockBusinessProfile };

let activityCounter = activityStore.length;
let proofCounter = 0;
let productCounter = 0;
let movementCounter = 0;

/** Small simulated latency — real enough to exercise loading states, never long enough to feel sluggish. */
function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function proofValidationError(paymentId: string, message: string): PaymentProofError {
  return {
    code: "proof_invalid",
    stage: "write",
    message,
    paymentId,
    retryable: false,
  };
}

function createMockProof(
  paymentId: string,
  upload: PaymentProofUpload,
): { proof?: PaymentProof; error?: PaymentProofError } {
  if (
    !upload.fileName.trim() ||
    !upload.mimeType.trim() ||
    !Number.isFinite(upload.sizeBytes) ||
    upload.sizeBytes < 0
  ) {
    return {
      error: proofValidationError(paymentId, "Payment proof metadata is invalid."),
    };
  }

  if (!isSupportedPaymentProof(upload.fileName, upload.mimeType)) {
    return {
      error: proofValidationError(paymentId, PAYMENT_PROOF_INVALID_MESSAGE),
    };
  }

  proofCounter += 1;
  return {
    proof: {
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      uploadedAt: new Date().toISOString(),
      attachmentReference: `payment-proofs/${paymentId}/proof-${proofCounter}`,
    },
  };
}

export const mockDataProvider: DataProvider = {
  async getClients() {
    return delay(clientStore);
  },
  async getClient(id) {
    return delay(clientStore.find((c) => c.id === id));
  },
  async createClient(client) {
    clientStore.unshift(client);
    return delay(client);
  },
  async updateClient(clientId, update) {
    const index = clientStore.findIndex((client) => client.id === clientId);
    if (index < 0) throw new Error("Client not found.");
    const updated = { ...clientStore[index], ...update, id: clientStore[index].id };
    clientStore[index] = updated;
    return delay(updated);
  },
  async deleteClient(clientId) {
    const index = clientStore.findIndex((client) => client.id === clientId);
    if (index < 0) throw new Error("Client not found.");
    if (invoiceStore.some((invoice) => invoice.clientId === clientId) ||
        paymentStore.some((payment) => payment.clientId === clientId)) {
      throw new Error("This client has linked invoices or payments and cannot be deleted.");
    }
    clientStore.splice(index, 1);
    await delay(undefined);
  },

  async getInvoices() {
    return delay(invoiceStore);
  },
  async reserveInvoiceNumber(invoiceId) {
    const existing = invoiceNumberReservations.find(
      (reservation) => reservation.reservedFor === invoiceId,
    );
    if (existing) return delay(existing.number);
    const year = new Date().getFullYear();
    const financialYear = new Date().getMonth() >= 3 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
    const used = [
      ...invoiceNumberReservations.map((reservation) => reservation.number),
      ...invoiceStore.map((invoice) => invoice.number),
    ].map((number) => number.match(/^(\d{3})\/(.+)$/))
      .filter((match) => match?.[2] === financialYear)
      .map((match) => Number(match?.[1]));
    const number = `${String(Math.max(0, ...used) + 1).padStart(3, "0")}/${financialYear}`;
    invoiceNumberReservations.push({ number, reservedFor: invoiceId });
    return delay(number);
  },
  async releaseReservation(invoiceId) {
    const reservation = invoiceNumberReservations.find(
      (reservation) => reservation.reservedFor === invoiceId,
    );
    if (reservation) {
      reservation.reservedFor = null;
      return delay({ released: true, invoiceId });
    }
    return delay({ released: false, invoiceId });
  },
  async getInvoice(id) {
    return delay(invoiceStore.find((i) => i.id === id));
  },
  async saveInvoice(invoice) {
    const index = invoiceStore.findIndex((i) => i.id === invoice.id);
    if (index >= 0) {
      invoiceStore[index] = invoice;
    } else {
      invoiceStore.unshift(invoice);
    }
    return delay(invoice);
  },
  async deleteInvoice(invoiceId) {
    const index = invoiceStore.findIndex((invoice) => invoice.id === invoiceId);
    if (index < 0) throw new Error("Invoice not found.");
    const invoice = invoiceStore[index];
    if (!invoice.isDraft) {
      throw new Error("Billed invoices cannot be permanently deleted. No cancellation or correction workflow is available here.");
    }
    if (invoice.billedAt || invoice.sentAt || invoice.viewedAt || invoice.paidAt) {
      throw new Error("This draft invoice has billing, delivery, or payment history and cannot be deleted.");
    }
    if (paymentStore.some((payment) => payment.invoiceId === invoiceId)) {
      throw new Error("This invoice has payment history and cannot be deleted.");
    }
    if (inventoryMovementStore.some((movement) => movement.invoiceId === invoiceId)) {
      throw new Error("This invoice has inventory history and cannot be deleted.");
    }
    invoiceStore.splice(index, 1);
    for (const reservation of invoiceNumberReservations) {
      if (reservation.reservedFor === invoiceId) reservation.reservedFor = null;
    }
    for (const activity of activityStore) {
      if (activity.invoiceId === invoiceId) delete activity.invoiceId;
    }
    await delay(undefined);
  },
  async getInvoiceExcel() {
    throw new Error("Excel invoice export requires the backend API provider.");
  },
  async getInvoicePdf() {
    throw new Error("PDF invoice export requires the backend API provider.");
  },

  async getProducts() {
    return delay(catalogProductStore.filter((product) => product.isActive).map((product): Product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      defaultUnitPrice: product.defaultUnitPrice,
      unit: product.unit,
      hsnCode: product.hsnCode,
    })));
  },
  async getCatalogProducts() {
    return delay(catalogProductStore);
  },
  async createCatalogProduct(input: CatalogProductInput) {
    productCounter += 1;
    const timestamp = new Date().toISOString();
    const product: CatalogProduct = {
      id: `pr_mock_${productCounter}`,
      ...input,
      isActive: input.isActive ?? true,
      isArchived: false,
      stockOnHand: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    catalogProductStore.unshift(product);
    return delay(product);
  },
  async updateCatalogProduct(productId: string, update: Partial<CatalogProductInput> & { isArchived?: boolean }) {
    const index = catalogProductStore.findIndex((product) => product.id === productId);
    if (index < 0) throw new Error("Product not found.");
    const { isArchived, ...rest } = update;
    catalogProductStore[index] = {
      ...catalogProductStore[index],
      ...rest,
      ...(isArchived !== undefined ? { isArchived } : {}),
      id: productId,
      updatedAt: new Date().toISOString(),
    };
    return delay(catalogProductStore[index]);
  },
  async setCatalogProductArchived(productId: string, isArchived: boolean) {
    const index = catalogProductStore.findIndex((product) => product.id === productId);
    if (index < 0) throw new Error("Product not found.");
    catalogProductStore[index] = {
      ...catalogProductStore[index],
      isArchived,
      updatedAt: new Date().toISOString(),
    };
    return delay(catalogProductStore[index]);
  },
  async setCatalogProductActive(productId: string, isActive: boolean) {
    return this.updateCatalogProduct(productId, { isActive });
  },
  async deleteCatalogProduct(productId: string) {
    const index = catalogProductStore.findIndex((product) => product.id === productId);
    if (index < 0) throw new Error("Product not found.");
    if (
      invoiceStore.some((invoice) => invoice.items.some((item) => item.productId === productId)) ||
      inventoryMovementStore.some((movement) => movement.productId === productId)
    ) {
      throw new Error(
        "Cannot delete a product referenced by historical invoice items or inventory movements. Deactivate instead.",
      );
    }
    catalogProductStore.splice(index, 1);
    await delay(undefined);
  },
  async getProductStock(productId: string) {
    const product = catalogProductStore.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found.");
    return delay({
      productId,
      stockOnHand: product.stockOnHand,
      unit: product.unit,
    } satisfies ProductStock);
  },
  async getInventoryMovements(productId: string) {
    if (!catalogProductStore.some((product) => product.id === productId)) {
      throw new Error("Product not found.");
    }
    return delay(inventoryMovementStore.filter((movement) => movement.productId === productId));
  },
  async recordInventoryMovement(productId: string, input: InventoryMovementInput) {
    const product = catalogProductStore.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found.");
    if (product.type === "service") throw new Error("Inventory movements are not available for services.");
    const previous = inventoryMovementStore.find((movement) => movement.idempotencyKey === input.idempotencyKey);
    if (previous) {
      if (
        previous.productId === productId &&
        previous.type === input.type &&
        previous.quantityChange === (input.type === "issue" ? -input.quantity : input.quantity)
      ) return delay(previous);
      throw new Error("This idempotency key was already used for a different movement.");
    }
    const change = input.type === "issue" ? -input.quantity : input.quantity;
    if (input.type === "opening" && product.stockOnHand !== null) throw new Error("Opening stock has already been recorded.");
    if (input.type !== "opening" && product.stockOnHand === null) throw new Error("Record opening stock before other inventory movements.");
    const balance = input.type === "opening" ? input.quantity : (product.stockOnHand ?? 0) + change;
    if (balance < 0) throw new Error("The movement would make stock on hand negative.");
    if (input.type === "adjustment" && !input.reason?.trim()) throw new Error("Stock adjustments require a reason.");
    product.stockOnHand = balance;
    product.updatedAt = new Date().toISOString();
    movementCounter += 1;
    const movement: InventoryMovement = {
      id: `im_mock_${movementCounter}`,
      productId,
      type: input.type,
      quantityChange: change,
      resultingBalance: balance,
      occurredAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
      invoiceId: null,
      reference: input.reference ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    };
    inventoryMovementStore.unshift(movement);
    return delay(movement);
  },

  async getPayments() {
    return delay(paymentStore.map(clonePayment));
  },
  async recordPayment(payment, proof): Promise<RecordPaymentResult> {
    const existingIndex = paymentStore.findIndex((storedPayment) => storedPayment.id === payment.id);

    if (existingIndex >= 0) {
      const existingPayment = paymentStore[existingIndex];
      if (existingPayment.invoiceId !== payment.invoiceId) {
        return delay({
          payment: clonePayment(existingPayment),
          proofError: proofValidationError(
            existingPayment.id,
            "Payment proof replacement must use the payment's existing invoice.",
          ),
        });
      }

      // A payment id already in the store identifies a proof replacement, not
      // a second ledger record. Keep the append-only payment fields intact.
      if (!proof) return delay({ payment: clonePayment(existingPayment) });

      const result = createMockProof(existingPayment.id, proof);
      if (result.error || !result.proof) {
        return delay({ payment: clonePayment(existingPayment), proofError: result.error });
      }

      const enrichedPayment = { ...existingPayment, paymentProof: result.proof };
      paymentStore[existingIndex] = enrichedPayment;
      return delay({ payment: clonePayment(enrichedPayment) });
    }

    // Persist the payment row before proof enrichment, mirroring the backend
    // durable-payment-first contract. A failed proof therefore retains the
    // newly recorded payment without proof metadata.
    const persistedPayment: Payment = { ...payment };
    paymentStore.unshift(persistedPayment);

    if (!proof) return delay({ payment: clonePayment(persistedPayment) });

    const result = createMockProof(persistedPayment.id, proof);
    if (result.error || !result.proof) {
      return delay({ payment: clonePayment(persistedPayment), proofError: result.error });
    }

    const enrichedPayment = { ...persistedPayment, paymentProof: result.proof };
    paymentStore[0] = enrichedPayment;
    return delay({ payment: clonePayment(enrichedPayment) });
  },

  async getActivity() {
    return delay(activityStore);
  },
  async addActivityEvent(event) {
    activityCounter += 1;
    const fullEvent: ActivityEvent = { ...event, id: `ev_runtime_${activityCounter}` };
    activityStore.unshift(fullEvent);
    return delay(fullEvent);
  },

  async getNotifications(limit?: number, unreadOnly?: boolean, category?: string) {
    let notifications = [...notificationStore];
    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }
    if (category) {
      notifications = notifications.filter((n) => n.category === category);
    }
    if (limit) {
      notifications = notifications.slice(0, limit);
    }
    return delay(notifications);
  },
  async getUnreadCount(category?: string) {
    const count = notificationStore.filter((n) => !n.read && (!category || n.category === category)).length;
    return delay({ count, category });
  },
  async getNotificationCategories() {
    return delay({
      business: "Business Activity",
      payments: "Payments",
      clients: "Clients",
      products: "Products",
      settings: "Settings",
      updates: "Software Updates",
      system: "System",
    });
  },
  async getNotificationTypes() {
    return delay({
      invoice_created: ["business", "Invoice Created"],
      invoice_updated: ["business", "Invoice Updated"],
      invoice_cancelled: ["business", "Invoice Cancelled"],
      payment_received: ["payments", "Payment Received"],
      payment_updated: ["payments", "Payment Updated"],
      client_created: ["clients", "Client Created"],
      client_updated: ["clients", "Client Updated"],
      product_created: ["products", "Product Created"],
      product_updated: ["products", "Product Updated"],
      settings_changed: ["settings", "Settings Changed"],
      update_available: ["updates", "Update Available"],
      update_downloaded: ["updates", "Update Downloaded"],
      update_installed: ["updates", "Update Installed"],
      update_failed: ["updates", "Update Failed"],
      app_new_version: ["updates", "New Version Running"],
    });
  },
  async markNotificationRead(notificationId: string) {
    const notification = notificationStore.find((n) => n.id === notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }
    notification.read = true;
    notification.readAt = new Date().toISOString();
    return delay(notification);
  },
  async markAllNotificationsRead(category?: string) {
    let count = 0;
    for (const notification of notificationStore) {
      if (!notification.read && (!category || notification.category === category)) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        count++;
      }
    }
    return delay({ count });
  },

  async getReports() {
    return delay(mockReports);
  },

  async getCurrentUser() {
    return delay(mockCurrentUser);
  },
  async getBusinessProfile() {
    return delay(businessProfileStore);
  },
  async updateBusinessProfile(update) {
    businessProfileStore = { ...businessProfileStore, ...update };
    return delay(businessProfileStore);
  },
};
