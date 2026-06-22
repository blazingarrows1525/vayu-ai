import { capabilities, site } from "@/lib/site";

const FLOATERS = [
  { label: "Write", x: "-6%", y: "6%", delay: "0s", accent: "accent", icon: pen },
  { label: "Research", x: "82%", y: "0%", delay: "0.7s", accent: "violet", icon: search },
  { label: "Agents", x: "88%", y: "66%", delay: "1.3s", accent: "violet", icon: spark },
  { label: "Vault", x: "-10%", y: "70%", delay: "0.4s", accent: "accent", icon: layers },
] as const;

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-32 pt-16">
      <header className="flex items-center gap-3">
        <RadarMark />
        <span className="text-lg font-semibold tracking-tight">{site.name}</span>
        <span className="glass ml-auto rounded-full px-3 py-1 text-xs text-vayu-muted">
          v1.0 · two-plane · 14 modules
        </span>
      </header>

      <section className="mt-20 grid items-center gap-16 lg:mt-28 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: copy */}
        <div className="animate-rise">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-vayu-accent">
            Intelligence · Awareness · Strategic advantage
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            <span className="text-gradient">{site.tagline}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-vayu-muted">
            {site.description}
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="/editor"
              className="glow rounded-xl bg-vayu-accent px-6 py-3 text-sm font-semibold text-vayu-bg transition-transform duration-200 hover:-translate-y-0.5"
            >
              Open the workspace
            </a>
            <a
              href="/login"
              className="glass rounded-xl px-6 py-3 text-sm font-semibold text-vayu-fg transition-transform duration-200 hover:-translate-y-0.5"
            >
              Sign in
            </a>
          </div>
        </div>

        {/* Right: floating AI core */}
        <div className="relative mx-auto aspect-square w-full max-w-md">
          {/* orbit rings */}
          <div className="animate-spin-slow absolute inset-[8%] rounded-full border border-vayu-accent/15" />
          <div
            className="animate-spin-slow absolute inset-[22%] rounded-full border border-vayu-violet/15"
            style={{ animationDirection: "reverse", animationDuration: "34s" }}
          />
          {/* core orb */}
          <div className="animate-float-slow absolute inset-[34%] grid place-items-center">
            <div className="animate-pulse-glow grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-vayu-accent/30 to-vayu-violet/30">
              <RadarMark size={56} />
            </div>
          </div>
          {/* floating capability chips */}
          {FLOATERS.map((f, i) => (
            <div
              key={f.label}
              className="animate-float absolute"
              style={{ left: f.x, top: f.y, animationDelay: f.delay }}
            >
              <div
                className={`glass flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${
                  f.accent === "violet" ? "glow-violet" : "glow"
                }`}
              >
                <span
                  className={`h-5 w-5 ${
                    f.accent === "violet" ? "text-vayu-violet" : "text-vayu-accent"
                  }`}
                >
                  {f.icon()}
                </span>
                <span className="text-xs font-semibold text-vayu-fg">{f.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-28 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((c, i) => (
          <div
            key={c.title}
            className="glass animate-rise group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:glow"
            style={{ animationDelay: `${0.1 + i * 0.08}s` }}
          >
            <h3 className="text-sm font-semibold text-vayu-fg transition-colors group-hover:text-vayu-accent">
              {c.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-vayu-muted">{c.desc}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 text-xs text-vayu-muted">
        Two-plane polyglot architecture · Next.js 16 + FastAPI · pgvector · LangGraph
      </footer>
    </main>
  );
}

function RadarMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12" stroke="var(--color-vayu-accent)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="14" cy="14" r="7" stroke="var(--color-vayu-accent)" strokeWidth="1.5" opacity="0.7" />
      <circle cx="14" cy="14" r="2" fill="var(--color-vayu-accent)" />
      <path d="M14 14 L24 8" stroke="var(--color-vayu-accent-2)" strokeWidth="1.5" />
    </svg>
  );
}

function pen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function search() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function spark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}
function layers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3 7l9 4 9-4-9-4ZM3 12l9 4 9-4" />
    </svg>
  );
}
