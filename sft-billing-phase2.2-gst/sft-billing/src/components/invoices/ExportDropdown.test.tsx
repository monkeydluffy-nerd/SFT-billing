import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Invoice } from "@/types";
import { ExportDropdown } from "./ExportDropdown";

const invoice: Invoice = {
  id: "invoice-export-test",
  number: "INV-1001",
  clientId: "client-export-test",
  issueDate: "2025-05-01T00:00:00.000Z",
  dueDate: "2025-05-20T00:00:00.000Z",
  items: [],
  gst: { cgstRate: 0.09, sgstRate: 0.09 },
  discount: 0,
  roundOff: 0,
  isDraft: false,
  billedAt: "2025-05-01T00:00:00.000Z",
};

function mockLayout({
  viewportWidth = 1024,
  viewportHeight = 768,
  buttonLeft = 300,
  buttonTop = 100,
  menuWidth = 160,
  menuHeight = 73,
}: {
  viewportWidth?: number;
  viewportHeight?: number;
  buttonLeft?: number;
  buttonTop?: number;
  menuWidth?: number;
  menuHeight?: number;
} = {}) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: viewportWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: viewportHeight });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this instanceof HTMLButtonElement && this.textContent?.trim() === "Export") {
      return new DOMRect(buttonLeft, buttonTop, 90, 38);
    }
    if (this.getAttribute("role") === "menu") {
      return new DOMRect(0, 0, menuWidth, menuHeight);
    }
    return new DOMRect();
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExportDropdown positioning", () => {
  it("aligns the menu under the button's left edge and renders it outside clipping ancestors", () => {
    mockLayout();
    render(<ExportDropdown invoice={invoice} />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("fixed", "z-50");
    expect(menu).toHaveStyle({ left: "300px", top: "144px" });
    expect(screen.getByRole("menuitem", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Download Excel" })).toBeInTheDocument();
  });

  it("clamps the menu to the viewport when the button is near the right edge", () => {
    mockLayout({ viewportWidth: 700, buttonLeft: 650 });
    render(<ExportDropdown invoice={invoice} />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("menu")).toHaveStyle({ left: "532px" });
  });

  it("places the menu above the button when it would otherwise extend below the viewport", () => {
    mockLayout({ viewportHeight: 400, buttonTop: 330 });
    render(<ExportDropdown invoice={invoice} />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("menu")).toHaveStyle({ top: "251px" });
  });

  it("keeps the menu open for inside clicks and closes it for outside clicks", () => {
    mockLayout();
    render(<ExportDropdown invoice={invoice} />);

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.mouseDown(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
