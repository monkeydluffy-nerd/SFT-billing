import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  ChevronRight,
  Plus,
  ArrowUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import type { Client, Invoice } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SortKey = "name-asc" | "name-desc" | "most-invoiced" | "most-recent";

interface ClientRow {
  client: Client;
  totalInvoiced: number;
  outstanding: number;
  invoiceCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildClientRows(clients: Client[], invoices: Invoice[]): ClientRow[] {
  return clients.map((client) => {
    const clientInvoices = invoices.filter(
      (inv) => inv.clientId === client.id && !inv.cancelledAt,
    );

    let totalInvoiced = 0;
    let outstanding = 0;

    for (const inv of clientInvoices) {
      const totals = computeInvoiceTotals(inv);
      totalInvoiced += totals.total;

      // Outstanding = total minus paid amount, only for non-fully-paid invoices
      const isPaid = inv.paidAt !== undefined || (inv.paidAmount ?? 0) >= totals.total;
      if (!isPaid) {
        outstanding += totals.outstanding;
      }
    }

    return {
      client,
      totalInvoiced,
      outstanding,
      invoiceCount: clientInvoices.length,
    };
  });
}

function sortRows(rows: ClientRow[], sort: SortKey): ClientRow[] {
  return [...rows].sort((a, b) => {
    switch (sort) {
      case "name-asc":
        return a.client.name.localeCompare(b.client.name);
      case "name-desc":
        return b.client.name.localeCompare(a.client.name);
      case "most-invoiced":
        return b.totalInvoiced - a.totalInvoiced;
      case "most-recent":
        return (
          new Date(b.client.clientSince).getTime() -
          new Date(a.client.clientSince).getTime()
        );
      default:
        return 0;
    }
  });
}

function matchesSearch(row: ClientRow, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const { client } = row;
  return (
    client.name.toLowerCase().includes(q) ||
    client.email.toLowerCase().includes(q) ||
    (client.phone?.toLowerCase().includes(q) ?? false) ||
    client.contactName.toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "most-invoiced", label: "Most Invoiced" },
  { value: "most-recent", label: "Most Recent" },
];

// ---------------------------------------------------------------------------
// ClientsPage
// ---------------------------------------------------------------------------
export function ClientsPage() {
  const { data: clients } = useClients();
  const { data: invoices } = useInvoices();
  const navigateToClient = useWorkspaceStore((s) => s.navigateToClient);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [addOpen, setAddOpen] = useState(false);

  const allRows = useMemo(
    () => buildClientRows(clients ?? [], invoices ?? []),
    [clients, invoices],
  );

  const filteredRows = useMemo(() => {
    const searched = allRows.filter((r) => matchesSearch(r, search));
    return sortRows(searched, sort);
  }, [allRows, search, sort]);

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <PageHeader
        title="Clients"
        subtitle={
          clients && clients.length > 0
            ? `${clients.length} client${clients.length === 1 ? "" : "s"}`
            : "No clients yet"
        }
        action={
          <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden />
            Add Client
          </Button>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Toolbar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-10 py-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className={cn(
              "h-9 w-full rounded-md border border-border bg-canvas pl-8 pr-3 text-sm text-ink",
              "placeholder:text-ink-faint outline-none transition-colors duration-micro",
              "focus:border-border-strong focus:ring-1 focus:ring-accent/20",
            )}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <ArrowUpDown size={14} aria-hidden />
          <span className="hidden sm:inline">Sort:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={cn(
              "h-9 rounded-md border border-border bg-canvas pl-3 pr-8 text-sm text-ink cursor-pointer",
              "outline-none transition-colors duration-micro",
              "focus:border-border-strong focus:ring-1 focus:ring-accent/20",
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-10 py-6">
        {filteredRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No clients match your search" : "No clients yet"}
            description={
              search
                ? "Try a different name, email, or phone number."
                : "Add your first client to start creating invoices."
            }
            action={
              !search ? (
                <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus size={14} aria-hidden />
                  Add Client
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {/* Table header */}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-x-4 border-b border-border bg-surface px-5 py-3">
              <span className="text-xs font-medium text-ink-muted">Client</span>
              <span className="text-xs font-medium text-ink-muted">Email</span>
              <span className="text-xs font-medium text-ink-muted">Phone</span>
              <span className="text-xs font-medium text-ink-muted">Client Since</span>
              <span className="text-xs font-medium text-ink-muted text-right">Total Invoiced</span>
              <span className="text-xs font-medium text-ink-muted text-right">Outstanding</span>
              <span />
            </div>

            {/* Table rows */}
            <AnimatePresence initial={false}>
              {filteredRows.map((row, idx) => (
                <ClientTableRow
                  key={row.client.id}
                  row={row}
                  isLast={idx === filteredRows.length - 1}
                  onClick={() => navigateToClient(row.client.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add Client Modal                                                     */}
      {/* ------------------------------------------------------------------ */}
      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          setAddOpen(false);
          navigateToClient(id);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClientTableRow
// ---------------------------------------------------------------------------
interface ClientTableRowProps {
  row: ClientRow;
  isLast: boolean;
  onClick: () => void;
}

function ClientTableRow({ row, isLast, onClick }: ClientTableRowProps) {
  const { client, totalInvoiced, outstanding, invoiceCount } = row;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "grid w-full grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px]",
        "gap-x-4 px-5 py-4 text-left",
        "bg-surface transition-colors duration-micro hover:bg-surface-raised",
        !isLast && "border-b border-border",
      )}
    >
      {/* Client name + contact */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{client.name}</p>
        <p className="truncate text-xs text-ink-muted">{client.contactName}</p>
      </div>

      {/* Email */}
      <div className="flex items-center min-w-0">
        <span className="truncate text-sm text-ink-muted">{client.email}</span>
      </div>

      {/* Phone */}
      <div className="flex items-center min-w-0">
        <span className="truncate text-sm text-ink-muted">
          {client.phone ?? <span className="text-ink-faint">—</span>}
        </span>
      </div>

      {/* Client since */}
      <div className="flex items-center">
        <span className="text-sm text-ink-muted">{formatDate(client.clientSince)}</span>
      </div>

      {/* Total invoiced */}
      <div className="flex items-center justify-end">
        <div className="text-right">
          <p className="text-sm font-medium text-ink">{formatCurrency(totalInvoiced)}</p>
          <p className="text-xs text-ink-faint">
            {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Outstanding */}
      <div className="flex items-center justify-end">
        <span
          className={cn(
            "text-sm font-medium",
            outstanding > 0 ? "text-overdue" : "text-success",
          )}
        >
          {outstanding > 0 ? formatCurrency(outstanding) : "Nil"}
        </span>
      </div>

      {/* Chevron */}
      <div className="flex items-center justify-center">
        <ChevronRight size={16} className="text-ink-faint" aria-hidden />
      </div>
    </motion.button>
  );
}
