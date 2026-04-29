import { load } from "@tauri-apps/plugin-store";

// User preferences that aren't credentials — kept in a separate store file so
// the credentials store stays focused on secrets and so these can be reset
// independently if we ever add an "Erase preferences" action.
export type Preferences = {
  /**
   * Explicit per-model visibility for Gemini. A missing entry means "follow
   * the tier-based default" (see `isGeminiModelAutoHidden`). A present entry
   * is a user override and always wins.
   */
  geminiModelVisibility?: Record<string, boolean>;
};

const FILE = "preferences.json";
const KEY = "preferences";

export async function loadPreferences(): Promise<Preferences> {
  const store = await load(FILE, { autoSave: false, defaults: {} });
  return (await store.get<Preferences>(KEY)) ?? {};
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  const store = await load(FILE, { autoSave: false, defaults: {} });
  await store.set(KEY, prefs);
  await store.save();
}

export async function setGeminiModelVisible(modelId: string, visible: boolean): Promise<Preferences> {
  const prefs = await loadPreferences();
  const next: Preferences = {
    ...prefs,
    geminiModelVisibility: { ...(prefs.geminiModelVisibility ?? {}), [modelId]: visible },
  };
  await savePreferences(next);
  return next;
}

/**
 * Models that are not available on the user's current tier should default to
 * hidden so the dashboard and tray icon aren't pinned at 100% by buckets the
 * user can't actually use. Right now this only covers the known case from
 * issue #26 — free-tier users don't get Gemini Pro models.
 */
export function isGeminiModelAutoHidden(modelId: string, tier: string): boolean {
  if (tier === "free-tier" && modelId.toLowerCase().includes("pro")) return true;
  return false;
}

export function isGeminiModelVisible(
  modelId: string,
  tier: string,
  visibility: Record<string, boolean> | undefined
): boolean {
  const explicit = visibility?.[modelId];
  if (typeof explicit === "boolean") return explicit;
  return !isGeminiModelAutoHidden(modelId, tier);
}
