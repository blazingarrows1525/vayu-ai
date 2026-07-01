/**
 * Which social login providers are configured on the server. Drives the login/signup UI so
 * we only show a Google/GitHub button when its credentials are actually set (mirrors the
 * conditional `socialProviders` in lib/auth.ts). No secrets are exposed — only booleans.
 */
export async function GET() {
  return Response.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  });
}
