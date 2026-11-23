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
 * One settings row: title and description on the left, the fields on the
 * right. Rows are full width and separated by hairlines, so section heights
 * never fight each other.
 */
export function SettingsSection({ icon: Icon, title, description, children }: SettingsSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="grid gap-5 py-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex items-start gap-3.5 lg:block">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent lg:mb-3">
          <Icon size={16} aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="min-w-0 max-w-4xl rounded-xl border border-border bg-surface p-6">{children}</div>
    </motion.section>
  );
}
