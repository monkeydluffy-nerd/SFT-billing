/**
 * Pure data: for each intent AURA can act on, a list of phrases/keywords
 * with a weight. classifyIntent.ts sums weights of every phrase found in
 * the normalized input and picks the highest-scoring intent - it holds
 * no logic itself, so adding a new phrasing is just adding a line here.
 *
 * Weighting convention:
 * - Multi-word phrases (more specific) get higher weight than single
 *   generic words, so "total bill" outscores the bare word "bill" if
 *   both match, and a specific phrase always outranks a generic
 *   catch-all like "how much" on its own.
 * - Generic catch-alls (e.g. "how much") are given a LOW weight and
 *   exist only as a last-resort nudge toward REVENUE_THIS_MONTH - never
 *   enough on their own to beat a real intent's specific phrase, which
 *   is exactly the collision this file exists to prevent (see
 *   classifyIntent.test.ts for the two phrasings that previously broke).
 */

export type AuraIntentType =
  | "TOTAL_BILLED"
  | "OUTSTANDING"
  | "COLLECTED"
  | "OVERDUE_LIST"
  | "PENDING_LIST"
  | "PAID_LIST"
  | "DRAFT_LIST"
  | "INVOICE_COUNT"
  | "CLIENT_COUNT"
  | "CREATE_INVOICE"
  | "REVENUE_THIS_MONTH"
  | "ADD_CLIENT"
  | "UNKNOWN";

export interface LexiconEntry {
  phrase: string;
  weight: number;
}

export const INTENT_LEXICON: Record<Exclude<AuraIntentType, "UNKNOWN">, LexiconEntry[]> = {
  TOTAL_BILLED: [
    { phrase: "total bill", weight: 10 },
    { phrase: "total billed", weight: 10 },
    { phrase: "total invoiced", weight: 10 },
    { phrase: "total invoice amount", weight: 10 },
    { phrase: "how much have we billed", weight: 10 },
    { phrase: "how much did we bill", weight: 10 },
    { phrase: "how much have we invoiced", weight: 10 },
    { phrase: "billed amount", weight: 9 },
    { phrase: "invoiced amount", weight: 9 },
    { phrase: "billed", weight: 4 },
    { phrase: "invoiced", weight: 3 },
  ],

  OUTSTANDING: [
    { phrase: "what is outstanding", weight: 10 },
    { phrase: "how much is outstanding", weight: 10 },
    { phrase: "who owes us", weight: 10 },
    { phrase: "who owes", weight: 9 },
    { phrase: "what do clients owe", weight: 10 },
    { phrase: "outstanding balance", weight: 9 },
    { phrase: "outstanding amount", weight: 9 },
    { phrase: "unpaid amount", weight: 8 },
    { phrase: "outstanding", weight: 6 },
    { phrase: "owes us", weight: 6 },
    { phrase: "owe us", weight: 6 },
    { phrase: "unpaid", weight: 4 },
  ],

  COLLECTED: [
    { phrase: "how much have we collected", weight: 10 },
    { phrase: "how much did we collect", weight: 10 },
    { phrase: "how much money came in", weight: 10 },
    { phrase: "money came in", weight: 9 },
    { phrase: "total collected", weight: 10 },
    { phrase: "total received", weight: 9 },
    { phrase: "payments received", weight: 8 },
    { phrase: "collected", weight: 5 },
    { phrase: "received", weight: 3 },
    { phrase: "came in", weight: 4 },
  ],

  OVERDUE_LIST: [
    { phrase: "show overdue invoices", weight: 10 },
    { phrase: "overdue invoices", weight: 9 },
    { phrase: "overdue", weight: 7 },
    { phrase: "past due", weight: 7 },
  ],

  PENDING_LIST: [
    { phrase: "show pending invoices", weight: 10 },
    { phrase: "pending invoices", weight: 9 },
    { phrase: "pending", weight: 6 },
  ],

  PAID_LIST: [
    { phrase: "show paid invoices", weight: 10 },
    { phrase: "paid invoices", weight: 9 },
    { phrase: "paid", weight: 5 },
  ],

  DRAFT_LIST: [
    { phrase: "show draft invoices", weight: 10 },
    { phrase: "draft invoices", weight: 9 },
    { phrase: "draft", weight: 6 },
    { phrase: "drafts", weight: 6 },
  ],

  INVOICE_COUNT: [
    { phrase: "how many invoices do we have", weight: 11 },
    { phrase: "how many invoices", weight: 10 },
    { phrase: "number of invoices", weight: 9 },
    { phrase: "invoice count", weight: 9 },
  ],

  CLIENT_COUNT: [
    { phrase: "how many clients do we have", weight: 11 },
    { phrase: "how many clients", weight: 10 },
    { phrase: "number of clients", weight: 9 },
    { phrase: "client count", weight: 9 },
  ],

  CREATE_INVOICE: [
    { phrase: "create an invoice", weight: 10 },
    { phrase: "create invoice", weight: 10 },
    { phrase: "new invoice", weight: 9 },
    { phrase: "make an invoice", weight: 9 },
    { phrase: "start an invoice", weight: 8 },
  ],

  ADD_CLIENT: [
    { phrase: "add a client", weight: 10 },
    { phrase: "add client", weight: 10 },
    { phrase: "new client", weight: 9 },
    { phrase: "create a client", weight: 9 },
  ],

  // Deliberately the weakest intent in the lexicon: only bare, generic
  // phrasings live here, at low weight, so it only wins when nothing more
  // specific matched at all - this is the fix for the "how much" collision
  // (see classifyIntent.test.ts: "how much have we billed" must resolve to
  // TOTAL_BILLED, not here, because TOTAL_BILLED's specific phrase scores higher).
  REVENUE_THIS_MONTH: [
    { phrase: "how much did we earn this month", weight: 10 },
    { phrase: "earn this month", weight: 9 },
    { phrase: "revenue this month", weight: 9 },
    { phrase: "earn", weight: 3 },
    { phrase: "revenue", weight: 3 },
    { phrase: "how much", weight: 1 },
  ],
};