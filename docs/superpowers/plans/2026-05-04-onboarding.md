# Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run setup wizard and durable per-service credential guides inside Settings so new users can find tokens for Claude / ChatGPT / Cursor / Copilot / Gemini without staring at one-line hints.

**Architecture:** A single `<CredentialGuide />` content component is reused in two places. The wizard wraps it with credential input fields per step; Settings embeds it inside an accordion above each tab's input cards. Save logic and validation are extracted into a `useCredentialSave` hook so both surfaces validate identically. Wizard auto-shows once on first launch when no accounts are configured, and is re-openable from Dashboard's empty state and Settings' header.

**Tech Stack:** React 19, TypeScript, Tailwind, shadcn/ui, lucide-react, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-fs`. No test infrastructure exists for the React layer in this repo (per spec); verification is manual + `npm run build` (`tsc && vite build`).

**Spec:** [docs/superpowers/specs/2026-05-04-onboarding-design.md](../specs/2026-05-04-onboarding-design.md)

**Branch:** `feature/tok-59-onboarding-instructions-for-adding-api-tokens`

---

## File map

**Create:**

| File | Purpose |
|---|---|
| `src/lib/onboarding/state.ts` | Persistent `dismissed` / `completed` flags via `tauri-plugin-store`. |
| `src/lib/onboarding/guides.ts` | Per-service guide content (intro, steps, screenshot import, troubleshooting). |
| `src/lib/credentialSave.ts` | `useCredentialSave` hook — extracted save + validation logic. |
| `src/components/CredentialGuide.tsx` | Renders one service's intro + steps + screenshot. Used by wizard and Settings. |
| `src/components/onboarding/ServicePicker.tsx` | Wizard step 1: which services to set up. |
| `src/components/onboarding/WizardSummary.tsx` | Wizard final step: "you're set up". |
| `src/components/onboarding/OnboardingWizard.tsx` | Wizard shell + step orchestration. |
| `src/assets/onboarding/claude.png` | Anchor screenshot — DevTools cookies for claude.ai (1×1 placeholder shipped, real screenshot replaces later). |
| `src/assets/onboarding/chatgpt.png` | Anchor screenshot — Network tab Authorization header. |
| `src/assets/onboarding/cursor.png` | Anchor screenshot — DevTools cookies for cursor.com. |
| `src/assets/onboarding/copilot.png` | Anchor screenshot — DevTools cookies for github.com. |

**Modify:**

| File | Change |
|---|---|
| `src/lib/credentials.ts` | Add shared `isAccountConfigured(serviceId, account)` helper to consolidate two duplicate definitions. |
| `src/pages/Dashboard.tsx` | Replace local `isAccountConfigured` with import. Update empty state to two buttons. |
| `src/pages/Settings.tsx` | Replace local `isAccountConfigured` with import. Use `useCredentialSave`. Add `<CredentialGuide />` accordions. Add "Show setup walkthrough" link in header. |
| `src/App.tsx` | On mount, evaluate auto-show condition. Mount `<OnboardingWizard />` when needed. Provide manual re-entry handler to children. |

---

## Task 1: Shared `isAccountConfigured` helper

**Files:**
- Modify: `src/lib/credentials.ts`
- Modify: `src/pages/Dashboard.tsx:78-82`
- Modify: `src/pages/Settings.tsx:58-64`

- [ ] **Step 1: Add helper to `src/lib/credentials.ts`**

Append to the bottom of `src/lib/credentials.ts`:

```ts
import { SERVICES } from "@/lib/services";

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
```

- [ ] **Step 2: Replace the local helper in `src/pages/Dashboard.tsx`**

Delete lines 77–82 (the local `function isAccountConfigured(...)`). Update the import block at the top:

```ts
import { loadCredentials, isAccountConfigured } from "@/lib/credentials";
```

- [ ] **Step 3: Replace the local helpers in `src/pages/Settings.tsx`**

Delete the local definitions at lines 58–64 (`isAccountConfigured` and `isServiceConfigured`). Update the import:

```ts
import { loadCredentials, saveCredentials, isAccountConfigured, isServiceConfigured } from "@/lib/credentials";
```

Update the call site at line 250 from:

```ts
const configured = service.id === "gemini"
  ? geminiDetected
  : isServiceConfigured(persisted[service.id] ?? [], service.fields);
```

to:

```ts
const configured = service.id === "gemini"
  ? geminiDetected
  : isServiceConfigured(service.id, persisted[service.id] ?? []);
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/credentials.ts src/pages/Dashboard.tsx src/pages/Settings.tsx
git commit -m "refactor(credentials): consolidate isAccountConfigured helpers"
```

---

## Task 2: Onboarding state module

**Files:**
- Create: `src/lib/onboarding/state.ts`

- [ ] **Step 1: Create `src/lib/onboarding/state.ts`**

```ts
import { load } from "@tauri-apps/plugin-store";

