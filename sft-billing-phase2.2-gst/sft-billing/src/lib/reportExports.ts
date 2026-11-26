/**
 * Report export layouts that follow the company's own workbooks:
 *  - Sales register  (reference: "Total Sales 2026-27.xlsx", sheet "Sales")
 *  - Supply vs payment receipt, one sheet per client and financial year
 *    (reference: "MEGAWIN SUPPLY VS PAY RECEIPT.xlsx")
 * Both are built as plain sheet specs, so the Excel and CSV exports always
 * carry exactly the same rows.
 */
import type { Client, Invoice, Payment } from "@/types";
import { computeInvoiceTotals, getInvoiceStatus, roundMoney } from "./invoiceMath";
import { uniqueSheetName, type SheetCell, type SheetSpec, type StyleName } from "./xlsxWorkbook";

/* ── date helpers (no timezone maths: invoice dates are plain YYYY-MM-DD) ── */

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => Number.parseInt(n, 10));
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

/** dd.mm.yyyy, the format used in the company workbooks. */
export function formatDotDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

function excelSerial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Financial year (April to March), e.g. "2026-27". */
export function financialYearOf(iso: string): string {
  const { y, m } = parts(iso);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** 0 = April ... 11 = March */
function fyMonthIndex(iso: string): number {
  return (parts(iso).m + 8) % 12;
}

const QUARTER_LABELS = ["I ST QUARTER", "II ND QUARTER", "III RD QUARTER", "IV TH QUARTER"];

/* ── invoice facts ── */

interface Fact {
  invoice: Invoice;
  clientId: string;
  client: string;
  part: string;
  qty: number;
  basic: number;
  cgstRate: number;
  sgstRate: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  payments: number[];
}

function buildFacts(invoices: Invoice[], payments: Payment[], clients: Client[]): Fact[] {
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const byInvoice = new Map<string, number[]>();
  for (const p of payments) {
    const list = byInvoice.get(p.invoiceId) ?? [];
    list.push(roundMoney(p.amount));
    byInvoice.set(p.invoiceId, list);
  }
  return invoices
    .filter((invoice) => !invoice.isDraft)
    .map((invoice) => {
      const totals = computeInvoiceTotals(invoice);
      const basic = roundMoney(Math.max(0, totals.subtotal - totals.discount));
      const cgst = roundMoney(basic * invoice.gst.cgstRate);
      const sgst = roundMoney(basic * invoice.gst.sgstRate);
      const roundOff = roundMoney(invoice.roundOff ?? 0);
      return {
        invoice,
        clientId: invoice.clientId,
        client: names.get(invoice.clientId) ?? "Unknown client",
        part: invoice.items.map((item) => item.description.trim()).filter(Boolean).join(" / "),
        qty: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
        basic,
        cgstRate: invoice.gst.cgstRate,
        sgstRate: invoice.gst.sgstRate,
        cgst,
        sgst,
        roundOff,
        total: roundMoney(basic + cgst + sgst + roundOff),
        payments: byInvoice.get(invoice.id) ?? [],
      };
    })
    .sort(
      (a, b) =>
        a.invoice.issueDate.slice(0, 10).localeCompare(b.invoice.issueDate.slice(0, 10)) ||
        a.invoice.number.localeCompare(b.invoice.number),
    );
}

/** fy -> month index -> facts, both in calendar order. */
function groupByFinancialYear(facts: Fact[]): Map<string, Map<number, Fact[]>> {
  const out = new Map<string, Map<number, Fact[]>>();
  for (const fact of facts) {
    const fy = financialYearOf(fact.invoice.issueDate);
    const months = out.get(fy) ?? new Map<number, Fact[]>();
    const idx = fyMonthIndex(fact.invoice.issueDate);
    months.set(idx, [...(months.get(idx) ?? []), fact]);
    out.set(fy, months);
  }
  return new Map([...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fy, months]) => [fy, new Map([...months.entries()].sort((a, b) => a[0] - b[0]))]));
}

function monthCell(fact: Fact, s: StyleName): SheetCell {
  const { y, m } = parts(fact.invoice.issueDate);
  return { v: excelSerial(y, m, 1), s, csv: `${MONTH_ABBR[m - 1]}-${String(y % 100).padStart(2, "0")}` };
}

