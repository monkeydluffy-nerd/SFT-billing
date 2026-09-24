import { Search, X } from "lucide-react";
import type { Client, InvoiceStatus } from "@/types";
import { cn } from "@/lib/cn";

interface InvoiceFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: InvoiceStatus | null;
  onStatusChange: (status: InvoiceStatus | null) => void;
  clientFilter: string | null;
  onClientChange: (clientId: string | null) => void;
  clients: Client[] | undefined;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Draft" },
];

export function InvoiceFilterBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusChange,
  clientFilter,
  onClientChange,
  clients,
}: InvoiceFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
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

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((option) => {
          const active = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusChange(active ? null : option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-micro",
                active ? "border-accent bg-accent/10 text-accent" : "border-border text-ink-muted hover:border-border-strong",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <select
        value={clientFilter ?? ""}
        onChange={(e) => onClientChange(e.target.value || null)}
        className="h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none"
        aria-label="Filter by client"
      >
        <option value="">All clients</option>
        {(clients ?? []).map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>

      {(statusFilter || clientFilter || query) && (
        <button
          type="button"
          onClick={() => {
            onStatusChange(null);
            onClientChange(null);
            onQueryChange("");
          }}
          className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
