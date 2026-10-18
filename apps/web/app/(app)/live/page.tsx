import type { Metadata } from "next";
import { LiveConsole } from "@/components/live/live-console";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "VAYU Live — realtime voice & chat",
};

export default async function LivePage() {
  await requireSession();
  return <LiveConsole />;
}
