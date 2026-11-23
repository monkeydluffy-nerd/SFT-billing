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
    expect(indicators[0]).toHaveClass("absolute", "left-0", "rounded-r-full");
    expect(indicators[0]).not.toHaveAttribute("style");
  });
});

describe("SidebarNav branding", () => {
  it("renders the supplied full logo in a light chip above the primary action", () => {
    render(<SidebarNav />);

    const logo = screen.getByRole("img", { name: "Surfine Technology logo" });
    expect(logo).toHaveAttribute("src", "/brand/surfine-horizontal.png");
    expect(logo).toHaveClass("h-auto", "w-full", "object-contain");

    expect(screen.getByRole("button", { name: /new invoice/i })).toBeInTheDocument();
  });

  it("keeps the logo contained and the actions reachable when the sidebar is collapsed", () => {
    useWorkspaceStore.setState({ sidebarCollapsed: true });
    render(<SidebarNav />);

    const logo = screen.getByRole("img", { name: "Surfine Technology logo" });
    expect(logo).toHaveAttribute("src", "/brand/surfine-emblem.png");
    expect(logo).toHaveClass("h-auto", "object-contain", "w-9");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
