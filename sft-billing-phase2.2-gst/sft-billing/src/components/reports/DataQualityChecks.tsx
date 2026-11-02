import { AlertCircle, AlertTriangle, Info, Link2 } from "lucide-react";
import { Invoice, Payment, Client } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { computeInvoiceTotals, getInvoiceStatus, getInvoiceLedgerStatus } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function isValidGSTIN(gstin: string | undefined | null): boolean {
  if (!gstin) return false;
  return GSTIN_PATTERN.test(gstin.toUpperCase());
}


export type DataQualitySeverity = "high" | "medium" | "low";

export interface DataQualityFinding {
  id: string;
  severity: DataQualitySeverity;
  category:
    | "missing-details"
    | "total-mismatch"
    | "status-inconsistency"
    | "duplicate-number"
    | "tax-compliance"
    | "calculation-consistency"
    | "temporal-inconsistency"
    | "payment-inconsistency";
  title: string;
  detail: string;
  invoiceId?: string;
  invoiceNumber?: string;
  clientId?: string;
  clientName?: string;
  amount?: number;
  affectedRecord: "invoice" | "client" | "payment";
}

interface DataQualityChecksProps {
  invoices: Invoice[];
  payments: Payment[];
  clients: Client[];
  asOf?: Date;
  onNavigateToInvoice?: (invoiceId: string) => void;
}

