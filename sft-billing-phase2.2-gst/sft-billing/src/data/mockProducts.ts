import type { Product } from "@/types";

// SAC (Services Accounting Code) values — these are IT/professional
// services, billed under GST's services classification rather than a
// goods HSN code, which is normal and expected for a services business.
export const mockProducts: Product[] = [
  { id: "pr_consulting", name: "Consulting hours", defaultUnitPrice: 3500, unit: "hour", hsnCode: "998314" },
  { id: "pr_websitemaint", name: "Website maintenance", defaultUnitPrice: 18000, unit: "month", hsnCode: "998314" },
  { id: "pr_hosting", name: "Cloud hosting", defaultUnitPrice: 6200, unit: "month", hsnCode: "998315" },
  { id: "pr_license", name: "Software license renewal", defaultUnitPrice: 42000, unit: "license", hsnCode: "997331" },
  { id: "pr_design", name: "Design services", defaultUnitPrice: 4200, unit: "hour", hsnCode: "998314" },
  { id: "pr_support", name: "Priority support plan", defaultUnitPrice: 12500, unit: "month", hsnCode: "998315" },
  { id: "pr_audit", name: "Systems audit", defaultUnitPrice: 65000, unit: "engagement", hsnCode: "998314" },
  { id: "pr_training", name: "Staff training session", defaultUnitPrice: 22000, unit: "session", hsnCode: "999293" },
];
