import { Hero } from "@/components/landing/hero";
import {
  Architecture,
  Capabilities,
  FinaleCTA,
  Stats,
} from "@/components/landing/sections";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { Story } from "@/components/landing/story";
import { WavesDemo } from "@/components/demo";

export default function Home() {
  return (
    <SmoothScroll>
      <ScrollProgress />
      <main className="relative">
        <Hero />
        <Capabilities />
        <Story />
        <Stats />
        <Architecture />
        <WavesDemo />
        <FinaleCTA />
        <footer className="mx-auto max-w-6xl px-6 pb-28 text-center text-xs text-vayu-muted">
          Two-plane polyglot architecture · Next.js 16 + FastAPI · pgvector · LangGraph
        </footer>
      </main>
    </SmoothScroll>
  );
}
