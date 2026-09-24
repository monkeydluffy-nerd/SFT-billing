import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
}

/**
 * Used before irreversible actions: cancel invoice, delete item, etc.
 * Always requires explicit confirmation — never fires on first click.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-caution-bg">
            <AlertTriangle size={16} className="text-caution" />
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { onConfirm(); onClose(); }}
            className={variant === "danger" ? "bg-overdue-strong text-white hover:opacity-90" : ""}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
