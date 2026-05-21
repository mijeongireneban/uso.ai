import { useState, useEffect, useMemo } from "react";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Trash2,
  Loader2,
  Plus,
  Check,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { SERVICES } from "@/lib/services";
import { loadCredentials, saveCredentials } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { fetchCopilotUsage } from "@/lib/api/copilot";
import { fetchGeminiModels, GEMINI_FREE_TIER } from "@/lib/api/gemini";
import {
  loadPreferences,
  setGeminiModelVisible,
  setExcludeExtraUsageFromTray,
} from "@/lib/preferences";
import { useTheme, type Theme } from "@/lib/useTheme";
import { exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { Account, CredentialsStore } from "@/lib/credentials";
import type { GeminiModelInfo } from "@/lib/api/gemini";

function PasswordInput({
  id, placeholder, value, onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-9 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? "Hide value" : "Show value"}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

type StatusMap = Record<string, "idle" | "saving" | "saved" | "expired" | "error">;

type Props = {
  tab?: string;
  onTabChange?: (tab: string) => void;
};

function isAccountConfigured(account: Account, fields: { key: string }[]): boolean {
  return fields.every((f) => !!account.credentials[f.key]?.trim());
}

function isServiceConfigured(accounts: Account[], fields: { key: string }[]): boolean {
  return accounts.some((a) => isAccountConfigured(a, fields));
}

const APPEARANCE_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Auto",  icon: <Monitor size={11} /> },
  { value: "light",  label: "Light", icon: <Sun size={11} /> },
  { value: "dark",   label: "Dark",  icon: <Moon size={11} /> },
];

export default function Settings({ tab, onTabChange }: Props) {
  const [persisted, setPersisted] = useState<CredentialsStore>({});
  const [draft, setDraft] = useState<CredentialsStore>({});
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [geminiDetected, setGeminiDetected] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<"idle" | "detecting" | "detected" | "not_found" | "unsupported_auth" | "expired" | "error">("idle");
  const [geminiEmail, setGeminiEmail] = useState<string | undefined>(undefined);
  const [geminiTier, setGeminiTier] = useState<string>("");
  const [geminiModels, setGeminiModels] = useState<GeminiModelInfo[]>([]);
  const [excludeExtraFromTray, setExcludeExtraFromTrayState] = useState<Record<string, boolean>>({});
  const { theme, setTheme } = useTheme();

  const activeId = tab && SERVICES.some((s) => s.id === tab) ? tab : SERVICES[0].id;
  const activeService = SERVICES.find((s) => s.id === activeId)!;

  useEffect(() => {
    loadPreferences().then((p) => {
      setExcludeExtraFromTrayState(p.excludeExtraUsageFromTray ?? {});
    });
  }, []);

  async function toggleExcludeExtraFromTray(serviceId: string, exclude: boolean) {
    setExcludeExtraFromTrayState((prev) => ({ ...prev, [serviceId]: exclude }));
    await setExcludeExtraUsageFromTray(serviceId, exclude);
  }

  useEffect(() => {
    loadCredentials().then((creds) => {
      const normalized: CredentialsStore = {};
      for (const s of SERVICES) {
        normalized[s.id] = creds[s.id] ?? [];
      }
      setPersisted(normalized);
      setDraft(JSON.parse(JSON.stringify(normalized)));
    });
  }, []);

  useEffect(() => {
    // tauri-plugin-fs does NOT expand ~ — use BaseDirectory.Home with a relative path
    Promise.all([
      exists(".gemini/oauth_creds.json", { baseDir: BaseDirectory.Home }).catch(() => false),
      fetchGeminiModels(),
    ]).then(([found, result]) => {
      setGeminiDetected(found);
      if (!found) return;
      if (result.status === "ok") {
        setGeminiStatus("detected");
        setGeminiEmail(result.email);
        setGeminiTier(result.tier);
        setGeminiModels(result.models);
      } else if (result.status === "expired") {
        setGeminiStatus("expired");
      } else if (result.status === "error") {
        setGeminiStatus("error");
      }
    });
  }, []);

  function setAccountField(serviceId: string, accountId: string, key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] ?? []).map((a) =>
        a.id === accountId ? { ...a, credentials: { ...a.credentials, [key]: value } } : a
      ),
    }));
    setStatuses((prev) => ({ ...prev, [accountId]: "idle" }));
  }

  function setAccountLabel(serviceId: string, accountId: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] ?? []).map((a) =>
        a.id === accountId ? { ...a, label: value } : a
      ),
    }));
  }

  function addAccount(serviceId: string) {
    const current = draft[serviceId] ?? [];
    const newAccount: Account = {
      id: crypto.randomUUID(),
      label: `Account ${current.length + 1}`,
      credentials: {},
    };
    setDraft((prev) => ({ ...prev, [serviceId]: [...(prev[serviceId] ?? []), newAccount] }));
  }

  async function deleteAccount(serviceId: string, accountId: string) {
    const isInPersisted = (persisted[serviceId] ?? []).some((a) => a.id === accountId);
    const newDraft = { ...draft, [serviceId]: (draft[serviceId] ?? []).filter((a) => a.id !== accountId) };
    setDraft(newDraft);
    if (isInPersisted) {
      const newPersisted = { ...persisted, [serviceId]: (persisted[serviceId] ?? []).filter((a) => a.id !== accountId) };
      await saveCredentials(newPersisted);
      setPersisted(newPersisted);
    }
  }

  // Has this account's draft drifted from what's on disk? Drives the "Save changes"
  // vs "Saved" button label per the design.
  function isAccountDirty(serviceId: string, accountId: string): boolean {
    const draftAcc = (draft[serviceId] ?? []).find((a) => a.id === accountId);
    const persistedAcc = (persisted[serviceId] ?? []).find((a) => a.id === accountId);
    if (!draftAcc) return false;
    if (!persistedAcc) return true; // brand-new account
    return JSON.stringify(draftAcc) !== JSON.stringify(persistedAcc);
  }

  async function handleSave(serviceId: string, accountId: string) {
    setStatuses((prev) => ({ ...prev, [accountId]: "saving" }));
    try {
      const account = (draft[serviceId] ?? []).find((a) => a.id === accountId);
      if (!account) return;

      // Clean common copy-paste mistakes: trailing newlines/spaces, accidental
      // `key=value` prefix (when pasting a cookie pair instead of just the
      // value), wrapping quotes, and URL-encoded characters (Cookie headers in
      // DevTools sometimes show values URL-encoded).
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(account.credentials)) {
        let s = (v ?? "").trim();
        const prefix = `${k}=`;
        if (s.toLowerCase().startsWith(prefix.toLowerCase())) s = s.slice(prefix.length);
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
          s = s.slice(1, -1);
        }
        if (/%[0-9A-Fa-f]{2}/.test(s)) {
          try { s = decodeURIComponent(s); } catch { /* leave as-is */ }
        }
        cleaned[k] = s;
      }
      if (Object.entries(cleaned).some(([k, v]) => v !== account.credentials[k])) {
        setDraft((prev) => ({
          ...prev,
          [serviceId]: (prev[serviceId] ?? []).map((a) =>
            a.id === accountId ? { ...a, credentials: cleaned } : a
          ),
        }));
      }
      const creds = cleaned;
      let validationStatus = "ok";

      if (serviceId === "claude" && creds.orgId && creds.sessionKey) {
        const result = await fetchClaudeUsage(creds.orgId, creds.sessionKey);
        validationStatus = result.status;
      } else if (serviceId === "chatgpt" && creds.bearerToken) {
        const result = await fetchChatGPTUsage(creds.bearerToken);
        validationStatus = result.status;
      } else if (serviceId === "cursor" && creds.sessionToken) {
        const result = await fetchCursorUsage(creds.sessionToken);
        validationStatus = result.status;
      } else if (serviceId === "copilot" && creds.sessionCookie) {
        const result = await fetchCopilotUsage(creds.sessionCookie);
        validationStatus = result.status;
      }

      if (validationStatus === "expired") {
        setStatuses((prev) => ({ ...prev, [accountId]: "expired" }));
        return;
      }
      if (validationStatus === "error") {
        setStatuses((prev) => ({ ...prev, [accountId]: "error" }));
        return;
      }

      const newPersisted = { ...persisted, [serviceId]: draft[serviceId] ?? [] };
      await saveCredentials(newPersisted);
      setPersisted(newPersisted);
      setStatuses((prev) => ({ ...prev, [accountId]: "saved" }));
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [accountId]: "idle" }));
      }, 1600);
    } catch (e) {
      console.error("Failed to save credentials", e);
      setStatuses((prev) => ({ ...prev, [accountId]: "error" }));
    }
  }

  async function handleDetect() {
    setGeminiStatus("detecting");
    setGeminiEmail(undefined);
    const result = await fetchGeminiModels();
    if (result.status === "ok") {
      setGeminiStatus("detected");
      setGeminiEmail(result.email);
      setGeminiTier(result.tier);
      setGeminiModels(result.models);
      setGeminiDetected(true);
    } else if (result.status === "not_configured") {
      setGeminiStatus("not_found");
      setGeminiDetected(false);
      setGeminiModels([]);
    } else if (result.status === "expired") {
      setGeminiStatus("expired");
      setGeminiModels([]);
    } else {
      setGeminiStatus("error");
      setGeminiModels([]);
    }
  }

  async function toggleGeminiModel(modelId: string, visible: boolean) {
    setGeminiModels((prev) =>
      prev.map((m) => (m.id === modelId ? { ...m, visible } : m))
    );
    await setGeminiModelVisible(modelId, visible);
  }

  // Connection state per provider — drives the chip status text and "live" pill.
  const providerState = useMemo(() => {
    return SERVICES.map((s) => {
      const accounts = persisted[s.id] ?? [];
      const configured =
        s.id === "gemini"
          ? geminiDetected
          : isServiceConfigured(accounts, s.fields);
      const accountCount =
        s.id === "gemini"
          ? (geminiDetected ? 1 : 0)
          : accounts.filter((a) => isAccountConfigured(a, s.fields)).length;
      // For non-Gemini we don't track per-account fetch errors in the Settings
      // page — Dashboard owns that — so connection state here is "configured"
      // vs "not connected". Gemini surfaces expired/error from detection.
      const variant: "live" | "off" | "warn" =
        s.id === "gemini"
          ? (geminiStatus === "expired" || geminiStatus === "error" ? "warn" : geminiDetected ? "live" : "off")
          : (configured ? "live" : "off");
      return { service: s, configured, accountCount, variant };
    });
  }, [persisted, geminiDetected, geminiStatus]);

  const activeState = providerState.find((p) => p.service.id === activeId)!;
  const activeAccounts = draft[activeId] ?? [];

  return (
    <div>
      {/* Section 1 — Credentials picker */}
      <section className="set-section pt-2">
        <h2>Credentials</h2>
        <p className="blurb">
          Session tokens are encrypted and stored on this Mac. They never leave the app.
        </p>
        <div className="provider-grid">
          {providerState.map(({ service, accountCount, variant }) => {
            const isActive = service.id === activeId;
            return (
              <button
                key={service.id}
                type="button"
                className="prov-pick"
                data-active={isActive}
                onClick={() => onTabChange?.(service.id)}
              >
                <span className="logo">
                  <ServiceAvatar name={service.name} size="sm" />
                </span>
                <div className="info">
                  <span className="label">
                    {service.id === "chatgpt" ? "ChatGPT" : service.name}
                  </span>
                  <span className="meta">
                    <span className={`meta-dot ${variant === "off" ? "" : variant}`} />
                    {variant === "off"
                      ? "Not connected"
                      : `${accountCount} ${accountCount === 1 ? "account" : "accounts"}`}
                  </span>
                </div>
                {isActive && (
                  <span className="check">
                    <CheckCircle2 size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2 — Active provider editor */}
      <section className="set-section">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="prov-logo">
            <ServiceAvatar name={activeService.name} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold tracking-tight leading-tight truncate">
              {activeService.name}
            </p>
            <p className="text-[10.5px] font-mono text-[var(--text-dim)] mt-0.5 truncate">
              {activeState.variant === "live"
                ? `Connected · ${activeState.accountCount} ${activeState.accountCount === 1 ? "account" : "accounts"}`
                : activeState.variant === "warn"
                ? "Connected · attention needed"
                : "Not connected"}
            </p>
          </div>
          {activeState.variant === "live" && (
            <span className="live-pill">
              <span className="swatch" />
              live
            </span>
          )}
        </div>

        {/* Per-provider body */}
        {activeService.id === "gemini" ? (
          <GeminiPanel
            status={geminiStatus}
            email={geminiEmail}
            tier={geminiTier}
            detected={geminiDetected}
            models={geminiModels}
            onDetect={handleDetect}
            onToggleModel={toggleGeminiModel}
          />
        ) : (
          <div className="space-y-4">
            {activeAccounts.map((account) => {
              const status = statuses[account.id] ?? "idle";
              const canSave = activeService.fields.every(
                (f) => !!account.credentials[f.key]?.trim()
              );
              const dirty = isAccountDirty(activeService.id, account.id);

              return (
                <AccountEditor
                  key={account.id}
                  service={activeService}
                  account={account}
                  status={status}
                  dirty={dirty}
                  canSave={canSave}
                  excludeExtraFromTray={
                    !!excludeExtraFromTray[activeService.id]
                  }
                  onLabel={(v) => setAccountLabel(activeService.id, account.id, v)}
                  onField={(k, v) => setAccountField(activeService.id, account.id, k, v)}
                  onToggleExtra={(exclude) =>
                    toggleExcludeExtraFromTray(activeService.id, exclude)
                  }
                  onSave={() => handleSave(activeService.id, account.id)}
                  onDelete={() => deleteAccount(activeService.id, account.id)}
                />
              );
            })}

            <button
              type="button"
              onClick={() => addAccount(activeService.id)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-dashed border-border-hi text-muted-foreground hover:text-foreground hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
              style={{ borderColor: "var(--border-hi)" }}
            >
              <Plus size={12} />
              {activeAccounts.length === 0
                ? `Connect ${activeService.name}`
                : `Add another ${activeService.name} account`}
            </button>
          </div>
        )}
      </section>

      {/* Section 3 — App preferences */}
      <section className="set-section">
        <h2>App preferences</h2>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Appearance</p>
              <p className="text-[10.5px] font-mono text-[var(--text-dim)] mt-0.5">
                Currently using {effectiveThemeLabel(theme)}
              </p>
            </div>
            <div className="seg-control" role="tablist">
              {APPEARANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-active={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function effectiveThemeLabel(t: Theme): string {
  if (t === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark (auto)" : "light (auto)";
  }
  return t;
}

/* ====================================================================== */
/*  AccountEditor — the per-account form (label + creds + toggles + save).
/*  Pulled into its own component so the Settings page reads top-to-bottom.
/* ====================================================================== */

type AccountEditorProps = {
  service: (typeof SERVICES)[number];
  account: Account;
  status: StatusMap[string];
  dirty: boolean;
  canSave: boolean;
  excludeExtraFromTray: boolean;
  onLabel: (v: string) => void;
  onField: (key: string, v: string) => void;
  onToggleExtra: (exclude: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
};

function AccountEditor({
  service,
  account,
  status,
  dirty,
  canSave,
  excludeExtraFromTray,
  onLabel,
  onField,
  onToggleExtra,
  onSave,
  onDelete,
}: AccountEditorProps) {
  const showExtraToggle = service.id === "claude" || service.id === "cursor";
  const isErrored = status === "expired" || status === "error";

  let saveLabel: React.ReactNode;
  if (status === "saving") saveLabel = (<><Loader2 size={12} className="animate-spin" />Validating…</>);
  else if (status === "saved") saveLabel = (<><Check size={12} />Saved</>);
  else if (status === "expired") saveLabel = "Token is expired or invalid";
  else if (status === "error") saveLabel = "Failed — check your credentials";
  else if (dirty) saveLabel = "Save changes";
  else saveLabel = "Saved";

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <Label htmlFor={`${account.id}-label`} className="text-xs font-medium">
          Account label
        </Label>
        <Input
          id={`${account.id}-label`}
          placeholder="e.g. Personal, Work"
          value={account.label}
          onChange={(e) => onLabel(e.target.value)}
          className="text-xs"
        />
      </div>

      {service.fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`${account.id}-${field.key}`} className="text-xs font-medium">
            {field.label}
          </Label>
          <PasswordInput
            id={`${account.id}-${field.key}`}
            placeholder={field.placeholder}
            value={account.credentials[field.key] ?? ""}
            onChange={(v) => onField(field.key, v)}
          />
          <p className="text-[10.5px] font-mono text-[var(--text-dim)] leading-relaxed">
            {field.hint}
          </p>
        </div>
      ))}

      {showExtraToggle && (
        <label className="flex items-start gap-2 cursor-pointer select-none py-0.5">
          <input
            type="checkbox"
            checked={!excludeExtraFromTray}
            onChange={(e) => onToggleExtra(!e.target.checked)}
            className="h-3.5 w-3.5 mt-0.5 rounded border-border accent-[var(--accent)] shrink-0"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            Count extra usage toward menu bar warning
          </span>
        </label>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={onSave}
          disabled={status === "saving" || !canSave || (!dirty && status === "idle")}
          variant={isErrored ? "destructive" : "default"}
          className="px-3.5"
        >
          {saveLabel}
        </Button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--destructive)] border border-border hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] hover:border-[var(--destructive)] transition-colors"
          title="Delete account"
          aria-label="Delete account"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {status === "saved" && (
        <div className="set-banner success">
          <span className="ico"><CheckCircle2 size={14} /></span>
          <div>
            <strong>Credentials saved.</strong>
            <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
              Validated against {service.name} · usage will refresh on the next cycle
            </div>
          </div>
        </div>
      )}
      {isErrored && (
        <div className="set-banner error">
          <span className="ico"><AlertTriangle size={14} /></span>
          <div>
            <strong>
              {status === "expired" ? "Token is expired or invalid." : "We couldn't reach this provider."}
            </strong>
            <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
              {status === "expired"
                ? "Grab a fresh value from the provider and save again."
                : "Double-check the credentials and your connection, then retry."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  GeminiPanel — file-based detection flow (not credential store).
/* ====================================================================== */

type GeminiPanelProps = {
  status: "idle" | "detecting" | "detected" | "not_found" | "unsupported_auth" | "expired" | "error";
  email?: string;
  tier: string;
  detected: boolean;
  models: GeminiModelInfo[];
  onDetect: () => void;
  onToggleModel: (modelId: string, visible: boolean) => void;
};

function GeminiPanel({
  status,
  email,
  tier,
  detected,
  models,
  onDetect,
  onToggleModel,
}: GeminiPanelProps) {
  return (
    <div className="space-y-3.5">
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        Reads credentials from{" "}
        <code className="font-mono text-[10.5px] bg-secondary text-foreground/80 px-1 py-0.5 rounded">
          ~/.gemini/oauth_creds.json
        </code>
        . Run{" "}
        <code className="font-mono text-[10.5px] bg-secondary text-foreground/80 px-1 py-0.5 rounded">
          gemini auth login
        </code>{" "}
        in your terminal first.
      </p>

      <Button
        onClick={onDetect}
        disabled={status === "detecting"}
        className="w-full"
      >
        {status === "detecting" ? (
          <><Loader2 size={12} className="animate-spin" />Detecting…</>
        ) : (
          <>{detected ? "Re-detect Gemini CLI" : "Detect Gemini CLI"}</>
        )}
      </Button>

      {status === "detected" && (
        <div className="set-banner success">
          <span className="ico"><CheckCircle2 size={14} /></span>
          <div>
            <strong>{email ? `Connected as ${email}` : "Gemini CLI detected"}</strong>
            {tier && (
              <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
                Tier · {tier}
              </div>
            )}
          </div>
        </div>
      )}
      {status === "not_found" && (
        <div className="set-banner error">
          <span className="ico"><AlertTriangle size={14} /></span>
          <div>
            <strong>Gemini CLI not found.</strong>
            <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
              Run <code className="font-mono">gemini auth login</code> first.
            </div>
          </div>
        </div>
      )}
      {status === "unsupported_auth" && (
        <div className="set-banner error">
          <span className="ico"><AlertTriangle size={14} /></span>
          <div>
            <strong>OAuth required.</strong>
            <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
              API key and Vertex AI auth types are not supported.
            </div>
          </div>
        </div>
      )}
      {status === "expired" && (
        <div className="set-banner error">
          <span className="ico"><AlertTriangle size={14} /></span>
          <div>
            <strong>Session expired.</strong>
            <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
              Run <code className="font-mono">gemini auth login</code> to re-authenticate.
            </div>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="set-banner error">
          <span className="ico"><AlertTriangle size={14} /></span>
          <div>
            <strong>Could not fetch Gemini quota.</strong>
            <div className="text-[10.5px] font-mono text-muted-foreground mt-0.5">
              Check your connection and try again.
            </div>
          </div>
        </div>
      )}

      {detected && models.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-border">
          <div>
            <p className="text-xs font-medium">Visible models</p>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-0.5">
              Hidden models don't appear on the Dashboard and don't affect the menu
              bar warning indicator.
              {tier === GEMINI_FREE_TIER &&
                " Pro models are hidden by default because they're not available on the free tier."}
            </p>
          </div>
          <div className="space-y-1">
            {models.map((model) => (
              <label
                key={model.id}
                className="flex items-center gap-2 text-xs cursor-pointer select-none py-1"
              >
                <input
                  type="checkbox"
                  checked={model.visible}
                  onChange={(e) => onToggleModel(model.id, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-[var(--accent)]"
                />
                <span>{model.label}</span>
                {model.autoHidden && (
                  <span className="text-muted-foreground/70 text-[10px]">
                    not on free tier
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
