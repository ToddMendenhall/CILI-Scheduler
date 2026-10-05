import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const rawEmail = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!rawEmail || !password) return null;
        const email = rawEmail.trim().toLowerCase();

        try {
          const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (!user) {
            console.error("[auth] authorize(): no user found for email", JSON.stringify(email));
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            console.error("[auth] authorize(): password mismatch for user", user.id);
            return null;
          }

          return { id: user.id, email: user.email, name: user.name };
        } catch (err) {
          // Surface the real cause in server logs — a DB error here would
          // otherwise look identical to "wrong password" to the client.
          console.error("[auth] authorize() failed:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Auth.js sets token.sub to the user id automatically on sign-in.
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
