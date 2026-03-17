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
        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
          contentStyle={{
            fontSize: 11,
            borderRadius: 8,
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        />
        {windowKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />}
        {windowKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
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
  const serviceColor = SERVICES.find((s) => s.id === selectedService)?.color ?? "#888";

  return (
    <div className="space-y-3">
      {/* Service tabs */}
      <div className="flex gap-1 flex-wrap">
        {configuredServiceIds.map((id) => {
          const svc = SERVICES.find((s) => s.id === id)!;
          const color = SERVICES.find((s) => s.id === id)?.color ?? "#888";
          return (
            <button
              key={id}
              onClick={() => setSelectedService(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedService === id ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={selectedService === id ? { backgroundColor: color } : {}}
            >
              {svc.name}
            </button>
          );
        })}
      </div>

      {/* Account tabs */}
      {showAccountTabs && (
        <div className="flex gap-1 flex-wrap">
          {accountIds.map((id) => {
            const label =
              allSnapshots.find((s) => s.serviceId === selectedService && s.accountId === id)?.data
                .label ?? id.slice(0, 8);
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

      {/* Time range */}
      <div className="flex gap-1">
        {(["7d", "30d", "all"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r === "all" ? "All" : r}
          </button>
        ))}
      </div>

      {/* Chart or empty state */}
      {chartData.length === 0 || windowKeys.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          No history yet. Usage is recorded once per day.
        </p>
      ) : (
        <HistoryChart data={chartData} windowKeys={windowKeys} color={serviceColor} />
      )}
    </div>
  );
}
