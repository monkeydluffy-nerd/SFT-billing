export interface Product {
  id: string;
  name: string;
  description?: string;
  defaultUnitPrice: number;
  unit: string; // e.g. "hour", "seat", "license", "unit"
  /** HSN/SAC code pre-filled onto a line item when this product/service is picked — still editable per line. */
  hsnCode?: string;
}
