import type { ReactNode } from "react";
import Link from "next/link";
import { requireOrgContext } from "@/lib/org";
import { AccountMenu } from "@/components/account-menu";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  const orgInitial = ctx.org.name.trim().charAt(0).toUpperCase() || "?";
  const userInitial = ctx.user.name.trim().charAt(0).toUpperCase() || "?";
  const navLink = "rounded px-2.5 py-1 text-[13px] font-semibold text-cy-blue-100 transition-colors duration-fast hover:bg-white/10 hover:text-white";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 bg-cy-navy px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
            style={{ background: "linear-gradient(150deg,#4cccea,#1f8ed6 45%,#005a94)" }}
          >
            {orgInitial}
          </span>
          <span className="truncate text-sm font-semibold tracking-[.02em] text-white">{ctx.org.name}</span>
        </div>

        <nav className="flex items-center gap-1">
          <Link href="/dashboard" className={navLink}>
            Schedule
          </Link>
          {ctx.role === "admin" && (
            <Link href="/dashboard/members" className={navLink}>
              Members
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs capitalize text-cy-blue-200">{ctx.role}</span>
          <AccountMenu name={ctx.user.name} email={ctx.user.email} role={ctx.role} initial={userInitial} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
