use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_positioner::{on_tray_event, Position, WindowExt};

const TRAY_ID: &str = "main";

const TRAY_ICON_NORMAL: &[u8] = include_bytes!("../icons/tray-icon.rgba");
const TRAY_ICON_WARNING: &[u8] = include_bytes!("../icons/tray-icon-warning.rgba");
const TRAY_ICON_CRITICAL: &[u8] = include_bytes!("../icons/tray-icon-critical.rgba");

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.move_window(Position::TrayCenter);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Swap the menu-bar tray icon to reflect the highest usage level observed
/// across all configured accounts. Called from the dashboard after each
/// fetch cycle. `level` is one of `"normal"`, `"warning"`, `"critical"`.
#[tauri::command]
fn set_tray_status(app: AppHandle, level: String) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Err("tray not found".into());
    };
    let (bytes, is_template) = match level.as_str() {
        "warning" => (TRAY_ICON_WARNING, false),
        "critical" => (TRAY_ICON_CRITICAL, false),
        _ => (TRAY_ICON_NORMAL, true),
    };
    let image = Image::new(bytes, 18, 18);
    tray.set_icon(Some(image)).map_err(|e| e.to_string())?;
    // Template images auto-invert with the menu bar; tinted variants must
    // opt out so the amber/red colour survives.
    tray.set_icon_as_template(is_template)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())   // ← add this
        .setup(|app| {
            // Hide from Dock — this app lives in the menu bar only
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            // Build tray icon — left-click toggles the window
            let tray_icon = Image::new(TRAY_ICON_NORMAL, 18, 18);

            let quit = MenuItem::with_id(app, "quit", "Quit uso.ai", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;

            let _tray = TrayIconBuilder::with_id(TRAY_ID)
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id().as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Let positioner track the tray icon's screen position
                    on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Global shortcut: Cmd+Shift+U (Ctrl+Shift+U on Windows/Linux)
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
            app.global_shortcut().on_shortcut(
                "CommandOrControl+Shift+U",
                |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_window(app);
                    }
                },
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![hide_window, set_tray_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
