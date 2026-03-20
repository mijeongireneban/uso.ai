# Gemini CLI Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gemini CLI as a fourth service in uso.ai, displaying Pro + Flash quota usage by reading OAuth credentials from `~/.gemini/oauth_creds.json`.

**Architecture:** `tauri-plugin-fs` reads the Gemini CLI credential file; `fetchGeminiUsage()` in `src/lib/api/gemini.ts` handles token refresh (in-memory cache) and calls two internal Google Cloud Code endpoints to get per-model quota; Dashboard gets a special-case branch since Gemini has no credential store entries; Settings gets a custom Gemini CLI tab with a "Detect" button.

**Tech Stack:** Tauri v2, React, TypeScript, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-http` (already present)

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `src/lib/api/utils.ts` | **Create** | Shared `formatResetTime(isoString: string \| null): string` |
| `src/lib/api/gemini.ts` | **Create** | `fetchGeminiUsage()` — reads creds, refreshes token, fetches quota |
| `src/assets/gemini.png` | **Add** | Gemini logo for tab avatar |
| `src/lib/api/claude.ts` | **Modify** | Import `formatResetTime` from `utils.ts` |
| `src/lib/services.ts` | **Modify** | Add `gemini` service entry |
| `src/pages/Dashboard.tsx` | **Modify** | Add Gemini special-case fetch + history snapshot |
| `src/pages/Settings.tsx` | **Modify** | Add Gemini CLI tab with Detect button |
| `src-tauri/capabilities/default.json` | **Modify** | Add fs + HTTP permissions for Gemini |
| `src-tauri/Cargo.toml` | **Modify** | Add `tauri-plugin-fs = "2"` |
| `src-tauri/src/lib.rs` | **Modify** | Register `tauri_plugin_fs::init()` |
| `package.json` | **Modify** | Add `@tauri-apps/plugin-fs` |

---

## Task 1: Infrastructure — `tauri-plugin-fs` + Capabilities

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `package.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add Rust dependency**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
tauri-plugin-fs = "2"
```

- [ ] **Step 2: Register plugin in lib.rs**

In `src-tauri/src/lib.rs`, add `.plugin(tauri_plugin_fs::init())` after the existing plugins. The `.setup(...)` block starts at line 36. Add it before `.setup`:

```rust
.plugin(tauri_plugin_fs::init())
```

So the builder block becomes:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_positioner::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_fs::init())   // ← add this
    .setup(|app| {
```

- [ ] **Step 3: Install npm package**

```bash
cd /Users/mijeongban/Documents/dev-ai/uso-ai
npm install @tauri-apps/plugin-fs
```

Expected: package added to `node_modules`, `package.json` updated.

- [ ] **Step 4: Add capabilities**

In `src-tauri/capabilities/default.json`, add to the `"permissions"` array:

```json
"fs:default",
{
  "identifier": "fs:allow-read-file",
  "allow": [{ "path": "$HOME/.gemini/**" }]
},
{
  "identifier": "fs:allow-exists",
  "allow": [{ "path": "$HOME/.gemini/**" }]
},
```

Also add the new HTTP domains to the existing `http:allow-fetch` object's `"allow"` array:
```json
{ "url": "https://cloudcode-pa.googleapis.com/**" },
{ "url": "https://oauth2.googleapis.com/**" }
```

The final `"permissions"` array should look like:
```json
"permissions": [
  "core:default",
  "opener:default",
  "store:default",
  "http:default",
  "http:allow-fetch-send",
  "http:allow-fetch-read-body",
  "notification:default",
  "global-shortcut:allow-register",
  "global-shortcut:allow-unregister",
  "global-shortcut:allow-is-registered",
  "fs:default",
  {
    "identifier": "fs:allow-read-file",
    "allow": [{ "path": "$HOME/.gemini/**" }]
  },
  {
    "identifier": "fs:allow-exists",
    "allow": [{ "path": "$HOME/.gemini/**" }]
  },
  {
    "identifier": "http:allow-fetch",
    "allow": [
      { "url": "https://claude.ai/**" },
      { "url": "https://chatgpt.com/**" },
      { "url": "https://cursor.com/**" },
      { "url": "https://www.cursor.com/**" },
      { "url": "https://cloudcode-pa.googleapis.com/**" },
      { "url": "https://oauth2.googleapis.com/**" }
    ]
  }
]
```

