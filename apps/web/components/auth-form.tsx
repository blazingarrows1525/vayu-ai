"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "w-full rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none transition focus:border-vayu-accent";

interface SocialProviders {
  google: boolean;
  github: boolean;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const isSignup = mode === "signup";
  // Only honor same-origin relative redirects (prevents open-redirect abuse).
  const redirectParam = params.get("redirect");
  const target = (
    redirectParam?.startsWith("/") ? redirectParam : "/dashboard"
  ) as Route;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<SocialProviders>({
    google: false,
    github: false,
  });

  // Show a provider button only when its credentials are configured on the server.
  useEffect(() => {
    fetch("/api/auth-providers")
      .then((r) => (r.ok ? r.json() : { google: false, github: false }))
      .then((p: SocialProviders) => setProviders(p))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = isSignup
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });

    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
      return;
    }
    router.push(target);
    router.refresh();
  }

  async function onSocial(provider: "google" | "github") {
    setError(null);
    try {
      // Redirects to the provider; Better Auth handles the callback + session,
      // then returns the browser to `target`.
      await authClient.signIn.social({ provider, callbackURL: target });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Social sign-in failed");
    }
  }

  const hasSocial = providers.google || providers.github;

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        {isSignup && (
          <input
            className={inputClass}
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        )}
        <input
          className={inputClass}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2 disabled:opacity-60"
        >
          {loading ? "…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      {hasSocial && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-vayu-muted">
            <span className="h-px flex-1 bg-vayu-border" />
            or continue with
            <span className="h-px flex-1 bg-vayu-border" />
          </div>
          <div className="flex flex-col gap-2">
            {providers.google && (
              <button
                type="button"
                onClick={() => onSocial("google")}
                className="flex items-center justify-center gap-2 rounded-lg border border-vayu-border bg-vayu-bg px-4 py-2 text-sm font-medium text-vayu-fg transition hover:border-vayu-accent"
              >
                <GoogleIcon /> Continue with Google
              </button>
            )}
            {providers.github && (
              <button
                type="button"
                onClick={() => onSocial("github")}
                className="flex items-center justify-center gap-2 rounded-lg border border-vayu-border bg-vayu-bg px-4 py-2 text-sm font-medium text-vayu-fg transition hover:border-vayu-accent"
              >
                <GitHubIcon /> Continue with GitHub
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.5 5.5C41.5 36.5 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17 5.1 18 5.4 18 5.4c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}
