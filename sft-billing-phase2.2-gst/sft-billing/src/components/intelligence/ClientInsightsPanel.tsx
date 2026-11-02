import { AlertCircle, Clock, Crown, ShieldCheck, TrendingUp } from "lucide-react";
import type { ClientInsights as ClientInsightsData } from "@/lib/intelligence";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface ClientInsightsProps {
  insights: ClientInsightsData;
}

/**
 * Only ever shows facts computeClientInsights actually produced - each
 * card/row is individually optional, so a small workspace shows fewer
 * facts rather than a fabricated "highest"/"strongest" of a single data
 * point. Kept concise per the brief: a handful of small fact cards plus
 * one short recent-activity list, not a second full table.
 */
export function ClientInsightsPanel({ insights }: ClientInsightsProps) {
  const { highestOutstandingClient, largestBilledClient, concentrationRisk, clientsWithOverdueCount, strongestCollectionClient, recentlyActiveClients } = insights;

  const hasAnyFactCard = Boolean(highestOutstandingClient || largestBilledClient || concentrationRisk || strongestCollectionClient || clientsWithOverdueCount > 0);
  const hasRecentActivity = recentlyActiveClients.length > 0;

  if (!hasAnyFactCard && !hasRecentActivity) {
    return null;
  }

  return (
    <div className="space-y-4">
      {hasAnyFactCard && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highestOutstandingClient && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <AlertCircle size={13} className="text-caution" aria-hidden />
                Highest outstanding
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink">{highestOutstandingClient.clientName}</p>
              <p className="font-tabular mt-0.5 text-lg text-ink">{formatCurrency(highestOutstandingClient.amount)}</p>
            </div>
          )}
          {largestBilledClient && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <Crown size={13} className="text-premium" aria-hidden />
                Largest billed client
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink">{largestBilledClient.clientName}</p>
              <p className="font-tabular mt-0.5 text-lg text-ink">{formatCurrency(largestBilledClient.amount)}</p>
            </div>
          )}
          {strongestCollectionClient && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <ShieldCheck size={13} className="text-success" aria-hidden />
                Strongest collection activity
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink">{strongestCollectionClient.clientName}</p>
              <p className="font-tabular mt-0.5 text-lg text-ink">{formatCurrency(strongestCollectionClient.amount)} paid to date</p>
            </div>
          )}
          {clientsWithOverdueCount > 0 && (
            <div className="rounded-lg border border-overdue/20 bg-overdue-bg/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <AlertCircle size={13} className="text-overdue" aria-hidden />
                Clients with overdue invoices
              </p>
              <p className="font-tabular mt-1.5 text-lg text-ink">
                {clientsWithOverdueCount} client{clientsWithOverdueCount === 1 ? "" : "s"}
              </p>
            </div>
          )}
          {concentrationRisk && (
            <div className="rounded-lg border border-caution/30 bg-caution-bg/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <TrendingUp size={13} className="text-caution" aria-hidden />
                Concentration risk
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink">{concentrationRisk.clientName}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {Math.round(concentrationRisk.share * 100)}% of all outstanding balance ({formatCurrency(concentrationRisk.amount)})
              </p>
            </div>
          )}
        </div>
      )}

      {hasRecentActivity && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <Clock size={13} className="text-ink-faint" aria-hidden />
            <p className="text-xs font-medium text-ink-muted">Recently active clients (last 30 days)</p>
          </div>
          {recentlyActiveClients.map((client, index) => (
            <div
              key={client.clientId}
              className={`flex items-center justify-between px-4 py-2.5 text-sm ${index !== recentlyActiveClients.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="text-ink">{client.clientName}</span>
              <span className="text-xs text-ink-faint">Last invoice {formatDate(client.lastInvoiceDate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}