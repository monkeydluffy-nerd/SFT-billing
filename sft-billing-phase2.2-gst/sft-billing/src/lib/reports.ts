import type { Client, Invoice, InvoiceStatus, Payment } from "@/types";
import { computeInvoiceTotals, getInvoiceStatus } from "./invoiceMath";
import { getClientName } from "./clientLookup";

export type ReportId = "revenue" | "invoices" | "payments" | "outstanding" | "overdue" | "client-summary";

export interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: "revenue", title: "Revenue", description: "Received revenue over the selected period." },
  { id: "invoices", title: "Invoices", description: "Every invoice issued in the selected period, with status." },
  { id: "payments", title: "Payments", description: "Payments received, by invoice and client." },
  { id: "outstanding", title: "Outstanding", description: "Invoices with a balance still due, ranked by amount." },
  { id: "overdue", title: "Overdue", description: "Invoices past their due date, sorted by days overdue." },
  { id: "client-summary", title: "Client summary", description: "Billing, collection, and outstanding totals per client." },
];

export type DatePreset = "this-month" | "last-month" | "last-3-months" | "last-12-months" | "custom";

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  "last-12-months": "Last 12 months",
  custom: "Custom",
};

export interface ReportFilterState {
  preset: DatePreset;
  from: string | null;
  to: string | null;
  clientId: string | null;
  status: InvoiceStatus | null;
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Resolves a preset into concrete from/to ISO dates, anchored to `asOf`. Custom returns whatever the caller already has. */
export function resolvePresetRange(preset: DatePreset, asOf: Date = new Date()): { from: string | null; to: string | null } {
  const year = asOf.getFullYear();
  const month = asOf.getMonth();
  switch (preset) {
    case "this-month":
      return { from: isoDateOnly(new Date(year, month, 1)), to: isoDateOnly(asOf) };
    case "last-month":
      return { from: isoDateOnly(new Date(year, month - 1, 1)), to: isoDateOnly(new Date(year, month, 0)) };
    case "last-3-months":
      return { from: isoDateOnly(new Date(year, month - 2, 1)), to: isoDateOnly(asOf) };
    case "last-12-months":
      return { from: isoDateOnly(new Date(year, month - 11, 1)), to: isoDateOnly(asOf) };
    case "custom":
      return { from: null, to: null };
  }
}

/** Default filter state on first load: "This month" is the sensible default the redesign calls for, never a confusing blank range. */
export function defaultFilters(asOf: Date = new Date()): ReportFilterState {
  const range = resolvePresetRange("this-month", asOf);
  return { preset: "this-month", from: range.from, to: range.to, clientId: null, status: null };
}

function isWithinRange(iso: string, from: string | null, to: string | null): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

export function isDateWithinRange(iso: string, from: string | null, to: string | null): boolean {
  return isWithinRange(iso, from, to);
}

export function filterInvoices(invoices: Invoice[], filters: ReportFilterState, asOf: Date = new Date()): Invoice[] {
  return invoices.filter((invoice) => {
    if (!isWithinRange(invoice.issueDate, filters.from, filters.to)) return false;
    if (filters.clientId && invoice.clientId !== filters.clientId) return false;
    if (filters.status && getInvoiceStatus(invoice, asOf).status !== filters.status) return false;
    return true;
  });
}

export function filterPayments(payments: Payment[], filters: ReportFilterState): Payment[] {
  return payments.filter((payment) => {
    if (!isWithinRange(payment.receivedAt, filters.from, filters.to)) return false;
    if (filters.clientId && payment.clientId !== filters.clientId) return false;
    return true;
  });
}

/**
 * Every report type shows only the metrics relevant to it - the
 * redesign's explicit instruction not to repeat the same six numbers
 * everywhere. Each function below returns exactly the summary shape for
 * one report; ReportsPage picks the matching one for the active tab.
 */
export interface RevenueSummary {
  billed: number;
  collected: number;
  outstanding: number;
}
export function computeRevenueSummary(invoices: Invoice[], payments: Payment[], asOf: Date = new Date()): RevenueSummary {
  let billed = 0;
  let outstanding = 0;
  for (const invoice of invoices) {
    if (invoice.isDraft) continue;
    const { total } = computeInvoiceTotals(invoice);
    billed += total;
    const status = getInvoiceStatus(invoice, asOf).status;
    if (status === "pending" || status === "overdue") outstanding += total;
  }
  return { billed, collected: payments.reduce((sum, p) => sum + p.amount, 0), outstanding };
}

export interface InvoiceSummary {
  count: number;
  totalAmount: number;
  overdueCount: number;
}
export function computeInvoiceSummary(invoices: Invoice[], asOf: Date = new Date()): InvoiceSummary {
  let totalAmount = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    totalAmount += computeInvoiceTotals(invoice).total;
    if (getInvoiceStatus(invoice, asOf).status === "overdue") overdueCount += 1;
  }
  return { count: invoices.length, totalAmount, overdueCount };
}

export interface PaymentSummary {
  count: number;
  totalCollected: number;
  averagePayment: number;
}
export function computePaymentSummary(payments: Payment[]): PaymentSummary {
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  return { count: payments.length, totalCollected, averagePayment: payments.length > 0 ? totalCollected / payments.length : 0 };
}

