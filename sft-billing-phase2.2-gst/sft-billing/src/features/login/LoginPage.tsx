import { FormEvent, useId, useState } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { getApiBaseUrl } from "@/services/backendPort";
import PinDrawing from "./PinDrawing";
import { ForgotPasswordModal } from "./forgot-password";
import "./login.css";
import "./forgot-password/forgot-password.css";
import "./fonts";

export interface LoginPageProps {
  /** URL of the OFFICIAL Surfine Technology logo (import it from your branding folder). */
  logoSrc: string;
  /** App version shown in the footer, e.g. "1.0.0". */
  version: string;
  /** Called with the entered credentials. Wire it to your own auth later. */
  onSubmit?: (credentials: { username: string; password: string }) => Promise<void>;
  /** Error message to show under the form (e.g. "Incorrect username or password."). */
  error?: string | null;
  /** Force the loading state; if omitted it follows the onSubmit promise. */
  loading?: boolean;
}

export default function LoginPage({ logoSrc, version, error, loading, onSubmit }: LoginPageProps) {
  const uid = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const isLoading = loading ?? busy;
  const message = error ?? localError;

  const { login } = useAuthStore();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    if (!username.trim() || !password) {
      setLocalError("Enter your username and password.");
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      if (onSubmit) {
        await onSubmit({ username: username.trim(), password });
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Invalid username or password.");
    } finally {
      setBusy(false);
    }
  }

  function handleForgotPasswordClick() {
    setRecoveryOpen(true);
  }

  async function handleVerify(input: { username: string; recoveryKey: string }) {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/forgot-password/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: input.username, recovery_key: input.recoveryKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { status: "invalid" as const, message: data.detail };
    }
    return { status: "verified" as const, resetToken: data.reset_token };
  }

  async function handleResetPassword(input: { resetToken: string; newPassword: string }) {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/forgot-password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset_token: input.resetToken, new_password: input.newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { status: "error" as const, message: data.detail };
    }
    return { status: "ok" as const };
  }

  return (
    <div className="sft-login">
      <aside className="sft-login__brand">
        <div className="sft-login__grid" aria-hidden="true" />
        <div className="sft-login__lockup">
          <img className="sft-login__logo" src={logoSrc} alt="Surfine Technology" />
          <div className="sft-login__company">SURFINE TECHNOLOGY</div>
        </div>

        <div className="sft-login__hero">
          <PinDrawing />
          <div className="sft-login__eyebrow">SFT BILLING</div>
          <h1 className="sft-login__headline">
            Billing, built
            <br />
            with precision.
          </h1>
          <div className="sft-login__rule" />
          <p className="sft-login__lede">
            Clear records and confident control over every invoice, client and payment.
          </p>
        </div>

        <div className="sft-login__tagline">FORGING A STRONGER TOMORROW</div>
      </aside>

      <main className="sft-login__panel">
        <div className="sft-login__app-logo" aria-hidden="true">
          <img src="/surfine-technology-logo.png" alt="" />
        </div>
        <form className="sft-login__card" onSubmit={handleSubmit} noValidate>
          <h2 className="sft-login__title">Welcome back</h2>
          <p className="sft-login__subtitle">Sign in to your workspace.</p>

          <label className="sft-login__label" htmlFor={`${uid}-u`}>Username or email</label>
          <input
            id={`${uid}-u`}
            className="sft-login__input"
            type="text"
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!message}
            aria-describedby={message ? `${uid}-err` : undefined}
            autoFocus
          />

          <label className="sft-login__label sft-login__label--password" htmlFor={`${uid}-p`}>Password</label>
          <div className="sft-login__password">
            <input
              id={`${uid}-p`}
              className="sft-login__input sft-login__input--password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!message}
            />
            <button
              type="button"
              className="sft-login__toggle"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((s) => !s)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {show && <path d="M3 3l18 18" />}
              </svg>
            </button>
          </div>

          {message && (
            <p id={`${uid}-err`} className="sft-login__error" role="alert">{message}</p>
          )}

          <div className="sft-login__forgot">
            <button type="button" className="sft-login__forgot-link" onClick={handleForgotPasswordClick} disabled={isLoading}>
              Forgot password?
            </button>
          </div>

          <button className="sft-login__submit" type="submit" disabled={isLoading} aria-busy={isLoading}>
            {isLoading ? "Signing in" : "Sign in"}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          <p className="sft-login__footer">SFT Billing · v{version} · © Surfine Technology</p>
        </form>
      </main>

      <ForgotPasswordModal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        onVerify={handleVerify}
        onResetPassword={handleResetPassword}
        defaultUsername={username}
      />
    </div>
  );
}