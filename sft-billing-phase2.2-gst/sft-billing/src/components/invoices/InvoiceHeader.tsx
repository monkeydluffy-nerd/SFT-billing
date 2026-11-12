import type { Client, Invoice, InvoiceLedgerStatusInfo } from "@/types";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { StatusChip } from "@/components/shared/StatusChip";

interface InvoiceHeaderProps {
  invoice: Invoice;
  client: Client | undefined;
  ledgerInfo: InvoiceLedgerStatusInfo | null;
  invoiceTotals: { total: number };
}

/** Compact title row: number + status, client underneath. Amounts live in the summary panel. */
export function InvoiceHeader({ invoice, client, ledgerInfo }: InvoiceHeaderProps) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display truncate text-[1.65rem] leading-tight tracking-tight text-ink">{invoice.number}</h1>
        {invoice.isDraft ? (
          <StatusChip info={{ status: "draft", daysOverdue: 0, severity: null }} />
        ) : (
          ledgerInfo && <LedgerStatusChip info={ledgerInfo} />
        )}
      </div>
      <p className="mt-1 truncate text-sm text-ink-muted">{client?.name ?? "Unknown client"}</p>
    </div>
  );
}
