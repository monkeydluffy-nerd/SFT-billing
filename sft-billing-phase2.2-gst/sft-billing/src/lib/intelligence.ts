import type { Client, Invoice, Payment } from "@/types";
import { computeInvoiceTotals, getInvoiceStatus } from "./invoiceMath";
import { computeStatusTotals } from "./overviewMetrics";
import { getClientName } from "./clientLookup";
import { formatCurrency } from "./formatters";
import { getComparablePeriodWindow, sumInRange, countInRange, countDistinctInRange, computeComparableChange } from "./periodComparison";

/**
 * Everything in this module is derived strictly from the invoices,
 * clients, and payments already loaded elsewhere in the app via the
 * existing calculation layer (computeInvoiceTotals, getInvoiceStatus,
 * computeStatusTotals) and the shared period-comparison primitives in
 * periodComparison.ts - nothing here is a second, competing calculation
 * system, and nothing here invents a fact. If there isn't enough data to
 * say something meaningful, the corresponding function returns
 * undefined/an empty array/a "not comparable" flag rather than a
 * fabricated insight - see ReportsPage's Business Pulse and Attention Center
 * for how each of those is communicated to the user.
 */

/** Sums an invoice's grand total for invoices with paidAt within [start, end). */
function collectedInRange(invoices: Invoice[], start: Date, end: Date): number {
  return sumInRange(invoices, (i) => i.paidAt, (i) => computeInvoiceTotals(i).total, start, end);
}

/** Sums an invoice's grand total for invoices with issueDate within [start, end), excluding drafts. */
function billedInRange(invoices: Invoice[], start: Date, end: Date): number {
  return sumInRange(
    invoices.filter((i) => !i.isDraft),
    (i) => i.issueDate,
    (i) => computeInvoiceTotals(i).total,
    start,
    end,
  );
}

export interface PulseMetric {
  amount: number;
  timeframeLabel: string;
  /** Only present when there's a genuine, comparable baseline - see computeComparableChange. */
  changePct: number | undefined;
  comparable: boolean;
}

export interface BusinessPulse {
  /** Revenue/billed activity - non-draft invoices issued in the current comparable window. */
  billed: PulseMetric;
  /** Collections - payments received (by invoice paidAt) in the current comparable window. */
  collected: PulseMetric;
  /** Outstanding receivables - a point-in-time balance, not a period metric, so it has no change%. */
  totalOutstanding: number;
  outstandingInvoiceCount: number;
  /** Overdue exposure - a point-in-time balance. */
  totalOverdue: number;
  overdueInvoiceCount: number;
  /** Invoice activity - count of invoices issued in the current comparable window. */
  invoicesIssuedThisPeriod: number;
  invoicesIssuedComparablePeriod: number;
  /** Client activity - distinct clients who received a new invoice in the current comparable window. */
  activeClientsThisPeriod: number;
  activeClientsComparablePeriod: number;
  periodLabel: string;
  comparableLabel: string;
  isPartialPeriod: boolean;
  hasEnoughData: boolean;
  /** True once there's at least one invoice dated before the current period began - the precondition for ANY comparison to be shown at all. */
  hasComparableHistory: boolean;
}

