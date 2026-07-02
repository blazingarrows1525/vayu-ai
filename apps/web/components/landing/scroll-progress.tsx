"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Thin page-progress beam pinned to the top edge. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[linear-gradient(90deg,var(--color-vayu-accent),var(--color-vayu-violet),var(--color-vayu-accent-2))]"
    />
  );
}
