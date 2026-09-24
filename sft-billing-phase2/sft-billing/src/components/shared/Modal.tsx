import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Used for the one kind of interruption this product allows: confirming a
 * real, hard-to-undo action (sending an invoice) before it happens — see
 * blueprint §4.3 and §14. Not used for anything else; ordinary edits and
 * navigation never go through a blocking dialog.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
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
            className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface-raised shadow-float-lg"
          >
            <div className="px-5 py-4">
              <p className="font-display text-lg text-ink">{title}</p>
              <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-canvas px-5 py-3">
              {footer}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
