import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Invoice } from "@/types";
import { activeDataProvider } from "@/services";
import { downloadInvoiceJson, readInvoiceUpload } from "@/services/invoiceFileService";

interface InvoiceFileActionsProps {
  invoice?: Invoice;
  onUploaded?: (invoice: Invoice) => void;
}

export function InvoiceFileActions({ invoice, onUploaded }: InvoiceFileActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const uploaded = await readInvoiceUpload(file);
      const saved = await activeDataProvider.saveInvoice(uploaded);
      setMessage(`Saved ${saved.number} on this PC.`);
      onUploaded?.(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload that invoice.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {invoice && (
        <button
          type="button"
          onClick={() => downloadInvoiceJson(invoice)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-border-strong"
        >
          <Download size={14} aria-hidden /> Download JSON
        </button>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-border-strong"
      >
        <Upload size={14} aria-hidden /> Upload invoice
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void handleUpload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {message && <p className="text-xs text-ink-faint">{message}</p>}
    </div>
  );
}
