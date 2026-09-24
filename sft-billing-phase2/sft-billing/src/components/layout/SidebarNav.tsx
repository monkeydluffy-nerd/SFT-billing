import {
  LayoutGrid,
  FileText,
  Users,
  CreditCard,
  BarChart3,
  FileBarChart,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useWorkspaceStore, type AppPage } from "@/hooks/useWorkspaceStore";
import { cn } from "@/lib/cn";

interface NavItem {
  page: AppPage;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: "overview", label: "Overview", icon: LayoutGrid, available: true },
  { page: "invoices", label: "Invoices", icon: FileText, available: true },
  { page: "clients", label: "Clients", icon: Users, available: false },
  { page: "payments", label: "Payments", icon: CreditCard, available: false },
  { page: "intelligence", label: "Intelligence", icon: BarChart3, available: false },
  { page: "reports", label: "Reports", icon: FileBarChart, available: false },
  { page: "settings", label: "Workspace Settings", icon: Settings, available: false },
];

/**
 * "Overview" and "Invoices" are wired to real content as of Phase 2. The
 * rest are visible (so the full information architecture is legible from
 * day one) but intentionally disabled with a "Coming in a later phase"
 * affordance rather than a dead click that silently does nothing — see
 * blueprint §24, "avoid non-functional navigation."
 */
export function SidebarNav() {
  const { currentPage, navigateTo, sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useWorkspaceStore();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-panel",
        sidebarCollapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-5 pt-6 pb-5", sidebarCollapsed && "justify-center px-0")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent font-display text-base text-accent-ink">
          S
        </div>
        {!sidebarCollapsed && (
          <div className="leading-tight">
            <p className="font-display text-base text-ink">SFT Billing</p>
            <p className="text-xs text-ink-faint">Executive workspace</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive =
            currentPage === item.page || (item.page === "invoices" && currentPage === "create-invoice");
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              type="button"
              disabled={!item.available}
              onClick={() => item.available && navigateTo(item.page)}
              title={sidebarCollapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-micro",
                sidebarCollapsed && "justify-center px-0",
                isActive
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-ink-muted hover:bg-canvas hover:text-ink",
                !item.available && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-ink-muted",
              )}
            >
              <Icon size={17} className="shrink-0" aria-hidden />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {!sidebarCollapsed && !item.available && (
                <span className="ml-auto shrink-0 text-[10px] text-ink-faint">Soon</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={cn("flex items-center gap-1 border-t border-border px-3 py-3", sidebarCollapsed && "flex-col")}>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors duration-micro hover:bg-canvas hover:text-ink"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors duration-micro hover:bg-canvas hover:text-ink"
        >
          {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
