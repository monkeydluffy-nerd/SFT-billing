// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, OpenFlags};
use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::api::process::current_binary;
use tauri::Manager;

// Configuration constants
const HEALTH_CHECK_INTERVAL: Duration = Duration::from_millis(500);
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);

static BACKEND_PORT: OnceLock<u16> = OnceLock::new();
static BACKEND_READY: OnceLock<Arc<Mutex<bool>>> = OnceLock::new();

/// Custom error type for sidecar startup failures
#[derive(Debug)]
enum SidecarError {
    BinaryNotFound(String),
    SpawnFailed(String),
    Timeout(String),
    ProcessExited(String),
}

impl std::fmt::Display for SidecarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SidecarError::BinaryNotFound(msg) => write!(f, "Backend binary not found: {}", msg),
            SidecarError::SpawnFailed(msg) => write!(f, "Failed to start backend: {}", msg),
            SidecarError::Timeout(msg) => write!(f, "Startup timeout: {}", msg),
            SidecarError::ProcessExited(msg) => {
                write!(f, "Backend process exited unexpectedly: {}", msg)
            }
        }
    }
}

impl std::error::Error for SidecarError {}

/// Owned sidecar process handle with automatic cleanup
#[derive(Debug)]
struct SidecarProcess {
    child: Option<Child>,
    pid: u32,
    #[cfg(windows)]
    job_handle: Option<JobHandle>,
}

/// Wrapper around Windows HANDLE that is Send + Sync
/// Safe because we only use it to close the handle, never to access the process directly
#[cfg(windows)]
#[derive(Debug)]
struct JobHandle(winapi::um::winnt::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandle {}

#[cfg(windows)]
unsafe impl Sync for JobHandle {}

impl SidecarProcess {
    fn new(child: Child, #[cfg(windows)] job_handle: Option<JobHandle>) -> Self {
        let pid = child.id();
        Self {
            child: Some(child),
            pid,
            #[cfg(windows)]
            job_handle,
        }
    }

    fn try_wait(&mut self) -> Result<Option<std::process::ExitStatus>, std::io::Error> {
        if let Some(child) = self.child.as_mut() {
            child.try_wait()
        } else {
            Ok(None)
        }
    }

    /// Terminate the process and reap it. Safe to call multiple times.
    fn terminate(&mut self) {
        if let Some(mut child) = self.child.take() {
            #[cfg(windows)]
            {
                // Close the Job Object handle - this kills all processes in the job
                // because we configured JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE at creation time
                if let Some(job) = self.job_handle.take() {
                    unsafe {
                        winapi::um::handleapi::CloseHandle(job.0);
                    }
                    eprintln!(
                        "[info] Backend sidecar process {} terminated via Job Object",
                        self.pid
                    );
                } else {
                    // Fallback: Job Object was not created at spawn time
                    eprintln!("[warn] Job Object handle not available, falling back to taskkill");
                    let _ = StdCommand::new("taskkill.exe")
                        .args(["/PID", &self.pid.to_string(), "/T", "/F"])
                        .output();
                }
            }
            #[cfg(not(windows))]
            {
                // On Unix, send SIGTERM to the process group
                let _ = StdCommand::new("pkill")
                    .args(["-TERM", "-P", &self.pid.to_string()])
                    .output();
                // Give it a moment to exit gracefully
                std::thread::sleep(Duration::from_millis(500));
                // Force kill if still alive
                if child.try_wait().unwrap_or(None).is_none() {
                    let _ = StdCommand::new("pkill")
                        .args(["-KILL", "-P", &self.pid.to_string()])
                        .output();
                }
            }

            // Reap the process
            let _ = child.wait();
            eprintln!(
                "[info] Backend sidecar process {} terminated and reaped",
                self.pid
            );
        }
    }
}

impl Drop for SidecarProcess {
    fn drop(&mut self) {
        self.terminate();
    }
}

fn is_port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn find_available_port(start_port: u16, max_port: u16) -> Option<u16> {
    for port in start_port..=max_port {
        if !is_port_open(port) {
            if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
                return Some(port);
            }
        }
    }
    None
}

/// Verify backend ownership by checking health endpoint
fn verify_backend_ownership(port: u16) -> bool {
    if let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) {
        use std::io::{Read, Write};
        let request = format!(
            "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
            port
        );
        if stream.write_all(request.as_bytes()).is_ok() {
            let mut response = String::new();
            if stream.read_to_string(&mut response).is_ok() {
                return response.contains("status") && response.contains("ok");
            }
        }
    }
    false
}

