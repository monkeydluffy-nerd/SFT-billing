import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileText, RotateCw } from "lucide-react";
import type { Invoice } from "@/types";
import { activeDataProvider } from "@/services";
import { cn } from "@/lib/cn";

interface InvoicePdfViewerProps {
  invoice: Invoice;
  className?: string;
  /** Rendered when the PDF can't be produced (e.g. offline provider). */
  fallback?: React.ReactNode;
}

/**
 * Shows the real invoice PDF — the exact document that "Download PDF"
 * delivers — inline, using the browser's built-in PDF viewer.
 */
export function InvoicePdfViewer({ invoice, className, fallback }: InvoicePdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // Re-render the PDF whenever anything printed on it changes.
  const signature = JSON.stringify([
    invoice.id,
    invoice.number,
    invoice.clientId,
    invoice.items,
    invoice.gst,
    invoice.discount,
    invoice.roundOff,
    invoice.isDraft,
    invoice.dueDate,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await activeDataProvider.getInvoicePdf(invoice.id);
      const next = URL.createObjectURL(result.blob);
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't load the invoice PDF.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  useEffect(
    () => () => {
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    },
    [],
  );

  if (error && !url) {
    return (
      <div className={cn("flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl bg-canvas p-8 text-center", className)} role="alert">
        <AlertTriangle size={22} className="text-caution" aria-hidden />
        <div>
          <p className="text-sm font-medium text-ink">Couldn&apos;t load the PDF preview</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <RotateCw size={13} aria-hidden /> Try again
        </button>
        {fallback}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-canvas ring-1 ring-border", className)}>
      {url && (
        <iframe
          title={`Invoice ${invoice.number} PDF`}
          src={`${url}#toolbar=0&navpanes=0&view=FitH`}
          className="block h-[78vh] min-h-[560px] w-full bg-white"
        />
      )}
      {(loading || !url) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/90 backdrop-blur-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <FileText size={18} className="animate-pulse" aria-hidden />
          </span>
          <p className="text-xs text-ink-muted">Preparing your invoice PDF…</p>
        </div>
      )}
    </div>
  );
}
