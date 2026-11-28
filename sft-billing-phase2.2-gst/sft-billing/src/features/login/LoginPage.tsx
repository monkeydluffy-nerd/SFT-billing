import { FormEvent, useId, useState } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { getApiBaseUrl } from "@/services/backendPort";
import AuthLayout from "./AuthLayout";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { ForgotPasswordModal } from "./forgot-password";
import StarBorder from "./StarBorder";
import "./login.css";
import "./forgot-password/forgot-password.css";
import "./fonts";

const SERVER_UNREACHABLE_MESSAGE = "Couldn't reach the server. Check that the app is running and try again.";

function getAuthErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const isNotFoundResponse = /^(?:not found|404(?:\s+not found)?)$/i.test(message.trim());
  const isUnreachable = error instanceof TypeError || isNotFoundResponse ||
    /failed to fetch|networkerror|network request failed|load failed|connection refused|connection reset|err_connection_/i.test(message);

  return isUnreachable ? SERVER_UNREACHABLE_MESSAGE : message || fallback;
}

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
  const displayName = username.trim().split("@", 1)[0].trim();
  const title = displayName ? `Welcome back, ${displayName}.` : "Welcome back.";

  const isLoading = loading ?? busy;
  const message = error == null ? localError : getAuthErrorMessage(error, error);

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
      setLocalError(getAuthErrorMessage(err, "Invalid username or password."));
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
    <>
      <AuthLayout
        logoSrc={logoSrc}
        title={title}
        subtitle="Invoices, payments and reports for Surfine Technology, in one place."
        isLoginPage
        footer={`SFT Billing · v${version} · © Surfine Technology`}
      >
        <form className="sl-form" onSubmit={handleSubmit} noValidate>
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
              <StarBorder
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="sl-submit"
                theme="dark"
                backgroundColor="#e6e6e6"
                textColor="#111111"
                borderColor="rgb(0 0 0 / 0.12)"
                color="#e8944f"
                trailColor="#e8944f"
                radius={8}
                thickness={1}
                duration={5}
                direction="clockwise"
                stars={1}
                trailLength={0.3}
                glow={0.45}
                sparkle={false}
                hover="brighten"
                clickPulse={false}
              >
                {isLoading ? <Loader2 className="sl-spin" aria-hidden /> : null}
                {isLoading ? "Signing in" : "Sign in"}
                {!isLoading && <ArrowRight size={17} aria-hidden />}
              </StarBorder>
            </div>
        </form>
      </AuthLayout>

      <ForgotPasswordModal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        onVerify={handleVerify}
        onResetPassword={handleResetPassword}
      />
    </>
  );
}