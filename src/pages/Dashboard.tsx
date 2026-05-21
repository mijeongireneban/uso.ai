import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { REFRESH_EVENT, STATE_EVENT } from "@/App";
import { loadCredentials } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { fetchCopilotUsage } from "@/lib/api/copilot";
import { fetchGeminiUsage } from "@/lib/api/gemini";
import { fetchAllOperationalStatuses } from "@/lib/api/serviceStatus";
import { Hero } from "@/components/dashboard/Hero";
import { ProviderChips } from "@/components/dashboard/ProviderChips";
import { ServiceDonutCard } from "@/components/dashboard/ServiceDonutCard";
import { ServiceStatusPanel } from "@/components/dashboard/ServiceStatusPanel";
import { notify, getJwtExpiry } from "@/lib/notify";
import { notifyAccountStatusChanges, notifyOperationalChanges } from "@/lib/statusNotify";
import { SERVICES } from "@/lib/services";
import { saveHistorySnapshot } from "@/lib/history";
import { maxUsagePercent, trayLevelFor, setTrayStatus } from "@/lib/tray";
import {
  loadPreferences,
  extraUsageTrayExclusions,
  PREFERENCES_CHANGED_EVENT,
} from "@/lib/preferences";
import History from "@/pages/History";
import type { Account, CredentialsStore } from "@/lib/credentials";
import type { OperationalStatus, ServiceData, ServiceStatus, ServiceStatusInfo } from "@/types";

type Props = { onNavigateToSettings?: (serviceId?: string) => void };

/**
 * Skeletons intentionally use `bg-secondary` (not `bg-muted`) because in the
 * dark theme `--muted` matches `--card`, which would render shimmer invisible.
 */
