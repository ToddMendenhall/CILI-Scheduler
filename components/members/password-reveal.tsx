"use client";

import { useState } from "react";

/** One-time display for a plaintext password the server just generated/accepted — never refetchable afterward. */
export function PasswordReveal({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (insecure context, denied permission) —
      // the password is still visible/selectable on screen either way.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="select-all rounded border border-cy-gray-200 bg-white px-2 py-1 font-mono text-sm">
        {visible ? password : "•".repeat(password.length)}
      </code>
      <button type="button" onClick={() => setVisible((v) => !v)} className="text-xs text-cy-gray-600 underline">
        {visible ? "Hide" : "Show"}
      </button>
      <button type="button" onClick={handleCopy} className="text-xs text-cy-gray-600 underline">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
