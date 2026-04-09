import { fetch } from "@tauri-apps/plugin-http";
import { formatResetTime } from "@/lib/api/utils";
import type { ServiceData } from "@/types";

type ClaudeUsageResponse = {
  five_hour: { utilization: number; resets_at: string | null } | null;
  seven_day: { utilization: number; resets_at: string | null } | null;
};

type ClaudeAccountResponse = Record<string, unknown>;

type ClaudeAccountInfo = {
  email?: string;
  plan: string;
};

const DEFAULT_CLAUDE_PLAN = "";

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeClaudePlan(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!normalized) return undefined;

  if (normalized.includes("max")) return "Max";
  if (normalized.includes("pro")) return "Pro";
  if (normalized.includes("team")) return "Team";
  if (normalized.includes("enterprise")) return "Enterprise";
  if (normalized.includes("free")) return "Free";

  return titleCase(normalized);
}

function findPlanCandidate(
  value: unknown,
  keyHint = "",
  depth = 0
): string | undefined {
  if (depth > 3 || value == null) return undefined;

  if (typeof value === "string") {
    return /(plan|tier|subscription|membership)/i.test(keyHint)
      ? normalizeClaudePlan(value)
      : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const plan = findPlanCandidate(item, keyHint, depth + 1);
      if (plan) return plan;
    }
    return undefined;
  }

  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const prioritizedKeys = [
    "subscription_tier",
    "subscriptionTier",
    "plan",
    "plan_type",
    "planType",
    "tier",
    "membership_type",
    "membershipType",
  ];

  for (const key of prioritizedKeys) {
    const plan = findPlanCandidate(record[key], key, depth + 1);
    if (plan) return plan;
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    const plan = findPlanCandidate(nestedValue, key, depth + 1);
    if (plan) return plan;
  }

  return undefined;
}

async function fetchClaudeAccountInfo(sessionKey: string): Promise<ClaudeAccountInfo> {
  try {
    const res = await fetch("https://claude.ai/api/me", {
      method: "GET",
      headers: { Cookie: `sessionKey=${sessionKey}` },
    });
    if (!res.ok) return { plan: DEFAULT_CLAUDE_PLAN };

    const data = (await res.json()) as ClaudeAccountResponse;
    const email = typeof data.email === "string" ? data.email : undefined;
    const plan = findPlanCandidate(data) ?? DEFAULT_CLAUDE_PLAN;

    return { email, plan };
  } catch {
    return { plan: DEFAULT_CLAUDE_PLAN };
  }
}

export async function fetchClaudeUsage(
  orgId: string,
  sessionKey: string
): Promise<ServiceData> {
  const accountPromise = fetchClaudeAccountInfo(sessionKey);
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
    const account = await accountPromise;
    return {
      name: "Claude",
      plan: account.plan,
      status: "expired",
      windows: [],
      email: account.email,
      accountId: "",
    };
  }
  if (!res.ok) {
    const account = await accountPromise;
    return {
      name: "Claude",
      plan: account.plan,
      status: "error",
      windows: [],
      email: account.email,
      accountId: "",
    };
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

  const account = await accountPromise;
  return {
    name: "Claude",
    plan: account.plan,
    status: "ok",
    windows,
    email: account.email,
    accountId: "",
  };
}
