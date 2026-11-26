import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/pages/OverviewPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { CreateInvoicePage } from "@/pages/CreateInvoicePage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { InvoicePage } from "@/pages/InvoicePage";
import { PaymentsPage } from "@/pages/PaymentsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { WorkspaceSettingsPage } from "@/pages/WorkspaceSettingsPage";
import { UpdatesPage } from "@/pages/UpdatesPage";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import LoginPage from "@/features/login/LoginPage";
import SignUpPage from "@/features/login/SignUpPage";
import { getApiBaseUrl } from "@/services/backendPort";
import "@/features/login/login.css";

/**
 * Phase 2 wires "overview", "invoices", and "create-invoice" to real
 * content - SidebarNav disables navigation to everything past that, so
 * `currentPage` can't reach those cases yet. Each new page from Phase 3+
 * becomes one more case here; nothing about App or AppShell changes.
 */
export function App() {
  const [appReady, setAppReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const currentPage = useWorkspaceStore((s) => s.currentPage);
  const selectedClientId = useWorkspaceStore((s) => s.selectedClientId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const theme = useWorkspaceStore((s) => s.theme);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  // Keep the document root in sync with the theme so the login screen,
  // loading screen, and portals all follow the same light/dark setting.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const handleReady = useCallback(() => {
    setAppReady(true);
  }, []);

  const handleError = useCallback((error: string) => {
    setBackendError(error);
  }, []);

  // Check authentication state on startup
  useEffect(() => {
    let mounted = true;
    checkAuth().then(() => {
      if (mounted) {
        // Auth check complete, state updated in store
      }
    });
    return () => { mounted = false; };
  }, [checkAuth]);

  // First launch on a new install: no account exists yet, so show sign-up instead of login.
  useEffect(() => {
    if (!appReady || isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const base = await getApiBaseUrl();
        const res = await fetch(`${base}/api/auth/first-run-status`);
        const body = await res.json();
        if (!cancelled) setNeedsSetup(Boolean(body.needs_setup));
      } catch {
        if (!cancelled) setNeedsSetup(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appReady, isAuthenticated]);

  // Show loading screen until backend is ready
  if (!appReady) {
    return (
      <LoadingScreen 
        onReady={handleReady} 
        onError={handleError} 
      />
    );
  }

  // If there's a backend error, show it in the app shell
  if (backendError) {
    return (
      <AppShell>
        <div className="min-h-full bg-canvas flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-caution/10 ring-1 ring-caution/20">
              <svg className="h-10 w-10 text-caution" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="mb-3 text-2xl font-display text-ink">Backend Unavailable</h1>
            <p className="mb-6 text-ink-muted">
              The application backend could not be started. Some features may not work correctly.
            </p>
            <pre className="mb-6 p-4 text-left rounded-lg border border-border bg-surface text-sm text-ink-muted overflow-auto max-h-40">
              {backendError}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors duration-micro hover:bg-accent/90"
            >
              Reload Application
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Show sign-up (first launch) or login if not authenticated
  if (!isAuthenticated) {
    if (needsSetup === null) return null;
    if (needsSetup) return <SignUpPage logoSrc="/brand/surfine-horizontal.png" version="1.1.0" />;
    return <LoginPage logoSrc="/brand/surfine-horizontal.png" version="1.1.0" />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "invoices":
        return <InvoicesPage />;
      case "create-invoice":
        return <CreateInvoicePage />;
      case "clients":
        return selectedClientId ? <ClientDetailPage /> : <ClientsPage />;
      case "products":
        return <ProductsPage />;
      case "payments":
        return <PaymentsPage />;
      case "invoice-detail":
        return <InvoicePage />;
      case "reports":
      case "intelligence":
        return <ReportsPage />;
      case "settings":
        return <WorkspaceSettingsPage />;
      case "updates":
        return <UpdatesPage />;
      case "overview":
      default:
        return <OverviewPage />;
    }
  };

  // One persistent shell: the sidebar never remounts, and page changes animate.
  return <AppShell pageKey={`${currentPage}:${selectedClientId ?? ""}`}>{renderPage()}</AppShell>;
}
