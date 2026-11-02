import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FilePenLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InvoiceStatus } from "@/types";
import type { StatusTotal } from "@/lib/overviewMetrics";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import { useCountUp } from "@/hooks/useCountUp";
import { generateSparklinePath } from "@/hooks/useSparkline";

interface StatStripProps {
  totals: Record<InvoiceStatus, StatusTotal>;
  activeFilter: InvoiceStatus | null;
  onSelect: (status: InvoiceStatus) => void;
  sparklineData?: Partial<Record<InvoiceStatus, { x: number; y: number; value: number }[]>>;
  animatedValues?: Partial<Record<InvoiceStatus, number>>;
  isLoading?: Partial<Record<InvoiceStatus, boolean>>;
  /** Sub-line text for each card */
  subLines?: Partial<Record<InvoiceStatus, string>>;
}

const ORDER: { status: InvoiceStatus; label: string; icon: LucideIcon; tone: string }[] = [
  { status: "pending", label: "Outstanding", icon: Clock3, tone: "bg-pending-bg text-pending" },
  { status: "paid", label: "Received", icon: CheckCircle2, tone: "bg-success-bg text-success" },
  { status: "overdue", label: "Overdue", icon: AlertTriangle, tone: "bg-overdue-bg text-overdue" },
  { status: "draft", label: "Draft", icon: FilePenLine, tone: "bg-neutral-bg text-neutral" },
];

/** Default sparkline points for demo/fallback */
const DEFAULT_POINTS = [
  { x: 4, y: 20, value: 0 },
  { x: 20, y: 18, value: 0 },
  { x: 40, y: 22, value: 0 },
  { x: 60, y: 17, value: 0 },
  { x: 80, y: 19, value: 0 },
  { x: 100, y: 16, value: 0 },
  { x: 120, y: 18, value: 0 },
  { x: 140, y: 15, value: 0 },
];

function StatCard({
  status,
  label,
  icon: Icon,
  tone,
  total,
  isActive,
  onSelect,
  points,
  animatedValue,
  isLoadingStatus,
  subLine,
}: {
  status: InvoiceStatus;
  label: string;
  icon: LucideIcon;
  tone: string;
  total: StatusTotal;
  isActive: boolean;
  onSelect: (status: InvoiceStatus) => void;
  points: { x: number; y: number; value: number }[];
  animatedValue?: number;
  isLoadingStatus: boolean;
  subLine?: string;
}) {
  const { isComplete } = useCountUp(animatedValue ?? total.amount, 800, 0);
  const showAnimated = isComplete && animatedValue !== undefined;
  const hasEnoughData = points.length >= 2;

  return (
    <button
      type="button"
      onClick={() => onSelect(status)}
      aria-pressed={isActive}
      className={cn(
        "group relative flex min-h-[150px] flex-col rounded-lg border border-border bg-surface p-5 text-left shadow-card transition-[border-color,background-color,transform] duration-micro hover:-translate-y-px hover:border-border-strong",
        "stagger-card card-hover",
        isActive && "border-accent ring-1 ring-accent/20",
      )}
    >
      <div className="flex flex-col h-full">
        {/* Row 1: Icon tile + label left-aligned */}
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
            <Icon size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="stat__label truncate">{label}</p>
        </div>

        {/* Row 2: Value */}
        <div className="mt-3">
          {status === "draft" ? (
            total.count === 0 ? (
              <p className="stat__value-empty">No drafts</p>
            ) : (
              <>
                <p className="stat__value">
                  {isLoadingStatus ? "—" : (
                    <>
                      <span className="stat__cur">₹</span>
                      {formatCurrency(animatedValue ?? total.amount, true)}
                    </>
                  )}
                </p>
              </>
            )
          ) : isLoadingStatus ? (
            <p className="stat__value">—</p>
          ) : (
            <p className="stat__value">
              <>
                <span className="stat__cur">₹</span>
                {formatCurrency(animatedValue ?? total.amount, true)}
              </>
            </p>
          )}
        </div>

        {/* Row 3: Sub-line + Sparkline at bottom */}
        <div className="relative mt-auto flex flex-col items-end gap-1.5 min-h-[50px]">
          {/* Sub-line */}
          {subLine && (
            <p className="stat__sub text-right">{subLine}</p>
          )}

          {/* "All time" caption for outstanding/overdue */}
          {(status === "pending" || status === "overdue") && (
            <p className="stat__sub text-[11px] text-sidebar-muted truncate w-full text-right">All time</p>
          )}

          {/* Sparkline at bottom right */}
          <div className="relative w-32 h-10" aria-hidden="true" role="img" aria-label={`${label} trend over 12 months`}>
            <svg viewBox="0 0 140 40" className="absolute right-0 bottom-0 w-32 h-10" fill="none" aria-hidden="true">
              {hasEnoughData ? (
                <path
                  d={generateSparklinePath(points)}
                  stroke="rgb(var(--color-premium))"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: "1000",
                    strokeDashoffset: showAnimated ? 0 : 1000,
                    transition: showAnimated ? "stroke-dashoffset 900ms ease-out" : "none",
                  }}
                />
              ) : (
                <line x1={4} y1={20} x2={136} y2={20} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />
              )}
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

/** Status cards with sparklines and animated values — 150px tall, equal height. */
export function StatStrip({
  totals,
  activeFilter,
  onSelect,
  sparklineData,
  animatedValues,
  isLoading,
  subLines = {},
}: StatStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 items-stretch">
      {ORDER.map(({ status, label, icon: Icon, tone }) => {
        const total = totals[status];
        const isActive = activeFilter === status;
        const isLoadingStatus = isLoading?.[status] ?? false;
        const animatedValue = animatedValues?.[status];
        const points = sparklineData?.[status] ?? DEFAULT_POINTS;
        return (
          <StatCard
            key={status}
            status={status}
            label={label}
            icon={Icon}
            tone={tone}
            total={total}
            isActive={isActive}
            onSelect={onSelect}
            points={points}
            animatedValue={animatedValue}
            isLoadingStatus={isLoadingStatus}
            subLine={subLines[status]}
          />
        );
      })}
    </div>
  );
}