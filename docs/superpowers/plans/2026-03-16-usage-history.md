# Usage History Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a History tab to uso.ai that stores one daily usage snapshot per account and renders a grouped bar chart with 7d / 30d / All time ranges and per-service + per-account selection.

**Architecture:** A new `src/lib/history.ts` module handles all read/write to `history.json` via `tauri-plugin-store` (same pattern as `credentials.ts`). `Dashboard.tsx` calls `saveHistorySnapshot` after each successful fetch, using the `toFetch` array to supply `serviceId`. A new `src/pages/History.tsx` page reads history, filters by service/account/range, groups into time buckets, and renders a Recharts `BarChart`. `App.tsx` gains a third nav tab.

**Tech Stack:** `tauri-plugin-store`, `recharts` (already installed at ^3.8.0), React, TypeScript, Tailwind, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/history.ts` | **Create** | `HistorySnapshot` type, `loadHistory`, `saveHistorySnapshot` |
| `src/pages/History.tsx` | **Create** | History page — service/account/range selectors + chart |
| `src/pages/Dashboard.tsx` | **Modify** | Call `saveHistorySnapshot` after successful fetch |
| `src/App.tsx` | **Modify** | Add `"history"` page, History nav tab, render `<History />` |

---

## Task 1: History storage module

**Files:**
- Create: `src/lib/history.ts`

- [ ] **Step 1: Create `src/lib/history.ts`**

```ts
import { load } from "@tauri-apps/plugin-store";
import type { ServiceData } from "@/types";

export type HistorySnapshot = {
  timestamp: string;   // "YYYY-MM-DD"
  serviceId: string;   // "claude" | "chatgpt" | "cursor"
  accountId: string;
  data: ServiceData;
};

export async function loadHistory(): Promise<HistorySnapshot[]> {
  const store = await load("history.json", { autoSave: false, defaults: {} });
  return (await store.get<HistorySnapshot[]>("history")) ?? [];
}

export async function saveHistorySnapshot(
  serviceId: string,
  data: ServiceData
): Promise<void> {
  const store = await load("history.json", { autoSave: false, defaults: {} });
  const history = (await store.get<HistorySnapshot[]>("history")) ?? [];
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const exists = history.some(
    (s) =>
      s.timestamp === today &&
      s.serviceId === serviceId &&
      s.accountId === data.accountId
  );
  if (exists) return;

  history.push({ timestamp: today, serviceId, accountId: data.accountId, data });
  await store.set("history", history);
  await store.save();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: `✓ built` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/history.ts
git commit -m "feat: add history storage module (loadHistory, saveHistorySnapshot)"
```

---

## Task 2: Wire snapshot saving into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Import `saveHistorySnapshot`**

Add to the imports at the top of `src/pages/Dashboard.tsx`:

```ts
import { saveHistorySnapshot } from "@/lib/history";
```

- [ ] **Step 2: Call `saveHistorySnapshot` after successful fetch**

In `fetchAll`, find the block that sets services (after `setServices(...)`). Add the snapshot loop immediately after — it uses `settled` and `toFetch` which are still in scope:

```ts
setServices(results.filter((r): r is ServiceData => r !== null));
setLastUpdated(new Date());

// Save one snapshot per account per day (silently, non-blocking)
for (let i = 0; i < settled.length; i++) {
  const result = settled[i];
  if (result.status === "fulfilled" && result.value.status === "ok") {
    saveHistorySnapshot(toFetch[i].serviceId, result.value).catch(() => {});
  }
}
```

Note: `.catch(() => {})` ensures a storage failure never surfaces as a UI error.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: `✓ built` with no errors.

- [ ] **Step 4: Smoke test**

Run `npm run tauri dev`, open the app, trigger a refresh. Then check the store file exists:

```bash
ls ~/Library/Application\ Support/com.tauri.dev/history.json 2>/dev/null || \
ls ~/Library/Application\ Support/uso-ai/history.json 2>/dev/null || \
echo "check ~/Library/Application Support/ for history.json"
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: save daily usage snapshot after each successful fetch"
```

---

## Task 3: History page component

**Files:**
- Create: `src/pages/History.tsx`

This is the largest task. Build it in sub-steps.

### 3a — Data helpers

- [ ] **Step 1: Create `src/pages/History.tsx` with data-processing helpers only (no JSX yet)**

```ts
import { useState, useEffect } from "react";
import { loadHistory, type HistorySnapshot } from "@/lib/history";
import { SERVICES } from "@/lib/services";
import { loadCredentials } from "@/lib/credentials";

// ── Time range ────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "all";

function cutoffDate(range: Range): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "7d" ? 7 : 30));
  return d;
}

