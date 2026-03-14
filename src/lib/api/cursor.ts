import { fetch } from "@tauri-apps/plugin-http";
import type { ServiceData } from "@/types";

type CursorUsageResponse = {
  membershipType: string;
  billingCycleStart: string;
  billingCycleEnd: string;
  individualUsage: {
    plan: {
      autoPercentUsed: number;
      apiPercentUsed: number;
      totalPercentUsed: number;
    };
  };
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export async function fetchCursorUsage(sessionToken: string): Promise<ServiceData> {
  const res = await fetch("https://cursor.com/api/usage-summary", {
    method: "GET",
    headers: {
      Cookie: `WorkosCursorSessionToken=${sessionToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    return { name: "Cursor", plan: "Free", status: "expired", windows: [] };
  }
  if (!res.ok) {
    return { name: "Cursor", plan: "Free", status: "error", windows: [] };
  }

  const data = (await res.json()) as CursorUsageResponse;
const plan =
    data.membershipType === "free"
      ? "Free"
      : data.membershipType.charAt(0).toUpperCase() + data.membershipType.slice(1);

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
    windows: [
      { label: `Auto · ${period}`, usedPercent: autoPercent, resetsAt },
      { label: `API · ${period}`, usedPercent: apiPercent, resetsAt },
    ],
  };
}
