"use client";

import { useMemo } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.15 } },
};

const word: Variants = {
  hidden: { y: "110%", rotateX: -38, opacity: 0, filter: "blur(6px)" },
  show: {
    y: "0%",
    rotateX: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Per-word cinematic reveal. Screen readers get the intact sentence (sr-only);
 * the animated copy is aria-hidden so the split spans never garble the
 * accessible name. Reduced motion renders plain text.
 */
export function SplitText({ text, className = "" }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(" "), [text]);

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden
        variants={container}
        initial="hidden"
        animate="show"
        className={`inline-block ${className}`}
        style={{ perspective: 700 }}
      >
        {words.map((w, i) => (
          <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-top">
            <motion.span variants={word} className="inline-block will-transform">
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </>
  );
}
