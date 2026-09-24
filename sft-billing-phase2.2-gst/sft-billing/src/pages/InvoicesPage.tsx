import { useEffect, useMemo, useState } from "react";
import { Plus, Inbox, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InvoiceFilterBar } from "@/components/invoices/InvoiceFilterBar";
import { InvoiceRow } from "@/components/invoices/InvoiceRow";
import { BulkActionBar } from "@/components/invoices/BulkActionBar";
import { SendReminderModal } from "@/components/invoices/SendReminderModal";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { getInvoiceLedgerStatus, getInvoiceWorkflowStatus } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import type { Invoice, InvoiceStatus } from "@/types";

export function InvoicesPage() {
  const { data: invoices, loading, error, reload } = useInvoices();
  const { data: clients } = useClients();
  const { data: payments, loading: paymentsLoading, reload: reloadPayments } = usePayments();
  const { openCreateInvoice, consumePendingInvoiceFilter, navigateToInvoiceDetail } = useWorkspaceStore();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Invoice | null>(null);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [recordTarget, setRecordTarget] = useState<Invoice | null>(null);

  // AURA / the command palette can hand off a status filter to arrive with — consumed once, then it's ordinary page state.
  useEffect(() => {
    const pending = consumePendingInvoiceFilter();
    if (pending) setStatusFilter(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter((invoice) => {
        if (!statusFilter) return true;
        const workflowStatus = getInvoiceWorkflowStatus(invoice, payments ?? []).status;
        if (statusFilter === "pending") return workflowStatus === "outstanding";
        if (statusFilter === "paid") return workflowStatus === "received";
        return workflowStatus === statusFilter;
      })
      .filter((invoice) => (clientFilter ? invoice.clientId === clientFilter : true))
      .filter((invoice) => {
        if (!query.trim()) return true;
        const clientName = getClientName(clients, invoice.clientId);
        return fuzzyMatch(query, invoice.number).matches || fuzzyMatch(query, clientName).matches;
      })
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [invoices, payments, statusFilter, clientFilter, query, clients]);

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

  async function bulkSendReminders() {
    const reminders = (invoices ?? []).filter((invoice) => {
      if (!selected.has(invoice.id) || invoice.isDraft) return false;
      const ledgerInfo = getInvoiceLedgerStatus(invoice, payments ?? []);
      return ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
    });

    for (const invoice of reminders) {
      await withBusy(invoice.id, async () => {
        await activeDataProvider.addActivityEvent({
          type: "invoice_reminder_sent",
          occurredAt: new Date().toISOString(),
          summary: `Reminder sent for invoice ${invoice.number} to ${getClientName(clients, invoice.clientId)}`,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
        });
      });
    }
    setSelected(new Set());
    setToast(reminders.length > 0 ? "Reminders sent" : "Select outstanding or overdue billed invoices first");
  }

  async function editDraft(invoice: Invoice) {
    openCreateInvoice({
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      items: invoice.items,
      gst: invoice.gst,
      discount: invoice.discount,
      notes: invoice.notes,
      terms: invoice.terms,
      supplierCode: invoice.supplierCode,
      poNumber: invoice.poNumber,
      poDate: invoice.poDate,
      transporter: invoice.transporter,
    });
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
          onClear={() => setSelected(new Set())}
        />

        {loading || paymentsLoading ? (
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
                payments={payments}
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
                onSendReminder={() => setReminderTarget(invoice)}
                onSendInvoice={() => setSendTarget(invoice)}
                onRecordPayment={() => setRecordTarget(invoice)}
                onEdit={() => editDraft(invoice)}
                onView={() => navigateToInvoiceDetail(invoice.id)}
                busy={busyIds.has(invoice.id)}
              />
            ))}
          </div>
        )}
      </div>

      {reminderTarget && (
        <SendReminderModal
          open
          invoice={reminderTarget}
          onClose={() => setReminderTarget(null)}
          onSent={() => {
            setToast(`Reminder sent for ${reminderTarget.number}`);
            setReminderTarget(null);
          }}
        />
      )}
      {sendTarget && (
        <SendInvoiceModal
          open
          invoice={sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => {
            setToast(`Invoice ${sendTarget.number} sent`);
            setSendTarget(null);
            reload();
          }}
        />
      )}
      <RecordPaymentModal
        open={Boolean(recordTarget)}
        onClose={() => setRecordTarget(null)}
        invoices={recordTarget ? [recordTarget] : []}
        clients={clients}
        onRecorded={() => {
          setToast(`Payment recorded for ${recordTarget?.number}`);
          setRecordTarget(null);
          reload();
          reloadPayments();
        }}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
