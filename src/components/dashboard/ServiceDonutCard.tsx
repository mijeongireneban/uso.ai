import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { getServiceByName } from "@/lib/services";
import type { OperationalStatus, ServiceData } from "@/types";

type Props = { service: ServiceData; onSettings?: () => void };

function usageBarColor(percent: number, fallback: string): string {
  if (percent >= 90) return "#ef4444";
  if (percent >= 60) return "#eab308";
  return fallback;
}

// Hoisted module-level to avoid re-creating per render.
const OPERATIONAL_META: Record<
  Exclude<OperationalStatus, "unknown">,
  { color: string; label: string }
> = {
  operational: { color: "#22c55e", label: "Operational" },
  degraded: { color: "#eab308", label: "Degraded performance" },
  outage: { color: "#ef4444", label: "Outage" },
};

function StatusDot({ status }: { status: OperationalStatus }) {
  if (status === "unknown") return null;
  const { color, label } = OPERATIONAL_META[status];
  return (
    <span
      title={label}
      aria-label={`Service status: ${label}`}
      className="inline-block size-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function ServiceDonutCard({ service, onSettings }: Props) {
  const color = getServiceByName(service.name)?.color ?? "#888";
  const isExpired = service.status === "expired";
  const isError = service.status === "error";

  return (
    <Card className="relative">
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {service.operational && <StatusDot status={service.operational} />}
        <Badge variant="outline" className="text-xs font-normal">{service.plan}</Badge>
      </div>
      <CardHeader className="px-4 pt-3 pb-2 flex-row items-center space-y-0">
        <div className="flex items-center gap-2">
          <ServiceAvatar name={service.name} />
          <div>
            <CardTitle className="text-sm font-medium">
              {service.label ? `${service.name} · ${service.label}` : service.name}
            </CardTitle>
            {service.email && (
              <p className="text-xs text-muted-foreground">{service.email}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        {isExpired || isError ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
            <AlertTriangle size={13} className="text-yellow-500 shrink-0" />
            <span>{isExpired ? "Token expired" : "Fetch failed"}</span>
            {isExpired && onSettings && (
              <button onClick={onSettings} className="ml-auto underline hover:text-foreground transition-colors">
                Fix
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {service.windows.map((w, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{w.label}</span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-foreground">{w.usedPercent}%</span>
                    <span className="text-muted-foreground/50">· {w.resetsAt}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(w.usedPercent, 100)}%`,
                      backgroundColor: usageBarColor(w.usedPercent, color),
                    }}
                  />
                </div>
              </div>
            ))}
            {service.extraUsage && (() => {
              const { usedDollars, monthlyLimitDollars } = service.extraUsage;
              const pct =
                monthlyLimitDollars > 0
                  ? Math.round((usedDollars / monthlyLimitDollars) * 100)
                  : 0;
              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Extra usage</span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-foreground">
                        ${usedDollars.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground/50">
                        · of ${monthlyLimitDollars.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: usageBarColor(pct, color),
                      }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
