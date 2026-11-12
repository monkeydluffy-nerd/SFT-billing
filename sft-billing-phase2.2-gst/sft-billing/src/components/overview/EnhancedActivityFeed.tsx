import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Eye,
  AlertCircle,
  IndianRupee,
  UserPlus,
  StickyNote,
  BellRing,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityEvent, ActivityEventType, Invoice } from "@/types";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { formatRelativeTime } from "@/lib/formatters";

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

function formatRupees(value: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
  return formatted.replace("₹", "Rs");
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

function GroupedEvents({ group, events, invoices }: { group: string; events: Array<{ event: ActivityEvent; duplicateCount?: number }>; invoices: Array<Pick<Invoice, "id" | "number">> }) {
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border/50" role="list" aria-label={`Activity: ${group}`}>
        {events.map((item, index) => {
          const event = item.event;
          const Icon = ICONS[event.type];
          const invoice = event.invoiceId ? invoices.find((candidate) => candidate.id === event.invoiceId) : undefined;

          let summary = event.summary;
          if (event.type === "payment_received" && invoice) {
            const amount = event.amount;
            if (amount !== undefined) {
              summary = `Payment of ${formatRupees(amount)} received for invoice ${invoice.number}`;
            }
          }

          return (
            <li
              key={event.id}
              className="flex items-center gap-3 py-2.5 first:pt-1 last:pb-1 animate-slideDown"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-canvas text-ink-muted">
                <Icon size={13} strokeWidth={1.7} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 text-ink">{renderActivitySummary({ ...event, summary }, invoice)}</p>
              </div>
              <time className="shrink-0 flex items-center gap-1.5 text-xs text-ink-faint">
                {formatRelativeTime(event.occurredAt)}
                {item.duplicateCount && item.duplicateCount > 1 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-ink-muted bg-canvas border border-border rounded">×{item.duplicateCount}</span>
                )}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface EnhancedActivityFeedProps {
  events: ActivityEvent[];
  invoices?: Array<Pick<Invoice, "id" | "number">>;
  limit?: number;
}

const PAGE_SIZE = 6;

export function EnhancedActivityFeed({ events, invoices = [], limit = PAGE_SIZE }: EnhancedActivityFeedProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(events.length / limit));
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);
  const pageEvents = useMemo(() => events.slice(page * limit, page * limit + limit), [events, page, limit]);

  const groupedEvents = useMemo(() => {
    if (!pageEvents.length) return [];

    const groups = new Map<string, Array<{ event: ActivityEvent; duplicateCount: number }>>();

    for (const event of pageEvents) {
      const date = new Date(event.occurredAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let group: string;
      if (date.toDateString() === today.toDateString()) group = "Today";
      else if (date.toDateString() === yesterday.toDateString()) group = "Yesterday";
      else group = "Earlier";

      const mergeKey = `${event.type}-${event.invoiceId || "none"}`;
      if (!groups.has(group)) groups.set(group, []);

      const existing = groups.get(group)!.find((item) => `${item.event.type}-${item.event.invoiceId || "none"}` === mergeKey);
      if (existing) {
        existing.duplicateCount = (existing.duplicateCount || 1) + 1;
      } else {
        groups.get(group)!.push({ event, duplicateCount: 1 });
      }
    }

    return Array.from(groups.entries());
  }, [pageEvents]);

  if (groupedEvents.length === 0) {
    return (
      <div className="py-8 text-center">
        <FileText size={32} className="mx-auto text-ink-faint" aria-hidden />
        <p className="mt-2 text-sm text-ink-muted">No activity yet</p>
        <p className="text-xs text-ink-faint">Invoices, payments, and client updates will show up here as they happen.</p>
      </div>
    );
  }

  const from = page * limit + 1;
  const to = Math.min(events.length, (page + 1) * limit);

  return (
    <div role="region" aria-label="Recent activity">
      <div className="space-y-4">
        {groupedEvents.map(([group, groupEvents]) => (
          <GroupedEvents key={`${page}-${group}`} group={group} events={groupEvents} invoices={invoices} />
        ))}
      </div>
      {events.length > limit && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-muted">
          <span className="font-tabular">{from}–{to} of {events.length}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Newer activity"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              aria-label="Older activity"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}