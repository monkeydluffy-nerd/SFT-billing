import { Check } from "lucide-react";
import type { Invoice, InvoiceStatusInfo } from "@/types";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/cn";

interface MiniTimelineProps {
  invoice: Invoice;
  info: InvoiceStatusInfo;
}

const FINAL_LABEL: Record<InvoiceStatusInfo["status"], string> = {
  draft: "Not sent",
  pending: "Awaiting payment",
  overdue: "Overdue",
  paid: "Paid",
};

/**
 * A small horizontal step tracker. Each step is either "done" (has a real
 * date behind it), the current state, or not-yet-reached — never just a
 * color, always a label, per the accessibility rule that status is never
 * color-only.
 */
export function MiniTimeline({ invoice, info }: MiniTimelineProps) {
  const steps = [
    { label: "Created", done: true, date: invoice.issueDate },
    { label: "Sent", done: Boolean(invoice.sentAt), date: invoice.sentAt },
    { label: "Viewed", done: Boolean(invoice.viewedAt), date: invoice.viewedAt },
    { label: FINAL_LABEL[info.status], done: info.status === "paid", date: invoice.paidAt },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => (
        <div key={step.label} className="flex flex-1 items-center gap-1 last:flex-none">
          <div className="flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium",
                step.done
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border-strong bg-surface text-ink-faint",
              )}
            >
              {step.done ? <Check size={11} /> : index + 1}
            </span>
            <span className="whitespace-nowrap text-[11px] text-ink-muted">{step.label}</span>
            {step.date && <span className="whitespace-nowrap text-[10px] text-ink-faint">{formatDate(step.date)}</span>}
          </div>
          {index < steps.length - 1 && (
            <span className={cn("mt-[-14px] h-px flex-1", step.done ? "bg-accent" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}
