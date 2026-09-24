import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FilePlus2,
  UserPlus,
  CircleDollarSign,
  AlertTriangle,
  Clock3,
  LayoutGrid,
  FileText,
  Users,
  CreditCard,
  BarChart3,
  FileBarChart,
  Settings,
  Search,
  CornerDownLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useWorkspaceStore, type AppPage } from "@/hooks/useWorkspaceStore";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { getClientName } from "@/lib/clientLookup";
import { formatCurrency } from "@/lib/formatters";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import { cn } from "@/lib/cn";

interface PaletteItem {
  id: string;
  group: "Quick Actions" | "Navigation" | "Invoices";
  label: string;
  hint?: string;
  icon: LucideIcon;
  available: boolean;
  shortcut?: string;
  run: () => void;
}

const NAV_TARGETS: { page: AppPage; label: string; icon: LucideIcon; available: boolean }[] = [
  { page: "overview", label: "Overview", icon: LayoutGrid, available: true },
  { page: "invoices", label: "Invoices", icon: FileText, available: true },
  { page: "clients", label: "Clients", icon: Users, available: true },
  { page: "payments", label: "Payments", icon: CreditCard, available: true },
  { page: "intelligence", label: "Intelligence", icon: BarChart3, available: true },
  { page: "reports", label: "Reports", icon: FileBarChart, available: true },
  { page: "settings", label: "Workspace Settings", icon: Settings, available: true },
];

/**
 * Overview, Invoices, and Create Invoice are real screens as of Phase 2.
 * Every item here either does something real today, or is visibly
 * labeled with the phase it arrives in — never a silent dead click, see
 * blueprint §24.
 */
export function CommandPalette() {
  const {
    commandPaletteOpen,
    closeCommandPalette,
    openCommandPalette,
    navigateTo,
    goToInvoices,
    navigateToInvoiceDetail,
    openCreateInvoice,
  } = useWorkspaceStore();
  const { data: invoices } = useInvoices();
  const { data: clients } = useClients();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl/Cmd+K, works everywhere, and Escape to close.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette();
      }
      if (e.key === "Escape") {
        closeCommandPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette, closeCommandPalette]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const quickActions: PaletteItem[] = [
      {
        id: "qa-new-invoice",
        group: "Quick Actions",
        label: "Create new invoice",
        icon: FilePlus2,
        available: true,
        run: () => openCreateInvoice(),
      },
      {
        id: "qa-add-client",
        group: "Quick Actions",
        label: "Add client",
        icon: UserPlus,
        available: true,
        hint: "Opens Clients",
        run: () => navigateTo("clients"),
      },
      {
        id: "qa-record-payment",
        group: "Quick Actions",
        label: "Record payment",
        icon: CircleDollarSign,
        available: true,
        hint: "Opens Payments",
        run: () => navigateTo("payments"),
      },
      {
        id: "qa-show-overdue",
        group: "Quick Actions",
        label: "Show overdue invoices",
        icon: AlertTriangle,
        available: true,
        run: () => goToInvoices("overdue"),
      },
      {
        id: "qa-show-pending",
        group: "Quick Actions",
        label: "Show pending invoices",
        icon: Clock3,
        available: true,
        run: () => goToInvoices("pending"),
      },
    ];

    const navigation: PaletteItem[] = NAV_TARGETS.map((target) => ({
      id: `nav-${target.page}`,
      group: "Navigation",
      label: target.label,
      icon: target.icon,
      available: target.available,
      hint: target.available ? undefined : "Coming soon",
      run: () => navigateTo(target.page),
    }));

    const invoiceResults: PaletteItem[] =
      (invoices ?? []).slice(0, 200).map((invoice) => {
        const info = getInvoiceStatus(invoice);
        const { total } = computeInvoiceTotals(invoice);
        const clientName = getClientName(clients, invoice.clientId);
        return {
          id: `inv-${invoice.id}`,
          group: "Invoices" as const,
          label: `${invoice.number} — ${clientName}`,
          hint: `${formatCurrency(total)} · ${info.status}`,
          icon: FileText,
          available: true,
          run: () => navigateToInvoiceDetail(invoice.id),
        };
      });

    return [...quickActions, ...navigation, ...invoiceResults];
  }, [invoices, clients, navigateTo, goToInvoices, navigateToInvoiceDetail, openCreateInvoice]);

  const filtered = useMemo(() => {
    if (query.trim() === "") {
      // Curated default view: quick actions + navigation, no invoice noise.
      return items.filter((item) => item.group !== "Invoices");
    }
    return items
      .map((item) => ({ item, match: fuzzyMatch(query, item.label) }))
      .filter(({ match }) => match.matches)
      .sort((a, b) => a.match.score - b.match.score)
      .map(({ item }) => item)
      .slice(0, 40);
  }, [items, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {};
    for (const item of filtered) {
      groups[item.group] = groups[item.group] ?? [];
      groups[item.group].push(item);
    }
    return groups;
  }, [filtered]);

  useEffect(() => setSelectedIndex(0), [query]);

  function execute(item: PaletteItem) {
    if (!item.available) return;
    item.run();
    closeCommandPalette();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) execute(item);
    }
  }

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closeCommandPalette}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface-raised shadow-float-lg"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={16} className="text-ink-faint" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search or run a command"
                className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                aria-label="Command palette search"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-faint">Esc</kbd>
            </div>

            <div className="max-h-[50vh] overflow-y-auto py-2">
              {filtered.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">No results for &quot;{query}&quot;</p>
              )}

              {(["Quick Actions", "Navigation", "Invoices"] as const).map((group) => {
                const groupItems = grouped[group];
                if (!groupItems?.length) return null;
                return (
                  <div key={group} className="px-2 py-1">
                    <p className="px-2 py-1.5 text-xs font-medium text-ink-faint">{group}</p>
                    {groupItems.map((item) => {
                      flatIndex += 1;
                      const isSelected = flatIndex === selectedIndex;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!item.available}
                          onClick={() => execute(item)}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-micro",
                            isSelected && item.available ? "bg-accent/10 text-accent" : "text-ink",
                            !item.available && "cursor-not-allowed opacity-45",
                          )}
                        >
                          <Icon size={16} className="shrink-0" aria-hidden />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.hint && <span className="shrink-0 text-xs text-ink-faint">{item.hint}</span>}
                          {isSelected && item.available && <CornerDownLeft size={13} className="shrink-0" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
