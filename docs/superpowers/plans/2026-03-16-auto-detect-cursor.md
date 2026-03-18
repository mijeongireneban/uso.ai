# Auto Account Detection (Cursor) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically detect the Cursor session token from the local machine so users don't have to copy it from DevTools.

**Architecture:** A new Rust module (`detect.rs`) reads Cursor's SQLite DB read-only and returns the token via a Tauri command. A thin TypeScript wrapper (`autoDetect.ts`) calls that command. Two callers: Settings.tsx shows an "Auto-detect" button on the Cursor tab; App.tsx silently runs detection on first launch when no Cursor credentials exist and forces a Dashboard re-fetch via a `dashboardKey` counter.

**Tech Stack:** Rust + `rusqlite` (bundled, read-only SQLite), Tauri v2 commands, React + TypeScript, existing `saveCredentials` / `loadCredentials` from `src/lib/credentials.ts`.

---

## File Map

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `rusqlite` dependency |
| `src-tauri/src/detect.rs` | New — `detect_cursor()` + `detect_cursor_credentials` command |
| `src-tauri/src/lib.rs` | Add `mod detect;`, register `detect::detect_cursor_credentials` |
| `src/lib/autoDetect.ts` | New — `detectCursorCredentials()` TS wrapper |
| `src/pages/Settings.tsx` | Add "Auto-detect" button to Cursor tab only |
| `src/App.tsx` | Add `dashboardKey` state + first-launch silent detection |

---

## Task 1: Add `rusqlite` to Cargo.toml

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add the dependency**

Open `src-tauri/Cargo.toml`. In the `[dependencies]` section, add this line after the existing dependencies:

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
```

`bundled` statically links SQLite — no system SQLite version dependency.

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors. This will download and compile `rusqlite` (~1-2 minutes first run).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add rusqlite dependency for Cursor auto-detection"
```

---

## Task 2: Create `detect.rs` — Rust detection logic

**Files:**
- Create: `src-tauri/src/detect.rs`

The file reads Cursor's SQLite DB at `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`, queries `ItemTable` for the `WorkosCursorSessionToken` row, and returns the token or a human-readable error.

- [ ] **Step 1: Create the file**

Create `src-tauri/src/detect.rs` with this exact content:

```rust
use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;

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
```

Key points:
- `OpenFlags::SQLITE_OPEN_READ_ONLY` — never opens for writing, safe if Cursor is running
- `db_path.exists()` check gives a clear error before SQLite even tries to open the file
- `QueryReturnedNoRows` is matched explicitly so the "try opening Cursor first" message fires correctly

- [ ] **Step 2: Verify the file parses**

```bash
cd src-tauri && cargo check
```

Expected: passes cleanly. `detect.rs` exists but is not yet declared as a module in `lib.rs`, so Rust ignores it — no error. The full wiring happens in Task 3.

---

## Task 3: Register the command in `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `mod detect;` at the top of lib.rs**

Open `src-tauri/src/lib.rs`. After the `use tauri_plugin_positioner` line (the last `use` statement, before `fn toggle_window`), add:

```rust
mod detect;
```

So the top of the file becomes:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_positioner::{on_tray_event, Position, WindowExt};

mod detect;
```

- [ ] **Step 2: Register the command in the invoke handler**

Find this line near the bottom of `lib.rs` (search for `.invoke_handler`):

```rust
.invoke_handler(tauri::generate_handler![hide_window])
```

Replace it with:

```rust
.invoke_handler(tauri::generate_handler![hide_window, detect::detect_cursor_credentials])
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors. Both `detect.rs` and its command are now registered.

- [ ] **Step 4: Commit Rust work**

```bash
git add src-tauri/src/detect.rs src-tauri/src/lib.rs
git commit -m "feat: add detect_cursor_credentials Tauri command"
```

---

## Task 4: Create `src/lib/autoDetect.ts` — TypeScript wrapper

**Files:**
- Create: `src/lib/autoDetect.ts`

This is a thin wrapper that calls the Tauri command and normalises the result into a discriminated union. Callers use the result to save credentials — saving is NOT done inside this utility.

- [ ] **Step 1: Create the file**

