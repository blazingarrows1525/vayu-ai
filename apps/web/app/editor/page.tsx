"use client";

import { useState } from "react";
import Link from "next/link";
import { type Editor, VayuEditor } from "@vayu/editor";
import { CopilotPanel } from "@/components/copilot-panel";
import { TiltCard } from "@/components/landing/tilt-card";
import { GlowButton } from "@/components/landing/glow-button";
import { Magnetic } from "@/components/landing/magnetic";
import { motion, useReducedMotion } from "framer-motion";

const INITIAL = `
<h1>VAYU Editor</h1>
<p>An AI-native block editor. Press <code>/</code> anywhere for the command menu — headings, lists, tables, code, math, callouts, and Mermaid diagrams.</p>
<div data-type="callout" data-variant="success"><p>Tip: type <code>/diagram</code> for a Mermaid flowchart, or <code>/math</code> for a LaTeX block.</p></div>
<blockquote><p>Intelligence at the speed of thought.</p></blockquote>
<pre><code class="language-typescript">export const vayu = { plane: "product", ready: true };</code></pre>
`;

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
      className={`absolute z-20 ${className}`}
    >
      <motion.div
        animate={reduced ? undefined : { y: [0, -9, 0], rotate: [0, -0.8, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        whileHover={reduced ? undefined : { scale: 1.06, rotate: 0 }}
        className="glass shadow-ambient rounded-2xl px-4 py-3 will-transform backdrop-blur-md bg-black/40 border border-white/10"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function EditorDemoPage() {
  const [blocks, setBlocks] = useState<number | null>(null);
  const [editedAt, setEditedAt] = useState<string>("");
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <main className="relative min-h-screen bg-[#050505] text-white selection:bg-vayu-accent selection:text-black overflow-hidden px-6 py-10">
      {/* Background Decorative Mesh/Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-vayu-accent/10 via-[#050505] to-[#050505] opacity-60"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>

      {/* Floating HUD Elements */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none lg:block [&>*]:pointer-events-auto">
        <FloatCard className="left-[5%] top-[15%]" delay={0.2} duration={7}>
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vayu-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vayu-success" />
            </span>
            <div>
              <p className="text-[11px] font-semibold text-vayu-fg">Engine Sync</p>
              <p className="text-[10px] text-vayu-muted">Real-time collaboration active</p>
            </div>
          </div>
        </FloatCard>
        
        <FloatCard className="right-[5%] top-[40%]" delay={0.5} duration={6}>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-wider text-vayu-muted">Context Window</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-vayu-accent">
              {blocks ? (blocks * 14) : 0}<span className="text-[10px] text-vayu-muted ml-1">tokens</span>
            </p>
          </div>
        </FloatCard>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
              Workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Editor</h1>
          </div>
          <Magnetic strength={0.2}>
            <div className="inline-block">
              <GlowButton href="/" variant="ghost" className="px-4 py-2">
                ← Return Home
              </GlowButton>
            </div>
          </Magnetic>
        </header>

        {/* 3D Container for the Editor */}
        <TiltCard maxTilt={3} className="rounded-3xl shadow-2xl">
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(var(--color-vayu-accent),0.15)]">
            <VayuEditor
              content={INITIAL}
              autofocus
              onCreate={setEditor}
              onUpdate={(json) => {
                setBlocks(Array.isArray(json.content) ? json.content.length : 0);
                setEditedAt(new Date().toLocaleTimeString());
              }}
            />
          </div>
        </TiltCard>

        <div className="mt-8">
          <TiltCard maxTilt={2} className="rounded-2xl">
            <div className="rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md p-4">
              <CopilotPanel editor={editor} />
            </div>
          </TiltCard>
        </div>

        <div className="mt-6 flex justify-between items-center px-4">
          <p className="text-xs text-vayu-muted font-mono tracking-wider">
            {blocks === null
              ? "Awaiting input..."
              : `SYS.BLOCKS[${blocks}]`}
          </p>
          <p className="text-xs text-vayu-muted font-mono tracking-wider">
            {editedAt && `LAST_SYNC_${editedAt.replace(/:/g, '')}`}
          </p>
        </div>
      </div>
    </main>
  );
}
