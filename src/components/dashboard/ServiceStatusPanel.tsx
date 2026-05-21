import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { SERVICES } from "@/lib/services";
import type { OperationalStatus, ServiceStatusInfo } from "@/types";

// Hoisted module-level so the row renderer doesn't rebuild it each render.
const STATUS_META: Record<OperationalStatus, { variant: string; label: string }> = {
  operational: { variant: "",       label: "All systems operational" },
  degraded:    { variant: "warn",   label: "Degraded performance" },
  outage:      { variant: "danger", label: "Service outage" },
  unknown:     { variant: "mute",   label: "Status unavailable" },
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
    <div className="status-list">
      {rows.map(({ id, service, info }) => {
        const meta = STATUS_META[info.status];
        return (
          <button
            key={id}
            type="button"
            onClick={() => openUrl(info.page).catch(() => {})}
            aria-label={`Open ${service.name} status page`}
            className="status-row group hover:bg-[var(--surface-2)] transition-colors text-left w-full"
          >
            <ServiceAvatar name={service.name} size="sm" />
            <span className="name">{service.name}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`dot ${meta.variant}`} />
              <span className="truncate max-w-[180px]">{info.description ?? meta.label}</span>
              <ExternalLink
                size={11}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[var(--text-dim)]"
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
