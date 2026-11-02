// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::time::Duration;
use std::path::PathBuf;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{copy, ErrorKind};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::Manager;
use tauri::api::process::{Command, current_binary};

static BACKEND_PORT: OnceLock<u16> = OnceLock::new();
static BACKEND_READY: OnceLock<Arc<Mutex<bool>>> = OnceLock::new();

fn terminate_sidecar_process_tree(pid: u32) {
    let pid = pid.to_string();
    let result = std::process::Command::new("taskkill.exe")
        .args(["/PID", pid.as_str(), "/T", "/F"])
        .output();

    match result {
        Ok(output) if output.status.success() => {}
        Ok(output) => {
            eprintln!(
                "[backend error] Failed to stop sidecar process tree {}: {}",
                pid,
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        Err(error) => {
            eprintln!(
                "[backend error] Failed to invoke taskkill for sidecar process {}: {}",
                pid, error
            );
        }
    }
}

fn is_port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn find_available_port(start_port: u16, max_port: u16) -> Option<u16> {
    for port in start_port..=max_port {
        if !is_port_open(port) {
            // Try to bind to confirm it's available
            if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
                return Some(port);
            }
        }
    }
    None
}

fn verify_backend_ownership(port: u16) -> bool {
    if let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) {
        use std::io::{Write, Read};
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

fn get_database_path_for_env() -> PathBuf {
    let local_appdata = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .expect("LOCALAPPDATA is required for the persistent SFT Billing database");
    local_appdata
        .join("SFT Billing")
        .join("sft_billing.db")
}

/// Install the approved master-data database only when no production database exists.
fn initialize_production_database(db_path: &PathBuf, app_handle: &tauri::AppHandle) -> Result<(), String> {
    if db_path.exists() {
        return Ok(());
    }

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create database directory: {}", e))?;
    }

    let resource_path = app_handle
        .path_resolver()
        .resolve_resource("sft_billing_initial.db")
        .ok_or("Failed to resolve initial database resource. Ensure sft_billing_initial.db is bundled as a resource.")?;

    if !resource_path.exists() {
        return Err(format!("Initial database resource not found at: {}", resource_path.display()));
    }

    let mut source = std::fs::File::open(&resource_path)
        .map_err(|e| format!("Failed to open initial database resource: {}", e))?;
    let mut destination = match OpenOptions::new().write(true).create_new(true).open(db_path) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::AlreadyExists => return Ok(()),
        Err(error) => return Err(format!("Failed to create production database: {}", error)),
    };

    if let Err(error) = copy(&mut source, &mut destination)
        .and_then(|_| destination.sync_all())
    {
        drop(destination);
        return match std::fs::remove_file(db_path) {
            Ok(()) => Err(format!("Failed to copy initial database: {}", error)),
            Err(cleanup_error) => Err(format!(
                "Failed to copy initial database: {}; failed to remove partial database: {}",
                error, cleanup_error
            )),
        };
    }

    eprintln!(
        "[info] Initialized production database from approved initial database at: {}",
        db_path.display()
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
    
    // Check if backend is healthy
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
                // Mark backend as ready
                if let Some(ready) = BACKEND_READY.get() {
                    *ready.lock().unwrap() = true;
                }
                return Ok(());
            }
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    Err(format!("Backend on port {} did not become ready within {} seconds", port, max_wait_secs))
}

#[derive(serde::Serialize)]
struct BackendStatus {
    port: u16,
    database_path: String,
    healthy: bool,
}

fn main() {
    let sidecar_pid = Arc::new(Mutex::new(None));
    let sidecar_pid_setup = Arc::clone(&sidecar_pid);

    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_backend_port, get_backend_status, wait_for_backend_ready])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            
            // Initialize production database on first run (never overwrites existing)
            let db_path = get_database_path_for_env();
            initialize_production_database(&db_path, &app_handle)
                .map_err(|e| format!("Failed to initialize production database: {}", e))?;

            let port = find_available_port(8000, 8010)
                .expect("No available port in range 8000-8010 for backend sidecar");

            let db_url = format!("sqlite:///{}", db_path.to_string_lossy().replace('\\', "/"));

            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            // Get the sidecar binary path (same directory as the main executable)
            let sidecar_path = current_binary(&app.env())?
                .parent()
                .expect("Failed to get executable directory")
                .join("sft-billing-backend.exe");

            // Prepare environment variables
            let mut env_vars = HashMap::new();
            env_vars.insert("SFT_BILLING_DATABASE_URL".to_string(), db_url);
            env_vars.insert("SFT_BILLING_PORT".to_string(), port.to_string());

            // Store the port globally for Tauri commands
            BACKEND_PORT.set(port).ok();

            // Initialize backend ready flag
            let backend_ready = Arc::new(Mutex::new(false));
            BACKEND_READY.set(Arc::clone(&backend_ready)).ok();

            // Use tauri::api::process::Command to spawn sidecar
            let (mut rx, child) = Command::new(sidecar_path.to_string_lossy().to_string())
                .args(["--port", &port.to_string()])
                .envs(env_vars)
                .spawn()
                .expect("Failed to spawn sidecar");
            *sidecar_pid_setup
                .lock()
                .expect("Sidecar process state lock is poisoned") = Some(child.pid());

            // Capture sidecar output for diagnostics
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let tauri::api::process::CommandEvent::Stdout(line) = event {
                        eprintln!("[backend] {}", line);
                    } else if let tauri::api::process::CommandEvent::Stderr(line) = event {
                        eprintln!("[backend error] {}", line);
                    }
                }
            });

            // Set the port env var so frontend can access it
            std::env::set_var("SFT_BILLING_BACKEND_PORT", port.to_string());

            // Show the main window immediately (it will show our React loading screen)
            // The backend will initialize in the background
            // Small delay to ensure window is ready
            std::thread::sleep(Duration::from_millis(100));
            
            // Show the main window
            if let Some(window) = app_handle.get_window("main") {
                window.show().ok();
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Some(pid) = *sidecar_pid
                .lock()
                .expect("Sidecar process state lock is poisoned")
            {
                terminate_sidecar_process_tree(pid);
            }
        }
    });
}