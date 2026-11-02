interface SettingsFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function SettingsField({ label, hint, children, fullWidth }: SettingsFieldProps) {
  return (
    <div className={fullWidth ? "col-span-full" : undefined}>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/**
 * A read-only fact, styled deliberately unlike an input (no border box,
 * no focus ring, plain text on the canvas tone) so it reads as "this is
 * just how it is" rather than inviting a click. Use this instead of a
 * disabled <input> whenever a setting is fixed - a disabled input still
 * looks like a form control, which is exactly the "looks broken" problem
 * this replaces.
 */
export function FixedValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-muted">{label}</p>
      <p className="font-tabular rounded-md bg-canvas px-2.5 py-2 text-sm text-ink-muted">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export const settingsInputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60";
export const settingsTextareaClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong";