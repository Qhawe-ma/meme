import Link from "next/link";
import { notFound } from "next/navigation";
import { canonicalContract } from "@/lib/contract/contract";
import { formatFR } from "@/lib/money/format";
import { ChartPanel } from "@/components/coin/chart-panel";
import { ContractPanel } from "@/components/coin/contract-panel";
import { TradePanel } from "@/components/coin/trade-panel";
import { LiveRefresh } from "@/components/live/refresh";
import { currentUser } from "@/server/auth/service";
import { coinHolders, coinTrades, getCoin } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const user = await currentUser();
  const coin = await getCoin(ticker, user?.id);
  if (!coin) notFound();
  const [trades, holders] = await Promise.all([coinTrades(ticker), coinHolders(ticker)]);
  const progress = Number(coin.card.progressBps) / 100;
  return (
    <div className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <LiveRefresh topics={`coin:${ticker},feed`} />
      <div className="space-y-4">
        <header className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coin.imageUrl} alt="" className="size-16 rounded-2xl object-cover sm:size-20" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-extrabold">{coin.card.name}</h1>
            <p className="text-sm text-ink-dim">
              ${coin.card.ticker} · by{" "}
              <Link href={`/u/${coin.card.creatorHandle}`} className="underline">
                @{coin.card.creatorHandle}
              </Link>
              {coin.card.phase === "pool" ? " · Graduated" : ""}
            </p>
            {coin.description ? <p className="mt-2 max-w-prose text-sm">{coin.description}</p> : null}
          </div>
        </header>
        {coin.links.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs">
            {coin.links.map((link) => (
              <li key={link.kind}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer ugc"
                  className="rounded-full bg-night-3 px-3 py-1 font-semibold"
                  title="You're leaving Meme Market. Links are added by coin creators. Never pay anyone real money for FR, coins or accounts."
                >
                  {link.kind}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Price / 1M", formatFR(BigInt(coin.card.priceUfrPer1m), { decimals: 4 })],
            ["Market cap", formatFR(BigInt(coin.card.marketCapUfr))],
            ["24h volume", formatFR(BigInt(coin.volume24hUfr))],
            ["Holders", String(coin.card.holders)],
          ].map(([label, value]) => (
            <div key={label} className="card px-3 py-2">
              <dt className="text-xs text-ink-dim">{label}</dt>
              <dd className="num font-display text-lg font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <ChartPanel ticker={coin.card.ticker} />
        <section className="card p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>Bonding curve</span>
            <span className="num text-ink-dim">
              {formatFR(BigInt(coin.card.reserveUfr))} / {formatFR(BigInt(coin.card.graduationTargetUfr), { decimals: 0 })}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-night" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-protea to-taxi" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-dim">
            {coin.card.phase === "pool" ? "Graduated. Trading continues in the pool." : `${progress.toFixed(1)}% to graduation`}
          </p>
        </section>
        <section className="card p-4">
          <h2 className="font-display text-xl font-extrabold">Trades</h2>
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {trades.items.length === 0 ? <li className="py-3 text-ink-dim">No trades yet.</li> : null}
            {trades.items.map((trade) => (
              <li key={trade.seq} className="flex items-center justify-between gap-2 py-2">
                <span className={trade.side === "buy" ? "font-semibold text-up" : "font-semibold text-down"}>
                  {trade.side} · @{trade.handle}
                </span>
                <span className="num text-ink-dim">
                  {formatFR(BigInt(trade.frUfr))} · {trade.shares} shares
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-display text-xl font-extrabold">Holders</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {holders?.items.map((holder) => (
              <li key={holder.label} className="flex justify-between gap-2">
                <span>
                  {holder.isCurve ? holder.label : `@${holder.label}`}
                  {holder.isCreator ? " · dev" : ""}
                </span>
                <span className="num text-ink-dim">{(Number(holder.pctBps) / 100).toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-display text-xl font-extrabold">Coin contract</h2>
          <div className="mt-3">
            <ContractPanel id={coin.contractId ?? ""} canonical={canonicalContract(coin.contract)} summary={coin.summary} />
          </div>
        </section>
        <p className="text-xs font-semibold text-taxi">Game · FR has no cash value</p>
      </div>
      <TradePanel ticker={coin.card.ticker} signedIn={Boolean(user?.granted)} cashUfr={(user?.cashUfr ?? 0n).toString()} shares={coin.myShares} />
    </div>
  );
}
