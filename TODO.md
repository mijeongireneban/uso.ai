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

- Add `tray-icon` feature to Tauri
- Add `tauri-plugin-global-shortcut` and `tauri-plugin-positioner`
- Build tray icon — left-click toggles window
- Position window below tray icon (`TrayCenter`)
- Register global shortcut `Cmd+Shift+U` to toggle window
- Hide window on blur (click outside dismisses popup)
- Window: frameless, hidden by default, no taskbar entry
- Hide app from macOS Dock (`LSUIElement`)

---

## 📋 Planned

### Feature 3 — Auto Account Detection

Automatically detect credentials from local files — no manual cookie extraction.

- **Cursor** — read `WorkosCursorSessionToken` from Cursor's local SQLite (`globalStorage/state.vscdb`)
- **Claude (Chrome)** — read `sessionKey` cookie from Chrome's Cookies SQLite + decrypt via macOS Keychain
- **Claude (Firefox)** — read `sessionKey` cookie from Firefox's unencrypted `cookies.sqlite` (fallback)
- **Claude org ID** — auto-fetch from `https://claude.ai/api/organizations` once session key is known
- **ChatGPT** — read bearer token from Chrome/Firefox cookies for `chatgpt.com`
- **Frontend** — "Auto-detect" button per service in Settings, pre-fills & saves on success
- **First launch** — silently run all detect commands; skip Settings if credentials found

---

### Feature — Claude Account Info

The Claude card currently shows no email because the correct user-info endpoint is unknown. Needs investigation.

- Find the right endpoint — candidates: `GET https://claude.ai/api/me`, `/api/account`, `/api/bootstrap` (check Network tab on claude.ai while logged in for a request that returns `email`)
- Parse the response and store `email` on the `ServiceData` returned by `fetchClaudeUsage`
- Display email under the service name in `ServiceDonutCard`, consistent with ChatGPT and Cursor

---

### Feature — Multiple Accounts Per Service

Power users often have a personal account and a company/team account for the same service (e.g. personal Claude Pro + work Claude Team). Right now credentials are one-per-service.

- **Data model** — change `credentials.json` schema from `{ claude: { orgId, sessionKey } }` to `{ claude: Account[] }` where each `Account` has a `label`, credentials, and an `active` flag
- **Settings UI** — allow adding, labeling ("Personal", "Work"), and deleting multiple accounts per service; show which is currently active
- **Account switcher** — add a small switcher in the dashboard card header or as a dropdown, so users can flip between accounts without going to Settings
- **Fetch all or active** — decide whether to show usage for only the active account, or aggregate all accounts for the same service side by side
- **Migration** — auto-migrate existing single-account credentials to the new array format on first launch after update

---

### Feature — Token Expiry Desktop Notifications

The infra for notifications already exists (`notify.ts`, `expiresWithin()`), but coverage is incomplete and the UX is passive (only fires at fetch time, not proactively).

- **Background polling** — run a lightweight timer (e.g. every 10 min) that checks token expiry independently of the usage fetch cycle, so users get warned even if they haven't opened the popup recently
- **Smarter thresholds** — warn at 24h, 2h, and 30min remaining rather than only 30min; each threshold fires only once per session (use a `Set` of already-notified tokens)
- **Claude session key** — the `sessionKey` is not a JWT so expiry can't be decoded client-side; detect expiry by catching 401 responses and notify immediately
- **Cursor session token** — same issue as Claude; detect via API response status
- **Actionable notification** — include a "Open Settings" deep-link in the notification body so users can update the token in one click

---

### Feature — Automated Token / Session Key Fetching

Manually copying cookies from DevTools is the biggest friction point. Several approaches exist, from semi-automatic to fully automatic.

**Option A — Browser Extension (most practical)**
Build a companion browser extension (Chrome/Firefox/Safari) that:

- Intercepts requests to `claude.ai`, `chatgpt.com`, `cursor.com` and extracts the relevant auth headers/cookies automatically
- Sends them to the desktop app via a local HTTP server (Tauri `tauri-plugin-localhost` or a small Axum server on a fixed port)
- Re-sends whenever it detects a token refresh, keeping credentials always fresh
- No user action needed after the one-time extension install

**Option B — macOS Keychain + Browser Cookie DB (no extension needed)**
Already planned as Feature 3 (Auto Account Detection). Reads directly from:

- Chrome's encrypted `Cookies` SQLite (decrypts via macOS Keychain `Chrome Safe Storage`)
- Firefox's plain `cookies.sqlite`
- Cursor's `globalStorage/state.vscdb`
Limitation: requires Full Disk Access permission on macOS; tokens may go stale between reads.

**Option C — Embedded Browser / WebView (most seamless, most complex)**
Open a Tauri WebView pointed at the service's login page:

- Intercept the auth cookies/headers as the user logs in, directly inside the app
- Store the credentials automatically — user never sees a token string
- Works for all services without a browser extension
- Downside: complex OAuth/cookie interception; some services use CORS protections

**Recommended path:** Start with Option B (already in progress as Feature 3), then build Option A (browser extension) as a premium experience. Option C is a long-term stretch goal.

---

### Future Ideas

- **More services** — Copilot, Windsurf, Gemini, Codex (currently tracked by OpenUsage.ai)
- **Usage history** — store snapshots locally (SQLite), show trend charts over time
- **Proactive alerts** — notify when usage is accelerating faster than normal (not just on expiry)
- **Auto-updater** — Tauri updater plugin so users get new versions automatically

---

### Marketing & Presence

- **README** — a polished GitHub README with screenshots, feature list, install instructions, and a demo GIF
- **Marketing website** — simple landing page for uso.ai with hero section, feature highlights, download button, and screenshots

