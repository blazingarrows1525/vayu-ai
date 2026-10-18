"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mic capture + reply playback for VAYU Live, both routed through Web Audio
 * analysers. The shared `meter` is read every frame by the 3D orb (no React
 * re-renders): whichever analyser is live — mic while listening, playback while
 * speaking — drives it; `pulse` is a decaying kick for streamed text tokens.
 */

export type AudioMeter = { analyser: AnalyserNode | null; pulse: number };

const MAX_RECORDING_MS = 60_000;
const RECORDER_MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDER_MIMES.find((m) => MediaRecorder.isTypeSupported(m));
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function useLiveAudio() {
  const meter = useRef<AudioMeter>({ analyser: null, pulse: 0 });
  const ctxRef = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const playing = useRef<AudioBufferSourceNode | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  /** Must run inside a user gesture the first time (autoplay policy). */
  const ensureContext = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const analyserFor = (ctx: AudioContext) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    return analyser;
  };

  const stopPlayback = useCallback(() => {
    const src = playing.current;
    playing.current = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    if (meter.current.analyser && !recorder.current) meter.current.analyser = null;
    setSpeaking(false);
  }, []);

  const play = useCallback(
    async (base64Wav: string) => {
      const ctx = ensureContext();
      stopPlayback();
      let buffer: AudioBuffer;
      try {
        buffer = await ctx.decodeAudioData(base64ToBytes(base64Wav).buffer);
      } catch {
        return; // undecodable audio — the text reply is already on screen
      }
      if (recorder.current) return; // user started talking while we decoded (barge-in)
      const src = ctx.createBufferSource();
      const analyser = analyserFor(ctx);
      src.buffer = buffer;
      src.connect(analyser).connect(ctx.destination);
      src.onended = () => {
        if (playing.current === src) {
          playing.current = null;
          meter.current.analyser = null;
          setSpeaking(false);
        }
      };
      playing.current = src;
      meter.current.analyser = analyser;
      setSpeaking(true);
      src.start();
    },
    [ensureContext, stopPlayback],
  );

  /** Starts capturing; resolves once the mic is live. Throws a readable Error. */
  const startRecording = useCallback(
    async (onAutoStop: () => void) => {
      if (recorder.current) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser can't access a microphone here (HTTPS is required).");
      }
      const ctx = ensureContext();
      stopPlayback(); // barge-in: talking over VAYU stops its reply
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err) {
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        throw new Error(
          denied
            ? "Microphone permission was denied — allow it in the address bar to talk."
            : "Couldn't open the microphone.",
        );
      }
      const mime = pickMime();
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      const analyser = analyserFor(ctx);
      ctx.createMediaStreamSource(media).connect(analyser); // meter only — never to speakers
      meter.current.analyser = analyser;
      stream.current = media;
      recorder.current = rec;
      rec.start();
      setRecording(true);
      autoStop.current = setTimeout(onAutoStop, MAX_RECORDING_MS);
    },
    [ensureContext, stopPlayback],
  );

  /** Stops capturing; resolves with base64 audio + its MIME type, or null if empty. */
  const stopRecording = useCallback(async (): Promise<{ data: string; mime: string } | null> => {
    const rec = recorder.current;
    if (!rec) return null;
    clearTimeout(autoStop.current);
    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    rec.stop();
    await stopped;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    meter.current.analyser = null;
    setRecording(false);
    const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
    chunks.current = [];
    if (blob.size < 1200) return null; // a tap, not speech
    return { data: await blobToBase64(blob), mime: blob.type };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(autoStop.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close();
    },
    [],
  );

  return {
    meter,
    recording,
    speaking,
    ensureContext,
    play,
    stopPlayback,
    startRecording,
    stopRecording,
  };
}
