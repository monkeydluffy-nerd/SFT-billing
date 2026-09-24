import { Send, X } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onSendReminders: () => void;
  onClear: () => void;
  busy?: boolean;
}

export function BulkActionBar({ count, onSendReminders, onClear, busy }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
      <p className="text-sm font-medium text-ink">
        {count} {count === 1 ? "invoice" : "invoices"} selected
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSendReminders}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:opacity-50"
        >
          <Send size={12} /> Send reminders
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-micro hover:bg-surface hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
