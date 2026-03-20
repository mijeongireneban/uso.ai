import { Card, CardContent } from "@/components/ui/card";
import { getServiceByName } from "@/lib/services";
import type { ServiceData } from "@/types";

export function NextResetCard({ service }: { service: ServiceData }) {
  const color = getServiceByName(service.name)?.color ?? "#888";
  const soonest = service.windows.find((w) => w.resetsAt !== "—") ?? service.windows[0] ?? null;

  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="px-3 py-3">
        <p className="text-xs text-muted-foreground mb-1 truncate">
          Next reset · {service.label ? `${service.name} · ${service.label}` : service.name}
        </p>
        <p className="text-base font-semibold leading-tight truncate" style={{ color }}>
          {soonest ? soonest.resetsAt : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {soonest ? soonest.label : "No data"}
        </p>
      </CardContent>
    </Card>
  );
}
