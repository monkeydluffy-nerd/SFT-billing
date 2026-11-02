import { useMemo, useState } from "react";
import { AlertTriangle, FileBarChart, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { StatusChip } from "@/components/shared/StatusChip";
import { InvoiceNumberLink } from "@/components/shared/InvoiceNumberLink";
import { ReportTypeTabs } from "@/components/reports/ReportTypeTabs";
import { ReportFilters, STATUS_OPTIONS } from "@/components/reports/ReportFilters";
import { ReportSummary, KPICard } from "@/components/reports/ReportSummary";
import { CollectionOutlook } from "@/components/reports/CollectionOutlook";
import { DataQualityChecks } from "@/components/reports/DataQualityChecks";
import { ClientTrends } from "@/components/reports/ClientTrends";
import { ProductSalesInsights } from "@/components/reports/ProductSalesInsights";
import { currencyItem, countItem } from "@/lib/reportSummaryItems";
import { ReportTable } from "@/components/reports/ReportTable";
import { ExportBar } from "@/components/reports/ExportBar";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { useProducts } from "@/hooks/useProducts";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
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
  DATE_PRESET_LABELS,
} from "@/lib/reports";
import {
  computeBusinessPulse,
  computeAttentionItems,
} from "@/lib/intelligence";
import { getComparablePeriodWindow } from "@/lib/periodComparison";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { downloadCsv } from "@/lib/csvExport";
import { Toast } from "@/components/shared/Toast";
import { PulseStat } from "@/components/intelligence/PulseStat";
import { AttentionList } from "@/components/intelligence/AttentionList";
import type { Payment, RecordPaymentResult } from "@/types";

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
};