/** One number, or a live "=a+b" formula when an invoice has several payments (as in the company workbook). */
function paymentCell(amounts: number[], s: StyleName): SheetCell {
  if (amounts.length === 0) return { s };
  if (amounts.length === 1) return { v: amounts[0], s };
  return { f: amounts.join("+"), v: roundMoney(amounts.reduce((a, b) => a + b, 0)), s };
}

const sum = (list: number[]): number => roundMoney(list.reduce((a, b) => a + b, 0));

/* ── Sales register (layout of "Total Sales 2026-27.xlsx") ── */

const SALES_HEADERS = ["Invoice.No", "Date", "Customer Name", "Part Name", "QTY", "Basic Value", "ROI", "CGST", "SGST", "TOTAL TAX", "TOTAL", "PAY RECEIPT"];
// 0-based column index -> letter, for the columns that are summed
const SALES_SUM_COLS: { col: number; letter: string; kind: "int" | "money" }[] = [
  { col: 4, letter: "E", kind: "int" },
  { col: 5, letter: "F", kind: "money" },
  { col: 7, letter: "H", kind: "money" },
  { col: 8, letter: "I", kind: "money" },
  { col: 9, letter: "J", kind: "money" },
  { col: 10, letter: "K", kind: "money" },
  { col: 11, letter: "L", kind: "money" },
];
// Column widths copied from the company workbook.
const SALES_WIDTHS = [12.6, 11.4, 19, 20.4, 11, 12, 5.9, 10.5, 10.5, 10.7, 12.9, 10.6];

