"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Ripple = { id: number; x: number; y: number };

/**
 * Physical-feeling CTA: animated gradient, glow lift on hover, spring press,
 * click ripple, ambient pulse when idle. Renders an <a> — these are nav CTAs.
 */
export function GlowButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ripple = { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top };
    setRipples((r) => [...r, ripple]);
    setTimeout(() => setRipples((r) => r.filter((p) => p.id !== ripple.id)), 650);
  }

  const base =
    "relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold outline-offset-4 transition-shadow duration-300";
  const skin =
    variant === "primary"
      ? "animate-gradient-x bg-[linear-gradient(110deg,var(--color-vayu-accent),var(--color-vayu-violet),var(--color-vayu-accent-2))] text-vayu-bg animate-pulse-glow"
      : "glass text-vayu-fg hover:glow-soft";

  return (
    <motion.a
      href={href}
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.045, y: -2, rotate: -0.4 }}
      whileTap={reduced ? undefined : { scale: 0.96, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className={`${base} ${skin} ${className}`}
    >
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35"
          style={{ left: r.x, top: r.y, animation: "ripple 0.65s ease-out forwards" }}
        />
      ))}
    </motion.a>
  );
}
