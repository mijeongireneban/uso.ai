/**
 * Fetches the latest uso.ai GitHub release at build time.
 * Returns the DMG asset URL + version for the Download CTA.
 *
 * Called from server components only — runs during `next build`, never at
 * request time. Falls back to a safe default if the API is unreachable
 * (rare during build, but keeps the site deployable if GitHub is down).
 */

const REPO = "mijeongireneban/uso.ai";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface LatestRelease {
  version: string;
  dmgUrl: string | null;
  releaseUrl: string;
}

const FALLBACK: LatestRelease = {
  version: "latest",
  dmgUrl: null,
  releaseUrl: `https://github.com/${REPO}/releases/latest`,
};

export async function getLatestRelease(): Promise<LatestRelease> {
  try {
    const res = await fetch(API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      // Revalidate hourly — a new release shouldn't wait 24h to show up.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK;

    const data = (await res.json()) as {
      tag_name: string;
      html_url: string;
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    const dmg = data.assets.find((a) => a.name.endsWith(".dmg"));

    return {
      version: data.tag_name,
      dmgUrl: dmg?.browser_download_url ?? null,
      releaseUrl: data.html_url,
    };
  } catch {
    return FALLBACK;
  }
}
