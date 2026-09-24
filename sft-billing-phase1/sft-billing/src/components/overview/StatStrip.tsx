import { motion } from "framer-motion";
import type { InvoiceStatus } from "@/types";
import type { StatusTotal } from "@/lib/overviewMetrics";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface StatStripProps {
  totals: Record<InvoiceStatus, StatusTotal>;
  activeFilter: InvoiceStatus | null;
  onSelect: (status: InvoiceStatus) => void;
}

const ORDER: { status: InvoiceStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "paid", label: "Paid" },
  { status: "overdue", label: "Overdue" },
  { status: "draft", label: "Draft" },
];

/**
 * These are deliberately NOT decorative cards. Clicking one doesn't
 * navigate anywhere — it sets `overviewFocus` in the workspace store,
 * and the panel below cross-fades into a focused view of exactly those
 * invoices. See OverviewPage for the transition itself.
 */
export function StatStrip({ totals, activeFilter, onSelect }: StatStripProps) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-6 sm:grid-cols-4">
      {ORDER.map(({ status, label }) => {
        const total = totals[status];
        const isActive = activeFilter === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(status)}
            aria-pressed={isActive}
            className={cn(
              "group relative rounded-md px-1 py-1 text-left transition-colors duration-micro",
              isActive && "text-accent",
            )}
          >
            <p className={cn("text-xs font-medium text-ink-muted", isActive && "text-accent")}>{label}</p>
            <p className="font-tabular mt-1 text-xl text-ink">{formatCurrency(total.amount)}</p>
            <p className="text-xs text-ink-faint">
              {total.count} {total.count === 1 ? "invoice" : "invoices"}
            </p>
            {isActive && (
              <motion.div
                layoutId="stat-strip-active"
                className="absolute -bottom-[25px] left-0 right-0 h-[2px] bg-accent"
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
