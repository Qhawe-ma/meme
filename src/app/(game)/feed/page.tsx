import Link from "next/link";
import { CoinRow } from "@/components/rank/coin-row";
import { LiveRefresh } from "@/components/live/refresh";
import { formatFR } from "@/lib/money/format";
import { listCoins } from "@/server/read/market";

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
    <div>
      <LiveRefresh topics="feed" />
      <div className="flex flex-wrap items-end justify-between gap-3 px-3 py-3">
        <div>
          <h1 className="display text-4xl leading-none">The floor</h1>
          <p className="mt-1 text-xs text-ink-dim">Fake rand. Real jokes. Prices move when someone actually trades.</p>
        </div>
        <form>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search name or ticker"
            aria-label="Search coins"
            className="h-9 w-56 max-w-full border border-line bg-night-2 px-2 text-sm"
          />
          <input type="hidden" name="tab" value={tab} />
        </form>
      </div>
      {params.welcome ? (
        <p className="mx-3 mb-2 border border-up/40 bg-night-2 px-3 py-2 text-sm text-up">
          Sharp. You got FR200. It has no cash value. Go put it on the rank.
        </p>
      ) : null}
      {params.held ? (
        <p className="mx-3 mb-2 border border-taxi px-3 py-2 text-sm">
          Eish. Your grant is on hold. You can look around. Trading opens if it clears.
        </p>
      ) : null}
      <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/feed?tab=${item.id}`}
            className={`font-geist whitespace-nowrap rounded-full px-3 py-1 text-[13px] ${tab === item.id ? "bg-taxi text-[#052e16]" : "text-ink-dim"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {king ? (
        <Link href={`/c/${king.ticker}`} className="mx-3 mb-2 flex items-center justify-between border-l-4 border-taxi bg-night-2 px-3 py-2">
          <span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-taxi">King of the koppie</span>
            <span className="display mt-1 block text-3xl leading-none">{king.ticker}</span>
          </span>
          <span className="text-right">
            <span className="num block">{formatFR(BigInt(king.marketCapUfr))}</span>
            <span className="font-mono text-[10px] text-ink-dim">{(Number(king.progressBps) / 100).toFixed(0)}%</span>
          </span>
        </Link>
      ) : null}
      <ul className="border-t border-line">
        {items.length === 0 ? <li className="px-3 py-8 text-sm text-ink-dim">Nothing on this tab. Launch one, now now.</li> : null}
        {items.map((coin, index) => (
          <CoinRow key={coin.id} coin={coin} rank={index + 1} />
        ))}
      </ul>
    </div>
  );
}