export function computeBusinessPulse(invoices: Invoice[], _payments: Payment[], asOf: Date = new Date()): BusinessPulse {
  const window = getComparablePeriodWindow(asOf);
  const statusTotals = computeStatusTotals(invoices, asOf);

  const billedCurrent = billedInRange(invoices, window.currentStart, window.currentEnd);
  const billedComparable = billedInRange(invoices, window.comparableStart, window.comparableEnd);
  const billedChange = computeComparableChange(billedCurrent, billedComparable);

  const collectedCurrent = collectedInRange(invoices, window.currentStart, window.currentEnd);
  const collectedComparable = collectedInRange(invoices, window.comparableStart, window.comparableEnd);
  const collectedChange = computeComparableChange(collectedCurrent, collectedComparable);

  const invoicesIssuedThisPeriod = countInRange(
    invoices.filter((i) => !i.isDraft),
    (i) => i.issueDate,
    window.currentStart,
    window.currentEnd,
  );
  const invoicesIssuedComparablePeriod = countInRange(
    invoices.filter((i) => !i.isDraft),
    (i) => i.issueDate,
    window.comparableStart,
    window.comparableEnd,
  );

  const activeClientsThisPeriod = countDistinctInRange(
    invoices.filter((i) => !i.isDraft),
    (i) => i.issueDate,
    (i) => i.clientId,
    window.currentStart,
    window.currentEnd,
  );
  const activeClientsComparablePeriod = countDistinctInRange(
    invoices.filter((i) => !i.isDraft),
    (i) => i.issueDate,
    (i) => i.clientId,
    window.comparableStart,
    window.comparableEnd,
  );

  // "Comparable history" needs at least one invoice dated before the
  // current period began - otherwise a 0-vs-0 comparison would be
  // technically "comparable" (computeComparableChange would still mark
  // it not-comparable since the baseline is 0) but showing ANY
  // before/after framing with zero history is misleading on its own.
  const hasComparableHistory = invoices.some((i) => new Date(i.issueDate) < window.currentStart);

  return {
    billed: { amount: billedCurrent, timeframeLabel: window.currentLabel, changePct: billedChange.changePct, comparable: billedChange.comparable && hasComparableHistory },
    collected: { amount: collectedCurrent, timeframeLabel: window.currentLabel, changePct: collectedChange.changePct, comparable: collectedChange.comparable && hasComparableHistory },
    totalOutstanding: statusTotals.pending.amount + statusTotals.overdue.amount,
    outstandingInvoiceCount: statusTotals.pending.count + statusTotals.overdue.count,
    totalOverdue: statusTotals.overdue.amount,
    overdueInvoiceCount: statusTotals.overdue.count,
    invoicesIssuedThisPeriod,
    invoicesIssuedComparablePeriod,
    activeClientsThisPeriod,
    activeClientsComparablePeriod,
    periodLabel: window.currentLabel,
    comparableLabel: window.comparableLabel,
    isPartialPeriod: window.isPartial,
    hasEnoughData: invoices.length > 0,
    hasComparableHistory,
  };
}

export type SignalTone = "positive" | "caution" | "neutral";

export interface Signal {
  id: string;
  tone: SignalTone;
  title: string;
  detail: string;
}

/**
 * Interpretive signals - each one traceable to a specific comparison
 * over real data, and each only fires when it clears the threshold for
 * being worth saying. Deliberately NOT "every metric becomes a trend
 * card" - a metric with no comparable baseline, or a change too small to
 * matter, produces no signal at all rather than a hedge-y one.
 */
export function computeSignals(invoices: Invoice[], clients: Client[], pulse: BusinessPulse): Signal[] {
  const signals: Signal[] = [];

  if (pulse.overdueInvoiceCount > 0) {
    signals.push({
      id: "overdue",
      tone: "caution",
      title: `${pulse.overdueInvoiceCount} invoice${pulse.overdueInvoiceCount === 1 ? "" : "s"} overdue`,
      detail: `${formatCurrency(pulse.totalOverdue)} is currently overdue across ${pulse.overdueInvoiceCount} invoice${pulse.overdueInvoiceCount === 1 ? "" : "s"}.`,
    });
  }

  if (pulse.collected.comparable && pulse.collected.changePct !== undefined && Math.abs(pulse.collected.changePct) >= 5) {
    const improving = pulse.collected.changePct >= 0;
    signals.push({
      id: "collection-trend",
      tone: improving ? "positive" : "caution",
      title: improving ? "Collections are ahead of the same period last month" : "Collections are behind the same period last month",
      detail: `${formatCurrency(pulse.collected.amount)} collected so far in ${pulse.periodLabel}, ${improving ? "up" : "down"} ${Math.abs(pulse.collected.changePct).toFixed(1)}% versus the same span of ${pulse.comparableLabel}.`,
    });
  }

  if (pulse.hasComparableHistory && pulse.invoicesIssuedComparablePeriod > 0 && pulse.invoicesIssuedThisPeriod !== pulse.invoicesIssuedComparablePeriod) {
    const rising = pulse.invoicesIssuedThisPeriod > pulse.invoicesIssuedComparablePeriod;
    signals.push({
      id: "invoice-volume",
      tone: rising ? "positive" : "neutral",
      title: rising ? "Invoice volume is running ahead of last month" : "Invoice volume is running behind last month",
      detail: `${pulse.invoicesIssuedThisPeriod} invoice${pulse.invoicesIssuedThisPeriod === 1 ? "" : "s"} issued in ${pulse.periodLabel}, versus ${pulse.invoicesIssuedComparablePeriod} in the same span of ${pulse.comparableLabel}.`,
    });
  }

  if (pulse.hasComparableHistory && pulse.activeClientsComparablePeriod > 0 && pulse.activeClientsThisPeriod !== pulse.activeClientsComparablePeriod) {
    const rising = pulse.activeClientsThisPeriod > pulse.activeClientsComparablePeriod;
    signals.push({
      id: "client-activity",
      tone: rising ? "positive" : "neutral",
      title: rising ? "More clients billed this period" : "Fewer clients billed this period",
      detail: `${pulse.activeClientsThisPeriod} client${pulse.activeClientsThisPeriod === 1 ? "" : "s"} invoiced in ${pulse.periodLabel}, versus ${pulse.activeClientsComparablePeriod} in the same span of ${pulse.comparableLabel}.`,
    });
  }

  const insights = computeClientInsights(invoices, clients);
  if (insights.concentrationRisk) {
    signals.push({
      id: "client-concentration",
      tone: "caution",
      title: "One client holds most of the outstanding balance",
      detail: `${insights.concentrationRisk.clientName} accounts for ${formatCurrency(insights.concentrationRisk.amount)} (${Math.round(insights.concentrationRisk.share * 100)}%) of everything currently outstanding.`,
    });
  }

  return signals;
}

