import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LayoutDashboard, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LogoMark } from "@/components/ui/LogoMark";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import packageJson from "../package.json";

type Page = "dashboard" | "settings";

const DEFAULT_SETTINGS_TAB = "claude";
const APP_VERSION = packageJson.version;

// Event channels so the App-level header can drive the Dashboard's fetch loop
// without prop-drilling — Dashboard owns the fetch logic, App owns the chrome.
const REFRESH_EVENT = "uso:trigger-refresh";
const STATE_EVENT = "uso:dashboard-state";

export type DashboardStateEvent = CustomEvent<{
  loading: boolean;
  lastUpdated: number | null;
}>;

function parseHash(hash: string): { page: Page; settingsTab: string } {
  // Supported: "#settings", "#settings/<tab>", "#dashboard" (or anything else → dashboard)
  const clean = hash.replace(/^#\/?/, "");
  const [section, tab] = clean.split("/");
  if (section === "settings") {
    return { page: "settings", settingsTab: tab || DEFAULT_SETTINGS_TAB };
  }
  return { page: "dashboard", settingsTab: DEFAULT_SETTINGS_TAB };
}

function formatLastUpdated(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  return `${Math.round(diff / 60)}m ago`;
}

export default function App() {
  const [page, setPage] = useState<Page>(() => parseHash(window.location.hash).page);
  const [settingsTab, setSettingsTab] = useState<string>(() => parseHash(window.location.hash).settingsTab);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep URL hash in sync so reload preserves page + settings tab.
  useEffect(() => {
    const hash = page === "settings" ? `#settings/${settingsTab}` : "#dashboard";
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }, [page, settingsTab]);

  const navigateToSettings = (serviceId?: string) => {
    if (serviceId) setSettingsTab(serviceId);
    setPage("settings");
  };

  // Listen for Dashboard's loading + lastUpdated updates so the header's live
  // indicator and spinner stay in sync without prop-drilling.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as DashboardStateEvent).detail;
      setRefreshing(detail.loading);
      if (detail.lastUpdated !== null) {
        setLastUpdated(new Date(detail.lastUpdated));
      }
    };
    window.addEventListener(STATE_EVENT, handler);
    return () => window.removeEventListener(STATE_EVENT, handler);
  }, []);

  // Force the header's "Updated Nm ago" copy to tick forward even when no
  // refresh is in flight — same idea as the original Dashboard "ago" timer.
  const [, forceRerender] = useState(0);
  useEffect(() => {
    if (!lastUpdated) return;
    const id = setInterval(() => forceRerender((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Blur: fade out, then hide
  useEffect(() => {
    const handleBlur = () => {
      const el = rootRef.current;
      if (!el) return;
      el.classList.remove("popup-in");
      el.classList.add("popup-out");
      hideTimerRef.current = setTimeout(() => {
        invoke("hide_window").catch(() => {});
      }, 150);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  // Focus: cancel any pending hide, fade in
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          const el = rootRef.current;
          if (!el) return;
          el.classList.remove("popup-out");
          el.classList.remove("popup-in");
          void el.offsetWidth;
          el.classList.add("popup-in");
        }
      })
      .then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  const triggerRefresh = () => {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  };

  return (
    <div
      ref={rootRef}
      className="h-screen flex flex-col rounded-xl overflow-hidden border border-border bg-background shadow-2xl popup-in"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 shrink-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary text-primary-foreground shrink-0">
          <LogoMark className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0 flex flex-col">
          <h1 className="text-[13px] font-semibold leading-tight tracking-tight">uso.ai</h1>
          {page === "dashboard" ? (
            <div className="text-[10px] font-mono text-[var(--text-dim)] leading-tight mt-0.5 flex items-center gap-1.5">
              <span
                className="size-[5px] rounded-full"
                style={{
                  background: refreshing ? "var(--warn)" : lastUpdated ? "var(--success)" : "var(--text-dim)",
                }}
              />
              {refreshing
                ? "Refreshing…"
                : lastUpdated
                ? `Updated ${formatLastUpdated(lastUpdated)}`
                : "Connecting…"}
            </div>
          ) : (
            <div className="text-[10px] font-mono text-[var(--text-dim)] leading-tight mt-0.5">
              Settings · v{APP_VERSION}
            </div>
          )}
        </div>

        <div className="seg-control ml-auto" role="tablist" aria-label="Pages">
          <button
            type="button"
            data-active={page === "dashboard"}
            onClick={() => setPage("dashboard")}
            title="Dashboard"
          >
            <LayoutDashboard size={11} />
            Dashboard
          </button>
          <button
            type="button"
            data-active={page === "settings"}
            onClick={() => setPage("settings")}
            title="Settings"
          >
            <SettingsIcon size={11} />
            Settings
          </button>
        </div>

        {page === "dashboard" && (
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors disabled:opacity-60 shrink-0"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      <Separator />

      {/* Scrollable page content — sections sit flush; the footer rides at
          the natural bottom of the content (design's `.footer` lives inside
          `.app-body`, so it scrolls with everything else rather than pinning). */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1">
          {page === "dashboard" ? (
            <Dashboard onNavigateToSettings={navigateToSettings} />
          ) : (
            <Settings tab={settingsTab} onTabChange={setSettingsTab} />
          )}
        </div>

        {/* Footer — copyright left, Docs / Privacy / Quit right, hairline above. */}
        <div className="shrink-0 border-t border-border px-3.5 py-2.5 flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
          <span>© {new Date().getFullYear()} uso.ai · v{APP_VERSION}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openUrl("https://uso-ai-gamma.vercel.app").catch(() => {})}
              className="hover:text-muted-foreground transition-colors"
            >
              Docs
            </button>
            <button
              type="button"
              onClick={() => openUrl("https://uso-ai-gamma.vercel.app/privacy").catch(() => {})}
              className="hover:text-muted-foreground transition-colors"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => getCurrentWindow().close().catch(() => {})}
              className="hover:text-muted-foreground transition-colors"
            >
              Quit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { REFRESH_EVENT, STATE_EVENT };
