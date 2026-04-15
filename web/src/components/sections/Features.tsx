const features = [
  {
    title: "One menu bar, every subscription",
    body: "Claude, ChatGPT, Cursor, and Gemini in a single popup. No more tab-hopping to check if you're about to hit a limit.",
  },
  {
    title: "Exact reset times",
    body: "Not \"resets soon.\" The actual hour your window rolls over, per account, with countdowns surfaced at the top.",
  },
  {
    title: "Multiple accounts per service",
    body: "Running a personal and a work Claude? Add both. Each account gets its own card, its own email, its own history.",
  },
  {
    title: "Credentials stay local",
    body: "Your session tokens are stored on your Mac via Tauri's local store. Nothing syncs to a server, because there is no server.",
  },
  {
    title: "Token expiry notifications",
    body: "ChatGPT Bearer tokens are JWTs that quietly expire. uso.ai pings you 30 minutes out so you can refresh before your dashboard goes blank.",
  },
  {
    title: "Daily history",
    body: "A snapshot every day, per account. Glance back to see whether that Cursor week was an outlier or the new normal.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 border-t border-border-subtle">
      <div className="max-w-2xl">
        <h2 className="text-display text-text-primary text-balance">
          Built for people paying for more than one.
        </h2>
        <p className="mt-4 text-[17px] leading-[1.6] text-text-muted text-balance">
          If you juggle three AI subscriptions and still get surprised by a
          limit, this is for you.
        </p>
      </div>

      <div className="mt-14 grid gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden border border-border-subtle">
        {features.map((f) => (
          <div
            key={f.title}
            className="bg-bg-marketing p-7"
          >
            <h3 className="text-[16px] font-medium text-text-primary">
              {f.title}
            </h3>
            <p className="mt-2 text-[14px] leading-[1.6] text-text-muted">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
