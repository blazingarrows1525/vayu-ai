"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg border border-vayu-border px-3 py-1.5 text-sm text-vayu-muted transition hover:border-vayu-accent hover:text-vayu-fg"
    >
      Sign out
    </button>
  );
}
