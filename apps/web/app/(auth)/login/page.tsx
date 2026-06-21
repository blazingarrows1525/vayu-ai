import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-vayu-border bg-vayu-surface p-8">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-vayu-muted">Sign in to your VAYU workspace.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
      <p className="mt-6 text-sm text-vayu-muted">
        No account?{" "}
        <Link href="/signup" className="text-vayu-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
