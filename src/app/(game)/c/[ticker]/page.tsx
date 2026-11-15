import Link from "next/link";
import { notFound } from "next/navigation";
import { canonicalContract } from "@/lib/contract/contract";
import { formatFR } from "@/lib/money/format";
import { ChartPanel } from "@/components/coin/chart-panel";
import { ContractPanel } from "@/components/coin/contract-panel";
import { Thread } from "@/components/coin/thread";
import { TradePanel } from "@/components/coin/trade-panel";
import { LiveRefresh } from "@/components/live/refresh";
import { currentUser } from "@/server/auth/service";
import { coinHolders, coinTrades, getCoin, listComments } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const user = await currentUser();
  const coin = await getCoin(ticker, user?.id);
  if (!coin) notFound();
  const [trades, holders, comments] = await Promise.all([
    coinTrades(ticker),
    coinHolders(ticker),
    listComments(coin.card.id),
  ]);
  const progress = Number(coin.card.progressBps) / 100;
  const change = BigInt(coin.card.change1hBps);
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_300px]">
      <LiveRefresh topics={`coin:${ticker},feed`} />
      <div className="order-2 px-3 py-3 lg:order-none lg:col-start-2 lg:row-span-6 lg:row-start-1">
        <TradePanel ticker={coin.card.ticker} signedIn={Boolean(user?.granted)} cashUfr={(user?.cashUfr ?? 0n).toString()} shares={coin.myShares} />
      </div>
      <div className="order-1 min-w-0 border-line lg:order-none lg:col-start-1 lg:border-r">
        <header className="flex gap-3 px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coin.imageUrl} alt="" className="size-14 object-cover sm:size-16" />
          <div className="min-w-0">
            <h1 className="display truncate text-4xl leading-none sm:text-5xl">{coin.card.name}</h1>
            <p className="mt-1 font-mono text-[11px] text-ink-dim">
              ${coin.card.ticker} ·{" "}
              <Link href={`/u/${coin.card.creatorHandle}`} className="text-taxi">
                @{coin.card.creatorHandle}
              </Link>
              {coin.card.phase === "pool" ? " · graduated" : ""}
            </p>
            {coin.description ? <p className="mt-2 max-w-prose text-sm text-ink-dim">{coin.description}</p> : null}
          </div>
        </header>
        <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
          {[
            ["Price / 1M", formatFR(BigInt(coin.card.priceUfrPer1m), { decimals: 4 }), change >= 0n],
            ["Market cap", formatFR(BigInt(coin.card.marketCapUfr)), null],
            ["24h volume", formatFR(BigInt(coin.volume24hUfr)), null],
            ["Holders", String(coin.card.holders), null],
          ].map(([label, value, up]) => (
            <div key={String(label)} className="border-r border-line px-3 py-2 last:border-r-0">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">{label}</dt>
              <dd className={`num text-lg ${up === true ? "text-up" : up === false ? "text-down" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="px-3 py-3">
          <ChartPanel ticker={coin.card.ticker} />
        </div>
        <div className="px-3 pb-3">
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            <span>Bonding curve</span>
            <span>
              {formatFR(BigInt(coin.card.reserveUfr))} / {formatFR(BigInt(coin.card.graduationTargetUfr), { decimals: 0 })}
            </span>
          </div>
          <div
            className="mt-1 h-2 bg-night-4"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-taxi" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-ink-dim">
            {coin.card.phase === "pool" ? "Off the curve. The pool is open." : `${progress.toFixed(1)}% of the way up the koppie`}
          </p>
        </div>
        {coin.links.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-3 pb-3 font-mono text-[10px] uppercase">
            {coin.links.map((link) => (
              <li key={link.kind}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer ugc"
                  className="border border-line px-2 py-1 text-ink-dim hover:text-ink"
                  title="You're leaving Meme Market. Links are added by coin creators. Never pay anyone real money for FR, coins or accounts."
                >
                  {link.kind}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid border-t border-line lg:grid-cols-2">
          <section>
            <h2 className="border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-dim">Tape</h2>
            <ul className="font-mono text-[11px]">
              {trades.items.length === 0 ? <li className="px-3 py-3 text-ink-dim">No trades yet.</li> : null}
              {trades.items.map((trade) => (
                <li key={trade.seq} className="flex justify-between gap-2 border-b border-line px-3 py-1.5">
                  <span className={trade.side === "buy" ? "text-up" : "text-down"}>
                    {trade.side} · @{trade.handle}
                  </span>
                  <span className="text-ink-dim">
                    {formatFR(BigInt(trade.frUfr))} · {trade.shares}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="border-line lg:border-l">
            <h2 className="border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-dim">Holders</h2>
            <ul className="text-sm">
              {holders?.items.map((holder) => (
                <li key={holder.label} className="border-b border-line px-3 py-1.5">
                  <div className="flex justify-between gap-2 font-mono text-[11px]">
                    <span>
                      {holder.isCurve ? holder.label : `@${holder.label}`}
                      {holder.isCreator ? " · dev" : ""}
                    </span>
                    <span className="text-ink-dim">{(Number(holder.pctBps) / 100).toFixed(2)}%</span>
                  </div>
                  <div className="mt-1 h-1 bg-night-4">
                    <div className="h-full bg-ink-dim" style={{ width: `${Math.min(100, Number(holder.pctBps) / 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="p-3">
          <Thread ticker={coin.card.ticker} signedIn={Boolean(user)} comments={comments} />
        </div>
        <section className="mx-3 mb-6 border border-line p-3">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">Coin contract</h2>
          <div className="mt-2">
            <ContractPanel id={coin.contractId ?? ""} canonical={canonicalContract(coin.contract)} summary={coin.summary} />
          </div>
        </section>
      </div>
    </div>
  );
}
