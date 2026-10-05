import type { ReactNode } from "react";

// Ordinary padded pages (members, account) — the schedule page itself fills
// the whole area under the header instead.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-8">{children}</main>;
}
