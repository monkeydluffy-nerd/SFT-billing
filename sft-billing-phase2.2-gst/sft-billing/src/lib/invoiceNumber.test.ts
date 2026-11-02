import { describe, expect, it } from "vitest";
import type { Invoice } from "@/types";
import { createDraftInvoice, resolveInvoiceDraft } from "./invoiceDraft";
import { nextInvoiceNumber } from "./invoiceNumber";

function makeInvoice(number: string, isDraft: boolean, id = number): Invoice {
  return {
    id,
    number,
    clientId: "client-1",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-16T00:00:00.000Z",
    items: [{ id: `${id}-line`, description: "Consulting", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft,
    billedAt: isDraft ? undefined : "2025-05-01T00:00:00.000Z",
  };
}

describe("invoice number allocation", () => {
  it("scans assigned draft and billed numbers before choosing the next number", () => {
    const existing = [makeInvoice("INV-1001", false), makeInvoice("INV-1004", true)];

    expect(nextInvoiceNumber(existing)).toBe("INV-1005");
  });

  it("does not reuse an assigned number when a draft remains editable", () => {
    const draft = makeInvoice("INV-1005", true, "draft-1");
    const next = createDraftInvoice([draft]);

    expect(next.number).toBe("INV-1006");
    expect(next.isDraft).toBe(true);
    expect(draft.number).toBe("INV-1005");
    expect(resolveInvoiceDraft([draft, next], { invoiceId: draft.id })).toBe(draft);
  });

  it("starts after the default sequence when no numbers are assigned", () => {
    expect(nextInvoiceNumber([])).toBe("INV-1001");
  });
});

  it("allocates a stable consecutive sequence while preserving earlier draft numbers", () => {
    const firstDraft = createDraftInvoice([]);
    const secondDraft = createDraftInvoice([firstDraft]);
    const thirdDraft = createDraftInvoice([firstDraft, secondDraft]);
    const numbers = [firstDraft.number, secondDraft.number, thirdDraft.number];

    expect(numbers).toEqual(["INV-1001", "INV-1002", "INV-1003"]);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(firstDraft.number).toBe("INV-1001");
    expect(firstDraft.isDraft).toBe(true);
  });
