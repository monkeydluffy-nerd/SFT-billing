import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, ArrowLeft, Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { FormField, Input, Textarea, Select } from "@/components/shared/FormField";
import { Modal } from "@/components/shared/Modal";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { useAppStore } from "@/stores/appStore";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { generateId } from "@/lib/numberGen";
import { cn } from "@/lib/cn";
import type { Invoice, InvoiceLineItem, Client } from "@/types";

// ---------------------------------------------------------------------------
// Types for the form state
// ---------------------------------------------------------------------------
interface LineItemDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceFormState {
  clientId: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  taxRate: string;
  discount: string;
  notes: string;
  items: LineItemDraft[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function futureDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function parseNum(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function emptyItem(): LineItemDraft {
  return { id: generateId("li"), description: "", quantity: "1", unitPrice: "" };
}

function draftToLineItems(items: LineItemDraft[]): InvoiceLineItem[] {
  return items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: parseNum(item.quantity),
    unitPrice: parseNum(item.unitPrice),
  }));
}

const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt", "Custom"];

// ---------------------------------------------------------------------------
// AddClientModal (quick inline)
// ---------------------------------------------------------------------------
interface QuickAddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (client: Client) => void;
}

function QuickAddClientModal({ open, onClose, onCreate }: QuickAddClientModalProps) {
  const { createClient } = useAppStore();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Company name is required";
    if (!contact.trim()) e.contact = "Contact name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!address.trim()) e.address = "Billing address is required";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const client = createClient({
      name: name.trim(),
      contactName: contact.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      billingAddress: address.trim(),
      clientSince: todayISO(),
    });
    onCreate(client);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add new client" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Company / Name" required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corporation" />
          </FormField>
          <FormField label="Contact name" required error={errors.contact}>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Jane Smith" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email" required error={errors.email}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@company.com" />
          </FormField>
          <FormField label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98XXX XXXXX" />
          </FormField>
        </div>
        <FormField label="Billing address" required error={errors.address}>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full billing address..." className="min-h-[60px]" />
        </FormField>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm">Add client</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Invoice Preview
// ---------------------------------------------------------------------------
interface PreviewProps {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: string;
  dueDate: string;
  items: LineItemDraft[];
  taxRate: number;
  discount: number;
  notes: string;
}

