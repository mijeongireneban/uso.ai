# Auto Account Detection (Cursor) — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Automatically detect Cursor credentials from the local machine so users don't have to manually copy cookies from DevTools. Phase 1 covers Cursor only; Claude and ChatGPT detection will follow in a separate spec.

---

## Architecture

Two new layers, no changes to the credential schema or existing store:

- **Rust** — `src-tauri/src/detect.rs` module with a `detect_cursor` function that reads Cursor's local SQLite database and returns the session token. Registered as a Tauri command `detect_cursor_credentials`. `rusqlite` added to `Cargo.toml`.

- **Frontend** — `src/lib/autoDetect.ts` utility that calls the Tauri command and saves the credential via the existing `saveCredentials`. Used in two places: `Settings.tsx` (manual button) and `App.tsx` (first-launch silent check).

---

## Rust Detection Logic

**File:** `src-tauri/src/detect.rs`

**SQLite path:** `$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

**Query:** `SELECT value FROM ItemTable WHERE key = 'WorkosCursorSessionToken'`

**Connection:** MUST be opened read-only: `Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)`. This ensures concurrent reads succeed even when Cursor holds a write lock.

**Return type:** `Result<String, String>` — token string on success, human-readable error on failure.

**Error cases:**

| Condition | Error string returned |
|---|---|
| DB file not found | `"Cursor does not appear to be installed on this machine"` |
| Row not found | `"Cursor is installed but no session token was found — try opening Cursor first"` |
| Any other SQLite error | `"Could not read Cursor data"` |

**Tauri command:**

```rust
#[tauri::command]
fn detect_cursor_credentials() -> Result<String, String>
```

Registered in `lib.rs` via `.invoke_handler(tauri::generate_handler![..., detect_cursor_credentials])`.

---

## Frontend — `src/lib/autoDetect.ts`

Thin wrapper around the Tauri command:

```ts
export async function detectCursorCredentials(): Promise<{ token: string } | { error: string }>
```

On success: returns `{ token }` — the caller must store the value under `credentials.sessionToken` (the key defined for the Cursor service in `SERVICES`).
On error: returns `{ error }` with the human-readable string from Rust.

Saving is handled by the caller (Settings or App), not inside this utility.

---

## Settings — Auto-detect Button

**File:** `src/pages/Settings.tsx`

An "Auto-detect" button is added to the Cursor service tab, below the credential fields.

**Button states:**

| State | UI |
|---|---|
| Idle | "Auto-detect" button, enabled |
| Detecting | Spinner, button disabled |
| Found | Brief "Found — saved!" in green text, then resets to idle |
| Not found | Error string shown as inline muted text below the button |

On success:
1. The new account `{ id: uuid(), label: "Auto-detected", credentials: { sessionToken: token } }` is merged into both `draft["cursor"]` and `persisted["cursor"]` state arrays — `draft` drives input field display, `persisted` drives tab checkmarks and delete-button visibility
2. Saved directly via `saveCredentials` with the full merged store — **no API validation call** (token validity is confirmed at the next dashboard refresh); `handleSave` is not invoked
3. Button transitions to "Found — saved!" — user does not need to click Save separately

---

## First-Launch Silent Detection

**File:** `src/App.tsx`

On mount:
1. Call `loadCredentials()` to get the full `CredentialsStore`.
2. Check if Cursor is already configured: does `creds["cursor"]` contain at least one account where all required fields are non-empty (i.e. `sessionToken` is filled)? This mirrors the `isAccountConfigured` logic in `Settings.tsx`. If yes, **skip entirely**.
3. Call `detect_cursor_credentials` silently (no UI feedback).
4. **If token found:** construct a new Cursor account `{ id: uuid(), label: "Auto-detected", credentials: { sessionToken: token } }`, merge it into the full `CredentialsStore` (preserving all other services), call `saveCredentials` with the merged result, then increment `dashboardKey` (see below).
5. **If not found or error:** no-op — app opens normally.

This runs on every app launch but only acts when Cursor credentials are absent. The full-store merge in step 4 ensures Claude and ChatGPT credentials are never overwritten.

**Re-fetch after silent detection:** Because Dashboard is the default page and is already mounted when App mounts, calling `setPage("dashboard")` would be a no-op. Instead, App.tsx adds a `dashboardKey` state (number, starts at 0). `<Dashboard key={dashboardKey} ... />` — incrementing `dashboardKey` forces Dashboard to remount, which triggers its `useEffect` → `fetchAll` → `loadCredentials`, picking up the newly saved credential immediately.

---

## Files

| File | Change |
|---|---|
| `src-tauri/src/detect.rs` | New — `detect_cursor` function |
| `src-tauri/src/lib.rs` | Register `detect_cursor_credentials` command; add `mod detect` |
| `src-tauri/Cargo.toml` | Add `rusqlite` dependency |
| `src/lib/autoDetect.ts` | New — `detectCursorCredentials` wrapper |
| `src/pages/Settings.tsx` | Add "Auto-detect" button to Cursor tab |
| `src/App.tsx` | Add first-launch silent detection on mount; add `dashboardKey` state to force Dashboard remount after detection |

### New dependency

`rusqlite = { version = "0.31", features = ["bundled"] }` — bundled feature statically links SQLite so no system SQLite version dependency.

---

## Edge Cases

- **Cursor not installed:** Error string shown inline; no crash
- **Cursor installed but never opened:** Token row absent → "try opening Cursor first" message
- **Credentials already configured:** First-launch detection skips entirely
- **Multiple Cursor accounts:** Out of scope — auto-detect always creates a single new account; re-running after credentials are already configured is a no-op (first-launch skips, Settings button creates a second account which the user can delete)
- **Cursor DB locked (Cursor running):** `rusqlite` opens read-only; SQLite allows concurrent readers, so this should not be an issue
- **Non-macOS:** Out of scope — uso.ai is macOS only

---

## Out of Scope

- Claude and ChatGPT auto-detection (Phase 2)
- Automatic re-detection on credential expiry
- Detecting multiple Cursor accounts
