import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Mounts every Better Auth endpoint (sign-in/up/out, session, jwks, token, …).
export const { GET, POST } = toNextJsHandler(auth.handler);
