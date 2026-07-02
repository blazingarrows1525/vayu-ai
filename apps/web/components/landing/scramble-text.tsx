"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#";

/** Decodes text with a scramble effect when it first scrolls into view. */
export function ScrambleText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!inView || reduced) return;
    let frame = 0;
    const total = Math.max(14, text.length * 1.6);
    const id = setInterval(() => {
      frame++;
      const progress = frame / total;
      const settled = Math.floor(progress * text.length);
      setDisplay(
        text
          .split("")
          .map((ch, i) => {
            if (ch === " " || i < settled) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join(""),
      );
      if (frame >= total) {
        setDisplay(text);
        clearInterval(id);
      }
    }, 28);
    return () => clearInterval(id);
  }, [inView, reduced, text]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{display}</span>
    </span>
  );
}
