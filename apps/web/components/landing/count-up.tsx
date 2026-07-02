"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/** Counts from 0 to `to` when scrolled into view. Reduced motion renders the final value. */
export function CountUp({
  to,
  duration = 1.6,
  suffix = "",
  decimals = 0,
  className = "",
}: {
  to: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || !inView) {
      if (reduced) el.textContent = to.toFixed(decimals) + suffix;
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = v.toFixed(decimals) + suffix;
      },
    });
    return () => controls.stop();
  }, [inView, reduced, to, duration, suffix, decimals]);

  return (
    <span ref={ref} className={className}>
      {reduced ? to.toFixed(decimals) + suffix : `0${suffix}`}
    </span>
  );
}
