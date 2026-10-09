import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authConfig } from "@/lib/auth.config";
import { clientAddress, MAX_EMAIL_LENGTH, signInSucceeded, takeSignInAttempt } from "@/lib/sign-in-limit";

// Too many attempts for this email (or from this address) in the current window:
// the sign-in page says so instead of "check your email/password".
class TooManySignInAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// Compared against when no account has the email, so that a sign-in for an
// unknown email takes as long as one with a wrong password: how long the answer
// takes no longer tells anyone which emails have accounts. It matches no password.
const NO_ACCOUNT_HASH = "$2a$10$J/ts.g2yFnxqyIOWnzlT3uAJMAJPnRBNRrYSFy6lYXnwY.hPBdcpe";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const rawEmail = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!rawEmail || !password) return null;
        const email = rawEmail.trim().toLowerCase();
        if (email.length > MAX_EMAIL_LENGTH) return null;
        const address = clientAddress(request?.headers);

        // Counted before any password is checked, so a locked-out guesser learns nothing more,
        // and attempts sent all at once cannot get past the limit (lib/sign-in-limit.ts).
        // When the count cannot be kept, no password is checked either.
        const verdict = await takeSignInAttempt(email, address);
        if (verdict === "refused") throw new TooManySignInAttempts();
        if (verdict !== "allowed") return null;

        try {
          const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (!user) {
            await bcrypt.compare(password, NO_ACCOUNT_HASH);
            console.error("[auth] authorize(): no user found for email", JSON.stringify(email));
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            console.error("[auth] authorize(): password mismatch for user", user.id);
            return null;
          }

          await signInSucceeded(email, address);
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
