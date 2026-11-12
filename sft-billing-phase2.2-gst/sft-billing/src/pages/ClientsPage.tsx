import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Plus, Users, AlertTriangle, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Avatar, SearchField, SpotlightCard, Stat, StatGroup } from "@/components/ui/kit";
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
        <div className="px-6 lg:px-8 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load clients" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Everyone you bill, in one place"
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add client
          </Button>
        }
      />

      <div className="space-y-6 px-6 pb-12 lg:px-8">
        <div role="region" aria-label="Client summary">
          <StatGroup className="md:[--cols:3]">
            <Stat label="Total clients" tone="accent" value={totalClients} format={(n) => String(Math.round(n))} />
            <Stat label="Total billed" tone="success" value={grandTotalBilled} format={(n) => formatCurrency(n)} delay={0.06} />
            <Stat label="Outstanding" tone="caution" value={grandOutstanding} format={(n) => formatCurrency(n)} delay={0.12} />
          </StatGroup>
        </div>

        <SearchField value={query} onChange={setQuery} placeholder="Search clients by name, GSTIN, city…" label="Search clients" className="w-full sm:max-w-sm" />

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={totalClients === 0 ? "No clients yet" : "No clients match this search"}
            description={totalClients === 0 ? "Add your first client to start billing them." : "Try a different search term."}
            action={
              totalClients === 0 ? (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus size={14} /> Add client
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="stagger-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Clients">
            {filtered.map((client) => {
              const rollup = clientRollup(client.id);
              const status = outstandingStatus(client.id);
              const count = invoiceCount(client.id);
              const collected = rollup.totalBilled > 0 ? Math.max(0, Math.min(100, ((rollup.totalBilled - rollup.totalOutstanding) / rollup.totalBilled) * 100)) : 0;
              return (
                <li key={client.id}>
                  <SpotlightCard className="rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
                    <div
                      ref={actionMenuOpen === client.id ? actionMenuRef : undefined}
                      className="cursor-pointer p-5"
                      onClick={(e) => handleRowClick(client, e)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={client.name} className="h-11 w-11 text-sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-semibold text-ink">{formatClientName(client.name)}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-muted">
                            {client.gstin && (
                              <>
                                <span className="font-mono">{client.gstin}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span className="truncate">{extractCity(client.billingAddress)}</span>
                          </div>
                        </div>

                        <div data-action-menu className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === client.id ? null : client.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
                            aria-label={`Actions for ${client.name}`}
                            aria-expanded={actionMenuOpen === client.id}
                            aria-haspopup="true"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {actionMenuOpen === client.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpen(null)} aria-hidden="true" />
                              <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[150px] overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-float-lg">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpen(null);
                                    setEditClient(client);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas"
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
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-overdue transition-colors hover:bg-overdue-bg"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <dt className="text-[11px] text-ink-faint">Invoices</dt>
                          <dd className="font-tabular mt-0.5 font-medium text-ink">
                            {count} {count === 1 ? "invoice" : "invoices"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-ink-faint">Billed</dt>
                          <dd className="font-tabular mt-0.5 font-medium text-ink">{formatCurrency(rollup.totalBilled)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-ink-faint">Outstanding</dt>
                          <dd className="font-tabular mt-0.5 font-medium text-ink">{rollup.totalOutstanding > 0 ? formatCurrency(rollup.totalOutstanding) : "—"}</dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(collected)} aria-valuemin={0} aria-valuemax={100} aria-label="Collected">
                          <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${collected}%` }} />
                        </div>
                        {rollup.totalBilled > 0 && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              status === "paid" && "bg-success-bg text-success",
                              status === "pending" && "bg-caution-bg text-caution",
                              status === "overdue" && "bg-overdue-bg text-overdue",
                              status === null && "bg-neutral-bg text-neutral",
                            )}
                          >
                            {status === "paid" && "Paid"}
                            {status === "pending" && "Pending"}
                            {status === "overdue" && "Overdue"}
                            {status === null && "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  </SpotlightCard>
                </li>
              );
            })}
          </ul>
        )}
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