import { useEffect, useMemo, useState } from "react";
import { Plus, Inbox, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InvoiceFilterBar } from "@/components/invoices/InvoiceFilterBar";
import { InvoiceRow } from "@/components/invoices/InvoiceRow";
import { BulkActionBar } from "@/components/invoices/BulkActionBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import type { Invoice, InvoiceStatus } from "@/types";

export function InvoicesPage() {
  const { data: invoices, loading, error, reload } = useInvoices();
  const { data: clients } = useClients();
  const { openCreateInvoice, consumePendingInvoiceFilter } = useWorkspaceStore();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // AURA / the command palette can hand off a status filter to arrive with — consumed once, then it's ordinary page state.
  useEffect(() => {
    const pending = consumePendingInvoiceFilter();
    if (pending) setStatusFilter(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter((invoice) => (statusFilter ? getInvoiceStatus(invoice).status === statusFilter : true))
      .filter((invoice) => (clientFilter ? invoice.clientId === clientFilter : true))
      .filter((invoice) => {
        if (!query.trim()) return true;
        const clientName = getClientName(clients, invoice.clientId);
        return fuzzyMatch(query, invoice.number).matches || fuzzyMatch(query, clientName).matches;
      })
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [invoices, statusFilter, clientFilter, query, clients]);

  function withBusy(id: string, fn: () => Promise<void>) {
    setBusyIds((prev) => new Set(prev).add(id));
    return fn().finally(() => {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  async function sendReminder(invoice: Invoice) {
    await withBusy(invoice.id, async () => {
      await activeDataProvider.addActivityEvent({
        type: "invoice_reminder_sent",
        occurredAt: new Date().toISOString(),
        summary: `Reminder sent for invoice ${invoice.number} to ${getClientName(clients, invoice.clientId)}`,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
      });
      setToast(`Reminder sent for ${invoice.number}`);
    });
  }

  async function markPaid(invoice: Invoice) {
    await withBusy(invoice.id, async () => {
      const now = new Date().toISOString();
      await activeDataProvider.saveInvoice({ ...invoice, paidAt: now });
      await activeDataProvider.recordPayment({
        id: `pm_runtime_${Date.now()}`,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: computeInvoiceTotals(invoice).total,
        method: "bank_transfer",
        receivedAt: now,
      });
      await activeDataProvider.addActivityEvent({
        type: "payment_received",
        occurredAt: now,
        summary: `Payment received for invoice ${invoice.number}`,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
      });
      reload();
      setToast(`${invoice.number} marked as paid`);
    });
  }

  async function editDraft(invoice: Invoice) {
    openCreateInvoice({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      items: invoice.items,
      taxRate: invoice.taxRate,
      discount: invoice.discount,
      notes: invoice.notes,
    });
  }

  async function duplicate(invoice: Invoice) {
    await withBusy(invoice.id, async () => {
      openCreateInvoice({
        clientId: invoice.clientId,
        items: invoice.items.map((item, i) => ({ ...item, id: `li_dup_${Date.now()}_${i}` })),
        taxRate: invoice.taxRate,
        discount: invoice.discount,
        notes: invoice.notes,
      });
    });
  }

  async function bulkSendReminders() {
    const ids = Array.from(selected);
    for (const id of ids) {
      const invoice = invoices?.find((i) => i.id === id);
      if (invoice) await sendReminder(invoice);
    }
    setSelected(new Set());
  }

  async function bulkMarkPaid() {
    const ids = Array.from(selected);
    for (const id of ids) {
      const invoice = invoices?.find((i) => i.id === id);
      if (invoice && getInvoiceStatus(invoice).status !== "paid") await markPaid(invoice);
    }
    setSelected(new Set());
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Invoices" subtitle="Every invoice, in one place" />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load invoices" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Every invoice, in one place"
        action={
          <button
            type="button"
            onClick={() => openCreateInvoice()}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90"
          >
            <Plus size={15} /> New invoice
          </button>
        }
      />

      <div className="space-y-5 px-10 py-7">
        <InvoiceFilterBar
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          clientFilter={clientFilter}
          onClientChange={setClientFilter}
          clients={clients}
        />

        <BulkActionBar
          count={selected.size}
          onSendReminders={bulkSendReminders}
          onMarkPaid={bulkMarkPaid}
          onClear={() => setSelected(new Set())}
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={invoices?.length === 0 ? "No invoices yet" : "No invoices match these filters"}
            description={
              invoices?.length === 0
                ? "Create your first invoice to get started."
                : "Try a different search term, or clear the filters."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {filtered.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                clients={clients}
                isSelected={selected.has(invoice.id)}
                onToggleSelect={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(invoice.id)) next.delete(invoice.id);
                    else next.add(invoice.id);
                    return next;
                  })
                }
                isExpanded={expandedId === invoice.id}
                onToggleExpand={() => setExpandedId((cur) => (cur === invoice.id ? null : invoice.id))}
                onSendReminder={() => sendReminder(invoice)}
                onMarkPaid={() => markPaid(invoice)}
                onDuplicate={() => duplicate(invoice)}
                onEdit={() => editDraft(invoice)}
                busy={busyIds.has(invoice.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
