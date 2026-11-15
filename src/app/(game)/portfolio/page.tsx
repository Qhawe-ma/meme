import Link from "next/link";
import { ClaimButton } from "@/components/portfolio/claim-button";
import { formatFR } from "@/lib/money/format";
import { currentUser } from "@/server/auth/service";
import { portfolioFor } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await currentUser();
  if (!user) {
    return (
      <div className="px-3 py-8">
        <h1 className="display text-5xl">Portfolio</h1>
        <p className="mt-3 text-sm text-ink-dim">
          <Link href="/sign-in" className="text-taxi">
            Sign in
          </Link>{" "}
          to see the book.
        </p>
      </div>
    );
  }
  const book = await portfolioFor(user.id);
  return (
    <div className="px-3 py-4">
      <h1 className="display text-5xl leading-none">@{user.handle}</h1>
      <dl className="mt-4 grid grid-cols-3 border border-line">
        {[
          ["Cash", book.cashUfr],
          ["Net worth", book.netWorthUfr],
          ["Season", book.seasonScoreUfr],
        ].map(([label, value]) => (
          <div key={label} className="border-r border-line px-3 py-3 last:border-r-0">
            <dt className="font-mono text-[10px] uppercase text-ink-dim">{label}</dt>
            <dd className="num mt-1 text-lg sm:text-2xl">{formatFR(BigInt(value ?? "0"))}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <ClaimButton pendingUfr={book.rewardsPendingUfr} />
      </div>
      <h2 className="mt-6 font-mono text-[10px] uppercase tracking-widest text-ink-dim">Holdings</h2>
      <ul className="border-t border-line">
        {book.holdings.length === 0 ? <li className="py-3 text-sm text-ink-dim">Bag is empty.</li> : null}
        {book.holdings.map((holding) => (
          <li key={holding.ticker} className="flex items-center justify-between border-b border-line py-2">
            <Link href={`/c/${holding.ticker}`} className="display text-2xl">
              {holding.ticker}
            </Link>
            <span className="num text-sm text-ink-dim">{formatFR(BigInt(holding.sellValueUfr))}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-mono text-[10px] uppercase tracking-widest text-ink-dim">Your coins</h2>
      <ul className="border-t border-line">
        {book.createdCoins.length === 0 ? <li className="py-3 text-sm text-ink-dim">You have not launched one.</li> : null}
        {book.createdCoins.map((coin) => (
          <li key={coin.ticker} className="flex items-center justify-between border-b border-line py-2">
            <Link href={`/c/${coin.ticker}`} className="display text-2xl">
              {coin.ticker}
            </Link>
            <span className="num text-xs text-ink-dim">rewards {formatFR(BigInt(coin.rewardsUfr))}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 font-mono text-[10px] uppercase tracking-widest text-ink-dim">History</h2>
      <ul className="border-t border-line font-mono text-[11px]">
        {book.history.map((row, index) => (
          <li key={`${row.at}-${index}`} className="flex justify-between border-b border-line py-1.5">
            <span className={row.side === "buy" ? "text-up" : "text-down"}>
              {row.side} ${row.ticker}
            </span>
            <span className="text-ink-dim">{formatFR(BigInt(row.grossUfr))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
