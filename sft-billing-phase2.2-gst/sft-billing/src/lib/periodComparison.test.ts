import { describe, expect, it } from "vitest";
import { getComparablePeriodWindow, sumInRange, countInRange, countDistinctInRange, computeComparableChange } from "./periodComparison";

describe("getComparablePeriodWindow - never treats a partial month as a full one", () => {
  it("covers the SAME number of days in both windows when the current month is partial", () => {
    const asOf = new Date(2026, 8, 10); // Sep 10, 2026
    const window = getComparablePeriodWindow(asOf);

    expect(window.isPartial).toBe(true);
    expect(window.currentLabel).toContain("month to date");

    const currentDays = (window.currentEnd.getTime() - window.currentStart.getTime()) / (24 * 60 * 60 * 1000);
    const comparableDays = (window.comparableEnd.getTime() - window.comparableStart.getTime()) / (24 * 60 * 60 * 1000);
    expect(currentDays).toBe(comparableDays);
  });

  it("labels a full month plainly (not 'month to date') when asOf is the last day of the month", () => {
    const asOf = new Date(2026, 8, 30); // September has 30 days
    const window = getComparablePeriodWindow(asOf);
    expect(window.isPartial).toBe(false);
    expect(window.currentLabel).not.toContain("month to date");
  });

  it("clamps the comparable day when the previous month is shorter (e.g. March 31 -> Feb has no 31st)", () => {
    const asOf = new Date(2026, 2, 31); // Mar 31, 2026
    const window = getComparablePeriodWindow(asOf);
    // The upper bound is exclusive, so February 1-28 ends at March 1 without including March data.
    expect(window.comparableEnd).toEqual(new Date(2026, 2, 1));
    expect(window.comparableLabel).toBe("February");
  });
});

describe("sumInRange / countInRange / countDistinctInRange", () => {
  const items = [
    { date: "2026-09-05", value: 100, key: "a" },
    { date: "2026-09-06", value: 200, key: "b" },
    { date: "2026-08-25", value: 50, key: "a" }, // outside range
    { date: undefined, value: 999, key: "c" }, // no date - must be skipped
  ];
  const start = new Date(2026, 8, 1);
  const end = new Date(2026, 8, 11);

  it("sumInRange only sums items within [start, end) and skips undefined dates", () => {
    expect(sumInRange(items, (i) => i.date, (i) => i.value, start, end)).toBe(300);
  });

  it("countInRange only counts items within [start, end)", () => {
    expect(countInRange(items, (i) => i.date, start, end)).toBe(2);
  });

  it("countDistinctInRange counts distinct keys, not raw item count", () => {
    const withDup = [...items, { date: "2026-09-07", value: 10, key: "a" }];
    expect(countDistinctInRange(withDup, (i) => i.date, (i) => i.key, start, end)).toBe(2); // "a" and "b", deduped
  });
});

describe("computeComparableChange - never produces a misleading percentage", () => {
  it("returns a real changePct when the baseline is a genuine nonzero amount", () => {
    const result = computeComparableChange(150, 100);
    expect(result.comparable).toBe(true);
    expect(result.changePct).toBe(50);
  });

  it("marks NOT comparable when the baseline is exactly zero (no -100%/Infinity)", () => {
    const result = computeComparableChange(500, 0);
    expect(result.comparable).toBe(false);
    expect(result.changePct).toBeUndefined();
  });

  it("marks NOT comparable when the baseline is negative (shouldn't happen, but must not divide oddly)", () => {
    const result = computeComparableChange(500, -10);
    expect(result.comparable).toBe(false);
  });
});