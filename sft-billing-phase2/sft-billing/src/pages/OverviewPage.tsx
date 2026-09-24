import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricHero } from "@/components/overview/MetricHero";
import { StatStrip } from "@/components/overview/StatStrip";
import { RevenueChart } from "@/components/overview/RevenueChart";
import { ActivityFeed } from "@/components/overview/ActivityFeed";
import { FocusedInvoiceList } from "@/components/overview/FocusedInvoiceList";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { InlineBanner } from "@/components/shared/InlineBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useActivity } from "@/hooks/useActivity";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { computeStatusTotals, computeMonthlyRevenueSeries, revenueForCurrentMonth } from "@/lib/overviewMetrics";
import { getInvoiceStatus } from "@/lib/invoiceMath";

export function OverviewPage() {
  const { data: invoices, loading: invoicesLoading, error: invoicesError } = useInvoices();
  const { data: clients } = useClients();
  const { data: activity } = useActivity();
  const { overviewFocus, focusOverviewStatus, goToInvoices } = useWorkspaceStore();

  const now = useMemo(() => new Date(), []);
  const periodLabel = useMemo(
    () => now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }).toUpperCase(),
    [now],
  );

  const totals = useMemo(() => (invoices ? computeStatusTotals(invoices, now) : undefined), [invoices, now]);
  const revenueSeries = useMemo(() => (invoices ? computeMonthlyRevenueSeries(invoices, 12, now) : []), [invoices, now]);
  const { current, changePct } = useMemo(() => revenueForCurrentMonth(revenueSeries), [revenueSeries]);

  const seriouslyOverdue = useMemo(() => {
    if (!invoices) return 0;
    return invoices.filter((invoice) => {
      const info = getInvoiceStatus(invoice, now);
      return info.status === "overdue" && info.daysOverdue >= 15;
    }).length;
  }, [invoices, now]);

  if (invoicesError) {
    return (
      <div>
        <PageHeader title="Overview" subtitle={periodLabel} />
        <div className="px-10 py-10">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load the overview"
            description={invoicesError.message}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Overview" subtitle="Financial command center" />

      <div className="px-10 py-8">
        {invoicesLoading || !totals ? (
          <OverviewSkeleton />
        ) : (
          <div className="space-y-10">
            <MetricHero periodLabel={periodLabel} amount={current} changePct={changePct} />

            <StatStrip totals={totals} activeFilter={overviewFocus} onSelect={focusOverviewStatus} />

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
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs text-ink-faint">Quick look, without leaving Overview</p>
                    <button
                      type="button"
                      onClick={() => goToInvoices(overviewFocus)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Open in Invoices →
                    </button>
                  </div>
                  <FocusedInvoiceList status={overviewFocus} invoices={invoices ?? []} clients={clients} />
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr]"
                >
                  <RevenueChart series={revenueSeries} />
                  <div>
                    <p className="mb-4 text-sm font-medium text-ink">Recent activity</p>
                    <ActivityFeed events={activity ?? []} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
