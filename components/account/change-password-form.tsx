"use client";

import { useState, useTransition } from "react";
import { Field, buttonPrimary, inputClass } from "@/components/form-controls";
import type { ActionResult } from "@/app/dashboard/(settings)/account/actions";

export function ChangePasswordForm({ action }: { action: (formData: FormData) => Promise<ActionResult> }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setSuccess(true);
        form.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <Field label="Current password">
        <input type="password" name="currentPassword" required className={inputClass} />
      </Field>
      <Field label="New password" hint="At least 12 characters.">
        <input type="password" name="newPassword" required minLength={12} className={inputClass} />
      </Field>
      <Field label="Confirm new password">
        <input type="password" name="confirmPassword" required minLength={12} className={inputClass} />
      </Field>

      {error && <p className="text-sm text-cy-red-500">{error}</p>}
      {success && <p className="text-sm text-cy-green-500">Password updated.</p>}

      <button type="submit" disabled={isPending} className={`w-fit ${buttonPrimary}`}>
        {isPending ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
