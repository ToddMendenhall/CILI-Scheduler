"use client";

import { useState } from "react";
import type { ActionResult } from "@/app/dashboard/(settings)/members/actions";

type Invite = {
  id: string;
  email: string;
  role: "admin" | "member";
  token: string;
  expiresAt: Date | string;
  createdAt: Date | string;
};

export function PendingInvites({
  invites,
  onRevoke,
}: {
  invites: Invite[];
  onRevoke: (inviteId: string) => Promise<ActionResult>;
}) {
  const [rows, setRows] = useState(invites);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(invite: Invite) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((id) => (id === invite.id ? null : id)), 1500);
    } catch {
      // Clipboard API can be unavailable — nothing else to do here.
    }
  }

  async function handleRevoke(invite: Invite) {
    if (!confirm(`Revoke the invite for ${invite.email}? The link will stop working.`)) return;
    const result = await onRevoke(invite.id);
    if (result.ok) {
      setRows((prev) => prev.filter((i) => i.id !== invite.id));
    } else {
      alert(result.error);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-label text-cy-gray-400">Pending Invites</h2>
      <div className="overflow-x-auto rounded-card border border-cy-gray-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-cy-gray-200 bg-cy-blue-100 text-[11px] font-semibold uppercase tracking-label text-cy-blue-800">
              <th className="px-3.5 py-2 font-semibold">Email</th>
              <th className="px-3.5 py-2 font-semibold">Role</th>
              <th className="px-3.5 py-2 font-semibold">Expires</th>
              <th className="px-3.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((invite) => {
              const isExpired = new Date(invite.expiresAt) < new Date();
              return (
                <tr key={invite.id} className="border-b border-cy-gray-100 last:border-0 hover:bg-cy-gray-025">
                  <td className="px-3.5 py-2.5 text-cy-gray-900">{invite.email}</td>
                  <td className="px-3.5 py-2.5 capitalize text-cy-gray-700">{invite.role}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs tabular-nums">
                    {isExpired ? (
                      <span className="font-semibold uppercase tracking-label text-cy-red-500">Expired</span>
                    ) : (
                      <span className="text-cy-gray-500">{new Date(invite.expiresAt).toLocaleDateString()}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-4">
                      {!isExpired && (
                        <button
                          type="button"
                          onClick={() => handleCopy(invite)}
                          className="text-sm text-cy-blue-600 underline"
                        >
                          {copiedId === invite.id ? "Copied!" : "Copy Link"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRevoke(invite)}
                        className="text-sm text-cy-red-500 underline"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
