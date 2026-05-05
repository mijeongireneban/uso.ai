import { load } from "@tauri-apps/plugin-store";
import { SERVICES } from "@/lib/services";

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

/** Returns true if all credential fields for this service's account are non-blank. */
export function isAccountConfigured(serviceId: string, account: Account): boolean {
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return false;
  return service.fields.every((f) => !!account.credentials[f.key]?.trim());
}

/** Returns true if any account for this service has all required fields filled. */
export function isServiceConfigured(serviceId: string, accounts: Account[]): boolean {
  return accounts.some((a) => isAccountConfigured(serviceId, a));
}
