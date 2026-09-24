import { describe, expect, it, vi } from "vitest";
import { runAuraCommand } from "./auraAssistant";
import { mockInvoices } from "@/data/mockInvoices";
import { mockClients } from "@/data/mockClients";
import { mockPayments } from "@/data/mockPayments";
import { computeInvoiceTotals } from "./invoiceMath";
import { computeStatusTotals } from "./overviewMetrics";

/**
 * Exercises AURA against the REAL seeded app dataset (not hand-built
 * fixtures) so these tests fail if AURA's answer ever drifts from what
 * the rest of the app (Overview/Reports) would compute for the same data.
 */
describe("runAuraCommand - billing questions AURA must answer directly", () => {
  const ctx = {
    invoices: mockInvoices,
    clients: mockClients,
    payments: mockPayments,
    goToInvoices: vi.fn(),
    openCreateInvoice: vi.fn(),
  };

  it('answers "show me the total bill" with the real total billed amount, never the fallback', () => {
    const reply = runAuraCommand("show me the total bill", ctx);
    expect(reply.text).not.toMatch(/don't have that one/i);
    const expectedTotal = mockInvoices.filter((i) => !i.isDraft).reduce((sum, i) => sum + computeInvoiceTotals(i).total, 0);
    expect(reply.text).toContain("Total billed");
    // The formatted currency string must contain the correct rupee figure (compact form is fine, e.g. lakhs grouping).
    expect(reply.text.replace(/[^\d]/g, "")).toContain(String(Math.round(expectedTotal)));
  });

  it('answers "what is the total billed amount?" the same way', () => {
    const reply = runAuraCommand("what is the total billed amount?", ctx);
    expect(reply.text).toContain("Total billed");
  });

  it('answers "how much is outstanding?" with a real figure, not the fallback', () => {
    const reply = runAuraCommand("how much is outstanding?", ctx);
    expect(reply.text).not.toMatch(/don't have that one/i);
    const totals = computeStatusTotals(mockInvoices);
    const expectedOutstanding = totals.pending.amount + totals.overdue.amount;
    expect(reply.text.replace(/[^\d]/g, "")).toContain(String(Math.round(expectedOutstanding)));
  });

  it('answers "how much have we collected?" with the real sum of payments', () => {
    const reply = runAuraCommand("how much have we collected?", ctx);
    expect(reply.text).not.toMatch(/don't have that one/i);
    const expectedCollected = mockPayments.reduce((sum, p) => sum + p.amount, 0);
    expect(reply.text.replace(/[^\d]/g, "")).toContain(String(Math.round(expectedCollected)));
  });

  it('answers "how many invoices do we have?" with the real count', () => {
    const reply = runAuraCommand("how many invoices do we have?", ctx);
    expect(reply.text).toContain(String(mockInvoices.length));
  });

  it('answers "how many clients do we have?" with the real count', () => {
    const reply = runAuraCommand("how many clients do we have?", ctx);
    expect(reply.text).toContain(String(mockClients.length));
  });

  it('"show overdue invoices" navigates to Invoices filtered to overdue and states a real count', () => {
    const reply = runAuraCommand("show overdue invoices", ctx);
    expect(ctx.goToInvoices).toHaveBeenCalledWith("overdue");
    const totals = computeStatusTotals(mockInvoices);
    expect(reply.text).toContain(String(totals.overdue.count));
  });

  it('"show pending invoices" navigates to Invoices filtered to pending', () => {
    const reply = runAuraCommand("show pending invoices", ctx);
    expect(ctx.goToInvoices).toHaveBeenCalledWith("pending");
    expect(reply.didAct).toBe(true);
  });

  it("only falls back to the unsupported-capability message for genuinely unsupported requests", () => {
    const reply = runAuraCommand("what is the weather today", ctx);
    expect(reply.text).toMatch(/don't have that one/i);
  });
});