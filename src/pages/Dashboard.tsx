import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadCredentials } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { NextResetCard } from "@/components/dashboard/NextResetCard";
import { ServiceDonutCard } from "@/components/dashboard/ServiceDonutCard";
import { notify, expiresWithin } from "@/lib/notify";
import { SERVICES } from "@/lib/services";
import type { Account, CredentialsStore } from "@/lib/credentials";
import type { ServiceData } from "@/types";

type Props = { onNavigateToSettings?: () => void };

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="h-3 w-20 bg-secondary rounded animate-pulse" />
        <div className="flex items-center gap-4">
          <div className="w-[120px] h-[120px] rounded-full bg-secondary animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 bg-secondary rounded animate-pulse" />
            <div className="h-3 w-16 bg-secondary rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatLastUpdated(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  return `${Math.round(diff / 60)}m ago`;
}

/** Returns true if all credential fields for this account are non-blank. */
function isAccountConfigured(serviceId: string, account: Account): boolean {
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return false;
  return service.fields.every((f) => !!account.credentials[f.key]?.trim());
}

async function fetchAccount(
  serviceId: string,
  account: Account,
  label: string | undefined
): Promise<ServiceData> {
  const serviceName = SERVICES.find((s) => s.id === serviceId)?.name ?? serviceId;
  const creds = account.credentials;

  let result: ServiceData;
  if (serviceId === "claude") {
    result = await fetchClaudeUsage(creds.orgId, creds.sessionKey);
  } else if (serviceId === "chatgpt") {
    result = await fetchChatGPTUsage(creds.bearerToken);
  } else if (serviceId === "cursor") {
    result = await fetchCursorUsage(creds.sessionToken);
  } else {
    result = { accountId: account.id, name: serviceName, plan: "", status: "error", windows: [] };
  }

  return { ...result, accountId: account.id, name: serviceName, label };
}

export default function Dashboard({ onNavigateToSettings }: Props) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const creds: CredentialsStore = await loadCredentials();

      // ChatGPT pre-fetch expiry warning
      const chatgptAccounts = creds.chatgpt ?? [];
      const isMultiChatGPT = chatgptAccounts.length > 1;
      for (let i = 0; i < chatgptAccounts.length; i++) {
        const acc = chatgptAccounts[i];
        const token = acc.credentials.bearerToken;
        if (token && expiresWithin(token, 30)) {
          const displayLabel = isMultiChatGPT
            ? (acc.label.trim() || `Account ${i + 1}`)
            : null;
          const body = displayLabel
            ? `Your ChatGPT (Codex) · ${displayLabel} Bearer token expires in less than 30 minutes. Update it in Settings.`
            : "Your ChatGPT Bearer token expires in less than 30 minutes. Update it in Settings.";
          await notify("uso.ai · ChatGPT token expiring soon", body);
        }
      }

      // Build list of accounts to fetch, in service order
      const toFetch: { serviceId: string; account: Account; label: string | undefined }[] = [];
      for (const serviceId of ["claude", "chatgpt", "cursor"]) {
        const accounts = creds[serviceId] ?? [];
        const configuredAccounts = accounts.filter((a) => isAccountConfigured(serviceId, a));
        const showLabel = configuredAccounts.length > 1;
        for (const account of configuredAccounts) {
          toFetch.push({ serviceId, account, label: showLabel ? account.label : undefined });
        }
      }

      const settled = await Promise.allSettled(
        toFetch.map(({ serviceId, account, label }) =>
          fetchAccount(serviceId, account, label)
        )
      );

      const results: ServiceData[] = settled.map((result, i) => {
        const { serviceId, account, label } = toFetch[i];
        const serviceName = SERVICES.find((s) => s.id === serviceId)?.name ?? serviceId;
        if (result.status === "fulfilled") return result.value;
        return { accountId: account.id, name: serviceName, label, plan: "", status: "error" as const, windows: [] };
      });

      // Expired-token notifications
      for (const s of results.filter((r) => r.status === "expired")) {
        const nameWithLabel = s.label ? `${s.name} · ${s.label}` : s.name;
        await notify(
          `uso.ai · ${nameWithLabel} token expired`,
          `Your ${nameWithLabel} session token has expired. Update it in Settings.`
        );
      }

      setServices(results.filter((r): r is ServiceData => r !== null));
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch usage data", e);
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Updated {formatLastUpdated(lastUpdated)}
          </p>
        )}
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ml-auto"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {fetchError && (
        <p className="text-xs text-red-500 text-center">{fetchError}</p>
      )}

      {!loading && services.length === 0 && !fetchError && (
        <p className="text-center text-sm text-muted-foreground py-12">
          No services configured.{" "}
          <button onClick={onNavigateToSettings} className="underline hover:text-foreground transition-colors">
            Add credentials in Settings.
          </button>
        </p>
      )}

      {services.length > 0 && (
        <>
          <div className="flex gap-3">
            {services.filter((s) => s.status === "ok").map((s) => (
              <NextResetCard key={s.accountId} service={s} />
            ))}
          </div>

          <div className="space-y-3">
            {loading && services.length === 0 ? (
              <><SkeletonCard /><SkeletonCard /></>
            ) : (
              services.map((s) => (
                <ServiceDonutCard key={s.accountId} service={s} onSettings={onNavigateToSettings} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
