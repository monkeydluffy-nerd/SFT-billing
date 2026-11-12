import {
  ChevronDown,
  Send,
  CheckCircle2,
  Download,
  Pencil,
  Eye,
  BellRing,
  IndianRupee,
  Trash2,
  FileText,
} from "lucide-react";
import type { Client, Invoice, Payment } from "@/types";
import { getInvoiceStatus, getInvoiceLedgerStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusChip } from "@/components/shared/StatusChip";
import { LedgerStatusChip } from "@/components/shared/LedgerStatusChip";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { Button } from "@/components/shared/Button";
import { Avatar } from "@/components/ui/kit";
import { MiniTimeline } from "./MiniTimeline";
import { cn } from "@/lib/cn";

/** Shared column template so the table header and every row line up. */
export const INVOICE_GRID = "28px 118px minmax(0,1.5fr) 132px 132px 148px 92px";

interface InvoiceRowProps {
  invoice: Invoice;
  clients: Client[] | undefined;
  payments: Payment[] | undefined;
  isSelected: boolean;
  onToggleSelect: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSendReminder: () => void;
  onSendInvoice: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  busy?: boolean;
  onQuickAction?: (action: "download" | "remind" | "payment", invoice: Invoice) => void;
}

function formatClientName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2 && words[0].toUpperCase() === "M/S") {
    return "M/S " + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function getOverdueSeverity(daysOverdue: number): "mild" | "strong" | "critical" {
  if (daysOverdue >= 90) return "critical";
  if (daysOverdue >= 30) return "strong";
  return "mild";
}

const SECTION_TITLE = "mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint";

export function InvoiceRow({
  invoice,
  clients,
  payments,
  isSelected,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  onSendReminder,
  onSendInvoice,
  onRecordPayment,
  onEdit,
  onView,
  onDelete,
  busy,
  onQuickAction,
}: InvoiceRowProps) {
  const isDraft = invoice.isDraft;
  const info = isDraft ? getInvoiceStatus(invoice) : null;
  const invoicePayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
  const ledgerInfo = isDraft ? null : getInvoiceLedgerStatus(invoice, invoicePayments);
  const { total, cgstAmount, sgstAmount, subtotal, discount, roundOff } = computeInvoiceTotals(invoice);
  const clientName = getClientName(clients, invoice.clientId);
  const formattedClientName = formatClientName(clientName);
  const canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
  const canRecordPayment = ledgerInfo?.status !== "received";
  const latestPayment = [...invoicePayments].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  )[0];
  const paidAmount = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, total - paidAmount);

  const overdueSeverity = ledgerInfo?.status === "overdue" ? getOverdueSeverity(ledgerInfo.daysOverdue) : null;
  const isOverdueMild = overdueSeverity === "mild";
  const isOverdueStrong = overdueSeverity === "strong";
  const isOverdueCritical = overdueSeverity === "critical";

  const quickBtn =
    "flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors duration-micro hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className={cn("group border-b border-border last:border-b-0", isExpanded && "bg-canvas/60")}>
      {/* Main row */}
      <div
        className={cn(
          "relative grid items-center gap-3 px-5 py-3.5 transition-colors duration-micro hover:bg-canvas/70",
          isSelected && "bg-accent/[0.06]",
        )}
        style={{ gridTemplateColumns: INVOICE_GRID }}
      >
        <label className="flex cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 shrink-0 rounded border-border-strong accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Select invoice ${invoice.number}`}
          />
          <span className="sr-only">Select invoice {invoice.number}</span>
        </label>

        <div className="min-w-0">
          <InvoiceNumberLink invoice={invoice} className="font-tabular truncate text-sm font-medium text-ink" />
          <p className="mt-0.5 text-[11px] text-ink-faint">{formatDate(invoice.issueDate)}</p>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 items-center gap-3 text-left outline-none"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} invoice ${invoice.number}`}
        >
          <Avatar name={clientName} />
          <span className="truncate text-sm font-medium text-ink">{formattedClientName}</span>
        </button>

        <div className="whitespace-nowrap">
          <span className="text-sm text-ink-muted">{formatDate(invoice.dueDate)}</span>
          {ledgerInfo?.status === "overdue" && (
            <span
              className={cn(
                "mt-0.5 block text-[11px] font-medium",
                isOverdueMild && "text-caution",
                isOverdueStrong && "text-overdue",
                isOverdueCritical && "text-overdue-strong",
              )}
            >
              {ledgerInfo.daysOverdue === 1 ? "1 day overdue" : `${ledgerInfo.daysOverdue} days overdue`}
            </span>
          )}
        </div>

        <div className="font-tabular whitespace-nowrap text-right">
          <span className="text-sm font-semibold text-ink">{formatCurrency(total)}</span>
          {balanceDue > 0 && ledgerInfo?.status !== "received" && (
            <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">Balance: {formatCurrency(balanceDue)}</span>
          )}
        </div>

        <div className="flex items-center">
          {isDraft ? (
            <StatusChip info={info!} />
          ) : ledgerInfo ? (
            <LedgerStatusChip
              info={{ ...ledgerInfo, severity: isOverdueCritical ? "strong" : ledgerInfo.severity }}
              className={cn(
                isOverdueMild && "bg-caution-bg text-caution border-caution/20",
                isOverdueStrong && "bg-overdue-bg text-overdue border-overdue/20",
                isOverdueCritical && "bg-overdue-strong-bg text-overdue-strong border-overdue-strong/20",
              )}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-0.5">
          {!isDraft && ledgerInfo?.status !== "received" && (
            <span className="flex items-center opacity-0 transition-opacity duration-micro focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAction?.("download", invoice);
                }}
                disabled={busy}
                className={quickBtn}
                aria-label={`Download PDF for ${invoice.number}`}
              >
                <FileText size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAction?.("remind", invoice);
                }}
                disabled={busy || !canRemind}
                className={quickBtn}
                aria-label={`Send reminder for ${invoice.number}`}
              >
                <BellRing size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAction?.("payment", invoice);
                }}
                disabled={busy || !canRecordPayment}
                className={quickBtn}
                aria-label={`Record payment for ${invoice.number}`}
              >
                <IndianRupee size={14} />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} invoice details for ${invoice.number}`}
            aria-expanded={isExpanded}
          >
            <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform duration-micro", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Expanded: flat, divided sections instead of nested boxes */}
      {isExpanded && (
        <div className="border-t border-border px-5 pb-6 pt-5">
          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-7">
              <section>
                <h4 className={SECTION_TITLE}>Line items</h4>
                <ul className="divide-y divide-border text-sm">
                  {invoice.items.map((item, idx) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-[11px] text-ink-faint">{idx + 1}</span>
                        <span className="truncate text-ink">{item.description}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-4 text-right">
                        <span className="font-tabular text-ink-muted">
                          {item.quantity} × {formatCurrency(item.unitPrice, true)}
                        </span>
                        <span className="font-tabular w-24 font-medium text-ink">{formatCurrency(item.quantity * item.unitPrice, true)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-1 space-y-1 border-t border-border pt-3 text-sm">
                  {discount > 0 && (
                    <div className="flex justify-between text-caution">
                      <dt>Discount</dt>
                      <dd className="font-tabular font-medium">-{formatCurrency(discount, true)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-ink-muted">
                    <dt>Taxable value</dt>
                    <dd className="font-tabular">{formatCurrency(Math.max(0, subtotal - discount), true)}</dd>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <dt>CGST ({Math.round(invoice.gst.cgstRate * 100)}%)</dt>
                    <dd className="font-tabular">{formatCurrency(cgstAmount, true)}</dd>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <dt>SGST ({Math.round(invoice.gst.sgstRate * 100)}%)</dt>
                    <dd className="font-tabular">{formatCurrency(sgstAmount, true)}</dd>
                  </div>
                  {roundOff !== 0 && (
                    <div className="flex justify-between text-ink-muted">
                      <dt>Round-off</dt>
                      <dd className="font-tabular">{formatCurrency(roundOff, true)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-ink">
                    <dt>Total</dt>
                    <dd className="font-tabular">{formatCurrency(total)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h4 className={SECTION_TITLE}>Payment history</h4>
                {invoicePayments.length === 0 ? (
                  <p className="text-sm text-ink-muted">No payments recorded</p>
                ) : (
                  <div>
                    <ul className="divide-y divide-border">
                      {invoicePayments
                        .slice()
                        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
                        .map((payment) => (
                          <li key={payment.id} className="flex items-center justify-between gap-2 py-2.5">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                                  payment.method === "cash" && "bg-neutral-bg text-neutral",
                                  payment.method === "bank_transfer" && "bg-pending-bg text-pending",
                                  payment.method === "upi" && "bg-caution-bg text-caution",
                                  payment.method === "cheque" && "bg-overdue-bg text-overdue",
                                  payment.method === "card" && "bg-success-bg text-success",
                                )}
                              >
                                {payment.method.replace("_", " ").toUpperCase()}
                              </span>
                              <span className="text-sm text-ink-muted">{formatDate(payment.receivedAt)}</span>
                            </span>
                            <span className="font-tabular text-sm font-medium text-success">{formatCurrency(payment.amount)}</span>
                          </li>
                        ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-border pt-2.5 text-sm">
                      <span className="font-medium text-ink">Total received</span>
                      <span className="font-tabular font-medium text-success">{formatCurrency(paidAmount)}</span>
                    </div>
                    {balanceDue > 0 && (
                      <div className="mt-1 flex items-center justify-between text-sm font-medium text-overdue">
                        <span>Balance due</span>
                        <span className="font-tabular">{formatCurrency(balanceDue)}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <div className="max-w-md">
                <MiniTimeline invoice={invoice} info={isDraft ? info! : ledgerInfo!} finalDate={isDraft ? undefined : latestPayment?.receivedAt} />
              </div>
              <div className="flex flex-wrap gap-2">
                {isDraft ? (
                  <>
                    <Button size="sm" onClick={onEdit} disabled={busy}>
                      <Pencil size={13} /> Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
                      <CheckCircle2 size={13} /> Bill invoice
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={onView} disabled={busy}>
                      <Eye size={13} /> View
                    </Button>
                    {!invoice.sentAt && (
                      <Button size="sm" variant="secondary" onClick={onSendInvoice} disabled={busy}>
                        <Send size={13} /> Send invoice
                      </Button>
                    )}
                    {canRemind && (
                      <Button size="sm" variant="secondary" onClick={onSendReminder} disabled={busy}>
                        <BellRing size={13} /> Send reminder
                      </Button>
                    )}
                    {canRecordPayment && (
                      <Button size="sm" variant="secondary" onClick={onRecordPayment} disabled={busy}>
                        <IndianRupee size={13} /> Record payment
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" variant="secondary" disabled title="PDF export is available from the invoice page">
                  <Download size={13} /> Download
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy} className="text-overdue hover:bg-overdue-bg hover:text-overdue">
                  <Trash2 size={13} aria-hidden /> Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
