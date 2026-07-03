import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8787";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const sessionCookie = getSessionCookie(req);
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathArray = (await params).path;
  const path = pathArray ? pathArray.join("/") : "";
  const targetUrl = `${AI_SERVICE_URL}/${path}`;

  // Clone headers
  const headers = new Headers();
  headers.set("cookie", `better-auth.session_token=${sessionCookie}`);
  
  // Forward multipart form data properly
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    headers.set("content-type", contentType);
    const body = await req.formData();
    
    // Auto-inject workspace_id if missing and required by backend
    if (!body.has("workspace_id")) {
      body.append("workspace_id", "default");
    }

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body,
        // Remove duplex for standard fetch if not streaming req body, 
        // but Next.js requires node-fetch behavior. It's usually fine without duplex for formData.
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
         return NextResponse.json(data || { error: "Upstream error" }, { status: response.status });
      }
      return NextResponse.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Only multipart supported on this proxy" }, { status: 400 });
}
