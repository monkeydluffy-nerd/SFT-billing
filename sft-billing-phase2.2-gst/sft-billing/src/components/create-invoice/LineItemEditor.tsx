import { useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { Trash2, Plus } from "lucide-react";
import type { InvoiceLineItem, Product } from "@/types";
import { newLineItem } from "@/lib/invoiceDraft";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface LineItemEditorProps {
  items: InvoiceLineItem[];
  products: Product[];
  onChange: (items: InvoiceLineItem[]) => void;
  errors: Record<string, string | undefined>;
}

/**
 * Keyboard flow: Tab moves description → quantity → unit price → next
 * row, same as any form. Pressing Enter while in the last row's unit
 * price field adds a fresh row and focuses its description field —
 * pressing Enter in an earlier row's unit price field just moves focus
 * down to the next row instead, which is the more useful default there.
 */
export function LineItemEditor({ items, products, onChange, errors }: LineItemEditorProps) {
  const [suggestFor, setSuggestFor] = useState<string | null>(null);
  const descriptionRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Text buffers for the two numeric fields, keyed by line item id. Tracking
  // the displayed string separately from the numeric model value is what
  // avoids the controlled type="number" leading-zero/stale-digit bug — see
  // design.md's "unit price / quantity leading-zero bug" section.
  const [quantityText, setQuantityText] = useState<Record<string, string>>({});
  const [unitPriceText, setUnitPriceText] = useState<Record<string, string>>({});

  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function displayValue(map: Record<string, string>, id: string, numeric: number): string {
    return id in map ? map[id] : numeric === 0 ? "" : String(numeric);
  }

  function handleNumericChange(
    id: string,
    raw: string,
    setMap: Dispatch<SetStateAction<Record<string, string>>>,
    field: "quantity" | "unitPrice",
  ) {
    if (!/^\d*\.?\d*$/.test(raw)) return; // reject non-numeric keystrokes outright
    setMap((prev) => ({ ...prev, [id]: raw }));
    const parsed = raw === "" || raw === "." ? 0 : Number(raw);
    if (Number.isFinite(parsed)) updateItem(id, { [field]: parsed });
  }

  function removeItem(id: string) {
    setQuantityText((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setUnitPriceText((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (items.length === 1) {
      // Never leave zero rows — clear it back to blank instead.
      onChange([newLineItem()]);
      return;
    }
    onChange(items.filter((item) => item.id !== id));
  }

  function addRow(focusAfter = true) {
    const item = newLineItem();
    onChange([...items, item]);
    if (focusAfter) {
      requestAnimationFrame(() => descriptionRefs.current.get(item.id)?.focus());
    }
  }

  function focusRow(index: number) {
    const target = items[index];
    if (target) descriptionRefs.current.get(target.id)?.focus();
  }

  function onUnitPriceKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index === items.length - 1) {
      addRow();
    } else {
      focusRow(index + 1);
    }
  }

  function productSuggestions(query: string): Product[] {
    if (!query.trim()) return [];
    return products
      .map((product) => ({ product, match: fuzzyMatch(query, product.name) }))
      .filter(({ match }) => match.matches)
      .sort((a, b) => a.match.score - b.match.score)
      .map(({ product }) => product)
      .slice(0, 5);
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_92px_56px_100px_100px_28px] gap-2 px-1 pb-1.5 text-xs font-medium text-ink-faint">
        <span>Description</span>
        <span>HSN/SAC</span>
        <span>Qty</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="space-y-1.5">
        {items.map((item, index) => {
          const amount = item.quantity * item.unitPrice;
          const error = errors[item.id];
          const suggestions = suggestFor === item.id ? productSuggestions(item.description) : [];

          return (
            <div key={item.id}>
              <div className="grid grid-cols-[1fr_92px_56px_100px_100px_28px] items-center gap-2">
                <div className="relative">
                  <input
                    ref={(el) => {
                      if (el) descriptionRefs.current.set(item.id, el);
                      else descriptionRefs.current.delete(item.id);
                    }}
                    value={item.description}
                    onChange={(e) => {
                      updateItem(item.id, { description: e.target.value });
                      setSuggestFor(item.id);
                    }}
                    onFocus={() => setSuggestFor(item.id)}
                    onBlur={() => setTimeout(() => setSuggestFor((cur) => (cur === item.id ? null : cur)), 120)}
                    placeholder="Consulting hours, hosting, license…"
                    className={cn(
                      "h-9 w-full rounded-md border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint",
                      error ? "border-overdue" : "border-border focus:border-border-strong",
                    )}
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface-raised shadow-float">
                      {suggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            updateItem(item.id, {
                              description: product.name,
                              unitPrice: product.defaultUnitPrice,
                              productId: product.id,
                              hsnCode: product.hsnCode ?? item.hsnCode,
                            });
                            setUnitPriceText((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            });
                            setSuggestFor(null);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-canvas"
                        >
                          <span className="truncate">{product.name}</span>
                          <span className="font-tabular shrink-0 text-xs text-ink-faint">{formatCurrency(product.defaultUnitPrice)}/{product.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  value={item.hsnCode ?? ""}
                  onChange={(e) => updateItem(item.id, { hsnCode: e.target.value })}
                  placeholder="HSN"
                  className="font-tabular h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink outline-none focus:border-border-strong"
                />

                <input
                  type="text"
                  inputMode="decimal"
                  value={displayValue(quantityText, item.id, item.quantity)}
                  onChange={(e) => handleNumericChange(item.id, e.target.value, setQuantityText, "quantity")}
                  className="font-tabular h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong"
                />

                <input
                  type="text"
                  inputMode="decimal"
                  value={displayValue(unitPriceText, item.id, item.unitPrice)}
                  onChange={(e) => handleNumericChange(item.id, e.target.value, setUnitPriceText, "unitPrice")}
                  onKeyDown={(e) => onUnitPriceKeyDown(e, index)}
                  className="font-tabular h-9 w-full rounded-md border border-border bg-surface px-2.5 text-right text-sm text-ink outline-none focus:border-border-strong"
                />

                <p className="font-tabular text-right text-sm text-ink">{formatCurrency(amount)}</p>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove line item"
                  className="flex h-9 w-7 items-center justify-center rounded-md text-ink-faint transition-colors duration-micro hover:bg-canvas hover:text-overdue"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {error && <p className="mt-1 px-1 text-xs text-overdue">{error}</p>}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => addRow(false)}
        className="mt-2.5 flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm font-medium text-accent transition-colors duration-micro hover:bg-accent/5"
      >
        <Plus size={14} /> Add line item
      </button>
    </div>
  );
}
