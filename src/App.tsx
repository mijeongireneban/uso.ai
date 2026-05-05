import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LayoutDashboard, Settings as SettingsIcon, Sun, Moon, Monitor } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LogoMark } from "@/components/ui/LogoMark";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import { useTheme } from "@/lib/useTheme";
import type { Theme } from "@/lib/useTheme";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { loadCredentials, isAccountConfigured } from "@/lib/credentials";
import { loadOnboardingState } from "@/lib/onboarding/state";
import { exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { SERVICES } from "@/lib/services";

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun size={13} />,
  dark: <Moon size={13} />,
  system: <Monitor size={13} />,
};

type Page = "dashboard" | "settings";

const DEFAULT_SETTINGS_TAB = "claude";

function parseHash(hash: string): { page: Page; settingsTab: string } {
  // Supported: "#settings", "#settings/<tab>", "#dashboard" (or anything else → dashboard)
  const clean = hash.replace(/^#\/?/, "");
  const [section, tab] = clean.split("/");
  if (section === "settings") {
    return { page: "settings", settingsTab: tab || DEFAULT_SETTINGS_TAB };
  }
  return { page: "dashboard", settingsTab: DEFAULT_SETTINGS_TAB };
}

export default function App() {
  const [page, setPage] = useState<Page>(() => parseHash(window.location.hash).page);
  const [settingsTab, setSettingsTab] = useState<string>(() => parseHash(window.location.hash).settingsTab);
  const { theme, cycleTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [state, creds, geminiDetected] = await Promise.all([
        loadOnboardingState(),
        loadCredentials(),
        exists(".gemini/oauth_creds.json", { baseDir: BaseDirectory.Home }).catch(() => false),
      ]);
      if (cancelled) return;
      if (state.dismissed || state.completed) return;
      const noAccounts = SERVICES.every((s) => {
        const accounts = creds[s.id] ?? [];
        return !accounts.some((a) => isAccountConfigured(s.id, a));
      });
      if (noAccounts && !geminiDetected) {
        setShowWizard(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div
      ref={rootRef}
      className="relative h-screen flex flex-col rounded-xl overflow-hidden border border-border bg-background shadow-2xl popup-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary text-primary-foreground">
            <LogoMark className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight tracking-tight">uso.ai</h1>
            <p className="text-xs text-muted-foreground leading-tight">AI usage dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
          >
            {THEME_ICONS[theme]}
          </button>
          <div className="w-px h-4 bg-border shrink-0 mx-1" />
          <button
            onClick={() => setPage("dashboard")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              page === "dashboard"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title="Dashboard"
          >
            <LayoutDashboard size={13} />
            Dashboard
          </button>
          <button
            onClick={() => setPage("settings")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              page === "settings"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title="Settings"
          >
            <SettingsIcon size={13} />
            Settings
          </button>
        </div>
      </div>

      <Separator />

      {/* Scrollable page content */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {page === "dashboard" ? (
          <Dashboard
            onNavigateToSettings={navigateToSettings}
            onOpenWizard={() => setShowWizard(true)}
          />
        ) : (
          <Settings
            tab={settingsTab}
            onTabChange={setSettingsTab}
            onOpenWizard={() => setShowWizard(true)}
          />
        )}

        {/* Footer — scrolls with content */}
        <p className="text-[10px] text-muted-foreground/70 tracking-tight text-center mt-6 pb-1">
          © {new Date().getFullYear()} uso.ai
        </p>
      </div>

      {showWizard && (
        <OnboardingWizard
          onClose={() => setShowWizard(false)}
          onOpenSettings={() => {
            setShowWizard(false);
            setPage("settings");
          }}
        />
      )}
    </div>
  );
}
