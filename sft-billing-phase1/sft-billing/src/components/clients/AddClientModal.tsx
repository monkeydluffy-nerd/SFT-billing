import { useState, useCallback } from "react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { FormField, Input, Textarea } from "@/components/shared/FormField";
import { useAppStore } from "@/stores/appStore";

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after the client is successfully created, with the new client's id. */
  onCreated?: (clientId: string) => void;
}

interface FormValues {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  billingAddress: string;
  taxId: string;
  website: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  contactName?: string;
  email?: string;
  billingAddress?: string;
}

const EMPTY_FORM: FormValues = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  billingAddress: "",
  taxId: "",
  website: "",
  notes: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = "Company / Name is required.";
  if (!values.contactName.trim()) errors.contactName = "Contact name is required.";
  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.billingAddress.trim()) errors.billingAddress = "Billing address is required.";
  return errors;
}

export function AddClientModal({ open, onClose, onCreated }: AddClientModalProps) {
  const createClient = useAppStore((s) => s.createClient);

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setValues(EMPTY_FORM);
    setErrors({});
    setTouched({});
    setSubmitting(false);
    onClose();
  }, [onClose]);

  const handleChange = useCallback(
    (field: keyof FormValues) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const updated = { ...values, [field]: e.target.value };
        setValues(updated);
        if (touched[field]) {
          setErrors(validate(updated));
        }
      },
    [values, touched],
  );

  const handleBlur = useCallback(
    (field: keyof FormValues) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setErrors(validate(values));
    },
    [values],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Touch all validated fields to surface errors
      setTouched({ name: true, contactName: true, email: true, billingAddress: true });
      const errs = validate(values);
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;

      setSubmitting(true);
      try {
        const client = createClient({
          name: values.name.trim(),
          contactName: values.contactName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || undefined,
          billingAddress: values.billingAddress.trim(),
          taxId: values.taxId.trim() || undefined,
          website: values.website.trim() || undefined,
          notes: values.notes.trim() || undefined,
          clientSince: new Date().toISOString().split("T")[0],
        });
        onCreated?.(client.id);
        handleClose();
      } finally {
        setSubmitting(false);
      }
    },
    [values, createClient, handleClose, onCreated],
  );

  const isInvalid = Object.keys(validate(values)).length > 0;

  return (
    <Modal open={open} onClose={handleClose} title="Add Client" size="xl">
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-5">
          {/* Row 1: Company Name + Contact Name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Company / Name"
              required
              error={touched.name ? errors.name : undefined}
            >
              <Input
                type="text"
                value={values.name}
                onChange={handleChange("name")}
                onBlur={handleBlur("name")}
                placeholder="Acme Corporation"
                autoFocus
              />
            </FormField>

            <FormField
              label="Contact Name"
              required
              error={touched.contactName ? errors.contactName : undefined}
            >
              <Input
                type="text"
                value={values.contactName}
                onChange={handleChange("contactName")}
                onBlur={handleBlur("contactName")}
                placeholder="Jane Smith"
              />
            </FormField>
          </div>

          {/* Row 2: Email + Phone */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Email Address"
              required
              error={touched.email ? errors.email : undefined}
            >
              <Input
                type="email"
                value={values.email}
                onChange={handleChange("email")}
                onBlur={handleBlur("email")}
                placeholder="jane@acme.com"
              />
            </FormField>

            <FormField label="Phone">
              <Input
                type="tel"
                value={values.phone}
                onChange={handleChange("phone")}
                placeholder="+91 98765 43210"
              />
            </FormField>
          </div>

          {/* Billing Address */}
          <FormField
            label="Billing Address"
            required
            error={touched.billingAddress ? errors.billingAddress : undefined}
          >
            <Textarea
              value={values.billingAddress}
              onChange={handleChange("billingAddress")}
              onBlur={handleBlur("billingAddress")}
              placeholder={"123 Business Park\nMumbai, MH 400001\nIndia"}
              rows={3}
            />
          </FormField>

          {/* Row 3: Tax ID + Website */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Tax ID / GSTIN" hint="Optional — appears on invoices.">
              <Input
                type="text"
                value={values.taxId}
                onChange={handleChange("taxId")}
                placeholder="29AABCU9603R1ZX"
              />
            </FormField>

            <FormField label="Website">
              <Input
                type="url"
                value={values.website}
                onChange={handleChange("website")}
                placeholder="https://acme.com"
              />
            </FormField>
          </div>

          {/* Notes */}
          <FormField label="Notes" hint="Internal notes — not shown to the client.">
            <Textarea
              value={values.notes}
              onChange={handleChange("notes")}
              placeholder="Any additional context about this client…"
              rows={2}
            />
          </FormField>

          {/* Footer actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isInvalid || submitting}
            >
              {submitting ? "Saving…" : "Save Client"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
