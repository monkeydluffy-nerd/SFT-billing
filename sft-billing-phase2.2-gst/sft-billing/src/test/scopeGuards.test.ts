import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceScope = "frontend" | "backend";

type SourceUnit = {
  scope: SourceScope;
  relativePath: string;
  displayPath: string;
  absolutePath: string;
  source: string;
  code: string;
};

type ScopeFinding = {
  rule: string;
  displayPath: string;
  line: number;
  snippet: string;
  message: string;
  remediation: string;
};

const FRONTEND_ROOT = path.resolve(__dirname, "../..");
const WORKSPACE_ROOT = path.resolve(FRONTEND_ROOT, "..", "..");
const BACKEND_ROOT = path.join(WORKSPACE_ROOT, "backend");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);
const TEST_PATH_PATTERN = /(?:^|[\\/])(?:test|tests)(?:[\\/]|$)|\.(?:test|spec)\.(?:ts|tsx|js|jsx|py)$/i;
const GENERATED_PATH_PATTERN = /(?:^|[\\/])(?:node_modules|dist|__pycache__|scripts)(?:[\\/]|$)/i;

function maskRange(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
  }
}

/** Removes comments without changing source offsets, so findings retain useful line numbers. */
function stripComments(source: string, extension: string): string {
  const chars = source.split("");
  let state: "code" | "line" | "block" | "single" | "double" | "template" = "code";

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (state === "line") {
      if (current === "\n" || current === "\r") state = "code";
      else chars[index] = " ";
      continue;
    }
    if (state === "block") {
      if (current === "*" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        index += 1;
        state = "code";
      } else if (current !== "\n" && current !== "\r") {
        chars[index] = " ";
      }
      continue;
    }
    if (state === "single" || state === "double" || state === "template") {
      if (current === "\\") {
        index += 1;
        continue;
      }
      if ((state === "single" && current === "'") || (state === "double" && current === '"') || (state === "template" && current === "`")) {
        state = "code";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      maskRange(chars, index, index + 2);
      index += 1;
      state = "line";
    } else if (current === "/" && next === "*") {
      maskRange(chars, index, index + 2);
      index += 1;
      state = "block";
    } else if (extension === ".py" && current === "#") {
      chars[index] = " ";
      state = "line";
    } else if (current === "'") {
      state = "single";
    } else if (current === '"') {
      state = "double";
    } else if (current === "`") {
      state = "template";
    }
  }

  return chars.join("");
}

function isProductionFile(relativePath: string): boolean {
  return !TEST_PATH_PATTERN.test(relativePath) && !GENERATED_PATH_PATTERN.test(relativePath);
}

function readSourceUnit(scope: SourceScope, root: string, relativePath: string): SourceUnit | undefined {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return undefined;
  const source = fs.readFileSync(absolutePath, "utf8");
  const extension = path.extname(relativePath).toLowerCase();
  return {
    scope,
    relativePath,
    displayPath: `${scope}/${relativePath.replace(/\\/g, "/")}`,
    absolutePath,
    source,
    code: stripComments(source, extension),
  };
}

function walkProductionSources(root: string, scope: SourceScope): SourceUnit[] {
  if (!fs.existsSync(root)) return [];
  const units: SourceUnit[] = [];

  function visit(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (!GENERATED_PATH_PATTERN.test(relativePath)) visit(absolutePath);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || !isProductionFile(relativePath)) continue;
      const unit = readSourceUnit(scope, root, relativePath);
      if (unit) units.push(unit);
    }
  }

  visit(root);
  return units;
}

const frontendSources = walkProductionSources(FRONTEND_ROOT, "frontend");
const backendSources = walkProductionSources(BACKEND_ROOT, "backend");
const productionSources = [...frontendSources, ...backendSources];
const manifests = [
  readSourceUnit("frontend", FRONTEND_ROOT, "package.json"),
  readSourceUnit("backend", BACKEND_ROOT, "requirements.txt"),
].filter((unit): unit is SourceUnit => Boolean(unit));
const scanUnits = [...productionSources, ...manifests];

