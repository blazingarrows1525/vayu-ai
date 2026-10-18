"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Video, Loader2, PlayCircle, FileText } from "lucide-react";

export function VideoWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/media/video", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "Video processing failed");
      setSummary(data.summary);
    } catch (error) {
      console.error(error);
      const reason = error instanceof Error ? error.message : "Video processing failed";
      setSummary(`Error processing video: ${reason}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full max-w-4xl mx-auto space-y-8 bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
      <div className="flex flex-col items-center space-y-4">
        <Video className="w-16 h-16 text-blue-400" />
        <h2 className="text-3xl font-bold text-white tracking-tight">Video Intelligence</h2>
        <p className="text-white/50 text-center max-w-md">
          Upload a video to automatically extract audio, generate a transcript, and summarize key moments using NVIDIA LLaMA 3.2 Vision.
        </p>
      </div>

      {!summary && (
        <div className="w-full flex flex-col items-center p-8 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
            id="video-upload"
          />
          <label
            htmlFor="video-upload"
            className="cursor-pointer flex flex-col items-center space-y-2 text-white/70 hover:text-white transition-colors"
          >
            <Upload className="w-10 h-10 mb-2" />
            <span className="font-medium text-lg">
              {file ? file.name : "Click to select a video file"}
            </span>
            <span className="text-sm text-white/40">MP4, MOV, WEBM up to 25MB</span>
          </label>
        </div>
      )}

      {file && !summary && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUpload}
          disabled={isProcessing}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg shadow-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Analyzing Video with NVIDIA NIM...</span>
            </>
          ) : (
            <>
              <PlayCircle className="w-6 h-6" />
              <span>Process Video</span>
            </>
          )}
        </motion.button>
      )}

      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white/5 rounded-2xl p-6 border border-white/10"
        >
          <div className="flex items-center space-x-3 mb-4 border-b border-white/10 pb-4">
            <FileText className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">Video Summary</h3>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
          <button 
            onClick={() => { setSummary(null); setFile(null); }}
            className="mt-6 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Upload another video
          </button>
        </motion.div>
      )}
    </div>
  );
}
