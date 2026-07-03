"use client";

import React, { useEffect } from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";

export function AnimatedCharacter() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for eye movement
  const springConfig = { damping: 25, stiffness: 120, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Map mouse position to pupil translation ranges
  const pupilX = useTransform(smoothX, [0, 1000], [-10, 10]);
  const pupilY = useTransform(smoothY, [0, 1000], [-10, 10]);

  // Map mouse position to subtle head rotation and skew
  const headRotateY = useTransform(smoothX, [0, 1000], [-15, 15]);
  const headRotateX = useTransform(smoothY, [0, 1000], [15, -15]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[400px]">
      {/* Ambient background glow */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-96 h-96 bg-vayu-accent rounded-full blur-[120px] pointer-events-none"
      />

      {/* Main Character SVG */}
      <motion.div
        style={{
          rotateX: headRotateX,
          rotateY: headRotateY,
          perspective: 1000,
        }}
        className="relative z-10 w-72 h-72 drop-shadow-2xl"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Head Base */}
          <motion.rect
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            x="20"
            y="30"
            width="160"
            height="140"
            rx="50"
            fill="url(#headGradient)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="2"
            className="drop-shadow-xl"
          />

          {/* Visor/Screen (Glassmorphic look) */}
          <motion.rect
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            x="35"
            y="65"
            width="130"
            height="60"
            rx="30"
            fill="#050505"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {/* Visor Glare/Reflection */}
          <motion.path
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            d="M45 70 Q 100 65 155 70 Q 150 90 45 90 Z"
            fill="url(#glareGradient)"
            opacity="0.5"
          />

          {/* Left Eye */}
          <motion.g animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            {/* Eye Track */}
            <rect x="55" y="80" width="30" height="30" rx="15" fill="#111" />
            <motion.circle
              style={{ x: pupilX, y: pupilY }}
              cx="70"
              cy="95"
              r="8"
              fill="var(--color-vayu-accent, #38BDF8)"
              className="drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]"
            />
            {/* Blinking Eyelid */}
            <motion.rect
              animate={{ height: [0, 32, 0] }}
              transition={{
                duration: 0.15,
                repeat: Infinity,
                repeatDelay: 3.5,
                ease: "linear",
              }}
              x="53"
              y="79"
              width="34"
              height="0"
              fill="#050505"
            />
          </motion.g>

          {/* Right Eye */}
          <motion.g animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <rect x="115" y="80" width="30" height="30" rx="15" fill="#111" />
            <motion.circle
              style={{ x: pupilX, y: pupilY }}
              cx="130"
              cy="95"
              r="8"
              fill="var(--color-vayu-accent, #38BDF8)"
              className="drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]"
            />
            {/* Blinking Eyelid */}
            <motion.rect
              animate={{ height: [0, 32, 0] }}
              transition={{
                duration: 0.15,
                repeat: Infinity,
                repeatDelay: 3.5,
                ease: "linear",
              }}
              x="113"
              y="79"
              width="34"
              height="0"
              fill="#050505"
            />
          </motion.g>

          {/* Floating Antenna Base */}
          <motion.rect
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            x="96"
            y="12"
            width="8"
            height="18"
            rx="4"
            fill="#334155"
          />
          {/* Floating Antenna Orb */}
          <motion.circle
            animate={{ y: [0, -15, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            cx="100"
            cy="4"
            r="8"
            fill="var(--color-vayu-accent, #38BDF8)"
            className="drop-shadow-[0_0_15px_rgba(56,189,248,1)]"
          />

          <defs>
            <linearGradient id="headGradient" x1="20" y1="30" x2="180" y2="170" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E293B" />
              <stop offset="1" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="glareGradient" x1="45" y1="70" x2="45" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity="0.1" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
}
