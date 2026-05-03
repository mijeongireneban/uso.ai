import { getLatestRelease } from "@/lib/github";
import { AnnouncementBanner } from "@/components/sections/AnnouncementBanner";
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { Product } from "@/components/sections/Product";
import { Features } from "@/components/sections/Features";
import { Download } from "@/components/sections/Download";
import { Footer } from "@/components/sections/Footer";

export default async function HomePage() {
  const release = await getLatestRelease();

  return (
    <>
      {release.bannerBlurb && (
        <AnnouncementBanner
          version={release.version}
          blurb={release.bannerBlurb}
          releaseUrl={release.releaseUrl}
        />
      )}
      <Nav dmgUrl={release.dmgUrl} />
      <main>
        <Hero release={release} />
        <Product />
        <Features />
        <Download release={release} />
      </main>
      <Footer />
    </>
  );
}
