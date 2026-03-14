# uso.ai — Feature Backlog

## ✅ Done

- Multi-service usage dashboard (Claude, ChatGPT, Cursor)
- Per-service credential management with validation
- Auto-refresh every 5 min + manual refresh
- Token expiration warnings (desktop notifications)
- Dark / Light / System theme toggle
- Donut chart + progress bar usage visualizations

---

## 🚧 In Progress

### Feature 1 — Menu Bar App
Convert uso.ai from a standard window into a persistent macOS menu bar popup.

- [x] Add `tray-icon` feature to Tauri
- [x] Add `tauri-plugin-global-shortcut` and `tauri-plugin-positioner`
- [x] Build tray icon — left-click toggles window
- [x] Position window below tray icon (`TrayCenter`)
- [x] Register global shortcut `Cmd+Shift+U` to toggle window
- [x] Hide window on blur (click outside dismisses popup)
- [x] Window: frameless, hidden by default, no taskbar entry
- [x] Hide app from macOS Dock (`LSUIElement`)

---

## 📋 Planned

### Feature 3 — Auto Account Detection
Automatically detect credentials from local files — no manual cookie extraction.

- [ ] **Cursor** — read `WorkosCursorSessionToken` from Cursor's local SQLite (`globalStorage/state.vscdb`)
- [ ] **Claude (Chrome)** — read `sessionKey` cookie from Chrome's Cookies SQLite + decrypt via macOS Keychain
- [ ] **Claude (Firefox)** — read `sessionKey` cookie from Firefox's unencrypted `cookies.sqlite` (fallback)
- [ ] **Claude org ID** — auto-fetch from `https://claude.ai/api/organizations` once session key is known
- [ ] **ChatGPT** — read bearer token from Chrome/Firefox cookies for `chatgpt.com`
- [ ] **Frontend** — "Auto-detect" button per service in Settings, pre-fills & saves on success
- [ ] **First launch** — silently run all detect commands; skip Settings if credentials found

---

### Future Ideas

- **More services** — Copilot, Windsurf, Gemini, Codex (currently tracked by OpenUsage.ai)
- **Usage history** — store snapshots locally (SQLite), show trend charts over time
- **Proactive alerts** — notify when usage is accelerating faster than normal (not just on expiry)
- **Auto-updater** — Tauri updater plugin so users get new versions automatically
- **Multiple accounts** — support switching between different org/account contexts per service