- [ ] **Step 5: Verify Rust compiles**

```bash
cd /Users/mijeongban/Documents/dev-ai/uso-ai
npm run tauri dev -- --no-watch 2>&1 | head -40
```

Expected: no compile errors related to `tauri-plugin-fs`. (Ctrl+C to stop once it starts the frontend.)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json package-lock.json
git commit -m "feat: add tauri-plugin-fs and Gemini API capability permissions"
```

---

## Task 2: Extract `formatResetTime` to Shared Utility

**Files:**
- Create: `src/lib/api/utils.ts`
- Modify: `src/lib/api/claude.ts`

- [ ] **Step 1: Create `src/lib/api/utils.ts`**

```typescript
/**
 * Formats an ISO 8601 reset timestamp into a human-readable string.
 * Returns "—" for null/missing values.
 * Examples: "in 45m", "in 2h 30m", "today 3:00 PM", "Mon 9:00 AM"
 */
export function formatResetTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 360) {
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayDiff = Math.floor(diffMs / 86400000);
  if (dayDiff === 0) return `today ${timeStr}`;
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayName} ${timeStr}`;
}
```

- [ ] **Step 2: Update `src/lib/api/claude.ts`**

Remove the local `formatResetTime` function (lines 9–27) and add an import at the top:

```typescript
import { formatResetTime } from "@/lib/api/utils";
```

The file should start as:
```typescript
import { fetch } from "@tauri-apps/plugin-http";
import { formatResetTime } from "@/lib/api/utils";
import type { ServiceData } from "@/types";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/mijeongban/Documents/dev-ai/uso-ai
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors. Claude usage card should still work the same.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/utils.ts src/lib/api/claude.ts
git commit -m "refactor: extract formatResetTime to shared utils"
```

---

## Task 3: Add Gemini Logo + Service Entry

**Files:**
- Add: `src/assets/gemini.png`
- Modify: `src/lib/services.ts`

- [ ] **Step 1: Download Gemini logo**

