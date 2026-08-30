import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: ["REQUESTER", "STAFF", "APPROVER", "ADMIN"],
        required: false,
        defaultValue: "REQUESTER",
        input: false,
      },
      department: {
        type: "string",
        required: false,
      },
    },
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  plugins: [nextCookies()],
});
