import { describe, expect, it } from "vitest";
import type { Client, Invoice, Payment } from "@/types";
import { buildSalesRegisterSheets, buildSupplyLedgerSheets, financialYearOf, formatDotDate } from "./reportExports";
import { sheetsToCsvRows } from "./xlsxWorkbook";

const clients = [
  { id: "c1", name: "Megawin" },
  { id: "c2", name: "Mercury Fittings" },
] as Client[];

function invoice(number: string, clientId: string, issueDate: string, qty: number, unitPrice: number, extra: Partial<Invoice> = {}): Invoice {
  return {
    id: number,
    number,
    clientId,
    issueDate,
    dueDate: issueDate,
    items: [{ id: "1", description: "Eye bolt", quantity: qty, unitPrice }],
    gst: { cgstRate: 0.09, sgstRate: 0.09 },
    discount: 0,
    roundOff: 0,
    isDraft: false,
    ...extra,
  } as Invoice;
}

const payment = (invoiceId: string, amount: number): Payment =>
  ({ id: `p${invoiceId}${amount}`, invoiceId, clientId: "c1", amount, method: "bank_transfer", receivedAt: "2026-05-01" }) as Payment;

const invoices = [
  invoice("001/2026-27", "c2", "2026-04-06", 10, 100),
  invoice("002/2026-27", "c1", "2026-04-09", 300, 46),
  invoice("003/2026-27", "c1", "2026-07-03", 100, 10),
  invoice("004/2026-27", "c1", "2026-04-20", 1, 1, { isDraft: true }),
  invoice("005/2027-28", "c1", "2027-05-01", 1, 100),
];

describe("financial year helpers", () => {
  it("runs April to March", () => {
    expect(financialYearOf("2026-04-01")).toBe("2026-27");
    expect(financialYearOf("2027-03-31")).toBe("2026-27");
    expect(financialYearOf("2027-04-01")).toBe("2027-28");
  });
  it("formats dates as dd.mm.yyyy", () => {
    expect(formatDotDate("2026-04-09")).toBe("09.04.2026");
  });
});

describe("sales register", () => {
  const sheets = buildSalesRegisterSheets(invoices, [payment("002/2026-27", 10000), payment("002/2026-27", 6284)], clients);

  it("makes one sheet per financial year and skips drafts", () => {
    expect(sheets.map((s) => s.name)).toEqual(["Sales 2026-27", "Sales 2027-28"]);
    const flat = sheets[0].rows.flat().map((c) => c.v);
    expect(flat).not.toContain("004/2026-27");
  });

  it("uses the reference columns and splits GST", () => {
    const header = sheets[0].rows[0].map((c) => c.v);
    expect(header).toEqual(["Invoice.No", "Date", "Customer Name", "Part Name", "QTY", "Basic Value", "ROI", "CGST", "SGST", "TOTAL TAX", "TOTAL", "PAY RECEIPT"]);
    const row = sheets[0].rows.find((r) => r[0].v === "002/2026-27")!;
    expect(row.map((c) => c.v)).toEqual(["002/2026-27", "09.04.2026", "Megawin", "Eye bolt", 300, 13800, 0.18, 1242, 1242, 2484, 16284, 16284]);
  });

  it("records several payments as a live formula", () => {
    const row = sheets[0].rows.find((r) => r[0].v === "002/2026-27")!;
    expect(row[11].f).toBe("10000+6284");
  });

  it("adds month, quarter and overall totals", () => {
    const labels = sheets[0].rows.map((r) => r[2]?.v);
    expect(labels).toContain("I ST QUARTER");
    expect(labels).toContain("II ND QUARTER");
    expect(labels).toContain("OVERALL SALES");
    const overall = sheets[0].rows.find((r) => r[2]?.v === "OVERALL SALES")!;
    // 1180 + 16284 + 1180
    expect(overall[10].v).toBe(18644);
  });

  it("adds billed / received / outstanding rows for the revenue report", () => {
    const [sheet] = buildSalesRegisterSheets(invoices, [payment("002/2026-27", 16284)], clients, { withPaymentSummary: true });
    const labels = sheet.rows.map((r) => r[2]?.v);
    expect(labels.slice(-3)).toEqual(["OVERALL SALES", "PAYMENT REC'D", "PAYMENT OUTSTANDING"]);
    expect(sheet.rows.at(-2)![10].v).toBe(16284);
    expect(sheet.rows.at(-1)![10].v).toBe(1180 + 16284 + 1180 - 16284);
    expect(sheet.rows.at(-1)![10].s).toBe("sSumRed");
  });

  it("matches the CSV to the same rows", () => {
    const csv = sheetsToCsvRows(sheets);
    expect(csv[0][0]).toBe("Invoice.No");
    expect(csv.some((r) => r[0] === "Apr-26")).toBe(true);
    expect(csv.find((r) => r[0] === "002/2026-27")?.[10]).toBe("16284.00");
  });
});

describe("supply vs payment receipt", () => {
  const payments = [payment("002/2026-27", 10000)];
  it("builds one sheet per client and year with short falls", () => {
    const sheets = buildSupplyLedgerSheets(invoices, payments, clients);
    expect(sheets.map((s) => s.name)).toEqual(["Megawin 2026-27", "Megawin 2027-28", "Mercury Fittings 2026-27"]);
    const sheet = sheets[0];
    expect(sheet.rows[0][0].v).toBe("MEGAWIN SUPPLY VS PAYMENT RECEIPT -2026-27");
    expect(sheet.rows[1].map((c) => c.v)).toEqual(["INV NO", "DATE", "DESCRIPTION", "QTY", "BILL VALUE", "LR REF", "PAYMENT RECEIPT", "SHORT FALLS"]);
    const row = sheet.rows.find((r) => r[0].v === "002/2026-27")!;
    expect(row[4].v).toBe(16284);
    expect(row[7].v).toBe(6284);
    const outstanding = sheet.rows.find((r) => r[1]?.v === "PAYMENT OUTSTANDING")!;
    expect(outstanding[4].v).toBe(16284 + 1180 - 10000);
  });

  it("only lists unpaid invoices for the outstanding scope", () => {
    const sheets = buildSupplyLedgerSheets(invoices, [payment("003/2026-27", 1180)], clients, "outstanding");
    const numbers = sheets.flatMap((s) => s.rows.map((r) => r[0].v)).filter((v) => typeof v === "string" && /^\d{3}\//.test(v as string));
    expect(numbers).not.toContain("003/2026-27");
    expect(numbers).toContain("002/2026-27");
  });

  it("returns no sheets when nothing qualifies", () => {
    expect(buildSupplyLedgerSheets([], [], clients)).toEqual([]);
  });
});
