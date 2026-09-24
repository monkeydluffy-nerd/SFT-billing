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
import { SurfineMark } from "@/components/shared/SurfineMark";
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
  { page: "clients", label: "Clients", icon: Users, available: true },
  { page: "payments", label: "Payments", icon: CreditCard, available: true },
  { page: "intelligence", label: "Intelligence", icon: BarChart3, available: true },
  { page: "reports", label: "Reports", icon: FileBarChart, available: true },
  { page: "settings", label: "Workspace Settings", icon: Settings, available: true },
];

/**
 * Every section is wired to real content and enabled for navigation.
 * Availability here purely reflects whether a page exists yet - there is
 * currently no disabled/"Soon" destination left in the primary navigation.
 */
export function SidebarNav() {
  const { currentPage, navigateTo, sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useWorkspaceStore();

  return (
    <aside
      className={cn(
        "print:hidden flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-ink transition-[width] duration-panel",
        sidebarCollapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex items-start gap-3 px-5 pt-7 pb-8", sidebarCollapsed && "justify-center px-0") }>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-sidebar-ink/10 text-premium">
          <SurfineMark className="h-7 w-7" title="Surfine Technology" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 pt-0.5 leading-tight">
            <p className="truncate text-[12px] font-semibold tracking-[0.13em] text-sidebar-ink">SURFINE TECHNOLOGY</p>
            <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">
              Forging a stronger tomorrow
            </p>
          </div>
        )}
      </div>

      {!sidebarCollapsed && (
        <div className="px-5 pb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-muted">Workspace</div>
      )}
      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
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
                "group relative flex w-full items-center gap-3 rounded-sm border-l-2 border-transparent px-3 py-2.5 text-sm transition-colors duration-micro",
                sidebarCollapsed && "justify-center border-l-0 px-0",
                isActive
                  ? "border-premium bg-sidebar-ink/10 font-medium text-sidebar-ink"
                  : "text-sidebar-muted hover:bg-sidebar-ink/5 hover:text-sidebar-ink",
                !item.available && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-sidebar-muted",
              )}
            >
              <Icon size={17} strokeWidth={1.7} className="shrink-0" aria-hidden />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {!sidebarCollapsed && !item.available && (
                <span className="ml-auto shrink-0 text-[10px] text-sidebar-muted">Soon</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={cn("flex items-center gap-1 border-t border-sidebar-border px-3 py-3", sidebarCollapsed && "flex-col") }>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-sidebar-muted transition-colors duration-micro hover:bg-sidebar-ink/5 hover:text-sidebar-ink"
        >
          {theme === "light" ? <Moon size={16} strokeWidth={1.7} /> : <Sun size={16} strokeWidth={1.7} />}
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-sidebar-muted transition-colors duration-micro hover:bg-sidebar-ink/5 hover:text-sidebar-ink"
        >
          {sidebarCollapsed ? <ChevronsRight size={16} strokeWidth={1.7} /> : <ChevronsLeft size={16} strokeWidth={1.7} />}
        </button>
      </div>
    </aside>
  );
}
