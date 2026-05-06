import { useState } from "react";
import { saveCredentials } from "@/lib/credentials";
import type { Account, CredentialsStore } from "@/lib/credentials";
import { fetchClaudeUsage } from "@/lib/api/claude";
import { fetchChatGPTUsage } from "@/lib/api/chatgpt";
import { fetchCursorUsage } from "@/lib/api/cursor";
import { fetchCopilotUsage } from "@/lib/api/copilot";

export type SaveStatus = "idle" | "saving" | "saved" | "expired" | "error";

async function validateAccount(serviceId: string, account: Account): Promise<"ok" | "expired" | "error"> {
  const c = account.credentials;
  let status: string = "ok";
  if (serviceId === "claude" && c.orgId && c.sessionKey) {
    status = (await fetchClaudeUsage(c.orgId, c.sessionKey)).status;
  } else if (serviceId === "chatgpt" && c.bearerToken) {
    status = (await fetchChatGPTUsage(c.bearerToken)).status;
  } else if (serviceId === "cursor" && c.sessionToken) {
    status = (await fetchCursorUsage(c.sessionToken)).status;
  } else if (serviceId === "copilot" && c.sessionCookie) {
    status = (await fetchCopilotUsage(c.sessionCookie)).status;
  }
  if (status === "expired") return "expired";
  if (status === "ok") return "ok";
  return "error";
}

/**
 * Hook that wraps the validate-then-persist flow used by both Settings and
 * the onboarding wizard. Returns per-account status and a save() function
 * that mutates the persisted CredentialsStore.
 */
export function useCredentialSave() {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});

  async function save(opts: {
    serviceId: string;
    account: Account;
    persisted: CredentialsStore;
    draftAccountsForService: Account[];
  }): Promise<{ status: SaveStatus; persisted: CredentialsStore | null }> {
    const { serviceId, account, persisted, draftAccountsForService } = opts;
    setStatuses((prev) => ({ ...prev, [account.id]: "saving" }));
    try {
      const validation = await validateAccount(serviceId, account);
      if (validation === "expired") {
        setStatuses((prev) => ({ ...prev, [account.id]: "expired" }));
        return { status: "expired", persisted: null };
      }
      if (validation === "error") {
        setStatuses((prev) => ({ ...prev, [account.id]: "error" }));
        return { status: "error", persisted: null };
      }
      const next: CredentialsStore = { ...persisted, [serviceId]: draftAccountsForService };
      await saveCredentials(next);
      setStatuses((prev) => ({ ...prev, [account.id]: "saved" }));
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [account.id]: "idle" }));
      }, 800);
      return { status: "saved", persisted: next };
    } catch (e) {
      console.error("Failed to save credentials", e);
      setStatuses((prev) => ({ ...prev, [account.id]: "error" }));
      return { status: "error", persisted: null };
    }
  }

  function resetStatus(accountId: string) {
    setStatuses((prev) => ({ ...prev, [accountId]: "idle" }));
  }

  return { statuses, save, resetStatus };
}
