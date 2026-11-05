"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Creates a document and opens it. Stays busy until the editor loads, so a double click can't
 *  create two documents. */
export function NewDocumentButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Your role in this workspace can view documents but not create them."
            : res.status === 401
              ? "Your session has ended. Sign in again to create a document."
              : `The document wasn't created (error ${res.status}). Try again.`,
        );
        setPending(false);
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/docs/${id}`);
    } catch {
      setError("Couldn't reach VAYU. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        variant={variant}
        icon={<Plus aria-hidden className="h-4 w-4" />}
        loading={pending}
        loadingLabel="Creating…"
        onClick={create}
      >
        New document
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs font-medium text-vayu-danger sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
