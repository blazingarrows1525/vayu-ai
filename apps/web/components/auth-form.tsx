"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { motion } from "framer-motion";

interface SocialProviders {
  google: boolean;
  github: boolean;
}

const LoadingSpinner = () => (
  <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = params.get("redirect");
  const target = (
    redirectParam?.startsWith("/") ? redirectParam : "/dashboard"
  ) as Route;

  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
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

  async function onSocial(provider: "google" | "github") {
    setError(null);
    setLoadingProvider(provider);
    try {
      await authClient.signIn.social({ provider, callbackURL: target });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Social sign-in failed");
      setLoadingProvider(null);
    }
  }

  // Force buttons to render for UI display even if backend isn't configured yet
  const hasSocial = true;
  providers.google = true;
  providers.github = true;

  return (
    <div className="flex flex-col w-full gap-4 mt-6">
      {error && (
        <motion.p 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="p-3 text-sm text-center text-red-400 bg-red-900/10 border border-red-500/20 rounded-xl"
        >
          {error}
        </motion.p>
      )}

      {hasSocial ? (
        <div className="flex flex-col gap-3">
          {providers.google && (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onSocial("google")}
              disabled={loadingProvider !== null}
              className="relative flex items-center justify-center w-full gap-3 px-4 py-3 text-sm font-semibold text-black transition-all bg-white border border-transparent rounded-xl hover:shadow-[0_8px_30px_rgb(255,255,255,0.12)] disabled:opacity-70 disabled:hover:scale-100 disabled:hover:y-0"
            >
              {loadingProvider === "google" ? <LoadingSpinner /> : <GoogleIcon />}
              Continue with Google
            </motion.button>
          )}
          
          {providers.github && (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onSocial("github")}
              disabled={loadingProvider !== null}
              className="relative flex items-center justify-center w-full gap-3 px-4 py-3 text-sm font-semibold text-white transition-all bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] hover:border-[#3f3f46] hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)] disabled:opacity-70 disabled:hover:scale-100 disabled:hover:y-0"
            >
              {loadingProvider === "github" ? <LoadingSpinner /> : <GitHubIcon />}
              Continue with GitHub
            </motion.button>
          )}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-sm text-center text-vayu-muted p-4 border border-white/5 rounded-xl bg-white/5 backdrop-blur-sm"
        >
          Authentication providers are currently being configured.
        </motion.div>
      )}
      
      <p className="mt-6 text-xs text-center text-vayu-muted opacity-80">
        By continuing, you agree to our{" "}
        <a href="/terms" className="underline hover:text-white transition-colors">Terms of Service</a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</a>.
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
