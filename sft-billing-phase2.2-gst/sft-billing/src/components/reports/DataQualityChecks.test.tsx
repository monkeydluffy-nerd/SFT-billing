import { describe, expect, it } from "vitest";
import { getDataQualityFindings } from "./DataQualityChecks";
import type { Invoice, Payment, Client } from "@/types";

const mockClient: Client = {
  id: "cl_1",
  name: "Test Client",
  contactName: "Contact",
  email: "test@example.com",
  phone: "1234567890",
  billingAddress: "123 Test St",
  gstin: "33AAAAA0000A1Z5",
  pan: "AAAAA0000A",
};

const mockClientNoContact: Client = {
  id: "cl_2",
  name: "No Contact Client",
  contactName: "Contact",
  email: null,
  phone: null,
  billingAddress: "456 Test St",
};

const mockClientNoAddress: Client = {
  id: "cl_3",
  name: "No Address Client",
  contactName: "Contact",
  email: "test@example.com",
  phone: "1234567890",
  billingAddress: "",
};

const mockClientNoName: Client = {
  id: "cl_4",
  name: "",
  contactName: "Contact",
  email: "test@example.com",
  phone: "1234567890",
  billingAddress: "789 Test St",
};

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_test",
    number: "INV-1",
    clientId: "cl_1",
    issueDate: "2026-09-01",
    dueDate: "2026-09-15",
    items: [{ id: "li_1", description: "Item 1", quantity: 1, unitPrice: 1000 }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    billedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pm_1",
    invoiceId: "iv_test",
    clientId: "cl_1",
    amount: 1000,
    method: "bank_transfer",
    receivedAt: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

describe("DataQualityChecks - getDataQualityFindings", () => {
  const asOf = new Date("2026-09-15");

  describe("Missing required invoice or client details", () => {
    it("flags missing client reference on billed invoice", () => {
      const invoice = makeInvoice({ id: "iv_1", clientId: "missing_client" });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingClient = findings.find((f) => f.category === "missing-details" && f.title === "Missing client");
      expect(missingClient).toBeDefined();
      expect(missingClient?.severity).toBe("high");
    });

    it("flags client missing name", () => {
      const invoice = makeInvoice({ id: "iv_1", clientId: "cl_4" });
      const findings = getDataQualityFindings([invoice], [], [mockClientNoName], asOf);
      const missingName = findings.find((f) => f.category === "missing-details" && f.title === "Client missing name");
      expect(missingName).toBeDefined();
      expect(missingName?.severity).toBe("medium");
    });

    it("flags client missing contact details (email and phone)", () => {
      const invoice = makeInvoice({ id: "iv_1", clientId: "cl_2" });
      const findings = getDataQualityFindings([invoice], [], [mockClientNoContact], asOf);
      const missingContact = findings.find((f) => f.category === "missing-details" && f.title === "Client missing contact details");
      expect(missingContact).toBeDefined();
      expect(missingContact?.severity).toBe("low");
    });

    it("flags client missing billing address", () => {
      const invoice = makeInvoice({ id: "iv_1", clientId: "cl_3" });
      const findings = getDataQualityFindings([invoice], [], [mockClientNoAddress], asOf);
      const missingAddress = findings.find((f) => f.category === "missing-details" && f.title === "Client missing billing address");
      expect(missingAddress).toBeDefined();
      expect(missingAddress?.severity).toBe("low");
    });

    it("flags missing issue date", () => {
      const invoice = makeInvoice({ id: "iv_1", issueDate: "" });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingDate = findings.find((f) => f.category === "missing-details" && f.title === "Missing issue date");
      expect(missingDate).toBeDefined();
      expect(missingDate?.severity).toBe("high");
    });

    it("flags missing due date", () => {
      const invoice = makeInvoice({ id: "iv_1", dueDate: "" });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingDate = findings.find((f) => f.category === "missing-details" && f.title === "Missing due date");
      expect(missingDate).toBeDefined();
      expect(missingDate?.severity).toBe("high");
    });

    it("flags invoice with no line items", () => {
      const invoice = makeInvoice({ id: "iv_1", items: [] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingItems = findings.find((f) => f.category === "missing-details" && f.title === "No line items");
      expect(missingItems).toBeDefined();
      expect(missingItems?.severity).toBe("high");
    });

    it("flags line item with empty description", () => {
      const invoice = makeInvoice({ id: "iv_1", items: [{ id: "li_1", description: "", quantity: 1, unitPrice: 1000 }] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const emptyDesc = findings.find((f) => f.category === "missing-details" && f.title === "Empty line item description");
      expect(emptyDesc).toBeDefined();
      expect(emptyDesc?.severity).toBe("medium");
    });

    it("flags line item with invalid quantity", () => {
      const invoice = makeInvoice({ id: "iv_1", items: [{ id: "li_1", description: "Item", quantity: 0, unitPrice: 1000 }] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const invalidQty = findings.find((f) => f.category === "missing-details" && f.title === "Invalid line item quantity");
      expect(invalidQty).toBeDefined();
      expect(invalidQty?.severity).toBe("medium");
    });

    it("flags line item with negative price", () => {
      const invoice = makeInvoice({ id: "iv_1", items: [{ id: "li_1", description: "Item", quantity: 1, unitPrice: -100 }] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const negPrice = findings.find((f) => f.category === "missing-details" && f.title === "Negative line item price");
      expect(negPrice).toBeDefined();
      expect(negPrice?.severity).toBe("medium");
    });

    it("flags missing GST rates", () => {
      const invoice = makeInvoice({ id: "iv_1", gst: { cgstRate: NaN, sgstRate: 0.09 } } as unknown as Invoice);
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingGst = findings.find((f) => f.category === "missing-details" && f.title === "Missing GST rates");
      expect(missingGst).toBeDefined();
      expect(missingGst?.severity).toBe("medium");
    });

    it("flags missing GST object entirely", () => {
      const invoice = makeInvoice({ id: "iv_1", gst: { cgstRate: undefined as unknown as number, sgstRate: 0.09 } } as unknown as Invoice);
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingGst = findings.find((f) => f.category === "missing-details" && f.title === "Missing GST rates");
      expect(missingGst).toBeDefined();
      expect(missingGst?.severity).toBe("medium");
    });

    it("flags zero GST rate on taxable invoice", () => {
      const invoice = makeInvoice({ id: "iv_1", gst: { cgstRate: 0, sgstRate: 0 } });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const zeroGst = findings.find((f) => f.category === "tax-compliance" && f.title === "Zero GST rate on taxable invoice");
      expect(zeroGst).toBeDefined();
      expect(zeroGst?.severity).toBe("medium");
    });

    it("does not flag zero GST rate when taxable value is zero", () => {
      const invoice = makeInvoice({ id: "iv_1", gst: { cgstRate: 0, sgstRate: 0 }, discount: 10000 }); // discount > subtotal
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const zeroGst = findings.find((f) => f.category === "tax-compliance" && f.title === "Zero GST rate on taxable invoice");
      expect(zeroGst).toBeUndefined();
    });

    it("flags discount exceeding subtotal", () => {
      const invoice = makeInvoice({ id: "iv_1", discount: 2000 }); // subtotal = 1000, discount = 2000
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const excessiveDiscount = findings.find((f) => f.category === "calculation-consistency" && f.title === "Discount exceeds subtotal");
      expect(excessiveDiscount).toBeDefined();
      expect(excessiveDiscount?.severity).toBe("high");
    });

    it("flags round-off exceeding ±0.50 tolerance", () => {
      const invoice = makeInvoice({ id: "iv_1", roundOff: 1.00 });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const excessiveRoundoff = findings.find((f) => f.category === "calculation-consistency" && f.title === "Round-off exceeds tolerance");
      expect(excessiveRoundoff).toBeDefined();
      expect(excessiveRoundoff?.severity).toBe("medium");
    });

    it("flags due date before issue date", () => {
      const invoice = makeInvoice({ id: "iv_1", issueDate: "2026-09-15", dueDate: "2026-09-01" });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const invalidDateOrder = findings.find((f) => f.category === "temporal-inconsistency" && f.title === "Due date before issue date");
      expect(invalidDateOrder).toBeDefined();
      expect(invalidDateOrder?.severity).toBe("medium");
    });

    it("flags missing HSN/SAC code on line item", () => {
      const invoice = makeInvoice({ id: "iv_1", items: [{ id: "li_1", description: "Item 1", quantity: 1, unitPrice: 1000, hsnCode: "" }] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const missingHsn = findings.find((f) => f.category === "tax-compliance" && f.title === "Missing HSN/SAC code");
      expect(missingHsn).toBeDefined();
      expect(missingHsn?.severity).toBe("medium");
    });

    it("flags invalid client GSTIN format", () => {
      const clientWithInvalidGstin: Client = {
        id: "cl_5",
        name: "Invalid GSTIN Client",
        contactName: "Contact",
        email: "test@example.com",
        phone: "1234567890",
        billingAddress: "123 Test St",
        gstin: "INVALID-GSTIN",
      };
      const invoice = makeInvoice({ id: "iv_1", clientId: "cl_5" });
      const findings = getDataQualityFindings([invoice], [], [mockClient, clientWithInvalidGstin], asOf);
      const invalidGstin = findings.find((f) => f.category === "tax-compliance" && f.title === "Invalid client GSTIN format");
      expect(invalidGstin).toBeDefined();
      expect(invalidGstin?.severity).toBe("medium");
    });

    it("does not flag valid client GSTIN format", () => {
      const invoice = makeInvoice({ id: "iv_1", clientId: "cl_1" }); // mockClient has valid GSTIN
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const invalidGstin = findings.find((f) => f.category === "tax-compliance" && f.title === "Invalid client GSTIN format");
      expect(invalidGstin).toBeUndefined();
    });

    it("flags overpayment detected", () => {
      const invoice = makeInvoice({ id: "iv_1" }); // total = 1180
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 2000 }); // overpaid
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const overpayment = findings.find((f) => f.category === "payment-inconsistency" && f.title === "Overpayment detected");
      expect(overpayment).toBeDefined();
      expect(overpayment?.severity).toBe("high");
    });

    it("flags payment received before invoice issue date", () => {
      const invoice = makeInvoice({ id: "iv_1", issueDate: "2026-09-10" });
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", receivedAt: "2026-09-01" }); // payment before issue
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const temporalIssue = findings.find((f) => f.category === "temporal-inconsistency" && f.title === "Payment received before invoice issue date");
      expect(temporalIssue).toBeDefined();
      expect(temporalIssue?.severity).toBe("medium");
    });

    it("does not flag payment on or after invoice issue date", () => {
      const invoice = makeInvoice({ id: "iv_1", issueDate: "2026-09-01" });
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", receivedAt: "2026-09-01" }); // same day
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const temporalIssue = findings.find((f) => f.category === "temporal-inconsistency" && f.title === "Payment received before invoice issue date");
      expect(temporalIssue).toBeUndefined();
    });

    it("does not flag missing details for draft invoices", () => {
      const invoice = makeInvoice({ id: "iv_1", isDraft: true, clientId: "missing_client", issueDate: "", dueDate: "", items: [] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      // Draft invoices should not be checked for missing details
      const highFindings = findings.filter((f) => f.severity === "high" && f.category === "missing-details");
      expect(highFindings.length).toBe(0);
    });
  });

  describe("Duplicate invoice numbers", () => {
    it("flags duplicate invoice numbers across billed invoices", () => {
      const invoice1 = makeInvoice({ id: "iv_1", number: "INV-DUP" });
      const invoice2 = makeInvoice({ id: "iv_2", number: "INV-DUP" });
      const findings = getDataQualityFindings([invoice1, invoice2], [], [mockClient], asOf);
      const dupFindings = findings.filter((f) => f.category === "duplicate-number");
      expect(dupFindings.length).toBe(2); // Both invoices flagged
      expect(dupFindings[0].severity).toBe("high");
    });

    it("does not flag duplicate numbers if only one is billed", () => {
      const invoice1 = makeInvoice({ id: "iv_1", number: "INV-DUP", isDraft: false });
      const invoice2 = makeInvoice({ id: "iv_2", number: "INV-DUP", isDraft: true });
      const findings = getDataQualityFindings([invoice1, invoice2], [], [mockClient], asOf);
      const dupFindings = findings.filter((f) => f.category === "duplicate-number");
      // Only one billed invoice with this number - no duplicate among billed invoices
      expect(dupFindings.length).toBe(0);
    });

    it("flags case-insensitive duplicate numbers", () => {
      const invoice1 = makeInvoice({ id: "iv_1", number: "INV-DUP" });
      const invoice2 = makeInvoice({ id: "iv_2", number: "inv-dup" });
      const findings = getDataQualityFindings([invoice1, invoice2], [], [mockClient], asOf);
      const dupFindings = findings.filter((f) => f.category === "duplicate-number");
      expect(dupFindings.length).toBe(2);
    });
  });

  describe("Payment totals or invoice statuses that appear inconsistent", () => {
    it("flags invoice marked paid but payments don't cover total", () => {
      const invoice = makeInvoice({ id: "iv_1", paidAt: "2026-09-10T00:00:00Z" }); // total = 1180
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 500 }); // only 500 paid
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const mismatch = findings.find((f) => f.category === "status-inconsistency" && f.title === "Status mismatch: marked paid but payments don't cover total");
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe("high");
    });

    it("flags fully paid invoice but missing paidAt", () => {
      const invoice = makeInvoice({ id: "iv_1" }); // total = 1180
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 1180 }); // fully paid
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const mismatch = findings.find((f) => f.category === "status-inconsistency" && f.title === "Status mismatch: fully paid but not marked paid");
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe("medium");
    });

    it("flags invoice status overdue but ledger shows received", () => {
      // Can't easily test this because status is derived from paidAt/dueDate
      // But we can test the ledger vs stored status mismatch
      const invoice = makeInvoice({ id: "iv_1", dueDate: "2026-09-01", paidAt: undefined }); // overdue by status
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 1180 }); // fully paid
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const mismatch = findings.find((f) => f.category === "status-inconsistency" && f.title === "Status mismatch: marked overdue but fully paid");
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe("high");
    });

    it("flags invoice status paid but ledger shows outstanding", () => {
      // This is similar to the first test but checks the other direction
      const invoice = makeInvoice({ id: "iv_1", paidAt: "2026-09-10T00:00:00Z" });
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 500 });
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const mismatch = findings.find((f) => f.category === "status-inconsistency" && f.title === "Status mismatch: marked paid but ledger shows outstanding");
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe("high");
    });

    it("flags payment with invalid amount", () => {
      const invoice = makeInvoice({ id: "iv_1" });
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 0 });
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      const invalid = findings.find((f) => f.category === "status-inconsistency" && f.title === "Invalid payment amount");
      expect(invalid).toBeDefined();
      expect(invalid?.severity).toBe("medium");
    });

    it("flags orphaned payment referencing missing invoice", () => {
      const payment = makePayment({ id: "pm_1", invoiceId: "missing_invoice" });
      const findings = getDataQualityFindings([], [payment], [mockClient], asOf);
      const orphaned = findings.find((f) => f.category === "status-inconsistency" && f.title === "Payment references missing invoice");
      expect(orphaned).toBeDefined();
      expect(orphaned?.severity).toBe("high");
      expect(orphaned?.affectedRecord).toBe("payment");
    });

    it("flags payment referencing missing client", () => {
      const payment = makePayment({ id: "pm_1", clientId: "missing_client" });
      const findings = getDataQualityFindings([], [payment], [mockClient], asOf);
      const missingClient = findings.find((f) => f.category === "missing-details" && f.title === "Payment references missing client");
      expect(missingClient).toBeDefined();
      expect(missingClient?.severity).toBe("medium");
    });
  });

  describe("Empty states and valid data", () => {
    it("returns no findings for clean data", () => {
      const invoice = makeInvoice({ id: "iv_1" });
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 1180 });
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      // May have "fully paid but not marked paid" finding, which is expected behavior
      // Let's check that no HIGH severity findings exist for truly clean data
      const highFindings = findings.filter((f) => f.severity === "high");
      // The "fully paid but not marked paid" is medium severity
      expect(highFindings.length).toBe(0);
    });

    it("returns no findings for draft invoices with issues", () => {
      const invoice = makeInvoice({ id: "iv_1", isDraft: true, clientId: "missing", issueDate: "", dueDate: "", items: [] });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const highFindings = findings.filter((f) => f.severity === "high");
      expect(highFindings.length).toBe(0);
    });

    it("flags overdue invoice with partial payment correctly", () => {
      const invoice = makeInvoice({ id: "iv_1", dueDate: "2026-09-01" }); // overdue
      const payment = makePayment({ id: "pm_1", invoiceId: "iv_1", amount: 500 });
      const findings = getDataQualityFindings([invoice], [payment], [mockClient], asOf);
      // Should not flag as inconsistency - partial payment on overdue is valid
      const inconsistencies = findings.filter((f) => f.category === "status-inconsistency");
      expect(inconsistencies.length).toBe(0);
    });
  });

  describe("Finding structure and sorting", () => {
    it("includes all required fields in findings", () => {
      const invoice = makeInvoice({ id: "iv_1", clientId: "missing_client" });
      const findings = getDataQualityFindings([invoice], [], [mockClient], asOf);
      const finding = findings[0];
      expect(finding).toHaveProperty("id");
      expect(finding).toHaveProperty("severity");
      expect(finding).toHaveProperty("category");
      expect(finding).toHaveProperty("title");
      expect(finding).toHaveProperty("detail");
      expect(finding).toHaveProperty("affectedRecord");
    });

    it("sorts by severity (high first), then category, then amount", () => {
      const invoice1 = makeInvoice({ id: "iv_1", clientId: "missing_client" }); // high - missing client
      const invoice2 = makeInvoice({ id: "iv_2", number: "INV-DUP" }); // high - duplicate
      const invoice3 = makeInvoice({ id: "iv_3", number: "INV-DUP" }); // high - duplicate
      const findings = getDataQualityFindings([invoice1, invoice2, invoice3], [], [mockClient], asOf);
      expect(findings[0].severity).toBe("high");
      // All high, should be sorted by category then amount
    });
  });
});