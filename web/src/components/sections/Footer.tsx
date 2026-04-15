import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <div className="flex items-center gap-6 text-[13px] text-text-muted">
          <a
            href="https://github.com/mijeongireneban/uso.ai"
            className="hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/mijeongireneban/uso.ai/releases"
            className="hover:text-text-primary transition-colors"
          >
            Releases
          </a>
          <a
            href="https://github.com/mijeongireneban/uso.ai/issues"
            className="hover:text-text-primary transition-colors"
          >
            Issues
          </a>
        </div>
        <div className="text-[13px] text-text-subtle">
          Not affiliated with Anthropic, OpenAI, Anysphere, or Google.
        </div>
      </div>
    </footer>
  );
}
