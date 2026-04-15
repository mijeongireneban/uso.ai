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
  pages/          — Dashboard, Settings, History
  components/
    dashboard/    — ServiceDonutCard, NextResetCard, SubscriptionPanel, DonutChart
    ui/           — shadcn primitives (Button, Card, Badge, etc.)
  lib/
    api/          — claude.ts, chatgpt.ts, cursor.ts, gemini.ts, utils.ts (fetch usage + email)
    credentials.ts — load/save credentials via tauri-plugin-store (multi-account per service)
    services.ts   — service metadata (name, color, logo, credential fields)
    history.ts    — daily usage snapshots for the History view
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

web/              — marketing site (uso.ai) — separate Next.js app in the same repo
  src/app/        — App Router pages, layout, sitemap, robots, OG image
  src/components/
    sections/     — Hero, Product, Features, Download, Footer, Nav
    ui/           — Logo (wordmark), Button
  src/lib/
    github.ts     — fetch latest release DMG URL at build time
    utils.ts      — cn() helper
  package.json    — pnpm, Next.js 16, React 19, Tailwind v4
```

### Monorepo layout
The app and the marketing site live in the same repo but are independent:
- The Tauri app uses `npm` and lives at the repo root.
- The marketing site uses `pnpm` and lives at `web/`.
- Don't run `pnpm` at the root or `npm install` inside `web/`.
- Deploy the marketing site from `web/` as its own Vercel project.

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
| Gemini CLI | `POST https://cloudcode-pa.googleapis.com/...` (Code Assist API) | OAuth access token refreshed via `https://oauth2.googleapis.com` | Read from `~/.gemini/oauth_creds.json` |

**Gemini is file-based, not credential-store-based.** It reads `~/.gemini/oauth_creds.json` (tokens) and `~/.gemini/settings.json` directly via `tauri-plugin-fs` (scoped to `$HOME/.gemini/**` in capabilities). No Settings UI entry. OAuth tokens are auto-refreshed and cached in-memory between fetch cycles.

## Architecture Notes
- **Menu bar app** — no Dock icon (`ActivationPolicy::Accessory` + `LSUIElement`), window hidden by default, toggled via tray click or `Cmd+Shift+U`
- **Transparent frameless window** — shaped by CSS (`rounded-xl`, `shadow-2xl`); requires `macOSPrivateApi: true` in tauri.conf.json and `"shadow": false` on the window to suppress the rectangular NSWindow shadow
- **Window positioning** — `tauri-plugin-positioner` places window below the tray icon (`TrayCenter`) on each open
- **Fade in/out** — CSS `popup-in` / `popup-out` animations triggered via Tauri `onFocusChanged` and window blur events
- **Tray icon** — monochrome 18×18 RGBA template image (`icon_as_template(true)`), auto-inverts for light/dark menu bar
- **Credentials** — stored locally via `tauri-plugin-store` (`credentials.json`), never synced to cloud
- **Multi-account** — `CredentialsStore` is shaped `{ [serviceId]: Account[] }`; each account has `{ id, label, credentials }`. When a service has >1 configured account, the label is shown on its card (e.g. "Claude · Work").
- **Account email** — fetched from each service's user-info endpoint and displayed in the service card
- **History** — one usage snapshot per account per day is persisted via `saveHistorySnapshot` and shown on the History page. Snapshots only save when `status === "ok"`.
- **Token-expiry notifications** — ChatGPT Bearer tokens are JWTs; `Dashboard` runs a 1-min background interval that fires a desktop notification at 30-min and 3-min thresholds (deduped per token).
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

## Branching — git flow

This project follows **git flow**. Always keep this in mind:

- `master` is the production branch. Never commit or branch directly off it for new work.
- `develop` is the integration branch. **All feature branches are cut off `develop`, and all feature PRs target `develop`.**
- Feature branches: `feature/<name>` off `develop` → PR back into `develop`.
- Release branches: `release/<version>` off `develop` → merged into both `master` and `develop`.
- Hotfix branches: `hotfix/<name>` off `master` → merged into both `master` and `develop`.

When any skill (office-hours, plan-eng-review, ship, etc.) refers to "the base branch" or "cut from master", interpret it as `develop` for feature work. Only release and hotfix flows touch `master` directly.

## Linear ticket workflow

When working on a Linear ticket for this repo, always follow this routine:

1. **Review** — read the ticket details and understand the scope.
2. **Move to In Progress** — update the ticket status if it's not already there.
3. **Create branch** — cut a `feature/<name>` or `bugfix/<name>` branch off `develop`.
4. **Implement & create PR** — do the work, commit, and open a PR targeting `develop`.
5. **Update ticket** — once the PR is created, update the Linear ticket status (e.g., In Review) and link the PR.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the app, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