export type AttentionReason =
  | "overdue"
  | "due-soon"
  | "large-outstanding"
  | "payment-inactivity";

export interface AttentionItem {
  id: string;
  reason: AttentionReason;
  /** Only present for invoice-level items (overdue, due-soon, large-outstanding). Absent for workspace-level items like payment inactivity. */
  invoiceId?: string;
  invoiceNumber?: string;
  clientName: string;
  detail: string;
  amount: number;
  actionLabel: string;
  severity: "high" | "medium";
}

/** An invoice is "unusually large" once its total is at least this many times the average outstanding invoice - flags concentration risk on a single bill, not just an aggregate. */
const LARGE_INVOICE_MULTIPLE = 2.5;
/** No payment recorded in this many days, while invoices remain outstanding, is treated as payment inactivity worth flagging. */
const PAYMENT_INACTIVITY_DAYS = 30;

/**
 * Genuinely actionable items, prioritized by severity then amount:
 * overdue invoices first (these already missed their due date), then
 * unusually large unpaid invoices (concentration risk even before
 * they're late), then invoices due imminently, then payment inactivity
 * (a workspace-level signal, not tied to one invoice). Nothing here is
 * urgency for urgency's sake - each threshold is named and fixed above,
 * not tuned to always produce a result.
 */
export function computeAttentionItems(invoices: Invoice[], clients: Client[], payments: Payment[], asOf: Date = new Date()): AttentionItem[] {
  const items: AttentionItem[] = [];
  const msPerDay = 1000 * 60 * 60 * 24;

  const outstandingInvoices = invoices.filter((i) => {
    const status = getInvoiceStatus(i, asOf).status;
    return status === "pending" || status === "overdue";
  });
  const outstandingTotals = outstandingInvoices.map((i) => computeInvoiceTotals(i).total);
  const averageOutstanding = outstandingTotals.length > 0 ? outstandingTotals.reduce((s, v) => s + v, 0) / outstandingTotals.length : 0;

  for (const invoice of invoices) {
    const info = getInvoiceStatus(invoice, asOf);
    const { total } = computeInvoiceTotals(invoice);
    const clientName = getClientName(clients, invoice.clientId);

    if (info.status === "overdue") {
      items.push({
        id: `overdue-${invoice.id}`,
        reason: "overdue",
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        clientName,
        detail: info.daysOverdue === 1 ? "1 day overdue" : `${info.daysOverdue} days overdue`,
        amount: total,
        actionLabel: "Send reminder",
        severity: info.severity === "strong" ? "high" : "medium",
      });
      continue;
    }

    if (info.status === "pending") {
      // Large-outstanding takes priority over a due-soon flag on the same
      // invoice, since "this is unusually large" is the more useful thing
      // to say than "it happens to be due in 3 days" when both are true.
      if (outstandingInvoices.length > 1 && averageOutstanding > 0 && total >= averageOutstanding * LARGE_INVOICE_MULTIPLE) {
        items.push({
          id: `large-${invoice.id}`,
          reason: "large-outstanding",
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientName,
          detail: `${(total / averageOutstanding).toFixed(1)}x the average outstanding invoice`,
          amount: total,
          actionLabel: "Review invoice",
          severity: "medium",
        });
        continue;
      }

      const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - asOf.getTime()) / msPerDay);
      if (daysUntilDue <= 3) {
        items.push({
          id: `due-soon-${invoice.id}`,
          reason: "due-soon",
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientName,
          detail: daysUntilDue <= 0 ? "Due today" : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
          amount: total,
          actionLabel: "Review invoice",
          severity: "medium",
        });
      }
    }
  }

  // Payment inactivity: only meaningful when there IS an outstanding
  // balance to collect against AND at least one payment has ever been
  // recorded (otherwise "no payment in 30 days" is just "this workspace
  // is brand new," not a real inactivity signal).
  if (payments.length > 0 && outstandingInvoices.length > 0) {
    const lastPayment = payments.reduce((latest, p) => (new Date(p.receivedAt) > new Date(latest.receivedAt) ? p : latest));
    const daysSinceLastPayment = Math.floor((asOf.getTime() - new Date(lastPayment.receivedAt).getTime()) / msPerDay);
    if (daysSinceLastPayment >= PAYMENT_INACTIVITY_DAYS) {
      const totalOutstanding = outstandingTotals.reduce((s, v) => s + v, 0);
      items.push({
        id: "payment-inactivity",
        reason: "payment-inactivity",
        clientName: "All clients",
        detail: `No payment received in ${daysSinceLastPayment} days`,
        amount: totalOutstanding,
        actionLabel: "Review outstanding invoices",
        severity: daysSinceLastPayment >= PAYMENT_INACTIVITY_DAYS * 2 ? "high" : "medium",
      });
    }
  }

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return b.amount - a.amount;
  });
}

