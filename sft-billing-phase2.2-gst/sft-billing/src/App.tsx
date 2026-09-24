import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/pages/OverviewPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { CreateInvoicePage } from "@/pages/CreateInvoicePage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { InvoicePage } from "@/pages/InvoicePage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { IntelligencePage } from "@/pages/IntelligencePage";
import { ReportsPage } from "@/pages/ReportsPage";
import { WorkspaceSettingsPage } from "@/pages/WorkspaceSettingsPage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

/**
 * Phase 2 wires "overview", "invoices", and "create-invoice" to real
 * content - SidebarNav disables navigation to everything past that, so
 * `currentPage` can't reach those cases yet. Each new page from Phase 3+
 * becomes one more case here; nothing about App or AppShell changes.
 */
export function App() {
  const currentPage = useWorkspaceStore((s) => s.currentPage);
  const selectedClientId = useWorkspaceStore((s) => s.selectedClientId);

  switch (currentPage) {
    case "invoices":
      return (
        <AppShell>
          <InvoicesPage />
        </AppShell>
      );
    case "create-invoice":
      return (
        <AppShell>
          <CreateInvoicePage />
        </AppShell>
      );
    case "clients":
      return (
        <AppShell>
          {selectedClientId ? <ClientDetailPage /> : <ClientsPage />}
        </AppShell>
      );
    case "payments":
      return (
        <AppShell>
          <PaymentsPage />
        </AppShell>
      );
    case "invoice-detail":
      return (
        <AppShell>
          <InvoicePage />
        </AppShell>
      );
    case "intelligence":
      return (
        <AppShell>
          <IntelligencePage />
        </AppShell>
      );
    case "reports":
      return (
        <AppShell>
          <ReportsPage />
        </AppShell>
      );
    case "settings":
      return (
        <AppShell>
          <WorkspaceSettingsPage />
        </AppShell>
      );
    case "overview":
    default:
      return (
        <AppShell>
          <OverviewPage />
        </AppShell>
      );
  }
}