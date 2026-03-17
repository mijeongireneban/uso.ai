import { invoke } from "@tauri-apps/api/core";

/**
 * Calls the Rust `detect_cursor_credentials` command.
 * Returns { token } on success or { error } with a human-readable message on failure.
 * The caller is responsible for saving the token under credentials.sessionToken.
 */
export async function detectCursorCredentials(): Promise<
  { token: string } | { error: string }
> {
  try {
    const token = await invoke<string>("detect_cursor_credentials");
    return { token };
  } catch (e) {
    return { error: String(e) };
  }
}
