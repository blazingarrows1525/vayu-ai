"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useState } from "react";
import { LLM_PROVIDERS, RESEARCH_FILE_TYPES } from "@/lib/product";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { site } from "@/lib/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/shell/brand-mark";
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

/** Falls back to the static core if three.js throws (no WebGL, a driver bug). */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Phones, Data Saver and browsers without WebGL get the static core (and never download three.js). */
function canRender3D(): boolean {
  if (window.matchMedia("(max-width: 767px)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // release the probe context
    return Boolean(gl);
  } catch {
    return false;
  }
}

function HeroCore() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(canRender3D()), []);
  if (!enabled) return <FallbackOrb />;
  return (
    <SceneBoundary fallback={<FallbackOrb />}>
      <HeroScene onContextLost={() => setEnabled(false)} />
    </SceneBoundary>
  );
}

/** The static core: what phones, Data Saver, no-WebGL browsers and a failed scene show (and the
 *  placeholder while the 3D chunk loads). Same orb-and-ring as the brand mark. */
function FallbackOrb() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <div className="relative aspect-square w-[52%]">
        <div className="absolute -inset-[30%] rounded-full border border-vayu-accent/15" />
        <div className="absolute -inset-[14%] rounded-full border border-vayu-accent/35" />
        <div className="animate-pulse-glow h-full w-full rounded-full bg-[radial-gradient(circle_at_36%_32%,#7dd3fc,#8b5cf6_55%,#3b0764)]" />
      </div>
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
        <BrandMark className="h-8 w-8 text-vayu-accent" />
        <span className="text-lg font-semibold tracking-tight">{site.name}</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
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
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-sm font-medium uppercase tracking-[0.22em] text-vayu-accent"
          >
            An AI-native workspace
          </motion.p>

          <h1 className="mt-5 text-5xl font-bold leading-[1.06] tracking-tight sm:text-6xl xl:text-7xl">
            <SplitText text={site.tagline} className="text-gradient" />
          </h1>

          <motion.p
            initial={{ y: 14 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-vayu-muted"
          >
            {site.description}
          </motion.p>

          <motion.div
            initial={{ y: 16 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.85, duration: 0.8, ease: "easeOut" }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Magnetic>
              <GlowButton href="/dashboard">
                Open your workspace
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </GlowButton>
            </Magnetic>
            <Magnetic strength={0.25}>
              <GlowButton href="#capabilities" variant="ghost">
                See what it does
              </GlowButton>
            </Magnetic>
          </motion.div>

          {/* live proof strip */}
          <motion.div
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-vayu-muted"
          >
            <span>{LLM_PROVIDERS.length} model providers · automatic failover</span>
            <span>{RESEARCH_FILE_TYPES.map((t) => t.label).join(" · ")} · web pages</span>
          </motion.div>
        </div>

        {/* 3D core + HUD */}
        <div className="relative mx-auto aspect-square w-full max-w-md lg:max-w-lg">
          <HeroCore />
          <LiveWidgets />
        </div>
      </div>

      <ScrollHint />
    </section>
  );
}
