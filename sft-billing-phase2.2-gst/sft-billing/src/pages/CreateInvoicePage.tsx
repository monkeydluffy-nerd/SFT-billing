import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileDown, ArrowLeft, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClientCombobox } from "@/components/create-invoice/ClientCombobox";
import { LineItemEditor } from "@/components/create-invoice/LineItemEditor";
import { InvoicePreview } from "@/components/create-invoice/InvoicePreview";
import { DownloadInvoiceButton } from "@/components/create-invoice/DownloadInvoiceButton";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { Toast } from "@/components/shared/Toast";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { resolveInvoiceDraft } from "@/lib/invoiceDraft";
import { billInvoice } from "@/lib/invoiceLifecycle";
import { computeInvoiceTotals, suggestRoundOff } from "@/lib/invoiceMath";
import { validateInvoiceDraft, isDraftReadyToSend } from "@/lib/invoiceValidation";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getClientName } from "@/lib/clientLookup";
import type { Invoice } from "@/types";

export function CreateInvoicePage() {
  const { data: invoices, reload: reloadInvoices } = useInvoices();
  const { data: clients, reload: reloadClients } = useClients();
  const { data: products } = useProducts();
  const { data: business } = useBusinessProfile();
  const { invoiceDraftPrefill, closeCreateInvoice, goToInvoices } = useWorkspaceStore();

  const [draft, setDraft] = useState<Invoice | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Initialized once, the moment invoices (and the Business Profile, for
  // its default GST rates) have loaded — see blueprint §4.3.
  useEffect(() => {
    if (draft || !invoices || !business) return;
    setDraft(resolveInvoiceDraft(invoices, invoiceDraftPrefill ?? {}, business.defaultGst));
    if (invoiceDraftPrefill?.notes) setNotesOpen(true);
    if (invoiceDraftPrefill?.supplierCode || invoiceDraftPrefill?.poNumber || invoiceDraftPrefill?.transporter) {
      setOrderDetailsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, business, draft]);

  const totals = useMemo(() => (draft ? computeInvoiceTotals(draft) : null), [draft]);
  const validation = useMemo(() => (draft ? validateInvoiceDraft(draft) : null), [draft]);
  const client = clients?.find((c) => c.id === draft?.clientId);
  const ready = validation ? isDraftReadyToSend(validation) : false;

  // Cmd/Ctrl+Enter opens the bill-confirmation modal, matching the keyboard-first requirement.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready) {
        e.preventDefault();
        setConfirmOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ready]);

  if (!draft || !totals || !validation) {
    return (
      <div>
        <PageHeader title="New Invoice" subtitle="Preparing a blank invoice…" />
        <div className="px-10 py-8 text-sm text-ink-muted">Loading…</div>
      </div>
    );
  }

  async function handleCreateClient(input: { name: string; email: string; contactName: string }) {
    const id = `cl_runtime_${Date.now()}`;
    await activeDataProvider.createClient({
      id,
      name: input.name,
      email: input.email,
      contactName: input.contactName,
      billingAddress: "",
      clientSince: new Date().toISOString(),
    });
    reloadClients();
    return id;
  }

  async function handleSaveDraft() {
    if (!draft) return;
    setSaving(true);
    await activeDataProvider.saveInvoice(draft);
    if (!invoices?.some((i) => i.id === draft.id)) {
      await activeDataProvider.addActivityEvent({
        type: "invoice_created",
        occurredAt: new Date().toISOString(),
        summary: `Invoice ${draft.number} created for ${getClientName(clients, draft.clientId)}`,
        clientId: draft.clientId,
        invoiceId: draft.id,
        amount: totals?.total,
      });
    }
    setSaving(false);
    reloadInvoices();
    goToInvoices();
  }

  async function handleConfirmBill() {
    if (!draft) return;
    setSaving(true);
    const now = new Date().toISOString();
    const wasNew = !invoices?.some((i) => i.id === draft.id);
    const billedInvoice: Invoice = billInvoice(draft, now);
    await activeDataProvider.saveInvoice(billedInvoice);
    if (wasNew) {
      await activeDataProvider.addActivityEvent({
        type: "invoice_created",
        occurredAt: now,
        summary: `Invoice ${draft.number} created for ${getClientName(clients, draft.clientId)}`,
        clientId: draft.clientId,
        invoiceId: draft.id,
        amount: totals?.total,
      });
    }
    setSaving(false);
    setConfirmOpen(false);
    reloadInvoices();
    setToast(`Invoice ${draft.number} billed`);
    setTimeout(() => goToInvoices(), 600);
  }

  return (
    <div className="min-h-full">
      <div className="print:hidden">
        <PageHeader
          title="New Invoice"
          subtitle={`${draft.number} · Net 15`}
          action={
            <button
              type="button"
              onClick={closeCreateInvoice}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
            >
              <ArrowLeft size={14} /> Back to invoices
            </button>
          }
        />
      </div>

      <div className="invoice-create-layout grid grid-cols-1 gap-8 px-10 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* LEFT — the builder */}
        <div className="min-w-0 space-y-6 print:hidden">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Client</label>
            <ClientCombobox
              clients={clients ?? []}
              value={draft.clientId}
              onSelect={(clientId) => setDraft({ ...draft, clientId })}
              onCreateClient={handleCreateClient}
            />
            {validation.clientId && <p className="mt-1 text-xs text-overdue">{validation.clientId}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Line items</label>
            <LineItemEditor
              items={draft.items}
              products={products ?? []}
              errors={validation.itemErrors}
              onChange={(items) => setDraft({ ...draft, items })}
            />
            {validation.items && <p className="mt-2 text-xs text-overdue">{validation.items}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">CGST (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Math.round(draft.gst.cgstRate * 1000) / 10}
                onChange={(e) => setDraft({ ...draft, gst: { ...draft.gst, cgstRate: Number(e.target.value) / 100 } })}
                className="font-tabular h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">SGST (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Math.round(draft.gst.sgstRate * 1000) / 10}
                onChange={(e) => setDraft({ ...draft, gst: { ...draft.gst, sgstRate: Number(e.target.value) / 100 } })}
                className="font-tabular h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Discount (flat)</label>
              <input
                type="number"
                min={0}
                value={draft.discount}
                onChange={(e) => setDraft({ ...draft, discount: Number(e.target.value) })}
                className="font-tabular h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
              />
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Round off</label>
              <input
                type="number"
                step={0.01}
                value={draft.roundOff}
                onChange={(e) => setDraft({ ...draft, roundOff: Number(e.target.value) })}
                className="font-tabular h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
              />
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, roundOff: suggestRoundOff(totals.rawTotal) })}
              className="h-10 shrink-0 rounded-md border border-border px-3 text-xs font-medium text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
            >
              Round to nearest ₹
            </button>
          </div>

          <div>
            {!orderDetailsOpen ? (
              <button
                type="button"
                onClick={() => setOrderDetailsOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
              >
                <ChevronDown size={14} /> Add order / delivery details
              </button>
            ) : (
              <div>
                <p className="mb-2 text-xs font-medium text-ink-muted">Order / delivery details</p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={draft.supplierCode ?? ""}
                    onChange={(e) => setDraft({ ...draft, supplierCode: e.target.value })}
                    placeholder="Supplier code"
                    className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                  />
                  <input
                    value={draft.transporter ?? ""}
                    onChange={(e) => setDraft({ ...draft, transporter: e.target.value })}
                    placeholder="Transporter"
                    className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                  />
                  <input
                    value={draft.poNumber ?? ""}
                    onChange={(e) => setDraft({ ...draft, poNumber: e.target.value })}
                    placeholder="P.O. No."
                    className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                  />
                  <input
                    type="date"
                    value={draft.poDate ? draft.poDate.slice(0, 10) : ""}
                    onChange={(e) => setDraft({ ...draft, poDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="font-tabular h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            {!notesOpen ? (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
              >
                <ChevronDown size={14} /> Add notes
              </button>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Notes</label>
                <textarea
                  value={draft.notes ?? ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  placeholder="Payment terms, thank-you note, anything the client should see…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — the live A4 document preview */}
        <div className="invoice-print-region min-w-0 pb-32 lg:sticky lg:top-6 lg:self-start">
          <InvoicePreview invoice={draft} client={client} business={business} />
        </div>
      </div>

      {/* Action footer stays in document flow so every control remains reachable in the outer page scroll. */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface px-10 py-4">
        <div className="text-sm">
          <span className="text-ink-muted">Total due </span>
          <span className="font-tabular font-medium text-ink">{formatCurrency(totals.total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadInvoiceButton invoice={draft} client={client} business={business} />
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
            <FileDown size={14} /> Save as draft
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={!ready || saving}>
            <CheckCircle2 size={14} /> Bill invoice
          </Button>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Bill this invoice?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBill} disabled={saving}>
              {saving ? "Billing…" : "Bill invoice"}
            </Button>
          </>
        }
      >
        This will mark invoice {draft.number} ({formatCurrency(totals.total)}) as billed for{" "}
        <span className="font-medium text-ink">{client?.name ?? "the selected client"}</span>, due{" "}
        {formatDate(draft.dueDate)}. It will not be emailed — you can send it from the invoice's detail page
        whenever you're ready.
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
