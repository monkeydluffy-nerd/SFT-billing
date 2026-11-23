import { FormEvent, useId, useState } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import LoginShowcase from "./LoginShowcase";
import { ArrowRight, Eye, EyeOff, Lock, Moon, Phone, ShieldCheck, Sun, User } from "lucide-react";
import "./login.css";
import "./fonts";

const MIN_PASSWORD = 8;

/** Shown once, on the first launch after installation, until an account exists. */
export default function SignUpPage({ logoSrc, version }: { logoSrc: string; version: string }) {
  const uid = useId();
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useAuthStore((st) => st.register);
  const theme = useWorkspaceStore((st) => st.theme);
  const toggleTheme = useWorkspaceStore((st) => st.toggleTheme);

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
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
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
            <span className="sl-hello"><i /> Welcome to SFT Billing</span>
            <div>
              <h1 className="sl-title">Create your account</h1>
              <p className="sl-subtitle">Set up the owner login for this device. Your mobile number is used to reset your password.</p>
            </div>

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
              <button className="sl-submit" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? <span className="sl-spin" aria-hidden /> : null}
                {busy ? "Creating account" : "Create account"}
                {!busy && <ArrowRight size={17} aria-hidden />}
              </button>
              <p className="sl-secure"><ShieldCheck size={13} aria-hidden /> Your data stays on this device</p>
            </div>
          </form>
        </div>

        <p className="sl-footer">SFT Billing · v{version} · © Surfine Technology</p>
      </section>

      <LoginShowcase />
    </div>
  );
}
