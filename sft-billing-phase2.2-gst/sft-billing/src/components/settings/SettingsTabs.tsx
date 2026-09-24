import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type SettingsTabId = "general" | "billing" | "preferences" | "advanced";

export interface SettingsTabDefinition {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
}

interface SettingsTabsProps {
  tabs: SettingsTabDefinition[];
  active: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
}

/**
 * A left-hand rail, not another row of top tabs (Reports already owns
 * that pattern) - gives Workspace Settings its own distinct information
 * architecture so the user immediately understands "this is a
 * differently-organized page" rather than three pages that all look
 * like tab strips over tables.
 */
export function SettingsTabs({ tabs, active, onSelect }: SettingsTabsProps) {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0" aria-label="Settings sections">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-micro lg:w-full",
              isActive ? "bg-accent/10 text-accent" : "text-ink-muted hover:bg-canvas hover:text-ink",
            )}
          >
            <Icon size={15} className="shrink-0" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}