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
import { MiniTimeline } from "./MiniTimeline";
import { cn } from "@/lib/cn";

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

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
  const initials = getInitials(clientName);
  const canRemind = ledgerInfo?.status === "outstanding" || ledgerInfo?.status === "overdue";
  const canRecordPayment = ledgerInfo?.status !== "received";
  const latestPayment = [...invoicePayments].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  )[0];
  const paidAmount = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, total - paidAmount);

  // Compute overdue severity for display
  const overdueSeverity = ledgerInfo?.status === "overdue" ? getOverdueSeverity(ledgerInfo.daysOverdue) : null;
  const isOverdueMild = overdueSeverity === "mild";
  const isOverdueStrong = overdueSeverity === "strong";
  const isOverdueCritical = overdueSeverity === "critical";

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Main Row */}
      <div
        className={cn(
          "grid gap-3 px-4 py-3 items-center transition-colors duration-micro relative overflow-hidden",
          "hover:bg-canvas hover:shadow-sm",
          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-transparent before:transition-colors before:duration-micro",
          "hover:before:bg-accent",
          isSelected && "bg-accent/5",
          "grid-cols-[24px_110px_1fr_120px_130px_170px_40px]"
        )}
        style={{ gridTemplateColumns: "24px 110px 1fr 120px 130px 170px 40px" }}
      >
        {/* Checkbox */}
        <label className="flex items-center justify-center cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 shrink-0 rounded border-border-strong text-accent accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Select invoice ${invoice.number}`}
          />
          <span className="sr-only">Select invoice {invoice.number}</span>
        </label>

        {/* Invoice Number */}
        <div className="flex items-center">
          <InvoiceNumberLink invoice={invoice} className="font-tabular font-medium text-ink truncate" />
        </div>

        {/* Client Cell with Avatar */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-3 min-w-0 truncate text-left hover:text-ink transition-colors duration-micro focus-visible:outline-none"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} invoice ${invoice.number}`}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-premium/10 text-premium font-medium text-sm items-center justify-center flex"
            aria-hidden="true"
          >
            {initials}
          </div>
          <span className="truncate font-medium text-ink text-sm">{formattedClientName}</span>
        </button>

        {/* Due Date with Overdue Day Count */}
        <div className="flex flex-col items-start gap-0.5 whitespace-nowrap shrink-0">
          <span className="text-ink-muted text-sm">{formatDate(invoice.dueDate)}</span>
          {ledgerInfo?.status === "overdue" && (
            <span
              className={cn(
                "text-[11px] font-medium",
                isOverdueMild && "text-caution",
                isOverdueStrong && "text-overdue",
                isOverdueCritical && "text-overdue-strong",
              )}
            >
              {ledgerInfo.daysOverdue === 1 ? "1 day overdue" : `${ledgerInfo.daysOverdue} days overdue`}
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="font-tabular whitespace-nowrap shrink-0 text-right">
          <span className="font-semibold text-ink text-sm">{formatCurrency(total)}</span>
          {balanceDue > 0 && ledgerInfo?.status !== "received" && (
            <span className="block text-[11px] text-ink-muted mt-0.5 font-normal">
              Balance: {formatCurrency(balanceDue)}
            </span>
          )}
        </div>

        {/* Status Pill */}
        <div className="flex items-center justify-center min-w-[140px]">
          {isDraft ? (
            <StatusChip info={info!} />
          ) : ledgerInfo ? (
            <LedgerStatusChip
              info={{
                ...ledgerInfo,
                severity: isOverdueCritical ? "strong" : ledgerInfo.severity,
              }}
              className={cn(
                "min-w-[140px] justify-center",
                isOverdueMild && "bg-caution-bg text-caution border-caution/20",
                isOverdueStrong && "bg-overdue-bg text-overdue border-overdue/20",
                isOverdueCritical && "bg-overdue-strong-bg text-overdue-strong border-overdue-strong/20",
              )}
            />
          ) : null}
        </div>

        {/* Chevron / Expand */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-faint hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} invoice details for ${invoice.number}`}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("transition-transform duration-micro", isExpanded && "rotate-180")}
          />
        </button>

        {/* Quick Actions on Hover - Desktop only */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-opacity duration-micro group-hover:opacity-100 pointer-events-none">
          {!isDraft && ledgerInfo?.status !== "received" && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAction?.("download", invoice);
                }}
                disabled={busy}
                className="p-1.5 rounded-lg bg-surface border border-border text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro disabled:opacity-50"
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
                className="p-1.5 rounded-lg bg-surface border border-border text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro disabled:opacity-50"
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
                className="p-1.5 rounded-lg bg-surface border border-border text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro disabled:opacity-50"
                aria-label={`Record payment for ${invoice.number}`}
              >
                <IndianRupee size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Row */}
      {isExpanded && (
        <div className="border-t border-border bg-canvas/50 px-4 pb-4 animate-in slide-in-from-top-2 duration-micro">
          <div className="grid gap-4 md:grid-cols-3 pt-3">
            {/* Mini Breakdown: Items, CGST/SGST, Balance Due, Payment History */}
            <div className="md:col-span-2 space-y-3">
              {/* Line Items Summary */}
              <div className="rounded-lg border border-border bg-surface p-3">
                <h4 className="mb-2 font-medium text-ink text-sm uppercase tracking-wider">Line items</h4>
                <div className="space-y-1.5 text-sm">
                  {invoice.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-ink-muted font-mono text-[11px]">{idx + 1}</span>
                        <span className="truncate text-ink">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-ink-muted font-tabular">
                          {item.quantity} × {formatCurrency(item.unitPrice, true)}
                        </span>
                        <span className="font-tabular font-medium text-ink">
                          {formatCurrency(item.quantity * item.unitPrice, true)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {discount > 0 && (
                    <div className="flex items-center justify-between gap-2 py-1 text-caution">
                      <span>Discount</span>
                      <span className="font-tabular font-medium">-{formatCurrency(discount, true)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 py-1 text-ink-muted">
                    <span>Taxable value</span>
                    <span className="font-tabular">{formatCurrency(Math.max(0, subtotal - discount), true)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-1 text-ink-muted">
                    <span>CGST ({Math.round(invoice.gst.cgstRate * 100)}%)</span>
                    <span className="font-tabular">{formatCurrency(cgstAmount, true)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-1 text-ink-muted">
                    <span>SGST ({Math.round(invoice.gst.sgstRate * 100)}%)</span>
                    <span className="font-tabular">{formatCurrency(sgstAmount, true)}</span>
                  </div>
                  {roundOff !== 0 && (
                    <div className="flex items-center justify-between gap-2 py-1 text-ink-muted">
                      <span>Round-off</span>
                      <span className="font-tabular">{formatCurrency(roundOff, true)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 py-1.5 border-t border-border text-ink font-medium">
                    <span>Total</span>
                    <span className="font-tabular">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment History & Balance Due */}
              <div className="rounded-lg border border-border bg-surface p-3">
                <h4 className="mb-2 font-medium text-ink text-sm uppercase tracking-wider">Payment history</h4>
                {invoicePayments.length === 0 ? (
                  <p className="text-sm text-ink-muted">No payments recorded</p>
                ) : (
                  <div className="space-y-2">
                    {invoicePayments
                      .slice()
                      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
                      .map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-md bg-canvas/50"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
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
                          </div>
                          <span className="font-tabular font-medium text-success">{formatCurrency(payment.amount)}</span>
                        </div>
                      ))}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <span className="font-medium text-ink">Total received</span>
                      <span className="font-tabular font-medium text-success">{formatCurrency(paidAmount)}</span>
                    </div>
                    {balanceDue > 0 && (
                      <div className="flex items-center justify-between gap-2 pt-1 text-overdue font-medium">
                        <span>Balance due</span>
                        <span className="font-tabular">{formatCurrency(balanceDue)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline & Actions */}
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface p-3 max-w-md">
                <MiniTimeline
                  invoice={invoice}
                  info={isDraft ? info! : ledgerInfo!}
                  finalDate={isDraft ? undefined : latestPayment?.receivedAt}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {isDraft ? (
                  <>
                    <button
                      type="button"
                      onClick={onEdit}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-micro hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={onEdit}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCircle2 size={12} /> Bill invoice
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onView}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Eye size={12} /> View
                    </button>
                    {!invoice.sentAt && (
                      <button
                        type="button"
                        onClick={onSendInvoice}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send size={12} /> Send invoice
                      </button>
                    )}
                    {canRemind && (
                      <button
                        type="button"
                        onClick={onSendReminder}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <BellRing size={12} /> Send reminder
                      </button>
                    )}
                    {canRecordPayment && (
                      <button
                        type="button"
                        onClick={onRecordPayment}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-micro hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <IndianRupee size={12} /> Record payment
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  disabled
                  title="PDF export — Phase 4"
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-faint opacity-50"
                >
                  <Download size={12} /> Download
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-overdue/30 bg-surface px-2.5 py-1.5 text-xs font-medium text-overdue transition-colors duration-micro hover:border-overdue/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={12} aria-hidden /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}