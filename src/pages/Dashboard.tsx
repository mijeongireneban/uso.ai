import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import claudeLogo from "@/assets/claude.png";
import chatgptLogo from "@/assets/chatgpt.png";
import cursorLogo from "@/assets/cursor.png";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { loadCredentials } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import type { ServiceData } from "@/types";

const SERVICE_COLORS: Record<string, string> = {
  Claude: "#cc785c",
  ChatGPT: "#19c37d",
  Cursor: "#6e7bff",
};

const SERVICE_LOGOS: Record<string, string> = {
  Claude: claudeLogo,
  ChatGPT: chatgptLogo,
  Cursor: cursorLogo,
};

const TRACK_COLOR = "#e8e6e3";

type Props = { onNavigateToSettings?: () => void };

function DonutChart({ usedPercent, color }: { usedPercent: number; color: string }) {
  const data = [
    { value: usedPercent },
    { value: Math.max(0, 100 - usedPercent) },
  ];
  return (
    <ResponsiveContainer width={120} height={120}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={38}
          outerRadius={52}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          strokeWidth={0}
        >
          <Cell fill={usedPercent > 0 ? color : TRACK_COLOR} />
          <Cell fill={TRACK_COLOR} />
        </Pie>
        <Tooltip formatter={(v: number) => [`${v}%`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function NextResetCard({ service }: { service: ServiceData }) {
  const color = SERVICE_COLORS[service.name] ?? "#888";
  const soonest = service.windows.length > 0 ? service.windows[0] : null;

  return (
    <Card className="flex-1">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-1">Next reset · {service.name}</p>
        <p className="text-lg font-semibold" style={{ color }}>
          {soonest ? soonest.resetsAt : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {soonest ? soonest.label : "No data"}
        </p>
      </CardContent>
    </Card>
  );
}

function ServiceDonutCard({ service, onSettings }: { service: ServiceData; onSettings?: () => void }) {
  const color = SERVICE_COLORS[service.name] ?? "#888";
  const isExpired = service.status === "expired";
  const isError = service.status === "error";

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Avatar className="w-5 h-5 rounded-md">
            <AvatarImage src={SERVICE_LOGOS[service.name]} alt={service.name} className="object-contain p-0.5" />
            <AvatarFallback className="rounded-md text-white text-xs font-bold" style={{ backgroundColor: color }}>
              {service.name[0]}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isExpired || isError ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <AlertTriangle size={13} className="text-yellow-500 shrink-0" />
            <span>{isExpired ? "Token expired" : "Fetch failed"}</span>
            {isExpired && onSettings && (
              <button onClick={onSettings} className="ml-auto underline hover:text-foreground transition-colors">
                Fix
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {service.windows.map((w, i) => (
              <div key={i}>
                {i > 0 && <Separator className="my-2" />}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <DonutChart usedPercent={w.usedPercent} color={color} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-semibold">{w.usedPercent}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{w.label}</p>
                    <p className="text-xs">Resets <span className="font-medium text-foreground">{w.resetsAt}</span></p>
                    <div className="mt-2 h-1.5 w-32 rounded-full overflow-hidden bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(w.usedPercent, 100)}%`,
                          backgroundColor:
                            w.usedPercent >= 90 ? "#ef4444"
                            : w.usedPercent >= 60 ? "#eab308"
                            : color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionPanel({ services }: { services: ServiceData[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Subscriptions
      </h2>
      {services.map((s) => {
        const color = SERVICE_COLORS[s.name] ?? "#888";
        const isOk = s.status === "ok";
        return (
          <Card key={s.name}>
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="w-5 h-5 rounded-md">
                    <AvatarImage src={SERVICE_LOGOS[s.name]} alt={s.name} className="object-contain p-0.5" />
                    <AvatarFallback className="rounded-md text-white text-xs font-bold" style={{ backgroundColor: color }}>
                      {s.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <Badge variant={isOk ? "secondary" : "destructive"} className="text-xs">
                  {s.plan}
                </Badge>
              </div>
              {isOk && s.windows.map((w, i) => (
                <div key={i} className="flex justify-between text-xs text-muted-foreground">
                  <span>{w.label}</span>
                  <span className="font-medium text-foreground">{w.usedPercent}% used</span>
                </div>
              ))}
              {!isOk && (
                <p className="text-xs text-muted-foreground">
                  {s.status === "expired" ? "Token expired" : s.status === "error" ? "Fetch failed" : "—"}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="h-3 w-20 bg-secondary rounded animate-pulse" />
        <div className="flex items-center gap-4">
          <div className="w-[120px] h-[120px] rounded-full bg-secondary animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 bg-secondary rounded animate-pulse" />
            <div className="h-3 w-16 bg-secondary rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard({ onNavigateToSettings }: Props) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const creds = await loadCredentials();
      const results = await Promise.all([
        creds.claude?.orgId && creds.claude?.sessionKey
          ? fetchClaudeUsage(creds.claude.orgId, creds.claude.sessionKey)
          : null,
        creds.chatgpt?.bearerToken
          ? fetchChatGPTUsage(creds.chatgpt.bearerToken)
          : null,
        creds.cursor?.sessionToken
          ? fetchCursorUsage(creds.cursor.sessionToken)
          : null,
      ]);
      setServices(results.filter((r): r is ServiceData => r !== null));
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch usage data", e);
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  function formatLastUpdated(date: Date): string {
    const diff = Math.round((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    return `${Math.round(diff / 60)}m ago`;
  }

  const configuredServices = services;

  return (
    <div className="space-y-5">
      {/* Refresh row */}
      <div className="flex items-center justify-between">
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Updated {formatLastUpdated(lastUpdated)}
          </p>
        )}
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-auto"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {fetchError && (
        <p className="text-xs text-red-500 text-center">{fetchError}</p>
      )}

      {!loading && configuredServices.length === 0 && !fetchError && (
        <p className="text-center text-sm text-muted-foreground py-12">
          No services configured.{" "}
          <button onClick={onNavigateToSettings} className="underline hover:text-foreground transition-colors">
            Add credentials in Settings.
          </button>
        </p>
      )}

      {configuredServices.length > 0 && (
        <>
          {/* Next reset stat cards */}
          <div className="flex gap-3">
            {configuredServices.filter(s => s.status === "ok").map((s) => (
              <NextResetCard key={s.name} service={s} />
            ))}
          </div>

          {/* Main content: charts + sidebar */}
          <div className="flex gap-4">
            {/* Left: donut charts */}
            <div className="flex-1 space-y-3 min-w-0">
              {loading && configuredServices.length === 0 ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                configuredServices.map((s) => (
                  <ServiceDonutCard
                    key={s.name}
                    service={s}
                    onSettings={onNavigateToSettings}
                  />
                ))
              )}
            </div>

            {/* Right: subscription panel */}
            <div className="w-56 shrink-0">
              <SubscriptionPanel services={configuredServices} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
