import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, ArrowLeft, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClientCombobox } from "@/components/create-invoice/ClientCombobox";
import { LineItemEditor } from "@/components/create-invoice/LineItemEditor";
import { EmptyState } from "@/components/shared/EmptyState";
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
import type { Invoice, InvoiceLineItem } from "@/types";

export function CreateInvoicePage() {
  const {
    data: invoices,
    reload: reloadInvoices,
    loading: invoicesLoading,
    error: invoicesError,
  } = useInvoices();
  const {
    data: clients,
    reload: reloadClients,
    loading: clientsLoading,
    error: clientsError,
  } = useClients();
  const { data: products } = useProducts();
  const {
    data: business,
    reload: reloadBusiness,
    loading: businessLoading,
    error: businessError,
  } = useBusinessProfile();
  const { invoiceDraftPrefill, closeCreateInvoice, goToInvoices } = useWorkspaceStore();

  const [draft, setDraft] = useState<Invoice | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const draftCandidate = useRef<Invoice | null>(null);
  const draftStarted = useRef(false);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isLoading = invoicesLoading || clientsLoading || businessLoading;

  // Compute the current draft for rendering: prefer explicit draft state,
  // but fall back to resolving a draft from prefill when data is ready.
  // For existing drafts, use the prefill to hydrate; for new invoices, create a
  // candidate so the form is visible immediately and the user can start editing.
  const currentDraft = useMemo(() => {
    if (draft) return draft;
    if (!invoices || !clients || !business) return null;
    const candidate = draftCandidate.current ?? resolveInvoiceDraft(
      invoices,
      invoiceDraftPrefill ?? {},
      business.defaultGst,
    );
    draftCandidate.current = candidate;
    const isExistingDraft = invoices.some((invoice) => invoice.id === candidate.id);
    if (isExistingDraft) {
      return candidate;
    }
    // For new invoices, return the candidate so the form is visible.
    // The reservation will be attempted when the user explicitly starts editing.
    return candidate;
  }, [draft, invoices, clients, business, invoiceDraftPrefill]);

  // Initialize draft state for existing drafts (runs once when data becomes available)
  useEffect(() => {
    if (draft) return; // Already have explicit draft state
    if (!invoices || !clients || !business) return;
    
    const candidate = draftCandidate.current ?? resolveInvoiceDraft(
      invoices,
      invoiceDraftPrefill ?? {},
      business.defaultGst,
    );
    draftCandidate.current = candidate;
    const isExistingDraft = invoices.some((invoice) => invoice.id === candidate.id);
    if (isExistingDraft) {
      setDraft(candidate);
      if (invoiceDraftPrefill?.supplierCode || invoiceDraftPrefill?.poNumber || invoiceDraftPrefill?.transporter) {
        setOrderDetailsOpen(true);
      }
    }
  }, [invoices, clients, business, invoiceDraftPrefill, draft]);

  // Handle resource errors
  useEffect(() => {
    const resourceError = invoicesError ?? clientsError ?? businessError;
    if (resourceError) {
      setInitializationError(resourceError.message);
    }
  }, [invoicesError, clientsError, businessError]);

  function retryInitialization() {
    setInitializationError(null);
    if (invoicesError) reloadInvoices();
    if (clientsError) reloadClients();
    if (businessError) reloadBusiness();
  }

  // Helper to ensure a draft exists and has a reserved number.
  // Called when the user explicitly starts editing or saves.
  async function ensureDraftAndNumber() {
    if (!draft) {
      const candidate = draftCandidate.current ?? resolveInvoiceDraft(
        invoices ?? [],
        invoiceDraftPrefill ?? {},
        business?.defaultGst,
      );
      draftCandidate.current = candidate;
      const number = await activeDataProvider.reserveInvoiceNumber(candidate.id);
      setDraft({ ...candidate, number });
      draftStarted.current = true;
    } else if (!draft.number) {
      const number = await activeDataProvider.reserveInvoiceNumber(draft.id);
      setDraft({ ...draft, number });
      draftStarted.current = true;
    }
    draftStarted.current = true;
  }

  // Call this when user explicitly starts editing (e.g., selects client, types in field)
  function markDraftStarted() {
    if (!draftStarted.current) {
      draftStarted.current = true;
    }
  }

  const totals = useMemo(() => (currentDraft ? computeInvoiceTotals(currentDraft) : null), [currentDraft]);
  const validation = useMemo(() => (currentDraft ? validateInvoiceDraft(currentDraft) : null), [currentDraft]);
  const client = clients?.find((c) => c.id === currentDraft?.clientId);
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

  // Show loading state while resources are loading
  if (isLoading) {
    return (
      <div>
        <PageHeader title="New Invoice" subtitle="Loading…" />
      </div>
    );
  }

  // Show error state if initialization failed
  const errorMessage =
    initializationError ??
    invoicesError?.message ??
    clientsError?.message ??
    businessError?.message;
  if (errorMessage) {
    return (
      <div>
        <PageHeader title="New Invoice" subtitle="Invoice setup needs attention" />
        <div role="alert" className="px-10 py-8">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't prepare a new invoice"
            description={errorMessage}
            action={
              <button
                type="button"
                onClick={retryInitialization}
                disabled={invoicesLoading || clientsLoading || businessLoading}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Try again
              </button>
            }
          />
        </div>
      </div>
    );
  }

  // If no draft yet (new invoice), show empty state with "Preparing a blank invoice…"
  // The draft will be created when user explicitly starts editing
  if (!currentDraft) {
    return (
      <div>
        <PageHeader title="New Invoice" subtitle="Preparing a blank invoice…" />
      </div>
    );
  }

  async function handleSaveDraft() {
    if (!draft) return;
    // Ensure draft has a reserved number before saving
    if (!draft.number) {
      await ensureDraftAndNumber();
    }
    setSaving(true);
    try {
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
    } catch (error) {
      setSaving(false);
      // Release the reservation if save failed
      if (draft.number) {
        await activeDataProvider.releaseReservation(draft.id);
        // Clear the number so user can try again
        setDraft((prev) => prev ? { ...prev, number: "" } : prev);
        draftStarted.current = false;
      }
      throw error;
    }
  }

  async function handleConfirmBill() {
    if (!draft) return;
    if (!draft.number) {
      await ensureDraftAndNumber();
    }
    setSaving(true);
    try {
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
    } catch (error) {
      setSaving(false);
      // Release the reservation if save failed
      if (draft.number) {
        await activeDataProvider.releaseReservation(draft.id);
        setDraft((prev) => prev ? { ...prev, number: "" } : prev);
        draftStarted.current = false;
      }
      throw error;
    }
  }

  // Wrapper handlers that mark draft as started when user interacts
  function handleClientSelect(clientId: string) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, clientId } : prev);
    }
  }

  function handleItemsChange(items: InvoiceLineItem[]) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, items } : prev);
    }
  }

  function handleDiscountChange(discount: number) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, discount } : prev);
    }
  }

  function handleRoundOffChange(roundOff: number) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, roundOff } : prev);
    }
  }

  function handleSupplierCodeChange(supplierCode: string) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, supplierCode } : prev);
    }
  }

  function handlePoNumberChange(poNumber: string) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, poNumber } : prev);
    }
  }

  function handlePoDateChange(poDate: string | undefined) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, poDate } : prev);
    }
  }

  function handleTransporterChange(transporter: string) {
    if (draft) {
      markDraftStarted();
      setDraft((prev) => prev ? { ...prev, transporter } : prev);
    }
  }

  function handleRoundOffClick() {
    if (!draft || !totals) return;
    markDraftStarted();
    setDraft((prev) => prev ? { ...prev, roundOff: suggestRoundOff(totals.rawTotal) } : prev);
  }

  async function handleCreateClient(input: { name: string; email: string | null; contactName?: string; phone: string | null; billingAddress: string; gstin: string; pan: string | null }) {
    const id = `cl_runtime_${Date.now()}`;
    await activeDataProvider.createClient({
      id,
      name: input.name,
      email: input.email,
      contactName: input.contactName,
      phone: input.phone,
      billingAddress: input.billingAddress,
      gstin: input.gstin,
      pan: input.pan,
    });
    reloadClients();
    return id;
  }

  return (
    <div className="min-h-full">
      <div className="print:hidden">
        <PageHeader
          title="New Invoice"
          subtitle={currentDraft ? `${currentDraft.number} · Net 15` : "Preparing a blank invoice…"}
          action={
            <button
              type="button"
              onClick={closeCreateInvoice}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
            >
              <ArrowLeft size={12} /> Back
            </button>
          }
        />
      </div>

      <div className="invoice-create-layout px-3 py-3">
        <div className="min-w-0 space-y-3 print:hidden">
          {currentDraft ? (
            <div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Client</label>
                <ClientCombobox
                  clients={clients ?? []}
                  value={currentDraft.clientId}
                  onSelect={handleClientSelect}
                  onCreateClient={handleCreateClient}
                />
                {validation?.clientId && <p className="mt-1 text-xs text-overdue">{validation.clientId}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Line items</label>
                <LineItemEditor
                  items={currentDraft.items}
                  products={products ?? []}
                  onChange={handleItemsChange}
                  errors={validation?.itemErrors ?? {}}
                />
                {validation?.items && <p className="mt-2 text-xs text-overdue">{validation.items}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">CGST (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(currentDraft.gst.cgstRate * 1000) / 10}
                    onChange={(e) => setDraft({ ...currentDraft, gst: { ...currentDraft.gst, cgstRate: Number(e.target.value) / 100 } })}
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
                    value={Math.round(currentDraft.gst.sgstRate * 1000) / 10}
                    onChange={(e) => setDraft({ ...currentDraft, gst: { ...currentDraft.gst, sgstRate: Number(e.target.value) / 100 } })}
                    className="font-tabular h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Discount (flat)</label>
                  <input
                    type="number"
                    min={0}
                    value={currentDraft.discount}
                    onChange={(e) => handleDiscountChange(Number(e.target.value))}
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
                    value={currentDraft.roundOff}
                    onChange={(e) => handleRoundOffChange(Number(e.target.value))}
                    className="font-tabular h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-border-strong"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRoundOffClick}
                  className="h-10 shrink-0 rounded-md border border-border px-3 text-xs font-medium text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
                >
                  Round to nearest ₹
                </button>
              </div>

              <div>
                {!orderDetailsOpen ? (
                  <button
                    type="button"
                    onClick={() => { markDraftStarted(); setOrderDetailsOpen(true); }}
                    className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
                  >
                    <ChevronDown size={14} /> Add order / delivery details
                  </button>
                ) : (
                  <div>
                    <p className="mb-2 text-xs font-medium text-ink-muted">Order / delivery details</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={currentDraft.supplierCode ?? ""}
                        onChange={(e) => handleSupplierCodeChange(e.target.value)}
                        placeholder="Supplier code"
                        className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                      />
                      <input
                        value={currentDraft.transporter ?? ""}
                        onChange={(e) => handleTransporterChange(e.target.value)}
                        placeholder="Transporter"
                        className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                      />
                      <input
                        value={currentDraft.poNumber ?? ""}
                        onChange={(e) => handlePoNumberChange(e.target.value)}
                        placeholder="P.O. No."
                        className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                      />
                      <input
                        type="date"
                        value={currentDraft.poDate ? currentDraft.poDate.slice(0, 10) : ""}
                        onChange={(e) => handlePoDateChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                        className="font-tabular h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-border-strong"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Keep invoice actions in the page flow so every control remains reachable while scrolling. */}
              <div className="print:hidden flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2">
                <div className="text-sm">
                  <span className="text-ink-muted">Total due </span>
                  <span className="font-tabular font-medium text-ink">{formatCurrency(totals?.total ?? 0)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleSaveDraft}
                    disabled={saving}
                  >
                    <FileDown size={14} /> Save as draft
                  </Button>
                  <Button onClick={() => { markDraftStarted(); setConfirmOpen(true); }} disabled={!ready || saving || !currentDraft}>
                    <CheckCircle2 size={14} /> Bill invoice
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
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
            <Button onClick={handleConfirmBill} disabled={saving || !currentDraft}>
              {saving ? "Billing…" : "Bill invoice"}
            </Button>
          </>
        }
      >
        This will mark invoice {currentDraft?.number ?? "(number pending)"} ({formatCurrency(totals?.total ?? 0)}) as billed for{" "}
        <span className="font-medium text-ink">{client?.name ?? "the selected client"}</span>, due{" "}
        {formatDate(currentDraft?.dueDate ?? "")}. It will not be emailed — you can send it from the invoice's detail page
        whenever you're ready.
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}