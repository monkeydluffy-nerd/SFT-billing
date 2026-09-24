import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { render, screen } from "@testing-library/react";
import { LedgerStatusChip } from "./LedgerStatusChip";
import { StatusChip } from "./StatusChip";
import type { InvoiceLedgerStatusInfo, InvoiceStatusInfo } from "@/types";

describe("Feature: core-business-system, Property 16: Core-workflow ledger labels are exactly \"Outstanding\"/\"Received\"; legacy labels are unchanged", () => {
  it("LedgerStatusChip renders exactly Outstanding/Received for those statuses", () => {
    fc.assert(
      fc.property(fc.constantFrom<InvoiceLedgerStatusInfo["status"]>("outstanding", "received"), (status) => {
        const info: InvoiceLedgerStatusInfo = { status, daysOverdue: 0, severity: null };
        const { unmount } = render(<LedgerStatusChip info={info} />);
        if (status === "outstanding") {
          expect(screen.getByText("Outstanding")).toBeInTheDocument();
        } else {
          expect(screen.getByText("Received")).toBeInTheDocument();
        }
        unmount();
      }),
      { numRuns: 100 },
    );
  });

  it("StatusChip legacy labels remain Pending/Paid, unaffected by LedgerStatusChip", () => {
    fc.assert(
      fc.property(fc.constantFrom<InvoiceStatusInfo["status"]>("pending", "paid"), (status) => {
        const info: InvoiceStatusInfo = { status, daysOverdue: 0, severity: null };
        const { unmount } = render(<StatusChip info={info} />);
        if (status === "pending") {
          expect(screen.getByText("Pending")).toBeInTheDocument();
        } else {
          expect(screen.getByText("Paid")).toBeInTheDocument();
        }
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