export function ReportsPage() {
  const { data: invoices, loading: invoicesLoading, error, reload } = useInvoices();
  const { data: clients } = useClients();
  const { data: payments } = usePayments();
  const { data: products } = useProducts();
  const { navigateToInvoiceDetail } = useWorkspaceStore();

  const now = useMemo(() => new Date(), []);
  const [reportId, setReportId] = useState<ReportId>("revenue");
  const [filters, setFilters] = useState<ReportFilterState>(() => defaultFilters(now));
  const [recordOpen, setRecordOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<Payment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loading = invoicesLoading || !invoices || !clients || !payments;

  // Period window for trends (workspace-wide, not filtered)
  const periodWindow = useMemo(() => getComparablePeriodWindow(now), [now]);

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
  const billedInvoices = useMemo(
    () => (invoices ?? []).filter((invoice) => !invoice.isDraft),
    [invoices],
  );

  // Per-report summaries - each report type shows only what's relevant to it.
  const revenueSummary = useMemo(() => computeRevenueSummary(filteredInvoices, filteredPayments, now), [filteredInvoices, filteredPayments, now]);
  const invoiceSummary = useMemo(() => computeInvoiceSummary(filteredInvoices, now), [filteredInvoices, now]);
  const paymentSummary = useMemo(() => computePaymentSummary(filteredPayments), [filteredPayments]);
  const outstandingSummary = useMemo(() => computeOutstandingSummary(filteredInvoices, filteredPayments, now), [filteredInvoices, filteredPayments, now]);
  const overdueSummary = useMemo(() => computeOverdueSummary(filteredInvoices, filteredPayments, now), [filteredInvoices, filteredPayments, now]);
  const clientSummaryTotals = useMemo(() => computeClientSummaryTotals(clientSummaryRows), [clientSummaryRows]);

  // Business Pulse and Attention Center - use full dataset (not filtered) for cross-period comparisons
  const pulse = useMemo(
    () => (invoices && payments ? computeBusinessPulse(invoices, payments, now) : undefined),
    [invoices, payments, now],
  );
  const attentionItems = useMemo(
    () => (invoices && clients && payments ? computeAttentionItems(invoices, clients, payments, now) : []),
    [invoices, clients, payments, now],
  );

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

  function handlePersisted(result: RecordPaymentResult) {
    // reload is returned from useInvoices hook
    reload();
    setToast(`Payment of ${formatCurrency(result.payment.amount)} recorded`);
  }

  function closeRecordPayment() {
    setRecordOpen(false);
    setReplacementTarget(null);
  }

  function handleRecorded(result: RecordPaymentResult) {
    closeRecordPayment();
    setToast(`Payment of ${formatCurrency(result.payment.amount)} recorded`);
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

      <main className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12">
        {loading ? (
          <OverviewSkeleton />
        ) : (
          <div className="space-y-6">
            <ReportTypeTabs active={reportId} onSelect={setReportId} />

            {/* Filter toolbar — compact, responsive layout */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <ReportFilters filters={filters} onChange={setFilters} clients={clients} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ExportBar onExportExcel={handleExportExcel} onExportCsv={handleExportCsv} onPrint={handlePrint} />
              </div>
            </div>

            {/* Result context — shows active date range and filter state */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted px-4 py-3 rounded-lg bg-surface border border-border">
              <span className="font-medium text-ink">Showing:</span>
              <span>
                {filters.preset !== "custom"
                  ? DATE_PRESET_LABELS[filters.preset]
                  : `${filters.from ? formatDate(filters.from) : "start"} to ${filters.to ? formatDate(filters.to) : "now"}`}
              </span>
              {filters.clientId && (
                <>
                  <span className="text-ink-muted">|</span>
                  <span>
                    Client: {clients?.find((c) => c.id === filters.clientId)?.name ?? filters.clientId}
                  </span>
                </>
              )}
              {filters.status && (
                <>
                  <span className="text-ink-muted">|</span>
                  <span>
                    Status: {STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ?? filters.status}
                  </span>
                </>
              )}
              <span className="ml-auto text-ink-faint">
                {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* KPI Cards for Revenue report — three aligned cards with visual hierarchy */}
            {reportId === "revenue" && revenueSummary && (
              <section className="space-y-4" aria-label="Revenue KPIs">
                <p className="text-sm font-medium text-ink">Revenue Overview</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <KPICard
                    label="Billed"
                    value={formatCurrency(revenueSummary.billed)}
                    caution={revenueSummary.outstanding > 0}
                  />
                  <KPICard
                    label="Received"
                    value={formatCurrency(revenueSummary.collected)}
                  />
                  <KPICard
                    label="Outstanding"
                    value={formatCurrency(revenueSummary.outstanding)}
                    caution={revenueSummary.outstanding > 0}
                  />
                </div>
              </section>
            )}

            {/* Business Pulse — workspace-wide snapshot (all time), shown for non-Revenue reports */}
            {pulse && reportId !== "revenue" && (
              <section className="space-y-4" aria-label="Business Pulse">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Business Pulse</p>
                  <span className="text-xs text-ink-muted">Workspace-wide, all time</span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 sm:grid-cols-3 lg:grid-cols-6">
                  <PulseStat
                    label="Billed"
                    amount={pulse.billed.amount}
                    timeframe={pulse.periodLabel}
                    changePct={pulse.billed.comparable ? pulse.billed.changePct : undefined}
                    changeLabel={pulse.billed.comparable ? `vs ${pulse.comparableLabel}` : undefined}
                    comparisonUnavailable={pulse.hasComparableHistory && !pulse.billed.comparable}
                  />
                  <PulseStat
                    label="Received"
                    amount={pulse.collected.amount}
                    timeframe={pulse.periodLabel}
                    changePct={pulse.collected.comparable ? pulse.collected.changePct : undefined}
                    changeLabel={pulse.collected.comparable ? `vs ${pulse.comparableLabel}` : undefined}
                    comparisonUnavailable={pulse.hasComparableHistory && !pulse.collected.comparable}
                  />
                  <PulseStat
                    label="Outstanding"
                    amount={pulse.totalOutstanding}
                    timeframe={`${pulse.outstandingInvoiceCount} invoice${pulse.outstandingInvoiceCount === 1 ? "" : "s"} outstanding or overdue`}
                  />
                  <PulseStat
                    label="Overdue"
                    amount={pulse.totalOverdue}
                    tone="caution"
                    timeframe={`${pulse.overdueInvoiceCount} invoice${pulse.overdueInvoiceCount === 1 ? "" : "s"} past due`}
                  />
                  <PulseStat
                    label="Invoices issued"
                    display={String(pulse.invoicesIssuedThisPeriod)}
                    timeframe={pulse.periodLabel}
                  />
                  <PulseStat
                    label="Clients billed"
                    display={String(pulse.activeClientsThisPeriod)}
                    timeframe={pulse.periodLabel}
                  />
                </div>
              </section>
            )}

            {/* Attention Center — workspace-wide, shown for non-Revenue reports */}
            {pulse && reportId !== "revenue" && (
              <section className="space-y-4" aria-label="Attention Center">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">Attention Center</p>
                  <span className="text-xs text-ink-muted">Workspace-wide, all time</span>
                </div>
                {attentionItems.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="Nothing needs attention"
                    description="No invoices are overdue, unusually large, or due imminently, and payments are coming in normally. This list will surface anything that needs a decision as soon as it comes up."
                  />
                ) : (
                  <AttentionList items={attentionItems} onOpenInvoice={navigateToInvoiceDetail} />
                )}
              </section>
            )}

            {/* Collection Outlook — shows unpaid invoices with due dates and outstanding amounts for the current filter scope */}
            <CollectionOutlook
              invoices={filteredInvoices}
              payments={filteredPayments}
              clients={clients ?? []}
              asOf={now}
            />

            {/* Data Quality Checks — workspace-wide checks for data consistency issues */}
            <DataQualityChecks
              invoices={invoices ?? []}
              payments={payments ?? []}
              clients={clients ?? []}
              asOf={now}
              onNavigateToInvoice={navigateToInvoiceDetail}
            />

            {/* Client Trends — period-over-period client performance */}
            <ClientTrends
              invoices={invoices ?? []}
              payments={payments ?? []}
              clients={clients ?? []}
              asOf={now}
              currentStart={periodWindow.currentStart}
              currentEnd={periodWindow.currentEnd}
              comparableStart={periodWindow.comparableStart}
              comparableEnd={periodWindow.comparableEnd}
            />

            {/* Product Sales Insights — period-over-period product performance */}
            <ProductSalesInsights
              invoices={invoices ?? []}
              products={products ?? []}
              currentStart={periodWindow.currentStart}
              currentEnd={periodWindow.currentEnd}
              comparableStart={periodWindow.comparableStart}
              comparableEnd={periodWindow.comparableEnd}
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{activeDefinition.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{activeDefinition.description}</p>
              </div>
            </div>

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
                    { key: "number", label: "Invoice", width: "w-[130px]" },
                    { key: "client", label: "Client", width: "w-[200px] min-w-[140px]" },
                    { key: "date", label: "Date", width: "w-[100px]" },
                    { key: "amount", label: "Amount", align: "right", width: "w-[120px]" },
                    { key: "status", label: "Status", width: "w-[120px]" },
                  ]}
                  rows={invoiceRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-accent w-[130px]">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.number }} className="text-accent" />
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted truncate w-[200px] min-w-[140px]">{r.clientName}</td>
                      <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap w-[100px]">{formatDate(r.issueDate)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink w-[120px] whitespace-nowrap">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2.5 w-[120px]">
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
                    { key: "number", label: "Invoice", width: "w-[130px]" },
                    { key: "client", label: "Client", width: "w-[200px] min-w-[140px]" },
                    { key: "date", label: "Date", width: "w-[100px]" },
                    { key: "due", label: "Due date", width: "w-[100px]" },
                    { key: "amount", label: "Amount", align: "right", width: "w-[120px]" },
                    { key: "status", label: "Status", width: "w-[120px]" },
                  ]}
                  rows={invoiceRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-accent w-[130px]">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.number }} className="text-accent" />
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted truncate w-[200px] min-w-[140px]">{r.clientName}</td>
                      <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap w-[100px]">{formatDate(r.issueDate)}</td>
                      <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap w-[100px]">{formatDate(r.dueDate)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink w-[120px] whitespace-nowrap">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2.5 w-[120px]">
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
                    { key: "id", label: "Payment", width: "w-[100px]" },
                    { key: "invoice", label: "Invoice", width: "w-[130px]" },
                    { key: "client", label: "Client", width: "w-[200px] min-w-[140px]" },
                    { key: "date", label: "Date", width: "w-[100px]" },
                    { key: "amount", label: "Amount", align: "right", width: "w-[120px]" },
                    { key: "method", label: "Method", width: "w-[130px]" },
                  ]}
                  rows={paymentRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-ink w-[100px]">{r.id}</td>
                      <td className="px-4 py-2.5 text-accent w-[130px]">
                        {invoices?.some((invoice) => invoice.id === r.invoiceId) ? (
                          <InvoiceNumberLink
                            invoice={{ id: r.invoiceId, number: r.invoiceNumber }}
                            className="text-accent"
                          />
                        ) : (
                          r.invoiceNumber
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted truncate w-[200px] min-w-[140px]">{r.clientName}</td>
                      <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap w-[100px]">{formatDate(r.receivedAt)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-success w-[120px] whitespace-nowrap">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-2.5 w-[130px]">{METHOD_LABELS[r.method] ?? r.method}</td>
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
                    { key: "client", label: "Client", width: "w-[200px] min-w-[140px]" },
                    { key: "invoice", label: "Invoice", width: "w-[130px]" },
                    { key: "total", label: "Total", align: "right", width: "w-[120px]" },
                    { key: "paid", label: "Paid", align: "right", width: "w-[120px]" },
                    { key: "outstanding", label: "Outstanding", align: "right", width: "w-[120px]" },
                    { key: "due", label: "Due date", width: "w-[100px]" },
                    { key: "status", label: "Status", width: "w-[120px]" },
                  ]}
                  rows={outstandingRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 text-ink-muted truncate w-[200px] min-w-[140px]">{r.clientName}</td>
                      <td className="px-4 py-2.5 font-medium text-accent w-[130px]">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} className="text-accent" />
                      </td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted w-[120px] whitespace-nowrap">{formatCurrency(r.total)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted w-[120px] whitespace-nowrap">{formatCurrency(r.paid)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right font-medium text-ink w-[120px] whitespace-nowrap">{formatCurrency(r.outstanding)}</td>
                      <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap w-[100px]">{formatDate(r.dueDate)}</td>
                      <td className="px-4 py-2.5 w-[120px]">
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
                    { key: "client", label: "Client", width: "w-[200px] min-w-[140px]" },
                    { key: "invoice", label: "Invoice", width: "w-[130px]" },
                    { key: "total", label: "Total", align: "right", width: "w-[120px]" },
                    { key: "paid", label: "Paid", align: "right", width: "w-[120px]" },
                    { key: "outstanding", label: "Outstanding", align: "right", width: "w-[120px]" },
                    { key: "due", label: "Due date", width: "w-[100px]" },
                  ]}
                  rows={overdueRows}
                  rowKey={(r) => r.id}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 text-ink-muted truncate w-[200px] min-w-[140px]">{r.clientName}</td>
                      <td className="px-4 py-2.5 font-medium text-accent w-[130px]">
                        <InvoiceNumberLink invoice={{ id: r.id, number: r.invoiceNumber }} className="text-accent" />
                      </td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted w-[120px] whitespace-nowrap">{formatCurrency(r.total)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted w-[120px] whitespace-nowrap">{formatCurrency(r.paid)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right font-medium text-overdue w-[120px] whitespace-nowrap">{formatCurrency(r.outstanding)}</td>
                      <td className="px-4 py-2.5 text-ink-muted whitespace-nowrap w-[100px]">{formatDate(r.dueDate)}</td>
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
                    { key: "client", label: "Client", width: "w-[200px] min-w-[140px]" },
                    { key: "invoices", label: "Invoices", align: "right", width: "w-[80px]" },
                    { key: "billed", label: "Total billed", align: "right", width: "w-[120px]" },
                    { key: "collected", label: "Total received", align: "right", width: "w-[120px]" },
                    { key: "outstanding", label: "Outstanding", align: "right", width: "w-[120px]" },
                  ]}
                  rows={clientSummaryRows}
                  rowKey={(r) => r.clientId}
                  renderRow={(r) => (
                    <>
                      <td className="px-4 py-2.5 font-medium text-ink truncate w-[200px] min-w-[140px]">{r.clientName}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted w-[80px] whitespace-nowrap">{r.invoiceCount}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-ink-muted w-[120px] whitespace-nowrap">{formatCurrency(r.totalBilled)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right text-success w-[120px] whitespace-nowrap">{formatCurrency(r.totalCollected)}</td>
                      <td className="font-tabular px-4 py-2.5 text-right font-medium text-ink w-[120px] whitespace-nowrap">{formatCurrency(r.outstanding)}</td>
                    </>
                  )}
                />
              )
            )}
          </div>
        )}
      </main>

      <RecordPaymentModal
        open={recordOpen || Boolean(replacementTarget)}
        onClose={closeRecordPayment}
        invoices={billedInvoices}
        clients={clients}
        paymentToReplace={replacementTarget ?? undefined}
        onPersisted={handlePersisted}
        onRecorded={handleRecorded}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}