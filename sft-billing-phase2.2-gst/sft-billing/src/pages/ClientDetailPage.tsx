import { useMemo, useState } from "react";
import { ArrowLeft, Inbox, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { Avatar, Card, Stat, StatGroup } from "@/components/ui/kit";
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
        <div className="space-y-2 px-6 lg:px-8 py-7">
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
            <Button variant="secondary" onClick={() => goToClients()}>
              <ArrowLeft size={14} /> Back to clients
            </Button>
          }
        />
        <div className="px-6 lg:px-8 py-10">
          <EmptyState icon={Inbox} title="Client not found" description="This client may have been removed." />
        </div>
      </div>
    );
  }

  const billedShare = rollup && rollup.totalBilled > 0 ? Math.min(100, (rollup.totalReceived / rollup.totalBilled) * 100) : 0;
  const details: Array<[string, string]> = [
    ["Contact", client.contactName || "—"],
    ["Email", client.email || "—"],
    ["Phone", client.phone ?? "—"],
    ["GSTIN", client.gstin ?? "—"],
    ["Billing address", client.billingAddress || "—"],
  ];

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle="Client details"
        action={
          <>
            <Button variant="secondary" onClick={() => goToClients()}>
              <ArrowLeft size={14} /> Back to clients
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Edit client
            </Button>
          </>
        }
      />

      <div className="space-y-6 px-6 pb-12 lg:px-8">
        {rollup && (
          <StatGroup className="md:[--cols:4]">
            <Stat label="Total billed" tone="accent" value={rollup.totalBilled} format={(n) => formatCurrency(n)} />
            <Stat label="Received" tone="success" value={rollup.totalReceived} format={(n) => formatCurrency(n)} delay={0.06} sub={`${Math.round(billedShare)}% collected`} />
            <Stat label="Outstanding" tone="pending" value={rollup.totalOutstanding} format={(n) => formatCurrency(n)} delay={0.12} />
            <Stat label="Overdue" tone="overdue" value={rollup.totalOverdue} format={(n) => formatCurrency(n)} delay={0.18} />
          </StatGroup>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={client.name} className="h-12 w-12 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{client.name}</p>
                <p className="truncate text-xs text-ink-muted">{client.contactName || "No contact on file"}</p>
              </div>
            </div>
            <dl className="mt-4 divide-y divide-border text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="py-2.5">
                  <dt className="text-xs text-ink-faint">{label}</dt>
                  <dd className="mt-0.5 break-words text-ink">{value}</dd>
                </div>
              ))}
              {client.notes && (
                <div className="py-2.5">
                  <dt className="text-xs text-ink-faint">Notes</dt>
                  <dd className="mt-0.5 text-ink-muted">{client.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          <section aria-label="Client invoices">
            <p className="mb-3 text-sm font-semibold text-ink">Invoices</p>
            {clientInvoices.length === 0 ? (
              <EmptyState icon={Inbox} title="No invoices yet" description="Invoices for this client will appear here." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="grid grid-cols-[110px_1fr_110px_110px_150px] gap-3 border-b border-border px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  <span>Invoice</span>
                  <span>Issued</span>
                  <span>Due</span>
                  <span className="text-right">Amount</span>
                  <span>Status</span>
                </div>
                {clientInvoices.map((invoice) => {
                  const { total } = computeInvoiceTotals(invoice);
                  const invoicePayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
                  const ledgerInfo = invoice.isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);
                  return (
                    <div
                      key={invoice.id}
                      className="grid grid-cols-[110px_1fr_110px_110px_150px] items-center gap-3 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-canvas/70"
                    >
                      <span>
                        <InvoiceNumberLink invoice={invoice} />
                      </span>
                      <span className="truncate text-ink-muted">{formatDate(invoice.issueDate)}</span>
                      <span className="text-ink-muted">{formatDate(invoice.dueDate)}</span>
                      <span className="font-tabular text-right font-medium text-ink">{formatCurrency(total)}</span>
                      <span>
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
          </section>
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