function InvoicePreview({ invoiceNumber, clientName, clientEmail, clientAddress, issueDate, dueDate, items, taxRate, discount, notes }: PreviewProps) {
  const lineItems: InvoiceLineItem[] = items.map((item) => ({
    id: item.id,
    description: item.description || "—",
    quantity: parseNum(item.quantity) || 0,
    unitPrice: parseNum(item.unitPrice) || 0,
  }));

  const totals = computeInvoiceTotals({ items: lineItems, taxRate, discount, paidAmount: 0 });

  return (
    <div className="rounded-lg border border-border bg-surface p-6 text-sm">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-base text-accent-ink">S</div>
          <p className="mt-2 font-display text-base text-ink">SFT Billing</p>
          <p className="text-xs text-ink-faint">Tax Invoice</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-ink">{invoiceNumber || "INV-XXXX"}</p>
          <p className="text-xs text-ink-faint mt-1">Issued: {issueDate ? formatDate(issueDate) : "—"}</p>
          <p className="text-xs text-ink-faint">Due: {dueDate ? formatDate(dueDate) : "—"}</p>
        </div>
      </div>

      {/* Client */}
      {clientName && (
        <div className="mb-5 rounded-md bg-canvas p-3">
          <p className="text-xs font-medium text-ink-muted mb-1">Bill To</p>
          <p className="font-medium text-ink">{clientName}</p>
          {clientEmail && <p className="text-ink-muted text-xs">{clientEmail}</p>}
          {clientAddress && <p className="text-ink-faint text-xs mt-0.5">{clientAddress}</p>}
        </div>
      )}

      {/* Line items */}
      <table className="w-full mb-4">
        <thead>
          <tr className="border-b border-border text-left text-[11px] text-ink-muted">
            <th className="pb-1.5 font-medium">Description</th>
            <th className="pb-1.5 text-right font-medium">Qty</th>
            <th className="pb-1.5 text-right font-medium">Price</th>
            <th className="pb-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.filter((i) => i.description || i.quantity || i.unitPrice).map((item) => (
            <tr key={item.id} className="border-b border-border/40">
              <td className="py-2 text-ink">{item.description}</td>
              <td className="font-tabular py-2 text-right text-ink-muted">{item.quantity}</td>
              <td className="font-tabular py-2 text-right text-ink-muted">{formatCurrency(item.unitPrice, true)}</td>
              <td className="font-tabular py-2 text-right text-ink">{formatCurrency(item.quantity * item.unitPrice, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="ml-auto max-w-[200px] space-y-1 text-xs">
        <div className="flex justify-between text-ink-muted"><span>Subtotal</span><span className="font-tabular">{formatCurrency(totals.subtotal, true)}</span></div>
        <div className="flex justify-between text-ink-muted"><span>Tax ({(taxRate * 100).toFixed(0)}%)</span><span className="font-tabular">{formatCurrency(totals.taxAmount, true)}</span></div>
        {discount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span className="font-tabular">−{formatCurrency(discount, true)}</span></div>}
        <div className="flex justify-between border-t border-border pt-1.5 font-medium text-ink"><span>Total</span><span className="font-tabular">{formatCurrency(totals.total, true)}</span></div>
      </div>

      {notes && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-medium text-ink-muted mb-1">Notes</p>
          <p className="text-[11px] text-ink-faint whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Create Invoice Page
// ---------------------------------------------------------------------------
export function CreateInvoicePage() {
  const { createInvoiceForClientId, editingInvoiceId, navigateTo, navigateToInvoice } = useWorkspaceStore();
  const { clients, createInvoice, updateInvoice, getInvoiceById } = useAppStore();

  const editingInvoice = editingInvoiceId ? getInvoiceById(editingInvoiceId) : undefined;

  // Build initial form state
  const initialState = useMemo((): InvoiceFormState => {
    if (editingInvoice) {
      return {
        clientId: editingInvoice.clientId,
        issueDate: editingInvoice.issueDate,
        dueDate: editingInvoice.dueDate,
        paymentTerms: editingInvoice.paymentTerms ?? "Net 15",
        taxRate: String(editingInvoice.taxRate * 100),
        discount: String(editingInvoice.discount),
        notes: editingInvoice.notes ?? "",
        items: editingInvoice.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        })),
      };
    }
    return {
      clientId: createInvoiceForClientId ?? "",
      issueDate: todayISO(),
      dueDate: futureDateISO(15),
      paymentTerms: "Net 15",
      taxRate: "18",
      discount: "0",
      notes: "",
      items: [emptyItem()],
    };
  }, [editingInvoice, createInvoiceForClientId]);

  const [form, setForm] = useState<InvoiceFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const pageTitle = editingInvoice ? `Edit ${editingInvoice.number}` : "Create Invoice";

  // Selected client
  const selectedClient = clients.find((c) => c.id === form.clientId);

  // Live computed totals for preview
  const previewTotals = useMemo(() => {
    const lineItems = draftToLineItems(form.items);
    return computeInvoiceTotals({
      items: lineItems,
      taxRate: parseNum(form.taxRate) / 100,
      discount: parseNum(form.discount),
      paidAmount: 0,
    });
  }, [form.items, form.taxRate, form.discount]);

  // Predicted invoice number
  const { invoices } = useAppStore();
  const previewNumber = useMemo(() => {
    if (editingInvoice) return editingInvoice.number;
    const nums = invoices.map((i) => i.number);
    const max = nums.reduce((m, n) => {
      const match = n.match(/^INV-(\d+)$/);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 1000);
    return `INV-${max + 1}`;
  }, [invoices, editingInvoice]);

  // --------------- Form helpers ---------------

  function setField<K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  function updateItem(id: string, field: keyof LineItemDraft, value: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItem(id: string) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.id !== id) }));
  }

  function handleTermsChange(terms: string) {
    setField("paymentTerms", terms);
    const daysMatch = terms.match(/Net (\d+)/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      setField("dueDate", futureDateISO(days));
    }
  }

  // --------------- Validation ---------------

  function validate(isDraft: boolean): boolean {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = "Please select a client";
    if (!form.issueDate) e.issueDate = "Issue date is required";
    if (!form.dueDate) e.dueDate = "Due date is required";
    if (form.issueDate && form.dueDate && form.dueDate < form.issueDate)
      e.dueDate = "Due date must be after issue date";

    if (!isDraft) {
      const validItems = form.items.filter((i) => i.description.trim() && parseNum(i.quantity) > 0 && parseNum(i.unitPrice) > 0);
      if (validItems.length === 0) e.items = "Add at least one complete line item";
    }

    const taxRate = parseNum(form.taxRate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) e.taxRate = "Tax rate must be 0–100";

    const discount = parseNum(form.discount);
    if (isNaN(discount) || discount < 0) e.discount = "Discount must be 0 or more";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // --------------- Save actions ---------------

  function buildInvoiceDraft(isDraft: boolean): Omit<Invoice, "id" | "number"> {
    return {
      clientId: form.clientId,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      paymentTerms: form.paymentTerms,
      items: draftToLineItems(form.items).filter((i) => i.description || i.quantity || i.unitPrice),
      taxRate: parseNum(form.taxRate) / 100,
      discount: parseNum(form.discount),
      notes: form.notes.trim() || undefined,
      isDraft,
      sentAt: editingInvoice?.sentAt,
      viewedAt: editingInvoice?.viewedAt,
      paidAt: editingInvoice?.paidAt,
      paidAmount: editingInvoice?.paidAmount,
      cancelledAt: editingInvoice?.cancelledAt,
    };
  }

  async function saveAsDraft() {
    if (!validate(true)) return;
    setSaving(true);
    const draft = buildInvoiceDraft(true);
    if (editingInvoice) {
      updateInvoice({ ...editingInvoice, ...draft });
      navigateToInvoice(editingInvoice.id);
    } else {
      const inv = createInvoice(draft);
      navigateToInvoice(inv.id);
    }
    setSaving(false);
  }

  async function saveAndSend() {
    if (!validate(false)) return;
    setSaving(true);
    const draft = buildInvoiceDraft(false);
    if (editingInvoice) {
      updateInvoice({ ...editingInvoice, ...draft, sentAt: editingInvoice.sentAt ?? new Date().toISOString() });
      navigateToInvoice(editingInvoice.id);
    } else {
      const inv = createInvoice({ ...draft, sentAt: new Date().toISOString() });
      navigateToInvoice(inv.id);
    }
    setSaving(false);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PageHeader
        title={pageTitle}
        subtitle={editingInvoice ? `Editing invoice ${editingInvoice.number}` : "New invoice"}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigateTo("invoices")} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={saveAsDraft} disabled={saving}>
              Save as Draft
            </Button>
            <Button variant="primary" size="sm" onClick={saveAndSend} disabled={saving}>
              {editingInvoice ? "Save changes" : "Save & Mark Sent"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Editor */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => navigateTo("invoices")}
              className="flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-micro hover:text-ink"
            >
              <ArrowLeft size={14} />
              Back to Invoices
            </button>
          </div>

          <div className="max-w-2xl space-y-6">
            {/* CLIENT */}
            <section>
              <h3 className="mb-4 text-sm font-medium text-ink">Client</h3>
              <div className="space-y-3">
                <FormField label="Client" required error={errors.clientId}>
                  <Select
                    value={form.clientId}
                    onChange={(e) => setField("clientId", e.target.value)}
                  >
                    <option value="">Select a client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </FormField>
                <button
                  type="button"
                  onClick={() => setAddClientOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <Plus size={13} />
                  Add new client
                </button>
                {selectedClient && (
                  <div className="rounded-md bg-canvas px-3 py-2.5 text-xs text-ink-muted">
                    <div className="flex items-start gap-2">
                      <Building2 size={12} className="mt-0.5 shrink-0 text-ink-faint" />
                      <div>
                        <p className="font-medium text-ink">{selectedClient.contactName}</p>
                        <p>{selectedClient.email}</p>
                        <p className="mt-0.5 text-ink-faint">{selectedClient.billingAddress}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* INVOICE DETAILS */}
            <section>
              <h3 className="mb-4 text-sm font-medium text-ink">Invoice details</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Issue date" required error={errors.issueDate}>
                  <Input type="date" value={form.issueDate} onChange={(e) => setField("issueDate", e.target.value)} />
                </FormField>
                <FormField label="Due date" required error={errors.dueDate}>
                  <Input type="date" value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} />
                </FormField>
                <FormField label="Payment terms">
                  <Select value={form.paymentTerms} onChange={(e) => handleTermsChange(e.target.value)}>
                    {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </FormField>
                <FormField label="Tax rate (%)" error={errors.taxRate}>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.taxRate}
                    onChange={(e) => setField("taxRate", e.target.value)}
                    placeholder="18"
                  />
                </FormField>
              </div>
            </section>

            {/* LINE ITEMS */}
            <section>
              <h3 className="mb-4 text-sm font-medium text-ink">Line items</h3>
              {errors.items && <p className="mb-2 text-xs text-caution">{errors.items}</p>}

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas text-left text-xs text-ink-muted">
                      <th className="px-3 py-2.5 font-medium">Description</th>
                      <th className="w-16 px-2 py-2.5 text-right font-medium">Qty</th>
                      <th className="w-28 px-2 py-2.5 text-right font-medium">Unit Price</th>
                      <th className="w-24 px-3 py-2.5 text-right font-medium">Total</th>
                      <th className="w-8 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {form.items.map((item, idx) => {
                      const lineTotal = parseNum(item.quantity) * parseNum(item.unitPrice);
                      return (
                        <tr key={item.id} className="group">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, "description", e.target.value)}
                              placeholder="Item description"
                              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                              aria-label={`Line item ${idx + 1} description`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                              className="font-tabular w-full bg-transparent text-right text-sm text-ink outline-none"
                              aria-label={`Line item ${idx + 1} quantity`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                              placeholder="0.00"
                              className="font-tabular w-full bg-transparent text-right text-sm text-ink outline-none placeholder:text-ink-faint"
                              aria-label={`Line item ${idx + 1} unit price`}
                            />
                          </td>
                          <td className="font-tabular px-3 py-2 text-right text-sm text-ink">
                            {lineTotal > 0 ? formatCurrency(lineTotal, true) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-ink-faint opacity-0 transition-opacity duration-micro group-hover:opacity-100 hover:text-overdue"
                                aria-label="Remove line item"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t border-border px-3 py-2">
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                  >
                    <Plus size={13} />
                    Add item
                  </button>
                </div>
              </div>

              {/* Totals summary */}
              <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span className="font-tabular">{formatCurrency(previewTotals.subtotal, true)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Tax ({parseNum(form.taxRate).toFixed(0)}%)</span>
                  <span className="font-tabular">{formatCurrency(previewTotals.taxAmount, true)}</span>
                </div>
                {previewTotals.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span className="font-tabular">−{formatCurrency(previewTotals.discount, true)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 font-medium text-ink">
                  <span>Total</span>
                  <span className="font-tabular">{formatCurrency(previewTotals.total, true)}</span>
                </div>
              </div>
            </section>

            {/* DISCOUNT */}
            <section>
              <FormField label="Discount (₹)" error={errors.discount} hint="Flat amount deducted from total after tax">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={form.discount}
                  onChange={(e) => setField("discount", e.target.value)}
                  placeholder="0"
                  className="max-w-[180px]"
                />
              </FormField>
            </section>

            {/* NOTES */}
            <section>
              <FormField label="Notes / Terms" hint="Visible to client on the invoice">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Payment terms, bank details, or any additional notes…"
                  className="min-h-[100px]"
                />
              </FormField>
            </section>

            {/* Bottom actions */}
            <div className="flex items-center gap-2 border-t border-border pt-5">
              <Button variant="secondary" size="md" onClick={saveAsDraft} disabled={saving}>
                Save as Draft
              </Button>
              <Button variant="primary" size="md" onClick={saveAndSend} disabled={saving}>
                {editingInvoice ? "Save changes" : "Save & Mark Sent"}
              </Button>
              <Button variant="ghost" size="md" onClick={() => navigateTo("invoices")} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-border bg-canvas px-6 py-6 xl:block">
          <p className="mb-4 text-xs font-medium text-ink-muted uppercase tracking-wider">Live Preview</p>
          <InvoicePreview
            invoiceNumber={previewNumber}
            clientName={selectedClient?.name ?? ""}
            clientEmail={selectedClient?.email ?? ""}
            clientAddress={selectedClient?.billingAddress ?? ""}
            issueDate={form.issueDate}
            dueDate={form.dueDate}
            items={form.items}
            taxRate={parseNum(form.taxRate) / 100}
            discount={parseNum(form.discount)}
            notes={form.notes}
          />
        </div>
      </div>

      {/* Add client modal */}
      <QuickAddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onCreate={(client) => setField("clientId", client.id)}
      />
    </div>
  );
}
