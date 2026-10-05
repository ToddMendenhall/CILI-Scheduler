"use client";

import { useState, useTransition } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PasswordReveal } from "@/components/members/password-reveal";
import type { ActionResult, ResetPasswordResult } from "@/app/dashboard/(settings)/members/actions";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: Date | string;
};

export function MembersTable({
  members,
  currentUserId,
  onRoleChange,
  onDelete,
  onResetPassword,
}: {
  members: Member[];
  currentUserId: string;
  onRoleChange: (userId: string, role: string) => Promise<ActionResult>;
  onDelete: (userId: string) => Promise<ActionResult>;
  onResetPassword: (userId: string) => Promise<ResetPasswordResult>;
}) {
  const [rows, setRows] = useState(members);
  const [, startTransition] = useTransition();
  const [reset, setReset] = useState<{ name: string; password: string } | null>(null);

  function handleRoleChange(member: Member, role: string) {
    const previous = member.role;
    setRows((prev) => prev.map((m) => (m.userId === member.userId ? { ...m, role: role as Member["role"] } : m)));

    startTransition(async () => {
      const result = await onRoleChange(member.userId, role);
      if (!result.ok) {
        setRows((prev) => prev.map((m) => (m.userId === member.userId ? { ...m, role: previous } : m)));
        alert(result.error);
      }
    });
  }

  async function handleDelete(userId: string) {
    const result = await onDelete(userId);
    if (result.ok) {
      setRows((prev) => prev.filter((m) => m.userId !== userId));
    } else {
      alert(result.error);
    }
  }

  async function handleResetPassword(member: Member) {
    if (!confirm(`Reset ${member.name}'s password? Their current password will stop working immediately.`)) return;

    const result = await onResetPassword(member.userId);
    if (result.ok) {
      setReset({ name: member.name, password: result.password });
    } else {
      alert(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {reset && (
        <div className="rounded-card border border-cy-amber-400 bg-cy-amber-100 p-3 text-sm">
          <div className="mb-2 flex items-start justify-between gap-4">
            <p className="font-medium text-cy-amber-600">
              New password for {reset.name} — copy it now, it won&apos;t be shown again.
            </p>
            <button type="button" onClick={() => setReset(null)} className="shrink-0 text-xs text-cy-amber-600 underline">
              Dismiss
            </button>
          </div>
          <PasswordReveal password={reset.password} />
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-cy-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-cy-gray-200 bg-cy-blue-100 text-[11px] font-semibold uppercase tracking-label text-cy-blue-800">
              <th className="px-3.5 py-2 font-semibold">Name</th>
              <th className="px-3.5 py-2 font-semibold">Email</th>
              <th className="px-3.5 py-2 font-semibold">Role</th>
              <th className="px-3.5 py-2 font-semibold">Joined</th>
              <th className="px-3.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => {
              const isSelf = member.userId === currentUserId;
              return (
                <tr key={member.userId} className="border-b border-cy-gray-100 last:border-0 hover:bg-cy-gray-025">
                  <td className="px-3.5 py-2.5 font-medium text-cy-gray-900">
                    {member.name} {isSelf && <span className="text-xs font-normal text-cy-gray-400">(you)</span>}
                  </td>
                  <td className="px-3.5 py-2.5 text-cy-gray-700">{member.email}</td>
                  <td className="px-3.5 py-2.5">
                    <select
                      value={member.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(member, e.target.value)}
                      title={isSelf ? "You can't change your own role" : undefined}
                      className="rounded border border-cy-gray-200 bg-white px-2 py-1 text-xs text-cy-gray-700 disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-xs tabular-nums text-cy-gray-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(member)}
                        className="text-sm text-cy-blue-600 underline"
                      >
                        Reset Password
                      </button>
                      {!isSelf && (
                        <ConfirmDeleteButton
                          action={handleDelete.bind(null, member.userId)}
                          confirmMessage={`Delete ${member.name}'s account? This removes their access and cannot be undone.`}
                        />
                      )}
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
