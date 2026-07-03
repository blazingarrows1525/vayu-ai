"use client";

import { VideoWorkspace } from "@/components/media/VideoWorkspace";

export default function MediaPage() {
  return (
    <main className="relative min-h-screen bg-[#050505] text-white overflow-hidden px-6 py-10 flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-[#050505] to-[#050505] opacity-60 pointer-events-none"></div>
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center gap-12">
        <VideoWorkspace />
      </div>
    </main>
  );
}
