import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/org";
import { InviteForm } from "@/components/members/invite-form";
import { createInvite } from "../actions";

export default async function NewMemberPage() {
  const ctx = await requireOrgContext();
  if (ctx.role !== "admin") redirect("/dashboard/members");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/members" className="text-sm text-cy-gray-500 underline">
          &larr; Members
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-cy-gray-900">Invite Member</h1>

      <InviteForm action={createInvite} submitLabel="Create Invite" />
    </div>
  );
}
