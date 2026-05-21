import { fetchWithRetry } from "@/lib/api/fetch";
import type { ServiceData, UsageWindow } from "@/types";
import { calendarDayDiff } from "./utils";

// This is the same XHR github.com hits when you load
// /settings/copilot/features. Confirmed by inspecting Network tab on a Free
// account — see commit message for the captured response shape.
const ENTITLEMENT_URL = "https://github.com/github-copilot/chat/entitlement";

type Quotas = {
  limits?: Partial<Record<"chat" | "completions" | "premiumInteractions", number>>;
  remaining?: Partial<Record<"chat" | "completions" | "premiumInteractions", number>> & {
    chatPercentage?: number;
    completionsPercentage?: number;
    premiumInteractionsPercentage?: number;
  };
  resetDate?: string;
  overagesEnabled?: boolean;
};

type EntitlementResponse = {
  licenseType?: string;
  plan?: string;
  quotas?: Quotas;
};

function formatPlan(plan: string | undefined): string {
  if (!plan) return "—";
  const map: Record<string, string> = {
    free: "Free",
    individual: "Free",
    pro: "Pro",
    individual_pro: "Pro",
    pro_plus: "Pro+",
    individual_pro_plus: "Pro+",
    business: "Business",
    individual_business: "Business",
    enterprise: "Enterprise",
    individual_enterprise: "Enterprise",
    student: "Student",
  };
  if (map[plan]) return map[plan];
  return plan
    .replace(/^individual_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatResetDate(isoString: string | undefined): string {
  if (!isoString) return "";
  const resetDate = new Date(isoString);
  const days = calendarDayDiff(resetDate, new Date());
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Build a usage row from one quota bucket.
 *
 * GitHub's response only includes `*Percentage` fields for some buckets and
 * sometimes for an account where the bucket has been used. To handle both
 * cases we fall back to computing percent from `remaining` / `limit` when the
 * pre-computed percent isn't present.
 *
 * Returns null when:
 *   - `limit` is explicitly 0 (e.g. Free plan has 0 premium requests — hiding
 *     this row matches what the github.com settings page does)
 *   - We have no signal at all (no percent, no remaining + limit)
 */
type Bucket = {
  limit?: number;
  remaining?: number;
  percentRemaining?: number;
};

function buildRow(label: string, bucket: Bucket, resetsAt: string): UsageWindow | null {
  const { limit, remaining, percentRemaining } = bucket;
  if (limit === 0) return null;

  if (typeof percentRemaining === "number") {
    const usedPercent = Math.max(0, Math.min(100, Math.round(100 - percentRemaining)));
    return { label, usedPercent, resetsAt };
  }
  if (typeof limit === "number" && limit > 0 && typeof remaining === "number") {
    const usedPercent = Math.max(0, Math.min(100, Math.round(100 * (1 - remaining / limit))));
    return { label, usedPercent, resetsAt };
  }
  if (typeof remaining === "number") {
    // Fresh-account case: GitHub omits the percent field but `remaining` is
    // populated. Show 0% with the remaining count surfaced via the label so
    // the row isn't blank — gives users visibility into their entitlement.
    return {
      label: `${label} · ${remaining.toLocaleString()} left`,
      usedPercent: 0,
      resetsAt,
    };
  }
  // Pro/Pro+ unlimited case: GitHub omits limit, remaining, and percent
  // entirely for buckets the plan covers without a cap. Render an empty bar
  // labeled "Unlimited" so the row stays visible and the user can tell the
  // plan covers it (vs. an empty card that looks like a fetch failure).
  return { label: `${label} · unlimited`, usedPercent: 0, resetsAt };
}

export async function fetchCopilotUsage(sessionCookie: string): Promise<ServiceData> {
  const res = await fetchWithRetry(ENTITLEMENT_URL, {
    method: "GET",
    headers: {
      accept: "application/json",
      cookie: `user_session=${sessionCookie}`,
    },
  });

  // 401 = real auth failure. 403 from GitHub's abuse heuristic is usually
  // transient — surface as "error" so the next poll self-heals instead of
  // flagging the cookie as expired.
  if (res.status === 401) {
    return { name: "GitHub Copilot", plan: "Free", status: "expired", windows: [], accountId: "" };
  }
  if (!res.ok) {
    return { name: "GitHub Copilot", plan: "Free", status: "error", windows: [], accountId: "" };
  }

  // github.com returns the sign-in HTML page (not JSON) when the cookie is
  // missing or expired. JSON parsing throws → surface as "expired".
  let data: EntitlementResponse;
  try {
    data = (await res.json()) as EntitlementResponse;
  } catch {
    return { name: "GitHub Copilot", plan: "Free", status: "expired", windows: [], accountId: "" };
  }

  const plan = formatPlan(data.plan);
  const quotas = data.quotas ?? {};
  const limits = quotas.limits ?? {};
  const remaining = quotas.remaining ?? {};
  const resetsAt = formatResetDate(quotas.resetDate);

  const windows: UsageWindow[] = [];
  const rows = [
    buildRow("Code completions", {
      limit: limits.completions,
      remaining: remaining.completions,
      percentRemaining: remaining.completionsPercentage,
    }, resetsAt),
    buildRow("Chat messages", {
      limit: limits.chat,
      remaining: remaining.chat,
      percentRemaining: remaining.chatPercentage,
    }, resetsAt),
    buildRow("Premium requests", {
      limit: limits.premiumInteractions,
      remaining: remaining.premiumInteractions,
      percentRemaining: remaining.premiumInteractionsPercentage,
    }, resetsAt),
  ];
  for (const row of rows) if (row) windows.push(row);

  return { name: "GitHub Copilot", plan, status: "ok", windows, accountId: "" };
}
