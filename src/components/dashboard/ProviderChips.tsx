import { Plus } from "lucide-react";
import { getServiceByName } from "@/lib/services";
import type { ServiceData } from "@/types";

type Props = {
  services: ServiceData[];
  activeId: string;
  mostUrgentId: string;
  onSelect: (accountId: string) => void;
  onAdd?: () => void;
};

/** Trim parenthetical suffixes ("ChatGPT (Codex)" → "ChatGPT") so chips stay
 *  short and match the design's per-provider naming. */
function chipDisplayName(name: string): string {
  return name.replace(/\s*\(.*?\)\s*$/, "").trim();
}

export function ProviderChips({ services, activeId, mostUrgentId, onSelect, onAdd }: Props) {
  const multi = services.length > 1;
  return (
    <div className="chip-strip">
      {services.map((s) => {
        const pct = s.windows[0]?.usedPercent ?? 0;
        const isActive = activeId === s.accountId;
        const isUrgent = s.accountId === mostUrgentId;
        const color = getServiceByName(s.name)?.color ?? "#888";
        const title = isUrgent ? "Most urgent · click to focus" : "Click to focus";
        const short = chipDisplayName(s.name);
        return (
          <button
            key={s.accountId}
            type="button"
            className="chip"
            data-active={isActive}
            onClick={() => onSelect(s.accountId)}
            title={title}
          >
            <span className="swatch" style={{ background: color }} />
            <span>{s.label ? `${short} · ${s.label}` : short}</span>
            <span className="pct">{pct}%</span>
            {multi && isUrgent && <span className="chip-flag" title="Most urgent">!</span>}
          </button>
        );
      })}
      {onAdd && (
        <button type="button" className="chip add" onClick={onAdd} title="Add an account">
          <Plus size={11} />
          Add account
        </button>
      )}
    </div>
  );
}
