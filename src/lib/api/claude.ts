import { fetch } from "@tauri-apps/plugin-http";
import type { ServiceData } from "@/types";

type ClaudeUsageResponse = {
  five_hour: { utilization: number; resets_at: string } | null;
  seven_day: { utilization: number; resets_at: string } | null;
};

function formatResetTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) return `in ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      label: "5-hour limit",
      usedPercent: Math.round(data.five_hour.utilization),
      resetsAt: formatResetTime(data.five_hour.resets_at),
    });
  }
  if (data.seven_day) {
    windows.push({
      label: "7-day limit",
      usedPercent: Math.round(data.seven_day.utilization),
      resetsAt: formatResetTime(data.seven_day.resets_at),
    });
  }

  return { name: "Claude", plan: "Pro", status: "ok", windows };
}
