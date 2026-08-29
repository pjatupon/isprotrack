"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: ["REQUESTER", "STAFF", "APPROVER", "ADMIN"],
          required: false,
        },
        department: {
          type: "string",
          required: false,
        },
      },
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
