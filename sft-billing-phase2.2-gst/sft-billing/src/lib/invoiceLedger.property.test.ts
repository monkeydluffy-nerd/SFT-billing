import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeInvoiceTotals, getClientRollup, getGlobalRollup, getInvoiceLedgerStatus } from "./invoiceMath";
import type { Invoice, Payment } from "@/types";

const asOf = new Date("2025-06-15T00:00:00.000Z");

function invoiceArb(overrides: Partial<Invoice> = {}) {
  return fc
    .record({
      id: fc.uuid(),
      number: fc.string({ minLength: 1, maxLength: 8 }).map((s) => `INV-${s}`),
      clientId: fc.constantFrom("cl_1", "cl_2", "cl_3"),
      issueDate: fc.constant("2025-05-01T00:00:00.000Z"),
      dueDateOffsetDays: fc.integer({ min: -60, max: 60 }),
      quantity: fc.integer({ min: 1, max: 20 }),
      unitPrice: fc.integer({ min: 1, max: 100000 }),
      cgstRate: fc.constantFrom(0, 0.09, 0.06),
      sgstRate: fc.constantFrom(0, 0.09, 0.06),
      discount: fc.integer({ min: 0, max: 5000 }),
      roundOff: fc.integer({ min: -5, max: 5 }),
      isDraft: fc.boolean(),
    })
    .map(({ dueDateOffsetDays, quantity, unitPrice, cgstRate, sgstRate, ...rest }) => {
      const due = new Date(asOf.getTime() + dueDateOffsetDays * 86400000);
      const invoice: Invoice = {
        ...rest,
        dueDate: due.toISOString(),
        items: [{ id: "li_1", description: "Item", quantity, unitPrice }],
        gst: { cgstRate, sgstRate },
        ...overrides,
      };
      return invoice;
    });
}

