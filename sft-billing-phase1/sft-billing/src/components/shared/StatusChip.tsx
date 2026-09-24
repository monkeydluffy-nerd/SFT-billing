import { CheckCircle2, Clock, AlertTriangle, FileEdit, Send, XCircle } from "lucide-react";
import type { InvoiceStatusInfo } from "@/types";
import { cn } from "@/lib/cn";

interface StatusChipProps {
  info: InvoiceStatusInfo;
  className?: string;
}

const CONFIG = {
  paid: { label: "Paid", icon: CheckCircle2, classes: "bg-success-bg text-success border-success/20" },
  pending: { label: "Pending", icon: Clock, classes: "bg-pending-bg text-pending border-pending/20" },
  sent: { label: "Sent", icon: Send, classes: "bg-pending-bg text-pending border-pending/20" },
  draft: { label: "Draft", icon: FileEdit, classes: "bg-neutral-bg text-neutral border-dashed border-neutral/30" },
  cancelled: { label: "Cancelled", icon: XCircle, classes: "bg-neutral-bg text-neutral-500 border-neutral/20 line-through opacity-70" },
} as const;

/**
 * Status is always communicated with a label AND an icon, never color
 * alone (accessibility requirement). Overdue uses a severity gradient:
 * recently overdue reads mild amber; 30+ days reads the stronger tone.
 */
export function StatusChip({ info, className }: StatusChipProps) {
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        classes,
        className,
      )}
    >
      <Icon size={13} aria-hidden />
      {label}
    </span>
  );
}
