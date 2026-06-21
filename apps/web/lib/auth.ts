import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { account, db, jwks, session, user, verification } from "@vayu/db";
import { bootstrapWorkspace, resolveTokenWorkspace } from "./workspace";

const ISSUER = process.env.AUTH_JWT_ISSUER ?? "vayu";
const AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "vayu-ai";

/**
 * Better Auth — the product plane's identity authority.
 *
 * - email/password + (optional) OAuth
 * - UUID ids (matches the rest of the schema)
 * - a personal workspace is created for every new user (databaseHook)
 * - the `jwt` plugin mints short-lived access tokens carrying workspace_id +
 *   role, and serves JWKS at /api/auth/jwks for the intelligence plane to verify
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, jwks },
  }),
  advanced: {
    // Generate UUIDs so ids line up with our uuid columns + FKs.
    database: { generateId: "uuid" },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await bootstrapWorkspace({
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
          });
        },
      },
    },
  },
  plugins: [
    jwt({
      jwks: { keyPairConfig: { alg: "EdDSA", crv: "Ed25519" } },
      jwt: {
        issuer: ISSUER,
        audience: AUDIENCE,
        expirationTime: "15m",
        // Stamp tenant context into the token so the AI plane can enforce RBAC
        // statelessly. `sub` is set to user.id automatically.
        definePayload: async ({ user: u }) => {
          const ws = await resolveTokenWorkspace(u.id, null);
          return {
            email: u.email,
            name: u.name,
            workspace_id: ws?.workspaceId ?? null,
            role: ws?.role ?? null,
          };
        },
      },
    }),
  ],
});

export type Auth = typeof auth;
