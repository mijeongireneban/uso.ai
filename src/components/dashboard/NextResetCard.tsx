import { Card, CardContent } from "@/components/ui/card";
import { getServiceByName } from "@/lib/services";
import type { ServiceData } from "@/types";

export function NextResetCard({ service }: { service: ServiceData }) {
  const color = getServiceByName(service.name)?.color ?? "#888";
  const soonest = service.windows[0] ?? null;

  return (
    <Card className="flex-1">
      <CardContent className="p-4">
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
