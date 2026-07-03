"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TiltCard } from "@/components/landing/tilt-card";
import { GlowButton } from "@/components/landing/glow-button";
import { Magnetic } from "@/components/landing/magnetic";
import { motion, useReducedMotion } from "framer-motion";

interface Source {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  sourceType: string;
  stored?: boolean;
}

interface Citation {
  sourceId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

interface AskResult {
  answer: string;
  confidence: number;
  citations: Citation[];
  retrieval: { model: string; candidates: number; used: number };
}

const MAX_UPLOAD_MB = 25;

function FloatCard({
  children,
  className = "",
  delay = 0,
  duration = 6,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.5 + delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute z-20 ${className}`}
    >
      <motion.div
        animate={reduced ? undefined : { y: [0, -9, 0], rotate: [0, -0.8, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        whileHover={reduced ? undefined : { scale: 1.06, rotate: 0 }}
        className="glass shadow-ambient rounded-2xl px-4 py-3 will-transform backdrop-blur-md bg-black/40 border border-white/10"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function ResearchPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/research/sources");
    if (res.ok) setSources(((await res.json()).sources ?? []) as Source[]);
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setNotice(`"${file.name}" is too large — the limit is ${MAX_UPLOAD_MB}MB.`);
      e.target.value = "";
      return;
    }
    setNotice(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const res = await fetch("/api/research/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          detail?: string;
          error?: string;
        };
        setNotice(data.detail ?? data.error ?? "Upload failed. Please try again.");
      }
      await loadSources();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onAddUrl() {
    if (!url.trim()) return;
    setAddingUrl(true);
    try {
      await fetch("/api/research/ingest-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setUrl("");
      await loadSources();
    } finally {
      setAddingUrl(false);
    }
  }

  async function onAsk() {
    if (!query.trim()) return;
    setAsking(true);
    setResult(null);
    try {
      const res = await fetch("/api/research/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, topK: 8 }),
      });
      setResult((await res.json()) as AskResult);
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[#050505] text-white selection:bg-vayu-violet selection:text-black overflow-hidden px-6 py-12">
      {/* Background Decorative Mesh/Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-vayu-violet/10 via-[#050505] to-[#050505] opacity-60"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>

      {/* Floating HUD Elements */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none lg:block [&>*]:pointer-events-auto">
        <FloatCard className="left-[4%] top-[25%]" delay={0.3} duration={6.5}>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-wider text-vayu-muted">Vector Search</p>
            <div className="flex items-center gap-1.5 opacity-80" aria-hidden>
              <div className="grid gap-0.5">
                <span className="h-0.5 w-3 rounded-full bg-vayu-fg/40" />
                <span className="h-0.5 w-2 rounded-full bg-vayu-fg/40" />
                <span className="h-0.5 w-2.5 rounded-full bg-vayu-fg/40" />
              </div>
              <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-vayu-violet"
                animate={reduced ? undefined : { x: [0, 2, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </motion.svg>
            </div>
          </div>
        </FloatCard>
        
        <FloatCard className="right-[4%] top-[18%]" delay={0.6} duration={5.8}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-vayu-violet/20 text-vayu-violet">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-5" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <div>
              <p className="text-[11px] font-semibold text-vayu-fg">Sources Indexed</p>
              <p className="text-[10px] text-vayu-muted">{sources.length} active documents</p>
            </div>
          </div>
        </FloatCard>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-violet">
              Intelligence Plane
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Research Center</h1>
          </div>
          <Magnetic strength={0.2}>
            <div className="inline-block">
              <GlowButton href="/" variant="ghost" className="px-4 py-2">
                ← Return Home
              </GlowButton>
            </div>
          </Magnetic>
        </header>

        <TiltCard maxTilt={2.5} className="mb-8 rounded-3xl shadow-2xl">
          <section className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide">Knowledge Sources</h2>
              <Magnetic strength={0.1}>
                <label className="cursor-pointer relative overflow-hidden rounded-xl bg-vayu-violet px-4 py-2 text-sm font-semibold text-white transition hover:bg-vayu-violet/80">
                  {uploading ? "Uploading…" : "Upload Document"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt,.md,.csv,.xlsx"
                    className="hidden"
                    onChange={onUpload}
                    disabled={uploading}
                  />
                </label>
              </Magnetic>
            </div>
            
            <div className="mt-6 flex flex-col md:flex-row gap-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddUrl()}
                placeholder="…or paste a web URL to ingest"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-vayu-fg outline-none transition focus:border-vayu-violet focus:bg-white/10 focus:shadow-[0_0_15px_rgba(139,92,246,0.2)]"
              />
              <Magnetic strength={0.1}>
                <button
                  onClick={onAddUrl}
                  disabled={addingUrl}
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium transition hover:border-vayu-violet hover:bg-vayu-violet/10 hover:text-white disabled:opacity-60"
                >
                  {addingUrl ? "Adding…" : "Ingest URL"}
                </button>
              </Magnetic>
            </div>

            {notice && (
              <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-vayu-border bg-vayu-bg px-4 py-3 text-xs text-vayu-muted">
                {notice}
              </motion.p>
            )}
            
            <ul className="mt-6 flex flex-col gap-3">
              {sources.length === 0 && (
                <li className="text-sm text-vayu-muted/60 italic p-4 text-center border border-dashed border-white/10 rounded-xl">No sources yet — upload a document to begin.</li>
              )}
              {sources.map((s, i) => (
                <motion.li
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm hover:border-white/10 transition"
                >
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="ml-3 flex shrink-0 items-center gap-3 text-xs text-vayu-muted">
                    {s.stored && (
                      <span className="rounded bg-vayu-violet/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-vayu-violet shadow-[0_0_8px_rgba(139,92,246,0.4)]">
                        saved
                      </span>
                    )}
                    <span className="font-mono opacity-80">
                      {s.sourceType} · {s.chunkCount} chunks
                    </span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </section>
        </TiltCard>

        <TiltCard maxTilt={2} className="rounded-3xl shadow-2xl">
          <section className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]">
            <h2 className="text-sm font-semibold tracking-wide">Query Engine</h2>
            <div className="mt-6 flex flex-col md:flex-row gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAsk()}
                placeholder="Ask your vectorized knowledge base..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-vayu-fg outline-none transition focus:border-vayu-violet focus:bg-white/10 focus:shadow-[0_0_15px_rgba(139,92,246,0.2)]"
              />
              <Magnetic strength={0.1}>
                <button
                  onClick={onAsk}
                  disabled={asking}
                  className="rounded-xl bg-vayu-violet px-8 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition hover:bg-vayu-violet/80 hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] disabled:opacity-60"
                >
                  {asking ? "Synthesizing…" : "Ask"}
                </button>
              </Magnetic>
            </div>

            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-vayu-muted uppercase tracking-wider font-semibold">Confidence Metric</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((result.confidence ?? 0) * 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-vayu-violet shadow-[0_0_10px_rgba(139,92,246,0.8)]"
                    />
                  </div>
                  <span className="text-xs text-vayu-violet font-mono">
                    {Math.round((result.confidence ?? 0) * 100)}%
                  </span>
                </div>
                
                <div className="mt-6 p-6 rounded-2xl bg-white/5 border border-white/10 relative">
                  <div className="absolute -top-3 -left-3 grid h-8 w-8 place-items-center rounded-xl bg-vayu-violet/20 text-vayu-violet border border-vayu-violet/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">
                    {result.answer}
                  </p>
                </div>

                {result.citations?.length > 0 && (
                  <div className="mt-8">
                    <p className="text-xs font-semibold uppercase tracking-widest text-vayu-muted mb-4">
                      Grounding Citations ({result.retrieval?.used ?? result.citations.length})
                    </p>
                    <ul className="grid gap-3 grid-cols-1 md:grid-cols-2">
                      {result.citations.map((c, i) => (
                        <motion.li
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          key={`${c.sourceId}-${c.chunkIndex}`}
                          className="rounded-xl border border-white/5 bg-white/5 p-4 text-xs text-vayu-muted hover:border-vayu-violet/30 transition duration-300"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-vayu-violet font-mono font-bold tracking-wider">REF_[{i + 1}]</span>
                            <span className="text-[10px] font-mono opacity-60">SCORE:{c.score.toFixed(2)}</span>
                          </div>
                          <span className="leading-relaxed opacity-90 line-clamp-3">{c.snippet}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </section>
        </TiltCard>
      </div>
    </main>
  );
}
