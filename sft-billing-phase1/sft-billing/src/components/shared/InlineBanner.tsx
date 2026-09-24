import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface InlineBannerProps {
  icon: LucideIcon;
  tone?: "neutral" | "caution";
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const TONE_CLASSES = {
  neutral: "bg-surface border-border text-ink",
  caution: "bg-caution-bg border-caution/20 text-ink",
};

/**
 * A single calm banner line, never a red flash across the screen. This is
 * meant to read like a colleague quietly flagging something, not an alarm
 * — see blueprint §10, "making overdue states feel like emergencies."
 */
export function InlineBanner({ icon: Icon, tone = "neutral", children, action, className }: InlineBannerProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-lg border px-4 py-3", TONE_CLASSES[tone], className)}>
      <div className="flex items-center gap-3 text-sm">
        <Icon size={16} className="shrink-0 text-caution" aria-hidden />
        <span>{children}</span>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
