import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, getInvoiceTotalsWithWords } from "./invoiceMath";
import { amountInWords } from "./amountInWords";

describe("getInvoiceTotalsWithWords", () => {
  const invoice = {
    items: [{ id: "li_1", description: "Item", quantity: 3, unitPrice: 8500 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 500,
    roundOff: 0.5,
  };

  it("returns a total that matches computeInvoiceTotals exactly", () => {
    const plain = computeInvoiceTotals(invoice);
    const withWords = getInvoiceTotalsWithWords(invoice);
    expect(withWords.total).toBe(plain.total);
    expect(withWords.cgstAmount).toBe(plain.cgstAmount);
    expect(withWords.sgstAmount).toBe(plain.sgstAmount);
  });

  it("derives amountInWords from the exact same total it returns - never a stale/separately-computed value", () => {
    const result = getInvoiceTotalsWithWords(invoice);
    expect(result.amountInWords).toBe(amountInWords(result.total));
  });

  it("stays consistent across a range of invoices (subtotal + CGST + SGST + roundOff => total => words)", () => {
    const cases = [
      { items: [{ id: "a", description: "x", quantity: 1, unitPrice: 25700 }], gst: { cgstRate: 0.09, sgstRate: 0.09 }, discount: 0, roundOff: 0 },
      { items: [{ id: "b", description: "y", quantity: 2, unitPrice: 999.5 }], gst: { cgstRate: 0.18, sgstRate: 0 }, discount: 100, roundOff: -0.99 },
      { items: [{ id: "c", description: "z", quantity: 5, unitPrice: 1234.56 }], gst: { cgstRate: 0.06, sgstRate: 0.06 }, discount: 0, roundOff: 0 },
    ];
    for (const invoiceCase of cases) {
      const result = getInvoiceTotalsWithWords(invoiceCase);
      const expectedTotal = Math.max(
        0,
        Math.max(0, invoiceCase.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) - invoiceCase.discount) *
          (1 + invoiceCase.gst.cgstRate + invoiceCase.gst.sgstRate) + invoiceCase.roundOff,
      );
      expect(result.total).toBeCloseTo(expectedTotal, 2);
      expect(result.amountInWords).toBe(amountInWords(result.total));
    }
  });
});

  it("derives amount-in-words from the final total after round-off, not the raw total", () => {
    const result = getInvoiceTotalsWithWords({
      items: [{ id: "rounded", description: "Item", quantity: 1, unitPrice: 25700 }],
      gst: { cgstRate: 0.09, sgstRate: 0.09 },
      discount: 0,
      roundOff: -0.5,
    });

    expect(result.rawTotal).toBe(30326);
    expect(result.total).toBe(30325.5);
    expect(result.amountInWords).toBe("Thirty Thousand Three Hundred Twenty Five Rupees and Fifty Paise Only");
    expect(result.amountInWords).not.toBe(amountInWords(result.rawTotal));
  });
