import type { Product } from "@/types";

export const mockProducts: Product[] = [
  { id: "pr_consulting", name: "Consulting hours", defaultUnitPrice: 3500, unit: "hour" },
  { id: "pr_websitemaint", name: "Website maintenance", defaultUnitPrice: 18000, unit: "month" },
  { id: "pr_hosting", name: "Cloud hosting", defaultUnitPrice: 6200, unit: "month" },
  { id: "pr_license", name: "Software license renewal", defaultUnitPrice: 42000, unit: "license" },
  { id: "pr_design", name: "Design services", defaultUnitPrice: 4200, unit: "hour" },
  { id: "pr_support", name: "Priority support plan", defaultUnitPrice: 12500, unit: "month" },
  { id: "pr_audit", name: "Systems audit", defaultUnitPrice: 65000, unit: "engagement" },
  { id: "pr_training", name: "Staff training session", defaultUnitPrice: 22000, unit: "session" },
];
