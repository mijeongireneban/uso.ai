import { Sparkles } from "lucide-react";
import { ServiceAvatar } from "@/components/ServiceAvatar";
import type { ServiceData } from "@/types";

type Props = {
  service: ServiceData;
  isMostUrgent: boolean;
  multi: boolean;
  /** Total accounts shown on the dashboard, surfaced in the hero meta strip. */
  activeAccounts: number;
};

function Ring({ value, warn }: { value: number; warn: boolean }) {
  const size = 64;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)", display: "block" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="ring-bg"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dash}
        className={warn ? "ring-fg" : "ring-fg"}
        style={{ stroke: warn ? "var(--warn)" : "var(--accent)" }}
      />
    </svg>
  );
}

/**
 * Boil a verbose window label like "Weekly · all models" or "Weekly limit (Codex)"
 * down to a single word for the hero meta — design copy reads "Next weekly reset",
 * not "Next weekly · all models reset". Keeps the meta strip tight and scannable.
 */
function shortWindowKeyword(label: string): string {
  const trimmed = label.split(/[·(]/)[0].trim();
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.toLowerCase();
}

export function Hero({ service, isMostUrgent, multi, activeAccounts }: Props) {
  // Find the first window with a real reset — that's the soonest one we know about.
  const realWindows = service.windows.filter((w) => w.resetsAt && w.resetsAt !== "—");
  const soonest = realWindows[0] ?? service.windows[0] ?? null;
  // The "next" reset shown in the meta strip is the next window after `soonest`
  // (typically the weekly window when the primary is a session window).
  const nextReset = realWindows[1] ?? null;
  const primaryPct = service.windows[0]?.usedPercent ?? 0;
  const warn = primaryPct >= 90;
  // Ring shows the primary window's used percent (warns also fill toward 100).
  const ringValue = Math.min(1, Math.max(0, primaryPct / 100));

  const displayName = service.label ? `${service.name} · ${service.label}` : service.name;
  const sub = warn ? "Usage warning · " : "Next reset · ";

  return (
    <div className={`hero ${warn ? "warn" : ""}`}>
      <div className="flex items-start gap-3.5">
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <Ring value={ringValue} warn={warn} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="prov-logo" style={{ width: 34, height: 34 }}>
              <ServiceAvatar name={service.name} />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="eyebrow flex items-center gap-2 flex-wrap mb-1">
            {multi && isMostUrgent && (
              <span className="hero-pill">
                <Sparkles size={9} />
                Most urgent
              </span>
            )}
            <span>
              {sub}
              {displayName}
            </span>
          </div>
          <div className="hero-title">
            <span className="accent">
              {warn ? `${primaryPct}%` : soonest?.resetsAt ?? "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
            {warn ? "Weekly limit · resets " : `${soonest?.label ?? "No window"} · resets `}
            <strong className="font-medium text-foreground">
              {soonest?.resetsAt ?? "—"}
            </strong>
          </p>
        </div>
      </div>

      <div className="hero-meta">
        <div>
          {nextReset ? `Next ${shortWindowKeyword(nextReset.label)} reset` : "Resets"}{" "}
          <span>{nextReset?.resetsAt ?? soonest?.resetsAt ?? "—"}</span>
        </div>
        <div>
          Active accounts <span>{activeAccounts}</span>
        </div>
      </div>
    </div>
  );
}
