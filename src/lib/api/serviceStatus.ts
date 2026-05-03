import { fetch } from "@tauri-apps/plugin-http";
import type { OperationalStatus, ServiceStatusInfo } from "@/types";

/**
 * Live operational status, pulled from each provider's public Statuspage.io feed.
 * All endpoints are unauthenticated JSON. A fetch failure yields "unknown" — the
 * UI treats it as "no data" rather than a fake green.
 */

type StatuspagePayload = {
  status?: {
    indicator?: "none" | "minor" | "major" | "critical";
    description?: string;
  };
};

/** Map Statuspage.io `indicator` to our 4-state operational status. */
function mapIndicator(indicator: string | undefined): OperationalStatus {
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
    case "critical":
      return "outage";
    default:
      return "unknown";
  }
}

/**
 * `api: null` means no real-time feed — render as a passive link to the page
 * with `description` as the row text. Used for Gemini, since Google Cloud
 * doesn't expose a Statuspage for AI Studio specifically.
 */
type StatusSource = { api: string | null; page: string; description?: string };

const STATUS_SOURCES: Record<string, StatusSource> = {
  claude: {
    api: "https://status.anthropic.com/api/v2/status.json",
    page: "https://status.anthropic.com",
  },
  chatgpt: {
    api: "https://status.openai.com/api/v2/status.json",
    page: "https://status.openai.com",
  },
  cursor: {
    api: "https://status.cursor.com/api/v2/status.json",
    page: "https://status.cursor.com",
  },
  copilot: {
    api: "https://www.githubstatus.com/api/v2/status.json",
    page: "https://www.githubstatus.com",
  },
  gemini: {
    api: null,
    page: "https://status.cloud.google.com",
    description: "View Google Cloud status",
  },
};

async function fetchStatuspage(
  source: StatusSource
): Promise<ServiceStatusInfo> {
  // No real-time feed — return a static link-only entry. The panel renders
  // `unknown` as a gray dot + the description text, which is what we want
  // for "we don't track this, but here's the page" entries.
  if (source.api === null) {
    return { status: "unknown", description: source.description, page: source.page };
  }
  try {
    const res = await fetch(source.api, { method: "GET" });
    if (!res.ok) return { status: "unknown", page: source.page };
    const data = (await res.json()) as StatuspagePayload;
    return {
      status: mapIndicator(data.status?.indicator),
      description: data.status?.description,
      page: source.page,
    };
  } catch {
    return { status: "unknown", page: source.page };
  }
}

/**
 * Fetches the full operational status info for a single service by id.
 * Returns `null` for unsupported services (e.g. Gemini — opted out of v1).
 */
export async function fetchOperationalStatus(
  serviceId: string
): Promise<ServiceStatusInfo | null> {
  const source = STATUS_SOURCES[serviceId];
  if (!source) return null;
  return fetchStatuspage(source);
}

/**
 * Fetches statuses for all supported services in parallel.
 * Returns a map keyed by service id. Services not in the map are unsupported.
 */
export async function fetchAllOperationalStatuses(): Promise<
  Record<string, ServiceStatusInfo>
> {
  const entries = await Promise.all(
    Object.entries(STATUS_SOURCES).map(
      async ([id, source]) => [id, await fetchStatuspage(source)] as const
    )
  );
  return Object.fromEntries(entries);
}
