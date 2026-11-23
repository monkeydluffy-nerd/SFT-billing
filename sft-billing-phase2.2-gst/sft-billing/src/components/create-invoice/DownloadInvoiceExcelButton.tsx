import { useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import type { Invoice } from "@/types";
import { cn } from "@/lib/cn";
import { downloadInvoiceTemplate } from "@/services/invoiceTemplateDownloadService";

interface DownloadInvoiceExcelButtonProps {
  invoice: Invoice;
  className?: string;
}

type ButtonState = "idle" | "generating" | "done" | "error";

export function DownloadInvoiceExcelButton({
  invoice,
  className,
}: DownloadInvoiceExcelButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleClick() {
    if (state === "generating") return;

    setState("generating");
    setErrorMessage(null);
    setWarnings([]);

    try {
      const { warnings: exportWarnings } = await downloadInvoiceTemplate(invoice, "excel");
      setWarnings(exportWarnings);
      setState("done");
      window.setTimeout(() => setState("idle"), 3000);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't export the Excel invoice.");
      window.setTimeout(() => setState("idle"), 4000);
    }
  }

  const label = state === "generating"
    ? "Generating..."
    : state === "done"
      ? "Excel downloaded"
      : "Download Excel";
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
        <p
          role="alert"
          className="absolute right-0 top-full z-10 mt-1.5 w-64 rounded-md border border-overdue/20 bg-surface-raised px-2.5 py-1.5 text-xs text-overdue shadow-float"
        >
          {errorMessage}
        </p>
      )}
      {state === "done" && warnings.length > 0 && (
        <p
          role="status"
          title={warnings.join("\n")}
          className="absolute right-0 top-full z-10 mt-1.5 w-72 rounded-lg border border-border-strong bg-surface-raised px-2.5 py-1.5 text-xs text-ink-muted shadow-float"
        >
          Downloaded. Some fields are not represented in this template.
        </p>
      )}
    </div>
  );
}
