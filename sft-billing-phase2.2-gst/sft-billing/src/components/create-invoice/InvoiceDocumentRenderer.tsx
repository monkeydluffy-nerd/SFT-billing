// @ts-expect-error Invoice.jsx is the approved visual template and is intentionally JavaScript.
import Invoice from "@/invoice-prototype/Invoice";
import type { InvoiceDocumentModel } from "./invoiceDocumentModel";

import "./invoiceDocument.css";

export interface InvoiceDocumentRendererProps {
  model: InvoiceDocumentModel;
}

export function InvoiceDocumentRenderer({
  model,
}: InvoiceDocumentRendererProps) {
  const {
    labels,
    business,
    customer,
    invoice,
    items,
    gst,
    totals,
    orderDelivery,
    declaration,
    bank,
    authorizedSignatory,
  } = model;

  const invoiceForTemplate = {
    seller: {
      name: business.name,
      legalName: business.name,
      nameSuffix: "",
      tagline: "FORGING A STRONGER TOMORROW",
      logo: business.logoUrl,
      address: business.address
        ? business.address
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
      phone: business.phone ?? "",
      email: business.email ?? "",
      website: "",
      gstin: business.gstin ?? "",
      pan: business.pan ?? "",
    },

    buyer: {
      name: customer.name,
      address: customer.billingAddress
        ? customer.billingAddress
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
      gstin: customer.gstin ?? "",
      state: "",
    },

    meta: [
      invoice.number
        ? { label: "Invoice No.", value: invoice.number }
        : null,
      invoice.issueDate
        ? { label: "Invoice Date", value: invoice.issueDate }
        : null,
      invoice.dueDate
        ? { label: "Due Date", value: invoice.dueDate }
        : null,
      orderDelivery?.supplierCode
        ? { label: labels.supplierCode, value: orderDelivery.supplierCode }
        : null,
      orderDelivery?.poNumber
        ? { label: labels.poNumber, value: orderDelivery.poNumber }
        : null,
      orderDelivery?.poDate
        ? { label: labels.poDate, value: orderDelivery.poDate }
        : null,
      orderDelivery?.transporter
        ? { label: labels.transporter, value: orderDelivery.transporter }
        : null,
    ].filter(Boolean),

    items: items.map((item, index) => {
      const cgst = item.taxableValue * gst.cgstRate;
      const sgst = item.taxableValue * gst.sgstRate;

      return {
        serial: index + 1,
        description: item.description,
        hsn: item.hsnCode ?? labels.emptyValue,
        qty: item.quantity,
        unit: "Nos",
        rate: item.unitPrice,
        taxableValue: item.taxableValue,
        cgst,
        sgst,
        amount: item.taxableValue + cgst + sgst,
      };
    }),

    tax: {
      cgstRate: gst.cgstRate * 100,
      sgstRate: gst.sgstRate * 100,
    },

    totals: {
      taxableAmount: totals.taxableValue,
      cgstTotal: totals.cgstAmount,
      sgstTotal: totals.sgstAmount,
      roundOff: totals.roundOff,
      grandTotal: totals.total,
    },

    bank: bank
      ? {
          accountName: bank.accountHolder,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          ifsc: bank.ifsc,
          branch: bank.branch,
        }
      : {
          accountName: "",
          bankName: "",
          accountNumber: "",
          ifsc: "",
          branch: "",
        },

    declaration:
      declaration ?? "We hereby certify that the above particulars are true and correct.",

    footer: {
      left: "Forging a stronger tomorrow",
      right: "Thank you for your business",
    },

    amountInWords: totals.amountInWords,
  };

  const templateLabels = {
    title: labels.invoiceHeading.toUpperCase(),
    billTo: labels.billedTo.toUpperCase(),
    invoiceDetails: "INVOICE DETAILS",
    bankDetails: labels.bankDetails,
    amountInWords: labels.amountInWords,
    declaration: labels.declaration,
    signatory: authorizedSignatory ?? labels.authorizedSignatory,
    taxableAmount: "Taxable Amount",
    roundOff: labels.roundOff,
    grandTotal: labels.grandTotal,
    serial: "S.No.",
    description: labels.description,
    hsn: labels.hsn,
    qty: labels.quantity,
    unit: "Unit",
    rate: labels.rate,
    taxableValue: labels.taxableValue,
    amount: "Amount",
  };

  return (
    <Invoice
      invoice={invoiceForTemplate}
      labels={templateLabels}
    />
  );
}