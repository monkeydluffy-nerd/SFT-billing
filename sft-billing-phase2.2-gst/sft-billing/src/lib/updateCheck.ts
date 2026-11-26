/** Current app version. Keep in sync with installer/SFT-Billing.iss. */
export const APP_VERSION = "1.1.0";

const LATEST_RELEASE_URL = "https://api.github.com/repos/monkeydluffy-nerd/SFT-billing/releases/latest";

export type UpdateCheckResult =
  | { status: "up-to-date"; currentVersion: string }
  | { status: "available"; currentVersion: string; latestVersion: string; notes: string; url: string }
  | { status: "error"; currentVersion: string; message: string };

function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** True when `candidate` is a strictly newer version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Looks for a newer published release. A repo with no releases counts as up to date. */
export async function checkForUpdates(currentVersion = APP_VERSION): Promise<UpdateCheckResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (response.status === 404) return { status: "up-to-date", currentVersion };
    if (!response.ok) {
      return { status: "error", currentVersion, message: `Update server responded with ${response.status}.` };
    }
    const release = (await response.json()) as { tag_name?: string; body?: string; html_url?: string };
    const latest = release.tag_name ?? "";
    if (latest && isNewerVersion(latest, currentVersion)) {
      return {
        status: "available",
        currentVersion,
        latestVersion: latest.replace(/^v/i, ""),
        notes: (release.body ?? "").trim(),
        url: release.html_url ?? "",
      };
    }
    return { status: "up-to-date", currentVersion };
  } catch {
    return {
      status: "error",
      currentVersion,
      message: "Couldn't reach the update server. Check your internet connection and try again.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}
