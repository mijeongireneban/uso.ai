import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import { load } from "@tauri-apps/plugin-store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import { SERVICES } from "@/lib/services";

type Credentials = Record<string, Record<string, string>>;

function isConfigured(creds: Credentials, serviceId: string, fields: { key: string }[]): boolean {
  return fields.every((f) => !!creds[serviceId]?.[f.key]);
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
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

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
    setStatus("idle");
  }

  async function handleSave() {
    try {
      const store = await load("credentials.json", { autoSave: false });
      await store.set("credentials", credentials);
      await store.save();
      setStatus("saved");
      setTimeout(() => {
        setStatus("idle");
        onSaved?.();
      }, 800);
    } catch (e) {
      console.error("Failed to save credentials", e);
      setStatus("error");
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h2 className="text-base font-semibold">Credentials</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Session tokens are stored locally and never leave this app.
        </p>
      </div>

      <div className="space-y-4">
        {SERVICES.map((service) => {
          const configured = isConfigured(credentials, service.id, service.fields);
          return (
            <Card key={service.id} className="overflow-hidden">
              <CardHeader className="pb-0 pt-5 px-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <ServiceAvatar name={service.name} size="md" />
                    <span className="text-sm font-semibold">{service.name}</span>
                  </div>
                  {configured ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 size={13} />
                      Configured
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
                      <Circle size={13} />
                      Not configured
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-5">
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        className="w-full"
        variant={status === "error" ? "destructive" : "default"}
      >
        {status === "saved" ? "✓ Saved" : status === "error" ? "Failed to save" : "Save credentials"}
      </Button>
    </div>
  );
}
