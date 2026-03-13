export type UsageWindow = {
  label: string;
  usedPercent: number;
  resetsAt: string;
};

export type ServiceStatus = "ok" | "expired" | "error" | "not_configured";

export type ServiceData = {
  name: string;
  plan: string;
  status: ServiceStatus;
  windows: UsageWindow[];
};
