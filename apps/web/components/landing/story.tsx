"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * "How VAYU thinks" — a pinned, scroll-scrubbed story. The section is 320vh
 * tall; a CSS-sticky viewport stays put while a GSAP timeline (scrub) morphs
 * three scenes. CSS sticky (not ScrollTrigger pin) keeps Lenis + resize math
 * trivial. Reduced motion renders the scenes stacked statically.
 */

const SCENES = [
  {
    n: "01",
    title: "Draft at the speed of thought",
    copy: "The copilot streams straight into your document — rewrite, expand, change tone. Same keystroke, any of five LLM providers underneath.",
    accent: "var(--color-vayu-accent)",
  },
  {
    n: "02",
    title: "Ask with receipts",
    copy: "Upload PDFs, decks, sheets, or URLs. Hybrid retrieval finds the truth and every answer arrives with citations and a confidence score.",
    accent: "var(--color-vayu-violet)",
  },
  {
    n: "03",
    title: "Ship with agents",
    copy: "LangGraph agents plan, research, and synthesize in checkpointed steps you can watch live — then hand you the deliverable.",
    accent: "var(--color-vayu-accent-2)",
  },
] as const;

function SceneVisual({ index }: { index: number }) {
  if (index === 0) {
    // streaming tokens mock
    return (
      <div className="flex h-full flex-col justify-center gap-3 p-8">
        {[92, 74, 86, 58].map((w, i) => (
          <div key={i} className="h-2.5 overflow-hidden rounded bg-vayu-border">
            <div
              className="h-full rounded bg-[linear-gradient(90deg,var(--color-vayu-accent),var(--color-vayu-accent-2))]"
              style={{ width: `${w}%` }}
              data-stream-bar
            />
          </div>
        ))}
        <p className="mt-2 font-mono text-[11px] text-vayu-muted">
          /continue · claude-sonnet-4-6 · streaming
        </p>
      </div>
    );
  }
  if (index === 1) {
    // citations mock
    return (
      <div className="flex h-full flex-col justify-center gap-3 p-8">
        <div className="flex flex-wrap gap-2">
          {["quarterly.pdf", "roadmap.pptx", "metrics.xlsx"].map((s) => (
            <span key={s} className="glass rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-vayu-fg" data-cite-chip>
              [{s}]
            </span>
          ))}
        </div>
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-vayu-muted">confidence</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-vayu-border">
            <div className="h-full w-[92%] rounded-full bg-vayu-violet" data-confidence-bar />
          </div>
        </div>
      </div>
    );
  }
  // agent steps mock
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 p-8">
      {["plan", "research", "synthesize"].map((node) => (
        <div key={node} className="glass flex items-center gap-3 rounded-xl px-4 py-3" data-agent-node>
          <span className="h-2 w-2 rounded-full bg-vayu-accent-2" />
          <span className="font-mono text-xs text-vayu-fg">{node}</span>
          <span className="ml-auto text-[10px] text-vayu-muted">✓ checkpointed</span>
        </div>
      ))}
    </div>
  );
}

function StaticStory() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-28">
      {SCENES.map((s, i) => (
        <div key={s.n} className="mb-10 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="font-mono text-sm" style={{ color: s.accent }}>{s.n}</p>
            <h3 className="mt-2 text-2xl font-bold">{s.title}</h3>
            <p className="mt-3 text-vayu-muted">{s.copy}</p>
          </div>
          <div className="glass min-h-44 rounded-3xl">
            <SceneVisual index={i} />
          </div>
        </div>
      ))}
    </section>
  );
}

export function Story() {
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !wrap.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled || !wrap.current) return;
      gsap.registerPlugin(ScrollTrigger);

      const q = gsap.utils.selector(wrap.current);
      const scenes = q<HTMLElement>("[data-scene]");
      const dots = q<HTMLElement>("[data-dot]");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.45,
        },
        defaults: { ease: "none" },
      });

      scenes.forEach((scene, i) => {
        const at = i * 2; // each scene owns a 2-unit slot: enter, hold, exit
        if (i > 0) {
          tl.fromTo(
            scene,
            { autoAlpha: 0, y: 60, scale: 0.96, filter: "blur(8px)" },
            { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.7 },
            at,
          );
        } else {
          tl.set(scene, { autoAlpha: 1 }, 0);
        }
        if (i < scenes.length - 1) {
          tl.to(
            scene,
            { autoAlpha: 0, y: -60, scale: 0.96, filter: "blur(8px)", duration: 0.7 },
            at + 1.3,
          );
        }
        const accent = SCENES[i]?.accent ?? "var(--color-vayu-accent)";
        const dot = dots[i];
        const prevDot = i > 0 ? dots[i - 1] : undefined;
        if (dot) tl.to(dot, { backgroundColor: accent, scale: 1.5, duration: 0.2 }, at);
        if (prevDot) tl.to(prevDot, { backgroundColor: "var(--color-vayu-border)", scale: 1, duration: 0.2 }, at);
      });

      // per-scene flourishes
      tl.fromTo(q("[data-stream-bar]"), { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.8, stagger: 0.08 }, 0.1);
      tl.fromTo(q("[data-cite-chip]"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3, stagger: 0.1 }, 2.15);
      tl.fromTo(q("[data-confidence-bar]"), { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.6 }, 2.5);
      tl.fromTo(q("[data-agent-node]"), { x: -18, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.3, stagger: 0.14 }, 4.15);

      cleanup = () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reduced]);

  if (reduced) return <StaticStory />;

  return (
    <div ref={wrap} className="relative h-[320vh]" data-story-pin>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-2">
          {/* copy stack — scenes are absolutely layered */}
          <div className="relative min-h-[300px]">
            {SCENES.map((s, i) => (
              <div key={s.n} data-scene className="absolute inset-0 opacity-0">
                <p className="font-mono text-sm" style={{ color: s.accent }}>{s.n}</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{s.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-vayu-muted">{s.copy}</p>
                <div className="glass mt-8 h-52 rounded-3xl shadow-ambient lg:hidden">
                  <SceneVisual index={i} />
                </div>
              </div>
            ))}
          </div>
          {/* visual stack (desktop) */}
          <div className="relative hidden min-h-[340px] lg:block">
            {SCENES.map((s, i) => (
              <div key={s.n} data-scene className="glass absolute inset-0 rounded-3xl opacity-0 shadow-lift">
                <SceneVisual index={i} />
              </div>
            ))}
          </div>
        </div>
        {/* progress dots */}
        <div className="absolute left-1/2 top-8 flex -translate-x-1/2 gap-2.5" aria-hidden>
          {SCENES.map((s) => (
            <span key={s.n} data-dot className="h-2 w-2 rounded-full bg-vayu-border transition-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
