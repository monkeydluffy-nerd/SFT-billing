"""SFT Billing desktop launcher (PyInstaller entry point).

Starts the API + bundled UI on a free local port, opens it in its own
app-style window (Edge/Chrome --app), and shuts down when that window closes.
"""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path


def _bundle_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _find_browser() -> str | None:
    candidates = []
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        if not base:
            continue
        candidates += [
            Path(base) / "Microsoft/Edge/Application/msedge.exe",
            Path(base) / "Google/Chrome/Application/chrome.exe",
        ]
    for c in candidates:
        if c.is_file():
            return str(c)
    return shutil.which("msedge") or shutil.which("chrome")


def _profile_in_use(profile: str) -> bool:
    script = (
        "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.Name -like 'ms*' -or $_.Name -like 'chrome*' } | "
        "Where-Object { $_.CommandLine -and "
        f"$_.CommandLine.Contains('{profile}') }} | Select-Object -First 1 -ExpandProperty ProcessId"
    )
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True, text=True, timeout=20, creationflags=0x08000000,
        ).stdout.strip()
        return bool(out)
    except Exception:
        return True


def _message(text: str) -> None:
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, text, "SFT Billing", 0x10)
    except Exception:
        print(text)


def main() -> int:
    local = Path(os.environ["LOCALAPPDATA"]) / "SFT Billing"
    local.mkdir(parents=True, exist_ok=True)
    db = local / "sft_billing.db"
    if not db.exists():
        seed = _bundle_dir() / "seed" / "sft_billing.db"
        if not seed.is_file():
            _message("The initial data package is missing. Please reinstall SFT Billing.")
            return 1
        shutil.copyfile(seed, db)

    # Windowed build has no console: give stdio a real target before uvicorn/logging touch it.
    if sys.stdout is None or sys.stderr is None:
        log = open(local / "app.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stdout or log
        sys.stderr = sys.stderr or log

    port = _free_port()
    os.environ["SFT_BILLING_DATABASE_URL"] = f"sqlite:///{db.as_posix()}"
    os.environ["SFT_BILLING_MIGRATION_DATABASE_URL"] = os.environ["SFT_BILLING_DATABASE_URL"]
    os.environ["SFT_BILLING_STATIC_DIR"] = str(_bundle_dir() / "web")

    import uvicorn
    from app.main import app

    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", log_config=None))
    threading.Thread(target=server.run, daemon=True).start()

    url = f"http://127.0.0.1:{port}/"
    for _ in range(120):
        try:
            urllib.request.urlopen(f"{url}api/health", timeout=1)
            break
        except Exception:
            time.sleep(0.25)
    else:
        _message("SFT Billing could not start its service. Please try again.")
        return 1

    browser = _find_browser()
    if browser:
        profile = local / "window-profile"
        proc = subprocess.Popen([
            browser, f"--app={url}", f"--user-data-dir={profile}",
            "--no-first-run", "--no-default-browser-check", "--window-size=1440,900",
        ])
        proc.wait()
        # The browser launcher may exit before the window does: wait until no browser
        # process is still using our dedicated profile.
        seen, idle, started = False, 0, time.time()
        while True:
            alive = _profile_in_use(str(profile))
            seen = seen or alive
            idle = 0 if alive else idle + 1
            if (seen and idle >= 3) or (not seen and time.time() - started > 30):
                break
            time.sleep(2)
    else:
        import webbrowser
        webbrowser.open(url)
        while True:
            time.sleep(3600)

    server.should_exit = True
    return 0


if __name__ == "__main__":
    sys.exit(main())
