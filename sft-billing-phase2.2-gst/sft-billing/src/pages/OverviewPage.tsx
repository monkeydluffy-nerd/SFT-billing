import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { MetricHero } from "@/components/overview/MetricHero";
import { StatStrip } from "@/components/overview/StatStrip";
import { RevenueChart } from "@/components/overview/RevenueChart";
import { ActivityFeed } from "@/components/overview/ActivityFeed";
import { FocusedInvoiceList } from "@/components/overview/FocusedInvoiceList";
import { SurfineMark } from "@/components/shared/SurfineMark";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { InlineBanner } from "@/components/shared/InlineBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReportFilters } from "@/components/reports/ReportFilters";
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

interface OverviewTopBarProps {
  businessName: string;
  monogram: string;
  onSearch: () => void;
}

function OverviewTopBar({ businessName, monogram, onSearch }: OverviewTopBarProps) {
  return (
    <div className="print:hidden flex flex-wrap items-center justify-between gap-4 border-b border-border bg-canvas/95 px-5 py-4 sm:px-8 lg:px-12">
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
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-muted" role="img" aria-label="Notifications">
          <Bell size={16} strokeWidth={1.6} aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-premium" aria-hidden />
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-ink-faint">Workspace</p>
          <p className="mt-0.5 max-w-[180px] truncate text-sm font-medium text-ink">{businessName}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold tracking-[0.08em] text-sidebar-ink">
          {monogram}
        </div>
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
    return now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }).toUpperCase();
  }

  if (filters.preset !== "custom") return DATE_PRESET_LABELS[filters.preset].toUpperCase();

  const range = [filters.from, filters.to].filter(Boolean).map((value) => periodDateLabel(value!));
  return range.length > 0 ? range.join(" – ").toUpperCase() : DATE_PRESET_LABELS.custom.toUpperCase();
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
          <ReportFilters filters={filters} onChange={handleChange} clients={[]} dateOnly asOf={now} />
        </div>
      )}
    </div>
  );
}

