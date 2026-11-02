import { Search, X, Calendar, ChevronDown, Filter, CheckCircle2, AlertTriangle, Clock, FileEdit } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Client, Invoice, InvoiceStatus, Payment } from "@/types";
import { cn } from "@/lib/cn";
import { getInvoiceWorkflowStatus } from "@/lib/invoiceMath";

interface InvoiceFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: InvoiceStatus | null;
  onStatusChange: (status: InvoiceStatus | null) => void;
  clientFilter: string | null;
  onClientChange: (clientId: string | null) => void;
  clients: Client[] | undefined;
  invoices: Invoice[] | undefined;
  payments: Payment[] | undefined;
  dateRange: { from: Date | null; to: Date | null };
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string; icon: typeof AlertTriangle | typeof CheckCircle2 | typeof Clock | typeof FileEdit }[] = [
  { value: "pending", label: "Outstanding", icon: Clock },
  { value: "paid", label: "Received", icon: CheckCircle2 },
  { value: "overdue", label: "Overdue", icon: AlertTriangle },
  { value: "draft", label: "Draft", icon: FileEdit },
];

const DATE_RANGES = [
  { label: "This month", getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) }; } },
  { label: "Last month", getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }; } },
  { label: "This quarter", getRange: () => { const now = new Date(); const q = Math.floor(now.getMonth() / 3); return { from: new Date(now.getFullYear(), q * 3, 1), to: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59) }; } },
  { label: "FY 2026-27", getRange: () => ({ from: new Date(2026, 3, 1), to: new Date(2027, 2, 31, 23, 59, 59) }) },
  { label: "All time", getRange: () => ({ from: null, to: null }) },
];

function getStatusCounts(invoices: InvoiceFilterBarProps["invoices"], payments: InvoiceFilterBarProps["payments"]) {
  const counts: Record<InvoiceStatus, number> = { pending: 0, paid: 0, overdue: 0, draft: 0 };
  if (!invoices) return counts;
  for (const inv of invoices) {
    if (inv.isDraft) {
      counts.draft++;
      continue;
    }
    const info = getInvoiceWorkflowStatus(inv, payments ?? []);
    if (info.status === "draft") counts.draft++;
    else if (info.status === "received") counts.paid++;
    else if (info.status === "outstanding") counts.pending++;
    else if (info.status === "overdue") counts.overdue++;
  }
  return counts;
}

