import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/shared/Button";
import { checkForUpdates, type UpdateCheckResult } from "@/lib/updateCheck";

export function UpdatesPage() {
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const next = await checkForUpdates();
    setResult(next);
    setCheckedAt(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return (
    <div>
      <PageHeader
        title="Software update"
        subtitle="Check whether a newer version of SFT Billing is available."
        action={
          <Button variant="secondary" onClick={() => void runCheck()} disabled={checking}>
            {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Check again
          </Button>
        }
      />
      <div className="px-6 pb-10 lg:px-8">
        <section aria-live="polite" className="max-w-xl rounded-lg border border-border bg-surface p-6">
          {checking || !result ? (
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <Loader2 size={18} className="animate-spin" aria-hidden /> Checking for updates…
            </div>
          ) : result.status === "up-to-date" ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 text-success" aria-hidden />
              <div>
                <p className="font-medium text-ink">No updates available. You&apos;re up to date.</p>
                <p className="mt-1 text-sm text-ink-muted">SFT Billing {result.currentVersion} is the latest version.</p>
              </div>
            </div>
          ) : result.status === "available" ? (
            <div className="flex items-start gap-3">
              <Download size={22} className="mt-0.5 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium text-ink">Update available: version {result.latestVersion}</p>
                <p className="mt-1 text-sm text-ink-muted">You are running version {result.currentVersion}.</p>
                {result.notes && (
                  <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-canvas p-3 text-xs text-ink-muted">
                    {result.notes}
                  </pre>
                )}
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
                  >
                    <Download size={14} aria-hidden /> Download update
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3" role="alert">
              <TriangleAlert size={22} className="mt-0.5 text-caution" aria-hidden />
              <div>
                <p className="font-medium text-ink">Couldn&apos;t check for updates</p>
                <p className="mt-1 text-sm text-ink-muted">{result.message}</p>
              </div>
            </div>
          )}
          {checkedAt && !checking && (
            <p className="mt-5 border-t border-border pt-3 text-xs text-ink-faint">
              Current version {result?.currentVersion} · Last checked {checkedAt.toLocaleTimeString()}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