function salesSheet(fy: string, months: Map<number, Fact[]>, name: string, withPaymentSummary: boolean): SheetSpec {
  const rows: SheetCell[][] = [];
  const merges: string[] = [];
  const excelRow = () => rows.length + 1;
  const blanks = (n: number, s: StyleName): SheetCell[] => Array.from({ length: n }, () => ({ s }));

  rows.push(SALES_HEADERS.map((h, i) => ({ v: h, s: (i === 11 ? "sHeaderEnd" : "sHeader") as StyleName })));
  rows.push([{ v: fy, s: "sTitle" }, ...blanks(10, "sTitle"), { s: "sPlain" }]);
  merges.push("A2:K2");

  type Totals = Record<string, number>;
  const emptyTotals = (): Totals => Object.fromEntries(SALES_SUM_COLS.map((c) => [c.letter, 0]));
  const monthTotals: { row: number; quarter: number; totals: Totals }[] = [];
  const quarterRows: { row: number; totals: Totals }[] = [];

  for (const [monthIdx, facts] of months) {
    const header = monthCell(facts[0], "sMonth");
    rows.push([header, ...blanks(10, "sMonth"), { s: "sPlain" }]);
    merges.push(`A${excelRow() - 1}:K${excelRow() - 1}`);

    const first = excelRow();
    const totals = emptyTotals();
    for (const f of facts) {
      const r = excelRow();
      const taxTotal = roundMoney(f.cgst + f.sgst);
      rows.push([
        { v: f.invoice.number, s: "sText" },
        { v: formatDotDate(f.invoice.issueDate), s: "sText" },
        { v: f.client, s: "sTextLeft" },
        { v: f.part, s: "sTextLeft" },
        { v: f.qty, s: "sInt" },
        { v: f.basic, s: "sMoney" },
        { v: roundMoney(f.cgstRate + f.sgstRate), s: "sPercent" },
        { f: `F${r}*${f.cgstRate}`, v: f.cgst, s: "sMoney" },
        { f: `F${r}*${f.sgstRate}`, v: f.sgst, s: "sMoney" },
        { f: `H${r}+I${r}`, v: taxTotal, s: "sMoney" },
        { f: f.roundOff === 0 ? `F${r}+J${r}` : `F${r}+J${r}+${f.roundOff}`, v: f.total, s: "sMoney" },
        paymentCell(f.payments, "sPay"),
      ]);
      totals.E += f.qty;
      totals.F += f.basic;
      totals.H += f.cgst;
      totals.I += f.sgst;
      totals.J += taxTotal;
      totals.K += f.total;
      totals.L += sum(f.payments);
    }
    const last = excelRow() - 1;
    const totalRow: SheetCell[] = [...blanks(11, "sTotBlank"), { s: "sPlain" }];
    for (const c of SALES_SUM_COLS) {
      const value = roundMoney(totals[c.letter]);
      totals[c.letter] = value;
      totalRow[c.col] = { f: `SUM(${c.letter}${first}:${c.letter}${last})`, v: value, s: c.kind === "int" ? "sTotInt" : "sTotMoney" };
    }
    if (totals.L === 0) totalRow[11] = { s: "sPlain" };
    monthTotals.push({ row: excelRow(), quarter: Math.floor(monthIdx / 3), totals });
    rows.push(totalRow);

    // Quarter total once the quarter's last month that has data has been written
    const remaining = [...months.keys()].filter((m) => m > monthIdx && Math.floor(m / 3) === Math.floor(monthIdx / 3));
    if (remaining.length === 0) {
      const q = Math.floor(monthIdx / 3);
      const inQuarter = monthTotals.filter((m) => m.quarter === q);
      const quarterRow: SheetCell[] = blanks(12, "sPlain");
      quarterRow[2] = { v: QUARTER_LABELS[q], s: "sQLabel" };
      quarterRow[3] = { s: "sQLabel" };
      merges.push(`C${excelRow()}:D${excelRow()}`);
      const qTotals = emptyTotals();
      for (const c of SALES_SUM_COLS) {
        const value = sum(inQuarter.map((m) => m.totals[c.letter]));
        qTotals[c.letter] = value;
        quarterRow[c.col] = { f: inQuarter.map((m) => `${c.letter}${m.row}`).join("+"), v: value, s: c.kind === "int" ? "sQInt" : "sQMoney" };
      }
      if (qTotals.L === 0) quarterRow[11] = { s: "sPlain" };
      quarterRows.push({ row: excelRow(), totals: qTotals });
      rows.push(quarterRow);
    }
  }

  const overallRow = excelRow();
  const overall: SheetCell[] = blanks(12, "sPlain");
  overall[2] = { v: "OVERALL SALES", s: "sOLabel" };
  const overallTotals: Totals = {};
  for (const c of SALES_SUM_COLS) {
    overallTotals[c.letter] = sum(quarterRows.map((q) => q.totals[c.letter]));
    // Columns D and the gaps stay green like the reference's OVERALL row.
    overall[c.col] = { f: quarterRows.map((q) => `${c.letter}${q.row}`).join("+"), v: overallTotals[c.letter], s: c.kind === "int" ? "sOInt" : "sOMoney" };
  }
  overall[3] = { s: "sOLabel" };
  overall[6] = { s: "sOLabel" };
  if (overallTotals.L === 0) overall[11] = { s: "sPlain" };
  merges.push(`C${overallRow}:D${overallRow}`);
  rows.push(overall);

  if (withPaymentSummary) {
    // Same closing block as the supply-vs-payment ledger: what was billed, what came in, what is left.
    const recRow = excelRow();
    const rec: SheetCell[] = blanks(12, "sPlain");
    rec[2] = { v: "PAYMENT REC'D", s: "sSumLabel" };
    rec[3] = { s: "sSumLabel" };
    merges.push(`C${recRow}:D${recRow}`);
    rec[10] = { f: `L${overallRow}`, v: overallTotals.L, s: "sSumPeach" };
    rows.push(rec);
    const out: SheetCell[] = blanks(12, "sPlain");
    out[2] = { v: "PAYMENT OUTSTANDING", s: "sSumLabel" };
    out[3] = { s: "sSumLabel" };
    merges.push(`C${excelRow()}:D${excelRow()}`);
    out[10] = { f: `K${overallRow}-K${recRow}`, v: roundMoney(overallTotals.K - overallTotals.L), s: "sSumRed" };
    rows.push(out);
  }

  return { name, rows, merges, widths: SALES_WIDTHS, heights: { 1: 28.5, 2: 20.25 } };
}

