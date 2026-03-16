# Multi-Account Per Service — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Scope:** uso.ai — Tauri v2 + React/TypeScript macOS menu bar app

---

## Problem

Credentials are stored one-per-service. Power users with both a personal and a work account for the same service (e.g. Claude Pro + Claude Team) cannot track both at once.

---

## Design

### 1. Data Model

`credentials.json` changes from a flat object to arrays of accounts per service.

**Old format:**
```json
{
  "claude":  { "orgId": "...", "sessionKey": "..." },
  "chatgpt": { "bearerToken": "..." },
  "cursor":  { "sessionToken": "..." }
}
```

**New format:**
```json
{
  "claude": [
    { "id": "abc123", "label": "Personal", "credentials": { "orgId": "...", "sessionKey": "..." } }
  ]
}
```

**TypeScript types** (`src/lib/credentials.ts` — existing file, rewritten):
```ts
export type Account = {
  id: string;                          // generated via crypto.randomUUID()
  label: string;
  credentials: Record<string, string>;
};

export type CredentialsStore = Record<string, Account[]>;
```

**ID generation:** All account IDs are generated with `crypto.randomUUID()`.

**`loadCredentials(): Promise<CredentialsStore>`** — reads the raw value from the store and migrates per service. For each service entry:
- `Array.isArray(entry)` → already migrated, leave unchanged
- Plain object (typeof === "object" && not null) → wrap: `[{ id: crypto.randomUUID(), label: "Default", credentials: { ...entry } }]`
- Any other value (null, undefined, string, etc.) → skip/drop that service key

If any migration occurred, call `saveCredentials(migratedStore)` before returning.

**`saveCredentials(data: CredentialsStore): Promise<void>`** — module-level export. Opens the Tauri store, calls `store.set("credentials", data)`, then `store.save()`. `credentials.json` holds only the `"credentials"` key — no other keys are present — so overwriting it is safe.

---

### 2. Settings UI

Settings maintains two pieces of local state:
- **`persisted: CredentialsStore`** — initialized from `loadCredentials()` on mount; missing service keys default to `[]`
- **`draft: CredentialsStore`** — initialized as a deep copy of `persisted` on mount; missing service keys default to `[]`

Each service tab renders a vertical list of account sections, driven by `draft[serviceId]`. Each section contains:

- **Label field** — free-text input (placeholder: "e.g. Personal, Work"); optional — empty or whitespace-only label does not block saving
- **Credential fields** — same `PasswordInput` fields as today, driven by `service.fields`
- **Save button:**
  - Disabled if any **credential** field for this account is empty or whitespace-only (`!value.trim()`)
  - When clicked, calls the same service API fetch function as the dashboard (e.g. `fetchClaudeUsage` for Claude) to validate; `"ok"` proceeds, `"expired"` and `"error"` set their respective statuses and return early
  - On success: writes `{ ...persisted, [serviceId]: draft[serviceId] }` via `saveCredentials()`, updates `persisted` to match, calls `onSaved?.()` inside the 800ms reset timeout
  - One `onSaved` call per successful account save is intentional — the callback triggers the parent to re-fetch, which is appropriate even for partial saves
  - Shows `saving / saved / expired / error` states keyed by `account.id`; auto-resets `"saved"` → `"idle"` after 800ms
- **Delete link:**
  - **Unsaved account** (in `draft` but not in `persisted`): removes from `draft` state only, no store write; always shown
  - **Persisted account**: calls `saveCredentials()` immediately with this account removed; hidden when it is the only account in `persisted[serviceId]` AND that account has at least one non-empty credential field; if the sole persisted account has all-empty credentials, Delete is shown so the user can remove a broken state

**`statuses` state:** `Record<string, "idle" | "saving" | "saved" | "expired" | "error">` keyed by `account.id`. New accounts start at `"idle"`.

**"+ Add account" button:** Appends to `draft[serviceId]` a new section with `id: crypto.randomUUID()` and label `"Account N"` where N = `draft[serviceId].length + 1`. Labels are non-unique editable suggestions — duplicates after deletions are acceptable.

**"Configured" tab indicator:** Shows `CheckCircle2` when at least one account in `persisted[serviceId]` has all credential fields non-empty and non-whitespace. `draft` state is not considered.

