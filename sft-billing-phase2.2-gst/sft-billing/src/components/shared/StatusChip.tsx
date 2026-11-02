import { CheckCircle2, Clock, AlertTriangle, FileEdit } from "lucide-react";
import type { InvoiceStatusInfo } from "@/types";
import { cn } from "@/lib/cn";

interface StatusChipProps {
  info: InvoiceStatusInfo;
  className?: string;
  /** Optional surface-specific wording; the shared legacy defaults remain unchanged. */
  labelOverride?: string;
}

const CONFIG = {
  paid: { label: "Paid", icon: CheckCircle2, classes: "bg-success-bg text-success" },
  pending: { label: "Pending", icon: Clock, classes: "bg-pending-bg text-pending" },
  draft: { label: "Draft", icon: FileEdit, classes: "bg-neutral-bg text-neutral border-dashed" },
} as const;

/**
 * Status is always communicated with a label AND an icon, never color
 * alone (accessibility requirement — see blueprint §18). Overdue uses a
 * severity gradient: recently overdue reads mild amber, invoices overdue
 * 30+ days read the stronger, more serious tone.
 */
export function StatusChip({ info, className, labelOverride }: StatusChipProps) {
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
      {labelOverride ?? label}
    </span>
  );
}