export function buildSalesRegisterSheets(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  options: { withPaymentSummary?: boolean } = {},
): SheetSpec[] {
  const facts = buildFacts(invoices, payments, clients);
  const used = new Set<string>();
  return [...groupByFinancialYear(facts).entries()].map(([fy, months]) =>
    salesSheet(fy, months, uniqueSheetName(`Sales ${fy}`, used), options.withPaymentSummary ?? false),
  );
}

/* ── Supply vs payment receipt (layout of "MEGAWIN SUPPLY VS PAY RECEIPT.xlsx") ── */

export type LedgerScope = "all" | "outstanding" | "overdue";

const LEDGER_HEADERS = ["INV NO", "DATE", "DESCRIPTION", "QTY", "BILL VALUE", "LR REF", "PAYMENT RECEIPT", "SHORT FALLS"];
const LEDGER_WIDTHS = [11.9, 11.5, 19.7, 10.7, 13.1, 29.6, 12.1, 10.4];

function ledgerSheet(client: string, fy: string, months: Map<number, Fact[]>, name: string): SheetSpec {
  const rows: SheetCell[][] = [];
  const merges: string[] = [];
  const excelRow = () => rows.length + 1;
  const blanks = (n: number, s: StyleName): SheetCell[] => Array.from({ length: n }, () => ({ s }));

  rows.push([{ v: `${client.toUpperCase()} SUPPLY VS PAYMENT RECEIPT -${fy}`, s: "lTitle" }, ...blanks(7, "lTitle")]);
  merges.push("A1:H1");
  rows.push(LEDGER_HEADERS.map((h, i) => ({ v: h, s: (i === 7 ? "lHeaderRed" : "lHeader") as StyleName })));

  const monthTotalRows: { row: number; qty: number; bill: number; paid: number }[] = [];

  for (const facts of months.values()) {
    rows.push([{ s: "lMonthBlank" }, { s: "lMonthBlank" }, monthCell(facts[0], "lMonth"), ...blanks(5, "lMonthBlank")]);

    const first = excelRow();
    let qty = 0;
    let bill = 0;
    let paid = 0;
    for (const f of facts) {
      const r = excelRow();
      const received = sum(f.payments);
      rows.push([
        { v: f.invoice.number, s: "lText" },
        { v: formatDotDate(f.invoice.issueDate), s: "lText" },
        { v: f.part, s: "lLeft" },
        { v: f.qty, s: "lInt" },
        { v: f.total, s: "lMoney" },
        { v: (f.invoice.transporter ?? "").trim(), s: "lPlain" },
        paymentCell(f.payments, received === 0 ? "lPayNone" : f.total - received > 0.005 ? "lPay" : "lPayFull"),
        { f: `E${r}-G${r}`, v: roundMoney(f.total - received), s: "lShort" },
      ]);
      qty += f.qty;
      bill += f.total;
      paid += received;
    }
    const last = excelRow() - 1;
    qty = roundMoney(qty);
    bill = roundMoney(bill);
    paid = roundMoney(paid);
    const totalRow: SheetCell[] = [...blanks(6, "lTotBlank"), { s: "lPlain" }, { s: "lShort" }];
    totalRow[2] = { v: "TOTAL", s: "lTotLabel" };
    totalRow[3] = { f: `SUM(D${first}:D${last})`, v: qty, s: "lTotInt" };
    totalRow[4] = { f: `SUM(E${first}:E${last})`, v: bill, s: "lTotMoney" };
    if (paid !== 0) totalRow[6] = { f: `SUM(G${first}:G${last})`, v: paid, s: "lTotPaid" };
    totalRow[7] = { f: `SUM(H${first}:H${last})`, v: roundMoney(bill - paid), s: "lShort" };
    monthTotalRows.push({ row: excelRow(), qty, bill, paid });
    rows.push(totalRow);
  }

  const qtyAll = roundMoney(monthTotalRows.reduce((a, m) => a + m.qty, 0));
  const billAll = roundMoney(monthTotalRows.reduce((a, m) => a + m.bill, 0));
  const paidAll = roundMoney(monthTotalRows.reduce((a, m) => a + m.paid, 0));
  const refs = (letter: string) => monthTotalRows.map((m) => `${letter}${m.row}`).join("+");

  const overallRow = excelRow();
  const overall: SheetCell[] = blanks(8, "lPlain");
  overall[1] = { v: `OVERALL SALES ${fy}`, s: "lOverallLabel" };
  overall[2] = { s: "lOverallLabel" };
  overall[3] = { f: refs("D"), v: qtyAll, s: "lOverallInt" };
  overall[4] = { f: refs("E"), v: billAll, s: "lOverallMoney" };
  overall[5] = { v: "PAYMENT REC'D", s: "lRecLabel" };
  overall[6] = { f: refs("G"), v: paidAll, s: "lRecMoney" };
  rows.push(overall);
  merges.push(`B${overallRow}:C${overallRow}`);

  const outRow = excelRow();
  const outstanding: SheetCell[] = blanks(8, "lPlain");
  outstanding[1] = { v: "PAYMENT OUTSTANDING", s: "lOutLabel" };
  outstanding[2] = { s: "lOutLabel" };
  outstanding[4] = { f: `E${overallRow}-G${overallRow}`, v: roundMoney(billAll - paidAll), s: "lOutMoney" };
  rows.push(outstanding);
  merges.push(`B${outRow}:C${outRow}`);

  return { name, rows, merges, widths: LEDGER_WIDTHS, heights: { 1: 21, 2: 29.25 } };
}

