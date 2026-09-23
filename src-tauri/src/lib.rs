mod commands;
mod fs_watch;

use commands::PendingOpen;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_updater::Builder::new().build());
    }

    // Single instance: if Eddie is already running and the user opens another
    // .md (double-click / "open with"), forward the path to the running window
    // instead of spawning a second process.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = commands::markdown_args(argv);
            if !paths.is_empty() {
                let _ = app.emit("open-files", paths);
            }
            // Bring the existing window to the front.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(PendingOpen::default())
        .setup(|app| {
            // Capture any markdown files passed on the command line at launch.
            let pending = commands::markdown_args(std::env::args());
            if !pending.is_empty() {
                let state = app.state::<PendingOpen>();
                *state.0.lock().unwrap() = pending;
            }
            fs_watch::init(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            commands::rename_file,
            commands::list_dir,
            commands::file_meta,
            commands::take_pending_open,
            fs_watch::set_watched_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Eddie");
}
