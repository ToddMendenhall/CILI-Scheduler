"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Field, buttonPrimary, inputClass, selectClass } from "@/components/form-controls";
import type { CreateInviteResult } from "@/app/dashboard/(settings)/members/actions";

export function InviteForm({
  action,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<CreateInviteResult>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");

    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        const url = `${window.location.origin}${result.inviteUrl}`;
        setCreated({ email, url });
      } else {
        setError(result.error);
      }
    });
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable — the link is still selectable on screen.
    }
  }

  if (created) {
    return (
      <div className="flex max-w-md flex-col gap-4 rounded-card border border-cy-amber-400 bg-cy-amber-100 p-4">
        <div>
          <p className="font-medium text-cy-amber-600">Invite created for {created.email}</p>
          <p className="text-sm text-cy-gray-700">
            There&apos;s no email sending set up yet — copy this link and send it to them directly. Anyone with
            this link can join as {created.email}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="select-all break-all rounded border border-cy-gray-200 bg-white px-2 py-1 font-mono text-sm">
            {created.url}
          </code>
          <button type="button" onClick={handleCopy} className="shrink-0 text-xs text-cy-gray-600 underline">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/members" className={`w-fit ${buttonPrimary}`}>
            Done
          </Link>
          <button type="button" onClick={() => setCreated(null)} className="text-sm text-cy-gray-600 underline">
            Invite another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Field label="Email">
        <input type="email" name="email" required className={inputClass} />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue="member" className={selectClass}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </Field>

      {error && <p className="text-sm text-cy-red-500">{error}</p>}

      <button type="submit" disabled={isPending} className={`w-fit ${buttonPrimary}`}>
        {isPending ? "Creating invite..." : submitLabel}
      </button>
    </form>
  );
}
