import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, CheckCircle2, FileText, FileSpreadsheet } from "lucide-react";
import type { Invoice } from "@/types";
import { cn } from "@/lib/cn";
import { downloadInvoiceTemplate } from "@/services/invoiceTemplateDownloadService";

interface ExportDropdownProps {
  invoice: Invoice;
  className?: string;
}

type ExportType = "pdf" | "excel";
type ButtonState = "idle" | "generating" | "done" | "error";

interface ExportItemState {
  state: ButtonState;
  errorMessage: string | null;
  warnings: string[];
}

interface MenuPosition {
  top: number;
  left: number;
}

export function ExportDropdown({ invoice, className }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [itemStates, setItemStates] = useState<Record<ExportType, ExportItemState>>({
    pdf: { state: "idle", errorMessage: null, warnings: [] },
    excel: { state: "idle", errorMessage: null, warnings: [] },
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!dropdownRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;

      const buttonRect = button.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportPadding = 8;
      const left = Math.max(
        viewportPadding,
        Math.min(buttonRect.left, window.innerWidth - menuRect.width - viewportPadding),
      );
      let top = buttonRect.bottom + 6;
      if (top + menuRect.height > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, buttonRect.top - menuRect.height - 6);
      }

      setMenuPosition({ top, left });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  async function handleExport(type: ExportType) {
    const currentState = itemStates[type];
    if (currentState.state === "generating") return;

    setItemStates((prev) => ({
      ...prev,
      [type]: { state: "generating", errorMessage: null, warnings: [] },
    }));

    try {
      const result = await downloadInvoiceTemplate(invoice, type);
      setItemStates((prev) => ({
        ...prev,
        [type]: { state: "done", errorMessage: null, warnings: result.warnings },
      }));
      window.setTimeout(() => {
        setItemStates((prev) => ({ ...prev, [type]: { ...prev[type], state: "idle" } }));
      }, 3000);
    } catch (error) {
      setItemStates((prev) => ({
        ...prev,
        [type]: {
          state: "error",
          errorMessage: error instanceof Error ? error.message : `Couldn't export the ${type.toUpperCase()} invoice.`,
          warnings: [],
        },
      }));
      window.setTimeout(() => {
        setItemStates((prev) => ({ ...prev, [type]: { ...prev[type], state: "idle" } }));
      }, 4000);
    }
  }

  function getLabel(type: ExportType) {
    const itemState = itemStates[type];
    if (itemState.state === "generating") return "Generating...";
    if (itemState.state === "done") return `${type.toUpperCase()} downloaded`;
    return type === "pdf" ? "Download PDF" : "Download Excel";
  }

  function getIcon(type: ExportType) {
    const itemState = itemStates[type];
    if (itemState.state === "generating") return <Loader2 size={14} className="animate-spin" aria-hidden />;
    if (itemState.state === "done") return <CheckCircle2 size={14} aria-hidden />;
    return type === "pdf" ? <FileText size={14} aria-hidden /> : <FileSpreadsheet size={14} aria-hidden />;
  }

  function getIconClass(type: ExportType) {
    const itemState = itemStates[type];
    if (itemState.state === "done") return "text-success";
    if (itemState.state === "error") return "text-overdue";
    return "text-ink-muted";
  }

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors duration-micro",
          "border-border bg-surface text-ink hover:border-border-strong",
          open && "ring-2 ring-accent/20",
        )}
      >
        <Download size={14} aria-hidden />
        Export
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-float"
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            visibility: menuPosition ? "visible" : "hidden",
          }}
          role="menu"
        >
          {(["pdf", "excel"] as ExportType[]).map((type) => {
            const itemState = itemStates[type];
            return (
              <div key={type} className="relative">
                <button
                  type="button"
                  onClick={() => handleExport(type)}
                  disabled={itemState.state === "generating"}
                  aria-busy={itemState.state === "generating"}
                  role="menuitem"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors duration-micro",
                    itemState.state === "generating" && "cursor-wait opacity-80",
                    "hover:bg-canvas focus:outline-none focus:bg-canvas",
                  )}
                >
                  <span className={cn(getIconClass(type), "flex-shrink-0")}>
                    {getIcon(type)}
                  </span>
                  <span className="truncate">{getLabel(type)}</span>
                </button>
                {itemState.state === "error" && itemState.errorMessage && (
                  <p
                    role="alert"
                    className="mx-2 mb-2 rounded-md bg-overdue-bg px-2.5 py-1.5 text-xs leading-snug text-overdue"
                  >
                    {itemState.errorMessage}
                  </p>
                )}
                {itemState.state === "done" && itemState.warnings.length > 0 && (
                  <p
                    role="status"
                    title={itemState.warnings.join("\n")}
                    className="mx-2 mb-2 rounded-md bg-canvas px-2.5 py-1.5 text-xs leading-snug text-ink-muted"
                  >
                    Downloaded. Some fields are not represented in this template.
                  </p>
                )}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}