/// Spawn the backend sidecar and return owned process handle
fn spawn_sidecar(
    sidecar_path: &PathBuf,
    port: u16,
    db_url: &str,
) -> Result<SidecarProcess, Box<dyn std::error::Error>> {
    if !sidecar_path.exists() {
        return Err(SidecarError::BinaryNotFound(format!(
            "Backend executable not found at: {}",
            sidecar_path.display()
        ))
        .into());
    }

    eprintln!(
        "[info] Starting backend sidecar at: {} (port: {})",
        sidecar_path.display(),
        port
    );

    let mut child = StdCommand::new(sidecar_path)
        .arg("--port")
        .arg(port.to_string())
        .env("SFT_BILLING_DATABASE_URL", db_url)
        .env("SFT_BILLING_PORT", port.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            SidecarError::SpawnFailed(format!("Failed to spawn backend process: {}", e))
        })?;

    let pid = child.id();
    eprintln!("[info] Backend sidecar started with PID: {}", pid);

    // Create and assign Windows Job Object immediately after spawn for guaranteed cleanup
    // This ensures the sidecar is terminated even if the parent crashes or is force-killed
    #[cfg(windows)]
    let job_handle = {
        use std::ptr::null_mut;
        use winapi::um::handleapi::CloseHandle;
        use winapi::um::jobapi2::{
            AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
        };
        use winapi::um::processthreadsapi::OpenProcess;
        use winapi::um::winnt::{
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            PROCESS_SET_QUOTA, PROCESS_TERMINATE,
        };

        // JobObjectExtendedLimitInformation = 9 (not exported by winapi 0.3)
        const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS: u32 = 9;

        unsafe {
            let job = CreateJobObjectW(null_mut(), null_mut());
            if job.is_null() {
                eprintln!(
                    "[warn] Failed to create Job Object for sidecar (CreateJobObjectW failed)"
                );
                None
            } else {
                // Configure: kill all processes in job when job handle closes
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let result = SetInformationJobObject(
                    job,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
                    &info as *const _ as *mut _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                if result == 0 {
                    eprintln!(
                        "[warn] Failed to configure Job Object (SetInformationJobObject failed)"
                    );
                    CloseHandle(job);
                    None
                } else {
                    // Open the target process
                    let process = OpenProcess(PROCESS_TERMINATE | PROCESS_SET_QUOTA, 0, pid);
                    if process.is_null() {
                        eprintln!("[warn] Failed to open sidecar process for Job Object assignment (OpenProcess failed)");
                        CloseHandle(job);
                        None
                    } else {
                        // Assign process to job
                        let result = AssignProcessToJobObject(job, process);
                        CloseHandle(process);

                        if result == 0 {
                            eprintln!("[warn] Failed to assign sidecar to Job Object (AssignProcessToJobObject failed)");
                            CloseHandle(job);
                            None
                        } else {
                            eprintln!("[info] Sidecar assigned to Windows Job Object for automatic cleanup");
                            Some(JobHandle(job))
                        }
                    }
                }
            }
        }
    };

    // Capture stdout in background task
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => eprintln!("[backend] {}", line),
                    Err(e) => eprintln!("[backend error] Failed to read stdout: {}", e),
                }
            }
        });
    }

    // Capture stderr in background task
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => eprintln!("[backend error] {}", line),
                    Err(e) => eprintln!("[backend error] Failed to read stderr: {}", e),
                }
            }
        });
    }

    Ok(SidecarProcess::new(
        child,
        #[cfg(windows)]
        job_handle,
    ))
}

/// Wait for backend to become healthy with retries and timeout.
/// Monitors the process for unexpected exits during polling.
fn wait_for_backend_health_check(
    port: u16,
    sidecar: &mut SidecarProcess,
) -> Result<(), Box<dyn std::error::Error>> {
    let start = std::time::Instant::now();
    let timeout = STARTUP_TIMEOUT;

    eprintln!(
        "[info] Waiting for backend to become ready on port {}...",
        port
    );

    while start.elapsed() < timeout {
        // Check if process exited unexpectedly
        if let Ok(Some(status)) = sidecar.try_wait() {
            return Err(SidecarError::ProcessExited(format!(
                "Backend process exited with status: {}",
                status
            ))
            .into());
        }

        if is_port_open(port) {
            if verify_backend_ownership(port) {
                eprintln!("[info] Backend is ready on port {}", port);
                return Ok(());
            }
        }
        std::thread::sleep(HEALTH_CHECK_INTERVAL);
    }

    // Timeout - process is still running but not healthy
    Err(SidecarError::Timeout(format!(
        "Backend did not become ready within {:?} on port {}",
        timeout, port
    ))
    .into())
}

