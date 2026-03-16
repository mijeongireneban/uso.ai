import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { SERVICES } from "@/lib/services";
import { loadCredentials, saveCredentials } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import type { Account, CredentialsStore } from "@/lib/credentials";

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
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

type StatusMap = Record<string, "idle" | "saving" | "saved" | "expired" | "error">;

type Props = { onSaved?: () => void };

function isAccountConfigured(account: Account, fields: { key: string }[]): boolean {
  return fields.every((f) => !!account.credentials[f.key]?.trim());
}

function isServiceConfigured(accounts: Account[], fields: { key: string }[]): boolean {
  return accounts.some((a) => isAccountConfigured(a, fields));
}

function isPersistedAccountDeletable(persisted: CredentialsStore, serviceId: string, accountId: string): boolean {
  const accounts = persisted[serviceId] ?? [];
  if (accounts.length !== 1) return true; // multiple accounts — always deletable
  // Only account: hide delete if it has at least one non-empty credential field
  const sole = accounts.find((a) => a.id === accountId);
  if (!sole) return true;
  const service = SERVICES.find((s) => s.id === serviceId);
  const hasAnyField = service?.fields.some((f) => !!sole.credentials[f.key]?.trim()) ?? false;
  return !hasAnyField; // show delete only if all fields are empty (broken state)
}

export default function Settings({ onSaved }: Props) {
  const [persisted, setPersisted] = useState<CredentialsStore>({});
  const [draft, setDraft] = useState<CredentialsStore>({});
  const [statuses, setStatuses] = useState<StatusMap>({});

  useEffect(() => {
    loadCredentials().then((creds) => {
      // Ensure every service has an array entry
      const normalized: CredentialsStore = {};
      for (const s of SERVICES) {
        normalized[s.id] = creds[s.id] ?? [];
      }
      setPersisted(normalized);
      setDraft(JSON.parse(JSON.stringify(normalized))); // deep copy
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

  async function handleSave(serviceId: string, accountId: string) {
    setStatuses((prev) => ({ ...prev, [accountId]: "saving" }));
    try {
      const account = (draft[serviceId] ?? []).find((a) => a.id === accountId);
      if (!account) return;
      const creds = account.credentials;
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
        onSaved?.();
      }, 800);
    } catch (e) {
      console.error("Failed to save credentials", e);
      setStatuses((prev) => ({ ...prev, [accountId]: "error" }));
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-base font-semibold">Credentials</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Session tokens are stored locally and never leave this app.
        </p>
      </div>

      <Tabs defaultValue="claude">
        <TabsList className="w-full">
          {SERVICES.map((service) => {
            const configured = isServiceConfigured(persisted[service.id] ?? [], service.fields);
            return (
              <TabsTrigger key={service.id} value={service.id} className="flex-1 gap-2">
                <ServiceAvatar name={service.name} size="sm" />
                {service.name}
                {configured
                  ? <CheckCircle2 size={12} className="text-muted-foreground ml-auto" />
                  : <Circle size={12} className="text-muted-foreground/40 ml-auto" />
                }
              </TabsTrigger>
            );
          })}
        </TabsList>

        {SERVICES.map((service) => {
          const accounts = draft[service.id] ?? [];
          return (
            <TabsContent key={service.id} value={service.id} className="mt-4 space-y-4">
              {accounts.map((account) => {
                const status = statuses[account.id] ?? "idle";
                const isUnsaved = !(persisted[service.id] ?? []).some((a) => a.id === account.id);
                const showDelete = isUnsaved || isPersistedAccountDeletable(persisted, service.id, account.id);
                const canSave = service.fields.every((f) => !!account.credentials[f.key]?.trim());

                return (
                  <Card key={account.id}>
                    <CardContent className="px-6 py-6 space-y-5">
                      {/* Label */}
                      <div className="space-y-1.5">
                        <Label htmlFor={`${account.id}-label`} className="text-xs font-medium">
                          Account label
                        </Label>
                        <Input
                          id={`${account.id}-label`}
                          placeholder="e.g. Personal, Work"
                          value={account.label}
                          onChange={(e) => setAccountLabel(service.id, account.id, e.target.value)}
                          className="text-xs"
                        />
                      </div>

                      {/* Credential fields */}
                      {service.fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label htmlFor={`${account.id}-${field.key}`} className="text-xs font-medium">
                            {field.label}
                          </Label>
                          <PasswordInput
                            id={`${account.id}-${field.key}`}
                            placeholder={field.placeholder}
                            value={account.credentials[field.key] ?? ""}
                            onChange={(v) => setAccountField(service.id, account.id, field.key, v)}
                          />
                          <p className="text-xs text-muted-foreground leading-relaxed">{field.hint}</p>
                        </div>
                      ))}

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => handleSave(service.id, account.id)}
                          className="flex-1"
                          disabled={status === "saving" || !canSave}
                          variant={status === "error" || status === "expired" ? "destructive" : "default"}
                        >
                          {status === "saving" && "Validating..."}
                          {status === "saved" && "✓ Saved"}
                          {status === "expired" && "Token is expired or invalid"}
                          {status === "error" && "Failed — check your credentials"}
                          {(status === "idle") && `Save ${service.name} credentials`}
                        </Button>
                        {showDelete && (
                          <button
                            type="button"
                            onClick={() => deleteAccount(service.id, account.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete account"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => addAccount(service.id)}
              >
                + Add account
              </Button>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
