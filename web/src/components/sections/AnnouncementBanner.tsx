"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

type Props = {
  version: string;
  blurb: string;
  releaseUrl: string;
};

const STORAGE_PREFIX = "uso-banner-dismissed:";

// In-tab listeners so click-to-dismiss updates the UI immediately.
// (The native `storage` event only fires across tabs, not in the same one.)
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  for (const cb of listeners) cb();
}

function readDismissed(version: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + version) === "1";
  } catch {
    return false;
  }
}

export function AnnouncementBanner({ version, blurb, releaseUrl }: Props) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(version),
    // SSR + initial client render: assume not dismissed so the banner is in the
    // DOM by default. React swaps to the real value on the next paint without a
    // hydration warning.
    () => false,
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + version, "1");
    } catch {
      // Storage unavailable — dismissal won't persist across reloads.
    }
    notify();
  };

  return (
    <div
      role="region"
      aria-label="Latest release announcement"
      className="relative z-40 border-b border-border-subtle bg-gradient-to-r from-brand/15 via-brand-violet/15 to-brand/15"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 text-[13px] sm:text-[14px]">
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border-default bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium text-text-primary sm:inline-flex">
          <span className="size-1.5 rounded-full bg-status-green" />
          {version}
        </span>
        <span className="min-w-0 flex-1 truncate text-text-secondary">
          <span className="inline font-medium text-text-primary sm:hidden">
            {version}
          </span>
          <span className="mx-1.5 inline text-text-subtle sm:hidden">·</span>
          {blurb}
        </span>
        <Link
          href={releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 whitespace-nowrap text-[13px] font-medium text-text-primary underline-offset-4 hover:underline sm:text-[14px]"
        >
          Release notes →
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
          >
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
