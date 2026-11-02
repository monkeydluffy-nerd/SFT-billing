import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, RefreshCw, Building2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface LoadingScreenProps {
  onReady: () => void;
  onError: (error: string) => void;
}

const SURFINE_LOGO = "/surfine-technology-logo.png";

export function LoadingScreen({ onReady, onError }: LoadingScreenProps) {
  const [status, setStatus] = useState<"initializing" | "starting_backend" | "connecting" | "ready" | "error">("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [dots, setDots] = useState(0);

  // Animate loading dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const checkBackendHealth = useCallback(async (port: number): Promise<boolean> => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
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

  const getBackendPort = useCallback(async (): Promise<number> => {
    // Try to get port from Tauri
    if (typeof window !== "undefined") {
      const tauriWindow = window as Window & { 
        __TAURI__?: { invoke: (command: string, args?: unknown) => Promise<unknown> } 
      };
      if (tauriWindow.__TAURI__) {
        try {
          const port = await tauriWindow.__TAURI__.invoke("get_backend_port");
          if (typeof port === "number" && port > 0 && port < 65536) {
            return port;
          }
        } catch {
          // Fall through to fallback
        }
      }
    }
    // Fallback: try common ports
    for (let port = 8000; port <= 8010; port++) {
      if (await checkBackendHealth(port)) {
        return port;
      }
    }
    throw new Error("Could not determine backend port");
  }, [checkBackendHealth]);

  const waitForBackend = useCallback(async () => {
    setStatus("starting_backend");
    
    try {
      // Give backend a moment to start
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setStatus("connecting");
      const port = await getBackendPort();
      
      // Poll for backend readiness
      for (let attempt = 1; attempt <= 30; attempt++) {
        const healthy = await checkBackendHealth(port);
        if (healthy) {
          setStatus("ready");
          // Small delay to show "ready" state
          await new Promise((resolve) => setTimeout(resolve, 300));
          onReady();
          return;
        }
        
        // Update status with attempt info
        setStatus("connecting");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      
      throw new Error(`Backend not ready after 30 seconds on port ${port}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect to backend";
      setErrorMessage(message);
      setStatus("error");
      onError(message);
    }
  }, [getBackendPort, checkBackendHealth, onReady, onError]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setRetryCount((prev) => prev + 1);
    waitForBackend();
  }, [waitForBackend]);

  useEffect(() => {
    waitForBackend();
  }, [waitForBackend, retryCount]);

  const loadingMessages = [
    "Starting application",
    "Initializing backend",
    "Connecting to services",
    "Preparing workspace",
  ];

  const currentMessage = loadingMessages[Math.min(retryCount, loadingMessages.length - 1)];

  if (status === "ready") {
    return null; // Will be replaced by main app
  }

  if (status === "error") {
    return (
      <div className="dark fixed inset-0 z-50 flex items-center justify-center bg-canvas px-4 text-ink">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-surface">
            <AlertTriangle className="h-10 w-10 text-caution" aria-hidden="true" />
          </div>
          
          <h1 className="mb-3 text-2xl font-display text-ink">Unable to Start Backend</h1>
          <p className="mb-6 text-ink-muted">
            The application backend could not be started. This may be due to a port conflict,
            missing permissions, or a corrupted installation.
          </p>
          
          {errorMessage && (
            <div className="mb-6 p-4 text-left rounded-lg bg-surface-raised border border-border text-sm text-ink-muted font-mono">
              {errorMessage}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink ring-1 ring-border transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-premium sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-ink focus:outline-none focus:ring-2 focus:ring-premium sm:w-auto"
            >
              Close Application
            </button>
          </div>
          
          <p className="mt-8 text-xs text-ink-faint">
            If the problem persists, please contact SURFINE TECHNOLOGY support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas px-4 text-ink transition-opacity duration-300">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <img
          src={SURFINE_LOGO}
          alt="SURFINE TECHNOLOGY"
          className="h-20 w-auto object-contain"
        />
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-premium flex items-center justify-center shadow-card">
            <Building2 className="h-7 w-7 text-accent-ink" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">SFT Billing</h1>
            <p className="text-sm text-ink-faint">by SURFINE TECHNOLOGY</p>
          </div>
        </div>
      </div>

      {/* Loading Animation */}
      <div className="mb-8 flex items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 text-premium animate-spin" aria-hidden="true" />
        <span className="text-lg font-medium text-ink-muted">
          {currentMessage}
          <span className="inline-block min-w-[1.2em] text-right" aria-hidden="true">
            { ".".repeat(dots) }
          </span>
        </span>
      </div>

      {/* Status Details */}
      <div className="w-full max-w-md text-center">
        <div className="rounded-lg bg-surface border border-border p-4 text-left">
          <div className="flex items-center gap-3 text-sm">
            <div 
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                status === "initializing" && "bg-premium animate-pulse",
                status === "starting_backend" && "bg-success animate-pulse",
                status === "connecting" && "bg-success animate-pulse",
              )}
            />
            <span className="text-ink-muted capitalize">{status.replace("_", " ")}</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
            <div
              className={cn(
                "h-full transition-all duration-500 ease-out",
                status === "initializing" && "w-1/4 bg-premium",
                status === "starting_backend" && "w-2/4 bg-success",
                status === "connecting" && "w-3/4 bg-success",
                // status === "ready" is handled by early return above, but included for type safety
                false && "w-full bg-success",
              )}
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          This may take a moment on first launch while the database initializes.
        </p>
      </div>

      {/* Version footer */}
      <div className="mt-10 text-[11px] text-ink-faint font-mono">
        Version 0.1.1
      </div>
    </div>
  );
}