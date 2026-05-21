import { fetch } from "@tauri-apps/plugin-http";

/**
 * Wraps `@tauri-apps/plugin-http`'s fetch with a single retry on transient
 * failures and a browser-shaped header set. Tauri's HTTP client otherwise
 * sends a bare `Cookie:` with no User-Agent / Accept / Accept-Language, which
 * Cloudflare-fronted providers (Claude, ChatGPT, Cursor, GitHub) routinely
 * flag as bot traffic and answer with a 403 — even though the credential is
 * valid. Without retry, a single transient 403 surfaces as a persistent
 * "Token expired" card until the next 5-min poll.
 *
 * Retry only fires on statuses that are typically transient (403, 408, 429,
 * 5xx) or on a thrown network error. 401 is NOT retried because that almost
 * always means the credential really is invalid.
 */

type FetchInit = Parameters<typeof fetch>[1];

type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
};

const RETRYABLE_STATUS = new Set([403, 408, 429, 500, 502, 503, 504]);

const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: string,
  init: FetchInit = {},
  opts: RetryOptions = {}
): Promise<Response> {
  const { retries = 1, retryDelayMs = 900 } = opts;
  const callerHeaders = (init?.headers ?? {}) as Record<string, string>;
  const merged: FetchInit = {
    ...init,
    headers: { ...DEFAULT_BROWSER_HEADERS, ...callerHeaders },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, merged);
      if (res.ok) return res;
      if (attempt < retries && RETRYABLE_STATUS.has(res.status)) {
        await sleep(retryDelayMs);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(retryDelayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("fetchWithRetry exhausted retries");
}