function NextResetSkeleton() {
  // Mirrors the new Hero layout: 64px ring + label/title/sub on the right.
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="px-4 py-4 flex items-start gap-3.5">
        <div className="size-16 rounded-full bg-secondary animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-2.5 w-2/5 bg-secondary rounded animate-pulse" />
          <div className="h-6 w-3/5 bg-secondary rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-secondary rounded animate-pulse" />
        </div>
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
  } else if (serviceId === "copilot") {
    result = await fetchCopilotUsage(creds.sessionCookie);
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
  const [extraUsageTrayExcludes, setExtraUsageTrayExcludes] = useState<Set<string>>(new Set());
  // Tracks which provider chip the user has focused. Defaults to the most-urgent.
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  // Tracks which (token prefix + threshold) combos have already fired a notification
  const notifiedRef = useRef<Set<string>>(new Set());
  // Previous per-account auth/fetch status, keyed by accountId. Empty on first
  // fetch — populated below — so we don't notify on app launch.
  const previousAccountStatusRef = useRef<Map<string, ServiceStatus>>(new Map());
  // Previous per-service operational (status page) status, keyed by serviceId.
  const previousOperationalRef = useRef<Map<string, OperationalStatus>>(new Map());

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
      for (const serviceId of ["claude", "chatgpt", "cursor", "copilot"]) {
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

      // Status-change notifications — fire only on transitions, never on first
      // fetch (refs are empty until populated below). Replaces an older loop
      // that re-notified for every "expired" account on every 5-min fetch.
      const accountSnapshots = results.map((r) => ({
        accountId: r.accountId,
        displayName: r.label ? `${r.name} · ${r.label}` : r.name,
        status: r.status,
      }));
      const operationalSnapshots = Object.entries(operationalByService)
        .map(([serviceId, info]) => {
          const serviceName = SERVICES.find((s) => s.id === serviceId)?.name;
          if (!serviceName) return null;
          return { serviceId, serviceName, status: info.status };
        })
        .filter((s): s is { serviceId: string; serviceName: string; status: OperationalStatus } => s !== null);

      await notifyAccountStatusChanges(previousAccountStatusRef.current, accountSnapshots);
      await notifyOperationalChanges(previousOperationalRef.current, operationalSnapshots);

      previousAccountStatusRef.current = new Map(
        accountSnapshots.map((a) => [a.accountId, a.status])
      );
      previousOperationalRef.current = new Map(
        operationalSnapshots.map((s) => [s.serviceId, s.status])
      );

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

    // Header's refresh button dispatches REFRESH_EVENT — fetch on demand.
    const onRefresh = () => fetchAll();
    window.addEventListener(REFRESH_EVENT, onRefresh);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(expiryInterval);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
    };
  }, [fetchAll, checkExpiry]);

  // Publish loading + lastUpdated to the App header so it can render the
  // "● Updated Nm ago" indicator and spin the refresh icon while fetching.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(STATE_EVENT, {
        detail: { loading, lastUpdated: lastUpdated?.getTime() ?? null },
      }),
    );
  }, [loading, lastUpdated]);

  // Pick up the user's per-service "exclude extra usage from tray" preference
  // and refresh it when Settings dispatches a change event so the tray reflects
  // the toggle without waiting for the next 5-minute fetch.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      loadPreferences().then((p) => {
        if (cancelled) return;
        setExtraUsageTrayExcludes(extraUsageTrayExclusions(p));
      });
    };
    refresh();
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    };
  }, []);

  // Mirror the highest observed usage % onto the menu bar tray icon so the
  // user can glance at the status bar and see whether any account is
  // nearing a limit without opening the dashboard (TOK-53). Runs on every
  // services update so removing credentials also drops the tray back to
  // the neutral template icon.
  useEffect(() => {
    if (loading) return;
    const level = trayLevelFor(maxUsagePercent(services, extraUsageTrayExcludes));
    setTrayStatus(level);
  }, [services, loading, extraUsageTrayExcludes]);

  // Most-urgent provider drives the hero focus. Urgency = highest first-window
  // used percent across OK services — it's the signal users care about most
  // (approaching a limit) and is already part of every service's data shape.
  const okServices = useMemo(() => services.filter((s) => s.status === "ok"), [services]);
  const mostUrgentId = useMemo(() => {
    if (okServices.length === 0) return null;
    return [...okServices].sort(
      (a, b) => (b.windows[0]?.usedPercent ?? 0) - (a.windows[0]?.usedPercent ?? 0),
    )[0].accountId;
  }, [okServices]);

  // Re-anchor the hero on the most urgent provider whenever the set of OK
  // services changes (after a refresh, credentials change, etc.). Users can
  // still swap focus by clicking another chip — we only override when the
  // current active id is no longer in the OK set.
  useEffect(() => {
    if (!mostUrgentId) {
      setActiveAccountId(null);
      return;
    }
    setActiveAccountId((prev) => {
      if (prev && okServices.some((s) => s.accountId === prev)) return prev;
      return mostUrgentId;
    });
  }, [mostUrgentId, okServices]);

  const activeService =
    okServices.find((s) => s.accountId === activeAccountId) ?? okServices[0] ?? null;

  const integratedServiceIds = useMemo(
    () =>
      services
        .map((s) => SERVICES.find((svc) => svc.name === s.name)?.id ?? "")
        .filter(Boolean),
    [services],
  );
  const accountCountLabel =
    services.length === 1 ? "1 account" : `${services.length} accounts`;

  return (
    <div>
      {fetchError && (
        <div className="section">
          <p className="text-xs text-[var(--destructive)] text-center">{fetchError}</p>
        </div>
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
            onClick={() => onNavigateToSettings?.()}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Add credentials in Settings →
          </button>
        </div>
      )}

      {/* First-load state: render a hero skeleton + provider card skeletons */}
      {loading && services.length === 0 && !fetchError && (
        <>
          <div className="hero">
            <NextResetSkeleton />
          </div>
          <div className="section">
            <div className="section-head">
              <span className="section-title">Limits</span>
            </div>
            <div className="space-y-3">
              <ServiceCardSkeleton />
              <ServiceCardSkeleton />
            </div>
          </div>
        </>
      )}

      {services.length > 0 && (
        <>
          {activeService && (
            <Hero
              service={activeService}
              isMostUrgent={activeService.accountId === mostUrgentId}
              multi={okServices.length > 1}
              activeAccounts={services.length}
            />
          )}

          {okServices.length > 0 && mostUrgentId && (
            <ProviderChips
              services={okServices}
              activeId={activeAccountId ?? mostUrgentId}
              mostUrgentId={mostUrgentId}
              onSelect={setActiveAccountId}
              onAdd={() => onNavigateToSettings?.()}
            />
          )}

          <section className="section">
            <div className="section-head">
              <span className="section-title">Limits</span>
              {services.length > 1 && (
                <span className="section-meta">{accountCountLabel}</span>
              )}
            </div>
            <div className="space-y-3">
              {services.map((s) => (
                <ServiceDonutCard
                  key={s.accountId}
                  service={s}
                  onSettings={onNavigateToSettings}
                />
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">Activity</span>
            </div>
            <History />
          </section>

          {integratedServiceIds.length > 0 && (
            <section className="section">
              <div className="section-head">
                <span className="section-title">Status</span>
                <span className="section-meta">live</span>
              </div>
              <ServiceStatusPanel
                integratedServiceIds={integratedServiceIds}
                statusByService={statusByService}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
