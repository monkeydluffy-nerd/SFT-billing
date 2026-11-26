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
import { computeInvoiceTotals, roundMoney, suggestRoundOff } from "@/lib/invoiceMath";
import { validateInvoiceDraft, isDraftReadyToSend } from "@/lib/invoiceValidation";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getClientName } from "@/lib/clientLookup";
import { cn } from "@/lib/cn";
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
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const reservationRequested = useRef(false);

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

  // Every edit goes through here so a brand-new invoice (which only has a
  // candidate, not explicit draft state) becomes a real draft on first touch.
  function updateDraft(patch: Partial<Invoice>) {
    markDraftStarted();
    const base = draft ?? draftCandidate.current ?? currentDraft;
    // First edit of a brand-new invoice: reserve a real invoice number with
    // the backend so saving later doesn't collide with a provisional one.
    if (!draft && base && !reservationRequested.current) {
      reservationRequested.current = true;
      activeDataProvider
        .reserveInvoiceNumber(base.id)
        .then((number) => setDraft((prev) => (prev ? { ...prev, number } : prev)))
        .catch((error: unknown) => {
          reservationRequested.current = false;
          setSaveError(error instanceof Error ? error.message : "Couldn't reserve an invoice number.");
        });
    }
    setDraft((prev) => {
      const current = prev ?? base;
      return current ? { ...current, ...patch } : current;
    });
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
        <div role="alert" className="px-6 lg:px-8 py-8">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't prepare a new invoice"
            description={errorMessage}
            action={
              <button
                type="button"
                onClick={retryInitialization}
                disabled={invoicesLoading || clientsLoading || businessLoading}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
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
        reservationRequested.current = false;
      }
      setSaveError(error instanceof Error ? error.message : "Couldn't save the invoice. Please try again.");
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
        reservationRequested.current = false;
      }
      setSaveError(error instanceof Error ? error.message : "Couldn't bill the invoice. Please try again.");
    }
  }

  // Wrapper handlers that mark draft as started when user interacts
  function handleClientSelect(clientId: string) {
    updateDraft({ clientId });
  }

  function handleItemsChange(items: InvoiceLineItem[]) {
    setItemsTouched(true);
    updateDraft({ items });
  }

  function handleDiscountChange(discount: number) {
    updateDraft({ discount });
  }

  function handleRoundOffChange(roundOff: number) {
    updateDraft({ roundOff });
  }

  function handleSupplierCodeChange(supplierCode: string) {
    updateDraft({ supplierCode });
  }

  function handlePoNumberChange(poNumber: string) {
    updateDraft({ poNumber });
  }

  function handlePoDateChange(poDate: string | undefined) {
    updateDraft({ poDate });
  }

  function handleTransporterChange(transporter: string) {
    updateDraft({ transporter });
  }

  function handleRoundOffClick() {
    if (!totals) return;
    updateDraft({ roundOff: suggestRoundOff(totals.rawTotal) });
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

  const numberInput =
    "font-tabular h-10 w-full rounded-lg border border-border-strong bg-canvas px-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15";
  const textInput =
    "h-10 w-full rounded-lg border border-border-strong bg-canvas px-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15";
  const labelClass = "mb-1.5 block text-xs font-semibold text-ink-muted";
  const showErrors = itemsTouched;
  const hasClient = Boolean(currentDraft.clientId);
  const hasItems = !validation?.items;
  const itemsValid = hasItems && Object.values(validation?.itemErrors ?? {}).every((e) => !e);

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
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
            >
              <ArrowLeft size={14} /> Back
            </button>
          }
        />
      </div>

      <div className="invoice-create-layout mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8">
        {currentDraft ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5 print:hidden">
              <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-accent-ink">1</span>
                  Bill to
                </h2>
                <label className={labelClass}>Client</label>
                <ClientCombobox
                  clients={clients ?? []}
                  value={currentDraft.clientId}
                  onSelect={handleClientSelect}
                  onCreateClient={handleCreateClient}
                />
                {showErrors && validation?.clientId && <p className="mt-1.5 text-xs font-medium text-overdue">{validation.clientId}</p>}
              </section>

              <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-accent-ink">2</span>
                  Line items
                </h2>
                <label className="sr-only">Line items</label>
                <LineItemEditor
                  items={currentDraft.items}
                  products={products ?? []}
                  onChange={handleItemsChange}
                  errors={showErrors ? (validation?.itemErrors ?? {}) : {}}
                />
                {showErrors && validation?.items && <p className="mt-2 text-xs font-medium text-overdue">{validation.items}</p>}
              </section>

              <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-accent-ink">3</span>
                  Tax &amp; adjustments
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>CGST (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={Math.round(currentDraft.gst.cgstRate * 1000) / 10}
                      onChange={(e) => updateDraft({ gst: { ...currentDraft.gst, cgstRate: Number(e.target.value) / 100 } })}
                      className={numberInput}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>SGST (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={Math.round(currentDraft.gst.sgstRate * 1000) / 10}
                      onChange={(e) => updateDraft({ gst: { ...currentDraft.gst, sgstRate: Number(e.target.value) / 100 } })}
                      className={numberInput}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelClass}>Discount (flat)</label>
                    <input
                      type="number"
                      min={0}
                      value={currentDraft.discount}
                      onChange={(e) => handleDiscountChange(Number(e.target.value))}
                      className={numberInput}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-3">
                  <div className="flex-1">
                    <label className={labelClass}>Round off</label>
                    <input
                      type="number"
                      step={0.01}
                      value={roundMoney(currentDraft.roundOff)}
                      onChange={(e) => handleRoundOffChange(roundMoney(Number(e.target.value)))}
                      className={numberInput}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRoundOffClick}
                    className="h-10 shrink-0 rounded-lg border border-border-strong px-3 text-xs font-semibold text-ink-muted transition-colors duration-micro hover:border-accent hover:text-accent"
                  >
                    Round to nearest ₹
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
                {!orderDetailsOpen ? (
                  <button
                    type="button"
                    onClick={() => { markDraftStarted(); setOrderDetailsOpen(true); }}
                    className="flex items-center gap-2 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
                  >
                    <ChevronDown size={15} /> Add order / delivery details
                  </button>
                ) : (
                  <div>
                    <p className="mb-3 text-sm font-semibold text-ink">Order / delivery details</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        value={currentDraft.supplierCode ?? ""}
                        onChange={(e) => handleSupplierCodeChange(e.target.value)}
                        placeholder="Supplier code"
                        className={textInput}
                      />
                      <input
                        value={currentDraft.transporter ?? ""}
                        onChange={(e) => handleTransporterChange(e.target.value)}
                        placeholder="Transporter"
                        className={textInput}
                      />
                      <input
                        value={currentDraft.poNumber ?? ""}
                        onChange={(e) => handlePoNumberChange(e.target.value)}
                        placeholder="P.O. No."
                        className={textInput}
                      />
                      <input
                        type="date"
                        value={currentDraft.poDate ? currentDraft.poDate.slice(0, 10) : ""}
                        onChange={(e) => handlePoDateChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                        className={numberInput}
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Summary + actions stay in view while the form scrolls. */}
            <aside className="print:hidden lg:sticky lg:top-6" aria-label="Invoice summary">
              <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-float">
                <div className="border-b border-border px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Invoice</p>
                  <p className="font-tabular mt-0.5 text-lg font-semibold text-ink">{currentDraft.number || "Number pending"}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">{client?.name ?? "No client selected"}</p>
                </div>

                <dl className="font-tabular space-y-2.5 px-5 py-4 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="font-medium text-ink">{formatCurrency(totals?.subtotal ?? 0)}</dd></div>
                  {(totals?.discount ?? 0) > 0 && (
                    <div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className="font-medium text-ink">− {formatCurrency(totals?.discount ?? 0)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-ink-muted">CGST</dt><dd className="font-medium text-ink">{formatCurrency(totals?.cgstAmount ?? 0)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-muted">SGST</dt><dd className="font-medium text-ink">{formatCurrency(totals?.sgstAmount ?? 0)}</dd></div>
                  {(totals?.roundOff ?? 0) !== 0 && (
                    <div className="flex justify-between"><dt className="text-ink-muted">Round off</dt><dd className="font-medium text-ink">{formatCurrency(totals?.roundOff ?? 0)}</dd></div>
                  )}
                </dl>

                <div className="border-t border-border bg-canvas/60 px-5 py-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-ink-muted">Total due</span>
                    <span className="font-tabular text-2xl font-semibold tracking-tight text-ink">{formatCurrency(totals?.total ?? 0)}</span>
                  </div>
                </div>

                <ul className="space-y-1.5 border-t border-border px-5 py-3 text-xs" aria-label="Before you bill">
                  <li className={cn("flex items-center gap-2", hasClient ? "text-success" : "text-ink-muted")}>
                    <CheckCircle2 size={14} className={hasClient ? "" : "opacity-40"} /> Client selected
                  </li>
                  <li className={cn("flex items-center gap-2", itemsValid ? "text-success" : "text-ink-muted")}>
                    <CheckCircle2 size={14} className={itemsValid ? "" : "opacity-40"} /> Line items complete
                  </li>
                </ul>

                {/* Keep invoice actions in the page flow so every control remains reachable. */}
                <div className="print:hidden flex flex-col gap-2 border-t border-border p-4">
                  <Button onClick={() => { markDraftStarted(); setSaveError(null); setConfirmOpen(true); }} disabled={!ready || saving || !currentDraft} className="w-full">
                    <CheckCircle2 size={14} /> Bill invoice
                  </Button>
                  <Button variant="secondary" onClick={handleSaveDraft} disabled={saving} className="w-full">
                    <FileDown size={14} /> Save as draft
                  </Button>
                  {saveError && !confirmOpen && (
                    <p role="alert" className="rounded-lg bg-overdue-bg px-3 py-2 text-xs font-medium text-overdue">{saveError}</p>
                  )}
                  <p className="pt-1 text-center text-[11px] text-ink-faint">
                    <kbd className="rounded border border-border bg-canvas px-1 py-0.5 font-sans">Ctrl</kbd> + <kbd className="rounded border border-border bg-canvas px-1 py-0.5 font-sans">Enter</kbd> to bill
                  </p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
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
        {saveError && (
          <span role="alert" className="mt-3 block rounded-lg bg-overdue-bg px-3 py-2 text-xs font-medium text-overdue">
            {saveError}
          </span>
        )}
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}