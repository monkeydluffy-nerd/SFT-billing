import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FilePenLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InvoiceStatus } from "@/types";
import type { StatusTotal } from "@/lib/overviewMetrics";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface StatStripProps {
  totals: Record<InvoiceStatus, StatusTotal>;
  activeFilter: InvoiceStatus | null;
  onSelect: (status: InvoiceStatus) => void;
}

const ORDER: { status: InvoiceStatus; label: string; icon: LucideIcon; tone: string }[] = [
  { status: "pending", label: "Outstanding", icon: Clock3, tone: "bg-pending-bg text-pending" },
  { status: "paid", label: "Received", icon: CheckCircle2, tone: "bg-success-bg text-success" },
  { status: "overdue", label: "Overdue", icon: AlertTriangle, tone: "bg-overdue-bg text-overdue" },
  { status: "draft", label: "Draft", icon: FilePenLine, tone: "bg-neutral-bg text-neutral" },
];

/** Status cards remain interactive filters; only their presentation changes here. */
export function StatStrip({ totals, activeFilter, onSelect }: StatStripProps) {
  return (
    <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-4">
      {ORDER.map(({ status, label, icon: Icon, tone }) => {
        const total = totals[status];
        const isActive = activeFilter === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(status)}
            aria-pressed={isActive}
            className={cn(
              "group flex min-h-[222px] flex-col rounded-lg border border-border bg-surface p-5 text-left shadow-card transition-[border-color,background-color,transform] duration-micro hover:-translate-y-px hover:border-border-strong",
              isActive && "border-accent ring-1 ring-accent/20",
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", tone)}>
              <Icon size={15} strokeWidth={1.8} aria-hidden />
            </span>
            <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-muted">{label}</p>
            {status === "draft" ? (
              <p className="mt-2 font-display text-xl text-ink">Not billed</p>
            ) : (
              <p className="font-tabular mt-2 font-display text-2xl tracking-[-0.02em] text-ink">
                {formatCurrency(total.amount)}
              </p>
            )}
            <p className="mt-auto pt-4 text-xs text-ink-faint">
              {total.count} {total.count === 1 ? "invoice" : "invoices"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
