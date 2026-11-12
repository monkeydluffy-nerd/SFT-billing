import { useState, useRef, useEffect, useMemo } from "react";
import { Bell, Check, Package, FileText, Users, CreditCard, Settings, Wrench, Globe } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/formatters";

type IconComponent = React.ComponentType<Record<string, unknown>>;

const ICONS: Record<string, IconComponent> = {
  invoice_created: FileText,
  invoice_updated: FileText,
  invoice_cancelled: FileText,
  payment_received: CreditCard,
  payment_updated: CreditCard,
  client_created: Users,
  client_updated: Users,
  product_created: Package,
  product_updated: Package,
  settings_changed: Settings,
  update_available: Wrench,
  update_downloaded: Wrench,
  update_installed: Wrench,
  update_failed: Wrench,
  app_new_version: Globe,
  test_notification: Bell,
};

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business",
  payments: "Payments",
  clients: "Clients",
  products: "Products",
  settings: "Settings",
  updates: "Updates",
  system: "System",
};

export function NotificationBell() {
  const { data: notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const notificationList = useMemo(() => notifications ?? [], [notifications]);
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const unreadNotifications = useMemo(
    () => notificationList.filter((n) => !n.read),
    [notificationList]
  );

  const filteredNotifications = useMemo(
    () => (filterCategory ? notificationList.filter((n) => n.category === filterCategory) : notificationList),
    [notificationList, filterCategory]
  );

  const categories = Object.entries({
    business: "Business",
    payments: "Payments",
    clients: "Clients",
    products: "Products",
    settings: "Settings",
    updates: "Updates",
    system: "System",
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-micro",
          "border-border bg-surface text-ink-muted hover:bg-canvas hover:text-ink"
        )}
      >
        <Bell size={16} strokeWidth={1.6} aria-hidden />
        {unreadCount > 0 && (
          <span className="live-dot absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-premium" aria-hidden="true" />
        )}
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-overdue text-[10px] font-medium text-overdue-ink">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full z-30 mt-2 w-[360px] max-h-[480px] rounded-lg border border-border bg-surface-raised shadow-float overflow-hidden animate-slideDown"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={16} strokeWidth={1.6} className="text-premium" aria-hidden />
              <h3 className="font-medium text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-premium/10 px-2 py-0.5 text-[10px] font-medium text-premium">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterCategory || "all"}
                onChange={(e) => setFilterCategory(e.target.value === "all" ? null : e.target.value)}
                className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs font-medium transition-colors duration-micro outline-none focus:border-premium"
              >
                <option value="all">All categories</option>
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {unreadNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead(filterCategory || undefined)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-premium hover:bg-premium/10 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={32} className="mx-auto text-ink-faint" aria-hidden />
                <p className="mt-2 text-sm text-ink-muted">
                  {filterCategory ? `No notifications in ${CATEGORY_LABELS[filterCategory || ""]}` : "No notifications yet"}
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  {filterCategory
                    ? "Try selecting a different category"
                    : "Business activity, payments, and updates will appear here."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50" role="list" aria-label="Notifications">
                {filteredNotifications.map((notification, _index) => {
                  const Icon = ICONS[notification.type] || Bell;
                  return (
                    <li
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-3 py-3 px-4 transition-colors",
                        notification.read ? "bg-surface" : "bg-premium/5"
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-canvas text-ink-muted">
                        <Icon size={13} strokeWidth={1.7} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-5 text-ink">{notification.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">{notification.message}</p>
                        <time className="shrink-0 flex items-center gap-1.5 mt-1.5 text-xs text-ink-faint">
                          {formatRelativeTime(notification.occurredAt)}
                          {!notification.read && (
                            <span className="rounded-full bg-premium/10 px-1.5 py-0.5 text-[10px] font-medium text-premium">
                              New
                            </span>
                          )}
                        </time>
                      </div>
                      <button
                        type="button"
                        onClick={() => markRead(notification.id)}
                        className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:bg-canvas hover:text-ink transition-colors"
                        aria-label={notification.read ? "Mark as unread" : "Mark as read"}
                      >
                        <Check size={12} className={cn("text-premium", notification.read && "opacity-50")} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Mark All Read Footer */}
          {unreadNotifications.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <button
                type="button"
                onClick={() => markAllRead(filterCategory || undefined)}
                className="w-full rounded-md py-1.5 text-sm font-medium text-premium hover:bg-premium/10 transition-colors"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}