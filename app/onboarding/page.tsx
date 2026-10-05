import { auth } from "@/lib/auth";
import { getPrimaryOrgMembership } from "@/lib/org";
import { SignOutButton } from "@/components/sign-out-button";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getPrimaryOrgMembership(session.user.id);
  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
        <div className="h-[3px] bg-cy-navy" />
        <div className="flex flex-col gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-cy-gray-900">No organization yet</h1>
          <p className="text-sm text-cy-gray-500">
            Your account isn't a member of any organization. Ask an admin to invite you, or sign out and
            create a new organization.
          </p>
          <SignOutButton className="rounded bg-cy-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-fast hover:bg-cy-blue-700" />
        </div>
      </div>
    </main>
  );
}
