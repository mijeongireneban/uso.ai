# Cursor Auto-Detection via Chrome Cookie — Design Spec

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Replace the broken Cursor SQLite detection approach (which returned an unusable JWT) with Chrome cookie decryption. Chrome stores the `WorkosCursorSessionToken` cookie for `cursor.com` in an encrypted SQLite database. This spec describes reading, decrypting, and returning that token so it can be used with the existing Cursor API call.

---

## Background

The previous approach read `cursorAuth/accessToken` from Cursor's VS Code SQLite — a JWT that returns 401 from the Cursor usage API. The correct token is `WorkosCursorSessionToken`, which Chrome stores as an AES-128-CBC encrypted value in `~/Library/Application Support/Google/Chrome/<profile>/Cookies`.

---

## Architecture

`src-tauri/src/detect.rs` is rewritten entirely. The `detect_cursor_credentials` Tauri command signature is unchanged (`Result<String, String>`) — no frontend changes needed.

New Rust dependencies added to `Cargo.toml`:

```toml
security-framework = "2"
aes = "0.8"
cbc = { version = "0.1", features = ["alloc"] }
pbkdf2 = { version = "0.12", default-features = false }
hmac = "0.12"
sha1 = "0.10"
```

---

## Detection Logic

### Step 1 — Find Chrome profile with the cookie

Scan profiles in order: `Default`, `Profile 1`, `Profile 2`, … `Profile 10`.

Path pattern: `$HOME/Library/Application Support/Google/Chrome/<profile>/Cookies`

For each existing Cookies file, query:

```sql
SELECT encrypted_value
FROM cookies
WHERE host_key = 'cursor.com'
  AND name = 'WorkosCursorSessionToken'
LIMIT 1
```

Return the first `encrypted_value` found. If no profile has the cookie, return the "sign in" error.

### Step 2 — Read Chrome encryption password from Keychain

Use `security-framework` to query the macOS Keychain:

- Service: `"Chrome Safe Storage"`
- Account: `"Chrome"`

Returns a raw byte string (the password).

### Step 3 — Derive AES key via PBKDF2

```
key = PBKDF2-HMAC-SHA1(
  password = keychain_password_bytes,
  salt     = b"saltysalt",
  iters    = 1003,
  dklen    = 16
)
```

### Step 4 — Decrypt with AES-128-CBC

Chrome's `encrypted_value` format:
- Bytes 0–2: `v10` prefix (strip these)
- Remaining bytes: ciphertext
- IV: 16 bytes of `0x20` (space character)

Decrypt with AES-128-CBC using the derived key and IV. Strip PKCS#7 padding. The result is the plaintext `WorkosCursorSessionToken` string.

---

## Error Cases

| Condition | Error string returned |
|---|---|
| No Chrome profiles found | `"Chrome does not appear to be installed"` |
| Cookie not found in any profile | `"Sign in to cursor.com in Chrome first, then try again"` |
| Keychain access denied or entry missing | `"Could not access Chrome's keychain — grant uso.ai Full Disk Access in System Settings if prompted"` |
| Decryption failure (bad padding, wrong key, etc.) | `"Could not decrypt Cursor cookie"` |

Note: Chrome uses WAL mode, so read-only SQLite opens succeed concurrently even when Chrome is open.

---

## Files

| File | Change |
|---|---|
| `src-tauri/src/detect.rs` | Rewrite — replace Cursor SQLite logic with Chrome cookie decryption |
| `src-tauri/Cargo.toml` | Add `security-framework`, `aes`, `cbc`, `pbkdf2`, `hmac`, `sha1` |

No frontend changes — `detect_cursor_credentials` command signature is unchanged.

---

## Edge Cases

- **Chrome not installed:** No profile directories found → "Chrome does not appear to be installed"
- **Multiple Chrome profiles:** Checked in order (`Default` first, then `Profile 1` … `Profile 10`); first match wins
- **Chrome open:** WAL mode allows concurrent reads; should not cause a lock error
- **Cookie expired or absent:** Returns "sign in" error — user must log into cursor.com in Chrome
- **Keychain prompt:** macOS may show a permission dialog the first time; subsequent calls are cached by the OS
- **`v10` prefix absent:** Treat as decryption failure — return generic error
- **Non-macOS:** Out of scope — uso.ai is macOS only

---

## Out of Scope

- Firefox cookie support
- Safari cookie support
- Automatic re-detection on token expiry
- Claude / ChatGPT Chrome cookie detection (separate spec)
