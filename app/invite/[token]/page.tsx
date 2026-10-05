import Link from "next/link";
import { getInviteByToken } from "@/lib/queries";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
        <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
          <div className="h-[3px] bg-cy-navy" />
          <div className="flex flex-col gap-4 p-8 text-center">
            <h1 className="text-xl font-semibold text-cy-gray-900">Invalid invite</h1>
            <p className="text-sm text-cy-gray-500">
              This invite link doesn&apos;t exist. Ask the person who invited you for a new one.
            </p>
            <Link href="/login" className="text-sm text-cy-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (invite.acceptedAt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
        <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
          <div className="h-[3px] bg-cy-navy" />
          <div className="flex flex-col gap-4 p-8 text-center">
            <h1 className="text-xl font-semibold text-cy-gray-900">Invite already used</h1>
            <p className="text-sm text-cy-gray-500">
              This invite has already been accepted. If that was you, sign in instead.
            </p>
            <Link href="/login" className="text-sm text-cy-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
        <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
          <div className="h-[3px] bg-cy-navy" />
          <div className="flex flex-col gap-4 p-8 text-center">
            <h1 className="text-xl font-semibold text-cy-gray-900">Invite expired</h1>
            <p className="text-sm text-cy-gray-500">
              This invite link has expired. Ask the person who invited you to send a new one.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
        <div className="h-[3px] bg-cy-navy" />
        <div className="flex flex-col gap-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-cy-gray-900">Join {invite.orgName}</h1>
            <p className="text-sm text-cy-gray-500">
              You&apos;ve been invited as <span className="font-medium text-cy-gray-700">{invite.email}</span>. Set
              your name and password to finish joining.
            </p>
          </div>
          <AcceptInviteForm token={token} email={invite.email} />
        </div>
      </div>
    </main>
  );
}
