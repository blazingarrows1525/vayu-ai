"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";

export type SocialProviders = { google: boolean; github: boolean };
export type AuthMode = "signin" | "signup";

// Better Auth redirects a failed OAuth callback to errorCallbackURL with ?error=<code>.
const OAUTH_ERRORS: Record<string, string> = {
  state_mismatch: "Your sign-in session expired or was opened in another tab. Please try again.",
  please_restart_the_process: "Your sign-in session expired. Please try again.",
  invalid_code: "The provider rejected the sign-in code. Please try again.",
  unable_to_get_user_info: "We couldn't read your profile from the provider.",
  email_not_found: "Your provider account has no email we can use. Make one public or verified and retry.",
  account_not_linked: "That email already belongs to an account that uses a different sign-in method.",
  unable_to_link_account: "We couldn't link this provider to your existing account.",
  internal_server_error: "Sign-in failed on our side. Please try again in a moment.",
};

function describeOAuthError(code: string): string {
  return OAUTH_ERRORS[code] ?? `Sign-in failed (${code.replace(/_/g, " ")}). Please try again.`;
}

/**
 * Sign in or create an account: configured OAuth providers first, then email and password.
 * Providers come from the server, so the buttons are there on first paint (no layout jump).
 */
export function AuthForm({
  providers,
  mode,
  onModeChange,
  target,
  callbackError,
}: {
  providers: SocialProviders;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Same-origin path to land on (already passed through safeRedirect). */
  target: string;
  callbackError: string | null;
}) {
  const [error, setError] = useState<string | null>(callbackError ? describeOAuthError(callbackError) : null);
  const [pending, setPending] = useState<"google" | "github" | "email" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function onSocial(provider: "google" | "github") {
    setError(null);
    setPending(provider);
    const errorCallbackURL = `/login?redirect=${encodeURIComponent(target)}`;
    try {
      // Better Auth reports failures as { error }; on success the browser is already leaving
      // for the provider, so the button stays busy.
      const { error: err } = await authClient.signIn.social({ provider, callbackURL: target, errorCallbackURL });
      if (err) {
        setError(err.message || `Couldn't start ${provider === "google" ? "Google" : "GitHub"} sign-in (${err.status}).`);
        setPending(null);
      }
    } catch {
      setError("Couldn't reach VAYU. Check your connection and try again.");
      setPending(null);
    }
  }

  async function onEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending("email");
    try {
      const { error: err } =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] || "VAYU user" });
      if (err) {
        setError(
          err.status === 429
            ? "Too many attempts. Wait a few seconds and try again."
            : err.message || (mode === "signin" ? "Sign-in failed. Check your email and password." : "The account couldn't be created."),
        );
        setPending(null);
        return;
      }
      // A full load, so nothing rendered while signed out is reused.
      window.location.assign(target);
    } catch {
      setError("Couldn't reach VAYU. Check your connection and try again.");
      setPending(null);
    }
  }

  const hasSocial = providers.google || providers.github;

  return (
    <div className="mt-8 flex w-full flex-col gap-5">
      {error && <Notice tone="danger">{error}</Notice>}

      {hasSocial && (
        <div className="flex flex-col gap-2.5">
          {providers.google && (
            <Button variant="secondary" size="lg" block icon={<GoogleIcon />} loading={pending === "google"} disabled={pending !== null} onClick={() => void onSocial("google")}>
              Continue with Google
            </Button>
          )}
          {providers.github && (
            <Button variant="secondary" size="lg" block icon={<GitHubIcon />} loading={pending === "github"} disabled={pending !== null} onClick={() => void onSocial("github")}>
              Continue with GitHub
            </Button>
          )}
          <div className="flex items-center gap-3 py-1 text-xs text-vayu-subtle" aria-hidden>
            <span className="h-px flex-1 bg-vayu-border" />
            or with email
            <span className="h-px flex-1 bg-vayu-border" />
          </div>
        </div>
      )}

      <form onSubmit={onEmail} className="flex flex-col gap-4">
        {mode === "signup" && (
          <Field id="auth-name" label="Name" description="Shown to people in your workspaces.">
            {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        )}
        <Field id="auth-email" label="Email">
          {(p) => (
            <Input {...p} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field id="auth-password" label="Password" description={mode === "signup" ? "At least 8 characters." : undefined}>
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
              />
              <div className="absolute inset-y-0 right-1 flex items-center">
                <IconButton
                  size="sm"
                  label={showPassword ? "Hide password" : "Show password"}
                  pressed={showPassword}
                  icon={showPassword ? <EyeOff className="h-full w-full" /> : <Eye className="h-full w-full" />}
                  onClick={() => setShowPassword((v) => !v)}
                  className="border-transparent bg-transparent"
                />
              </div>
            </div>
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending === "email"} loadingLabel={mode === "signin" ? "Signing in…" : "Creating account…"} disabled={pending !== null && pending !== "email"}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-vayu-muted">
        {mode === "signin" ? "New to VAYU?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setError(null);
            onModeChange(mode === "signin" ? "signup" : "signin");
          }}
          className="rounded font-medium text-vayu-accent underline-offset-2 hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in instead"}
        </button>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17 5.1 18 5.4 18 5.4c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}
