import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { activeDataProvider } from "@/services";
import type { Client } from "@/types";

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (clientId: string) => void;
  editingClient?: Client;
  onUpdated?: (client: Client) => void;
}

interface FormValues {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  billingAddress: string;
  gstin: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  billingAddress: "",
  gstin: "",
  notes: "",
};

function formValuesFromClient(client: Client): FormValues {
  return {
    name: client.name,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone ?? "",
    billingAddress: client.billingAddress,
    gstin: client.gstin ?? "",
    notes: client.notes ?? "",
  };
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = "Client name is required.";
  if (!values.contactName.trim()) errors.contactName = "Contact name is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.billingAddress.trim()) errors.billingAddress = "Billing address is required.";
  return errors;
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong";
const errorInputClass = "border-overdue";
const labelClass = "mb-1.5 block text-xs font-medium text-ink-muted";
const errorTextClass = "mt-1 text-xs text-overdue";

/**
 * Ported from phase1's AddClientModal structure and validation rules,
 * rewritten against activeDataProvider.createClient directly (no
 * appStore, no FormField/Input primitives — see design.md) to fit
 * phase2.2-gst's actual shared component set and Client type shape.
 */
export function AddClientModal({ open, onClose, onCreated, editingClient, onUpdated }: AddClientModalProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const isEditing = Boolean(editingClient);

  useEffect(() => {
    if (!open) return;
    setValues(editingClient ? formValuesFromClient(editingClient) : EMPTY_FORM);
    setErrors({});
    setRequestError(null);
  }, [open, editingClient]);

  function handleClose() {
    setValues(EMPTY_FORM);
    setErrors({});
    setRequestError(null);
    onClose();
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setRequestError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setRequestError(null);
    const fields = {
      name: values.name.trim(),
      contactName: values.contactName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      billingAddress: values.billingAddress.trim(),
      gstin: values.gstin.trim() || undefined,
      notes: values.notes.trim() || undefined,
    };

    try {
      if (editingClient) {
        const updated = await activeDataProvider.updateClient(editingClient.id, fields);
        setValues(EMPTY_FORM);
        setErrors({});
        onUpdated?.(updated);
      } else {
        const client: Client = {
          id: `cl_runtime_${Date.now()}`,
          ...fields,
          clientSince: new Date().toISOString(),
        };
        const created = await activeDataProvider.createClient(client);
        setValues(EMPTY_FORM);
        setErrors({});
        onCreated?.(created.id);
      }
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : `Couldn't ${isEditing ? "save" : "add"} client.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? "Edit client" : "Add client"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="add-client-form" disabled={submitting}>
            {submitting ? (isEditing ? "Saving…" : "Adding…") : isEditing ? "Save changes" : "Add client"}
          </Button>
        </>
      }
    >
      {requestError && <p role="alert" className="mb-3 rounded-md border border-overdue/20 bg-overdue-bg px-3 py-2 text-xs text-overdue">{requestError}</p>}
      <form id="add-client-form" onSubmit={handleSubmit} className="space-y-3 text-left">
        <div>
          <label className={labelClass} htmlFor="client-name">
            Client name
          </label>
          <input
            id="client-name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Acme Corporation"
            className={`${inputClass} ${errors.name ? errorInputClass : ""}`}
          />
          {errors.name && <p className={errorTextClass}>{errors.name}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="client-contact-name">
            Contact name
          </label>
          <input
            id="client-contact-name"
            value={values.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            placeholder="Priya Sharma"
            className={`${inputClass} ${errors.contactName ? errorInputClass : ""}`}
          />
          {errors.contactName && <p className={errorTextClass}>{errors.contactName}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="client-email">
            Email
          </label>
          <input
            id="client-email"
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="billing@acme.com"
            className={`${inputClass} ${errors.email ? errorInputClass : ""}`}
          />
          {errors.email && <p className={errorTextClass}>{errors.email}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="client-phone">
            Phone (optional)
          </label>
          <input
            id="client-phone"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+91 98765 43210"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="client-billing-address">
            Billing address
          </label>
          <textarea
            id="client-billing-address"
            value={values.billingAddress}
            onChange={(e) => update("billingAddress", e.target.value)}
            rows={2}
            placeholder="Street, city, state, PIN"
            className={`w-full rounded-md border bg-surface px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong ${
              errors.billingAddress ? errorInputClass : "border-border"
            }`}
          />
          {errors.billingAddress && <p className={errorTextClass}>{errors.billingAddress}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="client-gstin">
            GSTIN (optional)
          </label>
          <input
            id="client-gstin"
            value={values.gstin}
            onChange={(e) => update("gstin", e.target.value)}
            placeholder="22AAAAA0000A1Z5"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="client-notes">
            Notes (optional)
          </label>
          <textarea
            id="client-notes"
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this client…"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
          />
        </div>
      </form>
    </Modal>
  );
}
