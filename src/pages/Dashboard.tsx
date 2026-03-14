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

export default function Dashboard({ onNavigateToSettings }: Props) {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const creds = await loadCredentials();

      // Warn if ChatGPT JWT expires within 30 minutes
      if (creds.chatgpt?.bearerToken && expiresWithin(creds.chatgpt.bearerToken, 30)) {
        await notify("uso.ai · ChatGPT token expiring soon", "Your ChatGPT Bearer token expires in less than 30 minutes. Update it in Settings.");
      }

      const results = await Promise.all([
        creds.claude?.orgId && creds.claude?.sessionKey
          ? fetchClaudeUsage(creds.claude.orgId, creds.claude.sessionKey)
          : null,
        creds.chatgpt?.bearerToken
          ? fetchChatGPTUsage(creds.chatgpt.bearerToken)
          : null,
        creds.cursor?.sessionToken
          ? fetchCursorUsage(creds.cursor.sessionToken)
          : null,
      ]);

      // Notify for any expired tokens
      const expired = results.filter((r) => r?.status === "expired");
      for (const s of expired) {
        if (s) await notify(`uso.ai · ${s.name} token expired`, `Your ${s.name} session token has expired. Update it in Settings.`);
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
              <NextResetCard key={s.name} service={s} />
            ))}
          </div>

          <div className="space-y-3">
            {loading && services.length === 0 ? (
              <><SkeletonCard /><SkeletonCard /></>
            ) : (
              services.map((s) => (
                <ServiceDonutCard key={s.name} service={s} onSettings={onNavigateToSettings} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
