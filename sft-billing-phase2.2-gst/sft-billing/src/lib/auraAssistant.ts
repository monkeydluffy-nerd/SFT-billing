import type { Client, Invoice, InvoiceStatus, InvoiceDraftPrefill, Payment } from "@/types";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { computeStatusTotals, computeMonthlyRevenueSeries, revenueForCurrentMonth } from "@/lib/overviewMetrics";
import { formatCurrency } from "@/lib/formatters";
import { classifyIntent } from "@/lib/aura/classifyIntent";

export interface AuraContext {
  invoices: Invoice[];
  clients: Client[];
  payments: Payment[];
  goToInvoices: (status?: InvoiceStatus | null) => void;
  openCreateInvoice: (prefill?: InvoiceDraftPrefill) => void;
}

export interface AuraReply {
  text: string;
  /** True when AURA actually changed something in the UI (vs. just answering). */
  didAct: boolean;
}

/**
 * User question -> classifyIntent() (lightweight local NLU, no external
 * API) -> structured intent -> one of the handlers below, each of which
 * calls the SAME existing calculation/data functions the rest of the app
 * uses (computeInvoiceTotals, computeStatusTotals, etc.) -> AURA
 * response. classifyIntent only decides WHICH handler runs; it never
 * computes a financial figure itself - every number below comes from the
 * calculation layer, exactly as before this file was split.
 */
export function runAuraCommand(rawInput: string, ctx: AuraContext): AuraReply {
  const input = rawInput.trim();
  if (input.length === 0) {
    return { text: "Ask me something, or try one of the suggestions below.", didAct: false };
  }

  const intent = classifyIntent(input, ctx.clients);

  switch (intent.type) {
    case "CREATE_INVOICE":
      return handleCreateInvoice(intent.clientMention, ctx);
    case "TOTAL_BILLED":
      return handleTotalBilled(ctx);
    case "OUTSTANDING":
      return handleOutstanding(ctx);
    case "COLLECTED":
      return handleCollected(ctx);
    case "INVOICE_COUNT":
      return handleInvoiceCount(ctx);
    case "CLIENT_COUNT":
      return handleClientCount(ctx);
    case "OVERDUE_LIST":
      return handleOverdueList(ctx);
    case "PENDING_LIST":
      return handlePendingList(ctx);
    case "PAID_LIST":
      return handlePaidList(ctx);
    case "DRAFT_LIST":
      return handleDraftList(ctx);
    case "REVENUE_THIS_MONTH":
      return handleRevenueThisMonth(ctx);
    case "ADD_CLIENT":
      return handleAddClient();
    case "UNKNOWN":
    default:
      return handleUnknown();
  }
}

function handleCreateInvoice(matchedClient: Client | undefined, ctx: AuraContext): AuraReply {
  if (matchedClient) {
    ctx.openCreateInvoice({ clientId: matchedClient.id });
    return { text: `Opened a new invoice for ${matchedClient.name} - add the line items when you're ready.`, didAct: true };
  }
  ctx.openCreateInvoice();
  return { text: "Opened a new invoice - pick a client to get started.", didAct: true };
}

/** "total bill" / "total billed" / "how much have we billed" - sum of every non-draft invoice's grand total, matching Reports' "Total billed". */
function handleTotalBilled(ctx: AuraContext): AuraReply {
  const billed = ctx.invoices.filter((i) => !i.isDraft);
  const totalBilled = billed.reduce((sum, i) => sum + computeInvoiceTotals(i).total, 0);
  if (billed.length === 0) {
    return { text: "No invoices have been billed yet, so there's no total to show. Send your first invoice to start tracking this.", didAct: false };
  }
  return {
    text: `Total billed: ${formatCurrency(totalBilled)} across ${billed.length} sent invoice${billed.length === 1 ? "" : "s"}.`,
    didAct: false,
  };
}

/** "how much is outstanding" / "who owes us" - pending + overdue. */
function handleOutstanding(ctx: AuraContext): AuraReply {
  const totals = computeStatusTotals(ctx.invoices);
  const outstanding = totals.pending.amount + totals.overdue.amount;
  const outstandingCount = totals.pending.count + totals.overdue.count;
  if (outstandingCount === 0) {
    return { text: "Nothing is outstanding right now - every sent invoice is either paid or still a draft.", didAct: false };
  }
  return {
    text: `${formatCurrency(outstanding)} outstanding across ${outstandingCount} invoice${outstandingCount === 1 ? "" : "s"} (${totals.pending.count} pending, ${totals.overdue.count} overdue).`,
    didAct: false,
  };
}

