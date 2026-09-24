import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Plus, Mail, Phone, MapPin, Calendar, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { StatusChip } from "@/components/shared/StatusChip";
import { Modal } from "@/components/shared/Modal";
import { FormField, Input, Textarea } from "@/components/shared/FormField";
import { EmptyState } from "@/components/shared/EmptyState";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { useAppStore } from "@/stores/appStore";
import { getInvoiceStatus, computeInvoiceTotals } from "@/lib/invoiceMath";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import type { Client } from "@/types";

// ---------------------------------------------------------------------------
// Edit Client Modal
// ---------------------------------------------------------------------------
interface EditClientModalProps {
  client: Client;
  open: boolean;
  onClose: () => void;
}

function EditClientModal({ client, open, onClose }: EditClientModalProps) {
  const { updateClient } = useAppStore();
  const [form, setForm] = useState({
    name: client.name,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone ?? "",
    billingAddress: client.billingAddress,
    taxId: client.taxId ?? "",
    website: client.website ?? "",
    notes: client.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    updateClient({
      ...client,
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      billingAddress: form.billingAddress.trim(),
      taxId: form.taxId.trim() || undefined,
      website: form.website.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit client" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Company / Name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Contact name">
            <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email" required error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
          <FormField label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Billing address">
          <Textarea value={form.billingAddress} onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))} className="min-h-[60px]" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tax ID (GSTIN / PAN)">
            <Input value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} placeholder="22ABCDE1234F1Z5" />
          </FormField>
          <FormField label="Website">
            <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://company.com" />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this client…" className="min-h-[60px]" />
        </FormField>
        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm">Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function ClientDetailPage() {
  const { selectedClientId, navigateTo, navigateToCreateInvoice, navigateToInvoice } = useWorkspaceStore();
  const { getClientById, getInvoicesForClient, getPaymentsForClient, activity } = useAppStore();

  const [editOpen, setEditOpen] = useState(false);

  const client = selectedClientId ? getClientById(selectedClientId) : undefined;
  const invoices = client ? getInvoicesForClient(client.id) : [];
  const payments = client ? getPaymentsForClient(client.id) : [];

  // Financial summary
  const financials = useMemo(() => {
    const nonCancelled = invoices.filter((i) => !i.cancelledAt);
    const totalInvoiced = nonCancelled.reduce((sum, i) => sum + computeInvoiceTotals(i).total, 0);
    const totalPaid = nonCancelled.reduce((sum, i) => sum + (i.paidAmount ?? (i.paidAt ? computeInvoiceTotals(i).total : 0)), 0);
    const outstanding = totalInvoiced - totalPaid;
    return { totalInvoiced, totalPaid, outstanding, invoiceCount: nonCancelled.length };
  }, [invoices]);

  // Client activity
  const clientActivity = useMemo(() =>
    activity
      .filter((e) => e.clientId === client?.id)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 20),
    [activity, client?.id]
  );

  // Sorted invoices (most recent first)
  const sortedInvoices = useMemo(() =>
    [...invoices].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [invoices]
  );

  if (!client) {
    return (
      <div>
        <PageHeader title="Client" />
        <div className="px-10 py-16">
          <EmptyState icon={Mail} title="Client not found" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={client.contactName}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 size={14} />
              Edit
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigateToCreateInvoice(client.id)}>
              <Plus size={14} />
              Create Invoice
            </Button>
          </div>
        }
      />

      <div className="px-10 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigateTo("clients")}
            className="flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-micro hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back to Clients
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]"
        >
          {/* LEFT */}
          <div className="space-y-6">

            {/* Financial summary strip */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Invoiced", value: formatCurrency(financials.totalInvoiced), sub: `${financials.invoiceCount} invoices` },
                { label: "Total Collected", value: formatCurrency(financials.totalPaid), sub: `${payments.length} payments` },
                { label: "Outstanding", value: formatCurrency(financials.outstanding), sub: financials.outstanding > 0 ? "Needs attention" : "All clear", alert: financials.outstanding > 0 },
              ].map((stat) => (
                <div key={stat.label} className={cn("rounded-lg border bg-surface p-4", stat.alert ? "border-caution/40" : "border-border")}>
                  <p className="text-xs text-ink-muted">{stat.label}</p>
                  <p className={cn("font-tabular mt-1 text-xl font-medium", stat.alert ? "text-caution" : "text-ink")}>{stat.value}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Invoice list */}
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-sm font-medium text-ink">Invoices</p>
                <button
                  type="button"
                  onClick={() => navigateToCreateInvoice(client.id)}
                  className="text-xs text-accent hover:underline"
                >
                  + Create invoice
                </button>
              </div>
              {sortedInvoices.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon={Mail} title="No invoices yet" description="Create the first invoice for this client." />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas text-left text-xs text-ink-muted">
                      <th className="px-5 py-2.5 font-medium">Invoice</th>
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Due</th>
                      <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedInvoices.map((invoice) => {
                      const status = getInvoiceStatus(invoice);
                      const { total } = computeInvoiceTotals(invoice);
                      return (
                        <tr
                          key={invoice.id}
                          onClick={() => navigateToInvoice(invoice.id)}
                          className="cursor-pointer transition-colors duration-micro hover:bg-canvas"
                        >
                          <td className="px-5 py-3 font-medium text-accent">{invoice.number}</td>
                          <td className="px-4 py-3 text-ink-muted">{formatDate(invoice.issueDate)}</td>
                          <td className="px-4 py-3 text-ink-muted">{formatDate(invoice.dueDate)}</td>
                          <td className="font-tabular px-4 py-3 text-right text-ink">{formatCurrency(total)}</td>
                          <td className="px-5 py-3"><StatusChip info={status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent payments */}
            {payments.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-5 py-3">
                  <p className="text-sm font-medium text-ink">Payment history</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas text-left text-xs text-ink-muted">
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Invoice</th>
                      <th className="px-4 py-2.5 font-medium">Method</th>
                      <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...payments]
                      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
                      .map((payment) => {
                        const inv = invoices.find((i) => i.id === payment.invoiceId);
                        return (
                          <tr key={payment.id} className="transition-colors duration-micro hover:bg-canvas">
                            <td className="px-5 py-3 text-ink-muted">{formatDate(payment.receivedAt)}</td>
                            <td
                              className="cursor-pointer px-4 py-3 text-accent hover:underline"
                              onClick={() => inv && navigateToInvoice(inv.id)}
                            >
                              {inv?.number ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-ink-muted capitalize">{payment.method.replace("_", " ")}</td>
                            <td className="font-tabular px-4 py-3 text-right font-medium text-success">{formatCurrency(payment.amount, true)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: Profile + Activity */}
          <div className="space-y-6">

            {/* Contact card */}
            <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
              <p className="text-sm font-medium text-ink">Contact</p>
              <div className="space-y-2 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Mail size={13} className="shrink-0 text-ink-faint" />
                    <a href={`mailto:${client.email}`} className="hover:text-accent hover:underline">{client.email}</a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Phone size={13} className="shrink-0 text-ink-faint" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.billingAddress && (
                  <div className="flex items-start gap-2 text-ink-muted">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                    <span>{client.billingAddress}</span>
                  </div>
                )}
                {client.website && (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <ExternalLink size={13} className="shrink-0 text-ink-faint" />
                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline truncate">
                      {client.website}
                    </a>
                  </div>
                )}
                {client.taxId && (
                  <div className="mt-1 text-xs text-ink-faint">Tax ID: {client.taxId}</div>
                )}
                {client.clientSince && (
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    <Calendar size={12} />
                    Client since {formatDate(client.clientSince)}
                  </div>
                )}
              </div>
              {client.notes && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-ink-muted">{client.notes}</p>
                </div>
              )}
            </div>

            {/* Recent activity */}
            {clientActivity.length > 0 && (
              <div className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium text-ink">Recent activity</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {clientActivity.map((event) => (
                    <div key={event.id} className="text-xs">
                      <p className="text-ink leading-relaxed">{event.summary}</p>
                      <p className="mt-0.5 text-ink-faint">{formatRelativeTime(event.occurredAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <EditClientModal client={client} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