/// Spawn the backend sidecar and wait for it to be ready.
/// Returns the owned SidecarProcess on success.
fn spawn_and_wait_for_backend(
    sidecar_path: &PathBuf,
    port: u16,
    db_url: &str,
) -> Result<SidecarProcess, Box<dyn std::error::Error>> {
    let mut sidecar = spawn_sidecar(sidecar_path, port, db_url)?;

    // Wait for backend to be ready, monitoring for early exit
    wait_for_backend_health_check(port, &mut sidecar)?;

    // Mark backend as ready
    if let Some(ready) = BACKEND_READY.get() {
        *ready.lock().unwrap() = true;
    }

    eprintln!("[info] Backend is ready and healthy on port {}", port);
    Ok(sidecar)
}

fn get_database_path_for_env() -> PathBuf {
    let local_appdata = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .expect("LOCALAPPDATA is required for the persistent SFT Billing database");
    local_appdata.join("SFT Billing").join("sft_billing.db")
}

/// Install the approved master-data database only when no production database exists.
/// Uses SQLite's backup API for consistent copy, verifies integrity, and validates schema.
fn initialize_production_database(
    db_path: &PathBuf,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    if db_path.exists() {
        return verify_existing_production_database(db_path);
    }

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {}", e))?;
    }

    /// Attempt to locate the seed database using multiple strategies:
    /// 1. Tauri resource resolver (proper bundled resource)
    /// 2. Next to the executable (fallback for installer packaging)
    /// 3. In a resources/ directory next to the executable
    fn locate_seed_database(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
        // Strategy 1: Tauri resource resolver
        if let Some(path) = app_handle
            .path_resolver()
            .resolve_resource("sft_billing_initial.db")
        {
            eprintln!(
                "[info] Tauri resource resolver returned: {}",
                path.display()
            );
            if path.exists() {
                eprintln!(
                    "[info] Found seed database via Tauri resource resolver: {}",
                    path.display()
                );
                return Ok(path);
            } else {
                eprintln!(
                    "[warn] Tauri resource resolver path does not exist: {}",
                    path.display()
                );
            }
        } else {
            eprintln!("[warn] Tauri resource resolver returned None");
        }

        // Strategy 2: Next to the executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let candidate = exe_dir.join("sft_billing_initial.db");
                eprintln!(
                    "[info] Checking for seed database at: {}",
                    candidate.display()
                );
                if candidate.exists() {
                    eprintln!(
                        "[info] Found seed database next to executable: {}",
                        candidate.display()
                    );
                    return Ok(candidate);
                }

                // Strategy 3: In resources/ directory next to executable
                let candidate = exe_dir.join("resources").join("sft_billing_initial.db");
                eprintln!(
                    "[info] Checking for seed database at: {}",
                    candidate.display()
                );
                if candidate.exists() {
                    eprintln!(
                        "[info] Found seed database in resources/ directory: {}",
                        candidate.display()
                    );
                    return Ok(candidate);
                }
            }
        }

        Err("Failed to locate sft_billing_initial.db. Tried: Tauri resource resolver, executable directory, and resources/ directory.".to_string())
    }

    let resource_path = locate_seed_database(app_handle)?;

    eprintln!("[info] Using seed database at: {}", resource_path.display());

    if !resource_path.exists() {
        return Err(format!(
            "Initial database resource not found at: {}",
            resource_path.display()
        ));
    }

    // Convert Windows path to proper file URI
    let path_str = resource_path.to_string_lossy();
    // Remove extended path prefix if present
    let path_str = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str);
    // Convert to forward slashes and ensure absolute path starts with /
    let path_str = path_str.replace('\\', "/");
    let source_uri = if path_str.starts_with('/') {
        format!("file:{}?mode=ro", path_str)
    } else {
        format!("file:///{}?mode=ro", path_str)
    };
    let source_conn = Connection::open_with_flags(
        &source_uri,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
    )
    .map_err(|e| format!("Failed to open initial database resource: {}", e))?;

    // Verify source database has tables
    let table_count: i64 = source_conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    eprintln!("[info] Seed database has {} tables", table_count);

    let mut dest_conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to create production database: {}", e))?;

    {
        let backup = rusqlite::backup::Backup::new(&source_conn, &mut dest_conn)
            .map_err(|e| format!("Failed to initialize SQLite backup: {}", e))?;

        eprintln!("[info] Starting SQLite backup from seed database...");
        // Use step-by-step backup to avoid pages_per_step issue
        loop {
            let progress = backup.step(1000).map_err(|e| {
                let _ = std::fs::remove_file(db_path);
                format!(
                    "Failed to copy initial database via SQLite backup API: {}",
                    e
                )
            })?;
            match progress {
                rusqlite::backup::StepResult::Done => break,
                rusqlite::backup::StepResult::More => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                _ => {
                    // Non-exhaustive enum - handle any future variants
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
            }
        }
        eprintln!("[info] SQLite backup completed successfully");
    }

    let integrity: String = dest_conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| {
            format!(
                "Failed to run integrity_check on production database: {}",
                e
            )
        })?;

    if integrity != "ok" {
        drop(dest_conn);
        let _ = std::fs::remove_file(db_path);
        return Err(format!(
            "Production database failed integrity_check: {}",
            integrity
        ));
    }

    let table_count: i64 = dest_conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='clients'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to verify schema: {}", e))?;

    if table_count == 0 {
        drop(dest_conn);
        let _ = std::fs::remove_file(db_path);
        return Err("Production database missing required 'clients' table".to_string());
    }

    let version: String = dest_conn
        .query_row(
            "SELECT version_num FROM alembic_version LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to read migration version: {}", e))?;

    eprintln!(
        "[info] Initialized production database from approved initial database at: {} (migration: {})",
        db_path.display(), version
    );
    Ok(())
}

