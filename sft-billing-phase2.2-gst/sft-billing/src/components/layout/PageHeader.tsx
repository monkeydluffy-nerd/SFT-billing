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
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 border-b border-border bg-header px-4 sm:px-10 py-4 sm:py-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-ink truncate">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted truncate">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
        >
          <Search size={14} aria-hidden />
          <span className="hidden sm:inline">Search or run a command</span>
          <kbd className="rounded border border-border bg-canvas px-1.5 py-0.5 font-sans text-[11px] text-ink-faint">
            Ctrl K
          </kbd>
        </button>
        {action}
      </div>
    </div>
  );
}