Download a Gemini logo PNG (the Google Gemini sparkle icon — available from Google's public brand resources or search "gemini logo png 512px"). Save it to:
```
src/assets/gemini.png
```

A 128×128 or 256×256 PNG works. The app will display it at 20×20px.

- [ ] **Step 2: Add gemini entry to `src/lib/services.ts`**

Add an import at the top:
```typescript
import geminiLogo from "@/assets/gemini.png";
```

Add to the `SERVICES` array (after cursor):
```typescript
{
  id: "gemini",
  name: "Gemini CLI",
  color: "#4285f4",
  logo: geminiLogo,
  fields: [],
},
```

Full updated file:
```typescript
import claudeLogo from "@/assets/claude.png";
import chatgptLogo from "@/assets/chatgpt.png";
import cursorLogo from "@/assets/cursor.png";
import geminiLogo from "@/assets/gemini.png";

export type FieldConfig = {
  key: string;
  label: string;
  placeholder: string;
  hint: string;
};

export type ServiceConfig = {
  id: string;
  name: string;
  color: string;
  logo: string;
  fields: FieldConfig[];
};

export const SERVICES: ServiceConfig[] = [
  {
    id: "claude",
    name: "Claude",
    color: "#cc785c",
    logo: claudeLogo,
    fields: [
      {
        key: "orgId",
        label: "Organization ID",
        placeholder: "259a829d-c8a3-485a-8403-...",
        hint: "Found in the URL: claude.ai/api/organizations/{org_id}/usage",
      },
      {
        key: "sessionKey",
        label: "Session Key",
        placeholder: "sk-ant-...",
        hint: "DevTools → Network → any request → Cookie header → sessionKey value",
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT (Codex)",
    color: "#19c37d",
    logo: chatgptLogo,
    fields: [
      {
        key: "bearerToken",
        label: "Bearer Token",
        placeholder: "eyJhbGci...",
        hint: "DevTools → Network → any request → Authorization header (without 'Bearer ')",
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    color: "#6e7bff",
    logo: cursorLogo,
    fields: [
      {
        key: "sessionToken",
        label: "Session Token",
        placeholder: "user_01J6T9QTW60CGK6...",
        hint: "DevTools → Network → any request → Cookie header → WorkosCursorSessionToken value",
      },
    ],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    color: "#4285f4",
    logo: geminiLogo,
    fields: [],
  },
];

export function getServiceByName(name: string): ServiceConfig | undefined {
  return SERVICES.find((s) => s.name === name);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors. The gemini logo imports correctly.

- [ ] **Step 4: Commit**

```bash
git add src/assets/gemini.png src/lib/services.ts
git commit -m "feat: add Gemini CLI service entry and logo"
```

---

## Task 4: Implement `fetchGeminiUsage`

**Files:**
- Create: `src/lib/api/gemini.ts`

This is the core of the feature. Read carefully.

- [ ] **Step 1: Create `src/lib/api/gemini.ts`**

**IMPORTANT:** `tauri-plugin-fs` does NOT expand `~` to the home directory. Always use `BaseDirectory.Home` with relative paths (without the leading `~`).

```typescript
import { fetch } from "@tauri-apps/plugin-http";
import { readTextFile, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { formatResetTime } from "@/lib/api/utils";
import type { ServiceData } from "@/types";

// ── OAuth constants (public, from open-source Gemini CLI) ─────────────────────
// Source: https://github.com/google-gemini/gemini-cli
// packages/core/src/code_assist/oauth2.ts
// These are embedded in the distributed CLI app and are intentionally public.
const CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

// Relative paths used with BaseDirectory.Home (tauri-plugin-fs does not expand ~)
const CREDS_PATH = ".gemini/oauth_creds.json" as const;
const SETTINGS_PATH = ".gemini/settings.json" as const;

// ── In-memory token cache ─────────────────────────────────────────────────────
// Prevents repeated OAuth refresh round-trips on every 5-min Dashboard cycle.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

// ── Types ─────────────────────────────────────────────────────────────────────

type OAuthCreds = {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expiry_date: number; // ms since epoch
  token_type: string;
};

type QuotaBucket = {
  modelId?: string;
  model_id?: string;
  remainingFraction?: number | null;
  remaining_fraction?: number | null;
  resetTime?: string;
  reset_time?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwtEmail(idToken: string): string | undefined {
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.email ?? undefined;
  } catch {
    return undefined;
  }
}

function tierToPlan(tier: string): string {
  if (tier === "free-tier") return "Free";
  if (tier === "standard-tier") return "Paid";
  if (tier === "legacy-tier") return "Legacy";
  return "";
}

function notConfigured(): ServiceData {
  return { accountId: "gemini", name: "Gemini CLI", plan: "", status: "not_configured", windows: [] };
}

function errorResult(plan = ""): ServiceData {
  return { accountId: "gemini", name: "Gemini CLI", plan, status: "error", windows: [] };
}

// ── Token resolution ──────────────────────────────────────────────────────────

async function resolveAccessToken(): Promise<{ accessToken: string; idToken: string } | null> {
  // 1. Use in-memory cache if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    // Cache hit — but we still need idToken for email. Re-read from disk only.
    // (idToken doesn't expire as fast as access_token)
    try {
      const raw = await readTextFile(CREDS_PATH);
      const creds = JSON.parse(raw) as OAuthCreds;
      return { accessToken: cachedToken.accessToken, idToken: creds.id_token };
    } catch {
      return null;
    }
  }

  // 2. Read credentials from disk
  let creds: OAuthCreds;
  try {
    const raw = await readTextFile(CREDS_PATH, { baseDir: BaseDirectory.Home });
    creds = JSON.parse(raw) as OAuthCreds;
  } catch {
    return null;
  }

  // 3. If token still valid, use it
  if (creds.expiry_date > Date.now() + 60_000) {
    cachedToken = { accessToken: creds.access_token, expiresAt: creds.expiry_date };
    return { accessToken: creds.access_token, idToken: creds.id_token };
  }

  // 4. Token expired — refresh it
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: creds.refresh_token,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return null; // refresh token itself is expired
    const data = (await res.json()) as { access_token: string; expires_in: number; id_token?: string };
    const expiresAt = Date.now() + data.expires_in * 1000;
    cachedToken = { accessToken: data.access_token, expiresAt };
    return { accessToken: data.access_token, idToken: data.id_token ?? creds.id_token };
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchGeminiUsage(): Promise<ServiceData> {
  // Check credentials file exists (BaseDirectory.Home resolves ~ correctly)
  const credsExist = await exists(CREDS_PATH, { baseDir: BaseDirectory.Home }).catch(() => false);
  if (!credsExist) return notConfigured();

  // Check auth type — skip api-key and vertex-ai accounts
  try {
    const settingsRaw = await readTextFile(SETTINGS_PATH, { baseDir: BaseDirectory.Home });
    const settings = JSON.parse(settingsRaw) as { authType?: string };
    if (settings.authType === "api-key" || settings.authType === "vertex-ai") {
      return notConfigured();
    }
  } catch {
    // settings.json missing or unparseable — proceed (OAuth is the default)
  }

  // Resolve access token (with refresh if needed)
  const tokenResult = await resolveAccessToken();
  if (!tokenResult) {
    return { accountId: "gemini", name: "Gemini CLI", plan: "", status: "expired", windows: [] };
  }
  const { accessToken, idToken } = tokenResult;
  const email = decodeJwtEmail(idToken);

  // Step 1: loadCodeAssist — get tier + project ID
  let tier = "";
  let projectId = "";
  try {
    const res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metadata: {
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
          duetProject: "default",
        },
      }),
    });
    if (!res.ok) return errorResult();
    const data = (await res.json()) as { tier?: string; cloudaicompanionProject?: string };
    tier = data.tier ?? "";
    projectId = data.cloudaicompanionProject ?? "";
  } catch {
    return errorResult();
  }

  if (!projectId) return errorResult(tierToPlan(tier));

  // Step 2: retrieveUserQuota — get per-model usage
  let buckets: QuotaBucket[] = [];
  try {
    const res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project: projectId }),
    });
    if (!res.ok) return errorResult(tierToPlan(tier));
    const data = (await res.json()) as { quotaBuckets?: QuotaBucket[] };
    buckets = data.quotaBuckets ?? [];
  } catch {
    return errorResult(tierToPlan(tier));
  }

  // Map buckets to UsageWindows (Pro + Flash only)
  const windows = buckets
    .filter((b) => {
      const id = b.modelId ?? b.model_id ?? "";
      return id.includes("pro") || id.includes("flash");
    })
    .map((b) => {
      const id = b.modelId ?? b.model_id ?? "";
      const label = id.includes("pro") ? "Pro" : "Flash";
      const remaining = b.remainingFraction ?? b.remaining_fraction ?? 0;
      const resetIso = b.resetTime ?? b.reset_time ?? null;
      return {
        label,
        usedPercent: Math.round((1 - remaining) * 100),
        resetsAt: formatResetTime(resetIso),
      };
    });

  if (windows.length === 0) return errorResult(tierToPlan(tier));

  return {
    accountId: "gemini",
    name: "Gemini CLI",
    plan: tierToPlan(tier),
    status: "ok",
    windows,
    email,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors. Fix any type issues before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/gemini.ts
git commit -m "feat: implement fetchGeminiUsage with OAuth token caching"
```

---

## Task 5: Dashboard Integration

**Files:**
- Modify: `src/pages/Dashboard.tsx`

The existing `fetchAll` in Dashboard fetches Claude/ChatGPT/Cursor from the credential store. Gemini doesn't use the store, so it needs a separate branch.

- [ ] **Step 1: Add import**

At the top of `src/pages/Dashboard.tsx`, add:
```typescript
import { fetchGeminiUsage } from "@/lib/api/gemini";
```

- [ ] **Step 2: Add Gemini to the fetch loop with history snapshot**

In the `fetchAll` callback, after the `results` array is built (after line ~145) and before the "Expired-token notifications" block, add this single block (includes both the result push and the history snapshot):

```typescript
// Gemini CLI — file-based, not store-based
const geminiResult = await fetchGeminiUsage();
if (geminiResult.status !== "not_configured") {
  results.push(geminiResult);
  if (geminiResult.status === "ok") {
    saveHistorySnapshot("gemini", geminiResult).catch(() => {});
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Verify manually**

Run `npm run tauri dev`. If Gemini CLI is installed and `~/.gemini/oauth_creds.json` exists, a Gemini card should appear in the Dashboard. If not installed, nothing should appear (no error).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: add Gemini CLI to Dashboard fetch loop"
```

---

## Task 6: Settings UI — Gemini CLI Tab

**Files:**
- Modify: `src/pages/Settings.tsx`

The Settings page maps over `SERVICES` to render tabs. Gemini needs special treatment: no credential fields, a "Detect" button instead.

- [ ] **Step 1: Add imports**

At the top of `src/pages/Settings.tsx`, add:
```typescript
import { exists } from "@tauri-apps/plugin-fs";
import { Loader2 } from "lucide-react";
import { fetchGeminiUsage } from "@/lib/api/gemini";
```

- [ ] **Step 2: Add state variables**

Inside the `Settings` component (after existing `useState` calls):
```typescript
const [geminiDetected, setGeminiDetected] = useState(false);
const [geminiStatus, setGeminiStatus] = useState<"idle" | "detecting" | "detected" | "not_found" | "unsupported_auth" | "expired" | "error">("idle");
const [geminiEmail, setGeminiEmail] = useState<string | undefined>(undefined);
```

- [ ] **Step 3: Check file existence on mount**

Inside the existing `useEffect` that loads credentials (after `loadCredentials().then(...)`), add a parallel file check. Replace the existing effect or add a second one:

```typescript
import { exists, BaseDirectory } from "@tauri-apps/plugin-fs";

useEffect(() => {
  // Note: tauri-plugin-fs does NOT expand ~ — use BaseDirectory.Home with a relative path
  exists(".gemini/oauth_creds.json", { baseDir: BaseDirectory.Home })
    .then((found) => setGeminiDetected(found))
    .catch(() => setGeminiDetected(false));
}, []);
```

- [ ] **Step 4: Add handleDetect function**

Inside the `Settings` component, before the `return`:
```typescript
async function handleDetect() {
  setGeminiStatus("detecting");
  setGeminiEmail(undefined);
  const result = await fetchGeminiUsage();
  if (result.status === "ok") {
    setGeminiStatus("detected");
    setGeminiEmail(result.email);
    setGeminiDetected(true);
  } else if (result.status === "not_configured") {
    setGeminiStatus("not_found");
    setGeminiDetected(false);
  } else if (result.status === "expired") {
    setGeminiStatus("expired");
  } else {
    setGeminiStatus("error");
  }
}
```

- [ ] **Step 5: Update tab-bar indicator for Gemini**

In the `TabsList` render (around line 179–192), the current code:
```typescript
const configured = isServiceConfigured(persisted[service.id] ?? [], service.fields);
```

Change this to special-case Gemini:
```typescript
const configured = service.id === "gemini"
  ? geminiDetected
  : isServiceConfigured(persisted[service.id] ?? [], service.fields);
```

- [ ] **Step 6: Suppress generic TabsContent for Gemini + add custom block**

The existing `SERVICES.map(...)` (around line 194) renders a `TabsContent` for every service. Since `gemini` is now in `SERVICES`, it will also get a generic tab with an "Add account" button — which must be suppressed.

Inside the map, at the very start of the callback body, add an early return for Gemini:
```typescript
{SERVICES.map((service) => {
  // Gemini CLI has a custom tab — skip the generic field-loop rendering
  if (service.id === "gemini") return null;

  const accounts = draft[service.id] ?? [];
  // ... rest of existing code unchanged
```

Then, after the closing `})}` of the `SERVICES.map(...)` (around line 274), add the custom Gemini `TabsContent` as a sibling inside `<Tabs>`:

```typescript
<TabsContent value="gemini" className="mt-4">
  <Card>
    <CardContent className="px-6 py-6 space-y-4">
      <div>
        <p className="text-xs font-medium mb-1">Gemini CLI</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Reads credentials from <code className="font-mono bg-muted px-1 rounded">~/.gemini/oauth_creds.json</code>.
          Run <code className="font-mono bg-muted px-1 rounded">gemini auth login</code> in your terminal first.
        </p>
      </div>

      <Button
        onClick={handleDetect}
        disabled={geminiStatus === "detecting"}
        className="w-full"
      >
        {geminiStatus === "detecting" && (
          <><Loader2 size={14} className="animate-spin mr-2" />Detecting...</>
        )}
        {geminiStatus !== "detecting" && "Detect Gemini CLI"}
      </Button>

      {geminiStatus === "detected" && (
        <p className="text-xs text-green-500 flex items-center gap-1.5">
          <CheckCircle2 size={13} />
          {geminiEmail ? `Connected as ${geminiEmail}` : "Gemini CLI detected"}
        </p>
      )}
      {geminiStatus === "not_found" && (
        <p className="text-xs text-destructive">
          Gemini CLI not found. Run <code className="font-mono">gemini auth login</code> first.
        </p>
      )}
      {geminiStatus === "unsupported_auth" && (
        <p className="text-xs text-destructive">
          OAuth required. API key and Vertex AI auth types are not supported.
        </p>
      )}
      {geminiStatus === "expired" && (
        <p className="text-xs text-destructive">
          Session expired. Run <code className="font-mono">gemini auth login</code> to re-authenticate.
        </p>
      )}
      {geminiStatus === "error" && (
        <p className="text-xs text-destructive">
          Could not fetch Gemini quota. Check your connection and try again.
        </p>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

**Important:** Place this `TabsContent` *inside* the `<Tabs>` component but *outside* the `SERVICES.map(...)`. It should be a sibling to the mapped `TabsContent` elements.

- [ ] **Step 7: Fix the Tabs defaultValue**

The `<Tabs defaultValue="claude">` at line 177 is fine — leave it.

- [ ] **Step 8: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 9: Verify manually**

Run `npm run tauri dev`. Open Settings. You should see a fourth "Gemini CLI" tab. Click "Detect Gemini CLI" and verify the appropriate status appears.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add Gemini CLI tab to Settings with Detect button"
```

---

## Task 7: Final Verification + PR

- [ ] **Step 1: Full build check**

```bash
cd /Users/mijeongban/Documents/dev-ai/uso-ai
npm run build
```

Expected: zero TypeScript errors, zero warnings about missing imports.

- [ ] **Step 2: Run the app**

```bash
npm run tauri dev
```

Manually verify:
- Dashboard: Gemini card appears if CLI is installed and authenticated, absent if not
- Dashboard: Gemini card shows Pro/Flash usage bars with percentages and reset times
- Dashboard: Gemini card shows plan badge (Free/Paid/Legacy) and email
- Settings: "Gemini CLI" tab appears as the fourth tab
- Settings: Tab shows checkmark/circle indicator based on file existence
- Settings: "Detect" button works, shows email on success
- Settings: "Detect" shows appropriate error messages for failure cases
- Other services: Claude, ChatGPT, Cursor still work correctly
- `formatResetTime` in Claude card still displays correctly

- [ ] **Step 3: Invoke finishing skill**

Use `superpowers:finishing-a-development-branch` to create a PR.
