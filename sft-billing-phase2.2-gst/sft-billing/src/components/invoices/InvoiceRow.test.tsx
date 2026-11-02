import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Invoice, Payment } from "@/types";
import { InvoiceRow } from "./InvoiceRow";

function makeInvoice(id: string, number: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    number,
    clientId: `client-${id}`,
    issueDate: "2026-10-01",
    dueDate: "2030-10-01",
    items: [{ id: `item-${id}`, description: `Item for ${number}`, quantity: 1, unitPrice: 100 }],
    gst: { cgstRate: 0, sgstRate: 0 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    ...overrides,
  };
}

function InvoiceRows({ invoices, payments = [] }: { invoices: Invoice[]; payments?: Payment[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  return (
    <>
      {invoices.map((invoice) => (
        <InvoiceRow
          key={invoice.id}
          invoice={invoice}
          clients={[{
            id: invoice.clientId,
            name: `Client ${invoice.number}`,
            email: null,
            billingAddress: "Test address",
          }]}
          payments={payments}
          isSelected={selectedIds.has(invoice.id)}
          onToggleSelect={() =>
            setSelectedIds((current) => {
              const next = new Set(current);
              if (next.has(invoice.id)) next.delete(invoice.id);
              else next.add(invoice.id);
              return next;
            })
          }
          isExpanded={expandedId === invoice.id}
          onToggleExpand={() => setExpandedId((current) => current === invoice.id ? null : invoice.id)}
          onSendReminder={() => undefined}
          onSendInvoice={() => undefined}
          onRecordPayment={() => undefined}
          onEdit={() => undefined}
          onView={() => undefined}
          onDelete={() => undefined}
        />
      ))}
    </>
  );
}

describe("InvoiceRow expand/collapse", () => {
  it("expands and collapses an invoice using the chevron button", async () => {
    const user = userEvent.setup();
    const invoice = makeInvoice("invoice-1", "001/2026-27");
    render(<InvoiceRows invoices={[invoice]} />);

    const expandButton = screen.getByRole("button", { name: "Expand invoice 001/2026-27" });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Created")).not.toBeInTheDocument();

    await user.click(expandButton);
    expect(screen.getByRole("button", { name: "Collapse invoice 001/2026-27" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Created")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse invoice 001/2026-27" }));
    expect(screen.getByRole("button", { name: "Expand invoice 001/2026-27" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });

  it("shows the selected invoice's details and status for draft, outstanding, received, and overdue rows", async () => {
    const user = userEvent.setup();
    const invoices = [
      makeInvoice("draft", "001/2026-27", { isDraft: true }),
      makeInvoice("outstanding", "002/2026-27"),
      makeInvoice("received", "003/2026-27"),
      makeInvoice("overdue", "004/2026-27", { dueDate: "2020-01-01" }),
    ];
    const payments: Payment[] = [{
      id: "payment-received",
      invoiceId: "received",
      clientId: "client-received",
      amount: 100,
      method: "cash",
      receivedAt: "2026-10-02",
    }];
    render(<InvoiceRows invoices={invoices} payments={payments} />);

    for (const [number, status] of [
      ["001/2026-27", "Draft"],
      ["002/2026-27", "Outstanding"],
      ["003/2026-27", "Received"],
      ["004/2026-27", "Overdue"],
    ]) {
      await user.click(screen.getByRole("button", { name: `Expand invoice ${number}` }));
      const row = screen.getByRole("button", { name: `Collapse invoice ${number}` }).closest(".border-b");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getAllByText(status).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: `Collapse invoice ${number}` })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await user.click(screen.getByRole("button", { name: `Collapse invoice ${number}` }));
    }
  });

  it("keeps each invoice's expanded details associated with its own row", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceRows invoices={[
        makeInvoice("invoice-1", "011/2026-27"),
        makeInvoice("invoice-2", "015/2026-27", { isDraft: true }),
      ]} />,
    );

    await user.click(screen.getByRole("button", { name: "Expand invoice 015/2026-27" }));
    const expandedRow = screen.getByRole("button", { name: "Collapse invoice 015/2026-27" }).closest(".border-b");
    const collapsedRow = screen.getByRole("button", { name: "Expand invoice 011/2026-27" }).closest(".border-b");
    expect(within(expandedRow as HTMLElement).getByRole("button", { name: "Bill invoice" })).toBeInTheDocument();
    expect(within(collapsedRow as HTMLElement).queryByRole("button", { name: "Bill invoice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand invoice 011/2026-27" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("selects the checkbox without expanding the invoice", async () => {
    const user = userEvent.setup();
    const invoice = makeInvoice("invoice-1", "001/2026-27");
    render(<InvoiceRows invoices={[invoice]} />);

    await user.click(screen.getByRole("checkbox", { name: "Select invoice 001/2026-27" }));

    expect(screen.getByRole("checkbox", { name: "Select invoice 001/2026-27" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Expand invoice 001/2026-27" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });

  it("supports keyboard activation of the expand button", async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();
    const invoice = makeInvoice("invoice-1", "001/2026-27");
    render(
      <InvoiceRow
        invoice={invoice}
        clients={[]}
        payments={[]}
        isSelected={false}
        onToggleSelect={() => undefined}
        isExpanded={false}
        onToggleExpand={onToggleExpand}
        onSendReminder={() => undefined}
        onSendInvoice={() => undefined}
        onRecordPayment={() => undefined}
        onEdit={() => undefined}
        onView={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const expandButton = screen.getByRole("button", { name: "Expand invoice 001/2026-27" });
    expandButton.focus();
    await user.keyboard("{Enter}");
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});
