import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/pages/OverviewPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage";
import { CreateInvoicePage } from "@/pages/CreateInvoicePage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

/**
 * Page router — the single place where AppPage values map to rendered
 * content. Adding a Phase 3 page requires one new case here and nothing
 * else changes in App or AppShell.
 *
 * Create/Edit invoice is a full-page layout (no scroll wrapper from AppShell)
 * so it's rendered outside the standard shell flow.
 */
export function App() {
  const currentPage = useWorkspaceStore((s) => s.currentPage);

  // Create invoice uses the full viewport (own header + split pane layout)
  if (currentPage === "create-invoice") {
    return (
      <AppShell>
        <CreateInvoicePage />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {(() => {
        switch (currentPage) {
          case "invoices":
            return <InvoicesPage />;
          case "invoice-detail":
            return <InvoiceDetailPage />;
          case "clients":
            return <ClientsPage />;
          case "client-detail":
            return <ClientDetailPage />;
          case "payments":
            return <PaymentsPage />;
          case "overview":
          default:
            return <OverviewPage />;
        }
      })()}
    </AppShell>
  );
}