export type OnboardingState = {
  dismissed: boolean;
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
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/onboarding/state.ts
git commit -m "feat(onboarding): add persistent dismissed/completed state"
```

---

## Task 3: Extract credential save hook

**Files:**
- Create: `src/lib/credentialSave.ts`
- Modify: `src/pages/Settings.tsx` (use the hook)

The current `Settings.handleSave` does: validate via the service's API fetcher, persist via `saveCredentials`, surface idle/saving/saved/expired/error status. The hook exposes the same status state and a `save(account)` function.

- [ ] **Step 1: Create `src/lib/credentialSave.ts`**

```ts
import { useState } from "react";
import { saveCredentials } from "@/lib/credentials";
import type { Account, CredentialsStore } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { fetchCopilotUsage } from "@/lib/api/copilot";

export type SaveStatus = "idle" | "saving" | "saved" | "expired" | "error";

async function validateAccount(serviceId: string, account: Account): Promise<"ok" | "expired" | "error"> {
  const c = account.credentials;
  if (serviceId === "claude" && c.orgId && c.sessionKey) {
    return (await fetchClaudeUsage(c.orgId, c.sessionKey)).status;
  }
  if (serviceId === "chatgpt" && c.bearerToken) {
    return (await fetchChatGPTUsage(c.bearerToken)).status;
  }
  if (serviceId === "cursor" && c.sessionToken) {
    return (await fetchCursorUsage(c.sessionToken)).status;
  }
  if (serviceId === "copilot" && c.sessionCookie) {
    return (await fetchCopilotUsage(c.sessionCookie)).status;
  }
  return "ok";
}

/**
 * Hook that wraps the validate-then-persist flow used by both Settings and
 * the onboarding wizard. Returns per-account status and a save() function
 * that mutates the persisted CredentialsStore.
 */
export function useCredentialSave() {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});

  async function save(opts: {
    serviceId: string;
    account: Account;
    persisted: CredentialsStore;
    draftAccountsForService: Account[];
  }): Promise<{ status: SaveStatus; persisted: CredentialsStore | null }> {
    const { serviceId, account, persisted, draftAccountsForService } = opts;
    setStatuses((prev) => ({ ...prev, [account.id]: "saving" }));
    try {
      const validation = await validateAccount(serviceId, account);
      if (validation === "expired") {
        setStatuses((prev) => ({ ...prev, [account.id]: "expired" }));
        return { status: "expired", persisted: null };
      }
      if (validation === "error") {
        setStatuses((prev) => ({ ...prev, [account.id]: "error" }));
        return { status: "error", persisted: null };
      }
      const next: CredentialsStore = { ...persisted, [serviceId]: draftAccountsForService };
      await saveCredentials(next);
      setStatuses((prev) => ({ ...prev, [account.id]: "saved" }));
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [account.id]: "idle" }));
      }, 800);
      return { status: "saved", persisted: next };
    } catch (e) {
      console.error("Failed to save credentials", e);
      setStatuses((prev) => ({ ...prev, [account.id]: "error" }));
      return { status: "error", persisted: null };
    }
  }

  function resetStatus(accountId: string) {
    setStatuses((prev) => ({ ...prev, [accountId]: "idle" }));
  }

  return { statuses, save, resetStatus };
}
```

- [ ] **Step 2: Refactor `src/pages/Settings.tsx` to use the hook**

Replace the existing `statuses` state, `handleSave`, and `setAccountField`'s status reset with hook usage.

In imports, add:
```ts
import { useCredentialSave } from "@/lib/credentialSave";
```

Remove these imports (they move into the hook):
```ts
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { fetchCopilotUsage } from "@/lib/api/copilot";
```

Remove the type `StatusMap` (line 51) and the `useState<StatusMap>` hook (line 80).

Inside the component, replace with:
```ts
const { statuses, save, resetStatus } = useCredentialSave();
```

Update `setAccountField` (line 120) to call `resetStatus(accountId)` instead of `setStatuses(...)`:
```ts
function setAccountField(serviceId: string, accountId: string, key: string, value: string) {
  setDraft((prev) => ({
    ...prev,
    [serviceId]: (prev[serviceId] ?? []).map((a) =>
      a.id === accountId ? { ...a, credentials: { ...a.credentials, [key]: value } } : a
    ),
  }));
  resetStatus(accountId);
}
```

Replace `handleSave` (lines 160–202) with:
```ts
async function handleSave(serviceId: string, accountId: string) {
  const account = (draft[serviceId] ?? []).find((a) => a.id === accountId);
  if (!account) return;
  const result = await save({
    serviceId,
    account,
    persisted,
    draftAccountsForService: draft[serviceId] ?? [],
  });
  if (result.persisted) {
    setPersisted(result.persisted);
  }
}
```

- [ ] **Step 3: Type-check and run**

Run: `npm run build`
Expected: PASS.

Then run the app: `npm run tauri dev`. Open Settings, paste a known-good credential into one service, click Save. Verify the Validating → Saved → idle states still appear identically. Quit the dev process.

- [ ] **Step 4: Commit**

```bash
git add src/lib/credentialSave.ts src/pages/Settings.tsx
git commit -m "refactor(settings): extract useCredentialSave hook for wizard reuse"
```

---

## Task 4: Add placeholder onboarding screenshots

The screenshots are 1×1 transparent PNGs initially so imports type-check; real screenshots are dropped in later. The bytes below are a canonical 67-byte transparent PNG.

- [ ] **Step 1: Create the asset directory and placeholder PNGs**

```bash
mkdir -p src/assets/onboarding
PNG_B64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
for s in claude chatgpt cursor copilot; do
  printf '%s' "$PNG_B64" | base64 -d > "src/assets/onboarding/$s.png"
