"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { buttonPrimary, inputClass } from "@/components/form-controls";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not accept this invite.");
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[13px] font-semibold text-cy-gray-700">Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
      <button type="submit" disabled={submitting} className={buttonPrimary}>
        {submitting ? "Joining..." : "Join workspace"}
      </button>
    </form>
  );
}
