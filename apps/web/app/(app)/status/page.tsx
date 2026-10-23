import type { Metadata } from "next";
import { StatusBoard } from "@/components/status-board";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "VAYU — System status" };

export default async function StatusPage() {
  await requireSession();
  return <StatusBoard />;
}
