import { Button } from "@/components/ui/Button";
import type { LatestRelease } from "@/lib/github";

export function Download({ release }: { release: LatestRelease }) {
  const downloadHref = release.dmgUrl ?? release.releaseUrl;

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 border-t border-border-subtle">
      <div className="rounded-2xl border border-border-default bg-bg-panel px-8 py-14 text-center">
        <h2 className="text-display text-text-primary text-balance">
          Ready in a few seconds.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-[1.6] text-text-muted text-balance">
          Download the DMG, drag to Applications, paste your session tokens
          once. That&rsquo;s setup.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button href={downloadHref} variant="primary">
            Download {release.version !== "latest" ? release.version : "for macOS"}
          </Button>
          <Button href={release.releaseUrl} variant="ghost">
            Release notes
          </Button>
        </div>

        <p className="mt-4 text-[13px] text-text-subtle">
          Requires macOS 12+. Universal binary (Apple Silicon &amp; Intel).
        </p>
      </div>
    </section>
  );
}
