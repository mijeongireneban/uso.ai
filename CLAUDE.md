# Uso.ai

macOS desktop app that provides a usage dashboard for AI subscription services (Claude, ChatGPT, Cursor).

## Stack
- **Tauri v2** — desktop app shell (Rust backend)
- **React + TypeScript** — frontend UI
- **Vite** — dev server / bundler
- **Tailwind CSS** — styling (to be added)
- **SQLite** — local storage via Tauri plugin (to be added)

## Project Structure
- `src/` — React frontend (components, pages, hooks)
- `src-tauri/` — Rust backend (Tauri config, native commands)
- `src-tauri/src/main.rs` — Tauri app entry point
- `src-tauri/tauri.conf.json` — Tauri configuration

## Commands
```bash
npm run tauri dev       # Start dev server + Tauri window
npm run build           # Build frontend
npm run tauri build     # Build production app
```

## Services & Endpoints
| Service | Endpoint | Auth |
|---------|----------|------|
| Claude | `GET https://claude.ai/api/organizations/{org_id}/usage` | Cookie: `sessionKey` |
| ChatGPT | `GET https://chatgpt.com/backend-api/wham/usage` | Header: `Authorization: Bearer {token}` |
| Cursor | `GET https://cursor.com/api/usage-summary` | Cookie: `WorkosCursorSessionToken` |

## Architecture Notes
- All credentials stored locally only (no cloud sync)
- Auth via session cookies / Bearer tokens extracted from browser
- Usage data fetched on app open + manual refresh
- No official APIs — uses internal web endpoints (may break on service updates)

## Key Features (v1)
- Usage summary per service with plan limits
- Subscription overview (free/pro plan status)
- Auto-fetch via session tokens
- Settings page to configure credentials per service
