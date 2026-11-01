import Link from "next/link";
import { formatFR } from "@/lib/money/format";
import { listCoins } from "@/server/read/market";
import { LiveRefresh } from "@/components/live/refresh";

export const dynamic = "force-dynamic";

const tabs = [
  { id: "trending", label: "Trending" },
  { id: "new", label: "New" },
  { id: "graduating", label: "Almost there" },
  { id: "graduated", label: "Graduated" },
];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; welcome?: string; held?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "trending";
  const { items, king } = await listCoins(tab, params.q ?? "");
  return (
    <div className="py-5">
      <LiveRefresh topics="feed" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">The floor</h1>
          <p className="text-sm text-ink-dim">Fake rand. Real jokes. Prices move when people trade.</p>
        </div>
        <form className="w-full sm:w-64">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name or ticker"
            aria-label="Search coins"
            className="h-11 w-full rounded-xl border border-white/10 bg-night-2 px-3"
          />
          <input type="hidden" name="tab" value={tab} />
        </form>
      </div>
      {params.welcome ? (
        <p className="mt-4 rounded-xl bg-up/15 px-4 py-3 text-sm text-up">You got FR200. It has no cash value. Go trade or launch something.</p>
      ) : null}
      {params.held ? (
        <p className="mt-4 rounded-xl bg-taxi/15 px-4 py-3 text-sm">
          Your grant is on hold for a manual look. You can browse. Trading opens if the hold is cleared.
        </p>
      ) : null}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/feed?tab=${item.id}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${tab === item.id ? "bg-taxi text-night" : "bg-night-3 text-ink-dim"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {king ? (
        <Link href={`/c/${king.ticker}`} className="card card-hover mt-4 block p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-taxi">King of the hill</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {king.name} <span className="text-ink-dim">${king.ticker}</span>
          </p>
          <p className="text-sm text-ink-dim">{(Number(king.progressBps) / 100).toFixed(1)}% of the way to graduation</p>
        </Link>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 ? <li className="text-ink-dim">Nothing here yet. Launch the first coin.</li> : null}
        {items.map((coin) => (
          <li key={coin.id}>
            <Link href={`/c/${coin.ticker}`} className="card card-hover flex gap-3 p-3">
              {/* User uploads are served from our own media route. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coin.imageUrl} alt="" className="size-16 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-display text-lg font-extrabold">{coin.name}</p>
                  <p className="text-xs font-bold text-ink-dim">${coin.ticker}</p>
                </div>
                <p className="num text-sm">{formatFR(BigInt(coin.marketCapUfr))} mcap</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-night">
                  <div className="h-full rounded-full bg-protea" style={{ width: `${Math.min(100, Number(coin.progressBps) / 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-dim">
                  {coin.holders} holders · {coin.phase === "pool" ? "Graduated" : `${(Number(coin.progressBps) / 100).toFixed(1)}%`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
