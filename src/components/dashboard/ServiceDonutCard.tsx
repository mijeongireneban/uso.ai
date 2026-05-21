import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { getServiceByName } from "@/lib/services";
import type { OperationalStatus, ServiceData } from "@/types";

type Props = { service: ServiceData; onSettings?: (serviceId?: string) => void };

function usageBarColor(percent: number, fallback: string): string {
  if (percent >= 90) return "var(--destructive)";
  if (percent >= 75) return "var(--warn)";
  return fallback;
}

// Map operational status to the corner-dot variant class.
const OPERATIONAL_DOT_CLASS: Record<Exclude<OperationalStatus, "unknown">, string> = {
  operational: "",
  degraded: "warn",
  outage: "danger",
};

function CornerDot({ operational, accountStatus }: { operational?: OperationalStatus; accountStatus: ServiceData["status"] }) {
  // Account errors (expired/error) dominate over operational status — the user
  // can't see usage at all in that state, so warn is more important than the
  // provider's status page.
  if (accountStatus === "expired" || accountStatus === "error") {
    return <span className="dot warn" />;
  }
  if (!operational || operational === "unknown") {
    return <span className="dot" />;
  }
  const variant = OPERATIONAL_DOT_CLASS[operational];
  return <span className={`dot ${variant}`.trim()} />;
}

export function ServiceDonutCard({ service, onSettings }: Props) {
  const serviceConfig = getServiceByName(service.name);
  const color = serviceConfig?.color ?? "var(--accent)";
  const isExpired = service.status === "expired";
  const isError = service.status === "error";

  return (
    <Card className="relative p-4 gap-3">
      <span className="absolute top-3 right-3">
        <CornerDot operational={service.operational} accountStatus={service.status} />
      </span>

      <div className="flex items-center gap-2.5 pr-6">
        <div className="prov-logo" style={{ background: `${color}22` }}>
          <ServiceAvatar name={service.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold tracking-tight truncate">
              {service.label ? `${service.name} · ${service.label}` : service.name}
            </p>
            {service.plan && (
              <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5 rounded-full">
                {service.plan}
              </Badge>
            )}
          </div>
          {service.email && (
            <p className="text-[11px] font-mono text-muted-foreground/80 truncate mt-0.5">
              {service.email}
            </p>
          )}
        </div>
      </div>

      {isExpired || isError ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle size={13} className="text-[var(--warn)] shrink-0" />
          <span>{isExpired ? "Token expired" : "Fetch failed"}</span>
          {isExpired && onSettings && (
            <button
              onClick={() => onSettings(serviceConfig?.id)}
              className="ml-auto underline hover:text-foreground transition-colors"
            >
              Fix
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {service.windows.map((w, i) => {
            const pct = Math.min(100, w.usedPercent);
            const displayPct = pct < 1 && pct > 0 ? "<1%" : `${Math.round(pct)}%`;
            const barColor = usageBarColor(pct, color);
            return (
              <div key={i} className="limit">
                <div className="limit-label">{w.label}</div>
                <div className="limit-value">
                  {displayPct}
                  {w.resetsAt && w.resetsAt !== "—" && (
                    <span className="ts">· {w.resetsAt}</span>
                  )}
                </div>
                <div className="limit-bar">
                  <span
                    style={{
                      width: `${Math.max(pct, w.usedPercent > 0 ? 2 : 0)}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {service.extraUsage && (() => {
            const { usedDollars, monthlyLimitDollars } = service.extraUsage;
            const pct =
              monthlyLimitDollars > 0
                ? Math.min(100, (usedDollars / monthlyLimitDollars) * 100)
                : 0;
            return (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 mt-0.5 border-t border-border">
                <span>Extra usage</span>
                <span>
                  <span className="font-mono font-medium text-foreground">
                    ${usedDollars.toFixed(2)}
                  </span>
                  <span className="text-[var(--text-dim)]">
                    {" "}· of ${monthlyLimitDollars.toFixed(2)}
                    {monthlyLimitDollars > 0 && (
                      <>{" "}({Math.round(pct)}%)</>
                    )}
                  </span>
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </Card>
  );
}
