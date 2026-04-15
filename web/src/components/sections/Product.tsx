import { LogoMark } from "@/components/ui/Logo";

/**
 * Product showcase — CSS-drawn facsimile of the real menu bar popup.
 *
 * Structure mirrors the actual app: app header (logo + tabs), status row,
 * three Next-reset countdown cards, then a full service card with its
 * per-window usage breakdown. When a real screenshot exists, swap this
 * for <Image src="/screenshot.png" ... />.
 */
export function Product() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative mx-auto max-w-[620px]">
        <div className="rounded-xl border border-border-default bg-bg-marketing shadow-2xl shadow-black/60 overflow-hidden">
          <AppHeader />
          <StatusRow />
          <NextResetGrid />
          <ServiceCard />
        </div>

        <div
          aria-hidden
          className="absolute -top-10 left-1/2 h-10 w-px -translate-x-1/2 bg-gradient-to-t from-border-default to-transparent"
        />
      </div>
    </section>
  );
}

function AppHeader() {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-white">
          <LogoMark className="size-5" />
        </div>
        <div>
          <div className="text-[14px] font-medium text-text-primary leading-tight">
            uso.ai
          </div>
          <div className="text-[11px] text-text-muted leading-tight">
            AI usage dashboard
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className="size-7 rounded-md text-text-muted hover:text-text-primary" aria-label="Theme">
          <svg viewBox="0 0 16 16" className="mx-auto size-4" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M13 9.5A5 5 0 1 1 6.5 3a4 4 0 0 0 6.5 6.5Z" />
          </svg>
        </button>
        <div className="flex items-center gap-1 rounded-md border border-border-default bg-bg-surface/60 px-1 py-0.5">
          <span className="rounded bg-bg-surface-hover px-2 py-1 text-[11px] font-medium text-text-primary">
            Dashboard
          </span>
          <span className="px-2 py-1 text-[11px] text-text-muted">
            Settings
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusRow() {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 text-[11px]">
      <span className="text-text-muted">Updated just now</span>
      <span className="inline-flex items-center gap-1 text-text-muted">
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 8a5 5 0 1 1-1.5-3.5L13 3v3h-3" strokeLinecap="round" />
        </svg>
        Refresh
      </span>
    </div>
  );
}

function NextResetGrid() {
  return (
    <div className="grid grid-cols-3 gap-2 px-5 pb-4">
      <ResetCard service="Claude" value="in 3h 20m" sub="Current session" tone="text-[#d97757]" />
      <ResetCard service="ChatGPT (Codex)" value="in 5h" sub="5-hour session" tone="text-[#10b981]" />
      <ResetCard service="Cursor" value="May 11" sub="Auto · Apr 11 – May 11" tone="text-brand-violet" />
    </div>
  );
}

function ResetCard({
  service,
  value,
  sub,
  tone,
}: {
  service: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface/40 p-2.5">
      <div className="text-[10px] text-text-muted">Next reset · {service}</div>
      <div className={`mt-1 text-[13px] font-medium ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] text-text-subtle">{sub}</div>
    </div>
  );
}

function ServiceCard() {
  return (
    <div className="mx-5 mb-5 rounded-lg border border-border-subtle bg-bg-surface/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px]" aria-hidden>✳︎</span>
          <span className="text-[13px] font-medium text-text-primary">
            Claude
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-status-green" />
          <span className="rounded-md border border-border-default px-1.5 py-0.5 text-[10px] text-text-muted">
            Pro
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <UsageRow label="Current session" pct={14} reset="in 3h 20m" tone="#d97757" />
        <UsageRow label="Weekly · all models" pct={6} reset="Tue 3:00 PM" tone="#d97757" />
        <UsageRow label="Weekly · Sonnet" pct={0} reset="Sat 10:00 PM" tone="#d97757" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
        <span className="text-[11px] text-text-muted">Extra usage</span>
        <span className="text-[11px] text-text-primary">
          $0.00 <span className="text-text-subtle">· of $100.00</span>
        </span>
      </div>
    </div>
  );
}

function UsageRow({
  label,
  pct,
  reset,
  tone,
}: {
  label: string;
  pct: number;
  reset: string;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-primary">
          {pct}% <span className="text-text-subtle">· {reset}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(pct, 1)}%`, background: tone }}
        />
      </div>
    </div>
  );
}
