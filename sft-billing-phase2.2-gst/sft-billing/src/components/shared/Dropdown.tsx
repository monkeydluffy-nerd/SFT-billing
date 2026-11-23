import { useRef, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  disabled = false,
  ariaLabel,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  return (
    <div
      ref={dropdownRef}
      className={cn("relative inline-block", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-colors duration-micro",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-accent",
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-ink-faint")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn("flex-shrink-0 text-ink-muted transition-transform duration-micro", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-20 mt-1.5 min-w-[180px] max-h-60 overflow-y-auto rounded-lg border border-border-strong bg-surface-raised shadow-float-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-micro"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-micro",
                option.value === value
                  ? "bg-accent/10 text-accent"
                  : "text-ink hover:bg-canvas",
                "focus:outline-none focus:bg-accent/10",
              )}
            >
              {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check size={14} className="flex-shrink-0 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}