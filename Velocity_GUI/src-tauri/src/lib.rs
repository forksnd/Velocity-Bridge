use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{Menu, MenuItem},
    Manager,
};


#[tauri::command]
fn get_install_type() -> String {
    if std::env::var("APPIMAGE").is_ok() {
        return "appimage".to_string();
    }
    
    if let Ok(exe_path) = std::env::current_exe() {
        let path_str = exe_path.to_string_lossy();
        if path_str.starts_with("/usr/") {
            // Check for distro specific files to identify package manager
            if std::path::Path::new("/etc/arch-release").exists() {
                return "aur".to_string();
            } else if std::path::Path::new("/etc/fedora-release").exists() {
                return "dnf".to_string();
            } else if std::path::Path::new("/etc/debian_version").exists() {
                return "apt".to_string();
            }
            return "native".to_string();
        }
    }
    
    "manual".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix for "Failed to create GBM buffer" on Linux (WebKitGTK)
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--silent"])))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // If app is already running, show the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![get_install_type, install_update])
        .setup(|app| {
            // ── Decide window visibility on startup ──────────────────────────────
            // Window is always created hidden (tauri.conf.json: "visible": false).
            // Show it unless: (a) --silent/-s passed, or (b) start_minimized in settings.
            let silent_flag = std::env::args().any(|a| a == "--silent" || a == "-s");

            let start_minimized = {
                let config_dir = dirs::home_dir()
                    .unwrap_or_default()
                    .join(".config")
                    .join("velocity-bridge");
                let settings_path = config_dir.join("settings.json");
                if let Ok(raw) = std::fs::read_to_string(&settings_path) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                        val.get("start_minimized")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false)
                    } else { false }
                } else { false }
            };

            if !silent_flag && !start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            // ────────────────────────────────────────────────────────────────────

            // Create tray menu
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Velocity Bridge")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            // Force kill server backend before exiting
                            kill_server();
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Show window on left click
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide window on close instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::Exit => {
                // Force kill server backend on exit
                kill_server();
            }
            _ => {}
        });
}

#[cfg(target_os = "linux")]
fn kill_server() {
    let _ = std::process::Command::new("pkill").args(["-f", "velocity-backend"]).status();
    let _ = std::process::Command::new("fuser").args(["-k", "8080/tcp"]).status();
}

#[cfg(target_os = "windows")]
fn kill_server() {
    use std::os::windows::process::CommandExt;
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "velocity-backend.exe", "/T"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status();
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
fn kill_server() {
    // No-op for other OSs
}

#[tauri::command]
fn install_update(package_path: String) -> Result<(), String> {
    use std::process::Command;
    
    // 1. Make executable (just in case)
    #[cfg(unix)]
    let _ = Command::new("chmod")
        .args(["+x", &package_path])
        .status();
    
    // 2. Spawn the installer in DETACHED mode
    Command::new(package_path)
        .arg("--silent")
        .spawn()
        .map_err(|e| format!("Failed to launch updater: {}", e))?;
        
    // 3. Kill server and exit immediately
    kill_server();
    std::process::exit(0);
}
