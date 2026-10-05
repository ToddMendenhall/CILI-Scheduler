"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { buttonPrimary, inputClass } from "@/components/form-controls";

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not create account.");
      setSubmitting(false);
      return;
    }

    let result: Awaited<ReturnType<typeof signIn>> | undefined;
    try {
      result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/dashboard" });
    } catch {
      // handled by the fallback check below
    }
    setSubmitting(false);

    const signedIn = result?.ok && result.url && !new URL(result.url).pathname.startsWith("/login");

    if (!signedIn) {
      setError("Account created, but sign-in failed. Try signing in manually.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
        <div className="h-[3px] bg-cy-navy" />
        <div className="flex flex-col gap-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-cy-gray-900">Create your organization</h1>
            <p className="text-sm text-cy-gray-500">
              This creates a new workspace and makes you its admin.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[13px] font-semibold text-cy-gray-700">Organization name</span>
              <input
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[13px] font-semibold text-cy-gray-700">Your name</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-cy-red-500">{error}</p>}
            <button type="submit" disabled={submitting} className={`w-full ${buttonPrimary}`}>
              {submitting ? "Creating..." : "Create organization"}
            </button>
          </form>
          <p className="text-sm text-cy-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-cy-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
