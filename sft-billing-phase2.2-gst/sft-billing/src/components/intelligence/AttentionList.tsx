import { ArrowRight } from "lucide-react";
import type { AttentionItem } from "@/lib/intelligence";
import { formatCurrency } from "@/lib/formatters";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { cn } from "@/lib/cn";

interface AttentionListProps {
  items: AttentionItem[];
  onOpenInvoice: (invoiceId: string) => void;
}

/**
 * A short, focused action list - never a dumping ground of every
 * invoice. Most items are invoice-level (overdue, due-soon,
 * large-outstanding) and clicking opens that invoice; the
 * payment-inactivity item is workspace-level (no single invoice to open)
 * and renders as informational rather than clickable.
 */
export function AttentionList({ items, onOpenInvoice }: AttentionListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {items.map((item, index) => {
        const isClickable = Boolean(item.invoiceId);
        return (
          <div
            key={item.id}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? () => onOpenInvoice(item.invoiceId!) : undefined}
            onKeyDown={
              isClickable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenInvoice(item.invoiceId!);
                    }
                  }
                : undefined
            }
            className={cn(
              "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-micro",
              isClickable && "hover:bg-canvas",
              index !== items.length - 1 && "border-b border-border",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                item.severity === "high" ? "bg-overdue-strong" : "bg-caution",
              )}
              aria-hidden
            />
            <span className="w-24 shrink-0 font-medium text-ink">
              {item.invoiceId && item.invoiceNumber ? (
                <InvoiceNumberLink invoice={{ id: item.invoiceId, number: item.invoiceNumber }} />
              ) : (
                item.invoiceNumber ?? "\u2014"
              )}
            </span>
            <span className="flex-1 truncate text-ink-muted">{item.clientName}</span>
            <span className="w-40 shrink-0 text-xs text-ink-faint">{item.detail}</span>
            <span className="font-tabular w-28 shrink-0 text-right text-ink">{formatCurrency(item.amount)}</span>
            {isClickable && (
              <span className="flex w-32 shrink-0 items-center justify-end gap-1 text-xs font-medium text-accent">
                {item.actionLabel}
                <ArrowRight size={12} aria-hidden />
              </span>
            )}
            {!isClickable && (
              <span className="w-32 shrink-0 text-right text-xs text-ink-faint">{item.actionLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}