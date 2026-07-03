import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AnimatedCharacter } from "@/components/ui/animated-character";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full flex min-h-screen bg-[#050505] text-white selection:bg-vayu-accent selection:text-black">
      {/* Left Panel: Animated Character / Brand Side */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center border-r border-white/5 bg-[#0A0A0A] lg:flex overflow-hidden">
        {/* Background Decorative Mesh/Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-vayu-accent/10 via-transparent to-transparent opacity-80"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        
        <div className="relative z-10 w-full max-w-lg">
          <AnimatedCharacter />
        </div>

        <div className="absolute bottom-12 left-12 z-20">
          <Link href="/" className="flex items-center gap-3 font-bold text-2xl tracking-tighter">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vayu-accent text-vayu-bg shadow-[0_0_20px_rgba(var(--color-vayu-accent),0.4)]">
              V
            </div>
            VAYU AI
          </Link>
          <p className="mt-4 text-sm text-vayu-muted max-w-sm leading-relaxed">
            Experience the next layer of intelligent workflows. Your automated assistant is waiting for you.
          </p>
        </div>
      </div>

      {/* Right Panel: OAuth Login */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center text-center">
            {/* Mobile Logo */}
            <Link href="/" className="flex lg:hidden items-center gap-3 font-bold text-3xl tracking-tighter mb-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vayu-accent text-vayu-bg">
                V
              </div>
              VAYU AI
            </Link>

            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-vayu-muted">
              Sign in to your intelligent workspace.
            </p>
          </div>

          <Suspense fallback={<div className="h-40 animate-pulse bg-white/5 rounded-2xl"></div>}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
