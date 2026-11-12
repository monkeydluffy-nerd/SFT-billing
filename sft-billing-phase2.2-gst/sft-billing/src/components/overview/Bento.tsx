import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, FilePenLine, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardHeader, NumberTicker, SpotlightCard } from "@/components/ui/kit";

export { Card, CardHeader };

/* ── Trend pill ─────────────────────────────────────────────────────── */
export function TrendPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        up ? "bg-success-bg text-success" : "bg-overdue-bg text-overdue",
      )}
    >
      <Icon size={12} aria-hidden />
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

/* ── KPI card (React Bits spotlight + Magic UI ticker) ─────────────── */
const KPI_TONES: Record<string, { icon: LucideIcon; chip: string }> = {
  pending: { icon: Clock3, chip: "bg-pending-bg text-pending" },
  success: { icon: CheckCircle2, chip: "bg-success-bg text-success" },
  overdue: { icon: AlertTriangle, chip: "bg-overdue-bg text-overdue" },
  neutral: { icon: FilePenLine, chip: "bg-neutral-bg text-neutral" },
};

export function KpiCard({
  label,
  tone,
  value,
  sub,
  active,
  onClick,
  delay = 0,
}: {
  label: string;
  tone: keyof typeof KPI_TONES;
  value: number;
  sub: string;
  active?: boolean;
  onClick: () => void;
  delay?: number;
}) {
  const { icon: Icon, chip } = KPI_TONES[tone];
  return (
    <SpotlightCard className={cn("rounded-xl border bg-surface transition-colors", active ? "border-accent" : "border-border hover:border-border-strong")}>
      <button type="button" onClick={onClick} aria-pressed={active} className="block w-full p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
        <div className="flex items-center justify-between">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", chip)}>
            <Icon size={16} aria-hidden />
          </span>
          <ChevronRight size={15} className="text-ink-faint" aria-hidden />
        </div>
        <p className="mt-4 text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          <NumberTicker value={value} format={(n) => formatCurrency(n)} delay={delay} />
        </p>
        <p className="mt-1 truncate text-xs text-ink-faint">{sub}</p>
      </button>
    </SpotlightCard>
  );
}

/* ── Magic UI-style animated circular progress ──────────────────────── */
export function CollectionRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36" role="img" aria-label={`${Math.round(clamped)}% collected`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-border" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-accent"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-ink">
          <NumberTicker value={clamped} format={(n) => `${Math.round(n)}%`} delay={0.4} duration={1.4} />
        </span>
        <span className="text-[11px] text-ink-muted">collected</span>
      </div>
    </div>
  );
}

/* ── Needs attention (overdue) ──────────────────────────────────────── */
export interface AttentionItem {
  id: string;
  number: string;
  client: string;
  balance: number;
  daysOverdue: number;
}

export function AttentionList({ items, onOpen, onViewAll }: { items: AttentionItem[]; onOpen: (id: string) => void; onViewAll: () => void }) {
  return (
    <Card className="p-5">
      <CardHeader
        title="Needs attention"
        description="Overdue invoices, oldest first"
        action={
          items.length > 0 ? (
            <button type="button" onClick={onViewAll} className="text-xs font-medium text-accent hover:underline">
              View all
            </button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success">
            <CheckCircle2 size={18} aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">Nothing overdue</p>
          <p className="text-xs text-ink-muted">Every billed invoice is on track.</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="group flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:bg-canvas"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-overdue-bg text-xs font-semibold text-overdue">
                  {item.daysOverdue}d
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.client}</span>
                  <span className="block truncate font-mono text-xs text-ink-muted">{item.number}</span>
                </span>
                <span className="font-tabular text-sm font-medium text-ink">{formatCurrency(item.balance)}</span>
                <ChevronRight size={15} className="text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Top clients (ranked bars) ──────────────────────────────────────── */
export interface ClientBar {
  id: string;
  name: string;
  total: number;
}

export function TopClients({ clients, onOpen }: { clients: ClientBar[]; onOpen: (id: string) => void }) {
  const max = Math.max(1, ...clients.map((c) => c.total));
  return (
    <Card className="p-5">
      <CardHeader title="Top clients" description="By amount billed in this period" />
      {clients.length === 0 ? (
        <p className="mt-6 py-6 text-center text-xs text-ink-muted">No billed invoices in this period.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {clients.map((client, index) => (
            <li key={client.id}>
              <button type="button" onClick={() => onOpen(client.id)} className="block w-full text-left outline-none">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-tabular w-4 text-xs text-ink-faint">{index + 1}</span>
                    <span className="truncate font-medium text-ink">{client.name}</span>
                  </span>
                  <span className="font-tabular text-ink-muted">{formatCurrency(client.total)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${(client.total / max) * 100}%` }}
                    transition={{ duration: 0.9, delay: 0.3 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
