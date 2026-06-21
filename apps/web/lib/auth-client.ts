"use client";

import { createAuthClient } from "better-auth/react";

/** Browser auth client. Same-origin, so baseURL is inferred. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
