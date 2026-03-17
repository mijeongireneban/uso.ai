import { load } from "@tauri-apps/plugin-store";
import type { ServiceData } from "@/types";

export type HistorySnapshot = {
  timestamp: string;   // "YYYY-MM-DD"
  serviceId: string;   // "claude" | "chatgpt" | "cursor"
  accountId: string;
  data: ServiceData;
};

export async function loadHistory(): Promise<HistorySnapshot[]> {
  const store = await load("history.json", { autoSave: false, defaults: {} });
  return (await store.get<HistorySnapshot[]>("history")) ?? [];
}

export async function saveHistorySnapshot(
  serviceId: string,
  data: ServiceData
): Promise<void> {
  const store = await load("history.json", { autoSave: false, defaults: {} });
  const history = (await store.get<HistorySnapshot[]>("history")) ?? [];
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const exists = history.some(
    (s) =>
      s.timestamp === today &&
      s.serviceId === serviceId &&
      s.accountId === data.accountId
  );
  if (exists) return;

  history.push({ timestamp: today, serviceId, accountId: data.accountId, data });
  await store.set("history", history);
  await store.save();
}
