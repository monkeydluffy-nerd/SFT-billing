import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiDataProvider } from "./apiDataProvider";
import { mockDataProvider } from "./mockDataProvider";
import { offlineDataProvider } from "./offlineDataProvider";
import type { Invoice } from "@/types";

const offlineStorageKey = "sft-billing-offline";
let storage = new Map<string, string>();

function makeInvoice(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    number: "001/2026-27",
    clientId: "client-test",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    items: [{ id: `item-${id}`, description: "Test service", quantity: 1, unitPrice: 100 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: true,
    ...overrides,
  };
}

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("invoice deletion provider contract", () => {
  it("sends DELETE to the invoice resource and propagates backend protection errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deleted: true, id: "invoice/1" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({ detail: "Billed invoices cannot be permanently deleted." }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiDataProvider.deleteInvoice("invoice/1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/api/invoices/invoice%2F1",
      expect.objectContaining({ method: "DELETE" }),
    );
    await expect(apiDataProvider.deleteInvoice("billed")).rejects.toThrow(
      /Billed invoices cannot be permanently deleted/,
    );
  });

  it("deletes an eligible offline draft and retains its number and activity history", async () => {
    const invoice = makeInvoice("offline-draft");
    storage.set(offlineStorageKey, JSON.stringify({
      invoices: [invoice],
      invoiceNumberReservations: [{ number: invoice.number, reservedFor: invoice.id }],
      payments: [],
      activities: [{
        id: "invoice-created-event",
        type: "invoice_created",
        occurredAt: "2026-10-01T10:00:00Z",
        summary: `Invoice ${invoice.number} created`,
        invoiceId: invoice.id,
      }],
      inventoryMovements: [],
      catalogProducts: [],
    }));

    await expect(offlineDataProvider.deleteInvoice(invoice.id)).resolves.toBeUndefined();

    expect(await offlineDataProvider.getInvoices()).toEqual([]);
    const retained = JSON.parse(storage.get(offlineStorageKey) ?? "{}");
    expect(retained.invoiceNumberReservations).toEqual([{ number: invoice.number, reservedFor: null }]);
    expect(retained.activities).toHaveLength(1);
    expect(retained.activities[0].invoiceId).toBeUndefined();
    const nextNumber = await offlineDataProvider.reserveInvoiceNumber(invoice.id);
    expect(nextNumber).not.toBe(invoice.number);
  });

  it("blocks billed and payment-linked offline invoices", async () => {
    const billed = makeInvoice("offline-billed", { isDraft: false, billedAt: "2026-10-01T10:00:00Z" });
    storage.set(offlineStorageKey, JSON.stringify({
      invoices: [billed],
      payments: [],
      activities: [],
      inventoryMovements: [],
      catalogProducts: [],
    }));
    await expect(offlineDataProvider.deleteInvoice(billed.id)).rejects.toThrow(
      /Billed invoices cannot be permanently deleted/,
    );

    const paymentLinked = makeInvoice("offline-paid-draft");
    storage.set(offlineStorageKey, JSON.stringify({
      invoices: [paymentLinked],
      payments: [{ id: "payment-1", invoiceId: paymentLinked.id }],
      activities: [],
      inventoryMovements: [],
      catalogProducts: [],
    }));
    await expect(offlineDataProvider.deleteInvoice(paymentLinked.id)).rejects.toThrow(
      /payment history/,
    );
    expect((await offlineDataProvider.getInvoices()).map((row) => row.id)).toEqual([paymentLinked.id]);
  });

  it("applies the same draft-only rule in the mock provider and never reuses a deleted number", async () => {
    const invoiceId = "mock-delete-draft-test";
    const number = await mockDataProvider.reserveInvoiceNumber(invoiceId);
    await mockDataProvider.saveInvoice(makeInvoice(invoiceId, { number }));
    await expect(mockDataProvider.deleteInvoice(invoiceId)).resolves.toBeUndefined();
    expect((await mockDataProvider.getInvoices()).some((invoice) => invoice.id === invoiceId)).toBe(false);
    expect(await mockDataProvider.reserveInvoiceNumber(invoiceId)).not.toBe(number);

    const billedId = "mock-delete-billed-test";
    const billedNumber = await mockDataProvider.reserveInvoiceNumber(billedId);
    await mockDataProvider.saveInvoice(makeInvoice(billedId, { number: billedNumber, isDraft: false }));
    await expect(mockDataProvider.deleteInvoice(billedId)).rejects.toThrow(
      /Billed invoices cannot be permanently deleted/,
    );
  });
});
