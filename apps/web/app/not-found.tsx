import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-[70vh] place-items-center px-4 pb-nav pt-12">
      <div className="surface w-full max-w-md rounded-2xl p-8 text-center">
        <p className="text-overline font-semibold uppercase text-vayu-accent">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-vayu-muted">
          The link may be mistyped, or the page was moved or deleted.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LinkButton href="/dashboard" variant="primary">
            Go to dashboard
          </LinkButton>
          <LinkButton href="/" variant="secondary">
            Home
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
