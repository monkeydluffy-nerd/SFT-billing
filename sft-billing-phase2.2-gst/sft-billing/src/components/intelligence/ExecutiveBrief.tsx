import { Sparkles } from "lucide-react";

interface ExecutiveBriefProps {
  summary: string;
}

/**
 * The single most important sentence on the page - set larger and given
 * its own visual weight (a left accent rule, not a filled card) so it
 * reads as the page's opening statement rather than one more stat
 * block. Every word in `summary` traces back to generateExecutiveSummary
 * in lib/intelligence.ts - nothing here is decorative copy.
 */
export function ExecutiveBrief({ summary }: ExecutiveBriefProps) {
  return (
    <div className="border-l-2 border-accent pl-5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        <Sparkles size={12} className="text-premium" aria-hidden />
        Executive brief
      </p>
      <p className="mt-2 max-w-2xl font-display text-lg leading-snug text-ink">{summary}</p>
    </div>
  );
}