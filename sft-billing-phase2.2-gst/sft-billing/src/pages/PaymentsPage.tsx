import { useMemo, useState } from "react";
import {
  Plus,
  Inbox,
  AlertTriangle,
  ChevronDown,
  ArrowUpDown,
  X,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle as AlertTriangleIcon,
} from "lucide-react";
import { Avatar, Card, CardHeader, SearchField, Stat, StatGroup } from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { Button } from "@/components/shared/Button";
import { RecordPaymentSidePanel } from "@/components/payments/RecordPaymentSidePanel";
import { PaymentDetailSidePanel } from "@/components/payments/PaymentDetailSidePanel";
import { usePayments } from "@/hooks/usePayments";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";
import { METHOD_LABELS } from "@/lib/paymentLabels";
import { getInvoiceLedgerStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { cn } from "@/lib/cn";
import type { Client, Invoice, Payment, RecordPaymentResult } from "@/types";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

const PAYMENT_GRID = "104px minmax(0,0.9fr) minmax(0,1.2fr) 120px 132px 132px 36px";

const TEST_PAYMENT_PREFIXES = ["TEST-", "TEST_", "test-", "test_", "__TEMP_FLOW_CHECK__"];

function getMethodIcon(method: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    bank_transfer: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3-3v8a3 3 0 003 3z" /></svg>,
    card: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
    upi: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    cheque: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    cash: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" /></svg>,
  };
  return icons[method] || <span className="text-xs font-medium">{method}</span>;
}

interface EnrichedPayment extends Payment {
  invoice?: Invoice;
  client?: Client;
  invoiceTotals: ReturnType<typeof computeInvoiceTotals> | null;
  ledgerInfo: ReturnType<typeof getInvoiceLedgerStatus> | null;
  isFullyPaid: boolean | null;
  monthKey: string;
  methodLabel: string;
}

function isTestPayment(payment: Payment, invoices: Invoice[], clients: Client[]): boolean {
  const invoice = invoices?.find((i) => i.id === payment.invoiceId);
  const client = clients?.find((c) => c.id === payment.clientId);
  return Boolean(
    TEST_PAYMENT_PREFIXES.some((prefix) => payment.id.toUpperCase().startsWith(prefix)) ||
    (invoice && TEST_PAYMENT_PREFIXES.some((prefix) => invoice.number.toUpperCase().startsWith(prefix))) ||
    (client && TEST_PAYMENT_PREFIXES.some((prefix) => client.name.toUpperCase().startsWith(prefix)))
  );
}

