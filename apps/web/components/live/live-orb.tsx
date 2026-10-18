"use client";

/**
 * VAYU Live's 3D presence — an audio-reactive "voice core".
 *
 * A distorted sphere (the model) inside a ring of 64 spectrum bars (its voice),
 * wrapped in two gyroscope rings (attention). Everything reads the shared audio
 * meter inside useFrame, so audio never re-renders React: the mic drives it while
 * listening, the reply's playback while speaking, and token pulses while text
 * streams. Mode sets the palette and tempo; colors ease rather than snap.
 *
 * Loaded via next/dynamic (ssr:false) so three.js stays out of the initial bundle.
 */

import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, PerformanceMonitor, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import type { AudioMeter } from "@/lib/live/use-live-audio";

export type OrbMode = "idle" | "listening" | "thinking" | "speaking" | "offline";

const PALETTE: Record<OrbMode, { core: string; glow: string; bars: string }> = {
  idle: { core: "#8b5cf6", glow: "#38bdf8", bars: "#38bdf8" },
  listening: { core: "#ec4899", glow: "#fb7185", bars: "#f472b6" },
  thinking: { core: "#6d28d9", glow: "#a78bfa", bars: "#8b5cf6" },
  speaking: { core: "#0284c7", glow: "#22d3ee", bars: "#22d3ee" },
  offline: { core: "#334155", glow: "#64748b", bars: "#475569" },
};
const TEMPO: Record<OrbMode, number> = {
  idle: 0.18,
  listening: 0.4,
  thinking: 1.25,
  speaking: 0.55,
  offline: 0.04,
};

const BARS = 64;
const HALF = BARS / 2;
const RING_RADIUS = 1.62;
// Bar k of each mirrored half → an analyser bin, log-ish so the speech band
// (≈100 Hz–4 kHz, the low bins of a 256-point FFT) spreads around the ring.
const BIN_FOR = Array.from({ length: HALF }, (_, k) => Math.round(1 + Math.pow(k / (HALF - 1), 1.7) * 46));

// drei's distort material (its `distort` is a live uniform setter); the class isn't exported.
type DistortMat = ComponentRef<typeof MeshDistortMaterial>;

