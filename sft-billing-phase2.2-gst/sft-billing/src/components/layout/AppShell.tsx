import { useEffect, type ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { AuraPanel } from "@/components/aura/AuraPanel";
import { PaymentReceiptView } from "@/components/payments/PaymentReceiptView";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const theme = useWorkspaceStore((s) => s.theme);
  const toggleTheme = useWorkspaceStore((s) => s.toggleTheme);
  const selectedPaymentId = useWorkspaceStore((s) => s.selectedPaymentId);
  const closePaymentReceipt = useWorkspaceStore((s) => s.closePaymentReceipt);

  useEffect(() => {
    function handleThemeShortcut(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "t" ||
        event.repeat ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      const activeElement = document.activeElement;
      if (isEditableTarget(target) || isEditableTarget(activeElement)) return;

      event.preventDefault();
      toggleTheme();
    }

    window.addEventListener("keydown", handleThemeShortcut);
    return () => window.removeEventListener("keydown", handleThemeShortcut);
  }, [toggleTheme]);

  return (
    <div className="app-shell-root flex h-screen w-full overflow-hidden bg-canvas text-ink">
      <SidebarNav />
      <main
        className={cn(
          "app-shell-content flex-1 min-w-0 overflow-y-auto bg-canvas text-ink transition-colors duration-panel",
          theme === "dark" && "dark",
        )}
      >
        {children}
      </main>
      <div data-theme-scope="overlays" className={cn(theme === "dark" && "dark")}>
        <CommandPalette />
        <AuraPanel />
        {selectedPaymentId && <PaymentReceiptView paymentId={selectedPaymentId} onClose={closePaymentReceipt} />}
      </div>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [data-editor], .cm-content, .monaco-editor',
    ) !== null
  );
}
