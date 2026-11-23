import { useEffect, type ReactNode } from "react";
import { motion, MotionConfig } from "framer-motion";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { AuraPanel } from "@/components/aura/AuraPanel";
import { PaymentReceiptView } from "@/components/payments/PaymentReceiptView";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: ReactNode;
  /** Changes when the visible page changes, to trigger the enter animation. */
  pageKey?: string;
}

export function AppShell({ children, pageKey = "page" }: AppShellProps) {
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
      // Drop keyboard focus from whatever was clicked last so no stray focus
      // ring is left on a sidebar button after the theme flips.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      toggleTheme();
    }

    window.addEventListener("keydown", handleThemeShortcut);
    return () => window.removeEventListener("keydown", handleThemeShortcut);
  }, [toggleTheme]);

  return (
    <div className="app-shell-root flex h-screen w-full overflow-hidden bg-sidebar text-ink">
      <SidebarNav />
      <main
        className={cn(
          "app-shell-content my-2 mr-2 flex-1 min-w-0 overflow-y-auto rounded-2xl bg-canvas text-ink transition-colors duration-panel print:m-0 print:rounded-none print:border-0",
          theme === "dark" && "dark",
        )}
      >
        <TopBar />
        <MotionConfig reducedMotion="user">
          <motion.div
            key={pageKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-full w-full"
          >
            {children}
          </motion.div>
        </MotionConfig>
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
