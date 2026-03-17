import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LayoutDashboard, Settings as SettingsIcon, Sun, Moon, Monitor } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import { useTheme } from "@/lib/useTheme";
import type { Theme } from "@/lib/useTheme";
import { loadCredentials, saveCredentials } from "@/lib/credentials";
import { detectCursorCredentials } from "@/lib/autoDetect";

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun size={13} />,
  dark: <Moon size={13} />,
  system: <Monitor size={13} />,
};

type Page = "dashboard" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const { theme, cycleTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dashboardKey, setDashboardKey] = useState(0);

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

  // First-launch: silently detect Cursor credentials if none are configured
  useEffect(() => {
    async function silentDetect() {
      const creds = await loadCredentials();
      const cursorAccounts = creds["cursor"] ?? [];
      const isConfigured = cursorAccounts.some(
        (a) => !!a.credentials["sessionToken"]?.trim()
      );
      if (isConfigured) return;

      const result = await detectCursorCredentials();
      if ("error" in result) return;

      const newAccount = {
        id: crypto.randomUUID(),
        label: "Auto-detected",
        credentials: { sessionToken: result.token },
      };
      const newCreds = { ...creds, cursor: [...cursorAccounts, newAccount] };
      await saveCredentials(newCreds);
      setDashboardKey((k) => k + 1);
    }
    silentDetect().catch(() => {});
  }, []); // runs once on mount

  return (
    <div
      ref={rootRef}
      className="h-screen flex flex-col rounded-2xl overflow-hidden border border-border/60 bg-background shadow-2xl popup-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1a1a1a" }}>
            <span className="text-white text-xs font-bold">u</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">uso.ai</h1>
            <p className="text-xs text-muted-foreground leading-tight">AI usage dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            {THEME_ICONS[theme]}
          </button>
          <div className="w-px h-4 bg-border shrink-0" />
          <button
            onClick={() => setPage("dashboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              page === "dashboard"
                ? "text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={page === "dashboard" ? { backgroundColor: "#1a1a1a" } : {}}
            title="Dashboard"
          >
            <LayoutDashboard size={13} />
            Dashboard
          </button>
          <button
            onClick={() => setPage("settings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              page === "settings"
                ? "text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={page === "settings" ? { backgroundColor: "#1a1a1a" } : {}}
            title="Settings"
          >
            <SettingsIcon size={13} />
            Settings
          </button>
        </div>
      </div>

      <Separator />

      {/* Scrollable page content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {page === "dashboard" ? (
          <Dashboard key={dashboardKey} onNavigateToSettings={() => setPage("settings")} />
        ) : (
          <Settings onSaved={() => setPage("dashboard")} />
        )}
      </div>
    </div>
  );
}
