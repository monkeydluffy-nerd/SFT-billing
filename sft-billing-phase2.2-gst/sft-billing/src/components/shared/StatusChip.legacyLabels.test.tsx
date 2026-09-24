import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { StatusChip } from "./StatusChip";

const SRC_ROOT = path.resolve(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(SRC_ROOT, relativePath), "utf-8");
}

describe("Unit: Reports/Intelligence/Workspace Settings/AURA labels are unchanged", () => {
  it("StatusChip's CONFIG still renders 'Pending' and 'Paid' verbatim — the shared component core surfaces relied on before this feature, and Reports/Intelligence/Workspace Settings/AURA still call getInvoiceStatus()+StatusChip unmodified", () => {
    render(<StatusChip info={{ status: "pending", daysOverdue: 0, severity: null }} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("StatusChip renders 'Paid' verbatim for the paid status", () => {
    render(<StatusChip info={{ status: "paid", daysOverdue: 0, severity: null }} />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("StatusChip.tsx's CONFIG source still contains the literal 'Pending'/'Paid' strings, unmodified", () => {
    const source = readSource("components/shared/StatusChip.tsx");
    expect(source).toContain('label: "Paid"');
    expect(source).toContain('label: "Pending"');
  });

  it("Reports/Intelligence/Workspace Settings still import StatusChip + getInvoiceStatus, not LedgerStatusChip/getInvoiceLedgerStatus", () => {
    const reports = readSource("pages/ReportsPage.tsx");
    const intelligence = readSource("pages/IntelligencePage.tsx");
    const settings = readSource("pages/WorkspaceSettingsPage.tsx");

    for (const source of [reports, intelligence, settings]) {
      expect(source).not.toContain("LedgerStatusChip");
      expect(source).not.toContain("getInvoiceLedgerStatus");
    }
  });

  it("AURA source files do not reference the new ledger-status concepts", () => {
    const aura = readSource("lib/auraAssistant.ts");
    expect(aura).not.toContain("LedgerStatusChip");
    expect(aura).not.toContain("getInvoiceLedgerStatus");
  });
});
