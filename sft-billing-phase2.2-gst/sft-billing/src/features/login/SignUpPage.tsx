import { FormEvent, useId, useState } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import AuthLayout from "./AuthLayout";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Phone, User } from "lucide-react";
import StarBorder from "./StarBorder";
import "./login.css";
import "./fonts";

const MIN_PASSWORD = 8;
const SERVER_UNREACHABLE_MESSAGE = "Couldn't reach the server. Check that the app is running and try again.";

function getAuthErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const isNotFoundResponse = /^(?:not found|404(?:\s+not found)?)$/i.test(message.trim());
  const isUnreachable = error instanceof TypeError || isNotFoundResponse ||
    /failed to fetch|networkerror|network request failed|load failed|connection refused|connection reset|err_connection_/i.test(message);

  return isUnreachable ? SERVER_UNREACHABLE_MESSAGE : message || fallback;
}

/** Shown once, on the first launch after installation, until an account exists. */
export default function SignUpPage({
  logoSrc = "/brand/surfine-horizontal.png",
  version,
}: {
  logoSrc?: string;
  version: string;
}) {
  const uid = useId();
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useAuthStore((st) => st.register);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const digits = mobile.replace(/\D/g, "");
    if (!username.trim()) return setError("Choose a username.");
    if (digits.length < 10) return setError("Enter a valid 10-digit mobile number.");
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for the password.`);
    if (password !== confirm) return setError("The passwords do not match.");
    setError(null);
    setBusy(true);
    try {
      await register({ username: username.trim(), mobile: digits, password });
    } catch (err) {
      setError(getAuthErrorMessage(err, "Could not create the account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      logoSrc={logoSrc}
      title="Create your account."
      subtitle="Invoices, payments and reports for Surfine Technology, in one place."
      footer={`SFT Billing · v${version} · © Surfine Technology`}
    >
      <form className="sl-form" onSubmit={handleSubmit} noValidate>
            <div>
              <div className="sl-field">
                <label className="sl-label" htmlFor={`${uid}-u`}>Username</label>
                <div className="sl-input-wrap">
                  <User className="sl-lead" aria-hidden />
                  <input id={`${uid}-u`} className="sl-input" type="text" autoComplete="username" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label" htmlFor={`${uid}-m`}>Mobile number</label>
                <div className="sl-input-wrap">
                  <Phone className="sl-lead" aria-hidden />
                  <input id={`${uid}-m`} className="sl-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label" htmlFor={`${uid}-p`}>Password</label>
                <div className="sl-input-wrap">
                  <Lock className="sl-lead" aria-hidden />
                  <input id={`${uid}-p`} className="sl-input sl-input--password" type={show ? "text" : "password"} autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD} characters`} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="sl-toggle" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)}>
                    {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                  </button>
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label" htmlFor={`${uid}-c`}>Confirm password</label>
                <div className="sl-input-wrap">
                  <Lock className="sl-lead" aria-hidden />
                  <input id={`${uid}-c`} className="sl-input" type={show ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter the password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              </div>
              {error && <p className="sl-error" role="alert">{error}</p>}
            </div>

            <div>
              <StarBorder
                type="submit"
                disabled={busy}
                aria-busy={busy}
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
                {busy ? <Loader2 className="sl-spin" aria-hidden /> : null}
                {busy ? "Creating account" : "Create account"}
                {!busy && <ArrowRight size={17} aria-hidden />}
              </StarBorder>
            </div>
      </form>
    </AuthLayout>
  );
}
