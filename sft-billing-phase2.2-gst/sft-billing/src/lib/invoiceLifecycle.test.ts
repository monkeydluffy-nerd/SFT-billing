import { describe, expect, it } from "vitest";
import type { Invoice } from "@/types";
import { billInvoice } from "./invoiceLifecycle";

function makeDraft(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_draft_1",
    number: "INV-1001",
    clientId: "client-1",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-16T00:00:00.000Z",
    items: [{ id: "line-1", description: "Consulting", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: true,
    ...overrides,
  };
}

describe("billInvoice", () => {
  it("marks a draft as billed with the supplied timestamp and preserves sentAt", () => {
    const sentAt = "2025-05-02T10:00:00.000Z";
    const draft = makeDraft({ sentAt });
    const billedAt = "2025-05-03T10:00:00.000Z";

    const billed = billInvoice(draft, billedAt);

    expect(billed).not.toBe(draft);
    expect(billed.isDraft).toBe(false);
    expect(billed.billedAt).toBe(billedAt);
    expect(billed.sentAt).toBe(sentAt);
    expect({ ...billed, isDraft: draft.isDraft, billedAt: undefined }).toEqual(draft);
  });

  it("does not invent sentAt when the draft has not been sent", () => {
    const billed = billInvoice(makeDraft(), "2025-05-03T10:00:00.000Z");

    expect(billed.sentAt).toBeUndefined();
  });
});
