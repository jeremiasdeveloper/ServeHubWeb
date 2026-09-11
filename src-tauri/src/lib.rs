// ServeHub — Tauri shell
//
// Desktop (Windows): launches the embedded restaurant server (Next.js
// standalone + realtime service) as a child process, waits for it to accept
// TCP connections, navigates the window to it, then advertises the restaurant
// over mDNS (_servehub._tcp) so Android employees can discover it on the LAN.
//
// The window starts on a local boot screen (boot.html) that performs no
// network requests of its own: a fetch from the tauri:// asset origin to the
// server would be cross-origin and blocked by CORS, which is why the earlier
// JS-polling boot screens never progressed past the spinner. Rust owns the
// readiness check and the navigation.
//
// Mobile (Android): thin client only. mDNS discovery is exposed as a command
// so the connection screen can find ServeHub restaurant servers.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[cfg(desktop)]
mod server_manager {
    use std::io::{BufRead, BufReader, Write};
    use std::path::{Path, PathBuf};
    use std::process::{Child, Command, Stdio};
    use std::sync::Mutex;
    use std::time::Duration;

    static SERVER_CHILD: Mutex<Option<Child>> = Mutex::new(None);
    static MDNS_DAEMON: Mutex<Option<mdns_sd::ServiceDaemon>> = Mutex::new(None);
    static LOG_FILE: Mutex<Option<PathBuf>> = Mutex::new(None);

    /// The embedded server binds 0.0.0.0 (so Android can reach it over the
    /// LAN) but the shell always addresses it over IPv4 loopback. `localhost`
    /// is deliberately avoided: on Windows it resolves to ::1 first and the
    /// IPv4-only listener never answers.
    const SERVER_URL: &str = "http://127.0.0.1:3000";
    const SERVER_PORT: u16 = 3000;
    /// 180 * 500ms = 90s, generous enough for the first launch (database
    /// template copy + Next.js cold start on a slow machine).
    const WAIT_ATTEMPTS: u32 = 180;

    // ---- logging ------------------------------------------------------------
    // A release build has no console, so the shell and the child server both
    // write to %APPDATA%\com.servehub.app\logs\servehub.log. Diagnosing a
    // failure on an installed machine means reading that file.

