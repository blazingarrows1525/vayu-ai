"use client";

import { motion } from "framer-motion";

export function VoiceVisualizer({ isRecording }: { isRecording: boolean }) {
  // Generate random heights for a cool waveform effect
  const bars = Array.from({ length: 24 }).map((_, i) => i);

  return (
    <div className="flex items-end justify-center space-x-1 h-16 w-full max-w-sm mx-auto overflow-hidden">
      {bars.map((i) => (
        <motion.div
          key={i}
          initial={{ height: 4 }}
          animate={{
            height: isRecording
              ? [4, Math.random() * 40 + 20, 4]
              : 4,
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "mirror",
            delay: i * 0.05,
          }}
          className={`w-2 rounded-t-full ${
            isRecording ? "bg-red-500" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}
