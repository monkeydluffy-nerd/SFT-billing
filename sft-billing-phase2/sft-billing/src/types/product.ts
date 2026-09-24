export interface Product {
  id: string;
  name: string;
  description?: string;
  defaultUnitPrice: number;
  unit: string; // e.g. "hour", "seat", "license", "unit"
}