/// Verify an existing production database for integrity and required schema.
/// Never modifies the database - only validates. Returns error with diagnostics on failure.
fn verify_existing_production_database(db_path: &PathBuf) -> Result<(), String> {
    eprintln!(
        "[info] Verifying existing production database at: {}",
        db_path.display()
    );

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open production database: {}", e))?;

    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| {
            format!(
                "Failed to run integrity_check on production database: {}",
                e
            )
        })?;

    if integrity != "ok" {
        return Err(format!(
            "Production database failed integrity_check: {}. Database may be corrupted. \
            Do not attempt to overwrite - investigate and restore from backup.",
            integrity
        ));
    }

    let table_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='clients'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to verify schema: {}", e))?;

    if table_count == 0 {
        return Err("Production database missing required 'clients' table. Database appears to be empty or corrupted.".to_string());
    }

    let version: String = conn
        .query_row(
            "SELECT version_num FROM alembic_version LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to read migration version: {}", e))?;

    eprintln!(
        "[info] Existing production database verified successfully (migration: {})",
        version
    );
    Ok(())
}

#[tauri::command]
fn get_backend_port() -> u16 {
    BACKEND_PORT.get().copied().unwrap_or(8000)
}

#[tauri::command]
fn get_backend_status() -> Result<BackendStatus, String> {
    let port = BACKEND_PORT.get().copied().unwrap_or(8000);

    let db_path = get_database_path_for_env();

    let healthy = if is_port_open(port) {
        verify_backend_ownership(port)
    } else {
        false
    };

    Ok(BackendStatus {
        port,
        database_path: db_path.to_string_lossy().to_string(),
        healthy,
    })
}

