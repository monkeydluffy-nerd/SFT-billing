import { describe, expect, it } from "vitest";
import { classifyIntent } from "./classifyIntent";
import { mockClients } from "@/data/mockClients";

/**
 * Pure intent-classification tests - no invoices/payments/calculations
 * involved. Each case asserts the winning `type`, which is the entire
 * contract classifyIntent has with the rest of AURA.
 */
describe("classifyIntent", () => {
  describe("phrasings that previously failed or were misclassified", () => {
    it('"how much have we billed" resolves to TOTAL_BILLED, not REVENUE_THIS_MONTH', () => {
      expect(classifyIntent("how much have we billed").type).toBe("TOTAL_BILLED");
    });

    it('"how much did we bill" resolves to TOTAL_BILLED', () => {
      expect(classifyIntent("how much did we bill").type).toBe("TOTAL_BILLED");
    });

    it('"how much money came in" resolves to COLLECTED, not REVENUE_THIS_MONTH', () => {
      expect(classifyIntent("how much money came in").type).toBe("COLLECTED");
    });

    it('"how much have we collected" resolves to COLLECTED', () => {
      expect(classifyIntent("how much have we collected").type).toBe("COLLECTED");
    });

    it('"who owes us" resolves to OUTSTANDING', () => {
      expect(classifyIntent("who owes us").type).toBe("OUTSTANDING");
    });

    it('"what is outstanding" resolves to OUTSTANDING', () => {
      expect(classifyIntent("what is outstanding").type).toBe("OUTSTANDING");
    });

    it('"total bill" resolves to TOTAL_BILLED', () => {
      expect(classifyIntent("total bill").type).toBe("TOTAL_BILLED");
    });

    it('"what is the total billed amount?" resolves to TOTAL_BILLED', () => {
      expect(classifyIntent("what is the total billed amount?").type).toBe("TOTAL_BILLED");
    });

    it('"show overdue invoices" resolves to OVERDUE_LIST', () => {
      expect(classifyIntent("show overdue invoices").type).toBe("OVERDUE_LIST");
    });

    it('"how many invoices do we have?" resolves to INVOICE_COUNT', () => {
      expect(classifyIntent("how many invoices do we have?").type).toBe("INVOICE_COUNT");
    });

    it('"how many clients do we have?" resolves to CLIENT_COUNT', () => {
      expect(classifyIntent("how many clients do we have?").type).toBe("CLIENT_COUNT");
    });
  });

  describe("the 'how much' generic collision is fixed", () => {
    it("a bare, unqualified 'how much' with nothing else specific does not masquerade as revenue - it's genuinely ambiguous, so UNKNOWN", () => {
      expect(classifyIntent("how much").type).toBe("UNKNOWN");
    });

    it("a real revenue question still resolves correctly when it IS specific", () => {
      expect(classifyIntent("how much did we earn this month").type).toBe("REVENUE_THIS_MONTH");
    });

    it("'how much' never outranks a more specific competing intent in the same sentence", () => {
      // Contains "how much" AND the specific "total billed" phrase - TOTAL_BILLED must win.
      const result = classifyIntent("how much - what's the total billed figure");
      expect(result.type).toBe("TOTAL_BILLED");
    });
  });

  describe("existing intents remain correctly classified", () => {
    it('"show pending invoices" resolves to PENDING_LIST', () => {
      expect(classifyIntent("show pending invoices").type).toBe("PENDING_LIST");
    });

    it('"show paid invoices" resolves to PAID_LIST', () => {
      expect(classifyIntent("show paid invoices").type).toBe("PAID_LIST");
    });

    it('"show draft invoices" resolves to DRAFT_LIST', () => {
      expect(classifyIntent("show draft invoices").type).toBe("DRAFT_LIST");
    });

    it('"create an invoice for Acme Corporation" resolves to CREATE_INVOICE and extracts the client', () => {
      const result = classifyIntent("create an invoice for Acme Corporation", mockClients);
      expect(result.type).toBe("CREATE_INVOICE");
      expect(result.clientMention?.name).toBe("Acme Corporation");
    });

    it('"create an invoice" with no client mention resolves to CREATE_INVOICE with no clientMention', () => {
      const result = classifyIntent("create an invoice", mockClients);
      expect(result.type).toBe("CREATE_INVOICE");
      expect(result.clientMention).toBeUndefined();
    });

    it('"add a client" resolves to ADD_CLIENT', () => {
      expect(classifyIntent("add a client").type).toBe("ADD_CLIENT");
    });
  });

  describe("genuinely unsupported input", () => {
    it('"what is the weather today" resolves to UNKNOWN', () => {
      expect(classifyIntent("what is the weather today").type).toBe("UNKNOWN");
    });

    it("empty input resolves to UNKNOWN", () => {
      expect(classifyIntent("").type).toBe("UNKNOWN");
    });

    it("whitespace-only input resolves to UNKNOWN", () => {
      expect(classifyIntent("   ").type).toBe("UNKNOWN");
    });
  });

  describe("normalization", () => {
    it("is case-insensitive", () => {
      expect(classifyIntent("WHAT IS OUTSTANDING").type).toBe("OUTSTANDING");
    });

    it("ignores trailing punctuation", () => {
      expect(classifyIntent("how much is outstanding???").type).toBe("OUTSTANDING");
    });
  });
});