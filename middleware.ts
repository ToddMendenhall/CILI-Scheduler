import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Uses the edge-safe config only — no database/bcrypt imports reach the
// Edge Runtime bundle this way. The `authorized` callback in auth.config.ts
// decides which routes require a session and Auth.js handles the redirect
// to /login (with callbackUrl) automatically.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
