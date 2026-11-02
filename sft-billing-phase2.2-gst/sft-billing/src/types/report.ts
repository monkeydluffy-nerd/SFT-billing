export type ReportKind =
  | "aging_summary"
  | "revenue_by_client"
  | "tax_summary"
  | "statement"
  | "custom";

export interface ReportDefinition {
  id: string;
  kind: ReportKind;
  name: string;
  description: string;
}
