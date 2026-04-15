import { fetch } from "@tauri-apps/plugin-http";
import { formatResetTime } from "@/lib/api/utils";
import type { ServiceData } from "@/types";

type UsageBucket = { utilization: number; resets_at: string | null } | null;

type ClaudeUsageResponse = {
  five_hour: UsageBucket;
  seven_day: UsageBucket;
  /** "Weekly · Sonnet only" bucket — only populated on plans with a Sonnet-specific limit. */
  seven_day_sonnet?: UsageBucket;
  /** "Weekly · Opus only" bucket — only populated on plans with an Opus-specific limit. */
  seven_day_opus?: UsageBucket;
  /**
   * Pay-as-you-go spend. `monthly_limit` is returned in **cents**,
   * `used_credits` is returned in **dollars** (float).
   */
  extra_usage?: {
    is_enabled: boolean;
    monthly_limit: number;
    used_credits: number;
    utilization: number | null;
  };
};

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
    return { name: "Claude", plan: "Pro", status: "expired", windows: [], accountId: "" };
  }
  if (!res.ok) {
    return { name: "Claude", plan: "Pro", status: "error", windows: [], accountId: "" };
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
      label: "Weekly · all models",
      usedPercent: Math.round(data.seven_day.utilization),
      resetsAt: formatResetTime(data.seven_day.resets_at),
    });
  }
  if (data.seven_day_sonnet) {
    windows.push({
      label: "Weekly · Sonnet",
      usedPercent: Math.round(data.seven_day_sonnet.utilization),
      resetsAt: formatResetTime(data.seven_day_sonnet.resets_at),
    });
  }
  if (data.seven_day_opus) {
    windows.push({
      label: "Weekly · Opus",
      usedPercent: Math.round(data.seven_day_opus.utilization),
      resetsAt: formatResetTime(data.seven_day_opus.resets_at),
    });
  }

  // Pay-as-you-go: monthly_limit is cents, used_credits is dollars.
  const extraUsage =
    data.extra_usage?.is_enabled && data.extra_usage.monthly_limit > 0
      ? {
          usedDollars: data.extra_usage.used_credits,
          monthlyLimitDollars: data.extra_usage.monthly_limit / 100,
        }
      : undefined;

  const email = await fetchClaudeEmail(sessionKey);
  return { name: "Claude", plan: "Pro", status: "ok", windows, email, extraUsage, accountId: "" };
}
