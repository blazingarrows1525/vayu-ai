"use client";

import dynamic from "next/dynamic";
import type { VayuEditorProps } from "@vayu/editor";
import { Skeleton } from "@/components/ui/feedback";

/** Placeholder with the editor's shape while its code loads. */
export function EditorSkeleton() {
  return (
    <div aria-hidden className="min-h-[40vh] space-y-3 py-1 lg:min-h-[60vh]">
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/**
 * The block editor (Tiptap + ProseMirror, ~800 KB) as its own chunk, loaded only when a page
 * renders it. A static import made every page that links to an editor page prefetch it.
 */
export const LazyEditor = dynamic<VayuEditorProps>(() => import("@vayu/editor").then((m) => m.VayuEditor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