export function buildSupplyLedgerSheets(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  scope: LedgerScope = "all",
  now: Date = new Date(),
): SheetSpec[] {
  let facts = buildFacts(invoices, payments, clients);
  if (scope !== "all") {
    facts = facts.filter((f) => {
      const owing = f.total - sum(f.payments) > 0.005;
      if (!owing) return false;
      return scope === "overdue" ? getInvoiceStatus(f.invoice, now).status === "overdue" : true;
    });
  }
  const byClient = new Map<string, Fact[]>();
  for (const f of facts) byClient.set(f.clientId, [...(byClient.get(f.clientId) ?? []), f]);

  const used = new Set<string>();
  const sheets: SheetSpec[] = [];
  const ordered = [...byClient.values()].sort((a, b) => a[0].client.localeCompare(b[0].client));
  for (const clientFacts of ordered) {
    const clientName = clientFacts[0].client;
    for (const [fy, months] of groupByFinancialYear(clientFacts)) {
      const suffix = ` ${fy}`;
      const base = clientName.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31 - suffix.length);
      sheets.push(ledgerSheet(clientName, fy, months, uniqueSheetName(`${base}${suffix}`, used)));
    }
  }
  return sheets;
}

/* ── Simple table for the remaining reports, in the same palette ── */

export function buildTableSheet(
  name: string,
  headers: string[],
  rows: (string | number)[][],
  moneyColumns: number[] = [],
  totalColumns: number[] = [],
): SheetSpec {
  const out: SheetCell[][] = [headers.map((h, i) => ({ v: h, s: (i === headers.length - 1 ? "sHeaderEnd" : "sHeader") as StyleName }))];
  for (const row of rows) {
    out.push(
      row.map((value, i) => ({
        v: value,
        s: (typeof value === "number" ? (moneyColumns.includes(i) ? "sMoney" : "sInt") : i === 0 ? "sText" : "sTextLeft") as StyleName,
      })),
    );
  }
  if (totalColumns.length > 0 && rows.length > 0) {
    const last = rows.length + 1;
    const totalRow: SheetCell[] = headers.map(() => ({ s: "sTotBlank" as StyleName }));
    totalRow[0] = { v: "TOTAL", s: "sTotInt" };
    for (const col of totalColumns) {
      const letter = String.fromCharCode(65 + col);
      const value = roundMoney(rows.reduce((a, r) => a + (typeof r[col] === "number" ? (r[col] as number) : 0), 0));
      totalRow[col] = { f: `SUM(${letter}2:${letter}${last})`, v: value, s: moneyColumns.includes(col) ? "sTotMoney" : "sTotInt" };
    }
    out.push(totalRow);
  }
  const widths = headers.map((h, c) => Math.min(Math.max(h.length + 4, ...rows.map((r) => String(r[c] ?? "").length + 2), 12), 40));
  return { name: uniqueSheetName(name, new Set()), rows: out, merges: [], widths, heights: { 1: 28.5 } };
}
