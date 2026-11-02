import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Plus, Users, AlertTriangle, Pencil, Trash2, MoreHorizontal, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import { formatCurrency, extractCity } from "@/lib/formatters";
import { getClientRollup, getInvoiceLedgerStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import type { Client } from "@/types";
import { cn } from "@/lib/cn";

export function ClientsPage() {
  const { data: clients, loading, error, reload } = useClients();
  const {
    data: invoices,
    loading: invoicesLoading,
    error: invoicesError,
  } = useInvoices();
  const {
    data: payments,
    loading: paymentsLoading,
    error: paymentsError,
  } = usePayments();
  const { navigateToClientDetail } = useWorkspaceStore();

  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuOpen && actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionMenuOpen]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients
      .filter((client) => (query.trim() ? fuzzyMatch(query, client.name).matches : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, query]);

  // Memoized computations for bottom panel
  const clientRollup = useCallback((clientId: string) => {
    return getClientRollup(clientId, invoices ?? [], payments ?? []);
  }, [invoices, payments]);

  const topOutstandingClients = useMemo(() => {
    return [...filtered]
      .map((client) => ({
        client,
        rollup: clientRollup(client.id),
      }))
      .filter((item) => item.rollup.totalOutstanding > 0)
      .sort((a, b) => b.rollup.totalOutstanding - a.rollup.totalOutstanding)
      .slice(0, 5);
  }, [filtered, clientRollup]);

  const hasAnyOutstanding = useMemo(() => {
    return [...filtered]
      .map((client) => ({
        client,
        rollup: clientRollup(client.id),
      }))
      .filter((item) => item.rollup.totalOutstanding > 0).length > 0;
  }, [filtered, clientRollup]);

  function invoiceCount(clientId: string): number {
    return invoices?.filter((invoice) => invoice.clientId === clientId).length ?? 0;
  }

  function outstandingStatus(clientId: string): "paid" | "pending" | "overdue" | null {
    const rollup = clientRollup(clientId);
    if (rollup.totalOverdue > 0) return "overdue";
    if (rollup.totalOutstanding > 0) return "pending";
    if (rollup.totalBilled > 0 && rollup.totalOutstanding === 0 && rollup.totalOverdue === 0) return "paid";
    return null;
  }

  function handleCreated() {
    setAddOpen(false);
    reload();
    setToast("Client added");
  }

  function handleUpdated() {
    setEditClient(null);
    reload();
    setToast("Client updated");
  }

  async function handleDelete() {
    if (!deleteClient) return;
    const deletion = canDeleteClient(deleteClient.id);
    if (!deletion.allowed || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await activeDataProvider.deleteClient(deleteClient.id);
      setDeleteClient(null);
      reload();
      setToast("Client deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't delete client.";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  }

  function canDeleteClient(clientId: string): { allowed: boolean; reason?: string } {
    if (invoicesLoading || paymentsLoading) {
      return { allowed: false, reason: "Client billing records are still loading. Please try again." };
    }
    if (invoicesError || paymentsError || !invoices || !payments) {
      return { allowed: false, reason: "Client billing records could not be verified. Please reload the page before deleting." };
    }

    const clientInvoices = invoices?.filter((inv) => inv.clientId === clientId) ?? [];
    const clientPayments = payments?.filter((payment) => payment.clientId === clientId) ?? [];
    if (clientInvoices.length > 0 || clientPayments.length > 0) {
      const records = [
        clientInvoices.length > 0 ? `${clientInvoices.length} invoice(s)` : "",
        clientPayments.length > 0 ? `${clientPayments.length} payment(s)` : "",
      ].filter(Boolean).join(" and ");
      return {
        allowed: false,
        reason: `This client has ${records}. Billing records are protected, so this client cannot be deleted.`,
      };
    }
    return { allowed: true };
  }

  function getInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function formatClientName(name: string): string {
    // Convert ALL CAPS to Title Case, keep "M/S" prefix lighter
    const words = name.trim().split(/\s+/);
    if (words.length >= 2 && words[0].toUpperCase() === "M/S") {
      return "M/S " + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }

  function handleRowClick(client: Client, event: React.MouseEvent) {
    // Don't navigate if clicking on action menu or buttons
    const target = event.target as HTMLElement;
    if (target.closest('[data-action-menu]') || target.closest('button')) return;
    navigateToClientDetail(client.id);
  }

  const totalClients = clients?.length ?? 0;

  // Compute summary values from invoice data
  const dashboardData = useMemo(() => {
    const inv = invoices ?? [];
    const pay = payments ?? [];
    let totalInvoiced = 0;
    let totalOutstanding = 0;

    for (const i of inv) {
      if (i.isDraft) continue;
      const totals = computeInvoiceTotals(i);
      totalInvoiced += totals.total;

      const ledgerInfo = getInvoiceLedgerStatus(i, pay);
      if (ledgerInfo && (ledgerInfo.status === "outstanding" || ledgerInfo.status === "overdue")) {
        totalOutstanding += totals.total;
      }
    }

    return { totalInvoiced, outstanding: totalOutstanding };
  }, [invoices, payments]);

  const grandTotalBilled = dashboardData?.totalInvoiced ?? 0;
  const grandOutstanding = dashboardData?.outstanding ?? 0;

  if (error) {
    return (
      <div>
        <PageHeader title="Clients" subtitle="Everyone you bill, in one place" />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load clients" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Clients"
        subtitle="Everyone you bill, in one place"
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90"
          >
            <Plus size={15} /> Add client
          </button>
        }
      />

      {/* Premium Stats Cards */}
      <div className="mb-6 px-10 grid grid-cols-1 gap-4 sm:grid-cols-3" role="region" aria-label="Client summary">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="text-3xl font-bold text-ink tracking-tight">{totalClients}</div>
          <div className="mt-1 text-sm text-ink-muted">Total clients</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="text-3xl font-bold text-primary font-tabular">{formatCurrency(grandTotalBilled)}</div>
          <div className="mt-1 text-sm text-ink-muted">Total billed</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-premium/5 to-transparent" aria-hidden="true" />
          <div className="relative text-3xl font-bold text-warning font-tabular">{formatCurrency(grandOutstanding)}</div>
          <div className="mt-1 text-sm text-ink-muted">Outstanding</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-10 pb-10">
        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name, GSTIN, city…"
            className="h-11 w-full max-w-md rounded-md border border-border bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong transition-colors duration-micro"
            aria-label="Search clients"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={totalClients === 0 ? "No clients yet" : "No clients match this search"}
            description={
              totalClients === 0
                ? "Add your first client to start billing them."
                : "Try a different search term."
            }
            action={
              totalClients === 0 ? (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90"
                >
                  <Plus size={14} /> Add client
                </button>
              ) : null
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-card">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-canvas/50 px-5 py-3 text-xs font-medium text-ink-faint uppercase tracking-wider">
              <span>Client</span>
              <span className="text-right w-28">Invoices</span>
              <span className="text-right w-36 font-tabular">Total Billed</span>
              <span className="text-right w-36 font-tabular">Outstanding</span>
            </div>

            {/* Table Rows */}
            {filtered.map((client, index) => {
              const rollup = clientRollup(client.id);
              const status = outstandingStatus(client.id);
              const isEven = index % 2 === 0;

              return (
                <div
                  key={client.id}
                  ref={actionMenuOpen === client.id ? actionMenuRef : undefined}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4 transition-colors duration-micro",
                    "border-b border-border/50 last:border-b-0",
                    "hover:bg-canvas hover:shadow-card relative",
                    "cursor-pointer",
                    isEven ? "bg-transparent" : "bg-canvas/30"
                  )}
                  onClick={(e) => handleRowClick(client, e)}
                >
                  {/* Client Cell: Avatar + Name + GSTIN/City */}
                  <div className="flex items-center gap-3 min-w-0" style={{ minWidth: 0 }}>
                    {/* Avatar Initials */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg bg-premium/10 text-premium font-medium text-sm items-center justify-center flex"
                      aria-hidden="true"
                    >
                      {getInitials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink text-base">{formatClientName(client.name)}</div>
                      <div className="truncate text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                        {client.gstin && (
                          <>
                            <span className="font-mono">{client.gstin}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        {extractCity(client.billingAddress)}
                      </div>
                    </div>
                  </div>

                  {/* Invoices Count */}
                  <div className="w-28 shrink-0 text-right text-sm text-ink-muted font-tabular">
                    {invoiceCount(client.id)} {invoiceCount(client.id) === 1 ? "invoice" : "invoices"}
                  </div>

                  {/* Total Billed */}
                  <div className="w-36 shrink-0 text-right font-tabular text-sm text-ink">
                    {formatCurrency(rollup.totalBilled)}
                  </div>

                  {/* Outstanding with Status Pill */}
                  <div className="w-36 shrink-0 text-right relative">
                    <div className="flex items-center justify-end gap-2">
                      {rollup.totalBilled > 0 && (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          status === "paid" && "bg-success-bg text-success",
                          status === "pending" && "bg-caution-bg text-caution",
                          status === "overdue" && "bg-overdue-bg text-overdue",
                          status === null && "bg-neutral-bg text-neutral"
                        )}>
                          {status === "paid" && "Paid"}
                          {status === "pending" && "Pending"}
                          {status === "overdue" && "Overdue"}
                          {status === null && "—"}
                        </span>
                      )}
                      {rollup.totalOutstanding > 0 && status && (
                        <span className="font-tabular text-sm text-ink font-medium whitespace-nowrap">
                          {formatCurrency(rollup.totalOutstanding)}
                        </span>
                      )}
                      {rollup.totalBilled === 0 && (
                        <span className="text-ink-muted text-sm">—</span>
                      )}
                    </div>
                  </div>

                  {/* Action Menu (shown on hover or click) */}
                  <div
                    ref={actionMenuRef}
                    data-action-menu
                    className={cn(
                      "absolute right-5 top-1/2 -translate-y-1/2 z-20",
                      "opacity-0 transition-opacity duration-micro group-hover:opacity-100",
                      actionMenuOpen === client.id ? "opacity-100 pointer-events-auto" : "pointer-events-none"
                    )}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuOpen(actionMenuOpen === client.id ? null : client.id);
                        }}
                        className="p-1.5 rounded-lg bg-surface border border-border text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro"
                        aria-label={`Actions for ${client.name}`}
                        aria-expanded={actionMenuOpen === client.id}
                        aria-haspopup="true"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {actionMenuOpen === client.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActionMenuOpen(null)}
                            aria-hidden="true"
                          />
                          <div className="absolute right-0 top-full mt-1.5 min-w-[140px] rounded-lg border border-border bg-surface-raised shadow-float-lg overflow-hidden z-20 animate-in fade-in-0 zoom-in-95 duration-micro">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuOpen(null);
                                setEditClient(client);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-ink hover:bg-canvas transition-colors duration-micro"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuOpen(null);
                                setDeleteError(null);
                                setDeleteClient(client);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-overdue hover:bg-overdue/5 transition-colors duration-micro"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Panel - Top Clients by Outstanding */}
        {filtered.length > 0 && !loading && (
          <div className="mt-8 rounded-lg border border-border bg-surface p-5 shadow-card">
            <h3 className="mb-4 font-medium text-ink flex items-center gap-2">
              <ChevronDown size={16} className="text-premium" />
              Top Outstanding
            </h3>
            <div className="space-y-3">
              {topOutstandingClients.map(({ client, rollup }) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-canvas/50 hover:bg-canvas transition-colors duration-micro cursor-pointer"
                  onClick={() => navigateToClientDetail(client.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-premium/10 text-premium font-medium text-xs items-center justify-center flex"
                      aria-hidden="true"
                    >
                      {getInitials(client.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink text-sm">{formatClientName(client.name)}</div>
                      <div className="truncate text-xs text-ink-muted">{extractCity(client.billingAddress)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-tabular text-sm text-ink font-medium">{formatCurrency(rollup.totalOutstanding)}</span>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
                      rollup.totalOverdue > 0 && "bg-overdue-bg text-overdue",
                      rollup.totalOverdue === 0 && rollup.totalOutstanding > 0 && "bg-caution-bg text-caution"
                    )}>
                      {rollup.totalOverdue > 0 ? "Overdue" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
              {!hasAnyOutstanding && (
                <div className="text-center py-6 text-ink-muted">
                  All clients are up to date. Great job!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty space for breathing room */}
        <div className="h-16" />
      </div>

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      <AddClientModal
        open={Boolean(editClient)}
        onClose={() => setEditClient(null)}
        editingClient={editClient ?? undefined}
        onUpdated={handleUpdated}
      />
      <Modal
        open={Boolean(deleteClient)}
        onClose={() => setDeleteClient(null)}
        title="Delete client"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDeleteClient(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-overdue text-overdue hover:bg-overdue/10"
              onClick={handleDelete}
              disabled={!deleteClient || !canDeleteClient(deleteClient.id).allowed || deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        {deleteClient && (
          <>
            <p className="mb-2 text-sm text-ink">Are you sure you want to delete <strong>{deleteClient.name}</strong>?</p>
            {(() => {
              const deletion = deleteClient ? canDeleteClient(deleteClient.id) : { allowed: true };
              if (!deletion.allowed) {
                return <p className="mt-2 text-sm text-overdue" role="alert">{deletion.reason}</p>;
              }
              return <p className="text-xs text-ink-muted">This action cannot be undone.</p>;
            })()}
            {deleteError && <p className="mt-2 text-sm text-overdue" role="alert">{deleteError}</p>}
          </>
        )}
      </Modal>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}