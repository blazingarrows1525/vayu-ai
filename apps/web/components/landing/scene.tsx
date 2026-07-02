"use client";

/**
 * The hero's 3D "AI core" — React Three Fiber scene.
 *
 * Design: a distorted breathing sphere (the model), caged by a slow wireframe
 * icosahedron (the structure), orbited by two satellites (the agents), in a
 * field of instanced sparkles (the tokens). Mouse parallax is damped for a
 * weighty, cinematic feel. Bloom only mounts on capable desktops — 60fps wins
 * over spec-sheet effects.
 *
 * Loaded via next/dynamic (ssr:false) so three.js never touches the initial
 * bundle or SSR output.
 */

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  MeshDistortMaterial,
  PerformanceMonitor,
  Sparkles,
  Environment,
} from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

const ACCENT = "#38bdf8";
const VIOLET = "#8b5cf6";
const CYAN = "#22d3ee";
const PINK = "#f472b6";

function AICore({ still = false }: { still?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cage = useRef<THREE.Mesh>(null);
  const orbitA = useRef<THREE.Group>(null);
  const orbitB = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    if (still) return; // prefers-reduced-motion: render, don't animate
    const { pointer, clock } = state;
    const t = clock.elapsedTime;
    if (group.current) {
      // Damped mouse parallax — the whole core leans toward the cursor.
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y, pointer.x * 0.45, 2.5, dt,
      );
      group.current.rotation.x = THREE.MathUtils.damp(
        group.current.rotation.x, -pointer.y * 0.3, 2.5, dt,
      );
    }
    if (cage.current) {
      cage.current.rotation.y = t * 0.12;
      cage.current.rotation.z = t * 0.05;
    }
    if (orbitA.current) orbitA.current.rotation.y = t * 0.5;
    if (orbitB.current) orbitB.current.rotation.y = -t * 0.34;
  });

  return (
    <group ref={group}>
      {/* breathing distorted core */}
      <Float speed={still ? 0 : 1.6} rotationIntensity={still ? 0 : 0.35} floatIntensity={still ? 0 : 0.9}>
        <mesh>
          <sphereGeometry args={[1.05, 64, 64]} />
          <MeshDistortMaterial
            color={VIOLET}
            emissive={new THREE.Color(ACCENT)}
            emissiveIntensity={0.32}
            roughness={0.18}
            metalness={0.35}
            distort={0.38}
            speed={1.7}
          />
        </mesh>
        {/* inner light so the core glows from within */}
        <pointLight intensity={4} distance={5} color={CYAN} />
      </Float>

      {/* structural wireframe cage */}
      <mesh ref={cage} scale={1.75}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.14} />
      </mesh>

      {/* orbiting satellites (agents) */}
      <group ref={orbitA}>
        <mesh position={[2.2, 0.25, 0]}>
          <octahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial
            color={CYAN} emissive={new THREE.Color(CYAN)} emissiveIntensity={0.9}
            roughness={0.25}
          />
        </mesh>
      </group>
      <group ref={orbitB} rotation={[0.6, 0, 0.35]}>
        <mesh position={[1.85, 0, 0]}>
          <torusGeometry args={[0.14, 0.05, 12, 32]} />
          <meshStandardMaterial
            color={VIOLET} emissive={new THREE.Color(VIOLET)} emissiveIntensity={0.7}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* token field */}
      <Sparkles count={110} scale={6.5} size={2.2} speed={still ? 0 : 0.35} opacity={0.5} color={ACCENT} />
    </group>
  );
}

export default function HeroScene() {
  // Bloom only on fine-pointer devices; PerformanceMonitor degrades dpr under load.
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
      camera={{ position: [0, 0, 5.6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      aria-hidden
    >
      <PerformanceMonitor
        onIncline={() => setDpr(maxDpr)}
        onDecline={() => {
          setDpr(1);
          setEffects(false); // shed bloom before shedding resolution feel
        }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 3, 5]} intensity={1.1} color={ACCENT} />
        <directionalLight position={[-5, -2, -4]} intensity={0.5} color={VIOLET} />
        <directionalLight position={[0, -5, 2]} intensity={0.6} color={PINK} />
        <Environment preset="city" />
        <AICore still={still} />
        <ContactShadows position={[0, -2.2, 0]} opacity={0.4} scale={9} blur={2.8} far={4} />
        {effects && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.65} luminanceThreshold={0.25} luminanceSmoothing={0.7} mipmapBlur />
          </EffectComposer>
        )}
      </PerformanceMonitor>
    </Canvas>
  );
}
