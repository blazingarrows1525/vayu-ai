import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-vayu-border bg-vayu-surface p-8">
      <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
      <p className="mt-1 text-sm text-vayu-muted">
        Start writing, researching, and shipping with VAYU.
      </p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
      <p className="mt-6 text-sm text-vayu-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-vayu-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
