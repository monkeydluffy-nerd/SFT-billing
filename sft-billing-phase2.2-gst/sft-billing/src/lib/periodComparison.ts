/**
 * Reusable period-comparison primitives - the ONE place that decides
 * what "comparable" means for a month-to-date figure. Nothing here is a
 * one-off visual fix: any screen that needs to compare "so far this
 * month" against a real prior baseline should call these functions
 * rather than bucketing a full current month against a full previous
 * month (which is what produces misleading swings like "-67.2% from
 * previous period" when the current month is still partial).
 *
 * Rule: a partial current month is compared ONLY against the same
 * elapsed number of days at the start of the previous month - never
 * against the previous month's full total.
 */

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export interface ComparablePeriodWindow {
  /** How far into the current month `asOf` is - 1 on the 1st, etc. */
  dayOfMonth: number;
  /** True when the current month still has days remaining after `asOf`. */
  isPartial: boolean;
  currentStart: Date;
  /** Exclusive upper bound - i.e. up to and including `asOf`. */
  currentEnd: Date;
  comparableStart: Date;
  /** Exclusive upper bound of the equivalent elapsed span last month. */
  comparableEnd: Date;
  currentLabel: string;
  comparableLabel: string;
}

/**
 * Builds the two comparable windows: "1st of this month through asOf"
 * and "1st of last month through the same day-of-month" (clamped if last
 * month is shorter). Both windows always cover the same number of days.
 */
export function getComparablePeriodWindow(asOf: Date = new Date()): ComparablePeriodWindow {
  const dayOfMonth = asOf.getDate();
  const daysThisMonth = daysInMonth(asOf.getFullYear(), asOf.getMonth());
  const isPartial = dayOfMonth < daysThisMonth;

  const currentStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const currentEnd = new Date(asOf.getFullYear(), asOf.getMonth(), dayOfMonth + 1);

  const comparableStart = new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1);
  const daysLastMonth = daysInMonth(comparableStart.getFullYear(), comparableStart.getMonth());
  const comparableDay = Math.min(dayOfMonth, daysLastMonth);
  const comparableEnd = new Date(comparableStart.getFullYear(), comparableStart.getMonth(), comparableDay + 1);

  const monthName = asOf.toLocaleDateString("en-IN", { month: "long" });
  const lastMonthName = comparableStart.toLocaleDateString("en-IN", { month: "long" });

  return {
    dayOfMonth,
    isPartial,
    currentStart,
    currentEnd,
    comparableStart,
    comparableEnd,
    currentLabel: isPartial ? `${monthName} 1-${dayOfMonth} (month to date)` : monthName,
    comparableLabel: isPartial ? `${lastMonthName} 1-${comparableDay}` : lastMonthName,
  };
}

/** Sums `getValue(item)` for every item whose `getDate(item)` falls within [start, end). Items with no date (undefined) are skipped. */
export function sumInRange<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  getValue: (item: T) => number,
  start: Date,
  end: Date,
): number {
  let total = 0;
  for (const item of items) {
    const dateStr = getDate(item);
    if (!dateStr) continue;
    const t = new Date(dateStr).getTime();
    if (t >= start.getTime() && t < end.getTime()) {
      total += getValue(item);
    }
  }
  return total;
}

/** Counts items whose `getDate(item)` falls within [start, end). */
export function countInRange<T>(items: T[], getDate: (item: T) => string | undefined, start: Date, end: Date): number {
  let count = 0;
  for (const item of items) {
    const dateStr = getDate(item);
    if (!dateStr) continue;
    const t = new Date(dateStr).getTime();
    if (t >= start.getTime() && t < end.getTime()) count += 1;
  }
  return count;
}

/** Counts the number of DISTINCT `getKey(item)` values among items whose date falls within [start, end). */
export function countDistinctInRange<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  getKey: (item: T) => string,
  start: Date,
  end: Date,
): number {
  const seen = new Set<string>();
  for (const item of items) {
    const dateStr = getDate(item);
    if (!dateStr) continue;
    const t = new Date(dateStr).getTime();
    if (t >= start.getTime() && t < end.getTime()) seen.add(getKey(item));
  }
  return seen.size;
}

export interface ComparableChange {
  /** Only defined when `comparable` is true - a percentage is never surfaced when the baseline can't support one. */
  changePct: number | undefined;
  /** False whenever there's no real, nonzero baseline to compare against - the caller must show a neutral "Comparison unavailable" state rather than any percentage. */
  comparable: boolean;
}

/**
 * The single rule for turning two comparable-window totals into a
 * percentage: only produces a number when the baseline period actually
 * has a nonzero value. A 0-vs-0 or 0-vs-N/N-vs-0 comparison is
 * deliberately marked NOT comparable rather than rendered as "+100%" or
 * "-100%", which would misrepresent "no baseline" as "total collapse"
 * or "infinite growth."
 */
export function computeComparableChange(current: number, comparableBaseline: number): ComparableChange {
  if (comparableBaseline <= 0) {
    return { changePct: undefined, comparable: false };
  }
  return { changePct: ((current - comparableBaseline) / comparableBaseline) * 100, comparable: true };
}