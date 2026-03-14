import { fetch } from "@tauri-apps/plugin-http";
import type { ServiceData } from "@/types";

type ClaudeUsageResponse = {
  five_hour: { utilization: number; resets_at: string } | null;
  seven_day: { utilization: number; resets_at: string } | null;
};

function formatResetTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 360) {
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayDiff = Math.floor(diffMs / 86400000);
  if (dayDiff === 0) return `today ${timeStr}`;
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayName} ${timeStr}`;
}

async function fetchClaudeEmail(sessionKey: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://claude.ai/api/me", {
      method: "GET",
      headers: { Cookie: `sessionKey=${sessionKey}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchClaudeUsage(
  orgId: string,
  sessionKey: string
): Promise<ServiceData> {
  const res = await fetch(
    `https://claude.ai/api/organizations/${orgId}/usage`,
    {
      method: "GET",
      headers: {
        Cookie: `sessionKey=${sessionKey}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    return { name: "Claude", plan: "Pro", status: "expired", windows: [] };
  }
  if (!res.ok) {
    return { name: "Claude", plan: "Pro", status: "error", windows: [] };
  }

  const data = (await res.json()) as ClaudeUsageResponse;
const windows = [];

  if (data.five_hour) {
    windows.push({
      label: "Current session",
      usedPercent: Math.round(data.five_hour.utilization),
      resetsAt: formatResetTime(data.five_hour.resets_at),
    });
  }
  if (data.seven_day) {
    windows.push({
      label: "Weekly",
      usedPercent: Math.round(data.seven_day.utilization),
      resetsAt: formatResetTime(data.seven_day.resets_at),
    });
  }

  const email = await fetchClaudeEmail(sessionKey);
  return { name: "Claude", plan: "Pro", status: "ok", windows, email };
}
