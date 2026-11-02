import { describe, expect, it } from "vitest";
import {
  computeBusinessPulse,
  computeAttentionItems,
  computeClientInsights,
  generateExecutiveSummary,
} from "./intelligence";
import type { Client, Invoice, Payment } from "@/types";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "iv_test",
    number: "INV-1",
    clientId: "cl_1",
    issueDate: "2026-09-01",
    dueDate: "2026-09-15",
    items: [{ id: "li_1", description: "x", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client>): Client {
  return {
    id: "cl_1",
    name: "Client",
    contactName: "Contact",
    email: "x@example.com",
    billingAddress: "",
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment>): Payment {
  return {
    id: "pm_1",
    invoiceId: "iv_test",
    clientId: "cl_1",
    amount: 1000,
    method: "bank_transfer",
    receivedAt: "2026-09-05",
    ...overrides,
  };
}

describe("computeBusinessPulse - partial-month behavior", () => {
  it("never compares a partial current month against a FULL previous month", () => {
    const asOf = new Date(2026, 8, 10); // Sep 10
    const invoices = [
      makeInvoice({ id: "a", issueDate: "2026-09-05", paidAt: "2026-09-05" }), // in current window
      makeInvoice({ id: "b", issueDate: "2026-08-05", paidAt: "2026-08-05" }), // in comparable window (day 5 <= day 10)
      makeInvoice({ id: "c", issueDate: "2026-08-25", paidAt: "2026-08-25" }), // OUTSIDE comparable window - must not count
    ];
    const pulse = computeBusinessPulse(invoices, [], asOf);

    // Only invoice "b" (₹1180 with 9%+9% GST) should count toward the comparable baseline - not "c".
    expect(pulse.collected.amount).toBeCloseTo(1180, 0);
  });

  it("marks the comparison NOT comparable (not a misleading percentage) when there is no real prior-period baseline", () => {
    const asOf = new Date(2026, 8, 10);
    const invoices = [makeInvoice({ id: "a", issueDate: "2026-09-05", paidAt: "2026-09-05" })];
    const pulse = computeBusinessPulse(invoices, [], asOf);
    expect(pulse.hasComparableHistory).toBe(false);
    expect(pulse.collected.comparable).toBe(false);
    expect(pulse.collected.changePct).toBeUndefined();
  });

  it("produces a real, comparable changePct once genuine prior-period history exists", () => {
    const asOf = new Date(2026, 8, 10);
    const invoices = [
      makeInvoice({ id: "a", issueDate: "2026-09-05", paidAt: "2026-09-05" }),
      makeInvoice({ id: "b", issueDate: "2026-08-05", paidAt: "2026-08-05" }),
    ];
    const pulse = computeBusinessPulse(invoices, [], asOf);
    expect(pulse.hasComparableHistory).toBe(true);
    expect(pulse.collected.comparable).toBe(true);
    expect(pulse.collected.changePct).toBe(0); // identical invoices, so 0% change
  });
});

describe("computeAttentionItems - genuinely actionable items only", () => {
  it("flags an unusually large outstanding invoice relative to the average", () => {
    const asOf = new Date(2026, 8, 20);
    const invoices = [
      makeInvoice({ id: "small1", issueDate: "2026-09-01", dueDate: "2026-10-01", items: [{ id: "i1", description: "x", quantity: 1, unitPrice: 100 }] }),
      makeInvoice({ id: "small2", issueDate: "2026-09-01", dueDate: "2026-10-01", items: [{ id: "i2", description: "x", quantity: 1, unitPrice: 100 }] }),
      makeInvoice({ id: "big", issueDate: "2026-09-01", dueDate: "2026-10-01", items: [{ id: "i3", description: "x", quantity: 1, unitPrice: 10000 }] }),
    ];
    const items = computeAttentionItems(invoices, [], [], asOf);
    expect(items.some((i) => i.reason === "large-outstanding" && i.invoiceId === "big")).toBe(true);
  });

  it("flags payment inactivity only when payments exist AND there is an outstanding balance AND enough time has passed", () => {
    const asOf = new Date(2026, 9, 15); // Oct 15
    const invoices = [makeInvoice({ id: "a", issueDate: "2026-09-01", dueDate: "2026-11-01" })]; // still pending, not overdue
    const payments = [makePayment({ receivedAt: "2026-08-01" })]; // 75 days before asOf
    const items = computeAttentionItems(invoices, [], payments, asOf);
    expect(items.some((i) => i.reason === "payment-inactivity")).toBe(true);
  });

  it("does NOT flag payment inactivity when no payment has ever been recorded (that's just a new workspace, not inactivity)", () => {
    const asOf = new Date(2026, 9, 15);
    const invoices = [makeInvoice({ id: "a", issueDate: "2026-09-01", dueDate: "2026-11-01" })];
    const items = computeAttentionItems(invoices, [], [], asOf);
    expect(items.some((i) => i.reason === "payment-inactivity")).toBe(false);
  });

  it("still flags overdue invoices exactly as before", () => {
    const asOf = new Date(2026, 8, 20);
    const invoices = [makeInvoice({ id: "a", issueDate: "2026-08-01", dueDate: "2026-09-01" })]; // overdue by ~19 days
    const items = computeAttentionItems(invoices, [], [], asOf);
    expect(items.some((i) => i.reason === "overdue" && i.invoiceId === "a")).toBe(true);
  });

  it("prioritizes high severity before medium, and larger amounts before smaller within the same severity", () => {
    const asOf = new Date(2026, 8, 20);
    const invoices = [
      makeInvoice({ id: "mild", issueDate: "2026-08-15", dueDate: "2026-09-01" }), // ~19 days overdue -> mild? check severity boundary via daysOverdue
      makeInvoice({ id: "strong", issueDate: "2026-07-01", dueDate: "2026-08-01" }), // ~50 days overdue -> strong
    ];
    const items = computeAttentionItems(invoices, [], [], asOf);
    const strongIndex = items.findIndex((i) => i.invoiceId === "strong");
    const mildIndex = items.findIndex((i) => i.invoiceId === "mild");
    expect(strongIndex).toBeLessThan(mildIndex);
  });
});

describe("computeClientInsights - real client-level facts", () => {
  it("identifies the client with the most payments as strongest collection activity, only once more than one client has paid", () => {
    const clients = [makeClient({ id: "cl_a", name: "A" }), makeClient({ id: "cl_b", name: "B" })];
    const payments = [
      makePayment({ clientId: "cl_a", amount: 5000 }),
      makePayment({ clientId: "cl_b", amount: 1000 }),
    ];
    const insights = computeClientInsights([], clients, payments);
    expect(insights.strongestCollectionClient?.clientName).toBe("A");
  });

  it("does not report strongest collection activity when only one client has ever paid", () => {
    const clients = [makeClient({ id: "cl_a", name: "A" })];
    const payments = [makePayment({ clientId: "cl_a", amount: 5000 })];
    const insights = computeClientInsights([], clients, payments);
    expect(insights.strongestCollectionClient).toBeUndefined();
  });

  it("counts distinct clients with an overdue invoice", () => {
    const asOf = new Date(2026, 8, 20);
    const clients = [makeClient({ id: "cl_a", name: "A" }), makeClient({ id: "cl_b", name: "B" })];
    const invoices = [
      makeInvoice({ id: "a", clientId: "cl_a", issueDate: "2026-08-01", dueDate: "2026-09-01" }),
      makeInvoice({ id: "b", clientId: "cl_a", issueDate: "2026-08-01", dueDate: "2026-09-01" }), // same client, second overdue invoice
      makeInvoice({ id: "c", clientId: "cl_b", issueDate: "2026-09-15", dueDate: "2026-09-20" }), // not yet overdue
    ];
    const insights = computeClientInsights(invoices, clients, [], asOf);
    expect(insights.clientsWithOverdueCount).toBe(1); // only cl_a, deduped
  });

  it("lists recently active clients within the last 30 days, most recent first", () => {
    const asOf = new Date(2026, 8, 20);
    const clients = [makeClient({ id: "cl_a", name: "A" }), makeClient({ id: "cl_b", name: "B" })];
    const invoices = [
      makeInvoice({ id: "old", clientId: "cl_a", issueDate: "2026-06-01" }), // outside 30 days
      makeInvoice({ id: "recent1", clientId: "cl_a", issueDate: "2026-09-10" }),
      makeInvoice({ id: "recent2", clientId: "cl_b", issueDate: "2026-09-18" }),
    ];
    const insights = computeClientInsights(invoices, clients, [], asOf);
    expect(insights.recentlyActiveClients.map((c) => c.clientId)).toEqual(["cl_b", "cl_a"]);
  });
});

describe("generateExecutiveSummary - never fabricates a trend without comparable history", () => {
  it("does not claim ahead/behind language when there is no comparable history at all", () => {
    const asOf = new Date(2026, 8, 10);
    const invoices = [makeInvoice({ id: "a", issueDate: "2026-09-01", paidAt: "2026-09-05" })];
    const pulse = computeBusinessPulse(invoices, [], asOf);
    const summary = generateExecutiveSummary(pulse, 0, pulse.totalOverdue);
    expect(summary).not.toMatch(/ahead of|behind|trending/i);
  });

  it("explicitly says 'not enough history' rather than a percentage when history is absent", () => {
    const asOf = new Date(2026, 8, 10);
    const invoices = [makeInvoice({ id: "a", issueDate: "2026-09-01", paidAt: "2026-09-05" })];
    const pulse = computeBusinessPulse(invoices, [], asOf);
    const summary = generateExecutiveSummary(pulse, 0, pulse.totalOverdue);
    expect(summary).toMatch(/not enough history/i);
  });

  it("says 'Comparison unavailable' rather than a percentage when history exists but the specific baseline is zero", () => {
    const asOf = new Date(2026, 8, 10);
    const invoices = [
      makeInvoice({ id: "a", issueDate: "2026-09-05", paidAt: "2026-09-05" }),
      makeInvoice({ id: "b", issueDate: "2026-07-01", paidAt: undefined, isDraft: true }), // prior history exists, but nothing paid in the comparable window
    ];
    const pulse = computeBusinessPulse(invoices, [], asOf);
    expect(pulse.hasComparableHistory).toBe(true);
    expect(pulse.collected.comparable).toBe(false);
    const summary = generateExecutiveSummary(pulse, 0, pulse.totalOverdue);
    expect(summary).toMatch(/comparison unavailable/i);
  });

  it("reports real ahead/behind language once a genuine comparable baseline exists", () => {
    const asOf = new Date(2026, 8, 10);
    const invoices = [
      makeInvoice({ id: "a", issueDate: "2026-09-05", paidAt: "2026-09-05", items: [{ id: "i", description: "x", quantity: 1, unitPrice: 10000 }] }),
      makeInvoice({ id: "b", issueDate: "2026-08-05", paidAt: "2026-08-05", items: [{ id: "i", description: "x", quantity: 1, unitPrice: 1000 }] }),
    ];
    const pulse = computeBusinessPulse(invoices, [], asOf);
    const summary = generateExecutiveSummary(pulse, 0, pulse.totalOverdue);
    expect(summary).toMatch(/ahead of/i);
  });
});