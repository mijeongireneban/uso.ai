import claudeShot from "@/assets/onboarding/claude.png";
import chatgptShot from "@/assets/onboarding/chatgpt.png";
import cursorShot from "@/assets/onboarding/cursor.png";
import copilotShot from "@/assets/onboarding/copilot.png";

export type GuideStep = {
  text: string;
  /** Optional copy-button command. Renders as a <pre> with copy affordance. */
  code?: string;
};

export type CredentialGuideContent = {
  serviceId: string;
  intro: string;
  steps: GuideStep[];
  screenshot?: string;
  screenshotCaption?: string;
  /** Used by Gemini in lieu of a screenshot — a short expected-output block. */
  inlineCode?: string;
  troubleshooting?: string;
};

export const GUIDES: Record<string, CredentialGuideContent> = {
  claude: {
    serviceId: "claude",
    intro: "Claude needs your organization ID and session cookie from claude.ai.",
    steps: [
      { text: "Open claude.ai in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to Application → Cookies → https://claude.ai." },
      { text: "Copy the value of the cookie named sessionKey — it starts with sk-ant-." },
      { text: "Switch to the Network tab, refresh the page, and click any request whose URL contains /api/organizations/. Copy the UUID between organizations/ and /usage in the URL — that's your Organization ID." },
    ],
    screenshot: claudeShot,
    screenshotCaption: "DevTools → Application → Cookies. Copy the sessionKey value.",
    troubleshooting: "If sessionKey is missing, sign out and sign back in to claude.ai.",
  },
  chatgpt: {
    serviceId: "chatgpt",
    intro: "ChatGPT (Codex) needs the Authorization header from any chatgpt.com request.",
    steps: [
      { text: "Open chatgpt.com in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to the Network tab and refresh the page." },
      { text: "Click any request to chatgpt.com (e.g. /backend-api/conversations)." },
      { text: "Under Request Headers, find Authorization. Copy everything after Bearer (do not include the word \"Bearer\" or the leading space)." },
    ],
    screenshot: chatgptShot,
    screenshotCaption: "Network tab → click any request → copy the Authorization header.",
    troubleshooting: "Tokens start with eyJ. If yours doesn't, you copied the wrong header.",
  },
  cursor: {
    serviceId: "cursor",
    intro: "Cursor needs the WorkosCursorSessionToken cookie from cursor.com.",
    steps: [
      { text: "Open cursor.com in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to Application → Cookies → https://cursor.com." },
      { text: "Find the cookie named WorkosCursorSessionToken and copy its value." },
    ],
    screenshot: cursorShot,
    screenshotCaption: "DevTools → Application → Cookies → WorkosCursorSessionToken.",
    troubleshooting: "If the cookie is missing, sign out and back into cursor.com first.",
  },
  copilot: {
    serviceId: "copilot",
    intro: "GitHub Copilot needs the user_session cookie from github.com.",
    steps: [
      { text: "Open github.com in your browser and sign in." },
      { text: "Open DevTools — press ⌥⌘I on macOS." },
      { text: "Go to Application → Cookies → https://github.com." },
      { text: "Find the cookie named user_session and copy its value." },
    ],
    screenshot: copilotShot,
    screenshotCaption: "DevTools → Application → Cookies → github.com → user_session.",
    troubleshooting: "Make sure you're signed into github.com (not just GitHub Copilot in your editor).",
  },
  gemini: {
    serviceId: "gemini",
    intro: "Gemini CLI is auto-detected from your local OAuth credentials.",
    steps: [
      { text: "Install the Gemini CLI if you haven't already (npm i -g @google/gemini-cli)." },
      { text: "Run this in your terminal:", code: "gemini auth login" },
      { text: "Sign in with your Google account in the browser tab that opens." },
      { text: "Come back to uso.ai and click \"Detect Gemini CLI\" below." },
    ],
    inlineCode: "Logged in as you@example.com\nCredentials saved to ~/.gemini/oauth_creds.json",
    troubleshooting: "uso.ai reads ~/.gemini/oauth_creds.json. API key and Vertex AI auth modes are not supported.",
  },
};