done
```

- [ ] **Step 2: Verify each file is a valid PNG (67 bytes)**

Run: `ls -la src/assets/onboarding/`
Expected: 4 files, each 67 bytes (`claude.png chatgpt.png cursor.png copilot.png`).

Run: `file src/assets/onboarding/claude.png`
Expected: `PNG image data, 1 x 1, ...`.

- [ ] **Step 3: Commit**

```bash
git add src/assets/onboarding/
git commit -m "chore(onboarding): add placeholder screenshot assets"
```

---

## Task 5: Guide content module

**Files:**
- Create: `src/lib/onboarding/guides.ts`

- [ ] **Step 1: Create the file**

```ts
import claudeShot from "@/assets/onboarding/claude.png";
import chatgptShot from "@/assets/onboarding/chatgpt.png";
import cursorShot from "@/assets/onboarding/cursor.png";
import copilotShot from "@/assets/onboarding/copilot.png";

export type GuideStep = {
  text: string;
  /** Optional copy-button command. Renders as a <pre> with copy affordance. */
  code?: string;
};

export type CredentialGuideContent = {
  serviceId: string;
  intro: string;
  steps: GuideStep[];
  screenshot?: string;
  screenshotCaption?: string;
  /** Used by Gemini in lieu of a screenshot — a short expected-output block. */
  inlineCode?: string;
  troubleshooting?: string;
};

