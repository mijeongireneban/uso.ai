import { fetch } from "@tauri-apps/plugin-http";
import { readTextFile, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { formatResetTime } from "@/lib/api/utils";
import {
  loadPreferences,
  isGeminiModelAutoHidden,
  isGeminiModelVisible,
} from "@/lib/preferences";
import type { ServiceData } from "@/types";

// ── OAuth constants (public, from open-source Gemini CLI) ─────────────────────
// Source: https://github.com/google-gemini/gemini-cli
// packages/core/src/code_assist/oauth2.ts
// These are embedded in the distributed CLI app and are intentionally public.
const CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

// Relative paths used with BaseDirectory.Home (tauri-plugin-fs does not expand ~)
const CREDS_PATH = ".gemini/oauth_creds.json" as const;
const SETTINGS_PATH = ".gemini/settings.json" as const;

// ── In-memory token cache ─────────────────────────────────────────────────────
// Prevents repeated OAuth refresh round-trips on every 5-min Dashboard cycle.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

// ── Types ─────────────────────────────────────────────────────────────────────

type OAuthCreds = {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expiry_date: number; // ms since epoch
  token_type: string;
};

type QuotaBucket = {
  modelId?: string;
  model_id?: string;
  remainingFraction?: number | null;
  remaining_fraction?: number | null;
  resetTime?: string;
  reset_time?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwtEmail(idToken: string): string | undefined {
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.email ?? undefined;
  } catch {
    return undefined;
  }
}

function tierToPlan(tier: string): string {
  if (tier === "free-tier") return "Free";
  if (tier === "standard-tier") return "Paid";
  if (tier === "legacy-tier") return "Legacy";
  return "";
}

// "gemini-2.5-flash-lite" → "2.5 Flash Lite", "gemini-3-flash-preview" → "3 Flash Preview"
function formatGeminiModelLabel(modelId: string): string {
  return modelId
    .replace(/^gemini-/, "")
    .split("-")
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function notConfigured(): ServiceData {
  return { accountId: "gemini", name: "Gemini CLI", plan: "", status: "not_configured", windows: [] };
}

function errorResult(plan = ""): ServiceData {
  return { accountId: "gemini", name: "Gemini CLI", plan, status: "error", windows: [] };
}

// ── Token resolution ──────────────────────────────────────────────────────────

async function resolveAccessToken(): Promise<{ accessToken: string; idToken: string } | null> {
  // 1. Use in-memory cache if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    // Cache hit — but we still need idToken for email. Re-read from disk only.
    try {
      const raw = await readTextFile(CREDS_PATH, { baseDir: BaseDirectory.Home });
      const creds = JSON.parse(raw) as OAuthCreds;
      return { accessToken: cachedToken.accessToken, idToken: creds.id_token };
    } catch {
      return null;
    }
  }

  // 2. Read credentials from disk
  let creds: OAuthCreds;
  try {
    const raw = await readTextFile(CREDS_PATH, { baseDir: BaseDirectory.Home });
    creds = JSON.parse(raw) as OAuthCreds;
  } catch {
    return null;
  }

  // 3. If token still valid, use it
  if (creds.expiry_date > Date.now() + 60_000) {
    cachedToken = { accessToken: creds.access_token, expiresAt: creds.expiry_date };
    return { accessToken: creds.access_token, idToken: creds.id_token };
  }

  // 4. Token expired — refresh it
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: creds.refresh_token,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return null; // refresh token itself is expired
    const data = (await res.json()) as { access_token: string; expires_in: number; id_token?: string };
    const expiresAt = Date.now() + data.expires_in * 1000;
    cachedToken = { accessToken: data.access_token, expiresAt };
    return { accessToken: data.access_token, idToken: data.id_token ?? creds.id_token };
  } catch {
    return null;
  }
}

// ── Shared fetch ──────────────────────────────────────────────────────────────
//
// Both the Dashboard (fetchGeminiUsage) and the Settings model-visibility UI
// (fetchGeminiModels) need the same tier + buckets, so the network flow lives
// in a single internal function. The two exports only diverge in how they
// shape the response.

type GeminiRawResult =
  | { status: "not_configured" }
  | { status: "expired" }
  | { status: "error"; tier?: string }
  | { status: "ok"; tier: string; buckets: QuotaBucket[]; email?: string };

