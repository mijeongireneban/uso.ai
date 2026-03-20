# Usage History — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Add a Usage History tab to uso.ai so users can see how their AI subscription usage has trended over time. History is stored locally, never synced, and captured once per day per account.

---

## Data Model

A new `history.json` store (via `tauri-plugin-store`, already installed) holds an array of snapshots:

```ts
type HistorySnapshot = {
  timestamp: string;  // ISO date string, e.g. "2026-03-16"
  serviceId: string;  // "claude" | "chatgpt" | "cursor"
  accountId: string;
  data: ServiceData;  // full snapshot — windows, plan, email, status
};

type HistoryStore = HistorySnapshot[];
```

- One snapshot per `(date, accountId)` pair — duplicates are skipped
- Snapshots are never auto-purged (a future "Clear history" button can handle this)
- Full `ServiceData` is stored to maximise flexibility for future analysis

---

## Snapshot Logic

A new `src/lib/history.ts` module exposes:

```ts
export async function saveHistorySnapshot(serviceId: string, data: ServiceData): Promise<void>
export async function loadHistory(): Promise<HistoryStore>
```

`saveHistorySnapshot` runs after each successful `fetchAll` in `Dashboard.tsx`, once per account with `status: "ok"`. It:

1. Loads `history.json`
2. Checks if a snapshot for `(today, serviceId, accountId)` already exists — skips if so
3. Appends the new snapshot and saves

`Dashboard.tsx` must preserve the `(serviceId, ServiceData)` mapping from the `toFetch` array through to the `saveHistorySnapshot` call. The `services` state alone is insufficient — it carries no `serviceId` field. The save loop iterates the fulfilled results from `Promise.allSettled`, which already has `serviceId` in scope.

This is called silently after `setServices()`. Storage grows at ~3–6 entries/day; at that rate, a year of history is ~1,000–2,000 entries — well within the performance envelope of `tauri-plugin-store`. A future "Clear history" button can address long-term growth.

---

## UI

### Navigation

A third **History** tab is added to the header nav alongside Dashboard and Settings.

### History Page Layout

```
[ Claude ] [ ChatGPT ] [ Cursor ]     ← service tabs (only configured services)
[ Personal ] [ Work ]                  ← account tabs (only shown if >1 account)

[ 7d ] [ 30d ] [ All ]                ← time range selector

  ▓▓▓░  ▓▓░░  ▓▓▓▓  ▓░░░             ← grouped bar chart
  Mon   Tue   Wed   Thu               ← x-axis labels (auto granularity)

  ■ Current session  ■ Weekly         ← legend (one entry per usage window)
```

### Chart

- **Library:** Recharts
- **Type:** Grouped bar chart — one group per time bucket, one bar per usage window
- **Colors:** Service brand color (same palette used in Dashboard cards)
- **Granularity (auto):**
  - 7d → one group per day
  - 30d → one group per week (labeled by week start date, e.g. "Mar 10"); partial edge weeks at the boundary of the 30-day window are shown as-is with their start date — bar height reflects the raw usage % of whichever snapshot falls in that partial week
  - All → one group per month
- **Empty days:** Faint placeholder bar at 0% so the x-axis remains consistent
- **Y-axis:** 0–100% usage

### Service & Account Selection

- Service tabs show only configured services
- Account tabs appear below service tabs only when the selected service has more than one configured account

### Time Range

Three buttons: `7d` | `30d` | `All` — filters the snapshots passed to the chart.

---

## Files

| File | Change |
|---|---|
| `src/lib/history.ts` | New — `saveHistorySnapshot`, `loadHistory` |
| `src/pages/History.tsx` | New — full History page component |
| `src/pages/Dashboard.tsx` | Call `saveHistorySnapshot` after successful fetch |
| `src/App.tsx` | Add History tab to nav, render `<History />` page |
| `src-tauri/capabilities/*.json` | No changes needed (store plugin already permitted) |

### Dependencies

- `recharts` is already installed (`^3.8.0` in `package.json`) — no new dependency needed

---

## Edge Cases

- **No history yet:** Show an empty state — "No history yet. Usage is recorded once per day."
- **Service not configured:** Tab is hidden; no snapshots saved for that service
- **Account deleted:** Orphaned snapshots remain in storage but are never shown (accountId no longer matches any configured account)
- **Status not "ok":** Expired/error snapshots are not saved

---

## Out of Scope

- Exporting history (CSV, JSON)
- Clearing history (future "Clear history" button)
- Cross-device sync
- Aggregating multiple accounts into a single chart view