function OverviewIntro({ periodFilters, now, onPeriodChange }: { periodFilters: ReportFilterState; now: Date; onPeriodChange: (next: ReportFilterState) => void }) {
  return (
    <section className="relative flex flex-col justify-between gap-7 border-b border-border pb-9 lg:flex-row lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-premium">Good morning</p>
        <h1 className="mt-3 max-w-3xl font-display text-hero text-ink sm:text-hero-lg">Here’s your business at a glance.</h1>
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
    goToInvoices,
    navigateTo,
    openCommandPalette,
    openCreateInvoice,
    goToClients,
  } = useWorkspaceStore();

  const now = useMemo(() => new Date(), []);
  const [periodFilters, setPeriodFilters] = useState<ReportFilterState>(() => defaultFilters(now));
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
  const totals = useMemo(
    () => (invoices && payments ? computeLedgerStatusTotals(periodInvoices, payments, now) : undefined),
    [invoices, payments, periodInvoices, now],
  );
  const revenueSeries = useMemo(
    () => (invoices && payments ? computeMonthlyPaymentRevenueSeries(invoices, periodPayments, 12, now) : []),
    [invoices, payments, periodPayments, now],
  );
  const selectedRevenue = useMemo(() => {
    const billedInvoiceIds = new Set((invoices ?? []).filter((invoice) => !invoice.isDraft).map((invoice) => invoice.id));
    return periodPayments.reduce((sum, payment) => (billedInvoiceIds.has(payment.invoiceId) ? sum + payment.amount : sum), 0);
  }, [invoices, periodPayments]);
  const { changePct } = useMemo(() => revenueForCurrentMonth(revenueSeries), [revenueSeries]);

  const seriouslyOverdue = useMemo(() => {
    if (!payments) return 0;
    return periodInvoices.filter((invoice) => {
      const info = getInvoiceWorkflowStatus(invoice, payments, now);
      return info.status === "overdue" && info.daysOverdue >= 15;
    }).length;
  }, [periodInvoices, payments, now]);

  if (invoicesError) {
    return (
      <div className="min-h-full bg-canvas">
        <OverviewTopBar businessName={businessName} monogram={monogram} onSearch={openCommandPalette} />
        <main className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12">
          <OverviewIntro periodFilters={periodFilters} now={now} onPeriodChange={setPeriodFilters} />
          <div className="pt-8">
            <EmptyState icon={AlertTriangle} title="Couldn't load the overview" description={invoicesError.message} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas">
      <OverviewTopBar businessName={businessName} monogram={monogram} onSearch={openCommandPalette} />

      <main className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute right-0 top-0 hidden h-64 w-[42%] overflow-hidden lg:block">
          <svg viewBox="0 0 520 220" className="h-full w-full" fill="none" preserveAspectRatio="none">
            <path d="M-20 174C96 44 184 236 322 112 394 47 430 56 548 8" stroke="rgb(var(--color-premium) / 0.14)" strokeWidth="1.25" />
            <path d="M104 244C212 135 289 236 389 137 437 90 475 88 558 56" stroke="rgb(var(--color-premium) / 0.08)" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-[1480px] px-5 pb-12 pt-8 sm:px-8 lg:px-12">
          <OverviewIntro periodFilters={periodFilters} now={now} onPeriodChange={setPeriodFilters} />

          {invoicesLoading || paymentsLoading || !totals ? (
            <div className="pt-9">
              <OverviewSkeleton />
            </div>
          ) : (
            <div className="space-y-9 pt-9">
              <section
                className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(280px,1.15fr)_repeat(4,minmax(0,1fr))]"
                aria-label="Financial summary"
              >
                <MetricHero
                  periodLabel={periodLabel}
                  amount={selectedRevenue}
                  changePct={changePct}
                  onClick={() => navigateTo("reports")}
                />
                <div className="xl:col-span-4">
                  <StatStrip totals={totals} activeFilter={overviewFocus} onSelect={focusOverviewStatus} />
                </div>
              </section>

              {seriouslyOverdue > 0 && !overviewFocus && (
                <InlineBanner
                  icon={AlertTriangle}
                  tone="caution"
                  action={{ label: "View overdue invoices", onClick: () => focusOverviewStatus("overdue") }}
                >
                  {seriouslyOverdue === 1
                    ? "1 invoice is more than 15 days overdue."
                    : `${seriouslyOverdue} invoices are more than 15 days overdue.`}
                </InlineBanner>
              )}

              {/* Metric-to-workspace transform (blueprint §5.1): clicking a
                  status in the strip above cross-fades this region between
                  the default revenue/activity view and a focused invoice
                  list — never a full navigation or page reload. */}
              <AnimatePresence mode="wait">
                {overviewFocus ? (
                  <motion.div
                    key="focused"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <p className="text-xs text-ink-faint">Quick look, without leaving Overview</p>
                      <button
                        type="button"
                        onClick={() => goToInvoices(overviewFocus)}
                        className="text-xs font-medium text-accent transition-colors duration-micro hover:text-ink hover:underline"
                      >
                        Open in Invoices →
                      </button>
                    </div>
                    <FocusedInvoiceList status={overviewFocus} invoices={periodInvoices} clients={clients} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="default"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]"
                  >
                    <RevenueChart series={revenueSeries} />
                    <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6" aria-labelledby="recent-activity-title">
                      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                        <div>
                          <h2 id="recent-activity-title" className="font-display text-xl text-ink">Recent activity</h2>
                          <p className="mt-1 text-sm text-ink-muted">Latest updates from your workspace</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateTo("reports")}
                          className="shrink-0 pt-1 text-xs font-medium text-accent"
                        >
                          View all →
                        </button>
                      </div>
                      <div className="pt-2">
                        <ActivityFeed events={periodActivity} invoices={invoices ?? []} />
                      </div>
                    </section>
                  </motion.div>
                )}
              </AnimatePresence>

              <section className="relative isolate overflow-hidden rounded-lg border border-border bg-surface p-6 shadow-card sm:p-7">
                <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full border border-premium/15" />
                <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-sidebar text-premium">
                      <SurfineMark className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-premium">Surfine Technology</p>
                      <h2 className="mt-2 font-display text-2xl text-ink">Building stronger businesses together.</h2>
                      <p className="mt-2 text-sm text-ink-muted">Surfine Technology — Forging a stronger tomorrow.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openCreateInvoice()}
                      className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors duration-micro hover:bg-accent/90"
                    >
                      <Plus size={15} strokeWidth={1.8} aria-hidden />
                      Create Invoice
                      <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={goToClients}
                      className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-micro hover:border-accent hover:text-accent"
                    >
                      <Users size={15} strokeWidth={1.8} aria-hidden />
                      Manage Clients
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
