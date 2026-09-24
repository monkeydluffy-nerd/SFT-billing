import { useMemo } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { ExecutiveBrief } from "@/components/intelligence/ExecutiveBrief";
import { PulseStat } from "@/components/intelligence/PulseStat";
import { SignalCard } from "@/components/intelligence/SignalCard";
import { AttentionList } from "@/components/intelligence/AttentionList";
import { ClientInsightsPanel } from "@/components/intelligence/ClientInsightsPanel";
import { RevenueChart } from "@/components/overview/RevenueChart";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { computeMonthlyRevenueSeries } from "@/lib/overviewMetrics";
import {
  computeBusinessPulse,
  computeSignals,
  computeAttentionItems,
  computeClientInsights,
  generateExecutiveSummary,
} from "@/lib/intelligence";

/** Trends need at least this many distinct months with real revenue before a line chart is shown - fewer than this and a chart would just draw a dramatic-looking line through mostly-empty history. */
const MIN_MONTHS_FOR_TREND = 3;

export function IntelligencePage() {
  const { data: invoices, loading: invoicesLoading, error } = useInvoices();
  const { data: clients } = useClients();
  const { data: payments } = usePayments();
  const { goToInvoices, navigateToInvoiceDetail } = useWorkspaceStore();

  const now = useMemo(() => new Date(), []);
  const loading = invoicesLoading || !invoices || !clients || !payments;

  const pulse = useMemo(
    () => (invoices && payments ? computeBusinessPulse(invoices, payments, now) : undefined),
    [invoices, payments, now],
  );
  const signals = useMemo(
    () => (invoices && clients && pulse ? computeSignals(invoices, clients, pulse) : []),
    [invoices, clients, pulse],
  );
  const attentionItems = useMemo(
    () => (invoices && clients && payments ? computeAttentionItems(invoices, clients, payments, now) : []),
    [invoices, clients, payments, now],
  );
  const clientInsights = useMemo(
    () => (invoices && clients && payments ? computeClientInsights(invoices, clients, payments, now) : undefined),
    [invoices, clients, payments, now],
  );
  // Trends only earn their place once there's enough real history to show
  // a meaningful line - a chart with 0-1 real data points answers no
  // question, so it's withheld (with an explicit low-data note) rather
  // than rendered as a dramatic-looking line through mostly nothing.
  const revenueSeries = useMemo(() => (invoices ? computeMonthlyRevenueSeries(invoices, 12, now) : []), [invoices, now]);
  const monthsWithRevenue = revenueSeries.filter((point) => point.revenue > 0).length;
  const summary = useMemo(
    () => (pulse ? generateExecutiveSummary(pulse, attentionItems.length, pulse.totalOverdue) : ""),
    [pulse, attentionItems.length],
  );

  function openInvoice(invoiceId: string) {
    navigateToInvoiceDetail(invoiceId);
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Intelligence" subtitle="Your financial command center" />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load intelligence" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Intelligence" subtitle="Your financial command center" />

      <div className="px-10 py-8">
        {loading || !pulse ? (
          <OverviewSkeleton />
        ) : !pulse.hasEnoughData ? (
          <EmptyState
            icon={Sparkles}
            title="Not enough billing activity yet"
            description="Intelligence needs a few invoices and payments to find meaningful patterns. Create and send your first invoice to start building this view."
            action={
              <button
                type="button"
                onClick={() => goToInvoices()}
                className="text-sm font-medium text-accent hover:underline"
              >
                Go to Invoices
              </button>
            }
          />
        ) : (
          <div className="space-y-10">
            {/* Executive brief - the single opening statement, not another stat card */}
            <ExecutiveBrief summary={summary} />

            {/* Business pulse - every figure carries its own timeframe, and a
                comparison is only shown when the underlying baseline genuinely
                supports one (see PulseStat's comparisonUnavailable prop). */}
            <section>
              <p className="mb-4 text-sm font-medium text-ink">Business pulse</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 sm:grid-cols-3 lg:grid-cols-6">
                <PulseStat
                  label="Billed"
                  amount={pulse.billed.amount}
                  timeframe={pulse.periodLabel}
                  changePct={pulse.billed.comparable ? pulse.billed.changePct : undefined}
                  changeLabel={pulse.billed.comparable ? `vs ${pulse.comparableLabel}` : undefined}
                  comparisonUnavailable={pulse.hasComparableHistory && !pulse.billed.comparable}
                />
                <PulseStat
                  label="Received"
                  amount={pulse.collected.amount}
                  timeframe={pulse.periodLabel}
                  changePct={pulse.collected.comparable ? pulse.collected.changePct : undefined}
                  changeLabel={pulse.collected.comparable ? `vs ${pulse.comparableLabel}` : undefined}
                  comparisonUnavailable={pulse.hasComparableHistory && !pulse.collected.comparable}
                />
                <PulseStat
                  label="Outstanding"
                  amount={pulse.totalOutstanding}
                  timeframe={`${pulse.outstandingInvoiceCount} invoice${pulse.outstandingInvoiceCount === 1 ? "" : "s"} outstanding or overdue`}
                />
                <PulseStat
                  label="Overdue"
                  amount={pulse.totalOverdue}
                  tone="caution"
                  timeframe={`${pulse.overdueInvoiceCount} invoice${pulse.overdueInvoiceCount === 1 ? "" : "s"} past due`}
                />
                <PulseStat
                  label="Invoices issued"
                  display={String(pulse.invoicesIssuedThisPeriod)}
                  timeframe={pulse.periodLabel}
                />
                <PulseStat
                  label="Clients billed"
                  display={String(pulse.activeClientsThisPeriod)}
                  timeframe={pulse.periodLabel}
                />
              </div>
            </section>

            {/* Attention center - the highest-priority section, invoice-level and workspace-level items together, ranked by severity then amount */}
            <section>
              <p className="mb-4 text-sm font-medium text-ink">Attention center</p>
              {attentionItems.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Nothing needs attention"
                  description="No invoices are overdue, unusually large, or due imminently, and payments are coming in normally. This list will surface anything that needs a decision as soon as it comes up."
                />
              ) : (
                <AttentionList items={attentionItems} onOpenInvoice={openInvoice} />
              )}
            </section>

            {/* Key signals - shown only when at least one has real support */}
            {signals.length > 0 && (
              <section>
                <p className="mb-4 text-sm font-medium text-ink">Key signals</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {signals.map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                </div>
              </section>
            )}

            {/* Trends - only rendered once there's enough real history for a meaningful line; otherwise an honest low-data note, never a dramatic chart over sparse data */}
            <section>
              <p className="mb-4 text-sm font-medium text-ink">Trends</p>
              {monthsWithRevenue >= MIN_MONTHS_FOR_TREND ? (
                <RevenueChart series={revenueSeries} />
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="Not enough history for a trend yet"
                  description={`Revenue trends need at least ${MIN_MONTHS_FOR_TREND} months with collected payments to be meaningful. ${monthsWithRevenue} month${monthsWithRevenue === 1 ? " has" : "s have"} data so far.`}
                />
              )}
            </section>

            {/* Client insights - each fact independently optional; the whole section hides if none apply */}
            {clientInsights && (
              <section>
                <p className="mb-4 text-sm font-medium text-ink">Client insights</p>
                <ClientInsightsPanel insights={clientInsights} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}