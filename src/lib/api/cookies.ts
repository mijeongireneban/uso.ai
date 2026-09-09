const COOKIE_PREFIX_RE = /^cookie\s*:\s*/i;

const COOKIE_NAMES_BY_FIELD: Record<string, string> = {
  sessionKey: "sessionKey",
  sessionToken: "WorkosCursorSessionToken",
  sessionCookie: "user_session",
};

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function decodeBareCookieValue(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function startsWithCookieName(value: string, cookieName: string): boolean {
  return value.toLowerCase().startsWith(`${cookieName.toLowerCase()}=`);
}

function cookieHeaderHasName(value: string, cookieName: string): boolean {
  const name = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|;)\\s*${name}=`, "i").test(value);
}

/**
 * Cleans credential input for cookie-backed providers.
 *
 * Bare values stay bare for backwards compatibility, while pasted Cookie
 * headers keep every cookie pair. The first-part repair handles values that
 * were previously saved after the generic sanitizer stripped `sessionKey=`
 * from a full Claude cookie header.
 */
export function sanitizeCookieCredential(cookieName: string, value: string): string {
  let cleaned = stripWrappingQuotes(value.trim()).replace(COOKIE_PREFIX_RE, "").trim();
  cleaned = stripWrappingQuotes(cleaned).trim();
  if (!cleaned) return "";

  const parts = cleaned
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const repaired = parts.map((part, index) =>
      index === 0 && !part.includes("=") ? `${cookieName}=${part}` : part
    );
    return repaired.join("; ");
  }

  if (startsWithCookieName(cleaned, cookieName)) {
    cleaned = cleaned.slice(cookieName.length + 1).trim();
  }

  return decodeBareCookieValue(cleaned);
}

export function sanitizeCredentialField(fieldKey: string, value: string): string {
  const cookieName = COOKIE_NAMES_BY_FIELD[fieldKey];
  if (cookieName) return sanitizeCookieCredential(cookieName, value);

  let cleaned = stripWrappingQuotes(value.trim());
  const prefix = `${fieldKey}=`;
  if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
    cleaned = cleaned.slice(prefix.length).trim();
  }
  return decodeBareCookieValue(cleaned);
}

export function buildCookieHeader(cookieName: string, credential: string): string {
  const cleaned = sanitizeCookieCredential(cookieName, credential);
  if (!cleaned) return `${cookieName}=`;
  if (cleaned.includes(";") || cookieHeaderHasName(cleaned, cookieName)) return cleaned;
  return `${cookieName}=${cleaned}`;
}
