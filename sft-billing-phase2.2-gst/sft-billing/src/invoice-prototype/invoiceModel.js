const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value) {
  return inr.format(Number(value) || 0);
}

export function formatCurrency(value) {
  return `₹ ${formatAmount(value)}`;
}