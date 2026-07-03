"use client";

import { motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useState, useRef } from "react";

interface PushToTalkProps {
  onAudioData: (blob: Blob) => Promise<void>;
}

export function PushToTalk({ onAudioData }: PushToTalkProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        await onAudioData(audioBlob);
        setIsProcessing(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        disabled={isProcessing}
        className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-2xl transition-colors duration-300 ${
          isRecording ? "bg-red-500/20 text-red-500" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
        }`}
      >
        {isProcessing ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : isRecording ? (
          <Mic className="h-10 w-10 animate-pulse" />
        ) : (
          <MicOff className="h-10 w-10" />
        )}
        
        {/* Animated Ripple Effect when recording */}
        {isRecording && (
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-red-500"
          />
        )}
      </motion.button>
      <p className="text-sm text-white/50">
        {isProcessing ? "Processing audio..." : isRecording ? "Listening..." : "Hold to speak"}
      </p>
    </div>
  );
}
