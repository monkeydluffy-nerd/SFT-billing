import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { activeDataProvider } from "@/services";
import type {
  InventoryMovement,
  InventoryMovementType,
  ProductStock,
  CatalogProduct,
} from "@/types";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { formatDateTime } from "@/lib/formatters";

interface InventoryDetailsModalProps {
  open: boolean;
  product: CatalogProduct | null;
  onClose: () => void;
  onStockChanged: () => void;
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong";
const labelClass = "mb-1.5 block text-xs font-medium text-ink-muted";

function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi.randomUUID) return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The inventory request failed.";
  try {
    const parsed = JSON.parse(error.message) as { message?: string } | { errors?: unknown };
    if ("message" in parsed && parsed.message) return parsed.message;
    if ("errors" in parsed && parsed.errors) return JSON.stringify(parsed.errors);
  } catch {
    return error.message;
  }
  return error.message;
}

export function InventoryDetailsModal({
  open,
  product,
  onClose,
  onStockChanged,
}: InventoryDetailsModalProps) {
  const [stock, setStock] = useState<ProductStock | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovementType>("opening");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyRef = useRef(new Map<string, string>());
  const submittingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [currentStock, history] = await Promise.all([
        activeDataProvider.getProductStock(product.id),
        activeDataProvider.getInventoryMovements(product.id),
      ]);
      setStock(currentStock);
      setMovements(history);
      if (idempotencyRef.current.size === 0) {
        setMovementType(currentStock.stockOnHand === null ? "opening" : "receipt");
      }
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (!open || !product) return;
    setStock(null);
    setMovements([]);
    if (idempotencyRef.current.size === 0) {
      setMovementType("opening");
      setQuantity("");
      setReason("");
      setRequestError(null);
    }
    void refresh();
  }, [open, product, refresh]);

  const stockInitialized = stock?.stockOnHand !== null && stock !== null;
  const allowedTypes: InventoryMovementType[] = stockInitialized
    ? ["receipt", "issue", "adjustment"]
    : ["opening"];

  function updateMovementType(value: InventoryMovementType) {
    setMovementType(value);
    setQuantity("");
    setReason("");
    setRequestError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product || submittingRef.current) return;
    const parsedQuantity = Number(quantity);
    if (
      !quantity.trim() ||
      !Number.isFinite(parsedQuantity) ||
      (movementType === "opening" && parsedQuantity < 0) ||
      (movementType === "receipt" && parsedQuantity <= 0) ||
      (movementType === "issue" && parsedQuantity <= 0) ||
      (movementType === "adjustment" && parsedQuantity === 0) ||
      !/^-?\d+(\.\d{1,3})?$/.test(quantity.trim())
    ) {
      setRequestError("Enter a valid quantity with up to three decimal places.");
      return;
    }
    if (movementType === "adjustment" && !reason.trim()) {
      setRequestError("A reason is required for stock adjustments.");
      return;
    }

    const signature = JSON.stringify([movementType, parsedQuantity, reason.trim()]);
    const idempotencyKey =
      idempotencyRef.current.get(signature) ?? newIdempotencyKey();
    idempotencyRef.current.set(signature, idempotencyKey);

    submittingRef.current = true;
    setSubmitting(true);
    setRequestError(null);
    try {
      await activeDataProvider.recordInventoryMovement(product.id, {
        type: movementType,
        quantity: parsedQuantity,
        idempotencyKey,
        ...(movementType === "adjustment" ? { reason: reason.trim() } : {}),
      });
      idempotencyRef.current.delete(signature);
      setQuantity("");
      setReason("");
      setMovementType("receipt");
      onStockChanged();
      await refresh();
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={`Stock — ${product.name}`}
      panelClassName="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading || submitting}>
            <RefreshCw size={14} aria-hidden /> Refresh
          </Button>
        </>
      }
    >
      {loadError && (
        <div className="mb-4 rounded-md border border-overdue/20 bg-overdue-bg px-3 py-2 text-sm text-overdue" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 font-medium underline">
            Retry loading stock
          </button>
        </div>
      )}

      <div className="mb-5 rounded-md border border-border bg-canvas px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Stock on hand</p>
        <p className="mt-1 font-display text-2xl text-ink">
          {loading ? "Loading…" : stock?.stockOnHand === null ? "Not initialized" : stock ? formatQuantity(stock.stockOnHand, stock.unit) : "—"}
        </p>
      </div>

      {product.isActive && stock && (
        <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
          <div>
            <label className={labelClass} htmlFor="inventory-movement-type">Movement</label>
            <select
              id="inventory-movement-type"
              value={movementType}
              onChange={(event) => updateMovementType(event.target.value as InventoryMovementType)}
              className={inputClass}
              disabled={submitting}
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "opening" ? "Opening stock" : type[0].toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="inventory-quantity">
              Quantity {movementType === "adjustment" ? "(signed)" : ""}
            </label>
            <input
              id="inventory-quantity"
              type="number"
              step="0.001"
              min={movementType === "adjustment" ? undefined : "0"}
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setRequestError(null);
              }}
              className={inputClass}
              placeholder={`e.g. 1 ${stock.unit}`}
              disabled={submitting}
            />
          </div>
          {movementType === "adjustment" ? (
            <div>
              <label className={labelClass} htmlFor="inventory-reason">Reason (required)</label>
              <input
                id="inventory-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setRequestError(null);
                }}
                className={inputClass}
                placeholder="Required"
                disabled={submitting}
              />
            </div>
          ) : <span className="hidden text-xs text-ink-faint sm:block">Unit: {stock.unit}</span>}
          <Button type="submit" disabled={submitting || loading}>
            {submitting ? "Saving…" : "Record movement"}
          </Button>
          {requestError && (
            <p className="text-xs text-overdue sm:col-span-4" role="alert">
              <AlertTriangle size={14} className="mr-1 inline" aria-hidden />{requestError}
            </p>
          )}
        </form>
      )}
      {!product.isActive && (
        <p className="mb-5 text-sm text-ink-muted">This product is inactive. Inventory movements are disabled.</p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-canvas text-xs text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Movement</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t border-border">
                <td className="px-3 py-2 text-ink-muted">{formatDateTime(movement.occurredAt)}</td>
                <td className="px-3 py-2 capitalize text-ink">{movement.type}</td>
                <td className="px-3 py-2 text-right font-tabular text-ink">
                  {formatQuantity(movement.quantityChange, stock?.unit ?? product.unit)}
                </td>
                <td className="px-3 py-2 text-right font-tabular text-ink">
                  {formatQuantity(movement.resultingBalance, stock?.unit ?? product.unit)}
                </td>
                <td className="px-3 py-2 text-ink-muted">{movement.reason ?? "—"}</td>
              </tr>
            ))}
            {!loading && !loadError && movements.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">No inventory movements yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">Loading movement history…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