Create `src/lib/autoDetect.ts` with this exact content:

```ts
import { invoke } from "@tauri-apps/api/core";

/**
 * Calls the Rust `detect_cursor_credentials` command.
 * Returns { token } on success or { error } with a human-readable message on failure.
 * The caller is responsible for saving the token under credentials.sessionToken.
 */
export async function detectCursorCredentials(): Promise<
  { token: string } | { error: string }
> {
  try {
    const token = await invoke<string>("detect_cursor_credentials");
    return { token };
  } catch (e) {
    return { error: String(e) };
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npm run build
```

Expected: no TypeScript errors. (Build output is not used — just confirming types.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/autoDetect.ts
git commit -m "feat: add detectCursorCredentials TypeScript wrapper"
```

---

## Task 5: Add Auto-detect button to Settings.tsx (Cursor tab only)

**Files:**
- Modify: `src/pages/Settings.tsx`

The button appears only in the Cursor tab, below the "+ Add account" button. It has four states: idle, detecting (spinner), found (green confirmation), error (inline message). On success it writes the new account into both `draft` and `persisted` state and calls `saveCredentials` directly — no API validation.

- [ ] **Step 1: Add imports**

At the top of `src/pages/Settings.tsx`, add two imports:

1. Add `Loader2` to the lucide-react import line (line 2):

```ts
import { Eye, EyeOff, CheckCircle2, Circle, Trash2, Loader2 } from "lucide-react";
```

2. After the existing imports (after line 14), add:

```ts
import { detectCursorCredentials } from "@/lib/autoDetect";
```

Note: `Account` and `CredentialsStore` are already imported at line 14 — no additional import is needed for them.

- [ ] **Step 2: Add auto-detect state inside the Settings component**

Inside the `Settings` function body, after the existing state declarations (after line 72 — the `statuses` useState):

```ts
const [autoDetectStatus, setAutoDetectStatus] = useState<"idle" | "detecting" | "found" | "error">("idle");
const [autoDetectError, setAutoDetectError] = useState<string | null>(null);
```

- [ ] **Step 3: Add the handleAutoDetect function**

Inside the `Settings` function body, after the `handleSave` function (after line 166), add:

```ts
async function handleAutoDetect() {
  setAutoDetectStatus("detecting");
  setAutoDetectError(null);
  const result = await detectCursorCredentials();
  if ("error" in result) {
    setAutoDetectStatus("error");
    setAutoDetectError(result.error);
    return;
  }
  const newAccount: Account = {
    id: crypto.randomUUID(),
    label: "Auto-detected",
    credentials: { sessionToken: result.token },
  };
  // No deduplication: user can delete extra accounts. See spec "Multiple Cursor accounts" edge case.
  const newAccounts = [...(draft["cursor"] ?? []), newAccount];
  setDraft((prev) => ({ ...prev, cursor: newAccounts }));
  const newPersisted = { ...persisted, cursor: newAccounts };
  setPersisted(newPersisted);
  await saveCredentials(newPersisted);
  setAutoDetectStatus("found");
  setTimeout(() => setAutoDetectStatus("idle"), 2000);
}
```

- [ ] **Step 4: Add the Auto-detect button in the Cursor TabsContent**

Find the `{SERVICES.map((service) => { ... })}` block. Inside the `TabsContent` for each service, find the "+ Add account" `<Button>` (around line 267). After that button, add a conditional block for Cursor only:

The `TabsContent` currently ends like this:

```tsx
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addAccount(service.id)}
              >
                + Add account
              </Button>
            </TabsContent>
