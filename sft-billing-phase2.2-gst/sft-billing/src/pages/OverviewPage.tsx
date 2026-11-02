import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Plus,
  RotateCcw,
  Search,
  Users,
  Leaf,
  ArrowRight,
  Clock,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WorkspaceDropdown } from "@/components/notifications/WorkspaceDropdown";
import { StatCard } from "@/components/overview/StatCard";
import { RevenueChart } from "@/components/overview/RevenueChart";
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
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
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
import { getInvoiceWorkflowStatus } from "@/lib/invoiceMath";
import { cn } from "@/lib/cn";

interface OverviewTopBarProps {
  businessName: string;
  monogram: string;
  onSearch: () => void;
}

function OverviewTopBar({ businessName, monogram, onSearch }: OverviewTopBarProps) {
  const animationsEnabled = true;

  return (
    <div className="print:hidden flex flex-wrap items-center justify-between gap-4 border-b border-border bg-header px-5 py-4 sm:px-8 lg:px-12">
      <button
        type="button"
        onClick={onSearch}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-surface/60 px-3.5 py-2.5 text-left text-sm text-ink-muted transition-colors duration-micro hover:border-border-strong hover:bg-surface hover:text-ink sm:max-w-xl"
      >
        <Search size={15} strokeWidth={1.7} aria-hidden />
        <span className="min-w-0 flex-1 truncate">Search invoices, clients, or anything...</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-canvas px-1.5 py-0.5 font-sans text-[11px] text-ink-faint sm:inline-block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-4">
        <NotificationBell />
        <WorkspaceDropdown businessName={businessName} monogram={monogram} />
      </div>

      {/* Gold wave background layer */}
      <div
        className={cn("wave-layer pointer-events-none absolute right-0 top-0 hidden h-64 w-[42%] overflow-hidden lg:block", !animationsEnabled && "animate-none")}
        aria-hidden="true"
      >
        <svg viewBox="0 0 520 220" className="h-full w-full" fill="none" preserveAspectRatio="none">
          <path d="M-20 174C96 44 184 236 322 112 394 47 430 56 548 8" stroke="rgb(var(--color-premium) / 0.14)" strokeWidth="1.25" />
          <path d="M104 244C212 135 289 236 389 137 437 90 475 88 558 56" stroke="rgb(var(--color-premium) / 0.08)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

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
        className="flex items-center gap-3 rounded-md border border-border bg-surface/75 px-4 py-3 text-left shadow-card"
      >
        <CalendarDays size={17} strokeWidth={1.6} className="text-premium" aria-hidden />
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Reporting period</span>
          <span className="mt-0.5 block text-sm font-medium text-ink">{periodLabel}</span>
        </span>
        <ChevronDown size={15} strokeWidth={1.6} className={`ml-2 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Select reporting period"
          className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,620px)] rounded-md border border-border bg-surface-raised p-3 shadow-float"
        >
          <ReportFilters filters={filters} onChange={(next) => { handleChange(next); if (next.preset !== "custom") setOpen(false); }} clients={[]} asOf={now} />
        </div>
      )}
    </div>
  );
}

function OverviewIntro({ periodFilters, now, onPeriodChange }: { periodFilters: ReportFilterState; now: Date; onPeriodChange: (next: ReportFilterState) => void }) {
  return (
    <section className="relative flex flex-col justify-between gap-7 border-b border-border pb-9 lg:flex-row lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-premium">GOOD MORNING</p>
        <h1 className="mt-3 max-w-3xl font-display text-hero text-ink sm:text-hero-lg">Here&apos;s your business at a glance.</h1>
        <p className="mt-4 max-w-xl text-base text-ink-muted">
          Track revenue, manage invoices, and keep your business moving forward.
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
  const { data: businessProfile } = useBusinessProfile();
  const {
    overviewFocus,
    focusOverviewStatus,
    navigateTo,
    openCommandPalette,
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
  const businessName = businessProfile?.name ?? "SFT Billing";
  const monogram = businessName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

  // Use direct values without count-up animation for static look
  const billedValue = periodBilled;
  const receivedValue = periodReceived;
  const outstandingValue = allTotals?.pending.amount ?? 0;
  const overdueValue = allTotals?.overdue.amount ?? 0;

  if (invoicesError) {
    return (
      <div className="min-h-full bg-canvas">
        <OverviewTopBar
          businessName={businessName}
          monogram={monogram}
          onSearch={openCommandPalette}
        />
        <main className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12">
          <OverviewIntro periodFilters={periodFilters} now={now} onPeriodChange={setPeriodFilters} />
          <div className="pt-8">
            <EmptyState icon={AlertTriangle} title="Couldn't load the overview" description={invoicesError.message} />
          </div>
        </main>
      </div>
    );
  }

  const pendingSubLine = allTotals?.pending.count
    ? `${allTotals.pending.count} ${allTotals.pending.count === 1 ? "invoice" : "invoices"}`
    : "No invoices";
  const paidSubLine = allTotals?.paid.count
    ? `${allTotals.paid.count} ${allTotals.paid.count === 1 ? "invoice" : "invoices"}`
    : "No invoices";
  const overdueSubLine = allTotals?.overdue.count
    ? `${allTotals.overdue.count} ${allTotals.overdue.count === 1 ? "invoice" : "invoices"} · ${oldestOverdueDays}d oldest`
    : "No invoices";
  const draftSubLine = allTotals?.draft.count
    ? `${allTotals.draft.count} ${allTotals.draft.count === 1 ? "draft" : "drafts"}`
    : "No drafts";

  return (
    <div className="min-h-full bg-canvas pb-[96px]">
      <OverviewTopBar
        businessName={businessName}
        monogram={monogram}
        onSearch={openCommandPalette}
      />

      <main className="relative isolate overflow-hidden">
        <div className="relative mx-auto max-w-[1480px] px-5 pb-12 pt-8 sm:px-8 lg:px-12">
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
                      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-micro hover:bg-accent/90"
                    >
                      <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-9 pt-9">
                {/* Financial Summary Section - responsive grid */}
                <section
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 items-stretch"
                  aria-label="Financial summary"
                  style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
                >
                  {/* Hero Card - Billed */}
                  <StatCard
                    isHero
                    label="TOTAL REVENUE"
                    value={billedValue}
                    changePct={changePct}
                    comparable={comparable}
                    periodLabel={periodLabel}
                    onClick={() => navigateTo("reports")}
                  />

                  {/* Status Strip Cards */}
                  <StatCard
                    label="OUTSTANDING"
                    value={outstandingValue}
                    subLine={pendingSubLine}
                    isSelected={overviewFocus === "pending"}
                    onClick={() => focusOverviewStatus("pending")}
                  />
                  <StatCard
                    label="RECEIVED"
                    value={receivedValue}
                    subLine={paidSubLine}
                    isSelected={overviewFocus === "paid"}
                    onClick={() => focusOverviewStatus("paid")}
                  />
                  <StatCard
                    label="OVERDUE"
                    value={overdueValue}
                    subLine={overdueSubLine}
                    isSelected={overviewFocus === "overdue"}
                    onClick={() => focusOverviewStatus("overdue")}
                  />
                  <StatCard
                    label="DRAFT"
                    value={allTotals?.draft.amount ?? 0}
                    subLine={draftSubLine}
                    isSelected={overviewFocus === "draft"}
                    onClick={() => focusOverviewStatus("draft")}
                  />
                </section>

                {/* Focused Invoice List - shown when a status card is clicked */}
                {overviewFocus && (
                  <FocusedInvoiceList
                    status={overviewFocus}
                    invoices={periodInvoices}
                    clients={clients}
                  />
                )}

                {/* Revenue Trend + Recent Activity (two columns) */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <RevenueChart series={revenueSeries} />
                  <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card" aria-labelledby="recent-activity-title">
                    <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                      <div className="flex items-center gap-2">
                        <Clock size={18} strokeWidth={1.8} className="text-premium" aria-hidden />
                        <h2 id="recent-activity-title" className="font-display text-xl text-ink">Recent activity</h2>
                      </div>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="live-dot relative flex h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                        <span className="text-xs text-ink-muted">Live</span>
                      </span>
                    </div>
                    <div className="pt-2">
                      <EnhancedActivityFeed events={periodActivity} invoices={invoices ?? []} />
                    </div>
                    <div className="mt-4 pt-2">
                      <button
                        type="button"
                        onClick={() => navigateTo("reports")}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-premium transition-colors duration-micro hover:text-premium/80"
                      >
                        View all <ArrowRight size={14} strokeWidth={1.8} aria-hidden />
                      </button>
                    </div>
                  </section>
                </div>

                {/* Bottom Banner */}
                <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-premium/10 flex items-center justify-center">
                        <Leaf size={24} strokeWidth={1.8} className="text-premium" aria-hidden />
                      </div>
                      <div>
                        <p className="font-display text-lg text-ink">Building stronger businesses together.</p>
                        <p className="mt-1 text-sm text-ink-muted">Surfine Technology — Forging a stronger tomorrow.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigateTo("create-invoice")}
                        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-micro hover:bg-accent/90"
                      >
                        <Plus size={14} strokeWidth={1.8} aria-hidden />
                        <span>Create Invoice</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo("clients")}
                        className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors duration-micro hover:border-accent hover:text-accent"
                      >
                        <Users size={14} strokeWidth={1.8} aria-hidden />
                        <span>Manage Clients</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}