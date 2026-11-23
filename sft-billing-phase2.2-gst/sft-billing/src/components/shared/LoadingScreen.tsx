import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { getApiBaseUrl } from "@/services/backendPort";

interface LoadingScreenProps {
  onReady: () => void;
  onError: (error: string) => void;
}

type Status = "initializing" | "starting_backend" | "connecting" | "ready" | "error";

const STEPS: Array<{ key: Exclude<Status, "ready" | "error">; label: string; hint: string }> = [
  { key: "initializing", label: "Starting application", hint: "Loading the workspace shell" },
  { key: "starting_backend", label: "Starting billing service", hint: "Waking the local backend" },
  { key: "connecting", label: "Connecting to your data", hint: "Opening the database and checking health" },
];

const ORDER: Status[] = ["initializing", "starting_backend", "connecting", "ready"];

export function LoadingScreen({ onReady, onError }: LoadingScreenProps) {
  const [status, setStatus] = useState<Status>("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [retryCount]);

  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    try {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === "ok";
    } catch {
      return false;
    }
  }, []);

  const waitForBackend = useCallback(async () => {
    setStatus("starting_backend");

    try {
      // Give the backend a moment to start.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStatus("connecting");

      // Poll for backend readiness.
      for (let attempt = 1; attempt <= 30; attempt++) {
        const healthy = await checkBackendHealth();
        if (healthy) {
          setStatus("ready");
          // Small delay so the final step visibly completes.
          await new Promise((resolve) => setTimeout(resolve, 300));
          onReady();
          return;
        }

        setStatus("connecting");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      throw new Error(`Backend not ready after 30 seconds`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect to backend";
      setErrorMessage(message);
      setStatus("error");
      onError(message);
    }
  }, [checkBackendHealth, onReady, onError]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setElapsed(0);
    setStatus("initializing");
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    waitForBackend();
  }, [waitForBackend, retryCount]);

  if (status === "ready") {
    return null; // Replaced by the main app.
  }

  const activeIndex = ORDER.indexOf(status);

  return (
    <div className="dark fixed inset-0 z-50 overflow-hidden bg-[#05060d] text-ink" role="status" aria-live="polite" aria-busy={status !== "error"}>
      {/* Atmosphere: drifting light + dot grid */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="sl-aurora" style={{ position: "absolute", inset: 0, filter: "blur(80px)", opacity: 0.85 }}>
          <i className="ls-blob ls-blob--a" />
          <i className="ls-blob ls-blob--b" />
          <i className="ls-blob ls-blob--c" />
        </div>
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgb(255 255 255 / 0.14) 1px, transparent 1.2px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at 50% 45%, #000 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, #000 15%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-6">
        {status === "error" ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-caution/15 text-caution">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-white">Couldn&apos;t reach the billing service</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              The local backend didn&apos;t answer in time. This can happen after a port conflict, a blocked process, or an interrupted install.
            </p>
            {errorMessage && (
              <p className="mt-4 rounded-lg bg-black/40 px-3 py-2 text-left font-mono text-xs text-white/60">{errorMessage}</p>
            )}
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRetry}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-medium text-accent-ink shadow-[0_10px_28px_-10px_rgb(46_103_255/0.9)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent/50 sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.close()}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/50 sm:w-auto"
              >
                Close application
              </button>
            </div>
            <p className="mt-6 text-xs text-white/40">If the problem persists, contact Surfine Technology support.</p>
          </motion.div>
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center">
            {/* Emblem with orbiting rings */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-36 w-36 items-center justify-center"
            >
              <span className="ls-ring ls-ring--1" aria-hidden="true" />
              <span className="ls-ring ls-ring--2" aria-hidden="true" />
              <span className="ls-sweep" aria-hidden="true" />
              <span className="absolute inset-[26px] rounded-full bg-white/[0.05] ring-1 ring-white/10 backdrop-blur" aria-hidden="true" />
              <img src="/brand/surfine-emblem.png" alt="Surfine Technology" className="ls-emblem relative h-16 w-auto invert" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 text-center"
            >
              <h1 className="text-2xl font-semibold tracking-tight text-white">SFT Billing</h1>
              <p className="mt-1 text-sm text-white/50">by Surfine Technology</p>
            </motion.div>

            {/* Step list */}
            <motion.ol
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-9 w-full space-y-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl"
            >
              {STEPS.map((step, index) => {
                const done = index < activeIndex;
                const active = index === activeIndex;
                return (
                  <li key={step.key} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors", active && "bg-white/[0.06]")}>
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors",
                        done && "bg-success/20 text-success",
                        active && "bg-accent/25 text-accent",
                        !done && !active && "bg-white/5 text-white/30",
                      )}
                    >
                      {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : active ? <span className="ls-dot" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-medium", done || active ? "text-white" : "text-white/40")}>{step.label}</span>
                      {active && <span className="block text-xs text-white/50">{step.hint}</span>}
                    </span>
                    {active && <span className="font-mono text-[11px] text-white/40">{elapsed}s</span>}
                  </li>
                );
              })}
            </motion.ol>

            {/* Indeterminate progress */}
            <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div className="ls-bar h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
            </div>

            <p className={cn("mt-4 h-4 text-center text-xs text-white/45 transition-opacity", elapsed >= 6 ? "opacity-100" : "opacity-0")}>
              Still working — the first launch takes a little longer while the database initializes.
            </p>
          </div>
        )}

        <div className="absolute bottom-6 font-mono text-[11px] text-white/30">Version 1.1.0</div>
      </div>
    </div>
  );
}
