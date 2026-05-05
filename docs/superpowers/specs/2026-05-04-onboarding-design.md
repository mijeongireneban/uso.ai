# Onboarding — Design Spec

**Date:** 2026-05-04
**Linear:** [TOK-59](https://linear.app/mijeong-irene-ban/issue/TOK-59/onboarding-instructions-for-adding-api-tokens)
**Branch:** `feature/tok-59-onboarding-instructions-for-adding-api-tokens` (to be cut from `develop`)

---

## Goal

Help new uso.ai users add their first credentials. Each supported service has a different mechanic for finding tokens (DevTools cookie viewer for Claude/Cursor/Copilot, Authorization header for ChatGPT, terminal command for Gemini CLI), and today's settings page exposes only a one-line hint per field. First-time users have no idea what they're looking for.

This spec adds (a) a first-run wizard that walks through token setup for the services the user picks, and (b) durable per-service guides inside Settings so the same instructions are discoverable later.

---

## Background

Current onboarding state in `src/pages/Settings.tsx`:
- Each service tab shows credential input fields with a one-line `hint` underneath (e.g., `"DevTools → Network → any request → Cookie header → sessionKey value"`).
- Empty Dashboard (`src/pages/Dashboard.tsx`) shows "No services configured → Add credentials in Settings →".
- No walkthrough exists. Hints are too dense for users unfamiliar with browser DevTools or the Gemini CLI.

Per-service mechanics diverge significantly:
| Service | How to get the credential |
|---|---|
| Claude | DevTools → Application → Cookies → `sessionKey`, plus org ID extracted from the request URL |
| ChatGPT | DevTools → Network → any request → Authorization header (strip `Bearer `) |
| Cursor | DevTools → Application → Cookies → `WorkosCursorSessionToken` |
| Copilot | DevTools → Application → Cookies → github.com → `user_session` |
| Gemini | Run `gemini auth login` in terminal; uso.ai reads `~/.gemini/oauth_creds.json` |

---

## Decisions made during brainstorming

1. **Shape:** First-run wizard **plus** per-service guides in Settings. The wizard handles the cold-start moment; the Settings guides are durable for users adding services months later.
2. **Guide format:** Numbered text steps + **one anchor screenshot** per service. No GIFs/videos (bundle weight, rot risk). Gemini gets an inline `<pre>` code block instead of a screenshot since terminal output varies.
3. **Wizard flow:** Service picker → user checks which services they use → wizard steps through only the selected services in fixed order → summary screen.
4. **Wizard content:** The wizard embeds the credential input form per step (not just instructions). User reads guide and pastes into the same screen, reusing the existing `handleSave` validation. No context-switch to Settings.
5. **Gemini in wizard:** Treated as a peer service. Its wizard step shows the guide + a "Detect Gemini CLI" button (mirrors today's Settings detect block) instead of paste fields.

---

## Architecture

### Files to create

| File | Purpose |
|---|---|
| `src/components/onboarding/OnboardingWizard.tsx` | Full-screen wizard shell. Owns step state and lifecycle. |
| `src/components/onboarding/ServicePicker.tsx` | Step 1: checkbox list of services the user wants to set up. |
| `src/components/onboarding/WizardSummary.tsx` | Final step: "you're set up", links to Dashboard / Settings. |
| `src/components/CredentialGuide.tsx` | Reusable: renders intro + numbered steps + anchor screenshot for one service. Used by wizard and Settings. |
| `src/lib/onboarding/guides.ts` | Single source of truth for per-service guide content (intro, steps, screenshot import, troubleshooting line). |
| `src/lib/onboarding/state.ts` | Read/write `onboarding.json` via `tauri-plugin-store` for `dismissed` and `completed` flags. |
| `src/lib/credentialSave.ts` | Hook (`useCredentialSave`) extracted from `Settings.handleSave`, so wizard and Settings validate identically. |
| `src/assets/onboarding/claude.png` | Anchor screenshot — DevTools Cookies panel, sessionKey row highlighted. |
| `src/assets/onboarding/chatgpt.png` | Anchor screenshot — Network panel, Authorization header circled. |
| `src/assets/onboarding/cursor.png` | Anchor screenshot — DevTools Cookies panel for cursor.com. |
| `src/assets/onboarding/copilot.png` | Anchor screenshot — DevTools Cookies panel for github.com, user_session highlighted. |

### Files to modify

| File | Change |
|---|---|
| `src/App.tsx` | On mount, check `state.dismissed === false && state.completed === false && noAccountsConfigured && !geminiDetected` → render `<OnboardingWizard />`. |
| `src/pages/Settings.tsx` | Refactor save logic into `useCredentialSave`. Add a collapsible `<CredentialGuide />` above each service's input card (default expanded if no account configured). Add a "Show setup walkthrough" link in the credentials header. |
| `src/pages/Dashboard.tsx` | Empty state changes from one link to two buttons: "Run setup walkthrough" (primary) and "Open Settings" (secondary). |

### What does NOT change

- Credential storage shape (`tauri-plugin-store` `credentials.json`).
- Per-service API fetchers (`src/lib/api/*`) and validation status codes.
- Service config (`src/lib/services.ts`) — field hints stay; they remain useful inside the input cards as terse reminders.
- Tauri capabilities, HTTP allowlist, or Rust side.
- Marketing site (`web/`) — no changes there.

---

## Wizard flow

```
┌─ Step 1: Service picker ────────────────────────┐
│ "Which services do you want to track?"          │
│ [✓] Claude                                       │
│ [✓] ChatGPT (Codex)                              │
│ [✓] Cursor                                       │
│ [✓] GitHub Copilot                               │
│ [✓] Gemini CLI                                   │
│ [Continue]                          Skip setup   │
└──────────────────────────────────────────────────┘

For each selected service, in fixed order:
┌─ Step 2..N: Connect {Service} (n of N) ─────────┐
│ <CredentialGuide service={...} />               │
│ ─────────────────────────────────────           │
│ [Account label input]                            │
│ [Credential field(s) — same as Settings card]   │
│ [Save & Continue]              Skip this one     │
└──────────────────────────────────────────────────┘

Gemini variant: input fields replaced with
┌──────────────────────────────────────────────────┐
│ [Detect Gemini CLI]                              │
│ ✓ Connected as user@example.com                  │
│ [Continue]                     Skip this one     │
└──────────────────────────────────────────────────┘

┌─ Step N+1: Summary ─────────────────────────────┐
│ "You're set up. {N} services connected."         │
│ [Open Dashboard]   [Add more in Settings]        │
└──────────────────────────────────────────────────┘
```

Behavior details:
- "Continue" on picker is disabled until ≥1 service is checked.
- All services default to checked.
- "Skip this one" advances to the next service step without touching state.
- "Skip setup" (picker step) and the "X" button (any step) set `dismissed = true` and close. If anything was saved already, the X confirms first ("Close walkthrough? Saved credentials are kept.").
- "Save & Continue" runs the same validation as Settings (`expired`/`error`/`ok`). On `expired` or `error`, the button shows the existing destructive variant text and the user can retry or skip.
- Reaching Summary sets `completed = true`.

---

## Guide content shape

```ts
// src/lib/onboarding/guides.ts
export type GuideStep = { text: string; code?: string };

export type CredentialGuide = {
  serviceId: string;
  intro: string;                  // one sentence
  steps: GuideStep[];             // 4–6 numbered steps
  screenshot?: string;            // imported image asset (omitted for Gemini)
  screenshotCaption?: string;
  inlineCode?: string;            // shown for Gemini in lieu of screenshot
  troubleshooting?: string;       // one-line fallback (e.g., "Token starts with eyJ — strip 'Bearer ' if present.")
};
```

`<CredentialGuide service={ServiceConfig} />` renders:
1. Avatar + service name + intro.
2. Numbered list of steps. If `step.code` exists, render with a copy-to-clipboard button.
3. Anchor screenshot (or `inlineCode` block for Gemini), with caption.
4. Troubleshooting line (muted, italic) if present.

In Settings, `<CredentialGuide />` is wrapped in a `<details>`/accordion ("How to find these →"). Default state:
- Expanded if the service has zero accounts configured.
- Collapsed otherwise.

---

## Lifecycle & state

`src/lib/onboarding/state.ts`:
```ts
export type OnboardingState = { dismissed: boolean; completed: boolean };
export async function loadOnboardingState(): Promise<OnboardingState>;
export async function setOnboardingDismissed(): Promise<void>;
export async function setOnboardingCompleted(): Promise<void>;
export async function resetOnboarding(): Promise<void>;
```

Stored in `tauri-plugin-store` `onboarding.json`. Defaults: both flags `false`.

**Auto-show condition** (in `App.tsx`):
```
const credentials = await loadCredentials();
const noAccounts = SERVICES.every(s => (credentials[s.id] ?? []).every(a => !isAccountConfigured(s.id, a)));
const geminiDetected = await exists(".gemini/oauth_creds.json", { baseDir: BaseDirectory.Home });
const state = await loadOnboardingState();
const showWizard = !state.dismissed && !state.completed && noAccounts && !geminiDetected;
```

**Manual re-entry**:
- Dashboard empty state → "Run setup walkthrough" button → mounts wizard, leaves both flags untouched (so the user can re-dismiss).
- Settings header → "Show setup walkthrough" link → same.

When the wizard is opened manually, completing or dismissing it sets the same flags; re-opens still work.

---

## Testing

- Manual smoke test path: fresh install (delete `credentials.json` and `onboarding.json`) → app launch → wizard appears → pick 2 services → save fake/real tokens → land on Dashboard.
- Verify dismissal sticks: Skip setup, restart app, wizard does not reappear.
- Verify Settings re-entry: open Settings → "Show setup walkthrough" → wizard mounts.
- Verify Gemini step renders correctly when `~/.gemini/oauth_creds.json` exists vs not.
- Verify expired/error states surface in wizard with the same UI as Settings.
- Verify accordion default state in Settings (expanded if no accounts, collapsed if any).

No automated tests are added in this iteration — the existing repo has no test infrastructure for the React app.

---

## Out of scope

- Translating guide content (English only for now).
- Bundling animated GIFs or videos.
- Marketing site changes.
- A "test connection" button separate from Save (Save already validates).
- Auto-detecting whether the user has Chrome/Firefox/Safari — instructions assume Chrome/Chromium-based DevTools.
- Detecting browser cookies directly (out of scope for this ticket; would require new Tauri capabilities and OS-level access to Chrome's cookie database).
