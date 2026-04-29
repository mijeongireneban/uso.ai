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
