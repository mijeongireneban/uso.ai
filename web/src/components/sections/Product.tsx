import Image from "next/image";

/**
 * Product showcase — real screenshot of the menu bar popup.
 *
 * The image is the 440×760 popover captured at Retina (2×) and dropped into
 * /public. Sized to match the design's narrow popover proportion so it reads
 * as the real artifact, not a marketing illustration.
 */
export function Product() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative mx-auto max-w-[440px]">
        <div className="rounded-xl border border-border-default bg-bg-marketing shadow-2xl shadow-black/60 overflow-hidden">
          <Image
            src="/screenshot-dashboard.png"
            alt="uso.ai menu bar popup showing the Claude session, weekly limits, and ChatGPT usage at a glance"
            width={880}
            height={1520}
            priority
            className="block w-full h-auto"
          />
        </div>

        <div
          aria-hidden
          className="absolute -top-10 left-1/2 h-10 w-px -translate-x-1/2 bg-gradient-to-t from-border-default to-transparent"
        />
      </div>
    </section>
  );
}
