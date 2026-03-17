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

On success: returns `{ token }`.
On error: returns `{ error }` with the string from Rust.

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
1. Token is written into the draft credential state for the Cursor account
2. Auto-saved immediately (calls existing save flow) — user does not need to click Save separately

---

## First-Launch Silent Detection

**File:** `src/App.tsx`

On mount:
1. Load credentials — if Cursor already has a configured account, **skip** (never overwrite existing credentials)
2. Call `detect_cursor_credentials` silently (no UI feedback)
3. **If token found:** save as a new Cursor account (label `""`) and navigate to Dashboard
4. **If not found or error:** no-op — app opens normally

This runs on every app launch but only acts when Cursor credentials are absent.

---

## Files

| File | Change |
|---|---|
| `src-tauri/src/detect.rs` | New — `detect_cursor` function |
| `src-tauri/src/lib.rs` | Register `detect_cursor_credentials` command; add `mod detect` |
| `src-tauri/Cargo.toml` | Add `rusqlite` dependency |
| `src/lib/autoDetect.ts` | New — `detectCursorCredentials` wrapper |
| `src/pages/Settings.tsx` | Add "Auto-detect" button to Cursor tab |
| `src/App.tsx` | Add first-launch silent detection on mount |

### New dependency

`rusqlite = { version = "0.31", features = ["bundled"] }` — bundled feature statically links SQLite so no system SQLite version dependency.

---

## Edge Cases

- **Cursor not installed:** Error string shown inline; no crash
- **Cursor installed but never opened:** Token row absent → "try opening Cursor first" message
- **Credentials already configured:** First-launch detection skips entirely
- **Multiple Cursor accounts:** Out of scope — auto-detect always creates/updates a single account
- **Cursor DB locked (Cursor running):** `rusqlite` opens read-only; SQLite allows concurrent readers, so this should not be an issue
- **Non-macOS:** Out of scope — uso.ai is macOS only

---

## Out of Scope

- Claude and ChatGPT auto-detection (Phase 2)
- Automatic re-detection on credential expiry
- Detecting multiple Cursor accounts
