import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { DonutChart } from "@/components/dashboard/DonutChart";
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
    <Card>
      <CardHeader className="pb-2 flex-row items-center space-y-0">
        <div className="flex items-center gap-2">
          <ServiceAvatar name={service.name} />
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
                          backgroundColor: usageBarColor(w.usedPercent, color),
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
