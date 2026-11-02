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

const STORAGE_KEY = "sft-billing-offline";

interface OfflineStore {
  clients: Client[];
  invoices: Invoice[];
  invoiceNumberReservations: { number: string; reservedFor: string | null }[];
  catalogProducts: CatalogProduct[];
  reservedProductCodes: string[]; // Track all codes ever used (including deleted/archived)
  inventoryMovements: InventoryMovement[];
  payments: Payment[];
  activities: ActivityEvent[];
  notifications: Notification[];
  businessProfile: BusinessProfile;
}

function getDefaultStore(): OfflineStore {
  const defaultProducts = mockProducts.map((product) => ({
    id: product.id,
    code: product.id.toUpperCase(),
    name: product.name,
    type: "product" as const,
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
  const reservedCodes = defaultProducts.map((p) => p.code);
  return {
    clients: [...mockClients],
    invoices: [...mockInvoices],
    invoiceNumberReservations: mockInvoices.map((invoice) => ({
      number: invoice.number,
      reservedFor: invoice.id,
    })),
    catalogProducts: defaultProducts,
    reservedProductCodes: reservedCodes,
    inventoryMovements: [],
    payments: mockPayments.map((p) => ({ ...p, ...(p.paymentProof ? { paymentProof: { ...p.paymentProof } } : {}) })),
    activities: [...mockActivity],
    notifications: [],
    businessProfile: { ...mockBusinessProfile },
  };
}

function loadStore(): OfflineStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultStore();
    const parsed = JSON.parse(raw);
    return {
      clients: parsed.clients ?? [],
      invoices: parsed.invoices ?? [],
      invoiceNumberReservations: parsed.invoiceNumberReservations ?? (parsed.invoices ?? []).map(
        (invoice: Invoice) => ({ number: invoice.number, reservedFor: invoice.id }),
      ),
      catalogProducts: parsed.catalogProducts ?? getDefaultStore().catalogProducts,
      reservedProductCodes: parsed.reservedProductCodes ?? getDefaultStore().reservedProductCodes,
      inventoryMovements: parsed.inventoryMovements ?? [],
      payments: (parsed.payments ?? []).map((p: Payment) => ({ ...p, ...(p.paymentProof ? { paymentProof: { ...p.paymentProof } } : {}) })),
      activities: parsed.activities ?? [],
      notifications: parsed.notifications ?? [],
      businessProfile: parsed.businessProfile ?? mockBusinessProfile,
    };
  } catch {
    return getDefaultStore();
  }
}

function saveStore(store: OfflineStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function clonePayment(payment: Payment): Payment {
  return {
    ...payment,
    ...(payment.paymentProof ? { paymentProof: { ...payment.paymentProof } } : {}),
  };
}

function delay<T>(value: T, ms = 80): Promise<T> {
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

function createMockProof(paymentId: string, upload: PaymentProofUpload): { proof?: PaymentProof; error?: PaymentProofError } {
  if (!upload.fileName.trim() || !upload.mimeType.trim() || !Number.isFinite(upload.sizeBytes) || upload.sizeBytes < 0) {
    return { error: proofValidationError(paymentId, "Payment proof metadata is invalid.") };
  }
  if (!isSupportedPaymentProof(upload.fileName, upload.mimeType)) {
    return { error: proofValidationError(paymentId, PAYMENT_PROOF_INVALID_MESSAGE) };
  }
  const proofCounter = Date.now() + Math.random();
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

export const offlineDataProvider: DataProvider = {
  async getClients() {
    const store = loadStore();
    return delay(store.clients);
  },
  async getClient(id) {
    const store = loadStore();
    return delay(store.clients.find((c) => c.id === id));
  },
  async createClient(client) {
    const store = loadStore();
    store.clients.unshift(client);
    saveStore(store);
    return delay(client);
  },
  async updateClient(clientId, update) {
    const store = loadStore();
    const index = store.clients.findIndex((client) => client.id === clientId);
    if (index < 0) throw new Error("Client not found.");
    const updated = { ...store.clients[index], ...update, id: store.clients[index].id };
    store.clients[index] = updated;
    saveStore(store);
    return delay(updated);
  },
  async deleteClient(clientId) {
    const store = loadStore();
    const index = store.clients.findIndex((client) => client.id === clientId);
    if (index < 0) throw new Error("Client not found.");
    if (store.invoices.some((invoice) => invoice.clientId === clientId) ||
        store.payments.some((payment) => payment.clientId === clientId)) {
      throw new Error("This client has linked invoices or payments and cannot be deleted.");
    }
    store.clients.splice(index, 1);
    saveStore(store);
    await delay(undefined);
  },

  async getInvoices() {
    const store = loadStore();
    return delay(store.invoices);
  },
  async reserveInvoiceNumber(invoiceId) {
    const store = loadStore();
    const existing = store.invoiceNumberReservations.find(
      (reservation) => reservation.reservedFor === invoiceId,
    );
    if (existing) return delay(existing.number);
    const year = new Date().getFullYear();
    const financialYear = new Date().getMonth() >= 3 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
    const used = [
      ...store.invoiceNumberReservations.map((reservation) => reservation.number),
      ...store.invoices.map((invoice) => invoice.number),
    ].map((number) => number.match(/^(\d{3})\/(.+)$/))
      .filter((match) => match?.[2] === financialYear)
      .map((match) => Number(match?.[1]));
    const number = `${String(Math.max(0, ...used) + 1).padStart(3, "0")}/${financialYear}`;
    store.invoiceNumberReservations.push({ number, reservedFor: invoiceId });
    saveStore(store);
    return delay(number);
  },
  async releaseReservation(invoiceId) {
    const store = loadStore();
    const reservation = store.invoiceNumberReservations.find(
      (reservation) => reservation.reservedFor === invoiceId,
    );
    if (reservation) {
      reservation.reservedFor = null;
      saveStore(store);
      return delay({ released: true, invoiceId });
    }
    return delay({ released: false, invoiceId });
  },
  async getInvoice(id) {
    const store = loadStore();
    return delay(store.invoices.find((i) => i.id === id));
  },
  async saveInvoice(invoice) {
    const store = loadStore();
    const index = store.invoices.findIndex((i) => i.id === invoice.id);
    if (index >= 0) {
      store.invoices[index] = invoice;
    } else {
      store.invoices.unshift(invoice);
    }
    saveStore(store);
    return delay(invoice);
  },
  async deleteInvoice(invoiceId) {
    const store = loadStore();
    const index = store.invoices.findIndex((invoice) => invoice.id === invoiceId);
    if (index < 0) throw new Error("Invoice not found.");
    const invoice = store.invoices[index];
    if (!invoice.isDraft) {
      throw new Error("Billed invoices cannot be permanently deleted. No cancellation or correction workflow is available here.");
    }
    if (invoice.billedAt || invoice.sentAt || invoice.viewedAt || invoice.paidAt) {
      throw new Error("This draft invoice has billing, delivery, or payment history and cannot be deleted.");
    }
    if (store.payments.some((payment) => payment.invoiceId === invoiceId)) {
      throw new Error("This invoice has payment history and cannot be deleted.");
    }
    if (store.inventoryMovements.some((movement) => movement.invoiceId === invoiceId)) {
      throw new Error("This invoice has inventory history and cannot be deleted.");
    }
    store.invoices.splice(index, 1);
    for (const reservation of store.invoiceNumberReservations) {
      if (reservation.reservedFor === invoiceId) reservation.reservedFor = null;
    }
    for (const activity of store.activities) {
      if (activity.invoiceId === invoiceId) delete activity.invoiceId;
    }
    saveStore(store);
    await delay(undefined);
  },
  async getInvoiceExcel() {
    throw new Error("Excel invoice export requires the backend API provider.");
  },
  async getInvoicePdf() {
    throw new Error("PDF invoice export requires the backend API provider.");
  },

  async getProducts() {
    const store = loadStore();
    return delay(store.catalogProducts.filter((product) => product.isActive && !product.isArchived).map((product): Product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      defaultUnitPrice: product.defaultUnitPrice,
      unit: product.unit,
      hsnCode: product.hsnCode,
    })));
  },
  async getCatalogProducts() {
    return delay(loadStore().catalogProducts);
  },
  async createCatalogProduct(input: CatalogProductInput) {
    const store = loadStore();
    const normalizedCode = input.code.trim().toUpperCase();
    if (store.catalogProducts.some((product) => product.code === normalizedCode)) {
      const existing = store.catalogProducts.find((p) => p.code === normalizedCode);
      throw new Error(`Code ${normalizedCode} is already used by ${existing?.name}`);
    }
    if (store.reservedProductCodes.includes(normalizedCode)) {
      throw new Error(`Code ${normalizedCode} is reserved and cannot be reused.`);
    }
    const timestamp = new Date().toISOString();
    const product: CatalogProduct = {
      id: `pr_offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...input,
      code: normalizedCode,
      name: input.name.trim(),
      hsnCode: input.hsnCode.trim(),
      unit: input.unit.trim(),
      isActive: input.isActive ?? true,
      isArchived: false,
      stockOnHand: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.catalogProducts.unshift(product);
    store.reservedProductCodes.push(normalizedCode);
    saveStore(store);
    return delay(product);
  },
  async updateCatalogProduct(productId: string, update: Partial<CatalogProductInput> & { isArchived?: boolean }) {
    const store = loadStore();
    const index = store.catalogProducts.findIndex((product) => product.id === productId);
    if (index < 0) throw new Error("Product not found.");
    const code = update.code?.trim().toUpperCase();
    if (code && store.catalogProducts.some((product) => product.id !== productId && product.code === code)) {
      const existing = store.catalogProducts.find((p) => p.code === code);
      throw new Error(`Code ${code} is already used by ${existing?.name}`);
    }
    // Don't allow changing code if product is used in invoices
    const product = store.catalogProducts[index];
    const isUsedInInvoices = store.invoices.some(
      (invoice) => invoice.items.some((item) => item.productId === productId)
    );
    if (isUsedInInvoices && code && code !== product.code) {
      throw new Error("Cannot change code of a product used in invoices.");
    }
    const { isArchived, ...rest } = update;
    store.catalogProducts[index] = {
      ...store.catalogProducts[index],
      ...rest,
      ...(code ? { code } : {}),
      ...(update.name ? { name: update.name.trim() } : {}),
      ...(update.hsnCode ? { hsnCode: update.hsnCode.trim() } : {}),
      ...(update.unit ? { unit: update.unit.trim() } : {}),
      ...(isArchived !== undefined ? { isArchived } : {}),
      id: productId,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
    return delay(store.catalogProducts[index]);
  },
  async setCatalogProductArchived(productId: string, isArchived: boolean) {
    const store = loadStore();
    const index = store.catalogProducts.findIndex((product) => product.id === productId);
    if (index < 0) throw new Error("Product not found.");
    store.catalogProducts[index] = {
      ...store.catalogProducts[index],
      isArchived,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
    return delay(store.catalogProducts[index]);
  },
  async setCatalogProductActive(productId: string, isActive: boolean) {
    return this.updateCatalogProduct(productId, { isActive });
  },
  async deleteCatalogProduct(productId: string) {
    const store = loadStore();
    const index = store.catalogProducts.findIndex((product) => product.id === productId);
    if (index < 0) throw new Error("Product not found.");
    const product = store.catalogProducts[index];
    if (
      store.invoices.some((invoice) => invoice.items.some((item) => item.productId === productId)) ||
      store.inventoryMovements.some((movement) => movement.productId === productId)
    ) {
      throw new Error(
        `Cannot delete a product referenced by historical invoice items or inventory movements. Used in ${store.invoices.filter((invoice) => invoice.items.some((item) => item.productId === productId)).length} invoices. Archive instead.`,
      );
    }
    // Add code to reserved codes before deleting
    if (!store.reservedProductCodes.includes(product.code)) {
      store.reservedProductCodes.push(product.code);
    }
    store.catalogProducts.splice(index, 1);
    saveStore(store);
    await delay(undefined);
  },
  async getProductStock(productId: string) {
    const product = loadStore().catalogProducts.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found.");
    return delay({ productId, stockOnHand: product.stockOnHand, unit: product.unit } satisfies ProductStock);
  },
  async getInventoryMovements(productId: string) {
    const store = loadStore();
    if (!store.catalogProducts.some((product) => product.id === productId)) {
      throw new Error("Product not found.");
    }
    return delay(store.inventoryMovements.filter((movement) => movement.productId === productId));
  },
  async recordInventoryMovement(productId: string, input: InventoryMovementInput) {
    const store = loadStore();
    const product = store.catalogProducts.find((item) => item.id === productId);
    if (!product) throw new Error("Product not found.");
    if (product.type === "service") throw new Error("Inventory movements are not available for services.");
    const change = input.type === "issue" ? -input.quantity : input.quantity;
    const existing = store.inventoryMovements.find((movement) => movement.idempotencyKey === input.idempotencyKey);
    if (existing) {
      if (existing.productId === productId && existing.type === input.type && existing.quantityChange === change) {
        return delay(existing);
      }
      throw new Error("This idempotency key was already used for a different movement.");
    }
    if (input.type === "opening" && product.stockOnHand !== null) {
      throw new Error("Opening stock has already been recorded.");
    }
    if (input.type !== "opening" && product.stockOnHand === null) {
      throw new Error("Record opening stock before other inventory movements.");
    }
    const balance = input.type === "opening" ? input.quantity : (product.stockOnHand ?? 0) + change;
    if (balance < 0) throw new Error("The movement would make stock on hand negative.");
    if (input.type === "adjustment" && !input.reason?.trim()) {
      throw new Error("Stock adjustments require a reason.");
    }
    const timestamp = new Date().toISOString();
    product.stockOnHand = balance;
    product.updatedAt = timestamp;
    const movement: InventoryMovement = {
      id: `im_offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      type: input.type,
      quantityChange: change,
      resultingBalance: balance,
      occurredAt: timestamp,
      idempotencyKey: input.idempotencyKey,
      invoiceId: null,
      reference: input.reference ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    };
    store.inventoryMovements.unshift(movement);
    saveStore(store);
    return delay(movement);
  },

  async getPayments() {
    const store = loadStore();
    return delay(store.payments.map(clonePayment));
  },
  async recordPayment(payment, proof): Promise<RecordPaymentResult> {
    const store = loadStore();
    const existingIndex = store.payments.findIndex((storedPayment) => storedPayment.id === payment.id);

    if (existingIndex >= 0) {
      const existingPayment = store.payments[existingIndex];
      if (existingPayment.invoiceId !== payment.invoiceId) {
        return delay({
          payment: clonePayment(existingPayment),
          proofError: proofValidationError(existingPayment.id, "Payment proof replacement must use the payment's existing invoice."),
        });
      }
      if (!proof) return delay({ payment: clonePayment(existingPayment) });

      const result = createMockProof(existingPayment.id, proof);
      if (result.error || !result.proof) {
        return delay({ payment: clonePayment(existingPayment), proofError: result.error });
      }
      const enrichedPayment = { ...existingPayment, paymentProof: result.proof };
      store.payments[existingIndex] = enrichedPayment;
      saveStore(store);
      return delay({ payment: clonePayment(enrichedPayment) });
    }

    const persistedPayment: Payment = { ...payment };
    store.payments.unshift(persistedPayment);

    if (!proof) {
      saveStore(store);
      return delay({ payment: clonePayment(persistedPayment) });
    }

    const result = createMockProof(persistedPayment.id, proof);
    if (result.error || !result.proof) {
      saveStore(store);
      return delay({ payment: clonePayment(persistedPayment), proofError: result.error });
    }

    const enrichedPayment = { ...persistedPayment, paymentProof: result.proof };
    store.payments[0] = enrichedPayment;
    saveStore(store);
    return delay({ payment: clonePayment(enrichedPayment) });
  },

  async getActivity() {
    const store = loadStore();
    return delay(store.activities);
  },
  async addActivityEvent(event) {
    const store = loadStore();
    const fullEvent: ActivityEvent = { ...event, id: `ev_offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` };
    store.activities.unshift(fullEvent);
    saveStore(store);
    return delay(fullEvent);
  },

  async getNotifications(limit?: number, unreadOnly?: boolean, category?: string) {
    const store = loadStore();
    let notifications = [...(store.notifications || [])];
    if (unreadOnly) {
      notifications = notifications.filter((n: Notification) => !n.read);
    }
    if (category) {
      notifications = notifications.filter((n: Notification) => n.category === category);
    }
    if (limit) {
      notifications = notifications.slice(0, limit);
    }
    return delay(notifications);
  },
  async getUnreadCount(category?: string) {
    const store = loadStore();
    const count = (store.notifications || []).filter((n: Notification) => !n.read && (!category || n.category === category)).length;
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
    const store = loadStore();
    const notification = (store.notifications || []).find((n: Notification) => n.id === notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }
    notification.read = true;
    notification.readAt = new Date().toISOString();
    saveStore(store);
    return delay(notification);
  },
  async markAllNotificationsRead(category?: string) {
    const store = loadStore();
    let count = 0;
    for (const notification of store.notifications || []) {
      if (!notification.read && (!category || notification.category === category)) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        count++;
      }
    }
    saveStore(store);
    return delay({ count });
  },

  async getReports() {
    return delay(mockReports);
  },

  async getCurrentUser() {
    return delay(mockCurrentUser);
  },
  async getBusinessProfile() {
    const store = loadStore();
    return delay(store.businessProfile);
  },
  async updateBusinessProfile(update) {
    const store = loadStore();
    store.businessProfile = { ...store.businessProfile, ...update };
    saveStore(store);
    return delay(store.businessProfile);
  },
};