function VoiceCore({
  mode,
  meter,
  still,
  onActivate,
}: {
  mode: OrbMode;
  meter: React.RefObject<AudioMeter>;
  still: boolean;
  onActivate?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const mat = useRef<DistortMat>(null);
  const bars = useRef<THREE.InstancedMesh>(null);
  const barMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const hovered = useRef(false);

  const freq = useMemo(() => new Uint8Array(128), []);
  const heights = useMemo(() => new Float32Array(BARS), []);
  const level = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(
    () => ({ core: new THREE.Color(), glow: new THREE.Color(), bars: new THREE.Color() }),
    [],
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const palette = PALETTE[mode];
    target.core.set(palette.core);
    target.glow.set(palette.glow);
    target.bars.set(palette.bars);
    const ease = still ? 1 : Math.min(1, dt * 3.5);

    // ── read the meter ────────────────────────────────────────────────
    const m = meter.current;
    let live = 0;
    if (m?.analyser && !still) {
      m.analyser.getByteFrequencyData(freq);
      let sum = 0;
      for (let i = 1; i < 48; i++) sum += freq[i] ?? 0;
      live = sum / (47 * 255);
    }
    if (m) m.pulse = Math.max(0, m.pulse - dt * 2.4);
    const pulse = m?.pulse ?? 0;
    level.current = THREE.MathUtils.damp(level.current, Math.min(1, live * 1.8 + pulse * 0.5), 9, dt);
    const lvl = level.current;

    // ── core ──────────────────────────────────────────────────────────
    if (mat.current) {
      mat.current.color.lerp(target.core, ease);
      mat.current.emissive.lerp(target.glow, ease);
      const hoverBoost = hovered.current ? 0.25 : 0;
      mat.current.emissiveIntensity = THREE.MathUtils.damp(
        mat.current.emissiveIntensity,
        (mode === "offline" ? 0.08 : 0.35) + lvl * 0.9 + hoverBoost,
        6,
        dt,
      );
      const restDistort = mode === "thinking" ? 0.45 : mode === "offline" ? 0.12 : 0.3;
      mat.current.distort = THREE.MathUtils.damp(mat.current.distort, restDistort + lvl * 0.45, 6, dt);
    }
    if (core.current) {
      const s = 1 + lvl * 0.28 + (hovered.current ? 0.06 : 0);
      core.current.scale.setScalar(THREE.MathUtils.damp(core.current.scale.x, s, 8, dt));
    }

    // ── spectrum halo: bass at the bottom, mirrored left/right like a voice print ──
    if (bars.current) {
      for (let i = 0; i < BARS; i++) {
        const k = i < HALF ? i : BARS - 1 - i;
        let h: number;
        if (m?.analyser && !still) {
          const v = (freq[BIN_FOR[k] ?? 1] ?? 0) / 255;
          h = 0.05 + Math.min(1, v * (1 + (k / HALF) * 0.9)) * 0.95; // lift the quieter highs
        } else if (mode === "thinking" && !still) {
          // a comet of energy circling the ring
          const phase = (i / BARS) * Math.PI * 2 - t * 3.2;
          h = 0.05 + Math.pow(Math.max(0, Math.cos(phase)), 14) * 0.55;
        } else {
          const breathe = still ? 0 : Math.sin(t * 1.6 + k * 0.45) * 0.5 + 0.5;
          h = 0.04 + breathe * 0.05 + pulse * 0.35 * (0.6 + 0.4 * Math.sin(k * 1.7 + t * 9));
        }
        heights[i] = still ? h : THREE.MathUtils.damp(heights[i] ?? 0, h, 14, dt);
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2; // i=0 at six o'clock
        const len = heights[i] ?? 0;
        const r = RING_RADIUS + len / 2;
        dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
        dummy.rotation.set(0, 0, angle - Math.PI / 2);
        dummy.scale.set(1, len, 1);
        dummy.updateMatrix();
        bars.current.setMatrixAt(i, dummy.matrix);
      }
      bars.current.instanceMatrix.needsUpdate = true;
    }
    barMat.current?.color.lerp(target.bars, ease);

    if (still) return; // prefers-reduced-motion: rendered, not animated

    // ── gyroscope rings + parallax ────────────────────────────────────
    const tempo = TEMPO[mode];
    if (ringA.current) {
      ringA.current.rotation.x += dt * tempo * 0.9;
      ringA.current.rotation.y += dt * tempo * 0.5;
    }
    if (ringB.current) {
      ringB.current.rotation.y -= dt * tempo * 0.7;
      ringB.current.rotation.z += dt * tempo * 0.4;
    }
    if (group.current) {
      const { pointer } = state;
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.35, 2.5, dt);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.25, 2.5, dt);
    }
  });

  // R3F won't fire pointer-out on unmount — never leave the page with a pointer cursor.
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const setHover = (on: boolean) => {
    hovered.current = on;
    if (onActivate) document.body.style.cursor = on ? "pointer" : "";
  };

  return (
    <group ref={group}>
      <Float speed={still ? 0 : 1.4} rotationIntensity={still ? 0 : 0.25} floatIntensity={still ? 0 : 0.6}>
        <mesh
          ref={core}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
          onClick={onActivate}
        >
          <sphereGeometry args={[1, 96, 96]} />
          <MeshDistortMaterial
            ref={mat}
            color={PALETTE.idle.core}
            emissive={new THREE.Color(PALETTE.idle.glow)}
            emissiveIntensity={0.35}
            roughness={0.15}
            metalness={0.3}
            clearcoat={1}
            clearcoatRoughness={0.25}
            distort={0.3}
            speed={still ? 0 : 1.8}
          />
        </mesh>
        <pointLight intensity={3.5} distance={5} color="#22d3ee" />
      </Float>

      {/* spectrum halo */}
      <instancedMesh ref={bars} args={[undefined, undefined, BARS]}>
        <boxGeometry args={[0.045, 1, 0.045]} />
        <meshBasicMaterial ref={barMat} color={PALETTE.idle.bars} transparent opacity={0.9} toneMapped={false} />
      </instancedMesh>

      {/* gyroscope rings */}
      <mesh ref={ringA} rotation={[1.1, 0.3, 0]}>
        <torusGeometry args={[2.05, 0.008, 8, 160]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} rotation={[0.4, 1.2, 0.6]}>
        <torusGeometry args={[2.25, 0.006, 8, 160]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.28} toneMapped={false} />
      </mesh>

      <Sparkles count={70} scale={6} size={2} speed={still ? 0 : 0.3} opacity={0.45} color="#38bdf8" />
    </group>
  );
}

export default function LiveOrb({
  mode,
  meter,
  onActivate,
}: {
  mode: OrbMode;
  meter: React.RefObject<AudioMeter>;
  onActivate?: () => void;
}) {
  const [effects, setEffects] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );
  const still = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [dpr, setDpr] = useState<number>(1.5);
  const maxDpr = useMemo(
    () => (typeof window === "undefined" ? 1.5 : Math.min(1.75, window.devicePixelRatio)),
    [],
  );

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      aria-hidden
    >
      <PerformanceMonitor
        onIncline={() => setDpr(maxDpr)}
        onDecline={() => {
          setDpr(1);
          setEffects(false);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 3, 5]} intensity={1.2} color="#38bdf8" />
        <directionalLight position={[-5, -2, -4]} intensity={0.6} color="#8b5cf6" />
        <directionalLight position={[0, -5, 2]} intensity={0.6} color="#f472b6" />
        <VoiceCore mode={mode} meter={meter} still={still} onActivate={onActivate} />
        {effects && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.85} luminanceThreshold={0.2} luminanceSmoothing={0.7} mipmapBlur />
          </EffectComposer>
        )}
      </PerformanceMonitor>
    </Canvas>
  );
}
