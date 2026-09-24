import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, cleanup } from "@testing-library/react";
import { InvoiceNumberLink } from "./InvoiceNumberLink";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

afterEach(() => {
  cleanup();
  useWorkspaceStore.setState({
    currentPage: "overview",
    selectedInvoiceId: null,
    selectedPaymentId: null,
    paymentReceiptReturnState: null,
  });
});

describe("InvoiceNumberLink", () => {
  it("stops a parent row click and opens the exact invoice detail id", () => {
    let parentClicked = false;
    const { getByRole } = render(
      <div role="button" tabIndex={0} onClick={() => { parentClicked = true; }}>
        <InvoiceNumberLink invoice={{ id: "invoice-42", number: "INV-42" }} />
      </div>,
    );

    fireEvent.click(getByRole("button", { name: "Open invoice INV-42" }));

    expect(parentClicked).toBe(false);
    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
    expect(useWorkspaceStore.getState().selectedInvoiceId).toBe("invoice-42");
  });

  it("stops bubbled keyboard events from activating a row's alternate action", () => {
    let parentKeyDown = false;
    const { getByRole } = render(
      <div
        role="button"
        tabIndex={0}
        onKeyDown={() => {
          parentKeyDown = true;
        }}
      >
        <InvoiceNumberLink invoice={{ id: "invoice-7", number: "INV-7" }} />
      </div>,
    );
    const link = getByRole("button", { name: "Open invoice INV-7" });

    fireEvent.keyDown(link, { key: "Enter" });
    fireEvent.keyDown(link, { key: " " });
    fireEvent.click(link);

    expect(parentKeyDown).toBe(false);
    expect(useWorkspaceStore.getState().selectedInvoiceId).toBe("invoice-7");
    expect(useWorkspaceStore.getState().currentPage).toBe("invoice-detail");
  });
});