---

### 3. Dashboard

**`ServiceData` type** (`src/types.ts`):
```ts
export type ServiceData = {
  accountId: string;  // from Account.id — used as React key
  name: string;       // SERVICES.find(s => s.id === serviceId)?.name
  label?: string;     // present only when accounts.length > 1 for this service
  plan: string;
  status: ServiceStatus;  // "not_configured" retained in union but never emitted by fetch flow
  windows: UsageWindow[];
  email?: string;
};
```

The `name` field is always sourced from `SERVICES` config (e.g. `"ChatGPT (Codex)"`), ensuring `getServiceByName(service.name)` always resolves correctly.

**Label display rule:** `label` is set on `ServiceData` only when `accounts.length > 1` for that service.

**Account filtering:** Before fetching, skip any account where any credential field is empty or whitespace-only. Skipped accounts produce no `ServiceData` and no card. `not_configured` is never set on any emitted `ServiceData`.

**Fetch flow:** All non-skipped accounts across all services are fetched in parallel via `Promise.allSettled`. Each fetch function receives credential values from `account.credentials` (same call signatures as today). Processing results:
- Fulfilled (`status: "fulfilled"`) → use `result.value` as `ServiceData`, with `accountId` and `name`/`label` merged in
- Rejected (`status: "rejected"`) → produce `{ accountId, name, label, status: "error", plan: "", windows: [] }`

**Expired-token notifications:** After `Promise.allSettled`, collect all `ServiceData` where `status === "expired"`. For each, fire a notification. Message includes label when present: `"Your {name} · {label} session token has expired."` — if no label (single account), use the existing message format.

**ChatGPT expiry warning (pre-fetch):** Iterates all ChatGPT accounts from `CredentialsStore`. For each account with a non-blank `bearerToken`, checks `expiresWithin(token, 30)`. Notification:
- Single ChatGPT account: existing message unchanged
- Multiple accounts: `"Your ChatGPT (Codex) · {displayLabel} Bearer token expires in less than 30 minutes."` where `displayLabel` = stored label if non-blank, otherwise `"Account N"` (1-based position in current array)

If `loadCredentials()` itself rejects, the existing `fetchError` state and red error string rendering are preserved unchanged.

**Card order:** Claude accounts first, then ChatGPT, then Cursor. Within a service, accounts appear in array insertion order.

**React keys:** Both `ServiceDonutCard` and `NextResetCard` use `key={s.accountId}` at their call sites in `Dashboard.tsx`.

**`ServiceDonutCard` header:** Renders `"{service.name} · {label}"` when `label` is present; otherwise `service.name`. `getServiceByName` receives the raw `service.name`.

**`NextResetCard` header:** Same rule — renders `"{service.name} · {label}"` when `label` is present.

---

### 4. Files Changed

| File | Change |
|------|--------|
| `src/lib/credentials.ts` | Rewrite: new `Account` + `CredentialsStore` types; updated `loadCredentials()` with per-service migration; new `saveCredentials(data)` module-level export |
| `src/types.ts` | Add `accountId: string` and `label?: string` to `ServiceData`; retain `not_configured` in `ServiceStatus` |
| `src/pages/Settings.tsx` | Rewrite: `persisted` + `draft` state; per-account sections with add/delete; `statuses` keyed by `account.id`; Save disabled on empty/whitespace credential fields; preserve `onSaved` prop |
| `src/pages/Dashboard.tsx` | Iterate all accounts per service; filter unconfigured; `Promise.allSettled` with per-account error isolation; source `name` from `SERVICES` config; pass `accountId` + `label` into `ServiceData`; update notifications for multi-account; update ChatGPT expiry check; use `key={s.accountId}` at both card call sites; preserve `fetchError` handling |
| `src/components/dashboard/ServiceDonutCard.tsx` | Render `"{name} · {label}"` in title when `label` is present |
| `src/components/dashboard/NextResetCard.tsx` | Render `"{name} · {label}"` in header when `label` is present |

---

### 5. Out of Scope

- Active/inactive flag — all accounts always fetched and shown
- Account reordering — insertion order only
- Aggregating usage across accounts for the same service — each card is independent
