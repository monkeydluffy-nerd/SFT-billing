/**
 * Styled multi-sheet .xlsx writer: fonts, fills, thin borders, merged cells,
 * live formulas (with cached results) and number formats. Used by the Reports
 * exports so they can match the company's own workbooks. No dependencies.
 */
import { columnName, encoder, escapeXml, zipStore } from "./xlsxExport";

export type StyleName =
  // sales register
  | "sHeader" | "sHeaderEnd" | "sTitle" | "sMonth" | "sText" | "sTextLeft" | "sInt" | "sMoney" | "sPercent" | "sPay"
  | "sPlain" | "sTotBlank" | "sTotInt" | "sTotMoney" | "sQLabel" | "sQInt" | "sQMoney" | "sOLabel" | "sOInt" | "sOMoney"
  | "sSumLabel" | "sSumPeach" | "sSumRed"
  // supply vs payment receipt ledger
  | "lTitle" | "lPayFull" | "lPayNone" | "lHeader" | "lHeaderRed" | "lMonth" | "lMonthBlank" | "lText" | "lLeft" | "lInt" | "lMoney" | "lPlain" | "lPay" | "lShort"
  | "lTotBlank" | "lTotLabel" | "lTotInt" | "lTotMoney" | "lTotPaid" | "lOverallLabel" | "lOverallInt" | "lOverallMoney"
  | "lRecLabel" | "lRecMoney" | "lOutLabel" | "lOutMoney";

export interface SheetCell {
  /** Value shown (for formulas: the cached result). Excel serial number for dates. */
  v?: string | number;
  /** Formula without the leading "=". */
  f?: string;
  s?: StyleName;
  /** Text to use for this cell in CSV exports (e.g. "Apr-26" for a month cell). */
  csv?: string;
}

export interface SheetSpec {
  name: string;
  rows: SheetCell[][];
  /** A1-style ranges, e.g. "A1:H1". */
  merges: string[];
  widths: number[];
  heights?: Record<number, number>;
}

interface StyleDef {
  font: { name: string; sz: number; b?: boolean; u?: boolean; color?: string };
  fill?: string;
  h?: "left" | "center" | "right";
  numFmtId?: number;
  border?: boolean;
  /** Only a thin bottom edge (the ledger title). */
  bottomBorderOnly?: boolean;
  wrap?: boolean;
}

// Colours read from the company workbooks (theme shades resolved to RGB).
const YELLOW = "FFFFFF00";
const GREEN = "FF92D050";
const HEAD_GREY = "FF808080"; // sales header
const MID_GREY = "FFA6A6A6"; // month totals
const LIGHT_GREY = "FFF2F2F2"; // invoice rows
const QUARTER_BLUE = "FF8EB4E3";
const OVERALL_BLUE = "FF558ED5";
const ORANGE = "FFFFC000"; // payment receipt cells
const PEACH = "FFFAC090";
const RED = "FFFF0000";

const cal = (b = true, color?: string, sz = 11): StyleDef["font"] => ({ name: "Calibri", sz, b, color });
const cam = (b = true, color?: string, sz = 11): StyleDef["font"] => ({ name: "Cambria", sz, b, color });

