import { capabilities, site } from "@/lib/site";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16">
      {/* radar backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 35%, var(--color-vayu-accent) 0, transparent 60%)",
        }}
      />

      <header className="flex items-center gap-3">
        <RadarMark />
        <span className="text-lg font-semibold tracking-tight">{site.name}</span>
        <span className="ml-auto rounded-full border border-vayu-border bg-vayu-surface px-3 py-1 text-xs text-vayu-muted">
          v0.1 · foundation
        </span>
      </header>

      <section className="mt-24 max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-vayu-accent">
          Intelligence · Awareness · Strategic advantage
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          {site.tagline}
        </h1>
        <p className="mt-6 text-lg text-vayu-muted">{site.description}</p>
        <div className="mt-8 flex gap-4">
          <a
            href="/editor"
            className="rounded-lg bg-vayu-accent px-5 py-3 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2"
          >
            Open the editor
          </a>
          <a
            href="/login"
            className="rounded-lg border border-vayu-border px-5 py-3 text-sm font-semibold text-vayu-fg transition hover:border-vayu-accent"
          >
            Sign in
          </a>
        </div>
      </section>

      <section className="mt-24 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-vayu-border bg-vayu-border sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((c) => (
          <div key={c.title} className="bg-vayu-surface p-6">
            <h3 className="text-sm font-semibold text-vayu-fg">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-vayu-muted">{c.desc}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto pt-24 text-xs text-vayu-muted">
        Two-plane polyglot architecture · Next.js 16 + FastAPI · pgvector · LangGraph
      </footer>
    </main>
  );
}

function RadarMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12" stroke="var(--color-vayu-accent)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="14" cy="14" r="7" stroke="var(--color-vayu-accent)" strokeWidth="1.5" opacity="0.7" />
      <circle cx="14" cy="14" r="2" fill="var(--color-vayu-accent)" />
      <path d="M14 14 L24 8" stroke="var(--color-vayu-accent-2)" strokeWidth="1.5" />
    </svg>
  );
}
