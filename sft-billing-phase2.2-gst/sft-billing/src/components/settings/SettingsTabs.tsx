import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SettingsSectionDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsNavProps {
  sections: SettingsSectionDefinition[];
}

/**
 * In-page section navigation for a single, scrolling settings page.
 * Highlights the section currently in view and scrolls smoothly to a
 * section when one is chosen.
 */
export function SettingsNav({ sections }: SettingsNavProps) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        if (visible.size > 0) {
          const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
          setActive(top);
        }
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: 0 },
    );
    for (const section of sections) {
      const node = document.getElementById(section.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [sections]);

  function go(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      className="sticky top-[57px] z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-border bg-canvas/90 px-6 py-3 backdrop-blur-md lg:-mx-8 lg:px-8"
      aria-label="Settings sections"
    >
      {sections.map((section) => {
        const isActive = section.id === active;
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => go(section.id)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-left text-sm font-medium transition-colors duration-micro",
              isActive ? "bg-accent/10 text-accent" : "text-ink-muted hover:bg-surface hover:text-ink",
            )}
          >
            <Icon size={15} className="shrink-0" aria-hidden />
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