/** "how much have we collected" / "how much money came in" - sum of every recorded payment, ever. */
function handleCollected(ctx: AuraContext): AuraReply {
  const totalCollected = ctx.payments.reduce((sum, p) => sum + p.amount, 0);
  if (ctx.payments.length === 0) {
    return { text: "No payments have been recorded yet.", didAct: false };
  }
  return {
    text: `Collected to date: ${formatCurrency(totalCollected)} across ${ctx.payments.length} payment${ctx.payments.length === 1 ? "" : "s"}.`,
    didAct: false,
  };
}

/** "how many invoices do we have" */
function handleInvoiceCount(ctx: AuraContext): AuraReply {
  const totals = computeStatusTotals(ctx.invoices);
  return {
    text: `${ctx.invoices.length} invoice${ctx.invoices.length === 1 ? "" : "s"} total - ${totals.draft.count} draft, ${totals.pending.count} pending, ${totals.overdue.count} overdue, ${totals.paid.count} paid.`,
    didAct: false,
  };
}

/** "how many clients do we have" */
function handleClientCount(ctx: AuraContext): AuraReply {
  return {
    text: `${ctx.clients.length} client${ctx.clients.length === 1 ? "" : "s"} in the workspace.`,
    didAct: false,
  };
}

function handleOverdueList(ctx: AuraContext): AuraReply {
  const totals = computeStatusTotals(ctx.invoices);
  ctx.goToInvoices("overdue");
  if (totals.overdue.count === 0) {
    return { text: "Nothing is overdue right now - good place to be.", didAct: true };
  }
  const oldest = ctx.invoices
    .map((invoice) => getInvoiceStatus(invoice))
    .filter((info) => info.status === "overdue")
    .sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
  return {
    text: `Showing ${totals.overdue.count} overdue ${totals.overdue.count === 1 ? "invoice" : "invoices"} (${formatCurrency(totals.overdue.amount)}), oldest is ${oldest?.daysOverdue ?? 0} days overdue.`,
    didAct: true,
  };
}

function handlePendingList(ctx: AuraContext): AuraReply {
  const totals = computeStatusTotals(ctx.invoices);
  ctx.goToInvoices("pending");
  return {
    text: `Showing ${totals.pending.count} pending ${totals.pending.count === 1 ? "invoice" : "invoices"}, totalling ${formatCurrency(totals.pending.amount)}.`,
    didAct: true,
  };
}

function handlePaidList(ctx: AuraContext): AuraReply {
  const totals = computeStatusTotals(ctx.invoices);
  ctx.goToInvoices("paid");
  return {
    text: `Showing ${totals.paid.count} paid ${totals.paid.count === 1 ? "invoice" : "invoices"}, totalling ${formatCurrency(totals.paid.amount)}.`,
    didAct: true,
  };
}

function handleDraftList(ctx: AuraContext): AuraReply {
  const totals = computeStatusTotals(ctx.invoices);
  ctx.goToInvoices("draft");
  return {
    text: `Showing ${totals.draft.count} draft ${totals.draft.count === 1 ? "invoice" : "invoices"}.`,
    didAct: true,
  };
}

/** "how much did we earn this month" - month-to-date, labeled honestly since the current month is very likely incomplete. */
function handleRevenueThisMonth(ctx: AuraContext): AuraReply {
  const series = computeMonthlyRevenueSeries(ctx.invoices);
  const { current, previous } = revenueForCurrentMonth(series);
  const today = new Date();
  const isMidMonth = today.getDate() < new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (previous === 0) {
    return { text: `${formatCurrency(current)} collected so far this month (month to date). No comparable figure from last month yet.`, didAct: false };
  }
  return {
    text: isMidMonth
      ? `${formatCurrency(current)} collected month to date, versus ${formatCurrency(previous)} for the same point last month.`
      : `${formatCurrency(current)} collected this month, versus ${formatCurrency(previous)} last month.`,
    didAct: false,
  };
}

function handleAddClient(): AuraReply {
  return {
    text: "Add a client from the Clients page, or use the \u201c+ Add new client\u201d option in the Create Invoice client field.",
    didAct: false,
  };
}

function handleUnknown(): AuraReply {
  return {
    text: "I don't have that one yet. Try: \u201cshow me the total bill\u201d, \u201chow much is outstanding\u201d, \u201cshow overdue invoices\u201d, or \u201chow much have we collected\u201d.",
    didAct: false,
  };
}