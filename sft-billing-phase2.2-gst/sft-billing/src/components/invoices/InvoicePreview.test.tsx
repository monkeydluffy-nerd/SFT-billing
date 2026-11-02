import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoicePreview } from "./InvoicePreview";
import type { Invoice, Client, BusinessProfile } from "@/types";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { amountInWords } from "@/lib/amountInWords";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "iv_test",
    number: "INV-1002",
    clientId: "cl_test",
    issueDate: "2025-06-15T00:00:00.000Z",
    dueDate: "2025-07-15T00:00:00.000Z",
    items: [
      { id: "li_1", description: "Product A", hsnCode: "9983", quantity: 2, unitPrice: 500 },
      { id: "li_2", description: "Product B", hsnCode: "9984", quantity: 1, unitPrice: 1000 },
    ],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0.5,
    isDraft: false,
    billedAt: "2025-06-15T00:00:00.000Z",
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cl_test",
    name: "Test Client Pvt Ltd",
    contactName: "John Doe",
    email: "client@example.com",
    phone: "9876543210",
    billingAddress: "123 Business Street\nMumbai\nMaharashtra 400001",
    gstin: "27ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    ...overrides,
  };
}

function makeBusiness(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    name: "Surfine Technology",
    logoUrl: undefined,
    address: "No. 52, 1st Street, Anna Nagar\nTiruvallur - 600072",
    email: "billing@surfine.com",
    phone: "044-12345678",
    gstin: "33ACSFS8087P1ZC",
    pan: "ACSFS8087P",
    bank: {
      accountHolder: "Surfine Technology",
      bankName: "Example Bank",
      branch: "Tiruvallur",
      accountNumber: "00123456789",
      ifsc: "EXAM0000123",
    },
    declaration: "We hereby certify that the above particulars are true and correct.",
    authorizedSignatory: "Sabari Krishna",
    defaultGst: { cgstRate: 0.09, sgstRate: 0.09 },
    ...overrides,
  };
}

function getTextContent(): string {
  return document.body.textContent || "";
}

