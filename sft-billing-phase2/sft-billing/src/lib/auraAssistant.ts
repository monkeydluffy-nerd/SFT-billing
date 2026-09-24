import type { Client, Invoice, InvoiceStatus, InvoiceDraftPrefill } from "@/types";
import { getInvoiceStatus } from "@/lib/invoiceMath";
import { computeStatusTotals, computeMonthlyRevenueSeries, revenueForCurrentMonth } from "@/lib/overviewMetrics";
import { formatCurrency, formatPercent } from "@/lib/formatters";

export interface AuraContext {
  invoices: Invoice[];
  clients: Client[];
  goToInvoices: (status?: InvoiceStatus | null) => void;
  openCreateInvoice: (prefill?: InvoiceDraftPrefill) => void;
}

export interface AuraReply {
  text: string;
  /** True when AURA actually changed something in the UI (vs. just answering). */
  didAct: boolean;
}

/**
 * Rule-based intents wired to the real dataset and the real Invoices /
 * Create Invoice screens, so every documented example either truly acts
 * or honestly says what's not built yet — never a scripted-sounding fake
 * response. Phase 5 replaces this file's contents with a real
 * intent/agent loop; the calling code (AuraPanel) won't need to change.
 */
export function runAuraCommand(rawInput: string, ctx: AuraContext): AuraReply {
  const input = rawInput.trim().toLowerCase();
  if (input.length === 0) {
    return { text: "Ask me something, or try one of the suggestions below.", didAct: false };
  }

  const wantsCreate = input.includes("invoice") && (input.includes("create") || input.includes("new for") || input.includes("for "));
  if (wantsCreate && (input.includes("create") || input.includes("new"))) {
    const matchedClient = findClientMention(rawInput, ctx.clients);
    if (matchedClient) {
      ctx.openCreateInvoice({ clientId: matchedClient.id });
      return { text: `Opened a new invoice for ${matchedClient.name} — add the line items when you're ready.`, didAct: true };
    }
    ctx.openCreateInvoice();
    return { text: "Opened a new invoice — pick a client to get started.", didAct: true };
  }

  if (input.includes("overdue")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.goToInvoices("overdue");
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
    ctx.goToInvoices("pending");
    return {
      text: `Showing ${totals.pending.count} pending ${totals.pending.count === 1 ? "invoice" : "invoices"}, totalling ${formatCurrency(totals.pending.amount)}.`,
      didAct: true,
    };
  }

  if (input.includes("paid")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.goToInvoices("paid");
    return {
      text: `Showing ${totals.paid.count} paid ${totals.paid.count === 1 ? "invoice" : "invoices"}, totalling ${formatCurrency(totals.paid.amount)}.`,
      didAct: true,
    };
  }

  if (input.includes("draft")) {
    const totals = computeStatusTotals(ctx.invoices);
    ctx.goToInvoices("draft");
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

  if (input.includes("client") && (input.includes("add") || input.includes("new"))) {
    return {
      text: "A dedicated Clients module arrives in Phase 3. For now, add a client directly from Create Invoice \u2014 its client field has a \u201c+ Add new client\u201d option.",
      didAct: false,
    };
  }

  return {
    text: "I don't have that one yet in this build. Try: \u201ccreate an invoice for [client]\u201d, \u201cshow overdue invoices\u201d, or \u201chow much did we earn this month\u201d.",
    didAct: false,
  };
}

/**
 * Looks for a client name mentioned in the raw sentence — substring match
 * first ("create an invoice for Acme Corporation" -> exact hit), falling
 * back to matching just the client's first word ("...for Acme" ->
 * matches "Acme Corporation") since that's how people actually talk.
 */
function findClientMention(rawInput: string, clients: Client[]): Client | undefined {
  const inputLower = rawInput.toLowerCase();

  const exact = clients
    .filter((c) => inputLower.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (exact) return exact;

  return clients.find((c) => {
    const firstWord = c.name.split(" ")[0].toLowerCase();
    return firstWord.length > 2 && inputLower.includes(firstWord);
  });
}
