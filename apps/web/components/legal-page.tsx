import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";

/** Shared frame for the legal pages: readable prose in both themes and a fixed "last updated". */
export function LegalPage({ title, updated, children }: { title: string; updated: { iso: string; label: string }; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-vayu-border/70">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-vayu-fg">
            <BrandMark className="h-7 w-7 text-vayu-accent" />
            VAYU AI
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-vayu-muted hover:text-vayu-fg">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-vayu-fg sm:text-page">{title}</h1>
        <p className="mt-2 text-sm text-vayu-muted">
          Last updated <time dateTime={updated.iso}>{updated.label}</time>
        </p>
        <div className="prose-vayu mt-8">{children}</div>
        <nav aria-label="Legal" className="mt-14 flex gap-5 border-t border-vayu-border pt-6 text-sm">
          <Link href="/terms" className="text-vayu-muted underline-offset-2 hover:text-vayu-fg hover:underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-vayu-muted underline-offset-2 hover:text-vayu-fg hover:underline">
            Privacy Policy
          </Link>
        </nav>
      </main>
    </>
  );
}

/** When the policy text last changed (not the build date). */
export const LEGAL_UPDATED = { iso: "2026-07-03", label: "3 July 2026" } as const;
