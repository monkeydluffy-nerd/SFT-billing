import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
  panelClassName?: string;
}

/**
 * Used for the one kind of interruption this product allows: confirming a
 * real, hard-to-undo action (sending an invoice) before it happens — see
 * blueprint §4.3 and §14. Not used for anything else; ordinary edits and
 * navigation never go through a blocking dialog.
 */
export function Modal({ open, onClose, title, children, footer, className, panelClassName }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-50 flex items-center justify-center", className)} role="dialog" aria-modal="true" aria-label={title} data-modal-root>
          <motion.div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            data-modal-backdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn("relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-float-lg", panelClassName)}
            data-modal-panel
          >
            <div className="min-h-0 overflow-y-auto px-5 py-4" data-modal-header>
              <p className="print:hidden font-display text-lg text-ink">{title}</p>
              <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
            </div>
            <div className="print:hidden flex shrink-0 items-center justify-end gap-2 border-t border-border bg-canvas px-5 py-3" data-modal-footer>
              {footer}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
