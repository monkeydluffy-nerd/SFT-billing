import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, Plus, Search, Building2 } from "lucide-react";
import type { Client } from "@/types";
import { fuzzyMatch } from "@/lib/fuzzyMatch";
import { cn } from "@/lib/cn";

interface ClientComboboxProps {
  clients: Client[];
  value: string;
  onSelect: (clientId: string) => void;
  onCreateClient: (client: Pick<Client, "name" | "email" | "contactName">) => Promise<string>;
  disabled?: boolean;
}

/**
 * A search field that becomes a dropdown of matches, with a "+ add new
 * client" row that expands into two fields right inside the same
 * dropdown — the user never leaves Create Invoice to add someone new,
 * per blueprint §4.3.
 */
export function ClientCombobox({ clients, value, onSelect, onCreateClient, disabled }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickAdd, setQuickAdd] = useState<{ name: string; email: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find((c) => c.id === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuickAdd(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const results = useMemo(() => {
    if (query.trim() === "") return clients.slice(0, 8);
    return clients
      .map((client) => ({ client, match: fuzzyMatch(query, client.name) }))
      .filter(({ match }) => match.matches)
      .sort((a, b) => a.match.score - b.match.score)
      .map(({ client }) => client)
      .slice(0, 8);
  }, [clients, query]);

  async function submitQuickAdd() {
    if (!quickAdd || !quickAdd.name.trim() || creating) return;
    setCreating(true);
    const id = await onCreateClient({
      name: quickAdd.name.trim(),
      email: quickAdd.email.trim() || "billing@example.com",
      contactName: quickAdd.name.trim(),
    });
    setCreating(false);
    onSelect(id);
    setOpen(false);
    setQuickAdd(null);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-md border border-border bg-surface px-3 text-left text-sm transition-colors duration-micro",
          "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <Building2 size={15} className="shrink-0 text-ink-faint" aria-hidden />
        <span className={cn("flex-1 truncate", !selectedClient && "text-ink-faint")}>
          {selectedClient ? selectedClient.name : "Select a client"}
        </span>
        <ChevronDown size={15} className="shrink-0 text-ink-faint" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-md border border-border bg-surface-raised shadow-float">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={13} className="text-ink-faint" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients"
              className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  onSelect(client.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full flex-col px-3 py-2 text-left text-sm transition-colors duration-micro hover:bg-canvas",
                  client.id === value && "bg-accent/5 text-accent",
                )}
              >
                <span className="truncate font-medium">{client.name}</span>
                <span className="truncate text-xs text-ink-faint">{client.email}</span>
              </button>
            ))}
            {results.length === 0 && !quickAdd && (
              <p className="px-3 py-3 text-sm text-ink-muted">No clients match &quot;{query}&quot;</p>
            )}
          </div>

          <div className="border-t border-border p-2">
            {!quickAdd ? (
              <button
                type="button"
                onClick={() => setQuickAdd({ name: query, email: "" })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-accent transition-colors duration-micro hover:bg-accent/5"
              >
                <Plus size={14} /> Add new client
              </button>
            ) : (
              <div className="space-y-2 p-1">
                <input
                  autoFocus
                  value={quickAdd.name}
                  onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                  placeholder="Client or company name"
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
                <input
                  value={quickAdd.email}
                  onChange={(e) => setQuickAdd({ ...quickAdd, email: e.target.value })}
                  placeholder="Billing email"
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuickAdd(null)}
                    className="rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!quickAdd.name.trim() || creating}
                    onClick={submitQuickAdd}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink disabled:opacity-50"
                  >
                    {creating ? "Adding…" : "Add client"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
