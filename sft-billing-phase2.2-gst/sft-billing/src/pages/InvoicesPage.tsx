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
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import { getInvoiceLedgerStatus, getInvoiceWorkflowStatus, getGlobalRollup } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice, InvoiceStatus } from "@/types";

export function InvoicesPage() {
  const { data: invoices, loading, error, reload } = useInvoices();
  const { data: clients } = useClients();
  const { data: payments, loading: paymentsLoading, reload: reloadPayments } = usePayments();
  const { openCreateInvoice, consumePendingInvoiceFilter, navigateToInvoiceDetail } = useWorkspaceStore();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Invoice | null>(null);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [recordTarget, setRecordTarget] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        if (dateRange.from && new Date(invoice.issueDate) < dateRange.from) return false;
        if (dateRange.to && new Date(invoice.issueDate) > dateRange.to) return false;
        return true;
      })
      .filter((invoice) => {
        if (!query.trim()) return true;
        const clientName = getClientName(clients, invoice.clientId);
        return fuzzyMatch(query, invoice.number).matches || fuzzyMatch(query, clientName).matches;
      })
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [invoices, payments, statusFilter, clientFilter, query, clients, dateRange]);

  // Group invoices by month
  const groupedInvoices = useMemo(() => {
    const groups: Record<string, Invoice[]> = {};
    for (const invoice of filtered) {
      const date = new Date(invoice.issueDate);
      const key = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(invoice);
    }
    // Sort groups by date descending
    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b + " 1").getTime() - new Date(a + " 1").getTime())
      .map(([month, invoices]) => ({ month, invoices }));
  }, [filtered]);

  // Global rollup for summary strip
  const globalRollup = useMemo(() => {
    if (!invoices || !payments) return { totalBilled: 0, totalReceived: 0, totalOutstanding: 0, totalOverdue: 0 };
    return getGlobalRollup(invoices, payments);
  }, [invoices, payments]);

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

  async function bulkDownload() {
    const toDownload = (invoices ?? []).filter((inv) => selected.has(inv.id));
    if (toDownload.length === 0) return;
    // TODO: Implement bulk PDF download when backend supports it
    setToast(`Preparing ${toDownload.length} invoice(s) for download...`);
  }

  async function bulkMarkReceived() {
    const toMark = (invoices ?? []).filter((inv) => selected.has(inv.id) && !inv.isDraft);
    if (toMark.length === 0) {
      setToast("No billed invoices selected");
      return;
    }
    // This would need backend support for bulk marking
    // For now, just open the first one's payment modal
    if (toMark.length === 1) {
      setRecordTarget(toMark[0]);
    } else {
      setToast("Mark received works on one invoice at a time");
    }
    setSelected(new Set());
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

  async function confirmDeleteInvoice() {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await activeDataProvider.deleteInvoice(deleteTarget.id);
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setExpandedId((current) => current === deletedId ? null : current);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(deletedId);
        return next;
      });
      setToast(`Draft invoice ${deleteTarget.number} deleted`);
      reload();
      reloadPayments();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Invoice could not be deleted.");
    } finally {
      setDeletePending(false);
    }
  }

  const deleteBlockReason = deleteTarget
    ? !deleteTarget.isDraft
      ? "Billed invoices cannot be permanently deleted. No cancellation or correction workflow is available here."
      : deleteTarget.billedAt || deleteTarget.sentAt || deleteTarget.viewedAt || deleteTarget.paidAt
        ? "This draft invoice has billing, delivery, or payment history and cannot be deleted."
        : (payments ?? []).some((payment) => payment.invoiceId === deleteTarget.id)
          ? "This invoice has payment history and cannot be deleted."
          : null
    : null;

  function handleQuickAction(action: "download" | "remind" | "payment", invoice: Invoice) {
    if (action === "download") {
      // TODO: Implement PDF download
      setToast(`PDF download for ${invoice.number} — Phase 4`);
    } else if (action === "remind") {
      setReminderTarget(invoice);
    } else if (action === "payment") {
      setRecordTarget(invoice);
    }
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
    <div className="flex flex-col h-full relative">
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

      {/* Summary Strip */}
      <div className="mb-6 px-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Invoice summary">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="text-2xl font-bold text-ink font-tabular">{formatCurrency(globalRollup.totalBilled)}</div>
          <div className="mt-1 text-sm text-ink-muted">Total invoiced</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="text-2xl font-bold text-success font-tabular">{formatCurrency(globalRollup.totalReceived)}</div>
          <div className="mt-1 text-sm text-ink-muted">Received</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="text-2xl font-bold text-pending font-tabular">{formatCurrency(globalRollup.totalOutstanding)}</div>
          <div className="mt-1 text-sm text-ink-muted">Outstanding</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card hover:shadow-float transition-shadow duration-micro relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-overdue/5 to-transparent" aria-hidden="true" />
          <div className="relative text-2xl font-bold text-overdue font-tabular">{formatCurrency(globalRollup.totalOverdue)}</div>
          <div className="mt-1 text-sm text-ink-muted">Overdue</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-10 pb-20">
        <InvoiceFilterBar
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          clientFilter={clientFilter}
          onClientChange={setClientFilter}
          clients={clients}
          invoices={invoices}
          payments={payments}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        <BulkActionBar
          count={selected.size}
          onSendReminders={bulkSendReminders}
          onDownload={bulkDownload}
          onMarkReceived={bulkMarkReceived}
          onClear={() => setSelected(new Set())}
          busy={busyIds.size > 0}
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
            action={
              invoices?.length === 0 ? (
                <button
                  type="button"
                  onClick={() => openCreateInvoice()}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90"
                >
                  <Plus size={14} /> New invoice
                </button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-4">
            {groupedInvoices.map(({ month, invoices: monthInvoices }) => (
              <div key={month} className="rounded-lg border border-border bg-surface overflow-hidden shadow-card">
                {/* Sticky Month Header */}
                <div className="sticky top-0 z-10 grid gap-3 px-4 py-2.5 bg-canvas/80 border-b border-border backdrop-blur-sm supports-[backdrop-filter]:bg-canvas/80"
                  style={{ gridTemplateColumns: "24px 110px 1fr 120px 130px 170px 40px" }}>
                  <span aria-hidden="true" />
                  <span className="text-xs font-medium text-ink-faint uppercase tracking-wider font-tabular">Invoice</span>
                  <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">Client</span>
                  <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">Date</span>
                  <span className="text-xs font-medium text-ink-faint uppercase tracking-wider text-right">Amount</span>
                  <span className="text-xs font-medium text-ink-faint uppercase tracking-wider">Status</span>
                  <span aria-hidden="true" />
                </div>

                {/* Table Rows */}
                {monthInvoices.map((invoice) => (
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
                    onDelete={() => {
                      setDeleteError(null);
                      setDeleteTarget(invoice);
                    }}
                    busy={busyIds.has(invoice.id)}
                    onQuickAction={handleQuickAction}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Empty space for floating bar */}
        <div className="h-24" />
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

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deletePending) setDeleteTarget(null);
        }}
        title={`Delete invoice ${deleteTarget?.number}?`}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deletePending}
            >
              Close
            </Button>
            {!deleteBlockReason && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void confirmDeleteInvoice()}
                disabled={deletePending}
              >
                {deletePending ? "Deleting…" : "Delete draft"}
              </Button>
            )}
          </>
        }
      >
        {deleteTarget && (
          <p className="mb-2">
            Invoice <strong>{deleteTarget.number}</strong> for{" "}
            <strong>{getClientName(clients, deleteTarget.clientId)}</strong>.
          </p>
        )}
        {deleteBlockReason ? (
          <p role="alert">{deleteBlockReason}</p>
        ) : (
          <p>
            This permanently removes the draft invoice and its line items. Its invoice number remains reserved and cannot be reused.
          </p>
        )}
        {deleteError && <p role="alert" className="mt-2 text-overdue">{deleteError}</p>}
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}