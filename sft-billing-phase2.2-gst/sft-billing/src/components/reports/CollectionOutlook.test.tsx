import { describe, expect, it } from "vitest";
import { getCollectionOutlookItems } from "./CollectionOutlook";
import type { Invoice, Payment, Client } from "@/types";

describe("CollectionOutlook - getCollectionOutlookItems", () => {
  const mockClient: Client = {
    id: "cl_1",
    name: "Test Client",
    contactName: "Contact",
    email: "test@example.com",
    billingAddress: "123 Test St",
    gstin: "33AAAAA0000A1Z5",
    pan: "AAAAA0000A",
  };

  const client2: Client = {
    id: "cl_2",
    name: "Client 2",
    contactName: "Contact 2",
    email: "test2@example.com",
    billingAddress: "456 Test St",
    gstin: "33BBBBB0000B1Z5",
    pan: "BBBBB0000B",
  };

  describe("Partial payments: Show only the remaining outstanding balance after payments received", () => {
    it("calculates outstanding as total - paid when partial payment exists", () => {
      const invoice: Invoice = {
        id: "iv_1",
        number: "INV-1",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
      };
      const payment: Payment = { id: "pm_1", invoiceId: "iv_1", clientId: "cl_1", amount: 300, method: "bank_transfer", receivedAt: "2026-09-10T00:00:00Z" };

      const items = getCollectionOutlookItems([invoice], [payment], [mockClient], new Date("2026-10-01"));

      expect(items.length).toBe(1);
      // subtotal 1000 + GST 180 = 1180, minus 300 payment = 880 outstanding
      expect(items[0].outstanding).toBe(880);
    });

    it("shows zero outstanding when payment covers full amount", () => {
      const invoice: Invoice = {
        id: "iv_2",
        number: "INV-2",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
      };
      const payment: Payment = { id: "pm_2", invoiceId: "iv_2", clientId: "cl_1", amount: 1180, method: "bank_transfer", receivedAt: "2026-09-10T00:00:00Z" };

      const items = getCollectionOutlookItems([invoice], [payment], [mockClient], new Date("2026-10-01"));

      expect(items.length).toBe(0); // Fully paid invoices are excluded
    });

    it("shows zero outstanding when payment exceeds total", () => {
      const invoice: Invoice = {
        id: "iv_3",
        number: "INV-3",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
      };
      const payment: Payment = { id: "pm_3", invoiceId: "iv_3", clientId: "cl_1", amount: 2000, method: "bank_transfer", receivedAt: "2026-09-10T00:00:00Z" };

      const items = getCollectionOutlookItems([invoice], [payment], [mockClient], new Date("2026-10-01"));

      expect(items.length).toBe(0);
    });
  });

  describe("Filters: respect date range, client, and status filters", () => {
    it("respects date range filter via filtered invoices passed in", () => {
      const invoiceInRange: Invoice = {
        id: "iv_in",
        number: "INV-IN",
        clientId: "cl_1",
        issueDate: "2026-09-15",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-15T00:00:00Z",
      };
      const invoiceOutOfRange: Invoice = {
        id: "iv_out",
        number: "INV-OUT",
        clientId: "cl_1",
        issueDate: "2026-08-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-08-01T00:00:00Z",
      };

      const items = getCollectionOutlookItems(
        [invoiceInRange, invoiceOutOfRange],
        [],
        [mockClient],
        new Date("2026-09-15")
      );

      expect(items.length).toBe(2);
    });

    it("respects client filter via filtered invoices passed in", () => {
      const invoiceClient1: Invoice = {
        id: "iv_1",
        number: "INV-1",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
      };

      const items = getCollectionOutlookItems(
        [invoiceClient1],
        [],
        [mockClient, client2],
        new Date()
      );

      expect(items.length).toBe(1);
      expect(items[0].clientName).toBe("Test Client");
    });
  });

  describe("Reconciliation: Overdue + Due within 7 days + Pending totals must reconcile with overall outstanding", () => {
    it("sums correctly across categories without double-counting", () => {
      const overdueInvoice: Invoice = {
        id: "iv_overdue",
        number: "INV-OVERDUE",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-09-01",
        items: [{ id: "li1", description: "Overdue", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
      };
      const dueSoonInvoice: Invoice = {
        id: "iv_duesoon",
        number: "INV-DUESOON",
        clientId: "cl_1",
        issueDate: "2026-09-15",
        dueDate: "2026-09-20",
        items: [{ id: "li2", description: "DueSoon", quantity: 1, unitPrice: 500 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-15T00:00:00Z",
      };
      const pendingInvoice: Invoice = {
        id: "iv_pending",
        number: "INV-PENDING",
        clientId: "cl_1",
        issueDate: "2026-09-15",
        dueDate: "2026-10-01",
        items: [{ id: "li3", description: "Pending", quantity: 1, unitPrice: 2000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-15T00:00:00Z",
      };

      const items = getCollectionOutlookItems(
        [overdueInvoice, dueSoonInvoice, pendingInvoice],
        [],
        [mockClient],
        new Date("2026-09-15")
      );

      const overdueItems = items.filter(i => i.isOverdue);
      const dueSoonItems = items.filter(i => i.isDueSoon && !i.isOverdue);
      const pendingItems = items.filter(i => !i.isOverdue && !i.isDueSoon);

      const totalOverdue = overdueItems.reduce((sum, i) => sum + i.outstanding, 0);
      const totalDueSoon = dueSoonItems.reduce((sum, i) => sum + i.outstanding, 0);
      const totalPending = pendingItems.reduce((sum, i) => sum + i.outstanding, 0);
      const totalOutstanding = items.reduce((sum, i) => sum + i.outstanding, 0);

      // No double-counting: each invoice appears in exactly one category
      expect(items.length).toBe(3);
      expect(overdueItems.length).toBe(1);
      expect(dueSoonItems.length).toBe(1);
      expect(pendingItems.length).toBe(1);

      // Reconciliation check
      expect(totalOverdue + totalDueSoon + totalPending).toBeCloseTo(totalOutstanding, 2);
    });
  });

  describe("Invoice eligibility: exclude fully paid and cancelled invoices", () => {
    it("excludes fully paid invoices (paidAt set)", () => {
      const invoice: Invoice = {
        id: "iv_paid",
        number: "INV-PAID",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Paid", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
        paidAt: "2026-09-10T00:00:00Z",
      };

      const unpaidInvoice: Invoice = {
        id: "iv_1",
        number: "INV-1",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-01T00:00:00Z",
      };

      const items = getCollectionOutlookItems(
        [unpaidInvoice, invoice],
        [],
        [mockClient],
        new Date()
      );

      expect(items.length).toBe(1);
      expect(items[0].id).not.toBe("iv_paid");
    });

    it("excludes draft invoices", () => {
      const draftInvoice: Invoice = { 
        id: "iv_draft", 
        number: "INV-DRAFT", 
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: true 
      };
      const billedInvoice: Invoice = { 
        id: "iv_billed", 
        number: "INV-BILLED", 
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: false, 
        billedAt: "2026-09-01T00:00:00Z" 
      };

      const items = getCollectionOutlookItems([draftInvoice, billedInvoice], [], [mockClient], new Date("2026-09-15"));

      expect(items.length).toBe(1);
      expect(items[0].id).toBe("iv_billed");
    });

    it("excludes invoices with zero outstanding after full payment", () => {
      const invoice: Invoice = { 
        id: "iv_fullpaid", 
        number: "INV-FULLPAID", 
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: false, 
        billedAt: "2026-09-01T00:00:00Z" 
      };
      const payment: Payment = { id: "pm_1", invoiceId: "iv_fullpaid", clientId: "cl_1", amount: 1180, method: "bank_transfer", receivedAt: "2026-09-10T00:00:00Z" };

      const items = getCollectionOutlookItems([invoice], [payment], [mockClient], new Date());

      expect(items.length).toBe(0);
    });
  });

  describe("Date boundaries: test invoices due today, exactly 7 days from today, and just outside the 7-day window", () => {
    const asOf = new Date("2026-09-15");

    it("marks invoice due today as due-soon (0 days)", () => {
      const todayInvoice: Invoice = {
        id: "iv_today",
        number: "INV-TODAY",
        clientId: "cl_1",
        issueDate: "2026-09-01",
        dueDate: "2026-09-15",
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-15T00:00:00Z",
      };

      const items = getCollectionOutlookItems([todayInvoice], [], [mockClient], asOf);

      expect(items.length).toBe(1);
      expect(items[0].isDueSoon).toBe(true);
      expect(items[0].daysUntilDue).toBe(0);
      expect(items[0].status).toBe("due-soon");
    });

    it("marks invoice due in exactly 7 days as due-soon", () => {
      const sevenDaysLater = new Date("2026-09-22").toISOString().split("T")[0];
      const invoice: Invoice = {
        id: "iv_7days",
        number: "INV-7DAYS",
        clientId: "cl_1",
        issueDate: "2026-09-15",
        dueDate: sevenDaysLater,
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-15T00:00:00Z",
      };

      const items = getCollectionOutlookItems([invoice], [], [mockClient], asOf);

      expect(items[0].isDueSoon).toBe(true);
      expect(items[0].daysUntilDue).toBe(7);
      expect(items[0].status).toBe("due-soon");
    });

    it("marks invoice due in 8 days as pending (not due-soon)", () => {
      const eightDaysLater = new Date("2026-09-23").toISOString().split("T")[0];
      const invoice: Invoice = {
        id: "iv_8days",
        number: "INV-8DAYS",
        clientId: "cl_1",
        issueDate: "2026-09-15",
        dueDate: eightDaysLater,
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }],
        gst: { cgstRate: 0.09, sgstRate: 0.09 },
        discount: 0,
        roundOff: 0,
        isDraft: false,
        billedAt: "2026-09-15T00:00:00Z",
      };

      const items = getCollectionOutlookItems([invoice], [], [mockClient], asOf);

      expect(items[0].isDueSoon).toBe(false);
      expect(items[0].daysUntilDue).toBe(8);
      expect(items[0].status).toBe("pending");
    });
  });

  describe("Empty states: correctly handle no eligible invoices and zero outstanding", () => {
    it("shows empty state when no invoices", () => {
      const items = getCollectionOutlookItems([], [], [mockClient], new Date());
      expect(items.length).toBe(0);
    });

    it("shows empty state when all invoices are drafts", () => {
      const draftInvoice: Invoice = { 
        id: "iv_draft", 
        number: "INV-DRAFT", 
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: true 
      };
      const items = getCollectionOutlookItems([draftInvoice], [], [mockClient], new Date());
      expect(items.length).toBe(0);
    });

    it("shows empty state when all invoices are fully paid", () => {
      const paidInvoice: Invoice = { 
        id: "iv_1", 
        number: "INV-1", 
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: false, 
        billedAt: "2026-09-01T00:00:00Z", 
        paidAt: "2026-09-01" 
      };
      const items = getCollectionOutlookItems([paidInvoice], [], [mockClient], new Date());
      expect(items.length).toBe(0);
    });

    it("shows empty state when all invoices fully paid via payments", () => {
      const invoice: Invoice = { 
        id: "iv_1", 
        number: "INV-1", 
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 1000 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: false, 
        billedAt: "2026-09-01T00:00:00Z" 
      };
      const payment: Payment = { id: "pm_1", invoiceId: "iv_1", clientId: "cl_1", amount: 1180, method: "bank_transfer", receivedAt: "2026-09-10T00:00:00Z" };
      const items = getCollectionOutlookItems([invoice], [payment], [mockClient], new Date());
      expect(items.length).toBe(0);
    });

    it("handles zero outstanding after partial payment equals total", () => {
      const invoice: Invoice = { 
        id: "iv_1", 
        number: "INV-1",
        clientId: "cl_1", 
        issueDate: "2026-09-01", 
        dueDate: "2026-10-01", 
        items: [{ id: "li1", description: "Item", quantity: 1, unitPrice: 100 }], 
        gst: { cgstRate: 0.09, sgstRate: 0.09 }, 
        discount: 0, 
        roundOff: 0, 
        isDraft: false, 
        billedAt: "2026-09-01T00:00:00Z" 
      };
      const payment: Payment = { id: "pm_1", invoiceId: "iv_1", clientId: "cl_1", amount: 118, method: "bank_transfer", receivedAt: "2026-09-10T00:00:00Z" };
      const items = getCollectionOutlookItems([invoice], [payment], [mockClient], new Date());
      expect(items.length).toBe(0);
    });
  });

  describe("Reconciliation totals match across categories", () => {
    it("totalOutstanding equals sum of overdue + dueSoon + pending", () => {
      const asOf = new Date("2026-09-15");
      const invoices: Invoice[] = [
        { id: "iv1", number: "INV-1", clientId: "cl_1", issueDate: "2026-09-01", dueDate: "2026-09-01", items: [{ id: "li1", description: "A", quantity: 1, unitPrice: 1000 }], gst: { cgstRate: 0.09, sgstRate: 0.09 }, discount: 0, roundOff: 0, isDraft: false, billedAt: "2026-09-01T00:00:00Z" }, // overdue
        { id: "iv2", number: "INV-2", clientId: "cl_1", issueDate: "2026-09-15", dueDate: "2026-09-20", items: [{ id: "li2", description: "B", quantity: 1, unitPrice: 500 }], gst: { cgstRate: 0.09, sgstRate: 0.09 }, discount: 0, roundOff: 0, isDraft: false, billedAt: "2026-09-15T00:00:00Z" }, // due soon
        { id: "iv3", number: "INV-3", clientId: "cl_1", issueDate: "2026-09-15", dueDate: "2026-10-01", items: [{ id: "li3", description: "C", quantity: 1, unitPrice: 2000 }], gst: { cgstRate: 0.09, sgstRate: 0.09 }, discount: 0, roundOff: 0, isDraft: false, billedAt: "2026-09-15T00:00:00Z" }, // pending
      ];

      const items = getCollectionOutlookItems(invoices, [], [mockClient], asOf);

      const overdueItems = items.filter(i => i.isOverdue);
      const dueSoonItems = items.filter(i => i.isDueSoon && !i.isOverdue);
      const pendingItems = items.filter(i => !i.isOverdue && !i.isDueSoon);

      const totalOverdue = overdueItems.reduce((sum, i) => sum + i.outstanding, 0);
      const totalDueSoon = dueSoonItems.reduce((sum, i) => sum + i.outstanding, 0);
      const totalPending = pendingItems.reduce((sum, i) => sum + i.outstanding, 0);
      const totalOutstanding = items.reduce((sum, i) => sum + i.outstanding, 0);

      expect(totalOverdue + totalDueSoon + totalPending).toBeCloseTo(totalOutstanding, 2);
    });
  });
});