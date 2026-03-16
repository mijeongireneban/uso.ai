import { load } from "@tauri-apps/plugin-store";

export type Account = {
  id: string;
  label: string;
  credentials: Record<string, string>;
};

export type CredentialsStore = Record<string, Account[]>;

export async function saveCredentials(data: CredentialsStore): Promise<void> {
  const store = await load("credentials.json", { autoSave: false, defaults: {} });
  await store.set("credentials", data);
  await store.save();
}

export async function loadCredentials(): Promise<CredentialsStore> {
  const store = await load("credentials.json", { autoSave: false, defaults: {} });
  const raw = await store.get<Record<string, unknown>>("credentials");
  if (!raw) return {};

  let migrated = false;
  const result: CredentialsStore = {};

  for (const [serviceId, entry] of Object.entries(raw)) {
    if (Array.isArray(entry)) {
      result[serviceId] = entry as Account[];
    } else if (entry !== null && typeof entry === "object") {
      result[serviceId] = [
        {
          id: crypto.randomUUID(),
          label: "Default",
          credentials: entry as Record<string, string>,
        },
      ];
      migrated = true;
    }
    // null / undefined / string / other → drop silently
  }

  if (migrated) {
    await saveCredentials(result);
  }

  return result;
}
