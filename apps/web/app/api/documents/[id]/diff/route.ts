import { db, documentVersion } from "@vayu/db";
import { and, eq, inArray } from "drizzle-orm";
import * as Diff from "diff";
import { getDocument } from "@/lib/data";
import { checkPermission } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Word-level diff between two snapshots of a document (workspace-scoped). */
export async function GET(req: Request, { params }: Ctx) {
  const ctx = await checkPermission("document:read");
  if (!ctx.ok) return Response.json({ error: "forbidden" }, { status: ctx.status });

  const { id } = await params;
  // Ownership: the document must live in the caller's workspace.
  const doc = await getDocument(id, ctx.workspaceId);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const from = Number.parseInt(url.searchParams.get("from") ?? "0", 10);
  const to = Number.parseInt(url.searchParams.get("to") ?? "0", 10);
  if (!from || !to) {
    return Response.json({ error: "missing from/to versions" }, { status: 400 });
  }

  const rows = await db
    .select({ version: documentVersion.version, content: documentVersion.content })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, id),
        inArray(documentVersion.version, [from, to]),
      ),
    );

  const fromVer = rows.find((r) => r.version === from);
  const toVer = rows.find((r) => r.version === to);
  if (!fromVer || !toVer) {
    return Response.json({ error: "versions not found" }, { status: 404 });
  }

  const changes = Diff.diffWords(
    extractText(fromVer.content),
    extractText(toVer.content),
  );
  return Response.json({ from, to, changes });
}

function extractText(json: unknown): string {
  const node = json as { type?: string; text?: string; content?: unknown[] } | null;
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (Array.isArray(node.content)) {
    return node.content
      .map(extractText)
      .join(node.type === "paragraph" || node.type === "heading" ? "\n" : "");
  }
  return "";
}
