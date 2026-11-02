import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { render, fireEvent } from "@testing-library/react";
import { InvoiceNumberLink } from "./InvoiceNumberLink";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

describe("Feature: core-business-system, Property 12: Invoice numbers are links everywhere required, and always resolve to the right invoice", () => {
  it("clicking the rendered invoice number always navigates to that exact invoice's detail id", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.string({ minLength: 1, maxLength: 10 }).map((s) => `INV-${s}`), (id, number) => {
        useWorkspaceStore.setState({ selectedInvoiceId: null, currentPage: "overview" });
        const { unmount, getByRole } = render(<InvoiceNumberLink invoice={{ id, number }} />);
        const button = getByRole("button");
        fireEvent.click(button);
        expect(useWorkspaceStore.getState().selectedInvoiceId).toBe(id);
        expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
