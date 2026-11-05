import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { BrandMark } from "@/components/shell/brand-mark";
import { AnimatedCharacter } from "@/components/ui/animated-character";
import { safeRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

type Props = { searchParams: Promise<{ redirect?: string; mode?: string; error?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return { title: (await searchParams).mode === "signup" ? "Create an account" : "Sign in" };
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const target = safeRedirect(params.redirect ?? null);
  // Already signed in: go straight to where they were headed.
  if (await getSession()) redirect(target as Route);

  // Mirrors the conditional socialProviders in lib/auth.ts; only booleans leave the server.
  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };

  return (
    <div className="flex min-h-dvh w-full">
      {/* Brand side (desktop): a deliberately dark showcase in both themes, like the illustration it frames. */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden border-r border-white/5 bg-[#060912] text-[#e6edf6] lg:flex">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%)]" />
        <div className="relative z-10 w-full max-w-lg">
          <AnimatedCharacter />
        </div>
        <div className="absolute bottom-12 left-12 z-20 max-w-sm">
          <Link href="/" className="inline-flex items-center gap-3 rounded-lg text-2xl font-semibold tracking-tight">
            <BrandMark className="h-9 w-9 text-[#38bdf8]" />
            VAYU AI
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-[#8aa0bd]">
            Write with Copilot, ask grounded questions of your own sources, and hand longer tasks to agents.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center justify-center gap-2.5 rounded-lg text-xl font-semibold tracking-tight lg:hidden">
            <BrandMark className="h-8 w-8 text-vayu-accent" />
            VAYU AI
          </Link>
          <AuthPanel
            providers={providers}
            initialMode={params.mode === "signup" ? "signup" : "signin"}
            target={target}
            callbackError={params.error ?? null}
          />
          <p className="mt-10 text-center text-xs text-vayu-subtle">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-vayu-fg">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-vayu-fg">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