// numFmtId: 0 General, 1 "0", 2 "0.00", 9 "0%", 17 "mmm-yy"
const STYLE_DEFS: Record<StyleName, StyleDef> = {
  sHeader: { font: cam(), fill: HEAD_GREY, h: "center", border: true, wrap: true },
  sHeaderEnd: { font: cam(), fill: MID_GREY, h: "center", border: true, wrap: true },
  sTitle: { font: { name: "Arial Black", sz: 16, b: true }, h: "center", border: true },
  sMonth: { font: cal(), fill: YELLOW, h: "center", numFmtId: 17, border: true },
  sText: { font: cal(), fill: LIGHT_GREY, h: "center", border: true },
  sTextLeft: { font: cal(), fill: LIGHT_GREY, h: "left", border: true },
  sInt: { font: cal(), fill: LIGHT_GREY, h: "center", border: true },
  sMoney: { font: cal(), fill: LIGHT_GREY, h: "right", numFmtId: 2, border: true },
  sPercent: { font: cal(), fill: LIGHT_GREY, h: "center", numFmtId: 9, border: true },
  sPay: { font: cal(false), fill: LIGHT_GREY, h: "right", numFmtId: 2, border: true },
  sPlain: { font: cal(false), border: true },
  sTotBlank: { font: cal(false), fill: MID_GREY, border: true },
  sTotInt: { font: cal(), fill: MID_GREY, h: "center", numFmtId: 1, border: true },
  sTotMoney: { font: cal(), fill: MID_GREY, h: "right", numFmtId: 2, border: true },
  sQLabel: { font: cal(), fill: QUARTER_BLUE, h: "center", border: true },
  sQInt: { font: cal(), fill: QUARTER_BLUE, h: "center", numFmtId: 1, border: true },
  sQMoney: { font: cal(), fill: QUARTER_BLUE, h: "right", numFmtId: 2, border: true },
  sOLabel: { font: cal(), fill: GREEN, h: "center", border: true },
  sOInt: { font: cal(), fill: GREEN, h: "center", numFmtId: 1, border: true },
  sOMoney: { font: cal(), fill: GREEN, h: "right", numFmtId: 2, border: true },
  sSumLabel: { font: cam(), h: "center", border: true },
  sSumPeach: { font: cam(), fill: PEACH, h: "right", numFmtId: 2, border: true },
  sSumRed: { font: cam(true, RED), h: "right", numFmtId: 2, border: true },

  lTitle: { font: { name: "Constantia", sz: 14, b: true, u: true }, h: "center" },
  lPayFull: { font: cam(), fill: GREEN, h: "right", numFmtId: 2, border: true },
  lPayNone: { font: cam(false), h: "right", numFmtId: 2, border: true },
  lHeader: { font: cal(false), fill: YELLOW, h: "center", border: true, wrap: true },
  lHeaderRed: { font: cal(true, RED), h: "center", border: true, wrap: true },
  lMonth: { font: cam(), fill: YELLOW, h: "center", numFmtId: 17, border: true },
  lMonthBlank: { font: cal(false), border: true },
  lText: { font: cal(), fill: LIGHT_GREY, h: "center", border: true },
  lLeft: { font: cal(), fill: LIGHT_GREY, h: "left", border: true },
  lInt: { font: cal(), fill: LIGHT_GREY, h: "center", border: true },
  lMoney: { font: cal(), h: "right", numFmtId: 2, border: true },
  lPlain: { font: cal(), h: "center", border: true },
  lPay: { font: cam(), fill: ORANGE, h: "right", numFmtId: 2, border: true },
  lShort: { font: cal(), h: "right", numFmtId: 2, border: true },
  lTotBlank: { font: cal(false), fill: MID_GREY, border: true },
  lTotLabel: { font: cam(true, undefined, 12), fill: MID_GREY, h: "center", border: true },
  lTotInt: { font: cam(), fill: MID_GREY, h: "center", numFmtId: 1, border: true },
  lTotMoney: { font: cam(), fill: MID_GREY, h: "right", numFmtId: 2, border: true },
  lTotPaid: { font: cam(), fill: GREEN, h: "right", numFmtId: 2, border: true },
  lOverallLabel: { font: cam(), h: "center", border: true },
  lOverallInt: { font: cam(), fill: OVERALL_BLUE, h: "center", numFmtId: 1, border: true },
  lOverallMoney: { font: cam(), fill: OVERALL_BLUE, h: "right", numFmtId: 2, border: true },
  lRecLabel: { font: cam(), h: "left", border: true },
  lRecMoney: { font: cam(), fill: PEACH, h: "right", numFmtId: 2, border: true },
  lOutLabel: { font: cam(), h: "center", border: true },
  lOutMoney: { font: cam(true, RED), h: "right", numFmtId: 2, border: true },
};

const STYLE_ORDER = Object.keys(STYLE_DEFS) as StyleName[];

