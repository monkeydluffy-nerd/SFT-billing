import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { ProductsPage } from "./ProductsPage";

afterEach(() => {
  useWorkspaceStore.setState({ currentPage: "overview", sidebarCollapsed: false });
});

describe("Products navigation", () => {
  it("opens the Products page from the primary sidebar", () => {
    render(<SidebarNav />);
    fireEvent.click(screen.getByRole("button", { name: "Products" }));
    expect(useWorkspaceStore.getState().currentPage).toBe("products");
  });

  it("opens the add-product form from the page action", async () => {
    render(<ProductsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    expect(await screen.findByRole("dialog", { name: "Add product" })).toBeInTheDocument();
  });
});
