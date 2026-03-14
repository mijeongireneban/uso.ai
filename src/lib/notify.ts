import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

async function ensurePermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  return granted;
}

export async function notify(title: string, body: string) {
  const granted = await ensurePermission();
  if (granted) {
    await sendNotification({ title, body });
  }
}

// Decode JWT exp field (no library needed — just base64 decode the payload)
export function getJwtExpiry(token: string): Date | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (decoded.exp) return new Date(decoded.exp * 1000);
  } catch {
    // not a valid JWT
  }
  return null;
}

// Returns true if token expires within the given minutes
export function expiresWithin(token: string, minutes: number): boolean {
  const expiry = getJwtExpiry(token);
  if (!expiry) return false;
  return expiry.getTime() - Date.now() < minutes * 60 * 1000;
}
