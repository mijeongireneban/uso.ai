import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE = "https://uso.ai";
const TITLE = "uso.ai — See where your AI usage goes";
const DESC =
  "A menu bar dashboard for Claude, ChatGPT, Cursor, and Gemini. Track usage, resets, and subscription limits in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: "%s · uso.ai",
  },
  description: DESC,
  applicationName: "uso.ai",
  keywords: [
    "AI usage",
    "Claude",
    "ChatGPT",
    "Cursor",
    "Gemini",
    "menu bar",
    "macOS",
    "subscription dashboard",
  ],
  openGraph: {
    type: "website",
    url: SITE,
    title: TITLE,
    description: DESC,
    siteName: "uso.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
  icons: {
    icon: "/logomark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-marketing text-text-primary antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
