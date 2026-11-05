"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

/** Errors inside a signed-in page render here, inside the shell, so navigation stays available. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 pb-nav pt-12">
      <div className="surface w-full max-w-md rounded-2xl p-8 text-center">
        <p className="text-overline font-semibold uppercase text-vayu-danger">Unexpected error</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page couldn&rsquo;t load</h1>
        <p className="mt-2 text-sm leading-relaxed text-vayu-muted">
          Something failed while showing this page. Trying again usually works; if it keeps happening, the
          service status page shows whether a dependency is down.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-vayu-subtle">
            Reference <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={<RefreshCw aria-hidden className="h-4 w-4" />} onClick={reset}>
            Try again
          </Button>
          <LinkButton href="/status" variant="secondary">
            Service status
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
