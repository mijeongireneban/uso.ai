import { describe, expect, it } from "vitest";
import {
  buildCookieHeader,
  sanitizeCookieCredential,
  sanitizeCredentialField,
} from "@/lib/api/cookies";

describe("cookie credential helpers", () => {
  it("keeps existing bare cookie values backwards compatible", () => {
    expect(buildCookieHeader("sessionKey", "sk-ant-abc")).toBe("sessionKey=sk-ant-abc");
    expect(sanitizeCookieCredential("sessionKey", "sessionKey=sk-ant-abc")).toBe("sk-ant-abc");
  });

  it("preserves pasted full Cookie headers for Cloudflare-backed providers", () => {
    const header = "Cookie: sessionKey=sk-ant-abc; cf_clearance=clearance; other=value";

    expect(sanitizeCookieCredential("sessionKey", header)).toBe(
      "sessionKey=sk-ant-abc; cf_clearance=clearance; other=value"
    );
    expect(buildCookieHeader("sessionKey", header)).toBe(
      "sessionKey=sk-ant-abc; cf_clearance=clearance; other=value"
    );
  });

  it("handles quoted Cookie headers copied from tools", () => {
    expect(buildCookieHeader("sessionKey", '"Cookie: sessionKey=sk-ant-abc; cf_clearance=x"')).toBe(
      "sessionKey=sk-ant-abc; cf_clearance=x"
    );
  });

  it("repairs full cookie headers damaged by the old generic sanitizer", () => {
    expect(buildCookieHeader("sessionKey", "sk-ant-abc; cf_clearance=clearance")).toBe(
      "sessionKey=sk-ant-abc; cf_clearance=clearance"
    );
  });

  it("maps Settings credential fields to the provider cookie names", () => {
    expect(sanitizeCredentialField("sessionToken", "WorkosCursorSessionToken=cursor-token")).toBe(
      "cursor-token"
    );
    expect(sanitizeCredentialField("sessionCookie", "user_session=github-token")).toBe(
      "github-token"
    );
  });
});
