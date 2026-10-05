import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config: no database or bcrypt imports here. This is what
 * middleware.ts uses (middleware runs on the Edge Runtime, which can't load
 * Node.js APIs like the ones the `postgres` driver needs). The full config
 * with the Credentials provider lives in lib/auth.ts and only runs in the
 * Node.js runtime (API routes, server components).
 */
export const authConfig = {
  // Needed here too, not just in lib/auth.ts — middleware.ts builds its own
  // NextAuth() instance directly from this config, and without trustHost
  // Auth.js rejects the request's Host header (Vercel's deployment domain)
  // as untrusted, breaking session handling on every request.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnProtectedRoute =
        request.nextUrl.pathname.startsWith("/dashboard") ||
        request.nextUrl.pathname.startsWith("/onboarding");

      if (isOnProtectedRoute) {
        return isLoggedIn;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
