/**
 * Generates the next invoice number by scanning existing invoices and
 * incrementing past the highest INV-XXXX number found.
 * Falls back to INV-1001 if no existing invoices match the pattern.
 */
export function nextInvoiceNumber(existingNumbers: string[]): string {
  let max = 1000;
  for (const num of existingNumbers) {
    const match = num.match(/^INV-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `INV-${max + 1}`;
}

/** Generate a short unique ID suitable for new records in the local store. */
export function generateId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
