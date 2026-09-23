use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;

/// Holds the file path(s) Eddie was asked to open at launch (via CLI args /
/// file association double-click), so the frontend can pick them up once ready.
#[derive(Default)]
pub struct PendingOpen(pub Mutex<Vec<String>>);

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
}

/// Read a UTF-8 text file from disk.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {path}: {e}"))
}

/// Write a UTF-8 text file to disk, creating parent directories if needed.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create folder {}: {e}", parent.display()))?;
        }
    }
    std::fs::write(&path, content).map_err(|e| format!("Failed to save {path}: {e}"))
}

/// Rename a file on disk.
#[tauri::command]
pub fn rename_file(from: String, to: String) -> Result<(), String> {
    if from == to {
        return Ok(());
    }
    if !Path::new(&from).is_file() {
        return Err(format!("File not found: {from}"));
    }
    if Path::new(&to).exists() {
        return Err(format!("A file already exists at {to}"));
    }
    if let Some(parent) = Path::new(&to).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create folder {}: {e}", parent.display()))?;
        }
    }
    std::fs::rename(&from, &to).map_err(|e| format!("Failed to rename {from} to {to}: {e}"))
}

/// List the immediate children of a directory. Directories first, then files,
/// each alphabetically. Hidden entries (dotfiles) are skipped.
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let read = std::fs::read_dir(&path).map_err(|e| format!("Failed to list {path}: {e}"))?;
    let mut entries: Vec<DirEntry> = Vec::new();

    for entry in read.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }
        let p: PathBuf = entry.path();
        let is_dir = p.is_dir();
        let is_markdown = !is_dir && is_markdown_path(&p);
        entries.push(DirEntry {
            name: file_name,
            path: p.to_string_lossy().to_string(),
            is_dir,
            is_markdown,
        });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[derive(Serialize)]
pub struct FileMeta {
    /// Size on disk in bytes.
    pub size: u64,
    /// Last modified time as epoch milliseconds, if available.
    pub modified_ms: Option<i64>,
}

/// Return on-disk metadata (size + last modified) for a file.
#[tauri::command]
pub fn file_meta(path: String) -> Result<FileMeta, String> {
    let meta =
        std::fs::metadata(&path).map_err(|e| format!("Failed to read metadata for {path}: {e}"))?;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64);
    Ok(FileMeta {
        size: meta.len(),
        modified_ms,
    })
}

/// Return (and clear) the paths Eddie was asked to open at launch.
#[tauri::command]
pub fn take_pending_open(state: State<'_, PendingOpen>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap();
    std::mem::take(&mut *guard)
}

pub fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .as_deref(),
        Some("md" | "markdown" | "mdown" | "mkd")
    )
}

/// Filter CLI args down to paths that look like markdown files that exist.
pub fn markdown_args(args: impl IntoIterator<Item = String>) -> Vec<String> {
    args.into_iter()
        .skip(1) // skip the executable path
        .filter(|a| !a.starts_with('-'))
        .map(PathBuf::from)
        .filter(|p| p.is_file() && is_markdown_path(p))
        .map(|p| p.to_string_lossy().to_string())
        .collect()
}
