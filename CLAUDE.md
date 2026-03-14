# Uso.ai

macOS menu bar app that provides a usage dashboard for AI subscription services (Claude, ChatGPT (Codex), Cursor).

## Stack
- **Tauri v2** — desktop app shell (Rust backend)
- **React + TypeScript** — frontend UI
- **Vite** — dev server / bundler
- **Tailwind CSS + shadcn/ui** — styling and components
- **Poppins** — font (`@fontsource/poppins`)
- **Candyland** — color theme (via tweakcn)

## Project Structure
```
src/
  pages/          — Dashboard, Settings
  components/
    dashboard/    — ServiceDonutCard, NextResetCard
    ui/           — shadcn primitives (Button, Card, Badge, etc.)
  lib/
    api/          — claude.ts, chatgpt.ts, cursor.ts (fetch usage + email)
    credentials.ts — load/save credentials via tauri-plugin-store
    services.ts   — service metadata (name, color, logo, credential fields)
    useTheme.ts   — light/dark/system theme toggle
    notify.ts     — desktop notifications + JWT expiry helpers
  types.ts        — ServiceData, UsageWindow, ServiceStatus

src-tauri/
  src/lib.rs      — tray icon, global shortcut, hide_window command, dock suppression
  tauri.conf.json — window config (transparent, frameless, hidden by default)
  capabilities/   — HTTP permissions per allowed URL
  icons/
    tray-icon.rgba — raw RGBA bytes for the monochrome menu bar icon
    tray-icon.png  — PNG version of menu bar icon
    LSUIElement.plist — hides app from Dock in production bundle
```

## Commands
```bash
npm run tauri dev       # Start dev server + Tauri app
npm run build           # Build frontend only
npm run tauri build     # Build production .app bundle
```

## Services & Endpoints
| Service | Usage Endpoint | Auth | Account Info Endpoint |
|---------|---------------|------|----------------------|
| Claude | `GET https://claude.ai/api/organizations/{org_id}/usage` | Cookie: `sessionKey` | `GET https://claude.ai/api/me` (TBC) |
| ChatGPT (Codex) | `GET https://chatgpt.com/backend-api/wham/usage` | Header: `Authorization: Bearer {token}` | `GET https://chatgpt.com/backend-api/me` |
| Cursor | `GET https://cursor.com/api/usage-summary` | Cookie: `WorkosCursorSessionToken` | `GET https://cursor.com/api/auth/me` |

## Architecture Notes
- **Menu bar app** — no Dock icon (`ActivationPolicy::Accessory` + `LSUIElement`), window hidden by default, toggled via tray click or `Cmd+Shift+U`
- **Transparent frameless window** — shaped by CSS (`rounded-2xl`, `shadow-2xl`); requires `macOSPrivateApi: true` in tauri.conf.json
- **Window positioning** — `tauri-plugin-positioner` places window below the tray icon (`TrayCenter`) on each open
- **Fade in/out** — CSS `popup-in` / `popup-out` animations triggered via Tauri `onFocusChanged` and window blur events
- **Tray icon** — monochrome 18×18 RGBA template image (`icon_as_template(true)`), auto-inverts for light/dark menu bar
- **Credentials** — stored locally via `tauri-plugin-store` (`credentials.json`), never synced to cloud
- **Account email** — fetched from each service's user-info endpoint and displayed in the service card
- **No official APIs** — all endpoints are internal web APIs; may break on service updates

## Key Features (current)
- Menu bar tray popup — click icon or `Cmd+Shift+U` to open/close
- Usage dashboard: per-service progress bars with % used and reset times
- Account email shown per service card
- Plan badge (Pro / Plus / Free) pinned to top-right of each card
- Next-reset summary cards at the top
- Token expiration detection + desktop notifications
- Settings page: per-service credential input with validation
- Light / Dark / System theme (Candyland palette)
- Auto-refresh every 5 min + manual refresh

## Tauri Plugins Used
| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-store` | Local credential storage |
| `tauri-plugin-http` | Fetch usage/account data (bypasses CORS) |
| `tauri-plugin-notification` | Desktop notifications for token expiry |
| `tauri-plugin-global-shortcut` | `Cmd+Shift+U` toggle shortcut |
| `tauri-plugin-positioner` | Position window below tray icon |
| `tauri-plugin-opener` | Open external links |
