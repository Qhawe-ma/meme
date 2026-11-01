import Link from "next/link";
import { notFound } from "next/navigation";
import { publicProfile } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await publicProfile(handle);
  if (!profile) notFound();
  return (
    <div className="py-6">
      <h1 className="font-display text-3xl font-extrabold">@{profile.handle}</h1>
      <p className="text-ink-dim">{profile.displayName}</p>
      <h2 className="mt-6 font-display text-xl font-extrabold">Coins</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {profile.coins.length === 0 ? <li className="text-sm text-ink-dim">No live coins.</li> : null}
        {profile.coins.map((coin) => (
          <li key={coin.ticker}>
            <Link href={`/c/${coin.ticker}`} className="card card-hover flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coin.imageUrl} alt="" className="size-12 rounded-xl object-cover" />
              <span className="font-semibold">
                {coin.name} <span className="text-ink-dim">${coin.ticker}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
