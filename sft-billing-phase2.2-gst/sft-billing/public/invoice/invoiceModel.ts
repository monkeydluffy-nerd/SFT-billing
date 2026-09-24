import type { Invoice, LineItem, RawInvoice, Totals } from './types';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
] as const;
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const;

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(twoDigits(r));
  return parts.join(' ');
}

/** Indian numbering system: crore / lakh / thousand / hundred. */
export function numberToWordsIndian(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}

export function amountToWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let out = `Rupees ${numberToWordsIndian(rupees)}`;
  if (paise > 0) out += ` and ${twoDigits(paise)} Paise`;
  return `${out} Only`;
}

const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 27950 -> "27,950.00" */
export function formatAmount(value: number | undefined | null): string {
  return inr.format(round2(value ?? 0));
}

/** "₹ 27,950.00" */
export function formatCurrency(value: number | undefined | null): string {
  return `\u20B9 ${formatAmount(value)}`;
}

export function buildInvoice(raw: RawInvoice): Invoice {
  const { cgstRate, sgstRate } = raw.tax;

  const items: LineItem[] = raw.items.map((item, index) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const taxableValue = round2(qty * rate);
    const cgst = round2((taxableValue * cgstRate) / 100);
    const sgst = round2((taxableValue * sgstRate) / 100);
    return {
      ...item,
      serial: index + 1,
      qty,
      rate,
      taxableValue,
      cgst,
      sgst,
      amount: round2(taxableValue + cgst + sgst),
    };
  });

  const sum = (key: 'taxableValue' | 'cgst' | 'sgst') =>
    round2(items.reduce((acc, i) => acc + i[key], 0));

  const taxableAmount = sum('taxableValue');
  const cgstTotal = sum('cgst');
  const sgstTotal = sum('sgst');
  const subTotal = round2(taxableAmount + cgstTotal + sgstTotal);
  const grandTotal = Math.round(subTotal);
  const roundOff = round2(grandTotal - subTotal);

  const totals: Totals = { taxableAmount, cgstTotal, sgstTotal, subTotal, roundOff, grandTotal };

  return {
    ...raw,
    items,
    totals,
    amountInWords: amountToWords(grandTotal),
  };
}