function stylesXml(): string {
  const fonts: string[] = [];
  const fills: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  const fontIndex = (font: StyleDef["font"]): number => {
    const xml =
      `<font>${font.b ? "<b/>" : ""}${font.u ? "<u/>" : ""}<sz val="${font.sz}"/>` +
      (font.color ? `<color rgb="${font.color}"/>` : "") +
      `<name val="${font.name}"/></font>`;
    const found = fonts.indexOf(xml);
    if (found >= 0) return found;
    fonts.push(xml);
    return fonts.length - 1;
  };
  const fillIndex = (rgb?: string): number => {
    if (!rgb) return 0;
    const xml = `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
    const found = fills.indexOf(xml);
    if (found >= 0) return found;
    fills.push(xml);
    return fills.length - 1;
  };
  fontIndex({ name: "Calibri", sz: 11 });

  const xfs = STYLE_ORDER.map((name) => {
    const d = STYLE_DEFS[name];
    const align = d.h ? `<alignment horizontal="${d.h}" vertical="center"${d.wrap ? ' wrapText="1"' : ""}/>` : "";
    return (
      `<xf numFmtId="${d.numFmtId ?? 0}" fontId="${fontIndex(d.font)}" fillId="${fillIndex(d.fill)}" borderId="${d.border ? 1 : d.bottomBorderOnly ? 2 : 0}" xfId="0"` +
      ` applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"${d.h ? ' applyAlignment="1"' : ""}>${align}</xf>`
    );
  });

  const thin = (side: string) => `<${side} style="thin"><color auto="1"/></${side}>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    `<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border>${thin("left")}${thin("right")}${thin("top")}${thin("bottom")}<diagonal/></border>` +
    `<border><left/><right/><top/>${thin("bottom")}<diagonal/></border></borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xfs.join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

function styleId(name: StyleName | undefined): number {
  if (!name) return 0;
  return STYLE_ORDER.indexOf(name) + 1;
}

function numberText(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function sheetXml(sheet: SheetSpec): string {
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${columnName(c)}${r + 1}`;
          const s = styleId(cell.s);
          const style = s ? ` s="${s}"` : "";
          if (cell.f !== undefined) {
            const cached = typeof cell.v === "number" ? `<v>${numberText(cell.v)}</v>` : "";
            return `<c r="${ref}"${style}><f>${escapeXml(cell.f)}</f>${cached}</c>`;
          }
          if (cell.v === undefined || cell.v === "") return s ? `<c r="${ref}"${style}/>` : "";
          if (typeof cell.v === "number") return `<c r="${ref}"${style}><v>${numberText(cell.v)}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell.v)}</t></is></c>`;
        })
        .join("");
      const height = sheet.heights?.[r + 1];
      const ht = height ? ` ht="${height}" customHeight="1"` : "";
      return `<row r="${r + 1}"${ht}>${cells}</row>`;
    })
    .join("");
  const cols = sheet.widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  const merges = sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData>${merges}` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="landscape" fitToHeight="0"/></worksheet>'
  );
}

/** Excel sheet names: max 31 chars, none of \ / ? * [ ] : and unique. */
export function uniqueSheetName(wanted: string, used: Set<string>): string {
  const base = (wanted.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim() || "Sheet").slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export function buildStyledWorkbook(sheets: SheetSpec[]): Uint8Array {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const text = (name: string, content: string) => ({ name, data: encoder.encode(content) });
  const sheetEntries = sheets.map((sheet, i) => text(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet)));
  return zipStore([
    text(
      "[Content_Types].xml",
      `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        "</Types>",
    ),
    text(
      "_rels/.rels",
      `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    text(
      "xl/workbook.xml",
      `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>',
    ),
    text(
      "xl/_rels/workbook.xml.rels",
      `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    text("xl/styles.xml", stylesXml()),
    ...sheetEntries,
  ]);
}

export function downloadStyledWorkbook(filename: string, sheets: SheetSpec[]): void {
  const bytes = buildStyledWorkbook(sheets);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** CSV rows for a set of sheets: same layout as the workbook, formulas replaced by their values. */
export function sheetsToCsvRows(sheets: SheetSpec[]): (string | number)[][] {
  const out: (string | number)[][] = [];
  sheets.forEach((sheet, index) => {
    if (index > 0) out.push([], []);
    const width = Math.max(...sheet.rows.map((row) => row.length), sheet.widths.length);
    for (const row of sheet.rows) {
      const cells: (string | number)[] = [];
      for (let c = 0; c < width; c += 1) {
        const cell = row[c];
        if (!cell) {
          cells.push("");
          continue;
        }
        if (cell.csv !== undefined) {
          cells.push(cell.csv);
          continue;
        }
        const v = cell.v;
        if (v === undefined) cells.push("");
        else if (typeof v === "number") {
          const money = cell.s !== undefined && STYLE_DEFS[cell.s].numFmtId === 2;
          cells.push(cell.s !== undefined && STYLE_DEFS[cell.s].numFmtId === 9 ? `${Math.round(v * 10000) / 100}%` : money ? v.toFixed(2) : v);
        } else cells.push(v);
      }
      out.push(cells);
    }
  });
  return out;
}
