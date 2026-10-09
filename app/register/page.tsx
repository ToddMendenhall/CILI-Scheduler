import Link from "next/link";
import { registrationOpen } from "@/lib/registration";
import { RegisterForm } from "./register-form";

// Whether sign-up is open depends on the database, so this page is never prerendered.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await registrationOpen()) return <RegisterForm />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cy-gray-025 px-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-card border border-cy-gray-200 bg-white shadow-xs">
        <div className="h-[3px] bg-cy-navy" />
        <div className="flex flex-col gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-cy-gray-900">Sign-up is by invitation</h1>
          <p className="text-sm text-cy-gray-500">
            New accounts are made from an invite. Ask an admin of your organization to invite you from
            Members; the link they send lets you set your own password.
          </p>
          <Link href="/login" className="text-sm text-cy-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
