import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/pages/OverviewPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { CreateInvoicePage } from "@/pages/CreateInvoicePage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

/**
 * Phase 2 wires "overview", "invoices", and "create-invoice" to real
 * content — SidebarNav disables navigation to everything past that, so
 * `currentPage` can't reach those cases yet. Each new page from Phase 3+
 * becomes one more case here; nothing about App or AppShell changes.
 */
export function App() {
  const currentPage = useWorkspaceStore((s) => s.currentPage);

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
    case "overview":
    default:
      return (
        <AppShell>
          <OverviewPage />
        </AppShell>
      );
  }
}
