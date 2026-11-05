"use client";

import "./globals.css";

/** Last-resort boundary for errors in the root layout itself; it replaces the whole document. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main id="main" className="grid min-h-screen place-items-center px-4">
          <div className="surface w-full max-w-md rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">VAYU AI couldn&rsquo;t start</h1>
            <p className="mt-2 text-sm leading-relaxed text-vayu-muted">
              The app failed before it could show a page. Reload to try again.
            </p>
            {error.digest && (
              <p className="mt-4 text-xs text-vayu-subtle">
                Reference <code className="font-mono">{error.digest}</code>
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex h-10 items-center rounded-xl bg-vayu-accent px-4 text-sm font-semibold text-vayu-on-accent"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
