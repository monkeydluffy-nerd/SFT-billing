import { useCallback, useEffect, useState, type FormEvent, type ReactNode, useRef } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { activeDataProvider } from "@/services";
import type { CatalogProduct, CatalogProductInput } from "@/types";
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/cn";

interface ProductFormPanelProps {
  onClose: () => void;
  onSaved: (product: CatalogProduct) => void;
  product?: CatalogProduct;
  duplicateProduct?: CatalogProduct;
}

interface ProductFormValues {
  code: string;
  name: string;
  hsnCode: string;
  defaultUnitPrice: string;
  gstPercent: string;
  type: "product" | "service";
  unit: string;
}

type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

const EMPTY_VALUES: ProductFormValues = {
  code: "",
  name: "",
  hsnCode: "",
  defaultUnitPrice: "",
  gstPercent: "",
  type: "product",
  unit: "Nos",
};

const inputClass =
  "h-9 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/15";
const labelClass = "mb-1.5 block text-xs font-medium text-ink-muted";
const errorTextClass = "mt-1 text-xs text-overdue";

const CODE_REGEX = /^[A-Z0-9_-]{1,40}$/;

function valuesFromProduct(product?: CatalogProduct): ProductFormValues {
  if (!product) return EMPTY_VALUES;
  return {
    code: product.code,
    name: product.name,
    hsnCode: product.hsnCode,
    defaultUnitPrice: String(product.defaultUnitPrice),
    gstPercent: String(product.defaultGstRate * 100),
    type: product.type,
    unit: product.unit,
  };
}

function apiValidationErrors(error: unknown): ProductFormErrors {
  if (!(error instanceof Error)) return {};
  try {
    const body = JSON.parse(error.message) as {
      errors?: Record<string, string>;
    };
    return body.errors ?? {};
  } catch {
    return {};
  }
}

function validate(values: ProductFormValues, editing: boolean): ProductFormErrors {
  const errors: ProductFormErrors = {};
  
  // Code validation
  if (!editing) {
    const code = values.code.trim();
    if (!code) {
      errors.code = "Product code is required.";
    } else if (!CODE_REGEX.test(code)) {
      errors.code = "Code must be 1-40 chars: A-Z, 0-9, _ or - only. No spaces.";
    }
  }
  
  // Name validation
  for (const field of ["name", "hsnCode"] as const) {
    if (!values[field].trim()) {
      errors[field] = "This field is required.";
    }
  }

  const price = Number(values.defaultUnitPrice);
  if (!values.defaultUnitPrice.trim() || !Number.isFinite(price) || price < 0) {
    errors.defaultUnitPrice = "Enter a valid nonnegative price.";
  }
  const gst = Number(values.gstPercent);
  if (!values.gstPercent.trim() || !Number.isFinite(gst) || gst < 0 || gst > 100) {
    errors.gstPercent = "Enter a GST rate between 0% and 100%.";
  }
  return errors;
}

