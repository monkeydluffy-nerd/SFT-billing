import { useMemo, useState } from "react";
import { ArrowLeft, Inbox, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Toast } from "@/components/shared/Toast";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { StatusChip } from "@/components/shared/StatusChip";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { getInvoiceStatus, getInvoiceLedgerStatus, computeInvoiceTotals, getClientRollup } from "@/lib/invoiceMath";
import { formatCurrency, formatDate } from "@/lib/formatters";

export function ClientDetailPage() {
  const { data: clients, loading: clientsLoading, reload: reloadClients } = useClients();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: payments, loading: paymentsLoading } = usePayments();
  const { selectedClientId, goToClients } = useWorkspaceStore();
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const client = clients?.find((c) => c.id === selectedClientId);

  const clientInvoices = useMemo(
    () =>
      (invoices ?? [])
        .filter((invoice) => invoice.clientId === selectedClientId)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [invoices, selectedClientId],
  );

  const loading = clientsLoading || invoicesLoading || paymentsLoading;

  const rollup = useMemo(
    () => (selectedClientId ? getClientRollup(selectedClientId, invoices ?? [], payments ?? []) : null),
    [selectedClientId, invoices, payments],
  );

  if (loading) {
    return (
      <div>
        <PageHeader title="Client" subtitle="Loading…" />
        <div className="space-y-2 px-10 py-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader
          title="Client"
          action={
            <button
              type="button"
              onClick={() => goToClients()}
              className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-micro hover:border-accent/40 hover:bg-accent/[0.14]"
            >
              <ArrowLeft size={14} /> Back to clients
            </button>
          }
        />
        <div className="px-10 py-10">
          <EmptyState icon={Inbox} title="Client not found" description="This client may have been removed." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle="Client details"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90"
            >
              <Pencil size={14} /> Edit client
            </button>
            <button
              type="button"
              onClick={() => goToClients()}
              className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/[0.08] px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-micro hover:border-accent/40 hover:bg-accent/[0.14]"
            >
              <ArrowLeft size={14} /> Back to clients
            </button>
          </div>
        }
      />

      <div className="space-y-8 px-10 py-7">
        {rollup && (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-ink-faint">Total Billed</p>
              <p className="font-tabular mt-1 text-lg text-ink">{formatCurrency(rollup.totalBilled)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-faint">Received</p>
              <p className="font-tabular mt-1 text-lg text-success">{formatCurrency(rollup.totalReceived)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-faint">Outstanding</p>
              <p className="font-tabular mt-1 text-lg text-pending">{formatCurrency(rollup.totalOutstanding)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-faint">Overdue</p>
              <p className="font-tabular mt-1 text-lg text-overdue">{formatCurrency(rollup.totalOverdue)}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-ink-faint">Contact</p>
            <p className="mt-1 text-sm text-ink truncate">{client.contactName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-faint">Email</p>
            <p className="mt-1 text-sm text-ink truncate">{client.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-faint">Phone</p>
            <p className="mt-1 text-sm text-ink truncate">{client.phone ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-ink-faint">Billing address</p>
            <p className="mt-1 text-sm text-ink truncate">{client.billingAddress}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-faint">GSTIN</p>
            <p className="mt-1 text-sm text-ink truncate">{client.gstin ?? "—"}</p>
          </div>
          {client.notes && (
            <div className="col-span-full">
              <p className="text-xs font-medium text-ink-faint">Notes</p>
              <p className="mt-1 text-sm text-ink-muted">{client.notes}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-ink">Invoices</p>
          {clientInvoices.length === 0 ? (
            <EmptyState icon={Inbox} title="No invoices yet" description="Invoices for this client will appear here." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {clientInvoices.map((invoice) => {
                const { total } = computeInvoiceTotals(invoice);
                const invoicePayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
                const ledgerInfo = invoice.isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);
                return (
                  <div
                    key={invoice.id}
                    className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <span className="w-24 shrink-0">
                      <InvoiceNumberLink invoice={invoice} />
                    </span>
                    <span className="flex-1 truncate text-ink-muted">{formatDate(invoice.issueDate)}</span>
                    <span className="w-28 shrink-0 text-ink-muted">{formatDate(invoice.dueDate)}</span>
                    <span className="font-tabular w-28 shrink-0 text-right text-ink">{formatCurrency(total)}</span>
                    <span className="w-36 shrink-0">
                      {invoice.isDraft ? (
                        <StatusChip info={getInvoiceStatus(invoice)} />
                      ) : ledgerInfo ? (
                        <LedgerStatusChip info={ledgerInfo} />
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AddClientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editingClient={client}
        onUpdated={() => {
          setEditOpen(false);
          reloadClients();
          setToast("Client updated");
        }}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
