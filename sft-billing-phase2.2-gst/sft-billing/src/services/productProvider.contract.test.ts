import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiDataProvider } from "./apiDataProvider";
import { offlineDataProvider } from "./offlineDataProvider";
import type { CatalogProduct } from "@/types";

const offlineStorageKey = "sft-billing-offline";
let offlineStore: Map<string, string>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 409 ? "Conflict" : "OK",
    json: async () => body,
  } as Response;
}

function offlineProduct(): CatalogProduct {
  return {
    id: "pr_offline_test",
    code: "OFFLINE-1",
    name: "Offline product",
    type: "product",
    hsnCode: "1234",
    unit: "pcs",
    defaultUnitPrice: 10,
    defaultGstRate: 0.18,
    weight: null,
    weightUnit: null,
    purchaseCost: null,
    lowStockThreshold: null,
    stockOnHand: null,
    isActive: true,
    isArchived: false,
    createdAt: "2026-10-23T08:00:00.000Z",
    updatedAt: "2026-10-23T08:00:00.000Z",
  };
}

beforeEach(() => {
  offlineStore = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => offlineStore.get(key) ?? null,
    setItem: (key: string, value: string) => offlineStore.set(key, value),
    removeItem: (key: string) => offlineStore.delete(key),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("API Products provider contract", () => {
  it("loads the catalog and requests only active entries for invoice suggestions", async () => {
    const product: CatalogProduct = {
      id: "pr_api",
      code: "API-1",
      name: "API product",
      type: "product",
      hsnCode: "1234",
      unit: "pcs",
      defaultUnitPrice: 12.5,
      defaultGstRate: 0.18,
      weight: null,
      weightUnit: null,
      purchaseCost: null,
      lowStockThreshold: null,
      stockOnHand: null,
      isActive: true,
      isArchived: false,
      createdAt: "2026-10-23T08:00:00.000Z",
      updatedAt: "2026-10-23T08:00:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([product]))
      .mockResolvedValueOnce(jsonResponse([product]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiDataProvider.getCatalogProducts()).resolves.toEqual([product]);
    await expect(apiDataProvider.getProducts()).resolves.toEqual([
      {
        id: product.id,
        code: product.code,
        name: product.name,
        defaultUnitPrice: product.defaultUnitPrice,
        unit: product.unit,
        hsnCode: product.hsnCode,
      },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:8000/api/products",
      "http://127.0.0.1:8000/api/products?active=true",
    ]);
  });

  it("sends the exact inventory operation and reuses its supplied idempotency key", async () => {
    const movement = {
      id: "im_api",
      productId: "pr_api",
      type: "adjustment",
      quantityChange: -0.5,
      resultingBalance: 1.5,
      occurredAt: "2026-10-23T08:00:00.000Z",
      idempotencyKey: "stable-retry-key",
      invoiceId: null,
      reference: null,
      reason: "Count correction",
      notes: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(movement));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiDataProvider.recordInventoryMovement("pr_api", {
        type: "adjustment",
        quantity: -0.5,
        reason: "Count correction",
        idempotencyKey: "stable-retry-key",
      }),
    ).resolves.toEqual(movement);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/products/pr_api/movements",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "adjustment",
          quantity: -0.5,
          reason: "Count correction",
          idempotencyKey: "stable-retry-key",
        }),
      }),
    );
  });

  it("deletes a product with DELETE at its product resource URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiDataProvider.deleteCatalogProduct("pr delete/1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/products/pr%20delete%2F1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("preserves useful backend error details when deletion is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { detail: "Cannot delete product referenced by historical invoice items. Deactivate instead." },
          409,
        ),
      ),
    );

    await expect(apiDataProvider.deleteCatalogProduct("pr_protected")).rejects.toThrow(
      /historical invoice items/,
    );
  });

  it("deletes an unreferenced product from offline storage", async () => {
    const product = offlineProduct();
    localStorage.setItem(
      offlineStorageKey,
      JSON.stringify({ catalogProducts: [product], invoices: [], inventoryMovements: [] }),
    );

    await expect(offlineDataProvider.deleteCatalogProduct(product.id)).resolves.toBeUndefined();
    await expect(offlineDataProvider.getCatalogProducts()).resolves.toEqual([]);
  });

  it("protects offline products referenced by invoices or inventory movements", async () => {
    const product = offlineProduct();
    localStorage.setItem(
      offlineStorageKey,
      JSON.stringify({
        catalogProducts: [product],
        invoices: [{ items: [{ productId: product.id }] }],
        inventoryMovements: [],
      }),
    );
    await expect(offlineDataProvider.deleteCatalogProduct(product.id)).rejects.toThrow(
      /historical invoice items/,
    );

    localStorage.setItem(
      offlineStorageKey,
      JSON.stringify({
        catalogProducts: [product],
        invoices: [],
        inventoryMovements: [{ productId: product.id }],
      }),
    );
    await expect(offlineDataProvider.deleteCatalogProduct(product.id)).rejects.toThrow(
      /inventory movements/,
    );
    await expect(offlineDataProvider.getCatalogProducts()).resolves.toEqual([product]);
  });
});
