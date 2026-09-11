// ServeHub — Tauri shell
//
// Desktop (Windows): launches the embedded restaurant server (Next.js
// standalone + realtime service) as a child process, waits for it to become
// healthy, then advertises the restaurant over mDNS (_servehub._tcp) so
// Android employees can discover it on the LAN.
//
// Mobile (Android): thin client only. mDNS discovery is exposed as a command
// so the connection screen can find ServeHub restaurant servers.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[cfg(desktop)]
mod server_manager {
    use std::io::{BufRead, BufReader};
    use std::process::{Child, Command, Stdio};
    use std::sync::Mutex;
    use std::time::Duration;

    static SERVER_CHILD: Mutex<Option<Child>> = Mutex::new(None);
    static MDNS_DAEMON: Mutex<Option<mdns_sd::ServiceDaemon>> = Mutex::new(None);

    fn log(msg: &str) {
        println!("[servehub-shell] {msg}");
    }

    fn spawn_server(resource_dir: std::path::PathBuf, data_dir: std::path::PathBuf) -> Result<(), String> {
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

        let mut child = Command::new(&runtime)
            .args([&entry])
            .current_dir(&server_dir)
            .env("NODE_ENV", "production")
            .env("PORT", "3000")
            .env("HOSTNAME", "0.0.0.0")
            .env("DATABASE_URL", database_url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to start server runtime: {e}"))?;

        // Pipe server output to the shell log (stderr only; stdout is noisy).
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    println!("[server] {line}");
                }
            });
        }

        *SERVER_CHILD.lock().unwrap() = Some(child);
        Ok(())
    }

    fn wait_for_server() -> bool {
        for _ in 0..180 {
            if std::net::TcpStream::connect("127.0.0.1:3000").is_ok() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(500));
        }
        false
    }

    fn fetch_identity() -> Option<(String, String)> {
        let body = ureq::get("http://127.0.0.1:3000/api/config")
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
        let safe_name: String = name
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .take(40)
            .collect();
        let instance = format!("servehub-{server_id}");
        let host_ip = local_ip();
        let host_name = format!("servehub-{server_id}.local.");
        let props = [
            ("serverId", server_id.to_string()),
            ("name", name.to_string()),
            ("version", "1.0.0".to_string()),
            ("realtimePort", "3003".to_string()),
        ];
        match mdns_sd::ServiceInfo::new(
            "_servehub._tcp.local.",
            &instance,
            &host_name,
            host_ip.as_str(),
            3000,
            &props[..],
        ) {
            Ok(info) => match daemon.register(info) {
                Ok(_) => log(&format!("mDNS service registered: {instance} ({name})")),
                Err(e) => log(&format!("mDNS register failed: {e}")),
            },
            Err(e) => log(&format!("mDNS service info failed: {e}")),
        }
        *MDNS_DAEMON.lock().unwrap() = Some(daemon);
    }

    pub fn start(app: tauri::AppHandle) {
        std::thread::spawn(move || {
            use tauri::Manager;
            let resource_dir = match app.path().resource_dir() {
                Ok(d) => d,
                Err(e) => {
                    log(&format!("resource dir unavailable: {e}"));
                    return;
                }
            };
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            if let Err(e) = spawn_server(resource_dir, data_dir) {
                log(&e);
                return;
            }
            if !wait_for_server() {
                log("server did not become reachable on port 3000");
                return;
            }
            log("server is up");
            if let Some((server_id, name)) = fetch_identity() {
                advertise(&name, &server_id);
            } else {
                log("could not read server identity; advertising with defaults");
                advertise("ServeHub", "SH-0000-0000");
            }
        });
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
    use std::time::Duration;
    use mdns_sd::ServiceEvent;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![discover_servers])
        .on_page_load(|webview, _payload| {
            // Desktop shell flag: the frontend auto-connects to the embedded
            // local server instead of showing the connection screen.
            #[cfg(desktop)]
            let _ = webview.eval("window.__SERVEHUB_DESKTOP_SERVER__ = 'http://127.0.0.1:3000';");
        })
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
