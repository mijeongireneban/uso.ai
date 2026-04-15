import { cn } from "@/lib/utils";

/**
 * Wordmark: arc monogram + "uso.ai" lockup.
 * The arc echoes the donut usage meters in the app and doubles as a stylized "u".
 * `.ai` at 60% opacity so `uso` reads as the primary name.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-text-primary",
        className,
      )}
    >
      <LogoMark className="size-6 text-brand-violet" />
      <span className="text-[15px] font-medium tracking-[-0.04em]">
        uso<span className="opacity-60">.ai</span>
      </span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M 8 8 L 8 17 A 8 8 0 0 0 24 17 L 24 8"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="17" r="1.8" fill="currentColor" />
    </svg>
  );
}