#[tauri::command]
fn wait_for_backend_ready(max_wait_secs: u64) -> Result<(), String> {
    let port = BACKEND_PORT.get().copied().unwrap_or(8000);

    for _ in 0..max_wait_secs {
        if is_port_open(port) {
            if verify_backend_ownership(port) {
                if let Some(ready) = BACKEND_READY.get() {
                    *ready.lock().unwrap() = true;
                }
                return Ok(());
            }
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    Err(format!(
        "Backend on port {} did not become ready within {} seconds",
        port, max_wait_secs
    ))
}

#[derive(serde::Serialize)]
struct BackendStatus {
    port: u16,
    database_path: String,
    healthy: bool,
}

/// Setup function with improved error handling and logging
fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    let db_path = get_database_path_for_env();
    initialize_production_database(&db_path, &app_handle)?;

    let port = find_available_port(8000, 8010)
        .ok_or("No available port in range 8000-8010 for backend sidecar")?;

    let db_url = format!("sqlite:///{}", db_path.to_string_lossy().replace('\\', "/"));

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let sidecar_path = current_binary(&tauri::Env::default())?
        .parent()
        .expect("Failed to get executable directory")
        .join("sft-billing-backend.exe");

    // Spawn backend and wait for it to be ready - returns owned SidecarProcess
    let sidecar = spawn_and_wait_for_backend(&sidecar_path, port, &db_url)?;

    BACKEND_PORT.set(port).ok();

    let backend_ready = Arc::new(Mutex::new(false));
    BACKEND_READY.set(Arc::clone(&backend_ready)).ok();

    // Store the owned SidecarProcess for cleanup (wrapped in Mutex for interior mutability)
    let sidecar_handle = Arc::new(Mutex::new(Some(sidecar)));

    std::env::set_var("SFT_BILLING_BACKEND_PORT", port.to_string());

    eprintln!("[info] Backend is ready, showing main window");

    if let Some(window) = app.get_window("main") {
        window.show().ok();
    }

    app.manage(sidecar_handle);

    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_backend_port,
            get_backend_status,
            wait_for_backend_ready
        ])
        .setup(|app| {
            setup_app(app).map_err(|e| format!("Failed to setup application: {}", e))?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Get the sidecar handle for cleanup on exit
    let sidecar_handle = app
        .state::<Arc<Mutex<Option<SidecarProcess>>>>()
        .inner()
        .clone();

    app.run(move |_, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Ok(mut guard) = sidecar_handle.lock() {
                if let Some(mut sidecar) = guard.take() {
                    sidecar.terminate();
                }
            }
        }
    });
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::process::{Command, Stdio};
    use std::thread;
    use std::time::Duration;

    /// Spawn a mock HTTP server that responds to /api/health
    /// Returns a dummy Child handle (the server runs in a background thread)
    fn spawn_mock_health_server(port: u16, delay_ms: u64, healthy: bool) -> Child {
        let listener = TcpListener::bind(("127.0.0.1", port)).unwrap();

        thread::spawn(move || {
            for stream in listener.incoming() {
                let mut stream = stream.unwrap();
                let mut buffer = [0; 1024];
                if stream.read(&mut buffer).is_err() {
                    continue;
                }
                thread::sleep(Duration::from_millis(delay_ms));
                let response: &[u8] = if healthy {
                    b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 27\r\n\r\n{\"status\": \"ok\", \"ok\": true}"
                } else {
                    b"HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/html\r\nContent-Length: 27\r\n\r\n{\"error\": \"Internal Error\"}"
                };
                let _ = stream.write_all(response);
                let _ = stream.flush();
                // Only handle one request then exit
                break;
            }
        });

        // Return a dummy child that just waits
        Command::new("cmd")
            .args(["/c", "timeout", "/t", "3600"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap()
    }

    /// Spawn a simple server that holds a port open but doesn't respond to health checks
    fn spawn_port_holder(port: u16) -> Child {
        let _listener = TcpListener::bind(("127.0.0.1", port)).unwrap();

        thread::spawn(move || {
            // Just hold the port open
            thread::sleep(Duration::from_secs(10));
        });

        Command::new("cmd")
            .args(["/c", "timeout", "/t", "3600"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap()
    }

    #[test]
    fn test_find_available_port() {
        let port = find_available_port(18000, 18010);
        assert!(port.is_some());
    }

    #[test]
    fn test_verify_backend_ownership_no_server() {
        // Should return false when no server is running
        assert!(!verify_backend_ownership(18001));
    }

    #[test]
    fn test_is_port_open() {
        assert!(!is_port_open(18002));
    }

    #[test]
    fn test_verify_backend_ownership_healthy() {
        // Start a mock healthy server
        let port = 18003;
        let _child = spawn_mock_health_server(port, 10, true);

        // Give server time to start
        thread::sleep(Duration::from_millis(100));

        // Should return true for healthy server
        assert!(verify_backend_ownership(port));
    }

    #[test]
    fn test_verify_backend_ownership_unhealthy() {
        // Start a mock unhealthy server (returns 500)
        let port = 18004;
        let _child = spawn_mock_health_server(port, 10, false);

        thread::sleep(Duration::from_millis(100));

        // Should return false for unhealthy server
        assert!(!verify_backend_ownership(port));
    }

    #[test]
    fn test_verify_backend_ownership_port_holder() {
        // Start a server that holds port but doesn't respond to health check
        let port = 18005;
        let _child = spawn_port_holder(port);

        thread::sleep(Duration::from_millis(100));

        // Should return false - port open but no valid health response
        assert!(!verify_backend_ownership(port));
    }

    #[test]
    fn test_spawn_and_wait_missing_binary() {
        // Test that spawn_sidecar returns BinaryNotFound for missing executable
        let path = PathBuf::from("C:\\nonexistent\\sft-billing-backend.exe");
        let result = spawn_sidecar(&path, 18006, "sqlite:///test.db");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Backend binary not found"));
    }
}
