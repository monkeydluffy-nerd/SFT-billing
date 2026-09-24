import { useEffect, useMemo, useState } from "react";
import { Send, FileDown, ArrowLeft, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClientCombobox } from "@/components/create-invoice/ClientCombobox";
import { LineItemEditor } from "@/components/create-invoice/LineItemEditor";
import { InvoicePreview } from "@/components/create-invoice/InvoicePreview";
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
import { computeInvoiceTotals } from "@/lib/invoiceMath";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Initialized once, the moment invoices have loaded (needed to compute
  // the next real invoice number) — see blueprint §4.3.
  useEffect(() => {
    if (draft || !invoices) return;
    setDraft(resolveInvoiceDraft(invoices, invoiceDraftPrefill ?? {}));
    if (invoiceDraftPrefill?.notes) setNotesOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, draft]);

  const totals = useMemo(() => (draft ? computeInvoiceTotals(draft) : null), [draft]);
  const validation = useMemo(() => (draft ? validateInvoiceDraft(draft) : null), [draft]);
  const client = clients?.find((c) => c.id === draft?.clientId);
  const ready = validation ? isDraftReadyToSend(validation) : false;

  // Cmd/Ctrl+Enter sends, matching the keyboard-first requirement.
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

  async function handleConfirmSend() {
    if (!draft) return;
    setSaving(true);
    const now = new Date().toISOString();
    const wasNew = !invoices?.some((i) => i.id === draft.id);
    const sentInvoice: Invoice = { ...draft, isDraft: false, sentAt: now };
    await activeDataProvider.saveInvoice(sentInvoice);
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
    await activeDataProvider.addActivityEvent({
      type: "invoice_sent",
      occurredAt: now,
      summary: `Invoice ${draft.number} sent to ${getClientName(clients, draft.clientId)}`,
      clientId: draft.clientId,
      invoiceId: draft.id,
      amount: totals?.total,
    });
    setSaving(false);
    setConfirmOpen(false);
    reloadInvoices();
    setToast(`Invoice ${draft.number} sent`);
    setTimeout(() => goToInvoices(), 600);
  }

  return (
    <div className="flex h-full flex-col">
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

      <div className="grid flex-1 grid-cols-1 gap-8 overflow-y-auto px-10 py-8 lg:grid-cols-2">
        {/* LEFT — the builder */}
        <div className="space-y-6">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Tax rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(draft.taxRate * 100)}
                onChange={(e) => setDraft({ ...draft, taxRate: Number(e.target.value) / 100 })}
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

        {/* RIGHT — the live preview */}
        <div>
          <InvoicePreview invoice={draft} client={client} business={business} />
        </div>
      </div>

      {/* Sticky footer — running total always visible, no scrolling required */}
      <div className="flex items-center justify-between border-t border-border bg-surface px-10 py-4">
        <div className="text-sm">
          <span className="text-ink-muted">Total due </span>
          <span className="font-tabular font-medium text-ink">{formatCurrency(totals.total)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
            <FileDown size={14} /> Save as draft
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={!ready || saving}>
            <Send size={14} /> Send invoice
          </Button>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send this invoice?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSend} disabled={saving}>
              {saving ? "Sending…" : "Send invoice"}
            </Button>
          </>
        }
      >
        This will email invoice {draft.number} ({formatCurrency(totals.total)}) to{" "}
        <span className="font-medium text-ink">{client?.email ?? "the selected client"}</span>, due{" "}
        {formatDate(draft.dueDate)}.
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
