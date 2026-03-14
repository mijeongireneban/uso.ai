import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import { load } from "@tauri-apps/plugin-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import claudeLogo from "@/assets/claude.png";
import chatgptLogo from "@/assets/chatgpt.png";
import cursorLogo from "@/assets/cursor.png";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";

const SERVICE_LOGOS: Record<string, string> = {
  claude: claudeLogo,
  chatgpt: chatgptLogo,
  cursor: cursorLogo,
};

type FieldConfig = {
  key: string;
  label: string;
  placeholder: string;
  hint: string;
};

type ServiceConfig = {
  id: string;
  name: string;
  color: string;
  fields: FieldConfig[];
};

const services: ServiceConfig[] = [
  {
    id: "claude",
    name: "Claude",
    color: "#cc785c",
    fields: [
      {
        key: "orgId",
        label: "Organization ID",
        placeholder: "259a829d-c8a3-485a-8403-...",
        hint: "Found in the URL: claude.ai/api/organizations/{org_id}/usage",
      },
      {
        key: "sessionKey",
        label: "Session Key",
        placeholder: "sk-ant-...",
        hint: "DevTools → Network → any request → Cookie header → sessionKey value",
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    color: "#19c37d",
    fields: [
      {
        key: "bearerToken",
        label: "Bearer Token",
        placeholder: "eyJhbGci...",
        hint: "DevTools → Network → any request → Authorization header (without 'Bearer ')",
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    color: "#6e7bff",
    fields: [
      {
        key: "sessionToken",
        label: "Session Token",
        placeholder: "user_01J6T9QTW60CGK6...",
        hint: "DevTools → Network → any request → Cookie header → WorkosCursorSessionToken value",
      },
    ],
  },
];

type Credentials = Record<string, Record<string, string>>;

function isConfigured(creds: Credentials, service: ServiceConfig): boolean {
  return service.fields.every((f) => !!creds[service.id]?.[f.key]);
}

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

type Props = { onSaved?: () => void };

export default function Settings({ onSaved }: Props) {
  const [credentials, setCredentials] = useState<Credentials>({});
  const [statuses, setStatuses] = useState<Record<string, "idle" | "saving" | "saved" | "expired" | "error">>({});

  useEffect(() => {
    async function loadCreds() {
      try {
        const store = await load("credentials.json", { autoSave: false });
        const saved = await store.get<Credentials>("credentials");
        if (saved) setCredentials(saved);
      } catch (e) {
        console.error("Failed to load credentials", e);
      }
    }
    loadCreds();
  }, []);

  function handleChange(serviceId: string, fieldKey: string, value: string) {
    setCredentials((prev) => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], [fieldKey]: value },
    }));
    setStatuses((prev) => ({ ...prev, [serviceId]: "idle" }));
  }

  async function handleSave(serviceId: string) {
    setStatuses((prev) => ({ ...prev, [serviceId]: "saving" }));
    try {
      // Validate credentials before saving
      const creds = credentials[serviceId] ?? {};
      let validationStatus: string = "ok";

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
        setStatuses((prev) => ({ ...prev, [serviceId]: "expired" }));
        return;
      }
      if (validationStatus === "error") {
        setStatuses((prev) => ({ ...prev, [serviceId]: "error" }));
        return;
      }

      const store = await load("credentials.json", { autoSave: false });
      await store.set("credentials", credentials);
      await store.save();
      setStatuses((prev) => ({ ...prev, [serviceId]: "saved" }));
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [serviceId]: "idle" }));
        onSaved?.();
      }, 800);
    } catch (e) {
      console.error("Failed to save credentials", e);
      setStatuses((prev) => ({ ...prev, [serviceId]: "error" }));
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
          {services.map((service) => {
            const configured = isConfigured(credentials, service);
            return (
              <TabsTrigger key={service.id} value={service.id} className="flex-1 gap-2">
                <Avatar className="w-4 h-4 rounded-sm">
                  <AvatarImage src={SERVICE_LOGOS[service.id]} alt={service.name} className="object-contain" />
                  <AvatarFallback className="rounded-sm text-white text-[10px] font-bold" style={{ backgroundColor: service.color }}>
                    {service.name[0]}
                  </AvatarFallback>
                </Avatar>
                {service.name}
                {configured
                  ? <CheckCircle2 size={12} className="text-muted-foreground ml-auto" />
                  : <Circle size={12} className="text-muted-foreground/40 ml-auto" />
                }
              </TabsTrigger>
            );
          })}
        </TabsList>

        {services.map((service) => {
          const status = statuses[service.id] ?? "idle";
          return (
            <TabsContent key={service.id} value={service.id} className="mt-4">
              <Card>
                <CardContent className="px-6 py-6 space-y-5">
                  {service.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`${service.id}-${field.key}`} className="text-xs font-medium">
                        {field.label}
                      </Label>
                      <PasswordInput
                        id={`${service.id}-${field.key}`}
                        placeholder={field.placeholder}
                        value={credentials[service.id]?.[field.key] ?? ""}
                        onChange={(v) => handleChange(service.id, field.key, v)}
                      />
                      <p className="text-xs text-muted-foreground leading-relaxed">{field.hint}</p>
                    </div>
                  ))}

                  <Button
                    onClick={() => handleSave(service.id)}
                    className="w-full mt-2"
                    disabled={status === "saving"}
                    variant={status === "error" || status === "expired" ? "destructive" : "default"}
                  >
                    {status === "saving" && "Validating..."}
                    {status === "saved" && "✓ Saved"}
                    {status === "expired" && "Token is expired or invalid"}
                    {status === "error" && "Failed — check your credentials"}
                    {status === "idle" && `Save ${service.name} credentials`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