describe("Feature: core-business-system, Property 7: Ledger status is a pure function of payment sum, total, and due date", () => {
  it("reports received/outstanding/overdue per the sum-vs-total and due-date rule", () => {
    fc.assert(
      fc.property(invoiceArb({ isDraft: false }), fc.array(fc.integer({ min: 0, max: 200000 }), { maxLength: 5 }), (invoice, amounts) => {
        const payments: Payment[] = amounts.map((amount, i) => ({
          id: `pm_${i}`,
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          amount,
          method: "bank_transfer",
          receivedAt: asOf.toISOString(),
        }));
        const { total } = computeInvoiceTotals(invoice);
        const paidSum = amounts.reduce((s, a) => s + a, 0);
        const result = getInvoiceLedgerStatus(invoice, payments, asOf);
        expect(result).not.toBeNull();
        if (!result) return;

        if (paidSum >= total) {
          expect(result.status).toBe("received");
        } else {
          const due = new Date(invoice.dueDate);
          const daysPastDue = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
          if (daysPastDue <= 0) {
            expect(result.status).toBe("outstanding");
          } else {
            expect(result.status).toBe("overdue");
            expect(result.daysOverdue).toBe(daysPastDue);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: core-business-system, Property 8: Ledger status is independent of the legacy paidAt flag", () => {
  it("produces the same result regardless of paidAt", () => {
    fc.assert(
      fc.property(
        invoiceArb({ isDraft: false }),
        fc.array(fc.integer({ min: 0, max: 200000 }), { maxLength: 5 }),
        fc.option(fc.constant("2025-01-01T00:00:00.000Z"), { nil: undefined }),
        (invoice, amounts, paidAt) => {
          const payments: Payment[] = amounts.map((amount, i) => ({
            id: `pm_${i}`,
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            amount,
            method: "bank_transfer",
            receivedAt: asOf.toISOString(),
          }));
          const withoutPaidAt = getInvoiceLedgerStatus({ ...invoice, paidAt: undefined }, payments, asOf);
          const withPaidAt = getInvoiceLedgerStatus({ ...invoice, paidAt }, payments, asOf);
          expect(withPaidAt).toEqual(withoutPaidAt);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: core-business-system, Property 14: Client and global rollups equal the sum of non-draft invoices, partitioned by ledger status", () => {
  it("getClientRollup partitions non-draft invoices' totals by ledger status", () => {
    fc.assert(
      fc.property(fc.array(invoiceArb(), { maxLength: 8 }), (invoices) => {
        const uniqueInvoices = invoices.map((inv, i) => ({ ...inv, id: `inv_${i}` }));
        const allPayments: Payment[] = uniqueInvoices.flatMap((inv) =>
          inv.isDraft
            ? []
            : [{ id: `pm_${inv.id}`, invoiceId: inv.id, clientId: inv.clientId, amount: 0, method: "bank_transfer" as const, receivedAt: asOf.toISOString() }],
        );

        for (const clientId of ["cl_1", "cl_2", "cl_3"]) {
          const rollup = getClientRollup(clientId, uniqueInvoices, allPayments, asOf);
          const nonDraft = uniqueInvoices.filter((i) => i.clientId === clientId && !i.isDraft);
          const expectedBilled = nonDraft.reduce((s, i) => s + computeInvoiceTotals(i).total, 0);
          expect(rollup.totalBilled).toBeCloseTo(expectedBilled, 5);

          let expectedReceived = 0;
          let expectedOutstanding = 0;
          let expectedOverdue = 0;
          for (const inv of nonDraft) {
            const { total } = computeInvoiceTotals(inv);
            const ledgerInfo = getInvoiceLedgerStatus(inv, allPayments, asOf);
            expect(ledgerInfo).not.toBeNull();
            if (!ledgerInfo) continue;
            const status = ledgerInfo.status;
            if (status === "received") expectedReceived += total;
            else if (status === "outstanding") expectedOutstanding += total;
            else expectedOverdue += total;
          }
          expect(rollup.totalReceived).toBeCloseTo(expectedReceived, 5);
          expect(rollup.totalOutstanding).toBeCloseTo(expectedOutstanding, 5);
          expect(rollup.totalOverdue).toBeCloseTo(expectedOverdue, 5);
          expect(rollup.totalReceived + rollup.totalOutstanding + rollup.totalOverdue).toBeCloseTo(rollup.totalBilled, 5);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("getGlobalRollup partitions all non-draft invoices' totals by ledger status", () => {
    fc.assert(
      fc.property(fc.array(invoiceArb(), { maxLength: 8 }), (invoices) => {
        const uniqueInvoices = invoices.map((inv, i) => ({ ...inv, id: `inv_${i}` }));
        const rollup = getGlobalRollup(uniqueInvoices, [], asOf);
        const nonDraft = uniqueInvoices.filter((i) => !i.isDraft);
        const expectedBilled = nonDraft.reduce((s, i) => s + computeInvoiceTotals(i).total, 0);
        expect(rollup.totalBilled).toBeCloseTo(expectedBilled, 5);
        expect(rollup.totalReceived + rollup.totalOutstanding + rollup.totalOverdue).toBeCloseTo(rollup.totalBilled, 5);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Feature: core-business-system, Property 15: Draft invoices never affect any rollup, ledger total, or overview metric — until they are billed", () => {
  it("adding a draft invoice does not change client/global rollups; billing it includes it", () => {
    fc.assert(
      fc.property(fc.array(invoiceArb({ isDraft: false }), { maxLength: 6 }), invoiceArb(), (billedInvoices, extraDraft) => {
        const base = billedInvoices.map((inv, i) => ({ ...inv, id: `base_${i}` }));
        const draft: Invoice = { ...extraDraft, id: "extra_draft", isDraft: true, billedAt: undefined };

        const rollupBefore = getGlobalRollup(base, []);
        const rollupWithDraft = getGlobalRollup([...base, draft], []);
        expect(rollupWithDraft).toEqual(rollupBefore);

        const clientRollupBefore = getClientRollup(draft.clientId, base, []);
        const clientRollupWithDraft = getClientRollup(draft.clientId, [...base, draft], []);
        expect(clientRollupWithDraft).toEqual(clientRollupBefore);

        // Once billed, it's included from that point forward.
        const billed: Invoice = { ...draft, isDraft: false, billedAt: "2025-06-01T00:00:00.000Z" };
        const rollupAfterBilling = getGlobalRollup([...base, billed], []);
        const expectedTotal = computeInvoiceTotals(billed).total;
        expect(rollupAfterBilling.totalBilled).toBeCloseTo(rollupBefore.totalBilled + expectedTotal, 5);
      }),
      { numRuns: 100 },
    );
  });
});
