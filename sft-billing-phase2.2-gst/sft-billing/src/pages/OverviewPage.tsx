import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { RevenueChart } from "@/components/overview/RevenueChart";
import { BlurFade, NumberTicker } from "@/components/ui/kit";
import { AttentionList, Card, CardHeader, CollectionRing, KpiCard, TopClients, TrendPill, type AttentionItem, type ClientBar } from "@/components/overview/Bento";
import { formatCurrency } from "@/lib/formatters";
import { EnhancedActivityFeed } from "@/components/overview/EnhancedActivityFeed";
import { FocusedInvoiceList } from "@/components/overview/FocusedInvoiceList";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useActivity } from "@/hooks/useActivity";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import {
  computeLedgerStatusTotals,
  computeMonthlyPaymentRevenueSeries,
  revenueForCurrentMonth,
  computeTotalReceived,
  computeTotalBilled,
} from "@/lib/overviewMetrics";
import {
  DATE_PRESET_LABELS,
  defaultFilters,
  filterInvoices,
  filterPayments,
  isDateWithinRange,
  type ReportFilterState,
} from "@/lib/reports";
import { computeInvoiceTotals, getInvoiceWorkflowStatus } from "@/lib/invoiceMath";

function periodDateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getOverviewPeriodLabel(filters: ReportFilterState, now: Date): string {
  if (filters.preset === "this-month") {
    return now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  if (filters.preset !== "custom") return DATE_PRESET_LABELS[filters.preset];
  const range = [filters.from, filters.to].filter(Boolean).map((value) => periodDateLabel(value!));
  return range.length > 0 ? range.join(" – ") : DATE_PRESET_LABELS.custom;
}

interface OverviewPeriodControlProps {
  filters: ReportFilterState;
  now: Date;
  onChange: (next: ReportFilterState) => void;
}

function OverviewPeriodControl({ filters, now, onChange }: OverviewPeriodControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const periodLabel = getOverviewPeriodLabel(filters, now);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleChange(next: ReportFilterState) {
    onChange(next);
    if (next.preset !== "custom") setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Open reporting period controls for ${periodLabel}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-left shadow-card transition-colors hover:border-border-strong"
      >
        <CalendarDays size={17} strokeWidth={1.6} className="text-accent" aria-hidden />
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Reporting period</span>
          <span className="mt-0.5 block text-sm font-medium text-ink">{periodLabel}</span>
        </span>
        <ChevronDown size={15} strokeWidth={1.6} className={`ml-2 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Select reporting period"
          className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,620px)] rounded-lg border border-border-strong bg-surface-raised p-3 shadow-float"
        >
          <ReportFilters filters={filters} onChange={(next) => { handleChange(next); if (next.preset !== "custom") setOpen(false); }} clients={[]} asOf={now} />
        </div>
      )}
    </div>
  );
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function OverviewIntro({ periodFilters, now, onPeriodChange }: { periodFilters: ReportFilterState; now: Date; onPeriodChange: (next: ReportFilterState) => void }) {
  const username = useAuthStore((state) => state.user?.username);
  const today = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <section className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-faint">{today}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {greetingFor(now)}{username ? `, ${username}` : ""}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
          Here&apos;s how your business is doing — revenue, receivables and what needs attention.
        </p>
      </div>
      <OverviewPeriodControl filters={periodFilters} now={now} onChange={onPeriodChange} />
    </section>
  );
}

export function OverviewPage() {
  const { data: invoices, loading: invoicesLoading, error: invoicesError } = useInvoices();
  const { data: clients } = useClients();
  const { data: activity } = useActivity();
  const { data: payments, loading: paymentsLoading } = usePayments();
  const {
    overviewFocus,
    focusOverviewStatus,
    navigateTo,
    navigateToInvoiceDetail,
    navigateToClientDetail,
  } = useWorkspaceStore();

  const now = useMemo(() => new Date(), []);
  const [periodFilters, setPeriodFilters] = useState<ReportFilterState>(() => ({
    ...defaultFilters(now),
    preset: "last-12-months",
    from: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  }));
  const [isSlowLoad] = useState(false);
  const periodLabel = useMemo(() => getOverviewPeriodLabel(periodFilters, now), [periodFilters, now]);

  const periodInvoices = useMemo(
    () => (invoices ? filterInvoices(invoices, periodFilters, now) : []),
    [invoices, periodFilters, now],
  );
  const periodPayments = useMemo(
    () => (payments ? filterPayments(payments, periodFilters) : []),
    [payments, periodFilters],
  );
  const periodActivity = useMemo(
    () => (activity ? activity.filter((event) => isDateWithinRange(event.occurredAt, periodFilters.from, periodFilters.to)) : []),
    [activity, periodFilters],
  );

  const periodTotals = useMemo(
    () => (invoices && payments ? computeLedgerStatusTotals(periodInvoices, payments, now) : undefined),
    [invoices, payments, periodInvoices, now],
  );

  const allInvoices = useMemo(() => invoices ?? [], [invoices]);
  const allTotals = useMemo(
    () => (invoices && payments ? computeLedgerStatusTotals(allInvoices, payments, now) : undefined),
    [allInvoices, invoices, payments, now],
  );

  const revenueSeries = useMemo(
    () => (invoices && payments ? computeMonthlyPaymentRevenueSeries(invoices, periodPayments, 12, now) : []),
    [invoices, payments, periodPayments, now],
  );

  const periodBilled = useMemo(
    () => (invoices && payments ? computeTotalBilled(periodInvoices) : 0),
    [invoices, payments, periodInvoices],
  );

  const periodReceived = useMemo(
    () => (invoices && payments ? computeTotalReceived(periodInvoices, periodPayments) : 0),
    [invoices, payments, periodInvoices, periodPayments],
  );

  const { changePct } = useMemo(() => revenueForCurrentMonth(revenueSeries), [revenueSeries]);

  const comparable = useMemo(() => {
    if (revenueSeries.length < 2) return false;
    const previous = revenueSeries[revenueSeries.length - 2]?.revenue ?? 0;
    return previous > 0;
  }, [revenueSeries]);

  const oldestOverdueDays = useMemo(() => {
    if (!payments) return 0;
    let maxDays = 0;
    for (const invoice of allInvoices) {
      const info = getInvoiceWorkflowStatus(invoice, payments, now);
      if (info.status === "overdue" && info.daysOverdue > maxDays) {
        maxDays = info.daysOverdue;
      }
    }
    return maxDays;
  }, [allInvoices, payments, now]);

  // Overdue invoices, oldest first, with what is still owed.
  const attentionItems = useMemo<AttentionItem[]>(() => {
    if (!payments) return [];
    const paidByInvoice = new Map<string, number>();
    for (const payment of payments) paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) ?? 0) + payment.amount);
    return allInvoices
      .map((invoice) => ({ invoice, info: getInvoiceWorkflowStatus(invoice, payments, now) }))
      .filter(({ info }) => info.status === "overdue")
      .sort((a, b) => b.info.daysOverdue - a.info.daysOverdue)
      .map(({ invoice, info }) => ({
        id: invoice.id,
        number: invoice.number,
        client: clients?.find((client) => client.id === invoice.clientId)?.name ?? "Unknown client",
        balance: Math.max(0, computeInvoiceTotals(invoice).total - (paidByInvoice.get(invoice.id) ?? 0)),
        daysOverdue: info.daysOverdue,
      }))
      .filter((item) => item.balance > 0.005)
      .slice(0, 5);
  }, [allInvoices, payments, clients, now]);

  // Clients ranked by amount billed in the selected period.
  const topClients = useMemo<ClientBar[]>(() => {
    const totals = new Map<string, number>();
    for (const invoice of periodInvoices) {
      if (invoice.isDraft) continue;
      totals.set(invoice.clientId, (totals.get(invoice.clientId) ?? 0) + computeInvoiceTotals(invoice).total);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, total]) => ({ id, total, name: clients?.find((client) => client.id === id)?.name ?? "Unknown client" }));
  }, [periodInvoices, clients]);

  // Use direct values without count-up animation for static look
  const billedValue = periodBilled;
  const receivedValue = periodReceived;
  const outstandingValue = (allTotals?.pending.amount ?? 0) + (allTotals?.overdue.amount ?? 0);
  const outstandingCount = (allTotals?.pending.count ?? 0) + (allTotals?.overdue.count ?? 0);
  const overdueValue = allTotals?.overdue.amount ?? 0;

  if (invoicesError) {
    return (
      <div className="min-h-full bg-canvas">
        <main className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12">
          <OverviewIntro periodFilters={periodFilters} now={now} onPeriodChange={setPeriodFilters} />
          <div className="pt-8">
            <EmptyState icon={AlertTriangle} title="Couldn't load the overview" description={invoicesError.message} />
          </div>
        </main>
      </div>
    );
  }

  const pendingSubLine = outstandingCount
    ? `${outstandingCount} ${outstandingCount === 1 ? "invoice" : "invoices"} unpaid${overdueValue > 0 ? ` · ${formatCurrency(overdueValue)} overdue` : ""}`
    : "No unpaid invoices";
  const paidSubLine = `Payments in ${periodLabel}`;
  const overdueSubLine = allTotals?.overdue.count
    ? `${allTotals.overdue.count} ${allTotals.overdue.count === 1 ? "invoice" : "invoices"} · ${oldestOverdueDays}d oldest`
    : "No invoices";
  const draftSubLine = allTotals?.draft.count
    ? `${allTotals.draft.count} ${allTotals.draft.count === 1 ? "draft" : "drafts"}`
    : "No drafts";

  return (
    <div className="min-h-full bg-canvas pb-16">

      <main className="relative isolate overflow-hidden">
        <div className="relative mx-auto max-w-[1480px] px-6 pb-12 pt-8 lg:px-8">
          <OverviewIntro periodFilters={periodFilters} now={now} onPeriodChange={setPeriodFilters} />

          <ErrorBoundary
            fallback={
              <div className="pt-9">
                <EmptyState
                  icon={AlertTriangle}
                  title="Failed to load overview"
                  description="An unexpected error occurred. Please reload the page."
                />
              </div>
            }
          >
            {invoicesLoading || paymentsLoading || !periodTotals ? (
              <div className="pt-9">
                <OverviewSkeleton />
                {isSlowLoad && (
                  <div className="mt-6 flex flex-col items-center gap-3 text-center">
                    <AlertTriangle className="h-10 w-10 text-caution" aria-hidden="true" />
                    <p className="text-sm text-ink-muted">Taking longer than expected…</p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-micro hover:bg-accent/90"
                    >
                      <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 pt-6">
                {/* Row 1: revenue hero + collection ring */}
                <BlurFade>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Card className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Total billed · {periodLabel}</p>
                          <p className="font-tabular mt-2 text-[2.4rem] font-semibold leading-none tracking-tight text-ink">
                            <NumberTicker value={billedValue} format={(n) => formatCurrency(n)} duration={1.2} />
                          </p>
                          <p className="mt-3 text-sm text-ink-muted">
                            <span className="font-medium text-success">{formatCurrency(periodReceived)}</span> received
                            <span className="mx-2 text-border-strong">|</span>
                            <span className="font-medium text-ink">{formatCurrency(Math.max(0, periodBilled - periodReceived))}</span> still to collect
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateTo("reports")}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-strong px-3 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                        >
                          Open reports <ChevronRight size={13} aria-hidden />
                        </button>
                      </div>
                      <div className="mt-6 border-t border-border pt-5">
                        {comparable && changePct !== 0 ? (
                          <p className="mb-3 flex items-center gap-2 text-xs text-ink-muted">
                            <TrendPill pct={changePct} /> collected this month vs last month
                          </p>
                        ) : null}
                        <RevenueChart series={revenueSeries} />
                      </div>
                    </Card>

                    <Card className="flex flex-col p-6">
                      <CardHeader title="Collection" description={`Of ${formatCurrency(periodBilled)} billed`} />
                      <div className="flex flex-1 items-center justify-center py-5">
                        <CollectionRing pct={periodBilled > 0 ? (periodReceived / periodBilled) * 100 : 0} />
                      </div>
                      <dl className="divide-y divide-border text-sm">
                        <div className="flex items-center justify-between py-2.5">
                          <dt className="flex items-center gap-2 text-ink-muted"><span className="h-2 w-2 rounded-full bg-accent" />Billed</dt>
                          <dd className="font-tabular font-medium text-ink">{formatCurrency(periodBilled)}</dd>
                        </div>
                        <div className="flex items-center justify-between py-2.5">
                          <dt className="flex items-center gap-2 text-ink-muted"><span className="h-2 w-2 rounded-full bg-success" />Received</dt>
                          <dd className="font-tabular font-medium text-ink">{formatCurrency(periodReceived)}</dd>
                        </div>
                        <div className="flex items-center justify-between py-2.5">
                          <dt className="flex items-center gap-2 text-ink-muted"><span className="h-2 w-2 rounded-full bg-pending" />Still to collect</dt>
                          <dd className="font-tabular font-medium text-ink">{formatCurrency(Math.max(0, periodBilled - periodReceived))}</dd>
                        </div>
                      </dl>
                    </Card>
                  </div>
                </BlurFade>

                {/* Row 2: status KPIs */}
                <BlurFade delay={0.08}>
                  <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
                    <KpiCard label="Outstanding (all unpaid)" tone="pending" value={outstandingValue} sub={pendingSubLine} active={overviewFocus === "pending"} onClick={() => focusOverviewStatus("pending")} />
                    <KpiCard label="Received" tone="success" value={receivedValue} sub={paidSubLine} active={overviewFocus === "paid"} onClick={() => focusOverviewStatus("paid")} delay={0.06} />
                    <KpiCard label="Overdue" tone="overdue" value={overdueValue} sub={overdueSubLine} active={overviewFocus === "overdue"} onClick={() => focusOverviewStatus("overdue")} delay={0.12} />
                    <KpiCard label="Drafts" tone="neutral" value={allTotals?.draft.amount ?? 0} sub={draftSubLine} active={overviewFocus === "draft"} onClick={() => focusOverviewStatus("draft")} delay={0.18} />
                  </div>
                </BlurFade>

                {overviewFocus && (
                  <FocusedInvoiceList status={overviewFocus} invoices={periodInvoices} clients={clients} />
                )}

                {/* Row 3: act on it */}
                <BlurFade delay={0.16}>
                  <div className="grid gap-5 lg:grid-cols-3">
                    <AttentionList items={attentionItems} onOpen={navigateToInvoiceDetail} onViewAll={() => focusOverviewStatus("overdue")} />
                    <TopClients clients={topClients} onOpen={navigateToClientDetail} />
                    <Card className="p-5">
                      <CardHeader
                        title="Recent activity"
                        description="Latest invoices, payments and clients"
                        action={
                          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                            Live
                          </span>
                        }
                      />
                      <div className="mt-3">
                        <EnhancedActivityFeed events={periodActivity} invoices={invoices ?? []} />
                      </div>
                    </Card>
                  </div>
                </BlurFade>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}