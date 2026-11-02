import { useMemo, useState } from "react";
import {
  Plus,
  Inbox,
  AlertTriangle,
  ChevronDown,
  ArrowUpDown,
  Search,
  X,
  CreditCard,
  Banknote,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle as AlertTriangleIcon,
} from "lucide-react";
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

function getMethodChipClass(method: string): string {
  switch (method) {
    case "bank_transfer":
      return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-success-bg dark:text-success dark:border-success/30";
    case "card":
      return "bg-purple-50 text-purple-700 border-purple-100 dark:bg-surface-raised dark:text-ink-muted dark:border-border";
    case "upi":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-success-bg dark:text-success dark:border-success/30";
    case "cheque":
      return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-caution-bg dark:text-caution dark:border-caution/30";
    case "cash":
      return "bg-slate-50 text-slate-700 border-slate-100 dark:bg-neutral-bg dark:text-neutral dark:border-border";
    default:
      return "bg-gray-50 text-gray-700 border-gray-100 dark:bg-surface-raised dark:text-ink-muted dark:border-border";
  }
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

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load payments" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Payments"
        subtitle="Every payment received, in one place"
        action={
          <button
            type="button"
            onClick={openNewPayment}
            disabled={!invoices || billedInvoices.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} /> Record payment
          </button>
        }
      />

      {/* Summary Strip */}
      <div className="mb-6 px-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Payment summary">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="text-3xl font-bold text-ink tracking-tight font-tabular">{formatCurrency(summary.receivedThisMonth)}</div>
              <div className="mt-1 text-sm text-ink-muted">Received this month</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-50/50 to-transparent" aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-amber-50 text-amber-700">
              <Banknote size={18} />
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-700 font-tabular">{formatCurrency(summary.stillToCollect)}</div>
              <div className="mt-1 text-sm text-ink-muted">Still to collect</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-700">
              <CreditCard size={18} />
            </div>
            <div>
              <div className="text-3xl font-bold text-ink tracking-tight font-tabular">{summary.paymentsRecorded}</div>
              <div className="mt-1 text-sm text-ink-muted">
                Payments recorded
                {summary.latestPaymentDate && (
                  <span className="ml-2 text-xs text-ink-faint">
                    Latest: {formatRelativeTime(summary.latestPaymentDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro cursor-pointer",
            summary.missingProof === 0 && "bg-success-bg/30 border-success/30"
          )}
          onClick={() => setQuery("proof")}
        >
          <div className="flex items-center gap-3">
            <div className={cn("flex-shrink-0 p-2 rounded-lg", summary.missingProof === 0 ? "bg-success-bg/50 text-success" : "bg-overdue-bg/50 text-overdue")}>
              <FileText size={18} />
            </div>
            <div>
              <div className={cn("text-3xl font-bold font-tabular", summary.missingProof === 0 ? "text-success" : "text-overdue")}>
                {summary.missingProof}
              </div>
              <div className="mt-1 text-sm text-ink-muted">Missing proof</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-10 pb-10">
        {/* Search & Filters Bar */}
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by ID, invoice, client, reference…"
              className="h-11 w-full pl-10 pr-4 rounded-md border border-border bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong transition-colors duration-micro"
              aria-label="Search payments"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Method Filter */}
            <div className="relative">
              <select
                value={methodFilter ?? ""}
                onChange={(e) => setMethodFilter(e.target.value || null)}
                className="h-9 rounded-md border border-border bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-border-strong appearance-none cursor-pointer"
                aria-label="Filter by method"
              >
                <option value="">All methods</option>
                {(["bank_transfer", "card", "upi", "cheque", "cash"] as const).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" size={14} aria-hidden />
            </div>

            {/* Month Filter */}
            <div className="relative">
              <select
                value={monthFilter ?? ""}
                onChange={(e) => setMonthFilter(e.target.value || null)}
                className="h-9 rounded-md border border-border bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-border-strong appearance-none cursor-pointer"
                aria-label="Filter by month"
              >
                <option value="">All months</option>
                {Object.keys(groupedPayments).sort().reverse().map((month) => (
                  <option key={month} value={month}>
                    {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    ({monthlySubtotals[month]?.count ?? 0})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" size={14} aria-hidden />
            </div>

            {/* Sort Control */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date" | "amount" | "method")}
                className="h-9 rounded-md border border-border bg-surface px-3 pr-8 text-sm text-ink outline-none focus:border-border-strong appearance-none cursor-pointer"
                aria-label="Sort payments"
              >
                <option value="date">Sort: Date (newest)</option>
                <option value="amount">Sort: Amount (high to low)</option>
                <option value="method">Sort: Method</option>
              </select>
              <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" size={14} aria-hidden />
            </div>

            {/* Show Test Items Toggle */}
            {testItemsCount > 0 && (
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm text-ink-muted cursor-pointer hover:bg-canvas transition-colors duration-micro">
                <input
                  type="checkbox"
                  checked={showTestItems}
                  onChange={(e) => setShowTestItems(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent focus:ring-2"
                />
                <span>Show test items ({testItemsCount})</span>
              </label>
            )}
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-3 flex items-center justify-between text-sm text-ink-muted">
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

        {/* Payments Table */}
        {loading ? (
          <div className="space-y-3" aria-label="Loading payments">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : visibleCount === 0 ? (
          <EmptyState
            icon={Inbox}
            title={totalCount === 0 ? "No payments yet" : "No payments match your filters"}
            description={
              totalCount === 0
                ? "Record a payment against an invoice to see it here."
                : "Try adjusting your search or filters."
            }
            action={
              totalCount === 0 ? (
                <button
                  type="button"
                  onClick={openNewPayment}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity duration-micro hover:opacity-90"
                >
                  <Plus size={15} aria-hidden /> Record payment
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-card">
            {/* Table Header */}
            <div
              className="grid grid-cols-[100px_1fr_120px_100px_100px_100px_auto] gap-4 border-b border-border bg-canvas/50 px-5 py-3 text-xs font-medium text-ink-faint uppercase tracking-wider"
              role="row"
              aria-label="Payment columns"
            >
              <span>Date</span>
              <span>Invoice</span>
              <span>Client</span>
              <span className="text-right">Amount</span>
              <span>Method</span>
              <span>Proof</span>
              <span className="w-10 text-center"></span>
            </div>

            {/* Monthly Groups */}
            <div className="max-h-[calc(100vh-520px)] overflow-y-auto">
              {Object.entries(groupedPayments).map(([monthKey, monthPayments]) => {
                const subtotal = monthlySubtotals[monthKey];
                const monthLabel = new Date(monthKey + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                return (
                  <div key={monthKey} className="border-b border-border/50">
                    {/* Sticky Month Header */}
                    <div className="sticky top-0 z-10 grid grid-cols-[100px_1fr_120px_100px_100px_100px_auto] gap-4 bg-surface/95 backdrop-blur-sm border-b border-border px-5 py-2.5 text-xs font-medium text-ink-faint uppercase tracking-wider">
                      <span>{monthLabel}</span>
                      <span></span>
                      <span></span>
                      <span className="text-right font-tabular font-semibold text-ink">
                        {formatCurrency(subtotal.total)}
                      </span>
                      <span className="text-ink-muted">{subtotal.count} payment{subtotal.count !== 1 ? "s" : ""}</span>
                      <span></span>
                      <span></span>
                    </div>

                    {/* Rows */}
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
          </div>
        )}

        {/* Waiting for Payment Panel */}
        <WaitingForPaymentPanel
          invoices={billedInvoices}
          payments={enrichedPayments}
          clients={clients}
          onRecordPayment={openNewPayment}
        />

        {/* Empty space for breathing room / AURA padding */}
        <div className="h-20" />
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

function PaymentRow({ payment, index, onClick, onOpenInvoice, onKeyDown }: PaymentRowProps) {
  const client = payment.client;
  const isTest = client
    ? TEST_PAYMENT_PREFIXES.some((prefix) => client.name.toUpperCase().startsWith(prefix))
    : false;
  const isEven = index % 2 === 0;

  return (
    <div
      className={cn(
        "grid grid-cols-[100px_1fr_120px_100px_100px_100px_auto] gap-4 items-center px-5 py-3 transition-colors duration-micro",
        "border-b border-border/50 last:border-b-0",
        "hover:bg-canvas hover:shadow-card relative cursor-pointer",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-transparent group-hover:before:bg-accent before:transition-colors before:duration-micro",
        isTest && "bg-overdue/5",
        isEven ? "bg-transparent" : "bg-canvas/30"
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
    >
      {/* Date */}
      <div className="text-ink-muted whitespace-nowrap text-sm">
        {formatRelativeTime(payment.receivedAt)}
      </div>

      {/* Invoice */}
      <div className="min-w-0 flex-1">
        {payment.invoice ? (
          <button
            type="button"
            className="font-medium text-ink hover:text-accent truncate block"
            aria-label={`Open invoice ${payment.invoice.number}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenInvoice();
            }}
          >
            {payment.invoice.number}
          </button>
        ) : (
          <span className="font-medium text-ink">Unknown invoice</span>
        )}
      </div>

      {/* Client with avatar */}
      <div className="w-28 shrink-0 flex items-center gap-2 min-w-0">
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-premium/10 text-premium font-medium text-xs flex items-center justify-center"
          aria-hidden="true"
        >
          {payment.client ? getInitials(payment.client.name) : "?"}
        </div>
        <span className="truncate text-sm text-ink-muted">{payment.client?.name ?? "Unknown"}</span>
      </div>

      {/* Amount */}
      <div className="text-right w-24 shrink-0 font-tabular text-sm">
        <span className="text-success">+</span>
        <span className="font-tabular font-medium text-ink">{formatCurrency(payment.amount)}</span>
      </div>

      {/* Method Chip */}
      <div className="w-24 shrink-0">
        <span className={cn(
          "inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
          getMethodChipClass(payment.method)
        )}>
          {getMethodIcon(payment.method)}
          <span>{payment.methodLabel}</span>
        </span>
      </div>

      {/* Proof */}
      <div className="w-28 shrink-0">
        {payment.paymentProof ? (
          <span className={cn(
            "inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium",
            "bg-success-bg text-success"
          )}>
            <CheckCircle2 size={10} className="mr-1" />
            Proof attached
          </span>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium",
              "bg-overdue-bg text-overdue hover:bg-overdue/80 transition-colors"
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Add proof for payment ${payment.id}`}
          >
            <FileText size={10} className="mr-1" /> Attach
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="w-10 shrink-0 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-micro flex items-center justify-center">
          <button
            type="button"
            className="p-1.5 rounded-lg bg-surface border border-border text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Actions for payment ${payment.id}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
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

  if (outstandingInvoices.length === 0) return null;

  return (
    <div className="mt-8 rounded-lg border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-4 font-medium text-ink flex items-center gap-2">
        <Clock size={16} className="text-premium" />
        Waiting for Payment
      </h3>
      <div className="space-y-3">
        {outstandingInvoices.map(({ invoice, outstanding, ledgerInfo, client }) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between gap-4 p-3 rounded-lg bg-canvas/50 hover:bg-canvas transition-colors duration-micro cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-premium/10 text-premium font-medium text-xs flex items-center justify-center"
                aria-hidden="true"
              >
                {client ? getInitials(client.name) : "?"}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-ink text-sm">{client?.name ?? "Unknown client"}</div>
                <div className="truncate text-xs text-ink-muted">{invoice.number} · Due {new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-tabular text-sm text-ink font-medium">{formatCurrency(outstanding)}</span>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium",
                ledgerInfo?.status === "overdue" && "bg-overdue-bg text-overdue",
                ledgerInfo?.status === "outstanding" && "bg-caution-bg text-caution"
              )}>
                {ledgerInfo?.status === "overdue" ? (
                  <>
                    <AlertTriangleIcon size={10} className="mr-1" />
                    Overdue
                  </>
                ) : (
                  <>
                    <Clock size={10} className="mr-1" />
                    Outstanding
                  </>
                )}
              </span>
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onRecordPayment(); }}>
                Record
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}