function filterByRange(snapshots: HistorySnapshot[], range: Range): HistorySnapshot[] {
  const cutoff = cutoffDate(range);
  if (!cutoff) return snapshots;
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return snapshots.filter((s) => s.timestamp >= cutoffStr);
}

// ── Time bucket ───────────────────────────────────────────────────────────────

// Parse "YYYY-MM-DD" as local midnight to avoid UTC off-by-one in non-UTC timezones
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function bucketKey(timestamp: string, range: Range): string {
  if (range === "7d") return timestamp; // "YYYY-MM-DD"
  if (range === "30d") {
    // ISO week start (Monday), using local date parsing
    const d = parseLocalDate(timestamp);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // all → "YYYY-MM"
  return timestamp.slice(0, 7);
}

function bucketLabel(key: string, range: Range): string {
  if (range === "7d") {
    return parseLocalDate(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  if (range === "30d") {
    return parseLocalDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  // all → "Mar 2026"
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Chart data ────────────────────────────────────────────────────────────────

type ChartRow = { bucket: string; [windowLabel: string]: number | string };

// Generate all expected bucket keys for the range (for placeholder bars)
function allBucketKeys(range: Range): string[] {
  if (range === "all") return []; // unbounded — no placeholders for "all"
  const days = range === "7d" ? 7 : 30;
  const keys = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    keys.add(bucketKey(ts, range));
  }
  return Array.from(keys).sort();
}

function buildChartData(
  snapshots: HistorySnapshot[],
  range: Range,
  knownWindowLabels: string[]
): ChartRow[] {
  // Group snapshots by bucket key, keeping the latest per bucket
  const byBucket = new Map<string, HistorySnapshot>();
  for (const s of snapshots) {
    const key = bucketKey(s.timestamp, range);
    const existing = byBucket.get(key);
    if (!existing || s.timestamp > existing.timestamp) {
      byBucket.set(key, s);
    }
  }

  // Fill in placeholder rows for empty buckets (7d/30d only)
  const placeholderKeys = allBucketKeys(range).filter((k) => !byBucket.has(k));
  const allKeys = [
    ...Array.from(byBucket.keys()),
    ...placeholderKeys,
  ].sort((a, b) => a.localeCompare(b));

  return allKeys.map((key) => {
    const snap = byBucket.get(key);
    const row: ChartRow = { bucket: bucketLabel(key, range) };
    for (const label of knownWindowLabels) {
      row[label] = snap ? (snap.data.windows.find((w) => w.label === label)?.usedPercent ?? 0) : 0;
    }
    return row;
  });
}

// Collect all unique window labels from a snapshot set
function windowLabels(snapshots: HistorySnapshot[]): string[] {
  const labels = new Set<string>();
  for (const s of snapshots) {
    for (const w of s.data.windows) labels.add(w.label);
  }
  return Array.from(labels);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ built`

### 3b — Component shell with selectors

- [ ] **Step 3: Add the component shell (state + service/account/range selectors) after the helpers**

```tsx
export default function History() {
  const [allSnapshots, setAllSnapshots] = useState<HistorySnapshot[]>([]);
  const [configuredServiceIds, setConfiguredServiceIds] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [range, setRange] = useState<Range>("7d");

  // Load history + configured services on mount
  useEffect(() => {
    Promise.all([loadHistory(), loadCredentials()]).then(([history, creds]) => {
      setAllSnapshots(history);
      const configured = SERVICES
        .filter((s) => (creds[s.id] ?? []).some((a) => Object.values(a.credentials).some((v) => v.trim())))
        .map((s) => s.id);
      setConfiguredServiceIds(configured);
      if (configured.length > 0 && !selectedService) {
        setSelectedService(configured[0]);
      }
    });
  }, []);

  // When service changes, default to first account
  useEffect(() => {
    if (!selectedService) return;
    const accountIds = [...new Set(
      allSnapshots.filter((s) => s.serviceId === selectedService).map((s) => s.accountId)
    )];
    setSelectedAccountId(accountIds[0] ?? "");
  }, [selectedService, allSnapshots]);

  // Derive chart data
  const serviceSnapshots = allSnapshots.filter(
    (s) => s.serviceId === selectedService && s.accountId === selectedAccountId
  );
  const rangeFiltered = filterByRange(serviceSnapshots, range);
  const windowKeys = windowLabels(rangeFiltered);
  const chartData = buildChartData(rangeFiltered, range, windowKeys);

  // Account tabs: only show if >1 account has snapshots for this service
  const accountIds = [...new Set(
    allSnapshots.filter((s) => s.serviceId === selectedService).map((s) => s.accountId)
  )];
  const showAccountTabs = accountIds.length > 1;

  const serviceColor = SERVICES.find((s) => s.id === selectedService)?.color ?? "#888";

  return (
    <div className="space-y-3">
      {/* Service tabs */}
      <div className="flex gap-1">
        {configuredServiceIds.map((id) => {
          const svc = SERVICES.find((s) => s.id === id)!;
          return (
            <button
              key={id}
              onClick={() => setSelectedService(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedService === id
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={selectedService === id ? { backgroundColor: serviceColor } : {}}
            >
              {svc.name}
            </button>
          );
        })}
      </div>

      {/* Account tabs (only if >1 account) */}
      {showAccountTabs && (
        <div className="flex gap-1">
          {accountIds.map((id) => {
            const label = allSnapshots.find(
              (s) => s.serviceId === selectedService && s.accountId === id
            )?.data.label ?? id.slice(0, 8);
            return (
              <button
                key={id}
                onClick={() => setSelectedAccountId(id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedAccountId === id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Time range selector */}
      <div className="flex gap-1">
        {(["7d", "30d", "all"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              range === r
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r === "all" ? "All" : r}
          </button>
        ))}
      </div>

      {/* Chart or empty state */}
      {chartData.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          No history yet. Usage is recorded once per day.
        </p>
      ) : (
        <HistoryChart
          data={chartData}
          windowKeys={windowKeys}
          color={serviceColor}
        />
      )}
    </div>
  );
}
```

### 3c — Chart sub-component

- [ ] **Step 5: Add the `HistoryChart` component above `export default function History()`**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Slightly lighter shade for secondary bars
function lighten(hex: string, amount = 0.35): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + 255 * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + 255 * amount));
  const b = Math.min(255, Math.round((num & 0xff) + 255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function HistoryChart({
  data,
  windowKeys,
  color,
}: {
  data: ChartRow[];
  windowKeys: string[];
  color: string;
}) {
  const colors = [color, lighten(color)];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number, name: string) => [`${value}%`, name]}
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
        />
        {windowKeys.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
        )}
        {windowKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: `✓ built` with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/History.tsx
git commit -m "feat: add History page with bar chart, service/account/range selectors"
```

---

## Task 4: Wire History tab into App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add History import and update Page type**

At the top of `src/App.tsx`, add:

```ts
import History from "@/pages/History";
import { History as HistoryIcon } from "lucide-react";
```

Change the `Page` type:

```ts
type Page = "dashboard" | "settings" | "history";
```

- [ ] **Step 2: Add History nav button**

In the header nav (after the Settings button), add:

```tsx
<button
  onClick={() => setPage("history")}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
    page === "history"
      ? "text-white"
      : "text-muted-foreground hover:text-foreground"
  }`}
  style={page === "history" ? { backgroundColor: "#1a1a1a" } : {}}
  title="History"
>
  <HistoryIcon size={13} />
  History
</button>
```

- [ ] **Step 3: Render History page**

In the page content section, update the conditional render:

```tsx
{page === "dashboard" ? (
  <Dashboard onNavigateToSettings={() => setPage("settings")} />
) : page === "settings" ? (
  <Settings onSaved={() => setPage("dashboard")} />
) : (
  <History />
)}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: `✓ built` with no errors.

- [ ] **Step 5: Smoke test**

```bash
npm run tauri dev
```

- Open the app — verify three nav tabs: Dashboard, Settings, History
- Click History — should show "No history yet" if no snapshots exist, or a chart if snapshots were saved in Task 2
- Trigger a refresh from Dashboard, then return to History — a snapshot should appear
- Try switching services, time ranges

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add History tab to app navigation"
```

---

## Task 5: Final check and PR

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 2: Push and open PR**

```bash
git push
gh pr create --title "feat: usage history tab with daily snapshots and bar chart" \
  --body "Adds a History tab that records one daily usage snapshot per account and renders a grouped bar chart. Service/account/range selectors. No new dependencies — recharts was already installed."
```
