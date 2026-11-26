import { useState, useRef, useEffect } from "react";
import { ChevronDown, Settings, Wrench, Monitor, LogOut } from "lucide-react";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/shared/Modal";

interface WorkspaceDropdownProps {
  businessName: string;
  monogram: string;
}

export function WorkspaceDropdown({ businessName, monogram }: WorkspaceDropdownProps) {
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { navigateTo, theme, toggleTheme } = useWorkspaceStore();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setLogoutOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleCheckForUpdates() {
    navigateTo("updates");
  }

  const menuItems = [
    { label: "Workspace Settings", icon: Settings, action: () => navigateTo("settings") },
    { label: "Check for Updates", icon: Wrench, action: handleCheckForUpdates },
    { label: theme === "light" ? "Dark Mode" : "Light Mode", icon: Monitor, action: toggleTheme },
  ] as const;

  function handleLogout() {
    setLogoutOpen(true);
    setOpen(false);
  }

  function confirmLogout() {
    logout();
    setLogoutOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Workspace menu"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-micro",
          "border-border bg-surface text-ink-muted hover:bg-canvas hover:text-ink"
        )}
      >
        <ChevronDown size={15} strokeWidth={1.6} aria-hidden />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-lg border border-border bg-surface-raised shadow-float overflow-hidden animate-slideDown"
          role="menu"
        >
          {/* Workspace Identity */}
          <div className="px-3 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold tracking-[0.08em] text-sidebar-ink">
                {monogram}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{businessName}</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">Workspace</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="py-1" role="menu" aria-label="Workspace actions">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
                role="menuitem"
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-ink-muted transition-colors duration-micro hover:bg-sidebar hover:text-sidebar-ink"
              >
                <item.icon size={14} strokeWidth={1.7} aria-hidden />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Divider and Log Out */}
          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={handleLogout}
              role="menuitem"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-overdue transition-colors duration-micro hover:bg-overdue/10 hover:text-overdue"
            >
              <LogOut size={14} strokeWidth={1.7} aria-hidden />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      )}

      {/* Logout Confirmation Modal */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Log Out"
        footer={
          <>
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              className="flex items-center gap-2 rounded-md bg-overdue px-3 py-1.5 text-sm font-medium text-overdue-ink transition-colors duration-micro hover:bg-overdue/90"
            >
              Log Out
            </button>
          </>
        }
      >
        Are you sure you want to log out? You will be redirected to the login screen.
      </Modal>
    </div>
  );
}