export function ProductFormPanel({
  onClose,
  onSaved,
  product,
  duplicateProduct,
}: ProductFormPanelProps) {
  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(product);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  // Initialize form values when product changes (for edit mode)
  useEffect(() => {
    const initialValues = valuesFromProduct(product ?? duplicateProduct);
    setValues(product ? initialValues : { ...initialValues, code: "" });
    setErrors({});
    setRequestError(null);
  }, [product, duplicateProduct]);

  // Handle Escape key to close panel
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // Focus trap and prevent body scroll
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the close button or first input
    const closeButton = panel.querySelector('button[aria-label="Close"]') as HTMLElement;
    if (closeButton) {
      closeButton.focus();
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setRequestError(null);
  }

  function handleBackdropClick(event: React.MouseEvent) {
    // Only close if clicking directly on the backdrop, not on the panel content
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate(values, editing);
    setErrors(validation);
    if (Object.keys(validation).length) return;

    const code = editing ? product!.code : values.code.trim().toUpperCase();
    
    const editableFields: Pick<
      CatalogProductInput,
      "code" | "name" | "hsnCode" | "defaultUnitPrice" | "defaultGstRate" | "type" | "unit"
    > = {
      code,
      name: values.name.trim(),
      hsnCode: values.hsnCode.trim(),
      defaultUnitPrice: Number(values.defaultUnitPrice),
      defaultGstRate: Number(values.gstPercent) / 100,
      type: values.type,
      unit: values.unit,
    };
    const payload: CatalogProductInput = {
      ...editableFields,
      weight: null,
      weightUnit: null,
      purchaseCost: null,
      lowStockThreshold: null,
      isActive: true,
    };

    setSubmitting(true);
    setRequestError(null);
    try {
      const saved = product
        ? await activeDataProvider.updateCatalogProduct(product.id, editableFields)
        : await activeDataProvider.createCatalogProduct(payload);
      onSaved(saved);
    } catch (error) {
      const serverErrors = apiValidationErrors(error);
      if (Object.keys(serverErrors).length > 0) {
        setErrors(serverErrors);
      } else {
        setRequestError(error instanceof Error ? error.message : "Couldn't save product.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Live price preview with GST
  const priceWithGst = (() => {
    const price = Number(values.defaultUnitPrice);
    const gst = Number(values.gstPercent);
    if (!Number.isFinite(price) || !Number.isFinite(gst)) return null;
    return price * (1 + gst / 100);
  })();

  // Format code for display (uppercase, no spaces)
  const displayCode = values.code.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const codeValid = editing || CODE_REGEX.test(displayCode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
      ref={panelRef}
    >
      <div
        className="absolute inset-0 bg-black/20 transition-opacity duration-panel"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div className="relative flex flex-col w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg bg-surface shadow-float-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 id="product-form-title" className="font-display text-xl text-ink">
            {editing ? "Edit product" : "Add product"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-ink-muted hover:bg-canvas hover:text-ink transition-colors duration-micro disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {requestError && (
            <p role="alert" className="rounded-md border border-overdue/20 bg-overdue-bg px-3 py-2 text-xs text-overdue">
              {requestError}
            </p>
          )}

          {/* Live Price Preview with GST */}
          {priceWithGst !== null && (
            <div className="rounded-lg bg-premium/5 border border-premium/20 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Price incl. GST</span>
                <span className="font-tabular font-semibold text-ink">{formatCurrency(priceWithGst)}</span>
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                Base: {formatCurrency(Number(values.defaultUnitPrice) || 0)} + GST {values.gstPercent}% = {formatCurrency(priceWithGst)}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product code" id="product-code" error={errors.code}>
                <div className="relative">
                  <input
                    id="product-code"
                    value={editing ? product!.code : displayCode}
                    onChange={(event) => {
                      const val = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                      update("code", val);
                    }}
                    className={cn(inputClass, errors.code && "border-overdue", editing && "bg-canvas/50 cursor-not-allowed")}
                    placeholder="e.g. AR_LEVER_PIN_10X70"
                    disabled={editing}
                    maxLength={40}
                    aria-describedby={editing ? "code-locked-hint" : "code-format-hint"}
                  />
                  {editing && (
                    <>
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} aria-hidden />
                      <p id="code-locked-hint" className="mt-1 text-xs text-ink-faint">
                        Code stays the same when you change the name or price.
                      </p>
                    </>
                  )}
                  {!editing && (
                    <p id="code-format-hint" className="mt-1 text-xs text-ink-faint">
                      1–40 chars: A–Z, 0–9, _ or - only. No spaces. Auto-converted to uppercase.
                    </p>
                  )}
                  {!editing && !codeValid && values.code && (
                    <p className="mt-1 text-xs text-overdue" role="alert">
                      Invalid format. Use only A–Z, 0–9, _ or -.
                    </p>
                  )}
                  {!editing && codeValid && values.code && (
                    <p className="mt-1 text-xs text-success" role="status">
                      <CheckCircle2 size={12} className="inline" aria-hidden /> Format OK
                    </p>
                  )}
                </div>
              </Field>

              <Field label="Item name" id="product-name" error={errors.name}>
                <input
                  id="product-name"
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                  className={cn(inputClass, errors.name && "border-overdue")}
                  placeholder="e.g. Stainless Steel Lever Pin 10×70mm"
                />
              </Field>

              <Field label="HSN/SAC code" id="product-hsn" error={errors.hsnCode}>
                <input
                  id="product-hsn"
                  value={values.hsnCode}
                  onChange={(event) => update("hsnCode", event.target.value)}
                  className={cn(inputClass, errors.hsnCode && "border-overdue")}
                  placeholder="e.g. 7318"
                />
              </Field>

              <Field label="Default selling price (₹)" id="product-price" error={errors.defaultUnitPrice}>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.defaultUnitPrice}
                  onChange={(event) => update("defaultUnitPrice", event.target.value)}
                  className={cn(inputClass, errors.defaultUnitPrice && "border-overdue")}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Default GST rate (%)" id="product-gst" error={errors.gstPercent}>
                <input
                  id="product-gst"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={values.gstPercent}
                  onChange={(event) => update("gstPercent", event.target.value)}
                  className={cn(inputClass, errors.gstPercent && "border-overdue")}
                  placeholder="18"
                />
              </Field>

              <Field label="Type" id="product-type" error={errors.type}>
                <select
                  id="product-type"
                  value={values.type}
                  onChange={(event) => update("type", event.target.value as "product" | "service")}
                  className={cn(inputClass, "cursor-pointer")}
                >
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                </select>
              </Field>

              <Field label="Unit" id="product-unit" error={errors.unit}>
                <select
                  id="product-unit"
                  value={values.unit}
                  onChange={(event) => update("unit", event.target.value)}
                  className={cn(inputClass, "cursor-pointer")}
                >
                  <option value="Nos">Nos</option>
                  <option value="PCS">PCS</option>
                  <option value="MTR">MTR</option>
                  <option value="KG">KG</option>
                  <option value="LTR">LTR</option>
                  <option value="SET">SET</option>
                  <option value="BOX">BOX</option>
                </select>
              </Field>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Add product"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  error?: string;
  children: ReactNode;
}

function Field({ label, id, error, children }: FieldProps) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      {children}
      {error && <p className={errorTextClass}>{error}</p>}
    </div>
  );
}

// Import formatCurrency for the live preview
import { formatCurrency } from "@/lib/formatters";