import Link from "next/link";
import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import { CoinRow } from "@/components/rank/coin-row";
import { TradeTape } from "@/components/rank/tape";
import { formatFR } from "@/lib/money/format";
import { listCoins, recentTape } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [{ items, king }, tape] = await Promise.all([listCoins("trending", ""), recentTape(20)]);
  const lead = king ?? items[0] ?? null;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="flex items-center gap-3 px-3 py-2">
          <Logo />
          <div className="ml-auto flex items-center gap-3 text-xs font-semibold uppercase tracking-wide">
            <Link href="/sign-in" className="text-ink-dim hover:text-ink">
              Sign in
            </Link>
            <Link href="/sign-up" className="bg-taxi px-3 py-2 text-night">
              Get FR200
            </Link>
          </div>
        </div>
        <div className="px-3 pb-2">
          <GamePill />
        </div>
        <TradeTape items={tape} />
      </header>

      <section className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-taxi">Howzit · 18+ · fake rand</p>
          <h1 className="display mt-1 text-4xl leading-none sm:text-5xl">Launch a meme coin.</h1>
          <p className="mt-2 max-w-md text-sm text-ink-dim">
            Trade it with fake rand. The board is the game. FR has no cash value.
          </p>
          <Link href="/feed" className="mt-3 inline-block border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-night-3">
            Browse the floor
          </Link>
        </div>
        {lead ? (
          <Link href={`/c/${lead.ticker}`} className="border-l-4 border-taxi bg-night-2 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-taxi">
              {king ? "King of the koppie" : "Front of the rank"}
            </p>
            <p className="display text-4xl leading-none">{lead.ticker}</p>
            <p className="mt-1 text-xs text-ink-dim">{lead.name}</p>
            <p className="num mt-3 text-lg">{formatFR(BigInt(lead.marketCapUfr))}</p>
            <div className="mt-2 h-1 bg-night-4">
              <div className="h-full bg-taxi" style={{ width: `${Math.min(100, Number(lead.progressBps) / 100)}%` }} />
            </div>
          </Link>
        ) : (
          <p className="border border-dashed border-line p-4 text-sm text-ink-dim">No coins on the rank yet. Be the first, sharp sharp.</p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between border-y border-line px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-dim">
          <span>On the rank</span>
          <span>Mcap</span>
        </div>
        <ul>
          {items.slice(0, 12).map((coin, index) => (
            <CoinRow key={coin.id} coin={coin} rank={index + 1} />
          ))}
        </ul>
      </section>
    </div>
  );
}
