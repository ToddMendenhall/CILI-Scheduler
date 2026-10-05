"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className ?? "text-sm text-cy-gray-500 underline"}
    >
      Sign out
    </button>
  );
}
