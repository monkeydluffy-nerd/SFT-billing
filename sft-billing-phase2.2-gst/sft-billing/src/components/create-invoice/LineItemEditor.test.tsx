import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LineItemEditor } from "./LineItemEditor";
import type { InvoiceLineItem } from "@/types";

function buildItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return { id: "li_1", description: "", hsnCode: "", quantity: 1, unitPrice: 0, ...overrides };
}

describe("LineItemEditor numeric fields", () => {
  it("displays typed digits without a leading zero", async () => {
    const item = buildItem({ unitPrice: 0 });
    const onChange = vi.fn();
    render(<LineItemEditor items={[item]} products={[]} onChange={onChange} errors={{}} />);

    const unitPriceInput = screen.getAllByRole("textbox")[3] as HTMLInputElement;
    await userEvent.type(unitPriceInput, "200");

    expect(unitPriceInput).toHaveValue("200");
  });

  it("does not prepend stale digits after clearing and retyping", async () => {
    const item = buildItem({ unitPrice: 50 });
    const onChange = vi.fn();
    render(<LineItemEditor items={[item]} products={[]} onChange={onChange} errors={{}} />);

    const unitPriceInput = screen.getAllByRole("textbox")[3] as HTMLInputElement;
    await userEvent.clear(unitPriceInput);
    await userEvent.type(unitPriceInput, "7");

    expect(unitPriceInput).toHaveValue("7");
  });

  it("shows an empty unit price field as empty, not a forced 0", () => {
    const item = buildItem({ unitPrice: 0 });
    const onChange = vi.fn();
    render(<LineItemEditor items={[item]} products={[]} onChange={onChange} errors={{}} />);

    const unitPriceInput = screen.getAllByRole("textbox")[3] as HTMLInputElement;
    expect(unitPriceInput).toHaveValue("");
  });

  it("preserves a trailing decimal point while typing and sends a finite numeric value", async () => {
    const item = buildItem({ unitPrice: 0 });
    const onChange = vi.fn();
    render(<LineItemEditor items={[item]} products={[]} onChange={onChange} errors={{}} />);

    const unitPriceInput = screen.getAllByRole("textbox")[3] as HTMLInputElement;
    await userEvent.type(unitPriceInput, "12.");

    expect(unitPriceInput).toHaveValue("12.");
    const latestItems = onChange.mock.calls[onChange.mock.calls.length - 1][0] as InvoiceLineItem[];
    expect(latestItems[0].unitPrice).toBe(12);
    expect(Number.isFinite(latestItems[0].unitPrice)).toBe(true);
  });

  it("preserves quantity text, including a trailing decimal point", async () => {
    const item = buildItem({ quantity: 1 });
    const onChange = vi.fn();
    render(<LineItemEditor items={[item]} products={[]} onChange={onChange} errors={{}} />);

    const quantityInput = screen.getAllByRole("textbox")[2] as HTMLInputElement;
    await userEvent.clear(quantityInput);
    await userEvent.type(quantityInput, "2.");

    expect(quantityInput).toHaveValue("2.");
    const latestItems = onChange.mock.calls[onChange.mock.calls.length - 1][0] as InvoiceLineItem[];
    expect(latestItems[0].quantity).toBe(2);
    expect(Number.isFinite(latestItems[0].quantity)).toBe(true);
  });

  it("keeps an oversized numeric buffer out of the domain model", () => {
    const item = buildItem({ unitPrice: 25 });
    const onChange = vi.fn();
    render(<LineItemEditor items={[item]} products={[]} onChange={onChange} errors={{}} />);

    const unitPriceInput = screen.getAllByRole("textbox")[3] as HTMLInputElement;
    const oversizedValue = "9".repeat(400);
    fireEvent.change(unitPriceInput, { target: { value: oversizedValue } });

    expect(unitPriceInput).toHaveValue(oversizedValue);
    expect(onChange).not.toHaveBeenCalled();
  });
});
