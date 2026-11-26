/**
 * UI kit — patterns adapted from shadcn/ui (flat panels, hairline dividers),
 * Magic UI (Number Ticker, Blur Fade, Border Beam), React Bits (Spotlight
 * Card) and Origin UI (segmented tabs, crisp controls).
 */
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Magic UI · Number Ticker ───────────────────────────────────────── */
export function NumberTicker({
  value,
  format = (n: number) => Math.round(n).toLocaleString("en-IN"),
  className,
  delay = 0,
  duration = 1.1,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (n) => format(n));
  useEffect(() => {
    // No IntersectionObserver (tests, very old webviews) or reduced motion: show the value directly.
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (typeof IntersectionObserver === "undefined" || reduce) {
      motionValue.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(motionValue, value, { duration, delay, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, value, delay, duration, motionValue]);
  return (
    <motion.span ref={ref} className={cn("font-tabular", className)}>
      {text}
    </motion.span>
  );
}

/* ── Magic UI · Blur Fade ───────────────────────────────────────────── */
export function BlurFade({
  children,
  delay = 0,
  y = 8,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── React Bits · Spotlight Card ────────────────────────────────────── */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function onMove(event: PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--sx", `${event.clientX - rect.left}px`);
    node.style.setProperty("--sy", `${event.clientY - rect.top}px`);
  }
  return (
    <div ref={ref} onPointerMove={onMove} className={cn("spotlight-card group relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(320px circle at var(--sx,50%) var(--sy,50%), rgb(var(--color-accent) / 0.10), transparent 60%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ── Magic UI · Border Beam ─────────────────────────────────────────── */
export function BorderBeam({ className }: { className?: string }) {
  return <span aria-hidden className={cn("border-beam pointer-events-none absolute inset-0 rounded-[inherit]", className)} />;
}

/* ── shadcn · stat group (one panel, hairline dividers) ─────────────── */
export function StatGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface md:divide-y-0 md:[grid-template-columns:repeat(var(--cols,4),minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TONE_DOT: Record<string, string> = {
  neutral: "bg-ink-faint",
  accent: "bg-accent",
  success: "bg-success",
  pending: "bg-pending",
  overdue: "bg-overdue",
  caution: "bg-caution",
};

export function Stat({
  label,
  value,
  format,
  sub,
  tone = "neutral",
  active,
  onClick,
  delay = 0,
  badge,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: ReactNode;
  tone?: keyof typeof TONE_DOT;
  active?: boolean;
  onClick?: () => void;
  delay?: number;
  badge?: ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cn(
        "group relative min-w-0 px-5 py-4 text-left outline-none transition-colors duration-micro",
        onClick && "hover:bg-canvas/70 focus-visible:bg-canvas/70",
        active && "bg-accent/[0.06]",
      )}
    >
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} aria-hidden />
          {label}
        </span>
        {badge}
      </div>
      <p className="mt-2 truncate text-[1.65rem] font-medium leading-none tracking-tight text-ink">
        <NumberTicker value={value} format={format} delay={delay} />
      </p>
      {sub && <p className="mt-2 truncate text-xs text-ink-faint">{sub}</p>}
    </Tag>
  );
}

/* ── Origin UI / shadcn · segmented tabs ────────────────────────────── */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-0.5 rounded-lg bg-canvas p-0.5 ring-1 ring-border", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-accent/40",
              selected ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${options.map((o) => o.value).join("-")}`}
                className="absolute inset-0 rounded-md bg-surface shadow-sm ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{option.label}</span>
            {option.count !== undefined && <span className="relative font-tabular text-[10px] text-ink-faint">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Section: flat block with a small header (no box) ───────────────── */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}


/* ── Card / CardHeader ──────────────────────────────────────────────── */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Origin UI-style search field ───────────────────────────────────── */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="h-10 w-full rounded-full border border-border-strong bg-surface pl-10 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint hover:bg-canvas hover:text-ink">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Avatar (initials) ──────────────────────────────────────────────── */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent", className)} aria-hidden>
      {initials}
    </span>
  );
}
