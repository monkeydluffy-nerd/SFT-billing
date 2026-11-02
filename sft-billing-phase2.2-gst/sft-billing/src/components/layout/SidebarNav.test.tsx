import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarNav } from "./SidebarNav";
import { useWorkspaceStore, type AppPage } from "@/hooks/useWorkspaceStore";

const navigationPages: Array<[AppPage, string]> = [
  ["overview", "Overview"],
  ["invoices", "Invoices"],
  ["clients", "Clients"],
  ["products", "Products"],
  ["payments", "Payments"],
  ["reports", "Reports"],
  ["settings", "Workspace Settings"],
];

afterEach(() => {
  useWorkspaceStore.setState({ currentPage: "overview", sidebarCollapsed: false });
});

describe("SidebarNav active indicator", () => {
  it.each(navigationPages)("keeps the active marker beside %s only", (page, label) => {
    useWorkspaceStore.setState({ currentPage: page, sidebarCollapsed: false });
    const { container } = render(<SidebarNav />);

    const activeButton = screen.getByRole("button", { name: label });
    expect(activeButton).toHaveAttribute("aria-current", "page");

    const indicators = container.querySelectorAll(".sidebar-active-indicator");
    expect(indicators).toHaveLength(1);
    expect(indicators[0].parentElement).toBe(activeButton);
    expect(indicators[0]).toHaveClass("absolute", "right-0", "top-0", "bottom-0");
    expect(indicators[0]).not.toHaveAttribute("style");
  });
});

describe("SidebarNav branding", () => {
  it("renders the supplied full logo above the unchanged industrial brand card", () => {
    const { container } = render(<SidebarNav />);

    const logo = screen.getByRole("img", { name: "Surfine Technology logo" });
    expect(logo).toHaveAttribute("src", "/surfine-technology-logo.png");
    expect(logo).toHaveClass("h-auto", "w-full", "max-w-[224px]", "object-contain");
    expect(logo.parentElement).toHaveClass("pt-6", "pb-6");

    const bottomImage = container.querySelector<HTMLImageElement>(
      'img[src="/metal-forging-press.jpg"]',
    );
    expect(bottomImage).not.toBeNull();
    expect(bottomImage).toHaveAttribute("alt", "");
    expect(bottomImage).toHaveClass(
      "absolute",
      "inset-0",
      "h-full",
      "w-full",
      "object-cover",
      "object-center",
    );
    expect(screen.getByText("Precision in every detail.")).toBeInTheDocument();
    expect(screen.getByText("For a stronger business tomorrow.")).toBeInTheDocument();
  });

  it("keeps the complete logo contained when the sidebar is collapsed", () => {
    useWorkspaceStore.setState({ sidebarCollapsed: true });
    render(<SidebarNav />);

    const logo = screen.getByRole("img", { name: "Surfine Technology logo" });
    expect(logo).toHaveAttribute("src", "/surfine-technology-logo.png");
    expect(logo).toHaveClass("h-auto", "w-12", "object-contain");
    expect(logo.parentElement).toHaveClass("px-0");
  });
});
