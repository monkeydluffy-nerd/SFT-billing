import { AlertTriangle, CheckCircle2, Clock3, FilePenLine, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import { useCountUp } from "@/hooks/useCountUp";

interface StatCardProps {
  label: string;
  value: number;
  changePct?: number;
  comparable?: boolean;
  isHero?: boolean;
  periodLabel?: string;
  onHeroClick?: () => void;
  subLine?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

interface Tone {
  icon: LucideIcon;
  chip: string;
  bar: string;
}

/** Status tone per card label — colors carry financial meaning only. */
const TONES: Record<string, Tone> = {
  OUTSTANDING: { icon: Clock3, chip: "bg-pending-bg text-pending", bar: "bg-pending" },
  RECEIVED: { icon: CheckCircle2, chip: "bg-success-bg text-success", bar: "bg-success" },
  OVERDUE: { icon: AlertTriangle, chip: "bg-overdue-bg text-overdue", bar: "bg-overdue" },
  DRAFT: { icon: FilePenLine, chip: "bg-neutral-bg text-neutral", bar: "bg-neutral" },
};

const FALLBACK_TONE: Tone = { icon: Wallet, chip: "bg-accent/10 text-accent", bar: "bg-accent" };

export function StatCard(props: StatCardProps) {
  const { label, value: rawValue, changePct, comparable, isHero = false, periodLabel, onHeroClick, subLine, isSelected, onClick } = props;
  const { value } = useCountUp(rawValue, 900, 0);

  if (isHero) {
    const hasChange = comparable && changePct !== undefined && changePct !== 0;
    const isUp = (changePct ?? 0) >= 0;
    return (
      <button
        type="button"
        onClick={onHeroClick ?? onClick}
        className="stat-hero relative isolate flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-xl p-5 text-left text-white shadow-float transition duration-micro hover:-translate-y-0.5 hover:shadow-float-lg"
        aria-label="Open billed report"
      >
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
          <circle cx="290" cy="30" r="120" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
          <circle cx="290" cy="30" r="180" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
          <circle cx="40" cy="220" r="110" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
        </svg>

        <div className="relative z-10 flex items-center justify-between gap-3">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{periodLabel}</p>
        </div>

        <p className="relative z-10 mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">Total revenue</p>
        <p className="font-tabular relative z-10 mt-1 whitespace-nowrap text-[clamp(1.5rem,2.3vw,2rem)] font-medium leading-tight tracking-tight">
          {formatCurrency(value)}
        </p>

        <div className="relative z-10 mt-auto pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
            {hasChange ? (
              <>
                {isUp ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                {`${isUp ? "+" : ""}${(changePct ?? 0).toFixed(1)}% vs previous period`}
              </>
            ) : (
              "No earlier period to compare"
            )}
          </span>
        </div>
      </button>
    );
  }

  const tone = TONES[label.toUpperCase()] ?? FALLBACK_TONE;
  const Icon = tone.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected ?? false}
      aria-label={`${label}: ${formatCurrency(value)}${subLine ? `, ${subLine}` : ""}`}
      className={cn(
        "group relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-xl border bg-surface p-5 text-left shadow-card transition duration-micro hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float",
        isSelected ? "border-accent ring-2 ring-accent/20" : "border-border",
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-[3px] opacity-80", tone.bar)} aria-hidden />
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.chip)}>
          <Icon size={16} strokeWidth={2} aria-hidden />
        </span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      </div>

      <p className="font-tabular mt-4 whitespace-nowrap text-[clamp(1.25rem,1.7vw,1.625rem)] font-medium leading-tight tracking-tight text-ink">
        {formatCurrency(value)}
      </p>

      <p className="mt-auto pt-3 text-xs font-medium text-ink-muted">{subLine}</p>
    </button>
  );
}
