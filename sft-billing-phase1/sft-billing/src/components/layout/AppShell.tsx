import { useEffect, type ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { AuraPanel } from "@/components/aura/AuraPanel";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const theme = useWorkspaceStore((s) => s.theme);

  // The only place `document` is touched directly — everywhere else in
  // the app reads `theme` from the store. Keeping this isolated here is
  // what makes the rest of the codebase environment-agnostic (works
  // identically in a browser tab or inside a Tauri webview).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette />
      <AuraPanel />
    </div>
  );
}
