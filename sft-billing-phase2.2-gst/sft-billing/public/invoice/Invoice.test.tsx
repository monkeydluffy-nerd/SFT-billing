import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Invoice from '../invoice/Invoice';
import { buildInvoice, formatAmount, formatCurrency } from '../invoice/invoiceModel';
import type { RawInvoice } from '../invoice/types';

const raw: RawInvoice = {
  seller: {
    name: 'SURFINE', nameSuffix: 'TECHNOLOGY', legalName: 'SURFINE TECHNOLOGY',
    tagline: 'FORGING A STRONGER TOMORROW',
    address: ['No. 52, 1st Street, Annanagar', 'Tiruvallur - 600072, Tamil Nadu, India'],
    phone: '+91 98765 43210', email: 'surfinetechnology@gmail.com',
    website: 'www.surfinetechnology.in', gstin: '33ABCDE1234F1Z5', pan: 'ABCDE1234F',
  },
  buyer: {
    name: 'M/s Megawin Fabrication Pvt. Ltd.',
    address: ['No. 18, Industrial Estate,', 'Ambattur, Chennai - 600058', 'Tamil Nadu, India'],
    gstin: '33AAACM1234D1Z8', state: 'Tamil Nadu (33)',
  },
  meta: [{ label: 'Invoice No.', value: '038/2026-27' }],
  tax: { cgstRate: 9, sgstRate: 9 },
  items: [
    { description: 'Eye Bolt M12', hsn: '7318', qty: 100, unit: 'Nos', rate: 120.0 },
    { description: 'Hex Nut M12', hsn: '7318', qty: 200, unit: 'Nos', rate: 8.5 },
    { description: 'Flat Washer M12', hsn: '7318', qty: 500, unit: 'Nos', rate: 2.0 },
    { description: 'Spring Washer M12', hsn: '7318', qty: 500, unit: 'Nos', rate: 1.5 },
    { description: 'Anchor Bolt M16', hsn: '7318', qty: 50, unit: 'Nos', rate: 250.0 },
  ],
  bank: {
    accountName: 'SURFINE TECHNOLOGY', bankName: 'HDFC Bank',
    accountNumber: '5020 0045 6789 12', ifsc: 'HDFC0001234', branch: 'Ambattur, Chennai',
  },
  declaration: 'We declare that this invoice shows the actual price of the goods described.',
  footer: { left: 'Forging a stronger tomorrow', right: 'Thank you for your business' },
};

describe('invoiceModel calculations', () => {
  const invoice = buildInvoice(raw);

  it('computes per-line taxable value, CGST and SGST', () => {
    expect(invoice.items[0].taxableValue).toBe(12000);
    expect(invoice.items[0].cgst).toBe(1080);
    expect(invoice.items[0].sgst).toBe(1080);
    expect(invoice.items[0].amount).toBe(14160);
  });

  it('sums totals correctly and matches the reference invoice', () => {
    expect(invoice.totals.taxableAmount).toBe(27950);
    expect(invoice.totals.cgstTotal).toBe(2515.5);
    expect(invoice.totals.sgstTotal).toBe(2515.5);
    expect(invoice.totals.grandTotal).toBe(32981);
  });

  it('spells out the grand total in words', () => {
    expect(invoice.amountInWords).toBe('Rupees Thirty Two Thousand Nine Hundred Eighty One Only');
  });

  it('formats currency with the rupee sign and two decimals', () => {
    expect(formatAmount(1080)).toBe('1,080.00');
    expect(formatCurrency(32981)).toBe('\u20B9 32,981.00');
  });
});

describe('<Invoice />', () => {
  it('renders seller, buyer and grand total', () => {
    const invoice = buildInvoice(raw);
    render(<Invoice invoice={invoice} />);

    expect(screen.getByText(/M\/s Megawin Fabrication/)).toBeInTheDocument();
    expect(screen.getByText('Grand Total')).toBeInTheDocument();
    expect(screen.getByText('\u20B9 32,981.00')).toBeInTheDocument();
  });

  it('renders one table row per line item', () => {
    const invoice = buildInvoice(raw);
    render(<Invoice invoice={invoice} />);
    expect(screen.getByText('Eye Bolt M12')).toBeInTheDocument();
    expect(screen.getByText('Anchor Bolt M16')).toBeInTheDocument();
  });
});
