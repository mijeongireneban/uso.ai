import { useState } from "react";
import { LayoutDashboard, Settings as SettingsIcon, Sun, Moon, Monitor } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import { useTheme } from "@/lib/useTheme";
import type { Theme } from "@/lib/useTheme";

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun size={13} />,
  dark: <Moon size={13} />,
  system: <Monitor size={13} />,
};

type Page = "dashboard" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const { theme, cycleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
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
          <Separator orientation="vertical" className="h-4" />
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

      {/* Page content */}
      <div className="px-8 py-5">
        {page === "dashboard" ? (
          <Dashboard onNavigateToSettings={() => setPage("settings")} />
        ) : (
          <Settings onSaved={() => setPage("dashboard")} />
        )}
      </div>
    </div>
  );
}
