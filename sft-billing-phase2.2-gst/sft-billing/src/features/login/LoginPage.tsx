import { FormEvent, useId, useState } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { getApiBaseUrl } from "@/services/backendPort";
import LoginShowcase from "./LoginShowcase";
import { ArrowRight, Eye, EyeOff, Lock, Moon, ShieldCheck, Sun, User } from "lucide-react";
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
  const theme = useWorkspaceStore((st) => st.theme);
  const toggleTheme = useWorkspaceStore((st) => st.toggleTheme);

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

  async function handleVerify(input: { mobile: string }) {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/forgot-password/verify-mobile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: input.mobile }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { status: "invalid" as const, message: typeof data.detail === "string" ? data.detail : undefined };
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
      <section className="sl-panel">
        <div className="sl-panel__top">
          <div className="sl-logo">
            <img src={logoSrc} alt="Surfine Technology" />
          </div>
          <button type="button" className="sl-theme" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            {theme === "light" ? <Moon size={14} aria-hidden /> : <Sun size={14} aria-hidden />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>

        <div className="sl-formwrap">
          <form className="sl-form" onSubmit={handleSubmit} noValidate>
            <span className="sl-hello"><i /> SFT Billing</span>
            <div>
              <h1 className="sl-title">Welcome back</h1>
              <p className="sl-subtitle">Sign in to your workspace to manage invoices, clients and payments.</p>
            </div>

            <div>
              <div className="sl-field">
                <label className="sl-label" htmlFor={`${uid}-u`}>Username or email</label>
                <div className="sl-input-wrap">
                  <User className="sl-lead" aria-hidden />
                  <input
                    id={`${uid}-u`}
                    className="sl-input"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    aria-invalid={!!message}
                    aria-describedby={message ? `${uid}-err` : undefined}
                    autoFocus
                  />
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label" htmlFor={`${uid}-p`}>Password</label>
                <div className="sl-input-wrap">
                  <Lock className="sl-lead" aria-hidden />
                  <input
                    id={`${uid}-p`}
                    className="sl-input sl-input--password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!message}
                  />
                  <button
                    type="button"
                    className="sl-toggle"
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    onClick={() => setShow((v) => !v)}
                  >
                    {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                  </button>
                </div>
              </div>
              {message && <p id={`${uid}-err`} className="sl-error" role="alert">{message}</p>}
              <div className="sl-row">
                <button type="button" className="sl-forgot" onClick={handleForgotPasswordClick} disabled={isLoading}>
                  Forgot password?
                </button>
              </div>
            </div>

            <div>
              <button className="sl-submit" type="submit" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? <span className="sl-spin" aria-hidden /> : null}
                {isLoading ? "Signing in" : "Sign in"}
                {!isLoading && <ArrowRight size={17} aria-hidden />}
              </button>
              <p className="sl-secure"><ShieldCheck size={13} aria-hidden /> Your data stays on this device</p>
            </div>
          </form>
        </div>

        <p className="sl-footer">SFT Billing · v{version} · © Surfine Technology</p>
      </section>

      <LoginShowcase />

      <ForgotPasswordModal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        onVerify={handleVerify}
        onResetPassword={handleResetPassword}
      />
    </div>
  );
}