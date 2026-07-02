"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { site } from "@/lib/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlowButton } from "./glow-button";
import { LiveWidgets } from "./live-widgets";
import { Magnetic } from "./magnetic";
import { SplitText } from "./split-text";

/** three.js stays out of the initial bundle; the fallback orb reserves the
 *  exact box so the scene swap causes zero layout shift. */
const HeroScene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <FallbackOrb />,
});

function FallbackOrb() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <div className="animate-pulse-glow h-1/2 w-1/2 rounded-full bg-gradient-to-br from-vayu-accent/25 to-vayu-violet/25 blur-sm" />
    </div>
  );
}

/** Soft light that trails the cursor across the whole hero. The pointer is
 *  tracked on the <section> (see Hero) so the glow never stalls over content. */
function useCursorLight() {
  const reduced = useReducedMotion();
  const x = useSpring(-600, { stiffness: 60, damping: 18, mass: 0.6 });
  const y = useSpring(-600, { stiffness: 60, damping: 18, mass: 0.6 });

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };

  const light = reduced ? null : (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full will-transform"
        style={{
          x,
          y,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-vayu-accent) 13%, transparent), transparent 65%)",
        }}
      />
    </div>
  );

  return { light, onPointerMove };
}

function ScrollHint() {
  return (
    <a
      href="#capabilities"
      aria-label="Scroll to capabilities"
      className="group absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
    >
      <span className="text-[10px] uppercase tracking-[0.3em] text-vayu-muted transition-colors group-hover:text-vayu-accent">
        scroll
      </span>
      <span className="glass flex h-9 w-5 items-start justify-center rounded-full p-1">
        <span className="animate-scroll-hint h-2 w-1 rounded-full bg-vayu-accent" />
      </span>
    </a>
  );
}

export function Hero() {
  const { light, onPointerMove } = useCursorLight();

  return (
    <section
      onPointerMove={onPointerMove}
      className="relative flex min-h-[100svh] flex-col px-6 pt-8"
    >
      {light}

      {/* top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <RadarMark />
        <span className="text-lg font-semibold tracking-tight">{site.name}</span>
        <span className="glass ml-auto hidden rounded-full px-3 py-1 text-xs text-vayu-muted sm:block">
          v1.0 · two-plane · 14 modules
        </span>
        <ThemeToggle className="ml-2" />
        <a
          href="/login"
          className="glass ml-1 rounded-full px-4 py-1.5 text-xs font-semibold text-vayu-fg transition-colors hover:text-vayu-accent"
        >
          Sign in
        </a>
      </header>

      {/* main grid */}
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-6">
        {/* copy */}
        <div style={{ perspective: 900 }}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-sm font-medium uppercase tracking-[0.22em] text-vayu-accent"
          >
            Strategic Advantage · Absolute Clarity
          </motion.p>

          <h1 className="mt-5 text-5xl font-bold leading-[1.06] tracking-tight sm:text-6xl xl:text-7xl">
            <SplitText text={site.tagline} className="text-gradient" />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-vayu-muted"
          >
            {site.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.8, ease: "easeOut" }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Magnetic>
              <GlowButton href="/editor">
                Open the workspace
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </GlowButton>
            </Magnetic>
            <Magnetic strength={0.25}>
              <GlowButton href="/research" variant="ghost">
                Explore research
              </GlowButton>
            </Magnetic>
          </motion.div>

          {/* live proof strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-vayu-muted"
          >
            <span className="flex items-center gap-1.5">
              <span className="animate-blink-soft h-1.5 w-1.5 rounded-full bg-vayu-success" />
              5 LLM providers · automatic failover
            </span>
            <span>PDF · DOCX · PPTX · XLSX · URL ingestion</span>
          </motion.div>
        </div>

        {/* 3D core + HUD */}
        <div className="relative mx-auto aspect-square w-full max-w-md lg:max-w-lg">
          <HeroScene />
          <LiveWidgets />
        </div>
      </div>

      <ScrollHint />
    </section>
  );
}

export function RadarMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12" stroke="var(--color-vayu-accent)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="14" cy="14" r="7" stroke="var(--color-vayu-accent)" strokeWidth="1.5" opacity="0.7" />
      <circle cx="14" cy="14" r="2" fill="var(--color-vayu-accent)" />
      <path d="M14 14 L24 8" stroke="var(--color-vayu-accent-2)" strokeWidth="1.5" />
    </svg>
  );
}