```

Replace it with:

```tsx
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addAccount(service.id)}
              >
                + Add account
              </Button>

              {service.id === "cursor" && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={autoDetectStatus === "detecting"}
                    onClick={handleAutoDetect}
                  >
                    {autoDetectStatus === "detecting" ? (
                      <><Loader2 size={13} className="animate-spin mr-1.5" />Detecting...</>
                    ) : autoDetectStatus === "found" ? (
                      "✓ Found — saved!"
                    ) : (
                      "Auto-detect from Cursor"
                    )}
                  </Button>
                  {autoDetectStatus === "error" && autoDetectError && (
                    <p className="text-xs text-muted-foreground">{autoDetectError}</p>
                  )}
                </div>
              )}
            </TabsContent>
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add Auto-detect button to Cursor settings tab"
```

---

## Task 6: Add first-launch silent detection to App.tsx

**Files:**
- Modify: `src/App.tsx`

On mount, App.tsx silently checks if Cursor credentials exist. If not, it runs detection, saves any found token, and increments `dashboardKey` to force Dashboard to remount and re-fetch. The `key` prop on `<Dashboard>` is the mechanism — incrementing it unmounts/remounts the component, triggering its `useEffect` → `fetchAll` → `loadCredentials`.

- [ ] **Step 1: Add imports to App.tsx**

In `src/App.tsx`, add these two imports after the existing imports (after line 9):

```ts
import { loadCredentials, saveCredentials } from "@/lib/credentials";
import { detectCursorCredentials } from "@/lib/autoDetect";
```

- [ ] **Step 2: Add `dashboardKey` state**

Inside the `App` function body, after the existing state declarations (after line 23 — `hideTimerRef`), add:

```ts
const [dashboardKey, setDashboardKey] = useState(0);
```

(`useState` is already imported on line 1.)

- [ ] **Step 3: Add the silent detection `useEffect`**

After the second `useEffect` block (the focus/blur one, ending around line 60), add a new `useEffect`:

```ts
// First-launch: silently detect Cursor credentials if none are configured
useEffect(() => {
  async function silentDetect() {
    const creds = await loadCredentials();
    const cursorAccounts = creds["cursor"] ?? [];
    const isConfigured = cursorAccounts.some(
      (a) => !!a.credentials["sessionToken"]?.trim()
    );
    if (isConfigured) return;

    const result = await detectCursorCredentials();
    if ("error" in result) return;

    const newAccount = {
      id: crypto.randomUUID(),
      label: "Auto-detected",
      credentials: { sessionToken: result.token },
    };
    const newCreds = { ...creds, cursor: [...cursorAccounts, newAccount] };
    await saveCredentials(newCreds);
    setDashboardKey((k) => k + 1);
  }
  silentDetect().catch(() => {});
}, []); // runs once on mount
```

- [ ] **Step 4: Pass `key={dashboardKey}` to `<Dashboard>`**

Find the JSX in the return statement (around line 121):

```tsx
        {page === "dashboard" ? (
          <Dashboard onNavigateToSettings={() => setPage("settings")} />
        ) : (
```

Replace it with:

```tsx
        {page === "dashboard" ? (
          <Dashboard key={dashboardKey} onNavigateToSettings={() => setPage("settings")} />
        ) : (
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add first-launch silent Cursor credential detection"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start the dev app**

```bash
npm run tauri dev
```

- [ ] **Step 2: Test the Settings Auto-detect button (Cursor installed)**

1. Open the app → Settings → Cursor tab
2. Click "Auto-detect from Cursor"
3. Expected:
   - Button shows spinner + "Detecting..." briefly
   - Button transitions to "✓ Found — saved!"
   - After 2 seconds, button resets to "Auto-detect from Cursor"
   - A new "Auto-detected" account card appears in the Cursor tab with the session token filled in
   - The Cursor tab checkmark (✓) appears in the tab bar

- [ ] **Step 3: Test the Settings Auto-detect button (Cursor not installed)**

If you don't have Cursor installed, or want to test the error path: temporarily rename the DB file (or test on a machine without Cursor). Expected: inline message "Cursor does not appear to be installed on this machine" appears below the button.

- [ ] **Step 4: Test first-launch detection**

1. Clear all Cursor credentials in Settings (delete any Cursor account)
2. Quit and reopen the app
3. Expected: the app opens on Dashboard, and after a moment the Cursor service card appears (Dashboard refreshes automatically due to `dashboardKey` increment)

- [ ] **Step 5: Test that first-launch skips if credentials already exist**

1. With Cursor credentials already saved, quit and reopen the app
2. Expected: no second "Auto-detected" account is created

- [ ] **Step 6: Final commit if any manual tweaks were needed**

```bash
git add -p
git commit -m "fix: adjust auto-detect UX based on manual testing"
```
