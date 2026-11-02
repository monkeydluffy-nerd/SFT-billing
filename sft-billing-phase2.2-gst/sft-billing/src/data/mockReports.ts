import type { ReportDefinition } from "@/types";

export const mockReports: ReportDefinition[] = [
  {
    id: "rp_aging",
    kind: "aging_summary",
    name: "Aging summary",
    description: "Outstanding invoices grouped by how overdue they are.",
  },
  {
    id: "rp_revenue_client",
    kind: "revenue_by_client",
    name: "Revenue by client",
    description: "Total billed and collected, broken down per client.",
  },
  {
    id: "rp_tax",
    kind: "tax_summary",
    name: "Tax summary",
    description: "Tax collected across all invoices for a given period.",
  },
  {
    id: "rp_statement",
    kind: "statement",
    name: "Client statement",
    description: "A single client's full invoice and payment history.",
  },
  {
    id: "rp_custom",
    kind: "custom",
    name: "Custom report",
    description: "Build a report with your own filters, grouping, and date range.",
  },
];
