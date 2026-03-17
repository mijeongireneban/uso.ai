# uso.ai — Feature Backlog

## ✅ Done

- Multi-service usage dashboard (Claude, ChatGPT, Cursor)
- Per-service credential management with validation
- Auto-refresh every 5 min + manual refresh
- Dark / Light / System theme toggle
- Donut chart + progress bar usage visualizations
- Menu bar app — tray icon, global shortcut `⌘⇧U`, window positioning, no Dock icon
- Multiple accounts per service — label, add, delete, per-account save
- Token expiry notifications — background polling every 1 min, 3-min and 30-min thresholds, fires once per token per threshold
- Quit from tray right-click menu
- Custom app icon — dark rounded square with "u" lettermark
- Polished README with demo GIF

---

## 📋 Planned

### Feature — Claude Account Info

The Claude card currently shows no email because the correct user-info endpoint is unknown. Needs investigation.

- Find the right endpoint — candidates: `GET https://claude.ai/api/me`, `/api/account`, `/api/bootstrap` (check Network tab on claude.ai while logged in for a request that returns `email`)
- Parse the response and store `email` on the `ServiceData` returned by `fetchClaudeUsage`
- Display email under the service name in `ServiceDonutCard`, consistent with ChatGPT and Cursor

---

### Feature — Auto Account Detection

Automatically detect credentials from local files — no manual cookie extraction.

- **Cursor** — read `WorkosCursorSessionToken` from Cursor's local SQLite (`globalStorage/state.vscdb`)
- **Claude (Chrome)** — read `sessionKey` cookie from Chrome's Cookies SQLite + decrypt via macOS Keychain
- **Claude (Firefox)** — read `sessionKey` cookie from Firefox's unencrypted `cookies.sqlite` (fallback)
- **Claude org ID** — auto-fetch from `https://claude.ai/api/organizations` once session key is known
- **ChatGPT** — read bearer token from Chrome/Firefox cookies for `chatgpt.com`
- **Frontend** — "Auto-detect" button per service in Settings, pre-fills & saves on success
- **First launch** — silently run all detect commands; skip Settings if credentials found

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
Already planned as Auto Account Detection above. Reads directly from:

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

**Recommended path:** Start with Option B (Auto Account Detection), then build Option A (browser extension) as a premium experience. Option C is a long-term stretch goal.

---

### Future Ideas

- **More services** — Copilot, Windsurf, Gemini
- **Usage history** — store snapshots locally (SQLite), show trend charts over time
- **Proactive alerts** — notify when usage is accelerating faster than normal
- **Auto-updater** — Tauri updater plugin so users get new versions automatically
- **Marketing website** — landing page with hero, feature highlights, download button, screenshots
