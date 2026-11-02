export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultUnitPrice: number;
  unit: string; // e.g. "hour", "seat", "license", "unit"
  /** HSN/SAC code pre-filled onto a line item when this product/service is picked — still editable per line. */
  hsnCode?: string;
}

export type ProductKind = "product" | "service";

export interface CatalogProduct {
  id: string;
  code: string;
  name: string;
  type: ProductKind;
  hsnCode: string;
  unit: string;
  defaultUnitPrice: number;
  defaultGstRate: number;
  weight: number | null;
  weightUnit: string | null;
  purchaseCost: number | null;
  lowStockThreshold: number | null;
  stockOnHand: number | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InventoryMovementType = "opening" | "receipt" | "issue" | "adjustment";

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantityChange: number;
  resultingBalance: number;
  occurredAt: string;
  idempotencyKey: string;
  invoiceId: string | null;
  reference: string | null;
  reason: string | null;
  notes: string | null;
}

export interface ProductStock {
  productId: string;
  stockOnHand: number | null;
  unit: string;
}

export interface CatalogProductInput {
  code: string;
  name: string;
  type: ProductKind;
  hsnCode: string;
  unit: string;
  defaultUnitPrice: number;
  defaultGstRate: number;
  weight: number | null;
  weightUnit: string | null;
  purchaseCost: number | null;
  lowStockThreshold: number | null;
  isActive?: boolean;
}

export interface InventoryMovementInput {
  type: InventoryMovementType;
  quantity: number;
  idempotencyKey: string;
  reason?: string;
  reference?: string;
  notes?: string;
}
