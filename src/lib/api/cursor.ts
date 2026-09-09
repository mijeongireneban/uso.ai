import { fetch } from "@tauri-apps/plugin-http";
import { buildCookieHeader } from "@/lib/api/cookies";
import { fetchWithRetry } from "@/lib/api/fetch";
import type { ServiceData } from "@/types";

type CursorUsageResponse = {
  membershipType: string;
  billingCycleStart: string;
  billingCycleEnd: string;
  /**
   * True for plans with no per-cycle quota cap. When true, percent-used
   * fields are 0 / meaningless — show the plan badge but no usage bars.
   */
  isUnlimited?: boolean;
  individualUsage: {
    plan: {
      autoPercentUsed: number;
      apiPercentUsed: number;
      totalPercentUsed: number;
    };
    /**
     * Pay-as-you-go usage block — analogous to Claude's `extra_usage`.
     * Only meaningful when `enabled: true`. `used` and `limit` are dollars
     * (matches what Cursor shows on the billing page).
     */
    onDemand?: {
      enabled: boolean;
      used: number;
      limit: number | null;
      remaining: number | null;
    };
  };
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

async function fetchCursorEmail(sessionToken: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://cursor.com/api/auth/me", {
      method: "GET",
      headers: { Cookie: buildCookieHeader("WorkosCursorSessionToken", sessionToken) },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchCursorUsage(sessionToken: string): Promise<ServiceData> {
  const res = await fetchWithRetry("https://cursor.com/api/usage-summary", {
    method: "GET",
    headers: {
      Cookie: buildCookieHeader("WorkosCursorSessionToken", sessionToken),
    },
  });

  // 401 = real auth failure. 403 from Cloudflare is usually transient — let
  // it surface as "error" so the next 5-min poll self-recovers rather than
  // showing a false "Token expired" card.
  if (res.status === 401) {
    return { name: "Cursor", plan: "Free", status: "expired", windows: [], accountId: "" };
  }
  if (!res.ok) {
    return { name: "Cursor", plan: "Free", status: "error", windows: [], accountId: "" };
  }

  const data = (await res.json()) as CursorUsageResponse;
  const plan =
    data.membershipType === "free"
      ? "Free"
      : data.membershipType.charAt(0).toUpperCase() + data.membershipType.slice(1);

  const email = await fetchCursorEmail(sessionToken);

  // Cursor's `onDemand` block is the direct analog of Claude's `extra_usage`:
  // pay-as-you-go spend with an optional cap. Surface only when it's actually
  // enabled (and a non-zero cap is set), so accounts that haven't opted into
  // PAYG don't show a phantom "Extra usage $0 of $0" row.
  const od = data.individualUsage?.onDemand;
  const extraUsage =
    od?.enabled && od.limit !== null && od.limit > 0
      ? { usedDollars: od.used, monthlyLimitDollars: od.limit }
      : undefined;

  // Unlimited plans (e.g. some Business/Ultra tiers) have no per-cycle cap, so
  // a 0% bar conveys nothing. Show the plan badge alone — NextResetCard and
  // ServiceDonutCard already render gracefully with windows: [].
  if (data.isUnlimited) {
    return {
      name: "Cursor",
      plan,
      status: "ok",
      email,
      accountId: "",
      windows: [],
      extraUsage,
    };
  }

  const start = formatDate(data.billingCycleStart);
  const end = formatDate(data.billingCycleEnd);
  const period = `${start} – ${end}`;
  const resetsAt = end;

  const autoPercent = Math.round(data.individualUsage?.plan?.autoPercentUsed ?? 0);
  const apiPercent = Math.round(data.individualUsage?.plan?.apiPercentUsed ?? 0);

  return {
    name: "Cursor",
    plan,
    status: "ok",
    email,
    accountId: "",
    windows: [
      { label: `Auto · ${period}`, usedPercent: autoPercent, resetsAt },
      { label: `API · ${period}`, usedPercent: apiPercent, resetsAt },
    ],
    extraUsage,
  };
}
