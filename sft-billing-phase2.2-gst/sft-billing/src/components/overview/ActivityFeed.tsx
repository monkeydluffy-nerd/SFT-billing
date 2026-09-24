import { FileText, Send, Eye, AlertCircle, IndianRupee, UserPlus, StickyNote, BellRing, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityEvent, ActivityEventType, Invoice } from "@/types";
import { formatRelativeTime } from "@/lib/formatters";
import { EmptyState } from "@/components/shared/EmptyState";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";

const ICONS: Record<ActivityEventType, LucideIcon> = {
  invoice_created: FileText,
  invoice_sent: Send,
  invoice_viewed: Eye,
  invoice_became_overdue: AlertCircle,
  invoice_reminder_sent: BellRing,
  invoice_marked_paid: CheckCircle2,
  payment_received: IndianRupee,
  client_added: UserPlus,
  note_added: StickyNote,
};

interface ActivityFeedProps {
  events: ActivityEvent[];
  invoices?: Array<Pick<Invoice, "id" | "number">>;
  limit?: number;
}

function renderActivitySummary(event: ActivityEvent, invoice: Pick<Invoice, "id" | "number"> | undefined) {
  if (!invoice) return event.summary;

  const numberStart = event.summary.indexOf(invoice.number);
  if (numberStart < 0) {
    return (
      <>
        {event.summary} · <InvoiceNumberLink invoice={invoice} />
      </>
    );
  }

  return (
    <>
      {event.summary.slice(0, numberStart)}
      <InvoiceNumberLink invoice={invoice} />
      {event.summary.slice(numberStart + invoice.number.length)}
    </>
  );
}

export function ActivityFeed({ events, invoices = [], limit = 6 }: ActivityFeedProps) {
  const visible = events.slice(0, limit);

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No activity yet"
        description="Invoices, payments, and client updates will show up here as they happen."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map((event) => {
        const Icon = ICONS[event.type];
        const invoice = event.invoiceId ? invoices.find((candidate) => candidate.id === event.invoiceId) : undefined;
        const isPositive = event.type === "payment_received" || event.type === "invoice_marked_paid";
        return (
          <li key={event.id} className="flex items-center gap-3 py-4 first:pt-3 last:pb-2">
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border " +
                (isPositive ? "bg-success-bg text-success" : "bg-canvas text-ink-muted")
              }
            >
              <Icon size={14} strokeWidth={1.7} aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-5 text-ink">{renderActivitySummary(event, invoice)}</p>
            <time className="shrink-0 text-xs text-ink-faint">{formatRelativeTime(event.occurredAt)}</time>
          </li>
        );
      })}
    </ul>
  );
}
