import {
  LayoutGrid,
  FileText,
  Users,
  Package,
  CreditCard,
  FileBarChart,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Sun,
  Brain,
  Plus,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useWorkspaceStore, type AppPage } from "@/hooks/useWorkspaceStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { cn } from "@/lib/cn";

interface NavItem {
  page: AppPage;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { page: "overview", label: "Overview", icon: LayoutGrid, available: true },
      { page: "invoices", label: "Invoices", icon: FileText, available: true },
      { page: "clients", label: "Clients", icon: Users, available: true },
      { page: "products", label: "Products", icon: Package, available: true },
      { page: "payments", label: "Payments", icon: CreditCard, available: true },
    ],
  },
  {
    label: "Insights",
    items: [{ page: "reports", label: "Reports", icon: FileBarChart, available: true }],
  },
  {
    label: "System",
    items: [{ page: "settings", label: "Workspace Settings", icon: Settings, available: true }],
  },
];

const INTELLIGENCE_ITEM: NavItem = {
  page: "intelligence" as AppPage,
  label: "Intelligence",
  icon: Brain,
  available: true,
};

export function SidebarNav() {
  const { currentPage, navigateTo, sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useWorkspaceStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const intelligenceAvailable = typeof window !== "undefined" && window.location.href.includes("intelligence");

  const groups: NavGroup[] = intelligenceAvailable
    ? [...NAV_GROUPS, { label: "Labs", items: [INTELLIGENCE_ITEM] }]
    : NAV_GROUPS;

  const username = user?.username ?? "Account";
  const initials = username.slice(0, 2).toUpperCase();
  const collapsed = sidebarCollapsed;

  return (
    <aside
      className={cn(
        "print:hidden flex h-full shrink-0 flex-col bg-sidebar text-sidebar-ink transition-[width] duration-panel",
        collapsed ? "w-[72px]" : "w-[264px]",
      )}
    >
      {/* Brand */}
      <div className={cn("flex min-w-0 flex-col gap-4 px-4 pt-5 pb-4", collapsed && "items-center px-0")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-1")}>
          <img
            src={collapsed ? "/brand/surfine-emblem.png" : "/brand/surfine-horizontal.png"}
            alt="Surfine Technology logo"
            className={cn(
              "h-auto object-contain transition-[width] duration-panel invert",
              collapsed ? "w-9" : "w-full max-w-[200px]",
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => navigateTo("create-invoice")}
          title={collapsed ? "New invoice" : undefined}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-8px_rgb(var(--color-accent)/0.8)] outline-none transition hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            collapsed ? "h-10 w-10" : "h-10 w-full",
          )}
        >
          <Plus size={16} strokeWidth={2.4} aria-hidden />
          {!collapsed && <span>New invoice</span>}
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-3 pt-1" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted/80">
                {group.label}
              </div>
            ) : (
              <div className="mx-3 mb-2 h-px bg-sidebar-border" aria-hidden />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  currentPage === item.page || (item.page === "invoices" && currentPage === "create-invoice");
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    type="button"
                    disabled={!item.available}
                    onClick={() => item.available && navigateTo(item.page)}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] outline-none transition-colors duration-micro focus-visible:ring-1 focus-visible:ring-accent/50 focus-visible:ring-offset-0",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-sidebar-ink/10 font-medium text-sidebar-ink"
                        : "font-medium text-sidebar-muted hover:bg-sidebar-ink/[0.06] hover:text-sidebar-ink",
                      !item.available && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-sidebar-muted",
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={isActive ? 2 : 1.6}
                      className={cn("shrink-0 transition-colors", isActive && "text-accent")}
                      aria-hidden
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && !item.available && (
                      <span className="ml-auto shrink-0 text-[10px] text-sidebar-muted">Soon</span>
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active-indicator"
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        className="sidebar-active-indicator absolute left-0 top-1.5 bottom-1.5 w-[3px] -translate-x-3 rounded-r-full bg-accent"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: account + theme + collapse */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-sidebar-ink">{username}</p>
              <p className="truncate text-[11px] text-sidebar-muted">{user?.is_admin ? "Administrator" : "Member"}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors duration-micro hover:bg-sidebar-ink/10 hover:text-sidebar-ink"
            >
              <LogOut size={15} strokeWidth={1.8} />
            </button>
          </div>
        )}

        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode (T)" : "Switch to light mode (T)"}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg text-xs font-medium text-sidebar-muted transition-colors duration-micro hover:bg-sidebar-ink/10 hover:text-sidebar-ink",
              collapsed ? "w-8 justify-center" : "px-2.5",
            )}
          >
            {theme === "light" ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
            {!collapsed && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors duration-micro hover:bg-sidebar-ink/10 hover:text-sidebar-ink"
          >
            {collapsed ? <ChevronsRight size={16} strokeWidth={1.8} /> : <ChevronsLeft size={16} strokeWidth={1.8} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
