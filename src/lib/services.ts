import claudeLogo from "@/assets/claude.png";
import chatgptLogo from "@/assets/chatgpt.png";
import cursorLogo from "@/assets/cursor.png";

export type FieldConfig = {
  key: string;
  label: string;
  placeholder: string;
  hint: string;
};

export type ServiceConfig = {
  id: string;
  name: string;
  color: string;
  logo: string;
  fields: FieldConfig[];
};

export const SERVICES: ServiceConfig[] = [
  {
    id: "claude",
    name: "Claude",
    color: "#cc785c",
    logo: claudeLogo,
    fields: [
      {
        key: "orgId",
        label: "Organization ID",
        placeholder: "259a829d-c8a3-485a-8403-...",
        hint: "Found in the URL: claude.ai/api/organizations/{org_id}/usage",
      },
      {
        key: "sessionKey",
        label: "Session Key",
        placeholder: "sk-ant-...",
        hint: "DevTools → Network → any request → Cookie header → sessionKey value",
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    color: "#19c37d",
    logo: chatgptLogo,
    fields: [
      {
        key: "bearerToken",
        label: "Bearer Token",
        placeholder: "eyJhbGci...",
        hint: "DevTools → Network → any request → Authorization header (without 'Bearer ')",
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    color: "#6e7bff",
    logo: cursorLogo,
    fields: [
      {
        key: "sessionToken",
        label: "Session Token",
        placeholder: "user_01J6T9QTW60CGK6...",
        hint: "DevTools → Network → any request → Cookie header → WorkosCursorSessionToken value",
      },
    ],
  },
];

export function getServiceByName(name: string): ServiceConfig | undefined {
  return SERVICES.find((s) => s.name === name);
}
