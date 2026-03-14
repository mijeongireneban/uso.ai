import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { getServiceByName } from "@/lib/services";
import type { ServiceData } from "@/types";

type Props = { service: ServiceData; onSettings?: () => void };

function usageBarColor(percent: number, fallback: string): string {
  if (percent >= 90) return "#ef4444";
  if (percent >= 60) return "#eab308";
  return fallback;
}

export function ServiceDonutCard({ service, onSettings }: Props) {
  const color = getServiceByName(service.name)?.color ?? "#888";
  const isExpired = service.status === "expired";
  const isError = service.status === "error";

  return (
    <Card className="relative">
      <Badge variant="outline" className="absolute top-3 right-3 text-xs font-normal">{service.plan}</Badge>
      <CardHeader className="px-4 pt-3 pb-2 flex-row items-center space-y-0">
        <div className="flex items-center gap-2">
          <ServiceAvatar name={service.name} />
          <div>
            <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
