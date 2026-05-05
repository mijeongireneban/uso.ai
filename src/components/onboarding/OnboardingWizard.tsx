import { useEffect, useRef, useState } from "react";
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
  /** Called whenever the wizard finishes (saved, completed, or dismissed). */
  onClose: () => void;
  onOpenSettings: () => void;
};

type WizardStep =
  | { kind: "picker" }
  | { kind: "service"; index: number }
  | { kind: "summary" };

function blankAccount(): Account {
  return { id: crypto.randomUUID(), label: "Default", credentials: {} };
}

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

  const { statuses, save, resetStatus } = useCredentialSave();

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

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
    return draftAccounts[serviceId] ?? blankAccount();
  }

  function setDraftField(serviceId: string, key: string, value: string) {
    setDraftAccounts((prev) => {
      const current = prev[serviceId] ?? blankAccount();
      return {
        ...prev,
        [serviceId]: {
          ...current,
          credentials: { ...current.credentials, [key]: value },
        },
      };
    });
    const id = draftAccounts[serviceId]?.id;
    if (id) resetStatus(id);
  }

  function setDraftLabel(serviceId: string, label: string) {
    setDraftAccounts((prev) => {
      const current = prev[serviceId] ?? blankAccount();
      return { ...prev, [serviceId]: { ...current, label } };
    });
    const id = draftAccounts[serviceId]?.id;
    if (id) resetStatus(id);
  }

  function advance() {
    if (step.kind === "picker") {
      if (orderedSelected.length === 0) return;
      setDraftAccounts((prev) => {
        const next = { ...prev };
        for (const id of orderedSelected) {
          if (!next[id]) next[id] = blankAccount();
        }
        return next;
      });
      setStep({ kind: "service", index: 0 });
      return;
    }
    if (step.kind === "service") {
      const next = step.index + 1;
      if (next >= orderedSelected.length) {
        // Treat all-skipped as a dismissal so a later "no creds" launch can
        // still re-show the wizard. Otherwise mark complete.
        const persist = connectedCount === 0
          ? setOnboardingDismissed
          : setOnboardingCompleted;
        persist().catch((e) =>
          console.error("Failed to persist onboarding state", e)
        );
        setStep({ kind: "summary" });
      } else {
        setStep({ kind: "service", index: next });
      }
    }
  }

  function dismiss() {
    setOnboardingDismissed().catch((e) =>
      console.error("Failed to persist onboarding dismissed state", e)
    );
    onClose();
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
          onOpenDashboard={onClose}
          onOpenSettings={() => {
            onClose();
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
                  <p className="text-xs text-primary flex items-center gap-1.5">
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
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Setup walkthrough"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      className="absolute inset-0 z-50 flex flex-col bg-background rounded-xl outline-none"
    >
      <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Setup walkthrough</span>
        <button
          type="button"
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close walkthrough"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{renderStepBody()}</div>
    </div>
  );
}
