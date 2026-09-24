import type { Client, Invoice, InvoiceStatus } from "@/types";
import { getInvoiceStatus } from "@/lib/invoiceMath";
import { computeStatusTotals, computeMonthlyRevenueSeries, revenueForCurrentMonth } from "@/lib/overviewMetrics";
import { formatCurrency, formatPercent } from "@/lib/formatters";

export interface AuraContext {
  invoices: Invoice[];
  clients: Client[];
  focusOverviewStatus: (status: InvoiceStatus | null) => void;
}

export interface AuraReply {
  text: string;
  /** True when AURA actually changed something in the UI (vs. just answering). */
  didAct: boolean;
}

/**
 * Phase 1 scope only: a small set of rule-based intents wired to the real
 * Overview data, so every documented example either truly acts or
 * honestly says what's not built yet — never a scripted-sounding fake
 * response. Phase 5 replaces this file's contents with a real
 * intent/agent loop; the calling code (AuraPanel) won't need to change.
 */
export function runAuraCommand(rawInput: string, ctx: AuraContext): AuraReply {
  const input = rawInput.trim().toLowerCase();
  if (input.length === 0) {
    return { text: "Ask me something, or try one of the suggestions below.", didAct: false };
  }

  if (input.includes("overdue")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.focusOverviewStatus("overdue");
    if (totals.overdue.count === 0) {
      return { text: "Nothing is overdue right now — good place to be.", didAct: true };
    }
    const oldest = ctx.invoices
      .map((invoice) => getInvoiceStatus(invoice))
      .filter((info) => info.status === "overdue")
      .sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
    return {
      text: `Showing ${totals.overdue.count} overdue ${totals.overdue.count === 1 ? "invoice" : "invoices"}, oldest is ${oldest?.daysOverdue ?? 0} days overdue.`,
      didAct: true,
    };
  }

  if (input.includes("pending")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.focusOverviewStatus("pending");
    return {
      text: `Showing ${totals.pending.count} pending ${totals.pending.count === 1 ? "invoice" : "invoices"}, totalling ${formatCurrency(totals.pending.amount)}.`,
      didAct: true,
    };
  }

  if (input.includes("paid")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.focusOverviewStatus("paid");
    return {
      text: `Showing ${totals.paid.count} paid ${totals.paid.count === 1 ? "invoice" : "invoices"}, totalling ${formatCurrency(totals.paid.amount)}.`,
      didAct: true,
    };
  }

  if (input.includes("draft")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.focusOverviewStatus("draft");
    return {
      text: `Showing ${totals.draft.count} draft ${totals.draft.count === 1 ? "invoice" : "invoices"}.`,
      didAct: true,
    };
  }

  if (input.includes("earn") || input.includes("revenue") || input.includes("how much")) {
    const series = computeMonthlyRevenueSeries(ctx.invoices);
    const { current, changePct } = revenueForCurrentMonth(series);
    return {
      text: `${formatCurrency(current)} collected this month, ${formatPercent(changePct)} versus last month.`,
      didAct: false,
    };
  }

  if (input.includes("invoice") && (input.includes("create") || input.includes("new"))) {
    return {
      text: "Invoice creation opens in Phase 2 — not wired up yet in this build. For now I can show you overdue, pending, paid, or draft invoices, or tell you this month's revenue.",
      didAct: false,
    };
  }

  if (input.includes("client") && (input.includes("add") || input.includes("new"))) {
    return {
      text: "Adding a client arrives with the Clients module in Phase 3 — not wired up yet in this build.",
      didAct: false,
    };
  }

  return {
    text: "I don't have that one yet in this build. Try: \u201cshow overdue invoices\u201d, \u201chow much did we earn this month\u201d, or \u201cshow pending invoices\u201d.",
    didAct: false,
  };
}
