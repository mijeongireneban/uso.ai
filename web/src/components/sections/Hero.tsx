import { Button } from "@/components/ui/Button";
import type { LatestRelease } from "@/lib/github";

export function Hero({ release }: { release: LatestRelease }) {
  const downloadHref = release.dmgUrl ?? release.releaseUrl;

  return (
    <section className="relative overflow-hidden">
      {/* Soft brand glow behind the headline — ties the page to the app */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[480px] w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, var(--brand-violet), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-white/[0.02] px-3 py-1 text-[13px] text-text-muted">
          <span className="size-1.5 rounded-full bg-status-green" />
          macOS menu bar · {release.version}
        </div>

        <h1 className="mt-6 text-display-xl text-text-primary text-balance">
          See where your AI usage goes.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[18px] leading-[1.6] text-text-muted text-balance">
          A menu bar dashboard for Claude, ChatGPT, Cursor, and Gemini.
          One glance, every subscription, exact reset times.
        </p>

        <div className="mt-9 flex items-center justify-center gap-3">
          <Button href={downloadHref} variant="primary">
            Download for macOS
          </Button>
          <Button
            href="https://github.com/mijeongireneban/uso.ai"
            variant="ghost"
          >
            View on GitHub
          </Button>
        </div>

        <p className="mt-4 text-[13px] text-text-subtle">
          Free · Apple Silicon &amp; Intel · Your credentials never leave your Mac
        </p>
      </div>
    </section>
  );
}
