import { Hero } from "@/components/landing/hero";
import {
  Architecture,
  Capabilities,
  FinaleCTA,
  Stats,
} from "@/components/landing/sections";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { SmoothScroll } from "@/components/landing/smooth-scroll";

export default function Home() {
  return (
    <SmoothScroll>
      <ScrollProgress />
      <main className="relative">
        <Hero />
        <Capabilities />
        <Stats />
        <Architecture />
        <FinaleCTA />
        <footer className="mx-auto max-w-6xl px-6 pb-28 text-center text-xs text-vayu-muted">
          Two-plane polyglot architecture · Next.js 16 + FastAPI · pgvector · LangGraph
        </footer>
      </main>
    </SmoothScroll>
  );
}
