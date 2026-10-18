"use client";

import { useState, useRef } from "react";
import { PushToTalk } from "@/components/voice/PushToTalk";
import { VoiceVisualizer } from "@/components/voice/VoiceVisualizer";
import { GlowButton } from "@/components/landing/glow-button";

export default function VoicePage() {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleAudioData = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("action", "chat");

      const res = await fetch("/api/media/voice", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to process voice");

      setTranscript(data.transcript);

      if (data.audio_url && audioRef.current) {
        audioRef.current.src = data.audio_url;
        audioRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during voice processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#050505] text-white overflow-hidden px-6 py-10 flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-vayu-accent/10 via-[#050505] to-[#050505] opacity-60 pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4">NVIDIA Voice Assistant</h1>
          <p className="text-vayu-muted">
            Powered by NVIDIA Riva Speech-to-Text & Text-to-Speech models.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center p-12 w-full bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(var(--color-vayu-accent),0.1)]">
          <PushToTalk onAudioData={handleAudioData} />
          
          <div className="mt-8 w-full max-w-md h-12">
             <VoiceVisualizer isRecording={isProcessing} />
          </div>

          <audio ref={audioRef} className="hidden" />
        </div>

        {transcript && (
          <div className="w-full bg-vayu-surface/50 border border-vayu-border rounded-2xl p-6 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-sm font-semibold text-vayu-accent uppercase tracking-widest mb-3">Response</h3>
            <p className="text-lg leading-relaxed">{transcript}</p>
          </div>
        )}

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-center">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
