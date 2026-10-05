"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export function AccountMenu({
  name,
  email,
  role,
  initial,
}: {
  name: string;
  email: string;
  role: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white transition-colors duration-fast hover:bg-white/25"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-[34px] z-20 w-56 overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-md">
          <div className="border-b border-cy-gray-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-cy-gray-900">{name}</p>
            <p className="truncate text-xs text-cy-gray-500">{email}</p>
            <p className="mt-0.5 text-xs capitalize text-cy-gray-400">{role}</p>
          </div>
          <Link
            href="/dashboard/account"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-cy-gray-700 hover:bg-cy-gray-025"
          >
            Account settings
          </Link>
          <div className="px-4 py-2">
            <SignOutButton className="text-sm text-cy-gray-500 hover:text-cy-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}
