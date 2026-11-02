import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsPage } from "./ProductsPage";
import { activeDataProvider } from "@/services";
import type { CatalogProduct } from "@/types";

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "pr_test",
    code: "PART-1",
    name: "Widget",
    type: "product",
    hsnCode: "1234",
    unit: "pcs",
    defaultUnitPrice: 125.5,
    defaultGstRate: 0.18,
    weight: null,
    weightUnit: null,
    purchaseCost: null,
    lowStockThreshold: null,
    stockOnHand: null,
    isActive: true,
    isArchived: false,
    createdAt: "2026-10-23T08:00:00.000Z",
    updatedAt: "2026-10-23T08:00:00.000Z",
    ...overrides,
  };
}

// Helper to find product row by name (finds the row containing the product name)
function getProductRow(name: string) {
  // Find the element containing the product name, then go up to the row
  const nameElement = screen.getByText(name);
  return nameElement.closest('[style*="min-height"]')!;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProductsPage", () => {
  it("shows the simplified catalog without inventory or filter controls", async () => {
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([
      makeProduct(),
      makeProduct({
        id: "pr_service",
        code: "SVC-1",
        name: "Repair service",
        type: "service",
        isActive: false,
      }),
    ]);

    render(<ProductsPage />);

    expect(await screen.findByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Repair service")).toBeInTheDocument();
    // GST now appears in subline under name (2 products) + filter chips (18% chip)
    expect(screen.getAllByText("18%")).toHaveLength(3);
    // Status column and Activate/Deactivate buttons removed
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
    // Status column removed
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/stock|weight|pcs/i)).not.toBeInTheDocument();
    expect(screen.queryByText("service", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view stock/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search products" }), {
      target: { value: "SVC-1" },
    });
    expect(screen.getByText("Repair service")).toBeInTheDocument();
    expect(screen.queryByText("Widget")).not.toBeInTheDocument();
  });

  it("offers a retry when loading the catalog fails", async () => {
    vi.spyOn(activeDataProvider, "getCatalogProducts")
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce([makeProduct()]);

    render(<ProductsPage />);

    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Widget")).toBeInTheDocument();
  });

  it("shows Edit and Delete actions in the Actions column via hover menu", async () => {
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([
      makeProduct(),
    ]);

    render(<ProductsPage />);

    // Wait for loading to finish and products to render
    await screen.findByText("Widget");

    // Hover the row to reveal actions - find row by title attribute on name cell
    const row = getProductRow("Widget");
    await userEvent.hover(row);

    // Edit button should be visible on hover (aria-label "Edit Widget")
    expect(screen.getByRole("button", { name: "Edit Widget" })).toBeInTheDocument();
    // More menu button should be visible on hover (aria-label "More actions for Widget")
    expect(screen.getByRole("button", { name: "More actions for Widget" })).toBeInTheDocument();
    // No Activate/Deactivate buttons
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });

  it("opens edit form when Edit is clicked", async () => {
    const product = makeProduct();
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([product]);

    render(<ProductsPage />);
    await screen.findByText("Widget");
    await userEvent.hover(getProductRow("Widget"));
    await userEvent.click(screen.getByRole("button", { name: "Edit Widget" }));

    const dialog = screen.getByRole("dialog", { name: "Edit product" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Item name")).toHaveValue("Widget");
  });

  it("opens delete confirmation when Delete is chosen from more menu", async () => {
    const product = makeProduct();
    const getProducts = vi.spyOn(activeDataProvider, "getCatalogProducts")
      .mockResolvedValueOnce([product])
      .mockResolvedValue([]);
    const remove = vi.spyOn(activeDataProvider, "deleteCatalogProduct").mockResolvedValue();

    render(<ProductsPage />);
    await screen.findByText("Widget");
    await userEvent.hover(getProductRow("Widget"));
    // Open more menu
    await userEvent.click(screen.getByRole("button", { name: "More actions for Widget" }));
    // Click Delete in menu
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete PART-1 — Widget?" });
    expect(dialog).toHaveTextContent("PART-1");
    expect(dialog).toHaveTextContent("Widget");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(product.id));
    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent("PART-1 — Widget deleted");
  });

  it("shows the backend protection error and prevents duplicate delete submissions", async () => {
    const product = makeProduct();
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([product]);
    let resolveDelete!: () => void;
    const remove = vi.spyOn(activeDataProvider, "deleteCatalogProduct").mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    render(<ProductsPage />);
    await screen.findByText("Widget");
    await userEvent.hover(getProductRow("Widget"));
    await userEvent.click(screen.getByRole("button", { name: "More actions for Widget" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete PART-1 — Widget?" });
    const deleteButton = within(dialog).getByRole("button", { name: "Delete" });
    await userEvent.click(deleteButton);
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
    await userEvent.click(deleteButton);
    expect(remove).toHaveBeenCalledTimes(1);

    resolveDelete();
    await waitFor(() => expect(screen.queryByRole("dialog", {
      name: "Delete PART-1 — Widget?",
    })).not.toBeInTheDocument());
  });

  it("keeps a useful delete error visible and leaves product intact after failure", async () => {
    const product = makeProduct();
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([product]);
    vi.spyOn(activeDataProvider, "deleteCatalogProduct").mockRejectedValue(
      new Error('{"message":"Cannot delete product referenced by historical invoice items. Deactivate instead."}'),
    );

    render(<ProductsPage />);
    await screen.findByText("Widget");
    await userEvent.hover(getProductRow("Widget"));
    await userEvent.click(screen.getByRole("button", { name: "More actions for Widget" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete PART-1 — Widget?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Cannot delete product referenced by historical invoice items. Deactivate instead.",
    );
    expect(screen.getAllByText("Widget").length).toBeGreaterThan(0);
  });

  it("still supports editing an inactive product", async () => {
    const product = makeProduct({ isActive: false });
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([product]);
    const update = vi.spyOn(activeDataProvider, "updateCatalogProduct")
      .mockResolvedValue({ ...product, name: "Updated widget" });

    render(<ProductsPage />);
    await screen.findByText("Widget");
    await userEvent.hover(getProductRow("Widget"));
    await userEvent.click(screen.getByRole("button", { name: "Edit Widget" }));
    const form = screen.getByRole("dialog", { name: "Edit product" });
    await userEvent.clear(within(form).getByLabelText("Item name"));
    await userEvent.type(within(form).getByLabelText("Item name"), "Updated widget");
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
  });

  it("does not render the HSN filter control", async () => {
    vi.spyOn(activeDataProvider, "getCatalogProducts").mockResolvedValue([
      makeProduct({ hsnCode: "1234" }),
      makeProduct({ id: "pr_2", code: "PART-2", name: "Gadget", hsnCode: "5678" }),
    ]);

    render(<ProductsPage />);
    await screen.findByText("Widget");

    // HSN filter dropdown should not be present
    expect(screen.queryByRole("button", { name: "Filter by HSN" })).not.toBeInTheDocument();
    expect(screen.queryByText("All HSN")).not.toBeInTheDocument();
    // HSN group option should not be in Group By toggle
    expect(screen.queryByText("Group: HSN")).not.toBeInTheDocument();
  });
});