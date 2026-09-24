import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + input/select + optional error message. Wraps any form control. */
export function FormField({ label, error, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-caution" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {error && <p className="text-xs text-caution">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------
export const inputClass = cn(
  "h-9 w-full rounded-md border border-border bg-canvas px-3 text-sm text-ink",
  "placeholder:text-ink-faint outline-none",
  "transition-colors duration-micro",
  "focus:border-border-strong focus:ring-1 focus:ring-accent/20",
  "disabled:opacity-50 disabled:cursor-not-allowed",
);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClass, className)} {...props} />
  )
);
Input.displayName = "Input";

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        inputClass,
        "h-auto min-h-[80px] resize-none py-2",
        className,
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(inputClass, "cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
