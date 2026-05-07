import { notify } from "@/lib/notify";
import type { OperationalStatus, ServiceStatus } from "@/types";

type AccountStatus = {
  accountId: string;
  /** Display label, e.g. "Claude" or "Claude · Work". */
  displayName: string;
  status: ServiceStatus;
};

type OperationalSnapshot = {
  serviceId: string;
  serviceName: string;
  status: OperationalStatus;
};

function describeAccountTransition(
  displayName: string,
  prev: ServiceStatus,
  next: ServiceStatus,
): { title: string; body: string } | null {
  if ((prev === "expired" || prev === "error") && next === "ok") {
    return {
      title: `uso.ai · ${displayName} reconnected`,
      body: `${displayName} is back. Usage tracking resumed.`,
    };
  }
  if (prev !== "expired" && next === "expired") {
    return {
      title: `uso.ai · ${displayName} token expired`,
      body: `Your ${displayName} session token has expired. Update it in Settings.`,
    };
  }
  if (prev === "ok" && next === "error") {
    return {
      title: `uso.ai · ${displayName} fetch failed`,
      body: `Couldn't load ${displayName} usage data. The provider's API may be unavailable.`,
    };
  }
  return null;
}

function describeOperationalTransition(
  serviceName: string,
  prev: OperationalStatus,
  next: OperationalStatus,
): { title: string; body: string } | null {
  if (prev === next) return null;
  // Status pages occasionally drop to "unknown" on a single failed fetch — don't
  // notify on those transitions; wait for a real state.
  if (prev === "unknown" || next === "unknown") return null;

  if (next === "outage") {
    return {
      title: `uso.ai · ${serviceName} outage`,
      body: `${serviceName} is reporting an outage on its status page.`,
    };
  }
  if (next === "degraded") {
    return {
      title: `uso.ai · ${serviceName} degraded`,
      body: `${serviceName} is reporting degraded performance.`,
    };
  }
  if (next === "operational" && (prev === "outage" || prev === "degraded")) {
    return {
      title: `uso.ai · ${serviceName} restored`,
      body: `${serviceName} is back to all systems operational.`,
    };
  }
  return null;
}

/**
 * Fires a notification for each account whose ServiceStatus has transitioned
 * since the last fetch. Accounts with no previous status (first sighting) are
 * skipped to avoid notifying on app launch.
 */
export async function notifyAccountStatusChanges(
  prev: Map<string, ServiceStatus>,
  curr: AccountStatus[],
): Promise<void> {
  for (const acc of curr) {
    const previous = prev.get(acc.accountId);
    if (!previous) continue;
    const message = describeAccountTransition(acc.displayName, previous, acc.status);
    if (message) await notify(message.title, message.body);
  }
}

/**
 * Fires a notification for each service whose OperationalStatus has transitioned
 * since the last fetch. Only configured services should be passed in.
 */
export async function notifyOperationalChanges(
  prev: Map<string, OperationalStatus>,
  curr: OperationalSnapshot[],
): Promise<void> {
  for (const svc of curr) {
    const previous = prev.get(svc.serviceId);
    if (!previous) continue;
    const message = describeOperationalTransition(svc.serviceName, previous, svc.status);
    if (message) await notify(message.title, message.body);
  }
}
