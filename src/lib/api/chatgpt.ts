import { fetch } from "@tauri-apps/plugin-http";
import type { ServiceData } from "@/types";

type RateLimitWindow = {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
};

type ChatGPTUsageResponse = {
  plan_type: string;
  rate_limit: {
    primary_window: RateLimitWindow;
    secondary_window: RateLimitWindow | null;
  };
};

function formatResetSeconds(seconds: number): string {
  if (seconds < 60) return "in <1m";
  if (seconds < 3600) return `in ${Math.round(seconds / 60)}m`;
  if (seconds < 21600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  const resetDate = new Date(Date.now() + seconds * 1000);
  const dayDiff = Math.floor(seconds / 86400);
  const timeStr = resetDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (dayDiff === 0) return `today ${timeStr}`;
  if (dayDiff === 1) return `tomorrow ${timeStr}`;
  return resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function windowLabel(seconds: number): string {
  if (seconds <= 18000) return "5-hour session";
  if (seconds <= 86400) return "Daily limit";
  return "Weekly limit";
}

export async function fetchChatGPTUsage(bearerToken: string): Promise<ServiceData> {
  const res = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    return { name: "ChatGPT", plan: "Plus", status: "expired", windows: [] };
  }
  if (!res.ok) {
    return { name: "ChatGPT", plan: "Plus", status: "error", windows: [] };
  }

  const data = (await res.json()) as ChatGPTUsageResponse;
  const plan = data.plan_type === "plus" ? "Plus" : data.plan_type;
  const windows = [];

  const primary = data.rate_limit?.primary_window;
  if (primary) {
    windows.push({
      label: windowLabel(primary.limit_window_seconds),
      usedPercent: Math.round(primary.used_percent),
      resetsAt: formatResetSeconds(primary.reset_after_seconds),
    });
  }

  const secondary = data.rate_limit?.secondary_window;
  if (secondary) {
    windows.push({
      label: windowLabel(secondary.limit_window_seconds),
      usedPercent: Math.round(secondary.used_percent),
      resetsAt: formatResetSeconds(secondary.reset_after_seconds),
    });
  }

  return { name: "ChatGPT", plan, status: "ok", windows };
}
