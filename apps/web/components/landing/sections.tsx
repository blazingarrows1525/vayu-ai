"use client";

import { motion } from "framer-motion";
import { capabilities } from "@/lib/site";
import { CountUp } from "./count-up";
import { GlowButton } from "./glow-button";
import { Magnetic } from "./magnetic";
import { ScrambleText } from "./scramble-text";
import { TiltCard } from "./tilt-card";

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-2xl text-center"
    >
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-vayu-accent">
        <ScrambleText text={kicker} />
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
    </motion.div>
  );
}

export function Capabilities() {
  return (
    <section id="capabilities" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-28">
      <SectionTitle kicker="One workspace" title="Everything a thinking team ships with" />
      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((c, i) => (
          <motion.div
            key={c.title}
            custom={i}
            variants={rise}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            <TiltCard className="group h-full rounded-2xl">
              <div className="glass flex h-full flex-col rounded-2xl p-6 transition-shadow duration-300 group-hover:glow">
                <h3 className="text-sm font-semibold text-vayu-fg transition-colors group-hover:text-vayu-accent">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-vayu-muted">{c.desc}</p>
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const STATS = [
  { value: 5, suffix: "", label: "LLM providers, one contract" },
  { value: 7, suffix: "", label: "agent personas on LangGraph" },
  { value: 8, suffix: "+", label: "document formats ingested" },
  { value: 99.9, suffix: "%", label: "answers grounded in citations", decimals: 1 },
] as const;

export function Stats() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-28">
      <div className="glass shadow-ambient grid grid-cols-2 gap-y-10 rounded-3xl px-6 py-12 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-4xl font-bold tabular-nums text-gradient sm:text-5xl">
              <CountUp to={s.value} suffix={s.suffix} decimals={"decimals" in s ? s.decimals : 0} />
            </p>
            <p className="mt-2 text-xs text-vayu-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const PLANES = [
  {
    name: "Product plane",
    tech: "Next.js 16 · React 19 · Better Auth · Drizzle",
    desc: "The surface you touch — editor, research, agents, vault. Server-rendered, session-guarded, instant.",
    accent: "accent" as const,
  },
  {
    name: "Intelligence plane",
    tech: "FastAPI · pgvector · LangGraph · 5 LLM providers",
    desc: "The engine underneath — hybrid retrieval, streaming copilot, agent graphs. Stateless JWT bridge, independently scalable.",
    accent: "violet" as const,
  },
];

export function Architecture() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-28" data-story>
      <SectionTitle kicker="Two planes, one bridge" title="Built like infrastructure, feels like magic" />
      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {PLANES.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, x: i === 0 ? -32 : 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <TiltCard maxTilt={4} className="h-full rounded-3xl">
              <div
                className={`glass relative h-full overflow-hidden rounded-3xl p-8 ${
                  p.accent === "violet" ? "hover:glow-violet" : "hover:glow"
                } transition-shadow duration-300`}
              >
                <span
                  aria-hidden
                  className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
                    p.accent === "violet" ? "bg-vayu-violet/15" : "bg-vayu-accent/15"
                  }`}
                />
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.25em] ${
                    p.accent === "violet" ? "text-vayu-violet" : "text-vayu-accent"
                  }`}
                >
                  {p.name}
                </p>
                <p className="mt-3 font-mono text-[13px] text-vayu-muted">{p.tech}</p>
                <p className="mt-4 leading-relaxed text-vayu-fg/90">{p.desc}</p>
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>
      {/* bridge beam */}
      <motion.div
        aria-hidden
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-6 h-[2px] w-2/3 origin-center rounded bg-[linear-gradient(90deg,transparent,var(--color-vayu-accent),var(--color-vayu-violet),transparent)]"
      />
      <p className="mt-3 text-center text-xs text-vayu-muted">
        Stateless JWT bridge — signed by the product plane, verified via JWKS by the intelligence plane.
      </p>
    </section>
  );
}

export function FinaleCTA() {
  return (
    <section className="relative mx-auto w-full max-w-4xl px-6 pb-36 pt-8 text-center">
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 w-64 rounded-full bg-vayu-accent/10 blur-3xl"
      />
      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="text-4xl font-bold tracking-tight sm:text-5xl"
      >
        Think it. <span className="text-gradient">Ship it.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.25, duration: 0.8 }}
        className="mx-auto mt-4 max-w-md text-vayu-muted"
      >
        Your editor, your research engine, and your agents — finally in the same place.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4, duration: 0.7 }}
        className="mt-9 flex justify-center"
      >
        <Magnetic>
          <GlowButton href="/signup">Create your workspace — free</GlowButton>
        </Magnetic>
      </motion.div>
    </section>
  );
}
