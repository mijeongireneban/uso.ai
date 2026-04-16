import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { loadCredentials } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { fetchGeminiUsage } from "@/lib/api/gemini";
import { fetchAllOperationalStatuses } from "@/lib/api/serviceStatus";
import { NextResetCard } from "@/components/dashboard/NextResetCard";
import { ServiceDonutCard } from "@/components/dashboard/ServiceDonutCard";
import { ServiceStatusPanel } from "@/components/dashboard/ServiceStatusPanel";
import { notify, getJwtExpiry } from "@/lib/notify";
import { SERVICES } from "@/lib/services";
import { saveHistorySnapshot } from "@/lib/history";
import { maxUsagePercent, trayLevelFor, setTrayStatus } from "@/lib/tray";
import History from "@/pages/History";
import type { Account, CredentialsStore } from "@/lib/credentials";
import type { ServiceData, ServiceStatusInfo } from "@/types";

type Props = { onNavigateToSettings?: () => void };

/**
 * Skeletons intentionally use `bg-secondary` (not `bg-muted`) because in the
 * dark theme `--muted` matches `--card`, which would render shimmer invisible.
 */
function NextResetSkeleton() {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="px-4 py-3 space-y-1.5">
        <div className="h-3 w-3/5 bg-secondary rounded animate-pulse" />
        <div className="h-4 w-2/5 bg-secondary rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-secondary rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

function ServiceCardSkeleton() {
  return (
    <Card className="relative">
      <div className="absolute top-3 right-3">
        <div className="h-5 w-12 rounded-md bg-secondary animate-pulse" />
      </div>
      <CardContent className="px-4 py-0 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-secondary animate-pulse shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-24 bg-secondary rounded animate-pulse" />
            <div className="h-2.5 w-32 bg-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-20 bg-secondary rounded animate-pulse" />
                <div className="h-2.5 w-16 bg-secondary rounded animate-pulse" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary animate-pulse" />
            </div>
          ))}
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
  const [statusByService, setStatusByService] = useState<Record<string, ServiceStatusInfo>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Tracks which (token prefix + threshold) combos have already fired a notification
  const notifiedRef = useRef<Set<string>>(new Set());

  // Background expiry check — runs every minute, independently of the 5-min usage fetch
  const checkExpiry = useCallback(async () => {
    const creds: CredentialsStore = await loadCredentials();
    const chatgptAccounts = creds.chatgpt ?? [];
    const isMulti = chatgptAccounts.length > 1;

    for (let i = 0; i < chatgptAccounts.length; i++) {
      const acc = chatgptAccounts[i];
      const token = acc.credentials.bearerToken;
      if (!token) continue;

      const expiry = getJwtExpiry(token);
      if (!expiry) continue;

      const minsLeft = Math.round((expiry.getTime() - Date.now()) / 60000);
      const displayLabel = isMulti ? (acc.label.trim() || `Account ${i + 1}`) : null;
      const prefix = token.slice(-16); // use last 16 chars as a stable key

      // 3-minute warning
      if (minsLeft <= 3 && minsLeft > 0 && !notifiedRef.current.has(`${prefix}-3`)) {
        notifiedRef.current.add(`${prefix}-3`);
        const body = displayLabel
          ? `Your ChatGPT (Codex) · ${displayLabel} Bearer token expires in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}. Update it in Settings now.`
          : `Your ChatGPT Bearer token expires in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}. Update it in Settings now.`;
        await notify("uso.ai · ChatGPT token expiring soon", body);
      }

      // 30-minute early warning
      if (minsLeft <= 30 && minsLeft > 3 && !notifiedRef.current.has(`${prefix}-30`)) {
        notifiedRef.current.add(`${prefix}-30`);
        const body = displayLabel
          ? `Your ChatGPT (Codex) · ${displayLabel} Bearer token expires in less than 30 minutes. Update it in Settings.`
          : "Your ChatGPT Bearer token expires in less than 30 minutes. Update it in Settings.";
        await notify("uso.ai · ChatGPT token expiring soon", body);
      }
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const creds: CredentialsStore = await loadCredentials();

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

      // Kick off usage fetches and the status-page fetch in parallel — they're
      // independent so a status-page outage shouldn't delay usage data.
      const [settled, operationalByService] = await Promise.all([
        Promise.allSettled(
          toFetch.map(({ serviceId, account, label }) =>
            fetchAccount(serviceId, account, label)
          )
        ),
        fetchAllOperationalStatuses(),
      ]);

      setStatusByService(operationalByService);

      const results: ServiceData[] = settled.map((result, i) => {
        const { serviceId, account, label } = toFetch[i];
        const serviceName = SERVICES.find((s) => s.id === serviceId)?.name ?? serviceId;
        const operational = operationalByService[serviceId]?.status;
        if (result.status === "fulfilled") return { ...result.value, operational };
        return { accountId: account.id, name: serviceName, label, plan: "", status: "error" as const, windows: [], operational };
      });

      // Gemini CLI — file-based, not store-based. No operational status in v1.
      const geminiResult = await fetchGeminiUsage();
      if (geminiResult.status !== "not_configured") {
        results.push(geminiResult);
        if (geminiResult.status === "ok") {
          saveHistorySnapshot("gemini", geminiResult).catch(() => {});
        }
      }

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

      // Save one snapshot per account per day (silently, non-blocking)
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i];
        if (result.status === "fulfilled" && result.value.status === "ok") {
          saveHistorySnapshot(toFetch[i].serviceId, result.value).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Failed to fetch usage data", e);
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const fetchInterval = setInterval(fetchAll, 5 * 60 * 1000);

    checkExpiry();
    const expiryInterval = setInterval(checkExpiry, 60 * 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(expiryInterval);
    };
  }, [fetchAll, checkExpiry]);

  // Mirror the highest observed usage % onto the menu bar tray icon so the
  // user can glance at the status bar and see whether any account is
  // nearing a limit without opening the dashboard (TOK-53). Runs on every
  // services update so removing credentials also drops the tray back to
  // the neutral template icon.
  useEffect(() => {
    if (loading) return;
    const level = trayLevelFor(maxUsagePercent(services));
    setTrayStatus(level);
  }, [services, loading]);

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
        <div className="flex flex-col items-center text-center py-12 px-6">
          <div className="size-10 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Inbox size={18} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No services configured</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Connect a provider to start tracking usage.
          </p>
          <button
            onClick={onNavigateToSettings}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Add credentials in Settings →
          </button>
        </div>
      )}

      {/* First-load state: render skeletons that mirror the real card structure */}
      {loading && services.length === 0 && !fetchError && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <NextResetSkeleton />
            <NextResetSkeleton />
            <NextResetSkeleton />
          </div>
          <div className="space-y-3">
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
          </div>
        </>
      )}

      {services.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {services.filter((s) => s.status === "ok").map((s) => (
              <NextResetCard key={s.accountId} service={s} />
            ))}
          </div>

          <div className="space-y-3">
            {services.map((s) => (
              <ServiceDonutCard key={s.accountId} service={s} onSettings={onNavigateToSettings} />
            ))}
          </div>

          <Separator className="my-5" />
        </>
      )}

      <History />

      {services.length > 0 && (
        <>
          <Separator className="my-5" />
          <ServiceStatusPanel
            integratedServiceIds={services.map((s) => {
              // Map ServiceData.name back to service id for the panel lookup.
              return SERVICES.find((svc) => svc.name === s.name)?.id ?? "";
            }).filter(Boolean)}
            statusByService={statusByService}
          />
        </>
      )}
    </div>
  );
}
