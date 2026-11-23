import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./forgot-password.css";

/* ------------------------------------------------------------------ *
 *  UI ONLY. This component contains NO authentication or recovery logic.
 *  Every security decision (key check, lockout, token, password rules)
 *  must be made by your backend and returned through the callbacks.
 * ------------------------------------------------------------------ */

/** What onVerify must resolve with. */
export type VerifyResult =
  | { status: "verified"; resetToken: string }
  | { status: "invalid"; message?: string } // use for BOTH unknown username and wrong key (same message, same timing)
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "error"; message?: string };

/** What onResetPassword must resolve with. */
export type ResetResult =
  | { status: "ok" }
  | { status: "password_rejected"; message?: string } // too short, too common, etc.
  | { status: "token_expired" }
  | { status: "error"; message?: string };

export interface ForgotPasswordModalProps {
  /** Show or hide the modal. All entered data is cleared whenever it closes. */
  open: boolean;
  /** Called on Cancel, Escape, backdrop click, and "Back to sign in" from the lockout screen. */
  onClose: () => void;
  /** Step 1. Send username + recovery key to your backend. Never log these values. */
  onVerify: (input: { mobile: string }) => Promise<VerifyResult>;
  /** Step 2. Send the single-use reset token + new password to your backend. */
  onResetPassword: (input: { resetToken: string; newPassword: string }) => Promise<ResetResult>;
  /** Called from the success screen ("Back to sign in"). Falls back to onClose. */
  onDone?: () => void;
  /** UI hint and client-side check only. The backend must enforce its own minimum. Default 8. */
  minPasswordLength?: number;
}

type Step = "identify" | "verifying" | "reset" | "saving" | "success" | "locked";

