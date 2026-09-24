import { useMemo, useState } from "react";
import { Plus, Users, AlertTriangle, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import { formatCurrency } from "@/lib/formatters";
import { getClientRollup } from "@/lib/invoiceMath";
import type { Client } from "@/types";

export function ClientsPage() {
  const { data: clients, loading, error, reload } = useClients();
  const { data: invoices } = useInvoices();
  const { data: payments } = usePayments();
  const { navigateToClientDetail } = useWorkspaceStore();

  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients
      .filter((client) => (query.trim() ? fuzzyMatch(query, client.name).matches : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, query]);

  function invoiceCount(clientId: string): number {
    return invoices?.filter((invoice) => invoice.clientId === clientId).length ?? 0;
  }

  function totalBilled(clientId: string): number {
    return getClientRollup(clientId, invoices ?? [], payments ?? []).totalBilled;
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
    <div>
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

      <div className="space-y-5 px-10 py-7">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients"
          className="h-10 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
          aria-label="Search clients"
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clients?.length === 0 ? "No clients yet" : "No clients match this search"}
            description={
              clients?.length === 0
                ? "Add your first client to start billing them."
                : "Try a different search term."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-4 border-b border-border bg-canvas px-4 py-2 text-xs font-medium text-ink-faint">
              <span className="flex-1">Client</span>
              <span className="w-48 shrink-0">Contact</span>
              <span className="w-56 shrink-0">Email</span>
              <span className="w-28 shrink-0">Invoices</span>
              <span className="w-32 shrink-0 text-right">Total Billed</span>
              <span className="w-20 shrink-0 text-right">Action</span>
            </div>
            {filtered.map((client) => (
              <div key={client.id} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
                <button
                  type="button"
                  onClick={() => navigateToClientDetail(client.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left transition-colors duration-micro hover:bg-canvas"
                >
                  <span className="flex-1 truncate font-medium text-ink">{client.name}</span>
                  <span className="w-48 shrink-0 truncate text-ink-muted">{client.contactName}</span>
                  <span className="w-56 shrink-0 truncate text-ink-muted">{client.email}</span>
                  <span className="w-28 shrink-0 text-ink-muted">
                    {invoiceCount(client.id)} invoice{invoiceCount(client.id) === 1 ? "" : "s"}
                  </span>
                  <span className="w-32 shrink-0 text-right font-tabular text-ink">{formatCurrency(totalBilled(client.id))}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditClient(client)}
                  className="inline-flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium text-accent transition-colors duration-micro hover:text-ink"
                  aria-label={`Edit ${client.name}`}
                >
                  <Pencil size={12} aria-hidden /> Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      <AddClientModal
        open={Boolean(editClient)}
        onClose={() => setEditClient(null)}
        editingClient={editClient ?? undefined}
        onUpdated={handleUpdated}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