export function PaymentsPage() {
  const { data: payments, loading, error, reload } = usePayments();
  const { data: invoicesData } = useInvoices();
  const { data: clientsData } = useClients();
  const navigateToInvoiceDetail = useWorkspaceStore((state) => state.navigateToInvoiceDetail);

  const [query, setQuery] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [showTestItems, setShowTestItems] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "method">("date");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const invoices = useMemo(() => invoicesData ?? [], [invoicesData]);
  const clients = useMemo(() => clientsData ?? [], [clientsData]);
  const billedInvoices = useMemo(() => invoices.filter((invoice) => !invoice.isDraft), [invoices]);

  // Compute payment details with invoice and client info
  const enrichedPayments = useMemo(() => {
    return (payments ?? []).map((payment): EnrichedPayment => {
      const invoice = invoices?.find((i) => i.id === payment.invoiceId);
      const client = clients?.find((c) => c.id === payment.clientId);
      const invoiceTotals = invoice ? computeInvoiceTotals(invoice) : null;
      const ledgerInfo = invoice ? getInvoiceLedgerStatus(invoice, []) : null;
      const isFullyPaid = invoiceTotals && payment.amount >= invoiceTotals.total;
      const monthKey = payment.receivedAt.substring(0, 7); // YYYY-MM
      return {
        ...payment,
        invoice,
        client,
        invoiceTotals,
        ledgerInfo,
        isFullyPaid,
        monthKey,
        methodLabel: METHOD_LABELS[payment.method] ?? payment.method,
      };
    });
  }, [payments, invoices, clients]);

  // Filter and sort
  const filteredPayments = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const result = enrichedPayments.filter((payment) => {
      const matchesSearch =
        !search ||
        payment.id.toLocaleLowerCase().includes(search) ||
        payment.invoice?.number?.toLocaleLowerCase().includes(search) ||
        payment.client?.name?.toLocaleLowerCase().includes(search) ||
        payment.reference?.toLocaleLowerCase().includes(search);
      const matchesTestFilter = showTestItems || !isTestPayment(payment, invoices, clients);
      const matchesMethodFilter = methodFilter === null || payment.method === methodFilter;
      const matchesMonthFilter = monthFilter === null || payment.monthKey === monthFilter;
      return matchesSearch && matchesTestFilter && matchesMethodFilter && matchesMonthFilter;
    });

    switch (sortBy) {
      case "amount":
        result.sort((a, b) => b.amount - a.amount);
        break;
      case "method":
        result.sort((a, b) => a.method.localeCompare(b.method));
        break;
      default:
        result.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    }
    return result;
  }, [enrichedPayments, query, showTestItems, sortBy, methodFilter, monthFilter, invoices, clients]);

  // Group by month
  const groupedPayments = useMemo(() => {
    const groups: Record<string, typeof filteredPayments> = {};
    for (const payment of filteredPayments) {
      const monthKey = payment.monthKey;
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(payment);
    }
    return groups;
  }, [filteredPayments]);

  // Monthly subtotals
  const monthlySubtotals = useMemo(() => {
    const subtotals: Record<string, { total: number; count: number }> = {};
    for (const [monthKey, payments] of Object.entries(groupedPayments)) {
      subtotals[monthKey] = {
        total: payments.reduce((sum, p) => sum + p.amount, 0),
        count: payments.length,
      };
    }
    return subtotals;
  }, [groupedPayments]);

  // Summary calculations
  const summary = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthPayments = enrichedPayments.filter(
      (p) => new Date(p.receivedAt) >= thisMonthStart
    );
    const receivedThisMonth = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Still to collect (outstanding + overdue)
    const allInvoices = (invoices ?? []).filter((i) => !i.isDraft);
    let stillToCollect = 0;
    for (const inv of allInvoices) {
      const totals = computeInvoiceTotals(inv);
      const paid = enrichedPayments.filter((p) => p.invoiceId === inv.id).reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.max(0, totals.total - paid);
      stillToCollect += outstanding;
    }

    // Payments recorded count
    const paymentsRecorded = enrichedPayments.length;
    const latestPaymentDate = enrichedPayments.length > 0
      ? enrichedPayments.reduce((latest, p) => new Date(p.receivedAt) > new Date(latest.receivedAt) ? p : latest).receivedAt
      : null;

    // Missing proof
    const missingProof = enrichedPayments.filter((p) => !p.paymentProof).length;

    return {
      receivedThisMonth,
      stillToCollect,
      paymentsRecorded,
      latestPaymentDate,
      missingProof,
    };
  }, [enrichedPayments, invoices]);

  const testItemsCount = enrichedPayments.filter((p) => isTestPayment(p, invoices, clients)).length;
  const visibleCount = filteredPayments.length;
  const totalCount = enrichedPayments.length;

  function handleRecorded(result: RecordPaymentResult) {
    setRecordOpen(false);
    reload();
    setToast(`Payment of ${formatCurrency(result.payment.amount)} recorded`);
  }

  function openNewPayment() {
    setRecordOpen(true);
  }

  function openDetail(payment: Payment) {
    setDetailPayment(payment);
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Payments" subtitle="Every payment received, in one place" />
        <div className="px-6 lg:px-8 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load payments" description={error.message} />
        </div>
      </div>
    );
  }

  const selectClass =
    "h-10 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface px-4 pr-9 text-sm text-ink outline-none transition hover:border-accent focus:border-accent focus:ring-4 focus:ring-accent/15";

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Every payment received, in one place"
        action={
          <Button onClick={openNewPayment} disabled={!invoices || billedInvoices.length === 0}>
            <Plus size={15} /> Record payment
          </Button>
        }
      />

      <div className="space-y-6 px-6 pb-12 lg:px-8">
        <div role="region" aria-label="Payment summary">
          <StatGroup className="md:[--cols:4]">
            <Stat label="Received this month" tone="success" value={summary.receivedThisMonth} format={(n) => formatCurrency(n)} />
            <Stat label="Still to collect" tone="caution" value={summary.stillToCollect} format={(n) => formatCurrency(n)} delay={0.06} />
            <Stat
              label="Payments recorded"
              tone="accent"
              value={summary.paymentsRecorded}
              format={(n) => String(Math.round(n))}
              delay={0.12}
              sub={summary.latestPaymentDate ? `Latest ${formatRelativeTime(summary.latestPaymentDate)}` : undefined}
            />
            <Stat label="Missing proof" tone={summary.missingProof === 0 ? "success" : "overdue"} value={summary.missingProof} format={(n) => String(Math.round(n))} delay={0.18} />
          </StatGroup>
        </div>

        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {/* Search & filters */}
            <div className="flex flex-wrap items-center gap-3">
              <SearchField value={query} onChange={setQuery} placeholder="Search by ID, invoice, client, reference…" label="Search payments" className="w-full sm:w-80" />

              <div className="relative">
                <select value={methodFilter ?? ""} onChange={(e) => setMethodFilter(e.target.value || null)} className={selectClass} aria-label="Filter by method">
                  <option value="">All methods</option>
                  {(["bank_transfer", "card", "upi", "cheque", "cash"] as const).map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={14} aria-hidden />
              </div>

              <div className="relative">
                <select value={monthFilter ?? ""} onChange={(e) => setMonthFilter(e.target.value || null)} className={selectClass} aria-label="Filter by month">
                  <option value="">All months</option>
                  {Object.keys(groupedPayments).sort().reverse().map((month) => (
                    <option key={month} value={month}>
                      {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                      ({monthlySubtotals[month]?.count ?? 0})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={14} aria-hidden />
              </div>

              <div className="relative">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "amount" | "method")} className={selectClass} aria-label="Sort payments">
                  <option value="date">Sort: Date (newest)</option>
                  <option value="amount">Sort: Amount (high to low)</option>
                  <option value="method">Sort: Method</option>
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={14} aria-hidden />
              </div>

              {testItemsCount > 0 && (
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm text-ink-muted transition hover:border-accent">
                  <input type="checkbox" checked={showTestItems} onChange={(e) => setShowTestItems(e.target.checked)} className="accent-accent" />
                  <span>Show test items ({testItemsCount})</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>
                {visibleCount} of {totalCount} payment{totalCount !== 1 ? "s" : ""}
                {query && ` (filtered from "${query}")`}
                {methodFilter && ` • Method: ${METHOD_LABELS[methodFilter as keyof typeof METHOD_LABELS]}`}
                {monthFilter && ` • Month: ${new Date(monthFilter + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
              </span>
              {showTestItems && testItemsCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowTestItems(false)}>
                  <X size={12} aria-hidden /> Hide test items
                </Button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3" aria-label="Loading payments">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : visibleCount === 0 ? (
              <EmptyState
                icon={Inbox}
                title={totalCount === 0 ? "No payments yet" : "No payments match your filters"}
                description={totalCount === 0 ? "Record a payment against an invoice to see it here." : "Try adjusting your search or filters."}
                action={
                  totalCount === 0 ? (
                    <Button onClick={openNewPayment}>
                      <Plus size={15} aria-hidden /> Record payment
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-clip rounded-xl border border-border bg-surface">
                <div
                  className="sticky top-14 z-10 grid gap-3 border-b border-border bg-surface px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-faint"
                  style={{ gridTemplateColumns: PAYMENT_GRID }}
                  role="row"
                  aria-label="Payment columns"
                >
                  <span>Date</span>
                  <span>Invoice</span>
                  <span>Client</span>
                  <span className="text-right">Amount</span>
                  <span>Method</span>
                  <span>Proof</span>
                  <span />
                </div>

                {Object.entries(groupedPayments).map(([monthKey, monthPayments]) => {
                  const subtotal = monthlySubtotals[monthKey];
                  const monthLabel = new Date(monthKey + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                  return (
                    <div key={monthKey}>
                      <div className="flex items-center justify-between border-b border-border bg-canvas/70 px-5 py-2 text-xs font-medium text-ink-muted">
                        <span>{monthLabel}</span>
                        <span className="font-tabular">
                          <span className="font-semibold text-ink">{formatCurrency(subtotal.total)}</span>
                          <span className="ml-2 text-ink-faint">
                            {subtotal.count} payment{subtotal.count !== 1 ? "s" : ""}
                          </span>
                        </span>
                      </div>
                      {monthPayments.map((payment, index) => (
                        <PaymentRow
                          key={payment.id}
                          payment={payment}
                          index={index}
                          onClick={() => openDetail(payment)}
                          onOpenInvoice={() => {
                            if (payment.invoice) navigateToInvoiceDetail(payment.invoice.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDetail(payment);
                            }
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="2xl:sticky 2xl:top-20">
            <WaitingForPaymentPanel invoices={billedInvoices} payments={enrichedPayments} clients={clients} onRecordPayment={openNewPayment} />
          </div>
        </div>
      </div>

      {/* Record Payment Side Panel */}
      <RecordPaymentSidePanel
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        invoices={billedInvoices}
        clients={clients}
        payments={payments ?? []}
        onRecorded={handleRecorded}
      />

      {/* Payment Detail Side Panel */}
      <PaymentDetailSidePanel
        open={!!detailPayment}
        onClose={() => setDetailPayment(null)}
        payment={detailPayment}
        invoices={invoices}
        clients={clients}
        payments={payments ?? []}
        onRecorded={handleRecorded}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ============================================================================
// PaymentRow Component
// ============================================================================
interface PaymentRowProps {
  payment: EnrichedPayment;
  index: number;
  onClick: () => void;
  onOpenInvoice: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function PaymentRow({ payment, onClick, onOpenInvoice, onKeyDown }: PaymentRowProps) {
  const client = payment.client;
  const isTest = client ? TEST_PAYMENT_PREFIXES.some((prefix) => client.name.toUpperCase().startsWith(prefix)) : false;

  return (
    <div
      className={cn(
        "group relative grid cursor-pointer items-center gap-3 border-b border-border px-5 py-3 transition-colors duration-micro last:border-b-0 hover:bg-canvas/70",
        isTest && "bg-overdue/5",
      )}
      style={{ gridTemplateColumns: PAYMENT_GRID }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
    >
      <div className="whitespace-nowrap text-sm text-ink-muted">{formatRelativeTime(payment.receivedAt)}</div>

      <div className="min-w-0">
        {payment.invoice ? (
          <button
            type="button"
            className="block truncate text-sm font-medium text-ink hover:text-accent"
            aria-label={`Open invoice ${payment.invoice.number}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenInvoice();
            }}
          >
            {payment.invoice.number}
          </button>
        ) : (
          <span className="text-sm font-medium text-ink">Unknown invoice</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={payment.client?.name ?? "?"} className="h-8 w-8 text-[11px]" />
        <span className="truncate text-sm text-ink-muted">{payment.client?.name ?? "Unknown"}</span>
      </div>

      <div className="font-tabular text-right text-sm">
        <span className="text-success">+</span>
        <span className="font-medium text-ink">{formatCurrency(payment.amount)}</span>
      </div>

      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-border">
          {getMethodIcon(payment.method)}
          <span>{payment.methodLabel}</span>
        </span>
      </div>

      <div>
        {payment.paymentProof ? (
          <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
            <CheckCircle2 size={11} className="mr-1" />
            Proof attached
          </span>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-overdue-bg px-2.5 py-1 text-xs font-medium text-overdue transition hover:brightness-95"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Add proof for payment ${payment.id}`}
          >
            <FileText size={11} className="mr-0.5" /> Attach
          </button>
        )}
      </div>

      <div className="flex items-center justify-center opacity-0 transition-opacity duration-micro group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Actions for payment ${payment.id}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Waiting for Payment Panel
// ============================================================================
interface WaitingForPaymentPanelProps {
  invoices: Invoice[];
  payments: Payment[];
  clients: Client[];
  onRecordPayment: () => void;
}

function WaitingForPaymentPanel({ invoices, payments, clients, onRecordPayment }: WaitingForPaymentPanelProps) {
  const outstandingInvoices = useMemo(() => {
    return invoices
      .map((invoice) => {
        const totals = computeInvoiceTotals(invoice);
        const paid = payments.filter((p) => p.invoiceId === invoice.id).reduce((sum, p) => sum + p.amount, 0);
        const outstanding = Math.max(0, totals.total - paid);
        const ledgerInfo = getInvoiceLedgerStatus(invoice, payments);
        return {
          invoice,
          outstanding,
          ledgerInfo,
          client: clients?.find((c) => c.id === invoice.clientId),
        };
      })
      .filter((item) => item.outstanding > 0)
      .sort((a, b) => {
        // Overdue first, then by due date
        if (a.ledgerInfo?.status === "overdue" && b.ledgerInfo?.status !== "overdue") return -1;
        if (b.ledgerInfo?.status === "overdue" && a.ledgerInfo?.status !== "overdue") return 1;
        return new Date(a.invoice.dueDate).getTime() - new Date(b.invoice.dueDate).getTime();
      })
      .slice(0, 5);
  }, [invoices, payments, clients]);

  return (
    <Card className="p-5">
      <CardHeader title="Waiting for payment" description="Overdue first, then by due date" />
      {outstandingInvoices.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success">
            <CheckCircle2 size={18} aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">Nothing waiting</p>
          <p className="text-xs text-ink-muted">Every billed invoice is settled.</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {outstandingInvoices.map(({ invoice, outstanding, ledgerInfo, client }) => (
            <li key={invoice.id} className="flex items-center gap-3 py-3">
              <Avatar name={client?.name ?? "?"} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{client?.name ?? "Unknown client"}</div>
                <div className="truncate text-xs text-ink-muted">
                  {invoice.number} · Due {new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-tabular text-sm font-medium text-ink">{formatCurrency(outstanding)}</div>
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    ledgerInfo?.status === "overdue" && "bg-overdue-bg text-overdue",
                    ledgerInfo?.status === "outstanding" && "bg-caution-bg text-caution",
                  )}
                >
                  {ledgerInfo?.status === "overdue" ? (
                    <>
                      <AlertTriangleIcon size={10} /> Overdue
                    </>
                  ) : (
                    <>
                      <Clock size={10} /> Outstanding
                    </>
                  )}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordPayment();
                }}
              >
                Record
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
