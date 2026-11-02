import { useMemo, useEffect, useRef } from "react";
import type { Invoice, Client, BusinessProfile } from "@/types";

import { formatCurrency } from "@/lib/formatters";
import { amountInWords } from "@/lib/amountInWords";

interface InvoicePreviewProps {
  invoice: Invoice;
  client: Client | undefined;
  business: BusinessProfile | undefined;
  isExpanded?: boolean;
}

function formatDateDisplay(iso: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface TaxGroup {
  hsnCode: string;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalTax: number;
}

function computeTaxGroups(invoice: Invoice): TaxGroup[] {
  const items = invoice.items || [];
  const grouped: Record<string, number> = {};

  for (const item of items) {
    const hsnCode = (item.hsnCode || "").trim() || "—";
    const quantity = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    const lineTotal = quantity * unitPrice;
    grouped[hsnCode] = (grouped[hsnCode] || 0) + lineTotal;
  }

  const gst = invoice.gst || { cgstRate: 0.09, sgstRate: 0.09 };
  const cgstRate = gst.cgstRate || 0.09;
  const sgstRate = gst.sgstRate || 0.09;
  const discount = invoice.discount || 0;
  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  const taxableTotal = Math.max(0, subtotal - discount);

  const codes = Object.keys(grouped);
  const bases = codes.map((code) => {
    const ratio = subtotal > 0 ? grouped[code] / subtotal : 0;
    return Math.round(taxableTotal * ratio * 100) / 100;
  });

  // Adjust last base to match taxable total
  const sumBases = bases.reduce((a, b) => a + b, 0);
  if (bases.length > 0) {
    bases[bases.length - 1] = Math.round((bases[bases.length - 1] + (taxableTotal - sumBases)) * 100) / 100;
  }

  const cgstAmounts = bases.map((base) => Math.round(base * cgstRate * 100) / 100);
  const sgstAmounts = bases.map((base) => Math.round(base * sgstRate * 100) / 100);

  // Adjust last amounts to match totals
  const cgstTotal = Math.round(cgstAmounts.reduce((a, b) => a + b, 0) * 100) / 100;
  const sgstTotal = Math.round(sgstAmounts.reduce((a, b) => a + b, 0) * 100) / 100;
  const expectedCgst = Math.round(taxableTotal * cgstRate * 100) / 100;
  const expectedSgst = Math.round(taxableTotal * sgstRate * 100) / 100;

  if (cgstAmounts.length > 0) {
    cgstAmounts[cgstAmounts.length - 1] = Math.round((cgstAmounts[cgstAmounts.length - 1] + (expectedCgst - cgstTotal)) * 100) / 100;
    sgstAmounts[sgstAmounts.length - 1] = Math.round((sgstAmounts[sgstAmounts.length - 1] + (expectedSgst - sgstTotal)) * 100) / 100;
  }

  return codes.map((code, index) => ({
    hsnCode: code,
    taxableValue: bases[index],
    cgstRate,
    cgstAmount: cgstAmounts[index],
    sgstRate,
    sgstAmount: sgstAmounts[index],
    totalTax: cgstAmounts[index] + sgstAmounts[index],
  }));
}

function getTotals(invoice: Invoice) {
  const items = invoice.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  const discount = invoice.discount || 0;
  const taxableValue = Math.max(0, subtotal - discount);
  const gst = invoice.gst || { cgstRate: 0.09, sgstRate: 0.09 };
  const cgstRate = gst.cgstRate || 0.09;
  const sgstRate = gst.sgstRate || 0.09;
  const cgstAmount = Math.round(taxableValue * cgstRate * 100) / 100;
  const sgstAmount = Math.round(taxableValue * sgstRate * 100) / 100;
  const roundOff = invoice.roundOff || 0;
  const total = Math.round((taxableValue + cgstAmount + sgstAmount + roundOff) * 100) / 100;

  return {
    subtotal,
    discount,
    taxableValue,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    roundOff,
    total,
  };
}

function splitAddress(address: string): string[] {
  if (!address) return [];
  return address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getStateCodeFromGstin(gstin?: string): string {
  if (!gstin || gstin.length < 2) return "";
  return gstin.substring(0, 2);
}

export function InvoicePreview({
  invoice,
  client,
  business,
  isExpanded = false,
}: InvoicePreviewProps) {
  const totals = useMemo(() => getTotals(invoice), [invoice]);
  const taxGroups = useMemo(() => computeTaxGroups(invoice), [invoice]);

  const clientAddressLines = useMemo(() => splitAddress(client?.billingAddress || ""), [client?.billingAddress]);
  const businessAddressLines = useMemo(() => splitAddress(business?.address || ""), [business?.address]);
  const clientStateCode = useMemo(() => getStateCodeFromGstin(client?.gstin), [client?.gstin]);

  // Calculate preview scale for responsive fitting
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);

  useEffect(() => {
    if (isExpanded || !wrapperRef.current || !containerRef.current) {
      scaleRef.current = 1;
      if (wrapperRef.current) {
        wrapperRef.current.style.setProperty('--preview-scale', '1');
      }
      return;
    }
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      const container = containerRef.current;
      if (!wrapper || !container) return;
      const wrapperWidth = wrapper.offsetWidth;
      const containerWidth = container.offsetWidth || 794;
      if (wrapperWidth > 0 && containerWidth > 0) {
        const scale = Math.min(1, (wrapperWidth - 48) / containerWidth); // 48px for padding
        scaleRef.current = scale;
        wrapper.style.setProperty('--preview-scale', String(scale));
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isExpanded]);

  if (!invoice) {
    return null;
  }

  return (
    <div className="invoice-preview-container">
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .invoice-preview { background: white !important; min-height: auto !important; padding: 0 !important; }
          .invoice-container { box-shadow: none !important; border: none !important; max-width: none !important; border-radius: 0 !important; transform: none !important; }
          .no-print { display: none !important; }
        }
        @page {
          margin: 15mm;
          size: A4;
        }
        .invoice-preview {
          background: #f3f4f6;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          width: 100%;
        }
        .invoice-container-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          overflow-x: auto;
        }
        .invoice-container {
          background: white;
          width: 794px; /* A4 width at 96 DPI */
          max-width: 100%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          transform-origin: top center;
        }
        .invoice-container.expanded {
          width: auto;
          max-width: 95vw;
          border-radius: 4px;
          transform: none !important;
        }
        /* Responsive scaling for non-expanded preview */
        @media (max-width: 842px) {
          .invoice-container:not(.expanded) {
            transform: scale(var(--preview-scale, 1));
          }
        }
        /* Consistent gutter: 32px horizontal, 24px vertical between major sections */
        .section-pad {
          padding: 0 32px;
        }
        .section-gap {
          margin-bottom: 24px;
        }
        /* Header Section */
        .invoice-header {
          padding: 24px 32px;
          border-bottom: 2px solid #1f2937;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .company-info {
          flex: 1;
        }
        .company-name {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
          margin-bottom: 6px;
        }
        .company-address {
          font-size: 11px;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 10px;
        }
        .company-details {
          font-size: 10px;
          color: #9ca3af;
          line-height: 1.7;
        }
        .invoice-title-block {
          text-align: right;
          padding-left: 24px;
          min-width: 200px;
        }
        .invoice-label-main {
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 4px;
        }
        .invoice-copy-label {
          font-size: 9px;
          color: #9ca3af;
          text-transform: lowercase;
          margin-bottom: 8px;
        }
        .invoice-number-main {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.02em;
        }
        /* Bill To / Invoice Details Section */
        .bill-to-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          padding: 20px 32px;
          border-bottom: 1px solid #e5e7eb;
        }
        .section-label {
          font-size: 9px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .client-name {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 6px;
        }
        .client-address {
          font-size: 11px;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 4px;
        }
        .client-detail-row {
          font-size: 10px;
          color: #6b7280;
          line-height: 1.8;
        }
        .client-detail-label {
          color: #9ca3af;
          font-weight: 500;
        }
        .invoice-details {
          text-align: right;
        }
        .detail-row {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-bottom: 4px;
          font-size: 11px;
        }
        .detail-label {
          color: #9ca3af;
          font-weight: 500;
          white-space: nowrap;
        }
        .detail-value {
          font-weight: 600;
          color: #111827;
        }
        /* Bank Details Section */
        .bank-details-section {
          padding: 16px 32px;
          border-bottom: 1px solid #e5e7eb;
        }
        .bank-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .bank-field {
          font-size: 10px;
          color: #6b7280;
          line-height: 1.7;
        }
        .bank-field-label {
          color: #9ca3af;
          font-weight: 500;
        }
        /* Items Table - consistent column widths */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
          font-size: 11px;
        }
        .items-table thead {
          background: #f9fafb;
          border-bottom: 2px solid #1f2937;
        }
        .items-table th {
          padding: 12px 8px;
          text-align: left;
          font-size: 9px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e5e7eb;
        }
        .items-table th:nth-child(1) { width: 45px; text-align: center; }
        .items-table th:nth-child(2) { width: 38%; }
        .items-table th:nth-child(3) { width: 11%; text-align: center; }
        .items-table th:nth-child(4) { width: 10%; text-align: center; }
        .items-table th:nth-child(5) { width: 18.5%; text-align: right; }
        .items-table th:nth-child(6) { width: 18.5%; text-align: right; }
        .items-table td {
          padding: 10px 8px;
          font-size: 11px;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }
        .items-table td:nth-child(1) { text-align: center; }
        .items-table td:nth-child(3) { text-align: center; font-family: monospace; font-size: 10px; color: #6b7280; }
        .items-table td:nth-child(4) { text-align: center; }
        .items-table td:nth-child(5) { text-align: right; font-family: monospace; }
        .items-table td:nth-child(6) { text-align: right; font-family: monospace; }
        .items-table tbody tr:last-child td {
          border-bottom: 2px solid #1f2937;
        }
        .items-table tbody tr:nth-child(even) {
          background: #fafafa;
        }
        .description-cell {
          max-width: 280px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal;
        }
        .hsn-cell {
          font-family: monospace;
          font-size: 10px;
          color: #6b7280;
        }
        .amount-cell {
          font-family: monospace;
          font-size: 11px;
        }
        /* Tax Summary - wider columns for numbers */
        .tax-summary {
          margin: 20px 32px 0;
        }
        .tax-summary-table {
          width: 100%;
          border-collapse: collapse;
        }
        .tax-summary-table th {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 8px 8px;
          text-align: left;
          font-size: 9px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tax-summary-table th:nth-child(1) { width: 12%; text-align: center; }
        .tax-summary-table th:nth-child(2) { width: 18%; text-align: right; }
        .tax-summary-table th:nth-child(3) { width: 12%; text-align: right; }
        .tax-summary-table th:nth-child(4) { width: 14%; text-align: right; }
        .tax-summary-table th:nth-child(5) { width: 12%; text-align: right; }
        .tax-summary-table th:nth-child(6) { width: 14%; text-align: right; }
        .tax-summary-table th:nth-child(7) { width: 14%; text-align: right; }
        .tax-summary-table td {
          border: 1px solid #e5e7eb;
          padding: 8px 8px;
          font-size: 10px;
          color: #374151;
        }
        .tax-summary-table td:first-child {
          text-align: center;
          font-family: monospace;
        }
        .tax-summary-table td:nth-child(n+2) {
          text-align: right;
        }
        /* Totals Section - consistent right alignment */
        .totals-section {
          margin: 20px 32px;
          display: flex;
          justify-content: flex-end;
        }
        .totals-table {
          width: 300px;
          border-collapse: collapse;
        }
        .totals-table td {
          padding: 8px 14px;
          font-size: 11px;
          border-bottom: 1px solid #e5e7eb;
        }
        .totals-table td:first-child {
          color: #6b7280;
        }
        .totals-table td:last-child {
          text-align: right;
          font-family: monospace;
          font-size: 11px;
          color: #374151;
        }
        .totals-table tr:last-child td {
          border-bottom: 3px solid #1f2937;
          font-weight: 700;
          font-size: 14px;
          color: #111827;
        }
        .totals-table .highlight {
          color: #dc2626;
        }
        /* Amount in Words */
        .amount-words {
          margin: 0 32px 12px;
          padding: 14px 18px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 11px;
          line-height: 1.6;
          color: #374151;
        }
        .amount-words-label {
          font-weight: 600;
          color: #4b5563;
          margin-bottom: 4px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        /* Tax Amount in Words */
        .tax-amount-words {
          margin: 0 32px 12px;
          padding: 10px 18px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 10px;
          line-height: 1.6;
          color: #374151;
        }
        /* Declaration */
        .declaration {
          margin: 16px 32px 0;
          padding: 14px 18px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }
        .declaration-label {
          font-weight: 600;
          color: #4b5563;
          margin-bottom: 6px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .declaration-text {
          font-size: 10px;
          color: #6b7280;
          line-height: 1.6;
        }
        /* Authorized Signatory */
        .signatory {
          margin: 20px 32px 24px;
          padding-top: 40px;
          border-top: 1px dashed #d1d5db;
          display: flex;
          justify-content: flex-end;
        }
        .signatory-content {
          text-align: right;
          min-width: 180px;
        }
        .signatory-line {
          width: 160px;
          border-top: 1px solid #9ca3af;
          margin: 0 auto 6px 0;
        }
        .signatory-label {
          font-weight: 600;
          color: #4b5563;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .signatory-name {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
        }
        /* Action Bar - not printed, reduced separation */
        .no-print {
          width: 100%;
          max-width: 794px;
          box-sizing: border-box;
          margin: 12px auto 24px;
          padding: 12px 20px;
          background: #f9fafb;
          border-radius: 8px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }
        .btn-secondary {
          background: white;
          color: #374151;
          border-color: #d1d5db;
        }
        .btn-secondary:hover {
          background: #f9fafb;
        }
        .btn-outline {
          background: transparent;
          color: #6b7280;
          border-color: #d1d5db;
        }
        .btn-outline:hover {
          background: #f9fafb;
        }
      `}</style>
      <div className="invoice-preview">
        <div className="invoice-container-wrapper" ref={wrapperRef}>
          <div className={`invoice-container ${isExpanded ? "expanded" : ""}`} ref={containerRef}>
          {/* Header Section */}
          <header className="invoice-header">
            <div className="header-top">
              <div className="company-info">
                <div className="company-name">{business?.name || "SURFINE TECHNOLOGY"}</div>
                <div className="company-address">
                  {businessAddressLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
                <div className="company-details">
                  {business?.gstin && <div>GSTIN: {business.gstin}</div>}
                  {business?.pan && <div>PAN: {business.pan}</div>}
                  {business?.email && <div>E-mail: {business.email}</div>}
                  {business?.phone && <div>Phone: {business.phone}</div>}
                </div>
              </div>
              <div className="invoice-title-block">
                <div className="invoice-label-main">Tax Invoice</div>
                <div className="invoice-copy-label">original for customer</div>
                <div className="invoice-number-main">{invoice.number}</div>
              </div>
            </div>
          </header>

          {/* Bill To / Invoice Details Section */}
          <section className="bill-to-section">
            <div className="bill-to">
              <div className="section-label">Bill To</div>
              <div className="client-name">{client?.name || "—"}</div>
              {clientAddressLines.map((line, i) => (
                <div key={i} className="client-address">{line}</div>
              ))}
              {client?.gstin && (
                <div className="client-detail-row">
                  <span className="client-detail-label">GSTIN: </span>
                  <span>{client.gstin}</span>
                </div>
              )}
              {client?.phone && (
                <div className="client-detail-row">
                  <span className="client-detail-label">Contact: </span>
                  <span>{client.phone}</span>
                </div>
              )}
              {client?.email && (
                <div className="client-detail-row">
                  <span className="client-detail-label">Email: </span>
                  <span>{client.email}</span>
                </div>
              )}
              {clientStateCode && (
                <div className="client-detail-row">
                  <span className="client-detail-label">State Code: </span>
                  <span>{clientStateCode}</span>
                </div>
              )}
            </div>

            <div className="invoice-details">
              <div className="section-label">Invoice Details</div>
              <div className="detail-row">
                <span className="detail-label">Invoice No:</span>
                <span className="detail-value">{invoice.number}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{formatDateDisplay(invoice.issueDate)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Due Date:</span>
                <span className="detail-value">{formatDateDisplay(invoice.dueDate)}</span>
              </div>
              {invoice.poNumber && (
                <div className="detail-row">
                  <span className="detail-label">PO No:</span>
                  <span className="detail-value">{invoice.poNumber}</span>
                </div>
              )}
              {invoice.poDate && (
                <div className="detail-row">
                  <span className="detail-label">PO Date:</span>
                  <span className="detail-value">{formatDateDisplay(invoice.poDate)}</span>
                </div>
              )}
              {invoice.transporter && (
                <div className="detail-row">
                  <span className="detail-label">Transporter:</span>
                  <span className="detail-value">{invoice.transporter}</span>
                </div>
              )}
            </div>
          </section>

          {/* Bank Details Section */}
          <section className="bank-details-section">
            <div className="section-label">Bank Account Details</div>
            <div className="bank-details-grid">
              <div className="bank-field">
                <span className="bank-field-label">Account Holder: </span>
                <span>{business?.bank?.accountHolder || business?.name || "—"}</span>
              </div>
              <div className="bank-field">
                <span className="bank-field-label">Bank Name: </span>
                <span>{business?.bank?.bankName || "—"}</span>
              </div>
              <div className="bank-field">
                <span className="bank-field-label">Branch: </span>
                <span>{business?.bank?.branch || "—"}</span>
              </div>
              <div className="bank-field">
                <span className="bank-field-label">Account Number: </span>
                <span>{business?.bank?.accountNumber || "—"}</span>
              </div>
              <div className="bank-field">
                <span className="bank-field-label">IFSC: </span>
                <span>{business?.bank?.ifsc || "—"}</span>
              </div>
            </div>
          </section>

          {/* Items Table */}
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: "45px", textAlign: "center" }}>S.No</th>
                <th style={{ width: "38%" }}>Item Name</th>
                <th style={{ width: "11%", textAlign: "center" }}>HSN/SAC</th>
                <th style={{ width: "10%", textAlign: "center" }}>Qty</th>
                <th style={{ width: "18.5%", textAlign: "right" }}>Price/Unit</th>
                <th style={{ width: "18.5%", textAlign: "right" }}>Taxable Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ textAlign: "center" }}>{index + 1}</td>
                  <td className="description-cell">{item.description || "—"}</td>
                  <td className="hsn-cell" style={{ textAlign: "center" }}>{item.hsnCode || "—"}</td>
                  <td style={{ textAlign: "center" }}>{item.quantity || 0}</td>
                  <td className="amount-cell" style={{ textAlign: "right" }}>
                    {formatCurrency(item.unitPrice || 0, true)}
                  </td>
                  <td className="amount-cell" style={{ textAlign: "right" }}>
                    {formatCurrency((item.quantity || 0) * (item.unitPrice || 0), true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tax Summary */}
          {taxGroups.length > 0 && (
            <div className="tax-summary">
              <div className="section-label">HSN / SAC Wise Tax Summary</div>
              <table className="tax-summary-table">
                <thead>
                  <tr>
                    <th style={{ width: "12%", textAlign: "center" }}>HSN/SAC</th>
                    <th style={{ width: "18%", textAlign: "right" }}>Taxable Value</th>
                    <th style={{ width: "12%", textAlign: "right" }}>CGST %</th>
                    <th style={{ width: "14%", textAlign: "right" }}>CGST Amt</th>
                    <th style={{ width: "12%", textAlign: "right" }}>SGST %</th>
                    <th style={{ width: "14%", textAlign: "right" }}>SGST Amt</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {taxGroups.map((group, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: "center", fontFamily: "monospace" }}>{group.hsnCode}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(group.taxableValue, true)}</td>
                      <td style={{ textAlign: "right" }}>{(group.cgstRate * 100).toFixed(0)}%</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(group.cgstAmount, true)}</td>
                      <td style={{ textAlign: "right" }}>{(group.sgstRate * 100).toFixed(0)}%</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(group.sgstAmount, true)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(group.totalTax, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals Section */}
          <div className="totals-section">
            <table className="totals-table">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td>{formatCurrency(totals.subtotal, true)}</td>
                </tr>
                {totals.discount > 0 && (
                  <tr>
                    <td>Less: Discount</td>
                    <td>- {formatCurrency(totals.discount, true)}</td>
                  </tr>
                )}
                <tr>
                  <td>Taxable Value</td>
                  <td>{formatCurrency(totals.total - totals.cgstAmount - totals.sgstAmount - totals.roundOff, true)}</td>
                </tr>
                <tr>
                  <td>Add: CGST @ {(totals.cgstAmount / (totals.total - totals.cgstAmount - totals.sgstAmount - totals.roundOff || 1) * 100).toFixed(0)}%</td>
                  <td>{formatCurrency(totals.cgstAmount, true)}</td>
                </tr>
                <tr>
                  <td>Add: SGST @ {(totals.sgstAmount / (totals.total - totals.cgstAmount - totals.sgstAmount - totals.roundOff || 1) * 100).toFixed(0)}%</td>
                  <td>{formatCurrency(totals.sgstAmount, true)}</td>
                </tr>
                {totals.roundOff !== 0 && (
                  <tr>
                    <td>Round Off</td>
                    <td className={totals.roundOff > 0 ? "highlight" : ""}>
                      {totals.roundOff > 0 ? "+" : ""}{formatCurrency(totals.roundOff, true)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td>Grand Total</td>
                  <td>{formatCurrency(totals.total, true)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="amount-words">
            <div className="amount-words-label">Amount Chargeable (in words)</div>
            <div>{amountInWords(totals.total)}</div>
          </div>

          {/* Tax Amount in Words */}
          <div className="tax-amount-words">
            <div className="amount-words-label">Tax Amount (in words)</div>
            <div>{amountInWords(totals.cgstAmount + totals.sgstAmount)}</div>
          </div>

          {/* Declaration */}
          {(business?.declaration || invoice.terms) && (
            <div className="declaration">
              <div className="declaration-label">Declaration</div>
              <div className="declaration-text">{business?.declaration || invoice.terms}</div>
            </div>
          )}

          {/* Authorized Signatory */}
          <div className="signatory">
            <div className="signatory-content">
              <div className="signatory-line" />
              <div className="signatory-label">Authorized Signatory</div>
              <div className="signatory-name">{business?.authorizedSignatory || "Authorized Signatory"}</div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}