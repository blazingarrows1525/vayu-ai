import Link from "next/link";
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

export default function Home() {
  return (
    <SmoothScroll>
      <ScrollProgress />
      <main id="main" tabIndex={-1} className="relative">
        <Hero />
        <Capabilities />
        <Story />
        <Stats />
        <Architecture />
        <FinaleCTA />
        <footer className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 pb-16 text-center text-xs text-vayu-muted">
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/login" className="hover:text-vayu-fg">Sign in</Link>
            <Link href="/terms" className="hover:text-vayu-fg">Terms</Link>
            <Link href="/privacy" className="hover:text-vayu-fg">Privacy</Link>
          </nav>
          <p>Two-plane architecture · Next.js 16 + FastAPI · pgvector · LangGraph</p>
        </footer>
      </main>
    </SmoothScroll>
  );
}