export const GUIDES: Record<string, CredentialGuideContent> = {
  claude: {
    serviceId: "claude",
    intro: "Claude needs your organization ID and session cookie from claude.ai.",
    steps: [
      { text: "Open claude.ai in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to Application → Cookies → https://claude.ai." },
      { text: "Copy the value of the cookie named sessionKey — it starts with sk-ant-." },
      { text: "Switch to the Network tab, refresh the page, and click any request whose URL contains /api/organizations/. Copy the UUID between organizations/ and /usage in the URL — that's your Organization ID." },
    ],
    screenshot: claudeShot,
    screenshotCaption: "DevTools → Application → Cookies. Copy the sessionKey value.",
    troubleshooting: "If sessionKey is missing, sign out and sign back in to claude.ai.",
  },
  chatgpt: {
    serviceId: "chatgpt",
    intro: "ChatGPT (Codex) needs the Authorization header from any chatgpt.com request.",
    steps: [
      { text: "Open chatgpt.com in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to the Network tab and refresh the page." },
      { text: "Click any request to chatgpt.com (e.g. /backend-api/conversations)." },
      { text: "Under Request Headers, find Authorization. Copy everything after Bearer (do not include the word \"Bearer\" or the leading space)." },
    ],
    screenshot: chatgptShot,
    screenshotCaption: "Network tab → click any request → copy the Authorization header.",
    troubleshooting: "Tokens start with eyJ. If yours doesn't, you copied the wrong header.",
  },
  cursor: {
    serviceId: "cursor",
    intro: "Cursor needs the WorkosCursorSessionToken cookie from cursor.com.",
    steps: [
      { text: "Open cursor.com in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to Application → Cookies → https://cursor.com." },
      { text: "Find the cookie named WorkosCursorSessionToken and copy its value." },
    ],
    screenshot: cursorShot,
    screenshotCaption: "DevTools → Application → Cookies → WorkosCursorSessionToken.",
    troubleshooting: "If the cookie is missing, sign out and back into cursor.com first.",
  },
  copilot: {
    serviceId: "copilot",
    intro: "GitHub Copilot needs the user_session cookie from github.com.",
    steps: [
      { text: "Open github.com in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to Application → Cookies → https://github.com." },
      { text: "Find the cookie named user_session and copy its value." },
    ],
    screenshot: copilotShot,
    screenshotCaption: "DevTools → Application → Cookies → github.com → user_session.",
    troubleshooting: "Make sure you're signed into github.com (not just GitHub Copilot in your editor).",
  },
  gemini: {
    serviceId: "gemini",
    intro: "Gemini CLI is auto-detected from your local OAuth credentials.",
    steps: [
      { text: "Install the Gemini CLI if you haven't already (npm i -g @google/gemini-cli)." },
      { text: "Run this in your terminal:", code: "gemini auth login" },
      { text: "Sign in with your Google account in the browser tab that opens." },
      { text: "Come back to uso.ai and click \"Detect Gemini CLI\" below." },
    ],
    inlineCode: "Logged in as you@example.com\nCredentials saved to ~/.gemini/oauth_creds.json",
    troubleshooting: "uso.ai reads ~/.gemini/oauth_creds.json. API key and Vertex AI auth modes are not supported.",
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/onboarding/guides.ts
git commit -m "feat(onboarding): add per-service credential guide content"
```

---

## Task 6: `<CredentialGuide />` component

**Files:**
- Create: `src/components/CredentialGuide.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { GUIDES, type CredentialGuideContent } from "@/lib/onboarding/guides";

type Props = {
  serviceId: string;
};

export function CredentialGuide({ serviceId }: Props) {
  const guide: CredentialGuideContent | undefined = GUIDES[serviceId];
  if (!guide) return null;

  return (
    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
      <p className="text-foreground">{guide.intro}</p>

      <ol className="list-decimal pl-4 space-y-2">
        {guide.steps.map((step, i) => (
          <li key={i}>
            <span>{step.text}</span>
            {step.code && (
              <CopyableCode className="mt-1.5">{step.code}</CopyableCode>
            )}
          </li>
        ))}
      </ol>

      {guide.screenshot && (
        <figure className="space-y-1.5">
          <img
            src={guide.screenshot}
            alt={guide.screenshotCaption ?? `${serviceId} setup screenshot`}
            className="rounded-md border border-border w-full"
          />
          {guide.screenshotCaption && (
            <figcaption className="text-[11px] italic">
              {guide.screenshotCaption}
            </figcaption>
          )}
        </figure>
      )}

      {guide.inlineCode && !guide.screenshot && (
        <pre className="bg-muted text-foreground rounded-md p-2 text-[11px] font-mono whitespace-pre-wrap">
          {guide.inlineCode}
        </pre>
      )}

      {guide.troubleshooting && (
        <p className="italic">{guide.troubleshooting}</p>
      )}
    </div>
  );
}

function CopyableCode({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`flex items-center gap-2 bg-muted rounded-md px-2 py-1.5 font-mono text-[11px] text-foreground ${className ?? ""}`}>
      <code className="flex-1 truncate">{children}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/CredentialGuide.tsx
git commit -m "feat(onboarding): add CredentialGuide component"
```

---

## Task 7: Embed `<CredentialGuide />` in Settings

Each non-Gemini tab gets a `<details>`-based accordion ("How to find these →") above the input cards. Default open if zero accounts configured for that service, default closed otherwise. The Gemini tab gets the guide above its detect button block.

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Import the component**

Add to the import block:
```ts
import { CredentialGuide } from "@/components/CredentialGuide";
```

- [ ] **Step 2: Add the accordion above each non-Gemini service's input cards**

Inside the `SERVICES.map((service) => { if (service.id === "gemini") return null; ... })` block, immediately inside the returned `<TabsContent>`, add the accordion as the first child before `{accounts.map(...)}`:

```tsx
<TabsContent key={service.id} value={service.id} className="mt-4 space-y-4">
  <details
    className="group border border-border rounded-md px-3 py-2"
    open={(persisted[service.id] ?? []).length === 0}
  >
    <summary className="cursor-pointer text-xs font-medium text-foreground select-none flex items-center justify-between">
      <span>How to find these credentials</span>
      <span className="text-muted-foreground group-open:rotate-90 transition-transform">›</span>
    </summary>
    <div className="mt-3">
      <CredentialGuide serviceId={service.id} />
    </div>
  </details>

  {accounts.map((account) => {
    /* unchanged */
  })}
  {/* + Add account button — unchanged */}
</TabsContent>
```

- [ ] **Step 3: Add the guide to the Gemini tab**

In the `<TabsContent value="gemini">` block, add as the first child of the existing `<CardContent>`, above the existing `<div><p className="text-xs font-medium">Gemini CLI</p>...`:

```tsx
<CredentialGuide serviceId="gemini" />
<div className="border-t border-border/50 my-4" />
```

The existing detect button + status messages stay below.

- [ ] **Step 4: Type-check and visually verify**

Run: `npm run build`
Expected: PASS.

Run: `npm run tauri dev`. Open Settings → Claude tab. Verify accordion is open by default if no Claude credentials exist. Add a service, save, then re-open Settings → accordion is collapsed. Click summary to expand. Verify guide content renders with intro + numbered steps + image + caption + troubleshooting line. Repeat for ChatGPT, Cursor, Copilot, Gemini (Gemini shows the inline `<pre>` block instead of an image).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat(settings): embed CredentialGuide accordion above each service"
```

---

## Task 8: Service picker component

**Files:**
- Create: `src/components/onboarding/ServicePicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/services";

type Props = {
  selected: Set<string>;
  onToggle: (serviceId: string) => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function ServicePicker({ selected, onToggle, onContinue, onSkip }: Props) {
  return (
    <div className="flex flex-col h-full px-6 py-6">
      <div className="space-y-1.5 mb-5">
        <h2 className="text-lg font-semibold">Welcome to uso.ai</h2>
        <p className="text-xs text-muted-foreground">
          Pick the AI services you use. We'll walk you through connecting each one.
        </p>
      </div>

      <div className="space-y-2 flex-1">
        {SERVICES.map((service) => {
          const isOn = selected.has(service.id);
          const displayName = service.id === "chatgpt" ? "ChatGPT" : service.name;
          return (
            <label
              key={service.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer hover:bg-secondary/40 transition-colors"
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(service.id)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <ServiceAvatar name={service.name} size="sm" />
              <span className="text-xs font-medium">{displayName}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip setup
        </button>
        <Button onClick={onContinue} disabled={selected.size === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/ServicePicker.tsx
git commit -m "feat(onboarding): add ServicePicker component"
```

---

## Task 9: Wizard summary component

**Files:**
- Create: `src/components/onboarding/WizardSummary.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  connectedCount: number;
  totalSelected: number;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
};

export function WizardSummary({
  connectedCount,
  totalSelected,
  onOpenDashboard,
  onOpenSettings,
}: Props) {
  const allConnected = connectedCount === totalSelected;
  return (
    <div className="flex flex-col h-full items-center justify-center text-center px-6 py-8 space-y-4">
      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle2 size={24} className="text-primary" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">You're set up.</h2>
        <p className="text-xs text-muted-foreground">
          {allConnected
            ? `${connectedCount} ${connectedCount === 1 ? "service" : "services"} connected.`
            : `${connectedCount} of ${totalSelected} connected. You can finish the rest in Settings whenever.`}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
        <Button onClick={onOpenDashboard} className="w-full">
          Open Dashboard
        </Button>
        <Button variant="outline" onClick={onOpenSettings} className="w-full">
          Add more in Settings
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/WizardSummary.tsx
git commit -m "feat(onboarding): add WizardSummary component"
```

---

## Task 10: `<OnboardingWizard />` shell

This is the largest task. The wizard:
- Renders as a full-screen overlay inside the menu bar window.
- Step 0: ServicePicker.
- Steps 1..N: Per-service guide + input form (or, for Gemini, detect button).
- Step N+1: WizardSummary.
- "X" button at top right at any step → confirm if any progress saved, else dismiss silently.
- On dismiss, sets `dismissed = true`. On reaching summary, sets `completed = true`.

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { CredentialGuide } from "@/components/CredentialGuide";
import { ServicePicker } from "@/components/onboarding/ServicePicker";
import { WizardSummary } from "@/components/onboarding/WizardSummary";
import { SERVICES } from "@/lib/services";
import {
  loadCredentials,
  saveCredentials,
  isAccountConfigured,
  type Account,
  type CredentialsStore,
} from "@/lib/credentials";
import { useCredentialSave } from "@/lib/credentialSave";
import {
  setOnboardingDismissed,
  setOnboardingCompleted,
} from "@/lib/onboarding/state";
import { fetchGeminiModels } from "@/lib/api/gemini";

const PASSWORD_PLACEHOLDER = "•••••";

type Props = {
  /** Called whenever the wizard finishes (saved or dismissed). */
  onClose: (didComplete: boolean) => void;
  onOpenSettings: () => void;
};

type WizardStep =
  | { kind: "picker" }
  | { kind: "service"; index: number }
  | { kind: "summary" };

export function OnboardingWizard({ onClose, onOpenSettings }: Props) {
  const [persisted, setPersisted] = useState<CredentialsStore>({});
  const [draftAccounts, setDraftAccounts] = useState<Record<string, Account>>({});
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(SERVICES.map((s) => s.id))
  );
  const [step, setStep] = useState<WizardStep>({ kind: "picker" });
  const [geminiState, setGeminiState] = useState<{
    status: "idle" | "detecting" | "detected" | "not_found" | "expired" | "error";
    email?: string;
  }>({ status: "idle" });

  const { statuses, save } = useCredentialSave();

  useEffect(() => {
    loadCredentials().then((creds) => setPersisted(creds));
  }, []);

  const orderedSelected = SERVICES.filter((s) => selected.has(s.id)).map((s) => s.id);
  const connectedCount = orderedSelected.filter((id) => {
    if (id === "gemini") return geminiState.status === "detected";
    const accounts = persisted[id] ?? [];
    return accounts.some((a) => isAccountConfigured(id, a));
  }).length;

  function toggle(serviceId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  function getDraft(serviceId: string): Account {
    return (
      draftAccounts[serviceId] ?? {
        id: crypto.randomUUID(),
        label: "Default",
        credentials: {},
      }
    );
  }

  function setDraftField(serviceId: string, key: string, value: string) {
    setDraftAccounts((prev) => {
      const current = prev[serviceId] ?? {
        id: crypto.randomUUID(),
        label: "Default",
        credentials: {},
      };
      return {
        ...prev,
        [serviceId]: {
          ...current,
          credentials: { ...current.credentials, [key]: value },
        },
      };
    });
  }

  function setDraftLabel(serviceId: string, label: string) {
    setDraftAccounts((prev) => {
      const current = prev[serviceId] ?? {
        id: crypto.randomUUID(),
        label: "Default",
        credentials: {},
      };
      return { ...prev, [serviceId]: { ...current, label } };
    });
  }

  function advance() {
    if (step.kind === "picker") {
      if (orderedSelected.length === 0) return;
      setStep({ kind: "service", index: 0 });
      return;
    }
    if (step.kind === "service") {
      const next = step.index + 1;
      if (next >= orderedSelected.length) {
        void setOnboardingCompleted();
        setStep({ kind: "summary" });
      } else {
        setStep({ kind: "service", index: next });
      }
    }
  }

  function dismiss() {
    void setOnboardingDismissed();
    onClose(false);
  }

  function handleClose() {
    if (connectedCount > 0) {
      const ok = window.confirm(
        "Close the walkthrough? Saved credentials are kept; you can finish setup later from Settings."
      );
      if (!ok) return;
    }
    dismiss();
  }

  async function handleSaveService(serviceId: string) {
    const account = getDraft(serviceId);
    const existing = persisted[serviceId] ?? [];
    const draftAccountsForService = [
      ...existing.filter((a) => a.id !== account.id),
      account,
    ];
    const result = await save({
      serviceId,
      account,
      persisted,
      draftAccountsForService,
    });
    if (result.persisted) {
      setPersisted(result.persisted);
      advance();
    }
  }

  async function handleDetectGemini() {
    setGeminiState({ status: "detecting" });
    const result = await fetchGeminiModels();
    if (result.status === "ok") {
      setGeminiState({ status: "detected", email: result.email });
    } else if (result.status === "not_configured") {
      setGeminiState({ status: "not_found" });
    } else if (result.status === "expired") {
      setGeminiState({ status: "expired" });
    } else {
      setGeminiState({ status: "error" });
    }
  }

  function renderStepBody() {
    if (step.kind === "picker") {
      return (
        <ServicePicker
          selected={selected}
          onToggle={toggle}
          onContinue={advance}
          onSkip={dismiss}
        />
      );
    }
    if (step.kind === "summary") {
      return (
        <WizardSummary
          connectedCount={connectedCount}
          totalSelected={orderedSelected.length}
          onOpenDashboard={() => onClose(true)}
          onOpenSettings={() => {
            onClose(true);
            onOpenSettings();
          }}
        />
      );
    }
    const serviceId = orderedSelected[step.index];
    const service = SERVICES.find((s) => s.id === serviceId);
    if (!service) return null;
    const account = getDraft(serviceId);
    const status = statuses[account.id] ?? "idle";
    const isGemini = serviceId === "gemini";
    const canSave = !isGemini && service.fields.every((f) => !!account.credentials[f.key]?.trim());

    return (
      <div className="flex flex-col h-full px-6 py-5 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <ServiceAvatar name={service.name} size="sm" />
          <h2 className="text-sm font-semibold flex-1">
            Connect {service.id === "chatgpt" ? "ChatGPT" : service.name}
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {step.index + 1} of {orderedSelected.length}
          </span>
        </div>

        <div className="space-y-4">
          <CredentialGuide serviceId={serviceId} />

          {!isGemini && (
            <Card>
              <CardContent className="px-4 py-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`wizard-${serviceId}-label`} className="text-xs font-medium">
                    Account label
                  </Label>
                  <Input
                    id={`wizard-${serviceId}-label`}
                    placeholder="e.g. Personal, Work"
                    value={account.label}
                    onChange={(e) => setDraftLabel(serviceId, e.target.value)}
                    className="text-xs"
                  />
                </div>
                {service.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label
                      htmlFor={`wizard-${serviceId}-${field.key}`}
                      className="text-xs font-medium"
                    >
                      {field.label}
                    </Label>
                    <Input
                      id={`wizard-${serviceId}-${field.key}`}
                      type="password"
                      placeholder={field.placeholder || PASSWORD_PLACEHOLDER}
                      value={account.credentials[field.key] ?? ""}
                      onChange={(e) => setDraftField(serviceId, field.key, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
                <Button
                  onClick={() => handleSaveService(serviceId)}
                  className="w-full"
                  disabled={status === "saving" || !canSave}
                  variant={status === "error" || status === "expired" ? "destructive" : "default"}
                >
                  {status === "saving" && (
                    <><Loader2 size={13} className="animate-spin mr-2" />Validating...</>
                  )}
                  {status === "saved" && "✓ Saved"}
                  {status === "expired" && "Token is expired or invalid"}
                  {status === "error" && "Failed — check your credentials"}
                  {status === "idle" && "Save & Continue"}
                </Button>
              </CardContent>
            </Card>
          )}

          {isGemini && (
            <Card>
              <CardContent className="px-4 py-3 space-y-3">
                <Button
                  onClick={handleDetectGemini}
                  disabled={geminiState.status === "detecting"}
                  className="w-full"
                >
                  {geminiState.status === "detecting" && (
                    <><Loader2 size={13} className="animate-spin mr-2" />Detecting...</>
                  )}
                  {geminiState.status !== "detecting" && "Detect Gemini CLI"}
                </Button>
                {geminiState.status === "detected" && (
                  <p className="text-xs text-green-500 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    {geminiState.email
                      ? `Connected as ${geminiState.email}`
                      : "Gemini CLI detected"}
                  </p>
                )}
                {geminiState.status === "not_found" && (
                  <p className="text-xs text-destructive">
                    Gemini CLI not found. Run <code className="font-mono">gemini auth login</code> first.
                  </p>
                )}
                {geminiState.status === "expired" && (
                  <p className="text-xs text-destructive">
                    Session expired. Re-run <code className="font-mono">gemini auth login</code>.
                  </p>
                )}
                {geminiState.status === "error" && (
                  <p className="text-xs text-destructive">
                    Could not fetch Gemini quota. Check your connection.
                  </p>
                )}
                {geminiState.status === "detected" ? (
                  <Button onClick={advance} className="w-full" variant="outline">
                    Continue
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={advance}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center pt-1"
                  >
                    Skip this one
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {!isGemini && (
            <button
              type="button"
              onClick={advance}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              Skip this one
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background rounded-xl">
      <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Setup walkthrough</span>
        <button
          type="button"
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{renderStepBody()}</div>
    </div>
  );
}
```

> Note: the unused imports `loadCredentials` and `saveCredentials` from `@/lib/credentials` may surface lint warnings — keep only `isAccountConfigured`, `Account`, and `CredentialsStore` if so.

- [ ] **Step 2: Trim the import to only what's used**

Final import line for `@/lib/credentials`:
```ts
import {
  loadCredentials,
  isAccountConfigured,
  type Account,
  type CredentialsStore,
} from "@/lib/credentials";
```

(`saveCredentials` is not used here directly — the hook does it.)

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/OnboardingWizard.tsx
git commit -m "feat(onboarding): add OnboardingWizard shell"
```

---

## Task 11: Mount the wizard from `App.tsx`

The wizard mounts when `!state.dismissed && !state.completed && noAccountsConfigured && !geminiDetected`. A `showWizard` ref-state lets `App.tsx` re-mount it manually for re-entry from Dashboard / Settings.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update imports**

Add:
```ts
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { loadCredentials, isAccountConfigured } from "@/lib/credentials";
import { loadOnboardingState } from "@/lib/onboarding/state";
import { exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { SERVICES } from "@/lib/services";
```

- [ ] **Step 2: Add wizard state and auto-show effect**

Inside `App()`, after the existing `useState` calls and before the existing effects:

```ts
const [showWizard, setShowWizard] = useState(false);

useEffect(() => {
  let cancelled = false;
  (async () => {
    const [state, creds, geminiDetected] = await Promise.all([
      loadOnboardingState(),
      loadCredentials(),
      exists(".gemini/oauth_creds.json", { baseDir: BaseDirectory.Home }).catch(() => false),
    ]);
    if (cancelled) return;
    if (state.dismissed || state.completed) return;
    const noAccounts = SERVICES.every((s) => {
      const accounts = creds[s.id] ?? [];
      return !accounts.some((a) => isAccountConfigured(s.id, a));
    });
    if (noAccounts && !geminiDetected) {
      setShowWizard(true);
    }
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 3: Render the wizard at the bottom of the root div**

At the bottom of the JSX returned from `App()`, just before the closing `</div>` of the root container:

```tsx
{showWizard && (
  <OnboardingWizard
    onClose={() => setShowWizard(false)}
    onOpenSettings={() => {
      setShowWizard(false);
      setPage("settings");
    }}
  />
)}
```

- [ ] **Step 4: Pass a `onOpenWizard` prop to children**

Add `setShowWizard(true)` exposure to children. Update the Dashboard and Settings render to pass it down:

```tsx
{page === "dashboard" ? (
  <Dashboard
    onNavigateToSettings={navigateToSettings}
    onOpenWizard={() => setShowWizard(true)}
  />
) : (
  <Settings
    tab={settingsTab}
    onTabChange={setSettingsTab}
    onOpenWizard={() => setShowWizard(true)}
  />
)}
```

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: TypeScript will fail until Tasks 12 and 13 add the new props to Dashboard/Settings. That's fine — proceed to those tasks. Do not commit yet.

> If you prefer green builds between every task, do Steps 1–3 here, then jump to Task 12, then Task 13, then come back and add Step 4 + commit. Either order works because Tasks 12/13 don't depend on Step 4.

- [ ] **Step 6: Commit (after Tasks 12 and 13 also done)**

```bash
git add src/App.tsx
git commit -m "feat(onboarding): mount wizard on first launch and on demand"
```

---

## Task 12: Dashboard empty state with "Run setup walkthrough"

**Files:**
- Modify: `src/pages/Dashboard.tsx:23` (Props), `src/pages/Dashboard.tsx:275-291` (empty state)

- [ ] **Step 1: Add the new prop to `Props`**

Replace line 23:
```ts
type Props = {
  onNavigateToSettings?: (serviceId?: string) => void;
  onOpenWizard?: () => void;
};
```

And the function signature:
```ts
export default function Dashboard({ onNavigateToSettings, onOpenWizard }: Props) {
```

- [ ] **Step 2: Replace the empty state**

Replace the existing empty-state block (lines 275–291) with:

```tsx
{!loading && services.length === 0 && !fetchError && (
  <div className="flex flex-col items-center text-center py-12 px-6">
    <div className="size-10 rounded-full bg-secondary flex items-center justify-center mb-3">
      <Inbox size={18} className="text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-foreground">No services configured</p>
    <p className="text-xs text-muted-foreground mt-1 mb-4">
      Connect a provider to start tracking usage.
    </p>
    <div className="flex flex-col gap-2 w-full max-w-[220px]">
      <button
        onClick={() => onOpenWizard?.()}
        className="text-xs font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Run setup walkthrough
      </button>
      <button
        onClick={() => onNavigateToSettings?.()}
        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Open Settings
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS once Task 13 is also done. (Settings still has the old props at this point.)

- [ ] **Step 4: Commit (with Task 13 and Task 11 step 6)**

Continue to Task 13 before committing.

---

## Task 13: Settings header re-entry link + new prop

**Files:**
- Modify: `src/pages/Settings.tsx:53-56` (Props), `src/pages/Settings.tsx:236-241` (header)

- [ ] **Step 1: Update `Props`**

Replace:
```ts
type Props = {
  tab?: string;
  onTabChange?: (tab: string) => void;
  onOpenWizard?: () => void;
};
```

And the destructure in the function signature:
```ts
export default function Settings({ tab, onTabChange, onOpenWizard }: Props) {
```

- [ ] **Step 2: Add the link in the credentials header**

Replace the existing `<div>` block at lines 236–241:

```tsx
<div className="flex items-start justify-between gap-3">
  <div>
    <h2 className="text-base font-semibold">Credentials</h2>
    <p className="text-xs text-muted-foreground mt-0.5">
      Session tokens are stored locally and never leave this app.
    </p>
  </div>
  <button
    type="button"
    onClick={() => onOpenWizard?.()}
    className="text-xs font-medium text-primary hover:opacity-80 transition-opacity shrink-0 mt-0.5"
  >
    Show setup walkthrough →
  </button>
</div>
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit Tasks 11 + 12 + 13 together**

```bash
git add src/App.tsx src/pages/Dashboard.tsx src/pages/Settings.tsx
git commit -m "feat(onboarding): wire wizard into App, Dashboard, and Settings"
```

---

## Task 14: Manual smoke test

The repo has no automated test suite for the React layer, so manual verification is the gate.

- [ ] **Step 1: Reset onboarding state for a fresh-install simulation**

```bash
# Find tauri-plugin-store data files (path varies by macOS version)
find "$HOME/Library/Application Support" -name "onboarding.json" -o -name "credentials.json" 2>/dev/null
```

Move them aside (don't delete in case you have real credentials):
```bash
# Replace <path> with what `find` returned
mv <path>/credentials.json{,.bak} 2>/dev/null
mv <path>/onboarding.json{,.bak} 2>/dev/null
```

- [ ] **Step 2: Run the app and verify auto-show**

Run: `npm run tauri dev`. Click the menu bar icon. The wizard should appear automatically over the Dashboard.

- [ ] **Step 3: Verify ServicePicker behavior**

- All 5 services checked by default.
- Uncheck all → "Continue" disabled.
- Check at least one → "Continue" enabled.
- Click "Skip setup" → wizard closes; relaunching the app does not re-show the wizard.

Restore the dismissed flag for the next test:
```bash
rm "<path>/onboarding.json"
```

- [ ] **Step 4: Verify per-service step rendering**

Re-launch app. Pick all 5 services. "Continue".

- Step 1 of 5 (Claude): guide intro + 5 numbered steps + screenshot + caption + troubleshooting + label/orgId/sessionKey inputs + Save & Continue + Skip this one.
- Step header reads "1 of 5".
- Click "Skip this one" → advances to ChatGPT (2 of 5).
- Continue through ChatGPT (skip), Cursor (skip), Copilot (skip).
- Step 5 (Gemini): guide + inline `<pre>` block (no screenshot) + Detect button + Skip. Click Detect with the CLI not installed → "Gemini CLI not found" message.
- Skip Gemini → land on Summary.

- [ ] **Step 5: Verify Save flow with a real credential**

Re-reset state. Re-launch. Pick Claude only. Continue. Paste a real `orgId` and `sessionKey`. Click "Save & Continue". Verify the button cycles Validating → ✓ Saved → advances to summary.

- [ ] **Step 6: Verify error state**

Re-reset state. Re-launch. Pick ChatGPT only. Paste an obviously bad token like `not-a-token`. Save. Verify the button turns destructive with "Token is expired or invalid" or "Failed — check your credentials".

- [ ] **Step 7: Verify Settings accordion + re-entry**

Open Settings. Verify each non-Gemini tab shows the "How to find these credentials ›" accordion above its input cards, open by default for un-configured services and collapsed for configured ones. Verify Gemini tab shows the guide above the detect block.

Verify the "Show setup walkthrough →" link in the Credentials header relaunches the wizard.

- [ ] **Step 8: Verify Dashboard empty state**

With all credentials cleared, open Dashboard. Verify the empty state shows two buttons: "Run setup walkthrough" (primary) and "Open Settings" (secondary). Click the first → wizard opens.

- [ ] **Step 9: Quit dev process and restore real data**

```bash
# Replace <path> with the same path used above
mv <path>/credentials.json.bak <path>/credentials.json 2>/dev/null
mv <path>/onboarding.json.bak <path>/onboarding.json 2>/dev/null
```

- [ ] **Step 10: Commit (no code changes — record in PR description)**

There are no code changes from manual testing; just confirm everything in steps 2–8 worked. If anything failed, file follow-up commits before opening the PR.

---

## Self-review

**Spec coverage:**
- First-run wizard with service picker → Tasks 8, 10, 11.
- Per-service guides shared between wizard and Settings → Tasks 5, 6, 7, 10.
- Wizard embeds credential inputs reusing validation → Tasks 3, 10.
- Gemini special-case (Detect button) → Task 10.
- Anchor screenshots (4 PNGs) → Tasks 4, 5.
- Lifecycle flags → Tasks 2, 10, 11.
- Dashboard empty-state re-entry → Task 12.
- Settings header re-entry → Task 13.
- Settings accordion default-state rule → Task 7.

**Placeholders:** No "TBD" / "implement later" / "similar to" — every step has the actual code.

**Type consistency:**
- `isAccountConfigured(serviceId, account)` signature is consistent across Tasks 1, 10, 11.
- `useCredentialSave().save(opts)` opts shape is consistent in Tasks 3, 10.
- `OnboardingState` shape is consistent in Tasks 2, 11.
- `SaveStatus` union is consistent in Task 3 and the wizard's `statuses[account.id] ?? "idle"` access in Task 10.
- Wizard `Props` (`onClose`, `onOpenSettings`) match call sites in Task 11.
- New `onOpenWizard?: () => void` prop is added to Dashboard (Task 12) and Settings (Task 13) and provided from App (Task 11).

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-05-04-onboarding.md`.
