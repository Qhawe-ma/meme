import Link from "next/link";
import { DeleteAccountButton, SignOutButton } from "@/components/auth/auth-forms";
import { currentUser } from "@/server/auth/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) {
    return (
      <div className="py-10">
        <h1 className="font-display text-3xl font-extrabold">Me</h1>
        <p className="mt-3">
          <Link href="/sign-in" className="text-taxi underline">
            Sign in
          </Link>{" "}
          or{" "}
          <Link href="/sign-up" className="text-taxi underline">
            create an account
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-4 py-6">
      <h1 className="font-display text-3xl font-extrabold">@{user.handle}</h1>
      <p className="text-sm text-ink-dim">{user.displayName}</p>
      <div className="card space-y-3 p-4 text-sm">
        <p>Email: {user.email}</p>
        <p>
          Grant: {user.granted ? "FR200 received" : user.held ? "On hold" : "Waiting for email verification"}
        </p>
        <Link href={`/u/${user.handle}`} className="underline">
          Public profile
        </Link>
        {user.role === "admin" || user.role === "moderator" ? (
          <Link href="/admin" className="block underline">
            Admin
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/api/me/export" className="inline-flex h-12 items-center rounded-xl bg-night-3 px-4 text-sm font-semibold">
          Download my data
        </a>
        <SignOutButton />
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Delete account</h2>
        <p className="text-sm text-ink-dim">
          We remove your email, name and date of birth. The ledger stays, without your name on it, so the game&apos;s books still balance.
        </p>
        <DeleteAccountButton />
      </div>
      <p className="text-xs text-ink-dim">
        <Link href="/legal/privacy" className="underline">
          Privacy notice
        </Link>{" "}
        ·{" "}
        <Link href="/legal/terms" className="underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
