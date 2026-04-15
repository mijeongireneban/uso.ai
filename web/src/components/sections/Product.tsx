/**
 * Product showcase — a CSS-drawn mock of the menu bar popup.
 *
 * We don't have a real screenshot in the repo yet, so this renders a
 * faithful approximation using the same tokens, radii, and layout the
 * app itself uses. When a real screenshot is added to /web/public,
 * swap this for <Image src="/screenshot.png" ... />.
 */
export function Product() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative mx-auto max-w-[540px]">
        {/* Window chrome — mirrors the app's rounded-xl + border */}
        <div className="rounded-xl border border-border-default bg-bg-panel shadow-2xl shadow-black/60 overflow-hidden">
          {/* Tray indicator */}
          <div className="flex items-center justify-center py-2 border-b border-border-subtle">
            <div className="size-1 rounded-full bg-text-subtle" />
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-medium text-text-primary">
                Usage
              </div>
              <div className="text-[11px] text-text-subtle">
                Refreshed 2m ago
              </div>
            </div>

            {/* Service cards */}
            <div className="grid grid-cols-2 gap-3">
              <ServiceCard name="Claude" pct={64} resetIn="3d 14h" tone="#d97757" />
              <ServiceCard name="ChatGPT" pct={28} resetIn="2d 4h" tone="#10a37f" />
              <ServiceCard name="Cursor" pct={91} resetIn="6d 2h" tone="#7170ff" />
              <ServiceCard name="Gemini" pct={12} resetIn="1d 8h" tone="#5e6ad2" />
            </div>
          </div>
        </div>

        {/* Callout arrow to menu bar origin — subtle storytelling */}
        <div
          aria-hidden
          className="absolute -top-10 left-1/2 h-10 w-px -translate-x-1/2 bg-gradient-to-t from-border-default to-transparent"
        />
      </div>
    </section>
  );
}

function ServiceCard({
  name,
  pct,
  resetIn,
  tone,
}: {
  name: string;
  pct: number;
  resetIn: string;
  tone: string;
}) {
  const circumference = 2 * Math.PI * 18;
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-surface/60 p-3">
      <svg viewBox="0 0 44 44" className="size-10 shrink-0 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r="18"
          stroke="var(--border-default)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r="18"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-text-primary truncate">
          {name}
        </div>
        <div className="text-[11px] text-text-muted">
          {pct}% · {resetIn}
        </div>
      </div>
    </div>
  );
}
