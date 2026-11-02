import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

/**
 * A single calm confirmation line, bottom-left, auto-dismissing — used
 * for actions that succeeded but don't need a blocking dialog (sending a
 * reminder, marking an invoice paid). Never used for anything that needs
 * confirmation before it happens — that's Modal.tsx.
 */
export function Toast({ message, onDismiss, duration = 3200 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-sm text-ink shadow-float"
          role="status"
        >
          <CheckCircle2 size={15} className="shrink-0 text-success" aria-hidden />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