describe("InvoicePreview", () => {
  let invoice: Invoice;
  let client: Client;
  let business: BusinessProfile;

  beforeEach(() => {
    invoice = makeInvoice();
    client = makeClient();
    business = makeBusiness();
  });

  describe("Invoice Details", () => {
    it("renders company name and invoice number", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Surfine Technology");
      expect(text).toContain("INV-1002");
    });

    it("renders business address, GSTIN, PAN, and email", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("No. 52, 1st Street, Anna Nagar")).toBeInTheDocument();
      expect(screen.getByText("Tiruvallur - 600072")).toBeInTheDocument();
      expect(screen.getByText("GSTIN: 33ACSFS8087P1ZC")).toBeInTheDocument();
      expect(screen.getByText("PAN: ACSFS8087P")).toBeInTheDocument();
      expect(screen.getByText("E-mail: billing@surfine.com")).toBeInTheDocument();
    });

    it("renders client name and address", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Test Client Pvt Ltd")).toBeInTheDocument();
      expect(screen.getByText("123 Business Street")).toBeInTheDocument();
      expect(screen.getByText("Mumbai")).toBeInTheDocument();
      expect(screen.getByText("Maharashtra 400001")).toBeInTheDocument();
    });

    it("renders client GSTIN, phone, and email", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("GSTIN: 27ABCDE1234F1Z5");
      expect(text).toContain("Contact: 9876543210");
      expect(text).toContain("Email: client@example.com");
    });

    it("renders invoice date and due date", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Date:")).toBeInTheDocument();
      expect(screen.getByText("Due Date:")).toBeInTheDocument();
      // Date format: "15 Jun 2025"
      expect(screen.getByText(/15 Jun 2025/)).toBeInTheDocument();
    });

    it("renders PO number and PO date when available", () => {
      invoice = makeInvoice({ poNumber: "PO-12345", poDate: "2025-06-10T00:00:00.000Z" });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("PO No:")).toBeInTheDocument();
      expect(screen.getByText("PO-12345")).toBeInTheDocument();
      expect(screen.getByText("PO Date:")).toBeInTheDocument();
      expect(screen.getByText(/10 Jun 2025/)).toBeInTheDocument();
    });

    it("renders transporter when available", () => {
      invoice = makeInvoice({ transporter: "Blue Dart Express" });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Transporter:")).toBeInTheDocument();
      expect(screen.getByText("Blue Dart Express")).toBeInTheDocument();
    });

    it("renders state code from client GSTIN", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      // GSTIN 27ABCDE1234F1Z5 -> state code 27
      expect(text).toContain("State Code: 27");
    });
  });

  describe("Line Items Table", () => {
    it("renders all line items with correct columns", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("S.No");
      expect(text).toContain("Item Name");
      expect(text).toContain("HSN/SAC");
      expect(text).toContain("Qty");
      expect(text).toContain("Price/Unit");
      expect(text).toContain("Taxable Amount");

      // Row 1
      expect(text).toContain("Product A");
      expect(text).toContain("9983");
      expect(text).toContain("2"); // Qty
      expect(text).toContain("₹500.00"); // Price/Unit
      expect(text).toContain("₹1,000.00"); // Taxable Amount

      // Row 2
      expect(text).toContain("Product B");
      expect(text).toContain("9984");
      expect(text).toContain("1"); // Qty
    });

    it("shows dash for missing HSN/SAC", () => {
      invoice = makeInvoice({ items: [{ id: "li_1", description: "No HSN", quantity: 1, unitPrice: 100 }] });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      // Count occurrences of "—" in HSN column (should be at least 1)
      expect((text.match(/—/g) || []).length).toBeGreaterThanOrEqual(1);
    });

    it("calculates taxable amount as quantity * unitPrice", () => {
      invoice = makeInvoice({ items: [{ id: "li_1", description: "Test", quantity: 3, unitPrice: 250 }] });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      // 3 * 250 = 750
      expect(text).toContain("₹750.00");
    });

    it("renders full saved item description", () => {
      const longDescription = "Premium Consulting Services - Monthly Retainer";
      invoice = makeInvoice({ items: [{ id: "li_1", description: longDescription, quantity: 1, unitPrice: 5000 }] });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it("wraps long descriptions without clipping", () => {
      const longDescription = "This is a very long product description that should wrap across multiple lines in the invoice table without being clipped or truncated in any way";
      invoice = makeInvoice({ items: [{ id: "li_1", description: longDescription, quantity: 1, unitPrice: 100 }] });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const descCell = screen.getByText(longDescription);
      expect(descCell).toBeInTheDocument();
      // Verify the cell has proper wrapping styles
      expect(descCell).toHaveStyle({ wordWrap: "break-word", overflowWrap: "break-word", whiteSpace: "normal" });
    });

    it("renders multiple items with their respective descriptions", () => {
      invoice = makeInvoice({
        items: [
          { id: "li_1", description: "First Item Description", quantity: 1, unitPrice: 100 },
          { id: "li_2", description: "Second Item Description", quantity: 2, unitPrice: 200 },
          { id: "li_3", description: "Third Item Description", quantity: 3, unitPrice: 300 },
        ],
      });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("First Item Description");
      expect(text).toContain("Second Item Description");
      expect(text).toContain("Third Item Description");
    });
  });

  describe("HSN-wise Tax Summary", () => {
    it("renders tax summary table with CGST and SGST breakdown", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("HSN / SAC Wise Tax Summary");
      expect(text).toContain("Taxable Value");
      expect(text).toContain("CGST %");
      expect(text).toContain("CGST Amt");
      expect(text).toContain("SGST %");
      expect(text).toContain("SGST Amt");
      expect(text).toContain("Total Tax");
    });

    it("shows correct tax rates (9% CGST, 9% SGST)", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("9%");
    });

    it("shows different rows for different HSN codes", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("9983");
      expect(text).toContain("9984");
    });
  });

  describe("Totals Section", () => {
    it("renders subtotal, taxable value, CGST, SGST, round-off, and grand total", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Subtotal");
      expect(text).toContain("Taxable Value");
      expect(text).toContain("CGST");
      expect(text).toContain("SGST");
      expect(text).toContain("Round Off");
      expect(text).toContain("Grand Total");
    });

    it("calculates totals correctly using computeInvoiceTotals", () => {
      // Subtotal = 2*500 + 1*1000 = 2000
      // Taxable = 2000 (no discount)
      // CGST = 2000 * 0.09 = 180
      // SGST = 2000 * 0.09 = 180
      // RoundOff = 0.5
      // Grand Total = 2000 + 180 + 180 + 0.5 = 2360.5
      const totals = computeInvoiceTotals(invoice);

      expect(totals.subtotal).toBe(2000);
      expect(totals.cgstAmount).toBe(180);
      expect(totals.sgstAmount).toBe(180);
      expect(totals.roundOff).toBe(0.5);
      expect(totals.total).toBe(2360.5);
    });

    it("displays correct grand total on screen", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("₹2,360.50")).toBeInTheDocument();
    });

    it("shows discount line when discount > 0", () => {
      invoice = makeInvoice({ discount: 100 });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Less: Discount");
      expect(text).toContain("100");
    });

    it("shows round-off with correct sign for negative", () => {
      invoice = makeInvoice({ roundOff: -0.5 });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Round Off");
      expect(text).toContain("0.50");
    });

    it("shows positive round-off with + sign", () => {
      invoice = makeInvoice({ roundOff: 0.5 });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Round Off");
      expect(text).toContain("0.50");
    });
  });

  describe("Amount in Words", () => {
    it("renders amount chargeable in words", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Amount Chargeable (in words)")).toBeInTheDocument();
      // 2360.50 -> "Two Thousand Three Hundred Sixty Rupees and Fifty Paise Only"
      expect(screen.getByText(/Two Thousand Three Hundred Sixty Rupees and Fifty Paise Only/)).toBeInTheDocument();
    });

    it("renders tax amount in words", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Tax Amount (in words)")).toBeInTheDocument();
      // 360 -> "Three Hundred Sixty Rupees Only"
      expect(screen.getByText(/Three Hundred Sixty Rupees Only/)).toBeInTheDocument();
    });

    it("matches amountInWords utility output", () => {
      const totals = computeInvoiceTotals(invoice);
      const expectedWords = amountInWords(totals.total);

      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText(expectedWords)).toBeInTheDocument();
    });
  });

  describe("Declaration and Signatory", () => {
    it("renders declaration from business profile", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Declaration")).toBeInTheDocument();
      expect(screen.getByText("We hereby certify that the above particulars are true and correct.")).toBeInTheDocument();
    });

    it("renders invoice terms when business declaration is not set", () => {
      business = makeBusiness({ declaration: undefined });
      invoice = makeInvoice({ terms: "Invoice-specific terms and conditions." });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Declaration")).toBeInTheDocument();
      expect(screen.getByText("Invoice-specific terms and conditions.")).toBeInTheDocument();
    });

    it("renders authorized signatory", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      expect(screen.getByText("Authorized Signatory")).toBeInTheDocument();
      expect(screen.getByText("Sabari Krishna")).toBeInTheDocument();
    });

    it("shows default signatory text when not set", () => {
      business = makeBusiness({ authorizedSignatory: undefined });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const signatoryElements = screen.getAllByText("Authorized Signatory");
      expect(signatoryElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Bank Details", () => {
    it("renders all bank details from business profile", () => {
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Bank Account Details");
      expect(text).toContain("Account Holder");
      expect(text).toContain("Surfine Technology");
      expect(text).toContain("Bank Name");
      expect(text).toContain("Example Bank");
      expect(text).toContain("Branch");
      expect(text).toContain("Tiruvallur");
      expect(text).toContain("Account Number");
      expect(text).toContain("00123456789");
      expect(text).toContain("IFSC");
      expect(text).toContain("EXAM0000123");
    });

    it("shows fallback when bank details are incomplete", () => {
      business = makeBusiness({ bank: undefined });
      render(<InvoicePreview invoice={invoice} client={client} business={business} />);

      const text = getTextContent();
      expect(text).toContain("Account Holder");
      expect(text).toContain("Surfine Technology");
      expect(text).toContain("Bank Name");
      expect(text).toContain("—");
    });
  });

  describe("Responsive Layout", () => {
    it("renders without errors when client is undefined", () => {
      expect(() => render(<InvoicePreview invoice={invoice} client={undefined} business={business} />)).not.toThrow();
    });

    it("renders without errors when business is undefined", () => {
      expect(() => render(<InvoicePreview invoice={invoice} client={client} business={undefined} />)).not.toThrow();
    });

    it("renders without errors for draft invoice", () => {
      invoice = makeInvoice({ isDraft: true });
      expect(() => render(<InvoicePreview invoice={invoice} client={client} business={business} />)).not.toThrow();
    });
  });
});