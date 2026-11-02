import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuraPanel } from "./AuraPanel";
import { useWorkspaceStore, type AppPage } from "@/hooks/useWorkspaceStore";

const PAGES: AppPage[] = [
  "overview",
  "invoices",
  "create-invoice",
  "invoice-detail",
  "clients",
  "products",
  "payments",
  "intelligence",
  "reports",
  "settings",
];

describe("AuraPanel footer-aware offset", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    useWorkspaceStore.setState({ currentPage: "overview", auraOpen: false });
  });

  it.each(PAGES)("uses bottom-24 on protected invoice pages and bottom-6 elsewhere (%s)", (page) => {
    useWorkspaceStore.setState({ currentPage: page });
    render(<AuraPanel />);

    const button = screen.getByRole("button", { name: /open aura/i });
    if (page === "create-invoice" || page === "invoice-detail") {
      expect(button.className).toContain("bottom-24");
      expect(button.className).not.toContain("bottom-6");
    } else {
      expect(button.className).toContain("bottom-6");
      expect(button.className).not.toContain("bottom-24");
    }
  });

  it("uses the same protected offset for the expanded panel on Invoice Detail", () => {
    useWorkspaceStore.setState({ currentPage: "invoice-detail", auraOpen: true });
    render(<AuraPanel />);

    const panel = screen.getByRole("dialog", { name: /aura financial workspace assistant/i });
    expect(panel.className).toContain("bottom-24");
    expect(panel.className).not.toContain("bottom-6");
  });
});
