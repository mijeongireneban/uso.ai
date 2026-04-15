import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card, CardContent } from "@/components/ui/card";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { SERVICES } from "@/lib/services";
import type { OperationalStatus, ServiceStatusInfo } from "@/types";

// Hoisted module-level so the row renderer doesn't rebuild it each render.
const STATUS_META: Record<OperationalStatus, { color: string; label: string }> = {
  operational: { color: "#10b981", label: "All systems operational" },  // Linear Emerald
  degraded: { color: "#f5a524", label: "Degraded performance" },
  outage: { color: "#e5484d", label: "Service outage" },
  unknown: { color: "#62666d", label: "Status unavailable" },          // Linear Quaternary
};

type Props = {
  /** Service ids the user has integrated (Claude/ChatGPT/Cursor/Gemini). */
  integratedServiceIds: string[];
  /** Status info keyed by service id — from fetchAllOperationalStatuses. */
  statusByService: Record<string, ServiceStatusInfo>;
};

export function ServiceStatusPanel({ integratedServiceIds, statusByService }: Props) {
  // Only render a row per service that (a) the user has integrated AND (b) we
  // have a status page for. Deduped so multi-account users see one row each.
  const rows = Array.from(new Set(integratedServiceIds))
    .map((id) => {
      const service = SERVICES.find((s) => s.id === id);
      const info = statusByService[id];
      if (!service || !info) return null;
      return { id, service, info };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border/50">
          {rows.map(({ id, service, info }) => {
            const meta = STATUS_META[info.status];
            return (
              <button
                key={id}
                onClick={() => openUrl(info.page).catch(() => {})}
                aria-label={`Open ${service.name} status page`}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/60 transition-colors text-left group"
              >
                <ServiceAvatar name={service.name} size="sm" />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm font-medium shrink-0">{service.name}</span>
                  <span
                    className="inline-block size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {info.description ?? meta.label}
                  </span>
                </div>
                <ExternalLink
                  size={12}
                  className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0"
                />
              </button>
            );
          })}
      </CardContent>
    </Card>
  );
}
