"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "w-full rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none transition focus:border-vayu-accent";

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

  return (
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
  );
}