function lineDetails(unit: SourceUnit, index: number): { line: number; snippet: string } {
  const line = unit.source.slice(0, index).split("\n").length;
  const lineStart = unit.source.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = unit.source.indexOf("\n", index);
  const snippet = unit.source.slice(lineStart, lineEnd < 0 ? unit.source.length : lineEnd).trim();
  return { line, snippet: snippet.length > 180 ? `${snippet.slice(0, 177)}…` : snippet };
}

function addFinding(
  findings: ScopeFinding[],
  rule: string,
  unit: SourceUnit,
  index: number,
  message: string,
  remediation: string,
): void {
  const details = lineDetails(unit, Math.max(0, index));
  findings.push({
    rule,
    displayPath: unit.displayPath,
    line: details.line,
    snippet: details.snippet,
    message,
    remediation,
  });
}

function addMatches(
  findings: ScopeFinding[],
  rule: string,
  units: SourceUnit[],
  pattern: RegExp,
  message: string,
  remediation: string,
): void {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  for (const unit of units) {
    const scanner = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(unit.code)) !== null) {
      addFinding(findings, rule, unit, match.index, message, remediation);
      if (match[0].length === 0) scanner.lastIndex += 1;
    }
  }
}

function requirePattern(
  findings: ScopeFinding[],
  rule: string,
  unit: SourceUnit | undefined,
  pattern: RegExp,
  expectation: string,
  remediation: string,
): void {
  if (!unit) {
    findings.push({
      rule,
      displayPath: expectation,
      line: 1,
      snippet: "<missing file>",
      message: `Required source file or boundary is missing: ${expectation}.`,
      remediation,
    });
    return;
  }
  pattern.lastIndex = 0;
  if (!pattern.test(unit.code)) {
    addFinding(findings, rule, unit, 0, `Expected ${expectation}.`, remediation);
  }
}

function frontendUnit(relativePath: string): SourceUnit | undefined {
  return frontendSources.find((unit) => unit.relativePath === relativePath);
}

function backendUnit(relativePath: string): SourceUnit | undefined {
  return backendSources.find((unit) => unit.relativePath === relativePath);
}

function formatFindings(findings: ScopeFinding[]): string {
  if (findings.length === 0) return "No scope violations found.";
  const ordered = [...findings].sort((left, right) =>
    `${left.displayPath}:${left.line}:${left.rule}`.localeCompare(`${right.displayPath}:${right.line}:${right.rule}`),
  );
  return [
    `Scope verification found ${ordered.length} violation(s):`,
    ...ordered.map(
      (finding) =>
        `- [${finding.rule}] ${finding.displayPath}:${finding.line}\n  ${finding.message}\n  Found: ${finding.snippet || "<blank>"}\n  Fix: ${finding.remediation}`,
    ),
  ].join("\n");
}

function persistenceFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  const offlineProviderPath = "src/services/offlineDataProvider.ts";
  const browserPersistenceSources = frontendSources.filter(
    (unit) => unit.relativePath !== offlineProviderPath,
  );
  addMatches(
    findings,
    "storage-boundary",
    browserPersistenceSources,
    /\b(?:localStorage|sessionStorage|indexedDB)\b/i,
    "Browser persistence is limited to the isolated offline provider; API-backed domains and uploaded proof files stay behind FastAPI.",
    "Keep browser storage confined to offlineDataProvider and route API-backed domain/proof operations through DataProvider and FastAPI.",
  );
  addMatches(
    findings,
    "storage-boundary",
    frontendSources,
    /(?:from\s+["'][^"']*(?:sqlite|sqlalchemy|peewee|mongoose|prisma|sequelize|typeorm|better-sqlite3|pymongo|psycopg|asyncpg|mysql|postgres|mongodb)[^"']*["']|import\s+["'][^"']*(?:sqlite|sqlalchemy|peewee|mongoose|prisma|sequelize|typeorm|better-sqlite3|pymongo|psycopg|asyncpg|mysql|postgres|mongodb)[^"']*["'])/i,
    "Database drivers belong to the backend persistence layer, not frontend modules.",
    "Keep SQLite/SQLAlchemy access in backend repositories and use the frontend DataProvider/API boundary.",
  );

  const databaseSession = backendUnit("app/database/session.py");
  const clientRoute = backendUnit("app/routes/clients.py");
  const invoiceRoute = backendUnit("app/routes/invoices.py");
  const paymentRoute = backendUnit("app/routes/payments.py");
  const clientService = backendUnit("app/services/client_service.py");
  const invoiceService = backendUnit("app/services/invoice_service.py");
  const paymentService = backendUnit("app/services/payment_service.py");
  requirePattern(findings, "storage-boundary", databaseSession, /create_engine\s*\(/, "the shared backend SQLAlchemy engine", "Keep database connection setup in the backend database module.");
  requirePattern(findings, "storage-boundary", databaseSession, /PRAGMA foreign_keys=ON/, "SQLite foreign-key enforcement", "Keep SQLite integrity enforcement enabled on backend connections.");
  requirePattern(findings, "storage-boundary", clientRoute, /client_service\./, "Client routes delegating to the Client service", "Keep FastAPI route handlers thin and delegate business/persistence work to services.");
  requirePattern(findings, "storage-boundary", invoiceRoute, /invoice_service\./, "Invoice routes delegating to the Invoice service", "Keep FastAPI route handlers thin and delegate business/persistence work to services.");
  requirePattern(findings, "storage-boundary", paymentRoute, /payment_service\./, "Payment routes delegating to the Payment service", "Keep FastAPI route handlers thin and delegate business/persistence work to services.");
  requirePattern(findings, "storage-boundary", clientService, /client_repository/, "Client service using its SQLite repository", "Keep SQLAlchemy operations inside domain repositories.");
  requirePattern(findings, "storage-boundary", invoiceService, /invoice_repository/, "Invoice service using its SQLite repository", "Keep SQLAlchemy operations inside domain repositories.");
  requirePattern(findings, "storage-boundary", paymentService, /payment_repository/, "Payment service using its SQLite repository", "Keep SQLAlchemy operations inside domain repositories.");
  addMatches(
    findings,
    "storage-boundary",
    backendSources.filter((unit) => unit.relativePath.startsWith("app/routes/")),
    /(?:from\s+sqlalchemy\b|from\s+app\.(?:database|repositories)\b)/i,
    "A FastAPI route imports persistence details directly.",
    "Route through the corresponding service and keep repository/database access below the route layer.",
  );
  return findings;
}

function presentationLayerFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  const presentationSources = frontendSources.filter(
    (unit) => unit.relativePath.startsWith("src/pages/") || unit.relativePath.startsWith("src/components/"),
  );
  addMatches(
    findings,
    "presentation-layer-storage",
    presentationSources,
    /(?:from\s+["'][^"']*(?:node:fs|node:path|openpyxl|exceljs|sqlite)|import\s+["'][^"']*(?:node:fs|node:path|openpyxl|exceljs|sqlite))/i,
    "Presentation code imports a storage, workbook, database, or filesystem implementation directly.",
    "Move the operation into a provider/service and have the page or component call the existing DataProvider boundary.",
  );
  addMatches(
    findings,
    "presentation-layer-storage",
    presentationSources,
    /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie|fetch|XMLHttpRequest|FileReader|showOpenFilePicker|showSaveFilePicker)\b/i,
    "Presentation code accesses browser/backend storage directly instead of using the approved provider boundary.",
    "Keep presentation code limited to hooks, domain values, and DataProvider calls; do not read/write workbook or attachment files here.",
  );
  addMatches(
    findings,
    "presentation-layer-storage",
    presentationSources,
    /(?:from\s+["'][^"']*(?:apiDataProvider|mockDataProvider)["']|import\s+["'][^"']*(?:apiDataProvider|mockDataProvider)["'])/i,
    "Presentation code imports a concrete provider implementation rather than the active provider boundary.",
    "Import the provider facade from `@/services` or use the corresponding hook; do not select a storage implementation in a component.",
  );
  return findings;
}

function phaseOneStoreFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  addMatches(
    findings,
    "phase-one-store",
    frontendSources,
    /\b(?:appStore|useAppStore|phase1AppStore)\b/i,
    "The phase-one appStore is not an approved source or mutation boundary.",
    "Use `activeDataProvider`/domain hooks for data and reserve `useWorkspaceStore` for UI navigation state only.",
  );
  return findings;
}

function rendererAndExportFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  const actionToolbar = frontendUnit("src/components/invoices/ActionToolbar.tsx");
  const exportDropdown = frontendUnit("src/components/invoices/ExportDropdown.tsx");
  const createInvoice = frontendUnit("src/pages/CreateInvoicePage.tsx");
  const sendModal = frontendUnit("src/components/invoices/SendInvoiceModal.tsx");
  requirePattern(findings, "template-export", actionToolbar, /<ExportDropdown\b/, "invoice detail exposing the export menu", "Keep invoice exports available from the invoice action toolbar.");
  requirePattern(findings, "template-export", exportDropdown, /downloadInvoiceTemplate/, "template workbook and converted PDF downloads", "Keep invoice exports routed through the backend template service.");

  // Allow InvoicePreview in InvoicePage for on-screen viewing (not export).
  // InvoicePreview is an on-screen A4-proportioned document preview for viewing only.
  // PDF/Excel exports still go through the backend export service.
  for (const unit of [actionToolbar, exportDropdown, createInvoice, sendModal]) {
    if (unit && /InvoiceDocumentRenderer|invoice-document-page/.test(unit.code)) {
      addFinding(findings, "template-export", unit, 0, "An in-app invoice document renderer remains.", "Use the bundled Surfine workbook as the only invoice document layout.");
    }
  }

  // Flag obsolete browser-side export/renderer sources, but allow InvoicePreview for on-screen preview.
  const obsoleteExportSources = frontendSources.filter((unit) =>
    /(?:invoicePdfService|invoiceExportService|InvoiceDocumentRenderer|InvoicePdfRenderer)/i.test(unit.relativePath),
  );
  for (const unit of obsoleteExportSources) {
    addFinding(findings, "template-export", unit, 0, "An obsolete browser-rendered invoice export/preview source remains.", "Remove the old renderer and use the FastAPI template export endpoints.");
  }

  const backendExporter = backendUnit("app/services/invoice_excel_export_service.py");
  const invoiceRoute = backendUnit("app/routes/invoices.py");
  requirePattern(findings, "template-export", backendExporter, /def\s+render_invoice_pdf\s*\(/, "PDF conversion using the rendered workbook", "Generate PDF from the bundled Surfine workbook rather than a separate HTML document.");
  requirePattern(findings, "template-export", invoiceRoute, /\/\{invoice_id\}\/pdf/, "invoice PDF route", "Expose the template-converted PDF through the invoice API.");

  addMatches(
    findings,
    "template-export",
    frontendSources.filter((unit) => unit.relativePath.startsWith("src/")),
    /(?:from\s+["'](?:html2canvas|jspdf|exceljs)["']|import\s+[^;]*\b(?:html2canvas|ExcelJS)\b)/i,
    "A browser-side renderer/export library is used for invoice document generation.",
    "Download the backend-rendered Excel template or the PDF converted from it.",
  );
  return findings;
}

function reportsIntelligenceFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  const reports = frontendUnit("src/pages/ReportsPage.tsx");
  const reportFeatureSources = frontendSources.filter(
    (unit) =>
      unit.relativePath === "src/pages/ReportsPage.tsx" ||
      unit.relativePath.startsWith("src/components/reports/") ||
      unit.relativePath.startsWith("src/components/intelligence/") ||
      unit.relativePath === "src/lib/reports.ts" ||
      unit.relativePath === "src/lib/intelligence.ts",
  );

  const forbiddenFeaturePatterns = [
    /\b(?:activeDataProvider|apiDataProvider|mockDataProvider)\b/i,
    /\b(?:saveInvoice|recordPayment|addActivityEvent|updateBusinessProfile)\s*\(/i,
    /\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest)\b/i,
    /\b(?:setInvoices|setPayments|setClients)\s*\(/i,
  ];
  for (const pattern of forbiddenFeaturePatterns) {
    addMatches(
      findings,
      "reports-intelligence-scope",
      reportFeatureSources,
      pattern,
      "Reports/Intelligence code introduces a persistence, storage, or data-source mutation outside the approved narrow correction scope.",
      "Keep these surfaces on their existing hooks/pure helpers and limit changes to exact invoice navigation, targeted labels, and comparison direction.",
    );
  }

  const reportsRequirements: Array<[RegExp, string]> = [
    [/filterInvoices\s*\(/, "existing invoice filtering helper"],
    [/filterPayments\s*\(/, "existing payment filtering helper"],
    [/REPORT_DEFINITIONS/, "existing report definitions"],
    [/InvoiceNumberLink/, "shared exact invoice-number link"],
    [/labelOverride/, "targeted status-label override"],
  ];
  for (const [pattern, expectation] of reportsRequirements) {
    requirePattern(findings, "reports-intelligence-scope", reports, pattern, expectation, "Preserve the existing Reports data/filter structure and apply only approved label/link corrections.");
  }

  const intelligenceRequirements: Array<[RegExp, string]> = [
    [/computeBusinessPulse\s*\(/, "existing business-pulse computation"],
    [/computeSignals\s*\(/, "existing signal computation"],
    [/computeAttentionItems\s*\(/, "existing attention computation"],
    [/computeClientInsights\s*\(/, "existing client-insight computation"],
    [/generateExecutiveSummary\s*\(/, "existing executive-summary computation"],
    [/periodLabel|comparableLabel/, "current/prior comparison labels"],
  ];
  const intelligence = frontendUnit("src/lib/intelligence.ts");
  for (const [pattern, expectation] of intelligenceRequirements) {
    requirePattern(findings, "reports-intelligence-scope", intelligence, pattern, expectation, "Preserve the existing Intelligence metrics/data flow and limit changes to approved navigation/terminology/comparison corrections.");
  }

  for (const unit of [frontendUnit("src/lib/reports.ts"), frontendUnit("src/lib/intelligence.ts")]) {
    if (!unit) continue;
    if (/from\s+["'][^"']*(?:services|apiDataProvider|mockDataProvider)["']/i.test(unit.code)) {
      addFinding(findings, "reports-intelligence-scope", unit, 0, "A Reports/Intelligence pure helper imports a provider or storage implementation.", "Keep report and intelligence calculations pure and fed by the existing page hooks.");
    }
  }
  return findings;
}

function messagingFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  const messagingPattern = /\b(?:twilio|sendgrid|nodemailer|messagebird|vonage|plivo|telnyx|mailgun|postmark|emailjs|sendEmail|sendSms|sendSMS|sendWhatsApp|sendMessage|deliverMessage)\b|(?:mailto:|sms:|whatsapp:)/i;
  addMatches(
    findings,
    "record-only-messaging",
    scanUnits,
    messagingPattern,
    "An external messaging provider, channel URI, or delivery function is present in production code/configuration.",
    "Keep Send_Invoice_Action and Send_Reminder_Action confirmation/record-only through the existing DataProvider activity flow; do not add email, SMS, WhatsApp, or another channel.",
  );

  const sendInvoice = frontendUnit("src/components/invoices/SendInvoiceModal.tsx");
  const sendReminder = frontendUnit("src/components/invoices/SendReminderModal.tsx");
  requirePattern(findings, "record-only-messaging", sendInvoice, /activeDataProvider\.saveInvoice\s*\(/, "SendInvoiceModal recording sentAt through the provider", "Record the send state and activity only; do not add a transport integration.");
  requirePattern(findings, "record-only-messaging", sendInvoice, /activeDataProvider\.addActivityEvent\s*\(/, "SendInvoiceModal recording one send activity", "Keep send confirmation inside the existing activity boundary.");
  requirePattern(findings, "record-only-messaging", sendReminder, /activeDataProvider\.addActivityEvent\s*\(/, "SendReminderModal recording one reminder activity", "Keep reminder confirmation record-only and do not call an external channel.");
  return findings;
}

function billedEditFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  addMatches(
    findings,
    "billed-edit-scope",
    frontendSources,
    /\b(?:editBilledInvoice|billedInvoiceEdit|allowBilledEdit|billedEdit)\b|\b(?:edit|editing)\s+(?:a\s+)?billed\b|\bbilled\s+(?:invoice\s+)?(?:edit|editing)\b/i,
    "Production code introduces a billed-invoice editing workflow, which remains an open product decision.",
    "Keep billed invoices on view/send/reminder/payment/receipt actions; expose continuation to Create Invoice only for Draft_Invoice records.",
  );

  const detailActions = frontendUnit("src/components/invoices/InvoiceDetailActions.tsx");
  requirePattern(findings, "billed-edit-scope", detailActions, /if\s*\(\s*invoice\.isDraft\s*\)/, "InvoiceDetailActions draft-only editing branch", "Gate Continue editing behind invoice.isDraft and keep billed actions separate.");
  if (detailActions) {
    const billedBranchStart = detailActions.code.indexOf("const canRemind");
    if (billedBranchStart >= 0 && /\b(?:onContinueEditing|openCreateInvoice)\b/.test(detailActions.code.slice(billedBranchStart))) {
      addFinding(findings, "billed-edit-scope", detailActions, billedBranchStart, "The billed action branch can continue editing an invoice.", "Keep onContinueEditing exclusively in the invoice.isDraft branch.");
    }
  }

  const invoiceRow = frontendUnit("src/components/invoices/InvoiceRow.tsx");
  requirePattern(findings, "billed-edit-scope", invoiceRow, /const\s+isDraft\s*=\s*invoice\.isDraft/, "InvoiceRow draft/billed state gate", "Use the invoice lifecycle state to select draft edit versus billed view/payment actions.");
  if (invoiceRow) {
    const conditionalStart = invoiceRow.code.lastIndexOf("{isDraft ? (");
    const billedBranchStart = conditionalStart >= 0 ? invoiceRow.code.indexOf(") : (", conditionalStart) : -1;
    if (billedBranchStart < 0) {
      addFinding(findings, "billed-edit-scope", invoiceRow, 0, "InvoiceRow has no explicit draft/billed action split.", "Keep Edit/Bill controls in the draft branch and View/payment controls in the billed branch.");
    } else if (/\bonEdit\b/.test(invoiceRow.code.slice(billedBranchStart))) {
      addFinding(findings, "billed-edit-scope", invoiceRow, billedBranchStart, "InvoiceRow exposes onEdit from the billed action branch.", "Remove billed edit affordances; billed invoices must use View and ledger actions only.");
    }
  }
  return findings;
}

function igstFindings(): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  addMatches(
    findings,
    "igst-deferral",
    productionSources,
    /\b(?:igst|integrated[_ -]?tax|interstate(?:tax)?|interStateTax)\b/i,
    "IGST or an integrated/inter-state tax representation was added to production implementation code.",
    "Do not add IGST fields, rates, rules, calculations, export columns, renderer labels, or workbook persistence until the coordinated product decision exists.",
  );

  const invoiceTypes = frontendUnit("src/types/invoice.ts");
  const invoiceMath = frontendUnit("src/lib/invoiceMath.ts");
  const paymentSchemas = backendUnit("app/models/schemas.py");
  const calculationService = backendUnit("app/services/calculation_service.py");
  const workbookRows = backendUnit("app/excel/rows.py");
  for (const [unit, expected] of [
    [invoiceTypes, "CGST/SGST invoice type fields"],
    [invoiceMath, "CGST/SGST calculation fields"],
    [paymentSchemas, "backend schemas without an IGST field"],
    [calculationService, "backend calculation path without an IGST rule"],
    [workbookRows, "workbook row adapter without an IGST persistence column"],
  ] as Array<[SourceUnit | undefined, string]>) {
    if (!unit) {
      findings.push({
        rule: "igst-deferral",
        displayPath: expected,
        line: 1,
        snippet: "<missing file>",
        message: `Required implementation boundary is missing: ${expected}.`,
        remediation: "Keep the existing coordinated frontend/backend calculation and persistence boundaries intact.",
      });
    }
  }
  return findings;
}

describe("Task 11.4 static and scope guards", () => {
  it("keeps migrated persistence behind FastAPI repositories and isolates offline browser storage", () => {
    const findings = persistenceFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("keeps presentation code behind hooks and DataProvider boundaries", () => {
    const findings = presentationLayerFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("rejects phase-one appStore data mutations", () => {
    const findings = phaseOneStoreFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("enforces template-only invoice downloads without an in-app preview", () => {
    const findings = rendererAndExportFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("keeps Reports and Intelligence within the approved narrow correction scope", () => {
    const findings = reportsIntelligenceFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("keeps send and reminder actions record-only without external messaging", () => {
    const findings = messagingFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("does not introduce a billed-invoice editing workflow", () => {
    const findings = billedEditFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("keeps IGST deferred across frontend, backend, calculation, export, and persistence paths", () => {
    const findings = igstFindings();
    expect(findings, formatFindings(findings)).toEqual([]);
  });
});
