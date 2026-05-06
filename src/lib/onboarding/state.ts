import { load } from "@tauri-apps/plugin-store";

export type OnboardingState = {
  /** User explicitly closed the wizard (X button or "Skip setup"). Suppresses auto-show. */
  dismissed: boolean;
  /** User reached the summary step. Suppresses auto-show. */
  completed: boolean;
};

const FILE = "onboarding.json";
const KEY = "onboarding";

const DEFAULT_STATE: OnboardingState = { dismissed: false, completed: false };

export async function loadOnboardingState(): Promise<OnboardingState> {
  const store = await load(FILE, { autoSave: false, defaults: {} });
  return (await store.get<OnboardingState>(KEY)) ?? DEFAULT_STATE;
}

async function patchState(patch: Partial<OnboardingState>): Promise<void> {
  const current = await loadOnboardingState();
  const next: OnboardingState = { ...current, ...patch };
  const store = await load(FILE, { autoSave: false, defaults: {} });
  await store.set(KEY, next);
  await store.save();
}

export function setOnboardingDismissed(): Promise<void> {
  return patchState({ dismissed: true });
}

export function setOnboardingCompleted(): Promise<void> {
  return patchState({ completed: true });
}

export function resetOnboarding(): Promise<void> {
  return patchState({ dismissed: false, completed: false });
}
