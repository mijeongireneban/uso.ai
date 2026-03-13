import { load } from "@tauri-apps/plugin-store";

export type Credentials = Record<string, Record<string, string>>;

export async function loadCredentials(): Promise<Credentials> {
  const store = await load("credentials.json", { autoSave: false });
  return (await store.get<Credentials>("credentials")) ?? {};
}