export function InvoiceFilterBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusChange,
  clientFilter,
  onClientChange,
  clients,
  invoices,
  payments,
  dateRange,
  onDateRangeChange,
}: InvoiceFilterBarProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  const statusCounts = getStatusCounts(invoices, payments);
  const filteredClients = clients?.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  ) ?? [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownOpen && clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
      if (dateDropdownOpen && dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setDateDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clientDropdownOpen, dateDropdownOpen]);

  const hasActiveFilters = statusFilter || clientFilter || query || dateRange.from || dateRange.to;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="flex h-9 min-w-[220px] items-center gap-2 rounded-md border border-border bg-surface px-3">
        <Search size={14} className="text-ink-faint" aria-hidden />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search invoice or client"
          className="h-full flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          aria-label="Search invoices"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} aria-label="Clear search">
            <X size={13} className="text-ink-faint" />
          </button>
        )}
      </div>

      {/* Status Filter Chips with Counts */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        {STATUS_OPTIONS.map((option) => {
          const active = statusFilter === option.value;
          const count = statusCounts[option.value];
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusChange(active ? null : option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-micro",
                active
                  ? "bg-accent text-accent-ink border-accent shadow-sm"
                  : "border-border bg-surface text-ink-muted hover:border-border-strong hover:bg-canvas",
              )}
              aria-pressed={active}
            >
              <Icon size={12} aria-hidden />
              {option.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-tabular", active ? "bg-accent-ink/20" : "bg-canvas/50")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Client Filter - Custom Searchable Dropdown */}
      <div className="relative" ref={clientDropdownRef}>
        <button
          type="button"
          onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors duration-micro",
            clientFilter ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-ink hover:border-border-strong",
          )}
          aria-haspopup="listbox"
          aria-expanded={clientDropdownOpen}
          aria-label="Filter by client"
        >
          <Filter size={14} className={clientFilter ? "text-accent" : "text-ink-muted"} aria-hidden />
          <span className="truncate max-w-[160px]">
            {clientFilter ? clients?.find((c) => c.id === clientFilter)?.name ?? "Client" : "All clients"}
          </span>
          <ChevronDown size={14} className={cn("text-ink-muted transition-transform duration-micro", clientDropdownOpen && "rotate-180")} aria-hidden />
        </button>

        {clientDropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 min-w-[240px] max-h-64 rounded-lg border border-border bg-surface shadow-float-lg overflow-hidden z-20 animate-in fade-in-0 zoom-in-95 duration-micro">
            <div className="border-b border-border p-2">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full h-8 rounded-md border border-border bg-canvas px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong"
                autoFocus
                aria-label="Search clients"
              />
            </div>
            <div className="max-h-48 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  onClientChange(null);
                  setClientDropdownOpen(false);
                  setClientSearch("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-micro",
                  !clientFilter ? "bg-accent/5 text-accent" : "text-ink hover:bg-canvas",
                )}
                role="option"
                aria-selected={!clientFilter}
              >
                <span className="flex-1">All clients</span>
                {!clientFilter && <CheckCircle2 size={14} className="text-accent" aria-hidden />}
              </button>
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    onClientChange(client.id);
                    setClientDropdownOpen(false);
                    setClientSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-micro",
                    clientFilter === client.id ? "bg-accent/5 text-accent" : "text-ink hover:bg-canvas",
                  )}
                  role="option"
                  aria-selected={clientFilter === client.id}
                >
                  <span className="flex-1 truncate">{client.name}</span>
                  {clientFilter === client.id && <CheckCircle2 size={14} className="text-accent" aria-hidden />}
                </button>
              ))}
              {filteredClients.length === 0 && clients?.length && (
                <div className="px-3 py-3 text-sm text-ink-muted text-center">No clients match</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Date Range Picker */}
      <div className="relative" ref={dateDropdownRef}>
        <button
          type="button"
          onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors duration-micro",
            dateRange.from || dateRange.to ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-ink hover:border-border-strong",
          )}
          aria-haspopup="listbox"
          aria-expanded={dateDropdownOpen}
          aria-label="Filter by date range"
        >
          <Calendar size={14} className={dateRange.from || dateRange.to ? "text-accent" : "text-ink-muted"} aria-hidden />
          <span className="truncate max-w-[160px]">
            {dateRange.from || dateRange.to
              ? `${dateRange.from ? dateRange.from.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "..."} – ${dateRange.to ? dateRange.to.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "..."}`
              : "All dates"}
          </span>
          <ChevronDown size={14} className={cn("text-ink-muted transition-transform duration-micro", dateDropdownOpen && "rotate-180")} aria-hidden />
        </button>

        {dateDropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 min-w-[200px] rounded-lg border border-border bg-surface shadow-float-lg overflow-hidden z-20 animate-in fade-in-0 zoom-in-95 duration-micro">
            <div className="p-2 border-b border-border text-xs font-medium text-ink-muted uppercase tracking-wider">Quick ranges</div>
            {DATE_RANGES.map((range) => {
              const r = range.getRange();
              const isActive = dateRange.from?.getTime() === r.from?.getTime() && dateRange.to?.getTime() === r.to?.getTime();
              return (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => {
                    onDateRangeChange(r);
                    setDateDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-micro",
                    isActive ? "bg-accent/5 text-accent" : "text-ink hover:bg-canvas",
                  )}
                  role="option"
                  aria-selected={isActive}
                >
                  <span className="flex-1">{range.label}</span>
                  {isActive && <CheckCircle2 size={14} className="text-accent" aria-hidden />}
                </button>
              );
            })}
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => {
                  onDateRangeChange({ from: null, to: null });
                  setDateDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-ink-muted hover:text-ink hover:bg-canvas transition-colors duration-micro"
              >
                <X size={14} className="text-ink-faint" aria-hidden />
                Clear date range
              </button>
            </div>
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            onStatusChange(null);
            onClientChange(null);
            onQueryChange("");
            onDateRangeChange({ from: null, to: null });
          }}
          className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}