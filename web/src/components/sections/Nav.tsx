import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export function Nav({ dmgUrl }: { dmgUrl: string | null }) {
  return (
    <header className="sticky top-0 z-30 bg-bg-marketing/80 backdrop-blur-md border-b border-border-subtle">
      <nav className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/" aria-label="uso.ai home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/mijeongireneban/uso.ai"
            className="text-[14px] text-text-muted hover:text-text-primary transition-colors px-3 py-2"
          >
            GitHub
          </Link>
          <Button
            href={dmgUrl ?? "https://github.com/mijeongireneban/uso.ai/releases/latest"}
            variant="primary"
            className="text-[14px] px-3 py-1.5"
          >
            Download
          </Button>
        </div>
      </nav>
    </header>
  );
}
