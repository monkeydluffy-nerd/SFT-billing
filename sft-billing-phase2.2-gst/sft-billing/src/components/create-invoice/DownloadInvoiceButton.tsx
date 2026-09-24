import { useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import type { BusinessProfile, Client, Invoice } from "@/types";
import { downloadInvoicePdf } from "@/services/invoicePdfService";
import { cn } from "@/lib/cn";

interface DownloadInvoiceButtonProps {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
  className?: string;
}

type ButtonState = "idle" | "generating" | "done" | "error";

/**
 * Triggers invoiceExportService rather than containing any workbook
 * logic itself - this component is only responsible for the click,
 * loading state, duplicate-click guard, and success/error feedback.
 */
export function DownloadInvoiceButton({ invoice, client, business, className }: DownloadInvoiceButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    if (state === "generating") return; // guards against duplicate clicks

    setState("generating");
    setErrorMessage(null);
    try {
      await downloadInvoicePdf({ invoice, client, business });
      setState("done");
      setTimeout(() => setState("idle"), 2200);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Couldn't generate the invoice file.");
      setTimeout(() => setState("idle"), 3200);
    }
  }

  const label = state === "generating" ? "Generating..." : state === "done" ? "Downloaded" : "Download invoice";
  const Icon = state === "generating" ? Loader2 : state === "done" ? CheckCircle2 : Download;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "generating"}
        aria-busy={state === "generating"}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors duration-micro",
          state === "done"
            ? "border-success/30 bg-success-bg text-success"
            : state === "error"
              ? "border-overdue/30 bg-overdue-bg text-overdue"
              : "border-border bg-surface text-ink hover:border-border-strong",
          state === "generating" && "cursor-wait opacity-80",
          className,
        )}
      >
        <Icon size={14} className={cn(state === "generating" && "animate-spin")} aria-hidden />
        {label}
      </button>
      {state === "error" && errorMessage && (
        <p role="alert" className="absolute right-0 top-full z-10 mt-1.5 w-56 rounded-md border border-overdue/20 bg-surface-raised px-2.5 py-1.5 text-xs text-overdue shadow-float">
          {errorMessage}
        </p>
      )}
    </div>
  );
}