    fn write_log(line: &str) {
        println!("{line}");
        let guard = match LOG_FILE.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if let Some(path) = guard.as_ref() {
            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
                let _ = writeln!(f, "{line}");
            }
        }
    }

    fn log(msg: &str) {
        write_log(&format!("[servehub-shell] {msg}"));
    }

    fn init_log_file(data_dir: &Path) -> PathBuf {
        let dir = data_dir.join("logs");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("servehub.log");
        if let Ok(mut guard) = LOG_FILE.lock() {
            *guard = Some(path.clone());
        }
        path
    }

    // ---- server process -----------------------------------------------------

    fn spawn_server(resource_dir: PathBuf, data_dir: PathBuf) -> Result<(), String> {
        let server_dir = resource_dir.join("server");
        let runtime = server_dir.join("servehub-runtime.exe");
        // The combined entry starts realtime + Next.js in one process; fall
        // back to the plain Next.js standalone entry if it is missing.
        let combined_entry = server_dir.join("servehub-entry.js");
        let plain_entry = server_dir.join("server.js");
        let entry = if combined_entry.exists() {
            combined_entry
        } else {
            plain_entry
        };

        log(&format!("server directory: {}", server_dir.display()));
        if !runtime.exists() {
            return Err(format!("runtime not found: {}", runtime.display()));
        }
        if !entry.exists() {
            return Err(format!("server entry not found: {}", entry.display()));
        }

        let db_dir = data_dir.join("db");
        std::fs::create_dir_all(&db_dir).map_err(|e| e.to_string())?;
        let db_path = db_dir.join("custom.db");
        let database_url = format!("file:{}", db_path.to_string_lossy().replace('\\', "/"));
        log(&format!("database: {database_url}"));

        let mut child = Command::new(&runtime)
            .args([&entry])
            .current_dir(&server_dir)
            .env("NODE_ENV", "production")
            .env("PORT", SERVER_PORT.to_string())
            .env("HOSTNAME", "0.0.0.0")
            .env("DATABASE_URL", database_url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to start server runtime: {e}"))?;

        if let Some(stdout) = child.stdout.take() {
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    write_log(&format!("[server] {line}"));
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    write_log(&format!("[server] {line}"));
                }
            });
        }

        *SERVER_CHILD.lock().unwrap() = Some(child);
        log("server process spawned");
        Ok(())
    }

    fn wait_for_server() -> bool {
        for attempt in 0..WAIT_ATTEMPTS {
            if std::net::TcpStream::connect(("127.0.0.1", SERVER_PORT)).is_ok() {
                log(&format!("server accepted a connection after {}ms", attempt * 500));
                return true;
            }
            std::thread::sleep(Duration::from_millis(500));
        }
        false
    }

    fn fetch_identity() -> Option<(String, String)> {
        let body = ureq::get(&format!("{SERVER_URL}/api/config"))
            .timeout(Duration::from_secs(10))
            .call()
            .ok()?
            .into_string()
            .ok()?;
        let json: serde_json::Value = serde_json::from_str(&body).ok()?;
        let server_id = json.get("serverId")?.as_str()?.to_string();
        let name = json
            .pointer("/restaurant/name")
            .and_then(|v| v.as_str())
            .unwrap_or("ServeHub")
            .to_string();
        Some((server_id, name))
    }

    // ---- window control -----------------------------------------------------

    fn navigate_to_app(app: &tauri::AppHandle) {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            log("main window not found; cannot navigate");
            return;
        };
        match tauri::Url::parse(&format!("{SERVER_URL}/?servehub_desktop=1")) {
            Ok(url) => match window.navigate(url) {
                Ok(()) => log("window navigated to the restaurant server"),
                Err(e) => log(&format!("navigation failed: {e}")),
            },
            Err(e) => log(&format!("invalid server url: {e}")),
        }
    }

    fn show_startup_failure(app: &tauri::AppHandle, reason: &str) {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        // The boot page owns the DOM; the shell only reveals the notice and
        // records the reason so a non-technical user sees something useful.
        let safe: String = reason
            .chars()
            .filter(|c| !c.is_control())
            .take(300)
            .collect();
        let script = format!(
            "(function(){{var w=document.getElementById('warning');if(w)w.style.display='block';\
             var s=document.getElementById('status');if(s)s.textContent='El servidor no pudo iniciar.';\
             var d=document.getElementById('reason');if(d)d.textContent={};}})();",
            serde_json::to_string(&safe).unwrap_or_else(|_| "\"\"".to_string())
        );
        let _ = window.eval(&script);
    }

    // ---- mDNS ---------------------------------------------------------------

    fn local_ip() -> String {
        // Primary LAN interface address (does not send packets).
        if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if sock.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = sock.local_addr() {
                    return addr.ip().to_string();
                }
            }
        }
        "127.0.0.1".to_string()
    }

    fn advertise(name: &str, server_id: &str) {
        let daemon = match mdns_sd::ServiceDaemon::new() {
            Ok(d) => d,
            Err(e) => {
                log(&format!("mDNS daemon unavailable: {e}"));
                return;
            }
        };
        let instance = format!("servehub-{server_id}");
        let host_ip = local_ip();
        let host_name = format!("servehub-{server_id}.local.");
        let props = [
            ("serverId", server_id.to_string()),
            ("name", name.to_string()),
            ("version", "1.0.3".to_string()),
            ("realtimePort", "3003".to_string()),
        ];
        match mdns_sd::ServiceInfo::new(
            "_servehub._tcp.local.",
            &instance,
            &host_name,
            host_ip.as_str(),
            SERVER_PORT,
            &props[..],
        ) {
            Ok(info) => match daemon.register(info) {
                Ok(_) => log(&format!("mDNS service registered: {instance} ({name}) at {host_ip}")),
                Err(e) => log(&format!("mDNS register failed: {e}")),
            },
            Err(e) => log(&format!("mDNS service info failed: {e}")),
        }
        *MDNS_DAEMON.lock().unwrap() = Some(daemon);
    }

    fn stop_advertising() {
        if let Ok(mut guard) = MDNS_DAEMON.lock() {
            if let Some(daemon) = guard.take() {
                let _ = daemon.shutdown();
            }
        }
    }

    // ---- lifecycle ----------------------------------------------------------

    fn boot_sequence(app: tauri::AppHandle) {
        use tauri::Manager;

        let resource_dir = match app.path().resource_dir() {
            Ok(d) => d,
            Err(e) => {
                write_log(&format!("[servehub-shell] resource dir unavailable: {e}"));
                return;
            }
        };
        let data_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let log_path = init_log_file(&data_dir);
        log(&format!(
            "ServeHub desktop shell starting (log: {})",
            log_path.display()
        ));

        if let Err(e) = spawn_server(resource_dir, data_dir) {
            log(&e);
            show_startup_failure(&app, &e);
            return;
        }

        if !wait_for_server() {
            let reason = format!(
                "el servidor no respondió en 127.0.0.1:{SERVER_PORT} tras 90 segundos"
            );
            log(&reason);
            show_startup_failure(&app, &reason);
            return;
        }

        navigate_to_app(&app);

        if let Some((server_id, name)) = fetch_identity() {
            advertise(&name, &server_id);
        } else {
            log("could not read server identity; advertising with defaults");
            advertise("ServeHub", "SH-0000-0000");
        }
    }

    pub fn start(app: tauri::AppHandle) {
        std::thread::spawn(move || boot_sequence(app));
    }

    pub fn restart(app: tauri::AppHandle) {
        log("restart requested from the boot screen");
        stop_advertising();
        shutdown();
        std::thread::spawn(move || boot_sequence(app));
    }

    pub fn shutdown() {
        if let Some(mut child) = SERVER_CHILD.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
            log("server stopped");
        }
    }
}

