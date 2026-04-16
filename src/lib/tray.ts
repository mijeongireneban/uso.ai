import { invoke } from "@tauri-apps/api/core";
import type { ServiceData } from "@/types";

export type TrayLevel = "normal" | "warning" | "critical";

// Warning at 60% matches the amber threshold of usageBarColor() in
// ServiceDonutCard.tsx so the menu bar and the dashboard agree on when a
// service is "approaching" a limit. Critical is set slightly below the
// dashboard's 90% red so the tray nudges the user before the card does.
const WARNING_THRESHOLD = 60;
const CRITICAL_THRESHOLD = 80;

/**
 * Return the highest usage percentage observed across all "ok" services,
 * covering both per-window usedPercent and metered top-up spend
 * (extraUsage). Returns 0 when there's nothing to report.
 */
export function maxUsagePercent(services: ServiceData[]): number {
  let max = 0;
  for (const service of services) {
    if (service.status !== "ok") continue;
    for (const window of service.windows) {
      if (window.usedPercent > max) max = window.usedPercent;
    }
    const extra = service.extraUsage;
    if (extra && extra.monthlyLimitDollars > 0) {
      const pct = (extra.usedDollars / extra.monthlyLimitDollars) * 100;
      if (pct > max) max = pct;
    }
  }
  return max;
}

export function trayLevelFor(maxPercent: number): TrayLevel {
  if (maxPercent >= CRITICAL_THRESHOLD) return "critical";
  if (maxPercent >= WARNING_THRESHOLD) return "warning";
  return "normal";
}

export async function setTrayStatus(level: TrayLevel): Promise<void> {
  try {
    await invoke("set_tray_status", { level });
  } catch (err) {
    console.warn("set_tray_status failed", err);
  }
}
