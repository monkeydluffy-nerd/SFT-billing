import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { SendReminderModal } from "./SendReminderModal";
import { activeDataProvider } from "@/services";
import { mockClients } from "@/data/mockClients";
import type { ActivityEvent, Invoice } from "@/types";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_1",
    number: "INV-1",
    clientId: "cl_acme",
    issueDate: "2025-05-01T00:00:00.000Z",
    dueDate: "2025-05-20T00:00:00.000Z",
    items: [{ id: "li_1", description: "Consulting", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2025-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Feature: core-business-system, Property 9: Confirming a reminder records exactly one event; cancelling records none", () => {
  it("confirming appends exactly one invoice_reminder_sent event for that invoice; cancelling appends none", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.nat(), async (shouldConfirm, seed) => {
        const invoice = makeInvoice({ id: `iv_rem_${seed}` });
        const activityLog: ActivityEvent[] = [];

        vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);
        vi.spyOn(activeDataProvider, "addActivityEvent").mockImplementation(async (event) => {
          const full: ActivityEvent = { ...event, id: `ev_${activityLog.length}` };
          activityLog.push(full);
          return full;
        });

        const onSent = vi.fn();
        const onClose = vi.fn();
        const { findByRole, unmount } = render(
          <SendReminderModal open onClose={onClose} invoice={invoice} onSent={onSent} />,
        );

        await findByRole("dialog");
        const before = activityLog.length;

        if (shouldConfirm) {
          const confirmButton = await findByRole("button", { name: /^Send reminder$/i });
          fireEvent.click(confirmButton);
          await waitFor(() => expect(activityLog.length).toBe(before + 1));
          expect(activityLog[activityLog.length - 1].type).toBe("invoice_reminder_sent");
          expect(activityLog[activityLog.length - 1].invoiceId).toBe(invoice.id);
        } else {
          const cancelButton = await findByRole("button", { name: /^Cancel$/i });
          fireEvent.click(cancelButton);
          expect(activityLog.length).toBe(before);
          expect(onClose).toHaveBeenCalled();
        }

        unmount();
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  }, 30000);
});

describe("Unit: reminder modal wording", () => {
  it("exposes review/edit/confirm/cancel controls and the no-email disclosure", async () => {
    const invoice = makeInvoice();
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue(mockClients);

    render(<SendReminderModal open onClose={() => {}} invoice={invoice} onSent={() => {}} />);

    expect(await screen.findByRole("textbox")).toBeInTheDocument(); // editable review
    expect(screen.getByRole("button", { name: /^Send reminder$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cancel$/i })).toBeInTheDocument();
    expect(screen.getByText(/no email is actually sent/i)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
