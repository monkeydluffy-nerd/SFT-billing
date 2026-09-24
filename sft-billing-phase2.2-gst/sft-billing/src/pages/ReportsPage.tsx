import { useMemo, useState } from "react";
import { AlertTriangle, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { StatusChip } from "@/components/shared/StatusChip";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { ReportTypeTabs } from "@/components/reports/ReportTypeTabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportSummary } from "@/components/reports/ReportSummary";
import { currencyItem, countItem } from "@/lib/reportSummaryItems";
import { ReportTable } from "@/components/reports/ReportTable";
import { ExportBar } from "@/components/reports/ExportBar";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import {
  defaultFilters,
  type ReportId,
  type ReportFilterState,
  filterInvoices,
  filterPayments,
  computeRevenueSummary,
  computeInvoiceSummary,
  computePaymentSummary,
  computeOutstandingSummary,
  computeOverdueSummary,
  computeClientSummaryTotals,
  buildInvoiceReportRows,
  buildPaymentReportRows,
  buildOutstandingReportRows,
  buildClientSummaryRows,
  REPORT_DEFINITIONS,
} from "@/lib/reports";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { downloadCsv } from "@/lib/csvExport";
import { Toast } from "@/components/shared/Toast";

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
};

export function ReportsPage() {
  const { data: invoices, loading: invoicesLoading, error } = useInvoices();
  const { data: clients } = useClients();
  const { data: payments } = usePayments();

  const now = useMemo(() => new Date(), []);
  const [reportId, setReportId] = useState<ReportId>("revenue");
  const [filters, setFilters] = useState<ReportFilterState>(() => defaultFilters(now));
  const [toast, setToast] = useState<string | null>(null);

  const loading = invoicesLoading || !invoices || !clients || !payments;

  const filteredInvoices = useMemo(
    () => (invoices ? filterInvoices(invoices, filters, now) : []),
    [invoices, filters, now],
  );
  const filteredPayments = useMemo(
    () => (payments ? filterPayments(payments, filters) : []),
    [payments, filters],
  );

  const invoiceRows = useMemo(
    () => buildInvoiceReportRows(filteredInvoices, clients ?? [], now),
    [filteredInvoices, clients, now],
  );
  const paymentRows = useMemo(
    () => buildPaymentReportRows(filteredPayments, invoices ?? [], clients ?? []),
    [filteredPayments, invoices, clients],
  );
  const outstandingRows = useMemo(
    () => buildOutstandingReportRows(filteredInvoices, filteredPayments, clients ?? [], now),
    [filteredInvoices, filteredPayments, clients, now],
  );
  const overdueRows = useMemo(
    () => outstandingRows.filter((row) => row.status === "overdue"),
    [outstandingRows],
  );
  const clientSummaryRows = useMemo(
    () => buildClientSummaryRows(filteredInvoices, filteredPayments, clients ?? [], now),
    [filteredInvoices, filteredPayments, clients, now],
  );

  // Per-report summaries - each report type shows only what's relevant to it.
  const revenueSummary = useMemo(() => computeRevenueSummary(filteredInvoices, filteredPayments, now), [filteredInvoices, filteredPayments, now]);
  const invoiceSummary = useMemo(() => computeInvoiceSummary(filteredInvoices, now), [filteredInvoices, now]);
  const paymentSummary = useMemo(() => computePaymentSummary(filteredPayments), [filteredPayments]);
  const outstandingSummary = useMemo(() => computeOutstandingSummary(filteredInvoices, filteredPayments, now), [filteredInvoices, filteredPayments, now]);
  const overdueSummary = useMemo(() => computeOverdueSummary(filteredInvoices, now), [filteredInvoices, now]);
  const clientSummaryTotals = useMemo(() => computeClientSummaryTotals(clientSummaryRows), [clientSummaryRows]);

  const activeDefinition = REPORT_DEFINITIONS.find((r) => r.id === reportId)!;

  function handleExportExcel() {
    setToast("Report-level Excel export isn't available yet. Try CSV export, or use Download Invoice for a single invoice.");
  }

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    switch (reportId) {
      case "invoices":
        downloadCsv(
          "invoice-report.csv",
          ["Invoice", "Client", "Date", "Due date", "Amount", "Status"],
          invoiceRows.map((r) => [r.number, r.clientName, formatDate(r.issueDate), formatDate(r.dueDate), r.amount, r.status]),
        );
        break;
      case "payments":
        downloadCsv(
          "payment-report.csv",
          ["Payment", "Invoice", "Client", "Date", "Amount", "Method"],
          paymentRows.map((r) => [r.id, r.invoiceNumber, r.clientName, formatDate(r.receivedAt), r.amount, METHOD_LABELS[r.method] ?? r.method]),
        );
        break;
      case "outstanding":
        downloadCsv(
          "outstanding-report.csv",
          ["Client", "Invoice", "Total", "Paid", "Outstanding", "Due date", "Status"],
          outstandingRows.map((r) => [r.clientName, r.invoiceNumber, r.total, r.paid, r.outstanding, formatDate(r.dueDate), r.status]),
        );
        break;
      case "overdue":
        downloadCsv(
          "overdue-report.csv",
          ["Client", "Invoice", "Total", "Paid", "Outstanding", "Due date"],
          overdueRows.map((r) => [r.clientName, r.invoiceNumber, r.total, r.paid, r.outstanding, formatDate(r.dueDate)]),
        );
        break;
      case "client-summary":
        downloadCsv(
          "client-summary-report.csv",
          ["Client", "Invoices", "Total billed", "Total received", "Outstanding"],
          clientSummaryRows.map((r) => [r.clientName, r.invoiceCount, r.totalBilled, r.totalCollected, r.outstanding]),
        );
        break;
      case "revenue":
        downloadCsv(
          "revenue-report.csv",
          ["Metric", "Value"],
          [
            ["Billed", revenueSummary.billed],
            ["Received", revenueSummary.collected],
            ["Outstanding", revenueSummary.outstanding],
          ],
        );
        break;
    }
    setToast("CSV export downloaded.");
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="A clear view of your billing and financial activity" />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load reports" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="A clear view of your billing and financial activity" />

      <div className="px-10 py-8">
        {loading ? (
          <OverviewSkeleton />
        ) : (
          <div className="space-y-6">
            <ReportTypeTabs active={reportId} onSelect={setReportId} />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <ReportFilters filters={filters} onChange={setFilters} clients={clients} />
              <ExportBar onExportExcel={handleExportExcel} onExportCsv={handleExportCsv} onPrint={handlePrint} />
            </div>

            <div>
              <p className="text-sm font-medium text-ink">{activeDefinition.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{activeDefinition.description}</p>
            </div>

            {reportId === "revenue" && (
              <ReportSummary
                items={[
                  currencyItem("Billed", revenueSummary.billed),
                  currencyItem("Received", revenueSummary.collected),
                  currencyItem("Outstanding", revenueSummary.outstanding, revenueSummary.outstanding > 0),
                ]}
              />
            )}
            {reportId === "invoices" && (
              <ReportSummary
                items={[
                  countItem("Invoices", invoiceSummary.count),
                  currencyItem("Total amount", invoiceSummary.totalAmount),
                  countItem("Overdue", invoiceSummary.overdueCount),
                ]}
              />
            )}
            {reportId === "payments" && (
              <ReportSummary
                items={[
                  countItem("Payments received", paymentSummary.count),
                  currencyItem("Total received", paymentSummary.totalCollected),
                  currencyItem("Average payment", paymentSummary.averagePayment),
                ]}
              />
            )}
            {reportId === "outstanding" && (
              <ReportSummary
                items={[
                  currencyItem("Outstanding amount", outstandingSummary.totalOutstanding, outstandingSummary.totalOutstanding > 0),
                  countItem("Invoices", outstandingSummary.invoiceCount),
                  countItem("Clients affected", outstandingSummary.clientsAffected),
                ]}
              />
            )}
            {reportId === "overdue" && (
              <ReportSummary
                items={[
                  currencyItem("Overdue amount", overdueSummary.totalOverdue, overdueSummary.totalOverdue > 0),
                  countItem("Overdue invoices", overdueSummary.invoiceCount),
                  countItem("Oldest (days overdue)", overdueSummary.oldestDaysOverdue),
                ]}
              />
            )}
            {reportId === "client-summary" && (
              <ReportSummary
                items={[
                  countItem("Clients", clientSummaryTotals.clientCount),
                  currencyItem("Total billed", clientSummaryTotals.totalBilled),
                  currencyItem("Total outstanding", clientSummaryTotals.totalOutstanding, clientSummaryTotals.totalOutstanding > 0),
                ]}
              />
            )}

            {reportId === "revenue" && (
              invoiceRows.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="No revenue in this period"
                  description="No invoices were issued in the selected range. Try a wider date preset, or come back once you've billed some clients."
                />
              ) : (
                <ReportTable
                  columns={[
                    { key: "number", label: "Invoice" },
                    { key: "client", label: "Client" },
                    { key: "date", label: "Date" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "status", label: "Status" },
                  ]}
                  rows={invoiceRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-accent">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.number }} className="text-accent" />
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{r.clientName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(r.issueDate)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2.5">
                        <StatusChip
                          info={{ status: r.status, daysOverdue: 0, severity: null }}
                          labelOverride={r.status === "pending" ? "Outstanding" : undefined}
                        />
                      </td>
                    </>
                  )}
                />
              )
            )}

            {reportId === "invoices" && (
              invoiceRows.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="No invoices match these filters"
                  description="Try a wider date preset, or clear the client/status filters."
                />
              ) : (
                <ReportTable
                  columns={[
                    { key: "number", label: "Invoice" },
                    { key: "client", label: "Client" },
                    { key: "date", label: "Date" },
                    { key: "due", label: "Due date" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "status", label: "Status" },
                  ]}
                  rows={invoiceRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-accent">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.number }} className="text-accent" />
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{r.clientName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(r.issueDate)}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(r.dueDate)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2.5">
                        <StatusChip
                          info={{ status: r.status, daysOverdue: 0, severity: null }}
                          labelOverride={r.status === "pending" ? "Outstanding" : undefined}
                        />
                      </td>
                    </>
                  )}
                />
              )
            )}

            {reportId === "payments" && (
              paymentRows.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="No payments in this period"
                  description="No payments were recorded in the selected range. Record a payment from the Payments page to see it here."
                />
              ) : (
                <ReportTable
                  columns={[
                    { key: "id", label: "Payment" },
                    { key: "invoice", label: "Invoice" },
                    { key: "client", label: "Client" },
                    { key: "date", label: "Date" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "method", label: "Method" },
                  ]}
                  rows={paymentRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-ink">{r.id}</td>
                      <td className="px-4 py-2.5 text-accent">
                        {invoices?.some((invoice) => invoice.id === r.invoiceId) ? (
                          <InvoiceNumberLink
                            invoice={{ id: r.invoiceId, number: r.invoiceNumber }}
                            className="text-accent"
                          />
                        ) : (
                          r.invoiceNumber
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{r.clientName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(r.receivedAt)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-success">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{METHOD_LABELS[r.method] ?? r.method}</td>
                    </>
                  )}
                />
              )
            )}

            {reportId === "outstanding" && (
              outstandingRows.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="Nothing outstanding"
                  description="Every invoice in this period is either paid or still a draft. This report populates once invoices are sent and awaiting payment."
                />
              ) : (
                <ReportTable
                  columns={[
                    { key: "client", label: "Client" },
                    { key: "invoice", label: "Invoice" },
                    { key: "total", label: "Total", align: "right" },
                    { key: "paid", label: "Paid", align: "right" },
                    { key: "outstanding", label: "Outstanding", align: "right" },
                    { key: "due", label: "Due date" },
                    { key: "status", label: "Status" },
                  ]}
                  rows={outstandingRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 text-ink-muted">{r.clientName}</td>
                      <td className="px-4 py-2.5 font-medium text-accent">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} className="text-accent" />
                      </td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(r.total)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(r.paid)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right font-medium text-ink">{formatCurrency(r.outstanding)}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(r.dueDate)}</td>
                      <td className="px-4 py-2.5">
                        <StatusChip
                          info={{ status: r.status, daysOverdue: 0, severity: null }}
                          labelOverride={r.status === "pending" ? "Outstanding" : undefined}
                        />
                      </td>
                    </>
                  )}
                />
              )
            )}

            {reportId === "overdue" && (
              overdueRows.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="No overdue invoices"
                  description="Nothing is past its due date right now. This report lists overdue invoices, ranked by outstanding amount, as soon as one appears."
                />
              ) : (
                <ReportTable
                  columns={[
                    { key: "client", label: "Client" },
                    { key: "invoice", label: "Invoice" },
                    { key: "total", label: "Total", align: "right" },
                    { key: "paid", label: "Paid", align: "right" },
                    { key: "outstanding", label: "Outstanding", align: "right" },
                    { key: "due", label: "Due date" },
                  ]}
                  rows={overdueRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 text-ink-muted">{r.clientName}</td>
                      <td className="px-4 py-2.5 font-medium text-accent">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} className="text-accent" />
                      </td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(r.total)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(r.paid)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right font-medium text-overdue">{formatCurrency(r.outstanding)}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDate(r.dueDate)}</td>
                    </>
                  )}
                />
              )
            )}

            {reportId === "client-summary" && (
              clientSummaryRows.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="No client activity in this period"
                  description="No client has billing activity in the selected range yet."
                />
              ) : (
                <ReportTable
                  columns={[
                    { key: "client", label: "Client" },
                    { key: "invoices", label: "Invoices", align: "right" },
                    { key: "billed", label: "Total billed", align: "right" },
                    { key: "collected", label: "Total received", align: "right" },
                    { key: "outstanding", label: "Outstanding", align: "right" },
                  ]}
                  rows={clientSummaryRows}
                  rowKey={(r) => r.clientId}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-ink">{r.clientName}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted">{r.invoiceCount}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted">{formatCurrency(r.totalBilled)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-success">{formatCurrency(r.totalCollected)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right font-medium text-ink">{formatCurrency(r.outstanding)}</td>
                    </>
                  )}
                />
              )
            )}
          </div>
        )}
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}