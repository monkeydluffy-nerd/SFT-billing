import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { activeDataProvider } from "@/services";
import type { CatalogProduct, CatalogProductInput } from "@/types";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { getApiBaseUrl } from "@/services/backendPort";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (product: CatalogProduct) => void;
  product?: CatalogProduct;
}

interface ProductFormValues {
  code: string;
  name: string;
  hsnCode: string;
  defaultUnitPrice: string;
  gstPercent: string;
}

type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

const EMPTY_VALUES: ProductFormValues = {
  code: "",
  name: "",
  hsnCode: "",
  defaultUnitPrice: "",
  gstPercent: "",
};

async function fetchNextProductCode(): Promise<string> {
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/products/next-code`);
    if (!response.ok) throw new Error("Failed to fetch next product code");
    const data = await response.json();
    return data.code || "";
  } catch {
    return "";
  }
}

const inputClass =
  "h-9 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/15";
const labelClass = "mb-1.5 block text-xs font-medium text-ink-muted";
const errorTextClass = "mt-1 text-xs text-overdue";

function valuesFromProduct(product?: CatalogProduct): ProductFormValues {
  if (!product) return EMPTY_VALUES;
  return {
    code: product.code,
    name: product.name,
    hsnCode: product.hsnCode,
    defaultUnitPrice: String(product.defaultUnitPrice),
    gstPercent: String(product.defaultGstRate * 100),
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

function validate(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  for (const field of ["code", "name", "hsnCode"] as const) {
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

export function ProductFormModal({
  open,
  onClose,
  onSaved,
  product,
}: ProductFormModalProps) {
  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(product);

  useEffect(() => {
    if (!open) return;
    const loadForm = async () => {
      const baseValues = valuesFromProduct(product);
      // Auto-generate next product code for new products
      if (!editing) {
        const nextCode = await fetchNextProductCode();
        if (nextCode) {
          baseValues.code = nextCode;
        }
      }
      setValues(baseValues);
      setErrors({});
      setRequestError(null);
    };
    loadForm();
  }, [open, product, editing]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setRequestError(null);
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;

    const editableFields: Pick<
      CatalogProductInput,
      "code" | "name" | "hsnCode" | "defaultUnitPrice" | "defaultGstRate"
    > = {
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      hsnCode: values.hsnCode.trim(),
      defaultUnitPrice: Number(values.defaultUnitPrice),
      defaultGstRate: Number(values.gstPercent) / 100,
    };
    const payload: CatalogProductInput = {
      ...editableFields,
      type: "product",
      unit: "Nos",
      weight: null,
      weightUnit: null,
      purchaseCost: null,
      lowStockThreshold: null,
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? "Edit product" : "Add product"}
      panelClassName="max-w-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      {requestError && (
        <p role="alert" className="mb-3 rounded-md border border-overdue/20 bg-overdue-bg px-3 py-2 text-xs text-overdue">
          {requestError}
        </p>
      )}
      <form id="product-form" onSubmit={handleSubmit} className="space-y-3 text-left">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Product code" id="product-code" error={errors.code}>
            <input
              id="product-code"
              value={values.code}
              onChange={(event) => update("code", event.target.value)}
              className={inputClass}
              readOnly={!editing}
              aria-readonly={!editing}
            />
            {!editing && (
              <p className="mt-1 text-xs text-ink-muted">
                Auto-generated: next available SFT code
              </p>
            )}
          </Field>
          <Field label="Item name" id="product-name" error={errors.name}>
            <input id="product-name" value={values.name} onChange={(event) => update("name", event.target.value)} className={inputClass} />
          </Field>
          <Field label="HSN/SAC code" id="product-hsn" error={errors.hsnCode}>
            <input id="product-hsn" value={values.hsnCode} onChange={(event) => update("hsnCode", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Default selling price (₹)" id="product-price" error={errors.defaultUnitPrice}>
            <input id="product-price" type="number" min="0" step="0.01" value={values.defaultUnitPrice} onChange={(event) => update("defaultUnitPrice", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Default GST rate (%)" id="product-gst" error={errors.gstPercent}>
            <input id="product-gst" type="number" min="0" max="100" step="0.01" value={values.gstPercent} onChange={(event) => update("gstPercent", event.target.value)} className={inputClass} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      {children}
      {error && <p className={errorTextClass}>{error}</p>}
    </div>
  );
}