export interface ClientOutstandingFact {
  clientId: string;
  clientName: string;
  amount: number;
}

export interface ClientInsights {
  highestOutstandingClient: ClientOutstandingFact | undefined;
  largestBilledClient: ClientOutstandingFact | undefined;
  concentrationRisk: (ClientOutstandingFact & { share: number }) | undefined;
  /** How many distinct clients currently have at least one overdue invoice. */
  clientsWithOverdueCount: number;
  /** The client with the most total payment amount recorded - "strongest collection activity." Undefined until >1 client has any payment. */
  strongestCollectionClient: ClientOutstandingFact | undefined;
  /** Clients who received a new invoice within the last 30 days, most recent first - capped to a short, useful list. */
  recentlyActiveClients: { clientId: string; clientName: string; lastInvoiceDate: string }[];
}

const CONCENTRATION_THRESHOLD = 0.4;
const RECENT_ACTIVITY_DAYS = 30;
const MAX_RECENT_ACTIVITY_CLIENTS = 5;

/**
 * Surfaces client-level facts only when there's more than one client
 * with relevant activity - a "highest outstanding client" of exactly one
 * client that owes money isn't an insight, it's just the only data point
 * that exists, so that case is deliberately left undefined.
 */
export function computeClientInsights(invoices: Invoice[], clients: Client[], payments: Payment[] = [], asOf: Date = new Date()): ClientInsights {
  const outstandingByClient = new Map<string, number>();
  const billedByClient = new Map<string, number>();
  const overdueClientIds = new Set<string>();

  for (const invoice of invoices) {
    if (invoice.isDraft) continue;
    const { total } = computeInvoiceTotals(invoice);
    billedByClient.set(invoice.clientId, (billedByClient.get(invoice.clientId) ?? 0) + total);

    const status = getInvoiceStatus(invoice, asOf).status;
    if (status === "pending" || status === "overdue") {
      outstandingByClient.set(invoice.clientId, (outstandingByClient.get(invoice.clientId) ?? 0) + total);
    }
    if (status === "overdue") {
      overdueClientIds.add(invoice.clientId);
    }
  }

  const outstandingRanked = Array.from(outstandingByClient.entries()).sort((a, b) => b[1] - a[1]);
  const billedRanked = Array.from(billedByClient.entries()).sort((a, b) => b[1] - a[1]);

  const highestOutstandingClient =
    outstandingRanked.length > 0 && outstandingRanked[0][1] > 0
      ? { clientId: outstandingRanked[0][0], clientName: getClientName(clients, outstandingRanked[0][0]), amount: outstandingRanked[0][1] }
      : undefined;

  const largestBilledClient =
    billedRanked.length > 1
      ? { clientId: billedRanked[0][0], clientName: getClientName(clients, billedRanked[0][0]), amount: billedRanked[0][1] }
      : undefined;

  let concentrationRisk: ClientInsights["concentrationRisk"];
  if (outstandingRanked.length > 1) {
    const [topClientId, topAmount] = outstandingRanked[0];
    const totalAcrossClients = Array.from(outstandingByClient.values()).reduce((sum, v) => sum + v, 0);
    const share = totalAcrossClients > 0 ? topAmount / totalAcrossClients : 0;
    if (share >= CONCENTRATION_THRESHOLD && topAmount > 0) {
      concentrationRisk = { clientId: topClientId, clientName: getClientName(clients, topClientId), amount: topAmount, share };
    }
  }

  const paidByClient = new Map<string, number>();
  for (const payment of payments) {
    paidByClient.set(payment.clientId, (paidByClient.get(payment.clientId) ?? 0) + payment.amount);
  }
  const paidRanked = Array.from(paidByClient.entries()).sort((a, b) => b[1] - a[1]);
  const strongestCollectionClient =
    paidRanked.length > 1
      ? { clientId: paidRanked[0][0], clientName: getClientName(clients, paidRanked[0][0]), amount: paidRanked[0][1] }
      : undefined;

  const lastInvoiceByClient = new Map<string, string>();
  for (const invoice of invoices) {
    if (invoice.isDraft) continue;
    const existing = lastInvoiceByClient.get(invoice.clientId);
    if (!existing || new Date(invoice.issueDate) > new Date(existing)) {
      lastInvoiceByClient.set(invoice.clientId, invoice.issueDate);
    }
  }
  const recentCutoff = new Date(asOf.getTime() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
  const recentlyActiveClients = Array.from(lastInvoiceByClient.entries())
    .filter(([, lastDate]) => new Date(lastDate) >= recentCutoff)
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .slice(0, MAX_RECENT_ACTIVITY_CLIENTS)
    .map(([clientId, lastInvoiceDate]) => ({ clientId, clientName: getClientName(clients, clientId), lastInvoiceDate }));

  return {
    highestOutstandingClient,
    largestBilledClient,
    concentrationRisk,
    clientsWithOverdueCount: overdueClientIds.size,
    strongestCollectionClient,
    recentlyActiveClients,
  };
}

/**
 * One executive-level paragraph, assembled entirely from the pulse and
 * attention data passed in - never a hard-coded string, and never a
 * claim stronger than the data supports (no "ahead of"/"behind" language
 * unless hasComparableHistory AND a real comparable baseline exist).
 */
export function generateExecutiveSummary(pulse: BusinessPulse, attentionCount: number, overdueAmount: number): string {
  if (!pulse.hasEnoughData) {
    return "Not enough billing activity yet to summarize. Create and send a few invoices to see insights here.";
  }

  let collectionsPhrase: string;
  if (!pulse.hasComparableHistory) {
    collectionsPhrase = `${formatCurrency(pulse.collected.amount)} collected so far in ${pulse.periodLabel}. Not enough history yet for a period comparison.`;
  } else if (!pulse.collected.comparable) {
    collectionsPhrase = `${formatCurrency(pulse.collected.amount)} collected in ${pulse.periodLabel}. Comparison unavailable - no collections were recorded in the same span of ${pulse.comparableLabel}.`;
  } else if (pulse.collected.changePct! > 5) {
    collectionsPhrase = `Collections are ahead of the same period last month (${formatCurrency(pulse.collected.amount)} vs the equivalent days in ${pulse.comparableLabel}).`;
  } else if (pulse.collected.changePct! < -5) {
    collectionsPhrase = `Collections are behind the same period last month (${formatCurrency(pulse.collected.amount)} vs the equivalent days in ${pulse.comparableLabel}).`;
  } else {
    collectionsPhrase = `Collections are roughly in line with the same period last month.`;
  }

  const attentionPhrase =
    attentionCount > 0
      ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} require${attentionCount === 1 ? "s" : ""} attention`
      : "Nothing currently requires urgent attention";

  const overduePhrase = overdueAmount > 0 ? `, with ${formatCurrency(overdueAmount)} currently overdue.` : ".";

  return `${collectionsPhrase} ${attentionPhrase}${overduePhrase}`;
}