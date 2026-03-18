# Gemini CLI Support — Design Spec

**Date:** 2026-03-17
**Branch:** feature/branding (to be implemented on a new feature branch)

---

## Goal

Add Gemini CLI as a fourth supported service in uso.ai. Displays per-model quota usage (Pro + Flash) for users who have the [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed and authenticated.

---

## Background

The consumer Gemini chat product (gemini.google.com) and Google AI Studio expose no machine-readable usage endpoints. However, the Gemini CLI stores OAuth credentials locally at `~/.gemini/oauth_creds.json` after `gemini auth login`, and Google's internal Cloud Code API (`cloudcode-pa.googleapis.com`) exposes per-model quota data via those credentials. This is the same approach used by [openusage.ai](https://www.openusage.ai).

---

## Architecture

### Files to create

| File | Purpose |
|---|---|
| `src/lib/api/gemini.ts` | Reads credentials file, refreshes tokens, fetches quota, returns `ServiceData` |

### Files to modify

| File | Change |
|---|---|
| `src/lib/services.ts` | Add `gemini` service entry with `name: "Gemini CLI"`, `fields: []` |
| `src/pages/Settings.tsx` | Add Gemini CLI section with Detect button and inline status |
| `src/pages/Dashboard.tsx` | Add special-case branch for `gemini` (file-detected, not store-based) |
| `src-tauri/tauri.conf.json` | Add `cloudcode-pa.googleapis.com` and `oauth2.googleapis.com` to HTTP allowlist |
| `src-tauri/capabilities/*.json` | Add HTTP allow rules for new domains + `fs:allow-read-home-dir` scoped to `~/.gemini/` |
| `package.json` / `src-tauri/Cargo.toml` | Add `@tauri-apps/plugin-fs` (npm + Cargo) |
| `src-tauri/src/lib.rs` | Register `tauri_plugin_fs::init()` |

---

## Credential Flow

No manual credential entry. uso.ai reads directly from the Gemini CLI's own credentials file:

```
~/.gemini/oauth_creds.json
```

Structure:
```json
{
  "access_token": "ya29.xxx",
  "refresh_token": "1//xxx",
  "id_token": "eyJ...",
  "expiry_date": 1710000000000,
  "token_type": "Bearer"
}
```

Optionally check `~/.gemini/settings.json` for `authType` — skip if `"api-key"` or `"vertex-ai"` (those auth types don't have the required quota scope).

---

## API Calls

### 1. Load Code Assist (get tier + project ID)

```
POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "metadata": {
    "ideType": "IDE_UNSPECIFIED",
    "platform": "PLATFORM_UNSPECIFIED",
    "pluginType": "GEMINI",
    "duetProject": "default"
  }
}
```

Response fields used:
- `tier` — `"free-tier"` | `"standard-tier"` | `"legacy-tier"`
- `cloudaicompanionProject` — GCP project ID (e.g. `gen-lang-client-123`)

### 2. Retrieve User Quota

```
POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota
Authorization: Bearer <access_token>
Content-Type: application/json

{ "project": "<cloudaicompanionProject>" }
```

Response:
```json
{
  "quotaBuckets": [
    { "modelId": "gemini-2.5-pro",   "remainingFraction": 0.8, "resetTime": "2026-03-18T00:00:00Z" },
    { "modelId": "gemini-2.0-flash", "remainingFraction": 0.4, "resetTime": "2026-03-18T00:00:00Z" }
  ]
}
```

### Token refresh (when `expiry_date` is in the past)

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&client_id=<id>&client_secret=<secret>&refresh_token=<token>
```

The OAuth `client_id` and `client_secret` are extracted from the Gemini CLI's installed JavaScript source. The CLI is open-source and embeds them in `@google/gemini-cli-core/dist/src/code_assist/oauth2.js`. Search the following paths in order, stopping at the first match:

1. `~/.npm-global/lib/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js`
2. `/usr/local/lib/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js`
3. `~/.bun/install/global/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js`
4. Output of `npm root -g` appended with `/@google/gemini-cli-core/dist/src/code_assist/oauth2.js`

Extract with regex: `CLIENT_ID\s*=\s*["']([^"']+)["']` and `CLIENT_SECRET\s*=\s*["']([^"']+)["']`.

If no path resolves, `fetchGeminiUsage` returns `status: "error"` and Settings shows: "Could not locate Gemini CLI installation. Is the CLI installed?"

---

## Data Mapping

### Usage windows

| Quota bucket `modelId` | Window `label` |
|---|---|
| contains `"pro"` | `"Pro"` |
| contains `"flash"` | `"Flash"` |

```ts
usedPercent = Math.round((1 - remainingFraction) * 100)
```

`resetTime` is an ISO 8601 string from the API. It must be passed through a `formatResetTime(isoString)` helper (same pattern as `claude.ts`) before assignment to `UsageWindow.resetsAt`, producing a human-readable display string (e.g. `"in 4h 20m"`, `"tomorrow"`).

### Plan badge

| `tier` value | Badge |
|---|---|
| `"free-tier"` | `"Free"` |
| `"standard-tier"` | `"Paid"` |
| `"legacy-tier"` | `"Legacy"` |

### Account email

Decoded from the `id_token` JWT payload (`email` claim). No extra API call needed.

### ServiceData shape

```ts
{
  accountId: "gemini",
  name: "Gemini CLI",
  label: undefined,
  plan: "Free" | "Paid" | "Legacy" | "",
  status: "ok" | "error" | "expired" | "not_configured",
  windows: [
    { label: "Pro",   usedPercent: 20, resetsAt: "in 4h 20m" },
    { label: "Flash", usedPercent: 60, resetsAt: "in 4h 20m" },
  ],
  email: "user@example.com",
}
```

`status: "not_configured"` is returned when the credentials file does not exist or the auth type is unsupported. The Dashboard filters these out (same as other services already do for `not_configured`).

---

## Settings UI

A dedicated `Gemini CLI` section in Settings (not driven by `service.fields` like other services — no fields to fill in).

States:
- **Idle:** "Detect" button visible
- **Detecting:** button shows spinner
- **Detected:** green checkmark + email address
- **Not found:** inline error — "Gemini CLI not found. Run `gemini auth login` first."
- **Unsupported auth:** inline error — "OAuth required. API key and Vertex AI auth types are not supported."
- **Session expired:** inline error — "Session expired. Run `gemini auth login` to re-authenticate."

---

## Error Handling

| Condition | `ServiceData.status` | Dashboard behavior |
|---|---|---|
| Credentials file not found | `"not_configured"` | Service silently absent (filtered by Dashboard) |
| Unsupported auth type | `"not_configured"` | Service silently absent (filtered by Dashboard) |
| CLI source not found (no client_id/secret) | `"error"` | Card shown with error state |
| Token refresh succeeds | — | Transparent, proceeds normally |
| Token refresh fails (expired session) | `"expired"` | Card shown with expired state |
| API call fails (network / 5xx) | `"error"` | Card shown with error state |
| No Pro/Flash buckets in response | `"error"` | Card shown with error state |

---

## Dashboard Integration

Gemini CLI does not use uso.ai's credential store (`tauri-plugin-store`), so it cannot go through the existing `isAccountConfigured` / store-based fetch loop. Instead, `Dashboard.tsx` must add a special-case branch:

```ts
// After fetching Claude / ChatGPT / Cursor from the store as today:
const geminiResult = await fetchGeminiUsage();
if (geminiResult.status !== "not_configured") {
  results.push(geminiResult);
}
```

`fetchGeminiUsage()` takes no arguments — it reads the credentials file internally. The `not_configured` filter prevents a card from appearing when the CLI is not installed.

`services.ts` still includes a `gemini` entry (for the color, logo, and name constants), but `fields: []` is intentional — the Settings section for Gemini CLI is rendered via its own custom block, not the generic field-loop used for Claude/ChatGPT/Cursor.

---

## Out of Scope

- Support for `api-key` or `vertex-ai` auth types
- Tracking consumer Gemini chat (gemini.google.com) — no endpoint available
- Multiple Gemini accounts (CLI supports one account at a time)
- Writing back to `~/.gemini/oauth_creds.json` after token refresh (read-only)
