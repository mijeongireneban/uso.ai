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
| `src/lib/api/utils.ts` | Shared `formatResetTime(isoString)` helper (extracted from `claude.ts`) |

### Files to modify

| File | Change |
|---|---|
| `src/lib/api/claude.ts` | Import `formatResetTime` from `utils.ts` instead of defining it locally |
| `src/lib/services.ts` | Add `gemini` service entry with `name: "Gemini CLI"`, `fields: []` |
| `src/pages/Settings.tsx` | Add Gemini CLI section with Detect button and inline status |
| `src/pages/Dashboard.tsx` | Add special-case branch for `gemini` (file-detected, not store-based) |
| `src-tauri/tauri.conf.json` | Add `cloudcode-pa.googleapis.com` and `oauth2.googleapis.com` to HTTP allowlist |
| `src-tauri/capabilities/*.json` | Add HTTP allow rules for new domains + `fs:allow-read-home-dir` scoped to `~/.gemini/` |
| `package.json` / `src-tauri/Cargo.toml` | Add `@tauri-apps/plugin-fs` (npm + Cargo) |
| `src-tauri/src/lib.rs` | Register `tauri_plugin_fs::init()` |

---

## Shared Utility: `formatResetTime`

The `formatResetTime(isoString: string | null): string` function currently lives as a private function in `src/lib/api/claude.ts`. It must be extracted into `src/lib/api/utils.ts` with the same `string | null` signature (preserving the null-guard that returns `"—"` for null inputs), then imported by both `claude.ts` and the new `gemini.ts`. This avoids duplicating the logic and prevents a TypeScript compile error in `claude.ts` after the refactor.

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

