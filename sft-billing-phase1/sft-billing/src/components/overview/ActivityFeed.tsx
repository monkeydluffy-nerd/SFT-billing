import { FileText, Send, Eye, AlertCircle, IndianRupee, UserPlus, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityEvent, ActivityEventType } from "@/types";
import { formatRelativeTime } from "@/lib/formatters";
import { EmptyState } from "@/components/shared/EmptyState";

const ICONS: Record<ActivityEventType, LucideIcon> = {
  invoice_created: FileText,
  invoice_sent: Send,
  invoice_viewed: Eye,
  invoice_became_overdue: AlertCircle,
  payment_received: IndianRupee,
  client_added: UserPlus,
  note_added: StickyNote,
};

interface ActivityFeedProps {
  events: ActivityEvent[];
  limit?: number;
}

export function ActivityFeed({ events, limit = 6 }: ActivityFeedProps) {
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
        const isPositive = event.type === "payment_received";
        return (
          <li key={event.id} className="flex items-center gap-3 py-3">
            <span
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                (isPositive ? "bg-success-bg text-success" : "bg-neutral-bg text-ink-muted")
              }
            >
              <Icon size={14} aria-hidden />
            </span>
            <p className="flex-1 text-sm text-ink">{event.summary}</p>
            <time className="shrink-0 text-xs text-ink-faint">{formatRelativeTime(event.occurredAt)}</time>
          </li>
        );
      })}
    </ul>
  );
}
