import type { ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[13px] font-semibold text-cy-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-cy-gray-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded border border-cy-gray-200 bg-white px-3 py-2 text-sm text-cy-gray-900 placeholder:text-cy-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cy-cyan-500";
export const textareaClass = inputClass + " min-h-[100px] leading-relaxed";
export const selectClass = inputClass;

export const buttonPrimary =
  "rounded bg-cy-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-fast hover:bg-cy-blue-700 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cy-cyan-500 disabled:opacity-50";
export const buttonSecondary =
  "rounded border border-cy-blue-600 bg-white px-3.5 py-[7px] text-[13px] font-semibold text-cy-blue-600 transition-colors duration-fast hover:bg-cy-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cy-cyan-500 disabled:opacity-50";
export const buttonGhost =
  "rounded px-3 py-2 text-[13px] font-semibold text-cy-blue-600 transition-colors duration-fast hover:bg-cy-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cy-cyan-500 disabled:opacity-50";
export const buttonDestructive =
  "rounded bg-cy-red-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-fast hover:bg-cy-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cy-cyan-500 disabled:opacity-50";
