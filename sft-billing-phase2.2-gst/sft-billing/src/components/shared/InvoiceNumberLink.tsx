import type { Invoice } from "@/types";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { cn } from "@/lib/cn";

interface InvoiceNumberLinkProps {
  invoice: Pick<Invoice, "id" | "number">;
  className?: string;
}

/**
 * The single reusable way an invoice number is rendered anywhere in the
 * core workflow — always a clickable link to the Invoice_Detail_Page for
 * that exact invoice. `stopPropagation` lets this be nested inside a
 * larger clickable row (e.g. a Payments row that navigates elsewhere on
 * click) without the two destinations colliding.
 */
export function InvoiceNumberLink({ invoice, className }: InvoiceNumberLinkProps) {
  const navigateToInvoiceDetail = useWorkspaceStore((s) => s.navigateToInvoiceDetail);
  function openInvoice(e?: { stopPropagation: () => void }) {
    e?.stopPropagation();
    navigateToInvoiceDetail(invoice.id);
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        openInvoice(e);
      }}
      onKeyDown={(e) => {
        // Parent rows can use Enter/Space to open a different surface (for
        // example, a payment receipt). Keep keyboard activation exact too.
        e.stopPropagation();
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openInvoice();
        }
      }}
      aria-label={`Open invoice ${invoice.number}`}
      className={cn(
        "font-medium text-ink underline-offset-2 hover:text-accent hover:underline",
        className,
      )}
    >
      {invoice.number}
    </button>
  );
}
