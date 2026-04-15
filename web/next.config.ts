import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Tauri app at the repo root also has a lockfile; pin turbopack to /web
  // so Next.js doesn't infer the wrong workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
