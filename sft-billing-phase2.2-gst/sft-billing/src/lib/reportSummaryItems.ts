import { formatCurrency } from "@/lib/formatters";

export interface SummaryItem {
  label: string;
  value: string;
  caution?: boolean;
}

export function currencyItem(label: string, value: number, caution = false): SummaryItem {
  return { label, value: formatCurrency(value), caution };
}

export function countItem(label: string, value: number): SummaryItem {
  return { label, value: String(value) };
}