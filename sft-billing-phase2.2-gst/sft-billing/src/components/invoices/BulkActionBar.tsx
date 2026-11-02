import { X, Download, BellRing, CheckCircle2 } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onSendReminders: () => void;
  onDownload: () => void;
  onMarkReceived: () => void;
  onClear: () => void;
  busy?: boolean;
}

export function BulkActionBar({ count, onSendReminders, onDownload, onMarkReceived, onClear, busy }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-panel">
      <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-surface px-4 py-3 shadow-float-lg min-w-[320px] max-w-[480px]">
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">
            {count} {count === 1 ? "invoice" : "invoices"} selected
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong hover:bg-canvas disabled:opacity-50"
          >
            <Download size={12} /> Download
          </button>
          <button
            type="button"
            onClick={onSendReminders}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong hover:bg-canvas disabled:opacity-50"
          >
            <BellRing size={12} /> Remind
          </button>
          <button
            type="button"
            onClick={onMarkReceived}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-micro hover:border-accent/50 hover:bg-accent/10 disabled:opacity-50"
          >
            <CheckCircle2 size={12} /> Mark received
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-micro hover:bg-canvas hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}