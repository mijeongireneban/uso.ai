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
  /**
   * Per-service flag to exclude that service's "extra usage" (metered top-up
   * spend beyond the plan limit) from the menu bar tray icon color. Keyed by
   * service id (e.g. "claude", "cursor"). A missing or false entry means
   * extra usage IS counted toward the tray warning level.
   */
  excludeExtraUsageFromTray?: Record<string, boolean>;
};

export const PREFERENCES_CHANGED_EVENT = "uso:preferences-changed";

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

export async function setExcludeExtraUsageFromTray(serviceId: string, exclude: boolean): Promise<Preferences> {
  const prefs = await loadPreferences();
  const next: Preferences = {
    ...prefs,
    excludeExtraUsageFromTray: { ...(prefs.excludeExtraUsageFromTray ?? {}), [serviceId]: exclude },
  };
  await savePreferences(next);
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  return next;
}

/** Set of service ids whose extra usage should be excluded from the tray icon. */
export function extraUsageTrayExclusions(prefs: Preferences): Set<string> {
  const map = prefs.excludeExtraUsageFromTray ?? {};
  return new Set(Object.entries(map).filter(([, v]) => v).map(([k]) => k));
}