export interface OutstandingSummary {
  totalOutstanding: number;
  invoiceCount: number;
  clientsAffected: number;
}
export function computeOutstandingSummary(invoices: Invoice[], payments: Payment[], asOf: Date = new Date()): OutstandingSummary {
  let totalOutstanding = 0;
  let invoiceCount = 0;
  const clientIds = new Set<string>();
  for (const invoice of invoices) {
    const status = getInvoiceStatus(invoice, asOf).status;
    if (status !== "pending" && status !== "overdue") continue;
    const { total } = computeInvoiceTotals(invoice);
    const paid = payments.filter((p) => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
    totalOutstanding += Math.max(0, total - paid);
    invoiceCount += 1;
    clientIds.add(invoice.clientId);
  }
  return { totalOutstanding, invoiceCount, clientsAffected: clientIds.size };
}

export interface OverdueSummary {
  totalOverdue: number;
  invoiceCount: number;
  oldestDaysOverdue: number;
}
export function computeOverdueSummary(invoices: Invoice[], asOf: Date = new Date()): OverdueSummary {
  let totalOverdue = 0;
  let invoiceCount = 0;
  let oldestDaysOverdue = 0;
  for (const invoice of invoices) {
    const info = getInvoiceStatus(invoice, asOf);
    if (info.status !== "overdue") continue;
    totalOverdue += computeInvoiceTotals(invoice).total;
    invoiceCount += 1;
    oldestDaysOverdue = Math.max(oldestDaysOverdue, info.daysOverdue);
  }
  return { totalOverdue, invoiceCount, oldestDaysOverdue };
}

export interface ClientSummaryTotals {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  clientCount: number;
}
export function computeClientSummaryTotals(rows: ClientSummaryRow[]): ClientSummaryTotals {
  return {
    totalBilled: rows.reduce((sum, r) => sum + r.totalBilled, 0),
    totalCollected: rows.reduce((sum, r) => sum + r.totalCollected, 0),
    totalOutstanding: rows.reduce((sum, r) => sum + r.outstanding, 0),
    clientCount: rows.length,
  };
}

export interface InvoiceReportRow {
  id: string;
  number: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
}

export function buildInvoiceReportRows(invoices: Invoice[], clients: Client[], asOf: Date = new Date()): InvoiceReportRow[] {
  return invoices
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      clientName: getClientName(clients, invoice.clientId),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      amount: computeInvoiceTotals(invoice).total,
      status: getInvoiceStatus(invoice, asOf).status,
    }))
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
}

export interface PaymentReportRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  receivedAt: string;
  amount: number;
  method: Payment["method"];
}

export function buildPaymentReportRows(payments: Payment[], invoices: Invoice[], clients: Client[]): PaymentReportRow[] {
  return payments
    .map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      invoiceNumber: invoices.find((i) => i.id === payment.invoiceId)?.number ?? "Unknown invoice",
      clientName: getClientName(clients, payment.clientId),
      receivedAt: payment.receivedAt,
      amount: payment.amount,
      method: payment.method,
    }))
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

export interface OutstandingReportRow {
  id: string;
  clientName: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: string;
  status: InvoiceStatus;
}

export function buildOutstandingReportRows(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  asOf: Date = new Date(),
): OutstandingReportRow[] {
  const rows: OutstandingReportRow[] = [];
  for (const invoice of invoices) {
    const status = getInvoiceStatus(invoice, asOf).status;
    if (status !== "pending" && status !== "overdue") continue;
    const { total } = computeInvoiceTotals(invoice);
    const paid = payments.filter((p) => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
    rows.push({
      id: invoice.id,
      clientName: getClientName(clients, invoice.clientId),
      invoiceNumber: invoice.number,
      total,
      paid,
      outstanding: Math.max(0, total - paid),
      dueDate: invoice.dueDate,
      status,
    });
  }
  return rows.sort((a, b) => b.outstanding - a.outstanding);
}

export interface ClientSummaryRow {
  clientId: string;
  clientName: string;
  invoiceCount: number;
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
}

export function buildClientSummaryRows(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  asOf: Date = new Date(),
): ClientSummaryRow[] {
  return clients
    .map((client) => {
      const clientInvoices = invoices.filter((i) => i.clientId === client.id && !i.isDraft);
      const totalBilled = clientInvoices.reduce((sum, i) => sum + computeInvoiceTotals(i).total, 0);
      const totalCollected = payments.filter((p) => p.clientId === client.id).reduce((sum, p) => sum + p.amount, 0);
      const outstanding = clientInvoices.reduce((sum, i) => {
        const status = getInvoiceStatus(i, asOf).status;
        return status === "pending" || status === "overdue" ? sum + computeInvoiceTotals(i).total : sum;
      }, 0);
      return {
        clientId: client.id,
        clientName: client.name,
        invoiceCount: clientInvoices.length,
        totalBilled,
        totalCollected,
        outstanding,
      };
    })
    .filter((row) => row.invoiceCount > 0)
    .sort((a, b) => b.totalBilled - a.totalBilled);
}