Optionally check `~/.gemini/settings.json` for `authType` — return `status: "not_configured"` if the value is `"api-key"` or `"vertex-ai"` (those auth types don't have the required quota scope).

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

Note: these are internal (`v1internal`) endpoints and may change without notice. If `remainingFraction` is absent or `null` for a bucket, treat it as `0` (i.e. `usedPercent: 0`).

### Token refresh (when `expiry_date` is in the past)

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>&refresh_token=<token>
```

The OAuth `CLIENT_ID` and `CLIENT_SECRET` are **hardcoded constants** copied from the open-source Gemini CLI source (`packages/core/src/code_assist/oauth2.ts`). They are public values embedded in the published open-source repository and do not need to be extracted at runtime. This eliminates any filesystem search or shell invocation.

### In-memory token caching

`gemini.ts` maintains a **module-level cache** for the refreshed access token:

```ts
let cachedToken: { accessToken: string; expiresAt: number } | null = null;
```

On each call to `fetchGeminiUsage`:
1. If `cachedToken` exists and `Date.now() < cachedToken.expiresAt - 60_000`, use it directly.
2. Otherwise, read `~/.gemini/oauth_creds.json` from disk.
3. If `expiry_date` is in the past, refresh via OAuth and update `cachedToken`.
4. Proceed with the (possibly refreshed) access token.

This prevents repeated refresh-token round-trips on every 5-minute Dashboard cycle when the on-disk token is stale but an in-memory refresh already occurred.

---

## Data Mapping

### Usage windows

| Quota bucket `modelId` | Window `label` |
|---|---|
| contains `"pro"` | `"Pro"` |
| contains `"flash"` | `"Flash"` |
| neither | skip bucket |

```ts
usedPercent = Math.round((1 - (remainingFraction ?? 0)) * 100)
```

`resetTime` is an ISO 8601 string from the API. Pass it through `formatResetTime(isoString)` from `src/lib/api/utils.ts` before assigning to `UsageWindow.resetsAt`, producing a human-readable string (e.g. `"in 4h 20m"`, `"tomorrow"`).

### Plan badge

| `tier` value | `ServiceData.plan` |
|---|---|
| `"free-tier"` | `"Free"` |
| `"standard-tier"` | `"Paid"` |
| `"legacy-tier"` | `"Legacy"` |
| unknown / absent | `""` |

`ServiceDonutCard` renders `service.plan` as a raw string badge — no code change needed there.

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

`status: "not_configured"` is returned when the credentials file does not exist or the auth type is unsupported. The Dashboard filters these out (same treatment as other services).

---

## Settings UI

A dedicated `Gemini CLI` section in Settings — custom-rendered, not driven by the generic `service.fields` loop.

The "Detect" button triggers a full `fetchGeminiUsage()` call. This exercises the complete flow (file read → optional token refresh → `loadCodeAssist` → `retrieveUserQuota`) and shows the real account email on success.

**Detect result is ephemeral** — shown only while Settings is open. No state is persisted to the credential store. The Dashboard independently reads the credentials file on each refresh cycle.

The Gemini CLI tab's configured/unconfigured indicator in the Settings tab bar is determined by checking whether `~/.gemini/oauth_creds.json` exists (read via `tauri-plugin-fs` when the Settings page mounts). This check is separate from and does not rely on the credential store.

`Settings.tsx` must maintain a `geminiDetected: boolean` state variable (default `false`), populated on mount via `exists("~/.gemini/oauth_creds.json")`. The tab-bar render loop must special-case `service.id === "gemini"` to use `geminiDetected` instead of `isServiceConfigured` for the indicator dot, leaving the indicator logic for Claude/ChatGPT/Cursor unchanged.

States:
- **Idle:** "Detect" button visible
- **Detecting:** button shows spinner
- **Detected:** green checkmark + email address
- **Not found:** inline error — "Gemini CLI not found. Run `gemini auth login` first."
- **Unsupported auth:** inline error — "OAuth required. API key and Vertex AI auth types are not supported."
- **Session expired:** inline error — "Session expired. Run `gemini auth login` to re-authenticate."
- **CLI error:** inline error — "Could not fetch Gemini quota. Check your connection and try again."

---

## Error Handling

| Condition | `ServiceData.status` | Dashboard behavior |
|---|---|---|
| Credentials file not found | `"not_configured"` | Service silently absent (filtered by Dashboard) |
| Unsupported auth type | `"not_configured"` | Service silently absent (filtered by Dashboard) |
| Token refresh fails (expired session) | `"expired"` | Card shown with expired state |
| Token refresh succeeds | — | Transparent, proceeds normally |
| API call fails (network / 5xx) | `"error"` | Card shown with error state |
| No Pro/Flash buckets in response | `"error"` | Card shown with error state; `plan` set to tier from `loadCodeAssist` if available, else `""` |
| `remainingFraction` absent / null for a bucket | — | Default `usedPercent: 0`, bucket included |

---

## Dashboard Integration

Gemini CLI does not use uso.ai's credential store (`tauri-plugin-store`), so it cannot go through the existing `isAccountConfigured` / store-based fetch loop. Instead, `Dashboard.tsx` must add a special-case branch after the store-based results are gathered:

```ts
const geminiResult = await fetchGeminiUsage();
if (geminiResult.status !== "not_configured") {
  results.push(geminiResult);
  // Also save history snapshot for Gemini:
  if (geminiResult.status === "ok") {
    saveHistorySnapshot("gemini", geminiResult).catch(() => {});
  }
}
```

`fetchGeminiUsage()` takes no arguments — it reads the credentials file internally. The `not_configured` filter prevents a card from appearing when the CLI is not installed.

`services.ts` still includes a `gemini` entry (for color, logo, and name constants), but `fields: []` is intentional — the Settings section for Gemini CLI is rendered via a custom block, not the generic field-loop used for Claude/ChatGPT/Cursor.

---

## Out of Scope

- Support for `api-key` or `vertex-ai` auth types
- Tracking consumer Gemini chat (gemini.google.com) — no endpoint available
- Multiple Gemini accounts (CLI supports one account at a time)
- Writing back to `~/.gemini/oauth_creds.json` after token refresh (read-only on disk; in-memory cache only)
