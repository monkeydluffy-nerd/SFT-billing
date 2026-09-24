import { useEffect, type ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { AuraPanel } from "@/components/aura/AuraPanel";
import { PaymentReceiptView } from "@/components/payments/PaymentReceiptView";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const theme = useWorkspaceStore((s) => s.theme);
  const selectedPaymentId = useWorkspaceStore((s) => s.selectedPaymentId);
  const closePaymentReceipt = useWorkspaceStore((s) => s.closePaymentReceipt);

  // The only place `document` is touched directly — everywhere else in
  // the app reads `theme` from the store. Keeping this isolated here is
  // what makes the rest of the codebase environment-agnostic (works
  // identically in a browser tab or inside a Tauri webview).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="app-shell-root flex h-screen w-screen overflow-hidden bg-canvas text-ink">
      <SidebarNav />
      <main className="app-shell-content flex-1 overflow-y-auto">{children}</main>
      <CommandPalette />
      <AuraPanel />
      {selectedPaymentId && <PaymentReceiptView paymentId={selectedPaymentId} onClose={closePaymentReceipt} />}
    </div>
  );
}
