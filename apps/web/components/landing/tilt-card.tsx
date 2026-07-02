"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
} from "framer-motion";

/**
 * 3D pointer-tilt card with a cursor-tracking sheen. Mouse only; reduced
 * motion and touch get a plain (still hoverable) card.
 */
export function TiltCard({
  children,
  className = "",
  maxTilt = 7,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const rx = useSpring(0, { stiffness: 220, damping: 18 });
  const ry = useSpring(0, { stiffness: 220, damping: 18 });
  const sx = useSpring(50, { stiffness: 160, damping: 20 });
  const sy = useSpring(50, { stiffness: 160, damping: 20 });
  const sheen = useMotionTemplate`radial-gradient(400px circle at ${sx}% ${sy}%, color-mix(in oklab, var(--color-vayu-accent) 25%, transparent), transparent 75%)`;
  const glare = useMotionTemplate`radial-gradient(300px circle at ${sx}% ${sy}%, rgba(255,255,255,0.06), transparent 50%)`;

  function onMove(e: React.PointerEvent) {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * 2 * maxTilt);
    rx.set(-(py - 0.5) * 2 * maxTilt);
    sx.set(px * 100);
    sy.set(py * 100);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
    sx.set(50);
    sy.set(50);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", perspective: 800 }}
      className={`relative will-transform ${className}`}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: sheen }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
        style={{ background: glare }}
      />
      {children}
    </motion.div>
  );
}