async function fetchGeminiRaw(): Promise<GeminiRawResult> {
  const credsExist = await exists(CREDS_PATH, { baseDir: BaseDirectory.Home }).catch(() => false);
  if (!credsExist) return { status: "not_configured" };

  try {
    const settingsRaw = await readTextFile(SETTINGS_PATH, { baseDir: BaseDirectory.Home });
    const settings = JSON.parse(settingsRaw) as { authType?: string };
    if (settings.authType === "api-key" || settings.authType === "vertex-ai") {
      return { status: "not_configured" };
    }
  } catch {
    // settings.json missing or unparseable — proceed (OAuth is the default)
  }

  const tokenResult = await resolveAccessToken();
  if (!tokenResult) return { status: "expired" };
  const { accessToken, idToken } = tokenResult;
  const email = decodeJwtEmail(idToken);

  let tier = "";
  let projectId = "";
  try {
    const res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metadata: {
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
          duetProject: "default",
        },
      }),
    });
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as { tier?: string; cloudaicompanionProject?: string };
    tier = data.tier ?? "";
    projectId = data.cloudaicompanionProject ?? "";
  } catch {
    return { status: "error" };
  }

  if (!projectId) return { status: "error", tier };

  // Google's response uses `buckets` (was `quotaBuckets` in earlier API versions)
  let buckets: QuotaBucket[] = [];
  try {
    const res = await fetch("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project: projectId }),
    });
    if (!res.ok) return { status: "error", tier };
    const data = (await res.json()) as { buckets?: QuotaBucket[]; quotaBuckets?: QuotaBucket[] };
    buckets = data.buckets ?? data.quotaBuckets ?? [];
  } catch {
    return { status: "error", tier };
  }

  return { status: "ok", tier, buckets, email };
}

function bucketModelId(b: QuotaBucket): string {
  return b.modelId ?? b.model_id ?? "";
}

function isTrackedModel(id: string): boolean {
  return id.includes("pro") || id.includes("flash");
}

// ── Main exports ──────────────────────────────────────────────────────────────

export async function fetchGeminiUsage(): Promise<ServiceData> {
  const raw = await fetchGeminiRaw();
  if (raw.status === "not_configured") return notConfigured();
  if (raw.status === "expired") return { accountId: "gemini", name: "Gemini CLI", plan: "", status: "expired", windows: [] };
  if (raw.status === "error") return errorResult(tierToPlan(raw.tier ?? ""));

  const trackedBuckets = raw.buckets.filter((b) => isTrackedModel(bucketModelId(b)));
  if (trackedBuckets.length === 0) return errorResult(tierToPlan(raw.tier));

  const prefs = await loadPreferences();
  const visibility = prefs.geminiModelVisibility;

  const windows = trackedBuckets
    .filter((b) => isGeminiModelVisible(bucketModelId(b), raw.tier, visibility))
    .map((b) => {
      const id = bucketModelId(b);
      const remaining = b.remainingFraction ?? b.remaining_fraction ?? 0;
      const resetIso = b.resetTime ?? b.reset_time ?? null;
      return {
        label: formatGeminiModelLabel(id),
        usedPercent: Math.round((1 - remaining) * 100),
        resetsAt: formatResetTime(resetIso),
      };
    });

  // Zero windows here means the user has hidden every available model. Still
  // surface "ok" so the card and the Settings model list stay reachable —
  // NextResetCard and ServiceDonutCard both guard against empty windows.
  return {
    accountId: "gemini",
    name: "Gemini CLI",
    plan: tierToPlan(raw.tier),
    status: "ok",
    windows,
    email: raw.email,
  };
}

export type GeminiModelInfo = {
  id: string;
  label: string;
  visible: boolean;
  autoHidden: boolean;
};

export type GeminiModelsResult =
  | { status: "not_configured" | "expired" | "error" }
  | {
      status: "ok";
      tier: string;
      plan: string;
      email?: string;
      models: GeminiModelInfo[];
    };

export async function fetchGeminiModels(): Promise<GeminiModelsResult> {
  const raw = await fetchGeminiRaw();
  if (raw.status !== "ok") return { status: raw.status };

  const prefs = await loadPreferences();
  const visibility = prefs.geminiModelVisibility;

  const models: GeminiModelInfo[] = raw.buckets
    .map((b) => bucketModelId(b))
    .filter(isTrackedModel)
    .map((id) => ({
      id,
      label: formatGeminiModelLabel(id),
      visible: isGeminiModelVisible(id, raw.tier, visibility),
      autoHidden: isGeminiModelAutoHidden(id, raw.tier),
    }));

  return {
    status: "ok",
    tier: raw.tier,
    plan: tierToPlan(raw.tier),
    email: raw.email,
    models,
  };
}