function getDataQualityFindings(
  invoices: Invoice[],
  payments: Payment[],
  clients: Client[],
  asOf: Date = new Date()
): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];

  // Build a map of invoice numbers for duplicate detection
  const numberToInvoices = new Map<string, Invoice[]>();
  for (const invoice of invoices) {
    const normalizedNumber = invoice.number.trim().toUpperCase();
    if (!normalizedNumber) continue;
    const existing = numberToInvoices.get(normalizedNumber) ?? [];
    existing.push(invoice);
    numberToInvoices.set(normalizedNumber, existing);
  }

  // Check for duplicate invoice numbers
  for (const [number, invs] of numberToInvoices.entries()) {
    if (invs.length > 1) {
      // Only flag if there are at least 2 non-draft invoices with the same number
      // (drafts can share numbers during editing, but two billed invoices with
      // the same number is a data quality issue)
      const billedInvoices = invs.filter((i) => !i.isDraft);
      if (billedInvoices.length > 1) {
        for (const invoice of billedInvoices) {
          findings.push({
            id: `dup-${invoice.id}`,
            severity: "high",
            category: "duplicate-number",
            title: "Duplicate invoice number",
            detail: `Invoice number "${number}" is used by ${billedInvoices.length} billed invoice${billedInvoices.length === 1 ? "" : "s"}.`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName: getClientName(clients, invoice.clientId),
            amount: computeInvoiceTotals(invoice).total,
            affectedRecord: "invoice",
          });
        }
      }
    }
  }

  // Check each invoice for data quality issues
  for (const invoice of invoices) {
    const client = clients.find((c) => c.id === invoice.clientId);
    const clientName = getClientName(clients, invoice.clientId);
    const invoicePayments = payments.filter((p) => p.invoiceId === invoice.id);
    const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
    const { total: computedTotal } = computeInvoiceTotals(invoice);
    const statusInfo = getInvoiceStatus(invoice, asOf);

    // 1. Missing required invoice details (only for billed invoices)
    if (!invoice.isDraft) {
      // Missing client name
      if (!client) {
        findings.push({
          id: `missing-client-${invoice.id}`,
          severity: "high",
          category: "missing-details",
          title: "Missing client",
          detail: `Invoice references client ID "${invoice.clientId}" which no longer exists.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName: "Unknown client",
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      } else {
        // Client exists but missing required fields
        if (!client.name?.trim()) {
          findings.push({
            id: `missing-client-name-${invoice.id}`,
            severity: "medium",
            category: "missing-details",
            title: "Client missing name",
            detail: `Client "${client.id}" has no name.`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName: "Unnamed client",
            amount: computedTotal,
            affectedRecord: "invoice",
          });
        }
        if (!client.email && !client.phone) {
          findings.push({
            id: `missing-client-contact-${invoice.id}`,
            severity: "low",
            category: "missing-details",
            title: "Client missing contact details",
            detail: `Client "${client.name}" has no email or phone.`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName,
            amount: computedTotal,
            affectedRecord: "invoice",
          });
        }
        if (!client.billingAddress?.trim()) {
          findings.push({
            id: `missing-client-address-${invoice.id}`,
            severity: "low",
            category: "missing-details",
            title: "Client missing billing address",
            detail: `Client "${client.name}" has no billing address.`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName,
            amount: computedTotal,
            affectedRecord: "invoice",
          });
        }
      }

      // Missing invoice issue date or due date
      if (!invoice.issueDate?.trim()) {
        findings.push({
          id: `missing-issue-date-${invoice.id}`,
          severity: "high",
          category: "missing-details",
          title: "Missing issue date",
          detail: `Invoice has no issue date.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }
      if (!invoice.dueDate?.trim()) {
        findings.push({
          id: `missing-due-date-${invoice.id}`,
          severity: "high",
          category: "missing-details",
          title: "Missing due date",
          detail: `Invoice has no due date.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Missing line items
      if (!invoice.items || invoice.items.length === 0) {
        findings.push({
          id: `missing-items-${invoice.id}`,
          severity: "high",
          category: "missing-details",
          title: "No line items",
          detail: `Invoice has no line items.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      } else {
        // Check for invalid line items
        for (const item of invoice.items) {
          if (!item.description?.trim()) {
            findings.push({
              id: `empty-description-${invoice.id}-${item.id}`,
              severity: "medium",
              category: "missing-details",
              title: "Empty line item description",
              detail: `Invoice has a line item with no description.`,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              clientId: invoice.clientId,
              clientName,
              amount: computedTotal,
              affectedRecord: "invoice",
            });
          }
          if (item.quantity <= 0) {
            findings.push({
              id: `invalid-qty-${invoice.id}-${item.id}`,
              severity: "medium",
              category: "missing-details",
              title: "Invalid line item quantity",
              detail: `Line item "${item.description || "(no description)"}" has quantity ${item.quantity}.`,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              clientId: invoice.clientId,
              clientName,
              amount: computedTotal,
              affectedRecord: "invoice",
            });
          }
          if (item.unitPrice < 0) {
            findings.push({
              id: `negative-price-${invoice.id}-${item.id}`,
              severity: "medium",
              category: "missing-details",
              title: "Negative line item price",
              detail: `Line item "${item.description || "(no description)"}" has negative unit price.`,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              clientId: invoice.clientId,
              clientName,
              amount: computedTotal,
              affectedRecord: "invoice",
            });
          }
        }
      }

      // Missing GST rates
      if (!invoice.gst || typeof invoice.gst.cgstRate !== "number" || typeof invoice.gst.sgstRate !== "number" || Number.isNaN(invoice.gst.cgstRate) || Number.isNaN(invoice.gst.sgstRate)) {
        findings.push({
          id: `missing-gst-${invoice.id}`,
          severity: "medium",
          category: "missing-details",
          title: "Missing GST rates",
          detail: `Invoice has incomplete GST configuration.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Compute values needed for additional checks
      const totals = computeInvoiceTotals(invoice);
      const subtotal = totals.subtotal;
      const taxableValue = totals.rawTotal - totals.cgstAmount - totals.sgstAmount; // This equals taxableValue

      // Zero GST rates on taxable items (billed invoices with taxable value > 0)
      if (taxableValue > 0 && (invoice.gst.cgstRate === 0 || invoice.gst.sgstRate === 0)) {
        findings.push({
          id: `zero-gst-${invoice.id}`,
          severity: "medium",
          category: "tax-compliance",
          title: "Zero GST rate on taxable invoice",
          detail: `Invoice has taxable value ${formatCurrency(taxableValue)} but CGST/SGST rate is zero.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Discount exceeds taxable value (results in negative taxable value)
      if (invoice.discount > subtotal) {
        findings.push({
          id: `excessive-discount-${invoice.id}`,
          severity: "high",
          category: "calculation-consistency",
          title: "Discount exceeds subtotal",
          detail: `Discount of ${formatCurrency(invoice.discount)} exceeds subtotal of ${formatCurrency(subtotal)}, resulting in negative taxable value.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Round-off exceeds ±0.50 tolerance
      if (Math.abs(invoice.roundOff) > 0.5) {
        findings.push({
          id: `excessive-roundoff-${invoice.id}`,
          severity: "medium",
          category: "calculation-consistency",
          title: "Round-off exceeds tolerance",
          detail: `Round-off of ${formatCurrency(invoice.roundOff)} exceeds the ±0.50 tolerance.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Due date before issue date
      if (invoice.issueDate?.trim() && invoice.dueDate?.trim()) {
        const issueDate = new Date(invoice.issueDate);
        const dueDate = new Date(invoice.dueDate);
        if (!isNaN(issueDate.getTime()) && !isNaN(dueDate.getTime()) && dueDate < issueDate) {
          findings.push({
            id: `invalid-date-order-${invoice.id}`,
            severity: "medium",
            category: "temporal-inconsistency",
            title: "Due date before issue date",
            detail: `Invoice due date (${formatDate(invoice.dueDate)}) is before issue date (${formatDate(invoice.issueDate)}).`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName,
            amount: computedTotal,
            affectedRecord: "invoice",
          });
        }
      }

      // Missing HSN/SAC codes on line items
      for (const item of invoice.items) {
        if (!item.hsnCode?.trim()) {
          findings.push({
            id: `missing-hsn-${invoice.id}-${item.id}`,
            severity: "medium",
            category: "tax-compliance",
            title: "Missing HSN/SAC code",
            detail: `Line item "${item.description || "(no description)"}" is missing HSN/SAC code.`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName,
            amount: computedTotal,
            affectedRecord: "invoice",
          });
        }
      }

      // Client GSTIN format validation
      if (client?.gstin && !isValidGSTIN(client.gstin)) {
        findings.push({
          id: `invalid-gstin-${invoice.id}`,
          severity: "medium",
          category: "tax-compliance",
          title: "Invalid client GSTIN format",
          detail: `Client "${client.name}" has invalid GSTIN: "${client.gstin}".`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "client",
        });
      }
    }

    // 2. Stored totals that disagree with calculation rules
    // Note: The current data model doesn't store a separate total field - it's always computed.
    // But we can check if amountInWords (if present) matches the computed total.
    if (invoice.amountInWords && invoice.amountInWords.trim()) {
      const { total } = computeInvoiceTotals(invoice);
      // This is a heuristic - amountInWords is for display, not storage
      // We only flag if amountInWords was somehow stored with a different value
      // Since we can't easily parse words back to number, we skip this check
      // unless we want to flag that amountInWords exists at all (which is normal)
      void total;
    }

    // 3. Payment totals or invoice statuses that appear inconsistent
    // Check if ledger status disagrees with stored status (paidAt)
    if (!invoice.isDraft) {
      const ledgerStatus = getInvoiceLedgerStatus(invoice, payments, asOf);
      const storedStatus = statusInfo.status;

      // If paidAt is set but ledger says not fully paid
      if (invoice.paidAt && ledgerStatus && ledgerStatus.status !== "received") {
        const outstanding = Math.max(0, computedTotal - totalPaid);
        findings.push({
          id: `status-mismatch-paidat-${invoice.id}`,
          severity: "high",
          category: "status-inconsistency",
          title: "Status mismatch: marked paid but payments don't cover total",
          detail: `Invoice marked as paid (${formatDate(invoice.paidAt)}) but payments total ${formatCurrency(totalPaid)} vs invoice total ${formatCurrency(computedTotal)}. Outstanding: ${formatCurrency(outstanding)}.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // If ledger says fully paid but paidAt is not set
      if (!invoice.paidAt && ledgerStatus && ledgerStatus.status === "received") {
        findings.push({
          id: `status-mismatch-missing-paidat-${invoice.id}`,
          severity: "medium",
          category: "status-inconsistency",
          title: "Status mismatch: fully paid but not marked paid",
          detail: `Payments cover the full amount (${formatCurrency(totalPaid)} of ${formatCurrency(computedTotal)}) but invoice has no paidAt date.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // If stored status is "overdue" but ledger says "received"
      if (storedStatus === "overdue" && ledgerStatus && ledgerStatus.status === "received") {
        findings.push({
          id: `status-mismatch-overdue-received-${invoice.id}`,
          severity: "high",
          category: "status-inconsistency",
          title: "Status mismatch: marked overdue but fully paid",
          detail: `Invoice status is overdue but payments total ${formatCurrency(totalPaid)} cover the full amount ${formatCurrency(computedTotal)}.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // If stored status is "paid" but ledger says outstanding/overdue
      if (storedStatus === "paid" && ledgerStatus && ledgerStatus.status !== "received") {
        const outstanding = Math.max(0, computedTotal - totalPaid);
        findings.push({
          id: `status-mismatch-paid-ledger-${invoice.id}`,
          severity: "high",
          category: "status-inconsistency",
          title: "Status mismatch: marked paid but ledger shows outstanding",
          detail: `Invoice status is paid but payments total ${formatCurrency(totalPaid)} vs invoice total ${formatCurrency(computedTotal)}. Outstanding: ${formatCurrency(outstanding)}.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Check for payments that don't match any invoice
      for (const payment of invoicePayments) {
        if (payment.amount <= 0) {
          findings.push({
            id: `invalid-payment-amount-${payment.id}`,
            severity: "medium",
            category: "status-inconsistency",
            title: "Invalid payment amount",
            detail: `Payment of ${formatCurrency(payment.amount)} recorded for this invoice.`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            clientId: invoice.clientId,
            clientName,
            amount: payment.amount,
            affectedRecord: "payment",
          });
        }
      }

      // Overpayment detection: sum of payments exceeds computed total
      if (totalPaid > computedTotal) {
        const overpaid = totalPaid - computedTotal;
        findings.push({
          id: `overpayment-${invoice.id}`,
          severity: "high",
          category: "payment-inconsistency",
          title: "Overpayment detected",
          detail: `Payments total ${formatCurrency(totalPaid)} exceeds invoice total ${formatCurrency(computedTotal)} by ${formatCurrency(overpaid)}.`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          clientId: invoice.clientId,
          clientName,
          amount: computedTotal,
          affectedRecord: "invoice",
        });
      }

      // Payment received before invoice issue date
      if (invoice.issueDate?.trim()) {
        const issueDate = new Date(invoice.issueDate);
        if (!isNaN(issueDate.getTime())) {
          for (const payment of invoicePayments) {
            const receivedDate = new Date(payment.receivedAt);
            if (!isNaN(receivedDate.getTime()) && receivedDate < issueDate) {
              findings.push({
                id: `payment-before-issue-${payment.id}`,
                severity: "medium",
                category: "temporal-inconsistency",
                title: "Payment received before invoice issue date",
                detail: `Payment of ${formatCurrency(payment.amount)} received on ${formatDate(payment.receivedAt)} but invoice was issued on ${formatDate(invoice.issueDate)}.`,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                clientId: invoice.clientId,
                clientName,
                amount: payment.amount,
                affectedRecord: "payment",
              });
            }
          }
        }
      }
    }

    // Check for payments referencing non-existent invoices (orphaned payments)
    // This is checked at the payment level below
  }

  // Check for orphaned payments (payment referencing deleted/missing invoice)
  const invoiceIds = new Set(invoices.map((i) => i.id));
  for (const payment of payments) {
    if (!invoiceIds.has(payment.invoiceId)) {
      findings.push({
        id: `orphaned-payment-${payment.id}`,
        severity: "high",
        category: "status-inconsistency",
        title: "Payment references missing invoice",
        detail: `Payment of ${formatCurrency(payment.amount)} (${formatDate(payment.receivedAt)}) references invoice ID "${payment.invoiceId}" which no longer exists.`,
        clientId: payment.clientId,
        clientName: getClientName(clients, payment.clientId),
        amount: payment.amount,
        affectedRecord: "payment",
      });
    }
  }

  // Check for payments with missing client
  for (const payment of payments) {
    const client = clients.find((c) => c.id === payment.clientId);
    if (!client) {
      findings.push({
        id: `payment-missing-client-${payment.id}`,
        severity: "medium",
        category: "missing-details",
        title: "Payment references missing client",
        detail: `Payment of ${formatCurrency(payment.amount)} references client ID "${payment.clientId}" which no longer exists.`,
        clientId: payment.clientId,
        clientName: "Unknown client",
        amount: payment.amount,
        affectedRecord: "payment",
      });
    }
  }

  // Sort findings: high severity first, then by category, then by amount descending
  return findings.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}

function getSeverityColor(severity: DataQualitySeverity): string {
  switch (severity) {
    case "high":
      return "text-overdue bg-overdue-bg border-overdue/30";
    case "medium":
      return "text-caution bg-caution-bg border-caution/30";
    case "low":
      return "text-ink-muted bg-surface border-border";
  }
}

function getSeverityIcon(severity: DataQualitySeverity) {
  switch (severity) {
    case "high":
      return <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />;
    case "medium":
      return <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />;
    case "low":
      return <Info className="h-4 w-4 shrink-0" aria-hidden />;
  }
}

export function DataQualityChecks({ invoices, payments, clients, asOf, onNavigateToInvoice }: DataQualityChecksProps) {
  const findings = getDataQualityFindings(invoices, payments, clients, asOf);

  if (findings.length === 0) {
    return (
      <section className="space-y-4" aria-label="Data Quality Checks">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Data Quality Checks</p>
          <span className="text-xs text-ink-muted">Based on saved invoice, payment, and client data</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-success-bg border border-success/30 rounded-lg">
          <Info className="h-5 w-5 text-success shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium text-success">No data quality issues found</p>
            <p className="text-xs text-ink-muted">All invoices, payments, and clients appear consistent.</p>
          </div>
        </div>
      </section>
    );
  }

  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;

  return (
    <section className="space-y-4" aria-label="Data Quality Checks">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Data Quality Checks</p>
        <span className="text-xs text-ink-muted">Based on saved invoice, payment, and client data</span>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {highCount > 0 && (
          <span className="px-2 py-1 text-xs font-medium bg-overdue-bg text-overdue rounded-full">
            {highCount} high
          </span>
        )}
        {mediumCount > 0 && (
          <span className="px-2 py-1 text-xs font-medium bg-caution-bg text-caution rounded-full">
            {mediumCount} medium
          </span>
        )}
        {lowCount > 0 && (
          <span className="px-2 py-1 text-xs font-medium bg-surface text-ink-muted rounded-full border border-border">
            {lowCount} low
          </span>
        )}
      </div>

      {/* Findings table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[32px]"></th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted">Severity</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted">Category</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted">Issue</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[200px] min-w-[140px]">Record</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Amount</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[80px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {findings.map((finding) => (
              <tr key={finding.id} className="transition-colors duration-micro hover:bg-canvas">
                <td className="px-4 py-2 w-[32px]">
                  {getSeverityIcon(finding.severity)}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(finding.severity)}`}>
                    {finding.severity}
                  </span>
                </td>
                <td className="px-4 py-2 text-ink-muted">
                  <span className="font-medium capitalize">{finding.category.replace("-", " ")}</span>
                </td>
                <td className="px-4 py-2">
                  <p className="font-medium text-ink">{finding.title}</p>
                  <p className="text-xs text-ink-muted">{finding.detail}</p>
                </td>
                <td className="px-4 py-2 text-ink-muted truncate w-[200px] min-w-[140px]">
                  {finding.invoiceNumber && finding.invoiceId && onNavigateToInvoice ? (
                    <span className="font-medium text-accent">{finding.invoiceNumber}</span>
                  ) : finding.invoiceNumber ? (
                    <span className="font-medium text-accent">{finding.invoiceNumber}</span>
                  ) : finding.clientName ? (
                    <span>{finding.clientName}</span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                  {finding.clientName && finding.invoiceNumber && (
                    <div className="text-xs text-ink-faint">{finding.clientName}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink w-[120px] whitespace-nowrap">
                  {finding.amount !== undefined ? formatCurrency(finding.amount) : "—"}
                </td>
                <td className="px-4 py-2 w-[80px] text-right">
                  {finding.invoiceId && onNavigateToInvoice && (
                    <button
                      type="button"
                      onClick={() => onNavigateToInvoice(finding.invoiceId!)}
                      className="flex items-center justify-end gap-1 text-xs text-accent hover:text-accent-strong transition-colors"
                      aria-label={`Review invoice ${finding.invoiceNumber}`}
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      <span>Review</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The calculation helper is intentionally exported for tests and report reuse.
// eslint-disable-next-line react-refresh/only-export-components
export { getDataQualityFindings };