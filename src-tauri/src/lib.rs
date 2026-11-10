mod commands;
mod import;
mod mobile_transfer;
mod models;
mod state;
mod steam;
mod vault;

use std::sync::Arc;
use tauri::Manager;

use state::AppState;
use vault::vault_path;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = builder.plugin(tauri_plugin_biometric::init());

    builder
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data).ok();
            let path = vault_path(&app_data);
            app.manage(Arc::new(AppState::new(path)));

            #[cfg(desktop)]
            {
                let icon = tauri::include_image!("icons/32x32.png");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(icon);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::vault_status,
            commands::vault_create,
            commands::vault_unlock,
            commands::vault_lock,
            commands::vault_wipe,
            commands::vault_change_password,
            commands::vault_verify_password,
            commands::accounts_list,
            commands::account_select,
            commands::account_remove,
            commands::guard_code,
            commands::import_mafile,
            commands::import_mafile_text,
            commands::import_shared_secret,
            commands::confirmations_list,
            commands::confirmation_accept,
            commands::confirmation_deny,
            commands::events_recent,
            commands::settings_get,
            commands::settings_set,
            commands::steam_setup_begin,
            commands::steam_setup_submit_login_code,
            commands::steam_setup_continue,
            commands::steam_setup_submit_sms,
            commands::steam_setup_cancel,
            commands::steam_session_begin,
            commands::steam_session_submit_code,
            commands::steam_session_continue,
            commands::steam_session_cancel,
            commands::guard_code_for,
            commands::mobile_transfer_prepare,
            commands::mobile_transfer_confirm_code,
            commands::mobile_transfer_import,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Custom SDA");
}
