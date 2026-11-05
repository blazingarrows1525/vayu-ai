"use client";

import { useState } from "react";
import { AuthForm, type AuthMode, type SocialProviders } from "@/components/auth-form";

/** Heading + form; switching between sign-in and sign-up updates both (and the URL). */
export function AuthPanel({
  providers,
  initialMode,
  target,
  callbackError,
}: {
  providers: SocialProviders;
  initialMode: AuthMode;
  target: string;
  callbackError: string | null;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  function changeMode(next: AuthMode) {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "signup") url.searchParams.set("mode", "signup");
    else url.searchParams.delete("mode");
    window.history.replaceState(null, "", url);
    document.title = next === "signup" ? "Create an account · VAYU AI" : "Sign in · VAYU AI";
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-vayu-fg sm:text-page">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-vayu-muted">
          {mode === "signin" ? "Sign in to your intelligent workspace." : "You'll get a personal workspace to start in."}
        </p>
      </div>
      <AuthForm providers={providers} mode={mode} onModeChange={changeMode} target={target} callbackError={callbackError} />
    </>
  );
}
