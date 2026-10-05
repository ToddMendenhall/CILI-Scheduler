"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { buttonPrimary, inputClass } from "@/components/form-controls";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let result: Awaited<ReturnType<typeof signIn>> | undefined;
    try {
      result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        // Without this, next-auth defaults the callback target to the
        // current page (this login page) — a *successful* sign-in would
        // then also return a url pointing back at /login, making it
        // indistinguishable from a failed one.
        callbackUrl,
      });
    } catch {
      // signIn() can throw instead of resolving with `error` if something
      // fails server-side before authorize() returns cleanly (e.g. a
      // database error) — treat that the same as a failed sign-in rather
      // than silently falling through to the redirect below.
    }

    setSubmitting(false);

    // NextAuth can respond 200 with no `error` param and still have
    // failed — it redirects back to the sign-in page rather than the
    // requested callbackUrl in that case, so checking result.ok/error
    // alone isn't enough.
    const signedIn = result?.ok && result.url && !new URL(result.url).pathname.startsWith("/login");

    if (!signedIn) {
      setError("Couldn't sign in. Check your email/password, or try again in a moment.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
        <div className="h-[3px] bg-cy-navy" />
        <div className="flex flex-col gap-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-cy-gray-900">Sign in</h1>
            <p className="text-sm text-cy-gray-500">Access your organization's workspace.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[13px] font-semibold text-cy-gray-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[13px] font-semibold text-cy-gray-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-cy-red-500">{error}</p>}
            <button type="submit" disabled={submitting} className={`w-full ${buttonPrimary}`}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="text-sm text-cy-gray-500">
            No account?{" "}
            <Link href="/register" className="text-cy-blue-600 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
