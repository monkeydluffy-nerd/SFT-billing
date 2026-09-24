import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { InvoiceLedgerStatusInfo } from "@/types";
import { cn } from "@/lib/cn";

interface LedgerStatusChipProps {
  info: InvoiceLedgerStatusInfo;
  className?: string;
}

const CONFIG = {
  received: { label: "Received", icon: CheckCircle2, classes: "bg-success-bg text-success" },
  outstanding: { label: "Outstanding", icon: Clock, classes: "bg-pending-bg text-pending" },
} as const;

/**
 * The ledger-status counterpart to StatusChip, used only on the seven
 * core-workflow surfaces named in Requirement 10. Same accessibility
 * rule (label + icon, never color alone) and the same overdue severity
 * gradient as StatusChip — but StatusChip's own CONFIG/labels are never
 * touched, so Reports/Intelligence/AURA keep reading "Pending"/"Paid"
 * unchanged via StatusChip + getInvoiceStatus().
 */
export function LedgerStatusChip({ info, className }: LedgerStatusChipProps) {
  if (info.status === "overdue") {
    const isStrong = info.severity === "strong";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          isStrong
            ? "bg-overdue-strong-bg text-overdue-strong border-overdue-strong/20"
            : "bg-caution-bg text-caution border-caution/20",
          className,
        )}
      >
        <AlertTriangle size={13} aria-hidden />
        {info.daysOverdue === 1 ? "1 day overdue" : `${info.daysOverdue} days overdue`}
      </span>
    );
  }

  const { label, icon: Icon, classes } = CONFIG[info.status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium",
        classes,
        className,
      )}
    >
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}
