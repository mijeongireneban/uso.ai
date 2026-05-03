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
  /**
   * Short blurb for the announcement banner, parsed from a
   * `<!-- banner: ... -->` marker in the release body.
   * Lets release authors update banner copy by editing the GitHub release —
   * no code change or redeploy needed.
   */
  bannerBlurb: string | null;
}

const FALLBACK: LatestRelease = {
  version: "latest",
  dmgUrl: null,
  releaseUrl: `https://github.com/${REPO}/releases/latest`,
  bannerBlurb: null,
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
      body?: string | null;
      assets: Array<{ name: string; browser_download_url: string }>;
    };

    const dmg = data.assets.find((a) => a.name.endsWith(".dmg"));

    return {
      version: data.tag_name,
      dmgUrl: dmg?.browser_download_url ?? null,
      releaseUrl: data.html_url,
      bannerBlurb: extractBannerBlurb(data.body),
    };
  } catch {
    return FALLBACK;
  }
}

function extractBannerBlurb(body: string | null | undefined): string | null {
  if (!body) return null;
  const match = body.match(/<!--\s*banner:\s*([\s\S]+?)\s*-->/i);
  if (!match) return null;
  const text = match[1].trim();
  if (!text || text.toLowerCase() === "off") return null;
  return text;
}
