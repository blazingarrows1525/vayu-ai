"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "./count-up";

/**
 * Floating "live" HUD cards layered over the 3D core — an agent status board,
 * a token throughput metric, and an AI-thinking indicator. Each floats on its
 * own phase so the cluster never moves in lockstep.
 */

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
      className={`absolute ${className}`}
    >
      <motion.div
        animate={reduced ? undefined : { y: [0, -9, 0], rotate: [0, -0.8, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        whileHover={reduced ? undefined : { scale: 1.06, rotate: 0 }}
        className="glass shadow-ambient rounded-2xl px-4 py-3 will-transform"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Dot({ tone = "success" }: { tone?: "success" | "accent" }) {
  const color = tone === "success" ? "bg-vayu-success" : "bg-vayu-accent";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export function LiveWidgets() {
  const reduced = useReducedMotion();
  return (
    // Desktop-only flourish: on small screens these cards collide with the dock.
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none md:block [&>*]:pointer-events-auto">
      {/* agents online */}
      <FloatCard className="left-[-8%] top-[8%]" delay={0.15} duration={6.5}>
        <div className="flex items-center gap-2.5">
          <Dot />
          <div>
            <p className="text-[11px] font-semibold text-vayu-fg">7 agents online</p>
            <p className="text-[10px] text-vayu-muted">research · seo · docs</p>
          </div>
        </div>
      </FloatCard>

      {/* token throughput */}
      <FloatCard className="right-[-6%] top-[2%]" delay={0.45} duration={7.2}>
        <p className="text-[10px] uppercase tracking-wider text-vayu-muted">tokens streamed</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums text-vayu-accent">
          <CountUp to={2.4} decimals={1} suffix="M" duration={2.2} />
        </p>
        {/* mini sparkline that draws itself in */}
        <svg width="86" height="20" viewBox="0 0 86 20" fill="none" className="mt-1">
          <motion.path
            d="M1 16 L13 12 L25 14 L37 8 L49 10 L61 5 L73 7 L85 2"
            stroke="var(--color-vayu-accent-2)"
            strokeWidth="1.6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.8, delay: 1.1, ease: "easeOut" }}
          />
        </svg>
      </FloatCard>

      {/* grounded citations */}
      <FloatCard className="bottom-[16%] right-[-9%]" delay={0.8} duration={5.8}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-vayu-violet/15 text-vayu-violet">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-5" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] font-semibold text-vayu-fg">Every answer cited</p>
            <p className="text-[10px] text-vayu-muted">RAG · hybrid retrieval</p>
          </div>
        </div>
      </FloatCard>

      {/* AI thinking */}
      <FloatCard className="bottom-[6%] left-[-4%]" delay={1.1} duration={6.9}>
        <div className="flex items-center gap-2">
          <Dot tone="accent" />
          <p className="text-[11px] font-medium text-vayu-fg">AI drafting</p>
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1 w-1 rounded-full bg-vayu-accent"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.15, repeat: Infinity, delay: i * 0.22 }}
              />
            ))}
          </span>
        </div>
      </FloatCard>

      {/* vector search pipeline */}
      <FloatCard className="top-[45%] left-[-12%]" delay={0.65} duration={7.5}>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wider text-vayu-muted">Vector Search</p>
          <div className="flex items-center gap-1.5 opacity-80" aria-hidden>
            <div className="grid gap-0.5">
              <span className="h-0.5 w-3 rounded-full bg-vayu-fg/40" />
              <span className="h-0.5 w-2 rounded-full bg-vayu-fg/40" />
              <span className="h-0.5 w-2.5 rounded-full bg-vayu-fg/40" />
            </div>
            <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-vayu-accent"
              animate={reduced ? undefined : { x: [0, 2, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </motion.svg>
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1 w-1 rounded-full bg-vayu-violet"
                  animate={reduced ? undefined : { y: [0, -2, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        </div>
      </FloatCard>
    </div>
  );
}
