import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** Page title row. Global search, notifications and account live in the TopBar. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 px-6 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between lg:px-8">
      <div className="min-w-0">
        <h1 className="font-display truncate text-[1.75rem] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 truncate text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{action}</div>}
    </div>
  );
}
