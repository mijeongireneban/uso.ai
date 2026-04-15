export type UsageWindow = {
  label: string;
  usedPercent: number;
  resetsAt: string;
};

export type ServiceStatus = "ok" | "expired" | "error" | "not_configured";

/** Live operational status pulled from each provider's public status page. */
export type OperationalStatus = "operational" | "degraded" | "outage" | "unknown";

export type ServiceStatusInfo = {
  status: OperationalStatus;
  /** Human-readable status text from the provider (e.g. "All Systems Operational"). */
  description?: string;
  /** URL of the public status page. */
  page: string;
};

/** Pay-as-you-go / top-up usage beyond the plan limits. Dollar amounts. */
export type ExtraUsage = {
  /** Amount already consumed this month. */
  usedDollars: number;
  /** Monthly cap the user has set. */
  monthlyLimitDollars: number;
};

export type ServiceData = {
  accountId: string;
  name: string;
  label?: string;
  plan: string;
  status: ServiceStatus;
  windows: UsageWindow[];
  email?: string;
  operational?: OperationalStatus;
  extraUsage?: ExtraUsage;
};
