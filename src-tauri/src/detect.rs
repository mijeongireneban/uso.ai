use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;

/// macOS-only: Cursor stores its SQLite DB at ~/Library/Application Support/...
/// On other platforms this will return the "not installed" error.
pub fn detect_cursor() -> Result<String, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not read Cursor data".to_string())?;

    let db_path = PathBuf::from(home)
        .join("Library/Application Support/Cursor/User/globalStorage/state.vscdb");

    if !db_path.exists() {
        return Err("Cursor does not appear to be installed on this machine".to_string());
    }

    let conn = Connection::open_with_flags(&db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "Could not read Cursor data".to_string())?;

    let result: rusqlite::Result<String> = conn.query_row(
        "SELECT value FROM ItemTable WHERE key = 'WorkosCursorSessionToken'",
        [],
        |row| row.get(0),
    );

    match result {
        Ok(token) => Ok(token),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(
            "Cursor is installed but no session token was found — try opening Cursor first"
                .to_string(),
        ),
        Err(_) => Err("Could not read Cursor data".to_string()),
    }
}

#[tauri::command]
pub fn detect_cursor_credentials() -> Result<String, String> {
    detect_cursor()
}
