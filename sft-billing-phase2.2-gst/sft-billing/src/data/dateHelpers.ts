export const NOW = new Date();

export function daysAgo(n: number, from: Date = NOW): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

export function daysFromNow(n: number, from: Date = NOW): Date {
  return daysAgo(-n, from);
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}
