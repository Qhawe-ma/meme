import Link from "next/link";
import { redirect } from "next/navigation";
import { formatFR } from "@/lib/money/format";
import { GamePill } from "@/components/layout/game-pill";
import { currentUser } from "@/server/auth/service";
import { adminOverview } from "@/server/read/market";
import { AdminActions } from "@/components/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) redirect("/sign-in");
  const data = await adminOverview();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Admin</h1>
        <GamePill />
      </div>
      <p className="mt-2 text-sm text-ink-dim">
        <Link href="/feed" className="underline">
          Back to the floor
        </Link>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4 sm:col-span-3">
          <p className="text-xs font-bold uppercase tracking-wider text-taxi">Platform treasury</p>
          <p className="num font-display text-4xl font-extrabold">{formatFR(BigInt(data.treasuryUfr))}</p>
          <p className="text-xs text-ink-dim">Fees credited to the operator. This balance cannot be withdrawn or cashed out.</p>
        </div>
        {[
          ["Minted", data.mintedUfr],
          ["Player cash", data.cashUfr],
          ["Pending rewards", data.rewardsUfr],
          ["In curves", data.reservesUfr],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-ink-dim">{label}</p>
            <p className="num font-display text-xl font-bold">{formatFR(BigInt(value ?? "0"))}</p>
          </div>
        ))}
      </div>
      <p className={`mt-4 text-sm font-semibold ${data.balanced ? "text-up" : "text-down"}`}>
        {data.balanced ? "Ledger identity holds." : "Ledger identity is broken. Trading should be frozen."}
        {data.frozen ? ` Market paused${data.frozenReason ? `: ${data.frozenReason}` : ""}.` : ""} Preset: {data.preset}.
      </p>
      <p className="text-sm text-ink-dim">
        {data.users} players · {data.coins} live coins · {data.trades} trades
      </p>
      <h2 className="mt-8 font-display text-2xl font-extrabold">Moderation queue</h2>
      <AdminActions reports={data.reports} />
    </div>
  );
}
