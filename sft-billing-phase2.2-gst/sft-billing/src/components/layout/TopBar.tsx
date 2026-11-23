import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WorkspaceDropdown } from "@/components/notifications/WorkspaceDropdown";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

/** Persistent top bar: global search / command palette, notifications, account. */
export function TopBar() {
  const openCommandPalette = useWorkspaceStore((s) => s.openCommandPalette);
  const { data: profile } = useBusinessProfile();
  const businessName = profile?.name ?? "SFT Billing";
  const monogram =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SB";

  return (
    <div className="print:hidden sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-canvas/85 px-6 py-3 backdrop-blur-md lg:px-8">
      <button
        type="button"
        onClick={openCommandPalette}
        className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-surface px-4 text-left text-sm text-ink-muted outline-none transition-colors duration-micro hover:border-border-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 sm:max-w-md"
      >
        <Search size={15} strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1 truncate">Search invoices, clients, products…</span>
        <kbd className="hidden shrink-0 rounded-lg border border-border bg-canvas px-1.5 py-0.5 font-sans text-[10px] text-ink-faint sm:inline-block">Ctrl K</kbd>
      </button>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <WorkspaceDropdown businessName={businessName} monogram={monogram} />
      </div>
    </div>
  );
}
