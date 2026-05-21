import { useState, useEffect } from "react";
import { loadHistory, type HistorySnapshot } from "@/lib/history";
import { SERVICES } from "@/lib/services";
import { loadCredentials } from "@/lib/credentials";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// ── Time range ────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "all";

function cutoffDate(range: Range): string | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "7d" ? 7 : 30));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function filterByRange(snapshots: HistorySnapshot[], range: Range): HistorySnapshot[] {
  const cutoff = cutoffDate(range);
  if (!cutoff) return snapshots;
  return snapshots.filter((s) => s.timestamp >= cutoff);
}

// ── Time bucket ───────────────────────────────────────────────────────────────

// Parse "YYYY-MM-DD" as local midnight to avoid UTC off-by-one in non-UTC timezones
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function bucketKey(timestamp: string, range: Range): string {
  if (range === "7d") return timestamp;
  if (range === "30d") {
    const d = parseLocalDate(timestamp);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return timestamp.slice(0, 7);
}

function bucketLabel(key: string, range: Range): string {
  if (range === "7d") {
    return parseLocalDate(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  if (range === "30d") {
    return parseLocalDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Chart data ────────────────────────────────────────────────────────────────

type ChartRow = { bucket: string; [windowLabel: string]: number | string };

function allBucketKeys(range: Range): string[] {
  if (range === "all") return [];
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
  const byBucket = new Map<string, HistorySnapshot>();
  for (const s of snapshots) {
    const key = bucketKey(s.timestamp, range);
    const existing = byBucket.get(key);
    if (!existing || s.timestamp > existing.timestamp) {
      byBucket.set(key, s);
    }
  }

  const placeholderKeys = allBucketKeys(range).filter((k) => !byBucket.has(k));
  const allKeys = [...Array.from(byBucket.keys()), ...placeholderKeys].sort((a, b) =>
    a.localeCompare(b)
  );

  return allKeys.map((key) => {
    const snap = byBucket.get(key);
    const row: ChartRow = { bucket: bucketLabel(key, range) };
    for (const label of knownWindowLabels) {
      row[label] = snap ? (snap.data.windows.find((w) => w.label === label)?.usedPercent ?? 0) : 0;
    }
    return row;
  });
}

function windowLabels(snapshots: HistorySnapshot[]): string[] {
  const labels = new Set<string>();
  for (const s of snapshots) {
    for (const w of s.data.windows) labels.add(w.label);
  }
  return Array.from(labels);
}

// ── Chart component ───────────────────────────────────────────────────────────

/**
 * The design uses the accent color for the primary series and the success
 * color at 65% opacity for the secondary series — applied via series index,
 * not service color. This matches the Claude Design `UsageChart` exactly.
 */
const SERIES_FILLS = [
  { fill: "var(--accent)", opacity: 1 },
  { fill: "var(--success)", opacity: 0.65 },
  { fill: "var(--warn)", opacity: 0.85 },
  { fill: "var(--destructive)", opacity: 0.7 },
];

function HistoryChart({
  data,
  windowKeys,
}: {
  data: ChartRow[];
  windowKeys: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} barCategoryGap="22%" barGap={2} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" opacity={0.55} vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 9, fontFamily: "var(--font-mono)", fill: "var(--text-dim)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          domain={[0, "auto"]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 9, fontFamily: "var(--font-mono)", fill: "var(--text-dim)" }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
          contentStyle={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            borderRadius: 6,
            backgroundColor: "var(--surface-3)",
            border: "1px solid var(--border-hi)",
            color: "var(--foreground)",
            boxShadow: "var(--shadow-md)",
            padding: "5px 8px",
          }}
          cursor={{ fill: "var(--accent-soft)" }}
        />
        {windowKeys.length > 1 && (
          <Legend
            wrapperStyle={{
              fontSize: 10.5,
              paddingTop: 8,
              fontFamily: "var(--font-sans)",
              color: "var(--muted-foreground)",
            }}
            iconType="square"
            iconSize={9}
          />
        )}
        {windowKeys.map((key, i) => {
          const { fill, opacity } = SERIES_FILLS[i % SERIES_FILLS.length];
          return (
            <Bar
              key={key}
              dataKey={key}
              fill={fill}
              fillOpacity={opacity}
              radius={[1, 1, 0, 0]}
              maxBarSize={6}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function History() {
  const [allSnapshots, setAllSnapshots] = useState<HistorySnapshot[]>([]);
  const [configuredServiceIds, setConfiguredServiceIds] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [range, setRange] = useState<Range>("7d");

  useEffect(() => {
    Promise.all([loadHistory(), loadCredentials()]).then(([history, creds]) => {
      setAllSnapshots(history);
      const configured = SERVICES.filter((s) =>
        (creds[s.id] ?? []).some((a) =>
          Object.values(a.credentials).some((v) => v.trim())
        )
      ).map((s) => s.id);
      setConfiguredServiceIds(configured);
      setSelectedService((prev) => (prev || configured[0] || ""));
    });
  }, []);

  useEffect(() => {
    if (!selectedService) return;
    const ids = [
      ...new Set(
        allSnapshots.filter((s) => s.serviceId === selectedService).map((s) => s.accountId)
      ),
    ];
    setSelectedAccountId(ids[0] ?? "");
  }, [selectedService, allSnapshots]);

  const serviceSnapshots = allSnapshots.filter(
    (s) => s.serviceId === selectedService && s.accountId === selectedAccountId
  );
  const rangeFiltered = filterByRange(serviceSnapshots, range);
  const windowKeys = windowLabels(rangeFiltered);
  const chartData = buildChartData(rangeFiltered, range, windowKeys);

  const accountIds = [
    ...new Set(
      allSnapshots.filter((s) => s.serviceId === selectedService).map((s) => s.accountId)
    ),
  ];
  const showAccountTabs = accountIds.length > 1;
  const showServiceTabs = configuredServiceIds.length > 1;

  const rangeSubtitle =
    range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "All time";

  return (
    <div className="space-y-3">
      {/* Service tabs — only when multiple providers are configured. Design's
          mock shows a single provider; we add this affordance so users can
          switch focus. Kept small and chip-styled to match the chip-strip
          elsewhere on the dashboard. */}
      {showServiceTabs && (
        <div className="flex gap-1.5 flex-wrap">
          {configuredServiceIds.map((id) => {
            const svc = SERVICES.find((s) => s.id === id)!;
            const active = selectedService === id;
            return (
              <button
                key={id}
                type="button"
                className="chip"
                data-active={active}
                onClick={() => setSelectedService(id)}
              >
                <span className="swatch" style={{ background: svc.color }} />
                {svc.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Chart card — matches design's `.card` wrapper with the Usage title +
          segmented control header. */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground leading-tight">
              Usage
            </h3>
            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-0.5 truncate">
              {rangeSubtitle} · % of weekly limit
            </p>
          </div>
          <div className="seg-control" role="tablist" aria-label="Range">
            {(["7d", "30d", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                data-active={range === r}
                onClick={() => setRange(r)}
              >
                {r === "all" ? "All" : r}
              </button>
            ))}
          </div>
        </div>

        {/* Account tabs — only when one service has multiple accounts. */}
        {showAccountTabs && (
          <div className="flex gap-1 flex-wrap mt-2 mb-1">
            {accountIds.map((id) => {
              const label =
                allSnapshots.find((s) => s.serviceId === selectedService && s.accountId === id)?.data
                  .label ?? id.slice(0, 8);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedAccountId(id)}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium transition-colors ${
                    selectedAccountId === id
                      ? "bg-[var(--surface-2)] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]/60"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Chart or empty state */}
        {chartData.length === 0 || windowKeys.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-10">
            No history yet. Usage is recorded once per day.
          </p>
        ) : (
          <div className="mt-2">
            <HistoryChart data={chartData} windowKeys={windowKeys} />
          </div>
        )}
      </div>
    </div>
  );
}
