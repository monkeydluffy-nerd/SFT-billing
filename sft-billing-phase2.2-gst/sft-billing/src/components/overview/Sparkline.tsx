import { useEffect, useRef, useState } from "react";
import { useAnimationsEnabled } from "@/hooks/useAnimations";

interface SparklineProps {
  points: { x: number; y: number; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  dashArray?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Animated sparkline component with draw-in animation and fill.
 */
export function Sparkline({
  points,
  width = 140,
  height = 40,
  color = "currentColor",
  fillColor,
  strokeWidth = 2,
  dashArray,
  className,
  ariaLabel,
}: SparklineProps) {
  const animationsEnabled = useAnimationsEnabled();
  const [drawProgress, setDrawProgress] = useState(0);
  const pathLengthRef = useRef<number>(0);
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const [pathString, setPathString] = useState("");

  // Generate path strings
  useEffect(() => {
    if (!points.length) {
      setPathString("");
      return;
    }

    if (points.length < 2) {
      const flatPath = `M ${4} ${height / 2} L ${width - 4} ${height / 2}`;
      setPathString(flatPath);
      return;
    }

    // Build a simple polyline path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    setPathString(path);
  }, [points, width, height]);

  // Calculate path length for draw-in animation
  useEffect(() => {
    if (pathRef.current) {
      pathLengthRef.current = pathRef.current.getTotalLength();
    }
  }, [pathString]);

  // Animate draw-in
  useEffect(() => {
    if (!animationsEnabled || !pathRef.current) {
      setDrawProgress(pathLengthRef.current);
      return;
    }

    const duration = 900;

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - performance.now() + duration) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDrawProgress(eased * pathLengthRef.current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [animationsEnabled, pathString]);

  const pathDashArray = `${pathLengthRef.current} ${pathLengthRef.current}`;
  const pathDashOffset = pathLengthRef.current - drawProgress;

  // Area path (close the shape)
  const areaPath = pathString && points.length >= 2
    ? `${pathString} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
    : "";

  if (!points.length || points.length < 2) {
    // Render flat dashed line
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-hidden="true"
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={4}
          y1={height / 2}
          x2={width - 4}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.5}
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      role="img"
      aria-label={ariaLabel}
    >
      {fillColor && areaPath && (
        <path
          ref={areaRef}
          d={areaPath}
          fill={fillColor}
          fillOpacity={0.15}
          style={{
            animation: "sparklineFillIn 900ms ease-out forwards",
            opacity: 0,
          } as React.CSSProperties}
        />
      )}
      <path
        ref={pathRef}
        d={pathString}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray ? `${dashArray} ${dashArray}` : pathDashArray}
        strokeDashoffset={pathDashOffset}
        style={{
          transition: dashArray ? "none" : "stroke-dashoffset 900ms ease-out",
        } as React.CSSProperties}
      />
      <defs>
        <style>{`
          @keyframes sparklineFillIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </defs>
    </svg>
  );
}

/**
 * Static sparkline for reduced motion or SSR.
 */
export function StaticSparkline({
  points,
  width = 140,
  height = 40,
  color = "currentColor",
  fillColor,
  className,
  ariaLabel,
}: Omit<SparklineProps, "dashArray" | "strokeWidth">) {
  if (!points.length || points.length < 2) {
    return (
      <svg
        width={140}
        height={40}
        viewBox="0 0 140 40"
        className={className}
        aria-hidden="true"
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={4}
          y1={20}
          x2={136}
          y2={20}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.5}
        />
      </svg>
    );
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  const areaPath = `${path} L ${points[points.length - 1].x} 40 L ${points[0].x} 40 Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      role="img"
      aria-label={ariaLabel}
    >
      {fillColor && (
        <path d={areaPath} fill={fillColor} fillOpacity={0.15} />
      )}
      <path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}