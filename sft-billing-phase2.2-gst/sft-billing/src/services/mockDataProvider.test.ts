import { describe, expect, it } from "vitest";
import { mockDataProvider } from "./mockDataProvider";

describe("Unit: services/dataProvider.ts interface is unchanged", () => {
  it("saveInvoice/getPayments/getInvoices signatures accept the same arguments as before, and a saved invoice's billedAt round-trips through the mock provider", async () => {
    const invoices = await mockDataProvider.getInvoices();
    expect(Array.isArray(invoices)).toBe(true);

    const payments = await mockDataProvider.getPayments();
    expect(Array.isArray(payments)).toBe(true);

    const existing = invoices[0];
    const now = new Date().toISOString();
    const billed = { ...existing, isDraft: false, billedAt: now };

    const saved = await mockDataProvider.saveInvoice(billed);
    expect(saved.billedAt).toBe(now);

    const reloaded = await mockDataProvider.getInvoices();
    const found = reloaded.find((i) => i.id === billed.id);
    expect(found?.billedAt).toBe(now);
  });
});

describe("draft lifecycle persistence", () => {
  it("saves a draft without promoting it to a billed invoice", async () => {
    const existing = (await mockDataProvider.getInvoices())[0];
    const draft = {
      ...existing,
      id: "iv_lifecycle_draft_test",
      number: "INV-LIFECYCLE-DRAFT",
      isDraft: true,
      billedAt: undefined,
      sentAt: undefined,
    };

    await mockDataProvider.saveInvoice(draft);
    const saved = (await mockDataProvider.getInvoices()).find((invoice) => invoice.id === draft.id);

    expect(saved).toMatchObject({
      id: draft.id,
      number: draft.number,
      isDraft: true,
      billedAt: undefined,
      sentAt: undefined,
    });
  });
});
