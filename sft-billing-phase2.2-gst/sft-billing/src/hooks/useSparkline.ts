import { useMemo } from "react";

export interface SparklinePoint {
  x: number;
  y: number;
  value: number;
}

/**
 * Normalizes data points to SVG coordinates for sparkline rendering.
 * Returns points suitable for SVG path generation.
 */
export function useSparklineData(values: number[], width = 140, height = 40, padding = 4): SparklinePoint[] {
  return useMemo(() => {
    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values.map((value, index) => ({
      x: padding + (index / Math.max(values.length - 1, 1)) * (width - 2 * padding),
      y: height - padding - ((value - min) / range) * (height - 2 * padding),
      value,
    }));
  }, [values, width, height, padding]);
}

/**
 * Generates an SVG path string for a sparkline.
 * Supports both smooth (catmull-rom) and sharp line modes.
 */
export function generateSparklinePath(
  points: SparklinePoint[],
  options: { smooth?: boolean; close?: boolean } = {}
): string {
  if (!points.length) return "";

  const { smooth = true, close = false } = options;

  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y}`;
  }

  if (smooth) {
    // Catmull-Rom spline for smooth curves
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i > 0 ? i - 1 : 0];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

      const tension = 0.4;
      const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
      const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
      const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
      const cp2y = p2.y - (p3.y - p1.y) * tension / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    if (close) {
      const last = points[points.length - 1];
      path += ` L ${last.x} ${last.y + 40} L ${points[0].x} ${points[0].y + 40} Z`;
    }

    return path;
  }

  // Sharp lines
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  if (close) {
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y + 40} L ${points[0].x} ${points[0].y + 40} Z`;
  }
  return path;
}

/**
 * Generates a dashed path for flat lines when data is insufficient.
 */
export function generateFlatLinePath(width = 140, height = 40, padding = 4, yValue = 0): string {
  const y = height - padding - yValue * (height - 2 * padding);
  return `M ${padding} ${y} L ${width - padding} ${y}`;
}