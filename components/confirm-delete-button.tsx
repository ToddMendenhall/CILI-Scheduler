"use client";

import { useTransition } from "react";
import { buttonDestructive } from "@/components/form-controls";

export function ConfirmDeleteButton({
  action,
  confirmMessage,
  label = "Delete",
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(confirmMessage)) {
          startTransition(() => {
            action();
          });
        }
      }}
      className={`${buttonDestructive} px-3 py-1.5 text-xs`}
    >
      {isPending ? "Deleting..." : label}
    </button>
  );
}
