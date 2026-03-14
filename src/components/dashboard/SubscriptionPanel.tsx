import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import type { ServiceData } from "@/types";

export function SubscriptionPanel({ services }: { services: ServiceData[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Subscriptions
      </h2>
      {services.map((s) => {
        const isOk = s.status === "ok";
        return (
          <Card key={s.name}>
            <CardContent className="px-4 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ServiceAvatar name={s.name} />
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <Badge variant={isOk ? "secondary" : "destructive"} className="text-xs">
                  {s.plan}
                </Badge>
              </div>
              {isOk
                ? s.windows.map((w, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{w.label}</span>
                      <span className="font-medium text-foreground">{w.usedPercent}% used</span>
                    </div>
                  ))
                : (
                    <p className="text-xs text-muted-foreground">
                      {s.status === "expired" ? "Token expired" : s.status === "error" ? "Fetch failed" : "—"}
                    </p>
                  )
              }
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
