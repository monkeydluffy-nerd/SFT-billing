import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * One collapsible-feeling but always-visible settings section - visually
 * consistent with the rest of the app's card language (border, radius,
 * spacing from tokens.css) rather than a generic settings-form look.
 */
export function SettingsSection({ icon: Icon, title, description, children }: SettingsSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-lg border border-border bg-surface"
    >
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon size={15} aria-hidden />
        </div>
        <div>
          <p className="font-display text-base text-ink">{title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </motion.section>
  );
}