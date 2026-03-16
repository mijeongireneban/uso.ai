export type UsageWindow = {
  label: string;
  usedPercent: number;
  resetsAt: string;
};

export type ServiceStatus = "ok" | "expired" | "error" | "not_configured";

export type ServiceData = {
  accountId: string;
  name: string;
  label?: string;
  plan: string;
  status: ServiceStatus;
  windows: UsageWindow[];
  email?: string;
};
