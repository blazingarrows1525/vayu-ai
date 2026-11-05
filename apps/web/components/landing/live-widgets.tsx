"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bot, FileText, Mic, Quote } from "lucide-react";
import type { ReactNode } from "react";
import { AGENT_KINDS, LLM_PROVIDERS } from "@/lib/product";

/**
 * Capability cards floating around the 3D core. They describe what the product does; none of
 * them pretends to be a live metric. Each drifts on its own phase (off under reduced motion).
 */
function FloatCard({
  children,
  className = "",
  delay = 0,
  duration = 6,
}: {
  children: ReactNode;
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
        animate={reduced ? undefined : { y: [0, -8, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        className="glass shadow-ambient rounded-2xl px-4 py-3 will-transform"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Card({ icon, title, detail, tone = "accent" }: { icon: ReactNode; title: string; detail: string; tone?: "accent" | "violet" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-7 w-7 place-items-center rounded-lg ${tone === "violet" ? "bg-vayu-violet/15 text-vayu-violet" : "bg-vayu-accent/15 text-vayu-accent"} [&>svg]:h-3.5 [&>svg]:w-3.5`}
      >
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-semibold text-vayu-fg">{title}</p>
        <p className="text-[10px] text-vayu-muted">{detail}</p>
      </div>
    </div>
  );
}

export function LiveWidgets() {
  return (
    // Desktop-only: on small screens these cards would crowd the core.
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none md:block">
      <FloatCard className="left-[-8%] top-[8%]" delay={0.15} duration={6.5}>
        <Card icon={<FileText />} title="Copilot in every document" detail={`${LLM_PROVIDERS.length} model providers, with failover`} />
      </FloatCard>
      <FloatCard className="right-[-6%] top-[4%]" delay={0.45} duration={7.2}>
        <Card icon={<Quote />} title="Answers cite their sources" detail="hybrid keyword + vector retrieval" tone="violet" />
      </FloatCard>
      <FloatCard className="bottom-[16%] right-[-9%]" delay={0.8} duration={5.8}>
        <Card icon={<Bot />} title={`${AGENT_KINDS.length} agents`} detail="research, writing, SEO and more" />
      </FloatCard>
      <FloatCard className="bottom-[6%] left-[-4%]" delay={1.1} duration={6.9}>
        <Card icon={<Mic />} title="Talk to it" detail="real-time voice and text" tone="violet" />
      </FloatCard>
    </div>
  );
}