#[derive(Serialize)]
pub struct DiscoveredServer {
    pub name: String,
    pub serverId: String,
    pub host: String,
    pub port: u16,
    pub realtimePort: u16,
}

// mDNS/DNS-SD discovery of _servehub._tcp services on the local network.
#[tauri::command]
fn discover_servers(timeout_ms: u64) -> Result<Vec<DiscoveredServer>, String> {
    use mdns_sd::ServiceEvent;
    use std::time::Duration;

    let daemon = mdns_sd::ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = daemon
        .browse("_servehub._tcp.local.")
        .map_err(|e| e.to_string())?;

    let timeout = Duration::from_millis(timeout_ms.clamp(500, 15000));
    let deadline = std::time::Instant::now() + timeout;
    let mut found: Vec<DiscoveredServer> = Vec::new();

    while std::time::Instant::now() < deadline {
        match receiver.recv_timeout(deadline - std::time::Instant::now()) {
            Ok(ServiceEvent::ServiceResolved(info)) => {
                let props = info.get_properties();
                // Prefer the resolved IPv4 address — Android's mDNS name
                // resolution inside a WebView is unreliable.
                let host = info
                    .get_addresses_v4()
                    .iter()
                    .next()
                    .map(|ip| ip.to_string())
                    .unwrap_or_else(|| info.get_hostname().trim_end_matches('.').to_string());
                let server_id = props
                    .get_property_val_str("serverId")
                    .unwrap_or("unknown")
                    .to_string();
                if found.iter().any(|s| s.serverId == server_id && s.host == host) {
                    continue;
                }
                found.push(DiscoveredServer {
                    name: props
                        .get_property_val_str("name")
                        .unwrap_or("ServeHub")
                        .to_string(),
                    serverId: server_id,
                    host,
                    port: info.get_port(),
                    realtimePort: props
                        .get_property_val_str("realtimePort")
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(3003),
                });
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }
    let _ = daemon.stop_browse("_servehub._tcp.local.");
    Ok(found)
}

// Invoked by the boot screen's retry button after a failed startup.
#[tauri::command]
fn restart_server(app: tauri::AppHandle) {
    #[cfg(desktop)]
    {
        server_manager::restart(app);
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![discover_servers, restart_server])
        .setup(|app| {
            #[cfg(desktop)]
            server_manager::start(app.handle().clone());
            Ok(())
        });

    #[cfg(desktop)]
    {
        builder
            .build(tauri::generate_context!())
            .expect("error while building tauri application")
            .run(|_app, event| {
                if let tauri::RunEvent::ExitRequested { .. } = event {
                    server_manager::shutdown();
                }
            });
    }

    #[cfg(not(desktop))]
    {
        builder
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}