const INVALID_MESSAGE = "This mobile number is not registered.";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------------------------- icons ---------------------------- */
const svgProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const KeyIcon = () => (<svg {...svgProps}><circle cx="8" cy="15" r="4" /><path d="M11 12.5 20 4M16 8l3 3M14 10l2 2" /></svg>);
const LockIcon = () => (<svg {...svgProps}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
const CheckIcon = () => (<svg {...svgProps}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
const ArrowIcon = () => (<svg {...svgProps} width={18} height={18} strokeWidth={1.8}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const AlertIcon = () => (<svg {...svgProps} width={16} height={16}><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10v4M12 17.2v.01" /></svg>);
const EyeIcon = ({ off }: { off: boolean }) => (<svg {...svgProps}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{off && <path d="M3 3l18 18" />}</svg>);

/* ------------------------ secret input ------------------------- */
function SecretField(props: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  autoComplete: string; placeholder: string; disabled?: boolean; invalid?: boolean;
  describedBy?: string; autoFocus?: boolean; mono?: boolean;
}) {
  const [show, setShow] = useState(false);
  const noun = props.label.toLowerCase();
  return (
    <div className="sft-fp__field">
      <label className="sft-fp__label" htmlFor={props.id}>{props.label}</label>
      <div className="sft-fp__secret">
        <input
          id={props.id}
          className={`sft-fp__input sft-fp__input--secret${props.mono ? " sft-fp__input--mono" : ""}`}
          type={show ? "text" : "password"}
          autoComplete={props.autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          placeholder={props.placeholder}
          value={props.value}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          aria-describedby={props.describedBy}
          data-autofocus={props.autoFocus ? "" : undefined}
          onChange={(e) => props.onChange(e.target.value)}
        />
        <button
          type="button"
          className="sft-fp__toggle"
          aria-label={show ? `Hide ${noun}` : `Show ${noun}`}
          aria-pressed={show}
          disabled={props.disabled}
          onClick={() => setShow((s) => !s)}
        >
          <EyeIcon off={show} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------- modal ----------------------------- */
export default function ForgotPasswordModal({
  open, onClose, onVerify, onResetPassword, onDone, minPasswordLength = 8,
}: ForgotPasswordModalProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null); // reset token lives in memory only
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [step, setStep] = useState<Step>("identify");
  const [mobile, setMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const busy = step === "verifying" || step === "saving";

  /* open/close: lock page scroll, remember focus, wipe everything on close */
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      tokenRef.current = null;
      setStep("identify");
      setMobile("");
      setNewPassword("");
      setConfirm("");
      setError(null);
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* move focus on every step change */
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if (busy) dialogRef.current?.focus();
      else dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, step, busy]);

  /* lockout countdown (computed from a deadline, so it stays correct if the tab sleeps) */
  useEffect(() => {
    if (step !== "locked") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) { setError(null); setStep("identify"); }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [step, lockUntil]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (step !== "identify") return;
    if (mobile.replace(/\D/g, "").length < 10) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    setError(null);
    setStep("verifying");
    try {
      const r = await onVerify({ mobile: mobile.trim() });
      if (r.status === "verified") {
        tokenRef.current = r.resetToken;
        setStep("reset");
      } else if (r.status === "locked") {
        setLockUntil(Date.now() + Math.max(1, r.retryAfterSeconds) * 1000);
        setStep("locked");
      } else if (r.status === "invalid") {
        setError(r.message ?? INVALID_MESSAGE);
        setStep("identify");
      } else {
        setError(r.message ?? GENERIC_ERROR);
        setStep("identify");
      }
    } catch {
      setError(GENERIC_ERROR);
      setStep("identify");
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (step !== "reset") return;
    if (newPassword.length < minPasswordLength) {
      setError(`Use at least ${minPasswordLength} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setError(null);
    setStep("saving");
    try {
      const r = await onResetPassword({ resetToken: tokenRef.current ?? "", newPassword });
      if (r.status === "ok") {
        tokenRef.current = null;
        setNewPassword("");
        setConfirm("");
        setStep("success");
      } else if (r.status === "password_rejected") {
        setError(r.message ?? "Choose a stronger password.");
        setStep("reset");
      } else if (r.status === "token_expired") {
        tokenRef.current = null;
        setNewPassword("");
        setConfirm("");
        setError("Your verification has expired. Please verify again.");
        setStep("identify");
      } else {
        setError(r.message ?? GENERIC_ERROR);
        setStep("reset");
      }
    } catch {
      setError(GENERIC_ERROR);
      setStep("reset");
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && !busy) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  if (!open) return null;

  const stepNumber = step === "success" ? 3 : step === "reset" || step === "saving" ? 2 : 1;
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const errId = `${uid}-err`;
  const lengthOk = newPassword.length >= minPasswordLength;
  const matchOk = confirm.length > 0 && newPassword === confirm;

  const copy: Record<Step, { title: string; text: string }> = {
    identify: { title: "Recover your account", text: "Enter the mobile number you registered with and you can set a new password." },
    verifying: { title: "Recover your account", text: "Checking your details." },
    reset: { title: "Set a new password", text: "Choose a strong password. You will sign in with it next." },
    saving: { title: "Set a new password", text: "Saving your new password." },
    locked: { title: "Too many attempts", text: "For your security, recovery is paused for a short time." },
    success: { title: "Password updated", text: "Your password has been changed. Sign in with your new password." },
  };

  const icon = step === "locked" ? <LockIcon /> : step === "success" ? <CheckIcon /> : <KeyIcon />;
  const tone = step === "locked" ? "lock" : step === "success" ? "success" : "key";
  const headingFocus = step === "locked" || step === "success";

  return createPortal(
    <div
      className="sft-fp"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="sft-fp__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="sft-fp__header">
          <span className={`sft-fp__badge sft-fp__badge--${tone}`}>{icon}</span>
          <div>
            <h2 id={titleId} className="sft-fp__title" tabIndex={-1} data-autofocus={headingFocus ? "" : undefined}>
              {copy[step].title}
            </h2>
            <p id={descId} className="sft-fp__text">{copy[step].text}</p>
          </div>
        </header>

        {step !== "locked" && (
          <div className="sft-fp__steps" role="group" aria-label={`Step ${stepNumber} of 3`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className="sft-fp__seg" data-state={n < stepNumber ? "done" : n === stepNumber ? "current" : "todo"} />
            ))}
          </div>
        )}

        {(step === "identify" || step === "verifying") && (
          <form onSubmit={handleVerify} noValidate>
            <div className="sft-fp__field">
              <label className="sft-fp__label" htmlFor={`${uid}-mobile`}>Mobile number</label>
              <input
                id={`${uid}-mobile`}
                className="sft-fp__input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={mobile}
                disabled={busy}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? errId : undefined}
                data-autofocus=""
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
            {error && (
              <p id={errId} className="sft-fp__error" role="alert"><AlertIcon /> <span>{error}</span></p>
            )}
            <div className="sft-fp__actions">
              <button type="button" className="sft-fp__ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="sft-fp__primary" disabled={busy} aria-busy={busy}>
                {busy ? "Checking" : "Continue"} <ArrowIcon />
              </button>
            </div>
          </form>
        )}

        {(step === "reset" || step === "saving") && (
          <form onSubmit={handleReset} noValidate>
            <SecretField
              id={`${uid}-new`} label="New password"
              value={newPassword} onChange={setNewPassword}
              autoComplete="new-password" placeholder="Enter a new password"
              disabled={busy} invalid={!!error} autoFocus describedBy={`${uid}-rules`}
            />
            <SecretField
              id={`${uid}-confirm`} label="Confirm new password"
              value={confirm} onChange={setConfirm}
              autoComplete="new-password" placeholder="Re-enter the new password"
              disabled={busy} invalid={!!error} describedBy={`${uid}-rules`}
            />
            <ul id={`${uid}-rules`} className="sft-fp__rules">
              <li data-met={lengthOk}>
                <span className="sft-fp__sr">{lengthOk ? "Met: " : "Not met: "}</span>At least {minPasswordLength} characters
              </li>
              <li data-met={matchOk}>
                <span className="sft-fp__sr">{matchOk ? "Met: " : "Not met: "}</span>Both passwords match
              </li>
            </ul>
            {error && (
              <p id={errId} className="sft-fp__error" role="alert"><AlertIcon /> <span>{error}</span></p>
            )}
            <div className="sft-fp__actions">
              <button type="button" className="sft-fp__ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="sft-fp__primary" disabled={busy} aria-busy={busy}>
                {busy ? "Saving" : "Update password"} <ArrowIcon />
              </button>
            </div>
          </form>
        )}

        {step === "locked" && (
          <div className="sft-fp__lock">
            <p className="sft-fp__clock" aria-hidden="true">{formatClock(secondsLeft)}</p>
            <p className="sft-fp__text" role="status">
              Try again in {Math.floor(secondsLeft / 60)} min {secondsLeft % 60} sec. Your billing data has not been changed.
            </p>
            <div className="sft-fp__actions sft-fp__actions--single">
              <button type="button" className="sft-fp__primary" onClick={onClose}>Back to sign in <ArrowIcon /></button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="sft-fp__actions sft-fp__actions--single">
            <button type="button" className="sft-fp__primary" onClick={() => (onDone ?? onClose)()}>
              Back to sign in <ArrowIcon />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
