import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  const openCommandPalette = useWorkspaceStore((s) => s.openCommandPalette);

  return (
    <div className="flex items-start justify-between gap-6 border-b border-border px-10 py-6">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
        >
          <Search size={14} aria-hidden />
          Search or run a command
          <kbd className="rounded border border-border bg-canvas px-1.5 py-0.5 font-sans text-[11px] text-ink-faint">
            Ctrl K
          </kbd>
        </button>
        {action}
      </div>
    </div>
  );
}
